READY_FOR_DEPLOY=YES
MIGRATION=NO
DEPLOY_ORDER=SITE 단독 (Core·Web·App 변경 없음)
USER_DECISION_NEEDED=NONE
SUPERSEDES=c085ec0ebcdd1f5d243be3cc6a00f5e6aabe301f (gate 2회 반환: validate_auth_session_continuity_p0_02 451행 'restore' !== 'timer')

# site-login-handoff-repeat-01-site — release handoff

TASK=배포총괄방 요청 C(로그인된 휴대폰에 "LOTBI 연결 오류 — 로그인 연결 파라미터가 올바르지 않습니다") · D(한 번 로그인한 기기에서 연결 화면·Account 왕복 반복 금지, P0-02 운영 확인)
REPO=lotbi-site
FEATURE_BRANCH=feature/site-login-handoff-repeat-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD, `git ls-remote origin refs/heads/feature/site-login-handoff-repeat-01-site`로 확인)
CODE_SHA=9b1177afdfd881afab8a50240206d90d7bf3f56f (6c506106 C·D → f098e601 main 61d3ce37 병합·P0-02 검사기 측정 시점 → 9b1177af pageshow 재확인 정리, 토큰 재생성)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=61d3ce37 (SITE-T53, 정상 merge, 충돌은 토큰 줄뿐)
ASSET_VERSION=aset-75fe321dfd37
FLAG=없음

## gate 반환 원인과 조치 (재READY)

증상
- SITE 묶음 gate 2회(base d4d172a5·61d3ce37) 모두 같은 단정에서 실패했다: `validate_auth_session_continuity_p0_02.mjs` 451행 `'restore' !== 'timer'`(세 번째 시나리오 "만료 전 갱신").
- gate 서버 단독 precheck는 2/2 PASS였다.

원인 [확인된 사실 — 재현]
- 검사기의 페이지 안 가짜 Core는 교환(redeem) 요청이 **도착하는 순간** 횟수를 센다.
- 페이지는 응답을 읽고 새 토큰을 넘겨받은 **뒤에야** 갱신 표시(`lotbi-auth:site-session-renewal`, reason 'timer')를 기록한다.
- 검사기는 "교환 ≥ 2"만 보고 바로 판정하므로, 그 사이에 찍힌 스냅샷에는 첫 갱신 표시 'restore'만 있다.
- **main 61d3ce37 자체**에서 재현했다.
  - CPU 16배 감속·병렬 8개: 8회 중 3회 판정 순간 표시가 `['restore']`뿐(조금 뒤엔 `['restore','timer']`).
  - 다른 묶음(12개 병렬)에서 main 1회가 gate와 똑같은 `'restore' !== 'timer'`로 FAIL.
- 이 시나리오는 정상 갱신 흐름이다. 이 branch의 재시도 코드('restore-retry'는 실패 때만 실행)는 실행되지 않는다. gate에서 이 branch 차례에 우연히 두 번 걸린 것이다.

조치(기준 약화 없음)
- 두 갱신 대기(만료 전 갱신, Core 거절 후 갱신)가 "교환 ≥ N"에 더해 "표시 ≥ N"까지 기다린다. 즉 갱신이 끝난 뒤 판정한다.
- 뒤따르는 단정은 그대로다: 교환 정확히 [pkce, pkce], 마지막 표시 'timer'·'RESTORED', 새 토큰 사용, 거절 후 'core-refused'·'RESTORED'.
- 불필요한 갱신이 하나라도 더 생기면 여전히 FAIL한다.
- 수정 뒤 같은 가혹 조건에서 이 단정 실패 0건이었다. 같은 묶음의 main 사본은 1건 실패했다.

같은 검사기의 다른 기존 흔들림 — 원인 확정 후 제품에서 수정 [확인된 사실, main에서 재현]
- 증상: "상태 확인과 갱신 사이 Account 세션 끊김" 시나리오에서 `renewals 2 !== 1`이 나온다.
  - main CPU 4배 감속에서 12회 중 1회, 5회 중 1회 재현.
  - 부하 10회 연속 실행에서도 이 한 가지로 1회 실패.
- 원인(이벤트 기록으로 확인): 일반 페이지 로드도 load 직후 `pageshow`(persisted=false)를 낸다.
  - DOMContentLoaded에서 시작한 Account 확인이 load 전에 끝나면, 이 pageshow가 같은 페이지에 대해 Account 확인과 갱신을 한 번 더 했다.
  - 기록 예: status@2550 → renewal@2557 → load@2648 → pageshow@2648 → status@2652 → renewal@2702.
  - 운영에서도 빠른 로드마다 불필요한 Account·갱신 요청이 한 번 더 나가던 것이다.
