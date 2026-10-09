READY_FOR_DEPLOY=NO
CODE_READY=YES
BLOCKER=PROVIDER_PERMISSION (Core 짝 feature/ev-charger-nearby-list-p0-core가 data.go.kr 활용신청·실호출 검증 전 — Site만 먼저 나가면 카드는 보이고 화면은 '준비하고 있어요'만 보임)
MIGRATION=NO
DEPLOY_ORDER=지역정보 복구 READY c16a4759(SITE-T46) → CORE(feature/ev-charger-nearby-list-p0-core) → (키 승인·EV_CHARGER_ENABLED=true·live probe PASS) → 이 SITE
ACTIVATION=Site 자체 스위치 없음 — 배포되면 지역정보에 '전기차 충전소' 카드가 바로 보인다
USER_DECISION_NEEDED=배포 차단: Core와 같음(활용신청). 배포 비차단: 카카오내비 설정 시 아이콘이 기존 승인 자산 kakao-map.png(카카오맵 모양)인 점 — 별도 카카오내비 승인 아이콘이 필요하면 소유자 제공

# ev-charger-nearby-list-p0-site — release handoff (2026-10-10)

TASK=LOTBI_EV_CHARGER_NEARBY_LIST_P0
REPO=lotbi-site
FEATURE_BRANCH=feature/ev-charger-nearby-list-p0-site
FEATURE_SHA=이 문서 커밋(branch HEAD) — `git ls-remote origin refs/heads/feature/ev-charger-nearby-list-p0-site`
CODE_SHA=eb88253b3 (site main 56c26095 merge 커밋)
BASE=site main 56c26095(SITE-T45) + 지역정보 복구 READY c16a4759(main 80da26b7 위, 아직 main 미반영 — SITE-T46 예정)
NCLOUD_REMOTE_MATCH=push 후 ls-remote로 확인(이 문서 커밋 = 원격 HEAD)
ASSET_VERSION=aset-85017949fee5
CORE_CONTRACT=CORE-EV-CHARGER-NEARBY-01 (GET /v2/life/ev-chargers/nearby, Core branch feature/ev-charger-nearby-list-p0-core)
NEW_SECRET_CREATED=NO
NEW_PAID_RESOURCE_CREATED=NO
PRODUCTION_DEPLOYED=NO

## 바뀐 동작

