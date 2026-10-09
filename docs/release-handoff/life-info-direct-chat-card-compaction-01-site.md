READY_FOR_DEPLOY=YES
SUPERSEDES=cd30151971003f37dcb59e6ad0f3771026bc0250 (및 대기 문서 5e2ca2c5)
MIGRATION=NO
DEPLOY_ORDER=SITE 단독
USER_DECISION_NEEDED=NONE

# life-info-direct-chat-card-compaction-01-site — release handoff (최신 main 재병합)

REPO=lotbi-site
FEATURE_BRANCH=feature/life-info-direct-chat-card-compaction-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD)
REMOTE_FEATURE_SHA=FEATURE_SHA와 동일(`git ls-remote origin refs/heads/feature/life-info-direct-chat-card-compaction-01-site`로 확인)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=0627058241ff7d562c811fff52063ba5bda9760a
MERGE_METHOD=NORMAL MERGE 2회(2f1212ea → 06270582). rebase·force push·reset 없음
CODE_SHA=1c8546251
ASSET_VERSION=aset-008c4b2e18cc

## 무엇이 바뀌었나 (최신 main 대비)

Site만 변경했다. Core·App·API 계약 변경 없음.

1. 생활정보 질문 = 한 번 탭으로 바로 전송, 키보드 안 띄움
   - 경로: `onDraft(text)` → `askFromLife` → 생활정보 창 닫기 → 일반 전송 `requestAssistant(question, true, '', 0, {keepKeyboardClosed: true})`.
   - 창을 닫을 때 직전 focus(입력창일 수 있음)로 되돌리지 않는다(`surfaceRestoreFocus = undefined`).
   - 이 턴이 끝나는 6곳(즉시 응답, finally 3곳, 시간초과, 캘린더 취소)은 main의 CHAT-MOBILE-KEYBOARD-DISMISS-01 호출을 글자 그대로 두고, 앞에 `if (!composerStaysClosed)`만 붙였다. 그래서 생활정보 질문(과 복구 턴)은 어떤 기기에서도 입력창을 focus하지 않는다. 다른 턴은 main과 똑같다(휴대폰은 키보드 닫힘, PC는 커서 복귀).
   - 입력창에 문구를 남기지 않는다. 이전 답변 진행 중이거나 첨부가 대기 중이면 보내지 않고 입력창에 넣어 "전송을 눌러 주세요"로 안내한다(focus 없음).
   - 버튼·안내 문구:
     - 병원·의원·약국: "바로 찾기". 지역생활정보: "롯비에게 물어보기".
     - 유치원·학교 → 학교 탭: "질문 준비하기" → "롯비에게 물어보기". 이 폼도 onDraft를 쓰므로 바로 전송된다.
     - "다음 화면에서 질문을 확인한 뒤 보내세요" → "누르면 바로 롯비에게 물어봐요"(생활정보 폼, 학교 탭).
     - 유치원 상세·준비 중 화면의 "대화로 물어보기"는 문구가 맞아서 그대로 두었다. 바로 전송된다.
2. 사진 없는 장소·의료 카드
   - main의 PLACE-MEDICAL-CARD-UX-FINAL-01(474a7ef6)이 이미 같은 동작을 담고 있어 main 코드를 그대로 썼다.
     - 사진 없는 카드는 사진 칸이 없다. 사진 로드가 실패하면 칸을 지운다.
     - rail 높이는 가장 큰 카드 + 하단 줄 기준이다(커지기만 함).
     - 휴대폰(≤760px)에는 좌우 화살표가 없다.
   - 이 branch의 `is-center-without-photo`(가운데 카드에 사진이 없으면 화살표를 아래로)는 뺐다. 휴대폰에는 화살표가 없고, 넓은 화면은 화살표가 rail 가장자리에 있어 카드 글자를 가리지 않는다. 360/375/390/412/1280에서 "화살표가 사진 없는 카드의 글자·아이콘을 가리지 않음"을 계속 잰다.
3. 지도 = 사용자가 설정에서 고른 지도앱
   - 쿠키 `lotbi_default_map_provider_v1` + 기존 `buildDefaultMapHref`(main 코드 그대로). NAVER 고정 없음.
