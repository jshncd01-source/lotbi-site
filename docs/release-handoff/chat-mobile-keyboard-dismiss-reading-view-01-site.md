READY_FOR_DEPLOY=YES

# chat-mobile-keyboard-dismiss-reading-view-01-site — release handoff

TASK=LOTBI SITE — iPhone 모바일 대화 스크롤·키보드 실사용 P0 + 삼성 인터넷 입력창·키보드 P0(CMD_SITE_SAMSUNG_COMPOSER_KEYBOARD_P0_RESUME) + 키보드 닫기 GATE FIX 03 + 긴 답변 스크롤 anchor 통합(최종 READY 한 건)
REPO=lotbi-site
FEATURE_BRANCH=feature/chat-mobile-keyboard-dismiss-reading-view-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD)
REMOTE_FEATURE_SHA=FEATURE_SHA와 동일(`git ls-remote origin refs/heads/feature/chat-mobile-keyboard-dismiss-reading-view-01-site`로 확인)
SUPERSEDES=68efba972a894c05c36f876c28df7b980f6cbb38 (keyboard GATE FIX 03 READY), a34e838ca59442adea6b791674c392ab8e854a29 (long-answer+keyboard 통합 READY, 옛 키보드 validator), e26e289612662668f8e9020f2db952f44ba14fce, c2cec3944601e2edacb59d0b68f04db0791ca399 (이 branch의 READY=NO 중간본) — 모두 이 branch에 포함. 따로 gate·배포하지 말 것. feature/chat-long-answer-scroll-anchor-01-site 는 이 branch에 들어 있으므로 별도 train 불필요.
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=c311be85f2bc1359f20323a1435bde5b9342ee9a (SITE-T30, 55a16306에서 정상 merge. 이 방 시작 시 c9c19e4c → 33aa5d9a(2a4cc144) → 82a8874e(3631d902) → 3d6a5eec(b479ff45) → ee8c1b6f(bf227db7) → c311be85(55a16306))
MAIN_MERGED=c311be85f2bc1359f20323a1435bde5b9342ee9a
CODE_SHA=e449c3ad
ASSET_VERSION=aset-45fcbe18a1ae
MERGED_TO_MAIN=NO
DEPLOYED=NO
CORE_CHANGE=NONE
APP_CHANGE=NONE (Site만. long-answer의 app branch feature/chat-long-answer-scroll-anchor-01-app 은 별개, 이번 변경 없음)
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
ROOT_CAUSE=(1) iOS WebKit은 키보드를 알리는 visualViewport resize 이벤트에 옛 offsetTop을 싣고, 실제 화면 이동(pan)은 이벤트 없이 몇 프레임 뒤에 반영한다(WebKit bug 237851). home-shell.js가 이벤트마다 한 번만 읽어 셸(키보드 열림 시 position:fixed, top=offsetTop)을 옛 위치에 고정 → 입력창이 키보드 높이만큼 위에 뜨고 그 아래가 빈 공간(390x844: 352px, 대화 보이는 높이 48px). (2) iOS 26 Safari·WKWebView(카카오톡 내장 브라우저)는 키보드를 닫은 뒤 offsetTop을 0으로 되돌리지 않는 경우가 있다(WebKit bug 297779) → 화면이 밀린 채 상단 바가 잘림(모델 24px). (3) 입력창 영역(.chat-composer-stack)에서 시작한 드래그는 "사용자 스크롤"로 인정되지 않았다 → 맨 아래를 따라가던 사용자는 다음 성장 때 바닥으로 되돌아가고, long-answer의 입력창 탭 줄 고정(900ms)이 드래그를 20ms마다 원위치(2235→2253→2235 반복, 드래그 전체 무효). (4) 입력창 textarea의 `overflow-y:hidden` + `overscroll-behavior:contain` 때문에 글이 짧아 textarea가 스크롤되지 않을 때도 글자 위에서 시작한 드래그가 대화로 넘어가지 않았다(스크롤 이벤트 0건). Production main에는 추가로 (5) 답변이 자라는 동안 바닥 72px 안이면 따라가기가 유지되어 손가락으로 위로 끌어도 바닥으로 끌려가고(+792px), (6) iPhone에서 전송 후 키보드가 닫히지 않아 키보드가 열린 좁은 화면에서 읽게 된다 — (5)는 long-answer, (6)은 keyboard dismiss가 이미 고쳤고 이 branch에 포함.
REPRODUCTION=새 validator(정적 계약을 뺀 진단 사본)를 Production main c9c19e4c, 수정 전 통합본 4fe6a961, 수정본에 실행. 아래 "iPhone 실사용 P0" 절의 표. 사용자 화면 녹화 파일은 이 PC에서 찾지 못해 직접 보지 못함(NOT VIEWED) — 증상 설명과 iOS WebKit 공개 버그 보고로 모델을 만듦.
KEYBOARD_RESULT=키보드 열림: 입력창 아래 여백 16px(스택 자체 padding), 상단 바 잘림 0, 대화 보이는 높이 188px(375x667)·320px(390x844)·407px(412x915), 읽던 맨 위 줄 이동 0px(iOS 늦은 값·iOS 26·Android 모두). 키보드 닫힘: 읽던 줄 이동 0px, iOS 26 잔류 offset 화면에서도 상단 바 잘림 0·입력창 하단. 전송 시 키보드 닫힘(GATE 03 검사 PASS).
TOUCH_SCROLL_RESULT=실제 터치(CDP Input.dispatchTouchEvent) 기준: 대화 위 드래그 −410px, 입력창 여백에서 시작 +145px, 입력창 글자 위에서 시작 +185px, 답변 성장 중 위로 끌기 −225px, 맨 아래 따라가던 중 입력창 위 가장자리에서 끌기 → 바닥에서 벗어나 성장 후에도 821px 위 유지, 모든 경우 드래그 뒤 성장·키보드·복귀로 읽던 항목 이동 0px. 맨 처음 메시지까지 손가락으로 도달(scrollTop 0), 브라우저 이탈·복귀(pagehide/visibilitychange/pageshow persisted) 후 위치 이동 0px.
LONG_ANSWER_INTEGRATION=질문 전송 시 질문이 읽기 영역 상단(12px)에 고정, 사용자의 드래그는 어디서 시작하든 즉시 고정·따라가기 해제(되돌림 없음), ↓ 최신 답변으로만 끝 이동, 다음 질문은 새 anchor. validate_chat_long_answer_scroll_anchor_01 PASS(검사 변경 없음).
CHANGED_TEST_EXPECTATIONS=(a) 새 validate_chat_ios_touch_scroll_keyboard_01.mjs(workflow 등록). (b) validate_mobile_composer_keyboard_layout_01.mjs: "읽던 줄" 측정(holdReadingItem/heldShift)을 그 파일 머리말에 적힌 기준대로 화면 좌표(rect − visualViewport.offsetTop)로. layout·visual 모델은 offsetTop 0이라 값이 같고, 허용 오차(STILL)·단계·대상 동일. pan 모델(화면이 키보드만큼 내려감)에서 옛 측정은 레이아웃 좌표 유지 = 화면에서 키보드 높이만큼 위로 튐을 요구하고 있었다(수정 전 통합본은 이 기준으로 −320px). (c) validate_chat_mobile_keyboard_dismiss_01.mjs는 GATE FIX 03(3ccbbf06, 다른 방)의 답변 보류 방식 — 아래 원문 머리말. 단정 삭제·완화 없음.
SLOW_ENV_REPRO=GATE FIX 03: 아래 원문(수정 전 x20 FAIL / 수정 후 x20 PASS). 이 branch 최종 트리에서도 x20 측정 결과는 TEST_STATUS 참조. 새 validator는 `LOTBI_VALIDATOR_CPU_THROTTLE` 지원, 맨 아래 따라가기 드래그는 성장 간격 250ms로 느린 gate에서도 결정적.
TEST_STATUS=Windows 11, Chrome 154 headless, `CHROME_BIN=C:/Program Files/Google/Chrome/Application/chrome.exe`, LF 체크아웃. 이 PC는 검증 내내 다른 개발방들의 validator 동시 실행으로 CPU 100%·Chrome 115~154개였다.
  (1) 전체 scripts/validate_* 216개, 트리 c2cec394(= 2a4cc144, main 33aa5d9a 포함): 정적 133/133 PASS, 브라우저 84개 중 72 PASS·12 FAIL. 12건 모두 이 branch 무관 근거: 기존 Windows RED 2(validate_mobile_footer_legal_sheet_01 "761px: mobile disclosure leaked into desktop", validate_site_avatar_fallback_runtime — 둘 다 main 기준선 동일, GATE FIX 03 절 표 참조), 단정 PASS 출력 뒤 %TEMP% Chrome 프로필 rmSync EPERM 1(validate_auth_unknown_recovery_browser_01 — 기준선 비교는 다른 방이 같은 고정 포트 4271을 쓰고 있어 미실행), Chrome 실행 ETIMEDOUT 3(mobile_home_ux_stability_01, sticky_topbar_01, user_bubble_content_fit), 고정 포트 dynamic import 실패 4(calendar_toolbar_polish_01, place_card_compact_01, profile_menu_improvement_01, school_meal_neis_admin_fallback_01), --dump-dom 결과 없음 1(calendar_lunar_settings_ui_01), 네이버 새 탭 타이밍 1(place_card_naver_search_click_01). 이 중 place_card_compact_01 외에는 아래 (2)·(3)에서 단독 재실행 PASS 또는 기준선 동일.
  (2) 트리 3631d902(main 82a8874e merge): 정적 135/135 PASS, 선별 브라우저 32개(핵심 11 + (1)의 실패 10 + Life Wallet·생활정보 11) 중 26 PASS. 실패 6 = 기존 RED 2, EPERM 1, place_card_compact_01(main 기준선도 같은 부하에서 5번 중 4번 같은 오류 — GATE FIX 03 절), Chrome ETIMEDOUT 2 → sticky_topbar_01 원본 재시도 PASS, mobile_home_ux_stability_01은 원본 4회 ETIMEDOUT·Chrome 실행 제한만 30→180초로 늘린 저장소 밖 사본 PASS(단정 동일).
  (3) 최종 트리 b479ff45(main 3d6a5eec merge): 정적 133/133 PASS, 브라우저 18개(핵심 11 + SITE-T28 관련 7) 중 1차 9 PASS, 실패 9는 모두 부하성(Chrome ETIMEDOUT 5: conversation_message_ux_final_01·mobile_home_initial_scroll_01·consumer_theme_sync_01·mobile_home_ux_stability_01·sticky_topbar_01, 페이지 준비 시간 초과 1: mobile_composer_keyboard_layout_01, Chrome 비정상 종료 1: chat_layout_attachment_01, 캘린더 2: calendar_editor_footer_contrast_01·calendar_system_dark_01). 단독 재실행: calendar_editor_footer_contrast_01 PASS, calendar_system_dark_01 PASS(둘 다 main 3d6a5eec 순수 트리에서도 PASS), mobile_composer_keyboard_layout_01 PASS, mobile_home_initial_scroll_01 PASS, chat_layout_attachment_01 PASS, consumer_theme_sync_01 PASS. Chrome 실행 제한만 30→180초로 늘린 저장소 밖 사본(단정 동일): conversation_message_ux_final_01 PASS, mobile_home_ux_stability_01 PASS. sticky_topbar_01: 이 트리에서는 원본 4회·180초 사본 1회 모두 Chrome 실행 ETIMEDOUT(CPU 100%, Chrome 112개)이라 NOT VERIFIED — 바로 앞 트리 3631d902에서 원본 PASS, 그 전 트리에서도 2회 PASS였고, 그 뒤 들어온 SITE-T28은 상단 바·셸을 바꾸지 않음(자동 다크 18→22시, 진위확인 마크업, 캘린더·상세·진위확인 CSS뿐). place_card_compact_01은 (1)(2)와 같은 부하성 모듈 로드 실패로 이 트리에서 재실행하지 않음.
  (4) 이 branch 핵심 검사(최종 트리): chat_ios_touch_scroll_keyboard_01(신규) PASS, chat_mobile_keyboard_dismiss_01 PASS·CPU x20 감속 PASS(573초), chat_long_answer_scroll_anchor_01 PASS, mobile_composer_keyboard_layout_01 PASS, chat_answer_quality_p0_01 PASS, site_refresh_route_restore_01 PASS, festival_region_search_consistency_01·scam_shield_photo_picker_01·scam_shield_result_banner_contrast_01·theme_auto_schedule_02 PASS.
  (5) 수정 전 재현: 새 검사기를 Production main c9c19e4c·수정 전 통합 4fe6a961에 실행 → 각각 5/5·4/4 케이스 FAIL(위 표). 고친 입력창 레이아웃 검사기를 4fe6a961에 실행 → "360x780/pan: the keyboard opening kept the line being read (-328px)" FAIL, 수정본 PASS.
  (6) 최종 트리 e449c3ad(main c311be85 merge + 삼성 검사기): 정적 133/133 PASS. 브라우저: validate_samsung_composer_keyboard_01 10/10 PASS(같은 검사기로 main c311be85 순수 트리는 10/10 FAIL), 명령문 지정 6개 chat_mobile_keyboard_dismiss_01·chat_ios_touch_scroll_keyboard_01·chat_long_answer_scroll_anchor_01·mobile_composer_keyboard_layout_01·mobile_home_ux_stability_01·site_refresh_route_restore_01 모두 PASS(원본), chat_answer_quality_p0_01·conversation_message_ux_final_01 PASS, SITE-T30 검사기 life_wallet_full_frame_card_01·place_card_carousel_no_drift_01·place_card_naver_search_click_01·place_medical_card_ux_final_01·product_photo_compare_01 PASS, place_card_compact_01 1차 'result missing'(Chrome 덤프 결과 없음, 부하) → 단독 재실행 PASS. bf227db7 트리의 일부 결과는 c311be85 merge 도중(충돌 표시가 파일에 있던 순간) 같은 폴더에서 돌아 무효 처리.
  Linux gate 자체 실행: NOT TESTED(이 PC에 WSL·Docker 없음).