- 수정(`site-continuity.js` pageshow 처리기): bfcache 복원(persisted)일 때만 다시 확인한다. 일반 로드는 처음 시작한 확인이 담당한다.
  - bfcache 복원 때 handoff 잠금 해제(P0-02)는 그대로다.
  - validate_auth_continuity_02의 처리기 존재 검사도 그대로다.
- 결과: 같은 조건 12회 모두 갱신 1회·Account 확인 1회.
- 새 검사기에 "pageshow는 bfcache 복원만 재확인"(정적)과 "한 번 로드에 Account 확인 1회"(브라우저)를 추가했다.

## C — 원인

[확인된 사실]
- 스크린샷 화면에는 진단 줄이 없다.
  - 현재 운영 코드(P0-02 이후)는 콜백 오류마다 "진단 … · code N · state N · 기타 N · aset-…" 줄을 항상 붙인다.
  - 따라서 그 화면은 현재 운영 Site 코드가 그린 것이 아니다.
- 운영 Site는 두 서버 모두 최신이다.
  - 24회 표본에서 모두 aset-cd3d42af9220이었다.
  - /auth/callback/·/auth/start/는 no-store, /는 no-cache이다.
- 같은 시각 Core 로그(handoffs 200 ×2, redeem 200 ×2, /v2/me 200)는 정상 제자리 복원 2회와 같은 모양이다.
  - 로컬 재현에서 재방문 1회의 제자리 복원 = Account 갱신 1회 = Core handoff 1회 + redeem 1회.
  - 서버 쪽 로그인 복원은 성공했다.

[추정]
- 삼성 인터넷이 탭 복원 때 no-store가 적용되기 전에 저장해 둔 옛 콜백 페이지·스크립트를 재검증 없이 다시 띄웠다(Chromium 계열은 복원·뒤로가기에서 캐시를 우선한다).
- 옛 코드는 query가 빠진 콜백을 "파라미터" 오류로 처리했다.
- 기기 캐시라 서버 배포로는 지울 수 없다. 그 탭에서 "홈에서 다시 시도"를 한 번 누르면 이후 복원은 홈이 된다.

[확인된 사실 — 현재 코드에도 남은 같은 종류의 경로, 운영 코드 5675fd3d로 재현]
- 로그인된 기기에서 콜백이 낡았거나 깨져 열리면(복원 탭·뒤로가기·두 번 넘김·이미 쓴 코드) Account 왕복을 한 번 더 한다.
- 2분 안 두 번째는 "LOTBI 연결 오류" 화면이다.

## D — 운영 확인과 원인

[확인된 사실] P0-02 제자리 복원은 운영 코드에서 동작한다.
- 로컬 실체인(운영 Site 5675fd3d·Account main 코드·Core main, *.lotbiai.com 전부 로컬)에서 확인했다.
- 조건: 삼성 인터넷 UA, 모바일 화면, LTE 조건, 자동 로그인(기본 켜짐) 비밀번호 로그인 후 브라우저 종료·재시작.
- 재방문 결과: 페이지 이동 0, Account 왕복 0, 약 0.5초 만에 로그인 상태, Account 쿠키 30일 유지.

[확인된 사실] 첫 제자리 갱신이 한 번 실패하면(망 끊김·시간 초과) 운영 코드는 곧바로 전체 Account 왕복(연결 화면)으로 넘어간다. 검사기로 재현했다.

## 수정 (Site만)

1. `site-auth.js` 새 함수 `returnHomeFromStaleSiteHandoff`, 콜백 오류 처리에서 기존 복구보다 먼저 호출한다(`auth-callback.js`).
   - 낡거나 깨진 콜백 + Account 로그인 상태 → 홈으로 `location.replace`. 홈이 제자리 복원하므로 Account 왕복도 오류 화면도 없다.
   - 그대로인 것:
     - 입력 중이던 메시지가 있으면 기존 복구(새 연결이 메시지를 실어 감)
     - Account 로그아웃·확인 불가면 기존 진단 오류 화면
     - 2분 복구 표식 공유(홈↔콜백 무한 이동 차단)
   - 기존 `recoverStaleSiteHandoff` 계약은 바꾸지 않았다(validate_auth_continuity_02 그대로 PASS).
2. `site-continuity.js`
   - 홈 제자리 복원이 실패하면 한 번 더 제자리 시도('restore-retry') 후에만 전체 이동한다. 새 타이머는 없다(연속성 setTimeout 2개 고정 유지). 로그아웃 답은 즉시 로그인 버튼이다.
   - (재READY 추가) 일반 로드의 `pageshow`는 Account를 다시 묻지 않는다. bfcache 복원만 다시 확인한다. 위 "gate 반환 원인" 참조.
