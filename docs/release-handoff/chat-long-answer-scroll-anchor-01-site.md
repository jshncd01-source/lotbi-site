READY_FOR_DEPLOY=YES

# chat-long-answer-scroll-anchor-01-site — release handoff

TASK=LOTBI CHAT — LONG ANSWER SCROLL ANCHOR UX FIX P0 + SITE MOBILE COMPOSER KEYBOARD LAYOUT HOTFIX
REPO=lotbi-site
FEATURE_BRANCH=feature/chat-long-answer-scroll-anchor-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD; `git ls-remote origin refs/heads/feature/chat-long-answer-scroll-anchor-01-site`로 확인)
SUPERSEDES=f296c4ce880e2db23c389ea41ac3a32f8c3d8e0e (이전 READY. 이 문서가 대체한다. f296c4ce를 배포하지 말 것)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=843a667bc25dbf7d03e9eebdf1cf238990febeee (SITE-T15, f04869ce에서 정상 merge. 그 전 a87aafb9·0a03ca12·8a9e414d 순으로 merge)
CODE_SHA=f04869ce
ASSET_VERSION=aset-109aa70cbf4b
MERGED_TO_MAIN=NO
DEPLOYED=NO
CORE_CHANGE=NONE
APP_CHANGE=별도 branch feature/chat-long-answer-scroll-anchor-01-app (lotbi-app, long-answer 부분만). 이번 hotfix는 Site만. 배포 순서 제약 없음.
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO

커밋(f296c4ce 이후): 0dbd7e86 hotfix 본체 → 892d9633 safe-area 1회 → f04869ce main 843a667b merge → 이 문서.

---

## A. 이번 HOTFIX — 모바일 입력창 키보드 위치 / + 버튼 겹침

### 실사용 증거 (Samsung 계열 모바일 브라우저)
1. 키보드를 열고 입력하면 입력창이 키보드 바로 위가 아니라 헤더 바로 아래로 올라가고, 입력창과 키보드 사이에 큰 빈 공간이 생김.
2. 입력한 첫 글자들이 + 버튼 뒤에 가려짐.

### 원인 (fresh 코드 실측, 둘 다 재현)
1. **입력창 점프 — 빈 Home(대화 시작 전)에서 키보드가 열릴 때.** `home-shell.js`는 이미 앱 영역을 visual viewport 크기·위치로 고정한다(`--lotbi-visible-viewport-height/offset-top`). 그런데 `site-consumer-layout.css`의 Home 규칙 `body.chat-home-page:not(.conversation-active) .chat-hero { min-height: calc(100svh - 120px); flex: 1 0 auto; justify-content: center; padding-bottom: 64px }`(특이도 0,3,1)가 키보드 규칙 `body.mobile-keyboard-open .chat-hero`(0,2,1)를 이겨, 입력창이 남은 화면의 세로 가운데(=헤더 바로 아래)에 남았다.
   기준선 f296c4ce 실측(입력창 아래 ~ 키보드 위 빈 공간 / 입력창 top):
   | viewport | Android식(레이아웃 축소) | iOS식(visualViewport) |
   |---|---|---|
   | 360x780 | 187px / 160px | 48px / 299px |
   | 375x667 | 155px / 127px | 40px / 242px |
   | 390x844 | 206px / 179px | 54px / 331px |
   | 412x915 | 227px / 199px | 60px / 366px |
   | 690x829 (폴드) | 223px / 187px | 74px / 336px |
   | 750x832 (폴드) | 224px / 188px | 74px / 338px |
   대화 중 화면은 기준선에서도 키보드 바로 위(16px)였다.
2. **+ 버튼 겹침 — + 가 텍스트 위 overlay였다.** `.attachment-control`이 `position:absolute; left:7px`(44px 폭)로 composer의 52px 왼쪽 padding 안에 얹혀 있었다. `home-bare-white.css`(≤760px)가 빈 Home composer padding-left를 13px로 덮어써서, 601~760px(폴드 펼친 화면) 빈 Home에서 + 가 글자 시작 38px를 덮었다(690px: + 24~68px, 글자 시작 30px / 750px: + 43~87px, 글자 49px). 대화 화면·데스크톱도 + 오른쪽 끝과 글자 사이가 1px뿐이었다. 폰(≤600px)은 +가 입력 줄 아래 줄이라 겹침이 없었다.

