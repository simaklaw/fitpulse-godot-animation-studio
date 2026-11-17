# FitPulse Animation Studio — Godot project

This is the initial Godot project scaffold for automated headless import/parse validation. It is not yet a finished animation studio and contains no production exercise rig or exercise animation.

## Validation

The GitHub Actions workflow downloads Godot 4.5 and opens this project in headless editor mode. A successful run confirms project import/parsing only; it does not prove visual quality, biomechanics, playback behavior, or Android integration.

## Planned asset layout

- `scenes/`: reusable preview and exercise scenes
- `assets/rigs/`: licensed character rigs
- `assets/animations/`: source animation files and imported GLB resources
- `scripts/`: preview, metadata, and validation helpers
- `tests/`: reproducible project-level checks

Before adding third-party rigs or animation files, verify the asset license and redistribution terms.
