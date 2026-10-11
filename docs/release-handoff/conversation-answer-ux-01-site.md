READY_FOR_DEPLOY=YES
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
DEPLOY_ORDER=CORE → SITE (Core feature/conversation-answer-ux-01-core a6930a15 먼저. Site만 먼저 나가도 깨지지 않는다 — Core 신호가 없으면 위치 버튼만 안 보인다)
USER_DECISION_NEEDED=NONE (배포 차단 아님. 아래 "계약 변경 2건"은 QA·배포총괄방 요청대로 바꾼 것)

# CONVERSATION-ANSWER-UX-01 — 대화·답변 UX (Site)

TASK=CONVERSATION-ANSWER-UX-01 (QA 2026-10-10 일괄보고 01 #6~#11)
REPO=lotbi-site
FEATURE_BRANCH=feature/conversation-answer-ux-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD). `git ls-remote origin refs/heads/feature/conversation-answer-ux-01-site`로 확인한다.
CODE_SHA=3c3605a49eb9b981c78c431c1f813da84291de4b
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=afb7057d1d8c149e2b46eb1d656b1049e36b831d (SITE-T52c, 정상 merge 9644d7ff. 처음 기준 61d3ce37)
ASSET_VERSION=aset-ed0e11d2a5f0 (asset_cache_version --check PASS)
PAIRED=lotbi-core feature/conversation-answer-ux-01-core (READY a6930a15)

## 바뀐 것

### #7 위치 없이 약국·병원·응급실을 물었을 때 — 되묻는 답에 버튼 (P1)

- Core가 `follow_up.reason`(또는 `intent.clarification`) = `LOCATION_REQUIRED`로 되물으면, 답 아래에 버튼을 붙인다.
- [현재 위치 사용]
  - LOTBI 위치 사용 설정이 켜져 있을 때만 보인다(지역뉴스 화면과 같은 규칙).
  - 누르는 것 자체가 명시적 요청이다. 같은 페이지에서 앞서 위치를 못 받았어도 브라우저가 한 번 더 물을 수 있게 한다.
  - 원래 질문을 다시 보낸다. 질문에 "근처" 같은 말이 없으면 앞에 붙인다.
  - 같은 질문을 2.5초 안에 다시 보내면 무시하는 장치(두 번 탭 방지)는 이 버튼에서는 비운다. 일부러 다시 묻는 것이기 때문이다.
  - 브라우저가 위치를 막아 두었으면 다시 묻지 않고 "이 브라우저에서 위치를 쓸 수 없어요. 지역 선택을 눌러 주세요."를 보여 준다.
- [지역 선택]
  - 아래에서 올라오는 창(대화 상자)으로 시·도 → 시·군을 고른다.
  - 목록은 Core 공개 날씨 지역 목록(`GET /v2/life/weather/regions`, 캘린더와 같은 목록, 로그인 불필요)이다. 새 모듈 `site-region-picker.js`이고, 버튼을 누를 때만 불러온다(첫 화면 모듈 묶음 무변경).
  - 고르면 "전북특별자치도 전주시 근처 약국 찾아줘"처럼 지역을 넣어 한 번 다시 묻는다. Core는 문장 속 지역을 우선한다(Core에서 q0·q1로 조회되는 것을 확인했다).
  - 저장하는 것은 없다. 목록에 없는 지역은 창 안 안내대로 입력창에 적는다.
- 동음 지역(`REGION_AMBIGUOUS`)이나 이유가 없는 옛 Core 응답에는 버튼을 붙이지 않는다.
- 버튼 정보는 답의 meta(`locationRequest.question`)에 남는다. 그래서 새로고침 뒤에도 보인다. 복원할 때 모양을 검사한다.
- 메뉴 구조(병원·응급실 / 약국)는 소유자 결정 그대로 두었다. 병원·응급실·약국 모두 같은 버튼이 붙는다.

### #8 캘린더에 추가 — 일정이 있는 답에만 (계약 변경 ①)

- 전(CHATPERF-08, 09-27): 모든 답 아래에 캘린더 버튼이 있었다. 장소 답은 장소 이름으로, 평범한 답은 빈 "기록 추가"로 열었다.
- 후: Core 일정 초안(calendar_draft)에 제목이나 날짜가 있는 답에만 보인다.
  - 되묻는 답·장소 답·평범한 답에는 없다.
  - 빈 초안이 openCalendar로 가는 길 자체가 없어졌다. `calendarDraftHintFromMessage(message)`는 일정이 없으면 null이다.
- 일정 답의 버튼은 전과 같이 미리 채운 편집기("일정 초안 확인")를 연다.

### #9 장소 카드 분류

- NAVER 분류 경로의 마지막 단계만 보인다(`placeCategoryLabel`, site-navigation.js).
  - "여행,명소>동물원" → "동물원"
  - "카페,디저트" → "카페·디저트"
- 원문 category 값은 결과에 그대로 남는다(다른 코드가 읽는다).

### #6 홈 예시 버튼 (계약 변경 ②)

