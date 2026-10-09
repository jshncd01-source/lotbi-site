"""SUBSCRIPTION-PRICE-PRORATION-01: public prices and plan-change policy copy.

Plus is 29,900 KRW (VAT included) on every public surface, the old 19,900 KRW
Plus price is gone, and the plan-change rules match Core's plan-proration-v1:
upgrade = prorated difference charged first and applied after payment with the
billing date unchanged; downgrade = next billing date, no charge, no refund;
store subscriptions follow the store.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(name: str) -> str:
    return (ROOT / name).read_text(encoding="utf-8")


SUBSCRIBE = read("subscribe.html")
REFUND = read("refund.html")
TERMS = read("terms.html")
errors: list[str] = []

for name, text in (("subscribe.html", SUBSCRIBE), ("refund.html", REFUND), ("terms.html", TERMS)):
    if "19,900" in text:
        errors.append(f"{name}: stale Plus price 19,900 remains")
    if "29,900원" not in text:
        errors.append(f"{name}: Plus price 29,900원 missing")

for needle in ("Basic 월 9,900원, Plus 월 29,900원, Pro 월 39,900원",
               '<span class="plan-price">29,900원<span class="plan-period"> / 월</span></span>',
               "요금 차액만 일할 계산해 결제",
               "다음 정기결제일은 그대로입니다",
               "다음 정기결제일부터 적용되고 별도 결제나 환불은 없습니다"):
    if needle not in SUBSCRIBE:
        errors.append(f"subscribe.html: missing {needle}")

for needle in ("LOTBI Plus는 월 29,900원",
               'id="plan-change"',
               "이번 이용기간에 실제로 결제한 금액을 기준으로 계산",
               "결제 전에 결제 예정 금액을 표시하고 결제가 완료된 때부터 상위 플랜을 적용",
               "정기결제일은 바뀌지 않고, 다음 정기결제부터 상위 플랜의 월 요금이 결제",
               "차액 결제가 완료되지 않으면 플랜은 바뀌지 않습니다",
               "다음 정기결제일부터 하위 플랜의 월 요금이 적용",
               "별도 결제나 환불은 없으며",
               "해당 스토어의 구독 관리와 정책에 따릅니다",
               "사전 안내와 동의 절차 없이 인상하지 않습니다",
               "전환 30일 전까지"):
    if needle not in REFUND:
        errors.append(f"refund.html: missing {needle}")

# terms.html is a locked legal page: only the Plus amount in 제8조 changed.
if "9,900원·29,900원·39,900원" not in TERMS:
    errors.append("terms.html: missing 9,900원·29,900원·39,900원")

if errors:
    raise SystemExit("\n".join(errors))
print("SUBSCRIPTION_PRICE_PRORATION_01 PASS")
