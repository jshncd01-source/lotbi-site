# LOTBI 이용약관 — Production Counsel-Ready Candidate

> 상태: `COUNSEL-READY / LEGAL_REVIEW_REQUIRED / DO NOT PUBLISH`
>
> 작성 기준일: 2026-09-17 (Asia/Seoul)
>
> Core Social review: `b555420b8d75c9e241a6cd9bd534f205499a87d8`
>
> Account Social review: `5eadea164d559a4f3c45dfca18d6c2acf95a40c0`
>
> FREE authoritative policy: `docs/free-monthly-3-task-product-policy.md`
>
> Legal package: `docs/production-legal-review-package.md`

## 검토 표시

- `[TECHNICALLY VERIFIED]`: 현재 LOTBI 코드/제품/공개사이트 사실
- `[LEGAL REVIEW REQUIRED]`: 법률전문가 최종 판단·문구 필요
- `[USER DECISION REQUIRED]`: 제품/운영 의사결정 필요
- `[PLACEHOLDER — DO NOT PUBLISH]`: Production 공개 전 확정 필요

이 문서는 법률전문가 검토용 후보이며 승인된 이용약관이 아니다.

---

# LOTBI 이용약관

**시행일: [PLACEHOLDER — DO NOT PUBLISH / LEGAL REVIEW REQUIRED — FINAL_DOCUMENT_EFFECTIVE_DATES]**

## 제1조 목적

이 약관은 유한회사 알에이디홀딩스(이하 “회사”)가 제공하는 LOTBI(롯비) 서비스의 계정, 인증, FREE 이용, 유료구독, 외부 서비스 연결 및 이용에 관한 회사와 이용자의 기본 권리·의무를 정하는 것을 목적으로 합니다.

LOTBI 자체 구독서비스와 외부 판매자·예약처·서비스 제공자와의 거래는 서로 구분합니다.

## 제2조 회사 및 서비스 정보 — [TECHNICALLY VERIFIED]

- 회사명: 유한회사 알에이디홀딩스
- 대표자: 전선혜
- 주소: 전북특별자치도 전주시 덕진구 혁신로 542, 1동 1층 (여의동)
- 사업자등록번호: 583-88-03679
- 통신판매업신고번호: 2026-전주덕진-0798
- 서비스명: LOTBI(롯비)
- 이메일: `developer@lotbiai.com`
- 대표전화: `063-237-0930`

`[LEGAL REVIEW REQUIRED — OPERATOR_DISCLOSURE_FIELDS]` 위 정보를 Privacy/Terms/구독 checkout/외부 Merchant 거래화면 중 어디에 필수 표시해야 하는지 추가 검토합니다.

## 제3조 LOTBI 계정

### 1. 계정 생성 — [TECHNICALLY VERIFIED]

Social Signup에서 Provider 인증 성공만으로 LOTBI 가입이 완료되지 않습니다. 이용자는 별도로:

- LOTBI에서 사용할 이름
- LOTBI account handle
- LOTBI 이용약관 필수 동의
- LOTBI 개인정보처리방침 필수 동의

를 완료해야 합니다.

Core는 `TERMS_OF_SERVICE`와 `PRIVACY_POLICY` 두 문서의 server-owned version/SHA-256/HTTPS URI와 사용자의 `ACCEPTED` evidence가 정확히 일치해야 account provisioning을 진행합니다.

### 2. 계약 성립시점

`[LEGAL REVIEW REQUIRED — CONTRACT_FORMATION_TIME]`

현재 기술순서는 Provider verification → name/handle + 필수동의 → account provisioning/ENROLLMENT → first Passkey enrollment → FULL입니다.

**검토 후보문구:**

`이용계약은 이용자가 회사가 정한 가입정보와 필수 동의를 제출하고 회사가 계정 생성을 승인한 때 성립합니다. Passkey 등 추가 보안절차는 계정의 안전한 이용을 위한 후속 요건으로 운영할 수 있습니다.`

법률전문가는 account provisioning과 Passkey enrollment 중 어느 시점을 최종 가입/계약 성립점으로 둘지 확정해야 합니다.

### 3. Provider 이메일 자동병합 금지 — [TECHNICALLY VERIFIED]

Google/Kakao/NAVER/Apple 이메일이 같다는 이유만으로 신규 LOTBI 계정을 기존 계정과 자동병합하지 않습니다. Canonical external identity는 Provider + stable subject/identifier를 기준으로 관리합니다.

