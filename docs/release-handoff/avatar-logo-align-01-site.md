READY_FOR_DEPLOY=YES

STATUS=첫 화면 가운데 3D 캐릭터를 좌측 상단 LOTBI 로고의 캐릭터와 같은 롯비로 맞춤. 새 GLB 하나 + site-avatar.js 모델 주소 2줄. 움직임(13개 동작)·리그·위치·크기·카메라·화면 문구·헤더·로그인/회원가입 버튼·CSS 무변경. 소유자 눈으로 최종 확인 필요(visualStatus=LOGO_ALIGNED_OWNER_REVIEW) — 아래 「남은 문제」.

[LOTBI SITE AVATAR LOGO ALIGN — RELEASE HANDOFF]

TASK=SITE-AVATAR-LOGO-ALIGN-01 (배포총괄방 → 이 방, 소유자 원문 "중앙 3D 캐릭터를 공식 로고와 통일")
REPO=lotbi-site
FEATURE_BRANCH=feature/avatar-logo-align-01-site
READY_SHA=this document's commit (branch HEAD; `git ls-remote ssh://lotbi-ncloud-git/srv/git/repositories/lotbi-site.git refs/heads/feature/avatar-logo-align-01-site`)
BASE_MAIN_SHA=7c4f0944 (Ncloud main, SITE-T54). T55 운영 반영 뒤 그 main 병합 — 아래 MERGES 참고.
CODE_COMMITS=
  1eb191d5 feat(site): home 3D character matches the header logo character
  4f4ca55c chore(site): asset token regenerated (token lines only)
CHANGED_FILES(main 대비, 토큰 제외)=
  assets/models/lotbi-logo-aligned-v3-rigged.glb (신규)
  tools/build_logo_aligned_avatar.py (신규, GLB 생성 스크립트 — .dockerignore가 tools/ 제외, 배포 안 됨)
  site-avatar.js (MODEL_URL·MODEL_SHA256·snapshot version, 주석 3줄)
  scripts/validate_site_avatar_integration.mjs (단정 추가만, 기존 단정 삭제·완화 0)
  .github/workflows/site-review.yml (smoke 경로 목록에 새 GLB 1개 추가)
  이 문서
ASSET_VERSION=aset-f6e2cba23952 (`node scripts/asset_cache_version.mjs --write`, check PASS targets=159 refs=193)
NEW_CSS=NONE (auth/callback/index.html 변경 불필요)
DEPLOY_SCOPE=lotbi-site only. Core·Web·Admin·App 무변경.
DEPLOY_ORDER=단독(SITE).
CORE_CHANGED=NO / MIGRATION=NONE / ENV_CHANGE_REQUIRED=NO / NEW_SECRET_CREATED=NO / STORED_DATA_CHANGED=NO

## 무엇이 바뀌었나 (사용자 눈 기준)

첫 화면 가운데 캐릭터가 좌측 상단 로고 속 롯비와 같은 모습이 된다.

| 부분 | 전 (V5) | 후 (logo-aligned v3) | 로고 |
|---|---|---|---|
| 머리 위 장식 | 분홍·보라·하늘색 통통한 덩어리 | 흰 줄기 + 산호빨강 지느러미(아래쪽 파랑), 오른쪽 위로 휨 | 흰 줄기 + 빨강 지느러미 |
| 귀 | 연분홍 / 연하늘 | 빨강 #F5576F / 파랑 #3A8DFD, 조금 크게 | 빨강 / 파랑 |
| 눈 | 흰색 가는 곡선 | 더 굵은 파란 곡선(빛남 약하게) | 빛나는 파란 곡선 |
| 가슴 배지 | 작은 분홍 점 | 크게, 왼쪽 빨강·오른쪽 파랑 | 빨강→파랑 원 |
| 머리·얼굴판·몸·팔·움직임 | — | 그대로 | — |

## 자산

USED_REFERENCE=assets/brand/lotbi-mark-512.png (공식 로고 캐릭터, 헤더 lockup과 같은 캐릭터, sha는 GLB asset.extras.visualTargetSha256에 기록). 헤더 로고 파일(lotbi-lockup-*.png)·LOTBI 글자 로고는 읽기만, 변경 0.
MEASURED_LOGO_COLORS=빨강 #F5576F, 파랑 #3A8DFD, 눈 #1474E6 계열(3D에서는 빛 보정해 #1F6FFF), 얼굴판 #101623(기존 V5 값 그대로). 디자인 책임 방의 강조색 결정(버튼·링크용)과는 무관 — 캐릭터 색은 로고 실측값.
NEW_MODEL=assets/models/lotbi-logo-aligned-v3-rigged.glb
  sha256=a45cc1865018697737e90aba108f821c33220bfa244a34fc73f7d79b25633058
  size=1,144,852 bytes (V5 1,163,912 bytes보다 19,060 bytes 작음)
  asset.extras: derivedFrom=lotbi-faithful-v2-rigged.glb, derivedFromSha256=fb2729f5…3c3d, visualTarget=lotbi-mark-512.png, visualStatus=LOGO_ALIGNED_OWNER_REVIEW, mouth=false
