# FitPulse Godot Animation Studio

Separate workshop for authoring, previewing, validating and exporting FitPulse exercise animation media. The Android product stays in `simaklaw/forma`; this repository owns animation briefs, rig/render pipelines, QA gates and the Godot review environment.

## Open the workshop

- Current pull-up motion prototype: `scenes/pull_up_preview.tscn` with `scripts/pull_up_preview.gd`.
- **Exercise production catalog**: open `scenes/exercise_catalog_preview.tscn` in Godot 4.x to browse exercise briefs, filter home/gym exercises, switch male/female presentation, and inspect movement phases, equipment alternatives, technique cues, common errors and mandatory QA gates.
- Catalog JSON and schema: `animation-pipeline/catalog/exercise_catalog.json` and `animation-pipeline/catalog/exercise-catalog.schema.json`.
- Renderer contracts/coverage: `animation-pipeline/catalog/renderer_adapter_registry.json` and `animation-pipeline/catalog/repdb-preview-coverage.json`.
- Production workflow and authoring rules: `animation-pipeline/EXERCISE_PRODUCTION_WORKFLOW.md`.
- Pull-up motion/technical acceptance brief: `animation-pipeline/PULL_UP_MOTION_BRIEF.md`.

The catalog currently contains 11 reusable exercise briefs. It is a production registry, not a claim that every listed exercise already has a finished animation. A card displays a real poster/video/SpriteFrames resource only when its declared media path exists. Otherwise it explicitly shows that the clip has not been generated; there is no fake character placeholder.

## Standard exercise workflow

1. Add a unique exercise brief to the catalog: intended environment (home/gym), equipment and substitutions, setup, technique cues, common faults, breathing and safety notes.
2. Describe the normalized movement phases from 0 to 1 and add exercise-specific quality gates, including contacts with the floor/equipment where relevant.
3. Create or adapt a suitable rig/renderer adapter and produce actual male/female media. Different variants may have different frame counts; compare phase meaning and timing instead of forcing the same raw frame count.
4. Run the catalog validator and Godot scene tests. The renderer must independently pass structural geometry, transparency, timing, loop and contact checks.
5. Perform visual technique review on the rendered clips. Do not set `human_approved` without real evidence, a source commit, SHA-256, a poster and valid media paths for both presentations.
6. Only then prepare the app-side media integration PR in `simaklaw/forma`. CI green is not a substitute for animation review or playback tests on Android.

## Checks

The `Validate FitPulse Exercise Production Catalog` workflow checks the JSON Schema, cross-field quality gates, duplicate IDs, phase timing, media path safety, legacy pull-up spec, unit tests and Godot scene load.

To validate locally, install Python dependencies `jsonschema` and `pillow`, then run:

- `python animation-pipeline/scripts/validate_exercise_catalog.py`
- `python -m unittest discover -s animation-pipeline/tests -v`

The generic ZIP auditor is metadata-only and does not extract or transform source media: `animation-pipeline/scripts/audit_animation_reference_zip.py`.

## Reference-preview evaluation

The supplied RepDB preview demonstrated a consistent transparent animation format over 22 exercises, with separate male/female clips. It is useful for evaluating animation readability and reference coverage, but it is a limited sample and not a rigged character source for retargeting. The supplied binaries were **not copied into this public repository**. The report and next steps are in `animation-pipeline/EXERCISE_PRODUCTION_WORKFLOW.md`.

## Cloudflare Worker

The existing Worker URL is `https://godot-mcp.simaklaw-vl.workers.dev`. Deployment requires repository secrets described in `docs/deployment.md`. Never commit tokens or paste them into issues.

## Quality boundary

The workshop can validate authored data, generated file structure, programmed joint/contact/clearance conditions and export metadata. It cannot certify anatomy or coaching safety solely from those checks. Each exercise needs technique-specific constraints and human visual review before being considered production-ready. The existing pull-up renderer spec remains separate from the general catalog; future exercises need explicit renderer adapters rather than blindly reusing pull-up bone angles.
