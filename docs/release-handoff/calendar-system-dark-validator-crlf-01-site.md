READY_FOR_DEPLOY=YES

# calendar-system-dark-validator-crlf-01-site — release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/calendar-system-dark-validator-crlf-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ... refs/heads/feature/calendar-system-dark-validator-crlf-01-site`)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=c9c19e4cef9914f0b50d4870cbcc59e58602ddc2
CODE_SHA=7c140b17ec6796a1090fda60341f26d60de57d7e
ASSET_VERSION=aset-738bfea7816e (main과 동일, 변경 없음)
PAIRED_BRANCH=NONE

## SCOPE

Windows(`core.autocrlf=true`) 전용 테스트 RED 1건 수정. 바뀐 파일은 스크립트 2개뿐이고, 서빙되는 파일(html/js/css)은 바뀌지 않았다.

- `scripts/validate_calendar_system_dark_01.mjs`: `site-calendar.css`를 읽은 직후 `\r\n`→`\n` 정규화한 뒤 미러 블록을 잘라 `generate()` 결과와 비교한다. 다른 assert(미러 누락, 다크 규칙 30개 초과, 브라우저 대비 검사)의 의미는 그대로다.
- `scripts/generate_calendar_system_dark.mjs`: 직접 실행 판정을 `pathToFileURL(process.argv[1]).href`로 바꿨다(기존 `file://${argv[1]}`는 Windows `C:\...` 경로와 맞지 않아 실행해도 아무것도 쓰지 않았다). 원본이 CRLF면 CRLF로, LF면 LF로 다시 쓴다. `generate()` 출력(LF)은 그대로다.

원인: 작업 폴더의 `site-calendar.css`는 CRLF, `generate()`는 LF 블록을 만든다 → 내용이 같아도 `the system-dark mirror is stale` AssertionError.

## SAFETY

CORE_CHANGED=NO, ENV_CHANGE_REQUIRED=NO, MIGRATION=NO, LIVE_MONEY=OFF. 서빙 파일·asset token 변화 없음 → 배포해도 사용자 화면은 바뀌지 않는다. Linux CI(LF)에서는 정규화가 아무것도 바꾸지 않는다.

## TEST_STATUS (Windows 11, node v24.19.0, Chrome)

- 수정 전 RED 재현: validator `AssertionError: the system-dark mirror is stale` (EXIT=1), 생성기 직접 실행 시 출력 없이 종료.
- 수정 후 `CHROME_BIN="C:/Program Files/Google/Chrome/Application/chrome.exe" node scripts/validate_calendar_system_dark_01.mjs` → `CALENDAR SYSTEM DARK PASS` (EXIT=0, system/dark 각 9개 지점 대비 5.1~16.5:1, OS 라이트 확인 포함).
- `node scripts/generate_calendar_system_dark.mjs` → `system-dark mirror written: 244 lines`, 실행 전후 `site-calendar.css` SHA-256 동일, CRLF 유지, `git status` 변경 없음.
- 별도 복사본 확인: LF 원본에서 생성기 실행 → LF 유지·바이트 동일. CRLF 파일의 미러 한 줄을 변조 → validator가 stale로 실패(드리프트 검출 유지), 생성기 실행 → worktree 파일과 바이트 동일하게 복구.
- `node scripts/asset_cache_version.mjs` (check) → PASS, version=aset-738bfea7816e (수정 전후 동일).
- NOT RUN: Linux CI(site-review.yml, site-universal-life-calendar-01.yml)에서의 이 validator 실행 — 배포총괄방 gate에서 확인.

NEW_FAILURES=0

## DEPLOY_ORDER

단독. 다른 repo 의존 없음.

USER_DECISION_NEEDED=NONE
