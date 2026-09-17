# LOTBI 개인정보처리방침 — Production 최종 후보

> 상태: `TECHNICAL CANDIDATE READY / LEGAL_REVIEW_REQUIRED / DO NOT PUBLISH`
>
> 작성 기준일: 2026-09-17 (Asia/Seoul)
>
> 적용 코드 기준:
> - Core Social review: `b555420b8d75c9e241a6cd9bd534f205499a87d8`
> - Account Social review: `5eadea164d559a4f3c45dfca18d6c2acf95a40c0`
>
> 이 문서는 `https://lotbiai.com/privacy.html` 교체 후보문이다. 기술 사실은 현재 reviewed Social Auth/Account 계약에 맞췄지만, 아래 `LEGAL_REVIEW_REQUIRED` 항목이 닫히기 전 Production 공개본으로 사용하지 않는다.

---

# 개인정보처리방침

유한회사 알에이디홀딩스(이하 “회사”)는 LOTBI(롯비) 서비스를 제공하면서 이용자의 개인정보를 보호하고 관련 고충을 처리하기 위하여 개인정보처리방침을 수립·공개합니다.

시행일: **[LEGAL_REVIEW_REQUIRED — 최종 공개일 확정 후 기재]**

## 1. 개인정보의 처리 목적

회사는 실제 이용 기능과 이용자가 선택한 인증 방식에 따라 필요한 범위에서 개인정보를 처리합니다.

### LOTBI 계정 생성 및 관리

- LOTBI 회원계정 생성 및 식별
- LOTBI 이름 및 계정 아이디(handle) 관리
- 이용약관 및 개인정보처리방침 동의 확인과 증빙
- Passkey 등록·인증, 복구 및 계정 보안
- 로그인 세션, 설치/기기 연결 상태 및 인증 보증수준 관리
- 계정 연결·연결 해제·회원탈퇴 및 삭제 요청 처리

### Social Login

이용자가 선택하는 경우 Google, Kakao, NAVER 또는 Apple 인증을 LOTBI 회원가입·로그인·계정 연결에 사용할 수 있습니다.

LOTBI는 Provider 인증 성공 자체를 LOTBI 이용약관 또는 개인정보처리방침 동의로 간주하지 않습니다. 신규 Social Signup은 별도로 LOTBI 이용약관과 개인정보처리방침에 대한 필수 동의를 받아야 합니다.

### 서비스 보안과 부정이용 방지

- 인증 요청의 위변조·재사용·세션 탈취 방지
- state, nonce, PKCE, flow binding 등 인증 흐름 검증
- 세션 및 인증수단의 발급·갱신·폐기
- 보안 이벤트와 계정 상태 변경에 대한 감사·분쟁대응 증빙

## 2. 처리하는 개인정보 항목

### 2.1 이용자가 LOTBI에 직접 입력하는 정보

Social Signup을 포함한 신규 계정 생성 시 이용자가 LOTBI에 직접 입력하는 정보:

- LOTBI 이름
- LOTBI 계정 아이디(handle)

이 정보는 Social Login Provider에서 가져오는 이름·닉네임과 구분됩니다. 현재 reviewed Social Signup 구현은 Provider의 이름을 LOTBI 계정 이름으로 가져오지 않습니다.

### 2.2 Social Login Provider별 실제 사용정보

| Provider | LOTBI가 Social identity로 사용하는 값 | 현재 Social identity로 사용하지 않는 Provider 정보 |
|---|---|---|
| Google | Google OIDC `sub` | 이메일, 이름, 프로필 사진 등 profile 정보 |
| Kakao | Kakao OIDC `sub` | 카카오계정 이메일, 닉네임/프로필 등 추가 개인정보 |
| NAVER | 공식 프로필 API의 애플리케이션 범위 식별자 `response.id` | 이메일, 이름, 휴대전화번호, 생일/출생연도, 성별, 연령대, 프로필 등 |
| Apple | Apple `sub` | 이메일, private relay 이메일, 전체 이름 |

현재 reviewed Web scope는 Google/Kakao/NAVER가 `openid`이고, Apple은 이메일·이름 profile scope를 요청하지 않습니다.

