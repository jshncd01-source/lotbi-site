# LOTBI 개인정보처리방침 — Production User-Approval Candidate

> 상태: `TECHNICALLY / POLICY READY FOR USER APPROVAL / EXTERNAL COUNSEL OPTIONAL / DO NOT PUBLISH`
>
> 기준일: 2026-09-17 (Asia/Seoul)
>
> Core Social review: `b555420b8d75c9e241a6cd9bd534f205499a87d8`
>
> Account Social review: `5eadea164d559a4f3c45dfca18d6c2acf95a40c0`
>
> User decisions: `docs/production-user-policy-decisions.md`
>
> Data inventory: `docs/production-personal-data-processing-inventory.md`

이 후보는 외부 변호사 승인서를 Production 선행조건으로 요구하지 않는다. 실제 LOTBI 코드/제품정책, 현재 시행 법령과 Provider 공식 문서를 기준으로 작성한다.

외부 법률전문가 검토는 국외이전·Merchant 지위·유료서비스 환불 등 복잡한 영역의 추가 risk review로 권장하지만 Social Login Privacy 공개의 필수 인증 gate가 아니다.

실제 Production 게시 전 남은 것은:

1. 사용자 결정 `D1`, `D2` 확정;
2. 게시 시점 실제 Production infrastructure/processor/data-location 기술검증;
3. 최종 HTML freeze/version/SHA-256;
4. 사용자 Production publish 승인.

---

# 개인정보처리방침

유한회사 알에이디홀딩스(이하 “회사”)는 LOTBI(롯비) 서비스를 제공하면서 이용자의 개인정보를 보호하고 관련 고충을 처리하기 위해 다음과 같이 개인정보처리방침을 공개합니다.

**시행일: [FINAL HTML PUBLISH DATE에서 확정]**

## 1. 개인정보 처리 목적

회사는 다음 목적에 필요한 범위에서 개인정보를 처리합니다.

- LOTBI 회원계정 생성·식별·관리
- LOTBI 이름 및 계정 아이디(handle) 관리
- Passkey 등록·인증 및 계정 보안
- Social Login 회원가입·로그인·외부계정 연결
- 이용약관·개인정보처리방침 동의 확인 및 증빙
- 로그인 세션·설치정보·인증흐름 관리
- 부정접근·계정탈취·재사용·replay 방지와 보안감사
- 회원탈퇴·계정삭제·외부계정 연결해제 처리
- 서비스 문의 및 개인정보 관련 고충처리
- 실제 활성화된 경우 FREE 사용량, LOTBI Plus 구독 및 결제상태 관리

## 2. 처리하는 개인정보 항목

### 2.1 이용자가 LOTBI에 직접 입력하는 정보

회원가입 시:

- LOTBI 이름
- LOTBI 계정 아이디(handle)

이 값들은 Social Login Provider에서 가져오는 이름·프로필과 구분됩니다.

### 2.2 Social Login Provider별 최소 식별정보

현재 reviewed Social Auth 계약은 다음 최소값만 Social identity로 사용합니다.

| Provider | 요청/사용 계약 | LOTBI가 계정식별에 사용하는 값 | 현재 Social identity로 사용하지 않는 정보 |
|---|---|---|---|
| Google | `openid` | Google OIDC `sub` | 이메일, 이름, 프로필 |
| Kakao | `openid` | Kakao OIDC `sub` | 이메일, 닉네임, 프로필 등 추가 개인정보 |
| NAVER | `openid` | 공식 profile API의 `response.id` | 이메일, 이름, 전화번호, 생일, 성별 등 추가 profile |
| Apple | email/name scope 미사용 | Apple `sub` | 이메일, private relay email, full name |

Provider 인증과정에서는 authorization code, ID/access token 등 인증용 material이 일시 처리될 수 있습니다. 현재 계약상 Provider email/name/profile을 LOTBI Social identity로 영구 저장하지 않습니다.

Apple SIGNUP/LINK는 별도 revocation lifecycle 구현이 완료되기 전 활성화하지 않습니다.

### 2.3 계정·인증·보안 정보

현재 Core/Account 계약에서 처리되는 정보에는 다음이 포함됩니다.

