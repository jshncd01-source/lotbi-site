# SOCIAL-AUTH-PROVIDER-READINESS-01

Research date: 2026-09-17 (Asia/Seoul)

Status: REVIEW DRAFT — no provider submission, no production secret changes, no main promotion.

## Scope and safety boundary

This file records policy, consent, brand, domain/callback, review-evidence, and signup/login/deletion readiness for Google, Kakao, NAVER, and Apple.

Out of scope here:
- Production OAuth/OIDC activation
- Production secret creation/registration
- Apple private-key creation or exposure
- Core main promotion
- Provider review submission without user approval

## LOTBI canonical service information

- Service: LOTBI
- Homepage: https://lotbiai.com
- Account Web: https://account.lotbiai.com
- API: https://api.lotbiai.com
- Admin: https://admin.lotbiai.com
- iOS target Bundle ID: `com.lotbiai.app`
- Android package: `com.lotbiai.app`
- `app.lotbiai.com`: not an approved/available LOTBI host; do not register or invent it.
- Current support/privacy/account contact: `developer@lotbiai.com`

## Current public-site baseline

### Homepage

Current public homepage is reachable without authentication and exposes LOTBI service information plus links to Privacy, Terms/Notice, Account Deletion, and Contact.

Status: `REVIEW_READY_CONTENT` with policy caveats below.

### Privacy

Current `privacy.html` is explicitly a pre-release static-site privacy notice. It says the public site itself does not provide account signup, payment, location, or voice input and promises a later update when the service processes those data.

That wording is not yet sufficient as the provider-facing LOTBI service privacy policy for Social Login because Account Web and Social Auth contracts already exist and provider reviewers require the published policy to match the data actually requested/used.

Status: `UPDATE_RECOMMENDED` + `LEGAL_REVIEW_REQUIRED`.

### Terms

Current `terms.html` is titled/structured as a pre-release website use notice, not a full production service Terms of Service. It states that final transaction/service terms will be published later.

Status: `TERMS_PAGE_REQUIRED` for production provider readiness. Do not relabel the current pre-release notice as final Terms without legal review.

### Account deletion

Current `account-deletion.html` points users to the real Account Web deletion flow and explains that Core receipt/purge policy governs deletion rather than promising an invented immediate hard-delete schedule.

Status: `REVIEW_READY`, subject to final production lifecycle verification.

### Support contact

`contact.html` publishes `developer@lotbiai.com`, a representative telephone number, the operating company, and account/privacy contact guidance.

Status: `READY`.

## Core Social Auth data contract

Current `lotbi-core/main` is the authoritative implementation baseline.

Observed contract:
- External identity canonical key: `provider + provider_subject`
- Provider email: not persisted (`None` in signup/link tests)
- Provider profile: not persisted (`{}` in signup/link tests)
- Provider display name: not imported as canonical identity data; LOTBI signup receives its own user-entered `name`
- Required LOTBI signup consents: `TERMS_OF_SERVICE` and `PRIVACY_POLICY`
- Provider token: not a stored account attribute in the signup contract
- Web and native transports converge on the same account identity policy

Current web authorization scopes in Core:
- Google: `openid`
- Kakao: `openid`
- NAVER: `openid`
- Apple: no name/email profile scope requested

Current native behavior:
- Google: backend/server client ID token verification
- Kakao: native app key / ID-token verification
- NAVER: native access token, server calls official profile endpoint and consumes only `response.id`
- Apple: iOS login verification exists; signup/link is fail-closed until Apple revocation-storage lifecycle is enabled

## Social data matrix

| Provider | Data / claim | LOTBI use | Stored | Requested status |
|---|---|---|---|---|
| Google | stable subject (`sub`) | login/account identity | YES as `provider_subject` | REQUIRED |
| Google | email | none in current Core | NO | UNUSED |
| Google | name/profile/picture | none in current Core | NO | UNUSED |
| Kakao | stable subject (`sub`) | login/account identity | YES as `provider_subject` | REQUIRED |
| Kakao | Kakao account email | none in current Core | NO | UNUSED |
| Kakao | profile/name/etc. | none in current Core | NO | UNUSED |
| NAVER | app-scoped user identifier | login/account identity | YES as `provider_subject` | REQUIRED |
| NAVER | email/name/phone/birthday/gender/age/etc. | none in current Core | NO | UNUSED |
| Apple | stable user subject (`sub`) | login/account identity | YES as `provider_subject` when lifecycle path is enabled | REQUIRED |
| Apple | email/private relay email | none in current Core | NO | UNUSED |
| Apple | full name | none in current Core | NO | UNUSED |

