READY_FOR_DEPLOY=YES

# site-refresh-route-restore-01 — release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/site-refresh-route-restore-01
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ssh://lotbi-ncloud-git/srv/git/repositories/lotbi-site.git refs/heads/feature/site-refresh-route-restore-01`)
REMOTE_FEATURE_SHA=same as FEATURE_SHA after push (verified with git ls-remote at push time)
BASE_MAIN_SHA=a3443d6574b52b452fcb0e4e4e31ee993b7b903a (작업 시작)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=0a03ca12d3f551c62517a760e20346ee8cf44561 (ce132b3c → fb12f803 → 8a9e414d → 0a03ca12 순서로 정상 merge, rebase 없음)
CODE_SHA=497b25cfbf1b703530897c1c0b7c153d429702b3
ASSET_VERSION=aset-12285db20119
DEPLOY_SCOPE=lotbi-site only (Core / Account Web / App / Admin 무변경, 배포 순서 제약 없음)
TEST_STATUS=명령 248개(workflow 3개의 검증 명령 208 + workflow 밖 scripts/validate_* 40, validate 파일 206개 전부) — feature 244 PASS / 기존 Windows RED 4 (validate_calendar_system_dark_01, validate_image_attachment_thumbnail_01, validate_mobile_footer_legal_sheet_01, validate_site_avatar_fallback_runtime), main 0a03ca12 동일 4건 재현
NEW_FAILURES=0
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
SERVER_SPA_FALLBACK_CHANGED=NO
USER_DECISION_NEEDED=NONE

## VALIDATOR FIX 02 — 배포총괄방 SITE-T11 반환 대응 (2026-10-07)

- 반환 사유: `scripts/validate_consumer_design_shell_01.mjs`가 이 branch에서 실패(main PASS). 정규식이 옛 `void selectTab('people')`을 요구했는데, 이 branch가 새로고침 복원을 위해 `void selectTab(careTab === 'pets' ? 'pets' : 'people')`로 바꿈(의도된 동작).
- 이전 보고 누락 원인: 회귀 범위를 workflow `run:` 명령(207개)으로만 잡았는데, 이 validator는 workflow에 없는 `scripts/validate_*` 파일이었음. 이번에는 배포총괄방과 같은 범위(validate 파일 전부)로 비교.
- df83aa7e 단정 갱신(약화 없음, 오히려 강화):
  - `mountConsumerSection` 기본값 `careTab = 'people'` 고정
  - care 블록(`root.append(tabs, body)` ~ mall 분기) 안에서 `loadCareCounts()` 뒤 마지막 문장이 정확히 `void selectTab(careTab === 'pets' ? 'pets' : 'people');`이고 초기 `selectTab(` 호출은 1회뿐
  - 그 식을 실제로 평가: `'pets'`만 반려동물, `undefined`·`null`·`''`·`'people'`·`'PETS'`·`'pet'`·`'care'`·`'wallet'`은 전부 사람
  - 탭 클릭·화살표 키가 `onCareTab`으로 알림(새로고침 복원용 URL 갱신 경로)
  - 변형 검증 9종 전부 FAIL로 잡힘: careTab 그대로 전달, 기본 pets, 항상 pets, truthy 비교, 초기 선택 삭제, 시그니처 기본값 pets, 뒤에 pets 덮어쓰기, 클릭 onCareTab 누락, 옛 main 계약(`selectTab('people')` 고정). 원본은 PASS.
- 497b25cf main 0a03ca12 merge 후 이 branch의 `validate_site_refresh_route_restore_01.mjs` 실패 → 원인 확인: main(life-medical-category-entry)이 생활정보 바로가기 맨 앞에 병원·의원·약국을 넣어 `.consumer-shortcut:first-child`가 축제·행사 대신 병원·의원 입력폼을 열고 festival 단계가 timeout(옛 선택자 임시 사본으로 재현). 같은 main 변경이 추가한 `[data-life-shortcut="festivals"]`로 축제·행사를 정확히 지정. 또 Windows에서 막 종료된 Chrome 프로필 삭제 EPERM이 실제 실패를 덮던 정리 단계를 경고로 바꿈(검사 단정 변경 없음).

## 문제

캘린더 · Life Wallet · 진위확인 · 안심케어 · 생활정보 등 Site 화면에서 새로고침(F5/Ctrl+R/주소창 Enter)하면 항상 홈(대화)으로 돌아감.

## ROOT_CAUSE

