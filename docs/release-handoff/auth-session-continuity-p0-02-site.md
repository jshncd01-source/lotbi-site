READY_FOR_DEPLOY=YES

# AUTH SESSION CONTINUITY P0-02 — SITE (모바일 로그인 유지 근본 수정)

USER_DECISION_NEEDED=NONE
MIGRATION=NO
DEPLOY_ORDER=WEB -> SITE (짝 Web이 늦어도 Site는 기존 이동 방식으로 폴백해 동작)
BRANCH=feature/auth-session-continuity-p0-02-site
PAIRED_BRANCH=feature/auth-session-continuity-p0-02-web (READY 61f1503e)
BASE_MAIN=9e39edd06446b3e93ec68170de49df9f702e0d07 (SITE-T38c: 유치원 + READY 01 ffa6c1e0 포함, 운영 미배포)
INCLUDES=READY 01 ffa6c1e0은 이미 main(9e39edd0)에 있음 — 이 branch는 그 위의 추가분
CODE_SHA=cff1cb8c
ASSET_VERSION=aset-78ece022807c
CORE_CHANGE=NO
SITE_THEME_TOKENS_CHANGED=NO

## 원인 (ROOT_CAUSE)

1. Site child session은 페이지 메모리에만 있고 30분(Core SITE_CHILD_SHORT_LIVED_V1)이다. 새로고침·탭 복원·브라우저 재실행·30분 경과(백그라운드 포함)마다 account.lotbiai.com/auth/site-handoff → /auth/callback 전체 페이지 이동이 필요했다. 모바일에서 이 사슬(sessionStorage PKCE 문맥, 301, history 교체, 탭 폐기·복원)이 한 번만 끊겨도 "LOTBI 연결 오류" 또는 로그인 버튼이 나왔다.
2. 만료 타이머와 site-core.js의 Core 401/403 알림이 Account 확인 전에 로그인 버튼부터 그렸다.
3. HTML 문서에 Cache-Control이 없어(nginx) 브라우저가 휴리스틱으로 보관하고, 탭 복원·뒤로가기는 서버에 묻지 않고 재사용한다. 10-08 23시 수정(빈 callback → 홈) 전 문서·코드가 기기에 남아 계속 실행될 수 있었다.
4. bfcache로 돌아온 페이지는 handoff 중이던 `redirecting=true`가 남아 이후 확인을 모두 막았다.
5. Account 비밀번호 로그인의 자동 로그인이 기본 OFF → 세션 쿠키 → 브라우저 완전 종료 시 Account 세션 소실(Web branch에서 수정).

## 이전 수정이 못 막은 이유 (PREVIOUS_FIX_GAP)

- 운영 asset aset-1349a7eafa03의 auth-callback.js·site-auth.js·site-continuity.js·site-core.js는 main fa6ed88d와 바이트 단위 동일(수정 존재 확인). 이 운영 코드는 query 없는 callback을 홈으로 보내므로 "로그인 연결 파라미터가 올바르지 않습니다"를 내지 않는다. 이 문구가 계속 보였다면 (a) 기기에 남은 수정 전 문서·JS(Cache-Control 없음), 또는 (b) code/state가 1개씩이 아닌 callback 진입이다. 어느 쪽인지는 새 진단 줄로 판별한다.
- 운영 nginx 로그: Samsung Internet의 query 없는 `/auth/callback/` 요청은 10-07 3건, 10-08 19:51(KST) 1건, 수정 배포 뒤 0건. 캐시 재사용은 서버 로그가 남지 않아 기기 단위 증거는 INSUFFICIENT EVIDENCE.
- SOCIAL-LOGIN-4P-RECOVERY-01·SITE-HOME-SAME-URL-STABILITY-01·READY 01은 이동 사슬의 증상을 줄였지만, 복원 자체가 매번 전체 페이지 이동을 요구하는 구조는 그대로였다.

## 변경

- 제자리 복원·갱신(SITE_SESSION_RESTORE): Account `POST /api/auth/site-session-renewal`에서 PKCE 결합 1회용 code를 받아 Core redeem. verifier는 메모리에만 있고 저장하지 않는다. state 비교·1회 redeem·PKCE는 기존과 같다.
  - 새로고침·탭 복원·재실행: 제자리 복원 → 실패 시에만 기존 redirect handoff 1회.
  - 만료 5분 전 자동 갱신, 백그라운드 복귀 시 만료 임박이면 갱신, 실패 시 30초 뒤 재시도.
  - Core 401/403: 홈에서는 Account에 먼저 묻고 "확인 중" 상태로 둔다. Account가 "세션 없음"이라고 할 때만 로그인 버튼.
  - 같은 계정의 만료 후 복귀는 갱신으로 처리(열린 화면 유지).
  - 대화 모듈: 토큰 거절 시 조용히 게스트로 바뀌지 않고 갱신을 요청한다. 갱신 요청은 20초에 1회로 제한.
  - bfcache 복귀 시 handoff 가드 해제, `online` 이벤트에서 재확인.
