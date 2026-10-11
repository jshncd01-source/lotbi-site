READY_FOR_DEPLOY=YES

STATUS=첫 화면 가운데 3D 캐릭터를 로고 캐릭터(assets/brand/lotbi-mark-512.png) 그대로의 3D(v4)로 교체. 머리·얼굴판·눈·귀·뿔·몸·팔·배지를 로고 그림에서 잰 비율로 새로 만들고, 리그와 13개 동작은 V5 그대로 씀. 바닥 원판(그림자) 제거 — 로고처럼 떠 있음. Site 브라우저 탭 아이콘 6개(옛 그림)도 공식 로고 그림으로 교체. 소유자 눈 확인용 비교 그림 1장: OWNER_COMPARE_LOGO_V4.png (아래 EVIDENCE_DIR).

[LOTBI SITE AVATAR LOGO CHARACTER v4 — RELEASE HANDOFF]

TASK=SITE-AVATAR-LOGO-ALIGN-01 2차 (배포총괄방 반환: 소유자 10:4x "캐릭터가 각각 다르게 되어 있네, 하나로 통일되어야 하는데")
REPO=lotbi-site
FEATURE_BRANCH=feature/avatar-logo-align-01-site
READY_SHA=this document's commit (branch HEAD; `git ls-remote ssh://lotbi-ncloud-git/srv/git/repositories/lotbi-site.git refs/heads/feature/avatar-logo-align-01-site`)
SUPERSEDES=e144d4b3 (v3 — 색만 맞춤, 반환됨. T56 미포함)
BASE_MAIN_SHA=68b3161e695d926a4c2fc7e53d315fcb958756ac (Ncloud main, SITE-T55 운영). push 직전 ls-remote 재확인.
CHANGED_FILES(main 대비, 토큰 제외)=
  assets/models/lotbi-logo-character-v4-rigged.glb (신규, 1,067,928 bytes)
  tools/build_logo_character_v4.py (신규, GLB 생성 스크립트)
  tools/build_site_favicons.py (신규, 탭 아이콘 생성 스크립트)
  site-avatar.js (모델 주소·sha·snapshot version, 바닥 원판 코드 삭제)
  scripts/validate_site_avatar_integration.mjs (V5 봉인 단정 그대로, 새 모델 단정을 v4 기준으로)
  .github/workflows/site-review.yml (smoke 목록에 v4 GLB 1개)
  favicon.ico, favicon-16x16.png, favicon-32x32.png, apple-touch-icon.png, icon-192.png, icon-512.png (공식 로고 그림으로 다시 생성)
  이 문서
  (tools/는 .dockerignore로 배포 이미지에서 빠짐)
ASSET_VERSION=aset-dc6f9bc56bfb (`node scripts/asset_cache_version.mjs --write`, check PASS)
NEW_CSS=NONE (auth/callback/index.html 변경 불필요)
DEPLOY_SCOPE=lotbi-site only. Core 무변경. Account(web)·Admin 탭 아이콘과 App 캐릭터 그림은 각 저장소 별도 READY(아래 「전수 조사」).
DEPLOY_ORDER=단독(SITE).
CORE_CHANGED=NO / MIGRATION=NONE / ENV_CHANGE_REQUIRED=NO / NEW_SECRET_CREATED=NO / STORED_DATA_CHANGED=NO

## 무엇이 바뀌었나 — 반환 사유 7개 대응 (공식 기준 = lotbi-mark-512.png)

| # | 로고 | v3 (반려) | v4 |
|---|---|---|---|
| ① 몸 실루엣 | 아래로 좁아지는 물방울/유령형, 다리·받침 없음 | 둥근 몸 + 바닥 원판 | 콩 모양 몸, 아래 끝이 왼쪽 아래로 둥글게 모이는 꼬리, 바닥 원판 삭제(떠 있음) |
| ② 머리:몸 | 머리가 몸보다 크고 넓음 | 머리 작음 | 헬멧 머리 폭 1.87 = 몸 폭의 1.7배(검사기 단정) |
| ③ 눈 | 진한 파랑으로 빛나는 굵은 ^^ | 연하늘 얇은 선 | 흰 심 + 진한 파랑 빛 띠 + 옅은 바깥 빛(3겹) |
| ④ 귀 | 크고 두툼한 빨강(왼)·파랑(오) | 작음 | 큰 반원 귀통, 머리 옆으로 튀어나옴, 로고 빨강·파랑 |
| ⑤ 머리 장식 | 굵고 휜 빨강 뿔 | 가는 줄기 | 흰 굵은 받침 위 굵은 초승달 뿔, 오른쪽 위로 휨 |
| ⑥ 가슴 배지 | 큰 원 빨강→파랑 + 흰 테두리 | 작음 | 큰 원(로고 비율), 빛 받지 않는 색으로 로고 빨강→파랑 그대로, 빛나는 흰 테두리 |
| ⑦ 팔 | 한쪽 흔드는 날개형, 다른 쪽 아래 지느러미 | 막대 팔 | 왼쪽 아래 날개, 오른쪽 위로 든 넓은 노 모양 |
| — | 머리 7° 기울임 | 없음 | 머리·눈·귀·얼굴판 7° 기울임(로고 눈·귀 높이 차로 잼) |

