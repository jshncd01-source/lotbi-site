# PRODUCTION SOCIAL SIGNUP LEGAL MANIFEST — CROSS-REPO IMPLEMENTATION HANDOFF

> 상태: `COUNSEL-PACKAGE HANDOFF READY / DO NOT PUBLISH / DO NOT ACTIVATE PROVIDERS`
>
> 기준일: 2026-09-17 (Asia/Seoul)

Reviewed baselines:

- Core main baseline: `23d6c99658704a84a09c3edd7b3474a1db77387b`
- Core Social review HEAD: `b555420b8d75c9e241a6cd9bd534f205499a87d8`
- Account main baseline: `9cec0b958d22b566f9312521670c7d82d0740e41`
- Account Social review HEAD: `5eadea164d559a4f3c45dfca18d6c2acf95a40c0`
- Site readiness branch: `review/social-auth-provider-readiness-01-20260917`

Legal package sources:

- `docs/production-legal-review-package.md`
- `docs/production-legal-review-questionnaire.md`
- `docs/production-legal-review-decisions.md`
- `docs/production-personal-data-processing-inventory.md`
- `docs/production-privacy-candidate.md`
- `docs/production-terms-candidate.md`

This handoff authorizes no Production change. Legal decisions enter through `production-legal-review-decisions.md`; implementation begins only after the relevant decision is approved and the owning room is explicitly activated.

---

# A. LOTBI 공식사이트 개발방

Repository: `jshncd01-source/lotbi-site`

## Branch rule

The current readiness branch is documentation-only and diverged from Site `main`. **Do not merge this branch directly into main.**

After counsel decisions and user-required choices are closed:

1. fetch the then-current Site `main`;
2. create a fresh legal-page review branch from that main;
3. port only approved wording from `production-privacy-candidate.md` and `production-terms-candidate.md`;
4. preserve unrelated Site/mobile-entry/current UI work;
5. no Production publish or main promotion without explicit user approval.

## Target files

Primary:

- `privacy.html`
- `terms.html`

Conditional:

- `account-deletion.html` if Q14/Q15/Q28/Q29 changes public deletion/provider-lifecycle wording.
- checkout/subscription disclosure surfaces if Q19-Q24/Q34 requires Site-level display.

## Business fields currently confirmed

- 유한회사 알에이디홀딩스
- 대표자 전선혜
- 전북특별자치도 전주시 덕진구 혁신로 542, 1동 1층 (여의동)
- 사업자등록번호 583-88-03679
- 통신판매업신고번호 2026-전주덕진-0798
- `developer@lotbiai.com`
- `063-237-0930`

Do not invent the privacy officer/department. Apply Q16 decision only after corporate designation is supplied.

## Site legal decision mapping

| Decision IDs | Site action after approval |
|---|---|
| Q01-Q04 | final third-party/outsourcing/overseas-transfer Privacy sections |
| Q05-Q10 | retention, destruction, statutory-record wording |
| Q11-Q13 | minor policy/age eligibility Terms + Privacy wording |
| Q16 | CPO/privacy department public field |
| Q17-Q18 | signup/account formation wording |
| Q19-Q24 | Plus subscription/renewal/cancel/refund disclosures |
| Q25-Q27 | Merchant legal-role and transaction disclosure wording |
| Q28-Q29 | deletion/unlink/provider-revoke wording |
| Q30-Q33 | restriction/change/terms-change/liability sections |
| Q34 | operator field placement |
| Q35-Q36 | effective date/version/publication schedule |

## Freeze / hash gate

Only when all required wording is approved:

1. remove every `[PLACEHOLDER — DO NOT PUBLISH]`;
2. ensure unresolved markers are not present in public HTML;
3. freeze exact final UTF-8 `privacy.html` and `terms.html` bytes;
4. calculate SHA-256 from those exact bytes;
5. preserve the exact commit proposed for Production;
6. user explicitly approves Production publish;
7. deploy that exact commit;
8. fetch live HTTPS response and verify document/version/content identity before Core manifest is configured.

---

# B. LOTBI Core / Social Auth Core 소유방

Repository: `jshncd01-source/lotbi-core`

Reviewed Social baseline: `b555420b8d75c9e241a6cd9bd534f205499a87d8`

## Social legal manifest contract — no redesign

Keep:

- consent keys exactly `TERMS_OF_SERVICE`, `PRIVACY_POLICY`;
- both `required=true`, decision `ACCEPTED`;
- per-document server-owned version/SHA-256/HTTPS URI;
- `UserConsentRecord.source=SOCIAL_SIGNUP`;
- fail-closed missing/mismatch behavior;
- no separate `consent_manifest_version`.

Endpoints:

- `GET /v2/sessions/providers/signup/consents`
- `GET /v2/sessions/providers/readiness`

Environment contract after authorized Production publish:

- `LOTBI_SOCIAL_TERMS_VERSION`
- `LOTBI_SOCIAL_TERMS_SHA256`
- `LOTBI_SOCIAL_TERMS_URI=https://lotbiai.com/terms.html`
- `LOTBI_SOCIAL_PRIVACY_VERSION`
- `LOTBI_SOCIAL_PRIVACY_SHA256`
- `LOTBI_SOCIAL_PRIVACY_URI=https://lotbiai.com/privacy.html`

Manifest installation must not implicitly set any Provider Production activation true.

## Core legal-decision actions

