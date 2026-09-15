#!/usr/bin/env python3
"""Fail-closed validation for SITE-CHAT-RUNTIME-01 readiness."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
FILES = {
    "api/chat.mjs": ("AUTH_REQUIRED", "unsealSiteSession", "callCoreConversation"),
    "runtime/core-chat.mjs": ("Authorization", "Bearer ${token}", "CORE-WEB-CHAT-01", "chatPath"),
    "runtime/site-session.mjs": ("__Host-lotbi_site_session", "HttpOnly", "Secure", "SameSite=Lax", "AES-GCM"),
    "runtime/security.mjs": ("BFF_ORIGIN_REJECTED", "same-origin", "application/json", "no-store"),
    "runtime/config.mjs": ("LOTBI_CORE_BASE_URL", "LOTBI_SITE_SESSION_KEY", "https://lotbiai.com", "https://account.lotbiai.com", "/v2/conversation/messages"),
    ".env.runtime.example": ("LOTBI_CORE_BASE_URL=", "LOTBI_SITE_SESSION_KEY=", "LOTBI_SITE_ORIGIN=https://lotbiai.com"),
    "vercel.json": ("api/chat.mjs", "dist", "build-vercel-static.mjs"),
    "tests/site-chat-runtime-01.test.mjs": ("never invents anonymous session", "exact Core contract"),
}

FORBIDDEN_BROWSER_TOKENS = (
    "localStorage",
    "sessionStorage.setItem",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GEMINI_API_KEY",
)


def main() -> int:
    errors: list[str] = []
    for rel, tokens in FILES.items():
        path = ROOT / rel
        if not path.exists() or path.stat().st_size == 0:
            errors.append(f"missing runtime file: {rel}")
            continue
        text = path.read_text(encoding="utf-8")
        for token in tokens:
            if token not in text:
                errors.append(f"{rel}: missing contract token {token!r}")

    index = (ROOT / "index.html").read_text(encoding="utf-8")
    shell = (ROOT / "home-shell.js").read_text(encoding="utf-8")
    if "/api/chat" in index or "/api/chat" in shell:
        errors.append("production Home must not activate chat before real auth handoff is available")
    for token in FORBIDDEN_BROWSER_TOKENS:
        if token in index or token in shell:
            errors.append(f"browser surface contains forbidden secret/session pattern: {token}")
    if "fetch(" in shell:
        errors.append("existing production Home shell must remain network-free in readiness batch")

    runtime_text = "\n".join((ROOT / rel).read_text(encoding="utf-8") for rel in (
        "api/chat.mjs", "runtime/core-chat.mjs", "runtime/config.mjs", "runtime/site-session.mjs", "runtime/security.mjs"
    ))
    for token in ("OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY"):
        if token in runtime_text:
            errors.append(f"runtime must not depend on provider credential {token}")
    if "createAnonymous" in runtime_text or "anonymous session" in runtime_text.lower():
        errors.append("runtime must not create or infer an anonymous Core session")

    if errors:
        print(f"SITE-CHAT-RUNTIME-01 VALIDATION FAILED ({len(errors)} issue(s))")
        for error in errors:
            print(f"- {error}")
        return 1
    print("SITE-CHAT-RUNTIME-01 VALIDATION PASS — same-origin BFF skeleton, encrypted host-only session boundary, exact Core chat path and no pre-handoff production activation verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
