READY_FOR_DEPLOY=YES

STATUS=개인통관고유부호 Life Wallet 저장·가림·복사, 운영 기본값 켜짐(CUSTOMS_CODE_RELEASED=true). 소유자가 2026-10-05 월렛 보안 감사 미해결 위험을 수용함(아래 원문). 감사 4건 자체는 미해결 그대로. 실기기(삼성 인터넷·Android Chrome·iPhone Safari) NOT TESTED — 배포 후 실기기 smoke 필수(아래 목록).

[LOTBI LIFE WALLET CUSTOMS CODE — RELEASE HANDOFF]

TASK=LOTBI_WALLET_CUSTOMS_CODE_P0
REPO=lotbi-site
FEATURE_BRANCH=feature/wallet-customs-code-p0-site
READY_SHA=this document's commit (branch HEAD; `git ls-remote ssh://lotbi-ncloud-git/srv/git/repositories/lotbi-site.git refs/heads/feature/wallet-customs-code-p0-site`)
SUPERSEDES=124643d2 (READY_FOR_DEPLOY=NO, 보안 보류)
BASE_MAIN_SHA=5675fd3d29e5148c58aa31df2d47912000f0b93a (Ncloud main, SITE-T49 = 상품권 + Life Wallet 서버 백업 검사기 오탐 수정 2f2c021d, 그 앞 SITE-T47 진위확인·SITE-T48 Life Wallet 공유 포함; push 직전 ls-remote 재확인)
CODE_SHA=345d996b8
CODE_COMMITS=
  bafddc13 feat(site): Life Wallet 개인통관고유부호 — typed, encrypted, masked, copy on press
  8fd2fc14 ci(site): site-review.yml 월렛 단계에 validate_life_wallet_customs_code_p0 추가
  97b03ab0 chore: asset token 재생성(토큰 줄만)
  cdc8ef67 merge main 80da26b7(SITE-T44c) — 토큰만
  7fe4e5cc merge main 56c26095(SITE-T45 서버 백업) — site-life-wallet.js 같은 자리 추가 3곳 양쪽 유지
  67a95da5 merge main 5675fd3d(SITE-T47~T49) — mountLifeWallet 인자 subscription+customsCode 양쪽 유지, 나머지 토큰
  1d184435 feat(site): CUSTOMS_CODE_RELEASED=true + 검사기를 켜진 상태 기준으로(기본값 켜짐·가림, customsCode:false로 끄기 확인 추가, 다른 단정 그대로)
  345d996b fix(site): 67a95da5 병합 때 import 충돌을 이 branch 쪽으로 골라 빠진 공유 import 2줄 복구("hasWalletShareIntent is not defined"로 월렛이 안 열리던 것 — push 전 검사기가 잡음). import가 main과 같음, main 줄 중 빠진 것은 이 branch의 의도한 변경뿐
CHANGED_FILES(main 대비, 토큰 제외)=site-life-wallet.js, site-life-wallet.css, scripts/validate_life_wallet_customs_code_p0.mjs(신규), .github/workflows/site-review.yml(월렛 단계 1줄 + 주석), 이 문서
ASSET_VERSION=aset-913d8327d86c (`node scripts/asset_cache_version.mjs --write`, check PASS targets=148 refs=178)
DEPLOY_SCOPE=lotbi-site only. Core·Web·Admin·App 무변경. LOTBI 앱 월렛(React Native)은 별도 — 무관.
DEPLOY_ORDER=단독(SITE).

OWNER_RISK_ACCEPTED="개인통관고유부호 저장 운영 활성화 승인: 2026-10-05 월렛 보안 감사 미해결 위험(4자리 PIN 오프라인 대입·기기 보호 미검증)을 알고 수용한다" (2026-10-10 13:10 배포총괄방 채팅, RELEASE_QUEUE 기록) + 이 방 채팅 13:2x 소유자 직접 지시: "지금 통관부호 기능 켜기 진행해: … READY=YES로 push해. 2026-10-05 월렛 보안 감사 미해결 위험(4자리 PIN 오프라인 대입·기기 보호 미검증)을 알고 수용한다."
SECURITY_RELEASE_HOLD=ACCEPTED_BY_OWNER — 감사 4건(잠금 경쟁·iOS 평문 임시 이미지·브라우저 PIN·기기 보호 검증)은 미해결 그대로. 이 기능은 기존 보안 계약을 재사용할 뿐 해결하지 않는다. "브라우저 PIN": 4자리 PIN은 온라인 시도 제한(3회부터 대기·5회 차단)만 막고, 기기 키를 쓸 수 있는 공격자(같은 출처 XSS, 브라우저 프로필 복사 악성코드)는 10,000가지 PIN을 오프라인으로 대입할 수 있다. 이미 운영 중인 신분증 사진 보관과 같은 수준. 공유 원본 전달 HOLD는 별개로 유지.
PRODUCTION_FEATURE_STATE=ON after deploy (`CUSTOMS_CODE_RELEASED = true`). 끄기 = 그 줄을 false로 바꾼 READY 한 번(저장된 번호는 암호화된 채 그대로, 화면에서만 사라짐 — 검사로 확인).

