# SOCIAL-AUTH-PROVIDER-READINESS-01

Research / verification date: 2026-09-17 (Asia/Seoul)

Current phase: `PRODUCTION SOCIAL SIGNUP LEGAL MANIFEST READINESS VERIFY`

## 1. Current status

- `INTERNAL READINESS BASELINE GREEN`
- `CORE SOCIAL REVIEW GREEN`
- `ACCOUNT WEB SOCIAL REVIEW GREEN`
- `ACTIVATION GATE GREEN BY REVIEW`
- `ACCOUNT BFF GREEN BY REVIEW`
- `CALLBACK CONTRACT GREEN BY REVIEW`
- `PROVIDER DATA MATRIX GREEN BY REVIEW`
- `PRIVACY REVIEW DRAFT UPDATED`
- `TERMS REVIEW DRAFT UPDATED`
- `PRODUCTION LEGAL MANIFEST NOT DEPLOYED`
- `PRODUCTION PRIVACY NOT SOCIAL-AUTH READY`
- `PRODUCTION TERMS NOT SOCIAL-AUTH READY`
- `PROVIDER REAL E2E PENDING`
- `PROVIDER SUBMISSION NOT READY`
- `MAIN NOT PROMOTED BY THIS WORK`
- `PRODUCTION NOT CHANGED BY THIS WORK`

`PRODUCTION SOCIAL SIGNUP LEGAL MANIFEST READINESS = NOT GREEN / BLOCKED`.

## 2. Implementation baselines

- Core main supplied baseline: `23d6c99658704a84a09c3edd7b3474a1db77387b`
- Core Social review: `b555420b8d75c9e241a6cd9bd534f205499a87d8`
- Account main supplied baseline: `9cec0b958d22b566f9312521670c7d82d0740e41`
- Account Social review: `5eadea164d559a4f3c45dfca18d6c2acf95a40c0`
- Social contract: `LOTBI_SOCIAL_AUTH_V2`

This readiness branch documents the reviewed contract only. It does not promote those review branches or enable Production Social Auth.

## 3. Public LOTBI legal URLs

- Homepage: `https://lotbiai.com/`
- Privacy: `https://lotbiai.com/privacy.html`
- Terms: `https://lotbiai.com/terms.html`
- Account deletion: `https://lotbiai.com/account-deletion.html`
- Account Web: `https://account.lotbiai.com`
- Support: `developer@lotbiai.com`

The public Privacy and Terms URLs are HTTPS and accessible without login. Their source includes a mobile viewport. However content readiness is separate from URL accessibility.

### Production Privacy finding

Current public Privacy is the 2026-09-14 **pre-release version** and says the public website is a static introduction site that does not provide signup/payment/location/voice input and that the policy will be updated before the full service starts processing those data.

This conflicts with a Production Social Signup launch manifest.

Status: `PRIVACY URL ACCESS = GREEN / CONTENT = UPDATE REQUIRED`.

### Production Terms finding

Current public Terms URL is titled/structured as `LOTBI 웹사이트 이용안내` / pre-release website notice, not final Production service Terms covering LOTBI account/Social Login/Plus/transaction relationships.

Status: `TERMS URL ACCESS = GREEN / CONTENT = UPDATE REQUIRED`.

### Account deletion finding

Current public account-deletion page points to the real Account Web deletion process and Core receipt/purge model and does not falsely claim immediate hard deletion.

Status: `LOCAL DELETION GUIDANCE = REVIEW READY`, while Provider-specific remote lifecycle still has blockers for Kakao/NAVER/Apple.

## 4. Social Signup consent manifest contract

Social Signup requires exactly two LOTBI-owned required consents:

1. `TERMS_OF_SERVICE`
2. `PRIVACY_POLICY`

Core owns the legal manifest. For both documents it requires configured:

- document version;
- SHA-256;
- HTTPS URI.

The values are not hardcoded defaults. Missing/malformed configuration fails closed.

Core Social Signup requires exactly two consent records and verifies:

- manifest key;
- version;
- SHA-256;
- URI;
- decision `ACCEPTED`;
- `required=true`;
- locale.

Core stores `UserConsentRecord` with `source=SOCIAL_SIGNUP`, installation/provider/flow evidence and `server_manifest_verified=true`.

Account Web obtains the manifest from Core. Its Social Signup UI displays two separate required checkboxes and does not enable account creation without both. Browser input cannot invent document version/hash.

### Production manifest finding

The reviewed endpoint is `GET /v2/sessions/providers/signup/consents`, but the current Production endpoint is not deployed/reachable as that reviewed contract. Therefore actual Production document versions/SHA-256/URIs cannot be declared from review code alone.

