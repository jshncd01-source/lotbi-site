READY_FOR_DEPLOY=YES

# place-card-carousel-scroll-drift-01-site — release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/place-card-carousel-scroll-drift-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ... refs/heads/feature/place-card-carousel-scroll-drift-01-site`)
REMOTE_FEATURE_SHA=same as FEATURE_SHA after push (verified with git ls-remote at push time)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=ce132b3cc343738434c0b8e3a6a4e03f1a24d664 (started from a3443d6574b52b452fcb0e4e4e31ee993b7b903a, main merged in normally)
CODE_SHA=f0f5748c382217e6574c7e0eb82cf30c6fe2a359 (merge of main ce132b3c; fix commit 6f42cd759171f12b38d37eb555a9852e47e04850)
ASSET_VERSION=aset-657773a1aaa9

## SCOPE

- 장소 카드 캐러셀(orbit)에서 이전/다음·스와이프·방향키로 카드를 돌릴 때 레일이 가로로 밀려(휴대폰 폭에서 153~252px) 가운데 카드가 옆으로 치우치던 결함 수정.
- 변경은 `site-conversation.css`의 `.lotbi-place-orbit` 규칙뿐. JS·Core 변경 없음. 카드 클릭→네이버 검색, 지도·전화 버튼, 캐러셀 조작 방식은 그대로.

## ROOT_CAUSE

장소 카드 레일은 상품 카드 레일 클래스 `.lotbi-rich-card-rail`도 같이 쓰는데, 그 규칙의 `scroll-snap-type: inline mandatory`(카드는 `scroll-snap-align: start`)를 그대로 물려받고 있었다.
orbit은 overflow만 hidden으로 바꿨고 hidden도 스크롤 컨테이너라서, 카드가 회전하며 transform이 바뀔 때마다 브라우저가 레일을 카드 시작점에 다시 snap했다(레이아웃이 바뀌면 다시 snap하라는 CSS Scroll Snap 규칙).
- 확인: 버튼 포커스가 원인이 아님(포커스 없이 프로그램 click·방향키로도 동일), aria-live 상태 요소 제거·overflow-anchor:none으로는 그대로, `scroll-snap-type: none`만으로 0px.
- 데스크톱은 레일 안에 스크롤할 여분이 없어서(scrollWidth=clientWidth) 증상이 없었다.

## CHANGE

`.lotbi-place-orbit`:
- `scroll-snap-type: none` — 원인 제거
- `overflow: hidden; overflow: clip;` — 지원 브라우저에서는 레일을 아예 스크롤 불가로 만들어 포커스·페이지 내 찾기·scrollIntoView로도 밀리지 않게 함(미지원 브라우저는 기존 hidden 유지). 레일 스크롤을 읽거나 쓰는 코드는 없음.

## BRANCH HISTORY

- 6f42cd75 fix: stop the place card carousel from scrolling off-center (base a3443d65)
- f0f5748c Merge Ncloud main ce132b3c — 59개 파일 asset token 충돌만(main 쪽 선택 후 재계산). main 대비 token 외 차이는 이 branch의 4개 파일뿐이고 그 delta가 6f42cd75 delta와 동일함을 확인.

## TEST_STATUS

FOCUSED_TEST_STATUS=PASS — validate_place_card_carousel_no_drift_01(신규, workflow step 추가)
- 360x800·412x915(Android UA), 375x812·390x844(iPhone UA) 터치 / 1280x900 마우스·키보드, 결과 5개(뒤쪽 카드까지 있는 가장 넓은 상태)
- 다음 x5, 이전 x2, 스와이프 좌/우, 옆 카드 탭(보이는 폭이 있는 데스크톱), ArrowRight/ArrowLeft/End/Home, 옆 카드 제목 scrollIntoView, 프로그램 scrollLeft=160 — 매 단계 레일 scrollLeft 0, 단계 중 스크롤 이벤트 0, 가운데 카드 위치 변화 1px 이내, 가운데 카드 순서 정확, 링크 실행 0, 페이지 가로 스크롤 없음
- 같은 테스트(CSS 계약 부분 제외)를 수정 전 main a3443d65에 실행 → 360px 세 번째 "다음"에서 252px 밀려 FAIL (결함 재현 확인)
- validate_place_card_naver_search_click_01: 단계마다 레일 scrollLeft를 0으로 되돌리던 임시 처리 제거 후 PASS(이 결함이 다시 생기면 이 테스트도 잡음)
PLACE_CARD_REGRESSION=PASS — compact(344~1280 × 지도 4종), cross_platform, map_deeplinks, naver_maps_navigation, rich_product_cards, naver_search_click
merge 후 재확인: carousel_no_drift, naver_search_click, compact, cross_platform, map_deeplinks, naver_maps_navigation, rich_product_cards, conversation_integration, accessibility, chat_answer_quality_p0(main에서 새로 들어온 것) 모두 PASS
전체(merge 전 6f42cd75 기준): workflow validator 203개 — 199 PASS / 4 FAIL, 4건 모두 main a3443d65에서도 동일 FAIL
NEW_FAILURES=0
(로컬 Windows 기존 RED, main 동일: validate_image_attachment_thumbnail_01(CRLF), validate_calendar_system_dark_01(CRLF), validate_site_avatar_fallback_runtime, validate_mobile_footer_legal_sheet_01. 두 트리를 동시에 돌릴 때 흔들린 calendar·compact 브라우저 validator는 단독 재실행 시 양쪽 모두 PASS)

NOT_VERIFIED:
- 실제 iPhone Safari / KakaoTalk 인앱 / Android 실기기(모두 Chrome 에뮬레이션). 원인이 표준 scroll snap 동작이라 Safari·인앱에서도 같은 증상이 있었을 가능성이 높고, 수정(snap 해제)도 동일하게 적용됨.

CORE_CHANGED=NO
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
DEPENDENCIES=없음
PRODUCTION_DEPLOYED=NO
READY_FOR_DEPLOY=YES

USER_DECISION_NEEDED=NONE
