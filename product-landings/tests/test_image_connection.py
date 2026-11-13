import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_generated_key_art_can_populate_all_landing_slots(tmp_path):
    from _connect_generated_images import LANDING_SLOTS, connect_generated_images

    products = json.loads((ROOT / "_products.json").read_text())
    summary = connect_generated_images(root=ROOT, output_root=tmp_path)

    assert summary.product_count == len(products)
    assert summary.image_count == len(products) * len(LANDING_SLOTS)
    assert summary.prompt_count == summary.image_count

    for product in products:
        slug = product["slug"]
        for slot in LANDING_SLOTS:
            image = tmp_path / f"{slug}-{slot}.jpg"
            prompt = tmp_path / f"{slug}-{slot}.prompt.md"
            assert image.exists(), image
            assert prompt.exists(), prompt
            prompt_text = prompt.read_text()
            assert slug in prompt_text
            assert slot in prompt_text
            assert "_images/generated/" in prompt_text