NEW_FAILURES=NONE
REAL_DEVICE=NOT VERIFIED — iPhone Safari·카카오톡 내장 브라우저(iOS/Android)·Android Chrome·Samsung Internet 실기기 검증 안 함. 모두 Chrome 154 headless 에뮬레이션(가짜 visualViewport, 터치 에뮬레이션). 배포 후 실기기 smoke 필요.
PRODUCTION_DEPLOYED=NO
USER_DECISION_NEEDED=NONE

커밋(68efba97·a34e838c 이후): 4fe6a961 long-answer a34e838c merge → 0e13df15 iPhone P0 수정 → 4c408fb2 68efba97 merge → 2a4cc144 main 33aa5d9a merge → c2cec394 READY=NO 중간 문서 → 3631d902 main 82a8874e merge → b479ff45 main 3d6a5eec merge → bf227db7 main ee8c1b6f merge → 55a16306 main c311be85 merge → e449c3ad 삼성 검사기 → 이 문서. 다섯 번의 main merge 모두 충돌은 asset token(+main이 이름을 더한 import 2줄)뿐, 검증: merge 결과 − main = 이 branch − 이전 main (토큰 정규화, 이 branch가 바꾼 14~15파일 전부 일치).

---

## 삼성 인터넷 입력창·키보드 P0 (2026-10-08 22:20 명령, CMD_SITE_SAMSUNG_COMPOSER_KEYBOARD_P0_RESUME)

