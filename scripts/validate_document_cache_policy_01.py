#!/usr/bin/env python3
"""AUTH-SESSION-CONTINUITY-P0-02 — HTML documents must never be reused stale.

Every document names its scripts with the release asset token (?v=aset-...),
so a stale document runs stale JavaScript. Without Cache-Control, browsers kept
documents by heuristic and reused them on tab restore/Back without asking, and
a phone went on running a pre-fix /auth/callback/. This check fails closed if
the nginx template stops sending:

* no-store on the login callback/start documents (and the iOS social return),
* no-cache on every other HTML document and on site-asset-version.json,
* nothing at all on versioned assets (their URL already changes per release).

It evaluates the template's own `map` the way nginx does: exact strings first,
then regexes in order, then the default.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "nginx/default.conf.template"


def parse_map(text: str) -> tuple[dict[str, str], list[tuple[re.Pattern[str], str]], str]:
    match = re.search(r"map \$uri \$lotbi_document_cache_control \{(.*?)\n\}", text, re.S)
    if not match:
        raise SystemExit("nginx template: map $uri $lotbi_document_cache_control is missing")
    exact: dict[str, str] = {}
    regexes: list[tuple[re.Pattern[str], str]] = []
    default = None
    for raw in match.group(1).splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        entry = re.fullmatch(r'(\S+)\s+"([^"]*)";', line)
        if not entry:
            raise SystemExit(f"nginx template: unparsable map entry: {line}")
        key, value = entry.groups()
        if key == "default":
            default = value
        elif key.startswith("~"):
            regexes.append((re.compile(key[1:]), value))
        else:
            exact[key] = value
    if default is None:
        raise SystemExit("nginx template: map has no default")
    return exact, regexes, default


def resolve(uri: str, exact, regexes, default) -> str:
    if uri in exact:
        return exact[uri]
    for pattern, value in regexes:
        if pattern.search(uri):
            return value
    return default


def main() -> int:
    text = TEMPLATE.read_text(encoding="utf-8")
    errors: list[str] = []
    exact, regexes, default = parse_map(text)
    if default != "":
        errors.append("map default must send no header (versioned assets keep their behaviour)")

    server = text[text.index("server {"):]
    if not re.search(r"^\s{4}add_header Cache-Control \$lotbi_document_cache_control;", server, re.M):
        errors.append("server block must add_header Cache-Control $lotbi_document_cache_control")
    # add_header in a location would silently drop the server-level header there.
    for location in re.finditer(r"location[^{]*\{([^}]*)\}", server):
        if "add_header" in location.group(1):
            errors.append(f"a location block declares add_header and would drop the cache policy: {location.group(0)[:80]}")

    # $uri as nginx sees it at response time (after index/try_files).
    expectations = {
        "/auth/callback/index.html": "no-store",
        "/auth/callback/": "no-store",
        "/auth/callback": "no-store",
        "/auth/start/index.html": "no-store",
        "/app/open/auth/social-return/index.html": "no-store",
        "/app/open/auth/social-return": "no-store",
        "/index.html": "no-cache",
        "/": "no-cache",
        "/terms.html": "no-cache",
        "/terms": "no-cache",
        "/privacy": "no-cache",
        "/feedback.html": "no-cache",
        "/404.html": "no-cache",
        "/kakao-navi.html": "no-cache",
        "/site-asset-version.json": "no-cache",
        "/site-auth.js": "",
        "/auth-callback.js": "",
        "/site-conversation.css": "",
        "/assets/brand/lotbi-lockup-160w.png": "",
        "/avatar-runtime/runtime/controller.mjs": "",
        "/.well-known/apple-app-site-association": "",
        "/auth/callbackx": "",
    }
    for uri, expected in expectations.items():
        actual = resolve(uri, exact, regexes, default)
        if actual != expected:
            errors.append(f"{uri}: expected Cache-Control {expected or '(none)'!r}, template gives {actual or '(none)'!r}")

    # Every shipped HTML document resolves to a revalidating policy.
    for html in sorted(ROOT.rglob("*.html")):
        rel = html.relative_to(ROOT)
        if rel.parts[0] in {".git", "node_modules", "scripts", "docs", "tools", "vendor"}:
            continue
        uri = "/" + rel.as_posix()
        if resolve(uri, exact, regexes, default) not in {"no-cache", "no-store"}:
            errors.append(f"{uri}: shipped HTML document has no revalidating Cache-Control")

    if errors:
        for error in errors:
            print(f"FAIL {error}", file=sys.stderr)
        return 1
    print(f"DOCUMENT-CACHE-POLICY-01 PASS ({len(expectations)} URIs, html documents revalidate)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
