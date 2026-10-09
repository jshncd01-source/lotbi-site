READY_FOR_DEPLOY=YES

# plan-trusted-device-limits-01-site — release handoff

TASK=LOTBI MASTER 요금제별 신뢰 기기 정책 — 플랜 비교표·배너 문구(Site)
REPO=lotbi-site
FEATURE_BRANCH=feature/plan-trusted-device-limits-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD, `git ls-remote origin refs/heads/feature/plan-trusted-device-limits-01-site`로 확인)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=ddcc573dca61 (SITE-T37 반복 일정 포함, feature에 정상 merge, drift 0)
CODE_SHA=1fe9078d6 (코드 418834366 → main ddcc573dc merge 1fe9078d6)
PAIRED_BRANCHES=lotbi-core feature/plan-trusted-device-limits-01-core · lotbi-web feature/plan-trusted-device-limits-01-web · lotbi-app feature/plan-trusted-device-limits-01-app
DEPLOY_ORDER=CORE → WEB → SITE → APP (Site는 정적 문구만이라 순서 무관, Core 정책과 같은 날 배포 권장)
MIGRATION=NO
ASSET_TOKEN=변경 없음(subscribe.html 본문만 수정, asset_cache_version --check PASS aset-f0f202fb6c78)

## 바뀐 것

- subscribe.html
  - Basic·Plus·Pro 카드: "신뢰 기기 등록 최대 1대 / 5대 / 15대" 한 줄씩.
  - 전체 기능 비교표: "신뢰 기기 등록" 행(최대 1대 / 5대 / 15대).
  - 비교표 아래 필수 안내: "신뢰 기기 등록은 선택 사항이며, 등록하지 않아도 일반 로그인으로 LOTBI를 이용할 수 있습니다." + 신뢰 기기 수는 로그인한 브라우저나 로그인 횟수가 아니라 직접 동의해 등록한 기기 수라는 설명.
  - 안심케어 프로필 1/5/15개 행은 별개 항목으로 그대로.
- 새 validator scripts/validate_trusted_device_plan_limits_01.py, .github/workflows/site-review.yml에 단계 1개 추가.
- 가격·약관·환불 문서·결제 흐름 무변경. Site에는 기기 관리 화면이 없음(계정 보안은 Account 담당).

## 검증 (merge 후)

- scripts/validate_*.py 18/18 PASS (`python -X utf8`, Windows cp949 콘솔 회피)
- 요금제 관련 Node validator PASS: consumer_design_shell_01, subscribe_account_checkout_handoff_01, site_refresh_route_restore_01, static_pages_theme_01, life_info_cleanup_final_01 등 subscribe.html을 읽는 검사 전부
- validate_mobile_footer_legal_sheet_01.mjs: 로컬 FAIL이지만 main(변경 전)에서도 같은 FAIL → 기존 로컬 RED, 이번 변경 무관
- asset_cache_version.mjs --check PASS
- 실기기·Production 화면: NOT TESTED

## 상태

IMPLEMENTED · 로컬 검사 PASS · MERGED/DEPLOYED 아님(배포총괄방 담당)

USER_DECISION_NEEDED=NONE (구독 가격 branch feature/subscription-price-proration-01-site와 subscribe.html이 다른 줄을 고침 — 합칠 때 자동 merge 예상)