## 제4조 Passkey 및 계정보안

### [TECHNICALLY VERIFIED]

LOTBI는 Passkey 등 공개키 기반 인증과 session/authority lifecycle을 사용하여 계정을 보호할 수 있습니다. Social Login만으로 FULL assurance를 부여하지 않고 현재 reviewed 로그인 계약에 따라 Passkey step-up을 요구할 수 있습니다.

이용자는 자신의 기기와 인증수단을 안전하게 관리해야 합니다.

회사 서버가 Passkey 개인키 또는 이용자의 기기 생체정보 자체를 저장한다고 설명하지 않습니다.

## 제5조 Social Login

### 1. 외부 인증서비스 — [TECHNICALLY VERIFIED]

LOTBI는 이용자 선택에 따라 Google, Kakao, NAVER 또는 Apple 인증을 회원가입·로그인·계정연결에 사용할 수 있습니다.

현재 minimum identity contract:

- Google: `openid` → `sub`
- Kakao: `openid` → `sub`
- NAVER: `openid` → `response.id`
- Apple: `sub`; email/name scope 미사용

Provider 장애·정책변경·계정상태에 따라 특정 로그인수단이 제한될 수 있습니다.

### 2. 외부 계정 연결(LINK) — [TECHNICALLY VERIFIED]

LINK는 신규 Signup과 별개이며 reviewed contract는 기존 FULL LOTBI session과 fresh proof를 요구합니다.

### 3. 외부 계정 연결해제(UNLINK)

현재 generic unlink는 LOTBI 계정을 유지하면서 해당 external identity의 local 상태를 `REVOKED`로 전환합니다. Provider 계정 자체 삭제와 동일하지 않습니다.

`[LEGAL REVIEW REQUIRED + PROVIDER IMPLEMENTATION REQUIRED — DELETION_RETENTION_AND_PROVIDER_LIFECYCLE]`

- Kakao: remote Unlink + user-id deletion/purge policy blocker
- NAVER: token revocation/disconnect blocker
- Apple: authorization revocation lifecycle blocker
- Google: real scope/E2E와 Production lifecycle verification pending

## 제6조 회원탈퇴 및 계정삭제

### [TECHNICALLY VERIFIED]

이용자는 LOTBI Account Web 공식 절차를 통해 account deletion을 요청할 수 있습니다.

요청 시 즉시 모든 데이터가 hard delete된다고 약속하지 않습니다. 먼저:

- 계정 접근 차단
- 활성 session revoke
- authority/grant revoke
- external identity local revoke
- 관련 auth flow 정리
- deletion lifecycle 시작

후 final purge로 진행합니다.

`[LEGAL REVIEW REQUIRED — PRODUCTION_PURGE_PERIOD / STATUTORY_RETENTION_ITEMS_AND_PERIODS / PROVIDER_SUBJECT_RETENTION_BASIS_AND_PERIOD]`

법정보존기록, 일반 계정정보 purge, provider_subject, backup/log, Provider remote revoke를 구분해 최종 문구를 확정합니다.

## 제7조 FREE 이용한도 — [AUTHORITATIVE PRODUCT POLICY]

LOTBI FREE 이용자는 **매월 3개의 성공 작업**을 이용할 수 있습니다.

`3개 작업`은 메시지 3개, 질문 3번, AI Provider 호출 3번을 뜻하지 않습니다.

### 1. 차감

하나의 사용자 목적을 수행하여 실제 사용할 수 있는 최종 사용자 결과가 성공적으로 전달된 authoritative final-success 상태에서만 1개 작업을 차감합니다.

요청 접수, 내부처리 시작, Provider 호출, 중간결과 생성만으로 차감하지 않습니다.

### 2. 동일 작업의 확인대화

조건·지역·예산·인원·날짜·옵션 확인 및 같은 task 내부 보완대화는 별도 작업으로 차감하지 않습니다.

완료 후 명백히 독립적인 새 목적을 요청하면 새 작업으로 계산할 수 있습니다. 애매한 경계를 사용자를 불리하게 하기 위해 과도하게 분할하지 않습니다.

### 3. LOCAL / 실패 / 취소 / retry

- LOCAL deterministic: FREE usage 0 / AI Provider call 0 / external effect NONE
- 최종 성공결과 미전달: 차감 0
- server/AI/network/auth/payment failure: 차감 0
- 완료 전 취소·중단: 차감 0
- 같은 task/usage idempotency boundary의 retry/duplicate/reconciliation: 동일 성공작업 최대 1회 차감

