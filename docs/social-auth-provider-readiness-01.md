# SOCIAL-AUTH-PROVIDER-READINESS-01

Research / verification date: 2026-09-17 (Asia/Seoul)

Current phase:

`PRODUCTION LEGAL PAGES REVIEW GREEN / PUBLISH APPROVAL GATE`

## 1. Current status

- `CORE SOCIAL REVIEW GREEN`
- `ACCOUNT WEB SOCIAL REVIEW GREEN`
- `CALLBACK CONTRACT GREEN BY REVIEW`
- `FREE TASK PRODUCT POLICY CLOSED`
- `D1 UNDER-14 POLICY = APPROVED / CLOSED`
- `D2 PRIVACY OFFICER = APPROVED / CLOSED`
- `LEGAL_COUNSEL_REVIEW = OPTIONAL / RECOMMENDED / NOT HARD BLOCKER`
- `PRODUCTION PRIVACY FINAL CANDIDATE = REVIEW GREEN`
- `PRODUCTION TERMS FINAL CANDIDATE = REVIEW GREEN`
- `SITE LEGAL PAGES = REVIEW GREEN`
- `CORE CONSENT MANIFEST HANDOFF = READY / NOT DEPLOYED`
- `ACCOUNT AGE-CONFIRMATION HANDOFF = READY / IMPLEMENTATION NOT YET VERIFIED`
- `PRODUCTION PRIVACY NOT PUBLISHED`
- `PRODUCTION TERMS NOT PUBLISHED`
- `PROVIDER REAL E2E PENDING`
- `PROVIDER CONSOLE UNCHANGED`
- `MAIN NOT PROMOTED BY THIS WORK`

## 2. Implementation baselines

- Core main baseline: `23d6c99658704a84a09c3edd7b3474a1db77387b`
- Core Social review: `b555420b8d75c9e241a6cd9bd534f205499a87d8`
- Account main baseline: `9cec0b958d22b566f9312521670c7d82d0740e41`
- Account Social review: `5eadea164d559a4f3c45dfca18d6c2acf95a40c0`
- Social contract: `LOTBI_SOCIAL_AUTH_V2`

## 3. Approved user policy

### D1 = A — CLOSED

- LOTBI v1 under-14 signup unsupported.
- Signup/Social Signup completion requires `만 14세 이상입니다 (필수)`.
- It is not described as government identity verification or guardian verification.
- Under-14 signup remains disabled until a guardian-consent/verification workflow exists.

### D2 = A — CLOSED

Production Privacy contact:

- 개인정보 보호책임자: `전선혜`
- email: `developer@lotbiai.com`
- phone: `063-237-0930`

## 4. Final Site legal-page review

Latest Site main used as clean base:

`e4314a2e6e8862f3ca1731465e0b3ca3b534a204`

Fresh review branch:

`site-legal-pages-social-auth-01-review`

Final reviewed HEAD:

`3785844a54472523e9069c0a9b733f16b625daab`

Draft PR:

`#32 — SITE-LEGAL-PAGES-SOCIAL-AUTH-01 — Production Privacy/Terms review`

PR is draft/open/not merged.

Changed Site scope:

- `privacy.html`
- `terms.html`
- `scripts/validate_legal_pages.py`
- `scripts/validate_hardening.py` legal-page hash baseline only
- `scripts/emit_social_signup_legal_manifest.py`
- `.github/workflows/legal-pages-review.yml`

No Home/Avatar/conversation/auth feature file was changed.

### CI evidence at exact Site HEAD

- Legal Pages Review Gate run `35202185023` = `SUCCESS`
- Public Site Review Gate run `35202184989` = `SUCCESS`

Therefore:

`SITE LEGAL PAGES = REVIEW GREEN`

## 5. Final legal document identity

### TERMS_OF_SERVICE

- version: `LOTBI_TERMS_2026-09-17_R1`
- SHA-256: `53ab6c93262f7fb46ee75504717fbdf99442ec8da1a98d12c6f54e9cc6865a6d`
- URI: `https://lotbiai.com/terms.html`

### PRIVACY_POLICY

- version: `LOTBI_PRIVACY_2026-09-17_R1`
- SHA-256: `76f35a0816fe78e0ee035a380dfe5aa96059fcb478fe031b9a808b6f90b20a57`
- URI: `https://lotbiai.com/privacy.html`

