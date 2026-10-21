# Workout Guide — pull-up reference import

## Why this exists

Use the existing Workout Guide SVG poses as reference material instead of generating new images. This workflow downloads the three published pull-up frames from a pinned commit, validates their SVG structure and declared 512 × 512 dimensions, and packages the source files, attribution, license notices, and SHA-256 hashes as a short-lived GitHub Actions artifact.

It does **not** generate new images, interpolate missing frames, create a male/female pair, or approve these assets for shipping in FitPulse.

## Source

- Repository: https://github.com/bryllim/workout-guide
- Pinned revision: `aac599224bb9780305239607ef98540b7e0ce389`
- Exercise: `pull-up`
- Source frames: `packages/workout-guide/assets/pull-up/frame-1.svg`, `frame-2.svg`, `frame-3.svg`
- Declared artwork license: CC BY-SA 4.0. Code in the source repository is separately MIT licensed.
- Upstream provenance for the first pose is documented by the source project as Everkinetic-derived artwork.

The workflow also downloads the upstream `LICENSE-ASSETS`, `LICENSES.md`, and `ATTRIBUTION.md` files into the artifact. Always review the license text and attribution at the pinned revision before reuse.

## Important licensing boundary

The three SVGs are downloaded for **inspection only**. CC BY-SA 4.0 requires attribution, indication of changes, and ShareAlike licensing for adaptations when distributed. Do not merge these graphics or adaptations into a closed/commercial FitPulse deliverable until the intended distribution model has been reviewed and the licensing implications accepted. This workflow does not grant additional rights.

## Run

1. Open GitHub Actions in this repository.
2. Choose **Import Workout Guide Pull-Up References**.
3. Select **Run workflow**.
4. Download the `workout-guide-pull-up-reference` artifact from the completed run.

The output contains three SVGs, upstream license/attribution notices, and `source-manifest.json` with the pinned source revision and hashes. No binary assets are committed to this repository.

## What this validates — and what it does not

**Automated:** source revision is pinned; exactly three expected frame paths are present; each SVG parses; each declares 512 × 512 dimensions; a full-canvas background rectangle is rejected; source attribution/license metadata is preserved; file hashes are recorded.

**Still requires human review:** whether the poses are visually useful, whether the sequence clearly communicates the pull-up, whether the SVGs render correctly in the target Godot version, whether the loop can be reconstructed well, and whether licensing is acceptable for the intended distribution.

Three static poses are not a 24–36-frame animation. Intermediate movement, loop timing, and a distinct female character remain separate unresolved tasks.