### 4. reset / carry-over

- 매월 1일 00:00 `Asia/Seoul` / KST reset
- 가입일 기준 rolling month 사용 안 함
- 미사용 allowance 이월 없음

### 5. compensation

잘못된 차감 또는 서비스장애 보상은 기존 usage event를 삭제/수정하지 않고 별도 auditable compensation/credit adjustment로 처리하는 정책을 사용합니다.

제품정책은 CLOSED이나 실제 Core usage ledger/enforcement 구현완료는 별도 기술검증 대상입니다.

## 제8조 LOTBI Plus

### 1. 확정 제품사실 — [PRODUCT VERIFIED]

- 상품명: LOTBI Plus
- 월 구독료: 9,900원
- Web 구독: Toss Payments
- iPhone/iOS: Apple App Store subscription
- Android: Google Play subscription

LOTBI Plus를 `무제한 일반 AI 사용권` 또는 ChatGPT 대체 무제한권으로 설명하지 않습니다.

### 2. 자동갱신·다음 결제일

`[LEGAL REVIEW REQUIRED — LOTBI_PLUS_SUBSCRIPTION_TERMS]`

**후보구조:** 이용자가 결제 전에 자동갱신 여부, 결제주기, 가격, 다음 결제 예정일/조건 및 해지방법을 확인할 수 있도록 합니다.

Web/iPhone/Android별 실제 checkout UI와 Store/PG 정책에 맞춘 최종문구가 필요합니다.

### 3. 해지 신청과 효력

`[USER DECISION REQUIRED + LEGAL REVIEW REQUIRED — LOTBI_PLUS_CANCELLATION_EFFECT]`

해지 즉시 entitlement 종료인지 현재 결제기간 말 종료인지 채널별 정책을 확정하지 않았습니다. Store 정책과 소비자법을 검토한 뒤 정합니다.

### 4. 결제실패 / grace period

`[USER DECISION REQUIRED + LEGAL REVIEW REQUIRED — LOTBI_PLUS_PAYMENT_FAILURE_GRACE]`

Apple/Google/Toss 각 channel에서 retry/grace 상태 중 서비스권한을 어떻게 유지/제한할지 확정하지 않았습니다.

### 5. 환불·청약철회·디지털 서비스 제공개시

`[LEGAL REVIEW REQUIRED]`

다음을 counsel이 최종화합니다.

- Web Toss 환불/청약철회
- 부분사용·미사용 처리
- 디지털 서비스 제공개시 후 청약철회 제한 적용조건
- Apple App Store 환불과 LOTBI entitlement
- Google Play 환불/revoke와 entitlement
- store/PG refund event가 지연·중복되는 경우 reconciliation

법률검토 전 `환불 불가`, `해지 즉시 모든 권리 종료` 같은 포괄문구를 사용하지 않습니다.

### 6. 가격변경 / FREE→유료

`[LEGAL REVIEW REQUIRED]`

정기결제 가격 인상 또는 FREE→유료 전환 시 전자상거래법과 각 Store 규칙에 필요한 사전고지·동의절차를 최종확정합니다.

## 제9조 LOTBI Plus 구독료와 외부 Merchant 거래대금의 분리 — [PRODUCT/ARCHITECTURE VERIFIED]

LOTBI Plus 구독료는 LOTBI 자체 유료서비스 대가입니다.

외부 판매처·예약처·여행·지역서비스의 상품/서비스 거래대금은 실제 Merchant/payment 구조와 연결되는 별도 거래입니다.

Transaction Kernel이 approval scope 확인, 재검증, idempotency, UNKNOWN recovery, reconciliation을 수행한다는 이유만으로 LOTBI가 모든 외부 Merchant 거래의 판매자 또는 거래대금 수취·정산 주체가 되는 것은 아닙니다.

## 제10조 외부 Merchant 거래에서 LOTBI의 역할

`[LEGAL REVIEW REQUIRED — COMMERCE_ROLE_AND_RESPONSIBILITY]`

실제 flow별로 LOTBI가 판매자, 통신판매중개자, 구매/예약 실행보조자, 대행자 또는 다른 지위인지 확정해야 합니다.

**후보문구:**

