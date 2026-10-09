READY_FOR_DEPLOY=YES

# scam-shield-photo-library-picker-01-site — release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/scam-shield-photo-library-picker-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote origin refs/heads/feature/scam-shield-photo-library-picker-01-site`)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=c9c19e4cef9914f0b50d4870cbcc59e58602ddc2
CODE_SHA=45d4d5425c7fb6be7e6e3520c4cb7c0cdb682e35
ASSET_VERSION=aset-5d087b134762

진위확인(Scam Shield) 업로드·결과 UI 3건을 한 branch로 묶었다(사용자 지시 "같이 추가 수정").

## SCOPE

1. 사진 보관함 선택 (iPhone Safari·카카오톡 내장 브라우저에서 파일 선택 → 카메라 바로 실행)
   - 원인: 첫 번째 방법 '받은 문자 화면 찍기'(스크린샷처럼 읽힘)가 `capture="environment"` 입력에 연결돼 있었고, iOS는 그 입력을 '파일 선택' 버튼으로 그린다 → 누르면 카메라가 바로 열림.
   - 첫 번째(기본) 방법을 '사진·스크린샷 선택'(`#scam-photo`, capture 없음)으로, 두 번째를 '카메라로 촬영'(`#scam-camera`, capture="environment" 유지)으로 바꿈. capture는 진위확인 안에서 카메라 입력 하나에만 남음.
   - 각 패널의 보이는 버튼은 이름 붙은 `<label for>`('사진·스크린샷 선택' / '카메라로 촬영'), 원래 file input은 포커스 가능한 시각적 숨김(키보드 Space로 열림, 포커스 링은 버튼에 표시).
   - accept(image/jpeg,png,webp)·10MB·형식 검사·'이미 눌렀어요' 문항·확인하기 전 미전송은 그대로. site-scam-shield.js 무변경.
