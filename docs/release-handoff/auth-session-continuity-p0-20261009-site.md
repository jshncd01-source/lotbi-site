# AUTH SESSION CONTINUITY P0 2026-10-09 — SITE READY

READY_FOR_DEPLOY=YES
USER_DECISION_NEEDED=NONE
MIGRATION=NO
DEPLOY_ORDER=WEB -> SITE
BRANCH=feature/auth-session-continuity-p0-20261009-site
PAIRED_BRANCH=feature/auth-session-continuity-p0-20261009-web
BASE_MAIN=fa6ed88d3608536050de0fb56136ae9b920a4c55
CODE_SHA=ceb48e9a
ASSET_VERSION=aset-ca1c897a7396

## 동작

- 잘못되거나 이미 사용된 callback의 `code/state`, 누락·불일치 context, 만료, source session invalid를 재사용하지 않는다.
- 허용된 stale callback 오류에서 Account 세션 상태를 먼저 읽는다. 유효할 때만 완전히 새로운 state/verifier/challenge를 만드는 PKCE handoff를 시작한다.
- 같은 탭의 한 페이지 진입에서 recovery marker는 1회만 기록되며 두 번째 시도는 중단한다. Account 세션이 없거나 상태 확인이 실패하면 callback 오류 화면과 홈/로그인 안내로 끝난다.
- 기존 callback 값, 만료·철회 세션, bearer를 되살리지 않는다. state/PKCE/replay/logout 검증은 유지한다.
- 유효한 callback context를 읽은 뒤 Core에서 stale 오류가 난 경우 작성 중 텍스트와 원래 hash 목적지를 새 handoff에 전달한다.
- 일반 홈 진입과 새로고침은 기존 continuity 경로를 유지하며 불필요한 OAuth provider 시작을 추가하지 않는다.

## 짝 배포와 범위

- Account의 session status GET 완화가 먼저 있어야 하므로 WEB 배포 후 SITE를 배포한다.
- 짝 Web branch: `feature/auth-session-continuity-p0-20261009-web`, Web code SHA `2cee90f`.
- `site-theme-tokens.css`는 변경하지 않았다. 자산 참조 토큰만 최종 tree에서 `aset-ca1c897a7396`으로 재생성했다.
- DB/API migration 없음. Core 변경 없음.

## 검증

- `validate_auth_continuity_02`: 모든 stale 오류의 새 PKCE 1회 recovery, 원래 draft/hash 보존, 두 번째 시도 차단, 비로그인 차단 PASS.
- `validate_site_normal_assurance_01`: FULL/FEDERATED_LIMITED, 제한 세션 fail closed, PKCE/state/replay/logout PASS.
- `validate_auth_unknown_recovery_browser_01`: 로컬 Chrome 실제 런타임 PASS.
- `validate_site_refresh_route_restore_01`: 375/390/1280 viewport 529 checks PASS.
- `validate_home_fresh_entry_01`, `validate_home_refresh_persistence_01`, `validate_conversation_integration`, iOS social return, Site/Hardening/Clean URL/Accessibility, checkout handoff, login/Kakao share 회귀 PASS.
- Asset cache coherence PASS(63 files, 130 targets, 156 refs). `site-theme-tokens.css` 변경 없음.
- Google/Kakao/Naver/Apple provider 시작·callback·signup/link 회귀는 짝 Web 전체 테스트 615/615 PASS로 확인했다.

## 운영 근거와 미검증

- Site Production Render: service `srv-davqgi7lk1mc73c5sh3g`, deployment `dep-db3vl4ss728c73fdkckg`, image digest `sha256:7a08c5c279a62ac97b88fae01baf0ec445251e733b603db19dae5ca57ec4fdf4`, 기존 asset `aset-1349a7eafa03`.
- 기존 social-login-4p-recovery READY의 consumed callback 처리 코드는 운영 asset에 존재했다. 이번 건은 별도의 새 결함이다.
- iPhone Safari: NOT VERIFIED.
- Samsung Internet: NOT VERIFIED. 운영 32건 로그에 SamsungBrowser UA는 없었다.
- Android Chrome: NOT VERIFIED.
- 카카오톡 인앱 브라우저: NOT VERIFIED.
- 장시간 백그라운드, 명시적 로그아웃 후 재접속, 실제 만료·철회 세션: 계약/회귀 PASS, 실기기 NOT VERIFIED.

BLOCKERS=실기기 검증과 WEB 선배포 후 SITE 배포가 필요. 코드·테스트·migration blocker 없음.
