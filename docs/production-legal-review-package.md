# LOTBI Production Privacy / Terms — Decision-Ready Legal Review Package

> 상태: `COUNSEL-READY PACKAGE / LEGAL REVIEW NOT COMPLETE / DO NOT PUBLISH`
>
> 기준일: 2026-09-17 (Asia/Seoul)
>
> 목적: LOTBI Production 개인정보처리방침·이용약관 및 Social Signup legal manifest를 외부 법률전문가가 **결정 가능한 형태**로 검토할 수 있도록 기술사실, 공식 근거, 후보문구, 결정질문과 위험을 분리한다.

이 문서는 법률의견서가 아니다. `[TECHNICALLY VERIFIED]`는 LOTBI 코드/공개 서비스/확정 제품정책에서 확인한 사실을 뜻하고, `[LEGAL REVIEW REQUIRED]`는 법률전문가가 실제 사업·계약·데이터 흐름을 기준으로 확정해야 하는 사항을 뜻한다.

## 0. 기준선

### LOTBI 기술/제품 기준

- Core Social review: `b555420b8d75c9e241a6cd9bd534f205499a87d8`
- Account Social review: `5eadea164d559a4f3c45dfca18d6c2acf95a40c0`
- Social Auth contract: `LOTBI_SOCIAL_AUTH_V2`
- FREE policy: `docs/free-monthly-3-task-product-policy.md`
- Privacy candidate: `docs/production-privacy-candidate.md`
- Terms candidate: `docs/production-terms-candidate.md`
- Data inventory: `docs/production-personal-data-processing-inventory.md`
- Counsel questionnaire: `docs/production-legal-review-questionnaire.md`
- Decision input: `docs/production-legal-review-decisions.md`

### 현재 공개 사업자정보 — [TECHNICALLY VERIFIED]

LOTBI 공식사이트 현재 main/Production에 확인되는 정보:

- 운영회사: 유한회사 알에이디홀딩스
- 대표자: 전선혜
- 주소: 전북특별자치도 전주시 덕진구 혁신로 542, 1동 1층 (여의동)
- 사업자등록번호: 583-88-03679
- 통신판매업신고번호: 2026-전주덕진-0798
- 서비스 문의 이메일: `developer@lotbiai.com`
- 대표전화: `063-237-0930`

개인정보 보호책임자 또는 개인정보 보호업무 담당부서의 공식 지정은 이 패키지에서 확인되지 않았다.

### 공식 법령/가이드 기준

법률전문가가 원문 최신성을 다시 확인하는 것을 전제로 다음 현재 공식 기준을 조사에 사용했다.

- 개인정보 보호법: 2026-09-11 시행본
- 개인정보 보호법 시행령
- 개인정보보호위원회 `개인정보 처리방침 작성지침(2026.4. 개정)`
- 개인정보보호위원회 `개인정보 처리방침 표준(안)(2026.2.; 2026.7.24 수정본)`
- 개인정보보호위원회 `개인정보 보호책임자 지정·신고 실무 매뉴얼(2026.9.)`
- 전자상거래 등에서의 소비자보호에 관한 법률: 2026-07-21 시행본
- 전자상거래법 시행령
- 약관의 규제에 관한 법률: 2024-08-07 시행본
- Google OAuth / User Data Policy 공식 문서
- Kakao Developers Kakao Login 공식 문서
- NAVER Developers Login 공식 문서
- Apple Developer Sign in with Apple / subscription 공식 문서
- Toss Payments 개발자센터 공식 문서
- Google Play Billing 공식 문서

---

# A. THIRD_PARTY_PROCESSING_AND_OVERSEAS_TRANSFER

**1. LOTBI 현재 기술/사업 사실 — [TECHNICALLY VERIFIED]**

