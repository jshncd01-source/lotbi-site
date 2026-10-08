READY_FOR_DEPLOY=YES

# calendar-add-cancel-contrast-01-site — release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/calendar-add-cancel-contrast-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote origin refs/heads/feature/calendar-add-cancel-contrast-01-site`)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=c9c19e4cef9914f0b50d4870cbcc59e58602ddc2 (branch started here; Production served the same asset aset-738bfea7816e at start)
CODE_SHA=9d38f564 (d890cae6 = 수정 본체, 9d38f564 = d890cae6에서 실수로 지운 scripts/.placecard-inner.html을 main 그대로 복원. main 대비 그 파일 차이 0)
ASSET_VERSION=aset-df38a80a6705 (main c9c19e4c: aset-738bfea7816e)
USER_DECISION_NEEDED=NONE

## SCOPE

- Site 전용. Core / Web / App / Admin 변경 없음. 배포 순서 제약 없음.
- 캘린더 '기록 추가' / '기록 수정' 편집창 하단 버튼(취소·저장, 같은 줄의 삭제·축제·행사 보기)의 색과 저장 버튼 활성 조건만 바꿨다.
- 날짜 선택(날짜 칩·날짜 입력), 저장 처리(submit handler·저장 값·저장 후 이동), 취소 처리(close)는 코드 그대로다.

## ROOT_CAUSE

