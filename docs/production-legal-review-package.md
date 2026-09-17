# LOTBI Production Privacy / Terms — Compliance & Risk Review Package

> 상태: `INTERNAL COMPLIANCE/RISK PACKAGE READY / EXTERNAL COUNSEL OPTIONAL / NOT A SOCIAL-LOGIN HARD BLOCKER`
>
> 기준일: 2026-09-17 (Asia/Seoul)

## Purpose change

이 문서는 더 이상 “외부 변호사 답변 전 Production 진행 금지” 문서가 아니다.

현재 용도:

1. LOTBI 내부 Compliance/Risk checklist;
2. Privacy/Terms 문구의 공식근거 추적;
3. 향후 필요 시 외부 법률전문가에게 전달할 risk-review package.

외부 법률전문가 검토는 권장될 수 있으나 Social Login Production 준비의 필수 인증서나 hard gate가 아니다.

Production 문구는 실제 LOTBI 코드/제품정책 + 현재 시행 법령 + Provider 공식문서를 우선해 확정하고, 공식자료만으로 단일 법률결론을 강제하기 어려운 영역은 보수적 사실문구 또는 기능 비활성화로 처리한다.

## Authoritative supporting files

- `docs/production-privacy-candidate.md`
- `docs/production-terms-candidate.md`
- `docs/production-personal-data-processing-inventory.md`
- `docs/production-legal-official-source-register.md`
- `docs/production-legal-review-questionnaire.md`
- `docs/production-legal-review-decisions.md`
- `docs/production-user-policy-decisions.md`
- `docs/production-legal-readiness-decision-matrix.md`
- `docs/production-legal-manifest-implementation-handoff.md`

## Official basis currently used

- 개인정보 보호법: 2026-09-11 시행본
- 개인정보 보호법 시행령: 2026-09-11 시행본
- 전자상거래 등에서의 소비자보호에 관한 법률: 2026-07-21 시행본
- 전자상거래법 시행령: 2026-07-21 시행본
- 개인정보보호위원회 official guidance
- Google OAuth official production-readiness documents
- Kakao Developers Kakao Login official documents
- NAVER Developers Login official documents
- Apple Developer Sign in with Apple / Store subscription official documents
- Toss Payments / Google Play official developer materials where the paid channel applies

---

# Risk / decision register

## A. THIRD_PARTY_PROCESSING_AND_OVERSEAS_TRANSFER

**Technical facts**

- Social identity minimum: Google `sub`, Kakao `sub`, NAVER `response.id`, Apple `sub`.
- Provider email/name/profile are not current Social identity fields.
- Social authentication communicates with the selected Provider.
- Production infrastructure/AI/payment vendor details must come from actual deployed configuration and contracts, not repo pilot examples.

**Official basis**

PIPA Art. 28-8 covers overseas provision, outsourced processing and storage. Depending on the applicable basis, disclosure/notice or consent requirements apply.

**Production approach**

- Do not label every foreign service automatically as third-party provision.
- Publish only actually active processors/transfers.
- Engineering verifies vendor/country/data/purpose/retention before final HTML.

**Status**

`OFFICIAL-SOURCE REVIEWED / TECHNICAL DATA-FLOW VERIFY REQUIRED / COUNSEL REVIEW RECOMMENDED, NOT HARD BLOCKER`

## B. PROVIDER_SUBJECT_RETENTION_BASIS_AND_PERIOD

**Technical facts**

Current Core local unlink sets external identity `REVOKED` and retains a unique subject reservation for takeover/relink protection.

**Production approach**

- Explain the security purpose factually.
- Do not promise indefinite raw subject retention.
- Account deletion/final purge must align with Provider policy.
- Kakao activation remains blocked until its official user-id deletion/unlink lifecycle is implemented.

**Status**

`SECURITY PURPOSE CONFIRMED / PROVIDER-SPECIFIC IMPLEMENTATION REQUIRED / COUNSEL REVIEW RECOMMENDED`

## C. STATUTORY_RETENTION_ITEMS_AND_PERIODS

**Official basis**

For applicable e-commerce records, the Enforcement Decree provides the current periods including advertising 6 months, contract/withdrawal 5 years, payment/supply 5 years and consumer complaint/dispute 3 years.

**Production approach**

- Apply these periods only to records that actually fall in the statutory category.
- Social account records are not automatically all five-year records.
- Plus/Merchant features map records when those paid/transaction features activate.

**Status**

`OFFICIAL PERIODS CONFIRMED / FEATURE-SPECIFIC MAPPING REQUIRED / NOT SOCIAL LOGIN HARD BLOCKER`

## D. MINOR_POLICY

**Official basis**

PIPA Art. 22-2 requires legal-representative consent/verification when consent is required to process under-14 child data.

**Recommended v1**

`D1=A`: do not support under-14 signup; add minimum age-confirmation gate without collecting full DOB by default.

**Status**

`USER DECISION REQUIRED — D1 / RECOMMENDED A`

## E. PRODUCTION_PURGE_PERIOD

**Technical facts**

Account deletion first revokes access/session/authority and enters deletion lifecycle; immediate hard delete is not the current contract.

**Production approach**

- Public wording uses deletion lifecycle completion as the ordinary-account retention end event.
- Do not publish unverified source default “30 days”.
- Statutory records remain separated for their required period.

**Status**

`POLICY WORDING READY / EXACT OPERATIONAL PURGE SCHEDULE = TECHNICAL CONFIG VERIFY`

