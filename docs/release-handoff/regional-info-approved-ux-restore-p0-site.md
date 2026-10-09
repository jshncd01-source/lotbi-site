READY_FOR_DEPLOY=YES
SUPERSEDES=0dbed91a4a7463031e0e44cdbf4d974f40f4d8ba (같은 기능, site main 576ec346 기준 — SITE-T44c 뒤로 다시 merge)
CORE_CHANGED=NO (이 Site branch 기준. 지역뉴스 목록은 Core feature/regional-news-screen-list-01-core 712f94d4의 GET /v2/life/news를 부른다)
MIGRATION=NONE
DEPLOY_ORDER=SITE 단독 (Core 712f94d4 = CORE-T33, 2026-10-10 03:21 운영 반영됨 — GET /v2/life/news 운영 smoke OK)
USER_DECISION_NEEDED=NONE (2026-10-10 소유자 결정 반영: 병원·응급실 통합, 약국 별도, 유치원·학교 카드 삭제·내 아이 학교·유치원 사용, 지역뉴스는 화면 안 광역시·도 목록·[오늘][1주일]·입력 금지·위치 허용 회원은 [위치 허용] 없음)

# regional-info-approved-ux-restore-p0-site — release handoff (2026-10-10)

TASK=REGIONAL_INFO_APPROVED_UX_RESTORE_P0 (+ REGIONAL-NEWS-SCREEN-LIST-01 Site, 같은 파일이라 한 branch)
REPO=lotbi-site
FEATURE_BRANCH=feature/regional-info-approved-ux-restore-p0-site
SITE_BASE_MAIN_SHA=80da26b7f12b68a94300ef7035047c217ffa6776 (SITE-T44c: 전북 Site + 대화 기록 Site + 온누리 P0 Site + Life Wallet PIN·첨부)
CODE_SHA=c3501724c3091af95970222172b938662e822161
FEATURE_SHA=이 문서 커밋 (branch HEAD)
ASSET_VERSION=aset-64e669944e50
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
PRODUCTION_DEPLOYED=NO

## ROOT_CAUSE

1. 모바일 1열: `site-consumer-layout.css` ≤600px의 `body.chat-home-page .consumer-workspace .consumer-shortcuts { grid-template-columns: minmax(0, 1fr); }`(10-05 커밋 325845a0)가 나중에 로드되며 2열을 덮었다.
2. 병원/응급실 분리, 범용 선형 SVG 전화·지도 아이콘, 둥근 테두리 버튼: 의료 자동검색 커밋 7500490a(10-09 00:51, `PLACE_ACTION_ICON_PATHS`)가 바꿨다. 승인 아이콘 이미지 `assets/place-actions/*.png`는 저장소에 그대로 남아 있었다.
3. 약국 카드 여백: 휴대폰 회전 카드 영역은 CSS grid(height:auto)로 이미 카드 높이에 맞고, 카드 아래 공간은 "1/3·다른 약국 보기" 줄(40px)이다. 영역 높이를 JS로 고정해 줄이는 시도는 사진이 늦게 로드될 때 카드를 잘라서(320px 검사 실패) 되돌렸다 — 휴대폰 회전 카드 배치·여백은 기존 그대로.
4. 교육 메뉴 중복: "유치원·학교"(공개 조회)와 "내 아이 학교·유치원"(회원 저장)이 별도 카드.

## 바뀐 것

- 지역정보 메뉴 8개(2열, 모든 줄 꽉 참 — 홀수가 되면 마지막 카드가 한 줄 전체): 병원·응급실 / 약국 / 축제·행사 / 지역뉴스 / 온누리상품권 / 지역생활정보 / 전북 맛집·음식(SITE-T44c) / 내 아이 학교·유치원.
  - 병원·응급실 → [병원·의원 찾기] [응급실 찾기] → 기존 질문("근처 병원 찾아줘"/"근처 응급실 찾아줘") 1회 전송. 카드만 눌러서는 아무것도 묻지 않음. 중복 전송 방지(asked 플래그 + 기존 2.5초 중복 방지).
  - 약국은 기존대로 한 번에 질문. Core 의료 계약·119 안내·신선도 정책 무변경.
  - 내 아이 학교·유치원 → [내 아이 정보](회원, 기존 로그인 안내 그대로) [유치원·학교 찾기](공개 조회, 비회원 허용 그대로). 별도 유치원·학교 카드는 소유자 지시로 삭제.
