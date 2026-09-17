# LOTBI Social Login Provider 제출 준비 체크리스트

Research date: 2026-09-17 (Asia/Seoul)

Status: PREPARATION ONLY — external submission/Production activation is prohibited until explicit user approval and readiness gates close.

## Shared LOTBI registration baseline

Use the same service identity across providers:

- Service name: `LOTBI`
- Homepage: `https://lotbiai.com`
- Account Web: `https://account.lotbiai.com`
- API: `https://api.lotbiai.com`
- iOS Bundle ID target: `com.lotbiai.app`
- Android package: `com.lotbiai.app`
- Support/privacy contact: `developer@lotbiai.com`
- Do not invent/register `app.lotbiai.com`

Current LOTBI brand assets available in `lotbi-site`:

- `assets/lotbi-logo-header.png`
- `assets/lotbi-main-logo.png`
- `assets/lotbi-og-share.png`

Before uploading a logo to any Provider Console, confirm current required dimensions/file format and use the official LOTBI color logo rather than a temporary gray/dev asset.

## Shared data-request baseline

Current Core identity contract uses only the provider-stable subject/identifier as canonical Social identity.

| Data | Baseline |
|---|---|
| stable subject / user identifier | `REQUIRED` |
| email | `UNUSED` |
| name / nickname | `UNUSED` |
| profile picture | `UNUSED` |
| phone | `UNUSED` |
| birthday / birth year | `UNUSED` |
| gender / age range | `UNUSED` |
| address | `UNUSED` |
| friend list | `UNUSED` |

Never expand Provider scopes merely to simplify review.

## Shared callback rule

Core owns Web authorization-code redirect configuration through `LOTBI_SOCIAL_<PROVIDER>_WEB_REDIRECT_URI`. The test suite uses an `account.lotbiai.com/auth/web/<provider>/callback` fixture pattern, but the inspected Account Web integration branch does not yet implement the authoritative provider callback transport.

Therefore all four providers currently remain:

`CALLBACK_PENDING_INTEGRATION`

Do not register a callback copied from a test fixture.

## Shared evidence pack

Do not submit screenshots that imply an unavailable flow works. Capture after real integration succeeds:

1. public LOTBI homepage before login;
2. LOTBI sign-in screen;
3. selected Provider button;
4. Provider consent/authorization screen;
5. successful callback completion;
6. Social Signup completion with actual LOTBI Terms/Privacy consent;
7. LOTBI account page;
8. logout;
9. re-login with same Provider;
10. connected-account management;
11. Provider unlink flow;
12. LOTBI account deletion flow;
13. where Provider-specific remote revoke is part of the final lifecycle, corresponding evidence without exposing tokens/secrets.

Current Provider controls marked preparation/in-progress are not valid successful-flow evidence.

---

# GOOGLE

Official references checked:

- Google OAuth production policy compliance
- Google OAuth scope catalog
- Google OpenID Connect authorization/ID-token reference
- Google Sign in with Google branding guidelines

## Scope assessment

Google documents `openid`, `email`, and `profile` as separate scopes. Current LOTBI Core requests `openid` only because its canonical identity needs the stable `sub` and does not use email/profile.

Do **not** pre-judge `openid`-only as wrong and do not add `email` or `profile` from this readiness room.

There is a documentation point requiring real integration verification: Google's current OIDC authorization reference describes the OIDC scope parameter as beginning with `openid` and including `profile`, `email`, or both, while the scope catalog lists `openid` separately. Resolve this against a valid configured Google OAuth client and the actual current endpoint, not by scope expansion without evidence.

Current blocker:

`CORE_SOCIAL_AUTH_BLOCKER — GOOGLE_SCOPE_CONTRACT_VERIFY`

Required verification:

- [ ] `openid`-only authorization request accepted
- [ ] authorization code returned
- [ ] exact callback accepted
- [ ] token exchange succeeds
- [ ] ID token issued
- [ ] stable `sub` present
- [ ] issuer check succeeds
- [ ] audience / `azp` check succeeds
- [ ] nonce continuity succeeds
- [ ] state/binding/PKCE/replay protections succeed
- [ ] OAuth consent configuration reflects only actual requested scopes

If `openid`-only succeeds and is accepted for the final configuration, retain it. If Google technically requires an additional standard identity scope, add only the minimum required scope in the integration workstream and update Privacy/data matrix before submission.

## Console / registration checklist

