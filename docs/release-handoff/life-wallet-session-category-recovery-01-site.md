# Life Wallet 세션·자료 종류 복구 — Gate 전 인수인계

## 상태

- 범위: Site Life Wallet만.
- 기준 main: `29cc6b13a7e081dda6a224717f50d0efcfa53e25`.
- 구현 커밋: `64d5347c25da64459dac54c8006ef85aefbb3cf2`.
- main 병합 및 Production 배포: 수행하지 않음.
- Gate: 아직 요청하지 않음.

## 복구한 동작

1. Site 세션을 복원하는 동안 열린 Life Wallet은 빈 세션으로 로그인 게이트에 고정되지 않는다. bearer가 채택된 뒤, 동일한 잠긴 월렛 화면일 때만 다시 열어 월렛 PIN 화면으로 이어진다. 사용자가 그 사이 다른 화면을 열면 그 화면을 닫지 않는다.
2. 새 자료 등록 시 자료 종류를 사용자가 직접 선택한다. 신분·자격 자료, 회원증, 증명서, 기타 등 기존 `CARD_KINDS` 메타데이터만 저장한다. 사진 자동 분류를 새로 만들지 않는다.

## 데이터·보안 보존

- 기존 암호문, PIN, 기기 키, 저장 자료, 백업 레코드의 형식·키·마이그레이션을 바꾸지 않는다.
- 종류 선택은 새 항목의 암호화 메타데이터만 정한다.
- 사진 전처리와 자동 자르기는 기존 브라우저 내부 처리 경로를 유지한다. 원본과 보정 사진을 대화창이나 일반 서버 업로드 경로로 보내지 않는다.

## 통과한 검사

- `node scripts/asset_cache_version.mjs`
- `node scripts/validate_life_wallet_entry_lock_01.mjs`
- `node scripts/validate_auth_continuity_02.mjs`
- `node scripts/validate_life_wallet_document_save_01.mjs`
- `node scripts/validate_consumer_sections_02.mjs`
- `node scripts/validate_life_wallet_pdf_01.mjs`
- `node scripts/validate_life_wallet_camera_parity_01.mjs`
- `node --check site-life-wallet.js`
- `node --check site-conversation.js`

## 아직 확인할 것

- 실제 Account 세션 갱신 중 Production 브라우저에서 PIN 화면으로 재진입하는 E2E.
- 실기기 카메라로 찍은 개인정보 없는 신분증 형상 샘플의 자동 자르기 확인.
- Ncloud feature exact HEAD의 CI와 Gate 결과.
- Production served revision과 사용자 E2E. 이 문서는 배포 가능 판정이 아니다.