- 모바일 2열: 위 1열 규칙 제거, 간격 16px·아이콘 간격 10px, 긴 이름은 단어 단위로 두 줄까지(줄 간격 1.25 — 두 줄도 같은 60px 카드 높이). 홀수 마지막 카드 규칙은 `site-consumer-design.css` 한 곳만 남김(education/onnuri/layout CSS의 중복 3개 삭제).
- 전화·지도 아이콘: 승인 이미지(`/assets/place-actions/phone.png`, 지도 = 설정 지도앱 `naver-map`/`kakao-map`/`tmap`/`google-maps`.png?v=place-icons-20260925) 32px, 44px 투명 버튼(모서리 10px). 이미지 실패 시 "전화"/"지도" 글자. 접근성 이름("…전화하기", "…길찾기 (지도앱)")·`readDefaultMapProvider()`·`buildDefaultMapHref()`·검증된 전화번호만 `tel:` 그대로.
- 회전 카드: 아이콘 외 배치·높이 변경 없음(위 3 참고). 결과 1개 → 옆 카드 없음, 개수 표시 = 실제 수, 필터 4개 1회만, 넘김·스크롤 고정은 기존 검사(life_medical_auto_search_card_01, place_card_*)로 확인.
- 지역뉴스(새 `site-life-news.js`·`site-life-news.css`, index.html과 auth/callback/index.html 둘 다 링크): 화면 안 제목 목록. 대화로 아무것도 보내지 않음, 입력칸 없음.
  - 위치 사용 켬 + 이미 허용 → 현재 위치(소수 셋째 자리)로 바로 목록, [위치 허용] 없음. 아니면 저장 지역 목록 + [위치 허용](위치 사용 켬일 때만). 둘 다 없으면 17 시·도 선택.
  - 상단 "<시·도> 지역뉴스", "현재 위치 기준|저장 지역 기준|선택한 지역 · 오늘|1주일 · 최신순", 오른쪽 지역 변경(위치 아이콘). [오늘] [1주일].
  - 항목: 제목(2줄까지) + "언론사 · 시각", 누르면 원문 새 창(noopener noreferrer, http(s)만). 최신순 정렬, Core가 준 만큼만(채우기 없음).
  - 실패: "지역뉴스를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." + [다시 시도], 이전 목록 지움. 429 문구 따로. 0건: "오늘 … 관련 기사가 아직 없어요. 1주일을 눌러 보세요."
  - 시·군·구로 좁히기는 넣지 않음(소유자 "광역시·도 기준으로만").

## TEST_STATUS

