# LOTBI 이용약관 — Production 최종 후보

> 상태: `TECHNICAL CANDIDATE READY / LEGAL_REVIEW_REQUIRED / DO NOT PUBLISH`
>
> 작성 기준일: 2026-09-17 (Asia/Seoul)
>
> 적용 코드 기준:
> - Core Social review: `b555420b8d75c9e241a6cd9bd534f205499a87d8`
> - Account Social review: `5eadea164d559a4f3c45dfca18d6c2acf95a40c0`
>
> 이 문서는 `https://lotbiai.com/terms.html` 교체 후보문이다. 현재 확정된 제품·인증 계약만 본문에 반영하고, 구독 환불·청약철회·책임제한 등 법률 판단이 필요한 부분은 `LEGAL_REVIEW_REQUIRED`로 남긴다.

---

# LOTBI 이용약관

시행일: **[LEGAL_REVIEW_REQUIRED — 최종 공개일 확정 후 기재]**

## 제1조 목적

이 약관은 유한회사 알에이디홀딩스(이하 “회사”)가 제공하는 LOTBI(롯비) 서비스의 계정, 인증, 기본 이용, 유료 구독 및 서비스 이용에 관한 회사와 이용자의 권리·의무 및 기본 이용조건을 정하는 것을 목적으로 합니다.

LOTBI가 외부 판매처, 예약처, 결제사업자 또는 기타 제3자 서비스와 연결되는 경우 해당 외부 거래와 LOTBI 자체 계정·구독 서비스의 법률관계는 구분합니다.

## 제2조 LOTBI 계정

### 1. 계정 생성

LOTBI 계정은 회사의 계정 생성 절차를 완료한 이용자에게 제공됩니다.

Social Signup을 사용하는 경우 Provider 인증 성공만으로 LOTBI 계정 가입이 완료되지 않습니다. 이용자는 별도로:

- LOTBI에서 사용할 이름
- LOTBI 계정 아이디(handle)
- LOTBI 이용약관 필수 동의
- LOTBI 개인정보처리방침 필수 동의

절차를 완료해야 합니다.

Social Signup 계정이 생성된 뒤 현재 보안 계약에 따라 최초 Passkey 등록 절차가 이어질 수 있습니다.

**LEGAL_REVIEW_REQUIRED — CONTRACT_FORMATION_TIME**

약관 동의, 계정 생성 응답, Passkey 등록 중 어느 시점을 최종 계약 성립/가입 완료 시점으로 볼지 법률문구는 실제 UI·Core 상태전이와 함께 최종 검토합니다.

### 2. 계정 아이디 및 이름

LOTBI account handle은 서비스의 Consumer Username Policy에 따라 생성·검증됩니다.

이용자는 타인의 권리를 침해하거나 서비스 보안·운영을 방해하는 방식으로 계정정보를 사용해서는 안 됩니다.

### 3. Provider 이메일 자동 병합 금지

LOTBI는 Google, Kakao, NAVER, Apple 등 외부 Provider에서 확인되는 이메일이 동일하다는 이유만으로 기존 LOTBI 계정과 신규 계정을 자동 병합하지 않습니다.

Canonical external identity는 Provider와 해당 Provider의 안정적인 이용자 식별자 조합을 기준으로 관리합니다.

## 제3조 Passkey 및 계정 보안

LOTBI는 계정 보호를 위해 Passkey 등 공개키 기반 인증방식을 사용할 수 있습니다.

이용자는 자신의 기기, Passkey, 복구수단 및 계정 접근수단을 안전하게 관리해야 하며, 타인에게 인증수단을 고의로 제공하거나 계정 탈취·우회에 이용해서는 안 됩니다.

Social Login을 통해 로그인한 세션은 현재 LOTBI 보안계약상 제한된 인증수준에서 시작하고, 중요 기능 이용 시 Passkey 등을 통한 추가 확인을 요구할 수 있습니다.

회사는 계정 탈취 또는 보안위험이 합리적으로 의심되는 경우 세션이나 인증수단을 제한·폐기하고 추가 본인확인을 요구할 수 있습니다.

## 제4조 Social Login

### 1. 외부 인증서비스의 이용

