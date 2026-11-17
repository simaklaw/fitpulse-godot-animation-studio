#!/usr/bin/env python3
"""Validate assets_manifest.json against its schema and basic integrity gates."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    from jsonschema import Draft202012Validator
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Missing dependency jsonschema. Install: python -m pip install 'jsonschema>=4.23,<5'"
    ) from exc

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MANIFEST = ROOT / "animation-pipeline/catalog/assets_manifest.json"
DEFAULT_SCHEMA = ROOT / "animation-pipeline/catalog/assets_manifest.schema.json"


def load_json(path: Path) -> object:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def validate(manifest_path: Path, schema_path: Path) -> list[str]:
    errors: list[str] = []
    schema = load_json(schema_path)
    data = load_json(manifest_path)
    validator = Draft202012Validator(schema)
    for err in sorted(validator.iter_errors(data), key=lambda e: list(e.path)):
        loc = "/".join(str(p) for p in err.path) or "(root)"
        errors.append(f"{loc}: {err.message}")

    if not isinstance(data, dict):
        return errors

    assets = data.get("assets") or []
    ids: list[str] = []
    for i, asset in enumerate(assets):
        if not isinstance(asset, dict):
            continue
        aid = asset.get("id")
        if aid:
            ids.append(str(aid))
        sha = asset.get("sha256")
        if sha and sha != "unknown" and len(str(sha)) != 64:
            errors.append(f"assets[{i}].sha256: expected 64 hex chars or 'unknown'")
        if asset.get("kind") == "godot_import_cache":
            rel = asset.get("path")
            if rel and not (ROOT / rel).is_file():
                errors.append(f"assets[{i}].path: file not found: {rel}")

    dup = {x for x in ids if ids.count(x) > 1}
    if dup:
        errors.append(f"duplicate asset ids: {sorted(dup)}")

    return errors


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    p.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA)
    args = p.parse_args(argv)

    if not args.manifest.is_file():
        print(f"FAIL: manifest not found: {args.manifest}", file=sys.stderr)
        return 1
    if not args.schema.is_file():
        print(f"FAIL: schema not found: {args.schema}", file=sys.stderr)
        return 1

    errors = validate(args.manifest, args.schema)
    if errors:
        print(f"FAIL: {len(errors)} error(s) in {args.manifest}")
        for e in errors:
            print(f"  - {e}")
        return 1

    data = load_json(args.manifest)
    n = len(data.get("assets") or []) if isinstance(data, dict) else 0
    print(f"OK: assets_manifest valid ({n} assets)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
