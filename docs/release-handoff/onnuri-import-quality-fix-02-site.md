READY_FOR_DEPLOY=YES

# 온누리 가맹점 — 시장 기준 위치 표시 (Site) — ONNURI-IMPORT-QUALITY-FIX-02

REPO=lotbi-site
FEATURE_BRANCH=feature/onnuri-import-quality-fix-02-site
FEATURE_SHA=이 문서 커밋(branch HEAD). `git ls-remote`로 확인한다.
CODE_SHA=942c7f8dc
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=9e39edd0 (SITE-T38c, 개발 중 main 이동 없음)
COMMAND=release-control/CMD_ONNURI_PROD_IMPORT_DATA_QUALITY_FIX_02.md + 배포총괄방 보완 5건(14:57)
ASSET_VERSION=aset-18b1e309b1f6 (node scripts/asset_cache_version.mjs --write, 65 files / 133 targets, 정합성 PASS)
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
DEPLOY_ORDER=CORE → ADMIN → SITE — 코드 배포는 일반 순서로 바로 가능하다.
COMPATIBILITY=Core가 옛 버전이어도 안전하다(MARKET이 없으면 이전과 같은 화면). 시·군·구·동 선택은 Site 변경 없이 Core 응답(regions)으로 열린다.
DEPENDENCIES=Core feature/onnuri-import-quality-fix-02-core
TEST_STATUS=새 scripts/validate_onnuri_market_location_02.mjs PASS(Node, CI 단계 추가) / 기존 scripts/validate_onnuri_merchant_search_01.mjs PASS(375x812·390x844·1280x900 viewport 에뮬레이션 — 실기기 아님) / scripts/asset_cache_version.mjs 정합성 PASS
USER_DECISION_NEEDED=NONE

## 변경

- 2026-07-31 공식 파일은 소재지가 시·도뿐이라("서울") Core가 가맹점을 소속 시장 위치(geo_state MARKET + market_address)로 놓는다. 온누리 카드는:
  - 거리 "시장까지 1.3km"(건물 좌표면 이전처럼 "80m")
  - 주소 줄 "시장 주소 서울특별시 중구 …"(시장 주소가 없으면 공식 소재지 그대로)
  - 안내 "위치·거리는 소속 시장 기준이에요. 가게 위치는 시장 안에서 확인해 주세요."
  - 길찾기 버튼 "시장 길찾기" — 목적지는 시장(가게 이름을 목적지로 보내지 않음)
  - MARKET·VERIFIED 외 상태(같은 이름 시장 여러 곳·시장 지역만 등)는 거리·좌표 없음, '지도에서 찾기'.
- 파일: site-life-onnuri.js(정규화에 locationBasis·marketAddress, 카드 함수 onnuriMerchantCard export), site-life-onnuri.css(.onnuri-card-basis), scripts/validate_onnuri_market_location_02.mjs, .github/workflows/site-review.yml(검증 단계 1개), asset 토큰.
- 공식 로고 미사용·저장 없음·제휴 오인 문구 없음 규칙 그대로.