### 실사용 증상 (삼성 인터넷 실기기)
1. + 버튼이 플레이스홀더 첫 글자를 가림(키보드를 닫아도). 2. 키보드가 열리면 입력창이 키보드 바로 위가 아니라 위로 튀고 그 아래 큰 빈 공간. 3. 홈의 캐릭터·인사말·입력창이 키보드 열고 닫을 때 크게 흔들림.

### 원인 (Production main c311be85 코드 기준, 이 branch에는 이미 수정이 들어 있음)
- 1: + 가 `position:absolute; left:7px` 로 입력창 왼쪽 52px padding 위에 얹혀 있는데, home-bare-white.css(≤760px)가 빈 홈 입력창 padding-left 를 13px 로 덮어써 601~760px(Z Fold 펼침 690px) 빈 홈에서 + 가 플레이스홀더 첫 6글자를 덮음. 수정 = long-answer branch의 입력창 hotfix 0dbd7e86(+·글자·등급·전송을 grid 칸으로 배치) — 이 branch 포함.
- 2·3: 빈 홈의 `body.chat-home-page:not(.conversation-active) .chat-hero`(svh 최소 높이·가운데 정렬·padding-bottom 64, 특이도 0,3,1)가 키보드 규칙(0,2,1)을 이겨, 키보드가 열려도 입력창이 줄어든 화면의 가운데에 남음 → 입력창 아래 53~223px 빈 공간, 캐릭터·인사말·입력창이 화면 크기에 따라 통째로 위아래로 이동. 수정 = hotfix 892d9633(키보드 열린 빈 홈은 입력창을 키보드 위에 붙임) + 이번 iPhone 수정 0e13df15(visualViewport를 프레임 단위로 따라감) — 이 branch 포함.

