#!/usr/bin/env python3
"""
Tesla-inspired landing page generator for W Platform products.

Usage:
    render(product_dict, app_domain, next_path) -> HTML string

    product_dict keys (from products.ts):
        slug, name, tagline, category, domain, features, content
        content: { overview, sections: [{title, body}], useCases: [str] }

Design language:
    Full-viewport dark hero, edge-to-edge gradient/image backgrounds,
    large bold centered headline (clamp 48-88px, weight 700, tight tracking),
    thin muted subhead below, two understated pill CTAs (primary + ghost)
    centered low in the hero, minimal sticky nav (wordmark + single sign-in pill),
    scroll-stacked full-screen sections with alternating layout and big type,
    restrained near-black palette with subtle blue-teal gradient accents,
    generous whitespace — every section breathes.
"""

import html as _html
import hashlib


# ---------------------------------------------------------------------------
# Colour / gradient helpers
# ---------------------------------------------------------------------------

def _slug_hues(slug: str) -> tuple[int, int]:
    """Deterministic hue pair from slug (matches gen.py)."""
    h = int(hashlib.md5(slug.encode()).hexdigest()[0:2], 16)
    a = h * 360 // 255
    b = (a + 60) % 360
    return a, b


def _slug_gradient(slug: str) -> str:
    a, b = _slug_hues(slug)
    return f"linear-gradient(135deg,hsl({a},65%,48%),hsl({b},60%,38%))"


def _slug_glow(slug: str) -> str:
    a, _ = _slug_hues(slug)
    return f"hsl({a},70%,55%)"


def _slug_glow_alpha(slug: str, alpha: float) -> str:
    a, _ = _slug_hues(slug)
    return f"hsla({a},70%,55%,{alpha})"


# ---------------------------------------------------------------------------
# CSS  (inline, no external deps)
# ---------------------------------------------------------------------------

