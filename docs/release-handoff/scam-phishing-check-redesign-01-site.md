READY_FOR_DEPLOY=YES

# SCAM-PHISHING-CHECK-REDESIGN-01 Site 재READY 인계

## 배포 대상

- 저장소: `lotbi-site`
- owner: 사기·피싱 확인 기존 Codex 개발방
- READY 보고 대상: `LOTBI ① 작업방 총괄관리`
- 브랜치: `feature/scam-phishing-check-redesign-01-site`
- PR: 없음(Ncloud feature 브랜치 직접 인계)
- 기준 Ncloud main: `9147419fb079e6452ff26d82c52a1b8f1dca36e4` (SITE-T57a3)
- 통합·검증 SHA: `4192b875263aa8a16dab1b1ceb5a92312ff99540`
- Gate 반환 수정·재검증 SHA: `99434a4de5008920d4e98855924d5d0da963fc28`
- 이전 READY checkpoint: `a50b29b01be40105f94522f9dfef687a93d372b0`
- 최종 push HEAD: 이 문서를 포함한 READY 커밋 SHA를 최종 보고에서 별도 기재한다.
- asset cache: `aset-976ee65147ba` (`targets=169`, `refs=206`)

## Gate 1.0.6 반환과 수정

- 반환 release: `release/20261010-site-t57b-work`
- 반환 release HEAD: `d193c1487b510c34ff1cf0f2206bba5a2bcdba1a`
- Gate run: `20261011T145428Z-4094983-1111125048`
- 결과: `TEST_FAILED`, 실패 단계 `PUBLIC HARDENING`. main `9147419f`와 Production은 변경되지 않았다.
- 원인: C안의 사용자 UI 명칭을 정리하면서 잠긴 `terms.html` 제8조 법적 문구 `진위확인 심층분석`까지 `사기·피싱 심층분석`으로 변경했다. 이번 범위에는 약관 재승인·relock 승인이 없었다.
- 수정: 제8조 잠긴 문구만 최신 main의 `진위확인 심층분석`으로 복원했다. asset token `aset-976ee65147ba`와 다른 C안 UI의 `사기·피싱 확인`은 유지했다.
- `scripts/validate_hardening.py`의 잠금 해시·검사 로직은 변경하지 않았다.

## 확정 C안 보존

- 독립 `#scam` 화면, 제목 `롯비야, 이거 진짜야?`, 문자·이메일/인터넷 주소 탭과 사진·카메라·문서 선택 구조를 유지했다.
- 운영 화면에는 설명용 `C안 · 바로 입력형`과 `진위확인`을 노출하지 않는다. 사용자 노출 이름은 `사기·피싱 확인`이다.
- `연결 서비스`는 desktop/mobile 메뉴에서 계속 숨김이다.
- 모바일·coarse pointer에서는 카메라 버튼을 항상 표시한다. PC에서는 `enumerateDevices()`의 `videoinput` 확인 시만 표시하고 조회 실패 시 숨긴다.
- 입력·주소·파일·방법·피해 상태 변경 시 이전 결과를 제거하고, 늦은 과거 응답이 최신 결과를 덮어쓰지 않는다.
- PDF/TXT/HTML·사진 검사, 10MB 제한, 로그인 복귀, 피해 여부, 접근성, light/dark와 내부 `#scam` 주소를 보존했다.
- C안 원본과 기존 `before/after` 증거는 삭제하거나 덮어쓰지 않았다.

## 최신 main 통합과 충돌

- merge base `f2e391adbe8b3a1424962fc9b024a693bbf98e9d`에서 최신 main `9147419f`를 기존 feature 브랜치에 정상 merge했다.
- rebase·reset·force-push·history rewrite는 사용하지 않았다.
- 88개 파일에서 130개 conflict hunk가 표시됐다. 양쪽 stage의 `aset-*`만 정규화해 전수 비교한 결과 130개 모두 asset token 차이였다.
- 최신 main token 쪽으로 충돌 표식을 제거한 뒤 공식 생성기로 통합 token `aset-976ee65147ba`를 재생성했다.
- 실제 코드·동작 conflict hunk: 0건.

### 양쪽 기능 변경이 겹친 파일