## F. PRIVACY_OFFICER_OR_DEPARTMENT

**Official basis**

PIPA Art. 30 requires CPO name or privacy department/contact. Art. 31 and the Decree contain a small-business designation exception; if no separate CPO is designated under that exception, the owner/representative becomes CPO.

**Recommended v1**

`D2=A`: formally use representative `전선혜` as privacy officer, with `developer@lotbiai.com` / `063-237-0930`.

**Status**

`USER DECISION REQUIRED — D2 / RECOMMENDED A`

## G. CONTRACT_FORMATION_TIME

**Technical sequence**

Provider verification → name/handle + required Terms/Privacy consents → account provisioning/ENROLLMENT → first Passkey → FULL.

**Production wording**

Account membership is formed when required signup information/consents are completed and LOTBI confirms account creation; FULL/high-risk functions can require subsequent Passkey enrollment.

**Status**

`PRODUCTION WORDING READY / COUNSEL REVIEW OPTIONAL`

## H. LOTBI_PLUS_SUBSCRIPTION_TERMS

Confirmed:

- Plus = KRW 9,900/month
- Web Toss / iPhone App Store / Android Google Play

**Boundary**

Detailed refund, withdrawal, grace, cancellation effect and Store refund-entitlement rules must be finalized before Plus Production sales, but do not block FREE Social Login.

Recommended product choices:

- `D4=A`: cancellation effective at current paid-period end
- `D5=A`: channel-authoritative limited grace/retry state

**Status**

`PAID-SERVICE ACTIVATION DECISIONS / NOT FREE SOCIAL LOGIN HARD BLOCKER / COUNSEL REVIEW RECOMMENDED`

## I. COMMERCE_ROLE_AND_RESPONSIBILITY

**Technical fact**

LOTBI subscription money is separate from external Merchant transaction money. Transaction Kernel safety controls do not by themselves make LOTBI the seller or payment-settlement principal.

**Production approach**

Do not claim a legal Merchant role until each actual commerce flow is contracted and enabled. Show actual seller/provider/cancellation/refund terms in the transaction UI.

**Status**

`MERCHANT FEATURE ACTIVATION REVIEW / NOT FREE SOCIAL LOGIN HARD BLOCKER / COUNSEL REVIEW RECOMMENDED`

## J. DELETION_RETENTION_AND_PROVIDER_LIFECYCLE

Current provider technical blockers remain:

- Kakao Unlink + user-id deletion/purge
- NAVER token revocation + disconnect notification
- Apple revocation-token lifecycle for SIGNUP/LINK

Recommended policy:

`D3=A`: explicit unlink/account deletion triggers Provider remote revoke where Provider official contract supports/requires it.

**Status**

`USER DECISION D3 + PROVIDER TECHNICAL BLOCKERS / NOT COUNSEL HARD BLOCKER`

## K. SUSPENSION_NOTICE_AND_REMEDY

Production Terms uses security/legal/abuse grounds, notice where possible, emergency post-notice allowance and contact/objection path.

`PRODUCTION WORDING READY / COUNSEL REVIEW OPTIONAL`

## L. SERVICE_CHANGE_NOTICE_AND_LIABILITY

Production Terms uses reasonable prior notice for material planned changes and permits post-notice for urgent security/outage response. Paid-service entitlement/refund handling applies when paid service is active.

`PRODUCTION WORDING READY / PAID SERVICE DETAILS DEFERRED`

## M. TERMS_CHANGE_NOTICE

Production Terms states effective date + major changes must be disclosed; changes requiring separate consent follow applicable law. Social Signup evidence remains tied to the accepted document version/hash/URI.

`PRODUCTION WORDING READY`

## N. LIABILITY_DISPUTE_JURISDICTION

Production Terms avoids broad liability waivers and unilateral exclusive jurisdiction. Korean law applies and statutory courts/consumer-dispute processes remain available.

`PRODUCTION WORDING READY / COUNSEL REVIEW OPTIONAL`

## O. OPERATOR_DISCLOSURE_FIELDS

Verified public information:

- 유한회사 알에이디홀딩스
- 대표자 전선혜
- 주소: 전북특별자치도 전주시 덕진구 혁신로 542, 1동 1층 (여의동)
- 사업자등록번호 583-88-03679
- 통신판매업신고번호 2026-전주덕진-0798
- `developer@lotbiai.com`
- `063-237-0930`

`TECHNICALLY VERIFIED / PRODUCTION WORDING READY`

## P. FINAL_DOCUMENT_EFFECTIVE_DATES

**Production rule**

User approves final wording → Site latest-main review branch → final HTML freeze → effective date/version → SHA-256 → same files publish → response recheck → Core manifest.

No draft Markdown hash is authoritative.

`TECHNICAL CONTRACT READY / USER PUBLISH APPROVAL REQUIRED`

---

# Counsel policy

`LEGAL_COUNSEL_REVIEW = OPTIONAL / RECOMMENDED`

Strongly recommended for:

- complex cross-border/processor structure;
- Plus refund/withdrawal;
- Merchant legal role;
- material liability/risk allocation.

Not a hard blocker for:

- publishing fact-based Social Login Privacy/Terms after D1/D2 and technical data-flow verification;
- preparing Google Console branding/domain/privacy/terms configuration;
- deploying the two-document Social Signup legal manifest after final HTML/version/hash approval.

Current Social Login readiness remains blocked only by actual product decisions, publish/manifest work and Provider technical gates — not by absence of outside counsel certification.