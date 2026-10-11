READY_FOR_DEPLOY=YES

# SITE-CONVERSATION-DESIGN-01 — 최신 main 통합 재READY

- 작성 시각(KST): 2026-10-12T00:03:36+09:00
- 현재 체계: 롯비 MASTER / 총괄관리방. 배포 실행은 총괄 확인 후 별도 배포방 담당.
- 저장소: lotbi-site / Ncloud ssh://lotbi-ncloud-git/srv/git/repositories/lotbi-site.git
- 대표 feature: `feature/site-conversation-design-01-site`
- 기준 Ncloud main: `9147419fb079e6452ff26d82c52a1b8f1dca36e4`
- 검증된 통합 코드 commit: `669ec0697a50048d35b00198cd97f23869c3a560`
- 기존 제출 HEAD: `bc6ffc7eabdf7900bb4acd4c9125642f82efca19`; 선행 접수 장소 카드: `c00a4717585c76b40fbc894261cf45451de6e997`
- 최종 문서 포함 HEAD·Ncloud push/readback은 외부 `outputs/READY-재검증-대화화면.md`에 기록한다.

## 통합 범위·보존

최신 main을 기존 feature에 정상 merge했다. 신규 디자인은 만들지 않았다. 확정 장소 카드 렌더러·회전 CSS·후속 대화 CSS는 이전 제출본과 동일하다. 장소 렌더러를 제외한 전체 site-conversation.js는 최신 main과 캐시 토큰 외에 동일하며 캘린더 등 공통 변경을 보존한다. index와 공통 색 토큰 역시 최신 main 그대로다. 메뉴 이름을 임의로 변경하지 않았다. 다른 담당 기능·공식 로고 및 캐릭터 자산·약관을 덮어쓰지 않았다.

- 발생 충돌 88개: 캐시 관련 87개는 최신 main 기능 원문 보존, 실제 양쪽 코드 변경은 site-conversation.js 1개.
- site-conversation.js는 캐시 토큰을 정규화한 3-way 통합으로 양쪽 코드를 보존했다. CSS와 workflow는 정상 자동 통합했다.
- 최신 main 대비 범위 밖 차이 87개는 캐시 갱신뿐이다. `재READY-충돌분류.json`, `재READY-보존검증.json`에 근거를 보존했다.
- 캐시: `aset-2422a7f21207`, 169 targets / 206 refs, check PASS.
- 기존 새 검사 2개는 .github/workflows/site-review.yml에 등록된 상태로 보존했다. 실행 직전 mkdtemp Chrome 프로필 조건 유지.

## 검사기 변경과 실패 처리

기존 검사기 6개의 동등 강도 변경 목록·이유는 아래 이전 제출 기록에 보존했다. 이번 추가 변경은 `validate_place_medical_card_ux_final_01.mjs`의 회전 완료 대기뿐이다. 고정 450ms 뒤 마지막 전환 프레임의 opacity `8.57154e-9`가 관찰돼 기존 exact 0 assertion이 실패했다. 450ms 대기 후 실제 카드 CSS animation이 종료됐는지 최대 2초 이내 확인하도록 보강했다. opacity 0, 중앙 위치·가림·전화·지도·순환·점·키보드 assertion 및 기존 허용 오차는 그대로다. 제품 카드 JS/CSS는 수정하지 않았다. 최초 실패 로그도 삭제하지 않았다.

## 이번 재검증

Windows 실제 headless Chrome + 로컬 fixture 결과이며 운영 API/실기기 성공으로 확대하지 않는다.

| 검사 | 결과·근거 |
|---|---|
| 대화 선택·입력·가독성, ②③④, 360/1280 × 라이트/다크 | PASS / 재READY-대화검사.json |
| 회전·점·키보드·동작 축소, 20조합 | PASS / 재READY-회전검사.txt |
| 기존 장소 검사 6개 | PASS / 재READY-기존장소검사.txt + 재READY-기존장소검사-완료.txt |
| 3가지 모바일 키보드·PC 입력창 | PASS / 재READY-입력창검사.txt |
| 긴 답변·스트리밍·읽기 위치·키보드 | PASS / 재READY-긴답변검사.txt |
| 읽어주기 7조건 | PASS / 재READY-읽어주기검사.txt |
| sidebar·관리·Markdown·전송·공유·첨부·테마 | PASS / 재READY-공통회귀검사.txt |
| 최신 main 캘린더 액션·게스트·반복 일정 로그인·avatar 계약 | PASS / 재READY-공통회귀검사.txt |
| 약관 잠금·보안 경계 | PASS / 재READY-하드닝검사.txt |
| Site 정적·build env 5개·theme bootstrap·JS 문법·범위 diff check | PASS |
| 확정 디자인·최신 main 공통 기능·캐시 전용 차이 | PASS / 재READY-보존검증.json |

