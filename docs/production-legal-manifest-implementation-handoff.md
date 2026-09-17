# PRODUCTION PRIVACY / TERMS / SOCIAL SIGNUP MANIFEST — CROSS-REPO HANDOFF

> 상태: `HANDOFF READY / COUNSEL OPTIONAL / USER APPROVAL REQUIRED / DO NOT PUBLISH YET`
>
> 기준일: 2026-09-17 (Asia/Seoul)

Reviewed baselines:

- Core main baseline: `23d6c99658704a84a09c3edd7b3474a1db77387b`
- Core Social review: `b555420b8d75c9e241a6cd9bd534f205499a87d8`
- Account main baseline: `9cec0b958d22b566f9312521670c7d82d0740e41`
- Account Social review: `5eadea164d559a4f3c45dfca18d6c2acf95a40c0`
- Readiness branch: `review/social-auth-provider-readiness-01-20260917`

Policy:

`LEGAL_COUNSEL_REVIEW = OPTIONAL / RECOMMENDED / NOT HARD BLOCKER`

This document does not authorize main promotion, Production deployment, Provider Console changes, secrets, or provider activation.

---

# A. LOTBI 공식사이트 개발방

Repository:

`jshncd01-source/lotbi-site`

## Branch rule

The readiness branch is documentation-only and diverged from Site main. Do **not** merge it directly into current main.

When user approves final policy decisions and publication preparation:

1. fetch latest `lotbi-site/main`;
2. create a fresh dedicated legal-page review branch;
3. port approved content from:
   - `docs/production-privacy-candidate.md`
   - `docs/production-terms-candidate.md`
4. preserve unrelated Site changes;
5. no main promotion until explicit approval.

## Target files

- `privacy.html`
- `terms.html`

Conditional if provider/deletion wording needs alignment:

- `account-deletion.html`

## User decisions to apply

### D1

If approved `A`:

- Terms/Privacy state v1 under-14 signup is not supported;
- Account/App signup must have the same minimum `14세 이상` gate before account provisioning;
- do not add DOB collection unless a later design explicitly requires it.

### D2

If approved `A`:

Privacy contact:

- 개인정보 보호책임자: 전선혜
- email: `developer@lotbiai.com`
- phone: `063-237-0930`

## Production processor/data-flow technical manifest

Before final `privacy.html` freeze, Site owner must receive verified values from Core/Web/Infra for **actually active Production services only**:

- hosting/database provider and processing region;
- Account Web hosting provider and region;
- active AI provider/data flow if AI feature is live;
- actual retention/contract fields needed for overseas processing disclosure;
- Toss/App Store/Google Play only if those purchase channels are activated.

Do not copy the Render Singapore pilot example as a Production fact.

Do not list a vendor merely because LOTBI has an account or repository with that vendor.

## Remove current pre-release wording

`privacy.html` must no longer say:

- this is only a static introduction site;
- signup is not provided;
- full Privacy will only be published later.

`terms.html` must no longer be only `웹사이트 이용안내` that defers the actual account/service Terms.

## Preserve

- `https://lotbiai.com/privacy.html`
- `https://lotbiai.com/terms.html`
- HTTPS/no-login public access
- mobile viewport
- LOTBI brand
- verified company fields
- deletion/contact links

## Final Site validation

- no review marker (`VERIFY`, `USER DECISION`, `DO NOT PUBLISH`) remains in public HTML;
- internal links work;
- no fake `app.lotbiai.com`;
- no Provider marked active before actual activation;
- no secret/token/private key appears;
- legal URLs remain canonical;
- exact final HTML is frozen before hash calculation.

---

# B. Core / Social Auth Core owner

Repository:

`jshncd01-source/lotbi-core`

## Existing Social Signup legal contract — keep unchanged

Required keys:

- `TERMS_OF_SERVICE`
- `PRIVACY_POLICY`

Both:

- `decision=ACCEPTED`
- `required=true`

Each document:

- `document_version`
- `document_sha256`
- `document_uri`

No separate `consent_manifest_version`.

Contract-owning files:

- `app/auth_social_consent.py`
- `app/auth_provider_signup.py`
- `app/auth_provider_production_gate_api.py`

Endpoints:

- `GET /v2/sessions/providers/signup/consents`
- `GET /v2/sessions/providers/readiness`

## Production environment contract

Terms:

- `LOTBI_SOCIAL_TERMS_VERSION`
- `LOTBI_SOCIAL_TERMS_SHA256`
- `LOTBI_SOCIAL_TERMS_URI`

Privacy:

- `LOTBI_SOCIAL_PRIVACY_VERSION`
- `LOTBI_SOCIAL_PRIVACY_SHA256`
- `LOTBI_SOCIAL_PRIVACY_URI`

Canonical URIs:

- `https://lotbiai.com/terms.html`
- `https://lotbiai.com/privacy.html`

## Authorized future sequence after user publish approval

1. Site final HTML published from approved commit;
2. fetch/reconfirm exact Production responses;
3. use the final agreed `LOTBI_TERMS_<DATE>_R<n>` / `LOTBI_PRIVACY_<DATE>_R<n>` versions;
4. compute/verify SHA-256 from exact final HTML bytes;
5. configure the six manifest fields;
6. keep Provider Production activation false unless separately approved;
7. verify `/signup/consents` returns exactly two documents;
8. verify `/readiness` shows `signup_consent_configured=true`;
9. verify malformed/missing/client-mismatched manifest fails closed;
10. run Social Signup regressions and CI.

## D1 age-policy technical handoff

If user approves `D1=A`, owning Core/Account/App workstream must add and verify a minimal under-14 prevention contract before Social Signup is opened.

Requirements:

- signup cannot complete without 14+ confirmation;
- do not silently invent/collect full DOB unless explicitly designed;
- Web/App behavior consistent;
- evidence does not falsely claim formal identity age verification if only self-confirmation is used.

## Provider blockers remain

- Google `GOOGLE_SCOPE_CONTRACT_VERIFY = OPEN`
- Kakao Unlink + user-id deletion/purge
- NAVER token revoke + disconnect
- Apple SIGNUP/LINK revocation lifecycle

D3 user decision is implemented only after approval and provider-specific design.

---

# C. Account Web owner

Repository:

`jshncd01-source/lotbi-web`

Reviewed baseline:

`5eadea164d559a4f3c45dfca18d6c2acf95a40c0`

Existing Social Signup consent UI remains valid and should not be redesigned.

Relevant files:

- `src/components/social-signup-form.tsx`
- `src/app/api/auth/providers/signup/context/route.ts`
- `src/app/api/auth/providers/signup/complete/route.ts`
- `src/lib/core/social-auth.ts`
- `src/lib/auth/provider-readiness.ts`

Required behavior after Core Production manifest exists:

1. context returns exactly Terms + Privacy;
2. UI displays both as required;
3. one/zero consents cannot create account;
4. links use Core-returned canonical HTTPS URI;
5. browser cannot invent version/hash/URI;
6. complete BFF revalidates legal key set;
7. Provider email never silently merges account;
8. buttons remain fail-closed on Core readiness/activation/purpose;
9. signup fails closed when `signup_consent_configured=false`;
10. Apple SIGNUP/LINK remains unavailable while lifecycle blocker is open.

If `D1=A` is approved, add the same 14+ confirmation gate to the Social Signup completion experience before submitting account provisioning.

Recommended user wording:

`만 14세 이상입니다 (필수)`

Do not label it as government identity verification if it is only user confirmation.

---

# D. App owner

Android/iOS signup must follow the same D1 policy when native Social Signup is activated.

Do not create a platform-specific exception that allows under-14 signup while Web blocks it.

D4/D5 Plus choices are paid-service implementation handoffs and do not change Social Signup consent keys.

---

# E. Production Privacy/Terms version and hash rule

Sequence is fixed:

`user approves final wording`
→ `latest Site main fresh branch`
→ `privacy.html / terms.html freeze`
→ `document version fixed`
→ `exact UTF-8 bytes SHA-256`
→ `same files Production publish`
→ `Production response recheck`
→ `Core manifest configured with matching version/hash/URI`
→ `Account manifest verification`

Draft Markdown hash is never authoritative.

---

# F. Google Console readiness gate

Do not issue `USER_ACTION_REQUIRED — GOOGLE STEP 1` until:

1. D1/D2 decided;
2. final Privacy/Terms HTML is clean and approved;
3. Production processor/data-flow technical table is verified;
4. Privacy/Terms are published;
5. final version/SHA/URI is fixed;
6. Core Production legal manifest is deployed and verified;
7. Account Production signup manifest is verified;
8. Google callback/branding/domain prerequisites are ready.

External lawyer certification is **not** a required item.

Google `openid` real E2E remains required before final Google provider activation/production-green claim.

Current:

- `PRIVACY = READY FOR USER APPROVAL`
- `TERMS = READY FOR USER APPROVAL`
- `PRODUCTION PUBLISH = PENDING USER APPROVAL`
- `USER_ACTION_REQUIRED — GOOGLE STEP 1 = NOT YET`.