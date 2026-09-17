# LOTBI 이용약관 — Production User-Approval Candidate

> 상태: `TECHNICALLY / POLICY READY FOR USER APPROVAL / EXTERNAL COUNSEL OPTIONAL / DO NOT PUBLISH`
>
> 기준일: 2026-09-17 (Asia/Seoul)
>
> Core Social review: `b555420b8d75c9e241a6cd9bd534f205499a87d8`
>
> Account Social review: `5eadea164d559a4f3c45dfca18d6c2acf95a40c0`
>
> FREE authoritative policy: `docs/free-monthly-3-task-product-policy.md`
>
> User decisions: `docs/production-user-policy-decisions.md`

이 후보는 외부 변호사 승인서를 Social Login Production 선행조건으로 요구하지 않는다. 실제 LOTBI 코드/제품정책, 현재 시행 법령과 Provider 공식 문서를 기준으로 작성한다.

Plus 환불·청약철회·Merchant 법적 지위 등 복잡한 영역은 추가 법률검토를 권장하지만, Plus 결제 또는 해당 Merchant 기능이 아직 활성화되지 않았다면 그 세부결정이 무료 Social Signup 전체를 막는 hard gate는 아니다.

---

# LOTBI 이용약관

**시행일: [FINAL HTML PUBLISH DATE에서 확정]**

## 제1조 목적

이 약관은 유한회사 알에이디홀딩스(이하 “회사”)가 제공하는 LOTBI(롯비) 서비스의 계정, 인증, FREE 이용, 유료구독 및 외부 서비스 연결에 관한 기본 이용조건과 회사와 이용자의 권리·의무를 정하는 것을 목적으로 합니다.

## 제2조 회사 및 서비스 정보

- 회사명: 유한회사 알에이디홀딩스
- 대표자: 전선혜
- 주소: 전북특별자치도 전주시 덕진구 혁신로 542, 1동 1층 (여의동)
- 사업자등록번호: 583-88-03679
- 통신판매업신고번호: 2026-전주덕진-0798
- 서비스명: LOTBI(롯비)
- 이메일: `developer@lotbiai.com`
- 대표전화: `063-237-0930`

유료서비스 checkout 또는 외부 Merchant 거래에 추가 고지가 필요한 경우 실제 거래화면에서 해당 판매자·가격·결제·취소·환불 조건을 별도로 표시합니다.

## 제3조 LOTBI 계정

### 1. 회원가입

LOTBI 계정은 회사가 제공하는 가입절차를 완료한 이용자에게 제공됩니다.

Social Signup에서는 Google, Kakao, NAVER 또는 Apple 등 Provider 인증 성공만으로 LOTBI 가입이 완료되지 않습니다. 이용자는 별도로:

- LOTBI에서 사용할 이름
- LOTBI account handle
- LOTBI 이용약관 필수 동의
- LOTBI 개인정보처리방침 필수 동의

를 완료해야 합니다.

### 2. 가입 완료와 보안 활성화

현재 LOTBI 기술계약은 Provider verification → name/handle + 필수동의 → Core account provisioning/ENROLLMENT → first Passkey enrollment → FULL 순서입니다.

**Production 기본문구:** 이용계약은 이용자가 필수 가입정보와 약관/Privacy 동의를 완료하고 회사가 LOTBI 계정 생성을 완료한 때 성립합니다. 다만 중요기능 및 FULL 이용권한은 Passkey 등록 등 회사가 요구하는 보안절차가 완료된 이후 이용할 수 있습니다.

외부 법률검토가 필요한 경우 이 문구는 추가 risk review 대상이지만, 별도 변호사 승인서가 없다는 이유만으로 Social Login 준비를 중단하지 않습니다.

### 3. account handle 및 이름

Account handle은 LOTBI Consumer Username Policy에 따라 생성·검증됩니다.

### 4. Provider 이메일 자동병합 금지

LOTBI는 Provider 이메일이 같다는 이유만으로 신규 Social identity를 기존 LOTBI 계정에 자동 병합하지 않습니다. Canonical external identity는 Provider와 해당 Provider의 stable subject/identifier 조합을 기준으로 관리합니다.

## 제4조 Passkey 및 계정보안

LOTBI는 계정보호를 위해 Passkey 등 공개키 기반 인증을 사용할 수 있습니다.

Social Login으로 시작한 세션은 제한된 인증수준에서 시작할 수 있고, 중요기능 이용 시 Passkey 등 추가 인증을 요구할 수 있습니다.

