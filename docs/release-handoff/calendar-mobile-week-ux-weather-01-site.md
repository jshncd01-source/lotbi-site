READY_FOR_DEPLOY=YES

# calendar-mobile-week-ux-weather-01-site — release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/calendar-mobile-week-ux-weather-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote origin refs/heads/feature/calendar-mobile-week-ux-weather-01-site`)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=ddcc573dca618a3289594220e53bb22d6c414bad (SITE-T37 merge; Production served fa6ed88d aset-1349a7eafa03 at start and at push)
CODE_SHA=2edd6b23a55c5c491ab7bcc89f35a46477386b6b
ASSET_VERSION=aset-5d392d51866c (main ddcc573d: aset-f0f202fb6c78)
CORE_CHANGE=NONE (Core API·데이터·날씨 제공자·인증키 변경 없음)
DEPLOY_ORDER=SITE 단독. 단, 기준 main ddcc573d에 반복 일정 Site(c34cf05b)가 이미 들어 있으므로 RELEASE_QUEUE 2026-10-09 11:35 규칙(Core 반복 일정 수정본 배포 뒤에만 Site 배포)을 그대로 따른다. 이 branch가 새로 만드는 순서 제약은 없다.
PAIRED_WEB_THEME_SYNC=NOT_NEEDED (site-theme-tokens.css 무변경)
USER_DECISION_NEEDED=NONE

## SCOPE

- Site 전용. Core / Web / App / Admin 변경 없음.
- 모바일 캘린더만: ≤900px 세로 주간(rail + 선택 날짜) 화면, ≤600px 캘린더 팝업 틀. 팝업 설명 문구 2개는 모든 폭에서 짧아짐.
- 무변경: PC(901px 이상) 주간 7열 시간표 코드 경로 `renderWeekTimeGrid`, 월간 그리드·월 합계, 목록 보기, 편집기, 반복 일정(단일/전체 범위), 비회원 접근, 로그인·세션, 구독·결제, 일정 데이터와 등록·수정·삭제 API 계약.

## CHANGE

- `site-calendar-manager.js`
  - `renderWeekVertical`: rail 날짜 버튼 안을 `.calendar-week-rail-line`(날짜 숫자 → 요일, 한 줄) + 기록 점으로. 선택·오늘·공휴일·주말 데이터 속성과 키보드 이동 그대로.
  - `renderWeek(state, actions, weatherCredit, {timezone})`: 세로 주간이면 출처를 **선택 날짜에 실제로 그린 날씨 1건**으로만 계산(`calendarWeatherAttribution([shown])`). PC 시간표는 기존처럼 주 전체(모든 열에 날씨가 보이므로).
  - `renderWeekDayDetail`: 선택 날짜 날씨에 상태 글자 추가(`☀️ 맑음 14° / 24° · 💧30%`, `dayWeatherNode(..., {condition: true})`, 강수확률은 기존 설정·0% 숨김 규칙 그대로). 날씨가 없고 지난 날짜이며 날씨가 켜진 상태(`state.weatherReady` = 위치/지역이 있거나 이미 날씨를 받음)이고 실패 메시지가 없으면 `지난 날짜 날씨 정보 없음` 한 줄.
  - `render()`: 주간에서 `state.weatherReady` 계산, `renderWeek`에 timezone 전달.
  - `dayWeatherNode`: `condition` 옵션(기본 false → 일간 패널·월간 무변경).
- `site-calendar.css` (세로 주간 구역만)
  - rail: 열 58px(≤360px 54px), 날짜 버튼 높이 44px, 숫자 24px 원(오늘 링 유지), 점 4px.
  - 일정: 테두리 카드 → 구분선 행(`시간 40px | 제목·분류 | 금액`, 최소 44px, 테두리·배경 없음, hover만 배경). 시간 없는 기록은 `제목 | 금액`. 긴 제목 4줄까지.
  - 선택 날짜 제목 줄 아래 구분선, 빈 날짜 = 점선 상자 없이 문구 두 줄.
  - 색은 기존 캘린더 토큰만 사용(다크·기기 설정 다크 자동, system-dark 미러 재생성 불필요). 금액 색은 제목과 같음(큰 금액 경고색 없음).
- `site-consumer-design.css`
  - ≤600px 캘린더 팝업: 바깥 여백 8px, 팝업 안쪽 8/12px, 제목 줄 padding 0·제목 18px, 설명 12.5px 한 블록, 내용 여백 축소, shell 간격 8px.
  - 341~380px 팝업: `‹ 기간 › 오늘 ⚙`를 한 줄(390px 이상과 같은 배치). 320~340px은 기존대로 ⚙를 보기 탭 줄로.
