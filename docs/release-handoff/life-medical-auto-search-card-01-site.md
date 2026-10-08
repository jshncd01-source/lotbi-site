READY_FOR_DEPLOY=YES

# life-medical-auto-search-card-01-site — release handoff

TASK=LOTBI SITE P0 — 병원·약국·응급실 검색 UX 및 회전형 카드 최종 개선 (2026-10-08 삼성 인터넷 실사용 보고)
REPO=lotbi-site
FEATURE_BRANCH=feature/life-medical-auto-search-card-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote origin refs/heads/feature/life-medical-auto-search-card-01-site`)
REMOTE_FEATURE_SHA=same as FEATURE_SHA after push (checked with git ls-remote at push time)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=1eb38853adfdad294a6e9b27805ad78459712d6b (SITE-T33 키보드 P0). 시작 시 main e13c0dfd + 그때 gate 중이던 e003b26a 를 먼저 병합(2f78ebe3, 트리 = release/20261009-site-t33-work 6b45b9c2)하고 그 위에서 개발 → SITE-T33 GREEN 뒤 main 1eb38853 정상 merge(da0a350a). main 트리 = 2f78ebe3 트리라 결과 트리 변화 없음, diff(main, 결과) = diff(2f78ebe3, 71c552cb) 대조 확인.
CODE_SHA=da0a350a (merge of main 1eb38853; product commits 7500490a, 71c552cb)
ASSET_VERSION=aset-0de77382419c
PAIRED_CORE_BRANCH=feature/life-medical-auto-search-01-core READY d9012865 (한 문장 답변, 119 는 증상 메시지만)
DEPLOY_ORDER=SITE 먼저(또는 같은 시간대) → CORE. Site 단독(옛 Core)도 동작: 옛 Core 의 긴 답변 + 새 카드(안내가 잠시 겹침), 일반 응급실의 옛 CALL_119 는 큰 박스 대신 작은 119 버튼 하나로 보임. Core 만 먼저 나가면 옛 카드에 "전화로 확인" 줄이 없어 그 안내가 잠시 빠짐.
SUPERSEDES=feature/life-info-direct-chat-card-compaction-01-site 5e2ca2c5 (READY=NO, main 의존 대기) — 그 branch 의 생활정보 바로 전송·키보드 미노출(cf5a748f)을 이 branch 로 이식했고, 카드 압축 부분은 SITE-T30 이 이미 main 에 넣었다. 그 branch 는 따로 gate·배포하지 말 것.
MERGED_TO_MAIN=NO
DEPLOYED=NO
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
APP_CHANGE=NONE (App 은 Core 답변 문장 변경만 따라감)
USER_DECISION_NEEDED=NONE

## 무엇이 바뀌나

### 생활정보 → 병원·약국·응급실 (지시 2·3)
- 생활정보 메뉴: 병원·의원 / 약국 / **응급실(신규)** / 축제·행사 / 지역생활정보. 지역·찾는 조건 입력 화면과 "질문 준비하기" 삭제.
- 메뉴를 누르면 생활정보가 닫히고 `근처 병원 찾아줘` / `근처 약국 찾아줘` / `근처 응급실 찾아줘` 가 바로 전송된다(질문 1건, 요청 1건). 입력창은 비어 있고 포커스를 주지 않아 키보드가 열리지 않는다(입력창을 눌렀을 때만). 답변 후에도 이 질문에서는 입력창 자동 포커스 없음(`keepComposerClosed`, 데스크톱 포함).
- 위치: 기존 `site-life-location.js` 계약 재사용 — 위치 사용 켜짐 + 권한 허용이면 현재 위치, 아니면 저장 지역(캘린더 날씨 지역), 둘 다 없으면 보내지 않아 Core 가 지역을 묻는다. **권한 요청은 한 페이지에서 한 번만**(물었는데 위치를 못 받으면 같은 페이지의 다음 검색·필터는 다시 묻지 않음). 저장·전송 정책 변화 없음.
- 답변 중에 다시 누르면 기다렸다가 그 답변이 끝나면 자동 전송(다시 누를 필요 없음). 같은 탭 두 번(2.5초 안)은 한 번. 입력창에 첨부가 있으면 첨부와 섞이지 않게 입력창에만 넣고 안내.
- 지역생활정보 폼도 "롯비에게 물어보기"로 바로 전송.
- 뒤로가기·앞으로가기(생활정보 화면 복원)·새로고침으로 같은 질문이 다시 전송되지 않음(검사 고정).
- 자동 검색 실패: 기존 오류 표시·다시 시도 경로 그대로(Core 실패 문장은 "확인하지 못했어요 … 다시 물어봐 주세요").

### 회전형 의료 카드 (지시 6·7) — 병원·약국·응급실·일반 장소 공통 렌더러
- 휴대폰(≤760px): 가운데 카드가 가장 크고 양옆 카드 끝(약 20px)이 흐리게 보인다(투명도 .5, 링크 숨김). 화살표 없음(기존 결정 유지), 손가락 스와이프·옆 카드 끝 탭으로 회전, 280ms 회전 애니메이션(동작 줄이기 설정이면 없음). 다섯 곳을 펼치면 뒤쪽 카드는 앞 카드 뒤에 숨는다.
- 휴대폰에서는 카드 영역이 아바타 칸 아래까지 넓어진다(답변 글은 그대로): 320px 에서 가운데 카드 216px(이전 구조 그대로면 162px).
- 1/3·2/3·3/3, 처음 3곳, "다른 병원/약국/응급실 보기"(응급실은 이제 "다른 응급실 보기"), 카드 1장이면 위치 표시·옆 카드·끌기 이동 없음.
- 전화·지도: 카드 끝 44×44px 원형 버튼 2개, 22px 선 아이콘(전화기, 길찾기 화살표). 접근성 이름 `{기관명} 전화하기` / `{기관명} 길찾기 ({설정 지도앱})`. 전화 = `tel:`, 지도 = 설정의 기본 지도앱 딥링크(`buildDefaultMapHref`, 변경 없음).
- 카드 내용: 기관명, 주소, 거리, 등록 운영시간 줄("등록 시간상 운영 중 · 오늘 09:00~22:00"), 그리고 짧은 한 줄 "실제 운영(진료) 여부는 전화로 확인"(+ Core 가 알려 주면 "공휴일 미반영", "일부 기관만 확인"). 응급실: 확인된 병상(FRESH 보고만) + "수용 여부는 출발 전 전화로 확인". 24시간·영업·수용 가능 단정 없음.
- 약국 결과 아래 보조 조건: 지금 운영 중 · 야간 · 휴일 · 24시간 — 누르면 같은 지역으로 바로 다시 검색(키보드 없음).

### 119 (지시 5)
- 일반 "근처 응급실" 검색: 큰 119 박스·중복 문장 없음(Core 가 CALL_119 를 보내지 않음).
- 응급 증상 메시지(Core CALL_119): 답변 첫 문장의 119 안내 + 그 아래 작은 "119 전화" 버튼 하나(테두리·배경 박스 없음, 문장 반복 없음).

## 검증

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

## 배포 후 smoke 제안
1. 휴대폰(가능하면 삼성 인터넷) 생활정보 → 약국: 바로 전송, 키보드 안 열림, 답변 한 문장, 양옆 카드 끝 보임, 스와이프 1/3→2/3.
2. 응급실: 119 박스 없음. 대화에 "숨이 안 쉬어져요 근처 응급실" → 작은 119 전화 버튼 하나.
3. 전화·지도 아이콘: 전화 앱·설정 지도앱으로 넘어감.

## 관찰(범위 밖, 기존 기능)
- 긴 답변 기능의 "↓ 최신 답변" 떠 있는 버튼이 화면 아래쪽 카드의 전화 아이콘 위에 잠시 겹칠 수 있음(스크롤하면 사라짐, SITE-T33 기능).
