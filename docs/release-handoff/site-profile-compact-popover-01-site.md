# SITE-PROFILE-COMPACT-POPOVER-01 READY

- `READY_FOR_DEPLOY=YES`
- 작성 시각: `2026-10-12 11:17 KST`
- 저장소: `lotbi-site`
- 브랜치: `feature/site-home-favorites-01-site`
- 기준 Ncloud `main`: `29cc6b13a7e081dda6a224717f50d0efcfa53e25`
- 구현 commit: `3e17a1a3a93fb5c5e87c832ebcabde267b55a456`
- 기존 홈 작업 commit: `1d69f2740fce6a32a36fb88a9810fd8d1c1c7b64`
- 사용자 승인 원본: `C:\Users\jshnc\.codex\generated_images\01a12835-1b79-7642-a7d9-f6887cde4606\exec-d4e1b894-4e4e-48b0-bb01-a808254fb0e9.png`

## 목적과 적용 범위

홈 왼쪽 아래 프로필 카드를 누르면 바로 위에 276×244px 소형 팝업을 표시한다. 상단에는 사진, 이름, 이용 등급, 닫기 버튼만 두고 동작은 `프로필 관리`, `설정`, `로그아웃` 세 개만 유지했다. 배경 어둡게 처리는 사용하지 않는다.

- `프로필 관리`: 기존 Account 프로필 경로 `https://account.lotbiai.com/account#profile`
- `설정`: 기존 Account 전체 설정 경로 `https://account.lotbiai.com/account`
- `로그아웃`: 기존 Site 세션 해제와 Account 로그아웃 handoff 유지
- 닫기: X, 프로필 카드 재선택, 바깥 클릭, Escape
- 접근성: 닫기와 각 메뉴 동작 44px 이상, 닫기 후 프로필 카드로 focus 복귀, menu/menuitem 의미 유지
- 모바일: 같은 세 항목, 실제 전체 스타일에서 360px 화면 안에 276×244px로 수용

홈 로고, 메뉴명, 대화, 입력창, 즐겨찾기, 장소 카드 회전 동작은 변경하지 않았다. 공통 asset cache token 갱신으로 표시된 파일은 내용 변경 없이 참조 버전만 바뀌었다.

## 주요 변경 파일

- `site-conversation.js`
- `site-conversation.css`
- `site-consumer-design.css`
- `site-consumer-layout.css`
- `site-sidebar-nav.css`
- `scripts/validate_profile_compact_popover_01.mjs`
- `.github/workflows/site-review.yml`
- `site-asset-version.json` 및 cache token 참조 파일

## 새 검사기

- `scripts/validate_profile_compact_popover_01.mjs`
  - 세 동작의 정확한 순서, 상세 항목 제거, 상단 표시 정보, X 버튼, 276×244px, 투명 배경, 44px, 모바일 경계, Account 이동, 로그아웃, focus 복귀, 바깥 클릭/Escape를 고정한다.
  - `.github/workflows/site-review.yml`의 `Validate approved compact profile popover` 단계에 등록했다.

## 승인안에 맞춰 갱신한 기존 검사기와 이유

- `validate_profile_menu_improvement_01.mjs`: 기존 여섯 항목 기대를 승인된 세 항목으로 교체하고 X/바깥/Escape/토글 닫기, focus 복귀, 크기, 대화 보존을 동등하게 검사한다. Chrome 프로필은 실행 직전에 `fs.mkdtempSync`로 만들고 종료 시 제거한다.
- `validate_profile_menu_personal_theme_01.mjs`: 소형 메뉴 세 항목을 고정하면서 기존 Core 프로필 사진 저장·실패·삭제 회귀 검사를 그대로 유지한다.
- `validate_single_profile_entry_01.mjs`: 단일 프로필 진입점의 최종 항목 집합을 갱신했다.
- `validate_consumer_design_shell_01.mjs`: 승인된 상단 요약과 메뉴 구조를 반영했다.
- `validate_conversation_sidebar_ux_01.mjs`: 비동기 focus 복귀 계약을 반영했다.
- `validate_profile_handle_to_account_01.mjs`: 팝업에서 공개 handle/email을 숨기는 승인 범위를 반영했다.
- `validate_common_ui_polish_01.mjs`: 메뉴 항목 수와 닫기 컨트롤 계약을 갱신했다.
- `validate_connected_services_menu_hidden_01.mjs`: 연결 서비스 바로가기가 소형 팝업에 노출되지 않음을 고정했다.
- `validate_theme_auto_schedule_02.mjs`: 프로필 팝업 세 항목을 반영하면서 자동 테마 회귀 검사를 유지했다. Chrome 프로필은 실행 직전 `mkdtemp`로 만든다.
- `validate_social_signup_profile_ux_01.mjs`: 소셜 가입 뒤 사이드바 식별자는 보존하고 팝업에는 이름과 등급만 표시하는 계약으로 갱신했다.

