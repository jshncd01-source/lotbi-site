# PRODUCTION SOCIAL SIGNUP LEGAL / POLICY READINESS — DECISION MATRIX

> 기준일: 2026-09-17 (Asia/Seoul)
>
> 상태: `D1/D2 CLOSED / SITE LEGAL PAGES REVIEW GREEN / PRODUCTION PUBLISH PENDING`

## 1. Fixed technical/product/policy contracts

| Item | Status / contract |
|---|---|
| `TERMS_OF_SERVICE` | required, `ACCEPTED`, server-owned version/SHA/URI |
| `PRIVACY_POLICY` | required, `ACCEPTED`, server-owned version/SHA/URI |
| Separate manifest version | none; no `consent_manifest_version` |
| Google identity | `openid` + stable `sub`; email/name/profile unused |
| Kakao identity | `openid` + stable `sub`; email/name/profile unused |
| NAVER identity | `openid` + `response.id`; extra profile unused |
| Apple identity | stable `sub`; email/name scope unused |
| LOTBI signup input | user enters LOTBI name + handle |
| Same-email merge | prohibited |
| Passkey/session/security | reviewed contract retained |
| Account deletion | revoke access/session/authority → deletion lifecycle → final purge separate |
| FREE | monthly 3 successful tasks |
| FREE reset | every month day 1, 00:00 Asia/Seoul/KST |
| FREE carry-over | none |
| LOCAL/failure/cancel/incomplete | no charge |
| Same-task retry | no duplicate charge |
| Plus | KRW 9,900/month |
| Plus channels | Web Toss / iPhone App Store / Android Google Play |
| Merchant money | separate from LOTBI Plus subscription fee |

## 2. External legal counsel

Old hard-block rule is retired.

`LEGAL_COUNSEL_REVIEW = OPTIONAL / RECOMMENDED / NOT HARD BLOCKER`

Additional review remains recommended for overseas-processing classification, Merchant legal role, Plus refund/withdrawal and material liability allocation, but lack of outside-counsel approval does not block the fact-based free Social Login legal-page preparation.

## 3. User decisions

### D1 — CLOSED

`D1=A = APPROVED`

- v1 under-14 signup unsupported
- before signup/Social Signup completion: `만 14세 이상입니다 (필수)`
- not government identity verification or guardian verification
- under-14 support remains disabled until guardian consent/verification workflow exists

### D2 — CLOSED

`D2=A = APPROVED`

- 개인정보 보호책임자: 전선혜
- email: `developer@lotbiai.com`
- phone: `063-237-0930`

Therefore:

`FREE SOCIAL LOGIN USER POLICY DECISION GATE = CLOSED`

D3 Provider remote revoke is closed per Provider implementation/activation gate. D4/D5 Plus cancellation/grace remain paid-service-only decisions and do not block free Social Login.

## 4. Site legal-page decision

Fresh branch from latest Site main:

- base main: `e4314a2e6e8862f3ca1731465e0b3ca3b534a204`
- branch: `site-legal-pages-social-auth-01-review`
- review HEAD: `3785844a54472523e9069c0a9b733f16b625daab`
- draft PR: `#32`

CI at exact HEAD:

- Legal Pages Review Gate `35202185023` = `SUCCESS`
- Public Site Review Gate `35202184989` = `SUCCESS`

Decision:

`PRIVACY FINAL PRODUCTION CANDIDATE = REVIEW GREEN`

`TERMS FINAL PRODUCTION CANDIDATE = REVIEW GREEN`

`PRODUCTION PUBLISH = PENDING EXPLICIT USER APPROVAL`

## 5. Legal-document identity

| Key | Version | SHA-256 | URI |
|---|---|---|---|
| `TERMS_OF_SERVICE` | `LOTBI_TERMS_2026-09-17_R1` | `53ab6c93262f7fb46ee75504717fbdf99442ec8da1a98d12c6f54e9cc6865a6d` | `https://lotbiai.com/terms.html` |
| `PRIVACY_POLICY` | `LOTBI_PRIVACY_2026-09-17_R1` | `76f35a0816fe78e0ee035a380dfe5aa96059fcb478fe031b9a808b6f90b20a57` | `https://lotbiai.com/privacy.html` |

Hash authority rule:

- exact UTF-8 bytes from Site review HEAD
- values become Production authoritative only if those exact bytes are published unchanged and Production response is reverified
- any HTML-byte change requires recomputation and version review

## 6. Core manifest

`CORE SOCIAL SIGNUP CONSENT MANIFEST HANDOFF = READY`

`PRODUCTION DEPLOY = NOT PERFORMED`

After exact Site publication:

1. verify Production bytes/hash;
2. configure six `LOTBI_SOCIAL_TERMS_*` / `LOTBI_SOCIAL_PRIVACY_*` values;
3. keep Provider activation false;
4. verify `/v2/sessions/providers/signup/consents`;
5. verify `/v2/sessions/providers/readiness` signup consent state;
6. run Core regression/CI.

## 7. Account signup

Existing Terms/Privacy required consents remain.

D1 addition:

`만 14세 이상입니다 (필수)`

Status:

`ACCOUNT AGE/CONSENT CONTRACT HANDOFF = READY`

`ACCOUNT IMPLEMENTATION GREEN = NOT YET CLAIMED`

No Provider email/name/profile import and no email-based account merge may be introduced.

## 8. Provider technical blockers

| Provider | Status |
|---|---|
| Google | `GOOGLE_SCOPE_CONTRACT_VERIFY = OPEN` |
| Kakao | `UNLINK + USER_ID DELETION/PURGE` blocker open |
| NAVER | `TOKEN_REVOCATION / DISCONNECT` blocker open |
| Apple LOGIN | review-ready |
| Apple SIGNUP/LINK | lifecycle blocker open |

## 9. Gate conclusion

External counsel is not the blocker.

Current blocking sequence before Google Console/user E2E:

1. explicit user approval to publish Site legal pages;
2. exact Production bytes verified;
3. Core Production consent manifest deployed/verified;
4. Account D1 age confirmation + legal-consent flow implemented/verified;
5. Provider-specific prerequisites.

Current:

- `SITE LEGAL PAGES = REVIEW GREEN`
- `CORE MANIFEST = READY / NOT DEPLOYED`
- `ACCOUNT HANDOFF = READY / IMPLEMENTATION VERIFY PENDING`
- `USER_ACTION_REQUIRED — GOOGLE STEP 1 = NOT YET`.