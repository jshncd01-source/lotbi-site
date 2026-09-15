#!/usr/bin/env python3
"""Fail-closed guardrails for the hardened LOTBI public site.

Approved legal/support pages, account URLs and official assets remain locked. The
SITE-HOME-NAV-01 local interaction script may operate the drawer and ephemeral
textarea only; Chat/Core networking, browser persistence and fake data remain forbidden.
"""
from __future__ import annotations

import hashlib
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOGIN_URL = "https://account.lotbiai.com/"
SIGNUP_URL = "https://account.lotbiai.com/signup"
LOCKED_SHA256 = {
    'privacy.html': 'f6e94c5fa6730cf10dd4e1a591da2d596f88f9ce2e98bbe54195f7386b035963',
    'terms.html': 'de0dc05c6250f229442d53da55a3610e003f73c89c86043ccb36e80cfda129c4',
    'account-deletion.html': '1b3c9fb3d15f4cdb7a3bb123362827b19cc79e35eae8e8d33efcde7d6c09f090',
    'contact.html': 'f4c618fade0a17d16a1484372c8c4681b3479a502b8ef5719b13855d5a97acae',
    'assets/lotbi-main-logo.png': '054a17a588b13cd20d676095aaf3001665b931929143c0a41083a0ed8c7d9063',
    'assets/lotbi-og-share.png': 'd25d8a7536d6dda0005236e2976199ea144ca0faddc738ab307d8a471a37869e',
    'styles.css': 'a90b17287a1001f3cd48d9149349d6c03be2735e13bb5c4d2609de6faf2d2bcd',
}


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
    home_js_path = ROOT / "home-shell.js"
    home_js = home_js_path.read_text(encoding="utf-8") if home_js_path.exists() else ""

    for url, label in ((LOGIN_URL, "login"), (SIGNUP_URL, "signup")):
        if url not in index:
            errors.append(f"{label} URL changed or missing")

    if index.lower().count("<script") != 1 or '<script src="home-shell.js" defer></script>' not in index:
        errors.append("only the approved local home-shell.js script may run on the home page")

    combined = f"{index}\n{home_js}".lower()
    forbidden = (
        "fetch(",
        "xmlhttprequest",
        "websocket",
        "eventsource",
        "sendbeacon",
        "localstorage",
        "sessionstorage",
        "indexeddb",
        "document.cookie",
        "mock ai",
        "mock-ai",
        "fake production",
    )
    for token in forbidden:
        if token in combined:
            errors.append(f"forbidden network/persistence/fake behavior token: {token}")

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

    if "calc(clamp(24px, 7vh, 52px) + 28px)" not in css:
        errors.append("short mobile breakpoint must preserve the approved downward character offset")

    if errors:
        print(f"PUBLIC HARDENING VALIDATION FAILED ({len(errors)} issue(s))")
        for error in errors:
            print(f"- {error}")
        return 1

    print("PUBLIC HARDENING VALIDATION PASS — legal/support locks, account URLs, local-only interaction, responsive/a11y compatibility and performance contracts verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