- ROUTER_TYPE: 라우터 없음. lotbiai.com은 문서 하나(`/`)이고, 각 화면은 대화 위에 붙는 surface(`installSurfaceBehavior`, 진위확인은 `<dialog>`)다.
- HOME_RESET_CAUSE: 화면을 열어도 URL이 전혀 바뀌지 않았다(가능성 C). 캘린더가 열려 있어도 URL은 `/` 그대로라 새로고침 시 서버가 index를 주고 bootstrap은 열린 화면 정보가 없으니 홈을 그림(main a3443d65에서 재현: 캘린더 열림 + URL `/` → reload → 홈).
- 로그인 사용자는 새로고침마다 Account handoff(`/auth/callback/`)를 거쳐 돌아오는데, 복귀 위치 허용 목록이 `#profile-photo` 하나뿐이라 URL에 화면이 있었더라도 `/`로 돌아왔을 것(가능성 F).
- 서버는 원인이 아님: Production `/`=200, `/calendar`=404(경로 라우트는 원래 없음), `/subscribe` 등 법정 페이지는 nginx clean URL로 이미 새로고침 정상.

## 라우트 계약 (CANONICAL_ROUTE_SOURCE = `site-route.js` SITE_ROUTES, 유일한 목록)

| 화면 | URL | 여는 곳(기존 코드) |
|---|---|---|
| 홈(대화) | `/` | — |
| 캘린더 | `/#calendar` | `openCalendar('all')` |
| Life Wallet | `/#wallet` | `openConsumerSection('wallet')` |
| 진위확인 | `/#scam` | `[data-scam-dialog]` |
| 안심케어(사람) | `/#care` | `openConsumerSection('care')` |
| 안심케어 › 반려동물 | `/#pets` | care 반려동물 탭 / `openPetFamily` |
| 생활정보 | `/#life` | `openConsumerSection('life')` |
| 축제·행사 | `/#festival` | `openFestival()` |
| 롯비함 | `/#lotbi-box` | `openLotbiBox()` |

- 이름은 저장소가 이미 쓰는 식별자(`data-consumer-section`, `data-scam-open`, `data-festival-open`, `data-lotbi-box-open`, care 탭 `pets`). 새 경로(`/calendar` 등)는 만들지 않음 → nginx/Render/Cloudflare 설정 변경 없음(fragment는 서버에 전달되지 않음).
- 제휴몰은 기존대로 account.lotbiai.com/connected-services로 이동, 계정/구독 관리는 Account 앱(lotbi-web) 화면이라 이 작업 범위 밖. Site `/subscribe`는 기존 정적 페이지.
- transient UI(캘린더 날짜 상세/편집 시트, 생활정보 상세 입력폼, 축제 상세, 공유 시트, 확인 모달, 프로필 메뉴)는 URL에 넣지 않음 → 새로고침 시 부모 화면까지 복원(홈으로 가지 않음).

## CHANGE

