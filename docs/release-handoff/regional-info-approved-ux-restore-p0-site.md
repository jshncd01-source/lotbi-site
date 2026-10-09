READY_FOR_DEPLOY=YES
CORE_CHANGED=NO (이 Site branch 기준. 지역뉴스 목록은 Core feature/regional-news-screen-list-01-core 712f94d4의 GET /v2/life/news를 부른다)
MIGRATION=NONE
DEPLOY_ORDER=CORE(CORE-T33: regional-news-screen-list-01-core 712f94d4) 먼저 → 이 SITE. Site만 먼저 나가면 지역뉴스 화면은 "지역뉴스를 불러오지 못했어요 + 다시 시도"로 멈추고, 나머지 복구(2열·병원·응급실·아이콘·카드 높이)는 정상 동작한다.
USER_DECISION_NEEDED=NONE (2026-10-10 소유자 결정 반영: 병원·응급실 통합, 약국 별도, 유치원·학교 카드 삭제·내 아이 학교·유치원 사용, 지역뉴스는 화면 안 광역시·도 목록·[오늘][1주일]·입력 금지·위치 허용 회원은 [위치 허용] 없음)

# regional-info-approved-ux-restore-p0-site — release handoff (2026-10-10)

TASK=REGIONAL_INFO_APPROVED_UX_RESTORE_P0 (+ REGIONAL-NEWS-SCREEN-LIST-01 Site, 같은 파일이라 한 branch)
REPO=lotbi-site
FEATURE_BRANCH=feature/regional-info-approved-ux-restore-p0-site
SITE_BASE_MAIN_SHA=576ec3465e3685e21fbe26a02a02129c76667739 (SITE-T43)
CODE_SHA=60730be98add843fadc3f05dbf50ba85e5689c9d
FEATURE_SHA=이 문서 커밋 (branch HEAD)
ASSET_VERSION=aset-1229ff0bb60f
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
PRODUCTION_DEPLOYED=NO

## ROOT_CAUSE

1. 모바일 1열: `site-consumer-layout.css` ≤600px의 `body.chat-home-page .consumer-workspace .consumer-shortcuts { grid-template-columns: minmax(0, 1fr); }`(10-05 커밋 325845a0)가 나중에 로드되며 2열을 덮었다.
2. 병원/응급실 분리, 범용 선형 SVG 전화·지도 아이콘, 둥근 테두리 버튼: 의료 자동검색 커밋 7500490a(10-09 00:51, `PLACE_ACTION_ICON_PATHS`)가 바꿨다. 승인 아이콘 이미지 `assets/place-actions/*.png`는 저장소에 그대로 남아 있었다.
3. 약국 카드 여백: 휴대폰 회전 카드 영역은 CSS grid(height:auto)로 이미 카드 높이에 맞고, 카드 아래 공간은 "1/3·다른 약국 보기" 줄(40px)이다. 영역 높이를 JS로 고정해 줄이는 시도는 사진이 늦게 로드될 때 카드를 잘라서(320px 검사 실패) 되돌렸다 — 휴대폰 회전 카드 배치·여백은 기존 그대로.
4. 교육 메뉴 중복: "유치원·학교"(공개 조회)와 "내 아이 학교·유치원"(회원 저장)이 별도 카드.

## 바뀐 것

- 지역정보 메뉴 7개(2열, 홀수 마지막 한 줄 전체): 병원·응급실 / 약국 / 축제·행사 / 지역뉴스 / 온누리상품권 / 지역생활정보 / 내 아이 학교·유치원.
  - 병원·응급실 → [병원·의원 찾기] [응급실 찾기] → 기존 질문("근처 병원 찾아줘"/"근처 응급실 찾아줘") 1회 전송. 카드만 눌러서는 아무것도 묻지 않음. 중복 전송 방지(asked 플래그 + 기존 2.5초 중복 방지).
  - 약국은 기존대로 한 번에 질문. Core 의료 계약·119 안내·신선도 정책 무변경.
  - 내 아이 학교·유치원 → [내 아이 정보](회원, 기존 로그인 안내 그대로) [유치원·학교 찾기](공개 조회, 비회원 허용 그대로). 별도 유치원·학교 카드는 소유자 지시로 삭제.
