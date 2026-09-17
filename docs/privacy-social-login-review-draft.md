# LOTBI 개인정보처리방침 — Social Login / Production 검토 초안

> 상태: `REVIEW DRAFT READY / PUBLIC UPDATE REQUIRED / LEGAL_REVIEW_REQUIRED`
>
> 조사 기준일: 2026-09-17
>
> 이 문서는 Provider 심사 및 Production Social Signup 준비용 사실관계 초안이다. 현재 공개 `privacy.html`을 자동 대체하지 않으며 법률 최종본으로 간주하지 않는다.

Implementation baselines:
- Core Social review: `b555420b8d75c9e241a6cd9bd534f205499a87d8`
- Account Social review: `5eadea164d559a4f3c45dfca18d6c2acf95a40c0`

## 1. 현재 Production 공개본 상태

Public URL: `https://lotbiai.com/privacy.html`

현재 공개 페이지는 HTTPS/비로그인 접근이 가능하고 모바일 viewport를 포함하지만, 시행일 2026-09-14의 **사전 공개 버전**이다. 현재 문구는 공개 사이트가 정적 안내 페이지이며 회원가입 기능을 제공하지 않는다고 설명하고, 정식 서비스가 개인정보를 처리하기 전에 별도 업데이트한다고 명시한다.

따라서 reviewed Social Signup 계약을 활성화하기 위한 Production Privacy로는 현재 내용이 부족하다.

Status: `PUBLICLY ACCESSIBLE / CONTENT NOT PRODUCTION-SOCIAL-AUTH READY`.

## 2. Provider별 실제 reviewed Social Auth 데이터

| Provider | 실제 reviewed Web scope | Provider에서 Social identity로 사용하는 값 | Provider email/name/profile |
|---|---|---|---|
| Google | `openid` | verified `sub` | 현재 미요청/미저장 |
| Kakao | `openid` | verified `sub` | 현재 미요청/미저장 |
| NAVER | `openid` | official profile `response.id` | email/name/profile 등 추가 필드 미사용 |
| Apple | email/name profile scope 없음 | verified `sub` | private relay email/full name 미사용 |

Google `openid`-only는 코드 계약이며 실제 configured-client E2E 검증 전에는 최종 Provider readiness를 GREEN으로 선언하지 않는다. 이를 해결하기 위해 email/profile scope를 임의 추가하지 않는다.

Apple LOGIN contract는 준비됐지만 Apple SIGNUP/LINK는 provider revocation/token lifecycle 구현 전까지 fail-closed다.

## 3. Social Signup에서 사용자가 LOTBI에 직접 제공하는 정보

Provider 프로필정보와 별개로 Social Signup 완료 화면에서 사용자가 직접 다음 정보를 입력한다.

- LOTBI에서 사용할 이름 (`User.name`)
- LOTBI 아이디/handle (`AccountIdentity.handle`)

아이디는 기존 Consumer Username Policy를 적용한다.

따라서 최종 Privacy는 “Provider에서는 이름을 수집하지 않는다”와 “사용자가 LOTBI 가입화면에서 이름을 직접 입력한다”를 구분해서 설명해야 한다.

## 4. 가입/보안 과정에서 생성·저장되는 정보

현재 reviewed Social Signup lifecycle은 다음을 저장·생성한다.

- Provider 종류 + stable `provider_subject`
- LOTBI external identity 및 연결 상태
- 사용자 직접 입력 LOTBI 이름/handle
- 설치/세션 관련 계정 보안 기록
- 최초 Passkey 등록 및 복구수단 lifecycle
- 필수 동의 evidence
- 필요한 audit/security evidence

Reviewed provisioning에서 Provider email은 `None`, `email_verified=false`, Provider profile은 `{}`다. External identity의 display name은 Provider 이름을 가져오는 값이 아니라 사용자가 직접 입력한 LOTBI 이름이다.

Provider authorization code, ID/access token처럼 인증 transport에 일시적으로 필요한 값은 지속 Social identity 정보와 같은 것으로 설명하지 않는다. Apple은 향후 revoke lifecycle에 필요한 최소 revocation material을 별도 암호화 보관하는 Core 작업이 필요하다.

## 5. Social Signup 필수 동의 manifest

Social Signup은 정확히 다음 두 LOTBI 문서 동의를 요구한다.

1. `TERMS_OF_SERVICE` — 필수
2. `PRIVACY_POLICY` — 필수

각 동의 evidence에는 Core server-owned manifest와 일치하는 다음 사실이 포함된다.

- document version
- document SHA-256
- HTTPS document URI
- decision `ACCEPTED`
- `required=true`
- locale
- source `SOCIAL_SIGNUP`
- installation / flow / provider evidence

Account Web은 Core에서 manifest를 가져오며 브라우저가 version/hash를 임의 생성하지 않는다. 두 필수 동의가 모두 수락되지 않으면 가입 완료 요청이 차단된다.

