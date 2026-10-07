READY_FOR_DEPLOY=YES

# subscribe-account-checkout-handoff-01-site — release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/subscribe-account-checkout-handoff-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ... refs/heads/feature/subscribe-account-checkout-handoff-01-site`)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=a9affcd5ac887239778e37347cd4d68fbe4ad948
CODE_SHA=e96bb4d9397e248452891a3a17d007ed86d2e865
ASSET_VERSION=aset-b9ed102b1cc7
PAIRED_BRANCH=lotbi-web feature/subscribe-account-checkout-handoff-01-web (code 85e64e0104b5a0092b36de5cc47b8360a1a51055)

## SCOPE

- /subscribe 카드 CTA(Basic 시작하기 / Plus 시작하기 / Pro로 업그레이드)가 `https://account.lotbiai.com/account?checkout=<plan>` 링크가 된다(JS 없이도 동작).
- 하단 "구매하기"는 선택한 등급을 허용 목록(basic|plus|pro)으로만 바꿔 같은 주소로 이동한다. 선택이 없거나 허용 밖 값이면 이동하지 않고 "먼저 등급을 하나 선택해 주세요."를 보인다.
- "지금 결제가 되나요" 첫 문단을 실제 흐름(로그인 → 결제 확인 화면 → 마지막 결제하기에서 실제 결제·청구 없음)으로 고침. 상단 "실제 결제와 자동갱신이 열려 있지 않습니다." 고지와 결제 고지 항목 문단은 유지.
- 카드 링크 스타일은 `.plan-picker .plan-grid .plan-card a.plan-card-cta`로 범위를 좁혀 `.legal .section a` 밑줄이 붙지 않게 함. 390/1280px에서 Production과 카드·CTA 크기·좌표 동일.
- 신규 `scripts/validate_subscribe_account_checkout_handoff_01.mjs`(site-review.yml 등록): 링크 3개 고정 URL, 허용 목록, 가격·return 주소·결제 호출 없음, 고지 문구, subscribe.js를 가짜 DOM에서 실행해 플랜별 이동과 악의적 값 차단 확인.
- asset token 재계산(aset-b9ed102b1cc7) — subscribe 외 파일은 `?v=` 토큰만 바뀜.

## SAFETY

Site는 결제·로그인·가격 판단을 하지 않는다. 가격과 return URL은 넘기지 않는다. LIVE_MONEY=OFF, CORE_CHANGED=NO, ENV_CHANGE_REQUIRED=NO, MIGRATION=NO.

## TEST_STATUS

- 신규 validator PASS, asset_cache_version --check PASS, scripts/validate_*.py 16/16 PASS(validate_site, clean_urls, accessibility, plan_usage_matrix_v1, refund_subscription_policy_alignment_01, subscription_plan_banner_v1, legal_pages 포함), sync_footer_business_info --check PASS.
- 실제 브라우저(로컬 정적 서버): "Plus 시작하기" 클릭 → account.lotbiai.com/account?checkout=plus, Pro 선택 후 구매하기 → …?checkout=pro 이동 확인.
- NOT RUN: 브라우저(CDP) 기반 site-review mjs validator 전체 — subscribe 화면과 무관한 홈/대화/캘린더 영역.

NEW_FAILURES=0

## DEPLOY_ORDER

lotbi-web branch(85e64e01) 배포 후 Site 배포. 반대 순서면 로그인 사용자가 Account 일반 설정 화면에 머문다.

USER_DECISION_NEEDED=NONE
