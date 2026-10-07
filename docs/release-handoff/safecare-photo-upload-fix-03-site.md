READY_FOR_DEPLOY=YES

# SAFECARE PHOTO UPLOAD FIX 03 — Site (새 식별사진이 Core에 닿지 않던 문제 + 각도 안내)

REPO=lotbi-site
FEATURE_BRANCH=feature/safecare-photo-upload-fix-03-site
FEATURE_SHA=(이 문서 커밋 = branch HEAD)
REMOTE_FEATURE_SHA=(push 후 git ls-remote 값 = branch HEAD)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=a9affcd5ac88 (시작점 131b775d, 개발 중 main이 a9affcd5로 이동 → 04ecb0d1로 정상 merge, 실제 충돌 2건은 import 줄: site-person-ui.js는 이 branch, site-conversation.js는 main 쪽 유지; 나머지 56건은 asset token만)
CODE_SHA=04ecb0d19b3f5ed1abe0350a1325489fb6c890dd
ASSET_VERSION=aset-5fe7088d75dd (merge 후 재생성, node scripts/asset_cache_version.mjs --check PASS)

ROOT_CAUSE=
- (A) 확정·Production 재현(Site 131b775d, 2026-10-07): site-person-ui.js 형식 검사
  `PHOTO_TYPES.has(file.type)`가 file.type이 빈 JPG와 모든 HEIC를 "JPG, PNG, WEBP 사진만
  등록할 수 있습니다."로 막고 요청을 보내지 않았다(합성 파일 주입, fetch 0건 확인).
  WebP는 Site를 통과했지만 Core가 JPEG/PNG만 받아 거부. 대용량 사진은 축소 없이 Core 413.
- (D) 파일 읽기 실패 시 게이트 거부 문구("안내 그림과 같은 방향…")가 나와 원인을 오인하게 함.
- (C) 업로드 중 다른 칸 탭은 아무 반응 없이 무시(조용한 return).
- (B) 잠금은 정상 동작(정면 없으면 버튼 비활성 + 안내 문구) — 변경 없음.
- 실사용자 PC 웹 재현(2026-10-07 08:21~08:29 KST): JPG는 Core에 도달했고, 실제 45도
  사진 3장이 Core에서 WRONG_POSE로 거부됨 → Core 원인(feature/safecare-photo-upload-fix-03-core).
  "촬영 방향이 맞지 않습니다" 문구만으로는 너무/덜/반대 방향을 구분할 수 없어 안내도 보강.

## 무엇이 바뀌나
- site-person-photo-intake.js(신규): 첫 바이트(magic bytes)로 형식 판정 → 확장자/MIME 보조.
  JPEG/PNG이고 8MB 이하·Core 한도(8192px, 40MP) 안이면 원본 그대로(형식 라벨만 교정),
  그 외(HEIC를 여는 브라우저, WebP, 대용량)는 JPEG(긴 변 2400px, q0.9)로 변환.
  못 여는 HEIC는 "아이폰 설정 › 카메라 › 포맷 › 높은 호환성 / 갤럭시 고효율 사진 끄기" 안내,
  사진이 아닌 파일·읽기 실패도 각각의 문구.
- site-person-ui.js: 식별사진 칸이 업로드 전에 위 모듈을 거침. 처리 중/잠금 탭도 문구 표시.
  (발견 제보 작성기의 사진 입력은 기존 그대로 — Production에서 발견 제보는 "준비 중")
- site-person-guides.js: 45도·옆면·추가 칸 안내를 "화면 왼쪽/오른쪽" 기준과
  "두 눈·코·입이 모두 보여야" 등으로 구체화. 모든 칸에 "보여야 하는 부분" 추가.
- site-person.js: WRONG_POSE를 칸별 문구로(45도 각도가 아닙니다 / 옆면 사진이 아닙니다 /
  정면 사진이 아닙니다), 45도·옆면 칸의 NO_FACE도 칸별 문구. 칸 정보 없을 때 기존 문구 유지.
- site-safecare.css: "보여야 하는 부분" 상자 스타일(theme token 사용).
- scripts/validate_safecare_photo_upload_fix_03.mjs(신규): 합성 바이트만 사용.

## TEST_STATUS
- 신규 validate_safecare_photo_upload_fix_03 PASS: 빈 MIME JPG/PNG, HEIC(변환 성공·불가),
  WebP, 8MB 초과·40MP 초과 축소(2400px), 읽기 실패, 빈 파일, PDF, 처리 중·잠금 탭 문구,
  finally busy 해제, 칸별 안내·보여야 하는 부분, 칸별 WRONG_POSE·NO_FACE 문구, 내부값 비노출.
- SafeCare 기존 validator 전부 PASS: human_photo_intake_gate_01, capture_art_01,
  web_ui_redesign_01, safecare_people_01, person_care_real_user_01.
- main a9affcd5 merge 후 전체 scripts/validate_*.mjs 179개(CHROME_BIN 지정): 실패 5개 모두 main 기준선에서도
  실패하던 항목(calendar_system_dark_01, image_attachment_thumbnail_01, mobile_footer_legal_sheet_01,
  place_card_compact_01, site_avatar_fallback_runtime). 새로 들어온 validate_kakao_share_fallback_01 PASS.
- merge 전 178개를 branch와 main 131b775d에서 비교:
  branch에서만 실패한 3개(calendar_modal_runtime_02, calendar_quiet_location_01,
  global_location_foundation_01)는 단독 재실행 PASS(병렬 부하), 나머지 6개는 main에서도
  동일 실패(calendar_editor_field_height_01, calendar_system_dark_01,
  image_attachment_thumbnail_01, mobile_footer_legal_sheet_01, read_aloud_controller_01,
  site_avatar_fallback_runtime).
- 로컬 E2E(로컬 Site fix-03 + 로컬 Core fix-03, 로컬 전용 DB·테스트 계정):
  합성 파일로 빈 MIME JPG·WebP·33MB JPG가 Core에 data:image/jpeg로 도달, HEIC·PDF는 안내 문구.
  사용자가 직접 실제 사진을 선택해 10칸 전부 통과 → 실종 상태 전환 성공.
  (실제 사진은 저장소·로그·fixture에 없음)
NEW_FAILURES=0
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
DEPENDENCIES=Site 단독 배포 가능(형식·변환·문구는 Core e58cabcf에서도 동작). 실제 45도 사진이
  통과하려면 Core feature/safecare-photo-upload-fix-03-core 배포가 필요 — Core 먼저 또는 동시 권장.
  Core 배포 전이면 45도 칸은 계속 거부되지만 문구는 칸별로 나온다.
READY_FOR_DEPLOY=YES

## 배포총괄방 smoke 계획
- 배포 후 Production asset token = aset-5fe7088d75dd 확인(merge gate가 다시 만들면 그 값).
- 로그인 상태 안심케어 > 사진 등록: 칸 아래 "보여야 하는 부분" 표시, 45도 안내 "화면 왼쪽을 바라보도록".
- 새 JPG 업로드 → Core 로그에 PUT /v2/person-profiles/{id}/identity-photos/{slot} 도달·판정 결과.
- 빈 MIME(또는 HEIC) 파일: 브라우저 콘솔 주입 또는 실제 파일 — 빈 MIME JPG는 PUT 도달,
  Chrome의 HEIC는 '높은 호환성' 안내 문구(요청 없음).

USER_DECISION_NEEDED=NONE
