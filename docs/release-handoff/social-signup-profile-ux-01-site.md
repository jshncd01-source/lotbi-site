READY_FOR_DEPLOY=YES

# social-signup-profile-ux-01-site — release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/social-signup-profile-ux-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ... refs/heads/feature/social-signup-profile-ux-01-site`)
BASE_MAIN=ddcc573dca618a3289594220e53bb22d6c414bad (Ncloud main at development; no drift at push)
PRODUCTION_AT_DEVELOPMENT=fa6ed88d (aset-1349a7eafa03, image digest 7a08c5c2)
CODE_SHA=3a24c915f86166c3432532d558500131f459e10b
ASSET_VERSION=aset-881009a228c5 (asset_cache_version.mjs --write; --check PASS)
PAIRED_BRANCHES=lotbi-core feature/social-signup-profile-ux-01-core, lotbi-web feature/social-signup-profile-ux-01-web
THEME_TOKENS_CHANGED=NO (site-theme-tokens.css untouched → no Web theme-token drift)
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO

## PROBLEM

2026-10-09 Samsung Internet, Kakao new signup: the profile menu showed `LOTBI 사용자` / `@u9...` / letter avatar.
(The current code draws `L사` for that name; the reported `나` is not a string anywhere in Site/Account/App code.)

## CHANGE

- `site-core.js` `userFacingIdentity`: Core's `display_name_is_default` → name treated as absent;
  `public_handle_is_generated` → `publicHandleGenerated: true`; `signup_provider` (KAKAO/NAVER/GOOGLE/APPLE only) →
  `signupProvider`. The two new fields exist only when Core sends them (older Core → identical object).
- `site-conversation.js` profile menu (menu items unchanged: 프로필·개인테마·설정·연결 서비스·도움말·로그아웃):
  - name order: own name → chosen public handle → email local part → `내 프로필` (was `LOTBI 사용자`)
  - no own name → plain person icon instead of letters (trigger, menu summary, profile photo window)
  - generated handle hidden in trigger and summary; chosen handle shown as before
  - summary line: `카카오 계정으로 가입 · LOTBI Free` while there is no own name and Core reports the provider,
    otherwise unchanged `현재 이용 등급 · LOTBI …`
- `site-continuity.js`: authenticated placeholder before `/v2/me` answers `내 프로필` (was `LOTBI 사용자`).
- `site-sidebar-nav.css`: `.sidebar-profile-avatar-default`, `.sidebar-profile-avatar-icon`, hidden icon under a photo.
- `scripts/validate_social_signup_profile_ux_01.mjs` (new, in site-review.yml) and
  `scripts/validate_identity_profile_hotfix_02.mjs` (placeholder text expectation `내 프로필`).
- No auth/session/trusted-device code touched; rendering makes no new requests (validator counts: 1 /v2/me,
  1 /v2/subscription, 0 others).

## TEST_STATUS

- New validator PASS (headless Chrome): kakao FEDERATED_LIMITED and FULL-with-generated-handle at 320/360/390/430/1440
  → `내 프로필`, icon, no handle, `카카오 계정으로 가입 · LOTBI Free`; no-provider → `현재 이용 등급 · LOTBI Free`; named
  user → `홍길동`, `홍`, `@hong2026`; long name ellipsis on one line at every width; older Core → old rendering
  (`LOTBI 사용자`, `L사`, `@u...`); popover inside viewport, no horizontal overflow, menu labels unchanged.
- Related existing validators PASS (12): identity_profile_hotfix_02, profile_menu_improvement_01,
  profile_handle_to_account_01, conversation_sidebar_ux_01, profile_menu_personal_theme_01, home_fresh_entry_01,
  home_refresh_persistence_01, auth_unknown_recovery_browser_01, chat_read_aloud_restore_browser_01,
  conversation_calendar_card_02, conversation_calendar_result_time_01, message_calendar_footer_editor_01.
- `asset_cache_version.mjs --check` PASS. Full validator suite: NOT RUN locally (gate runs it).
- Screenshot check in the desktop app browser (360px): after = icon + `내 프로필 · LOTBI Free`, summary
  `카카오 계정으로 가입 · LOTBI Free`; before (older Core payload) = `L사`, `LOTBI 사용자`, `@uabcdefghij2`.

## CONFLICT_NOTES

- `auth-session-continuity-p0-02-site` (login continuity room) also edits site-continuity.js / site-conversation.js;
  hunks do not overlap (this branch: continuity line 271, conversation 3358-3470 + 3904). Asset tokens will conflict
  mechanically as usual.

## DEPLOY_ORDER

- Any order is safe. Recommended CORE → SITE. With the current Core the Site renders exactly as today.

## NOT_VERIFIED

- Real devices: Android Samsung Internet, Android Chrome, iPhone Safari, PC Chrome with a real Kakao signup.
  Viewport emulation only (not a device PASS). Dark mode icon contrast: uses existing muted token, not measured.

USER_DECISION_NEEDED=NONE
NEW_FAILURES=0
