#!/usr/bin/env python3
"""Render concrete product UI mockup thumbnails for W product cards."""

from __future__ import annotations

from dataclasses import dataclass
import json
import math
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont


PRODUCT_UI_SIZE = (1600, 900)


@dataclass(frozen=True)
class ProductUISummary:
    product_count: int
    image_count: int
    prompt_count: int
    manifest_path: Path


UI_SPECS = {
    "w-id": {
        "title": "Identity Console",
        "nav": ["Clients", "Providers", "Sessions", "Audit"],
        "kpis": [("OIDC clients", "24"), ("Active sessions", "1.8k"), ("Audit events", "98k")],
        "primary": "identity",
        "secondary": "auth_flow",
        "accent": "#5b8cff",
    },
    "w-radar": {
        "title": "Fleet Control Plane",
        "nav": ["Services", "Deploys", "Quotas", "Alerts"],
        "kpis": [("Healthy services", "42"), ("P95 latency", "118 ms"), ("Quota usage", "73%")],
        "primary": "radar",
        "secondary": "deploy_timeline",
        "accent": "#33d6a6",
    },
    "w-domain": {
        "title": "Domain Manager",
        "nav": ["Claims", "DNS", "TLS", "Abuse"],
        "kpis": [("Live domains", "318"), ("TLS issued", "318"), ("DNS changes", "1.2k")],
        "primary": "dns",
        "secondary": "tls_cards",
        "accent": "#37b7ff",
    },
    "w-search": {
        "title": "Unified Search",
        "nav": ["Web", "News", "Images", "Corpus"],
        "kpis": [("Sources", "4"), ("Avg latency", "240 ms"), ("Corpus docs", "82k")],
        "primary": "search",
        "secondary": "result_sources",
        "accent": "#7a7cff",
    },
    "w-maas": {
        "title": "Model Endpoints",
        "nav": ["Models", "Keys", "Usage", "Quotas"],
        "kpis": [("Endpoints", "16"), ("Tokens today", "12.4M"), ("Avg cost", "$0.42")],
        "primary": "models",
        "secondary": "usage_chart",
        "accent": "#2fd8c5",
    },
    "w-design": {
        "title": "Design System",
        "nav": ["Tokens", "Components", "Assets", "Docs"],
        "kpis": [("Components", "68"), ("Tokens", "214"), ("Packages", "7")],
        "primary": "design",
        "secondary": "component_preview",
        "accent": "#9b7cff",
    },
    "w-modelgw": {
        "title": "Model Gateway",
        "nav": ["Routes", "Providers", "Keys", "Limits"],
        "kpis": [("Routes", "32"), ("Fallbacks", "6"), ("Blocked", "184")],
        "primary": "gateway",
        "secondary": "rate_limits",
        "accent": "#41d989",
    },
    "w-inspector": {
        "title": "Server Inspection",
        "nav": ["Checks", "Benchmarks", "Reports", "Share"],
        "kpis": [("CPU score", "91"), ("Disk read", "1.4 GB/s"), ("Open alerts", "2")],
        "primary": "server",
        "secondary": "report",
        "accent": "#48a4ff",
    },
    "w-quant": {
        "title": "Quant Workspace",
        "nav": ["Signals", "Backtests", "Risk", "Portfolio"],
        "kpis": [("Signals", "128"), ("Sharpe", "1.82"), ("Drawdown", "-4.6%")],
        "primary": "quant",
        "secondary": "risk",
        "accent": "#36d399",
    },
    "w-daas": {
        "title": "Dataset Service",
        "nav": ["Datasets", "Pipelines", "Quality", "API"],
        "kpis": [("Datasets", "54"), ("Freshness", "99.8%"), ("API calls", "3.1M")],
        "primary": "pipeline",
        "secondary": "data_table",
        "accent": "#2ecfc0",
    },
    "w-imagetrace": {
        "title": "Image Trace",
        "nav": ["Search", "Matches", "Lineage", "Exports"],
        "kpis": [("Matches", "247"), ("Confidence", "96%"), ("Sources", "18")],
        "primary": "image_trace",
        "secondary": "similarity",
        "accent": "#47a7ff",
    },
    "w-knowledge": {
        "title": "Knowledge Graph",
        "nav": ["Entities", "Sources", "Graph", "Answers"],
        "kpis": [("Entities", "12.8k"), ("Docs", "41k"), ("Links", "88k")],
        "primary": "knowledge",
        "secondary": "citations",
        "accent": "#8d7cff",
    },
    "w-netsense": {
        "title": "Cyberspace Sensing",
        "nav": ["CT Logs", "Assets", "DHT", "Threats"],
        "kpis": [("New certs", "183"), ("Assets", "4.7k"), ("Risks", "12")],
        "primary": "attack_surface",
        "secondary": "ct_feed",
        "accent": "#31c6ff",
    },
    "w-nvr": {
        "title": "Smart NVR",
        "nav": ["Live", "Events", "Clips", "Storage"],
        "kpis": [("Cameras", "24"), ("Events", "318"), ("Retention", "30d")],
        "primary": "camera_grid",
        "secondary": "clip_list",
        "accent": "#55b7ff",
    },
    "w-omnisense": {
        "title": "Vision Reasoning",
        "nav": ["Detect", "Scenes", "Q&A", "Pipelines"],
        "kpis": [("Frames", "18k"), ("Objects", "64k"), ("Accuracy", "97%")],
        "primary": "vision",
        "secondary": "pipeline_steps",
        "accent": "#6f8dff",
    },
    "w-erp": {
        "title": "Business Operations",
        "nav": ["Invoices", "Inventory", "CRM", "Reports"],
        "kpis": [("Revenue", "$84k"), ("Inventory", "1.2k"), ("Open deals", "38")],
        "primary": "erp",
        "secondary": "invoice",
        "accent": "#2fd083",
    },
    "w-hospital": {
        "title": "Clinic Workflow",
        "nav": ["Patients", "Schedule", "Notes", "Reports"],
        "kpis": [("Patients", "1.4k"), ("Today", "38"), ("Open notes", "7")],
        "primary": "hospital",
        "secondary": "patient_record",
        "accent": "#35c99a",
    },
    "w-medtwin": {
        "title": "Digital Twin Quality",
        "nav": ["Twins", "Simulation", "Metrics", "Validation"],
        "kpis": [("Twins", "18"), ("Runs", "2.1k"), ("Drift", "0.8%")],
        "primary": "medtwin",
        "secondary": "validation",
        "accent": "#5ca7ff",
    },
    "w-collect": {
        "title": "File Intake Portal",
        "nav": ["Portals", "Submissions", "Rules", "Review"],
        "kpis": [("Portals", "12"), ("Submissions", "486"), ("Pending", "21")],
        "primary": "collect",
        "secondary": "upload_rules",
        "accent": "#37c7d8",
    },
    "w-transfer": {
        "title": "Secure Transfer",
        "nav": ["Send", "Receive", "Links", "Audit"],
        "kpis": [("Transfers", "76"), ("Avg speed", "82 MB/s"), ("Encrypted", "100%")],
        "primary": "transfer",
        "secondary": "audit_log",
        "accent": "#44b3ff",
    },
    "w-jcr": {
        "title": "Journal Lookup",
        "nav": ["Journals", "Citations", "Metrics", "Export"],
        "kpis": [("Journals", "9.4k"), ("Citations", "1.8M"), ("Exports", "212")],
        "primary": "jcr",
        "secondary": "citation_graph",
        "accent": "#f1b84b",
    },
    "w-translate": {
        "title": "Translation Workspace",
        "nav": ["Text", "Documents", "Engines", "API"],
        "kpis": [("Languages", "64"), ("Docs", "1.1k"), ("Quality", "A")],
        "primary": "translate",
        "secondary": "engine_compare",
        "accent": "#8a7cff",
    },
}


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/SFNS.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial Bold.ttf" if bold else "/Library/Fonts/Arial.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def _hex(color: str) -> tuple[int, int, int]:
    color = color.lstrip("#")
    return tuple(int(color[i : i + 2], 16) for i in (0, 2, 4))


