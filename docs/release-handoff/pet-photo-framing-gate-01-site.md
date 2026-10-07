READY_FOR_DEPLOY=YES

# PET PHOTO FRAMING GATE 01 — Site (몸 사진 거부 사유 문구)

REPO=lotbi-site
FEATURE_BRANCH=feature/pet-photo-framing-gate-01-site
FEATURE_SHA=(이 문서 커밋 = branch HEAD)
REMOTE_FEATURE_SHA=(push 후 git ls-remote 값 = branch HEAD)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=8a9e414d02d6 (branch 시작점, 개발 종료 시점에도 main 동일)
CODE_SHA=7af78eb96fa2ab5cda855b750b8cc43b47daaf69
ASSET_VERSION=aset-9e997aa439b1 (node scripts/asset_cache_version.mjs --check PASS)

ROOT_CAUSE= Core가 BODY_LEFT/BODY_RIGHT/BACK_REAR 사진에 몸 전체가 없으면 새 코드로 거부하게 되었다
  (feature/pet-photo-framing-gate-01-core). Site 문구표(site-pet.js PET_ERROR_MESSAGES)에 없으면
  "사진은 초안에 저장됐지만 확인을 통과하지 못했어요"만 보여 무엇을 다시 찍을지 알 수 없다.

## 무엇이 바뀌나
- site-pet.js PET_ERROR_MESSAGES 4개 추가:
  PET_PHOTO_BODY_NOT_WHOLE "몸 전체가 사진에 다 들어오지 않았어요. 머리부터 꼬리, 네 다리까지 한 장에 담기도록 조금 떨어져서 다시 찍어 주세요."
  PET_PHOTO_BODY_TOO_SMALL "반려동물이 너무 작게 나왔어요. 몸 전체가 화면을 채우도록 조금 더 가까이에서 찍어 주세요."
  PET_PHOTO_BODY_NOT_SIDE "옆모습 사진이 아니에요. 반려동물 눈높이에서 옆으로 서서, 머리부터 꼬리까지 보이게 찍어 주세요."
  PET_PHOTO_BODY_NOT_REAR "뒷모습 사진이 아니에요. 바로 뒤에서 등·꼬리·뒷다리가 모두 보이게 찍어 주세요."
  등록 초안 사진 칸(petDraftPhotoInspectionMessage)과 업로드 오류 둘 다 이 문구를 쓴다. 다시 찍기 버튼은 그대로.
- scripts/validate_pet_photo_framing_gate_01.mjs(신규). asset token 재생성.

## TEST_STATUS
- validate_pet_photo_framing_gate_01 PASS (4개 문구 존재·한국어·내용, 초안 칸 표시, 버튼 라벨, ACCEPTED 불변)
- 기존 반려동물 validator PASS: pet_species_gate_web_01, pet_family_web_01, pet_slot_guide_art_01,
  pet_photo_source_selector_01(headless, 실기기 DEFERRED 문구 그대로), pet_family_v2_registration_01,
  pet_family_v2_profile_match_01 (CHROME_BIN 지정)
NEW_FAILURES=0
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
DEPENDENCIES=Core feature/pet-photo-framing-gate-01-core와 짝. Site만 먼저 배포돼도 무해(새 코드가 오기 전엔 쓰이지 않음).
READY_FOR_DEPLOY=YES

## 배포총괄방 smoke 계획
- 배포 후 asset token 확인, 반려동물 등록 2단계 "몸 왼쪽"에 몸 일부만 나온 사진 → 위 NOT_WHOLE 문구 표시.

USER_DECISION_NEEDED=NONE
