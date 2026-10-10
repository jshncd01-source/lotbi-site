READY_FOR_DEPLOY=YES
TASK=REGIONAL-CARDS-BUNDLE-01 (배포총괄방 요청, 소유자 위임 범위 — 지역정보 카드 목록을 함께 바꾸는 Site 4개를 한 branch로) + 수정 02: '전북 맛집·음식' 카드 삭제(소유자 결정 2026-10-10 "LOTBI는 전국 대상이지 전북 대상이 아님", 배포총괄방 전달)
SUPERSEDES=c4da1ea0 (첫 READY — 카드 11장, 전북 맛집·음식 포함). 이 문서의 HEAD만 배포 대상.
DEPLOY_ORDER=CORE 선행 — 전기차 Core 운영 완료(CORE-T38, EV_CHARGER_ENABLED=true) · 부동산 Core 운영 완료(p0_0113, 스위치 OFF; 페이지 넘김 수정 feature/real-estate-region-favorites-p0-core 6afa08c3 READY=YES는 순서 무관) · **지하철 Core는 이 Site보다 먼저 운영에 들어가야 함** · CCTV Core는 OFF 그대로 → 그다음 이 Site
SUBWAY_WITHOUT_CORE=지하철 카드는 숨겨지지 않는다. Core에 /v2/life/subway가 없으면(404) 화면은 열리고 "지하철역 정보를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요."가 나온다('준비 중' 안내는 Core가 status DISABLED로 답할 때만). 그래서 지하철 Core 배포 뒤에 이 Site를 배포한다.
CCTV=TRAFFIC_CCTV_UI_ENABLED=false 유지 — 카드·라우트·opener 없음. 운영 env TRAFFIC_CCTV_* 넣지 않음.
JEONBUK_CORE=전북 실증 Core API(regional_food 등, 운영 OFF)는 건드리지 않음. Core 변경 없음.
USER_DECISION_NEEDED=없음(배포 차단 없음). 각 기능 켜기(MOLIT_RTMS_ENABLED 등)는 원래 방 READY의 결정 그대로.

# REGIONAL-CARDS-BUNDLE-01 — 지역정보 카드 4개 기능 통합 (Site)

REPO=lotbi-site
FEATURE_BRANCH=feature/regional-cards-bundle-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD). `git ls-remote`로 확인.
CODE_SHA=b0cf6843f (전북 카드 삭제 13460e82 → main merge 3fb16517 → 토큰 b0cf6843)
BASE=site main d4d172a5822e615749b353e90dced4f103050d21 (SITE-T50 요청 폭주 P0 포함, 15:55 ls-remote) — 첫 READY의 base 5675fd3d 위에 정상 merge 3fb16517(충돌은 asset 토큰과 이 branch의 import 줄뿐) + 토큰 재계산 b0cf6843. push 직전 ls-remote로 다시 확인.
ASSET_TOKEN=aset-7f4cb5861069 (asset_cache_version --check PASS)
OWNER=개발 · 부동산 실거래가 P0 방(배포총괄방 지정). 원래 기능 owner는 각 방 그대로. 같은 branch를 다른 방이 고치지 않음(원격에 이 방 커밋만).

## 합친 branch (원격 SHA 그대로, 정상 merge — rebase·squash·force 없음)

| 순서 | branch | SHA | 내용 |
|---|---|---|---|
| 1 | feature/real-estate-region-favorites-p0-site | cf1fc263 | 부동산 실거래가 카드·화면·route 2개 |
| 2 | feature/ev-charger-nearby-list-p0-site | 750221af | 전기차 충전소 카드·화면·route 1개 |
| 3 | feature/subway-life-info-p0-site | dea2055f | 지하철 정보 카드·화면·route 2개 |
| 4 | feature/traffic-cctv-nearby-p0-site | 1412c548 | 도로 CCTV(스위치 OFF) |

넣지 않은 것(요청대로): 의료 af6c0463(네 branch 어디에도 조상으로 없음 — 객체 자체가 이 clone에 없음), 통관부호, 와이파이, 공통기준 V1(네 branch의 main 밖 커밋은 각자 기능 커밋·READY 문서뿐임을 확인).

**전기차 branch 750221af의 실수 커밋 제외**: 그 READY 문서 커밋이 검사기 임시 폴더 18개(scripts/.<이름>-XXXXXX/, Chrome 프로필·확장 파일 등 46,913개)를 함께 커밋했다. Windows 경로 길이 초과로 merge 자체가 실패하고, 들어가면 Site 이미지로 공개될 수 있어 이 묶음의 merge 커밋(5831d394)에서 그 경로만 index에서 뺐다(main에 원래 있던 scripts/.placecard-inner.html은 그대로). 전기차 기능 코드·검사기·fixture는 모두 들어왔다. 전기차 원래 branch는 여전히 그 파일을 갖고 있으니 단독으로 merge하지 말 것.

