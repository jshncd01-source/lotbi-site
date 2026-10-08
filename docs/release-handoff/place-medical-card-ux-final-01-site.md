READY_FOR_DEPLOY=YES

# place-medical-card-ux-final-01-site — release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/place-medical-card-ux-final-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote origin refs/heads/feature/place-medical-card-ux-final-01-site`)
REMOTE_FEATURE_SHA=same as FEATURE_SHA after push (checked with git ls-remote at push time)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=82a8874ee1515c71caf2674ab02d9360484dbc4a (SITE-T27). 시작 c9c19e4c → f59c8ef3(SITE-T24, refresh-route-04) merge e582e91e → 22631a25(SITE-T25 학교 급식·SITE-T26 Life Wallet) merge ab5336d1 → 82a8874e(SITE-T27 공과금·롯비함 정리) merge 68a88dbc, 모두 정상 merge
CODE_SHA=68a88dbc (merge of main 82a8874e; product commit 44a693bfb6be6745f81ece20da1e015092022bd3)
ASSET_VERSION=aset-3213074a0ee2
SCOPE=site only. site-conversation.js 는 createPlaceCardRail 구역(장소카드 렌더러)만 수정 — route·popstate·backRoute 구역 무변경(사용자 승인 범위). site-conversation.css 장소카드 블록 추가.
REFRESH_ROUTE_OVERLAP=refresh-route-04(b3dfcc65)가 작업 중 main f59c8ef3 에 들어가 그 main 을 정상 merge. 세 번의 main merge 충돌은 매번 asset 토큰 줄뿐(실제 코드 충돌 0, 자동 판정 스크립트로 hunk마다 토큰 정규화 비교). merge 전 시험 3-way merge(site-conversation.js)도 충돌 9곳 전부 토큰 줄. main 대비 site-conversation.js 차이 = 토큰 줄 + createPlaceCardRail 구역뿐(route·popstate·backRoute 무변경).
CORE_CHANGE=NO (CORE-PLACE-RESULT-01 계약 그대로). Core 선정 기준 보완은 별도 Core 작업으로 분리(CMD_CORE_MEDICAL_RANKING_SUMMARY_01).
TEST_STATUS=Windows 로컬(다른 방 Chrome 70~110개·CPU 100% 부하). [1차, main f59c8ef3 merge e582e91e] scripts/validate_* 213개 — 205 PASS + 부하성 실패 2개(conversation_calendar_card_02 result missing, message_calendar_footer_editor_01 고정포트 모듈 로드) 단독 재실행 PASS + validate_place_card_compact_01: 고정 포트 4213 Python http.server 모듈 로드 실패/Chrome 시간초과 반복 → 포트·서버 줄만 바꾼 임시 사본(검사 동일)으로 28/28 PASS + 기존 Windows RED 5(auth_unknown_recovery_browser_01 EPERM, calendar_system_dark_01, image_attachment_thumbnail_01, mobile_footer_legal_sheet_01, site_avatar_fallback_runtime — main f59c8ef3에서도 같은 오류로 FAIL 확인). [2차, main 22631a25 merge ab5336d1] 비브라우저 146/146 PASS + 브라우저 7개(place_medical_card_ux_final_01, place_card_carousel_no_drift_01, place_card_naver_search_click_01, neis_school_official_links_01, site_refresh_route_restore_01, life_medical_category_entry_01 PASS, school_meal_neis_admin_fallback_01 고정포트 4293 모듈 로드 실패 → 포트·서버 사본 PASS). [3차, main 82a8874e merge 68a88dbc] 비브라우저 146/146 PASS + 브라우저 10개(place_medical_card_ux_final_01, place_card_carousel_no_drift_01, life_info_cleanup_final_01, life_medical_category_entry_01, site_refresh_route_restore_01, lotbi_box_nav_01, rich_product_cards_01, consumer_detail_system_01, uiux_phase1_01 PASS, place_card_naver_search_click_01 1회 '새 탭 감지 []' 흔들림(main에서도 같은 증상 2/2 확인) → 단독 재실행 PASS). 나머지 브라우저 validator는 1차 트리에서만 실행(2·3차 main 차이 = 학교 급식·Life Wallet·공과금/롯비함 코드, 장소카드 구역 밖).
NEW_FAILURES=0 (단, compact_01·school_meal 원본은 이 PC의 고정 포트 Python 서버 문제로 로컬 원본 실행 NOT VERIFIED — Linux gate 판정 필요, 같은 검사의 포트·서버 사본은 PASS)
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
DEPLOY_SCOPE=lotbi-site only (Core / Account Web / App / Admin 무변경, 배포 순서 제약 없음)
USER_DECISION_NEEDED=NONE (Site). Core 분리 작업에 ANY 모드 정렬 순서 결정 1건(그 명령문에 기록)

## 수정 내용 (사용자 화면)

1. 모바일(≤760px) 슬라이드
   - 좌우 ‹ › 화살표 없음. 손가락 스와이프·마우스 드래그로 카드가 돈다(마지막 → 처음, 처음 → 마지막).
   - 기존 TRUE CAROUSEL(회전 슬롯·드래그·키·탭 로직) 그대로 재사용. 가운데 카드 한 장만 보이고 옆 카드는 카드 밖에서 투명·탭 불가로 대기 → 화면 끝에서 잘리거나 가운데 카드와 겹쳐 보이는 카드 없음.
   - 카드들이 grid 한 칸에 겹쳐 레일 높이 = 가장 큰 카드(+아래 줄). 진료시간 줄이 위아래로 잘리던 문제 없음.
   - 2장일 때 다음 카드는 넘기는 방향 쪽에서 들어온다.
   - 데스크톱(>760px): 회전형 배치·화살표·←/→/Home/End·드래그·옆 카드 탭 그대로.