Apple은 LOGIN 계약은 준비되어 있으나 SIGNUP/LINK는 Provider revocation lifecycle이 완료되기 전까지 열지 않습니다.

### 2.3 LOTBI 계정·인증·동의 증빙 정보

서비스는 계정 및 인증을 위해 다음과 같은 정보를 처리할 수 있습니다.

- LOTBI 내부 사용자·계정 식별자 및 계정 상태
- Social Login Provider 종류와 `provider_subject`
- external identity의 연결 상태
- 설치/기기 연결 식별정보 및 상태
- 로그인 세션 식별자, 인증 보증수준, 세션 만료정보
- Passkey 등록·인증에 필요한 공개키 기반 인증정보 및 관련 상태
- 약관/개인정보처리방침 동의 키, 문서 버전, 문서 SHA-256, 문서 URI, 동의 여부, 필수 여부, locale, 동의 출처 및 관련 flow/installation 증빙
- 계정/인증/삭제 lifecycle에 필요한 보안·감사 기록

`UserConsentRecord`에는 Social Signup의 Provider subject 자체를 동의증빙 값으로 중복 저장하지 않는 현재 Core 계약을 유지합니다.

### 2.4 인증 과정에서 일시적으로 처리되는 정보

OAuth/OIDC 인증 과정에서는 authorization code, ID/access token 등 Provider 인증용 정보가 서버에서 일시적으로 처리될 수 있습니다. 현재 최소 Social identity 계약은 이러한 값을 Provider 이메일·프로필과 동일한 영구 계정정보로 취급하지 않습니다.

Apple SIGNUP/LINK에 필요한 장기 revocation material 저장은 아직 구현되지 않았으며 해당 lifecycle이 구현·검증되기 전 Apple SIGNUP/LINK는 비활성 상태를 유지합니다.

### 2.5 필수 브라우저 인증 쿠키

Account Web은 인증 및 보안을 위해 필수 쿠키를 사용할 수 있습니다.

- `__Host-lotbi_session`: Core가 발급한 로그인 세션을 브라우저에 유지하기 위한 HttpOnly/Secure/SameSite 쿠키. Core session 만료시간에 따라 만료됩니다.
- `__Host-lotbi_social_flow`: Social Login callback과 동일 브라우저 흐름을 연결하기 위한 단기 HttpOnly/Secure/SameSite 쿠키. reviewed 구현의 최대 flow 수명은 300초입니다.

광고·행태분석 목적의 별도 자동수집 기술이 Production에 추가되는 경우 본 방침과 동의 구조를 실제 운영값에 맞게 별도로 갱신해야 합니다.

## 3. 개인정보의 처리 및 보유기간

회사는 개인정보를 처리 목적 달성에 필요한 기간 동안 보유하고, 회원탈퇴·계정삭제 요청 이후에는 LOTBI의 삭제 lifecycle과 법령상 보존 필요 여부에 따라 처리합니다.

### 활성 계정

LOTBI 이름, account handle, 계정·인증 정보 및 활성 Social identity는 계정 이용에 필요한 기간 동안 처리합니다.

### Social Login 연결 해제

현재 generic unlink는 LOTBI 계정을 유지하면서 해당 external identity를 로컬 `REVOKED` 상태로 전환합니다. 이 과정은 Provider 계정 자체 삭제나 Provider authorization remote revoke와 동일하지 않습니다.

보안상 동일 Provider subject가 다른 LOTBI 사용자에게 조용히 이전되는 것을 막기 위해 현재 Core는 연결 해제 후 `provider_subject`의 UNIQUE reservation을 유지합니다.

**LEGAL_REVIEW_REQUIRED — PROVIDER_SUBJECT_RETENTION_BASIS_AND_PERIOD**

- 이 reservation을 어떤 법적 근거로 얼마 동안 유지할지
- 회원탈퇴 이후 final purge에서 삭제·변환·별도 보안보존 중 어떤 방식으로 처리할지
- Provider별 삭제정책과의 충돌을 어떻게 해소할지

를 Production 공개 전 확정해야 합니다.

### 계정 삭제 요청

LOTBI 계정 삭제 요청이 접수되면 현재 Core 계약은 즉시 모든 데이터의 hard delete를 약속하지 않습니다. 우선 계정 접근 및 활성 권한을 회수하고:

