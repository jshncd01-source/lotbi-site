READY_FOR_DEPLOY=YES
SUPERSEDES=9b9025990b088d3314cff16318413d0b312c9f1d
ALEMBIC_HEADS=1 (paired Core p0_0107_calendar_recurring_reminders; Site migration 없음)
APP_COMPAT=CORE_FIRST + EXPLICIT_SCOPE — Site는 반복 수정·삭제에 OCCURRENCE/SERIES를 명시하고, 구버전 App 읽기 호환은 Core READY에서 Ncloud App main 593715ce parser로 검증
USER_DECISION_NEEDED=NONE

# calendar-recurring-events-01 (Site) — release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/calendar-recurring-events-01
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote origin refs/heads/feature/calendar-recurring-events-01`)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=fa6ed88d3608536050de0fb56136ae9b920a4c55 (2026-10-09 최종 Ncloud main, fd54a7f4에서 정상 merge)
CODE_SHA=fd54a7f4abca1ca64c9d78d8ce910c1ce156721f (최신 main merge; 반복 전체 삭제 scope 보완 d114b753; 기능 원본 3e92ad50)
ASSET_VERSION=aset-f0f202fb6c78
PAIRED_CORE_BRANCH=lotbi-core feature/calendar-recurring-events-01 (same name) — p0_0107 + SCOPE_REQUIRED_409 READY를 먼저 배포
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
- d114b753: 반복 전체 삭제도 `scope: SERIES`를 명시하고 validator에 요청 본문 회귀 검사를 추가.
- fd54a7f4: 최신 Ncloud main fa6ed88d 정상 merge. main에 포함된 음력·모바일 주간 달력·월간 가계부 및 다른 Site 기능을 보존.

## TEST_STATUS

로컬 Windows + Chrome 154.0.8037.99, 최신 main merge CODE_SHA 기준(2026-10-09):
- SITE-UNIVERSAL-LIFE-CALENDAR-01 Linux gate와 같은 정적·Node·브라우저 검사 목록을 직렬 실행: **전체 PASS**. `validate_site.py`, JS syntax 12개, auth/calendar client·UI·월/년·게스트·실제 편집기·날씨·공휴일·알림·모달·터치·월 geometry·월간 가계부·사진 등록·대화 연결·캐시·주간 timegrid·모바일 세로 주간·반복·음력·toolbar 포함.
- `validate_calendar_recurring_events_01`: PASS — OCCURRENCE 수정·삭제, SERIES 수정·삭제(반복 전체 삭제 요청에 scope SERIES), 사용자 지정 반복, 알림, 금액 충돌, 게스트 불변.
- `validate_calendar_expense_summary_01`: PASS, `validate_calendar_week_mobile_vertical_01`: 320/360/375/390/412px light/dark 및 desktop PASS, `validate_calendar_lunar_model_01`·`validate_calendar_lunar_settings_ui_01`: PASS.
- `python scripts/validate_site.py`: PASS(공개 11페이지), `node scripts/asset_cache_version.mjs --check`: PASS(version aset-f0f202fb6c78, targets 130, refs 156).
- 실제 Core 연결 E2E는 이전 READY에서 390px 생성·회차/전체 수정·삭제·주간·목록까지 PASS했으며 이번 최종 재검증은 mock/fixture 기반 Site gate와 Core 326-test gate로 수행. Production Core smoke는 배포총괄방 담당.

NEW_FAILURES=0
MAIN_AT_PUSH=fa6ed88d3608536050de0fb56136ae9b920a4c55 — 최종 Ncloud main을 정상 merge한 상태.

MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
DEPENDENCIES=Core 같은 이름 branch 먼저 배포. 같은 날 음력 표시 작업(feature/calendar-lunar-compact-01)과는 site-calendar-manager.js·site-calendar.css의 서로 다른 부분만 고침 — 공통 충돌은 asset token뿐.

## NOT TESTED

- 실제 iPhone Safari·카카오톡 내장 브라우저(이 PC에는 WebKit·실기기 없음). 확인은 데스크톱 Chrome 엔진(390px 모바일 폭 에뮬레이션 포함)뿐.
- 실제 푸시 수신(브라우저·앱).
- Core Production 배포 후 반복 일정 smoke 및 Site Production 배포 — 배포총괄방 담당.

USER_DECISION_NEEDED=NONE
