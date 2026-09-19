#!/usr/bin/env python3
"""Fail-closed contract checks for the LOTBI conversational home shell.

The shell remains responsible for accessible navigation and input UX. Real
conversation networking is isolated to the separately validated
site-conversation.js module; authenticated continuity is isolated to the
approved site-continuity.js module; home-shell.js itself remains free of
network and persistence behavior. The approved mobile-entry.js bootstrap may coexist.
"""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
HOME_CSS = ROOT / "home-chat.css"
SIDEBAR_CSS = ROOT / "site-sidebar-nav.css"
AVATAR_CSS = ROOT / "site-avatar.css"
AVATAR_JS = ROOT / "site-avatar.js"
HOME_JS = ROOT / "home-shell.js"
CONTINUITY_JS = ROOT / "site-continuity.js"
LOGIN_URL = "/auth/start/"
SIGNUP_URL = "https://account.lotbiai.com/signup"
ACCOUNT_URL = "https://account.lotbiai.com/account"
CONNECTED_SERVICES_URL = "https://account.lotbiai.com/external-identities"


def slice_between(text: str, start_token: str, end_token: str) -> str:
    start = text.find(start_token)
    if start < 0:
        return ""
    end = text.find(end_token, start)
    if end < 0:
        return ""
    return text[start:end + len(end_token)]