- Social identity 최소값은 Google `sub`, Kakao `sub`, NAVER `response.id`, Apple `sub`다.
- Provider email/name/profile을 현재 Social identity로 가져오지 않는다.
- Social OAuth/OIDC 과정에서는 Provider와 네트워크 통신하고 authorization code/token 등 인증 material을 일시 처리한다.
- Core repository에는 Render pilot blueprint가 있으며 Singapore region을 사용하지만, 그 파일은 명시적으로 pilot/non-production이므로 LOTBI Production hosting region의 증거로 사용하지 않는다.
- OpenAI/Render/Vercel/GitHub/Toss/Store 채널은 실제 Production 데이터 흐름과 계약범위를 별도로 확정해야 한다.

**2. 공식 요구 — [LEGAL SOURCE]**

개인정보 보호법 제28조의8은 개인정보의 국외 제공뿐 아니라 국외 처리위탁·보관을 포함해 국외이전 근거와 고지/동의 요건을 규정한다. 개인정보처리방침에는 실제 해당하는 국외이전 근거와 세부사항을 반영해야 한다. 단순히 외국계 서비스라는 이유만으로 제3자 제공/처리위탁/국외이전의 법률분류를 자동 확정할 수는 없다.

**3. Privacy 후보문구**

`회사는 서비스 제공 과정에서 외부 서비스 사업자와 데이터를 송수신할 수 있습니다. 제3자 제공, 처리위탁 또는 국외이전에 해당하는 관계는 실제 계약과 데이터 흐름에 따라 개인정보처리방침에 사업자, 처리항목, 목적, 국가·시점·방법, 보유기간 및 법적 근거를 구체적으로 고지합니다.`

**4. 기술적으로 확정 가능**

- Provider별 최소 identifier
- Provider profile 최소화
- canonical LOTBI legal URLs
- 현재 reviewed Social Login 흐름

**5. 법률전문가 결정 필요**

Google/Kakao/NAVER/Apple, Render, Vercel, GitHub, OpenAI, Toss Payments, Apple App Store, Google Play 각각에 대해 LOTBI가 controller/processor 관계상 어떤 지위이며 한국법상 제3자 제공/처리위탁/국외이전 중 무엇으로 고지해야 하는지, 어떤 법적 근거를 사용할지 결정한다.

**6. 잘못 결정할 위험**

필수 고지/동의 누락, 실제와 다른 수탁/제공관계 표기, 국외이전 법적 근거 불일치, Provider review와 Privacy 불일치.

**7. 권장 질문**

Q01~Q04 참조.

**8. Status**

`TECHNICAL FACT CONFIRMED / LEGAL DECISION REQUIRED / READY FOR COUNSEL REVIEW`

---

# B. PROVIDER_SUBJECT_RETENTION_BASIS_AND_PERIOD

**1. 기술/사업 사실**

현재 Core는 unlink 후 `ExternalAccountIdentity`를 `REVOKED`로 전환하면서 Provider + subject의 unique reservation을 유지한다. 목적은 같은 Provider identity가 다른 LOTBI 사용자에게 조용히 재귀속되는 takeover/relink 위험을 막는 것이다.

**2. 공식 요구**

개인정보 보호법상 처리목적 달성 후 불필요한 개인정보는 원칙적으로 지체 없이 파기하되 다른 법률상 보존근거가 있으면 분리 보관한다. Kakao 공식 문서는 서비스 탈퇴 시 service user ID를 개인정보로 보고 파기하는 방향을 명시하고, 보존 시 사용자 동의를 요구하는 취지의 안내가 있다.

**3. Privacy 후보문구**

`Social Login 연결 해제 후 계정 탈취·부정 재연결 방지를 위해 Provider 식별자에 대한 제한된 보안 reservation이 필요할 수 있습니다. 실제 보존근거·기간·변환 방식은 관계 법령 및 Provider 정책을 검토하여 공개합니다.`

**4. 기술 확정 가능**

- reservation의 보안 목적
- unlink와 account deletion/final purge가 별도 lifecycle이라는 사실

**5. 법률전문가 결정 필요**

보존 법적근거, 최대 기간 또는 종료조건, 계정삭제 후 처리, final purge 시 원문삭제/비가역 변환/별도 보안보존 중 허용 방식, Kakao 등 Provider 요구와 충돌 해소.