| Decision IDs | Core action after approval |
|---|---|
| Q05-Q07 | provider_subject retention/transformation/purge contract |
| Q08-Q10 | statutory/security audit retention mapping |
| Q11-Q13 | age eligibility/account creation gate if policy chosen |
| Q14-Q15 | purge periods, receipt semantics, backup/log handoff |
| Q17-Q18 | account state/contract-formation UI/API semantics if needed |
| Q19-Q24 | Plus entitlement/refund/grace state machine once payments workstream begins |
| Q25-Q27 | transaction evidence/disclosure hooks if required by legal role |
| Q28-Q29 | Provider-specific unlink/revoke/account-deletion reconciliation |
| Q30 | restriction reason/notice/remedy evidence if required |
| Q32/Q36 | legal document version/reconsent and final manifest evidence |

## FREE usage handoff retained

Authoritative product policy remains:

- monthly 3 successful tasks;
- final successful user result only = charge;
- same-task clarification no extra charge;
- LOCAL/failure/cancel/incomplete no charge;
- same task max one charge across retries;
- reset day 1 00:00 KST;
- no carry-over;
- auditable compensation preserving original usage event.

This readiness room does not claim the Core usage ledger is implemented. Owning Core workstream must implement/test idempotency, concurrency, KST boundary, compensation and authoritative server count before implementation GREEN.

## Data-flow fact handoff to legal

Before counsel can close Q01-Q04/Q08-Q10 if more facts are requested, Core/Infra must supply:

- actual Production compute/database/log/backup vendor and regions;
- actual DPA/subprocessor versions;
- AI Provider exact Production payload categories and retention settings;
- payment/subscription reference schema when implemented;
- audit/deletion backup retention behavior.

Pilot `render.yaml` region is not accepted as Production proof.

---

# C. LOTBI Account Web 개발방

Repository: `jshncd01-source/lotbi-web`

Reviewed Social baseline: `5eadea164d559a4f3c45dfca18d6c2acf95a40c0`

## Social Signup contract retained

After Production Core manifest is eventually installed:

- show `이용약관 동의 (필수)`;
- show `개인정보 처리방침 동의 (필수)`;
- both required before signup completion;
- links/version/hash originate from Core server-owned manifest;
- Account must not invent legal metadata;
- Provider email must not silently merge accounts;
- `signup_consent_configured=false` remains fail-closed;
- Provider buttons remain fail-closed until exact callback/config/activation/purpose readiness;
- Apple SIGNUP/LINK remains blocked until Apple lifecycle closes.

Exact callbacks retained:

- Google `https://account.lotbiai.com/api/auth/providers/google/callback`
- Kakao `https://account.lotbiai.com/api/auth/providers/kakao/callback`
- NAVER `https://account.lotbiai.com/api/auth/providers/naver/callback`
- Apple `https://account.lotbiai.com/api/auth/providers/apple/callback`

## Account legal-decision actions

- Q11-Q13: age gate/signup eligibility UI if adopted
- Q17-Q18: account/Passkey completion messaging
- Q19-Q24: Web Plus checkout/subscription management surfaces if Account owns them
- Q28-Q30: unlink/deletion/restriction notice and status UI
- Q32: changed Terms/Privacy reconsent UI if legally required

Do not implement these decisions before the respective decision row is approved.

---

# D. LOTBI App / Store billing 소유방

No App code change is authorized from this room.

Future handoff after counsel:

- Q11-Q13: age eligibility parity across Android/iOS/Web
- Q20-Q24: App Store/Google Play subscription, cancellation, grace, refund, entitlement reconciliation
- Q28-Q29: native Social Provider unlink/deletion lifecycle where applicable
- Q34: required seller/subscription disclosures in native purchase flow

Android/iOS UI parity remains required except platform-mandated Store/HIG differences.

---

# E. Provider lifecycle blockers remain independent

- Google: `GOOGLE_SCOPE_CONTRACT_VERIFY = OPEN`
- Kakao: `KAKAO_PROVIDER_LIFECYCLE_BLOCKER — UNLINK + USER_ID DELETION/PURGE POLICY REQUIRED`
- NAVER: `NAVER_PROVIDER_LIFECYCLE_BLOCKER — TOKEN_REVOCATION/DISCONNECT INTEGRATION VERIFY`
- Apple: `APPLE_SOCIAL_AUTH_LIFECYCLE_BLOCKER`; LOGIN reviewed ready, SIGNUP/LINK blocked

Legal review does not overwrite these technical blockers.

---

# F. Final sequence after counsel

Counsel returns Q01-Q36 decisions → record in `production-legal-review-decisions.md` → obtain user decisions for the held items → update candidates → engineering supplies any `NEED MORE FACTS` data-flow details → counsel final wording close → Site fresh-main legal branch → final HTML freeze/hash → explicit user Production publish approval → live page verification → Core Production consent manifest → Account Production manifest verification → Google `openid` real E2E → only then `USER_ACTION_REQUIRED — GOOGLE STEP 1`.

Current:

- `CROSS-REPO IMPLEMENTATION HANDOFF = READY`
- `LEGAL REVIEW COMPLETE = NO`
- `PRODUCTION PUBLISH = NONE`
- `PROVIDER CONSOLE CHANGE = NONE`
- `USER_ACTION_REQUIRED — GOOGLE STEP 1 = NOT YET`
