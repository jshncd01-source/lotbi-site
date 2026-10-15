READY_FOR_DEPLOY=YES

# chat-search-background-answer-notify-01-site — release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/chat-search-execution-background-notify-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote origin refs/heads/feature/chat-search-execution-background-notify-01-site`)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=e3512a04 (main 93fee0d2 merged normally before READY; asset token aset-fdc940f80beb)
CODE_SHA=c6cfce00

## SCOPE (LOTBI CHAT SEARCH EXECUTION + BACKGROUND ANSWER COMPLETION NOTIFICATION P0, 2026-10-07)

Site 부분 = 답변 도착 전에 나간 사용자의 재진입 복구 + 대화 deep link. Web Push 연결은 이번 범위에 없음(아래 WEB_PUSH).
- 질문을 보내기 전에 그 요청(같은 Idempotency-Key·본문)을 localStorage `lotbi.site.ux.v1.pending-turns.<namespace>`에 기록하고, 답변을 화면에 그리거나 최종 오류를 보여준 뒤 지운다. 30분이 지난 기록은 버린다.
- 탭을 닫거나 다른 앱으로 갔다가 돌아오면(대화 복원 완료, visibilitychange visible, pageshow, 사이드바에서 그 대화 선택) 마지막 사용자 질문에 답이 없을 때만 같은 key로 다시 요청한다. Core는 그 key로 이미 끝낸 답을 저장해 두었다가 그대로 돌려준다(기존 Core main 동작, 이 branch의 Core 변경 불필요). Core가 아직 처리 중(409 AI_REQUEST_IN_FLIGHT / GUEST_AI_REQUEST_IN_PROGRESS)이면 2.5초 간격 최대 24회 다시 묻는다. 답은 한 번만 그려진다.
- `/?conversation=thread-...`로 들어오면 그 대화를 연다(앱/알림·공유 링크용 deep link). 없는 id는 무시.
- 게스트·로그인 모두 동작(게스트는 브라우저 저장소의 자기 대화만).

## TEST_STATUS

- 신규 `scripts/validate_chat_answer_recovery_01.mjs`(실제 Chrome, CDP 실시간): 떠났다 돌아오기(첫 재요청 409 → 다음 재요청 답변, 같은 key, 한 번만 표시), 최종 오류 시 기록 삭제, deep link — OK. `.github/workflows/site-review.yml`에 "Validate chat answer recovery" 등록.
- validator 전체(Windows 로컬, Chrome headless): baseline main 127 PASS / 4 FAIL, feature 127 PASS / 5 FAIL → 늘어난 1건은 신규 validator의 CRLF 읽기 문제로 c6cfce00에서 수정, 단독 PASS. 공통 RED 4건(main에서도 실패, 이 branch 무관): calendar_system_dark_01, image_attachment_thumbnail_01, mobile_footer_legal_sheet_01, site_avatar_fallback_runtime. 병렬 부하에서만 흔들리는 profile_menu, calendar_expense는 단독 PASS.
- `node scripts/asset_cache_version.mjs --check` PASS.
- 모바일 viewport 에뮬레이션 기준이며 실제 iPhone Safari / Android Chrome 실기기는 NOT TESTED.

NEW_FAILURES=0

## MERGE_NOTE (미merge 1차 branch와의 관계)

`feature/chat-answer-quality-p0-20261007-site`(280bc26c, READY, 미merge)와 시험 merge 결과:
- 충돌 60개 파일 중 58개는 asset token(`?v=aset-...`)만 다름, `site-person-ui.js`는 main 93fee0d2가 추가한 import 줄(이 branch 쪽 채택), `.github/workflows/site-review.yml`은 두 validator 단계 모두 유지.
- 해소법: 충돌 hunk만 이 branch 쪽 채택(파일 전체 `--ours` 금지 — 1차 branch의 스크롤 변경이 사라짐) + workflow 두 단계 유지 → `node scripts/asset_cache_version.mjs --write`.
- 그렇게 해소한 트리에서 validate_chat_answer_recovery_01, validate_chat_answer_quality_p0_01, validate_answer_scroll_markdown_01, asset_cache_version --check 모두 PASS(시험 worktree는 삭제, push 없음).
- 어느 쪽을 먼저 merge해도 되며 두 번째 merge 때 위 절차가 필요하다.

MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
WEB_PUSH=NOT WIRED. VAPID 기반 Web Push는 출발 알림 전용 worker에만 있고 Notification Center와 연결돼 있지 않아 이번에 연결하지 않았다. Site는 재진입 복구로 답을 잃지 않게 한다(알림은 오지 않음).
DEPENDENCIES=없음(현재 Core main의 key replay로 동작). Core feature/chat-search-execution-background-notify-01-core와 배포 순서 무관.
POST_DEPLOY_SMOKE=로그인·게스트 각각: 긴 질문 전송 직후 탭 닫기 → 30초 뒤 lotbiai.com 재방문 → 같은 대화에 답이 한 번만 보이는지. 전송 직후 다른 탭으로 갔다 돌아오기. `/?conversation=<사이드바 대화 id>` 열기. 네트워크 탭에서 재요청의 Idempotency-Key가 처음과 같은지.
READY_FOR_DEPLOY=YES

USER_DECISION_NEEDED=NONE (Web Push를 Notification Center에 연결할지는 별도 과제로 결정)
