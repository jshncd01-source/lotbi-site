READY_FOR_DEPLOY=YES
MIGRATION=NO
DEPLOY_ORDER=SITE 단독 (Core 변경 없음 — 기존 POST /v2/scam-shield/cases 그대로)
USER_DECISION_NEEDED=NONE (소유자 2026-10-14 시안 "확정" → "배포 승인")
USER_FIRST_STANDARD=적용 (release-control/USER_FIRST_STANDARD.md, 아래 「사용자 시나리오」 3개 + 스크린샷)
SITE_GATE_QUEUE=D:\LOTBI-WORK\locks\site-gate-queue.md 7번 (캘린더 다음, 지역정보 앞)

# SCAM-PHISHING-REDESIGN-02 — 사기·피싱 확인: 팝업 → 독립 페이지 (Site)

REPO=lotbi-site
FEATURE_BRANCH=feature/scam-phishing-redesign-02-site
FEATURE_SHA=이 문서 커밋(branch HEAD). `git ls-remote`로 확인한다.
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=2047877405928309dd4ed634266e2f4fb2be5b57 (운영 asset aset-7327fad003f1 = 이 main)
ASSET_VERSION=aset-525f17f4541b (`--check` PASS, targets=169 refs=208)
DESIGN=시안 캔버스 https://claude.ai/artifact/2kPPgAB6L8CH1RsHtZGHBL (확정본, 11번 '확정 수정' 대지 = 10가지 수정 반영). 원본·JPG: 소유자 PC `handoff/design/scam-phishing-design-01/`
SUPERSEDES=feature/scam-phishing-check-redesign-01-site, approved-design-01·02·03 (운영에 안 들어간 옛 시안 branch — 이 branch가 대신함, 지우지는 않음)

## 왜

운영의 사기·피싱 확인은 회색 가림막 위 640px 팝업 안에서 따로 스크롤됐다(원인: `site-consumer-layout.css:200-201`·`site-consumer-design.css:112`·`site-consumer-detail.css:81-82`의 공통 대화상자 규칙이 독립 페이지 규칙을 덮음). 소유자 요구: 팝업이 아닌 독립 페이지, PC는 왼쪽 메뉴 유지, 모바일은 전체 화면, 브라우저 스크롤 하나, 위에 '대화로 돌아가기'.

## 변경

- **페이지로 전환**: `index.html`의 `<dialog class="scam-dialog">` 블록(91줄) 삭제. `site-conversation.js`가 다른 화면(캘린더·지갑)과 같은 `modalShell` + `installSurfaceBehavior({workspace: 'scam', route: 'scam'})`로 열고, `site-scam-shield.js`(ES module, `mountScamShield(root)`)가 내용을 그린다. `#scam` 주소·새로고침 복원·뒤로 가기·메뉴 강조는 기존 route 체계 그대로. 공통 대화상자 CSS는 손대지 않음(다른 화면 영향 0).
- **화면 전체 새로 그림**(`site-scam-shield.js`·`.css` 전면 재작성): 모든 글자는 `textContent`로만 넣고 `innerHTML` 0건. 단계: 확인 중 → (비로그인) 로그인 안내 → 입력 → 분석 중 → 결과 / 실패(다시 시도·내용 고치기) / 월 한도.
  - 입력: 글(붙여넣기 버튼, 2만 자) / 링크(주소 형식 안내) / 사진·문서(사진 보관함·문서·카메라 — 카메라는 휴대폰·카메라 있는 기기에서만). 사진은 JPG·PNG·WEBP만 미리보기, 문서·HTML은 열거나 미리 보지 않고 이름·형식·크기만.
  - "이미 돈을 보냈거나 개인정보·비밀번호·인증번호를 넣었나요?" → 예: 기기(Galaxy·iPhone·Windows·Mac)와 단계 1~6. 보내는 값(`incident_level`, `device`)은 옛 화면과 같다.
  - 결과: **사고가 있으면 판정과 상관없이** '이미 눌렀다면 지금 해야 할 일' → 공식 창구 → '내용 분석 결과' 순. 사고가 없고 위험이면 판정 → 공식 창구.
  - 공식 창구 5곳 용도별: 송금 피해 = 보낸 금융회사 고객센터 지급정지 / 1394 보이스피싱·스미싱 통합 신고·상담 / 112 긴급 출동 / 118 사이버 보안·스미싱 상담 / 경찰청 ECRM 온라인 신고. 휴대폰은 큰 버튼 3개(tel 링크) + '창구 5곳 자세히 보기'.
  - 원격제어·악성 앱 의심(단계 4·5): "이 기기 말고 다른 안전한 전화기나 PC로 연락하세요" 경고, 전화·사이트 버튼 대신 '다른 전화기로 1394' 글자.
  - 표기: '위험 신호 없음' → **'확인된 위험 신호 없음'**, 맨 위 요약에 "다만 안전하다는 보증은 아니에요." 유지. 사고가 있으면 '급하게 처리할 일 없음'·'휴일이면 평일에' 줄 숨김.
