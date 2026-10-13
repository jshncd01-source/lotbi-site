# 홈 메인 최소화·회사정보 상시 표시 READY

- READY: YES
- 저장소: `lotbi-site`
- feature 브랜치: `feature/footer-business-home-only-01-site`
- 기준 Ncloud main: `48e5f06d43914c3923ef474477880aedf062c583`
- 구현 commit: `9de03d46d391d3504fa7b6aa9703e3f82c5a5969`
- 검사기 정비 commit: `a77b7a1692c27d8300ca136c858bdbe75ad30a03`
- 최종 feature HEAD: 이 문서를 포함한 feature 브랜치의 Ncloud readback SHA를 외부 READY 보고서에 기록
- main 병합: NO
- Production 배포: NO

## 사용자 확정 범위

- 홈 화면에서 `내 즐겨찾기` 전체 영역과 관련 편집·저장 동작을 제거했다.
- 홈 화면에서 고정 `의심되는 문자 확인` 버튼과 빠른 안전 확인 영역을 제거했다.
- 홈의 롯비 캐릭터, 제목·안내문, 대화 입력창, 첨부, 비활성 전송 버튼을 보존했다.
- 회사정보는 홈 화면 하단에 별도 클릭 없이 항상 보이도록 했다.
- 회사정보는 정적·법적 페이지에서 화면에 노출되지 않도록 했다. 동의문 해시 안정성을 위해 잠긴 법적 문서의 원문은 변경하지 않았다.
- 왼쪽 데스크톱·모바일 `사기·피싱 확인` 정식 메뉴를 보존했다.
- 카테고리 이름과 메뉴 이름·순서는 변경하지 않았다.
- 이전에 취소된 READY는 재사용하지 않았다.

## 검사기 변경 및 이유

- `.github/workflows/site-review.yml`
  - 제거된 즐겨찾기를 요구하던 검사를 `validate_home_conversation_only_01.mjs`로 교체했다.
  - 회사정보 홈 한정 노출을 확인하는 `validate_footer_business_home_only_01.mjs`를 등록했다.
  - 클릭식 회사정보 시트를 요구하던 검사를 `validate_home_footer_company_visible_01.mjs`로 교체했다.
- `scripts/validate_uiux_phase1_01.mjs`
  - 즐겨찾기 존재 전제를 제거하고 대화 입력 중심 홈과 정식 메뉴 보존을 검사하도록 변경했다.
- `scripts/validate_conversation_answer_ux_01.mjs`
  - 홈 즐겨찾기 클릭 전제를 제거하고 즐겨찾기·고정 버튼 부재, 입력창과 정식 메뉴 보존을 검사하도록 변경했다.
- `scripts/validate_home_same_url_stability_01.mjs`
  - 회사정보가 클릭식 시트 없이 홈에 직접 표시되는 새 동작을 검사하도록 변경했다.
- `scripts/validate_hardening.py`
  - 삭제된 회사정보 시트 모듈의 allowlist 항목을 제거했다.

브라우저 검사기는 기존과 같은 반응형·라이트/다크 강도로 실행한다. 새 홈 검사기와 회사정보 검사기는 Chrome 실행 직전에 `fs.mkdtempSync(...)`로 독립 프로필 폴더를 만든다.

## 검증 결과

- `SITE-UIUX-PHASE1-01`: PASS
- `SITE-CONVERSATION-ANSWER-UX-01`: PASS — 320/360/390/412/1280
- `SITE-HOME-CONVERSATION-ONLY-01`: PASS — 360×780·1280×900, 라이트·다크
- `SITE-HOME-FOOTER-COMPANY-VISIBLE-01`: PASS — 360/390/760/1280
- `FOOTER BUSINESS HOME ONLY 01`: PASS
- `SITE-HOME-FIRST-PAINT-STABILITY-01`: PASS
- `SITE-AUTH-UNKNOWN-STATE-01`: PASS
- `SITE-HOME-FOOTER-DIRECT-VISIBILITY-01`: PASS
- `SITE-ASSET-CACHE-COHERENCE-01`: PASS
- `PUBLIC HARDENING VALIDATION`: PASS
- `SOCIAL LEGAL MANIFEST 01`: PASS
- `sync_footer_business_info.py --check`: PASS
- `SITE VALIDATION`: PASS — 공개 페이지 11개
- `COMMON-UI-POLISH-01`: PASS
- `SITE-STATIC-PAGES-THEME-01`: PASS

첫 `validate_conversation_answer_ux_01.mjs` 실행 중 Windows Chrome 임시 프로필의 `DevToolsActivePort` 파일을 읽는 과정에서 `EBUSY`가 발생했다. 제품 실패가 아니며 같은 코드로 전체 재실행해 PASS를 확인했다. 최초 실행 자료도 삭제하지 않고 증거 폴더에 보존했다.

## 증거

- 브라우저 화면·로그: `C:/Users/jshnc/Documents/Codex/2026-10-11/1-t56-1-ready-github-workflows/outputs/home-main-approved-01`
- 화면: 360×780 및 1280×900, 라이트·다크, 본문과 회사정보 하단
- 가로 넘침: 0

## 미검증 및 배포 경계

- Android/iOS 실제 기기: NOT_TESTED
- main 병합: 배포 총괄 담당
- Production 배포 및 운영 화면 확인: UNVERIFIED
