READY_FOR_DEPLOY=YES

# chat-dark-login-kakao-share-01-site — release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/chat-dark-login-kakao-share-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote origin refs/heads/feature/chat-dark-login-kakao-share-01-site`)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=1eb38853adfdad294a6e9b27805ad78459712d6b (started from e13c0dfd; normal merges of e003b26a, 2dc7c88e, 7d624829, then main 1eb38853 — conflicts were asset tokens plus import lines, resolved as a union)
CODE_SHA=dc2e91d3
ASSET_VERSION=aset-7d3c08200792
PRIORITY=P0 (Samsung Internet 모바일 실사용 보고 2026-10-09)
PAIRED_CORE=feature/kakao-share-ready-01-core (독립 배포 가능 — 순서 무관. Core env를 켜기 전까지 카카오톡 항목은 지금처럼 숨김)

## INCLUDES (정상 merge, 되돌리지 않음)

- e003b26a 키보드·스크롤 P0 — SITE-T33으로 이미 main(1eb38853)·Production 반영. 이 branch는 그 main을 merge.
- 2dc7c88e 진위확인 로그인 안내 대비(헤더 로그인 대비 포함) — SITE-T34 대기 중. 헤더 로그인 같은 줄을 고치므로 포함.
- 7d624829 읽어주기 복원 — SITE-T34 대기 중. 답변 도구 `actions.append(...)` 같은 줄 때문에 포함.
- 배포방: T34(7d624829·768854e4/a90a246f·2dc7c88e) 뒤에 넣으면 이 branch는 T34 내용을 그대로 포함한다(SUPERSEDES 아님 — 768854e4 Life Wallet 카드 덱은 미포함).

## ROOT_CAUSE_CHAT_INPUT

다크·시스템다크에서 입력칸(textarea)에 포커스가 가면(탭·입력 중 항상 :focus-visible) 전역 포커스 규칙 `body[data-site-theme="dark"|"system"] :where(... textarea ...):focus-visible { outline: 3px solid var(--lotbi-focus-ring) !important; outline-offset: 2px }`이 `.chat-input:focus-visible { outline: 0 }`을 `!important`로 이겨, 둥근(30px) 입력창 안에 #ededed 3px·모서리 4px 사각형이 그려졌다. 라이트는 !important가 없어 outline 0이 이김 → 라이트 정상. 입력칸 배경은 transparent(브라우저 기본 흰 배경 아님, 실측).

## ROOT_CAUSE_HEADER_BUTTONS

Production(main)의 다크·시스템다크 헤더 `로그인` = 고정 배경 rgba(255,255,255,.72) + 테마 흰 글자 → 1.69:1(흐릿·비활성처럼 보임). 2dc7c88e가 배경을 테마 토큰으로 바꿨으나 미배포. 그 위에도 다크에서 로그인 테두리가 라이트 전용 #dde3ee(밝은 링), 배경 #212121이 남색 헤더(#151922)와 달라 어색. 높이·모서리·글자 크기·간격은 원래 같음(36.4px·999px·12px/800·간격 6px), 320~690에서 겹침·잘림 0.

## ROOT_CAUSE_KAKAO_SHARE

Site에는 공식 Kakao JavaScript SDK 공유(Kakao.Share.sendDefault)가 이미 있다. 단 Core `/app/config.json`이 `navigation.kakao_share_ready=true` + 공개 JS 키 + 허용 SDK 주소를 줄 때만 메뉴에 나오고(없으면 숨김, 5faa6f7a), Core에는 `kakao_share_ready` 항목 자체가 없다 → Production에서는 항상 '링크 복사'만. Production 실측: kakao_navi_ready=false, kakao_javascript_key=null. 추가로: SDK 로드에 실패해도 항목이 보였고(누르면 오류), 클릭 후에야 SDK를 받아 PC 팝업·모바일 앱 전환이 사용자 탭 밖에서 실행될 위험, 완료처럼 들리는 '공유 화면을 열었습니다', 무엇이 공유되는지 안내 없음.

## 수정

- `site-theme-tokens.css`(다크·시스템다크만): `.chat-composer .chat-input:focus-visible { outline: none !important }`, 포커스 표시는 둥근 입력창 `.chat-composer-stack .chat-composer:focus-within { border-color: var(--lotbi-focus-ring); box-shadow: none }`. 헤더 `.account-login { border-color: var(--lotbi-border-strong) }`.
- `home-chat.css`: `.account-login` 배경 transparent(헤더 위 별도 회색 알약 없음). 라이트 모양은 그대로(흰 헤더 위 동일).
- `site-kakao-share.js`: `prepareKakaoShare()` — 설정 확인 + SDK 로드 + init까지 끝나야 true. 공유 텍스트 200자 초과 시 199자+'…'.
- `site-conversation.js`: 메뉴를 열 때 SDK 준비, 준비되면 '카카오톡 공유하기'를 첫 줄(prepend), 아래 안내 '이 답변 내용과 LOTBI 주소만 보내요'(aria-describedby), 탭 후 안내 '카카오톡에서 보낼 친구나 채팅방을 선택해 주세요.'(완료라고 말하지 않음), 실패 시 '카카오톡 공유를 열지 못했어요. 링크 복사를 이용해 주세요.'. 링크 복사·OS 공유창 미사용 계약 유지.
- `site-conversation.css`: `.lotbi-share-menu-hint`(12px, 단어 단위 줄바꿈).
- 신규 `scripts/validate_chat_dark_login_kakao_share_01.mjs` + `site-review.yml` 등록.
- CHANGED_TEST_EXPECTATIONS: `validate_message_share_actions_01`(메뉴 순서 카카오톡→링크 복사, 새 안내 문구, prepend, prepare), `validate_kakao_share_fallback_01`(prepare 단정 추가·prepend), `validate_message_calendar_footer_editor_01`(configured 메뉴 순서·안내 문구). 삭제한 단정 없음.

