# LOTBI 개인정보처리방침 — Social Login 검토 초안

> 상태: REVIEW DRAFT / LEGAL_REVIEW_REQUIRED
>
> 조사 기준일: 2026-09-17
>
> 이 문서는 Provider 심사 준비용 사실관계/문구 검토 초안이다. 현재 공개 `privacy.html`을 자동 대체하지 않으며 법률 최종본으로 간주하지 않는다.

## 1. 목적과 원칙

LOTBI가 Google, Kakao, NAVER, Apple 계정을 이용한 회원가입·로그인·계정 연결 기능을 제공할 때 실제 Core 동작과 공개 개인정보처리방침을 일치시키기 위한 초안이다.

원칙:

- Provider 동의화면에서 받을 수 있는 모든 정보를 LOTBI가 저장한다고 쓰지 않는다.
- 현재 Core가 실제 사용하는 최소 Social identity 데이터만 반영한다.
- Provider 심사를 이유로 이메일·전화번호·생년월일·성별·주소·친구목록·프로필 사진 권한을 추가하지 않는다.
- Provider OAuth/OIDC 동의는 LOTBI 이용약관/개인정보처리방침에 대한 LOTBI 자체 동의를 대체하지 않는다.
- 연결 해제, LOTBI 회원탈퇴, 최종 purge, Provider authorization revoke를 서로 다른 lifecycle로 설명한다.
- 법률적 분류/보유기간은 사실확인과 법률검토 전 임의 확정하지 않는다.

## 2. 현재 확인된 Social Login 처리정보

### Google

- 현재 Social identity 실사용: Google이 발급한 안정적인 이용자 식별자 `sub`
- 이용 목적: Google 로그인 이용자의 LOTBI 계정 식별, 로그인, 신규 가입 또는 기존 계정 연결 관리
- LOTBI Social identity 저장: Provider 종류 + Provider 이용자 식별자
- 현재 미사용/미저장: Google 이메일, 이름, 프로필 사진 등 profile data
- 현재 Core Web scope: `openid`

Google은 `openid`, `email`, `profile`을 각각 문서화된 scope로 제공한다. LOTBI는 현재 email/profile을 기능상 사용하지 않으므로 readiness 단계에서 이를 추가하지 않는다. 다만 Google의 현재 OIDC authorization reference와 실제 endpoint의 `openid`-only Production-compatible 동작은 valid OAuth client 기반 E2E로 아직 검증되지 않았으므로 `GOOGLE_SCOPE_CONTRACT_VERIFY`를 유지한다.

### Kakao

- 현재 Social identity 실사용: Kakao가 발급한 안정적인 OIDC 이용자 식별자 `sub`
- 이용 목적: Kakao 로그인 이용자의 LOTBI 계정 식별, 로그인, 신규 가입 또는 기존 계정 연결 관리
- LOTBI Social identity 저장: Provider 종류 + Provider 이용자 식별자
- 현재 미사용/미저장: 카카오계정 이메일, 닉네임/프로필 등 추가 개인정보
- 현재 Core Web scope: `openid`

### NAVER

- 현재 Social identity 실사용: NAVER 공식 프로필 API의 애플리케이션 범위 고유 이용자 식별자 `response.id`
- 이용 목적: NAVER 로그인 이용자의 LOTBI 계정 식별, 로그인, 신규 가입 또는 기존 계정 연결 관리
- LOTBI Social identity 저장: Provider 종류 + Provider 이용자 식별자
- 현재 미사용/미저장: 이메일, 이름, 휴대전화번호, 생일/출생연도, 성별, 연령대 등 추가 제공정보
- 현재 Web/native 인증 과정에서 token이 일시적으로 사용될 수 있으나, 현재 identity 계약은 profile `response.id`를 canonical subject로 사용한다.

### Apple

- Social identity 사용 예정/로그인 검증: Apple이 발급한 안정적인 이용자 식별자 `sub`
- 이용 목적: Apple 로그인 이용자의 LOTBI 계정 식별 및 계정 연결 관리
- LOTBI Social identity 저장 대상: Provider 종류 + Provider 이용자 식별자
- 현재 미사용/미저장: 이메일, Apple private relay 이메일, 전체 이름
- 현재 Apple LOGIN verification 경로는 있으나, Apple SIGNUP/LINK는 revoke-on-account-deletion lifecycle이 준비될 때까지 fail-closed다.

## 3. 저장하는 것과 저장하지 않는 것의 구분

현재 Social Login identity 기준으로 LOTBI가 지속적으로 연결 관리에 필요한 핵심값은:

- Provider 종류 (`GOOGLE`, `KAKAO`, `NAVER`, `APPLE`)
- Provider가 발급한 서비스/앱 범위의 안정적인 이용자 식별자 (`provider_subject`)
- LOTBI 내부 external identity 상태 및 계정 연결정보

이다.

현재 최소계약에서 Social Login identity로 사용하지 않는 값:

- Provider 이메일
- Provider 표시 이름/닉네임
- Provider 프로필 사진
- 전화번호
- 생년월일/출생연도
- 성별/연령대
- 주소
- 친구목록

Provider 인증 과정의 authorization code, ID/access token 등은 인증 transport에서 처리될 수 있으나, 이를 Social identity 데이터와 같은 의미로 표현하지 않는다. 특히 Apple은 향후 계정삭제 시 Provider authorization revoke를 위해 최소 revocation material을 암호화 보관하는 별도 Core lifecycle이 필요하며, 그 구현이 완료되기 전 Apple SIGNUP/LINK는 Production-ready가 아니다.

## 4. 네 개의 별도 lifecycle

### A. Social Login 연결 해제

현재 Core의 일반 external identity unlink는 LOTBI 계정 자체를 삭제하지 않는다.

- FULL LOTBI session 및 fresh Passkey proof가 필요하다.
- 선택한 `ExternalAccountIdentity`를 `REVOKED` 상태로 전환한다.
- 관련 `FEDERATED_LIMITED` session과 미완료 external-auth flow를 revoke/cancel한다.
- 외부 Provider 계정 자체를 삭제하지 않는다.
- 일반 unlink 경로는 Provider authorization remote revoke를 수행하지 않으며 audit상 `remote_revocation_performed=false`다.
- identity의 UNIQUE provider-subject reservation을 유지하여 같은 Provider subject가 다른 LOTBI 사용자에게 조용히 이동하지 못하게 한다.
- 동일 LOTBI 계정 소유자가 fresh Passkey/provider proof를 제시하는 명시적 LINK 절차로 재활성화할 수 있는 구조다.

따라서 공개 정책에서 “연결 해제 즉시 provider subject를 완전 삭제한다” 또는 “연결 해제하면 Provider 계정도 삭제된다”고 쓰면 현재 구현과 불일치한다.

Apple-specific unlink 시 remote Apple revoke까지 수행할지는 별도 제품/보안정책 결정이 필요하며 현재 generic unlink와 동일시하지 않는다.

### B. LOTBI 회원탈퇴/계정 삭제 요청

현재 Core는 회원탈퇴 요청 즉시 접근권한부터 회수한다.

- 사용자/계정 identity 상태를 deletion requested 상태로 전환한다.
- 활성 LOTBI session을 revoke한다.
- 활성 결제 위임권한을 revoke한다.
- Passkey/설치정보/challenge/push subscription을 상태에 따라 revoke·deletion requested·cancel 처리한다.
- 활성 ExternalAccountIdentity의 로컬 링크를 `REVOKED`로 전환한다.
- 관련 미완료 external-auth flow를 취소하고 민감한 일회성 flow material을 제거한다.

이 시점이 곧 모든 database row의 즉시 hard delete를 의미하지 않는다.

### C. LOTBI 최종 purge

Core는 최종 erasure를 별도 operational purge workflow로 설계한다.

- deletion request에 따라 configurable `purge_after`가 설정된다.
- Core의 local default 설정값은 30일이지만 실제 Production 값이 동일하다고 아직 검증하지 않았으므로 공개 Privacy에 “30일”을 확정하지 않는다.
- 법률상 또는 보안상 보관이 필요한 transaction/audit records는 해당 근거 범위에서 별도 보관될 수 있도록 설계되어 있다.
- revoked `provider_subject` reservation을 최종 purge 이후 어떤 방식/기간/근거로 처리할지는 법률·보안정책 검토가 필요하다.

### D. Provider 측 authorization revoke

Provider authorization revoke는 LOTBI 로컬 unlink/탈퇴/purge와 별개의 Provider-specific operation이다.

- 현재 generic unlink는 remote revoke를 하지 않는다.
- 현재 account deletion contract도 remote Provider revoke를 별도 provider policy/lifecycle로 명시한다.
- Apple Sign in with Apple을 사용해 생성/연결된 계정은 LOTBI 회원탈퇴 lifecycle에 Apple REST API token revoke를 포함해야 하는 Core blocker가 남아 있다.
- Google/Kakao/NAVER의 remote revoke/logout/disconnect 정책 역시 각 Provider별 최종 integration 계약에 맞춰 별도로 문서화해야 한다.

## 5. Provider data matrix

| Provider | stable subject | email | name | profile | 기타 개인정보/scope |
|---|---|---|---|---|---|
| Google | `REQUIRED` | `UNUSED` | `UNUSED` | `UNUSED` | `UNUSED` under current identity model |
| Kakao | `REQUIRED` | `UNUSED` | `UNUSED` | `UNUSED` | `UNUSED` under current identity model |
| NAVER | `REQUIRED` (`response.id`) | `UNUSED` | `UNUSED` | `UNUSED` | `UNUSED` under current identity model |
| Apple | `REQUIRED` when enabled | `UNUSED` | `UNUSED` | `UNUSED` | no private-relay/full-name dependency in current Core |

