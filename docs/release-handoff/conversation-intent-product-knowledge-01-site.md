READY_FOR_DEPLOY=YES

# conversation-intent-product-knowledge-01-site — release handoff

TASK=LOTBI Conversation Intelligence — 제품 사진 비교 응답 표시 (Site)
REPO=lotbi-site
FEATURE_BRANCH=feature/conversation-intent-product-knowledge-01-site
SITE_BASE_MAIN_SHA=c9c19e4cef9914f0b50d4870cbcc59e58602ddc2
CODE_SHA=0753a831a911711958997cc2ad8237a4d8a10d7c
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote origin refs/heads/feature/conversation-intent-product-knowledge-01-site`)
ASSET_VERSION=aset-a12a8f79f272
CORE_BRANCH=feature/conversation-intent-product-knowledge-01-core (lookup_result CORE-PRODUCT-LOOKUP-01 을 보냄)
DEPLOY_ORDER=CORE → SITE 권장 (역순도 안전: Core가 lookup_result를 안 보내면 카드가 그려지지 않을 뿐)

MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
SERVER_CHANGE=NO (nginx 무변경)
PRODUCTION_DEPLOYED=NO

## SCOPE (실제 변경 파일)

- `site-product-lookup.js` (신규) — CORE-PRODUCT-LOOKUP-01 PRODUCT_IMAGE 카드.
  - 사진은 image_status=OFFICIAL_PAGE_IMAGE이고 공식 페이지 https 링크가 함께 있을 때만. http·javascript:·링크 없는 이미지는 버림. 최대 3개.
  - 카드: 정사각형 사진 칸(고정 비율 — 늦게 뜨는 사진이 대화를 밀지 않음) / 제품명 / 출처 host / "공식 페이지 열기"(새 창, noopener noreferrer). 사진 referrerPolicy no-referrer.
  - 사진 로드 실패 → 깨진 아이콘 대신 "이미지를 불러오지 못했어요" 칸 + 공식 링크 유지. 확인된 사진이 없으면 "공식 이미지를 확인하지 못했어요"/"공식 제품 페이지를 찾지 못했어요" 칸 + (있으면) "공식 페이지에서 사진 보기".
  - 아래 한 줄: "사진 출처: 각 제품 공식 페이지에 게시된 대표 이미지" 또는 "공식 이미지를 확인하지 못해 사진 대신 공식 페이지 링크를 보여드려요".
- `site-product-lookup.css` (신규) — 2개는 모든 폰 폭에서 나란히, 1개는 최대 220px, 3개는 420px 이상에서 3열. 테마 토큰(라이트/다크), 사진 칸은 흰 배경.
- `site-core.js` — 로그인·게스트 응답 둘 다 `productLookup`(lookup_result의 contract_id가 CORE-PRODUCT-LOOKUP-01일 때만).
- `site-conversation.js` — import 1줄, 답변 meta.productLookup 저장(두 경로), 메시지 렌더에서 카드 추가(새로고침·대화 복원에도 그대로 다시 그림).
- `scripts/validate_product_photo_compare_01.mjs` (신규) + `.github/workflows/site-review.yml` step 1개.
- asset token 갱신(`node scripts/asset_cache_version.mjs --write`) — 다른 branch와 token 충돌은 hunk 단위로 한쪽 채택 후 --write 재실행.

## TEST_STATUS

TESTS=PASS (NEW_FAILURES=0, Windows 로컬, CDP viewport 에뮬레이션)
- scripts/validate_product_photo_compare_01.mjs — PASS: 360x780, 375x812, 390x844, 412x915, 1280x900, 390x844 dark.
  - 실제 대화 턴(입력창 → 전송 → Core mock 응답)으로 확인: 두 공식 사진 나란히(같은 줄, 360폭에서 카드 125px·사진 123x123 정사각형), 한 장은 실제 로드, 한 장은 404 → "이미지를 불러오지 못했어요" 칸(깨진 아이콘 없음), 공식 링크·host 유지, 새 창·noopener, 링크 한 줄, 가로 스크롤 0, 대화 저장소에 결과 보존, 다크에서 글자 대비.
  - 공식 이미지 없는 1개 제품: "공식 이미지를 확인하지 못했어요" 칸 + "공식 페이지에서 사진 보기", 카드 220px 이하.
  - 제원 답변(PRODUCT_SPEC)에는 사진 칸이 생기지 않음.
- 전체 scripts/validate_*.mjs 195개(배포총괄 기준 회귀 범위): 1차 병렬 183 PASS / 12 FAIL → 12개를 feature·baseline(main c9c19e4c) 직렬 재실행.
  - 양쪽 모두 실패(기존 환경 문제, 내 변경과 무관): validate_auth_unknown_recovery_browser_01(임시 폴더 rm EPERM), validate_calendar_system_dark_01(CRLF 체크아웃), validate_mobile_footer_legal_sheet_01, validate_site_avatar_fallback_runtime.
  - 나머지 8개는 재실행 PASS(1차 실패는 Chrome spawn ETIMEDOUT·"Failed to fetch dynamically imported module" 등 동시 실행 부하). validate_composer_auto_grow는 feature 단독 2회 연속 PASS.
- node scripts/asset_cache_version.mjs --check PASS (aset-a12a8f79f272).
- Linux CI NOT TESTED (이 PC에 Linux 실행 수단 없음).

MERGE_NOTES
- 시험 병합(토큰 정규화 후 git merge-file): feature/regional-news-p0-site e2757290, feature/chat-long-answer-scroll-anchor-01-site a34e838c, feature/chat-mobile-keyboard-dismiss-reading-view-01-site e26e2896 — asset token 충돌 59파일뿐, 실질 충돌 0. feature/site-refresh-route-restore-01 c954c833 — 충돌 없음.
- site-core.js의 productLookup 줄은 두 응답 객체의 맨 끝(calendarDraft / calendarCandidateSet 다음)이라 지역뉴스 newsResult 줄(schoolResult 다음)과 다른 hunk.
- MAIN_DRIFT: push 시점 site main 22631a25(base c9c19e4c 이후 site-t24·t25·t26 train). 토큰 정규화 시험 병합 결과 asset token 충돌 59파일뿐, 실질 충돌 0 → 충돌 hunk는 main 쪽 토큰 채택 후 `node scripts/asset_cache_version.mjs --write`.

## 미확인

- 실기기(iPhone Safari·Android Chrome·Samsung Internet) NOT TESTED — CDP viewport 에뮬레이션만.
- 실제 브랜드 이미지 CDN에서의 로드(배포 후 smoke): crocs.co.kr og:image는 media.crocs.com 이미지.

USER_DECISION_NEEDED=NONE
