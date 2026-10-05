#!/usr/bin/env python3
"""Fail-closed validation for public clean URLs and legacy aliases."""
from __future__ import annotations

import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
SITE_ORIGIN = "https://lotbiai.com"
ROUTES = (
    "about",
    "subscribe",
    "refund",
    "exchange",
    "dispute",
    "account-deletion",
    "contact",
    "terms",
    "privacy",
)
ROUTE_GROUP = "|".join(ROUTES)
LEGACY_PATHS = {f"/{route}.html" for route in ROUTES}
LINK_RE = re.compile(r"(?:href|action)=[\"']([^\"']+)[\"']", re.IGNORECASE)


def main() -> int:
    errors: list[str] = []

    nginx = (ROOT / "nginx/default.conf.template").read_text(encoding="utf-8")
    required_nginx = (
        f"location ~ ^/({ROUTE_GROUP})\\.html$ {{",
        "return 301 /$1$is_args$args;",
        f"location ~ ^/(?<clean_page>{ROUTE_GROUP})$ {{",
        "try_files /$clean_page.html =404;",
    )
    for contract in required_nginx:
        if contract not in nginx:
            errors.append(f"nginx clean-URL contract missing: {contract}")

    for route in ROUTES:
        page = ROOT / f"{route}.html"
        if not page.exists():
            errors.append(f"legacy backing file missing: {page.name}")
            continue
        html = page.read_text(encoding="utf-8")
        canonical = f'{SITE_ORIGIN}/{route}'
        if f'<link rel="canonical" href="{canonical}" />' not in html:
            errors.append(f"{page.name}: canonical must be {canonical}")
        if f'<meta property="og:url" content="{canonical}" />' not in html:
            errors.append(f"{page.name}: og:url must be {canonical}")

    for page in ROOT.rglob("*.html"):
        if ".git" in page.parts:
            continue
        html = page.read_text(encoding="utf-8")
        for raw_url in LINK_RE.findall(html):
            parsed = urlparse(raw_url)
            if parsed.netloc and parsed.netloc != "lotbiai.com":
                continue
            path = parsed.path if parsed.path.startswith("/") else f"/{parsed.path}"
            if path in LEGACY_PATHS:
                errors.append(f"{page.relative_to(ROOT)}: internal link uses legacy URL: {raw_url}")

    legacy_js_re = re.compile(rf"(?<![A-Za-z0-9-])/?(?:{ROUTE_GROUP})\.html(?:[?#\"'])")
    for script in ROOT.glob("*.js"):
        text = script.read_text(encoding="utf-8")
        if legacy_js_re.search(text):
            errors.append(f"{script.name}: runtime link uses a legacy .html URL")

    sitemap_path = ROOT / "sitemap.xml"
    try:
        sitemap_root = ET.parse(sitemap_path).getroot()
    except ET.ParseError as exc:
        errors.append(f"sitemap.xml: invalid XML: {exc}")
    else:
        ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        urls = {elem.text.strip() for elem in sitemap_root.findall("s:url/s:loc", ns) if elem.text}
        for route in ROUTES:
            clean = f"{SITE_ORIGIN}/{route}"
            legacy = f"{clean}.html"
            if clean not in urls:
                errors.append(f"sitemap.xml: clean URL missing: {clean}")
            if legacy in urls:
                errors.append(f"sitemap.xml: legacy URL must not be indexed: {legacy}")

    if errors:
        print(f"CLEAN URL VALIDATION FAILED ({len(errors)} issue(s))")
        for error in errors:
            print(f"- {error}")
        return 1

    print("CLEAN URL VALIDATION PASS — canonical routes, internal links, sitemap and legacy redirects are aligned.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
