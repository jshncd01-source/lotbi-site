#!/usr/bin/env python3
"""Fail-closed validation for LOTBI Production Privacy/Terms review pages.

This validator checks the approved Social Signup policy surface only. It does not
publish pages or activate Provider integrations.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRIVACY = ROOT / "privacy.html"
TERMS = ROOT / "terms.html"

FORBIDDEN_MARKERS = (
    "사전 공개 버전",
    "회원가입 기능을 제공하지 않습니다",
    "정식 서비스 출시 전에 업데이트",
    "DO NOT PUBLISH",
    "USER DECISION REQUIRED",
    "LEGAL REVIEW REQUIRED",
    "COUNSEL-READY",
    "counsel-required",
    "consent_manifest_version",
)


def require(text: str, needle: str, label: str, errors: list[str]) -> None:
    if needle not in text:
        errors.append(f"{label}: missing required contract text: {needle}")


def forbid(text: str, needle: str, label: str, errors: list[str]) -> None:
    if needle in text:
        errors.append(f"{label}: forbidden review/pre-release marker remains: {needle}")


def main() -> int:
    errors: list[str] = []
    for path in (PRIVACY, TERMS):
        if not path.exists():
            errors.append(f"missing legal page: {path.name}")

    if errors:
        for item in errors:
            print(f"- {item}")
        return 1

    privacy = PRIVACY.read_text(encoding="utf-8")
    terms = TERMS.read_text(encoding="utf-8")

    for marker in FORBIDDEN_MARKERS:
        forbid(privacy, marker, "privacy.html", errors)
        forbid(terms, marker, "terms.html", errors)

    # D1 / D2 approved policy.
    require(privacy, "LOTBI v1은 만 14세 미만 이용자의 회원가입을 지원하지 않습니다.", "privacy.html", errors)
    require(privacy, "만 14세 이상입니다 (필수)", "privacy.html", errors)
    require(privacy, "개인정보 보호책임자: 전선혜", "privacy.html", errors)
    require(privacy, "developer@lotbiai.com", "privacy.html", errors)
    require(privacy, "063-237-0930", "privacy.html", errors)

    require(terms, "LOTBI v1은 만 14세 미만 이용자의 회원가입을 지원하지 않습니다.", "terms.html", errors)
    require(terms, "만 14세 이상입니다 (필수)", "terms.html", errors)

    # Social identity minimum-data contract.
    for needle in ("Google: OpenID Connect <code>sub</code>", "Kakao: OpenID Connect <code>sub</code>", "<code>response.id</code>", "Apple: Sign in with Apple <code>sub</code>"):
        require(privacy, needle, "privacy.html", errors)
    require(privacy, "이메일, 이름, 닉네임, 프로필 사진", "privacy.html", errors)
    require(privacy, "LOTBI 이름", "privacy.html", errors)
    require(privacy, "account handle", "privacy.html", errors)

    # Account/security/deletion lifecycle.
    for needle in ("Passkey", "로그인 세션", "Social Login 연결 해제", "계정 삭제 요청", "hard delete"):
        require(privacy + terms, needle, "legal pages", errors)

    # FREE authoritative policy.
    for needle in (
        "매월 3개의 성공 작업",
        "매월 1일 00:00 Asia/Seoul(KST)",
        "이월되지 않습니다",
        "중복 차감하지 않습니다",
    ):
        require(terms, needle, "terms.html", errors)

    # Plus and channel separation without live-sale overclaim.
    for needle in ("월 구독료는 9,900원", "Toss Payments", "Apple App Store subscription", "Google Play subscription", "판매가 활성화되는 경우"):
        require(terms, needle, "terms.html", errors)
    require(terms, "외부 Merchant 거래", "terms.html", errors)

    # Canonical legal URLs and business disclosure.
    require(privacy, 'href="https://lotbiai.com/privacy.html"', "privacy.html", errors)
    require(terms, 'href="https://lotbiai.com/terms.html"', "terms.html", errors)
    for needle in ("유한회사 알에이디홀딩스", "583-88-03679", "2026-전주덕진-0798"):
        require(privacy + terms, needle, "legal pages", errors)

    if errors:
        print(f"LEGAL PAGE VALIDATION FAILED ({len(errors)} issue(s))")
        for item in errors:
            print(f"- {item}")
        return 1

    print("LEGAL PAGE VALIDATION PASS — D1/D2, Social minimum-data, FREE, Plus-channel and no-review-marker contracts verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
