#!/usr/bin/env python3
"""Fail-closed contract checks for SITE-HOME-NAV-01.

This gate verifies the public conversational UI/interaction foundation only. Text
entry and the local navigation drawer are allowed; network chat, persistence,
fake history/orders/reservations and simulated AI behavior remain forbidden.
The separately validated mobile-entry.js bootstrap may coexist on the page.
"""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
HOME_CSS = ROOT / "home-chat.css"
HOME_JS = ROOT / "home-shell.js"
LOGIN_URL = "https://account.lotbiai.com/"
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
        "microphone control": "mic-button",
        "send control": "send-button",
        "local navigation script": 'src="home-shell.js"',
        "approved mobile chooser": 'src="mobile-entry.js"',
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
        "honest typing boundary": "텍스트 입력은 가능하지만 저장하거나 Core로 전송하지 않습니다.",
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
            errors.append("index.html: prompt must be writable for SITE-HOME-NAV-01")

    if '<form' in text.lower():
        errors.append("index.html: composer must not submit before real Chat/Core integration")

    approved_scripts = (
        '<script src="home-shell.js" defer></script>',
        '<script src="mobile-entry.js" defer></script>',
    )
    if text.lower().count("<script") != len(approved_scripts) or any(script not in text for script in approved_scripts):
        errors.append("index.html: only approved home-shell.js and mobile-entry.js scripts are allowed")

    forbidden_runtime = (
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
    for token in forbidden_runtime:
        if token in combined:
            errors.append(f"UI foundation must not use network/persistence runtime: {token}")

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
            errors.append(f"UI foundation contains forbidden fake-data token: {token}")

    if 'class="sr-only" role="status"' not in text:
        errors.append("index.html: non-visual honesty boundary must remain available to assistive technology")

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
        print(f"HOME NAV/INPUT VALIDATION FAILED ({len(errors)} issue(s))")
        for error in errors:
            print(f"- {error}")
        return 1

    print("HOME NAV/INPUT VALIDATION PASS — writable ephemeral prompt, empty-state navigation shell, account/legal routes and no-network/no-persistence boundaries verified alongside approved mobile chooser bootstrap.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
