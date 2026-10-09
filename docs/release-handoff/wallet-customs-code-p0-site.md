READY_FOR_DEPLOY=NO — CODE_READY=YES, SECURITY_RELEASE_HOLD=YES: 2026-10-05 Life Wallet 보안 감사 4건(잠금 경쟁·iOS 평문 임시 이미지·브라우저 PIN·기기 보호 검증)이 미해결이라 민감번호 저장 기능을 운영에서 켜지 않는다. 소유자 승인(아래 USER_DECISION_NEEDED) 뒤 CUSTOMS_CODE_RELEASED=true 한 줄 + READY=YES로 다시 올린다.

[LOTBI LIFE WALLET CUSTOMS CODE — RELEASE HANDOFF]

TASK=LOTBI_WALLET_CUSTOMS_CODE_P0
REPO=lotbi-site
FEATURE_BRANCH=feature/wallet-customs-code-p0-site
READY_SHA=this document's commit (branch HEAD; `git ls-remote ssh://lotbi-ncloud-git/srv/git/repositories/lotbi-site.git refs/heads/feature/wallet-customs-code-p0-site`)
BASE_MAIN_SHA=56c260959 (Ncloud main, SITE-T45 = T44c 운영본 80da26b7 + Life Wallet 서버 백업 Site 2b757082; push 직전 ls-remote 재확인)
CODE_SHA=7fe4e5cc4
CODE_COMMITS=
  bafddc13 feat(site): Life Wallet 개인통관고유부호 — typed, encrypted, masked, copy on press
  8fd2fc14 ci(site): site-review.yml 월렛 단계에 validate_life_wallet_customs_code_p0 추가
  97b03ab0 chore: asset token 재생성(토큰 줄만)
  cdc8ef67 merge Ncloud main 80da26b7(SITE-T44c) — 토큰만 충돌, 병합 트리 vs main 차이 = 아래 4파일뿐
  7fe4e5cc merge Ncloud main 56c26095(SITE-T45) — site-life-wallet.js 같은 자리 추가 3곳 양쪽 유지(serverBackupTime·mountLifeWallet 인자 sessionToken+customsCode·설정 메뉴 백업 안내+서버 백업 메뉴), 나머지 토큰만. 서버 백업은 exportBackup(accountId, backupPassword) 기본값 그대로 → 통관부호 제외. 병합 트리 vs main 차이 = 4파일뿐
CHANGED_FILES=site-life-wallet.js, site-life-wallet.css, scripts/validate_life_wallet_customs_code_p0.mjs(신규), .github/workflows/site-review.yml(1줄) + asset token 줄
ASSET_VERSION=aset-26b52efd968a (`node scripts/asset_cache_version.mjs --write`, check PASS)

CUSTOMS_DATASET=15063083
DATASET_IS_STATISTICS_ONLY=YES (공공데이터포털 제목 "관세청_개인통관고유부호 발급현황_20260930" = 월별 신규 발급 통계 CSV. 개인 조회 API 아님 → 자동 조회·복원 기능 만들지 않음)
OFFICIAL_SOURCE_VERIFIED=YES
  - 관세청 보도자료 2025-06-18 "개인통관고유부호, 2026년부터는 매년 갱신해 주세요"(customs.go.kr): 유효기간 1년, 2026년 이후 신규 = 발급일+1년, 그 전 발급 = 2027년 본인 생일, 만료일 전후 30일 안에 갱신하지 않으면 자동 해지, 정보 변경·재발급 시 그날부터 1년.
  - https://unipass.customs.go.kr/csp/persIndex.do → https://ecos.customs.go.kr/ecp/index.do 로 리다이렉트(HTTPS 인증서 검증 OK), 제목 "관세청 전자상거래 통관포털". 메뉴(포털 안에서 로드, 메뉴별 주소 없음): 개인통관고유부호 조회/정보변경 · 유효기간 갱신 · 부호변경 · 신규 발급. 갱신에는 관세청의 일회용 인증번호 알림 동의가 필요(포털 메시지).

