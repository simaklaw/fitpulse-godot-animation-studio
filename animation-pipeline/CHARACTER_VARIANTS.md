# Pull-Up Character Presentation Variants

## Purpose

Generate a distinct male and female anatomical presentation from the same pinned animation spec. The pipeline uses the MPFB2 gender macro to change the generated body shape; it does not recolour one identical mesh and call it a second design.

## Current profile values

| Profile | MPFB gender macro | Muscle macro | Weight macro | Proportions macro |
|---|---:|---:|---:|---:|
| Male | 1.0 | 0.82 | 0.46 | 0.50 |
| Female | 0.0 | 0.68 | 0.46 | 0.50 |

MPFB2 documents the gender macro as 0.0 = female and 1.0 = male. The renderer logs the requested profile and reads the value back after applying macro details; CI rejects an unrecognized profile or a mismatch.

These are practical starting presets for an athletic training figure, not a claim that one body type represents all men or women. They may be refined after reviewing the actual renders.

## Expected outputs per presentation

- `pull_up.glb`: rigged animated character and pull-up rack.
- `pull_up.png`: render thumbnail.
- `pull_up.mp4`: 72-frame 720×720 preview at 30 fps.
- `frames_pull_up_alpha/*.png`: 72 transparent 720×720 RGBA frames.
- `pull_up_contact_sheet.png`: an 8-pose contact sheet.
- Build and structural-QA logs.

## CI acceptance gates

- Both profile macros are logged and verified by MPFB.
- Male and female GLBs and thumbnails are not byte/pixel-identical.
- Each model passes GLB structural QA and the same fixed-bar wrist contact, foot-clearance and top-position checks.
- Each MP4 is exactly 720×720, 30 fps and 72 frames.
- Each alpha sequence has 72 720×720 RGBA frames, four fully transparent corners, at least 80% fully transparent pixels, opaque subject pixels and at least 60 unique frames.

## Not yet implied by these checks

Distinct body geometry does not equal premium final character art. The current output is a technical anatomical prototype; clothes/styling, camera/readability review at phone size, expert biomechanics review, integration into the FitPulse app and on-device performance all require separate acceptance.
