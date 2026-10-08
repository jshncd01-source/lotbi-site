READY_FOR_DEPLOY=YES

# site-refresh-route-festival-back-04 — release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/site-refresh-route-festival-back-04
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote origin refs/heads/feature/site-refresh-route-festival-back-04`)
REMOTE_FEATURE_SHA=same as FEATURE_SHA after push (checked with git ls-remote at push time)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=c9c19e4cef9914f0b50d4870cbcc59e58602ddc2 (작업 시작·push 직전 ls-remote 모두 동일, main merge 불필요)
CODE_SHA=95138ac2 (full SHA: 95138ac23bb77699343d2617518404a3e2ffe5fc)
ASSET_VERSION=aset-663b145f9c93
ROOT_CAUSE=축제·행사 ← 가 화면을 먼저 생활정보로 바꾸고 그 뒤 history.back()을 불러, 브라우저 왕복 한 번 동안 "생활정보 화면 + URL /#festival" 상태가 생김(경쟁). validator는 보이는 화면만 기다려 그 틈에 URL을 읽으면 FAIL. Linux gate(2코어)에서 그 틈이 넓어져 간헐 실패.
PRODUCT_CHANGE=YES (site-conversation.js, site-scam-shield.js — ←/×/Escape/바깥 탭 닫기는 history 먼저, popstate에서 화면 변경)
SLOW_ENV_REPRO=수정 전 main + 새 validator: CPU 1배 1회·4배 3회·6배 3회 = 7/7 FAIL(전부 'festival back arrow: screen and URL changed together' {screen:life, url:#festival}). 수정본 + 새 validator: CPU 4배 3회·6배 3회 = 6/6 PASS(iPhone 390x844, 152 checks). 보호코드 제거 변이 3종 = 3/3 FAIL.
UTILITY_BRANCH_TRIAL_MERGE=CLEAN_AFTER_RESOLVE — 이 branch + 학교 급식 7a0023a8 + Life Wallet dff5dfa8 + 공과금·롯비함 4329bc71 순서 시험 merge(로컬만, 그 branch들에 push 없음). 코드 충돌 1줄(롯비함 installSurfaceBehavior: route 플래그 + backRoute 합침) + import 합집합 + 토큰. 결과: 비브라우저 validator 146/146 PASS + 관련 브라우저 validator 6/6 PASS(refresh_route 148/148/146 checks, life_info_cleanup_final_01, school_meal_neis_admin_fallback_01, neis_school_official_links_01, life_medical_category_entry_01, life_wallet_photo_picker_01)
TEST_STATUS=scripts/validate_* 212개(Windows 로컬, 다른 방 Chrome 120개·CPU 100% 부하) — 206 PASS(1차 197 + 부하성 실패 9개 단독 재실행 PASS) / 기존 Windows RED 4(validate_calendar_system_dark_01, validate_image_attachment_thumbnail_01, validate_mobile_footer_legal_sheet_01, validate_site_avatar_fallback_runtime — main c9c19e4c에서도 같은 4건 FAIL 확인) / validate_auth_unknown_recovery_browser_01: 검사는 PASS 출력 후 Windows 임시 프로필 삭제 EPERM으로 종료코드 1(main에서도 동일) / validate_place_card_compact_01: 3회 모두 페이지 모듈 로드 실패(Failed to fetch dynamically imported module, 다른 방이 같은 고정 포트 4213 동시 사용 확인) → 로컬 NOT VERIFIED, Linux gate 판정 필요
NEW_FAILURES=0 (단, validate_place_card_compact_01은 로컬 NOT VERIFIED — 위 TEST_STATUS)
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
DEPLOY_SCOPE=lotbi-site only (Core / Account Web / App / Admin 무변경, 배포 순서 제약 없음)
USER_DECISION_NEEDED=NONE

## 문제 (배포총괄방 증거)

- `scripts/validate_site_refresh_route_restore_01.mjs` "G festival ← → /#life (history back, same document)"가 Linux gate에서 연속 실패: SITE-T21b(20261008T011920Z)·SITE-T22(20261008T014057Z), 둘 다 iPhone-390x844, `{"url":"/#festival","routes":["life"],"homeVisible":true}`. SITE-T20은 PASS, Windows 로컬은 PASS → 간헐 경쟁.

## ROOT_CAUSE (측정)

- 수정 전 순서(main c9c19e4c): ← 클릭 → `closeSurface()` + `openConsumerSection('life')`로 화면이 즉시 생활정보 → microtask에서 `syncSiteRouteToScreen`이 "이 화면을 연 entry로 돌아가기"라 `history.back()` 호출 → 브라우저 왕복 뒤 popstate에서야 URL이 `/#life`.
- 그 사이 "생활정보 화면 + `/#festival`"이 실제로 그려짐: 새 validator의 페이지 안 probe가 수정 전 main에서 4배·6배 감속 시 그 상태의 frame을 기록(`{"when":"frame","screen":"life","url":"#festival"}`). 원래 개발방 세션 측정(페이지 안 기록): 화면이 URL보다 앞선 시간 CPU 1배 약 4ms, 4배 20~60ms, 6배 45~104ms.
- 이 틈에 새로고침·공유·새 탭을 하면 방금 떠난 축제·행사가 다시 열림(제품 문제).
- homeVisible=true: 착시. validator의 homeVisible은 입력창의 계산된 visibility/opacity만 보는데, workspace 화면은 홈을 숨기지 않고 위에 덮는다(`body.site-workspace-open`은 overflow만 바꿈). 축제 화면이 정상으로 열려 있을 때도 true. 원래 개발방 측정: 입력창이 hit-test로 실제 노출된 frame 0.
- Windows 로컬에서 원래 validator가 감속만으로는 재현되지 않은 이유(원래 개발방 측정): CDP evaluate 응답이 늘 popstate 뒤에 도착. 원래 validator 사본에 history.back() 150ms 지연 주입 + CPU 4·6배 → 수정 전 main에서 gate와 같은 `{"url":"/#festival","routes":["life"]}` FAIL 2/2, 같은 조건에서 수정 제품은 원래 validator 그대로 PASS 2/2.

