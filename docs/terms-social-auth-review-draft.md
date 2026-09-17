# LOTBI 이용약관 — Production Service / Social Auth 검토 초안

> 상태: `REVIEW DRAFT READY / PUBLIC UPDATE REQUIRED / LEGAL_REVIEW_REQUIRED`
>
> 조사 기준일: 2026-09-17
>
> 현재 공개 `terms.html`은 사전 공개 웹사이트 이용안내다. 이 문서는 Production LOTBI 서비스와 Social Signup에 필요한 계약 사실을 정리한 내부 초안이며 법률 최종본이 아니다.

Implementation baselines:
- Core Social review: `b555420b8d75c9e241a6cd9bd534f205499a87d8`
- Account Social review: `5eadea164d559a4f3c45dfca18d6c2acf95a40c0`

## 1. 현재 Production 공개본 상태

Public URL: `https://lotbiai.com/terms.html`

현재 페이지는 공개 HTTPS/비로그인 접근이 가능하고 모바일 viewport를 포함하지만 제목과 내용이 `LOTBI 웹사이트 이용안내` / `사전 공개 버전`이다. 실제 Production 계정·Social Login·구독·거래 계약을 다루는 정식 이용약관은 아니다.

Status: `PUBLICLY ACCESSIBLE / PRODUCTION TERMS UPDATE REQUIRED`.

## 2. LOTBI 계정과 Social Login

정식 Terms는 Provider 계정과 LOTBI 계정을 구분해야 한다.

Reviewed Social Signup 계약은:

- Provider 검증만으로 LOTBI 계정이 생성되지 않는다.
- 사용자가 LOTBI 이름과 account handle을 직접 입력한다.
- handle은 기존 Consumer Username Policy를 적용한다.
- `TERMS_OF_SERVICE`와 `PRIVACY_POLICY`를 각각 필수 동의해야 한다.
- Core server-owned manifest의 version/SHA256/URI와 동의 evidence가 정확히 일치해야 한다.
- Social Signup 계정 생성 후 ENROLLMENT session을 거쳐 최초 Passkey 등록이 필요하다.
- Provider email 일치만으로 기존 LOTBI 계정을 자동 병합하지 않는다.
- canonical external identity는 Provider + stable provider subject/identifier다.

## 3. LOGIN / SIGNUP / LINK 구분

### LOGIN

기존 연결된 external identity로 인증한다. Provider verification만으로 FULL assurance가 되지 않으며 현재 LOTBI 정책에 따라 Passkey step-up이 이어진다.

### SIGNUP

Provider verification 뒤 별도 LOTBI 가입정보와 필수 Terms/Privacy consent를 받아 canonical LOTBI 계정을 만든다.

### LINK

기존 LOTBI 계정에 Provider identity를 추가하는 별도 행위다. Reviewed contract는 FULL LOTBI session과 fresh proof를 요구한다. Provider subject는 다른 LOTBI 사용자에게 임의 이동하지 않는다.

Apple은 LOGIN contract만 준비되어 있고 SIGNUP/LINK는 lifecycle blocker가 닫힐 때까지 허용하지 않는다.

## 4. Social Login 연결 해제와 계정삭제

정식 약관에서 다음을 같은 의미로 사용하지 않는다.

1. **Social Login 연결 해제**: LOTBI 계정은 유지하고 특정 external identity linkage를 끊는다.
2. **LOTBI 회원탈퇴/계정삭제**: LOTBI 계정의 deletion lifecycle을 시작한다.
3. **최종 purge**: 별도 operational erasure 단계다.
4. **Provider authorization revoke/unlink**: Provider 측 authorization 관계를 끊는 별도 API/lifecycle이다.

현재 generic LOTBI unlink는 local `REVOKED` 처리이며 remote Provider revoke가 아니다. Provider별 공식 lifecycle 요구가 있으면 별도 구현해야 한다.

Kakao 공식 Login 계약은 서비스 탈퇴/연동 해제 시 Kakao Unlink를 포함해야 하는 lifecycle을 설명한다. NAVER도 서비스 탈퇴/연동 해제 Token Revocation 및 연결끊기 callback을 문서화한다. Apple SIGNUP/LINK는 token revocation lifecycle 때문에 계속 차단한다.

## 5. Provider 장애·정책 변경과 서비스 제한

Provider 장애, API 중단, Provider 계정 상태, 정책변경 등으로 특정 Social Login 방법이 제한될 수 있다. 최종 약관은 이를 근거로 LOTBI의 모든 책임을 일괄 면제하지 않으며, 실제 대체 인증·복구정책과 소비자보호상 의무를 함께 법률 검토한다.

