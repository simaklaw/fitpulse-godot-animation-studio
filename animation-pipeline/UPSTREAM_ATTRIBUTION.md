# Third-party pipeline attribution

The prototype workflow checks out the MIT-licensed [OpenGym3D](https://github.com/AssiamahS/opengym3d) repository at immutable commit `ea3a60130fdcfb3c4771e44d09f84ebab4ee9bae` and runs its Blender renderer. It does not copy the upstream source files into FitPulse; a small deterministic patch adds a static pull-up rack for this spec.

Upstream license at the pinned revision: https://github.com/AssiamahS/opengym3d/blob/ea3a60130fdcfb3c4771e44d09f84ebab4ee9bae/LICENSE

The upstream `assets/ASSET_LIBRARY.json` describes its generated MakeHuman/MPFB2 character source as CC0-1.0. The keyframes and rack in this prototype are created for FitPulse. No third-party pull-up motion clip is used or claimed. Before redistributing any future imported motion, verify its specific licence and keep any required attribution with the asset.
