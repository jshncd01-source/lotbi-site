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
HOME_JS = ROOT / "home-shell.js"
LOGIN_URL = "/auth/start/"
SIGNUP_URL = "https://account.lotbiai.com/signup"
ACCOUNT_URL = "https://account.lotbiai.com/account"


def main() -> int:
    errors: list[str] = []

    for path, label in ((INDEX, "index.html"), (HOME_CSS, "home-chat.css"), (HOME_JS, "home-shell.js")):
        if not path.exists() or path.stat().st_size == 0:
            errors.append(f"missing or empty {label}")

    text = INDEX.read_text(encoding="utf-8") if INDEX.exists() else ""
    script = HOME_JS.read_text(encoding="utf-8") if HOME_JS.exists() else ""

    requirements = {
        "approved LOTBI asset": 'src="assets/lotbi-main-logo.png"',
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
        "desktop sidebar": "chat-sidebar-desktop",
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
        "empty state": "비어 있음",
        "ready state": "준비",
        "live handoff boundary": "메시지를 입력하면 LOTBI와 대화를 시작합니다.",
        "login URL": LOGIN_URL,
        "signup URL": SIGNUP_URL,
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

    textarea_start = text.find('<textarea')
    textarea_end = text.find('</textarea>', textarea_start)
    textarea = text[textarea_start:textarea_end] if textarea_start >= 0 and textarea_end >= 0 else ""
    if not textarea:
        errors.append("index.html: prompt textarea markup not found")
    else:
        lowered_textarea = textarea.lower()
        if "readonly" in lowered_textarea or "aria-readonly" in lowered_textarea:
            errors.append("index.html: prompt must remain writable")

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

    if text.count(LOGIN_URL) < 1 or text.count(SIGNUP_URL) < 1:
        errors.append("index.html: login/signup URLs must remain exposed in the header")

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

    print("HOME CHAT VALIDATION PASS — accessible writable composer, isolated conversation/continuity modules, navigation/account/legal routes and mobile chooser coexistence verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