Policy rule: do not request phone number, birth date/year, gender, address, friend list, profile image, or email simply to make provider review easier. Any future expansion requires an actual product need, matching Core handling, privacy disclosure, consent configuration, and review evidence.

## GOOGLE

### Official current requirements checked

Sources:
- https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance
- https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification
- https://developers.google.com/identity/openid-connect/openid-connect
- https://developers.google.com/identity/protocols/oauth2/scopes

Requirements relevant to LOTBI:
- Public production homepage on a verified domain
- App name and support email that accurately represent LOTBI
- Public Privacy Policy on the app/homepage domain describing Google user-data access/use/storage/sharing
- Terms URL may be displayed/configured as brand information; LOTBI still needs its own production Terms for project readiness
- Ownership verification for authorized domains via Google Search Console
- Exact secure redirect URI configuration
- Request only scopes that are needed
- Public/External production branding may require brand verification before full branded display

### Google scope contract issue

`lotbi-core/main` currently requests only `scope=openid` because it intentionally does not consume profile/email.

Google's current OIDC authorization-URI documentation says the scope parameter must start with `openid` and include `profile`, `email`, or both. Google's general OAuth scope catalog separately lists `openid` as its own authentication scope.

Do not silently add `profile` or `email` from this readiness room because that would expand provider data exposure beyond the current Core contract.

Status: `CORE_SOCIAL_AUTH_BLOCKER — GOOGLE_SCOPE_CONTRACT_VERIFY`.

Required handoff to the Social Login integration room: verify the production Google flow against the current Google authorization endpoint/GIS requirements and decide the smallest compliant scope. If an additional identity scope is technically mandatory, update the privacy/data matrix before provider submission even if LOTBI does not persist the extra claim.

### Google readiness

- Homepage: READY
- Support contact: READY
- Privacy: UPDATE REQUIRED before submission
- Production Terms: REQUIRED for LOTBI project readiness
- Authorized-domain ownership: USER ACTION later
- Exact callback: must come from authoritative deployment contract; do not guess
- Sensitive/restricted scopes: none intentionally requested
- Submission: NOT PERFORMED

Status: `USER_ACTION_REQUIRED` only after documents/callback contract are ready.

## KAKAO

Official sources:
- https://developers.kakao.com/docs/ko/kakaologin/prerequisite
- https://developers.kakao.com/docs/en/kakaologin/rest-api
- https://developers.kakao.com/docs/en/app-setting/app

Current requirements relevant to LOTBI:
- Kakao Login must be enabled in app settings
- Registered Redirect URI must exactly match the request
- OIDC uses `openid`
- Personal-information consent items must be configured only for information actually needed
- Additional personal-information permissions can require Biz App/business review and supporting signup/privacy evidence
- Required/optional status in provider settings, signup UI, and privacy documentation must match

LOTBI does not currently need Kakao email/name/profile data. Therefore do not request additional personal-information permissions merely for login.

Status: `PREPARED_MINIMUM_DATA_MODEL`; provider console registration/review not submitted.

## NAVER

Official sources:
- https://developers.naver.com/docs/login/verify/verify.md
- https://developers.naver.com/docs/login/devguide/devguide.md

Current requirements relevant to LOTBI:
- Formal public launch for unrestricted NAVER IDs requires pre-review
- Review must show the end-to-end NAVER login/signup flow
- If anything beyond the default user identifier is selected, reviewers check actual use evidence
- Unused additional user-information permissions should be removed
- A service-specific separate password must not be required during NAVER social signup
- App name/logo must clearly represent the service

LOTBI's current Core contract consumes only the app-scoped identifier, which is the lowest-friction review posture.

Status: `PREPARED_MINIMUM_DATA_MODEL`; end-to-end evidence cannot be submitted until the provider flow actually works.

## APPLE

Official sources:
- https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web
- https://developer.apple.com/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple
- https://developer.apple.com/help/account/capabilities/create-a-sign-in-with-apple-private-key
- https://developer.apple.com/app-store/review/guidelines/

