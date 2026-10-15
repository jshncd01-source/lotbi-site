READY_FOR_DEPLOY=YES
CODE_READY=YES
MIGRATION=NO
USER_DECISION_NEEDED=NONE (배포 차단 없음. 실기기 확인은 소유자 아침 확인 목록)

# LOTBI_VOUCHER_UNIFIED_MERCHANT_ADMIN_P0 — 온누리상품권·지역화폐 통합 화면 (Site)

TASK=LOTBI_VOUCHER_UNIFIED_MERCHANT_ADMIN_P0
REPO=lotbi-site
SITE_BRANCH=feature/voucher-unified-merchant-admin-p0-site
CODE_SHA=17330ac2
SUPERSEDES=2d56565697d00a1c8071ed374c99e4552d6ee843 (배포총괄방 요청 09:38: SITE-T47·T48 반영 main으로 재병합)
BASE_MAIN=7b555600 (SITE-T47 진위확인 + SITE-T48 Life Wallet 공유 반영 main, 정상 merge 17330ac2 — main import·스타일 유지 확인)
ASSET_VERSION=aset-cd3d42af9220
DEPLOY_ORDER=CORE → ADMIN → SITE (Site 지역화폐 탭은 Core /v2/life/vouchers/* 를 씀. Core 없이 먼저 나가면 지역화폐 탭만 "불러오지 못했어요"+다시 시도, 온누리 탭은 정상)
REQUIRED_ENV_CHANGES=NONE
NEW_SECRET_CREATED=NO
NEW_PAID_RESOURCE=NO

## 무엇이 바뀌나

- 생활정보 카드 `onnuri`의 이름: `온누리상품권` → **`온누리상품권·지역화폐`** (id·brandSlot·순서 그대로, 로고 미사용 유지). 모바일 2열에서도 칸 안 줄바꿈으로 잘리지 않음(지역정보 UX 복구의 승인 메뉴 8개 위에서 라벨만 바뀜).
- 카드를 누르면 모달 제목 **`온누리상품권·지역화폐`**, 상단 탭 **[온누리상품권] [지역화폐]**(tablist/tab/tabpanel, 방향키·Home·End).
  - 온누리상품권 탭: 기존 `site-life-onnuri.js` 그대로 mount(검색·카드·출처·지도앱 변화 없음).
  - 지역화폐 탭(새 `site-life-vouchers.js`/`.css`): 광역시·도 → 시·군·구 → 그 지역에서 쓰는 지역화폐(광역·기초 둘 다 표시, 지류/모바일/카드 표시) → 가맹점 12곳 + 더 보기, 이름 검색·업종·결제유형·읍·면·동, 위치 사용이 이미 허용된 경우만 가까운 순.
  - 가맹점 카드: 이름·주소(지역명뿐이면 "상세 위치 미확인")·사용 가능한 지역화폐·업종·결제유형·자료 출처(한국조폐공사 공식 공개자료/지자체 공개 가맹점 명단/승인된 운영기관 자료/LOTBI 관리자 등록자료)·마지막 확인일·전화(있을 때만)·고객 기본 지도앱 아이콘(4종, 좌표 없으면 주소 검색).
  - 빈 상태: "현재 LOTBI에 등록된 가맹점 정보가 없습니다." + 없다고 단정하지 않는 문장 + 공식 조회 링크.
  - '현재 결제 가능' 문구 없음, 지역화폐 카드에 '온누리' 표기 없음, LOTBI는 발행기관 공식·제휴 아님 안내.
- `site-conversation.js` `openOnnuri`: 제목·import·mount 대상만 변경, route `life`·'지역정보로 돌아가기' 그대로.
- `/v2/life/vouchers/merchants/{id}`는 호출하지 않음(CORS는 목록 3개만 열림).

## 검증 (Windows Chrome, 데스크톱 화면 흉내 — 실기기 아님)

| 검사기 | 결과 |
|---|---|
| `validate_voucher_unified_p0` (새, site-review.yml 등록) | PASS 3,363 checks (360·375다크·390·412·1280·1280다크), b6dc768d 병합 뒤 재실행 PASS |
| `validate_regional_news_p0_01` | PASS (b6dc768d 병합 뒤. 병합 중 빠졌던 site-life-news.css 링크 복원 후) |
| `validate_life_medical_category_entry_01`, `validate_life_medical_auto_search_card_01`, `validate_life_info_cleanup_final_01`, `validate_jeonbuk_real_world_pilot_01` | PASS (b6dc768d 병합 뒤, 승인 메뉴 8개 + 새 라벨) |
| `validate_consumer_sections_02` | PASS (병합 뒤 재실행) |
| `validate_onnuri_merchant_search_01` | PASS (병합 뒤 재실행) |
| `validate_life_info_cleanup_final_01` | PASS (병합 뒤 재실행) |
| `validate_onnuri_location_ux_p0`, `validate_onnuri_market_location_02`, `validate_life_medical_category_entry_01`, `validate_life_medical_auto_search_card_01`, `validate_jeonbuk_real_world_pilot_01`, `validate_default_map_preference_01` | PASS (병합 전) |
| `asset_cache_version.mjs --check` | PASS aset-cd3d42af9220 |
| Site fixture ↔ 실제 Core 응답 키 대조 | 일치(시·도 merchant_count는 Core에 추가해 맞춤) |

- 기존 검사기 수정: 카드 라벨 목록의 `'온누리상품권'` → `'온누리상품권·지역화폐'`(consumer_sections_02, jeonbuk_real_world_pilot_01, life_medical_auto_search_card_01, life_medical_category_entry_01), onnuri_merchant_search_01의 메뉴·모달 제목 기대값. 다른 판정은 약화하지 않음.
- 새 검사기: 프로필 `mkdtempSync(...'profile-')`, 작업 폴더 `scripts/.voucher-unified-*`, 포트 0, 브라우저 후보 CHROME_BIN → Windows Chrome → /opt/pw-browsers/chromium → PATH.

## 7b555600 병합 뒤 재검사

validate_voucher_unified_p0(3,363) · consumer_sections_02 · regional_news_p0_01 · life_medical_category_entry_01 · onnuri_merchant_search_01 · life_info_cleanup_final_01 · life_wallet_share_01 · life_wallet_share_transfer_01 · scam_shield_double_check_p0 모두 PASS, asset --check PASS. main 대비 실제 변경 파일은 아래 목록과 동일(토큰 제외 내용 대조).

## 확인 못 한 것

- Android 삼성 인터넷·Android Chrome·iPhone Safari 실기기: NOT VERIFIED.
- 실제 Core에 붙인 브라우저 실행: 하지 않음(fixture 기반, 응답 키는 실제 Core와 대조 일치).
- 지역정보 UX 복구(SITE-T46)는 이미 병합됨. 전기차·지하철 등 다른 방의 카드 변경과는 `LIFE_SHORTCUTS`의 onnuri 한 줄·카드 라벨 검사 기대값이 겹친다 → 나중에 main에 들어가는 쪽이 라벨 `온누리상품권·지역화폐`를 유지해 합친다.

## 되돌리기

- 이전 site 이미지로 재실행. 데이터 변경 없음.

## main 대비 실제 변경 파일(토큰 제외)

site-consumer-sections.js(onnuri 라벨 1줄), site-conversation.js(openOnnuri 제목·mount), index.html·auth/callback/index.html(vouchers CSS 1줄), site-life-vouchers.js·.css(새), scripts/validate_voucher_unified_p0.mjs·fixtures(새), 기존 검사기 5개 라벨 기대값, .github/workflows/site-review.yml(새 단계), docs/VOUCHER_UNIFIED_API_CONTRACT.md.
