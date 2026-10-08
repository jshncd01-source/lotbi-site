READY_FOR_DEPLOY=NO
READY_STATUS=SUPERSEDED_BY_INTEGRATED_LONG_ANSWER_BRANCH
SUPERSEDED_BY=docs/release-handoff/chat-long-answer-scroll-anchor-01-site.md

# chat-mobile-keyboard-dismiss-reading-view-01-site — release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/chat-mobile-keyboard-dismiss-reading-view-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD)
REMOTE_FEATURE_SHA=FEATURE_SHA와 동일(`git ls-remote origin refs/heads/feature/chat-mobile-keyboard-dismiss-reading-view-01-site`로 확인)
SUPERSEDES=e26e289612662668f8e9020f2db952f44ba14fce (SITE-T16 Linux gate에서 validator 타이밍으로 FAIL)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=c9c19e4cef9914f0b50d4870cbcc59e58602ddc2 (SITE-T20, f6603a68에서 정상 merge. 지시 시점 843a667b 이후 전진. 첫 base 0a03ca12)
CODE_SHA=f6603a68
ASSET_VERSION=aset-639080af4f23
PRODUCT_CODE_CHANGED_IN_GATE_FIX_03=NO (site-conversation.js 키보드 동작은 그대로. 바뀐 것은 validator 1개와 main merge뿐)
ROOT_CAUSE=제품이 아니라 validator 타이밍. "답변 오기 전" 상태(A sentWaiting)를 가짜 Core의 고정 900ms 지연과 경주시켜 쟀다. 전송 → settle(키보드 애니메이션 대기+프레임+400ms) → snap이 900ms를 넘으면 답변이 이미 도착해 loading=0·answers=1로 측정된다. Linux gate(2 core)는 그보다 느렸다. gate 측정값(키보드 닫힘·포커스 해제)은 정상이었다. 같은 구조의 E·F(3500ms)와 "작성 중 답변 도착"(2000ms)도 같은 경주였다.
CHANGED_TEST_EXPECTATIONS=단정 삭제·완화 없음. 측정 방식만 "고정 지연과 경주" → "답변 보류 후 측정, 측정 뒤 명시적 해제"(holdAnswers/releaseAnswers). 측정 전 생각 중 표시가 뜰 때까지 대기(최대 10초). 강화한 단정: A 질문이 Core에 도착해 보류 중(held=1), E 느린 질문 보류 중(held=1), E 실행 중 Enter가 Core 요청을 하나도 만들지 않음(held=1·요청 수 동일), F 답변 대기 중에 키보드가 닫힘(held=1·loading=1), E 답변이 오기 전에 이미 작성 중이었음(held=1·loading=1·포커스·키보드). 느린 환경 재현용 env `LOTBI_VALIDATOR_CPU_THROTTLE`(미설정이면 영향 없음).
SLOW_ENV_REPRO=Windows Chrome 154 + CDP Emulation.setCPUThrottlingRate. 수정 전 validator: x1·x4·x6·x10 PASS, x20 FAIL — iphone-safari-390x844·samsung-android-412x915 "the answer is still on its way"(sentWaiting answers=1 loading=0, gate와 같은 신호) + E/F 3건(Enter while a turn runs, F draft survives). 수정 후: x1 PASS, x20 PASS(모바일 3개 모두 sentWaiting/slowSent/writingBeforeAnswer loading=1·held=1). long-answer 통합 a34e838c와 합친 상태에서도 x20 PASS. Linux 자체 실행은 이 PC에 WSL·Docker가 없어 NOT TESTED.
LONG_ANSWER_TRIAL_MERGE=지시의 f296c4ce는 이미 대체됐고, 현재 long-answer remote a34e838c가 키보드 e26e2896과 main c9c19e4c를 포함한 통합 READY다. a34e838c에 이 branch(f6603a68)를 임시 worktree로 merge(push 안 함): 충돌 59개 모두 asset token, 결과는 a34e838c 대비 이 validator 1개만 다름(asset token 동일). 그 상태에서 chat_mobile_keyboard_dismiss_01·chat_long_answer_scroll_anchor_01·chat_answer_quality_p0_01·site_refresh_route_restore_01·conversation_message_ux_final_01·mobile_home_ux_stability_01 + mobile_composer_keyboard_layout_01 7/7 PASS.
INTEGRATED_BRANCH_NOTE=long-answer 통합 READY a34e838c는 옛 validator(e26e2896과 동일)를 담고 있어 Linux gate에서 같은 이유로 실패할 수 있다. release에서 두 branch를 함께 merge하면 3-way merge로 이 branch의 새 validator가 들어간다(long-answer 쪽은 이 파일을 바꾸지 않음). a34e838c 단독 배포라면 이 validator 커밋(3ccbbf06)을 먼저 그 branch에 merge해야 한다.
TEST_STATUS=아래 GATE FIX 03 절
NEW_FAILURES=NONE
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
CORE_CHANGED=NO
PRODUCTION_DEPLOYED=NO
USER_DECISION_NEEDED=NONE

