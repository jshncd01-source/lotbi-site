READY_FOR_DEPLOY=YES
SUPERSEDES=NONE
MIGRATION=NO
DEPLOY_ORDER=SITE ONLY (Core 변경 없음 — 저장은 기존 site-festival-calendar.js 경로 그대로)
USER_DECISION_NEEDED=NONE

# festival-calendar-sheet-pc-01-site — PC에서 축제 [일정 등록]이 눌러도 무반응 (QA_화면전수_01 H4/N2, P1)

REPO=lotbi-site
FEATURE_BRANCH=feature/festival-calendar-sheet-pc-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote origin refs/heads/feature/festival-calendar-sheet-pc-01-site`)
REMOTE_FEATURE_SHA=same as FEATURE_SHA after push (checked with git ls-remote at push time)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=7c4f09445676287f242271cbdfb32d91ec33891e (SITE-T54, push 직전 ls-remote 확인). branch는 이 main에서 바로 시작 — 실제 변경 site-festival-ui.js · site-festival.css · scripts/validate_festival_calendar_add_pc_01.mjs(신규) (+이 문서), 나머지는 asset 토큰.
CODE_SHA=80137ebf
ASSET_VERSION=aset-4138de7b7022 (`node scripts/asset_cache_version.mjs --check` PASS, targets 159, refs 193)
T55_OVERLAP=T55 후보(c76a8db2·e8be8f50·1851a70e·d7cd4203·ec6192ba·cb12d278·07ceeeab·e3bbd663·b181f017)는 site-festival-ui.js·site-bottom-sheet.js에서 asset 토큰 줄만 다름(그 외 diff 0줄 확인) → 충돌 나면 토큰만.
CONTRACT_CHANGE=NO
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
MERGED_TO_MAIN=NO
DEPLOYED=NO

## 원인

- 축제 카드 [일정 등록]은 공용 시트(`site-bottom-sheet.js`)를 기본 위치(document.body)로 열었다. 폭 900px 초과(PC)에서 시트는 INLINE(위치 지정 없음)이라 `<body>` 맨 끝에 붙었고, 실제 페이지 body는 스크롤이 잠겨(overflow hidden) 있어 화면 아래로 영영 안 보였다.
- 수정 전 실측(실제 index.html, PC 1280×900): `.lotbi-sheet` INLINE, 부모 body, top 900·bottom 2120, body overflow hidden → 눌러도 아무 일 없음. 휴대폰(≤900px)은 SHEET(고정 겹침)라 정상.
- 같은 원인을 "지역 변경" 시트는 이미 버튼 옆 자리(anchor)에 여는 방식으로 고쳐 두었고(openRegionSheet), [일정 등록]만 빠져 있었다.

## 바뀐 것 (화면)

- PC: [일정 등록]을 누르면 그 카드 안, 버튼 줄 바로 아래에 날짜 달력이 열린다(최대 420px, 날짜 칸 54px). 열리면 화면이 그 자리로 맞춰지고, [일정 등록]을 한 번 더 누르면 닫힌다(겹쳐 열리지 않음). [닫기]·[등록] 후에도 닫힌다.
- 휴대폰: 기존 아래 시트 그대로. 날짜 칸 간격 4px→2px로 390px에서 날짜 칸 47→49px(48 이상).
- 등록 후 "일정을 등록했어요." 문구 때문에 [네이버지도]가 아래로 처지던 정렬을 위쪽 맞춤으로(휴대폰·PC 공통).
- 상세 화면(캘린더에서 다시 들어온 축제 상세)의 [일정 등록]도 같은 함수라 PC에서 버튼 바로 아래에 열림 — 이 경로는 화면으로 따라 하지 않았고 검사기에도 없음(코드 경로만 같음).

## 「사용자 시나리오」 — "축제 보고 내 캘린더에 넣기"

실제 index.html을 로컬에서 열고(축제 API만 Core 모양 가짜 응답), 손가락 위치 그대로 누르기(CDP 마우스)로 따라 함. 시작 = 지역정보 → 축제·행사 목록이 보이는 상태. 비로그인(이 기기 저장). 스크린샷 = `C:\Users\jshnc\LOTBI-NCLOUD\release-control\user-scenarios\festival-calendar-sheet-pc-01-site\{before,after}\`.

| # | 상태 | 수정 전 | 수정 후 | 막힌 곳 | 스크린샷(after/before 같은 이름) |
|---|---|---|---|---|---|
| S1 | PC 1280×900 라이트 | **완료 불가** — [일정 등록] 눌러도 화면 변화 없음(달력이 y=900 아래, 스크롤 잠김) | **3번**: [일정 등록] → 날짜(54px) → [등록] → "일정을 등록했어요.", 캘린더에 저장 | 없음 | `festival-pc-light-01-list.png` · `-02-opened.png` · `-03-done.png` |
| S2 | PC 1280×900 다크 | 완료 불가(S1과 같음) | 3번, 같은 결과 | 없음 | `festival-pc-dark-0{1,2,3}-*.png` |
| S3 | 휴대폰 390×844 라이트 | 3번(정상, 날짜 47px) | 3번(날짜 49px, 지도 버튼 정렬) | 없음 | `festival-phone-light-0{1,2,3}-*.png` |
| S4 | 휴대폰 390×844 다크 | 3번 | 3번 | 없음 | `festival-phone-dark-0{1,2,3}-*.png` |

- 로그인 상태: 로컬에 Core가 없어 미실행. 화면·시트 경로는 같고 저장 함수만 다름(`addFestivalVisitToCalendar`, 이번에 안 바꿈).
- 위치 허용·거부: 이 버튼과 무관(목록 지역만 바뀜) — 미실행.

## USER_FIRST 기준

- ① 탭 수: 목록에서 3번(버튼·날짜·등록), 화면 안에서 끝남. ③ 막다른 화면: PC 무반응 해소. ④ "일정을 등록했어요." = 실제 캘린더 저장 1건(검사기에서 저장값 확인).
- ⑥ 날짜 칸 PC 54px·휴대폰 49px. **[일정 등록]·[등록]·[닫기]는 44px 그대로** — 카드 버튼 공용 규칙(`site-consumer-detail.css`, 공통 UI 방)과 공용 시트 [닫기]라 이 P1에서 안 바꿈. 48px로 올릴지는 공통 UI 방 판단.
- ⑦ PC·휴대폰 × 라이트·다크 4조합 실행, 로그인은 위와 같이 미실행.

## 검증

- 신규 `scripts/validate_festival_calendar_add_pc_01.mjs`(실제 브라우저, body 스크롤 잠금·스크롤되는 본문 = 운영과 같은 구조): 1280×900·1024×768 → INLINE, body 직속 아님, 눌린 카드 안·버튼 줄 바로 아래, 폭 ≤420, aria-expanded, 두 번째 누름 닫힘, 날짜·[닫기]·[등록]이 화면 안이고 elementFromPoint로 눌림, 날짜 ≥48px, 등록 후 문구·저장 1건·빈 자리 없음·지도 버튼 높이 맞음. 390×844 → SHEET·fixed·같은 저장. **수정 전 7c4f0944 파일로 돌리면 FAIL**(1280에서 "picker closed after 등록" 시간 초과), 수정본 PASS.
- 기존 `validate_festival_calendar_add_ui_01`(소스 계약 `createBottomSheet({ label: '일정 등록',`) 그대로 PASS.
REGRESSION=80137ebf에서 관련 검사기 34개 순서 실행(scripts/validate_festival_* · validate_bottom_sheet_* 전부 + site-festival·site-bottom-sheet·festival을 읽는 검사기 전부, CHROME_BIN·PYTHONIOENCODING=utf-8 지정) → 32 PASS / 2 FAIL. 두 FAIL 모두 수정 전 7c4f0944 파일에서도 실패(이 변경과 무관):
  - validate_mobile_footer_legal_sheet_01: "761px: mobile disclosure leaked into desktop" — 7c4f0944 파일로 돌려도 같은 단정에서 FAIL(Windows 로컬 기존 실패).
  - validate_site_refresh_route_restore_01: 로그인 복귀 직후 route는 정착했는데 auth가 아직 'checking'인 경합(검사기가 route 정착만 기다림). 7c4f0944 파일 5번 중 1번 FAIL(#wallet 로그인 복귀), 수정본 4번 중 1번 PASS(#scam 로그인 복귀). 이 경로에서 축제 코드는 불리지 않음. 같은 시각 다른 작업본(캘린더 변경만)도 2번 중 1번 FAIL.
NEW_FAILURES=0 (위 2건은 기준 main에서도 재현)
LINUX_GATE=NOT RUN locally (이 PC에 Linux 없음)
REAL_DEVICE=NOT VERIFIED

## 배포 후 확인 제안

1. PC(1280) 지역정보 → 축제·행사 → 카드 [일정 등록]: 버튼 줄 바로 아래 달력이 보임 → 날짜 → [등록] → "일정을 등록했어요." → 캘린더 그 날짜에 축제 이름.
2. 휴대폰: 기존처럼 아래 시트.