Status: `PRODUCTION SOCIAL SIGNUP CONSENT MANIFEST = NOT DEPLOYED`.

## 5. Actual Social Signup data contract

### Provider data

| Provider | Reviewed Web scope | Canonical identity | Provider email/name/profile |
|---|---|---|---|
| Google | `openid` | OIDC `sub` | unused |
| Kakao | `openid` | OIDC `sub` | unused |
| NAVER | `openid` | official profile `response.id` | additional profile fields unused |
| Apple | no email/name profile scope | Apple `sub` | email/private relay/full name unused |

Provider data not used by the current minimum contract must not be requested for review convenience.

### User-direct LOTBI signup data

After Provider verification, the user directly enters:

- LOTBI display name;
- LOTBI account handle/username.

The handle uses the existing Consumer Username Policy.

Reviewed provisioning stores Provider + `provider_subject`, but Provider email remains `None`, Provider profile remains `{}`, and any external-identity display name comes from the user-entered LOTBI name rather than Provider profile import.

Signup also creates/stores the normal account-security/evidence lifecycle: installation/session, Passkey enrollment, required consent evidence, recovery path/audit evidence according to the existing account contract.

## 6. LOGIN / SIGNUP / LINK

- LOGIN: existing external identity, `FEDERATED_LIMITED` then Passkey step-up to FULL.
- SIGNUP: Provider verification -> LOTBI name/handle + required legal consents -> account creation -> first Passkey enrollment.
- LINK: existing FULL LOTBI account plus fresh proof; separate from signup.

Same email never silently auto-links accounts. Provider subject cannot silently move to a different LOTBI user.

Apple LOGIN contract is ready by review; Apple SIGNUP/LINK remains blocked.

## 7. Exact reviewed Web callback contract

| Provider | Exact callback |
|---|---|
| Google | `https://account.lotbiai.com/api/auth/providers/google/callback` |
| Kakao | `https://account.lotbiai.com/api/auth/providers/kakao/callback` |
| NAVER | `https://account.lotbiai.com/api/auth/providers/naver/callback` |
| Apple | `https://account.lotbiai.com/api/auth/providers/apple/callback` |

Account Web fails closed unless Core returns this exact canonical callback, Web configuration is ready, provider-scoped Production activation is true and the requested purpose is enabled. SIGNUP additionally requires the consent manifest.

Status split:
- review-code callback contract: `GREEN`
- Provider Console registration: `NOT PERFORMED`
- Production provider env/activation: `UNCHANGED`
- real callback E2E: `PENDING`

## 8. Account unlink / deletion / purge / Provider revoke

These are four separate operations.

| Operation | LOTBI local behavior | Provider-side behavior |
|---|---|---|
| Social Login unlink | external identity -> local `REVOKED`; LOTBI account retained; unique subject reservation retained | current generic path has no remote revoke |
| LOTBI account deletion | access/authority and local external links revoked; deletion lifecycle starts | provider-specific disconnect/revoke handled separately |
| final purge | separate operational erasure with lawful/security retention exceptions | not inherently a Provider API call |
| Provider revoke/unlink | provider authorization relationship ended | provider-specific implementation |

Core local purge default is 30 days, but actual Production setting/legal retention model has not been verified; do not publish a fixed 30-day promise.

`provider_subject` retention basis/period after revoke/deletion remains `LEGAL_REVIEW_REQUIRED`.

## 9. Provider-specific readiness

### GOOGLE

- Code: `GREEN BY REVIEW`
- Callback: `GREEN BY REVIEW` — exact URL fixed
- Scope: `openid`
- Provider profile data: email/name/profile unused
- Privacy: `BLOCKED — PUBLIC CONTENT UPDATE REQUIRED`
- Terms: `BLOCKED — PUBLIC CONTENT UPDATE REQUIRED`
- Consent Manifest: `BLOCKED — PRODUCTION MANIFEST NOT DEPLOYED`
- Account Deletion: local LOTBI flow documented
- Domain/branding requirements: documented
- Real Provider E2E: `PENDING`
- Scope live verification: `GOOGLE_SCOPE_CONTRACT_VERIFY`
- Console Readiness: `BLOCKED`
- Final: `BLOCKED / USER_ACTION_REQUIRED NOT YET`

### KAKAO

