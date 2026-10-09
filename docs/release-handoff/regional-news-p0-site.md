READY_FOR_DEPLOY=YES
SUPERSEDES=e2757290
MIGRATION=NO
DEPLOY_ORDER=SITE 단독 (Core fd6a0b54는 이미 운영)
ACTIVATION=NAVER_NEWS_SEARCH_ENABLED=true — 소유자 승인 뒤 배포총괄방이 켠다. 꺼져 있으면 지역뉴스 질문은 일반 답변.
USER_DECISION_NEEDED=NONE

# regional-news-p0-site — release handoff (재병합 02, 2026-10-09)

TASK=LOTBI REGIONAL INFO + REGIONAL NEWS P0 (Site) — "생활정보"→"지역정보" 화면 문구, 지역뉴스 카테고리·진입, 뉴스 답변 카드
REPO=lotbi-site
FEATURE_BRANCH=feature/regional-news-p0-site
SITE_BASE_MAIN_SHA=0627058241ff7d562c811fff52063ba5bda9760a
CODE_SHA=30d97b3c01389410e6068bd5909444a7e30bf43a
FEATURE_SHA=이 문서 커밋 (branch HEAD — `git ls-remote origin refs/heads/feature/regional-news-p0-site`로 확인)
ASSET_VERSION=aset-adf14658ba9e
CORE_DEPENDENCY=lotbi-core feature/regional-news-p0-core fd6a0b54 (news_result 계약 CORE-REGIONAL-NEWS-01) — core main 포함·운영 배포됨, NAVER_NEWS_SEARCH_ENABLED=false
CORE_CHANGED=NO (이번 재병합)
ENV_CHANGE_REQUIRED=NO (Site)
SECRET_CHANGE_REQUIRED=NO
NEW_SECRET_CREATED=NO
PRODUCTION_DEPLOYED=NO

## 스위치 상태별 동작 (둘 다 검사로 확인)

- Core 스위치 꺼짐(지금 운영): Core `run_regional_news`가 `naver_news_search_ready=False`로 None → 일반 대화 경로. 응답에 `news_result` 없음 → Site는 답변 글만 보여 주고 뉴스 카드 0개. 지역뉴스 카테고리·양식·문장 전송은 그대로 동작(Core가 일반 답변).
- Core 스위치 켜짐: `news_result`(CORE-REGIONAL-NEWS-01) → 뉴스 카드(제목·언론사·시각·요약·원문 열기·관련 보도 N건, 이미지 칸 없음).
- 검사: `validate_regional_news_p0_01` 3b단계(꺼짐: 같은 진입 → Core에 "전주 뉴스 알려 줘" 그대로, 일반 답변 표시, `.lotbi-news-result` 증가 0) + 3·4·5단계(켜짐: 카드 5개, 원문 열기, 관련 보도 2건 등). 6개 화면 모두.

## 이번 재병합에서 한 일

