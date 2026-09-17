# PRODUCTION PRIVACY / TERMS / SOCIAL SIGNUP MANIFEST — CROSS-REPO HANDOFF

> 상태: `SITE REVIEW GREEN / CORE MANIFEST READY / ACCOUNT AGE-GATE HANDOFF READY / PRODUCTION NOT PUBLISHED`
>
> 기준일: 2026-09-17 (Asia/Seoul)

Policy:

`LEGAL_COUNSEL_REVIEW = OPTIONAL / RECOMMENDED / NOT HARD BLOCKER`

User policy:

- `D1=A = APPROVED / CLOSED`
- `D2=A = APPROVED / CLOSED`

This handoff does not authorize main promotion, Production deployment, Provider Console changes, secrets, Provider activation, billing, payment, refund, order or live-money.

---

# A. LOTBI Site — REVIEW GREEN

Repository:

`jshncd01-source/lotbi-site`

Latest Site main used as branch base:

`e4314a2e6e8862f3ca1731465e0b3ca3b534a204`

Fresh branch created from that exact main:

`site-legal-pages-social-auth-01-review`

Final review HEAD:

`3785844a54472523e9069c0a9b733f16b625daab`

Draft PR:

`#32 — SITE-LEGAL-PAGES-SOCIAL-AUTH-01 — Production Privacy/Terms review`

PR remains draft/open/not merged.

## Site changed files

- `privacy.html`
- `terms.html`
- `scripts/validate_legal_pages.py`
- `scripts/validate_hardening.py` — only legal-page approved hash baselines updated
- `scripts/emit_social_signup_legal_manifest.py`
- `.github/workflows/legal-pages-review.yml`

No Home/Avatar/conversation/auth/mobile chooser feature file was modified by this legal-page batch.

## D1/D2 reflected in public candidate HTML

D1:

- LOTBI v1 under-14 signup unsupported
- required text before signup completion: `만 14세 이상입니다 (필수)`
- not described as government identity verification or guardian verification

D2:

- 개인정보 보호책임자: `전선혜`
- email: `developer@lotbiai.com`
- phone: `063-237-0930`

## Site review evidence

At exact HEAD `3785844a54472523e9069c0a9b733f16b625daab`:

- Legal Pages Review Gate run `35202185023` = `SUCCESS`
- Public Site Review Gate run `35202184989` = `SUCCESS`

Legal gate verified:

- approved D1/D2
- Social Provider minimum identifiers
- no Provider profile overcollection claim
- FREE contract
- Plus channel wording without live-sale overclaim
- no pre-release/internal review marker
- Site structure/hardening/accessibility
- reviewed manifest values

Public Site gate also verified the existing Site contracts including Home shell, sealed Avatar integration, conversation/handoff, auth continuity, hardening, accessibility, mobile chooser, Production Core CORS and static smoke.

## Production boundary

Do not merge PR #32 or publish until explicit user approval.

If HTML changes after this review, rerun both workflows and recompute legal-document hashes.

---

# B. Core Social Signup consent manifest — READY / NOT DEPLOYED

Repository:

`jshncd01-source/lotbi-core`

Reviewed Social baseline:

`b555420b8d75c9e241a6cd9bd534f205499a87d8`

Required keys remain exactly:

- `TERMS_OF_SERVICE`
- `PRIVACY_POLICY`

Both require:

- `decision=ACCEPTED`
- `required=true`

No `consent_manifest_version`.

## Reviewed exact values

Terms:

- `LOTBI_SOCIAL_TERMS_VERSION=LOTBI_TERMS_2026-09-17_R1`
- `LOTBI_SOCIAL_TERMS_SHA256=53ab6c93262f7fb46ee75504717fbdf99442ec8da1a98d12c6f54e9cc6865a6d`
- `LOTBI_SOCIAL_TERMS_URI=https://lotbiai.com/terms.html`

Privacy:

- `LOTBI_SOCIAL_PRIVACY_VERSION=LOTBI_PRIVACY_2026-09-17_R1`
- `LOTBI_SOCIAL_PRIVACY_SHA256=76f35a0816fe78e0ee035a380dfe5aa96059fcb478fe031b9a808b6f90b20a57`
- `LOTBI_SOCIAL_PRIVACY_URI=https://lotbiai.com/privacy.html`

