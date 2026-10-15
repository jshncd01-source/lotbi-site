READY_FOR_DEPLOY=YES

# calendar-workspace-backdrop-dismiss-01 — release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/calendar-workspace-backdrop-dismiss-01
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ... refs/heads/feature/calendar-workspace-backdrop-dismiss-01`)
REMOTE_FEATURE_SHA=same as FEATURE_SHA after push (verified with git ls-remote at push time)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=a9affcd5ac887239778e37347cd4d68fbe4ad948
CODE_SHA=653b00c638d746d69bef5ee46997bcf3e4fe9e6d
ASSET_VERSION=aset-abe91ceb2004

CHANGED_TEST_EXPECTATIONS=validate_consumer_design_shell_01.mjs: 최신 main의 `Calendar must remain an overlay over the chat` 및 `modal: true` 단정을 그대로 유지하고, openCalendar 모달에 `dismissOnBackdrop: false`가 있어야 한다는 단정을 추가했다. 이전 feature의 `workspace: 'calendar'` 단정은 최신 main의 대화 위 모달 제품 계약과 충돌하므로 제거가 아니라 현재 계약에 맞춘 동등 이상의 회귀 단정으로 교체했다. validate_message_calendar_footer_editor_01.mjs: 실제 Chrome 375px를 추가하고 모달 안쪽 빈 공간·바깥 backdrop 클릭 시 유지, 표준 `캘린더 닫기` 버튼과 Esc로 종료, 종료 후 대화 보존을 검증한다.

TEST_STATUS=PASS — asset check, validate_site.py, validate_hardening.py, validate_accessibility.py, validate_mobile_entry.js, validate_consumer_design_shell_01.mjs, validate_calendar_modal_runtime_02.mjs, validate_message_calendar_footer_editor_01.mjs 및 calendar/conversation 관련 validator 58개 전체 최종 PASS. CHROME_BIN=`C:/Program Files/Google/Chrome/Application/chrome.exe`로 브라우저 validator를 순차 실행했다. 실제 Chrome 375x812에서 안쪽 여백·바깥 backdrop 클릭 유지, 닫기 버튼·Esc 종료, 대화 보존 PASS.
NEW_FAILURES=NONE — 전체 순차 실행 중 이미 통과한 modal runtime을 즉시 재실행하면서 고정 포트가 한 번 겹쳐 동적 import가 실패했으나, 단독 재실행 PASS 후 남은 validator도 모두 PASS.
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
READY_FOR_DEPLOY=YES

USER_DECISION_NEEDED=NONE

