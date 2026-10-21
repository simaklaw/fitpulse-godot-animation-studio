# Workout Guide — pull-up reference import

## Purpose

Use existing exercise artwork as the starting point, not generated images. This workflow downloads the three published pull-up SVG poses from a pinned commit, validates the source files, renders transparent PNG previews, and builds a dark-background contact sheet so the artwork can be inspected on a phone or in a browser.

This is a reference-review pipeline. It does not yet interpolate missing frames, create a distinct male/female pair, or validate the movement in Godot.

## Source

- Repository: https://github.com/bryllim/workout-guide
- Pinned revision: `aac599224bb9780305239607ef98540b7e0ce389`
- Exercise: `pull-up`
- Source frames: `packages/workout-guide/assets/pull-up/frame-1.svg`, `frame-2.svg`, `frame-3.svg`
- Artwork license and provenance notices are included in the artifact for traceability.

## Run

1. Open GitHub Actions in this repository.
2. Choose **Import Workout Guide Pull-Up References**.
3. Select **Run workflow**.
4. Download the `workout-guide-pull-up-reference` artifact from the completed run.
5. Open `contact-sheet-dark.png` first. It shows all three poses on a dark background. Individual files are in `preview-png/`; transparent PNGs preserve alpha. Original SVGs remain in `frames/`.

The artifact includes the source SVGs, rendered PNG previews, contact sheet, upstream license/attribution notices, and `source-manifest.json` with source revision and SHA-256 hashes. Binary assets are not committed to this repository.

## Automated checks

- Source revision is pinned and exactly three expected frame paths are required.
- Each SVG must parse and declare 512 × 512 dimensions.
- A full-canvas background rectangle is rejected.
- SVGs are rendered to 512 × 512 PNGs; alpha is checked to ensure transparency survived.
- A contact sheet is assembled on a dark background for readable inspection.

## Not yet verified

These checks do not establish that the three poses form a smooth or biomechanically accurate animation, that the SVGs import correctly in the target Godot version, or that a distinct female version exists. Three static poses are not a 24–36-frame cycle. Next production work should compare available source repositories, then build a repeatable preview/interpolation workflow around assets that pass visual review.
