#!/usr/bin/env python3
"""Validate the reusable FitPulse exercise catalog and production acceptance states."""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any

try:
    from jsonschema import Draft202012Validator
except ImportError as exc:  # pragma: no cover - covered by CI install guard
    raise SystemExit("Missing dependency jsonschema. Install it with: python -m pip install 'jsonschema>=4.23,<5'") from exc

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CATALOG = ROOT / "animation-pipeline/catalog/exercise_catalog.json"
DEFAULT_SCHEMA = ROOT / "animation-pipeline/catalog/exercise-catalog.schema.json"
VALID_STATUSES = {"brief_only", "rendering", "prototype_unreviewed", "automated_qa_passed", "human_approved", "rejected"}
BUILT_STATUSES = {"automated_qa_passed", "human_approved"}
SLUG_RE = re.compile(r"^[a-z0-9]+(?:_[a-z0-9]+)*$")


class CatalogValidationError(ValueError):
    """A catalog failed a schema or a cross-field production gate."""


def _load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise CatalogValidationError(f"Required file does not exist: {path}") from exc
    except json.JSONDecodeError as exc:
        raise CatalogValidationError(f"Invalid JSON in {path}: line {exc.lineno}, column {exc.colno}: {exc.msg}") from exc


def _safe_asset_path(value: str, repo_root: Path, exercise_id: str, profile_name: str, field: str) -> None:
    if value.startswith(("http://", "https://", "file://")):
        raise CatalogValidationError(
            f"{exercise_id}.{profile_name}.{field}: runtime media paths must be repository-local; found URL {value!r}"
        )
    relative = value.removeprefix("res://")
    path = Path(relative)
    if path.is_absolute() or ".." in path.parts:
        raise CatalogValidationError(f"{exercise_id}.{profile_name}.{field}: unsafe media path {value!r}")
    target = (repo_root / path).resolve()
    if not target.is_relative_to(repo_root.resolve()):
        raise CatalogValidationError(f"{exercise_id}.{profile_name}.{field}: path escapes repository root")
    if not target.is_file():
        raise CatalogValidationError(
            f"{exercise_id}.{profile_name}.{field}: status requires a real asset, but file is missing: {value}"
        )


def validate_catalog(catalog: dict[str, Any], schema: dict[str, Any], repo_root: Path = ROOT) -> dict[str, Any]:
    Draft202012Validator.check_schema(schema)
    schema_errors = sorted(Draft202012Validator(schema).iter_errors(catalog), key=lambda err: list(map(str, err.absolute_path)))
    if schema_errors:
        details = []
        for error in schema_errors[:25]:
            location = "$" + "".join(f"[{part}]" if isinstance(part, int) else f".{part}" for part in error.absolute_path)
            details.append(f"{location}: {error.message}")
        more = f"\n... and {len(schema_errors) - 25} more schema errors" if len(schema_errors) > 25 else ""
        raise CatalogValidationError("Catalog JSON Schema validation failed:\n- " + "\n- ".join(details) + more)

    exercises = catalog["exercises"]
    ids = [exercise["id"] for exercise in exercises]
    duplicate_ids = sorted({exercise_id for exercise_id in ids if ids.count(exercise_id) > 1})
    if duplicate_ids:
        raise CatalogValidationError(f"Duplicate exercise IDs: {duplicate_ids}")

    for exercise in exercises:
        exercise_id = exercise["id"]
        movement = exercise["movement"]
        phases = movement["phases"]
        phase_ids = [phase["id"] for phase in phases]
        if len(phase_ids) != len(set(phase_ids)):
            raise CatalogValidationError(f"{exercise_id}: phase IDs must be unique")
        times = [phase["time"] for phase in phases]
        if times != sorted(times):
            raise CatalogValidationError(f"{exercise_id}: phase times must be monotonic")
        if abs(times[0]) > 1e-9 or abs(times[-1] - 1.0) > 1e-9:
            raise CatalogValidationError(f"{exercise_id}: first phase must be t=0 and last phase t=1")
        if movement["mode"] in {"repetition", "cycle"} and movement["loop"] is not True:
            raise CatalogValidationError(f"{exercise_id}: repetition/cycle assets must declare loop=true")
        if "human_technique_review" not in exercise["quality_gates"]:
            raise CatalogValidationError(f"{exercise_id}: human_technique_review is a mandatory release gate")
        if "full_body_in_frame" not in exercise["quality_gates"] or "mobile_readability" not in exercise["quality_gates"]:
            raise CatalogValidationError(f"{exercise_id}: full-body framing and phone-size readability are mandatory")

        production_status = exercise["production_status"]
        if production_status == "human_approved" and not str(exercise.get("human_review_evidence") or "").strip():
            raise CatalogValidationError(f"{exercise_id}: human_approved requires human_review_evidence")
        if production_status == "automated_qa_passed" and not all(
            exercise["media_profiles"][profile]["status"] in BUILT_STATUSES for profile in ("male", "female")
        ):
            raise CatalogValidationError(
                f"{exercise_id}: automated_qa_passed requires both male and female profiles to pass their asset gates"
            )
        if production_status == "human_approved" and not all(
            exercise["media_profiles"][profile]["status"] == "human_approved" for profile in ("male", "female")
        ):
            raise CatalogValidationError(f"{exercise_id}: human_approved requires both character presentations to be reviewed")

        for profile_name, media in exercise["media_profiles"].items():
            status = media["status"]
            if status == "human_approved":
                if not media.get("source_commit") or not re.fullmatch(r"[0-9a-f]{7,40}", media["source_commit"]):
                    raise CatalogValidationError(f"{exercise_id}.{profile_name}: human-approved asset needs a Git commit SHA")
                if not media.get("sha256"):
                    raise CatalogValidationError(f"{exercise_id}.{profile_name}: human-approved asset needs a SHA-256 digest")
                if not (media.get("sprite_frames") or media.get("video")) or not media.get("poster"):
                    raise CatalogValidationError(f"{exercise_id}.{profile_name}: approval requires a loop/video and a poster")
            for field in ("sprite_frames", "poster", "video"):
                value = media.get(field)
                if value:
                    _safe_asset_path(value, repo_root, exercise_id, profile_name, field)
            if status in BUILT_STATUSES:
                if not any(media.get(field) for field in ("sprite_frames", "video")):
                    raise CatalogValidationError(f"{exercise_id}.{profile_name}: built status requires a loop/video asset")
                if not media.get("poster"):
                    raise CatalogValidationError(f"{exercise_id}.{profile_name}: built status requires a poster")

    env_counts = Counter(env for exercise in exercises for env in exercise["environments"])
    status_counts = Counter(exercise["production_status"] for exercise in exercises)
    return {
        "exercise_count": len(exercises),
        "home_capable": sum("home" in e["environments"] for e in exercises),
        "gym_capable": sum("gym" in e["environments"] for e in exercises),
        "environment_memberships": dict(sorted(env_counts.items())),
        "production_statuses": dict(sorted(status_counts.items())),
        "unapproved_count": sum(e["production_status"] != "human_approved" for e in exercises),
    }


