#!/usr/bin/env python3
"""Fail-closed static validation for the LOTBI public site.

Checks required public pages, metadata, local links/assets/fragments, duplicate IDs,
image alt text, canonical URLs, robots/sitemap coverage, and the official account
 deletion handoff. The validator performs no network calls and never deploys.
"""
from __future__ import annotations

import re
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
SITE_ORIGIN = "https://lotbiai.com"
ACCOUNT_DELETION_URL = "https://account.lotbiai.com/account#deletion-title"
OFFICIAL_LOGO_SRC = "/assets/lotbi-logo-official-color.jpg"
REQUIRED_HTML = (
    "index.html",
    "about.html",
    "privacy.html",
    "terms.html",
    "account-deletion.html",
    "contact.html",
)
BRAND_SURFACES = REQUIRED_HTML + (
    "404.html",
    "auth/start/index.html",
    "auth/callback/index.html",
    "android-auth-test.html",
)
REQUIRED_FILES = REQUIRED_HTML + (
    "404.html",
    "styles.css",
    "about.css",
    "mobile-entry.css",
    "mobile-entry.js",
    "robots.txt",
    "sitemap.xml",
    "assets/lotbi-main-logo.png",
    "assets/lotbi-logo-official-color.jpg",
    "assets/lotbi-og-share.png",
)
EXPECTED_CANONICALS = {
    "index.html": f"{SITE_ORIGIN}/",
    "about.html": f"{SITE_ORIGIN}/about.html",
    "privacy.html": f"{SITE_ORIGIN}/privacy.html",
    "terms.html": f"{SITE_ORIGIN}/terms.html",
    "account-deletion.html": f"{SITE_ORIGIN}/account-deletion.html",
    "contact.html": f"{SITE_ORIGIN}/contact.html",
}


class DocumentParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: list[str] = []
        self.links: list[tuple[str, str]] = []
        self.images: list[tuple[str, str | None]] = []
        self.canonicals: list[str] = []
        self.meta: dict[str, list[str]] = {}
        self.lang: str | None = None
        self.title_parts: list[str] = []
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = {key.lower(): value for key, value in attrs}
        if tag == "html":
            self.lang = data.get("lang")
        element_id = data.get("id")
        if element_id:
            self.ids.append(element_id)
        if tag == "a" and data.get("href"):
            self.links.append(("href", data["href"] or ""))
        elif tag == "link" and data.get("href"):
            self.links.append(("href", data["href"] or ""))
            rel = (data.get("rel") or "").lower().split()
            if "canonical" in rel:
                self.canonicals.append(data["href"] or "")
        elif tag == "script" and data.get("src"):
            self.links.append(("src", data["src"] or ""))
        elif tag == "img":
            src = data.get("src") or ""
            self.links.append(("src", src))
            self.images.append((src, data.get("alt")))
        elif tag == "meta":
            key = (data.get("name") or data.get("property") or "").lower()
            content = data.get("content")
            if key and content is not None:
                self.meta.setdefault(key, []).append(content)
        elif tag == "title":
            self._in_title = True

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title_parts.append(data)

    @property
    def title(self) -> str:
        return "".join(self.title_parts).strip()


def parse_html(path: Path) -> DocumentParser:
    parser = DocumentParser()
    parser.feed(path.read_text(encoding="utf-8"))
    parser.close()
    return parser


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def local_target(source: Path, raw_url: str) -> tuple[Path | None, str | None]:
    if not raw_url or raw_url.startswith(("mailto:", "tel:", "data:")):
        return None, None
    parsed = urlparse(raw_url)
    if parsed.scheme or parsed.netloc:
        return None, parsed.fragment or None
    path_part = unquote(parsed.path)
    if not path_part:
        return source, parsed.fragment or None
    if path_part.startswith("/"):
        candidate = (ROOT / path_part.lstrip("/")).resolve()
    else:
        candidate = (source.parent / path_part).resolve()
    try:
        candidate.relative_to(ROOT.resolve())
    except ValueError:
        return Path("/__OUTSIDE_ROOT__"), parsed.fragment or None
    if raw_url.endswith("/") and candidate.is_dir():
        candidate = candidate / "index.html"
    return candidate, parsed.fragment or None


