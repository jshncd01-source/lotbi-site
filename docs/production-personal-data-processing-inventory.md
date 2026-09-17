# LOTBI Production Personal Data Processing Inventory — Internal Compliance / Production Fact Check

> 상태: `INTERNAL DATA INVENTORY READY / PRODUCTION FACT VERIFY REQUIRED / COUNSEL OPTIONAL / DO NOT PUBLISH AS-IS`
>
> 기준일: 2026-09-17 (Asia/Seoul)

이 표는 Production Privacy 공개문구를 만들기 위한 내부 fact inventory다.

- `CURRENT`: reviewed Core/Account에서 실제 확인된 구조
- `CURRENT REVIEW CONTRACT`: Social review branch에서 확인된 현재 계약
- `PLANNED / VERIFY REQUIRED`: 제품정책 또는 예정기능은 존재하지만 Production schema/contract 추가검증이 필요한 구조
- `MUST NOT BE COLLECTED/ASSUMED`: LOTBI가 저장한다고 허위 고지해서는 안 되는 비밀정보 또는 미확인 정보

외부 법률전문가 검토는 선택적 risk review이며 이 inventory의 hard gate가 아니다. 공개 전에는 실제 Production deployment/config/contract와 일치하는지 engineering fact check를 수행한다.

## 1. Data processing inventory

