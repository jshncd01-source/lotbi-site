#!/usr/bin/env python3
"""Fail-closed validation that nginx serves every shipped script module with a runnable MIME type.

Browsers refuse `<script type="module">` imports whose Content-Type is not JavaScript, and the
stock nginx mime.types has no `.mjs` entry (it falls back to application/octet-stream). The
Avatar runtime ships `.mjs` modules, so the site template must map them itself.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "nginx/default.conf.template"
STOCK_MIME_TYPES = "/etc/nginx/mime.types"
# Entries of nginx 1.28 conf/mime.types (the version pinned by validate_container_pin_01.py)
# that matter for script modules. `mjs` is deliberately absent there.
STOCK_TYPES = {"js": "application/javascript", "wasm": "application/wasm"}
EXPECTED_TYPES = {
    "js": {"application/javascript", "text/javascript"},
    "mjs": {"application/javascript", "text/javascript"},
    "wasm": {"application/wasm"},
}
SKIPPED_DIRS = {".git", "node_modules"}


def server_level(text: str) -> tuple[list[str], dict[str, str], list[str]]:
    """Return server-level directives, server-level types, and errors for nested types blocks."""
    text = re.sub(r"#[^\n]*", "", text)
    text = re.sub(r"\$\{(\w+)\}", r"$\1", text)  # envsubst placeholders are not blocks
    directives: list[str] = []
    types: dict[str, str] = {}
    errors: list[str] = []
    depth = 0
    statement = ""
    block_stack: list[str] = []
    for char in text:
        if char == "{":
            head = " ".join(statement.split())
            block_stack.append(head)
            depth += 1
            statement = ""
        elif char == "}":
            block_stack.pop()
            depth -= 1
            statement = ""
        elif char == ";":
            words = statement.split()
            statement = ""
            if not words:
                continue
            if block_stack and block_stack[-1] == "types":
                if depth != 2:
                    errors.append("types block must sit directly in server{}; a location-level types block drops every other type")
                for extension in words[1:]:
                    types[extension] = words[0]
            elif depth == 1:
                directives.append(" ".join(words))
        else:
            statement += char
    return directives, types, errors


def main() -> int:
    directives, template_types, errors = server_level(TEMPLATE.read_text(encoding="utf-8"))

    if template_types and f"include {STOCK_MIME_TYPES}" not in directives:
        errors.append(f"server-level types block replaces the inherited map; include {STOCK_MIME_TYPES} in server{{}} too")
    effective = {**STOCK_TYPES, **template_types} if template_types else dict(STOCK_TYPES)

    shipped: set[str] = set()
    for path in ROOT.rglob("*"):
        if path.is_file() and not SKIPPED_DIRS.intersection(path.relative_to(ROOT).parts):
            extension = path.suffix.lstrip(".").lower()
            if extension in EXPECTED_TYPES:
                shipped.add(extension)
    if "mjs" not in shipped:
        errors.append("no .mjs file found; the Avatar runtime modules are expected under avatar-runtime/runtime/")

    for extension in sorted(shipped):
        served = effective.get(extension, "application/octet-stream")
        if served not in EXPECTED_TYPES[extension]:
            errors.append(f".{extension} would be served as {served}; expected one of {sorted(EXPECTED_TYPES[extension])}")

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print("nginx module MIME contract: PASS (" + ", ".join(f".{e}={effective[e]}" for e in sorted(shipped)) + ")")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
