# LOTBI 개인정보처리방침 — Production Counsel-Ready Candidate

> 상태: `COUNSEL-READY / LEGAL_REVIEW_REQUIRED / DO NOT PUBLISH`
>
> 작성 기준일: 2026-09-17 (Asia/Seoul)
>
> Core Social review: `b555420b8d75c9e241a6cd9bd534f205499a87d8`
>
> Account Social review: `5eadea164d559a4f3c45dfca18d6c2acf95a40c0`
>
> 상세 fact inventory: `docs/production-personal-data-processing-inventory.md`
>
> 법률질문: `docs/production-legal-review-questionnaire.md`

## 검토 표시

- `[TECHNICALLY VERIFIED]`: 코드·공개사이트·확정 제품정책에서 확인된 사실
- `[LEGAL REVIEW REQUIRED]`: 법률전문가의 법적 분류/근거/최종문구 필요
- `[USER DECISION REQUIRED]`: 사용자/회사 운영결정이 필요
- `[PLACEHOLDER — DO NOT PUBLISH]`: 실제 Production 공개 전에 반드시 확정/제거해야 하는 placeholder

이 후보는 외부 법률전문가에게 전달하기 위한 문서이며 법률검토 완료본이 아니다.

---

# 개인정보처리방침

유한회사 알에이디홀딩스(이하 “회사”)는 LOTBI(롯비) 서비스를 제공하면서 이용자의 개인정보를 보호하고 관련 고충을 처리하기 위하여 개인정보처리방침을 수립·공개합니다.

**시행일: [PLACEHOLDER — DO NOT PUBLISH / LEGAL REVIEW REQUIRED — FINAL_DOCUMENT_EFFECTIVE_DATES]**

## 1. 개인정보의 처리 목적

### 1.1 LOTBI 계정 생성 및 관리 — [TECHNICALLY VERIFIED]

회사는 다음 목적을 위해 필요한 계정·인증 정보를 처리합니다.

- LOTBI 회원계정 생성 및 식별
- LOTBI 이름 및 계정 아이디(handle) 관리
- 이용약관 및 개인정보처리방침 동의 확인과 증빙
- Passkey 등록·인증, 계정복구 및 보안
- 로그인 세션과 설치/기기 연결 상태 관리
- Social Login 연결·연결해제
- 회원탈퇴/계정삭제 요청 및 삭제 lifecycle 처리
- 인증 위변조·재사용·세션 탈취·부정이용 방지

### 1.2 Social Login — [TECHNICALLY VERIFIED]

이용자가 선택하는 경우 Google, Kakao, NAVER 또는 Apple 인증을 LOTBI 회원가입·로그인·계정 연결에 사용할 수 있습니다.

Provider 인증 성공은 LOTBI 이용약관 또는 개인정보처리방침 동의를 대신하지 않습니다. 신규 Social Signup은 LOTBI가 제시하는 이용약관과 개인정보처리방침에 각각 필수 동의해야 합니다.

### 1.3 FREE 이용량 및 유료구독 — [PRODUCT POLICY VERIFIED / IMPLEMENTATION VERIFY REQUIRED]

LOTBI FREE는 매월 3개의 **성공 작업** 정책을 사용합니다. 이는 메시지/질문/AI Provider 호출 3회를 의미하지 않습니다. 최종 사용자 결과가 성공적으로 전달된 작업만 차감하고 LOCAL/실패/취소/미완료/retry는 제품정책에 따라 별도 또는 중복 차감하지 않습니다.

FREE usage ledger와 LOTBI Plus subscription/payment schema의 실제 Production 저장필드가 확정되면 본 방침의 처리항목·목적·보유기간을 실제 구현과 일치시키도록 갱신합니다.

`[LEGAL REVIEW REQUIRED — FREE usage/subscription event의 개인정보 해당범위와 보존기간]`

## 2. 처리하는 개인정보 항목

### 2.1 이용자가 LOTBI에 직접 입력하는 계정정보 — [TECHNICALLY VERIFIED]

Social Signup을 포함한 신규 계정 생성 시 이용자가 LOTBI에 직접 입력하는 정보:

- LOTBI 이름
- LOTBI 계정 아이디(handle)

이는 Social Login Provider에서 가져오는 이름·닉네임과 구분됩니다.

### 2.2 Social Login Provider별 최소 식별정보 — [TECHNICALLY VERIFIED]

