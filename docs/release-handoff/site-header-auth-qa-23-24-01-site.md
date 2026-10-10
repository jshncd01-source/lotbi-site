READY_FOR_DEPLOY=YES
MIGRATION=NO
DEPLOY_ORDER=SITE 단독 (Core·Web·App 변경 없음, 같은 묶음의 Web QA #22와 순서 무관)
USER_DECISION_NEEDED=NONE

# site-header-auth-qa-23-24-01-site — release handoff

TASK=배포총괄방 QA #23(Header "계정 확인 중"이 오래 걸릴 때 로그인 버튼 보이기) · QA #24(로그인한 휴대폰 Header 오른쪽에 프로필 보이기)
REPO=lotbi-site (Ncloud)
FEATURE_BRANCH=feature/site-header-auth-qa-23-24-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD, `git ls-remote origin refs/heads/feature/site-header-auth-qa-23-24-01-site`로 확인)
CODE_SHA=24a2762c8276e0300e3bcc8b941694764aa1501e (77feafe6 기능 → 24a2762c main afb7057d 정상 merge)
BASE_MAIN=afb7057d1d8c149e2b46eb1d656b1049e36b831d (작업 시작 61d3ce37 → READY 직전 ls-remote에서 afb7057d로 움직여 정상 merge. 충돌은 토큰 줄과 main이 새로 넣은 import·link 줄뿐, 해당 구간은 main 쪽을 그대로 씀)
ASSET_VERSION=aset-51bf873661d1 (LF checkout에서 `asset_cache_version.mjs --check` PASS)
FLAG=없음
PRODUCTION_CHANGED=NO / DB_CHANGED=NO / NEW_SECRET_CREATED=NO / LIVE_MONEY=NO / NEW_PAID_RESOURCE_CREATED=NO

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
