# FitPulse Pull-Up Character Assets

## Activewear (CC0)

The render workflow downloads and verifies two MakeHuman community asset packs:

- **Shirts 01**: `elvs_crude_t-shirt_male.mhclo` and `joepal_crude_t-shirt_female.mhclo`, used for the male and female profiles respectively.
  - Asset listing: https://static.makehumancommunity.org/assets/assetpacks/shirts01.html
  - Archive: https://files2.makehumancommunity.org/asset_packs/shirts01/shirts01_cc0.zip
- **Pants 01**: `cortu_jeans_shorts.mhclo`, used as athletic-style shorts for both profiles.
  - Asset listing: https://static.makehumancommunity.org/assets/assetpacks/pants01.html
  - Archive: https://files2.makehumancommunity.org/asset_packs/pants01/pants01_cc0.zip

The listed source assets are CC0 according to the pack index. The render pipeline refits garments to the generated body, rigs them, assigns a consistent FitPulse forest/mint material palette, and verifies that clothing nodes are embedded in the exported GLB. Sources: https://static.makehumancommunity.org/assets/assetpacks/shirts01.html and https://static.makehumancommunity.org/assets/assetpacks/pants01.html

## Hairstyles (CC0)

The current visual branch also adds separate head silhouettes:

- **Male**: `cortu_short_messy_hair.mhclo`
- **Female**: `elvs_reverse_french_braid_bun.mhclo`

Both are listed as CC0 assets in MakeHuman Community Hair 01.
- Asset listing: https://static.makehumancommunity.org/assets/assetpacks/hair01.html
- Archive: https://files2.makehumancommunity.org/asset_packs/hair01/hair01_cc0.zip

The source hair materials are retained so any packed color/alpha treatment remains intact. CI verifies that the expected hairstyle object is present in each GLB and that character rendering / transparent export still passes.

## Automated build controls

1. Download archives over HTTPS with retries and bounded timeouts.
2. Verify ZIP integrity and each required filename before rendering.
3. Cache source packs in GitHub Actions; do not commit the large raw archives into the app.
4. Fit clothing and hair through MPFB2 so the assets share the generated character rig.
5. Export and verify the MP4, poster, transparent frame sequence, GLB and checksums before any app publication PR is opened.

## Current limitation

These community assets are a practical clothing/hair prototype, not bespoke premium activewear. The contact sheet must still be checked for mesh clipping, hair intersections, deformations, and small-screen readability. If a mesh deforms badly during a pull-up, replace or custom-fit that source mesh instead of weakening contact or animation QA.