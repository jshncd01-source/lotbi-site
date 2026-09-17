# SOCIAL-AUTH-PROVIDER-READINESS-01

Research / verification date: 2026-09-17 (Asia/Seoul)

Current phase:

`PRODUCTION PRIVACY / TERMS — USER APPROVAL PREP`

## 1. Current status

- `INTERNAL READINESS BASELINE GREEN`
- `CORE SOCIAL REVIEW GREEN`
- `ACCOUNT WEB SOCIAL REVIEW GREEN`
- `ACTIVATION GATE GREEN BY REVIEW`
- `ACCOUNT BFF GREEN BY REVIEW`
- `CALLBACK CONTRACT GREEN BY REVIEW`
- `FREE TASK PRODUCT POLICY CLOSED`
- `PRODUCTION PRIVACY = TECHNICALLY / POLICY READY FOR USER APPROVAL`
- `PRODUCTION TERMS = TECHNICALLY / POLICY READY FOR USER APPROVAL`
- `LEGAL_COUNSEL_REVIEW = OPTIONAL / RECOMMENDED / NOT HARD BLOCKER`
- `USER POLICY DECISION PACKAGE = READY`
- `OFFICIAL SOURCE REGISTER = READY`
- `COMPLIANCE/RISK QUESTIONNAIRE = READY`
- `CROSS-REPO IMPLEMENTATION HANDOFF = READY`
- `PRODUCTION DATA-FLOW TECHNICAL VERIFY = REQUIRED BEFORE PRIVACY HTML FREEZE`
- `PRODUCTION PRIVACY NOT PUBLISHED`
- `PRODUCTION TERMS NOT PUBLISHED`
- `PRODUCTION SOCIAL SIGNUP MANIFEST NOT DEPLOYED`
- `PROVIDER REAL E2E PENDING`
- `PROVIDER SUBMISSION NOT READY`
- `MAIN NOT PROMOTED BY THIS WORK`
- `PRODUCTION NOT CHANGED BY THIS WORK`

Old policy retired:

`EXTERNAL LEGAL REVIEW = HARD BLOCKER`

Current policy:

`LEGAL_COUNSEL_REVIEW = OPTIONAL / RECOMMENDED`

An outside lawyer's approval letter is not required to prepare fact-based Privacy/Terms, publish them after user approval, or prepare Google Console once the actual technical gates are closed.

## 2. Implementation baselines

- Core main supplied baseline: `23d6c99658704a84a09c3edd7b3474a1db77387b`
- Core Social review: `b555420b8d75c9e241a6cd9bd534f205499a87d8`
- Account main supplied baseline: `9cec0b958d22b566f9312521670c7d82d0740e41`
- Account Social review: `5eadea164d559a4f3c45dfca18d6c2acf95a40c0`
- Social contract: `LOTBI_SOCIAL_AUTH_V2`

No Core/Account main promotion is performed from this room.

## 3. Production legal pages

Canonical URLs:

- Privacy: `https://lotbiai.com/privacy.html`
- Terms: `https://lotbiai.com/terms.html`
- Account deletion: `https://lotbiai.com/account-deletion.html`

Current Production Privacy/Terms remain the pre-release pages until explicit user publish approval.

The replacement candidates are:

- `docs/production-privacy-candidate.md`
- `docs/production-terms-candidate.md`

Both are now user-approval candidates rather than counsel-blocked drafts.

## 4. Immediate user policy decisions

Source:

`docs/production-user-policy-decisions.md`

### D1 — under-14 policy

Recommended:

`v1 만 14세 미만 회원가입 미지원 + 최소 14세 이상 확인 gate`

Status:

`USER DECISION REQUIRED`

### D2 — privacy officer/contact

Recommended:

- 개인정보 보호책임자: 전선혜
- `developer@lotbiai.com`
- `063-237-0930`

Status:

`USER DECISION REQUIRED`

Only D1/D2 are immediate decisions required to clean/finalize the FREE Social Login Privacy/Terms public wording.

### D3 — Provider remote revoke

Recommended:

`explicit unlink/account deletion → Provider remote revoke where official Provider contract supports/requires it`.

Status:

`USER DECISION + PROVIDER TECHNICAL IMPLEMENTATION`

This is closed per Provider before activation, not as a blanket Privacy/Terms counsel gate.

### D4/D5 — Plus

- D4 recommended: cancellation → current paid period end
- D5 recommended: channel-authoritative limited grace/retry

Status:

`PAID SERVICE ACTIVATION DECISIONS / NOT FREE SOCIAL LOGIN HARD BLOCKER`

## 5. Privacy core facts retained

Provider data:

