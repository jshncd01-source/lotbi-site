READY_FOR_DEPLOY=NO
READY_FOR_DEPLOY_REASON=지역뉴스 카드는 Core feature/regional-news-p0-core 배포 + NAVER 뉴스 검색 연결(NAVER_NEWS_SEARCH_ENABLED) 뒤에만 뉴스 카드로 답한다. 연결 전에 Site만 나가면 지역뉴스 질문이 일반 대화 답변으로 간다.
READY_FOR_PROVIDER_CONNECT=YES
NAVER_NEWS_API_ENABLE_REQUIRED=YES
BLOCKER=NAVER_NEWS_API_ENABLE_REQUIRED (2026-10-08 콘솔 확인: API HUB 애플리케이션 LOTBI-Local-Search에 검색>뉴스 미등록 — Core handoff 참고)

# regional-news-p0-site — release handoff

TASK=LOTBI REGIONAL INFO + REGIONAL NEWS P0 (Site) — "생활정보"→"지역정보" 화면 문구, 지역뉴스 카테고리·진입, 뉴스 답변 카드
REPO=lotbi-site
FEATURE_BRANCH=feature/regional-news-p0-site
SITE_BASE_MAIN_SHA=89adbb378a11fba8e42a445b62f5ffab8f358f5f
CODE_SHA=a4346ab6d79f4b336c8653ac6c5095677b65630e
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote origin refs/heads/feature/regional-news-p0-site`)
ASSET_VERSION=aset-720f2663ecb5
DEPENDS_ON=lotbi-core feature/regional-news-p0-core @ e8d7862a1a8621f73c75387e26af4eebffccbbb4 (news_result contract CORE-REGIONAL-NEWS-01) + NAVER API HUB 검색>뉴스 연결

LIFE_INFO_LABEL_RENAMED_TO_REGION_INFO=YES (화면 문구만: nav 2곳 label·aria-label, 섹션 제목·설명, ← 지역정보로 돌아가기 3곳, 요금표 행. route `life`·section id·storage key·API path 그대로)
REGIONAL_NEWS_CATEGORY=YES (축제·행사 다음, 라인 신문 아이콘)
SHARED_REGION_CONTEXT=PARTIAL (Site: 지역뉴스는 병원·약국과 같은 site-life-location 계약을 쓴다. 지역 결정 우선순위는 Core app/region_context.py)
NEWS_CARD_COMPACT=YES
NO_IMAGE_BLANK_AREA_PASS=YES
ORIGINAL_ARTICLE_HANDOFF=YES (원문 열기 = 언론사 원문 URL, 새 창, rel=noopener noreferrer)
RELATED_COVERAGE_COUNT=YES (관련 보도 N건, 펼치면 다른 언론사 기사 링크 최대 5개)
MOBILE_360_PASS=YES
MOBILE_375_PASS=YES
MOBILE_390_PASS=YES
MOBILE_412_PASS=YES
DESKTOP_REGRESSION=PASS (1280x900)
DARK_THEME_PASS=YES (390x844 dark)
NO_AUTO_KEYBOARD=YES (지역뉴스 양식은 제목에 포커스. 1탭 전송·키보드 닫힘은 life-info-direct-chat-card-compaction-01-site와 합친 상태에서 PASS — 이 branch 단독은 main의 기존 "입력창에 넣기" 동작을 그대로 씀)
DEPENDS_ON_FOR_ONE_TAP_SEND=feature/life-info-direct-chat-card-compaction-01-site (지역뉴스 카드·양식은 기존 onDraft만 호출한다. 질문 바로 전송·키보드 비호출은 그 branch가 onDraft를 바꿔 주는 기능이며, 이 branch 단독 배포 시에는 main 동작 유지)

CORE_CHANGED=YES (별도 branch feature/regional-news-p0-core)
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO (Site)
SECRET_CHANGE_REQUIRED=NO
NEW_SECRET_CREATED=NO
EXISTING_SECRET_CHANGED=NO
PRODUCTION_DEPLOYED=NO

## SCOPE (실제 변경 파일)

- `index.html` — nav "생활정보" → "지역정보" (desktop·mobile, label + aria-label).
- `site-conversation.js`
  - 섹션 제목·설명: `['지역정보', '저장한 지역과 내 주변의 필요한 정보를 찾아보세요.']`. 축제·행사 / 롯비함의 ← 라벨 "지역정보로 돌아가기".
  - `news_result`가 있는 답변에 뉴스 카드(`createNewsResultCards`) — guest·로그인 둘 다 meta에 저장, 다시 그릴 때도 같은 카드.
- `site-core.js` — 응답의 `news_result`(contract_id `CORE-REGIONAL-NEWS-01`만) → `newsResult` (guest·로그인 2곳).
- `site-regional-news.js` (신규) — 카드: 제목, 언론사(원문 주소의 host — API가 언론사명을 주지 않음), 상대 시각, 검색 요약 1–2줄, "원문 열기", 관련 보도 N건(`<details>`). 이미지 요소·이미지 칸 없음. http(s)가 아닌 링크는 버림. 하단 "검색: NAVER · 기사: 각 언론사".
- `site-regional-news.css` (신규) — 첫 카드가 그려질 때 한 번 주입. 학교·장소 카드와 같은 테두리·radius, light/dark 토큰.
- `site-consumer-sections.js`
  - `LIFE_SHORTCUTS`에 `{id: 'news', label: '지역뉴스', icon: 'news'}` (축제·행사 다음), 라인 신문 아이콘.
  - 저장 지역(캘린더 날씨 지역)이 있으면 1탭으로 "<지역> 뉴스 알려 줘". 없으면 지역 한 칸 양식 + "내 주변 뉴스". ← 는 열기 전 화면을 그대로 되살리고 지역뉴스 카드로 포커스.
  - 상세 화면 ← 라벨 "지역정보로 돌아가기".
- `site-life-location.js` — 뉴스 질문(뉴스·소식·기사·속보)에도 저장 지역을 싣는다. 현재 위치는 근처/주변/여기 표현이 있고 위치 사용이 켜진 경우에만 요청(브라우저 권한 창이 동의). 위치 사용 끔이면 요청 안 함. 지역을 말한 질문은 Core가 저장 지역보다 우선.
- `site-consumer-layout.css` — 데스크톱 2열 목록에서 홀수 마지막 카테고리는 한 줄 전체(빈 칸 없음).
- `subscribe.html` — 요금표 행 "생활정보 · …" → "지역정보 · …" (뒤의 "공과금 등" 문구는 공과금 작업 소관이라 그대로).
- validator: `validate_regional_news_p0_01.mjs` 신규, `validate_consumer_design_shell_01` / `validate_consumer_sections_02` / `validate_life_medical_category_entry_01` 라벨·카드 수 갱신, `site-review.yml` 단계 추가.
- asset token 재계산 `aset-720f2663ecb5` — 위 파일 외에는 `?v=` 토큰만 바뀜.

바꾸지 않은 것: 내부 id `life`, route `#life`, localStorage/cookie key, Core API path, "생활에 필요한 정보" 소제목, "지역생활정보" 카테고리명(지시서의 홈 목록 이름 그대로), 개발용 주석.

