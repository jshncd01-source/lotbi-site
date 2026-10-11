READY_FOR_DEPLOY=YES

# PET-FILE-INPUT-IMAGE-ONLY-01 — Site

- REPO: lotbi-site (Ncloud)
- FEATURE_BRANCH: feature/pet-file-input-image-only-01-site
- BASE: Ncloud main afb7057d1d8c149e2b46eb1d656b1049e36b831d
- CODE_SHA: 71263759257f726c552da56cdc039c7782b07d8b
- ASSET_VERSION: aset-d66272a4aad5
- CORE: 변경 없음 / MIGRATION: NONE / NEW_SECRET_CREATED=NO / NEW_PAID_RESOURCE_CREATED=NO / PRODUCTION_CHANGED=NO
- USER_DECISION_NEEDED: NONE (소유자 결정 반영: "캠코더 없이 사진첩만")

## 바꾼 것

| 입력 | 전 | 후 |
|---|---|---|
| 반려동물 사진 가져오기 시트의 '파일' (site-pet-ui.js petPhotoSourceInput=file) | accept 없음 | image/* |

- 원인: accept가 비면 Chromium(SelectFileDialog)이 모든 형식으로 보고 안드로이드 선택창에 카메라·캠코더·녹음기를 넣는다(옛·현재 경로 모두). image/* 하나면 옛 경로는 카메라+파일, Android 13+ 최신 Chrome은 시스템 사진 선택기(카메라 없음) — PHOTO-INPUT-NO-CAMCORDER-01과 같은 규칙.
- 결과: 최신 Chrome(Android 13+)에서는 '파일'도 '갤러리'와 같은 사진 선택기가 열린다(소유자 수용). iPhone은 사진 보관함 / 사진 찍기 / 파일 선택 메뉴.
- 문구: 시트 표시는 "파일"(📁) 한 단어뿐이고 '파일 앱'을 약속하는 화면 문구는 없어 그대로 둠(코드 주석만 갱신).
- 형식 검사 그대로: petPhotoRejection()이 JPG·PNG만 받음.
- 카메라(capture, JPEG/PNG)·갤러리(image/*) 입력은 변경 없음.

## 검사기

- scripts/validate_pet_photo_source_selector_01.mjs: File 입력 accept가 'image/*'임을 정적·실제 렌더 두 곳에서 단정 추가(기존 단정 유지).
- scripts/validate_photo_input_no_camcorder_01.mjs: 반려동물 '파일'을 예외(OTHER)에서 사진 선택 입력(PHOTO_PICKER) 규칙으로 옮김 — 이제 사진 선택 입력 10개 모두 image/*, 캠코더 없음.

## 테스트 (로컬 Windows)

- SITE_TESTS: (HEAD 71263759257f726c552da56cdc039c7782b07d8b) validate_pet_photo_source_selector_01 PASS(Android·iOS·Desktop 실제 렌더, File accept image/* 단정 포함), validate_pet_family_web_01 PASS, validate_photo_input_no_camcorder_01 PASS(19개 입력, 사진 선택 10개 image/*), asset coherence PASS, node --check site-pet-ui.js OK. NEW_FAILURES=0. 전체 Site validator 묶음은 gate가 실행.
- 실기기(삼성 인터넷·Android Chrome·iPhone): NOT TESTED.

## 롤백

이전 Site 이미지로 되돌리면 끝.
