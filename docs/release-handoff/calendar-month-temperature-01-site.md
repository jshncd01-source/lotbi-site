READY_FOR_DEPLOY=YES
SUPERSEDES=6d44e1c1 (SITE-T52 Linux gate 반환 — 아래 'gate 반환 02')
LINUX_UNVERIFIED=scripts/validate_calendar_month_temperature_01.mjs (Linux 미실행 — gate 서버 precheck 요청)
MIGRATION=NO
DEPLOY_ORDER=SITE ONLY (Core 변경 없음 — 운영 Core 날씨 API 그대로 사용)
USER_DECISION_NEEDED=NONE

# calendar-month-temperature-01-site — 월 캘린더 칸에 최저/최고 온도 표시 (gate 반환 02 재READY)

## gate 반환 02 (2026-10-10, SITE-T52 run 20261010T073818Z-2533477-75447264)

- 반환 내용: `validate_calendar_month_temperature_01` → "610-auth-lunar-dark: 2026-10-10 calendar-weather-temperature-max overlaps the lunar; 2026-10-20 calendar-weather-temperature-value overlaps the lunar".
- 원인(Windows Verdana 강제로 재현): 72px 칸(뷰포트 610px)에서 Linux 넓은 글꼴의 음력 라벨이 x 56px까지 뻗음(날짜 버튼 한계 46px을 nowrap으로 넘김). 그림(x 49~67) 아래 최고/최저 두 줄 열(x 49~67, y 24~42)과 겹침. 같은 원인으로 768px 오늘 칸 "10•"도 넓은 글꼴에서 온도 줄과 겹치는 것을 추가 발견.
- 수정: 월 격자 <680px(좁은 태블릿)의 모든 칸에서 온도를 날짜 줄 아래 빈 띠(날짜 줄 끝 y 38px ~ 첫 기록 y 49px)에 9px 한 줄로 둠(top 6+32=38px, 오른쪽 정렬). 그 띠로 접힐 수 있는 음력 월초 칸만 그림만(휴대폰과 같은 규칙). 겹침 단정은 그대로.
- 검사기 보강: 넓은 글꼴 + 음력 조합을 375·412·600·610·650·768·1024·1280px로 확대(21 → 32조합). 넓은 글꼴 강제로 돌린 validate_calendar_lunar_compact_layout_01은 수정본과 main d4d172a5의 실패 목록이 87줄 모두 같음(Verdana가 gate 글꼴보다 넓어 음력 라벨 자체가 넘치는 기존 실패) → 이번 변경으로 새로 생긴 실패 0.

