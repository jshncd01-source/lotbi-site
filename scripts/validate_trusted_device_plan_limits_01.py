"""TRUSTED-DEVICE-PLAN-LIMITS-01 — the plan page shows the owner-confirmed trusted
device limits Core enforces (Free 1 / Basic 2 / Plus 5 / Pro 15) and the required
optional notice."""
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
SUBSCRIBE = (ROOT / "subscribe.html").read_text(encoding="utf-8")
NOTICE = "신뢰 기기 등록은 선택 사항이며, 등록하지 않아도 일반 로그인으로 LOTBI를 이용할 수 있습니다."
LIMITS = {"LOTBI Basic": 2, "LOTBI Plus": 5, "LOTBI Pro": 15}
SUMMARY = "신뢰 기기 등록 한도: 무료 1대 / 베이직 2대 / 플러스 5대 / 프로 15대"

cards = re.findall(r'<label class="plan-card[^>]*>(.*?)</label>', SUBSCRIBE, re.S)
assert len(cards) == 3, "expected exactly three paid plan cards"
for card in cards:
    name = re.search(r'<span class="plan-name">(LOTBI \w+)', card).group(1)
    rows = re.findall(
        r'<li data-plan-trusted-devices><span class="plan-feature-label">신뢰 기기 등록</span>'
        r'<span class="plan-feature-value">최대 (\d+)대</span></li>',
        card,
    )
    assert rows == [str(LIMITS[name])], f"{name} card must show 신뢰 기기 등록 최대 {LIMITS[name]}대: {rows}"

row = re.search(r'<tr data-plan-trusted-devices><th scope="row">신뢰 기기 등록</th>(.*?)</tr>', SUBSCRIBE, re.S)
assert row, "comparison table must have a trusted device row"
assert re.findall(r"<td>최대 (\d+)대</td>", row.group(1)) == ["2", "5", "15"], "comparison row must read 2 / 5 / 15"

notice = re.search(r"<p[^>]*data-trusted-device-optional-notice>(.*?)</p>", SUBSCRIBE, re.S)
assert notice and NOTICE in notice.group(1), "the optional trusted device notice must be shown"

summary = re.search(r"<p[^>]*data-trusted-device-limit-summary>(.*?)</p>", SUBSCRIBE, re.S)
assert summary and summary.group(1).strip() == SUMMARY, "the Free/Basic/Plus/Pro limit summary must be shown"

# The care profile counts (also 1 / 5 / 15) stay a separate, unchanged row.
assert '<tr><th scope="row">안심케어 프로필</th><td>1개</td><td>5개</td><td>15개</td></tr>' in SUBSCRIBE
assert SUBSCRIBE.count("신뢰 기기 등록</span>") == 3
assert "로그인 가능한 기기" not in SUBSCRIBE

print("TRUSTED DEVICE PLAN LIMITS 01 VALIDATION PASS")