새 main 통합 화면은 reREADY-conversation/ 20장과 reREADY-place/ 20장에 보존했다. 360 라이트 기록·1280 다크 긴 답변 및 360 다크/1280 라이트 장소 실제 PNG를 육안 확인했다. 기존 전후 24쌍(48장)과 첨부 확정 원본은 유지한다.

## 미검증·다음 단계

- FEATURE_READY=YES / MAIN_MERGED_BY_THIS_ROOM=NO / PRODUCTION_DEPLOYED_BY_THIS_ROOM=NO.
- trusted Linux gate, Android Chrome·Samsung Internet·iPhone Safari 실기기, 화면 읽기 실제 음성, 운영 API·전화/지도 연결, Production served SHA·배포 ID·digest: NOT_TESTED / UNVERIFIED.
- 사용자 장소 카드 접수 기록 있음. 후속 대화 디자인에 대한 사용자의 별도 브라우저 최종 승인 기록은 UNVERIFIED. 재READY 실행·총괄방 전달은 이번 사용자 직접 승인에 근거한다.
- Production DB·Secret·DNS·환경변수·LIVE MONEY·소셜 공개·유료 인프라 변경 없음.
- 다른 후보가 먼저 main에 반영되면 fresh main 정상 merge와 영향을 받는 검사 후 새로운 exact HEAD로 판단해야 한다.
- 본 문서는 feature 준비 완료이며 배포 완료를 뜻하지 않는다. 총괄관리방 확인 → 배포방 trusted gate → 정상 main 병합 → Production·실기기 검증 순서다.

## 이전 제출 기록 — 당시 기준의 보존 자료

아래 SHA/main/담당·배포 상태는 과거 기록이다. 현행 값은 위 재READY 항목을 따른다.

READY_FOR_DEPLOY=YES

# SITE-CONVERSATION-DESIGN-01 — 전체 대화 화면 후속 READY

- 상태: IMPLEMENTED / READY. 배포총괄: Claude.
- 저장소: lotbi-site, Ncloud `ssh://lotbi-ncloud-git/srv/git/repositories/lotbi-site.git`.
- 브랜치: `feature/site-conversation-design-01-site`.
- 검증·push·원격 readback 일치 코드 SHA: `c522c84d7b681a48e9a3afbf2f2bbfcb81cac6f7`.
- 기준 최신 Ncloud main: `b09f6e4d21096a4f897d5ba82b958fc5dc384d35`.
- 선행 장소 카드 접수 SHA: `c00a4717585c76b40fbc894261cf45451de6e997`.
- 이 READY 문서만 추가한 최종 제출 HEAD는 외부 `outputs/READY-대화화면.md`에 기록한다.

## 이번 범위와 보존

사용자의 후속 실행 요청에 따라 첨부 명령문 3번 전체 대화 화면과 시나리오 ②③④, 전후 증거를 완성했다. 첨부 문서의 지시를 사용자 요청과 구분하며, 이번 실행 권한은 후속 사용자 요청에 근거한다.

