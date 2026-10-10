READY_FOR_DEPLOY=YES
SUPERSEDES=NONE
MIGRATION=NO
DEPLOY_ORDER=SITE ONLY (Core 변경 없음 — 기존 /v2/life/expense-summary 그대로)
USER_DECISION_NEEDED=NONE (소유자 결정 완료: 2026-10-10 "2" = 금액 없는 달도 가계부 줄을 0원으로 표시)

# calendar-month-expense-restore-01-site — 금액 없는 달에도 월 화면 가계부 줄(0원) 표시

REPO=lotbi-site
FEATURE_BRANCH=feature/calendar-month-expense-restore-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote origin refs/heads/feature/calendar-month-expense-restore-01-site`)
REMOTE_FEATURE_SHA=same as FEATURE_SHA after push (checked with git ls-remote at push time)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=61d3ce37f8ab3298d65411f68b327702e4c7bf0e (SITE-T53, push 직전 ls-remote 확인). branch는 이 main에서 바로 시작 — 실제 변경 site-calendar-expense.js · scripts/validate_calendar_expense_summary_01.mjs · scripts/validate_calendar_ledger_design_01.mjs · scripts/validate_calendar_month_temperature_01.mjs(+이 문서), 나머지는 asset 토큰.
CODE_SHA=ff101695
ASSET_VERSION=aset-e7d800ad862b (`node scripts/asset_cache_version.mjs --check` PASS, targets 150, refs 180)
CONTRACT_CHANGE=NO (화면 표시만)
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
MERGED_TO_MAIN=NO
DEPLOYED=NO

## 소유자 신고

휴대폰 18:09 스크린샷(월 보기, 음력·날씨 표시): "캘린더 월 화면에 가계부 표시 어디 갔는지". 이어서 "원래 입력 안해도 표시가 됐는데? 기록 확인해보고 말해".

## 원인 (git 이력으로 확인)

- 월 화면의 가계부 표시 = 격자 위 "N월 입력 금액 합계 …원 ›" 줄 + 고정 분류 칸(음식·여행·쇼핑·생활비·기타). 날짜 칸 안 금액 표시는 원래 없음.
- **2026-10-06 이전**: 금액 없는 달에도 합계 0원과 분류 칸 0원이 늘 보였다(재설계 직전 `validate_calendar_expense_summary_01`: "a month with no recorded amount still shows the six 0원 slots and total").
- **95e1aacc (2026-10-06 00:54, 캘린더 재설계 "read the Calendar as one day of a life, not a ledger")** 가 이를 "금액 없는 달은 줄을 아예 그리지 않음(no 0원 ledger)"으로 바꿨고, 2026-10-06 23:40 SITE-T1(929c4758)로 main·운영에 들어갔다. 같은 날 6cd2de93·f623cb93은 금액 있는 달의 분류 표시·위치만 복구했고 빈 달 숨김은 남았다.
- 소유자 화면의 10월은 기록 점 0·오류 문구 없음 → 금액 기록이 없는 달이라 줄 자체가 없었다.
- 17:57 배포된 월 캘린더 온도 수정(07b9cde0)은 무관: 금액 기록이 있으면 d4d172a5·61d3ce37 모두 합계 줄과 분류가 그대로 나옴(360px·음력·날씨 동일 조건 실측).

## 바뀐 것

- `site-calendar-expense.js`: 금액이 정산된(ready) 달에 기록 금액이 없으면 KRW 0원으로 표시 — "N월 입력 금액 합계 0원 ›" + 분류 5칸 0원(미분류는 기존대로 쓰였을 때만). 불러오는 중은 기존대로 아무것도 안 그림, 오류(401/403) 줄은 그대로. 줄을 누르면 나오는 상세는 기존대로 "이 달에 입력한 금액이 없어요."
- 로그인·비로그인(이 기기 기록 합계) 모두 같은 규칙. 비로그인 빈 달도 로그인 안내 없음.
- 금액 없는 기록은 여전히 세지 않음(0원으로 저장된 것처럼 보이지 않게 하는 편집기 규칙 그대로).

## 검증

- 바꾼 검사기 기준(소유자 결정 반영, 단정 약화 아님 — "줄 없음"을 "0원 줄 + 0원 5칸"으로 교체):
  - `validate_calendar_expense_summary_01`: 빈 달·금액 없는 기록만 있는 달·비로그인 빈 달 → 줄 ready + "0원", 빈 달 분류 5칸 0원. 로그인 안내 없음·제외 건수 문구 없음은 유지.
  - `validate_calendar_ledger_design_01`: 빈 요약 → `{label: '9월 입력 금액 합계', amounts: ['0원']}`, 빈 블록 분류 5칸 0원.
- 휴대폰 월 보기 단정 추가: `validate_calendar_month_temperature_01` 32조합(351~1280px, 로그인/비로그인, 라이트/다크, 음력, 영하, 넓은 글꼴)에서 0원 줄과 분류 5칸이 보이고 격자와 안 겹치고 화면 밖으로 안 나감.
- 수정 전 main 61d3ce37에서는 두 검사기 FAIL("the month's amount line is absent", "must keep its line at 0원, got absent"), 수정본 PASS.
REGRESSION=ff101695에서 관련 검사기 61개 순서 실행(scripts/validate_calendar_* 전부 + 캘린더 CSS·날씨·월 격자·금액 요약(calendar-amount·expense-summary)을 읽는 검사기 전부, PYTHONIOENCODING=utf-8·CHROME_BIN 지정) → 61 PASS / 0 FAIL.
NEW_FAILURES=0
LINUX_GATE=NOT RUN locally (이 PC에 Linux 없음). 넓은 글꼴 강제 조합 포함.
REAL_DEVICE=NOT VERIFIED

## 배포 후 확인 제안

1. 휴대폰 캘린더 → 월: 금액 기록이 없는 달(예: 10월)에 "10월 입력 금액 합계 0원 ›"과 음식·여행·쇼핑·생활비·기타 0원.
2. 금액 기록이 있는 달은 기존과 같은 합계·분류.