### 검사 — 새 `scripts/validate_samsung_composer_keyboard_01.mjs` (workflow 등록)
삼성 인터넷 UA(SamsungBrowser/27), Galaxy S 360x780·S+ 384x854·Ultra 412x915·Z Fold 겉화면 344x882·펼침 690x829, 키보드 레이아웃 축소 모델(resizes-content)과 visualViewport 축소+화면 이동 모델(resizes-visual), 키보드를 한 번에(Chromium이 키보드가 다 올라온 뒤 한 번 알리는 방식[추정]) 그리고 3단계 애니메이션으로 열고 닫음. 단정: + 가 글자(플레이스홀더·입력 중 글자)에 닿지 않음, 키보드가 올라오면 입력창이 키보드 바로 위(빈 공간 0~28px, 상단 바 아래), 단계형에서도 입력창이 키보드 밑에 들어가지 않음, 키보드가 열릴 때 캐릭터·인사말은 한 방향(위)으로만, 닫으면 캐릭터·인사말·입력창이 원래 위치로(±2px), 대화 화면도 같음.
| | Production main c311be85 | 이 branch |
|---|---|---|
| 결과 | 10/10 경우 FAIL | 10/10 PASS |
| + 겹침 (Fold 펼침 690) | 첫 글자 6자 덮음(글자 30px, + 끝 68px) | 0 |
| 키보드 연 뒤 입력창 아래 빈 공간 (360 / 384 / 412 / Fold 겉) | 레이아웃 192·223·205·193px, viewport 58·83·60·53px | 16px |
| 키보드 연 뒤 입력창 위치 (360x780) | 165(레이아웃)·299(viewport), 화면 가운데 | 341, 키보드 바로 위 |

### 남은 위험 (다음 READY 후보, 실기기 확인 필요)
- 키보드가 단계적으로 커지며 viewport가 여러 번 바뀌는 브라우저라면, 빈 홈 입력창이 키보드가 16% 판정선을 넘는 순간 한 번 아래로 내려갔다가 다시 올라감(360x780 단계형: 343→290→447→341, 모든 기기 같은 양상). 키보드에 가려지지는 않고 최종 위치는 정상. 키보드를 한 번에 알리는 경우는 343→341로 거의 움직이지 않음.
- 삼성 인터넷 실기기·Android 시스템 글꼴 크기 확대 환경: NOT VERIFIED.

## iPhone 대화 스크롤·키보드 실사용 P0 (2026-10-08)

### 실사용 증상
iPhone 카카오톡 내장 브라우저: 대화 중 손가락 스크롤이 되지 않음, 키보드가 열릴 때 입력창이 비정상적으로 올라가고 큰 빈 공간.

### 재현 (Chrome 154 headless 에뮬레이션, 실제 터치 이벤트; iPhone 390x844 iOS 모델 기준)
| 항목 | Production main c9c19e4c | 수정 전 통합본 4fe6a961 | 수정본 |
|---|---|---|---|
| 키보드 열림: 입력창 아래 빈 공간 | 352px | 352px | 16px |
| 키보드 열림: 대화 보이는 높이 | 48px | 48px | 320px |
| 키보드 열림: 상단 바 잘림 | 336px | 336px | 0 |
| 키보드 열림: 읽던 맨 위 줄 화면 이동 | −865px | −336px | 0 |
| 답변 성장 중 손가락 위로 240px | +792(바닥으로 끌림) | −225 | −225 |
| 입력창 여백에서 시작한 드래그 | 0 / 바닥 복귀 | 0 | +145 |
| 입력창 글자 위에서 시작한 드래그 | 0 / 바닥 복귀 | 0 | +185 |
| 맨 아래 따라가던 중 드래그 → 성장 후 | 바닥 복귀(0px) | 바닥 복귀(0px) | 821px 위 유지 |
| iOS 26: 키보드 닫은 뒤 상단 바 | 24px 잘림 | 24px 잘림 | 0 |
| 전송 후 키보드 | 열린 채 | 닫힘 | 닫힘 |
375x667(iOS)·412x915(Android)도 같은 양상(375: 빈 공간 307px→16px, 대화 −39px→188px).