- 기존 `site-conversation.css` 끝에 대화 전용 블록을 추가했다. 회색 배경·흰 답변 면·문단/목록/코드 간격, 답변과 도구 사이 12px 여백, 입력창 경계·포커스·비활성 전송 표현을 정리했다.
- 대화 기록의 현재 선택은 배경·왼쪽 표시·글자 대비로 구분한다. 제목은 더보기 영역과 8px 이상 떨어지며, 기록/더보기 조작은 44px 이상이다.
- 공통 색 토큰을 그대로 재사용한다. 새 CSS 파일·새 테마 동기화·새 서비스 노출 없음.
- 장소 렌더러를 포함한 **전체 `site-conversation.js`는 c00a4717과 캐시 토큰 외에 동일**하다. 기존 전체 CSS도 그대로 두고 새 블록만 추가했다. 장소 카드의 회전·원근·점·전화/지도·검색 계약은 보존한다.
- `index.html`은 최신 main과 캐시 토큰 외에 동일하다. 메뉴 이름·공식 자산·법적/주의 고지 원문을 유지한다. T57a/T57b/가족 지킴이 담당의 기능을 수정하지 않는다.
- 주요 변경: `site-conversation.css`, `.github/workflows/site-review.yml`, 새 `scripts/validate_conversation_design_01.mjs`, 기존 `scripts/validate_chat_read_aloud_restore_browser_01.mjs`. 그 외 88개 파일은 필수 캐시 토큰 갱신뿐이다. 외부 범위 검증 JSON에 목록과 보존 검증을 기록했다.
- 기존 동일 브랜치·격리 작업 폴더를 이어 사용했다. 다른 owner의 미커밋 변경을 수정·복사·삭제하지 않았다.

## 새 검사와 이번에 바꾼 검사

- 새 `validate_conversation_design_01.mjs`를 `.github/workflows/site-review.yml`에 등록했다. 실제 index·대화 런타임에 로컬 응답을 제공하고 360×780 / 1280×780 × 라이트/다크 4조합을 검사한다.
- 기록의 현재 표시·대비 4.5:1·제목/더보기 간격·관리 메뉴 보존·키보드 복원, 빈 전송 비활성·실제 입력·Shift+Enter·Enter 1회 전송을 검증한다.
- 목록/표/코드/출처 링크·가로 넘침 0·도구 44px·답변 소속/복사 원문 일치·후속 질문, 접근성 트리·Tab·테마 전환 선택 보존을 검증한다.
- 장소 응답을 선택한 뒤 다른 대화로 이동하면 카드가 제거되고, 다시 열면 첫 카드로 초기화되는지 검증한다. 모바일 실제 터치로 세로 읽기 이동 85px, 카드 선택 인덱스 4 유지까지 확인했다.
- 새 검사 프로필은 Chrome 실행 직전 `fs.mkdtempSync`로 생성한다. 기록/답변의 JavaScript 오류 및 미처리 rejection은 0개다.
- 기존 `validate_chat_read_aloud_restore_browser_01.mjs`에는 각 실행 직전 mkdtemp 프로필 생성·종료 후 정리만 추가했다. Windows에서 기본 프로필을 공유하던 실행의 마지막 모듈 로딩 실패를 계기로 격리를 보강했다. 기존 음성·중단·네트워크 금지·대비·배치 assertion/허용 오차를 변경하지 않았고, 7개 조건 전부 최종 PASS다.
- 선행 장소 카드 검사기 6개의 동등 강도 변경은 그대로 유지한다. 다음 목록은 c00a4717의 변경 이유 기록이며 이번 후속 작업에서 다시 완화하거나 변경하지 않았다.

## 기존 검사기 변경 목록과 이유

검사 삭제·skip·허용 오차 확대는 하지 않았다. 새 점 버튼과 이전의 결과 더보기 버튼을 분리해 센다. 더보기 버튼 금지는 유지하고, 점 버튼의 개수·선택·이름·포커스·터치 크기는 별도로 엄격하게 검사한다.

