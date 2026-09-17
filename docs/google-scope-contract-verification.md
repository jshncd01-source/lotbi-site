# GOOGLE SCOPE CONTRACT VERIFY

Research date: 2026-09-17 (Asia/Seoul)

Status: `CORE_SOCIAL_AUTH_BLOCKER — GOOGLE_SCOPE_CONTRACT_VERIFY`

Boundary: readiness analysis only. This document does not create/configure a Google OAuth client, change scopes, register a callback, activate Production OAuth, create a secret, or submit Google verification.

Implementation baselines:
- Core Social review: `b555420b8d75c9e241a6cd9bd534f205499a87d8`
- Account Social review: `5eadea164d559a4f3c45dfca18d6c2acf95a40c0`

## 1. Current reviewed LOTBI Google contract

The reviewed Web authorization contract uses:

- `response_type=code`
- `scope=openid`
- `state`
- `nonce`
- PKCE S256
- exact HTTPS callback `https://account.lotbiai.com/api/auth/providers/google/callback`

Canonical Social identity is Google `sub`. Google email/name/profile are not required or persisted as Provider profile identity data.

## 2. Scope interpretation

Google documents `openid`, `email` and `profile` as separate scopes. Therefore LOTBI does **not** declare `openid`-only invalid simply because `email` or `profile` are absent.

Google's current OIDC authorization reference also describes its documented OIDC scope parameter as beginning with `openid` and including `profile`, `email`, or both. The correct LOTBI action is real configured-client verification, not speculative scope expansion.

No scope expansion is authorized by this readiness document.

## 3. Security contract already present in review code

The reviewed Core contract validates/binds:

- Google JWKS / RS256 signature
- issuer
- audience and `azp` where applicable
- stable `sub`
- nonce
- token lifetime
- one-time state/binding
- exact provider/client/redirect contract
- PKCE S256
- callback replay prevention

Account Web also fails closed unless Core readiness reports the exact canonical callback and provider-scoped Production activation.

## 4. What remains unverified

The following require a valid Google OAuth client and real integration execution, which this readiness room does not perform:

1. `scope=openid` authorization request accepted by the current Google endpoint;
2. authorization code returned to the exact registered callback;
3. token exchange succeeds;
4. ID token is issued;
5. `sub` is usable as the stable identity;
6. issuer/audience/`azp` checks pass on the real token;
7. nonce/state/PKCE continuity passes end-to-end;
8. Google consent configuration exactly reflects the requested scope;
9. branded Production configuration accepts the final public homepage/Privacy/Terms.

Status: `GOOGLE OPENID REAL E2E = PENDING`.

## 5. Production legal-manifest blocker

Even though callback code is now fixed, Google Console readiness is still blocked because current Production:

- publishes a pre-release Privacy page that says the public site does not provide signup;
- publishes a pre-release website use notice rather than Production Terms;
- does not yet expose the reviewed Social Signup consent-manifest endpoint;
- still shows Social providers as preparation/not active;
- has no real Google provider E2E evidence.

Therefore exact callback readiness does not by itself authorize Google Console work.

## 6. Decision rule

- If real Google E2E succeeds with `openid` only and the final Google configuration accepts it, keep `openid` and do not add `email`/`profile`.
- If the selected Google Production flow technically requires an additional standard identity scope, add only the smallest required scope in the integration workstream and update Privacy/data matrix before Provider submission.
- Never request `email`/`profile` simply for review convenience.

## 7. Current assessment

- callback code contract: `GREEN`
- `openid` documented as a scope: `CONFIRMED`
- `email` / `profile` separate scopes: `CONFIRMED`
- LOTBI functional need for Provider email/name/profile: `NO`
- local Core verification contract: `GREEN BY REVIEW`
- real `openid`-only Google E2E: `PENDING`
- Production Privacy: `BLOCKED`
- Production Terms: `BLOCKED`
- Production consent manifest: `NOT DEPLOYED`
- Google Console readiness: `BLOCKED`
- `USER_ACTION_REQUIRED — GOOGLE STEP 1`: `NOT YET`
