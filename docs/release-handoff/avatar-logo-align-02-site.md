READY_FOR_DEPLOY=YES

STATUS=첫 화면 가운데 3D 캐릭터를 로고 캐릭터(assets/brand/lotbi-mark-512.png) 그대로의 3D(v5)로 교체. v4 반려 사유 5개(눈·꼬리 몸·팔 모양·비율/광택·팔 이음새)를 로고 그림과 겹쳐 재며 다시 만듦. 리그·13개 동작 V5 그대로. 바닥 원판 없음(떠 있음), 캐릭터가 카메라를 정면으로 봄. 소유자 판단용 1장: OWNER_COMPARE_LOGO_V5.png (아래 EVIDENCE_DIR).

[LOTBI SITE AVATAR LOGO CHARACTER v5 — RELEASE HANDOFF]

TASK=SITE-AVATAR-LOGO-ALIGN-02 (배포총괄방 반환: 소유자 "똑같아 보이냐", "팔이 잘려나갔다")
REPO=lotbi-site
FEATURE_BRANCH=feature/avatar-logo-align-02-site
READY_SHA=this document's commit (branch HEAD; `git ls-remote ssh://lotbi-ncloud-git/srv/git/repositories/lotbi-site.git refs/heads/feature/avatar-logo-align-02-site`)
BASE_MAIN_SHA=b09f6e4d21096a4f897d5ba82b958fc5dc384d35 (SITE-T56 수정본 — v4·아이콘 revert 반영 main, 배포총괄방 지정)
SUPERSEDES=v4 (feature/avatar-logo-align-01-site, 운영 미배포·revert)
CHANGED_FILES(main 대비, 토큰 제외)=
  assets/models/lotbi-logo-character-v5-rigged.glb (신규, 978,296 bytes)
  tools/build_logo_character_v5.py (신규, GLB 생성 스크립트 — tools/는 배포 이미지에서 빠짐)
  site-avatar.js (모델 주소·sha·snapshot version, 바닥 원판 삭제, 카메라 쪽으로 12° 돌리기 1줄)
  scripts/validate_site_avatar_integration.mjs (V5 봉인 단정 그대로 + v5 단정 추가, 토큰 목록에 회전 1줄)
  .github/workflows/site-review.yml (smoke 목록에 v5 GLB 1개)
  이 문서
ASSET_VERSION=aset-a10e33ef5933 (`node scripts/asset_cache_version.mjs --write`, check PASS targets=169 refs=206)
NEW_CSS=NONE
DEPLOY_SCOPE=lotbi-site only. 탭 아이콘·다크 헤더 로고는 별도 READY feature/brand-mark-clean-alpha-01-site(정지 그림, 순서 무관).
CORE_CHANGED=NO / MIGRATION=NONE / ENV_CHANGE_REQUIRED=NO / NEW_SECRET_CREATED=NO / STORED_DATA_CHANGED=NO

## 반려 사유 5개 → v5

