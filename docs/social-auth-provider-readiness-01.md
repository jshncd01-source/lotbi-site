# SOCIAL-AUTH-PROVIDER-READINESS-01

Research / verification date: 2026-09-17 (Asia/Seoul)

Current phase: `PRODUCTION PRIVACY / TERMS LEGAL REVIEW PACKAGE — COUNSEL READY`

## 1. Current status

- `INTERNAL READINESS BASELINE GREEN`
- `CORE SOCIAL REVIEW GREEN`
- `ACCOUNT WEB SOCIAL REVIEW GREEN`
- `ACTIVATION GATE GREEN BY REVIEW`
- `ACCOUNT BFF GREEN BY REVIEW`
- `CALLBACK CONTRACT GREEN BY REVIEW`
- `PROVIDER DATA MATRIX GREEN BY REVIEW`
- `FREE TASK PRODUCT POLICY CLOSED`
- `PRODUCTION PRIVACY CANDIDATE = COUNSEL-READY`
- `PRODUCTION TERMS CANDIDATE = COUNSEL-READY`
- `LEGAL QUESTIONNAIRE = READY (36 QUESTIONS)`
- `LEGAL DECISION MATRIX = READY`
- `OFFICIAL SOURCE REGISTER = READY`
- `PERSONAL DATA PROCESSING INVENTORY = COUNSEL-READY`
- `CROSS-REPO IMPLEMENTATION HANDOFF = READY`
- `LEGAL REVIEW COMPLETE = NO`
- `PRODUCTION LEGAL MANIFEST NOT DEPLOYED`
- `PRODUCTION PRIVACY NOT PUBLISHED`
- `PRODUCTION TERMS NOT PUBLISHED`
- `PROVIDER REAL E2E PENDING`
- `PROVIDER SUBMISSION NOT READY`
- `MAIN NOT PROMOTED BY THIS WORK`
- `PRODUCTION NOT CHANGED BY THIS WORK`

`PRODUCT_POLICY_CONFIRMATION_REQUIRED — FREE_TASK_DEFINITION_AND_RESET = CLOSED`.

`PRODUCTION SOCIAL SIGNUP LEGAL MANIFEST READINESS = BLOCKED / NOT GREEN`.

`USER_ACTION_REQUIRED — GOOGLE STEP 1 = NOT YET`.

## 2. Implementation baselines

- Core main supplied baseline: `23d6c99658704a84a09c3edd7b3474a1db77387b`
- Core Social review: `b555420b8d75c9e241a6cd9bd534f205499a87d8`
- Account main supplied baseline: `9cec0b958d22b566f9312521670c7d82d0740e41`
- Account Social review: `5eadea164d559a4f3c45dfca18d6c2acf95a40c0`
- Social contract: `LOTBI_SOCIAL_AUTH_V2`

This readiness branch documents reviewed contracts and counsel-preparation only. It does not promote Core/Account/Site main or enable Production Social Auth.

## 3. Counsel package

Authoritative counsel package files:

- `docs/production-legal-review-package.md`
- `docs/production-legal-review-questionnaire.md`
- `docs/production-legal-review-decisions.md`
- `docs/production-legal-official-source-register.md`
- `docs/production-personal-data-processing-inventory.md`
- `docs/production-privacy-candidate.md`
- `docs/production-terms-candidate.md`
- `docs/production-legal-readiness-decision-matrix.md`
- `docs/production-legal-manifest-implementation-handoff.md`

The package separates:

- `[TECHNICALLY VERIFIED]`
- `[LEGAL REVIEW REQUIRED]`
- `[USER DECISION REQUIRED]`
- `[PLACEHOLDER — DO NOT PUBLISH]`

It is designed so counsel can return a legal decision without guessing LOTBI's Social/Auth/product facts.

## 4. Public Production status remains unchanged

Current public Privacy:

`https://lotbiai.com/privacy.html`

remains the 2026-09-14 pre-release/static-site notice and is not the counsel-ready candidate.

Current public Terms:

`https://lotbiai.com/terms.html`

remains the pre-release `웹사이트 이용안내` and is not the counsel-ready candidate.

Current account-deletion guidance remains:

`https://lotbiai.com/account-deletion.html`

and correctly avoids promising immediate hard delete.

The reviewed Core Social Signup legal-manifest endpoint is not yet deployed to Production; current Production previously verified as returning 404 at:

`GET https://api.lotbiai.com/v2/sessions/providers/signup/consents`

No candidate document is Production authoritative until legal approval, final HTML freeze/hash and explicit user publish approval.

## 5. Current business information verified from Site

- 운영회사: 유한회사 알에이디홀딩스
- 대표자: 전선혜
- 주소: 전북특별자치도 전주시 덕진구 혁신로 542, 1동 1층 (여의동)
- 사업자등록번호: 583-88-03679
- 통신판매업신고번호: 2026-전주덕진-0798
- email: `developer@lotbiai.com`
- 대표전화: `063-237-0930`

Privacy officer/department is **not** inferred from these general company fields.

Status:

`PRIVACY_OFFICER_OR_DEPARTMENT = USER DECISION REQUIRED AFTER COUNSEL Q16`.

## 6. Social Signup consent manifest contract retained

Required LOTBI consents remain exactly:

1. `TERMS_OF_SERVICE`
2. `PRIVACY_POLICY`

Each document requires:

- `document_version`
- `document_sha256`
- `document_uri`

No separate `consent_manifest_version` is created.

Core continues to require both accepted/required consents and server-owned manifest equality. Account Web continues to fail closed without both.

Final canonical URIs remain:

- Terms `https://lotbiai.com/terms.html`
- Privacy `https://lotbiai.com/privacy.html`

