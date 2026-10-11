READY_FOR_DEPLOY=YES
STATUS=구현 및 검증 완료 / READY 브랜치 준비 / Codex 배포 대기
REPO=lotbi-site
OWNER=jshncd01-source
FEATURE_BRANCH=feature/calendar-home-redesign-01-site
PR=없음 (Ncloud Git 브랜치 인계)
READY_CODE_SHA=bdd06d53c7ef2cc13855735e4607586530700e8a
BASE_MAIN_SHA=9147419fb079e6452ff26d82c52a1b8f1dca36e4
INITIAL_MAIN_SHA=7c4f09445676287f242271cbdfb32d91ec33891e (SITE-T54, 작업 시작 기준)
REMOTE=ssh://lotbi-ncloud-git/srv/git/repositories/lotbi-site.git
ASSET_VERSION=aset-b12b92fabdba
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
CONTRACT_CHANGE=NO
DEPLOY_ORDER=SITE ONLY
MERGED_TO_MAIN=NO
DEPLOYED=NO

# calendar-home-redesign-01-site — 확정 캘린더 시안 구현 READY

## 배포총괄 요약

- 첨부 확정 시안의 빈 날짜 상태와 같은 날짜 일정 6개 상태를 별도 화면이 아닌 같은 캘린더의 실제 데이터 상태로 구현했다.
- 데스크톱은 월 달력과 선택일 상세를 좌우로, 모바일은 같은 정보 위계를 한 화면 세로 흐름으로 배치한다.
- 일정·지출·날씨·음력·공휴일·설정·주/월/목록·이전/다음/오늘·일정 추가의 기존 저장·조회 경로를 재사용했다.
- 운영 데이터에 예시 일정·날씨·음력·금액을 넣지 않았다. 6개 일정과 208,000원/628,000원은 검사 fixture와 스크린샷에서만 사용한다.
- T56에 배포된 `feature/calendar-add-ux-01-site`의 상시 추가 동작, `오전/오후` 12시간제, 48px 편집 동작을 유지했다. T56의 `feature/festival-calendar-sheet-pc-01-site` PC/모바일 등록 흐름과 기존 대화형 일정 제안도 병합 후 재검증했다.
- Ncloud 최신 `main` `9147419fb079e6452ff26d82c52a1b8f1dca36e4`를 rebase 없이 정상 merge했고, 최신 main의 메뉴·대화 UI·분쟁/사기방지 관련 동작을 유지한 상태로 회귀 검증했다.
- main 직접 수정·배포·배포 브랜치 병합은 하지 않았다.

## 2026-10-11 최신 main 재READY