| 검사기 | 바꾼 계약과 이유 | 보존·보강한 검증 |
|---|---|---|
| `validate_place_card_carousel_no_drift_01.mjs` | PC 화살표 클릭을 실제 마우스 드래그로 변경. 새 검사기가 동일한 실제 페이지·로컬 응답·브라우저 실행 도구를 재사용하도록 export | 기존 전 결과 순환·역방향·옆 카드·방향키·Home/End·scrollIntoView·scrollLeft=0·중앙 오차 1px·가로 넘침·외부 링크 금지 유지. 대기만 400ms 전환 종료 후인 450ms로 변경 |
| `validate_place_card_naver_search_click_01.mjs` | 화살표 존재 전제를 DOM 부재 검사와 양방향 실제 드래그로 대체 | 카드 본문 네이버 검색, 전화·지도 독립 실행, 외부 탭 대상, 드래그 후 오클릭 금지, 옆 카드 선택, Enter/Tab·방향키, 사진·레이아웃 계약 유지 |
| `validate_place_card_compact_01.mjs` | 넓은 화면 옆 카드 숨김을 보이는 옆 카드·선택 가능 계약으로 대체. Chrome 프로필을 실행 직전 mkdtemp로 생성 | 44px 전화·지도, 화면/레일 안의 중앙 카드, 검증 사진 보존·사진 없는 카드 공간 제거, 지도 제공자 네 가지·전화·접근성 이름·옆 카드 링크 포커스 금지 유지. Windows 브라우저 탐색도 지원 |
| `validate_place_medical_card_ux_final_01.mjs` | PC 단일 표시·화살표 위치/활성 검사를 화살표 DOM 0개, 앞/뒤 카드 구분, 점 버튼으로 대체 | 모든 점을 실제 터치/클릭으로 선택해 이름·인덱스·순서·지도 대상 확인. 44px 점 버튼·현재점 하나·이름·포커스·중앙과 비겹침·범위 내 옆 카드 노출 검사. 기존 순환·기관 중복 제거·사진·전화·지도·고지 계약 유지 |
| `validate_life_medical_auto_search_card_01.mjs` | PC 화살표/옆 카드 숨김을 화살표 없음·앞 카드 노출·중앙 비겹침으로 대체 | 기존 전체 결과 수, 질문·필터·응급 안내·전화·지도·모바일 크기·단일 결과 동작 보존 |
| `validate_life_direct_chat_card_compaction_01.mjs` | 화살표로 전 결과 순회하던 부분을 점 버튼 선택으로 변경. 가림 검사의 대상을 화살표에서 실제 점 버튼으로 변경 | 모든 카드 사진/무사진·텍스트 잘림·44px 링크·정확한 전화/지도 대상·설정 앱·질문 1회·키보드·뒤로/새로고침·다크 대비 유지. 점 버튼이 글자/전화/지도 아이콘을 가리지 않는지 검사 |

## 로컬 검증

Windows 실제 headless Chrome에서 로컬 테스트 응답으로 검사했다. 모바일은 viewport/키보드 에뮬레이션이며 실기기가 아니다.

| 검사 | 결과 |
|---|---|
| 새 대화 화면 검사, 4조합 / 시나리오 ②③④ | PASS |
| 장소 회전 검사, 360/1280·라이트/다크·0/1/2/5/12 입력 20조합 | PASS; 12 입력은 기존 계약대로 5개 |
| 기존 긴 답변 스크롤 앵커, 375/390/1280·스트리밍·완료·키보드 | PASS |
| 기존 읽어주기 390/320/375/1280·로컬/인터넷/없음/미지원 음성 | PASS |
| 기존 모바일 입력창 키보드 배치, 3가지 키보드·접힘 화면·PC | PASS |
| 기존 대화 메시지 긴 글/코드/접기 검사 | PASS |
| 기존 sidebar·관리·Markdown·composer·공유·첨부 계약 검사 | PASS |
| consumer theme sync / theme token / theme bootstrap | PASS |
| asset cache `--write` 후 `--check` | PASS, `aset-1315062223f4`, 169 targets / 206 refs |
| Site 정적 검사·build env 계약 5개·문법·diff check | PASS |
| 전체 JS/색 토큰/메뉴/기존 CSS 보존·캐시 전용 파일 검증 | PASS |

선행 T56 장소 카드 기존 6개 검사는 c00a4717에서 PASS였으며 이번에는 검사 내용이 그대로다. 이번 전체 스타일 상태에서 새 회전 20조합과 대화 사이 카드 복원/세로 제스처를 다시 PASS했다.

## 시나리오 ②③④

각 4개 화면 조합에서 다음을 끝까지 수행했다. 모두 테스트 데이터만 사용했고 막힌 지점은 없다.