- Code: `GREEN BY REVIEW`
- Callback: `GREEN BY REVIEW`
- Scope: `openid`
- Provider profile data: email/profile unused
- Privacy/Terms: `BLOCKED ON PRODUCTION DOCUMENTS`
- Consent Manifest: `NOT DEPLOYED`
- Real Provider E2E: `PENDING`
- Provider lifecycle: official Kakao documentation requires service account deletion/unmapping to include Kakao Unlink; current generic LOTBI unlink is local-only
- Lifecycle blocker: `KAKAO_PROVIDER_LIFECYCLE_BLOCKER — UNLINK/ACCOUNT_DELETION INTEGRATION REQUIRED`
- Final: `BLOCKED`

### NAVER

- Code: `GREEN BY REVIEW`
- Callback: `GREEN BY REVIEW`
- Scope: `openid`
- identity: profile `response.id`
- additional profile data: unused
- Privacy/Terms: `BLOCKED ON PRODUCTION DOCUMENTS`
- Consent Manifest: `NOT DEPLOYED`
- Real Provider E2E/pre-review evidence: `PENDING`
- Provider lifecycle: official NAVER documentation describes Token Revocation for service withdrawal/link termination and disconnect notification handling
- Lifecycle blocker: `NAVER_PROVIDER_LIFECYCLE_BLOCKER — TOKEN_REVOCATION/DISCONNECT INTEGRATION VERIFY`
- Pre-review: `NOT SUBMITTED`
- Final: `BLOCKED`

### APPLE

- LOGIN: `READY BY REVIEW`
- SIGNUP: `BLOCKED`
- LINK: `BLOCKED`
- Callback: `GREEN BY REVIEW`
- email/private relay/full name dependency: none under current contract
- Lifecycle blocker: `APPLE_SOCIAL_AUTH_LIFECYCLE_BLOCKER`
- Required closure: protected revocation token lifecycle, Apple revoke on explicit Apple unlink and account deletion, retry/reconciliation, S2S lifecycle handling, migration/security tests, real Apple E2E
- Identifier/key change: `NOT PERFORMED`
- Final: `LOGIN CONTRACT READY / SIGNUP+LINK BLOCKED`

## 10. LOTBI Plus and external Merchant separation

Confirmed product baseline:

- `LOTBI Plus`
- monthly `9,900원`
- FREE = monthly `3개 작업`
- Web = Toss Payments
- iPhone = Apple subscription
- Android = Google Play subscription
- V1 Web targets: credit/debit card, account-based autopay, TossPay recurring
- V2 candidates: KakaoPay recurring, Apple Pay recurring

Status: `LOTBI_PLUS_COMMERCIAL_TERMS = PARTIALLY DECIDED / LEGAL REVIEW REQUIRED FOR FINAL TERMS`.

Still requires legal/final wording for auto-renewal notice, cancellation effective time, refunds, withdrawal/digital-service treatment and Provider refund vs LOTBI entitlement.

LOTBI Plus subscription fees must remain separate from external Merchant shopping/reservation/travel/service transaction money. Current policy draft does not describe LOTBI as receiving/settling external Merchant sales proceeds merely because Transaction Kernel controls execution safeguards.

## 11. LEGAL_REVIEW_REQUIRED

- overseas transfer classification/disclosure;
- third-party provision / entrusted processing / other legal classification;
- provider-subject retention basis/period;
- statutory audit/transaction retention;
- under-14/minor policy;
- actual Production purge period;
- external Merchant responsibility/intermediation legal role;
- Plus auto-renewal/cancellation/refund/cooling-off final wording;
- final Provider-specific deletion/unlink disclosure after lifecycle implementation.

## 12. CI / change boundary

Readiness branch: `review/social-auth-provider-readiness-01-20260917`.

The existing `lotbi-site` push workflow does not target this branch. Do not edit workflow triggers merely to manufacture a CI run.

Status: `CI = NOT CONFIGURED FOR THIS REVIEW BRANCH` unless separately changed by evidence after this record.

No Core main or Account main edit is authorized/performed from this readiness branch. No Production deploy or Provider Console change is performed.

## 13. USER ACTION gate

Do not issue `USER_ACTION_REQUIRED — GOOGLE STEP 1` until, at minimum:

- Production Privacy is updated and legally reviewed as required;
- Production Terms is updated and legally reviewed as required;
- Production Social Signup manifest is deployed and its version/SHA256/URI match the published documents;
- Google `openid` real E2E is verified;
- callback/branding/domain/credential requirements are ready;
- Core/Account Production remains fail-closed until explicitly authorized activation.

Current: `USER_ACTION_REQUIRED = NOT YET`.

## 14. Current conclusion

`PRODUCTION SOCIAL SIGNUP LEGAL MANIFEST READINESS = BLOCKED / NOT GREEN`

The reviewed code contract is materially ready, but the actual Production legal pages/manifest and Provider lifecycle/E2E requirements are not yet aligned enough for Provider Console submission.
