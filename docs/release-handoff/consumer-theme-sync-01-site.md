READY_FOR_DEPLOY=YES

# consumer-theme-sync-01-site — release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/consumer-theme-sync-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ssh://lotbi-ncloud-git/srv/git/repositories/lotbi-site.git refs/heads/feature/consumer-theme-sync-01-site`)
REMOTE_FEATURE_SHA=same as FEATURE_SHA after push (verified with git ls-remote at push time)
BASE_MAIN_SHA=89adbb378a11fba8e42a445b62f5ffab8f358f5f (Ncloud main, 작업 시작 = push 시점 동일)
CODE_SHA=333abc759b6b2e357b837cf4810b1eecc1d3ebd8
ASSET_VERSION=aset-8afddec0f956
DEPLOY_SCOPE=lotbi-site. 같은 기능: lotbi-web `feature/consumer-theme-sync-01-web`
DEPLOY_ORDER=SITE · WEB 순서 무관 (둘 다 나가야 Account 선택이 Site에 반영됨). Core 무변경
MIGRATION=NO (서버 DB 없음 — 브라우저 저장값 이전은 아래 참고)
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
AUTH_COOKIE_SCOPE_CHANGED=NO
USER_DECISION_NEEDED=NONE
SUPERSEDES=`feature/site-avatar-theme-share-fix-01-work`(2026-10-03, 미merge — 3단어만 공유·자동모드 없음·무관한 아바타/공유 UX 72파일과 섞임). 이 branch가 대체.

## 원인 (ROOT_CAUSE_CONFIRMED)

화면 모드 저장소가 두 origin으로 갈라져 있었다.
- Site: `localStorage['lotbi.site.theme.bootstrap.v1']` (lotbiai.com origin 전용)
- Account: host-only `__Host-lotbi_theme`(light/dark/system) + `localStorage['lotbi.account.theme.preference.v1']`(자동모드는 여기만)
- Site의 '개인테마' 메뉴는 이미 Account `#personalization`으로 이동만 하므로, Account 선택이 Site에 닿을 길이 없었다. 재현: Account 다크 → "LOTBI로 돌아가기" → 라이트 OS에서 Site 라이트.
- 추가 발견: `/auth/start/`(돌아가기 경유)는 inline CSS가 흰 배경 + OS 다크만 따름, `/auth/callback/`(로그인 상태 새로고침마다 경유)·`kakao-navi.html`·`map-handoff.html`은 테마 bootstrap이 없어 흰 화면이 지나감.

## 공유 계약 (SHARED_THEME_PREFERENCE)

- cookie `lotbi_theme_preference_v1` = `light | dark | system | auto` (strict enum, 그 외 값·서로 다른 중복 → 무시)
- Production: `Path=/; SameSite=Lax; Max-Age=31536000; Domain=lotbiai.com; Secure`, HttpOnly 아님(첫 화면 bootstrap이 읽어야 함). localhost/127.0.0.1은 host-only. 그 외 origin은 쓰기 거부.
- 기존 위치/지도앱 공유 cookie(`lotbi_location_usage_v1`, `lotbi_default_map_provider_v1`)와 같은 패턴. 인증·session cookie는 건드리지 않음.
- 보조 cookie `lotbi_theme_preference_import_v1=site`: Site가 예전 자기 저장값을 옮겼을 때만 붙음(아래 이전 규칙). 실제 선택이 저장되면 지워짐.
- 자동모드: 이 기기 시계 기준 07:00 ≤ t < 18:00 라이트, 그 외 다크. 저장값은 `auto` 그대로(해석된 light/dark로 저장하지 않음).

## 변경

- `site-theme-preference.js`(신규 모듈): 읽기(strict)·직렬화·쓰기(쓴 뒤 다시 읽어 확인)·자동모드 해석·다음 경계 시각. Account `src/lib/theme/theme-preference.ts`와 같은 값·같은 규칙.
- 첫 화면 bootstrap(16개 페이지 동일): `scripts/sync_theme_bootstrap.mjs`가 표준 블록을 관리(`--check`는 CI, `--write`로 갱신). 공유 cookie → 없으면 예전 localStorage 키 → 자동모드 해석 → `html[data-site-theme-bootstrap]`. 읽기 전용(cookie·storage 쓰기 없음), 탭 복귀(pageshow/focus/visibilitychange)와 자동모드 다음 경계에서 다시 적용.
  - 대상: index, 404, about, account-deletion, contact, dispute, exchange, feedback, privacy, refund, subscribe, terms, auth/start, auth/callback, kakao-navi, map-handoff (CSP로 inline script가 막힌 app/open 소셜 복귀 페이지와 시험용 android-auth-test는 제외).