- 전(10-05 UIUX phase1): '이번 주 일정 정리'·'생활비 정리하기'는 입력창에 문장만 넣고 focus했다(키보드가 열림).
- 후: 다른 1탭 칩과 같이 바로 보낸다(`askWithoutKeyboard`, 입력창 비움, focus 없음).
- '의심되는 문자 확인'은 진위확인 화면을 여는 버튼이다. 끝에 "›"를 붙여, 같은 모양이 다른 동작을 한다는 혼동을 없앴다.

### #11 한글 단어 중간 줄바꿈

- `home-chat.css`: `body { word-break: keep-all; overflow-wrap: break-word; }`
- `.chat-message`: `word-break: keep-all`. `overflow-wrap:anywhere`는 그대로라 줄보다 긴 단어·URL은 여전히 끊긴다. 코드 블록은 전과 같다.
- 대화 중에도 안전 문구("…예약·구매 내용은…")를 입력창 아래 가운데에 둔다(≤600px `margin-inline:auto`).
- 전역 규칙은 `home-chat.css`(앱 기본 스타일, index.html·auth/callback이 불러옴)에 넣었다.
  - 처음에 `styles.css`에 넣었다가 `validate_hardening.py`가 그 파일을 해시로 잠가 둔 것을 확인했다(법적 고지 페이지 공용).
  - 그래서 `styles.css`는 main과 바이트 단위로 같게 되돌렸다.

## 바뀐 검사기

- 새 검사기 `validate_conversation_answer_ux_01`(site-review.yml 추가).
  - 폭: 320/360/390/412/1280. 라이트·다크.
  - Linux gate 조건을 지킨다: 프로필 폴더를 저장소 안에 미리 만들고, `/opt/pw-browsers/chromium`을 우선 쓴다.
  - #7 확인 항목
    - 약국을 1탭하면 1번 간다. 위치 없음 → 버튼 2개(44px, 화면 안).
    - 지역 선택: 창 열림(dialog), 시·도 2·시·군 2, 선택 전 보내기 꺼짐. 고르면 "전북특별자치도 전주시 근처 약국 찾아줘" 1번, 창 닫힘, 목록 1번 조회.
    - 현재 위치 사용: 같은 질문 + 위치(35.812) 1번(390·1280).
    - 위치 차단: 추가 질문 없음. 위치 사용 꺼짐: [지역 선택]만.
    - 동음 지역·옛 Core: 버튼 없음.
    - 새로고침: 버튼 유지, 재전송 없음.
    - 입력창 비움, composer focus 0회.
  - #8: 되묻는 답·결과 답·장소 답에 캘린더 버튼 없음.
  - #9: 분류 "동물원 / 카페·디저트 / 관광지", ">"·"," 없음.
  - #6: 예시 1탭 = 1번 전송, focus 0, 진위확인 칩만 "›".
  - #11: body·대화·안전 문구 keep-all. "내용은"과 "찾아보세요."가 한 줄에 있다. 안전 문구가 입력창 아래 가운데(휴대폰).
  - 대비: 라이트 16.1, 다크는 버튼 15.67·제목·안내 14.77·선택칸·보내기 12.28.
  - 선택: `CONVERSATION_ANSWER_UX_SCREENSHOTS=<폴더>`로 화면을 저장한다.
- 계약 변경에 따라 고친 기존 검사기(단정 약화 없음, 없앤 단정마다 새 규칙 단정을 넣었다)
  - `validate_message_share_actions_01`: 캘린더 버튼은 `calendarDraft ?`일 때만 만든다. append는 filter(Boolean)이다. 도우미는 (message)만 받고, place 없이 return null이다.
  - `validate_message_calendar_footer_editor_01`
    - 평범한 답에 캘린더 버튼이 없다.
    - 그 뒤 일정 답의 버튼이 다시 미리 채운 편집기를 연다. 캘린더 창 성질(dialog·빈 곳 탭 유지·닫기·Esc) 단정은 그 창으로 그대로 유지했다.
    - send 도우미는 "새 캘린더 버튼" 대신 "새 답변 도구 줄"을 기다린다.
  - `validate_chat_read_aloud_restore_browser_01`: 평범한 답 도구 줄은 복사·공유·읽어주기 3개다.
  - `validate_uiux_phase1_01`: 예시는 askWithoutKeyboard로 보낸다. 처리기 안에 `prompt.value =`·`prompt.focus(`가 없다.

## TEST_STATUS

검사 환경:
- Windows 로컬, Chrome headless(DevTools protocol), 가짜 Core.
- 모바일은 viewport·터치 에뮬레이션이다.
- 커밋 내용 그대로(LF archive)를 풀어서 한 번에 하나씩 돌렸다(다른 방과 CPU 경쟁 회피).

- 새 검사기 `validate_conversation_answer_ux_01`: PASS.
  - 320/360/390/412/1280, 라이트·다크.
  - 다크 대비: 버튼 15.67, 지역 창 제목·안내 14.77, 선택칸·보내기 12.28. 라이트는 16.1.