## SHARE_PRIVACY

공유 내용 = 선택한 답변 1개의 텍스트(최대 200자) + 공개 주소 https://lotbiai.com/ + 버튼 'LOTBI 열기'. 대화 전체·질문·대화 URL·게스트 토큰·로그인 세션·계정 정보·내부 API 주소 미포함(브라우저 검사에서 payload 직접 확인). 공개 공유 링크(대화 URL) 생성 없음 → 별도 동의·접근제어 대상 없음. config 요청은 credentials omit, SDK는 referrerPolicy no-referrer.

## TEST_STATUS

- 신규 `validate_chat_dark_login_kakao_share_01.mjs`(실제 Chrome 헤드리스, CDP):
  - 입력창 28개 렌더(320·344 Fold 접힘·360·390·412·690 Fold 펼침·1280 × 라이트·다크·시스템 라이트·시스템 다크, 시스템 전환 포함): 입력창 안 별도 칠(outline·테두리·배경·그림자) 0건, 다크 포커스 = 둥근 테두리 #ededed(배경 대비 ≥3:1), 글자·placeholder 4.5:1 이상, + 버튼과 글자 영역 겹침 0, Shift+Enter 줄바꿈·자동 높이, Enter 전송 후 대화 화면에서도 동일.
  - 헤더 24개(모바일 6폭 × 4테마): 로그인·회원가입 글자 4.5:1 이상(다크 14.77·라이트 16.1), 흐림(opacity·filter) 없음, 높이·모서리·글자 크기·굵기·여백 동일, 겹침·잘림·가로 넘침 0, 키보드 포커스 링 ≥2px·3:1. 이동 5개: 로그인 → account.lotbiai.com/auth/site-handoff(…), 회원가입 → account.lotbiai.com/signup(기존과 동일).
  - 공유 8개(360 다크·412 시스템다크·390 라이트·344 Fold·1280 다크 configured, Share 미설정, SDK 404, sendDefault 실패): 메뉴 순서 카카오톡→링크 복사, 안내 문구·aria-describedby, 메뉴 열 때 Kakao.init 1회·공유 0회, 탭 시 sendDefault 1회 + 사용자 탭 활성 상태(userActivation true), payload = 답변 앞 199자+'…'·https://lotbiai.com/·'LOTBI 열기', 게스트 토큰·Bearer·로컬 주소·api 주소·질문 문구 미포함, 클립보드 0, 완료 문구 없음, 실패 시 오류 안내, 링크 복사 = https://lotbiai.com/ 1회, SDK 1회 로드. 미설정·SDK 404 = 링크 복사만, SDK 요청 0(미설정).
  - 수정 전 같은 브라우저 검사: Production main e13c0dfd 191건 실패(다크 입력창 안 흰 outline 36개 상태, 다크 로그인 1.69:1 12건 등), 기존 READY 3건 병합본 cd7d2342 190건 실패(흰 사각형 41개 상태 그대로) → 수정 후 0건.
- 공유 계약: `validate_kakao_share_fallback_01` PASS, `validate_message_share_actions_01` PASS, `validate_message_calendar_footer_editor_01` PASS.
- 전체 `scripts/validate_*` 232개(Windows 로컬): 230 PASS. FAIL 2 = `validate_mobile_footer_legal_sheet_01`('761px leaked'), `validate_site_avatar_fallback_runtime` — 수정 전 병합본 cd7d2342에서도 동일 실패(기존 Windows RED). 병렬 부하로 '동적 모듈 로드 실패'가 난 캘린더 3개는 직렬 단독 실행 PASS(양쪽). NEW_FAILURES=0.
- `asset_cache_version.mjs --check` PASS(aset-7d3c08200792). main 1eb38853 merge 전후 파일 내용 동일(토큰 포함).

## NOT VERIFIED

- 실기기 Samsung Internet·Android Chrome·iPhone Safari·Fold: 전부 NOT VERIFIED(Chrome 헤드리스 viewport 에뮬레이션만).
- 실제 카카오톡 친구·채팅방 선택 흐름: NOT VERIFIED — Production Core가 Share 설정을 아직 안 줌 + Kakao Developers 도메인 등록 상태 확인 불가. 검사는 허용 SDK 주소에 대체 SDK를 넣어 init·sendDefault 호출·payload·사용자 탭 활성 상태까지만 확인.
- 공유 후 LOTBI로 돌아오기: 페이지를 떠나지 않는 구조(SDK가 앱/팝업 전환)이나 실기기 NOT VERIFIED.

CODE_SHA=dc2e91d3
USER_DECISION_NEEDED=카카오톡 실제 공유를 켜려면 (1) Core feature/kakao-share-ready-01-core 배포, (2) Render lotbi-core-prod에 KAKAO_SHARE_ENABLED=true(+ KAKAO_JAVASCRIPT_KEY 설정 여부 확인), (3) Kakao Developers에서 그 JavaScript 키의 Web(JavaScript SDK) 도메인에 https://lotbiai.com 등록 확인 — 셋 다 사용자 승인/작업. Site 배포 자체는 승인 불필요(카카오톡 항목은 설정 전까지 숨김). 헤더 로그인 디자인(투명 배경+회색 테두리) 유지 여부는 실기기 확인 후 판단.