현재 Production에는 reviewed `/v2/sessions/providers/signup/consents` 계약이 아직 배포되지 않았으므로 Production manifest version/hash/URI는 현재 이 readiness 작업에서 확정된 값이 아니다.

Status: `PRODUCTION CONSENT MANIFEST = NOT DEPLOYED`.

## 6. 네 개의 lifecycle 구분

### A. Social Login 연결 해제

현재 generic LOTBI unlink는 LOTBI 계정을 유지하면서 선택한 external identity를 로컬 `REVOKED` 처리한다. 관련 limited session/미완료 flow도 회수하며 unique provider-subject reservation은 유지한다. 현재 generic path는 remote Provider revoke를 수행하지 않는다.

### B. LOTBI 회원탈퇴/계정삭제 요청

계정 접근과 활성 session/위임권한/설치 등의 authority를 먼저 revoke하고 external identity도 local `REVOKED` 처리한 뒤 deletion lifecycle로 이동한다. 이 시점은 즉시 모든 DB row가 hard-delete 됐다는 뜻이 아니다.

### C. LOTBI 최종 purge

별도 operational purge workflow다. Core local default는 30일이지만 실제 Production purge 값과 법률상 보존모델이 확인되지 않았으므로 공개 Privacy에 30일을 확정하지 않는다.

### D. Provider authorization revoke/unlink

Provider 측 authorization 관계를 끊는 별도 lifecycle이다. 현재 reviewed generic unlink와는 다르다.

- Kakao: 공식 Kakao Login 문서는 서비스 탈퇴/연동 해제 시 Kakao Unlink API를 포함하도록 요구한다. 현재 provider-specific 구현은 아직 closure가 필요하다.
- NAVER: 공식 NAVER Login 문서는 서비스 탈퇴/연동 해제 시 Token Revocation과 외부 연결끊기 알림 처리를 제공한다. 현재 provider-specific 구현은 아직 closure가 필요하다.
- Apple: Apple SIGNUP/LINK는 encrypted revocation material + `/auth/revoke` + reconciliation lifecycle이 구현될 때까지 차단한다.
- Google: 최종 disconnect/revoke 고지는 실제 launch integration mode에 맞춰 별도 확정한다.

## 7. Provider subject reservation

현재 local unlink 후에도 provider-subject unique reservation이 유지되어 다른 LOTBI 사용자에게 동일 Provider identity가 조용히 이동하지 못한다.

따라서 공개 Privacy는 “연결 해제 즉시 provider subject 완전삭제”라고 쓰면 안 된다.

회원탈퇴/최종 purge 뒤 이 reserved/revoked subject를 어떤 근거와 기간으로 유지·변환·파기할지는:

`LEGAL_REVIEW_REQUIRED — PROVIDER_SUBJECT_RETENTION_BASIS_AND_PERIOD`.

## 8. 공개본에 반드시 추가할 사실 범위

최종 Production Privacy는 최소한 다음을 실제 launch 범위와 일치시켜야 한다.

- 활성 Social Login Providers 및 실제 scope/data
- Provider stable identifier의 이용 목적
- 사용자 직접 입력 이름/handle
- 가입 동의 evidence 및 계정 보안 처리
- 저장정보와 인증 순간 transport 정보의 구분
- 연결 해제 / 회원탈퇴 / purge / Provider revoke 구분
- 계정 삭제 안내 경로
- 이용자 권리와 문의처
- 실제 법적 검토가 끝난 국외이전/제3자 제공/처리위탁 관련 고지
- 법령상 보존항목/기간

## 9. LEGAL_REVIEW_REQUIRED

- Google/Kakao/NAVER/Apple 관련 국외이전 해당 여부와 고지/동의 방식
- 각 Provider 관계의 제3자 제공 / 처리위탁 / 기타 법적 분류
- revoked/reserved provider subject의 보관 근거/기간 또는 변환·파기기준
- transaction/audit 법정보존 항목/기간
- 만 14세 미만/미성년자 가입정책과 법정대리인 동의
- 실제 Production purge 기간
- Provider별 remote unlink/revoke 구현 완료 후 최종 공개 표현
- 외부 Merchant 거래/결제/예약 활성화 시 추가 개인정보 처리항목

## 10. 현재 판정

- Provider data facts: `REVIEW CONTRACT VERIFIED`
- Social Signup direct account data: `DOCUMENTED`
- Consent evidence contract: `REVIEW CONTRACT VERIFIED`
- Public Privacy URL accessibility: `READY`
- Public Privacy content: `UPDATE REQUIRED`
- Production consent manifest: `NOT DEPLOYED`
- Legal final wording: `LEGAL_REVIEW_REQUIRED`
- Provider submission Privacy readiness: `BLOCKED`
