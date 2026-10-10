READY_FOR_DEPLOY=YES
TASK=REGIONAL-CARDS-BUNDLE-01 (배포총괄방 요청, 소유자 위임 범위 — 지역정보 카드 목록을 함께 바꾸는 Site 4개를 한 branch로)
DEPLOY_ORDER=CORE 선행 — 전기차 Core 운영 완료(CORE-T38, EV_CHARGER_ENABLED=true) · 부동산 Core 운영 완료(p0_0113, 스위치 OFF; 페이지 넘김 수정 feature/real-estate-region-favorites-p0-core 6afa08c3 READY=YES는 순서 무관) · **지하철 Core는 이 Site보다 먼저 운영에 들어가야 함** · CCTV Core는 OFF 그대로 → 그다음 이 Site
SUBWAY_WITHOUT_CORE=지하철 카드는 숨겨지지 않는다. Core에 /v2/life/subway가 없으면(404) 화면은 열리고 "지하철역 정보를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요."가 나온다('준비 중' 안내는 Core가 status DISABLED로 답할 때만). 그래서 지하철 Core 배포 뒤에 이 Site를 배포한다.
CCTV=TRAFFIC_CCTV_UI_ENABLED=false 유지 — 카드·라우트·opener 없음. 운영 env TRAFFIC_CCTV_* 넣지 않음.
USER_DECISION_NEEDED=없음(배포 차단 없음). 각 기능 켜기(MOLIT_RTMS_ENABLED 등)는 원래 방 READY의 결정 그대로.

# REGIONAL-CARDS-BUNDLE-01 — 지역정보 카드 4개 기능 통합 (Site)

REPO=lotbi-site
FEATURE_BRANCH=feature/regional-cards-bundle-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD). `git ls-remote`로 확인.
CODE_SHA=02e7fe4c3
BASE=site main 5675fd3d29e5148c58aa31df2d47912000f0b93a (SITE-T49 상품권 통합 포함, 2026-10-10 15:10 ls-remote). push 직전 다시 확인.
ASSET_TOKEN=aset-97cbf5fb98f4 (asset_cache_version --check PASS)
OWNER=개발 · 부동산 실거래가 P0 방(배포총괄방 지정). 원래 기능 owner는 각 방 그대로.

## 합친 branch (원격 SHA 그대로, 정상 merge — rebase·squash·force 없음)

| 순서 | branch | SHA | 내용 |
|---|---|---|---|
| 1 | feature/real-estate-region-favorites-p0-site | cf1fc263 | 부동산 실거래가 카드·화면·route 2개 |
| 2 | feature/ev-charger-nearby-list-p0-site | 750221af | 전기차 충전소 카드·화면·route 1개 |
| 3 | feature/subway-life-info-p0-site | dea2055f | 지하철 정보 카드·화면·route 2개 |
| 4 | feature/traffic-cctv-nearby-p0-site | 1412c548 | 도로 CCTV(스위치 OFF) |

넣지 않은 것(요청대로): 의료 af6c0463(네 branch 어디에도 조상으로 없음 — 객체 자체가 이 clone에 없음), 통관부호, 와이파이, 공통기준 V1(네 branch의 main 밖 커밋은 각자 기능 커밋·READY 문서뿐임을 확인).

**전기차 branch 750221af의 실수 커밋 제외**: 그 READY 문서 커밋이 검사기 임시 폴더 18개(scripts/.<이름>-XXXXXX/, Chrome 프로필·확장 파일 등 46,913개)를 함께 커밋했다. Windows 경로 길이 초과로 merge 자체가 실패하고, 들어가면 Site 이미지로 공개될 수 있어 이 묶음의 merge 커밋(5831d394)에서 그 경로만 index에서 뺐다(main에 원래 있던 scripts/.placecard-inner.html은 그대로). 전기차 기능 코드·검사기·fixture는 모두 들어왔다. 전기차 원래 branch는 여전히 그 파일을 갖고 있으니 단독으로 merge하지 말 것.

## 최종 지역정보 카드 (11장, CCTV OFF)

병원·응급실 / 약국 / **전기차 충전소** / 축제·행사 / 지역뉴스 / **지하철 정보** / 온누리상품권·지역화폐 / **부동산 실거래가** / 지역생활정보 / 전북 맛집·음식 / 내 아이 학교·유치원