LOTBI는 이용자의 선택에 따라 Google, Kakao, NAVER 또는 Apple 인증을 회원가입·로그인·계정 연결 수단으로 사용할 수 있습니다.

Provider의 계정 생성·유지·정지·삭제 및 Provider 자체 정책은 해당 Provider가 관리합니다.

Provider 서비스 장애, 정책변경 또는 이용자 Provider 계정 상태에 따라 특정 Social Login 방식이 일시적으로 제한될 수 있습니다.

### 2. LOTBI 자체 동의

Provider OAuth/OIDC 동의 또는 Provider 계정 보유만으로 LOTBI의 이용약관·개인정보처리방침 동의를 대체하지 않습니다.

신규 Social Signup은 LOTBI가 제시하는 `TERMS_OF_SERVICE`와 `PRIVACY_POLICY` 두 문서에 각각 필수 동의를 해야 가입을 진행할 수 있습니다.

### 3. 외부 계정 연결

기존 LOTBI 계정에 새로운 Provider identity를 추가하는 LINK는 신규 Signup과 별개의 기능입니다.

현재 reviewed 계약은 기존 LOTBI 계정의 FULL 인증상태와 fresh Passkey/provider proof를 요구합니다.

### 4. 외부 계정 연결 해제

Social Login 연결 해제는 LOTBI 회원탈퇴와 다릅니다.

현재 generic unlink는:

- LOTBI 계정은 유지하고
- 선택한 external identity의 LOTBI 로컬 연결을 `REVOKED` 처리하고
- 관련 제한 세션 및 미완료 인증 flow를 정리하며
- Provider 계정 자체를 삭제하지 않습니다.

Provider 측 authorization 해제는 Provider별 별도 lifecycle입니다.

현재 Production readiness 상태:

- Kakao: `KAKAO_PROVIDER_LIFECYCLE_BLOCKER`
- NAVER: `NAVER_PROVIDER_LIFECYCLE_BLOCKER`
- Apple SIGNUP/LINK: `APPLE_SOCIAL_AUTH_LIFECYCLE_BLOCKER`
- Google minimum live scope: `GOOGLE_SCOPE_CONTRACT_VERIFY`

해당 blocker가 닫히지 않은 기능을 이용 가능한 Production 기능으로 표시하지 않습니다.

## 제5조 계정 삭제 및 회원탈퇴

이용자는 LOTBI가 제공하는 공식 Account Web 절차를 통해 계정 삭제를 요청할 수 있습니다.

계정 삭제 요청이 접수되면 현재 LOTBI 계약은 즉시 모든 데이터가 hard delete된다고 약속하지 않습니다. 먼저:

- 계정 접근 차단
- 활성 session revoke
- 활성 권한/authority revoke
- external identity local revoke
- 관련 인증 flow 정리
- deletion lifecycle 시작

을 수행하고, 이후 별도 final purge 절차를 진행합니다.

법령 또는 보안상 보존이 필요한 기록은 해당 근거가 있는 범위에서 별도 처리될 수 있습니다.

Provider authorization revoke는 Provider별 lifecycle과 구분합니다.

**LEGAL_REVIEW_REQUIRED — DELETION_RETENTION_AND_PROVIDER_LIFECYCLE**

최종 purge 기간, 법정 보존기록, revoked `provider_subject` 처리, Provider별 remote revoke/unlink 의무를 개인정보처리방침과 일치시켜 최종 확정합니다.

## 제6조 FREE 이용한도

LOTBI FREE 이용자는 현재 제품정책상 **월 3개 작업**을 이용할 수 있습니다.

**PRODUCT_POLICY_CONFIRMATION_REQUIRED — FREE_TASK_DEFINITION_AND_RESET**

Production 약관·요금제 화면을 확정하기 전에 다음 운영정의를 하나로 맞춰야 합니다.

- “작업” 1건의 산정 기준
- 월 이용한도의 초기화 기준일/시간대
- 실패·취소·중단 작업의 차감 여부
- 프로모션 또는 보상 작업의 처리

본 후보는 확정되지 않은 산정규칙을 임의로 만들지 않습니다.

## 제7조 LOTBI Plus

### 1. 요금제

현재 확정된 제품 기준:

- 서비스명: `LOTBI Plus`
- 월 구독료: `9,900원`