서비스 변경/중단 조항도 이미 성립한 거래·구독상의 의무와 법정 권리를 일괄 소멸시키는 표현으로 작성하지 않는다.

## 6. LOTBI Plus — 확정 제품 기준과 미확정 법률문구

LOTBI Plus의 사업조건이 전부 미정인 것은 아니다.

현재 확정 제품 기준:

- 상품명: `LOTBI Plus`
- 가격: 월 `9,900원`
- FREE 기준: 월 `3개 작업`
- Web 판매/결제 채널: Toss Payments
- iPhone: Apple subscription
- Android: Google Play subscription

V1 Web 결제 목표:

- 신용/체크카드
- 계좌 기반 자동결제
- 토스페이 정기결제

V2 후보:

- 웹 카카오페이 정기구독
- 웹 Apple Pay 정기구독

아직 법률/최종 약관 검토가 필요한 항목:

- 자동갱신 고지문구와 동의 방식
- 해지 효력 시점의 최종 약관 표현
- 환불 조건
- 청약철회 및 디지털서비스 관련 법적 처리
- Apple/Google/PG 등 판매채널별 환불과 LOTBI entitlement의 관계
- 세금/가격표시 및 변경고지의 최종 표현

Status: `LOTBI_PLUS_COMMERCIAL_TERMS = PARTIALLY DECIDED / LEGAL REVIEW REQUIRED FOR FINAL TERMS`.

## 7. LOTBI Plus 결제와 외부 Merchant 거래 분리

정식 약관은 다음 두 금전흐름을 혼동하지 않는다.

### LOTBI가 직접 받는 금액

`LOTBI Plus` 자체 구독료는 LOTBI의 유료 디지털서비스 대가로 별도 계약/구독조건을 적용한다.

### 외부 Merchant 상품·예약·여행·서비스 거래

독립몰/Cafe24/Godomall 등 외부 Merchant의 상품·서비스 거래는 실제 Merchant/결제사업자의 주문·결제 구조와 연결되는 영역이다. 현재 LOTBI 정책 초안은 이를 LOTBI가 외부 판매대금을 직접 수취·정산하는 구조로 표현하지 않는다.

LOTBI의 Transaction Kernel이 승인 scope, 재검증, idempotency, UNKNOWN recovery 등을 통제하는 기술적 역할과 실제 판매자/거래상대방 지위를 혼동하지 않는다.

Status: `LEGAL_REVIEW_REQUIRED — COMMERCE_ROLE_AND_RESPONSIBILITY`.

## 8. 회원탈퇴와 데이터 처리

LOTBI 회원탈퇴는 계정 접근/authority를 먼저 revoke한 뒤 별도 purge workflow로 이어지는 구조다. 법률상 또는 보안상 보관이 필요한 기록에는 별도 보존 근거가 적용될 수 있다.

정확한 purge 기간, provider-subject retention 및 Provider remote revoke 처리의 최종 Terms 표현은 Privacy 및 실제 Provider lifecycle과 일치해야 한다.

## 9. Social Signup legal manifest와 Terms

Social Signup manifest는 정식 Terms의 version, SHA-256, HTTPS URI를 Core server-owned 설정으로 고정한다. Account Web은 이 값을 Core에서 받아 보여주고 사용자가 필수 동의를 하지 않으면 가입 완료를 차단한다.

현재 Production에는 reviewed `/v2/sessions/providers/signup/consents` endpoint가 배포되어 있지 않고 Production Terms도 사전 공개 안내이므로 현재 manifest/Terms 조합은 launch-ready가 아니다.

## 10. LEGAL_REVIEW_REQUIRED

- 계약 성립/가입 완료 시점의 최종 표현
- 만 14세 미만/미성년자 정책
- 계정 제한/정지/해지 사유·절차
- Provider 장애 시 고지/복구 책임
- 회원탈퇴 후 법정보존
- 손해배상/면책
- 분쟁해결/준거법/관할
- 전자상거래/통신판매중개/예약/구매중개에서 LOTBI의 실제 법적 지위
- 외부 Merchant의 배송/취소/환불과 LOTBI 책임의 구분
- Plus 자동갱신/해지/환불/청약철회 최종 문구

## 11. 현재 판정

- Social Auth 계약 사실: `REVIEW CONTRACT VERIFIED`
- LOTBI Plus 제품 기준: `PARTIALLY DECIDED`
- Plus 법률 최종조건: `LEGAL_REVIEW_REQUIRED`
- 외부 Merchant와 Plus 금전흐름 구분: `DOCUMENTED`
- Public Terms URL accessibility: `READY`
- Public Terms content: `UPDATE REQUIRED`
- Production legal manifest: `NOT DEPLOYED`
- Provider submission Terms readiness: `BLOCKED`