| Provider | Reviewed scope/flow | Identity used | email/name/profile |
|---|---|---|---|
| Google | `openid` | `sub` | unused |
| Kakao | `openid` | `sub` | unused |
| NAVER | `openid` | `response.id` | unused |
| Apple | no email/name scope | `sub` | unused |

User directly enters LOTBI name and handle.

Account/security data includes Passkey metadata, ClientInstallation, UserSession, consent evidence, external identity and account-deletion lifecycle records according to current Core contract.

## 6. Official-source conclusions currently used

### Privacy law

Current PIPA basis: 2026-09-11 effective version.

- Privacy policy must disclose required processing/retention/provider/rights/contact fields.
- Overseas transfer includes overseas provision, outsourced processing and storage.
- Under-14 data processing requiring consent triggers legal-representative consent/verification.
- Privacy officer framework includes a small-business exception, with the owner/representative assuming CPO role when no separate CPO is designated under that exception.

### E-commerce

Current Ecommerce Act basis: 2026-07-21 effective version.

- actual paid transaction records map to statutory categories/periods;
- recurring-payment price increase/free→paid conversion includes current consent/notice rules;
- these paid-service details are not used to block FREE Social Login when payment is not activated.

## 7. Production processor / overseas technical fact gate

External counsel is not required to populate this gate.

Before final Privacy HTML freeze, engineering must verify **actual active Production**:

- hosting/database provider + region;
- Account Web hosting provider + region;
- enabled AI provider/data flow, if applicable;
- actual retention/contract facts;
- payment/Store processor facts only if activated.

Do not infer these from pilot config.

Status:

`PRODUCTION_DATA_FLOW_VERIFY_REQUIRED`.

## 8. Social Signup consent contract

Exactly two required LOTBI documents:

1. `TERMS_OF_SERVICE`
2. `PRIVACY_POLICY`

Both require:

- `decision=ACCEPTED`
- `required=true`
- document version
- SHA-256
- HTTPS URI

No fake `consent_manifest_version`.

Current Production endpoint remains not deployed until future authorized Core deployment:

`GET /v2/sessions/providers/signup/consents`

## 9. Provider technical readiness

### Google

- Code: `GREEN BY REVIEW`
- Callback: `GREEN BY REVIEW`
- Scope: `openid`
- Identity: `sub`
- Privacy/Terms candidate: `READY FOR USER APPROVAL`
- Console step: `NOT YET`
- Real E2E: `PENDING`
- `GOOGLE_SCOPE_CONTRACT_VERIFY = OPEN`

### Kakao

- Code/callback: review-ready
- `sub` identity / no extra email/profile
- `KAKAO_PROVIDER_LIFECYCLE_BLOCKER — UNLINK + USER_ID DELETION/PURGE`

### NAVER

- Code/callback: review-ready
- `response.id` identity
- `NAVER_PROVIDER_LIFECYCLE_BLOCKER — TOKEN_REVOCATION / DISCONNECT`

### Apple

- LOGIN contract: ready by review
- SIGNUP: blocked
- LINK: blocked
- `APPLE_SOCIAL_AUTH_LIFECYCLE_BLOCKER`

## 10. Google Console gate — current definition

Before issuing:

`USER_ACTION_REQUIRED — GOOGLE STEP 1`

all of the following must be true:

1. user decides D1/D2;
2. Privacy/Terms final wording is approved;
3. Production data-flow/processor technical facts are verified and inserted;
4. final Site HTML is clean/frozen;
5. user explicitly approves Production publish;
6. Privacy/Terms are published and reverified;
7. final document versions/SHA-256/URIs are fixed;
8. Core Production Social Signup manifest is deployed/verified;
9. Account Production legal manifest is verified;
10. Google callback/branding/domain prerequisites are ready.

**External counsel certification is not required.**

Google real configured-client `openid` E2E remains required before final provider activation/Production GREEN.

## 11. Branch/CI boundary

Readiness branch:

`review/social-auth-provider-readiness-01-20260917`

This documentation branch does not receive a normal CI workflow run unless separately configured. Do not alter CI merely to manufacture a GREEN status.

No main promotion, Production publish, Production env change or Provider Console change is authorized by this document.

## 12. Current conclusion

`PRODUCTION PRIVACY = TECHNICALLY / POLICY READY FOR USER APPROVAL`

`PRODUCTION TERMS = TECHNICALLY / POLICY READY FOR USER APPROVAL`

`LEGAL_COUNSEL_REVIEW = OPTIONAL / RECOMMENDED / NOT HARD BLOCKER`

`PRODUCTION PUBLISH = PENDING USER APPROVAL`

`USER_ACTION_REQUIRED — GOOGLE STEP 1 = NOT YET`

Current Social Signup legal readiness is no longer blocked by absence of outside counsel. It remains pending D1/D2, Production data-flow verification, publish/hash/manifest work and Provider technical gates.