## 자산·생성

USED_REFERENCE=assets/brand/lotbi-mark-512.png (sha dcdd470c…, GLB asset.extras.visualTargetSha256에 기록). 헤더 로고(lotbi-lockup-*)·글자 로고는 읽기만, 변경 0.
LOGO_MEASUREMENT=로고 512px 그림을 픽셀로 잼(머리 335×220px, 얼굴판 254×178px, 눈 55px 폭·113px 간격, 귀 높이, 뿔 끝 (363,4), 몸 폭 줄별, 배지 지름 52px, 팔 끝 위치). 좌표 = X (x−267)×0.0054, Z 2.33−y×0.0054 (모델 단위).
NEW_MODEL=assets/models/lotbi-logo-character-v4-rigged.glb
  sha256=3e2354ec52c0ee95e2571da54e67380cace6dc9297f8ece4cf87cae0b4298464
  size=1,067,928 bytes (V5 1,163,912 bytes보다 95,984 bytes 작음 — 목표 「지금 이하」 충족)
  asset.extras: derivedFrom=lotbi-faithful-v2-rigged.glb(sha fb2729f5…), visualTarget=lotbi-mark-512.png, visualStatus=LOGO_CHARACTER_V4_OWNER_REVIEW, mouth=false
GENERATOR=tools/build_logo_character_v4.py (numpy + 표준 라이브러리만. Blender 등 설치 없음, 외부 유료 도구·외부 업로드 0)
  재생성: `python tools/build_logo_character_v4.py assets/models/lotbi-faithful-v2-rigged.glb assets/models/lotbi-logo-character-v4-rigged.glb`
  결정적: 다시 만들어 sha 3e2354ec… 일치 확인
BLEND_SOURCE=없음 — 형태 전부를 스크립트가 수치(로고 측정값)로 만드는 절차적 모델이라 원본 = 스크립트 + V5 GLB(리그·동작). 손으로 조각한 .blend가 없음. 모양을 고치려면 스크립트 맨 위 수치를 바꿔 다시 생성.
RIG_AND_MOTION=V5 리그 그대로: Rig_Root/Body/Head/LeftArm/RightArm 위치·회전·부모 동일, 13개 동작(idle·blink·listening·thinking·speaking·laugh·cry·surprised·worried·excited·nod·wave·celebrate) 채널·키프레임 바이트 동일, 노드·메시 이름 동일, 런타임이 찾는 재질(EyeCyanGlow·VisorDeepBlack) 유지, 입 없음, morph 없음.
  바꾼 것 하나: 눈 회전축 2개(Rig_LeftEye/RightEye)를 새 눈 가운데로 옮김 — 깜빡임이 눈 제자리에서 감기도록. 어떤 동작도 눈 축을 이동시키지 않음(검사기 단정). 눈 메시 노드는 축을 상쇄해 정점이 모델 좌표 그대로.
  추가 재질 5개(눈 빛 2·배지 면·배지 테두리 빛·테두리 번짐) — KHR_materials_unlit(three.js GLTFLoader 기본 지원).
CAMERA=그대로(검사기가 고정한 위치·시선 유지). 모델을 그 화면 틀(모델 z −0.54~2.43) 안에 맞춤: 뿔 끝 2.315, 꼬리 끝 −0.40.
FLOOR=site-avatar.js의 바닥 원판(CircleGeometry) 삭제 — 로고 캐릭터는 바닥 없이 떠 있음. 검사기가 원판 없음을 단정.
OLD_MODEL=lotbi-faithful-v2-rigged.glb 그대로 둠(옛 site-avatar.js를 캐시한 화면용, App iOS도 이 파일을 씀). v3 GLB·v3 스크립트는 운영에 나간 적 없어 이 branch에서 삭제.

