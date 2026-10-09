READY_FOR_DEPLOY=YES

STATUS=PIN·삼성패스 저장 제안 원인 제거 + 자료 첨부 한 흐름(카메라 / 내 파일) + 카메라 다녀와도 자료 추가 화면 유지. 실기기(삼성 인터넷·Android Chrome·iPhone Safari) NOT TESTED — 배포 후 실기기 smoke 필수(아래 목록).

# life-wallet-pin-attachment-ux-p0-site — release handoff (Life Wallet PIN·삼성패스·자료 첨부 UX P0)

REPO=lotbi-site
FEATURE_BRANCH=feature/life-wallet-pin-attachment-ux-p0-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ssh://lotbi-ncloud-git/srv/git/repositories/lotbi-site.git refs/heads/feature/life-wallet-pin-attachment-ux-p0-site`)
BASE_MAIN_SHA=576ec3465e3685e21fbe26a02a02129c76667739 (Ncloud main, SITE-T43 01:01 운영본 = 내 아이 학교 Site + Footer 호스팅; 작업 시작 da861120 → push 직전 ls-remote 재확인 576ec346)
CODE_SHA=d8dd00e732e8c4b50ac830f87f4aabb5561f9456
CODE_COMMITS=
  953d260e fix(site): Life Wallet PIN is not a website login; one attach flow (카메라 / 내 파일)
  9fb21705 ci(site): site-review.yml 월렛 단계에 validate_life_wallet_pin_attachment_ux_p0 추가
  df0f577a merge Ncloud main 576ec346 (충돌 0; 병합 트리 vs main 차이 = 이 branch의 월렛 3파일·validator 4개·workflow 1줄뿐)
  d8dd00e7 chore: asset token 재생성(토큰 줄만, 69파일, 삭제 0)
ASSET_VERSION=aset-c59eb03d8c21 (`node scripts/asset_cache_version.mjs --write`, check PASS targets=138 refs=166)
DEPLOY_SCOPE=lotbi-site only (site-life-wallet.js, site-life-wallet.css, site-life-wallet-scan-ui.js, validators, site-review.yml 한 줄). Core·Web·Admin·App 무변경. LOTBI 앱 월렛은 React Native 네이티브(별도) — 무관.
DEPLOY_ORDER=단독(SITE). 다른 Site train과 겹칠 수 있는 곳 = asset token 줄뿐.
CORE_CHANGED=NO
MIGRATION=NONE
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
STORED_DATA_CHANGED=NO (암호화 규격·PIN KDF 310,000·AES-GCM·기기 키·세션 grant·IndexedDB 구조 그대로, 재암호화·삭제 없음)
USER_DECISION_NEEDED=NONE
SECURITY_RELEASE_HOLD=유지 — 2026-10-05 감사 4건 미해결로 걸린 "민감 문서 원본 공유 HOLD"는 이번 UX 수정과 무관, 해제 주장하지 않음

## 문제 A — 삼성패스 "로그인 정보 저장" 제안

