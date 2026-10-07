READY_FOR_DEPLOY=YES

# chat-answer-quality-p0-20261007-site — release handoff (LINUX GATE VALIDATOR FIX 02)

REPO=lotbi-site
FEATURE_BRANCH=feature/chat-answer-quality-p0-20261007-site
FEATURE_SHA=이 문서 커밋(branch HEAD)
REMOTE_FEATURE_SHA=FEATURE_SHA와 동일(`git ls-remote origin refs/heads/feature/chat-answer-quality-p0-20261007-site`로 확인)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=a3443d6574b52b452fcb0e4e4e31ee993b7b903a (9961dba2에서 정상 merge. 이전 merge e3512a04, base a9affcd5)
CODE_SHA=3cb9bb07 (validator 수정. 바로 앞이 main merge 9961dba2)
ASSET_VERSION=aset-e0e4ea7967e8

## ROOT_CAUSE

gate run 20261007T045632Z-3835168-1027928639의 `iPhone-390x844: the message being read stays where it was` (`null !== 0`)는 측정이 메시지를 못 찾은 것이다. 제품은 화면을 움직이지 않았다(`readerScrolledUp.after === before` 통과).

- 문제: `readingAnchor()`는 보이는 영역 가운데 **한 점**을 `elementFromPoint`로 찍고, 그 위에서 `.chat-message / .chat-assistant-row / time`을 찾았다.
- 측정: step 7 읽기 위치를 ±300px 범위에서 1px씩 훑었다(Windows Chrome, 390x844).
  - 601곳 중 89곳(약 15%)에서 그 점이 `#conversation-thread` 자체에 걸려 null이었다.
  - 52곳은 오른쪽 정렬된 사용자 말풍선 옆이었다(y는 사용자 메시지 안, x는 말풍선 왼쪽 빈 곳).
  - 37곳은 두 항목 사이 간격이었다.
- 어느 위치가 빈 곳이 되는지는 글꼴 metric에 따라 달라진다. 글꼴을 바꾸면 step 7의 scrollTop 자체가 6086에서 7611로 바뀐다. 그래서 Windows에서는 항목에 걸리고 글꼴이 다른 Linux gate에서는 빈 곳에 걸렸다.
- 원인은 측정 로직으로 고정했다. Linux 실행 재현은 하지 못했다(TEST_STATUS 참고).
- 같은 validator의 "답변 도착 중 읽던 메시지" 단정 `Math.abs(anchorShift) <= 2`는 anchor가 null이어도 통과하고 있었다(`Math.abs(null) === 0`).

## FIX

측정만 바꿨다. 제품 코드 변경은 필요 없었다(아래 제품 sweep 참고).
- 기준 항목을 한 점이 아니라 위치 계산으로 고른다. `#conversation-thread`의 항목(메시지·답변 행·시간 구분선) 중 보이는 영역과 겹치고 영역 가운데에 가장 가까운 것을 쓴다. 가운데가 항목 사이에 걸리면 가장 가까운 보이는 항목이 읽던 항목이다.
- 두 읽기 위치 단정(읽는 중 아래가 커짐, 읽는 중 답변 도착) 모두, 보이는 항목이 없으면 그 자체를 명확한 실패로 낸다("no conversation item was visible ... could not be measured").
- 기존 단정은 그대로 유지했다: 커짐은 `anchorShift === 0`, 답변 도착은 `|anchorShift| <= 2`. 답변 도착 쪽은 null 통과가 사라져 이전보다 엄격하다.
- gate 로그에서 무엇을 쟀는지 보이도록 결과에 `anchor`(측정한 항목 종류)를 기록한다.

## SCOPE (변경 없음, LOTBI CHAT ANSWER QUALITY & MOBILE CONVERSATION UX P0, 2026-10-07)

Production iPhone 실사용 실패 D·E·G의 Site 부분:
- D: 새 답변·키보드·크기 변화 때 대화 끝을 따라가고, 독자가 직접 스크롤할 때만 따라가기를 멈춘다.
- E: 대화를 다시 열거나 입력창을 탭하면 최신 메시지로 간다. 답변 뒤 LOTBI의 `focus()`는 `preventScroll`을 쓴다.
- G: 파이프 표를 semantic `<table>`로 그린다. A vs B 표는 375px에 맞고, 3열 이상은 표 상자 안에서만 가로 스크롤되며, 페이지 가로 스크롤은 없다.

