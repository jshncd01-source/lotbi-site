#!/usr/bin/env python3
"""Fail closed on the public refund/subscription policy alignment contract."""
from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REFUND = (ROOT / "refund.html").read_text(encoding="utf-8")
EXCHANGE = (ROOT / "exchange.html").read_text(encoding="utf-8")
SUBSCRIBE = (ROOT / "subscribe.html").read_text(encoding="utf-8")


def main() -> int:
    errors: list[str] = []

    required_refund = (
        "현재 LOTBI는 Apple App Store 또는 Google Play를 통한 인앱 구독 결제를 제공하지 않습니다.",
        "계약내용에 관한 서면(전자문서 포함)을 받은 날부터 7일 이내",
        "서비스를 공급받은 날부터 3개월 이내",
        "알 수 있었던 날부터 30일 이내",
        "아직 제공이 시작되지 않은 부분은 그러하지 않습니다.",
        "이 문서만을 근거로 청약철회를 제한하지 않습니다.",
        "다음 갱신 중단",
        "즉시 중도해지 및 환불",
        "환불금액 = 실제 결제액 - 이용기간 해당 금액",
        "별도의 10% 위약금이나 해지 수수료를 부과하지 않습니다.",
        "사용 횟수를 추가 위약금처럼 중복 공제하지 않습니다.",
        "철회 의사를 받은 날부터 3영업일 이내",
        "원 결제수단으로 반환",
        "LOTBI Basic은 월 9,900원",
        "LOTBI Plus는 월 19,900원",
        "LOTBI Pro는 월 39,900원",
        "전환 30일 전까지",
        "실제 결제와 자동갱신은 열려 있지 않습니다.",
        "developer@lotbiai.com",
        "063-237-0930",
        'href="/dispute"',
        'href="/exchange"',
    )
    for text in required_refund:
        if text not in REFUND:
            errors.append(f"refund.html: missing policy contract: {text}")

    forbidden_refund = (
        "결제일부터 7일 이내",
        "위약금 또는 해지 수수료로 결제액의 10%를 초과하여 공제하지 않습니다.",
        "Apple App Store 또는 Google Play를 통해 결제한 구독은 해당 스토어의 환불 정책",
    )
    for text in forbidden_refund:
        if text in REFUND:
            errors.append(f"refund.html: stale or misleading policy remains: {text}")

    required_exchange = (
        '<link rel="canonical" href="https://lotbiai.com/exchange" />',
        "서비스 장애·하자 처리",
        "기존 심사자료와 외부 링크의 호환",
        "청약철회, 구독 해지, 서비스 복구, 이용기간 연장 또는 환불",
    )
    for text in required_exchange:
        if text not in EXCHANGE:
            errors.append(f"exchange.html: missing digital-service remedy contract: {text}")

    required_subscribe = (
        "실제 결제와 자동갱신이 열려 있지 않습니다.",
        "즉시 서비스 이용 개시 여부",
        "청약철회 제한 가능성과 환불 조건",
        'href="/refund"',
        'href="/exchange"',
    )
    for text in required_subscribe:
        if text not in SUBSCRIBE:
            errors.append(f"subscribe.html: missing checkout readiness copy: {text}")

    if errors:
        print(f"REFUND POLICY ALIGNMENT FAILED ({len(errors)} issue(s))")
        for error in errors:
            print(f"- {error}")
        return 1

    print(
        "REFUND POLICY ALIGNMENT PASS - withdrawal periods, digital-service limits, "
        "prorated refund, recurring billing, live-payment status, support paths and "
        "legacy /exchange compatibility are aligned."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
