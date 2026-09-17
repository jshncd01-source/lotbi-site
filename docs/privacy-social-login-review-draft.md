# LOTBI 개인정보처리방침 — Social Login 검토 초안

> 상태: REVIEW DRAFT / LEGAL_REVIEW_REQUIRED
>
> 조사 기준일: 2026-09-17
>
> 이 문서는 Provider 심사 준비용 검토 초안이다. 현재 공개 `privacy.html`을 자동 대체하지 않으며, 법률 최종본으로 간주하지 않는다.

## 1. 목적

LOTBI가 Google, Kakao, NAVER, Apple 계정을 이용한 회원가입·로그인·계정 연결 기능을 제공할 때 실제 시스템에서 이용하는 최소 인증정보를 공개 개인정보처리방침에 반영하기 위한 초안이다.

핵심 원칙:
- Provider 동의화면에서 받은 정보를 LOTBI가 모두 저장한다고 쓰지 않는다.
- 현재 Core가 실제 사용하는 정보만 반영한다.
- Provider 심사를 쉽게 하기 위해 이메일·전화번호·생년월일·성별·주소·친구목록 등의 권한을 추가하지 않는다.
- Provider OAuth/OIDC 동의는 LOTBI 이용약관 및 개인정보처리방침 동의를 대체하지 않는다.

## 2. 현재 확인된 Social Login 처리정보

### Google
- 처리 후보/실사용: Google이 발급한 안정적인 이용자 식별자(`sub`)
- 이용 목적: Google 로그인 이용자의 LOTBI 계정 식별 및 계정 연결 관리
- LOTBI 저장: Provider 종류 + Provider 이용자 식별자
- 현재 미사용: Google 이메일, 이름, 프로필 사진 등 프로필 정보

주의: 현재 Core의 Google Web scope는 `openid`만 사용한다. Google 최신 OIDC 문서와의 실제 Production 호환성 검증이 남아 있으므로, scope가 바뀌면 이 초안도 함께 수정해야 한다.

### Kakao
- 처리 후보/실사용: Kakao가 발급한 안정적인 이용자 식별자(`sub`)
- 이용 목적: Kakao 로그인 이용자의 LOTBI 계정 식별 및 계정 연결 관리
- LOTBI 저장: Provider 종류 + Provider 이용자 식별자
- 현재 미사용: 카카오계정 이메일, 닉네임/프로필 등 추가 개인정보

### NAVER
- 처리 후보/실사용: NAVER 애플리케이션 범위 이용자 식별자
- 이용 목적: NAVER 로그인 이용자의 LOTBI 계정 식별 및 계정 연결 관리
- LOTBI 저장: Provider 종류 + Provider 이용자 식별자
- 현재 미사용: 이메일, 이름, 휴대전화번호, 생일/출생연도, 성별, 연령대 등 추가 제공정보

### Apple
- 처리 후보/실사용: Apple이 발급한 안정적인 이용자 식별자(`sub`)
- 이용 목적: Apple 로그인 이용자의 LOTBI 계정 식별 및 계정 연결 관리
- LOTBI 저장: Provider 종류 + Provider 이용자 식별자 — 단, 현재 Apple signup/link는 revocation lifecycle 준비 전까지 fail-closed 상태
- 현재 미사용: 이메일, Apple private relay 이메일, 전체 이름

## 3. Social Login 연결 해제와 회원 탈퇴

현재 Core 계약은 두 절차를 명확히 구분한다.

### 특정 Social Login 연결 해제
- LOTBI 계정 자체를 삭제하지 않는다.
- 해당 외부계정 링크를 `REVOKED` 상태로 전환한다.
- 외부 Provider 계정 자체를 삭제하거나 원격 revoke하지 않는다(`remote_revocation_performed=false`).
- 기존 외부계정 identity의 UNIQUE 예약을 유지하여 같은 provider subject를 다른 LOTBI 계정으로 옮기지 못하게 한다.
- 동일한 LOTBI 계정 소유자가 새 Passkey/provider proof를 제시하는 명시적 LINK 절차로 다시 활성화할 수 있는 구조다.

따라서 공개 정책에서 “연결 해제 즉시 provider subject 행을 완전 삭제한다”고 쓰면 현재 구현과 불일치한다.

### LOTBI 회원 탈퇴/계정 삭제 요청
- 사용자 상태와 계정 identity를 `DELETION_REQUESTED`로 전환한다.
- 활성 세션, 결제 위임권한, 설치정보, 인증 challenge, push subscription 등의 접근권한을 revoke/cancel한다.
- 활성 ExternalAccountIdentity의 로컬 링크를 즉시 `REVOKED`로 전환한다.
- 원격 Provider revoke는 별도 Provider 정책/절차로 취급한다.
- 최종 erasure는 별도의 operational purge workflow다.
- 법률상 또는 보안상 보관이 필요한 transaction/audit records는 별도 보관될 수 있도록 설계돼 있다.

