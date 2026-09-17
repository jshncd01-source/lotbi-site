# GOOGLE SCOPE CONTRACT VERIFY

Research date: 2026-09-17 (Asia/Seoul)

Status: `CORE_SOCIAL_AUTH_BLOCKER — GOOGLE_SCOPE_CONTRACT_VERIFY`

Boundary: readiness analysis only. This document does not change Core scope, register a Google OAuth client, activate Production OAuth, create a secret, or submit Google verification.

## 1. Current LOTBI contract

`lotbi-core/main` currently builds the Google Web authorization request with:

- `response_type=code`
- `scope=openid`
- `state`
- `nonce`
- PKCE S256 (`code_challenge`, `code_challenge_method=S256`)
- provider-specific HTTPS redirect URI loaded from deployment configuration

LOTBI's current canonical external identity uses the verified Google `sub` as the provider subject. Google email, name, profile image, and other profile claims are not used as the account key and are not currently persisted as Social Login identity data.

## 2. Official Google scope facts

Google's OAuth scope catalog lists `openid`, `email`, and `profile` as separate scopes.

Therefore this readiness work does **not** conclude that `openid`-only is invalid merely because LOTBI does not request `email` or `profile`.

At the same time, Google's current OpenID Connect authorization reference describes the `scope` parameter for its OIDC flow as beginning with `openid` and including `profile`, `email`, or both. Because the official materials must be reconciled against the real current endpoint behavior, LOTBI must verify its minimum flow with a valid configured Google OAuth client before Production activation.

No scope is expanded from this readiness room.

## 3. What is already implemented locally in Core

The current Google adapter verifies:

- RS256 signature against Google's JWKS
- issuer (`https://accounts.google.com`, with Google's legacy issuer form accepted by the adapter)
- audience contains the configured client ID
- `azp` when multiple audiences are present
- nonce presence and equality where an expected nonce is supplied by the common flow contract
- `sub` shape
- `iat` / `exp` lifetime

The common Social Auth flow additionally binds and verifies:

- one-time state
- opaque binding secret
- exact provider / issuer / client ID / redirect URI contract
- callback purpose
- callback replay prevention
- exact redirect URI equality
- PKCE verifier for Google Web

These local checks demonstrate LOTBI's intended security contract. They do **not** prove that Google's live Production-compatible authorization endpoint will complete successfully with `scope=openid` only.

## 4. Live verification gate

Before this blocker can be closed, the Social Login integration workstream must verify all of the following against a valid Google OAuth client configured for the LOTBI test/integration environment:

1. authorization request with the minimum scope set is accepted;
2. authorization code is returned to the exact registered callback;
3. token exchange succeeds;
4. an ID token is issued;
5. the ID token contains a usable stable `sub`;
6. issuer validation succeeds;
7. audience / authorized-party validation succeeds;
8. nonce continuity succeeds;
9. state / binding / callback replay protections succeed;
10. Google OAuth consent configuration matches LOTBI's actual requested scopes and public policy URLs.

## 5. Decision rule

- If `openid`-only completes the real flow and satisfies Google's current configuration/review requirements, retain the minimum `openid` scope and do not add `email` or `profile`.
- If Google technically requires one of the additional standard identity scopes for the selected production flow, add only the smallest technically required scope in the integration workstream, then update the Privacy/data matrix before any provider submission.
- Do not request email/profile merely to make a consent screen look conventional or to simplify review.

## 6. Current assessment

- `openid` is a documented Google scope: **CONFIRMED**
- `email` and `profile` are separate scopes: **CONFIRMED**
- LOTBI needs Google email/name/profile for its current identity model: **NO**
- Core local `sub`/issuer/audience/nonce/state security contract: **IMPLEMENTED**
- Google `openid`-only live Production-compatible authorization: **UNVERIFIED**
- Scope expansion authorized from this readiness room: **NO**
- Blocker status: `GOOGLE_SCOPE_CONTRACT_VERIFY` remains open until real integration E2E evidence exists.
