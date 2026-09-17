# LOTBI Social Login Provider 제출 준비 체크리스트

Research date: 2026-09-17 (Asia/Seoul)

Status: `PREPARATION ONLY / PROVIDER SUBMISSION NOT READY`

No Provider Console change, Production credential creation/registration, Production activation, or main promotion is authorized by this document.

Implementation baselines:
- Core Social review: `b555420b8d75c9e241a6cd9bd534f205499a87d8`
- Account Social review: `5eadea164d559a4f3c45dfca18d6c2acf95a40c0`

## Shared LOTBI baseline

- Service: `LOTBI`
- Homepage: `https://lotbiai.com`
- Account: `https://account.lotbiai.com`
- API: `https://api.lotbiai.com`
- iOS Bundle ID target: `com.lotbiai.app`
- Android package: `com.lotbiai.app`
- Support/privacy contact: `developer@lotbiai.com`
- do not invent/register `app.lotbiai.com`

Brand assets:
- `assets/lotbi-logo-header.png`
- `assets/lotbi-main-logo.png`
- `assets/lotbi-og-share.png`

## Shared reviewed Social Signup contract

Required LOTBI consents:
- `TERMS_OF_SERVICE` — required
- `PRIVACY_POLICY` — required

Core server-owned manifest must provide exact document version, SHA-256 and HTTPS URI. Account Web accepts both required checkboxes and forwards only Core-issued manifest metadata. Missing/mismatched consent fails closed.

User directly enters LOTBI name and account handle. Provider email/name/profile is not used as Social identity under the current minimum contract.

Current Production blocker:
- public Privacy is still pre-release/static-site text;
- public Terms is still a pre-release website use notice;
- Production reviewed signup-consent endpoint is not deployed;
- Account Production provider buttons still show preparation state;
- provider real E2E is pending.

## Exact reviewed Web callbacks

| Provider | Callback |
|---|---|
| Google | `https://account.lotbiai.com/api/auth/providers/google/callback` |
| Kakao | `https://account.lotbiai.com/api/auth/providers/kakao/callback` |
| NAVER | `https://account.lotbiai.com/api/auth/providers/naver/callback` |
| Apple | `https://account.lotbiai.com/api/auth/providers/apple/callback` |

Callback **code contract** is GREEN. Provider Console registration/Production env configuration is not performed by this readiness work.

---

# GOOGLE

## Current reviewed contract

- scope: `openid`
- identity: Google OIDC `sub`
- email: unused
- name/profile: unused
- callback: `https://account.lotbiai.com/api/auth/providers/google/callback`
- Core verifies issuer/audience/`azp`/nonce/state/PKCE/replay/lifetime.

Do not declare `openid`-only invalid merely because `email`/`profile` are separate Google scopes. Do not expand scope until real configured-client E2E proves a technical requirement.

## Google current official readiness requirements to satisfy

- public Production homepage on owned/verified domain;
- accurate app identity/branding/support contact;
- public Privacy Policy describing actual Google user-data access/use/storage/sharing;
- secure exact redirect URI;
- authorized-domain ownership verification;
- requested scopes limited to actual need;
- brand verification assessed as applicable.

## Google blockers before Console step

- [ ] Production Privacy content updated from pre-release wording
- [ ] Production Terms content updated from pre-release notice
- [ ] Production legal manifest deployed with exact version/SHA256/URI
- [ ] real Google `openid` flow E2E completed
- [ ] final branding package/current accepted format ready
- [ ] authorized-domain ownership owner step ready
- [ ] Production Core/Account deployment still fail-closed until explicit activation

Final: `GOOGLE = BLOCKED / USER_ACTION_REQUIRED NOT YET`.

---

# KAKAO

## Current reviewed contract

- scope: `openid`
- identity: Kakao OIDC `sub`
- Kakao account email: unused
- nickname/profile: unused
- callback: `https://account.lotbiai.com/api/auth/providers/kakao/callback`

Do not request additional personal-information consent items without a real LOTBI feature and matching Privacy/signup disclosure.

## Kakao current official readiness requirements to satisfy

