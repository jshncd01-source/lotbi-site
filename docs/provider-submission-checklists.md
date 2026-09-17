# LOTBI Social Login Provider 제출 준비 체크리스트

Research date: 2026-09-17 (Asia/Seoul)

Status: PREPARATION ONLY — external submission is prohibited until explicit user approval.

## Shared LOTBI registration baseline

Use the same service identity across all providers:
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

Before uploading a logo to any provider console, confirm the provider's required dimensions/file format and use the official LOTBI color logo rather than a temporary gray/dev asset.

## Shared data request baseline

Current Core contract uses only the provider-stable subject as canonical social identity.

Default policy for provider console configuration:
- stable subject / user identifier: REQUIRED
- email: UNUSED unless the implementation contract is explicitly changed
- name/profile picture: UNUSED
- phone: UNUSED
- birthday/birth year: UNUSED
- gender/age range: UNUSED
- address: UNUSED
- friend list: UNUSED

Never expand provider scopes just to simplify review.

## Shared evidence pack

Do not submit screenshots that imply an unavailable flow works.

Prepare these after the real integration is functioning:
1. Public LOTBI homepage before login
2. LOTBI sign-in screen
3. Selected provider button
4. Provider consent/authorization screen
5. Callback completion
6. New LOTBI signup completion using the actual LOTBI Terms/Privacy consent flow
7. LOTBI account page
8. Logout
9. Re-login with the same provider
10. Connected account management
11. Provider unlink flow
12. LOTBI account deletion flow

Each screenshot set must show the real implementation and actual LOTBI branding. Current Account Web provider controls marked “준비 중” are not valid successful-flow review evidence.

---

# GOOGLE

Official references checked:
- Google OAuth production policy compliance
- Google brand verification
- Google OpenID Connect
- Google Sign in with Google branding guidelines

## Console/registration checklist

- [ ] Dedicated production Google Cloud project confirmed/created
- [ ] App name = `LOTBI`
- [ ] Support email uses the actual LOTBI support contact
- [ ] Homepage = `https://lotbiai.com`
- [ ] Privacy Policy public URL finalized
- [ ] Production Terms public URL finalized
- [ ] Authorized top private domain = `lotbiai.com`
- [ ] Domain ownership verified in Google Search Console by an account associated with the Cloud project
- [ ] Exact Web redirect URI copied from the authoritative Social Login deployment contract
- [ ] JavaScript origin added only if the chosen Google Identity Services web implementation actually requires it
- [ ] Scopes match the final Core contract
- [ ] Branding/logo matches LOTBI
- [ ] Brand verification requirement assessed
- [ ] Sensitive/restricted scope verification confirmed unnecessary unless future scopes expand

## Current blocker

`CORE_SOCIAL_AUTH_BLOCKER — GOOGLE_SCOPE_CONTRACT_VERIFY`

Current Core Web authorization uses `openid` only. Google's current OIDC authorization documentation states that `scope` begins with `openid` and includes `profile`, `email`, or both. Do not resolve this readiness blocker by silently adding user-data scopes. The Social Login integration workstream must validate the smallest Production-compatible Google flow first.

## Button/brand rule

Prefer Google Identity Services-rendered/pre-approved Sign in with Google controls and current approved branding. The Google button should be at least as prominent as other third-party sign-in options. Do not recolor/stretch the Google G or invent an outdated custom Google button.

## Submission evidence status

- Homepage: READY CONTENT
- Privacy: UPDATE/LEGAL REVIEW REQUIRED
- Terms: PRODUCTION TERMS REQUIRED
- Callback: BLOCKED_BY_DEPLOYMENT_CONTRACT
- Working flow screenshots: NOT AVAILABLE YET
- Google verification submission: NOT SUBMITTED

---

# KAKAO

Official references checked:
- Kakao Login prerequisites
- Kakao Login REST API
- Kakao Login design guide

## Console/registration checklist

- [ ] Kakao Developers app name = `LOTBI`
- [ ] Correct LOTBI brand logo registered
- [ ] Kakao Login usage setting enabled at integration stage
- [ ] OIDC enabled only as required by the approved integration contract
- [ ] Exact Redirect URI copied from the authoritative deployment contract
- [ ] Consent items reviewed against the minimal Core data matrix
- [ ] No Kakao email/profile permission added without real use
- [ ] Privacy Policy public URL finalized
- [ ] Signup/Terms/Privacy flow evidence prepared
- [ ] Biz App/additional permission requirement assessed only if LOTBI later needs restricted personal-information items

## Current consent baseline

- Stable subject: REQUIRED
- Kakao account email: UNUSED
- Profile/nickname: UNUSED
- Other personal information: UNUSED

## Button/brand rule

