# Pull-up animation prototype

## Purpose
Render the first FitPulse exercise prototype with a male anatomical model and a fixed, visible pull-up rack. This is a rig-and-preview pipeline test, not yet a biomechanically validated production clip.

## Motion plan
- **Start:** active dead hang, shoulders controlled, elbows extended, legs quiet.
- **Initiation:** shoulder blades depress; elbows begin to drive down toward the ribs.
- **Concentric phase:** torso and pelvis rise; elbows flex while avoiding a large torso swing.
- **Top position:** chin clears the bar, neck remains mostly neutral, body stays compact.
- **Eccentric phase:** smooth controlled descent, returning to the same full-hang pose for a seamless loop.

The JSON currently contains hand-authored keyframes, not captured motion data. Angles were chosen as a renderable first pass using the upstream OpenGym3D pose format. They need visual inspection and exercise-specific review before being treated as correct instruction.

## Rendering and QA
The workflow checks out OpenGym3D at commit `ea3a60130fdcfb3c4771e44d09f84ebab4ee9bae`, runs its Blender renderer, adds a simple fixed rack, produces GLB/PNG/MP4 artifacts, and runs upstream joint-integrity QA.

The pose spec uses the upstream MakeHuman/MPFB2 generated character pipeline. No existing CC0 pull-up clip was found in the Motion packs, so no captured/CC0 pull-up motion is claimed. The rack is generated procedurally for this scene.

## Acceptance checks still needed
- Visual review of the full MP4 and start/top/end silhouettes.
- Check that both hands remain visually aligned with the bar through every frame.
- Check elbow flexion, shoulder motion, neutral neck, quiet pelvis/legs, and the repeat seam.
- Review with a qualified trainer before using it as instructional guidance.
- Test import/playback in the intended FitPulse Android renderer before app integration.

Current label: **prototype — not yet biomechanically verified, not yet integrated into FitPulse APK**.