`OPTIONAL`은 현재 요청한다는 뜻이 아니다. 향후 실제 제품기능이 생긴 경우에만 별도 Core/정책/동의 변경 후 추가할 수 있다.

## 6. 공개 개인정보처리방침에 들어가야 할 사실관계

최종 공개본에는 실제 Production 구조와 일치하도록 최소한 다음을 반영해야 한다.

1. Google, Kakao, NAVER, Apple Social Login 사용 여부와 활성 범위
2. Provider별 실제 접근/요청 정보
3. stable provider subject를 계정 식별에 사용하는 목적
4. LOTBI가 지속 저장하는 정보와 인증 순간 transport에서만 처리하는 정보의 구분
5. email/name/profile을 현재 Social identity로 저장하지 않는 최소수집 계약
6. Social Login unlink와 LOTBI 회원탈퇴의 구분
7. unlink 시 local identity가 revoked되고 UNIQUE subject reservation이 유지되는 현재 구조
8. 회원탈퇴 시 즉시 access revoke 후 별도 purge lifecycle이 진행되는 구조
9. Provider authorization revoke가 별도 Provider-specific lifecycle이라는 점
10. 법령상 보관 의무가 있는 경우의 예외
11. 이용자의 개인정보 관련 권리/문의 방법
12. Provider와의 data processing relationship에 관한 법률 최종 검토 결과

## 7. LEGAL_REVIEW_REQUIRED

다음은 readiness 방에서 법률 결론을 내리지 않는다.

- Google/Kakao/NAVER/Apple 인증 과정의 개인정보보호법상 국외이전 해당 여부와 고지/동의 방식
- 각 Provider 관계의 제3자 제공 / 처리위탁 / 기타 법적 성격
- revoked/reserved `provider_subject`의 정확한 보유 근거와 보유기간 또는 비식별/파기 기준
- 관계 법령상 별도 보존 대상 정보와 기간
- 만 14세 미만 가입 가능 여부, 법정대리인 동의 및 미성년자 정책
- 최종 공개 purge 기간
- 외부 거래/결제/예약 기능이 Production 활성화될 때 추가되는 개인정보 처리항목

## 8. DEPLOYMENT / INTEGRATION VERIFY REQUIRED

- Production `account_deletion_purge_days` 실제값
- Google/Kakao/NAVER/Apple 실제 Production scope
- Provider별 authoritative Web callback URI
- Google `openid`-only live flow
- Apple provider-token vault/revoke lifecycle
- Provider별 remote revoke/disconnect 최종 정책

## 9. 공개 정책 삽입용 후보 문구 — 법률 검토 전

### 외부 계정을 이용한 회원가입 및 로그인

LOTBI는 이용자가 선택하는 경우 Google, Kakao, NAVER 또는 Apple 계정을 이용한 회원가입·로그인 및 계정 연결 기능을 제공할 수 있습니다. LOTBI는 외부 인증사업자가 발급한 서비스별 이용자 식별정보를 이용하여 이용자의 LOTBI 계정을 식별하고 로그인 또는 연결 상태를 관리합니다.

현재 LOTBI의 최소 Social Login 계약은 계정 식별에 필요한 Provider별 안정적인 이용자 식별정보를 중심으로 구성하며, 이메일, 전화번호, 생년월일, 성별, 주소, 친구목록, 프로필 사진 등을 계정 식별을 위한 기본정보로 요구하지 않는 것을 원칙으로 합니다. 실제 요청정보는 운영 시점의 Provider 설정과 LOTBI 기능에 따라 달라질 수 있으며 변경 시 개인정보처리방침 및 필요한 동의절차를 함께 갱신합니다.

외부 인증수단의 연결 해제, LOTBI 회원탈퇴, LOTBI 데이터의 최종 파기, 외부 인증사업자의 authorization revoke는 서로 다른 절차입니다. 연결 해제 시 LOTBI 내 해당 인증수단의 연결이 중지되며, LOTBI 회원탈퇴 시 계정 접근권한을 우선 회수한 뒤 별도의 파기·보존 절차가 진행됩니다. 외부 인증사업자 authorization의 해제 또는 revoke가 필요한 경우에는 해당 Provider의 정책과 LOTBI의 적용 lifecycle에 따라 별도로 처리합니다.

※ 위 문구는 검토용이다. 공개 전 실제 Production scope/callback, 보관·파기 기준, 국외이전/제3자 제공/처리위탁 법적 분류, Apple revocation lifecycle 및 미성년자 정책을 반영해 최종 확정해야 한다.

## 10. 현재 판정

- Social Login 실제 처리정보 구조: `REVIEW READY`
- Provider data minimization baseline: `READY`
- A/B/C/D lifecycle facts: `REVIEW READY`
- 공개 Privacy 반영: `UPDATE REQUIRED`
- 법적 최종 문구: `LEGAL_REVIEW_REQUIRED`
- Provider 제출용 최종 Privacy: `NOT YET SUBMISSION READY`
