READY_FOR_DEPLOY=YES
SUPERSEDES=02892cd4e029183c86c166d060592dc9f088c84c
ALEMBIC_HEADS=N/A (Site에는 migration 없음. Core branch는 1개: p0_0107_subscription_plan_changes)
OLD_APP_COMPAT=N/A (Site는 /v2/subscription의 price를 읽지 않음. site-core.js는 plan·status·free_units만 사용)
ENV_CHANGE_REQUIRED=YES — Production Core env 3+3개를 Site 배포 뒤 갱신(아래 BLOCKER 4). 로그인·가입 동작에는 영향 없음
USER_DECISION_NEEDED=약관 env 갱신 승인. PRIVACY env도 같은 기회에 실제 서빙본 값으로 정정할지 여부(이미 어긋나 있음)

# subscription-price-proration-01-site — release handoff

TASK=LOTBI 구독 요금 변경(Plus 29,900원) + 플랜 일할 정산 P0 — Site 공개 요금·정책 문구 (배포총괄 사전 gate BLOCKED 수정본)
REPO=lotbi-site
FEATURE_BRANCH=feature/subscription-price-proration-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote origin refs/heads/feature/subscription-price-proration-01-site`)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=fa6ed88d3608536050de0fb56136ae9b920a4c55 (SITE-T36 이후, feature에 정상 merge e266734e — rebase·force push 없음)
ASSET_VERSION=aset-1349a7eafa03 (main과 같음. 이 branch는 CSS/JS를 바꾸지 않음. `node scripts/asset_cache_version.mjs --check` PASS)
CODE_SHA=c69dc11e4f91d60c6f508c1dc4c1ce6d28b53583
PAIRED_BRANCHES=lotbi-core / lotbi-web / lotbi-app feature/subscription-price-proration-01-*

## SCOPE (이전 READY와 같음)

- subscribe.html: Plus 29,900원(카드·meta), 플랜 변경 안내 한 줄.
- refund.html 제6조: Plus 29,900원, 요금표 변경은 새 가입·플랜 변경에 적용(이용 중 구독은 사전 안내·동의 없이 인상하지 않음), `#plan-change` 문단.
- terms.html 제8조: Plus 금액 한 단어만 19,900원 → 29,900원.
  - `validate_hardening.py`에서 terms.html 잠금 값을 다시 고정했다. 다른 잠금 파일은 건드리지 않았다.
  - 약관 개정 버전: `LOTBI_TERMS_2026-10-08_R1`.
- 19,900을 고정하던 validator를 29,900 기준으로 바꿨다. 신규 `validate_subscription_price_proration_01.py`를 추가했다.

## BLOCKER 4 — 약관 hash 설계 (수정)

- 문제
  - `emit_social_signup_legal_manifest.py`가 terms.html·privacy.html의 원본 바이트를 해시했다.
  - 원본 바이트에는 asset 토큰이 들어 있어서, Site를 배포할 때마다 해시가 바뀌었다.
- 수정: 해시 대상을 정규화한 문서로 바꿨다.
  - 정규화 규칙(`validate_hardening.py`의 법적 페이지 잠금과 같은 규칙):
    1. UTF-8, 줄바꿈을 LF로 통일
    2. asset 토큰 제거: `(\.(?:js|mjs|css))\?v=[A-Za-z0-9._-]+` → `\1`
    3. 승인된 chooser bootstrap 블록을 한 번 제거
    4. 결과를 UTF-8로 SHA-256
  - 그래서 해시는 잠금 값과 같고, 문서 본문이 바뀔 때만 바뀐다.
  - 신규 `scripts/validate_social_legal_manifest_01.py`(legal-pages-review.yml 등록)가 세 가지를 확인한다: 해시 == 잠금 값, 토큰·줄바꿈을 바꿔도 해시 불변, 본문 한 글자를 바꾸면 해시 변경.
  - `--check-served <origin>` 옵션: 서빙 중인 페이지와 저장소 해시를 비교한다.
