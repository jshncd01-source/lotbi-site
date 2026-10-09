READY_FOR_DEPLOY=YES
MIGRATION=YES(Core p0_0110_conversation_history, 28자 — Site 자체는 migration 없음)
DEPLOY_ORDER=CORE → SITE(→ APP)
APP_STORAGE_CHECK=앱 "최근 대화"는 Site WebView가 아니라 앱 자체 AsyncStorage를 씀 → lotbi-app feature/conversation-account-sync-01-app에서 같은 API로 맞춤(Android 내부 테스트까지만)
USER_DECISION_NEEDED=개인정보처리방침 개정 시점(초안 첨부: docs/privacy-policy-conversation-history-draft-01.md) · 제6.1조 국외 이전 표에 "대화 기록" 추가 여부

# conversation-account-sync-01 (Site) — release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/conversation-account-sync-01-site
BASE_MAIN=9e39edd06446b3e93ec68170de49df9f702e0d07 (READY 직전 `git ls-remote` 재확인, main drift 없음)
CODE_SHA=379f62d2 (이 문서 커밋 직전의 마지막 코드 커밋)
ASSET_VERSION=aset-ade0e342fd9c
PAIRED=lotbi-core feature/conversation-account-sync-01-core(먼저 배포) · lotbi-app feature/conversation-account-sync-01-app
MERGE_NOTE=로그인 유지 수정(feature/auth-session-continuity-p0-02-site 36867671)과 같은 site-conversation.js·site-continuity.js·site-auth.js를 건드림. 시험 병합(merge-tree + 실제 merge 후 abort) 결과 충돌은 import 줄 합집합과 asset 토큰뿐(기능 코드 충돌 0). 명령문대로 그 수정이 main에 들어간 뒤 배포총괄방 알림을 받으면 최신 main을 정상 merge해 재READY한다.

## 목적
로그인 사용자의 "최근 대화"를 계정에 저장해 휴대폰·PC 어디서든 이어 보기(소유자 결정 2026-10-09). 비로그인은 지금처럼 기기에만 저장.

## 변경
- `site-conversation-sync.js`(새 모듈): Core `/v2/conversation-history`와 기기 사본(`lotbi.site.ux.v1.threads.<namespace>`)을 맞춘다.
  - 로그인하면 서버 목록으로 "최근 대화"를 채운다(다른 기기 대화는 제목 먼저, 열면 메시지를 불러옴). 90초마다·탭 복귀·재연결 시 다시 확인.
  - 충돌 규칙: 메시지 id 단위 추가, 덮어쓰지 않음. 제목·고정만 마지막 변경 우선. 메시지에 id를 붙이고(기존 메시지는 시각·역할·내용으로 만든 고정 id라 다시 올려도 중복 없음).
  - 오프라인·실패: 기기 사본 그대로 쓰고 "동기화 대기" 표시, 5초~5분 간격 재시도 + `online`·탭 복귀 시 재시도.
  - 처음 로그인 안내: "이 기기의 대화 N개를 계정에 올릴까요?" 계정·기기당 한 번(예 = 한 번만 올림, 아니오 = 이 기기에만, 닫으면 다음에 다시 물음).
  - 저장 끄기: 그 뒤 대화는 기기에만(다시 켜도 끈 동안의 대화는 올리지 않음).
  - 다른 기기에서 지운 대화는 이 기기에서도 사라짐(여기서 아직 안 올린 메시지가 있으면 다시 올림).
  - 캘린더 초안·승인, 반려동물 SOS 동작 등 기기 전용 meta는 올리지 않음. 첨부는 id·형식·크기만.
- `site-conversation-sync-ui.js`(새 모듈): "최근 대화" 제목 옆 상태 표시("동기화 대기" / "이 기기에만 저장")와 "대화 기록 설정" 버튼, 설정 창(계정에 대화 기록 저장 켜기·끄기, 상태 문구, 전체 대화 삭제 → 확인), 기기 대화 올리기 질문 창. 색은 테마 토큰만 사용(`site-theme-tokens.css` 무변경). 데스크톱 사이드바(좁음)에서는 상태 표시를 제목 아래 줄로.
  - 프로필 메뉴 6항목은 기존 validator가 고정하므로 메뉴에 넣지 않았다.
- `site-conversation.js`: 연결 줄만(메시지 추가·이름 바꾸기·고정·삭제·대화 열기 시 알림, 계정 전환 시 중지). 동기화 모듈 2개는 **/v2/me로 로그인 프로필이 확인된 뒤에만 동적 import** — 게스트와 첫 화면은 이전과 같은 모듈만 받는다(Windows python 정적 서버를 쓰는 기존 fixture validator에서 추가 병렬 모듈 요청이 연결 거부되던 문제도 이것으로 해소). 엔진이 뜨기 전에 쓴 메시지는 시작 시 id를 받고, 저장이 꺼진 상태로 시작하면 아직 안 올라간 메시지는 기기 전용으로 둔다. 삭제·이름 바꾸기 확인 문구는 계정 저장 중일 때 "이 기기와 계정에서 삭제" 등으로 안내.
- 로그아웃: 기존 정책 그대로(기기 사본을 지우지 않고 익명 namespace로 전환). namespace는 installationId인데 Core `ClientInstallation`이 user_id에 묶여 있어 같은 브라우저라도 계정마다 다르다 → 다음 사람에게 보이지 않음(validator로 확인).
- `.github/workflows/site-review.yml`: 새 validator 단계 추가.
- `scripts/validate_profile_menu_improvement_01.mjs`: fixture의 가짜 Core가 새 `/v2/conversation-history/` 경로에 응답(따로 셈)하도록 한 줄 추가. "예상 밖 요청 0건" 계약은 그대로.
- `privacy.html`·`terms.html`: 본문 무변경(asset 토큰 줄만 자동 갱신). 개정 초안은 `docs/privacy-policy-conversation-history-draft-01.md`.

