from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def require(path: str, needles: tuple[str, ...]) -> None:
    text = (ROOT / path).read_text(encoding="utf-8")
    for needle in needles:
        if needle not in text:
            raise SystemExit(f"{path}: missing {needle}")


require(
    "app/open/auth/social-return/index.html",
    (
        "noindex,nofollow,noarchive",
        "default-src 'none'",
        'src="/app-social-return.js"',
        'href="/app-social-return.css"',
    ),
)
require(
    "app-social-return.js",
    (
        "^IOS_[A-Za-z0-9_-]{43,124}$",
        "^[A-Za-z0-9_-]{32,256}$",
        "new URL('atglife://social-auth-return')",
        "window.location.replace(callbackUrl)",
        "codes.length !== 1",
        "states.length !== 1",
    ),
)
require(
    "nginx/default.conf.template",
    (
        "location = /app/open/auth/social-return",
        "try_files /app/open/auth/social-return/index.html =404;",
    ),
)

print("iOS Social Auth return bridge contract: PASS")