FAVICONS=tools/build_site_favicons.py가 lotbi-mark-512.png에서 생성(결정적, 재생성 sha 일치).
  favicon.ico(16·32·48·64·128·256) / favicon-16x16.png / favicon-32x32.png / icon-192.png / icon-512.png / apple-touch-icon.png(180, 흰 바탕 — iOS는 투명을 검게 채움)
  왜: 이 6개는 2026-09-19에 옛 그림(머리·가슴만, 빨간 귀 없음)으로 만든 것. Home 외 모든 페이지(404·약관·auth 등)는 /favicon.ico를 쓰고, iOS는 /apple-touch-icon.png를 스스로 가져가서 옛 그림이 보였음. Home의 lotbi-mark-* 링크는 원래 공식 그림(무변경).

## 전수 조사 — LOTBI 캐릭터가 나오는 곳 (기준 = mark-512, 각 저장소 main 기준)

| 저장소 | 어디에 보이나 | 지금 자산 | 로고와 다른 점 | 바꿀 자산 / 처리 |
|---|---|---|---|---|
| Site | 첫 화면 가운데 3D | lotbi-faithful-v2-rigged.glb (V5) | 머리 작음·둥근 몸·바닥·작은 귀·가는 장식·흐린 눈·작은 배지 | **이 READY: v4 GLB** |
| Site | 3D 실패 시 대체 그림·답변 옆 캐릭터 | assets/brand/lotbi-mark-512.png | 같음(기준) | 없음 |
| Site | 헤더·사이드바·모바일 헤더·서랍 로고, 404·약관 헤더 | lotbi-lockup(-dark)-160/320/480w.png | 같은 캐릭터 | 없음 |
| Site | 공유 이미지 og:image | assets/lotbi-og-share.png | 같은 캐릭터 | 없음 |
| Site | Home 아이콘·manifest | lotbi-mark-32/48/96/192/512.png | 같음(축소본) | 없음 |
| Site | Home 외 모든 페이지 탭 아이콘, iOS 홈 화면 | favicon.ico, apple-touch-icon.png, favicon-16/32, icon-192/512 | **옛 그림**(머리·가슴만, 빨간 귀 없음) | **이 READY: mark-512에서 다시 생성** |
| Site | 404 마스코트 | 없음(404.html은 헤더 로고만, nginx error_page 없음) | — | 디자인 방 404 시안은 화면 캡처뿐, 배포 자산 없음 |
| Site | 쓰이지 않는 옛 파일 | assets/lotbi-logo-header.png, lotbi-logo-official*(2개는 깨진 파일) | 옛 그림 | 참조 없음(검사기가 금지). 이번엔 지우지 않음 — 정리 READY 후보 |
| Account(web) | 로그인·가입·계정·설정 헤더 로고 | Site의 /brand/lotbi-lockup-* | 같은 캐릭터 | 없음 |
| Account(web) | 모든 페이지 탭 아이콘·iOS | src/app/favicon.ico, icon.png, apple-icon.png | **옛 그림**(Site 옛 파일과 바이트 동일) | **별도 READY(lotbi-web)**: 같은 생성물 |
| Admin | 직원 화면 탭 아이콘 | public/favicon.ico, favicon-16/32, apple-touch-icon.png | **옛 그림** | **별도 READY(lotbi-admin)**: 같은 생성물 |
| Admin | 로그인·헤더 | 글자 "LOTBI"만 | 캐릭터 없음 | 없음 |
| App | 홈 대기 화면 캐릭터, 홈 헤더, 답변 옆 캐릭터(Android 항상·iOS 움직임 줄이기·생각 중 3D 밑), 로그인/가입 헤더, 대화 기록 헤더 | apps/mobile/src/assets/brand/lotbi-brand-character.png (60×90) | **다른 그림**(얼굴판 더 크고 어두움, 빨간 귀 없음, 손 안 흔듦, 배지 큼) + 저해상도라 흐림 | **별도 READY(lotbi-app)**: mark-512 고해상도(@1x·@2x·@3x)로 교체, 테스트의 고정 해시 갱신 |
| App | 대화 중 3D(iOS) | lotbi-faithful-v2-rigged.glb (V5, CI가 sha 고정) | 위 V5와 같음 | 소유자가 v4 승인하면 App READY로 v4 교체 |
| App | 대화 중 3D(Android) | lotbi-refined-v1.glb (또 다른 모델) | 다른 3D | 소유자가 v4 승인하면 App READY로 v4 교체 |
| App | 런처 아이콘(Android 전 밀도·iOS AppIcon) | mipmap ic_launcher*.webp, AppIcon-* | 같은 그림(축소본) | 없음(둥근·적응형 아이콘은 별도 과제) |
| App | 알림 작은 아이콘 | 앱 아이콘을 그대로 씀 | Android가 흰 덩어리로 그림 | 별도 과제(흰 실루엣 아이콘) |
| App | 시작(스플래시) 화면 | main에 없음(흰 화면) | — | 디자인 방 FIRST-APP-01 시안은 아직 main에 없음 → 들어갈 때 mark-512 계열이면 같음 |
| App | 쓰이지 않는 옛 파일 | lotbi-main-logo.png, lotbi-home-character.png | 옛 lockup | 번들 안 됨(코드 참조 없음) |
| 디자인 방 | 시안 자산 | design/mock/assets/lotbi-mark-512 등 | Site와 바이트 동일 | 없음 |