`외부 거래에서 판매자·서비스 제공자, 거래조건, 결제·배송·취소·환불 주체와 LOTBI의 역할은 해당 거래화면과 관계 법령에 따라 별도로 안내합니다.`

`LOTBI는 중개자이므로 어떠한 책임도 지지 않습니다`와 같은 포괄면책은 사용하지 않습니다.

## 제11조 미성년자

`[USER DECISION REQUIRED + LEGAL REVIEW REQUIRED — MINOR_POLICY]`

현재 signup에 만14세 미만 age gate가 구현됐다고 표시하지 않습니다.

v1 단순후보는 만14세 미만 회원가입 제한입니다. 법률검토 후 채택 여부와 age gate를 확정합니다.

만14세 이상 미성년자의 Plus/외부거래 법정대리인 관련 고지도 별도 검토합니다.

## 제12조 서비스 이용 제한

`[LEGAL REVIEW REQUIRED — SUSPENSION_NOTICE_AND_REMEDY]`

**후보문구:**

`회사는 계정탈취, 인증우회, 부정거래, 법령위반, 타인의 권리침해 또는 서비스에 중대한 보안·운영 위험이 있는 경우 필요한 범위에서 이용을 제한할 수 있습니다. 가능한 경우 사유·기간·해제방법을 사전에 알리고, 긴급조치가 필요한 경우 조치 후 가능한 한 신속하게 안내하며 이용자가 이의를 제기할 수 있는 절차를 제공합니다.`

영구정지, 통지기간, 이의절차, Plus 잔여 entitlement는 counsel 검토가 필요합니다.

## 제13조 서비스 변경·중단·종료

`[LEGAL REVIEW REQUIRED — SERVICE_CHANGE_NOTICE_AND_LIABILITY]`

**후보문구:**

`회사는 중요한 서비스 변경·중단이 예정된 경우 합리적인 방법으로 사전에 알립니다. 긴급 보안사고나 외부 Provider/Merchant 장애 등 사전 통지가 어려운 경우 가능한 범위에서 사후 안내합니다. 변경·중단만으로 이미 성립한 거래상 의무나 법정 소비자권리가 자동 소멸하지 않습니다.`

유료서비스 종료시 보상/환불 및 면책범위를 확정해야 합니다.

## 제14조 개인정보 보호

개인정보 처리에 관한 사항은 LOTBI 개인정보처리방침을 따릅니다. Social Login Provider 또는 Merchant/결제사업자가 독립적으로 제공하는 서비스에는 해당 사업자의 정책이 적용될 수 있습니다.

## 제15조 약관의 변경

`[LEGAL REVIEW REQUIRED — TERMS_CHANGE_NOTICE]`

**후보문구:**

`회사가 약관을 변경하는 경우 적용일과 주요 변경내용을 이용자가 확인할 수 있는 방법으로 고지합니다. 이용자에게 중대한 불이익을 주거나 관계 법령상 별도 동의가 필요한 변경은 필요한 고지·동의 절차를 따릅니다.`

일반변경/불리한 변경의 고지기간, 재동의, 기존 Plus 이용자 적용을 확정합니다.

## 제16조 책임 및 분쟁

`[LEGAL REVIEW REQUIRED — LIABILITY_DISPUTE_JURISDICTION]`

**후보문구:**

`회사와 이용자 사이의 분쟁은 관계 법령과 소비자분쟁 해결절차에 따라 해결하며 관할법원은 관계 법령이 정하는 바에 따릅니다.`

고의·중과실, Provider/Merchant dependency, 손해배상 한도 등은 이용자 법정권리를 부당하게 제한하지 않도록 counsel이 최종 검토합니다.

## 제17조 문의

- 유한회사 알에이디홀딩스
- `developer@lotbiai.com`
- `063-237-0930`

## 제18조 Publication gate

이 후보는 counsel에게 전달 가능한 상태이지만 다음이 완료되기 전 Production에 공개하지 않습니다.

- `docs/production-legal-review-decisions.md`의 필요한 Q가 승인상태로 닫힘
- minor/CPO/Plus cancellation/grace/Provider unlink 등 사용자 결정 완료
- merchant role, statutory retention, purge, subject retention 확정
- final wording 반영
- 시행일/document version 확정
- exact final `terms.html` bytes SHA-256 산출
- 사용자 명시적 Production publish 승인

현재:

`PRODUCTION TERMS CANDIDATE = COUNSEL-READY`

`PRODUCTION PUBLISH = NONE`
