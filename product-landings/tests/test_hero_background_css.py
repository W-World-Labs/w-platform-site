import re

from _gen import render


def test_hero_background_uses_valid_color_tokens():
    html = render(
        {
            "slug": "w-id",
            "name": "W-ID",
            "tagline": "Single sign-on.",
            "category": "Platform",
            "features": [],
            "content": {"overview": "Overview", "sections": [], "useCases": []},
        },
        "auth.myfastools.com",
        "/",
    )

    assert "/_images/w-id-hero.jpg" in html
    assert not re.search(r"hsl\([^)]+\)(?:22|44)", html)