커밋(e26e2896 이후): 3ccbbf06 validator 답변 보류 방식 → f6603a68 main c9c19e4c merge → 이 문서.

---

## GATE FIX 03 — Linux merge gate 반환 (SITE-T16, run 20261007T121625Z-4128521-80833861)

### 증거
- `validate_chat_mobile_keyboard_dismiss_01.mjs`: `iphone-safari-390x844: the answer is still on its way`, `samsung-android-412x915: the answer is still on its way`.
- 같은 run의 sentWaiting: loading=0 answers=1 focused=false kbOpen=false visibleHeight=844 → 제품 동작(키보드 닫힘·포커스 해제)은 정상이었고, 측정 시점이 답변 도착 뒤였다.

### 고정 지연을 쓰던 측정 전부 정리
| 단계 | 전 | 후 |
|---|---|---|
| A 전송 직후 (sentWaiting) | setDelay(900)과 경주 | 답변 보류 → 생각 중 표시 대기 → 측정 → 해제 |
| E·F 느린 답변 중 탭·초안·Enter·키보드 닫기 | setDelay(3500)과 경주 | 보류 상태에서 전 단계 측정 → 해제 |
| E 작성 중 답변 도착 | setDelay(2000)과 경주(작성이 먼저였는지 미확인) | 보류 → 작성 시작 확인(held=1·loading=1·키보드) → 해제 → 답변 후 측정 |

### 느린 환경 재현 (CPU 감속, iPhone 390x844 + Samsung 412x915)
| CPU 감속 | 수정 전 | 수정 후 |
|---|---|---|
| x1 | PASS | PASS (4 케이스) |
| x4 / x6 / x10 | PASS | — |
| x20 | **FAIL**: A "the answer is still on its way"(answers=1 loading=0) ×2, E Enter while running ×2, F draft ×1 | PASS (4 케이스, held=1·loading=1) |

### 회귀 (Windows, Chrome 154, `CHROME_BIN=C:/Program Files/Google/Chrome/Application/chrome.exe`, CODE_SHA 기준, scripts/validate_* 213개 직렬)
전체 213개: 204 PASS / 9 FAIL — 9건 모두 이 branch와 무관(아래 근거). 실행 중 PC는 다른 세션의 validator 동시 실행으로 CPU 100%(Chrome 75~107개)였다.
| FAIL | 근거 |
|---|---|
| validate_mobile_footer_legal_sheet_01 | main c9c19e4c 기준선에서도 같은 `761px: mobile disclosure leaked into desktop` |
| validate_site_avatar_fallback_runtime | main 기준선에서도 같은 Node 24 undici assert |
| validate_calendar_system_dark_01, validate_image_attachment_thumbnail_01 | Windows CRLF 체크아웃 문제. 같은 커밋을 LF로 꺼낸 worktree에서 둘 다 PASS |
| validate_pinned_conversation_section_01, validate_theme_auto_schedule_02 | 단독 재실행 PASS |
| validate_message_calendar_footer_editor_01, validate_calendar_touch_monthnav_daysheet_01 | `Failed to fetch dynamically imported module`(모듈 로드 실패). 수정본 단독 재실행 PASS(footer_editor 재시도 1회째, calendar_touch 2회째). footer_editor는 main 기준선도 같은 부하에서 같은 오류로 1회 FAIL. calendar_touch는 기준선에서는 3/3 PASS였지만 오류 종류가 부하성 모듈 로드 실패와 같음 |
| validate_place_card_compact_01 | 같은 오류가 매번 다른 경우(344·360·412·760, 지도 앱 종류도 다름)에서 무작위로 남. 고정 포트를 바꾼 복사본(저장소 밖)에서도 같아 포트 충돌은 아님. main c9c19e4c 기준선도 같은 조건에서 5번 중 4번 같은 오류로 FAIL → 이 PC 부하 문제. 이전 gate·저부하 Windows 실행에서는 PASS |
키보드·대화 관련 직접 영향군은 전부 PASS: chat_mobile_keyboard_dismiss_01, chat_answer_quality_p0_01, answer_scroll_markdown_01, chat_answer_recovery_01, composer_interaction, composer_auto_grow, user_bubble_content_fit, conversation_message_ux_final_01, mobile_home_ux_stability_01, site_refresh_route_restore_01.

