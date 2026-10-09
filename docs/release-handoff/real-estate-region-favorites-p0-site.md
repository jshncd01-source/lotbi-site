READY_FOR_DEPLOY=NO
READY_BLOCKER=PROVIDER_ACCESS NOT VERIFIED — 국토교통부 실거래가 API(15126469·15126474)의 운영 키 활용승인을 아직 확인하지 못했다. 이 화면은 사용자에게 보이는 메뉴라, 권한 확인 전에는 READY=YES로 올리지 않는다(명령문 15절). Core가 먼저 배포되고 provider 확인(Core READY 문서 "운영 확인")이 PASS이면 이 문서를 READY_FOR_DEPLOY=YES로 바꿔 다시 push한다.
DEPENDS_ON=feature/regional-info-approved-ux-restore-p0-site c16a4759 (승인된 지역정보 2열 UX). 이 branch는 그 위에서 만들었다 — 그 branch가 먼저 main에 들어가야 한다.
USER_DECISION_NEEDED=data.go.kr 활용신청 확인(Core 문서와 같음)

# REAL-ESTATE-REGION-FAVORITES-P0 — 지역정보 → 부동산 실거래가 (Site)

TASK=LOTBI_REAL_ESTATE_REGION_FAVORITES_P0
REPO=lotbi-site
FEATURE_BRANCH=feature/real-estate-region-favorites-p0-site
FEATURE_SHA=이 문서 커밋(branch HEAD). `git ls-remote`로 확인.
CODE_SHA=1ee29fd5 (site main 56c26095 정상 merge. 기능 커밋 adbb3f2e, 기준 c16a4759)
BASE=c16a4759 (feature/regional-info-approved-ux-restore-p0-site = site main 80da26b7 + 승인 UX) + site main 56c26095(SITE-T45) merge. push 직전 06:46 ls-remote 재확인
ASSET_TOKEN=aset-934415c7da50 (asset_cache_version --check PASS)
PAIRED=Core feature/real-estate-region-favorites-p0-core (먼저)
DEPLOY_ORDER=CORE → provider 확인 → (지역정보 UX 복구 Site) → SITE

## 변경 요약

- 지역정보 메뉴에 `부동산 실거래가` 카드(공통 SVG 아이콘 `building`) — 온누리상품권 바로 뒤. 9장: 휴대폰·데스크톱 모두 2열, 홀수 마지막 카드(내 아이 학교·유치원)만 한 줄 전체(기존 규칙 그대로).
- 카드 → 전용 화면(대화 자동 전송·AI 호출 없음). route `real-estate`(뒤로 → 지역정보) / 상세 `real-estate-apartment`(뒤로 → 목록). 브라우저·Android 시스템 뒤로가기, 화면 안 ←, 머리글 ←, Escape가 모두 상세 → 목록 → 지역정보 → 홈. 관심 아파트 탭에서 연 상세는 관심 아파트로 돌아감. 목록의 지역·거래 유형·검색어·스크롤 유지. 상세에서 새로고침하면 같은 단지(이 탭 sessionStorage).
- 새 파일: `site-life-real-estate.js`(화면), `site-real-estate-client.js`(Core 호출·표기·기기 저장), `site-life-real-estate.css`(테마 토큰만). `index.html`·`auth/callback/index.html`에 CSS 링크.
- 검색 지역: 광역시·도 → 시·군·구 → 읍·면·동(전체 읍·면·동 포함), 상위 변경 시 하위 초기화, 지역 이름 검색. 현재 위치: LOTBI 위치 사용 ON + 브라우저 허용일 때만 자동(Core가 공식 법정동으로 확인한 단계까지). 직접 고른 지역은 이 기기에 기억(계정별 키)되고 위치로 다시 바꾸지 않음 — [현재 위치로 다시 설정]으로만. "현재 위치로 자동 선택 / 직접 선택한 지역" 표시. 위치 사용 OFF면 버튼 없이 설정 링크, 권한 거부면 수동 안내. LOTBI 기본 생활지역·주소는 건드리지 않음. 좌표 저장 없음.
- 목록: 매매/전세/월세, 기간(1/3/6/12개월), 아파트 이름 검색, 한 줄형 목록(단지명 2줄 제한·주소·최근 거래·거래 건수·해제 건수·♡), 더 보기, 빈 결과(기간 내 신고 없음 ≠ 아파트 없음) / 이름 불일치 / 자료 장애(다시 시도) 구분, 국토교통부 신고자료 안내(호가·시세 아님).
- 관심 아파트: ♡/♥ 한 번으로 등록·해제. 로그인 = Core 계정 저장(다른 기기 같은 목록), 비로그인 = 이 기기만(50개). 로그인 전 기기 목록은 자동으로 합치지 않고 [계정 목록에 추가]/[이 기기 목록 지우기]를 보여 줌. 관심 아파트 탭: 지역 상관없이 목록, 최근 매매·전월세 요약(6개월), 저장 해제, 누르면 상세.
- 상세: 매매·전월세 계약 전부(최신순, 해제 표시·해제일, 계약구분·갱신요구권), 기간 6/12/24개월, 기본 지도앱(NAVER_MAP/KAKAO_NAVI/TMAP/GOOGLE_MAPS 설정값의 실제 아이콘)으로 단지명+주소 검색 열기 — 좌표 핀 없음. 전화 버튼 없음.

## 검증

SITE_TEST_RESULT=merge 뒤 10개 PASS: 새 validate_real_estate_region_favorites_p0(7개 화면 경우 전부), consumer_sections_02, onnuri_location_ux_p0, life_medical_category_entry_01, regional_news_p0_01, life_info_cleanup_final_01, my_child_school_01, jeonbuk_real_world_pilot_01, life_medical_auto_search_card_01, validate_hardening.py. Site CI 전체(115단계)는 이 PC에서 돌리지 않았다 — merge gate가 돈다.
NEW_FAILURES=0 — validate_site_refresh_route_restore_01: 정적 부분(route 표·opener·route 문자열) PASS, 브라우저 "I 로그인 왕복(Life Wallet/진위확인)" 단계 실패는 기준 c16a4759 detached 작업본에서도 같은 단계에서 2회 재현되는 이 PC 기존 실패.
NEW_VALIDATOR=scripts/validate_real_estate_region_favorites_p0.mjs (site-review.yml 등록) — Core 계약 모형으로 360/375(다크)/390/412/768/1280/1280(다크) 실제 터치·마우스 입력.
UPDATED_VALIDATORS=지역정보 카드 목록·개수를 고정한 7개(consumer_sections_02, life_medical_category_entry_01, life_medical_auto_search_card_01, life_info_cleanup_final_01, my_child_school_01, regional_news_p0_01, jeonbuk_real_world_pilot_01)에 새 카드 추가(8→9), site_refresh_route_restore_01에 route 2개 추가. 단언 삭제·완화 없음.
DEVICE_E2E=NOT VERIFIED (Android Samsung Internet·Android Chrome·iPhone Safari 실기기 없음 — 뷰포트·UA 흉내만)
LIVE_DATA=NOT VERIFIED (Core 실호출 전)
