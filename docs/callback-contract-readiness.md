# LOTBI Social Login Callback Contract Readiness

Research date: 2026-09-17 (Asia/Seoul)

Status: `CALLBACK CONTRACT GREEN — REVIEW CODE / NOT REGISTERED OR DEPLOYED`

This is an internal readiness record. It does not register Provider Console callbacks, modify Production environment values, activate OAuth, or promote Core/Account review branches.

## 1. Authoritative implementation baselines

- Core Social review HEAD: `b555420b8d75c9e241a6cd9bd534f205499a87d8`
- Account Social review HEAD: `5eadea164d559a4f3c45dfca18d6c2acf95a40c0`
- Contract: `LOTBI_SOCIAL_AUTH_V2`

Core owns the provider authorization-code contract and loads each exact Web redirect from:

`LOTBI_SOCIAL_<PROVIDER>_WEB_REDIRECT_URI`

Account Web owns the canonical public callback route and fails closed unless Core readiness reports the exact same callback, the provider is configured, and provider-scoped Production activation is enabled.

## 2. Exact Web callback contract

| Provider | Authoritative review-code callback |
|---|---|
| Google | `https://account.lotbiai.com/api/auth/providers/google/callback` |
| Kakao | `https://account.lotbiai.com/api/auth/providers/kakao/callback` |
| NAVER | `https://account.lotbiai.com/api/auth/providers/naver/callback` |
| Apple | `https://account.lotbiai.com/api/auth/providers/apple/callback` |

These values replace the earlier readiness-only `CALLBACK_PENDING_INTEGRATION` status.

Do not confuse them with the old Core test-fixture pattern `https://account.lotbiai.com/auth/web/<provider>/callback`.

## 3. Fail-closed matching rule

Account Web computes the canonical route from `accountOrigin` and `/api/auth/providers/<provider>/callback`. Provider buttons are enabled only when all relevant conditions are true:

- Core reports Web configured;
- Core returns an HTTPS redirect URI;
- Core redirect URI equals the Account canonical callback exactly;
- provider-scoped `production_activation` is true;
- the requested LOGIN/SIGNUP purpose is enabled;
- SIGNUP additionally requires the Core legal consent manifest to be configured.

Apple SIGNUP/LINK remains purpose-blocked regardless of callback readiness until its provider lifecycle blocker closes.

## 4. Production state is separate

The callback **code contract** is GREEN, but no Provider Console registration or Production environment change was performed by this readiness work.

Current Production still shows Social providers as preparation/not active and the Production legal-manifest endpoint is not deployed. Therefore the callbacks are not yet claimed as registered-and-live Production callbacks.

Status split:

- callback route contract in review code: `GREEN`
- Provider Console callback registration: `NOT PERFORMED`
- Production redirect env configuration: `NOT CHANGED BY THIS WORK`
- real Provider callback E2E: `PENDING`

## 5. Native boundary

Android/iOS do not reuse these Web callback URLs. Native clients use official Provider SDK tokens and Core native Social Auth endpoints.

## 6. Registration rule

When the external owner/configuration gate is eventually opened, the Provider Console must receive exactly the callback listed for that Provider above. No alternative hostname, path, query, fragment, or legacy test-fixture route should be registered without a matching reviewed contract change.
