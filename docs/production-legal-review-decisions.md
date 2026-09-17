# LOTBI Production Legal Review Decisions

> 상태: `DECISION INPUT TEMPLATE READY / ALL COUNSEL DECISIONS PENDING / DO NOT PUBLISH`
>
> 기준일: 2026-09-17 (Asia/Seoul)

이 문서는 외부 법률검토 결과를 기술 구현과 법률문구에 연결하기 위한 authoritative decision input template이다.

원칙:

- 법률전문가 답변 전 `DECISION`을 추측해 채우지 않는다.
- 승인 문구가 확정되면 Privacy/Terms 후보와 cross-repo handoff를 같은 decision ID로 갱신한다.
- `TECHNICAL ACTION`은 Core/Site/Account/App 등 실제 소유 repo와 연결한다.
- Production publish, Core manifest 배포, Provider activation은 별도 사용자 승인 gate를 유지한다.

## Decision register

| ID | QUESTION | DECISION | LEGAL BASIS | APPROVED WORDING | TECHNICAL ACTION | OWNER | STATUS |
|---|---|---|---|---|---|---|---|
| Q01 | Social Providers의 제3자 제공/위탁/국외이전 분류 | PENDING | PENDING | PENDING | PENDING | Legal + Privacy + Core | PENDING |
| Q02 | Render/Vercel/OpenAI 국외이전 근거·고지 | PENDING | PENDING | PENDING | Production data-flow manifest 필요 | Legal + Infra/Core/Web | PENDING |
| Q03 | AI Provider task payload 법적근거/민감정보 통제 | PENDING | PENDING | PENDING | AI payload/data minimization contract | Legal + Core | PENDING |
| Q04 | Toss/App Store/Google Play 개인정보 관계 | PENDING | PENDING | PENDING | channel data inventory | Legal + Payments/Core/App | PENDING |
| Q05 | provider_subject unlink 후 보존 근거/기간 | PENDING | PENDING | PENDING | retention/purge contract | Legal + Security/Core | PENDING |
| Q06 | provider_subject 비가역 변환 대안 | PENDING | PENDING | PENDING | security design if approved | Legal + Security/Core | PENDING |
| Q07 | Kakao user-id 삭제정책과 reservation 조정 | PENDING | PENDING | PENDING | Kakao lifecycle implementation | Legal + Core Social | PENDING |
| Q08 | Plus 거래기록 법정보존 | PENDING | PENDING | PENDING | retention mapping | Legal + Payments/Core | PENDING |
| Q09 | Merchant transaction record 보존 | PENDING | PENDING | PENDING | merchant-role retention mapping | Legal + Transaction Kernel | PENDING |
| Q10 | consent/audit/deletion evidence 보존 | PENDING | PENDING | PENDING | audit retention configuration | Legal + Security/Core | PENDING |
| Q11 | v1 만14세 미만 가입 제한 정책 | PENDING | PENDING | PENDING | age-policy gate if adopted | User + Legal + Account/App/Core | PENDING |
| Q12 | 최소 age verification 방식 | PENDING | PENDING | PENDING | age-gate implementation | User + Legal + Account/App/Core | PENDING |
| Q13 | 14~18세 구독/거래 법정대리인 고지 | PENDING | PENDING | PENDING | purchase/sign-up UI if required | Legal + Payments/App/Web | PENDING |
| Q14 | deletion 일반정보 운영상 purge 기간 | PENDING | PENDING | PENDING | purge configuration | Legal + Core | PENDING |
| Q15 | backup/log 삭제 및 purge receipt 표현 | PENDING | PENDING | PENDING | infra purge/log contract | Legal + Infra/Core | PENDING |
| Q16 | 개인정보 보호책임자/담당부서 지정·공개 | PENDING | PENDING | PENDING | Privacy contact fields | User + Legal + Site | PENDING |
| Q17 | Social Signup 계약 성립시점 | PENDING | PENDING | PENDING | Terms/UI state wording | Legal + Core/Account | PENDING |
| Q18 | account provisioned / Passkey incomplete 상태 | PENDING | PENDING | PENDING | account-state/UI contract | Legal + Core/Account | PENDING |
| Q19 | Web Toss 자동갱신/결제일 표시 | PENDING | PENDING | PENDING | subscription checkout UI | Legal + Payments/Web | PENDING |
| Q20 | 채널별 해지 효력시점 | PENDING | PENDING | PENDING | entitlement policy | User + Legal + Payments/App | PENDING |
| Q21 | Web 환불/청약철회/디지털 제공개시 | PENDING | PENDING | PENDING | refund workflow | Legal + Payments/Web | PENDING |
| Q22 | Store 환불과 LOTBI entitlement | PENDING | PENDING | PENDING | store notification/reconciliation | Legal + App/Core | PENDING |
| Q23 | 결제실패/grace period 서비스권한 | PENDING | PENDING | PENDING | dunning/entitlement state machine | User + Legal + Payments/Core | PENDING |
| Q24 | 가격인상/FREE→유료 동의·고지 | PENDING | PENDING | PENDING | notice/consent UI | Legal + Payments/Site/App | PENDING |
| Q25 | Merchant flow별 LOTBI 법적 지위 | PENDING | PENDING | PENDING | per-merchant legal-role matrix | Legal + Transaction Kernel | PENDING |
| Q26 | 주문/결제 전달 시 중개자 의무 적용범위 | PENDING | PENDING | PENDING | transaction disclosure controls | Legal + Core/Admin | PENDING |
| Q27 | 판매자/배송/취소/환불/분쟁 고지 | PENDING | PENDING | PENDING | approval/receipt UI | Legal + App/Web/Core | PENDING |
| Q28 | account deletion 시 Provider remote revoke 시점 | PENDING | PENDING | PENDING | Kakao/NAVER/Apple lifecycle | Legal + Core Social | PENDING |
| Q29 | unlink 시 remote Provider revoke 정책 | PENDING | PENDING | PENDING | provider-specific unlink policy | User + Legal + Core Social | PENDING |
| Q30 | 이용제한 통지/이의/Plus 처리 | PENDING | PENDING | PENDING | restriction/notice workflow | Legal + Core/Account | PENDING |
| Q31 | 서비스 변경/중단/종료 고지·보상 | PENDING | PENDING | PENDING | notice/termination workflow | Legal + Product/Site | PENDING |
| Q32 | 약관변경 고지·재동의 기준 | PENDING | PENDING | PENDING | legal manifest/version flow | Legal + Site/Core/Account | PENDING |
| Q33 | 책임제한/분쟁/관할 | PENDING | PENDING | PENDING | Terms only unless process required | Legal | PENDING |
| Q34 | 사업자정보 필수 표시위치 | PENDING | PENDING | PENDING | Site/checkout/receipt layout | Legal + Site/Web/App | PENDING |
| Q35 | Privacy/Terms 시행일·사전고지 | PENDING | PENDING | PENDING | publication schedule | Legal + Site | PENDING |
| Q36 | version/SHA-256 consent evidence 운영 | PENDING | PENDING | PENDING | final manifest freeze/hash | Legal + Core/Site/Account | PENDING |

