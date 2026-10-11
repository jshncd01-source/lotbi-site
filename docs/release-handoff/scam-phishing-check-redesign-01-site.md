READY_FOR_DEPLOY=YES

# SCAM-PHISHING-CHECK-REDESIGN-01 Site 재READY 인계

## 배포 대상

- 저장소: `lotbi-site`
- owner: 사기·피싱 확인 기존 Codex 개발방
- READY 보고 대상: `배포총괄 관리`
- 브랜치: `feature/scam-phishing-check-redesign-01-site`
- PR: 없음(Ncloud feature 브랜치 직접 인계)
- 기준 Ncloud main: `f2f56e364e0c0913f1cb961ab355ea66f442b96e` (캘린더 Production 반영 후 main)
- 통합·검증 SHA: `4192b875263aa8a16dab1b1ceb5a92312ff99540`
- Gate 반환 수정·재검증 SHA: `99434a4de5008920d4e98855924d5d0da963fc28`
- 다섯 번째 Gate 반환 수정·재검증 SHA: `8ce0d00cda2bb809b084978b1f1ebdaf8ebb11fa`
- 여섯 번째 Gate 반환 수정·재검증 SHA: `5fd4b0f6ecd1261c64de672d48c7da5c53e33e2f`
- 최신 main 정상 merge SHA: `404b33f031d8e2803cb54b765eb14f99d1fd4586`
- STALE READY checkpoint: `93c9fec3047e9494110e94e31de569dd8bf3d21c`
- 최초 READY checkpoint: `a50b29b01be40105f94522f9dfef687a93d372b0`
- 최종 push HEAD: 이 문서를 포함한 READY 커밋 SHA를 최종 보고에서 별도 기재한다.
- asset cache: `aset-53857c15acb0` (`targets=169`, `refs=206`)

## Gate 1.0.6 반환과 수정

- 반환 release: `release/20261010-site-t57b-work`
- 반환 release HEAD: `d193c1487b510c34ff1cf0f2206bba5a2bcdba1a`
- Gate run: `20261011T145428Z-4094983-1111125048`
- 결과: `TEST_FAILED`, 실패 단계 `PUBLIC HARDENING`. main `9147419f`와 Production은 변경되지 않았다.
- 원인: C안의 사용자 UI 명칭을 정리하면서 잠긴 `terms.html` 제8조 법적 문구 `진위확인 심층분석`까지 `사기·피싱 심층분석`으로 변경했다. 이번 범위에는 약관 재승인·relock 승인이 없었다.
- 수정: 제8조 잠긴 문구만 최신 main의 `진위확인 심층분석`으로 복원했다. asset token `aset-976ee65147ba`와 다른 C안 UI의 `사기·피싱 확인`은 유지했다.
- `scripts/validate_hardening.py`의 잠금 해시·검사 로직은 변경하지 않았다.

## Gate 1.0.6 두 번째 반환과 수정

- 반환 release: `release/20261010-site-t57b2-work`
- 반환 release HEAD: `4e59a52027bb04184315a1d72893a6a7651c575d`
- Gate run: `20261011T150319Z-4099918-1092112756`
- 결과: `TEST_FAILED`, 실패 단계 `scripts/validate_common_ui_polish_01.mjs`. main `9147419f`와 Production은 변경되지 않았다.
- 원인: C안 독립 화면을 구현하면서 `[data-scam-dialog]`를 `<dialog>`에서 `<section>`으로 바꾸고 `showModal()`/`close()`를 수동 `open`·`hidden` 처리로 대체했다. 모바일 drawer를 먼저 닫는 순서는 남아 있었지만 Gate가 보호하는 네이티브 모달 계약을 잃었다.
- 수정: C안의 독립 전체 화면·입력·결과 UX는 유지하면서 요소를 네이티브 `<dialog>`로 복원했다. `openDialog()`는 drawer 닫기 이후 `dialog.showModal()`을 호출하고, 닫기는 `dialog.close()`를 사용한다.
- 닫기 안정성: `finishDialogClose()`가 body 상태·메뉴 `aria-current`·초점·라우팅 알림을 멱등 처리한다. route owner가 즉시 닫은 뒤 네이티브 `close` 이벤트가 늦게 와도 중복 알림이나 중복 초점 이동이 발생하지 않는다. Escape의 네이티브 `cancel` 이벤트도 기존 dismiss/history 흐름으로 연결했다.
- 검증 보존: `validate_common_ui_polish_01.mjs`의 drawer-before-`showModal()` 단언은 변경하지 않았다. MVP와 route restore 검증은 네이티브 `<dialog>`·`showModal()`·`close()` 및 멱등 닫기를 더 강하게 확인하도록 갱신했다.
- cache: 변경된 HTML/CSS/JS를 반영해 공식 생성기로 `aset-c6baa4c56658`을 재생성했다.

