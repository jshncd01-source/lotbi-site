READY_FOR_DEPLOY=YES

# pet-photo-guide-dedupe-01-site — release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/pet-photo-guide-dedupe-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD)
REMOTE_FEATURE_SHA=FEATURE_SHA와 동일(`git ls-remote origin refs/heads/feature/pet-photo-guide-dedupe-01-site`로 확인)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=ce132b3cc343738434c0b8e3a6a4e03f1a24d664 (branch base, push 직전 fresh ls-remote에서도 동일)
CODE_SHA=71be18b6
ASSET_VERSION=aset-096b9ae8f165
MERGED_TO_MAIN=NO
DEPLOYED=NO
CORE_CHANGE=NONE (Site만. 배포 순서 제약 없음)

## 문제 (사용자가 Production lotbiai.com 반려동물 등록 화면에서 지적, 2026-10-07)

1. 사진 10장 단계에서 위쪽에 안내가 두 번 나왔다.
   - 제목 "강아지 식별 사진 10장을 등록해 주세요" 아래에 회색 박스가 또 있었다.
   - 박스 안에는 강아지 그림, "강아지 촬영 안내 · 서로 다른 방향 10장" 제목, 1~10 방향 지도가 있었다.
   - 바로 아래 10개 타일이 이미 방향별 예시 그림·이름·촬영 설명을 보여 주고 있어 같은 내용이 겹쳤다.
2. 일부 타일(4·5·10번 등) 예시 그림이 비어 보였다.
   - 예시 그림은 1254px PNG 20장(합계 35MB, 장당 1~2.6MB)이었다. 화면에는 약 150 CSS px로 표시된다.
   - `loading='lazy'`라 스크롤 아래 타일은 늦게 받아졌다. 큰 파일이라 받는 동안 빈칸으로 보였다.

## FIX

- `site-pet-ui.js` `petPhotoGuide()`: 회색 박스(그림·"촬영 안내" 제목·방향 지도)를 없앴다.
  - 남긴 것은 "왜 10방향인지" 한 줄뿐이다(`section.safecare-guide.safecare-guide-compact`).
  - `data-safecare-guide="dog|cat"`는 유지했다.
  - 같은 함수를 쓰는 기존 반려동물의 "사진 갱신·관리" 화면에도 똑같이 적용된다.
  - 쓰이지 않게 된 import 2개(`createSafeCareGuideArtwork`, `petPhotoSlotDiagram`)를 뺐다.
- `site-safecare.css`: `.safecare-guide-compact`(테두리·배경·안쪽 여백 없음)를 추가했다.
  - 사람 SafeCare 등 다른 `.safecare-guide` 스타일은 그대로다.
- `assets/pet/*-v2.webp` 20장을 추가했다.
  - v1 PNG 원본에서 만든 480×480 WebP(알파 유지, q82)다.
  - 합계 0.9MB, 장당 평균 45KB.
  - v1 PNG 원본은 저장소에 그대로 둔다.
- `site-pet-guides.js`:
  - `PET_SLOT_ARTWORK`가 `-v2.webp`를 가리킨다.
  - 타일 예시는 `loading='eager'`다. 단계의 본문이고 작으니 단계와 함께 받는다.
  - 로드 실패 시 SVG fallback은 유지했다.
  - 9번 뒷모습 SVG fallback의 `dog-rear-v1.png`·`cat-rear-v1.png`도 유지했다.
- asset token은 `node scripts/asset_cache_version.mjs --write`로 재생성했다(수기 편집 없음).

## TEST_STATUS (Windows, Chrome headless, `CHROME_BIN` 지정, CODE_SHA 기준)

| validator | 결과 |
|---|---|
| validate_pet_slot_guide_art_01 | PASS |
| validate_safecare_web_ui_redesign_01 (desktop-1440, mobile-390) | PASS |
| validate_pet_family_web_01 | PASS |
| validate_pet_family_v2_registration_01 | PASS |
| validate_pet_family_v2_profile_match_01 | PASS |
| validate_pet_species_gate_web_01 | PASS |
| validate_pet_photo_source_selector_01 (Android/iOS/Desktop headless) | PASS |
| validate_safecare_capture_art_01 | PASS |
| validate_safecare_photo_upload_fix_03 | PASS |
| validate_life_animal_hospital_01 | PASS |
| asset_cache_version (coherence check) | PASS |
| `node --check` site-pet.js, site-pet-ui.js, site-pet-guides.js, site-safecare-guide-art.js | PASS |

validator 변경 내용:
- `validate_pet_slot_guide_art_01`: v1 PNG 원본 검사(1254px, 알파, 80KB 이상)는 유지했다. 다음을 추가했다.
  - 매핑이 v2 WebP인지.
  - WebP 형식: VP8X, 알파 있음, 480×480, 10KB~120KB.
  - `loading='eager'`.
- `validate_safecare_web_ui_redesign_01`: 다음을 확인한다.
  - 사진 단계에 중복 그림(`.safecare-guide-art`)이 없다.
  - 제목·방향 지도(`.safecare-guide-title`, `.safecare-guide-map`)가 0개다.
  - 첫 타일 예시가 `assets/pet/dog-face-front-v2.webp`다.
  - 테스트 서버 MIME에 webp를 추가했다.
- `validate_pet_family_web_01`: 강아지 선택 시 종 확인을 위쪽 방향 지도 SVG 대신 타일 예시 그림으로 한다.
  - 모든 빈 타일이 `assets/pet/dog-*`다.
  - 9번 뒷모습은 `assets/pet/dog-back-rear-v2.webp`다.

화면 확인(validator 스크린샷, 사진 10장 단계):
- desktop-1440: 중복 박스가 없고 10개 타일 예시가 모두 보인다.
- mobile-390: 전체 페이지 캡처에서 1~10번 예시가 모두 보인다.
  - 수정 전(lazy)에는 같은 캡처에서 5~10번이 빈칸이었다.

실기기(Android/iPhone) 확인은 하지 않았다.

## 배포방 참고

- Production 서빙: nginx 기본 mime.types에 `image/webp`가 있다. index.html에 CSP `img-src` 제한은 없다.
- release branch 충돌 시: asset token만 다른 파일은 최종 tree에서 `asset_cache_version.mjs --write`로 다시 만들면 된다.
- `site-safecare-guide-art.js`는 이제 반려동물 화면에서 import하지 않는다.
  - 기존 validator(`validate_safecare_capture_art_01`)와 workflow가 참조하므로 파일은 남겨 두었다.

## USER_DECISION_NEEDED=NONE