- e2757290(옛 main 89adbb37 기준) 위에 최신 site main을 정상 merge: 2f1212ea → 35472a1b, 그 뒤 main 0627058241ff7d562c811fff52063ba5bda9760a → 30d97b3c. rebase·force push 없음.
- 토큰(`?v=aset-…`) 충돌은 세 쪽 토큰을 같은 값으로 맞춘 3-way 재병합으로 정리하고 `node scripts/asset_cache_version.mjs --write` → `--check` PASS.
- 실질 충돌 7개 파일 해소 (main 쪽 기능은 전부 유지):
  1. `site-consumer-sections.js`
     - `LIFE_SHORTCUTS` = 병원·의원, 약국, 축제·행사, **지역뉴스**, 온누리상품권, 지역생활정보, 유치원·학교 (7개). 지역뉴스는 원래대로 축제·행사 바로 다음. 홀수 7개라 마지막 유치원·학교가 한 줄 전체(main의 site-life-education.css / site-life-onnuri.css 규칙 그대로) → main 배치 검사(빈 칸 없음·모든 행 꽉 참·같은 폭) 통과.
     - 아이콘 집합에 news·school 둘 다. 클릭: festivals → 축제, news → openNewsEntry, onnuri → 온누리, education → 유치원·학교, 나머지 → 상세.
     - 상세·유치원·학교 ← 라벨 "지역정보로 돌아가기"(main의 여러 줄 back 동작 그대로).
  2. `site-conversation.js` — 축제·행사 / 롯비함 surface: main 줄(backRoute 'life', LOTBI_BOX_UI_ENABLED)에 라벨만 "지역정보로 돌아가기". main에 새로 들어온 온누리상품권 surface ← 라벨도 같은 이름으로(원래 명령 범위 "← 지역정보로 돌아가기").
  3. `site-life-location.js` — main의 `lifeLocationIntent(text, recentContext)`(온누리 후속 질문) + 이 branch의 뉴스 위치 규칙: `const lifeLookup = lifeLocationIntent(text, recentContext); if (!lifeLookup && !newsLocationIntent(text)) return null;`
  4. `subscribe.html` — 요금표 행 "지역정보 · 날씨·장소·축제 등" (main이 "공과금"을 뺀 문구 + 이름 변경).
  5. `.github/workflows/site-review.yml` — 지역뉴스 단계 + main의 진위확인·다크 입력창 단계 모두 유지.
  6. `scripts/validate_consumer_sections_02.mjs` — main 검사 유지(공과금 숨김·금지어 포함), 목록에 지역뉴스 추가(7개), prompt 검사 제외 목록에 'news' 추가.
  7. `scripts/validate_life_medical_category_entry_01.mjs` — main 검사 유지(빈 칸 없음·모든 행 꽉 참·같은 폭·첫 화면 안·질문바/하단 row 없음), 목록·카드 수만 7개, 제목 문구 '지역정보'. 공과금 상세 시험은 main대로 없음.
- 문구만 맞춘 main 검사기: `scripts/validate_life_info_cleanup_final_01.mjs` — ← 버튼을 찾는 글자 '지역정보로 돌아가기', 기대 카테고리 id 목록에 'news' 추가. 판정 기준(공과금·질문바·하단 row·롯비함 없음) 그대로.
- 지역뉴스 검사기에 "Core 스위치 꺼짐" 단계(3b) 추가.

바꾸지 않은 것: 내부 id `life`, route `#life`, section id, localStorage/cookie key, Core API path, "생활에 필요한 정보" 소제목, "지역생활정보" 카테고리명과 그 양식의 "궁금한 생활정보" 칸 이름, 개발용 주석.

## TEST_STATUS

TESTS=PASS (Windows 로컬, Chrome headless CDP 실제 터치/마우스, viewport emulation — 실기기 아님). 최종 코드 30d97b3c 기준.
- validate_regional_news_p0_01 PASS — 360x780 · 375x812 · 390x844 · 412x915 · 1280x900 · 390x844 dark
  - 지역정보 제목·설명, 지역뉴스 카드(아이콘·한 줄·잘림 없음·44px 이상·같은 높이), 가로 스크롤 0
  - 저장 지역 없음 → 양식(키보드 안 올라옴) → "군산" → Core에 "군산 뉴스 알려 줘" 그대로, 위치 없음, geolocation 0
  - 스위치 켜짐: 카드 5개, 제목 3줄 이내·언론사·시각·요약, 이미지/미디어 0, 원문 열기(원문 URL·_blank·noopener), 관련 보도 2건 펼침(javascript: 링크 버림), 요약 없는 기사 빈 줄 없음
  - **스위치 꺼짐(3b)**: 같은 양식 → Core에 "전주 뉴스 알려 줘" 그대로 → 일반 답변 글 표시, 뉴스 카드 묶음 증가 0, 원문 열기 없음, 가로 스크롤 0
  - ← 지역정보: 홈 복원 + 지역뉴스 카드 포커스 / 저장 지역 전주시 → 1탭 "전주시 뉴스 알려 줘" + location {SAVED_REGION, 전주시} / 내 주변: 위치 사용 기본+권한 거부 → 위치 없음, 위치 사용 끔 → geolocation 0
  - 다크 카드 글자 대비, 데스크톱 홀수 마지막 카드 한 줄 전체