_CSS = """
/* ─── reset & tokens ─── */
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#08090d;
  --bg2:#0d0f16;
  --card:#111318;
  --line:#1e2130;
  --fg:#e6e8f0;
  --mut:#8892a4;
  --dim:#4a5268;
  --acc1:#5b8cf7;
  --acc2:#2ecfc0;
  --radius-pill:100px;
  --radius-card:16px;
}

/* ─── base ─── */
html{scroll-behavior:smooth}
body{
  background:var(--bg);
  color:var(--fg);
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",Roboto,"PingFang SC",sans-serif;
  font-size:16px;line-height:1.6;
  -webkit-font-smoothing:antialiased;
}
a{color:inherit;text-decoration:none}
img{display:block;max-width:100%}

/* ─── nav ─── */
.w-nav{
  position:fixed;top:0;left:0;right:0;z-index:100;
  display:flex;align-items:center;justify-content:space-between;
  padding:0 40px;
  height:58px;
  background:rgba(8,9,13,0.72);
  backdrop-filter:blur(18px) saturate(1.4);
  -webkit-backdrop-filter:blur(18px) saturate(1.4);
  border-bottom:1px solid rgba(255,255,255,0.05);
  transition:background .3s;
}
.w-nav-logo{
  font-size:15px;font-weight:700;letter-spacing:.04em;color:var(--fg);
  opacity:.9;
}
.w-nav-logo b{color:var(--acc2)}
.pill-sm{
  display:inline-flex;align-items:center;justify-content:center;
  padding:8px 20px;
  border-radius:var(--radius-pill);
  font-size:13px;font-weight:600;letter-spacing:.02em;
  cursor:pointer;border:none;
  border:1px solid rgba(255,255,255,0.15);
  background:rgba(255,255,255,0.06);
  color:var(--fg);
  transition:background .18s,border-color .18s,transform .18s;
  white-space:nowrap;
}
.pill-sm:hover{background:rgba(255,255,255,0.12);border-color:rgba(255,255,255,0.28);transform:translateY(-1px)}

/* ─── hero ─── */
.w-hero{
  position:relative;
  min-height:100svh;
  display:flex;flex-direction:column;
  align-items:center;justify-content:flex-end;
  overflow:hidden;
  padding-bottom:80px;
}
.w-hero-bg{
  position:absolute;inset:0;
  background:var(--hero-gradient,var(--bg));
}
.w-hero-bg::after{
  content:'';position:absolute;inset:0;
  background:linear-gradient(to bottom,
    rgba(8,9,13,0.2) 0%,
    rgba(8,9,13,0.0) 35%,
    rgba(8,9,13,0.55) 70%,
    rgba(8,9,13,0.90) 100%);
}
.w-hero-content{
  position:relative;z-index:2;
  text-align:center;
  max-width:860px;
  padding:0 24px;
}
.w-hero-eyebrow{
  display:inline-block;
  font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;
  color:var(--acc2);
  margin-bottom:22px;
  opacity:.85;
}
.w-hero-title{
  font-size:clamp(48px,8.5vw,88px);
  font-weight:700;
  letter-spacing:-0.03em;
  line-height:1.02;
  color:#fff;
}
.w-hero-sub{
  margin-top:20px;
  font-size:clamp(17px,2.2vw,21px);
  font-weight:400;
  color:rgba(230,232,240,0.6);
  max-width:580px;
  margin-left:auto;margin-right:auto;
}
.w-hero-ctas{
  margin-top:40px;
  display:flex;gap:14px;align-items:center;justify-content:center;flex-wrap:wrap;
}
.pill-primary{
  display:inline-flex;align-items:center;justify-content:center;
  padding:14px 34px;
  border-radius:var(--radius-pill);
  font-size:15px;font-weight:600;letter-spacing:.02em;
  cursor:pointer;
  background:#fff;
  color:#08090d;
  border:1px solid #fff;
  transition:background .18s,color .18s,transform .18s,box-shadow .18s;
  white-space:nowrap;
}
.pill-primary:hover{
  background:rgba(255,255,255,0.88);
  transform:translateY(-2px);
  box-shadow:0 8px 32px rgba(255,255,255,0.12);
}
.pill-ghost{
  display:inline-flex;align-items:center;justify-content:center;
  padding:13px 34px;
  border-radius:var(--radius-pill);
  font-size:15px;font-weight:600;letter-spacing:.02em;
  cursor:pointer;
  background:rgba(255,255,255,0.05);
  color:rgba(255,255,255,0.88);
  border:1px solid rgba(255,255,255,0.22);
  transition:background .18s,border-color .18s,transform .18s;
  white-space:nowrap;
}
.pill-ghost:hover{
  background:rgba(255,255,255,0.10);
  border-color:rgba(255,255,255,0.40);
  transform:translateY(-2px);
}

/* ─── scroll indicator ─── */
.w-scroll-hint{
  position:absolute;bottom:30px;left:50%;transform:translateX(-50%);
  z-index:3;
  display:flex;flex-direction:column;align-items:center;gap:6px;
  opacity:.35;
  font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#fff;
}
.w-scroll-hint-line{
  width:1px;height:36px;
  background:linear-gradient(to bottom,rgba(255,255,255,0),rgba(255,255,255,0.6));
  animation:scrollpulse 2s ease-in-out infinite;
}
@keyframes scrollpulse{
  0%,100%{opacity:.3;transform:scaleY(1)}
  50%{opacity:.9;transform:scaleY(1.1)}
}

/* ─── overview section ─── */
.w-section{
  min-height:100svh;
  display:flex;align-items:center;
  padding:120px 40px;
  position:relative;overflow:hidden;
}
.w-section.alt{background:var(--bg2)}
.w-section-wrap{
  max-width:1100px;margin:0 auto;width:100%;
  display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:center;
}
.w-section.flip .w-section-wrap{direction:rtl}
.w-section.flip .w-section-text{direction:ltr}
.w-section.flip .w-section-visual{direction:ltr}
.w-section-eyebrow{
  font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;
  color:var(--acc2);margin-bottom:16px;opacity:.8;
}
.w-section-title{
  font-size:clamp(30px,3.8vw,48px);
  font-weight:700;letter-spacing:-0.025em;line-height:1.1;
  color:#fff;
}
.w-section-body{
  margin-top:20px;
  font-size:clamp(15px,1.6vw,18px);
  color:var(--mut);
  line-height:1.75;
}
.w-section-visual{
  border-radius:var(--radius-card);
  overflow:hidden;
  aspect-ratio:4/3;
  display:flex;align-items:center;justify-content:center;
  position:relative;
}
.w-section-visual-inner{
  width:100%;height:100%;
  display:flex;align-items:center;justify-content:center;
  font-size:clamp(48px,7vw,80px);
  font-weight:800;
  color:rgba(255,255,255,0.12);
  letter-spacing:-0.04em;
}
.w-section-visual-glow{
  position:absolute;inset:0;
  opacity:.18;
  filter:blur(40px);
}

/* ─── features grid section ─── */
.w-features{
  padding:120px 40px;
  background:var(--bg);
  border-top:1px solid var(--line);
}
.w-features-wrap{max-width:1100px;margin:0 auto;width:100%}
.w-features-header{text-align:center;margin-bottom:72px}
.w-features-eyebrow{
  font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;
  color:var(--acc1);margin-bottom:14px;opacity:.8;
}
.w-features-title{
  font-size:clamp(28px,3.5vw,44px);
  font-weight:700;letter-spacing:-0.025em;
  color:#fff;
}
.w-features-grid{
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(260px,1fr));
  gap:2px;
  border:1px solid var(--line);
  border-radius:var(--radius-card);
  overflow:hidden;
}
.w-feature-item{
  background:var(--card);
  padding:32px 28px;
  border:0;
}
.w-feature-dot{
  width:8px;height:8px;border-radius:50%;
  margin-bottom:20px;
}
.w-feature-name{
  font-size:16px;font-weight:600;color:#fff;
  margin-bottom:8px;
}
.w-feature-body{
  font-size:14px;color:var(--mut);line-height:1.6;
}

/* ─── use-cases section ─── */
.w-usecases{
  padding:120px 40px;
  background:var(--bg2);
  border-top:1px solid var(--line);
}
.w-usecases-wrap{max-width:880px;margin:0 auto;width:100%;text-align:center}
.w-usecases-eyebrow{
  font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;
  color:var(--acc2);margin-bottom:14px;opacity:.8;
}
.w-usecases-title{
  font-size:clamp(26px,3.2vw,40px);
  font-weight:700;letter-spacing:-0.025em;color:#fff;
  margin-bottom:52px;
}
.w-usecases-list{
  list-style:none;
  display:flex;flex-direction:column;gap:0;
  text-align:left;
  border:1px solid var(--line);border-radius:var(--radius-card);overflow:hidden;
}
.w-usecases-list li{
  display:flex;align-items:flex-start;gap:18px;
  padding:24px 28px;
  background:var(--card);
  border-bottom:1px solid var(--line);
  font-size:16px;color:var(--mut);line-height:1.6;
  transition:background .18s;
}
.w-usecases-list li:last-child{border-bottom:none}
.w-usecases-list li:hover{background:rgba(255,255,255,0.02)}
.w-usecase-num{
  flex-shrink:0;
  font-size:12px;font-weight:700;letter-spacing:.06em;
  color:var(--acc2);opacity:.7;
  padding-top:3px;
  min-width:24px;
}

/* ─── bottom CTA strip ─── */
.w-strip{
  padding:120px 40px;
  background:var(--bg);
  border-top:1px solid var(--line);
  text-align:center;
}
.w-strip-title{
  font-size:clamp(32px,4.5vw,56px);
  font-weight:700;letter-spacing:-0.03em;color:#fff;
  margin-bottom:16px;
}
.w-strip-sub{
  font-size:clamp(16px,1.8vw,19px);color:var(--mut);
  margin-bottom:40px;
}
.w-strip-ctas{display:flex;gap:14px;align-items:center;justify-content:center;flex-wrap:wrap}

/* ─── footer ─── */
.w-footer{
  padding:32px 40px;
  border-top:1px solid var(--line);
  display:flex;align-items:center;justify-content:space-between;
  font-size:13px;color:var(--dim);
  flex-wrap:wrap;gap:12px;
}
.w-footer a{color:var(--dim);transition:color .15s}
.w-footer a:hover{color:var(--mut)}

/* ─── responsive ─── */
@media(max-width:800px){
  .w-nav{padding:0 20px}
  .w-section{padding:80px 24px}
  .w-section-wrap{grid-template-columns:1fr;gap:40px}
  .w-section.flip .w-section-wrap{direction:ltr}
  .w-features{padding:80px 24px}
  .w-usecases{padding:80px 24px}
  .w-strip{padding:80px 24px}
  .w-footer{padding:28px 24px}
  .w-section-visual{aspect-ratio:16/9}
}
@media(max-width:480px){
  .w-hero-ctas{flex-direction:column;gap:10px}
  .pill-primary,.pill-ghost{width:100%;justify-content:center}
  .w-strip-ctas{flex-direction:column;gap:10px;align-items:stretch}
  .w-strip-ctas .pill-primary,.w-strip-ctas .pill-ghost{justify-content:center}
}
"""