## TEST_STATUS

TESTS=PASS (Windows 로컬, Chrome headless CDP 실제 터치/마우스, viewport emulation — 실기기 아님)
- validate_regional_news_p0_01 PASS — 360x780 · 375x812 · 390x844 · 412x915 · 1280x900 · 390x844 dark
  - 지역정보 제목·설명, 지역뉴스 카드(아이콘, 한 줄, 잘림 없음, 44px 이상), 가로 스크롤 0
  - 저장 지역 없음 → 양식(키보드 안 올라옴) → "군산" → Core에 "군산 뉴스 알려 줘" 그대로, 위치 없음, geolocation 요청 0
  - 카드 5개: 제목 3줄 이내, 언론사·시각·요약, 이미지/미디어 요소 0, 원문 열기 href = 원문 URL · target _blank · noopener, 관련 보도 2건 펼침(javascript: 링크는 버려짐), 요약 없는 기사는 빈 줄 없음
  - ← 지역정보: 홈 복원 + 지역뉴스 카드 포커스
  - 저장 지역 전주시 → 1탭 "전주시 뉴스 알려 줘" + client_context.location {SAVED_REGION, 전주시}, geolocation 요청 0
  - 내 주변 뉴스: 위치 사용 기본(켜짐)+권한 거부 → 위치 없음 / 위치 사용 끔 → geolocation 요청 0
  - 다크: 카드 글자와 배경 대비 확인
  - 데스크톱: 카테고리가 홀수면 마지막 카드가 한 줄 전체
- validate_life_medical_category_entry_01 PASS (375/390/1280, 카드 6개)
- source validator PASS: consumer_sections_02, consumer_design_shell_01, festival_nav_wiring_01, lotbi_box_nav_01, uiux_phase1_01, life_detail_design_01, consumer_detail_system_01, consumer_documents_01, asset_cache_version --check
- 병합 미리보기 (main + life-utility-bill-menu-remove-01-site + life-info-direct-chat-card-compaction-01-site + 이 branch, 아래 MERGE_NOTES대로 해소, 토큰 재생성):
  validate_regional_news_p0_01 PASS (6개 화면, 지역뉴스 1탭 직접 전송·키보드 닫힘), validate_life_medical_category_entry_01 PASS (카드 5개, 데스크톱 마지막 카드 한 줄 전체), validate_life_direct_chat_card_compaction_01 PASS, source validator 8개 PASS
