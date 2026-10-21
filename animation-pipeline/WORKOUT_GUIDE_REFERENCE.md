# Workout Guide — reference import and pilot comparison

## Purpose

Use existing exercise artwork as the starting point, not generated images. The workflow downloads reference poses from a pinned commit, validates the SVG source, renders transparent PNG previews, and assembles dark-background contact sheets for inspection on a phone or browser.

These are reference-review assets. The pipeline does not yet interpolate missing frames, create distinct male/female character designs, or validate the movement in Godot.

## Source

- Repository: https://github.com/bryllim/workout-guide
- Pinned revision: `aac599224bb9780305239607ef98540b7e0ce389`
- Pilot exercises: `pull-up`, `hanging-knee-raise`, `incline-dumbbell-curl`, `front-squat`, and `one-arm-dumbbell-row`
- Each selected exercise is expected to contain three SVG poses at 512 × 512.
- Source license and attribution notices are included in the artifact, with SHA-256 hashes for each downloaded frame.

## Run

1. Open GitHub Actions in this repository.
2. Choose **Import Workout Guide Exercise References**.
3. Select **Run workflow**.
4. Download `workout-guide-pull-up-reference` for the original pull-up review bundle or `workout-guide-pilot-references` for the five-exercise comparison.
5. For the pilot bundle, open `pilot-contact-sheet-dark.png` first. Individual transparent PNGs are stored under each exercise's `preview-png/` directory; original SVGs are in `frames/`.

The pilot bundle contains `pilot-reference-manifest.json`, `pilot-asset-qa-report.json`, the original SVGs, rendered PNG previews, and upstream license/attribution notices. Binary assets are not committed to this repository.

## Automated checks

- Source revision is pinned and all five expected exercise slugs must exist in the upstream manifest.
- Exactly three frames are required per selected exercise.
- Each SVG must parse and declare 512 × 512 dimensions.
- A full-canvas background rectangle is rejected.
- SVGs are rendered to 512 × 512 PNGs; alpha is checked to ensure transparency survived.
- Every rendered PNG must have a non-empty alpha bounding box; the report records the alpha bounds, nontransparent pixel count, and SHA-256.
- The QA JSON and dark contact sheet are uploaded with the pilot bundle.
- A dark contact sheet arranges the five exercises by row and the three source poses by column.

## Limits and next production gate

The selected source provides three static poses per exercise. This does not establish a smooth or biomechanically accurate animation, and the source does not provide a distinct male/female character pair. The contact sheet is intended to compare pose clarity, equipment visibility, framing, and how much work is needed to create a premium animation. After visual review, select one exercise as the first production candidate and specify the required motion phases before implementing interpolation or a Godot scene.

## Manual visual review rubric

Review the contact sheet at phone size and record each exercise against these gates before choosing it for production:

- **Pose readability:** the exercise is recognizable from the silhouette without reading its label.
- **Equipment and contact:** bar, bench, dumbbells, or kettlebell are visible and align with the character's hands/body.
- **Range of motion:** the three poses communicate distinct, ordered phases rather than near-duplicates.
- **Framing:** head, hands, feet, and equipment stay inside the canvas; the subject has enough margin for mobile cropping.
- **Consistency:** character scale, camera angle, stroke/line weight, and visual treatment remain consistent across the three poses.
- **Production gap:** note missing intermediate phases, unclear joints, or any need for a new male/female design rather than treating recoloring as a variant.

Use `PASS`, `REVIEW`, or `REJECT` per criterion and choose the first animation candidate only after a human has opened the artifact. CI's XML, dimensions, alpha, and file-count checks are structural checks, not a visual or biomechanics approval.
