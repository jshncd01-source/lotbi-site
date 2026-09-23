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
# Relocked privacy.html and terms.html for the footer business-information block.
# 전자상거래법 제10조제1항이 요구하는 표시사항 중 전화번호·전자우편주소·호스팅서비스
# 제공자 상호가 빠져 있어 세 페이지에 같은 블록으로 추가했다. 본문 조항은 한 줄도
# 바뀌지 않았고, 추가된 것은 푸터 사업자 정보 블록의 행 세 개뿐이다. 블록 자체는 이제
# scripts/sync_footer_business_info.py 가 한 곳에서 소유하며 CI 가 드리프트를 잡는다.
# SITE-DARK-BRAND-SURFACES-01 — styles.css's hash moved for exactly one rule,
# .skip-link, and exactly two declarations inside it: background and color now
# read semantic tokens with the old raw values kept as fallbacks, so the
# always-light pages that never load site-theme-tokens.css are unchanged. The
# keyboard skip target was #182a46 on #151922, 1.22:1 — present but unseeable.
# Verified with `git diff --unified=0` and again by stripping /* */ from both
# revisions: no other declaration in the file moved.
# SITE-PRIVACY-OVERSEAS-TRANSFER-01 — privacy.html 과 styles.css 의 해시가 함께
# 움직였다. 개인정보 보호법 제28조의8 국외이전 고지표를 제6조 6.1 로 넣었기
# 때문이다. 네이버 동의 화면에는 "[필수] 개인정보 국외 이전 동의" 항목이 떠
# 있는데 제6조에는 "발생하는 경우 안내하겠다"는 장래형 문구뿐이어서 검수가
# 막혀 있었다. privacy.html 은 기존 조항을 한 줄도 지우지 않았고 — `git diff`
# 에 삭제 라인 0 개 — 제6조 끝과 제7조 사이에만 6.1 블록이 들어갔다. 11 개
# 조항 번호와 본문은 그대로다. styles.css 는 파일 끝에 .legal-table 규칙만
# 덧붙었고 기존 선택자는 한 줄도 건드리지 않았다.
# 이 표는 7 열이라 900px 본문 폭에 들어가지 않는다. 거부 방법 열이 검수자가
# 바로 봐야 하는 열이므로 가로 스크롤 뒤에 숨기지 않고 표만 본문 폭 밖으로
# 넓혔고, 390px 에서는 각 행이 data-label 을 단 카드로 쌓인다.
# 주의: privacy.html 본문이 바뀌었으므로 scripts/emit_social_signup_legal_manifest.py
# 가 내보내는 LOTBI_SOCIAL_PRIVACY_SHA256 도 함께 바뀐다. lotbi-core 에 등록된
# 동의 증빙 SHA 를 배포 후 갱신해야 실제 문서와 맞는다.
LOCKED_SHA256 = {
    'privacy.html': '5b0b533c078c7d5fbcb47974df27355ee81edcc23b77b57461413c3777ee6e33',
    'terms.html': '252d2264ae4cf9465f6b523e7be6c3b2f55c81791f7b011ccced495c1ea3462b',
    'account-deletion.html': 'c0b1710b47a8805063443fd286c9d903c90ede33a3f26073568e869a26a28706',
    'contact.html': 'a17d7632a221028dcd9989a5ab93c7b5a16d0ccd77e6df20b1195793ad9c2b47',
    'assets/lotbi-main-logo.png': '054a17a588b13cd20d676095aaf3001665b931929143c0a41083a0ed8c7d9063',
    'assets/lotbi-og-share.png': 'd25d8a7536d6dda0005236e2976199ea144ca0faddc738ab307d8a471a37869e',
    'styles.css': '6c7508831330c67a4886e515cbe1ff57b69beaf8f99968b4f60a7d3ddfa10129',
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


def extract_theme_bootstrap(index: str) -> str | None:
    """Return the allowlisted pre-paint theme bootstrap block, or None."""
    marker = "SITE-THEME-BOOTSTRAP-FIRST-PAINT-01"
    if marker not in index:
        return None
    start = index.index("<script>", index.index(marker))
    end = index.index("</script>", start) + len("</script>")
    return index[start:end]


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
    footer_legal_script = re.search(
        r'<script type="module" src="site-footer-legal\.js\?v=[^"]+"></script>',
        index,
    )
    approved_scripts = (
        '<script type="importmap">',
        '<script src="home-shell.js?v=20260920-fold5" defer></script>',
        '<script src="mobile-entry.js?v=20260923-darklogo1" defer></script>',
        conversation_script.group(0) if conversation_script else "__missing_conversation_module__",
        continuity_script.group(0) if continuity_script else "__missing_continuity_module__",
        '<script type="module" src="site-avatar.js"></script>',
        footer_legal_script.group(0) if footer_legal_script else "__missing_footer_legal_module__",
    )
    # +1 for the allowlisted inline theme bootstrap verified above.
    if index.lower().count("<script") != len(approved_scripts) + 1 or any(script not in index for script in approved_scripts):
        errors.append("home page may run only approved one sealed Avatar import map plus approved home-shell.js, mobile-entry.js, site-conversation.js, site-continuity.js, site-avatar.js and site-footer-legal.js scripts")

    # SITE-THEME-BOOTSTRAP-FIRST-PAINT-01 — one inline block in <head> is allowed
    # to read localStorage, because the theme has to be known before the first
    # paint and nothing deferred can do that. It is allowlisted rather than the
    # rule being weakened: the block is pinned below, and everything outside it
    # is still scanned for the same tokens.
    theme_bootstrap = extract_theme_bootstrap(index)
    if theme_bootstrap is None:
        errors.append("the pre-paint theme bootstrap block is missing from index.html")
    else:
        if "getitem" not in theme_bootstrap.lower() or "setitem" in theme_bootstrap.lower():
            errors.append("the pre-paint theme bootstrap must only read storage, never write it")
        if "lotbi.site.theme.bootstrap.v1" not in theme_bootstrap:
            errors.append("the pre-paint theme bootstrap must touch only the theme key")
        for token in ("fetch(", "xmlhttprequest", "websocket", "eventsource", "sendbeacon",
                      "indexeddb", "document.cookie", "sessionstorage"):
            if token in theme_bootstrap.lower():
                errors.append(f"the pre-paint theme bootstrap must not reach for {token}")
        if "try" not in theme_bootstrap or "catch" not in theme_bootstrap:
            errors.append("the pre-paint theme bootstrap must not let a storage failure stop the render")

    scanned_index = index.replace(theme_bootstrap, "") if theme_bootstrap else index
    combined_home = f"{scanned_index}\n{home_js}".lower()
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