메일 템플릿·SVG 마스코트: 네 저장소 모두 없음.

## 검사 결과 (Windows, CHROME_BIN, 하나씩 순서대로, v4 + 아이콘 트리)

SITE_TEST_RESULTS=27개 중 26 PASS
  validate_site_avatar_integration.mjs PASS (v4 단정: sha·크기≤V5·리그 노드·눈 축 상쇄·눈 축 이동 동작 없음·메시 이름·재질 유지·13동작 바이트 동일·모든 메시 화면 틀 안·머리≥몸 폭 1.5배·꼬리 왼쪽 아래·뿔 오른쪽 위·오른팔 들림·바닥 원판 없음·귀/눈 빛/뿔/배지 로고 색)
  validate_avatar_refresh_flash_01 · brand_official_logo_01 · auth_continuity_02 · bare_white_home_render_01 · home_fresh_entry_01 · mobile_home_ux_stability_01 · mobile_home_initial_scroll_01 · home_small_text_contrast_01 · sticky_topbar_01 PASS
  validate_hardening.py · home_chat.py · bare_white_home_skin_01.py · document_cache_policy_01.py · nginx_module_mime_01.py PASS
  validate_chat_media_thinking_01 · photo_input_no_camcorder_01 · pinned_conversation_section_01 · profile_menu_improvement_01 · profile_menu_personal_theme_01 · samsung_composer_keyboard_01 · theme_auto_schedule_02 · user_bubble_content_fit PASS
  validate_mobile_entry.js · product_photo_compare_01.mjs PASS (탭 아이콘·icon-192를 쓰는 검사기)
  validate_site_avatar_fallback_runtime.mjs — Windows에서 python3 http.server + Node fetch 오류(main도 같음). 서버 줄만 Node로 바꾼 사본으로 PASS(fallback 1회·RUNTIME_INIT_FAILED·canvas 0). CI(Linux)는 원본.
  validate_social_signup_profile_ux_01.mjs — FAIL(환경): "kakaoLimited viewport 390 !== 320" 등 화면 폭 설정이 적용 안 됨. **운영 main 68b3161e 작업본에서도 2/2 같은 실패**, 이 branch 2/2 같음(번갈아 실행). 이 검사기는 자체 시험 페이지라 3D·GLB·아이콘을 불러오지 않음. 같은 PC에서 오전(v3 때)엔 2/2 PASS였고, 이후 PC 과부하(배포총괄방 공지: 메모리 91%·CPU 100%) — CI(Linux)에서 확인 바람.
  asset_cache_version --check PASS
VALIDATOR_WEAKENED=NO (V5 봉인 단정·다른 검사기 무변경. v3용으로 이 branch가 넣었던 단정을 v4 기준으로 바꿈 — 노드 위치는 눈 축 2개만 예외, 이유를 단정으로 검증)

## 화면 검사 (실제 index.html, headless Chrome + SwiftShader WebGL, DPR 2)

WIDTHS=360·375·390·412(휴대폰, Android UA) + 1280(PC), 각각 라이트·다크 → v4 10/10 state=ready, 페이지 오류 0
NOT_CUT=뿔 끝·꼬리 끝 모두 캔버스 안(모델 z 2.315 / −0.40, 화면 틀 2.43 / −0.54). 축하 동작(몸 +0.09 들림)에서도 뿔 안 잘림(동작 렌더 확인)
NO_BLUR_OR_DISTORTION=같은 캔버스·카메라·픽셀 비율. 그림 확대가 아니라 3D. 투명 배경, 다크에서 테두리 잔상 없음
LOAD=snapshot loadMs 10회: 46~231ms(중앙값 약 74ms, V5 측정 중앙값 70ms) — 파일은 96KB 작음
MOTION=대기 프레임 계속 변함, 질문 대기(response-wait) 때 avatar-processing 켜지고 답 뒤 꺼짐, ready 유지. 깜빡임은 눈 제자리에서 감김, 손 흔들기·축하·생각 중·놀람 정상(ANIM_V4_*.png)
REDUCED_MOTION=avatar-reduced-motion·ready
NO_WEBGL=fallback 그림(lotbi-mark-512 = 로고) 표시, 빈칸 없음

