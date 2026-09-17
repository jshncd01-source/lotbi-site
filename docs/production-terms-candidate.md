# LOTBI 이용약관 — Final Production Candidate Record

기준일: 2026-09-17 (Asia/Seoul)

## Authoritative candidate

Production에 게시할 이용약관의 최종 review candidate는 별도 Markdown 초안이 아니라 다음 **exact Site HTML**이다.

- repository: `jshncd01-source/lotbi-site`
- branch: `site-legal-pages-social-auth-01-review`
- review HEAD: `3785844a54472523e9069c0a9b733f16b625daab`
- file: `terms.html`
- canonical URI: `https://lotbiai.com/terms.html`
- document version: `LOTBI_TERMS_2026-09-17_R1`
- exact UTF-8 SHA-256: `53ab6c93262f7fb46ee75504717fbdf99442ec8da1a98d12c6f54e9cc6865a6d`

Site review evidence:

- Legal Pages Review Gate `35202185023` = `SUCCESS`
- Public Site Review Gate `35202184989` = `SUCCESS`

## Approved/fixed policy included

The HTML includes:

- LOTBI account and Passkey/security contract
- Social Login signup/login/link/unlink boundaries
- no email-based automatic account merge
- D1 under-14 v1 signup unsupported + `만 14세 이상입니다 (필수)` confirmation
- account deletion lifecycle without an immediate-hard-delete promise
- FREE = monthly 3 successful tasks
- reset = day 1 at 00:00 `Asia/Seoul`/KST
- no carry-over
- LOCAL/failure/cancel/incomplete no-charge
- same-task retry no duplicate charge
- LOTBI Plus = KRW 9,900/month
- planned sales channels: Web Toss Payments / iPhone App Store / Android Google Play
- Plus live-sale details must be disclosed before billing activation
- LOTBI subscription fee separated from external Merchant transaction money
- service restriction/change/interruption/user responsibility/company responsibility/terms-change/dispute clauses

External counsel review is optional/recommended for higher-risk Plus/Merchant/overseas-processing issues, not a hard blocker for the free Social Login legal-page preparation.

## Production boundary

The review HTML is frozen for this candidate. If **any HTML byte changes**, including effective-date text, recompute SHA-256 and review the version before Core manifest deployment.

Actual Production publication still requires explicit user approval. Until that approval and publish occur, the live `https://lotbiai.com/terms.html` remains separate from this reviewed candidate.