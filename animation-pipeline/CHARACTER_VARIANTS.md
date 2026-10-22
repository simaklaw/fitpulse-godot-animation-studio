# Pull-Up Character Presentation Variants

## Purpose

Generate distinct male and female character presentations from one pinned pull-up motion specification. These are separate generated bodies with separate CC0 clothing and hairstyle meshes—not merely recolored copies of one model.

## Profiles

| Profile | MPFB gender macro | Muscle | Weight | Proportions | Height |
|---|---:|---:|---:|---:|---:|
| Male | 1.0 | 0.82 | 0.48 | 0.85 | 0.50 |
| Female | 0.0 | 0.68 | 0.48 | 0.85 | 0.90 |

The gender macro is checked by reading it back after MPFB applies macro details. The female profile is being tested with a higher height macro because the prior neutral-height model could not reach the shared fixed bar using the same motion: its wrist proxy missed by about 0.21 m. The height adjustment is accepted only if the strict bar-contact, clearance and top-position gates pass. These profiles are technical presets, not a claim that any one body type represents all men or women.

## Character styling

- Male profile: CC0 fitted T-shirt and shorts plus `cortu_short_messy_hair`.
- Female profile: CC0 fitted T-shirt and shorts plus `elvs_reverse_french_braid_bun`.
- Apparel uses FitPulse forest/mint and charcoal materials; the hair assets retain their source materials.
- Both profiles are exported as separate rigged GLBs and separately rendered 720×720 previews.

## Expected outputs per profile

- `pull_up.glb`: rigged character, hair, clothing and fixed pull-up apparatus.
- `pull_up.png`: technical studio thumbnail (512×512).
- `pull_up_studio.mp4`: studio-background render.
- `pull_up.mp4`: app preview composited over a dark forest/mint background, 720×720 at 30 fps.
- `poster.png`: representative video frame.
- `frames_pull_up_alpha/*.png`: 72 transparent 720×720 RGBA frames.
- `pull_up_contact_sheet.png`: eight-pose review sheet.
- Build logs and structural QA results.

## CI acceptance gates

- MPFB profile values are applied and verified.
- Expected shirt, shorts and hairstyle nodes exist in each GLB.
- Male and female GLBs, thumbnails and posters are genuinely different.
- Both profiles pass GLB structural QA, fixed-bar contact, foot-clearance and top-position checks.
- Each MP4 is exactly 720×720, 30 fps and 72 frames.
- Alpha export has 72 RGBA frames, transparent corners, a visible subject, and at least 60 distinct frames.
- App media publisher only opens a PR after a successful main-branch build and media metadata checks.

## Limits

Distinct meshes and successful CI do not by themselves prove premium final art or expert-certified biomechanics. Visual review, deformation testing, expert movement review, app integration and on-device playback remain separate acceptance steps.