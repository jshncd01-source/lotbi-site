READY_FOR_DEPLOY=YES

# LOTBI 캘린더 시안 04 — Site (Desktop Web · Mobile Web)

- 작성: 2026-10-14 KST, Claude 캘린더 방(소유자 확정 시안 04 구현·배포 담당)
- 저장소: `lotbi-site`, branch `feature/calendar-design-04-site`
- 기준: Ncloud main `47afe0ed2ca463f9700146936806952d5a4f865c`(10-15 08:4x 병합) 위의 미배포 branch `feature/calendar-approved-design-final-03-site`(e5b0edae, Codex 작업 중지 후 이어받음)
- 시안: 소유자 확정 캔버스 "LOTBI 캘린더 시안 04"(PC 웹·모바일 웹·iPhone·Android 29장), 소유자 "니가 만든 시안대로 배포 해줘"
- asset version: `aset-ebc2f6773899`
- 선행 배포: **Core `feature/calendar-design-04-core`(예정/실제 지출 · 기상청 초단기실황) 먼저.** Core 이전 버전은 `expense_status`를 버리므로, Site만 먼저 나가면 '예정 지출'이 실제 지출로 저장된다.

## 바뀐 것 (작업 공간 캘린더에만 적용, 작업 공간 밖 기존 화면은 그대로)

