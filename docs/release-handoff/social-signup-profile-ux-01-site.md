READY_FOR_DEPLOY=YES
SUPERSEDES=3b696cfe

# social-signup-profile-ux-01-site — release handoff (re-READY after SITE-T39b Linux gate failure)

REPO=lotbi-site
FEATURE_BRANCH=feature/social-signup-profile-ux-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ... refs/heads/feature/social-signup-profile-ux-01-site`)
BASE_MAIN=9e39edd06446b3e93ec68170de49df9f702e0d07 (normal merge 735846b9; no rebase/force push; no drift at push)
CODE_SHA=d087ad623 (validator fix on top of merge 735846b9; product code = 3a24c915, unchanged)
ASSET_VERSION=aset-eea493207233 (asset_cache_version.mjs --write after the merge; --check PASS)
PAIRED=core d1b2b43e (live, CORE-T26b), web 33187786 (live, WEB-T15) — Site is the last piece.
THEME_TOKENS_CHANGED=NO
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
USER_DECISION_NEEDED=NONE

## GATE_FAILURE (SITE-T39b, run 20261009T054624Z-1225792-467110465)

`validate_social_signup_profile_ux_01.mjs:209  longName@360 is cut with an ellipsis (actual false)` on Linux Chrome,
reproducible on this branch alone. Cause: the 28-character test name fitted the 360px summary under the gate's
narrower font (not cut → the "is cut" assertion failed), while Windows fonts cut it. The product renders correctly
(ellipsis style + nowrap were already in place); the test name was too short to force an overflow on every font.

Reproduced on Windows with a forced narrow-glyph stage (3px narrower per glyph) and the old name:
320px cut (241 > 210), 360px NOT cut (250 = 250) — the same as the gate.

## FIX (validator only; product code unchanged since 3a24c915)

- Test name: 120 characters = the longest display name Core accepts (`ConsumerProfileUpdateIn.display_name`
  max_length=120, `users.name` String(120)). Overflows every width in any font.
- New narrow-glyph stage for the layout cases (kakao no-name, long name) at every width, so a narrower server font
  cannot hide an overflow; the stage asserts it applied (`letter-spacing: -3px`).
- Criteria kept and extended, none weakened: summary name `text-overflow: ellipsis` + `nowrap` always; the 120-char
  name must be cut; no summary / popover / page overflow; NEW: the sidebar trigger name gets the same checks
  (ellipsis, nowrap, cut for the long name, no trigger overflow).
- Fixture now wraps the page shell (`.chat-app-shell`) so the desktop sidebar has its real 220px column (without it
  the 1440px sidebar was page-wide and could not test the sidebar ellipsis); ≤900px renders as before.

## TEST_STATUS (merged tree 735846b9 + d087ad62)

- New validator PASS, 25 runs: 6 cases; kakao no-name and long name × 320/360/390/430/1440 × default/narrow glyphs.
  Long name cut everywhere (summary scroll 1434/1074 px vs 178–320 px), summary/popover/page/trigger overflow 0.
- Full `scripts/validate_*` regression (241): 230 PASS in a 4-way parallel run; 11 re-run sequentially → 5 PASS;
  remaining 6:
  - existing local RED, also failing on main 9e39edd0: image_attachment_thumbnail_01, mobile_footer_legal_sheet_01,
    place_card_compact_01, site_avatar_fallback_runtime
  - auth_unknown_recovery_browser_01: prints PASS, then Windows EPERM removing its temp Chrome profile; re-run rc 0
  - calendar_touch_monthnav_daysheet_01: local static-server flake ("Failed to fetch dynamically imported module");
    branch 1/2 PASS, main 2/3 PASS
  NEW_FAILURES=0. (Linux run is the gate's; this PC has no WSL/Docker.)
- Merge: 64 conflicts, all asset-token only except index.html / auth/callback/index.html (main's stylesheet list
  taken; this branch changed only tokens there) → tokens regenerated.

## CHANGE (unchanged from 3b696cfe)

- `site-core.js` reads Core's `display_name_is_default`, `public_handle_is_generated`, `signup_provider`
  (fields exist only when Core sends them).
- `site-conversation.js` profile menu: no own name → `내 프로필` + person icon; generated handle hidden;
  `카카오 계정으로 가입 · LOTBI Free` only without a name; menu items unchanged.
- `site-continuity.js` placeholder `내 프로필`; `site-sidebar-nav.css` icon styles.

## DEPLOY_ORDER

- Core d1b2b43e is already live, so SITE can go next. An older Core payload renders exactly as before.

## NOT_VERIFIED

- Real devices (Samsung Internet, Android Chrome, iPhone Safari, PC Chrome) with a real Kakao signup.

NEW_FAILURES=0