OLD_MODEL=assets/models/lotbi-faithful-v2-rigged.glb 그대로 둠(옛 site-avatar.js를 캐시한 화면이 계속 열리도록). 삭제는 다음 정리 때.
GENERATOR=tools/build_logo_aligned_avatar.py (numpy + 표준 라이브러리, 외부 유료 도구·외부 업로드 0)
  재생성: `python tools/build_logo_aligned_avatar.py assets/models/lotbi-faithful-v2-rigged.glb assets/models/lotbi-logo-aligned-v3-rigged.glb`
  결정적: 같은 입력 → 같은 sha (다시 만들어 a45cc186… 일치 확인)
BLEND_SOURCE=없음. 이 PC에 Blender 없음. 새로 조각한 모델이 아니라 승인된 V5 GLB를 입력으로 머리 장식 2개 mesh만 새 기하로 바꾸고 귀·눈·배지 색·크기를 고친 결과라, 원본은 「V5 GLB + 이 스크립트」다. V5 Blender 원본은 기존 avatar-src 쪽 그대로.
KEPT_IDENTICAL(검사기로 단정)=노드 전체(이름·자식·이동·회전·크기·mesh 연결), mesh·material 이름, 13개 동작의 채널과 키프레임 바이트, morph target 없음, 입 없음.

## 검사 결과 (Windows, CHROME_BIN, 하나씩 순서대로)

SITE_TEST_RESULTS=
  validate_site_avatar_integration.mjs PASS ("… + LOGO-ALIGN-01 CONTRACT PASS")
  validate_site_avatar_fallback_runtime.mjs — Windows에서는 변경 전 main 7c4f0944에서도 같은 오류(검사기가 띄우는 `python3 -m http.server`에 Node fetch가 붙다가 undici 내부 단정 `assert(!this.paused)`로 죽음 — 화면과 무관한 환경 문제). 서버 줄 하나만 Node 정적 서버로 바꾼 사본(scratch, 커밋 안 함)으로 전·후 모두 PASS: state=fallback, RUNTIME_INIT_FAILED, disposals=1, fallback 1회. CI(Linux)에서는 원본 그대로 돈다.
  validate_avatar_refresh_flash_01.mjs PASS
  validate_brand_official_logo_01.mjs PASS
  validate_auth_continuity_02.mjs PASS
  validate_bare_white_home_render_01.mjs PASS
  validate_home_fresh_entry_01.mjs PASS
  validate_mobile_home_ux_stability_01.mjs PASS
  validate_mobile_home_initial_scroll_01.mjs PASS
  validate_home_small_text_contrast_01.mjs PASS
  validate_sticky_topbar_01.mjs PASS
  validate_hardening.py PASS
  validate_home_chat.py PASS
  validate_bare_white_home_skin_01.py PASS
  validate_document_cache_policy_01.py PASS
  validate_nginx_module_mime_01.py PASS
  ADDITIONAL_AVATAR_TOUCHING_VALIDATORS(아바타 선택자를 쓰는 나머지 9개)=
    validate_chat_media_thinking_01.mjs PASS
    validate_photo_input_no_camcorder_01.mjs PASS
    validate_pinned_conversation_section_01.mjs PASS
    validate_profile_menu_improvement_01.mjs PASS
    validate_profile_menu_personal_theme_01.mjs PASS
    validate_samsung_composer_keyboard_01.mjs PASS
    validate_social_signup_profile_ux_01.mjs PASS (연속 실행 첫 회 kakaoFull@390 "unexpected request" 1건 → 단독 재실행 변경 후 2/2 PASS, 변경 전 main도 PASS. 이 검사기는 자체 시험 페이지라 3D 캐릭터·GLB를 불러오지 않음 — 바로 앞 무거운 삼성 키보드 검사(129s) 직후 부하 타이밍으로 판단)
    validate_theme_auto_schedule_02.mjs PASS
    validate_user_bubble_content_fit.mjs PASS
  asset_cache_version --check PASS
VALIDATOR_WEAKENED=NO (validate_site_avatar_integration.mjs: V5 봉인 단정 그대로 + 새 모델 단정 추가. 다른 아바타 검사기 무변경)

## 화면 검사 (전·후 같은 방법: 실제 index.html, headless Chrome + SwiftShader WebGL, DPR 2)

WIDTHS=360·375·390·412(휴대폰, Android UA) + 1280(PC), 각각 라이트·다크 = 10장 × 전후
ALL_READY=전 10/10, 후 10/10 state=ready, 페이지 오류 0
CREST_NOT_CUT=머리 장식 끝이 캔버스 위 가장자리 안(첫 색 줄 34~38px, 전 35~40px)
NO_BLUR_OR_DISTORTION=같은 캔버스·같은 카메라·같은 픽셀 비율 — 이미지 확대가 아닌 3D 모델 교체라 흐림·비율 왜곡 없음. 투명 배경 그대로, 다크에서 배경 잔상 없음
LOAD=같은 방식 로드(GLB 19KB 작아짐). snapshot loadMs 전·후 각 10회(5폭 × 라이트·다크): 전 중앙값 70ms(46~158), 후 69.5ms(32~264) — 로딩 지연 없음
MOTION=전·후 모두 대기 동작으로 프레임이 계속 바뀜, 질문 대기(response-wait) 때 avatar-processing 켜지고 답 뒤 꺼짐, state=ready 유지
REDUCED_MOTION=prefers-reduced-motion: reduce에서 avatar-reduced-motion 클래스·ready (전후 같음)
NO_WEBGL=WebGL 없는 Chrome에서 전·후 모두 fallback 이미지(lotbi-mark-512.png = 로고 캐릭터) 표시, 빈칸 없음