3. 새 검사기 `scripts/validate_site_login_handoff_repeat_01.mjs`(site-review.yml 등록)
   - 함수 단위 6건과 정적 순서 검사, pageshow는 bfcache만 재확인(정적).
   - 브라우저 4건: 로그인 상태에서 낡은 콜백 → 홈 로그인·Account 왕복 0·오류 0 / 깨진 콜백(code만) → 홈, "파라미터" 문구 0 / 2분 안 두 번째 → 진단 화면(무한 이동 없음) / 재방문 첫 갱신 실패 → 두 번째로 복원, 이동 0, 한 번 로드에 Account 확인 1회.
   - 운영 코드 5675fd3d에 같은 브라우저 검사를 돌리면 4건 모두 FAIL한다(검출 확인).
4. `validate_auth_session_continuity_p0_02.mjs` 두 갱신 대기의 측정 시점 수정(위 "gate 반환 원인").
5. asset 토큰을 재생성했다. main d4d172a5·61d3ce37 병합 충돌은 모두 토큰 줄뿐이었고, main 쪽으로 받은 뒤 같은 패치를 재적용했다.

## 검증 (재READY, main 61d3ce37 병합 후)

- `validate_auth_session_continuity_p0_02`: CPU 부하(바쁜 프로세스 4개, 16스레드 PC) 아래 순차 **10회 연속 PASS**(매회 9개 시나리오, 53~63초).
  - 같은 조건에서 수정 전에는 10회 중 1회 FAIL(갱신 2회 흔들림)이었다.
- 가혹 조건(CPU 16배 감속·병렬 12개) 비교: 고친 검사기의 'restore'≠'timer' 실패는 0건, 같은 묶음의 main 사본은 1건 실패했다.
- 세션 끊김 시나리오 단독(CPU 4배 감속) 12회: 갱신 1회·Account 확인 1회가 12/12였다(main은 12회 중 1회가 2회).
- 순차 실행 PASS: validate_site_login_handoff_repeat_01, site_session_request_storm_p0_01, auth_continuity_02, auth_unknown_recovery_browser_01, conversation_sidebar_ux_01, calendar_auxiliary_read_blast_radius_01, life_wallet_entry_lock_01 등 인증·연속성·세션 관련 18개 중 17개. asset coherence PASS.
- 나머지 1개 `validate_site_refresh_route_restore_01`은 **main 61d3ce37 자체에서도 이 PC(Windows)에서 6회 중 5회 FAIL**한다.
  - 같은 모양: "로그인하기 on /#wallet" 또는 "login from /#scam" → 상태 checking, Core 인증 호출 0.
  - d4d172a5 기준일 때는 이 branch에서도 PASS였다. SITE-T53 gate(Linux)는 이 검사를 PASS로 통과시켰다.
  - 이번 변경과 무관하게 T53 묶음에서 들어온 Windows 쪽 흔들림이다. 이 branch는 같은 실패 모양 외 새 실패가 없다.
- 알려진 기존 흔들림: `validate_social_signup_profile_ux_01`(main에서도 3회 중 2회 FAIL, 대화 동기화 `/v2/conversation-history/settings` 타이밍).
- 로컬 실체인(이 branch Site, 삼성 UA, LTE): 재방문 → 이동 없이 로그인 / 낡은 콜백 주소 진입 → 1.2초 만에 홈 로그인, Account 왕복 0.
- NOT TESTED: 실제 휴대폰, 운영, Linux gate.

## 배포 후 운영 확인 (배포총괄방 + 소유자 휴대폰)

1. 운영 asset이 `aset-75fe321dfd37`인지 확인한다.
2. 로그인된 브라우저에서 `https://lotbiai.com/auth/callback/?code=<43자 아무 값>&state=<43자 아무 값>`을 연다.
   - 기대: 오류 화면 없이 홈 로그인 상태.
   - 기대: Account 접근 로그에 /auth/site-handoff 없음, site-session-renewal 1회.
3. 소유자 휴대폰: 오류 화면이 남아 있는 탭이 있으면 "홈에서 다시 시도"를 한 번 누른다(옛 캐시 정리). 이후 LOTBI를 닫았다 열어도 로그인 화면이나 연결 화면 없이 바로 로그인 상태여야 한다.

되돌리기: Site 이전 운영 이미지(61d3ce37).

## 참고(이번 범위 밖)

- 이메일 회원가입 직후의 자동 로그인은 브라우저 세션 쿠키다(AUTH-SIGNUP-PASSKEY-OPTIONAL-P0-01, 로그인 화면의 "자동 로그인" 기본값과 다름).
- 그래서 새 가입자는 브라우저를 다시 열면 한 번 더 로그인해야 한다.
- 로그인 화면처럼 기본 유지로 바꿀지는 소유자 결정 사항이다. 바꾸면 Web 한 줄과 테스트 갱신이 필요하다.

CODE_SHA=9b1177afdfd881afab8a50240206d90d7bf3f56f
USER_DECISION_NEEDED=NONE
