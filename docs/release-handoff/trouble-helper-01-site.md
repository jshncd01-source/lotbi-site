READY_FOR_DEPLOY=YES
SUPERSEDES=07ceeeabc300fcbbe57ea9965538cf705ab98b6a
GATE_RETURN_FIX=SITE-T55 validate_social_signup_profile_ux_01 실패 → 부팅 즉시 import를 첫 사용 시 로드로 변경(아래 'SITE-T55 반환 수정')
MIGRATION=NO
DEPLOY_ORDER=CORE → SITE → APP (Core feature/trouble-helper-01-core 78ecd8e8가 먼저. Core가 없으면 이 화면은 "안내를 불러오지 못했어요" + 112·119·132 전화로 끝나고 다른 화면에는 영향 없음)
USER_DECISION_NEEDED=NONE

# TROUBLE-HELPER-01 — 분쟁·사고 도우미 ("막막할 때 롯비") Site

REPO=lotbi-site
FEATURE_BRANCH=feature/trouble-helper-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD). `git ls-remote`로 확인한다.
CODE_SHA=29636838c (SITE-T55 반환 수정 + asset 토큰. 그 앞 15780404f 기능·검사기 → b1c78b2bb asset 토큰 → 667f26121 검사기 보강 → 52c8b4981 fixture 문구)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=afb7057d1d8c149e2b46eb1d656b1049e36b831d (착수 = push 직전 ls-remote 값, merge 필요 없음)
ASSET_VERSION=aset-aa70e560957f (`node scripts/asset_cache_version.mjs --check` PASS, targets=162 refs=197)
PAIRED=lotbi-core feature/trouble-helper-01-core 78ecd8e8 · lotbi-app feature/trouble-helper-01-app

## SITE-T55 반환 수정 (2026-10-11 새벽)

- 반환 원인(배포총괄방 실측): `site-conversation.js` 최상단 `void import('./site-trouble-helper.js?v=…')`가 부팅 때 모듈을 하나 더 불러와 시점이 당겨지면서, 로그인 상태의 `/v2/conversation-history/settings` 요청이 `validate_social_signup_profile_ux_01`의 검사 창 안으로 들어왔다.
- 수정: 부팅 때 불러오지 않는다. `data-trouble-open` 버튼을 처음 누를 때(문서 click 위임) 모듈을 불러와 새로 export한 `openTroubleHelper(trigger)`로 그 탭을 이어서 연다. 창을 연 채 새로고침한 경우(sessionStorage 표시)에만 부팅 때 불러온다. 실패해도 대화 모듈은 그대로.
- 검사기 `validate_trouble_helper_01`: "부팅 import 없음, 첫 사용 로드, export 존재"를 소스에서 확인하고, 브라우저에서 첫 화면 시점에 `site-trouble-helper.js`가 resource 목록에 없음을 단언(완화 아님 — 새 동작을 고정).
- 확인(CHROME_BIN 지정, Windows): `validate_trouble_helper_01` 43 checks PASS, `validate_social_signup_profile_ux_01` PASS(2회 연속), `validate_auth_continuity_02` PASS. 바뀐 84개 파일 중 실제 내용 변경은 3개(`site-conversation.js`, `site-trouble-helper.js`, 검사기), 나머지 81개는 asset 토큰 문자열만.

## 변경

