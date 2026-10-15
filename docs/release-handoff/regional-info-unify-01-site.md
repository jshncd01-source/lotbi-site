READY_FOR_DEPLOY=YES

STATUS=지역정보 11개 화면을 소유자 확정 시안(2026-10-14, "응 지제 배포 시작해")대로 한 디자인으로 통일. Site만 바뀜(Core·Web·App 무변경). 실기기 NOT TESTED(뷰포트 에뮬레이션만).

[LOTBI REGIONAL INFO UNIFY 01 — RELEASE HANDOFF]

TASK=REGIONAL-INFO-UNIFY-01
REPO=lotbi-site
FEATURE_BRANCH=feature/regional-info-unify-01-site
READY_SHA=이 문서가 들어간 커밋(branch HEAD, ls-remote로 확인)
BASE_MAIN_SHA=2047877405928309dd4ed634266e2f4fb2be5b57 (앞 순번 방들이 main에 들어가면 Gate 전에 새 main을 정상 merge하고 토큰 재생성·재검사)
GATE_ORDER=D:\LOTBI-WORK\locks\site-gate-queue.md 8번(맨 마지막)
DEPLOY_SCOPE=lotbi-site only
CORE_CHANGED=NO / MIGRATION=NONE / ENV_CHANGE_REQUIRED=NO / NEW_SECRET_CREATED=NO / STORED_DATA_CHANGED=NO

CHANGED_FILES(토큰 줄 제외)=
  site-regional-info-ds.css(신규, index.html·auth/callback/index.html 마지막 CSS로 같은 순서 연결)
  site-consumer-sections.js, site-conversation.js(허브 설명 1줄), site-life-medical-list.js, site-life-ev-chargers.js,
  site-life-news.js, site-life-subway.js, site-festival-ui.js, site-life-vouchers.js, site-life-onnuri.js, site-life-my-child.js
  검사기: validate_life_medical_list_01, validate_life_medical_category_entry_01, validate_subway_life_info_p0_01,
  validate_my_child_school_01, validate_regional_news_p0_01, validate_onnuri_merchant_search_01, validate_consumer_documents_01,
  허브 카드 설명 문구를 쓰는 검사기 9개(같은 문자열 교체)

WHAT_CHANGED=
  - 메인: 「현재 위치 · 지역」 → 지역 이름 + 「내가 정한 지역」(GPS가 아니라 저장 지역임을 밝힘). 지역이 없으면 「내 지역을 정해 주세요」+[지역 고르기]. 카드 8개 선 아이콘·설명 문구 시안대로.
  - 병원·약국: 배지 「진료 시간 중/오늘 진료 끝남/곧 마감 · 18:00/야간 진료」(등록 시간 기준임을 문구로), 운영시간 줄, 한계 안내는 목록 위 한 번. 응급실: 병상 보고 칸(숫자·보고 시각·정보 없음) + 병원 공지(원문 그대로), 운영시간 배지 없음. 지도 버튼에 사용자가 고른 지도앱 아이콘+이름.
  - 전기차: 「완속 AC완속」 중복 제거, 카드 맨 위 「사용 가능 N대/상태 확인 필요/지금 빈 충전기 없음」, 지도앱 버튼에 앱 이름.
  - 지역뉴스: 기사 사진(Core image_url, https만) 썸네일, 없거나 실패하면 같은 기본 그림+분야 이름. 기간·분야 칩은 한 줄 가로 스크롤.
  - 지하철: 방면 = 다음 역(「역삼 방면」, 내선/외선 표시 없음), 「약 1분 후 도착」+「3정거장 전 · 방배역」, 원시 시각(정보 생성 HH:MM:SS·수신 시각) 표시 삭제, 화면이 보이는 동안 30초마다 조용히 다시 확인, 이 역을 이미 떠난 열차(arvlCd 2 + 이 역) 숨김.
  - 축제: 끝난 행사는 진행·예정 행사 아래로(각 묶음 안 Core 순서 유지), 사진 없는 카드 기본 그림 통일.
  - 상품권: 지역화폐 안내도 한 줄 + 「안내 자세히」(온누리 「자세히」 → 「안내 자세히」).
  - 학교·유치원: 삭제·모두 삭제가 두 번 누르기 대신 확인창([취소]에 초점, [삭제]).

USER_SCENARIOS=
  1) 응급실 찾기 — 지역정보 → 병원·응급실·약국 → [응급실] = 탭 2번. 맨 위 119 전화, 각 카드에 「응급실 가용 병상」 칸과 보고 시각. 막힌 곳 없음.
     스크린샷: D:\LOTBI-WORK\evidence\regional-info-unify-01\after\medical\desktop-1280x900-emergency-light.png, iphone-390x844-emergency-light.png
  2) 지하철 도착 — 지역정보 → 지하철 정보 → 역 검색(강남) → 역 = 탭 3번+입력. 방면 「역삼 방면/교대 방면」, 첫 줄 「약 1분 후 도착 · 교대역 출발」, 내선/외선·원시 시각 없음, 30초 자동 확인.
     스크린샷: ...\after\subway\desktop-1280x900-station.png, iphone-390x844-station.png
  3) 내 아이 학교 삭제 — 학교 → [삭제] → 확인창 [삭제] = 탭 3번. [취소]를 누르면 아무것도 지워지지 않고 버튼으로 돌아옴(검사로 확인).
     스크린샷: ...\after\school\(검사기 화면), 확인창은 검사 단언으로 확인(modal·문구·버튼·초점)
  추가: 메인 ...\after\news\mobile-360x780-01-region-info-home.png, 전기차 ...\after\ev\desktop-1280x900-light.png, 뉴스 ...\after\news\desktop-1280x900-03-news-list.png

SITE_TEST_RESULTS=Windows 로컬, CHROME_BIN: 지역정보 관련 검사기 51개 PASS(마지막 CSS 수정 뒤 상품권 3종·auth_continuity_02·consumer_documents_01 재실행 PASS). asset check PASS.
  참고: validate_real_estate_region_favorites_p0는 Windows CRLF 때문에 site-route.js 정규식이 실패하는 기존 문제(main도 같음) — 그 파일을 LF로 둔 작업본에서 PASS. Linux Gate에는 해당 없음.

NOT_DONE(다음 차례, Core 또는 추가 작업 필요)=
  - 축제 카드 → LOTBI 상세 화면 연결(지금은 공식 홈페이지 새 창 그대로). 검사기 6개가 카드=홈페이지 링크를 고정.
  - 메인 「바로 찾기」 5개, 지하철 혼잡도 7칸 막대, 뉴스 필터 하단 선택창, 지역 미설정 때 「현재 위치로」 버튼.
  - Core: 지하철 정거장 수 숫자 필드(지금은 공식 문구 「[n]번째 전역」·arvlCd로 Site가 계산), 축제 정렬, 온누리 id.
