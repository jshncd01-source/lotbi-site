# LOTBI Social Login Callback Contract Readiness

Research date: 2026-09-17 (Asia/Seoul)

Status: INTERNAL READINESS / NO PROVIDER REGISTRATION

## 1. Authoritative ownership

For Web Social Login, `lotbi-core` owns the provider authorization-code transport and loads each exact redirect URI from deployment configuration:

`LOTBI_SOCIAL_<PROVIDER>_WEB_REDIRECT_URI`

Core requires the configured redirect URI to be HTTPS and to contain no query or fragment. The exact redirect URI is persisted into the external-auth flow contract and the callback must match it exactly.

Account Web does not have authority to invent a provider callback independently of that Core contract.

Android/iOS do not reuse the Web callback contract; native provider SDK tokens are submitted to Core through the native Social Auth endpoints.

## 2. Current integration evidence

Core tests use an example/test-fixture pattern:

`https://account.lotbiai.com/auth/web/<provider>/callback`

This demonstrates the expected security shape and host family, but it is **not** sufficient evidence of the authoritative Production callback because the value is injected by a test helper rather than loaded from an approved deployed integration configuration.

The currently inspected Account Web Social Signup review branch still states that it does not own provider authorization URLs or callback handling, and it does not contain the matching provider callback implementation required to close this contract.

Therefore no Provider Console callback value may be copied from the test fixture yet.

## 3. Provider callback matrix

| Provider | Authoritative Web callback | Status | Registration action |
|---|---|---|---|
| Google | not yet fixed by deployed integration contract | `CALLBACK_PENDING_INTEGRATION` | DO NOT REGISTER YET |
| Kakao | not yet fixed by deployed integration contract | `CALLBACK_PENDING_INTEGRATION` | DO NOT REGISTER YET |
| NAVER | not yet fixed by deployed integration contract | `CALLBACK_PENDING_INTEGRATION` | DO NOT REGISTER YET |
| Apple | not yet fixed by deployed integration contract | `CALLBACK_PENDING_INTEGRATION` | DO NOT REGISTER YET |

## 4. Closure criteria

A Provider callback becomes authoritative only when the Social Login integration workstream has all of the following for that Provider:

1. an Account Web/Core callback transport implementation or explicitly approved Core-owned callback route;
2. a single exact HTTPS URI in the deployment contract;
3. Core `LOTBI_SOCIAL_<PROVIDER>_WEB_REDIRECT_URI` configured to that exact URI in the approved integration environment;
4. Account Web/BFF routing compatible with that exact URI where Account Web participation is required;
5. successful start -> Provider -> callback -> Core finish E2E evidence;
6. no query/fragment embedded in the registered URI;
7. the same exact URI copied to the Provider console.

Until all seven are true, the readiness status remains `CALLBACK_PENDING_INTEGRATION`.

## 5. Native boundary

Native Android/iOS use `POST /v2/sessions/providers/native/start` and `POST /v2/sessions/providers/native/complete` plus provider SDK tokens. They must not be documented as using the Web redirect URI merely because the Web callback is pending.

## 6. Current decision

No authoritative Provider Web callback URI can be safely finalized from the current repositories without completing the integration workstream. Keeping all four entries pending is a deliberate accuracy decision, not a missing-document error.
