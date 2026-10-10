READY_FOR_DEPLOY=YES

STATUS=축제·행사 화면 다듬기(QA 일괄보고 01 #1·#2·#3 축제 부분·#20 축제 부분·#27). 카드의 프로그램·접수는 그 축제에 실제로 있을 때만, 월 표시와 시간 칩 일치, 화면마다 뒤로 하나(subview-back 장치 사용), 44px 버튼, 설정한 지도앱 하나, 포스터 전체 보이기. 실기기 NOT TESTED(화면 크기 흉내만).

[LOTBI FESTIVAL UX POLISH 01 — RELEASE HANDOFF]

TASK=FESTIVAL-UX-POLISH-01
REPO=lotbi-site
FEATURE_BRANCH=feature/festival-ux-polish-01-site
READY_SHA=this document's commit (branch HEAD; `git ls-remote ssh://lotbi-ncloud-git/srv/git/repositories/lotbi-site.git refs/heads/feature/festival-ux-polish-01-site`)
BASE_MAIN_SHA=61d3ce37f8ab3298d65411f68b327702e4c7bf0e (Ncloud site main = SITE-T53; push 직전 ls-remote 재확인, drift 없음)
CODE_SHA=835d6ff840d75e918abeec1916810aa7828b0545
CODE_COMMITS=
  835d6ff8 fix(site): festival cards show only real actions, keep month and chips in sync (코드 + 검사기 + CI 1단계 + asset 토큰 재생성)
CHANGED_FILES(main 대비, 토큰 제외)=site-festival-ui.js, site-festival.css, scripts/validate_festival_ux_polish_01.mjs(신규), scripts/validate_festival_event_08_responsive_a11y_01.mjs, scripts/validate_festival_calendar_add_ui_01.mjs, .github/workflows/site-review.yml(축제 단계 뒤 1단계 추가), 이 문서
TOKEN_ONLY_FILES=75개(site-conversation.js 포함, `?v=aset-…` 줄만. 토큰 외 변경 0줄 확인)
ASSET_VERSION=aset-0653f62c1f1a (`node scripts/asset_cache_version.mjs --write`, check PASS targets=150 refs=180)
DEPLOY_SCOPE=lotbi-site only. Core·Web·Admin·App 무변경. Core API 변경 없음(기존 공개 GET /festivals/browse, GET /festivals/{id}만 사용).
DEPLOY_ORDER=단독(SITE).
PAIRED_BRANCH=feature/subview-back-navigation-01-site(부동산방, 이 문서 작성 시 아직 push 전). 배포 순서 상관없음:
  - 두 branch 모두 site-festival-ui.js에 같은 두 줄 `back.dataset.subviewBack = '';`(renderProgramSurface·renderDetail의 back.textContent 다음 줄)을 넣음 → 같은 내용이라 충돌 없음, 충돌 나면 그 한 줄씩만 맞추면 됨.
  - 숨김 CSS는 `html[data-subview-back-shell] .festival-back-button[data-subview-back] { display: none; }` — 부동산방 shell이 장치를 설치할 때 html에 다는 표시(그 방 READY·검사기에 고정한다고 합의)가 있을 때만 숨김. 이 branch가 먼저 나가면 지금처럼 "← 목록으로"가 보이고(뒤로 둘, 동작 정상), subview-back이 들어오면 위쪽 ←만 남고 그 ←가 이 버튼을 눌러 한 단계 뒤로 감.
  - 이 branch는 site-conversation.js 코드를 고치지 않음(토큰 줄만). 토큰 줄 충돌은 --write 재생성으로 해소.
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
USER_DECISION_NEEDED=NONE

## 원인

- #1 목록 응답(/festivals/browse)에는 프로그램 정보가 없어서, 카드가 [프로그램]·[접수]를 늘 진한 버튼으로 그리고 누른 뒤에야 상세를 읽었다. 운영 축제 13개 전부 프로그램 0개·접수 링크 0개(2026-10-10 운영 API 읽기 전용 확인)라 누구에게나 "없습니다"만 나왔다.
- #2 월 이동(〈 2026년 10월 〉)이 칩과 따로 상태를 가졌다. 다음 달로 간 뒤 칩을 눌러도 월 표시가 그대로 남았고, 월 이동 중 선택 표시(글자색 --lotbi-brand-solid-bg)가 본문 글자색과 같아 무엇이 적용 중인지 보이지 않았다.
- #3 프로그램 화면에 패널 위쪽 ←(축제 전체를 닫음)와 화면 안 "← 목록으로"가 둘 다 있었다.
- #20 카드 버튼 36px·12px(공용 CSS가 일정 등록만 44px·14px로 키워 모양도 달랐음), 월 화살표 36×36, 일정 등록 안 월 화살표 36×36.
- #27 일정 등록만 이모지(📅) + 브라우저 기본 버튼 모양, 포스터 object-fit: cover(세로 포스터 4/13장의 위아래 잘림), 지도 버튼 3개(네이버지도·카카오내비·TMAP).

## 변경 (site-festival-ui.js · site-festival.css)

- #1 카드가 화면에 들어오면(IntersectionObserver) 그 축제 상세를 한 번 읽고(동시에 2개까지, 패널 안에서 축제당 1회 저장), 프로그램이 있으면 [프로그램], 접수 링크가 있는 프로그램이 있으면 [접수]를 줄 맨 앞에 붙인다. 읽기 전·읽기 실패 시에는 둘 다 없다(실패한 읽기는 잊어서 다음에 다시 물음). 누르면 저장한 결과를 그대로 써서 다시 읽지 않는다. 운영 데이터 기준으로 배포 직후 모든 카드에서 두 버튼이 사라진다.
- #2 칩을 누르면 월 표시를 이번 달로 되돌린다. 다른 달로 가면 그 달 표시가 눌린 칩처럼 채워지고(aria-label "월별 탐색, 2026년 11월 보는 중"), 이번 달로 돌아오면 '이번 달' 칩이 켜진다(조회 THIS_MONTH).
- #3 두 뒤로 버튼에 data-subview-back. 위 PAIRED_BRANCH 참고.
- #20 카드 버튼 전부 44px·14px 같은 모양, 월 화살표·월 표시 44px, 일정 등록 월 화살표 44×44.
- #27 지도는 설정한 지도앱 링크 하나(buildDefaultMapHref·defaultMapProviderPresentation·readDefaultMapProvider, 장소 카드와 같은 /assets/place-actions/<앱>.png 아이콘과 이름). 설정 없으면 네이버지도, 데스크톱 TMAP은 "티맵 대신 네이버지도 웹". 일정 등록은 이모지 없이 같은 카드 버튼. 포스터는 contain + 같은 사진을 흐리게 깐 배경(aria-hidden).

## Core 부하

카드가 화면에 보일 때만, 축제당 1회, 동시 2개, GET /festivals/{id}(공개·DB 1회 읽기, Core에 이 경로 요청 제한 없음 — app/festival_public_api.py 확인). 한 페이지 최대 20장, 휴대폰 첫 화면은 보통 1~2장. 필터를 바꿔도 같은 축제는 다시 읽지 않는다(검사로 확인).

## 검증 (로컬 Windows, main 61d3ce37 기준)

- 새 검사 validate_festival_ux_polish_01 12/12 PASS(390 Android·1280 데스크톱, CDP 실시간: 화면 밖 카드 미조회, 버튼 유무 4종, 재조회 없음, 월·칩 8단계, 뒤로 표시·숨김·한 단계, 44px, 지도앱 4종 링크·아이콘, 포스터 contain 전체 높이, 가로 넘침 0). 수정 전 main 파일로 돌리면 FAIL 확인.
- 갱신 검사: validate_festival_event_08_responsive_a11y_01 PASS(지도 3버튼 → 설정 지도앱 1링크: 기본 네이버 주소 전체·카카오 좌표·데스크톱 TMAP 네이버 웹 문구, 프로그램 뒤로 data-subview-back 추가, 나머지 단정 그대로. --dump-dom 가상 시간에는 IntersectionObserver가 오지 않아 이 fixture만 화면 안 카드라고 알려 주는 대역 사용 — 실제 관찰은 새 검사가 실시간으로 확인), validate_festival_calendar_add_ui_01 PASS(문구 '일정 등록' + 같은 버튼 class + 이모지 없음).
- 그대로 PASS: festival nav_wiring · public_boundary · location_manual_region · region_scope · region_search_consistency · list_filters_pagination · event_08_detail · weather · calendar_link · program_context · default_ongoing, location_usage_setting, global_location_foundation, consumer_detail_system_01, consumer_sections_02, chat_photo_no_forced_actions_01, life_info_cleanup_final_01, life_medical_category_entry_01, regional_news_p0_01, my_child_school_01, asset_cache_version --check.
- validate_site_refresh_route_restore_01: iPhone-390x844 177/177 PASS, desktop-1280x900 175/175 PASS. iPhone-375x812는 축제 단계(열기·새로고침·← → /#life, G, L) 통과 후 'I 로그인' 묶음에서 FAIL(1차 /#scam, 2차 /#wallet, auth=checking) — 수정 전 main 61d3ce37 임시 작업본에서도 같은 'I 로그인하기 /#wallet' FAIL(기존, 이 변경과 무관).
- 전체 Site 검사(약 150개)는 이 PC 부하 때문에 돌리지 않음 → trusted Linux gate에 맡김.
- 변경 전·후 화면(운영 축제 13개·실제 사진, 390px): 개발방 산출물 폴더 handoff/festival-ux-polish-01/.

## 알려진 한계·후속 제안(이 branch 밖)

- 실기기(삼성 인터넷·Android Chrome·iPhone Safari) NOT TESTED.
- 관리자가 등록하는 축제 단위 공식 링크(상세 응답 program_url·participation_url)는 Site가 원래 읽지 않는다(지금 운영 13개 모두 비어 있음). 등록이 시작되면 [프로그램]/[접수]를 그 링크로 여는 별도 작업 필요.
- Core 목록 응답에 프로그램·접수 유무를 넣으면 카드별 상세 읽기가 필요 없어진다(별도 Core 작업).
- QA #11(전역 줄바꿈 word-break)은 배정 밖이라 손대지 않음.

## 금지 사항 준수

main 직접 push·force push·rebase·reset 없음. git add -A 없음(경로 지정, 커밋 전 scripts/.* 임시 폴더 0 확인). Production 배포·DNS·서버 설정 변경 없음.