REPO=lotbi-site
FEATURE_BRANCH=feature/calendar-month-temperature-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote origin refs/heads/feature/calendar-month-temperature-01-site`)
REMOTE_FEATURE_SHA=same as FEATURE_SHA after push (checked with git ls-remote at push time)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=d4d172a5822e615749b353e90dced4f103050d21 (SITE-T50, 재READY push 직전 ls-remote 확인). 작업 시작 main 5675fd3d(SITE-T49) 위 코드 커밋 f126aa7e → main d4d172a5 정상 merge 454e99cb(충돌 75개 전부 asset 토큰 → main 쪽 + 재계산) → 1차 READY 6d44e1c1 → gate 반환 수정 bee04521 + 토큰 03aaff09. diff(main d4d172a5 → 이 branch) 실제 변경 = site-calendar.css · scripts/validate_calendar_month_temperature_01.mjs · .github/workflows/site-review.yml(+이 문서), 나머지는 토큰.
CODE_SHA=03aaff09 (gate fix bee04521 + asset tokens; earlier product commit f126aa7e, main merge 454e99cb)
ASSET_VERSION=aset-461ff59930b1 (`node scripts/asset_cache_version.mjs --check` PASS, targets 148, refs 178)
CONTRACT_CHANGE=NO
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
MERGED_TO_MAIN=NO
DEPLOYED=NO

## 소유자 신고

"월 캘린더에 온도가 안 나온다 — 확인해서 수정해 줘" (배포총괄방 경유, 2026-10-10)

## 원인 (확인된 사실)

- Core 날씨는 정상이다. 배포총괄방 운영 확인: `/v2/life/weather/public?start=2026-10-10&end=2026-10-20…` → provider_ready true, 날짜별 min/max·icon 있음. 한 번에 15일 넘게 요청하면 400 `WEATHER_DATE_WINDOW_INVALID`.
- Site 월간 요청은 400을 내지 않는다. 로그인(`/v2/life/weather`)·비로그인(`/v2/life/weather/public`) 모두 `forecastWindow()`가 "보이는 달 ∩ 오늘~오늘+14일"(최대 15일)로 잘라 보낸다(site-calendar-manager.js). 재현: 10월 월간 → 요청 1건 2026-10-10..2026-10-24.
- **온도는 칸 안에 그려진 뒤 CSS가 숨기고 있었다**(site-calendar.css, 10-06 캘린더 재설계 95e1aacc에서 들어옴):
  - `@media (max-width: 600px)` 휴대폰: `.calendar-weather-temperature, .calendar-weather-precip { display: none; }` → 날씨 그림만.
  - `@container calendar-month (max-width: 679px)` 좁은 태블릿(뷰포트 약 601~800px, 예: 768px 세로): 같은 숨김 → 그림만.
  - 실측(수정 전): 360·375·412·600·700·768px 모두 `display:none`, 900px 이상만 표시.
- 운영 실측: lotbiai.com 375px 캘린더 팝업 = 월간 격자 325px, 칸 45.6×52px.

## 정상 공백과 버그의 구분

| 화면 | 수정 후 | 판정 |
|---|---|---|
| 오늘~약 10일 뒤(기상청 단기·중기 예보가 있는 날) | 그림 + 최저/최고 | 표시해야 함(이번 수정) |
| 지난 날짜 | 날씨 없음 | 정상 공백 — Site가 오늘 이전을 요청하지 않고 Core도 지난 날짜를 주지 않음 |
| 오늘+15일 이후, 다음·이전 달 대부분 | 날씨 없음 | 정상 공백 — Core 15일 창·예보 범위 밖 |
| 예보 범위 안인데 Core가 그날 항목을 안 준 날(대개 10일 이후) | 날씨 없음 | 정상 공백(Core 데이터 없음) |
| 기온 값이 하나만 온 날(temperature_c만) | 그림 + "17°" | 정상 |
| 폭 350px 이하 휴대폰 | 날씨 전체 없음(칸 약 38~42px) | 기존 설계 유지 — 날씨는 날짜 누르면 나오는 일 패널에 있음 |
| 음력 표시 켬 + 폭 357px 이하 | 그림만, 온도 없음 | 의도 — 줄바뀐 음력 라벨이 칸 아래 줄을 씀 |
| 음력 표시 켬 + 휴대폰·좁은 태블릿 + 음력 월초 칸(음9.1, 윤5.1 등 한 달 1칸) | 그림만, 온도 없음 | 의도 — 월초 라벨이 숫자 밑으로 접히면 기록 점이 아래 줄까지 내려옴(validate_calendar_lunar_compact_layout_01 2028-06-23 윤5.1에서 확인) |
| 강수확률(💧%) | 휴대폰·좁은 태블릿 월 칸에는 없음 | 기존 설계 유지 — 일 패널·주간·PC 월 칸에 있음 |
| 위치·지역이 없는 비로그인 | 날씨 없음 | 정상(지역 선택 안내 기존 그대로) |

## 바뀐 것 (site-calendar.css만, JS 변경 없음)

1. 휴대폰(≤600px): 날씨 그림은 오른쪽 위 그대로, 칸 맨 아래 줄 오른쪽에 `18°/27°` 한 줄(9px 굵게, 최저 본문색·최고 빨강). 비어 있던 줄이라 칸 높이 52px 그대로.
   - 확인 필요 점(6px)은 날씨 있는 칸에서 아래 오른쪽 → 기록 점 줄 오른쪽 끝(top 30px)으로 이동(온도와 겹침 방지).
   - 음력 켬: 그림이 온도 바로 위(아래 오른쪽)로 내려옴. 확인 필요 점은 기존대로 오른쪽 위. 음력 월초 칸(`:has(.calendar-date-line[data-lunar-kind="month-start"])`)만 그림 기존 자리(top 35px)·온도 숨김.
   - 좁은 칸·넓은 글꼴(리눅스 DejaVu급)에서도 `-12°/-3°`가 43px 칸 안에 들어가도록 글자 간격 -0.05em, "/" 여백 0, 온도 줄만 오른쪽 여백 2px(그림은 4px 그대로). 각 숫자 상자를 9px 줄에 맞추려고 flex.
2. 좁은 태블릿(월간 격자 <680px, 뷰포트 약 601~777px): 강수확률만 숨기고 온도 표시. 그림은 오른쪽 위 그대로, `18°/27°` 9px 한 줄을 날짜 줄 아래·첫 기록 위 띠(칸 위에서 38~47px)에 오른쪽 정렬. 음력 월초 칸만 그림만.
3. 색: 월 칸 최고 온도 라이트 `#c62828`(기존 #d43b32는 주말 배경색에서 4.3:1 → 4.5:1 이상으로), 다크·시스템 다크 `#ff8a80`(기존 빨강은 어두운 바탕에서 약 2.9:1).
4. PC(격자 ≥680px) 배치는 그대로(색만 위 3번).
5. asset 토큰 재계산(`node scripts/asset_cache_version.mjs --write` → `--check` PASS).

