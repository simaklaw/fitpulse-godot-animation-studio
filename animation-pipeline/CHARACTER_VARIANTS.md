# Pull-Up Character Presentation Variants

## Purpose

Generate distinct male and female character presentations from one pinned pull-up motion spec, including separate body profiles and fitted clothing, hairstyle and running-shoe meshes. The two outputs must not be identical renders. The shared overhand grip uses a 60 cm target span (±0.30 m), pending visual validation across both generated profiles.

## Profiles

| Profile | MPFB gender macro | Muscle | Weight | Proportions | Height |
|---|---:|---:|---:|---:|---:|
| Male | 1.0 | 0.82 | 0.48 | 0.85 | 0.50 |
| Female | 0.0 | 0.68 | 0.48 | 0.85 | 0.90 |

MPFB's gender macro is read back after macro details are applied. Female height 0.90 is under strict validation because the prior neutral-height female rig missed the fixed bar by roughly 0.21 m with the shared pose. The height change is accepted only if contact, clearance, and top-position checks pass. These are technical athletic presets, not claims that one body type represents all men or women.

## Styling

- **Male**: CC-BY athletic tank by Elvaerwyn, CC0 shorts, CC0 short messy hairstyle, CC-BY running shoes by Punkduck.
- **Female**: CC-BY athletic tank by Elvaerwyn, CC0 shorts, CC0 reverse French-braid bun, CC-BY running shoes by Punkduck.
- Tanks, shorts and footwear use FitPulse forest/mint/charcoal materials; hairstyle source material is retained. Preserve CC-BY credits for Elvaerwyn and Punkduck downstream.
- The build records exact source-asset names in logs and verifies that clothes, hair, and shoes appear in the exported GLB.

## Outputs per profile

- `pull_up.glb`: rigged character with hair/clothes/shoes and pull-up rig.
- `pull_up.png`: technical studio thumbnail (512×512).
- `pull_up_studio.mp4`: studio render.
- `pull_up.mp4`: branded app preview, 720×720 at 30 fps.
- `poster.png`: representative frame for exercise cards.
- `frames_pull_up_alpha/*.png`: 72 transparent 720×720 RGBA frames.
- `pull_up_contact_sheet.png`: eight-pose review sheet.
- Build and QA logs.

## Acceptance gates

- MPFB profile macro verified; character meshes and posters differ across profiles.
- Expected shirt, shorts, hairstyle and running-shoe meshes are present in each GLB.
- Both profiles pass structural GLB QA and fixed-bar contact, floor-clearance and top-position checks.
- MP4: 720×720, 30 fps, 72 frames.
- Transparent sequence: 72 RGBA frames, transparent corners, visibly present subject, at least 60 unique frames.
- The publisher only proposes app media after a successful main-branch build with metadata checks.

## Limits

Passing CI does not establish final premium art or expert-certified biomechanics. Contact-sheet review, motion expert review, app integration and device playback remain separate acceptance steps. CC-BY attributions for Elvaerwyn's athletic tanks and Punkduck's shoes must remain with downstream assets.