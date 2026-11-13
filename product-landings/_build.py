#!/usr/bin/env python3
"""
Authoritative landing-page builder.

Reads the canonical product dataset (_products.json) and renders a Tesla-style
landing page per product into <slug>/index.html via _gen.render().

_products.json is GENERATED — never hand-edit. Refresh from the catalog source
of record (30-17-w-platform-site, which validates its facts against the
W-Radar registry via `npm run test:catalog`):

    (cd ../30-17-w-platform-site && node scripts/export-products.mjs) > _products.json

It also emits IMAGES.md — a turnkey manifest listing every image slot each page
expects under _images/, with a ready-to-use generation prompt per image. Drop a
matching JPG into _images/ and it appears automatically (pages fall back to the
gradient when an image is absent, so they never break before images exist).

Run:  python3 _build.py
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from _gen import render  # noqa: E402

PRODUCTS = json.load(open(os.path.join(HERE, "_products.json")))

# ── Shared art-direction so every generated image matches the site ──────────
STYLE = (
    "Premium minimalist hero illustration, Tesla.com aesthetic. "
    "Near-black background (#08090d), subtle blue-teal accent gradient "
    "(#6d8bff to #37e0c8), soft volumetric glow, lots of negative space, "
    "cinematic studio lighting, ultra-clean, no text, no logos, no watermarks, "
    "no UI mockups. 16:9, high detail, photographic-render quality."
)


def _hero_prompt(p: dict) -> str:
    return (
        f"Hero image for '{p['name']}' — {p['tagline']} "
        f"Category: {p.get('category','Platform')}. "
        f"Evoke the concept abstractly (forms, light, materials — not literal). "
        f"{STYLE}"
    )


def _section_prompt(p: dict, title: str, body: str) -> str:
    snippet = (body or "")[:160]
    return (
        f"Supporting visual for '{p['name']}' section “{title}”. "
        f"Concept: {snippet} "
        f"Abstract, conceptual, no text. {STYLE}"
    )


def build():
    manifest = [
        "# Image manifest — product landings\n",
        "Drop generated JPGs into `_images/` using the exact filenames below.",
        "Pages reference them as `/_images/<file>` and fall back to a gradient",
        "when a file is missing, so partial sets are safe. Target 16:9, ~1600x900,",
        "optimised JPG (< 400 KB each).\n",
    ]
    total_imgs = 0
    for p in PRODUCTS:
        slug = p["slug"]
        os.makedirs(os.path.join(HERE, slug), exist_ok=True)
        html = render(p, p.get("domain", f"{slug}.myfastools.com"), "/")
        with open(os.path.join(HERE, slug, "index.html"), "w") as f:
            f.write(html)

        content = p.get("content") or {}
        sections = content.get("sections") or []
        manifest.append(f"\n## {p['name']}  (`{slug}`)\n")
        # hero
        manifest.append(f"- **`{slug}-hero.jpg`** — {_hero_prompt(p)}")
        total_imgs += 1
        # overview panel
        manifest.append(
            f"- **`{slug}-overview.jpg`** — "
            f"{_section_prompt(p, 'Overview', content.get('overview',''))}"
        )
        total_imgs += 1
        # up to 3 content-section panels (matches _gen.py: sections[:3], s1..s3)
        for i, sec in enumerate(sections[:3]):
            manifest.append(
                f"- **`{slug}-s{i+1}.jpg`** — "
                f"{_section_prompt(p, sec.get('title',''), sec.get('body',''))}"
            )
            total_imgs += 1

    with open(os.path.join(HERE, "IMAGES.md"), "w") as f:
        f.write("\n".join(manifest) + "\n")

    print(f"Rendered {len(PRODUCTS)} landings.")
    print(f"IMAGES.md lists {total_imgs} image slots.")


if __name__ == "__main__":
    build()
