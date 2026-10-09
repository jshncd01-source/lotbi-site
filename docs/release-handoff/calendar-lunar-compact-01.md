READY_FOR_DEPLOY=YES
SUPERSEDES=192eb069
MIGRATION=NO
USER_DECISION_NEEDED=NONE

# calendar-lunar-compact-01 — Linux gate fix release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/calendar-lunar-compact-01
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote origin refs/heads/feature/calendar-lunar-compact-01`)
CODE_SHA=35482582d3fb3b0a0029a050e31fc1066e9643ab
MAIN_MERGE_SHA=28dc9e38aaeb02154362bdc51fcac53fd83cbb64
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=fa6ed88d3608536050de0fb56136ae9b920a4c55
ASSET_VERSION=aset-1bd92d88e20a
FAILED_RELEASE_SHA=ba32dc93

## Linux gate 실패와 원인

- 기존 trusted Linux gate `20261008T143327Z-720494-1150016930`은 Chrome for Testing 154, 320px, 2027-12에서 음력 ON 52px / OFF 59px로 실패했다. `ba32dc93`은 main에 병합·배포되지 않았다.
- 모바일 날짜 셀과 날짜 버튼은 `min-height: 52px`만 있었고, 음력 ON 상태에만 별도의 flex 축소 규칙이 적용됐다. 따라서 Windows와 Linux의 기본 글꼴 glyph·line-box·flex intrinsic size 계산 차이가 그리드 행 높이에 들어갈 수 있었고, ON/OFF 상태의 높이 경로가 달랐다.
- 수정은 600px 이하에서 날짜 셀과 날짜 버튼 모두 `height/min-height/max-height: 52px`, 버튼 `flex: 0 0 52px`, `box-sizing: border-box`로 같은 geometry를 사용하게 했다. 음력 라벨은 내부에서만 줄바꿈하며 그리드 행 크기를 바꾸지 않는다.
- 음력 라벨을 숨기지 않았고 기존 모바일 9px/데스크톱 10px 글꼴 크기를 유지했다. validator의 높이 허용 오차·겹침·잘림 조건도 완화하지 않았다.

## Linux 재현과 수정 검증

- 과거 trusted gate의 52px/59px 실패는 RED 증거로 확인했다.
- 2026-10-09 현재 GitHub `ubuntu-latest`에서 실패 release `ba32dc93`을 동일한 공식 Chrome for Testing 154.0.8037.92로 재실행했으나 기존 불일치는 재현되지 않고 정확한 음력 레이아웃 단계가 PASS했다. 따라서 현재 runner에서 원래 실패를 독립 재현했다고 보고하지 않는다. 과거 runner 이미지/글꼴 상태 차이 또는 간헐적 intrinsic layout 경로로 판단한다.
- 수정 코드 SHA `35482582`를 같은 Linux Chrome for Testing 154.0.8037.92에서 실행한 정확한 단계는 PASS했다: run `37871053192`, step `Exact Chrome 154 lunar layout reproduction`.
- 그 Chrome 154 고정 run의 후속 날씨 fixture는 음력 코드와 무관한 Chrome 프로세스 `ETIMEDOUT`(180초)로 종료됐다. 캘린더 전체 회귀는 수정 SHA를 기본 Linux Chrome으로 재실행해 run `37871462460` 전체 PASS했다.
- 확장한 레이아웃 validator는 4주(2026-02), 6주(2026-05), 5주(2026-10/2027-12/2028-06)를 명시적으로 단정한다. 320/344/360/375/390/412/600/700/768/1024/1280px에서 음력 ON/OFF 모든 날짜 칸 높이 동일, 음력 라벨 겹침 0, 셀 밖 잘림 0을 검사한다.
- 320px, 2027-12는 ON/OFF 모두 52px이다. 2027-12는 일요일 시작 기준 실제 5주 grid이며, 별도 6주 fixture인 2026-05도 모든 칸이 52px로 동일하다.

## 기능 보존 범위

- 월간 날짜 배열, 음력 날짜·월초·윤달 표기와 전체 aria-label
- 대한민국 공휴일과 휴일 색상
- 일정 추가·수정·삭제 및 최신 main의 일정 기능
- 모바일 세로형 주간 달력과 PC 주간 time-grid
- 라이트·다크·시스템 테마
- 가계부 월 합계는 월간 화면에서만 표시
- 음력 OFF 기본값, 설정 저장, 월간/주간 음력 표시

## 변경 파일

- `site-calendar.css`: 모바일 날짜 셀/버튼 높이와 flex basis를 52px로 고정
- `scripts/validate_calendar_lunar_compact_layout_01.mjs`: 4주·5주·6주 grid 단정 추가
- `site-asset-version.json` 및 생성된 로컬 JS/CSS 참조: content hash token 재생성
- 기존 음력 기능 파일과 workflow는 최초 READY 범위를 그대로 유지

## 검증 증거

- Windows Chrome for Testing 154.0.8037.92:
  - `validate_calendar_lunar_compact_layout_01.mjs` PASS
  - `validate_calendar_lunar_model_01.mjs` PASS
  - `validate_calendar_lunar_settings_ui_01.mjs` PASS
  - `node --check site-calendar-manager.js site-calendar-lunar.js` 각각 PASS
- Linux 기본 Chrome, 수정 SHA `35482582`: `SITE-UNIVERSAL-LIFE-CALENDAR-01` run `37871462460` PASS.
  - 월간/연간 모델, 공휴일, 일정 editor, 반응형, 모바일/PC 주간, 가계부 합계, 테마, 음력 model/settings/layout 포함.
- Linux Site 전체 Review Gate: 원본 129개 기능 단계 중 128개는 확장 run `37871779441`에서 PASS했다. 마지막 `Static serving smoke test`는 앞선 실브라우저 단계의 누적 실행 시간으로 30분 job 제한에 걸려 시작 중 취소됐고, 원본 workflow의 해당 명령 블록을 변경 없이 추출해 실행한 run `37874277884`에서 PASS했다. 두 run을 합쳐 원본 전체 검증 명령이 모두 PASS했다.
- asset token: `node scripts/asset_cache_version.mjs` PASS, `aset-1bd92d88e20a`, targets=130, refs=156.
- `git diff --check` PASS.

NEW_FAILURES=0
ENV_CHANGE_REQUIRED=NO
CORE_CHANGE_REQUIRED=NO
DEPENDENCIES=NONE

## 배포 주의

- Ncloud Git이 Source of Truth다. `origin/main`의 `fa6ed88d`를 정상 merge했으며 rebase/reset/force push를 사용하지 않았다.
- main 직접 push, main 병합, Production 배포를 수행하지 않았다.
- 이 문서 커밋이 feature branch 마지막 커밋이다.
