# Pull-up reference archives and Universal Base Characters — evaluation

**Reviewed:** 2026-10-24  
**Decision:** use Workout Guide artwork only as movement reference; keep the current MakeHuman/MPFB pull-up renderer for the active prototype. Do not treat either archive as a ready-made animation or character drop-in.

## Uploaded Workout Guide archives

The two ZIPs were audited in GitHub Actions before being removed from the repository root.

| Archive | Size | SHA-256 | Contents |
|---|---:|---|---|
| `workout-guide-pull-up-reference.zip` | 21,872 bytes | `0746ea7f386e9d6ac7b36e2ef9973407f3eb1dc9d5b8bfbf193fe8fa39741226` | 3 SVG still poses plus manifest and license/attribution files |
| `workout-guide-pull-up-reference-1.zip` | 195,263 bytes | `c664d96b02bb6a715e71eaa6910b45dc0372a8c9724a33696d92976f8a197388` | The exact same 3 SVGs and metadata, plus 3 PNG previews and a contact sheet |

All seven paths shared by both archives have identical file hashes. There are no FBX, GLB, glTF, Blender, OBJ, DAE, or BVH assets in either ZIP. The second archive is a preview-enhanced copy, not a separate motion library.

### What the poses are useful for

- Compare the dead-hang silhouette with the top position and use the sequence as a visual cue for the pull-up's range of motion.
- Check that both hands stay attached to a fixed horizontal bar, with no wrist sliding or sudden head reach.
- Keep the legs controlled; use these images as reference only, not as frames that must be copied literally.

Three static poses do not supply intermediate frames, a rig, an animation curve, a male/female character pair, or biomechanical validation. The drawings are deliberately stylized and muscular, with crossed/bent legs; they should not override the motion brief's controlled-trunk requirement.

### License and distribution

The included `LICENSE-ASSETS` and `ATTRIBUTION.md` identify Workout Guide's visual assets as **CC BY-SA 4.0**, with upstream artwork credited to Everkinetic and additional work by Bryl Lim. This license requires attribution, an indication of changes, and ShareAlike distribution for adaptations. Therefore, use the images to understand the movement and avoid embedding or tracing them into a proprietary FitPulse deliverable unless the project is prepared to satisfy those obligations. The exact pinned source revision in the existing workflow is `aac599224bb9780305239607ef98540b7e0ce389`.

Sources:
- https://github.com/bryllim/workout-guide
- https://creativecommons.org/licenses/by-sa/4.0/

## Universal Base Characters [Standard]

The supplied Quaternius Standard archive was checked separately (SHA-256 `fdbf1804c90dfc1ea03e992bff7da2dfd1a79318e13270a660180f9308455f40`). It is CC0 1.0. The male and female full-body glTF characters each have 3 meshes, 69 nodes and a 65-joint skin, but **no embedded animation clips**. Their rig uses names such as `upperarm_l`, `lowerarm_l`, `hand_l`, `thigh_l`, and `calf_l`.

This is not a direct drop-in for the current pull-up renderer: the existing build uses the MakeHuman/MPFB body, its separately fitted tank/shorts/hair/shoes, and its own rig layout. Importing UBC would require a separate rig adapter/retargeter, clothing/character-style decisions, a fresh fixed-bar grip and clearance check, and rendered visual review. The current UBC characters are more superhero-styled than the sportswear look already built into the current prototype. Accordingly, this evaluation does not replace the existing character or imply that UBC has been compiled into the animation.

Source: https://quaternius.com/packs/universalbasecharacters.html

## Current pull-up production gate

The latest pull-up render exposed a remaining quality issue: although the automated contact/clearance and file-integrity checks pass, visual inspection of enlarged male/female grip crops still shows a weak/open-looking overhand grip. The follow-up in PR #16 locks the finger-curl direction from the first dead-hang pose rather than recomputing it at every keyframe; that hypothesis must be confirmed by a fresh render and enlarged grip review before the pull-up is accepted or its media is published to the app.

- Pull-up animation brief: `animation-pipeline/PULL_UP_MOTION_BRIEF.md`
- Reference import workflow: `animation-pipeline/WORKOUT_GUIDE_REFERENCE.md`
- Latest grip-direction PR: https://github.com/simaklaw/fitpulse-godot-animation-studio/pull/16
- Original uploaded-reference audit artifact: https://github.com/simaklaw/fitpulse-godot-animation-studio/actions/runs/40064624361/artifacts/12548293330
- Previous pull-up render/contact sheets: https://github.com/simaklaw/fitpulse-godot-animation-studio/actions/runs/40058538389

**Acceptance rule:** a successful CI job means the build and programmed geometry gates pass; it does not by itself mean the fingers visibly wrap the bar or that a human reviewer has accepted biomechanics and visual quality.