### 무엇을 바꿨나 (CSS만, JS 변경 없음)
- `site-consumer-layout.css`
  - composer를 grid 칸 배치로: `[+][입력][등급][전송]`. `.composer-actions { display: contents }`로 버튼들이 composer의 grid item이 되고, + 는 absolute가 아니라 첫 칸을 실제로 차지한다. 간격은 margin(column-gap 아님) — 숨은 등급 버튼이 빈 간격을 만들지 않는다. 등급이 보일 때 등급↔전송 2px 그대로.
  - 폰(≤600px)은 기존 설계(SITE-COMPOSER-HORIZONTAL-FIT-01) 유지: 입력은 첫 줄 전체 폭, +·등급·전송은 그 아래 줄.
  - 빈 Home + 키보드 열림: `body.chat-home-page.mobile-keyboard-open:not(.conversation-active)`(0,4,1) — hero `justify-content:flex-end; min-height:0; padding-bottom:0`, 입력창 영역을 hero 마지막(예시 버튼·안내문 아래)으로, shell 아래 padding 0, 입력창 영역 padding-bottom `max(16px, env(safe-area-inset-bottom))`.
- `site-conversation.css`: 대화 + 키보드 열림에서 shell 아래 padding 6px 사이로 대화 글자가 입력창 밑에 비치던 것(기준선에도 있음) → shell padding 0, 입력창 영역 padding-bottom `max(16px, env(safe-area-inset-bottom))`(불투명 배경).
- 금지 항목 확인: Samsung 전용 분기·UA 검사 없음, 키보드 높이 px 하드코딩 없음, timeout 보정 없음(`home-shell.js` 무변경, setTimeout 0), top 좌표 강제 없음. long-answer anchor 코드 무변경.

### VISUAL VIEWPORT / SAFE AREA 동작
- 키보드 열림 판정·위치는 기존 `home-shell.js` 그대로: 입력창 포커스 + 보이는 높이가 기준보다 충분히 줄면 `mobile-keyboard-open`, 앱 영역을 `top = visualViewport.offsetTop`, `height = visualViewport.height`로 고정. 주소창 접힘/펼침만으로는 키보드 상태가 되지 않는다(입력창 포커스 조건).
- 입력창과 키보드 사이 = `max(16px, safe-area-inset-bottom)` 한 번(빈 Home·대화 동일). safe-area 34px 에뮬레이션에서 34px(두 번 더해지지 않음). 참고: index.html에 `viewport-fit=cover`가 없어 실제 브라우저는 현재 safe-area 0을 준다.

### Geometry (CODE_SHA 기준, Chrome 154 headless 에뮬레이션, 단위 px)
입력창 아래 간격 = 보이는 viewport 하단(키보드 윗변) − 입력창 하단. 글자 rect는 textarea와 같은 글꼴·박스의 거울 요소로 잰 실제 glyph/caret 위치.
| viewport | 키보드 열림 입력창 아래 간격 (빈 Home / 대화) | PLUS_RIGHT | TEXT_LEFT | SEND_LEFT | TEXT_RIGHT(1줄) | + 와 글자 관계 |
|---|---|---|---|---|---|---|
| 360x780 | 16 / 16 | 73 | 31 | 287 | 187 | + 는 글자 아래 줄(세로 14px 떨어짐), 겹침 0 |
| 375x667 | 16 / 16 | 73 | 31 | 302 | 187 | 아래 줄 14px, 겹침 0 |
| 390x844 | 16 / 16 | 73 | 31 | 317 | 187 | 아래 줄 14px, 겹침 0 |
| 412x915 | 16 / 16 | 73 | 31 | 339 | 187 | 아래 줄 14px, 겹침 0 |
| 690x829 폴드 | 16 / 16 | 72 | 80 | 615 | 236 | 같은 줄, TEXT_LEFT = PLUS_RIGHT + 8 |
| 750x832 폴드 | 16 / 16 | 87 | 95 | 660 | 251 | 같은 줄, +8 |
| 1280x900 | (키보드 없음) | 454.5 | 462.5 | 1027.5 | 673.5 | 같은 줄, +8 (기준선 +1) |
(대화 화면 값. 빈 Home 폴드: PLUS_RIGHT 74/93, TEXT_LEFT 82/101 — 역시 +8.) 세 키보드 모델(아래)에서 값 동일.

