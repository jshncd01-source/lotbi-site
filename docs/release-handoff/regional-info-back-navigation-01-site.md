READY_FOR_DEPLOY=YES
TASK=REGIONAL-INFO-BACK-NAVIGATION-01 (P0, 배포총괄방 전달 소유자 신고 4건 — 2026-10-10 17:01~17:2x)
DEPENDS_ON=REGIONAL-CARDS-BUNDLE-01 site d020a8d6 (SITE-T52b로 배포 진행 중). 이 branch는 그 SHA에서 시작했다 — 부동산·전기차·지하철·CCTV 화면이 그 묶음에만 있기 때문. 그 뒤 main 61d3ce37(SITE-T53)을 정상 merge했다. T52b가 main에 들어가면 그 main과는 묶음이 조상이라 충돌 없이 이어진다. **T52b보다 먼저 배포하면 묶음 전체(지역카드 10장 등)가 함께 들어간다** — 순서는 T52b → 이 branch 권장.
DEPLOY_ORDER=Site only. Core·Admin·DB 변경 없음. 지하철 Core 선행 조건은 묶음(d020a8d6) 그대로.
USER_DECISION_NEEDED=없음(배포 차단 없음). 확인 권장 1건 — 아래 '내 아이 학교·유치원' 참고(로그인 없이 쓰던 '유치원·학교 찾기' 공개 조회가 지역정보에서 사라짐).

# REGIONAL-INFO-BACK-NAVIGATION-01 — 뒤로가기 한 단계씩 · 여백 탭으로 닫히지 않음 · 내 아이 화면 바로 열기 (Site)

REPO=lotbi-site
FEATURE_BRANCH=feature/regional-info-back-navigation-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD). `git ls-remote`로 확인.
BASE=REGIONAL-CARDS-BUNDLE-01 d020a8d6062315ca1a04f2db95db24e61a5f6783 (= site main d4d172a5 + 지역카드 묶음) + site main 61d3ce37f8ab3298d65411f68b327702e4c7bf0e(SITE-T53, 18:02 ls-remote) 정상 merge ae2a82b0(충돌은 asset 토큰과 import 줄뿐 — 이 branch 쪽 import, main의 findLabelCorners). push 직전 site main ls-remote 확인.
CODE_SHA=cedf6f43a
ASSET_TOKEN=aset-1d4521c105ad (asset_cache_version --check PASS)
MERGE_CHECK=T53 merge(ae2a82b0)가 site-consumer-sections.js에서 지운 '내 아이 선택' 코드(openChildChoice/openEducation — 호출하는 곳 없는 죽은 코드)를 되살렸다(main은 그 파일에서 토큰만 바꿈). 토큰을 지운 3-way merge를 94개 파일 전부 다시 계산해 비교 — 다른 파일은 이것 하나뿐 → cedf6f43에서 branch 쪽 내용으로 바로잡음.
OWNER=개발 · 부동산 실거래가 P0 방(배포총괄방 지정). 같은 기능을 맡은 다른 방·branch 없음(원격 feature/regional-info-back* 없음 확인).

## 신고와 원인

