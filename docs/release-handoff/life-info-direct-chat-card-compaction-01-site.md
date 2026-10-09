READY_FOR_DEPLOY=YES
SUPERSEDES=5e04fcfb5eb37452ae7d431f384a3549faea713d (이전 READY, main 06270582 기준) · cd30151971003f37dcb59e6ad0f3771026bc0250 · 대기 문서 5e2ca2c5
MIGRATION=NO
DEPLOY_ORDER=SITE 단독
USER_DECISION_NEEDED=NONE (배포 차단 아님. 유치원·학교 1탭 전환은 아래 "계약 변경" 참고)

# life-info-direct-chat-card-compaction-01-site — release handoff (main 819ead3a 재병합)

REPO=lotbi-site
FEATURE_BRANCH=feature/life-info-direct-chat-card-compaction-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD)
REMOTE_FEATURE_SHA=FEATURE_SHA와 동일(`git ls-remote origin refs/heads/feature/life-info-direct-chat-card-compaction-01-site`로 확인)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=819ead3af6b6b74185519fc74b09b733e7305447 (SITE-T41)
MERGE_METHOD=NORMAL MERGE 3회(2f1212ea → 06270582 → 819ead3a). rebase·force push·reset 없음
CODE_SHA=e7cc2fc7937904eac455aac5b05f22b7336ac5e1
ASSET_VERSION=aset-0672da12c0d7

## 이번 재병합에서 바뀐 것

main 819ead3a(SITE-T41)에 의료 자동검색(c8457c1e)이 먼저 들어왔다. 그래서 의료·지역생활정보 1탭 전송은 main에 이미 있다.
- main 경로: `onAsk` → `askWithoutKeyboard` → `requestAssistant(question, true, '', 0, {keepComposerClosed: true})`.
- 이 branch가 같은 목적으로 만든 `askFromLife`·`composerStaysClosed`·`keepKeyboardClosed`는 모두 버리고 main 코드를 그대로 썼다.
- 이 branch에 남은 실제 차이는 유치원·학교 1탭 하나다.

## main 대비 코드 변경 (token 줄 제외)

- `site-life-education.js`(18줄)
  - `onDraft` → `onAsk`: 학교 폼, 유치원 대체 폼(공식정보 연결 OFF), 유치원 상세 "대화로 물어보기" 3곳.
  - 학교 버튼 "질문 준비하기" → "롯비에게 물어보기".
  - 안내 "다음 화면에서 질문을 확인한 뒤 보내세요." → "누르면 바로 롯비에게 물어봐요."
- `site-consumer-sections.js`(7줄): `onDraft` 인자 삭제, `mountEducation({root: host, onAsk, accountId})`, 머리 주석.
- `site-conversation.js`(7줄 삭제): 쓰지 않게 된 `draft` 도우미(입력창 채우기 + `prompt.focus()`)와 `onDraft` 연결.
- asset token: 65파일, aset-0672da12c0d7.

## main 기능 보존 근거

- 위 3파일은 main 파일에서 위 줄만 다르다(`git diff origin/main HEAD`). 그 밖의 제품 코드는 main과 같다(token 줄 제외).
- 의료 자동검색·회전 카드, 온누리, 구독, 사진 없는 카드(474a7ef6), 키보드 닫기 P0(CHAT-MOBILE-KEYBOARD-DISMISS-01), 숨김 정책 6개는 무변경이다.
- 지도 = 쿠키 `lotbi_default_map_provider_v1` + `buildDefaultMapHref`(main 그대로). NAVER 고정 없음.
- 병합 중 branch의 `const reducedMotion =globalThis…`(공백 누락) 줄은 main 형태로 되돌렸다.

## 계약 변경 — 유치원·학교 (KINDERGARTEN-OFFICIAL-INFO-01)

- main 주석과 검사기는 유치원·학교를 "입력창에 넣고 확인 후 전송"(초안 + `prompt.focus()`, 휴대폰 키보드 열림)으로 고정했었다.
- 2026-10-09 인수인계문 목표("생활정보 버튼 한 번 = 즉시 전송, 키보드 자동 실행 금지")에 따라 1탭 전송으로 바꿨다.
- 되돌릴 때: 제품 코드는 커밋 4febf9ef 하나다. 검사기는 fc25d920의 교육 관련 단정이다.

## 바뀐 검사기 (main 단정 약화 없음)

- `validate_consumer_sections_02`, `validate_life_medical_auto_search_card_01`, `validate_life_medical_category_entry_01`
  - 전: 교육 초안 연결 2곳(`onDraft`)을 예외로 빼고 검사.
  - 후: `onDraft`·`draft(text)`·초안 안내 문구가 0곳이어야 한다(더 엄격). 교육은 `mountEducation({root: host, onAsk, accountId})`.
  - category_entry: 지역생활정보 전송 뒤 입력창 focus 없음 단정 추가.
