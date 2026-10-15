READY_FOR_DEPLOY=YES
SUPERSEDES=4f881a46 (배포총괄방 반환: 라벨만 잘라 보관하는 소유자 필수 요구 2건 누락)
MIGRATION=NO
DEPLOY_ORDER=SITE 단독 (Core 무변경, 서버로 나가는 요청 없음)
MERGE_ORDER=통관부호 feature/wallet-customs-code-p0-site 다음 (시험 병합: 텍스트 충돌은 asset token뿐)
USER_DECISION_NEEDED=NONE (기본안 승인됨). 후속 판단 1건: 와이파이를 백업 파일에도 넣을지(아래 4)

# life-wallet-wifi-card-01-site — Life Wallet 와이파이 카드 (공유기 스티커 사진 대신)

REPO=lotbi-site
FEATURE_BRANCH=feature/life-wallet-wifi-card-01-site
AUTHORITATIVE_MAIN=5675fd3d (push 직전 git ls-remote 확인)
CODE_SHA=6d2b0b11
ASSET_VERSION=aset-0716333c2f93
CODE_COMMITS=02674a9a 와이파이 카드, d71f1fb6 와이파이 목록을 툴바보다 먼저 읽기, 6d2b0b11 라벨만 잘라 보관(사진 원본 보관 폐지)
FILES=site-life-wallet-wifi.js(신규), site-qr-encode.js(신규), site-life-wallet-scan.js(findLabelCorners 추가, detectDocumentCorners allowLong 옵션 — 기본값이면 기존과 같음), site-life-wallet-scan-ui.js(purpose 'label' 옵션 — 기본 'item'이면 기존과 같음), site-life-wallet.js(import 1줄, scope·AAD 함수 2개, vault 메서드 4개, 생성 1줄, 첫 화면 3줄), site-life-wallet.css(끝 블록), scripts/validate_life_wallet_wifi_card_01.mjs(신규), scripts/fixtures/wifi-qr-reference.json·wifi-label-scenes.mjs(신규), asset token

## 1. 반환 사유 반영 — 사진 원본은 어디에도 남지 않고 라벨만 보관
소유자: "사진 찍은 그대로 보여 주면 안 됨. 공유기를 컴퓨터 위에 올려놓고 찍어도 스티커의 아이디·비밀번호 부분 이미지만 나와야 함", "키보드까지 배경까지 나오면 안 됨".
- 찍은 사진은 기기 안에서 QR·글자를 읽는 데만 쓰고 버린다(읽기용 캔버스는 읽은 뒤 크기 0으로 비움). 보관·표시 어디에도 원본 전체를 남기지 않는다.
- 라벨 자르기: 월렛 문서 스캐너를 재사용한다(createWalletDocumentScanner, purpose 'label' — 원근 보정, 회전, 네 모서리 조정 UI 그대로).
  - 라벨 찾기 findLabelCorners: 밝고 색이 옅은 직사각형 덩어리(라벨 종이) 중, 사진 가장자리에 닿지 않고 최소 넓이 사각형을 90% 이상 채우는 가장 큰 것. 기존 감지는 공유기 본체를 "자료"로 잡아 라벨을 놓쳤기 때문에 라벨 용도에서는 이것을 먼저 쓴다. 못 찾으면 기존 감지(긴 라벨 허용)로 넘어간다.
  - 옆으로 누운 라벨은 가로로 세운다(90°, 반대 방향이면 회전 버튼).
  - 들여 자르기: 스캐너가 잘라 준 결과를 다시 가장자리에서 3.5%(최소 2px) 안쪽으로 잘라 보관한다(insetLabelImage, 메타데이터 없는 JPEG). 측정: 들여 자르기 전 테두리 3px의 24~38%가 배경·그림자였고, 들여 자른 뒤 0%.
  - 라벨을 못 찾으면 자동 저장하지 않는다. 모서리 조정 화면이 바로 열리고 "공유기 스티커를 가까이 찍어 주세요. 또는 아래 사진에서 스티커의 네 모서리를 맞춰 주세요."가 나온다. 손으로 맞춘 모서리 안에 인쇄가 없으면 저장 버튼이 꺼진 채로 남는다(기존 규칙). 취소하면 이미지는 보관하지 않는다.
  - 원본이 화면에 보이는 곳은 모서리 조정 칸(손으로 맞출 때만, 저장 안 됨)뿐이다. 자동으로 찾은 경우에는 조정 칸이 닫혀 있다.
- 기존 월렛 동작은 그대로다: allowLong·purpose 기본값이면 영수증 규칙과 화면 문구가 이전과 같다(월렛 검사기 전부 PASS).