- 모바일 2열: 위 1열 규칙 제거, 간격 16px·아이콘 간격 10px, 긴 이름은 단어 단위 줄바꿈. 홀수 마지막 카드 규칙은 `site-consumer-design.css` 한 곳만 남김(education/onnuri/layout CSS의 중복 3개 삭제).
- 전화·지도 아이콘: 승인 이미지(`/assets/place-actions/phone.png`, 지도 = 설정 지도앱 `naver-map`/`kakao-map`/`tmap`/`google-maps`.png?v=place-icons-20260925) 32px, 44px 투명 버튼(모서리 10px). 이미지 실패 시 "전화"/"지도" 글자. 접근성 이름("…전화하기", "…길찾기 (지도앱)")·`readDefaultMapProvider()`·`buildDefaultMapHref()`·검증된 전화번호만 `tel:` 그대로.
- 회전 카드: 아이콘 외 배치·높이 변경 없음(위 3 참고). 결과 1개 → 옆 카드 없음, 개수 표시 = 실제 수, 필터 4개 1회만, 넘김·스크롤 고정은 기존 검사(life_medical_auto_search_card_01, place_card_*)로 확인.
- 지역뉴스(새 `site-life-news.js`·`site-life-news.css`): 화면 안 제목 목록. 대화로 아무것도 보내지 않음, 입력칸 없음.
  - 위치 사용 켬 + 이미 허용 → 현재 위치(소수 셋째 자리)로 바로 목록, [위치 허용] 없음. 아니면 저장 지역 목록 + [위치 허용](위치 사용 켬일 때만). 둘 다 없으면 17 시·도 선택.
  - 상단 "<시·도> 지역뉴스", "현재 위치 기준|저장 지역 기준|선택한 지역 · 오늘|1주일 · 최신순", 오른쪽 지역 변경(위치 아이콘). [오늘] [1주일].
  - 항목: 제목(2줄까지) + "언론사 · 시각", 누르면 원문 새 창(noopener noreferrer, http(s)만). 최신순 정렬, Core가 준 만큼만(채우기 없음).
  - 실패: "지역뉴스를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." + [다시 시도], 이전 목록 지움. 429 문구 따로. 0건: "오늘 … 관련 기사가 아직 없어요. 1주일을 눌러 보세요."
  - 시·군·구로 좁히기는 넣지 않음(소유자 "광역시·도 기준으로만").

## TEST_STATUS

TESTS=PASS (Windows 로컬, Chrome headless CDP 실제 터치/마우스, viewport emulation — 실기기 아님). 최종 코드 60730be98add843fadc3f05dbf50ba85e5689c9d 기준. 검사기는 한 번에 하나씩 순서대로 실행(다른 방 검사 실행 0·CPU 확인).
- 바뀐 파일·메뉴·장소 카드·지역뉴스를 참조하는 scripts/validate_* 57개: 55 PASS + 1 기존 실패 + 1 실행 중 수정 후 단독 PASS.
  - 기존 실패 1: validate_mobile_footer_legal_sheet_01("761px: mobile disclosure leaked into desktop") — site main 576ec346 원본(git archive)에서도 같은 실패. **NEW_FAILURES=0.**
  - validate_naver_maps_navigation_01: 7500490a가 바꾼 'route' 선 아이콘 단정을 승인 기준(설정 지도앱 아이콘 이미지)으로 되돌린 뒤 단독 PASS.