- 명시적 로그아웃 구분: 프로필 메뉴 로그아웃은 기존대로 Site 세션 폐기 → 로그아웃 억제 표시 → Account 로그아웃. 억제 중에는 자동 복원·갱신을 하지 않는다. 실제 만료는 Account 판단으로 처리한다.
- callback(CALLBACK_RECOVERY): 기존 동작 유지(빈 callback → 홈, 오래된 code/state → Account가 로그인 중이면 1회 복구, 아니면 오류 화면 + "홈에서 다시 시도"). 오류 화면에 값 없는 진단 줄: `진단 <오류코드> · code N · state N · 기타 N · <실행 중 asset>`. code/state 값은 읽지도 출력하지도 않는다. 무한 리다이렉트 없음(복구 표시 1회/2분, 갱신 최소 간격 20초, 폴백 이동 1회).
- 캐시: nginx `map`으로 HTML 문서 `Cache-Control: no-cache`, `/auth/callback`·`/auth/start`·iOS social-return `no-store`, 버전 토큰이 붙은 asset은 그대로.

## 기기 한도와의 관계 (DEVICE_LIMIT_INTERACTION)

- 제자리 복원·갱신은 Core handoff가 원래 Account 세션의 installation을 재사용한다(새 기기를 만들지 않음, site_session_handoff.py). 그래서 기기 15대 한도를 소비하지 않는다.
- 로그인 때 DEVICE_LIMIT_REACHED를 없애는 일은 신뢰 기기 방(TRUSTED-DEVICE-PLAN-LIMITS-01, 소유자 정책 확인 11:56) 소관이며 아직 READY 전이다.
- Account 기기 정리·보안 화면 502(DEVICE_LIMIT_REMEDIATION 세션 이력)는 짝 Web branch에서 수정했다.

## 검증

- 신규 `scripts/validate_auth_session_continuity_p0_02.mjs`: 모듈(PKCE·state·매번 새 verifier·SIGNED_OUT만 로그아웃·실패 8종은 redeem 안 함·진단은 값 미열람), 정적 계약, 실제 Chrome으로 실제 index.html 9개 시나리오 PASS:
  1. 새로고침 제자리 복원(Account 이동 0, 로그인 버튼 0, PKCE redeem 1)
  2. /#calendar 새로고침 → 로그인 상태로 캘린더 재오픈
  3. 만료 전 갱신 → 새 토큰으로 캘린더 호출, Core 거절 시 갱신
  4. Core 401 → 로그인 버튼 없이 새 세션
  5. Account 로그아웃 상태 → 로그인 버튼, 갱신·이동 0
  6. status와 갱신 사이 세션 소실 → 로그아웃으로 처리, 이동 0
  7. 갱신 API 없는 Account → redirect 폴백 정확히 1회
  8. callback 오류 진단 줄(값 미포함, asset 일치)
  9. query 없는 callback → 홈에서 제자리 복원
- 신규 `scripts/validate_document_cache_policy_01.py` PASS(22개 URI, 배포 HTML 전부 재검증 정책).
- site-review.yml 단일 명령 검증 101개 로컬 실행: 101개를 ddcc573d merge 트리에서 실행: 97 PASS, FAIL 4 — validate_auth_continuity_02(이 branch가 전송 경로 계약 문구를 바꿔서 실패 → 원래 문구로 복원 후 PASS), validate_place_card_compact_01(고정 포트 동적 import 부하성 간헐, 단독 재실행 PASS), validate_mobile_footer_legal_sheet_01·validate_site_avatar_fallback_runtime(main ddcc573d 기준선에서도 똑같이 실패 = 기존 Windows 로컬 RED, 이번 변경 무관). main 9e39edd0(SITE-T38c) merge 뒤 핵심 15개(site·clean URL·hardening·home chat·문서 캐시·nginx MIME·auth continuity 02·normal assurance·same-URL·UNKNOWN 브라우저·P0-02·home fresh entry·유치원·새로고침 화면 복원 529·iOS social return) 재실행 PASS
- asset 정합성 PASS(aset-78ece022807c). `site-theme-tokens.css` 변경 없음.
- nginx 실제 실행: 로컬 nginx 없음 → NOT RUN. site-review.yml 컨테이너 smoke에 Cache-Control 단정 추가(Linux gate/CI에서 확인).

## 실기기 (NOT TESTED — PASS로 쓰지 않음)

- SAMSUNG_INTERNET_30MIN=NOT TESTED / SAMSUNG_INTERNET_REOPEN=NOT TESTED
- Samsung Internet 최초 로그인, 1시간 백그라운드, 탭 복원·새로고침, 완전 종료·재실행, 네이버 소셜 재방문, 기기 15대 한도 상태 로그인: NOT TESTED
- Android Chrome, iPhone Safari, 카카오 인앱: NOT TESTED
- 위 Chromium headless 시나리오는 같은 로직의 런타임 증거일 뿐 실기기 증거가 아니다.

## 운영 기준선 (PRODUCTION_SHA, 12:05 KST 확인)

- Site: main fa6ed88d, asset aset-1349a7eafa03, Render digest 7a08c5c2(SITE-T36). site main ddcc573d(반복 일정)는 운영 미배포.
- Account: web main 1e2c8a13(WEB-T14, READY 01 Web 포함) Vercel lotbi-18gmwn4zh.
- Core: 795f236e live(CORE-T25). main 01d66e48은 revision 길이 문제로 배포 불가 상태.

BLOCKERS=코드·테스트·migration blocker 없음. Site 운영 배포는 배포총괄방 train 순서(Core 반복 일정 수정 배포 후)를 따른다. 실기기 검증 필요.
