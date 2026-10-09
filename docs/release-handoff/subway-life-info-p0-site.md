READY_FOR_DEPLOY=NO
REASON=짝 Core의 실시간 공급자 접근이 막혀 있음(PROVIDER_ACCESS=BLOCKED: 서울 실시간 지하철 키 없음 + http 전용 전송 미승인). 화면 코드·검증은 완료(CODE_READY=YES). 또한 이 branch는 지역정보 UX 복구 READY 0dbed91a 위에 있어 그 READY(SITE-T46 예정)가 main에 들어간 뒤 main merge가 필요.
CODE_READY=YES
MIGRATION=NO
USER_DECISION_NEEDED=①②③ Core 문서와 같음 + ④지역정보 카드가 짝수(8·10장)일 때 휴대폰에서 '내 아이 학교·유치원' 두 줄 허용 여부(현재 승인 규칙은 한 줄; 전기차와 함께 9장이면 문제 없음, 지역정보 복구 새 READY 8장+전기차+지하철=10장이면 다시 발생)

# SUBWAY-LIFE-INFO-P0 (+ 15058052 추가지시) — Site

TASK=LOTBI_SUBWAY_LIFE_INFO_P0
REPO=lotbi-site
FEATURE_BRANCH=feature/subway-life-info-p0-site
BASE=0dbed91a (feature/regional-info-approved-ux-restore-p0-site READY, main 576ec346 포함) — 승인된 지역정보 UX 위에 카드를 올리기 위해서. main merge는 그 READY가 main에 반영된 뒤.
AUTHORITATIVE_MAIN=56c26095959e3a537d69658a9307b356d4e34080 — 이 branch에 아직 merge 안 함(READY=NO). 재제출 때 최신 main + 지역정보 복구 새 READY(c16a4759, 8장) + 전기차 READY를 merge하고 카드 목록·검사기 합집합 후 전체 검사기 실행
CODE_SHA=adb2a446f
ASSET_VERSION=aset-f2506f75ecd1
PAIRED_CORE=feature/subway-life-info-p0-core (DEPLOY_ORDER=CORE 먼저 → SITE)
PAIRED_WEB_THEME_SYNC=NOT_NEEDED (site-theme-tokens.css 변경 없음)

## 화면

- 지역정보에 '지하철 정보' 카드 1개(지역뉴스 다음). 카드 8개 → 휴대폰 2열 모든 줄이 꽉 참. 추가 메뉴·중복 화면 없음(15058052는 같은 화면·같은 Core API).
- /#subway (지하철 정보): 가까운 역 찾기(LOTBI 위치 설정이 켜져 있고 브라우저가 허용할 때만, 좌표 소수 4자리·이번 요청만), 반경 1·2·3·5km, 역 이름 검색(공식 별칭: 서울역·이수·응암 등), 호선으로 찾기, 서울시 제공 범위 밖 안내(부산 서면 → 다른 지역 미연결 안내, 다른 지역 데이터로 대체하지 않음).
- /#subway-station (역): 같은 장소 호선 칩(강남 2호선·신분당선), 방향 칩(상행/하행/내선/외선 + 공식 trainLineNm의 방면), 실시간 도착 목록(공식 arvlMsg2 문구, "지금 기준 약 N분 M초 남음", "정보 생성 HH:MM:SS (N초 전)", 급행·막차 표시, 열차 위치 "교대 출발 · HH:MM:SS 수신"), 마지막 확인 시각, 새로고침(5초 간격 제한), 시간대별 평균 혼잡도(과거 자료) — 평일/토/일, 30분 시간대, 방향별 %와 단색 막대(눈금 34%·100%), "실시간 혼잡도가 아님·칸별 실시간 없음" 문구, 기준 분기·출처.
- 상태 문구: NOT_READY(연결 준비 중, 평균 혼잡도는 표시), STALE(오래된 정보라 표시 안 함 + 마지막 공식 생성 시각), EMPTY, UNAVAILABLE, QUOTA_EXCEEDED, 네트워크 오류.
- AI 챗 호출 0건, 입력창에 아무것도 넣지 않음, Core 공개 GET만(credentials omit, no-referrer).
- 뒤로가기: 역 → 지하철 정보(검색 상태 유지) → 지역정보 → 홈. 화면의 ←도 같은 단계. 새로고침·앞으로가기 때 역·호선·방향·요일·시간대를 그 history 항목에서 복원, 위치는 다시 묻지 않음.

## 변경 파일

