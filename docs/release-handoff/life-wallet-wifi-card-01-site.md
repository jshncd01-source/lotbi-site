READY_FOR_DEPLOY=YES
MIGRATION=NO
DEPLOY_ORDER=SITE 단독 (Core 무변경, 서버로 나가는 요청 없음)
MERGE_ORDER=통관부호 feature/wallet-customs-code-p0-site 다음 (배포총괄방 지시). 시험 병합 결과 텍스트 충돌은 asset token뿐
USER_DECISION_NEEDED=NONE (기본안 승인됨). 후속 판단 1건: 와이파이를 백업 파일에도 넣을지(아래 3)

# life-wallet-wifi-card-01-site — Life Wallet 와이파이 카드 (공유기 스티커 사진 대신)

REPO=lotbi-site
FEATURE_BRANCH=feature/life-wallet-wifi-card-01-site
AUTHORITATIVE_MAIN=5675fd3d (push 직전 git ls-remote 확인)
CODE_SHA=d71f1fb6
ASSET_VERSION=aset-530a832862c1
CODE_COMMITS=02674a9a 와이파이 카드, d71f1fb6 와이파이 목록을 툴바보다 먼저 읽기(공유 대기 수 갱신 경쟁 수정)
FILES=site-life-wallet-wifi.js(신규), site-qr-encode.js(신규), site-life-wallet.js(import 1줄, scope·AAD 함수 2개, vault 메서드 4개, 생성 1줄, 첫 화면 2줄), site-life-wallet.css(끝에 와이파이 블록), scripts/validate_life_wallet_wifi_card_01.mjs(신규), scripts/fixtures/wifi-qr-reference.json(신규), asset token

