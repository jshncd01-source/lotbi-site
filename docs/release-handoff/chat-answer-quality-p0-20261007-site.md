READY_FOR_DEPLOY=YES

# chat-answer-quality-p0-20261007-site — release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/chat-answer-quality-p0-20261007-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ... refs/heads/feature/chat-answer-quality-p0-20261007-site`)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=a9affcd5ac887239778e37347cd4d68fbe4ad948
MAIN_MERGED=e3512a0449c43162086d65083a6774e19f3b55f9 (Calendar backdrop dismissal; 59 token-only conflicts resolved to main, merge a3653093)
CODE_SHA=3c08792ff619dc189b4d78800ae20c34dc0e3efe (feature code) / a3653093 (after main merge)
ASSET_VERSION=aset-986b22d69170

## SCOPE (LOTBI CHAT ANSWER QUALITY & MOBILE CONVERSATION UX P0, 2026-10-07)

Production iPhone 실사용 실패 D·E·G의 Site 부분.
- D 새 답변 자동 스크롤: 하단 따라가기(follow)는 독자가 직접 스크롤(드래그·휠·스크롤 키·스크롤바)했을 때만 꺼진다. iOS가 입력창을 보여주려고 하는 스크롤, 키보드 애니메이션 중 scrollTop 보정은 더 이상 follow를 끄지 않는다. 키보드 이벤트·스크롤 영역 크기 변화·입력창 높이 변화 모두 `scrollToConversationTail()` 하나로 하단을 다시 맞춘다(즉시 + 다음 프레임 + 320ms).
- E 대화 재진입/입력창 탭: 저장된 대화를 열면 최신 메시지로 간다(hydrate 후 stick). 입력창을 탭하면 최신 메시지가 입력창 바로 위에 온다. 답변 뒤 LOTBI가 하는 `prompt.focus()`는 `preventScroll`로 바꿔, 위로 올려 읽던 사람을 417px 끌어내리던 문제를 없앴다.
- G 비교 표: 파이프 표를 semantic `<table>`로 그린다(노드 단위 생성, HTML sink 없음, iOS 구버전 대비 lookbehind 미사용). `항목 | A | B`는 375px에서 가로 스크롤 없이 두 열 + 가운데 구분선, 빈 값은 '—'(aria-label 정보 없음), 3개 이상은 표 상자 안에서만 가로 스크롤(첫 열 고정, region/tabindex). 페이지 가로 스크롤 없음. 다크 테마 토큰 사용.

## TEST_STATUS

- 신규 `scripts/validate_chat_answer_quality_p0_01.mjs`(site-review 등록): DevTools protocol 실시간 측정(가상 시간 모드는 대기 중 프레임이 안 돌아 ResizeObserver를 관찰할 수 없음). 390x844 / 375x667 / 1280x900, 22턴 대화 + 출처 + 버튼, iOS식 키보드 에뮬레이션(visualViewport 높이만 축소), 늦게 커지는 콘텐츠, 키보드 닫힘, 독자가 위로 스크롤한 상태의 성장/답변 도착, 입력창 탭, 재로딩 후 재진입, 비교 표/5열 표, 페이지 가로 넘침 → 전부 PASS(하단 거리 0px, 읽던 메시지 이동 0px).
- `validate_answer_scroll_markdown_01.mjs`: 스크롤 리스너 패턴을 "독자 제스처일 때만 갱신" 계약으로 갱신(같은 의도, 더 좁은 정의).
- 전체 site-review validator(Windows 로컬, CHROME_BIN 지정): main a9affcd5 baseline 127 PASS / 4 FAIL, feature 128 PASS(신규 포함) / 4 FAIL.
  - 공통 기존 RED 3: calendar_system_dark_01, mobile_footer_legal_sheet_01, site_avatar_fallback_runtime (main 동일)
  - baseline만 FAIL: image_attachment_thumbnail_01(feature 단독 재실행 PASS)
  - feature만 FAIL: calendar_expense_summary_01 — 고정 포트 4198 서버가 병렬 실행 중 동적 import를 못 내준 일시 오류, 단독 재실행 2/2 PASS
- 내장 브라우저(390x844 에뮬레이션, 가짜 Core): 비교 표·5열 표·다크 테마·마지막 답변 버튼이 입력창 위에 보이는 것 확인. 실제 iPhone Safari 실기기는 NOT TESTED.

- main e3512a04 merge 후 재측정: main baseline 125 PASS / 6 FAIL, feature(merge) 127 PASS / 5 FAIL.
  - 공통 기존 RED: calendar_system_dark_01, image_attachment_thumbnail_01, mobile_footer_legal_sheet_01, site_avatar_fallback_runtime
  - baseline만 FAIL: calendar_holiday_surface_settings_icon_01, place_card_compact_01 (feature PASS)
  - feature만 FAIL: profile_menu_personal_theme_01 — 병렬 부하 일시 오류, 단독 재실행 2/2 PASS
  - main이 바꾼 validate_consumer_design_shell_01 / validate_message_calendar_footer_editor_01, 신규 validate_chat_answer_quality_p0_01 PASS

NEW_FAILURES=0

MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
DEPENDENCIES=Core 무변경으로도 동작(표·스크롤은 Site 단독). Core feature/chat-answer-quality-p0-20261007-core와 함께 배포하면 Core가 비교 답변을 표로 쓰도록 안내받는다. 배포 순서 무관.
POST_DEPLOY_SMOKE=iPhone Safari 실기기: 긴 대화에서 키보드 연 상태로 전송 → 출처·버튼이 입력창 위, 위로 올려 읽는 중 답변 도착 시 화면 유지, 대화 다시 열기·입력창 탭 시 최신 메시지, "A랑 B 비교해줘" 표 표시.
READY_FOR_DEPLOY=YES

USER_DECISION_NEEDED=NONE