세금 포함 여부 및 실제 결제화면 표시형식은 판매채널·법률검토·결제계약에 맞춰 Production UI와 동일하게 확정합니다.

### 2. 판매 및 결제 경로

현재 계획된 판매경로는 다음과 같습니다.

- Web: Toss Payments 기반 LOTBI 웹 구독
- iPhone/iOS: Apple App Store subscription
- Android: Google Play subscription

현재 Web V1 결제수단 계획:

- 신용/체크카드
- 계좌 기반 자동결제
- TossPay 정기결제

V2 후보:

- KakaoPay 정기구독
- Apple Pay 정기구독

V2 후보는 실제 제공 전까지 이용 가능 결제수단으로 약관에 확정 고지하지 않습니다.

### 3. 자동갱신·해지·환불 등

다음 항목은 실제 판매채널과 관계법령 검토 전 임의로 확정하지 않습니다.

**LEGAL_REVIEW_REQUIRED — LOTBI_PLUS_SUBSCRIPTION_TERMS**

- 자동갱신 고지의 최종 표현과 시점
- 구독해지 효력 발생시점
- 부분사용·미사용분 환불기준
- 청약철회 가능 범위와 제한
- 디지털 서비스가 이미 제공된 경우의 처리
- 가격 인상 또는 무료→유료 전환 시 동의·고지
- App Store/Google Play의 환불 결정과 LOTBI entitlement 상태의 관계
- Web 결제 취소/환불과 entitlement 회수·복구

회사는 법률검토가 끝나기 전 “환불 불가”, “언제든 즉시 환불”, “해지 즉시 모든 권리 종료”와 같은 포괄 문구를 사용하지 않습니다.

## 제8조 LOTBI 구독료와 외부 Merchant 거래대금의 구분

LOTBI Plus 등 LOTBI 자체 유료서비스에 대한 구독료와, 이용자가 외부 판매처·예약처·서비스 제공자에게 지급하는 상품·예약·여행·지역서비스 등의 거래대금은 구분됩니다.

LOTBI의 Transaction Kernel이 승인범위 확인, 재검증, idempotency, UNKNOWN recovery 등 거래 실행 안전장치를 제공한다는 이유만으로 LOTBI가 모든 외부 Merchant 거래의 판매자 또는 거래대금 수취·정산 주체가 되는 것은 아닙니다.

외부 Merchant 거래에서는 실제 판매자·서비스 제공자·결제사업자의 조건이 별도로 적용될 수 있습니다.

**LEGAL_REVIEW_REQUIRED — COMMERCE_ROLE_AND_RESPONSIBILITY**

LOTBI가 개별 거래에서 통신판매업자, 통신판매중개자, 예약/구매 실행보조자 또는 다른 법적 지위 중 무엇에 해당하는지는 실제 Production 거래흐름과 계약구조를 기준으로 최종 고지해야 합니다.

## 제9조 서비스 이용 제한

회사는 다음과 같이 서비스의 안전·법령준수·타 이용자 보호를 위해 합리적으로 필요한 경우 서비스 또는 특정 기능의 이용을 제한할 수 있습니다.

- 계정 탈취·인증 우회 또는 부정접근이 의심되는 경우
- 시스템·서비스·Merchant/Provider API에 비정상적 부하나 공격을 가하는 경우
- 타인의 권리 또는 관계 법령을 침해하는 방식으로 서비스를 이용하는 경우
- 결제·거래·환불·인증 기능을 부정하게 이용하거나 반복적으로 조작하는 경우
- 이용자의 요청에 따라 계정 삭제 lifecycle이 시작된 경우

**LEGAL_REVIEW_REQUIRED — SUSPENSION_NOTICE_AND_REMEDY**

제한 사유, 사전/사후 통지, 이의절차, 긴급 보안조치 예외의 최종 법률문구를 검토합니다.

## 제10조 서비스의 변경·중단

회사는 유지보수, 보안사고 대응, Provider/Merchant 장애, 법령·정책 변경 또는 불가피한 기술적 사유 등으로 서비스의 일부를 변경하거나 일시 중단할 수 있습니다.

Provider 또는 Merchant의 외부 서비스 중단이 발생하더라도 이미 성립한 거래상 의무나 법정 소비자 권리가 자동으로 소멸한다고 해석하지 않습니다.

