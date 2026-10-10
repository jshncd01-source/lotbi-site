READY_FOR_DEPLOY=YES
MIGRATION=NO
USER_DECISION_NEEDED=NONE
SUPERSEDES=35d702d0 (READY=NO)

# SUBWAY-LIFE-INFO-P0 (+ 15058052 추가지시) — Site

TASK=LOTBI_SUBWAY_LIFE_INFO_P0
REPO=lotbi-site
FEATURE_BRANCH=feature/subway-life-info-p0-site
AUTHORITATIVE_MAIN=5675fd3d29e5148c58aa31df2d47912000f0b93a
CODE_SHA=2851ba28d
MAIN_MERGE=ad68ecd2d(main 7b555600: T44c~T48 전북 맛집·음식·Life Wallet 공유 등) → 2851ba28d(main 5675fd3d: SITE-T49 상품권·지역화폐 통합 + Life Wallet 백업 검사기). 충돌은 자산 토큰(main 쪽 채택 후 재계산), import·CSS 링크 추가(main 쪽 + 지하철 줄), 온누리→상품권 허브 화면(main 쪽), 카드 목록 고정 검사기(main 목록에 지하철 삽입, 전북 실증 검사기 포함).
ASSET_VERSION=aset-c0ac94b325e9
PAIRED_CORE=feature/subway-life-info-p0-core (DEPLOY_ORDER=CORE 먼저 → SITE)
PAIRED_WEB_THEME_SYNC=NOT_NEEDED

## 지역정보 카드 추가 위치 (배포총괄방 합칠 때 기준)

CARD=LIFE_SHORTCUTS에 {id: 'subway', label: '지하철 정보', icon: 'subway'} 1개 — **'news'(지역뉴스) 바로 다음, 'onnuri'(온누리상품권) 바로 앞**.
이 branch의 결과 목록(9장): medical, pharmacy, festivals, news, **subway**, onnuri(라벨 '온누리상품권·지역화폐'), local, jeonbuk-food, my-child
다른 방 카드(전기차·부동산·CCTV·의료)와 합칠 때: 지하철 줄은 news 다음 자리만 지키면 되고 나머지는 합집합. 카드 목록을 고정한 검사기(consumer_sections_02, life_info_cleanup_final_01, life_medical_auto_search_card_01, life_medical_category_entry_01, my_child_school_01, regional_news_p0_01, jeonbuk_real_world_pilot_01, subway_life_info_p0_01의 EXPECTED_CARDS)도 같은 자리에 'subway'/'지하철 정보'를 넣으면 됨.
홀짝 주의: 합친 카드 수가 짝수면 360px 휴대폰에서 마지막 '내 아이 학교·유치원'이 반 칸에서 두 줄 → validate_life_medical_category_entry_01 '한 줄' 규칙 실패(8장일 때 실측). 홀수면 마지막 카드가 한 줄 전체라 통과(이 branch 9장 PASS). 카드 높이는 site-consumer-layout.css 600px 이하 grid-auto-rows: 1fr로 어느 쪽이든 통일.
ROUTES=SITE_ROUTES에 'subway', 'subway-station'('festival' 다음), siteRouteOpeners에 subway·'subway-station', mountConsumerSection 인자 onSubway, index.html·auth/callback/index.html에 site-life-subway.css 링크.

## 화면

지역정보 → 지하철 정보(#subway: 가까운 역·반경·역 검색·호선) → 역(#subway-station: 호선 칩·방향 칩(공식 방면)·실시간 도착(공식 문구·남은 시간·생성 시각·급행·막차·열차 위치·제공처 시각 앞섬 표시)·새로고침·시간대별 평균 혼잡도(과거 자료, 실시간 아님 문구, 34%/100% 눈금, 기준 분기·출처)). 챗·AI 호출 0. 뒤로가기 역→지하철 정보→지역정보→홈, 새로고침·앞으로가기 상태 복원, 위치 재요청 없음.

## 검증 (merge 후)

SITE_TEST_RESULT=(main 5675fd3d merge 후) validate_subway_life_info_p0_01 PASS(110 checks: 360·375·390·412·1280, 라이트·다크, 데스크톱 키보드 Enter, 접근성 이름, 상태 6종, Core가 만든 fixture). consumer_sections_02·life_medical_category_entry_01(9장, 한 줄 규칙 PASS)·regional_news_p0_01·life_medical_auto_search_card_01·my_child_school_01·life_info_cleanup_final_01·kindergarten_official_info_01·life_direct_chat_card_compaction_01·jeonbuk_real_world_pilot_01·voucher_unified_p0 PASS (onnuri_merchant_search_01은 7b555600 merge 때 PASS, 이후 main에서 상품권 허브로 대체).
validate_site_refresh_route_restore_01: static PASS(라우트 표·opener 일치)·지하철 포함 휴대폰 케이스 PASS, 로그인 복귀(I) 단계만 실패 — 기준 0dbed91a에서도 같은 단계·같은 상태(auth checking, handoffs)로 실패하는 기존 경쟁조건(인증은 화면 뒤 0.5~0.75초에 완료 실측). 지하철 변경과 무관.
FULL_VALIDATOR_SUITE=NOT RUN(233개, 같은 PC 다른 방 검사기 부하). Linux 전체 gate는 배포총괄방.
NEW_FAILURES=0
NO_AUTO_CHAT_PASS=YES / STATION_SEARCH_PASS=YES / NEARBY_STATION_PASS=YES / LINE_DIRECTION_PASS=YES / BACK_NAVIGATION_PASS=YES(브라우저 history 기준, Android 실기기 NOT MEASURED) / MOBILE_TWO_COLUMN_PASS=YES

## 배포·롤백

DEPLOY=짝 Core 배포·env 설정 후 일반 Site 배포. migration·env 없음.
SMOKE=지역정보 → 지하철 정보 → '강남' 검색 → 강남역(2호선 실시간 도착·열차 위치, 신분당선 칩, 평균 혼잡도) → 뒤로가기 3회 홈
ROLLBACK=이전 Site 이미지.
PRODUCTION_CHANGED=NO
