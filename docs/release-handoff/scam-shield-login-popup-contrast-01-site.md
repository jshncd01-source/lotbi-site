READY_FOR_DEPLOY=YES

# scam-shield-login-popup-contrast-01-site — release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/scam-shield-login-popup-contrast-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote origin refs/heads/feature/scam-shield-login-popup-contrast-01-site`)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=e13c0dfd2aa0ba58f7aff757bc2fe89319f738a (started from c311be85, normal merge of e13c0dfd — no conflicts)
CODE_SHA=cb4427fa2da677555caba9f98d11f83d14aa748b
ASSET_VERSION=aset-bb8013acafb0
PRIORITY=P0 (Production, Samsung Internet 실기기 보고 2026-10-08)

## 증상

LOTBI → 진위확인 → 비로그인 → 로그인 안내 팝업(다크모드): 첫 번째 '로그인하고 확인하기'는 보이지만 두 번째 버튼은 흰 배경에 글자가 보이지 않아 무슨 버튼인지 알 수 없음.

## ROOT_CAUSE

- 두 번째 버튼 = `취소`(`[data-scam-login-cancel]`, 누르면 진위확인 창 닫기).
- `site-scam-shield.css` `.scam-login-actions button { border: 1px solid #b7c1d0; background: #fff; }` — 배경만 흰색으로 고정하고 글자색(`color`)이 없었다. 다크 테마는 `color-scheme: dark`라 브라우저 기본 버튼 글자색이 흰색 → 흰 배경에 흰 글자, 대비 1:1(실제 Chrome 계산값 `rgb(255,255,255) on rgb(255,255,255)`). 라이트에서는 기본 글자색이 검정이라 보였다. 시스템 다크도 동일.
- 같은 창의 다른 고정색: '로그인하고 확인하기' 파란 #1258d8은 다크 창 배경(#212121) 대비 2.62:1(버튼 경계 3:1 미달), '구독 및 사용량 보기' 링크 #1258d8 글자는 다크에서 2.62:1(4.5:1 미달), 라이트 '취소' 테두리 #b7c1d0은 1.82:1. `.scam-dialog-close`도 흰 배경+글자색 없음(소비자 화면 규칙이 덮어써서 실제로는 보였음).
- 다른 로그인 안내 점검(7번): Life Wallet '로그인하기', 안심케어 반려동물·사람 '로그인', 데스크톱 사이드바 '로그인 LOTBI 계정 연결'은 라이트·다크·시스템 다크, 390·1280 모두 14.77~16.1:1 정상. **모바일 헤더 '로그인'(`.account-login`)이 같은 유형** — 배경 `rgba(255,255,255,.72)` 고정 + 글자 테마 토큰 → 다크·시스템 다크에서 #f5f5f5 on #bdbfc1 = 1.69:1(거의 안 보임). 함께 수정.
- 정의되지 않은 CSS 변수: 로그인 안내 규칙에는 없음. `.scam-shield-card`의 `var(--surface, #fff)`는 index.html에 정의가 없어 fallback으로 그려짐(그 카드는 index.html에 없음 — 영향 없음, 무변경).

## 수정 (CSS만, JS·HTML 문구 무변경)

