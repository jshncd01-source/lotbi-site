READY_FOR_DEPLOY=YES
MIGRATION=NO
DEPLOY_ORDER=SITE 단독 (Core·Web·App 변경 없음, 짝 Web branch는 독립 — feature/kakao-login-first-tap-feedback-01-web)
USER_DECISION_NEEDED=NONE
SUPERSEDES=NONE

# site-session-request-storm-p0-01-site — release handoff

TASK=배포총괄방 요청 A [P0] 로그인 후 lotbiai.com 탭 무한 반복 호출 (Core GET /v2/life/today 초당 약 210건, Account GET /api/auth/site-session-status 초당 10건+)
REPO=lotbi-site
FEATURE_BRANCH=feature/site-session-request-storm-p0-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD, `git ls-remote origin refs/heads/feature/site-session-request-storm-p0-01-site`로 확인)
CODE_SHA=f7a50c70c32601996e51479f6b1eb08b657e5aa1
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=5675fd3d2 (SITE-T49, aset-cd3d42af9220 = 운영, 2026-10-10 14:23 ls-remote 기준 drift 0)
ASSET_VERSION=aset-9de51f1886ba (CRLF 작업본과 LF 체크아웃 양쪽에서 asset coherence PASS)
FLAG=없음

## 원인 [확인된 사실 — 운영과 같은 Site 5675fd3d·Account 코드·Core main으로 로컬 재현]

Core가 Site 세션 토큰을 거절(401)하는 순간 두 고리가 맞물려 끝없이 돈다.
- 계기: 다른 탭에서 Account 로그아웃 → Core가 그 계정의 Site 하위 세션을 폐기.

1. **오늘 정보 고리** (`site-conversation.js` `refreshNavigationCalendarStatus`)
   - 캘린더 배지가 `getLifeToday`를 부르고, 401이면 `site-calendar.js`가 로그아웃 신호(`lotbi:site-session-state`, `authenticated:false`)를 **동기적으로** 낸다.
   - 대화 화면은 이 신호를 받자마자 같은(거절된) 토큰으로 배지를 다시 읽는다.
   - 새 호출이 세대 번호를 올렸기 때문에, 먼저 실패한 호출의 `dropSessionToken()`이 건너뛰어진다.
   - 결과: 토큰이 영원히 남아 401 → 신호 → 재호출이 응답 속도로 반복된다.
2. **세션 확인 고리** (`site-continuity.js`)
   - 신호마다 Account 상태를 확인한다(`checking`으로 겹침만 막음).
   - "로그아웃" 답 → 로그아웃 표시 → 사이드바 다시 그림 이벤트 → 배지 재호출 → 401 → 신호 → … 로 이어진다.
   - Account 응답(약 100ms)이 Core 응답보다 느려서 비율이 오늘 정보:세션 확인 ≈ 20:1이 된다. 운영 보고 수치와 같다.

### 재현 수치 (로컬, 10초)

조건: Account 로그아웃만 하고 LOTBI 탭으로 복귀.

| | 수정 전 | 수정 후 |
|---|---|---|
| GET /v2/life/today | 1,374 (전부 401) | 1 |
| GET /api/auth/site-session-status | 618 | 2 |
| POST site-session-renewal | 0 | 1 |

- 이전 상태는 Account가 Ncloud로 바뀐 것과 무관하다. Account 응답(CORS 포함)은 운영과 로컬 모두 정상이었다.
- 13:4x에 소유자가 account.lotbiai.com에서 로그인을 확인하면서 기존 Account 세션이 끝난 것(로그아웃·재로그인)이 계기로 보인다 [추정].
- 배포총괄방 보고의 "life/today 응답 200"은 이 방 재현(401)과 다르다. 운영 접근 로그 상태코드 집계를 요청해 두었다. 응답이 200인 고리였더라도 아래 1번의 동시 1건·최소 간격이 배지 호출을 묶는다.

## 수정