## Gate 1.0.6 세 번째 반환과 수정

- 반환 release: 격리 release `665b6a60c57abb3fa52c14b64eeeb6db63fb8c95`
- 반환 대상 READY: `af368681fe2ee5c140cdfb2865094b3ce61b95f6`
- Gate run: `20261011T152517Z-4131170-3221211358`
- 결과: `TEST_FAILED`, 실패 단계 `scripts/validate_common_ui_polish_02.mjs:32`. main `9147419f`와 Production은 변경되지 않았다.
- 원인: 승인 C안에서 검사 대상·검사 시각을 결과에 추가하면서 `render(payload, {target, checkedAt: payload.checkedAt}); revealResult();`로 호출해, 기존 D4 계약인 연속 `render(payload); revealResult();`와 달라졌다.
- 수정: Core 응답 객체는 변형하지 않고 `WeakMap`에 해당 결과의 표시 문맥만 보관한다. `render(payload)`가 문맥을 한 번 읽고 제거하므로 검사 대상·검사 시각은 그대로 표시하면서 D4 호출 계약도 복원했다.
- 후속 검사: 같은 검증기의 회사 소개 C6 기대값이 확정 운영명보다 오래된 `진위확인`이라 다음 실패로 확인됐다. 검사 항목을 삭제·완화하지 않고 기대 기능명을 실제 확정명 `사기·피싱 확인`으로만 갱신했다. 운영 화면에 옛 명칭을 다시 넣지 않았다.
- cache: 공식 생성기로 `aset-f04cc336a932`을 재생성했다.

## Gate 1.0.6 네 번째 반환과 수정

- 반환 release: `0579767e49865fc752a0f7f9042fa4e2d6ec4bb7`
- 반환 대상 READY: `da54cbf1711fb3d4650b9ad57813638e38cdeb4c`
- Gate run: `20261011T163551Z-46804-2309624351`
- 결과: `TEST_FAILED`, 실패 단계 `scripts/validate_consumer_design_shell_01.mjs`. main `9147419f`와 Production은 변경되지 않았다.
- 원인: COMMON-UI-02의 회사 소개 기능명 계약은 확정명으로 갱신됐지만, 별도 consumer design shell의 desktop/mobile 8개 메뉴 기대 배열에는 이전 명칭 `진위확인`이 남아 있었다.
- 수정: 8개 메뉴의 개수·순서·목적지 단언은 그대로 유지하고 네 번째 메뉴 기대값만 실제 운영명 `사기·피싱 확인`으로 갱신했다. `validate_home_chat.py`와 sidebar IA 검사는 이름이 아니라 목적지 훅·순서를 검사하며 별도 이전 명칭 계약이 없음을 확인했다.
- cache: 제품 asset 변경이 없어 `aset-f04cc336a932`을 그대로 유지했다.

## Gate 1.0.6 다섯 번째 반환과 수정

- 반환 release: `release/20261010-site-t57b5-work`
- 반환 release HEAD: `96b85abbd313b605624a6459231d8d01f159ab98`
- 반환 대상 READY: `25bcb48f4fa87caabd91682ccb9af11bfbe9c2dc`
- Gate run: `20261011T184721Z-184913-300493376`
- 결과: `TEST_FAILED`, 실패 단계 `scripts/validate_consumer_sections_02.mjs`, 단언 `native close restores focus`. main `300859c4829b414fb333558a2df545e5c40933ce`와 Production은 변경되지 않았다.
- 원인: 네이티브 `<dialog>` 복원 때 `close` 이벤트는 `finishDialogClose()`만 호출하고, 초점 복원은 그 정리 함수 내부에서 처리했다. 실제 초점은 돌아왔지만 Gate가 보호하는 `dialog.addEventListener('close', restoreDialogFocus)` 직접 계약을 잃었다.
- 수정: 네이티브 `close` 이벤트가 `restoreDialogFocus`를 직접 한 번 호출하도록 복원하고, `finishDialogClose()`에서는 초점 이동을 제거했다. 즉시 라우팅 알림과 body·`aria-current` 정리는 기존처럼 멱등으로 유지해 늦은 `close` 이벤트가 중복 알림을 만들지 않는다.
- fallback: `showModal()`/`close()`를 지원하지 않는 환경에서는 `open`·`aria-modal`을 명시적으로 정리하고 `restoreDialogFocus()`를 한 번 호출한다. 네이티브 경로와 fallback 경로가 동시에 초점을 옮기지 않는다.
- 실제 Chrome 회귀에 진입점 `focus` 횟수 검사를 추가했다. 중복 ×·취소·Escape가 겹치는 닫기에서도 iPhone 375/390과 desktop 1280 모두 정확히 1회 복원됐다.
- cache: 공식 생성기로 `aset-6c2448ed185b`을 재생성했다.