| # | 로고 | v4 (반려) | v5 |
|---|---|---|---|
| 1 눈 | 검은 얼굴판 위 얇게 빛나는 파란 호 하나 | 굵은 이중 링(무지개처럼) | 얇은 호 하나(흰 심) + 유리 위에 퍼지는 은은한 파란 빛 3겹(경계선 없음). 눈 위치 로고와 2~3px 차 |
| 2 몸 아래 | 아래로 갈수록 좁아지며 왼쪽으로 휘는 꼬리 | 바닥이 둥근 캡슐 | 로고 줄별 폭으로 다시: 목 아래 좁고 왼쪽으로 기울며, 아래가 넓다가 왼쪽 아래 둥근 꼬리로 모임(꼬리 부분 겹침 0.947) |
| 3 팔 | 왼팔 납작한 날개, 오른팔 들어 흔드는 손 | 짧은 원통 팔 | 왼쪽: 몸 옆면 긴 이음새에 붙은 넓고 납작한 날개가 왼쪽 아래로. 오른쪽: 위로 든 넓은 노(손) |
| 4 비율·광택 | 머리가 몸보다 훨씬 큼, 얼굴판 반사광, 가슴 원 빛 테두리 | 몸 길고 얼굴판·가슴 평평 | 머리 폭 = 몸 폭 1.6배(검사기 단정), 얼굴판 왼쪽 위 유리 반사 + 아래 옅은 테두리 빛, 가슴 원 정면으로 둥글게(지름 로고와 같음) + 빛나는 흰 테두리 2겹 번짐 |
| 5 팔 이음새 | 팔이 몸에 붙음 | 몸과 떨어지고 검은 점·틈 | 팔이 몸 안에서 시작(검사기 단정: 팔 안쪽 끝이 같은 높이 몸 가장자리보다 0.05 이상 안쪽), 어두운 관절 공 없음(흰 어깨 받침, JointDark 미사용 단정), 팔 회전축을 새 팔 뿌리로 옮겨 동작 중에도 붙어 있음 |

추가: 머리 윤곽을 로고처럼 둥글게, 귀를 머리에 더 붙임(로고 귀 위치와 1~5px 차), 뿔 아래 흰 받침(낮은 혹 + 짧은 기둥), 머리·몸 왼쪽 분홍·오른쪽 파랑 가장자리 빛, 흰색 더 밝게. 바닥 원판 삭제. site-avatar.js에서 캐릭터를 카메라 쪽으로 12° 돌림(카메라가 무대 오른쪽에 있어 옆모습이 보이던 것 — 로고는 정면 그림. 카메라 위치·시선은 검사기 고정값 그대로).

## 로고 겹침 비교 (정면, 원근 없는 카메라로 로고와 같은 512px 좌표에 렌더)

| 부위 | v4 IoU | v5 IoU |
|---|---|---|
| 전체 | 0.830 | 0.919 |
| 뿔·받침 (y<95) | 0.687 | 0.735 |
| 머리 (y 95-305) | 0.883 | 0.936 |
| 몸·팔 (y 305-512) | 0.782 | 0.929 |
| 왼팔 날개 | 0.521 | 0.846 |
| 오른팔 | 0.595 | 0.828 |
| 몸 아래 꼬리 | 0.905 | 0.947 |

| 위치 (로고 px) | 로고 | v5 |
|---|---|---|
| 얼굴판 상자 | 144-399 × 113-284 | 142-390 × 115-285 |
| 왼눈·오른눈 중심 | (217,202)·(335,217) | (214,202)·(334,219) |
| 뿔 상자 | 269-364 × 0-54 | 267-365 × 1-56 |
| 왼귀 상자 | 90-121 × 146-244 | 89-124 × 140-237 |
| 가슴 원 중심 | (250,380) | (250,379) |
| 전체 상자 | 62-448 × 0-511 | 58-448 × 1-511 |

남은 차이: 뿔 받침(로고는 받침이 더 넓게 머리와 이어짐), 로고는 사진 같은 렌더(강한 빛 번짐·반사)라 3D 실시간 광택은 더 단순함.

## 자산·생성

NEW_MODEL=assets/models/lotbi-logo-character-v5-rigged.glb
  sha256=2c1576a6a29cffb8f006b4ce0497906792efa356191e7ec2d57c5e0bf3f6e8a8
  size=978,296 bytes (V5 1,163,912 bytes보다 185,616 bytes 작음)
  asset.extras: derivedFrom=lotbi-faithful-v2-rigged.glb(sha fb2729f5…), visualTarget=lotbi-mark-512.png, visualStatus=LOGO_CHARACTER_V5_OWNER_REVIEW, mouth=false
GENERATOR=tools/build_logo_character_v5.py (numpy + 표준 라이브러리. Blender 등 설치 없음, 외부 유료·업로드 0)
  재생성: `python tools/build_logo_character_v5.py assets/models/lotbi-faithful-v2-rigged.glb assets/models/lotbi-logo-character-v5-rigged.glb` — 결정적(다시 만들어 sha 일치)
