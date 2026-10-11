READY_FOR_DEPLOY=YES
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
DEPLOY_ORDER=SITE 단독 (Core 변경 없음)
USER_DECISION_NEEDED=NONE

# PLACE-CARD-RAIL-ALL-RESULTS-01 — 장소·병원 카드 레일: 결과 전부 넘겨 보기 (Site)

TASK=PLACE-CARD-RAIL-ALL-RESULTS-01 (소유자 요청 2026-10-11 08:0x, 배포총괄방 전달)
REPO=lotbi-site
FEATURE_BRANCH=feature/place-card-rail-all-results-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD). `git ls-remote origin refs/heads/feature/place-card-rail-all-results-01-site`로 확인한다.
CODE_SHA=16152094494d3b704cb8f935bbb7a0591b7c67af
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=7c4f09445676287f242271cbdfb32d91ec33891e (SITE-T54. branch는 이 main에서 만들었고 push 직전 ls-remote로 그대로임을 확인했다)
MAIN_PRESERVATION=main 위 커밋 1개(코드+토큰)와 이 문서뿐이다. main 대비 바뀐 내용: site-conversation.js(createPlaceCardRail)·site-conversation.css·검사기 4개·asset 토큰 줄. 다른 기능 코드는 건드리지 않았다.
ASSET_VERSION=aset-5b9751ac1afe

## 소유자 지적

데스크톱 화면에서 "전주시 완산구 내과 찾아줘"를 물었다.

- 답은 "5곳을 찾았어요"인데, 카드는 1/3~3/3만 넘어갔다.
- 4·5번째 카드는 「다른 병원 보기」를 눌러야 나왔다.
- 이전·다음 카드가 가운데 카드 뒤 양옆에 반쯤 겹쳐 보여, 카드가 합쳐진 것처럼 보였다.

## 바뀐 것

### 1) Core가 보낸 결과 전부를 레일에서 바로 넘긴다

- 처음부터 결과 전부(최대 5곳, `normalizePlaceResult`가 5곳까지 받음)가 레일에 들어간다. 표시는 1/5 … 5/5다.
- 휴대폰은 스와이프, 넓은 화면은 ‹ ›·마우스 끌기·키보드(←·→·Home·End)로 넘긴다. 마지막 카드 다음은 첫 카드다(전과 같음).
- **「다른 … 보기」 버튼을 없앴다**(병원·약국·응급실·동물병원·장소 모두). 남길 이유가 없었다.
  - 그 버튼은 새로 검색하지 않았다. 이미 받은 4·5번째 카드를 보이게만 했다.
  - 추가 검색은 이미 다른 길이 있다. 약국 결과 아래 조건 칩(지금 운영 중·야간·휴일·24시간)과 대화로 다시 묻기다.
- 같은 기관이 두 번 오면 한 장으로 합치는 처리는 그대로다.

### 2) 넓은 화면(>760px): 가운데 카드 1장 + 바로 옆 화살표

- 옆 카드는 넓은 화면에서 보이지도 눌리지도 않는다(opacity 0, pointer-events none). 넘길 때만 옆에서 밀려 들어오고 밀려 나간다.
- 레일 폭은 카드(280px)와 양쪽 화살표 자리(56px씩)를 합친 392px이다. 그래서 ‹ ›가 카드 바로 옆(12px)에 붙는다.
- 카드 아래에 1/5가 있다. 카드 크기(280px)·전화·지도 버튼·카드 본문 탭(네이버 검색)은 전과 같다.
- **"겹침 없이 나란히"를 고르지 않은 이유**
  - 대화 칸(1280px 화면에서 약 700px)에 280px 카드 세 장과 화살표가 다 들어가지 않는다.
  - 나란히 두면 옆 카드가 다시 반쯤 잘려 보인다. 소유자가 지적한 "합쳐진 것처럼"과 같은 인상이 남는다.
  - 휴대폰과 같은 "한 장씩 + 위치 표시" 방식이 한 화면에 한 곳씩 읽기 쉽다.
- 휴대폰(≤760px)은 바꾸지 않았다. 화살표 없이 밀어서 넘기고, 옆 카드 끝 20px만 보인다.

### 3) 지난 함정 유지

- 옆 카드 pointer-events 처리: 휴대폰은 전과 같다. 넓은 화면 옆 카드는 이제 아예 눌리지 않는다.
- 가운데 카드 `.lotbi-rich-card-copy:active` 탭 보정(주소 탭이 tel:로 가던 문제)은 그대로다.
- `validate_place_medical_card_ux_final_01`이 5개 크기 × 3개 상황에서 그대로 확인한다. 주소 바로 아래를 탭하면 네이버 검색 1건만 열리고, 전화·지도 버튼은 제 일만 한다.

## 바뀐 파일

- `site-conversation.js` `createPlaceCardRail`
  - 3장 제한(`shownCount`), `placeNoun`, 「다른 … 보기」 버튼과 처리기를 지웠다.
  - 대신 `cardCount = places.length`를 쓴다. 회전·드래그·키·탭 처리는 그대로다.
- `site-conversation.css`
  - 끝에 `PLACE-CARD-RAIL-ALL-RESULTS-01` 블록(`@media (min-width: 761px)`)을 더했다.
  - `.lotbi-place-orbit-more` 규칙을 지웠다.
  - 휴대폰 규칙은 무변경이다.
- asset 토큰 갱신: `node scripts/asset_cache_version.mjs --write` → aset-5b9751ac1afe.

## 바뀐 검사기 (새 동작에 맞춘 갱신, 단정 완화 없음)