## Gate 1.0.6 여섯 번째 반환과 수정

- 반환 release: `6c3678cf2369e8cd30e378f185c0ad3bca0bbfbe`
- 반환 대상 READY: `bedd4bd434b26afb8d4ba513856020e491dcac7b`
- Gate run: `20261011T205531Z-308086-250593324`
- 결과: `TEST_FAILED`, 실패 단계 `scripts/validate_verification_dialog_design_01.mjs`, 단언 `dismiss remains outside scroll body`. main `f2f56e364e0c0913f1cb961ab355ea66f442b96e`와 Production은 변경되지 않았다.
- 원인: 승인 C안의 전체 화면 구조에서 닫기 navigation과 입력 본문이 같은 dialog 내부에 있었지만, Gate가 보호하는 정확한 스크롤 본문 경계인 `.scam-dialog-inner`가 없었다. 이로 인해 dismiss가 단일 스크롤 본문 밖에 있다는 구조 계약을 증명하지 못했다.
- 수정: 네이티브 `<dialog class="scam-dialog">`와 그 바로 아래의 비스크롤 navigation을 유지하고, 실제 입력·결과 본문만 정확한 `.scam-dialog-inner`로 감쌌다. C안의 전체 화면 표시는 `data-scam-page` 속성과 호환 스타일로 보존했다.
- 상태 계약: 초기 검사 단계는 `hidden`으로 두고, 선택 여부에 따라 `methodChooser.hidden = hasSelection`, `checkStep.hidden = !hasSelection` 계약을 복원했다. 문자·이메일과 인터넷 주소의 직접 입력 탭은 C안대로 즉시 입력 가능하도록 같은 함수 안에서 명시적으로 예외 처리했다.
- 검증 보존: `validate_verification_dialog_design_01.mjs`는 변경하지 않았다. MVP 검증은 새 구조의 네이티브 dialog class와 C안 marker를 함께 요구하도록 갱신했으며 검사 삭제·skip·완화는 없다.
- cache: 공식 생성기로 `aset-53857c15acb0`을 재생성했다.

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

## Site main `300859c4` 재통합

- 기존 재READY `f1eac869f6de7b327e621e92f6195a39c7833ea5` 이후 대화 UI가 먼저 배포되어 main이 `300859c4829b414fb333558a2df545e5c40933ce`로 이동했다. 이전 READY를 STALE로 처리하고 같은 feature 브랜치에 새 main을 정상 merge했다.
- merge base는 이전 main `9147419fb079e6452ff26d82c52a1b8f1dca36e4`이며 rebase·reset·force-push·history rewrite는 사용하지 않았다.
- 88개 파일의 130개 conflict hunk를 `aset-*` 정규화 후 전수 비교했다. 130개 모두 asset token 차이였고 실제 코드·제품 동작 conflict hunk는 0건이었다.
- 새 main의 대화 레이아웃·장소 카드 회전, 관련 CSS·검증기·READY 문서는 자동 통합 결과를 그대로 보존했다. C안의 네이티브 `<dialog>`, 운영명, 입력·결과·라우팅 및 네 차례 Gate 반환 수정도 유지했다.
- 공식 생성기로 통합 asset token `aset-b7a4d80ad707`을 재생성했다. hardening 잠금 문서는 본문 변경이나 relock 없이 PASS했다.

## 캘린더 Production main `f2f56e36` 재통합

