READY_FOR_DEPLOY=YES
SUPERSEDES=271cb2dcb17c38a21defaacc6de85d4c3928279b (이전 READY, main 9e39edd0 기준)
MIGRATION=NO (Site). 짝 Core가 p0_0109_my_child_institutions(29자, down_revision p0_0107_calendar_recurring)를 가진다.
DEPLOY_ORDER=CORE → ADMIN → SITE
USER_DECISION_NEEDED=개인정보처리방침 개정 시점(초안: lotbi-core docs/MY-CHILD-SCHOOL-01-PRIVACY-DRAFT.md) — 배포 차단 아님. privacy.html은 이번에 바꾸지 않았다.

# MY-CHILD-SCHOOL-01 — 생활정보 "내 아이 학교·유치원" (Site, main da861120 재병합)

REPO=lotbi-site
FEATURE_BRANCH=feature/my-child-school-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD). `git ls-remote origin refs/heads/feature/my-child-school-01-site`로 확인한다.
CODE_SHA=43580a7fb24264a2d2787e22630bf3bd8ddad86a
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=da86112052b090186ceb35f5c7a53be0e63431ec (SITE-T42, 운영 aset-288dae9f4243)
MERGE_METHOD=NORMAL MERGE 1회(da861120 → 693eab18). rebase·force push·reset 없음
ASSET_VERSION=aset-70f733afa919 (scripts/asset_cache_version.mjs --check PASS)
TAKEOVER=원래 개발방이 옛 계정이라 배포총괄방 요청(2026-10-09 23:33)으로 생활정보 직전송 Site 방이 이어받았다. 원래 worktree `my-child-school-01-site`를 썼고, 다른 작성자 없음(프로세스 0, 마지막 수정 15:00)을 확인했다.

## 이번 재병합에서 바뀐 것 (271cb2dc 대비)

main 9e39edd0 → da861120 사이에 생활정보가 크게 바뀌었다.
- 카드: 응급실·지역뉴스가 추가돼 8개.
- 생활정보 질문은 전부 `onAsk`로 한 번 탭에 바로 전송(의료 자동검색, 유치원·학교, 지역생활정보). 입력창 초안(`onDraft`·`draft` 도우미)은 main에서 없어졌다.
- 화면 뒤로 버튼 문구는 "지역정보로 돌아가기".

그래서 이 branch는 다음과 같이 맞췄다.
1. `site-consumer-sections.js`·`site-conversation.js`는 main 파일을 그대로 쓰고, 내 아이 부분만 다시 넣었다.
   - 카드 `my-child`("내 아이 학교·유치원", 가방 아이콘)를 **9번째(마지막)**에 둔다. 기존 8개와 순서는 그대로다.
   - 9개는 홀수라 마지막 카드가 한 줄 전체를 쓴다(main의 `site-life-education.css` `:last-child:nth-child(odd)` 규칙). 빈 칸이 없다.
   - `openMyChild`(main `openEducation`과 같은 모양), `mountMyChild` 연결, dispose.
2. "대화로 더 물어보기"(유치원 상세)는 옛 `onDraft`(입력창 초안 + focus) 대신 생활정보 카드와 같은 `onAsk`로 보낸다.
   - 경로: `mountMyChild(host, {onAsk})` → `site-conversation.js`의 `mountMyChild: async (root, {onAsk: askFromMyChild} = {})` → `site-life-my-child.js` `onAsk`.
   - 결과: 생활정보 창이 닫히고, 질문이 바로 가고, 키보드를 띄우지 않는다.
3. `index.html`·`auth/callback/index.html`: main의 스타일시트 목록 + `site-life-my-child.css` 한 줄(site-life-education.css 다음).
4. 그 밖의 충돌은 asset token과 import 줄(main 쪽이 상위집합)뿐이라 main 쪽을 썼다.

## main 대비 코드 변경 (token 줄 제외)

- 새 파일(271cb2dc와 같음): `site-life-my-child.js`(onDraft→onAsk 2줄만 다름), `site-my-child-client.js`, `site-life-my-child.css`, `scripts/fixtures/my_child_school_01.json`, `scripts/validate_my_child_school_01.mjs`.
- `site-consumer-sections.js`: 카드 1개, 아이콘 1개, `mountMyChild` 인자, `openMyChild`, 클릭 분기, dispose.
- `site-conversation.js`: `mountMyChild` 연결 1곳(6줄).
- `index.html`·`auth/callback/index.html`: CSS 링크 1줄씩.

## main 기능 보존 근거

- 생활정보 8개 카드, 의료 자동검색, 지역뉴스, 유치원·학교 1탭, 온누리, 사진 없는 장소카드, 키보드 닫기 P0 코드는 main과 같다.
- main 검사기 단정은 약화하지 않았다. 카드 목록·개수만 9개로 넓혔다(아래).
- `onDraft`·`draft(text)`가 사이트 코드에 0곳이다(강화된 `validate_consumer_sections_02` 등 PASS).

## 바뀐 검사기 (같은 엄격도)

- 카드 목록·개수 8 → 9(`my-child` 추가): `validate_consumer_sections_02`, `validate_life_medical_category_entry_01`, `validate_life_medical_auto_search_card_01`, `validate_life_info_cleanup_final_01`.
  - category_entry의 "빈 칸 없음·모든 줄 꽉 참·같은 너비" 일반식은 그대로다(홀수 마지막 카드는 한 줄 전체).
