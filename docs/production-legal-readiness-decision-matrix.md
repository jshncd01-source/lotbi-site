# PRODUCTION SOCIAL SIGNUP LEGAL READINESS — DECISION MATRIX

> 기준일: 2026-09-17 (Asia/Seoul)
>
> 상태: `DECISION BOUNDARY READY / FREE PRODUCT POLICY CLOSED / PRODUCTION NOT GREEN`

This matrix separates facts that can already be fixed from legal/provider decisions that this readiness room must not invent.

## 1. TECHNICALLY / PRODUCT-POLICY FIXED

| Item | Fixed contract |
|---|---|
| Legal consent keys | exactly `TERMS_OF_SERVICE` + `PRIVACY_POLICY` |
| Consent requirement | both required, both `ACCEPTED`, `required=true` |
| Consent metadata | per document: version + SHA-256 + HTTPS URI |
| Separate manifest version | none; do not invent `consent_manifest_version` |
| Canonical Privacy URI | `https://lotbiai.com/privacy.html` |
| Canonical Terms URI | `https://lotbiai.com/terms.html` |
| Google Provider identity | OIDC `sub`; reviewed Web scope `openid` |
| Kakao Provider identity | OIDC `sub`; reviewed Web scope `openid` |
| NAVER Provider identity | official `response.id`; reviewed Web scope `openid` |
| Apple Provider identity | Apple `sub`; no email/name profile scope |
| Provider profile data | email/name/profile not imported/stored as Social identity under current reviewed contract |
| LOTBI signup data | user directly enters LOTBI name + handle |
| Username policy | existing Consumer Username Policy reused |
| Same-email merge | forbidden; no silent account merge by Provider email |
| Consent evidence | `UserConsentRecord`, `source=SOCIAL_SIGNUP`, server manifest verified |
| LOGIN | federated limited session then Passkey step-up to FULL |
| SIGNUP | provider verification → LOTBI name/handle + two consents → account creation → Passkey enrollment |
| LINK | separate from signup; existing FULL account + fresh proof |
| Generic unlink | local identity -> `REVOKED`, related limited sessions/flows cleaned, account retained, no generic remote revoke |
| Account deletion | access/authority/session/external-link revoke first; deletion lifecycle; final purge separate; not immediate hard delete |
| Core manifest endpoints | `/v2/sessions/providers/signup/consents`, `/v2/sessions/providers/readiness` |
| Core manifest env names | `LOTBI_SOCIAL_TERMS_*` and `LOTBI_SOCIAL_PRIVACY_*` |
| Account session cookie | `__Host-lotbi_session`, secure server-side session boundary |
| Social-flow cookie | `__Host-lotbi_social_flow`, short-lived secure flow binding |
| Callback contract | `/api/auth/providers/<provider>/callback` under `https://account.lotbiai.com` |
| Support email | `developer@lotbiai.com` |
| Representative phone | `063-237-0930` |
| Operator | 유한회사 알에이디홀딩스 |
| FREE allowance | monthly 3 successful tasks; not 3 messages/questions/AI calls |
| FREE charge point | only successful final user result delivered under authoritative success outcome; max once per task usage boundary |
| Same-task clarification | no additional FREE charge for clarification/confirmation needed to complete one purpose |
| LOCAL deterministic | FREE usage 0 / AI provider call 0 / external effect NONE |
| Failure/cancel/incomplete | no FREE charge when final successful user result was not delivered |
| Retry/idempotency | retry/duplicate/network/provider/callback/client/reconciliation retry cannot create duplicate charge; same success max 1 |
| FREE reset | calendar month; every month on day 1 at 00:00 `Asia/Seoul` / KST |
| FREE carry-over | NONE |
| FREE compensation | preserve original usage event; append auditable compensation/credit adjustment or Core-equivalent adjustment |
| FREE user wording | show task usage such as `이번 달 무료 작업 2 / 3 사용`; do not say `메시지 3개` or `AI 질문 3번` |
| Task usage vs AI calls | separate metrics; `LOTBI task usage != AI provider call` |
| LOTBI Plus | monthly KRW 9,900 product baseline; not documented as unlimited general-AI usage |
| Subscription channels | Web Toss Payments / iPhone App Store / Android Google Play |
| Merchant separation | LOTBI subscription fee is separate from external Merchant transaction money |