4. main의 숨김 정책 6개는 그대로다.
   - 공과금 메뉴, 상단 질문바, 하단 보조 row, 롯비함 진입, `+ 롯비함`, subscribe 공과금(`LOTBI_BOX_UI_ENABLED=false`).
   - 공과금이 없어져 공과금 전용 안내 분기도 같이 없어졌다.

## 바뀐 검사기 (같은 엄격도, 계약 변경에 맞춤)

- 신규 단정 추가: `validate_life_direct_chat_card_compaction_01`
  - 다크 단계: 360/375/390/412/1280, 설정에서 다크를 고른 상태(`lotbi_theme_preference_v1=dark`).
    - 한 번 탭 전송, 입력창 focus 0, 사진 칸 없음.
    - 글자 대비: 버튼·안내문 14.77, 카드 글자 13.93(밝은 화면 16.1).
  - 소스 단정: requestAssistant의 focus 6곳이 모두 `composerStaysClosed` 조건 뒤에 있는지, 그 밖의 focus 호출은 없는지. 학교 폼에 확인 단계 문구가 없는지.
- `validate_kindergarten_official_info_01`: 학교 탭·준비 중 화면 제출을 "입력창에 문장"에서 "Core가 그 문장을 1번 받음, 입력창 비어 있음·focus 없음"으로 바꿨다. 학교 버튼 문구도 확인한다.
- `validate_site_refresh_route_restore_01` CASE M(PAGE-CLEANUP-05): 생활정보 폼으로 나갈 때 "질문이 입력창에서 대기"에서 "대화에 1번 전송, 입력창 비어 있음"으로 바꿨다. 주소 `/`, 뒤로 한 단계, 앞으로 재열림 단정은 그대로다.
- `validate_life_medical_category_entry_01`: main의 공과금·검색창 제거 쪽을 따랐다. 병원·약국·지역생활정보는 바로 전송 단정을 유지했다.
- `validate_consumer_detail_system_01`: "바로 찾기" + 새 안내 문구.
- `validate_place_card_compact_01`: 사진 없는 옆 카드에 빈 placeholder 0개, rail 사진 높이 유지 단정을 유지했다.
- `validate_place_card_naver_search_click_01`: main 쪽을 썼다(사진 없는 카드는 제목 탭, 휴대폰은 화살표 대신 넘기기).

## TEST_STATUS

검사 환경:
- Windows 로컬, Chrome headless(DevTools protocol), 가짜 Core.
- 모바일은 viewport·터치 에뮬레이션이다. 실기기는 NOT TESTED.
- 작업본이 CRLF라서, 커밋 내용 그대로(LF, `git -c core.autocrlf=false archive`)를 따로 풀어 검사했다.

이 branch 검사기 `validate_life_direct_chat_card_compaction_01`: PASS. 360 / 375 / 390 / 412 / 1280에서 밝은 화면·다크 모두 확인했다.
- 한 번 탭이면 메시지 1개가 간다. 입력창은 비어 있고, composer focus 이벤트와 focus() 호출이 모두 0회다(focus emulation 켬).
- 빠르게 두 번 탭해도 1개만 간다. 뒤로·앞으로·새로고침 때 다시 보내지 않고 focus도 0회다.
- 사진 칸:
  - 사진이 있는 카드는 정상으로 보인다.
  - image_url이 없거나 사진 로드가 실패하면 사진 칸이 없다.
  - 카드 높이: 사진 없는 카드 167px, 사진 카드 272~299px.
  - rail 높이: 사진 없는 목록 모바일 227px·1280 215px, 사진 목록 327~359px.
- 화살표가 사진 없는 카드의 글자·아이콘을 가리지 않는다.
- 지도 버튼은 설정을 따른다. 설정 없음(기본 NAVER_MAP)과 NAVER_MAP·KAKAO_NAVI·TMAP·GOOGLE_MAPS 각각에서 `buildDefaultMapHref` 결과와 같다. 전화 버튼도 기존 helper 결과와 같다.
- 390에서만 확인한 것:
  - 위치 사용이 켜져 있으면 현재 위치가 같이 간다.
  - 약국·지역생활정보도 1탭으로 전송된다.
  - 입력창을 탭할 때만 focus된다.
- 다크 글자 대비: 버튼·안내문 14.77, 카드 글자 13.93(밝은 화면 16.1).

