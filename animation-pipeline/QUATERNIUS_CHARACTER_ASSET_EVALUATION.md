# Quaternius Universal Base Characters — FitPulse Evaluation

## Decision

**Approved for a controlled prototype experiment; not approved as the default production character yet.**

The supplied `Universal Base Characters[Standard].zip` is the official Quaternius Standard pack. Its included `License_Standard.txt` identifies the models as **CC0 1.0 Universal**, so the assets may be used and modified commercially without an attribution requirement. We will keep the source credit anyway.

- Official pack: https://quaternius.com/packs/universalbasecharacters.html
- Free Standard download: https://quaternius.itch.io/universal-base-characters
- License: https://creativecommons.org/publicdomain/zero/1.0/
- Creator: Quaternius
- SHA-256 of the supplied archive: `fdbf1804c90dfc1ea03e992bff7da2dfd1a79318e13270a660180f9308455f40`

## What is actually in the supplied archive

The archive contains 112 files (about 132.6 MB uncompressed). The engine-ready folder `Base Characters/Godot - UE/` contains male and female full-body glTF 2.0 characters, their binary geometry, and PBR texture maps. Both models have a 65-joint humanoid skin and 3 meshes; neither glTF includes animation clips.

Observed files:
- `Superhero_Male_FullBody.gltf` + `.bin`
- `Superhero_Female_FullBody.gltf` + `.bin`
- Hair, eye and body base-color/normal/roughness maps
- A verbatim CC0 license file

## How it could help FitPulse

1. **A stronger rigged-character fallback.** Both male and female models already have matching humanoid skeleton layouts, so a shared retargeting experiment is realistic.
2. **A Godot-native source format.** The pack includes glTF files intended for Godot/Unreal, avoiding an FBX-only import path.
3. **More consistent gender variants.** Both models use the same 65-joint skeleton shape, which may reduce variant-specific rig work.
4. **Hair and PBR materials.** The supplied maps can be useful for polished previews if the texture pipeline and mobile performance are verified.

## Limitations and risks

- These are **superhero-style characters**, not modern gym activewear. The fitted costume may look more clothed than a bare procedural mannequin, but it can also make FitPulse look like a superhero game rather than a premium fitness app.
- The files have **no exercise animation**. The pull-up must still be authored or retargeted and validated for wrist/bar contact, elbows, shoulder motion, top position, and cycle seam.
- The supplied Standard pack does not include the Source version's prebuilt engine projects/custom shader setup.
- Textures and geometry add size; the final mobile variant must be measured and optimized.

## Next experiment

Keep this as an isolated branch/asset experiment. Import one male and one female glTF into a minimal Godot test scene, apply a restrained FitPulse forest/mint activewear-like material treatment only if it remains visually coherent with the existing mesh, retarget the same pull-up motion to both, and render a side-by-side contact sheet. Compare:
- visual fit with FitPulse's premium training style;
- hand-to-bar contact across all frames;
- shoulder/elbow plausibility and top position;
- texture/shader performance and APK size;
- male/female consistency.

Do not replace the current production pipeline or publish these characters into the app until the contact sheet and technical checks pass. Because the user supplied the archive, the exact binary source is available in the working conversation but is not silently copied into this repository by this documentation-only change; the import step must explicitly stage the selected glTF, binary, textures, and license or fetch the official Standard pack through an approved source.