## 검증 (로컬 Windows, headless Chrome)
- 새 validator `scripts/validate_conversation_account_sync_01.mjs` PASS(13): 실제 index.html + 실제 로그인 콜백, 브라우저 컨텍스트 = 기기, 프로세스 안 가짜 계정 저장소(Core 계약 동일).
  1. 기기 올리기 예: 2대화·4메시지 한 번
  2. A에서 대화 → B(360 폰)에서 목록에 보이고 열림
  3. B가 이어 쓰기 → A에서 두 기기 메시지 모두, 순서 유지(덮어쓰기 없음)
  4. 오프라인 → "동기화 대기"(데스크톱 제목 한 줄·표시 온전) → 재연결 후 업로드·표시 사라짐
  5. 공유 기기: 로그아웃 후 게스트에 U1 대화 0개·설정 버튼 없음, 같은 브라우저 U2 로그인 시 U2 대화만·질문 없음
  6. 기기 올리기 아니오: 올라가지 않음, 다시 묻지 않음
  7. 저장 끄기: 그 뒤 대화는 기기에만, 다시 켜도 안 올라감
  8. 하나 삭제(계정·다른 기기 반영), 전체 삭제(계정·기기 비움, 다른 계정 무관)
  9. 폰 320/360/412 다크 + 360 라이트: 제목 줄·버튼·설정 창·질문 창이 화면 안, 가로 넘침 없음, 대비(표시 ≥4.5, 아이콘 ≥3, 창 문구 ≥4.5), 탭 크기 ≥32px
  - 요청 경로가 모두 `/v2/conversation-history/`(답변 요청 계수 `/v2/conversation/`에 섞이지 않음) 확인.
- 기존 `validate_*` 전체 회귀(240개, CHROME_BIN=로컬 Chrome):
  - 1차(순차, 작업 중 코드): 231 PASS. 여기서 실제 결함 3건을 찾아 고침 — ① 전체 삭제 직후 기기 목록이 한 박자 늦게 비던 순서(기기 사본 먼저 비우고 계정 삭제 대기 표시 먼저), ② 데스크톱 사이드바에서 "최근 대화"가 한 글자씩 접힘(스크린샷으로 발견, validator에 데스크톱 검사 추가), ③ `validate_profile_menu_improvement_01` — 새 모듈 2개가 첫 모듈 묶음에 들어가 Windows python 정적 서버가 병렬 요청 하나를 연결 거부(CDP로 `ERR_CONNECTION_REFUSED` 확인) + 그 검사의 "예상 밖 요청 0건" 계약 → 동기화 모듈 지연 로드로 바꾸고 그 fixture가 새 경로에 응답하도록 수정.
  - 최종(코드 379f62d2, 포트가 겹치는 검사는 같은 줄에 두고 두 줄 병렬): 232 PASS / 8 FAIL → 8건 단독 재실행: 5건 PASS(병렬 부하 중 로컬 서버 연결 거부·결과 누락), `validate_place_card_compact_01` 단독 2/2 PASS(기준선 9e39edd0도 같은 모듈 로드 오류로 1/2 실패하는 부하성), `validate_mobile_footer_legal_sheet_01`·`validate_site_avatar_fallback_runtime`은 기준선 9e39edd0에서도 실패(기존 Windows RED). 1차에서 실패한 `validate_auth_unknown_recovery_browser_01`(임시 프로필 삭제 EPERM, 기준선 동일)은 최종에서 PASS.
  - 결론: 이 변경으로 새로 생긴 실패 0.
- 스크린샷(데스크톱 질문 창·동기화 대기, 폰 320/360/412 다크·360 라이트 서랍·설정 창)은 로컬에서 확인(`CONVERSATION_SYNC_SCREENSHOTS=<dir>`로 재생성 가능).
- NOT VERIFIED: 실기기(삼성 인터넷·iPhone Safari·PC Chrome 교차), 운영 Core와의 실제 E2E(Core 미배포). 모바일 viewport 에뮬레이션은 실기기 PASS가 아니다.

## 배포 메모
- Core 먼저. Site만 먼저 나가면 새 API가 404 → "동기화 대기"만 보이고 기기 저장은 그대로(데이터 손실 없음).
- 배포 후 smoke: 로그인 상태에서 대화 1회 → 다른 브라우저(또는 시크릿) 같은 계정 로그인 시 최근 대화에 보이는지, 설정 버튼 → 켜기·끄기 저장.
