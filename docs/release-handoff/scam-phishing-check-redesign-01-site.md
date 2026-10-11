READY_FOR_DEPLOY=YES

# SCAM-PHISHING-CHECK-REDESIGN-01 Site 배포 인계

## 배포 대상

- 저장소: `lotbi-site`
- owner: Codex 개발방 구현·검증 완료, Claude 배포총괄 인계
- 브랜치: `feature/scam-phishing-check-redesign-01-site`
- PR: 없음(Ncloud 브랜치 직접 인계)
- 최신 기준 main: `f2e391adbe8b3a1424962fc9b024a693bbf98e9d` (SITE-T56)
- 검증한 병합 트리 구현 SHA: `c7808436b9b01432d277aa2e871a85e2d4869865`
- 최초 기능 구현 SHA: `d5ffc37c347d85ae8d445c798c8967e986f6df9b`
- main 반영 merge SHA: `022ff73145b06a2638d0f72d4b41d5d67b69af34`
- 캐시 갱신 SHA: `749ec5d8c24b069ac75e54f318720bbd1cd3b950`
- 최종 push HEAD: 이 문서를 포함한 마지막 READY 커밋 SHA를 배포총괄 보고에서 별도 기재한다.

## 최신 main 반영과 보존 범위

- push 전 Ncloud `origin/main`을 다시 fetch했고, SITE-T56을 작업 브랜치에 merge했다. rebase·force-push·history rewrite는 하지 않았다.
- `연결 서비스` 메뉴의 T56 숨김 상태를 desktop/mobile 모두 유지했다.
- T56의 Header, 위치 허용, 캘린더, 지역정보, 로고·아이콘 변경을 되돌리지 않았다.
- 기존 `#scam` 진입 주소, Core API, PDF/TXT/HTML·사진·카메라 검사, 10MB 제한, 피해 여부 질문, 로그인 복귀를 보존했다.

## 구현 내용

- `index.html`, `site-scam-shield.css`, `site-scam-shield.js`: 모달을 독립 `#scam` 작업화면으로 전환하고 C안의 정보 위계를 적용했다. 화면에는 `C안 · 바로 입력형`과 `진위확인`을 노출하지 않는다.
- `site-conversation.js`: Life Wallet 등 다른 작업화면을 닫은 뒤 사기·피싱 확인을 열어 이전 화면 잔류와 메뉴 선택 불일치를 제거했다.
- `site-scam-shield.js`: 빈 입력·검사 중 버튼 비활성화, 입력/방법/파일/피해 상태 변경 시 결과 초기화, 늦은 이전 응답 무시, 검사 대상 표시를 추가했다.
- 카메라 버튼: 모바일 UA 또는 coarse pointer에서는 항상 표시하며, PC에서는 `enumerateDevices()`에서 `videoinput`을 확인했을 때만 표시한다. 조회 실패 시 PC에서는 숨김을 유지한다.
- `site-core.js`, `site-trouble-helper.js`, `about.html`, `subscribe.html`, `terms.html`: 사용자 노출 이름을 `사기·피싱 확인` 또는 `사기·피싱 심층분석`으로 통일했다. 앱 메뉴명 변경은 이 저장소 범위가 아니다.
- 관련 회귀검사와 실제 Chrome 파일선택 시나리오를 새 화면 구조에 맞게 갱신했다.
- asset cache: `aset-648925ffc6ee`.

## Core 의존성 및 배포 순서

- 주소/DNS/IP/국가·HTML 판별 수정은 별도 `lotbi-core` 브랜치 `feature/scam-phishing-check-redesign-01-core`에 있다.
- Core 구현 SHA: `ff1506a0fde875b0b232ad1a1d341b9cf4e91b06`.
- 반드시 **Core 배포·헬스 확인 → Site 배포** 순서로 진행한다. Site만 먼저 배포하면 새 화면은 보이지만 `www.scourt.go.kr`, 표시 리소스, CDN/IP 국가 설명 보정이 운영 Core에 반영되지 않는다.

## 검증 결과

- `node scripts/asset_cache_version.mjs --check`: PASS, targets 169 / refs 206.
- `validate_scam_shield_mvp_01.mjs`, `validate_scam_shield_connection_01.mjs`: PASS.
- `validate_scam_shield_photo_picker_01.mjs`: 360 light 19, 360 dark 17, KakaoTalk 390 light 17, Android 412 dark 17, PC 1280 light/dark 각 14 checks PASS.
- `validate_scam_shield_result_banner_contrast_01.mjs`: 30 renders PASS, WCAG AA.
- `validate_scam_shield_double_check_p0.mjs`: 16 renders PASS, WCAG AA.
- `validate_scam_shield_login_gate_contrast_01.mjs`: 30 renders PASS, 텍스트 4.5:1 이상·경계/포커스 3:1 이상.
- `validate_site_refresh_route_restore_01.mjs`: iPhone 375/390 각 170 checks, desktop 1280 168 checks PASS. 직접 주소, 새로고침, 뒤로/앞으로, 로그인 복귀 포함.
- `validate_photo_input_no_camcorder_01.mjs`: 18개 파일 입력 PASS.
- `validate_connected_services_menu_hidden_01.mjs`: 10 checks PASS.
- 최종 병합 트리에서 가로 넘침 0, 버튼 잘림·본문 겹침 없음.
- 위험 HTML 탐지·공식 주소 판별은 아래 Core READY와 Core 26개 테스트에서 검증했다.

