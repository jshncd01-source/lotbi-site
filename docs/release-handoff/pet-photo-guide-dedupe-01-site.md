READY_FOR_DEPLOY=YES

# pet-photo-guide-dedupe-01-site — release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/pet-photo-guide-dedupe-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD)
REMOTE_FEATURE_SHA=FEATURE_SHA와 동일(`git ls-remote origin refs/heads/feature/pet-photo-guide-dedupe-01-site`로 확인)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=fb12f8031cfbf1ce3887202cff7e27ab68b4b1b2 (c26da697에서 정상 merge. 첫 base ce132b3c)
CODE_SHA=80c93d84
ASSET_VERSION=aset-51ec5061fe5f
MERGED_TO_MAIN=NO
DEPLOYED=NO
CORE_CHANGE=NONE (Site만. 배포 순서 제약 없음)

## 무엇을 고쳤나 (사용자가 Production lotbiai.com 반려동물 등록 화면에서 지적, 2026-10-07)

### 1. 사진 10장 단계의 중복 안내 박스 (71be18b6)
- 제목 아래 회색 박스를 없앴다. 박스에는 강아지 그림, "촬영 안내 · 서로 다른 방향 10장" 제목, 1~10 방향 지도가 있었다.
- 아래 10개 타일이 같은 예시 그림·이름·설명을 이미 보여 준다.
- 남긴 것은 "왜 10방향인지" 한 줄이다(`safecare-guide-compact`).
- 같은 함수를 쓰는 "사진 갱신·관리" 화면도 같이 정리된다.

### 2. 타일 예시 그림이 비어 보이던 문제 (71be18b6)
- 원인: 예시가 1254px PNG(20장 합계 35MB)였고, lazy 로딩이라 아래쪽 타일이 빈칸으로 보였다.
- `assets/pet/*-v2.webp` 20장을 추가했다(480px, 알파 유지, 합계 0.9MB).
- 10장 모두 단계가 열릴 때 바로 받는다(`loading='eager'`).
- v1 PNG 원본은 저장소에 그대로 둔다.

### 3. 등록 화면을 사람 등록과 같게 (a1cd27e7)
- 전에는 등록 화면이 목록 아래에 붙어 열렸고, 저장된 초안은 "등록 계속"을 누르면 사진 단계로 바로 갔다.
- 이제 등록 중에는 목록과 발견 제보 안내를 숨기고 등록 화면만 보인다.
- 위에 "← 목록으로"가 있다. 기존 "나중에 계속"을 대체하며, 초안은 자동 저장되고 목록 버튼은 "등록 계속"이 된다.
- 열 때마다 1단계 기본정보부터 시작한다. 새 초안이든 이어서 하는 초안이든 같고, 저장된 값이 채워져 있다.
- "다음"을 누르면 초안이 실제로 있던 단계로 간다.
- 단계 표시는 사람 등록과 같은 공용 stepper(`safecare-step*`)를 쓴다.

### 4. 사진 칸을 순서대로 열기 (80c93d84)
- 전에는 1번 얼굴 정면이 확인되면 2~10번이 한꺼번에 열려 아무 칸이나 고를 수 있었다.
- 이제 화면에 보이는 순서대로 한 칸씩 열린다.
  - 1번 확인 뒤 2번이 열린다.
  - 그다음은 앞 칸에 사진이 올라가면(확인 실패가 아니면) 다음 칸이 열린다.
- 이미 사진이 있는 칸은 교체·삭제할 수 있게 열어 둔다.
- 안내 문구:
  - 위 배너가 다음에 올릴 칸을 알려 준다(예: "이제 2번 얼굴 왼쪽 사진을 올려 주세요").
  - 잠긴 칸에는 무엇을 하면 열리는지 적는다(예: "2번 얼굴 왼쪽 사진을 올리면 열려요").
- 강아지·고양이 모두 같은 순서 목록(`PET_PHOTO_DISPLAY_ORDER`)을 쓴다.
- 등록 초안 화면에만 적용했다. 이미 등록된 반려동물의 "사진 갱신·관리"는 바꾸지 않았다(칸별 교체 그대로).
- Core는 1번(얼굴 정면) 확인 게이트만 강제하고 이후 순서는 강제하지 않는다. 그래서 이 순서는 화면에서만 지킨다.

## MERGE (main fb12f803 → c26da697)
- 충돌 59개 파일 중 58개는 asset token만 달라 main 쪽을 택했다.
- `site-pet-ui.js`는 main 변경이 token뿐이라 이 branch 쪽을 택했다.
- 최종 tree에서 `asset_cache_version.mjs --write`로 token을 다시 만들었다.
- token을 빼고 main과 다른 파일은 이 작업의 27개뿐이다(WebP 20, 코드 3, validator 3, 이 문서).

## TEST_STATUS (Windows, Chrome headless, `CHROME_BIN` 지정, CODE_SHA 기준)

| validator | 결과 |
|---|---|
| validate_pet_family_web_01 | PASS |
| validate_safecare_web_ui_redesign_01 (desktop-1440, mobile-390) | PASS |
| validate_pet_photo_source_selector_01 (Android/iOS/Desktop headless) | PASS |
| validate_pet_slot_guide_art_01 | PASS |
| validate_pet_family_v2_registration_01 | PASS |
| validate_pet_family_v2_profile_match_01 | PASS |
| validate_pet_species_gate_web_01 | PASS |
| validate_safecare_capture_art_01 | PASS |
| validate_safecare_photo_upload_fix_03 | PASS |
| validate_life_animal_hospital_01 | PASS |
| validate_consumer_detail_system_01 | PASS |
| validate_place_card_carousel_no_drift_01 (main에서 들어온 것) | PASS |
| asset_cache_version (coherence) | PASS |

validator 변경:
- 타일 예시: v2 WebP 매핑, 형식(VP8X·알파·480px·10~120KB), eager 로딩을 검사한다.
- 사진 단계: 중복 그림·제목·방향 지도가 0개다. 종 확인은 타일 예시 그림으로 한다.
- 등록 화면:
  - 등록 중 목록이 숨겨지고 "← 목록으로"가 있다.
  - 공용 stepper를 쓴다.
  - 목록으로 돌아가면 "등록 계속"이 보인다.
  - 다시 열면 1단계 기본정보에 저장값(이름·종)이 있다.
- 순서: 1번 확인 뒤 2번만 열리고, 3~10번은 잠겨 있고 이유를 적는다. 2번을 올리면 3번만 열리고, 4번·9번은 잠겨 있다.

화면 확인(validator 스크린샷):
- desktop/mobile 사진 단계: 중복 박스가 없고 예시 10장이 모두 보인다.
- 이어서 하기: 1단계 기본정보에 저장값이 채워져 있고 목록은 숨겨져 있다.

실기기(Android/iPhone) 확인은 하지 않았다.

## 배포방 참고
- nginx 기본 mime.types에 `image/webp`가 있다. CSP `img-src` 제한은 없다.
- release branch 충돌 시: token만 다른 파일은 최종 tree에서 `asset_cache_version.mjs --write`로 다시 만든다.
- `site-safecare-guide-art.js`는 이제 반려동물 화면에서 import하지 않는다. validator·workflow가 참조하므로 파일은 남겼다.

## USER_DECISION_NEEDED=NONE
