READY_FOR_DEPLOY=YES

# site-refresh-route-page-cleanup-05 — release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/site-refresh-route-page-cleanup-05
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote origin refs/heads/feature/site-refresh-route-page-cleanup-05`)
REMOTE_FEATURE_SHA=same as FEATURE_SHA after push (checked with git ls-remote at push time)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=22631a2506def8bde6b0d99b9868deebc0c8c496 (SITE-T26 Life Wallet까지 포함; f59c8ef3(SITE-T24 P0) → 86424ab6, 33aa5d9a(SITE-T25 학교 급식) → c81df9bb, 22631a25 → ec851895 순서로 정상 merge, rebase 없음)
CODE_SHA=ec851895 (merge of main 22631a25; the fix itself is 58eac217)
ASSET_VERSION=aset-ab70ab2b1f2b
DEPENDS_ON=feature/site-refresh-route-festival-back-04 (SITE-T24로 main·Production 반영 완료)
ROOT_CAUSE=화면 자신의 ←/×가 아닌 방법(새 대화·대화 전환·생활정보 상세 → 입력창 초안·프로필 메뉴(로그아웃 경로)·세션 변경)으로 화면이 바뀌면, 화면은 즉시 바뀌고 URL은 syncSiteRouteToScreen의 history.back() 왕복 뒤에야 따라감 → 그 사이 "홈 화면 + /#life". P0(축제 ←)와 같은 경쟁, ←/× 밖의 경로.
PRODUCT_CHANGE=YES (site-conversation.js)
SLOW_ENV_REPRO=P0 코드(b3dfcc65) + 새 validator: CPU 1배·4배·6배 각 1회 = 3/3 FAIL(전부 'M 새 대화: screen and URL changed together' {screen:"", url:"#life"}, 화면에 그려진 frame 포함). 이 branch: CPU 4배·6배 각 1회 PASS(iPhone 390x844, 181 checks).
TEST_STATUS=merge 전 트리(main f59c8ef3 + 수정) scripts/validate_* 212개: 207 PASS(1차 202 + 부하성 실패 3개 단독 재실행 PASS + place_card_compact_01·conversation_calendar_card_02는 다른 방이 같은 고정 포트 4213을 계속 점유해 같은 트리 사본에서 포트 번호만 바꿔 PASS) / 기존 Windows RED 4(validate_calendar_system_dark_01, validate_image_attachment_thumbnail_01, validate_mobile_footer_legal_sheet_01, validate_site_avatar_fallback_runtime — main에서도 같은 FAIL) / validate_auth_unknown_recovery_browser_01 검사 PASS 후 Windows 임시 프로필 삭제 EPERM(main 동일). main 33aa5d9a + 수정: 비브라우저 144/144 PASS + 관련 브라우저 5/5 PASS(refresh_route 181/181/179 checks, school_meal_neis_admin_fallback_01, neis_school_official_links_01, pinned_conversation_section_01, life_medical_category_entry_01). 최종 트리(main 22631a25 + 수정): 비브라우저 146/146 PASS + 관련 브라우저 3/3 PASS(refresh_route 181/181/179 checks, life_wallet_photo_picker_01, pinned_conversation_section_01).
NEW_FAILURES=0
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
DEPLOY_SCOPE=lotbi-site only (Core / Account Web / App / Admin 무변경, 배포 순서 제약 없음)
USER_DECISION_NEEDED=NONE

## CHANGE

- `site-conversation.js` `syncSiteRouteToScreen`: 지금 보이는 화면이 "현재 history entry를 연 화면"과 같을 때(= 한 칸 뒤로 가야 할 때), 먼저 현재 entry를 지금 화면 이름으로 바꾸고(`replaceState`, 같은 task → URL이 화면과 동시에 바뀜) 그 뒤 한 칸 뒤로 간다(history에 같은 화면 사본이 남지 않음).
  - 바뀐 entry는 원래 화면을 기억(`lotbiRouteCollapsedFrom`) → 앞으로 가기로 그 entry에 오면 원래 화면 이름을 되돌리고 그 화면을 다시 연다(브라우저 앞으로 가기 의미 유지).
  - 그 한 칸 뒤로의 popstate는 아무것도 바꾸지 않음 — 그 사이 다른 화면이 열렸으면 그 화면이 자리를 지키고 URL만 따라감(이전 단계가 새 화면을 닫지 않음).
  - 화면 변경은 여전히 탭(click) 안에서 즉시 → 새 대화의 입력창 포커스가 탭 안에서 일어나 iPhone 키보드 동작 그대로(P0의 "history 먼저" 방식을 쓰지 않은 이유).
  - P0의 ←/×/Escape/바깥 탭 경로(`leaveSiteRoute`)는 그대로.
- `scripts/validate_site_refresh_route_restore_01.mjs` CASE M(신규, 강화만): 생활정보가 열린 상태에서 ①새 대화 ②대화 전환 ③생활정보 지역생활정보 → 질문 준비하기(입력창 초안) ④(로그인) 프로필 메뉴 — 각각 URL과 화면이 같은 task에서 함께 바뀜(페이지 안 probe 불일치 0), history 한 칸 뒤로(사본 없음), 앞으로 가기로 생활정보 재오픈, 새 대화=빈 대화·대화 전환=그 대화·초안=입력창에 질문·프로필 메뉴=로그아웃 버튼 표시.
- asset 토큰 재생성(aset-ab70ab2b1f2b).

## 검증 (viewport 에뮬레이션, 실기기 iPhone Safari 아님)

- 새로고침 validator(최종 트리): iPhone-375x812 181 / iPhone-390x844 181 / desktop-1280x900 179 checks PASS.
- 감속(iPhone 390x844, `ROUTE_RESTORE_CASES=iPhone-390x844`):

| 트리 | CPU | 결과 |
|---|---|---|
| P0 b3dfcc65 + 새 validator | 1배·4배·6배 각 1회 | FAIL 3/3 — `M 새 대화` {screen:"", url:"#life"} |
| 이 branch | 4배·6배 각 1회 | PASS 2/2 (181 checks) |

- 전체 회귀: 위 TEST_STATUS. 다른 방 validator와 고정 포트(4213 등)가 겹치는 Windows 로컬 환경이라 같은 포트 validator는 포트만 바꾼 사본으로 확인함 — Linux gate에서는 원래 포트 그대로 판정 필요.

## 남은 것 (이번 범위 밖)

- 로그인 상태 Life Wallet처럼 여는 데 서버 확인이 필요한 화면은, 뒤로/앞으로 가기 때 URL이 먼저 그 화면을 가리키고 화면은 확인 뒤 열림(기존 동작, 검사 안 함).

## BRANCH HISTORY

- 58eac217 fix(site): name the screen in the URL at once when it changes by other means (b3dfcc65 위)
- 86424ab6 Merge origin/main f59c8ef3 (SITE-T24, 트리 변화 없음)
- c81df9bb Merge origin/main 33aa5d9a (SITE-T25 학교 급식, 충돌은 asset 토큰뿐)
- 88a06331 첫 READY 문서(push 직전 main이 22631a25로 이동 → 아래에서 대체)
- ec851895 Merge origin/main 22631a25 (SITE-T26 Life Wallet, 충돌은 asset 토큰 + site-life-wallet.js import 한 줄 = main 쪽 채택)
- 이 문서 커밋
