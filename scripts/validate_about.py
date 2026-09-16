#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
ABOUT = ROOT / "about.html"
INDEX = ROOT / "index.html"
SITEMAP = ROOT / "sitemap.xml"
ABOUT_CSS = ROOT / "about.css"

REQUIRED_PHILOSOPHY = (
    "LOTBI는 쇼핑몰이 아니라, 소비자가 모든 거래를 시작하는 관문입니다.",
    "소비자가 기업을 찾아가는 것이 아니라, 롯비가 소비자를 대신해 필요한 서비스와 연결되는 세상.",
    "원하는 것을 말하면, 롯비가 필요한 서비스와 연결하고 실제 거래까지 이어갑니다.",
)


def main() -> int:
    errors: list[str] = []
    for path in (ABOUT, ABOUT_CSS):
        if not path.exists() or path.stat().st_size == 0:
            errors.append(f"missing company introduction asset: {path.name}")

    if errors:
        for error in errors:
            print(f"- {error}")
        return 1

    about = ABOUT.read_text(encoding="utf-8")
    index = INDEX.read_text(encoding="utf-8")
    sitemap = SITEMAP.read_text(encoding="utf-8")
    css = ABOUT_CSS.read_text(encoding="utf-8")

    for phrase in REQUIRED_PHILOSOPHY:
        if phrase not in about:
            errors.append(f"about.html: missing required philosophy: {phrase}")

    core_position = about.find(REQUIRED_PHILOSOPHY[0])
    principles_position = about.find('class="about-principles"')
    if core_position < 0 or principles_position < 0 or core_position > principles_position:
        errors.append("about.html: core philosophy must appear before detailed principle/technical explanation")

    for concept in ("쇼핑몰", "예약 서비스", "여행 서비스", "지역 서비스", "기업과 서비스의 경계를 넘어", "소비자 중심"):
        if concept not in about:
            errors.append(f"about.html: missing business philosophy concept: {concept}")

    if 'class="brand brand-text-logo"' not in about or 'class="brand-o"' not in about:
        errors.append("about.html: official LOTBI wordmark styling must be reused")
    if 'href="about.html"' not in index:
        errors.append("index.html: company introduction must be discoverable from the public home")
    if "https://lotbiai.com/about.html" not in sitemap:
        errors.append("sitemap.xml: company introduction URL missing")
    if "@media (max-width: 760px)" not in css:
        errors.append("about.css: responsive mobile rule missing")
    if "var(--brand-navy)" not in css or "var(--brand-violet)" not in css:
        errors.append("about.css: must reuse existing LOTBI brand color tokens")

    overclaim = (
        "모든 거래를 자동으로 완료합니다",
        "승인 없이 결제",
        "현재 모든 쇼핑몰에서 구매할 수 있습니다",
    )
    for phrase in overclaim:
        if phrase in about:
            errors.append(f"about.html: unsupported capability overclaim: {phrase}")

    if errors:
        print(f"ABOUT VALIDATION FAILED ({len(errors)} issue(s))")
        for error in errors:
            print(f"- {error}")
        return 1

    print("ABOUT VALIDATION PASS — required LOTBI philosophy, early placement, official branding, discoverability and responsive layout verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
