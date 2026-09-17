# PRODUCTION SOCIAL SIGNUP LEGAL MANIFEST — CROSS-REPO IMPLEMENTATION HANDOFF

> 상태: `HANDOFF READY / FREE PRODUCT POLICY CLOSED / DO NOT PUBLISH / DO NOT ACTIVATE PROVIDERS`
>
> 기준일: 2026-09-17 (Asia/Seoul)

Authoritative reviewed baselines:

- Core main baseline: `23d6c99658704a84a09c3edd7b3474a1db77387b`
- Core Social review HEAD: `b555420b8d75c9e241a6cd9bd534f205499a87d8`
- Account main baseline: `9cec0b958d22b566f9312521670c7d82d0740e41`
- Account Social review HEAD: `5eadea164d559a4f3c45dfca18d6c2acf95a40c0`
- Site readiness branch: `review/social-auth-provider-readiness-01-20260917`
- FREE authoritative product policy: `docs/free-monthly-3-task-product-policy.md`

`PRODUCT_POLICY_CONFIRMATION_REQUIRED — FREE_TASK_DEFINITION_AND_RESET = CLOSED`.

This handoff does not authorize main promotion, Production deployment, Provider Console changes, secrets, provider activation, or usage-enforcement deployment.

---

# A. LOTBI 공식사이트 개발방 handoff

Repository: `jshncd01-source/lotbi-site`

## Branch rule

The current readiness branch is documentation-only and has diverged from current Site `main`. **Do not merge this readiness branch directly into main.**

When implementation is authorized:

1. fetch current `lotbi-site/main`;
2. create a fresh dedicated legal-page review branch from that current main;
3. port only the approved content from:
   - `docs/production-privacy-candidate.md`
   - `docs/production-terms-candidate.md`
4. preserve unrelated current Site work;
5. no main merge/promotion until explicit approval.

## Target files

Primary:

- `privacy.html`
- `terms.html`

Conditional only if the final Provider lifecycle wording changes the deletion explanation:

- `account-deletion.html`

Do not change the homepage, mobile chooser, account handoff, general visual redesign, or unrelated Site behavior from this handoff.

## Production text that must be replaced

### `privacy.html`

Remove/replace the pre-release statements that say, in substance:

- the public site is only a static introduction site;
- signup is not provided;
- a full privacy policy will only be provided later before service launch.

The new page must reflect the actual enabled Production scope at publication time. It must not claim that a Provider or feature is already active if activation is still false.

The finalized FREE product policy does not itself add Provider data. If Core later persists account-linked FREE usage/compensation metadata, the exact fields and retention must be reconciled into the final Privacy before publication; do not invent task-content retention.

### `terms.html`

Replace the current pre-release `LOTBI 웹사이트 이용안내` framing and statements that defer the actual account/transaction terms to a later document.

The Production Terms candidate must cover the approved account, Passkey, Social Login, account deletion, FREE, LOTBI Plus and Merchant-separation contract without inventing unresolved refund/renewal/legal conclusions.

FREE wording must preserve this authoritative policy:

- FREE = monthly 3 successful tasks;
- not 3 messages/questions/AI calls;
- charge only after successful final user result delivery;
- same-task clarification/confirmation = no extra charge;
- LOCAL deterministic = no charge;
- failure/cancel/incomplete = no charge;
- retry/duplicate/reconciliation = no duplicate charge;
- reset = every month on day 1 at 00:00 `Asia/Seoul` / KST;
- carry-over = NONE;
- compensation = auditable adjustment without deleting the original usage event.

## Preserve

- canonical URI:
  - `https://lotbiai.com/privacy.html`
  - `https://lotbiai.com/terms.html`
- public HTTPS/no-login access;
- `<meta name="viewport" ...>` mobile support;
- LOTBI service/brand identity;
- official company/contact data that is still current;
- navigation to account deletion/contact;
- accessibility structure unless the new content needs additive headings/links.

## Required Site validation before any publish proposal

- HTML parses cleanly;
- public legal-page links are internally consistent;
- Privacy → account deletion link works;
- Terms → Privacy/account deletion/contact paths work;
- mobile viewport preserved;
- no `app.lotbiai.com` invented;
- no Provider marked active merely because the policy mentions its possible/approved integration;
- no secret/client/token value appears;
- FREE policy wording is consistent with the authoritative policy document;
- legal review placeholders are removed only after actual legal decision;
- exact final HTML bytes are frozen for SHA-256 after legal approval.

