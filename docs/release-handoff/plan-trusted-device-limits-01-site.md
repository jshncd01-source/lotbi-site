READY_FOR_DEPLOY=YES
MIGRATION=NO
DEPLOY_ORDER=CORE → WEB/SITE → APP(android-test만)
USER_DECISION_NEEDED=NONE (한도는 소유자 최종 확정값 Free 1 / Basic 2 / Plus 5 / Pro 15 — 배포총괄방 2026-10-09 "정책 최종 확정(소유자)" 전달)
SUPERSEDES=fb97516622da1de5c7335d05f3af81919a9aefd0 (이전 READY: Basic 1 / Plus 5 / Pro 15)

# plan-trusted-device-limits-01-site — release handoff

TASK=LOTBI MASTER 요금제별 신뢰 기기 정책 — 플랜 카드·비교표 문구(Site)
REPO=lotbi-site
FEATURE_BRANCH=feature/plan-trusted-device-limits-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD, `git ls-remote origin refs/heads/feature/plan-trusted-device-limits-01-site`로 확인)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=9e39edd06 (SITE-T38c 유치원·로그인 연속성 포함, feature에 정상 merge, drift 0)
CODE_SHA=b6b0e5051 (main 9e39edd06 merge d4dc1f871 → 한도 1/2/5/15 반영 b6b0e5051)
PAIRED_BRANCHES=lotbi-core feature/plan-trusted-device-limits-01-core · lotbi-web feature/plan-trusted-device-limits-01-web · lotbi-app feature/plan-trusted-device-limits-01-app
ASSET_TOKEN=이 branch는 asset 토큰을 바꾸지 않음 (subscribe.html 본문만 수정, asset_cache_version --check PASS aset-976965940207 = main 값)
THEME_TOKENS=site-theme-tokens.css 변경 없음 (Web gate theme-tokens 영향 없음)

## 이번 갱신(SUPERSEDES 이후)

- 소유자 최종 확정 한도를 반영했다.
  - Basic 카드: "최대 2대". 비교표 행: 최대 2대 / 5대 / 15대.
  - 비교표 아래에 요약 줄을 넣었다: "신뢰 기기 등록 한도: 무료 1대 / 베이직 2대 / 플러스 5대 / 프로 15대". 비교표에는 무료 열이 없어서 무료 1대는 이 줄로 안내한다.
- validator(scripts/validate_trusted_device_plan_limits_01.py)도 2/5/15와 요약 줄을 확인하도록 갱신했다.
- 최신 main 9e39edd06을 정상 merge했다. subscribe.html·site-review.yml은 자동 merge됐다.

## 구독 요금 branch와 같은 파일 (feature/subscription-price-proration-01-site 1107cfb5)

- 같은 파일:
  - subscribe.html. 이 branch는 카드 3줄·비교표 1행·요약 줄·안내를 추가하고, 구독 branch는 meta 가격·플랜 변경 안내·Plus 29,900원을 바꾼다.
  - .github/workflows/site-review.yml. 검사 단계가 서로 다른 자리에 있다.
- 시험 merge(`git merge-tree`, 이 branch HEAD × 1107cfb5):
  - 충돌 0건.
  - 합친 결과물에서 PASS: validate_trusted_device_plan_limits_01, validate_subscription_price_proration_01, validate_plan_usage_matrix_v1, validate_subscription_plan_banner_v1, validate_consumer_design_shell_01.
  - 29,900원, 플랜 변경 안내, 2/5/15 행, 요약 줄이 함께 들어간다.
- 먼저 READY된 쪽이 main에 들어가면, 늦은 쪽은 새 main에 다시 merge한다.

## 바뀐 것 (누적)

- subscribe.html
  - 카드: Basic 2 / Plus 5 / Pro 15.
  - 비교표 "신뢰 기기 등록" 행.
  - 한도 요약 줄(무료 1 / 베이직 2 / 플러스 5 / 프로 15).
  - 필수 안내 + "로그인한 브라우저나 로그인 횟수가 아니라 직접 동의해 등록한 기기 수"라는 설명.
  - 안심케어 프로필 1/5/15개 행은 그대로 둔다.
- site-review.yml에 검사 단계 1개를 추가했다(clean URL 검사 뒤).
- 가격·약관·환불·결제 흐름은 바꾸지 않았다.

## 소유자 지시 근거

- MASTER 1·4항(배너·비교표 문구, 필수 안내).
- 한도 숫자: 배포총괄방이 2026-10-09에 전달한 소유자 최종 확정값.

## 검증 (main 9e39edd06 merge 후)

- scripts/validate_*.py 18/18 PASS (`python -X utf8`).
- subscribe.html을 읽는 Node validator: 모두 PASS.
  - 예외: validate_mobile_footer_legal_sheet_01.mjs는 로컬 FAIL이다. main에서도 같은 FAIL이라 기존 로컬 RED이고, 이번 변경과는 무관하다.
- asset_cache_version.mjs --check PASS.
- 실기기·Production 화면: NOT TESTED.

## 상태

IMPLEMENTED · 로컬 검사 PASS · MERGED/DEPLOYED 아님(배포총괄방 담당)
