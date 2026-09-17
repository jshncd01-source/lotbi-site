# LOTBI 이용약관 — Production Service / Social Auth 검토 초안

> 상태: REVIEW DRAFT / LEGAL_REVIEW_REQUIRED
>
> 조사 기준일: 2026-09-17
>
> 현재 공개 `terms.html`은 사전 공개 웹사이트 이용안내다. 이 문서는 정식 LOTBI 서비스 이용약관에 필요한 서비스·계정·Social Login·거래 구분을 검토하기 위한 내부 초안이며, 사용자 승인 및 법률 검토 없이 공개 약관을 대체하지 않는다.

## 1. 정식 Production Terms의 범위

정식 약관은 단순 웹사이트 열람뿐 아니라 Production LOTBI 서비스의 다음 관계를 다뤄야 한다.

- LOTBI 회원계정의 생성·이용·보안
- Passkey 및 외부 Social Login 인증
- Google, Kakao, NAVER, Apple 계정 연결/해제
- 회원탈퇴 및 계정삭제 lifecycle
- LOTBI 서비스 제공·변경·중단
- LOTBI Plus 등 유료 구독이 도입/활성화되는 경우의 별도 유료서비스 조건
- 외부 판매처·예약처·결제사업자와 이용자 간 거래에서 LOTBI가 수행하는 역할
- LOTBI가 직접 판매자/거래상대방인 경우와 단순 검색·비교·중개·실행보조자인 경우의 구분

실제 제공하지 않는 기능을 약관에 현재 제공 중인 것으로 쓰지 않는다.

## 2. LOTBI 계정

정식 약관은 LOTBI 계정이 Provider 계정과 별도라는 점을 명확히 해야 한다.

검토 항목:

- 회원가입 완료 시점과 LOTBI 계약 성립 시점
- 계정 handle/name 등 LOTBI 자체 가입정보
- Passkey 및 복구수단 관리 의무
- 이용자의 계정·기기 보안 의무
- 계정 정지/제한/해지 사유와 절차
- 계정 복구가 가능한 범위와 보안상 제한
- 하나의 Provider subject가 다른 LOTBI 이용자에게 임의 이전되지 않는 identity 정책

현재 Core는 Social Login Provider email 일치만으로 기존 LOTBI 계정을 자동 병합하지 않는다.

## 3. 외부 로그인 서비스

LOTBI는 Google, Kakao, NAVER, Apple 등 외부 인증사업자의 인증을 회원가입·로그인 또는 계정 연결에 사용할 수 있다.

정식 약관에서는 다음을 구분한다.

- Provider 인증서비스와 LOTBI 서비스는 별개의 서비스다.
- Provider 계정의 생성·유지·제재·정책은 해당 Provider가 관리한다.
- Provider 인증 성공만으로 LOTBI의 별도 Terms/Privacy 동의가 완료되는 것은 아니다.
- Social Login 가입은 LOTBI가 요구하는 자체 `TERMS_OF_SERVICE` 및 `PRIVACY_POLICY` 동의를 별도로 거친다.
- Provider가 제공할 수 있는 email/name/profile 등의 정보가 있다고 해서 LOTBI가 이를 모두 수집·저장하는 것은 아니다.

## 4. Provider 장애 및 정책변경

Provider 장애, API 중단, 인증정책 변경, OAuth/OIDC 설정변경, 이용자 Provider 계정 정지/삭제 등 LOTBI가 직접 통제하지 못하는 사유로 특정 Social Login 방식이 제한될 수 있다.

정식 약관은 이를 이유로 과도한 포괄면책을 선언하지 않는다. 다음을 법률 검토한다.

- 이용자가 다른 활성 인증수단/Passkey를 보유한 경우의 대체접근
- Provider-only recovery를 허용하지 않는 현재 보안정책과의 정합성
- 서비스 장애 고지 및 복구 노력의 범위
- LOTBI 귀책 장애와 Provider 귀책 장애의 책임 구분

## 5. 계정 연결과 연결 해제

### 계정 연결

