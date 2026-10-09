READY_FOR_DEPLOY=YES

# 생활정보 온누리상품권 가맹점 찾기 (Site) — ONNURI-MERCHANT-01

REPO=lotbi-site
FEATURE_BRANCH=feature/onnuri-merchant-search-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD). `git ls-remote`로 확인한다.
CODE_SHA=7f7a02f9 (main e13c0dfd 정상 merge 포함)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=e13c0dfd (개발 시작 c9c19e4c → 82a8874e → ee8c1b6f → c311be85 → e13c0dfd 순서로 정상 merge)
ASSET_VERSION=aset-1ad46a60d49c (asset_cache_version 정합성 PASS, 62 files / 129 targets)
TEST_STATUS=CI 명령 전체 162개를 main 82a8874e 병합 트리에서 실행(병렬 2): 144 PASS / 18 FAIL → 18개를 feature·baseline(main 82a8874e)에서 번갈아 단독 재실행: feature에서만 실패 0, 12개는 baseline도 같은 실패(mobile_footer_legal_sheet·site_avatar_fallback_runtime·calendar_system_dark 등 기존 RED와 Chrome 로딩 시간 초과·임시폴더 EPERM 같은 Windows 부하 환경), 6개는 단독 재실행 PASS. main ee8c1b6f 병합 뒤 영향 validator 14개 PASS(refresh_route_restore_01, onnuri_merchant_search_01, consumer_sections_02, life_medical_category_entry_01, life_info_cleanup_final_01, life_location_context_01, festival_region_search_consistency_01, calendar_editor_footer_contrast_01, consumer_theme_sync_01, theme_auto_schedule_02, scam_shield_photo_picker_01, scam_shield_result_banner_contrast_01, scam_shield_mvp_01, validate_hardening.py). main c311be85 병합 뒤 12개 + auth_continuity_02 PASS(place_medical_card_ux_final_01, place_card_naver_search_click_01, place_card_carousel_no_drift_01, product_photo_compare_01, life_wallet_full_frame_card_01 포함). validate_place_card_compact_01은 고정 포트 4213의 python http.server 모듈 로드 실패로 feature·baseline(main c311be85) 모두 같은 오류가 번갈아 나는 환경 흔들림(baseline 단독 1회 PASS·1회 FAIL). main e13c0dfd 병합 뒤 8개 PASS(auth_continuity_02, consumer_sections_02, life_info_cleanup_final_01, life_medical_category_entry_01, onnuri_merchant_search_01, safecare_photo_bulk_upload_01, safecare_web_ui_redesign_01, site_refresh_route_restore_01).
NEW_FAILURES=0
DEVICE_TEST=NOT TESTED — iPhone Safari·카카오톡 내장 브라우저 실기기 확인 없음. 375/390/412/1280 viewport·iPhone UA·터치 emulation만.
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
NEW_SECRET_CREATED=NO
EXISTING_SECRET_CHANGED=NO
DEPENDENCIES=Core feature/onnuri-merchant-search-01-core (GET /v2/life/onnuri/merchants|regions, 대화 온누리 답변). Core가 없으면 화면이 '불러오지 못했어요'를 보인다.
DEPLOY_ORDER=CORE → ADMIN → (Admin에서 데이터 가져오기·좌표 변환·PUBLISHED 게시) → SITE
USER_DECISION_NEEDED=1) Site 공개 시점(데이터 게시 전 배포하면 메뉴가 '온누리상품권 가맹점 정보를 준비하고 있어요'만 보인다). 2) 온누리상품권 공식 로고 사용 승인 요청 — 승인 전까지 로고 없이 글자만(메뉴 '온누리상품권', 카드 '온누리 가맹점'), 로고 자리(빈 `<i data-brand-logo-slot="onnuri">`)만 준비.

## 변경 요약

- 생활정보 카드에 '온누리상품권'(축제·행사 다음) → 별도 화면(site-life-onnuri.js/.css, 'life' 경로 유지라 새로고침 시 생활정보로 복원).
- 화면: 현재 위치로 찾기(버튼을 누를 때만, 또는 이미 허용된 권한일 때만 공용 위치 계층으로 1회 사용·저장 안 함) / 위치 사용 꺼짐·권한 없음·실패 → 시·도·시·군·구·동 선택으로 전환(거리 표시 없음). 업종(식당·카페·간식·장보기·의류·잡화·생활) · 지류형/디지털형(모바일·카드 통합 안내). Top 3 + 더 보기(중복 없음), 2건이면 2건, 0건이면 "공공데이터에 없다고 해서 가맹점이 아니라는 뜻은 아니에요", 데이터 게시 전 "준비하고 있어요". 카드: '온누리 가맹점' 글자, 지류·디지털 가맹 여부(없으면 '취급 형태 정보 없음'), 검증 좌표일 때만 거리·길찾기(사용자 기본 지도앱), 출처·기준일·LOTBI 반영 시각.
- 고지: 공공데이터 등록 정보이며 실시간 결제 가능 여부가 아님, LOTBI는 발행기관의 공식·제휴 서비스가 아님.
- 대화 위치: 온누리 질문과 온누리 답변 직후의 짧은 후속 질문("가까운 2곳", "그중 가장 가까운 곳 길찾기")에 의료 질문과 같은 대략 위치(소수 셋째 자리)를 싣는다. '온누리약국'은 해당 없음. 게스트·로그인 두 전송 경로 모두 recentConversationContext를 넘긴다.
- 장소카드 배지는 이 branch에서 그리지 않는다(장소카드 방 소유) → docs/ONNURI_MERCHANT_PLACE_CARD_HANDOFF_01.md 데이터 계약 인계.
- 검사기: 새 validate_onnuri_merchant_search_01(CI 등록), consumer_sections_02·life_medical_category_entry_01·life_info_cleanup_final_01·life_location_context_01 기대값 갱신.

## MERGE_NOTES

- 유치원 공식정보 방(feature/kindergarten-official-info-01-site)과 합의한 합친 모양: LIFE_SHORTCUTS = hospital, pharmacy, festivals, onnuri, local, education. 클릭 줄 `item.id === 'festivals' ? onFestival() : item.id === 'onnuri' ? onOnnuri?.() : item.id === 'education' ? openEducation(item) : openLifeDetail(item)`. 아이콘 줄은 이 branch의 `item.brandSlot ? brandSlot(item.brandSlot) : icon(item.icon)`. 검사기 라벨·id 목록 끝에 '유치원·학교'/'education', 개수 6. spansRow 측정은 두 구현 중 하나만 남긴다.
- 홀수 카드 규칙 `.consumer-shortcuts > .consumer-shortcut:last-child:nth-child(odd) { grid-column: 1 / -1; }`이 site-life-onnuri.css에 있다(유치원 branch의 site-life-education.css에도 같은 규칙, 중복 무해).
- 유치원 방과 합의: 두 branch 중 나중에 main에 들어가는 쪽 개발방이 새 main을 정상 merge해 카드 6개·스타일시트 두 줄(onnuri·education) 모양으로 다시 READY를 낸다(배포총괄방이 검사기를 고치지 않도록).
- 나머지 충돌은 asset 토큰(`?v=aset-`)뿐 → 한쪽을 택하고 `node scripts/asset_cache_version.mjs --write`.

## 롤백

- Site 이전 이미지로 되돌리면 메뉴가 사라진다. Core 데이터에는 영향 없음. 화면만 숨기려면 Admin '게시 중지'(메뉴는 '준비 중'으로 남음).
