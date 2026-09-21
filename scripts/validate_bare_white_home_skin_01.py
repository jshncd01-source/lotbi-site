#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
CSS_PATH = ROOT / "home-bare-white.css"
CSS = CSS_PATH.read_text(encoding="utf-8") if CSS_PATH.exists() else ""

errors = []

if 'href="home-bare-white.css' not in INDEX:
    errors.append("index.html: Bare White Home stylesheet link missing")
if not CSS:
    errors.append("home-bare-white.css: missing or empty")

required = [
    "SITE-BARE-WHITE-HOME-SKIN-01",
    "body.chat-home-page:not(.conversation-active)",
    "--home-skin-bg: #ffffff",
    ".chat-sidebar-desktop",
    ".mobile-nav-drawer",
    ".nav-item-primary",
    ".chat-character-wrap",
    ".chat-composer",
    "box-shadow: none",
    ".chat-input",
    ".composer-button",
    ".send-button",
    ".chat-home-footer",
    "@media (max-width: 760px)",
]
for token in required:
    if token not in CSS:
        errors.append(f"home-bare-white.css: missing {token}")

forbidden = [
    "linear-gradient(",
    "radial-gradient(",
    "filter: drop-shadow",
    "background-image:",
    "url(",
]
for token in forbidden:
    if token in CSS:
        errors.append(f"home-bare-white.css: decorative skin token forbidden: {token}")

if 'data-response-grade-control hidden inert aria-hidden="true"' not in INDEX:
    errors.append("index.html: Response Grade hidden/inert contract changed")

conversation_scope = [
    ".chat-message-user",
    ".chat-message-assistant",
    ".chat-assistant-row",
    ".lotbi-rich-card",
    ".site-calendar",
]
for token in conversation_scope:
    if token in CSS:
        errors.append(f"home-bare-white.css: non-Home visual scope leaked into {token}")

if errors:
    print(f"BARE WHITE HOME SKIN VALIDATION FAILED ({len(errors)} issue(s))")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print("BARE WHITE HOME SKIN VALIDATION PASS — Home-only white workspace, restrained chrome and conversation-mode isolation verified.")
