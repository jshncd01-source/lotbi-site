READY_FOR_DEPLOY=YES
SUPERSEDES=a421b5cd (그 전 e2757290)
MIGRATION=NO
DEPLOY_ORDER=SITE 단독 (Core fd6a0b54는 이미 운영)
ACTIVATION=NAVER_NEWS_SEARCH_ENABLED=true — 소유자 승인 뒤 배포총괄방이 켠다. 꺼져 있으면 지역뉴스 질문은 일반 답변.
USER_DECISION_NEEDED=NONE (카드 배치는 2026-10-09 소유자 승인: (가) 8개 카드 2열, 응급실+지역뉴스 합집합)

# regional-news-p0-site — release handoff (재병합 03, 2026-10-09)

TASK=LOTBI REGIONAL INFO + REGIONAL NEWS P0 (Site) — "생활정보"→"지역정보" 화면 문구, 지역뉴스 카테고리·진입, 뉴스 답변 카드
REPO=lotbi-site
FEATURE_BRANCH=feature/regional-news-p0-site
SITE_BASE_MAIN_SHA=819ead3af6b6b74185519fc74b09b733e7305447 (SITE-T41: 의료 자동검색 c8457c1e · 구독 a72aad99 · 온누리 e94b58c1)
CODE_SHA=89eb54961b35f3a9d67837b962f8223374ada681
FEATURE_SHA=이 문서 커밋 (branch HEAD — `git ls-remote origin refs/heads/feature/regional-news-p0-site`로 확인)
ASSET_VERSION=aset-1bb3339af2e8
CORE_DEPENDENCY=lotbi-core feature/regional-news-p0-core fd6a0b54 (news_result 계약 CORE-REGIONAL-NEWS-01) — core main 포함·운영 배포됨, NAVER_NEWS_SEARCH_ENABLED=false
CORE_CHANGED=NO
ENV_CHANGE_REQUIRED=NO (Site)
SECRET_CHANGE_REQUIRED=NO
NEW_SECRET_CREATED=NO
PRODUCTION_DEPLOYED=NO

## 왜 다시 READY인가

a421b5cd(main 06270582 기준)를 낸 뒤 SITE-T41이 site main 819ead3a로 들어갔다(의료 자동검색 포함, 20:49 gate PASS). a421b5cd와 819ead3a는 토큰을 빼고도 5개 파일이 실제로 충돌했다(카테고리 목록·클릭 처리·위치 규칙·검사기 3개). 그래서 이 branch에 main 819ead3a를 정상 merge했다. rebase·force push는 하지 않았다.

## 이번 재병합에서 한 일 (main 쪽 기능 전부 유지)

1. `site-consumer-sections.js`
   - `LIFE_SHORTCUTS` 8개 = 병원·의원, 약국, 응급실, 축제·행사, **지역뉴스**, 온누리상품권, 지역생활정보, 유치원·학교. 지역뉴스는 축제·행사 바로 다음, 유치원·학교는 마지막.
   - 8개(짝수)라 2열 4줄이 꽉 찬다. 홀수 마지막 카드가 한 줄 전체를 쓰는 main CSS 규칙은 그대로이고, 이번에는 적용되지 않는다. 그래서 유치원·학교도 다른 카드와 같은 폭이다(소유자 승인 (가)).
   - 병원·약국·응급실은 main 방식 그대로다(입력 양식 없이 `item.ask` 질문을 바로 보냄). main이 지운 의료 입력 양식 코드와 `createEmergencyCallNotice` import는 지운 상태로 둔다.
   - `buildRegionalNewsPrompt`는 남긴다. 이 함수가 쓰던 `medicalText`는 의료 양식과 함께 지워졌으므로, 같은 정리(공백 정리·100자)를 함수 안에 직접 넣었다.
   - 아이콘: 응급실 + 지역뉴스 둘 다. 클릭: main의 블록(`disposed` 확인 → `item.ask` → 축제) 다음에 `news → openNewsEntry`, 온누리, 유치원·학교, 상세.
   - **지역뉴스도 바로 전송(onAsk)으로 바꿨다.** main 규칙: 지역정보 카드는 한 번 누르면 바로 롯비에게 묻고, 입력창 초안(onDraft)은 유치원·학교만 쓴다(검사기 2개가 이를 소스로 확인). 저장 지역 1탭·양식 "뉴스 찾기"·"내 주변 뉴스"가 모두 바로 전송된다. Core에 가는 문장은 그대로다("전주시 뉴스 알려 줘" 등).
2. `site-life-location.js` — main의 "권한 요청은 페이지당 한 번"(`allowPrompt`)을 이 branch의 조건(`lifeLookup || LIFE_NEARBY_RE`, 뉴스는 '내 주변'일 때만 현재 위치) 안에 넣었다.
3. 검사기(main 판정 기준 유지, 목록·개수만 8개로):
   - `validate_consumer_sections_02` — 라벨 8개, id 8개, `item.ask` = 병원·약국·응급실, prompt 검사 제외에 'news'.
   - `validate_life_info_cleanup_final_01` — 기대 id 목록에 'news'.
   - `validate_life_medical_category_entry_01` — 라벨 8개, 제목 '지역정보', 카드 수 8(대기 조건 포함), 주석·결과 문구 eight.
   - `validate_life_medical_auto_search_card_01` — 라벨 목록에 지역뉴스, 카드 수 대기 8(두 곳). 의료 검사 내용은 그대로.
   - `validate_regional_news_p0_01` 6단계 — "홀수 마지막 카드 한 줄 전체" 대신 "카드 8개, 마지막=유치원·학교, 마지막 카드도 같은 폭, 마지막 줄에 카드 2개(빈 칸 없음)".
