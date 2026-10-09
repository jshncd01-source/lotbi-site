READY_FOR_DEPLOY=YES
SUPERSEDES=7dd82196
MIGRATION=YES (Core p0_0111_life_wallet_backup — already in Production: CORE-T33, core main 2d47035d, 2026-10-10 03:21; Site has none)
DEPLOY_ORDER=CORE → SITE (Core part is live)
USER_DECISION_NEEDED=개인정보처리방침 개정 시점 (초안 docs/LIFE-WALLET-ENCRYPTED-BACKUP-01-PRIVACY-DRAFT.md, privacy.html 미변경); 소셜(FEDERATED_LIMITED) 로그인에도 서버 백업을 열지; 서버 백업 보관 기간(지금은 최신 1개, 무기한)

STATUS=IMPLEMENTED; Life Wallet validators + site checks PASS; real devices NOT VERIFIED.

# life-wallet-encrypted-backup-01-site — Life Wallet 카카오톡식 암호화 서버 백업·불러오기 (+ document_save_01 Linux 안정화)

REPO=lotbi-site
FEATURE_BRANCH=feature/life-wallet-encrypted-backup-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ... refs/heads/feature/life-wallet-encrypted-backup-01-site`)
AUTHORITATIVE_MAIN=80da26b7 (checked with git ls-remote right before this commit; contains release/20261010-site-t44c-work 721f38b0)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=9e39edd06446 (first development)
CODE_SHA=1d6d996c (re-merge; first development 89f19fe3)
CONTAINS=nothing unshipped besides this feature (fdce6f1c upright/copy is in main).
CODE_COMMITS (none in main yet): 04ea7b3e merge of main 9e39edd0 (tokens only), c4631bab server backup, 89f19fe3 document_save_01 real-time waits + privacy draft.
NON_TOKEN_DIFF_VS_MAIN (this branch's own part): site-life-wallet-backup.js (new), site-life-wallet.js, site-life-wallet.css, site-consumer-sections.js (sessionToken to the wallet), site-conversation.js (sessionToken to consumer sections), scripts/validate_life_wallet_server_backup_01.mjs (new), scripts/validate_life_wallet_entry_lock_01.mjs (mount call), scripts/validate_life_wallet_document_save_01.mjs, scripts/lib/headless-fixture-result.mjs (cpuThrottlingRate option), docs/LIFE-WALLET-ENCRYPTED-BACKUP-01-PRIVACY-DRAFT.md — plus the upright/copy files of fdce6f1c. site-theme-tokens.css untouched.
DEPENDENCY=Core feature/life-wallet-encrypted-backup-01-core (API /v2/life-wallet/backup, migration p0_0111_life_wallet_backup). Without that Core: the wallet works as before; 서버 백업 menu items answer with a plain error (Core 404) and no backup notice appears.
ENV_CHANGE_REQUIRED=NO

## 0. 재병합 (2026-10-10, Life Wallet 공유 방이 이어받음)

- 기준: release/20261010-site-t44c-work 721f38b0 = site main 576ec346 + 전북 + 대화 기록 + 온누리 Site + Life Wallet PIN·첨부 P0 10d53f44. 그 뒤 main 80da26b7.
- merge: cab7803e. 병합 기준점이 두 개(fdce6f1c, 9e39edd0)라 git의 가상 기준점에 token 충돌이 섞였다. 그래서 파일마다 이 branch의 출발점(04ea7b3e)을 기준으로 token을 정규화해 다시 3-way merge하고, `node scripts/asset_cache_version.mjs --write`로 token을 다시 만들었다(aset-ef4dd10097af). 5f92efa6은 release가 새로 들여온 파일 5개의 token.
- 진짜 충돌 3곳:
  - `mountConsumerSection`: main의 `onAsk`·`mountMyChild` 시그니처 + 이 branch의 `sessionToken`.
  - 생활 화면 호출(site-conversation.js): main의 `onAsk` 블록 + `sessionToken`.
  - `validate_life_wallet_document_save_01`: 이 branch의 실시간 `runFixturePage` 끝부분 + main(PIN·첨부 P0)의 `retakeButton` 판정 1줄.
- PIN·첨부 P0가 바꾼 곳(pinInput, createWalletPhotoPicker, visibilityListener, 포커스, autocomplete, scan-ui onReplace, 첨부 CSS)은 main 그대로다. main 대비 월렛 코드에서 빠진 줄은 이 기능이 의도한 6줄뿐이다(백업 반복수, mount 시그니처, 새 기기 복원 흐름, 안내 문구).
- 검사기 기대값 1건: `validate_consumer_sections_02`가 옛 `mountLifeWallet({root, authenticated, accountId, sessionExpiresAt})`을 고정하고 있어 `sessionToken` 포함 호출로 고쳤다(17bb387e). 판정 수는 그대로다.
- 이번 검사: 17bb387e에서 하나씩 실행(1d6d996c는 main 80da26b7 merge만 더한 것으로 파일 내용이 같다):
  - PASS: server_backup_01, entry_lock_01, pin_attachment_ux_p0, consumer_sections_02, document_save_01, validate_site.py, validate_hardening.py, validate_accessibility.py
  - PASS: Life Wallet 검사 13개(camera_parity_01, card_deck_01, document_scan_01, document_scan_synthetic_02, document_scan_ui_01, document_scan_ui_02, full_frame_card_01, glare_block_01, mobile_p0_01, pdf_01, photo_picker_01, storage_persist_01, upright_print_01), 화면 검사 11개(anonymous_conversation_persistence_01, auth_continuity_02, chat_dark_login_kakao_share_01, consumer_design_shell_01, consumer_detail_system_01, consumer_documents_01, consumer_theme_sync_01, conversation_account_sync_01, conversation_calendar_actions_01, conversation_calendar_auto_suggest_01, my_child_school_01)
  - site_refresh_route_restore_01: Core 회귀와 동시 실행 중 한 화면 크기에서 로그인 상태가 아직 checking이라 실패 → 단독 재실행 PASS(부하성)
  - asset 검사 PASS, node --check(wallet, backup, consumer sections, conversation, scan-ui)
- NEW_FAILURES=NONE. 전체 Linux gate는 배포총괄방.

## 1. 암호화 서버 백업 (소유자 결정 2026-10-09)

- **백업하기:** ⚙ 설정 → 서버에 백업하기.
  - 백업 비밀번호는 10자 이상이고, 문자·숫자·기호 중 2가지 이상, 반복 금지다. 강도(약함·보통·강함)를 표시한다.
  - "잊으면 LOTBI도 복구 불가" 확인 체크가 필수다. 월렛 PIN과 별도다.
  - 이 브라우저에서 월렛 전체를 암호화(파일 백업과 같은 형식: PBKDF2-HMAC-SHA-256 60만 회, AES-256-GCM, salt·nonce 새로)하고, 봉투만 Core로 보낸다.
  - 마지막 서버 백업 시각을 설정 메뉴에 표시한다.
- **불러오기 (새 기기):**
  - PIN 만들기 화면에 "서버에 백업한 월렛이 있습니다(날짜). PIN을 만든 뒤 바로 불러올 수 있습니다."가 나온다.
  - PIN을 만들면 곧바로 불러오기 화면이 열린다.
  - 백업 비밀번호를 넣으면 이 브라우저에서 풀어 기기 저장소에 넣는다. PIN은 새 기기에서 다시 정한 것이다.
  - 비밀번호가 틀리면 다시 받지 않고 같은 사본으로 재시도한다. Core는 내려받기 횟수만 센다.
  - 빈 월렛과 설정 메뉴에도 "서버 백업 불러오기"가 있다.
- **관리:**
  - 새 백업은 이전 백업을 대신한다.
  - 서버 백업 삭제는 월렛 PIN을 확인한 뒤 진행한다.
  - 탈퇴하면 Core가 삭제한다.
- **안내 문구:** 서버 백업이 있으면 "자료는 이 기기에 저장되고, 서버에는 암호화된 백업만 보관됩니다…"로 바뀐다. 없으면 기존 "이 기기에만" 문구를 그대로 쓴다.
- **실패 안내 (모두 한국어):**
  - 비밀번호 틀림 또는 손상: "백업 비밀번호가 맞지 않거나 백업이 손상되었습니다"
  - 알 수 없는 형식: "지원하지 않거나 손상된 …"
  - 32MB 초과: 보내지 않고 파일 백업을 안내한다.
  - FULL이 아닌 세션: "이메일·비밀번호 또는 패스키로 다시 로그인"을 안내한다.
  - 하루 내려받기 초과, 요청 과다
- **기존 파일 백업:** 내보내기·가져오기는 그대로 둔다. importBackup은 백업에 기록된 반복수(오늘 값 이상)로 풀어서, 앞으로 반복수를 올려도 옛 백업이 열린다.

## 2. document_save_01 Linux 불안정 (배포총괄 2026-10-09 14:47 요청)

- **원인:** 월렛 검사 중 마지막으로 남은 `--dump-dom --virtual-time-budget` 실행이었다. 페이지 안의 9초 대기(300 × 30ms)가 가상 시간으로 지나가는 동안, 사진 보정은 실제 시간이 걸렸다. Linux 2 vCPU gate에서 가끔 9초를 넘어서 실패했다(`timeout cancel review states=`).
- **재현 (Windows 16코어):**
  - 옛 검사를 CPU 포화 상태에서 돌리면 8회 중 4회 실패했다(Chrome 40초 ETIMEDOUT 3회, 전체 시간 초과 1회).
  - 새 방식에서 대기만 9초로 줄인 사본은 DevTools CPU 6배 감속에서 3/3 실패했다. 메시지가 gate와 같았고, 직후 상태는 review였다(보정이 9초를 조금 넘김).
- **수정:**
  - `runFixturePage`(DevTools, 실시간)로 옮기고, 대기는 실제 시간 30초로 늘렸다.
  - 시간 초과 시 마지막 상태(편집기 수, host 자식 수, 상태와 문구)를 기록한다.
  - **판정 12개는 그대로다.**
  - `runFixturePage`에 `cpuThrottlingRate`(또는 환경변수 `LOTBI_FIXTURE_CPU_THROTTLE`) 옵션을 추가했다. 기본은 꺼짐이라 다른 검사는 그대로다.
- **결과:**
  - **단독 20회 연속, CPU 6배 감속: 20/20 PASS** (회당 40~84초)
  - **단독 20회 연속, 감속 없음(Core 테스트와 동시 실행 중): 20/20 PASS** (8~15초)

## 3. 검사

- **NEW validate_life_wallet_server_backup_01** (가짜 Core, 기기마다 새 Chrome 프로필):
  - 기기 A: 카드·문서·PDF 쪽·사진 4개 저장 → 비밀번호 규칙 5가지 거부 → 강도 "강함" → 백업.
  - Core로 나간 모든 요청에 PIN, 백업 비밀번호, 메모, `data:image`, 자료 이름이 없다. 봉투 필드는 정확히 format·version·kdf·cipher이고, Bearer와 `credentials: omit`을 쓴다.
  - 기기 B(빈 저장소): 백업 안내 → PIN → 틀린 비밀번호 → 맞는 비밀번호 → **A와 같은 4개**(메모·사진·분류의 해시 일치).
  - 손상된 백업과 버전 2는 거부되고, 아무것도 추가되지 않는다.
  - 소셜 세션 안내, 32MB 초과 시 전송하지 않음, PIN 확인 뒤 삭제를 확인했다.
  - 레이아웃: 320, 360(다크), 412, 412(다크)에서 넘침이 없고, 안내 색과 배경이 구분된다.
- **TEST_STATUS=PASS on c4631bab:**
  - Life Wallet 검사 17개: document_scan_01, document_scan_ui_01, document_save_01, photo_picker_01, card_deck_01, entry_lock_01, document_scan_synthetic_02, document_scan_ui_02, pdf_01, mobile_p0_01, camera_parity_01, full_frame_card_01, glare_block_01, storage_persist_01, upright_print_01, server_backup_01 (share_01은 이 branch에 없음)
  - validate_site.py, validate_hardening.py, validate_accessibility.py, asset 검사, node --check(wallet, backup, consumer sections, conversation)
- **TEST_EXPECTATION_CHANGES (의도한 변경):**
  - entry_lock_01이 새 mount 호출 `mountLifeWallet({root, authenticated, accountId, sessionExpiresAt, sessionToken})`을 기대한다.
  - document_save_01은 실행 방식만 바꿨고 판정은 그대로다.
- **NEW_FAILURES=NONE**
- **REAL_DEVICE_TEST=NOT VERIFIED:** 휴대폰 실기기와 실제 Core로 두 기기 왕복을 해 보지 않았다.

## 배포 후 사용자 확인

1. 기기 A에서 월렛 → ⚙ 설정 → 서버에 백업하기.
2. 다른 기기나 브라우저에서 같은 계정으로 로그인 → 월렛 → 안내 확인 → PIN 만들기 → 백업 비밀번호 → 자료가 그대로 있는지 본다.
3. 소셜 로그인 계정이면 FULL 로그인 안내가 나오는지 본다.

PRIVACY=실제 사진 미사용. 시험 이미지는 모두 합성이다. 서버로 가는 것은 봉투(암호문과 그 설정값)뿐이다.
FORBIDDEN_HERE=main merge, merge gate, Production deploy, force push/rebase/reset, privacy.html 본문 변경.
