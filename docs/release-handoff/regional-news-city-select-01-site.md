READY_FOR_DEPLOY=YES
CORE_CHANGED=NO (이 Site branch). Core feature/regional-news-city-select-01-core c8f17f00의 `city`·`cities`·`province` 필요.
MIGRATION=NONE
DEPLOY_ORDER=CORE(city-select-01-core c8f17f00) 먼저 → 이 SITE. Site만 먼저 나가면 옛 Core는 `cities`를 안 줘서 시·군·구 칸이 숨겨질 뿐 시·도 단위 화면은 그대로 동작(안전).
USER_DECISION_NEEDED=NONE (소유자 승인 2026-10-11: 시·군·구 선택, 같은 날 칩 개편 — 7탭 문제를 시나리오로 찾아 소유자 승인 문장으로 진행)

# regional-news-city-select-01-site — release handoff (2026-10-11)

FEATURE_BRANCH=feature/regional-news-city-select-01-site
SITE_BASE_MAIN_SHA=7c4f09445676287f242271cbdfb32d91ec33891e
CODE_SHA=905738b195a91c407fe7f9f79eda3f7896321eec
FEATURE_SHA=이 문서 커밋 (branch HEAD)
ASSET_VERSION=aset-c38d7a63e4ad

## 바뀐 것 (지역정보 → 지역뉴스 화면)

- 시·군·구 선택: 시·도를 읽은 뒤 시·군·구 칩 한 줄이 나타남(맨 앞 "전체" = 시·도 전체). 고르면 그 지역 기사만, 제목은 "전주시 지역뉴스". 목록은 Core가 응답의 `cities`로 줌(세종처럼 없으면 칸이 안 보임). 현재 위치로 읽은 뒤에도 시·군·구로 더 좁힐 수 있음. 분야 탭·오늘 20건+더보기·1주일 날짜별은 그대로.
- QA #13 — 지역 바꾸는 수단 2개: **[현재 위치]**와 **[시·도 선택]**. 머리글의 "지역 변경" 위치 아이콘과 따로 있던 [위치 허용] 버튼을 없앰.
  - [현재 위치]가 브라우저 권한 요청도 겸함. 거부/실패하면 "위치를 확인하지 못했어요. 시·도를 골라 주세요."만 보이고 보던 목록은 유지.
  - 브라우저가 이미 허용한 회원은 들어오면 바로 현재 위치(시·도)로 열림. LOTBI 설정에서 위치 사용을 꺼 둔 회원에겐 [현재 위치]가 안 보이고 시·도 선택만.
  - 저장 지역이 있으면 "저장 지역 (전주시)" 칩이 시·도 칩의 맨 앞에 있고 들어오면 바로 그 목록이 열림(시·도 단위).
- 선택창(드롭다운) 없음: 시·도·시·군·구 모두 버튼 칩. 시·도를 고르면 칩이 접히고 "전북 · 전주시 ▾" 한 줄 요약만 남아 첫 기사가 위쪽에 나옴.
- 줄바꿈 LF (site-life-news.js·css·검사기 바이트 확인).

## TEST_STATUS

TESTS=PASS (Windows 로컬, Chrome headless CDP, 실제 터치/마우스 입력, viewport emulation — 실기기 아님)
- validate_regional_news_p0_01 — 6개 화면(360/375/390/412/1280/390 다크) 전부 PASS: 선택 방법 2개([현재 위치]·시·도 요약 버튼, 44px), 위치 아이콘·위치 허용 글자·선택창(select) 없음, 시·도 칩 17개(44px, 화면 안), 시·도 1탭 후 칩이 접히고 요약 "전북 ▾", 시·군·구 칩 한 줄(전체 + Core 목록), 전주시 선택 → 요청 region+city·제목 "전주시 지역뉴스"·전주 기사만·요약 "전북 · 전주시 ▾", 전체 → city 없는 요청, **대전 서구 3탭(taps===3)과 첫 기사가 첫 화면 안**, [현재 위치] 거부(알림·목록 유지)→허용, 허용 회원 자동 현재 위치, 위치 사용 끔 → [현재 위치] 없이 요약 줄만, 오류·다시 시도, CSS 범위.
- 관련 11개 순차: consumer_sections_02, life_medical_category_entry_01, life_info_cleanup_final_01, auth_continuity_02, bare_white_home_render_01, static_pages_theme_01, site.py, accessibility.py, my_child_school_01, jeonbuk_real_world_pilot_01, life_medical_auto_search_card_01 모두 PASS. 새 실패 0.
- asset --check PASS(aset-c38d7a63e4ad, targets 159), sync_theme_bootstrap --check PASS. 줄바꿈 LF(바이트 확인).
- NOT TESTED: Linux trusted gate, 실기기, 운영 NAVER 실제 시·군·구 결과(Core 배포 뒤 smoke).

## 사용자 시나리오 (USER_FIRST_STANDARD 8번 — 사용자 입장에서 처음부터 끝까지 따라 해 본 기록)