Current requirements relevant to LOTBI:
- For web authentication, create a Services ID and associate the website with an existing primary Apple-platform App ID enabled for Sign in with Apple
- Register the domain/subdomain and absolute return URL
- A Sign in with Apple private key is needed for server communication
- If LOTBI later requests email and sends mail to Apple private-relay addresses, outbound email sources/domains must be registered and authenticated
- App Store Review Guideline 4.8 requires an equivalent privacy-preserving login option when an app uses third-party/social login for the primary account; Sign in with Apple is the normal LOTBI path for satisfying that requirement

Current Core does not request or persist Apple email/full name, so private relay is not a current data dependency. Do not add email scope just because relay support exists.

Core currently blocks Apple SIGNUP/LINK until revocation storage exists.

Status: `APPLE DEVELOPER PREREQUISITE PENDING` + `CORE_SOCIAL_AUTH_BLOCKER — APPLE_REVOCATION_LIFECYCLE` for signup/link. Login verification preparation exists.

## Privacy-policy change requirements

A provider-ready policy needs a dedicated Social Login section that, at minimum, accurately states:
- Providers used: Google, Kakao, NAVER, Apple
- Actual provider data accessed under the production scope set
- Purpose: identity verification, login, account creation/link management as actually implemented
- What LOTBI persists versus only verifies transiently
- Retention/deletion/unlink behavior
- Whether processor/third-party/overseas transfer rules apply to the final architecture
- User rights and support contact

Do not publish guessed legal conclusions.

`LEGAL_REVIEW_REQUIRED`:
- Exact retention period/criterion for `provider_subject`
- Whether each provider interaction is categorized as overseas transfer, third-party provision, entrusted processing, or another legal basis under the final production architecture
- Any statutory retention exceptions
- Final wording of service Terms
- Final under-14/minimum-age policy

## LOTBI consent alignment

Core requires separate LOTBI consent evidence for:
- Privacy Policy
- Terms of Service

Provider OAuth/OIDC consent is not treated as a substitute for LOTBI's own required consents.

Status: `SOCIAL CONSENT MATRIX = READY` for the current minimal provider-data model, subject to the Google scope contract check above.

## Evidence status

Already available:
- Public LOTBI homepage
- Public Privacy page (needs provider-ready update)
- Public pre-release Terms/Notice page (not final production Terms)
- Public Account Deletion page
- Public Contact page
- Account Web social-login buttons

Not yet valid as submission evidence:
- Provider consent-screen captures proving real production/test flow
- Successful provider callback/login/signup captures
- Provider console application screenshots

Reason: current Account Web visibly marks the provider buttons as preparation/in-progress; evidence must not claim an unavailable flow works.

## Callback rule

Do not infer callback URLs from hostname conventions. Core loads the exact web redirect URI from deployment configuration and exposes configured redirect URI through its readiness contract only when provider runtime configuration exists.

Until the Social Login integration room supplies an authoritative callback per provider/surface, mark callback as `BLOCKED_BY_DEPLOYMENT_CONTRACT`.

## Current readiness summary

| Item | Status |
|---|---|
| LOTBI homepage | REVIEW READY CONTENT |
| Privacy Policy | UPDATE_RECOMMENDED + LEGAL_REVIEW_REQUIRED |
| Production Terms | TERMS_PAGE_REQUIRED + LEGAL_REVIEW_REQUIRED |
| Account deletion flow | REVIEW READY |
| Support contact | READY |
| Social data matrix | READY (minimal subject-only baseline) |
| Google | BLOCKED on scope-contract verification + provider console setup |
| Kakao | PREPARED; provider console setup pending |
| NAVER | PREPARED; real-flow evidence/review pending |
| Apple | CONFIG PREP; developer identifiers/key + revocation lifecycle pending |

## Do not submit yet

No Google verification, Kakao additional-feature/review application, NAVER pre-review, or Apple identifier/key change may be submitted/performed from this readiness branch without explicit user approval.

## Next safe work

1. Prepare provider-ready Privacy wording as a review draft, without declaring legal finality.
2. Prepare production Terms requirements/draft separately from the existing pre-release website notice.
3. Verify unlink/deletion retention behavior against Core before final retention wording.
4. Send `GOOGLE_SCOPE_CONTRACT_VERIFY` and Apple revocation-lifecycle items to the Social Login integration workstream.
5. Once the policy/callback blockers are closed, stop at the first owner-only external step: `USER_ACTION_REQUIRED — GOOGLE STEP 1`.
