# LOTBI Production Legal Review Questionnaire

> 상태: `READY FOR COUNSEL / 36 QUESTIONS / DO NOT PUBLISH`
>
> 기준일: 2026-09-17 (Asia/Seoul)

이 질문서는 `docs/production-legal-review-package.md`, `docs/production-personal-data-processing-inventory.md`, `docs/production-privacy-candidate.md`, `docs/production-terms-candidate.md`와 함께 검토한다.

답변은 가능하면 각 질문에 대해 `DECISION / LEGAL BASIS / APPROVED WORDING / TECHNICAL ACTION` 형태로 요청한다.

## A. 제3자 제공 / 처리위탁 / 국외이전

**Q01.** LOTBI가 Google, Kakao, NAVER, Apple의 Social Login을 사용하면서 각 Provider의 stable subject identifier를 LOTBI 계정과 연결해 저장하는 구조에서, Provider별 관계를 개인정보 보호법상 제3자 제공·처리위탁·국외이전 또는 그 밖의 구조 중 어떻게 분류하고 Privacy에 어떤 항목으로 고지해야 합니까?

**Q02.** LOTBI Production에서 실제 사용하게 될 Render/Vercel/OpenAI 등 해외 인프라 또는 AI 서비스에 계정·세션·task payload·로그 등 개인정보가 처리 또는 보관되는 경우, 제28조의8상 어떤 국외이전 근거를 사용할 수 있고 Privacy에 어떤 국가/수령자/항목/목적/기간/시점·방법을 공개해야 합니까?

**Q03.** OpenAI 등 AI Provider에 사용자의 task 내용 일부를 보내는 구조가 활성화될 경우, LOTBI가 명시적 동의를 별도로 받아야 하는 상황과 계약 이행을 위한 처리/위탁 근거로 가능한 상황을 어떻게 구분해야 하며, user prompt에 민감정보가 포함될 가능성은 어떤 방식으로 고지·통제해야 합니까?

**Q04.** Toss Payments, Apple App Store, Google Play를 구독 결제 채널로 사용할 때 LOTBI와 각 사업자의 개인정보 처리관계를 어떻게 분류하고, payment/subscription reference와 환불·entitlement 이벤트를 Privacy에 어느 범위까지 공개해야 합니까?

## B. Provider subject retention

**Q05.** Social Login `provider_subject`를 unlink 후 다른 LOTBI 계정으로의 탈취/재귀속 방지를 위한 unique reservation으로 유지하는 경우, 개인정보 보호법상 허용 가능한 처리근거와 최대 보존기간 또는 종료조건은 무엇입니까?

**Q06.** LOTBI account deletion 후에도 takeover 방지 목적으로 provider subject 원문을 유지하는 것이 과도하다면, salted hash/비가역 변환 또는 별도 deny-list 형태로 보안목적을 달성하는 것이 허용 가능한 대안인지, 그 경우에도 개인정보로 취급해야 하는지 검토해 주세요.

**Q07.** Kakao가 service user ID를 개인정보로 보고 회원탈퇴 시 파기를 요구하는 공식 정책과 LOTBI의 subject reservation 보안목적을 어떻게 조화해야 하며, Kakao에 한해 다른 retention rule이 필요한지 검토해 주세요.

## C. 법정 보존

**Q08.** LOTBI Plus Web/App Store/Google Play 구독에서 전자상거래법상 계약·청약철회, 대금결제·공급, 소비자 불만·분쟁 기록의 법정 보존기간이 LOTBI에 어떻게 적용되고, 어떤 최소 데이터 필드를 남겨야 합니까?

**Q09.** 외부 Merchant 상품·예약·여행 거래에서 LOTBI가 주문·결제 실행을 보조하거나 transaction evidence를 보관하는 경우, LOTBI의 실제 법적 역할에 따라 어떤 거래기록을 얼마 동안 보존해야 합니까?

**Q10.** Social consent evidence, security/audit event, account deletion receipt 등은 별도의 법정 보존의무가 없다면 어떤 보안·분쟁대응 근거와 합리적 기간으로 보존할 수 있습니까?

