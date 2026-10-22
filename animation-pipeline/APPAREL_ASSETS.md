# FitPulse Pull-Up Character Assets

## Activewear — CC0

The render workflow fetches and verifies two MakeHuman Community asset packs:

- **Shirts 01**: `toigo_basic_tucked_t-shirt.mhclo` is fitted to both body profiles. This generic crew-neck mesh replaces the first sex-specific pair after shoulder/hem clipping appeared under the raised-arm pose.
  - Listing: https://static.makehumancommunity.org/assets/assetpacks/shirts01.html
  - Archive: https://files2.makehumancommunity.org/asset_packs/shirts01/shirts01_cc0.zip
- **Pants 01**: `cortu_jeans_shorts.mhclo` used as training shorts.
  - Listing: https://static.makehumancommunity.org/assets/assetpacks/pants01.html
  - Archive: https://files2.makehumancommunity.org/asset_packs/pants01/pants01_cc0.zip

The official pack indexes mark these selected shirt and shorts meshes as CC0. MPFB fits and rigs the garment meshes; the renderer applies FitPulse forest/mint and charcoal materials and checks the objects are embedded in the GLB.

## Hairstyles — CC0

- **Male**: `cortu_short_messy_hair.mhclo`
- **Female**: `elvs_reverse_french_braid_bun.mhclo`

Both are listed as CC0 in Hair 01.
- Listing: https://static.makehumancommunity.org/assets/assetpacks/hair01.html
- Archive: https://files2.makehumancommunity.org/asset_packs/hair01/hair01_cc0.zip

The workflow caches Hair 01 in GitHub Actions, verifies both filenames and requires the expected hairstyle mesh in each exported GLB.

## Running shoes — CC-BY, attribution retained

Both profiles use `punkduck_running_shoes_01.mhclo`, credited to **Punkduck**. The official Shoes 02 asset-pack index lists it as CC-BY; retain this credit in downstream distribution.
- Listing and license classification: https://static.makehumancommunity.org/assets/assetpacks/shoes02.html
- Archive: https://files2.makehumancommunity.org/asset_packs/shoes02/shoes02_ccby.zip

The renderer refits and rigs the shoe pair, assigns dark forest/charcoal materials, and logs the fitted mesh. CI verifies that the shoe node is present in each GLB.
Attribution string: **“Running shoes: Punkduck, MakeHuman Community Shoes 02 asset pack (CC-BY, as listed by the pack index).”**

## CI process

1. Download source packs over HTTPS with retries/timeouts, check archive integrity and required filenames, then cache source files in GitHub Actions.
2. Fit clothes, hair, and shoes to the selected MPFB body and bind them to the rig.
3. Verify profile, mesh presence, contact/clearance, GLB structure, MP4 metadata, and transparent frames before publication.
4. Keep the raw asset packs out of the FitPulse app payload. Only approved MP4s/posters and a SHA-256 manifest should be proposed for app integration.

## Quality limits

These community assets improve silhouette and completeness, but they are still prototype assets rather than custom-designed premium sportswear. Inspect contact sheets and full-resolution frames for clipping, hair intersections, shoe fit, and small-screen readability. If any mesh deforms badly during the full rep, replace or tailor it rather than weakening biomechanics/contact QA.