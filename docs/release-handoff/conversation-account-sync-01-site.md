READY_FOR_DEPLOY=YES
SUPERSEDES=a1e8448699c64de6b11f2cde942174c85545e050 (이전 READY, main 9e39edd0 기준)
MIGRATION=YES(Core p0_0110_conversation_history — Site 자체는 migration 없음)
DEPLOY_ORDER=CORE → SITE(→ APP)
APP_STORAGE_CHECK=앱 "최근 대화"는 Site WebView가 아니라 앱 자체 AsyncStorage를 씀 → lotbi-app feature/conversation-account-sync-01-app에서 같은 API로 맞춤(Android 내부 테스트까지만)
USER_DECISION_NEEDED=개인정보처리방침 개정 시점(초안: docs/privacy-policy-conversation-history-draft-01.md) · 제6.1조 국외 이전 표에 "대화 기록" 추가 여부 — 배포 차단 아님

# conversation-account-sync-01 (Site) — release handoff (main 576ec346 재병합)

REPO=lotbi-site
FEATURE_BRANCH=feature/conversation-account-sync-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD). `git ls-remote origin refs/heads/feature/conversation-account-sync-01-site`로 확인한다.
CODE_SHA=89bb1ccca6148213e7c097cb08eb2c63d11303e5
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=576ec3465e3685e21fbe26a02a02129c76667739 (SITE-T43, 운영 aset-70f733afa919)
MERGE_METHOD=NORMAL MERGE 1회(576ec346 → 854d9cdf). rebase·force push·reset 없음
ASSET_VERSION=aset-f54a2f734ab0 (scripts/asset_cache_version.mjs --check PASS)
PAIRED=lotbi-core feature/conversation-account-sync-01-core(p0_0110, 먼저 배포 — 2026-10-10 01:1x 기준 CORE-T31 gate 중) · lotbi-app feature/conversation-account-sync-01-app
TAKEOVER=원래 개발방 세션이 없어 배포총괄방 요청(2026-10-10 01:0x)으로 생활정보 직전송 Site 방이 이어받았다. 원래 worktree `conversation-account-sync-01-site`를 썼다. 쓰는 세션·프로세스가 없음을 확인했다(남은 미추적 파일 = 원래 방 검사기 임시 폴더 4개, 손대지 않음).

## 이번 재병합

- main 9e39edd0 → 576ec346 사이에 다음이 들어왔다.
  - 로그인 유지 P0-02(세션 갱신, `registerSiteSessionAdopter`·`SITE_SESSION_RENEWAL_REQUEST_EVENT`)
  - 지역뉴스, 의료 자동검색, 생활정보 1탭(onAsk), 내 아이 학교·유치원
- 충돌 66파일은 전부 asset token, 그리고 이 branch가 바꾸지 않은 import 줄·CSS 링크 목록이었다. 모두 main 쪽(새 줄)을 썼다.
  - import 줄: site-auth / site-calendar-manager / site-consumer-sections / site-continuity / site-conversation
  - CSS 링크 목록: index.html / auth/callback
- 동기화 연결(`site-conversation.js` 연결 줄 9곳 + `loadConversationSync`·`renderConversationSyncUi`)은 자동 병합됐다. 연결이 부르는 main 함수 11개가 모두 그대로 있다.
  - sortThreads, saveState, renderRecent, renderActiveThread, showBlankHome, cancelActiveTurn, modalShell, installSurfaceBehavior, newId, closeSurface, setStatus
- 결과의 main 대비 기능 차이는 이 branch 원래 변경 8파일과 줄 수까지 같다.
  - site-conversation.js 94, site-conversation-sync.js 732, site-conversation-sync-ui.js 302, 검사기 622 + profile_menu 1, site-review.yml 4, 문서 2개
  - 즉 병합으로 빠지거나 더해진 기능 코드가 없다.
- 기능·설계는 이전 READY(a1e84486)와 같다. 아래 "기능 요약" 참고.

## 기능 요약 (a1e84486와 같음)

- 로그인 사용자의 "최근 대화"를 계정에 저장해 휴대폰·PC 어디서든 이어 본다. 비로그인은 지금처럼 기기에만 저장한다.
- `site-conversation-sync.js`: Core `/v2/conversation-history`와 기기 사본을 맞춘다.
  - 메시지 id 단위 추가만 한다(덮어쓰지 않음). 제목·고정은 마지막 변경이 우선한다.
  - 오프라인이면 "동기화 대기"로 두고 재시도한다.
  - 처음 로그인할 때 기기 대화를 올릴지 계정·기기당 한 번 묻는다.
  - 저장을 끌 수 있다. 다른 기기에서 지운 대화는 여기서도 사라진다.
  - 기기 전용 meta(캘린더 초안·SOS 등)는 올리지 않는다.
