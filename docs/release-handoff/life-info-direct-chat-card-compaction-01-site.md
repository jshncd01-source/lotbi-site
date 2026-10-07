READY_FOR_DEPLOY=NO

# life-info-direct-chat-card-compaction-01-site — fresh main reconcile 대기

REPO=lotbi-site
FEATURE_BRANCH=feature/life-info-direct-chat-card-compaction-01-site
OLD_READY_SHA=cd30151971003f37dcb59e6ad0f3771026bc0250
AUTHORITATIVE_MAIN_AT_RECHECK=89adbb378a11fba8e42a445b62f5ffab8f358f5f
LATEST_MAIN_SHA=89adbb378a11fba8e42a445b62f5ffab8f358f5f
MERGE_METHOD=NOT_PERFORMED_MAIN_EQUALS_DEVELOPMENT_BASE
CODE_SHA=cf5a748f
WAITING_FOR_MAIN_DEPENDENCY=YES

## 차단 근거

2026-10-08 KST에 Ncloud Git을 fresh 확인했다. `origin/main`은 기존 개발 base와 같은 `89adbb378a11fba8e42a445b62f5ffab8f358f5f`이며, 요청된 최신 생활정보 제품 결정이 아직 main에 없다.

- LATEST_MAIN_HAS_UTILITY_REMOVAL=NO
  - `site-consumer-sections.js`의 `LIFE_SHORTCUTS`가 `공과금 확인`을 포함한다.
  - 기존 validator도 공과금 메뉴 노출을 요구한다.
- LATEST_MAIN_HAS_TOP_QUERY_REMOVAL=NO
  - `site-consumer-sections.js`가 `어떤 생활정보가 필요하세요?` 입력바를 렌더한다.
- LATEST_MAIN_HAS_BOTTOM_ROW_REMOVAL=NO
  - 생활정보 footer가 보조 안내 row를 렌더한다.
- LATEST_MAIN_HAS_LOTBI_BOX_HIDE_POLICY=NO
  - `저장한 정보 다시 보기`가 노출된다.
  - 장소 카드가 `+ 롯비함` CTA를 렌더한다.
  - 롯비함 화면·route와 관련 validator가 활성 상태다.

사용자 지시에 따라 다른 feature branch를 cherry-pick 또는 merge하지 않았고, 제품 UI를 이 branch에서 선행 구현하지 않았다. latest main이 위 숨김 정책을 포함한 뒤 이 branch에 NORMAL MERGE하고 direct-submit·의료 카드 compaction 전체 회귀를 다시 수행해야 한다.

## 현재 구현 보존 상태

기존 코드 커밋 `cf5a748f`에는 생활정보 direct submit, 자동 focus 억제, 중복·재전송 방지, 무사진 media 제거, 이미지 오류 collapse, compact carousel, 전화 및 사용자 선택 지도 provider 보존 구현이 남아 있다. 다만 fresh-main 의존성 미충족으로 이번 문서는 배포 READY를 취소한다.

NEW_FAILURES=NOT_TESTED_DEPENDENCY_BLOCKED
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
BLOCKER=latest Ncloud main에 공과금·상단 질문바·하단 보조 row·롯비함 UI 숨김 정책이 아직 없음
USER_DECISION_NEEDED=NONE