- LOTBI 내부 user/account identifier와 account state
- Social Login Provider 종류와 `provider_subject`
- external identity 상태
- ClientInstallation 식별자·platform·상태
- UserSession 식별자·token hash·assurance level·만료/revoke 상태
- Passkey credential identifier, public key, sign counter, transports 등 공개키 인증 metadata
- Terms/Privacy consent key, document version, SHA-256, URI, decision, required flag, locale, source 및 관련 evidence
- 인증·보안·삭제 lifecycle의 감사기록
- AccountDeletionRequest 및 처리상태/receipt 관련 metadata

비밀번호, Passkey private key, Provider client secret, OAuth client secret, `.p8` private key 같은 비밀정보는 공개 정책상 계정 개인정보 항목으로 수집하는 값이 아니며 서비스가 사용자에게 이메일로 제출하도록 요구하지 않습니다.

### 2.4 FREE usage / Plus / payment

확정된 FREE 제품정책은 매월 3개의 성공 작업이며 메시지 수나 AI Provider call 수와 동일하지 않습니다.

FREE usage ledger, Plus subscription entitlement, payment-provider reference의 **실제 Production 저장필드가 구현/활성화되는 경우** 그 실제 필드와 보유기간을 게시본에 반영합니다. 현재 확인되지 않은 task content 저장을 임의로 고지하지 않습니다.

## 3. 개인정보의 처리 및 보유기간

회사는 목적 달성에 필요한 기간 동안 개인정보를 처리합니다.

### 계정 기본정보

LOTBI 이름, handle 및 활성 계정정보는 회원계정 유지기간 동안 처리하고, 회원탈퇴/계정삭제 lifecycle이 완료되면 관계 법령상 별도 보존이 필요한 기록을 제외하고 파기합니다.

### Social Login identity

Provider identity는 해당 Social Login이 계정에 연결된 기간 동안 처리합니다.

외부계정 연결 해제 시 현재 LOTBI Core는 external identity를 local `REVOKED` 상태로 전환합니다. 계정탈취·잘못된 재연결을 막기 위한 제한된 보안 reservation이 필요한 경우에도 목적에 필요한 범위로 제한하며, account deletion/final purge와 Provider별 공식 삭제정책을 적용합니다.

Kakao/NAVER/Apple은 각 Provider 공식 lifecycle 구현이 완료된 뒤 해당 Provider를 활성화합니다.

### Session / auth flow

Session은 만료 또는 revoke 시까지, 일회성 authentication flow/challenge는 해당 인증목적의 짧은 유효기간 또는 소비 시점까지 처리합니다. Social flow cookie의 reviewed 최대 flow lifetime은 300초입니다.

### Consent / security / deletion evidence

동의증빙, 보안감사 및 계정삭제 처리기록은 해당 계정의 동의·보안·삭제 상태를 증명하고 분쟁 또는 법령상 의무에 대응하기 위해 필요한 기간 동안 최소 범위로 보존할 수 있습니다.

### 법정 거래기록

LOTBI Plus 또는 적용되는 전자상거래가 활성화되는 경우 관계 법령상 보존대상에 해당하는 기록은 법정기간 동안 일반 계정정보와 분리하여 보존할 수 있습니다. 현재 전자상거래법 시행령은 적용되는 거래에서 표시·광고 6개월, 계약/청약철회 5년, 대금결제·재화공급 5년, 소비자 불만·분쟁 3년의 기록보존 기준을 두고 있습니다. 실제 LOTBI record가 어떤 범주에 해당하는지는 해당 기능의 실제 거래역할에 맞춰 적용합니다.

## 4. 개인정보의 파기

처리목적이 달성되고 보유 필요성이 종료된 개인정보는 복구하기 어렵도록 삭제 또는 파기합니다.

LOTBI는 다음 lifecycle을 같은 것으로 취급하지 않습니다.

1. Social Login 연결 해제
2. LOTBI 계정 삭제 요청
3. 법령/분쟁대응상 별도 보존
4. Provider authorization revoke/unlink
5. 최종 purge

계정 삭제 요청이 접수되면 먼저 계정 접근, 활성 session/authority, external identity local access를 revoke하고 deletion lifecycle을 시작합니다. 모든 데이터가 요청 즉시 한 번에 hard delete된다고 약속하지 않습니다.

