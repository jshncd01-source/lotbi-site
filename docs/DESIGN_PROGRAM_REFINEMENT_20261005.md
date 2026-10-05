# 행사 프로그램 상세 디자인 보완 — 2026-10-05

## 범위 / owner

- 기존 `feature/subscription-plan-banner-v1-site-work` 재사용. Ncloud main `267011b365e5d92aa904e7e32b8638a6edf1b741` 기준. 새 GitHub branch/PR 없음.
- 실제 운영 브라우저에서 프로그램 열기 후 행사명·기간이 사라지고 빈 안내만 남는 문제 확인. 로컬 격리 컴포넌트에서 hidden 상세가 display:flex로 40px 공간을 차지하는 추가 문제 확인.
- 수정: 공개 목록의 행사명·기간을 프로그램 화면에서도 유지, 오류와 실제 빈 목록 구분, 오류 재시도, 중복 재시도 억제, 목록 복귀 시 pending detail/weather 응답 무효화, hidden flex 영역 강제 숨김.
- 단정한 제목/본문/구분선 위계. 기존 PUBLISHED 공개 데이터 allowlist, 날짜/지도/날씨/캘린더 계약과 실제 등록 동작은 그대로다. 새로운 API/사용자 데이터/계정 기능 없음.
- 이 행사 보완의 실제 제품 변경은 `site-festival-ui.js`, `site-consumer-detail.css`. 이후 진위확인·생활정보 상세 보완과 같은 feature에 포함했다. 최종 combined asset token `aset-8937ba503bd7`; 생성된 asset query 변경은 별도 기능 변경이 아니다.

## 검증

- `validate_consumer_detail_system_01.mjs` + browser-free `validate_festival_*.mjs`: 10 validators PASS. 신규 `validate_festival_program_context_01.mjs` 포함.
- asset cache coherence PASS; JS syntax PASS; `validate_site.py` PASS (11 public pages); consumer predeploy 8 tests PASS; legal validator PASS; diff whitespace PASS.
- Windows: 기존 Linux-oriented ESM drive-letter import는 외부 test-only resolver로 file URL 변환. 코드/expectation 변환 없음. Python stdout UTF-8 설정. 이 결과를 Ncloud trusted CI로 부르지 않는다.
- 기존 Chromium shell render validator는 host binary 탐색 실패. 설치·우회하지 않았다. 실제 브라우저 검증은 CUA로 아래와 같이 수행.
- 격리 UI fixture에서 실제 mountFestivalManager와 제품 CSS 사용: 오류→재시도→빈 상태→목록 복귀; 프로그램 포함 상태; 320px document width320 / scrollWidth320; hidden detail height0; 지연된 재시도 응답 뒤에도 목록 유지, program hidden 확인.
- fixture는 샘플/격리 검증임을 화면에 명시. 실제 계정·사용량·API 성공 증거가 아니다. 운영 API/계정/위치/캘린더 쓰기/접수 제출/신고/사진 업로드/결제 없음.
- temporary fixture는 Site tree에서 제거해 외부 artifact에 보존. Git 또는 배포 산출물에 넣지 않는다.

## 브라우저 근거 / 제약

외부 artifacts:
`C:/Users/jshnc/.codex/visualizations/2026/10/03/01a10023-5348-79b0-87ab-3a03393311f2/`

- `festival-program-context-isolated-desktop-20261005.jpg`
- `festival-program-context-isolated-mobile-20261005.jpg`
- `festival-context-test-fixture.html` (외부 test fixture, 상대 import는 test Site root에 임시 배치할 때만 해결)
- `windows-site-test-loader.mjs`

운영 읽기 확인: 로그인된 안심케어 사람/반려동물0 목록, 등록 1/4 사진 단계 (작성/업로드 없음), 행사 실제 목록 및 프로그램 empty 화면. Site 로컬 공개 API는 조회 실패하므로 새 디자인의 실제 API 성공 화면은 NOT_VERIFIED. 실제 Android Chrome / Samsung Internet / iPhone Safari, Android/iOS Native NOT_TESTED.

IMPLEMENTED / LOCAL_CHECKS_PASS. 이 문서를 포함한 exact commit의 FEATURE_PUSH 여부는 외부 `design-verification-life-handoff-20261005.md`의 SHA와 Ncloud remote 확인을 기준으로 한다. MAIN_MERGED=NO / PRODUCTION_DEPLOYED=NO for this refinement. Trusted Ncloud gate pending; 현재 승인된 서버 실행 접근을 확인할 수 없어 이를 우회하지 않는다. 전체132 runtime 완료가 아니다. Wallet 기능 보류 유지. LIVE_MONEY=false / APP_SYNC_PENDING=KEEP.

LOTBI 개발 스킬로 owner/최신 main/상태 구분과 배포 gate를 유지했고, built-in browser 스킬로 실제 화면과 격리 테스트를 구분해 확인했다.