- `validate_place_medical_card_ux_final_01`
  - "세 장 먼저 + 다른 병원 보기"를 "결과 전부(4곳)가 레일에 있음 + 레일 아래 누를 버튼 0개"로 바꿨다.
  - 넓은 화면은 ›로 끝까지 돌며 모든 카드에 닿는지 센다(4/4 포함).
  - 넓은 화면 새 단정
    - ‹ ›가 카드 바로 옆(16px 이내)에 있다.
    - 옆 카드는 opacity 0이고 눌리지 않는다(pointer-events none).
  - 휴대폰 단정(화살표 없음·옆 카드 끝 10~40px·겹침 0)과 탭 보정 단정은 그대로다.
- `validate_place_card_carousel_no_drift_01`
  - 카드 수 3을 5로 바꾸고, 「다른 장소 보기」 없음을 확인한다.
  - "더 보기 탭" 대신 ‹로 5번째·4번째 카드까지 돌면서, 레일이 한 번도 스크롤되지 않고 가운데 카드가 제자리인지 본다.
- `validate_life_medical_auto_search_card_01`
  - 응급실 5곳 결과는 이제 1/5로 시작한다. 카드 수 = Core 결과 수이고, 「다른 … 보기」와 레일 아래 버튼은 없다.
  - 한 번 뒤로 넘기면 5/5(엠마오사랑병원), 다시 넘기면 4/5다.
  - 넓은 화면(1280 다크): 옆 카드 opacity 0·눌리지 않음, ‹ ›가 카드 바로 옆에 있다.
- `validate_place_card_compact_01`
  - 옆 카드 "흐리게(.3~.6)" 단정은 휴대폰에만 둔다.
  - 넓은 화면(761·1280)은 더 강한 단정으로 바꿨다: opacity 0이고 pointer-events none.

## TEST_STATUS

Windows 로컬. LF archive 사본에서 하나씩 돌렸다(CHROME_BIN=Chrome 실설치본). 동시에 두 개를 돌리지 않았다.

- 바뀐 검사기 4개: 모두 PASS.
  - validate_place_medical_card_ux_final_01: 113s. 360·375·390·412·1280 × 병원 4곳·사진 2곳·약국 1곳.
  - validate_place_card_carousel_no_drift_01: 68s.
  - validate_life_medical_auto_search_card_01: 99s. 320~412 휴대폰 5개 + 1280 다크.
  - validate_place_card_compact_01: 93s. 344·360·390·412·760·761·1280 × 지도 4종.
- 반대 확인: 고친 검사기 3개를 바꾸기 전 main(7c4f0944) 코드에 돌렸더니 모두 FAIL했다(새 단정이 소유자 지적을 잡는다).
  - no_drift: "all 5 cards"
  - ux_final: "every place Core sent is in the rail"
  - compact: "761: side card hidden on a wide screen (0.5)"
- 관련 검사기 18개 무변경: 모두 PASS.
  - place_card_cross_platform_01, naver_maps_navigation_01, life_night_medical_01, life_animal_hospital_01
  - place_card_naver_search_click_01: 옆 카드·본문 탭·스와이프 → 네이버 검색 1건
  - life_direct_chat_card_compaction_01, place_card_map_deeplinks_01, life_medical_category_entry_01, chat_answer_quality_p0_01
  - anonymous_conversation_persistence_01, conversation_integration, jeonbuk_real_world_pilot_01
  - chat_long_answer_scroll_anchor_01, chat_mobile_keyboard_dismiss_01, chat_dark_login_kakao_share_01, message_share_actions_01
  - validate_hardening.py: 잠금 파일은 토큰 제외 해시라 PASS. validate_home_chat.py PASS.
- asset 토큰: `node scripts/asset_cache_version.mjs --check` PASS.
- 전체 Site 회귀: NOT RUN(최종 gate는 배포총괄방).

NEW_FAILURES=0

증거 화면(검사기가 찍은 것): `handoff/place-card-rail-all-results-01-evidence/`
- before/: main 7c4f0944. 1280 화면에서 옆 카드가 가운데 카드 뒤에 반쯤 겹쳐 보이고, 1/3과 「다른 병원 보기」가 있다.
- after/: 이 branch. 1280 화면은 카드 1장, 바로 옆 ‹ ›, 1/4. 휴대폰은 1/4, 옆 카드 끝만 보인다.

DEVICE_E2E=NOT VERIFIED (iPhone Safari·삼성 인터넷·카카오 인앱 실기기 미확인. Chrome 에뮬레이션만)
CORE_E2E=NOT VERIFIED (Core 무변경. 검사기는 Core 계약과 같은 가짜 응답을 쓴다)

## 겹치는 branch

- 대화·답변 UX `feature/conversation-answer-ux-01-site`(1851a70e, SITE-T55 예정)도 `site-conversation.js`를 고친다.
- 미리 병합해 본 결과(`git merge-tree`) 충돌은 asset 토큰 줄뿐이다. `createPlaceCardRail` 안의 분류 표시(`placeCategoryLabel`)도 충돌 없이 합쳐진다.
- T55가 main에 들어가면 이 branch에 main을 다시 병합하고, 토큰을 다시 만든 뒤 READY를 다시 낸다.

## 배포 후 smoke

- 데스크톱 "전주시 완산구 내과 찾아줘" → 카드 아래 1/5.
  - › 네 번이면 5/5, 한 번 더 누르면 1/5로 돈다.
  - 가운데 카드 뒤·옆에 반쯤 보이는 카드가 없다.
  - ‹ ›가 카드 바로 옆에 있다.
  - 「다른 병원 보기」가 없다.
- 휴대폰 같은 질문 → 밀어서 1/5 … 5/5. 옆 카드 끝만 살짝 보인다.
- 휴대폰에서 카드 주소 줄을 탭하면 네이버 검색이 열린다(전화 앱이 아니다).
