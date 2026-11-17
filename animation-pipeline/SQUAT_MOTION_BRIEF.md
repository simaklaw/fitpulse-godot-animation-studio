# Bodyweight Squat — motion and biomechanics production brief

## Purpose

Produce a natural, premium, anatomically credible bodyweight squat for the existing FitPulse male character in Godot. This is a new movement adapter, not a reuse of pull-up or push-up joint curves. The current catalog entry is a brief only; this document does not claim that an animation has been rendered or approved.

## Non-negotiable visual result

- A recognizable human squat, not a robot-like sequence of isolated joint rotations.
- The same existing male character and visual identity used by the approved FitPulse character work. Do not replace him with a stick figure, capsule mannequin, abstract proxy, or newly generated character.
- Full body visible; fixed camera and lighting across the cycle; no ground plane clipping or body intersections.
- Both feet remain planted, with heel and forefoot contact preserved. No foot skating, toe pivoting, or heel lift in the standard bodyweight version.
- Knees track in the same general direction as the toes. No valgus collapse, knee snapping, or left/right bone flips.
- The pelvis moves down and slightly back between the feet. The torso inclines forward naturally as a counterbalance; the spine remains controlled rather than folding as one rigid block.
- Arms counterbalance the trunk with a small natural delay; they must not be mechanically locked to the torso.
- The loop returns to the same standing pose, foot anchors, camera framing and silhouette.

## Movement language and timing

Target cycle: 3.2 seconds at 30 fps for delivery (96 frames). Author/solve at 60 Hz or higher, then sample the final delivery at 30 fps. Timing is a starting point, not a reason to force a fixed range of motion.

| Normalized time | Phase | Action and visual intent |
|---:|---|---|
| 0.00–0.10 | Settle / brace | Stable standing stance, quiet breath, knees soft, weight distributed across the foot tripod |
| 0.10–0.43 | Eccentric descent | Hips and knees flex together; pelvis travels down/back; knees track over toes; arms drift forward as counterbalance |
| 0.43–0.50 | Bottom transition | Controlled arrival, no bounce; only a short natural compression/settle |
| 0.50–0.88 | Concentric ascent | Push through the whole foot; hips and knees extend together; torso and pelvis rise in coordinated timing |
| 0.88–0.96 | Lockout | Return to upright without snapping knees backward or thrusting ribs forward |
| 0.96–1.00 | Reset | Breath and small secondary settling motion; seamless transition to the next repetition |

The descent should be controlled and slightly slower than the ascent. Do not use a constant-speed linear sweep. Avoid long dead holds at the bottom and top. The phase ease/velocity profile must actually be consumed by the motion builder; an authored ease enum that is ignored by the sampler is a defect.

## Biomechanical model

### 1. Solve a 3D body, not a sagittal-only pose

The supplied movement snapshot describes a YZ-plane solver and derives pelvis translation from the left leg. That is not sufficient for a production squat. The squat adapter must evaluate both legs independently in 3D and retain frontal-plane and transverse-plane control.

### 2. Pelvis path is authored independently of either leg

Define a smooth pelvis trajectory from standing to the chosen squat depth. Use a modest backward component that depends on the character's measured proportions. Do not derive the entire pelvis transform from only the left ankle/leg. Both legs must be solved against the same pelvis transform and their own planted foot targets.

### 3. Two-bone IK per leg

For each side, solve hip → knee → ankle from the actual imported skeleton segment lengths:
- fixed ankle/foot target at the floor;
- measured thigh and shin lengths;
- a stable knee pole direction that keeps the knee aligned with the toe direction;
- a small, anatomically plausible outward knee track where the stance and toe-out call for it;
- no stretching to force a requested depth.

If the requested pelvis path makes either leg unreachable, reduce the depth smoothly for that character rather than stretching bones, moving the foot, or flipping the knee. Do not assume both legs have identical lengths or rest transforms.

### 4. Foot plant and contact

Treat each foot as a planted transform, not merely a foot rotation. Preserve the heel and forefoot contact points against the floor throughout descent, bottom transition and ascent. A standard bodyweight squat should not use toe-off or heel lift as a decorative secondary motion. The foot's toe-out is a stance parameter and must not drift during the repetition.