키보드 모델(검사기 머리말): ios = resize 이벤트에 높이만 줄고 offsetTop은 60ms 뒤 이벤트 없이 반영(WebKit 237851), ios26 = 같은 열림 + 닫은 뒤 offsetTop 24·높이 24px 부족 잔류(WebKit 297779), android = 값과 이벤트가 정상인 resizes-visual. 실제 화면은 움직일 수 없어 "화면 위치"는 rect − offsetTop.

### 수정
- `home-shell.js`: 트리거(viewport resize/scroll, focus/blur, 키보드 열림·밀림 중 터치)마다 visualViewport를 프레임 단위로 다시 읽어 12프레임 동안 변화가 없을 때까지 따라감(최대 90프레임, 타이머 없음 — 기존 "no timer" 계약 유지). 값이 바뀔 때만 CSS 변수·클래스를 씀. 입력 중이 아닌데 viewport가 8프레임 넘게 밀려 있으면 `mobile-viewport-displaced`로 셸을 실제 보이는 영역에 맞춤(확대 중·다른 입력칸 편집 중 제외). `resizePrompt`: textarea가 스스로 스크롤될 때만 `overscroll-behavior: contain`.
- `site-hardening.css`: `body.mobile-viewport-displaced` 셸 규칙(키보드 열림 셸 규칙과 같은 위치·크기만, 키보드 레이아웃은 적용 안 함).
- `site-conversation.js`: 입력창 위 touchmove는 8px 넘게 움직이면 사용자 스크롤(탭은 기존 입력창 처리 유지). 읽던 줄 위치는 화면 기준(셸에 실제 적용된 offset을 뺌) — 키보드 pan을 줄 이동으로 오인하지 않음. 키보드가 닫힐 때(blur) 스스로 스크롤해 읽던 사용자의 줄 유지.
- 새 검사기·workflow 단계, 입력창 레이아웃 검사기 측정 좌표 정정(위 CHANGED_TEST_EXPECTATIONS).

### 남은 한계
- 실기기 미검증(위 REAL_DEVICE). 특히 iOS 26 잔류 offset의 실제 크기·지속 시간은 기기·빌드마다 다르게 보고됨.
- 맨 아래 따라가기 중 손가락이 닿고 8px 움직이기 전에 들어온 답변 블록 하나는 따라가기로 반영될 수 있음(그 뒤 즉시 사용자 스크롤로 전환).

---

