# CORE_SOCIAL_AUTH_BLOCKER — APPLE REVOCATION / TOKEN LIFECYCLE

Research date: 2026-09-17 (Asia/Seoul)

Status: `APPLE_SOCIAL_AUTH_LIFECYCLE_BLOCKER — OPEN`

Owner for implementation: LOTBI Social Login integration/Core workstream.

Readiness boundary: documentation/handoff only. Do not modify Core from this branch, create an Apple private key, register Production credentials, change Apple identifiers, or activate Apple SIGNUP/LINK.

Implementation baselines:
- Core Social review: `b555420b8d75c9e241a6cd9bd534f205499a87d8`
- Account Social review: `5eadea164d559a4f3c45dfca18d6c2acf95a40c0`

## 1. Current reviewed Apple status

- Apple LOGIN verification contract: `READY BY REVIEW`
- Apple SIGNUP: `BLOCKED`
- Apple LINK: `BLOCKED`
- reviewed lifecycle blocker: `APPLE_SOCIAL_AUTH_LIFECYCLE_BLOCKER`
- reason: `REVOCATION_LIFECYCLE_REQUIRED`

The production activation gate deliberately reports Apple SIGNUP/LINK purpose support as false even when other provider configuration exists.

## 2. Existing LOTBI local deletion/unlink lifecycle

Generic LOTBI unlink currently:

- requires strong LOTBI proof;
- changes the external identity to local `REVOKED`;
- revokes relevant limited sessions;
- cancels unfinished related Social Auth flows;
- preserves the unique provider-subject reservation;
- records no remote Provider revocation.

LOTBI account deletion currently separates:

- immediate account/session/authority revocation;
- local external-identity revocation;
- later operational purge;
- lawful/security retention exceptions;
- remote Provider lifecycle as a separate responsibility.

This generic local behavior must not be described as Apple token revocation.

## 3. Why Apple SIGNUP/LINK remains blocked

The reviewed Apple authorization-code path can generate a server-side Apple client-secret JWT, exchange the authorization code and verify the Apple ID token.

However, the current flow does not retain durable encrypted Apple revocation material for later provider-side revocation. A future account created/linked with Apple therefore could not yet guarantee the required revoke lifecycle when the association ends.

Apple's current REST API provides `POST https://appleid.apple.com/auth/revoke` and requires the matching client identifier plus server-generated client secret and a revocable token.

Until the token lifecycle exists and is tested, Apple SIGNUP/LINK must remain fail-closed.

## 4. Authoritative integration handoff delta

The current production-integration review has resolved the earlier readiness question about Apple-specific unlink direction: the future Apple lifecycle should include provider-side revoke when the Apple association is explicitly ended, not only when the whole LOTBI account is deleted.

Required Apple-specific behavior after implementation:

### A. Normal Apple LOGIN

- verify identity;
- do not revoke merely because login succeeded.

### B. Explicit Apple unlink while retaining LOTBI account

- keep LOTBI account according to local unlink policy;
- local Apple external identity becomes `REVOKED`;
- perform or durably schedule the Apple authorization revoke using protected revocation material;
- safely reconcile retryable/unknown results;
- do not claim the Apple Account itself was deleted.

### C. LOTBI account deletion

- local account deletion lifecycle starts immediately;
- Apple authorization revoke must be performed or durably scheduled before provider-side lifecycle closure is claimed;
- final local purge remains a separate step.

### D. Apple-originated authorization/account changes

- validate and reconcile Apple server-to-server account-change notifications where implemented;
- relevant events include authorization/account lifecycle changes such as consent revocation/account deletion;
- Provider notification does not replace LOTBI's own required revoke path when LOTBI initiates the association termination.

## 5. Revocation material requirements

The Core workstream must choose the appropriate Apple revocable token under the final Apple API contract; the reviewed integration design prefers durable refresh-token material where available/appropriate.

Requirements:

- capture only the minimum revocation material needed;
- encrypt at rest in a dedicated provider-token vault or equivalent protected storage;
- bind to correct provider/external identity/client identifier/key version/lifecycle state;
- never expose token material through user/admin APIs;
- never write plaintext tokens, Apple private key or generated client-secret values to logs, audit payloads, traces, errors or analytics;
- support key rotation;
- support deletion of revocation material when no longer required;
- make revoke processing idempotent/retryable;
- reconcile uncertain external outcomes rather than silently marking success.

## 6. Apple private key / client secret boundary

Server-side Apple client-secret JWT generation uses protected Team ID, Key ID, private key and matching client/Services ID.

- `.p8` remains a server-side secret;
- no `.p8` or secret is committed to the readiness repo;
- client-secret JWT is generated at use time rather than treated as a public/static credential;
- key/credential creation is a later explicitly authorized owner/integration action.

## 7. Server-to-server notification handoff

Before Apple Social Signup/Link Production activation, integration should close the final S2S notification design:

- approved TLS endpoint;
- signed payload validation;
- identity mapping without secret exposure;
- replay/duplicate protection;
- idempotent state reconciliation;
- session/identity handling for revoked authorization;
- safe audit evidence;
- retry/reconciliation semantics.

## 8. Lifecycle matrix

| Lifecycle | LOTBI account retained? | Local external identity | Apple remote revoke |
|---|---|---|---|
| Apple LOGIN | YES | active when already linked | NO |
| explicit Apple unlink | YES | -> `REVOKED`, reservation policy retained | `REQUIRED BY REVIEWED FUTURE LIFECYCLE`, not implemented yet |
| LOTBI account deletion | NO active account use | active Apple link -> `REVOKED` | `REQUIRED`, not implemented yet |
| final LOTBI purge | NO | final subject handling depends on legal/security policy | separate from Apple revoke result |
| Apple-originated revoke/account event | account may still exist | reconcile identity/session usability | Provider already changed authorization state |

## 9. Required closure evidence

Do not open Apple SIGNUP/LINK until integration evidence shows at least:

1. protected revocation token capture/storage;
2. no token/key/client-secret leakage;
3. explicit Apple unlink triggers safe remote revoke lifecycle;
4. LOTBI account deletion triggers safe remote revoke lifecycle;
5. idempotent retry and unknown-state recovery;
6. rejection vs temporary outage handling;
7. validated S2S notification/reconciliation if required by final architecture;
8. revoked Apple identity cannot mint a usable LOTBI federated session;
9. migrations/security tests complete;
10. real Apple development/sandbox E2E evidence;
11. Google/Kakao/NAVER regression remains unaffected.

## 10. Closure condition

`APPLE_SOCIAL_AUTH_LIFECYCLE_BLOCKER` closes only after implementation + migration/security review + tests + real Apple E2E evidence.

Readiness documentation and Console configuration alone never close this blocker.