- `auth/start/index.html` inline CSS: 다크 선택 시 다크, 라이트 선택 시 라이트(OS 무관), 기기모드만 OS 따름.
- `site-conversation.js`: 공유 값 우선(`sharedThemePreference()`), 없을 때만 기존 namespace/기기 키 해석. 탭 복귀 시 공유 값 재확인 후 적용(`syncSharedTheme`). 자동모드 시계는 모듈 하나로 통일(중복 제거).
- validator: 신규 `validate_consumer_theme_sync_01.mjs`(+ `sync_theme_bootstrap.mjs --check`) site-review.yml 등록. 계약 변경에 맞춰 `validate_theme_auto_schedule_02.mjs`·`validate_theme_namespace_carry_01.mjs`·`validate_hardening.py` 갱신.
- `validate_hardening.py` 잠금 hash 재고정: privacy/terms/account-deletion/contact — 바뀐 것은 head의 테마 bootstrap `<script>` 하나뿐, 법정 본문 변경 없음(두 revision에서 그 script를 들어내면 바이트 동일, 15개 페이지 모두 확인). 테마 bootstrap은 `document.cookie`를 읽기만 허용(쓰기 금지 규칙 추가).
  - 참고: `emit_social_signup_legal_manifest.py`는 파일 원본 bytes를 hash하므로 asset token이 바뀌는 매 배포처럼 값이 바뀐다(Core는 live 페이지를 비교하지 않음 — 동작 영향 없음).

## 이전 규칙 (LEGACY MIGRATION)

1. 공유 cookie가 있으면 그것이 기준(Site 쪽은 import 표시와 무관하게 기준).
2. 없으면 Site는 예전 저장값을 읽어 그대로 그린다. 그 값이 명시적 선택(light/dark/auto)이면 공유 cookie로 옮기고 `import=site` 표시. `system`은 아무것도 고르지 않은 기본값과 구별이 안 되므로 옮기지 않음.
3. Account는 화면 모드를 고르는 곳이므로, Site가 옮긴 값보다 Account 자신의 예전 명시적 선택(localStorage → `__Host-lotbi_theme`)이 우선(lotbi-web 문서 참고). 이후 저장은 어느 화면이든 같은 저장 경로(공유 cookie) 하나.
- 예전 localStorage 키는 지우지 않음. Site는 공유 값을 그 키에도 그대로 써 둔다(롤백·정적 페이지 fallback).

## 검증

- `validate_consumer_theme_sync_01.mjs` PASS: 모듈(enum·중복·형식 오류·자동 06:59/07:00/17:59/18:00·cookie 속성·origin 거부·쓰기 실패 감지), 16페이지 bootstrap 동일·위치(첫 stylesheet 앞), bootstrap 실행 12케이스(공유 우선·라이트/다크/기기/자동 경계·예전 키 fallback·형식 오류·충돌 중복·storage 차단), 쓰기 0회, 탭 복귀 재적용·자동 타이머, Chrome에서 terms·auth/start가 공유 cookie대로 칠해짐.
- `validate_theme_auto_schedule_02` / `validate_theme_namespace_carry_01` / `validate_theme_bootstrap_first_paint_01` / `validate_static_pages_theme_01` / `validate_global_dark_theme_contrast` / `validate_profile_menu_personal_theme_01` / `validate_hardening.py` / `asset_cache_version.mjs --check` PASS.
- site-review / universal-life-calendar workflow의 node/python 명령 전체: 211개 중 207 PASS / 4 FAIL — 4개(`validate_calendar_system_dark_01`, `validate_image_attachment_thumbnail_01`, `validate_mobile_footer_legal_sheet_01`, `validate_site_avatar_fallback_runtime`) 모두 main 89adbb37 worktree에서도 같은 메시지로 실패(기존 RED, Windows 로컬). NEW_FAILURES=0.
- 실브라우저 E2E (Chrome CDP, https://lotbiai.com·https://account.lotbiai.com·https://api.lotbiai.com을 로컬 Site 파일·`next start`·실 Core로 대행, 실제 로그인 handoff 포함) — lotbi-web 문서와 같은 run:
  - A Account 다크 → "LOTBI로 돌아가기" → `/auth/start/` → Account handoff → `/auth/callback/` → 홈: 모든 문서 첫 프레임부터 rgb(33,33,33) (라이트 OS)
  - B 라이트(다크 OS) → Site 모든 문서 흰색 / C 기기모드 → OS 다크면 다크, OS 라이트면 라이트 / D 자동 23:00 다크, 06:59 다크·07:00 라이트·17:59 라이트·18:00 다크(Site 홈·약관·Account 첫 프레임까지 동일), 열린 탭이 18:00에 스스로 다크로 전환
  - E Site에만 있던 예전 다크 → 공유 cookie로 이전(import 표시) → Account에서 다크 선택 상태 / F Account→Site→Account 3회 drift 없음 / G 새 탭 직접 진입(홈·Account·개인정보처리방침) 첫 프레임 다크 / H 새로고침 첫 프레임 다크
  - 다크 화면: 채팅 홈·생활정보·진위확인 modal·캘린더·정적 페이지(terms/privacy/subscribe/404/about) 확인, 360/375/390/412/1280 폭에서 홈·약관·Account 첫 프레임 다크, Account 가로 넘침 없음
  - React hydration 오류 0, 하네스 중계 취소 외 콘솔 오류 0

## 알려진 한계

- iPhone Safari / Samsung Internet / Android Chrome 실기기 NOT TESTED (Chrome 폭 emulation만). Production NOT TESTED(배포 전).
- 공유 cookie는 브라우저 단위다(계정 단위 서버 저장 아님 — 지시된 계약). 다른 브라우저·기기는 각자 선택.
- `app/open/auth/social-return/`(앱 복귀 페이지)는 CSP가 inline script를 막아 대상 외.

## 금지 사항 준수

main 직접 push / merge / force push / rebase / reset 없음. 인증·session cookie 계약 변경 없음. merge gate·Production 배포는 Release Control 담당.