## GATE FIX 03 READY 68efba97 원문 머리말 (이 branch에 포함, 다른 방 작성)


    REPO=lotbi-site
    FEATURE_BRANCH=feature/chat-mobile-keyboard-dismiss-reading-view-01-site
    FEATURE_SHA=이 문서 커밋(branch HEAD)
    REMOTE_FEATURE_SHA=FEATURE_SHA와 동일(`git ls-remote origin refs/heads/feature/chat-mobile-keyboard-dismiss-reading-view-01-site`로 확인)
    SUPERSEDES=e26e289612662668f8e9020f2db952f44ba14fce (SITE-T16 Linux gate에서 validator 타이밍으로 FAIL)
    AUTHORITATIVE_MAIN_AT_DEVELOPMENT=c9c19e4cef9914f0b50d4870cbcc59e58602ddc2 (SITE-T20, f6603a68에서 정상 merge. 지시 시점 843a667b 이후 전진. 첫 base 0a03ca12)
    CODE_SHA=f6603a68
    ASSET_VERSION=aset-639080af4f23
    PRODUCT_CODE_CHANGED_IN_GATE_FIX_03=NO (site-conversation.js 키보드 동작은 그대로. 바뀐 것은 validator 1개와 main merge뿐)
    ROOT_CAUSE=제품이 아니라 validator 타이밍. "답변 오기 전" 상태(A sentWaiting)를 가짜 Core의 고정 900ms 지연과 경주시켜 쟀다. 전송 → settle(키보드 애니메이션 대기+프레임+400ms) → snap이 900ms를 넘으면 답변이 이미 도착해 loading=0·answers=1로 측정된다. Linux gate(2 core)는 그보다 느렸다. gate 측정값(키보드 닫힘·포커스 해제)은 정상이었다. 같은 구조의 E·F(3500ms)와 "작성 중 답변 도착"(2000ms)도 같은 경주였다.
    CHANGED_TEST_EXPECTATIONS=단정 삭제·완화 없음. 측정 방식만 "고정 지연과 경주" → "답변 보류 후 측정, 측정 뒤 명시적 해제"(holdAnswers/releaseAnswers). 측정 전 생각 중 표시가 뜰 때까지 대기(최대 10초). 강화한 단정: A 질문이 Core에 도착해 보류 중(held=1), E 느린 질문 보류 중(held=1), E 실행 중 Enter가 Core 요청을 하나도 만들지 않음(held=1·요청 수 동일), F 답변 대기 중에 키보드가 닫힘(held=1·loading=1), E 답변이 오기 전에 이미 작성 중이었음(held=1·loading=1·포커스·키보드). 느린 환경 재현용 env `LOTBI_VALIDATOR_CPU_THROTTLE`(미설정이면 영향 없음).
    SLOW_ENV_REPRO=Windows Chrome 154 + CDP Emulation.setCPUThrottlingRate. 수정 전 validator: x1·x4·x6·x10 PASS, x20 FAIL — iphone-safari-390x844·samsung-android-412x915 "the answer is still on its way"(sentWaiting answers=1 loading=0, gate와 같은 신호) + E/F 3건(Enter while a turn runs, F draft survives). 수정 후: x1 PASS, x20 PASS(모바일 3개 모두 sentWaiting/slowSent/writingBeforeAnswer loading=1·held=1). long-answer 통합 a34e838c와 합친 상태에서도 x20 PASS. Linux 자체 실행은 이 PC에 WSL·Docker가 없어 NOT TESTED.
    LONG_ANSWER_TRIAL_MERGE=지시의 f296c4ce는 이미 대체됐고, 현재 long-answer remote a34e838c가 키보드 e26e2896과 main c9c19e4c를 포함한 통합 READY다. a34e838c에 이 branch(f6603a68)를 임시 worktree로 merge(push 안 함): 충돌 59개 모두 asset token, 결과는 a34e838c 대비 이 validator 1개만 다름(asset token 동일). 그 상태에서 chat_mobile_keyboard_dismiss_01·chat_long_answer_scroll_anchor_01·chat_answer_quality_p0_01·site_refresh_route_restore_01·conversation_message_ux_final_01·mobile_home_ux_stability_01 + mobile_composer_keyboard_layout_01 7/7 PASS.
    INTEGRATED_BRANCH_NOTE=long-answer 통합 READY a34e838c는 옛 validator(e26e2896과 동일)를 담고 있어 Linux gate에서 같은 이유로 실패할 수 있다. release에서 두 branch를 함께 merge하면 3-way merge로 이 branch의 새 validator가 들어간다(long-answer 쪽은 이 파일을 바꾸지 않음). a34e838c 단독 배포라면 이 validator 커밋(3ccbbf06)을 먼저 그 branch에 merge해야 한다.
    TEST_STATUS=아래 GATE FIX 03 절
    NEW_FAILURES=NONE
    MIGRATION=NO
    ENV_CHANGE_REQUIRED=NO
    CORE_CHANGED=NO
    PRODUCTION_DEPLOYED=NO
    USER_DECISION_NEEDED=NONE

    커밋(e26e2896 이후): 3ccbbf06 validator 답변 보류 방식 → f6603a68 main c9c19e4c merge → 이 문서.

---

## GATE FIX 03 — Linux merge gate 반환 (SITE-T16, run 20261007T121625Z-4128521-80833861)

### 증거
- `validate_chat_mobile_keyboard_dismiss_01.mjs`: `iphone-safari-390x844: the answer is still on its way`, `samsung-android-412x915: the answer is still on its way`.
- 같은 run의 sentWaiting: loading=0 answers=1 focused=false kbOpen=false visibleHeight=844 → 제품 동작(키보드 닫힘·포커스 해제)은 정상이었고, 측정 시점이 답변 도착 뒤였다.

### 고정 지연을 쓰던 측정 전부 정리
| 단계 | 전 | 후 |
|---|---|---|
| A 전송 직후 (sentWaiting) | setDelay(900)과 경주 | 답변 보류 → 생각 중 표시 대기 → 측정 → 해제 |
| E·F 느린 답변 중 탭·초안·Enter·키보드 닫기 | setDelay(3500)과 경주 | 보류 상태에서 전 단계 측정 → 해제 |
| E 작성 중 답변 도착 | setDelay(2000)과 경주(작성이 먼저였는지 미확인) | 보류 → 작성 시작 확인(held=1·loading=1·키보드) → 해제 → 답변 후 측정 |

### 느린 환경 재현 (CPU 감속, iPhone 390x844 + Samsung 412x915)
| CPU 감속 | 수정 전 | 수정 후 |
|---|---|---|
| x1 | PASS | PASS (4 케이스) |
| x4 / x6 / x10 | PASS | — |
| x20 | **FAIL**: A "the answer is still on its way"(answers=1 loading=0) ×2, E Enter while running ×2, F draft ×1 | PASS (4 케이스, held=1·loading=1) |