- **공식 링크 허용 목록**(`site-core.js`): `.go.kr`/`.or.kr` 정규식 → 정확한 호스트 목록 `SCAM_OFFICIAL_LINK_HOSTS` + `scamOfficialUrl()`(https만, 계정·포트 없음). 버튼에는 기관명과 실제 도메인을 함께 표시. 검사한 의심 주소는 어디에서도 링크가 되지 않고 글자로만.
- **Core 202(같은 내용 확인 중)**: 옛 화면은 '응답 형식 오류'로 보였다 → "같은 내용을 아직 확인하고 있어요. 잠시 후 다시 눌러 주세요."(`SCAM_ANALYSIS_RESULT_PENDING`, 다시 시도 가능).
- **보관·삭제 문구 없음**: 운영 정책이 확인되지 않아 업로드 보관 기간·삭제 문구를 넣지 않았다(검사기가 막음).
- 파일(main 대비 실제 내용 변경): `index.html`, `site-conversation.js`, `site-core.js`, `site-scam-shield.js`, `site-scam-shield.css`, `.github/workflows/site-review.yml`, 검사기 아래 목록. 나머지는 asset 토큰 문자열만.

## 확정 10가지 반영표

| # | 소유자 확정 사항 | 구현 | 검사 |
|---|---|---|---|
| 1 | 송금·개인정보 입력이면 판정과 무관하게 사고 카드 맨 위 | 결과 순서 사고 → 창구 → 분석 | incident_priority: 확인 안 됨·확인된 위험 신호 없음·위험 높음 모두 |
| 2 | '확인된 위험 신호 없음' + 보증 아님 문장 맨 위 | LEVELS 표기·SAFETY_SENTENCE | banner_contrast, incident_priority |
| 3 | 1394·112·118·ECRM·지급정지 용도별 | CONTACTS 5곳 | incident_priority(5곳·용도 문구) |
| 4 | 허용 도메인만, 기관명+도메인, 의심 주소 링크 금지 | 허용 목록·`hostOf` 표시 | incident_priority·double_check(가짜·목록 밖 주소는 글자) |
| 5 | 악성 앱·원격제어면 다른 기기로 | 단계 4·5 경고·버튼 없음 | incident_priority(high-remote-5) |
| 6 | 보관·삭제 문구는 확인된 정책만 | 문구 없음 | mvp_01 금지 문구 |
| 7 | HTML·문서·사진 실행 금지 | 미리보기는 JPG·PNG·WEBP object URL만 | photo_picker, mvp_01(innerHTML 0) |
| 8 | 모바일 위험 결과: 지금 하실 일·신고·지급정지가 스크롤 없이 | 휴대폰은 할 일 2~3개 + 더 보기, 큰 버튼 3개 | incident_priority: **실제 브라우저가 보여 주는 높이** 390x664(Safari)·360x640(Chrome)에서 버튼 하단 ≤ 화면 |
| 9 | WCAG AA 실측(비활성 버튼·도움말 포함) | 토큰 라이트·다크·시스템 다크 | banner_contrast 30렌더, login_gate, double_check |
| 10 | 디자인·문구 확정 후 구현 | 확정본 그대로 | — |