- 생활정보·장소·의료 카드 검사기 PASS: life_medical_category_entry_01(카드 7개·빈 칸 없음·모든 행 꽉 참·같은 폭·첫 화면 안), life_info_cleanup_final_01(360/375/390/412/1280), kindergarten_official_info_01, onnuri_merchant_search_01, place_medical_card_ux_final_01, place_card_compact_01, place_card_naver_search_click_01, place_card_carousel_no_drift_01, place_card_cross_platform_01, place_card_map_deeplinks_01, life_detail_design_01, life_location_context_01, site_refresh_route_restore_01, consumer_sections_02, consumer_design_shell_01, consumer_detail_system_01, festival_nav_wiring_01, lotbi_box_nav_01, uiux_phase1_01
- asset 토큰: `asset_cache_version.mjs --write` → `--check` PASS (aset-adf14658ba9e, targets 135), `sync_theme_bootstrap.mjs --check` PASS
- 전체 회귀: scripts/validate_* 248개(.mjs 228 · .py 19 · .js 1), CHROME_BIN 슬래시 경로, LF 작업본
  - 1차(2 shard 병렬, CPU 100%·다른 방 회귀 동시 실행): 233 PASS / 15 FAIL
  - 15개 단독 재실행(고정 포트가 비었는지 확인 후): 13 PASS → **NEW_FAILURES=0**
  - 기존 실패 2(main 06270582 기준 작업본에서도 같은 실패): validate_mobile_footer_legal_sheet_01("761px: mobile disclosure leaked into desktop"), validate_site_avatar_fallback_runtime
  - 나머지 13개는 부하·포트 겹침 원인(단독 PASS): 캘린더 검사기 10개(4191·4193·4197·4198·4267·4318 고정 포트 — 다른 방의 같은 검사기가 포트를 먼저 잡으면 그 방 작업본을 읽어 site-regional-news.js 없음으로 모듈 로드 실패; 포트가 빈 것을 확인한 단독 실행 PASS), auth_unknown_recovery_browser_01(검사 PASS 뒤 Chrome 임시 폴더 삭제 EPERM, 단독 재실행 PASS), chat_dark_login_kakao_share_01·chat_long_answer_scroll_anchor_01(사용자 중지 때 종료, 단독 PASS)
  - place_card_compact_01: 전체 회귀 PASS. 관련 검사 1차·단독 1회는 4213 포트를 다른 방 검사기가 잡아 실패 → 포트 빈 단독 실행 PASS
- Linux CI(site-review.yml) NOT TESTED.

## 겹치는 작업 (나중에 main에 들어가는 쪽이 다시 merge)

이 READY(30d97b3c01389410e6068bd5909444a7e30bf43a) 기준 token 정규화 merge-tree 미리보기:
- life-medical-auto-search-card-01-site @ c8457c1e: main과는 실질 충돌 0, 이 branch와 5개 파일(site-consumer-sections.js 4 · site-life-location.js 1 · 검사기 3개 — 카테고리 목록·위치 규칙). 해소 기준: 카테고리 목록은 두 쪽 합집합(그쪽 응급실 + 지역뉴스), 홀수/짝수에 따라 main의 "빈 칸 없음" 검사 그대로, ← 라벨 "지역정보로 돌아가기", site-life-location은 `lifeLookup`(그쪽 규칙 포함) + `newsLocationIntent`.
- my-child-school-01-site @ 271cb2dc: main과 실질 충돌 0, 이 branch와 4개 파일(site-consumer-sections.js 1 · 검사기 3개 — 카테고리 목록).
- life-info-direct-chat-card-compaction-01-site @ 5e2ca2c5: main과도 이미 6개 파일 충돌(옛 main 기준), 이 branch와도 같은 6개. 1탭 전송은 그 branch의 onDraft 변경을 쓰며, 지역뉴스는 onDraft만 호출하므로 그쪽이 들어오면 지역뉴스도 1탭 전송(검사기 `sentAfterEntry`가 DRAFT·DIRECT 둘 다 받음).
- jeonbuk-real-world-pilot-01-site @ 8cb40b01: main과도 이미 5개 파일 충돌, 이 branch와 6개(site-review.yml · site-conversation.js · site-core.js · site-consumer-sections.js · 검사기 2).

## DEPLOY_ORDER

1. 이 Site branch merge·배포 (Core fd6a0b54는 이미 운영, 스위치 꺼짐 → 지역뉴스 질문은 일반 답변, 화면 이름은 "지역정보")
2. (별도, 소유자 승인 뒤) 배포총괄방이 Core env `NAVER_NEWS_SEARCH_ENABLED=true` → Production "오늘 전주 뉴스" smoke로 카드 확인
