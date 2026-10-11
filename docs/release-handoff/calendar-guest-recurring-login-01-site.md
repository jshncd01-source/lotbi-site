READY_FOR_DEPLOY=YES
SUPERSEDES=NONE
MIGRATION=NO
DEPLOY_ORDER=SITE ONLY (Core 변경 없음 — 로그인 뒤 같은 문장을 다시 보내는 기존 auth-callback autoSend 그대로)
USER_DECISION_NEEDED=NONE (배포총괄방 지시: T55 운영 확인 S3를 이 방 다음 조각으로, 답변 아래 액션 줄 구조 재사용)

# calendar-guest-recurring-login-01-site — 비로그인 반복 일정 안내에 [로그인하고 등록] (T55 운영 확인 S3, 기준 ③)

REPO=lotbi-site
FEATURE_BRANCH=feature/calendar-guest-recurring-login-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote origin refs/heads/feature/calendar-guest-recurring-login-01-site`)
REMOTE_FEATURE_SHA=same as FEATURE_SHA after push (checked with git ls-remote at push time)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=68b3161e695d926a4c2fc7e53d315fcb958756ac (SITE-T55 운영, push 직전 ls-remote 확인). 실제 변경 site-conversation.js · site-conversation.css · site-conversation-sync.js · scripts/validate_calendar_command_recognition_p0_01.mjs (+이 문서), 나머지는 asset 토큰.
CODE_SHA=__CODE_SHA__
ASSET_VERSION=aset-d1b6de155d92 (`node scripts/asset_cache_version.mjs --check` PASS, targets 166, refs 202)
OVERLAP=calendar-add-ux-01-site(5cce2efb)와 겹치는 파일 없음(그쪽은 site-calendar*·검사기). 대화 UX방이 site-conversation.js를 고치는 중이면 충돌은 배포방이 열차에서 해결(배포방 안내).
CONTRACT_CHANGE=NO
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
MERGED_TO_MAIN=NO
DEPLOYED=NO

## 문제 (운영 실측)

2026-10-11 T55 운영 확인 S3:
- lotbiai.com 비로그인 휴대폰에서 "매주 월요일 오전 9시 운동 일정 추가해줘"를 보냄.
- 답은 "반복 일정은 로그인한 뒤 등록할 수 있어요. …" 글뿐이고, 로그인할 버튼이 없음(기준 ③ 막다른 화면).
- 스크린샷: `release-control\user-scenarios\calendar-command-recognition-p0-01-site\prod-20261011\S3-phone-signed-out-weekly-recurring-login-text.jpg`

## 바뀐 것

- 그 답 아래에 **[로그인하고 등록]** 버튼(48px). 누르면 기존 로그인 연결(beginGuestClaimingSiteHandoff)에 보낸 문장을 실어 계정 로그인으로 감.
- 로그인 뒤 auth-callback이 그 문장을 자동으로 다시 보냄(기존 autoSend) → 로그인 캘린더에 반복 일정 등록.
- 버튼은 답과 함께 이 기기 대화 기록에 남아 새로고침 뒤에도 보임. 로그인한 상태에서는 그리지 않음.
- 계정 대화 동기화에는 올리지 않음: `DEVICE_ONLY_META`에 loginAction 추가.
- 모양은 답 아래 기존 행동 버튼(conversation-pet-action-button, 실종 신고하기 등)과 같은 줄 구조, 높이만 48px·글자 14px.

## 「사용자 시나리오」 — "로그인 안 한 채 매주 반복 일정 넣기"

실제 index.html을 로컬에서 열고 손가락 위치 그대로 누름. Core·계정 사이트 요청은 전부 시험용 응답으로 막아 운영에 아무것도 보내지 않음(미리보기 = 매주 월요일 09:00 운동).

| # | 상태 | 수정 전(운영 T55) | 수정 후 | 막힌 곳 | 스크린샷 |
|---|---|---|---|---|---|
__SCENARIOS__

- 로그인 뒤 자동 재전송·반복 일정 저장: 로컬 Core가 없어 화면으로 따라 하지 못함. 기존 auth-callback autoSend 경로(문장 1000자까지 보관)를 그대로 씀.

## USER_FIRST 기준

- ① 버튼 1번 → 로그인 → 문장 다시 칠 필요 없음.
- ② 되묻지 않고 버튼으로.
- ③ 막다른 안내 해소.
- ⑥ 48px.
- ⑦ 휴대폰 라이트·다크, PC 라이트.

## 검증

- `validate_calendar_command_recognition_p0_01`(브라우저) 단정 추가:
  - 버튼 1개, "로그인하고 등록", 보낼 문장 그대로, 48px 이상, 눌림.
  - 기록에 남음.
  - 누름 처리·로그인 연결 함수 호출 소스.
  - DEVICE_ONLY_META에 loginAction.
REGRESSION=__REGRESSION__
NEW_FAILURES=__NEW_FAILURES__
LINUX_GATE=NOT RUN locally
REAL_DEVICE=NOT VERIFIED
