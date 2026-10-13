# LIFE-WALLET-PIN-DESIGN-01 — Site READY

- STATUS: `READY`
- REPOSITORY: `lotbi-site`
- BRANCH: `feature/life-wallet-pin-design-01-site`
- BASE_NCLOUD_MAIN: `48e5f06d43914c3923ef474477880aedf062c583`
- CODE_SHA: `ce53582ea5f8961274783e764bffeb078247bbe8`
- ASSET_VERSION: `aset-b895d2ff4742`

## 확정 구현

- 사용자가 제공한 기존 최종 시안을 기준으로 Desktop Web PIN 화면을 복원했다.
- 잠금 화면은 원형 파란 자물쇠 표식, 4개 PIN 표시점, 넓은 3열 키패드와 파란 `열기` 버튼을 사용한다.
- Mobile Web은 동일한 PIN 흐름을 한 손 조작 크기로 표시하며 생체인증 지원을 주장하지 않는다.
- Life Wallet 제목 아래 문구를 `내 생활자료를 안전하게 보관해요.`로 통일했다.
- 열린 월렛은 `전체 · 신분증 · 명함 · 증명서·문서 · 기타` 필터와 세로 카드 덱, 위·아래 순환, 현재 위치, 전체 폭 `상세 보기` 버튼을 사용한다.
- 잠금·설정은 아이콘과 텍스트로 유지하며, 모바일 추가 버튼은 `+ 추가`로 축약한다.
- 개인통관고유부호와 Wi-Fi 등 `생활정보`는 카드의 `상세 보기` 아래 24px 간격을 두고 별도 영역으로 표시한다.
- PIN·기기 키·IndexedDB 암호화·서버 백업·공유·중복 저장 방지·자동 보정 및 저장 차단 정책은 변경하지 않았다.

## 디자인 증거

- 교차 플랫폼 비교판: `docs/design/evidence/life-wallet-cross-platform-final.png`
- 개별 시안 8장: `docs/design/evidence/individual/`
- Desktop/Mobile Web 시안은 이번 Site 구현 기준이다.
- Android 생체인증 및 iPhone Face ID 화면은 확정 디자인 자료일 뿐 이번 Site 코드에 네이티브 생체인증을 추가하지 않았다.

## 검증

- `scripts/validate_life_wallet_*.mjs` 23개 전부 `PASS`
- 합성 촬영 장면 149개 `PASS`
- 카메라·갤러리 동일 처리, EXIF 1/2/3/6/8, 48MP 제한, 원근·반사광·전체 페이지·PDF 첫 페이지 자동 보정 `PASS`
- 합성 PDF 자동 보정 → PIN 기반 암호화 저장 → 재복호화 확인 `PASS`
- Desktop 1200px 및 Mobile 360/390/412px PIN·카드 덱·가로 오버플로 검사 `PASS`
- PIN, 잠금, 암호화 저장, 백업, 공유, Wi-Fi, 개인통관고유부호 회귀검사 `PASS`
- `validate_common_ui_polish_01.mjs`, `validate_photo_input_no_camcorder_01.mjs`, `validate_subview_back_navigation_01.mjs`, `validate_consumer_design_shell_01.mjs`, `validate_conversation_sidebar_ux_01.mjs` `PASS`
- `scripts/asset_cache_version.mjs` `PASS` (`aset-b895d2ff4742`, targets=172, refs=211)
- `git diff --check` `PASS`

모든 사진·PDF 검사는 개인정보 없는 합성 자료만 사용했다. 실제 신분증, 운영 사용자 데이터, 운영 DB, Secret, 유료 AI 호출은 사용하거나 변경하지 않았다.

## 배포 경계

- `READY`는 Ncloud feature 통합 후보라는 뜻이며 Production 배포 완료가 아니다.
- `MERGED=NOT_VERIFIED`
- `DEPLOYED=NOT_VERIFIED`
- `ACTUAL_PRODUCTION_E2E=NOT_VERIFIED`
- Android/iOS Native 생체인증 구현: `NOT_INCLUDED`; 별도 App 기술·보안 검증 필요
- Production 실제 사용자 자료 시험: 실행하지 않음
- DB migration: 없음
- 새 환경변수·Secret: 없음

## 총괄 확인 사항

- 최신 Ncloud main에 일반 merge 방식으로 통합한다. 브랜치 전체 덮어쓰기·force push를 하지 않는다.
- 자산 토큰 충돌 시 최종 트리에서 `node scripts/asset_cache_version.mjs --write`로 다시 생성한다.
- 배포 후 합성 자료로 PIN 잠금 화면, 카드 덱, 생활정보 스크롤 위치만 확인하고 실제 신분증을 사용하지 않는다.