EVIDENCE_DIR=D:\LOTBI-WORK\evidence\avatar-logo-align-01\
  LOGO_BEFORE_AFTER_390_1280.png — 헤더 로고 | 로고 원본 | 전 | 후 (390·1280, 라이트·다크)
  AVATAR_BEFORE_AFTER_360_375_390_412_1280.png — 5개 폭 × 라이트·다크 캐릭터 확대 전후
  MOTION_IDLE_WAIT_BEFORE_AFTER.png — 대기·질문 대기 프레임
  SCENARIO_AFTER_390.png — 아래 시나리오 화면 5장
  page\before-*/after-*-page.png — 전체 화면 20장(전 10·후 10) + report.json
  scenario\ — 시나리오 화면·json (전후)

## 사용자 시나리오 (USER_FIRST_STANDARD 8)

S1 휴대폰(390, 라이트, 비로그인) 첫 방문: 주소 열기 → 결과까지 0탭. 헤더 왼쪽 로고의 롯비와 가운데 롯비가 같은 빨간 머리 장식·빨강/파랑 귀·파란 눈으로 보임. "무엇을 도와드릴까요?"·입력창·로그인/회원가입 버튼 그대로. 막힌 곳 없음.
  스크린샷: scenario\after-chat-1-home.png (전: before-chat-1-home.png)
S2 질문 보내기: 입력창에 "안녕 롯비" → 전송 1탭 → "LOTBI가 생각 중이에요…" 동안 캐릭터 대기 동작(avatar-processing) → 답변 도착 후 대기 해제. 1탭. 막힌 곳 없음.
  스크린샷: scenario\after-chat-2-waiting.png, after-chat-3-answered.png
S3 다크 + 움직임 줄이기 설정 사용자: 첫 화면 0탭. 어두운 배경에서 캐릭터 테두리 잔상 없음, 움직임 줄이기 클래스 적용. 막힌 곳 없음.
  스크린샷: scenario\after-dark-reduced-1-home.png
S4 3D가 안 되는 기기(WebGL 없음): 첫 화면 0탭. 3D 대신 로고 캐릭터 그림이 같은 자리에 보임(빈칸·오류 화면 없음).
  스크린샷: scenario\after-no-webgl-1-home.png
S5 PC(1280) 라이트·다크: 사이드바 로고와 가운데 캐릭터 같은 롯비. 0탭.
  스크린샷: page\after-w1280-light-page.png, after-w1280-dark-page.png

USER_FIRST_CHECK=
  1 탭 수: 보는 것만 바뀜, 0탭 / 질문 1탭 그대로
  3 막다른 화면: WebGL 없을 때 로고 그림(S4)
  4 말과 화면: 로고와 캐릭터가 같은 롯비(이 작업의 목적)
  7 상태: 휴대폰 4폭·PC, 라이트·다크, 움직임 줄이기, WebGL 없음 확인. 로그인 상태는 실제 로그인으로 따라 하지 않음 — site-avatar.js에 로그인 분기가 없고 같은 요소를 그리므로 같은 모습(NOT TESTED with real login)
  11 전후 스크린샷: 위 EVIDENCE_DIR
  13 덜 된 기능: 새 메뉴·버튼 없음

## 남은 문제

1. 소유자 눈 확인 필요: 로고의 눈은 강한 빛 번짐(glow)이 있는 그림이라 3D에서는 같은 번짐을 못 냄 — 파란 곡선으로 맞추고 번짐은 약하게. 64×76px 휴대폰 자리에서는 눈이 연한 파랑으로 보임.
2. 휴대폰 자리(64×76 CSS px)가 작아 흰 줄기는 작게 보임 — 빨간 지느러미·귀 색으로 같은 캐릭터임이 드러남. 더 크게 보이려면 자리 크기 변경이 필요하고, 이번 지시("현재 위치·크기 최대한 유지")에 따라 하지 않음.
3. (이 작업 밖, 보고만) 전송 버튼 44×44px — USER_FIRST 6(48 이상)에 못 미침. 이번 변경 전과 같음.
4. 옛 V5 GLB는 캐시된 화면을 위해 남김 — 다음 정리 READY에서 삭제 가능.
5. validate_site_avatar_fallback_runtime.mjs는 Windows에서 python 서버 문제로 돌지 않음(변경 전에도 같음, CI는 Linux).

## 작업 위생

검사기·브라우저 임시 프로필은 각 스크립트 finally에서 삭제. clone 안 scripts/.*-XXXXXX 임시 폴더 없음(커밋 파일은 이름으로만 add). 줄바꿈 LF.