**6. 위험**

목적 달성 후 과도한 보존, Provider 정책 위반, 재가입 보안정책을 이유로 사실상 영구보존하는 문제.

**7. 권장 질문**

Q05~Q07.

**8. Status**

`LEGAL DECISION REQUIRED / READY FOR COUNSEL REVIEW`

---

# C. STATUTORY_RETENTION_ITEMS_AND_PERIODS

**1. 기술/사업 사실**

Core에는 transaction/audit evidence와 account deletion record가 존재하며 final purge가 즉시 hard delete가 아닌 별도 운영 workflow다. Plus와 향후 Merchant transaction은 서로 다른 금전/거래 구조다.

**2. 공식 요구**

전자상거래법/시행령은 적용되는 통신판매 거래기록에 대해 표시·광고 6개월, 계약/청약철회 5년, 대금결제/재화공급 5년, 소비자 불만/분쟁 3년 등의 보존기간을 둔다. 어떤 LOTBI record가 이 범주에 해당하는지는 실제 법적 역할과 거래흐름에 따라 판단해야 한다.

**3. Privacy 후보문구**

`관계 법령상 보존의무가 있는 거래·결제·청약철회·소비자분쟁 기록은 해당 법적 근거와 기간 동안 계정의 일반 이용정보와 구분하여 보존할 수 있습니다.`

**4. 기술 확정 가능**

- final purge와 statutory retention을 분리할 수 있는 lifecycle 필요
- consent/audit/deletion evidence가 존재한다는 사실

**5. 법률전문가 결정 필요**

LOTBI Plus Web/App Store/Play, 외부 Merchant 거래, admin/security audit, consent evidence 각각의 법정 또는 분쟁대응 보존근거·기간·최소항목.

**6. 위험**

필수 기록 조기삭제 또는 근거 없는 장기보존, 법률문구와 실제 purge engine 충돌.

**7. 권장 질문**

Q08~Q10.

**8. Status**

`LEGAL DECISION REQUIRED / READY FOR COUNSEL REVIEW`

---

# D. MINOR_POLICY

**1. 기술/사업 사실**

현재 reviewed Social Signup에는 만 14세 확인, 법정대리인 동의 또는 연령검증 계약이 확인되지 않았다.

**2. 공식 요구**

개인정보 보호법은 만 14세 미만 아동의 개인정보 처리에 동의가 필요한 경우 법정대리인 동의를 받고 이를 확인하도록 요구한다. 전자상거래법상 미성년자 계약에는 법정대리인 동의 없이 체결한 계약의 취소 가능성 관련 고지가 문제될 수 있다.

**3. v1 가장 단순한 정책 후보 — [NOT IMPLEMENTED]**

`LOTBI v1은 만 14세 미만 이용자의 회원가입을 허용하지 않는다.`

필요 기술변경 후보: 가입 시 연령/생년 또는 최소한 14세 이상 확인 gate, 우회방지·기록범위 설계, 기존 계정 처리, App/Web 동일정책, Privacy/Terms/스토어 설명 정합화.

**4. 기술 확정 가능**

현재는 under-14 workflow가 구현됐다고 표시할 수 없다.

**5. 법률전문가 결정 필요**

단순 가입제한 정책이 LOTBI 서비스/앱스토어 운영에 적절한지, 어떤 age gate와 고지로 충분한지, 만 14세 이상 미성년자의 계약/유료구독 처리를 어떻게 할지.

**6. 위험**

아동 동의절차 없이 개인정보 처리, 실제 미구현 age gate를 Privacy에 허위 기재.

**7. 권장 질문**

Q11~Q13.

**8. Status**

`USER DECISION REQUIRED + LEGAL DECISION REQUIRED / READY FOR COUNSEL REVIEW`

---

# E. PRODUCTION_PURGE_PERIOD

**1. 기술/사업 사실**

Account deletion request는 즉시 접근/세션/권한을 revoke한 뒤 deletion lifecycle로 진입한다. source default에 30일 값이 있어도 actual Production 설정과 법률근거가 확정되지 않았으므로 30일을 공개 약속하지 않는다.