- 위치 근거: 전기차 = 약국 바로 다음(그 방 설계), 지하철 = 지역뉴스 바로 다음·온누리 바로 앞(배포총괄방 지정), 부동산 = 온누리상품권·지역화폐 바로 다음(그 방 설계), CCTV(켜질 때) = 부동산 다음.
- 11장 = 홀수 → 휴대폰 2열에서 마지막 '내 아이 학교·유치원'만 한 줄 전체, 360px에서 한 줄 라벨(validate_life_medical_category_entry_01 PASS, 모든 카드 첫 화면 안).
- CCTV를 켜면 12장(짝수): 모든 줄이 2장으로 꽉 차지만 '내 아이 학교·유치원'은 반 칸 폭이 되어 360px에서 두 줄이 된다(그 방 기록). 켤 때 카드 수 검사기 7개를 그때 목록으로 갱신하고, 배치 규칙은 소유자 결정 — 제안: (a) 도로 CCTV를 켤 때 다른 카드 하나와 합치거나, (b) 360px 라벨 두 줄 허용으로 검사 기준을 소유자가 바꾸거나. 지금은 아무 카드도 임의로 더하거나 빼지 않았다.

## 충돌 해소 기록

- asset 토큰: 전부 다시 계산.
- index.html·auth/callback/index.html CSS: main 목록 + site-life-real-estate / ev-chargers / subway / traffic-cctv CSS 합집합(중복 0).
- site-route.js·site-conversation.js·site-consumer-sections.js·.github/workflows/site-review.yml: 각 기능의 route·opener·콜백·아이콘·CI 단계를 나란히 둠. route 표 순서 = opener 순서(…festival, real-estate, real-estate-apartment, ev-chargers, subway, subway-station; CCTV는 스위치 조건부).
- 온누리 화면 열기는 main(T49)의 상품권 통합 화면(site-life-vouchers.js) 유지, 카드 이름은 main의 '온누리상품권·지역화폐'.
- 섹션 콜백 인자 순서: onOnnuri, onEvChargers, onRealEstate, onSubway, onTrafficCctv(전기차 검사기의 인자 순서 단언을 그대로 만족).
- merge 중 생긴 실수 2건은 검사로 찾아 새 커밋으로 고침: dab64a0b(onEvChargers 줄이 import 배열 안으로 들어감), 02e7fe4c(지하철 merge가 열린 전기차 함수 안에 들어감 — ES 모듈 문법 검사로 확인).
- 카드 목록·카드 수를 고정한 검사기: 최종 11장 목록으로만 바꿈(consumer_sections_02, life_medical_category_entry_01, life_medical_auto_search_card_01, life_info_cleanup_final_01, my_child_school_01, regional_news_p0_01, jeonbuk_real_world_pilot_01) + 각 기능 검사기의 EXPECTED_CARDS(전기차·지하철·CCTV 켬 12장/끔 11장) + site_refresh_route_restore_01(route 12개·route 문자열 7개 = 각 branch 기대값의 합집합). 단언 삭제·완화 없음. life_info_cleanup_final_01의 "누르면 지역정보로 돌아가기" 순회 제외 목록에 별도 화면 카드(전기차·지하철)를 더함(부동산·축제·온누리와 같은 이유).

## 검증

SITE_TEST_RESULT=16개 PASS(Windows 로컬, CHROME_BIN): consumer_sections_02, hardening.py, real_estate_region_favorites_p0(7개 화면 경우), ev_charger_nearby_list_p0_01, subway_life_info_p0_01, traffic_cctv_route_select_p0_01(스위치 끔 + 켠 검사 서버 흐름), life_medical_category_entry_01, life_medical_auto_search_card_01, life_info_cleanup_final_01, my_child_school_01, regional_news_p0_01, jeonbuk_real_world_pilot_01, kindergarten_official_info_01, site_refresh_route_restore_01, voucher_unified_p0, onnuri_location_ux_p0. 모든 site-*.js ES 모듈 문법 검사 PASS. asset --check PASS.
NOT_RUN=Site CI 전체(이 PC에서 순차 70분 이상) — merge gate가 돈다.
NEW_FAILURES=0
NOT_VERIFIED=실기기(Samsung Internet·Android Chrome·iPhone Safari — 뷰포트·UA 흉내만), 운영 실데이터 화면(부동산 MOLIT_RTMS_ENABLED 전, 지하철 Core 전)
PRODUCTION/DB/SECRET/LIVE_MONEY/PAID_INFRA=변경 없음
MAIN_DRIFT=BASE 5675fd3d. 배포총괄방 예고대로 SITE-T50이 먼저 들어가면 그 main을 정상 merge한 새 READY가 필요하다(이 방이 하거나 배포총괄방 지시를 따름).
NEXT_OWNER=배포총괄방
