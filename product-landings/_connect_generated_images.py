#!/usr/bin/env python3
"""Connect generated key art to the static landing-page image slots."""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFilter


LANDING_SLOTS = ("hero", "overview", "s1", "s2", "s3")
OUTPUT_SIZE = (1600, 900)
JPEG_QUALITY = 86


@dataclass(frozen=True)
class ConnectionSummary:
    product_count: int
    image_count: int
    prompt_count: int
    manifest_path: Path


def _slug_color(slug: str) -> tuple[int, int, int]:
    digest = hashlib.md5(slug.encode("utf-8")).digest()
    return (45 + digest[0] % 80, 135 + digest[1] % 80, 170 + digest[2] % 65)


def _fit_cover(image: Image.Image, size: tuple[int, int], zoom: float = 1.0) -> Image.Image:
    target_w, target_h = size
    src = image.convert("RGB")
    ratio = max(target_w / src.width, target_h / src.height) * zoom
    resized = src.resize((round(src.width * ratio), round(src.height * ratio)), Image.Resampling.LANCZOS)
    left = max(0, (resized.width - target_w) // 2)
    top = max(0, (resized.height - target_h) // 2)
    return resized.crop((left, top, left + target_w, top + target_h))


def _overlay_gradient(image: Image.Image, top_alpha: int, bottom_alpha: int) -> Image.Image:
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    height = image.height
    for y in range(height):
        alpha = round(top_alpha + (bottom_alpha - top_alpha) * (y / max(1, height - 1)))
        draw.line([(0, y), (image.width, y)], fill=(5, 8, 15, alpha))
    return Image.alpha_composite(image.convert("RGBA"), overlay)


def _glass_panel(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], accent: tuple[int, int, int], alpha: int) -> None:
    x1, y1, x2, y2 = box
    draw.rounded_rectangle(box, radius=28, fill=(255, 255, 255, alpha), outline=(*accent, 90), width=3)
    inner = (x1 + 26, y1 + 28, x2 - 26, y1 + 34)
    draw.rounded_rectangle(inner, radius=3, fill=(*accent, 130))
    for i in range(3):
        yy = y1 + 78 + i * 48
        draw.rounded_rectangle((x1 + 26, yy, x2 - 40 - i * 55, yy + 12), radius=6, fill=(25, 40, 60, 56))
    for i in range(4):
        cx = x1 + 42 + i * 54
        cy = y2 - 52
        draw.ellipse((cx, cy, cx + 18, cy + 18), fill=(*accent, 130))


def _draw_orbits(draw: ImageDraw.ImageDraw, cx: int, cy: int, accent: tuple[int, int, int]) -> None:
    for i, radius in enumerate((95, 145, 200, 260)):
        alpha = 82 - i * 12
        box = (cx - radius, cy - radius // 2, cx + radius, cy + radius // 2)
        draw.ellipse(box, outline=(*accent, max(24, alpha)), width=3)
    for i in range(12):
        x = cx + int((i - 5.5) * 42)
        y = cy + int(((i * 37) % 120) - 60)
        draw.ellipse((x - 8, y - 8, x + 8, y + 8), fill=(*accent, 135))


def _draw_flow(draw: ImageDraw.ImageDraw, accent: tuple[int, int, int]) -> None:
    for i in range(9):
        y = 160 + i * 72
        draw.line((180, y, 1380, y + ((i % 3) - 1) * 86), fill=(*accent, 68), width=3)
        draw.ellipse((1364, y - 8, 1380, y + 8), fill=(*accent, 145))
    for i in range(5):
        x = 290 + i * 230
        draw.rounded_rectangle((x, 650, x + 118, 700), radius=14, fill=(255, 255, 255, 120), outline=(*accent, 78), width=2)


def _render_slot(source: Image.Image, slug: str, slot: str) -> Image.Image:
    accent = _slug_color(slug)
    slot_index = LANDING_SLOTS.index(slot)
    base = _fit_cover(source, OUTPUT_SIZE, zoom=1.0 + slot_index * 0.035)

    if slot == "hero":
        return _overlay_gradient(base, top_alpha=18, bottom_alpha=138).convert("RGB")

    canvas = base.convert("RGBA")
    if slot in {"overview", "s2"}:
        blur = canvas.filter(ImageFilter.GaussianBlur(7 if slot == "overview" else 11))
        wash = Image.new("RGBA", OUTPUT_SIZE, (255, 255, 255, 92 if slot == "overview" else 72))
        canvas = Image.alpha_composite(blur, wash)
        sharp = _fit_cover(source, (760, 428), zoom=1.08 + slot_index * 0.03).convert("RGBA")
        sharp.putalpha(232)
        x = 760 if slot == "overview" else 120
        y = 236 if slot == "overview" else 190
        canvas.alpha_composite(sharp, (x, y))

    overlay = Image.new("RGBA", OUTPUT_SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")

    if slot == "overview":
        _glass_panel(draw, (110, 250, 620, 620), accent, 116)
        _draw_orbits(draw, 1130, 450, accent)
    elif slot == "s1":
        _glass_panel(draw, (900, 185, 1455, 575), accent, 124)
        _draw_flow(draw, accent)
    elif slot == "s2":
        _glass_panel(draw, (880, 165, 1460, 612), accent, 116)
        _draw_orbits(draw, 445, 440, accent)
    elif slot == "s3":
        soft = Image.new("RGBA", OUTPUT_SIZE, (245, 250, 255, 72))
        canvas = Image.alpha_composite(canvas, soft)
        for i in range(7):
            x = 220 + i * 150
            y = 180 + (i % 2) * 120
            draw.rounded_rectangle((x, y, x + 260, y + 290), radius=30, fill=(255, 255, 255, 102), outline=(*accent, 70), width=3)
            draw.line((x + 32, y + 78, x + 220, y + 78), fill=(*accent, 105), width=5)
            draw.ellipse((x + 32, y + 205, x + 70, y + 243), fill=(*accent, 120))

    canvas = Image.alpha_composite(canvas, overlay)
    return canvas.convert("RGB")


def _source_for_product(root: Path, slug: str) -> tuple[Path, str]:
    bright = root / "_images" / "generated" / "bright" / f"{slug}-key-art-bright.png"
    if bright.exists():
        return bright, "bright"
    dark = root / "_images" / "generated" / "dark" / f"{slug}-key-art-dark.png"
    if dark.exists():
        return dark, "dark"
    raise FileNotFoundError(f"No generated key art found for {slug}")


def _prompt_text(product: dict, slot: str, source: Path, style: str, root: Path) -> str:
    name = product["name"]
    slug = product["slug"]
    section_title = {
        "hero": "Hero",
        "overview": "Overview",
        "s1": product.get("content", {}).get("sections", [{}])[0].get("title", "Section 1"),
        "s2": product.get("content", {}).get("sections", [{}, {}])[1].get("title", "Section 2"),
        "s3": product.get("content", {}).get("sections", [{}, {}, {}])[2].get("title", "Section 3"),
    }[slot]
    return (
        f"# {name} landing asset: {slot}\n\n"
        f"- Product: `{slug}` / {name}\n"
        f"- Landing slot: `{slot}` ({section_title})\n"
        f"- Source key art: `{source.relative_to(root)}`\n"
        f"- Source style: `{style}`\n"
        f"- Output purpose: static landing-page background referenced as `/_images/{slug}-{slot}.jpg`\n\n"
        "## Prompt / Design Intent\n\n"
        "Derived locally from the stored generated key art. Use this image as a polished product-specific "
        "landing background: bright key art is preferred, dark key art is used only when a bright source "
        "does not exist. The derivative adds crop, exposure, glass panels, routing lines, orbit geometry, "
        "and subtle product-color accents to make each page section visually distinct while preserving "
        "the original generated concept. No text, logos, people, or watermarks are added.\n"
    )


def connect_generated_images(root: Path | str = ".", output_root: Path | str | None = None) -> ConnectionSummary:
    root = Path(root).resolve()
    output_root = Path(output_root).resolve() if output_root is not None else root / "_images"
    output_root.mkdir(parents=True, exist_ok=True)

    products = json.loads((root / "_products.json").read_text(encoding="utf-8"))
    image_count = 0
    prompt_count = 0
    manifest_lines = [
        "# Connected landing images",
        "",
        "These JPGs are the files referenced by each landing page under `/_images/`.",
        "They are derived from `_images/generated/*/*-key-art-*.png` and each output has a same-name `.prompt.md` sidecar.",
        "",
        "| Product | Slot | Source | Output | Prompt |",
        "| --- | --- | --- | --- | --- |",
    ]

    for product in products:
        slug = product["slug"]
        source, style = _source_for_product(root, slug)
        with Image.open(source) as source_image:
            for slot in LANDING_SLOTS:
                image = _render_slot(source_image, slug, slot)
                out_path = output_root / f"{slug}-{slot}.jpg"
                image.save(out_path, format="JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
                image_count += 1

                prompt_path = output_root / f"{slug}-{slot}.prompt.md"
                prompt_path.write_text(_prompt_text(product, slot, source, style, root), encoding="utf-8")
                prompt_count += 1

                manifest_lines.append(
                    f"| `{slug}` | `{slot}` | `{source.relative_to(root)}` | "
                    f"`{out_path.relative_to(root) if out_path.is_relative_to(root) else out_path}` | "
                    f"`{prompt_path.relative_to(root) if prompt_path.is_relative_to(root) else prompt_path}` |"
                )

    manifest_path = output_root / "CONNECTED_IMAGES.md"
    manifest_path.write_text("\n".join(manifest_lines) + "\n", encoding="utf-8")
    return ConnectionSummary(
        product_count=len(products),
        image_count=image_count,
        prompt_count=prompt_count,
        manifest_path=manifest_path,
    )


def main() -> None:
    summary = connect_generated_images(Path(__file__).resolve().parent)
    print(f"Connected {summary.image_count} landing images for {summary.product_count} products.")
    print(f"Wrote {summary.prompt_count} prompt sidecars.")
    print(f"Manifest: {summary.manifest_path}")


if __name__ == "__main__":
    main()
