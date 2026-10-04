from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
CSS = (ROOT / "subscription-plan-banner.css").read_text(encoding="utf-8")
SUBSCRIBE = (ROOT / "subscribe.html").read_text(encoding="utf-8")

for value in ("9,900", "19,900", "39,900"):
    assert value in SUBSCRIBE, f"missing dedicated plan price: {value}"
for value in ("subscription-plan-banner", "consumer-plan-menu", "플랜 보기", "LOTBI 유료 플랜"):
    assert value not in INDEX, f"home must not promote paid plans: {value}"
assert ".subscription-plan-banner" in CSS
assert "39,900원" in SUBSCRIBE and "29,900원" not in SUBSCRIBE
print("SUBSCRIPTION_UPGRADE_SETTINGS_ONLY PASS")