방법: 검사기 하네스(Chrome headless, **실제 터치/마우스 입력으로 칩을 눌러 센 탭 수**, 가짜 Core 응답, 360·375·390·412px 휴대폰 / 1280px PC / 다크). **실기기·실제 NAVER 기사 아님** — 실기기 확인은 소유자 항목. 탭 수는 "지역정보 화면에서 시작"해서 센다.
스크린샷: `D:\LOTBI-WORK\regional-news-city-select-01\before\`(지금 운영 7c4f0944 화면) · `...\after\`(이 변경). 파일명 `mobile-<폭>x<높이>[-dark]-<단계>.png`, `desktop-1280x900-<단계>.png`. 저장소에는 넣지 않음. (PC 화면 왼쪽 위 `{"ok":true}`는 검사 하네스가 찍는 글자이고 실제 화면에는 없다.)

### 시나리오 1 — 위치를 이미 허용한 전주 사람이 "우리 동네 뉴스" 보기
- 시작 → 결과: **지역뉴스 1탭**. 들어가면 바로 현재 위치의 시·도(전북) 오늘 기사가 열림. 전주시만 보려면 시·군·구 칩 **1탭 더 = 2탭**.
- 막힌 곳: 없음. 전(선택창 방식)은 전주시까지 4탭이었음.
- 스크린샷: after `mobile-390x844-04-news-current.png`, `desktop-1280x900-04-news-current.png`, 다크 `mobile-390x844-dark-04-news-current.png`; 전주시 `...-03d-news-city.png`.

### 시나리오 2 — 대전 서구 사람이 시·도 → 서구 고르기 (소유자 지시 목표: 3탭 이내)
- 시작 → 결과: **지역뉴스 1 → 대전(시·도 칩) 2 → 서구(시·군·구 칩) 3 = 3탭**. 검사기가 실제 터치 3번으로 세고(taps === 3) 확인함. 전 7탭(선택창 열기·고르기·완료 ×2 + 지역뉴스).
- 첫 화면: 선택 뒤 한 줄 요약 "대전 · 서구 ▾" + 시·군·구 칩 한 줄로 접혀 **첫 기사가 360x780 화면 위쪽(약 410px)에 나옴**(전 545px 이하). 검사기가 첫 기사 아래끝이 화면 높이 안인지 단정함.
- 막힌 곳: 없음. 시·도 칩은 17개가 한 화면에 다 보임(3~5개씩 줄바꿈). "전체" 칩으로 시·도 전체로 돌아옴.
- 스크린샷: before `mobile-390x844-02-news-pick.png`(시·도 칸 + 위치 아이콘 + [위치 허용]); after `mobile-360x780-02-news-pick.png`(칩 17개), `mobile-360x780-03e-news-seogu-three-taps.png`, `mobile-390x844-03e-news-seogu-three-taps.png`, `desktop-1280x900-03e-news-seogu-three-taps.png`, 다크 `mobile-390x844-dark-03e-news-seogu-three-taps.png`.

### 시나리오 3 — LOTBI 설정에서 위치 사용을 꺼 둔 사람(또는 위치 없는 PC)이 뉴스 보기
- 시작 → 결과: 저장 지역이 있으면 **지역뉴스 1탭**으로 저장 지역의 시·도 기사가 열림(위 한 줄 "전북 ▾"). 없으면 **지역뉴스 1 + 시·도 칩 1 = 2탭**(칩이 이미 펼쳐져 있음).
- 막힌 곳: 없음. [현재 위치]는 아예 보이지 않음(눌러도 안 되는 버튼을 두지 않음). 남는 한 줄 "전북 ▾"은 선택지가 아니라 지금 무엇을 보는지 알려 주고 누르면 시·도 칩이 열림.
- 스크린샷: after `mobile-390x844-04b-news-location-off.png`, `desktop-1280x900-04b-news-location-off.png`, 다크 `mobile-390x844-dark-04b-news-location-off.png`.

### 시나리오 4 — 위치 허용을 거절한 사람이 [현재 위치]를 눌렀을 때
- 시작 → 결과: [현재 위치] 1탭 → 브라우저 권한창에서 거절 → "위치를 확인하지 못했어요. 시·도를 골라 주세요." 가 보이고 보던 목록은 그대로, 시·도 칩이 바로 펼쳐져 다음 행동이 보임(칩 1탭).
- 막힌 곳: 없음. 전: 위치 아이콘·[위치 허용]·시·도 칸 3곳이 따로라 헷갈렸음.
- 스크린샷: after `mobile-390x844-04a-news-location-denied.png`, `desktop-1280x900-04a-news-location-denied.png`.

### 시나리오 5 — 뉴스를 못 불러왔을 때
- 시작 → 결과: 오류 문구 + [다시 시도] 1탭. 옛 목록·가짜 기사는 지우고 보여 주지 않음. 지역(요약 줄)·분야·기간 버튼은 그대로 있어 다른 지역을 바로 고를 수 있음(막다른 화면 아님).
- 스크린샷: after `mobile-390x844-03b-news-error.png`, `desktop-1280x900-03b-news-error.png`, 다크 `mobile-390x844-dark-03b-news-error.png`.

### 전·후 한눈에
- 지역 바꾸는 방법: 전 3곳(위치 아이콘 · [위치 허용] · 시·도 칸) → 후 2개([현재 위치] · 시·도 요약 버튼).
- 대전 서구까지: 전 7탭(휴대폰 선택창) → 후 3탭. 시·도까지: 전 4탭 → 후 2탭.
- 시·도 안에서 더 좁히기: 전 불가 → 후 시·군·구 칩(기본 전체).
- 선택창(드롭다운)은 이 화면에서 없어짐 — 검사기가 select 0개를 확인함.
- 남은 불편(눈으로 본 것): 시·군·구가 많은 시·도(경기 31개 등)는 칩 한 줄을 옆으로 밀어야 끝까지 보임. 시·도 칩 17개는 펼친 동안 첫 기사가 화면 아래로 내려감(고르면 접힘).