| Data / record | State | Collector / source | Collection time | Purpose | Storage / system | Retention / lifecycle | Deletion / revoke | External party | Overseas / outsourcing / third party | Compliance / publish action |
|---|---|---|---|---|---|---|---|---|---|---|
| LOTBI name | CURRENT | user directly → LOTBI | signup/account creation | account display/identification | Core `User.name` / external identity display context | active account | deletion lifecycle/final purge | none inherent | hosting classification separate | Privacy에 직접입력 정보로 고지 |
| LOTBI handle | CURRENT | user directly → LOTBI | signup | public/canonical account identifier | `AccountIdentity.handle` | active account | deletion lifecycle/final purge | none inherent | hosting classification separate | Privacy에 직접입력 정보로 고지 |
| Google `sub` | CURRENT REVIEW CONTRACT | Google OIDC → LOTBI | Google login/signup/link verification | canonical external identity | `ExternalAccountIdentity.provider_subject` | active link; revoked reservation currently retained | local `REVOKED`; final treatment follows security/purge policy | Google | actual Provider communication; Production transfer classification fact-check | Privacy에 stable Provider identifier 사용을 고지; `GOOGLE_SCOPE_CONTRACT_VERIFY` 유지 |
| Kakao `sub` | CURRENT REVIEW CONTRACT | Kakao OIDC → LOTBI | Kakao login/signup/link | canonical external identity | same | active link; revoked reservation currently retained | local revoke; remote unlink/purge blocker | Kakao | Provider communication | Privacy에 identifier 사용 고지; Kakao user-id deletion/unlink lifecycle GREEN 전 activation 금지 |
| NAVER `response.id` | CURRENT REVIEW CONTRACT | NAVER profile API after token verification | NAVER auth | canonical external identity | same | active link; revoked reservation currently retained | local revoke; token revocation/disconnect blocker | NAVER | Provider communication | Privacy에 identifier 사용 고지; remote revoke/disconnect GREEN 전 activation 금지 |
| Apple `sub` | CURRENT REVIEW CONTRACT | Apple ID token → LOTBI | Apple login; signup/link currently blocked | canonical external identity | same | active login identity; signup/link lifecycle blocked | Apple revoke lifecycle required | Apple | Provider communication | LOGIN과 SIGNUP/LINK 상태 구분; SIGNUP/LINK lifecycle GREEN 전 activation 금지 |
| Provider email/name/profile | NOT USED AS SOCIAL IDENTITY | Provider | current minimum Social contract does not request/import | none | email `None`, profile `{}` in reviewed signup contract | N/A | N/A | Provider | N/A under minimum contract | 현재 Privacy에 Social identity 수집항목으로 기재 금지 |
| Passkey credential ID/public key/sign counter/transports/status | CURRENT | browser/device authenticator → LOTBI | enrollment/authentication | phishing-resistant authentication/account security | Core `PasskeyCredential` | credential/account 필요기간 + revoke lifecycle | revoke/delete lifecycle | authenticator platform may independently operate outside LOTBI | LOTBI hosting classification separate | 공개키 기반 인증 metadata로 Privacy에 고지 |
| Passkey private key/biometric secret | MUST NOT BE COLLECTED BY LOTBI | authenticator only | local device operation | authenticator security | not LOTBI server data | N/A | authenticator/platform controlled | platform authenticator | not LOTBI server storage | LOTBI가 private key/biometric 원문을 저장한다고 기재 금지 |
| ClientInstallation | CURRENT | LOTBI client/server | install/account enrollment | bind device/install context, security, sessions | Core `ClientInstallation` | installation/account lifecycle | revoke/cancel/final purge | none inherent | hosting classification separate | 실제 저장필드 범위에 맞춰 설치/기기 식별정보로 고지 |
| UserSession | CURRENT | Core | login/session issuance | authentication/session security | `UserSession`; token stored as hash server-side | expiry/revoke + 필요한 보안증빙 | logout/deletion/security revoke | none inherent | hosting classification separate | 세션/보안정보 처리로 고지 |
| Social flow cookie `__Host-lotbi_social_flow` | CURRENT REVIEW CONTRACT | Account Web | Social auth start | browser-flow binding/state | browser cookie + server flow record | reviewed max flow lifetime 300s | expiry/cancel/consume | Provider callback interacts with flow | related Provider communication only | 필수 인증 cookie; 광고/선택 cookie처럼 표시하지 않음 |
| Account session cookie `__Host-lotbi_session` | CURRENT REVIEW CONTRACT | Account Web | login | maintain authenticated session | secure HttpOnly browser cookie linked to Core session | session expiry/revoke | logout/deletion/security revoke | none inherent | hosting separate | 필수 인증 cookie |
| Social consent evidence | CURRENT | user + Core server manifest | signup consent | prove exact Terms/Privacy acceptance | append-only `UserConsentRecord`; key/version/hash/URI/decision/locale/evidence | 동의/분쟁/보안 증빙에 필요한 기간 | append-only evidence; final retention policy 적용 | none inherent | hosting separate | exact document consent evidence 처리로 고지 |
| OAuth authorization code / ID/access token | TRANSIENT CURRENT | Provider | OAuth/OIDC exchange | verify Provider identity | transient auth flow / adapter memory; durable storage not current minimum contract | short-lived/current flow lifecycle | consume/clear | Provider | Provider communication | durable account-profile 정보처럼 고지하지 않음 |
| Apple revocation material | PLANNED / BLOCKED | Apple token endpoint | future Apple signup/link | authorization revoke on lifecycle events | encrypted protected vault required, not currently GREEN | least-privileged lifecycle period | delete after lifecycle end | Apple | Provider communication | 구현/보안검증 전 Apple SIGNUP/LINK 활성화 금지 |
| ConsumerDeviceSession | PLANNED / VERIFY REQUIRED | client/Core future structure | device/session lifecycle | consumer device session continuity/security | schema not established by this package | TBD | TBD | none inherent | hosting separate | 구현 전 현재 수집항목으로 Privacy에 기재 금지 |
| FREE usage event | PRODUCT POLICY FINAL / IMPLEMENTATION VERIFY REQUIRED | Core task lifecycle | successful final result only | enforce monthly 3 successful FREE tasks | authoritative usage ledger not yet verified in reviewed Core | monthly accounting + audit/adjustment retention to be defined with implementation | no charge on failure; compensation append-only | none inherent; AI calls separate | actual schema 확인 후 Privacy 처리항목/보유기간에 반영 |
| FREE compensation/credit adjustment | PRODUCT POLICY FINAL / IMPLEMENTATION VERIFY REQUIRED | Core/admin support | correction/compensation | restore usage without rewriting original event | append-only auditable adjustment required by product policy | implementation-defined minimum audit period | preserve original event + adjustment relation | none inherent | hosting separate | 구현 schema 확인 후 최소필드/보유기간 반영 |
| Subscription entitlement/event | PLANNED / IMPLEMENTATION VERIFY REQUIRED | LOTBI + Store/PG | purchase/renewal/cancel/refund | control LOTBI Plus access | schema not verified in current Core | statutory/business period when paid service is active | cancel/expire/revoke by channel | Toss / Apple / Google | actual channel contract/data flow | Plus Production 판매 전 Privacy/Terms/retention mapping 완료 |
| Payment Provider reference | PLANNED / CHANNEL DEPENDENT | Toss/Store → LOTBI | payment/subscription event | reconcile payment and entitlement | provider reference/transaction identifier expected; exact schema verify | statutory/contract period when applicable | retain only minimum required | Toss / Apple / Google | actual channel contract/data flow | full card data와 구분; 실제 retained fields만 고지 |
| Full card/account credentials | MUST NOT BE ASSUMED STORED BY LOTBI | payment channel | payment | payment authorization | intended Provider/PG boundary; LOTBI storage not established/required | N/A unless future design changes | Provider rules | payment provider | channel-specific | LOTBI 저장을 입증하지 못한 상태에서 Privacy에 저장한다고 기재 금지 |
| AuditEvent | CURRENT | Core operations | security/transaction events | audit, security, dispute, transaction evidence | Core `AuditEvent` | security/statutory purpose에 필요한 범위 | final purge/statutory split | none inherent | hosting separate | 목적별 최소보존 mapping 필요 |
| Admin authentication/audit metadata | CURRENT/PARTIAL | admin/Core | admin access/action | protect privileged operations | Core admin accounts/sessions/challenges; audit records | privileged/security lifecycle + 필요한 audit period | revoke/expire + audit retention | none inherent | hosting separate | end-user Privacy에는 실제 개인정보 처리 관련 범위만 반영 |
| AccountDeletionRequest / receipt | CURRENT | user/Core | user requests deletion | enforce and evidence deletion lifecycle | Core `AccountDeletionRequest` and related evidence | workflow completion + 필요한 법정/보안 evidence | final purge/statutory split | Provider lifecycle may be triggered separately | Provider별 lifecycle | Privacy/Terms에 즉시 hard delete가 아닌 실제 deletion lifecycle 고지 |
| Merchant transaction/order/payment evidence | CURRENT/FUTURE PER MERCHANT CAPABILITY | user/Merchant/Core | commerce execution | approval, execution, reconciliation, disputes | Transaction Kernel models/audit | actual Merchant legal role/statutory record에 따라 feature-specific | final purge with statutory exceptions | Merchant/PG | per actual Merchant flow | Merchant 기능 활성화 전에 별도 legal-role/retention disclosure 완료 |
| User prompt/task content | FEATURE DEPENDENT | user → LOTBI | service request | perform requested task | exact Production persistence policy not established in this inventory | TBD by actual AI/task architecture | TBD | AI Provider may receive minimum subset when enabled | possible processing/overseas issue only if actually sent | AI Production 활성화 전 exact payload/persistence/provider/retention inventory 작성; FREE usage ledger와 혼동 금지 |

