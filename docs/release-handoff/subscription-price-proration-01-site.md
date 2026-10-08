READY_FOR_DEPLOY=YES

# subscription-price-proration-01-site — release handoff

TASK=LOTBI 구독 요금 변경(Plus 29,900원) + 플랜 일할 정산 P0 — Site 공개 요금·정책 문구
REPO=lotbi-site
FEATURE_BRANCH=feature/subscription-price-proration-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote origin refs/heads/feature/subscription-price-proration-01-site`)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=ee8c1b6fef4ec11c0bf642f60b0e7ddead067b2e (feature에 정상 merge 완료, drift 0)
CODE_SHA=3fc4e017fdf4c1c15a94d3fb75a9260a7ec096e7
PAIRED_BRANCHES=lotbi-core/web/app feature/subscription-price-proration-01-*

## SCOPE

- subscribe.html
  - Plus 카드와 meta description을 29,900원으로 바꿨다.
  - 플랜 변경 안내 한 줄을 추가했다: 상위 플랜은 남은 기간 차액만 일할 결제하고 즉시 적용, 결제일 유지. 하위 플랜은 다음 결제일부터 적용, 결제·환불 없음.
- refund.html 제6조
  - Plus를 29,900원으로 바꿨다.
  - "요금표 변경은 새 가입·플랜 변경에 적용하고, 이용 중 구독은 아래 사전 안내·동의 절차 없이 인상하지 않는다"를 추가했다. 기존 30일 전 동의 조항을 다시 쓴 것이다.
  - `#plan-change` 문단을 추가했다(Core plan-proration-v1과 같은 내용).
    - 실제 선납 금액 기준
    - 결제 전 예정액 표시
    - 결제 완료 후 적용, 미결제면 플랜 유지
    - 하위 플랜은 다음 결제일부터, 예약 취소 가능
    - 앱스토어는 스토어 정책을 따름
- terms.html 제8조: Plus 금액 한 단어만 19,900원 → 29,900원으로 바꿨다(잠금 문서라 최소 변경).
  - `scripts/validate_hardening.py`에서 terms.html 잠금 해시를 다시 고정하고 주석을 달았다.
  - Social Signup 약관 개정 버전을 `LOTBI_TERMS_2026-10-08_R1`로 올렸다(`scripts/emit_social_signup_legal_manifest.py`).
- 검증 스크립트
  - 19,900을 고정하던 validator 5개를 29,900 고정 + 이전 가격 금지로 바꿨다.
  - 신규 `scripts/validate_subscription_price_proration_01.py`를 추가하고 site-review.yml에 등록했다.
- asset 토큰은 바뀌지 않았다(CSS/JS 변경 없음).

## SAFETY

- 가격 표시와 정책 문구만 바꿨다. 결제 동작은 바꾸지 않았다.
- LIVE_MONEY=OFF
- MIGRATION=NO
- ENV_CHANGE_REQUIRED=YES — Production Core env를 배포와 함께 갱신해야 한다.
  - `LOTBI_SOCIAL_TERMS_VERSION=LOTBI_TERMS_2026-10-08_R1`
  - `LOTBI_SOCIAL_TERMS_SHA256` = 배포할 release commit에서 `python scripts/emit_social_signup_legal_manifest.py`가 출력하는 값
  - 해시는 terms.html 원본 바이트(asset 토큰 포함) 기준이다. 그래서 release의 asset 토큰을 갱신한 뒤에 계산해야 한다.
  - 갱신하지 않으면 소셜 가입 동의 증빙이 이전 약관 해시를 가리킨다. 로그인과 가입 동작은 막히지 않는다(Core는 값을 기록만 함).

## TEST_STATUS (merge 후 다시 실행)

- PASS 목록
  - validate_subscription_price_proration_01
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
- 로컬 불안정: validate_mobile_footer_legal_sheet_01(Chrome) 실패가 변경 전과 후 모두에서 번갈아 나타났다(`block≠none` / `undefined≠true`). 이 PC의 부하 문제로 판단하며 Linux gate에서 확인이 필요하다.
- NOT TESTED: 실기기 브라우저

NEW_FAILURES=0 (로컬 불안정 1건 제외)

## DEPLOY_ORDER

- APP → WEB → CORE → SITE(또는 CORE와 같은 train).
- Site만 먼저 나가면 공개 요금(29,900)과 Account 결제 확인 창(Core 카탈로그 19,900)이 어긋난다.

USER_DECISION_NEEDED=Production `LOTBI_SOCIAL_TERMS_VERSION`·`LOTBI_SOCIAL_TERMS_SHA256` env 갱신 (위 SAFETY 참조)
