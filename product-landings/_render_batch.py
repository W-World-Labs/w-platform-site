#!/usr/bin/env python3
"""
Batch renderer: generate Tesla-style landing pages for the 4 target products.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _gen import render

PRODUCTS = [
    {
        "slug": "w-domain",
        "name": "W-Domain",
        "tagline": "Self-serve subdomains, DNS & automatic SSL.",
        "category": "Platform",
        "domain": "wdomain.myfastools.com",
        "features": [
            "Self-service subdomain claims",
            "Cloudflare DNS automation",
            "Wildcard SSL issuance",
            "Out-of-band abuse detection",
        ],
        "content": {
            "overview": "W-Domain lets developers and teams claim subdomains, configure DNS records, and receive automatically provisioned SSL certificates — all without touching a Cloudflare dashboard or waiting for an ops ticket. It automates the entire lifecycle from subdomain claim to HTTPS-ready deployment, and monitors claims out-of-band for abuse so the namespace stays clean. For any W Platform product that needs a live public URL, W-Domain is the fastest path from zero to secure.",
            "sections": [
                {
                    "title": "Self-service subdomain claims",
                    "body": "Authenticated W-ID users can claim a subdomain in seconds through the W-Domain interface or API. Claims are validated against naming policies, reserved word lists, and existing registrations in real time, so conflicts are caught before they are committed. Once claimed, the subdomain is immediately live and pointing at your target.",
                },
                {
                    "title": "Cloudflare DNS automation",
                    "body": "W-Domain talks directly to the Cloudflare API to create, update, and delete DNS records on your behalf. No manual zone editing, no propagation guesswork — changes are applied at the edge within seconds and you receive confirmation once the record is live. CNAME, A, AAAA, and TXT records are all supported.",
                },
                {
                    "title": "Wildcard SSL issuance",
                    "body": "Every claimed subdomain receives a TLS certificate automatically — including wildcard certificates for teams that run multiple sub-paths under a single domain. Certificates are renewed before expiry without any intervention required, so you never face a surprise HTTPS warning in production.",
                },
                {
                    "title": "Out-of-band abuse detection",
                    "body": "W-Domain continuously monitors active subdomains for abuse signals — phishing patterns, unexpected content changes, and dangling DNS records that could be hijacked. When a risk is detected, the claim is flagged for review and the owner is notified, keeping the shared namespace trustworthy for everyone.",
                },
            ],
            "useCases": [
                "Spin up a staging subdomain for a new W Platform product in under a minute",
                "Issue wildcard SSL for a customer-facing multi-tenant SaaS deployment",
                "Automate subdomain provisioning for each new user workspace via the API",
                "Clean up dangling DNS records after a product is retired",
                "Monitor the shared namespace for subdomain takeover or phishing attempts",
            ],
        },
    },
    {
        "slug": "w-search",
        "name": "W-Search",
        "tagline": "A unified multi-source search engine.",
        "category": "Platform",
        "domain": "search.myfastools.com",
        "features": [
            "Web, news & image search",
            "Self-hosted + API engines",
            "Corpus full-text search",
            "One simple API",
        ],
        "content": {
            "overview": "W-Search consolidates web, news, image, and corpus full-text search behind a single clean API — so products and developers stop managing multiple search provider integrations and get consistent, high-quality results from one endpoint. It can route queries to self-hosted search engines or external API providers based on your configuration, and supports indexed full-text search over private corpora alongside public web results. Any W Platform product that needs search capability plugs into W-Search and gets everything at once.",
            "sections": [
                {
                    "title": "Multi-source results in one call",
                    "body": "A single W-Search API request can return blended results from web indices, news feeds, image collections, and your own private corpus simultaneously. Response merging and deduplication happen server-side, so the caller receives a clean ranked list rather than having to fan out and reconcile multiple upstream responses.",
                },
                {
                    "title": "Self-hosted and API engine support",
                    "body": "W-Search supports both self-hosted search backends (SearXNG, Meilisearch, Elasticsearch) and external API providers, configurable per query type. This means you can keep sensitive corpus searches entirely on-premise while still routing general web queries to a public index — with the same API surface throughout.",
                },
                {
                    "title": "Corpus full-text search",
                    "body": "Index your own documents, logs, knowledge bases, or product data and search them alongside live web results. W-Search handles tokenization, stemming, and relevance scoring, returning structured hits with excerpt highlights. Corpus indices are managed through the W-Search admin interface and accessible to any authorized W-ID client.",
                },
                {
                    "title": "Why developers integrate it",
                    "body": "Standing up a reliable multi-source search stack is weeks of work — integrating APIs, normalizing result schemas, handling rate limits, and building fallback logic. W-Search does all of that once, centrally, and exposes one simple authenticated endpoint. Other W Platform products like W-Knowledge use W-Search under the hood for exactly this reason.",
                },
            ],
            "useCases": [
                "Add web + corpus search to a product feature with a single API integration",
                "Power an internal knowledge-base search that blends private docs with live web results",
                "Index product documentation for natural-language search in a help widget",
                "Route image search queries through W-Search to surface visually similar content",
                "Use W-Search as the retrieval layer for a retrieval-augmented generation (RAG) pipeline",
            ],
        },
    },
    {
        "slug": "w-maas",
        "name": "W-MaaS",
        "tagline": "Model-as-a-service inference endpoints.",
        "category": "Platform",
        "domain": "maas.myfastools.com",
        "features": [
            "Hosted model endpoints",
            "OpenAI-compatible API",
            "Usage metering",
            "Multiple models",
        ],
        "content": {
            "overview": "W-MaaS gives developers and teams instant access to hosted AI model inference without managing GPUs, containers, or scaling infrastructure. Drop in your API key and start calling models through a fully OpenAI-compatible interface — your existing SDKs and tooling work unchanged. Built for builders who need reliable, metered inference as a platform primitive rather than a separate vendor relationship.",
            "sections": [
                {
                    "title": "Hosted inference, zero ops",
                    "body": "W-MaaS runs model endpoints on managed infrastructure so you never provision a GPU node or worry about cold-start latency. Each endpoint is always-on and accessible over HTTPS with consistent response times. Your team ships features, not infrastructure tickets.",
                },
                {
                    "title": "OpenAI-compatible API",
                    "body": "Every endpoint speaks the OpenAI Chat Completions format, so any library or tool that already works with OpenAI works with W-MaaS — no adapter code required. Swap the base URL, keep your existing prompts and client code, and gain access to the full model roster available on the W platform.",
                },
                {
                    "title": "Usage metering & quota control",
                    "body": "Token consumption is tracked per request and surfaced in real time through W-Radar. Set per-workspace quotas to prevent runaway costs, inspect usage history, and allocate capacity across teams. Billing integrates directly with your W membership so there is no separate invoice to reconcile.",
                },
                {
                    "title": "Multiple models, one endpoint surface",
                    "body": "Choose from a curated roster of open and proprietary models through a single API surface. Switch models by changing a single parameter — no new credentials, no new SDK, no new deployment. As new models are added to the platform, they become immediately available to your existing integration.",
                },
            ],
            "useCases": [
                "Add LLM-powered features to a product without managing model hosting",
                "Run internal AI tools under a shared quota controlled by your organization",
                "Prototype with multiple models and switch without changing client code",
                "Meter per-team AI usage for internal chargeback or governance reporting",
                "Back a W-ModelGW route with a private, rate-limited inference endpoint",
            ],
        },
    },
    {
        "slug": "w-inspector",
        "name": "W-Inspector",
        "tagline": "Server quality inspection & online reports.",
        "category": "Analysis",
        "domain": "oms.myfastools.com",
        "features": [
            "CPU / memory / disk / network checks",
            "Lightweight benchmarks",
            "JSON + Markdown reports",
            "Shareable public reports",
        ],
        "content": {
            "overview": "W-Inspector gives you a clear, instant picture of any server's health — CPU load, memory pressure, disk utilization, and network throughput — in one lightweight run. It produces structured JSON and human-readable Markdown reports you can share with teammates or embed in runbooks without any extra tooling. Built for DevOps engineers and infrastructure teams who need fast, trustworthy diagnostics without heavyweight monitoring agents.",
            "sections": [
                {
                    "title": "Key capabilities",
                    "body": "Inspector collects CPU idle/usage, memory available and swap, per-disk I/O and free space, and live network throughput across all interfaces in a single pass. Lightweight micro-benchmarks measure disk sequential speed and CPU compute, giving you a performance baseline you can track over time. Every result is timestamped and versioned so you always know exactly when data was gathered.",
                },
                {
                    "title": "Flexible report formats",
                    "body": "Results are emitted as clean JSON for machine consumption and as Markdown for human review — paste directly into a GitHub issue, Notion doc, or incident ticket. Public shareable links let you hand off a live report URL to a vendor or colleague without granting them server access. Export is instant; no account required on the receiving end.",
                },
                {
                    "title": "How it works",
                    "body": "Inspector runs a single stateless binary on your host — no persistent daemon, no telemetry phone-home. It reads /proc and /sys on Linux and equivalent syscalls on other platforms, runs the micro-benchmarks, then uploads or prints the report. You control where the output goes: stdout, a local file, or the W platform report store.",
                },
                {
                    "title": "Why teams use it",
                    "body": "Incident response moves faster when everyone looks at the same snapshot. Shareable report URLs replace ad-hoc requests to paste terminal output into chat. Because W-Inspector is stateless and lightweight, you can embed it in CI pipelines to catch regressions in cloud instance performance before deploying workloads.",
                },
            ],
            "useCases": [
                "Pre-deployment server acceptance checks for new cloud instances",
                "Incident triage: share a live snapshot URL in the team chat",
                "Periodic cron-driven health reports stored in W-DaaS for trending",
                "Vendor handoff reports proving SLA-grade hardware was delivered",
                "CI pipeline stage to detect unexpected performance regressions",
            ],
        },
    },
]

TARGETS = {
    "w-domain":   ("wdomain.myfastools.com",  "/dashboard"),
    "w-search":   ("search.myfastools.com",   "/dashboard"),
    "w-maas":     ("maas.myfastools.com",     "/dashboard"),
    "w-inspector":("oms.myfastools.com",      "/dashboard"),
}

base = os.path.dirname(os.path.abspath(__file__))

for p in PRODUCTS:
    slug = p["slug"]
    if slug not in TARGETS:
        continue
    app_domain, next_path = TARGETS[slug]
    html = render(p, app_domain, next_path)
    out_dir = os.path.join(base, slug)
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "index.html")
    with open(out_path, "w") as f:
        f.write(html)
    print(f"Wrote {len(html):,} bytes -> {out_path}")
