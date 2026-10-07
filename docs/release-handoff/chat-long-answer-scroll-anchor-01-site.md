READY_FOR_DEPLOY=YES

# chat-long-answer-scroll-anchor-01-site — release handoff

TASK=LOTBI CHAT — LONG ANSWER SCROLL ANCHOR UX FIX P0
REPO=lotbi-site
FEATURE_BRANCH=feature/chat-long-answer-scroll-anchor-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD; `git ls-remote origin refs/heads/feature/chat-long-answer-scroll-anchor-01-site`로 확인)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=a87aafb97fa6ae665518afa52e4d9800eb628017 (8d8e617f에서 정상 merge. 그 전 0a03ca12를 be6a8918에서 merge. 첫 base 8a9e414d)
CODE_SHA=8d8e617f
ASSET_VERSION=aset-186a88a08d14
MERGED_TO_MAIN=NO
DEPLOYED=NO
CORE_CHANGE=NONE
APP_CHANGE=별도 branch feature/chat-long-answer-scroll-anchor-01-app (lotbi-app). Site와 배포 순서 제약 없음.
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO

## 원인 (main 8a9e414d 실측)
- 질문을 보내면 `appendNode(..., {forceScroll: true})`가 맨 아래 따라가기(follow)를 켰다.
- 답변이 오면 `followThreadBottom || isThreadNearBottom()`이면 다시 맨 아래로 보냈고, 이미지·카드가 늦게 커져도 ResizeObserver가 계속 맨 아래로 끌었다.
- 그래서 긴 답변은 마지막 줄까지 화면이 내려갔다. 같은 시나리오를 main에서 재면(375x667, 이전 대화 6턴 뒤):
  - 1,000자 답변: 질문이 읽기 영역 위로 1,523px 밀려남
  - 3,000자 답변: 4,557px 밀려남

## 무엇을 바꿨나 (site-conversation.js, site-conversation.css)
1. 질문 전송 직후: 보낸 질문을 읽기 영역 맨 위(상단 바 아래 12px)에 놓고 붙잡는다(anchor). 답변은 그 바로 아래에서 시작한다.
2. 짧은 답변일 때 질문이 위로 갈 자리가 없으면 thread 아래 빈 공간(`.conversation-turn-space`)을 모자란 만큼만 만든다. 답변이 자라면 그만큼 줄고, 답변 완료 뒤에도 유지한다(없애면 화면이 아래로 당겨지므로).
3. 답변·카드·이미지가 자라는 동안(streaming 포함) 맨 아래를 따라가지 않는다. 질문 위치가 유지된다.
4. 독자가 위로 스크롤하는 순간 따라가기를 즉시 끈다(72px 안이라도). 끝까지 직접 내리면 그때부터 새 내용을 따라간다.
5. `↓ 최신 답변` 버튼: 아래에 120px 넘게 더 있을 때 입력창 바로 위에 뜬다. 누를 때만 최신 답변으로 이동하고, 그 뒤로는 따라간다.
6. 답변 완료(생각 중 표시 제거, 답변 추가, LOTBI의 입력창 재포커스)로는 위치가 바뀌지 않는다.
7. 다음 질문을 보내면 새 질문이 새 anchor가 된다.
8. 키보드 열림/닫힘: 붙잡은 질문은 그대로 맨 위. 답변 중간을 읽던 경우, 입력창을 누를 때 브라우저가 sticky 입력창을 "보여 주려고" 대화를 움직이면(Chrome 실측 394px) 읽던 줄로 되돌린다.
9. 페이지 자체가 스크롤을 옮기면(장소 카드 scrollIntoView, 페이지 내 찾기 등) 고정을 풀고 그 자리를 둔다. 다음 크기 변화 때 질문으로 끌어당기지 않는다.
10. 대화 열기/새로고침 복원은 이전처럼 최신 메시지로 간다. 답이 아직 안 온 질문을 복원하면 그 질문을 anchor로 잡는다.

금지 항목 확인: `scrollIntoView({block:'end'})` 없음, token·completion마다 bottom 이동 없음, 독자 수동 스크롤 덮어쓰기 없음(새 validator 정적 검사 포함).

## 동작 변경 (확인 권장, 차단 아님)
- 입력창 탭 → 최신 메시지 강제 이동을 없앴다. 이전 SITE-CHAT-ANSWER-QUALITY-P0(E)의 "입력창을 누르면 최신 메시지로"는 이번 지시의 "사용자가 누를 때만 최신 답변 위치로 이동"과 충돌한다. 이제 입력창을 눌러도 읽던 위치가 유지되고, 끝은 `↓ 최신 답변`으로 간다. 이미 맨 아래를 따라가던 독자는 키보드가 열려도 끝이 보인다(기존과 같음).
- 375x667에서 키보드가 열린 채 짧은 답변을 받으면 답변 아래 액션 줄이 입력창 밑에 걸릴 수 있다(질문+답변 시작 우선). 이전 P0(D)의 "액션 줄까지 보이기"보다 이번 계약을 우선했다.