- `validate_regional_news_p0_01` 6번(데스크톱): "8개라 마지막 줄 두 장" → "9개, 마지막 `my-child`가 한 줄 전체(첫 카드 왼쪽~가장 오른쪽), 그 앞 줄은 열 너비 카드 두 장".
- `validate_my_child_school_01`
  - 카드 목록 9개, 뒤로 버튼 "지역정보로 돌아가기"(main 화면들과 같은 문구).
  - 대화 연결 정규식을 새 시그니처로 바꿨다.
  - 추가 단정: sections가 `mountMyChild(host, {onAsk})`로 넘김, 화면의 "대화로 더 물어보기"가 `onAsk?.(`를 부름, 세 파일에 `onDraft`·`draft(text)` 없음.
- `.github/workflows/site-review.yml`: 설명 "일곱째" → "아홉째(마지막)".

## TEST_STATUS

검사 환경:
- Windows 로컬, Chrome headless(DevTools protocol), 가짜 Core(Core 생성 fixture).
- 모바일은 viewport·터치 에뮬레이션이다. 실기기는 NOT TESTED.
- 작업본 CRLF와 무관하게 커밋 내용 그대로(LF, `git -c core.autocrlf=false archive 43580a7f`)를 풀어서 검사했다.
- 다른 방과 겹치지 않게 한 번에 하나씩 돌렸다.

- 모듈 구문 검사(`site-conversation.js`, `site-consumer-sections.js`, `site-life-my-child.js`): PASS.
- `node scripts/asset_cache_version.mjs --check`: PASS(aset-70f733afa919, targets 138, refs 166).
- 관련 검사기 21개: 21 PASS.
  - my_child_school_01(41 checks: 320·360·412·1280, 라이트·다크, 비로그인, 검색·저장·변경·삭제·모두 삭제, Bearer·credentials omit, 본문 필드 제한)
  - consumer_sections_02, consumer_detail_system_01, consumer_design_shell_01
  - life_medical_category_entry_01(9개 카드, 빈 칸 없음·모든 줄 꽉 참), life_medical_auto_search_card_01, life_info_cleanup_final_01, life_direct_chat_card_compaction_01
  - regional_news_p0_01(데스크톱 9개 배치 포함), kindergarten_official_info_01, onnuri_merchant_search_01
  - life_neis_school_01, neis_school_official_links_01, school_meal_neis_admin_fallback_01
  - auth_continuity_02(index.html·auth/callback CSS 목록 같음), home_fresh_entry_01, festival_nav_wiring_01
  - site_refresh_route_restore_01, chat_mobile_keyboard_dismiss_01
  - validate_hardening.py, validate_home_chat.py: 처음에는 마지막 PASS 문장 출력에서 Windows cp949 인코딩 오류(단정 통과 뒤)가 났다. `PYTHONIOENCODING=utf-8`로 다시 돌려 PASS.
- "대화로 더 물어보기" 버튼을 브라우저에서 직접 누르는 단계는 없다.
  - 누르면 생활정보 창이 닫혀 이후 삭제 시나리오가 깨지기 때문이다.
  - 대신 `onAsk` 연결을 소스 단정으로 고정했다.
  - 같은 `onAsk` 처리기의 실제 동작(1회 전송, focus 0, 키보드 없음)은 life_direct_chat_card_compaction_01·life_medical_auto_search_card_01이 브라우저로 확인한다.
- 전체 site-review 회귀: NOT RUN(이 PC CPU 제약). 최종 전체 gate는 배포총괄방(Linux).

NEW_FAILURES=0 (관련 검사기 21개 기준)

DEVICE_E2E=NOT VERIFIED (iPhone Safari·삼성 인터넷·카카오 인앱 실기기 미확인. 모든 화면 결과는 Chrome viewport 에뮬레이션)
CORE_E2E=NOT VERIFIED (짝 Core p0_0109 운영 미배포 — 2026-10-09 23:3x 기준 CORE-T30 gate 중. 검사기는 Core가 실제 NEIS·유치원알리미 표본으로 만든 응답 fixture를 쓴다)
ENV_CHANGE_REQUIRED=NO
NEW_SECRET_CREATED=NO
THEME_TOKENS_CHANGED=NO (site-theme-tokens.css 무변경 → Web theme-tokens sync 짝 불필요)
DEPENDENCIES=Core feature/my-child-school-01-core(p0_0109) 먼저, 그다음 Admin 018a5774. Core 없이 Site만 배포되면 새 카드는 열리지만 목록 조회가 실패해 "다시 불러오기" 안내만 보인다(다른 생활정보 카드는 그대로).
PAIRED=Core feature/my-child-school-01-core, Admin feature/my-child-school-01-admin

## 기능 요약 (271cb2dc와 같음)

- 비로그인: "로그인하고 아이 학교·유치원을 저장하세요" + 로그인(/auth/start/). Core를 부르지 않는다.
- 추가: 학교 NEIS 검색 → 선택 / 유치원 유치원알리미 시·도·시·군·구 → 이름 검색 → 선택. 부르는 이름(첫째·둘째 …, 20자), 알레르기 번호 1~19, 첫 저장 동의(Core 문구 그대로).
- 학교 상세: 오늘·이번 주 급식, 고른 알레르기 메뉴 강조("급식표 알레르기 표기 기준", 의료 판단 문구 없음), 학교 홈페이지·급식표 링크, 학사일정, 출처·갱신 시각, NEIS에 없는 항목 "정보 보완 요청".
- 유치원 상세: 유치원알리미 기본정보 + 출처·갱신 시각 + "대화로 더 물어보기"(이번에 1탭 전송).
- 이름·알레르기 바꾸기, 삭제(두 번 눌러야 함), 모두 삭제(뒤에 동의 다시 받음).
- 저장소에 남기는 것 없음: localStorage·sessionStorage 미사용, 아이 이름·생년월일·사진·학년·반 입력란 없음.

## 롤백

- Site 이전 이미지로 되돌리면 된다. Core 데이터는 남아도 무해하다(다른 화면은 읽지 않음).