### 새 validator `scripts/validate_mobile_composer_keyboard_layout_01.mjs` (CI `site-review.yml`에 추가) — PASS
- viewport: 360x780, 375x667, 390x844, 412x915, 690x829·750x832(폴드), 1280x900.
- 키보드 모델 3종(실기기 아님): layout = 레이아웃 viewport 자체 축소(Android resizes-content / Samsung Internet식), visual = visualViewport만 축소(iOS Safari식), pan = visualViewport 축소 + offsetTop 이동(Chrome resizes-visual식).
- 검사: 빈 Home·대화 각각 키보드 열림에서 입력창 아래 간격 0~24px, 헤더 아래, 입력창~키보드 사이에 대화 내용 비침 0 / placeholder·1줄·여러 줄 입력·caret이 + 와 send에 겹침 0, 같은 줄이면 TEXT_LEFT ≥ PLUS_RIGHT+8·TEXT_RIGHT ≤ SEND_LEFT−8, 아래 줄이면 4px 이상 떨어짐 / 키보드 닫힘 후 원위치 / 붙잡은 질문 맨 위 유지(열림·여러 줄 입력·닫힘) / 입력창 탭이 최신 답변으로 끌어내리지 않음 / 답변 중간 읽던 줄 열림·닫힘 이동 0px / ↓ 최신 답변 표시·이동 / 가로 스크롤 없음 / 데스크톱 composer 680x70·+ 왼쪽 8px·send 오른쪽 11px·위 9px 유지 / safe-area 34px 1회.
- 같은 validator를 기준선 f296c4ce에 돌리면 91건 실패(빈 Home 키보드 위치 36건 전 viewport·모델, 폴드 + 겹침 24건, 폴드·데스크톱 간격 부족 29건, 데스크톱 + 줄 어긋남 2건).

### 데스크톱 변화 (회귀 아님, 확인용)
composer 크기·위치(680x70)·send 위치 동일. 글자 시작이 7px 오른쪽(+ 와 간격 1→8px). + 가 7px 올라가 send와 같은 줄 높이로 정렬(기준선은 + 만 7px 아래).

## B. 기존 long-answer 계약 (f296c4ce 내용, 유지)
- 질문 전송 = reading anchor(상단 바 아래 12px), 짧은 답변이면 `.conversation-turn-space`로 자리 확보.
- streaming·카드·이미지 성장 중 맨 아래 강제 이동 없음, completion 시 bottom jump 없음.
- 독자가 위로 스크롤하면 즉시 따라가기 해제, 끝까지 직접 내리면 따라감.
- `↓ 최신 답변`: 아래에 120px 넘게 있을 때 표시, 누를 때만 이동.
- 입력창 탭만으로 최신 답변으로 끌어내리지 않음(이전 P0(E) 계약 변경 — f296c4ce 문서 "동작 변경"과 같음).
- 키보드 열림/닫힘: 붙잡은 질문 맨 위 유지, 답변 중간 읽던 줄 유지. 페이지 자체 scrollIntoView는 고정 해제.
- validator `scripts/validate_chat_long_answer_scroll_anchor_01.mjs` PASS(CODE_SHA). 이번 hotfix 검증에서 Android식·panned 키보드까지 같은 계약을 추가로 확인.

## 테스트 (Windows 11, Chrome 154 headless, Node 24, `CHROME_BIN=C:/Program Files/Google/Chrome/Application/chrome.exe`)
### 전체 회귀 — CODE_SHA f04869ce, `scripts/validate_*` 209개 전부 + asset_cache_version --check + sync_footer_business_info --check + emit_social_signup_legal_manifest
**212개: 207 PASS / 5 FAIL — 새 실패 0.**
| FAIL | 판정 |
|---|---|
| validate_calendar_quiet_location_01 | 3개 동시 실행 부하 중 실패. 단독 재실행 PASS(CODE_SHA·main 843a667b 둘 다) |
| validate_calendar_system_dark_01 | main 843a667b에서도 같은 `system-dark mirror is stale`. 커밋 내용(LF)으로 꺼낸 사본에서 PASS — Windows CRLF 작업본 문제 |
| validate_image_attachment_thumbnail_01 | main 843a667b에서도 같은 실패. LF 사본에서 PASS — CRLF 작업본 문제 |
| validate_mobile_footer_legal_sheet_01 | main 843a667b에서도 같은 `761px: mobile disclosure leaked into desktop` (Windows, 이전 READY에도 기록) |
| validate_site_avatar_fallback_runtime | main 843a667b에서도 같은 assert(Node 24 undici, 이전 READY에도 기록) |
새 validator는 LF 사본에서도 PASS.

