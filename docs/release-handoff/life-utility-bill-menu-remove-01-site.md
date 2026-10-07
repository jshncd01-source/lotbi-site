READY_FOR_DEPLOY=YES

# life-utility-bill-menu-remove-01-site — release handoff

TASK=생활정보 홈 단순화 + LOTBI BOX HIDE 02
REPO=lotbi-site
FEATURE_BRANCH=feature/life-utility-bill-menu-remove-01-site
SITE_BASE_MAIN_SHA=89adbb378a11fba8e42a445b62f5ffab8f358f5f
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=89adbb378a11fba8e42a445b62f5ffab8f358f5f
CODE_SHA=62c4f4913a0f37407776f485a9266626a759c35c
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote origin refs/heads/feature/life-utility-bill-menu-remove-01-site`)
REMOTE_FEATURE_SHA=confirm after push with `git ls-remote origin refs/heads/feature/life-utility-bill-menu-remove-01-site`
SUPERSEDES=25dbeaa994534db16e3276fed31dc2833931e2bc
ASSET_VERSION=aset-25a1383acf1a

UTILITY_BILL_MENU_REMOVED=YES
LIFE_INFO_TOP_QUERY_BAR_REMOVED=YES
CATEGORY_SECTION_MOVED_UP=YES (첫 카테고리 251px → 151px, 360/375/390/412/1280 동일)
MOBILE_VERTICAL_SPACE_REDUCED=YES (마지막 카테고리 아래 끝 551px → 391px, 모바일 4개 모두 첫 화면 안)
SAVED_INFO_HOME_BUTTON_REMOVED=YES
UTILITY_BILL_HELP_COPY_REMOVED=YES
BOTTOM_AUX_ROW_REMOVED=YES
POST_REMOVAL_SPACING_PASS=YES
MAIN_CHAT_UNCHANGED=YES (대화 송수신·의료·장소·상품 구매 흐름은 그대로; site-conversation.js 변경은 롯비함 UI gate만)
LOTBI_BOX_HIDDEN_SURFACES=생활정보 저장 목록 진입 / 상품 검색 결과·상품 카드의 + 롯비함·✓ 롯비함 저장 토글 / data-lotbi-box-open 위임 경로 / `/#lotbi-box` 직접·새로고침 진입
LOTBI_BOX_DATA_DELETED=NO
CHANGED_TEST_EXPECTATIONS=validate_lotbi_box_nav_01 / validate_rich_product_cards_01 / validate_site_refresh_route_restore_01
OTHER_REPO_LOTBI_BOX=lotbi-web latest main c0c10e13: 화면·진입·저장 버튼 없음(CSS selector 잔재만); lotbi-app latest main 2bb7dd09: 관련 문자열 없음

CORE_CHANGED=NO
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
PRODUCTION_DEPLOYED=NO

## 최종 생활정보 홈

생활정보(제목) → 설명 문구 → "생활에 필요한 정보" → 병원·의원 / 약국 / 축제·행사 / 지역생활정보. 그 위·아래에 다른 줄 없음.

- 학교정보: latest main(89adbb37)의 LIFE_SHORTCUTS에 없음 → 이번 작업에서 만들지 않음(별도 NEIS 작업 소관).
- "곧 제공"·disabled·준비중 카드·대체 검색바·대체 버튼·새 안내문 없음.

## SCOPE (실제 변경 파일)

- `site-consumer-sections.js`
  - LIFE_SHORTCUTS에서 `bills`(공과금 확인) 삭제, `LIFE_DETAIL_FIELDS.bills`, 공과금 전용 textarea 분기·안내 문구 삭제.
  - 상단 `form.consumer-search`(placeholder "어떤 생활정보가 필요하세요?", "롯비에게 물어보기") 삭제.
  - 하단 `consumer-section-footer`("저장한 정보 다시 보기" + 안내문) 삭제, 쓰지 않게 된 `onSaved` 인자 제거.
  - 상세 화면 "생활정보로 돌아가기"는 라벨+목록을 되살리고 그 상세를 연 카드로 포커스를 돌려 줌(이전에는 지워진 입력바로 포커스).
- `site-consumer-design.css`, `site-consumer-layout.css`
  - `.consumer-search*`, `.consumer-section-footer*` 규칙 삭제(생활정보 홈 전용이었음), 공과금 textarea 전용 규칙 삭제.
  - 생활정보 홈에만: 설명 아래 여백 32 → 24px, 라벨 위 여백 12 → 0, 라벨-목록 간격 22 → 8px. Life Wallet·안심케어 등 다른 화면 description 여백은 그대로.
- validator 갱신: consumer_sections_02, consumer_documents_01, consumer_detail_system_01, life_detail_design_01, lotbi_box_nav_01, uiux_phase1_01, site_refresh_route_restore_01, life_medical_category_entry_01(360·412px 추가, 빈 칸·간격·미노출 검사), site-review.yml 주석.
- asset token 재계산(aset-25a1383acf1a) — 위 파일 외에는 `?v=` 토큰만 바뀜.

## LOTBI BOX HIDE 02

