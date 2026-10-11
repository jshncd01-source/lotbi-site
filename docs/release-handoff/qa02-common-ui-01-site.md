READY_FOR_DEPLOY=YES

# qa02-common-ui-01-site — release handoff (QA 일괄보고 02 Site 공통 7건)

REPO=lotbi-site
FEATURE_BRANCH=feature/qa02-common-ui-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ssh://lotbi-ncloud-git/srv/git/repositories/lotbi-site.git refs/heads/feature/qa02-common-ui-01-site`)
BASE_MAIN_SHA=afb7057d1d8c149e2b46eb1d656b1049e36b831d (Ncloud site main, push 직전 확인 동일)
CODE_SHA=6cdead60664ab41d5a05bf4793b1bd93bd8221c4
ASSET_VERSION=aset-33623027ca60
INCLUDES=feature/common-ui-polish-01-site 코드 fa60218a(= QA 01 공통 8건 + main afb7057d). 그 branch가 먼저 main에 들어가면 이 branch의 해당 커밋은 같은 커밋이라 중복 없이 합쳐짐. 그 branch의 READY 문서와 #5(connected-services-name-01-site)는 포함하지 않음
PAIRED_BRANCH=lotbi-web feature/qa02-common-ui-01-web (Account 쪽 C1·C3·C4·C5, 서로 독립 — 순서 무관)
DEPLOY_SCOPE=lotbi-site only. Core 무변경
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
CONSENT_HASH_CHANGED=NO (privacy·terms 파일 무변경 — 영어 머리말은 공통 CSS로 숨김. emit/hardening PASS)
THEME_TOKENS_CHANGED=NO (site-theme-tokens.css 무변경 → Web theme sync 불필요)
USER_DECISION_NEEDED=NONE

## 담당 나눔

| QA 02 | 담당 |
|---|---|
| C6·C7·C8·C9·D4·E2·E3 | **이 branch** |
| D1·D2·D3 | 안심케어 방 `feature/safecare-consent-visible-01-site` cb12d278(그쪽이 처리·READY 보냄) — 이 방은 `site-person-ui.js` 무변경 |
| E1 | 상품권 방 `feature/onnuri-coverage-copy-e1-01-site` 69c6256c — `site-life-onnuri.js` 무변경 |
| C1·C3·C4·C5 | web `feature/qa02-common-ui-01-web` |
| C2(메뉴 이름 통일) | 이번에 안 함 — 아래 "남긴 것" |

## 변경 (표시만)

