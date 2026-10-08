READY_FOR_DEPLOY=YES

# calendar-recurring-events-01 (Site) — release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/calendar-recurring-events-01
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote origin refs/heads/feature/calendar-recurring-events-01`)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=3d6a5eec14f3e64218ad17c87e1b6ae9cfafaef3 (개발 c9c19e4c → 33aa5d9a 위로 재커밋 → 3d6a5eec 정상 merge)
CODE_SHA=a792b180f863cf48ca9ba96324922f515d763d0b (merge commit; 기능 커밋 3e92ad50)
ASSET_VERSION=aset-486f76db5e27
PAIRED_CORE_BRANCH=lotbi-core feature/calendar-recurring-events-01 (same name) — READY push 2a998eba9000f37625092731397f80c18ba96c80
DEPLOY_ORDER=CORE → SITE (필수). Core가 먼저 나가야 반복·알림 필드가 저장된다. Site만 먼저 나가면 반복을 골라도 Core가 무시해 한 번짜리 기록으로 저장된다.

## SCOPE (반복 일정 + 반복 알림, 기록 편집기)

- 로그인 기록의 편집기에 칩 2개 추가: '반복'(반복 안 함·매일·매주·2주마다·매월·매년·사용자 지정[요일 여러 개 + N주마다], 반복 종료: 종료 없음/날짜까지)
  과 '알림'(알림 없음·정각·5분·10분·30분·1시간·1일 전). 빈 기록은 기존처럼 모든 칸이 닫힌 채 열린다.
- 매월 29~31일·매년 2/29를 고르면 "없는 달에는 마지막 날" 안내. 하루 종일 기록에 알림을 고르면 "오전 9시 기준" 안내.
- 알림 권한 안내(권한을 여기서 묻지 않음 — 기존처럼 캘린더 설정의 '알림 사용' 버튼만 권한을 묻는다):
  차단됨 → "브라우저 사이트 설정에서 알림을 허용해 주세요… LOTBI 앱에서는 앱 알림", 미지원 → 앱 알림 안내,
  허용+구독됨 → "이 브라우저와 LOTBI 앱으로 알려 드려요", 그 외 → 설정의 알림에서 켜는 방법 안내.
- 반복 기록 수정: 반복·알림을 바꾸면 반복 전체에 적용, 그 밖의 변경은 "이 날짜만 / 반복 전체 / 취소"를 묻는다.
  반복 전체 수정 시 그 회차에서 옮긴 날짜만큼 반복 시작일을 옮긴다(시작일 기준 계산).
- 반복 기록 삭제: 확인 창에 '이 날짜만 삭제' + '반복 전체 삭제'. 한 번짜리 기록의 삭제 창·문구는 그대로.
- 하루 목록·목록 보기의 반복 기록에 '↻ 매주' 같은 작은 회색 줄, 읽어 주는 이름에 '반복 …'.
- 월간·주간·목록 화면은 Core가 펼쳐 보낸 회차를 기존 렌더링 그대로 표시(화면 코드 변경 없음).
- 반복 기록에는 금액을 함께 저장할 수 없다는 안내(생활비 지출 반복과 분리). 게스트(로그인 없음) 편집기는 바뀌지 않는다(반복·알림 칩 없음).
- 한 번짜리 기록의 생성·수정·삭제 요청 본문은 이전과 같다(새 필드는 쓸 때만).

## FILES

- site-calendar.js: createLifeActivity/editLifeActivity/removeLifeActivity 선택 필드(recurrence, reminder_offsets_minutes, scope, occurrence_key) + 입력 검증
- site-calendar-manager.js: 편집기 반복·알림 칩/섹션, 범위 선택 창, 삭제 창 두 버튼, 컨트롤러 연결, 하루 목록 반복 표시
- site-calendar.css: 새 칸(44px 터치 높이, 캘린더 토큰만 사용)
- scripts/validate_calendar_recurring_events_01.mjs(신규): 요청 본문(Node) + 실제 편집기(390/1280px) — 회차 표시, 이 날짜만/반복 전체, 삭제 두 버튼, 사용자 지정 생성, 금액 충돌, 권한 안내, 게스트 불변
- .github/workflows/site-universal-life-calendar-01.yml: 신규 validator 연결
- asset token 재생성

## BRANCH HISTORY

- 처음 코드는 공용 clone(deployment-rail-01/lotbi-site)의 worktree에서 c9c19e4c 기준으로 만들었다(미커밋). 2026-10-08 재부팅 때 공용 clone의
  .git/config가 NUL로 손상돼 git을 쓸 수 없게 되어, 전용 clone의 worktree(C:/Users/jshnc/LOTBI-NCLOUD/calendar-recurring-events-01-site-v2)에서
  최신 main 33aa5d9a 위에 변경 파일 5개를 옮겨 커밋했다(3e92ad50). main c9c19e4c..33aa5d9a는 캘린더 파일을 토큰 외에는 바꾸지 않았다.
- a792b180: main 3d6a5eec 정상 merge. main의 편집기 변경(제목이 있어야 저장, saveInFlight)과 이 branch의 저장 경로가 자동 병합됨 —
  이 날짜만/반복 전체 선택을 먼저 하고 그 다음 main 방식으로 saveInFlight를 켠다. 토큰만 다른 충돌은 main 쪽 선택 후 재계산.
  merge 결과의 main 대비 차이 = 이 branch 변경 파일 5개뿐(토큰 제외)임을 파일별로 확인.

## TEST_STATUS

로컬 Windows + Chrome(CHROME_BIN):
- validate_calendar_recurring_events_01(신규): Node 요청 본문 + 실제 편집기 390/1280px PASS — 회차 표시, 하루 목록 '↻ 매주', 이 날짜만 수정(scope OCCURRENCE),
  반복 변경은 질문 없이 SERIES(시작일 유지), 삭제 창 두 버튼·이 날짜만 삭제, 사용자 지정 월·수·금 ~11/30 + 1일 전 알림 생성, 금액 충돌 시 요청 0건,
  알림 권한 차단 안내, 새 칸 44px 이상, 게스트 칩 불변.
- 실제 Core(이 branch와 짝인 Core branch를 로컬 uvicorn으로) 연결 E2E, 390px: 생성·이 날짜만 수정·이 날짜만 삭제·2주마다로 반복 전체 변경·사용자 지정 생성·
  주간(월·수·금 3건)·목록(10건) 표시·반복 전체 삭제 — 요청 본문과 Core 결과 모두 기대대로.
- 33aa5d9a 기준 트리 scripts/validate_* 전체 214개: 1차 194 PASS / 20 FAIL → 재시도 후 남은 것 = main에서도 FAIL인 기존 RED
  (image_attachment_thumbnail_01 · mobile_footer_legal_sheet_01 · site_avatar_fallback_runtime), main에서도 같은 EPERM인 auth_unknown_recovery_browser_01,
  당시 CRLF로 실패한 calendar_system_dark_01(LF로 맞추면 mirror 최신 — main 3d6a5eec의 validator 수정으로 이후 PASS),
  place_card_compact_01(같은 시각 main 33aa5d9a에서도 3회 연속 같은 동적 로딩 실패 — 부하·고정 포트 4213 공유).
- 최종 커밋(a792b180, main 3d6a5eec merge 후): 캘린더 validator 전체 + 대화·캘린더 연결·공통 검사 58개: 49 PASS 1차, 실패 9건(전부 동적 모듈 로딩 실패·결과 누락)은 재시도 PASS.
  asset_cache_version --check PASS.

NEW_FAILURES=0
MAIN_AT_PUSH=ee8c1b6fef4ec11c0bf642f60b0e7ddead067b2e — 3d6a5eec 이후 main 변경은 site-conversation.js(화면 URL)와 validate_site_refresh_route_restore_01뿐으로 이 branch 변경 파일과 겹치지 않음(통합 시 asset token 충돌만 예상).

MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
DEPENDENCIES=Core 같은 이름 branch 먼저 배포. 같은 날 음력 표시 작업(feature/calendar-lunar-compact-01)과는 site-calendar-manager.js·site-calendar.css의 서로 다른 부분만 고침 — 공통 충돌은 asset token뿐.

## NOT TESTED

- 실제 iPhone Safari·카카오톡 내장 브라우저(이 PC에는 WebKit·실기기 없음). 확인은 데스크톱 Chrome 엔진(390px 모바일 폭 에뮬레이션 포함)뿐.
- 실제 푸시 수신(브라우저·앱).

USER_DECISION_NEEDED=NONE