이용자는 본인의 기기와 인증수단을 안전하게 관리해야 하며 타인의 계정 또는 인증수단을 무단으로 사용해서는 안 됩니다.

## 제5조 Social Login

### 1. 이용 가능한 Provider

LOTBI는 이용자의 선택에 따라 Google, Kakao, NAVER 또는 Apple 인증을 회원가입·로그인·계정 연결 수단으로 사용할 수 있습니다.

각 Provider 기능은 실제 Production configuration, callback, scope, lifecycle 및 activation gate가 준비된 경우에만 제공합니다.

### 2. LOTBI 자체 동의

Provider의 OAuth/OIDC 동의나 Provider 계정 보유는 LOTBI 이용약관/개인정보처리방침 동의를 대신하지 않습니다.

Social Signup에서는 `TERMS_OF_SERVICE`와 `PRIVACY_POLICY` 두 문서에 각각 필수 동의해야 하며 둘 중 하나라도 동의하지 않으면 가입을 완료할 수 없습니다.

### 3. 계정 연결

기존 LOTBI 계정에 Provider identity를 추가하는 LINK는 신규 Signup과 별도 기능입니다. 현재 reviewed contract는 기존 FULL session과 fresh proof를 요구합니다.

### 4. 연결 해제

Social Login 연결 해제와 LOTBI 회원탈퇴는 서로 다른 절차입니다.

현재 generic LOTBI unlink는 LOTBI 계정을 유지하면서 해당 external identity를 local `REVOKED`로 처리하고 관련 제한 세션/미완료 flow를 정리합니다.

Provider-side authorization revoke 정책은 `docs/production-user-policy-decisions.md`의 `D3`와 Provider 공식 lifecycle에 따라 적용합니다.

현재 Kakao/NAVER/Apple의 Provider lifecycle blocker가 닫히지 않은 기능은 활성화하지 않습니다.

## 제6조 만 14세 미만 가입 — [USER DECISION D1]

현재 Social Signup에는 법정대리인 동의 workflow가 구현되어 있지 않습니다.

**추천 v1 기본안:**

`LOTBI는 만 14세 미만 이용자의 회원가입을 지원하지 않습니다. 가입 시 이용자는 만 14세 이상임을 확인해야 합니다.`

사용자가 `D1=A`를 승인하면 위 문구를 정식 Terms와 Account/App signup gate에 동일하게 적용합니다.

`D1=B`로 만 14세 미만 가입을 허용하려면 법정대리인 동의·확인 workflow가 먼저 구현되어야 합니다.

## 제7조 FREE 이용한도

LOTBI FREE 이용자는 매월 **3개의 성공 작업**을 이용할 수 있습니다.

`3개 작업`은 메시지 3개, 질문 3번 또는 AI Provider 호출 3회를 의미하지 않습니다.

### 1. 차감 시점

사용자가 하나의 목적을 요청하고 LOTBI가 실제 사용할 수 있는 최종 사용자 결과를 성공적으로 전달한 경우에만 1개의 FREE 작업을 차감합니다.

요청접수, 내부 처리시작, AI/provider 호출 또는 중간결과 생성 자체만으로 차감하지 않습니다.

### 2. 동일 task 내부 대화

하나의 목적을 완성하기 위한 추가질문, 조건확인, 지역·예산·인원·날짜 확인, 옵션선택 및 동일 task 내부 보완대화는 별도 작업으로 차감하지 않습니다.

최종 결과 완료 뒤 명백히 독립적인 새로운 목적을 요청하면 새 task가 될 수 있습니다. 경계가 애매한 경우 사용자를 불리하게 하기 위해 과도하게 분리하지 않습니다.

### 3. 미차감

다음은 최종 성공결과가 전달되지 않은 경우 차감하지 않습니다.

- LOCAL deterministic 대화
- 서버/HTTP 5xx 오류
- AI/외부 Provider 장애
- timeout/network failure
- validation/authentication/payment failure
- 완료 전 사용자 취소/중단
- retry/reconciliation
- 사용자 결과 미전달/미완료

### 4. 중복차감 금지

같은 task 또는 usage idempotency boundary에서 retry/duplicate/network/provider/callback/client/reconciliation retry가 발생해도 같은 성공 작업은 최대 1회만 차감합니다.

### 5. 월 초기화와 이월

- reset: 매월 1일 00:00 `Asia/Seoul` / KST
- rolling signup month: 사용하지 않음
- carry-over: 없음

### 6. compensation

