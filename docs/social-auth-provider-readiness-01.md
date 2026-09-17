# SOCIAL-AUTH-PROVIDER-READINESS-01

Research date: 2026-09-17 (Asia/Seoul)

Status:

- `FIRST READINESS REVIEW GREEN`
- `DOCUMENT PREPARATION IN PROGRESS`
- `PRIVACY UPDATE REQUIRED`
- `TERMS UPDATE REQUIRED`
- `LEGAL REVIEW REQUIRED`
- `PROVIDER SUBMISSION NOT READY`
- `MAIN NOT PROMOTED`
- `PRODUCTION NOT CHANGED`

This is an internal readiness record. It does not authorize Provider submission, Production OAuth activation, secret creation/registration, Apple identifier/key changes, Core modification, or main promotion.

## 1. Scope and safety boundary

This work owns only:

- current Provider requirements research;
- policy/consent consistency;
- brand assets/readiness;
- homepage/policy/support URL readiness;
- Provider data-minimization matrix;
- callback contract discovery;
- signup/login/unlink/deletion evidence requirements;
- Core blocker handoff documentation.

Out of scope:

- real OAuth/OIDC Production integration changes;
- Provider secret/key creation;
- Production env/credential changes;
- Google/Kakao/NAVER/Apple external submission;
- Core main promotion;
- Apple private-key generation/exposure.

## 2. LOTBI canonical service baseline

- Service: `LOTBI`
- Homepage: `https://lotbiai.com`
- Account Web: `https://account.lotbiai.com`
- API: `https://api.lotbiai.com`
- Admin: `https://admin.lotbiai.com`
- iOS target Bundle ID: `com.lotbiai.app`
- Android package: `com.lotbiai.app`
- Support/privacy contact: `developer@lotbiai.com`
- `app.lotbiai.com`: not an approved LOTBI host; do not invent/register it.

Brand assets available in `lotbi-site`:

- `assets/lotbi-logo-header.png`
- `assets/lotbi-main-logo.png`
- `assets/lotbi-og-share.png`

## 3. Public-policy baseline

### Homepage

Public LOTBI homepage is reachable without login and identifies the service. It provides navigation to Privacy, Terms/use notice, Account Deletion and Contact.

Status: `REVIEW_READY_CONTENT`.

### Privacy

Current public `privacy.html` is still a pre-release/static-site policy and is not sufficient as the final Social Login/Production privacy policy.

A Core-aligned review draft now exists at:

`docs/privacy-social-login-review-draft.md`

It covers:

- Google/Kakao/NAVER/Apple;
- stable provider subject/identifier usage;
- current non-use of Provider email/name/profile as Social identity;
- external identity lifecycle;
- Social unlink;
- LOTBI account deletion;
- final purge;
- Provider authorization revoke as a separate lifecycle;
- provider-subject reservation/retention boundary.

Status: `REVIEW DRAFT READY / PUBLIC UPDATE REQUIRED / LEGAL_REVIEW_REQUIRED`.

### Terms

Current public `terms.html` remains a pre-release website use notice, not final Production LOTBI Terms.

A Production-service review draft now exists at:

`docs/terms-social-auth-review-draft.md`

It covers:

- LOTBI account;
- external login services;
- Provider outages/policy changes;
- link/unlink;
- member deletion;
- service interruption;
- LOTBI Plus separation;
- external Merchant transactions vs LOTBI-owned paid services;
- legal-review boundaries.

Status: `REVIEW DRAFT READY / PUBLIC UPDATE REQUIRED / LEGAL_REVIEW_REQUIRED`.

### Account deletion

Current public Account Deletion guidance points users toward the actual Account Web/Core lifecycle and does not falsely promise immediate hard deletion.

Status: `REVIEW_READY`, subject to final Production purge/Provider-revoke alignment.

### Support

Public support/privacy/account contact exists.

Status: `READY`.

## 4. Authoritative Core Social Auth contract