- 이 branch가 내보내는 값(Core env에 넣을 값)
  ```
  LOTBI_SOCIAL_TERMS_VERSION=LOTBI_TERMS_2026-10-08_R1
  LOTBI_SOCIAL_TERMS_SHA256=c3da41cf8bf81b0a3c6ac431a2f9de54fe573f04b573ce1f167b95add539e93f
  LOTBI_SOCIAL_TERMS_URI=https://lotbiai.com/terms
  LOTBI_SOCIAL_PRIVACY_VERSION=LOTBI_PRIVACY_2026-09-24_R1
  LOTBI_SOCIAL_PRIVACY_SHA256=c1a0be94cf8165c9c0b26d5b1c31fc3f91516ef30abb0bfcf6c2a6b8c0098545
  LOTBI_SOCIAL_PRIVACY_URI=https://lotbiai.com/privacy
  ```
- 현재 Production과의 대조(2026-10-09, 읽기 전용: Core 공개 `GET /v2/sessions/providers/signup/consents` + 서빙 페이지)
  - TERMS: Production env는 `LOTBI_TERMS_2026-09-17_R1` / `53ab6c93262f7fb46ee75504717fbdf99442ec8da1a98d12c6f54e9cc6865a6d` / `https://lotbiai.com/terms.html`
    - 서빙 약관 원본 해시는 `675ce237…`, 정규화 해시는 `4614bccf…`다.
    - 결과: 이미 MISMATCH다. 이전 배포 때부터 어긋나 있었던 것이다.
  - PRIVACY: Production env는 `LOTBI_PRIVACY_2026-09-17_R1` / `76f35a0816fe78e0…` / `https://lotbiai.com/privacy.html`
    - 서빙 원본 해시는 `4435779f…`, 정규화 해시는 `c1a0be94…`(저장소와 같음)다.
    - 결과: env 값만 이미 MISMATCH다.
  - 이 branch를 배포하면 약관 본문이 바뀐다. 그러면 TERMS 정규화 해시가 `c3da41cf…`가 된다.
- 영향
  - Core는 동의 문서 값을 env에서 읽어 `/signup/consents`로 내준다. 화면은 그 값을 그대로 돌려보내고 Core가 비교한다.
  - 그래서 env를 바꿔도 가입은 막히지 않는다(새 값으로 함께 바뀜). env를 바꾸지 않으면 동의 증빙이 옛 문서를 가리키는 문제만 남는다.
- 배포 절차
  1. SITE 배포
  2. `python scripts/emit_social_signup_legal_manifest.py --check-served https://lotbiai.com` → TERMS·PRIVACY 모두 MATCH 확인
  3. 위 값으로 Core env 갱신(USER_DECISION)
  4. Core 재배포 후 `GET /v2/sessions/providers/signup/consents` 값 확인

## TEST_STATUS (main fa6ed88d merge 후 다시 실행)

- PASS
  - validate_subscription_price_proration_01
  - validate_social_legal_manifest_01
  - validate_plan_usage_matrix_v1
  - validate_subscription_plan_banner_v1
  - validate_refund_subscription_policy_alignment_01
  - validate_legal_pages
  - validate_site
  - validate_hardening
  - validate_accessibility
  - validate_clean_urls
  - validate_consumer_design_shell_01
  - validate_subscribe_account_checkout_handoff_01
  - validate_static_pages_theme_01
  - sync_footer_business_info --check
  - sync_theme_bootstrap --check
  - asset_cache_version --check
- 로컬 불안정(이전과 같음): validate_mobile_footer_legal_sheet_01(Chrome)은 변경 전·후 모두에서 번갈아 실패했다. Linux gate에서 확인이 필요하다.
- NOT TESTED: 실기기 브라우저

## 19,900 잔존(Site)

- 이전 가격을 금지하는 validator 문구와 잠금 재고정 주석, 그리고 과거 handoff 문서(`docs/REFUND_SUBSCRIPTION_POLICY_ALIGNMENT_01_HANDOFF.md`)에만 남아 있다.
- 공개 페이지(subscribe·refund·terms)에는 없다(validator로 확인).

## DEPLOY_ORDER

- WEB → CORE → SITE(또는 CORE와 같은 train) → 약관 env 갱신.
- Site만 먼저 나가면 공개 요금(29,900)과 Account 결제 확인 창(Core 카탈로그)이 어긋난다.
