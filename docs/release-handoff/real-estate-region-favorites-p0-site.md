READY_FOR_DEPLOY=YES
SUPERSEDES=87c56695a65ed7d24a7cb713a6ddd16685ec3272 (READY=NO, provider 미확인)
PROVIDER_ACCESS=VERIFIED_BY_RELEASE_CONTROL — 2026-10-10 소유자 활용승인(국토교통부 아파트 매매 15126469·전월세 15126474, 만료 2028-10-10), 배포총괄방 운영 앱 서버 실호출: 매매 resultCode=000 totalCount=19(LAWD_CD 11110, 202609), 전월세 000 totalCount=99
DEPENDS_ON=없음 — 승인 지역정보 UX(c16a4759)는 site main에 들어갔다(SITE-T46). Core p0_0113는 운영 중(CORE-T35b).
PAIRED_CORE=feature/real-estate-region-favorites-p0-core (페이지 넘김 수정 READY=YES, 이 Site와 순서 무관 — 같이 나가도 됨)
ENABLE_ENV=Core 운영 env MOLIT_RTMS_ENABLED=true (기존 data.go.kr 계정 키 재사용, 새 secret 아님). 꺼져 있으면 화면은 "국토교통부 실거래가 자료를 지금 불러오지 못했어요 + 다시 시도"로 정직하게 안내한다(지역 선택·관심 아파트 저장은 동작). 켜는 시점은 소유자 승인 뒤 배포총괄방.
OPTIONAL_ENV=NAVER_MAPS_REVERSE_GEOCODE_ENABLED=true (NCP 앱의 Reverse Geocoding API가 켜져 있어야 함) — 꺼져 있으면 현재 위치는 광역시·도까지만 "대략" 자동 선택, 시·군·구·읍·면·동은 직접 선택
DEPLOY_ORDER=SITE 단독 가능(Core는 이미 운영). 사용자에게 실거래가가 보이려면 MOLIT_RTMS_ENABLED=true
USER_DECISION_NEEDED=MOLIT_RTMS_ENABLED=true 켜는 시점(배포 차단 아님)

BASELINE_V1=lotbi-site 운영 기준 V1 확인(core docs/operations/LOTBI_ENGINEERING_BASELINE.md와 같은 기준) — 기존 owner·branch 재사용, 중복 방 없음, 미커밋 변경 없음, main 7b555600 정상 merge(충돌 = 토큰·CSS 목록·import·함수 인자, 해소 기록은 merge 커밋 메시지), 기존 검사기 단언 삭제·완화 없음(카드 목록에 새 카드 추가만), Production/DB/Secret/LIVE MONEY/유료 인프라 변경 없음
NOT_VERIFIED=실기기(Samsung Internet·Android Chrome·iPhone Safari — 뷰포트·UA 흉내만), 운영 실데이터 화면(켜기 전), 전기차 충전소 Site(1f5a62cb, 아직 main 밖)와의 카드 합집합(둘 다 들어가면 10장)
NEXT_OWNER=배포총괄방

# REAL-ESTATE-REGION-FAVORITES-P0 — 지역정보 → 부동산 실거래가 (Site)

TASK=LOTBI_REAL_ESTATE_REGION_FAVORITES_P0
REPO=lotbi-site
FEATURE_BRANCH=feature/real-estate-region-favorites-p0-site
FEATURE_SHA=이 문서 커밋(branch HEAD). `git ls-remote`로 확인.
CODE_SHA=e685e42a (site main 7b555600 정상 merge. 그 앞 merge 1ee29fd5, 기능 커밋 adbb3f2e)
BASE=site main 7b555600 (SITE-T46 승인 지역정보 UX·T47·T48 포함). push 직전 ls-remote 재확인
ASSET_TOKEN=aset-758a9cca962d (asset_cache_version --check PASS)

## 변경 요약

