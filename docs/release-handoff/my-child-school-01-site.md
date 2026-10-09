READY_FOR_DEPLOY=YES
MIGRATION=NO (Site). 짝 Core가 p0_0109_my_child_institutions(29자, down_revision p0_0107_calendar_recurring)를 가진다.
DEPLOY_ORDER=CORE → ADMIN → SITE
USER_DECISION_NEEDED=개인정보처리방침 개정 시점(초안: lotbi-core docs/MY-CHILD-SCHOOL-01-PRIVACY-DRAFT.md) — 배포 차단 아님. privacy.html은 이번에 바꾸지 않았다.

# MY-CHILD-SCHOOL-01 — 생활정보 "내 아이 학교·유치원" (Site)

REPO=lotbi-site
FEATURE_BRANCH=feature/my-child-school-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD). 문서에는 자기 SHA를 넣을 수 없으므로 `git ls-remote`로 확인한다.
CODE_SHA=3a4c3fffed5fe7901e467935591bbde559f09634
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=9e39edd06446b3e93ec68170de49df9f702e0d07 (SITE-T38c, 유치원 e926af81 포함. 이 main에서 branch를 만들었고 READY 직전 ls-remote로 그대로임을 확인)
ASSET_VERSION=aset-f638d054d3f5 (scripts/asset_cache_version.mjs --check PASS)
TEST_STATUS=scripts/validate_* 전체 240개 중 237 PASS. 새 validate_my_child_school_01 41 checks PASS(320·360·412·1280, 라이트·다크, 비로그인). 카드 수를 고정한 검사기 3개(consumer_sections_02·life_medical_category_entry_01·life_info_cleanup_final_01)와 kindergarten_official_info_01 PASS.
NEW_FAILURES=0 — 실패 3개(validate_image_attachment_thumbnail_01, validate_mobile_footer_legal_sheet_01, validate_site_avatar_fallback_runtime)는 baseline main 9e39edd0에서 같은 명령·같은 오류로 재현되는 Windows 로컬 기존 실패. 병렬 실행 부하로 "동적 모듈 로드 실패"가 난 2개(message_calendar_footer_editor_01, place_card_compact_01)는 단독 재실행 PASS.
DEVICE_E2E=NOT VERIFIED (iPhone Safari·삼성 인터넷·카카오 인앱 실기기 미확인. 모든 화면 결과는 Chrome viewport 에뮬레이션)
CORE_E2E=NOT VERIFIED (Production Core 미배포. 검사기는 lotbi-core app/my_child_api.py가 실제 NEIS·유치원알리미 표본 행으로 만든 응답 fixture를 쓴다)
ENV_CHANGE_REQUIRED=NO
NEW_SECRET_CREATED=NO
THEME_TOKENS_CHANGED=NO (site-theme-tokens.css 무변경 → Web theme-tokens sync 짝 불필요)
DEPENDENCIES=Core feature/my-child-school-01-core 먼저. Core 없이 Site만 배포되면 새 카드는 열리지만 목록 조회가 실패해 "다시 불러오기" 안내만 보인다(다른 생활정보 카드는 그대로).
PAIRED=Core feature/my-child-school-01-core, Admin feature/my-child-school-01-admin
EXPECTED_MERGE_CONFLICT=의료 자동검색 Site(feature/life-medical-auto-search-card-01-site b1dfbece, 아직 main 밖)와 같은 생활정보 카드 목록을 고친다. merge-tree 미리보기 결과 asset 토큰 외에 site-consumer-sections.js(LIFE_SHORTCUTS), 카드 검사기 3개, .github/workflows/site-review.yml에서 충돌 예상. 명령문대로 먼저 main에 들어간 쪽 기준으로 나중 쪽이 다시 merge한다.

## 변경 요약

- 생활정보 카드 7번째 "내 아이 학교·유치원"(가방 아이콘). 기존 6개 카드와 순서는 그대로다. 홀수 마지막 카드라 데스크톱 2열에서 한 줄 전체를 쓴다(기존 규칙).
- 비로그인: "로그인하고 아이 학교·유치원을 저장하세요" + 로그인(/auth/start/). Core를 부르지 않는다.
- 추가
  - 학교: NEIS 검색(Core `/v2/life/my-children/schools`) → 선택
  - 유치원: 기존 유치원알리미 시·도/시·군·구 → 이름 검색 → 선택
  - 부르는 이름: 저장 개수 기준 기본값(첫째·둘째 …), 20자
  - 알레르기 번호 1~19 체크
  - 첫 저장 때 동의 체크. 문구는 Core가 준 것을 그대로 보여 준다
- 학교 상세
  - 오늘 급식과 이번 주 급식(펼치기)
  - 고른 알레르기가 들어간 메뉴는 왼쪽 선·굵은 글씨·"대두·밀 포함"으로 강조한다
  - "알레르기 강조는 급식표 알레르기 표기 기준이에요." 의료 판단·섭취 권고 문구는 없다(검사기가 소스·화면 금지어 확인)
  - 학교 홈페이지·급식표 보기 링크
  - 학사일정(이번 달·다음 달 방학·재량휴업일·개학)
  - "출처: NEIS · 10.9 13:42 갱신"
  - NEIS에 없는 항목은 "정보 보완 요청" → "요청함"(요청자는 직원에게 보이지 않음 안내)
- 유치원 상세: 유치원알리미 기본정보(설립유형·주소·연락처 tel 링크·운영시간·홈페이지·관할·공시 기준) + 출처·갱신 시각
- 이름·알레르기 바꾸기, 삭제, 모두 삭제. 삭제는 두 번 눌러야 한다. 모두 삭제 뒤에는 동의를 다시 받는다.
- 구조
  - 새 파일: `site-life-my-child.js`(화면, 동적 import), `site-my-child-client.js`(Core 호출: Bearer, credentials omit, 401이면 기존 세션 이벤트), `site-life-my-child.css`(테마 토큰만, 다크 전용 선택자 없음)
  - 세션 토큰은 site-conversation.js가 소유한다. 사람 안심케어와 같은 방식으로 `mountMyChild` closure를 넘긴다. site-consumer-sections.js는 fetch·저장소를 쓰지 않는다
  - CSS 링크는 index.html과 auth/callback/index.html에 같은 순서로 넣었다(site-life-education.css 다음)
  - 새 검사기 `scripts/validate_my_child_school_01.mjs`를 site-review.yml에 등록. fixture는 `scripts/fixtures/my_child_school_01.json`(Core가 생성)
- 저장소에 남기는 것 없음: localStorage·sessionStorage를 쓰지 않는다. 아이 이름·생년월일·사진·학년·반 입력란이 없다. 저장 요청 본문은 기관 코드·부르는 이름·알레르기 번호(+첫 동의 버전)뿐이다(검사기가 확인).

## 롤백

- Site 이전 이미지로 되돌리면 된다. Core 데이터는 남아도 무해하다(다른 화면은 읽지 않음).