## Publication stop rule

Do **not** deploy/publish from this handoff until:

- legal review gates are closed;
- final effective date and version are selected;
- exact HTML is approved;
- user explicitly authorizes Production publish.

The FREE task-definition/reset product-policy gate is already CLOSED and is no longer a publication blocker by itself.

---

# B. LOTBI 메인 Core / Social Auth Core review 소유방 handoff

Repository: `jshncd01-source/lotbi-core`

Use reviewed Social baseline:

`b555420b8d75c9e241a6cd9bd534f205499a87d8`

Do not redesign the Social Signup consent contract if the two-key legal model remains unchanged.

## Contract-owning files

- `app/auth_social_consent.py`
- `app/auth_provider_signup.py`
- `app/auth_provider_production_gate_api.py`

Related verified regression files:

- `tests/test_auth_social_signup_v1.py`
- `tests/test_auth_provider_finish_v1.py`
- `tests/test_auth_provider_flow_v1.py`

## Production manifest endpoints

- `GET /v2/sessions/providers/signup/consents`
- `GET /v2/sessions/providers/readiness`

Expected readiness signal after legal manifest configuration:

`signup_consent_configured=true`

This is independent of provider activation.

## Environment contract

Terms:

- `LOTBI_SOCIAL_TERMS_VERSION`
- `LOTBI_SOCIAL_TERMS_SHA256`
- `LOTBI_SOCIAL_TERMS_URI`

Privacy:

- `LOTBI_SOCIAL_PRIVACY_VERSION`
- `LOTBI_SOCIAL_PRIVACY_SHA256`
- `LOTBI_SOCIAL_PRIVACY_URI`

Canonical URIs:

- Terms: `https://lotbiai.com/terms.html`
- Privacy: `https://lotbiai.com/privacy.html`

## Authorized future legal-manifest implementation sequence

Only after final legal HTML is approved and actually published:

1. obtain the final document versions;
2. calculate/verify SHA-256 from the exact approved deployed HTML bytes;
3. configure the six manifest values in the authorized Production environment;
4. keep all `LOTBI_SOCIAL_<PROVIDER>_PRODUCTION_ACTIVATION` values false unless separately approved;
5. verify `/signup/consents` returns exactly the two current documents;
6. verify `/readiness` returns `signup_consent_configured=true`;
7. verify missing/malformed manifest continues to fail closed;
8. verify client-supplied version/hash/URI mismatches are rejected;
9. run Social Signup/Core regression suite and CI;
10. produce evidence without exposing environment secrets.

Manifest installation must never implicitly activate Google/Kakao/NAVER/Apple.

## FREE usage implementation handoff

The product decision is CLOSED, but this readiness room does **not** claim the usage ledger/enforcement is implemented in Core.

The owning Core workstream must map its actual task lifecycle to the authoritative policy and verify at minimum:

1. one stable `task_id` or equivalent usage idempotency boundary;
2. charge only at `USER_RESULT_DELIVERED` / `SUCCESS` / `COMPLETED` or Core-equivalent authoritative final-success state;
3. request receipt, provider invocation or processing-start alone never charges;
4. same-task clarification/confirmation is not a separate charge;
5. LOCAL deterministic path = usage 0 / AI Provider call 0 / external effect NONE;
6. server/AI/network/validation/auth/payment failures, user cancel before completion, incomplete/aborted work and internal recovery/reconciliation = no charge;
7. retry/duplicate/provider/callback/client/reconciliation retry cannot charge the same successful task more than once;
8. usage period bucket resets every month on day 1 at 00:00 `Asia/Seoul` / KST;
9. no unused FREE allowance carry-over;
10. task usage and AI Provider-call accounting remain separate;
11. compensation/credit adjustment is append-only/auditable and does not erase the original usage event;
12. concurrent retries cannot race into duplicate usage charges;
13. user-visible usage value is derived from authoritative server usage, not a client-local counter.

The owning workstream should add regression tests for success-only charging, no-charge failure/cancel, KST reset boundary, no carry-over, duplicate retry idempotency and compensation audit behavior before calling implementation GREEN.

## No-change expectations for Social Signup consent

Keep:

- required keys = `TERMS_OF_SERVICE`, `PRIVACY_POLICY` only;
- exactly two required consent rows;
- `decision=ACCEPTED`;
- `required=true`;
- server-owned version/hash/URI;
- `UserConsentRecord.source=SOCIAL_SIGNUP`;
- fail-closed behavior.