- `site-calendar.css`의 `.calendar-editor-actions button`이 `background: #fff`에 글자색을 `var(--lotbi-text-primary)`로 두었다. 다크 테마에서 이 토큰은 #f5f5f5인데 편집창 하단 버튼에는 다크 규칙이 없었다(같은 캘린더의 조회 전용 창·삭제 확인 창 버튼에는 있었다).
- 그래서 다크에서 취소 = 흰 배경 + #f5f5f5 글자, 대비 1.09:1. iPhone 카카오톡 인앱 브라우저는 테마 기본값이 '기기 설정(system)'이라 기기 다크면 그대로 이 상태가 된다. 수정 전 main(c9c19e4c) 실제 index.html#calendar를 iPhone 크기·카카오톡 UA·기기 다크로 열어 같은 화면을 재현했다.
- 같은 이유로 다크의 저장 버튼은 면(#212121)이 시트 배경(#212121)과 1:1로 구분되지 않았고, 제목이 비어도 눌렸다(누르면 오류 문구만 나옴).

## CHANGE

- `site-calendar-manager.js` (calendarEditorDialog):
  - 저장은 제목이 공백이 아닐 때만 활성. 제목 input 이벤트로 갱신, 저장 요청 중에는 계속 비활성(기존 `save.disabled = true/false`를 같은 의미의 `saveInFlight` + `refreshSave()`로 바꿈).
  - 취소는 비활성화하는 코드가 없다(항상 활성). submit handler의 빈 제목 검사·오류 문구는 그대로 둠.
- `site-calendar.css`:
  - 라이트: 하단 보조 버튼 테두리 #cfd6e2 → #7d8796 (흰 시트 대비 1.46 → 3.63:1). 배경·글자 그대로.
  - 저장 비활성: `opacity .45; cursor: not-allowed` — 같은 캘린더의 '사진에서 읽었어요' 확인창 저장 버튼과 같은 방식.
  - 다크: 하단 버튼 배경 #121720·글자 #f5f5f5·테두리 #7d8796, 저장은 #edf0f5 면 + #212121 글자(사진 확인창 다크 저장과 같은 값), 삭제는 #d36b6b 테두리 + #f2a1a1 글자(삭제 확인창 다크와 같은 값).
  - 기기 설정 다크용 미러 블록을 `scripts/generate_calendar_system_dark.mjs`의 `generate()`로 재생성(추가된 3규칙 외 변화 없음).
- `scripts/validate_calendar_editor_footer_contrast_01.mjs` (신규) + `.github/workflows/site-review.yml`에 한 줄 추가.
- asset token 재생성(`scripts/asset_cache_version.mjs --write`). 나머지 파일 변경은 토큰뿐임을 파일별로 확인.

## TEST_STATUS

CONTRAST (CDP 실측, scripts/validate_calendar_editor_footer_contrast_01.mjs)
| 상태 | 취소 글자 | 취소 테두리(시트 대비) | 저장(제목 전) | 저장(제목 후) |
|---|---|---|---|---|
| 수정 전 기기 다크 / 직접 다크 | 1.09:1 | — | 활성(눌림) | 면이 시트와 1:1(구분 안 됨) |
| 수정 후 기기 다크 / 직접 다크 | 16.48:1 | 4.43:1 | 비활성(opacity .45) | 14.10:1, 면 #edf0f5 |
| 수정 전 라이트 | 16.10:1 | 1.46:1 | 활성(눌림) | 16.10:1 |
| 수정 후 라이트 | 16.10:1 | 3.63:1 | 비활성(opacity .45) | 16.10:1 |

BEHAVIOR (수정 전 main c9c19e4c와 같은 하네스로 비교. 20개 조합 = 라이트·직접 다크·기기 다크·기기 라이트 × 모바일[키보드 없음 / iOS형 visualViewport 축소 / iOS 스크롤형 offsetTop 120 / Android형 레이아웃 축소] + 데스크톱. 실제 index.html#calendar, 비로그인 게스트, 외부 요청 차단·세션 상태만 stub, iPhone 390x844·카카오톡 UA)
- 취소: 제목 비었을 때·입력했을 때 모두 활성, 실제 탭으로 닫힘, 저장 0건, body 잠금 해제 — 수정 전과 동일
- 저장: 제목 전·공백만이면 비활성, 한글 조합 중·입력 후 활성. 비활성 저장 탭·빈 제목 Enter는 저장 0건. 입력 후 탭하면 고른 날짜로 1건 저장 — 저장 결과는 수정 전과 동일
- 날짜 칩: 탭하면 날짜 입력 열림, aria-expanded=true — 수정 전과 동일
- 키보드 열림 3모델 모두 취소·저장이 보이는 영역 안에 있고, 버튼 중앙 hit-test가 해당 버튼
- 새 validator: 수정본 PASS / 수정 전 트리에서 `취소 text contrast 1.09 < 4.5`로 FAIL

REPO_VALIDATORS (Windows 로컬, 직렬 실행)
- 실행 123 / 195: PASS 119, FAIL 4, NOT RUN 72. 사용자 요청(속도)으로 전체 실행을 중간에 멈췄고, 바뀐 파일(site-calendar-manager.js · site-calendar.css · calendar-editor)을 읽는 validator는 전부 실행했다. NOT RUN 72개는 이 파일들을 읽지 않는다.
- FAIL 4개는 수정 전 main(c9c19e4c)에서도 같은 오류로 실패(기존 Windows RED):
  - validate_calendar_system_dark_01 — CRLF 작업 폴더라 미러 비교 불일치. LF로 맞추면 일치(새 validator가 LF 정규화 후 같은 비교 PASS). 별도 세션에서 수정 중.
  - validate_auth_unknown_recovery_browser_01 — 임시 폴더 삭제 EPERM
  - validate_calendar_modal_runtime_02 — 결과 누락 / 모듈 로드 실패
  - validate_image_attachment_thumbnail_01 — `rebuilding the transcript releases rendered previews`
- 부하 중 Chrome ETIMEDOUT으로 실패했던 5개(bare_white_home_render_01, calendar_expense_summary_01, calendar_touch_monthnav_daysheet_01, home_small_text_contrast_01, conversation_message_ux_final_01)는 단독 재실행 PASS.
- asset_cache_version.mjs --check PASS (aset-df38a80a6705)

NOT_TESTED
- 실제 iPhone 카카오톡 인앱 브라우저 · iPhone Safari · Android Chrome · Samsung Internet 실기기: NOT_TESTED (Chrome 에뮬레이션만, WebKit 아님)
- 로그인 사용자 실제 저장(Core API): NOT_TESTED (게스트 저장으로 확인, 저장 코드 경로는 변경 없음)
- Linux 배포 gate 실행: NOT_TESTED
- Production 배포 후 확인: NOT_TESTED (배포 전)

## DEPLOY NOTES (배포총괄방)

- Site 이미지 재빌드 + `lotbi-site-prod` 이미지 교체. 반영 확인: `https://lotbiai.com/site-asset-version.json`의 version = aset-df38a80a6705.
- 배포 후 smoke: lotbiai.com → 캘린더 → 날짜 → + 기록. 기기 다크(또는 화면 모드 다크)에서 취소가 어두운 면·밝은 글자·테두리로 보이는지, 제목 전 저장이 흐리게 비활성인지, 제목 입력 후 저장이 밝게 강조되는지, 취소·저장이 동작하는지.
