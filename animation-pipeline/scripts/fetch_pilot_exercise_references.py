#!/usr/bin/env python3
"""Fetch a pinned set of Workout Guide exercise references for visual comparison only."""
from __future__ import annotations

import hashlib
import json
import os
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

REPO = "bryllim/workout-guide"
REVISION = "aac599224bb9780305239607ef98540b7e0ce389"
BASE = f"https://raw.githubusercontent.com/{REPO}/{REVISION}/"
PACKAGE_ROOT = "packages/workout-guide/"
OUT = Path(os.environ.get("OUTPUT_DIR", "output/workout-guide-pilot-references"))
PILOT_SLUGS = (
    "pull-up",
    "hanging-knee-raise",
    "incline-dumbbell-curl",
    "front-squat",
    "one-arm-dumbbell-row",
)
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
    by_slug = {item.get("slug"): item for item in manifest}
    missing = [slug for slug in PILOT_SLUGS if slug not in by_slug]
    if missing:
        raise RuntimeError(f"Missing pilot exercises in pinned manifest: {missing}")

    exercise_records = []
    total_frames = 0
    for slug in PILOT_SLUGS:
        exercise = by_slug[slug]
        frames = exercise.get("frames", [])
        if len(frames) != 3:
            raise RuntimeError(f"{slug}: expected 3 frames, got {len(frames)}")
        frame_dir = OUT / slug / "frames"
        frame_dir.mkdir(parents=True, exist_ok=True)
        records = []
        for frame in frames:
            path = frame.get("path", "")
            expected_prefix = f"assets/{slug}/"
            if not path.startswith(expected_prefix) or not path.endswith(".svg"):
                raise RuntimeError(f"{slug}: unexpected source frame path {path}")
            payload = download(BASE + PACKAGE_ROOT + path)
            root = ET.fromstring(payload)
            if root.tag.split("}")[-1] != "svg":
                raise RuntimeError(f"{path} is not an SVG document")
            width, height = root.attrib.get("width"), root.attrib.get("height")
            if width != "512" or height != "512":
                raise RuntimeError(f"{path}: expected 512x512 SVG, got {width}x{height}")
            for node in root.iter():
                if node.tag.split("}")[-1] == "rect":
                    attrs = node.attrib
                    if (attrs.get("x", "0") in ("0", "0.0")
                            and attrs.get("y", "0") in ("0", "0.0")
                            and attrs.get("width") in ("512", "512.0", "100%")
                            and attrs.get("height") in ("512", "512.0", "100%")):
                        raise RuntimeError(f"{path} has a full-canvas background rectangle")
            local = frame_dir / f"frame-{frame['index']}.svg"
            local.write_bytes(payload)
            attribution = frame.get("attribution", {})
            records.append({
                "index": frame["index"],
                "source_path": path,
                "local_path": str(local.relative_to(OUT)),
                "width": 512,
                "height": 512,
                "format": "svg",
                "license": attribution.get("license", "CC BY-SA 4.0"),
                "license_url": attribution.get("licenseUrl", "https://creativecommons.org/licenses/by-sa/4.0/"),
                "attribution": attribution,
                "source_url": BASE + PACKAGE_ROOT + path,
                "sha256": hashlib.sha256(payload).hexdigest(),
            })
        exercise_records.append({
            "slug": slug,
            "name": exercise.get("name", slug),
            "equipment": exercise.get("equipment"),
            "primary_muscle": exercise.get("primaryMuscle"),
            "source_exercise_url": f"https://github.com/{REPO}/tree/{REVISION}/{PACKAGE_ROOT}assets/{slug}",
            "frames": records,
            "review_status": "downloaded_and_structurally_checked; visual and biomechanical review pending",
        })
        total_frames += len(records)

    for filename in LICENSE_FILES:
        (OUT / filename).write_bytes(download(BASE + PACKAGE_ROOT + filename))
    report = {
        "purpose": "Reference-only pilot comparison; not approved as finished FitPulse animation assets",
        "source_repository": f"https://github.com/{REPO}",
        "source_revision": REVISION,
        "manifest_url": manifest_url,
        "exercise_count": len(exercise_records),
        "frame_count": total_frames,
        "exercises": exercise_records,
        "important_limit": "Each exercise has three static poses. They are references, not a smooth loop, and do not provide distinct male/female character variants.",
    }
    (OUT / "pilot-reference-manifest.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Fetched and structurally checked {len(exercise_records)} exercises / {total_frames} SVG frames.")
    print(f"Artifact directory: {OUT}")
    print("No interpolation or biomechanical validation performed.")


if __name__ == "__main__":
    main()