## 병렬 branch 호환 — `feature/chat-mobile-keyboard-dismiss-reading-view-01-site` e26e2896
- CODE_SHA f04869ce에 e26e2896을 임시 worktree에서 시험 merge(push 안 함). 충돌 59개 파일: asset token 줄 + 토큰 아닌 import 줄 5곳. 5곳 모두 e26e2896 쪽은 토큰만 바뀐 줄이라(그 branch의 base 0a03ca12 대비) 이 branch(=main) 쪽 내용을 택함: `auth-callback.js`·`site-auth.js`·`site-conversation.js` import(site-route.js 추가분), `index.html` route-pending 스크립트, `site-life-wallet-scan-ui.js` import(main의 framesPrintedItem·PDF import). 그 뒤 `node scripts/asset_cache_version.mjs --write`.
- 검증: 합친 결과 − f04869ce = e26e2896 − 0a03ca12 (토큰 정규화 후 877줄 동일).
- 합친 결과에서 PASS 21/21: `validate_chat_mobile_keyboard_dismiss_01`(전송 후 키보드 닫힘·답변 후 재포커스 없음·재탭 시 열림), `validate_chat_long_answer_scroll_anchor_01`, `validate_mobile_composer_keyboard_layout_01`, `validate_chat_answer_quality_p0_01`, `validate_answer_scroll_markdown_01`, `validate_mobile_home_ux_stability_01`, `validate_chat_answer_recovery_01`, `validate_place_card_carousel_no_drift_01`, `validate_composer_auto_grow`, `validate_composer_desktop_width_02`, `validate_composer_interaction`, `validate_attachment_composer_16`, `validate_chat_layout_attachment_01`, `validate_bare_white_home_render_01`, `validate_sticky_topbar_01`, `validate_mobile_home_initial_scroll_01`, `validate_site_refresh_route_restore_01`, `validate_home_fresh_entry_01`, `validate_user_bubble_content_fit`, `validate_conversation_timeline_01`, asset_cache_version --check.
- 같은 release에 묶을 때: 토큰 줄은 한쪽 token, 위 5곳은 이 branch 쪽, 그 후 `--write`. 파일 전체 `checkout --ours/--theirs` 금지(키보드 branch의 site-conversation.js 실제 변경이 사라짐).

## NOT TESTED / 한계
- 실기기(Samsung Internet·Android Chrome·iPhone Safari·폴드): NOT TESTED. 키보드는 세 가지 에뮬레이션이며 실제 키보드 애니메이션·Samsung 툴바 동작은 재현하지 않았다. 보고된 화면과 같은 증상(빈 Home에서 입력창이 헤더 아래, 폴드 폭에서 + 가 첫 글자를 가림)을 기준선에서 재현했고 수정본에서 사라짐을 확인했다.
- 대화 중 화면은 기준선 에뮬레이션에서 점프가 재현되지 않았다. 실기기에서 대화 중에도 점프가 보였다면 추가 증거(화면 폭·브라우저 버전·대화 시작 전/후)가 필요하다.
- Linux gate(Ncloud): NOT TESTED(이 PC에 WSL·Docker 없음). 새 validator 단정은 글꼴과 무관한 상대 위치(간격·겹침)이고 LF 사본에서도 PASS. safe-area 검사는 Chrome에 `Emulation.setSafeAreaInsetsOverride`가 없으면 NOT TESTED로 출력하고 넘어간다.
- Production: 미배포라 NOT VERIFIED.

## 선택 사항 (차단 아님)
- 폰(≤600px)은 +·전송이 입력 줄 아래 줄이다(기존 설계 유지, 겹침 0). 폰에서도 `[+][입력][전송]` 한 줄을 원하면 별도 디자인 결정.

USER_DECISION_NEEDED=NONE