Use Kakao's standard resource where possible. Current Kakao guide specifies the Kakao Login identity colors and symbol; do not apply LOTBI colors to the Kakao symbol/button in a way that violates Kakao's guide. Do not substitute the KakaoTalk app icon or Kakao CI for the Kakao Login symbol.

## Submission evidence status

- Data minimization: READY
- Consent matrix: READY for subject-only baseline
- Privacy/signup consistency: DRAFT READY, final policy pending
- Callback: BLOCKED_BY_DEPLOYMENT_CONTRACT
- Working flow screenshots: NOT AVAILABLE YET
- Kakao review/additional-permission application: NOT SUBMITTED

---

# NAVER

Official references checked:
- NAVER Login developer guide
- NAVER Login pre-review guide
- NAVER Login button usage guide

## Console/registration checklist

- [ ] Application name = `LOTBI`
- [ ] LOTBI representative logo registered
- [ ] Service URL = actual LOTBI service URL
- [ ] Exact Callback URL copied from the authoritative deployment contract
- [ ] NAVER Login product/API enabled
- [ ] Requested information contains only information actually used
- [ ] Default user identifier retained
- [ ] Email/name/phone/birthday/birth year/gender/age etc. remain unrequested unless a real use case is added
- [ ] No separate LOTBI password is required in the NAVER social-signup path
- [ ] Full login → consent → signup-complete evidence captured
- [ ] Pre-review evidence uploaded only after the working flow exists

## Current review posture

NAVER requires pre-review before unrestricted official opening. If LOTBI requests any user information beyond the basic user identifier, reviewers require evidence of where each selected item is actually used. Therefore the current identifier-only Core design is the intended submission baseline.

## Button/brand rule

Use NAVER's current Login button assets/guideline. Current official guide specifies green `#03A94D` as the designated primary background and prohibits arbitrary logo/color deformation. Keep NAVER's button identity visible and do not shrink it relative to other social buttons merely to fit LOTBI styling.

## Submission evidence status

- Data minimization: READY
- Additional profile-use evidence: NOT REQUIRED under current identifier-only plan
- Service content/homepage: READY CONTENT
- Callback: BLOCKED_BY_DEPLOYMENT_CONTRACT
- Working flow screenshots: NOT AVAILABLE YET
- Pre-review submission: NOT SUBMITTED

---

# APPLE

Official references checked:
- Configuring your environment for Sign in with Apple
- Configure Sign in with Apple for the web
- Register a Services ID
- Sign in with Apple Human Interface Guidelines

## Developer-account configuration checklist

- [ ] Apple Developer membership/account role confirmed
- [ ] App ID for `com.lotbiai.app` exists/confirmed
- [ ] Sign in with Apple capability enabled only in the authorized integration step
- [ ] Primary App ID relationship confirmed
- [ ] Services ID planned for web
- [ ] Services ID associated with the primary App ID
- [ ] Website domain/subdomain registered
- [ ] Absolute return URL copied from the authoritative deployment contract
- [ ] Team ID recorded where required
- [ ] Key ID/private key generated only during the explicit authorized user-owned integration step
- [ ] Private key never placed in this readiness repository
- [ ] Client secret JWT generation/storage belongs to the integration/production secret boundary
- [ ] Email relay domain/source configuration deferred unless LOTBI actually requests Apple email/private relay

## Current data baseline

- Apple subject: REQUIRED when account signup/link lifecycle is enabled
- Email/private relay email: UNUSED in current Core
- Full name: UNUSED in current Core

## Current blocker

`CORE_SOCIAL_AUTH_BLOCKER — APPLE_REVOCATION_LIFECYCLE`

Core currently has Apple verification preparation but intentionally fails closed for Apple signup/link until the revocation storage/lifecycle contract is enabled. Do not call Apple “configuration ready for production signup” before this closes.

## Button/brand rule

Use Apple's system-provided or guideline-compliant Sign in with Apple button. Apple requires the button to be no smaller than other sign-in controls and defines approved black/white appearances, minimum size/margins, wording and Apple logo handling. Do not recolor the Apple logo with LOTBI brand colors.

## Submission evidence status

- Basic web/App ID relationship requirements: DOCUMENTED
- Identifier/key actual configuration: USER/INTEGRATION ACTION LATER
- Email relay: NOT CURRENTLY REQUIRED by the Core data model
- Callback: BLOCKED_BY_DEPLOYMENT_CONTRACT
- Working flow screenshots: NOT AVAILABLE YET
- Apple identifier/key changes: NOT PERFORMED

---

# Stop rule

Do not submit or activate anything externally from this branch.

When Privacy/Terms legal wording, Google scope compatibility, exact deployment callback(s), and provider flow evidence are ready, the first owner-only action must be reported alone as:

`USER_ACTION_REQUIRED — GOOGLE STEP 1`

Do not ask the user to configure Google, Kakao, NAVER, and Apple all at once.
