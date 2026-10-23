# FitPulse Pull-Up Character Assets

## Athletic tank tops — CC-BY, attribution retained

The pull-up pose holds both arms overhead. The short-sleeve meshes exposed irregular skin patches where raised shoulders intersected sleeve caps, so this iteration uses sleeveless athletic tops whose arm openings form an intentional silhouette.

- **Male**: `elvs_male_athletic_tank1.mhclo` by Elvaerwyn.
- **Female**: `elvs_ladies_tank1.mhclo` by Elvaerwyn.
- Asset-pack index: https://static.makehumancommunity.org/assets/assetpacks/shirts03.html
- Archive: https://files2.makehumancommunity.org/asset_packs/shirts03/shirts03_ccby.zip
- The official pack index lists both as CC-BY.

Attribution string: **“Athletic tank tops: Elvaerwyn, MakeHuman Community Shirts 03 asset pack (CC-BY, as listed by the pack index).”**

## Training shorts — CC0

Both profiles use `cortu_jeans_shorts.mhclo`.
- Index: https://static.makehumancommunity.org/assets/assetpacks/pants01.html
- Archive: https://files2.makehumancommunity.org/asset_packs/pants01/pants01_cc0.zip

## Hairstyles — CC0

- **Male**: `cortu_short_messy_hair.mhclo`
- **Female**: `elvs_reverse_french_braid_bun.mhclo`
- Index: https://static.makehumancommunity.org/assets/assetpacks/hair01.html
- Archive: https://files2.makehumancommunity.org/asset_packs/hair01/hair01_cc0.zip

## Running shoes — CC-BY, attribution retained

Both profiles use `punkduck_running_shoes_01.mhclo`, credited to **Punkduck**. The Shoes 02 index lists it as CC-BY.
- Index: https://static.makehumancommunity.org/assets/assetpacks/shoes02.html
- Archive: https://files2.makehumancommunity.org/asset_packs/shoes02/shoes02_ccby.zip

Attribution string: **“Running shoes: Punkduck, MakeHuman Community Shoes 02 asset pack (CC-BY, as listed by the pack index).”**

## Rendering and validation

1. Download the CC0 shorts pack and CC-BY athletic-tank pack over HTTPS with retries and archive-integrity checks.
2. MPFB fits each garment to the selected body profile and rigs it to the exercise skeleton.
3. A small 2 mm outward surface offset reduces z-fighting/skin poke-through. This does not replace visual inspection.
4. CI verifies the exact profile-specific shirt in build logs and GLB, plus profile differentiation, fixed-bar wrist contact, body clearance, transparent-frame alpha, MP4 metadata and complete output artifacts.
5. The publisher must preserve both CC-BY credits in the downstream manifest; only validated MP4s and posters are proposed for the app.

## Quality limits

These are community assets styled for FitPulse, not custom-tailored premium sportswear. Inspect both posters and complete contact sheets for clipping, skin showing beyond the intended tank armholes, hair collisions, shoe fit and phone-size readability. Failing visuals require correcting the mesh/fit, not weakening QA.
