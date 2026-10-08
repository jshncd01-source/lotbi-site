READY_FOR_DEPLOY=YES

# calendar-lunar-compact-01 — release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/calendar-lunar-compact-01
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote origin refs/heads/feature/calendar-lunar-compact-01`)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=3d6a5eec14f3e64218ad17c87e1b6ae9cfafaef3 (개발 c9c19e4c → 33aa5d9a 위로 재커밋 → 3d6a5eec 정상 merge)
CODE_SHA=f367f38e66c5b3a98971dbdb6a3042ce6c7b5851 (merge commit; 기능 커밋 78da051f)
ASSET_VERSION=aset-da1cc4911b7a

## SCOPE (월간 캘린더 음력 표시 간결화, Site only, 최소 UI 수정)

- 월간 칸의 음력이 양력 숫자 "아래"에서 "바로 오른쪽"으로 옮겨졌다. 표기: 평소 '음28', 음력 월이 바뀌는 날(음력 1일)만 '음9.1', 윤달 시작은 '음윤5.1'.
- 글자: 데스크톱 10px, 폰 9px. 색은 새 토큰 `--lotbi-calendar-lunar-ink`(라이트 #687180 / 다크 #a8b2c0) — 소비자 화면이 muted-ink를 본문색으로 덮어써도 음력은 회색으로 남는다.
- 칸을 읽어 주는 이름(aria-label)은 전체 표기 '음력 8월 15일'을 그대로 유지. 주간 헤더·일정 상세의 '8월 15일' 표기는 바꾸지 않았다.
- 칸 높이·7열 구조·토/일/공휴일 색(숫자에만 적용)·오늘 링·선택 칸 스타일은 그대로. 음력을 끈 화면은 DOM·CSS가 바뀌지 않는다(새 CSS 선택자는 모두 `[data-lunar="true"]` 칸 또는 `.calendar-date-line`/`.calendar-date-lunar` 한정).
- 좁은 폰(357px 이하, 칸 약 39px 이하)은 모든 칸의 음력을 숫자 바로 밑에 일관되게 둔다. 358px 이상은 한 줄이며, 한 줄에 안 들어가는 드문 긴 표기(예: 360px에서 '음12.1', 390px에서 '음윤5.1')만 숫자 밑으로 내려간다 — 잘림·겹침 없음, 칸 높이 그대로.
- 음력을 켠 폰 칸에서만: 날씨 글리프는 오른쪽 위 → 오른쪽 아래(기록 점 줄 아래), '확인 필요' 점은 오른쪽 아래 → 오른쪽 위, 오늘 점은 숫자 오른쪽 위에 겹쳐 표시(줄 폭을 쓰지 않음). 태블릿 폭(컨테이너 ≤679px)은 날씨 글리프 자리를 비워 두고 넘치면 음력이 숫자 밑으로.
- 날짜 계산 로직(solarToLunar, 음력 데이터)과 일정 기능은 변경 없음.

## FILES

- site-calendar-lunar.js: `lunarDateCompactLabel()` 추가(기존 `lunarDateLabel` 유지)
- site-calendar-manager.js: 월간 칸 렌더링(숫자+음력 한 줄 `.calendar-date-line`, `data-lunar`/`data-weather` 표시)
- site-calendar.css: 음력 토큰·한 줄 배치·폰/태블릿 배치 규칙
- scripts/validate_calendar_lunar_model_01.mjs, scripts/validate_calendar_lunar_settings_ui_01.mjs: 새 표기 단정으로 갱신
- scripts/validate_calendar_lunar_compact_layout_01.mjs(신규): 실제 대화 팝업 틀(site-calendar-chat-popup) + 날씨·기록 점·공휴일·오늘·확인 필요 표시가 있는 상태에서 320/344/360/375/390/412/600/700/768/1024/1280px × 3개월(2026-10, 2027-12 '음12.1', 2028-06 '음윤5.1')을 한 번의 Chrome 실행으로 측정 — 겹침·잘림 0, 음력 켬/끔 칸 높이 동일
- .github/workflows/site-universal-life-calendar-01.yml: 신규 validator 연결
- asset token 재생성(asset_cache_version.mjs --write)

## BRANCH HISTORY

- 처음 코드는 공용 clone(deployment-rail-01/lotbi-site)의 worktree에서 c9c19e4c 기준으로 만들고 커밋(ab431cfc, push 안 함)했다.
  2026-10-08 재부팅 때 그 공용 clone의 .git/config가 NUL로 손상돼 git을 쓸 수 없게 되어, 전용 clone(C:/Users/jshnc/LOTBI-NCLOUD/calendar-site-clone-20261008)에서
  최신 main 33aa5d9a 위에 같은 변경 파일을 옮겨 다시 커밋했다(78da051f). main c9c19e4c..33aa5d9a의 변경은 급식 카드·축제 뒤로가기·검사 파일이며
  캘린더 파일은 토큰만 바뀌었다. 옮긴 결과의 asset 토큰(aset-9d81fcdb301d)이 이전 worktree에서 main을 merge한 결과와 같아 내용 동일을 확인.
- f367f38e: 그 사이 main이 3d6a5eec로 나가(캘린더 편집기 하단 대비·system-dark validator CRLF 수정 등) 정상 merge. 토큰만 다른 충돌은 main 쪽 선택 후 재계산,
  실제 충돌 1곳은 이 branch의 음력 import 줄(site-calendar-manager.js). merge 결과의 main 대비 차이 = 이 branch 변경 파일 7개뿐(토큰 제외)임을 파일별로 확인.

## TEST_STATUS

로컬 Windows + Chrome(CHROME_BIN):
- 개발 트리(c9c19e4c 기준) scripts/validate_* 전체 213개: 1차 197 PASS / 16 FAIL → 16건 단독 재실행 후 남은 5건 중
  validate_image_attachment_thumbnail_01 · validate_mobile_footer_legal_sheet_01 · validate_site_avatar_fallback_runtime 는 main에서도 FAIL(기존 RED),
  validate_auth_unknown_recovery_browser_01 은 main에서도 같은 Windows 임시 Chrome 프로필 삭제 EPERM으로 FAIL(환경),
  validate_place_card_compact_01 은 단독 재실행 PASS(부하성).
- 최종 커밋(f367f38e, main 3d6a5eec merge 후): 캘린더 validator 전체 + life_calendar_client · guest_calendar_local · conversation_calendar_* · message_calendar_footer_editor ·
  consumer_design_shell · site_refresh_route_restore · validate_site/hardening/accessibility(.py) · mobile_entry 58개: 52 PASS 1차, 실패 5건(동적 모듈 로딩 실패·결과 누락·fixture 시간 초과)은 재시도 PASS.
  validate_calendar_lunar_compact_layout_01(11폭×3개월, 겹침·잘림 0, 음력 켬/끔 높이 동일) PASS, validate_calendar_system_dark_01 PASS, asset_cache_version --check PASS.
- 같은 PC에서 다른 세션 10여 개가 Chrome 검사를 동시에 돌려(고정 포트 공유) 부하성 간헐 실패가 많았다 — 모두 단독 재실행으로 판정.

NEW_FAILURES=0
MAIN_AT_PUSH=ee8c1b6fef4ec11c0bf642f60b0e7ddead067b2e — 3d6a5eec 이후 main 변경은 site-conversation.js(화면 URL)와 validate_site_refresh_route_restore_01뿐으로 이 branch 변경 파일과 겹치지 않음(통합 시 asset token 충돌만 예상).

MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
CORE_CHANGE_REQUIRED=NO
DEPENDENCIES=없음. 같은 날 반복 일정 작업(feature/calendar-recurring-events-01, Site)도 site-calendar-manager.js·site-calendar.css의 다른 부분을 고친다 — 두 branch 모두 main 위에서 서로 다른 줄을 바꾸며, 공통 충돌은 asset token뿐(관례대로 main 쪽 선택 후 --write).

## NOT TESTED

- 실제 iPhone Safari·Android 실기기·카카오톡 내장 브라우저(이 PC에는 WebKit·실기기 없음). 확인한 것은 데스크톱 Chrome 엔진의 폭별 측정(에뮬레이션)뿐이다.

USER_DECISION_NEEDED=NONE