Do not invent a separate `consent_manifest_version`.

---

# C. LOTBI Account Web 개발방 handoff

Repository: `jshncd01-source/lotbi-web`

Reviewed Social baseline:

`5eadea164d559a4f3c45dfca18d6c2acf95a40c0`

The current reviewed implementation already matches the consent contract. The handoff is primarily Production integration verification, not a UI redesign.

## Contract-owning files

- `src/components/social-signup-form.tsx`
- `src/app/api/auth/providers/signup/context/route.ts`
- `src/app/api/auth/providers/signup/complete/route.ts`
- `src/lib/core/social-auth.ts`
- `src/lib/auth/provider-readiness.ts`

Regression files:

- `tests/social-auth-bff.test.mjs`
- `tests/provider-readiness-boundary.test.mjs`

## Required Production Social Signup behavior

After Core Production manifest is installed:

1. Social Signup context must return exactly two legal documents;
2. UI must display:
   - `이용약관 동의 (필수)`
   - `개인정보 처리방침 동의 (필수)`;
3. zero or one accepted document must not permit account creation;
4. legal links must point to the Core-returned canonical HTTPS URIs;
5. Account must not invent or override document version/hash/URI;
6. complete BFF must re-fetch/validate the required document key set;
7. Provider email must not silently merge an existing LOTBI account;
8. Provider buttons remain fail-closed when Core Web configuration/callback/activation/purpose readiness is not satisfied;
9. Social SIGNUP must remain unavailable when `signup_consent_configured=false`;
10. Apple SIGNUP/LINK must remain blocked while `APPLE_SOCIAL_AUTH_LIFECYCLE_BLOCKER` is open.

## Required FREE user-facing wording

Where Account Web displays FREE usage, use task-based language such as:

- `이번 달 무료 작업 2 / 3 사용`
- `무료 작업 1회 남음`

Help copy:

- `하나의 작업을 완료하기 위한 추가 질문과 확인 대화는 별도 작업으로 계산되지 않습니다.`
- `실패하거나 결과가 완료되지 않은 요청은 차감되지 않습니다.`

Do not display:

- `메시지 3개`
- `AI 질문 3번`
- `AI 호출 3회`

The displayed usage counter must come from the authoritative server contract once that usage API/contract is implemented; Account Web must not invent a local usage ledger.

## Exact callback contract retained

- Google: `https://account.lotbiai.com/api/auth/providers/google/callback`
- Kakao: `https://account.lotbiai.com/api/auth/providers/kakao/callback`
- NAVER: `https://account.lotbiai.com/api/auth/providers/naver/callback`
- Apple: `https://account.lotbiai.com/api/auth/providers/apple/callback`

No callback alias should be invented for Provider Console convenience.

---

# D. Provider lifecycle handoff boundary

The FREE policy closure and legal-page/manifest work do not close these implementation blockers:

- Google: `GOOGLE_SCOPE_CONTRACT_VERIFY = OPEN`
- Kakao: `KAKAO_PROVIDER_LIFECYCLE_BLOCKER — UNLINK + USER_ID DELETION/PURGE POLICY REQUIRED`
- NAVER: `NAVER_PROVIDER_LIFECYCLE_BLOCKER — TOKEN_REVOCATION/DISCONNECT INTEGRATION VERIFY`
- Apple: `APPLE_SOCIAL_AUTH_LIFECYCLE_BLOCKER`

The final public legal pages must reflect the behavior that is actually implemented when these blockers close.

---

# E. Final promotion gate

Before `USER_ACTION_REQUIRED — GOOGLE STEP 1`:

- all required legal review decisions for Production Privacy/Terms closed;
- Production Privacy final legal text published;
- Production Terms final legal text published;
- exact per-document version/SHA-256/URI finalized;
- Core Production Social Signup manifest configured and verified;
- Account Production UI verified against that manifest;
- Google minimum `openid` real E2E verified;
- Provider activation remains under explicit separate approval.

Current status:

`PRODUCT_POLICY_CONFIRMATION_REQUIRED — FREE_TASK_DEFINITION_AND_RESET = CLOSED`

`PRODUCTION SOCIAL SIGNUP LEGAL MANIFEST READINESS = BLOCKED / NOT GREEN`

`USER_ACTION_REQUIRED — GOOGLE STEP 1 = NOT YET`.