CUSTOMS_DATASET=15063083
DATASET_IS_STATISTICS_ONLY=YES (공공데이터포털 "관세청_개인통관고유부호 발급현황_20260930" = 월별 신규 발급 통계 CSV. 개인 조회 API 아님 → 자동 조회·복원 기능 없음)
OFFICIAL_SOURCE_VERIFIED=YES
  - 관세청 보도자료 2025-06-18 "개인통관고유부호, 2026년부터는 매년 갱신해 주세요"(customs.go.kr): 유효기간 1년, 2026년 이후 신규 = 발급일+1년, 그 전 발급 = 2027년 본인 생일, 만료일 전후 30일 안에 갱신하지 않으면 자동 해지, 정보 변경·재발급 시 그날부터 1년.
  - https://unipass.customs.go.kr/csp/persIndex.do → https://ecos.customs.go.kr/ecp/index.do 리다이렉트(HTTPS 검증 OK), "관세청 전자상거래 통관포털". 메뉴는 포털 안에서 로드(메뉴별 주소 없음): 조회/정보변경 · 유효기간 갱신 · 부호변경 · 신규 발급. 갱신에는 관세청 일회용 인증번호 알림 동의 필요(포털 메시지) — LOTBI는 인증번호를 받거나 저장하지 않음.

