#!/usr/bin/env python3
"""Inspect an animated-WebP ZIP without extracting or copying its media assets."""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
import zipfile
from collections import Counter
from pathlib import Path, PurePosixPath
from typing import Any

try:
    from PIL import Image
except ImportError as exc:
    raise SystemExit("Pillow is required. Install with: python -m pip install pillow") from exc


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _safe_name(name: str) -> bool:
    path = PurePosixPath(name)
    return not path.is_absolute() and ".." not in path.parts and "\\" not in name


def inspect_archive(source: Path) -> dict[str, Any]:
    payload = source.read_bytes()
    report: dict[str, Any] = {
        "source_file_name": source.name,
        "archive_bytes": len(payload),
        "archive_sha256": _sha256(payload),
        "metadata_only": True,
        "exercise_count": 0,
        "clip_count": 0,
        "clips": [],
        "warnings": [],
    }
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        bad = archive.testzip()
        if bad:
            raise ValueError(f"ZIP CRC validation failed at {bad!r}")
        entries = archive.infolist()
        unsafe = [entry.filename for entry in entries if not _safe_name(entry.filename)]
        if unsafe:
            raise ValueError(f"Archive contains unsafe paths: {unsafe[:10]}")
        names = {entry.filename for entry in entries}
        metadata_path = next((name for name in ("preview.en.json", "preview.json") if name in names), None)
        if metadata_path is None:
            raise ValueError("No preview.en.json or preview.json found")
        metadata = json.loads(archive.read(metadata_path).decode("utf-8"))
        exercises = metadata.get("exercises")
        if not isinstance(exercises, list) or not exercises:
            raise ValueError(f"{metadata_path} has no exercises array")
        report["exercise_count"] = len(exercises)
        report["metadata_path"] = metadata_path
        report["metadata_schema_version"] = metadata.get("schema_version")
        report["locales"] = metadata.get("locales", [metadata.get("locale")] if metadata.get("locale") else [])
        report["entry_count"] = len(entries)
        report["extension_counts"] = dict(sorted(Counter(PurePosixPath(name).suffix.lower() or "[none]" for name in names).items()))

        expected_ids = {str(item.get("id") or item.get("slug")) for item in exercises}
        clip_paths = sorted(
            name for name in names
            if name.lower().endswith(".webp")
            and (name.startswith("images/animations/") or name.startswith("female/images/animations/"))
        )
        media_by_id: dict[str, set[str]] = {}
        clips = []
        dims = Counter()
        frames_hist = Counter()
        delay_samples: list[int] = []
        for name in clip_paths:
            exercise_id = PurePosixPath(name).name.removesuffix(".webp")
            variant = "female" if name.startswith("female/") else "male"
            media_by_id.setdefault(exercise_id, set()).add(variant)
            image_bytes = archive.read(name)
            try:
                image = Image.open(io.BytesIO(image_bytes))
                width, height = image.size
                frame_count = int(getattr(image, "n_frames", 1))
                loop = image.info.get("loop")
                image.seek(0)
                first = image.convert("RGBA")
                alpha = first.getchannel("A")
                bbox = alpha.getbbox()
                corner_transparent = alpha.getpixel((0, 0)) == 0
                durations = []
                for index in sorted(set([0, 1, max(0, frame_count // 2)])):
                    try:
                        image.seek(index)
                        duration = image.info.get("duration")
                        if isinstance(duration, (int, float)) and duration > 0:
                            durations.append(int(duration))
                    except EOFError:
                        pass
                record = {
                    "exercise_id": exercise_id,
                    "variant": variant,
                    "path": name,
                    "sha256": _sha256(image_bytes),
                    "bytes": len(image_bytes),
                    "format": image.format,
                    "width": width,
                    "height": height,
                    "frames": frame_count,
                    "loop": loop,
                    "duration_sample_ms": sorted(set(durations)),
                    "transparent_corner": corner_transparent,
                    "nonempty_first_frame": bbox is not None,
                    "first_frame_alpha_bbox": list(bbox) if bbox else None,
                }
                if frame_count < 2:
                    report["warnings"].append(f"{name}: only {frame_count} frame(s); not a looping animation")
                if not corner_transparent:
                    report["warnings"].append(f"{name}: top-left pixel is not transparent")
                if not bbox:
                    report["warnings"].append(f"{name}: first frame contains no visible pixels")
                if loop != 0:
                    report["warnings"].append(f"{name}: loop metadata is {loop!r}, expected 0 for infinite loop")
            except Exception as exc:
                raise ValueError(f"Cannot read animation {name}: {exc}") from exc
            clips.append(record)
            dims[f"{width}x{height}"] += 1
            frames_hist[frame_count] += 1
            delay_samples.extend(record["duration_sample_ms"])

        report["clips"] = clips
        report["clip_count"] = len(clips)
        report["dimensions"] = dict(sorted(dims.items()))
        report["frame_count_histogram"] = {str(key): value for key, value in sorted(frames_hist.items())}
        report["transparent_corner_count"] = sum(c["transparent_corner"] for c in clips)
        report["infinite_loop_count"] = sum(c["loop"] == 0 for c in clips)
        report["sampled_frame_delay_ms"] = {
            "min": min(delay_samples) if delay_samples else None,
            "max": max(delay_samples) if delay_samples else None,
            "unique": sorted(set(delay_samples)),
        }
        found_ids = set(media_by_id)
        report["metadata_without_animation"] = sorted(expected_ids - found_ids)
        report["animation_without_metadata"] = sorted(found_ids - expected_ids)
        report["missing_male_female_pair"] = sorted(
            slug for slug, variants in media_by_id.items() if variants != {"male", "female"}
        )
        report["frame_count_mismatches_by_profile"] = []
        for slug, variants in sorted(media_by_id.items()):
            if variants != {"male", "female"}:
                continue
            male = next(c["frames"] for c in clips if c["exercise_id"] == slug and c["variant"] == "male")
            female = next(c["frames"] for c in clips if c["exercise_id"] == slug and c["variant"] == "female")
            if male != female:
                report["frame_count_mismatches_by_profile"].append(
                    {"exercise_id": slug, "male_frames": male, "female_frames": female}
                )
        report["interpretation_limits"] = [
            "Metadata and first-frame alpha are checked; the script does not certify a visually seamless loop.",
            "Importing image frames does not retarget a rig or certify movement biomechanics.",
            "No source media is extracted, converted, or copied into the report.",
        ]
    return report


def write_report(report: dict[str, Any], output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "animation-archive-audit.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    clips = report["clips"]
    clip_bytes = sum(int(clip["bytes"]) for clip in clips)
    counts = [int(clip["frames"]) for clip in clips]
    lines = [
        "# Exercise animation archive audit",
        "",
        f"- Source file: {report['source_file_name']}",
        f"- ZIP size: {report['archive_bytes']:,} bytes",
        f"- ZIP SHA-256: {report['archive_sha256']}",
        f"- Exercises in JSON: {report['exercise_count']}",
        f"- Animated WebP files: {report['clip_count']}",
        f"- Total animation bytes: {clip_bytes:,}",
        f"- Dimensions: {report.get('dimensions', {})}",
        f"- Frames per clip: {min(counts) if counts else 'n/a'}–{max(counts) if counts else 'n/a'}",
        f"- Infinite-loop metadata: {report.get('infinite_loop_count', 0)} / {len(clips)}",
        f"- Transparent first-frame corner: {report.get('transparent_corner_count', 0)} / {len(clips)}",
        f"- Sampled frame delays (ms): {report.get('sampled_frame_delay_ms', {})}",
        "",
        "## Clip inventory",
        "",
        "| Exercise | Profile | Dimensions | Frames | Delay samples (ms) | Loop | Alpha corner |",
        "|---|---|---:|---:|---|---:|---|",
    ]
    for clip in clips:
        lines.append(
            f"| {clip['exercise_id']} | {clip['variant']} | {clip['width']}x{clip['height']} "
            f"| {clip['frames']} | {clip['duration_sample_ms']} | {clip['loop']} "
            f"| {'yes' if clip['transparent_corner'] else 'no'} |"
        )
    lines.extend(["", "## Coverage gaps", ""])
    for key, label in (
        ("metadata_without_animation", "Exercise metadata without an animation"),
        ("animation_without_metadata", "Animations without matching metadata"),
        ("missing_male_female_pair", "Exercises missing a male/female animation pair"),
        ("frame_count_mismatches_by_profile", "Male/female frame-count mismatches"),
    ):
        lines.append(f"- **{label}:** {json.dumps(report.get(key, []), ensure_ascii=False)}")
    lines.extend(["", "## Warnings", ""])
    warnings = report.get("warnings", [])
    lines.extend([f"- {value}" for value in warnings] if warnings else ["- No structural warnings found."])
    lines.extend(["", "## Interpretation limits", ""])
    lines.extend(f"- {note}" for note in report.get("interpretation_limits", []))
    (output_dir / "REPORT.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path, help="ZIP with preview JSON and animated WebP assets")
    parser.add_argument("--out", type=Path, required=True, help="Directory for metadata-only reports")
    args = parser.parse_args()
    if not args.archive.is_file():
        parser.error(f"archive does not exist: {args.archive}")
    try:
        report = inspect_archive(args.archive)
        write_report(report, args.out)
    except (ValueError, OSError, zipfile.BadZipFile, json.JSONDecodeError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1
    print(f"PASS: inspected {report['clip_count']} animated files for {report['exercise_count']} exercises")
    print(f"Metadata-only report: {args.out / 'REPORT.md'}")
    print(f"Structural warnings: {len(report['warnings'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
