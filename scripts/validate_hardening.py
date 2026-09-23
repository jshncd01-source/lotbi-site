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
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOGIN_URL = "/auth/start/"
SIGNUP_URL = "https://account.lotbiai.com/signup"
ACCOUNT_URL = "https://account.lotbiai.com/account"
# SITE-BRAND-LOGO-THEME-AWARE-01 — the four legal pages' hashes moved because
# each one dropped the <picture><source media="(prefers-color-scheme: dark)">
# from its header logo. These pages have no dark surface (styles.css carries no
# prefers-color-scheme block), so the OS-driven source put the white wordmark on
# #f7f8fb for every dark-OS visitor. One line changed per file, in the header
# only; no legal text was touched. Verified with `git diff --unified=0`.
# SITE-DARK-CONVERSATION-LIST-CONTRAST-01 — styles.css's hash moved for a
# comment only: a note at the raw --brand-* definitions saying they have no Dark
# form and that new screens should take a semantic token instead. Verified
# comment-only by stripping /* */ from both revisions and comparing; no
# declaration changed.
# SITE-DARK-BRAND-SURFACES-01 — styles.css's hash moved for exactly one rule,
# .skip-link, and exactly two declarations inside it: background and color now
# read semantic tokens with the old raw values kept as fallbacks, so the
# always-light pages that never load site-theme-tokens.css are unchanged. The
# keyboard skip target was #182a46 on #151922, 1.22:1 — present but unseeable.
# Verified with `git diff --unified=0` and again by stripping /* */ from both
# revisions: no other declaration in the file moved.
LOCKED_SHA256 = {
    'privacy.html': '4c9276d5dd0c3f3d3ce6e8c9c3ec2b5907292f9d7416170af76f9f4516c3eaad',
    'terms.html': 'ed2b6852a836ab50a3f97ddd970501a763091c946f2c70b8bfb0b5f2c50a9abc',
    'account-deletion.html': 'c0b1710b47a8805063443fd286c9d903c90ede33a3f26073568e869a26a28706',
    'contact.html': 'a17d7632a221028dcd9989a5ab93c7b5a16d0ccd77e6df20b1195793ad9c2b47',
    'assets/lotbi-main-logo.png': '054a17a588b13cd20d676095aaf3001665b931929143c0a41083a0ed8c7d9063',
    'assets/lotbi-og-share.png': 'd25d8a7536d6dda0005236e2976199ea144ca0faddc738ab307d8a471a37869e',
    'styles.css': 'e52fe30dbf6f3a55f24d69f692bf32a1ec57f9f20311eebf7b2e86464ce06b3c',
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

    conversation_script = re.search(
        r'<script type="module" src="site-conversation\.js\?v=[^"]+"></script>',
        index,
    )
    continuity_script = re.search(
        r'<script type="module" src="site-continuity\.js\?v=[^"]+"></script>',
        index,
    )
    approved_scripts = (
        '<script type="importmap">',
        '<script src="home-shell.js?v=20260920-fold5" defer></script>',
        '<script src="mobile-entry.js?v=20260923-darklogo1" defer></script>',
        conversation_script.group(0) if conversation_script else "__missing_conversation_module__",
        continuity_script.group(0) if continuity_script else "__missing_continuity_module__",
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
    if not conversation_script:
        errors.append("approved cache-busted conversation module missing from home")
    if not continuity_script:
        errors.append("approved cache-busted authenticated continuity module missing from home")

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