- [ ] Dedicated LOTBI Google Cloud project confirmed/created during authorized owner step
- [ ] App name = `LOTBI`
- [ ] Support email = actual LOTBI contact
- [ ] Homepage = `https://lotbiai.com`
- [ ] Privacy Policy public URL finalized
- [ ] Production Terms public URL finalized
- [ ] Authorized domain requirement for `lotbiai.com` satisfied
- [ ] Domain ownership verified by an authorized project owner/account
- [ ] Authoritative exact Web callback closed from `CALLBACK_PENDING_INTEGRATION`
- [ ] JavaScript origin added only if the approved Google web implementation actually needs it
- [ ] Final scope set equals the verified Core contract
- [ ] LOTBI branding/logo uploaded in current accepted format
- [ ] Google brand verification requirement assessed
- [ ] Sensitive/restricted scope verification confirmed unnecessary unless future scope expands
- [ ] Required secret/client configuration list prepared without exposing secret value

## Button / brand rule

Prefer Google-provided or current guideline-compliant Sign in with Google controls. Keep Google sign-in at least comparably visible to other third-party sign-in options. Do not recolor/stretch the Google G or invent an outdated custom Google mark.

## Current Google readiness

- Homepage: `READY CONTENT`
- Branding assets: `READY FOR FORMAT ADAPTATION`
- Minimum data model: `READY`
- Minimum scope live contract: `GOOGLE_SCOPE_CONTRACT_VERIFY`
- Privacy: `REVIEW DRAFT READY / LEGAL REVIEW REQUIRED`
- Terms: `REVIEW DRAFT READY / LEGAL REVIEW REQUIRED`
- Callback: `CALLBACK_PENDING_INTEGRATION`
- Domain requirement: `DOCUMENTED / OWNER ACTION LATER`
- Working provider E2E: `NOT VERIFIED`
- Google submission: `NOT SUBMITTED`

---

# KAKAO

Official references checked:

- Kakao Login prerequisites
- Kakao Login REST API / OIDC
- Kakao Login design guidance

## Current consent/data baseline

- stable Kakao OIDC subject: `REQUIRED`
- Kakao account email: `UNUSED`
- nickname/name/profile: `UNUSED`
- other personal-information items: `UNUSED`

Do not apply for additional personal-information permission without a real LOTBI feature requiring it.

## Console / registration checklist

- [ ] Kakao Developers app name = `LOTBI`
- [ ] current LOTBI brand logo registered
- [ ] Kakao Login usage setting enabled only at authorized integration step
- [ ] OIDC enabled according to approved integration contract
- [ ] authoritative exact Redirect URI closed from `CALLBACK_PENDING_INTEGRATION`
- [ ] consent items equal the minimum Core data matrix
- [ ] no email/profile permission added without product use
- [ ] Privacy public URL finalized
- [ ] Terms public URL finalized
- [ ] signup/consent flow evidence prepared after real flow works
- [ ] Biz App/additional permission review assessed only if a future restricted personal-information item is needed
- [ ] client secret/app-key requirements documented without exposing secret values

## Button / brand rule

Use Kakao's standard login resource/guideline. Do not recolor Kakao's login identity to LOTBI colors or substitute unrelated KakaoTalk/CI marks for the Kakao Login symbol.

## Current Kakao readiness

- Data minimization: `READY`
- Consent matrix: `READY FOR SUBJECT-ONLY BASELINE`
- Privacy/Terms: `REVIEW DRAFT READY / LEGAL REVIEW REQUIRED`
- Callback: `CALLBACK_PENDING_INTEGRATION`
- Working E2E/screenshots: `NOT AVAILABLE`
- Kakao review/additional-permission application: `NOT SUBMITTED`

---

# NAVER

Official references checked:

- NAVER Login developer guide
- NAVER Login OIDC guide
- NAVER Login pre-review guide
- NAVER Login button usage guidance

## Current data baseline

LOTBI uses NAVER's official app-scoped profile `response.id` as its canonical stable subject.

- app-scoped user identifier: `REQUIRED`
- email: `UNUSED`
- name: `UNUSED`
- profile: `UNUSED`
- phone/birthday/birth year/gender/age range: `UNUSED`

Web/native authentication may use authorization/access/ID tokens in memory to verify the user and obtain the official identifier. That does not authorize requesting unused profile fields.

## Console / registration checklist

- [ ] Application name = `LOTBI`
- [ ] LOTBI representative logo registered
- [ ] Service URL = actual LOTBI service URL
- [ ] authoritative Callback URL closed from `CALLBACK_PENDING_INTEGRATION`
- [ ] NAVER Login/OIDC configuration matches the approved Core flow
- [ ] requested information contains only actually used information
- [ ] app-scoped user identifier retained as the identity key
- [ ] email/name/phone/birthday/birth year/gender/age etc. remain unrequested unless a real use case is added
- [ ] no separate LOTBI password required in the NAVER Social Signup path
- [ ] full login -> consent -> signup completion evidence captured after flow works
- [ ] pre-review evidence uploaded only after working E2E exists
- [ ] client credential requirements documented without exposing values