최종 purge 시 법정 보존이 필요한 기록은 별도 분리보관하고 그 외 정보는 처리목적이 끝난 범위에서 파기합니다.

## 5. Social Login 연결·해제 및 Provider lifecycle

기존 LOTBI 계정에 Provider identity를 추가하는 `LINK`는 신규 Signup과 별도 절차입니다. Provider email이 기존 계정과 같다는 이유만으로 자동 병합하지 않습니다.

현재 Provider lifecycle 상태:

- Google: minimum scope real E2E verification pending (`GOOGLE_SCOPE_CONTRACT_VERIFY`)
- Kakao: Unlink + service user-id deletion/purge lifecycle 구현 전 Provider activation 금지
- NAVER: token revocation + disconnect notification lifecycle 검증 전 Provider activation 금지
- Apple: LOGIN contract ready; SIGNUP/LINK는 revocation-token lifecycle 구현 전 금지

사용자가 Social Login 연결을 해제하거나 LOTBI 계정을 삭제할 때 Provider-side authorization까지 revoke하는 정책은 `docs/production-user-policy-decisions.md`의 `D3`에서 정하며, 각 Provider 공식 계약과 실제 기술구현이 준비된 범위에서 적용합니다.

## 6. 외부 서비스, 처리위탁, 제3자 제공 및 국외이전

### Social Login Provider

이용자가 Social Login을 선택하면 Google, Kakao, NAVER 또는 Apple의 인증서비스로 이동하거나 해당 Provider와 인증통신이 이루어집니다. Provider 자체 계정 및 인증화면에서의 개인정보 처리는 각 Provider의 개인정보 정책에도 적용됩니다.

LOTBI는 현재 위 Provider로부터 제2.2항의 최소 식별정보를 받아 계정인증에 사용하며, Provider email/name/profile을 review 편의를 위해 추가 수집하지 않습니다.

단순히 외국계 Provider를 사용한다는 이유만으로 LOTBI의 모든 데이터 흐름을 일률적으로 “제3자 제공” 또는 “처리위탁”으로 표시하지 않습니다. 실제 LOTBI가 개인정보를 외부 사업자에게 제공·처리위탁·보관하는 flow는 아래 Production technical manifest를 기준으로 게시합니다.

### Production infrastructure / AI / payment processor table — [TECHNICAL PUBLISH CHECK]

Production publish 직전 Core/Web/App 실제 배포설정과 계약을 확인하여 **활성 사용 중인 사업자만** 다음 형식으로 `privacy.html`에 넣습니다.

| 사업자 | 실제 역할 | 처리 항목 | 목적 | 처리/이전 국가 | 보유기간/종료조건 | 근거/고지 방식 |
|---|---|---|---|---|---|---|
| 실제 Production hosting/database provider | VERIFY | VERIFY | 서비스 hosting/database | VERIFY | 계약/계정 삭제 정책에 따른 기간 | 실제 계약 기준 |
| 실제 Account Web hosting provider | VERIFY | VERIFY | Account Web 제공 | VERIFY | 실제 계약 기준 | 실제 계약 기준 |
| 활성 AI Provider | 활성화된 경우만 | 서비스 수행에 필요한 최소 task payload | AI 기능 수행 | provider contract 기준 | provider contract/LOTBI 설정 기준 | 실제 데이터 flow 기준 |
| Toss Payments | Web Plus 활성화된 경우만 | 결제/구독에 필요한 최소정보·reference | 결제/정기결제 | 실제 계약 기준 | 법령/계약 기준 | 실제 결제계약 기준 |
| Apple App Store / Google Play | 해당 Store 판매 활성화 시 | Store transaction/subscription reference | 구독 판매·entitlement | Store 정책 기준 | 법령/Store 정책 기준 | 실제 판매채널 기준 |

이 표의 `VERIFY`는 **외부 counsel 대기항목이 아니라 engineering/contract fact verification 항목**입니다. 실제 Production 값을 확인하지 않은 vendor를 Privacy에 사용 중이라고 허위 표시하지 않습니다.

개인정보 보호법 제28조의8상 실제 개인정보 국외 제공·처리위탁·보관이 발생하는 경우에는 적용 가능한 국외이전 근거에 맞춰 이전항목, 국가, 시기·방법, 수령자, 목적·기간 등 필요한 사항을 게시본에 구체적으로 반영합니다.