관련 검사기 PASS:
- life_medical_category_entry_01, kindergarten_official_info_01
- place_card_compact_01, place_card_naver_search_click_01, place_medical_card_ux_final_01, place_card_carousel_no_drift_01
- consumer_sections_02, consumer_detail_system_01
- life_info_cleanup_final_01(숨김 정책 6개)
- chat_mobile_keyboard_dismiss_01, chat_answer_recovery_01
- site_refresh_route_restore_01

전체 site-review(workflow의 node·python 명령 204개): 202 PASS, 기존 RED 2개.
- 4병렬로 1번 돌렸다. 실패한 것과 중간에 멈춘 것은 단독으로 다시 돌렸다.
- 4병렬 실패 17개의 내용:
  - 1개는 계약 충돌이었다(site_refresh_route_restore_01 CASE M). 검사기를 고친 뒤 PASS.
  - 나머지는 부하성이었다. 다른 방 회귀와 동시에 돌아 CPU 100%였고, Chrome 시간 초과·고정 포트 모듈 로드 실패·result missing·임시 폴더 잠김이 났다. 단독 재실행에서 모두 PASS.
- 개별 메모:
  - place_card_compact_01: python http.server(고정 4213)의 모듈 로드 실패가 main 06270582에서도 같은 식으로 났다. branch 단독 재시도에서 PASS.
  - global_location_foundation_01: git 저장소가 있어야 돌아서 작업 폴더에서 돌렸다. PASS.
- 기존 RED 2개는 main 06270582에서도 같은 단정으로 실패한다.
  - mobile_footer_legal_sheet_01: "761px: mobile disclosure leaked into desktop"
  - site_avatar_fallback_runtime: `assert(!this.paused)`
- Production API CORS 실측 같은 외부 호출 shell 단계는 실행하지 않았다.

`node scripts/asset_cache_version.mjs --check`: PASS(aset-008c4b2e18cc).

NEW_FAILURES=0

MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
DEPENDENCIES=없음. Core·App 무변경.

## 겹치는 branch (나중에 main에 들어가는 쪽이 다시 merge)

- 의료 자동검색 Site `feature/life-medical-auto-search-card-01-site`(재READY c8457c1e, main 06270582보다 앞선 main 기준)
  - 같은 목적의 바로 전송을 `onAsk`·`keepComposerClosed` 이름으로 따로 구현했다.
  - 겹치는 파일: `site-consumer-sections.js`의 onDraft↔onAsk, `site-conversation.js`의 askFromLife·requestAssistant focus 6곳, `validate_life_medical_category_entry_01`.
  - 그쪽이 나중에 들어가면 이름을 하나로 맞춰야 한다. requestAssistant focus 6곳은 main 키보드 닫기 검사기(4 + 2 호출)를 지켜야 한다.
- 내 아이 학교 Site `feature/my-child-school-01-site`(271cb2dc): `site-life-education.js` 겹침은 asset 토큰 줄뿐이다. `site-consumer-sections.js`·`site-conversation.js`는 겹친다.
- 지역뉴스 Site·전북 실증 Site: 이 branch의 onDraft 바로 전송에 기대어 1탭 전송이 된다. 이 branch가 먼저 들어가는 것이 좋다.

POST_DEPLOY_SMOKE=실기기 iPhone Safari·Android Chrome에서 확인:
- 생활정보 → 병원·의원 → 지역·지금 진료 → 바로 찾기: 한 번에 답변이 시작되고, 키보드가 뜨지 않고, 입력창이 비어 있다.
- 생활정보 → 유치원·학교 → 학교 → 롯비에게 물어보기: 같은 동작.
- 사진 없는 병원 카드: 사진 칸이 없고 짧다. 휴대폰에는 화살표가 없고 넘겨서 돈다.
- 전화 버튼, 설정에서 고른 지도앱(예: 카카오내비) 버튼.
- 입력창을 탭할 때만 키보드가 뜬다.
- 뒤로·앞으로·새로고침 때 다시 보내지 않는다.
- 다크 모드에서 같은 화면이 읽힌다.

## NOT_IN_SCOPE / 참고

- 상품 검색 카드의 "이미지 없음" 자리표시는 바꾸지 않았다.
- 실기기 iPhone·Android는 NOT TESTED다(Chrome 에뮬레이션만).