Authoritative SHA-256 values remain `PENDING` until counsel-approved exact final HTML is frozen.

## 7. Provider minimum data contract retained

| Provider | Reviewed scope/input | Canonical identity | Provider email/name/profile |
|---|---|---|---|
| Google | `openid` | OIDC `sub` | unused |
| Kakao | `openid` | OIDC `sub` | unused |
| NAVER | `openid` | official app-scoped `response.id` | additional profile unused |
| Apple | no email/name profile scope | Apple `sub` | relay email/full name unused |

User-direct signup data remains LOTBI name + account handle.

Provider data not needed by this minimum contract must not be requested for review convenience.

## 8. Legal review decision status A-P

All 16 previous `LEGAL_REVIEW_REQUIRED` items are now **decision-ready**, not legally closed.

- A `THIRD_PARTY_PROCESSING_AND_OVERSEAS_TRANSFER` — ready for counsel Q01-Q04
- B `PROVIDER_SUBJECT_RETENTION_BASIS_AND_PERIOD` — ready for counsel Q05-Q07
- C `STATUTORY_RETENTION_ITEMS_AND_PERIODS` — ready for counsel Q08-Q10
- D `MINOR_POLICY` — counsel Q11-Q13 then user decision
- E `PRODUCTION_PURGE_PERIOD` — counsel Q14-Q15
- F `PRIVACY_OFFICER_OR_DEPARTMENT` — counsel Q16 then user/corporate designation
- G `CONTRACT_FORMATION_TIME` — counsel Q17-Q18
- H `LOTBI_PLUS_SUBSCRIPTION_TERMS` — counsel Q19-Q24
- I `COMMERCE_ROLE_AND_RESPONSIBILITY` — counsel Q25-Q27
- J `DELETION_RETENTION_AND_PROVIDER_LIFECYCLE` — counsel Q28-Q29 + technical blockers
- K `SUSPENSION_NOTICE_AND_REMEDY` — counsel Q30
- L `SERVICE_CHANGE_NOTICE_AND_LIABILITY` — counsel Q31
- M `TERMS_CHANGE_NOTICE` — counsel Q32
- N `LIABILITY_DISPUTE_JURISDICTION` — counsel Q33
- O `OPERATOR_DISCLOSURE_FIELDS` — counsel Q34
- P `FINAL_DOCUMENT_EFFECTIVE_DATES` — counsel Q35-Q36

`LEGAL REVIEW COMPLETE = NO` until approved decisions are returned and recorded.

## 9. User decisions held, not guessed

After counsel input, the user/company still needs to choose or formally designate:

- v1 under-14 policy/age-gate approach
- privacy officer or privacy department
- Plus cancellation effective-time policy per channel
- Plus payment-failure/grace entitlement policy
- Provider-specific remote revoke policy on unlink where product choice remains, including Apple unlink policy

No placeholder is filled with invented personal/company data.

## 10. Provider lifecycle blockers retained

### Google

- code/callback reviewed ready
- scope `openid`
- `GOOGLE_SCOPE_CONTRACT_VERIFY = OPEN`
- real configured-client E2E pending
- Console readiness remains blocked on legal/manifest/E2E gate

### Kakao

`KAKAO_PROVIDER_LIFECYCLE_BLOCKER — UNLINK + USER_ID DELETION/PURGE POLICY REQUIRED`

### NAVER

`NAVER_PROVIDER_LIFECYCLE_BLOCKER — TOKEN_REVOCATION/DISCONNECT INTEGRATION VERIFY`

### Apple

- LOGIN contract reviewed ready
- SIGNUP/LINK blocked
- `APPLE_SOCIAL_AUTH_LIFECYCLE_BLOCKER`

Legal review does not overwrite any technical blocker.

## 11. FREE / Plus product facts

FREE authoritative contract remains:

- monthly 3 successful tasks
- successful final result only = charge
- same-task clarification no extra charge
- LOCAL/failure/cancel/incomplete = no charge
- same-task retry max one charge
- reset day 1 00:00 KST
- no carry-over
- append-only/auditable compensation

LOTBI Plus remains:

- monthly 9,900 KRW
- Web Toss Payments
- iPhone App Store
- Android Google Play
- not documented as unlimited general AI usage

Final renewal/cancellation/refund/cooling-off/grace/Store entitlement terms remain Q19-Q24 legal/product decisions.

## 12. Infrastructure/data-flow caution

The counsel package intentionally does not infer final overseas/processor classification from technology names.

Example: Core repo contains a Render **pilot** blueprint using Singapore; that is not accepted as evidence of current Production hosting/DB/log/backup region. Counsel may require engineering to return the actual Production data-flow manifest before Q01-Q04 can fully close.

FREE usage/subscription/payment schema is also not falsely represented as currently implemented if the reviewed Core schema has not established it.

## 13. CI/change boundary

Readiness branch:

`review/social-auth-provider-readiness-01-20260917`

The existing Site workflow is not configured for this branch; do not alter CI triggers merely to create a GREEN run.

No Core main, Account main, Site main, Production env, Provider Console, OAuth credential, secret or Provider activation change is authorized by this package.

## 14. Next gate

The only next user action from this room is to send the counsel package to a qualified legal professional and obtain decisions for Q01-Q36.

Current:

`USER_ACTION_REQUIRED — LEGAL REVIEW STEP 1`

Google Console remains:

`USER_ACTION_REQUIRED — GOOGLE STEP 1 = NOT YET`

After counsel decisions → user decisions → approved wording → final Site HTML freeze/hash → explicit user Production publish approval → Core consent manifest → Account Production verification → Google real `openid` E2E → then and only then Google Console action.