### 남은 한계 (변경 없음)
- iPhone Safari·Samsung Internet·KakaoTalk 인앱·Android Chrome 실기기 smoke는 배포 후 필요(NOT VERIFIED).

---

## SCOPE

- 모바일에서 질문을 보낸 뒤에도 소프트 키보드가 열린 채 남아 답변 읽을 공간이 줄던 문제.
- 변경: `site-conversation.js`(전송 경로·턴 종료 포커스), 새 validator, workflow step, asset token 재계산. CSS·Core 변경 없음.
- 범위 밖(별도 owner): 긴 답변에서 질문/답변 시작 읽기 위치 고정(bottom-follow 중단)은 병렬 작업 **CHAT-LONG-ANSWER-SCROLL-ANCHOR-01** (`feature/chat-long-answer-scroll-anchor-01-site`, 2026-10-07 19:26 기준 미push, 같은 파일의 appendNode·scroll listener·ResizeObserver·composer pointerdown 담당)이 구현 중이라 이 branch에서 중복 구현하지 않음. 아래 COMBINED 결과 참조.

## ROOT_CAUSE

1. 전송 경로 어디에도 입력창 blur가 없었다. 키보드의 Enter 전송, iPhone Safari의 전송 버튼 탭(Safari는 버튼이 포커스를 가져가지 않음)은 textarea 포커스를 그대로 남겨 키보드가 계속 열려 있었다.
2. 답변·오류·시간초과로 턴이 끝날 때마다 `focusComposerInPlace()`/`prompt.focus()`가 입력창에 다시 포커스를 줬다. Android에서 전송 버튼 탭으로 키보드가 닫혀도(버튼이 포커스를 가져감) 답변 도착 시 다시 열렸다(main 측정: 키보드 열림 1→2→3회, 사용자가 닫은 뒤에도 재오픈).
3. (범위 밖) 긴 답변 bottom-follow — 위 ANCHOR 작업 담당.

## CHANGE

- `sendFromReader(startTurn)`: 입력창 전송(Enter·버튼·음성 자동전송)과 오류의 `다시 시도`가 **실제로 턴을 시작했을 때만**(requestAssistant가 동기적으로 turn generation을 올림 = 질문 표시+요청 시작) 키보드를 닫는다. 빈 메시지·공백·전송 중·업로드 중에는 턴이 안 생기므로 아무것도 바꾸지 않는다.
- `dismissComposerKeyboard()`: `(pointer: coarse)` 또는 `body.mobile-keyboard-open`(home-shell.js의 visualViewport 판정)일 때만 `prompt.blur()`. 데스크톱(마우스) 동작 불변.
- `returnComposerFocusAfterTurn()`: 답변 완료·오류·시간초과·로컬 즉시응답 후 재포커스는 데스크톱에서만. 모바일은 사용자가 직접 입력창을 탭해야만 키보드가 다시 열림. 사용자가 답변 대기 중 다시 탭해 쓰고 있으면 그대로 둠(blur 안 함, 초안 유지).
- visualViewport: 새 타이머 없음. 키보드가 닫히며 스크롤러가 커지는 것은 기존 ResizeObserver(스크롤러·composer 관찰)와 home-shell.js의 visualViewport resize→rAF 흐름이 레이아웃 반영 후 처리.

## TEST_STATUS

FOCUSED_TEST_STATUS=PASS — `scripts/validate_chat_mobile_keyboard_dismiss_01.mjs`(신규, workflow step 추가)
- CDP 실제 입력: 터치 탭, `Input.insertText`, Enter 키. 키보드는 포커스를 따라감:
  - ios-visual(375x812 KakaoTalk iOS UA, 390x844 iPhone Safari UA): 레이아웃 높이 고정, visualViewport만 6프레임에 걸쳐 비동기로 줄고/늘어남(blur 직후엔 옛 높이)
  - android-resize(412x915 Samsung Internet UA): 테스트 프로세스가 viewport 자체를 3단계로 리사이즈(innerHeight·실제 visualViewport 변화)
  - desktop 1280x900 마우스