### 회귀 (Windows, Chrome 154, `CHROME_BIN=C:/Program Files/Google/Chrome/Application/chrome.exe`, CODE_SHA 기준, scripts/validate_* 213개 직렬)
전체 213개: 204 PASS / 9 FAIL — 9건 모두 이 branch와 무관(아래 근거). 실행 중 PC는 다른 세션의 validator 동시 실행으로 CPU 100%(Chrome 75~107개)였다.
| FAIL | 근거 |
|---|---|
| validate_mobile_footer_legal_sheet_01 | main c9c19e4c 기준선에서도 같은 `761px: mobile disclosure leaked into desktop` |
| validate_site_avatar_fallback_runtime | main 기준선에서도 같은 Node 24 undici assert |
| validate_calendar_system_dark_01, validate_image_attachment_thumbnail_01 | Windows CRLF 체크아웃 문제. 같은 커밋을 LF로 꺼낸 worktree에서 둘 다 PASS |
| validate_pinned_conversation_section_01, validate_theme_auto_schedule_02 | 단독 재실행 PASS |
| validate_message_calendar_footer_editor_01, validate_calendar_touch_monthnav_daysheet_01 | `Failed to fetch dynamically imported module`(모듈 로드 실패). 수정본 단독 재실행 PASS(footer_editor 재시도 1회째, calendar_touch 2회째). footer_editor는 main 기준선도 같은 부하에서 같은 오류로 1회 FAIL. calendar_touch는 기준선에서는 3/3 PASS였지만 오류 종류가 부하성 모듈 로드 실패와 같음 |
| validate_place_card_compact_01 | 같은 오류가 매번 다른 경우(344·360·412·760, 지도 앱 종류도 다름)에서 무작위로 남. 고정 포트를 바꾼 복사본(저장소 밖)에서도 같아 포트 충돌은 아님. main c9c19e4c 기준선도 같은 조건에서 5번 중 4번 같은 오류로 FAIL → 이 PC 부하 문제. 이전 gate·저부하 Windows 실행에서는 PASS |
키보드·대화 관련 직접 영향군은 전부 PASS: chat_mobile_keyboard_dismiss_01, chat_answer_quality_p0_01, answer_scroll_markdown_01, chat_answer_recovery_01, composer_interaction, composer_auto_grow, user_bubble_content_fit, conversation_message_ux_final_01, mobile_home_ux_stability_01, site_refresh_route_restore_01.

### 남은 한계 (변경 없음)
- iPhone Safari·Samsung Internet·KakaoTalk 인앱·Android Chrome 실기기 smoke는 배포 후 필요(NOT VERIFIED).

---

## SCOPE

- 모바일에서 질문을 보낸 뒤에도 소프트 키보드가 열린 채 남아 답변 읽을 공간이 줄던 문제.
- 변경: `site-conversation.js`(전송 경로·턴 종료 포커스), 새 validator, workflow step, asset token 재계산. CSS·Core 변경 없음.
- 범위 밖(별도 owner): 긴 답변에서 질문/답변 시작 읽기 위치 고정(bottom-follow 중단)은 병렬 작업 **CHAT-LONG-ANSWER-SCROLL-ANCHOR-01** (`feature/chat-long-answer-scroll-anchor-01-site`, 2026-10-07 19:26 기준 미push, 같은 파일의 appendNode·scroll listener·ResizeObserver·composer pointerdown 담당)이 구현 중이라 이 branch에서 중복 구현하지 않음. 아래 COMBINED 결과 참조.

## ROOT_CAUSE

1. 전송 경로 어디에도 입력창 blur가 없었다. 키보드의 Enter 전송, iPhone Safari의 전송 버튼 탭(Safari는 버튼이 포커스를 가져가지 않음)은 textarea 포커스를 그대로 남겨 키보드가 계속 열려 있었다.
2. 답변·오류·시간초과로 턴이 끝날 때마다 `focusComposerInPlace()`/`prompt.focus()`가 입력창에 다시 포커스를 줬다. Android에서 전송 버튼 탭으로 키보드가 닫혀도(버튼이 포커스를 가져감) 답변 도착 시 다시 열렸다(main 측정: 키보드 열림 1→2→3회, 사용자가 닫은 뒤에도 재오픈).
3. (범위 밖) 긴 답변 bottom-follow — 위 ANCHOR 작업 담당.

## CHANGE

- `sendFromReader(startTurn)`: 입력창 전송(Enter·버튼·음성 자동전송)과 오류의 `다시 시도`가 **실제로 턴을 시작했을 때만**(requestAssistant가 동기적으로 turn generation을 올림 = 질문 표시+요청 시작) 키보드를 닫는다. 빈 메시지·공백·전송 중·업로드 중에는 턴이 안 생기므로 아무것도 바꾸지 않는다.
- `dismissComposerKeyboard()`: `(pointer: coarse)` 또는 `body.mobile-keyboard-open`(home-shell.js의 visualViewport 판정)일 때만 `prompt.blur()`. 데스크톱(마우스) 동작 불변.
- `returnComposerFocusAfterTurn()`: 답변 완료·오류·시간초과·로컬 즉시응답 후 재포커스는 데스크톱에서만. 모바일은 사용자가 직접 입력창을 탭해야만 키보드가 다시 열림. 사용자가 답변 대기 중 다시 탭해 쓰고 있으면 그대로 둠(blur 안 함, 초안 유지).
- visualViewport: 새 타이머 없음. 키보드가 닫히며 스크롤러가 커지는 것은 기존 ResizeObserver(스크롤러·composer 관찰)와 home-shell.js의 visualViewport resize→rAF 흐름이 레이아웃 반영 후 처리.

## TEST_STATUS

FOCUSED_TEST_STATUS=PASS — `scripts/validate_chat_mobile_keyboard_dismiss_01.mjs`(신규, workflow step 추가)
- CDP 실제 입력: 터치 탭, `Input.insertText`, Enter 키. 키보드는 포커스를 따라감:
  - ios-visual(375x812 KakaoTalk iOS UA, 390x844 iPhone Safari UA): 레이아웃 높이 고정, visualViewport만 6프레임에 걸쳐 비동기로 줄고/늘어남(blur 직후엔 옛 높이)
  - android-resize(412x915 Samsung Internet UA): 테스트 프로세스가 viewport 자체를 3단계로 리사이즈(innerHeight·실제 visualViewport 변화)
  - desktop 1280x900 마우스
