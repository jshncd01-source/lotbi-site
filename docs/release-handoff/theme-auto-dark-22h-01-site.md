READY_FOR_DEPLOY=YES

# theme-auto-dark-22h-01-site — release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/theme-auto-dark-22h-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ssh://lotbi-ncloud-git/srv/git/repositories/lotbi-site.git refs/heads/feature/theme-auto-dark-22h-01-site`)
REMOTE_FEATURE_SHA=same as FEATURE_SHA after push (verified with git ls-remote at push time)
BASE_MAIN_SHA=c9c19e4cef9914f0b50d4870cbcc59e58602ddc2 (Ncloud main, 작업 시작 = push 시점 동일)
CODE_SHA=7285a38edc262b09ebd5356cb4aa2920ed23ce57
ASSET_VERSION=aset-15755b8cabc2
DEPLOY_SCOPE=lotbi-site. 같은 기능: lotbi-web `feature/theme-auto-dark-22h-01-web`
DEPLOY_ORDER=SITE · WEB 순서 무관. 단 둘 중 하나만 나가 있는 동안은 18:00~21:59에 Site와 Account의 자동모드 결과가 다르다 → 같은 release train 권장. Core 무변경
MIGRATION=NO (저장값 `auto` 그대로, 해석 시각만 바뀜)
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
AUTH_COOKIE_SCOPE_CHANGED=NO
USER_DECISION_NEEDED=NONE

## 변경 (대표 지시: 자동모드 07시 라이트 / 22시 다크)

- `site-theme-preference.js`: `AUTO_THEME_DARK_HOUR` 18 → 22. 자동모드 = 이 기기 현지 시각 07:00 ≤ t < 22:00 라이트, 그 외 다크. 대화 화면(`site-conversation.js`)의 열린 탭 전환 timer도 이 모듈을 쓴다(주석 2줄만 수정).
- 첫 화면 bootstrap(소비자 페이지 16개 동일): `scripts/sync_theme_bootstrap.mjs` 원본의 시각 2줄 + 주석 1줄 수정 후 `--write`로 재생성. bootstrap 블록을 들어내면 16개 페이지 모두 main과 바이트 동일(본문 무변경).
- `scripts/validate_hardening.py`: privacy/terms/account-deletion/contact 잠금 hash 재고정 — 바뀐 것은 head 테마 bootstrap의 시각 줄뿐, 법정 본문 무변경(근거 주석 추가).
- validator: `validate_theme_auto_schedule_02.mjs`, `validate_consumer_theme_sync_01.mjs` 경계(18:00 라이트·21:59 라이트·22:00 다크·다음 전환 시각·브라우저 기대값). `validate_static_pages_theme_01.mjs`는 index.html에서 시각을 읽어 무수정.
- `.github/workflows/site-review.yml`: 주석만(22시 다크 · 07시 라이트).
- asset token 재생성(`asset_cache_version.mjs --write`).
- Site 화면에는 시각 안내 문구가 없음(개인테마 메뉴는 '자동모드' 이름만, 설정은 Account `#personalization`).
- 변경 없음: 라이트·다크·기기모드 동작, 공유 cookie `lotbi_theme_preference_v1` 계약, 이전(import) 규칙, 인증.
- 미사용 사본 `scripts/.placecard-inner.html`(참조 없음, 배포 페이지 아님)은 건드리지 않음.

## 검증

- 회귀 범위 = `scripts/validate_*` 전부 212개(workflow 밖 포함). 로컬 1차 실행 197 PASS / 15 FAIL — 실행 중 PC가 CPU 95~100%·Chrome 80~150개(다른 방 작업)로 포화.
  - 15개 단독 재실행: 5개 PASS(calendar_day_panel_two_buttons_01·calendar_lunar_settings_ui_01·message_calendar_footer_editor_01·profile_menu_improvement_01·site_refresh_route_restore_01).
  - 남은 10개는 같은 부하에서 feature·main(c9c19e4c)을 연달아 실행해 비교: **10개 모두 main도 동일 실패** → NEW_FAILURES=0. 원인 유형: Chrome 임시 프로필 EPERM, `Failed to fetch dynamically imported module`/`result missing`(부하), CRLF 작업본에서 `\n` 정규식(image_attachment_thumbnail_01), `calendar_system_dark_01` stale mirror(main 기존 RED).
  - 그중 테마 관련 `validate_profile_menu_personal_theme_01`은 부하가 줄었을 때 단독 실행 **PASS**.
- 테마 관련 PASS: `validate_theme_auto_schedule_02`(브라우저 포함), `validate_consumer_theme_sync_01`, `validate_static_pages_theme_01`, `validate_theme_bootstrap_first_paint_01`, `validate_theme_namespace_carry_01`, `validate_global_dark_theme_contrast`, `validate_hardening.py`, `sync_theme_bootstrap.mjs --check`(16 pages), `asset_cache_version.mjs --check`.
- 법정 본문 무변경 확인: bootstrap 블록과 `?v=` 토큰을 들어내면 16개 소비자 페이지 모두 origin/main과 바이트 동일.
- 실브라우저 E2E(Chrome headless, CDP — lotbiai.com=이 worktree 파일, account.lotbiai.com=lotbi-web feature `next start`, api=로컬 Core, 기기 시계만 조작) **PASS**:
  - 자동모드 경계 — Site 홈·약관·Account·Account 첫 프레임 4곳 모두: 06:59 다크 / 07:00 라이트 / **18:00 라이트** / **21:59 라이트** / **22:00 다크** / 10:00 라이트, 23:00 다크. 저장값은 `lotbi_theme_preference_v1=auto`(Domain=.lotbiai.com, Secure) 그대로.
  - 열린 탭: 21:59에 연 Site 홈·Account가 새로고침 없이 22:00에 다크로 전환.
  - 기존 동기화 유지: Account 다크→Site 첫 프레임부터 다크(실제 handoff 경유), 다크 기기에서 라이트 유지, 기기모드 다크/라이트 OS 추종, Site 예전 선택 → Account 이전, 왕복 3회 drift 없음, 새 탭·새로고침 첫 프레임, 360/375/390/412/1280 폭 Account 가로 넘침 없음, hydration 오류 0.
  - Account 개인 맞춤 설정 문구: `자동모드 / 07시 라이트 · 22시 다크`, `…오전 7시부터 라이트, 오후 10시부터 다크로 바뀝니다.`, 페이지에 `오후 6시`/`18시` 없음.

## 알려진 한계

- iPhone Safari / Samsung Internet / Android Chrome 실기기 NOT TESTED. Production NOT TESTED.
- 앱(Android/iOS)에는 별도 자동모드 시계가 없음(lotbi-app main 9a732319 검색) — 앱 변경 없음.
- 진행 중인 `feature/site-refresh-route-festival-back-04`(새로고침 P0)는 건드리지 않음. 겹칠 수 있는 곳은 asset token 줄뿐.

## 금지 사항 준수

main 직접 push / merge / force push / rebase / reset 없음. merge gate·Production 배포는 Release Control 담당.