## User decisions that counsel input may unlock

현재 아래 제품/운영 결정은 법률의견을 받은 뒤 사용자가 최종 선택해야 한다.

- `MINOR_POLICY`: v1 만14세 미만 가입 제한 채택 여부 및 age gate 방식
- `PRIVACY_OFFICER_OR_DEPARTMENT`: 실제 책임자/담당부서 지정
- `LOTBI_PLUS_CANCELLATION_EFFECT`: 채널별 해지 효력 정책
- `LOTBI_PLUS_PAYMENT_FAILURE_GRACE`: 결제실패/grace 중 서비스권한 정책
- `APPLE_UNLINK_REMOTE_REVOKE_POLICY` 및 Provider별 unlink remote revoke 범위

이 항목들은 법률검토 전 자동 결정하지 않는다.

## Completion rule

다음 조건을 만족해도 이 문서만으로 Production 변경 권한이 생기지 않는다.

1. 관련 Q가 `APPROVED` 또는 `APPROVED WITH CHANGES`;
2. legal basis가 기록됨;
3. approved wording이 Privacy/Terms candidate에 반영됨;
4. 필요한 technical action이 owning repo handoff에 연결됨;
5. final legal pages가 별도 사용자 승인 전에는 `DO NOT PUBLISH` 유지.