TESTS=PASS (Windows 로컬, Chrome headless CDP 실제 터치/마우스, viewport emulation — 실기기 아님). 최종 코드 c3501724(main 80da26b7 포함) 기준. 검사기는 한 번에 하나씩 순서대로(다른 방 검사기가 동시에 돌 때 생긴 고정 포트·부하 실패는 포트가 빈 뒤 단독 재실행).
- 1차(메뉴·장소 카드·지역뉴스·T44c 검사기 65개): 61 PASS. 실패 4 중 3개는 합집합 8장 기대값(전북 순서·두 줄 이름·같은 높이) 맞춘 뒤 단독 PASS, 1개 기존 실패.
- 2차(index.html·auth/callback을 참조하는 나머지 검사기 97개 + 메뉴 검사기 9개 재확인 = 106개): 101 PASS. 실패 5 → 단독 재실행: calendar_day_panel_two_buttons_01·calendar_month_geometry_01·calendar_quiet_location_01·samsung_composer_keyboard_01 PASS(다른 방 동시 실행 때 고정 포트·부하), message_calendar_footer_editor_01은 main 80da26b7 원본(git archive)에서도 같은 "Failed to fetch dynamically imported module" 실패 → 기존 실패.
- 기존 실패(이번 변경과 무관, main에서도 실패): validate_mobile_footer_legal_sheet_01("761px: mobile disclosure leaked into desktop"), validate_message_calendar_footer_editor_01(모듈 로드). **NEW_FAILURES=0.**
- 핵심 검사(모두 PASS, 앞 READY 0dbed91a 내용 유지 + 8장 기준):
  - validate_life_medical_category_entry_01 — 360/375/390/412/1280: computed grid 2열, 모든 줄 꽉 참, 같은 폭·같은 높이, 이름 1~2줄·잘림 없음, 첫 화면 안, 홀수일 때만 마지막 카드 한 줄 전체, 병원·응급실만 눌러서는 전송 0 → 선택 1회 전송.
  - validate_life_medical_auto_search_card_01 — 삼성 인터넷 UA 320/412, Android Chrome 360, iPhone UA 375/390(다크), PC 1280: 승인 아이콘 이미지 32px·투명 버튼, 회전·1/N·필터·119 정책·뒤로/앞으로 재전송 0.
  - validate_place_card_compact_01 — 지도 설정 4종 × 화면: phone + 설정 지도앱 아이콘 이미지.
  - validate_naver_maps_navigation_01 — 지도 버튼 = mapPresentation.icon 이미지, route 선 아이콘 없음.
  - validate_regional_news_p0_01 — 6개 화면: 시·도 선택/저장 지역/현재 위치 자동 목록, [오늘][1주일], 오류·다시 시도, [위치 허용] 규칙, 대화로 전송 0, 데스크톱 8장 배치.
  - validate_auth_continuity_02 — 콜백 페이지에 site-life-news.css 포함.
  - validate_jeonbuk_real_world_pilot_01 — 전북 맛집·음식 카드·상세·문장, 8장/7장 모두 빈 칸 없음.
  - validate_kindergarten_official_info_01(32), validate_my_child_school_01(41), validate_life_direct_chat_card_compaction_01, validate_consumer_sections_02, validate_life_info_cleanup_final_01, onnuri·conversation_account_sync·life_wallet(T44c) 검사기 PASS.
- asset 토큰: asset_cache_version.mjs --write → --check PASS (aset-64e669944e50, targets 143), sync_theme_bootstrap --check PASS.
- 운영 Core(03:21~) 실호출(GET /v2/life/news, 이 방 확인): 전북특별자치도·오늘 6건 대부분 지역 기사(전북은행·전북개발공사·전북 날씨), 스포츠팀명("전북 상대로 역전승") 1건 섞임. 서울특별시·오늘 10건 중 같은 행사 [포토뉴스] 5건 개별 표시·국가대표 탁구·"제주 비…서울 26도" 전국 날씨 섞임 → **Core 뉴스 관련성·중복 품질은 후속 과제(이 Site READY 범위 밖)**.
- NOT TESTED: Linux trusted gate(배포총괄방), 삼성 인터넷·Android Chrome·iPhone Safari 실기기.

## 겹치는 작업

- 전기차 충전소 P0 Site(LOTBI_EV_CHARGER_NEARBY_LIST_P0)가 이 READY 위에 '전기차 충전소' 카드(약국 다음)를 더한다 → 9장(홀수, 마지막 카드 한 줄 전체). 그 방이 충돌을 흡수한다고 알려 옴. 카드 목록 단정 검사기: consumer_sections_02, life_info_cleanup_final_01, life_medical_category_entry_01, life_medical_auto_search_card_01, my_child_school_01, regional_news_p0_01(데스크톱 단계), jeonbuk_real_world_pilot_01.
