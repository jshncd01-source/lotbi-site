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

## 3. 공개 개인정보처리방침에 들어가야 할 사실관계

최종 공개본에는 최소한 아래 사항이 실제 Production 구조와 일치하도록 포함되어야 한다.

1. LOTBI가 사용하는 Social Login Provider
   - Google
   - Kakao
   - NAVER
   - Apple
2. 각 Provider에서 실제 접근하는 정보
3. 이용 목적
   - 본인/계정 식별
   - 로그인 처리
   - 신규 가입 또는 기존 계정 연결
   - 연결 관리
4. LOTBI가 저장하는 항목과 인증 순간에만 검증하는 항목의 구분
5. Social Login 연결 해제와 LOTBI 회원 탈퇴가 서로 다른 기능이라는 점
6. 회원 탈퇴/계정 삭제 시 외부계정 식별정보가 어떻게 처리되는지
7. 법령상 보관 의무가 있는 경우의 예외
8. 이용자의 열람·정정·삭제·처리정지 등 권리 및 문의 방법
9. Provider와의 데이터 처리 관계가 국외이전·제3자 제공·처리위탁 중 어느 법적 구조에 해당하는지에 대한 최종 검토 결과
10. 개인정보 문의 연락처

## 4. 공개본에 아직 확정해서 쓰지 말아야 하는 항목

다음은 현재 구현/법률 확인이 끝나지 않아 숫자나 법적 성격을 임의로 확정하지 않는다.

### LEGAL_REVIEW_REQUIRED
- `provider_subject`의 정확한 보유기간 또는 보유기간 결정 기준
- Google/Kakao/NAVER/Apple 인증 과정의 개인정보보호법상 국외이전/제3자 제공/처리위탁 등 정확한 법적 분류
- 관계 법령에 따른 별도 보존 항목 및 기간
- 만 14세 미만 가입정책과 법정대리인 동의 필요 여부를 반영한 최종 문구

### CORE_SOCIAL_AUTH_BLOCKER
- Google: `openid` 단독 scope의 Production 계약 적합성 검증
- Apple: signup/link에 필요한 revocation lifecycle storage/처리 계약
- Social Login 연결 해제 시 외부계정 식별정보의 정확한 삭제/상태변경 처리

## 5. 공개 정책 삽입용 후보 문구 — 법률 검토 전

아래 문구는 의미/구조 검토용이며 그대로 게시하는 최종 법률문구가 아니다.

### 외부 계정을 이용한 회원가입 및 로그인

LOTBI는 이용자가 선택하는 경우 Google, Kakao, NAVER 또는 Apple 계정을 이용한 회원가입·로그인 기능을 제공할 수 있습니다. LOTBI는 외부 인증사업자가 발급한 서비스별 이용자 식별정보를 이용하여 이용자의 LOTBI 계정을 식별하고, 로그인 또는 계정 연결 상태를 관리합니다.

현재 LOTBI의 기본 Social Login 계약은 외부 계정의 이메일, 전화번호, 생년월일, 성별, 주소 또는 친구목록을 LOTBI 계정 식별을 위해 요구하지 않는 최소수집 구조를 원칙으로 합니다. 실제 제공되는 정보의 범위는 이용자가 선택한 인증사업자, 인증사업자의 설정 및 LOTBI가 운영 시점에 요청하는 권한 범위에 따라 달라질 수 있습니다.

외부 인증사업자와의 계정 연결을 해제하는 것과 LOTBI 회원 자체를 탈퇴하는 것은 서로 다른 절차입니다. LOTBI 회원 탈퇴 및 계정 삭제에 관한 자세한 사항은 계정 삭제 안내 및 실제 계정 관리 화면에서 확인할 수 있습니다.

※ 최종 공개 전 실제 Production scope, 보관기간/파기 기준, 국외이전·제3자 제공·처리위탁 해당 여부, Apple revocation lifecycle을 반영하여 문구를 확정해야 한다.

## 6. 현재 판정

- Social Login 처리정보 구조: `REVIEW READY`
- 최소수집 원칙: `READY`
- 공개 Privacy 문서 반영: `UPDATE REQUIRED`
- 법적 최종 문구: `LEGAL_REVIEW_REQUIRED`
- Provider 제출용 최종 Privacy: `NOT YET SUBMISSION READY`
