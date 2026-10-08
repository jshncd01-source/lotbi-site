READY_FOR_DEPLOY=YES

# NEIS SCHOOL OFFICIAL LINKS / ADMIN SOURCE MANAGEMENT P0 (Site)

REPO=lotbi-site
FEATURE_BRANCH=feature/neis-school-official-links-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD). 문서에는 자기 SHA를 넣을 수 없으므로 `git ls-remote`로 확인한다.
CODE_SHA=b8f32b7606df1bb3481b64b9d6a305ddb7275bc1
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=89adbb378a11fba8e42a445b62f5ffab8f358f5f
LATEST_MAIN_RECHECK=89adbb37 (2026-10-08 KST, 개발 기준 main과 같음)
ASSET_TOKEN=aset-6e296933b21a (scripts/asset_cache_version.mjs --check PASS)
TEST_STATUS=site-review 전체 비교: baseline 89ad 171 passed / 이 branch 172 passed. 신규 validator 12/12 PASS(실제 Chrome 360/375/390/412/1280)
NEW_FAILURES=0 (양쪽 공통 실패 3건은 기존 RED: mobile_footer_legal_sheet_01, site_avatar_fallback_runtime, calendar_weather_region_province_01)
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
DEPENDENCIES=Core feature/neis-school-official-links-01-core (Core가 links를 내려줘야 버튼이 보인다. Core가 옛 버전이면 버튼만 안 보이고 나머지는 그대로다)
DEPLOY_ORDER=Core → Site
USER_DECISION_NEEDED=NONE

## 변경 요약

- 학교 카드 버튼: [학교 홈페이지], [급식·식단 원문]
  - 링크가 있을 때만 보이고, 없으면 자리표시도 없다.
  - 새 창으로 열리고 rel="noopener noreferrer", referrerPolicy no-referrer를 쓴다.
- 브라우저 쪽에서 링크를 다시 검사한다(공개 http(s)만).
- 급식 출처는 계속 "NEIS 교육정보 개방 포털"이다. 직원이 등록한 원문을 NEIS로 표기하지 않는다.
- 홈페이지 답변은 주소 출처(NEIS / LOTBI 운영 등록)를 밝힌다.
- 상세: docs/NEIS-SCHOOL-LINKS-01.md

## 롤백

- 이전 Site로 되돌리면 버튼만 사라진다.