- 1차(main 61d3ce37 기준 4641a538): 관련 검사기 47개 중 42개는 처음에 PASS했고, 나머지 5개는 아래처럼 처리했다.
  - conversation_answer_ux_01: CPU 68%에서 Chrome 시작 신호 20초 초과 → 단독 재실행 PASS.
  - message_calendar_footer_editor_01: send 도우미가 "새 캘린더 버튼"을 기다리다 멈췄다(이번 계약 변경 때문) → 도우미가 새 답변 도구 줄을 기다리게 고쳤다(c05ebdc2, 판정 무변경) → PASS.
  - validate_hardening.py: 잠긴 styles.css 변경 → 규칙을 home-chat.css로 옮겼다(1dbdc91b) → PASS.
  - place_card_carousel_no_drift_01: 한 번 실패(옆 카드 탭 중앙 카드) → 재실행 PASS. main 61d3ce37에서도 PASS → 부하성으로 판단.
  - site_refresh_route_restore_01: "I 로그인 왕복 /#scam" 실패 → 재실행 PASS. 같은 조건의 main 61d3ce37에서도 같은 단정이 실패 → 기존 실패.
- 최신 main afb7057d 병합 뒤(3c3605a4): 관련 검사기 25개 모두 PASS.
  - 이번 변경: 새 검사기, 계약 변경 검사기 4개, consumer_sections_02, life_medical_category_entry_01, life_medical_auto_search_card_01, life_info_cleanup_final_01, life_direct_chat_card_compaction_01, regional_news_p0_01
  - 새로 들어온 카드: subway_life_info_p0_01, ev_charger_nearby_list_p0_01, traffic_cctv_route_select_p0_01, real_estate_region_favorites_p0, onnuri_location_ux_p0, photo_input_no_camcorder_01(git 저장소가 필요해 worktree에서 실행), jeonbuk_real_world_pilot_01
  - 그 밖: place_card_compact_01, chat_mobile_keyboard_dismiss_01, conversation_account_sync_01, auth_continuity_02, bare_white_home_render_01, validate_hardening.py, validate_home_chat.py
- 1차에서 PASS한 나머지 관련 검사기(병합 전 기준)
  - 키보드·스크롤: chat_ios_touch_scroll_keyboard_01, chat_long_answer_scroll_anchor_01, mobile_composer_keyboard_layout_01, samsung_composer_keyboard_01, composer_interaction
  - 장소 카드: place_card 계열 6개
  - 홈: home_small_text_contrast_01, home_fresh_entry_01, chat_layout_attachment_01
  - 축제: festival_nav_wiring_01, festival_calendar_add_ui_01, festival_event_08_responsive_a11y_01
  - 학교·캘린더: life_calendar_client_01, life_neis_school_01
  - 진위확인·사이드바: scam_shield_mvp_01, scam_shield_login_gate_contrast_01, sidebar_information_architecture_04
  - 그 밖: chat_dark_login_kakao_share_01, chat_answer_quality_p0_01, kindergarten_official_info_01, my_child_school_01, onnuri_merchant_search_01, chat_answer_recovery_01
- 화면 증거 38장: `handoff/conversation-answer-ux-01-evidence/`(검사기 스크린샷 옵션으로 저장).
- 전체 site-review 회귀: NOT RUN(최종 전체 gate는 배포총괄방).

NEW_FAILURES=0 (관련 검사기 기준)

DEVICE_E2E=NOT VERIFIED (iPhone Safari·삼성 인터넷·카카오 인앱 실기기 미확인. Chrome 에뮬레이션만)
CORE_E2E=NOT VERIFIED (짝 Core READY a6930a15 운영 전. 검사기는 Core 계약과 같은 가짜 응답을 쓴다)

## 겹치는 branch

- 지역정보 뒤로가기 `feature/regional-info-back-navigation-01-site`(b4436051, READY·main 미반영): `site-consumer-sections.js`를 고친다. 이 branch는 그 파일을 바꾸지 않았다. `site-conversation.js`는 둘 다 고친다(이 branch는 답변 렌더·메타·홈 예시 처리기, 그쪽은 route).

## 배포 후 smoke

- 지역정보 → 약국(위치 꺼짐 또는 권한 없음): "어느 지역에서 찾을까요?" 아래에 [현재 위치 사용]·[지역 선택]이 있다. 지역 선택 → 전북특별자치도 → 전주시 → 이 지역으로 찾기 → 약국 카드.
- 평범한 답·장소 답 아래에 캘린더 버튼이 없다. 일정 문장("10월 15일 3시 치과")에는 있다.
- "전주 가볼만한 관광지 알려줘": 카드 분류가 "동물원" 같이 짧다.
- 홈 '이번 주 일정 정리'를 누르면 바로 답이 시작되고 키보드가 뜨지 않는다.
- 390px 홈·대화: 안전 문구가 단어 중간에서 끊기지 않고 가운데에 있다.
