# Pull-Up — first production motion brief

## Goal

Create a premium, readable looping pull-up animation using the pinned Workout Guide poses as visual references. The reference artwork is not a finished animation and must not be shipped as-is.

## Deliverable boundary

- Exercise: strict pull-up on a fixed horizontal bar.
- Character presentations: separate male and female character designs; do not make the female variant by recoloring the male artwork.
- Background: transparent, no labels, UI, watermark, or logo.
- Composition: fixed camera, full hands/bar/head/torso/legs visible with safe margins for mobile cropping.
- Initial authoring target: 24–36 frames per cycle at 512×512 or higher. Keep source vectors editable.
- Source references: pinned Workout Guide revision in `WORKOUT_GUIDE_REFERENCE.md`.

## Motion phases and key poses

1. **Dead hang** — elbows extended but not forcefully locked; shoulders elevated naturally; hands closed around the bar; legs quiet.
2. **Initiation** — scapular depression/retraction begins before major elbow flexion; trunk stays controlled.
3. **Pull** — elbows travel down and slightly back; chest approaches the bar; avoid a sudden neck reach.
4. **Top position** — chin clears the bar without exaggerated cervical extension; ribs remain controlled; no knee kick.
5. **Controlled descent** — reverse the path smoothly, extending elbows while maintaining shoulder control.
6. **Return to hang** — return to the same silhouette and hand/bar contact as frame 1 for a seamless loop.

## Timing

- Prototype cycle: about 2.5–4 seconds, depending on the selected reference and intended coaching tempo.
- Emphasize controlled eccentric descent; do not speed-ramp abruptly.
- The first and last frames must match in pose, scale, and contact points.
- No bouncing, kipping, or leg swing unless a separate kipping exercise is explicitly requested.

## Camera and visual quality

- Three-quarter or clean side view; select one and keep it consistent across the cycle and both variants.
- Keep the bar horizontal and hands attached to it in every frame.
- Use clear, premium anatomy and intentional line/shading hierarchy; avoid emoji, stick figures, generic geometric mannequins, and abstract placeholder art.
- Male/female versions must each have coherent proportions, face/hair treatment, clothing, and silhouette. Avoid stereotyped or exaggerated body proportions.
- Use transparent PNG previews for visual review; retain source vector/model files.

## Acceptance checklist

Mark each item PASS / REVIEW / FAIL, with evidence:

- [ ] All body parts and the bar remain in frame with mobile-safe margins.
- [ ] Hand contact stays fixed to the bar; no visible sliding.
- [ ] Elbow and shoulder motion reads as a pull-up, not a row or pulldown.
- [ ] No implausible joint flips, limb length changes, mesh intersections, or abrupt silhouette jumps.
- [ ] Legs and trunk remain controlled; no unintended swing.
- [ ] First/last frame seam is visually continuous.
- [ ] Transparency survives export; no solid background or halo.
- [ ] Male and female are distinct, deliberate character designs.
- [ ] Preview remains clear at typical phone display size.
- [ ] A human reviewer has inspected the rendered output; structural CI checks alone are insufficient.

## Status

- **Produced:** written motion brief and acceptance gates.
- **Available:** three static source poses in the reference import workflow.
- **Not produced:** interpolated cycle, separate male/female characters, Godot scene, or production-ready export.
- **Not tested:** Godot runtime, device performance, and expert biomechanical review.

## Next step

Review the five-exercise contact sheet first. If pull-up reference poses are approved, author intermediate poses and a separate character/rig plan, then render a contact sheet of the proposed cycle before building the Godot preview scene.