- `site-conversation-sync-ui.js`: "최근 대화" 옆 상태 표시와 "대화 기록 설정" 버튼, 설정 창(켜기·끄기, 전체 삭제), 기기 대화 올리기 질문 창. 색은 테마 토큰만 쓴다.
- 동기화 모듈은 `/v2/me`로 로그인 프로필이 확인된 뒤에만 동적 import한다. 게스트와 첫 화면은 이전과 같은 모듈만 받는다.
- 로그아웃은 기존 정책 그대로다. namespace = installationId(계정마다 다름)라서 공유 기기에서 다음 사람에게 보이지 않는다.
- `scripts/validate_profile_menu_improvement_01.mjs`: 가짜 Core가 `/v2/conversation-history/`에 응답하도록 한 줄 추가했다. "예상 밖 요청 0건" 계약은 그대로다.

## TEST_STATUS

검사 환경:
- Windows 로컬, Chrome headless(DevTools protocol), 가짜 Core.
- 커밋 내용 그대로(LF, `git -c core.autocrlf=false archive 89bb1ccc`)를 풀어서 검사했다.
- 다른 방과 겹치지 않게 한 번에 하나씩 돌렸다.

- 모듈 구문 검사(`site-conversation.js`, `site-conversation-sync.js`, `site-conversation-sync-ui.js`): PASS.
- `node scripts/asset_cache_version.mjs --check`: PASS(aset-f54a2f734ab0, targets 140, refs 168).
- 관련 검사기 24개: 24 PASS.
  - conversation_account_sync_01(두 기기·오프라인 복구·올리기 예/아니오·저장 끄기·삭제·공유 기기·폰 폭·다크)
  - profile_menu_improvement_01, profile_menu_personal_theme_01, single_profile_entry_01, social_signup_profile_ux_01
  - auth_continuity_02, auth_session_continuity_p0_02(main의 로그인 유지 P0-02와 함께)
  - anonymous_conversation_persistence_01, conversation_management_10, conversation_sidebar_ux_01, pinned_conversation_section_01
  - home_refresh_persistence_01, home_fresh_entry_01, mobile_home_initial_scroll_01, sidebar_information_architecture_04, sidebar_viewports_04
  - chat_answer_recovery_01, site_refresh_route_restore_01, chat_mobile_keyboard_dismiss_01
  - my_child_school_01, consumer_sections_02, life_direct_chat_card_compaction_01
  - validate_hardening.py, validate_home_chat.py(UTF-8 출력)
  - `chat_mobile_keyboard_dismiss_01`: 묶음 실행 중 세 번째 폭에서 Chrome 포트 파일 읽기가 Windows 파일 잠금(EBUSY)으로 멈췄다. 단독으로 다시 돌려 PASS. 제품 코드와 관계없다.
- 전체 site-review 회귀: NOT RUN(이 PC CPU 제약). 최종 전체 gate는 배포총괄방(Linux).

NEW_FAILURES=0 (관련 검사기 24개 기준)

ENV_CHANGE_REQUIRED=NO (Core kill switch `CONVERSATION_HISTORY_SYNC_AVAILABLE`는 Core 쪽)
NEW_SECRET_CREATED=NO
THEME_TOKENS_CHANGED=NO
DEVICE_E2E=NOT VERIFIED (삼성 인터넷·iPhone Safari·PC Chrome 교차 실기기 미확인. 모바일은 viewport 에뮬레이션)
CORE_E2E=NOT VERIFIED (짝 Core p0_0110 운영 미배포 시점. 검사기는 Core 계약과 같은 프로세스 내 가짜 계정 저장소를 쓴다)

## 배포 메모

- Core 먼저. Site만 먼저 나가면 새 API가 404 → "동기화 대기"만 보이고 기기 저장은 그대로다(데이터 손실 없음).
- 배포 후 smoke: 로그인 상태에서 대화 1회 → 다른 브라우저(또는 시크릿) 같은 계정 로그인 시 최근 대화에 보이는지, 설정 버튼 → 켜기·끄기 저장.