2. 결론 배너 가독성 (다크모드에서 안심 상태 문장이 안 보임)
   - 원인: `CURRENTLY_NO_RISK_SIGNAL` 배너가 배경은 연한 민트(#e5f7ec) 고정, 글자는 테마 토큰 `--lotbi-text-primary` → 다크에서 #f5f5f5 on #e5f7ec = 1.02:1.
   - 배너 컴포넌트(site-scam-shield.css `.scam-result-headline`) 기준으로 5단계 모두 "고정 연한 배경 + 같은 색상의 고정 짙은 글자 + 테두리": 안심 #14532d on #e5f7ec 8.18:1, 확인 불가·주의 7.43:1, 위험·악성 6.61:1 (라이트·다크·시스템 다크 동일).
3. 모바일 사진 미리보기 (카카오톡 긴 파일명 → 화면 잘림, 사진 한쪽 치우침, 버튼 잘림)
   - 원인: `.scam-check-step` grid의 auto 열이 끊을 곳 없는 파일명 폭만큼 늘어나 대화상자보다 넓어짐(375px에서 +109px), 본문은 overflow-x:hidden이라 오른쪽이 잘림. 사진은 width:100% 상자에 contain으로 들어가 세로 사진 양옆이 빈 공간.
   - `minmax(0, 1fr)` 열, 미리보기 사진은 원본 비율·가운데·최대 300px(상자 = 사진, 여백 없음), 파일명 문장은 아무 곳에서나 줄바꿈·최대 3줄. 표시만 바꾸며 보내는 파일·이름은 원본 그대로.
- 신규 validator 2개(site-review.yml 등록): `validate_scam_shield_photo_picker_01.mjs`(실제 Chrome 탭, 파일 선택 창 가로채기: 경로별 입력·capture, 미리보기 레이아웃 3종×긴 파일명, 다시 고르기→분석, 10MB, 문서 입력 불변, 대화상자 위 덮는 요소 없음 — 375/390 라이트·다크/412 다크/1280), `validate_scam_shield_result_banner_contrast_01.mjs`(5단계×라이트·다크·시스템 다크×390/1280 WCAG AA 대비 + 배너 색이 테마 토큰을 쓰지 않는지 정적 검사).
- 기존 `validate_scam_shield_mvp_01.mjs`에 사진 선택·카메라 경로 정적 단언과 vm 실행 단언(경로별 입력, 10MB·형식·빈 선택, 이미 눌렀어요 값) 추가.
- asset token 재계산 — 위 파일 외에는 `?v=` 토큰만 바뀜.

## NOT CHANGED

대화 첨부 카메라(`data-attachment-input="camera"` capture 유지), 안심케어·반려동물 촬영, 진위확인 결과 레이아웃·스크롤·닫기 동작, site-scam-shield.js(새로고침 P0 방이 로컬에서 수정 중인 파일 — 손대지 않음), Core.
main의 진위확인 폼에는 별도 '개인정보 동의' 체크박스가 없다. 유지 대상은 로그인 게이트, '확인하기' 전 미전송, '이미 눌렀거나 개인정보를 입력했어요' 문항이며 모두 그대로다.

## SAFETY

LIVE_MONEY=OFF, CORE_CHANGED=NO, ENV_CHANGE_REQUIRED=NO, MIGRATION=NO, SERVER_ROUTING_CHANGED=NO.

## TEST_STATUS

- 진위확인 묶음(CODE_SHA를 `git archive`한 LF 사본 = CI와 같은 줄바꿈): `node --check` site-scam-shield.js·site-core.js·site-conversation.js, validate_scam_shield_mvp_01 / connection_01 / verification_dialog_design_01 / photo_picker_01(5개 viewport·테마, 각 63~65 checks) / result_banner_contrast_01(30 renders) 전부 PASS. `asset_cache_version --check` PASS(aset-5d087b134762).
- 수정 전 재현(main c9c19e4c 기준 CSS): 375px에서 긴 파일명 시 본문 +109px 넘침·버튼 3개 대화상자 밖, 세로 사진 상자 비율 1.33(원본 0.46); 안심 배너 다크·시스템 다크 1.02:1. 새 validator가 수정 전에 실패하는 것 확인.
- 전체 회귀 `scripts/validate_*`: branch 214개 / main 기준선 212개(신규 2개 차이)를 같은 Windows PC에서 비교.
  - 1차: branch 실패 51 · 기준선 실패 50. 차이 1건 place_card_naver_search_click_01 → 단독 재실행 PASS(부하 중 waitFor 시간 초과).
  - 기존 실패 50개를 `CHROME_BIN`(슬래시 경로) 지정해 양쪽 재실행: branch 15 · 기준선 20. branch만 실패 4건 단독 재실행 → 3건 PASS, calendar_lunar_settings_ui_01은 기준선·branch 번갈아 2회씩 모두 같은 'result missing'(`--dump-dom` 결과 없음, 다른 방 Chrome 동시 실행 중) → 기존·환경 실패.
  - 양쪽 공통 실패 11건(캘린더·아바타·첨부 썸네일 등, 진위확인 무관)은 main에서도 동일.

NEW_FAILURES=0

## DEVICE_STATUS

- iPhone Safari 실기기: NOT TESTED
- iPhone 카카오톡 내장 브라우저 실기기: NOT TESTED
- Android 실기기(갤러리): NOT TESTED
- 떠 있는 롯비 버튼: 진위확인은 showModal top layer라 그 위에 그려지지 않는다. 미리보기 상태에서 대화상자 위 25점 hit-test가 모두 대화상자 안이었다(로컬 화면에는 떠 있는 버튼이 그려지지 않아, 로그인 실서비스에서의 실제 겹침은 NOT VERIFIED).
- 위 수치·화면은 데스크톱 Chrome의 viewport/UA 에뮬레이션이다. 데스크톱 Chrome은 capture를 무시하므로 "카메라가 바로 열림/안 열림"은 입력 속성(capture 유무)과 열린 입력 id로만 확인했다.

## DEPLOY_ORDER

Site 단독. 배포 후 iPhone(Safari·카카오톡)에서 진위확인 → '사진·스크린샷 선택'이 사진 보관함 선택지를 띄우는지 실기기 확인 권장.

USER_DECISION_NEEDED=NONE
