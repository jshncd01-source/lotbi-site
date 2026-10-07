READY_FOR_DEPLOY=YES

# life-info-direct-chat-card-compaction-01-site — release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/life-info-direct-chat-card-compaction-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD)
REMOTE_FEATURE_SHA=FEATURE_SHA와 동일(`git ls-remote origin refs/heads/feature/life-info-direct-chat-card-compaction-01-site`로 확인)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=89adbb378a11fba8e42a445b62f5ffab8f358f5f
CODE_SHA=cf5a748f
ASSET_VERSION=aset-8970f6cb0e70

## SCOPE (LOTBI MOBILE LIFE-INFO DIRECT CHAT + NO-IMAGE CARD COMPACTION P0, 2026-10-07 + 지도앱 계약 정정)

Site만 변경했다. Core·App은 변경하지 않았다. API 계약 변경도 없다: 기존 guest·로그인 대화 API와 기존 `requestAssistant` 전송 경로를 그대로 쓴다.

1. 생활정보 → 채팅 바로 전송
   - 생활정보의 기존 버튼 하나가 질문을 바로 전송한다(새 CTA 없음).
     - 병원·의원·약국: "질문 준비하기" → "바로 찾기".
     - 지역생활정보·공과금: "롯비에게 물어보기".
     - 생활정보 검색창: 기존 문구 그대로.
   - 질문 문장과 조건 의미는 그대로다(`buildLifeMedicalPrompt`와 기존 프롬프트 무변경).
   - 실행 순서: `onDraft(text)` → `askFromLife` → 생활정보 창 닫기 → 일반 채팅 전송(`requestAssistant(question, true, '', 0, {keepKeyboardClosed: true})`).
     - 메시지 생성·대화 문맥·출처·완료·오류·재시도·긴 답변 고정 동작은 일반 전송 경로를 그대로 쓴다.
     - 답을 못 받고 돌아온 요청의 복구(pending-turn)도 그대로 적용된다.
   - 입력창에 문구를 남기지 않는다. 전송 뒤 입력창은 비어 있다.
   - 이전 답변 진행 중이거나 입력창에 첨부가 대기 중이면 보내지 않는다. 이때는 질문을 입력창에 넣고 "전송을 눌러 주세요"로 안내한다(포커스 없음).
   - 안내 문구에서 "다음 화면에서 질문을 확인한 뒤 보내세요"를 뺐다. 공과금의 "확인 없이 진행하지 않습니다"는 유지했다.
2. 키보드 자동 호출 금지
   - 바로 전송 경로는 입력창을 focus하지 않는다.
     - 생활정보 창을 닫을 때 직전 focus(입력창일 수 있음)로 되돌리지 않는다.
     - 그 턴의 답변 완료·오류·시간초과 뒤 composer focus도 하지 않는다(`refocusComposer`).
   - 답을 못 받고 돌아온 요청을 자동 복구하는 턴(recovering)도 같은 이유로 focus하지 않는다.
   - 사용자가 입력창을 직접 탭했을 때만 focus된다.
   - 일반 전송(사용자가 입력하고 전송)의 기존 focus 동작은 그대로다.
3. 중복 전송 방지
   - 생활정보 폼은 닫히는 순간 dispose되어 두 번째 submit을 무시한다.
   - `requestAssistant`는 첫 await 전에 `inFlight`를 세운다.
   - 빠른 두 번 탭은 메시지 1개만 만든다.
   - back/forward는 생활정보 메뉴를 다시 열 뿐이다. 새로고침도 다시 보내지 않는다.
   - URL·저장소에 "보낼 질문"을 남기지 않는다.
4. 사진 없는 장소 카드(병원·약국 포함)
   - 유효한 사진(image_url)이 있을 때만 media 영역을 만든다. 사진이 없으면 media 요소 자체가 없다.
   - 사진 로드 실패 시 media 영역을 제거한다.
   - 기존 빈 사진 칸 계약(`preserveEmptyMedia`, 항상 붙던 `has-place-banner`)을 없앴다.
   - rail 높이:
     - 사진 없는 목록은 기존 CSS의 사진 없는 높이(모바일 178px, 데스크톱 190px)를 쓴다. 사진이 하나라도 있으면 사진 높이를 쓴다.
     - rail은 가장 큰 카드보다 작아지지 않는다(ResizeObserver min-height).
     - 그래서 긴 이름이나 진료 상태 줄이 잘리지 않는다. 사진 카드가 rail보다 2~5px 커서 위아래가 잘리던 기존 문제도 함께 해소했다.
   - 화살표: 가운데 카드에 사진이 없을 때만 ‹ › 화살표를 전화·지도 줄 옆(아래쪽)으로 내린다. 카드 글자를 가리지 않는다. 사진 카드의 화살표 위치는 기존 그대로다.
   - 상품 검색 카드("이미지 없음" 자리표시)는 범위 밖이라 변경하지 않았다.
5. 전화·지도 계약
   - 전화 action은 변경 없음.
   - 지도 action은 기존대로 사용자가 설정에서 고른 지도앱을 쓴다. 쿠키 `lotbi_default_map_provider_v1`을 기존 helper(`readDefaultMapProvider`, `defaultMapProviderPresentation`, `buildDefaultMapHref`)로 읽는다.
     - 지원 provider: NAVER_MAP / KAKAO_NAVI / TMAP / GOOGLE_MAPS.
     - 설정이 없으면 기존 기본값 NAVER_MAP을 쓴다.
     - deeplink·웹 fallback·OS별 handoff 규칙은 변경하지 않았다. 새 provider도 없다.

