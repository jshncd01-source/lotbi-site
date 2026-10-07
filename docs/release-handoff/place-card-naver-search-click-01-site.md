READY_FOR_DEPLOY=YES

# place-card-naver-search-click-01-site — release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/place-card-naver-search-click-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ... refs/heads/feature/place-card-naver-search-click-01-site`)
REMOTE_FEATURE_SHA=same as FEATURE_SHA after push (verified with git ls-remote at push time)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=93fee0d2b988256312182bde4919a09d5ad204ff (started from a9affcd5ac887239778e37347cd4d68fbe4ad948, main merged in normally)
CODE_SHA=2ecd03385c163dee58aee4afe22f444f8ced6623
ASSET_VERSION=aset-fd280f8b0757

## SCOPE

- 장소 카드 본문(사진·장소명·카테고리·주소·카드 배경)을 누르면 지도 handoff가 아니라 그 장소의 **네이버 검색 결과**(메뉴·사진·리뷰·영업정보·블로그)가 새 탭으로 열린다.
- 하단 네이버지도(기본 지도) 버튼: 기존 지도 handoff 그대로(iOS `/map-handoff.html` → 앱 열기/웹 지도 계속하기, Android intent, 데스크톱 웹 지도, 지도 provider 선택 계약 유지).
- 전화 버튼: 기존 `tel:` 그대로. 캐러셀 이전/다음·옆 카드 탭·스와이프·방향키: 캐러셀만 움직이고 검색을 열지 않는다.
- Core 변경 없음. Core가 이미 보내는 `place_result.query`(예: "전주 죠죠")와 장소 이름·주소만 쓴다.

## ROOT_CAUSE

`site-conversation.js` createPlaceCardRail의 카드 click 핸들러가 활성 카드 본문 클릭을 `cards[index].querySelector('[data-map-provider]').click()`로 지도 버튼에 넘기고 있었다(iPhone에서는 지도 버튼 href가 `/map-handoff.html`이라 "네이버지도로 연결할게요" 화면이 열림).

추가 발견(main에도 있던 결함): 데스크톱 마우스 클릭은 rail의 `setPointerCapture` 때문에 click이 카드가 아니라 rail로 전달되어 카드 핸들러가 아예 실행되지 않았다(데스크톱에서 카드 본문 클릭은 무반응). 활성 카드의 단순 탭만 rail click에서 검색 링크로 forward 하도록 좁게 고쳤다.

## CHANGE

- `site-navigation.js`: `buildNaverPlaceSearchQuery` / `buildNaverPlaceSearchUrl`
  - 검색어 = 장소 이름 + (필요할 때만) 지역 1개
  - 지역 우선순위: ① 사용자 검색어(Core query)의 단어 중 이 장소 주소의 행정구역(시·도/시·군·구/읍·면·동, 접미사 뗀 형태 포함)과 일치하는 것 ② 주소의 시·군(특별·광역시는 시 이름, 없으면 구) ③ 없으면 이름만
  - 이름에 이미 지역이 들어 있으면 붙이지 않음. 주소 전체·query의 다른 단어("메뉴" 등)는 넣지 않음
  - 예: 죠죠 전주객사점 → "죠죠 전주객사점", 죠죠 → "전주 죠죠", 카페 죠죠(완주군 주소) → "완주 카페 죠죠"
  - URL: `https://search.naver.com/search.naver?query=<URLSearchParams 인코딩>` (query 파라미터 하나만). 모바일 브라우저는 네이버가 `m.search.naver.com`으로 같은 query를 유지해 302 이동(curl, iPhone UA로 확인)
- `site-conversation.js`: 카드마다 시각적으로 숨긴 `<a data-place-search>`(target=_blank, rel=noopener noreferrer — 지도 버튼과 같은 외부링크 정책, aria-label "네이버에서 {장소명} 검색"). 본문 클릭·카드 포커스 Enter가 이 링크를 click. 키보드/스크린리더는 Tab으로 이 링크에 도달. 중첩 a/button 없음.
- `site-conversation.css`: 링크 숨김 + 링크 포커스 시 카드에 포커스 링(`:has`).
- `scripts/validate_place_card_naver_search_click_01.mjs`(신규, workflow step 추가). `validate_naver_maps_navigation_01` / `validate_place_card_cross_platform_01`이 고정하던 "카드 → 지도" 계약을 "카드 → 검색, 카드가 지도를 부르지 않음"으로 변경.

