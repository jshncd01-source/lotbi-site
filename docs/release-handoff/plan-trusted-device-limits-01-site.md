READY_FOR_DEPLOY=YES
MIGRATION=NO
DEPLOY_ORDER=CORE → WEB/SITE → APP(android-test만)
USER_DECISION_NEEDED=NONE (표시 수치는 소유자 MASTER 지시 그대로. 근거는 아래 "소유자 지시 근거")

# plan-trusted-device-limits-01-site — release handoff

TASK=LOTBI MASTER 요금제별 신뢰 기기 정책 — 플랜 카드·비교표 문구(Site)
REPO=lotbi-site
FEATURE_BRANCH=feature/plan-trusted-device-limits-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD, `git ls-remote origin refs/heads/feature/plan-trusted-device-limits-01-site`로 확인)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=ddcc573dca61 (SITE-T37 반복 일정 포함, feature에 정상 merge, drift 0)
CODE_SHA=4cdaa1bc5 (코드 418834366 → main ddcc573dc merge 1fe9078d6 → CI 단계 위치 이동 4cdaa1bc5)
PAIRED_BRANCHES=lotbi-core feature/plan-trusted-device-limits-01-core · lotbi-web feature/plan-trusted-device-limits-01-web · lotbi-app feature/plan-trusted-device-limits-01-app
ASSET_TOKEN=변경 없음 (subscribe.html 본문만 수정, asset_cache_version --check PASS aset-f0f202fb6c78)
THEME_TOKENS=site-theme-tokens.css 변경 없음 (Web gate theme-tokens 영향 없음)

## 배포 순서

- 정적 문구만 바뀌므로 Core 계약과 무관하다.
- 다만 Core 정책보다 먼저 공개하면 안내와 실제 동작이 어긋난다. 그래서 CORE 다음(WEB과 같은 단계)에 배포한다.

## 구독 요금 branch와 같은 파일 (feature/subscription-price-proration-01-site 1107cfb5)

- subscribe.html
  - 이 branch: 카드 3줄 + 비교표 1행 + 안내 1문단.
  - 구독 branch: meta 가격, 플랜 변경 안내, Plus 29,900원.
- .github/workflows/site-review.yml
  - 두 branch 모두 검사 단계를 추가한다.
  - 처음엔 같은 자리라 충돌했다. 이 branch 단계를 clean URL 검사 뒤로 옮겨(4cdaa1bc5) 해소했다.
- 시험 merge 결과(`git merge-tree`, 이 branch HEAD × 1107cfb5):
  - 충돌 0건.
  - 합친 결과물에서 PASS: validate_trusted_device_plan_limits_01, validate_subscription_price_proration_01, validate_plan_usage_matrix_v1, validate_subscription_plan_banner_v1, validate_consumer_design_shell_01.
  - 합친 결과물에 29,900원·플랜 변경 안내·신뢰 기기 1/5/15대 행이 함께 있다.
- 먼저 READY된 쪽이 main에 들어가면, 늦은 쪽은 새 main에 다시 merge한다.

## 바뀐 것

- subscribe.html
  - Basic·Plus·Pro 카드: "신뢰 기기 등록 최대 1대 / 5대 / 15대".
  - 전체 기능 비교표에 "신뢰 기기 등록" 행.
  - 비교표 아래 필수 안내: "신뢰 기기 등록은 선택 사항이며, 등록하지 않아도 일반 로그인으로 LOTBI를 이용할 수 있습니다."
  - 같은 문단에 덧붙인 설명: 신뢰 기기 수는 로그인한 브라우저나 로그인 횟수가 아니라, 직접 동의해 등록한 기기 수다.
  - 안심케어 프로필 1/5/15개 행은 별개로 그대로 둔다.
- 새 validator scripts/validate_trusted_device_plan_limits_01.py를 추가하고 site-review.yml에 단계 1개를 넣었다.
- 가격·약관·환불·결제 흐름은 바꾸지 않았다. Site에는 기기 관리 화면이 없다.

## 소유자 지시 근거

- 2026-10-09 "[LOTBI MASTER — 요금제별 신뢰 기기 정책 및 플랜 배너 개편]" 1항(1/5/15)과 4항(비교표·필수 안내 문구).

## 검증 (main merge 후)

- scripts/validate_*.py 18/18 PASS (`python -X utf8`, Windows cp949 콘솔 회피).
- subscribe.html을 읽는 Node validator: 모두 PASS.
- validate_mobile_footer_legal_sheet_01.mjs: 로컬 FAIL. 하지만 변경 전 main에서도 같은 FAIL이라 기존 로컬 RED이고, 이번 변경과 무관하다.
- 실기기·Production 화면: NOT TESTED.

## 상태

IMPLEMENTED · 로컬 검사 PASS · MERGED/DEPLOYED 아님(배포총괄방 담당)
