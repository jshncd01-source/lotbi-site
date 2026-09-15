#!/usr/bin/env python3
"""Static accessibility contract checks for LOTBI public pages.

No browser/network access is required. The gate focuses on semantics that must
remain stable while the real Chat/Core and Account Web integrations are pending.
"""
from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
PAGES = (
    "index.html",
    "privacy.html",
    "terms.html",
    "account-deletion.html",
    "contact.html",
)


class A11yParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: list[str] = []
        self.h1_count = 0
        self.mains = 0
        self.buttons: list[dict[str, str | None]] = []
        self.textareas: list[dict[str, str | None]] = []
        self.labels_for: set[str] = set()
        self.positive_tabindex: list[str] = []
        self.blank_links_without_noopener: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = {k.lower(): v for k, v in attrs}
        if data.get("id"):
            self.ids.append(data["id"] or "")
        if tag == "h1":
            self.h1_count += 1
        elif tag == "main":
            self.mains += 1
        elif tag == "button":
            self.buttons.append(data)
        elif tag == "textarea":
            self.textareas.append(data)
        elif tag == "label" and data.get("for"):
            self.labels_for.add(data["for"] or "")
        elif tag == "a" and data.get("target") == "_blank":
            rel = (data.get("rel") or "").lower().split()
            if "noopener" not in rel:
                self.blank_links_without_noopener.append(data.get("href") or "")
        tabindex = data.get("tabindex")
        if tabindex:
            try:
                if int(tabindex) > 0:
                    self.positive_tabindex.append(tabindex)
            except ValueError:
                self.positive_tabindex.append(tabindex)


def main() -> int:
    errors: list[str] = []
    for rel in PAGES:
        text = (ROOT / rel).read_text(encoding="utf-8")
        parser = A11yParser()
        parser.feed(text)
        parser.close()

        if parser.mains != 1:
            errors.append(f"{rel}: expected exactly one main landmark")
        if parser.h1_count != 1:
            errors.append(f"{rel}: expected exactly one h1")
        if len(parser.ids) != len(set(parser.ids)):
            errors.append(f"{rel}: duplicate ids detected")
        if parser.positive_tabindex:
            errors.append(f"{rel}: positive/invalid tabindex is not allowed")
        if parser.blank_links_without_noopener:
            errors.append(f"{rel}: target=_blank link missing noopener")

        if rel == "index.html":
            if 'class="sr-only">LOTBI</h1>' not in text:
                errors.append("index.html: accessible h1 must remain visually hidden")
            if 'href="#main-content"' not in text:
                errors.append("index.html: skip link missing")
            if "lotbi-prompt" not in parser.labels_for:
                errors.append("index.html: prompt textarea must keep an explicit label")
            if len(parser.textareas) != 1:
                errors.append("index.html: expected one prompt textarea")
            else:
                prompt = parser.textareas[0]
                if "readonly" not in prompt or prompt.get("aria-readonly") != "true":
                    errors.append("index.html: prompt must remain explicitly read-only before real Chat/Core")
            if len(parser.buttons) != 2:
                errors.append("index.html: expected microphone and send buttons")
            for button in parser.buttons:
                if "disabled" not in button:
                    errors.append("index.html: pre-integration composer controls must remain disabled")
                if not (button.get("aria-label") or "").strip():
                    errors.append("index.html: composer button requires an aria-label")
            if 'id="chat-state-region"' not in text or 'aria-live="polite"' not in text:
                errors.append("index.html: future state region must be an aria-live polite status region")

    styles = (ROOT / "styles.css").read_text(encoding="utf-8")
    hardening = (ROOT / "site-hardening.css").read_text(encoding="utf-8")
    if ":focus-visible" not in styles:
        errors.append("styles.css: focus-visible treatment missing")
    if "prefers-reduced-motion" not in hardening:
        errors.append("site-hardening.css: reduced-motion treatment missing")
    if "forced-colors" not in hardening:
        errors.append("site-hardening.css: forced-colors treatment missing")

    if errors:
        print(f"ACCESSIBILITY VALIDATION FAILED ({len(errors)} issue(s))")
        for error in errors:
            print(f"- {error}")
        return 1

    print("ACCESSIBILITY VALIDATION PASS — landmarks, heading structure, labels, disabled pre-integration controls, focus and assistive-state contracts verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
