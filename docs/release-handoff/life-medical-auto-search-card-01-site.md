READY_FOR_DEPLOY=YES
SUPERSEDES=b1dfbece
MIGRATION=NO
DEPLOY_ORDER=SITE → CORE
USER_DECISION_NEEDED=NONE

# life-medical-auto-search-card-01-site — release handoff (재병합 02, main 2f1212ea)

TASK=LOTBI SITE P0 — 병원·약국·응급실 검색 UX 및 회전형 카드 최종 개선 — 최신 main 재병합(배포총괄방 CMD_SITE_LIFE_MEDICAL_AUTO_SEARCH_CARD_REMERGE_02, 2026-10-09 인수인계: 멈춘 Codex 방 → Claude 방 → 계정 전환으로 끊긴 Claude 방 → 이 방)
REPO=lotbi-site
FEATURE_BRANCH=feature/life-medical-auto-search-card-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote origin refs/heads/feature/life-medical-auto-search-card-01-site`)
REMOTE_FEATURE_SHA=same as FEATURE_SHA after push (checked with git ls-remote at push time)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=2f1212eae9a54d9ad080f21ce242dd4b8c814852 (SITE-T39d: Life Wallet 문구, 로그인 유지 02, 캘린더 주간 UX·날씨 출처, 음력 간결화)
MERGE_HISTORY=이전 READY b1dfbece(main 1eb38853 기준) → main fa6ed88d(SITE-T36) 정상 merge 948dd60d + 검사기 문구 89a2be05 → main 9e39edd0(SITE-T38c) 정상 merge ccfdb7c9 + 생활정보 클릭 처리·검사기 52c8af14·6fd9b112·fda0a3c3 → main 2f1212ea(SITE-T39d) 정상 merge dcdc923c + 토큰 3c344438
CODE_SHA=3c344438
ASSET_VERSION=aset-09775aeff9ad
PAIRED_CORE_BRANCH=feature/life-medical-auto-search-01-core READY 4f356a0e (SUPERSEDES 01dc8c5a, 코드 변경 없음 — 최신 core main 정상 merge만)
DEPLOY_ORDER_DETAIL=SITE 먼저(또는 같은 시간대) → CORE. Core 만 먼저 나가면 옛 Site 카드에 "전화로 확인" 줄이 없어 그 안내가 잠시 빠진다. Site 단독(옛 Core)은 동작: 옛 Core 의 긴 답변 + 새 카드(안내가 잠시 겹침).
MERGED_TO_MAIN=NO
DEPLOYED=NO
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
APP_CHANGE=NONE

## 재병합 02 — 충돌과 해소

### main 2f1212ea(SITE-T39d) merge dcdc923c
충돌 66개 파일. 61개는 asset 토큰(`?v=aset-…`)만 달라 main 쪽을 받고 토큰을 다시 계산(3c344438, `node scripts/asset_cache_version.mjs --write` → `--check` PASS). 나머지 5개는 import 줄만:
- `site-auth.js`(`redeemSiteHandoff`), `site-calendar-manager.js`(`lunarDateCompactLabel`), `site-continuity.js`(`adoptSiteSession`·`renewSiteSessionSilently`·`SITE_SESSION_RENEWAL_REQUEST_EVENT`), `site-conversation.js`(`registerSiteSessionAdopter`·`SITE_SESSION_RENEWAL_REQUEST_EVENT`) → main 쪽이 이 branch 쪽의 상위집합이라 main 줄을 받음.
- `site-consumer-sections.js` → main 은 토큰만 바꿨고 이 branch 는 `createEmergencyCallNotice` import 를 지웠다(의료 폼이 없어져 쓰는 곳 없음, 함수는 대화 카드에서 계속 사용). 이 branch 쪽을 받음.
- 자동 merge 된 양쪽 변경 파일 68개: 두 쪽이 추가한 줄이 결과에 모두 있는지 줄 단위로 대조 → 빠진 줄은 위 import 5줄(의도된 교체·삭제)뿐.
- `.github/workflows/site-review.yml`·`site-conversation.css`·`site-conversation.js` 는 자동 merge, 양쪽 추가 줄 누락 0.

### 이전 main 9e39edd0(SITE-T38c) merge ccfdb7c9 (앞 방, 로컬 → 이번에 함께 push)
실제 충돌 7개:

1. `site-consumer-sections.js`
   - 생활정보 메뉴 7개: 병원·의원 / 약국 / 응급실 / 축제·행사 / 온누리상품권 / 지역생활정보 / 유치원·학교(main 신규, 마지막 홀수 카드는 한 줄 전체 — site-life-education.css·site-life-onnuri.css 규칙 그대로).
   - 클릭 처리 한 곳에 모두: `if (disposed) return;` → `if (item.ask) onAsk(item.ask);`(의료 3개 바로 전송) → `else if (item.id === 'festivals') onFestival();` → `else item.id === 'onnuri' ? onOnnuri?.() : item.id === 'education' ? openEducation(item) : openLifeDetail(item);`. 이 모양은 세 검사기가 고정한 형태(branch 의 `if (item.ask) onAsk(item.ask);`, `validate_festival_nav_wiring_01` 의 축제 `else if`, main `validate_kindergarten_official_info_01` 의 `item.id === 'education' ? openEducation(item)`)를 모두 지키려고 고른 것(52c8af14·6fd9b112). 온누리 메뉴(`onOnnuri`, `brandSlot`)와 의료 바로 질문(`onAsk`, `item.ask`, `disposed` 확인)이 둘 다 동작.
   - **`onDraft` 확인 결과**: 이 branch 는 `onDraft` 를 지웠지만 main 의 유치원·학교 화면(KINDERGARTEN-OFFICIAL-INFO-01)이 `mountEducation({root: host, onDraft, accountId})` 로 쓴다. 그대로 합치면 유치원·학교를 누를 때 `onDraft` 미정의로 "유치원·학교 정보를 열지 못했습니다"가 뜬다. → `mountConsumerSection` 에 `onDraft` 를 다시 받고(유치원·학교 전용), `site-conversation.js` 에 main 의 `draft` 도우미와 `onDraft: text => { closeSurface(); draft(text); }` 를 되살렸다. 유치원·학교는 main 과 같은 "질문 준비하기 → 입력창에서 확인 후 전송"이고, 의료·지역생활정보 카드는 이 branch 대로 바로 전송(`onAsk`). `site-consumer-sections.js` 안에서 `onDraft` 를 쓰는 곳은 이 유치원·학교 연결 2곳뿐.
2. `site-conversation.js`: 위 `draft`/`onDraft` 복원(자동 merge 뒤 수동 추가). `onAsk` 경로(포커스 반납 없음·`askWithoutKeyboard`)는 그대로.
3. 검사기 3개 — 양쪽 검사 모두 유지, 기준 완화 없음:
   - `validate_consumer_sections_02`: 메뉴 7개·id 7개, 의료 3개 `ask`, 유치원·학교 예외(main), `onAsk` 바로 전송(branch) **그리고** `onDraft: text => { closeSurface(); draft(text); }`(main) 둘 다 검사.
   - `validate_life_info_cleanup_final_01`: 메뉴 id 7개(`emergency` + `education`).
   - `validate_life_medical_category_entry_01`: 메뉴 7개, 의료 질문 3개, `festivals·local·onnuri·education` 유지, 브라우저 열기 대기 6→7개, 머리 주석·통과 문구 갱신. main 쪽 옛 의료 폼 단계(칩·초안)는 이 branch 가 이미 바로 전송으로 바꾼 부분이라 branch 쪽을 받음(main 이 그 블록에서 바꾼 것은 카드 수 5→6 뿐).
4. `.github/workflows/site-review.yml`: 두 단계 모두(`validate_life_medical_auto_search_card_01` + `validate_kindergarten_official_info_01`).
5. `index.html`, `auth/callback/index.html`: main 쪽(`site-life-education.css` 추가) + 토큰.

#### 검사기에서 바꾼 기준 (설명 필요 항목)
- `validate_life_medical_category_entry_01`·`validate_life_medical_auto_search_card_01` 의 "`onDraft`·초안 경로 없음" 검사: 유치원·학교 초안 연결 **정확히 2곳**(`{section, root, onAsk, onDraft, onFestival,` / `mountEducation({root: host, onDraft, accountId})`)이 각각 한 번씩 있는지 먼저 확인한 뒤 그 둘만 빼고 **같은 정규식 그대로** 검사한다. 의료·지역생활정보 등 다른 카드에 `onDraft` 가 생기면 그대로 FAIL.
- `validate_life_medical_auto_search_card_01` 의 "옛 초안 안내 문구 없음": 유치원·학교가 main 문구('요청을 입력창에 넣었어요. 내용을 확인한 뒤 전송하세요.')를 쓰므로 → 그 문구 정확히 1곳, `draft(text)` 호출 1곳, 그 호출이 `onDraft` 연결, `onAsk` 처리기 안에는 `draft(`·초안 문구 없음·`askWithoutKeyboard(text)` 있음으로 바꿨다. 생활정보 카드가 초안으로 돌아가면 FAIL.
- 같은 검사기 메뉴 목록 7개·브라우저 대기 7개 두 곳(생활정보 열기, 앞으로가기 복원 — fda0a3c3). main 의 유치원·학교가 자동 merge 로 들어와 생긴 의미 충돌이라 텍스트 충돌로는 안 보였다.
- `onAsk` 처리기 검사는 `mounted = mountConsumerSection({` 뒤에서 찾는다(파일 앞쪽 학교 급식 카드의 다른 `onAsk` 를 잡지 않게, 52c8af14).

### main 대비 실제 변경 파일 대조
diff(main 2f1212ea → 3c344438) 에서 토큰을 가린 실제 변경 = diff(main 9e39edd0 → fda0a3c3) 와 **같은 24개 파일, 같은 줄**(다른 것은 main 이 바꾼 import 줄의 토큰 차이뿐). main 의 Life Wallet 문구·로그인 유지 02·캘린더 주간 UX·음력 변경 누락 없음.

## 검증 (재병합 02)

TEST_STATUS=Windows 11 로컬, 트리 3c344438(= 이 문서 커밋의 코드), `CHROME_BIN=C:/Program Files/Google/Chrome/Application/chrome.exe`, 병렬 4. 같은 PC 에서 다른 방 작업과 CPU 공유.
- 전체 `scripts/validate_*` + `asset_cache_version.mjs --check` + `sync_footer_business_info.py --check` + `emit_social_signup_legal_manifest.py` = **249개 중 247 PASS / 2 FAIL**.
- 의료·생활정보 관련 PASS: `validate_life_medical_auto_search_card_01`(88s), `validate_life_medical_category_entry_01`, `validate_life_info_cleanup_final_01`, `validate_consumer_sections_02`, `validate_onnuri_merchant_search_01`, `validate_kindergarten_official_info_01`, `validate_festival_nav_wiring_01`. main 2f1212ea 신규 검사기(`validate_auth_session_continuity_p0_02`, `validate_calendar_lunar_compact_layout_01`, `validate_calendar_mobile_week_ux_weather_01`, `validate_document_cache_policy_01.py`, `validate_life_wallet_upright_print_01`)도 PASS.
- `asset_cache_version.mjs --check` PASS (aset-09775aeff9ad, targets 133, refs 160).
NEW_FAILURES=0
EXISTING_WINDOWS_FAILURES=2 — `validate_mobile_footer_legal_sheet_01`(761px: mobile disclosure leaked into desktop, 'block' ≠ 'none'), `validate_site_avatar_fallback_runtime`(assert false). main 2f1212ea 원본(`git archive` 로 푼 폴더)에서 단독 실행해도 같은 메시지로 FAIL, 이 branch 단독 실행도 같음. 이전 READY·앞 방 회귀에서도 같은 2개.

### 작업본 줄바꿈 주의 (회귀 1차 무효 처리)
- 이 worktree 의 공용 git dir(`deployment-rail-01/lotbi-site/.git`) config 에 `core.autocrlf` 줄이 없어 Git 시스템 기본값 `true` 가 적용된다. 그래서 merge 때 새로 꺼낸 98개 파일이 **작업본에서만** CRLF 가 됐고, `\n` 을 기대하는 검사기 2개(`validate_conversation_calendar_card_02`, `validate_image_attachment_thumbnail_01`)가 1차 회귀에서 거짓 FAIL 했다.
- 커밋된 blob 은 LF 그대로다(main 과 같은 방식). 이 worktree 작업본만 `git -c core.autocrlf=false checkout` 으로 blob 그대로 다시 꺼냄 → 추적 파일 645개 작업본 = blob 바이트 일치 확인 → 위 2차 전체 회귀에서 두 검사기 PASS. 공용 config 는 다른 방도 쓰므로 고치지 않았다.

## 충돌 예고
- `feature/my-child-school-01-site`(271cb2dc, 내 아이 학교)도 생활정보 카드 목록·같은 검사기·`site-review.yml`을 고친다. 둘 중 나중에 main 에 들어가는 쪽이 다시 merge 한다. 이 branch 는 main 2f1212ea 기준으로만 맞췄다.

---

(아래는 이전 READY b1dfbece 문서 본문 — 기능 설명은 그대로 유효. 단 생활정보 메뉴는 이제 온누리상품권·유치원·학교 포함 7개)

## [이전 READY b1dfbece] 무엇이 바뀌나

#### 생활정보 → 병원·약국·응급실 (지시 2·3)
- 생활정보 메뉴: 병원·의원 / 약국 / **응급실(신규)** / 축제·행사 / 지역생활정보. 지역·찾는 조건 입력 화면과 "질문 준비하기" 삭제.
- 메뉴를 누르면 생활정보가 닫히고 `근처 병원 찾아줘` / `근처 약국 찾아줘` / `근처 응급실 찾아줘` 가 바로 전송된다(질문 1건, 요청 1건). 입력창은 비어 있고 포커스를 주지 않아 키보드가 열리지 않는다(입력창을 눌렀을 때만). 답변 후에도 이 질문에서는 입력창 자동 포커스 없음(`keepComposerClosed`, 데스크톱 포함).
- 위치: 기존 `site-life-location.js` 계약 재사용 — 위치 사용 켜짐 + 권한 허용이면 현재 위치, 아니면 저장 지역(캘린더 날씨 지역), 둘 다 없으면 보내지 않아 Core 가 지역을 묻는다. **권한 요청은 한 페이지에서 한 번만**(물었는데 위치를 못 받으면 같은 페이지의 다음 검색·필터는 다시 묻지 않음). 저장·전송 정책 변화 없음.
- 답변 중에 다시 누르면 기다렸다가 그 답변이 끝나면 자동 전송(다시 누를 필요 없음). 같은 탭 두 번(2.5초 안)은 한 번. 입력창에 첨부가 있으면 첨부와 섞이지 않게 입력창에만 넣고 안내.
- 지역생활정보 폼도 "롯비에게 물어보기"로 바로 전송.
- 뒤로가기·앞으로가기(생활정보 화면 복원)·새로고침으로 같은 질문이 다시 전송되지 않음(검사 고정).
- 자동 검색 실패: 기존 오류 표시·다시 시도 경로 그대로(Core 실패 문장은 "확인하지 못했어요 … 다시 물어봐 주세요").

#### 회전형 의료 카드 (지시 6·7) — 병원·약국·응급실·일반 장소 공통 렌더러
- 휴대폰(≤760px): 가운데 카드가 가장 크고 양옆 카드 끝(약 20px)이 흐리게 보인다(투명도 .5, 링크 숨김). 화살표 없음(기존 결정 유지), 손가락 스와이프·옆 카드 끝 탭으로 회전, 280ms 회전 애니메이션(동작 줄이기 설정이면 없음). 다섯 곳을 펼치면 뒤쪽 카드는 앞 카드 뒤에 숨는다.
- 휴대폰에서는 카드 영역이 아바타 칸 아래까지 넓어진다(답변 글은 그대로): 320px 에서 가운데 카드 216px(이전 구조 그대로면 162px).
- 1/3·2/3·3/3, 처음 3곳, "다른 병원/약국/응급실 보기"(응급실은 이제 "다른 응급실 보기"), 카드 1장이면 위치 표시·옆 카드·끌기 이동 없음.
- 전화·지도: 카드 끝 44×44px 원형 버튼 2개, 22px 선 아이콘(전화기, 길찾기 화살표). 접근성 이름 `{기관명} 전화하기` / `{기관명} 길찾기 ({설정 지도앱})`. 전화 = `tel:`, 지도 = 설정의 기본 지도앱 딥링크(`buildDefaultMapHref`, 변경 없음).
- 카드 내용: 기관명, 주소, 거리, 등록 운영시간 줄("등록 시간상 운영 중 · 오늘 09:00~22:00"), 그리고 짧은 한 줄 "실제 운영(진료) 여부는 전화로 확인"(+ Core 가 알려 주면 "공휴일 미반영", "일부 기관만 확인"). 응급실: 확인된 병상(FRESH 보고만) + "수용 여부는 출발 전 전화로 확인". 24시간·영업·수용 가능 단정 없음.
- 약국 결과 아래 보조 조건: 지금 운영 중 · 야간 · 휴일 · 24시간 — 누르면 같은 지역으로 바로 다시 검색(키보드 없음).

#### 119 (지시 5)
- 일반 "근처 응급실" 검색: 큰 119 박스·중복 문장 없음(Core 가 CALL_119 를 보내지 않음).
- 응급 증상 메시지(Core CALL_119): 답변 첫 문장의 119 안내 + 그 아래 작은 "119 전화" 버튼 하나(테두리·배경 박스 없음, 문장 반복 없음).

## [이전 READY b1dfbece] 검증

TEST_STATUS=Windows 11, Chrome headless(`CHROME_BIN=C:/Program Files/Google/Chrome/Application/chrome.exe`), LF 체크아웃.
- 전체 scripts/validate_* 230개, 트리 7500490a: 226 PASS / 4 FAIL. (a) validate_message_share_actions_01·validate_rich_product_cards_01 = 새 SVG 코드의 `http://` 네임스페이스 문자열 → 71c552cb 에서 기존 `join('/')` 방식으로 고쳐 PASS. (b) validate_mobile_footer_legal_sheet_01("761px: mobile disclosure leaked into desktop")·validate_site_avatar_fallback_runtime = 기준선 2f78ebe3(내 변경 전)에서도 같은 메시지로 FAIL — 기존 Windows RED.
- 최종 트리 71c552cb: 정적 133/133 PASS + 브라우저 8개 PASS(신규 validate_life_medical_auto_search_card_01, life_medical_category_entry_01, chat_mobile_keyboard_dismiss_01, place_medical_card_ux_final_01, site_refresh_route_restore_01, life_info_cleanup_final_01, place_card_naver_search_click_01, samsung_composer_keyboard_01). validate_place_card_compact_01 은 python3 http.server 를 써서 이 PC 에서 그대로는 못 돌림 → 서버 줄만 node 로 바꾼 저장소 밖 사본으로 PASS(Linux gate 는 원본).
- main 1eb38853 merge(da0a350a)는 트리 동일이라 재실행 불필요.
NEW_FAILURES=0
NEW_VALIDATOR=scripts/validate_life_medical_auto_search_card_01.mjs (workflow 등록). 삼성 인터넷 UA 320x700·412x915, Android Chrome 360x780, iPhone UA 375x812·390x844(다크), PC 1280x900(다크). 실제 터치/마우스: 메뉴 탭 → 질문 1건·입력창 비움·포커스 이벤트 0·키보드 클래스 없음, 한 문장 답변, 가운데 카드 최대·양옆 끝 10~40px·투명도 ≥.3, 스와이프 2/3→3/3→1/3(순환)·반대 방향, 전화 tel:·지도 링크, 운영 확인 줄·과장 문구 없음, 약국 필터 4개(야간 → 바로 전송), 병원·응급실 같은 카드, 일반 응급실 119 박스 0, "다른 응급실 보기" → 4/5, 뒤로/앞으로·새로고침 재전송 0·메시지 중복 0, 증상 메시지 119 버튼 1개·박스 없음·119 한 번, 카드 1장 위치 표시 없음·끌어도 안 움직임, 위치 허용 → BROWSER_CURRENT / 거부+저장 지역 → SAVED_REGION / 둘 다 없음 → 미전송, 권한 요청 페이지당 1회(정적), 라이트·다크 버튼 대비, 가로 스크롤 0.
CHANGED_TEST_EXPECTATIONS (사용자 지시로 바뀐 동작 — 단정 삭제가 아니라 새 동작으로 교체):
- validate_life_medical_category_entry_01: 폼·칩·문장 규칙·입력창 초안 → 메뉴 5개, 누르면 바로 전송·입력창 비움·포커스 없음·위치 거부 시 미전송, 지역생활정보도 바로 전송. 데스크톱 2열에서 5개라 "빈 칸 없음" → "줄을 순서대로 채우고 마지막 줄만 덜 찰 수 있음".
- validate_consumer_sections_02 / consumer_detail_system_01 / life_detail_design_01 / festival_nav_wiring_01: 메뉴 5개·`ask`·`onAsk`·"롯비에게 물어보기"(옛 "질문 준비하기"·"다음 화면에서 질문을 확인한 뒤 보내세요"는 없어야 함).
- validate_life_info_cleanup_final_01: 생활정보 메뉴 id 에 emergency 추가.
- validate_site_refresh_route_restore_01: "M 입력창 초안: 질문이 입력창에서 기다림" → "M 질문 바로 전송: 입력창 비어 있고 대화에 질문이 있음"(뒤로·앞으로 단계·URL·history 단정은 그대로).
- validate_life_night_medical_01: 카드 줄에 확인 한 줄 추가(공휴일·일부 기관 포함), 119 notice 는 링크 하나·이름 "119에 전화하기", 렌더러 정규식.
- validate_place_medical_card_ux_final_01: 휴대폰 옆 카드 "투명도 0·탭 불가" → "가운데 카드와 겹침 0 유지, 끝 10~40px·투명도 ≥.3 보임, 뒤쪽 카드는 0".
- validate_place_card_compact_01: 버튼 "카드 절반 너비" → "48px 이하 원형", PNG 아이콘 경로 → 20~24px SVG, 옆 카드 투명도 ≤.2 → .3~.6, 옆 카드 버튼 '보임' 판정에 visibility 포함.
- validate_naver_maps_navigation_01: `addActionIcon(mapAction, mapPresentation.icon)` → `'route'` + 라벨에 설정 지도앱 이름.
- 렌더러 위치 문자열 `const createPlaceCardRail = (placeValue, placeOptions = {}) => {` 로 갱신: life_animal_hospital_01, naver_maps_navigation_01, place_card_cross_platform_01, place_card_naver_search_click_01, place_medical_card_ux_final_01, life_night_medical_01.
- 키보드 P0 계약(requestAssistant 안 `returnComposerFocusAfterTurn()` 4곳·`if (!composerUsesSoftwareKeyboard()) prompt.focus();`)은 그대로 지킴(조건만 앞에 붙임) — validate_chat_mobile_keyboard_dismiss_01 무변경 PASS.

DEVICE=NOT VERIFIED — Samsung Internet / Android Chrome / iPhone Safari 실기기 확인 없음. 위 결과는 Chrome headless 화면 크기·UA·터치 에뮬레이션.
LIVE_CORE=NOT VERIFIED — 실제 Core·국립중앙의료원 응답 화면은 배포 후 smoke 필요.

## [이전 READY b1dfbece] 배포 후 smoke 제안
1. 휴대폰(가능하면 삼성 인터넷) 생활정보 → 약국: 바로 전송, 키보드 안 열림, 답변 한 문장, 양옆 카드 끝 보임, 스와이프 1/3→2/3.
2. 응급실: 119 박스 없음. 대화에 "숨이 안 쉬어져요 근처 응급실" → 작은 119 전화 버튼 하나.
3. 전화·지도 아이콘: 전화 앱·설정 지도앱으로 넘어감.

## [이전 READY b1dfbece] 관찰(범위 밖, 기존 기능)
- 긴 답변 기능의 "↓ 최신 답변" 떠 있는 버튼이 화면 아래쪽 카드의 전화 아이콘 위에 잠시 겹칠 수 있음(스크롤하면 사라짐, SITE-T33 기능).