site-life-subway.js · site-life-subway.css (신규)
site-consumer-sections.js (카드·아이콘·onSubway) · site-conversation.js (openSubway / openSubwayStation, 라우트 opener 2개) · site-route.js ('subway', 'subway-station')
site-consumer-layout.css (휴대폰 지역정보 격자 grid-auto-rows: 1fr — 8번째 카드 '내 아이 학교·유치원'이 반 칸에서 두 줄이 되어 360px에서 카드 높이가 60/62px로 갈리던 것 통일)
index.html · auth/callback/index.html (CSS 링크) · 자산 토큰 일괄 갱신
scripts/validate_subway_life_info_p0_01.mjs + scripts/fixtures/subway_life_info_p0_01.json (Core scripts/export_subway_site_fixture.py가 Core 코드로 생성)
카드 7→8개·라우트 2개 추가에 맞춘 기존 검사기 기대값: consumer_sections_02, life_info_cleanup_final_01, life_medical_auto_search_card_01, life_medical_category_entry_01, my_child_school_01, regional_news_p0_01, site_refresh_route_restore_01
.github/workflows/site-review.yml (새 검사기 등록)

## 검증

SITE_TEST_RESULT=validate_subway_life_info_p0_01 PASS(110 checks, 360·375·390·412·1280, 라이트·다크, 키보드). 카드·라우트 목록 영향 검사기: consumer_sections_02·kindergarten_official_info_01·life_direct_chat_card_compaction_01·life_info_cleanup_final_01·life_medical_auto_search_card_01·my_child_school_01·onnuri_merchant_search_01·regional_news_p0_01 PASS. validate_life_medical_category_entry_01 FAIL — 360px에서 '내 아이 학교·유치원 label stays on one line 2 !== 1' (카드 8장이면 마지막 카드가 반 칸이 되어 두 줄; 승인 UX 규칙이라 고치지 않음 → USER_DECISION). validate_site_refresh_route_restore_01: static PASS·지하철 라우트 포함 휴대폰 케이스 PASS, 로그인 복귀(I) 단계가 반복 실패 — 기준 0dbed91a에서도 같은 단계 같은 상태(handoffs 3, auth checking)로 실패(3회 중 1회), 인증은 화면 뒤 0.5~0.75초에 완료되는 검사 경쟁조건 + 다른 방 검사기 동시 실행 부하. 전체 233개 검사기 일괄 실행: NOT RUN(부하, READY=NO라 재제출 때 최신 main merge 후 실행).
NEW_FAILURES=1 — validate_life_medical_category_entry_01(8장 상태의 한 줄 라벨 규칙, 기능 결함 아님·소유자 결정 필요). 그 외 0.
NO_AUTO_CHAT_PASS=YES
STATION_SEARCH_PASS=YES
NEARBY_STATION_PASS=YES (fixture: Core가 공식 좌표로 계산한 강남 30m 등)
LINE_DIRECTION_PASS=YES
BACK_NAVIGATION_PASS=YES (브라우저 history 기준; Android 앱 실기기 시스템 뒤로가기는 NOT MEASURED)
MOBILE_TWO_COLUMN_PASS=YES
DARK_LIGHT=YES (390·412·1280 다크)
WIDTHS=360·375·390·412·1280
A11Y=모든 버튼·입력에 읽히는 이름, 칩 묶음 aria-label, 상태 문구 role=status, 데스크톱 키보드 Enter로 역 열기
REALTIME_LIVE=Core 문서 참조(운영 키 없음)

## 예상 충돌

CONFLICTS_EXPECTED_WITH=feature/ev-charger-nearby-list-p0-site(9d053149b, 같은 base 0dbed91a, 아직 push 전): LIFE_SHORTCUTS 카드 줄, 카드 목록을 고정한 검사기 7개의 목록 줄, SITE_ROUTES·siteRouteOpeners·mountConsumerSection 인자 줄, index.html CSS 링크 줄, 자산 토큰 — 모두 합집합(카드 9개가 되면 홀수 → 마지막 카드 한 줄 전체 규칙). 실질 판단이 필요한 충돌 없음.

## 배포·롤백

DEPLOY=짝 Core 배포 후 일반 Site 배포. migration·env 없음.
SMOKE=지역정보 → 지하철 정보 카드 → 역 검색 '강남' → 역 화면(실시간은 키 전까지 '연결 준비 중', 평균 혼잡도 표시) → 뒤로가기 3회 홈
ROLLBACK=이전 Site 이미지. Core만 남아도 무해(공개 GET, 화면 없으면 호출 없음).
PRODUCTION_CHANGED=NO