def validate_legacy_pull_up_spec(path: Path) -> int:
    """Guard the existing renderer-specific pull_up.json while the catalog is generalized."""
    if not path.is_file():
        return 0
    spec = _load_json(path)
    if spec.get("id") != "pull_up" or spec.get("movement", {}).get("pattern") != "pull_up":
        raise CatalogValidationError(f"{path}: expected the existing renderer-specific pull_up spec")
    keyframes = spec.get("keyframes")
    if not isinstance(keyframes, list) or len(keyframes) < 5:
        raise CatalogValidationError(f"{path}: at least five authored keyframes are required")
    times = [frame.get("t") for frame in keyframes]
    if any(not isinstance(t, (float, int)) for t in times) or times != sorted(times) or times[0] != 0 or times[-1] != 1:
        raise CatalogValidationError(f"{path}: keyframe times must increase from 0 to 1")
    for index, frame in enumerate(keyframes):
        bones = frame.get("bones", {})
        for required in ("pelvis", "upper_arm.*", "forearm.*"):
            if required not in bones:
                raise CatalogValidationError(f"{path}: keyframe {index} is missing {required}")
    return len(keyframes)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", type=Path, default=DEFAULT_CATALOG)
    parser.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA)
    parser.add_argument("--repo-root", type=Path, default=ROOT)
    parser.add_argument("--pull-up-spec", type=Path, default=ROOT / "animation-pipeline/exercises/pull_up.json")
    args = parser.parse_args()
    try:
        schema = _load_json(args.schema)
        catalog = _load_json(args.catalog)
        summary = validate_catalog(catalog, schema, args.repo_root)
        keyframes = validate_legacy_pull_up_spec(args.pull_up_spec)
    except CatalogValidationError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1
    print(f"PASS: schema and semantic gates passed for {summary['exercise_count']} exercise briefs")
    print(f"  Home-capable: {summary['home_capable']}; gym-capable: {summary['gym_capable']}")
    print(f"  Production status: {json.dumps(summary['production_statuses'], ensure_ascii=False, sort_keys=True)}")
    print(f"  Human-approved exercise animations: {summary['production_statuses'].get('human_approved', 0)}")
    if keyframes:
        print(f"PASS: existing pull-up renderer spec has {keyframes} ordered keyframes (0..1)")
    print("NOTE: schema validation does not render a character or certify technique.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