# ---------------------------------------------------------------------------
# HTML helpers
# ---------------------------------------------------------------------------

def _e(s: str) -> str:
    return _html.escape(str(s))


def _section_visual(slug: str, title: str, img: str) -> str:
    """A section visual panel.

    `img` is the basename (e.g. "w-inspector-s1.jpg") of an optional generated
    image under /_images/. When the file exists it covers the panel; when it is
    absent the slug gradient + glow + initials placeholder below show instead.
    """
    gradient = _slug_gradient(slug)
    glow = _slug_glow(slug)
    initials = "".join(w[0] for w in title.split() if w)[:3].upper()
    bg = f"url(/_images/{img}) center/cover no-repeat,{gradient}"
    return (
        f'<div class="w-section-visual" style="background:{bg}">'
        f'  <div class="w-section-visual-glow" style="background:{glow}"></div>'
        f'  <div class="w-section-visual-inner">{_e(initials)}</div>'
        f'</div>'
    )


# ---------------------------------------------------------------------------
# Radar formal tracking codes (per product project)
# ---------------------------------------------------------------------------
# Landing pages attribute telemetry to the *real product* when a formal
# Radar binding exists. Codes come from Radar /api/platform/bindings only —
# never invent. Unknown slugs fall back to project-id product-landings
# without a data-code (no formal binding for the landings shell itself).
#
# Values: landing-slug -> (data-project-id, tracking_code)
_RADAR_CODES: dict[str, tuple[str, str]] = {
    # User-supplied formal list + live Radar binding cross-check
    "w-hospital": ("omnihospital", "W-OMNIHOSPITAL-3023AC8D"),
    "w-nvr": ("w-nvr", "W-W-NVR-3C264AE4"),
    "w-omnisense": ("w-omnisense", "W-W-OMNISENSE-4027D2C4"),
    "w-domain": ("w-domain", "W-W-DOMAIN-D08716B8"),
    "w-search": ("w-search", "OBS-W-SEARCH-5488B373"),
    "w-erp": ("w-erp", "OBS-ONEMAN-ERP-B25EAFF8"),
    "w-quant": ("w-quant", "W-W-QUANT-03A94073"),
    "w-collect": ("w-collect", "W-W-COLLECT-38869D2E"),
    "w-maas": ("blackbox-maas", "OBS-BLACKBOX-MAAS-DB9B17E5"),
    "w-inspector": ("w-inspector", "W-W-INSPECTOR-D32920AE"),
    # w-daas: prefer live w-daas binding (also has data-asset-platform alias)
    "w-daas": ("w-daas", "W-W-DAAS-75AF96EA"),
    # Additional clear product bindings from Radar (same product as landing slug)
    "w-id": ("w-id", "W-W-ID-A39BD350"),
    "w-radar": ("radar", "OBS-RADAR-FF2E963F"),
    "w-imagetrace": ("image-trace", "W-IMAGE-TRACE-63349900"),
    "w-transfer": ("anytransfer-rust", "OBS-ANYTRANSFER-RUST-B51B7D75"),
    "w-translate": ("omnitranslate", "W-OMNITRANSLATE-E85E9EAF"),
    "w-jcr": ("jcr-query", "W-JCR-QUERY-1F843C6E"),
    "w-netsense": ("10-00-netsense", "W-10-00-NETSENSE-FFB92C95"),
    "w-medtwin": ("medtwin-quality", "W-MEDTWIN-QUALITY-A1C7DC82"),
    "w-knowledge": ("knowledge-unzip", "W-KNOWLEDGE-UNZIP-9CE7E97E"),
    # W-ModelGW landing -> edge AI gateway (Cloudflare Worker product)
    "w-modelgw": ("ai-gateway-cloudflare", "OBS-AI-GATEWAY-CLOUDFLARE-055A8B75"),
}