EVIDENCE_DIR=D:\LOTBI-WORK\evidence\avatar-logo-align-01\
  OWNER_COMPARE_LOGO_V4.png — **소유자 판단용 1장**: 로고 | 3D v4 정면 | 휴대폰 실제 크기(390 홈, 헤더 로고와 함께) | 다크 | 참고: 지금 운영 중(V5)
  LOGO_VS_V4_FRONT_SITE_DARK_PHONE.png — 로고 | 정면 | 사이트 시점 | 다크 | 휴대폰 크기(라이트·다크)
  ANIM_V4_BLINK_WAVE_CELEBRATE_THINKING_SURPRISED.png — 동작 6장면
  SCENARIO_V4_390.png, scenario-v4\ — 시나리오 화면·json
  page-v4\ — v4 홈 10장 + report.json / page\before-* — 변경 전(V5) 10장
  FAVICONS_FROM_MARK512.png — 새 탭 아이콘(16·32·180·192)
  v3-superseded\ — 반려된 v3 증거(참고용)

## 사용자 시나리오 (USER_FIRST_STANDARD 8)

S1 휴대폰(390, 라이트, 비로그인) 첫 방문: 0탭. 헤더 왼쪽 로고의 롯비와 가운데 3D 롯비가 같은 모양(큰 헬멧 머리·검은 얼굴판·파란 빛 눈·빨강/파랑 귀·빨간 뿔·물방울 몸·흔드는 팔). 문구·입력창·로그인/회원가입 그대로. 막힌 곳 없음. 스크린샷 scenario-v4\v4-chat-1-home.png
S2 질문 보내기: "안녕 롯비" 입력 → 전송 1탭 → "LOTBI가 생각 중이에요…" 동안 대기 동작(avatar-processing) → 답 도착 후 해제. 1탭, 막힌 곳 없음. scenario-v4\v4-chat-2-waiting.png, v4-chat-3-answered.png
S3 다크 + 움직임 줄이기: 0탭, 어두운 배경에서 잔상 없음, 움직임 줄이기 적용. scenario-v4\v4-dark-reduced-1-home.png
S4 3D 안 되는 기기: 0탭, 같은 자리에 로고 그림. scenario-v4\v4-no-webgl-1-home.png
S5 PC 1280 라이트·다크: 사이드바 로고와 가운데 캐릭터 같은 롯비, 0탭. page-v4\v4-w1280-light-page.png, v4-w1280-dark-page.png
S6 약관·404 페이지를 탭으로 열어 둔 사용자: 브라우저 탭 아이콘이 옛 그림 → 공식 로고 그림(favicon.ico). FAVICONS_FROM_MARK512.png

USER_FIRST_CHECK= 1 탭 수 0/1탭 그대로 · 3 막다른 화면 없음(S4) · 4 로고와 화면 캐릭터 일치(이 작업 목적) · 7 휴대폰 4폭·PC·라이트·다크·움직임 줄이기·WebGL 없음 확인, 실제 로그인 상태는 NOT TESTED(site-avatar.js에 로그인 분기 없음) · 11 전후 스크린샷 있음 · 13 새 메뉴·버튼 없음

## 남은 문제

1. 소유자 눈 확인: OWNER_COMPARE_LOGO_V4.png. 로고는 사진 같은 렌더(강한 빛 번짐·반사)라 3D 실시간 화면은 그보다 단순한 광택. 형태·색·비율은 로고 측정값.
2. 같은 캐릭터 통일의 나머지(각 저장소 별도 READY): Account(web) 탭 아이콘 3개, Admin 탭 아이콘 4개, App 캐릭터 그림(lotbi-brand-character.png). App 대화 3D(iOS V5·Android refined-v1)는 소유자가 v4를 승인하면 v4로 교체.
3. 범위 밖 보고만: 전송 버튼 44×44px(USER_FIRST 6 미달, 변경 전과 같음). Site의 안 쓰는 옛 그림 파일 4개 정리 후보.
4. validate_social_signup_profile_ux_01은 지금 이 PC에서 main도 실패(환경) — CI 결과로 확인.

## 작업 위생

검사기·브라우저 임시 프로필은 finally에서 삭제. 커밋 파일은 이름으로만 add(scripts/.*-XXXXXX 없음). 줄바꿈 LF.