SAMSUNG_PASS_PROMPT_CAUSE=월렛 PIN 칸(만들기·잠금 해제·변경·삭제 확인)이 전부 `type=password`. Chromium 비밀번호 관리자는 password 칸이 있는 폼을 로그인/비밀번호 변경 폼으로 보고 autocomplete=off를 무시한다. PIN 만들기 폼(새 PIN + 확인)을 제출하고 칸을 비우면 "비밀번호 변경 폼 정리됨"을 로그인 성공 신호로 보고 저장 제안을 띄운다. 삼성 인터넷은 Chromium 기반이고 삼성 패스가 이 저장 제안을 받는다.
EVIDENCE (chrome://password-manager-internals, Chrome 데스크톱 headless 새 프로필, 실제 키 입력·실제 탭, 합성 PIN):
  - main 코드(da861120·576ec346 두 번 측정, 같은 결과): "Form is a password form" 4회, `AskUserOrSavePassword` 1회, `Successful submission indicator event: CHANGE_PASSWORD_FORM_CLEARED`, `The new state of the UI: PENDING_PASSWORD_STATE` → **"Show password prompt" 1회**
  - 이 branch: password form 0회, ProvisionallySaveForm 4회 모두 "No matching form", 저장 제안 0회
  - 계정 로그인(lotbi-web Account)의 저장 제안은 원래 정상 동작(실제 로그인 비밀번호) — 이번 수정 범위 밖, 손대지 않음
FIX:
  - PIN 칸 4곳 = 가린 텍스트 칸(`type=text` + `-webkit-text-security: disc`, `inputmode=numeric`, 잠금 해제는 기존대로 `inputmode=none` 키패드), `autocomplete=off`·`autocorrect=off`·`autocapitalize=off`·`spellcheck=false`, LastPass·1Password·Bitwarden·Dashlane 건너뛰기 힌트. `-webkit-text-security`를 모르는 브라우저는 password 유형 유지(숫자가 보이는 일 없음).
  - 휴대폰(coarse pointer)에서 PIN 만들기·PIN 변경·백업 암호 화면이 열리자마자 칸에 자동 포커스하지 않음(키보드·로그인 바 자동 표시 제거). 오류 뒤 재입력 포커스·삭제 확인 포커스는 사용자가 누른 뒤라 유지.
  - PIN 만들기 안내 "PC에서는 …" → "월렛은 계정 로그인과 별도로 월렛 전용 PIN으로만 열립니다."
  - 백업 암호: password 유형 유지(휴대폰 키보드가 백업 암호를 학습하지 않게). 복원 칸 `autocomplete=current-password`(저장된 계정 비밀번호 채우기를 부름) → `off`. 백업 만들기 흐름 측정: main·branch 모두 저장 제안 0회.
  - 삼성패스·브라우저 자격증명 API 호출 없음. PIN·키·백업 암호 로그 출력 없음(코드에 console 없음).
NATIVE_LIMIT=삼성 인터넷 자체·Android 자동완성 서비스가 사이트와 무관하게 제안하는 경우는 사이트가 막을 수 없다. LOTBI 쪽 원인(password 칸)은 제거했고, 실기기에서 제안이 사라졌는지는 NOT TESTED.
SECURITY_KEPT=PIN 4자리 검증, 실패 3회부터 대기·5회 차단, 10분 미사용 잠금, 로그아웃·세션 만료 잠금, 백그라운드 전환 시 키 메모리 제거, 로컬 암호화 — 모두 그대로(validate_life_wallet_entry_lock_01 PASS).

## 문제 B — 자료 추가 버튼 중복

- 빈 월렛: `첫 자료 등록하기`만(상단 `+ 자료 추가` 숨김). 자료가 있으면 `+ 자료 추가`만.
- 자료 추가 화면: `자료 첨부` / `사진 또는 PDF를 등록할 수 있어요.` 아래 첨부 영역 하나(버튼). 누르면 메뉴 두 가지: `카메라 — 직접 촬영`, `내 파일 — 기기에 저장된 사진·PDF 선택`. 기존 `+` 칸·`사진 선택`·`PDF` 버튼과 스캐너 안 `다시 선택` 제거.
- 선택 뒤: 미리보기 + 파일 이름(길면 한 줄 말줄임) + `파일 변경`(영역을 눌러도 같은 메뉴). 메모 선택 사항 유지. `암호화하여 저장`은 스캔 확인이 끝난 자료가 있을 때만 켜짐.

## 문제 C — Android 파일 선택창

- 카메라: `accept="image/*"` + `capture="environment"` → 휴대폰 카메라 바로 실행(갤러리 목록·캠코더·녹음기 없음).
- 내 파일: `showOpenFilePicker`가 있는 브라우저(Chrome Android 132+, 데스크톱 Chrome·Edge)는 문서 선택기(카메라 앱 없음, 사진·PDF 필터). 없으면 `accept="image/*,application/pdf"` 입력 하나.
- Chromium 원문 확인(SelectFileDialog.java main): 현재 Chrome은 이미지 형식이 있으면 카메라만 추가하고 영상 형식이 없으면 캠코더를 넣지 않음. 기존 PDF 전용 칸은 예전 Chromium 규칙(형식 1개가 미디어가 아니면 카메라·캠코더·녹음기를 모두 넣는 일반 선택창)에서 "카메라 / 카메라 캠코더 / 파일"이 뜨는 원인으로 보임(삼성 인터넷 기반 버전은 확인 불가).
NATIVE_PICKER_LIMITATIONS=문서 선택기가 없는 브라우저에서 `내 파일`을 누르면 Android 시스템 선택창이 카메라 항목을 함께 보여줄 수 있음(예전 엔진은 캠코더까지). iPhone Safari는 `내 파일`에서 사진 보관함/사진 찍기/파일 선택 메뉴를 OS가 띄움. 기기에 카메라 앱이 둘이면 둘 다 보일 수 있음. 사이트가 통제할 수 없음.
- 두 번 누름: 선택창이 열리는 1.5초 동안 두 번째 탭 무시(선택·취소 시 즉시 해제).
- 같은 파일 다시 선택: 고를 때마다 입력을 비움.
- 취소·거절·용량 초과: 이전 사진·미리보기·열린 스캐너 그대로, 오류 문구만.
- 교체: 새 파일이 통과한 뒤에만 이전 스캐너 정리(ImageBitmap close·object URL 해제·PDF destroy는 기존 scanner.destroy).
- **카메라 왕복 화면 유지(새로 발견, 수정)**: 휴대폰에서 카메라·파일 선택창이 열리면 페이지가 숨김 상태가 되고, 기존 코드는 0.15초 뒤 월렛 화면을 비워 돌아오면 자료 추가 화면과 찍은 사진이 사라졌다. 이제 첨부 메뉴로 선택창을 연 경우에만 자료 추가 화면을 남긴다(저장된 자료는 그 화면에 없음). 열쇠는 기존처럼 메모리에서 내리고, 돌아오면 세션 grant(10분)로 다시 열며, grant가 없거나 만료면 잠금 화면. 숨김 동안 저장 시도는 거부됨(검사로 확인). 선택창 없이 백그라운드로 가면 기존처럼 화면을 비움.
- 형식·크기·내용 검사(JPG·PNG·WebP·HEIC/HEIF·PDF, 사진 30MB·PDF 20MB, 바이트 sniff), 스캔·보정·회전·PDF 1쪽·글자 줄 판정·반사 차단, 원본 서버 미전송 경계 모두 그대로.

## 검증

TEST_STATUS=병합 트리(d8dd00e7)에서 `scripts/validate_*` 전부 255개(mjs 233·py 21·js 1) 직렬 실행(CHROME_BIN 지정): 251 PASS / 4 FAIL.
  - validate_place_card_compact_01: 'result missing'(부하성) → 단독 재실행 PASS(main 사본도 PASS).
  - validate_image_attachment_thumbnail_01 / validate_mobile_footer_legal_sheet_01 / validate_site_avatar_fallback_runtime: main 576ec346 사본(같은 CRLF checkout)에서 같은 메시지로 FAIL — 이 PC 기존 Windows 실패(이전 월렛 READY 문서와 동일 목록).
NEW_FAILURES=0
KNOWN_BASELINE_FAILURES=validate_image_attachment_thumbnail_01, validate_mobile_footer_legal_sheet_01, validate_site_avatar_fallback_runtime (main도 동일 실패)
FOCUSED=새 `validate_life_wallet_pin_attachment_ux_p0.mjs`(실제 headless Chrome, 휴대폰 크기·터치) PASS:
  - PIN 칸 만들기 2·변경 3·잠금 해제 1·삭제 확인 1 = type text, 가림 disc, autocomplete off, 확장 건너뛰기 힌트, 휴대폰 자동 포커스 없음, 잠금 해제 inputmode none
  - 빈 월렛 버튼 = 첫 자료 등록하기만, 자료 저장 뒤 = + 자료 추가만
  - 첨부: 입력 2개(카메라 image/* capture=environment, 내 파일 image/*,application/pdf), 보이는 버튼 = 첨부 영역 1개, 메뉴 정확히 2개, Esc 닫힘, 두 번 탭 → 선택창 1개, 취소 후 즉시 다시 열림, 문서 선택기(제외 옵션·6형식) 사용 / AbortError 무변화 / 없으면 입력, GIF·텍스트 거절, 사진 31MB·PDF 21MB 거절, 취소·거절·초과 뒤 기존 사진 유지, 같은 파일 재선택 = 새 검사, 교체 시 이전 스캐너 제거, PDF 1쪽, 긴 파일명 한 줄 말줄임·가로 넘침 없음(360px)
  - 카메라 왕복: 선택창 없이 백그라운드 → 화면 비움(기존 보호 유지), 카메라 메뉴 → 숨김 0.4초 동안 자료 추가 화면 유지·숨김 중 저장 거부("잠금")·돌아오면 저장 → 잠그기 → 키패드 해제 → 상세 이미지 복호화 → 틀린 PIN 삭제 거부 → 맞는 PIN 삭제, 세션 grant 없으면 돌아올 때 잠금 화면
  - 갱신한 기존 검사(이전 구조 전제, 기준 낮추지 않음): photo_picker_01(영역→메뉴→각 입력 실제 클릭, 입력 2개, 파일 변경), mobile_p0_01(카메라 사진은 카메라 입력으로, 입력 계약·PIN text), document_save_01(스캐너 다시 선택 없음 + 새 파일 선택 시 이전 스캐너 제거)
  - 월렛 관련 17개 전부 PASS(camera_parity·card_deck·document_save·scan_01·synthetic_02·scan_ui_01/02·entry_lock·full_frame·glare·mobile_p0·pdf·photo_picker·pin_attachment·storage_persist·upright_print·consumer_sections_02)
PASSWORD_MANAGER_EVIDENCE=Chrome headless 새 프로필 + chrome://password-manager-internals, PIN 만들기→잠금 해제(키패드)→PIN 변경→재해제, 실제 키 입력·탭: main 576ec346 = password form 4·PENDING_PASSWORD_STATE 18·AskUserOrSavePassword 1·**Show password prompt 1** / branch = 0·0·0·0(ProvisionallySaveForm 4회 모두 "No matching form"). 백업 만들기 흐름 = 둘 다 저장 제안 0.
EXISTING_DATA_COMPATIBILITY=PASS — main 576ec346 모듈로 금고(PIN)·자료 2건(문서 kind·옛 identity kind) 생성 → 저장소 원문에 메모·이미지 평문 없음 → 새 모듈: PIN 없이 목록 거부("잠금을 먼저 해제"), 틀린 PIN 거부, 키패드 해제로 2건 표시(카드·문서 모양), 상세 복호화, 새 UI로 PIN 변경 → 새 PIN 해제 → 옛 모듈도 새 PIN으로 2건 읽음, 새 모듈 백업 → 옛 모듈 복원 2건. 재암호화·IndexedDB 삭제 없음.
SCREENS=360/375/390/412px × 라이트/다크(body data-site-theme) + 1280px: PIN 만들기(가림 점), 빈 월렛, 자료 추가, 메뉴, 스캔 중, 선택 완료 — 가로 넘침 0, 저장 버튼은 확인된 자료일 때만 켜짐.
REAL_DEVICE=NOT TESTED (이 PC에 삼성 인터넷·Android·iPhone 실기기·에뮬레이터 없음). 실기기 PASS 주장 없음.

## 실기기 smoke 목록(배포총괄방·소유자)

삼성 인터넷 Android(필수), Android Chrome, iPhone Safari, 다크모드:
1. 월렛 첫 진입 → PIN 만들기·잠금 해제·PIN 변경·자료 삭제 PIN 확인 각각에서 "로그인 정보 저장/삼성 패스" 제안이 뜨지 않는지(뜨면 화면 캡처 + 어느 단계인지). 계정 로그인 화면의 저장 제안은 정상.
2. 잘못된 PIN 문구, 10분 자동 잠금, 브라우저 종료 후 재진입 시 PIN 요구.
3. 빈 월렛 버튼 1개(첫 자료 등록하기), 자료 추가 → 자료 첨부 → 메뉴 2개.
4. 카메라 → 카메라 앱 바로 실행(캠코더·녹음기 없음) → 촬영 후 자료 추가 화면으로 돌아와 스캔 화면 표시 → 저장.
5. 내 파일 → 사진 선택, 내 파일 → PDF 선택(1쪽), 선택창 취소 후 화면 그대로, 같은 파일 다시 선택, 파일 변경, 빠른 두 번 탭에 선택창 1개.
6. 저장 → 잠그기 → PIN → 자료 열림(복호화).
