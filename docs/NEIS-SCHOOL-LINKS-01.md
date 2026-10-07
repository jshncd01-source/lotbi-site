# NEIS-SCHOOL-LINKS-01 — 학교 카드 공식 링크 (Site)

NEIS 학교 카드에 `[급식·식단 원문]`, `[학교 홈페이지]` 버튼을 붙인다. Core가 내려준 링크가 있을 때만 붙인다.

## 계약

- Core는 `school_result.links`를 `{homepage_url, homepage_source, meal_source_url}` 형식으로 보낸다.
  - 홈페이지는 Core가 이미 고른 값이다(직원 보완 → NEIS).
  - 급식·식단 원문은 직원이 등록한 값이다.
- `site-life-school.js`의 `safeSchoolLinkUrl`이 브라우저 쪽에서 다시 검사한다.
  - 공개 `http(s)`만 통과한다.
  - 로그인 정보, 별도 포트, 내부망, IP, localhost 주소는 빈 값이 된다.
- 버튼 규칙
  - `[급식·식단 원문]`은 급식 답변(`MEAL`)과 홈페이지 답변(`HOMEPAGE`)에만 붙는다.
  - `[학교 홈페이지]`는 링크가 있으면 카드당 한 번만 붙는다.
  - 학교 후보 목록에는 붙지 않는다.
- 링크는 새 창으로 열리고 `rel="noopener noreferrer"`, `referrerPolicy="no-referrer"`를 쓴다. aria-label에는 "(새 창에서 열립니다)"가 붙는다.
- 링크가 없으면 버튼도, 비활성 자리표시도 없다.
- 출처 표기
  - 급식·일정·시간표 카드는 계속 "출처: NEIS 교육정보 개방 포털"이다.
  - 직원이 등록한 원문은 NEIS 출처로 표시하지 않는다. "급식·식단 원문" 링크로만 구분한다.
  - 홈페이지 답변(`HOMEPAGE`)은 주소 출처를 밝힌다. NEIS면 "홈페이지 주소 출처: NEIS 교육정보 개방 포털", 직원 보완이면 "홈페이지 주소: LOTBI 운영 등록"이다.
- 학교 저장값(`normalizeSchoolPreference`)은 그대로다. 링크는 저장하지 않고 공개 식별값만 둔다. `client_context.school`도 이전처럼 학교 관련 질문에만 싣는다.

## 화면

- `site-conversation.css`의 학교 카드 pill 규칙(최소 높이 44px, 포커스 outline)에 `.lotbi-school-link`를 합쳤다.
- 버튼 묶음 `.lotbi-school-links`는 줄바꿈되는 flex다.

## 검증

- `scripts/validate_neis_school_official_links_01.mjs`를 `site-review.yml`에 등록했다.
  - 로직 검증 7개: 링크 보존과 위험 링크 제거, 버튼 개수와 속성, 링크 없을 때 빈 자리 없음, 일정 카드, 홈페이지 출처 문구, 후보 목록, 저장값
  - 실제 Chrome 검증: `index.html` 대화 화면에 학교 결과를 주입한다. 360/375/390/412px 모바일과 1280px 데스크톱에서 다음을 확인한다.
    - 가로 넘침 없음
    - 버튼 높이 44px 이상이고 카드 안에 들어감
    - `target`/`rel`
    - 링크 없는 카드에 버튼 0개
- asset token은 최종 tree 기준으로 다시 생성했다(`scripts/asset_cache_version.mjs --write`, `--check` PASS).

## 배포

- Core(`feature/neis-school-official-links-01-core`) 다음에 Site를 배포한다.
- Core가 아직 옛 버전이어도 `links`가 없으므로 버튼만 나오지 않고, 다른 동작은 그대로다.