## 2. 기능
- 월렛 첫 화면 아래 "와이파이" 칸: 무료 회원도 사용(무료 1개 한도에 세지 않음, 최대 20개), 이름 집·회사·부모님 댁·직접 입력.
- 꺼내 쓰기: 가린 비밀번호, 비밀번호 보기 30초, 비밀번호 복사(잠금 해제 때만, 막히면 직접 복사 칸), 표준 WIFI: QR(\ ; , : " 이스케이프, 1분 뒤 자동 닫힘) — 기기 안 새 인코더 site-qr-encode.js.
- 관리: 스티커 라벨 보기, 수정·삭제 PIN 재확인(틀리면 기존 실패 횟수·잠금 규칙), 열 수 없는 항목은 PIN으로 정리. 잠그면 화면에서 사라지고 남은 버튼으로 복사되지 않는다.

## 3. 자동 읽기 — 기기 안에서만
- 스티커 QR: BarcodeDetector(Android Chrome·Samsung Internet 등). 인쇄 글자: TextDetector가 있을 때만. 둘 다 없으면(iPhone Safari·PC 대부분) 잘라낸 라벨을 보며 직접 입력.
- 범용 OCR 미탑재 근거: 브라우저 표준 글자 인식 API가 없고(TextDetector는 실험 기능), 기기 안 OCR(Tesseract 계열)은 WASM·한국어/영어 학습 데이터만 수십 MB에 휴대폰에서 느리다. 서버 AI·외부 OCR 전송은 금지 조건이다.

## 4. 저장·백업
- 월렛 마스터 키 AES-256-GCM, scope wifi:<scope>, AAD lotbi-wallet-wifi:v1:<scope>:<id>. 카드 덱·무료 한도·공유·백업이 보지 않는다.
- 서버 백업 미포함(통관부호와 같은 판단). 백업 파일도 이번에는 미포함 — 통관부호 includeItems가 main에 들어간 뒤 얹는 것이 후속. 화면에 "서버 백업·백업 파일·공유에는 들어가지 않습니다"라고 쓴다. 서버 요청 0(검사로 확인).

## 5. 통관부호 branch와 겹치는 곳
- 시험 병합: 이 branch 6d2b0b11 + feature/wallet-customs-code-p0-site dbe104f6(로컬 폴더에서 FETCH_HEAD로만 읽음). 기준 5675fd3d. token 정규화 시 텍스트 충돌 0, 충돌 75파일은 전부 asset token → `node scripts/asset_cache_version.mjs --write`.
- 인접 지점(둘 다 유지): site-life-wallet.js import 줄, vault 메서드(서로 다른 위치), mountLifeWallet(통관부호 customsCode 인자 / 와이파이 생성 1줄), renderWallet(와이파이 목록은 툴바 전에 읽고, 칸은 통관부호 카드 다음), CSS 끝 블록. scan.js·scan-ui.js는 통관부호 branch가 바꾸지 않는다.
- 통관부호 계약 준수: exportBackup에 includeItems를 넘기지 않고, 와이파이는 canExportWalletBackup 개수에 넣지 않는다.
- 합친 상태 검사: wifi_card_01, customs_code_p0, share_01, document_scan_ui_02, entry_lock_01 PASS.

## 6. 검사 (Windows, 하나씩 실행)
- NEW validate_life_wallet_wifi_card_01 PASS:
  - 라벨만 보관: 키보드·책상·공유기 본체 합성 사진 4종(기울임 4°/−6°, 옆으로 누움, 본체 없음) → 자동으로 라벨 찾음, 보관본 테두리 3px 안 배경 화소 0개(키보드·본체 = 어두운 무채색, 책상 = 갈색으로 판정, 라벨 인쇄는 파란색이라 구분), 가로로 세워짐, 비율 오차 6% 안, 크기 ≤ 라벨 크기. 라벨 없는 사진 → 모서리 조정 바로 열림·저장 꺼짐·안내 문구. 양식 안에서도 같은 흐름, 저장 후 양식에 캔버스·스캐너 없음, 관리의 라벨 보기 = 보관본.
  - WIFI: 이스케이프·되읽기, 입력 규칙, 스티커 글자, QR 인코더 = Python qrcode(버전 1~20, 마스크 0~7, 28개), 가린 비밀번호·30초·복사, 화면 QR = 인코더 행렬, 틀린 PIN 거부, 비밀번호 없는 와이파이, IndexedDB 평문 없음, 덱·백업에 없음, 네트워크 0, 잠그면 사라짐, 360px 라이트·다크.
- 월렛 검사기 전부 + 사이트 기본 검사 27개 PASS(6d2b0b11 내용).
- 실기기 NOT VERIFIED: 실제 공유기 스티커 촬영(반사·작은 글씨·색 라벨), Android BarcodeDetector, iPhone, 손님 폰 QR 연결. 흰 공유기 위의 흰 라벨처럼 라벨과 본체 색이 같으면 라벨 찾기가 본체를 잡거나 못 찾을 수 있다(그때는 모서리 조정 화면).
