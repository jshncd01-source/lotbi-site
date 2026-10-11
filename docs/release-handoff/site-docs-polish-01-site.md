READY_FOR_DEPLOY=YES
MIGRATION=NO
DEPLOY_ORDER=SITE 단독. CSS 한 파일(`site-consumer-documents.css`)과 캐시 토큰 갱신뿐이라 다른 조각과 순서 의존이 없다.
USER_DECISION_NEEDED=NONE. 소유자 확인 1건(아래 '문구 확인').

# SITE-DOCS-POLISH-01 — 안내 문서 페이지군 정리 (QA 화면전수 01 TOP5-②)

REPO=lotbi-site
FEATURE_BRANCH=feature/site-docs-polish-01
FEATURE_SHA=이 문서 커밋(branch HEAD). `git ls-remote origin`으로 확인한다.
BASE_MAIN=f2e391adb (SITE-T56 병합본, 이 branch에 병합함; push 직전 다시 확인)

## 무엇이 문제였나 (QA 보고서 TOP5-②·N5)

회사소개·구독 철회/해지·서비스 장애·분쟁 해결 기준·이용약관·개인정보처리방침·계정 삭제·문의 8곳이 같은 CSS를 쓴다.
1. **한글 낱말이 중간에서 끊겼다** — "소비자/가", "관문입/니다", "스토/어" (`word-break: keep-all`이 본문에 없었음).
2. **PC에서 본문이 로고보다 68px 안쪽에서 시작했다** — 머리(로고·메뉴)와 푸터는 896px 폭, 본문 칼럼은 760px로 그 안에서 가운데 정렬(측정: 로고 left 185, 본문 left 253).
3. **목차 "이 페이지의 내용"이 작은 접이식 줄**이었다(14px 글씨, 선 두 줄 사이).

## 바꾼 것 (`site-consumer-documents.css`만)

- **칼럼 정렬**: `.consumer-document .wrap` 폭 960 → 824(= 읽기 칼럼 760 + 좌우 32). 이제 로고·메뉴·본문·목차·푸터가 **같은 왼쪽 선과 오른쪽 선**을 쓴다(측정: 로고·h1·목차·푸터 모두 left 253, 폭 760).
- **낱말 유지 줄바꿈**: h1·h2·h3·p·li·dt·dd·summary·blockquote·strong에 `word-break: keep-all`(긴 주소·URL은 기존 `overflow-wrap`이 그대로 잡는다). 제목은 `text-wrap: balance`.
- **목차**: 연한 면 + 둥근 16px 패널, 제목 16px/600 + 오른쪽 **선 화살표**(열리면 뒤집힘), 항목 15px·높이 48, 글자색 본문색(이전 흐린 색). 기존 `<details>`·`<nav>` 구조와 `site-document-navigation.js`는 그대로.
- **문서 문구·마크업은 하나도 바꾸지 않았다.** `privacy.html`·`terms.html`을 포함한 모든 HTML은 캐시 토큰(`?v=aset-…`)만 바뀐다(동의 증거 해시 검증 통과).
- 영어 머리말(LOTBI PHILOSOPHY·TERMS 등)은 이미 main(COMMON-UI-POLISH-02)에서 숨김 처리되어 있어 이번에 손대지 않았다. QA가 본 "/exchange 주소는 유지하며" 개발 메모도 main에는 없다(SITE-T55의 서비스 장애 문서 개편으로 사라짐).

## 사용자 시나리오 (사용자 기준 8)

| # | 시나리오 | 이전 | 이후 | 탭 | 막힌 곳 | 사진 |
|---|---|---|---|---|---|---|
| 1 | 휴대폰에서 회사소개를 읽는다 | "소비자/가", "관문입/니다"처럼 낱말 중간 줄바꿈, 목차는 작은 ▶ 줄 | 낱말 단위 줄바꿈, 목차는 둥근 패널 | 0 | 없음 | `design/evidence/site-docs-polish-01/compare_about_390.png` |
| 2 | 다크 모드로 구독 철회·해지 기준을 읽는다 | 줄 끝마다 낱말이 잘림 | 낱말 단위, 목차 패널(다크 면 #2F2F2F) | 0 | 없음 | `compare_refund_dark_390.png` |
| 3 | PC에서 구독 철회 문서를 연다 | 로고보다 본문이 68px 오른쪽에서 시작 | 로고·본문·푸터가 한 선 | 0 | 없음 | `before/refund_1280_light.png` → `after/refund_1280_dark.png` 등 |
| 4 | 목차로 "제5조 환불 방법"으로 이동한다 | 작은 ▶ 줄을 눌러 펼침(탭 영역 44) | 패널을 눌러 펼침(52), 항목 48 | 2 | 없음 | `after/*` |

## 검증 (Windows, headless Chrome — 휴대폰 에뮬레이션이며 실기기 아님)

- **T56 main을 병합한 뒤** 13개를 다시 돌려 전부 통과: `asset_cache_version --check`, `validate_consumer_documents_01`, `validate_common_ui_polish_02`, `validate_privacy_table_width_01`(표가 읽기 칼럼 안에 머묾), `validate_static_pages_theme_01`(10개 푸터 문서가 LOTBI 테마를 따름), **`validate_not_found_page_01`·`validate_subscribe_dark_contrast_01`**(둘 다 이 CSS의 `.consumer-document`를 쓰는 T56 화면이라 함께 확인), `validate_brand_logo_theme_aware_01`, `validate_brand_official_logo_01`.
- 파이썬: `validate_hardening.py`(잠금 내용), `validate_legal_pages.py`, `validate_document_cache_policy_01.py`, `validate_social_legal_manifest_01.py` 모두 PASS.
- 전후 화면: 4곳(회사소개·구독 철회·서비스 장애·분쟁 해결) × 휴대폰 밝게/어둡게 + PC 밝게/어둡게, 문의·약관·계정삭제·404·의견 보내기는 이후 화면으로 회귀 확인. 폴더: `design/evidence/site-docs-polish-01/{before,after}`.

## 위험 · 못 한 것

1. **칼럼 폭 960→824**: 푸터 사업자 정보 문단이 760px로 좁아져 줄 수가 늘 수 있다(화면에서 확인, 겹침·잘림 없음).
2. 이전·이후 사진은 로컬 정적 서버 + headless Chrome 캡처다. 실기기·큰 글씨는 NOT TESTED.
3. **기존 실패(이 변경과 무관)**: `validate_mobile_footer_legal_sheet_01`(홈 푸터 시트)은 이 PC(Windows)에서 `761px: mobile disclosure leaked into desktop 'block' !== 'none'`로 실패한다. **아무것도 안 바꾼 깨끗한 main(68b3161e)에서도 같은 줄에서 같게 실패**함을 확인했다(Linux gate에서는 통과했을 가능성). 이 조각은 홈·푸터 CSS를 건드리지 않았다.

## 문구 확인 (소유자 1건, 이번에 안 건드림)

- `refund.html` 맨 끝 문단에 **"기존 호환 주소인 서비스 장애·하자 처리"**라는 개발자 말투가 남아 있다. 청약철회 기준 문서라 법적 문구로 보고 제가 고치지 않았다. "기존 호환 주소인"을 빼고 "…은 서비스 장애·하자 처리에서 확인할 수 있습니다"로 줄여도 뜻은 같다. 승인하시면 다음 조각에서 한 줄만 고친다.

## 소유자 할 일

- 휴대폰 실기기에서 회사소개·구독 철회 문서를 열어 **낱말이 끊기지 않는지, 목차 패널이 눌리는지**만 확인. 어색한 문서 이름을 알려 주시면 그 문서부터 다시 본다.
