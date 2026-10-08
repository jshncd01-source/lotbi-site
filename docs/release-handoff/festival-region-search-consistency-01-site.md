READY_FOR_DEPLOY=YES

# FESTIVAL REGION SEARCH CONSISTENCY 01 — 전국/지역 축제 검색 불일치 (Site)

REPO=lotbi-site
FEATURE_BRANCH=feature/festival-region-search-consistency-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD). 문서에는 자기 SHA를 넣을 수 없으므로 `git ls-remote`로 확인한다.
CODE_SHA=4acb323368588f81d34c927cb6d06907cb84b015
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=c9c19e4cef9914f0b50d4870cbcc59e58602ddc2
ASSET_VERSION=aset-0e43095bc70d
PAIRED_BRANCH=lotbi-core feature/festival-region-search-consistency-01-core (code 6b671d0eafa62e08fe8cadc5a9ab55718839e867) — 0건 원인 수정은 Core 쪽
NOT_REDEPLOYED=feature/festival-region-scope-site-01(d75675fe)은 이미 main에 포함, 다시 쓰지 않음
TEST_STATUS=scripts/validate_* 213개 전부 실행(Windows 로컬, Chrome 사용 74개 직렬): 194 PASS → 실패 19건 단독 재실행 11 PASS → 남은 8건은 main c9c19e4c 기준선에서도 실패(auth_unknown_recovery_browser_01 EPERM, calendar_system_dark_01, image_attachment_thumbnail_01, mobile_footer_legal_sheet_01, place_card_compact_01, site_avatar_fallback_runtime) 또는 단독 재실행 PASS(calendar_modal_runtime_02) 또는 기준선 단독 실행도 같은 실패(calendar_lunar_settings_ui_01). 신규 validator PASS, asset_cache_version --check PASS, 축제 validator 13개(신규 포함) 전부 PASS.
NEW_FAILURES=0
CORE_CHANGED=YES(별도 branch)
ENV_CHANGE_REQUIRED=NO
DEPLOY_ORDER=CORE → SITE
USER_DECISION_NEEDED=NONE

## ROOT_CAUSE (요약)

- 0건은 Core 원인: 운영 공개 축제 전부 `region_name` null, Core 시·도 필터가 그 칸만 봄 → 모든 시·도 0건. Core branch에서 수정.
- Site 원인(문구): "📍 현재 위치 기준 · 전북특별자치도"는 실제로는 **GPS가 속한 시·도 전체** 검색(`region=<도>` + 좌표는 카드 거리 표시용)인데, 문구만 보면 주변 검색처럼 읽힘. 0건 안내는 "현재 위치 주변에…"라고 써서 실제 동작과 다름.
- Site의 전국/지역 전환 상태·요청 취소(requestToken + AbortController)·cache:no-store는 정상. 이전 검색 상태 잔존 없음(headless Chrome에서 확인).

## 수정

- `site-festival-client.js` `festivalBrowseScopeLabel(state)` 하나로 배너와 0건 안내 문구를 만든다(같은 state → 같은 말):
  - 전국 → `전국`
  - 시·도 → `전북특별자치도 전체`
  - 시·군 → `전북특별자치도 · 임실군`
  - 현재 위치 → `현재 위치 기준 · 전북특별자치도 전체` (도 전체 검색으로 통일. 반경 검색은 없음)
- 배너 `📍 <범위>`, 0건 `현재 조건에 맞는 축제·행사가 없어요 (<범위>)`. "현재 위치 주변에" 문구 삭제.
- 보내는 query는 바꾸지 않음(시·도: region / 시·군: region+municipality / 현재 위치: region+좌표 / 전국: 없음).
- 오래된 주석 정정(resolveCurrentRegionLabel은 표시 전용이 아니라 region 값으로도 쓰임).
- asset token 재계산 — 축제 2개 파일 외에는 `?v=` 토큰만 바뀜.
- 신규 `scripts/validate_festival_region_search_consistency_01.mjs`(site-review.yml 등록): 순수 함수 검사 + headless Chrome에서 실제 site-festival-ui.js로 현재 위치(전북 GPS) → 전북 전체(진행 중/이번 주말/이번 달) → 임실군 → 전국 → 0건(제주) 전환, 각 단계의 배너·보낸 query·카드·중복 없음·거리 표시 확인. 가짜 Core 응답은 Core 수정본이 운영 데이터로 낸 결과를 그대로 재생.

## 화면 결과 (headless Chrome, 390px)

| 단계 | 배너 | 보낸 query | 카드 |
|---|---|---|---|
| 현재 위치(전주 GPS) | 📍 현재 위치 기준 · 전북특별자치도 전체 | region=전북특별자치도 + 좌표, time=ONGOING | 임실N치즈축제(거리 표시) |
| 전북 전체 · 진행 중 | 📍 전북특별자치도 전체 | region=전북특별자치도, 좌표 없음 | 임실N치즈축제 |
| 전북 전체 · 이번 주말 | 〃 | time=THIS_WEEKEND | 임실N치즈축제, 제6회 전주거리인형극제 |
| 전북 전체 · 이번 달 | 〃 | time=THIS_MONTH | 임실, 전주거리인형극제, 전주 국가유산야행 |
| 임실군 | 📍 전북특별자치도 · 임실군 | region+municipality=임실군 | 임실N치즈축제 |
| 전국 | 📍 전국 | region·municipality·좌표 없음 | 5건(임실 포함) |
| 제주 전체(0건) | 📍 제주특별자치도 전체 | region=제주특별자치도 | 0건 — "(제주특별자치도 전체)" 안내 |

NOT TESTED: 실제 iPhone 카카오톡 브라우저·iPhone Safari·Android Chrome·Samsung Internet(실기기 필요). Production Core 연결 상태의 실제 화면(Core 배포 후 배포총괄 smoke 대상).
