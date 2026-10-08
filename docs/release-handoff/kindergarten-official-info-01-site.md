READY_FOR_DEPLOY=YES

# 유치원 공식정보 (유치원알리미) — 생활정보 → 유치원·학교 (Site)

REPO=lotbi-site
FEATURE_BRANCH=feature/kindergarten-official-info-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD). 문서에는 자기 SHA를 넣을 수 없으므로 `git ls-remote`로 확인한다.
CODE_SHA=2b66fc26 (최신 main c311be85 정상 merge 커밋; 토큰 외 충돌 index.html·auth/callback/index.html 스타일 목록 = main 목록 + site-life-education.css 한 줄, site-conversation.js = main 그대로)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=c311be85f2bc1359f20323a1435bde5b9342ee9a (SITE-T30; 개발 시작 82a8874e, push 직전 ls-remote 재확인)
ASSET_VERSION=aset-525861fa37b7 (scripts/asset_cache_version.mjs --check PASS)
TEST_STATUS=새 검증 scripts/validate_kindergarten_official_info_01.mjs 32 checks PASS(실제 Chrome 360/375/390/412/1280, 라이트·다크, 44px·가로넘침·대비, Core 꺼짐 상태 양식) / site-review.yml 145개 실행(main 82a8874e merge 트리): 첫 실행 128 PASS, 실패 17개는 feature·baseline(main 82a8874e) 단독 재실행으로 비교 / main c311be85 merge 뒤 재확인 PASS: kindergarten·life_medical_category_entry·life_info_cleanup_final·site_refresh_route_restore(Chrome), consumer_sections_02·auth_continuity_02·festival_nav_wiring·life_detail_design·life_neis_school, validate_site·home_chat·hardening·accessibility·clean_urls, asset check
NEW_FAILURES=0 — 찾은 신규 실패 2개는 이 branch에서 고쳤다(validate_life_medical_category_entry_01의 카드 4개 가정, validate_auth_continuity_02의 콜백 스타일시트 목록). 남은 실패는 baseline main에서도 같은 Windows 로컬 기존 RED: validate_profile_menu_personal_theme_01, validate_sticky_topbar_01, validate_mobile_footer_legal_sheet_01, validate_site_avatar_fallback_runtime, validate_calendar_system_dark_01, validate_place_card_compact_01, validate_auth_unknown_recovery_browser_01, validate_image_attachment_thumbnail_01, validate_composer_auto_grow. 실행마다 결과가 바뀐 부하성: validate_conversation_message_ux_final_01·validate_message_calendar_footer_editor_01(baseline 실패·feature PASS), validate_sidebar_viewports_04(부하 시 양쪽 spawnSync ETIMEDOUT, 첫 실행 feature PASS).
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
NEW_SECRET_CREATED=NO
DEPENDENCIES=Core feature/kindergarten-official-info-01-core(새 GET /v2/life/kindergartens{,/regions,/detail} + Site CORS)
DEPLOY_ORDER=CORE → SITE (Site 먼저면 유치원 탭이 "불러오지 못했어요"를 보인다)
PRODUCTION_FLAG_EFFECT=Core KINDERGARTEN_OPENAPI_ENABLED=false인 동안 유치원 탭은 "유치원 공식정보 연결을 준비하고 있어요" 안내 + 지역·유치원 이름 양식 → 입력창에 "<지역> <이름>유치원 알려줘"(기존 기관 기본정보 답, 공시 자료 아님 표시). 학교 탭은 바로 동작한다. ENABLED=true가 되면 Site 재배포 없이 공시 화면으로 바뀐다.
USER_DECISION_NEEDED=NONE (Core 쪽 인증키 교체·ENABLED 승인은 Core READY 문서 참조)

## 변경 요약

- 생활정보 다섯 번째 카드 "유치원·학교"(맨 끝). 홀수 개 마지막 카드는 한 줄 전체를 쓴다(빈 칸 없음). 새 route 없음, site-conversation.js 변경 없음.
- 학교 탭: 학교 이름 + [학교 기본정보 / 오늘 급식 / 이번 주 급식 / 학사일정] → 대화 입력창에 질문만 넣는다(기존 NEIS 답변). 이름 없이 급식·학사일정은 대화의 저장 학교를 쓰고, 이름 없는 기본정보는 이름을 요청한다. 저장 학교 키(life-school)는 읽지도 바꾸지도 않는다.
- 유치원 탭(유치원알리미 공시)
  - 지역: 유치원알리미 시도·시군구 코드표(16 시도, 261 시군구). 기본값 = 내 유치원 → 마지막 선택 지역 → 캘린더에 저장한 지역. 다른 지역도 고를 수 있다.
  - 이름(일부)·설립유형(전체/공립/사립/국립)으로 목록 → 카드: 이름, 설립유형, 주소, 운영시간·정원·원아.
  - 상세 첫 화면: 설립유형, 주소, 연락처(tel:), 운영시간, 학급·정원·원아, 홈페이지(http/https만, 새 창 noopener), 공시 기준(공시차수 · 교육부 유치원알리미).
  - 상세 공시(펼침): 통학차량, 급식운영, 방과후 과정, 교직원, 수업일수, 안전·환경위생, 건물·교실, 보험·공제회 — 각 공시차수. 공시 없음 / 권한 없음 / 지금 조회 실패를 구분해 쓰고 채워 넣지 않는다.
  - 출처 + 조회일, "어린이집은 유치원알리미 공시 대상이 아니에요", 학비는 Open API에 없어 말하지 않는다는 안내.
  - 내 유치원: 계정별 별도 키 `lotbi.site.ux.v1.life-kindergarten.<계정|guest>`(kinderCode·sggCode·이름·지역만). 상세에서 설정/해제, 목록 위에 카드.
- Core 요청은 GET, credentials omit, Accept JSON만. innerHTML 없음.

## MERGE_NOTES

- 온누리상품권 개발방(feature/onnuri-merchant-search-01-site, 아직 push 전)이 같은 LIFE_SHORTCUTS·클릭 줄·검사기 3개를 고친다. 합의한 합친 모양:
  - LIFE_SHORTCUTS: hospital, pharmacy, festivals, onnuri, local, education
  - 클릭: `item.id === 'festivals' ? onFestival() : item.id === 'onnuri' ? onOnnuri?.() : item.id === 'education' ? openEducation(item) : openLifeDetail(item)`; 아이콘 줄은 온누리의 brandSlot 줄을 쓴다.
  - 검사기 라벨/id 목록 끝에 '유치원·학교'/'education', 개수 6. validate_life_medical_category_entry_01의 spansRow는 둘 중 한 구현만 남긴다(폭 비교 / gridColumnStart·End, 결과 같음). 홀수 카드 CSS 규칙은 두 CSS 파일에 중복돼도 무해.
- asset 토큰 충돌은 `node scripts/asset_cache_version.mjs --write`로 다시 만든다.

## POST_DEPLOY_SMOKE

lotbiai.com → 생활정보 → 유치원·학교. Core ENABLED=false: 유치원 탭 "준비 중" 안내, 학교 탭 [이번 주 급식] → 입력창 "OO초 이번 주 급식 알려줘". Core ENABLED=true 이후: 전북특별자치도 → 전주시 덕진구 → "예일" → 예일유치원 상세(정원 253·원아 208 등은 공시차수에 따라 바뀜), 상세 공시 8개, 내 유치원 설정/해제. 모바일 실기기(iPhone Safari·Android Chrome) 확인은 아직 하지 않았다(뷰포트 에뮬레이션만).