2. 카드 압축
   - 사진이 없으면 사진 칸 자체가 없다(이전: 빈 16:8 칸). 사진 로드 실패도 칸 제거.
   - 카드 내용: 분류 · 기관명 · 주소 · 거리 · 진료시간(“등록 시간상 진료 중 · 오늘 09:00~18:30”) · 전화 · 길찾기(설정한 지도앱).
3. 노출 개수
   - 기본 3장, 아래에 위치 “1/3”. 1~2곳이면 실제 개수만(“1/2”, 1곳이면 위치 표시 없음).
   - Core가 3곳보다 많이 보내면 “다른 병원 보기”(약국/동물병원/장소는 그 이름) → 나머지 카드가 더해지고 4번째 카드로 이동(“4/5”), 버튼 사라짐, 포커스는 새 가운데 카드로.
   - 같은 기관 중복 제거(표시 단계): 이름+주소(공백·괄호·구두점 무시) 또는 이름+확인된 전화번호가 같으면 첫 항목 한 장. Core 순서 유지.
4. 함께 고친 것
   - 카드 본문 탭 보정: Chrome은 링크 근처 ~10px 안의 탭을 그 링크로 옮긴다. main에서는 뒤에 겹친 옆 카드가 우연히 이를 막고 있었고, 옆 카드를 카드 밖으로 빼자 주소·진료시간 줄 탭이 전화(tel:)로 넘어갔다 → 카드 본문 :active 스타일(눌림 표시)로 본문이 직접 탭을 받게 함. 새 validator가 이 수정 없이는 FAIL(“text tap … opened tel:…”), 수정 후 PASS.
   - 카드가 1장일 때 데스크톱 마우스 드래그가 네이버 검색을 여는 문제 → 드래그 뒤 클릭 억제.
5. 유지
   - 지도 버튼 = 설정 지도앱(`lotbi_default_map_provider_v1`) + 기존 딥링크/handoff. 카드 본문 = 네이버 검색. 전화 = 확인된 번호만.
   - 확정 표현 없음: 진료시간은 “등록 시간상 …”(Core medical_status 그대로).

## 의료기관 선정 기준 (Core main 6d959b9b 읽기 확인, Site는 Core 순서 유지)

- 데이터: 국립중앙의료원(NMC) 공공 API. 진료과목 = 필터(QD + `_department_confirmed`), 지금/밤/특정 시각 = 등록 시간상 OPEN만, 그날/공휴일 = 등록된 곳만.
- 정렬: (거리, 등록 시간상 영업 여부, 이름) → 최대 5곳. 거리는 정밀 위치일 때만. 동점은 이름 → 이름까지 같으면 API 순서(hpid 미사용).
- 중복: 병·의원·약국 hpid만. 응급실·NAVER 없음 → Site 표시 단계에서 보완.
- 문구: 템플릿 “등록된 시간상” + 전화 확인 안내(단정 없음). 답변은 2~5문장.
- 별도 Core 작업(명령문 CMD_CORE_MEDICAL_RANKING_SUMMARY_01): hpid 동점 정렬, 응급실·NAVER 중복 제거, 거리 없을 때 “가까운” 문구, 의료 요약 1~2문장, NAVER narration 단정 문장 거부, ANY 모드 거리우선 vs 영업우선(사용자 결정).

## Validators

- 신규 `scripts/validate_place_medical_card_ux_final_01.mjs` (+site-review.yml 단계): CDP 실제 터치/마우스, 360·375·390·412·1280, 의료 5행(중복 1)·사진 2곳·약국 1곳 시나리오. 화살표 없음·스와이프 순환·한 장 온전·옆 카드 겹침 0·사진 칸·1/3·다른 병원 보기·중복·지도앱(KAKAO_NAVI/TMAP/기본)·네이버 검색·버튼 바로 위 본문 탭·전화/지도 버튼.
- 사용자 요구로 바뀐 동작만 갱신(검사 의미 유지·강화):
  - `validate_place_card_carousel_no_drift_01`: 휴대폰은 화살표 대신 스와이프, 3장 → 다른 장소 보기 → 5장, RIGHT_BACK scrollIntoView는 5장 상태에서.
  - `validate_place_card_compact_01`: 사진 없는 카드에 사진 칸 없음, 휴대폰 카드 폭은 레일 안(≤ rail−16, ≤400), 옆 카드 동작 버튼은 보이지 않음(투명 카드 포함).
  - `validate_place_card_naver_search_click_01`(보존 대상 5개 중 하나): 휴대폰 화살표 탭 4곳 → 스와이프, 사진 없는 3번째 카드는 제목 탭. 나머지 단정 그대로.
- 보존 대상 5개 중 나머지 4개 무수정 PASS: cross_platform_01, naver_maps_navigation_01, life_night_medical_01, life_animal_hospital_01.

## 실화면

- CDP 스크린샷(360/375/390/412/1280) + 앱 내 브라우저 375×812에서 드래그 → 2/3, 다른 병원 보기 → 4/4 확인. 실기기(iPhone Safari·Android Chrome·Samsung Internet·카카오 인앱) NOT TESTED.

## 통합 시 배포총괄 확인 요청

- asset 토큰은 통합 시 최신 내용 기준으로 재생성(사용자 지시).
- refresh-route(main 포함)와의 통합 테스트: 이 branch는 main f59c8ef3(refresh-route-04 포함)을 merge한 상태에서 전체 validator를, 이어서 main 22631a25·82a8874e를 merge한 상태에서 비브라우저 전체와 관련 브라우저 validator를 돌렸다(TEST_STATUS).
- 로컬에서 원본 실행이 안 된 두 검사(validate_place_card_compact_01, validate_school_meal_neis_admin_fallback_01)는 Linux gate 결과로 판정 필요.
