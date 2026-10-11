READY_FOR_DEPLOY=YES
MIGRATION=NO
DEPLOY_ORDER=SITE 단독 (Core·Web·App 변경 없음, 같은 묶음의 Web QA #22와 순서 무관)
USER_DECISION_NEEDED=NONE
SUPERSEDES=d7cd420344731d63c6f4988c7a3fbf395970623a (FIX 02), 그 앞 279da9ec56110873766eefef4ac0226cf5d8d30f (gate FAIL: validate_accessibility.py:127 "index.html: expected one mobile menu open control")

# site-header-auth-qa-23-24-01-site — release handoff

TASK=배포총괄방 QA #23(Header "계정 확인 중"이 오래 걸릴 때 로그인 버튼 보이기) · QA #24(로그인한 휴대폰 Header 오른쪽에 프로필 보이기)
REPO=lotbi-site (Ncloud)
FEATURE_BRANCH=feature/site-header-auth-qa-23-24-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD, `git ls-remote origin refs/heads/feature/site-header-auth-qa-23-24-01-site`로 확인)
CODE_SHA=251320592f411d89e9c8b0605a685b4bdad6fe4a (77feafe6 기능 → 24a2762c main afb7057d 정상 merge → 7f5c45ba FIX 02 → 이 커밋 FIX 03)
BASE_MAIN=afb7057d1d8c149e2b46eb1d656b1049e36b831d (작업 시작 61d3ce37 → READY 직전 ls-remote에서 afb7057d로 움직여 정상 merge. 충돌은 토큰 줄과 main이 새로 넣은 import·link 줄뿐, 해당 구간은 main 쪽을 그대로 씀)
ASSET_VERSION=aset-901119375843 (LF checkout에서 `asset_cache_version.mjs --check` PASS)
FLAG=없음
PRODUCTION_CHANGED=NO / DB_CHANGED=NO / NEW_SECRET_CREATED=NO / LIVE_MONEY=NO / NEW_PAID_RESOURCE_CREATED=NO

## 사용자 시나리오 (USER_FIRST_STANDARD 8) — FIX 03

상세·스크린샷·측정 원본: `C:/Users/jshnc/LOTBI-NCLOUD/release-control/user-scenarios/site-header-auth-qa-23-24-01/` (SCENARIOS.md, results.json, PNG)

| # | 흐름 | 탭 수 | 막힌 곳 |
|---|---|---|---|
| S1 | 로그인한 휴대폰 → Header 프로필 → 메뉴 서랍(계정 줄까지는 +1) · 라이트·다크 | 1 (+1) | 없음 |
| S3 | 로그인 안 한 휴대폰, Account 3초 → 약 1.3~1.5초에 로그인 버튼 → 누르면 계정 로그인 주소로 이동 · 라이트·다크 | 1 | 처음 0.8초는 버튼 없음(의도) |
| S4 | 로그인 안 한 PC, Account 3초 → 사이드바 "계정 확인 중" 옆에 약 1.5~2.0초에 로그인 버튼 → 이동 · 라이트·다크 | 1 | 처음 0.8초는 버튼 없음(의도) |
| S5 | 로그인한 휴대폰, 응답 빠름 → 홈 열기만 | 0 | 없음, 로그인 깜빡임 0 |
| S6 | 로그인한 PC → 홈 열기만 · 라이트·다크 | 0 | 없음 |

따라 해서 발견해 고친 것(FIX 03): ① PC에는 #23이 안 닿았다(Header 계정 영역이 PC에는 없고 "계정 확인 중"은 사이드바에 글자뿐) → 사이드바(PC·휴대폰 서랍)에도 같은 지연 로그인. ② 터치 44px → 프로필 버튼 48, 로그인은 눌리는 영역 48+.
고치지 않고 보고하는 것: 다크 모드에서 "계정 확인 중"이 길면 본문이 흰색+연한 글자(현재 main T54에서도 동일, 원인·스크린샷은 SCENARIOS.md). 햄버거(44)·확인 후 로그인/회원가입 버튼(약 36)도 48 미달(기존, 범위 밖).