**LEGAL_REVIEW_REQUIRED — SERVICE_CHANGE_NOTICE_AND_LIABILITY**

중요한 서비스 변경·중단·종료의 통지시점과 회사 책임범위를 최종 검토합니다.

## 제11조 금지행위

이용자는 다음 행위를 해서는 안 됩니다.

- 타인의 계정·인증정보를 무단 사용하거나 탈취하는 행위
- 서비스의 보안장치, 승인범위 또는 거래검증 절차를 우회하는 행위
- 허위·기망·자동화 공격 등으로 서비스 또는 외부 연동시스템에 피해를 주는 행위
- 타인의 권리 또는 관계 법령을 침해하는 행위
- 서비스의 정상 운영을 방해하는 행위

## 제12조 개인정보 보호

개인정보 처리에 관한 사항은 LOTBI 개인정보처리방침을 따릅니다.

Social Login Provider가 별도로 제공하는 인증서비스에는 해당 Provider의 약관·개인정보정책이 적용될 수 있습니다.

## 제13조 약관의 변경

회사가 이 약관을 변경하는 경우 관계 법령에 따라 적용일과 변경내용을 이용자가 확인할 수 있는 방법으로 고지합니다.

이용자에게 불리하거나 중요한 변경의 고지기간·동의 필요 여부는 변경내용과 관계 법령에 따라 처리합니다.

**LEGAL_REVIEW_REQUIRED — TERMS_CHANGE_NOTICE**

최종 고지기간·효력발생 및 기존 유료구독자 적용방법을 법률검토합니다.

## 제14조 책임 및 분쟁

서비스의 특성, LOTBI 자체 서비스와 Provider/Merchant 서비스의 책임범위, 손해배상, 소비자분쟁, 준거법 및 관할은 실제 Production 사업구조와 관계 법령을 기준으로 정해야 합니다.

**LEGAL_REVIEW_REQUIRED — LIABILITY_DISPUTE_JURISDICTION**

법률검토 전 포괄면책, 손해배상 한도, 전속관할 또는 이용자의 법정 권리를 제한하는 조항을 임의로 삽입하지 않습니다.

## 제15조 문의

현재 LOTBI 공식 문의 채널:

- 이메일: `developer@lotbiai.com`
- 대표전화: `063-237-0930`
- 운영회사: 유한회사 알에이디홀딩스

**LEGAL_REVIEW_REQUIRED — OPERATOR_DISCLOSURE_FIELDS**

Production 유료서비스/통신판매 구조에 따라 사업자등록정보, 대표자, 사업장 주소, 통신판매 신고정보 등 추가 고지항목의 위치와 표현을 최종 확인합니다.

---

## Publication gate

이 후보문은 다음이 닫힌 후에만 `terms.html` Production 후보로 승격할 수 있습니다.

1. `LEGAL_REVIEW_REQUIRED — CONTRACT_FORMATION_TIME`
2. `PRODUCT_POLICY_CONFIRMATION_REQUIRED — FREE_TASK_DEFINITION_AND_RESET`
3. `LEGAL_REVIEW_REQUIRED — LOTBI_PLUS_SUBSCRIPTION_TERMS`
4. `LEGAL_REVIEW_REQUIRED — COMMERCE_ROLE_AND_RESPONSIBILITY`
5. `LEGAL_REVIEW_REQUIRED — DELETION_RETENTION_AND_PROVIDER_LIFECYCLE`
6. `LEGAL_REVIEW_REQUIRED — SUSPENSION_NOTICE_AND_REMEDY`
7. `LEGAL_REVIEW_REQUIRED — SERVICE_CHANGE_NOTICE_AND_LIABILITY`
8. `LEGAL_REVIEW_REQUIRED — TERMS_CHANGE_NOTICE`
9. `LEGAL_REVIEW_REQUIRED — LIABILITY_DISPUTE_JURISDICTION`
10. `LEGAL_REVIEW_REQUIRED — OPERATOR_DISCLOSURE_FIELDS`
11. 최종 시행일·document version 확정
12. 정확한 배포 HTML SHA-256 산출

그 전에는 `DO NOT PUBLISH`.