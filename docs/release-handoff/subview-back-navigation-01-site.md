READY_FOR_DEPLOY=YES
TASK=SUBVIEW-BACK-NAVIGATION-01 (배포총괄방 후속 지시 — 소유자 원요구 "어떤 페이지를 가도 뒤로가기가 한 단계씩": 화면 안 상세·창까지) + QA 2026-10-10 지역정보 #3·#12·#14(#15는 유지 — 근거 아래) + 소유자 결정 "1링크 다시 살리"(비로그인 '로그인 없이 학교·유치원 찾기')
DEPENDS_ON=REGIONAL-INFO-BACK-NAVIGATION-01 b4436051 (이 branch의 시작점 — 지역정보 route·여백 탭·내 아이 변경). 이 branch는 그 위에 site main afb7057d(SITE-T52c, 지역카드 묶음 운영본)까지 merge했으므로 **이 branch 하나만 배포하면 b4436051도 함께 들어간다**(b4436051 단독 배포는 불필요).
DEPLOY_ORDER=Site only. Core·Admin·DB 변경 없음.
USER_DECISION_NEEDED=없음(배포 차단 없음). 소유자 판단 권장 1건 — QA #15 '병원·응급실' 2버튼 화면(아래).

# SUBVIEW-BACK-NAVIGATION-01 — 화면 안 상세·창에서 뒤로가기 한 단계 (Site)