OFFICIAL_CUSTOMS_PORTAL_LINK_PASS=YES (모든 링크 = https://ecos.customs.go.kr/ecp/index.do, 새 창, rel=noopener noreferrer, 메뉴 이름 안내)
PCCC_FORMAT_VALIDATION_PASS=YES ("P"+숫자 12자리. 공백·하이픈·점·밑줄·슬래시·폭 0 문자 제거, 전각 접기, 소문자 p, P 생략 허용. 11·13자리·다른 글자·PP·아랍 숫자 거절. 화면 "형식이 맞습니다… 관세청에서 확인된 번호라는 뜻은 아닙니다", 관리 화면 "본인 번호인지는 LOTBI가 확인할 수 없으니 관세청에서 확인")
ENCRYPTED_STORAGE_PASS=YES (기존 월렛 마스터 키 AES-256-GCM, 같은 IndexedDB cards store의 별도 scope `items:<scope>`, AAD `lotbi-wallet-item:v1:<scope>:customs-code`. 원문 IndexedDB·localStorage·sessionStorage·cookie·URL 0건, 기기 키 extractable=false·exportKey 거부, 사진 자료 AAD로 안 열림)
MASKED_DISPLAY_PASS=YES (`P •••• •••• 0123`, 번호 보기 30초 뒤 다시 가림, 운영 기본 마운트에서도 가림·페이지에 숫자 없음)
UNLOCK_TO_COPY_PASS=YES (잠금 해제 상태에서 누를 때만 복사, 잠근 뒤 예전 버튼 복사 0건, 로그아웃·섹션 닫기·백그라운드 전환 시 화면 비움)
COPY_ACTION_PASS=YES (결과 = Clipboard API 결과 → 거절 시 execCommand('copy') 반환값 → 둘 다 안 되면 번호 선택해 직접 복사. 성공 문구 "클립보드에 남고 LOTBI가 지우지 않으니…" — 자동 삭제 주장 없음) — 실기기 NOT TESTED
CHANGE_DELETE_PASS=YES (변경·삭제 = 월렛 PIN 다시 입력, 틀리면 실패 횟수 증가, 첫 등록 = 동의 체크 필수)
RENEWAL_LINK_PASS=YES (고객이 직접 넣은 만료일 기준만: 30일 이내·당일 갱신 안내, 지난 30일 이내 확인 안내, 30일 초과 상태 확인·번호 바꾸기 + 관세청 링크. 생년월일 수집·만료일 추정 없음)

ACCOUNT_ISOLATION_PASS=YES (계정 scope 분리: 다른 계정은 빈 카드, 다른 계정 키로 암호문 안 열림, 열린 계정이 아닌 계정 조회 거부, 계정 전환 후 각자 번호)
BACKUP_COMPATIBILITY_PASS=YES (백업 형식 LOTBI_LIFE_WALLET v1 그대로. 파일 백업만 통관부호 포함, exportBackup 기본값은 제외 → 서버 백업(site-life-wallet.js `vault.exportBackup(accountId, backupPassword)`)은 통관부호를 보내지 않음. 공유 모듈은 vault.list(사진 자료)만 받음 → 공유로 안 나감. 무료 회원 자료 개수 제한은 사진 자료만 셈. 복원은 저장된 번호를 덮어쓰지 않음, 손상 항목이면 아무것도 쓰지 않음. 운영 main 80da26b7 모듈과 교차 호환 PASS: 옛 자료를 새 코드가 읽음, 새 코드가 번호 추가 뒤 옛 코드는 자기 자료만 정상 목록, 옛 코드 PIN 변경 뒤 새 코드가 번호 복호화, 옛 백업↔새 백업 양방향 복원)
NO_SERVER_PCCC_STORAGE_PASS=YES (Core API·서버 저장 없음, 검사 중 fetch/XHR/beacon/WebSocket 0건)
NO_AUTO_CHAT_PASS=YES (대화창·AI 호출 경로 없음, CustomEvent detail·console에 번호 0건)
NO_THIRD_PARTY_AUTOFILL_PASS=YES (네이버·쿠팡 접속·자동 입력·OTP 저장 코드 없음, 링크는 관세청 포털만)

CORE_CHANGED=NO
MIGRATION=NONE
ENV_CHANGE_REQUIRED=NO
NEW_SECRET_CREATED=NO
STORED_DATA_CHANGED=NO (기존 자료 재암호화·삭제 없음, IndexedDB 버전·구조 그대로)

SITE_TEST_RESULTS=최종 트리(345d996b) 직렬 27개(CHROME_BIN, Windows): 27 PASS / 0 FAIL
  - 월렛 20개: customs_code_p0(켜진 기준)·share_01·share_transfer_01·server_backup_01·entry_lock_01·pin_attachment_ux_p0·camera_parity_01·card_deck_01·document_save_01·document_scan_01·document_scan_synthetic_02·document_scan_ui_01/02·full_frame_card_01·glare_block_01·mobile_p0_01·pdf_01·photo_picker_01·storage_persist_01·upright_print_01
  - consumer_sections_02·surface_drag_dismiss_guard_01·global_dark_theme_contrast·theme_token_value_01·hardening·accessibility·site.py
  - asset_cache_version check PASS
  - 345d996b 전 트리(1d184435)에서는 card_deck_01·customs_code_p0가 "timed out pin setup"으로 실패 → 원인 = 병합 때 빠진 공유 import(월렛 첫 화면 "hasWalletShareIntent is not defined") → 345d996b로 고친 뒤 전부 PASS. 그 커밋들은 push된 적 없음.
  - validate_life_wallet_customs_code_p0(실제 headless Chrome, 360·375·390px 터치): 형식 15건, 동의, IndexedDB 원문 0·기기 키 export 거부·AAD 분리·옛 코드 목록 제외, PIN 변경·삭제(틀린 PIN = 실패 1회), 잠금·로그아웃·섹션 닫기·백그라운드 화면 비움, 잠근 뒤 예전 버튼 복사 0, 계정 분리, 백업(기본 제외·파일 포함·복원 시 저장 번호 유지·옛 백업·손상 거부), 복사 성공·거절·API 없음·둘 다 없음, 관세청 링크만, 운영 기본값 켜짐·가림 + customsCode:false로 끄기, 실제 새로고침 후 PIN → 복원, 라이트·다크 대비 4.5 이상, 네트워크·console·이벤트·저장소 유출 0
  - 변이 시험 8건(잠근 뒤 복사·가림 해제·PIN 없이 변경·동의 생략·백업 기본 포함·같은 scope·execCommand 결과 무시·http 링크) 전부 검사기가 잡음(꺼진 판 기준 실행)
  - 기존 실패 참고: validate_site_refresh_route_restore_01은 main 56c26095에서도 같은 단정 실패(이 PC). 전체 255개 직렬은 PC 부하로 NOT COMPLETED.
REAL_DEVICE_RESULTS=NOT TESTED (삼성 인터넷·Android Chrome·iPhone Safari 실기기·에뮬레이터 없음. 실기기 PASS 주장 없음)
NEW_FAILURES=0 (실행한 27개 기준)

USER_DECISION_NEEDED=NONE (위험 수용 승인 받음)

REQUEST(배포총괄방):
- Release Queue 중복·충돌 검사(이 branch는 main 5675fd3d 위, 다른 Site READY와는 토큰 줄 위주)
- Site trusted Linux gate → main 병합 → 운영 배포
- 실제 모바일 잠금·복사·자료 격리 확인(아래) → 결과 회신

## 실기기 smoke 목록(배포 뒤, 소유자·배포총괄방)
삼성 인터넷(필수)·Android Chrome·iPhone Safari, 라이트·다크. 실제 고객 번호 대신 합성 번호(예 P000000000123)로:
1. 월렛 잠금 해제 → 맨 위 "개인통관고유부호" 카드 → 등록하기 → 번호 입력·동의 → 저장 → 가림 표시.
2. 번호 복사 → 메모장·쇼핑몰 입력란에 붙여넣기(공백 없는 13자) → 성공 문구. 자동 복사가 막히는 브라우저면 번호가 선택된 칸이 뜨는지.
3. 번호 보기/가리기, 30초 뒤 다시 가려짐.
4. 잠그기·10분 자동 잠금·로그아웃·뒤로가기 뒤 번호가 화면에 없음, 다시 열면 가림 상태.
5. 관리 → 번호·만료일 변경(PIN), 번호 삭제(PIN), 관세청 링크가 새 창으로 열림.
6. 브라우저 종료 후 재진입 → PIN → 번호 복원. 다른 계정 로그인 → 빈 카드.
7. 기존 사진 자료·공유·서버 백업 메뉴가 그대로 동작(서버 백업 후 복원해도 통관부호는 기기에만 있음).
