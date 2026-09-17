# LOTBI Production Compliance / Risk Questionnaire

> 상태: `INTERNAL COMPLIANCE/RISK CHECKLIST READY / 36 QUESTIONS / COUNSEL OPTIONAL`
>
> 기준일: 2026-09-17 (Asia/Seoul)

이 문서는 더 이상 “외부 변호사 답변을 받아야 다음 단계로 진행할 수 있는 필수 질문서”가 아니다.

현재 용도:

- LOTBI 내부 Compliance/Risk checklist
- 공식 법령·Provider 문서 재확인 checklist
- 향후 필요 시 외부 법률전문가에게 전달할 optional risk-review questionnaire

답변이 없어도 공식자료/기술사실/사용자 정책으로 확정 가능한 항목은 계속 진행한다.

## A. 제3자 제공 / 처리위탁 / 국외이전

**Q01.** Social Providers와 LOTBI 사이 실제 data flow를 어떤 처리관계로 공개할 것인가?

**Q02.** 실제 Production Render/Vercel/OpenAI 등 인프라가 처리하는 개인정보·국가·기간·계약은 무엇인가?

**Q03.** AI Provider에 task payload를 보내는 경우 어떤 최소화·민감정보 통제가 필요한가?

**Q04.** Toss/App Store/Google Play에서 LOTBI가 실제 보관하는 payment/subscription reference와 역할은 무엇인가?

## B. Provider subject retention

**Q05.** unlink 후 takeover 방지를 위한 provider_subject reservation을 어느 범위/기간까지 유지할 것인가?

**Q06.** account deletion/final purge에서 raw subject 삭제 또는 비가역 변환이 필요한가?

**Q07.** Kakao service user ID 삭제정책과 LOTBI security reservation을 어떻게 맞출 것인가?

## C. 기록 보존

**Q08.** Plus 거래기록 중 전자상거래법상 5년/3년/6개월 기록은 무엇인가?

**Q09.** Merchant transaction evidence 중 LOTBI가 법적으로/운영상 보관해야 하는 범위는 무엇인가?

**Q10.** consent/security/deletion evidence의 합리적 보존기간은 무엇인가?

## D. Minor policy

**Q11.** v1 만14세 미만 가입을 미지원할 것인가? (`D1`)

**Q12.** 미지원 시 최소 age confirmation gate는 어떤 형태로 구현할 것인가?

**Q13.** 14~18세 이용자의 Plus/Merchant transaction 고지는 paid-service activation 전에 무엇이 필요한가?

## E. Account deletion / purge

**Q14.** 일반 계정정보의 final purge 운영기준은 무엇인가?

**Q15.** backup/log/receipt의 삭제·격리·접근제한은 실제 Production infra에서 어떻게 운영하는가?

## F. Privacy contact

**Q16.** 개인정보 보호책임자 또는 담당부서를 누구로 공식 운영할 것인가? (`D2`)

## G. Contract formation

**Q17.** account provisioning과 Passkey activation을 Terms에서 어떻게 구분할 것인가?

**Q18.** provisioned but Passkey-incomplete 계정의 사용자 표시/복구정책은 무엇인가?

## H. LOTBI Plus

**Q19.** Web Toss에서 자동갱신·결제주기·다음 결제정보를 어떻게 표시할 것인가?

**Q20.** Plus 해지 효력을 즉시 종료 vs paid-period end 중 무엇으로 할 것인가? (`D4`)

**Q21.** Web Toss 환불/청약철회/디지털서비스 제공개시 조건은 무엇인가?

**Q22.** App Store/Google Play refund event와 LOTBI entitlement를 어떻게 reconcile할 것인가?

**Q23.** payment failure/grace 중 Plus 권한을 어떻게 운영할 것인가? (`D5`)

**Q24.** 가격인상/FREE→유료 전환에 필요한 동의·30일 전 고지를 어떻게 구현할 것인가?

## I. Merchant role

**Q25.** 실제 독립몰/Cafe24/Godomall flow마다 LOTBI의 역할을 어떻게 표시할 것인가?

**Q26.** LOTBI가 주문/결제 요청을 전달할 때 적용되는 중개 관련 의무가 있는가?

**Q27.** 판매자·배송·취소·환불·분쟁 책임을 approval/receipt UI에서 어떻게 구분할 것인가?

## J. Provider lifecycle

**Q28.** account deletion에서 Kakao/NAVER/Apple remote revoke를 어느 상태까지 완료해야 하는가?

**Q29.** Social Login `unlink`에서도 remote revoke할 것인가? (`D3`)

## K. Suspension

**Q30.** 보안·부정거래·법령위반 시 제한사유/통지/이의절차를 어떻게 운영할 것인가?

## L. Service change

**Q31.** Provider/Merchant 장애·API 종료·서비스 종료 시 고지/복구/유료회원 처리는 무엇인가?

## M. Terms change

**Q32.** 변경약관 고지·재동의와 Social consent version/hash evidence를 어떻게 연결할 것인가?

## N. Liability / dispute

**Q33.** 법정권리를 침해하지 않으면서 LOTBI/Provider/Merchant 책임경계를 어떻게 표현할 것인가?

## O. Operator disclosure

**Q34.** 확인된 사업자정보를 Site/checkout/receipt 어느 위치에 표시할 것인가?

## P. Effective date / manifest

**Q35.** Privacy/Terms 최종 시행일과 공개순서를 어떻게 정할 것인가?

**Q36.** final HTML bytes의 version/SHA-256/URI를 Social Signup consent evidence로 어떻게 운영할 것인가?

---

# Current disposition

## Social Login Production prep에 즉시 필요한 사용자 결정

- Q11 → `D1`: 만14세 미만 v1 가입정책
- Q16 → `D2`: 개인정보 보호책임자/담당 경로

## Provider별 activation 전에 필요한 결정/구현

- Q29 → `D3`: remote revoke policy
- Q07/Q28: Kakao/NAVER/Apple lifecycle implementation

## Plus 결제 활성화 전에 필요한 결정

- Q20 → `D4`
- Q23 → `D5`
- Q19/Q21/Q22/Q24 paid-service terms

## 외부 counsel 권장영역

- Q01~Q04 complex overseas/processor classification
- Q21/Q22 refund/withdrawal
- Q25~Q27 Merchant legal role
- Q33 liability/dispute

`LEGAL_COUNSEL_REVIEW = OPTIONAL / RECOMMENDED / NOT HARD BLOCKER`.