Core 기본 설정의 `account_deletion_purge_days`는 30일이지만 Production 환경값이 동일하다고 아직 검증하지 않았으므로 공개 정책에는 현재 단계에서 “30일”을 확정 문구로 쓰지 않는다.

## 4. 공개 개인정보처리방침에 들어가야 할 사실관계

최종 공개본에는 최소한 아래 사항이 실제 Production 구조와 일치하도록 포함되어야 한다.

1. LOTBI가 사용하는 Social Login Provider: Google, Kakao, NAVER, Apple
2. 각 Provider에서 실제 접근하는 정보
3. 이용 목적: 본인/계정 식별, 로그인 처리, 신규 가입 또는 기존 계정 연결, 연결 관리
4. LOTBI가 저장하는 항목과 인증 순간에만 검증하는 항목의 구분
5. Social Login 연결 해제와 LOTBI 회원 탈퇴가 서로 다른 기능이라는 점
6. 연결 해제 시 로컬 link가 revoked되고 UNIQUE identity reservation이 유지되는 현재 구조
7. 회원 탈퇴 시 즉시 접근 revoke 후 별도 purge lifecycle이 진행된다는 점
8. 법령상 보관 의무가 있는 경우의 예외
9. 이용자의 권리 및 문의 방법
10. Provider와의 데이터 처리 관계가 국외이전·제3자 제공·처리위탁 중 어느 법적 구조에 해당하는지에 대한 최종 검토 결과

## 5. 공개본에 아직 확정해서 쓰지 말아야 하는 항목

### LEGAL_REVIEW_REQUIRED
- revoked `provider_subject`의 정확한 보유기간 또는 보유기간 결정 기준
- Google/Kakao/NAVER/Apple 인증 과정의 개인정보보호법상 국외이전/제3자 제공/처리위탁 등 정확한 법적 분류
- 관계 법령에 따른 별도 보존 항목 및 기간
- 만 14세 미만 가입정책과 법정대리인 동의 필요 여부를 반영한 최종 문구

### DEPLOYMENT_VERIFY_REQUIRED
- Production `account_deletion_purge_days` 실제 설정값
- Provider별 실제 Production scope 및 callback URI

### CORE_SOCIAL_AUTH_BLOCKER
- Google: `openid` 단독 scope의 Production 계약 적합성 검증
- Apple: signup/link에 필요한 revocation lifecycle storage/처리 계약

## 6. 공개 정책 삽입용 후보 문구 — 법률 검토 전

아래 문구는 의미/구조 검토용이며 그대로 게시하는 최종 법률문구가 아니다.

### 외부 계정을 이용한 회원가입 및 로그인

LOTBI는 이용자가 선택하는 경우 Google, Kakao, NAVER 또는 Apple 계정을 이용한 회원가입·로그인 기능을 제공할 수 있습니다. LOTBI는 외부 인증사업자가 발급한 서비스별 이용자 식별정보를 이용하여 이용자의 LOTBI 계정을 식별하고, 로그인 또는 계정 연결 상태를 관리합니다.

현재 LOTBI의 기본 Social Login 계약은 외부 계정의 이메일, 전화번호, 생년월일, 성별, 주소 또는 친구목록을 LOTBI 계정 식별을 위해 요구하지 않는 최소수집 구조를 원칙으로 합니다. 실제 제공되는 정보의 범위는 이용자가 선택한 인증사업자, 인증사업자의 설정 및 LOTBI가 운영 시점에 요청하는 권한 범위에 따라 달라질 수 있습니다.

특정 외부 인증수단의 연결을 해제하는 것과 LOTBI 회원 자체를 탈퇴하는 것은 서로 다른 절차입니다. 연결 해제 시 LOTBI 내 해당 인증수단의 사용이 중지되며, 회원 탈퇴 시 계정 접근권한을 우선 회수한 뒤 별도의 삭제·보존 절차가 진행됩니다. 구체적인 보관·파기 기준은 실제 Production 설정과 관계 법령 검토 결과에 따라 최종 개인정보처리방침에 명시합니다.

※ 최종 공개 전 실제 Production scope, 보관기간/파기 기준, 국외이전·제3자 제공·처리위탁 해당 여부, Apple revocation lifecycle을 반영하여 문구를 확정해야 한다.

## 7. 현재 판정

- Social Login 처리정보 구조: `REVIEW READY`
- 연결 해제/회원탈퇴 구현 사실관계: `REVIEW READY`
- 최소수집 원칙: `READY`
- 공개 Privacy 문서 반영: `UPDATE REQUIRED`
- 법적 최종 문구: `LEGAL_REVIEW_REQUIRED`
- Provider 제출용 최종 Privacy: `NOT YET SUBMISSION READY`