- A 전송 버튼(iPhone식, 포커스 유지)·Enter·전송 버튼 탭(Android식) → 답변 도착 전부터 포커스 해제·키보드 닫힘·전체 높이 복구
- B 읽기 영역이 키보드 높이만큼 증가, 질문+답변 시작 화면 안
- C 1,000자+ / D 3,000자+ → 키보드 없음, 완료 후 1.2초간 이동 없음, 사용자가 위로 읽는 위치 이동 0px
- E 대기 중 입력창 탭 → 키보드 다시 열림, 전송 중 Enter는 아무것도 안 보내고 키보드·초안 유지, 답변이 와도 쓰던 키보드·초안 유지
- F 대기 중 키보드 다시 닫기 → 보던 메시지 화면 안 유지, 완료 시 재오픈 없음
- G 빈 Enter·비활성 버튼·공백 → 포커스·키보드 그대로, 전송 0
- H 오류(503) → 키보드 닫힘·`다시 시도` 활성·입력창 탭으로 재입력 가능, `다시 시도`도 전송으로 취급
- I 장소 카드 / K 약국(NMC, 의료 상태 줄) / J 목록 Markdown / L 캘린더 후보 카드 → 키보드 닫힌 뒤 composer 화면 하단, 페이지 이중 스크롤 0, 가로 스크롤 0, 카드 레일 화면 안
- 데스크톱: Enter·버튼·긴 답변·오류 후 커서 입력창 유지(기존 동작)
- 같은 테스트(정적 계약 제외)를 main 0a03ca12에 실행 → 모바일 3개 화면 각 43건 FAIL(전송 후 포커스·키보드 유지, 완료 시 재오픈), 데스크톱 0건 = 결함 재현 및 데스크톱 동일 확인
- 내장 브라우저 375x812 모바일 터치 에뮬레이션 수동 확인: 탭→입력→Enter → focusout, 답변 후 재포커스 없음. 데스크톱 폭에서는 커서 유지.

REGRESSION: workflow node/python 검증 170개 — 이 branch 실패는 main과 같은 메시지로 실패하는 기존 Windows RED 3건뿐
(validate_mobile_footer_legal_sheet_01, validate_site_avatar_fallback_runtime, validate_calendar_system_dark_01). validate_place_card_compact_01은 병렬 실행 중 고정 포트 4213 "Failed to fetch dynamically imported module"로 1회 흔들렸고 단독 재실행 PASS.
대화·스크롤 관련 PASS: chat_answer_quality_p0_01, answer_scroll_markdown_01, chat_answer_recovery_01, composer_interaction, composer_auto_grow, user_bubble_content_fit, conversation_message_ux_final_01, mobile_home_ux_stability_01, sidebar_viewports_04 등.
NEW_FAILURES=0

COMBINED (시험 결합, push 안 함): 이 branch 39dba787 + ANCHOR 작업 폴더의 미커밋 diff(19:22 시점) 적용 → 충돌은 asset token 줄 8곳뿐(로직 hunk 자동 병합)
- validate_chat_mobile_keyboard_dismiss_01 PASS, validate_chat_long_answer_scroll_anchor_01 PASS, answer_scroll_markdown_01 PASS, mobile_home_ux_stability_01 PASS
- validate_chat_answer_quality_p0_01 FAIL — ANCHOR 쪽 정적 계약 regex(keyboard-viewport listener 첫 줄)가 ANCHOR 자기 코드(`settleViewport(700)` 선행)와 안 맞음. ANCHOR 작업 폴더 단독에서도 동일하게 불일치 → ANCHOR 작업 중 상태, 이 branch 무관.
- workflow step은 ANCHOR 삽입 위치(P0 step 뒤)와 10줄 이상 떨어진 곳(focus ring step 뒤)에 넣어 충돌 회피.

NOT_VERIFIED (실기기 smoke 필요, Production 배포 후):
- iPhone Safari: 전송 후 키보드 닫힘, 닫힐 때 화면 점프·composer 위치·이중 스크롤 없음(iOS의 레이아웃 viewport 스크롤 복귀는 에뮬레이션 불가)
- Samsung Internet: 동일
- KakaoTalk 인앱(iOS/Android): 동일 + 답변 완료 시 키보드 재오픈 없음(WebView는 script focus로 키보드가 열릴 수 있던 환경)
- Android Chrome: 전송 버튼 탭 후 답변 도착 시 재오픈 없음
- 참고: iPad처럼 coarse pointer + 하드웨어 키보드 환경도 전송 후 커서가 빠짐(다음 질문은 입력창 탭 필요)

CORE_CHANGED=NO
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
DEPENDENCIES=없음(단독 배포 가능 — 단독이면 키보드는 닫히고 긴 답변 위치는 현재 Production과 같은 bottom-follow). 완전한 읽기 UX는 ANCHOR branch와 함께 배포 권장, 순서 무관, merge 시 asset token 충돌은 재계산으로 해결.
PRODUCTION_DEPLOYED=NO
USER_DECISION_NEEDED=NONE