- 메뉴: 진위확인 버튼이 있는 두 곳(데스크톱·모바일) 모두 진위확인 바로 다음에 **분쟁·사고 도우미**(`data-trouble-open`, 아이콘 `lotbi-icon-lifebuoy`).
- 창: 머리글 "LOTBI 분쟁·사고 도우미", 제목 **“막막할 때 롯비”**. **로그인 없이** 열린다. 휴대폰에서는 전체 화면.
- 데이터: Core `GET /v2/trouble-helper/guides`(credentials omit, 요청 헤더 없음). 화면 문구는 응답 그대로(실패 문구만 고정).
- 흐름: ① 상황 고르기(5개) → ② 질문 하나씩(`show_if`, "n/m" 진행 표시) → ③ 할 일 카드(급한 것 표시, "했어요", 처리기간, 전화) → ④ 모을 증거·참고 기준·공식 창구(전화 버튼이 온라인 버튼과 같거나 크게, 운영시간, "상담료 없음 · 통화료 별도 · 신청 수수료 없음" 한 줄, 한계, 확인일·근거 링크, "전화할 때 말할 내용", "인증이 안 돼요" → 전화·방문 먼저) → ⑤ 상황 정리표(진행 상태 5단계, `receipt_field_id` 칸에 접수번호를 적어야 '제출함', 지우면 '자료 정리'로 되돌아감).
- 자동차 사고: 과실비율정보포털에서 "고르는 순서"(예: 차 대 차 → 교차로) + 포털 열기, '대화로 찾기'에 붙여 넣을 문장 + 복사 + 열기. **과실비율 숫자·도표 없음**(검사기가 화면 전체에서 확인).
- 저장: 진행 상태·정리표는 localStorage(이 기기)에만. 창을 연 채 새로고침하면 다시 열린다(sessionStorage 표시). `/#trouble` 라우트는 만들지 않았다(라우트 표·다른 방 검사기 충돌을 피함).
- 보내기: 휴대폰에 저장 / 인쇄(큰 글씨 정리표만) / 카카오로 보내기(기존 `site-kakao-share.js`; 카카오 준비 안 됐으면 휴대폰 공유 창 → 복사). 보내는 글 앞부분에 "인증번호·비밀번호는 가족에게도 보내지 마세요", 참고용 문구, 진행 상태, 접수번호.
- 읽어주기: 기존 대화 답변 읽어주기 버튼(기기 음성)을 할 일 카드에 붙임.
- 어르신 기준: 창 안 본문 20px 이상, 제목 26px 이상, 주요 버튼 56px 이상, 터치 48px 이상, 375px 가로 스크롤 없음, 라이트·다크 대비 4.5 이상. 테마 토큰 파일은 바꾸지 않았다(기존 변수만).
- 파일: 새 `site-trouble-helper.js`, `site-trouble-helper-model.js`, `site-trouble-helper.css`, `scripts/validate_trouble_helper_01.mjs`, `scripts/fixtures/trouble_helper_guides_01.json`(Core 응답과 같은 바이트). 수정 `index.html`(CSS·아이콘·메뉴 2곳·dialog), `auth/callback/index.html`(CSS 링크), `site-conversation.js`(한 줄: `void import('./site-trouble-helper.js?v=…').catch(() => {})` — 실패해도 대화는 그대로).
- 메뉴 개수를 7로 고정하던 기존 검사기 3개를 8로 갱신(순서·개수 엄격 유지): `validate_consumer_design_shell_01.mjs`, `validate_sidebar_information_architecture_04.mjs`, `validate_home_chat.py`.
- 함께 고친 결함: 전역 `dt{color:var(--muted)}` 때문에 다크 모드 정리표 이름표 대비가 1이던 것을 정리표 쪽에서 덮어씀. 화면에 안 보이는 "(새 창에서 열려요)" 글 때문에 초점 이동 시 머리글이 밀리던 것을 막음.

## 검증 (Windows, headless Chrome, CHROME_BIN 슬래시 경로)

- 새 검사기 `validate_trouble_helper_01`: **43 checks PASS**(375·320·1280px, 라이트·다크). 마지막 실행은 HEAD 52c8b4981. gate 규칙(`fs.mkdtempSync` 프로필, `scripts/.validate-trouble-helper-01-` 작업 폴더, rmSync 20회 재시도, 브라우저 후보 `CHROME_BIN` → Windows Chrome → `/opt/pw-browsers/chromium` → PATH)은 gate 통과 검사기 `validate_my_child_school_01`과 같다.
- 기존 `scripts/validate_*` 전체 273개(새 것 포함), 3개 동시 실행: 267 pass / 6 fail.
  - 기존 실패 3개 — main afb7057d 비교용 작업본에서 같은 오류로 실패: `validate_mobile_footer_legal_sheet_01`(761px disclosure), `validate_site_avatar_fallback_runtime`, `validate_social_signup_profile_ux_01`(양쪽 모두 실행마다 다른 지점에서 실패하는 불안정 검사기).
  - 부하성 3개 — 단독 재실행 PASS: `validate_calendar_expense_summary_01`, `validate_onnuri_location_ux_p0`(EBUSY), `validate_site_refresh_route_restore_01`.
  - **NEW_FAILURES=0**.
- 커밋 전 `scripts/.*` 임시 폴더 없음 확인. 비교용 작업본은 지웠다.

## NOT VERIFIED

- 실제 휴대폰(iPhone Safari·삼성 인터넷·카카오 인앱), 실제 카카오 전송, 기기 음성 재생.
- Linux gate 실행, 실제 Core와 묶은 E2E(Core 배포 후 smoke로 확인).

## 배포 후 smoke

1. lotbiai.com 메뉴(데스크톱·모바일)에서 진위확인 다음에 "분쟁·사고 도우미"가 보인다.
2. 로그인 없이 눌러 “막막할 때 롯비” 창과 상황 5개가 보인다(Core 배포 뒤).
3. 자동차 사고 → 질문 → 할 일 화면에 과실비율 숫자가 없고 "포털에서 직접 고르기"가 accident.knia.or.kr로 열린다.

## 롤백

이전 Site 이미지로 되돌리면 된다(서버 저장 없음).