def _rgba(color: str, alpha: int) -> tuple[int, int, int, int]:
    return (*_hex(color), alpha)


def _lerp(a: int, b: int, t: float) -> int:
    return round(a + (b - a) * t)


def _gradient(size: tuple[int, int], top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    img = Image.new("RGB", size)
    px = img.load()
    for y in range(size[1]):
        t = y / max(1, size[1] - 1)
        row = (_lerp(top[0], bottom[0], t), _lerp(top[1], bottom[1], t), _lerp(top[2], bottom[2], t))
        for x in range(size[0]):
            px[x, y] = row
    return img


def _rounded(draw: ImageDraw.ImageDraw, box, radius=20, fill=None, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def _text(draw: ImageDraw.ImageDraw, xy, text, size=24, color=(235, 240, 255), bold=False):
    draw.text(xy, text, fill=color, font=_font(size, bold=bold))


def _small_line(draw: ImageDraw.ImageDraw, x, y, w, accent, alpha=80):
    _rounded(draw, (x, y, x + w, y + 8), 4, fill=_rgba(accent, alpha))


def _window(draw: ImageDraw.ImageDraw, spec: dict, product: dict):
    accent = spec["accent"]
    _rounded(draw, (70, 72, 1530, 826), 34, fill=(13, 16, 25), outline=(45, 52, 72), width=2)
    _rounded(draw, (70, 72, 1530, 132), 34, fill=(18, 22, 33), outline=None)
    for i, c in enumerate(((255, 95, 86), (255, 189, 46), (39, 201, 63))):
        draw.ellipse((102 + i * 26, 94, 116 + i * 26, 108), fill=c)
    _text(draw, (190, 91), spec["title"], 24, (240, 244, 255), True)
    _rounded(draw, (1120, 91, 1430, 112), 10, fill=(27, 33, 48), outline=(55, 64, 85))
    _small_line(draw, 1142, 98, 166, accent, 95)
    _text(draw, (100, 155), product["name"], 44, (246, 248, 255), True)
    _text(draw, (104, 210), product["tagline"], 22, (151, 160, 183))
    y = 280
    for item in spec["nav"]:
        active = item == spec["nav"][0]
        fill = _rgba(accent, 52) if active else (18, 22, 33, 255)
        outline = _rgba(accent, 120) if active else (36, 43, 60, 255)
        _rounded(draw, (100, y, 285, y + 48), 16, fill=fill, outline=outline)
        _text(draw, (124, y + 13), item, 18, (230, 236, 255) if active else (128, 139, 164), True)
        y += 64


def _kpis(draw: ImageDraw.ImageDraw, spec: dict):
    accent = spec["accent"]
    x = 340
    for label, value in spec["kpis"]:
        _rounded(draw, (x, 155, x + 300, 245), 22, fill=(19, 24, 36), outline=(43, 51, 70))
        _text(draw, (x + 24, 176), label, 18, (139, 150, 176))
        _text(draw, (x + 24, 204), value, 30, (244, 248, 255), True)
        draw.ellipse((x + 240, 185, x + 266, 211), fill=_rgba(accent, 150))
        x += 325


def _panel(draw: ImageDraw.ImageDraw, box, title: str, accent: str):
    _rounded(draw, box, 24, fill=(18, 23, 35), outline=(43, 51, 70), width=2)
    _text(draw, (box[0] + 24, box[1] + 18), title, 22, (236, 240, 252), True)
    _small_line(draw, box[0] + 24, box[1] + 54, 118, accent, 130)


def _table(draw, box, title, headers, rows, accent):
    _panel(draw, box, title, accent)
    x1, y1, x2, _ = box
    y = y1 + 88
    col_w = (x2 - x1 - 48) // len(headers)
    for i, head in enumerate(headers):
        _text(draw, (x1 + 24 + i * col_w, y), head, 16, (138, 150, 178), True)
    y += 34
    for r, row in enumerate(rows):
        fill = (22, 28, 42) if r % 2 == 0 else (18, 23, 35)
        _rounded(draw, (x1 + 18, y - 8, x2 - 18, y + 34), 10, fill=fill)
        for i, cell in enumerate(row):
            color = _hex(accent) if i == len(row) - 1 else (219, 225, 240)
            _text(draw, (x1 + 24 + i * col_w, y), cell, 16, color)
        y += 46


def _chart(draw, box, title, accent, mode="line"):
    _panel(draw, box, title, accent)
    x1, y1, x2, y2 = box
    gx1, gy1, gx2, gy2 = x1 + 40, y1 + 92, x2 - 40, y2 - 42
    for i in range(5):
        y = gy1 + i * (gy2 - gy1) / 4
        draw.line((gx1, y, gx2, y), fill=(45, 52, 70), width=1)
    if mode == "bars":
        for i in range(10):
            x = gx1 + i * ((gx2 - gx1) / 10) + 10
            h = 36 + (i * 31) % 140
            _rounded(draw, (x, gy2 - h, x + 28, gy2), 8, fill=_rgba(accent, 140))
    else:
        points = []
        for i in range(12):
            x = gx1 + i * ((gx2 - gx1) / 11)
            y = gy2 - (50 + ((i * 47) % 150))
            points.append((x, y))
        draw.line(points, fill=_hex(accent), width=5, joint="curve")
        for x, y in points:
            draw.ellipse((x - 5, y - 5, x + 5, y + 5), fill=_hex(accent))


def _steps(draw, box, title, items, accent):
    _panel(draw, box, title, accent)
    x1, y1, x2, _ = box
    y = y1 + 95
    for i, item in enumerate(items, 1):
        draw.ellipse((x1 + 30, y, x1 + 58, y + 28), fill=_rgba(accent, 150))
        _text(draw, (x1 + 39, y + 4), str(i), 14, (8, 11, 18), True)
        _text(draw, (x1 + 78, y + 2), item, 18, (223, 229, 244), True)
        if i < len(items):
            draw.line((x1 + 44, y + 32, x1 + 44, y + 62), fill=_rgba(accent, 90), width=3)
        y += 65


def _tiles(draw, box, title, accent, labels):
    _panel(draw, box, title, accent)
    x1, y1, x2, _ = box
    cols = 3
    tile_w = (x2 - x1 - 80) // cols
    for i, label in enumerate(labels):
        col = i % cols
        row = i // cols
        x = x1 + 24 + col * (tile_w + 16)
        y = y1 + 86 + row * 104
        _rounded(draw, (x, y, x + tile_w, y + 78), 16, fill=(22, 28, 42), outline=(48, 57, 78))
        draw.rectangle((x + 18, y + 18, x + 56, y + 56), fill=_rgba(accent, 115))
        _text(draw, (x + 72, y + 22), label, 16, (223, 229, 244), True)


def _graph(draw, box, title, accent):
    _panel(draw, box, title, accent)
    x1, y1, x2, y2 = box
    nodes = [(x1 + 150, y1 + 155), (x1 + 310, y1 + 110), (x1 + 510, y1 + 165), (x1 + 260, y1 + 270), (x1 + 455, y1 + 310), (x1 + 660, y1 + 250)]
    for a, b in zip(nodes, nodes[1:] + nodes[:1]):
        draw.line((a[0], a[1], b[0], b[1]), fill=_rgba(accent, 90), width=3)
    for i, (x, y) in enumerate(nodes):
        draw.ellipse((x - 28, y - 28, x + 28, y + 28), fill=(22, 29, 44), outline=_rgba(accent, 160), width=3)
        _text(draw, (x - 8, y - 11), str(i + 1), 16, (235, 241, 255), True)


def _camera_grid(draw, box, title, accent):
    _panel(draw, box, title, accent)
    x1, y1, _, _ = box
    for i in range(6):
        col = i % 3
        row = i // 3
        x = x1 + 24 + col * 188
        y = y1 + 84 + row * 142
        _rounded(draw, (x, y, x + 170, y + 118), 14, fill=(12, 16, 24), outline=(48, 57, 78))
        draw.line((x + 10, y + 86, x + 160, y + 35), fill=_rgba(accent, 70), width=2)
        draw.rectangle((x + 12, y + 14, x + 158, y + 98), outline=_rgba(accent, 90), width=1)
        draw.ellipse((x + 126, y + 18, x + 142, y + 34), fill=_rgba(accent, 160))


def _vision(draw, box, title, accent):
    _panel(draw, box, title, accent)
    x1, y1, x2, y2 = box
    _rounded(draw, (x1 + 28, y1 + 86, x2 - 28, y2 - 30), 18, fill=(12, 16, 24), outline=(48, 57, 78))
    objects = [(x1 + 95, y1 + 150, 220, 115, "helmet"), (x1 + 370, y1 + 210, 180, 140, "forklift"), (x1 + 610, y1 + 125, 140, 220, "person")]
    for x, y, w, h, label in objects:
        draw.rectangle((x, y, x + w, y + h), outline=_hex(accent), width=4)
        _rounded(draw, (x, y - 30, x + 100, y - 4), 8, fill=_rgba(accent, 180))
        _text(draw, (x + 8, y - 27), label, 13, (7, 10, 15), True)


def _translate(draw, box, title, accent):
    _panel(draw, box, title, accent)
    x1, y1, x2, y2 = box
    mid = (x1 + x2) // 2
    for left, lang in ((x1 + 24, "Source document"), (mid + 14, "Translated output")):
        _rounded(draw, (left, y1 + 88, left + 310, y2 - 34), 16, fill=(22, 28, 42), outline=(48, 57, 78))
        _text(draw, (left + 22, y1 + 110), lang, 17, (230, 235, 250), True)
        for i in range(8):
            _small_line(draw, left + 22, y1 + 156 + i * 28, 230 - (i % 3) * 35, accent if left > mid else "#8792a7", 85)


def _progress(draw, box, title, accent):
    _panel(draw, box, title, accent)
    x1, y1, x2, _ = box
    y = y1 + 95
    for i, name in enumerate(["package.zip", "research-data", "media-folder", "contract.pdf"]):
        _text(draw, (x1 + 28, y), name, 18, (230, 235, 250), True)
        _rounded(draw, (x1 + 28, y + 32, x2 - 48, y + 48), 8, fill=(33, 39, 56))
        fill_w = int((x2 - x1 - 76) * (0.35 + (i * 0.17) % 0.6))
        _rounded(draw, (x1 + 28, y + 32, x1 + 28 + fill_w, y + 48), 8, fill=_rgba(accent, 170))
        y += 78


def _primary(draw, spec, product):
    accent = spec["accent"]
    kind = spec["primary"]
    box = (340, 275, 1065, 760)
    if kind == "identity":
        _table(draw, box, "Clients and sessions", ["Client", "Scope", "MFA", "Status"], [["Radar", "read", "on", "active"], ["Domain", "admin", "on", "active"], ["MaaS", "usage", "off", "review"], ["Search", "query", "on", "active"]], accent)
    elif kind == "radar":
        _chart(draw, box, "Service telemetry", accent)
    elif kind == "dns":
        _table(draw, box, "DNS records", ["Name", "Type", "Target", "TLS"], [["api", "CNAME", "edge", "issued"], ["docs", "A", "proxy", "issued"], ["demo", "TXT", "verify", "pending"], ["*.app", "CNAME", "edge", "issued"]], accent)
    elif kind == "search":
        _table(draw, box, "Blended results", ["Source", "Result", "Rank", "State"], [["Web", "docs hit", "1", "fresh"], ["Corpus", "policy", "2", "private"], ["News", "release", "3", "live"], ["Image", "visual", "4", "matched"]], accent)
    elif kind == "models":
        _table(draw, box, "Hosted models", ["Model", "Mode", "Tokens", "Health"], [["llm-fast", "chat", "4.8M", "ready"], ["vision-pro", "image", "920k", "ready"], ["embed-xl", "embed", "7.1M", "ready"], ["rerank", "rank", "340k", "warm"]], accent)
    elif kind == "design":
        _tiles(draw, box, "Component library", accent, ["Buttons", "Inputs", "Cards", "Modals", "Nav", "Charts"])
    elif kind == "gateway":
        _table(draw, box, "Provider routes", ["Route", "Primary", "Fallback", "Limit"], [["chat", "A", "B", "2k/m"], ["vision", "C", "A", "600/m"], ["embed", "B", "C", "5k/m"], ["rerank", "A", "off", "1k/m"]], accent)
    elif kind == "server":
        _chart(draw, box, "CPU, disk and network", accent, "bars")
    elif kind == "quant":
        _chart(draw, box, "Strategy backtest", accent)
    elif kind == "pipeline":
        _steps(draw, box, "Dataset pipeline", ["Ingest source", "Validate schema", "Publish API", "Monitor freshness"], accent)
    elif kind == "image_trace":
        _tiles(draw, box, "Reverse image matches", accent, ["Original", "Crop", "Mirror", "Web", "News", "Archive"])
    elif kind == "knowledge":
        _graph(draw, box, "Entity graph", accent)
    elif kind == "attack_surface":
        _table(draw, box, "External assets", ["Host", "Port", "Cert", "Risk"], [["api", "443", "new", "low"], ["mail", "25", "old", "med"], ["cdn", "443", "ok", "low"], ["demo", "8080", "new", "high"]], accent)
    elif kind == "camera_grid":
        _camera_grid(draw, box, "Live cameras", accent)
    elif kind == "vision":
        _vision(draw, box, "Scene detection", accent)
    elif kind == "erp":
        _table(draw, box, "Operations ledger", ["Item", "Client", "Qty", "State"], [["Invoice", "Acme", "12", "sent"], ["Stock", "SKU-84", "38", "low"], ["Deal", "North", "$8k", "open"], ["Report", "May", "PDF", "ready"]], accent)
    elif kind == "hospital":
        _table(draw, box, "Today schedule", ["Time", "Patient", "Room", "State"], [["09:00", "A-1042", "2A", "checked"], ["10:30", "B-8810", "3C", "waiting"], ["13:15", "C-2201", "1B", "notes"], ["15:00", "D-0118", "2A", "ready"]], accent)
    elif kind == "medtwin":
        _chart(draw, box, "Twin simulation envelope", accent)
    elif kind == "collect":
        _steps(draw, box, "Intake workflow", ["Create portal", "Collect files", "Tag submission", "Review package"], accent)
    elif kind == "transfer":
        _progress(draw, box, "Encrypted transfers", accent)
    elif kind == "jcr":
        _table(draw, box, "Journal metrics", ["Journal", "IF", "Quartile", "Export"], [["Oncology", "8.2", "Q1", "BibTeX"], ["Sensors", "4.1", "Q2", "RIS"], ["Materials", "6.7", "Q1", "CSV"], ["Methods", "3.9", "Q2", "JSON"]], accent)
    elif kind == "translate":
        _translate(draw, box, "Document translation", accent)
    else:
        _tiles(draw, box, product["name"], accent, product.get("features", [])[:6])


def _secondary(draw, spec):
    accent = spec["accent"]
    kind = spec["secondary"]
    box = (1090, 275, 1490, 760)
    if kind in {"auth_flow", "deploy_timeline", "pipeline_steps", "upload_rules"}:
        names = {
            "auth_flow": ["Redirect", "Consent", "Token", "Audit"],
            "deploy_timeline": ["Build", "Canary", "Promote", "Watch"],
            "pipeline_steps": ["Upload", "Infer", "Review", "Export"],
            "upload_rules": ["File type", "Deadline", "Metadata", "Notify"],
        }[kind]
        _steps(draw, box, "Workflow", names, accent)
    elif kind in {"usage_chart", "risk", "validation"}:
        _chart(draw, box, "Metrics", accent, "bars" if kind == "usage_chart" else "line")
    elif kind in {"citation_graph"}:
        _graph(draw, box, "Citation map", accent)
    elif kind == "component_preview":
        _tiles(draw, box, "Preview", accent, ["Primary", "Toggle", "Input", "Table", "Dialog", "Badge"])
    elif kind == "tls_cards":
        _tiles(draw, box, "TLS status", accent, ["Issued", "Renewal", "Wildcard", "Audit", "Policy", "Edge"])
    elif kind == "result_sources":
        _tiles(draw, box, "Sources", accent, ["Web", "News", "Image", "Corpus", "API", "Cache"])
    elif kind == "rate_limits":
        _table(draw, box, "Rate limits", ["Key", "Limit", "Use"], [["prod", "2k", "71%"], ["dev", "400", "22%"], ["partner", "800", "58%"]], accent)
    elif kind == "report":
        _table(draw, box, "Report", ["Check", "Value", "State"], [["CPU", "91", "ok"], ["RAM", "68%", "ok"], ["Disk", "82%", "warn"]], accent)
    elif kind == "data_table":
        _table(draw, box, "Quality", ["Field", "Null", "Fresh"], [["id", "0%", "now"], ["price", "0.2%", "1m"], ["region", "0%", "now"]], accent)
    elif kind == "similarity":
        _tiles(draw, box, "Similarity", accent, ["98%", "93%", "87%", "82%", "76%", "64%"])
    elif kind == "citations":
        _table(draw, box, "Sources", ["Doc", "Links", "Use"], [["Paper", "21", "high"], ["Spec", "12", "med"], ["Log", "8", "low"]], accent)
    elif kind == "ct_feed":
        _table(draw, box, "CT feed", ["Domain", "Issuer", "Age"], [["api", "R3", "2m"], ["cdn", "E1", "8m"], ["test", "R3", "1h"]], accent)
    elif kind == "clip_list":
        _table(draw, box, "Events", ["Cam", "Time", "Type"], [["A1", "09:14", "motion"], ["B2", "10:02", "door"], ["C4", "11:40", "person"]], accent)
    elif kind == "invoice":
        _table(draw, box, "Invoice", ["Line", "Qty", "Total"], [["Design", "4", "$800"], ["Hosting", "1", "$120"], ["Support", "6", "$540"]], accent)
    elif kind == "patient_record":
        _table(draw, box, "Record", ["Field", "Value", "Flag"], [["Vitals", "ok", "green"], ["Rx", "2", "review"], ["Notes", "new", "open"]], accent)
    elif kind == "audit_log":
        _table(draw, box, "Audit", ["Actor", "File", "State"], [["Kai", "zip", "sent"], ["Ops", "pdf", "read"], ["API", "log", "done"]], accent)
    elif kind == "engine_compare":
        _table(draw, box, "Engines", ["Pair", "Score", "Route"], [["EN-ZH", "A", "best"], ["DE-EN", "B+", "fast"], ["JA-EN", "A-", "best"]], accent)
    else:
        _tiles(draw, box, "Details", accent, ["API", "State", "Logs", "Users", "Rules", "Export"])


def render_mockup(product: dict) -> Image.Image:
    spec = UI_SPECS.get(product["slug"], UI_SPECS["w-id"])
    img = _gradient(PRODUCT_UI_SIZE, (6, 8, 13), (14, 17, 27)).convert("RGBA")
    draw = ImageDraw.Draw(img, "RGBA")
    accent = spec["accent"]
    for i in range(10):
        x = 1150 + i * 55
        draw.ellipse((x, 55 + i * 14, x + 220, 275 + i * 14), fill=_rgba(accent, 10))
    _window(draw, spec, product)
    _kpis(draw, spec)
    _primary(draw, spec, product)
    _secondary(draw, spec)
    _text(draw, (114, 782), "Product UI mockup - not abstract key art", 16, (94, 107, 132))
    return img.convert("RGB")


def _prompt(product: dict, out_rel: Path) -> str:
    spec = UI_SPECS.get(product["slug"], UI_SPECS["w-id"])
    return (
        f"# {product['name']} product UI mockup\n\n"
        f"- Product: `{product['slug']}` / {product['name']}\n"
        f"- Output: `{out_rel}`\n"
        f"- Style: concrete product UI mockup, not abstract key art\n"
        f"- Screen concept: {spec['title']}\n"
        f"- Primary module: `{spec['primary']}`\n"
        f"- Secondary module: `{spec['secondary']}`\n\n"
        "## Design Intent\n\n"
        "Generate a product-card thumbnail that looks like a real W Platform application interface. "
        "The image should communicate the product's actual workflow through dashboards, tables, charts, "
        "records, pipelines, previews, or operational panels. Avoid generic glowing hubs, decorative nodes, "
        "unreadable AI-generated pseudo-logos, and sci-fi abstractions.\n"
    )


def render_product_ui_assets(root: Path | str = ".", output_root: Path | str | None = None) -> ProductUISummary:
    root = Path(root).resolve()
    output_root = Path(output_root).resolve() if output_root is not None else root / "_images" / "generated" / "product-ui"
    output_root.mkdir(parents=True, exist_ok=True)
    products = json.loads((root / "_products.json").read_text(encoding="utf-8"))

    manifest = [
        "# Product UI mockup assets",
        "",
        "These images are a replacement style for product cards: concrete product UI mockups, not abstract key art.",
        "",
        "Default workspace target: `_images/generated/product-ui/`.",
        "",
        "| Product | Image | Prompt |",
        "| --- | --- | --- |",
    ]
    image_count = 0
    prompt_count = 0
    for product in products:
        slug = product["slug"]
        image_path = output_root / f"{slug}-product-ui.png"
        prompt_path = output_root / f"{slug}-product-ui.prompt.md"
        render_mockup(product).save(image_path)
        image_count += 1
        prompt_path.write_text(_prompt(product, image_path.relative_to(root) if image_path.is_relative_to(root) else image_path), encoding="utf-8")
        prompt_count += 1
        image_display = image_path.relative_to(root) if image_path.is_relative_to(root) else image_path
        prompt_display = prompt_path.relative_to(root) if prompt_path.is_relative_to(root) else prompt_path
        manifest.append(f"| `{slug}` {product['name']} | `{image_display}` | `{prompt_display}` |")

    manifest_path = output_root / "MANIFEST.md"
    manifest_path.write_text("\n".join(manifest) + "\n", encoding="utf-8")
    return ProductUISummary(len(products), image_count, prompt_count, manifest_path)


def main() -> None:
    summary = render_product_ui_assets(Path(__file__).resolve().parent)
    print(f"Rendered {summary.image_count} product UI mockups for {summary.product_count} products.")
    print(f"Wrote {summary.prompt_count} prompt sidecars.")
    print(f"Manifest: {summary.manifest_path}")


if __name__ == "__main__":
    main()