| 파일 | 이 브랜치 | 최신 main | 해결·owner |
|---|---|---|---|
| `index.html` | C안 화면·메뉴명·숨김 메뉴 | 분쟁 도우미, 캘린더 반복 등록, dark sheet, 문서 polish | 자동 통합, 화면·경로 PASS. 각 기능 owner 유지 |
| `site-conversation.js` | 사기·피싱 진입 시 이전 화면 종료·선택 일치 | 캘린더·대화·분쟁 도우미 후속 변경 | 자동 통합, 대화·장소·캘린더 회귀 PASS |
| `site-trouble-helper.js` | `사기·피싱 확인` 연결 명칭 | urgent-first 흐름 | 자동 통합. 검증기의 이전 명칭 기대값만 확정 명칭으로 갱신, 52 checks PASS |

- 캘린더·Life Wallet·장소·위치·avatar/auth 파일의 충돌은 asset token 전용이었다. 최신 main 기능 코드를 그대로 보존했다.
- 최신 main의 `calendar-guest-recurring-login`, `trouble-helper-urgent-first`, `site-dark-sheet`, brand/avatar v5, 문서 polish를 보존했다.
- 현재 RED와 즉시 조율할 항목은 없다. 위 3개 공통 파일을 추가 수정할 때는 캘린더·대화·분쟁 도우미 owner와 fresh 확인한다.

## 재READY 변경 범위

- 최신 main merge 및 자동 통합
- asset 참조 파일 87개와 `site-asset-version.json`의 통합 token 재생성
- `scripts/validate_trouble_helper_01.mjs`의 메뉴명 기대값을 확정 운영명으로 갱신
- 새 렌더 증거 18장: `docs/release-handoff/evidence/scam-phishing-check-redesign-01-site/after-main-9147419f/photo-picker/`
- 본 READY 문서
- C안 핵심 `site-scam-shield.js`, `site-scam-shield.css`, `site-core.js`는 재제작 없이 기존 확정 구현을 보존했다.

## 검증 결과

통합 SHA `4192b875...`에서 실행했다.

- `asset_cache_version.mjs --check`: PASS — targets 169 / refs 206.
- `validate_scam_shield_mvp_01.mjs`: PASS.
- `validate_scam_shield_connection_01.mjs`: PASS.
- `validate_photo_input_no_camcorder_01.mjs`: PASS — 18 file inputs.
- `validate_connected_services_menu_hidden_01.mjs`: PASS — 10 checks.
- `validate_scam_shield_photo_picker_01.mjs`: PASS — 360 light 19, 360 dark 17, KakaoTalk UA 390 light 17, Android UA 412 dark 17, desktop 1280 light/dark 각 14 checks.
- `validate_scam_shield_result_banner_contrast_01.mjs`: PASS — 30 renders, WCAG AA.
- `validate_scam_shield_double_check_p0.mjs`: PASS — 16 renders, 가로 넘침 0, WCAG AA.
- `validate_scam_shield_login_gate_contrast_01.mjs`: PASS — 30 renders, 텍스트 4.5:1 이상, 경계·포커스 3:1 이상.
- `validate_site_refresh_route_restore_01.mjs`: PASS — iPhone 375/390 각 170 checks, desktop 1280 168 checks.
- `validate_trouble_helper_01.mjs`: PASS — 52 checks. 최초에는 이전 메뉴명 `진위확인` 기대값으로 실패했고, 단언 범위를 유지한 채 확정명으로 갱신 후 PASS했다.
- `validate_calendar_command_recognition_p0_01.mjs`: PASS — 26 accepted, 18 rejected, 3 date refusal.
- `validate_conversation_answer_ux_01.mjs`: PASS — 320/360/390/412/1280 대화·지역·장소 카드.
- `validate_calendar_recurring_events_01.mjs`: PASS. Windows Chrome 자동 탐색 실패 후 `CHROME_BIN=C:/Program Files/Google/Chrome/Application/chrome.exe`를 명시해 동일 검사를 재실행했다.
- 대표 desktop/mobile, light/dark 시작·결과 화면 직접 확인: 가로 넘침·버튼 잘림·본문 겹침 없음.

### Gate 반환 수정 SHA `99434a4de...` 재검증