## CHANGE

- `site-conversation.js`
  - `leaveSiteRoute(destination, change)`: 화면 자신의 ←/×/Escape/바깥 탭이 "이 문서가 쓴, 이 화면을 연 entry"로 돌아가는 경우 화면을 먼저 바꾸지 않고 `history.back()` 먼저 → popstate 핸들러가 그 change를 실행 → 화면과 URL이 같은 task에서 바뀜. 그 외(이 문서가 쓴 entry가 아님, 새로고침 뒤 등)는 기존처럼 즉시 change 후 URL이 따라감(같은 task 안 pushState).
  - 중복 방지: 진행 중인 step이 있으면 두 번째 ←/×/Escape는 무시(`pendingRouteLeave`), 기존 `routeTraversalPending`도 유지 → history.back() 1회.
  - 이전 닫기 보호: change가 실행될 때 자기 화면이 아직 떠 있는지 확인(`openSurface === surface`) → step이 도착하기 전에 다른 화면을 열었으면 그 화면을 닫거나 생활정보를 다시 열지 않음.
  - popstate가 1초 안에 오지 않으면 change를 그냥 실행(안전망, URL은 step 도착 시 따라감).
  - `installSurfaceBehavior`에 `backRoute`(축제·행사·롯비함 → `life`, 반려동물 → `care`). ← / Escape / 바깥 탭 모두 같은 경로.
  - 화면 밖에 포커스가 있을 때의 문서 Escape도 같은 경로(`leaveSiteRoute('', …)`).
- `site-scam-shield.js`: 진위확인 ×·취소·Escape·바깥 탭은 `lotbi:scam-shield-dismiss-request`(cancelable)를 먼저 보내고, route owner가 받으면 history 먼저 → popstate에서 닫힘. 듣는 owner가 없으면 기존처럼 바로 닫음(vm 실행 `validate_scam_shield_mvp_01` PASS).
- `scripts/validate_site_refresh_route_restore_01.mjs` (검사 강화, 삭제·완화 없음)
  - `settled()`가 "보이는 화면 = 기대"와 "URL이 그 화면" 둘 다 만족할 때까지 대기.
  - 페이지 안 AGREEMENT_PROBE: 라우트 화면이 바뀔 때마다(그 task의 microtask 64단계 뒤)와 매 frame마다 URL과 화면이 같은지 기록, 매 settled에서 불일치 0 단정(첫 그림 guard 동안 제외). popstate 횟수도 셈.
  - CASE L(신규): ①축제·행사 ←, ← , Escape를 step 도착 전에 연달아 → history 1칸·popstate 1회·생활정보 1개, 1.8초 뒤에도 그대로 ②← 직후 step 도착 전에 캘린더 열기 → step 도착 후 캘린더 유지(생활정보 재오픈·캘린더 닫힘 없음), 도착 전 불일치는 "캘린더 + 옛 #festival"뿐 ③진위확인 ×, ×, 취소, Escape → 1칸 ④화면 밖 포커스 Escape → 생활정보 닫힘·1칸, URL 동시.
  - `ROUTE_RESTORE_CPU_THROTTLE`(CDP setCPUThrottlingRate), `ROUTE_RESTORE_CASES`(viewport 선택) — 기본값은 감속 없음·전체 viewport(gate 동작 동일).