## 검사 결과

- `SITE-PROFILE-COMPACT-POPOVER-01 PASS`
- `SITE-PROFILE-MENU-IMPROVEMENT-01 RUNTIME PASS` — 1440×900, 390×844
- `SITE-PROFILE-MENU-PERSONAL-THEME-01 RUNTIME PASS` — desktop/mobile, 사진 저장·오류·삭제 포함
- `SITE-CONVERSATION-SIDEBAR-UX-01 CONTRACT PASS`
- `SITE-THEME-AUTO-SCHEDULE-02 OK`
- `COMMON-UI-POLISH-01 PASS`
- `SITE-CONNECTED-SERVICES-HIDE-01 PASS`
- `SOCIAL-SIGNUP-PROFILE-UX-01 PASS`
- `SITE-NAV-SINGLE-PROFILE-ENTRY-01 OK`
- `CONSUMER_DESIGN_SHELL_01 PASS`
- `SITE-PROFILE-HANDLE-TO-ACCOUNT-01 OK`
- `SITE-UIUX-PHASE1-01 PASS`
- `SITE VALIDATION PASS`
- `HOME CHAT VALIDATION PASS`
- `SITE-HOME-FAVORITES-01 PASS` — 360/1280, light/dark, CRUD/order/reload/send 상태
- `SITE-ASSET-CACHE-COHERENCE-01 PASS` — `aset-6beb79050938`
- `git diff --check` PASS

## 화면 증거

- `C:\Users\jshnc\Documents\Codex\2026-10-11\1-t56-1-ready-github-workflows\outputs\profile-compact-popover\360-light-open.png`
- `C:\Users\jshnc\Documents\Codex\2026-10-11\1-t56-1-ready-github-workflows\outputs\profile-compact-popover\360-dark-open.png`
- `C:\Users\jshnc\Documents\Codex\2026-10-11\1-t56-1-ready-github-workflows\outputs\profile-compact-popover\1280-light-open.png`
- `C:\Users\jshnc\Documents\Codex\2026-10-11\1-t56-1-ready-github-workflows\outputs\profile-compact-popover\1280-dark-open.png`

네 화면 모두 전체 Site 스타일을 적용했으며 팝업 실측값은 276×244px, 가로 overflow는 0이다.

## 원격·드리프트·보존

- commit 직전 Ncloud `main`: `29cc6b13a7e081dda6a224717f50d0efcfa53e25`
- `origin/main...구현 commit`: main ahead `0`, feature ahead `3`
- 기존 owner 브랜치를 계속 사용했고 중복 브랜치를 만들지 않았다.
- 장소 카드, 홈 즐겨찾기, 대화 공통 동작은 기존 branch 내용을 보존했다.
- Production, DB, Secret, LIVE MONEY, 유료 인프라, 소셜 공개 설정 변경 없음.

## 미검증

- Account 도메인으로 실제 이동한 뒤의 프로필/설정 화면 조작: `NOT_TESTED` (Site의 정확한 이동 경로는 검사)
- 실제 계정으로 운영 로그아웃 부작용 수행: `NOT_TESTED` (로컬 fixture에서 Site 해제와 Account handoff는 검사)
- Production 반영 및 Production 새 화면 E2E: `NOT_VERIFIED`
- 실물 iPhone/Android 기기: `NOT_TESTED` (Chrome viewport 360/390 검사)

## 다음 담당자

Claude 배포총괄이 최신 Ncloud `main`을 다시 확인한 뒤 trusted gate, 정상 merge, Production 배포, 실제 로그인 화면 E2E를 수행한다. 이 문서는 READY 제출이며 배포 완료를 뜻하지 않는다.
