READY_FOR_DEPLOY=YES
SUPERSEDES=aa88b8a0 (Core) / 8cb40b01 (Site)
MIGRATION=NO
DEPLOY_ORDER=INDEPENDENT (Site 단독 배포 가능. Core 전북 READY 45fcb549과 순서 무관 — 아래 "Core 없이도 안전")
ACTIVATION=Site env 없음. 켜는 것은 Core env이며 소유자 결정 뒤 배포총괄방(Core 문서 ACTIVATION).
USER_DECISION_NEEDED=NONE (배포 차단 아님)

# JEONBUK REAL-WORLD PILOT P0 — 전북 맛집·음식 (Site) — Core 기능 꺼진 채 main 반영

소유자 방침(2026-10-09): 코드는 기능이 꺼진 채 먼저 main에 넣는다. 데이터 연결과 켜는 시점은 나중에 소유자가 정한다. Site 자체 env는 없다.

REPO=lotbi-site
FEATURE_BRANCH=feature/jeonbuk-real-world-pilot-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD). 문서에는 자기 SHA를 넣을 수 없으므로 `git ls-remote`로 확인한다.
CODE_SHA=36afc86b2d4b3bb5762b3909c44e334fe0d3846d
AUTHORITATIVE_MAIN=da86112052b090186ceb35f5c7a53be0e63431ec (SITE-T42, merge 커밋 36afc86b. 그 전 819ead3a merge 0d2bdd6a, 06270582 merge dee054a7, 2f1212ea merge 03fdc1fb)
LATEST_MAIN_RECHECK=2026-10-10 00:1x `git ls-remote` main=da861120 (HEAD에 포함)
ASSET_TOKEN=aset-fde894948e9b (scripts/asset_cache_version.mjs --write → --check PASS)
TEST_STATUS=전체 validate_* 등 257개 중 254 PASS / 3 FAIL (36afc86b, 2병렬). 핵심·영향 검사 9/9 PASS (36afc86b, 단독 순차)
NEW_FAILURES=0
EXISTING_MAIN_FAILURES=validate_mobile_footer_legal_sheet_01("761px: mobile disclosure leaked into desktop"), validate_site_avatar_fallback_runtime(undici assert(!this.paused)) — 둘 다 기준선 main da861120에서 같은 메시지로 단독 재현
LOAD_ONLY_FAILURE=validate_place_card_carousel_no_drift_01 — 2병렬 중 Chrome 프로필 파일 EBUSY. 단독 실행 시 이 branch·main 모두 PASS
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
NEW_SECRET_CREATED=NO
EXISTING_SECRET_CHANGED=NO
DEPENDENCIES=없음

## 생활정보 바로가기 배치 (9개)

- main(SITE-T42)의 8개는 병원·의원, 약국, 응급실, 축제·행사, 지역뉴스, 온누리상품권, 지역생활정보, 유치원·학교다. 여기에 "전북 맛집·음식"을 더해 9개다.
- 새 카드는 지역생활정보 다음, 유치원·학교 앞이다. 유치원·학교는 마지막 그대로다.
- 생활정보 홈은 2열이다. 9개는 홀수라서 main 규칙(`site-life-education.css`, 홀수 마지막 카드는 한 줄 전체)에 따라 유치원·학교가 마지막 줄 전체를 쓴다. 빈칸이 없다.
- 이 branch에는 바로가기 전용 grid CSS가 없다. main 규칙만 쓴다.
- 확인한 검사(360/375/390/412/1280):
  - `validate_life_medical_category_entry_01`: 행마다 꽉 참, 카드 너비·높이 같음, 첫 화면 안, 한 줄 라벨, 44px 이상
  - `validate_jeonbuk_real_world_pilot_01`: 9개, 그리고 전북 카드를 뺀 main 8개 둘 다 빈칸 없음
  - `validate_regional_news_p0_01`: 데스크톱에서 마지막 카드가 줄 전체를 채움

## 전북 맛집·음식 카드 동작

- 카드를 누르면 지역·음식·테마 칩 폼이 열린다. "롯비에게 물어보기"를 누르면 "전북 전주 비빔밥 맛집 알려줘" 같은 문장을 만든다. 기본 문장은 "전북 맛집 알려줘"다.
- main 규칙(LIFE-DIRECT-CHAT-CARD-COMPACTION-01, LIFE-MEDICAL-AUTO-SEARCH-01)대로 `onAsk`로 **바로 전송**한다. 입력창에는 아무것도 남지 않는다.
  - 생활정보 카드에서는 `onDraft`를 쓰지 않는다. main 검사기가 이것을 막는다.
  - `validate_jeonbuk_real_world_pilot_01`이 "바로 전송 + 입력창 비어 있음"을 확인한다(이번에 더 엄격하게 바꿈).