## 수정 02 — '전북 맛집·음식' 카드 삭제 (최소 변경)

- 사용자 진입 경로: 이 카드는 route·opener가 없고, 지역정보 화면 안에서 입력 화면(`regionalFood` → `createJeonbukFoodForm`)을 여는 카드였다. `site-consumer-sections.js`에서 카드 항목, 그 입력 화면 분기, 그 import만 뺐다(−12줄). 이제 지역정보 어디에서도 전북 음식 입력 화면에 갈 수 없다.
- 그대로 둔 것: `site-life-regional.js`(대화 답변의 전북 공식 기록 카드 표시·문장 생성기 — `site-conversation.js`가 계속 사용), 그 CSS, 아이콘 경로 'food', 전북 의료기관 등록정보 표시, Core 전북 API(운영 OFF). 죽은 코드 대량 삭제 없음.
- 카드를 임의로 더하거나 빼지 않았다.

## 최종 지역정보 카드 (10장, CCTV OFF)

병원·응급실 / 약국 / **전기차 충전소** / 축제·행사 / 지역뉴스 / **지하철 정보** / 온누리상품권·지역화폐 / **부동산 실거래가** / 지역생활정보 / 내 아이 학교·유치원

- 위치 근거: 전기차 = 약국 바로 다음(그 방 설계), 지하철 = 지역뉴스 바로 다음·온누리 바로 앞(배포총괄방 지정), 부동산 = 온누리상품권·지역화폐 바로 다음(그 방 설계), CCTV(켜질 때) = 부동산 다음.
- **10장 = 짝수 → 5줄 × 2칸, 한 줄 전체를 쓰는 카드 없음, 마지막 줄 = 지역생활정보 | 내 아이 학교·유치원.**
- 화면 규칙(새 CSS 없음 — 이미 있는 규칙, site-consumer-layout.css 600px 이하): `grid-auto-rows: 1fr`(모든 줄이 가장 높은 줄 높이 → 카드 높이 하나), 라벨 `word-break: keep-all`(낱말 안에서 끊지 않음)·`line-height: 1.25`(두 줄 이름도 같은 60px 카드 안).
- 실측(Windows Chrome, 뷰포트 흉내):

| 화면 | 카드 크기 | 두 줄 라벨 |
|---|---|---|
| 360×780 | 10장 모두 156×60 | 온누리상품권· / 지역화폐, 내 아이 학교· / 유치원 |
| 375×812 | 10장 모두 164×60 | 같음 |
| 390×844 | 10장 모두 171×60 | 같음 |
| 412×915 | 10장 모두 182×60 | 온누리상품권· / 지역화폐 |
| 1280×900 | 10장 모두 424×72 | 없음 |

  두 줄은 '·' 바로 뒤에서만 나뉘고 잘리지 않으며, 모든 카드가 첫 화면 안이다.
- CCTV를 켜면 11장(홀수): 마지막 '내 아이 학교·유치원'이 한 줄 전체를 쓰는 기존 규칙(site-consumer-design.css)으로 빈칸 없음. CCTV 검사기의 켠 목록은 11장으로 갱신해 두었다.

## 검사기 갱신 (기준 약화 없음 — 근거)

- 카드 목록을 고정한 검사기 10개: 최종 10장 목록으로만 바꿈 — consumer_sections_02, life_medical_category_entry_01, life_medical_auto_search_card_01, life_info_cleanup_final_01, my_child_school_01, regional_news_p0_01(짝수 분기 그대로 사용), ev_charger_nearby_list_p0_01, subway_life_info_p0_01, traffic_cctv_route_select_p0_01(끔 10·켬 11), jeonbuk_real_world_pilot_01.
- **새로 더한 단정** (life_medical_category_entry_01, 360/375/390/412/1280):
  - 한 줄 전체를 쓰는 카드 0개, 줄 구성 정확히 [2,2,2,2,2], 마지막 줄 = ['지역생활정보', '내 아이 학교·유치원'].
  - 띄어쓰기가 있는 이름이 두 줄이면 띄어쓰기 자리나 '·' 바로 뒤에서만 나뉜다(줄마다 글자를 실측해 원래 이름으로 되짚음).
  - 라벨 상자가 카드 상자 안에 있다(두 줄이어도 카드 높이를 넘지 않음).
  - 기존 단정(1~2줄, 잘림 없음, 모든 카드 같은 너비·같은 높이, 44px 이상, 첫 화면 안, 빈칸 없음)은 그대로.