## 검증

NEW_VALIDATOR=scripts/validate_calendar_month_temperature_01.mjs (workflow 등록: "Validate month calendar temperatures")
- 실제 페이지 CSS 전부(index.html 목록) + 실제 캘린더 팝업 구조, Core 응답은 가짜(15일 넘으면 400을 그대로 흉내).
- 32개 조합: 351·360·375·412·600·610·650·700·768·1024·1280px × 로그인/비로그인 × 라이트/다크 × 음력 끔/켬 × 10월/영하(1월) × 넓은 글꼴(DejaVu/Verdana 강제, 음력 켬은 모든 폭).
- 단정: 날씨 요청이 오늘~오늘+14일 안·올바른 경로 / 예보 칸마다 최저·최고 글자 표시(≥9px) / 칸 안 / 날짜·음력·그림·기록 점·확인 필요·기록 제목과 안 겹침 / 최저·최고 각각 대비 ≥4.5:1 / 같은 주 칸 높이 동일 / 예보 없는 날(지난 날·범위 밖)은 날씨 없음 / ≤350px·음력 ≤357px·휴대폰/좁은 태블릿 음력 월초 칸은 의도대로 숨김.
- 수정 전 main(5675fd3d)에서는 FAIL("351-auth: 2026-10-10 hides its temperature …"), 수정본 PASS.
REGRESSION=재READY(03aaff09): 같은 관련 검사기 61개 순서 실행 → 61 PASS / 0 FAIL(PYTHONIOENCODING=utf-8, CHROME_BIN 지정). 신규 검사기 32조합 PASS.
1차 READY 때: 병합본(454e99cb)에서 관련 검사기 61개 순서 실행(scripts/validate_calendar_* 전부 + site-calendar.css·calendar-weather·month-grid·date-cell을 읽는 검사기 + 신규 + main 신규 validate_site_session_request_storm_p0_01): 58 PASS / 3 FAIL → 3개 재실행 모두 PASS.
  - validate_calendar_day_panel_two_buttons_01: 1회차 FAIL(1280x900 날짜 탭 뒤 포커스 H3) → 재실행 PASS. main d4d172a5 기준본도 같은 종류 FAIL(390x844 포커스 H3) — 기존 간헐 실패, 이번 변경 무관.
  - validate_calendar_quiet_location_01: 1회차 'result missing'(일시) → 재실행 PASS, main 기준본 PASS.
  - validate_home_chat.py: Windows cp949 출력 오류(환경) → PYTHONIOENCODING=utf-8 재실행 PASS, main 기준본 PASS.
NEW_FAILURES=0
  - 개발 중 validate_calendar_lunar_compact_layout_01이 2028-06-23(윤5.1, 360·375·390px) 겹침을 잡음 → 음력 월초 칸 예외로 수정 후 PASS(320~1280px × 5개월 × 음력 끔/켬).
LINUX_GATE=NOT RUN locally (이 PC에 Linux 없음). 1차 READY 6d44e1c1은 SITE-T52 gate에서 610px 음력 넓은 글꼴 겹침으로 반환 → 넓은 글꼴 강제 단계를 모든 폭 음력으로 넓혀 재현·수정. gate 서버 precheck 요청(LINUX_UNVERIFIED).
REAL_DEVICE=NOT VERIFIED (실기기 화면은 배포 후 확인)

## 배포 후 확인 제안

1. 휴대폰 lotbiai.com → 캘린더 → 월: 오늘부터 약 10일 칸에 그림과 "최저°/최고°"가 보이는지(라이트·다크).
2. 태블릿/좁은 창(약 600~780px): 날짜 아래 줄에 온도.
3. 지난 날짜·월말 먼 날짜는 날씨 없음(정상).