**2. 공식 요구**

개인정보 보호법은 목적 달성·보유기간 경과 등 불필요해진 개인정보를 원칙적으로 지체 없이 파기하도록 요구하고, 다른 법률상 보존은 분리 처리한다.

**3. 후보문구**

`계정 삭제 요청 후 즉시 계정 이용권한과 활성 인증수단을 회수하며, 개인정보는 법정 보존기록과 운영상 필요한 삭제처리 절차를 구분하여 순차적으로 파기합니다. 구체적 기간은 실제 운영정책과 법적 근거에 따라 안내합니다.`

**4. 기술 확정 가능**

- immediate hard delete가 아님
- access revoke와 final purge는 분리

**5. 법률전문가 결정 필요**

운영상 임시보존 기간을 둘 수 있는 근거와 최장기간, backup/log 삭제 정책, statutory retention과 purge receipt 표시방식.

**6. 위험**

근거 없는 30일 보존, 반대로 감사/법정보존 기록 조기파기, 공개문구와 receipt 불일치.

**7. 권장 질문**

Q14~Q15.

**8. Status**

`LEGAL DECISION REQUIRED / READY FOR COUNSEL REVIEW`

---

# F. PRIVACY_OFFICER_OR_DEPARTMENT

**1. 기술/사업 사실**

공개 사업자정보와 일반 privacy/support contact는 확인됐지만 개인정보 보호책임자 또는 담당부서의 공식 지정정보는 확인되지 않았다.

**2. 공식 요구**

개인정보 보호법/시행령은 개인정보 보호책임자 지정 체계와 처리방침 내 책임자 성명 또는 개인정보 보호업무 담당부서 및 연락처 공개를 요구한다. 소상공인 예외 해당 여부는 회사 규모·법적 지위 확인이 필요하다.

**3. Privacy placeholder**

`[USER DECISION REQUIRED — 개인정보 보호책임자 또는 개인정보 보호업무 담당부서의 공식 명칭/담당자/연락처]`

**4. 기술 확정 가능**

- `developer@lotbiai.com`
- `063-237-0930`
- 운영회사 정보

**5. 법률전문가/사용자 결정 필요**

CPO 지정 의무/예외 해당 여부, 지정할 사람 또는 담당부서, 공개해야 할 정확한 연락정보.

**6. 위험**

가짜 담당자 기재 또는 법정 공개사항 누락.

**7. 권장 질문**

Q16.

**8. Status**

`USER DECISION REQUIRED / LEGAL CONFIRMATION REQUIRED`

---

# G. CONTRACT_FORMATION_TIME

**1. 기술/사업 사실**

Social Signup 순서는 Provider verification → LOTBI name/handle + Terms/Privacy 필수 동의 → account provisioning/ENROLLMENT → first Passkey enrollment → FULL이다.

**2. 공식 요구**

전자상거래/약관 규율에서는 중요한 거래조건·약관을 계약 전 명확히 고지하고 동의증빙과 성립시점을 실제 UI/상태와 맞출 필요가 있다.

**3. Terms 후보문구**

`회원가입 및 이용계약은 회사가 정한 가입 절차와 필수 동의를 완료하고 회사가 계정 생성을 승인한 시점에 성립합니다. Passkey 등록 등 추가 보안절차는 계정 이용을 위한 후속 보안요건으로 운영될 수 있습니다.`

위 문구는 후보이며 account provisioning/Passkey 시점 중 법률상 성립점을 counsel이 확정해야 한다.

**4. 기술 확정 가능**

state transition 순서와 consent evidence 저장.

**5. 법률전문가 결정 필요**

계약/회원가입 성립시점, Passkey 실패 시 이미 성립한 계정의 법적 상태, 가입완료 UI 문구.

**6. 위험**

가입됐는지 여부와 법률문구/receipt가 불일치.

**7. 권장 질문**

Q17~Q18.

**8. Status**