## FIX 02 — gate 반환 원인과 조치 (재READY)

증상
- 배포총괄방 gate에서 `validate_accessibility.py:127` 실패: `index.html: expected one mobile menu open control`.

원인 [확인된 사실 — 로컬 재현, 같은 문구]
- 검사기는 index.html의 `data-mobile-nav-open` 버튼이 정확히 1개이고 aria-controls=mobile-nav-drawer·aria-expanded=false·aria-label을 가질 것을 요구한다.
- 279da9ec의 새 휴대폰 Header 계정 버튼이 같은 속성을 달아 2개가 되었다(기존 메뉴 버튼 + 새 계정 버튼). 내 검사기(validate_site_header_auth_qa_23_24_01)는 브라우저 시나리오 위주라 이 규칙을 보지 못했다.

조치 (검사기 완화 없음)
| 파일 | 내용 |
|---|---|
| index.html | 계정 버튼 속성을 `data-mobile-nav-open` → `data-mobile-account-open`으로. 메뉴 버튼이 페이지의 유일한 `data-mobile-nav-open` |
| home-shell.js | 드로어 열기 버튼 선택을 `[data-mobile-nav-open], [data-mobile-account-open]`으로. aria-expanded 갱신·닫을 때 포커스 복귀는 두 버튼에 똑같이 적용 |
| scripts/validate_site_header_auth_qa_23_24_01.mjs | 새 속성 단정, 계정 버튼이 두 번째 `data-mobile-nav-open`이 아니라는 단정, index.html에 `data-mobile-nav-open`이 정확히 1개라는 단정, home-shell이 두 속성 모두 연다는 단정 |

- 계정 메뉴는 여전히 드로어 한 곳이고, 동작 변화는 없다(같은 드로어를 연다).
- `scripts/validate_accessibility.py`를 포함한 기존 검사기는 한 줄도 바꾸지 않았다.

재검증 (CODE_SHA 7f5c45ba, base main afb7057d — 원격 main은 아직 afb7057d, T54는 아직 main에 없음)
- gate와 같은 python 검사기 14개 전부 PASS: validate_site, clean_urls, trusted_device_plan_limits_01, ios_social_return_01, nginx_module_mime_01, subscription_price_proration_01, home_chat, bare_white_home_skin_01, document_cache_policy_01, hardening, accessibility(LF checkout 포함), apple_app_site_association, about, consumer_predeploy_guards_01.
- 브라우저·계약 검사기 PASS: header_auth_qa_23_24_01(5 시나리오, 새 버튼으로 드로어 열림 포함), single_profile_entry_01, home_same_url_stability_01, auth_continuity_02, sidebar_information_architecture_04, sidebar_viewports_04, scam_shield_mvp_01, consumer_sections_02, mobile_home_ux_stability_01, profile_menu_improvement_01, focus_ring_container_01, sticky_topbar_01, mobile_home_initial_scroll_01, conversation_account_sync_01.
- asset coherence PASS(LF checkout, aset-c2ddf661acdd).
- T54가 main에 들어오면 이 방에서 그 main을 정상 merge해 다시 알린다(요청 시).

## 확인한 것 (작업 전)

- 원격: ssh://lotbi-ncloud-git/srv/git/repositories/lotbi-site.git
- 같은 기능 branch: 원격에 `feature/site-header-auth-qa*` 없음. 새 worktree(C:/Users/jshnc/LOTBI-NCLOUD/site-header-auth-qa-23-24-01-site)를 main에서 만듦.
- 같은 파일을 만지는 다른 READY: `feature/site-login-handoff-repeat-01-site` d589497d(C·D, gate 대기). 아래 "C·D와의 관계" 참고.

## 바뀐 것 (main 대비 토큰 외 변경 파일은 아래 6개뿐)