- `validate_kindergarten_official_info_01`(이전 READY와 같음): 학교 탭·유치원 대체 폼 제출 → Core가 문장을 1번 받음, 입력창 비어 있음, focus 없음, 학교 버튼 문구.
- `validate_place_card_compact_01`(이전 READY와 같음): 사진 없는 옆 카드 placeholder 0개, 사진 카드가 있을 때 rail `has-place-photo`.
- `validate_life_direct_chat_card_compaction_01`(이 branch 검사기): main 구조로 다시 썼다.
  - 범위: 병원·약국·응급실(입력 폼 없음), 지역생활정보, 유치원·학교 → 학교.
  - 폭: 320 / 360 / 390 / 412 / 1280. 라이트·다크(설정 쿠키).
  - 단정: 1탭 = 메시지 1개(빠른 두 번 탭도 1개), 입력창 비어 있음, composer focus 이벤트·`focus()` 호출 0회(focus emulation 켬), 생활정보 닫힘.
  - 뒤로·앞으로·새로고침 때 다시 보내지 않고 focus 0회. 입력창을 탭할 때만 focus.
  - "근처" 질문만 현재 위치가 같이 간다. 지역생활정보·학교 질문에는 위치가 없다.
  - 사진 없음·사진 로드 실패 = 사진 칸 없음. 실제 사진은 보인다.
  - 사진 없는 목록 rail은 사진 칸 공간을 남기지 않는다. 옛 "70% 이하" 비율은 main 카드 구조(rail = 가장 큰 카드 + 위치 줄 60px)에 맞지 않아, "가장 큰 카드 아래 여백 ≤ 사진 목록의 여백"으로 바꿨다.
  - 지도 버튼 = 설정값(기본·NAVER_MAP·KAKAO_NAVI·TMAP·GOOGLE_MAPS)의 `buildDefaultMapHref` 결과. 전화 = 기존 helper 결과.
  - 다크 대비: 폼 버튼·안내 ≥ 4.5, 카드 제목·주소·진료 줄 ≥ 4.5.
- `.github/workflows/site-review.yml`: 위 검사기 단계(설명 갱신).

## TEST_STATUS

검사 환경:
- Windows 로컬, Chrome headless(DevTools protocol), 가짜 Core.
- 모바일은 viewport·터치 에뮬레이션이다. 실기기는 NOT TESTED.
- 작업본이 CRLF라서 커밋 내용 그대로(LF, `git -c core.autocrlf=false archive e7cc2fc7`)를 따로 풀어 검사했다.
- 다른 방과 겹치지 않게 검사기를 한 번에 하나씩 돌렸다(CPU 3% 확인).

- 모듈 구문 검사(`site-conversation.js`, `site-consumer-sections.js`, `site-life-education.js`): PASS.
- `node scripts/asset_cache_version.mjs --check`: PASS(aset-0672da12c0d7, targets 133, refs 160).
- 이 branch 검사기 `validate_life_direct_chat_card_compaction_01`: PASS. 320 / 360 / 390 / 412 / 1280, 라이트·다크.
  - 병원·약국·응급실·지역생활정보·학교: 한 번 탭(빠른 두 번 탭 포함) = 메시지 1개, 입력창 비어 있음, composer focus 이벤트·`focus()` 호출 0회, 생활정보 닫힘.
  - 뒤로·앞으로·새로고침: 다시 보내지 않음, focus 0회. 390에서 입력창 탭 = focus 1회.
  - "근처" 질문만 현재 위치(35.812, 127.123)가 같이 간다. 지역생활정보·학교는 위치 없음.
  - 사진 없는 카드 rail(사진 목록 → 사진 없는 목록): 320 350→259px, 360 356→244px, 390 371→244px, 412 383→244px, 1280 344→232px. 카드 높이: 사진 290~323px, 사진 없음 165~199px.
  - 지도 버튼: 기본·NAVER_MAP·KAKAO_NAVI·TMAP·GOOGLE_MAPS 모두 설정값과 `buildDefaultMapHref` 결과가 같다. 전화 버튼도 기존 helper 결과와 같다.
  - 글자 대비: 라이트 16.1. 다크는 폼 버튼·안내 14.77, 사진 없는 카드 글자 13.93.