`LEGAL DECISION REQUIRED / READY FOR COUNSEL REVIEW`

---

# H. LOTBI_PLUS_SUBSCRIPTION_TERMS

**1. 제품사실 — [TECHNICALLY/PRODUCT VERIFIED]**

- LOTBI Plus: 월 9,900원
- Web: Toss Payments
- iPhone: Apple App Store subscription
- Android: Google Play subscription
- FREE: 월 3개 성공 작업
- Plus를 무제한 일반 AI 사용권으로 표현하지 않음

**2. 공식 요구**

전자상거래법상 계약 전 청약철회·계약해지 조건/효과 등을 표시해야 하며, 정기결제의 가격 인상 또는 무료→유료 전환에는 별도 동의/사전 고지 규정이 적용된다. Apple/Google은 각각 auto-renewable subscription, cancellation, billing retry/grace, refund/revocation lifecycle을 자체 채널 규칙으로 운영한다. Toss Payments는 PG/빌링 API 운영규칙을 제공하나 LOTBI의 소비자법상 환불정책 자체를 대신 정하지 않는다.

**3. Terms 후보구조**

- 자동갱신 여부와 갱신주기
- 다음 결제일/결제금액 표시
- 해지 신청 경로
- 해지 효력 시점
- 결제 실패/재시도/grace period
- 환불/청약철회
- 디지털 서비스 제공 개시 후 처리
- Apple/Google/Toss 채널별 환불 처리와 LOTBI entitlement 동기화

**4. 기술 확정 가능**

판매채널과 가격, Plus와 Merchant 거래대금의 분리.

**5. 법률전문가 결정 필요**

위 각 조항의 최종 소비자 고지문구와 한국법/Store 정책 간 우선관계, Web과 Store 간 entitlement 종료 기준.

**6. 위험**

불공정 약관, 청약철회/환불 고지 누락, Store 환불 후 서비스권한이 남거나 반대 상황.

**7. 권장 질문**

Q19~Q24.

**8. Status**

`PRODUCT FACT CONFIRMED / LEGAL DECISION REQUIRED / READY FOR COUNSEL REVIEW`

---

# I. COMMERCE_ROLE_AND_RESPONSIBILITY

**1. 기술/사업 사실**

LOTBI Plus 구독료는 LOTBI 자체 유료서비스 대가다. 외부 Merchant의 상품·예약·여행·지역서비스 거래대금은 별도 Merchant/payment 구조와 연결된다. Transaction Kernel은 approval, revalidation, idempotency, UNKNOWN recovery 등 기술적 실행 안전장치를 담당한다.

**2. 공식 요구**

전자상거래법은 통신판매업자와 통신판매중개자의 정보제공·고지·분쟁처리·책임을 구분하며, 중개자가 주문/결제를 접수하는 경우 추가 책임이 붙을 수 있다. `중개자이므로 책임 없음` 같은 포괄면책은 안전하지 않다.

**3. Terms 후보문구**

`LOTBI 자체 구독서비스와 외부 판매자·서비스 제공자와의 거래는 구분됩니다. 개별 외부 거래에서 LOTBI의 역할과 책임, 판매자 정보, 결제·취소·환불 주체는 해당 거래화면과 적용 법령에 따라 안내합니다.`

**4. 기술 확정 가능**

Plus와 Merchant 거래대금 분리, Kernel의 기술적 역할.

**5. 법률전문가 결정 필요**

실제 거래유형별 LOTBI의 지위(판매자/통신판매중개/구매실행 보조/대행/결제수취 등), 각 flow에 필요한 고지와 책임.

**6. 위험**

법적 지위 오기재, 소비자 분쟁처리 의무 누락, blanket disclaimer 무효.

**7. 권장 질문**

Q25~Q27.

**8. Status**

`LEGAL DECISION REQUIRED / READY FOR COUNSEL REVIEW`

---

# J. DELETION_RETENTION_AND_PROVIDER_LIFECYCLE

**1. 기술/사업 사실**