- 지역정보 카드: 약국 바로 다음에 '전기차 충전소'(새 선 아이콘 ev). 승인된 2열 유지, 카드 수가 짝수면 모든 줄이 꽉 차고 홀수면 마지막 카드가 한 줄 전체(기존 규칙 그대로).
- 카드를 누르면 대화가 아니라 '내 주변 전기차 충전소' 화면(#ev-chargers, site-life-ev-chargers.js). 대화 요청 0건, 입력창에 아무것도 넣지 않음, AI 호출 없음. Core GET /v2/life/ev-chargers/nearby만 부름(credentials omit, no-referrer).
- 위치: LOTBI 위치 사용 설정이 켜져 있고 허용이면 현재 위치(소수 4자리, 이번 요청에만, 저장 안 함). 카드 탭으로 열 때만 한 번 물을 수 있고, 새로고침·뒤로/앞으로로 열리면 묻지 않음. 꺼짐·거부·실패면 시·도/시·군 선택(Core /v2/life/weather/regions 목록, 저장된 캘린더 지역이 있으면 기본값) → 거리 문구 '○○ 중심에서 직선 …'.
- 목록(가까운 순, 기본 5km·10곳, 더 보기): 이름, '직선 420m', 주소, '급속 3대 중 1대 사용 가능'(확인된 충전기만 셈, 나머지는 'N대 상태 확인 필요'), 충전기 줄(속도·공식 타입·등록 kW·상태, 같은 충전기는 한 줄로 묶음), 이용 제한·이용시간·주차·층, '상태 확인 HH:MM' 또는 '현재 상태 확인 필요'.
- 필터: 전체/급속/완속(하나), 충전 가능(켜고 끄기), 반경 1/3/5/10/20km — 바뀔 때마다 Core를 다시 부름.
- 지도: 저장된 지도앱(readDefaultMapProvider)으로 링크(buildDefaultMapHref, 좌표 길안내)와 /assets/place-actions의 승인 아이콘(32px, 44px 터치). 네이버지도·카카오내비(카카오맵 아이콘 자산)·티맵·Google Maps. 데스크톱에서 티맵은 기존 정책대로 네이버지도 웹으로 열려 아이콘도 네이버지도. 이미지가 안 뜨면 앱 이름 글자. 전화 버튼 없음.
- 안내 구분: 결과 없음(반경 넓히기 버튼), 위치 오류, 지역 목록 오류, 공공데이터 장애, 조회 한도, 연결 준비 중, 기능 준비 중(DISABLED), 불러오는 중(PREPARING, 자동 재시도 최대 6회), 일부 시·도 실패(PARTIAL), 상태 갱신 실패, 네트워크 오류.
- 뒤로가기: 축제·행사와 같은 자기 라우트(backRoute life). Android 시스템 뒤로·화면 ← 모두 지역정보 → 한 번 더 뒤로 홈.
- 출처 줄: '출처: 한국환경공단 전기자동차 충전소 정보(공공데이터포털) · 충전소 정보 HH:MM 기준. 거리는 도로 거리가 아니라 직선거리예요. 충전 가능 여부는 현장 상황과 다를 수 있어요.'

## 변경 파일

- site-life-ev-chargers.js, site-life-ev-chargers.css (신규) — CSS는 index.html·auth/callback/index.html 둘 다 링크
- site-consumer-sections.js: 카드 1개·아이콘·onEvChargers 위임(이 파일은 fetch·위치 없음 규칙 유지)
- site-conversation.js: openEvChargers(라우트 ev-chargers, backRoute life), onEvChargers, siteRouteOpeners
- site-route.js: 'ev-chargers' 라우트
- scripts/validate_ev_charger_nearby_list_p0_01.mjs, scripts/fixtures/ev_charger_nearby_p0_01.json(Core가 생성한 응답) 신규, .github/workflows/site-review.yml 등록
- 카드 목록을 고정한 기존 검사기 7개(카드 7→8, 라우트 표 1개 추가): validate_consumer_sections_02, validate_life_medical_category_entry_01, validate_life_medical_auto_search_card_01, validate_life_info_cleanup_final_01, validate_my_child_school_01, validate_regional_news_p0_01(데스크톱 마지막 줄 홀짝 분기), validate_site_refresh_route_restore_01(라우트 ev-chargers)
- asset 토큰 갱신(aset-85017949fee5)

## TEST_STATUS

TESTS=PASS (NEW_FAILURES=0)
- 새 검사기 scripts/validate_ev_charger_nearby_list_p0_01.mjs: 88 checks PASS(정적 계약 + 실제 index.html 브라우저 — 360/375/390/412px·1280px, 라이트·다크, 지도앱 4종×Android/iPhone/데스크톱, 위치 허용·거부·미결정·설정 꺼짐, 필터·반경·더 보기, 오류 안내 8종 + PREPARING 자동 재시도, 시스템 뒤로·← 뒤로). 연속 2회·부하 중 1회 PASS.
- 전체 validate_* (262개, 동시 3개, 같은 PC에서 다른 방 pytest 30여 개 동시 실행 중): 실패 22 = 기준선(c16a4759)에서도 실패 11(auth_unknown_recovery·calendar_day_panel·calendar_touch_monthnav·message_calendar_footer_editor·mobile_composer_keyboard_layout·mobile_footer_legal_sheet·neis_school_official_links·place_card_carousel_no_drift·site_avatar_fallback_runtime·site_refresh_route_restore·social_signup_profile_ux) + 부하성 11(단독 순차 재실행 전부 PASS: bare_white_home·calendar 4개·chat_layout_attachment·chat_read_aloud_restore·home_small_text_contrast·jeonbuk_real_world_pilot·life_wallet_document_scan_synthetic_02·place_card_compact).
- 카드 목록 검사기(9장): consumer_sections_02, life_medical_category_entry_01(360px 라벨 한 줄·같은 높이 포함), life_medical_auto_search_card_01, life_info_cleanup_final_01, my_child_school_01, regional_news_p0_01, jeonbuk_real_world_pilot_01, kindergarten_official_info_01, life_direct_chat_card_compaction_01, auth_continuity_02 PASS.
- site main 56c26095(SITE-T45 Life Wallet 백업) merge 뒤: asset coherence, consumer_sections_02, life_wallet_server_backup_01, life_wallet_entry_lock_01, life_wallet_document_save_01, ev_charger_nearby_list_p0_01, life_medical_category_entry_01, auth_continuity_02 PASS.
- validate_site_refresh_route_restore_01: 기준선에서도 같은 단계(로그인 왕복 auth checking)로 실패. 단독(부하 적을 때) 실행에서는 branch·기준선 모두 PASS 기록 있음(04:0x).

## 미검증 (정직하게)

- 실기기 없음: 실제 Android·iPhone에서 네이버지도·카카오내비·티맵·Google Maps 앱이 열리는지 NOT VERIFIED(링크 형식만 검사). 360/375/390/412는 Chrome 뷰포트 흉내.
- 실제 공공데이터 충전소 목록: Core 실호출 전이라 NOT VERIFIED(Core 문서 참고).

## MERGE_NOTES

- 이 branch는 지역정보 복구 READY c16a4759를 포함한다 → 복구 branch(SITE-T46)가 먼저 main에 들어가야 하거나 함께 gate. 복구 없이 이 branch만 들어가면 복구 내용까지 같이 들어감(의도 아님) — 배포 순서: 복구 c16a4759 → 이 branch.
- 카드 9장: 병원·응급실, 약국, 전기차 충전소, 축제·행사, 지역뉴스, 온누리상품권, 지역생활정보, 전북 맛집·음식, 내 아이 학교·유치원(홀수 → 마지막 줄 전체, 360px 라벨 한 줄 유지).
- 지하철 정보 P0 개발방(feature/subway-life-info-p0-site, 미push)이 카드 1장을 더하면 10장(짝수)이 되어 360px에서 '내 아이 학교·유치원'이 두 줄 → 그 방이 처리하기로 합의(소유자 결정 항목으로 보고 예정).
- 토큰 충돌은 aset 토큰만 다른 hunk를 main 쪽으로 받은 뒤 asset_cache_version --write.

## 롤백

- 이전 Site 이미지로 되돌리면 카드·화면이 사라짐. Core 경로만 남아도 무해(호출하는 화면 없음).
