READY_FOR_DEPLOY=YES
CORE_CHANGED=NO (이 Site branch). Core feature/regional-news-city-select-01-core c8f17f00의 `city`·`cities`·`province` 필요.
MIGRATION=NONE
DEPLOY_ORDER=CORE(city-select-01-core c8f17f00) 먼저 → 이 SITE. Site만 먼저 나가면 옛 Core는 `cities`를 안 줘서 시·군·구 칸이 숨겨질 뿐 시·도 단위 화면은 그대로 동작(안전).
USER_DECISION_NEEDED=NONE (소유자 승인 2026-10-11)

# regional-news-city-select-01-site — release handoff (2026-10-11)

FEATURE_BRANCH=feature/regional-news-city-select-01-site
SITE_BASE_MAIN_SHA=7c4f09445676287f242271cbdfb32d91ec33891e
CODE_SHA=db3428b690cee81da9e457a0c3a896aa5e4bc2fd
FEATURE_SHA=이 문서 커밋 (branch HEAD)
ASSET_VERSION=aset-651275a72736

## 바뀐 것 (지역정보 → 지역뉴스 화면)

- 시·군·구 선택: 시·도를 읽은 뒤 "시·군·구" 선택칸이 나타남(기본 "전체" = 시·도 전체). 고르면 그 지역 기사만, 제목은 "전주시 지역뉴스". 목록은 Core가 응답의 `cities`로 줌(세종처럼 없으면 칸이 안 보임). 현재 위치로 읽은 뒤에도 시·군·구로 더 좁힐 수 있음. 분야 탭·오늘 20건+더보기·1주일 날짜별은 그대로.
- QA #13 — 지역 바꾸는 수단 2개: **[현재 위치]**와 **[시·도 선택]**. 머리글의 "지역 변경" 위치 아이콘과 따로 있던 [위치 허용] 버튼을 없앰.
  - [현재 위치]가 브라우저 권한 요청도 겸함. 거부/실패하면 "위치를 확인하지 못했어요. 시·도를 골라 주세요."만 보이고 보던 목록은 유지.
  - 브라우저가 이미 허용한 회원은 들어오면 바로 현재 위치(시·도)로 열림. LOTBI 설정에서 위치 사용을 꺼 둔 회원에겐 [현재 위치]가 안 보이고 시·도 선택만.
  - 저장 지역이 있으면 "저장 지역 (전주시)"가 시·도 선택의 첫 항목으로 먼저 열림(시·도 단위).
- 줄바꿈 LF (site-life-news.js·css·검사기 바이트 확인).

## TEST_STATUS

TESTS=PASS (Windows 로컬, Chrome headless CDP, viewport emulation — 실기기 아님)
- validate_regional_news_p0_01 — 6개 화면(360/375/390/412/1280/390 다크) 전부 PASS: 선택 방법 정확히 2개(현재 위치·시·도 선택, 44px), 위치 아이콘·위치 허용 글자 없음, 시·도 선택 전 요청 0·위치 요청 0, 시·도 읽은 뒤 시·군·구 목록(전체 + Core 목록), 전주시 선택 → 요청 `region=전북특별자치도&city=전주시`·제목 "전주시 지역뉴스"·전주 기사만, 전체 → city 없는 요청, [현재 위치] 거부(알림·목록 유지·위치 요청 1회)→허용(현재 위치 목록), 허용 회원 자동 현재 위치(시·도 선택칸 숨김·시·군·구 가능), 위치 사용 끔 → [현재 위치] 없음.
- 관련 12개 순차: consumer_sections_02, life_medical_category_entry_01, life_info_cleanup_final_01, auth_continuity_02, bare_white_home_render_01, static_pages_theme_01, site.py, accessibility.py, life_medical_auto_search_card_01, my_child_school_01 PASS. jeonbuk_real_world_pilot_01·site_refresh_route_restore_01은 다른 방 검사와 동시에 돌 때 실패(고정 포트 모듈 로드 / 로그인 복귀) → 이 branch 단독 재실행 PASS(site_refresh는 site main 7c4f0944 원본에서도 1회 실패 → 간헐). 새 실패 0.
- asset --check PASS(aset-651275a72736, targets 159), sync_theme_bootstrap --check PASS.
- NOT TESTED: Linux trusted gate, 실기기, 운영 NAVER 실제 시·군·구 결과(Core 배포 뒤 smoke).
