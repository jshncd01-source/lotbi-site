from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
CSS = (ROOT / "subscription-plan-banner.css").read_text(encoding="utf-8")
SUBSCRIBE = (ROOT / "subscribe.html").read_text(encoding="utf-8")

for value in ("Basic", "9,900원", "Plus", "19,900원", "Pro", "39,900원", "추천", "VAT 포함 · 월 정기결제"):
    assert value in INDEX, f"missing banner value: {value}"
assert "Free" not in INDEX[INDEX.index("subscription-plan-banner") : INDEX.index("</section>", INDEX.index("subscription-plan-banner"))]
assert ".subscription-plan-banner" in CSS
assert "39,900원" in SUBSCRIBE and "29,900원" not in SUBSCRIBE
print("SUBSCRIPTION_PLAN_BANNER_V1 PASS")