## 사용자 시나리오

1. Life Wallet → 사기·피싱 확인 → 문자 입력 → 검사 결과: 3탭(메뉴 2, 실행 1). `#wallet` 화면이 사라지고 `#scam` 선택 상태와 본문이 일치했으며 결과에 검사 대상이 표시됐다. 막힌 곳 없음.
2. 문서·PDF 올리기 → 개인정보 제거 위험 HTML 선택 → 검사 → 판단 근거/미확인 항목 확인: 3탭(문서, 파일 선택, 실행; 접힌 기술 근거 확인 시 1탭 추가). 파일은 실행하지 않고 전송 전 미리보기 후 분석됐으며 위험 결과와 미확인 항목이 분리됐다. 막힌 곳 없음.
3. 검사 결과 → 인터넷 주소 탭 → 새 주소 입력 → 재검사: 2탭(주소 탭, 실행). 입력 변경 즉시 이전 결과가 사라졌고 `www.scourt.go.kr` 대상의 새 결과만 남았다. 막힌 곳 없음.
4. 느린 첫 문자 검사 직후 내용 변경·재실행: 1탭 추가. 늦게 도착한 첫 응답이 빠른 두 번째 결과를 덮어쓰지 않았다. 막힌 곳 없음.

## 전후 화면 증빙

기준 before는 SITE-T55 `68b3161e695d926a4c2fc7e53d315fcb958756ac`, after는 SITE-T56 merge 이후 트리다. 모든 파일은 합성 데이터와 mock Core 응답만 사용한다.

| 환경 | 수정 전 기본/결과 | 수정 후 기본/결과 |
|---|---|---|
| 모바일 360 light | `before/mobile-360x800-light-methods.png`, `before/mobile-360x800-light-result.png` | `after/mobile-360x800-light-start.png`, `after/mobile-360x800-light-result.png` |
| 모바일 360 dark | `before/mobile-360x800-dark-methods.png`, `before/mobile-360x800-dark-result.png` | `after/mobile-360x800-dark-start.png`, `after/mobile-360x800-dark-result.png` |
| PC 1280 light | `before/desktop-1280x900-light-methods.png`, `before/desktop-1280x900-light-result.png` | `after/desktop-1280x900-light-start.png`, `after/desktop-1280x900-light-result.png` |
| PC 1280 dark | `before/desktop-1280x900-dark-methods.png`, `before/desktop-1280x900-dark-result.png` | `after/desktop-1280x900-dark-start.png`, `after/desktop-1280x900-dark-result.png` |

표의 경로 기준 디렉터리: `docs/release-handoff/evidence/scam-phishing-check-redesign-01-site/`.

## NOT TESTED / 남은 의존성

- 실제 iPhone Safari, KakaoTalk 인앱브라우저, Android 실기기: NOT TESTED. Chrome viewport/UA/touch emulation으로만 검증했다.
- 실제 카메라가 연결된 PC와 카메라가 없는 물리 PC: NOT TESTED. 브라우저의 카메라 없음 상태와 API 분기·fail-closed 동작은 검증했다.
- Production 실 API·실계정·실파일 업로드와 Production 배포 후 사용자 검증: NOT TESTED. 이 브랜치에서 main 병합·Production 배포를 하지 않았다.
- Ncloud 원격 장치는 작업 시점에 offline이어서 로컬의 Ncloud 인증 원격 저장소 clone으로 구현·검증했다.
- 환경변수 변경: 없음. DB 변경·migration: 없음. 비밀값 추가: 없음.

## Claude 배포 후 확인

1. Core 브랜치를 먼저 배포하고 헬스 확인 후 Site를 배포한다.
2. desktop/mobile 메뉴에서 `연결 서비스`가 계속 숨겨지고 `사기·피싱 확인`이 선택되는지 확인한다.
3. `/#scam` 직접 진입, Life Wallet에서 진입, 대화로 돌아가기, 뒤로/앞으로, 로그인 복귀를 확인한다.
4. `www.scourt.go.kr` 정상 판별, `www.scourt.go.kr.evil.example` 거부, 위험 HTML의 외부 코드·개인정보 필드 탐지를 확인한다.
5. 모바일 카메라 버튼 표시와 PC 카메라 유무별 표시를 실제 기기에서 확인한다.
6. 360/1280 light/dark에서 기본·결과 화면의 넘침과 버튼 잘림을 확인한다.

## 롤백 기준

- 위험 HTML이 HIGH_RISK를 잃거나 외부 코드/개인정보 입력 탐지를 누락한다.
- 공식 법원 주소가 다시 HOST_NOT_REGISTERED가 되거나 위장 호스트가 공식으로 통과한다.
- 이전 결과가 새 입력에 남거나 늦은 응답이 최신 결과를 덮어쓴다.
- `연결 서비스`가 다시 노출되거나 기존 `#scam`·로그인·파일 검사 경로가 깨진다.
- 위 항목 발생 시 Site를 이 브랜치 배포 직전 revision으로 되돌리고, Core와 Site를 각각 독립 rollback한 뒤 원인 저장소부터 재검증한다.