- A 전송 버튼(iPhone식, 포커스 유지)·Enter·전송 버튼 탭(Android식) → 답변 도착 전부터 포커스 해제·키보드 닫힘·전체 높이 복구
- B 읽기 영역이 키보드 높이만큼 증가, 질문+답변 시작 화면 안
- C 1,000자+ / D 3,000자+ → 키보드 없음, 완료 후 1.2초간 이동 없음, 사용자가 위로 읽는 위치 이동 0px
- E 대기 중 입력창 탭 → 키보드 다시 열림, 전송 중 Enter는 아무것도 안 보내고 키보드·초안 유지, 답변이 와도 쓰던 키보드·초안 유지
- F 대기 중 키보드 다시 닫기 → 보던 메시지 화면 안 유지, 완료 시 재오픈 없음
- G 빈 Enter·비활성 버튼·공백 → 포커스·키보드 그대로, 전송 0
- H 오류(503) → 키보드 닫힘·`다시 시도` 활성·입력창 탭으로 재입력 가능, `다시 시도`도 전송으로 취급
- I 장소 카드 / K 약국(NMC, 의료 상태 줄) / J 목록 Markdown / L 캘린더 후보 카드 → 키보드 닫힌 뒤 composer 화면 하단, 페이지 이중 스크롤 0, 가로 스크롤 0, 카드 레일 화면 안
- 데스크톱: Enter·버튼·긴 답변·오류 후 커서 입력창 유지(기존 동작)
- 같은 테스트(정적 계약 제외)를 main 0a03ca12에 실행 → 모바일 3개 화면 각 43건 FAIL(전송 후 포커스·키보드 유지, 완료 시 재오픈), 데스크톱 0건 = 결함 재현 및 데스크톱 동일 확인
- 내장 브라우저 375x812 모바일 터치 에뮬레이션 수동 확인: 탭→입력→Enter → focusout, 답변 후 재포커스 없음. 데스크톱 폭에서는 커서 유지.

REGRESSION: workflow node/python 검증 170개 — 이 branch 실패는 main과 같은 메시지로 실패하는 기존 Windows RED 3건뿐
(validate_mobile_footer_legal_sheet_01, validate_site_avatar_fallback_runtime, validate_calendar_system_dark_01). validate_place_card_compact_01은 병렬 실행 중 고정 포트 4213 "Failed to fetch dynamically imported module"로 1회 흔들렸고 단독 재실행 PASS.
대화·스크롤 관련 PASS: chat_answer_quality_p0_01, answer_scroll_markdown_01, chat_answer_recovery_01, composer_interaction, composer_auto_grow, user_bubble_content_fit, conversation_message_ux_final_01, mobile_home_ux_stability_01, sidebar_viewports_04 등.
NEW_FAILURES=0

COMBINED (시험 결합, push 안 함): 이 branch 39dba787 + ANCHOR 작업 폴더의 미커밋 diff(19:22 시점) 적용 → 충돌은 asset token 줄 8곳뿐(로직 hunk 자동 병합)
- validate_chat_mobile_keyboard_dismiss_01 PASS, validate_chat_long_answer_scroll_anchor_01 PASS, answer_scroll_markdown_01 PASS, mobile_home_ux_stability_01 PASS
- validate_chat_answer_quality_p0_01 FAIL — ANCHOR 쪽 정적 계약 regex(keyboard-viewport listener 첫 줄)가 ANCHOR 자기 코드(`settleViewport(700)` 선행)와 안 맞음. ANCHOR 작업 폴더 단독에서도 동일하게 불일치 → ANCHOR 작업 중 상태, 이 branch 무관.
- workflow step은 ANCHOR 삽입 위치(P0 step 뒤)와 10줄 이상 떨어진 곳(focus ring step 뒤)에 넣어 충돌 회피.

NOT_VERIFIED (실기기 smoke 필요, Production 배포 후):
- iPhone Safari: 전송 후 키보드 닫힘, 닫힐 때 화면 점프·composer 위치·이중 스크롤 없음(iOS의 레이아웃 viewport 스크롤 복귀는 에뮬레이션 불가)
- Samsung Internet: 동일
- KakaoTalk 인앱(iOS/Android): 동일 + 답변 완료 시 키보드 재오픈 없음(WebView는 script focus로 키보드가 열릴 수 있던 환경)
- Android Chrome: 전송 버튼 탭 후 답변 도착 시 재오픈 없음
- 참고: iPad처럼 coarse pointer + 하드웨어 키보드 환경도 전송 후 커서가 빠짐(다음 질문은 입력창 탭 필요)

CORE_CHANGED=NO
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
DEPENDENCIES=없음(단독 배포 가능 — 단독이면 키보드는 닫히고 긴 답변 위치는 현재 Production과 같은 bottom-follow). 완전한 읽기 UX는 ANCHOR branch와 함께 배포 권장, 순서 무관, merge 시 asset token 충돌은 재계산으로 해결.
PRODUCTION_DEPLOYED=NO
USER_DECISION_NEEDED=NONE
