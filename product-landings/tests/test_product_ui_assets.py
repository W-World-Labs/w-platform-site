import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]


def test_product_ui_renderer_creates_one_concrete_mockup_per_product(tmp_path):
    from _render_product_ui_assets import PRODUCT_UI_SIZE, render_product_ui_assets

    products = json.loads((ROOT / "_products.json").read_text())
    summary = render_product_ui_assets(root=ROOT, output_root=tmp_path)

    assert summary.product_count == len(products)
    assert summary.image_count == len(products)
    assert summary.prompt_count == len(products)

    for product in products:
        slug = product["slug"]
        image = tmp_path / f"{slug}-product-ui.png"
        prompt = tmp_path / f"{slug}-product-ui.prompt.md"
        assert image.exists(), image
        assert prompt.exists(), prompt
        with Image.open(image) as im:
            assert im.size == PRODUCT_UI_SIZE
        prompt_text = prompt.read_text()
        assert slug in prompt_text
        assert "product UI mockup" in prompt_text
        assert "not abstract key art" in prompt_text

    manifest = tmp_path / "MANIFEST.md"
    assert manifest.exists()
    assert "_images/generated/product-ui" in manifest.read_text()
