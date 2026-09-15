#!/usr/bin/env python3
"""Fail-closed contract checks for SITE-HOME-CHAT-01.

This gate verifies the conversational-home foundation only. It intentionally makes
no network calls and does not connect to Core/Chat APIs or simulate AI behavior.
"""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
HOME_CSS = ROOT / "home-chat.css"
LOGIN_URL = "https://account.lotbiai.com/"
SIGNUP_URL = "https://account.lotbiai.com/signup"


def main() -> int:
    errors: list[str] = []

    if not INDEX.exists():
        errors.append("missing index.html")
    if not HOME_CSS.exists() or HOME_CSS.stat().st_size == 0:
        errors.append("missing or empty home-chat.css")

    text = INDEX.read_text(encoding="utf-8") if INDEX.exists() else ""
    requirements = {
        "approved LOTBI asset": 'src="assets/lotbi-main-logo.png"',
        "prompt textarea": 'id="lotbi-prompt"',
        "read-only prompt boundary": "readonly",
        "microphone control": "mic-button",
        "send control": "send-button",
        "disabled controls": "disabled",
        "screen-reader connection disclosure": "현재 입력·마이크·전송은 실행되지 않습니다.",
        "login URL": LOGIN_URL,
        "signup URL": SIGNUP_URL,
        "Privacy link": "privacy.html",
        "Terms link": "terms.html",
        "Account deletion link": "account-deletion.html",
        "Contact link": "contact.html",
        "home stylesheet": 'href="home-chat.css"',
    }
    for label, token in requirements.items():
        if token not in text:
            errors.append(f"index.html: missing {label}")

    lowered = text.lower()
    if "<script" in lowered:
        errors.append("index.html: scripted/mock chat behavior is not allowed in SITE-HOME-CHAT-01")
    if "<form" in lowered:
        errors.append("index.html: chat composer must not submit before real Chat/Core integration")
    if "fetch(" in lowered or "xmlhttprequest" in lowered or "websocket" in lowered:
        errors.append("index.html: network chat behavior is not allowed in this foundation batch")

    if text.count(LOGIN_URL) < 1:
        errors.append("index.html: login URL must be exposed in header")
    if text.count(SIGNUP_URL) < 1:
        errors.append("index.html: signup URL must be exposed in header")

    visible_copy_tokens = (
        'class="chat-copy"',
        'class="chat-eyebrow"',
        'class="chat-intro"',
        'class="account-hint"',
    )
    for token in visible_copy_tokens:
        if token in text:
            errors.append(f"index.html: main character area must stay copy-free ({token!r})")

    if 'class="sr-only" role="status"' not in text:
        errors.append("index.html: non-visual honesty boundary must remain available to assistive technology")

    if errors:
        print(f"HOME CHAT VALIDATION FAILED ({len(errors)} issue(s))")
        for error in errors:
            print(f"- {error}")
        return 1

    print("HOME CHAT VALIDATION PASS — conversational shell, account links, honesty boundary, accessibility labels and legal links verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
