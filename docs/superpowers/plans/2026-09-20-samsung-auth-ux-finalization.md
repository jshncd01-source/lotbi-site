# Samsung Auth UX Finalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Samsung callback false error and initial anonymous-auth flash while preserving PKCE/state/replay security, then expose a friendly canonical identifier in newly registered Passkeys without changing opaque WebAuthn user IDs.

**Architecture:** Site treats only `SITE_HANDOFF_CONTEXT_MISSING` as recoverable: it checks Account status read-only, creates a completely new PKCE handoff once, and guards the retry with a short-lived session marker. Site HTML and continuity logic start in `checking` and render anonymous actions only after an authoritative false/error result. Core resolves a canonical LOTBI login identifier for WebAuthn `user.name` while retaining `User.id` for opaque `user.id`.

**Tech Stack:** Static ES modules, Node contract/browser fixtures, Python/FastAPI/SQLAlchemy Core, pytest, GitHub Actions, Vercel, Render.

**Spec:** `upload/붙여넣은 텍스트 (1)(20260920-045113).txt`

## Global Constraints

- No PKCE verifier/state bypass, callback replay, code-only redemption, long-lived verifier storage, migration, secret change, credential reset, Passkey deletion, provider activation, or live money.
- Recovery applies only to `SITE_HANDOFF_CONTEXT_MISSING`, at most once per short TTL callback cycle.
- Preserve Samsung logout suppression and all existing authentication and Calendar/Conversation contracts.
- Core `user.id` remains the stable opaque `User.id`; user-facing fields must never expose `usr_`, `@atg.local`, credential IDs, installation IDs, or Passkey DB IDs.
- Do not modify Account Web unless evidence proves it is required.

## Review Focus

- Missing context plus authenticated Account must create one fresh handoff without redeeming the stale callback.
- Missing context plus anonymous Account, expired marker, or second attempt must remain bounded and fail safely.
- State mismatch, invalid callback parameters, expired context, and replay errors must never enter recovery.
- Delayed Account status must not expose login/signup in Header, Desktop Sidebar, or Mobile Drawer before the result.
- Passkey identifier selection must prefer canonical email after email-first lands, otherwise legacy handle, never provider email or generated compatibility handle.

---

### Task 1: Site callback recovery

**Files:**
- Modify: `site-auth.js`
- Modify: `auth-callback.js`
- Test: `scripts/validate_auth_continuity_02.mjs`

**Interfaces:**
- Produces: `recoverMissingSiteHandoffContext(error): Promise<boolean>` and recovery-marker helpers.

- [ ] Write failing tests for authenticated/anonymous/already-attempted context-missing and non-recoverable errors.
- [ ] Run `node scripts/validate_auth_continuity_02.mjs`; expect the new recovery assertions to fail.
- [ ] Implement one-time read-only status check and fresh `beginSiteHandoff()` navigation.
- [ ] Re-run focused auth tests; expect PASS.
- [ ] Commit Site callback recovery.

### Task 2: Site first-paint checking state

**Files:**
- Modify: `index.html`
- Modify: `site-continuity.js`
- Test: `scripts/validate_auth_continuity_02.mjs`

**Interfaces:**
- Consumes: existing `markCheckingAccountUi`, `markAuthenticatedAccountUi`, `markAnonymousAccountUi`.
- Produces: neutral initial Header/Desktop/Mobile state until authoritative Account status.

- [ ] Replace current assertions with failing checking-state and delayed-status contracts.
- [ ] Run the focused test and observe the current anonymous markup/premature paint failures.
- [ ] Change all initial account slots to checking placeholders and remove pre-status anonymous mutation.
- [ ] Re-run focused and full Site validation suites.
- [ ] Commit Site first-paint fix and cache-key updates.

### Task 3: Core friendly Passkey registration identifier

**Files:**
- Modify: `app/passkeys.py`
- Modify/create: focused Passkey registration tests discovered from latest Core main.

**Interfaces:**
- Produces: canonical LOTBI identifier lookup used only for WebAuthn `user.name`; `user.id` remains unchanged.

- [ ] Add failing legacy-handle registration assertions and internal-identifier rejection assertions.
- [ ] Run focused pytest and observe `usr_...@atg.local` failure.
- [ ] Implement no-migration canonical identifier resolution using existing LOTBI identity tables.
- [ ] Run Passkey registration/assertion, Password Auth, Persistent Session, and full required Core tests.
- [ ] Commit Core hotfix and document PR #131 forward-compatibility merge requirement.

### Task 4: Promotion and production verification

**Files:**
- No additional product files unless verification finds a regression.

**Interfaces:**
- Consumes: exact green Site/Core heads.
- Produces: normal merges and exact Production deployments.

- [ ] Open Site/Core PRs from dedicated branches.
- [ ] Wait for required CI once per final head; inspect failures rather than rerunning blindly.
- [ ] Normal-merge green PRs and verify Vercel/Render exact SHAs and health.
- [ ] Run safe Production smoke for callback security and initial markup.
- [ ] Request one Samsung E2E covering login, callback, first-paint, logout, and refresh; request a new Passkey registration only when the production candidate is ready.