Hashes were generated from exact UTF-8 file bytes in Site review CI. They are review-authoritative and become Production authoritative only if the exact same files are published unchanged and Production response bytes are reverified.

No separate `consent_manifest_version` exists.

## 6. Social Signup legal contract

Exactly two required documents:

1. `TERMS_OF_SERVICE`
2. `PRIVACY_POLICY`

Both require:

- `required=true`
- `decision=ACCEPTED`
- server-owned version/SHA-256/HTTPS URI

Browser/Account must not invent these metadata.

Production Core manifest is **not deployed** yet.

## 7. Account Web handoff

Existing required controls stay unchanged:

- `이용약관 동의 (필수)`
- `개인정보 처리방침 동의 (필수)`

D1 addition required before Social Signup completion:

`만 14세 이상입니다 (필수)`

Required behavior:

- default false
- completion blocked while false
- not government identity verification
- separate meaning from legal-document consent
- no Provider email/name/profile import
- no email-based automatic account merge

Status:

`ACCOUNT SIGNUP CONTRACT HANDOFF = READY / IMPLEMENTATION GREEN NOT YET CLAIMED`

## 8. Provider data minimum contract

| Provider | Scope/flow | Identity | Provider email/name/profile |
|---|---|---|---|
| Google | `openid` | `sub` | unused |
| Kakao | `openid` | `sub` | unused |
| NAVER | `openid` | `response.id` | unused |
| Apple | no email/name scope | `sub` | unused |

User directly enters LOTBI name + handle.

## 9. Provider technical blockers

### Google

- code/callback: `GREEN BY REVIEW`
- `GOOGLE_SCOPE_CONTRACT_VERIFY = OPEN`
- real configured-client E2E: `PENDING`
- Google Console step: `NOT YET`

### Kakao

`KAKAO_PROVIDER_LIFECYCLE_BLOCKER — UNLINK + USER_ID DELETION/PURGE POLICY REQUIRED`

### NAVER

`NAVER_PROVIDER_LIFECYCLE_BLOCKER — TOKEN_REVOCATION/DISCONNECT INTEGRATION VERIFY`

### Apple

- LOGIN: `READY BY REVIEW`
- SIGNUP/LINK: `APPLE_SOCIAL_AUTH_LIFECYCLE_BLOCKER`

## 10. External counsel / paid-service boundary

Old rule `EXTERNAL LEGAL REVIEW = HARD BLOCKER` remains retired.

Current:

`LEGAL_COUNSEL_REVIEW = OPTIONAL / RECOMMENDED`

Higher-risk review remains recommended for overseas-processing classification, Merchant legal role and Plus refund/withdrawal terms. Those advanced items do not block free Social Login legal-page review when the corresponding paid/Merchant features are not active.

Plus live billing, Store billing, payment/refund/order/live-money remain prohibited in this room.

## 11. Production publication boundary

No Production publish has been performed.

Current live Production legal pages must remain untouched until explicit user approval.

Publication sequence:

1. explicit user approves legal-page promotion/publish;
2. promote exact reviewed Site legal-page batch without unrelated changes;
3. fetch Production `privacy.html` / `terms.html` bytes;
4. verify bytes/hash against reviewed values;
5. install Core Production consent manifest using matching version/hash/URI;
6. verify Core consent/readiness endpoints;
7. verify Account Production legal consents + D1 age confirmation;
8. proceed to Provider-specific real E2E/Console steps only when their gates permit.

If effective-date text or any HTML byte changes before publish, recompute SHA-256 and review document version.

## 12. Current conclusion

- `D1 = APPROVED / CLOSED`
- `D2 = APPROVED / CLOSED`
- `PRIVACY = FINAL PRODUCTION CANDIDATE / REVIEW GREEN`
- `TERMS = FINAL PRODUCTION CANDIDATE / REVIEW GREEN`
- `SITE LEGAL PAGES = REVIEW GREEN`
- `CORE CONSENT MANIFEST = READY / NOT DEPLOYED`
- `ACCOUNT SIGNUP HANDOFF = READY / IMPLEMENTATION VERIFY PENDING`
- `PRODUCTION PUBLISH = PENDING EXPLICIT USER APPROVAL`
- `USER_ACTION_REQUIRED — GOOGLE STEP 1 = NOT YET`

The next user gate is Production legal-page publication approval, not outside-counsel approval.