- 캘린더가 Production 반영되어 Site main이 `f2f56e364e0c0913f1cb961ab355ea66f442b96e`로 이동했다. 기준 main `300859c4`의 READY `93c9fec3047e9494110e94e31de569dd8bf3d21c`는 STALE로 처리했다.
- fresh 확인 후 rebase·reset·force-push 없이 정상 merge했다. merge SHA는 `404b33f031d8e2803cb54b765eb14f99d1fd4586`, parents는 `93c9fec3047e9494110e94e31de569dd8bf3d21c f2f56e364e0c0913f1cb961ab355ea66f442b96e`다.
- merge 중 88개 파일에서 130개 conflict hunk가 표시됐다. 각 stage와 충돌 표식을 전수 비교한 결과 130개 모두 `aset-*` token 차이였다.
- `about.html`, `index.html`, `site-calendar-manager.js`, `site-calendar-product.js`, `site-conversation.js`, `site-trouble-helper.js`, `subscribe.html`은 양쪽 stage 전체에 별도 제품 변경이 있었지만 conflict hunk 자체는 token-only였다. 파일 전체를 한쪽으로 덮지 않고 Git의 자동 통합 결과를 보존한 채 token 구간만 정리했다.
- 새 main의 캘린더 확정 디자인, 601px 이상 날짜 line-height 보정, Linux 동등 1023/1024/1025/1100/1101/1280px 날씨 비겹침 검사와 대화·장소 변경을 보존했다. 사기·피싱 C안, 운영명, 네이티브 dialog, 초점 1회 복원과 이전 Gate 반환 수정도 유지했다.
- 공식 생성기로 통합 asset token `aset-ccefbf0a4bed`을 재생성했다.

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

### 두 번째 Gate 반환 수정 재검증

- `validate_common_ui_polish_01.mjs`: PASS — 11 checks. 기존 drawer-before-`showModal()` 단언 유지.
- `validate_scam_shield_mvp_01.mjs`, `validate_scam_shield_connection_01.mjs`: PASS.
- `validate_scam_shield_photo_picker_01.mjs`: PASS — 360 light/dark, 390 KakaoTalk UA, 412 Android UA, 1280 desktop light/dark의 실제 Chrome 탭·chooser 흐름.
- `validate_site_refresh_route_restore_01.mjs`: PASS — iPhone 375/390 각 170 checks, desktop 1280 168 checks. 직접 진입·새로고침·뒤로/앞으로·로그인 복귀·닫기 경로 포함.
- `validate_accessibility.py`: PASS.
- `validate_hardening.py`, `validate_legal_pages.py`, `validate_social_legal_manifest_01.py`: PASS. 검증 파일의 단언 완화 없음.
- `asset_cache_version.mjs --check`: PASS — `aset-c6baa4c56658`, targets 169 / refs 206.
- desktop 1280 light/dark 및 mobile 360 시작 화면 렌더 직접 확인: 기존 C안 구성, desktop sidebar 보존, mobile 전체 화면, 가로 넘침 없음.

### 세 번째 Gate 반환 수정 재검증

- `validate_common_ui_polish_02.mjs`: PASS — 10 checks. D4의 `render(payload); revealResult();`와 C6 기능명 단언을 모두 유지했다.
- `validate_common_ui_polish_01.mjs`, `validate_scam_shield_mvp_01.mjs`, `validate_scam_shield_connection_01.mjs`: PASS.
- `validate_scam_shield_photo_picker_01.mjs`: PASS — 360 light/dark, 390 KakaoTalk UA, 412 Android UA, 1280 desktop light/dark. 검사 대상·검사 시각 표시와 늦은 응답 차단 포함.
- `validate_site_refresh_route_restore_01.mjs`: PASS — iPhone 375/390 각 170 checks, desktop 1280 168 checks.
- `validate_accessibility.py`, `validate_hardening.py`, `validate_legal_pages.py`, `validate_social_legal_manifest_01.py`: PASS.
- `asset_cache_version.mjs --check`: PASS — `aset-f04cc336a932`, targets 169 / refs 206.

### 네 번째 Gate 반환 수정 재검증

- `validate_consumer_design_shell_01.mjs`: PASS — desktop/mobile 각각 동일한 8개 메뉴명·순서·목적지 계약 유지.
- `validate_home_chat.py`, `validate_sidebar_information_architecture_04.mjs`: PASS — 8개 목적지와 승인 순서 유지.
- `validate_common_ui_polish_01.mjs`, `validate_common_ui_polish_02.mjs`, `validate_scam_shield_mvp_01.mjs`: PASS.
- `validate_trouble_helper_01.mjs`, `validate_connected_services_menu_hidden_01.mjs`: PASS — `사기·피싱 확인` 다음 도우미 순서와 `연결 서비스` 숨김 유지.
- `validate_scam_shield_photo_picker_01.mjs`, `validate_site_refresh_route_restore_01.mjs`: PASS.
- `validate_accessibility.py`, `validate_hardening.py`, `asset_cache_version.mjs --check`: PASS.