- `site-route.js`(신규): SITE_ROUTES, `parseSiteRouteHash`(''=홈, 이름=화면, null=라우트 아닌 fragment), `siteRouteHash`, `siteRouteUrl`(path·query 유지, fragment만 교체).
- `site-conversation.js`
  - NAVIGATION→URL: routed surface가 열리면 `history.pushState({lotbiRoute, lotbiRouteFrom, lotbiRouteKey})`. 닫히면 그 화면을 연 entry가 같은 문서에서 만든 것일 때만 `history.back()`(중복 entry 없음, 문서 재로드 없음), 아니면 지금 화면을 push. close→open 쌍은 microtask 한 번에 정리(축제 ← 생활정보 등).
  - BACK/FORWARD: `popstate` → fragment의 화면을 열거나(홈이면) routed 화면만 닫음. 라우트가 아닌 fragment(#profile-photo, #main-content)는 건드리지 않음.
  - RELOAD/DIRECT URL: mount 시 fragment를 읽고, 로그인 여부가 정해진 뒤(`body[data-site-auth-state]` 또는 callback이 넘긴 session) 그 화면을 연다. 7초 fallback.
  - 안심케어 사람/반려동물 탭은 같은 entry를 replace(`#care`↔`#pets`).
  - 화면 안의 `로그인` 링크(Life Wallet·사람·반려동물, `/auth/start/`)는 `/auth/start/#<route>`로 보내 로그인 후 그 화면으로 복귀.
- `site-auth.js`: 로그인 복귀 허용 목록 = `#profile-photo` + SITE_ROUTES fragment(닫힌 집합, `/`+fragment만). 저장값이 목록 밖이면 context 거부(기존 동작). open redirect 없음.
- `auth-callback.js`: 복귀 위치가 라우트면 home hydrate 전에 pending 표시.
- FLASH_OF_HOME_FIX: `index.html` head의 exact-purpose inline 블록(fragment만 읽고 `html[data-site-route-pending]` 설정, storage/network/navigation 없음) + `site-conversation.css`가 그동안 대화 홈을 숨기고 "화면을 불러오고 있어요" 표시. 화면이 열리거나 라우트가 아니면 즉시 해제, JS가 응답하지 않아도 CSS가 8초 후 스스로 해제.
- `site-scam-shield.js`: open/close를 window 이벤트로 수신(`lotbi:scam-shield-open-request`/`-close-request`), 열림/닫힘을 `lotbi:scam-shield-visibility`로 알림. 닫을 때 'close' 이벤트를 기다리지 않음(숨은 탭에서 Chrome이 프레임 렌더 전까지 'close'를 보내지 않는 것을 확인).
- `site-consumer-sections.js`: care `careTab`/`onCareTab` 옵션(기본값 기존과 동일, `'pets'`일 때만 반려동물 탭). 계약은 `validate_consumer_design_shell_01.mjs`가 고정(위 VALIDATOR FIX 02).
- 검증: `scripts/validate_site_refresh_route_restore_01.mjs`(신규, site-review step, 로컬 약 107초). `validate_hardening.py`·`validate_home_chat.py`: 새 inline 블록을 SITE-THEME-BOOTSTRAP-FIRST-PAINT-01과 같은 방식으로 허용(내용 고정, 규칙 완화 아님).

## BRANCH HISTORY

- 827e4928 fix(site): reload keeps the screen the reader was on (base a3443d65)
- 0eba1b95 Merge Ncloud main ce132b3c — asset token 충돌 55개 main 쪽, import/첫 페인트 블록 추가 hunk 4개 HEAD 쪽(토큰·추가 줄 제외 시 main과 동일 확인), 토큰 재계산. merge 결과의 main 대비 차이(토큰 줄 제외)가 827e4928의 변경과 동일함을 확인.
- eebcbb72 fix(site): keep the route marker and 진위확인 inside existing contracts (진위확인은 window 이벤트로, inline 블록은 hardening validator에 내용 고정 허용)
- 0ef04b03 Merge Ncloud main fb12f803 (place card 캐러셀 수정) — 같은 방식(토큰 55개 main 쪽, 추가 줄 hunk 4개 HEAD 쪽 검증, 토큰 재계산), main 대비 차이(토큰 줄 제외 1012줄)가 이 branch 코드 변경과 동일함을 확인
- e3349070 docs: READY handoff (1차) — 배포총괄방 SITE-T11에서 consumer_design_shell_01 실패로 반환
- df83aa7e test(site): consumer design shell validator 단정을 새 care 탭 계약으로 갱신(강화)
- eae1bce1 Merge Ncloud main 8a9e414d (pet-photo-guide-dedupe) — 토큰 충돌 54개 HEAD 쪽, 추가 줄 hunk 4개 HEAD 쪽(site-route import·route-pending 블록), site-pet-ui.js는 main 쪽(main이 guide artwork import와 사용처를 함께 삭제). 토큰 정규화 3-way 재계산과 실제 결과가 75/75 파일 일치. 토큰 aset-b39d75b48115
- c9805a29 Merge Ncloud main 0a03ca12 (SITE-T12: life-medical-category-entry·safecare-sighting-photo-intake·pet-photo-framing-gate) — 토큰 충돌 54개, 추가 줄 hunk 4개 HEAD 쪽, site-consumer-sections.js는 main 쪽(main이 site-life-medical.js import 추가). 토큰 정규화 3-way 재계산과 실제 결과 76/76 파일 일치. 토큰 aset-12285db20119
- 497b25cf test(site): route restore validator가 축제·행사를 `[data-life-shortcut="festivals"]`로 지정 + 정리 단계 EPERM이 실제 실패를 덮지 않게

## TEST_STATUS

FOCUSED_TESTS=PASS — validate_site_refresh_route_restore_01 (정적 + 실제 Chrome/CDP, iPhone UA 375x812·390x844 터치, 데스크톱 1280x900 마우스; 67/67/66 checks, HEAD 497b25cf에서 단독 105초) · validate_consumer_design_shell_01 PASS(갱신 단정 + 변형 9종 FAIL 확인)
- 정적: 라우트 표 ↔ opener 1:1, 복귀 허용 목록 적대 입력(`#//evil.example`, `https://…`, `#calendar?next=…`, `javascript:` 등) 전부 `/`, 저장값 변조 시 거부, pending 블록이 첫 stylesheet·module보다 앞, nginx `location /` 계약 불변
- CASE A `/` reload → 홈
- CASE B~E 캘린더(강력 새로고침 포함)·Life Wallet·진위확인·안심케어·생활정보: 메뉴 → `/#<route>` → reload → 같은 화면(문서 교체 확인) → 닫기 → `/`
- 반려동물 탭 `/#pets` reload → 안심케어 반려동물 탭, 축제·행사 `/#festival`, 롯비함 `/#lotbi-box` reload 복원, ← 버튼은 생활정보로
- CASE G 뒤로/앞으로: 데스크톱 홈→Wallet→안심케어 / 모바일 홈→생활정보→축제, back·back·forward·forward 순서 정확, 같은 문서(재로드 없음), 홈에서 연 화면 닫기 = 홈 entry로 복귀(entry 증가 없음)
- 열린 페이지에서 주소창 fragment 입력(`/#care`) → 재로드 없이 안심케어, 새 문서 직접 URL `/#wallet`
- CASE J query 유지(`?utm_source=…` load·reload·close), 일회성 `?conversation=` 소비 후 fragment 유지
- CASE K 라우트 아닌 fragment → 홈(pending 해제), 없는 경로 404 계약 불변
- CASE F 게스트 대화 reload → 같은 대화, 대화 위 캘린더 reload → 둘 다 복원
- CASE I 비로그인 `/#wallet`·`/#scam` → 각 화면의 로그인 안내(계정 API 호출 0), 거기서 로그인 → Account handoff → 같은 화면, 로그인 상태
- CASE H 로그인 사용자 `/#wallet`·`/#calendar`·`/#care` reload, 새 문서 `/#life` → 매번 Account 왕복 1회 → 같은 화면(Life Wallet은 계정 화면, 로그인 안내 아님)
- 홈 깜빡임: 프레임 단위 probe — 화면이 열리기 전 대화 홈이 그려진 프레임 0(모든 reload·직접 URL·로그인 복귀). probe 민감도 확인: pending 표시를 강제로 지우면 같은 시나리오에서 25/21 프레임 검출
FULL_REGRESSION=PASS (NEW_FAILURES=0) — 배포총괄방과 같은 범위: workflow 3개의 검증 명령 전체 208개(node --check 39 포함) + workflow에 없는 scripts/validate_* 40개 = 248개, validate 파일 206개 전부. 브라우저·고정 포트·하위 프로세스를 쓰는 68개는 직렬, 나머지는 병렬. CHROME_BIN=Chrome stable.
- feature HEAD c9805a29(코드 동일, 이후 497b25cf는 scripts/ 1파일): 1회차 239 PASS / 9 FAIL. 기존 RED 4건 외 5건 → 단독 순차 재실행 5/5 PASS
  - validate_site_refresh_route_restore_01: main 0a03ca12의 생활정보 바로가기 순서 변경 → 497b25cf에서 수정, 단독 PASS
  - validate_calendar_modal_runtime_02 · validate_calendar_lunar_settings_ui_01 · validate_calendar_editor_field_height_01 · validate_place_card_compact_01: "Failed to fetch dynamically imported module"(고정 포트 python http.server) / `--dump-dom` 결과 없음 → 단독 재실행 PASS. 이 branch는 해당 모듈을 토큰 외 바꾸지 않음
- main 0a03ca12 baseline(같은 248개, refresh validator는 main에 없어 NA): 237 PASS / 10 FAIL = 기존 RED 4건 + 같은 부하성 간헐 실패 6건(conversation_calendar_card_02, auth_unknown_recovery_browser_01(정리 단계 EPERM), message_calendar_footer_editor_01, calendar_week_timegrid_ui_01, calendar_weather_attribution_01, mobile_home_initial_scroll_01 — 전부 feature에서는 PASS)
- 실행 당시 이 PC에서 다른 방의 Chrome 약 30~47개·node 약 20개가 동시에 돌고 있었음(간헐 실패 원인으로 판단)
- 같은 범위로 main 8a9e414d merge 시점(eae1bce1)에도 실행: feature 245개 중 241 PASS / 기존 RED 4, main 8a9e414d 2건 간헐 실패 단독 재실행 PASS → NEW_FAILURES=0
PREVIOUS_RUN(1차 READY, 범위 부족) — workflow 3개의 검증 명령 전체(node --check 포함)를 HEAD 0ef04b03(207개)와 main fb12f803(206개)에서 실행: feature 202 PASS / 5 FAIL, main 201 PASS / 5 FAIL. 공통 4건은 main 동일 기존 Windows RED(validate_calendar_system_dark_01(CRLF), validate_image_attachment_thumbnail_01(CRLF), validate_mobile_footer_legal_sheet_01, validate_site_avatar_fallback_runtime). 나머지 1건씩은 고정 포트 python http.server의 "Failed to fetch dynamically imported module" 간헐 실패: main은 validate_calendar_day_panel_two_buttons_01, feature는 validate_calendar_holiday_surface_settings_icon_01 — feature 단독 재실행 holiday 3/3·two_buttons 2/2 PASS, 해당 모듈은 토큰 외 변경 없음.
  최근 Site 변경 관련 validator(then-latest main fb12f803 기준, 전부 PASS): calendar_compact_editor_01·calendar_editor_field_height_01·calendar_modal_runtime_02·conversation_calendar_actions_01·conversation_calendar_card_02(캘린더 편집/팝업), chat_answer_quality_p0_01·chat_answer_recovery_01(대화 꼬리·답변 복구·background completion), kakao_share_fallback_01·message_share_actions_01, place_card_naver_search_click_01·place_card_carousel_no_drift_01, pet_photo_source_selector_01, subscribe_account_checkout_handoff_01, auth_continuity_02·ios_social_return_01·home_same_url_stability_01, hardening·home_chat. 명령문 24절의 calendar single-layer editor·chat tools calendar popup·chat background completion(chat_answer_recovery_01)·Kakao share fail-closed·pet slot guide art·place card NAVER search·subscribe/account handoff는 모두 main fb12f803에 이미 포함되어 있고, 이 branch와 합친 HEAD의 전체 suite에서 함께 PASS.
NEW_FAILURES=0

NOT_VERIFIED:
- 실제 iPhone Safari / Android Chrome / Samsung Internet / KakaoTalk·NAVER 인앱 실기기 (viewport·UA 에뮬레이션만)
- Linux merge gate (로컬 Linux 실행 수단 없음). validator는 외부 DNS 차단·포트 0·요소 중심 hit-test만 사용
- 실제 Account handoff: 로컬에서는 Account 응답을 CDP로 대신함(같은 state, 새 code로 callback). Production 배포 후 smoke 필요
- Production E2E (미배포)

## 배포 후 SMOKE (lotbiai.com)

1. 비로그인: 캘린더 → 주소 `…/#calendar` → F5 → 캘린더. 닫기 → `/`. 브라우저 뒤로 → 이전 화면.
2. 로그인: Life Wallet → F5 → (Account 왕복) → Life Wallet. 안심케어 → 반려동물 탭 → F5 → 반려동물 탭.
3. 진위확인 → F5 → 진위확인. 비로그인이면 로그인 안내 → 로그인 → 진위확인으로 복귀.
4. 모바일: 같은 1~2, 그리고 Android 뒤로 버튼이 화면을 닫고 홈으로(사이트를 떠나지 않음).
5. 안심케어를 메뉴로 열면 기본은 사람 탭(`/#care`), 반려동물 탭에서 F5일 때만 반려동물 탭 유지(`/#pets`).
6. 생활정보 → 축제·행사 → F5 → 축제·행사, ← → 생활정보.
7. `https://lotbiai.com/site-asset-version.json` = 이 branch 단독 배포라면 aset-12285db20119(Release Train에서 다른 branch와 합치면 train의 재계산 토큰).

## REMAINING_ISSUES

- 캘린더 월/날짜, 생활정보 상세 입력, 축제 상세, Life Wallet 잠금 해제 상태는 URL에 없어 새로고침 시 해당 화면의 기본 상태로 열림(기존 URL 계약이 없어 의도적으로 제외).
- 로그인 사용자의 새로고침은 기존 구조대로 Account handoff 왕복을 거침(그동안 "화면을 불러오고 있어요" 표시). 왕복 자체를 없애는 것은 범위 밖.
- 동작 변화: 화면이 열린 상태의 브라우저/Android 뒤로가기는 이제 사이트를 떠나지 않고 화면을 닫음(요구사항 7).
- 열린 페이지에서 라우트가 아닌 fragment를 입력하면 현재 화면 유지(#main-content 등 보호).
- site-review job timeout-minutes 8에 이 validator 약 2분 추가(로컬 107초).
