# LOTBI Production Personal Data Processing Inventory — Counsel Review

> 상태: `COUNSEL-READY INVENTORY / LEGAL CLASSIFICATION PENDING / DO NOT PUBLISH`
>
> 기준일: 2026-09-17 (Asia/Seoul)

이 표는 Privacy 공개문구를 만들기 위한 내부 fact inventory다. `CURRENT`는 reviewed Core/Account에서 확인된 구조, `PLANNED`는 확정 제품정책이나 예정 기능이지만 저장 schema/Production 계약의 추가 검증이 필요한 구조다.

## 1. Data processing inventory

| Data / record | State | Collector / source | Collection time | Purpose | Storage / system | Retention now | Deletion / revoke | External party | Overseas / outsourcing / third party | Consent / legal basis review |
|---|---|---|---|---|---|---|---|---|---|---|
| LOTBI name | CURRENT | user directly → LOTBI | signup/account creation | account display/identification | Core `User.name` / external identity display context | active account; final period pending | deletion lifecycle/final purge | none inherent | none inherent; hosting classification separate | account-service necessity + Privacy disclosure; counsel confirm |
| LOTBI handle | CURRENT | user directly → LOTBI | signup | public/canonical account identifier | `AccountIdentity.handle` | active account; post-delete handling pending | deletion lifecycle/final purge | none inherent | hosting classification separate | counsel confirm retention post-delete |
| Google `sub` | CURRENT REVIEW CONTRACT | Google OIDC → LOTBI | Google login/signup/link verification | canonical external identity | `ExternalAccountIdentity.provider_subject` | active link; revoked reservation currently retained | local `REVOKED`; final treatment pending | Google | legal classification pending | Privacy disclosure required; overseas/processing basis review |
| Kakao `sub` | CURRENT REVIEW CONTRACT | Kakao OIDC → LOTBI | Kakao login/signup/link | canonical external identity | same | active link; revoked reservation currently retained | local revoke; Kakao unlink/purge blocker | Kakao | pending | Kakao deletion/user-id policy + PIPA review |
| NAVER `response.id` | CURRENT REVIEW CONTRACT | NAVER profile API after token verification | NAVER auth | canonical external identity | same | active link; revoked reservation currently retained | local revoke; token revocation/disconnect blocker | NAVER | pending | Privacy + Provider lifecycle review |
| Apple `sub` | CURRENT REVIEW CONTRACT | Apple ID token → LOTBI | Apple login; signup/link currently blocked | canonical external identity | same | active login identity; signup/link lifecycle blocked | Apple revoke lifecycle required | Apple | pending | overseas/provider lifecycle review |
| Provider email/name/profile | NOT USED AS SOCIAL IDENTITY | Provider | current minimum Social contract does not request/import | none | email `None`, profile `{}` in reviewed signup contract | N/A | N/A | Provider | N/A under minimum contract | do not list as collected unless contract changes |
| Passkey credential ID/public key/sign counter/transports/status | CURRENT | browser/device authenticator → LOTBI | enrollment/authentication | phishing-resistant authentication/account security | Core `PasskeyCredential` | while credential/account is needed; final retention pending | revoke/delete lifecycle | authenticator platform may independently operate outside LOTBI | LOTBI hosting classification separate | security/account necessity; exact retention counsel/security review |
| Passkey private key/biometric secret | MUST NOT BE COLLECTED BY LOTBI | authenticator only | local device operation | authenticator security | not LOTBI server data | N/A | authenticator/platform controlled | platform authenticator | not LOTBI server storage | Privacy must not imply LOTBI stores raw private key/biometric secret |
| ClientInstallation | CURRENT | LOTBI client/server | install/account enrollment | bind device/install context, security, sessions | Core `ClientInstallation` | while installation/account active; final period pending | revoke/cancel/final purge | none inherent | hosting classification separate | Privacy disclosure of device/install identifiers as applicable |
| UserSession | CURRENT | Core | login/session issuance | authentication/session security | `UserSession`; token stored as hash server-side | until expiry/revoke + security retention review | revoke on logout/deletion/security action | none inherent | hosting classification separate | account/service/security basis; exact log retention review |
| Social flow cookie `__Host-lotbi_social_flow` | CURRENT REVIEW CONTRACT | Account Web | Social auth start | browser-flow binding/state | browser cookie, short-lived; server flow record | reviewed max flow lifetime 300s | expiry/cancel/consume | Provider callback interacts with flow | pending only for related Provider communication | essential authentication cookie; no optional marketing consent |
| Account session cookie `__Host-lotbi_session` | CURRENT REVIEW CONTRACT | Account Web | login | maintain authenticated session | secure HttpOnly browser cookie linked to Core session | session expiry/revoke | logout/deletion/security revoke | none inherent | hosting separate | essential auth cookie |
| Social consent evidence | CURRENT | user + Core server manifest | signup consent | prove exact Terms/Privacy acceptance | append-only `UserConsentRecord`; key/version/hash/URI/decision/locale/evidence | legal/audit period pending | not overwritten; final/statutory treatment pending | none inherent | hosting separate | required signup consent evidence; retention basis counsel review |
| OAuth authorization code / ID/access token | TRANSIENT CURRENT | Provider | OAuth/OIDC exchange | verify Provider identity | transient auth flow / adapter memory; durable token storage generally prohibited except future Apple revoke material | short-lived; current durable minimum identity excludes these | consume/clear; Apple future lifecycle exception requires protected vault | Provider | legal classification pending | do not describe as durable account profile data; security handling review |
| Apple revocation material | PLANNED / BLOCKED | Apple token endpoint | future Apple signup/link | authorization revoke on lifecycle events | encrypted protected vault required, not currently GREEN | least-privileged lifecycle period TBD | delete after lifecycle end | Apple | pending | counsel/security/provider review |
| ConsumerDeviceSession | PLANNED / VERIFY REQUIRED | client/Core future structure | device/session lifecycle | consumer device session continuity/security | schema not established by this package | TBD | TBD | none inherent | hosting separate | must not be represented as current until implementation reviewed |
| FREE usage event | PRODUCT POLICY FINAL / IMPLEMENTATION VERIFY REQUIRED | Core task lifecycle | successful final result only | enforce monthly 3 successful FREE tasks | authoritative usage ledger not verified in current reviewed Core search | monthly accounting + audit/adjustment retention TBD | no charge on failure; compensation append-only | none inherent; AI calls separate | hosting separate | Privacy fields/retention only after actual schema known |
| FREE compensation/credit adjustment | PRODUCT POLICY FINAL / IMPLEMENTATION VERIFY REQUIRED | Core/admin support | correction/compensation | restore usage without rewriting original event | append-only auditable adjustment required by product policy | TBD | retain audit linkage as legally justified | none inherent | hosting separate | counsel confirm audit retention/minimization |
| Subscription entitlement/event | PLANNED / IMPLEMENTATION VERIFY REQUIRED | LOTBI + Store/PG | purchase/renewal/cancel/refund | control LOTBI Plus access | schema not verified in current Core | statutory/business period TBD | cancel/expire/revoke according to channel | Toss / Apple / Google | classification pending | consumer/ecommerce + Privacy review |
| Payment Provider reference | PLANNED / CHANNEL DEPENDENT | Toss/Store → LOTBI | payment/subscription event | reconcile payment and entitlement | should be provider reference/transaction identifier, not full card data | statutory/contract period TBD | retain only minimum legally needed | Toss / Apple / Google | classification pending | channel contract + ecommerce retention review |
| Full card/account credentials | MUST NOT BE ASSUMED STORED BY LOTBI | payment channel | payment | payment authorization | intended Provider/PG boundary; LOTBI storage not established/required | N/A unless future design changes | Provider rules | payment provider | channel-specific | Privacy must match actual integration; never claim storage without proof |
| AuditEvent | CURRENT | Core operations | security/transaction events | audit, security, dispute, transaction evidence | Core `AuditEvent` | exact legal/security period pending | legal retention/final purge policy | none inherent | hosting separate | statutory/security proportionality review |
| Admin authentication/audit metadata | CURRENT/PARTIAL | admin/Core | admin access/action | protect privileged operations | Core admin accounts/sessions/challenges; business action audit may use audit records | exact period pending | revoke/expire + audit retention | none inherent | hosting separate | least privilege + retention review |
| AccountDeletionRequest / receipt | CURRENT | user/Core | user requests deletion | enforce and evidence deletion lifecycle | Core `AccountDeletionRequest` and related evidence | until workflow complete + legal/audit period TBD | final purge/statutory retention split | Provider lifecycle may be triggered separately | pending by Provider | Privacy/Terms disclosure + statutory/security basis review |
| Merchant transaction/order/payment evidence | CURRENT/FUTURE PER MERCHANT CAPABILITY | user/Merchant/Core | commerce execution | approval, transaction execution, reconciliation, disputes | Transaction Kernel models/audit | depends on actual legal role/record | final purge with statutory exceptions | Merchant/PG | classification per merchant flow | commerce-role + statutory retention review |
| User prompt/task content | FEATURE DEPENDENT | user → LOTBI | service request | perform requested task | current exact Production persistence policy not established in this legal package | TBD | TBD | AI Provider may receive subset when enabled | likely overseas/processing issue if sent | must be separately inventoried before AI Production use; do not infer from FREE usage ledger |