def _radar_bootstrap(slug: str) -> str:
    """Emit W-Radar platform bootstrap script tag for a landing slug."""
    binding = _RADAR_CODES.get(slug)
    if binding:
        project_id, code = binding
        return (
            f'<script async src="https://radar.myfastools.com/platform/bootstrap.js" '
            f'data-workspace-id="ws_platform" '
            f'data-project-id="{_html.escape(project_id, quote=True)}" '
            f'data-code="{_html.escape(code, quote=True)}"></script>'
        )
    # Unknown product: landings shell project-id only, no invented code
    return (
        f'<script async src="https://radar.myfastools.com/platform/bootstrap.js" '
        f'data-workspace-id="ws_platform" '
        f'data-project-id="product-landings"></script>'
    )


# ---------------------------------------------------------------------------
# Public render function
# ---------------------------------------------------------------------------

def render(product: dict, app_domain: str, next_path: str = "/dashboard") -> str:
    """
    Render a full-page Tesla-style landing HTML string for one W Platform product.

    Args:
        product:   dict with keys slug, name, tagline, category, features,
                   and optionally content{overview, sections, useCases}.
        app_domain: e.g. "quanta.myfastools.com" — primary CTAs open this origin
                    so users leave marketing and stay on the product.
        next_path: Path on the product origin after open/sign-in,
                   e.g. "/dashboard".  URL-encoded in login next= and used in open_url.
    """
    slug     = product.get("slug", "w-product")
    name     = product.get("name", "W Product")
    tagline  = product.get("tagline", "")
    category = product.get("category", "Platform")
    features = product.get("features", [])
    content  = product.get("content") or {}
    overview = content.get("overview", tagline)
    sections = content.get("sections") or []
    use_cases = content.get("useCases") or []

    hero_gradient = _slug_gradient(slug)
    glow_color    = _slug_glow(slug)
    glow_strong   = _slug_glow_alpha(slug, 0.27)
    glow_soft     = _slug_glow_alpha(slug, 0.13)

    # Build the hero background. If a generated hero image exists at
    # _images/<slug>-hero.jpg it sits on top as a cover layer; when the file is
    # absent the browser simply skips that layer and the slug-derived gradient
    # below shows through — so pages never break before images are produced.
    hero_bg_style = (
        f"background:"
        f"url(/_images/{slug}-hero.jpg) center/cover no-repeat,"
        f"radial-gradient(ellipse 100% 70% at 50% -10%,{glow_strong} 0%,transparent 70%),"
        f"radial-gradient(ellipse 60% 40% at 50% 30%,{glow_soft} 0%,transparent 60%),"
        f"linear-gradient(170deg,#0d1020 0%,#08090d 60%)"
    )

    # Absolute product URL — never bounce users back to myfastools.com hub.
    import urllib.parse
    path = next_path if next_path.startswith("/") else f"/{next_path}"
    open_url = f"https://{app_domain.rstrip('/')}{path}"
    # Product-local login; next= keeps session on this product after OAuth.
    if slug == "w-id":
        login_url = "/login"
    else:
        login_url = f"/auth/login?next={urllib.parse.quote(path)}"

    # ── nav ──────────────────────────────────────────────────────────────
    nav = (
        '<nav class="w-nav">'
        '  <a class="w-nav-logo" href="https://myfastools.com/">W<b>·</b>Platform</a>'
        f' <a class="pill-sm" href="{_e(login_url)}">Sign in</a>'
        '</nav>'
    )

    # ── hero ─────────────────────────────────────────────────────────────
    hero = (
        f'<section class="w-hero">'
        f'  <div class="w-hero-bg" style="{hero_bg_style}"></div>'
        f'  <div class="w-hero-content">'
        f'    <div class="w-hero-eyebrow">{_e(category)} &nbsp;·&nbsp; W&nbsp;Platform</div>'
        f'    <h1 class="w-hero-title">{_e(name)}</h1>'
        f'    <p class="w-hero-sub">{_e(tagline)}</p>'
        f'    <div class="w-hero-ctas">'
        f'      <a class="pill-primary" href="{_e(open_url)}">Open product</a>'
        f'      <a class="pill-ghost" href="{_e(login_url)}">Sign in</a>'
        f'    </div>'
        f'  </div>'
        f'  <div class="w-scroll-hint">'
        f'    <div class="w-scroll-hint-line"></div>'
        f'  </div>'
        f'</section>'
    )

    # ── content sections ──────────────────────────────────────────────────
    body_sections = ""

    # Overview section (always present)
    alt_class = ""
    body_sections += (
        f'<section class="w-section{alt_class}">'
        f'  <div class="w-section-wrap">'
        f'    <div class="w-section-text">'
        f'      <div class="w-section-eyebrow">Overview</div>'
        f'      <h2 class="w-section-title">{_e(name)}</h2>'
        f'      <p class="w-section-body">{_e(overview)}</p>'
        f'    </div>'
        f'    {_section_visual(slug, name, f"{slug}-overview.jpg")}'
        f'  </div>'
        f'</section>'
    )

    # Up to 3 content sections from product.content.sections
    for i, sec in enumerate(sections[:3]):
        alt   = " alt" if i % 2 == 0 else ""
        flip  = " flip" if i % 2 != 0 else ""
        body_sections += (
            f'<section class="w-section{alt}{flip}">'
            f'  <div class="w-section-wrap">'
            f'    <div class="w-section-text">'
            f'      <div class="w-section-eyebrow">{_e(sec.get("title",""))}</div>'
            f'      <h2 class="w-section-title">{_e(sec.get("title",""))}</h2>'
            f'      <p class="w-section-body">{_e(sec.get("body",""))}</p>'
            f'    </div>'
            f'    {_section_visual(slug, sec.get("title", name), f"{slug}-s{i+1}.jpg")}'
            f'  </div>'
            f'</section>'
        )

    # ── features grid ─────────────────────────────────────────────────────
    if features:
        feat_items = ""
        for feat in features:
            feat_items += (
                f'<div class="w-feature-item">'
                f'  <div class="w-feature-dot" style="background:{glow_color}"></div>'
                f'  <div class="w-feature-name">{_e(feat)}</div>'
                f'</div>'
            )
        body_sections += (
            f'<div class="w-features">'
            f'  <div class="w-features-wrap">'
            f'    <div class="w-features-header">'
            f'      <div class="w-features-eyebrow">Capabilities</div>'
            f'      <h2 class="w-features-title">What {_e(name)} does</h2>'
            f'    </div>'
            f'    <div class="w-features-grid">{feat_items}</div>'
            f'  </div>'
            f'</div>'
        )

    # ── use cases ─────────────────────────────────────────────────────────
    if use_cases:
        uc_items = ""
        for i, uc in enumerate(use_cases, 1):
            uc_items += (
                f'<li>'
                f'  <span class="w-usecase-num">{i:02d}</span>'
                f'  <span>{_e(uc)}</span>'
                f'</li>'
            )
        body_sections += (
            f'<div class="w-usecases">'
            f'  <div class="w-usecases-wrap">'
            f'    <div class="w-usecases-eyebrow">Use cases</div>'
            f'    <h2 class="w-usecases-title">Built for real workflows</h2>'
            f'    <ul class="w-usecases-list">{uc_items}</ul>'
            f'  </div>'
            f'</div>'
        )

    # ── bottom CTA strip ──────────────────────────────────────────────────
    strip = (
        f'<div class="w-strip">'
        f'  <h2 class="w-strip-title">Ready to get started?</h2>'
        f'  <p class="w-strip-sub">Sign in with your W Platform account and open {_e(name)} instantly.</p>'
        f'  <div class="w-strip-ctas">'
        f'    <a class="pill-primary" href="{_e(open_url)}">Open product</a>'
        f'    <a class="pill-ghost" href="{_e(login_url)}">Sign in</a>'
        f'  </div>'
        f'</div>'
    )

    # ── footer ─────────────────────────────────────────────────────────────
    footer = (
        '<footer class="w-footer">'
        '  <span>© <span id="w-year"></span> W Platform</span>'
        '  <span>'
        '    <a href="https://myfastools.com/">All products</a>'
        '    &nbsp;·&nbsp;'
        '    <a href="https://auth.myfastools.com/">W-ID</a>'
        '  </span>'
        '</footer>'
        '<script>document.getElementById("w-year").textContent=new Date().getFullYear()</script>'
    )

    # ── assemble ───────────────────────────────────────────────────────────
    title_esc = _e(f"{name} — W Platform")
    desc_esc  = _e(tagline)

    return (
        f'<!DOCTYPE html>\n'
        f'<html lang="en">\n'
        f'<head>\n'
        f'<meta charset="utf-8"/>\n'
        f'<meta name="viewport" content="width=device-width,initial-scale=1"/>\n'
        f'<title>{title_esc}</title>\n'
        f'<meta name="description" content="{desc_esc}"/>\n'
        f'{_radar_bootstrap(slug)}\n'
        f'<style>{_CSS}</style>\n'
        f'</head>\n'
        f'<body>\n'
        f'{nav}\n'
        f'{hero}\n'
        f'{body_sections}\n'
        f'{strip}\n'
        f'{footer}\n'
        f'</body>\n'
        f'</html>\n'
    )


