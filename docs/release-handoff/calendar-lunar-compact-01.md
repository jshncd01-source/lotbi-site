READY_FOR_DEPLOY=YES
SUPERSEDES=8a31a674
MIGRATION=NO
USER_DECISION_NEEDED=NONE

# calendar-lunar-compact-01 — Linux gate 재실패 수정 READY

REPO=lotbi-site
FEATURE_BRANCH=feature/calendar-lunar-compact-01
FEATURE_SHA=this document commit (feature branch HEAD; push 후 `git ls-remote origin refs/heads/feature/calendar-lunar-compact-01`로 확인)
CODE_SHA=70cc615e046f884569f49d7fb8ec55d7378b20c2
AUTHORITATIVE_MAIN_AT_READY=9e39edd06446b3e93ec68170de49df9f702e0d07
MAIN_MERGE_SHA=70cc615e046f884569f49d7fb8ec55d7378b20c2
ASSET_VERSION=aset-f203b381ab91
FAILED_RELEASE_SHA=ba32dc93
FAILED_T38_GATE=20261009T025710Z-1106810-1895320717

## 수정 원인과 범위

- trusted Linux gate는 360px/700px에서 두 자리 양력일의 일반 음력 라벨(`음23` 등)이 양력 숫자 오른쪽이 아니라 다음 줄로 떨어진 것을 보고했다. 반복 일정이 합쳐진 T38 트리에서 사용 가능한 inline 폭과 Linux 기본 fallback 글꼴의 glyph 폭이 결합되면, 기존 `.calendar-date-line { flex-wrap: wrap }`가 일반 라벨의 줄바꿈을 허용한 것이 직접 원인이다.
- `site-calendar-manager.js`는 일반 음력일과 월초/윤달 월초를 `data-lunar-kind`로 구분한다. 일반 음력일은 `flex-wrap: nowrap`으로 고정하여 두 자리 날짜에서도 숫자 오른쪽 한 줄을 유지한다. 길 수 있는 월초/윤달 월초 라벨만 기존의 매우 좁은 칸 내부 줄바꿈 경로를 보존한다.
- 음력 라벨을 숨기지 않았고 폰트 크기를 축소하지 않았다. 화면용 compact 표기와 접근성용 전체 음력 aria-label도 유지한다.
- 기존 320px 높이 회귀 방지(ON/OFF 공통 52px 고정), 음력 ON/OFF 전환 시 행·전체 캘린더 높이 불변, 잘림·겹침 검사는 그대로다. validator의 허용 오차나 조건을 완화하지 않았다.
- 레이아웃 validator에 일반 음력 라인의 computed `flex-wrap: nowrap` 단정을 추가했다. 수정 전에는 이 강화 단정이 RED였고, 수정 후에는 통과한다.

## Linux 재현 및 수정 검증의 사실 기록

- trusted gate의 T38 실패는 위 `FAILED_T38_GATE` 로그로 확인했다: 360px의 2026-02/05/10, 2027-12, 2028-06과 700px에서 일반 음력 라벨이 줄바꿈됐다.
- 독립 GitHub `ubuntu-latest` + 공식 Chrome for Testing 154.0.8037.92에서 실패 T38 소스를 다시 돌렸을 때, 원래 줄바꿈 실패는 다시 만들어지지 않았다. 따라서 **독립 Linux 재현은 NOT REPRODUCED**이며 Linux에서 과거 실패를 재현했다고 주장하지 않는다. trusted gate의 실패 로그와 CSS의 줄바꿈 경로는 보존된 RED 근거다.
- 최종 결합 코드 SHA `70cc615e`는 공식 Linux Chrome for Testing 154.0.8037.92에서 직접 검증했다. 임시 GitHub 진단 브랜치의 workflow-only 커밋 `c84b0edb`는 코드 SHA 위에 존재하며 제품 소스 변경은 없다.
  - `SITE-UNIVERSAL-LIFE-CALENDAR-01` run `37883090470`: **PASS**, 38/38 단계.
  - Chrome 154 전용 단계: 320/344/360/375/390/412/600/700/768/1024/1280px, 2026-02(4주)/2026-05(6주)/2026-10/2027-12/2028-06에서 ON/OFF 높이 동일, 일반 라벨 한 줄, 셀 밖 잘림 0, 라벨·날짜·날씨·일정·확인 필요 마커 겹침 0.
  - 반복 일정 validator와 음력 model/settings/layout validator가 같은 run에서 PASS했다.

## 기능 보존

- 최신 `origin/main` `9e39edd0`을 rebase/reset/force push 없이 정상 merge했다. 유치원·인증 연속성 최신 기능과 반복 일정 기능을 유지했다.
- 월간 날짜 배열, 음력 날짜·윤달·월초 표기, 대한민국 공휴일, 일정 추가·수정·삭제, 반복 일정, 모바일 세로형 주간/PC 주간 time-grid, 라이트·다크·시스템 테마를 보존했다.
- 가계부 월 합계는 월간 화면에서만 표시되는 기존 동작을 보존했다.

## 검증 증거

- Windows Chrome for Testing 154.0.8037.92, 최종 코드 SHA:
  - `validate_calendar_lunar_compact_layout_01.mjs` PASS
  - `validate_calendar_lunar_model_01.mjs` PASS
  - `validate_calendar_lunar_settings_ui_01.mjs` PASS
  - `validate_calendar_recurring_events_01.mjs` PASS
  - `validate_kindergarten_official_info_01.mjs` PASS
  - `validate_auth_continuity_02.mjs` PASS
- Linux 전체 Site 검증은 최종 코드 SHA 위의 workflow-only 커밋 `59d7ea87`에서 수행했다.
  - `Public Site Review Gate` run `37883141806`: **PASS**, 134/134 단계(기능 검증 129개와 workflow 보조 단계 포함), 실패 0.
- `node scripts/asset_cache_version.mjs --check` PASS: `aset-f203b381ab91`, targets=133, refs=160.
- `node --check site-calendar-manager.js`, `node --check site-calendar-lunar.js`, `git diff --check` PASS.

NEW_FAILURES=0
ENV_CHANGE_REQUIRED=NO
CORE_CHANGE_REQUIRED=NO
DEPENDENCIES=NONE

## 배포 경계

- Ncloud Git이 Source of Truth다.
- main 직접 push, main 병합, Production 배포는 수행하지 않았다.
- 이 문서의 커밋이 feature branch의 마지막 커밋이다.