| 파일 | 내용 |
|---|---|
| site-continuity.js | #23 확인 중 Header에 `로그인`(account-login-while-checking)을 처음부터 넣어 둠. Account가 "로그인됨"이라고 답하는 순간 `withdrawLoginWhileChecking()`으로 뺌 |
| site-auth-continuity.css | #23 0.8초 동안은 보이지 않고 눌리지 않음(opacity·pointer-events만, 자리 이동 없음) → 그 뒤 "확인 중" 자리에 `로그인`. #24 휴대폰(≤900px)·로그인 상태에서만 Header 계정 버튼 44×44 |
| index.html | #24 Header 오른쪽 계정 버튼(`data-header-account`, 누르면 기존 메뉴 서랍 열림) |
| site-conversation.js | #24 계정 버튼 그림을 사이드바 계정 줄과 같게(사진·이니셜·기본). 그림이 바뀔 때만 교체해서 누르는 도중 버튼이 바뀌어 탭이 사라지는 일 없음. 로그아웃 시 기본 그림 |
| scripts/validate_site_header_auth_qa_23_24_01.mjs | 새 검사기: 정적 단정 + 브라우저 5개(느린 로그아웃 → 0.8초 뒤 로그인 보임·누름 가능 / 느린 로그인 → 로그인 빠짐 / 빠른 로그인 → 로그인 한 번도 안 보임 / 390px 계정 버튼 → 서랍 열림 / 데스크톱 숨김) |
| .github/workflows/site-review.yml | 위 검사기 단계 등록(p0_02 단계 다음) |

- 정적 첫 화면은 그대로 "계정 확인 중"(home_same_url_stability 단정 유지). 로그인 버튼은 JS가 확인을 시작한 뒤에만 생김.
- 계정 메뉴는 여전히 서랍 안 한 곳(SITE-NAV-SINGLE-PROFILE-ENTRY-01 검사기 PASS). Header 버튼은 그 서랍을 여는 두 번째 입구.

## 알려 둘 점

1. #23 대가: 로그인한 사람인데 Account 답이 0.8초보다 늦으면, 답이 올 때까지 `로그인`이 잠깐 보였다가 빠진다. 그 사이 누르면 기존 로그인 연결로 가서 바로 로그인 상태로 돌아온다(새 경로 아님, recoveryLoginLink).
2. C·D와의 관계: 두 branch 모두 site-continuity.js를 고치지만 서로 다른 함수(C·D = restore 재시도·pageshow, 이 branch = 확인 중 노드·상태 응답 직후 한 줄). 나중에 들어가는 쪽은 토큰 줄 충돌만 날 것으로 예상. 요청하면 이 방에서 main merge 후 재READY.
3. `validate_auth_session_continuity_p0_02.mjs` "Account session gone" 시나리오는 이 branch 바탕(main)에서 부하가 크면 가끔 실패한다(pageshow 중복 확인). 이 원인은 C·D branch에서 고쳤다. merge 뒤 이 PC에서는 3/3 PASS.

## 테스트 (로컬 Windows)

- merge 뒤(CODE_SHA 24a2762c): header_auth_qa_23_24_01 PASS, single_profile_entry_01 PASS, home_same_url_stability_01 PASS, auth_continuity_02 PASS, site_session_request_storm_p0_01 PASS, auth_session_continuity_p0_02 3/3 PASS, asset coherence PASS(LF checkout), `node --check` site-continuity.js·site-conversation.js·site-auth.js OK.
- merge 전(77feafe6 코드): header_auth_qa_23_24_01 연속 6/6 PASS.
- 원래 있던 실패(이 변경과 무관, main에서도 같음): social_signup_profile_ux_01 시간 의존, refresh_route_restore_01(main 61d3ce37 Windows에서도 실패), site_avatar_fallback_runtime. 전체 Site validator 묶음은 gate가 실행.
- 실기기·Production: NOT_TESTED (배포 후 배포방 smoke 대상)

## 롤백

이전 Site 이미지로 되돌리면 끝.

## 다음 owner

배포총괄방: trusted gate → main merge → 배포.
