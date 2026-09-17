#!/usr/bin/env python3
"""Fail-closed contract checks for the LOTBI conversational home shell.

The shell remains responsible for accessible navigation and input UX. Real
conversation networking is isolated to the separately validated
site-conversation.js module; authenticated continuity is isolated to the
approved site-continuity.js module; home-shell.js itself remains free of
network and persistence behavior. The approved mobile-entry.js bootstrap may coexist.
"""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
HOME_CSS = ROOT / "home-chat.css"
SIDEBAR_CSS = ROOT / "site-sidebar-nav.css"
HOME_JS = ROOT / "home-shell.js"
CONTINUITY_JS = ROOT / "site-continuity.js"
LOGIN_URL = "/auth/start/"
SIGNUP_URL = "https://account.lotbiai.com/signup"
ACCOUNT_URL = "https://account.lotbiai.com/account"


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
        "approved LOTBI sidebar logo asset": 'src="assets/lotbi-logo-header.png"',
        "prompt textarea": 'id="lotbi-prompt"',
        "prompt no-persistence hint": 'autocomplete="off"',
        "prompt length boundary": 'maxlength="1000"',
        "microphone control": "mic-button",
        "send control": "send-button",
        "conversation thread": 'id="conversation-thread"',
        "local navigation script": 'src="home-shell.js"',
        "approved mobile chooser": 'src="mobile-entry.js"',
        "approved conversation module": 'src="site-conversation.js"',
        "approved continuity module": 'src="site-continuity.js"',
        "auth continuity stylesheet": 'href="site-auth-continuity.css"',
        "sidebar navigation stylesheet": 'href="site-sidebar-nav.css"',
        "neutral initial auth state": 'data-auth-state="checking"',
        "neutral auth placeholder": 'class="account-auth-placeholder"',
        "desktop sidebar": "chat-sidebar-desktop",
        "desktop sidebar nav": "sidebar-nav-desktop",
        "desktop recent scroll": "sidebar-history-scroll",
        "desktop bottom nav": "sidebar-bottom-nav",
        "mobile menu toggle": "data-mobile-nav-open",
        "mobile drawer": 'id="mobile-nav-drawer"',
        "new chat menu": "+ 새 대화",
        "recent conversations": "최근 대화",
        "today bucket": "오늘",
        "yesterday bucket": "어제",
        "seven-day bucket": "최근 7일",
        "older bucket": "이전",
        "orders menu": "주문 내역",
        "reservations menu": "예약 내역",
        "account menu": "내 계정",
        "settings menu": "설정",
        "help menu": "도움말 / 문의",
        "live handoff boundary": "메시지를 입력하면 LOTBI와 대화를 시작합니다.",
        "account URL": ACCOUNT_URL,
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

    for url, label in ((LOGIN_URL, "login"), (SIGNUP_URL, "signup"), (ACCOUNT_URL, "account")):
        if url not in continuity:
            errors.append(f"site-continuity.js: {label} URL changed or missing")

    account_start = text.find('<nav class="account-actions"')
    account_end = text.find('</nav>', account_start)
    initial_account = text[account_start:account_end] if account_start >= 0 and account_end >= 0 else ""
    if not initial_account:
        errors.append("index.html: initial account-actions markup not found")
    else:
        for forbidden in (">로그인<", ">회원가입<", ">내 계정<"):
            if forbidden in initial_account:
                errors.append(f"index.html: initial auth state must stay neutral ({forbidden})")

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
        for forbidden in ("비어 있음", ">준비<", "준비 중", ">Account<", "— 준비"):
            if forbidden in block:
                errors.append(f"index.html: {label} exposes removed temporary copy: {forbidden}")
        if ACCOUNT_URL not in block:
            errors.append(f"index.html: {label} must preserve account access")
        if "도움말 / 문의" not in block or 'href="contact.html"' not in block:
            errors.append(f"index.html: {label} must preserve help/contact navigation")

    for required in (
        'class="sidebar-brand"',
        'class="sidebar-brand-logo"',
        'class="sidebar-nav sidebar-nav-desktop"',
        'class="nav-section sidebar-history-section"',
        'class="sidebar-history-scroll"',
        'class="nav-section nav-actions sidebar-bottom-nav"',
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
        '<script src="mobile-entry.js" defer></script>',
        '<script type="module" src="site-conversation.js"></script>',
        '<script type="module" src="site-continuity.js"></script>',
    )
    if text.lower().count("<script") != len(approved_scripts) or any(approved not in text for approved in approved_scripts):
        errors.append("index.html: only approved home-shell.js, mobile-entry.js, site-conversation.js and site-continuity.js scripts are allowed")

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
        ".sidebar-brand-logo",
        "width: 100%",
        "max-width: 100%",
        "height: auto",
        "object-fit: contain",
        "object-position: left center",
        "@media (min-width: 901px)",
        ".chat-sidebar-desktop",
        "overflow: hidden",
        ".sidebar-nav-desktop",
        "min-height: 0",
        ".sidebar-history-section",
        ".sidebar-history-scroll",
        "overflow-y: auto",
        "scrollbar-gutter: stable",
        ".sidebar-bottom-nav",
        "margin-top: auto",
        ".account-actions",
        "display: none",
    )
    for token in sidebar_style_tokens:
        if token not in sidebar_css:
            errors.append(f"site-sidebar-nav.css: missing desktop sidebar contract {token}")

    if "height: 34px" in sidebar_css:
        errors.append("site-sidebar-nav.css: fixed 34px logo height must not return")

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

    print("HOME CHAT VALIDATION PASS — full-ratio desktop sidebar logo, recent-scroll/fixed-bottom navigation, mobile account access, neutral auth continuity and composer contracts verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