Current authoritative implementation baseline is `lotbi-core/main`, contract `LOTBI_SOCIAL_AUTH_V2`.

Key facts:

- Web uses Core-owned authorization-code Provider redirects.
- Android/iOS use official Provider SDK tokens and Core native Social Auth endpoints; native does not reuse the Web callback.
- Social LOGIN starts at `FEDERATED_LIMITED` and requires Passkey step-up for FULL assurance.
- Social SIGNUP requires LOTBI `TERMS_OF_SERVICE` and `PRIVACY_POLICY` consent, then first Passkey enrollment.
- canonical external identity is Provider + stable Provider subject/identifier.
- Provider email is not an account key.
- same-email accounts are not auto-linked.
- Provider subject cannot silently migrate to another LOTBI user.

## 5. Provider data matrix

| Provider | Stable subject / identifier | Email | Name | Profile | Other personal data |
|---|---|---|---|---|---|
| Google | `REQUIRED` — OIDC `sub` | `UNUSED` | `UNUSED` | `UNUSED` | `UNUSED` under current identity model |
| Kakao | `REQUIRED` — OIDC `sub` | `UNUSED` | `UNUSED` | `UNUSED` | `UNUSED` under current identity model |
| NAVER | `REQUIRED` — profile `response.id` | `UNUSED` | `UNUSED` | `UNUSED` | `UNUSED` under current identity model |
| Apple | `REQUIRED` when lifecycle-enabled — Apple `sub` | `UNUSED` | `UNUSED` | `UNUSED` | no private-relay/full-name dependency in current Core |

Detailed matrix/lifecycle record:

`docs/provider-data-lifecycle-matrix.md`

Policy: LOTBI does not request information it does not actually use merely for Provider review.

## 6. Google scope final readiness assessment

Current Core Web authorization uses `scope=openid` only.

Official Google scope documentation lists:

- `openid`
- `email`
- `profile`

as separate scopes.

Therefore this readiness project does **not** conclude that `openid`-only is wrong merely because `email` or `profile` are absent.

At the same time, Google's current OIDC authorization reference describes its scope parameter for the documented OIDC flow as beginning with `openid` and including `profile`, `email`, or both. The correct LOTBI conclusion is therefore not to guess, but to verify the minimum current Core flow using a valid configured Google OAuth client.

Current Core already implements local checks for:

- stable `sub`;
- Google issuer;
- configured audience and `azp` when needed;
- nonce;
- state/binding;
- exact callback contract;
- PKCE S256;
- replay protection;
- token lifetime.

Still missing before closing the blocker:

- real authorization request acceptance with the minimum scope;
- real authorization-code callback;
- token exchange;
- ID-token issuance;
- successful current Google consent configuration/E2E.

No scope expansion is authorized from this readiness room.

Status:

`CORE_SOCIAL_AUTH_BLOCKER — GOOGLE_SCOPE_CONTRACT_VERIFY`

Detailed handoff:

`docs/google-scope-contract-verification.md`

## 7. Callback URI assessment

Core obtains exact Provider Web redirect URI from:

`LOTBI_SOCIAL_<PROVIDER>_WEB_REDIRECT_URI`

Core tests use an example pattern under `https://account.lotbiai.com/auth/web/<provider>/callback`, but that pattern is test-fixture data and is not sufficient to declare the Production callback authoritative.

The inspected Account Web Social Signup review branch does not yet own/implement the complete Provider callback transport needed to close that contract.

Therefore:

| Provider | Authoritative callback URI | Status |
|---|---|---|
| Google | not yet fixed | `CALLBACK_PENDING_INTEGRATION` |
| Kakao | not yet fixed | `CALLBACK_PENDING_INTEGRATION` |
| NAVER | not yet fixed | `CALLBACK_PENDING_INTEGRATION` |
| Apple | not yet fixed | `CALLBACK_PENDING_INTEGRATION` |

No guessed Provider callback may be registered.

Detailed closure rules:

`docs/callback-contract-readiness.md`

## 8. Identity/deletion/revocation lifecycle matrix

These four operations remain separate:

| Operation | Current Core meaning | Remote Provider action |
|---|---|---|
| A. Social Login unlink | Keep LOTBI account; local external identity -> `REVOKED`; subject reservation retained | generic unlink: NO remote revoke |
| B. LOTBI account deletion request | revoke account access/authority and local Provider links; enter deletion lifecycle | Provider revoke handled separately |
| C. LOTBI final purge | separate operational erasure workflow with legal/security retention exceptions | not itself a Provider operation |
| D. Provider authorization revoke | Provider-specific token/authorization lifecycle | changes Provider-side authorization state |

The current local Core default purge configuration is 30 days, but the actual Production value has not been verified. Do not publish a fixed 30-day policy from this readiness evidence alone.

The exact legal basis/period for retaining or transforming a revoked/reserved provider subject remains unresolved.

## 9. Apple revocation Core blocker handoff

Apple LOGIN verification preparation exists, but Apple SIGNUP/LINK remains intentionally fail-closed with:

`EXTERNAL_APPLE_REVOCATION_REQUIRED`

Current Apple code exchange verifies an ID token but does not retain access/refresh token as durable later revocation material. Therefore an account created/linked with Sign in with Apple cannot yet guarantee the required provider-side revoke-on-LOTBI-account-deletion lifecycle.

Required integration work includes:

- approved encrypted provider-token/revocation-material vault;
- no plaintext token/key/client-secret logging;
- Apple revoke-on-LOTBI-account-deletion;
- retry/idempotency/unknown-state reconciliation;
- Apple client-secret/private-key server-side secret boundary;
- Apple server-to-server account-change notification validation/reconciliation;
- tests and real Apple development/sandbox evidence.

Generic LOTBI unlink is local-only today. Whether Apple-specific unlink should also remotely revoke authorization is a separate decision:

`USER_DECISION_REQUIRED — APPLE_UNLINK_REMOTE_REVOKE_POLICY`

Detailed Core handoff:

`docs/core-social-auth-blocker-apple-revocation-lifecycle.md`

## 10. Provider readiness

### GOOGLE

- Homepage: `READY CONTENT`
- Support: `READY`
- Branding source assets: `READY FOR FORMAT ADAPTATION`
- Data model: `READY — MINIMUM SUBJECT-ONLY INTENT`
- Scope: `GOOGLE_SCOPE_CONTRACT_VERIFY`
- Callback: `CALLBACK_PENDING_INTEGRATION`
- Privacy: `REVIEW DRAFT READY / LEGAL REVIEW REQUIRED`
- Terms: `REVIEW DRAFT READY / LEGAL REVIEW REQUIRED`
- Domain/ownership requirement: `DOCUMENTED / USER ACTION LATER`
- Real Provider E2E: `NOT VERIFIED`
- Submission: `NOT SUBMITTED`

### KAKAO

- Data minimization: `READY`
- Additional profile permission: `NOT NEEDED UNDER CURRENT MODEL`
- Callback: `CALLBACK_PENDING_INTEGRATION`
- Privacy/Terms consistency: `REVIEW DRAFT READY / LEGAL REVIEW REQUIRED`
- Real Provider E2E: `NOT VERIFIED`
- Review/additional-permission submission: `NOT SUBMITTED`

### NAVER

- canonical identity: app-scoped `response.id`
- Data minimization: `READY`
- Additional profile fields: `NOT NEEDED UNDER CURRENT MODEL`
- Callback: `CALLBACK_PENDING_INTEGRATION`
- Pre-review evidence: `WAITING FOR WORKING E2E`
- Submission: `NOT SUBMITTED`

### APPLE