def main() -> int:
    errors: list[str] = []

    for rel in REQUIRED_FILES:
        path = ROOT / rel
        if not path.exists():
            fail(errors, f"missing required file: {rel}")
        elif path.is_file() and path.stat().st_size == 0:
            fail(errors, f"required file is empty: {rel}")

    docs: dict[Path, DocumentParser] = {}
    for rel in REQUIRED_HTML:
        path = ROOT / rel
        if not path.exists():
            continue
        doc = parse_html(path)
        docs[path.resolve()] = doc

        if doc.lang != "ko":
            fail(errors, f"{rel}: html lang must be ko")
        if not doc.title:
            fail(errors, f"{rel}: missing title")
        if not doc.meta.get("viewport"):
            fail(errors, f"{rel}: missing viewport meta")
        descriptions = doc.meta.get("description", [])
        if len(descriptions) != 1 or len(descriptions[0].strip()) < 20:
            fail(errors, f"{rel}: require one useful meta description")
        robots = doc.meta.get("robots", [])
        if len(robots) != 1 or "index" not in robots[0].lower():
            fail(errors, f"{rel}: require indexable robots meta")
        expected = EXPECTED_CANONICALS[rel]
        if doc.canonicals != [expected]:
            fail(errors, f"{rel}: canonical must be exactly {expected}")
        if len(doc.ids) != len(set(doc.ids)):
            duplicates = sorted({value for value in doc.ids if doc.ids.count(value) > 1})
            fail(errors, f"{rel}: duplicate ids: {', '.join(duplicates)}")
        for src, alt in doc.images:
            if alt is None or not alt.strip():
                fail(errors, f"{rel}: image {src!r} requires non-empty alt text")
        text = path.read_text(encoding="utf-8")
        if 'class="skip-link"' not in text or 'href="#main-content"' not in text:
            fail(errors, f"{rel}: missing skip link to #main-content")
        if 'id="main-content"' not in text:
            fail(errors, f"{rel}: missing #main-content target")
        for _, raw_url in doc.links:
            if raw_url.startswith("http://"):
                fail(errors, f"{rel}: insecure http URL: {raw_url}")

    for source_resolved, doc in list(docs.items()):
        source = Path(source_resolved)
        rel_source = source.relative_to(ROOT.resolve())
        for _, raw_url in doc.links:
            target, fragment = local_target(source, raw_url)
            if target is None:
                continue
            if str(target) == "/__OUTSIDE_ROOT__":
                fail(errors, f"{rel_source}: link escapes site root: {raw_url}")
                continue
            if not target.exists():
                fail(errors, f"{rel_source}: broken local link: {raw_url}")
                continue
            if fragment and target.suffix.lower() in {".html", ".htm"}:
                target_doc = docs.get(target.resolve())
                if target_doc is None:
                    target_doc = parse_html(target)
                    docs[target.resolve()] = target_doc
                if fragment not in target_doc.ids:
                    fail(errors, f"{rel_source}: missing fragment #{fragment} in {target.relative_to(ROOT)}")

    for rel in BRAND_SURFACES:
        path = ROOT / rel
        if not path.exists():
            fail(errors, f"{rel}: missing user-facing brand surface")
            continue
        surface = path.read_text(encoding="utf-8")
        if OFFICIAL_LOGO_SRC not in surface:
            fail(errors, f"{rel}: official LOTBI logo asset is missing")
        for forbidden in ("brand-text-logo", "brand-o", "lotbi-logo-header.png", "lotbi-logo-horizontal"):
            if forbidden in surface:
                fail(errors, f"{rel}: legacy/text-only logo reference must not render: {forbidden}")

    mobile_entry = (ROOT / "mobile-entry.js").read_text(encoding="utf-8") if (ROOT / "mobile-entry.js").exists() else ""
    if OFFICIAL_LOGO_SRC not in mobile_entry:
        fail(errors, "mobile-entry.js: mobile chooser must use official LOTBI logo asset")
    for forbidden in ("brand-text-logo", "brand-o", "lotbi-logo-header.png", "lotbi-logo-horizontal"):
        if forbidden in mobile_entry:
            fail(errors, f"mobile-entry.js: legacy/text-only logo reference must not render: {forbidden}")

    if (ROOT / "assets/lotbi-logo-header.png").exists():
        fail(errors, "legacy assets/lotbi-logo-header.png must not remain in the deploy tree")

    delete_page = ROOT / "account-deletion.html"
    if delete_page.exists():
        delete_text = delete_page.read_text(encoding="utf-8")
        if ACCOUNT_DELETION_URL not in delete_text:
            fail(errors, "account-deletion.html: official Account Web deletion URL is missing")
        if "즉시 hard delete" not in delete_text:
            fail(errors, "account-deletion.html: must not overclaim immediate hard deletion")

    index_text = (ROOT / "index.html").read_text(encoding="utf-8") if (ROOT / "index.html").exists() else ""
    for required_link in ("about.html", "privacy.html", "terms.html", "account-deletion.html", "contact.html"):
        if required_link not in index_text:
            fail(errors, f"index.html: footer/navigation must expose {required_link}")

    robots_path = ROOT / "robots.txt"
    if robots_path.exists():
        robots_text = robots_path.read_text(encoding="utf-8")
        if f"Sitemap: {SITE_ORIGIN}/sitemap.xml" not in robots_text:
            fail(errors, "robots.txt: missing canonical sitemap URL")
        if not re.search(r"(?im)^\s*Allow:\s*/\s*$", robots_text):
            fail(errors, "robots.txt: site must be crawlable")

    sitemap_path = ROOT / "sitemap.xml"
    if sitemap_path.exists():
        try:
            root = ET.parse(sitemap_path).getroot()
        except ET.ParseError as exc:
            fail(errors, f"sitemap.xml: invalid XML: {exc}")
        else:
            ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
            urls = {elem.text.strip() for elem in root.findall("s:url/s:loc", ns) if elem.text}
            expected_urls = set(EXPECTED_CANONICALS.values())
            if urls != expected_urls:
                fail(errors, f"sitemap.xml: URLs must match public HTML canonicals (got {sorted(urls)})")

    if errors:
        print(f"SITE VALIDATION FAILED ({len(errors)} issue(s))")
        for item in errors:
            print(f"- {item}")
        return 1

    print(f"SITE VALIDATION PASS — {len(REQUIRED_HTML)} public pages, metadata, links, fragments, assets, robots and sitemap verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