1. 배지 읽기(`site-conversation.js`)
   - 한 번에 하나만 읽는다.
   - 진행 중이거나 1.5초 안에 다시 요청되면 후속 1건으로 합친다(`NAVIGATION_CALENDAR_MIN_INTERVAL_MS`).
   - 거절된 토큰은 세대와 상관없이 그 토큰을 본 호출이 폐기한다(`dropSessionToken()` → 연속성 모듈이 최소 20초 간격으로 갱신).
   - 권위 있는 Today 읽기(`getLifeToday(sessionToken, timezone, globalThis.fetch)`)와 401 알림 규칙(`site-calendar.js` 4곳)은 그대로다.
2. 세션 연속성(`site-continuity.js`)
   - Account가 방금(5초 안) "로그아웃"이라고 답했고 Home이 이미 로그아웃 표시면, 거절 신호가 또 와도 Account에 다시 묻지 않는다(`ACCOUNT_STATUS_SIGNED_OUT_RECHECK_MS`).
   - 그 밖의 경우("Home에서 401·403이면 Account에 먼저 묻는다")는 기존과 같다. 기존 검사기 정규식을 바꾸지 않았다.
3. 새 검사기 `scripts/validate_site_session_request_storm_p0_01.mjs`(site-review.yml 등록)
   - 실제 index.html을 띄우고 Account·Core를 페이지 안에서 모의한다.
   - 6초 창에서 호출 수 상한: life/today ≤ 4, status ≤ 4, 거절 ≤ 3, 갱신 ≤ 2.
   - 경우: 그대로 둔 Home / 다른 곳에서 로그아웃(두 번째 이벤트 묶음에서 거절 토큰 재전송 0) / 토큰 거절 후 갱신으로 회복(새 토큰 사용 확인).
   - 운영 코드 5675fd3d에 같은 브라우저 검사를 돌리면 "life/today 29,167회/6초"로 FAIL한다. 검출 확인.
   - Linux gate 조건: 프로필 `mkdtemp`, 작업 폴더 `scripts/.site-session-request-storm-*`, 브라우저 후보 CHROME_BIN → Windows Chrome → /opt/pw-browsers/chromium.
4. asset 캐시 토큰 재생성(74파일, 토큰 줄만 변경).

## 검증

- 새 검사기: 작업본(CRLF)과 LF 체크아웃 모두 PASS.
- 관련 Site 검사기 104개(auth·continuity·session·calendar·sidebar·conversation·chat·asset·refresh·route·home·theme_auto·composer·life_info·life_direct)를 4개 병렬로 돌렸다.
  - 102 PASS.
  - 1건(`validate_auth_session_continuity_p0_02`)은 기존 블록 모양 고정 때문에 실패했다. 조건을 블록 앞으로 옮긴 뒤 PASS.
  - 1건(`validate_calendar_touch_monthnav_daysheet_01`)은 병렬 부하로 동적 import를 불러오지 못했다. 단독 재실행 PASS.
- 최종 코드로 단독 재실행 PASS: auth_continuity_02, conversation_sidebar_ux_01, calendar_auxiliary_read_blast_radius_01, site_refresh_route_restore_01, auth_session_continuity_p0_02.
- 로컬 실브라우저(Chrome 154, 실제 Core main·Account·이 Site, *.lotbiai.com 전부 로컬):
  - 로그인 Home을 그대로 둔 20초: 호출 1회.
  - 다른 탭 재로그인 후 20초: life/today 2회, Site 로그인 유지.
  - focus·visibility 5회 연속 후: 10회 → 2회.
- NOT TESTED: 운영, 실제 휴대폰, Safari·삼성 인터넷 엔진.

## 배포 후 운영 확인 (배포총괄방)

1. 운영 asset 버전이 `aset-9de51f1886ba`인지 확인한다.
2. TEST 계정으로 lotbiai.com 로그인 → 다른 탭에서 account.lotbiai.com 로그아웃 → lotbiai.com 탭으로 돌아오기.
   - 기대: 접근 로그에서 그 IP의 /v2/life/today·site-session-status가 1분에 한 자릿수.
   - 기대: 화면은 로그아웃 표시.
3. 다시 Account 로그인 → lotbiai.com 탭으로 돌아오기. 기대: 로그인 표시로 회복.

되돌리기: Site 이전 운영 이미지(5675fd3d).

CODE_SHA=f7a50c70c32601996e51479f6b1eb08b657e5aa1
USER_DECISION_NEEDED=NONE