- 지역정보 메뉴에 `부동산 실거래가` 카드(공통 SVG 아이콘 `building`) — 온누리상품권 바로 뒤. 9장: 휴대폰·데스크톱 모두 2열, 홀수 마지막 카드(내 아이 학교·유치원)만 한 줄 전체(기존 규칙 그대로).
- 카드 → 전용 화면(대화 자동 전송·AI 호출 없음). route `real-estate`(뒤로 → 지역정보) / 상세 `real-estate-apartment`(뒤로 → 목록). 브라우저·Android 시스템 뒤로가기, 화면 안 ←, 머리글 ←, Escape가 모두 상세 → 목록 → 지역정보 → 홈. 관심 아파트 탭에서 연 상세는 관심 아파트로 돌아감. 목록의 지역·거래 유형·검색어·스크롤 유지. 상세에서 새로고침하면 같은 단지(이 탭 sessionStorage).
- 새 파일: `site-life-real-estate.js`(화면), `site-real-estate-client.js`(Core 호출·표기·기기 저장), `site-life-real-estate.css`(테마 토큰만). `index.html`·`auth/callback/index.html`에 CSS 링크.
- 검색 지역: 광역시·도 → 시·군·구 → 읍·면·동(전체 읍·면·동 포함), 상위 변경 시 하위 초기화, 지역 이름 검색. 현재 위치: LOTBI 위치 사용 ON + 브라우저 허용일 때만 자동(Core가 공식 법정동으로 확인한 단계까지). 직접 고른 지역은 이 기기에 기억(계정별 키)되고 위치로 다시 바꾸지 않음 — [현재 위치로 다시 설정]으로만. "현재 위치로 자동 선택 / 직접 선택한 지역" 표시. 위치 사용 OFF면 버튼 없이 설정 링크, 권한 거부면 수동 안내. LOTBI 기본 생활지역·주소는 건드리지 않음. 좌표 저장 없음.
- 목록: 매매/전세/월세, 기간(1/3/6/12개월), 아파트 이름 검색, 한 줄형 목록(단지명 2줄 제한·주소·최근 거래·거래 건수·해제 건수·♡), 더 보기, 빈 결과(기간 내 신고 없음 ≠ 아파트 없음) / 이름 불일치 / 자료 장애(다시 시도) 구분, 국토교통부 신고자료 안내(호가·시세 아님).
- 관심 아파트: ♡/♥ 한 번으로 등록·해제. 로그인 = Core 계정 저장(다른 기기 같은 목록), 비로그인 = 이 기기만(50개). 로그인 전 기기 목록은 자동으로 합치지 않고 [계정 목록에 추가]/[이 기기 목록 지우기]를 보여 줌. 관심 아파트 탭: 지역 상관없이 목록, 최근 매매·전월세 요약(6개월), 저장 해제, 누르면 상세.
- 상세: 매매·전월세 계약 전부(최신순, 해제 표시·해제일, 계약구분·갱신요구권), 기간 6/12/24개월, 기본 지도앱(NAVER_MAP/KAKAO_NAVI/TMAP/GOOGLE_MAPS 설정값의 실제 아이콘)으로 단지명+주소 검색 열기 — 좌표 핀 없음. 전화 버튼 없음.

## 검증

SITE_TEST_RESULT=site main 7b555600 merge 뒤 11개 PASS: 새 validate_real_estate_region_favorites_p0(360·375다크·390·412·768·1280·1280다크, 로그인·계정 격리 포함), consumer_sections_02, hardening.py, life_medical_category_entry_01, regional_news_p0_01, life_info_cleanup_final_01, my_child_school_01, jeonbuk_real_world_pilot_01, life_medical_auto_search_card_01, onnuri_location_ux_p0, site_refresh_route_restore_01. asset_cache_version --check PASS. Site CI 전체는 이 PC에서 돌리지 않았다 — merge gate가 돈다.
NEW_FAILURES=0 (이전 실행에서 보였던 refresh_route "I 로그인 왕복" 실패는 이번 실행에서 PASS — CPU 경합 시 기준선에서도 나던 환경성 실패)
NEW_VALIDATOR=scripts/validate_real_estate_region_favorites_p0.mjs (site-review.yml 등록) — Core 계약 모형으로 360/375(다크)/390/412/768/1280/1280(다크) 실제 터치·마우스 입력.
UPDATED_VALIDATORS=지역정보 카드 목록·개수를 고정한 7개(consumer_sections_02, life_medical_category_entry_01, life_medical_auto_search_card_01, life_info_cleanup_final_01, my_child_school_01, regional_news_p0_01, jeonbuk_real_world_pilot_01)에 새 카드 추가(8→9), site_refresh_route_restore_01에 route 2개 추가. 단언 삭제·완화 없음.
DEVICE_E2E=NOT VERIFIED (Android Samsung Internet·Android Chrome·iPhone Safari 실기기 없음 — 뷰포트·UA 흉내만)
LIVE_DATA=운영 Core 실호출은 배포총괄방이 확인(PROVIDER_ACCESS). 화면에 실데이터가 나오는지는 MOLIT_RTMS_ENABLED=true 뒤 운영 실화면 확인 필요
