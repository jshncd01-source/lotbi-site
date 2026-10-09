#!/usr/bin/env python3
"""Emit non-secret Social Signup legal manifest values for reviewed Site HTML.

The SHA-256 identifies the legal document, not one deployment of it. Every
Site release rewrites the cache tokens (``?v=aset-...``) in the page head, so
the raw bytes change on each deploy while the policy text does not. The digest
is therefore taken over the canonical document, using exactly the
normalization ``scripts/validate_hardening.py`` applies to its legal-page locks:

1. read as UTF-8 with universal newlines (CRLF/CR -> LF);
2. remove asset cache tokens: ``(\\.(?:js|mjs|css))\\?v=[A-Za-z0-9._-]+`` -> ``\\1``;
3. remove the approved chooser bootstrap block once, if present;
4. SHA-256 of the result encoded as UTF-8.

The digest changes only when the locked document itself changes (and the
hardening lock is re-pinned), never because of a new asset token.

Usage:
  python scripts/emit_social_signup_legal_manifest.py
      print the env values for Core (LOTBI_SOCIAL_{TERMS,PRIVACY}_*)
  python scripts/emit_social_signup_legal_manifest.py --check-served https://lotbiai.com
      fetch the served pages and confirm their canonical digest equals the repo's
"""
from __future__ import annotations

import argparse
import hashlib
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

ASSET_TOKEN = re.compile(r'(\.(?:js|mjs|css))\?v=[A-Za-z0-9._-]+')
CHOOSER_BOOTSTRAP = '  <link rel="stylesheet" href="mobile-entry.css" />\n  <script src="mobile-entry.js" defer></script>\n'

DOCS = (
    (
        "TERMS",
        "LOTBI_TERMS_2026-10-08_R1",
        ROOT / "terms.html",
        "https://lotbiai.com/terms",
    ),
    (
        "PRIVACY",
        "LOTBI_PRIVACY_2026-09-24_R1",
        ROOT / "privacy.html",
        "https://lotbiai.com/privacy",
    ),
)


def canonical_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = ASSET_TOKEN.sub(r"\1", text)
    return text.replace(CHOOSER_BOOTSTRAP, "", 1)


def canonical_digest(text: str) -> str:
    return hashlib.sha256(canonical_text(text).encode("utf-8")).hexdigest()


def repo_digest(path: Path) -> str:
    return canonical_digest(path.read_text(encoding="utf-8"))


def emit() -> None:
    for label, version, path, uri in DOCS:
        print(f"LOTBI_SOCIAL_{label}_VERSION={version}")
        print(f"LOTBI_SOCIAL_{label}_SHA256={repo_digest(path)}")
        print(f"LOTBI_SOCIAL_{label}_URI={uri}")


def check_served(base: str) -> int:
    failures = 0
    for label, _version, path, uri in DOCS:
        served_url = base.rstrip("/") + "/" + uri.rsplit("/", 1)[-1]
        with urllib.request.urlopen(served_url, timeout=20) as response:  # noqa: S310 - https origin given by the operator
            served = response.read().decode("utf-8")
        expected = repo_digest(path)
        actual = canonical_digest(served)
        status = "MATCH" if actual == expected else "MISMATCH"
        failures += status != "MATCH"
        print(f"{label} {status} served={actual} repo={expected} url={served_url}")
    return 1 if failures else 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check-served", metavar="BASE_URL")
    args = parser.parse_args()
    if args.check_served:
        return check_served(args.check_served)
    emit()
    return 0


if __name__ == "__main__":
    sys.exit(main())
