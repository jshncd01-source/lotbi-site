READY_FOR_DEPLOY=YES
SUPERSEDES=NONE (참고용 wip/calendar-add-ux-01-site befb8d76은 READY가 아니었음 — 이 branch에는 그 WIP 표시 커밋이 없음)
MIGRATION=NO
DEPLOY_ORDER=SITE ONLY (Core 변경 없음)
USER_DECISION_NEEDED=NONE (배포총괄방 범위 승인: A3는 대화 UX방 1851a70e #8, 이 READY는 A4·A5·A6 + '오후 3:00'/'15:00' 통일, A8·A9는 다음)

# calendar-add-ux-01-site — 캘린더 추가 버튼 항상 보이기·'일정' 말 통일·12시간 시간 (QA 02 A4·A5·A6)

REPO=lotbi-site
FEATURE_BRANCH=feature/calendar-add-ux-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote origin refs/heads/feature/calendar-add-ux-01-site`)
REMOTE_FEATURE_SHA=same as FEATURE_SHA after push (checked with git ls-remote at push time)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=68b3161e695d926a4c2fc7e53d315fcb958756ac (SITE-T55 운영, push 직전 ls-remote 확인). 개발은 7c4f0944에서 시작(62f04b41·65e5ca50), 68b3161e를 병합(182f8305) — 충돌 site-calendar-ui.js(토큰+import 한 줄)·validate_message_calendar_footer_editor_01(대화 UX방 새 판정 채택), 그 뒤 12시간 표시 마무리.
CODE_SHA=41fa680a
ASSET_VERSION=aset-8b15f2233e34 (`node scripts/asset_cache_version.mjs --check` PASS, targets 166, refs 202)
CONTRACT_CHANGE=NO
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
MERGED_TO_MAIN=NO
DEPLOYED=NO

## 바뀐 것 (화면)

- **A4 추가 버튼 항상 보이기**: 월·주·목록 보기에서 툴바·금액 줄 바로 아래에 [사진으로 추가] [+ 일정 추가]가 처음부터 있다(48px, 연도 보기만 없음). 날짜를 고르면 "+ 10월 12일 일정 추가"처럼 그 날짜 이름. 날짜를 누르면 뜨는 시트/창에도 같은 두 버튼(시트가 위 버튼을 덮기 때문).
- **A5 말 통일**: 캘린더 화면 글자 '기록' → '일정'(사진에서 기록 읽기 → 사진으로 추가, + 기록 → + 일정 추가, 안내·오류 문구 45곳, 금액 줄 설명 2곳).
- **A6 시간 넣기**:
  - 편집창에서 시간·금액 칸이 처음부터 열려 있다(장소·메모·종료·더보기는 눌러서 열기).
  - 시간은 [오전][오후] 버튼 + "3:00"처럼 12시간. "3"·"330"·"3시 반"·"오후 3:30"도 됨. 오전/오후를 안 고르면 1~6시는 오후, 앞자리 0("09:00")은 쓴 그대로 24시간.
  - 종료 시각은 시작 이후 첫 시각(시작 오후 3시·종료 "5" → 오후 5:00).
  - 빠른 시간 [오전 9시][낮 12시][오후 6시], 오류 문구 "시간을 3:30이나 15:30처럼 입력하거나 위의 시간 버튼을 눌러 주세요."
  - 편집창 칩·빠른 시간·분류·취소/저장 48px.
- **'오후 3:00' vs '15:00' 통일**: 편집창이 12시간이 되면서, 시간을 보여 주는 곳을 전부 같은 형식으로 맞춤.
  - 대상: 날짜 창·목록 행("오후 3:00", 종료 "~오후 5:30"·같은 오전/오후면 "~10:00"), PC 월 칸("오후 6:00 회식"), 주간 시간표 블록, 읽기 전용 상세, 여러 날 일정("10/12 오후 3:00 → 10/13 오전 11:00"), 예전 생활 캘린더 목록.
  - 휴대폰 주간(세로 카드)은 칸이 좁아 "오전" 작은 줄 + "9:00" 두 줄.
  - 날짜 창 시간 칸 52→66px(한 줄).

## 「사용자 시나리오」

실제 index.html을 로컬 정적 서버로 열고 손가락 위치 그대로 누름(CDP 마우스, 가림·스크롤·48px 미만 자동 검사). 비로그인(이 기기 저장). 테마는 운영과 같게 body[data-site-theme] 맞춤. 시작 = 홈. 스크린샷 `C:\Users\jshnc\LOTBI-NCLOUD\release-control\user-scenarios\calendar-add-ux-01-site\{before,after}\` (before = 7c4f0944).

| # | 하려는 일 / 상태 | 수정 전 (캘린더 안 버튼 수) | 수정 후 (캘린더 안 버튼 수) | 막힌 곳 | 스크린샷 |
|---|---|---|---|---|---|
| S1 | "오늘 점심 12,000원 적기" — 휴대폰 390 라이트 | 4: 오늘 날짜 → **+ 기록(45×30px)** → 금액 칩 → 저장 | **2**: + 일정 추가 → (제목·금액 입력칸) → 저장 | 전: + 기록 30px / 후: 없음 | before `before-lunch-phone-light-*`, after `lunch-phone-light-0{1..4}` |
| S1b | 같은 일 — 휴대폰 다크 / 360 넓은 글꼴 / PC 1280 라이트·다크 | PC 4(오늘 날짜 → + 기록 → 금액 칩 → 저장) | 2 | 없음 | after `lunch-phone-dark-*`·`lunch-phone-wide-*`·`lunch-pc-{light,dark}-*`, before `before-lunch-pc-light-*` |
| S2 | "내일 오후 3시 치과" — 휴대폰 다크 | 4: 내일 → + 기록(30px) → 시간 칩 → 저장, 시간은 "15:00"만 됨 | 3: 내일 → + 일정 추가 → 저장, 시간 칸에 "3"만 → "3:00 [오후]" 자동, 날짜 창 "오후 3:00 치과" | 없음 | before `before-dentist-phone-dark-*`, after `dentist-phone-dark-0{1..4}`·`dentist-pc-light-*` |
| S3 | "오늘 저녁 6시 회식" — PC 1280 라이트·다크 | (미촬영) | 3: + 일정 추가 → [오후 6시] → 저장, 월 칸 "오후 6:00 회식" | 없음 | after `dinner-pc-{light,dark}-0{1..4}` |
| S4 | 주간 보기에서 확인 — 휴대폰 360 라이트, 긴 제목 | "09:00" | "오전 / 9:00" 두 줄, 제목 2줄 | 없음 | before `before-week-phone-light-0*-week`, after `week-phone-light-01-week` |

- 금액 줄은 저장 직후 "10월 입력 금액 합계 12,000원", 미분류 12,000원(분류 안 고르면 미분류).
- 홈 → 캘린더 진입은 그대로(휴대폰 메뉴 → 캘린더 2번, PC 캘린더 1번).
- **로그인 상태: 미실행**(로컬 Core 없음). 저장 함수만 다르고 화면·편집창은 같음.

## USER_FIRST 기준

- ① 캘린더 안에서 금액 적기 4→2번, 시간 있는 일정 4→3번(날짜 고르기 포함).
- ③ 막다른 곳 없음.
- ④ 편집창·날짜 창·월 칸·주간·목록이 같은 "오후 3:00"(이번 핵심).
- ⑥ 추가 버튼·편집창 버튼 48px(전 + 기록 30px).
- ⑦ 휴대폰·PC × 라이트·다크 + 넓은 글꼴, 비로그인만.
- 그대로 둔 것:
  - 메뉴 열기·사이드바 캘린더 44px — 공용 내비, 이 READY 범위 밖.
  - 대화 답변 카드 시간("2026년 10월 12일 오후 3시")은 대화 쪽, 이미 12시간.

## 다음 (이 READY에 없음)

- T55 운영 확인 S3: 비로그인 반복 일정 안내에 [로그인] 버튼 없음(③) → 배포방 지시로 이 방 다음 조각(답변 아래 액션 줄 재사용).
- A8 휴대폰 월 칸 첫 일정 제목, A9 날짜 선택기 통일.

## 검증

- 갱신한 검사기(새 설계로 기대값 교체, 판정 약화 아님):
  - 버튼 이름·위치: add_from_image_01, day_panel_two_buttons_01(+상단 버튼 48px·눌림 단정 추가, 가짜 화면에 실제 페이지의 expense·weather CSS 추가), week_timegrid_ui_01, week_mobile_vertical_01, mobile_week_ux_weather_01.
  - 편집창: compact_editor_01(시간 규칙 단정 18개 추가), editor_field_height_01, recurring_events_01.
  - 문구: event_editor_01·real_ui_01·modal_runtime_02 외.
  - 12시간 표시: day_list_range_01, product_model_01, conversation_calendar_auto_suggest_01(eventSpanText).
REGRESSION=41fa680a(병합본)에서 캘린더 관련 검사기 82개 순서 실행(scripts/validate_calendar_* 전부 + site-calendar·calendar-editor·calendar-life·calendar_command를 읽는 검사기 전부, CHROME_BIN·PYTHONIOENCODING=utf-8) → 78 PASS / 4 FAIL, 4개 모두 PC 과부하(Chrome 78개 동시) 중 시간 초과·"result missing"이었고 자리표(slot2) 잡고 하나씩 다시 돌려 모두 PASS: calendar_editor_field_height_01, calendar_expense_summary_01, calendar_lunar_settings_ui_01, chat_read_aloud_restore_browser_01. 병합 전(62f04b41)에는 81개 PASS(불안정 site_refresh_route_restore_01 재실행 PASS).
NEW_FAILURES=0
LINUX_GATE=NOT RUN locally. 넓은 글꼴(DejaVu) 강제 조합 포함(mobile_week_ux_weather_01·month_temperature_01).
REAL_DEVICE=NOT VERIFIED

## 배포 후 확인 제안

1. 휴대폰 캘린더 → 월: 금액 줄 아래 [사진으로 추가][+ 일정 추가]가 바로 보임 → + 일정 추가 → 제목 "점심", 금액 12000 → 저장 → 금액 합계 12,000원.
2. 날짜 하나 누름 → + 일정 추가 → 시간 칸 "3" → [오후] 눌림·"오후 3:00" → 저장 → 날짜 창 "오후 3:00".
3. PC 월 칸에 "오후 6:00 회식"처럼 12시간.