## Review posture

NAVER pre-review checks whether requested user-information items are actually used. Current identifier-only design is therefore the intended minimal review posture.

## Button / brand rule

Use current NAVER Login assets/guideline and preserve NAVER's designated brand identity. Do not deform/recolor the mark or make the NAVER login control artificially less visible than other Social Login options.

## Current NAVER readiness

- Data minimization: `READY`
- Additional profile-use evidence: `NOT REQUIRED UNDER CURRENT MODEL`
- Homepage/service content: `READY CONTENT`
- Privacy/Terms: `REVIEW DRAFT READY / LEGAL REVIEW REQUIRED`
- Callback: `CALLBACK_PENDING_INTEGRATION`
- Working E2E/screenshots: `NOT AVAILABLE`
- NAVER pre-review: `NOT SUBMITTED`

---

# APPLE

Official references checked:

- Configuring Sign in with Apple / web Services ID
- Apple account deletion guidance
- Apple token revocation REST API
- Apple server-to-server account-change notifications
- Sign in with Apple UI guidance

## Current data baseline

- stable Apple `sub`: `REQUIRED` when Social identity lifecycle is enabled
- email/private relay email: `UNUSED`
- full name: `UNUSED`
- profile picture: not part of current identity model

Apple LOGIN verification preparation exists. Apple SIGNUP/LINK remains deliberately fail-closed until revocation lifecycle is implemented.

## Current blocker

`CORE_SOCIAL_AUTH_BLOCKER — APPLE_REVOCATION_LIFECYCLE`

Current Core's Apple code exchange verifies the ID token but does not preserve Apple access/refresh token as durable later revocation material. The integration workstream must implement an approved encrypted provider-token vault/revoke-on-account-deletion lifecycle before enabling Apple SIGNUP/LINK.

## Developer-account / integration checklist

- [ ] Apple Developer membership/account role confirmed during owner step
- [ ] App ID `com.lotbiai.app` exists/confirmed
- [ ] Sign in with Apple capability enabled only in authorized integration step
- [ ] Primary App ID relationship confirmed
- [ ] Services ID planned/confirmed for Web
- [ ] Services ID associated with primary App ID
- [ ] website domain/subdomain registered
- [ ] authoritative absolute return URL closed from `CALLBACK_PENDING_INTEGRATION`
- [ ] Team ID recorded securely where needed
- [ ] Key ID/private key created only during explicit authorized owner/integration step
- [ ] private key never stored in readiness repository
- [ ] client-secret JWT generated server-side from protected signing material
- [ ] encrypted durable Apple revocation material design implemented/tested
- [ ] account deletion triggers required Apple revoke lifecycle
- [ ] Apple S2S notification endpoint/validation/reconciliation implemented or explicitly closed by approved architecture
- [ ] no token/private key/client-secret plaintext in logs/audits/API responses
- [ ] email relay domain/source configuration deferred unless LOTBI later requests Apple email/private relay

## Apple unlink decision

Generic LOTBI unlink is local-only today. Whether Apple-specific unlink should additionally revoke Apple authorization is a separate product/security decision:

`USER_DECISION_REQUIRED — APPLE_UNLINK_REMOTE_REVOKE_POLICY`

Do not make this decision silently in the readiness room.

## Button / brand rule

Use Apple's system-provided or current guideline-compliant Sign in with Apple button. Do not recolor the Apple logo with LOTBI brand colors or make the Apple option smaller/less usable than equivalent third-party sign-in controls.

## Current Apple readiness

- Basic App ID/Services ID requirements: `DOCUMENTED`
- Minimum data model: `READY`
- Signup/link Core lifecycle: `BLOCKED — APPLE_REVOCATION_LIFECYCLE`
- Callback: `CALLBACK_PENDING_INTEGRATION`
- Identifier/key actual changes: `NOT PERFORMED`
- Working real-provider E2E: `NOT VERIFIED`
- External Apple changes/submission: `NOT PERFORMED`

---

# Shared stop rule

No external submission or Production activation from this readiness branch.

Do not perform:

- Google Console Production submission/verification
- Kakao review/application
- NAVER pre-review submission
- Apple Developer identifier/key change
- Production credential generation/registration
- Provider secret registration
- Production OAuth activation

`USER_ACTION_REQUIRED — GOOGLE STEP 1` may be issued only after:

- authoritative Google callback is fixed;
- Privacy review draft is ready and its remaining legal items are clearly isolated;
- Production Terms review draft is ready and its remaining legal items are clearly isolated;
- Google minimum scope live contract is verified;
- Google branding pack is ready;
- homepage/policy URLs are ready;
- domain requirements are documented;
- secret/client configuration requirements are documented without secret values.

Until then: `USER_ACTION_REQUIRED = NOT YET`.