- 전체 회귀: site-review.yml의 node validator 128개 (CHROME_BIN 지정): 124 PASS / 4 FAIL, NEW_FAILURES=0
  - validate_mobile_footer_legal_sheet_01, validate_site_avatar_fallback_runtime: main 89adbb37 baseline에서도 실패(기존 Windows RED)
  - validate_calendar_system_dark_01: 이 worktree가 CRLF로 체크아웃돼 mirror 비교가 어긋난 것 — LF 체크아웃한 같은 커밋에서 PASS (site-calendar.css는 이 branch에서 안 바뀜)
  - validate_image_attachment_thumbnail_01: 첫 실행 실패, 같은 커밋 재실행 PASS (부하성 간헐)
- Linux CI(site-review.yml) NOT TESTED.

## MERGE_NOTES (다른 진행 중 branch와의 충돌)

`?v=aset-…` 토큰은 모든 branch 쌍이 충돌하므로 평소처럼 `node scripts/asset_cache_version.mjs --write`로 다시 만든다. 토큰을 뺀 실질 충돌(2026-10-08 fresh refs, merge-tree 검사):
- life-info-direct-chat-card-compaction-01-site, neis-school-official-links-01-site, chat-long-answer-scroll-anchor-01-site, life-wallet-mobile-p0-01-site, safecare-human-profile-slot-acceptance-01-site: 실질 충돌 없음.
- life-utility-bill-menu-remove-01-site: 3개 파일 (둘 다 카테고리 목록을 바꿈 — 피할 수 없음)
  1. `site-consumer-sections.js` openLifeDetail의 `back`: 공과금 branch의 여러 줄 형태(`root.replaceChildren(heading, grid)` + 카드 포커스)를 쓰고 라벨만 `'지역정보로 돌아가기'`.
  2. `scripts/validate_consumer_sections_02.mjs`: 라벨 `['병원·의원', '약국', '축제·행사', '지역뉴스', '지역생활정보']`, id 5개, prompt 검사 filter `!['festivals', 'news'].includes(item.id) && !item.medical`, 공과금 숨김 검사 2줄 유지.
  3. `scripts/validate_life_medical_category_entry_01.mjs`: 목록 2곳에 '지역뉴스' 추가(5개), 카드 수 대기는 `LIFE_SHORTCUTS.length`, 제목 `'지역정보'`, 공과금 branch의 "모든 행이 꽉 참" 검사는 "홀수 마지막 카드는 한 줄 전체"를 허용하도록:
     `oddLast = shortcuts.length % gridColumns` → 행 개수 = [gridColumns × floor(n/gridColumns), (oddLast ? 1)], 폭 동일 검사는 마지막 홀수 카드 제외, 그 카드 폭 > 1.5 × 일반 카드. 나머지(지역생활정보 전송 부분)는 공과금 branch 쪽.
  위 해소본으로 병합 미리보기 validator 전부 PASS (위 TEST_STATUS).

## 2026-10-08 최신 통합 재확인 (fresh remote HEAD)

- Site main 89adbb37 → c9c19e4c (NEIS 학교 링크, SafeCare 슬롯, 화면 모드 공유, nginx mjs). 토큰 정규화 merge-tree: 실질 충돌 없음.
- life-info-direct-chat-card-compaction-01-site @ 5e2ca2c5: 실질 충돌 없음.
- life-utility-bill-menu-remove-01-site @ 2f6503a7 (롯비함 숨김 02 추가): 위 3개 파일 + `site-conversation.js` 1줄.
  4. `site-conversation.js` 롯비함 화면 `installSurfaceBehavior(... route: LOTBI_BOX_UI_ENABLED ? 'lotbi-box' : '' ...)`: 공과금 branch 줄을 쓰고 backLabel만 `'지역정보로 돌아가기'`.
- Core provider: 실제 NAVER 뉴스 호출 미실행(검색>뉴스 미등록). 이 branch는 Core 연결 GREEN 뒤에만 release-ready로 올린다.

## DEPLOY_ORDER

1. Core feature/regional-news-p0-core merge·배포 (뉴스 flag OFF 기본값 — 배포만으로는 동작 변화 없음)
2. NAVER API HUB 연결 확인 + Core env `NAVER_NEWS_SEARCH_ENABLED=true` (Core handoff 문서 참고)
3. Core Production에서 "오늘 전주 뉴스" smoke
4. 이 Site branch merge·배포

USER_DECISION_NEEDED=Core handoff와 같음 — NAVER Cloud 콘솔의 기존 API HUB 애플리케이션(지역 검색에 쓰는 Client ID)에 검색>뉴스 API가 선택돼 있는지 확인(없으면 추가, 새 key 아님)하고 Core Production에 NAVER_NEWS_SEARCH_ENABLED=true를 켜는 승인.
