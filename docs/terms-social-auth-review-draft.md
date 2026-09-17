# LOTBI 이용약관 — Social Auth 반영 검토 초안

> 상태: REVIEW DRAFT / LEGAL_REVIEW_REQUIRED
>
> 조사 기준일: 2026-09-17
>
> 현재 공개 `terms.html`은 사전 공개 웹사이트 이용안내이므로, 이 문서는 정식 LOTBI 서비스 이용약관에 Social Login 관련 어떤 내용을 반영해야 하는지 정리한 검토 초안이다. 사용자 승인·법률 검토 없이 공개 약관을 대체하지 않는다.

## 1. 정식 이용약관에 필요한 Social Login 항목

### 외부 인증 서비스 이용

LOTBI는 Google, Kakao, NAVER, Apple 등 외부 인증사업자가 제공하는 인증 기능을 회원가입·로그인 또는 계정 연결에 사용할 수 있다.

최종 약관에서는 다음 사실을 명확하게 구분해야 한다.
- 외부 Provider의 인증 서비스와 LOTBI 서비스는 별개의 서비스다.
- Provider 장애·정책 변경·계정 상태에 따라 외부 인증 기능이 일시적으로 제한될 수 있다.
- Provider 인증이 성공했다는 사실만으로 LOTBI의 별도 이용약관/개인정보처리방침 동의가 완료된 것으로 보지 않는다.

### LOTBI 계정 귀속

현재 Core의 계정 연결 기준은 Provider 종류와 Provider가 발급한 안정적인 이용자 식별자의 조합이다.

최종 약관에는 다음 원칙의 반영 여부를 검토한다.
- 같은 이메일 문자열을 가진 외부 계정이라는 이유만으로 LOTBI 계정을 자동 병합하지 않는다.
- 신규 Social Login 가입과 기존 LOTBI 계정에 Provider를 연결하는 작업을 구분한다.
- 이용자는 자신이 정당하게 사용할 수 있는 Provider 계정을 이용해야 한다.

### Social Login 연결 해제와 회원 탈퇴의 구분

두 절차를 같은 것으로 쓰지 않는다.

1. Social Login 연결 해제
   - LOTBI 계정은 유지하면서 특정 외부 인증수단과의 연결만 해제하는 절차
2. LOTBI 회원 탈퇴/계정 삭제
   - LOTBI 회원 계정 자체의 삭제 lifecycle을 시작하는 절차

실제 공개 약관의 삭제·보존 문구는 Core의 account deletion/purge 계약 및 법적 보관의무 검토 결과와 일치해야 한다.

### 외부 인증 서비스 장애·중단

Provider 장애, 인증 API 중단, 정책 변경, 이용자 Provider 계정 정지/삭제 등 LOTBI가 직접 통제할 수 없는 사유로 특정 로그인 방식이 작동하지 않을 수 있다.

최종 약관은 이를 이유로 LOTBI가 광범위한 면책을 갖는다고 과도하게 선언하지 않고, 실제 대체 인증/계정 복구 정책 및 소비자보호상 의무와 함께 법률 검토한다.

### Provider 정책 준수

이용자가 Social Login을 사용하는 과정에는 선택한 Provider의 자체 약관·정책이 별도로 적용될 수 있다. LOTBI가 Provider 자체 계정을 관리하거나 Provider 정책을 대신 정하는 것으로 표현하지 않는다.

## 2. 현재 LOTBI Core와 맞춰야 할 계약 사실

- 신규 Social Login 가입에는 LOTBI `TERMS_OF_SERVICE` 동의가 별도로 필요하다.
- 신규 Social Login 가입에는 LOTBI `PRIVACY_POLICY` 동의가 별도로 필요하다.
- Provider 이메일 일치만으로 기존 LOTBI 계정에 자동 연결하지 않는다.
- canonical external identity는 Provider + Provider subject다.
- 현재 기본 계약은 Provider 이메일/프로필을 LOTBI 외부계정 identity에 저장하지 않는다.
- Apple signup/link는 revocation lifecycle 준비 전까지 Production-ready로 선언하지 않는다.

## 3. 최종 약관 전 LEGAL_REVIEW_REQUIRED

- 계약 성립 시점 및 가입 완료 시점
- 미성년자/만 14세 미만 이용자 가입 가능 여부와 법정대리인 동의
- 계정 정지·제한·해지 사유 및 절차
- Provider 장애 시 대체 인증/복구 의무의 범위
- 회원 탈퇴 후 법령상 보존 대상과 기간
- 외부 인증사업자 귀책 문제에 대한 책임 범위
- 손해배상/면책 조항
- 분쟁해결, 준거법, 관할
- 전자상거래·예약·구매중개 등 LOTBI의 실제 거래기능이 활성화되는 시점의 별도 서비스 책임/계약 구조

## 4. Provider 심사 관점 체크

정식 Terms URL은 다음 조건을 만족하는 것을 목표로 한다.
- 공개 HTTPS 접근 가능
- LOTBI 서비스명을 명확하게 표시
- 홈페이지/Privacy/Account와 서비스 주체가 일치
- 실제 Social Login 흐름과 모순되지 않음
- 회원 탈퇴/계정 삭제 안내와 연결 가능
- 아직 제공하지 않는 기능을 제공한다고 쓰지 않음

## 5. 현재 판정

- Social Auth 관련 약관 요구사항 정의: `READY`
- 현재 공개 `terms.html`: `PRE-RELEASE NOTICE ONLY`
- 정식 Production Terms: `TERMS_PAGE_REQUIRED`
- 법적 최종 문구: `LEGAL_REVIEW_REQUIRED`
- Provider 제출용 Terms: `NOT YET SUBMISSION READY`