- `python scripts/validate_hardening.py`: PASS — locked content 포함 PUBLIC HARDENING 전체.
- `python scripts/validate_legal_pages.py`: PASS.
- `python scripts/validate_social_legal_manifest_01.py`: PASS — consent digest와 hardening lock 일치, asset-token rewrite 정규화 확인.
- `python scripts/emit_social_signup_legal_manifest.py`: PASS — 승인된 terms/privacy version·digest 출력 확인(비밀값 없음).
- `node scripts/asset_cache_version.mjs --check`: PASS — `aset-976ee65147ba`, targets 169 / refs 206.
- `validate_scam_shield_mvp_01.mjs`, `validate_scam_shield_connection_01.mjs`, `validate_connected_services_menu_hidden_01.mjs`: PASS.
- `validate_scam_shield_photo_picker_01.mjs`: PASS — 360/390/412/1280, light/dark 실제 Chrome 파일 chooser 회귀.
- `validate_scam_shield_double_check_p0.mjs`: PASS — 16 renders, 가로 넘침 0, WCAG AA.

## 최신 통합 사용자 시나리오

1. 360 light/dark, 390 KakaoTalk UA, 412 Android UA, 1280 desktop light/dark에서 시작 → 사진 선택 → 미리보기 → 결과를 실제 Chrome으로 실행했다. 막힌 곳 없음.
2. `#scam` 직접 진입, 새로고침, 뒤로/앞으로, 로그인 복귀를 iPhone 375/390과 desktop 1280에서 확인했다. 주소·메뉴·본문이 일치했다.
3. 분쟁·사고 도우미에서 `사기·피싱 확인`으로 넘기는 흐름과 메뉴 순서를 모바일·PC에서 확인했다. 두 화면이 겹치지 않았다.
4. 대화 홈의 `의심되는 문자 확인` 진입과 대화·장소 카드·캘린더 명령 회귀를 확인했다.

## 증거

- 기존 증거: `docs/release-handoff/evidence/scam-phishing-check-redesign-01-site/before/`, `after/`
- 최신 main 통합 증거: `docs/release-handoff/evidence/scam-phishing-check-redesign-01-site/after-main-9147419f/photo-picker/`
- 최신 렌더는 합성 파일과 mock Core 응답만 사용한다. 의심 파일이나 외부 코드를 실행하지 않는다.

## 배포 순서와 HOLD

1. `CORE-T51` HOLD를 이 방에서 해제하지 않는다.
2. Core가 MASTER 승인으로 배포되고 헬스·분석 endpoint가 확인된 뒤 Site를 배포한다.
3. 이 개발방은 READY를 `LOTBI ① 작업방 총괄관리`에 보고한다. 배포 실행방에 직접 전달하지 않는다.
4. 총괄관리방 확인 후 `LOTBI ② Ncloud 병합·운영배포 실행`이 MASTER 승인 범위에서 Site main 병합·Production 배포를 수행한다.
5. 이 방은 feature 재READY까지만 담당한다.

환경변수 변경 없음. DB 변경·migration 없음. 비밀값 추가 없음.

## NOT TESTED / NOT VERIFIED

- 실제 iPhone Safari, KakaoTalk 인앱브라우저, Android 실기기: NOT TESTED. Chrome viewport/UA/touch emulation이다.
- 실제 카메라가 있는 PC와 없는 물리 PC: NOT TESTED. API 분기와 카메라 없음 fail-closed만 검증했다.
- Production 실 API·실계정·실파일 업로드·served revision: NOT VERIFIED.
- Core Production과 `www.scourt.go.kr`/위장 suffix/CDN 설명의 실 endpoint: NOT VERIFIED, `CORE-T51` HOLD.
- Ncloud Linux Site gate: NOT VERIFIED.

## 배포 후 확인·롤백

1. desktop/mobile에서 `연결 서비스` 숨김과 `사기·피싱 확인` 메뉴·본문·주소 일치를 확인한다.
2. 물리 기기에서 모바일 카메라 표시와 PC 카메라 유무별 표시를 확인한다.
3. 입력·파일·주소 변경 시 이전 결과 제거와 늦은 응답 차단을 확인한다.
4. C안 또는 최신 main의 캘린더·대화·분쟁 도우미·Life Wallet이 깨지면 Site를 직전 revision으로 rollback하고 원인 owner와 재통합한다.
5. Core 판별 보정이 준비되지 않았으면 Site를 먼저 배포하지 않는다.