사용자 결정(2026-10-08)인 “롯비함 전부 숨김”을 반영했다.

- 단일 소스 플래그 `site-feature-flags.js`의 `LOTBI_BOX_UI_ENABLED=false`가 UI와 라우트 양쪽의 권위다. 새 환경변수·서버 설정은 없다.
- 상품 검색 결과/상품 카드에서 `+ 롯비함`·`✓ 롯비함` 버튼 DOM을 만들지 않는다. 따라서 마우스 클릭·터치·Tab/Enter/Space 키보드 경로가 모두 없다.
- 남아 있을 수 있는 옛 `data-lotbi-box-open` 트리거도 같은 플래그로 차단하고, `openLotbiBox()` 자체도 첫 줄에서 반환한다.
- `SITE_ROUTES`에서 `lotbi-box`를 제외했다. `/#lotbi-box` 직접 진입과 새로고침은 롯비함 화면을 열지 않고 대화 홈에 남는다. 다른 7개 라우트 계약은 그대로다.
- `lotbi.site.ux.v1:<namespace>:lotbi-box` 저장 키, load/save/remove/toggle 함수와 숨겨진 화면 구현은 삭제하지 않았다. 저장값 삭제·clear·migration은 없다.
- Account(lotbi-web) latest main `c0c10e13` 확인: 롯비함 화면·버튼·진입 없음. `site-theme-tokens.css`의 `.lotbi-box-card-source` selector 잔재만 있음.
- App(lotbi-app) latest main `2bb7dd09` 확인: `롯비함`/`lotbi-box`/`저장한 정보` 관련 문자열 없음.

## TEST_STATUS

TESTS=PASS
- validate_life_medical_category_entry_01 (CDP 실제 터치/마우스, 360x780 · 375x812 · 390x844 · 412x915 · 1280x900):
  - 카드 4개(병원·의원/약국/축제·행사/지역생활정보), 공과금·고지서 문구 화면 어디에도 없음, 입력바·하단 row·"저장한 정보 다시 보기" 없음.
  - 홈 구성 = 라벨 + 목록만. 설명→라벨 24px, 라벨→첫 카드 8px, 첫 카드 151px, 모든 카테고리가 첫 화면 안, 헤더 top ≥ 0.
  - grid 빈 칸 없음: 모바일 1열×4행, 데스크톱 2열×2행, 모든 줄이 꽉 참, 카드 폭·높이 동일, 라벨 한 줄, 가로 스크롤 0.
  - 병원·의원 진입·칩·119 안내·뒤로가기(포커스 복귀)·제출 → 입력창 → 전송 body 동일 문장, 약국 진입·제출, 지역생활정보 진입·제출, 축제·행사 화면 열림.
- validate_site_refresh_route_restore_01 PASS(375/390/1280): `/#lotbi-box` 직접 진입·새로고침 모두 대화 홈, 롯비함 surface/route 0. 다른 7개 라우트 검사는 유지.
- source validator 6개 PASS, asset_cache_version --check PASS.
- 전체 회귀(Windows 로컬, workflow run 줄 209개): feature 201 PASS / 8 FAIL, main 89adbb37 baseline 205 PASS / 4 FAIL.
  - main과 feature 공통 기존 Windows RED 4건: validate_calendar_system_dark_01, validate_image_attachment_thumbnail_01, validate_mobile_footer_legal_sheet_01, validate_site_avatar_fallback_runtime.
  - feature에서만 병렬 실패한 4건: validate_calendar_day_panel_two_buttons_01·validate_calendar_expense_summary_01·validate_home_fresh_entry_01은 Chrome/module 로드 또는 포커스 타이밍, validate_site_refresh_route_restore_01은 인증 복귀 타이밍. 네 건 모두 단독 재실행 PASS(라우트 검사는 375/390/1280 전체 PASS). 기능 관련 신규 실패 0.
  - Linux CI(site-review.yml) NOT TESTED.

MOBILE_LAYOUT_PASS=YES (360/375/390/412, viewport 에뮬레이션 — 실기기 아님)
DESKTOP_LAYOUT_PASS=YES (1280x900)
OTHER_LIFE_INFO_REGRESSION=PASS
NEW_FAILURES=0

## 사용자 결정

USER_DECISION_NEEDED=NONE (2026-10-08 사용자 결정 “롯비함 전부 숨김” 반영 완료)

## 범위 밖으로 남긴 것

- `subscribe.html` 요금표 문구 "생활비 자동정리 · 영수증·지출·공과금", "생활정보 · 날씨·장소·축제·공과금 등" — 생활정보 홈이 아닌 요금 안내라 이번 지시 범위 밖으로 두고 변경하지 않음.
- 생활정보 설명 문구 "내 주변의 생활정보를 찾고, 필요한 일정을 챙겨 보세요."는 site-conversation.js 소유(메인 대화 파일)라 변경하지 않음.

## DEPLOY_ORDER

Site 단독. Core 변경 없음.

BLOCKER=NONE
REMAINING_ISSUES=실기기 확인 NOT TESTED, Linux CI NOT TESTED