- 사용자/계정 identity를 deletion lifecycle 상태로 전환
- 활성 LOTBI session revoke
- 활성 권한·grant revoke
- Passkey/installation/challenge/push subscription 등을 lifecycle에 맞게 revoke·cancel
- 활성 ExternalAccountIdentity local link를 `REVOKED` 처리
- 관련 미완료 Social Auth flow 취소 및 민감 flow material 제거

를 수행한 뒤 별도의 final purge 절차로 진행합니다.

Core의 소스 기본값에 30일 purge 설정이 존재하더라도 실제 Production 설정·법률상 보존기간이 확정되지 않았으므로 본 후보문은 “30일”을 공개 약속으로 기재하지 않습니다.

### 법령상 보존

관계 법령상 일정 기간 보존이 필요한 거래·결제·분쟁·감사 기록이 있는 경우 해당 법적 근거와 필요한 범위에서 별도 보존할 수 있습니다.

**LEGAL_REVIEW_REQUIRED — STATUTORY_RETENTION_ITEMS_AND_PERIODS**

최종 공개본에는 실제 LOTBI의 거래/구독 구조를 기준으로 해당되는 보존항목·근거·기간을 확인해 반영해야 합니다.

## 4. 개인정보의 파기 절차 및 방법

처리 목적이 달성되고 보유 필요성이 종료된 개인정보는 복구가 어렵도록 삭제 또는 파기합니다.

다만 다음은 동일 시점에 처리된다고 단정하지 않습니다.

- Social Login local unlink
- LOTBI account deletion request
- LOTBI final purge
- Provider authorization revoke/unlink

각 lifecycle은 별도 상태와 증빙을 가질 수 있습니다.

**LEGAL_REVIEW_REQUIRED — 최종 전자정보 파기 방식 및 백업/로그 처리정책을 실제 Production 인프라 기준으로 검토**

## 5. Social Login Provider 연결 및 연결 해제

### 계정 연결

기존 LOTBI 계정에 Provider identity를 연결하는 LINK는 신규 Social Signup과 다른 절차입니다. reviewed Core 계약은 기존 FULL LOTBI session과 fresh Passkey/provider proof를 요구합니다.

Provider 이메일이 기존 LOTBI 계정의 이메일과 같다는 이유만으로 계정을 자동 병합하지 않습니다. Provider subject는 다른 LOTBI 사용자에게 임의로 이전하지 않습니다.

### 계정 연결 해제

현재 LOTBI generic unlink는 로컬 external identity를 `REVOKED` 처리하고 관련 제한 세션/미완료 인증 flow를 정리합니다. LOTBI 계정은 유지됩니다.

Provider 측 authorization 해제 여부는 Provider별 lifecycle과 별도입니다.

- Google: 실제 Production unlink/revoke 정책을 최종 integration 계약과 함께 검증
- Kakao: `KAKAO_PROVIDER_LIFECYCLE_BLOCKER` — Kakao Unlink 및 서비스 탈퇴 시 user-id 처리/purge 정책 필요
- NAVER: `NAVER_PROVIDER_LIFECYCLE_BLOCKER` — Token Revocation 및 disconnect integration 검증 필요
- Apple: `APPLE_SOCIAL_AUTH_LIFECYCLE_BLOCKER` — protected revocation material, revoke, retry/reconciliation 및 lifecycle 구현 필요

Provider lifecycle blocker가 남아 있는 기능은 Production-ready로 표현하지 않습니다.

## 6. 개인정보의 제3자 제공, 처리위탁 및 국외이전

Social Login 과정은 Google, Kakao, NAVER, Apple의 인증시스템과 통신하며 Provider별 서비스 약관·개인정보 정책이 별도로 적용될 수 있습니다.

다만 각 Provider 관계가 대한민국 개인정보 보호법상:

- 개인정보 제3자 제공인지,
- 처리위탁인지,
- 정보주체와의 계약 이행을 위한 국외 처리/보관인지,
- 별도 동의가 필요한 국외이전인지,
- 또는 그 밖의 법적 구조인지

는 실제 Production 데이터 흐름, 계약당사자, 서버 처리 위치와 Provider 계약을 기준으로 확정해야 합니다.