| Provider | 현재 reviewed LOTBI가 identity로 사용하는 값 | 현재 Social identity로 사용하지 않는 Provider 정보 |
|---|---|---|
| Google | OIDC `sub` | 이메일, 이름, profile 정보 |
| Kakao | OIDC `sub` | 카카오계정 이메일, 닉네임/profile 등 추가정보 |
| NAVER | 공식 profile API의 app-scoped `response.id` | 이메일, 이름, 전화번호, 생일/출생연도, 성별, 연령대 등 추가 profile |
| Apple | Apple `sub` | 이메일, private relay email, 전체 이름 |

현재 reviewed Web scope는 Google/Kakao/NAVER가 `openid`이고 Apple은 email/name profile scope를 요청하지 않습니다.

Google `openid` 최소 scope는 실제 configured-client E2E가 남아 있으며, 기술검증 전 email/profile scope를 임의 추가하지 않습니다.

Apple LOGIN contract는 review-ready이나 Apple SIGNUP/LINK는 revocation lifecycle이 구현·검증되기 전 활성화하지 않습니다.

### 2.3 계정·인증·동의 증빙 — [TECHNICALLY VERIFIED]

서비스는 계정·인증 및 보안을 위해 다음 정보를 처리할 수 있습니다.

- LOTBI 내부 사용자/계정 식별자 및 계정 상태
- Social Login Provider 종류와 `provider_subject`
- external identity 연결상태
- ClientInstallation 식별정보·platform·상태 등 설치 lifecycle 정보
- UserSession 식별자, installation 연결, authentication assurance/status, 만료/폐기 정보
- Passkey credential ID, 공개키, sign counter, transports, credential 상태 등 서버 검증용 metadata
- 이용약관/개인정보처리방침 동의 key, document version, SHA-256, HTTPS URI, decision, required 여부, locale, 동의 출처/flow/installation evidence
- AccountDeletionRequest 및 deletion lifecycle evidence
- 보안·거래·관리자 행위에 필요한 audit event

Passkey의 **개인키 또는 기기 생체정보 자체를 LOTBI 서버가 보관한다고 기재하지 않습니다.**

### 2.4 OAuth/OIDC 과정의 일시정보 — [TECHNICALLY VERIFIED]

OAuth/OIDC 과정에서는 authorization code, ID/access token 등 Provider 인증정보가 서버에서 일시 처리될 수 있습니다. 현재 최소 Social identity 계약은 이를 Provider 이메일/profile과 같은 영구 계정정보로 취급하지 않습니다.

Apple SIGNUP/LINK의 future revoke에 필요한 장기 revocation material은 아직 GREEN이 아니며, 구현 시 암호화된 최소 권한 material만 lifecycle 목적에 맞춰 보관하도록 별도 검토합니다.

### 2.5 브라우저 인증 쿠키 — [TECHNICALLY VERIFIED]

- `__Host-lotbi_session`: Account Web 로그인 세션 유지용 HttpOnly/Secure 쿠키
- `__Host-lotbi_social_flow`: Social Login callback 흐름을 연결하는 단기 HttpOnly/Secure 쿠키; reviewed flow 최대수명 300초

현재 위 쿠키는 로그인/인증 목적의 필수 쿠키이며 광고·행태분석 선택쿠키로 설명하지 않습니다.

### 2.6 향후 또는 구현검증 필요 항목

다음은 제품정책/서비스계획에 포함되지만 현재 이 법률패키지에서 Production schema까지 확정됐다고 표시하지 않습니다.

- ConsumerDeviceSession 예정 구조
- FREE usage event 및 compensation/credit adjustment
- LOTBI Plus subscription entitlement/event
- Toss/App Store/Google Play payment/subscription reference
- AI Provider에 전송되는 실제 task payload 범위

`[LEGAL REVIEW REQUIRED + TECHNICAL INVENTORY REQUIRED]` 실제 schema와 Production data flow가 정해진 뒤 처리항목·보유기간·외부처리 관계를 확정합니다.

## 3. 개인정보의 처리 및 보유기간

### 3.1 활성계정 — [TECHNICALLY VERIFIED / PERIOD LEGAL REVIEW REQUIRED]

LOTBI 이름, handle, 계정·인증정보 및 활성 Social identity는 계정 서비스 제공에 필요한 기간 동안 처리합니다.

### 3.2 Social Login 연결해제와 provider_subject

현재 generic unlink는 LOTBI 계정을 유지하고 해당 external identity를 local `REVOKED`로 전환하며 관련 제한 session/미완료 flow를 정리합니다. Provider 계정 자체 삭제와 동일하지 않습니다.