기존 LOTBI 계정에 외부 Provider identity를 추가로 연결하는 것은 신규 Social Signup과 다른 절차다. 현재 Core는 LINK 시 FULL LOTBI session 및 fresh Passkey/provider proof를 요구하는 방향으로 설계돼 있다.

### Social Login 연결 해제

현재 generic unlink는 LOTBI 계정을 유지하면서 해당 Provider identity의 로컬 연결을 `REVOKED` 처리한다.

- LOTBI 회원탈퇴가 아니다.
- Provider 계정 자체를 삭제하지 않는다.
- 현재 generic unlink는 Provider authorization remote revoke를 수행하지 않는다.
- subject의 UNIQUE reservation을 유지한다.

Apple-specific unlink에 원격 Apple authorization revoke를 포함할지는 별도 제품/보안정책 결정을 거쳐야 한다.

## 6. 회원탈퇴와 계정삭제

정식 약관은 Social Login unlink와 LOTBI 회원탈퇴를 동일하게 표현하지 않는다.

LOTBI 회원탈퇴는 LOTBI 계정 자체의 deletion lifecycle을 시작하며 현재 Core 사실관계는:

- 계정 접근 및 활성 session/권한을 우선 회수하고,
- 외부 identity local link를 revoke하며,
- 최종 data erasure는 별도 purge workflow로 처리하고,
- 법률상/보안상 보관이 필요한 기록에는 별도 보존근거가 적용될 수 있는 구조

다.

Provider authorization revoke는 별도의 Provider-specific lifecycle이다. Sign in with Apple이 활성화된 계정의 삭제에는 Apple revoke lifecycle이 구현되어야 한다.

정확한 보존기간·파기기준은 개인정보처리방침 및 관계법령 검토와 일치해야 한다.

## 7. 서비스 변경·중단

Production Terms에는 LOTBI 서비스의 일부 또는 전부가 변경·일시중단·종료될 수 있는 경우와 통지방식을 법률검토해 반영한다.

검토 대상:

- 유지보수/보안 업데이트
- Provider 또는 Merchant API 장애·종료
- 법령/규제/스토어 정책 변경
- 불가항력
- 핵심 기능의 장기 중단/종료 시 사용자 고지
- 계정/거래/구독과 관련된 미처리 의무의 정리

서비스 중단 조항이 이미 성립한 거래상 의무 또는 법정 소비자 권리를 일괄 면제하는 표현이 되지 않도록 검토한다.

## 8. LOTBI Plus 구독과 기본 서비스의 구분

`LOTBI Plus`가 유료 구독으로 실제 Production 활성화될 경우, 기본 LOTBI 계정/Social Login 약관과 유료 구독조건을 구분해야 한다.

정식 문서화 전에 확정할 항목:

- Plus가 실제로 제공하는 유료 기능
- 가격/결제주기/세금 표시
- 자동갱신 여부
- App Store/Google Play 또는 웹 결제 중 실제 판매경로
- 청약철회·해지·환불 정책
- 구독 종료 후 데이터/계정의 상태
- 무료 LOTBI 계정 탈퇴와 Plus 구독해지의 순서/관계

현재 readiness 문서는 Plus의 가격·혜택·환불조건을 임의로 만들지 않는다.

Status: `USER_DECISION_REQUIRED — LOTBI_PLUS_COMMERCIAL_TERMS` before final Production Terms if Plus is launch scope.

## 9. 외부 판매처 거래와 LOTBI 자체 서비스의 구분

LOTBI의 상품 검색·비교·추천·구매/예약 지원 기능이 Provider/Merchant와 연결되는 경우, 약관은 누가 실제 거래상대방인지 명확히 해야 한다.

### 외부 판매처/예약처가 거래상대방인 경우

예: 독립몰/Cafe24/Godomall 등 외부 Merchant의 상품·주문·결제 계약이 해당 Merchant 또는 결제사업자와 성립하는 구조.

검토 문구는 다음을 구분한다.

- LOTBI가 검색·비교·대화·승인확인·공식 Merchant API 기반 실행을 보조하는 역할
- 실제 상품 판매자/서비스 제공자
- 가격·재고·배송·취소·환불 등 Merchant가 결정/처리하는 영역
- LOTBI가 자신의 Transaction Kernel을 통해 승인 scope, 재검증, idempotency, unknown recovery 등을 통제하는 기술적 역할과 판매자 지위를 혼동하지 않는 표현