| # | 소유자 신고 | 원인(코드 위치) | 오늘 회귀? |
|---|---|---|---|
| 1 | 지역정보 → 내 아이 학교·유치원 → 뒤로가기 = 홈 | 지역정보 안의 화면(병원·응급실, 지역뉴스, 지역생활정보, 내 아이 학교·유치원)이 한 패널 안에서 바뀌고 history 항목이 없음(site-consumer-sections.js `openMedicalChoice`/`openNewsEntry`/`openLifeDetail`/`openChildChoice`). 시스템 뒤로가기는 `#life` 바로 앞(홈)으로, 화면 위 ←는 `installSurfaceBehavior`의 `dismiss` = `leaveSiteRoute('')`(홈)로 감. 온누리는 route를 'life'와 같이 써서(`openOnnuri` `const route = 'life'`) 뒤로가기가 홈. | 아님 |
| 2 | 어떤 페이지든 뒤로가기 = 홈 | 같은 구조: 각 작업 화면 안의 하위 화면이 history에 없다. 맨 위 화면(캘린더·Life Wallet·안심케어·진위확인)에서 홈으로 가는 것은 한 단계로 맞는 동작. | 아님 |
| 3 | 빈 여백 등 어디를 터치해도 홈 | `installSurfaceBehavior`의 `if (dismissOnBackdrop) { … click → dismiss() }` — 작업 화면(workspace)도 패널 밖 backdrop 탭으로 닫힘(10-07 2ad0cefe는 캘린더만 `dismissOnBackdrop: false`). 배포총괄방 운영 재현(375px #life, elementFromPoint = DIV.site-modal-backdrop.consumer-workspace)과 일치. | 아님 |
| 4 | 내 아이 학교·유치원 중간 2버튼 화면이 쓸모없음 | 카드 → '내 아이 정보' / '유치원·학교 찾기' 선택 화면(REGIONAL-INFO-APPROVED-UX-RESTORE-P0 설계). | 해당 없음(설계 변경) |

회귀 판정 근거: 10-09 마지막 main da861120과 오늘 main d4d172a5(T46~T50)의 route·history·닫기 코드(`syncSiteRouteToScreen`~`installSurfaceBehavior`, `siteRouteOpeners`~`restoreSiteRouteFromUrl`, site-surface-dismiss.js)를 asset 토큰을 지우고 비교 — 차이는 T48의 Life Wallet 공유 링크 두 줄(`hashchange`→`captureWalletShareIntent`, 복원 때 `captureWalletShareIntent()`)뿐. T50(요청 폭주 P0)은 route·history를 건드리지 않음.

## 바꾼 것

1. **지역정보 화면마다 route** (site-route.js 표에 추가): `life-medical`(병원·응급실), `life-news`(지역뉴스), `life-local`(지역생활정보), `life-my-child`(내 아이 학교·유치원) — 부모는 모두 `life`(`LIFE_VIEW_PARENT`, site-consumer-sections.js). 온누리상품권·지역화폐는 자기 route `onnuri`(backRoute `life`).
   - 화면이 바뀌면 지역정보 패널이 알리고(`onLifeView`) 대화 쪽이 URL·history 항목을 쓴다(기존 `queueSiteRouteSync`).
   - 시스템/브라우저/삼성 인터넷 뒤로가기 = popstate → `openLifeView` → 같은 패널에서 부모 화면.
   - 화면 위 ←, Escape, '지역정보로 돌아가기' = `requestLifeBack` → `leaveSiteRoute(parent)`(history 먼저 한 단계 → 그다음 화면 변경, 화면과 URL이 같은 task에서 바뀜 — 기존 FESTIVAL-BACK-04 계약 그대로). 지역정보 목록에서 ←는 전과 같이 홈.
   - 새로고침·직접 URL(`/#life-news` 등)은 그 화면을 다시 연다. 로그인 왕복도 SITE_ROUTES 허용 목록을 따르므로 그 화면으로 돌아온다.
2. **작업 화면은 여백 탭으로 닫히지 않음**: `if (dismissOnBackdrop && !workspace)` — 지역정보·Life Wallet·안심케어·반려동물·축제·부동산·전기차·지하철·온누리·CCTV 모두. 채팅 위 작은 팝업(프로필 메뉴 등)은 바깥 탭 닫힘 유지, 캘린더는 원래 예외 그대로. 기본값 `dismissOnBackdrop = true`도 그대로.
3. **내 아이 학교·유치원 바로 열기**(소유자: "학교·유치원 등록인데 메뉴를 왜 나눠?"): 카드 → 저장한 학교·유치원 화면(로그인 시 목록 + '학교·유치원 추가', 비로그인 시 로그인 안내). 학교(NEIS)·유치원(유치원알리미) 찾기는 '학교·유치원 추가' 안의 기존 흐름. 뒤로 = 지역정보 목록 한 단계.
   - **확인 권장**: 지금 운영의 '유치원·학교 찾기'는 실제로는 다른 화면이다(로그인 없이 학교/유치원 탭으로 공개 조회 — KINDERGARTEN-OFFICIAL-INFO-01, 운영 코드 site-consumer-sections.js?v=aset-9de51f1886ba `openEducation` 확인). 이번 변경으로 **비로그인 사용자는 지역정보에서 공개 조회로 갈 길이 없어진다**(로그인 안내만). 모듈(site-life-education.js·CSS)은 지우지 않아 다시 연결이 쉽다 — 원하면 비로그인 로그인 안내 아래에 '로그인 없이 찾기'로 붙이는 것을 제안.

4. **질문 뒤 history 정리 유지**: 기존 규칙(SITE-REFRESH-ROUTE-PAGE-CLEANUP-05 — 질문 전송·새 대화처럼 '다른 방법으로' 화면을 떠나면 그 화면의 history 사본을 남기지 않음)을 지역정보 안 화면에도 적용. 이제 지역정보 안 화면은 지역정보 항목 위에 쌓이므로, 예컨대 병원·응급실에서 질문하면 두 항목(#life, #life-medical)을 한 번에 접는다(`history.go(-2)`, 기존 한 항목 규칙 줄은 그대로). 앞으로 가기 = 지역정보 → 그 화면 순서로 다시 열림.

변경 파일(토큰 외): site-route.js, site-consumer-sections.js, site-conversation.js, .github/workflows/site-review.yml(새 검사 단계), scripts/validate_regional_info_back_navigation_01.mjs(새), 검사기 8개 갱신.

## 검사기

- **새 validate_regional_info_back_navigation_01.mjs** (CI site-review에 추가) — 360×780 삼성 인터넷 UA·390×844 iPhone UA·1280×900, 실제 Chrome CDP:
  - 카테고리 9개(병원·응급실, 지역뉴스, 지역생활정보, 내 아이 학교·유치원, 축제·행사, 전기차, 지하철, 온누리, 부동산) 각각: 브라우저 뒤로가기(Page.navigateToHistoryEntry — 안드로이드/삼성 뒤로 버튼과 같은 history 한 단계) → 지역정보 목록, 한 번 더 → 홈; 화면 위 ← → 지역정보(history index −1, 새 항목 없음), ← → 홈.
  - 내 아이 학교·유치원: 선택 화면 없음(`[data-child-choice]` 0), 저장 화면 바로, '지역정보로 돌아가기' → 목록(index −1, 카드에 focus), 앞으로 → 다시 열림, Escape(데스크톱) → 목록, 새로고침 → 같은 화면 → 뒤로 → 목록 → 홈, 직접 URL `/#life-news` → ← → 목록 → 홈.
  - **여백 탭**: 지역정보 목록·안의 화면 4개·축제·전기차·지하철·온누리·부동산·Life Wallet·안심케어 12곳에서 패널이 덮지 않은 빈 backdrop을 탭 → 화면·URL 그대로, history 변화 없음 → 다음 뒤로가기는 한 단계(12곳 모두 backdrop이 드러난 자리에서 실측).
  - 병원·응급실 → 병원·의원 찾기(질문): 대화로 돌아오고 history 위치가 지역정보 열기 전과 같음(사본 없음), 앞으로 → 지역정보 → 병원·응급실, 뒤로 → 지역정보 → 대화.
  - 화면이 보일 때마다 URL이 그 화면을 가리키는지(history 상태 일치) 단정.
  - 고치기 전 코드(d020a8d6)에서 실패함을 확인: 병원·응급실 화면이 열려도 URL `#life`, 화면 위 ← = '대화로 돌아가기'.
- 갱신(약화 없음):
  - site_refresh_route_restore_01: route 표 17개(지역정보 화면 4 + onnuri), 화면 route 목록에 onnuri, 지역생활정보 입력 찾기 선택자를 `[data-workspace="life"]`로(같은 surface, route만 life-local).
  - consumer_sections_02: 내 아이 카드에 선택 없음 + `openMyChild` 직접 + 선택·교육 연결 없음 단정.
  - consumer_design_shell_01: `if (dismissOnBackdrop && !workspace)` 단정 추가(기본값 true 단정 그대로).
  - my_child_school_01: 카드 → 저장 화면 바로(선택 []), '지역정보로 돌아가기' → 목록·focus.
  - kindergarten_official_info_01: 지역정보에 '유치원·학교 찾기' 진입 없음 단정. 모듈 화면 단정(시·도 선택·목록·상세 공시 8개·44px·라이트/다크 대비·내 유치원 키·학교 질문 문장)은 모두 유지 — 카드가 붙이던 그대로 지역정보 패널 안에 모듈을 직접 붙여 검사. 바꾼 단정: '유치원·학교 찾기' 버튼 이름·44px(2개) → '카드에 선택 없음·이 조회가 열리지 않음' 단정으로. 뺀 단정: 대화 연결 결과 5개(학교 질문 뒤 입력창 빈칸·입력창 focus·surface 닫힘, Core 꺼짐 질문 뒤 입력창 빈칸·focus) — 이 화면이 대화에 연결되지 않게 되어 해당 없음. onAsk로 넘기는 문장 2개는 그대로 단정.
  - life_direct_chat_card_compaction_01: 지역정보가 유치원·학교 모듈을 연결하지 않음을 단정, '학교' 질문 경우(진입 없음) 제외 — 지역생활정보·병원·약국·응급실 경우 그대로.
  - voucher_unified_p0: 온누리 뒤로가기 → 지역정보 목록(`#life`), 앞으로 → 온누리 화면(`#onnuri`) — 예전 단정은 'life' route를 같이 쓰던 때의 '앞으로 = 지역정보 목록'.
  - regional_news_p0_01: 지역뉴스 화면 ← → 지역정보 목록(`#life`) → ← → 대화 — 예전 단정은 ← 한 번에 지역정보 전체가 닫힘을 전제(그대로 두면 열린 지역정보 위로 대화 답변의 '관련 보도'를 누르려다 실패).
  - life_medical_category_entry_01·life_medical_auto_search_card_01: '내 아이 학교·유치원 안에 유치원·학교 찾기 유지' 단정 → '선택 없음·지역정보가 유치원·학교 모듈을 연결하지 않음·내 아이 질문은 같은 onAsk' 단정으로.
  - 카드 목록(10장) 검사기: 변경 없음.

SITE_TEST_RESULT=29개 중 28개 PASS (Windows 로컬, CHROME_BIN, 18:0x~19:0x). 최종 코드 cedf6f43에서 12개 재실행 — consumer_sections_02, hardening.py, my_child_school_01, kindergarten_official_info_01, life_direct_chat_card_compaction_01, life_medical_category_entry_01, life_medical_auto_search_card_01, regional_info_back_navigation_01(새), jeonbuk_real_world_pilot_01, calendar_modal_runtime_02, regional_news_p0_01 PASS. 그 직전 ae2a82b0(차이는 되살아난 죽은 코드뿐)에서 PASS: consumer_design_shell_01, festival_nav_wiring_01, surface_drag_dismiss_guard_01, life_wallet_customs_code_p0, life_wallet_wifi_card_01, life_wallet_entry_lock_01, life_info_cleanup_final_01, life_detail_design_01, onnuri_merchant_search_01, onnuri_location_ux_p0, voucher_unified_p0, ev_charger_nearby_list_p0_01, subway_life_info_p0_01, traffic_cctv_route_select_p0_01, real_estate_region_favorites_p0, site_session_request_storm_p0_01, calendar_month_temperature_01, regional_info_back_navigation_01. ES 모듈 문법 검사 전체 PASS, asset --check PASS.
BASELINE_FAILURE=site_refresh_route_restore_01의 'I login from /#scam(또는 /#wallet) → back … signed in'(로그인 왕복 뒤 auth 'checking') 1건 — **main 61d3ce37 그대로에서도 2회 연속 같은 실패**(임시 worktree로 확인), 이 PC 기준선 실패로 이미 기록된 항목. T53 merge 전 이 branch(ced40274)에서는 PASS. 그 밖의 route 경우(뒤로/앞으로·직접 URL·축제 ←·질문 바로 전송 등)는 모두 통과한 뒤 그 경우에서 멈춤.
NOT_RUN=Site CI 전체(merge gate)
NEW_FAILURES=0 (main 대비)
NOT_VERIFIED=실기기(삼성 인터넷·Android Chrome·iPhone Safari — UA·뷰포트 흉내만, 실제 뒤로 버튼 UI 아님). Chrome 계열의 '사용자 동작 없이 추가된 history 항목은 뒤로 버튼이 건너뜀' 규칙: 이번 항목은 모두 사용자 탭 뒤에 생기므로 해당 없다고 판단(실기기 미확인).
NOT_DONE(다음 작업 제안)=작업 화면 **모듈 안** 상세 화면은 여전히 history가 없다 — 뒤로가기가 한 단계 위를 건너뜀: Life Wallet 상세('목록으로' 2곳), 안심케어 사람 상세·등록('목록으로'/'돌아가기' 4곳), 반려동물 상세('← 목록으로' 3곳), 축제 상세('← 목록으로'·'목록으로 돌아가기'), 내 아이 학교·유치원 상세·편집('목록으로' 2곳), 캘린더 관리('돌아가기' 2곳). 예: 축제 상세에서 뒤로 → 축제 목록이 아니라 지역정보. 제안: 모듈의 안쪽 '목록으로' 버튼에 `data-subview-back` 표시 → 대화 쪽이 그 버튼이 보이는 동안 같은 route의 history 항목 하나를 두고, 뒤로가기·←가 그 버튼을 누르게 하는 공통 장치 + 화면별 검사. 6개 모듈·각 검사기에 걸쳐 P0 범위를 넘어 이번 READY에는 넣지 않음.
PRODUCTION/DB/SECRET/LIVE_MONEY/PAID_INFRA=변경 없음
MAIN_DRIFT=main 61d3ce37 merge 완료(19:05 ls-remote 그대로). T52b(묶음)가 main에 들어가면 이 branch와 충돌 없음(묶음 SHA가 조상). 그 밖의 main 변경이 먼저 들어가면 정상 merge 뒤 재검증.
NEXT_OWNER=배포총괄방