## 2. Secrets / credentials — not ordinary Privacy inventory fields

The following should be treated as security secrets/credentials and not described as ordinary durable user-profile data simply because they exist in authentication/payment flows:

- OAuth client secrets
- Apple `.p8` private key
- Provider access/refresh tokens except explicitly approved protected lifecycle material
- session bearer token plaintext; Core stores hashes where designed
- Passkey private key/biometric secret
- payment card full number/CVC or raw bank credentials unless an explicit future PCI/payment design changes the boundary
- API keys, signing keys, webhook secrets, recovery-code secrets

Security documentation may inventory secret classes, but public Privacy should describe personal-data processing accurately without exposing secret values or internal defensive design.

## 3. Provider minimum data contract

| Provider | Requested reviewed Web scope | Canonical LOTBI identity | Email/name/profile current use | Lifecycle status |
|---|---|---|---|---|
| Google | `openid` | `sub` | unused | scope real E2E pending |
| Kakao | `openid` | `sub` | unused | remote unlink/user-id purge blocker |
| NAVER | `openid` | `response.id` | unused additional profile fields | revocation/disconnect blocker |
| Apple | no email/name scope | `sub` | relay email/full name unused | LOGIN ready; SIGNUP/LINK blocked on revoke lifecycle |

## 4. Hosting / processor verification boundary

Current source evidence is not sufficient to write final Production overseas/outsourcing rows for Render/Vercel/OpenAI merely from technology names.

Before counsel approves the final Privacy, owning engineering/operations must provide a **Production data-flow manifest** containing at minimum:

- actual Production hosting vendor/service and account plan;
- processing/storage region for DB, logs, backups and analytics;
- DPA/subprocessor list/version;
- categories of LOTBI personal data reaching the vendor;
- encryption/logging/backups/retention relevant to Privacy disclosure;
- whether support personnel may access customer data;
- deletion/export controls;
- for AI Providers, exact payload categories and whether user/account identifiers are included;
- for Toss/App Store/Google Play, exact transaction identifiers/notifications/receipt fields retained by LOTBI.

Until that manifest is produced, the legal classification stays `PENDING`, not `NO OVERSEAS TRANSFER` and not automatically `THIRD-PARTY PROVISION`.