잘못 차감됐거나 장애 보상이 필요한 경우 기존 usage event를 삭제·변조하지 않고 별도 감사가능 compensation/credit adjustment 방식으로 복구합니다.

사용자 UI에서는 `이번 달 무료 작업 2 / 3 사용`, `무료 작업 1회 남음`처럼 표시하고 `메시지 3개`, `AI 질문 3번`이라는 표현을 사용하지 않습니다.

## 제8조 LOTBI Plus

### 1. 기본 제품정보

현재 제품 기준:

- 상품명: `LOTBI Plus`
- 월 구독료: `9,900원`
- Web: Toss Payments
- iPhone/iOS: Apple App Store subscription
- Android: Google Play subscription

LOTBI Plus는 `무제한 일반 AI 사용권` 또는 일반 ChatGPT 대체 이용권으로 표현하지 않습니다. LOTBI 서비스 범위의 유료구독입니다.

### 2. Social Login과 Plus 세부약관의 분리

Plus 구매기능이 아직 활성화되지 않은 경우 환불·청약철회·billing grace·Store entitlement의 세부조건 미확정은 무료 Social Login 계정가입 자체의 hard blocker가 아닙니다.

다만 Plus를 Production에서 실제 판매하기 전에는 결제화면과 약관에 자동갱신, 결제주기/금액, 해지방법, 환불/청약철회, 결제실패 및 entitlement 조건을 확정·표시합니다.

전자상거래법상 정기결제 가격 인상 또는 무료→유료 전환 시 적용되는 별도 동의/고지 요건이 있는 경우 이를 따릅니다.

### 3. 해지 효력 — [USER DECISION D4 / PAID SERVICE ONLY]

**추천 기본안:** 자동갱신을 중단하고 이미 결제된 현재 결제기간 종료까지 Plus entitlement를 유지합니다.

사용자가 `D4=A`를 승인하면 Web/Store 구현이 허용하는 범위에서 이 원칙을 채널별 UI와 entitlement state에 반영합니다.

### 4. 결제실패 / grace — [USER DECISION D5 / PAID SERVICE ONLY]

**추천 기본안:** Apple/Google Store의 authoritative billing/grace/account-hold state를 따르고, Web Toss는 실제 성공한 갱신결제와 짧은 retry/reconciliation 상태를 구분합니다. 결제실패만으로 무기한 Plus 권한을 연장하지 않습니다.

구체 grace 일수/상태는 실제 PG/Store contract와 구현에서 확정합니다.

### 5. 환불·청약철회

Plus Production 판매 전 Web/Apple/Google 각 채널의 관계 법령과 판매정책에 맞춰 결제 전 고지합니다.

`LEGAL_COUNSEL_REVIEW_RECOMMENDED`: 환불·청약철회·Store refund와 LOTBI entitlement의 관계는 분쟁리스크가 큰 영역이므로 추가 법률검토를 권장합니다. 다만 Plus 미활성 상태에서 이 검토가 무료 Social Login 계정가입을 차단하지는 않습니다.

## 제9조 LOTBI Plus 구독료와 외부 Merchant 거래대금

LOTBI Plus 등 LOTBI 자체 유료서비스 구독료와 외부 판매처·예약처·서비스 제공자에게 지급하는 상품/예약/여행/지역서비스 거래대금은 구분됩니다.

LOTBI Transaction Kernel이 승인범위, 재검증, idempotency, UNKNOWN recovery 등 실행안전장치를 제공한다는 이유만으로 LOTBI가 모든 외부 Merchant 거래의 판매자 또는 거래대금 수취·정산 주체가 되는 것은 아닙니다.

외부 Merchant 거래기능이 실제 활성화되면 거래화면에서 실제 판매자/서비스 제공자, 가격, 결제, 취소/환불 및 책임관계를 명확히 표시합니다.

`LEGAL_COUNSEL_REVIEW_RECOMMENDED`: LOTBI의 통신판매업자/중개자/구매실행보조자 등 법적 지위는 실제 Merchant flow별로 추가 검토를 권장하며, 확인되지 않은 지위를 약관에서 확정하지 않습니다.

## 제10조 서비스 이용 제한

회사는 다음과 같이 서비스 보안, 법령준수 및 타 이용자 보호를 위해 합리적으로 필요한 경우 계정 또는 특정 기능의 이용을 제한할 수 있습니다.

