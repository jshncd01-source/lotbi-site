#!/usr/bin/env python3
"""Fail-closed guardrails for the hardened LOTBI public site.

Approved legal/support page content, account URLs and official assets remain locked.
The mobile entry batch may add only the approved chooser CSS/JS bootstrap to those
pages. The home shell remains isolated from networking; the separately validated
site-conversation.js and site-continuity.js modules own the approved Core
conversation/handoff and authenticated continuity runtimes.
"""
from __future__ import annotations

import hashlib
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOGIN_URL = "/auth/start/"
SIGNUP_URL = "https://account.lotbiai.com/signup"
ACCOUNT_URL = "https://account.lotbiai.com/account"
LOCKED_SHA256 = {
    'privacy.html': 'cf81c57db0d2cedc30e346bdb785795f3025952ad70dffa1bfb35ab902f3dcd9',
    'terms.html': 'e2be394aed55fd177d20392b55d85686430e588e27515c6736de7363cb940b56',
    'account-deletion.html': '1cd566f3aabf901c8f9a793877896944b50a7c1c4eda0314951f1b2e29095bef',
    'contact.html': 'e752e8f43147540db4aede230a6bdd820f8d49774aac16ca09e728abef2280f5',
    'assets/lotbi-main-logo.png': '054a17a588b13cd20d676095aaf3001665b931929143c0a41083a0ed8c7d9063',
    'assets/lotbi-og-share.png': 'd25d8a7536d6dda0005236e2976199ea144ca0faddc738ab307d8a471a37869e',
    'styles.css': 'b35156b807d4bb18ba1cdc104371135f64f9a7bd0f15f9d8f2031a065e92888f',
}
CHOOSER_BOOTSTRAP = '  <link rel="stylesheet" href="mobile-entry.css" />\n  <script src="mobile-entry.js" defer></script>\n'


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def locked_bytes(rel: str, path: Path) -> bytes:
    if rel.endswith('.html'):
        text = path.read_text(encoding='utf-8')
        if CHOOSER_BOOTSTRAP not in text:
            return text.encode('utf-8')
        return text.replace(CHOOSER_BOOTSTRAP, '', 1).encode('utf-8')
    return path.read_bytes()


def main() -> int:
    errors: list[str] = []

    for rel, expected in LOCKED_SHA256.items():
        path = ROOT / rel
        if not path.exists():
            errors.append(f"locked file missing: {rel}")
            continue
        actual = sha256_bytes(locked_bytes(rel, path))
        if actual != expected:
            errors.append(f"locked file changed outside approved chooser bootstrap: {rel} ({actual})")

    index = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "site-hardening.css").read_text(encoding="utf-8")
    auth_css = (ROOT / "site-auth-continuity.css").read_text(encoding="utf-8")
    home_js = (ROOT / "home-shell.js").read_text(encoding="utf-8")
    mobile_js = (ROOT / "mobile-entry.js").read_text(encoding="utf-8")
    continuity_js = (ROOT / "site-continuity.js").read_text(encoding="utf-8")

    for url, label in ((LOGIN_URL, "login"), (SIGNUP_URL, "signup")):
        if url not in continuity_js:
            errors.append(f"{label} URL changed or missing from approved continuity runtime")
    if ACCOUNT_URL in continuity_js:
        errors.append("authenticated profile must not navigate to the full-page Account surface")

    account_start = index.find('<nav class="account-actions"')
    account_end = index.find('</nav>', account_start)
    initial_account = index[account_start:account_end] if account_start >= 0 and account_end >= 0 else ""
    if not initial_account:
        errors.append("initial account-actions markup missing")
    else:
        for required in ('data-auth-state="checking"', 'aria-busy="true"', 'account-auth-placeholder'):
            if required not in initial_account:
                errors.append(f"neutral initial account state missing: {required}")
        for forbidden in (">로그인<", ">회원가입<", ">내 계정<", ">프로필<"):
            if forbidden in initial_account:
                errors.append(f"initial checking account state exposes premature account UI: {forbidden}")

    approved_scripts = (
        '<script type="importmap">',
        '<script src="home-shell.js?v=20260920-fold5" defer></script>',
        '<script src="mobile-entry.js?v=20260920-homefirst1" defer></script>',
        '<script type="module" src="site-conversation.js?v=20260920-convcalentry1"></script>',
        '<script type="module" src="site-continuity.js?v=20260920-authux1"></script>',
        '<script type="module" src="site-avatar.js"></script>',
    )
    if index.lower().count("<script") != len(approved_scripts) or any(script not in index for script in approved_scripts):
        errors.append("home page may run only approved one sealed Avatar import map plus approved home-shell.js, mobile-entry.js, site-conversation.js, site-continuity.js and site-avatar.js scripts")

    combined_home = f"{index}\n{home_js}".lower()
    forbidden_home = (
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
    for token in forbidden_home:
        if token in combined_home:
            errors.append(f"forbidden home-shell network/persistence/fake behavior token: {token}")

    forbidden_mobile = (
        "fetch(",
        "xmlhttprequest",
        "websocket",
        "eventsource",
        "sendbeacon",
        "localstorage",
        "indexeddb",
        "document.cookie",
        "authorization:",
        "bearer ",
        "client_secret",
        "mock ai",
        "fake production",
        "atglife://product/",
    )
    for token in forbidden_mobile:
        if token in mobile_js.lower():
            errors.append(f"forbidden chooser network/secret/durable-persistence token: {token}")

    for token in (
        "const LOTBI_APP_LINK_READY = true",
        "const LOTBI_ANDROID_APP_LINK_READY = true",
        "const LOTBI_IOS_APP_LINK_READY = false",
        "const LOTBI_ANDROID_STORE_URL = null",
        "const LOTBI_IOS_STORE_URL = null",
        "data-lotbi-app-choice",
        "LOTBI 앱을 열지 못했어요",
        "sessionStorage",
        "WEB_CHOICE_TTL_MS",
        "'/app/open'",
    ):
        if token not in mobile_js:
            errors.append(f"missing chooser app-open/security contract: {token}")

    state_tokens = (
        'id="chat-state-region"',
        'data-chat-state="loading"',
        'data-chat-state="unavailable"',
        'data-chat-state="error"',
        'hidden',
    )
    for token in state_tokens:
        if token not in index:
            errors.append(f"missing conversation state contract: {token}")

    if 'href="site-hardening.css?v=20260920-attachments1"' not in index:
        errors.append("hardening stylesheet is not linked after approved home stylesheet")
    if 'href="site-auth-continuity.css"' not in index:
        errors.append("authenticated continuity stylesheet missing from home")
    if 'href="mobile-entry.css"' not in index:
        errors.append("mobile chooser stylesheet missing from home")
    if 'src="site-conversation.js?v=20260920-convcalentry1"' not in index:
        errors.append("approved conversation module missing from home")
    if 'src="site-continuity.js?v=20260920-authux1"' not in index:
        errors.append("approved authenticated continuity module missing from home")

    for token in (
        ".account-auth-placeholder",
        "min-width: 174px",
        "min-width: 132px",
        "var(--brand-line)",
    ):
        if token not in auth_css:
            errors.append(f"missing layout-safe auth continuity style: {token}")

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

    print("PUBLIC HARDENING VALIDATION PASS — locked content, neutral initial auth state, Site-origin auth start, isolated home shell, chooser boundaries, approved conversation/continuity modules, responsive/a11y compatibility and performance contracts verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
