# LIFE-WALLET-VERTICAL-DECK-01 — Site READY

- STATUS: `READY`
- REPOSITORY: `lotbi-site`
- BRANCH: `feature/life-wallet-vertical-deck-01-site`
- BASE_NCLOUD_MAIN: `29cc6b13a7e081dda6a224717f50d0efcfa53e25`
- INHERITED_FIXES: `68024e028ab08fecc7c3590d099f52e6f8bb3e5b`, `a39183f72d4a68aaf328d0942099b3fc79ca3d9d`, `abf74353e40d26261683e5b986345cffa43e0f69`
- CODE_SHA: `1cffda9c4db05b645633a89b11eee21fe1e16b74`
- ASSET_VERSION: `aset-9b0f05e59974`

## 구현 범위

- 자료 종류를 `전체 · 신분증 · 명함 · 증명서·문서 · 기타`로 분리했다.
- 새 자료의 종류는 자료와 함께 기존 암호화 경로로 저장한다. 기존 `kind`·암호문·PIN·기기 키·백업 형식은 변경하지 않았다.
- 기존 자료는 명확한 구형 종류·이름만 안전하게 대응하고, 근거가 없는 자료는 `기타`로 표시한다. 원본 이미지 내용은 분류에 사용하지 않는다.
- 가로형 자료 카드를 실제 지갑처럼 세로로 겹쳐 표시한다. 선택 자료는 전체가 보이고, 뒤 자료는 제목과 윗부분만 보인다.
- 위·아래 드래그와 키보드 위·아래 키를 지원하며, 마지막→첫 번째와 첫 번째→마지막을 순환한다. 카드 이미지는 회전하지 않는다.
- 뒤 카드 선택, 단일 자료, 빈 월렛, 빈 분류, 삭제된 선택 자료를 안전하게 처리한다.
- 마지막 선택 자료의 불투명 식별자와 선택 분류만 계정 해시별 `localStorage`에 저장한다. 사진·메모·PIN·암호화 키는 저장하지 않는다.
- 개인통관고유부호와 Wi-Fi를 카드 묶음 아래 `생활정보` 영역에 유지했다.
- 사진·PDF 자동 보정과 불확실 시 저장 차단, PIN, 잠금, 암호화 저장·백업·공유 정책을 보존했다. 고객용 수동 모서리·회전 조정은 추가하지 않았다.

## 변경 파일

- 실질 코드: `site-life-wallet.js`, `site-life-wallet.css`
- 회귀 검사: `scripts/validate_life_wallet_card_deck_01.mjs`, `scripts/validate_life_wallet_entry_lock_01.mjs`, `scripts/validate_life_wallet_customs_code_p0.mjs`
- 자산 캐시: `site-asset-version.json` 및 생성 스크립트가 갱신한 참조 파일 86개

자산 참조 86개는 기준 커밋과 버전 문자열을 제거해 비교했으며 자산 토큰 외 변경이 없었다. 캘린더·대화·다른 Work UI의 실제 코드와 디자인 바이트는 변경하지 않았다.

## 검증

- `scripts/validate_life_wallet_*.mjs` 21개 전부 `PASS`
- 자동 보정 합성 장면 149개 `PASS`
- 카메라·갤러리 동일 처리, EXIF 1/2/3/6/8, 48MP 제한, 원근, HEIC 설명, PDF 첫 페이지·작은 카드 `PASS`
- 카드/지갑 배경, 전체 페이지, 펼친 문서, 기울기, 반사광 차단, 세로 인쇄 방향 `PASS`
- 세로 카드 묶음: 1200/412/360px, 순환, 뒤 카드 선택, 빈 분류, 단일 자료, 잠금 재진입 위치 복원 `PASS`
- PIN·잠금·IndexedDB 암호화·백업·공유·Wi-Fi·개인통관고유부호 `PASS`
- `validate_common_ui_polish_01.mjs`, `validate_photo_input_no_camcorder_01.mjs`, `validate_subview_back_navigation_01.mjs` `PASS`
- `scripts/asset_cache_version.mjs` `PASS` (`targets=169`, `refs=206`)
- `git diff --check` `PASS`

모든 이미지 검사는 개인정보 없는 합성 자료로 실행했다. Production 사용자 데이터, 실제 신분증 원본, 운영 DB, Secret, 유료 AI 호출은 사용하거나 변경하지 않았다.

## 배포 경계와 미검증

- `READY_FOR_DEPLOY=YES`는 feature 통합 후보라는 뜻이며 배포 완료가 아니다.
- `MERGED=NOT_VERIFIED`
- `DEPLOYED=NOT_VERIFIED`
- `ACTUAL_E2E_PASS=NOT_VERIFIED`
- Android/iOS Native 생체인증 및 네이티브 제스처 재사용: `NOT_VERIFIED` (`CORE-T51` / `APP-T27` HOLD 유지)
- 실제 기기와 Production의 민감 원본 업로드·저장: 실행하지 않음
- 자동 종류 분류 신규 개발: 이번 범위 제외. 이번 구현은 사용자 선택과 안전한 구형 자료 매핑만 제공한다.

## 다음 담당

Claude 배포총괄이 최신 Ncloud `main`과 이 feature를 trusted gate에서 정상 merge 검증하고, 자산 토큰 충돌은 최종 트리에서 `node scripts/asset_cache_version.mjs --write`로 재생성한다. main 병합·Production 배포·실제 사용자 자료 시험은 이 작업에서 실행하지 않는다.
