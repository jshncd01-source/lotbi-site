# CORE_SOCIAL_AUTH_BLOCKER — APPLE_REVOCATION_LIFECYCLE

Research date: 2026-09-17 (Asia/Seoul)

Owner for implementation: LOTBI Social Login integration workstream (`lotbi-core` / authorized Account integration work)

Readiness-room boundary: documentation and handoff only. Do not modify Core, generate an Apple private key, register Production credentials, change Apple identifiers, or activate Apple signup/link from this branch.

## 1. Current LOTBI account-deletion lifecycle

Current Core account deletion intentionally separates immediate access revocation from final erasure.

On a LOTBI account deletion request Core currently:

- marks the account/identity as deletion requested;
- revokes active LOTBI sessions;
- revokes active delegated-payment grants;
- moves Passkeys/installations/challenges/push subscriptions into revoked/deletion/cancelled states as applicable;
- moves active external-provider identities to local `REVOKED` state;
- cancels unfinished Social Auth flows tied to the user/identity;
- records remote Provider revocation as a separate provider policy;
- schedules final erasure through an operational purge workflow rather than claiming immediate hard deletion.

## 2. Current external-identity unlink behavior

The generic LOTBI unlink path is local-only:

- requires a FULL LOTBI session and fresh Passkey proof;
- sets the selected `ExternalAccountIdentity` to `REVOKED`;
- revokes relevant `FEDERATED_LIMITED` sessions;
- cancels unfinished related external-auth flows;
- keeps the identity's UNIQUE provider-subject reservation;
- records `remote_revocation_performed=false`;
- never calls the Provider to delete its account or revoke its authorization.

This is correct for the generic local unlink contract but must not be described as Apple authorization revocation.

## 3. Why Apple signup/link is currently blocked

Current Core can verify Apple login identity tokens and exchange an Apple authorization code using a server-generated Apple client-secret JWT.

However, the current Apple exchange path extracts and returns only the `id_token` from the Apple token response. Any Apple access/refresh token in the response is not persisted as durable revocation material.

Apple's account-deletion guidance for apps using Sign in with Apple requires revoking the user's Apple authorization/token relationship when the user deletes the app account. A reliable revoke-on-deletion lifecycle therefore needs durable, securely retrievable revocation material associated with the correct Apple external identity.

Until that exists and is tested, Apple SIGNUP/LINK must remain fail-closed with `EXTERNAL_APPLE_REVOCATION_REQUIRED`.

## 4. Provider revoke timing

The integration workstream must distinguish at least these moments:

### A. Normal Apple login

- Verify Apple identity.
- Do not revoke authorization merely because a normal login completed.

### B. Apple identity unlink from a retained LOTBI account

Current generic LOTBI semantics are local unlink only.

Whether an Apple-specific unlink should additionally call Apple's revoke endpoint is a product/security decision to be explicitly defined. Do not silently equate local unlink with remote Apple revoke because doing so can change the user's authorization state outside LOTBI.

Status: `USER_DECISION_REQUIRED — APPLE_UNLINK_REMOTE_REVOKE_POLICY` before implementing Apple-specific unlink behavior.

### C. LOTBI member account deletion

For an account that uses Sign in with Apple, the Apple authorization/token relationship must be included in the deletion lifecycle. The implementation should enqueue/perform an idempotent Apple revoke operation using the correct stored revocation material, record success/failure without logging secrets, and reconcile retryable/unknown outcomes before declaring the provider-side lifecycle complete.

### D. Apple-originated authorization/account changes

Apple server-to-server notifications can report events such as `consent-revoked` and `account-deleted`. The integration design should consume validated Apple notifications and reconcile the related LOTBI external identity/session state.

A server-to-server notification does not replace LOTBI's own revoke-on-account-deletion obligation.

## 5. Access/refresh token retention requirement

Current Core does not retain Apple access/refresh tokens.

The implementation workstream must determine the exact Apple token type accepted and most suitable for durable later revocation under the current Apple API. The design should prefer the least-privileged revocation material that Apple accepts and that can be reliably associated with the external identity.

