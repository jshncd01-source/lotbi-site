# PRODUCTION SOCIAL SIGNUP LEGAL / POLICY READINESS — DECISION MATRIX

> 기준일: 2026-09-17 (Asia/Seoul)
>
> 상태: `EXTERNAL COUNSEL NOT HARD BLOCKER / PRIVACY+TERMS READY FOR USER APPROVAL / PRODUCTION NOT PUBLISHED`

## 1. Fixed technical/product contracts

| Item | Fixed contract |
|---|---|
| Social consent keys | exactly `TERMS_OF_SERVICE` + `PRIVACY_POLICY` |
| Consent requirement | both `ACCEPTED`, `required=true` |
| Consent metadata | per document: version + SHA-256 + HTTPS URI |
| Fake manifest version | none; do not create `consent_manifest_version` |
| Privacy URI | `https://lotbiai.com/privacy.html` |
| Terms URI | `https://lotbiai.com/terms.html` |
| Google | reviewed `openid`, stable `sub`; email/profile unused |
| Kakao | reviewed `openid`, stable `sub`; email/profile unused |
| NAVER | reviewed `openid`, `response.id`; additional profile unused |
| Apple | stable `sub`; email/name scope unused |
| LOTBI signup input | user enters LOTBI name + handle |
| Same-email merge | prohibited |
| Passkey | Social LOGIN step-up / Signup enrollment security contract |
| Account deletion | access/session/authority revoke → deletion lifecycle → final purge separate |
| FREE | monthly 3 successful tasks |
| FREE reset | day 1, 00:00 `Asia/Seoul` |
| FREE carry-over | none |
| LOCAL/failure/cancel/incomplete | no FREE charge |
| Same-task retry | no duplicate charge |
| Plus | KRW 9,900/month |
| Plus channels | Web Toss / iPhone App Store / Android Google Play |
| Merchant money | separate from LOTBI Plus subscription fee |

## 2. External legal counsel policy

Old rule:

`EXTERNAL LEGAL REVIEW = HARD BLOCKER`

is retired.

Current rule:

`LEGAL_COUNSEL_REVIEW = OPTIONAL / RECOMMENDED / NOT HARD BLOCKER`

Counsel is particularly recommended for:

- complex overseas processing/transfer structure;
- Plus refund/withdrawal;
- Merchant legal role;
- material liability allocation.

Lack of an outside lawyer's approval does not by itself block:

- fact-based Privacy/Terms publication;
- Google branding/domain/privacy/terms preparation;
- Social Signup consent manifest preparation.

## 3. Immediate user decisions for FREE Social Login publication

Source:

`docs/production-user-policy-decisions.md`

### D1 — Minor policy

Recommended:

`A = v1 does not support under-14 signup; require 14+ confirmation`.

Status:

`USER DECISION REQUIRED`

### D2 — Privacy officer/contact

Recommended:

`A = 개인정보 보호책임자 전선혜 / developer@lotbiai.com / 063-237-0930`.

Status:

`USER DECISION REQUIRED`

These are the only immediate user decisions required to finalize the FREE Social Login Privacy/Terms wording.

## 4. Decisions not blocking FREE Social Login publication

### D3 — Provider remote revoke

Recommended:

`A = explicit unlink/account deletion performs Provider remote revoke where official Provider contract supports/requires it`.

Status:

`USER DECISION + PROVIDER-SPECIFIC TECHNICAL BLOCKER`

Close before the affected Provider activation, not before all Privacy/Terms drafting.

### D4 — Plus cancellation effect

Recommended:

`A = auto-renew off; entitlement remains through current paid-period end`.

Status:

`PAID SERVICE ACTIVATION DECISION`

### D5 — Plus payment-failure grace

Recommended:

`A = channel-authoritative limited grace/retry state`.

Status:

`PAID SERVICE ACTIVATION DECISION`

D4/D5 do not block FREE Social Login publication if Plus purchase remains inactive until its final paid-service terms are ready.

## 5. Technical publish checks

These are engineering/configuration facts, not counsel gates.

### Privacy/processor data-flow check

Before final `privacy.html` freeze:

- identify actual Production hosting/database provider;
- identify Account Web hosting provider;
- identify enabled AI Provider/data path, if AI is active;
- identify actual data-processing/transfer country and retention/contract information;
- list Toss/Store relationships only if those paid channels are active;
- do not infer Production region from pilot config.

Status:

`PRODUCTION_DATA_FLOW_VERIFY_REQUIRED`

### Final HTML/hash

- latest Site main → fresh legal-page review branch
- final approved text → exact HTML freeze
- exact UTF-8 bytes SHA-256
- same files publish
- Production response recheck
- Core manifest values must match

Status:

`READY HANDOFF / NOT EXECUTED`

## 6. Provider technical blockers

### Google

`GOOGLE_SCOPE_CONTRACT_VERIFY = OPEN`

Current reviewed minimum remains `scope=openid`, `sub` identity only. Real configured-client E2E must verify actual Google acceptance/token/ID-token contract before activation.

### Kakao

`KAKAO_PROVIDER_LIFECYCLE_BLOCKER — UNLINK + USER_ID DELETION/PURGE`

### NAVER

`NAVER_PROVIDER_LIFECYCLE_BLOCKER — TOKEN_REVOCATION / DISCONNECT`

### Apple

- LOGIN contract: ready by review
- SIGNUP/LINK: blocked
- `APPLE_SOCIAL_AUTH_LIFECYCLE_BLOCKER`

These blockers are technical/Provider-contract blockers and are not removed by the new counsel policy.

## 7. Privacy / Terms state

`docs/production-privacy-candidate.md`

= `TECHNICALLY / POLICY READY FOR USER APPROVAL`

`docs/production-terms-candidate.md`

= `TECHNICALLY / POLICY READY FOR USER APPROVAL`

They are not yet Production published and still contain review-only D1/D2/technical-publish markers that must be resolved/removed before final HTML.

## 8. Google Console gate — redefined

Required before `USER_ACTION_REQUIRED — GOOGLE STEP 1`:

A. Privacy final service wording approved

B. Terms final service wording approved

C. immediate user decisions D1/D2 completed

D. actual Production processor/data-flow table verified and final Privacy HTML clean

E. Privacy/Terms Production publish explicitly approved and completed

F. document version / SHA-256 / HTTPS URI finalized

G. Core Social Signup consent manifest deployed and verified

H. Account Signup legal manifest verified in Production

I. callback/branding/domain prerequisites ready

Then:

`USER_ACTION_REQUIRED — GOOGLE STEP 1`

External counsel certification is **not** in this gate.

Google real `openid` E2E remains required before final provider activation/production-green claim.

## 9. Current statuses

- `PRODUCT_POLICY_CONFIRMATION_REQUIRED — FREE_TASK_DEFINITION_AND_RESET = CLOSED`
- `LEGAL_COUNSEL_REVIEW = OPTIONAL / RECOMMENDED`
- `PRODUCTION PRIVACY = READY FOR USER APPROVAL`
- `PRODUCTION TERMS = READY FOR USER APPROVAL`
- `PRODUCTION PUBLISH = PENDING USER APPROVAL`
- `PRODUCTION SOCIAL SIGNUP CONSENT MANIFEST = NOT DEPLOYED`
- `GOOGLE STEP 1 = NOT YET`
- `PRODUCTION SOCIAL SIGNUP LEGAL MANIFEST READINESS = BLOCKED ON USER DECISIONS + PUBLISH/MANIFEST + TECHNICAL GATES, NOT COUNSEL`.