REPO=lotbi-site
FEATURE_BRANCH=feature/subview-back-navigation-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD). `git ls-remote`로 확인.
BASE=feature/regional-info-back-navigation-01-site b4436051374ed0c4b19c16afc107358bb31394d9 + site main afb7057d1(SITE-T52c) 정상 merge 6ed0a275d. push 직전 site main ls-remote 확인.
CODE_SHA=d2848ba1d
ASSET_TOKEN=aset-7c6d3790a1a4 (asset_cache_version --check PASS)
MERGE_CHECK=afb7057d merge가 site-consumer-sections.js에서 지운 '내 아이 선택' 코드(openChildChoice/openEducation)를 다시 되살렸다(앞 branch의 T53 merge 때와 같은 현상 — main은 그 파일을 묶음 그대로 두었는데 git이 지운 블록과 토큰 줄을 맞추며 되살림). 이 branch 쪽 내용으로 바로잡고, 101개 파일 전부 '토큰을 지운 내용이 이 branch와 다르면 main이 두 조상(d020a8d6·61d3ce37)과 다른 실제 변경을 한 파일인가'로 점검 → 의심 0개, main 실제 변경 24개(온누리 지도 버튼, 사진 선택 image/*, 공통 기준 V1 문서, 관련 검사기)만 들어옴.
OWNER=개발 · 부동산 실거래가 P0 방(배포총괄방 지정). 같은 일을 맡은 다른 branch 없음(원격 feature/subview-back* 없음). 축제·행사 UX 방(feature/festival-ux-polish-01-site)과 조율: 축제 표시 두 줄을 그쪽도 같은 자리에 넣기로 함, 그쪽은 site-conversation.js를 건드리지 않음.

## 원인

화면(지역정보·Life Wallet·안심케어·캘린더 …) 안의 상세·창은 모듈이 같은 패널 안에서 바꾸고 history 항목을 쓰지 않았다. 그래서 휴대폰 뒤로가기는 그 화면 전체를 닫았다(앞 READY의 '오늘 회귀 아님' 판정과 같은 구조 — 원래부터 그랬음).

## 바꾼 것

1. **공통 장치** (site-conversation.js, 모듈 쪽은 표시만):
   - 모듈은 화면 안 한 층(상세·창)의 '돌아가기/닫기' 버튼에 `data-subview-back`을 붙인다(층 하나에 하나). 모달 하단 시트(site-bottom-sheet.js, aria-modal)의 닫기는 자동으로 같은 대상.
   - shell은 보이는 표시 버튼 수만큼 같은 URL의 history 항목을 그 화면 항목 위에 둔다(그 화면의 route 정보를 물려받음 — URL·route 표 변경 없음). 보임 = 연결됨·disabled 아님·`[hidden]` 조상 없음.
   - 휴대폰/브라우저 뒤로가기 = 항목 하나를 내리고 맨 위 층의 그 버튼을 대신 누름(모듈이 자기 방식대로 돌아감). 작업 화면(지역정보·Life Wallet·안심케어 …)의 위쪽 ←와 Escape도 그 버튼을 먼저 누름. **덮개 화면의 ×(캘린더)는 원래대로 덮개 전체를 닫음**(캘린더 '두 버튼' 검사기가 지키는 계약 — 처음 구현이 ×까지 한 층 뒤로로 바꿔 그 검사기가 실패했고 바로잡음).
   - 모듈이 스스로 돌아가면(사용자가 '목록으로'를 누르는 등) shell이 그 항목을 조용히 한 단계 걷어냄. 단, 모듈이 화면을 다시 그리느라(저장 직후 등) 버튼이 잠깐 사라졌다 생기는 경우에 항목을 걷었다 다시 쌓지 않도록 **0.2초 동안 계속 없을 때만** 걷음(그 사이 ←·뒤로가기도 남은 층 수를 그대로 셈 — 내 아이 검사기에서 저장 직후 뒤로가기가 한 칸 더 가는 경합을 잡아 고침).
   - 다른 방법으로 화면을 떠날 때(질문 전송·다른 화면 열기)와 화면 위 ←로 화면을 나갈 때는 쌓인 층 항목까지 함께 걸어 내려감(기존 PAGE-CLEANUP-05·FESTIVAL-BACK-04 계약 유지).
   - 새로고침으로 층이 사라진 항목은 화면 복원 뒤 걷어냄.
   - `html[data-subview-back-shell]` 표시: 모듈 CSS가 '장치가 있을 때만' 안쪽 돌아가기 버튼을 숨길 수 있게(축제 UX 방 요청 — 옛 shell에서는 버튼이 그대로 보임).
2. **표시를 붙인 버튼** (모두 기존 버튼, 동작 변경 없음 — 속성 한 줄씩):
   - Life Wallet: 무료 한도 화면 '목록으로', 카드 상세 '목록으로', 개인통관고유부호 상세 '목록으로'
   - 안심케어 사람: 상단 '← 목록으로'(수정·관리·등록 화면 공통), 등록 중 '등록 취소'(누르면 취소 확인 시트 — 그 시트도 층)
   - 반려동물: 상세 '← 목록으로', 등록 '← 목록으로'
   - 축제·행사: 프로그램 '← 목록으로/← 행사 정보로', 상세 '← 목록으로'(상세는 캘린더에서 다시 들어갈 때만 열림)
   - 내 아이 학교·유치원: 추가 '목록으로', 상세 '목록으로', 상세 수정 '취소'(→ 상세)
   - 캘린더: 날짜 시트 '닫기', 설정 '×', 읽기 전용 '닫기', 기록 편집 '×', 삭제 확인 '취소', 사진 확인 '×', 금액 '×'
   - 표시하지 않은 것: 부동산 아파트 상세(이미 자기 route `real-estate-apartment`), 데스크톱의 펼침형(INLINE) 시트(층이 아니라 카드 안 영역).

3. **QA 2026-10-10 지역정보 항목** (배포총괄방 전달, 보고서 handoff/qa-report-20261010/QA_사용자편의성_일괄보고_01.md):
   - **#3(P1) 뒤로 둘** — 지역정보 하위 화면(병원·응급실·지역뉴스·지역생활정보·내 아이)의 아래 글자 링크 '지역정보로 돌아가기'를 없앰. 위쪽 ←가 b4436051부터 '지역정보로 한 단계'(이름표도 '지역정보로 돌아가기')라 하나만 남김. 축제 프로그램의 '←' + '← 목록으로'는 축제 UX 방(f2f51659)이 이 장치의 `html[data-subview-back-shell]` 표시로 안쪽 버튼을 숨겨 해결.
   - **#12(P2) 온누리 아이콘 없음** — LOTBI 자체 선 아이콘 'voucher'(상품권 모양, 공식 로고 아님)를 넣음. 공식 로고 승인 뒤 바꿔 끼울 자리 정보(brandSlot 'onnuri')는 유지. 기존 '대체 아이콘 없음' 단정(온누리·상품권 검사기 2개)은 이 사양으로 바꿈.
   - **#14(P2) 지역생활정보 = 챗과 같은 입력** — 한 번 누르면 바로 묻는 예시 질문 4개('쓰레기 배출 요일'·'주민센터 운영시간'·'대형폐기물 버리는 방법'·'공영주차장 위치') — '근처' 표현이 없어 현재 위치를 보내지 않음(lifeLocationIntent false 단정, 화면 문구 '현재 위치는 자동으로 수집하지 않습니다' 그대로 참). 빈 칸으로 보내면 브라우저 기본 경고 대신 LOTBI 문구 "지역 또는 장소를 입력해 주세요."(form noValidate, role=status).
   - **#15(P2) 병원·응급실 2버튼 화면 — 바꾸지 않음**: 이 카드는 오늘 소유자가 승인한 지역정보 메뉴(REGIONAL-INFO-APPROVED-UX-RESTORE-P0, "one 병원·응급실 card opens a two-way choice … owner decision 2026-10-10")의 설계다. '내 아이'는 소유자가 직접 바꾸라고 했지만 병원·응급실은 소유자 결정이 없다. 둘로 나누면 승인된 카드 10장(5줄×2)이 11장이 되어 배치·검사기도 바뀐다. 병원·의원/응급실은 다른 '화면'이 아니라 서로 다른 질문 두 개다. → 소유자가 원하면 '병원·의원'·'응급실' 카드 2장으로 나누는 안(11장, 마지막 카드 한 줄)을 따로 진행.

4. **소유자 결정 2026-10-10 "1링크 다시 살리"** — 내 아이 학교·유치원 화면에서 **비로그인일 때만** 아래에 '로그인 없이 학교·유치원 찾기' 링크(44px). 누르면 공개 조회(KINDERGARTEN-OFFICIAL-INFO-01, 학교/유치원 탭) 화면 — 주소 `#life-education`, 부모 `life-my-child`. 위쪽 ← 이름표 '내 아이 학교·유치원으로 돌아가기'. 뒤로가기·←: 공개 조회 → 내 아이 학교·유치원(링크에 focus) → 지역정보 → 홈, 한 단계씩. 새로고침·직접 주소도 그 화면. 로그인 상태는 지금처럼 저장 화면 바로(링크 없음). 공개 조회 안 '유치원 목록으로'(유치원 상세 → 목록)에도 층 표시를 붙여 뒤로가기 한 단계. 앞 READY(b4436051)의 '공개 조회 진입 사라짐 — 확인 권장'은 이 결정으로 해소.

## 검사기

- **새 validate_subview_back_navigation_01.mjs** (CI site-review에 추가) — 실제 Chrome CDP, 360×780 삼성 인터넷 UA·1280×900:
  - 정적: 모듈별 표시 개수·위치(Life Wallet 3, 안심케어 2, 반려동물 2, 축제 2, 내 아이 3, 캘린더 7), 부동산 0, shell 훅·표시.
  - 장치(실제 지역정보 화면 안 시험용 층): 열면 history +1·URL 그대로 / 뒤로가기 → 층만 닫힘·화면 유지·index 원위치 / 화면 위 ← / 층 자체 버튼 / 두 겹 → 두 단계 / Escape(데스크톱) / 모달 하단 시트 → 뒤로 = 시트만 닫힘 / 새로고침 뒤 남은 층 항목 정리 / 그다음 뒤로 = 화면 한 단계.
  - 실제 모듈: 축제 카드 [프로그램] 화면 → 뒤로 → 목록, [접수] 시트(휴대폰) → 뒤로 → 목록 → 뒤로 → 지역정보 / 캘린더 '설정' → 뒤로 → 캘린더, 날짜 시트 → '+ 기록' 편집 창 → 뒤로 → 날짜 시트 → 뒤로 → 캘린더 → 뒤로 → 홈.
  - 2회 연속 실행 모두 PASS.
- **validate_my_child_school_01**에 단계 추가(로그인 상태 실제 모듈): 저장한 학교 상세에서 휴대폰 뒤로 → 저장 목록(지역정보 `#life-my-child` 그대로) → 다시 열어 기존 흐름 계속. 끝의 '지역정보로 돌아가기'는 위쪽 ← 두 번(추가 화면 → 저장 목록 → 지역정보)으로.
- **validate_regional_info_back_navigation_01**(앞 branch의 새 검사기)에 QA 단정 추가: 하위 화면마다 글자 링크 없음(#3), 온누리 아이콘(#12), 예시 질문 4개·위치 안 보냄·빈 칸 LOTBI 문구·예시 한 번에 전송(#14). 글자 링크를 누르던 단계는 위쪽 ←로.
- **공개 조회 링크**: kindergarten_official_info_01·life_direct_chat_card_compaction_01을 main 원본 단정 그대로 되살리고(앞 branch에서 진입이 없어 뺐던 '질문 뒤 입력창 빈칸·focus 없음·화면 닫힘' 등 포함) 진입 경로만 '선택 버튼' → '비로그인 링크'로. my_child_school_01: 로그인 상태 링크 없음·비로그인 링크 있음. regional_info_back_navigation_01: 링크 → `#life-education` → 시스템 뒤로 → 내 아이(링크에 focus) / ← 한 단계(index −1). consumer_sections_02·life_medical 2개: 비로그인 전용 링크·`openEducation`·`mountEducation({root: host, onAsk, accountId})` 단정. site_refresh_route_restore_01: route 표에 life-education. subview: 공개 조회 표시 1.
- 갱신(새 사양 — 약화 아님): regional_news_p0_01·life_info_cleanup_final_01(글자 링크 대신 위쪽 ←, 글자 링크 0개 단정 추가), onnuri_merchant_search_01·voucher_unified_p0(대체 아이콘 없음 → LOTBI 'voucher' 아이콘·공식 로고 이미지 없음·로고 자리 정보 유지).

SITE_TEST_RESULT=127개 중 126개 PASS (Windows 로컬, CHROME_BIN, 최종 코드 d2848ba1d, 21:19). 범위: 달력 전체, 축제 전체, Life Wallet·안심케어·반려동물·사람·진위확인, 내 아이·유치원, 지역정보 화면 전체(뉴스·의료·온누리·상품권·전기차·지하철·부동산·CCTV 끔·전북), 새로고침 route, T50 요청 폭주, T52c 사진 선택, hardening. 새 validate_subview_back_navigation_01·validate_regional_info_back_navigation_01 모두 PASS.
FLAKE_ONE=validate_calendar_day_panel_two_buttons_01 1개 — '날짜를 누르면 열린 상세에 포커스' 단정이 큰 묶음 안에서만 실패. **이 branch 탓이 아님을 같은 조건 비교로 확인**: ① 같은 앞 순서(달력 6개)를 단독으로 돌리면 기준선(main afb7057d)·이 branch 모두 PASS. ② 검사기+Chrome을 2코어로 제한(배포방 Linux gate 조건)해 기준선·이 branch를 번갈아 4번씩 — **기준선 4/4 실패**(포커스 단정 2·`:4207/site-conversation.js` 불러오기 실패 2), **이 branch 2/4 실패**(불러오기 실패 2)·2/4 PASS. ③ 포커스가 제목으로 가는 경로는 달력 코드에 이미 있는 '배경 다시 그리기(날씨·공휴일)가 끝나면 날짜 창 안 포커스를 제목으로 되돌림'(site-calendar-manager.js 4531-4536, 이 branch가 건드리지 않음). ④ '불러오기 실패'는 이 검사기가 포트 4207에 고정 서버를 띄워, 다른 방·이전 실행과 겹치면 다른 폴더 파일을 읽는 구조(실행 뒤 4207에 python http.server가 남아 있는 것을 한 번 확인, 곧 사라짐). → 부하 흔들림. 검사기 정비(임의 포트, 배경 다시 그리기 뒤 단정)는 별도 권장.
BASELINE_NOTE=앞 branch READY에 적은 기준선 실패 'site_refresh_route_restore_01 로그인 왕복'은 이 실행에서는 PASS(흔들림).
NOT_RUN=Site CI 전체(merge gate)
NEW_FAILURES=0 (main 대비 — FLAKE_ONE은 기준선에서 더 자주 실패함을 확인)
NOT_VERIFIED=실기기(삼성 인터넷·Android Chrome·iPhone Safari 실제 뒤로 버튼). Life Wallet·안심케어 사람·반려동물 상세의 브라우저 흐름(로그인·데이터 필요 — 표시 위치는 정적 단정, 장치 동작은 시험용 층·축제·캘린더·내 아이 실제 화면으로 확인).
KNOWN_EDGE=층을 연 채 메뉴로 다른 화면을 열면 그 층 항목이 history에 묻혀 남는다 → 나중에 그 자리로 뒤로 오면 원래 화면(목록)이 열리고, 한 번 더 누를 때 같은 화면에 머무는 '빈 뒤로' 1회가 생길 수 있음. 앞으로 가기로 층 항목에 오면 층은 다시 열리지 않음(목록 그대로).
PRODUCTION/DB/SECRET/LIVE_MONEY/PAID_INFRA=변경 없음
MAIN_DRIFT=main afb7057d merge 완료. 그 뒤 main이 바뀌면 정상 merge(토큰 정규화 전수 점검 포함) 뒤 재검증.
NEXT_OWNER=배포총괄방
