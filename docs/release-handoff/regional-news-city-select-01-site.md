READY_FOR_DEPLOY=YES
CORE_CHANGED=NO (이 Site branch). Core feature/regional-news-city-select-01-core c8f17f00의 `city`·`cities`·`province` 필요.
MIGRATION=NONE
DEPLOY_ORDER=CORE(city-select-01-core c8f17f00) 먼저 → 이 SITE. Site만 먼저 나가면 옛 Core는 `cities`를 안 줘서 시·군·구 칸이 숨겨질 뿐 시·도 단위 화면은 그대로 동작(안전).
USER_DECISION_NEEDED=NONE (소유자 승인 2026-10-11)

# regional-news-city-select-01-site — release handoff (2026-10-11)

FEATURE_BRANCH=feature/regional-news-city-select-01-site
SITE_BASE_MAIN_SHA=7c4f09445676287f242271cbdfb32d91ec33891e
CODE_SHA=51b63c80854416d924f478fe7674d479c2c33ae2
FEATURE_SHA=이 문서 커밋 (branch HEAD)
ASSET_VERSION=aset-868e88390b8e

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
- asset --check PASS(aset-868e88390b8e, targets 159), sync_theme_bootstrap --check PASS.
- NOT TESTED: Linux trusted gate, 실기기, 운영 NAVER 실제 시·군·구 결과(Core 배포 뒤 smoke).

## 사용자 시나리오 (USER_FIRST_STANDARD 8번 — 사용자 입장에서 처음부터 끝까지 따라 해 본 기록)

방법: 검사기 하네스(Chrome headless, 실제 터치/마우스 입력, 가짜 Core 응답, 360·375·390·412px 휴대폰 / 1280px PC / 다크). **실기기·실제 NAVER 기사 아님** — 실기기 확인은 소유자 항목. 탭 수는 "지역정보 화면에서 시작"해서 센다. 휴대폰 선택창은 삼성 인터넷처럼 "항목 고르기 + 완료"까지 눌러야 한다고 보고 선택 1번 = 3탭(열기·고르기·완료)으로 센다.
스크린샷 위치: `D:\LOTBI-WORKegional-news-city-select-01efore\`(지금 운영 7c4f0944 화면) · `...fter\`(이 변경). 파일명 `mobile-<폭>x<높이>[-dark]-<단계>.png`, `desktop-1280x900-<단계>.png`. (PC 화면 왼쪽 위 `{"ok":true}`는 검사 하네스가 찍는 글자이고 실제 화면에는 없다.)

### 시나리오 1 — 위치를 이미 허용한 전주 사람이 "우리 동네 뉴스" 보기
- 시작 → 결과: **지역뉴스 1탭**. 들어가면 바로 현재 위치의 시·도(전북특별자치도) 오늘 기사가 열림. 버튼·선택 필요 없음.
- 막힌 곳: 없음. (전: 같은 흐름이 1탭이지만 머리글 위치 아이콘·[위치 허용]이 따로 보였음.)
- 이어서 전주시만 보려면: 시·군·구 선택칸(전체) 열기·전주시·완료 = 3탭 추가(합계 4탭).
- 스크린샷: after `mobile-390x844-04-news-current.png`, `desktop-1280x900-04-news-current.png`, 다크 `mobile-390x844-dark-04-news-current.png`; 전주시 `...-03d-news-city.png`.

### 시나리오 2 — 대전 서구 사람이 시·도 → 서구 고르기
- 시작 → 결과: 지역뉴스 1 + 시·도(열기·대전광역시·완료) 3 = **4탭에 대전 전체**, 서구까지는 시·군·구 3탭 더 = **7탭**(휴대폰 선택창 기준). PC는 선택 1번 = 2탭(열기·고르기)이라 5탭.
- 막힌 곳: 없음(되돌아가기 막힘 없음, "전체"로 돌아옴). **불편한 점(눈으로 본 것)**: 탭 수가 새 기준 1~2탭보다 많고, 시·도·시·군·구·기간·분야 선택이 쌓여 휴대폰 첫 화면의 아래쪽에서야 첫 기사가 나온다(360x780에서 첫 기사 y≈545). → 후속 제안: 시·도를 17개 칩, 시·군·구를 칩으로 바꿔 선택 1탭(합계 3탭)으로, 선택칸을 한 줄 요약("대전광역시 · 서구 ⌄")으로 접기. 소유자 결정이 필요해 이번엔 선택칸 방식 그대로.
- 스크린샷: before `mobile-390x844-02-news-pick.png`(시·도 칸 + 위치 아이콘 + [위치 허용]); after `mobile-390x844-02-news-pick.png`, `mobile-390x844-03d-news-city.png`, `desktop-1280x900-03d-news-city.png`, 다크 `mobile-390x844-dark-03d-news-city.png`.

### 시나리오 3 — LOTBI 설정에서 위치 사용을 꺼 둔 사람(또는 위치 없는 PC)이 뉴스 보기
- 시작 → 결과: 저장 지역이 있으면 **지역뉴스 1탭**으로 저장 지역의 시·도 기사가 열림. 없으면 지역뉴스 1 + 시·도 선택 3 = 4탭.
- 막힌 곳: 없음. [현재 위치]는 아예 보이지 않고(눌러도 안 되는 버튼을 두지 않음), 선택지가 하나뿐인 줄(시·도 선택 버튼)도 보이지 않음 — 이번에 화면을 보고 추가로 고침(새 기준 5번).
- 스크린샷: after `mobile-390x844-04b-news-location-off.png`, `desktop-1280x900-04b-news-location-off.png`, 다크 `mobile-390x844-dark-04b-news-location-off.png`.

### 시나리오 4 — 위치 허용을 거절한 사람이 [현재 위치]를 눌렀을 때
- 시작 → 결과: [현재 위치] 1탭 → 브라우저 권한창에서 거절 → "위치를 확인하지 못했어요. 시·도를 골라 주세요." 가 보이고 보던 목록은 그대로, [시·도 선택]이 눌린 상태로 시·도 칸이 열려 있음(다음 행동이 바로 보임).
- 막힌 곳: 없음. 전: 위치 아이콘·[위치 허용]·시·도 칸 3곳이 따로라 무엇을 눌러야 할지 헷갈렸음.
- 스크린샷: after `mobile-390x844-04a-news-location-denied.png`, `desktop-1280x900-04a-news-location-denied.png`.

### 시나리오 5 — 뉴스를 못 불러왔을 때
- 시작 → 결과: 오류 문구 + [다시 시도] 1탭. 옛 목록·가짜 기사는 지우고 보여 주지 않음. 지역·분야·기간 버튼은 그대로 있어 다른 지역을 바로 고를 수 있음(막다른 화면 아님).
- 스크린샷: after `mobile-390x844-03b-news-error.png`, `desktop-1280x900-03b-news-error.png`, 다크 `mobile-390x844-dark-03b-news-error.png`.

### 전·후 한눈에
- 지역 바꾸는 방법: 전 3곳(위치 아이콘 · [위치 허용] · 시·도 칸) → 후 2개([현재 위치] · [시·도 선택]); 위치 사용 끈 사람은 1개이고 그 1개는 화면에 안 보임.
- 시·도 안에서 더 좁히기: 전 불가 → 후 시·군·구 선택(기본 전체).
- 옛 흐름 화면: before `mobile-390x844-03-news-list.png`(목록)·`03b-news-error.png`(오류) 등, after는 위 파일. 캡처 폴더는 이 PC의 D:\LOTBI-WORK\regional-news-city-select-01\ (저장소에는 넣지 않음).
