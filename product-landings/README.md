# W Product Landings

This directory is the canonical authoring source for the product landing pages.
It retains the original generated artwork, creative prompts, product catalog and
rendering/derivation scripts. Public app and authentication APIs remain separate.

- `_gen.py` renders product pages from the exported platform catalog.
- `_build.py` reads `_products.json` and generates `<slug>/index.html`.
- `_images/` contains the only tracked asset copies and their creative sidecars.
- The platform dev/test/client-build prepares the generated `public/_images/`
  mirror with the same paths and bytes; it does not regenerate art or fetch models.

From the platform root, export the catalog with `npm run export:landings`, then
render pages with `python3 product-landings/_build.py` in an authorized build
environment. The optional image-derivation utility requires Pillow and only
transforms existing local artwork; it does not download or train a model.

Deployment and identity/API route configuration are operator-owned. No live
infrastructure addresses, production data or deployment automation are shipped.
See the root PUBLIC_SOURCE.md and THIRD-PARTY-NOTICES.md for license boundaries.
