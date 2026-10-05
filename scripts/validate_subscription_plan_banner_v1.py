from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
CSS = (ROOT / "subscription-plan-banner.css").read_text(encoding="utf-8")
SUBSCRIBE = (ROOT / "subscribe.html").read_text(encoding="utf-8")

for value in ("9,900", "19,900", "39,900"):
    assert value in SUBSCRIBE, f"missing dedicated plan price: {value}"
# The conversation homepage must not contain a subscription sales panel,
# including its heading/copy or an empty container after prices are removed.
for value in ("subscription-plan-banner", "consumer-plan-menu", "플랜 보기", "LOTBI 유료 플랜", "필요한 만큼, 더 넉넉하게 이어가세요", "플랜 자세히 보기", "9,900원", "19,900원", "39,900원"):
    assert value not in INDEX, f"unexpected homepage promotion: {value}"
assert 'id="lotbi-prompt"' in INDEX
assert 'class="chat-composer"' in INDEX
assert 'class="home-value-proposition"' in INDEX
assert 'fetchpriority="high"' in INDEX
assert ".subscription-plan-banner" in CSS
assert "39,900원" in SUBSCRIBE and "29,900원" not in SUBSCRIBE
print("SUBSCRIPTION_UPGRADE_SETTINGS_ONLY PASS")