## BRANCH HISTORY

- ac40aebf fix: open NAVER search from the place card body, keep map on its button (base a9affcd5)
- 2ecd0338 Merge Ncloud main 93fee0d2 — 59개 파일 asset token 충돌만(main 쪽 선택 후 재계산), site-conversation.js는 main + 이 branch import 추가. main 대비 token 외 차이가 이 branch의 7개 파일뿐이고 그 delta가 ac40aebf delta와 동일함을 확인.

## TEST_STATUS

FOCUSED_TEST_STATUS=PASS — validate_place_card_naver_search_click_01
- 검색어/URL 규칙 16 케이스(지역 중복 없음·주소 조각 없음·"메뉴" 미포함·지역 없으면 이름만·한글/특수문자/`#&"<>`·javascript: 문자열 인코딩, query 파라미터 1개, fragment 없음)
- 실제 입력(CDP): iPhone UA 375x812 / 390x844, KakaoTalk iOS UA 390x844(터치 탭), 데스크톱 1280x900(마우스+키보드). Chrome이 실제로 여는 탭을 관찰(외부 DNS 차단, 외부 전송 없음)
  - 사진·제목·주소·카드 배경 탭 → 네이버 검색 탭 정확히 1개, 지도 탭 0
  - 지도 버튼 → 지도 handoff 탭 1개(iOS `/map-handoff.html?provider=NAVER_MAP`), 검색 0
  - 전화 → tel:0630000000만, 탭 0, 검색 0
  - 이전/다음 → 캐러셀만 이동, 탭 0. 옆 카드 탭(보이는 폭이 있을 때)·제목 위 스와이프 → 회전만
  - 세 번째 카드(주소 기반 지역) → "완주 카페 죠죠" 검색
  - 데스크톱 카드 포커스 Enter, Tab→검색 링크 Enter → 검색, ArrowRight → 회전만
  - 검색 링크 유무로 카드·사진·제목·주소·버튼 위치/크기 전부 동일(레이아웃 변화 0), 가로 페이지 스크롤 없음
PLACE_CARD_REGRESSION=PASS — validate_place_card_compact_01(344/360/390/412/760/761/1280 × 지도 4종), validate_place_card_cross_platform_01, validate_place_card_map_deeplinks_01, validate_naver_maps_navigation_01, validate_default_map_preference_01, validate_rich_product_cards_01, validate_life_animal_hospital_01, validate_life_night_medical_01
전체: workflow 3개의 validator 200개를 merge 후 HEAD와 main 93fee0d2에서 실행 — feature 196 PASS / 4 FAIL, 4건 모두 main에서도 동일 FAIL
NEW_FAILURES=0
(로컬 Windows 기존 RED, main에서도 동일: validate_image_attachment_thumbnail_01(CRLF), validate_calendar_system_dark_01(CRLF), validate_site_avatar_fallback_runtime, validate_mobile_footer_legal_sheet_01. 로컬에서 Python http.server가 .js MIME을 잘못 주는 validator는 sitecustomize로 MIME만 보정해 실행)

NOT_VERIFIED:
- 실제 iPhone Safari / KakaoTalk 인앱 / Android 실기기(모두 Chrome 에뮬레이션)
- 새 탭에서 뒤로가기 후 대화 위치: 검색은 지도 버튼과 같은 target=_blank라 LOTBI 탭은 그대로 남는 구조(실기기 미확인)
- 기존 관찰(이번 변경과 무관, main에도 동일): Chrome 터치 에뮬레이션에서 이전/다음 버튼 포커스·스와이프가 overflow:hidden 레일을 가로로 스크롤(153~161px)해 가운데 카드가 밀리는 현상. 실기기 재현 여부 미확인

CORE_CHANGED=NO
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
DEPENDENCIES=없음. Core place_result(CORE-PLACE-RESULT-01)의 query·name·address 기존 필드만 사용.
PRODUCTION_DEPLOYED=NO
READY_FOR_DEPLOY=YES

USER_DECISION_NEEDED=NONE
