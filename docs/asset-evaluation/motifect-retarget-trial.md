# Motifect retarget trial — controlled first clip

## Scope

The source-pack audit is complete and the raw ZIP archives have been removed from the repository. This document defines the next engineering gate; it does not claim that a retargeted clip exists.

Start with `weightlifting_press_overhead.fbx` from the Sports & Athletics pack. It is a better first trial than a high-speed or floor-contact motion because the key contacts are observable (hands to bar/implement, feet to floor) and the main failure modes can be checked in a compact contact sheet.

## Current evidence

- Blender imported 40/40 FBX clips from each pack.
- The source skeleton contains 64 bones, but its hierarchy/names differ from the FitPulse target.
- Candidate aliases are recorded in `animation-pipeline/adapters/motifect_source_map.json`.
- The source mapping is explicitly `candidate_map_only`: axis conversion, unit scale, rest-pose corrections, and root-motion policy remain unresolved.
- The supplied README describes the included stickman mesh as a preview, not a production character. Render onto the FitPulse character; do not ship the preview mesh.

## Required implementation sequence

1. Import the chosen FBX in Blender and record source rest-pose bone directions, root transform, scene units, and forward/up axes.
2. Record the target rig's corresponding rest-pose data. Do not derive corrections from bone names alone.
3. Implement a Motifect-specific adapter that applies coordinate conversion and per-bone rest-pose correction before animation sampling.
4. Retarget one neutral frame first. Stop if the torso, pelvis proxy, limbs, or feet are flipped, collapsed, disconnected, or scaled incorrectly.
5. Render a small diagnostic sheet (start, 25%, 50%, 75%, end) on the intended FitPulse character. Check body proportions and all visible contacts.
6. Render the full overhead-press loop and inspect hand/implement contact, wrist orientation, elbow path, shoulder range, bar clearance, foot contact, and loop seam.
7. Generate male/female presentation variants only after the source motion retargets correctly; each variant must pass its own visual and structural QA.
8. Keep raw FBX files out of the public repository. Preserve source attribution and the pack's restriction against standalone redistribution of raw animation files.

## Release gate

The adapter may move beyond candidate status only after a reproducible neutral-pose test, a reviewed rendered contact sheet, explicit coordinate/rest-pose configuration, and passing automated structural checks. A successful FBX import or a green CI run alone is not evidence of correct technique. No app integration is in scope until the clip passes this gate.
