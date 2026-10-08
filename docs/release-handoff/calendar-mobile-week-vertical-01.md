READY_FOR_DEPLOY=YES

# calendar-mobile-week-vertical-01 — release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/calendar-mobile-week-vertical-01
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote origin refs/heads/feature/calendar-mobile-week-vertical-01`)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=1eb38853abfdad294a6e9b27805ad78459712d6b (SITE-T33; Production served aset-8f81dc83c912 = this main at start)
CODE_SHA=91c343f31c943fe0a2a080daacd23ece379cacab (코드·검사·워크플로·토큰 전부 이 커밋 하나)
ASSET_VERSION=aset-8e8505220e68 (main 1eb38853: aset-8f81dc83c912)
CORE_CHANGE=NONE (Calendar Core API·데이터 구조 변경 없음)
DEPLOY_ORDER=SITE 단독
USER_DECISION_NEEDED=NONE

## SCOPE

- Site 전용. Core / Web / App / Admin 변경 없음.
- 모바일(화면 폭 900px 이하 — 캘린더가 이미 쓰는 터치 기준) 주간 보기만 새 디자인으로 바꿨다: 왼쪽 세로 요일 7개 + 오른쪽 선택 날짜의 시간순 일정 카드.
- PC(901px 이상) 주간 = 기존 7일 시간표 그대로(코드 경로 `renderWeekTimeGrid` 무변경).
- 월간 그리드·목록 보기 코드 무변경.
- 사용자 결정 반영: 가계부 월 합계는 월간 화면에서만 표시(이전에는 오늘·주간에도 표시).

## CHANGE

- `site-calendar-manager.js`
  - `calendarWeekLayout()` 추가: `usesFlowingDayDetail()`(≤900px)이면 'vertical', 아니면 'timegrid'. `renderWeek`가 이 값으로 둘 중 하나를 그림. `section[data-week-layout]`에 값 기록.
  - `renderWeekVertical`: 주 시작 설정(기본 일요일)대로 7일 세로 rail. 각 날 = 요일 + 날짜 + 기록 수 점(최대 3, 월간 폰 점과 같은 `recordDots`). 선택 날짜 `data-selected`/`aria-pressed`, 오늘 `aria-current="date"`, 공휴일 `data-holiday`. ↑/↓/Home/End 키로 날 이동.
  - `renderWeekDayDetail`: 선택 날짜 제목(오늘 배지)·음력(설정 시)·날씨·공휴일, 그다음 기존 `lifeTimelineNodes`(일간 패널과 같은 행: 기간·마감 → 시간순 → 시간 없는 기록)를 카드로. 빈 날은 "오늘은 아직 기록이 없어요." / "이 날은 기록이 없어요." + 추가 방법 한 줄.
  - `actions.selectDate`: 주간에서 같은 주 안의 날짜는 다시 읽지 않고 즉시 다시 그림(주가 두 달에 걸쳐도). 주를 벗어나면 refresh.
  - 오늘 버튼: 폰 주간에서는 주간에 머물며 오늘이 있는 주·오늘을 선택. PC·다른 보기는 기존대로 일간 보기.
  - 가계부 월 합계: 표시와 조회 모두 `state.mode === 'month'`일 때만(주간 이동마다 나가던 Core 합계 요청 1건 감소). 월간으로 돌아오면 그때 조회.
  - `renderPreservingFocus`: 날씨·공휴일이 늦게 도착해 다시 그릴 때 rail에서 누른 날의 포커스 유지.
  - 창 크기가 900px 경계를 넘으면 주간을 다시 그림.
- `site-calendar.css`
  - rail·카드·빈 상태 스타일. 색은 기존 캘린더 토큰 변수만 사용(라이트·다크·기기 설정 다크 자동 대응, system-dark 미러 재생성 불필요).
  - 기존 문제 같이 수정(이번 화면 요구 "320~412px 잘림 없음"에 걸림, main에서도 재현):
    - ≤900px 주간 상단 버튼 줄: 선택 날짜가 오늘이 아니면 "+ 9월 23일에 기록"이 320px에서 9px 넘쳐 잘림 → 두 버튼이 줄을 나눠 쓰고 필요하면 줄바꿈.
    - ≤380px 상단 바: 버튼 5개(44px)에 밀려 제목 칸이 37px → "9월 20–26일"·"2026년 9월"이 몇 글자만 보임 → 설정(⚙) 버튼을 보기 탭 줄로 내림. 월간에도 같은 효과(제목 잘림 해소), PC 무영향.
- `scripts/validate_calendar_week_mobile_vertical_01.mjs` (신규, PORT 4302) + `.github/workflows/site-review.yml`, `site-universal-life-calendar-01.yml`에 등록.
- 기대값 갱신(사용자 결정으로 계약이 바뀐 부분만):
  - `validate_calendar_week_timegrid_ui_01.mjs`: 모바일 360px "가로 스크롤 시간표" 단정 → PC 1440·1024 확인으로. PC 단정은 그대로.
  - `validate_calendar_expense_summary_01.mjs`: "오늘·주·월 모두 합계" → "월간만 합계, 오늘·주간은 없음". 나머지 단정 그대로.
  - `validate_calendar_cross_platform_ux_01.mjs`: `const layout = 'timegrid'` 소스 단정 → PC=timegrid / 모바일=vertical 소스 단정.
- asset token 재생성(`scripts/asset_cache_version.mjs --write`). 위 파일 외 변경은 토큰뿐.

## RESULT (완료 보고 항목)

MOBILE_WEEK_VERTICAL_LAYOUT=IMPLEMENTED — ≤900px 왼쪽 요일 rail + 오른쪽 하루 카드, 가로 7열 시간표 없음
DAY_SELECTION=IMPLEMENTED — 탭 즉시 전환(같은 작업 안, 추가 요청 0건), 선택 강조·오늘 표시·공휴일·점 표시
DAILY_EVENT_CARDS=IMPLEMENTED — 시간순 카드, 금액 카드 안, 시간 없는 기록 구분, 긴 제목 3줄 안 전체 표시, 빈 상태 문구
WEEK_NAVIGATION=IMPLEMENTED — 이전 주·다음 주(같은 요일 유지), 오늘(폰: 주간 유지)
PC_WEEK_PRESERVED=YES — 1280·1024·1440에서 7열 시간표·24시간 축·가로 넘침 0, 오늘 → 일간 보기 유지
MONTH_VIEW_PRESERVED=YES — 월간 그리드 코드 무변경, 월 합계 표시
MONTHLY_EXPENSE_STATUS=CHECKED — 별도 보고된 '월간 가계부 누락'은 배포 큐·세션 기록에서 개발/배포 건을 찾지 못함(관련 미병합 branch 없음). Production Site = main 1eb38853(aset-8f81dc83c912), Core /v2/life/expense-summary 배포됨(비로그인 401). 현재 설계상 그 달에 금액이 하나도 없으면 합계 줄을 그리지 않음 — 이것이 '누락'으로 보였을 가능성 [추정]. 이번 변경은 월간 합계 경로를 바꾸지 않았고(월간 검사 360·390·768·1280 PASS) 오늘·주간에서만 숨김(사용자 결정). 로그인 계정 실데이터 확인은 NOT VERIFIED
MOBILE_REGRESSION=PASS(헤드리스 Chrome) — 320·360·375·390·412px 라이트 + 360·412px 다크: 가로 넘침 0, 카드·버튼 잘림 0, 겹침 0, 상단 제목(주·월) 잘림 0. 삼성 인터넷·iPhone Safari 실기기 NOT VERIFIED

## TEST_STATUS

NEW VALIDATOR — scripts/validate_calendar_week_mobile_vertical_01.mjs: PASS
- 폰 7가지(320x640·360x780·375x667·390x844·412x915 라이트, 360·412 다크): rail 일~토 한 열, 각 칸 44px 이상(측정 59px), 오늘·선택(aria-pressed)·공휴일 표시, 기록 수 점 [0,0,0,3(4건),0,1,0], 탭 즉시 전환(같은 작업 안·추가 요청 0건)·포커스 유지, ↓ 키 다음 날, 카드 순서(09:00 → 12:30 → 15:00 → 시간 없는 기록), 금액 카드 안 '12,000원', 긴 제목 3줄 안 전체, rail·카드 겹침 0, 페이지·모달 가로 넘침 0, 대비(320 라이트) 선택 10.57 / 일반 16.1 / 요일 4.93 / 카드 제목 16.1 / 보조 4.93, + 기록 → 저장 → 같은 날 카드 추가, 카드 → 편집 → 삭제 → 카드 제거, 다음 주(9/27–10/3, 같은 요일)·이전 주·오늘(주간 유지), 월간 그리드 + '9월 입력 금액 합계 12,000원', 목록 보기, 주간 재진입. 날씨('날씨 맑음 14° / 24°')·공휴일('대체공휴일 · 공휴일') 표시.
- PC 1280x900 라이트·1024x768 다크: 7열 시간표·24시간 축·rail 0·가로 넘침 0, 오늘 → 일간 보기(기존 동작).

REPO_VALIDATORS (Windows 로컬, scripts/validate_* 230개 전체)
- 1차(병렬 5): PASS 216 / FAIL 14. 실패 14개 직렬 재실행: 10개 PASS(동시 부하성 — 모듈 로드·결과 누락), 4개 FAIL.
- 남은 4개는 수정 전 main 1eb38853 worktree에서도 같은 오류로 FAIL(Windows 기존 RED): validate_image_attachment_thumbnail_01, validate_mobile_footer_legal_sheet_01, validate_place_card_compact_01, validate_site_avatar_fallback_runtime. NEW_FAILURES=0.
- 마지막 코드 수정(합계 조회를 월간 전용으로) 뒤 캘린더를 읽는 검사 74개 재실행: 74/74 PASS. asset 일관성(SITE-ASSET-CACHE-COHERENCE-01) PASS.

## NOT VERIFIED

- 실기기 삼성 인터넷·iPhone Safari: NOT VERIFIED (헤드리스 Chrome 320·360·375·390·412px 측정만). 다음 확인 권장: 실제 폰에서 캘린더 → 주 → 요일 탭.
- 로그인 계정의 실제 일정·가계부 데이터로 본 화면: NOT VERIFIED (게스트 저장소 + 고정 fixture로 확인).

## MERGE_NOTES

- 미병합 캘린더 branch와의 관계: `feature/calendar-lunar-compact-01`(192eb069, 월간 칸만 변경), `feature/calendar-recurring-events-01`(9b902599, 편집기·lifeRow 변경). 시험 병합(git merge-tree, 읽기 전용) 결과 토큰 외 충돌은 기계적 합집합뿐: 음력 branch — `site-calendar-manager.js` lunar import 한 줄(그쪽 `lunarDateCompactLabel` 추가를 받아들이면 됨), `site-calendar.css` `@media (max-width: 380px)` 블록 끝에 양쪽이 각각 규칙 추가(둘 다 유지). 반복 일정 branch — `.github/workflows/site-universal-life-calendar-01.yml`에 양쪽이 검사 한 줄씩 추가(둘 다 유지). 나머지 충돌(html·site-conversation.js·site-person-ui.js)은 그 branch들과 현재 main 사이의 기존 차이로 이 branch와 무관.
- 반복 일정 branch의 lifeRow 표시(반복 표시 등)는 이 주간 카드가 같은 lifeRow를 쓰므로 병합 후 자동으로 카드에 나온다.