## 1. 기능
- 월렛 첫 화면 아래 "와이파이" 칸: "+ 와이파이 추가", 저장한 와이파이 목록(이름·SSID·가린 비밀번호). 무료 회원도 쓴다(무료 1개 한도에 세지 않음, 최대 20개).
- 등록: 이름(집·회사·부모님 댁 버튼, 직접 입력 20자), 공유기 스티커 사진(선택), SSID, 보안 방식(WPA/WPA2/WPA3 · WEP · 비밀번호 없음), 비밀번호, 숨은 네트워크.
- 꺼내 쓰기: 비밀번호 보기(30초 뒤 다시 가림), 비밀번호 복사(잠금이 풀려 있을 때만, 자동 복사가 막히면 직접 복사 칸), 와이파이 QR(표준 WIFI:T:…;S:…;P:…;H:true;; — \ ; , : " 이스케이프, 1분 뒤 자동 닫힘).
- 관리: 스티커 사진 보기, 수정·삭제는 월렛 PIN 재확인(틀리면 통관부호·삭제와 같은 실패 횟수·잠금 규칙). 열 수 없는 항목은 개수만 알리고 PIN으로 지운다.
- 잠그면 칸이 화면에서 사라지고, 남아 있던 버튼을 눌러도 복사되지 않는다.

## 2. 사진 자동 읽기 — 기기 안에서만
- 스티커에 인쇄된 와이파이 QR: BarcodeDetector(Android Chrome·Samsung Internet 등)로 읽어 SSID·비밀번호·보안 방식을 채운다.
- 인쇄된 글자: 브라우저에 TextDetector가 있을 때만 읽는다("SSID:", "비밀번호:", "Network Name", "WiFi Password" 등).
- 둘 다 없으면(대부분의 iPhone Safari, PC) "이 브라우저는 사진 속 글자를 기기 안에서 읽지 못합니다" 안내 후 사진을 보며 직접 입력.
- 범용 OCR을 넣지 않은 근거: 브라우저 표준 글자 인식 API가 없다(TextDetector는 실험 기능). 기기 안 OCR 라이브러리(Tesseract 계열)는 WASM과 한국어·영어 학습 데이터만 수십 MB이고 휴대폰에서 느리다. 서버 AI·외부 OCR로 사진을 보내는 것은 금지 조건이다.
- 사진은 1600px 이하 JPEG로 다시 그려(카메라 위치·기기 정보 제거) 글자 확인용으로 함께 암호화해 보관한다.

## 3. 저장·백업 정책
- 기존 월렛 마스터 키 + AES-256-GCM, scope wifi:<scope>, AAD lotbi-wallet-wifi:v1:<scope>:<id>. listCards(scope)에 나오지 않아 카드 덱·무료 한도·공유·백업이 보지 않는다.
- 서버 백업: 넣지 않는다. 통관부호와 같은 판단이다(직접 입력한 비밀값은 서버에 두지 않음).
- 백업 파일: 이번 branch에서는 넣지 않는다. 통관부호 branch의 vault.exportBackup(…, {includeItems})가 main에 들어간 뒤 그 구조에 와이파이를 얹는 것이 다음 단계다. 화면 안내: "서버 백업·백업 파일·공유에는 들어가지 않습니다".
- 서버로 나가는 요청 없음(검사로 확인).

## 4. 통관부호 branch와 겹치는 곳 (배포총괄방 병합용)
- 시험 병합: 이 branch d71f1fb6 + feature/wallet-customs-code-p0-site dbe104f6(로컬 폴더에서 FETCH_HEAD로만 읽음, 그 branch 미변경). 병합 기준 5675fd3d. token을 정규화하면 텍스트 충돌 0, 75개 파일 충돌은 전부 asset token → `node scripts/asset_cache_version.mjs --write`로 해결.
- 같은 파일 안 인접 지점(둘 다 유지): site-life-wallet.js ① import 줄(와이파이 import는 공유 import 다음 줄) ② vault 메서드(통관부호 getCustomsCode·saveCustomsCode… / 와이파이 listWifi·saveWifi·removeWifi·removeUnreadableWifi — 서로 다른 위치) ③ mountLifeWallet: 통관부호는 인자 customsCode, 와이파이는 본문의 `const wifi = createWalletWifi(...)` 1줄 ④ renderWallet: 통관부호 카드(customsCard) 다음에 와이파이 칸. site-life-wallet.css 끝 블록.
- 통관부호 계약 준수: exportBackup에 includeItems를 넘기지 않는다. 와이파이는 canExportWalletBackup 개수에 넣지 않는다.
- 합친 상태 검사: wifi_card_01, customs_code_p0, share_01, server_backup_01, entry_lock_01 모두 PASS.

## 5. 검사 (Windows, 하나씩 실행)
- NEW validate_life_wallet_wifi_card_01 PASS: WIFI: 이스케이프·되읽기·제조사 순서, 입력 규칙 10종 거절·4종 허용, 스티커 글자, QR 인코더 = Python qrcode(버전 1~20, 마스크 0~7, 28개 행렬 SHA-256 일치), 스티커 QR 기기 안 판독 → 양식 채움, 가린 비밀번호·30초 보기·복사, 화면 QR = 인코더 행렬, 스티커 사진, 틀린 PIN이면 수정·삭제 안 됨, 비밀번호 없는 와이파이, 판독기 없음 → 직접 입력, IndexedDB에 평문 없음, 카드 덱·백업 파일에 없음, 네트워크 0, 잠그면 사라짐, 360px 라이트·다크 넘침 없음·QR 정사각형 200px 이상.
- 추가 확인: 자동 마스크 QR 4종을 OpenCV QRCodeDetector로 해독 → 원문과 일치.
- 월렛 검사기 전부 + 사이트 기본 검사 27개 PASS(d71f1fb6 내용): Life Wallet 검사기 20개(신규 포함), consumer_sections_02, consumer_design_shell_01, consumer_theme_sync_01, theme_token_value_01, validate_site.py, validate_hardening.py, validate_accessibility.py.
- 첫 실행 때 share_01 실패 → 원인은 이 branch(와이파이 목록 await 중 공유 대기 수 갱신을 놓침) → d71f1fb6로 수정 후 PASS. document_scan_synthetic_02는 첫 실행 때 부하로 900초 시간 초과, 재실행 PASS.
- 실기기 NOT VERIFIED: Android 카메라·BarcodeDetector로 실제 스티커 읽기, iPhone, 손님 폰으로 QR 연결.