## D. Minor policy

**Q11.** LOTBI v1에서 만 14세 미만 회원가입을 제한하는 정책이 법률·앱스토어·서비스 구조상 가장 단순하고 적절한지 검토해 주세요.

**Q12.** 만 14세 미만 가입을 제한한다면 어떤 연령 확인/확약 방식이 필요하고, 생년월일 자체를 추가 수집하지 않는 최소화된 gate가 가능한지 검토해 주세요.

**Q13.** 만 14세 이상 19세 미만 미성년자의 LOTBI Plus 구독 또는 외부 Merchant 거래에 필요한 법정대리인 관련 고지·동의·계약취소 안내는 어떤 방식이어야 합니까?

## E. Production purge period

**Q14.** LOTBI account deletion request 후 계정 접근·세션·권한은 즉시 revoke하되 final purge를 별도 workflow로 처리할 때, 법정보존 대상이 아닌 일반 계정정보를 운영상 삭제대기 상태로 둘 수 있는 합리적 최대기간과 근거는 무엇입니까?

**Q15.** 백업·로그·보안감사 자료에 잔존할 수 있는 개인정보의 삭제/격리/접근제한 정책을 Privacy에서 어느 수준으로 공개해야 하며, purge receipt의 예정일 표현은 어떻게 해야 합니까?

## F. Privacy officer / department

**Q16.** 유한회사 알에이디홀딩스가 개인정보 보호책임자를 별도로 지정해야 하는지, 소상공인 예외가 적용될 수 있는지 확인해 주시고, 최종 Privacy에 공개할 `책임자 성명` 또는 `개인정보 보호업무 담당부서 명칭 + 연락처`의 필수범위를 확정해 주세요.

## G. Contract formation time

**Q17.** Social Signup에서 Provider verification → name/handle + Terms/Privacy consent → Core account provisioning/ENROLLMENT → first Passkey enrollment 순서일 때 LOTBI 회원가입/이용계약의 법률상 성립시점을 어느 단계로 정하는 것이 적절합니까?

**Q18.** Core account가 provision됐지만 사용자가 첫 Passkey enrollment를 완료하지 못한 경우 계정/계약 상태를 Terms와 UI에서 어떻게 표현해야 합니까?

## H. LOTBI Plus subscription terms

**Q19.** 월 9,900원 LOTBI Plus의 Web Toss Payments 자동결제에서 자동갱신 여부, 결제주기, 다음 결제일/금액, 해지 방법을 계약 전 어떤 방식으로 표시해야 합니까?

**Q20.** 사용자가 해지를 신청했을 때 Web/iPhone/Android 각 채널에서 `해지 즉시 entitlement 종료`와 `현재 결제기간 종료 시 종료` 중 어떤 정책을 채택할 수 있으며, 최종 약관 문구는 어떻게 구분해야 합니까?

**Q21.** Web Toss 결제의 청약철회·환불·부분사용 환불 및 디지털 서비스 제공 개시 후 제한을 어떤 기준으로 정해야 하며, 사용자에게 어떤 사전 동의 또는 확인이 필요합니까?

**Q22.** Apple App Store 또는 Google Play에서 Store가 환불을 승인·거절하는 경우 LOTBI 약관이 Store 정책과 한국 소비자법 사이의 관계를 어떻게 설명해야 하고, LOTBI entitlement는 어느 event 시점에 회수/복구해야 합니까?

**Q23.** 결제 실패·billing retry·grace period 중 LOTBI Plus 기능을 계속 제공할지 제한할지에 관한 정책에서 법률상 주의할 점과 고지문구는 무엇입니까?

**Q24.** 정기결제 가격 인상 또는 FREE→유료 전환에서 전자상거래법상 동의·30일 전 고지 요구를 LOTBI Web/Store 채널에 각각 어떻게 적용해야 합니까?

## I. Commerce role / Merchant transaction

**Q25.** 독립몰/Cafe24/Godomall 등의 공식 checkout/order API를 LOTBI Transaction Kernel이 사용자 승인 범위 내에서 실행하는 경우, LOTBI는 거래 유형별로 통신판매업자·통신판매중개자·구매대행/실행보조자·기타 중 어떤 지위가 될 수 있습니까?

