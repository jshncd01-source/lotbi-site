READY_FOR_DEPLOY=YES

# life-utility-bill-menu-remove-01-site — release handoff

TASK=생활정보 홈 단순화 (공과금 메뉴 임시 제거 + 상단 자유질문 입력바 제거 + 하단 보조 row 삭제)
REPO=lotbi-site
FEATURE_BRANCH=feature/life-utility-bill-menu-remove-01-site
SITE_BASE_MAIN_SHA=89adbb378a11fba8e42a445b62f5ffab8f358f5f
CODE_SHA=3241e25bfb3645ff822e67491f07049b65ef1326
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote origin refs/heads/feature/life-utility-bill-menu-remove-01-site`)
ASSET_VERSION=aset-6a2d620fa472

UTILITY_BILL_MENU_REMOVED=YES
LIFE_INFO_TOP_QUERY_BAR_REMOVED=YES
CATEGORY_SECTION_MOVED_UP=YES (첫 카테고리 251px → 151px, 360/375/390/412/1280 동일)
MOBILE_VERTICAL_SPACE_REDUCED=YES (마지막 카테고리 아래 끝 551px → 391px, 모바일 4개 모두 첫 화면 안)
SAVED_INFO_HOME_BUTTON_REMOVED=YES
UTILITY_BILL_HELP_COPY_REMOVED=YES
BOTTOM_AUX_ROW_REMOVED=YES
POST_REMOVAL_SPACING_PASS=YES
MAIN_CHAT_UNCHANGED=YES (site-conversation.js는 asset `?v=` 토큰만 바뀜, 로직·문구 변경 0줄)

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
- asset token 재계산(aset-6a2d620fa472) — 위 파일 외에는 `?v=` 토큰만 바뀜.

## TEST_STATUS

TESTS=PASS
- validate_life_medical_category_entry_01 (CDP 실제 터치/마우스, 360x780 · 375x812 · 390x844 · 412x915 · 1280x900):
  - 카드 4개(병원·의원/약국/축제·행사/지역생활정보), 공과금·고지서 문구 화면 어디에도 없음, 입력바·하단 row·"저장한 정보 다시 보기" 없음.
  - 홈 구성 = 라벨 + 목록만. 설명→라벨 24px, 라벨→첫 카드 8px, 첫 카드 151px, 모든 카테고리가 첫 화면 안, 헤더 top ≥ 0.
  - grid 빈 칸 없음: 모바일 1열×4행, 데스크톱 2열×2행, 모든 줄이 꽉 참, 카드 폭·높이 동일, 라벨 한 줄, 가로 스크롤 0.
  - 병원·의원 진입·칩·119 안내·뒤로가기(포커스 복귀)·제출 → 입력창 → 전송 body 동일 문장, 약국 진입·제출, 지역생활정보 진입·제출, 축제·행사 화면 열림.
- validate_site_refresh_route_restore_01 PASS(375/390/1280): 롯비함은 이제 `/#lotbi-box` 주소로 열고 새로고침·← 생활정보 복귀 확인.
- source validator 6개 PASS, asset_cache_version --check PASS.
- 전체 회귀(Windows 로컬, workflow run 줄 209개): feature 202 PASS / 7 FAIL, main 89adbb37 baseline 202 PASS / 7 FAIL.
  - 양쪽 공통 기존 Windows RED 4건: validate_calendar_system_dark_01, validate_image_attachment_thumbnail_01, validate_mobile_footer_legal_sheet_01, validate_site_avatar_fallback_runtime.
  - feature에서만 실패한 3건(validate_conversation_calendar_card_02 "result missing", validate_place_card_compact_01 "result missing", validate_site_refresh_route_restore_01 진위확인 로그인 복귀 타이밍)은 부하성 간헐 실패 → 단독 재실행 모두 PASS. baseline에서도 같은 성격의 간헐 실패 3건(calendar_compact_editor_01, festival_event_08_responsive_a11y_01, site_refresh_route_restore_01)이 나왔다.
  - Linux CI(site-review.yml) NOT TESTED.

MOBILE_LAYOUT_PASS=YES (360/375/390/412, viewport 에뮬레이션 — 실기기 아님)
DESKTOP_LAYOUT_PASS=YES (1280x900)
OTHER_LIFE_INFO_REGRESSION=PASS
NEW_FAILURES=0

## 사용자 확인 필요 (USER_DECISION_NEEDED)

USER_DECISION_NEEDED=롯비함(저장한 항목) 목록 화면의 화면 진입이 없어짐. 삭제한 "저장한 정보 다시 보기"가 롯비함을 여는 유일한 버튼이었다(사이드바·모바일 메뉴에는 롯비함 진입이 없고 validator가 0개로 고정). 배포 후에도 검색 결과의 "+ 롯비함" 저장과 `/#lotbi-box` 주소 직접 진입은 그대로 동작하지만, 화면에서 목록을 여는 버튼은 없다. 지시대로 대체 버튼은 만들지 않았다. 이대로 배포할지, 롯비함 진입을 다른 곳(예: 사이드바)에 둘지 결정 필요.

## 범위 밖으로 남긴 것

- `subscribe.html` 요금표 문구 "생활비 자동정리 · 영수증·지출·공과금", "생활정보 · 날씨·장소·축제·공과금 등" — 생활정보 홈이 아닌 요금 안내라 이번 지시 범위 밖으로 두고 변경하지 않음.
- 생활정보 설명 문구 "내 주변의 생활정보를 찾고, 필요한 일정을 챙겨 보세요."는 site-conversation.js 소유(메인 대화 파일)라 변경하지 않음.

## DEPLOY_ORDER

Site 단독. Core 변경 없음.

BLOCKER=NONE
REMAINING_ISSUES=위 USER_DECISION_NEEDED 1건, 실기기 확인 NOT TESTED, Linux CI NOT TESTED
