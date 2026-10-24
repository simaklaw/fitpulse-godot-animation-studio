# Motifect Sports & Martial Arts — FitPulse audit

**Reviewed:** 2026-10-24  
**Result:** useful source motion libraries; not production-ready FitPulse clips yet.

## Inventory and reproducibility

| Pack | Contents found in the supplied ZIP | Uncompressed size | SHA-256 |
|---|---|---:|---|
| Sports & Athletics | 40 FBX files, 0 BVH files, 1 README (41 files total) | 27,952,400 bytes | `c86fa8c709850efa66c372bf9eeb336127be49bcb9d0c6b198a57639a97bafc7` |
| Martial Arts | 40 FBX files, 0 BVH files, 1 README (41 files total) | 26,664,858 bytes | `c3c41f2d5c7a0f06030a2e0f6ab08b617d5ab59960ef688ade843a81e00124be` |

The supplied archives contain FBX files under `Animations/` and `Documentation/README.txt`. **No BVH files were present**, even though the public pack descriptions mention matching BVH files. The README says each FBX contains a simple stickman preview mesh plus its animation; this is for preview and is not a premium FitPulse character.

## Automated technical checks

- Blender 4.5.11 imported **40/40 Sports FBX files** and **40/40 Martial Arts FBX files**; 0 import failures.
- Imported clips have 90–300 frames in the Blender report. Most are 120–180 frames; a few are 300 frames.
- The pack skeleton has 64 bones. Its naming/layout differs from the current FitPulse retarget path: it has `Spine1`, `Spine2`, `Chest`, `Neck1`/`Neck2`, `LeftLeg`/`LeftShin` and right-side equivalents, but **no `Hips`/pelvis bone or `LeftUpLeg`/`RightUpLeg` bones**. Several limbs are independent roots in the imported hierarchy.
- A name-based candidate mapping can be formed (e.g. pelvis proxy → `Spine1`, spine → `Spine2`, thigh → `LeftLeg`, shin → `LeftShin`), but this is **not yet a validated retarget**. Bone rest orientations, root movement, scale/axis conversion, connected joints, and rendered pose quality must still be verified on the FitPulse character.

Import success is not evidence of biomechanical quality or correct playback in the app.

## Recommended candidates for a controlled retarget experiment

### Sports & Athletics

- `weightlifting_press_overhead.fbx` — potential overhead-press demo; check bar/dumbbell props and hand placement.
- `weightlifting_clean.fbx` — potential clean/power-clean demo; requires bar path and contact validation.
- `rowing_stroke.fbx` — potential rowing exercise; needs an appropriate rowing machine/handle.
- `marathon_pace_run.fbx`, `sprint_start_blocks.fbx`, `finish_line_burst.fbx` — useful candidates for running/cardio content.
- `boxing_stance_footwork.fbx` — possible warm-up/cardio movement.

### Martial Arts

- `muay_thai_combination.fbx`, `muay_thai_roundhouse.fbx`, `muay_thai_teep.fbx`, `tkd_front_kick_high.fbx` — candidates for a later boxing/kickboxing or martial-arts workout category.
- Judo/wrestling takedowns and weapon clips are lower priority for the current general fitness catalog.

Neither pack contains a pull-up, push-up, or squat clip, so it does not replace the current pull-up animation work.

## License / distribution note

The included README says the animations are free for personal and commercial projects, but **raw animation files may not be redistributed or resold as a standalone product**. Keep the Motifect source/credit with any integrated derivative, and do not commit the raw FBX packs as loose public repository assets. For app use, render/retarget chosen clips into the intended exercise deliverables and validate those deliverables before publication.

Source pages:
- Sports & Athletics: https://motifect.itch.io/motifect-sports-athletics-motion-pack
- Martial Arts: https://motifect.itch.io/motifect-martial-arts-motion-pack

## Audit evidence

- First complete import/inventory run: https://github.com/simaklaw/fitpulse-godot-animation-studio/actions/runs/40061529258/artifacts/12547870943
- Detailed hierarchy and sampled-pose report: https://github.com/simaklaw/fitpulse-godot-animation-studio/actions/runs/40061810865/artifacts/12547881398

The second report includes per-clip action/frame metadata and sampled world-space bone positions for the selected candidate motions. These are audit artifacts, not app assets.

## Current status

- **Done:** archive inventory, SHA-256 records, README license review, all 80 FBX imports, naming/hierarchy inspection, recommended candidate shortlist.
- **Not done:** retargeting onto the FitPulse character, render/contact-sheet review, biomechanics QA, MP4/poster production, app integration, Android playback tests.
- **Next technical step:** implement a Motifect-specific source skeleton adapter (including axis/rest-pose handling), then render and review `weightlifting_press_overhead` as the first controlled exercise trial. Do not publish the clip until both the rendered motion and props are verified.