현재 Core는 다른 LOTBI 계정으로의 silent takeover/reassignment 방지를 위해 unlink 후에도 Provider + subject unique reservation을 유지합니다.

`[LEGAL REVIEW REQUIRED — PROVIDER_SUBJECT_RETENTION_BASIS_AND_PERIOD]`

법률전문가가 다음을 확정해야 합니다.

- retention 법적근거
- 최대 보존기간/종료조건
- account deletion 후 처리
- final purge 시 원문삭제·비가역 변환·별도 보안보존 중 허용 방식
- Kakao 등 Provider별 삭제정책과의 정합성

### 3.3 계정삭제 요청 — [TECHNICALLY VERIFIED]

계정삭제 요청이 접수되면 즉시 모든 데이터를 hard delete한다고 약속하지 않습니다. 현재 lifecycle은 우선:

- 계정 접근 차단
- 활성 UserSession revoke
- 활성 authority/grant revoke
- external identity local revoke
- Passkey/installation/challenge/push 등 관련 authority lifecycle 정리
- 미완료 Social Auth flow 취소 및 민감 material 제거
- deletion lifecycle 시작

후 별도 final purge로 진행합니다.

### 3.4 final purge 기간

`[LEGAL REVIEW REQUIRED — PRODUCTION_PURGE_PERIOD]`

source default 숫자를 Production 약속으로 사용하지 않습니다. 일반 계정정보, backup/log, security evidence, 법정보존기록을 구분해 실제 보유기간과 삭제방식을 확정해야 합니다.

### 3.5 법령상 보존

`[LEGAL REVIEW REQUIRED — STATUTORY_RETENTION_ITEMS_AND_PERIODS]`

전자상거래법 등 실제 적용되는 법령이 요구하는 거래·결제·청약철회·소비자분쟁 기록은 법적근거와 필요한 범위에서 일반 계정정보와 구분하여 보존할 수 있습니다. LOTBI Plus와 외부 Merchant 거래 각각에 실제 적용되는 record/기간을 counsel이 확정해야 합니다.

## 4. 개인정보 파기 절차 및 방법

처리목적 달성, 보유기간 경과 등으로 개인정보가 불필요해진 경우 관계 법령상 보존의무가 없는 정보는 복구가 어렵도록 삭제 또는 파기합니다.

다음 lifecycle은 같은 시점/같은 작업이라고 단정하지 않습니다.

- Social Login local unlink
- LOTBI account deletion request
- Provider authorization revoke/unlink
- statutory retention
- final purge
- provider_subject security reservation 처리

`[LEGAL REVIEW REQUIRED]` 전자정보 삭제, backup/log 격리 및 최종파기 방법의 공개수준을 실제 Production infrastructure에 맞춰 확정합니다.

## 5. Social Login Provider 연결 및 lifecycle

### 5.1 LINK — [TECHNICALLY VERIFIED]

기존 LOTBI 계정에 Provider identity를 연결하는 LINK는 신규 Social Signup과 별개이며 현재 reviewed contract는 FULL LOTBI session과 fresh proof를 요구합니다. Provider 이메일 동일성만으로 자동 merge하지 않습니다.

### 5.2 UNLINK — [TECHNICALLY VERIFIED / PROVIDER BLOCKED]

현재 generic unlink는 local `REVOKED`이고 remote Provider revoke가 아닙니다.

- Google: real E2E/Production revoke policy verification pending
- Kakao: `KAKAO_PROVIDER_LIFECYCLE_BLOCKER — UNLINK + USER_ID DELETION/PURGE POLICY REQUIRED`
- NAVER: `NAVER_PROVIDER_LIFECYCLE_BLOCKER — TOKEN_REVOCATION/DISCONNECT INTEGRATION VERIFY`
- Apple: `APPLE_SOCIAL_AUTH_LIFECYCLE_BLOCKER`

`[LEGAL REVIEW REQUIRED — DELETION_RETENTION_AND_PROVIDER_LIFECYCLE]` remote revoke를 unlink/account deletion에 어떻게 연결할지 Provider별로 확정합니다.

## 6. 제3자 제공·처리위탁·국외이전

`[PLACEHOLDER — DO NOT PUBLISH]`

`[LEGAL REVIEW REQUIRED — THIRD_PARTY_PROCESSING_AND_OVERSEAS_TRANSFER]`

