READY_FOR_DEPLOY=YES
MIGRATION=NO
USER_DECISION_NEEDED=NONE

# ONNURI-REGION-FIRST-UX-01 — 온누리 화면: 지역 먼저·칩 줄 이름·안내 접기 (Site, QA #16)

TASK=ONNURI-REGION-FIRST-UX-01 (QA 사용자편의성 일괄보고 #16, 배포총괄방 전달)
REPO=lotbi-site
SITE_BRANCH=feature/onnuri-region-first-ux-01-site
CODE_SHA=d22c1033
BASE_MAIN=afb7057d (지도 정리 104b4bad 운영 반영 뒤 main, READY 직전 ls-remote)
ASSET_VERSION=aset-6f6641983c49
DEPLOY_ORDER=SITE 단독 (Core·Admin 변경 없음)
REQUIRED_ENV_CHANGES=NONE
NEW_SECRET_CREATED=NO
NEW_PAID_RESOURCE=NO

## 바뀐 것 (온누리상품권 탭)
1. **지역 먼저**: 시·도를 고르거나 [내 주변]을 누르기 전에는 가맹점을 보여 주지 않고 "시·도를 고르거나 [내 주변]으로 찾아 주세요…"만 표시. 이전처럼 전국 202,591곳 중 12곳을 아무 순서로 보여 주지 않음. 이때는 가맹점 요청도 보내지 않음. 업종 칩만 눌러도 전국 검색하지 않음. 위치 권한이 이미 허용된 사용자는 기존대로 내 주변으로 시작.
2. **칩 줄 이름**: 업종 줄에 '업종', 지류/디지털 줄에 '종류' 이름표(aria-labelledby 연결). 두 '전체' 칩이 구분됨.
3. **안내 접기**: 긴 법적 안내 → 한 줄 "공공데이터 기준 안내예요. 방문 전 가맹점에 확인해 주세요." + [자세히]를 누르면 전문(공식·제휴 아님 문구 포함)을 펼침. 처음엔 접힘, 요약 줄 터치 영역 44px.
- 파일: site-life-onnuri.js, site-life-onnuri.css, 검사기 3개(onnuri_merchant_search_01·onnuri_location_ux_p0·voucher_unified_p0). 카드 목록·consumer_sections 무변경.

## 검사기 (기준 약화 없음)
- validate_onnuri_merchant_search_01 PASS: 지역 안내·카드 0·가맹점 요청 0, 칩만 눌러도 요청 0, 칩 줄 이름 ['업종','종류']+aria 연결, 안내 접힘(보이지 않음)·자세히로 펼침 단정 → 전북 선택 뒤 기존 8곳·거리 없음·출처 단정 그대로.
- validate_onnuri_location_ux_p0 PASS: 첫 화면 카드 0·안내·요청 0 → 부산 선택 뒤 12곳·더 보기·중복 없음. 위치 거부 → 지역 선택도 안내로, '준비 중' 단계는 시·도 선택 뒤 확인.
- validate_voucher_unified_p0 PASS(3,666): 위치 없는 경우 온누리 탭 안내 확인 뒤 강원 선택, 위치 허용 경우 내 주변 그대로.
- validate_onnuri_market_location_02 PASS, asset --check PASS. 실기기 NOT VERIFIED(Chrome 화면 흉내).

## 되돌리기
- 이전 site 이미지로 재실행. 데이터 변경 없음.