Deletion은 (A) 즉시 접근/authority/session revoke, (B) 법정보존, (C) 운영상 삭제대기, (D) Provider remote revoke/unlink, (E) final purge, (F) provider_subject 처리로 분리된다.

**2. Provider 요구**

Kakao는 service account deletion/unmapping에 Unlink를 요구하고 service user ID 파기를 강조한다. NAVER는 Token Revocation/연결끊기 callback을 문서화한다. Apple은 authorization revoke endpoint/lifecycle이 있으며 Sign in with Apple 계정삭제 lifecycle에 반영해야 한다.

**3. 후보문구**

`계정삭제 요청과 Social Login 연결해제, Provider authorization 해제, 최종 데이터 파기는 서로 다른 절차입니다. 회사는 Provider별 기술·정책상 필요한 연결해제 또는 authorization revoke 절차를 실제 구현에 맞춰 수행하고 그 처리방식을 개인정보처리방침에 공개합니다.`

**4. 기술 확정 가능**

현재 local revoke와 final purge 분리.

**5. 법률전문가 결정 필요**

Provider remote revoke의 법적/계약상 필수범위, 실패 시 재시도·삭제완료 표시, local deletion과 Provider deletion의 관계.

**6. 위험**

사용자는 탈퇴했으나 Provider authorization이 남음, 반대로 Provider 연결해제를 계정 전체삭제로 오인.

**7. 권장 질문**

Q28~Q29.

**8. Status**

`LEGAL DECISION REQUIRED + PROVIDER IMPLEMENTATION BLOCKED`

---

# K. SUSPENSION_NOTICE_AND_REMEDY

**1. 기술/사업 사실**

보안위험·부정사용·법령위반·시스템 공격·거래기능 조작 등에서 계정/기능 제한이 필요할 수 있다.

**2. 공식 요구**

약관규제법은 고객에게 부당하게 불리하거나 본질적 권리를 제한하는 불공정 약관의 효력을 제한한다. 중요한 약관내용은 이해 가능한 방식으로 명시·설명되어야 한다.

**3. Terms 후보문구**

`회사는 보안침해, 법령위반, 타인의 권리 침해 또는 서비스의 정상 운영에 중대한 위험이 있는 경우 필요한 범위에서 이용을 제한할 수 있습니다. 가능한 경우 사유·기간·해제방법을 사전에 알리고, 긴급한 보안조치가 필요한 경우 조치 후 지체 없이 안내하며 이의제기 절차를 제공합니다.`

**4. 기술 확정 가능**

긴급 security revoke 가능성.

**5. 법률전문가 결정 필요**

사전/사후 통지 기준, 이의제기 기간/채널, 영구정지 조건, Plus 환불/잔여 entitlement 처리.

**6. 위험**

회사의 무제한 재량으로 해석되는 일방조항.

**7. 권장 질문**

Q30.

**8. Status**

`LEGAL DECISION REQUIRED / READY FOR COUNSEL REVIEW`

---

# L. SERVICE_CHANGE_NOTICE_AND_LIABILITY

**1. 기술/사업 사실**

Provider/Merchant 장애, 유지보수, 보안사고, 정책/API 변경 등으로 특정 기능 변경·중단 가능성이 있다.

**2. 공식 요구**

약관규제법상 사업자의 모든 책임을 배제하거나 이용자 권리를 과도하게 제한하는 조항은 불공정할 수 있다.

**3. 후보문구**

`회사는 서비스의 중요한 변경·중단이 예정된 경우 합리적인 방법으로 사전에 알립니다. 긴급 보안사고·외부 Provider 장애 등 사전 통지가 어려운 경우 가능한 범위에서 사후 안내합니다. 서비스 변경·중단만으로 이미 성립한 거래상 의무나 법정 소비자권리가 자동 소멸하지 않습니다.`

**4. 기술 확정 가능**

외부 dependency 장애 가능성.

**5. 법률전문가 결정 필요**

공지기간, 유료서비스 종료 시 환불/대체조치, 면책 범위.

**6. 위험**

포괄면책/일방적 서비스폐지 조항.

**7. 권장 질문**

