READY_FOR_DEPLOY=NO
READY_FOR_RENDER_CONNECT=YES
RENDER_CONNECTION_DEFERRED=YES
BLOCKER=RENDER_DATA_SOURCE_CONNECTION_DEFERRED_BY_USER

# JEONBUK REAL-WORLD PILOT P0 — 전북 맛집·음식 (Site)

이 branch는 자동 배포 대상이 아니다. Core의 전북 source를 Render에 연결하고 live smoke를 마친 뒤 별도 지시로 merge·배포한다. Release Control queue 등록을 요청하지 않는다.

REPO=lotbi-site
FEATURE_BRANCH=feature/jeonbuk-real-world-pilot-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD). 문서에는 자기 SHA를 넣을 수 없으므로 `git ls-remote`로 확인한다.
CODE_SHA=162f6b549b239ae846d4f764ef649662d6461b37
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=89adbb378a11fba8e42a445b62f5ffab8f358f5f
LATEST_MAIN_RECHECK=89adbb37 (2026-10-08 02:00 KST, 개발 기준 main과 같음)
ASSET_TOKEN=aset-d715f1fd4db1 (scripts/asset_cache_version.mjs --check PASS)
TEST_STATUS=site-review 전체 비교 — baseline 89ad 171개 명령 / 이 branch 173개(새 명령 2개 통과), 공통 실패 3건은 기존 RED(mobile_footer_legal_sheet_01, site_avatar_fallback_runtime, calendar_weather_region_province_01). 새 validator 11/11 PASS
NEW_FAILURES=0
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO (Site 자체 env는 없다. 데이터 연결은 Core env다)
DEPENDENCIES=Core feature/jeonbuk-real-world-pilot-01-core 먼저 배포한다. Core가 옛 버전이거나 전북 source가 OFF여도 Site는 깨지지 않는다. 바로가기 질문은 기존 답변으로 간다.
DEPLOY_ORDER=Core → Site
CONFLICT_RISK=
  - 모든 site branch와 asset token(`?v=aset-…`) 충돌이 난다(기계적). merge 뒤 `node scripts/asset_cache_version.mjs --write`로 해소한다.
  - feature/life-utility-bill-menu-remove-01-site(25dbeaa9, READY)
    - 겹치는 곳: `site-consumer-sections.js` import 줄, `validate_consumer_sections_02`, `validate_life_medical_category_entry_01`의 바로가기 목록.
    - 둘을 합치면 바로가기는 [병원·의원, 약국, 축제·행사, 지역생활정보, 전북 맛집·음식] 5개다.
    - 그 branch의 validator는 "개수 % 열 수 == 0"을 검사한다. 5개·2열에서 이 검사가 실패한다.
    - 이 branch의 CSS는 마지막 항목을 두 칸으로 늘려 빈칸을 없앤다(실제 Chrome으로 5개·6개 모두 확인). 그래서 merge할 때 그 검사를 "각 행이 꽉 찼는지"로 바꾸거나 배치를 결정해야 한다.
  - feature/life-info-direct-chat-card-compaction-01-site(cd301519): import 줄만 겹친다. 그 branch가 공용 `onDraft`를 즉시 전송으로 바꾸면, 전북 맛집·음식 CTA도 별도 수정 없이 한 번 탭 전송(키보드 미호출)이 된다.
  - feature/neis-school-official-links-01-site(99619283): import 줄만 겹친다.
USER_DECISION_NEEDED=
  - 전북 맛집·음식 CTA의 즉시 전송은 direct-chat 작업 merge에 달려 있다. 이 branch만 merge하면 다른 생활정보 폼처럼 질문이 입력창에 들어간다.
  - 생활정보 홈 정리 작업과 merge 순서·바로가기 배치(5개 홀수)를 정해야 한다.

## 검증

- scripts/validate_jeonbuk_real_world_pilot_01.mjs 11건 PASS(실제 Chrome 360/375/390/412/1280).
- 기존 validator 2개는 바로가기 6개 기준으로 맞췄다.

상세: docs/JEONBUK-REAL-WORLD-PILOT-01.md