- `site-conversation.js`: 팝업 설명 문구만 변경 — 로그인 `내 일정과 생활 기록을 관리합니다.`, 비로그인 `로그인 없이 쓸 수 있어요. 기기 간 동기화는 로그인 후 가능합니다.`
- `scripts/validate_calendar_mobile_week_ux_weather_01.mjs` (신규, PORT 4318) + `.github/workflows/site-review.yml`, `site-universal-life-calendar-01.yml` 등록.
- `scripts/validate_calendar_week_mobile_vertical_01.mjs`: 바뀐 계약 1개만 갱신 — `titleBelowTime`(제목이 시간 아래) → `titleBesideTime`(제목이 시간 옆 같은 줄).
- asset token 재생성(`scripts/asset_cache_version.mjs --write`). 위 파일 외 변경은 토큰뿐.

## ROOT CAUSE — 날씨 출처만 보이던 문제 (캡처: 오늘 10/9, 선택 10/5·10/6)

- [확인된 사실] 운영 Core `/v2/life/weather/public`(전주 좌표, 2026-10-09 조회): 10/4~10/8 → `provider_ready:true, items:[]`, 10/9~10/13 KMA_SHORT, 10/14~10/19 KMA_MID. 지난 날짜에는 관측값이 없다.
- [확인된 사실] Site `forecastWindow`도 오늘부터만 요청한다(10/4~10 주 → 10/9~10/10 요청).
- [확인된 사실] 원인: 폰 세로 주간은 **선택 날짜의 날씨만** 제목 옆에 그리는데, 출처 줄은 **그 주 전체 날씨**(10/9·10/10, 같은 08:00 발표)로 계산했다. 그래서 10/5·10/6을 고르면 날씨는 0건인데 `날씨 출처: 기상청 · 08:00 발표`만 남았다.
- 아닌 것: 모바일 레이아웃 누락(날씨 노드는 있었음, 오늘·미래 날짜는 표시됨), CSS 숨김(없음), 기상청 요청 실패(200 + 데이터), 위치·지역 전달(요청에 좌표 포함), 예보 기간 밖 미래 날짜(10/5·10/6은 과거).
- 날씨 ON/OFF: 설정에 날씨 전체 스위치는 없다. 날씨는 위치(현재 위치 허용) 또는 저장 지역이 있을 때 켜지고, 강수확률 표시는 별도 스위치다. 둘 다 그대로 반영된다.
- '점심'이 '기타'로 보이는 이유: 저장된 `entry.expense_category = OTHER`를 그대로 표시한 것. Site는 OTHER를 자동 지정하지 않는다(편집기 선택 또는 사진·대화 초안에서 Core가 고른 분류 [추정]). 데이터는 수정하지 않았다.

## RESULT (명령문 최종 보고 항목)

WEATHER_ROOT_CAUSE=세로 주간 출처를 주 전체 날씨로 계산 → 날씨 없는 지난 날짜에도 출처만 표시. 지난 날짜는 Core도 데이터 없음(실측)
WEATHER_ON_OFF=IMPLEMENTED — 위치·지역 없음: 날씨·출처·안내 모두 없음 / 있음: 선택 날짜 날씨 + 그 날씨의 출처 / 조회 실패: 기존 실패 문구만, 일정 표시 영향 없음
PAST_DATE_FALLBACK=IMPLEMENTED — `지난 날짜 날씨 정보 없음`, 출처 없음
WEEK_DATE_HORIZONTAL=IMPLEMENTED — `4 일`~`10 토` 한 줄, 44px, 점·선택·오늘·주말·공휴일 유지
EVENT_ROW_COMPACT=IMPLEMENTED — `09:00 점심 200,000원` / `기타`, 구분선 행, 상세·편집 그대로
MOBILE_320_360_390_430=PASS(헤드리스 Chrome) — 7일 모두 첫 화면 안, 가로 넘침 0, 겹침 0. 삼성 인터넷·iPhone Safari 실기기 NOT VERIFIED
DESKTOP_REGRESSION=PASS — 1280·1024 7열 시간표·열별 날씨·주 출처 그대로, 768 태블릿 세로 주간 정상
CALENDAR_REGRESSION=PASS — 아래 TEST_STATUS
BLOCKERS=NONE

## TEST_STATUS

