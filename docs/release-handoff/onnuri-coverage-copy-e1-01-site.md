READY_FOR_DEPLOY=YES
MIGRATION=NO
USER_DECISION_NEEDED=NONE

# ONNURI-COVERAGE-COPY-E1-01 — 고객 화면 데이터 품질 숫자 삭제 + 지역 선택 전 [더 보기] 숨김 (Site, QA-02 E1)

TASK=QA 보고 02 E1 (공통 UI 방 → 이 방 인수)
REPO=lotbi-site
SITE_BRANCH=feature/onnuri-coverage-copy-e1-01-site
CODE_SHA=31e89c22
DEPENDS_ON=feature/onnuri-region-first-ux-01-site 4b67357b (이 branch는 그 위에서 시작해 그 변경을 포함 — 4b67357b가 먼저 나가도, 이 branch가 함께 나가도 됨)
BASE_MAIN=afb7057d (READY 직전 ls-remote)
ASSET_VERSION=aset-363e43389206
DEPLOY_ORDER=SITE 단독
REQUIRED_ENV_CHANGES=NONE
NEW_SECRET_CREATED=NO
NEW_PAID_RESOURCE=NO

## 바뀐 것
1. 온누리: 고객에게 보이던 데이터 품질 숫자를 지웠다.
   - "시·군·구 확인 2,993곳 · 확인 안 됨 7,191곳(공식 자료가…)"(시·도 고른 뒤 지역 안내)
   - "전북 가맹점 n곳 중 시·군·구를 확인한 곳은 n곳이에요…"(결과 위)
   - 내 주변은 숫자 없이 "공식 자료에 위치가 없는 가맹점은 거리로 찾을 수 없어요. 지역 선택으로 찾아 주세요." 한 줄만 남긴다.
   - "세종은 읍·면·동으로 나뉘어요", "시·군·구로 나눠 볼 수 없어요" 같은 행동 안내는 유지.
2. 지역화폐 탭: 지역을 고르기 전에도 [더 보기]가 보이던 문제.
   - 원인: .consumer-action의 display가 hidden 속성을 덮었다.
   - 수정: .voucher-more[hidden]·.onnuri-more[hidden]에 display:none을 넣었다(온누리 탭 [더 보기]도 같은 원인).
- 파일: site-life-onnuri.js, site-life-onnuri.css, site-life-vouchers.css, 검사기 3개, 자산 토큰.

## 검사기 (기준 강화)
- [더 보기] 판정을 hidden 속성에서 실제 화면 표시 여부로 바꿨다(onnuri_merchant_search_01·onnuri_location_ux_p0·voucher_unified_p0).
- 지역 선택 전 [더 보기] 없음 단정 추가(온누리·지역화폐).
- onnuri_location_ux_p0: 부산 지역 안내·결과 위 문구에 '확인 안 됨'·'n곳' 숫자 없음 단정. 기존 '확인 안 됨 4곳' 단정은 삭제.
- 결과: voucher_unified_p0 3,672 PASS · onnuri_location_ux_p0 PASS · onnuri_merchant_search_01 PASS · onnuri_market_location_02 PASS · asset --check PASS. 실기기 NOT VERIFIED.

## 되돌리기
- 이전 site 이미지로 재실행. 데이터 변경 없음.