- `site-scam-shield.css`
  - 로그인 안내 버튼은 채움과 글자색을 LOTBI 테마 토큰 한 쌍으로: '로그인하고 확인하기' = `--lotbi-brand-solid-bg`/`--lotbi-brand-solid-text`(같은 창 '확인하기' 버튼과 같은 주 버튼 색 — 라이트 #212121/흰 글자, 다크 #f5f5f5/#212121 글자), '취소' = `--lotbi-surface-primary` + `--lotbi-text-primary` 글자·테두리.
  - 눌림(:active)·hover(마우스 기기만) = `--lotbi-surface-hover` / `--lotbi-brand-solid-bg-hover`, 비활성 = `--lotbi-surface-subtle` + `--lotbi-text-disabled` + `--lotbi-border-strong`, 포커스 = 기존 `--lotbi-focus-ring` 2px 링 유지.
  - 간격 정리: 제목·설명·버튼 간격 12px, 버튼 높이 52px, PC 두 버튼 같은 너비 2열 / 560px 이하 전체 너비 세로 쌓기(주 버튼 위), 설명 `word-break: keep-all`, 빈 상태 문구 줄 숨김.
  - '구독 및 사용량 보기' 링크와 `.scam-dialog-close`, `.scam-dialog` 기본 배경도 토큰으로(하드코딩 #fff·#1258d8·#d8dee8 제거).
- `home-chat.css` `.account-login` 배경 `var(--lotbi-surface-primary, rgba(255,255,255,.72))` — 라이트는 흰색 그대로, 다크는 #212121 + 흰 글자.
- 신규 `scripts/validate_scam_shield_login_gate_contrast_01.mjs` + `.github/workflows/site-review.yml` 등록.
- asset token 재계산 — 위 파일 외에는 `?v=` 토큰만 바뀜.

## 결과 수치 (실제 Chrome 계산값, viewport 에뮬레이션)

| 항목 | 수정 전 라이트 | 수정 전 다크 | 수정 후 라이트 | 수정 후 다크 |
|---|---|---|---|---|
| 취소 글자 | 21 | **1.00** | 16.1 | 14.77 |
| 취소 버튼 경계 | **1.82** | 16.1 | 16.1 | 14.77 |
| 로그인하고 확인하기 글자 / 경계 | 6.15 / 6.15 | 6.15 / **2.62** | 16.1 / 16.1 | 14.77 / 14.77 |
| × / 제목 / 설명 | 16.1 | 14.77 | 16.1 | 14.77 |
| 구독 및 사용량 보기 | 6.15 | **2.62** | 16.1 | 14.77 |
| 눌림 로그인 / 취소 | — | 6.15 / **1** | 11.2 / 14.13 | 16.1 / 11.25 |
| 포커스 링 | 9.59 | 13.75 | 9.59 | 13.75 |
| 비활성(3:1 목표) 로그인 / 취소 | 6.15 / **2** | 6.15 / **1** | 3.22 / 3.22 | 5.31 / 5.31 |
| 모바일 헤더 로그인 | 16.1 | **1.69** | 16.1 | 14.77 |

시스템 테마(라이트·다크)와 창이 열린 상태에서 시스템 테마 전환(라이트→다크, 다크→라이트) 모두 같은 값.
레이아웃: 360 294×52 / 375 309×52 / 390 324×52 / 412 346×52(세로 쌓기, 간격 10px), 1280 283×52 두 개 나란히. 창·본문 가로 넘침 0, 글자 잘림 0.

## SAFETY

LIVE_MONEY=OFF, CORE_CHANGED=NO, ENV_CHANGE_REQUIRED=NO, MIGRATION=NO, SERVER_ROUTING_CHANGED=NO, JS_CHANGED=NO.

## TEST_STATUS

- 신규 `validate_scam_shield_login_gate_contrast_01.mjs`: 수정 전(main CSS) FAIL 218건(다크 취소 1:1 등) 재현 → 수정 후 PASS, 30 renders(360/375/390/412/1280 × 라이트·다크·시스템 라이트·시스템 다크 + 열린 채 시스템 전환 2종). 글자 4.5:1, 버튼 경계·포커스 링 3:1, hover·눌림·포커스·비활성(3:1), Tab으로 취소 이동 시 :focus-visible 링, 레이아웃(창·뷰포트 안, 가로 넘침 0, 글자 잘림 0, 높이 ≥44px, 간격 ≥8px), 모바일 헤더 로그인 대비. 동작: 취소 → 닫힘·`/#scam` 해제, × → 닫힘, 뒤로가기 → 닫힘, 로그인하고 확인하기 → 로그인 요청 1회 + '공식 LOTBI 로그인 화면으로 이동합니다.' (390 다크·1280 라이트·360 시스템 다크).
- SITE-T28 진위확인 validator: `validate_scam_shield_photo_picker_01`, `validate_scam_shield_result_banner_contrast_01`, `validate_scam_shield_mvp_01`, `validate_scam_shield_connection_01` 모두 PASS(merge 후 HEAD).
- `asset_cache_version --check` PASS(aset-bb8013acafb0).
- 관련 회귀 46개(진위확인·헤더 로그인·home-chat.css·다크/테마 대비·사이드바·홈·캘린더 등 변경 선택자를 참조하는 `scripts/validate_*` 전부, merge 후 HEAD, 동시 4개): PASS 38 / FAIL 8.
  - main 기준선(e13c0dfd)에서도 같은 오류로 실패 = 기존 Windows RED 3건: auth_unknown_recovery_browser_01(EPERM 임시 폴더 삭제), image_attachment_thumbnail_01(transcript 재구성 단언), mobile_footer_legal_sheet_01('761px: mobile disclosure leaked into desktop').
  - 나머지 5건(composer_auto_grow, conversation_message_ux_final_01, home_small_text_contrast_01, mobile_home_ux_stability_01, sidebar_viewports_04)은 기준선·branch 각각 단독(동시 3) 재실행에서 양쪽 모두 PASS — 다른 방 Chrome 60여 개 동시 실행 중의 부하성 실패.
- 다른 로그인 안내 점검(scratchpad probe, 390·1280 × 라이트·다크·시스템 다크): Life Wallet·안심케어 반려동물·사람·캘린더·홈의 보이는 버튼·링크 전부 측정, 4.5:1 미만은 모바일 헤더 로그인(1.69:1) 하나 → 수정.

NEW_FAILURES=0

## DEVICE_STATUS

- Samsung Internet 실기기: NOT VERIFIED
- Android Chrome 실기기: NOT VERIFIED
- iPhone Safari 실기기: NOT VERIFIED
- 위 수치는 Windows 데스크톱 Chrome의 viewport·터치 에뮬레이션이다. 원인(배경 고정 + 글자색 없음 → 브라우저 기본 흰 글자)은 브라우저 공통이며, 수정 후에는 모든 버튼이 글자색을 직접 지정해 브라우저 기본값에 의존하지 않는다.
- 사용자 첨부 실제 화면 사진은 이 방에 도착하지 않아 증상 설명과 로컬 재현 화면(다크 390, 빈 흰 버튼)을 기준으로 했다.

## SITE-T28 진위확인 개선과의 관계

main(e13c0dfd)에 이미 들어간 SITE-T28(사진 보관함 선택·결론 배너·미리보기, 93a0c42b)의 규칙은 건드리지 않았다. 그 validator(`validate_scam_shield_photo_picker_01`, `validate_scam_shield_result_banner_contrast_01`, `validate_scam_shield_mvp_01`) 결과는 위 TEST_STATUS 참고.

## DEPLOY_ORDER

Site 단독. 배포 후 Samsung Internet·Android Chrome·iPhone Safari 다크모드에서 비로그인 진위확인 → 로그인 안내 '취소' 글자와 모바일 헤더 '로그인' 글자 실기기 확인 권장.

USER_DECISION_NEEDED=NONE (참고: '로그인하고 확인하기'가 파란색에서 LOTBI 기본 주 버튼 색으로 바뀜 — 같은 창 '확인하기'와 통일. 파란색 유지를 원하면 알려 주세요.)
