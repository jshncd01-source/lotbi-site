# LOTBI Social Login Provider Data & Lifecycle Matrix

Research date: 2026-09-17 (Asia/Seoul)

Status: INTERNAL REVIEW BASELINE / LEGAL_REVIEW_REQUIRED WHERE MARKED

## 1. Provider data matrix

Classification:
- `REQUIRED`: needed by the current LOTBI Social Auth identity contract.
- `OPTIONAL`: not required now; may be added only for a future real product need with matching Core/policy/consent changes.
- `UNUSED`: LOTBI does not currently need or persist this data for Social Login identity.

| Provider | Stable subject / identifier | Email | Name | Profile / picture | Other scopes / personal data |
|---|---|---|---|---|---|
| Google | `REQUIRED` — verified OIDC `sub` | `UNUSED` | `UNUSED` | `UNUSED` | `UNUSED`; no phone, birthday, gender, address, friends |
| Kakao | `REQUIRED` — verified OIDC `sub` | `UNUSED` | `UNUSED` | `UNUSED` | `UNUSED`; no additional personal-information permission without product need |
| NAVER | `REQUIRED` — official app-scoped profile `response.id` | `UNUSED` | `UNUSED` | `UNUSED` | `UNUSED`; no phone, birthday/birth year, gender, age range without product need |
| Apple | `REQUIRED` for enabled Social identity — verified Apple `sub` | `UNUSED` | `UNUSED` | `UNUSED` | `UNUSED`; no email/private-relay/full-name dependency in current Core |

### Google scope note

Current Core asks for `openid` only. Google lists `openid`, `email`, and `profile` as separate scopes, so LOTBI does not add email/profile merely because they are common identity scopes. Live Production-compatible `openid`-only authorization remains a separate integration verification gate.

### NAVER transport note

NAVER Web/native may receive tokens needed to complete provider verification, but Core uses the official profile `response.id` as the canonical provider subject. Token receipt during authentication is not equivalent to persisting every field returned by NAVER.

### Apple lifecycle note

Apple signup/link remains fail-closed until the provider-token revocation lifecycle is implemented. Marking Apple `sub` as required describes the intended identity key when that lifecycle is enabled; it does not mean Apple signup/link is already Production-ready.

## 2. Four distinct lifecycle operations

The following operations must never be collapsed into one policy term.

| Operation | What it means | Current LOTBI/Core behavior | Provider-side effect | Current status |
|---|---|---|---|---|
| A. Social Login unlink | Stop using one external Provider identity on an otherwise retained LOTBI account | Requires strong LOTBI proof; local `ExternalAccountIdentity` becomes `REVOKED`; associated limited federated sessions/unfinished flows are revoked/cancelled; UNIQUE subject reservation remains | Current generic unlink does **not** remotely revoke Provider authorization | IMPLEMENTED LOCAL LIFECYCLE |
| B. LOTBI account deletion request | Begin deletion of the LOTBI member account | Account/identity enter deletion state; active sessions, grants, installations, challenges, push subscriptions and active external identity links are revoked/cancelled immediately | Remote Provider revoke is explicitly a separate provider policy/lifecycle | IMPLEMENTED LOCAL LIFECYCLE |
| C. LOTBI final purge | Final erasure after the deletion request, subject to retention rules | Separate operational purge workflow; no claim of immediate hard delete; transaction/audit records may be retained only where legally/security required | Not inherently a Provider authorization operation | PRODUCTION RETENTION/PURGE VALUE VERIFY + LEGAL REVIEW |
| D. Provider authorization revoke | Revoke the authorization/token relationship at Google/Kakao/NAVER/Apple where required | Not performed by the generic local unlink path; must be implemented provider-specifically where required | Changes Provider authorization/token state | PROVIDER-SPECIFIC; APPLE ACCOUNT-DELETION BLOCKER OPEN |

## 3. Provider-subject reservation

Current local unlink deliberately retains the external identity row/UNIQUE reservation after it moves to `REVOKED` status. This prevents a Provider subject from silently moving to another LOTBI user.

A same-owner explicit LINK with fresh LOTBI Passkey/provider proof may reactivate the identity under the current design.

Therefore policy text must not promise that Social Login unlink immediately hard-deletes the provider subject.

For LOTBI account deletion, active external identities are also moved to `REVOKED`. Whether the reserved `provider_subject` must later be erased, transformed, or retained for a specific period/basis after final purge is not yet a legal-policy conclusion.

Status: `LEGAL_REVIEW_REQUIRED — PROVIDER_SUBJECT_RETENTION_BASIS_AND_PERIOD`.

## 4. Deletion timing

Core has a configurable `account_deletion_purge_days` and its local default is 30 days. The deployed Production value has not been verified in this readiness work. Public policy must therefore not state a fixed 30-day purge period until the Production configuration and legal retention model are both confirmed.

## 5. Minimum policy statements supported by current implementation

A review draft may accurately state that:

- LOTBI uses a provider-specific stable identifier for Social Login account identity;
- Google/Kakao/NAVER/Apple email/name/profile data are not currently required or persisted as Social Login identity data under the current minimum contract;
- unlinking an external sign-in method is different from deleting a LOTBI account;
- LOTBI account deletion revokes account access first and uses a separate purge process;
- local unlink/account deletion do not automatically mean the external Provider account itself is deleted;
- Provider-side authorization revocation is a separate provider-specific lifecycle;
- legal/security retention exceptions and provider-subject retention require final policy/legal review.

## 6. Legal review boundary

Keep these unresolved until reviewed against the final Production architecture and applicable law:

- overseas transfer classification and disclosure;
- third-party provision vs entrusted processing vs other legal characterization;
- exact basis/period for reserved/revoked `provider_subject`;
- statutory transaction/audit retention items and periods;
- under-14/minor account policy and guardian consent;
- exact public purge timing.