### main `300859c4` 재통합 영향검사

- conflict audit: 88개 파일 / 130개 hunk 중 token-only 130, 실제 코드 conflict 0.
- `validate_conversation_design_01.mjs`, `validate_place_card_rotation_01.mjs`: PASS — 새 main의 대화·장소 카드 레이아웃과 회전 계약 보존.
- `validate_common_ui_polish_01.mjs`, `validate_common_ui_polish_02.mjs`, `validate_consumer_design_shell_01.mjs`: PASS.
- `validate_scam_shield_mvp_01.mjs`, `validate_scam_shield_connection_01.mjs`, `validate_scam_shield_photo_picker_01.mjs`: PASS.
- `validate_scam_shield_double_check_p0.mjs`, `validate_scam_shield_result_banner_contrast_01.mjs`, `validate_scam_shield_login_gate_contrast_01.mjs`: PASS.
- `validate_site_refresh_route_restore_01.mjs`, `validate_trouble_helper_01.mjs`, `validate_connected_services_menu_hidden_01.mjs`: PASS.
- `validate_accessibility.py`, `validate_hardening.py`, `validate_legal_pages.py`, `validate_social_legal_manifest_01.py`: PASS.
- `asset_cache_version.mjs --check`: PASS — `aset-b7a4d80ad707`, targets 169 / refs 206.

### 다섯 번째 Gate 반환 수정 재검증

- fresh 확인: `origin/main=300859c4829b414fb333558a2df545e5c40933ce`, 원격 feature는 수정 전 HEAD `25bcb48f4fa87caabd91682ccb9af11bfbe9c2dc`와 일치했다. 추가 main merge는 필요하지 않았다.
- `validate_consumer_sections_02.mjs`: PASS — 네이티브 `close` 직접 초점 복원과 fallback 초점 복원 계약 유지.
- `validate_site_refresh_route_restore_01.mjs`: PASS — iPhone 375/390 각 171 checks, desktop 1280 169 checks. 초점 복원 횟수는 세 환경 모두 정확히 1회였다.
- `validate_common_ui_polish_01.mjs`, `validate_common_ui_polish_02.mjs`, `validate_consumer_design_shell_01.mjs`: PASS — drawer-before-`showModal()`과 확정 메뉴 계약 유지.
- `validate_scam_shield_mvp_01.mjs`, `validate_scam_shield_connection_01.mjs`, `validate_connected_services_menu_hidden_01.mjs`, `validate_photo_input_no_camcorder_01.mjs`: PASS.
- `validate_scam_shield_photo_picker_01.mjs`: PASS — 360 light/dark, 390 KakaoTalk UA, 412 Android UA, 1280 desktop light/dark.
- `validate_scam_shield_double_check_p0.mjs`: PASS — 16 renders, 가로 넘침 0, WCAG AA.
- `validate_scam_shield_result_banner_contrast_01.mjs`, `validate_scam_shield_login_gate_contrast_01.mjs`: PASS — 각각 30 renders, WCAG AA.
- `validate_trouble_helper_01.mjs`: PASS — 52 checks.
- `validate_accessibility.py`, `validate_hardening.py`, `validate_legal_pages.py`, `validate_social_legal_manifest_01.py`: PASS. Windows cp949 출력 실패 후 테스트 내용 변경 없이 `PYTHONUTF8=1`로 동일 검사를 재실행했다.
- `validate_conversation_design_01.mjs`, `validate_place_card_rotation_01.mjs`: PASS — 새 main 대화·장소 카드 계약 보존.
- `asset_cache_version.mjs --check`: PASS — `aset-6c2448ed185b`, targets 169 / refs 206.

### 캘린더 Production main `f2f56e36` 재통합 영향검사