- basic App ID/Services ID requirements: `DOCUMENTED`
- email/full-name dependency: `NONE UNDER CURRENT CORE`
- Callback: `CALLBACK_PENDING_INTEGRATION`
- Apple SIGNUP/LINK: `BLOCKED — APPLE_REVOCATION_LIFECYCLE`
- Identifier/key actual changes: `NOT PERFORMED`
- Real Provider E2E: `NOT VERIFIED`
- External action/submission: `NOT PERFORMED`

## 11. Core blocker handoff list

### `CORE_SOCIAL_AUTH_BLOCKER — GOOGLE_SCOPE_CONTRACT_VERIFY`

Owner: Social Login integration workstream.

Need valid configured Google client E2E for minimum scope before scope expansion or submission.

### `CORE_SOCIAL_AUTH_BLOCKER — APPLE_REVOCATION_LIFECYCLE`

Owner: Social Login integration/Core workstream.

Need encrypted revocation material, revoke-on-account-deletion, secret boundary, notifications/reconciliation and tests before Apple SIGNUP/LINK activation.

### `CALLBACK_PENDING_INTEGRATION`

Owner: Social Login integration workstream.

Applies to Google/Kakao/NAVER/Apple Web until one exact deployed callback per Provider is implemented and evidenced.

## 12. LEGAL_REVIEW_REQUIRED

- overseas-transfer classification/disclosure for each Provider relationship;
- third-party provision vs entrusted processing vs other lawful characterization;
- exact revoked/reserved provider-subject retention basis and period;
- statutory transaction/audit retention periods;
- under-14/minor account policy and guardian consent;
- final public purge timing;
- Production Terms: limitation of liability, service interruption, termination, dispute/jurisdiction;
- LOTBI's legal role for Merchant transactions / commerce intermediation;
- LOTBI Plus subscription/refund/renewal terms if included at launch.

## 13. USER_DECISION_REQUIRED

Current internal decisions that cannot be silently invented:

1. `APPLE_UNLINK_REMOTE_REVOKE_POLICY` — when a user keeps the LOTBI account but unlinks Apple, should LOTBI also revoke Apple authorization remotely, or only perform the current local unlink?
2. `LOTBI_PLUS_COMMERCIAL_TERMS` — if Plus is part of launch scope, actual paid features, sales channel, renewal, cancellation and refund model must be supplied before final Terms.
3. Minor eligibility policy, if not resolved through legal review/business policy.

These do not authorize external Provider action.

## 14. CI / verification boundary

Current `lotbi-site` workflow push triggers do not include `review/social-auth-provider-readiness-01-20260917`.

Do not edit CI triggers merely to make this documentation branch run automatically.

Required final reporting status unless an existing workflow is explicitly run by another authorized mechanism:

`CI = NOT CONFIGURED FOR THIS REVIEW BRANCH`

Local/static document validation may be reported separately and must not be mislabeled as CI.

## 15. External submission stop rule

Still prohibited:

- Google Console Production submission/verification;
- Kakao review/application;
- NAVER review application;
- Apple Developer Identifier/Services ID/key changes;
- Production credential generation;
- secret registration;
- OAuth Production activation;
- main promotion.

## 16. USER_ACTION gate

Do not issue:

`USER_ACTION_REQUIRED — GOOGLE STEP 1`

until all of the following are ready:

- authoritative Google callback fixed;
- Privacy review draft complete and legal gaps isolated;
- Terms review draft complete and legal gaps isolated;
- Google minimum scope live contract verified;
- Google branding material prepared to current console format;
- homepage/policy/support URLs ready;
- Google domain requirement documented;
- Google client/secret requirement list documented without secret values.

Current status:

`USER_ACTION_REQUIRED = NOT YET`

## 17. Current readiness conclusion

`SOCIAL-AUTH-PROVIDER-READINESS-01 = INTERNAL DOCUMENT READINESS ADVANCED`

The policy/data/lifecycle documentation is materially prepared, but Provider submission readiness is **not** closed because callback integration, Google minimum-scope live E2E, Apple revocation lifecycle, final legal review and real Provider evidence remain outstanding.
