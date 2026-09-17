# LOTBI Social Signup Consent Manifest — Production Handoff

> 상태: `REVIEWED HTML VALUES READY / PRODUCTION NOT DEPLOYED / PROVIDER ACTIVATION FALSE`
>
> 기준일: 2026-09-17 (Asia/Seoul)
>
> Site legal review branch: `site-legal-pages-social-auth-01-review`
>
> Site review HEAD: `3785844a54472523e9069c0a9b733f16b625daab`
>
> Core Social review: `b555420b8d75c9e241a6cd9bd534f205499a87d8`
>
> Account Social review: `5eadea164d559a4f3c45dfca18d6c2acf95a40c0`

## 1. Canonical consent contract

Social Signup 필수 LOTBI 동의는 정확히 두 개다.

1. `TERMS_OF_SERVICE`
2. `PRIVACY_POLICY`

각 문서는 다음 세 값을 가진다.

- `document_version`
- `document_sha256`
- `document_uri`

별도 `consent_manifest_version`은 만들지 않는다.

두 consent 모두:

- `required=true`
- `decision=ACCEPTED`

가 필수다.

## 2. Reviewed final HTML values

Site review HEAD의 **exact UTF-8 file bytes**에서 CI가 직접 산출한 값이다.

### TERMS_OF_SERVICE

- `LOTBI_SOCIAL_TERMS_VERSION=LOTBI_TERMS_2026-09-17_R1`
- `LOTBI_SOCIAL_TERMS_SHA256=53ab6c93262f7fb46ee75504717fbdf99442ec8da1a98d12c6f54e9cc6865a6d`
- `LOTBI_SOCIAL_TERMS_URI=https://lotbiai.com/terms.html`

### PRIVACY_POLICY

- `LOTBI_SOCIAL_PRIVACY_VERSION=LOTBI_PRIVACY_2026-09-17_R1`
- `LOTBI_SOCIAL_PRIVACY_SHA256=76f35a0816fe78e0ee035a380dfe5aa96059fcb478fe031b9a808b6f90b20a57`
- `LOTBI_SOCIAL_PRIVACY_URI=https://lotbiai.com/privacy.html`

Evidence:

- Legal Pages Review Gate run `35202185023` = `SUCCESS`
- Public Site Review Gate run `35202184989` = `SUCCESS`

These values are **review-authoritative for the frozen Site review HTML**. They become Production authoritative only if the exact same HTML bytes are published unchanged and the Production HTTPS response is verified against the source.

If either HTML file changes before publication, recompute SHA-256 and, when the legal document version must change, issue a new version.

## 3. Expected Production manifest shape

```json
{
  "required": true,
  "documents": [
    {
      "consent_key": "PRIVACY_POLICY",
      "document_version": "LOTBI_PRIVACY_2026-09-17_R1",
      "document_sha256": "76f35a0816fe78e0ee035a380dfe5aa96059fcb478fe031b9a808b6f90b20a57",
      "document_uri": "https://lotbiai.com/privacy.html"
    },
    {
      "consent_key": "TERMS_OF_SERVICE",
      "document_version": "LOTBI_TERMS_2026-09-17_R1",
      "document_sha256": "53ab6c93262f7fb46ee75504717fbdf99442ec8da1a98d12c6f54e9cc6865a6d",
      "document_uri": "https://lotbiai.com/terms.html"
    }
  ]
}
```

## 4. Core environment contract

Terms:

- `LOTBI_SOCIAL_TERMS_VERSION`
- `LOTBI_SOCIAL_TERMS_SHA256`
- `LOTBI_SOCIAL_TERMS_URI`

Privacy:

- `LOTBI_SOCIAL_PRIVACY_VERSION`
- `LOTBI_SOCIAL_PRIVACY_SHA256`
- `LOTBI_SOCIAL_PRIVACY_URI`

Readiness 방에서는 Production env를 변경하지 않는다.

## 5. Core validation contract retained

Core Social Signup complete는 정확히 두 consent를 요구하고 다음을 검증한다.

- consent key
- document version
- SHA-256
- HTTPS URI
- `decision=ACCEPTED`
- `required=true`
- locale

검증된 evidence는 `UserConsentRecord`에 `source=SOCIAL_SIGNUP`으로 저장한다. Browser가 version/hash/URI를 임의로 정하도록 바꾸지 않는다.

## 6. Account Web contract retained + D1 handoff

기존 필수 UI:

- `이용약관 동의 (필수)`
- `개인정보 처리방침 동의 (필수)`

두 문서 모두 동의하지 않으면 가입 진행 불가.

추가 승인정책 D1:

- Social Signup completion 전에 `만 14세 이상입니다 (필수)` 확인을 요구한다.
- false/미확인 상태에서는 가입 completion을 허용하지 않는다.
- 정부 신원확인 또는 법정대리인 확인으로 표현하지 않는다.
- Terms/Privacy document consent와 age-policy confirmation을 서로 다른 의미로 유지한다.

Account 구현/검증은 owning Account Web workstream에서 수행한다. 이 readiness 문서는 구현 GREEN을 허위로 선언하지 않는다.

## 7. Production deployment order

1. Site review GREEN — **DONE BY REVIEW**
2. 사용자 Production legal-page publish 승인
3. exact reviewed `privacy.html` / `terms.html`을 Production에 publish
4. Production HTTPS response bytes 재검증
5. 위 version/SHA/URI와 동일함을 확인
6. 사용자 승인된 Core Production manifest env 설정
7. `GET /v2/sessions/providers/signup/consents` 두 문서 검증
8. `GET /v2/sessions/providers/readiness`에서 `signup_consent_configured=true` 검증
9. Account Production Signup manifest/age confirmation 검증
10. Provider별 real E2E 진행

Provider activation은 manifest 설정과 별도다. `LOTBI_SOCIAL_<PROVIDER>_PRODUCTION_ACTIVATION=true`를 자동으로 만들지 않는다.

## 8. Current status

- D1 = `APPROVED / CLOSED`
- D2 = `APPROVED / CLOSED`
- Site legal pages = `REVIEW GREEN`
- exact reviewed version/hash/URI = `READY`
- Production publish = `NOT PERFORMED`
- Production manifest = `NOT DEPLOYED`
- Provider activation = `UNCHANGED / FALSE UNLESS SEPARATELY APPROVED`

`CORE SOCIAL SIGNUP CONSENT MANIFEST HANDOFF = READY`.