## 2. Secrets / credentials — not ordinary Privacy inventory fields

다음은 인증/결제 flow에 존재할 수 있다는 이유만으로 일반 사용자 profile 데이터처럼 설명하지 않는다.

- OAuth client secrets
- Apple `.p8` private key
- Provider access/refresh token (명시적으로 승인된 protected revocation material 예외 제외)
- session bearer token plaintext; Core는 설계된 위치에서 hash 저장
- Passkey private key/biometric secret
- payment card full number/CVC/raw bank credentials unless a future explicit payment design changes the boundary
- API/signing/webhook/recovery-code secrets

공개 Privacy는 개인정보 처리사실을 정확히 설명하되 secret 값이나 내부 방어설계를 노출하지 않는다.

## 3. Provider minimum data contract

| Provider | Reviewed Web scope | Canonical LOTBI identity | Email/name/profile current use | Lifecycle status |
|---|---|---|---|---|
| Google | `openid` | `sub` | unused | scope real E2E pending |
| Kakao | `openid` | `sub` | unused | remote unlink/user-id purge blocker |
| NAVER | `openid` | `response.id` | unused additional profile fields | revocation/disconnect blocker |
| Apple | no email/name scope | `sub` | relay email/full name unused | LOGIN ready; SIGNUP/LINK blocked on revoke lifecycle |

## 4. Production infrastructure / processor fact-check boundary

Final Privacy에는 **실제 Production에서 활성 사용 중인 서비스만** 넣는다.

Final HTML freeze 전에 owning engineering/operations가 다음을 제공한다.

- actual Production hosting vendor/service and plan;
- DB/log/backups processing/storage region;
- Account Web hosting vendor/region;
- applicable DPA/subprocessor information;
- categories of LOTBI personal data reaching each vendor;
- retention/deletion controls relevant to public disclosure;
- active AI Provider and exact payload categories, if AI is enabled;
- whether user/account identifiers are sent to AI Provider;
- Toss/App Store/Google Play exact references/notifications retained by LOTBI, if paid channels are enabled.

This is:

`PRODUCTION_DATA_FLOW_VERIFY_REQUIRED`

and **not** `EXTERNAL COUNSEL REQUIRED`.

Do not infer final Production processing region from the repo's Render pilot Singapore example.

Do not state `NO OVERSEAS TRANSFER`, `THIRD-PARTY PROVISION`, or `PROCESSOR` for a vendor without matching the actual Production flow and applicable legal basis.

## 5. Publication status

This inventory is an internal source of truth, not a public Privacy page.

Current:

- `INTERNAL DATA INVENTORY = READY`
- `EXTERNAL COUNSEL = OPTIONAL / RECOMMENDED`
- `PRODUCTION DATA-FLOW FACT CHECK = REQUIRED BEFORE PRIVACY HTML FREEZE`
- `PRODUCTION PRIVACY = READY FOR USER POLICY APPROVAL, NOT YET PUBLISHED`.