### LOTBI가 직접 유료서비스를 판매하는 경우

LOTBI Plus 등 LOTBI 자체 디지털 서비스가 활성화된다면 그 거래는 외부 Merchant 상품거래와 분리하여 LOTBI 운영주체의 유료서비스 계약으로 문서화해야 한다.

정식 약관은 모든 거래를 “LOTBI가 판매한다”거나 반대로 모든 책임을 외부 판매처에 돌리는 방식으로 뭉뚱그리지 않는다.

Status: `LEGAL_REVIEW_REQUIRED — COMMERCE_ROLE_AND_RESPONSIBILITY`.

## 10. Provider 정책 준수

Social Login 과정에는 선택한 Provider의 자체 약관·정책이 별도로 적용될 수 있다. LOTBI가 Provider 자체 계정을 관리하거나 Provider 정책을 대신 정하는 것으로 표현하지 않는다.

Provider authorization revoke, Provider 계정 삭제, Provider 서비스 탈퇴와 LOTBI 계정관리 기능도 구분한다.

## 11. 현재 LOTBI Core와 맞춰야 할 계약 사실

- Social LOGIN Provider verification만으로 FULL LOTBI assurance가 되지 않고 Passkey step-up이 필요하다.
- 신규 Social Login 가입에는 LOTBI `TERMS_OF_SERVICE` 및 `PRIVACY_POLICY` consent가 별도로 필요하다.
- Provider email 일치만으로 기존 계정을 자동 연결하지 않는다.
- canonical external identity는 Provider + stable provider subject다.
- 현재 최소 identity 계약은 Provider email/profile을 계정 identity로 저장하지 않는다.
- generic external identity unlink는 local revoke이며 remote Provider revoke가 아니다.
- LOTBI account deletion과 final purge는 분리돼 있다.
- Apple SIGNUP/LINK는 revocation lifecycle 준비 전까지 Production-ready로 선언하지 않는다.

## 12. LEGAL_REVIEW_REQUIRED

- 계약 성립 시점 및 가입 완료 시점
- 미성년자/만 14세 미만 이용자 가입 및 법정대리인 동의
- 계정 정지·제한·해지 사유와 절차
- Provider 장애 시 LOTBI의 고지·대체인증·복구 의무 범위
- 회원탈퇴 후 법령상 보존 대상/기간
- Provider/Merchant 귀책과 LOTBI 귀책의 책임범위
- 손해배상/면책 조항
- 분쟁해결, 준거법, 관할
- 전자상거래/통신판매중개/예약/구매중개 등에 관한 LOTBI 실제 법적 지위와 고지
- Merchant 거래의 취소·환불·배송 책임 구조
- LOTBI Plus가 launch scope일 경우 유료서비스/구독/환불/자동갱신 조항

## 13. Provider 심사 관점 체크

정식 Terms URL은 다음 조건을 만족하는 것을 목표로 한다.

- 공개 HTTPS 접근 가능
- 서비스명 `LOTBI` 명확 표시
- Homepage/Privacy/Account와 운영주체 일치
- 실제 Social Login 흐름과 모순 없음
- account deletion 안내와 연결 가능
- Provider 장애/연결해제/회원탈퇴 개념을 구분
- 아직 제공하지 않는 Plus/거래기능을 현재 제공한다고 허위 표시하지 않음

## 14. 현재 판정

- Production Terms 구조/필수 항목: `REVIEW DRAFT READY`
- Social Auth 계약 사실 정합성: `REVIEW READY`
- Plus 조항: `USER_DECISION_REQUIRED IF LAUNCH SCOPE`
- Commerce role wording: `LEGAL_REVIEW_REQUIRED`
- 현재 공개 `terms.html`: `PRE-RELEASE NOTICE ONLY`
- 정식 Production Terms 공개: `UPDATE REQUIRED`
- 법적 최종 문구: `LEGAL_REVIEW_REQUIRED`
- Provider 제출용 최종 Terms: `NOT YET SUBMISSION READY`
