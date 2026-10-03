from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
SUBSCRIBE = (ROOT / "subscribe.html").read_text(encoding="utf-8")
TERMS = (ROOT / "terms.html").read_text(encoding="utf-8")
STYLES = (ROOT / "subscribe.css").read_text(encoding="utf-8")


for value in (
    "LOTBI Basic",
    "LOTBI Plus",
    "LOTBI Pro",
    "9,900원",
    "19,900원",
    "39,900원",
    "Basic 시작하기",
    "Plus 시작하기",
    "Pro로 업그레이드",
    "전체 기능 비교",
    "월 50건",
    "월 300건",
    "월 20건",
    "월 100건",
    "월 500건",
):
    assert value in SUBSCRIBE, f"missing plan policy text: {value}"

cards = re.findall(r'<label class="plan-card[^>]*>(.*?)</label>', SUBSCRIBE, re.S)
assert len(cards) == 3, "upgrade surface must contain exactly three paid cards"
assert all("LOTBI Free" not in card for card in cards), "Free must not be an upgrade card"
assert sum("recommended-badge" in card for card in cards) == 1, "exactly one plan must be recommended"
assert "LOTBI Plus" in next(card for card in cards if "recommended-badge" in card)

for forbidden in ("제휴몰 개수", "제휴 서비스 개수", "쇼핑·예약 실행 횟수", "미래 모든 기능"):
    assert forbidden not in SUBSCRIBE, f"unavailable feature advertised: {forbidden}"

assert "로그인 및 계정 연결은 유료 사용량으로 차감하지 않습니다." in TERMS
assert "9,900원·19,900원·39,900원" in TERMS
assert "29,900" not in SUBSCRIBE
assert "29,900" not in TERMS
assert re.search(r"\.plan-picker\s*\{[^}]*min-width:\s*0;[^}]*width:\s*100%;", STYLES, re.S), (
    "fieldset min-content sizing must not overflow mobile review screens"
)

print("PLAN USAGE MATRIX V1 VALIDATION PASS")