1. **같은 역할 버튼은 한 화면에 하나.** 머리글의 `+ M월 D일 일정 추가`(주·월은 선택한 날짜, 년·일정은 `+ 일정 추가`). 날짜 상세의 `+ 일정`, `이 날짜에 일정 추가`, 툴바 아래 버튼 줄을 없앴다. `사진으로 추가`는 보조 버튼 하나(넓은 화면 = 가계부 카드, 휴대폰 = 아래 가계부 줄).
2. **날짜 띠**: 선택한 날짜 · 오늘 · 공휴일 이름(`한글날 · 공휴일`) · 음력 · 날씨. 오늘은 `지금 N°`(기상청 초단기실황, Core가 보낼 때만), 다른 날은 `예보`, 지난 날은 날씨 없음, 예보 끝 뒤는 "날씨 예보는 M월 D일까지". 출처 `기상청 실황 · HH:MM` / `기상청 예보 · HH:MM 발표`. 날씨 그림은 기존 결정대로 기상청 이모지.
3. **주**: 왼쪽 7일(개수·지출) + 선택한 날 시간표. 같은 시각 일정은 한 칸(`같은 시간 N개`, PC 나란히·휴대폰 위아래), 1시간 넘게 빈 구간은 `오후 1:00–3:30 비어 있음` 한 줄.
4. **월**: 칸 = 날짜·음력·공휴일 이름·일정 3개·예보. 겹침 창(날짜 상세 모달/시트) 없음 — 넓은 화면은 오른쪽 '선택한 날' 카드, 휴대폰은 달력 아래 목록. 오늘 = 파란 원, 선택한 날 = 파란 테두리.
5. **년**: 월별 실제 지출 막대 + 12달 카드(일정 수 · 날짜별 진하기 · 지출).
6. **일정 목록**: 다가오는 · 이번 달 · 금액 있는 · 날짜 미정(개수 표시), 날짜별 묶음과 지출/예정 합. 비었을 때 직접 입력/사진 등록 안내.
7. **가계부**: 실제 지출만 합계, 예정(결제 전)은 따로. 분류 색 하나(음식 #C63F32 · 여행 #1769C2 · 쇼핑 #8B3AAF · 생활비 #147A52 · 기타 #A85C00 · 미분류 #667085 = 앱 확정 값)를 일정 카드·합계·입력 칩이 같이 쓴다. 합계를 누르면 지출 내역(실제/예정 칸, 분류 거르기, 날짜별).
8. **일정 상세**(새 창): 예정/실제 금액, 예정이면 `실제 지출로 기록`(금액 고쳐 기록 → 합계에 한 번만), 반복·알림·장소·메모, 수정·삭제(반복이면 이 날짜만/전체).
9. **일정 추가·수정**: 제목 먼저(포커스) → 날짜(선택한 날짜 자동)·시간·종일 → `필요할 때만 더 입력하세요` 접힌 줄(지출 연결 · 반복 · 알림 · 장소 · 메모 · 여러 날 · 상점). 지출 연결 = 지출 없음/예정 지출/실제 지출 + 금액 + 분류. 휴대폰은 머리글 `[취소 · 일정 추가 · 저장]`이라 키보드가 열려도 저장이 보인다.
10. **사진으로 추가 확인**(새 창): 원본 사진(이 브라우저 임시 주소, 닫으면 해제) 옆에 일정 카드·지출 카드. 날짜가 같으면 금액이 든 일정 1건, 다르면 일정·지출 2건. 등록 전에는 저장하지 않음. Core 초안의 예정/실제 제안을 쓰고, 없으면 미래 날짜 = 예정.
11. 다크 모드: 색 변수만 바꿈(`body[data-site-theme="dark"]` + system 미러), 생성기 `generate_calendar_system_dark.mjs` 재실행.

## 데이터 계약

- `entry.expense_status`: `PLANNED | PAID | null`. 금액 없으면 null, 상태 없는 옛 금액 = PAID(Core·Guest·Site 같은 규칙). Site 쓰기 경로 `calendarEntryDetails`, Guest `normalizeEntry`, 비로그인 합계 `expenseSummaryFromEntries`(예정 분리).
- 합계 요청: `GET /v2/life/expense-summary?...&include_planned=true` — Core는 이 옵션이 있을 때만 `planned_amount_minor` / `planned_entry_count`(통화·분류)와 예정만 있는 행(`entry_count: 0`)을 보낸다. 옛 Core는 옵션을 무시하고 예정 0으로 읽힌다.
- 날씨 응답: 선택 필드 `current {temperature_c, precipitation_kind, observed_at, source: "KMA_NOWCAST"}` — 모양이 틀리면 무시(null).
- 사진 초안 `entry.expense_status` 제안 — 모르는 값은 null. 대화창 `등록` 한 번 저장(`site-calendar-draft-write.js`)과 대화 저장소(`site-conversation.js`)도 이 제안을 그대로 넘긴다(예약 = 예정, 영수증 = 실제, 제안 없으면 보내지 않음 = 예전처럼 실제).

## 사용자 시나리오 (USER_FIRST)

1. **오늘 점심 28,000원(결제 전) 남기기 — PC**: `+ 10월 14일 일정 추가`(1) → 제목 입력 → `지출 연결`(1) → `예정 지출`(1) → 금액 입력 → `음식`(1) → `저장`(1). 탭 5번. 날짜는 이미 채워짐. 막힌 곳 없음. 증거 `pc-add.png`, `pc-add-money.png`.
2. **결제한 뒤 실제 지출로 옮기기**: 일정 카드(1) → `실제 지출로 기록`(1). 탭 2번. 합계 628,000원 → 656,000원, 예정 328,000원 → 300,000원(한 번만). 증거 `pc-detail.png`, `pc-after-paid.png`, `pc-ledger.png`.
3. **휴대폰에서 날짜 고르고 그날 일정·지출 보기**: `월`(1) → 날짜(1). 탭 2번. 달력 아래 목록에 일정·금액, 아래 가계부 줄은 접힌 한 줄(누르면 펼침). 증거 `m-month.png`, `m-ledger.png`.
4. **가정통신문 사진 → 체험학습 + 체험비**: `사진으로 추가`(1) → 사진 고르기 → 확인 창에서 지출 날짜 10월 20일 → `2건 등록`(1). 검사기로 확인(2건 나뉨·같은 날이면 1건·누르기 전 저장 없음). 운영 로그인 계정 실사진은 NOT TESTED.

## 검증

- 새 검사기 `scripts/validate_calendar_design_04.mjs`: 1440·1280·390·360 폭 PASS — 보이는 일정 추가 1개(선택한 날짜 문구)·사진 1개, 날짜 띠(지금/예보·음력·공휴일 이름·기상청), 같은 시간 묶음·빈 시간 접기, 실제만 합계·예정 따로, 실제 지출로 기록 1회 반영, 편집기(제목 먼저·접힌 지출·휴대폰 머리글 저장), 월 겹침 창 없음, 년·일정 목록, 사진 1건/2건, 다크 카드, 가로 넘침 0.
- 실제 `index.html#calendar`(비로그인, Core 응답은 가짜) 화면 20장: `docs/release-handoff/evidence/calendar-design-04-site/`.
- `node scripts/asset_cache_version.mjs --check` PASS (`aset-ebc2f6773899`).
- 기존 캘린더 검사기 일괄 결과는 아래 「Gate 전 검사」에 적는다.

## Gate 전 검사 (로컬 Windows, 2026-10-14 23시)

- 브라우저 검사기 1차(캘린더 관련 42개): 37 PASS, 5 FAIL → 아래처럼 시안 04 기준으로 고친 뒤 개별 재실행 전부 PASS.
- 옛 디자인(날짜 창·버튼 두 개·월 합계 줄·대화 위 창)을 전제로 하던 검사기를 시안 04의 같은 약속으로 옮겼다(약속은 줄이지 않음):
  - `validate_calendar_day_panel_two_buttons_01` — 버튼 하나(`M월 D일 일정 추가`)+사진 하나, 선택한 날은 화면 안(넓은 화면 오른쪽 카드·휴대폰 달력 아래), 오늘만 선택, 입력칸·커서 없음, 취소·저장 뒤 같은 날.
  - `validate_calendar_modal_runtime_02` — 월 칸 3개+`+N개 더`(휴대폰 점), 일정 상세→수정/삭제·삭제 확인 1개·Escape는 맨 위 창만, 날짜 미정 칩, 설정 창 Tab 가둠.
  - `validate_calendar_touch_monthnav_daysheet_01` — 밀어서 달 넘김(휴대폰만), 선택한 날 목록 위치, Escape 한 번은 날짜로·캘린더는 유지.
  - `validate_calendar_expense_summary_01` — 실제만 합계·예정 따로, 보기별 기간(월·주·일정=그 달, 년=그 해), `include_planned=true`, 401/403 상태 줄, 비로그인 계산, 금액 없는 기록, 통화 분리, 대비·넘침.
  - `validate_message_calendar_footer_editor_01` — 캘린더는 승인된 전체 화면 작업 공간(region), 닫으면 대화 그대로.
  - 정적: `validate_calendar_compact_editor_01`(`expense_status`), `validate_calendar_editor_footer_contrast_01`(휴대폰 머리글 저장), `validate_calendar_responsive_01`·`validate_subview_back_navigation_01`·`validate_calendar_secondary_surfaces_01`(새 화면 선택자·뒤로 가기 대상 9개), `validate_conversation_calendar_auto_suggest_01`(사진 초안 예정/실제 전달).
- 2차(수정 뒤, 캘린더·대화·지출 관련 브라우저 56개): 55 PASS. 1 FAIL `validate_chat_dark_login_kakao_share_01`는 운영 main 2047877에서도 이 PC에서 같은 실패(카카오 공유 메뉴, 캘린더와 무관).
- 브라우저 없는 검사기 154개: 152 PASS. `validate_calendar_secondary_surfaces_01`은 갱신 후 PASS. `validate_message_share_actions_01`은 이 PC 작업본의 CRLF 줄바꿈 때문(커밋본은 LF, Linux Gate 해당 없음).
- 검사기를 옮기다 찾은 제품 결함(고침):
  1. 휴대폰 아래 가계부 줄이 좌우로 16px 넘쳐 내용이 옆으로 밀림(360~900px 전부) → 음수 여백 제거.
  2. 선택한 날 목록에서 Escape를 누르면 캘린더 전체가 닫힘 → 첫 Escape는 날짜로 돌아감.
  3. 휴대폰 가계부 줄이 합계를 못 불러와도 이유를 안 보이고 "계산하는 중"이라고 읽음 → 이유를 상태 줄로.
  4. 지출 내역 창에 다른 통화·"이 기기 기록" 안내가 없음, 닫을 때 숨은 단추로 포커스 → 보이는 합계 단추로.
  5. 일정 상세를 닫으면 숨은 휴대폰 목록 쪽으로 포커스 → 보이는 일정 줄로.
  6. 금액 없이 분류만 있는 기록을 고칠 때 `지출 연결` 줄에 분류가 안 보임 → 분류 표시.

## NOT TESTED

- 운영 로그인 계정의 저장·재조회·사진 인식(로그인 경로는 로컬에서 재현 불가).
- 기상청 실황 실제 호출(Core 배포 전, 가짜 응답으로만 확인).
- 실제 iPhone Safari · 삼성 인터넷 · Android Chrome 실기기.

## 배포 전 필수 정보

- DB migration: NO · Secret/ENV: NO · LIVE MONEY: NO · 소셜 공개 범위: NO
- 선행: Core `feature/calendar-design-04-core` 운영 반영
- 롤백: 직전 운영 Site 이미지(main 20478774)로 deploy-both 되돌리기