- conflict audit: 88개 파일 / 130개 hunk 중 token-only 130, 실제 코드 conflict hunk 0건. 충돌 표식 0건, `git diff --check` PASS.
- 사기·피싱: `validate_consumer_sections_02.mjs`, `validate_common_ui_polish_01.mjs`, `validate_common_ui_polish_02.mjs`, `validate_consumer_design_shell_01.mjs`, `validate_scam_shield_mvp_01.mjs`, `validate_scam_shield_connection_01.mjs`, `validate_connected_services_menu_hidden_01.mjs`, `validate_photo_input_no_camcorder_01.mjs`: PASS.
- 실제 Chrome 사진 선택: `validate_scam_shield_photo_picker_01.mjs` PASS — 360 light/dark, 390 KakaoTalk UA, 412 Android UA, 1280 desktop light/dark.
- 결과·대조·로그인 대비: `validate_scam_shield_double_check_p0.mjs` 16 renders PASS, `validate_scam_shield_result_banner_contrast_01.mjs`와 `validate_scam_shield_login_gate_contrast_01.mjs` 각 30 renders PASS, WCAG AA.
- 라우팅·초점: `validate_site_refresh_route_restore_01.mjs` PASS — iPhone 375/390 각 171 checks, desktop 1280 169 checks. 네이티브 close 초점 복원은 각 환경에서 정확히 1회다.
- 캘린더: `validate_calendar*.mjs` 50개 전체 PASS (`50/50`, 실패 0). `validate_calendar_month_temperature_01.mjs`의 Linux 동등 1024px 경계와 인접 1023/1025/1100/1101/1280px 날짜·최저/최고 온도 비겹침을 포함한다.
- 대화·장소: `validate_conversation_design_01.mjs`, `validate_place_card_rotation_01.mjs`, `validate_place_card_carousel_no_drift_01.mjs`, `validate_conversation_answer_ux_01.mjs`: PASS.
- 인접 기능: `validate_trouble_helper_01.mjs` PASS — 52 checks.
- 접근성·잠금: `validate_accessibility.py`, `validate_hardening.py`, `validate_legal_pages.py`, `validate_social_legal_manifest_01.py`: PASS.
- `asset_cache_version.mjs --check`: PASS — `aset-ccefbf0a4bed`, targets 169 / refs 206.

### 여섯 번째 Gate 반환 수정 재검증

- fresh 확인: `origin/main=f2f56e364e0c0913f1cb961ab355ea66f442b96e`, 원격 feature는 수정 전 HEAD `bedd4bd434b26afb8d4ba513856020e491dcac7b`와 일치했다. 추가 main merge는 필요하지 않았다.
- 반환 검사 `validate_verification_dialog_design_01.mjs`: PASS. 닫기 navigation은 `.scam-dialog-inner` 밖, 입력·결과는 단일 스크롤 본문 안에 유지된다.
- `validate_consumer_sections_02.mjs`, `validate_common_ui_polish_01.mjs`, `validate_common_ui_polish_02.mjs`, `validate_consumer_design_shell_01.mjs`: PASS.
- `validate_scam_shield_mvp_01.mjs`, `validate_scam_shield_connection_01.mjs`, `validate_connected_services_menu_hidden_01.mjs`, `validate_photo_input_no_camcorder_01.mjs`: PASS.
- 실제 Chrome 사진 선택: `validate_scam_shield_photo_picker_01.mjs` PASS — 360 light/dark, 390 KakaoTalk UA, 412 Android UA, 1280 desktop light/dark.
- 결과·대조·로그인 대비: `validate_scam_shield_double_check_p0.mjs` 16 renders PASS, `validate_scam_shield_result_banner_contrast_01.mjs`와 `validate_scam_shield_login_gate_contrast_01.mjs` 각 30 renders PASS, WCAG AA.
- 라우팅·초점: `validate_site_refresh_route_restore_01.mjs` PASS — iPhone 375/390 각 171 checks, desktop 1280 169 checks. 네이티브 close 초점 복원은 각 환경에서 정확히 1회다.
- 캘린더: `validate_calendar*.mjs` 50개 전체 PASS (`50/50`, 실패 0). 처음에는 Windows Chrome 자동 탐색 실패가 있었고, 제품이나 검사를 바꾸지 않고 `CHROME_BIN=C:/Program Files/Google/Chrome/Application/chrome.exe`를 명시해 동일 묶음을 재실행했다.
- 대화·장소·인접 기능: `validate_conversation_design_01.mjs`, `validate_place_card_rotation_01.mjs`, `validate_place_card_carousel_no_drift_01.mjs`, `validate_trouble_helper_01.mjs`: PASS.
- 접근성·잠금: `validate_accessibility.py`, `validate_hardening.py`, `validate_legal_pages.py`, `validate_social_legal_manifest_01.py`: PASS.
- `asset_cache_version.mjs --check`: PASS — `aset-53857c15acb0`, targets 169 / refs 206.

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
3. 이 개발방은 READY를 `배포총괄 관리` 방에만 보고한다. Gate·병합·Production 운영 반영 방에 직접 전달하지 않는다.
4. `배포총괄 관리` 방 확인 후 승인된 READY만 `롯비` 방으로 전달된다.
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