**LEGAL_REVIEW_REQUIRED — THIRD_PARTY_PROCESSING_AND_OVERSEAS_TRANSFER**

최종 공개 전에 Provider별로 실제 해당되는 경우 다음 정보를 법률검토 후 명시합니다.

- 이전/제공/위탁받는 자
- 이전 국가 또는 처리 위치
- 이전되는 개인정보 항목
- 이전 목적
- 이전 시점과 방법
- 보유·이용기간
- 법적 근거 및 필요한 경우 동의/거부 방법과 영향

법률검토 없이 “국외이전 없음”, “제3자 제공 없음” 또는 반대의 확정표현을 넣지 않습니다.

## 7. 정보주체의 권리와 행사방법

이용자는 관계 법령이 정하는 범위에서 개인정보 열람, 정정·삭제, 처리정지, 동의 철회 등 권리를 행사할 수 있습니다.

LOTBI 계정 삭제는 `https://lotbiai.com/account-deletion.html`에서 안내하는 Account Web의 공식 삭제 요청 절차를 이용할 수 있습니다.

Social Login 연결 해제와 LOTBI 계정 삭제는 서로 다른 절차입니다.

권리행사 방법·본인확인·대리인 절차의 최종 표현은 관계 법령과 실제 Account 기능을 기준으로 법률검토 후 확정합니다.

## 8. 개인정보의 안전성 확보

회사는 개인정보 보호를 위해 관계 법령과 서비스 위험도에 맞는 기술적·관리적 보호조치를 적용합니다.

현재 reviewed Social/Auth 계약에서 확인되는 보안 경계에는 다음이 포함됩니다.

- HTTPS 기반 인증 및 callback
- HttpOnly/Secure/SameSite 인증 쿠키
- Provider subject·issuer·audience 등 검증
- state/nonce/PKCE 또는 Provider별 동등한 인증 검증
- one-time flow/binding/replay 방지
- Passkey 기반 step-up 및 계정 보안
- session/authority revoke와 audit evidence

내부 보안구성 또는 secret 값을 개인정보처리방침에 공개하지 않습니다.

## 9. 개인정보 보호 관련 문의 및 고충처리

현재 LOTBI 공식 문의 채널:

- 이메일: `developer@lotbiai.com`
- 대표전화: `063-237-0930`

**LEGAL_REVIEW_REQUIRED — 개인정보 보호책임자 성명 또는 개인정보 보호업무/고충처리 담당 부서의 공식 명칭을 Production 공개 전 확정**

## 10. 만 14세 미만 이용자

**LEGAL_REVIEW_REQUIRED — MINOR_POLICY**

현재 readiness 작업에서는 만 14세 미만 가입 허용 여부, 법정대리인 동의 절차 또는 연령확인 방식을 임의로 확정하지 않습니다. 실제 정책이 확정되기 전까지 관련 내용을 Production Social Signup에서 허위로 표시하지 않습니다.

## 11. 방침의 변경

개인정보처리방침의 내용이 변경되는 경우 적용일과 변경내용을 관계 법령 및 실제 서비스 방식에 맞게 고지합니다.

Social Signup consent evidence는 이용자가 동의한 당시 문서의 `document_version`, SHA-256 및 HTTPS URI를 Core가 보존하는 구조를 사용합니다.

---

## Publication gate

이 후보문은 다음 항목이 닫힌 후에만 `privacy.html` Production 후보로 승격할 수 있습니다.

1. `LEGAL_REVIEW_REQUIRED — THIRD_PARTY_PROCESSING_AND_OVERSEAS_TRANSFER`
2. `LEGAL_REVIEW_REQUIRED — PROVIDER_SUBJECT_RETENTION_BASIS_AND_PERIOD`
3. `LEGAL_REVIEW_REQUIRED — STATUTORY_RETENTION_ITEMS_AND_PERIODS`
4. `LEGAL_REVIEW_REQUIRED — MINOR_POLICY`
5. 개인정보 보호책임자 또는 담당부서 공식 명칭 확인
6. Production account deletion purge 설정/정책 확인
7. Kakao/NAVER/Apple Provider lifecycle blocker 반영
8. 최종 시행일·document version 확정
9. 정확한 배포 HTML SHA-256 산출

그 전에는 `DO NOT PUBLISH`.