BLEND_SOURCE=없음 — 로고 측정값으로 형태를 만드는 절차적 모델, 원본 = 스크립트 + V5 GLB(리그·동작).
RIG_AND_MOTION=V5 리그: Rig_Root/Body/Head 위치·회전·부모 동일, 13개 동작 채널·키프레임 바이트 동일, 노드·메시 이름 동일, 런타임 재질(EyeCyanGlow·VisorDeepBlack) 유지, 입·morph 없음. 옮긴 것: 눈 회전축 2개(새 눈 가운데), 팔 회전축 2개(새 팔 뿌리) — 어떤 동작도 이 축들을 이동시키지 않음(검사기 단정), 자식 메시 노드가 축을 상쇄해 정점은 모델 좌표 그대로(단정).
CAMERA=그대로(검사기 고정). 모델은 화면 틀(모델 z −0.54~2.43) 안: 모든 메시 2.375 이하·−0.48 이상(단정).
OLD_MODEL=lotbi-faithful-v2-rigged.glb 그대로(캐시된 옛 화면용·App iOS 사용).

## 검사 (Windows, 운영 기준 tree = 68b3161e + 이 변경으로 확인, 작업 자리표 사용)

SITE_TEST_RESULTS=27개 모두 PASS (운영 기준 tree 68b3161e + 이 변경, 하나씩, 작업 자리표)
  validate_site_avatar_integration.mjs PASS ("… + LOGO-ALIGN-02 CONTRACT PASS": sha·크기≤V5·노드·옮긴 축 상쇄·축 이동 동작 없음·메시 이름·재질 유지·13동작 바이트 동일·모든 메시 화면 틀 안·머리≥몸 폭 1.5배·꼬리 왼쪽 아래·뿔 오른쪽 위·오른팔 들림·양팔이 몸 안에서 시작·어두운 관절 없음·바닥 원판 없음·카메라 쪽 회전·귀/눈 빛/얼굴판 반사/뿔/배지)
  validate_avatar_refresh_flash_01 · brand_official_logo_01 · auth_continuity_02 · bare_white_home_render_01 · home_fresh_entry_01 · mobile_home_ux_stability_01 · mobile_home_initial_scroll_01 · home_small_text_contrast_01 · sticky_topbar_01 PASS
  validate_hardening.py · home_chat.py · bare_white_home_skin_01.py · document_cache_policy_01.py · nginx_module_mime_01.py · site.py PASS
  validate_chat_media_thinking_01 · photo_input_no_camcorder_01 · pinned_conversation_section_01 · profile_menu_improvement_01 · profile_menu_personal_theme_01 · samsung_composer_keyboard_01 · social_signup_profile_ux_01 · theme_auto_schedule_02 · user_bubble_content_fit · mobile_entry.js PASS
  validate_site_avatar_fallback_runtime.mjs — Windows에서는 python3 http.server + Node fetch 오류(main도 같음)라 서버 줄만 Node로 바꾼 사본으로 PASS(fallback 1회·RUNTIME_INIT_FAILED·canvas 0). CI(Linux)는 원본.
  asset_cache_version --check PASS
NEW_MAIN_RETEST(b09f6e4d 위 이 branch)=site_avatar_integration·avatar_refresh_flash_01·brand_official_logo_01·auth_continuity_02·bare_white_home_render_01·home_fresh_entry_01·mobile_home_ux_stability_01·mobile_home_initial_scroll_01·home_small_text_contrast_01·sticky_topbar_01·hardening.py·home_chat.py·bare_white_home_skin_01.py·document_cache_policy_01.py·nginx_module_mime_01.py·site.py·mobile_entry.js 17/17 PASS + fallback_runtime(Windows 사본) PASS + asset check PASS
VALIDATOR_WEAKENED=NO (V5 봉인 단정·다른 검사기 무변경, v5 단정 추가만)