## TEST_STATUS

Windows 로컬, Chrome headless, DevTools protocol 실시간 측정, 가짜 Core. 모바일은 viewport·터치 에뮬레이션이고 실기기는 NOT TESTED.

- 신규 `scripts/validate_life_direct_chat_card_compaction_01.mjs`(site-review 등록): 360 / 375 / 390 / 412 / 1280에서 다음을 확인했다.
  - A: 지역 + 지금 진료 → 한 번 탭.
    - 메시지 1개("전주 효자동에서 지금 진료하는 병원 알려줘").
    - 입력창이 비어 있다.
    - composer focus 이벤트와 focus() 호출이 모두 0회다.
    - 답변 시작.
  - D: 같은 버튼을 빠르게 두 번 누르면 1개만 생성된다.
  - E: forward(생활정보 메뉴만 다시 열림, 텍스트 입력 focus 없음) → back → 새로고침. 추가 전송 0, focus 0.
  - F·G·H:
    - 사진 카드는 정상 렌더된다.
    - image_url 없음 → media 요소 없음.
    - 로드 실패 → media 요소 제거.
    - 사진 없는 카드는 사진 카드보다 짧다(모바일 167px vs 287~295px).
    - 사진 없는 목록 rail: 모바일 178px(이전 286px), 데스크톱 190px(이전 300px).
    - 카드·글자 잘림 없음, 화면 밖 action 없음, 터치 영역 44px 이상.
    - 사진 없는 카드가 가운데일 때 화살표가 글자·아이콘을 가리지 않는다.
  - I·J:
    - 전화 href는 기존 helper 결과와 같다.
    - 지도 링크는 설정 없음(NAVER_MAP 기본값)과 NAVER_MAP·KAKAO_NAVI·TMAP·GOOGLE_MAPS 각각에서 기존 `buildDefaultMapHref` 결과와 같다.
  - B(390): 지역을 비우고 위치 허용 → client_context.location으로 현재 위치가 전송된다.
  - C(390): 약국("근처에서 지금 여는 약국 알려줘")과 지역생활정보도 한 번 탭으로 1개 전송된다.
  - K(390): 사용자가 입력창을 탭하면 그때만 focus된다.
- 계약 변경에 맞춰 단정을 같은 엄격도로 바꾼 기존 validator 5개:
  - validate_place_card_compact_01: 사진 없는 옆 카드 "빈 사진 칸 표시" → "media·placeholder 없음" + rail 사진 높이 유지.
  - validate_place_card_naver_search_click_01: 사진 없는 세 번째 카드는 사진 칸 대신 본문(주소)을 탭한다. "사진 칸 없음" 단정을 추가했다.
  - validate_life_medical_category_entry_01: 제출 뒤 "입력창에 문장" → "그 문장이 1번 전송, 입력창 비어 있음·미포커스"(병원·약국·지역생활정보·검색창).
  - validate_consumer_sections_02, validate_consumer_detail_system_01: 연결 코드와 버튼 문구를 새 계약으로 바꿨다.
- 전체 site-review validator(Windows 로컬, workflow의 단일·여러 줄 run 140개):
  - 병렬 실행에서 130 PASS.
  - 실패 10개 중 6개는 단독 재실행에서 PASS였다(병렬 부하 일시 오류): place_card_compact_01, message_calendar_footer_editor_01, profile_menu_personal_theme_01, conversation_calendar_card_02, festival_event_08_responsive_a11y_01, site_refresh_route_restore_01.
    - site_refresh_route_restore_01은 main에서도 같은 단정으로 간헐 실패했다. main과 번갈아 2회씩 돌렸을 때 양쪽 모두 PASS.
  - 남은 4개는 main 89adbb37에서도 같은 단정으로 실패하는 기존 RED다: calendar_system_dark_01, image_attachment_thumbnail_01, mobile_footer_legal_sheet_01, site_avatar_fallback_runtime.
  - Production API CORS 실측과 docker 단계는 외부 호출·도구 미설치로 실행하지 않았다.
- `node scripts/asset_cache_version.mjs --check` PASS. `node --check` site-conversation.js / site-consumer-sections.js PASS.
- 390x844 캡처(전/후, 같은 가짜 응답): 사진 없는 병원 카드 rail 286 → 178px, 카드 291 → 148px, 빈 사진 칸 제거, 바로 찾기 후 composer focus 없음.

NEW_FAILURES=0

MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
DEPENDENCIES=없음(Core·App 무변경).
POST_DEPLOY_SMOKE=실기기 iPhone Safari와 Android Chrome에서 확인:
- 생활정보 → 병원·의원 → 지역·지금 진료 → 바로 찾기: 한 번에 답변이 시작되고 키보드가 뜨지 않으며 입력창이 비어 있다.
- 사진 없는 병원 카드: 사진 칸이 없고 짧으며, 화살표가 글자를 가리지 않는다.
- 전화 버튼, 설정에서 고른 지도앱(예: 카카오내비) 버튼.
- 입력창 탭 시에만 키보드가 뜬다.
- 뒤로/앞으로·새로고침 때 재전송이 없다.
READY_FOR_DEPLOY=YES

USER_DECISION_NEEDED=NONE

## NOT_IN_SCOPE / 참고

- 사진이 있는 카드는 rail 세로 가운데의 기존 화살표 위치를 유지한다. 모바일에서 화살표가 분류 줄("병원,의원>내과")에 닿는다(main 동일).
- 사진·무사진이 섞인 목록은 rail이 사진 높이를 유지한다. 사진 없는 카드는 그 안에서 짧게 가운데 놓인다.
