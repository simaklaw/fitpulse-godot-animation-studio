#!/usr/bin/env python3
"""Audit Quaternius Universal Base Characters Standard ZIP without extracting it.

Usage:
  python tools/audit_quaternius_pack.py "/path/to/Universal Base Characters[Standard].zip"

This verifies provenance/license markers and reports the Godot glTF skeleton,
mesh, material, texture and animation inventory. It does not import or publish
any character assets.
"""
from __future__ import annotations

import hashlib
import json
import sys
import zipfile
from pathlib import PurePosixPath

EXPECTED_SHA256 = "fdbf1804c90dfc1ea03e992bff7da2dfd1a79318e13270a660180f9308455f40"
ROOT = "Universal Base Characters[Standard]/"
GODOT = ROOT + "Base Characters/Godot - UE/"
LICENSE = ROOT + "License_Standard.txt"
MODELS = {
    "male": GODOT + "Superhero_Male_FullBody.gltf",
    "female": GODOT + "Superhero_Female_FullBody.gltf",
}


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    path = sys.argv[1]
    digest = hashlib.sha256()
    with open(path, "rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    sha = digest.hexdigest()
    if sha != EXPECTED_SHA256:
        raise SystemExit(f"Unexpected archive SHA-256: {sha}")

    with zipfile.ZipFile(path) as archive:
        names = set(archive.namelist())
        license_text = archive.read(LICENSE).decode("utf-8", "replace")
        if "CC0 1.0 Universal" not in license_text:
            raise SystemExit("The expected CC0 1.0 license marker is missing")
        result = {
            "archive": PurePosixPath(path).name,
            "sha256": sha,
            "license": "CC0 1.0 Universal",
            "author": "Quaternius",
            "files": sum(not item.is_dir() for item in archive.infolist()),
            "uncompressed_bytes": sum(item.file_size for item in archive.infolist()),
            "models": {},
        }
        for gender, gltf_path in MODELS.items():
            if gltf_path not in names:
                raise SystemExit(f"Missing expected {gender} glTF: {gltf_path}")
            doc = json.loads(archive.read(gltf_path))
            buffers = doc.get("buffers", [])
            images = doc.get("images", [])
            missing = []
            for resource in buffers + images:
                uri = resource.get("uri")
                if uri and not uri.startswith("data:"):
                    target = str(PurePosixPath(gltf_path).parent / uri)
                    if target not in names:
                        missing.append(target)
            if missing:
                raise SystemExit(f"{gender} model has missing referenced resources: {missing}")
            skins = doc.get("skins", [])
            result["models"][gender] = {
                "source": gltf_path,
                "gltf_version": doc.get("asset", {}).get("version"),
                "nodes": len(doc.get("nodes", [])),
                "meshes": len(doc.get("meshes", [])),
                "materials": len(doc.get("materials", [])),
                "skins": [{"name": s.get("name"), "joints": len(s.get("joints", []))} for s in skins],
                "animations": len(doc.get("animations", [])),
                "external_buffers": [b.get("uri") for b in buffers if b.get("uri")],
                "external_images": [i.get("uri") for i in images if i.get("uri")],
            }
            if not skins or len(skins[0].get("joints", [])) < 50:
                raise SystemExit(f"{gender} model does not contain the expected humanoid skeleton")
            if not buffers:
                raise SystemExit(f"{gender} model has no geometry buffer")
        print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