## 테스트 (Windows, Chrome headless, `CHROME_BIN=C:/Program Files/Google/Chrome/Application/chrome.exe`, CODE_SHA 기준)
### 새 validator `scripts/validate_chat_long_answer_scroll_anchor_01.mjs` — PASS (375x667 / 390x844 / 1280x900)
scrollTop 숫자가 아니라 화면상 항목 위치(질문, 답변 첫 줄, 읽던 항목)를 잰다.
| 항목 | 결과 |
|---|---|
| 짧은 답변: 전송 직후·완료 후 질문이 맨 위(12px), 답변 전체 보임, 버튼 없음 | PASS |
| 1,000자+ Markdown / 3,000자+ (굵게·목록·문단): 질문 맨 위 유지, 답변 첫 줄 보임, 끝까지 끌려가지 않음, 버튼 표시 | PASS |
| 목록 답변(6항목), 장소 카드 carousel | PASS |
| streaming 중 위로 스크롤: 이후 블록 18개가 붙어도 읽던 항목 이동 0px | PASS |
| streaming 중 끝까지 내림: 이후 블록마다 맨 아래 유지(0px) | PASS |
| `↓ 최신 답변`: 누르면 맨 아래, 이후 따라감 | PASS |
| 답변 완료 순간: 붙잡은 질문 이동 0px, 기다리며 위로 스크롤한 독자 이동 0px | PASS |
| 다음 질문: 새 질문이 맨 위 | PASS |
| 키보드 열기(입력창 탭)/닫기: 질문 맨 위 유지, 답변 중간 읽던 줄 이동 0px | PASS (모바일 2종) |
| 페이지 자체 scrollIntoView 뒤 성장: 읽던 항목 이동 0px | PASS |
| 가로 스크롤 없음 | PASS |

### 기존 validator를 새 계약으로 수정
- `validate_chat_answer_quality_p0_01.mjs`: "보낸 뒤 맨 아래" 단정 4곳 → "질문 맨 위 + 답변 시작 보임 / 읽던 항목 유지 / 입력창 탭은 끌어내리지 않음". 재진입 시 최신 메시지, 위로 스크롤한 독자 유지, 표 렌더링 단정은 그대로. PASS.
- `validate_answer_scroll_markdown_01.mjs`, `validate_mobile_home_ux_stability_01.mjs`: 이름이 바뀐 코드(`keepReadingPosition`, `anchorTurn`)에 맞춘 정적 검사. PASS.
- CI(`site-review.yml`)에 새 validator 단계 추가.

### 전체 chat/site regression (site-review.yml + legal-pages-review.yml + site-universal-life-calendar-01.yml의 node/python 명령 전부)
CODE_SHA 8d8e617f 기준 208개 실행: **203 PASS / 5 FAIL — 5건 모두 이 변경과 무관(아래 근거)**.
| FAIL | 근거 |
|---|---|
| validate_mobile_footer_legal_sheet_01 | main 기준선 8a9e414d에서도 같은 `761px: mobile disclosure leaked into desktop`로 실패(Windows) |
| validate_site_avatar_fallback_runtime | main 기준선에서도 같은 `assert(!this.paused)`(Node 24 undici)로 실패 |
| validate_calendar_system_dark_01 | main 기준선에서도 같은 `system-dark mirror is stale`로 실패(Windows 체크아웃) |
| validate_image_attachment_thumbnail_01 | 정규식이 `
`을 기대하는데 Windows 작업본이 CRLF. 커밋된 내용(LF)으로 꺼내 실행하면 PASS |
| validate_profile_menu_improvement_01 | 부하 중 Chrome 비정상 종료. 단독 재실행 PASS(직전 전체 실행에서도 PASS) |

같은 회귀를 be6a8918(main 0a03ca12 merge)에서도 돌렸다: 202 PASS / 6 FAIL. 위 4건 + 부하 중 시간 초과 2건(`validate_conversation_calendar_card_02`, `validate_place_card_compact_01`), 둘 다 단독 재실행 PASS.
`validate_place_card_carousel_no_drift_01`은 개발 중 이 변경 때문에 실패했다(질문 고정 중 카드 scrollIntoView를 되돌려 412x915에서 탭이 카드 링크에 떨어짐). 외부 스크롤이면 고정을 푸는 처리로 고쳤고 지금은 PASS다.

## 병렬 branch와의 관계
- `feature/chat-mobile-keyboard-dismiss-reading-view-01-site`(e26e2896, 다른 세션, 같은 파일)와 시험 merge: 59개 충돌이 모두 asset token 줄뿐(자동 정리), 코드 충돌 0.
  - 합친 결과에서 PASS: `validate_chat_long_answer_scroll_anchor_01`, `validate_chat_mobile_keyboard_dismiss_01`, `validate_chat_answer_quality_p0_01`, `validate_answer_scroll_markdown_01`, `validate_mobile_home_ux_stability_01`, `validate_chat_answer_recovery_01`, `validate_place_card_carousel_no_drift_01`.
  - 두 branch를 같은 release에 넣을 때: 충돌 hunk만 한쪽 token을 택하고 `node scripts/asset_cache_version.mjs --write`. 파일 전체 `checkout --ours/--theirs` 금지.
  - 시험 merge는 임시 worktree에서만 했고 push하지 않았다.

## NOT TESTED / 한계
- 실제 iPhone Safari·Android Chrome·Samsung Internet 실기기: NOT TESTED. 키보드는 가짜 visualViewport(iOS식) 에뮬레이션이다.
- Linux gate(Ncloud): NOT TESTED (이 PC에 WSL·Docker 없음). 측정은 글꼴과 무관한 위치 비교로 짰다.
- Production: 미배포라 NOT VERIFIED.

USER_DECISION_NEEDED=NONE (입력창 탭 동작 변경은 위 "동작 변경"에 기록, 되돌리려면 한 줄 수정)