NEW VALIDATOR — scripts/validate_calendar_mobile_week_ux_weather_01.mjs: PASS
- 폰 7가지(320x640·360x640·390x844·430x932 라이트, 360x780 다크, 360x780 날씨 끔, 390x844 날씨 실패) + PC 2가지(1280x900 라이트·1024x768 다크).
- rail `4일`~`10토` 한 줄(숫자 오른쪽 끝 ≤ 요일 왼쪽, 세로 중심 차 <2px), 44px, 폭 54~58px, 7일 모두 첫 화면(마지막 날 아래 583px ≤ 내용 아래 619px @360x640), 점 [0,0,3,0,0,1,0], 선택 채움·오늘 링 구분, 일·토·공휴일 색.
- 팝업: 제목 줄 44px, 주 시작 241~266px, 툴바 44px 대상·제목 잘림 0, 341px 이상 ⚙ 첫 줄.
- 10/6: 탭 즉시 전환(추가 요청 0), 행 [점심, 정형외과…, 장보기 목록], 첫 행 `09:00`·`점심`·`기타`·`200,000원` 같은 줄(분류는 제목 아래), 좌우·위 테두리 0 + 구분선, 행 44px 이상, 금액 색 = 제목 색, 행 → 편집기(점심·200,000·OTHER 그대로) → 취소 → 같은 날.
- 날씨: 오늘 `맑음 14° / 24°`가 제목 옆 + 출처 `· 11:00 발표`, 10/6 날씨·출처 0 + `지난 날짜 날씨 정보 없음`, 10/10 `흐림 … 💧30%` + 출처, 끔 = 셋 다 없음, 실패 = 실패 문구만(출처·지난 날짜 안내 없음).
- 사진에서 기록 읽기·+ 10월 10일에 기록 버튼 유지.

UPDATED — scripts/validate_calendar_week_mobile_vertical_01.mjs: PASS (320~412 라이트·다크 7가지 + PC 2가지, + 기록 저장·삭제·다음/이전 주·오늘·월 합계 포함)

REPO_VALIDATORS (Windows 로컬, 워크플로 등록 195개 + 워크플로 밖 캘린더·날씨·소비자 화면 9개)
- 1차(병렬 3): PASS 182 / FAIL 13.
- 직렬 재실행: 8개 PASS(동시 부하 모듈 로드 실패 6개 + 인자 누락 sync 2개 `--check`). 남은 5개:
  - main ddcc573d worktree에서도 같은 오류로 FAIL(Windows 기존 RED) 4개: validate_image_attachment_thumbnail_01(CRLF 소스 정규식), validate_mobile_footer_legal_sheet_01(761px), validate_place_card_compact_01(모듈 로드), validate_site_avatar_fallback_runtime.
  - validate_profile_menu_improvement_01: 간헐 실패. feature 직렬 7회 중 5회 PASS(실패 2회 모두 `site-conversation.js` 동적 import 로드 실패, 가상 시간 8초), main 4/4 PASS. 이 branch의 `site-conversation.js` 변경은 설명 문자열 2개와 토큰뿐이라 부하성으로 판정 [추정].
- NEW_FAILURES=0. 캘린더 검사 52개 전부 PASS(단독 판정 포함), 반복 일정(validate_calendar_recurring_events_01)·사진에서 기록(validate_calendar_add_from_image_01)·월 합계·PC 시간표·월간 geometry PASS. 워크플로 밖 9개(weather_attribution_01·manual_weather_region_settings_01·weather_region_preference_01·editor_spacing_01·consumer_design_shell_01·consumer_detail_system_01·consumer_documents_01·consumer_predeploy_guards_01·conversation_calendar_result_time_01) PASS.
- asset 일관성 SITE-ASSET-CACHE-COHERENCE-01 PASS(aset-5d392d51866c).

## NOT VERIFIED

- 실기기 삼성 인터넷·iPhone Safari·Android Chrome: NOT VERIFIED (헤드리스 Chrome 320·344·360·390·412·430·768·1024·1280px 측정만). 권장 확인: 폰에서 캘린더 → 주 → 지난 날짜·오늘·내일 탭.
- 로그인 계정 실데이터 화면: NOT VERIFIED (게스트 저장소 + 고정 fixture, 날씨는 운영 응답 형식을 본뜬 mock). 운영 날씨 API 응답 범위는 실측함.
- Linux CI 실행: NOT RUN (Windows 로컬만).

## MERGE_NOTES

- `feature/calendar-lunar-compact-01`(8a31a674, SITE-T38 대기)와 시험 병합: 충돌 64개 중 63개는 asset 토큰뿐. 실제 충돌 1개 = `site-calendar-manager.js` lunar import 한 줄 → 그쪽 `lunarDateCompactLabel` 추가를 받아들이면 된다. CSS·워크플로는 자동 병합(음력은 월간 칸·≤600/≤380 구역, 이 branch는 세로 주간 구역과 consumer-design 팝업 블록). 병합 결과에서 토큰 재생성 후 9개 PASS: lunar_compact_layout_01·lunar_settings_ui_01·lunar_model_01·mobile_week_ux_weather_01·week_mobile_vertical_01·toolbar_polish_01·system_dark_01·cross_platform_ux_01·week_timegrid_ui_01, asset 일관성 PASS.
- 반복 일정 Site(c34cf05b)는 이미 main에 있고, 이 branch는 같은 `lifeRow`를 그대로 쓰므로 반복 표시는 새 행 안에 그대로 나온다.