### 5. Hip, knee and ankle coordination

- Hip and knee flexion begin in a coordinated pattern; neither joint should wait for the other and then catch up abruptly.
- The ankle dorsiflexes progressively as the knee travels forward. Keep the heel grounded; if the character's proportions cannot support the requested depth, reduce the depth.
- Knee tracking is a 3D constraint relative to the foot/toe direction, not just a pair of equal sagittal flexion values.
- Avoid hard-coded universal joint angles. Use measured character proportions and a comfortable target range.

### 6. Torso and pelvis

The torso counterbalances the backward pelvis movement with a natural forward inclination. Distribute motion across hip hinge, pelvis orientation and thoracic/spinal segments without folding the whole torso as one rigid lever. Keep lumbar motion conservative; the chest should not collapse, the ribs should not flare, and the head should remain naturally aligned with the gaze.

### 7. Arms and secondary motion

Arms move as a counterbalance with overlap/follow-through rather than sharing the torso's exact curve. Introduce a restrained 80–120 ms response lag, with soft elbow flexion and no shoulder popping. Add subtle breathing and settling only where it supports the action. Do not add arbitrary lateral weight shifts or noisy oscillation that would make the movement look unstable.

## Character-specific constraints

- Read actual rest transforms, bone hierarchy and left/right segment lengths from the male character's imported skeleton.
- Preserve the existing character mesh, materials, face, hair and clothing.
- Do not change the character's global scale or compensate for bad joint alignment by deforming the mesh.
- Retarget rotations in each bone's rest-parent basis. Never assume the imported skeleton has identity rest axes.
- Validate the actual rendered character, not only a capsule rig or numeric pose.

## Required quality gates

Every rendered sample must be checked, with per-frame evidence where possible:

1. **Foot contact:** heel and forefoot contact remain within 5 mm of the floor; no horizontal foot drift.
2. **Bone lengths:** thigh and shin lengths remain invariant; no scale animation or stretching.
3. **Knee tracking:** knees do not collapse inward; their projected path follows the toe direction in front and three-quarter views.
4. **Joint continuity:** no knee/elbow inversion, quaternion flip, sudden joint pop, or discontinuity at phase boundaries.
5. **Pelvis path:** smooth down/back and up/forward trajectory; no pelvis drop below the floor or lateral teleport.
6. **Trunk control:** no excessive lumbar rounding, chest collapse, rib flare or independent head snap.
7. **Depth:** a plausible, character-specific range; do not require one universal below-parallel depth.
8. **Loop seam:** first/last pose, foot contacts and velocity are continuous; no reset jump.
9. **Visual review:** inspect front, side and three-quarter renders at full resolution and at phone size. Human technique review is mandatory; CI is not a substitute.

## Implementation order

1. Audit the actual Godot scene, imported male skeleton, bone map, rest transforms and current squat script. Record the source commit and exact paths before editing.
2. Add a dedicated bodyweight_squat motion adapter with pelvis path, bilateral 3D leg IK, planted-foot targets and knee pole vectors. Keep it separate from pull-up and push-up adapters.
3. Fix the motion sampling contract so authored phase timing/ease is not silently ignored. Add deterministic tests for velocity continuity and no overshoot at phase boundaries.
4. Add automated per-frame contact, bone-length, knee-tracking, joint-continuity, depth and loop-seam checks.
5. Render front, side and three-quarter previews with the existing male character. Inspect the actual frames; do not approve from code or numeric checks alone.
6. Only after the male version passes, consider a separate female profile. Do not mark the catalog entry automated_qa_passed or human_approved before its required evidence exists.

## Explicit non-goals

- No changes to FitPulse workout logic, timer, history, set/repetition saving, navigation or buttons.
- No changes to push-up or pull-up media.
- No replacement or redesign of the approved male character.
- No claim of medical certification or universal squat depth.
- No merging into main as part of this motion-spec milestone.

## Current status

**Specification only.** The renderer registry must remain planned until a dedicated Godot implementation, real male-character renders, automated checks and visual technique review have all passed.
