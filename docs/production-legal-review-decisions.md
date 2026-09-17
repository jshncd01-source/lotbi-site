# LOTBI Production Compliance / Risk Decision Register

> 상태: `INTERNAL DECISION REGISTER ACTIVE / COUNSEL OPTIONAL / DO NOT PUBLISH`
>
> 기준일: 2026-09-17 (Asia/Seoul)

이 문서는 외부 법률전문가의 필수 승인 입력지가 아니다.

현재 목적:

- 공식자료와 LOTBI 기술사실로 내부 결론을 기록;
- 사용자 직접 정책결정을 추적;
- Provider/paid/Merchant 기능별 기술 blocker를 추적;
- 필요 시 외부 counsel 의견을 **optional risk review**로 추가.

## Decision status legend

- `INTERNALLY RESOLVED FOR SOCIAL LOGIN PREP`: Social Login 준비에 필요한 문구/처리방향이 정해짐
- `TECHNICAL VERIFY REQUIRED`: 법률가가 아니라 engineering/config 확인이 남음
- `USER DECISION REQUIRED`: 회사/제품 소유자 선택 필요
- `DEFERRED TO PAID FEATURE`: Plus 결제 활성화 전에 닫으면 됨
- `DEFERRED TO MERCHANT FEATURE`: 실제 Merchant flow 활성화 전에 닫으면 됨
- `PROVIDER TECHNICAL BLOCKER`: Provider 계약/코드 구현이 남음
- `COUNSEL REVIEW RECOMMENDED`: 외부 검토 권장, hard gate 아님

## Register

| ID | Topic | Current disposition | Owner / next action |
|---|---|---|---|
| Q01 | Social Provider processing classification | `INTERNALLY RESOLVED FOR SOCIAL LOGIN PREP` — factual disclosure, no blanket third-party/processor label | Privacy/Site |
| Q02 | Production infra overseas/processor data | `TECHNICAL VERIFY REQUIRED` | Core/Web/Infra before publish |
| Q03 | AI Provider task payload | `TECHNICAL VERIFY REQUIRED + COUNSEL REVIEW RECOMMENDED` | AI/Core before AI Production data disclosure |
| Q04 | Toss/App Store/Play privacy relationship | `DEFERRED TO PAID FEATURE + COUNSEL REVIEW RECOMMENDED` | Payments/App/Core |
| Q05 | provider_subject unlink retention | `INTERNALLY RESOLVED FOR WORDING / TECHNICAL PURGE VERIFY` | Security/Core |
| Q06 | provider_subject transform/delete on purge | `TECHNICAL/POLICY VERIFY REQUIRED` | Security/Core |
| Q07 | Kakao user-id deletion | `PROVIDER TECHNICAL BLOCKER` | Core Social |
| Q08 | Plus statutory transaction retention | `DEFERRED TO PAID FEATURE` | Payments/Core |
| Q09 | Merchant transaction retention | `DEFERRED TO MERCHANT FEATURE + COUNSEL REVIEW RECOMMENDED` | Transaction Kernel |
| Q10 | consent/audit/deletion evidence retention | `INTERNALLY RESOLVED FOR WORDING / TECHNICAL RETENTION CONFIG VERIFY` | Security/Core |
| Q11 | under-14 v1 policy | `USER DECISION REQUIRED — D1` | User / recommended A |
| Q12 | age gate implementation | `DEPENDS ON D1 / TECHNICAL HANDOFF READY` | Account/App/Core |
| Q13 | 14~18 paid/merchant handling | `DEFERRED TO PAID/MERCHANT FEATURE` | Payments/App |
| Q14 | ordinary-account purge period | `INTERNALLY RESOLVED FOR PUBLIC WORDING / TECHNICAL CONFIG VERIFY` | Core |
| Q15 | backup/log purge | `TECHNICAL VERIFY REQUIRED` | Infra/Core |
| Q16 | privacy officer/contact | `USER DECISION REQUIRED — D2` | User / recommended A |
| Q17 | membership contract formation | `INTERNALLY RESOLVED FOR TERMS CANDIDATE` | Terms/Site |
| Q18 | Passkey-incomplete account | `TECHNICAL UX VERIFY REQUIRED` | Core/Account |
| Q19 | Toss recurring billing display | `DEFERRED TO PAID FEATURE` | Payments/Web |
| Q20 | Plus cancellation effect | `USER DECISION D4 / DEFERRED TO PAID FEATURE` | User / recommended A |
| Q21 | Web refund/withdrawal | `DEFERRED TO PAID FEATURE + COUNSEL REVIEW RECOMMENDED` | Payments/Web |
| Q22 | Store refund vs entitlement | `DEFERRED TO PAID FEATURE + TECHNICAL VERIFY` | App/Core |
| Q23 | Plus grace | `USER DECISION D5 / DEFERRED TO PAID FEATURE` | User / recommended A |
| Q24 | price increase/free→paid notice | `OFFICIAL LAW CONFIRMED / DEFERRED TO PAID FEATURE` | Payments/Site/App |
| Q25 | Merchant legal role | `DEFERRED TO MERCHANT FEATURE + COUNSEL REVIEW RECOMMENDED` | Transaction Kernel |
| Q26 | intermediary duties | `DEFERRED TO MERCHANT FEATURE + COUNSEL REVIEW RECOMMENDED` | Core/Admin |
| Q27 | seller/cancel/refund disclosure | `DEFERRED TO MERCHANT FEATURE` | App/Web/Core |
| Q28 | deletion remote revoke | `PROVIDER TECHNICAL BLOCKER` | Core Social |
| Q29 | unlink remote revoke | `USER DECISION D3 + PROVIDER TECHNICAL BLOCKER` | User/Core Social / recommended A |
| Q30 | suspension notice/remedy | `INTERNALLY RESOLVED FOR TERMS CANDIDATE` | Terms/Account |
| Q31 | service change/interruption | `INTERNALLY RESOLVED FOR SOCIAL LOGIN; PAID DETAILS DEFERRED` | Product/Site |
| Q32 | Terms change/reconsent | `INTERNALLY RESOLVED FOR TERMS CANDIDATE` | Site/Core/Account |
| Q33 | liability/jurisdiction | `INTERNALLY RESOLVED CONSERVATIVELY + COUNSEL REVIEW RECOMMENDED` | Terms |
| Q34 | operator disclosure | `TECHNICALLY VERIFIED` | Site/Web/App |
| Q35 | effective/publication date | `USER PUBLISH APPROVAL STEP` | User/Site |
| Q36 | version/SHA/URI evidence | `TECHNICAL CONTRACT READY` | Site/Core/Account |

## User-decision authority

Source:

`docs/production-user-policy-decisions.md`

Recommended bundle:

- `D1=A`: v1 under-14 signup not supported
- `D2=A`: privacy officer = 전선혜 / `developer@lotbiai.com` / `063-237-0930`
- `D3=A`: explicit unlink/account deletion → Provider remote revoke when provider implementation is GREEN
- `D4=A`: Plus cancellation → entitlement through current paid-period end
- `D5=A`: channel-authoritative limited grace/retry

Only D1 and D2 are immediate Privacy/Terms finalization decisions for FREE Social Login publication.

## Counsel policy

`LEGAL_COUNSEL_REVIEW = OPTIONAL / RECOMMENDED`

No Q row remains blocked solely because an outside lawyer has not signed or answered it.

External counsel opinion, if obtained later, can update this register without reverting technically confirmed product contracts to unknown state.

Production publish and Provider activation remain separate explicit approval/technical gates.