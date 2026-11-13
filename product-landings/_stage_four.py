#!/usr/bin/env python3
"""Stage landings for w-netsense, w-nvr, w-omnisense, w-erp."""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _gen import render

PRODUCTS = [
    {
        "slug": "w-netsense",
        "name": "W-NetSense",
        "tagline": "Cyberspace sensing & CT monitoring.",
        "category": "Sensing",
        "domain": "ct.myfastools.com",
        "features": [
            "Certificate-transparency monitoring",
            "Network & asset mapping",
            "Threat intelligence",
            "DHT crawling",
        ],
        "content": {
            "overview": (
                "W-NetSense is a continuous cyberspace sensing platform that watches certificate-transparency logs, "
                "crawls the DHT, and maps internet-exposed assets in real time. Security teams and researchers use it "
                "to discover shadow IT, track certificate issuance for their domains, and surface emerging threats "
                "before attackers exploit them."
            ),
            "sections": [
                {
                    "title": "Certificate-transparency monitoring",
                    "body": (
                        "W-NetSense subscribes to all major CT log streams and alerts you the moment a certificate is "
                        "issued for any domain you monitor — including wildcards and subdomains you did not provision "
                        "yourself. Catch typosquatting, phishing infrastructure, and unauthorized cert issuance within "
                        "minutes of log entry."
                    ),
                },
                {
                    "title": "Network & asset mapping",
                    "body": (
                        "Passive and active scanning techniques build a continuously updated map of your internet-facing "
                        "assets: open ports, running services, banner versions, and TLS fingerprints. Correlate findings "
                        "with threat-intelligence feeds to prioritize remediation across your entire external attack surface."
                    ),
                },
                {
                    "title": "DHT crawling & peer intelligence",
                    "body": (
                        "A purpose-built DHT crawler harvests peer announcements and infohash metadata from BitTorrent "
                        "and IPFS networks, giving threat hunters early warning of data leaks, pirated software bundles, "
                        "and C2 infrastructure that communicates over decentralized channels."
                    ),
                },
            ],
            "useCases": [
                "Detect unauthorized subdomains and rogue certificates the moment they are issued",
                "Map external attack surface before a penetration test or audit",
                "Monitor for domain squatting and phishing infrastructure targeting your brand",
                "Hunt C2 channels and malware distribution nodes over DHT networks",
                "Track third-party vendor exposure across shared infrastructure",
            ],
        },
        "app_domain": "ct.myfastools.com",
        "next_path": "/dashboard",
    },
    {
        "slug": "w-nvr",
        "name": "W-NVR",
        "tagline": "Smart video recording & analysis.",
        "category": "Sensing",
        "domain": "omninvr.myfastools.com",
        "features": [
            "Multi-camera NVR",
            "Motion & event detection",
            "Clip & snapshot storage",
            "Live view",
        ],
        "content": {
            "overview": (
                "W-NVR is a smart network video recorder that unifies multiple camera feeds into a single, searchable "
                "system — combining continuous recording with AI-driven motion and event detection. Operations and "
                "security teams can monitor live streams, review flagged clips, and pull snapshots without managing a "
                "tangle of manufacturer-specific software."
            ),
            "sections": [
                {
                    "title": "Multi-camera recording & live view",
                    "body": (
                        "Connect IP cameras from any ONVIF-compatible manufacturer and W-NVR handles the rest: continuous "
                        "recording, adaptive bitrate storage, and a unified live grid view accessible from any browser. "
                        "Add or remove cameras without reconfiguring storage backends — the system scales horizontally "
                        "as your camera count grows."
                    ),
                },
                {
                    "title": "Motion & event detection",
                    "body": (
                        "Built-in motion detection triggers clip capture and push notifications the moment activity occurs "
                        "in a defined zone. Configurable sensitivity and schedule rules eliminate alert fatigue while "
                        "ensuring nothing important is missed. Each event is timestamped and indexed for instant retrieval."
                    ),
                },
                {
                    "title": "Clip & snapshot management",
                    "body": (
                        "Every flagged event is saved as a discrete clip alongside a keyframe snapshot, stored with "
                        "configurable retention policies. Search by camera, time range, or event type to surface exactly "
                        "the footage you need. Export clips in standard formats for incident reports or legal holds."
                    ),
                },
            ],
            "useCases": [
                "Centralize camera feeds from multiple physical sites into a single management console",
                "Automatically clip and store motion events for retail loss-prevention review",
                "Monitor access-controlled entry points and receive instant alerts on unauthorized motion",
                "Pull time-stamped evidence clips quickly for security incident investigations",
                "Replace aging DVR hardware with a software NVR that works with existing IP cameras",
            ],
        },
        "app_domain": "omninvr.myfastools.com",
        "next_path": "/dashboard",
    },
    {
        "slug": "w-omnisense",
        "name": "W-OmniSense",
        "tagline": "A vision reasoning & perception engine.",
        "category": "Sensing",
        "domain": "omnisense.myfastools.com",
        "features": [
            "Object detection",
            "Scene understanding",
            "Visual question answering",
            "Custom pipelines",
        ],
        "content": {
            "overview": (
                "W-OmniSense is a vision reasoning and perception engine that turns raw image and video streams into "
                "structured, queryable intelligence. Product teams, researchers, and operations engineers use it to build "
                "object detection pipelines, answer natural-language questions about scenes, and extract meaning from "
                "visual data without managing their own model infrastructure."
            ),
            "sections": [
                {
                    "title": "Object detection & classification",
                    "body": (
                        "Run state-of-the-art detection models against images or video frames to locate, label, and count "
                        "objects with bounding-box precision. W-OmniSense supports both general-purpose COCO-class detection "
                        "and domain-specific fine-tuned models, so you get production-quality accuracy whether you are "
                        "counting vehicles on a road or defects on a production line."
                    ),
                },
                {
                    "title": "Scene understanding",
                    "body": (
                        "Beyond individual objects, W-OmniSense reasons about the full scene: spatial relationships, "
                        "activity recognition, scene category, and ambient conditions. Submit an image and receive a "
                        "structured description that can feed downstream decision logic, alert rules, or search indexes "
                        "— no prompt engineering required."
                    ),
                },
                {
                    "title": "Visual question answering",
                    "body": (
                        "Ask plain-language questions about any image and receive grounded, accurate answers. "
                        "\"How many people are in the frame?\", \"Is the protective gear being worn correctly?\", "
                        "\"What brand of product is on shelf three?\" — W-OmniSense combines vision encoders with "
                        "language models to answer questions that would otherwise require manual review."
                    ),
                },
            ],
            "useCases": [
                "Automate quality-control inspection on a manufacturing line using object detection",
                "Build a visual search feature that lets users find products by uploading a photo",
                "Extract structured data from scanned forms, receipts, or handwritten documents",
                "Monitor live camera feeds for safety-compliance violations in industrial settings",
                "Power a retail shelf-analytics system that tracks stock levels and planogram compliance",
            ],
        },
        "app_domain": "omnisense.myfastools.com",
        "next_path": "/dashboard",
    },
    {
        "slug": "w-erp",
        "name": "W-ERP",
        "tagline": "One-person ERP & business operations.",
        "category": "Apps",
        "domain": "opc.myfastools.com",
        "features": [
            "Invoicing",
            "Inventory",
            "Lightweight CRM",
            "Reports",
        ],
        "content": {
            "overview": (
                "W-ERP is a lean business-operations hub built for solo founders, freelancers, and micro-teams who need "
                "real ERP power without the enterprise overhead. It covers the full revenue cycle — from quoting to "
                "invoicing to cash — alongside inventory control and a built-in CRM, all in one W-ID authenticated workspace."
            ),
            "sections": [
                {
                    "title": "Key capabilities",
                    "body": (
                        "Create professional invoices in seconds, track line-item inventory across locations, and manage "
                        "client relationships with a lightweight CRM that keeps deal history, contacts, and follow-up tasks "
                        "in a single view. Every action is timestamped and audit-logged so you always know the state of "
                        "your business."
                    ),
                },
                {
                    "title": "How it works",
                    "body": (
                        "Connect your W-ID account and the onboarding wizard walks you through your product catalog, tax "
                        "settings, and payment details in under ten minutes. From there, invoices flow automatically into "
                        "the revenue report, stock movements update inventory in real time, and the CRM timeline surfaces "
                        "the next action for each client."
                    ),
                },
                {
                    "title": "Reports & insights",
                    "body": (
                        "Built-in revenue, expense, and inventory reports update live and can be exported as PDF or CSV. "
                        "Filter by date range, client, or product category to pinpoint exactly where your business is "
                        "growing or where margin is leaking."
                    ),
                },
            ],
            "useCases": [
                "Freelancers billing clients and tracking time against projects",
                "Small product businesses managing purchase orders and stock levels",
                "Consultants running a lightweight CRM alongside their invoicing",
                "Early-stage startups that need audit-ready financials without full-blown accounting software",
                "Solo operators wanting a single dashboard for their entire business operation",
            ],
        },
        "app_domain": "opc.myfastools.com",
        "next_path": "/dashboard",
    },
]

for p in PRODUCTS:
    slug = p["slug"]
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), slug)
    os.makedirs(out_dir, exist_ok=True)
    html = render(p, p["app_domain"], p["next_path"])
    out_path = f"{out_dir}/index.html"
    with open(out_path, "w") as f:
        f.write(html)
    print(f"WROTE {slug}: {len(html):,} bytes -> {out_path}")
