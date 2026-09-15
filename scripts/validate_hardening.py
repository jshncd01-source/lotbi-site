#!/usr/bin/env python3
"""Fail-closed guardrails for public-site hardening work.

This batch must not alter approved legal/support pages, account URLs, or simulate
Chat/Core behavior. It also checks compatibility, accessibility, responsive and performance
contracts used by the approved conversational home.
"""
from __future__ import annotations

import hashlib
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOGIN_URL = "https://account.lotbiai.com/"
SIGNUP_URL = "https://account.lotbiai.com/signup"
LOCKED_SHA256 = {'privacy.html': 'f6e94c5fa6730cf10dd4e1a591da2d596f88f9ce2e98bbe54195f7386b035963', 'terms.html': 'de0dc05c6250f229442d53da55a3610e003f73c89c86043ccb36e80cfda129c4', 'account-deletion.html': '1b3c9fb3d15f4cdb7a3bb123362827b19cc79e35eae8e8d33efcde7d6c09f090', 'contact.html': 'f4c618fade0a17d16a1484372c8c4681b3479a502b8ef5719b13855d5a97acae', 'assets/lotbi-main-logo.png': '054a17a588b13cd20d676095aaf3001665b931929143c0a41083a0ed8c7d9063', 'assets/lotbi-og-share.png': 'd25d8a7536d6dda0005236e2976199ea144ca0faddc738ab307d8a471a37869e', 'home-chat.css': '8b2c88028cc62e9acf1635ab12949d9ac1e4d8dfbac86c57819dda2b6d39fedd', 'styles.css': 'a90b17287a1001f3cd48d9149349d6c03be2735e13bb5c4d2609de6faf2d2bcd', 'scripts/validate_home_chat.py': '1f51264d497f781be097401b23eed7c2d511a638e42583d24197bcdeeb86895f'}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    errors: list[str] = []

    for rel, expected in LOCKED_SHA256.items():
        path = ROOT / rel
        if not path.exists():
            errors.append(f"locked file missing: {rel}")
            continue
        actual = sha256(path)
        if actual != expected:
            errors.append(f"locked file changed: {rel} ({actual})")

    index = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "site-hardening.css").read_text(encoding="utf-8")

    for url, label in ((LOGIN_URL, "login"), (SIGNUP_URL, "signup")):
        if url not in index:
            errors.append(f"{label} URL changed or missing")

    forbidden = ("<script", "fetch(", "XMLHttpRequest", "WebSocket", "mock AI", "mock-ai")
    lowered = index.lower()
    for token in forbidden:
        if token.lower() in lowered:
            errors.append(f"forbidden production-chat behavior token: {token}")

    state_tokens = (
        'id="chat-state-region"',
        'data-chat-state="loading"',
        'data-chat-state="unavailable"',
        'data-chat-state="error"',
        'hidden',
    )
    for token in state_tokens:
        if token not in index:
            errors.append(f"missing non-active state contract: {token}")

    if 'href="site-hardening.css"' not in index:
        errors.append("hardening stylesheet is not linked after approved home stylesheet")

    perf_tokens = (
        'width="1535"',
        'height="697"',
        'decoding="async"',
        'fetchpriority="high"',
    )
    for token in perf_tokens:
        if token not in index:
            errors.append(f"missing character performance contract: {token}")

    css_tokens = (
        "100dvh",
        "safe-area-inset-left",
        "prefers-reduced-motion",
        "prefers-contrast",
        "forced-colors",
        "max-height: 740px",
        "orientation: landscape",
        "content-visibility: auto",
        "contain-intrinsic-size",
    )
    for token in css_tokens:
        if token not in css:
            errors.append(f"missing compatibility/a11y CSS contract: {token}")

    if errors:
        print(f"PUBLIC HARDENING VALIDATION FAILED ({len(errors)} issue(s))")
        for error in errors:
            print(f"- {error}")
        return 1

    print("PUBLIC HARDENING VALIDATION PASS — legal/support locks, account URLs, state contracts, responsive/a11y compatibility and performance contracts verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