# ---------------------------------------------------------------------------
# CLI: python3 _gen.py  ->  smoke-test by rendering w-inspector
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    _sample = {
        "slug": "w-inspector",
        "name": "W-Inspector",
        "tagline": "Server quality inspection & online reports.",
        "category": "Analysis",
        "features": [
            "CPU / memory / disk / network checks",
            "Lightweight benchmarks",
            "JSON + Markdown reports",
            "Shareable public reports",
        ],
        "content": {
            "overview": (
                "W-Inspector gives you a clear, instant picture of any server's health — "
                "CPU load, memory pressure, disk utilization, and network throughput — "
                "in one lightweight run. It produces structured JSON and human-readable "
                "Markdown reports you can share with teammates or embed in runbooks."
            ),
            "sections": [
                {
                    "title": "Key capabilities",
                    "body": (
                        "Inspector collects CPU idle/usage, memory available and swap, "
                        "per-disk I/O and free space, and live network throughput across "
                        "all interfaces in a single pass. Lightweight micro-benchmarks "
                        "measure disk sequential speed and CPU compute, giving you a "
                        "performance baseline you can track over time."
                    ),
                },
                {
                    "title": "Flexible report formats",
                    "body": (
                        "Results are emitted as clean JSON for machine consumption and "
                        "as Markdown for human review. Public shareable links let you "
                        "hand off a live report URL to a vendor or colleague without "
                        "granting them server access."
                    ),
                },
            ],
            "useCases": [
                "Pre-deployment server acceptance checks for new cloud instances",
                "Incident triage: share a live snapshot URL in the team chat",
                "Periodic cron-driven health reports stored in W-DaaS for trending",
            ],
        },
    }
    import os, sys
    out = render(_sample, "oms.myfastools.com", "/dashboard")
    dest = "/tmp/w-landing-test.html"
    with open(dest, "w") as f:
        f.write(out)
    print(f"Generated {len(out):,} bytes -> {dest}")