def main() -> int:
    errors: list[str] = []

    for path, label in (
        (INDEX, "index.html"),
        (HOME_CSS, "home-chat.css"),
        (SIDEBAR_CSS, "site-sidebar-nav.css"),
        (AVATAR_CSS, "site-avatar.css"),
        (AVATAR_JS, "site-avatar.js"),
        (HOME_JS, "home-shell.js"),
        (CONTINUITY_JS, "site-continuity.js"),
    ):
        if not path.exists() or path.stat().st_size == 0:
            errors.append(f"missing or empty {label}")

    text = INDEX.read_text(encoding="utf-8") if INDEX.exists() else ""
    script = HOME_JS.read_text(encoding="utf-8") if HOME_JS.exists() else ""
    continuity = CONTINUITY_JS.read_text(encoding="utf-8") if CONTINUITY_JS.exists() else ""
    sidebar_css = SIDEBAR_CSS.read_text(encoding="utf-8") if SIDEBAR_CSS.exists() else ""

    requirements = {
        "approved LOTBI character asset": 'src="assets/lotbi-main-logo.png"',
        "approved LOTBI sidebar logo asset": 'src="/assets/lotbi-logo-header.png"',
        "prompt textarea": 'id="lotbi-prompt"',
        "prompt no-persistence hint": 'autocomplete="off"',
        "prompt length boundary": 'maxlength="1000"',
        "microphone control": "mic-button",
        "send control": "send-button",
        "conversation thread": 'id="conversation-thread"',
        "local navigation script": 'src="home-shell.js"',
        "approved mobile entry runtime": 'src="mobile-entry.js?v=20260920-homefirst1"',
        "approved 3D Avatar module": 'src="site-avatar.js"',
        "approved 3D Avatar stylesheet": 'href="site-avatar.css"',
        "approved 3D Avatar stage": "data-lotbi-avatar-stage",
        "approved static Avatar fallback": "data-lotbi-avatar-fallback",
        "approved conversation module": 'src="site-conversation.js?v=20260920-richcards1"',
        "approved continuity module": 'src="site-continuity.js?v=20260920-logincta2"',
        "auth continuity stylesheet": 'href="site-auth-continuity.css"',
        "sidebar navigation stylesheet": 'href="site-sidebar-nav.css?v=20260919-homewordmark5"',
        "anonymous initial auth state": 'data-auth-state="unauthenticated"',
        "anonymous login CTA": '>로그인<',
        "anonymous signup CTA": '>회원가입<',
        "desktop sidebar": "chat-sidebar-desktop",
        "desktop sidebar nav": "sidebar-nav-desktop",
        "desktop recent scroll": "sidebar-history-scroll",
        "account footer": "sidebar-account-footer",
        "mobile menu toggle": "data-mobile-nav-open",
        "mobile drawer": 'id="mobile-nav-drawer"',
        "new chat menu": "+ 새 대화",
        "work menu": "내 작업",
        "library menu": "라이브러리",
        "connected services menu": "연결 서비스",
        "recent conversations": "최근 대화",
        "connected services URL": CONNECTED_SERVICES_URL,
        "live handoff boundary": "메시지를 입력하면 LOTBI와 대화를 시작합니다.",
        "Company link": "about.html",
        "Privacy link": "privacy.html",
        "Terms link": "terms.html",
        "Account deletion link": "account-deletion.html",
        "Contact link": "contact.html",
        "home stylesheet": 'href="home-chat.css"',
        "chooser stylesheet": 'href="mobile-entry.css"',
    }
    for label, token in requirements.items():
        if token not in text:
            errors.append(f"index.html: missing {label}")

    if text.count('src="/assets/lotbi-logo-header.png"') != 3:
        errors.append("index.html: desktop sidebar, mobile topbar and mobile drawer must share the official logo asset")
    for forbidden in ("brand-text-logo", "brand-o", "lotbi-logo-horizontal", "lotbi-logo-official-d3b499fe546c.jpg", "lotbi-logo-official-color.jpg", "lotbi-logo-official-color-d3b499fe546c.jpg", "lotbi-logo-official-color-727a1940b747.png"):
        if forbidden in text:
            errors.append(f"index.html: legacy/text-only logo reference must not render: {forbidden}")

    for url, label in ((LOGIN_URL, "login"), (SIGNUP_URL, "signup")):
        if url not in continuity:
            errors.append(f"site-continuity.js: {label} URL changed or missing")
    if ACCOUNT_URL in continuity:
        errors.append("site-continuity.js: authenticated profile must open in-page instead of navigating to Account")

    account_start = text.find('<nav class="account-actions"')
    account_end = text.find('</nav>', account_start)
    initial_account = text[account_start:account_end] if account_start >= 0 and account_end >= 0 else ""
    if not initial_account:
        errors.append("index.html: initial account-actions markup not found")
    else:
        for required in (">로그인<", ">회원가입<"):
            if required not in initial_account:
                errors.append(f"index.html: initial anonymous auth state missing CTA ({required})")
        if ">내 계정<" in initial_account or ">프로필<" in initial_account:
            errors.append("index.html: initial anonymous auth state must not claim authentication")

    desktop_sidebar = slice_between(
        text,
        '<aside class="chat-sidebar chat-sidebar-desktop"',
        '</aside>',
    )
    mobile_drawer = slice_between(
        text,
        'id="mobile-nav-drawer"',
        '</aside>',
    )
    if not desktop_sidebar:
        errors.append("index.html: desktop sidebar block not found")
    if not mobile_drawer:
        errors.append("index.html: mobile drawer block not found")

    for label, block in (("desktop sidebar", desktop_sidebar), ("mobile drawer", mobile_drawer)):
        for forbidden in (
            "주문 내역",
            "예약 내역",
            ">내 계정<",
            ">설정<",
            "도움말 / 문의",
            ">오늘<",
            ">어제<",
            ">최근 7일<",
            ">이전<",
            "비어 있음",
            ">준비<",
            "준비 중",
        ):
            if forbidden in block:
                errors.append(f"index.html: {label} exposes removed or fake navigation copy: {forbidden}")

        for required in ("+ 새 대화", "내 작업", "라이브러리", "연결 서비스", "최근 대화"):
            if required not in block:
                errors.append(f"index.html: {label} missing approved IA item: {required}")

        if CONNECTED_SERVICES_URL not in block:
            errors.append(f"index.html: {label} must use authoritative Account Web connected-services route")
        if 'data-sidebar-account' not in block:
            errors.append(f"index.html: {label} missing auth-driven account identity slot")
        if 'data-auth-state="unauthenticated"' not in block:
            errors.append(f"index.html: {label} account slot must initialize anonymous-first")
        if ">로그인<" not in block or "LOTBI 계정 연결" not in block:
            errors.append(f"index.html: {label} must expose the anonymous login CTA immediately")
        if "조승환" in block or "@jshncd01" in block:
            errors.append(f"index.html: {label} must not hardcode user identity")

        for destination in ("work", "library"):
            pattern = rf'<button[^>]*data-sidebar-destination="{destination}"[^>]*disabled'
            if not re.search(pattern, block):
                errors.append(f"index.html: {label} {destination} must remain fail-closed until authoritative route exists")

        recent_match = re.search(
            r'<ul[^>]*class="nav-history-list"[^>]*data-recent-conversations[^>]*>[\s\S]*?</ul>',
            block,
        )
        if not recent_match:
            errors.append(f"index.html: {label} recent conversation list contract missing")
        elif "<li" in recent_match.group(0):
            errors.append(f"index.html: {label} must not fabricate recent conversation titles or date buckets")

    for required in (
        'class="sidebar-brand"',
        'class="sidebar-brand-logo"',
        'class="sidebar-brand-mascot-crop"',
        'class="sidebar-brand-wordmark"',
        'class="sidebar-nav sidebar-nav-desktop"',
        'class="sidebar-primary-nav"',
        'class="nav-section sidebar-history-section"',
        'class="sidebar-history-scroll"',
        'class="sidebar-account-footer"',
    ):
        if required not in desktop_sidebar:
            errors.append(f"index.html: desktop sidebar hierarchy missing {required}")

    textarea_start = text.find('<textarea')
    textarea_end = text.find('</textarea>', textarea_start)
    textarea = text[textarea_start:textarea_end] if textarea_start >= 0 and textarea_end >= 0 else ""
    if not textarea:
        errors.append("index.html: prompt textarea markup not found")
    else:
        lowered_textarea = textarea.lower()
        if "readonly" in lowered_textarea or "aria-readonly" in lowered_textarea:
            errors.append("index.html: prompt must remain writable")
        if 'rows="1"' not in textarea:
            errors.append("index.html: composer must preserve one-row initial contract")

    approved_scripts = (
        '<script src="home-shell.js" defer></script>',
        '<script src="mobile-entry.js?v=20260920-homefirst1" defer></script>',
        '<script type="module" src="site-avatar.js"></script>',
        '<script type="module" src="site-conversation.js?v=20260920-richcards1"></script>',
        '<script type="module" src="site-continuity.js?v=20260920-logincta2"></script>',
    )
    if text.lower().count("<script") != len(approved_scripts) + 1 or any(approved not in text for approved in approved_scripts):
        errors.append("index.html: only the approved import map and home/avatar/mobile/conversation/continuity scripts are allowed")
    if text.count('<script type="importmap">') != 1 or '"three": "/avatar-runtime/vendor/three/three.module.js"' not in text:
        errors.append("index.html: sealed Three.js import map missing or changed")

    forbidden_shell_runtime = (
        "fetch(",
        "xmlhttprequest",
        "websocket",
        "eventsource",
        "sendbeacon",
        "localstorage",
        "sessionstorage",
        "indexeddb",
        "document.cookie",
    )
    combined = f"{text}\n{script}".lower()
    for token in forbidden_shell_runtime:
        if token in combined:
            errors.append(f"home shell must keep network/persistence isolated to approved modules: {token}")

    forbidden_fake_data = (
        "data-conversation-id",
        "data-order-id",
        "data-reservation-id",
        "mock ai",
        "mock-ai",
        "fake production",
    )
    for token in forbidden_fake_data:
        if token in combined:
            errors.append(f"home shell contains forbidden fake-data token: {token}")

    if 'class="sr-only" role="status"' not in text:
        errors.append("index.html: live status boundary must remain available to assistive technology")

    sidebar_style_tokens = (
        ".sidebar-brand-mascot-crop",
        "width: 32px",
        ".sidebar-brand-logo",
        "width: auto",
        "max-width: none",
        "height: 48px",
        ".sidebar-brand-wordmark",
        "font-size: 30px",
        "font-weight: 900",
        "letter-spacing: -1.6px",
        "margin-left: -1.2px",
        "-webkit-text-stroke: .3px currentColor",
        "object-fit: contain",
        "object-position: left center",
        "border: 0",
        "box-shadow: none",
        "filter: none",
        ".sidebar-primary-nav",
        ".sidebar-history-section",
        ".sidebar-history-scroll",
        "overflow-y: auto",
        "scrollbar-gutter: stable",
        ".sidebar-account-footer",
        "margin-top: auto",
        ".sidebar-account-entry",
        "text-overflow: ellipsis",
        "@media (min-width: 901px)",
        ".chat-sidebar-desktop",
        ".sidebar-nav-desktop",
        "min-height: 0",
        ".account-actions",
        "display: none",
        "@media (max-width: 900px)",
        ".mobile-nav-drawer",
        "overflow: hidden",
    )
    for token in sidebar_style_tokens:
        if token not in sidebar_css:
            errors.append(f"site-sidebar-nav.css: missing sidebar IA contract {token}")

    brand_rule = slice_between(sidebar_css, ".sidebar-brand {", "}")
    if "text-decoration: none" not in brand_rule:
        errors.append("site-sidebar-nav.css: desktop Home logo link underline must remain disabled")

    mascot_crop_rule = slice_between(sidebar_css, ".sidebar-brand-mascot-crop {", "}")
    for token in ("width: 32px", "flex: 0 0 32px", "overflow: hidden"):
        if token not in mascot_crop_rule:
            errors.append(f"site-sidebar-nav.css: mascot crop must exclude the legacy raster wordmark: {token}")

    wordmark_rule = slice_between(sidebar_css, ".sidebar-brand-wordmark {", "}")
    if "text-decoration: none" not in wordmark_rule:
        errors.append("site-sidebar-nav.css: Home LOTBI wordmark underline must remain disabled")

    logo_rule = slice_between(sidebar_css, ".sidebar-brand-logo {", "}")
    for forbidden_logo_style in ("height: 64px", "width: calc(100% - 10px)", "transform:"):
        if forbidden_logo_style in logo_rule:
            errors.append(f"site-sidebar-nav.css: transparent sidebar logo sizing regressed: {forbidden_logo_style}")

    if "@media (max-width: 900px)" not in HOME_CSS.read_text(encoding="utf-8"):
        errors.append("home-chat.css: mobile drawer breakpoint missing")

    visible_copy_tokens = (
        'class="chat-copy"',
        'class="chat-eyebrow"',
        'class="chat-intro"',
        'class="account-hint"',
    )
    for token in visible_copy_tokens:
        if token in text:
            errors.append(f"index.html: main character area must stay copy-free ({token!r})")

    if errors:
        print(f"HOME CHAT VALIDATION FAILED ({len(errors)} issue(s))")
        for error in errors:
            print(f"- {error}")
        return 1

    print("HOME CHAT VALIDATION PASS — approved Avatar integration, approved logo fit, anonymous-first auth CTA continuity, recent-scroll/fixed-account layout and composer contracts verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