- 관련 검사기 28개(한 번에 하나씩): 28 PASS.
  - consumer_sections_02, consumer_detail_system_01, life_medical_category_entry_01, life_medical_auto_search_card_01, kindergarten_official_info_01, life_info_cleanup_final_01
  - life_neis_school_01, neis_school_official_links_01, school_meal_neis_admin_fallback_01, onnuri_merchant_search_01, onnuri_market_location_02
  - place_card_compact_01, place_card_naver_search_click_01, place_medical_card_ux_final_01, place_card_carousel_no_drift_01, place_card_cross_platform_01, place_card_map_deeplinks_01
  - chat_mobile_keyboard_dismiss_01, chat_ios_touch_scroll_keyboard_01, chat_long_answer_scroll_anchor_01, mobile_composer_keyboard_layout_01, samsung_composer_keyboard_01
  - composer_interaction, composer_auto_grow, composer_desktop_width_02, attachment_composer_16, chat_answer_recovery_01, site_refresh_route_restore_01
  - `place_card_compact_01`: 처음 묶음 실행에서 고정 포트 4213 서버의 "Failed to fetch dynamically imported module"(360/TMAP)로 멈췄다. 4213 포트가 비어 있는 것을 확인하고 단독으로 다시 돌려 PASS. 같은 현상이 main 06270582에서도 기록돼 있다(이전 READY). 제품 코드와 관계없다.
- 기존 main에서도 나는 실패: 이번 관련 묶음에는 없다. 이전 전체 회귀(06270582 기준)의 기존 RED 2개(mobile_footer_legal_sheet_01, site_avatar_fallback_runtime)는 이번 범위 밖이라 다시 돌리지 않았다.
- 전체 site-review 회귀: NOT RUN(이 PC CPU 제약). 최종 전체 gate는 배포총괄방(Linux).

NEW_FAILURES=0 (관련 검사기 28개 + 이 branch 검사기 기준)

MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
DEPENDENCIES=없음. Core·App 무변경.

## 겹치는 branch (나중에 main에 들어가는 쪽이 다시 merge)

다음 3개는 main 미포함이고 옛 `onDraft`(초안) 경로를 쓴다. 이 branch가 먼저 들어가면 재병합할 때 `onAsk`로 바꿔야 한다. 그대로 두면 남은 `draft(text)`·`onDraft`를 강화된 `validate_consumer_sections_02` 등이 FAIL로 잡는다.
- 지역뉴스 Site `feature/regional-news-p0-site`(a421b5cd): 뉴스 버튼 3곳이 `onDraft`.
- 내 아이 학교 Site `feature/my-child-school-01-site`(271cb2dc): `site-conversation.js`에 자기 `onDraft: text => { closeSurface(); draft(text); }` 연결이 있다.
- 전북 실증 Site `feature/jeonbuk-real-world-pilot-01-site`(8cb40b01, PAUSED): 음식 폼 등이 `onDraft`.

## Production 미반영 (2026-10-09 21:58 확인)

- 운영 site = main 819ead3a(SITE-T41, 21:44 배포, aset-e37c99b26fbd). 서빙 파일 3개 해시가 819ead3a blob과 같다.
- 운영에 이미 있는 것: 의료(병원·약국·응급실)·지역생활정보 1탭 전송, 사진 없는 카드 정리, 지도 설정.
- 운영에 없는 것(이 branch): 유치원·학교 1탭. 운영 `site-life-education.js`에는 아직 "질문 준비하기"·초안 입력이 있다.

POST_DEPLOY_SMOKE=실기기 iPhone Safari·Android Chrome·카카오톡 인앱에서 확인:
- 생활정보 → 병원·의원 / 약국 / 응급실: 한 번 탭으로 답변이 시작되고, 키보드가 뜨지 않고, 입력창이 비어 있다.
- 생활정보 → 지역생활정보 → 두 칸 입력 → 롯비에게 물어보기: 같은 동작.
- 생활정보 → 유치원·학교 → 학교 → 학교 이름 + 이번 주 급식 → 롯비에게 물어보기: 같은 동작.
- 사진 없는 병원 카드: 사진 칸이 없고 짧다. 전화 버튼, 설정에서 고른 지도앱 버튼.
- 입력창을 탭할 때만 키보드가 뜬다. 뒤로·앞으로·새로고침 때 다시 보내지 않는다.
- 다크 모드에서 같은 화면이 읽힌다.

## NOT_IN_SCOPE / 참고

- 실기기 iPhone·Android·카카오톡 인앱은 NOT TESTED다(Chrome 에뮬레이션만).
- 상품 검색 카드의 "이미지 없음" 자리표시는 바꾸지 않았다.
- 전체 site-review 회귀(약 250개)는 이 PC에서 돌리지 않았다. 최종 전체 gate는 배포총괄방(Linux).