OFFICIAL_CUSTOMS_PORTAL_LINK_PASS=YES (모든 링크 = https://ecos.customs.go.kr/ecp/index.do, 새 창, rel=noopener noreferrer, 메뉴 이름 안내)
PCCC_FORMAT_VALIDATION_PASS=YES ("P"+숫자 12자리. 공백·하이픈·점·밑줄·슬래시·폭 0 문자 제거, 전각 접기, 소문자 p, P 생략 허용. 11·13자리·다른 글자·PP·아랍 숫자 거절. 화면에 "형식이 맞습니다… 관세청에서 확인된 번호라는 뜻은 아닙니다", 관리 화면에 "본인 번호인지는 LOTBI가 확인할 수 없으니 관세청에서 확인")
ENCRYPTED_STORAGE_PASS=YES (기존 월렛 마스터 키로 AES-256-GCM, 저장소 = 같은 IndexedDB cards store의 별도 scope `items:<scope>`, AAD `lotbi-wallet-item:v1:<scope>:customs-code`. 원문 IndexedDB·localStorage·sessionStorage·cookie·URL 0건, 기기 키 extractable=false·exportKey 거부, 사진 자료 AAD로는 안 열림)
MASKED_DISPLAY_PASS=YES (`P •••• •••• 0123`, 번호 보기 30초 뒤 다시 가림, 잠긴 화면엔 번호 없음)
UNLOCK_TO_COPY_PASS=YES (잠금 해제 상태에서 누를 때만 복사, 잠근 뒤 예전 버튼을 눌러도 복사 0건, 로그아웃·섹션 닫기·백그라운드 전환 시 화면 비움)
COPY_ACTION_PASS=YES (결과 = Clipboard API 결과, 거절이면 execCommand('copy') 반환값, 둘 다 안 되면 번호를 보여 주고 선택해 직접 복사. 성공 문구에 "클립보드에 남고 LOTBI가 지우지 않으니…" — 자동 삭제 주장 없음) — 실기기 NOT TESTED
CHANGE_DELETE_PASS=YES (변경·삭제 = 월렛 PIN 다시 입력, 틀리면 실패 횟수 증가, 첫 등록 = 명시적 동의 체크 필수)
RENEWAL_LINK_PASS=YES (고객이 관세청에서 본 만료일을 직접 넣은 경우만: 30일 이내·당일 "갱신해 주세요", 지난 30일 이내 "지금 갱신할 수 있는지 확인", 30일 초과 "상태 확인·새 번호면 바꾸기" + 관세청 링크. 생년월일 수집·만료일 추정 없음)

ACCOUNT_ISOLATION_PASS=YES (계정 scope 분리: B는 빈 카드, B 키로 A 암호문 안 열림, A 열린 상태에서 B 조회 거부, 계정 전환 후 각자 번호)
BACKUP_COMPATIBILITY_PASS=YES (백업 형식 LOTBI_LIFE_WALLET v1 그대로. 파일 백업만 통관부호 포함(백업 암호 PBKDF2 600,000), exportBackup 기본값은 제외 → SITE-T45 서버 백업 호출은 통관부호를 보내지 않음. 복원은 저장된 번호를 덮어쓰지 않음, 손상 항목이면 아무것도 쓰지 않음. 운영 main 80da26b7 모듈과 교차: 옛 코드 자료를 새 코드가 읽음, 새 코드가 번호 추가 뒤 옛 코드가 자기 자료 2건만 정상 목록, 옛 코드 PIN 변경 뒤 새 코드가 번호 복호화, 옛 백업→새 복원, 새 파일 백업→옛 복원)
NO_SERVER_PCCC_STORAGE_PASS=YES (Core API·서버 저장 없음, 검사 중 fetch/XHR/beacon/WebSocket 0건)
NO_AUTO_CHAT_PASS=YES (대화창·AI 호출 경로 없음, CustomEvent detail·console에 번호 0건)
NO_THIRD_PARTY_AUTOFILL_PASS=YES (네이버·쿠팡 접속·자동 입력·OTP 저장 코드 없음, 링크는 관세청 포털만)
SECURITY_RELEASE_HOLD=YES — 2026-10-05 감사 미해결. 이 기능은 기존 보안 계약을 재사용할 뿐 4건을 해결하지 않는다. 특히 "브라우저 PIN": 4자리 PIN은 온라인 시도 제한(3회부터 대기·5회 차단)만 막고, 기기 키를 쓸 수 있는 공격자(같은 출처 XSS, 브라우저 프로필 복사 악성코드)는 10,000가지 PIN을 오프라인으로 대입할 수 있다. 이미 운영 중인 신분증 사진 보관과 같은 수준이며 그보다 강하지 않다.

CORE_CHANGED=NO
MIGRATION=NONE
NEW_SECRET_CREATED=NO
PRODUCTION_CHANGED=NO
PRODUCTION_FEATURE_STATE=OFF (`CUSTOMS_CODE_RELEASED = false`. 이 branch를 배포해도 화면에 통관부호가 나오지 않음 — 검사로 확인)

SITE_TEST_RESULTS=최종 트리(7fe4e5cc) 집중 26개 직렬(CHROME_BIN, Windows): 25 PASS / 1 FAIL
  - 월렛 18개 전부 PASS: customs_code_p0(신규)·server_backup_01(T45)·entry_lock·pin_attachment·camera_parity·card_deck·document_save·scan_01·synthetic_02·scan_ui_01/02·full_frame·glare·mobile_p0·pdf·photo_picker·storage_persist·upright_print
  - consumer_sections_02·surface_drag_dismiss_guard_01·global_dark_theme_contrast·theme_token_value_01·hardening·accessibility·site.py PASS
  - validate_site_refresh_route_restore_01 FAIL("iPhone-375x812: I 로그인하기 on /#wallet → /auth/start/#wallet → back on Life Wallet, signed in") — main 56c26095 사본에서도 같은 단정 FAIL → 기존 실패
  신규 validate_life_wallet_customs_code_p0(실제 headless Chrome, 360·375·390px 터치): 형식 15건, 동의, IndexedDB 원문 0·기기 키 export 거부·AAD 분리·옛 코드 목록 제외, PIN 변경·삭제(틀린 PIN = 실패 1회), 잠금·로그아웃·섹션 닫기·백그라운드 화면 비움, 잠근 뒤 예전 버튼 복사 0, 계정 분리, 백업(기본 제외·파일 포함·복원 시 저장 번호 유지·옛 백업·손상 거부), 복사 성공·거절·API 없음·둘 다 없음, 관세청 링크만, 기본값 꺼짐, 실제 새로고침 후 PIN → 복원, 라이트·다크 대비 4.5 이상, 네트워크·console·이벤트·저장소 유출 0
  변이 시험 8건(잠근 뒤 복사·가림 해제·PIN 없이 변경·동의 생략·백업 기본 포함·같은 scope·execCommand 결과 무시·http 링크) 전부 검사기가 잡음
  운영 main 80da26b7 모듈 교차 호환 PASS(위 BACKUP_COMPATIBILITY)
  병합 전 트리(10d53f44 기준) 전체 255개 직렬은 PC 부하로 25개에서 중단(22 PASS, 3 FAIL = Chrome 실행 시간초과·부하성, 월렛 무관) → 전체 실행 NOT COMPLETED
REAL_DEVICE_RESULTS=NOT TESTED (삼성 인터넷·Android Chrome·iPhone Safari 실기기·에뮬레이터 없음. 실기기 PASS 주장 없음)
NEW_FAILURES=0 (실행한 범위 기준. 전체 255개는 NOT COMPLETED)

USER_DECISION_NEEDED=소유자 승인 1건 — 기존 월렛 보안 보류(특히 4자리 PIN 오프라인 대입 한계)를 알고도 개인통관고유부호 저장을 운영에서 켤지. 승인 문장 예: "개인통관고유부호 저장 운영 활성화 승인: 2026-10-05 월렛 보안 감사 미해결 위험(4자리 PIN 오프라인 대입·기기 보호 미검증)을 알고 수용한다". 승인 뒤 이 방이 CUSTOMS_CODE_RELEASED=true + READY=YES 재push.
READY_FOR_DEPLOY=NO

REQUEST(배포총괄방):
- Release Queue 중복·충돌 검사: SITE-T44c와는 토큰만 충돌(병합 완료). SITE-T45 백업 Site 2b757082와는 site-life-wallet.js 같은 자리 추가 3곳(import 토큰 줄·mountLifeWallet 위 함수·mountLifeWallet 인자) — T45 main 반영 뒤 이 방이 병합해 맞춤.
- 기존 Wallet 보안 출시 차단사항 확인(위 HOLD).
- 승인 뒤: Site trusted Linux gate → main → 배포 → 실기기 smoke(아래).

## 실기기 smoke 목록(승인·활성화 뒤)
삼성 인터넷(필수)·Android Chrome·iPhone Safari, 라이트·다크:
1. 월렛 잠금 해제 → 맨 위 "개인통관고유부호" 카드 → 등록하기 → 합성 번호(예 P000000000123) 입력·동의 → 저장 → 가림 표시.
2. 번호 복사 → 메모장·쇼핑몰 입력란에 붙여넣기(공백 없는 13자) → 성공 문구.
3. 번호 보기/가리기, 30초 뒤 다시 가려짐.
4. 잠그기·10분 자동 잠금·로그아웃·뒤로가기 뒤 번호가 화면에 없음, 다시 열면 가림 상태.
5. 관리 → 번호·만료일 변경(PIN), 번호 삭제(PIN), 관세청 링크가 새 창으로 열림.
6. 브라우저 종료 후 재진입 → PIN → 번호 복원. 다른 계정 로그인 → 빈 카드.