## MERGE (main a3443d65 → 9961dba2)

- 충돌 60개 파일 중 57개는 asset token만 달랐고, 최종 tree 기준으로 재생성했다.
- `site-conversation.js`:
  - main의 fail-closed 카카오 공유를 유지했다(`copyFallback` 없음, `prepareKakaoShare`는 async boolean). 카카오 호출부는 main과 동일하다.
  - main의 `buildNaverPlaceSearchUrl` import를 유지했다.
  - 이 branch의 tail·scroll 변경도 유지했다.
- `site-person-ui.js`: main의 SafeCare `site-person-photo-intake.js` import를 유지했다.
- `.github/workflows/site-review.yml`: main의 "Validate chat answer recovery"와 이 branch의 "Validate chat answer quality P0"를 둘 다 유지했다.
- token을 빼고 main과 내용이 다른 파일은 이 branch의 7개뿐이다: validator 2개, `site-conversation.js`, `site-conversation.css`, `site-message-body.js`, workflow, 이 문서.

## TEST_STATUS

### Windows

로컬 Chrome headless, DevTools protocol 실시간 측정, merge tree 3cb9bb07 기준.

- `validate_chat_answer_quality_p0_01.mjs`: 3개 case(390x844 / 375x667 / 1280x900) 모두 PASS. anchor를 찾았고 이동 0px.
- 제품 sweep(커밋하지 않은 진단용 validator 복사본): 688회 확인, 이동 0건.
  - 조건: step 7을 읽기 위치 86곳(±300px, 7px 간격)에서 반복했다. 폰 크기 2개(390x844, 375x667) × 글꼴 4종(기본, Courier New, Verdana, Georgia).
  - 예전 한 점 측정은 실행마다 13~14곳을 놓쳤다.
  - 새 측정은 모든 위치에서 항목을 찾았다.
  - 읽던 항목이나 scrollTop이 움직인 경우는 0건이다.
- `validate_answer_scroll_markdown_01.mjs`: PASS.
- `validate_chat_*` / `validate_conversation_*` 14개 모두 PASS:
  - chat_answer_quality_p0_01, chat_answer_recovery_01, chat_layout_attachment_01, chat_media_thinking_01, chat_photo_no_forced_actions_01
  - conversation_calendar_actions_01, conversation_calendar_auto_suggest_01, conversation_calendar_card_02, conversation_calendar_result_time_01
  - conversation_integration, conversation_management_10, conversation_message_ux_final_01, conversation_sidebar_ux_01, conversation_timeline_01
- `node scripts/asset_cache_version.mjs --check`: PASS(aset-e0e4ea7967e8, targets 119, refs 143).
- `python scripts/validate_site.py`: PASS.

### Linux

NOT TESTED.
- 이 PC에는 WSL 배포판과 Docker가 없다.
- Ncloud gate 서버는 배포총괄방 장비라 쓰지 않았다.
- GitHub Actions는 GitHub push가 필요해 사용자 결정 사항이다.
- Linux에서 통과할 근거는 측정 방식이다. 기준 항목 선택이 더 이상 한 점의 위치에 좌우되지 않고, 그것을 글꼴 4종·폰 크기 2개 sweep으로 확인했다. 첫 Linux 실행은 gate가 된다.

### 실제 iPhone Safari

NOT TESTED(viewport 에뮬레이션만).

NEW_FAILURES=0

MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
DEPENDENCIES=Core 57e21ba1은 이미 Production. Site main a3443d65에 chat-search-execution-background-notify-01-site(af34fc01)가 이미 포함됨.
POST_DEPLOY_SMOKE=iPhone Safari 실기기에서 확인:
- 긴 대화에서 키보드를 연 채 전송하면 출처·버튼이 입력창 위에 보인다.
- 위로 올려 읽는 중 답변이 도착해도 화면이 유지된다.
- 대화를 다시 열거나 입력창을 탭하면 최신 메시지로 간다.
- "A랑 B 비교해줘"가 표로 보인다.
READY_FOR_DEPLOY=YES

USER_DECISION_NEEDED=NONE
