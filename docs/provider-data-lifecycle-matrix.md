# LOTBI Social Login Provider Data & Lifecycle Matrix

Research date: 2026-09-17 (Asia/Seoul)

Status: `REVIEW CONTRACT VERIFIED / PRODUCTION LEGAL MANIFEST NOT DEPLOYED`

Implementation baselines:
- Core Social review: `b555420b8d75c9e241a6cd9bd534f205499a87d8`
- Account Social review: `5eadea164d559a4f3c45dfca18d6c2acf95a40c0`

## 1. Provider data and scope matrix

`REQUIRED` means required by the current reviewed LOTBI Social Auth identity contract. `UNUSED` means LOTBI does not currently request/use it as Provider profile data for Social identity.

| Provider | Actual reviewed Web scope | Canonical Provider identity | Provider email | Provider name | Provider profile/picture | Other Provider personal data |
|---|---|---|---|---|---|---|
| Google | `openid` | verified OIDC `sub` — `REQUIRED` | `UNUSED` | `UNUSED` | `UNUSED` | `UNUSED` |
| Kakao | `openid` | verified OIDC `sub` — `REQUIRED` | `UNUSED` | `UNUSED` | `UNUSED` | `UNUSED` |
| NAVER | `openid` | official app-scoped profile `response.id` — `REQUIRED` | `UNUSED` | `UNUSED` | `UNUSED` | phone/birthday/birth year/gender/age range `UNUSED` |
| Apple | no email/name profile scope | verified Apple `sub` — required for enabled identity | `UNUSED` including private relay email | `UNUSED` | `UNUSED` | no current profile dependency |

Google `openid`-only remains subject to real configured-client E2E verification; this document does not add `email` or `profile` merely to make the flow conventional.

NAVER uses authentication/token transport to obtain the official `response.id`; temporary token processing is not the same as storing every NAVER profile field.

Apple LOGIN contract is reviewed, while Apple SIGNUP/LINK stays fail-closed until the revocation/token lifecycle is implemented.

## 2. LOTBI data entered during Social Signup

Provider data minimization does not mean Social Signup stores only `provider_subject`.

After Provider SIGNUP verification, the user directly enters LOTBI account data:

- LOTBI display name (`User.name`);
- LOTBI account handle / username (`AccountIdentity.handle`), validated by the existing Consumer Username Policy.

Core then stores/creates the account-security and evidence records required by the normal signup lifecycle, including:

- provider + `provider_subject` external identity;
- external identity status/linkage;
- installation record;
- ENROLLMENT session followed by Passkey registration;
- required legal consent evidence;
- recovery codes after successful Passkey enrollment under the existing account flow.

`ExternalAccountIdentity.email=None`, `email_verified=False`, and `profile_json={}` in the reviewed Social Signup provisioning contract. The external identity `display_name` is populated from the user-entered LOTBI name, not imported from the Provider profile.

## 3. Required legal consent evidence

Social Signup requires exactly two LOTBI-owned required consents:

1. `TERMS_OF_SERVICE`
2. `PRIVACY_POLICY`

For each consent Core requires the server-owned manifest values to match exactly:

- consent key;
- document version;
- document SHA-256;
- HTTPS document URI;
- decision `ACCEPTED`;
- `required=true`;
- locale.

Core stores a `UserConsentRecord` with `source=SOCIAL_SIGNUP`, installation reference, provider/flow evidence, and `server_manifest_verified=true`. Provider subject is not copied into the consent evidence payload.

Account Web fetches the manifest from Core and does not allow the browser to invent version/hash values. Both required checkboxes must be accepted before Social Signup completion.

## 4. Four distinct lifecycle operations

| Operation | Current LOTBI behavior | Provider-side requirement/status |
|---|---|---|
| A. Social Login unlink | retained LOTBI account; local external identity -> `REVOKED`; limited sessions/unfinished flows revoked; unique subject reservation retained | generic Core path currently performs no remote revoke |
| B. LOTBI account deletion request | access/authority revoked; external identities locally revoked; deletion lifecycle starts | Provider-specific disconnect/revoke must be handled separately where required |
| C. LOTBI final purge | separate operational erasure workflow, with lawful/security retention exceptions | not itself a Provider API operation |
| D. Provider authorization revoke/unlink | Provider-specific authorization relationship is ended | must follow each Provider's current lifecycle requirements |

Do not describe A, B, C and D as the same action.

## 5. Provider-specific lifecycle findings

### Google

Current reviewed LOTBI flow stores no Google access/refresh token as account identity data. No extra Provider-data permission is introduced here. Google unlink/account-linking policy remains separate from LOTBI local account deletion wording and must be finalized against the actual Google integration mode used at launch.

### Kakao

Current generic LOTBI unlink is local-only. Kakao's current official Login documentation says that when a Kakao Login user requests service account deletion or unmapping, the service must include a Kakao Unlink API request; Kakao unlink revokes the issued tokens/authorization. Kakao also provides unlink webhooks for Provider-originated disconnect events.

Status: `KAKAO_PROVIDER_LIFECYCLE_BLOCKER — UNLINK/ACCOUNT_DELETION INTEGRATION REQUIRED` before Kakao Production Social Signup is called complete.

### NAVER

Current generic LOTBI unlink is local-only. NAVER's current official Login guide documents Token Revocation when the user stops using the service or no longer wants NAVER Login linkage, and separately documents a disconnect callback for Provider-originated unlink events.

Status: `NAVER_PROVIDER_LIFECYCLE_BLOCKER — TOKEN_REVOCATION/DISCONNECT INTEGRATION VERIFY` before NAVER Production Social Signup is called complete.

### Apple

Reviewed Apple LOGIN verification exists. Apple SIGNUP/LINK remains blocked because Core does not yet retain encrypted durable revocation material needed for later `/auth/revoke` lifecycle. The current integration handoff requires Apple-specific remote revoke when an Apple identity association is explicitly ended and when the LOTBI account deletion lifecycle ends that association, plus safe retry/reconciliation and S2S notification handling.

Status: `APPLE_SOCIAL_AUTH_LIFECYCLE_BLOCKER`.

## 6. Provider-subject reservation and retention

Current local unlink retains the external identity row/unique provider-subject reservation after status becomes `REVOKED`, preventing silent migration of a Provider identity to another LOTBI user.

Public policy must not promise immediate hard deletion of `provider_subject` on local unlink.

For final account deletion/purge, the legal basis, duration, transformation or erasure rule for a revoked/reserved `provider_subject` remains:

`LEGAL_REVIEW_REQUIRED — PROVIDER_SUBJECT_RETENTION_BASIS_AND_PERIOD`.

## 7. Deletion timing

Core has configurable purge timing and a local default of 30 days. The actual Production value has not been verified and must not be published as a fixed 30-day promise from this evidence alone.

## 8. Production legal-manifest state

The review code has a server-owned manifest contract, but current Production does not yet expose the reviewed `/v2/sessions/providers/signup/consents` endpoint and the public Privacy/Terms pages remain pre-release documents.

Status: `PRODUCTION LEGAL MANIFEST = NOT DEPLOYED / NOT GREEN`.

## 9. LEGAL_REVIEW_REQUIRED

- overseas-transfer classification/disclosure;
- third-party provision vs entrusted processing vs other legal characterization;
- reserved/revoked `provider_subject` retention basis and period;
- statutory transaction/audit retention requirements;
- under-14/minor eligibility and guardian consent;
- final public purge period;
- final Provider-specific deletion/unlink disclosures after lifecycle implementation.
