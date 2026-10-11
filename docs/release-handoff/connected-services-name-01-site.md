READY_FOR_DEPLOY=YES

# connected-services-name-01-site — release handoff (QA 일괄보고 01 #5)

REPO=lotbi-site
FEATURE_BRANCH=feature/connected-services-name-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ssh://lotbi-ncloud-git/srv/git/repositories/lotbi-site.git refs/heads/feature/connected-services-name-01-site`)
BASE_MAIN_SHA=afb7057d1d8c149e2b46eb1d656b1049e36b831d (Ncloud site main, push 직전 확인)
CODE_SHA=fa60218a4e3a787e3609888b9e6c5347c4f9d99b (토큰 갱신; 실제 #5 수정 커밋은 dc2e147285e06ef943c4e99a1f471aabd9818848)
ASSET_VERSION=aset-cb1e2d5d19ae
INCLUDES=feature/common-ui-polish-01-site 코드(a06959d8 = 8건 + main afb7057d). 그 branch READY 문서는 포함하지 않음
DEPLOY_SCOPE=lotbi-site only. Core·Web 무변경 (Account 쪽 이름은 원래 '연결 서비스')
DEPLOY_ORDER=이 branch 하나로 8건 + #5가 같이 나감. 8건 branch만 먼저 나가도 충돌 없음(이 branch가 그 위)
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
CONSENT_HASH_CHANGED=NO (subscribe.html은 잠금 대상 아님, privacy·terms 무변경)
USER_DECISION_NEEDED=NONE (소유자 결정 2026-10-10 "연결서비스로 통합" = A안 반영)

## 변경

같은 목적지(account.lotbiai.com/connected-services, 제목 '연결 서비스')를 ☰는 '제휴몰', 계정 메뉴는 '연결 서비스'로 불러 이름이 둘이었다(QA #5).

- `index.html`: ☰ 주요 메뉴(데스크톱·모바일 2곳) aria-label·글자 '제휴몰' → '연결 서비스'. 버튼 동작(`data-consumer-section="mall"` → Account 페이지)은 그대로.
- `subscribe.html`: 플랜 비교표 행 '제휴몰' → '연결 서비스'(이용 가능 값 무변경).
- `site-conversation.js`: mall 화면 정의 이름 동일하게.
- 검사기(약화 아님 — 이전 이름으로 돌아가면 실패):
  - `validate_home_chat.py`, `validate_sidebar_information_architecture_04.mjs`: "계정 항목은 계정 메뉴에만" 규칙 유지 + `data-consumer-section="mall"` 주요 버튼 **정확히 1개**만 '연결 서비스'를 가질 수 있음. 그 밖의 '연결 서비스' 글자, 경로 직접 링크, 옛 이름 '제휴몰'은 실패. 역시험: main(제휴몰) index.html에 새 규칙을 돌리면 4개 오류로 FAIL 확인.
  - `validate_consumer_design_shell_01.mjs`: 주요 메뉴 7번째 기대값 '제휴몰' → '연결 서비스'.
  - `validate_common_ui_polish_01.mjs`: #5 계약(☰ 2곳·계정 메뉴·구독표·옛 이름 없음) 추가.
- 계정 메뉴의 '연결 서비스' 항목은 그대로 둠(소유자 결정은 이름 통합, 항목 삭제 아님).

## 검증

- 관련 검사기 14개 PASS: home_chat · hardening · site · plan_usage_matrix_v1 · trusted_device_plan_limits_01 · social_legal_manifest_01 · refund_subscription_policy_alignment_01 · common_ui_polish_01(11 checks) · consumer_design_shell_01 · sidebar_information_architecture_04 · conversation_sidebar_ux_01 · regional_news_p0_01 · consumer_sections_02 · subscription_price_proration_01. asset --check PASS.
- 8건 부분의 전체 회귀는 feature/common-ui-polish-01-site READY 문서 참고(NEW_FAILURES=0, main 병합 뒤 22개 재검사 PASS).
- 로컬 실화면: ☰ 두 곳 '연결 서비스' 표시 확인(이전 로컬 미리보기). Production NOT TESTED. 실기기 NOT TESTED.