4. asset 토큰: `node scripts/asset_cache_version.mjs --write` → `--check` PASS.

바꾸지 않은 것: 내부 id `life`, route `#life`, section id, localStorage/cookie key, Core API path, "생활에 필요한 정보" 소제목, "지역생활정보" 카테고리명, 개발용 주석.

## TEST_STATUS

TESTS=PASS (Windows 로컬, Chrome headless CDP 실제 터치/마우스, viewport emulation — 실기기 아님). 최종 코드 89eb54961b35f3a9d67837b962f8223374ada681 기준. 검사기는 한 번에 하나씩 순서대로 실행(병렬 0, 다른 방 검사 실행 0 확인).
- asset 토큰: `asset_cache_version.mjs --write` → `--check` PASS (aset-1bb3339af2e8, targets 135), `sync_theme_bootstrap.mjs --check` PASS.
- 핵심 4개 PASS: validate_consumer_sections_02 · validate_regional_news_p0_01(360x780 · 375x812 · 390x844 · 412x915 · 1280x900 · 390x844 dark, 6개 화면 모두 entry=DIRECT, 뉴스 카드 5개, 스위치 꺼짐 3b 단계 포함, 데스크톱 8개 꽉 찬 2열·마지막 카드 같은 폭) · validate_life_medical_category_entry_01 · validate_life_medical_auto_search_card_01.
- 관련 28개 중 27개 PASS: life_info_cleanup_final_01, life_location_context_01, kindergarten_official_info_01, onnuri_merchant_search_01, site_refresh_route_restore_01, consumer_design_shell_01, consumer_detail_system_01, life_detail_design_01, festival_nav_wiring_01, lotbi_box_nav_01, uiux_phase1_01, consumer_documents_01, brand_logo_theme_aware_01, brand_official_logo_01, life_wallet_entry_lock_01, pet_family_web_01, safecare_people_01, safecare_web_ui_redesign_01, static_pages_theme_01, subscribe_account_checkout_handoff_01, accessibility.py, site.py, plan_usage_matrix_v1.py, refund_subscription_policy_alignment_01.py, subscription_plan_banner_v1.py, subscription_price_proration_01.py, trusted_device_plan_limits_01.py.
- 기존 실패 1: validate_mobile_footer_legal_sheet_01("761px: mobile disclosure leaked into desktop") — main 819ead3a 원본(git archive)에서도 같은 실패. **NEW_FAILURES=0.**
- 대상 선정: 바뀐 파일(site-consumer-sections.js · site-life-location.js · subscribe.html · LIFE_SHORTCUTS · data-life-shortcut)을 참조하는 scripts/validate_* 전부(32개). 전체 248개 회귀는 다시 돌리지 않음(a421b5cd 때 전체 NEW_FAILURES=0, 이번 변경은 위 파일 범위).
- 검사 중 고친 것(판정 기준 완화 없음): ① 지역뉴스 onDraft→onAsk(위 1번, main 검사기 2개가 요구). ② validate_regional_news_p0_01 5단계 '위치 사용 끔' 회차 앞 2.6초 대기 — main의 askWithoutKeyboard가 2.5초 안 같은 질문을 두 번 누름으로 보고 한 번만 보내기 때문. 확인 항목은 그대로.
- Linux CI(site-review.yml)·실기기(iPhone Safari·카카오톡 내장 브라우저·Android) NOT TESTED.

## 겹치는 작업 (나중에 main에 들어가는 쪽이 다시 merge)

- my-child-school-01-site @ 271cb2dc: 아직 main에 없다. main 819ead3a와도 4개 파일이 충돌하고, 이 branch와도 4개 파일이 충돌한다(site-consumer-sections.js·카테고리 목록 검사기 3개). 해소 기준은 카드 목록 합집합(이 branch의 8개를 기준으로 그쪽 변경 추가)이다. main의 "빈 칸 없음" 검사는 홀수·짝수 모두 그대로 쓴다.
- life-info-direct-chat-card-compaction-01-site @ 5ef7769a(main 819ead3a 포함): 토큰을 빼면 이 branch(89eb5496)와 실질 충돌은 1곳뿐이다. `scripts/validate_life_medical_category_entry_01.mjs` 머리 주석(카드 수 문장 + 유치원·학교 onDraft 문장)이다. 해소는 두 문장을 합치면 된다: "has eight cards (응급실, 지역뉴스, 온누리상품권, 유치원·학교 included); an odd last card would take its whole row …" + 그쪽의 "LIFE-DIRECT-CHAT-CARD-COMPACTION-01: 유치원·학교 asks through onAsk too, so any draft handoff (onDraft) in the life cards fails." 지역뉴스는 이미 onAsk만 쓰므로 그쪽의 "onDraft 0개" 검사와도 맞는다. 그쪽 검사기의 카드 7개 기대값은 이 branch의 8개 줄과 같은 줄이라 자동 병합에서 8개가 남는다.
- jeonbuk-real-world-pilot-01-site @ 8cb40b01: 같은 site-consumer-sections.js를 바꾸므로 나중에 들어가는 쪽이 재병합한다.

## DEPLOY_ORDER

1. 이 Site branch merge·배포(Core fd6a0b54는 이미 운영, 스위치 꺼짐 → 지역뉴스 질문은 일반 답변, 화면 이름은 "지역정보"). site main 819ead3a(SITE-T41)가 아직 운영에 없으면 이 branch에 이미 들어 있다.
2. (별도, 소유자 승인 뒤) 배포총괄방이 Core env `NAVER_NEWS_SEARCH_ENABLED=true` → Production "오늘 전주 뉴스" smoke로 카드 확인.