Whatever token is selected:

- store only when necessary for Apple lifecycle compliance;
- encrypt at rest in a dedicated provider-token vault or equivalent protected storage;
- bind it to provider, external identity, client/service identifier, key version and lifecycle status;
- never expose it through user/admin read APIs;
- never write plaintext token values to logs, audit payloads, traces, exceptions or analytics;
- support key rotation and explicit deletion after the provider lifecycle no longer requires it;
- ensure duplicate deletion/revoke attempts are idempotent and safe.

Status: `CORE IMPLEMENTATION REQUIRED`.

## 6. Apple client secret / private key boundary

Current Core's Apple client secret is generated server-side as a short-lived ES256 JWT from:

- Apple Team ID;
- Apple Key ID;
- Apple private key file;
- the configured Apple client/Services ID.

Rules:

- Apple private key remains a server-side Production secret, never committed to source or this readiness repository;
- client-secret JWT is generated at use time and should not be persisted as a long-lived database credential;
- private-key contents and generated client-secret values must never be logged;
- the same protected secret boundary is used for Apple's token/revoke calls;
- key/credential creation is a later authorized owner/integration step, not readiness work.

## 7. Apple server-to-server notification handoff

Integration should evaluate and implement Apple's server-to-server account-change notification endpoint for the final Apple Production lifecycle.

Minimum design requirements:

- TLS endpoint under an approved LOTBI server host;
- validate Apple's signed payload before any state mutation;
- handle relevant authorization/account lifecycle events idempotently;
- map the event to the correct Apple external identity without exposing raw credentials;
- revoke/disable LOTBI federated sessions as appropriate;
- preserve audit evidence without secret/token contents;
- protect against replay/duplicate delivery;
- define retry/reconciliation behavior.

Status: `CORE_SOCIAL_AUTH_HANDOFF — APPLE_SERVER_TO_SERVER_NOTIFICATION`.

## 8. Account deletion vs unlink vs final purge vs Provider revoke

| Lifecycle | Local LOTBI account retained? | Local external identity | Final LOTBI data erase? | Apple authorization remotely revoked? |
|---|---|---|---|---|
| Apple unlink | YES | `REVOKED`, reservation retained | NO | CURRENTLY NO; policy decision required for future Apple-specific behavior |
| LOTBI account deletion request | NO active use; deletion lifecycle starts | active links -> `REVOKED` | NOT YET; purge follows | MUST be included for Sign in with Apple accounts before lifecycle is complete |
| LOTBI final purge | NO | subject retention treatment depends on final policy/legal design | YES except lawful/security retention | separate from local database purge; reconcile Apple revoke result |
| Apple authorization revoke event | LOTBI account may or may not still exist | must reconcile identity/session usability | NO automatic LOTBI account hard-delete solely by terminology | Provider-side authorization is revoked |

## 9. Required tests before opening Apple SIGNUP/LINK

At minimum:

1. Apple token material is captured only when required and encrypted at rest;
2. no secret/token appears in logs/repr/audit/API responses;
3. account deletion triggers Apple revoke exactly once logically, with safe idempotent retry;
4. Provider rejection vs temporary outage is distinguished;
5. crash/unknown-state recovery cannot silently skip required revoke;
6. successful revoke marks provider-lifecycle evidence without claiming immediate LOTBI hard deletion;
7. Apple unlink behavior matches the explicit approved unlink policy;
8. server-to-server signed notifications validate and reconcile safely;
9. revoked/deleted Apple identity cannot mint a usable LOTBI federated session;
10. regression confirms Google/Kakao/NAVER lifecycle behavior is unchanged.

## 10. Closure condition

`CORE_SOCIAL_AUTH_BLOCKER — APPLE_REVOCATION_LIFECYCLE` may close only after the integration workstream produces implementation + migration/security review + tests + real Apple development/sandbox evidence for the approved lifecycle.

Readiness documentation alone does not close this blocker.