Q31.

**8. Status**

`LEGAL DECISION REQUIRED / READY FOR COUNSEL REVIEW`

---

# M. TERMS_CHANGE_NOTICE

**1. 기술/사업 사실**

Social Signup consent evidence는 document version/SHA-256/URI를 보존하도록 설계돼 있어 어떤 약관에 동의했는지 추적할 수 있다.

**2. 공식 요구**

약관 변경은 이용자가 확인할 수 있게 고지해야 하고, 불리하거나 중요한 변경은 관련 법과 변경내용에 맞는 별도 고지/동의 절차가 필요할 수 있다. 정기결제 가격 인상/무료→유료 전환은 전자상거래법의 별도 동의/고지 규칙을 확인해야 한다.

**3. 후보문구**

`회사가 약관을 변경하는 경우 적용일과 주요 변경내용을 이용자가 확인할 수 있는 방법으로 고지합니다. 이용자에게 중대한 불이익을 주거나 별도 동의가 필요한 변경은 관계 법령이 요구하는 고지·동의 절차를 따릅니다.`

**4. 기술 확정 가능**

versioned legal manifest/evidence.

**5. 법률전문가 결정 필요**

일반 변경과 불리한 변경의 고지기간, 재동의 필요범위, 기존 Plus 이용자 적용방법.

**6. 위험**

묵시동의만으로 중요 변경을 강제하거나 과거 동의증빙과 불일치.

**7. 권장 질문**

Q32.

**8. Status**

`LEGAL DECISION REQUIRED / READY FOR COUNSEL REVIEW`

---

# N. LIABILITY_DISPUTE_JURISDICTION

**1. 기술/사업 사실**

LOTBI는 자체 구독, Social Auth, 외부 Merchant 연결 등 복수 관계를 가진다.

**2. 공식 요구**

약관규제법은 사업자의 고의·중대한 과실 책임을 부당하게 배제하거나 고객에게 부당한 소송관할을 강제하는 조항 등을 제한한다.

**3. 후보문구**

`회사와 이용자 사이의 분쟁은 관계 법령과 소비자분쟁 해결절차에 따라 해결하며, 관할법원은 관계 법령이 정하는 바에 따릅니다.`

**4. 기술 확정 가능**

없음 — 법률조항 영역.

**5. 법률전문가 결정 필요**

손해배상/책임제한 허용범위, 소비자분쟁 절차, 준거법/관할 문구.

**6. 위험**

불공정·무효 조항.

**7. 권장 질문**

Q33.

**8. Status**

`LEGAL DECISION REQUIRED / READY FOR COUNSEL REVIEW`

---

# O. OPERATOR_DISCLOSURE_FIELDS

**1. 기술/사업 사실**

대표자·주소·사업자등록번호·통신판매업신고번호가 Site current main footer에 존재한다.

**2. 공식 요구**

전자상거래법은 통신판매업자에 해당하는 경우 상호, 대표자, 주소, 전화·이메일, 통신판매업 신고정보 등 일정 사업자정보를 광고/거래 단계에 표시하도록 한다.

**3. 후보표기**

- 유한회사 알에이디홀딩스
- 대표자 전선혜
- 전북특별자치도 전주시 덕진구 혁신로 542, 1동 1층 (여의동)
- 사업자등록번호 583-88-03679
- 통신판매업신고번호 2026-전주덕진-0798
- `developer@lotbiai.com`
- `063-237-0930`

**4. 기술 확정 가능**

위 current Site fields.

**5. 법률전문가 결정 필요**

Privacy/Terms/결제화면/거래화면 중 각 필드의 필수 표시위치, additional e-commerce fields.

**6. 위험**

필수 사업자정보 누락 또는 법률문서와 실제 사업자정보 불일치.

**7. 권장 질문**

Q34.

**8. Status**

`TECHNICAL FACT CONFIRMED / LEGAL DISPLAY REVIEW REQUIRED`

---

# P. FINAL_DOCUMENT_EFFECTIVE_DATES

**1. 기술/사업 사실**