현재 조사만으로 Google/Kakao/NAVER/Apple, Render, Vercel, GitHub, OpenAI, Toss Payments, Apple App Store, Google Play의 관계를 일괄 `제3자 제공`, `처리위탁` 또는 `국외이전 없음`으로 확정하지 않습니다.

최종 공개본에는 실제 Production data-flow manifest와 계약/DPA를 기준으로 해당되는 경우 다음을 반영해야 합니다.

- 제공·위탁·이전받는 자
- 처리/이전 국가 또는 location
- 개인정보 항목
- 목적
- 시점/방법
- 보유·이용기간
- 법적근거
- 별도 동의가 필요한 경우 거부방법/효과

## 7. 정보주체의 권리와 행사방법

이용자는 관계 법령이 정하는 범위에서 열람, 정정·삭제, 처리정지, 동의철회 등 권리를 행사할 수 있습니다.

LOTBI account deletion은 `https://lotbiai.com/account-deletion.html`에 안내된 Account Web 공식 절차를 사용합니다.

Social Login unlink와 LOTBI account deletion은 서로 다른 절차입니다.

`[LEGAL REVIEW REQUIRED]` 대리인, 본인확인, 처리기간 및 이의/고충 절차의 최종문구를 확정합니다.

## 8. 개인정보의 안전성 확보조치

### [TECHNICALLY VERIFIED]

현재 reviewed auth 계약의 보안경계에는 다음이 포함됩니다.

- HTTPS callback/transport
- HttpOnly/Secure/SameSite 인증쿠키
- Provider issuer/audience/subject 등 검증
- state/nonce/PKCE 또는 Provider별 동등 검증
- flow binding/replay 방지
- Passkey step-up
- session/authority revoke
- append-only consent evidence
- secret/token 값의 public policy 노출 금지

보안상 상세한 secret, signing key, API key, raw credential 값은 개인정보처리방침에 공개하지 않습니다.

## 9. 개인정보 보호책임자 및 문의

### [TECHNICALLY VERIFIED — company/contact]

- 운영회사: 유한회사 알에이디홀딩스
- 대표자: 전선혜
- 주소: 전북특별자치도 전주시 덕진구 혁신로 542, 1동 1층 (여의동)
- 사업자등록번호: 583-88-03679
- 통신판매업신고번호: 2026-전주덕진-0798
- 서비스/개인정보 문의: `developer@lotbiai.com`
- 대표전화: `063-237-0930`

### [USER DECISION REQUIRED — PRIVACY_OFFICER_OR_DEPARTMENT]

`[PLACEHOLDER — DO NOT PUBLISH] 개인정보 보호책임자 성명 또는 개인정보 보호업무 담당부서의 공식 명칭 및 연락처`

법률전문가는 개인정보 보호책임자 지정의무/예외 여부와 최종 공개필드를 확인해야 합니다.

## 10. 만 14세 미만 이용자

`[USER DECISION REQUIRED + LEGAL REVIEW REQUIRED — MINOR_POLICY]`

현재 reviewed signup에는 만14세 미만 age gate 또는 법정대리인 동의 flow가 구현됐다고 확인되지 않았습니다.

가장 단순한 v1 후보는 **만14세 미만 회원가입 제한**이지만 아직 채택/구현된 정책으로 표시하지 않습니다. counsel 검토 후 사용자 결정과 Core/Account/App 기술변경이 필요합니다.

## 11. 방침의 변경과 Social Signup evidence

Social Signup은 이용자가 본 당시 Terms/Privacy의 `document_version`, SHA-256, HTTPS URI와 동의 evidence를 Core server-owned manifest에 결합합니다.

`[LEGAL REVIEW REQUIRED — FINAL_DOCUMENT_EFFECTIVE_DATES]` 적용일, 사전고지 기간, 기존회원 재동의/공지 필요범위를 확정합니다.

## 12. Publication gate

이 문서는 **counsel-ready**이나 다음 조건 전에는 Production에 공개하지 않습니다.

- Q01~Q36 관련 필요한 legal decisions 반영
- CPO/담당부서 확정
- minor policy 확정 및 필요한 구현 준비
- Production infrastructure/provider/payment data-flow inventory 확정
- provider_subject/purge/statutory retention 확정
- Provider lifecycle blocker에 맞는 최종 문구 반영
- 시행일·document version 확정
- final `privacy.html` exact bytes freeze 및 SHA-256 산출
- 사용자 명시적 Production publish 승인

현재:

`PRODUCTION PRIVACY CANDIDATE = COUNSEL-READY`

`PRODUCTION PUBLISH = NONE`