- 계정탈취·인증우회 또는 부정접근이 의심되는 경우
- 서비스/Provider/Merchant API를 공격·남용하는 경우
- 타인의 권리 또는 관계 법령을 침해하는 경우
- 결제·거래·환불·인증을 부정하게 조작하는 경우
- 이용자가 account deletion lifecycle을 시작한 경우

가능한 경우 제한사유와 필요한 조치를 이용자에게 알리고, 긴급한 보안·법적 조치가 필요한 경우 사후 통지할 수 있습니다.

이용자는 `developer@lotbiai.com`을 통해 문의 또는 이의를 제기할 수 있습니다.

## 제11조 서비스 변경·중단

회사는 유지보수, 보안사고 대응, Provider/Merchant 장애, 법령·정책변경 또는 불가피한 기술사유로 서비스 일부를 변경하거나 일시 중단할 수 있습니다.

중대한 변경·종료가 예정된 경우 관계 법령과 실제 상황에 따라 합리적인 방법으로 사전 고지합니다. 긴급한 보안·장애대응의 경우 사후 고지할 수 있습니다.

유료서비스가 실제 활성화된 경우 이미 지급한 대가와 잔여 entitlement의 처리에 대해 관계 법령과 해당 판매채널 조건을 적용합니다.

## 제12조 이용자의 책임 및 금지행위

이용자는 다음 행위를 해서는 안 됩니다.

- 타인의 계정·인증수단 무단사용 또는 탈취
- 보안장치·승인범위·거래검증 절차 우회
- 허위·기망·자동화 공격으로 서비스 또는 외부 시스템에 피해를 주는 행위
- 타인의 권리 또는 관계 법령 침해
- 서비스의 정상 운영을 방해하는 행위

## 제13조 회사의 책임 범위

회사는 회사의 고의·과실로 이용자에게 손해가 발생한 경우 관계 법령에 따라 책임을 부담합니다.

Provider 또는 Merchant의 독립된 서비스영역에서 발생한 사유라는 이유만으로 이용자의 법정 권리를 일괄 배제하지 않습니다.

회사는 법령상 허용되지 않는 포괄면책 또는 소비자의 법정 권리를 제한하는 조항을 두지 않습니다.

## 제14조 개인정보 보호

개인정보 처리는 LOTBI 개인정보처리방침에 따릅니다.

Social Login Provider 자체 인증서비스에는 각 Provider의 약관·개인정보정책이 적용될 수 있습니다.

## 제15조 약관 변경

회사가 약관을 변경하는 경우 적용일과 주요 변경내용을 이용자가 확인할 수 있도록 공식사이트 또는 서비스 내 적절한 방법으로 고지합니다.

이용자에게 불리한 중요변경이나 별도 동의가 필요한 변경은 관계 법령에 따른 절차를 적용합니다.

Social Signup consent manifest는 가입 당시 이용자가 본 document version/SHA-256/URI를 evidence로 고정하며, 이후 새 약관 적용이 별도 동의를 필요로 하는 경우 새 consent evidence를 받는 구조로 확장할 수 있습니다.

## 제16조 분쟁 및 준거법

LOTBI 이용과 관련한 분쟁에는 대한민국 법령을 적용합니다.

분쟁이 발생하면 회사와 이용자는 우선 성실히 협의하고, 해결되지 않는 경우 관계 법령상 관할법원 또는 소비자분쟁 해결절차를 이용할 수 있습니다.

특정 법원을 소비자에게 일방적으로 강제하는 전속관할 문구를 임의로 두지 않습니다.

## 제17조 문의

- 이메일: `developer@lotbiai.com`
- 대표전화: `063-237-0930`
- 운영회사: 유한회사 알에이디홀딩스

---

# Production publication gate

외부 counsel 승인서는 필수 gate가 아니다.

무료 Social Login용 Terms 게시 전 필수:

1. `D1` 사용자 결정;
2. 최종 시행일/version 확정;
3. 실제 Site 최신 main에서 final HTML freeze;
4. Privacy와 상호 링크/문구 정합성 검증;
5. exact UTF-8 HTML SHA-256 산출;
6. 사용자 Production publish 승인.

D3는 Provider별 기술 activation 전에, D4/D5는 Plus 결제 Production 활성화 전에 닫는다.

현재 상태:

`PRODUCTION TERMS = TECHNICALLY / POLICY READY FOR USER APPROVAL`

`EXTERNAL LEGAL COUNSEL = OPTIONAL / RECOMMENDED, NOT HARD BLOCKER`

`PRODUCTION PUBLISH = PENDING USER APPROVAL`.