# FitPulse Pull-Up Apparel Assets

## Included source assets

The prototype render workflow fetches two checked MakeHuman community asset packs over HTTPS at build time and caches the unpacked files in GitHub Actions:

- **Shirts 01** — `elvs_crude_t-shirt_male.mhclo` for the male presentation and `joepal_crude_t-shirt_female.mhclo` for the female presentation. The pack is described as a set of T-shirts, sweaters and tops; the listed assets are CC0.
  - Pack page: https://static.makehumancommunity.org/assets/assetpacks/shirts01.html
  - Archive: https://files2.makehumancommunity.org/asset_packs/shirts01/shirts01_cc0.zip
- **Pants 01** — `cortu_jeans_shorts.mhclo`, listed as CC0.
  - Pack page: https://static.makehumancommunity.org/assets/assetpacks/pants01.html
  - Archive: https://files2.makehumancommunity.org/asset_packs/pants01/pants01_cc0.zip

MakeHuman's asset-pack FAQ describes CC0 as permitting use without attribution requirements. The workflow keeps these upstream source URLs documented for traceability.

## Build procedure

1. Download and test both zip archives; cache only after archive integrity and required-file checks pass.
2. MPFB fits the shirt and shorts to the generated body and rigs them to the exercise skeleton.
3. The renderer assigns a consistent FitPulse forest/mint material palette to the fitted garments.
4. CI verifies that the build logs include both garment objects and that the motion/GLB/alpha QA still passes.
5. The MP4 and poster remain derived from the same final render, not a separate stock image.

## Known limitations

The CC0 shirt/shorts are a first production clothing pass, not custom-designed premium sportswear. Clothing fit, mesh clipping, deformation during the full pull-up cycle, camera framing and readability must be reviewed in the generated contact sheet before this branch is accepted. If the base garment geometry is visibly unsuitable, replace the source mesh or author a tailored asset rather than weakening animation QA.