Authoritative FREE source:

`docs/free-monthly-3-task-product-policy.md`

## 2. LEGAL_REVIEW_REQUIRED

These cannot be closed by code inspection or the FREE product-policy decision alone.

| Legal item | Why unresolved / required output |
|---|---|
| `THIRD_PARTY_PROCESSING_AND_OVERSEAS_TRANSFER` | classify each Google/Kakao/NAVER/Apple Production data flow as third-party provision/processing/overseas transfer or other lawful structure; identify parties/country/items/purpose/timing/method/period/legal basis where applicable |
| `PROVIDER_SUBJECT_RETENTION_BASIS_AND_PERIOD` | establish legal/security basis and maximum period/end event for revoked subject reservation; define final-purge deletion/transformation rule |
| `STATUTORY_RETENTION_ITEMS_AND_PERIODS` | identify actual transaction/payment/subscription/audit records legally retained and exact periods/bases |
| `MINOR_POLICY` | decide under-14 eligibility and guardian-consent/age-verification treatment |
| `PRODUCTION_PURGE_PERIOD` | align actual Production deletion purge timing with legal retention; do not infer 30 days from source default |
| `PRIVACY_OFFICER_OR_DEPARTMENT` | finalize official privacy-responsible person/department/contact disclosure required for public policy |
| `CONTRACT_FORMATION_TIME` | decide legal signup/contract formation point across consent, account creation and first Passkey enrollment |
| `LOTBI_PLUS_SUBSCRIPTION_TERMS` | final auto-renewal notice, cancellation effect, refunds, cooling-off, digital-service treatment, Store refund vs entitlement, price-change/free-to-paid consent |
| `COMMERCE_ROLE_AND_RESPONSIBILITY` | define LOTBI's legal role per actual Merchant flow and required e-commerce/intermediary disclosures |
| `DELETION_RETENTION_AND_PROVIDER_LIFECYCLE` | align local deletion/purge terms with Provider remote lifecycle requirements |
| `SUSPENSION_NOTICE_AND_REMEDY` | final grounds/notice/appeal/emergency-security exception wording |
| `SERVICE_CHANGE_NOTICE_AND_LIABILITY` | final material service change/interruption notice and responsibility |
| `TERMS_CHANGE_NOTICE` | legal notice/consent/effect rules for terms updates, including paid users |
| `LIABILITY_DISPUTE_JURISDICTION` | damages/limitations/dispute resolution/jurisdiction without unlawfully limiting consumer rights |
| `OPERATOR_DISCLOSURE_FIELDS` | final operator/business/telecom-sale disclosures required by actual paid-service/commerce structure |
| `FINAL_DOCUMENT_EFFECTIVE_DATES` | choose legal effective/publication dates before assigning final versions |

Until these are closed, `production-privacy-candidate.md` and `production-terms-candidate.md` remain `DO NOT PUBLISH`.

## 3. PRODUCT POLICY — CLOSED

`PRODUCT_POLICY_CONFIRMATION_REQUIRED — FREE_TASK_DEFINITION_AND_RESET = CLOSED`

Authoritative values fixed on 2026-09-17:

- FREE = monthly 3 successful tasks;
- one task = one user purpose culminating in a successfully delivered usable final result;
- same-task clarification/confirmation dialogue = no extra charge;
- clear new purpose after completed result = new task;
- ambiguous task boundary must not be split against the user merely to consume allowance;
- charge only at authoritative final-success/user-result-delivered state;
- LOCAL deterministic = no charge;
- failure/cancel/incomplete = no charge;
- same task retry/duplicate/reconciliation = no duplicate charge;
- reset = every month on day 1 at 00:00 KST / `Asia/Seoul`;
- rolling signup-month model = not used;
- carry-over = NONE;
- task usage and AI Provider call count = separate;
- compensation = append-only/auditable adjustment; original usage event is not deleted or rewritten.

Implementation completion of the usage ledger/enforcement remains an owning Core/App workstream verification item. That does not reopen the product-policy decision.

## 4. PROVIDER_LIFECYCLE_IMPLEMENTATION_REQUIRED

### Kakao

`KAKAO_PROVIDER_LIFECYCLE_BLOCKER — UNLINK + USER_ID DELETION/PURGE POLICY REQUIRED`

Needs:
- Kakao Unlink integration for service withdrawal/unmapping;
- Provider-originated unlink webhook/reconciliation treatment;
- Kakao service user-id final purge policy consistent with Provider policy and legal review;
- corresponding Privacy/Terms wording.

### NAVER

`NAVER_PROVIDER_LIFECYCLE_BLOCKER — TOKEN_REVOCATION/DISCONNECT INTEGRATION VERIFY`

Needs:
- Token Revocation integration/verification;
- Provider-originated disconnect callback handling;
- idempotent state reconciliation;
- final public disclosure alignment.

### Apple

`APPLE_SOCIAL_AUTH_LIFECYCLE_BLOCKER`

Needs:
- encrypted durable revocation material;
- Apple revoke when the authorization relationship is ended under the approved unlink/deletion policy;
- retry/idempotency/unknown-state reconciliation;
- server-to-server lifecycle handling;
- migration/security tests;
- real Apple E2E.

Apple LOGIN contract remains reviewed ready; SIGNUP/LINK remain blocked.

## 5. TECHNICAL_VERIFICATION_REQUIRED

### Google

`GOOGLE_SCOPE_CONTRACT_VERIFY = OPEN`

Current minimum reviewed contract is `scope=openid` and stable `sub` only. No email/profile scope expansion is authorized here.

Closure requires real configured-client E2E:

- authorization request accepted;
- exact callback accepted;
- authorization code and token exchange succeed;
- ID token issued;
- stable `sub` / issuer / audience / authorized-party / nonce checks pass;
- state/binding/PKCE/replay protections pass;
- current consent-screen/console configuration matches the actual scope and legal URLs.

## 6. DOCUMENT VERSION / HASH STATUS

Recommended final version naming:

- `LOTBI_PRIVACY_<YYYY-MM-DD>_R<n>`
- `LOTBI_TERMS_<YYYY-MM-DD>_R<n>`

Internal non-authoritative candidate labels:

- `LOTBI_PRIVACY_CANDIDATE_2026-09-17_R1`
- `LOTBI_TERMS_CANDIDATE_2026-09-17_R1`

SHA-256 is technically calculable now for any file, but an authoritative Production SHA-256 must be calculated only from exact legally-approved final HTML bytes that will be/are served at the canonical URI.

Current:

- SHA-256 capability: `READY`
- authoritative Privacy SHA-256: `PENDING`
- authoritative Terms SHA-256: `PENDING`

## 7. CURRENT GATE

`PRODUCT_POLICY_CONFIRMATION_REQUIRED — FREE_TASK_DEFINITION_AND_RESET = CLOSED`

`PRODUCTION SOCIAL SIGNUP LEGAL MANIFEST READINESS = BLOCKED / NOT GREEN`

`USER_ACTION_REQUIRED — GOOGLE STEP 1 = NOT YET`

The next gate is legal review closure → approved/frozen Site HTML → exact HTML SHA-256 → user-approved Production publish → Core Production consent manifest → Account Production verification → Google Console/OAuth-client preparation when authorized → Google `openid` real E2E.