READY_FOR_DEPLOY=YES

# SAFECARE SIGHTING PHOTO INTAKE 01 — Site (발견 제보 사진 형식 버그)

REPO=lotbi-site
FEATURE_BRANCH=feature/safecare-sighting-photo-intake-01-site
FEATURE_SHA=(이 문서 커밋 = branch HEAD)
REMOTE_FEATURE_SHA=(push 후 git ls-remote 값 = branch HEAD)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=8a9e414d02d6 (branch 시작점, 개발 종료 시점에도 main 동일)
CODE_SHA=a4a168012c157867825bb01d709562fa4490904b
ASSET_VERSION=aset-aeeb95efaad3 (node scripts/asset_cache_version.mjs --check PASS)

ROOT_CAUSE= SAFECARE-PHOTO-UPLOAD-FIX-03이 식별사진 칸만 고치고 발견 제보 사진 선택(site-person-ui.js renderFound)은
  옛 경로로 남겨 두었다: `PHOTO_TYPES.has(file.type)` → 형식 정보가 빈 JPG·모든 HEIC를 "JPG, PNG, WEBP 사진만…"으로
  요청 없이 차단, WebP는 변환 없이 보내져 Core(decode_identity_photo_data_uri: JPEG/PNG만)가 거부, 대용량은 Core
  본문 한도 초과, 처리 중 탭은 조용히 무시. 발견 제보는 2026-10-07 SAFECARE-WEB-SOS-SIGHTING-01로 Production에서
  켜졌으므로 실제 사용자 경로에서 재현되는 버그(Production 화면 기준 동일 코드 확인: main 8a9e414d 718행).

## 무엇이 바뀌나
- 발견 제보 사진 선택이 식별사진과 같은 site-person-photo-intake.js(preparePersonPhoto)를 쓴다: 바이트로 형식 판별,
  JPEG/PNG는 그대로, HEIC(브라우저가 열 수 있으면)·WebP·대용량은 JPEG(긴 변 2400px), 못 여는 파일은 이유 문구.
- 제보가 아직 로컬 초안이면 준비된 data URI를 보관(미리보기도 이 URI — HEIC 변환본 포함), 첫 저장(createDraftAndFlush)과
  이후 업로드 모두 같은 URI를 PUT /v2/safecare/human-sightings/{id}/photos/{slot}로 보낸다.
- 처리 중 탭·10장 초과는 이유 문구. 쓰이지 않게 된 PHOTO_ACCEPT/PHOTO_TYPES/fileDataUri 제거(화면 전체에서 MIME 필터 없음).
- scripts/validate_safecare_sighting_photo_intake_01.mjs(신규). validate_safecare_people_01은 형식 상수의 새 위치
  (site-person-photo-intake.js PERSON_PHOTO_ACCEPT, 두 선택기 공용)를 검사하도록 대상만 이동(요구 내용 동일).
- Core 변경 없음(계약 그대로 JPEG/PNG data URI).

## TEST_STATUS
- validate_safecare_sighting_photo_intake_01 PASS, SafeCare validator 6개 PASS
  (photo_upload_fix_03, human_photo_intake_gate_01, web_ui_redesign_01, safecare_people_01, person_care_real_user_01, capture_art_01)
- 전체 scripts/validate_*.mjs 186개(CHROME_BIN 지정): 실패 4개 모두 main 기준선에서도 실패하던 항목
  (calendar_system_dark_01, image_attachment_thumbnail_01, mobile_footer_legal_sheet_01, site_avatar_fallback_runtime)
- 브라우저 E2E: 발견 제보 화면에서 직접은 NOT TESTED(사용자 Production 테스트 중이라 브라우저 미사용).
  같은 준비 모듈은 FIX-03 로컬 E2E에서 빈 MIME JPG·HEIC·WebP·33MB JPG·PDF로 검증됨.
NEW_FAILURES=0
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
DEPENDENCIES=Site만(Core 변경 없음). Production Core는 이미 발견 제보 CORS 허용(SAFECARE-WEB-SOS-SIGHTING-01 배포).
READY_FOR_DEPLOY=YES

## 배포총괄방 smoke 계획
- 배포 후 asset token 확인. 안심케어 > 발견 제보하기 > 사진 추가에서 일반 JPG → 미리보기 → 제보 저장 시
  Core 로그 PUT /v2/safecare/human-sightings/{id}/photos/1 도달. (가능하면) HEIC/WebP 한 장도 동일.

USER_DECISION_NEEDED=NONE