- 작업 시작 직전 Ncloud 원격을 다시 조회해 `main=9147419fb079e6452ff26d82c52a1b8f1dca36e4`, 원격 feature=`104fe909d6f45bd398f408300038daf38b0272aa`를 확인했다.
- 정상 merge 커밋: `f99b62738a582258bf7fd5f41ce2bbffa9e95380`.
- 최신 main의 기존 CRLF 파일 9개가 전역 LF 정규화 때문에 범위 밖 차이로 잡혀, 내용 변경 없이 main 원본 blob을 복원한 보정 커밋: `bdd06d53c7ef2cc13855735e4607586530700e8a`.
- 실질 기능 충돌 파일은 `site-calendar-manager.js`, `site-calendar-product.js` 두 개였다. 최신 main 쪽 변경이 자산 버전 문자열뿐임을 기준점 비교로 확인해 승인된 캘린더 구현을 유지하고 공식 자산 버전 도구로 다시 생성했다.
- 나머지 충돌 파일은 feature 쪽이 이전 자산 버전 문자열만 바꾼 파일이므로 최신 main을 채택했다. 이에 따라 최신 main의 `index.html`, `site-conversation.js`, `site-bottom-sheet.css`, 아바타·분쟁 도우미·공통 메뉴 변경을 그대로 보존했다.
- 새 자산 버전은 `aset-b12b92fabdba`; `--write` 후 `--check` PASS (`targets=169`, `refs=206`).
- 재READY 스크린샷: `C:\Users\jshnc\Documents\Codex\2026-10-11\lotbi-master-claude-2-lotbi-1\outputs\calendar-final-design\reready-main-9147419f\`.

## 구현 범위

1. 상단: 제목/설명, `+ 일정 추가`, 설정, 닫기. 추가 버튼은 현재 선택 날짜로 실제 편집기를 연다.
2. 왼쪽/본문: 이전·다음·오늘, 연월 선택, 주·월·목록, 월 달력. 모바일은 가로 넘침 없이 같은 제어를 유지한다.
3. 선택 날짜 상세:
   - 오늘/선택일과 음력 표시.
   - 지역명·상태·현재/예상 온도·최저/최고를 구분. 과거·예보 범위 밖·실패는 미제공/실패 문구로 표시.
   - 일정 없음은 `등록된 일정이 없습니다.`와 `이 날짜에 일정 추가`를 표시하되 실제 지출은 별도로 유지.
   - 일정은 시간순 전체 목록, 시간·제목·분류·금액을 분리하고 긴 목록은 상세 영역에서 스크롤.
4. 월 칸: 일정 최대 3개와 `+N개 더`; 6개이면 `+3개 더`. 긴 제목은 해당 칸 안에서 잘린다.
5. 금액:
   - 오늘은 `오늘 지출`, 다른 날은 `선택일 지출`.
   - 월 전체 기록의 음식·여행·쇼핑·생활비·기타 합계를 한 곳에서 표시.
   - 일정 연결 금액과 별도 지출의 식별자를 유지해 중복 합산하지 않는다.
   - 조회 실패는 0원으로 바꾸지 않고 오류 상태로 표시한다.
6. 접근성과 표시: 키보드 포커스, 날짜/추가 버튼 접근성 이름, 라이트·다크·시스템 다크, 한국어 12시간제, 넓은 글꼴 간격을 검증했다.

## 변경 파일

`BASE_MAIN_SHA..READY_CODE_SHA` 기준 116개다. 정확한 목록은 다음 명령으로 재현한다.

```text
git diff --name-status 9147419fb079e6452ff26d82c52a1b8f1dca36e4..bdd06d53c7ef2cc13855735e4607586530700e8a
```

직접 기능 변경:

- `site-calendar-manager.js`
- `site-calendar-product.js`
- `site-calendar-expense.js`
- `site-calendar.css`
- `site-calendar-expense.css`
- `site-consumer-design.css`
- `site-conversation.js`
- `scripts/generate_calendar_system_dark.mjs`

검사 계약 갱신:

- `scripts/validate_calendar_add_from_image_01.mjs`
- `scripts/validate_calendar_compact_editor_01.mjs`
- `scripts/validate_calendar_cross_platform_ux_01.mjs`
- `scripts/validate_calendar_day_panel_two_buttons_01.mjs`
- `scripts/validate_calendar_expense_summary_01.mjs`
- `scripts/validate_calendar_ledger_design_01.mjs`
- `scripts/validate_calendar_lunar_compact_layout_01.mjs`
- `scripts/validate_calendar_lunar_settings_ui_01.mjs`
- `scripts/validate_calendar_mobile_week_ux_weather_01.mjs`
- `scripts/validate_calendar_modal_runtime_02.mjs`
- `scripts/validate_calendar_month_geometry_01.mjs`
- `scripts/validate_calendar_month_temperature_01.mjs`
- `scripts/validate_calendar_recurring_events_01.mjs`
- `scripts/validate_calendar_secondary_surfaces_01.mjs`
- `scripts/validate_calendar_settings_expansion_01.mjs`
- `scripts/validate_calendar_system_dark_01.mjs`
- `scripts/validate_calendar_toolbar_polish_01.mjs`
- `scripts/validate_calendar_weather_attribution_01.mjs`
- `scripts/validate_calendar_weather_glyph_legibility_01.mjs`
- `scripts/validate_calendar_weather_region_province_01.mjs`
- `scripts/validate_calendar_week_mobile_vertical_01.mjs`

자산 캐시 생성 결과:

- `site-asset-version.json`과 HTML/JS의 자산 query 참조가 `aset-b12b92fabdba`로 함께 갱신됐다.
- 새 CSS 파일은 추가하지 않았다. `index.html`, `auth/callback/index.html`, 기타 정적 진입점의 기존 CSS 순서를 바꾸지 않았다.

## 검사 결과

- 최신 main `9147419f` 재READY 핵심 검사: 모두 PASS.
  - 캘린더: `validate_calendar_holiday_surface_settings_icon_01`, `validate_calendar_month_temperature_01`(40개 조합), `validate_calendar_modal_runtime_02`, `validate_calendar_month_geometry_01`, `validate_calendar_mobile_week_ux_weather_01`, `validate_calendar_cross_platform_ux_01`, `validate_calendar_system_dark_01`, `validate_calendar_toolbar_polish_01`.
  - 최신 main 공통 회귀: `validate_calendar_command_recognition_p0_01`, `validate_bottom_sheet_primitive_01`, `validate_conversation_integration`, `validate_site_avatar_integration`, `validate_trouble_helper_01`(52 checks).
  - 자산 캐시 `--check` PASS (`aset-b12b92fabdba`, `targets=169`, `refs=206`).
  - 충돌 표식 없음, 캘린더 및 이번 문서 범위 `git diff --check` PASS. 최신 main에서 그대로 보존한 기존 CRLF 인계 문서는 범위 밖이며 내용 수정하지 않았다.

- 반환 gate 수정: PASS.
  - `scripts/validate_calendar_holiday_surface_settings_icon_01.mjs`를 Linux gate와 같은 `mkdtemp` 격리 Chrome 프로필로 직접 실행했다.
  - 360×780/1280×860, 라이트·다크에서 공휴일 배경·일정 제목·일정 점·설정 SVG·공휴일 조회 실패 격리를 모두 확인했다.
  - 검사기의 색상·크기·표시 기대값은 바꾸지 않았다. 실행 프로필을 매번 새로 만들고, 상단으로 이동한 설정 버튼을 실제 모달 범위에서 찾도록 fixture 탐색 범위만 바로잡았다.
- 반환 수정 인접 회귀: PASS.
  - `validate_calendar_month_temperature_01.mjs` 40개 조합(351~1280px, 인증/게스트, 라이트/다크, 음력, 넓은 Linux 글꼴, 최종 빈 상태/6개 상태).
  - `validate_calendar_modal_runtime_02.mjs`, `validate_calendar_month_geometry_01.mjs`, `validate_calendar_mobile_week_ux_weather_01.mjs`, `validate_calendar_cross_platform_ux_01.mjs`, `validate_calendar_system_dark_01.mjs`, `validate_calendar_toolbar_polish_01.mjs`.
  - 모바일 360px은 기존 일정 최대 3개/`+3개 더`를 유지하면서 일정 존재 점을 온도 줄 아래로 내려 겹침을 제거했다.

- 변경된 캘린더 검사기 28개: PASS.
  - 첫 일괄 실행에서 `validate_calendar_system_dark_01.mjs`가 브라우저 과부하로 결과 보고 전 1회 시간 초과했으나 단독 재실행 PASS. 단언 실패는 없었다.
- T56 merge 후 핵심 회귀 13개: PASS.
  - product model, compact editor, event editor, day panel, modal runtime, month/weather/fixture, mobile week, vertical week, recurring, expense, system dark, festival PC sheet, conversation calendar auto-suggest.
  - `validate_calendar_mobile_week_ux_weather_01.mjs`는 T56의 현재 비로그인/로그인 설명 문구를 각각 정확히 확인하도록 fixture를 갱신한 뒤 PASS. 검사 완화 없음.
- 자산 캐시: `node scripts/asset_cache_version.mjs --write` 후 `--check` PASS (`targets=169`, `refs=206`).
- `git diff --check`: PASS.
- LF: READY 구현 변경 파일 working tree `w/lf` 확인. Windows `core.autocrlf`의 향후 변환 경고는 있었으나 커밋 blob은 LF다.
- 날씨/공휴일 실패 로그: 오류·미제공 화면을 검증하기 위해 의도적으로 503/네트워크 실패 fixture를 사용했고 최종 판정은 PASS.

## 사용자 시나리오

탭 수는 캘린더가 열린 뒤의 포인터 탭만 센다. 텍스트 입력과 스크롤은 탭에서 제외한다. 홈에서 캘린더 진입은 PC 1탭, 모바일 메뉴 포함 2탭이다. 자동화는 실제 운영 DOM과 CSS를 Chrome에서 열고 포인터 hit-test로 수행했다.

| 시나리오 | 환경 | 탭 수 | 결과 | 막힌 곳 |
|---|---|---:|---|---|
| S1 일정 없는 오늘 확인 후 추가 | PC 1280 라이트/다크, 모바일 360 라이트/다크 | 오늘 상세 확인 0, 빈 상태 CTA로 편집기 열기 1 | 오늘 배지, 미제공이 아닌 실제 날씨, 빈 일정 안내, 오늘 지출, 월 합계가 같은 데이터 상태에서 표시. CTA가 선택 날짜로 편집기를 엶 | 없음 |
| S2 같은 날짜 일정 6개 확인 | PC 1280, 모바일 360 | 날짜 선택 1, `+3개 더` 또는 날짜로 상세 확인 1 | 월 칸 3개 + `+3개 더`, 상세 6개 시간순, 18,000+42,000+32,000+12,000+56,000+48,000=208,000원. 긴 상세는 스크롤 | 없음 |
| S3 일정·시간·금액 저장 후 재조회 | 모바일 360/PC 1280 | 상단 추가 1, 제목 1, 시간 1, 오전/오후 1, 금액 1, 저장 1 = 6 | 저장값은 24시간 계약을 유지하고 읽기 화면은 `오후 3:00`; 저장 직후 같은 선택일 상세와 지출 합계에서 재조회 | 없음 |
| S4 설정·보기·날짜 이동 | PC 1280/모바일 360 | 설정 1, 항목 전환 1, 닫기 1, 주/월/목록 각 1, 이전/다음/오늘 각 1 = 9 | 설정이 실제 반영되고 주·월·목록·날짜 이동이 동작. 선택일과 월 합계 범위가 함께 갱신 | 없음 |
| S5 날씨/음력 실패·미제공 | 360~1280 fixture | 상태 진입 0 | 정상 위치 날씨/온도/음력과 과거·범위 밖·조회 실패 문구를 분리. 실패를 임의 날씨나 0원으로 표현하지 않음 | 없음 |

## 스크린샷 증거

원본 확정 시안:

- 시안 1: `C:\Users\jshnc\Downloads\lotbi-calendar-final.png`
- 시안 2: `C:\Users\jshnc\Downloads\lotbi-calendar-final-populated.png`

증거 루트:

- 수정 전: `C:\Users\jshnc\Documents\Codex\2026-10-11\lotbi-master-claude-2-lotbi-1\outputs\calendar-final-design\before\`
- 수정 후: `C:\Users\jshnc\Documents\Codex\2026-10-11\lotbi-master-claude-2-lotbi-1\outputs\calendar-final-design\after\`
- 반환 수정 후 재캡처: `C:\Users\jshnc\Documents\Codex\2026-10-11\lotbi-master-claude-2-lotbi-1\outputs\calendar-final-design\gate-return\`
- 최신 main 재READY 후 재캡처: `C:\Users\jshnc\Documents\Codex\2026-10-11\lotbi-master-claude-2-lotbi-1\outputs\calendar-final-design\reready-main-9147419f\`

시안 1 대응 빈 상태:

- PC 1280×900 라이트/다크: `final-empty-pc-light.png`, `final-empty-pc-dark.png`
- 모바일 360×780 라이트/다크: `final-empty-mobile-light.png`, `final-empty-mobile-dark.png`
- 상세/월 합계 스크롤 증거: 같은 접두사의 `-detail.png`, `-totals.png`

시안 2 대응 일정 6개 상태:

- PC 1280×900 라이트/다크: `final-populated-pc-light.png`, `final-populated-pc-dark.png`
- 모바일 360×780 라이트/다크: `final-populated-mobile-light.png`, `final-populated-mobile-dark.png`
- 상세 6개/208,000원/월 628,000원 스크롤 증거: 같은 접두사의 `-detail.png`, `-totals.png`

각 파일명은 `before`와 `after`에 동일하게 있어 직접 전후 비교할 수 있다. 캡처는 Chrome 브라우저 화면 크기 검증이며 실제 휴대전화 촬영이 아니다.

## 환경변수·DB·운영 데이터

- 환경변수 변경: 없음.
- DB/마이그레이션 변경: 없음. 번호 요청 불필요.
- Secret 변경: 없음.
- 운영 사용자 데이터 쓰기: 없음.
- 예시 일정/날씨/음력/금액은 fixture 전용이며 Production 데이터로 등록되지 않는다.

## NOT TESTED

- 실제 iPhone Safari, Android Chrome, Samsung Internet, 카카오톡 내장 브라우저 실기기.
- Production 배포 및 Production 사용자 계정의 실제 일정·지출 저장/재조회.
- Production 날씨/음력 공급자의 실시간 응답과 장애 전환. 로컬은 API 계약 fixture/실패 fixture 기반.
- Linux 전체 merge gate. 반환된 단일 검사기는 Linux gate 조건과 같은 `mkdtemp` 격리 프로필로 직접 PASS했지만, 이 Windows 작업 호스트에는 WSL 배포판이 없어 전체 Linux gate 자체는 실행하지 않았다.
- Codex 배포방의 main 병합, 배포 브랜치 병합, Production 배포, 배포 후 사용자 검증.

## Codex 배포 절차와 확인 항목

배포 대상은 공식 Web/대화 Site인 Render `lotbi-site-prod`의 기존 nginx 정적 Site다. 이 개발방은 배포하지 않는다.

1. Ncloud에서 `feature/calendar-home-redesign-01-site`의 remote HEAD와 이 문서의 `READY_CODE_SHA`가 포함됐는지 확인한다.
2. 기존 Ncloud merge gate 절차로 배포 브랜치/`main`에 정상 merge한다. rebase·force-push 없이 merge하고, gate가 자산 토큰을 다시 만들면 `asset_cache_version --check` 결과를 기준으로 한다.
3. 배포 후 PC 1280과 모바일 실기기에서 캘린더를 열어 다음을 확인한다.
   - 상단 추가/설정/닫기, 이전/다음/오늘, 주/월/목록.
   - 오늘 빈 상태와 CTA, 실제 지출이 있는 빈 일정 날짜.
   - 일정 6개 날짜의 3개+`+3개 더`, 전체 시간순 상세, 12시간제, 긴 제목/스크롤.
   - `오늘 지출`/`선택일 지출`, 월 분류 합계 한 곳, 중복 합산 없음.
   - 실제 지역 날씨·온도·음력 및 제공 범위 밖/실패 문구.
   - 축제 카드 PC 일정 등록과 대화형 일정 제안 회귀.
4. 다음이면 롤백한다: 캘린더가 열리지 않음, 월/주/목록 전환 또는 추가/저장 실패, 선택일·월 합계 오계산/중복 합산, 모바일 가로 넘침·필수 정보 접근 불가, 날씨/지출 실패를 정상값으로 오표시, 기존 축제/대화 일정 등록 회귀.
5. 롤백은 기존 Release Control 절차로 직전 정상 Site 이미지/직전 main 배포를 재승격한다. DB 변경이 없으므로 데이터 롤백은 없다.

FORBIDDEN_HERE=main 직접 수정·병합, 배포 브랜치 병합, Production 배포, force-push, rebase, history rewrite.
