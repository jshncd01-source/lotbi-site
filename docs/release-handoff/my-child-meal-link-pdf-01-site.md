READY_FOR_DEPLOY=YES
MIGRATION=NO (Core 짝 branch에 p0_0115_meal_plan_sources)
ENV_CHANGE_REQUIRED=NO
DEPLOY_ORDER=CORE → ADMIN → SITE (Core가 먼저 없으면 overview에 meal_plans가 없어 카드가 안 보일 뿐, 다른 화면은 그대로)
USER_DECISION_NEEDED=NONE

# MY-CHILD-MEAL-LINK-PDF-01 — 내 아이 학교·유치원: 학교 공개 급식표 카드 (Site)

REPO=lotbi-site
FEATURE_BRANCH=feature/my-child-meal-link-pdf-01-site
AUTHORITATIVE_MAIN=61d3ce37f8ab3298d65411f68b327702e4c7bf0e
CODE_SHA=3e4bdcc27a74b19f3836d8bbf88396b3edb3fac1
ASSET_VERSION=aset-d74089124a9d
PAIRS=core feature/my-child-meal-link-pdf-01-core · admin feature/my-child-meal-link-pdf-01-admin

## 무엇이 바뀌나 (실제 변경 파일 5개, 나머지는 asset 토큰)

- `site-my-child-client.js`: overview의 `meal_plans`를 읽음 — 링크(http/https만)와 PDF·JPG·PNG 파일만 남기고, 파일 경로는 응답 값이 아니라 검증한 항목 id로 만듦(`/v2/life/my-children/{mci_…}/meal-plans/{mps_…}/content`). `fetchMealPlanFile`: Bearer, credentials omit, Content-Type이 PDF·JPEG·PNG가 아니면 거절.
- `site-life-my-child.js`: 학교는 이번 주 NEIS 급식이 없을 때(Core가 visible로 보낼 때) "오늘 급식" 바로 아래, 유치원은 기본정보 아래에 **학교/유치원 공개 급식표** 카드. 항목마다 이름, "학교 공개 자료, LOTBI 직원 등록 · 10.6(화) 등록", 링크는 "급식표 열기"(새 탭), PDF는 "PDF 보기" — 누르는 순간 새 탭을 먼저 열고 파일이 오면 그 탭에 표시(await 뒤 팝업 차단 회피), 새 탭이 막히면 "PDF 열기" 링크로 대체, 이미지는 "이미지 보기"로 카드 안에 표시. 카드 위 안내 "알레르기 번호를 읽지 않아 자동 강조·알림은 되지 않으니 직접 확인해 주세요". 알레르기 강조 표시는 붙지 않음.
- `site-life-my-child.css`: 카드 스타일(테마 토큰만, 버튼 44px).
- **급식 없음 3경우 구분(소유자 추가 지시)** — Core `meals.coverage`를 읽어:
  - ① 그날·그 주만 없음(NEIS 급식 있는 학교): "오늘은 급식이 없는 날이에요.", 방학·휴업 주는 "이번 주는 NEIS 급식이 없어요. 방학·휴업 기간일 수 있어요."
  - ② NEIS가 이 학교 급식을 최근 120일 동안 싣지 않음(NOT_PROVIDED): 안내형 "이 학교는 NEIS로 급식표를 제공하지 않는 것 같아요. 학교 홈페이지나 가정통신문에서 확인해 주세요." + "최근 120일 동안 NEIS 급식 기록이 없어요." 그 아래 직원이 등록한 학교 공개 급식표 카드(있으면).
  - ③ NEIS 장애: 기존 문구 그대로. coverage를 모를 때(UNKNOWN·옛 Core)도 기존 중립 문구.
  - 유치원: 기본정보 아래 "급식 — 유치원은 공공 데이터로 급식표가 제공되지 않아요." → 공개 급식표 카드(있으면), 없으면 "유치원에서 받은 식단표나 가정통신문을 확인해 주세요."
- 검사기 `scripts/validate_my_child_school_01.mjs` + fixture: Core `app/meal_plan_sources.py`로 만든 `meal_plans` 블록, 계약 검사(악성 링크·HTML 파일·잘못된 id·응답의 다른 경로 무시), 실제 Chrome에서 카드·순서·출처·등록일·링크 속성·PDF 새 탭(opener 끊김, blob)·Bearer 파일 요청·유치원 카드 확인.

## 검증

- `validate_my_child_school_01`: 47 checks PASS(320/360/412 모바일·1280 데스크톱, 넘침 없음·조작부 44px, 라이트·다크 대비, 로그아웃) — main 61d3ce37 merge·급식 없음 구분 반영 후. 두 번째 학교(fixture가 NOT_PROVIDED)는 안내형 문구와 근거 줄, 유치원은 기본정보 → 급식 안내 → 공개 급식표 순서 확인
- 관련 검사기(내 아이·asset 토큰 관련 38개): 38/38 PASS(최종 커밋 기준 단독 순차 실행, CHROME_BIN 지정). 중간에 Core 회귀와 동시에 돌렸을 때 나온 "Failed to fetch dynamically imported module"은 부하성 — 단독 재실행에서 모두 통과
- main 61d3ce37(SITE-T53) 정상 merge: 충돌 75개 파일 모두 asset 토큰(+ wallet 두 파일 import 줄, main과 동일하게 정리) → `asset_cache_version.mjs --write`. main 대비 실제 차이는 위 5개 파일뿐(토큰 제외 비교)

## 운영

PRODUCTION_DEPLOY=NOT EXECUTED
ENVIRONMENT_CHANGE=NONE
