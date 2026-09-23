#!/usr/bin/env python3
"""SITE-FOOTER-BUSINESS-INFO-02 — one source of truth for the footer business block.

전자상거래 등에서의 소비자보호에 관한 법률 제10조제1항은 사이버몰 운영자가
상호·대표자 성명, 영업소 주소, 전화번호, 전자우편주소, 사업자등록번호, 이용약관,
호스팅서비스 제공자의 상호를 표시하도록 한다. 그 표시가 페이지마다 하드코딩되어
있으면 한 곳만 고쳐지고 나머지가 조용히 뒤처진다 — 실제로 그렇게 이메일과
전화번호가 빠져 있었다.

그래서 블록은 여기 한 번만 적는다. 페이지는 이 스크립트가 써 넣고, CI 가 드리프트를
잡는다. 연락처를 바꿀 때는 아래 CANONICAL_ROWS 만 고치고 `--write` 를 돌리면 된다.

    python scripts/sync_footer_business_info.py --check   # CI gate
    python scripts/sync_footer_business_info.py --write   # rewrite every page

블록을 HTML 로 그대로 두는 것은 의도적이다. 법정 표시사항을 JavaScript 로 주입하면
스크립트가 실패한 브라우저에서 표시의무가 통째로 사라진다.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# Pages that carry the full business-information block. about/contact/
# account-deletion/404 carry the short footer only; 전자상거래법 제10조는 초기화면
# 표시를 요구하고 index.html 이 그 초기화면이다. 다른 페이지로 블록을 넓히려면
# 여기에 파일명을 더하고 --write 를 돌리면 된다.
PAGES = (
    "index.html",
    "privacy.html",
    "terms.html",
    "subscribe.html",
    "refund.html",
    "exchange.html",
    "dispute.html",
)

SEPARATOR = '<span class="company-separator" aria-hidden="true">|</span>'

# Each row is a list of already-escaped HTML fragments joined by the separator.
CANONICAL_ROWS: tuple[tuple[str, tuple[str, ...]], ...] = (
    (
        "",
        (
            "<span>유한회사 알에이디홀딩스</span>",
            "<span>대표자: 전선혜</span>",
            "<span>주소: 전북특별자치도 전주시 덕진구 혁신로 542, 1동 1층 (여의동)</span>",
        ),
    ),
    (
        "",
        (
            "<span>사업자등록번호: 583-88-03679</span>",
            "<span>통신판매업신고번호: 2026-전주덕진-0798</span>",
        ),
    ),
    (
        "",
        (
            '<span>전화: <a href="tel:0632370930">063-237-0930</a></span>',
            '<span>이메일: <a href="mailto:developer@lotbiai.com">developer@lotbiai.com</a></span>',
        ),
    ),
    (
        "",
        ("<span>호스팅서비스 제공: GitHub, Inc.</span>",),
    ),
    (
        " company-legal-links",
        (
            '<a href="terms.html">이용약관</a>',
            '<a href="privacy.html">개인정보처리방침</a>',
            '<a href="https://www.ftc.go.kr/bizCommPop.do?wrkr_no=5838803679"'
            ' target="_blank" rel="noopener noreferrer">사업자정보확인</a>',
        ),
    ),
)

OPEN_RE = re.compile(r'^([ \t]*)<div class="company-legal" aria-label="LOTBI 사업자 정보">$')


def render_block(indent: str) -> str:
    """Render the canonical block at the indentation the page already uses."""
    step = "  "
    lines = [f'{indent}<div class="company-legal" aria-label="LOTBI 사업자 정보">']
    for extra_class, items in CANONICAL_ROWS:
        lines.append(f'{indent}{step}<div class="company-legal-row{extra_class}">')
        for position, item in enumerate(items):
            if position:
                lines.append(f"{indent}{step}{step}{SEPARATOR}")
            lines.append(f"{indent}{step}{step}{item}")
        lines.append(f"{indent}{step}</div>")
    lines.append(f"{indent}</div>")
    return "\n".join(lines)


def locate_block(lines: list[str], path: Path) -> tuple[int, int, str]:
    """Return (start, end_exclusive, indent) for the page's business block.

    The block is found by its opening tag and closed by the first </div> at the
    same indentation, so the row divs nested inside never end the match early.
    """
    starts = [index for index, line in enumerate(lines) if OPEN_RE.match(line)]
    if len(starts) != 1:
        raise SystemExit(
            f"{path.name}: expected exactly one company-legal block, found {len(starts)}"
        )
    start = starts[0]
    indent = OPEN_RE.match(lines[start]).group(1)
    closing = f"{indent}</div>"
    for index in range(start + 1, len(lines)):
        if lines[index] == closing:
            return start, index + 1, indent
    raise SystemExit(f"{path.name}: company-legal block is never closed at its own indentation")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true", help="fail when a page has drifted")
    mode.add_argument("--write", action="store_true", help="rewrite the block in every page")
    args = parser.parse_args()

    drifted: list[str] = []
    for name in PAGES:
        path = REPO_ROOT / name
        original = path.read_text(encoding="utf-8")
        lines = original.split("\n")
        start, end, indent = locate_block(lines, path)
        expected = render_block(indent)
        if "\n".join(lines[start:end]) == expected:
            continue
        if args.check:
            drifted.append(name)
            continue
        path.write_text(
            "\n".join(lines[:start] + expected.split("\n") + lines[end:]),
            encoding="utf-8",
        )
        print(f"rewrote {name}")

    if drifted:
        print(
            "footer business information has drifted from the canonical block in: "
            + ", ".join(drifted),
            file=sys.stderr,
        )
        print(
            "run `python scripts/sync_footer_business_info.py --write` instead of "
            "editing the footer by hand — 한 페이지만 고치면 나머지가 또 뒤처집니다.",
            file=sys.stderr,
        )
        return 1

    if args.check:
        print(f"footer business information is identical across {len(PAGES)} pages")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