`LEGAL_COUNSEL_REVIEW_RECOMMENDED`: 복잡한 국외이전/processor 구조는 추가 법률검토를 권장하지만 외부 변호사 인증 자체는 Social Login launch hard gate가 아닙니다.

## 7. 정보주체의 권리 및 행사방법

이용자는 관계 법령에 따라 개인정보 열람, 정정·삭제, 처리정지 및 동의철회 등을 요청할 수 있습니다.

- LOTBI 계정 삭제 안내: `https://lotbiai.com/account-deletion.html`
- 계정/개인정보 문의: `developer@lotbiai.com`
- 대표전화: `063-237-0930`

Social Login 연결 해제와 LOTBI account deletion은 서로 다른 기능입니다.

## 8. 안전성 확보조치

현재 reviewed Social/Auth 계약에는 다음과 같은 보안경계가 포함됩니다.

- HTTPS callback
- HttpOnly/Secure/SameSite authentication cookie
- state/nonce/PKCE 또는 Provider별 동등한 인증검증
- issuer/audience/provider subject 검증
- one-time flow/binding/replay 방지
- Passkey 기반 인증/step-up
- session/authority revoke 및 audit evidence

내부 secret, token, private key 또는 보안설정의 민감한 값을 Privacy에 공개하지 않습니다.

## 9. 만 14세 미만 이용자 — [USER DECISION D1]

현재 reviewed signup에는 법정대리인 동의 workflow가 없습니다.

**추천 Production 기본안:**

`LOTBI v1은 만 14세 미만 이용자의 회원가입을 지원하지 않습니다. 회원가입 시 이용자는 만 14세 이상임을 확인해야 하며, 만 14세 미만임이 확인된 경우 계정 생성을 진행하지 않습니다.`

사용자가 `D1=A`를 승인하면 위 문구를 최종 게시본에 고정하고 Account/App/Core에 최소 age-confirmation gate 구현을 handoff합니다.

만 14세 미만 가입을 허용하는 `D1=B`를 선택하면 법정대리인 동의·확인 workflow가 구현되기 전에는 해당 가입을 열지 않습니다.

## 10. 개인정보 보호책임자 및 문의 — [USER DECISION D2]

현재 회사 일반정보:

- 회사명: 유한회사 알에이디홀딩스
- 대표자: 전선혜
- 주소: 전북특별자치도 전주시 덕진구 혁신로 542, 1동 1층 (여의동)
- 사업자등록번호: 583-88-03679
- 통신판매업신고번호: 2026-전주덕진-0798
- 이메일: `developer@lotbiai.com`
- 대표전화: `063-237-0930`

**추천 Production 기본안:**

- 개인정보 보호책임자: 전선혜
- 개인정보 문의: `developer@lotbiai.com`
- 전화: `063-237-0930`

사용자가 `D2=A`를 승인하면 위 값으로 확정합니다. 별도 담당자/부서를 지정하려면 `D2=B`로 실제 정보를 입력합니다.

## 11. 방침의 변경

본 방침이 변경되는 경우 관계 법령과 변경 중요도에 따라 적용일과 변경내용을 서비스 또는 공식사이트에 고지합니다.

Social Signup은 사용자가 동의한 당시 Terms/Privacy의 `document_version`, SHA-256, HTTPS URI를 Core server-owned manifest와 함께 evidence로 보존하는 계약을 사용합니다.

---

# Production publication gate

외부 counsel 승인서는 필수 gate가 아니다.

게시 전 필수:

1. `D1` 및 `D2` 사용자 결정;
2. 실제 Production infrastructure/processor/data-location technical manifest 검증;
3. Provider별 활성화하려는 lifecycle blocker의 기술검증;
4. 최종 HTML에 검토용 marker/VERIFY placeholder가 남지 않았는지 확인;
5. 시행일/document version 확정;
6. exact UTF-8 HTML bytes SHA-256 산출;
7. 사용자 Production publish 승인.

현재 상태:

`PRODUCTION PRIVACY = TECHNICALLY / POLICY READY FOR USER APPROVAL`

`EXTERNAL LEGAL COUNSEL = OPTIONAL / RECOMMENDED, NOT HARD BLOCKER`

`PRODUCTION PUBLISH = PENDING USER APPROVAL`.