## Core 없이도 안전 (Site 단독 배포 가능)

- Core 전북 source가 꺼져 있거나 Core에 전북 코드가 아직 없으면, 카드 문장은 기존 NAVER 장소 검색 답변으로 간다. 장소 검색이 안 되면 일반 답변으로 간다.
  - Core 테스트 `test_guest_http_with_no_jeonbuk_env_keeps_the_existing_routes`가 카드 문장 두 개로 이것을 확인한다.
- 전북 음식·연락처 카드와 의료 등록정보 줄은 Core가 해당 결과(`regional_food_result`, `regional_contact_result`, `medical_registry`)를 줄 때만 그려진다. 꺼져 있으면 오지 않으므로 화면 변화가 없다.
- 카드 숨김은 하지 않는다. Site가 읽을 수 있는 Core 신호 중 전북 음식 source의 켜짐/꺼짐을 알려 주는 것이 없고, 새 API는 만들지 않는다.

## main merge 충돌 해결

모든 merge는 asset 토큰만 다른 충돌을 main 쪽으로 정리한 뒤 `asset_cache_version.mjs --write`로 다시 만들었다. 아래는 토큰 외 충돌이다.

- 36afc86b (main da861120, SITE-T42: 생활정보 직전송 5ef7769a + 지역뉴스 a96e99ff)
  - `site-core.js` 2곳: `newsResult` 다음에 `regionalFoodResult`·`regionalContactResult`를 둔다.
  - `site-conversation.js` 4곳: import, 메시지 카드(뉴스 → 전북 음식 → 전북 연락처), 응답 meta 2곳. 모두 합집합이다.
  - `site-consumer-sections.js` 2곳: import(`savedLifeRegionLabel` + `createJeonbukFoodForm`), 아이콘(`news` + `food`).
  - 검사기 4개: main 검사를 그대로 두고 기대 목록에 전북 카드를 더했다(9개).
  - `validate_regional_news_p0_01` 6단계: 짝수 개수 검사(마지막 카드 한 칸 너비, 마지막 줄 2장)는 그대로 두고, 홀수 개수일 때 마지막 카드가 줄 전체를 채우는지 보는 분기를 더했다.
- 0d2bdd6a (main 819ead3a, SITE-T41: 의료 자동검색 Site c8457c1e)
  - 의료 카드는 main 그대로다(폼 없이 바로 질문). 전북 폼은 `onAsk`로 바꿨다.
  - workflow는 main 온누리 시장 위치 단계 뒤에 전북 단계를 둔다.
- dee054a7 (main 06270582), 03fdc1fb (main 2f1212ea): 이전 방이 처리했다(import·검사기 목록, 자체 grid CSS 제거).

## 다음 main 후보

- SITE-T43 Footer(`feature/site-footer-hosting-ncloud-01` b9c38de4)와 `git merge-tree` 결과 충돌이 없다.
- 규칙: 나중에 main에 들어가는 쪽이 다시 merge하고 `asset_cache_version.mjs --write`를 다시 돌린다.

## ACTIVATION (이름만, 값 금지) — Core env, 소유자 결정 뒤 배포총괄방

Ncloud 운영 core env에 넣는다(Render env는 이용자에게 반영되지 않음).

`JEONJU_FOOD_ENABLED`, `JEONJU_FOOD_API_KEY(_FILE)`, `JEONBUK_MEDICAL_REGISTRY_ENABLED`, `JEONBUK_ADMIN_CONTACTS_ENABLED`, `JEONBUK_THEME_FOOD_ENABLED`(게이트웨이 오류 12 해결 전 보류), `JEONBUK_PUBLIC_DATA_SERVICE_KEY(_FILE)`(선택), data.go.kr 활용신청 4건(15106762·15133245·15011446·15143408). Site는 바꿀 것이 없다.

## 롤백

- 이전 site 이미지로 되돌리면 된다. 데이터·저장소 변경은 없다.

상세: docs/JEONBUK-REAL-WORLD-PILOT-01.md