**Q26.** LOTBI가 외부 Merchant 주문/결제 요청을 기술적으로 전달하거나 주문결과를 조회하지만 상품대금을 직접 수취·정산하지 않는 경우에도 전자상거래법 제20조/제20조의3 관련 중개자 의무가 적용되는 범위는 어디까지입니까?

**Q27.** 외부 Merchant 거래의 판매자 정보, 배송/취소/환불, 분쟁처리, LOTBI 책임범위를 Terms와 거래 승인 화면에 어떤 방식으로 구분 고지해야 합니까?

## J. Account deletion / Provider lifecycle

**Q28.** LOTBI account deletion 시 Kakao Unlink, NAVER token revocation/disconnect, Apple authorization revoke를 local account deletion lifecycle에 어느 시점까지 완료해야 하며, Provider 장애로 revoke가 지연될 때 사용자에게 어떤 상태를 표시할 수 있습니까?

**Q29.** Social Login `unlink`와 LOTBI `account deletion`을 별개 기능으로 제공할 때, remote Provider authorization까지 함께 끊을지 여부를 Provider별로 달리 정할 수 있으며 Privacy/Terms에서 어떻게 설명해야 합니까?

## K. Suspension / remedy

**Q30.** 계정 탈취·부정거래·보안공격·법령위반 등의 사유로 LOTBI가 계정 또는 특정 기능을 제한할 때 사전/사후 통지, 제한기간, 이의제기, Plus 잔여기간 처리에 필요한 공정한 약관기준을 제시해 주세요.

## L. Service change / interruption

**Q31.** Provider/Merchant 장애, API 종료, 보안사고 또는 서비스 정책 변경으로 LOTBI 기능을 변경·중단·종료할 때 필요한 사전고지 기간, 긴급 예외, 유료회원 보상/환불 및 책임범위를 확정해 주세요.

## M. Terms change

**Q32.** 일반 약관변경과 이용자에게 불리한 중요변경의 고지기간·재동의 기준을 구분해 주시고, Social Signup의 version/hash consent evidence와 기존 회원의 변경약관 적용을 어떻게 연결해야 합니까?

## N. Liability / jurisdiction

**Q33.** LOTBI의 자체 서비스, Provider 장애, Merchant 거래를 고려할 때 허용 가능한 손해배상/책임제한 범위와 소비자분쟁 해결·준거법·관할 조항의 적절한 최종문구를 제시해 주세요.

## O. Operator disclosure

**Q34.** 현재 확인된 사업자정보(유한회사 알에이디홀딩스, 대표자 전선혜, 사업자등록번호 583-88-03679, 통신판매업신고번호 2026-전주덕진-0798, 주소, 이메일, 전화)를 Privacy/Terms/구독 checkout/외부 Merchant 거래화면 중 어디에 필수 표시해야 하며 추가 고지항목이 있습니까?

## P. Effective dates / publication

**Q35.** 현재 사전 공개 Privacy/Terms를 Production 정식 문서로 교체할 때 시행일과 공개일 사이에 필요한 사전고지 기간을 어떻게 설정해야 하며, 신규 가입자와 기존 이용자를 다르게 처리해야 합니까?

**Q36.** 법률검토 완료 후 `LOTBI_PRIVACY_<YYYY-MM-DD>_R<n>` / `LOTBI_TERMS_<YYYY-MM-DD>_R<n>`와 exact HTML SHA-256을 Social Signup manifest에 고정하는 방식이 동의증빙으로 적절하며, 문서의 비본질적 HTML 변경에도 새 version/hash를 발급하는 운영이 필요한지 검토해 주세요.

---

## Counsel return format

각 Q에 대해 가능하면 아래 6개 필드를 채운다.

- `DECISION`
- `LEGAL BASIS`
- `APPROVED WORDING`
- `TECHNICAL ACTION`
- `OWNER`
- `STATUS = APPROVED / APPROVED WITH CHANGES / NEED MORE FACTS / NOT APPLICABLE`