- Kakao Login app/service setup and exact registered redirect;
- consent items limited to information actually used;
- if personal-information permission review is needed, signup screen/Privacy/review application must match required/optional conditions and collection purpose;
- full signup/login/withdrawal evidence where review materials require it;
- service account deletion/unmapping lifecycle must include Kakao Unlink behavior; Provider-originated unlink can be reconciled through Kakao webhook.

## Kakao blockers

- [ ] Production Privacy/Terms update
- [ ] Production legal manifest deployment
- [ ] real Kakao E2E evidence
- [ ] Provider-specific Kakao Unlink/account-deletion lifecycle implemented and verified
- [ ] unlink webhook decision/implementation closed for launch architecture

Final: `KAKAO = BLOCKED — LEGAL MANIFEST + PROVIDER LIFECYCLE + REAL E2E`.

---

# NAVER

## Current reviewed contract

- scope: `openid`
- canonical identity: official app-scoped profile `response.id`
- email/name/profile/phone/birthday/birth year/gender/age range: unused
- callback: `https://account.lotbiai.com/api/auth/providers/naver/callback`

Do not request unused NAVER profile items merely for review.

## NAVER current official readiness requirements to satisfy

- correct service URL and exact Callback URL;
- only actually needed user information selected;
- pre-review before unrestricted official opening;
- evidence showing complete NAVER Login/consent/signup/withdrawal flow;
- no separate LOTBI password requirement in the social signup path;
- when the user stops using the service or ends NAVER Login linkage, Token Revocation lifecycle must be handled; Provider-originated disconnect notification requires its callback if used/required by launch policy.

No current official-doc procedure conflict was identified in this verification.

## NAVER blockers

- [ ] Production Privacy/Terms update
- [ ] Production legal manifest deployment
- [ ] real NAVER E2E and review evidence
- [ ] NAVER Token Revocation / disconnect lifecycle verified against LOTBI unlink/deletion

Final: `NAVER = BLOCKED — LEGAL MANIFEST + PROVIDER LIFECYCLE + PRE-REVIEW EVIDENCE`.

---

# APPLE

## Current reviewed contract

- callback: `https://account.lotbiai.com/api/auth/providers/apple/callback`
- stable identity: Apple `sub`
- email/private relay email: unused
- full name: unused
- LOGIN: `READY BY REVIEW`
- SIGNUP: `BLOCKED`
- LINK: `BLOCKED`

## Apple current official requirements relevant to LOTBI

- Web Sign in with Apple uses Services ID associated with a primary Apple App ID and registered domain/absolute return URL;
- private key/client-secret material remains server-side;
- when a Sign in with Apple user is no longer associated with the app, Apple provides `/auth/revoke` for token/authorization revocation;
- account deletion with Sign in with Apple requires Provider-side revoke lifecycle;
- server-to-server account change notifications should be reconciled according to the final architecture.

## Apple blocker

`APPLE_SOCIAL_AUTH_LIFECYCLE_BLOCKER`

Required before SIGNUP/LINK:
- encrypted durable revocation material;
- Apple-specific revoke on explicit unlink and LOTBI account deletion;
- idempotent retry/unknown reconciliation;
- secret-safe storage/logging;
- S2S notification handling/reconciliation;
- migration/security tests;
- real Apple development/sandbox E2E.

Final: `APPLE LOGIN CONTRACT READY / APPLE SIGNUP+LINK BLOCKED`.

---

# Public legal pages

- Privacy URL: `https://lotbiai.com/privacy.html` — public HTTPS, current content not Production Social Auth ready.
- Terms URL: `https://lotbiai.com/terms.html` — public HTTPS, current content is pre-release website notice.
- Account deletion: `https://lotbiai.com/account-deletion.html` — public and aligned with local receipt/purge model at a high level; final Provider remote-revoke language still depends on Provider lifecycle closure.

# Stop rule

Do not submit or change Provider Consoles yet.

`USER_ACTION_REQUIRED — GOOGLE STEP 1` may be issued only after Google-specific gates are all GREEN, including Production legal document/manifest deployment and real `openid` E2E.

Current: `USER_ACTION_REQUIRED = NOT YET`.
