# LOTBI Production Legal Review — Official Source Register

> 상태: `OFFICIAL-SOURCE REGISTER READY / COUNSEL MUST REVERIFY BEFORE FINAL OPINION`
>
> 확인 기준일: 2026-09-17 (Asia/Seoul)

이 register는 decision-ready package 조사에 사용한 **공식 출처만** 정리한다. 공식 문서가 있다는 사실은 LOTBI의 법적 지위를 자동 확정하지 않는다. 최종 법률의견 시 counsel은 시행일·개정여부·LOTBI 사실관계를 다시 확인한다.

## 1. 대한민국 개인정보

| Source | Current basis used | Review topic |
|---|---|---|
| 국가법령정보센터 — 개인정보 보호법 | 2026-09-11 시행본 | 처리방침, 파기, 국외이전, 아동, CPO |
| 국가법령정보센터 — 개인정보 보호법 시행령 | current as of 2026-09-17 | Privacy 필수항목, CPO 예외, 국외이전 보호조치 |
| 개인정보보호위원회 — 개인정보 처리방침 작성지침 | 2026.4 개정 | public Privacy structure/content |
| 개인정보보호위원회 — 개인정보 처리방침 표준(안) | 2026.2 / 2026.7.24 수정본 확인 | Privacy model wording/checklist |
| 개인정보보호위원회 — 개인정보 보호책임자 지정·신고 실무 매뉴얼 | 2026.9 | CPO designation/disclosure |

Key provisions for counsel re-check:

- PIPA Art. 21: destruction when data becomes unnecessary, statutory-retention separation
- PIPA Art. 22-2: under-14 consent/guardian verification where consent is required
- PIPA Art. 28-8: overseas transfer including provision/outsourced processing/storage and transfer bases
- PIPA Art. 30: privacy policy required contents
- PIPA Art. 31 + Decree rules: privacy officer designation framework

Official portals:

- `https://www.law.go.kr/`
- `https://www.pipc.go.kr/`

## 2. 대한민국 전자상거래 / 약관

| Source | Current basis used | Review topic |
|---|---|---|
| 국가법령정보센터 — 전자상거래 등에서의 소비자보호에 관한 법률 | 2026-07-21 시행본 | business disclosure, recurring billing, withdrawal, intermediary duties |
| 전자상거래법 시행령 | current as of 2026-09-17 | transaction-record retention periods, intermediary dispute handling |
| 국가법령정보센터 — 약관의 규제에 관한 법률 | 2024-08-07 시행본 | disclosure/explanation, unfair terms, liability/jurisdiction |
| 공정거래위원회 | current official guidance/check service | ecommerce/business-information verification and consumer policy |

Counsel re-check areas:

- Ecommerce Act Art. 6 + Decree record periods
- Art. 13 contract/trading-condition and recurring-payment disclosures
- Art. 17-18 withdrawal/refund rules
- Art. 20 / 20-3 intermediary duties depending on actual role
- Terms Regulation Act Art. 3, 6 and jurisdiction/unfair-clause provisions

Official portals:

- `https://www.law.go.kr/`
- `https://www.ftc.go.kr/`

## 3. Social Login Providers

### Google

Official Google Identity / OAuth sources reviewed:

- OAuth production-readiness / policy-compliance guidance
- OAuth scope catalog
- Google API Services User Data Policy / privacy requirements

Key facts used:

- Production OAuth branding requires public app/home/privacy information and verified/authorized domains as applicable.
- Request only needed scopes.
- `openid`, `email`, `profile` are distinct standard scopes; LOTBI does not add email/profile merely for review convenience.
- Google remains `GOOGLE_SCOPE_CONTRACT_VERIFY = OPEN` until real configured-client E2E.

Official domains:

- `https://developers.google.com/identity/`
- `https://developers.google.com/identity/protocols/oauth2/`

### Kakao

Official Kakao Developers Kakao Login sources reviewed:

- Kakao Login concepts/common guide
- Unlink API / unlink webhook guidance

Key facts used:

- service unmapping/account deletion includes Kakao Unlink lifecycle;
- service user ID is treated as personal information in Kakao guidance and deletion/retention wording requires alignment;
- remote unlink is distinct from LOTBI local `REVOKED` state.

Official domain:

- `https://developers.kakao.com/docs/latest/en/kakaologin/common`

### NAVER

Official NAVER Developers Login source reviewed:

- NAVER Login development guide
- token revocation / disconnect callback sections

Key facts used:

- LOTBI canonical identity is official app-scoped `response.id` under current reviewed contract;
- service withdrawal/link termination requires token revocation/disconnect lifecycle verification.

Official domain:

- `https://developers.naver.com/docs/login/`

### Apple

Official Apple Developer sources reviewed:

- Sign in with Apple environment / REST auth documentation
- authorization revoke endpoint/lifecycle
- auto-renewable subscriptions and billing handling

Key facts used:

- Apple LOGIN contract is separate from currently blocked SIGNUP/LINK revocation lifecycle;
- subscription channel has Store-managed auto-renew/cancel/refund/billing states that must be reconciled with LOTBI entitlement.

Official domain:

- `https://developer.apple.com/`

## 4. Subscription / payment channels

### Toss Payments

Official Toss Payments Developer Center reviewed:

- Core API reference
- payment-method/refund policy guidance
- recurring/billing API documentation should be rechecked against the final merchant contract before launch

Official domain:

- `https://docs.tosspayments.com/`

Important boundary:

Toss technical API behavior does not itself determine LOTBI consumer-law refund/withdrawal wording. Counsel must combine Korean law, LOTBI product policy and actual Toss contract.

### Google Play

Official Android Developers Play Billing sources reviewed:

- subscription lifecycle
- manage purchases/subscriptions
- cancellation/refund/revocation
- grace period/account hold
- Real-time developer notifications

Official domain:

- `https://developer.android.com/google/play/billing/`

## 5. Infrastructure / processor contract sources

These sources help counsel classify actual Production relationships **only after engineering confirms that LOTBI Production actually uses the relevant service/plan/data path**.

| Vendor | Official source reviewed | Current conclusion |
|---|---|---|
| Render | Render DPA/subprocessor materials | DPA exists; repo has Singapore pilot blueprint, but Production region/contract not proven by pilot file |
| Vercel | Vercel DPA/subprocessor materials | processor framework exists for applicable plans; actual LOTBI plan/data location must be confirmed |
| GitHub | GitHub General Privacy Statement / service terms | source/CI role known; actual end-user PII in logs/artifacts must be separately checked |
| OpenAI | OpenAI business/API privacy commitments and DPA | API/business data policy/DPA exist; actual LOTBI Production payload, region and retention must be confirmed |

No legal classification row should be finalized merely because a vendor DPA says the vendor is a processor in a general customer relationship. Korean PIPA classification depends on LOTBI's actual processing flow and contract.

## 6. Source integrity rule

For final counsel approval:

1. prefer official law/government/provider/vendor contract sources;
2. record effective/revision date where available;
3. distinguish a Provider platform requirement from Korean-law requirement;
4. if official Provider Console behavior conflicts with documentation, record the conflict and obtain current official clarification rather than relying on community posts;
5. do not convert an engineering guess into a legal fact.