- **C9** 고정 대화 목록 안의 '고정' 배지 제거(`site-conversation.js`). 머리글 '고정'은 그대로. ⋯ 버튼 이름("○○ 대화 메뉴")은 09-20부터 이미 붙어 있다 — 접근성 트리에서 확인(`find` 결과 "시험 대화 대화 메뉴"). QA의 "이름 없음"은 글자 ⋯가 보이지 않는 것을 읽은 것으로 보여 코드는 안 바꿈.
- **C7·C8** 다크에서 프로필 이니셜 원(#eef0f6 위 #f5f5f5, 1.05:1)과 대화 메뉴 '삭제'(#a02645 위 #2f2f2f, 1.8:1)에 다크 값(`site-sidebar-nav.css`; 원 #353535, 삭제 #ff8fa3). 라이트·홈 skin 무변경. `data-site-theme="dark"`와 `system`+OS 다크 둘 다.
- **D4** 진위확인 결과가 생기면 결과 위치로 스크롤(`prefers-reduced-motion`이면 즉시). Core가 보내는 '확인된 내용'(resolver·DNS·IP 등록 국가 같은 기술 확인)은 "확인된 내용 자세히 보기"로 접음(`site-scam-shield.js`). 결론·지금 할 일·하지 마세요·이유·공식 근거는 그대로 펼쳐 둠. **Core 문장은 안 바꿈**(Core 개발 쪽 몫).
- **E2** 하단 안내 9쪽: 상단 메뉴를 '홈 · 문의'로 통일(환불·교환·분쟁에서 '구독' 제거 — 하단 링크줄에 구독 안내가 이미 있음). 영어 머리말(TERMS·PRIVACY·LOTBI PHILOSOPHY 등)은 `consumer-document` 공통 CSS 한 줄로 숨김(구독 안내만 body 클래스가 달라 그 한 줄을 HTML에서 삭제). **privacy.html·terms.html 바이트 무변경**(동의 증빙 해시).
- **E3** `exchange.html`의 개발 메모 문장("기존 심사자료와 외부 링크의 호환을 위해 /exchange 주소는 유지하며") 삭제. 주소는 그대로(canonical). `validate_refund_subscription_policy_alignment_01.py`가 이 문장을 필수로 고정하고 있어 **그 항목 하나만** 뺌(주석에 근거) — 청약철회·환불·복구 계약 문구 검사는 그대로.
- **C6** `about.html`: 철학 문구(검사기 고정)는 그대로 두고 그 바로 뒤에 "지금 LOTBI에서 할 수 있는 일"(캘린더·지역정보·안심케어·Life Wallet·진위확인 각 한 줄). '쇼핑몰'·거래·결제를 새로 약속하는 말은 넣지 않음. 철학·방향 문단은 삭제하지 않음 — 방향 자체를 바꿀지는 소유자 결정.
- 새 검사기 `scripts/validate_common_ui_polish_02.mjs`(소스 계약 + 대화 화면 상태의 headless Chrome 측정), `site-review.yml` 등록. **역시험**: 수정 전 `site-sidebar-nav.css`로 되돌리면 "dark initials 1.05"로 실패.

## 남긴 것(이번에 안 한 QA 02 공통 항목 — 사유)

- **C2 메뉴 이름 통일**(사이트 '개인테마·설정·도움말' vs 계정 '개인 맞춤 설정·플랜 업그레이드·사용량…'): 이름을 하나로 정하는 것은 소유자 결정이고, 사이트 계정 메뉴에 '플랜 업그레이드·사용량' 항목을 새로 추가하는 일이라 별도 branch로.
- **C3 결제하기 동작**은 지시대로 표시만(web branch).
- **C4 Free 혜택 목록**: Free 플랜 정의에 한도 값이 없어(`EXISTING_CONTRACT`) 단정할 근거가 없음. 소유자가 무료 혜택을 확정하면 표로.
- **F 디자인 정체성 6항목**: 방향 결정이라 개발 범위 밖.
- **D1** 동의 체크 숨김은 안심케어 방이 처리(READY 보냄).

## 검증

- 신규 `validate_common_ui_polish_02.mjs` PASS(10 checks), 01 검사기 PASS(11).
- 파이썬 검사기 21개 전부 PASS(`validate_*.py`), asset `--check` PASS.
- 같은 branch에서 관련 mjs 검사기 21개 PASS(실패 0): common_ui_polish_01·02 · conversation_management_10 · sidebar_viewports_04 · conversation_sidebar_ux_01 · consumer_design_shell_01 · sidebar_information_architecture_04 · static_pages_theme_01 · scam_shield_mvp_01 · scam_shield_double_check_p0 · scam_shield_result_banner_contrast_01 · scam_shield_login_gate_contrast_01 · scam_shield_photo_picker_01 · brand_official_logo_01 · dark_brand_surfaces_01 · global_dark_theme_contrast · theme_bootstrap_first_paint_01 · consumer_theme_sync_01 · theme_auto_schedule_02 · conversation_calendar_actions_01 · calendar_system_dark_01. 검사기가 남긴 임시 폴더 없음. 전체 150단계 회귀는 gate(Linux)에서.
- 알려진 기존 RED(Windows, main도 같은 오류): `validate_mobile_footer_legal_sheet_01`의 "761px: mobile disclosure leaked into desktop" — 같은 오류 문장을 이 branch에서도 확인, 새 실패 아님.
- 로컬 실화면(이 worktree 정적 서빙, 390px): 회사 소개 — 영어 머리말 없음·상단 '홈 문의'·카드 5개 렌더·가로 넘침 없음·페이지 목차에 새 제목 자동 포함. 다크 이니셜·삭제 대비는 위 검사기가 계산값으로 확인.
- **NOT TESTED**: 진위확인 결과 접힘·스크롤은 소스 계약과 기존 진위확인 검사기 4종(mvp·double_check_p0·photo_picker·result_banner_contrast) PASS로만 — 실제 Core 분석 응답과 휴대폰 화면은 미확인. Production NOT TESTED. 실기기 NOT TESTED.