- `scripts/validate_consumer_design_shell_01.mjs`: Escape 계약 정규식을 새 경로(`goBack()`)로, `goBack` 정의(← = 이 화면 닫고 onBack) 단정 추가.
- asset 토큰 재생성(aset-663b145f9c93). 서버·nginx·라우트 표 변경 없음.

## 검증 (모두 viewport 에뮬레이션, 실기기 iPhone Safari 아님)

- 새로고침 validator 일반 속도(이 branch): PASS — iPhone-375x812 152 / iPhone-390x844 152 / desktop-1280x900 150 checks
- 감속 반복 (iPhone 390x844, `ROUTE_RESTORE_CASES=iPhone-390x844`):

| 트리 | validator | CPU | 결과 |
|---|---|---|---|
| main c9c19e4c(수정 전) | 새 validator | 1배 ×1 | FAIL 1/1 |
| main c9c19e4c(수정 전) | 새 validator | 4배 ×3 | FAIL 3/3 |
| main c9c19e4c(수정 전) | 새 validator | 6배 ×3 | FAIL 3/3 |
| 이 branch | 새 validator | 4배 ×3 | PASS 3/3 (152 checks) |
| 이 branch | 새 validator | 6배 ×3 | PASS 3/3 (152 checks) |

  모든 FAIL은 같은 단계: `festival back arrow: screen and URL changed together` `{screen:"life", url:"#festival"}`.
- 보호코드 제거 변이(새 validator가 잡는지): ①중복 방지 제거 → `L festival ← ← Escape` FAIL ②이전 닫기 보호 제거 → 캘린더가 닫히고 생활정보 재오픈, FAIL ③문서 Escape 옛 방식 → `L Escape outside 생활정보` FAIL. 3/3 FAIL.
- 전체 Site validator 회귀(`scripts/validate_*` 212개, 비브라우저 144 병렬 + 브라우저·서버 68 직렬): 206 PASS / 기존 Windows RED 4(main 동일) / EPERM 정리 1(검사 PASS, main 동일) / place_card_compact_01 로컬 NOT VERIFIED(포트 4213 타 방 동시 사용, 모듈 로드 실패). 부하성 1차 실패 9개(calendar_add_from_image_01, calendar_day_panel_two_buttons_01, calendar_expense_summary_01, calendar_holiday_surface_settings_icon_01, calendar_touch_monthnav_daysheet_01, calendar_weather_glyph_legibility_01, festival_event_08_responsive_a11y_01, profile_menu_personal_theme_01, sticky_topbar_01)는 모두 모듈 fetch 실패·dump-dom 결과 없음·Chrome 실행 시간 초과 유형이었고 단독 재실행 PASS.
- 시험 통합(이 branch + 7a0023a8 + dff5dfa8 + 4329bc71, 로컬 merge만): 비브라우저 146/146 PASS, 관련 브라우저 6/6 PASS(위 UTILITY_BRANCH_TRIAL_MERGE). 시험 merge 커밋은 로컬 scratch worktree에만 있고 어느 branch에도 push하지 않음.

## 배포 순서 메모

- 이 branch를 먼저 main에 넣은 뒤 학교 급식 Site 7a0023a8 → Life Wallet dff5dfa8 → 공과금·롯비함 4329bc71. 공과금 branch merge 시 `site-conversation.js` 롯비함 줄이 충돌: 양쪽 합쳐
  `installSurfaceBehavior(backdrop, panel, {workspace: 'life', route: LOTBI_BOX_UI_ENABLED ? 'lotbi-box' : '', trigger, backLabel: '생활정보로 돌아가기', onBack: () => openConsumerSection('life'), backRoute: 'life'});`
  import는 합집합(`LOTBI_BOX_UI_ENABLED`), `site-life-wallet.js` import는 Life Wallet 쪽(`isWalletPhotoKind, sniffWalletFile`) 유지, 나머지는 토큰뿐.

## 범위 메모 (최소 수정)

- 이 READY는 축제 ← /#life gate 실패 수정과 명령문이 요구한 보호(중복 history.back 방지, 이전 닫기 보호)만 담는다. 페이지 전체 정리는 없음.
- 다음 READY 후보(이번에 미포함): 사용자의 ←/×가 아닌 화면 전환(새 대화, 대화 전환, 생활정보 상세→입력창 초안, 로그아웃 등)은 기존처럼 화면을 먼저 바꾸고 URL이 한 번의 왕복 뒤 따라감. 새로고침 validator가 다루지 않는 경로.

## BRANCH HISTORY

- 95138ac2 fix(site): move the URL with the screen on 축제·행사 ← and other closes (main c9c19e4c 위 단일 커밋)
- 이 문서 커밋
- 같은 worktree를 원래 refresh-route 개발방 세션(재부팅 후 재개)도 잠시 썼음. 그 세션은 이 방에 커밋·push·READY를 넘기고 STOP. branch 커밋은 이 방만 만듦.