| 시나리오·시작 상태 | 행동·조작 수 | 예상 및 실제 결과·증거 |
|---|---|---|
| ② 테스트 대화 두 개, 긴 답변 대화 선택 | 관리 메뉴 열기/닫기 각 1회, 기록 선택 Enter 2회, 모바일 메뉴 열기 2회, 이후 장소 점 선택 1회·기록 이동 2회 | 선택 하나·실제 제목·현재 대비, 짧은/긴 답변 정확한 복원. 다른 대화에 카드 없음, 장소 대화 재진입 시 인덱스 0. 기록/짧은 답변 전후 PNG·검사 JSON |
| ③ 긴 답변과 빈 입력 | 답변 끝 스크롤, 복사 1회, 후속 입력 1회, Shift+Enter 1회·Enter 1회; 모바일 카드 위 세로 터치 1회 | 목록 3개·표 1개·코드 1개·출처 링크 렌더링, 가로 넘침 없음. 복사 원문은 해당 긴 답변 전체. 줄바꿈은 전송하지 않고 Enter는 1회 전송하며 다시 빈 입력 비활성. 세로 읽기는 85px 이동하고 카드 인덱스 유지. long-start/end·input PNG 및 JSON |
| ④ 기록/도구의 키보드 포커스 | 기록 Enter 선택 2회 이상·도구 Tab 1회·테마 전환 왕복 | 이름 있는 조작, 접근성 트리에 복사 도구 노출, 테마 전환해도 대화 선택 유지. 별도 회전 검사에서 모든 점·방향키/Home/End/Enter·reduced motion 선택 PASS. 새 JSON + 회전 로그 |

화면 읽기 프로그램의 실제 음성 안내와 Android/iPhone 실기기 검사를 위 접근성 트리 검사로 대체했다고 주장하지 않는다.

## 전후 화면과 동작 증거

외부 결과물 루트: `C:/Users/jshnc/Documents/Codex/2026-10-11/1-t56-1-ready-github-workflows/outputs/`.

- `대화-전후비교.html`: 24쌍 비교. 360×780·1280×780 × light/dark × short/history/long-start/long-end/input/place.
- 각 경로: `conversation-before/{360|1280}x780-{light|dark}-{short|history|long-start|long-end|input|place}.png`와 같은 이름의 `conversation-after/` PNG.
- 대화 변경 전은 c00a4717의 CSS를 Git에서 복원한 별도 로컬 fixture로 캡처했다. index와 런타임은 캐시 토큰 외에 동일하며, 전후 메시지·조작도 동일하다. 운영 화면이 아니다.
- 장소 변경 전은 c00a4717의 `evidence/*-5→5.png`, 변경 후는 이번 `place-after/*-5→5.png`를 비교 폴더에 복사했다. 장소 구현은 동일하고 대화 주변 표현만 바뀌었다.
- `대화-변경전-검사.json`, `대화-변경후-검사.json`, `대화-변경범위-검증.json`, `장소-보존-회전검사.txt`, `긴답변-스크롤-검사.txt`, `읽어주기-검사.txt`, `입력창-키보드-검사.txt`, `대화-회귀검사.txt`.
- 회전 동작은 정지 PNG가 아니라 전환 중 3D 변환·양방향·첫/끝 순환·빠른 선택·전화/지도 대상·오클릭 금지 자동화 결과로 입증한다.

## 동시 작업·push·다음 단계

- 코드 push 직전 Ncloud main을 fetch하고 이 작업 브랜치에 정상 `git merge --no-edit origin/main`을 수행했다. `Already up to date.`; 미포함 main 커밋 0, 충돌 0. 공통 대화 파일은 캐시 토큰 외에 변경하지 않았다.
- 코드 SHA `c522c84d7b681a48e9a3afbf2f2bbfcb81cac6f7`를 push하고 동일 원격 SHA를 readback했다. 문서 커밋 push 직전에도 최신 main을 확인한다.
- MERGED=NO / DEPLOYED=NO / ACTUAL_PRODUCTION_E2E=NOT_TESTED. 본 후속 작업의 배포 ID·served revision은 NOT_VERIFIED.
- Linux 전체 gate: NOT_TESTED. 이 PC에는 실행 가능한 WSL 배포판이 없고 Ncloud Git SSH는 Git 전용이다. Linux용 프로필 조건과 workflow 등록은 구현했으며 Claude의 trusted Linux gate에서 실행해야 한다.
- 실제 Android Chrome·Samsung Internet·iPhone Safari·화면 읽기 프로그램·운영 API·실제 전화/지도 앱 실행: NOT_TESTED. Android/iOS Native는 범위 밖.
- DB·Secret·LIVE MONEY·유료 인프라·운영 사용자 데이터·소셜 공개 변경 없음. 추가 사용자 승인 필요 없음.
- Claude는 최신 main 정상 merge로 가족 지킴이/T57a/T57b의 공통 변경을 보존하고, 필요한 캐시 재생성·trusted Linux gate·Ncloud main 병합·배포·운영/실기기 연결 검증을 수행한다.