현재 공개 Privacy/Terms는 2026-09-14 사전 공개 버전이다. 새 Production 후보는 아직 publish 금지다. Social Signup manifest는 최종 document version/SHA-256/HTTPS URI가 확정되어야 한다.

**2. 공식 요구**

Privacy/Terms 변경은 적용일과 변경내용을 적절히 고지해야 한다. Social Signup에서는 사용자에게 실제 표시된 최종 법률문서와 Core manifest의 version/hash/URI가 동일해야 한다.

**3. 후보 운영규칙**

- 최종 법률검토 승인일과 실제 공개일을 확정
- 시행일은 counsel 승인에 따라 공개일과 같거나 적법한 사전고지 기간 이후로 설정
- version: `LOTBI_PRIVACY_<YYYY-MM-DD>_R<n>`, `LOTBI_TERMS_<YYYY-MM-DD>_R<n>`
- exact final HTML bytes에서 SHA-256 산출
- 동일 bytes 배포 후 live response 검증

**4. 기술 확정 가능**

version/hash/URI mechanism.

**5. 법률전문가 결정 필요**

시행일, 사전고지 필요기간, 기존 이용자 재동의/통지 범위.

**6. 위험**

문서 시행일과 consent evidence 불일치, 초안 hash를 Production hash로 사용.

**7. 권장 질문**

Q35~Q36.

**8. Status**

`TECHNICAL MECHANISM CONFIRMED / LEGAL DECISION REQUIRED / READY FOR COUNSEL REVIEW`

---

# Q. Provider / Infrastructure legal-classification worksheet

| Party | Current technical evidence | Legal classification now | Counsel/architecture action |
|---|---|---|---|
| Google | OIDC `openid`, `sub` only under reviewed Social contract | `PENDING` | actual Production client/data path + Google terms against Korean PIPA |
| Kakao | OIDC `openid`, `sub`; Kakao unlink lifecycle required | `PENDING` | third-party/outsourcing/transfer classification + deletion wording |
| NAVER | `openid`, profile endpoint `response.id` | `PENDING` | profile API data path + revocation callback classification |
| Apple | `sub`; email/name unused; revoke lifecycle blocked | `PENDING` | Apple authorization/revocation data path and overseas processing |
| Render | repo contains Singapore-region pilot blueprint; not proof of Production | `PENDING` | confirm Production vendor, region, DPA, DB/log storage/subprocessors |
| Vercel | Account Web technology context; exact Production data residency/plan not established in this package | `PENDING` | confirm plan, region/logs, DPA/subprocessors |
| GitHub | source/CI system; no evidence here that normal LOTBI end-user data is intentionally stored in repo | `PENDING` | verify Actions/log/artifact exposure and prohibit secrets/PII where unnecessary |
| OpenAI | LOTBI AI provider candidate/architecture; exact Production payload not established here | `PENDING` | document payload categories, account/DPA, retention/residency, subprocessors |
| Toss Payments | planned Web subscription/payment channel | `PENDING` | merchant/PG contract, billing/refund data fields, retention, outsourcing/provision classification |
| Apple App Store | iPhone subscription channel | `PENDING` | receipt/transaction identifier data, refund/notification flow |
| Google Play | Android subscription channel | `PENDING` | purchase token/order identifier, RTDN/refund lifecycle |

No row above is a final Korean-law classification merely because the vendor/service is used.

---

# R. Counsel completion gate

This package is complete for **submission to counsel**, not for Production.

- `PRODUCTION PRIVACY CANDIDATE = COUNSEL-READY`
- `PRODUCTION TERMS CANDIDATE = COUNSEL-READY`
- `LEGAL QUESTIONNAIRE = READY`
- `LEGAL DECISION MATRIX = READY`
- `CROSS-REPO IMPLEMENTATION HANDOFF = READY`
- `LEGAL REVIEW COMPLETE = NO`
- `PRODUCTION PUBLISH = NONE`
- `USER_ACTION_REQUIRED — GOOGLE STEP 1 = NOT YET`
