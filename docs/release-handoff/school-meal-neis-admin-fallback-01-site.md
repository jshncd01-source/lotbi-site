READY_FOR_DEPLOY=YES

# SCHOOL MEAL P0 — NEIS AUTO + ADMIN FALLBACK (Site)

REPO=lotbi-site
FEATURE_BRANCH=feature/school-meal-neis-admin-fallback-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD). 문서에는 자기 SHA를 넣을 수 없으므로 `git ls-remote`로 확인한다.
CODE_SHA=3ba75da9e64318f0f66036fae18aced93edf2d77
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=c9c19e4cef9914f0b50d4870cbcc59e58602ddc2
DEPENDENCY_MAIN=NEIS 학교 링크 Site 99619283이 main c9c19e4c(SITE-T20)에 포함된 뒤 착수
ASSET_VERSION=aset-7c59c3877783 (scripts/asset_cache_version.mjs check PASS)
TEST_STATUS=새 검증 scripts/validate_school_meal_neis_admin_fallback_01.mjs 18 checks PASS(실제 Chrome 360/375/390/412/1280, 라이트·다크) / scripts/validate_* 195개 중 192 PASS
NEW_FAILURES=0 — 실패 3개(validate_calendar_system_dark_01, validate_mobile_footer_legal_sheet_01, validate_site_avatar_fallback_runtime)는 baseline main c9c19e4c에서도 같은 실패(Windows 로컬 기존 RED). 병렬 실행 중 실패했던 6개는 단독 재실행 PASS(포트·부하).
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
DEPENDENCIES=Core feature/school-meal-neis-admin-fallback-01-core(meal_summary·weekly·source_type 계약) 먼저
DEPLOY_ORDER=CORE → ADMIN → SITE
USER_DECISION_NEEDED=NONE

## 변경 요약

- 급식 카드(학교 결과)
  - 오늘 급식: 메뉴 6개까지 + "메뉴 N개 더 보기", 칼로리, NEIS 알레르기 표시 그대로 + "알레르기 정보는 학교·NEIS 제공 내용을 확인하세요."
  - [이번 주 급식](또는 [다음 주 급식]): Core가 그 주에 더 있다고 할 때만. 누르면 일반 질문으로 보내고 저장 학교가 함께 간다.
  - 이번 주: 급식 있는 날만(주말 포함 시 표시), 오늘 강조(aria-current), 식사별 한 줄
  - [급식표 보기]: 직원이 등록한 학교 급식표 주소가 있을 때만(이전 이름 "급식·식단 원문"). 홈페이지로 대신하지 않음. [학교 홈페이지]는 그대로.
  - 직원 보완 급식: "학교 공식자료 기준"(안전한 근거 주소) / "직원 확인 정보" 배지, 알레르기 문구 원문 그대로, 출처 줄에서 NEIS라고 하지 않음
  - NEIS 장애 중 최근 캐시 답이면 "최근에 확인한 급식이에요."
- 후속 질문: "내일은?", "이번 주 전체", "금요일은요?"에도 저장 학교(공개 식별값만)를 실음
- 이전 Core 응답(새 필드 없음)도 기존처럼 표시
- 학교 링크 검증 스크립트는 버튼 이름 변경("급식표 보기")에 맞춤

## 롤백

- 이전 Site 이미지로 되돌리면 된다. Core 새 필드는 이전 Site가 무시한다.
- 주의: 이전 Site는 모든 급식을 "출처: NEIS"로 보여 준다. 직원 보완 급식을 공개(PUBLISHED)로 운영하는 것은 이 Site 배포 뒤에 한다.
