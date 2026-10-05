# 진위확인 · 생활정보 상세 디자인 보완 — 2026-10-05

## Scope / owner

사용자 요청: 로그인 수정분 배포는 나중에 함께 진행하고, 기존 디자인 작업을 계속한다. 이번에는 배포하지 않는다.

- Repository: `lotbi-site`, local owner `C:/Users/jshnc/LOTBI-NCLOUD/subscription-plan-banner-v1-site`
- Existing branch: `feature/subscription-plan-banner-v1-site-work`
- Ncloud main baseline: `267011b365e5d92aa904e7e32b8638a6edf1b741`
- 새 GitHub PR/branch 없음. 기존 Account/Web와 긴급 로그인 branch 보존.

## Implemented

1. 진위확인 팝업 제목·닫기를 스크롤 본문 밖에 배치했다. 작은 화면에서도 제목과 닫기가 남고 본문만 스크롤한다. 닫힌 native dialog를 CSS로 여는 실수는 방지한다.
2. 모바일의 사진·파일 / 문자 / 링크 선택을 동일한 3열로 정리했다. 입력 label을 실제 표시하고 파일 형식·10MB 한도를 안내한다. 중립 색, 일관된 글자 크기와 간격, 최소 44px 닫기·파일선택 동작을 사용한다.
3. 생활정보 상세 7종의 제목과 입력 폼을 하나의 최대 600px 열로 맞췄다. 모바일은 100% 폭이며 가로 넘침 없이 줄어든다.
4. 장소·시설·지역생활·지원금의 label과 예시를 해당 서비스에 맞게 구분했다. 기존 출발/목적지, 고지서, 지역 입력은 유지한다.
5. 같은 feature의 행사 프로그램 맥락·오류/빈상태·복귀 보완도 함께 보존했다. 세부 사항은 `DESIGN_PROGRAM_REFINEMENT_20261005.md`.

Actual product content changes: `index.html`, `site-consumer-detail.css`, `site-consumer-sections.js`, `site-festival-ui.js` only. Other runtime changes are generated asset-version query rewrites and manifest. Normalized before/after comparison confirmed this boundary. Final asset `aset-8937ba503bd7` (100 targets / 122 references).

기존 진위확인 입력 종류, hidden/disabled field 계약, maxlength, MIME/10MB 제한, 분석 API 및 incident 흐름 유지. 생활정보는 기존 onDraft로 질문 입력창을 채울 뿐 자동 전송하지 않는다. 위치 수집, 계정 저장, 결제, 등록, 신고, 연동/해제 동작을 새로 구현하거나 실행하지 않았다. Legal 본문/사업자 정보/공개 결제 경로 변경 없음.

## Local checks

- `validate_verification_dialog_design_01`, `validate_life_detail_design_01`, `validate_consumer_detail_system_01`, `validate_scam_shield_mvp_01`, `validate_consumer_sections_02`, `validate_festival_program_context_01`: PASS.
- Festival calendar add/link, event detail, filters/pagination, location/manual region, nav wiring, public boundary, weather: browser-free validators PASS. Windows drive-letter imports use external test-only file-URL resolver; no source or expectation rewriting.
- Consumer predeploy guards: 8 tests PASS. Public site: 11 pages PASS. Accessibility and legal validators PASS.
- Changed JS syntax, asset coherence, diff whitespace: PASS.
- Legacy `validate_festival_event_08_responsive_a11y_01` shell render check: NOT_RUN_TO_COMPLETION because host Chrome/Chromium lookup fails. No installation or browser-control bypass. CUA runtime evidence below is separate.
- Static Site has no package.json build step. Static validation is not a trusted Ncloud CI or production E2E result.

## Actual browser verification

ChatGPT actual settings was re-inspected read-only as a hierarchy/density reference. Account/settings were not changed.

- Local Site desktop + 320×640 viewport: 진위확인 3 input switches, visible labels, file help, incident expansion, close and focus return checked. At 320px, document width=320, dialog width=288, no horizontal overflow. After body scrollTop=207, header top=17 and close button remained visible.
- Local Site desktop: all 7 생활정보 detail forms checked; 600px heading/form columns align. Mobile support detail: width288 / left16, document width320.
- Nonpersonal example `전주시 / 청년 주거 지원` → 질문 준비하기 correctly populated composer and did not send. Agent-created example draft cleared afterward. No analysis, personal upload, payment, or API write executed.
- 제휴몰 entry uses actual official Account connected-services navigation, not an invented local shop grid. Live catalog inspected read-only; no service was connected/disconnected. This is not local full integration E2E.
- Temporary viewport override restored. Existing tabs retained for follow-up.

Screenshots in external artifact directory `C:/Users/jshnc/.codex/visualizations/2026/10/03/01a10023-5348-79b0-87ab-3a03393311f2/`:

- `verification-dialog-refinement-desktop-20261005.jpg`
- `verification-dialog-refinement-mobile-20261005.jpg`
- `life-detail-refinement-desktop-20261005.jpg`
- `life-detail-refinement-mobile-20261005.jpg`

## State / limitations

IMPLEMENTED / SELECTED_LOCAL_UI_CHECKED / LOCAL_CHECKS_PASS.
Exact commit and FEATURE_PUSH evidence: external `design-verification-life-handoff-20261005.md`.
MAIN_MERGED=NO / PRODUCTION_DEPLOYED=NO / DEPLOY_ID=NONE for this batch. Deployment deferred by user; trusted Ncloud CI/merge gate remains pending.
Desktop local UI is verified for this scope only. Android Chrome / Samsung Internet / iPhone Safari real devices, Android/iOS Native NOT_TESTED. Dark runtime for this batch NOT_TESTED (semantic tokens reused).
Whole 132-unit inventory NOT_RUNTIME_COMPLETE. Wallet functional wiring and Person SOS implementation remain deferred/not implemented; authenticated usage and analysis success not verified.
LIVE_MONEY=false / APP_SYNC_PENDING=KEEP. LOTBI skill maintained owner/state/gate boundaries; browser skill distinguished local, isolated, and production read-only evidence.

Next: continue actual remaining detailed UI issues in existing owners; combine the preserved login candidate only through the normal release gate when deployment resumes.
