#!/usr/bin/env python3
"""Fetch pinned Workout Guide pull-up reference SVGs for review only.

The files are downloaded into a CI artifact, never committed into this repository.
This does not generate intermediate animation frames or approve the assets for FitPulse.
"""
from __future__ import annotations

import json
import os
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

REPO = "bryllim/workout-guide"
REVISION = "aac599224bb9780305239607ef98540b7e0ce389"
BASE = f"https://raw.githubusercontent.com/{REPO}/{REVISION}/"
OUT = Path(os.environ.get("OUTPUT_DIR", "output/workout-guide-pull-up-reference"))
PACKAGE_ROOT = "packages/workout-guide/"
LICENSE_FILES = ("LICENSE-ASSETS", "LICENSES.md", "ATTRIBUTION.md")


def download(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "FitPulse-Animation-Lab/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        if response.status != 200:
            raise RuntimeError(f"Unexpected HTTP status {response.status} for {url}")
        return response.read()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest_url = BASE + PACKAGE_ROOT + "manifest.json"
    manifest = json.loads(download(manifest_url).decode("utf-8"))
    exercise = next((item for item in manifest if item.get("slug") == "pull-up"), None)
    if not exercise:
        raise RuntimeError("Pinned source manifest has no pull-up exercise")
    frames = exercise.get("frames", [])
    if len(frames) != 3:
        raise RuntimeError(f"Expected exactly 3 reference frames, got {len(frames)}")

    output_frames = OUT / "frames"
    output_frames.mkdir(exist_ok=True)
    records = []
    for frame in frames:
        path = frame["path"]
        if not path.startswith("assets/pull-up/") or not path.endswith(".svg"):
            raise RuntimeError(f"Unexpected source frame path: {path}")
        payload = download(BASE + PACKAGE_ROOT + path)
        root = ET.fromstring(payload)
        if root.tag.split("}")[-1] != "svg":
            raise RuntimeError(f"Frame {path} is not an SVG document")
        width, height = root.attrib.get("width"), root.attrib.get("height")
        if width != "512" or height != "512":
            raise RuntimeError(f"Frame {path} has dimensions {width} x {height}, expected 512 x 512")
        # Reject a full-canvas rectangle that would make the reference opaque.
        for node in root.iter():
            if node.tag.split("}")[-1] != "rect":
                continue
            attrs = node.attrib
            if (attrs.get("x", "0") in ("0", "0.0")
                    and attrs.get("y", "0") in ("0", "0.0")
                    and attrs.get("width") in ("512", "512.0", "100%")
                    and attrs.get("height") in ("512", "512.0", "100%")):
                raise RuntimeError(f"Frame {path} contains a full-canvas background rectangle")
        destination = output_frames / f"frame-{frame['index']}.svg"
        destination.write_bytes(payload)
        attribution = frame.get("attribution", {})
        records.append({
            "index": frame["index"],
            "source_path": path,
            "local_path": f"frames/{destination.name}",
            "width": 512,
            "height": 512,
            "format": "svg",
            "license": attribution.get("license", "CC BY-SA 4.0"),
            "license_url": attribution.get("licenseUrl", "https://creativecommons.org/licenses/by-sa/4.0/"),
            "attribution": attribution,
            "source_url": BASE + PACKAGE_ROOT + path,
            "sha256": __import__("hashlib").sha256(payload).hexdigest(),
        })

    for filename in LICENSE_FILES:
        payload = download(BASE + PACKAGE_ROOT + filename)
        (OUT / filename).write_bytes(payload)

    report = {
        "purpose": "Reference-only source import; not approved for shipping in FitPulse",
        "source_repository": f"https://github.com/{REPO}",
        "source_revision": REVISION,
        "exercise": exercise["name"],
        "exercise_slug": exercise["slug"],
        "declared_asset_license": "CC BY-SA 4.0",
        "source_manifest_url": manifest_url,
        "frames": records,
        "review_status": "downloaded_and_structurally_checked; visual and biomechanical review pending",
        "important_limit": "Three static poses do not constitute a smooth 24-36 frame animation or a male/female asset pair.",
    }
    (OUT / "source-manifest.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Fetched and structurally checked {len(records)} pinned pull-up SVG reference frames.")
    print(f"Artifact directory: {OUT}")
    print("No intermediate frames generated; no assets committed; visual review remains pending.")


if __name__ == "__main__":
    main()