## 사용자 시나리오 (USER_FIRST_STANDARD 8)

fixture Core(실제 `site-core.js` 변환을 거침)로 화면 좌표를 실제 탭·클릭하며 따라 했고 단계마다 스크린샷을 남겼다(소유자 PC `D:\LOTBI-WORK\evidence\scam-phishing-redesign-02\`, 21장 + report.json). 탭 수는 메뉴 버튼 포함, 글 붙여넣기는 탭으로 세지 않음.

| 시나리오 | 시작 → 결과 탭 수 | 막힌 곳 | 스크린샷 |
|---|---|---|---|
| A. 택배 문자를 받은 70대 — 390×664(iPhone Safari가 보여 주는 높이), 라이트 | ☰ 1 → 사기·피싱 확인 2 → 문자 붙여넣기 → 확인하기 3 → **결과 '주의 필요 · 조심하세요.'와 지금 하실 일 2개가 스크롤 없이** → 대화로 돌아가기 4 → 대화 홈(`#scam` 사라짐) | 없음 | `A-01-home` … `A-06-back` |
| B. 검찰 사칭에 이미 송금한 40대 — 360×640(Android Chrome 높이), 다크 | ☰ 1 → 사기·피싱 확인 2 → 붙여넣기 → '예' 3 → Galaxy 4 → '송금·결제' 5 → 확인하기 6 → **사고 카드 맨 위 '가장 먼저: 112나 금융회사 콜센터에 지급정지' + [지급정지][1394][112] 버튼이 첫 화면(버튼 하단 601 ≤ 640)** → 지급정지 7 → 창구 5곳 펼침 | 없음. 보낸 값 `incident_level=6`, `device=Galaxy`(옛 화면과 같은 값) | `B-01-home` … `B-09-pay-tile` |
| C. PC에서 메신저 캡처를 확인하는 직장인 — 1280×900, 라이트 | 왼쪽 메뉴 사기·피싱 확인 1 → 사진·문서 2 → 사진 고르기 3(파일 창) → 확인하기 4 → 결과(왼쪽 메뉴 그대로, 페이지 스크롤 하나) → 다른 내용 확인하기 5 → 빈 입력 화면 | 없음. 보낸 값 `file`(PNG) 하나 | `C-01-home` … `C-06-reset` |

## 검증 (Windows, headless Chrome — viewport 에뮬레이션, 실기기 아님)

- 새·재작성 검사기(모두 공용 시험 도구 `scripts/scam_shield_page_harness.mjs` — Chrome 프로필은 실행 전 mkdtemp, `scripts/.scam-*` 정리):
  - `validate_scam_shield_incident_priority_01`(새) PASS — 6경우 × 1280x900 라이트 / 390x664 라이트 / 360x640 다크 = 18. 사고 카드 맨 위(확인 안 됨·확인된 위험 신호 없음 포함), 창구 5곳 용도, 허용 목록 밖 링크 0, 원격제어 다른 기기 안내, 휴대폰 첫 화면에 지금 하실 일 + 버튼 3개. 처음엔 화면 전체 높이(844·780)로 쟀다가 실제 브라우저가 보여 주는 높이로 바꿈 → 할 일 2~3개 + 더 보기, 휴대폰 연락처 안내 문장 생략으로 맞춤.
  - `validate_scam_shield_double_check_p0` PASS — 36렌더(Core 응답 6종 × 테마 3 × 390/1280), 실제 site-core 변환, 정확한 호스트만 링크(닮은 주소·목록 밖 .go.kr·포트·userinfo·http는 글자), 검사한 주소 링크 0, `scamOfficialUrl` 20경우, WCAG AA.
  - `validate_scam_shield_login_gate_contrast_01` PASS — 30렌더(360/375/390/412/1280 × 라이트·다크·시스템±다크·전환), 모든 글자 4.5:1(hover·눌림·focus·비활성·상태문), **외곽선 버튼·hover 가장자리 3:1 그대로 실패 기준**, 대화로 돌아가기·←·뒤로·로그인·3초 대체·로그인 후 다시 열기·**게이트에 세션이 도착하면 그 자리에서 입력 화면**.
  - `validate_scam_shield_photo_picker_01` PASS — 390 checks(6묶음, 모바일은 터치), 파일 창 가로채기, accept/capture, 미리보기는 JPG·PNG·WEBP만, HTML·PDF·TXT는 실행·삽입·읽기·이동 0, 확인하기 전 전송 0, 10MB(+1바이트는 10.1MB 표시), **지우기**, **끌어다 놓기**(상자에 놓으면 문서로 받음·머리글에 놓아도 브라우저가 열지 않음), 경쟁 응답, 링크 탭.
  - `validate_scam_shield_result_banner_contrast_01` PASS — 5단계 × 3테마 × 390/1280 = 30렌더 AA.
- 수정한 기존 검사기 PASS: `site_refresh_route_restore_01`(정적 + 375/390/1280 = 511 항목, 'scam'이 일반 route), `trouble_helper_01`(52), `scam_shield_mvp_01`(보관·삭제 문구·innerHTML 금지), `verification_dialog_design_01`, `photo_input_no_camcorder_01`, `voice_public_release_exclusion_01`, `consumer_detail_system_01`, `consumer_sections_02`, `common_ui_polish_01`·`02`.
- 그대로 PASS: `scam_shield_connection_01`, `uiux_phase1_01`, `sidebar_information_architecture_04`, `consumer_design_shell_01`, `home_conversation_only_01`, `conversation_answer_ux_01`, `image_attachment_thumbnail_01`, `home_chat.py`.
- **기존 실패(이 변경과 무관)**: `validate_chat_dark_login_kakao_share_01` — "360x780 dark configured share menu" timeout. main 20478774 그대로인 작업본에서도 같은 자리에서 같은 오류(Windows 로컬). gate(Linux)에서 실패하면 이 비교를 먼저 봐 주세요.
- 검사 중 발견해 고친 제품 문제: 옛 Core 응답(2단계 확인 없음)에 '2단계 확인에서 다시 확인한' 문구가 나오던 것, 요약 문장 반복, 고른 파일을 지울 수 없던 것, 점선 상자에 놓은 파일을 브라우저가 열 수 있던 것, 10MB 바로 위 파일이 10.0MB로 보이던 것, 로그인 안내가 떠 있는 동안 세션이 오면 멈춰 있던 것(옛 팝업은 됐음 — 회귀 방지), 테두리 대비(입력칸·외곽선 버튼 `--sp-ln2` 3:1 이상, 다크 hover 색 토큰).
- `node --check` site-scam-shield.js·site-conversation.js·site-core.js PASS, `asset_cache_version --check` PASS.

## NOT VERIFIED

- 실제 iPhone Safari·Android Chrome·Samsung Internet 기기(주소창 높이는 390x664·360x640로 근사), 실제 Core 분석(fixture만), 실제 전화 걸기, Linux gate 글꼴.
- 운영 Core의 `incident_triage.actions` 순서·`do_now` 지급정지 문장은 Core 그대로 표시(사이트에서 바꾸지 않음).

## Core 후속 (이 배포에 포함 안 됨)

- 118(KISA)을 Core 공식 근거 데이터에 넣기 — 지금은 Site의 고정 창구 목록에만 있음.
- Core `do_now`에서 지급정지 문장 순서(사고가 있을 때 맨 앞). Site는 사고 카드 '가장 먼저' 줄로 먼저 보여 줌.

## 배포 후 확인

1. lotbiai.com(PC) → 왼쪽 메뉴 '사기·피싱 확인' → 회색 가림막 없이 오른쪽에 페이지, 왼쪽 메뉴 유지, 주소 `/#scam`, 위에 '← 대화로 돌아가기'.
2. 휴대폰 → ☰ → '사기·피싱 확인' → 전체 화면 페이지, 안쪽 스크롤 없이 브라우저 스크롤 하나.
3. 비로그인이면 로그인 안내, '대화로 돌아가기'로 홈.
4. `https://lotbiai.com/site-asset-version.json`의 버전 = 위 ASSET_VERSION.