- consumer_sections_02·jeonbuk_real_world_pilot_01: '카드 없음'을 단정 — jeonbuk-food id·`regionalFood`·라벨 '전북' 없음, `site-consumer-sections.js`에 `createJeonbukFoodForm`/`regionalFood`/`site-life-regional` 없음, 브라우저에서 지역정보 홈에 카드·`[data-regional-food-form]`·'전북' 글자 없음, 10장 5줄, 지역생활정보는 자기 입력 화면을 열고(전북 칩 0개) 아무것도 보내지 않음.
- jeonbuk 검사기에서 뺀 단정: 전북 음식 입력 화면의 칩 위치·전송 문장(카드가 사라져 사용자가 닿을 수 없는 화면 — 소유자 결정에 따른 기능 삭제이지 기준 완화가 아님). 문장 생성기 단위 단정(`buildJeonbukFoodPrompt`)과 대화 답변의 전북 공식 기록 카드·연락처·의료기관 카드 단정은 그대로 둠.

## 충돌 해소 기록 (첫 READY와 같음)

- asset 토큰: 전부 다시 계산.
- index.html·auth/callback/index.html CSS: main 목록 + site-life-real-estate / ev-chargers / subway / traffic-cctv CSS 합집합(중복 0).
- site-route.js·site-conversation.js·site-consumer-sections.js·.github/workflows/site-review.yml: 각 기능의 route·opener·콜백·아이콘·CI 단계를 나란히 둠. route 표 순서 = opener 순서(…festival, real-estate, real-estate-apartment, ev-chargers, subway, subway-station; CCTV는 스위치 조건부).
- 온누리 화면 열기는 main(T49)의 상품권 통합 화면(site-life-vouchers.js) 유지, 카드 이름은 main의 '온누리상품권·지역화폐'.
- 섹션 콜백 인자 순서: onOnnuri, onEvChargers, onRealEstate, onSubway, onTrafficCctv(전기차 검사기의 인자 순서 단언을 그대로 만족).
- merge 중 생긴 실수 2건은 검사로 찾아 새 커밋으로 고침: dab64a0b(onEvChargers 줄이 import 배열 안으로 들어감), 02e7fe4c(지하철 merge가 열린 전기차 함수 안에 들어감 — ES 모듈 문법 검사로 확인).
- site_refresh_route_restore_01: route 12개·route 문자열 7개 = 각 branch 기대값의 합집합(전북 카드는 route가 없어 무관).

## 검증

SITE_TEST_RESULT=17개 PASS (main d4d172a5 merge 뒤 HEAD b0cf6843, Windows 로컬, CHROME_BIN, 16:14): consumer_sections_02, hardening.py, site_session_request_storm_p0_01(T50), life_medical_category_entry_01(새 단정 포함), jeonbuk_real_world_pilot_01(카드 없음 단정), site_refresh_route_restore_01, real_estate_region_favorites_p0, ev_charger_nearby_list_p0_01, subway_life_info_p0_01, traffic_cctv_route_select_p0_01(끔 10장 + 켠 검사 서버 11장), life_medical_auto_search_card_01, life_info_cleanup_final_01, my_child_school_01, regional_news_p0_01, kindergarten_official_info_01, voucher_unified_p0, onnuri_location_ux_p0. 모든 site-*.js·scripts/validate_*.mjs ES 모듈 문법 검사 PASS. asset --check PASS.
FLAKE_NOTE=merge 전 실행(HEAD 13460e82)에서 site_refresh_route_restore_01의 'iPhone-375x812: I login from /#scam' 1건이 auth 'checking'에 머물러 실패(그때 다른 방 검사기 여러 개가 동시 실행) → merge 뒤 같은 검사기 PASS. 이번 변경(지역정보 카드)과 무관한 진위확인 로그인 왕복 경우이며, 이 PC 기준선에서도 가끔 실패하는 것으로 기록된 항목.
NOT_RUN=Site CI 전체(이 PC에서 순차 70분 이상) — merge gate가 돈다.
NEW_FAILURES=0
NOT_VERIFIED=실기기(Samsung Internet·Android Chrome·iPhone Safari — 뷰포트·UA 흉내만), Linux gate 글꼴에서의 줄바꿈 위치(Windows 글꼴로만 실측; 단정은 '띄어쓰기나 · 뒤' 규칙이라 글꼴 폭이 달라도 같은 규칙을 검사), 운영 실데이터 화면(부동산 MOLIT_RTMS_ENABLED 전, 지하철 Core 전)
PRODUCTION/DB/SECRET/LIVE_MONEY/PAID_INFRA=변경 없음
MAIN_DRIFT=BASE d4d172a5(T50 반영). 그 뒤 main이 또 바뀌면 정상 merge한 새 READY가 필요하다(이 방이 하거나 배포총괄방 지시를 따름).
NEXT_OWNER=배포총괄방