- 핵심 검사(모두 PASS):
  - validate_life_medical_category_entry_01 — 360/375/390/412/1280: **computed grid 2열**(CSS 문자열이 아니라 getComputedStyle), 모든 줄 꽉 참, 카드 같은 폭·같은 높이, 이름 한 줄, 첫 화면 안, 홀수 마지막 카드만 한 줄 전체, 병원·응급실만 눌러서는 전송 0 → 병원·의원 찾기/응급실 찾기 1회 전송, 약국 즉시 전송, 입력창 비움·포커스 없음.
  - validate_life_medical_auto_search_card_01 — 삼성 인터넷 UA 320x700·412x915, Android Chrome 360x780, iPhone UA 375x812·390x844(다크), PC 1280x900: 병원·응급실 선택 경유, 약국·응급실 카드, 회전·스와이프·순환, 1/N = 실제 수, 결과 1개면 옆 카드 없음, 필터 4개 1회, 전화 tel:·지도 링크, **아이콘 = /assets/place-actions/{phone,naver-map}.png 32px, 선 아이콘 없음, 버튼 모서리 10px·투명**, 119 정책(일반 응급실 검색엔 119 박스 없음, 증상 문장엔 119 버튼 1개) 그대로, 뒤로/앞으로 재전송 0.
  - validate_place_card_compact_01 — 지도 설정 4종(NAVER_MAP/KAKAO_NAVI/TMAP/GOOGLE_MAPS) × 화면: 버튼 = phone + 설정 지도앱, 아이콘 이미지 = phone / naver-map / kakao-map / tmap / google-maps .png 32px, 44px 터치, 새 창 noopener noreferrer.
  - validate_regional_news_p0_01 — 360/375/390/412/1280/390 다크: 위치 허용 전 [위치 허용]+시·도 선택(입력칸 0, 요청 0, 위치 요청 0) → 전북특별자치도 선택 시 목록(최신순, 링크 없는 기사 제외·채우기 없음, 제목 2줄 이하, "언론사 · 시각", 새 창 원문) → [1주일] → 꺼짐/실패 시 오류+다시 시도·목록 없음 → 저장 지역 자동 목록(위치 요청 0) → 위치 허용 상태면 현재 위치(소수 셋째 자리) 자동 목록·[위치 허용] 없음 → LOTBI 위치 사용 끔이면 버튼·위치 요청 0 → 지역뉴스 화면은 대화로 아무것도 안 보냄 → 대화창에 직접 물으면 기존 뉴스 카드 → 데스크톱 7개 배치.
  - validate_kindergarten_official_info_01(32) — 내 아이 학교·유치원 → 유치원·학교 찾기 경유, 비회원 공개 조회·탭·지역 선택·Core 꺼짐 안내 그대로.
  - validate_my_child_school_01(41) — 내 아이 학교·유치원 → 내 아이 정보, 비로그인 로그인 안내(/auth/start/)·Core 호출 0, 저장·동의 흐름 그대로.
  - validate_life_direct_chat_card_compaction_01 — 병원(병원·응급실 선택 경유, 고르기 전 요청 0)·약국·응급실·지역생활정보·유치원·학교 각각 1회 전송, 빠른 두 번 탭 1회, 키보드 없음, 사진 없는 카드 압축, 카드가 영역에 잘리지 않음.
  - validate_consumer_sections_02 — 메뉴 7개·순서, 병원·응급실 choices, 유치원·학교 카드 없음, 1열 규칙 재발 금지.
  - validate_life_info_cleanup_final_01, validate_life_location_context_01, validate_onnuri_merchant_search_01, validate_site_refresh_route_restore_01, place_card_*(cross_platform·carousel·deeplinks·naver_search_click 등), safecare·pet·calendar·subscription 계열 포함 PASS.
- asset 토큰: asset_cache_version.mjs --write → --check PASS (aset-1229ff0bb60f, targets 140), sync_theme_bootstrap --check PASS. 새 파일 site-life-news.js·site-life-news.css 포함.
- NOT TESTED: Linux trusted gate(배포총괄방), 삼성 인터넷·Android Chrome·iPhone Safari **실기기**(UA·viewport 흉내만), 운영 NAVER 실제 기사 목록(Core 712f94d4 운영 뒤 smoke).

## 겹치는 작업

- jeonbuk-real-world-pilot-01-site @ defa4655(SITE-T44b, 아직 main 아님)과 실질 충돌 7개(site-consumer-sections.js 2 + 검사기 6: 메뉴 목록). 그쪽은 '전북 맛집·음식'(id jeonbuk-food, 지역생활정보 다음) 1장을 더한다. 해소 = 합집합: 병원·응급실, 약국, 축제·행사, 지역뉴스, 온누리상품권, 지역생활정보, 전북 맛집·음식, 내 아이 학교·유치원(8개, 모든 줄 꽉 참 — 홀수 마지막 줄 규칙은 자동으로 적용 안 됨). 검사기 목록 단정(consumer_sections_02, life_info_cleanup_final_01, life_medical_category_entry_01, life_medical_auto_search_card_01, my_child_school_01, regional_news_p0_01 데스크톱 단계)에 jeonbuk-food 1개씩 추가, 카드 수 7→8.
- 전기차 충전소 P0 Site(소유자 명령 LOTBI_EV_CHARGER_NEARBY_LIST_P0)가 이 branch 위에 '전기차 충전소' 카드(약국 다음)를 더할 예정 — 그 방이 충돌을 흡수한다고 알려 옴.
- conversation-account-sync-01-site @ a959802d: 이 branch와 겹치는 파일 없음(토큰 제외).