## 화면 검사

HOME=실제 index.html, headless Chrome+SwiftShader, DPR 2: 360·375·390·412·1280 × 라이트·다크 10/10 ready, 페이지 오류 0
ARM_SEAMS=정지·다크·옆 −30°·옆 +30°·손 흔들기·축하(최대)·신남(최대) 7장면 × 양팔 4배 확대 — 틈·검은 점 없음 (ARM_SEAMS_4X_V5.png)
MOTION=대기 프레임 변함, 질문 대기(response-wait) 때 avatar-processing 켜지고 답 뒤 꺼짐, ready 유지. 깜빡임은 눈 제자리에서 감김
NO_WEBGL=fallback 그림(lotbi-mark-512) 표시, 빈칸 없음
SIZE=GLB 978KB(V5보다 작음)

EVIDENCE_DIR=D:\LOTBI-WORK\evidence\avatar-logo-align-02\
  OWNER_COMPARE_LOGO_V5.png — **소유자 판단용 1장**: 로고 | v5 정면 | 로고·v5 반투명 겹침 | 휴대폰 390 홈 라이트(헤더 로고와 함께) | 다크 | 참고: 지금 운영
  LOGO_OVERLAY_V5_FRONT.png (+.json) — 로고 | v5 정면 | 겹침(보라=로고만, 초록=3D만) | 반투명 / LOGO_OVERLAY_V4_FRONT_before.png — 같은 비교 v4
  ARM_SEAMS_4X_V5.png — 팔 이음새 4배
  V5_FRONT_SITE_DARK_YAW_PHONE.png — 로고 | 정면 | 사이트 시점 | 다크 | 옆 −30° | 옆 +30° | 휴대폰 크기 라이트·다크
  page-v5\ — 홈 10장 + report.json, scenario-v5\ — 시나리오 화면·json, motion-v5\ — 움직임 프레임·json

## 사용자 시나리오 (USER_FIRST 8 — 처음 보는 사람이 로고와 같은 캐릭터로 바로 알아봄)

S1 휴대폰 390 라이트, 처음 방문: 0탭 — 왼쪽 위 로고의 롯비와 가운데 3D 롯비가 같은 모습(큰 헬멧 머리·검은 얼굴판·얇게 빛나는 파란 눈·빨강/파랑 귀·빨간 뿔·서양배 몸·왼쪽 날개·든 오른손·빨강→파랑 가슴 원). 막힌 곳 없음. scenario-v5\v5-chat-1-home.png, OWNER_COMPARE_LOGO_V5.png 4번째
S2 질문 보내기: 입력 → 전송 1탭 → "LOTBI가 생각 중이에요…" 동안 대기 동작 → 답 뒤 해제. 막힌 곳 없음. scenario-v5\v5-chat-2-waiting.png, v5-chat-3-answered.png
S3 다크 + 움직임 줄이기: 0탭, 어두운 배경에서 팔 이음새·테두리 잔상 없음. scenario-v5\v5-dark-reduced-1-home.png
S4 3D 안 되는 기기: 0탭, 같은 자리에 로고 그림. scenario-v5\v5-no-webgl-1-home.png
S5 PC 1280 라이트·다크: 사이드바 로고와 같은 롯비, 0탭. page-v5\v5-w1280-light-page.png, v5-w1280-dark-page.png

## 남은 문제

1. 소유자 눈 확인: OWNER_COMPARE_LOGO_V5.png.
2. 다크 헤더 로고 캐릭터의 검은 틈은 이 READY 밖 — feature/brand-mark-clean-alpha-01-site에서 고침(OWNER 그림의 다크 헤더는 아직 고치기 전 main 모습).
3. App 대화 3D(iOS V5·Android refined-v1)는 소유자가 v5 승인하면 App READY로 교체.
4. 범위 밖: 전송 버튼 44×44px.