These hashes are exact UTF-8 bytes from Site review HEAD and were emitted by CI. They become Production authoritative only after the exact same bytes are published unchanged and fetched back from Production successfully.

## Post-publish Core sequence

1. publish exact reviewed Site HTML after explicit approval;
2. fetch Production Privacy/Terms response and verify exact bytes/hash;
3. configure the six Core manifest values;
4. keep all Provider Production activation flags false unless separately approved;
5. verify `GET /v2/sessions/providers/signup/consents` returns exactly two docs;
6. verify `/v2/sessions/providers/readiness` reports signup consent configured;
7. run Social Signup regression/CI.

Current:

`CORE CONSENT MANIFEST = READY FOR POST-PUBLISH INSTALL / NOT DEPLOYED`

---

# C. Account Web — D1 + consent implementation handoff READY

Repository:

`jshncd01-source/lotbi-web`

Reviewed Social baseline:

`5eadea164d559a4f3c45dfca18d6c2acf95a40c0`

Existing required legal consents remain:

- `이용약관 동의 (필수)`
- `개인정보 처리방침 동의 (필수)`

Both must remain fail-closed.

D1 approved addition before Social Signup completion:

`만 14세 이상입니다 (필수)`

Implementation requirements:

- default false / unconfirmed
- no signup completion while false
- do not call it government age verification
- do not add Provider email/name/profile import
- do not auto-link/merge by email
- do not let client invent legal document version/hash/URI
- age confirmation and Terms/Privacy document consents remain semantically distinct

Relevant files:

- `src/components/social-signup-form.tsx`
- `src/app/api/auth/providers/signup/context/route.ts`
- `src/app/api/auth/providers/signup/complete/route.ts`
- `src/lib/core/social-auth.ts`
- `src/lib/auth/provider-readiness.ts`

This readiness room marks the **handoff/contract READY**, not the Account implementation GREEN.

---

# D. Provider blockers retained

- Google: `GOOGLE_SCOPE_CONTRACT_VERIFY = OPEN`
- Kakao: `KAKAO_PROVIDER_LIFECYCLE_BLOCKER — UNLINK + USER_ID DELETION/PURGE POLICY REQUIRED`
- NAVER: `NAVER_PROVIDER_LIFECYCLE_BLOCKER — TOKEN_REVOCATION/DISCONNECT INTEGRATION VERIFY`
- Apple LOGIN: `READY BY REVIEW`
- Apple SIGNUP/LINK: `APPLE_SOCIAL_AUTH_LIFECYCLE_BLOCKER`

No Provider Console or activation action is authorized by this handoff.

---

# E. Production SHA/version rule

Sequence remains:

`exact Site HTML reviewed GREEN`
→ `explicit user publish approval`
→ `same files main/publish`
→ `Production HTTPS bytes recheck`
→ `version/hash/URI confirmed`
→ `Core manifest install`
→ `Account Production manifest/age-gate verification`
→ `Provider-specific real E2E`

If publication occurs after changing the displayed effective date or any HTML byte, the SHA-256 must be recomputed and version reviewed before Core deployment.

---

# F. Google Console gate

External counsel certification is not required.

Do not issue `USER_ACTION_REQUIRED — GOOGLE STEP 1` until:

1. exact reviewed Privacy/Terms are published;
2. Production bytes match reviewed hashes;
3. Core Production legal manifest is deployed and verified;
4. Account Production required consents + D1 age confirmation are implemented and verified;
5. callback/branding/domain prerequisites remain ready.

Google real `openid` E2E remains required before Google activation can be called Production GREEN.

Current:

- `SITE LEGAL PAGES = REVIEW GREEN`
- `CORE MANIFEST HANDOFF = READY`
- `ACCOUNT SIGNUP HANDOFF = READY`
- `PRODUCTION PUBLISH = PENDING EXPLICIT USER APPROVAL`
- `USER_ACTION_REQUIRED — GOOGLE STEP 1 = NOT YET`.