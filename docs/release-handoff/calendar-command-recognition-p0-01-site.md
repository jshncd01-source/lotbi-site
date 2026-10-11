READY_FOR_DEPLOY=YES
SUPERSEDES=NONE
MIGRATION=NO
DEPLOY_ORDER=CORE → SITE (짝 Core feature/calendar-command-recognition-p0-01-core 먼저. 이 Site가 옛 Core에 새 문장을 보내면 422 → 이 Site는 대화로 넘기므로 오류는 없지만 일정이 등록되지 않음)
USER_DECISION_NEEDED=NONE

# calendar-command-recognition-p0-01-site — 챗 일정 명령 인식(내일·다음 주 화요일·매주·10/20…)

REPO=lotbi-site
FEATURE_BRANCH=feature/calendar-command-recognition-p0-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote origin refs/heads/feature/calendar-command-recognition-p0-01-site`)
REMOTE_FEATURE_SHA=same as FEATURE_SHA after push (checked with git ls-remote at push time)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=afb7057d1d8c149e2b46eb1d656b1049e36b831d (SITE-T52c, push 직전 ls-remote 확인). branch는 이 main에서 시작 — 실제 변경 site-calendar.js · site-conversation.js · scripts/validate_calendar_command_recognition_p0_01.mjs · scripts/fixtures/calendar_command_samples_p0_01.json · .github/workflows/site-review.yml(+이 문서), 나머지 asset 토큰.
CODE_SHA=e74ce077 (product commit 420d0a6f + 포커스 줄 원복·토큰)
ASSET_VERSION=aset-c4f3fd5dd546 (`node scripts/asset_cache_version.mjs --check` PASS, targets 159, refs 193)
PAIRED_CORE_BRANCH=feature/calendar-command-recognition-p0-01-core READY b9eb2203 (main 1f825dd4 병합, MIGRATION=NO)
CONTRACT_CHANGE=NO (Core preview의 선택 필드 recurrence·DATE_ONLY를 받아들임)
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
MERGED_TO_MAIN=NO
DEPLOYED=NO

## 신고 (QA 보고 02 A1 P0 · A2 P1)

- "내일 오후 3시 회의 일정 추가해줘" → AI가 "외부 캘린더에 직접 추가할 수는 없어요". 판별 함수가 15문장 중 2개만 인식, "[QA 점검]"·"롯비야" 앞머리면 0개.
- "다음 주 화요일 오후 3시 치과 일정 추가해줘" → 장소 검색.

## 원인

`site-calendar.js isExplicitLifeCalendarCommand`가 문장 맨 앞 "M월 D일 [오전|오후] H시"만 일정 명령으로 봄 → 나머지는 Core AI 대화로 가서 "외부 캘린더…"·의료 장소 검색. Core 결정론 파서도 같은 한 형태뿐(짝 Core에서 수정).

## 바뀐 것

- `site-calendar.js`: 판별 규칙을 Core 파서와 같게(앞머리 태그·호출어 무시, 상대 날짜·요일·이번/다음 달 N일·10/20·ISO·매일/매주/매달/매년, 오전·오후·아침·저녁·밤·새벽·낮·점심·반·15:30·정오, 새 형태는 등록 말 필요, 질문·부정·남의 일정 거절). 날짜가 실제로 있는지·지났는지는 Core가 판단. 정규식 lookbehind 없음(구형 Safari 모듈 오류 방지). 미리보기 응답이 DATE_ONLY·recurrence를 받아들임.
- `site-conversation.js`:
  - Core가 422 `CALENDAR_COMMAND_UNSUPPORTED`(지난 날짜·10월 32일 등)로 거절하면 오류 대신 일반 대화로 넘김(로그인·비로그인 모두).
  - 비로그인 종일 명령("11월 3일 엄마 생신 등록해줘") → 이 브라우저 캘린더에 종일 일정.
  - 비로그인 반복 명령 → 저장하지 않고 "반복 일정은 로그인한 뒤 등록할 수 있어요…" 안내(브라우저 캘린더는 반복 미지원).
- A2: 치과·병원이 들어가도 날짜+등록 말이면 일정 명령이 먼저 처리되어 장소 검색으로 가지 않음.
- 검사기 `scripts/validate_calendar_command_recognition_p0_01.mjs`(workflow 등록 "Validate calendar command recognition") + 공용 표본 `scripts/fixtures/calendar_command_samples_p0_01.json`(Core 사본과 동일).
- asset 토큰 재계산.

## 검증

- 신규 검사기: 표본 accept 26 전부 명령 · reject 18 전부 아님 · reject_by_date 3 전부 보냄(Core 422) / lookbehind 없음 / preview DATE_ONLY·recurrence 수용·잘못된 DATE_ONLY 거절 / 실제 Chrome 대화(390px): 로그인 — "[QA 점검] 내일 오후 3시 회의 일정 추가해줘"가 입력 그대로 /v2/life/commands로 가고 AI 대화 안 감, "다음 주 화요일 오후 3시 치과 일정 추가해줘"도 명령, "10월 1일 …"은 422 뒤 /v2/conversation/messages로 넘어감 / 비로그인 — 종일 일정 all_day 저장, 반복은 저장 0건 + 로그인 안내, 422 뒤 대화로.
- 수정 전 main afb7057d에서는 FAIL("must be a command: 내일 오후 3시 회의 일정 추가해줘"), 수정본 PASS.
REGRESSION=site-conversation.js·site-calendar.js를 읽는 검사기 + scripts/validate_calendar_* 전부 + 신규 = 161개 순서 실행(CHROME_BIN·PYTHONIOENCODING=utf-8): 158 PASS / 3 FAIL.
  - validate_life_direct_chat_card_compaction_01: 키보드 계약이 `if (!keepComposerClosed) returnComposerFocusAfterTurn();` 4개를 고정 — 처음 수정에서 조건을 덧붙였던 줄을 원래 문장으로 되돌림(e74ce077) → PASS. 되돌린 뒤 포커스·키보드·일정 명령 관련 7개 재실행 7 PASS.
  - validate_calendar_day_panel_two_buttons_01: 간헐(포커스 타이밍) — 재실행 PASS, main afb7057d 재실행 PASS.
  - validate_social_signup_profile_ux_01: "unexpected request" — main afb7057d 기준본에서도 같은 FAIL(기존 실패, 이번 변경 무관).
NEW_FAILURES=0
LINUX_GATE=NOT RUN locally (이 PC에 Linux 없음)
REAL_DEVICE=NOT VERIFIED

## 이번 READY에 넣지 않은 것 (QA 02 나머지 — 다음 작업)

- A3 답변 아래 캘린더 버튼 → 빈 양식(날짜·시간·제목 미반영): 대화 UX방 calendar_draft 계약과 맞춰야 해 별도 READY.
- A4 월 보기 큰 [+ 일정 추가] 버튼, A5 '일정/기록' 명칭, A6 오전/오후 시간 선택·"시간 1500" 칩, A9 날짜 선택기 통일: P2 묶음으로 별도.

## 배포 후 확인 제안 (소유자 실기기)

1. 로그인 → 챗에 "내일 오후 3시 회의 일정 추가해줘" → "10월 …일 오후 3시에 ‘회의’ 일정을 추가했어요." + 캘린더에 생김.
2. "다음 주 화요일 오후 3시 치과 일정 추가해줘" → 장소 검색이 아니라 일정 추가.
3. "매주 월요일 오전 10시 팀 회의 등록해줘" → 반복 일정.
