# LOTBI 개인정보처리방침 — Final Production Candidate Record

기준일: 2026-09-17 (Asia/Seoul)

## Authoritative candidate

Production에 게시할 개인정보처리방침의 최종 review candidate는 별도 Markdown 초안이 아니라 다음 **exact Site HTML**이다.

- repository: `jshncd01-source/lotbi-site`
- branch: `site-legal-pages-social-auth-01-review`
- review HEAD: `3785844a54472523e9069c0a9b733f16b625daab`
- file: `privacy.html`
- canonical URI: `https://lotbiai.com/privacy.html`
- document version: `LOTBI_PRIVACY_2026-09-17_R1`
- exact UTF-8 SHA-256: `76f35a0816fe78e0ee035a380dfe5aa96059fcb478fe031b9a808b6f90b20a57`

Site review evidence:

- Legal Pages Review Gate `35202185023` = `SUCCESS`
- Public Site Review Gate `35202184989` = `SUCCESS`

## Approved policy included

D1 is incorporated:

- LOTBI v1 does not support signup under age 14.
- Signup/Social Signup completion requires `만 14세 이상입니다 (필수)`.
- This is not represented as government identity verification or guardian verification.

D2 is incorporated:

- 개인정보 보호책임자: `전선혜`
- email: `developer@lotbiai.com`
- phone: `063-237-0930`

The candidate also preserves the reviewed Social Auth minimum-data contract:

- Google `sub`
- Kakao `sub`
- NAVER `response.id`
- Apple `sub`
- Provider email/name/profile are not imported/stored as Social identity under the minimum contract
- user enters LOTBI name + handle directly
- Passkey/session/external identity/consent/account-deletion lifecycle disclosures

## Production boundary

The review HTML is frozen for this candidate. If **any HTML byte changes**, including displayed effective-date text, the SHA-256 must be recomputed and the version reviewed before Core manifest deployment.

External counsel review is optional/recommended risk review, not a Social Login hard blocker.

Actual Production publication still requires explicit user approval. Until that approval and publish occur, the live `https://lotbiai.com/privacy.html` remains separate from this reviewed candidate.