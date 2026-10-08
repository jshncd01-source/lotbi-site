READY_FOR_DEPLOY=YES

# social-login-4p-recovery-01-site — release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/social-login-4p-recovery-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ... refs/heads/feature/social-login-4p-recovery-01-site`)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=3d6a5eec14f3e64218ad17c87e1b6ae9cfafaef3
CODE_SHA=a07b372e602c25b6cc330a24c75a53aac4867622
ASSET_VERSION=aset-e84a775d0d41
PAIRED_BRANCH=lotbi-web feature/social-login-4p-recovery-01-web (independent; either order, WEB first preferred)

## ROOT CAUSE

`auth-callback.js` removes `code`/`state` from the URL (`history.replaceState`) as soon as it boots. When the
same tab lands on that entry again — reload of a failed login (e.g. after a Core 429), Back, or a mobile
browser restoring a discarded tab — the page runs with no query and `parseSiteHandoffCallback` throws
"로그인 연결 파라미터가 올바르지 않습니다." (the error reported on a phone on 2026-10-08). Reproduced on main
3d6a5eec in real headless Chrome: bare `/auth/callback`, `/auth/callback/`, and reload after a failure all show it.

## SCOPE

- `site-auth.js`: `isConsumedSiteHandoffCallback(url)` — true only when the callback URL has no query parameters.
- `auth-callback.js`: on such a revisit, `window.location.replace('/')` before any parsing; Home's Account
  continuity then restores the sign-in (or shows login). Any query (missing/duplicate/extra parameter,
  short code) is still verified and fails closed exactly as before.
- `auth-callback.js`: Core `RATE_LIMITED` on redeem shows "로그인 요청이 잠시 많습니다. 잠시 후 홈에서 다시 시도해 주세요."
  instead of the English "Too many requests".
- `scripts/validate_auth_continuity_02.mjs`: contract for the above. Asset cache version regenerated (token-only diffs elsewhere).

## SAFETY

- No PKCE/state/verifier rule changed; nothing is redeemed or started from a bare callback; no new redirect target
  (fixed same-origin `/`). No Core/env/secret change. Apple sign-in kept.
- Other open site branches touching auth-callback.js/site-auth.js differ from main only in asset tokens (checked 15).

## TEST_STATUS

- Real Chrome before/after (static server + CDP): bare callback, bare without slash, reload after failure →
  main: parameter error; branch: Home. `?state=` only and short code → error on both (fail-closed preserved).
- `node scripts/validate_auth_continuity_02.mjs` PASS, `asset_cache_version.mjs` coherence PASS.
- Callback-related validators PASS: validate_auth_continuity_02, validate_site_refresh_route_restore_01,
  validate_home_fresh_entry_01, validate_conversation_integration, validate_anonymous_conversation_persistence_01,
  validate_site_avatar_integration, validate_auth_unknown_recovery_browser_01 (PASS printed; Windows temp-profile
  EPERM on cleanup only). Full site-review list still running locally at READY time; Linux gate is authoritative.
- NOT TESTED: real device (Android Chrome / Samsung Internet / iPhone Safari) after deploy.

NEW_FAILURES=0

## DEPLOY_ORDER

Independent of lotbi-web feature/social-login-4p-recovery-01-web. WEB first preferred (it removes the 429 cause).

USER_DECISION_NEEDED=NONE
