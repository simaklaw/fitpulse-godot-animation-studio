# Universal Base Characters — FitPulse evaluation gate

## Status
Evaluation only. Do not replace the current renderer or publish these assets to FitPulse yet.

## Archive inventory observed
- Male and female full-body character models: glTF + binary buffers for Godot/Unreal export.
- Unity FBX variants.
- Character texture maps for male/female base colors, normals, roughness, eyes, and hair.
- Separate hairstyle assets in glTF and FBX variants, including buns, long hair, buzzed hair, parted hair, beard, and eyebrows.
- The supplied archive's inspected file listing did not expose an obvious LICENSE/LICENCE/COPYING file. Distribution rights and attribution requirements must be established from the original source before shipping.

## Acceptance checks before adoption
1. Confirm the original source URL, creator, license, attribution, commercial use and redistribution rights.
2. Import both glTF characters in a pinned Godot/Blender test environment; record import warnings and verify textures/materials.
3. Inspect skeleton hierarchy, bone names, rest pose, scale/orientation, and whether both profiles have compatible rigs.
4. Test animation retargeting on a short pull-up motion. Do not infer compatibility from file format alone.
5. Render male and female contact sheets from the same camera, lighting, framing, bar geometry, and motion timing as the current baseline.
6. Check hand-to-bar contact, grip width, shoulder/elbow motion, torso clearance, leg motion, apparel coverage, clipping, and loop seam.
7. Compare objective QA metrics and human-reviewed frames against the existing candidate; keep the current renderer as fallback until the new option passes.
8. Only after acceptance, publish versioned media with SHA-256 manifest and source/license metadata, then update the app integration PR.

## Integration boundary
The supplied archive is a candidate character source, not ready-made exercise media. It must not be copied into the app as if it already contains verified pull-up animation. Existing gender-specific app selection and fallback behavior should remain unchanged during this evaluation.

## Decision
Keep this evaluation isolated on its own branch. No changes to main and no production asset replacement are made by this document.
