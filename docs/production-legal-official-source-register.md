# LOTBI Production Privacy / Terms — Official Source Register

> 상태: `OFFICIAL-SOURCE REGISTER READY / INTERNAL COMPLIANCE PRIMARY / COUNSEL OPTIONAL`
>
> 확인 기준일: 2026-09-17 (Asia/Seoul)

이 register는 Production Privacy/Terms와 Social Login readiness에 사용한 **공식 출처만** 기록한다.

우선순위:

1. 국가법령정보센터
2. 개인정보보호위원회
3. 공정거래위원회
4. Google/Kakao/NAVER/Apple 공식 개발자 문서
5. 실제 계약 상대방의 공식 DPA/정책/개발문서

외부 counsel은 복잡한 해석에 대한 추가 risk review로 권장될 수 있으나, 이 register의 공식 근거를 적용한 사실기반 Social Login Privacy/Terms 준비의 필수 인증 gate가 아니다.

---

## 1. 대한민국 개인정보

### 개인정보 보호법

Current basis:

- 시행: **2026-09-11**
- 법률 제21445호 (2026-03-10 일부개정)

Key provisions used:

- Art. 21: 불필요한 개인정보의 파기 및 다른 법률상 보존의 분리
- Art. 22: 동의사항 구분
- Art. 22-2: 만 14세 미만 아동 개인정보 처리 시 법정대리인 동의/확인
- Art. 28-8: 국외 제공·처리위탁·보관을 포함한 국외이전과 허용근거
- Art. 30: 개인정보처리방침 필수 내용
- Art. 31: 개인정보 보호책임자 지정, 소상공인 예외 시 대표자 책임 구조

Official portal:

`https://www.law.go.kr/`

### 개인정보 보호법 시행령

Current basis:

- 시행: **2026-09-11**
- 대통령령 제36671호 (2026-09-10 일부개정)

Key use:

- CPO designation/exemption rules
- small-business exception framework
- security measures and overseas-transfer subordinate rules

### 개인정보보호위원회

Use current official Privacy-policy/CPO guidance where applicable.

Official portal:

`https://www.pipc.go.kr/`

---

## 2. 대한민국 전자상거래

### 전자상거래 등에서의 소비자보호에 관한 법률

Current basis:

- 시행: **2026-07-21**
- 법률 제21312호 (2026-01-20 일부개정)

Key provisions used:

- Art. 6: transaction record retention framework
- Art. 13: seller identity/trading-condition disclosure
- Art. 13(6): recurring-payment price increase or free→paid conversion consent/notice

### 시행령

Current basis:

- 시행: **2026-07-21**

Current transaction record periods for applicable transactions:

- 표시·광고: 6개월
- 계약/청약철회: 5년
- 대금결제/재화 공급: 5년
- 소비자 불만/분쟁: 3년

Current recurring-payment rule:

- 가격 인상 또는 무료→유료 정기결제 전환 관련 법정 고지/동의 기간: 30일

Official portals:

- `https://www.law.go.kr/`
- `https://www.ftc.go.kr/`

---

## 3. Google OAuth

Official Google Identity production-readiness sources reviewed:

- OAuth policy compliance / production readiness
- brand verification
- scope catalog / authorization guidance

Facts used:

- Production OAuth app has public homepage requirement.
- Home/privacy/terms/redirect domains used in OAuth must align with authorized/verified domains as required.
- Privacy must explain how Google user data is accessed/used/stored/shared.
- Request only scopes needed for the feature.
- LOTBI current reviewed code requests `openid` and uses stable `sub`; email/profile scope expansion is not authorized by this readiness room.

Status:

`GOOGLE_SCOPE_CONTRACT_VERIFY = OPEN` until real configured-client E2E.

Official domain:

`https://developers.google.com/identity/`

---

## 4. Kakao Login

Official Kakao Developers sources:

- Kakao Login Concepts/Common
- REST API Unlink
- Unlink webhook / account-status lifecycle

Facts used:

- account deletion/unmapping flow includes Kakao Unlink;
- Unlink withdraws service consent and revokes tokens;
- Kakao service user ID is described as personal information;
- Kakao guidance says user information including service user ID must be destroyed on service account deletion, with special handling if retention is required;
- external unlink can be reconciled with webhook.

Status:

`KAKAO_PROVIDER_LIFECYCLE_BLOCKER` remains technical.

Official domain:

`https://developers.kakao.com/`

---

## 5. NAVER Login

Official NAVER Developers sources:

- Login development guide
- Login API specification
- Web application Login guide

Facts used:

- current OIDC authorization uses `scope=openid`;
- LOTBI canonical identity uses official app-scoped `response.id` under current reviewed contract;
- `/oauth2.0/revoke` revokes access/refresh token pair;
- official guide includes service disconnect notification callback.

Status:

`NAVER_PROVIDER_LIFECYCLE_BLOCKER — TOKEN_REVOCATION/DISCONNECT INTEGRATION VERIFY`.

Official domain:

`https://developers.naver.com/docs/login/`

---

## 6. Apple

Official Apple Developer sources:

- Sign in with Apple REST API
- token revocation endpoint
- App Store subscription/billing lifecycle docs

Fact used:

`POST https://appleid.apple.com/auth/revoke` invalidates tokens/associated user authorization when the user is no longer associated with the app.

Status:

- LOGIN contract: review-ready
- SIGNUP/LINK: blocked until revocation-material lifecycle is implemented

Official domain:

`https://developer.apple.com/`

---

## 7. Subscription/payment official sources

### Toss Payments

Use official Developer Center/reference and actual LOTBI merchant contract before Plus Web activation.

`https://docs.tosspayments.com/`

### Apple App Store

Use Apple official auto-renewable subscription and billing/refund lifecycle.

### Google Play

Use Android Developers Play Billing lifecycle/manage-purchases/RTDN documentation.

These channel policies do not replace Korean consumer-law requirements.

---

## 8. Infrastructure / AI official contract sources

These sources are evidence only **after engineering confirms actual Production use**.

### Render

Official Render region documentation confirms services/datastores can be deployed in regions including Singapore, but a repo pilot blueprint does not prove LOTBI Production region.

### Vercel

Current Vercel DPA describes Vercel as processor for Customer Data for covered Pro/Enterprise relationships and contains cross-border/subprocessor terms. Actual LOTBI plan/data path must be verified before listing Vercel in public Privacy.

### OpenAI API/business services

OpenAI business/API DPA provides processor terms for Customer Data under covered business/API services. OpenAI's current subprocessor list identifies possible processing locations. Actual LOTBI Production provider, payload, retention setting and contract must be verified before public disclosure.

### GitHub

Repository/CI use alone does not mean end-user personal data is stored in GitHub. Verify logs/artifacts/evidence before listing a privacy-processing relationship.

---

## 9. Source application rule

1. Official law/provider source outranks blogs/community posts.
2. Apply only requirements that match an actual LOTBI data/function flow.
3. Do not turn a vendor's generic DPA into proof that LOTBI currently uses that vendor/region.
4. Do not turn Provider policy into a Korean-law legal classification that it does not make.
5. When official sources permit more than one lawful/product path, choose a conservative product policy and record it as a user decision.
6. External counsel review can be added for high-risk ambiguity, but lack of counsel certification does not reset technically verified facts or automatically block Social Login preparation.

Current policy:

`LEGAL_COUNSEL_REVIEW = OPTIONAL / RECOMMENDED / NOT HARD BLOCKER`.