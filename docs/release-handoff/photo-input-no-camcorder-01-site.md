READY_FOR_DEPLOY=YES

SUPERSEDES=dd8e5b46fb2e38900bee66f71e796700e3ad58db (지시 수정 반영: 진위확인 메뉴별 동작·한계·iPhone, 휴대폰 안내 한 줄)

# PHOTO-INPUT-NO-CAMCORDER-01 — Site

- REPO: lotbi-site (Ncloud)
- FEATURE_BRANCH: feature/photo-input-no-camcorder-01-site
- BASE: Ncloud main d4d172a5 시작 → 61d3ce37f8ab3298d65411f68b327702e4c7bf0e 정상 merge(토큰·import 줄만, rc_token_resolve 후 재생성)
- CODE_SHA: 222155dd934335cc909622facc618e6748fc533a
- ASSET_VERSION: aset-50d3bf5eda9c
- CORE: 변경 없음 / MIGRATION: NONE / NEW_SECRET_CREATED=NO / NEW_PAID_RESOURCE_CREATED=NO / PRODUCTION_CHANGED=NO
- USER_DECISION_NEEDED: NONE (배포 차단 아님. 반려동물 '파일' 버튼은 아래 "남은 것" 참고)

## 신고

삼성 인터넷(안드로이드)에서 진위확인 '사진·스크린샷 선택' → '작업 선택'에 카메라 / 카메라 캠코더 / 파일. 운영 입력: `accept="image/jpeg,image/png,image/webp"`, capture 없음(2026-10-10 운영 HTML로 확인).

## 원인 [확인된 사실: Chromium 원본 코드]

`ui/android/java/src/org/chromium/ui/base/SelectFileDialog.java`
- `showExternalPickerDeprecated()`: `acceptsSingleType()`이 참일 때만 선택창을 사진용으로 좁힌다. 서로 다른 구체 형식 여러 개(`[image/jpeg, image/gif] -> false`, 코드 주석 그대로)는 단일 형식이 아니라서 "couldn't resolve a single accept type" → 카메라·**캠코더**·녹음기를 모두 넣은 일반 선택창으로 넘어간다. `image/*` 하나는 단일 형식 → 카메라 + 파일만.
- 이 경로는 Chromium 121(태그 121.0.6167.0)에서 `kDeprecatedExternalPickerFunction` = ENABLED_BY_DEFAULT, 130.0.6723.0부터 DISABLED. 삼성 인터넷은 Chromium보다 늦은 판을 쓰므로 이 경로가 신고 화면과 맞다 [추정: 기기의 정확한 엔진 판은 미확인].
- capture가 있고 형식이 모두 image/면 `captureImage()`로 선택창 없이 카메라가 바로 열린다(옛·현재 경로 모두) → 카메라 입력은 문제 없음.
- 같은 원인은 이미 프로필 사진(validate_conversation_sidebar_ux_01)과 반려동물 갤러리(SITE-PET-PHOTO-SOURCE-01)에서 같은 방식(`image/*`)으로 고쳐져 있었다.

## 바꾼 것 (선택창을 띄우는 사진 입력 → `accept="image/*"`, capture 넣지 않음)

| 입력 | 전 | 후 |
|---|---|---|
| 진위확인 사진·스크린샷 선택 (index.html #scam-photo) | image/jpeg,image/png,image/webp | image/* |
| 대화 사진 첨부 (index.html data-attachment-input=photos) | image/jpeg,image/png | image/* |
| 안심케어 사람 사진 칸·발견 사진·일괄 등록 (PERSON_PHOTO_ACCEPT) | image/jpeg,image/png,image/webp | image/* |
| 반려동물 발견 사진 (site-pet-ui.js petFoundInput) | image/jpeg,image/png | image/* |

고른 뒤 형식 검사는 그대로라 지원하지 않는 사진(HEIC·GIF 등)은 지금처럼 안내 문구로 막힌다: 진위확인 allowedFileTypes+확장자, 대화 첨부 ATTACHMENT_MEDIA_TYPES+파일 머리, 사람 사진 sniffImageKind(재인코딩), 반려동물 petPhotoRejection(JPG·PNG). 화면의 형식 안내 문구("사진(JPEG·PNG·WEBP) · 최대 10MB")도 그대로.

## 진위확인 메뉴별 동작 (지시 수정: 사진·스크린샷 선택 = 고르기만, 카메라 = 카메라로 촬영만)

| 메뉴 | 안드로이드 최신 Chrome(현재 경로) | 삼성 인터넷 등 옛 경로 | iPhone Safari |
|---|---|---|---|
| 사진·스크린샷 선택 (image/*, capture 없음) | Android 13 이상: 시스템 사진 선택기만 — 카메라·캠코더 없음 (Android 12 이하: Chrome 자체 사진 선택기, 카메라 타일 있음) | 카메라 + 파일 (캠코더 없어짐) | 사진 보관함 / 사진 찍기 / 파일 선택 |
| 카메라로 촬영 (capture) | 카메라 바로 열림(사진만) | 카메라 바로 열림(사진만) | 카메라 바로 열림 |
| 문서·PDF 선택하기 | 파일만 | 카메라·캠코더·녹음기 + 파일 | 파일 앱 바로 열림 |

근거 [확인된 사실: 원본 코드]
- 안드로이드: Chromium SelectFileDialog.java. 현재 경로는 형식이 모두 image/면 `shouldUsePhotoPicker()` → 사진 선택기(Chrome이 사진 선택기를 등록한 경우). 옛 경로 `showExternalPickerDeprecated()`는 사진 형식이면 항상 카메라 intent를 넣고(`if (camera != null) extraIntents.add(camera)`), 사진·영상·소리가 아닌 형식(문서)은 "couldn't resolve a single accept type"으로 카메라·캠코더·녹음기를 모두 넣는다. 카메라 항목 유무는 브라우저 앱의 카메라 권한·기기 카메라로 정해지고(`mSupportsImageCapture`, `hasPermission(CAMERA)`), 페이지가 넘길 수 있는 값이 없다.
- iPhone: WebKit Source/WebKit/UIProcess/ios/forms/WKFileUploadPanel.mm. capture + 카메라 있음 → `_showCamera`. 사진/영상 형식을 받으면 메뉴(사진 보관함 / "Take Photo" / 파일 선택)를 띄우며, 카메라 항목은 `UIImagePickerController isSourceTypeAvailable:Camera`일 때 항상 들어간다. 사진·영상 형식이 없으면 메뉴 없이 파일 선택기.

한계와 가장 가까운 대안
- 삼성 인터넷 옛 경로와 iPhone에서 '사진·스크린샷 선택'의 카메라 항목은 브라우저·OS가 넣는 것이라 웹 페이지로는 뺄 수 없다(어떤 accept 값도 불가 — 검사기에서 image/*·구체 목록·확장자·PDF·빈 값 모두 옛 경로에 카메라가 남는 것을 단정). 캠코더는 이번 수정으로 사라진다.
- 대안으로 휴대폰(터치·hover 없음)에서만 사진 버튼 아래 한 줄을 보여 준다: "고르는 창에 카메라가 함께 보이면 ‘파일’(iPhone은 ‘사진 보관함’)을 눌러 사진을 골라 주세요." 데스크톱에는 보이지 않는다. 필요 없으면 index.html 한 줄 + CSS 두 줄만 지우면 된다.
- 삼성 인터넷 옛 경로의 '문서·PDF 선택하기'에 카메라·캠코더가 보이는 것도 같은 이유로 페이지에서 막을 수 없다(문서 형식은 옛 경로에서 항상 일반 선택창).
- 실제 어느 기기·버전이 옛 경로인지는 실측하지 못했다(실기기 없음). 신고 화면(구체 형식 3개 → 캠코더 표시)은 옛 경로로만 설명된다 [추정, 근거 강함].

## 전수 점검 결과 (사이트가 내보내는 파일 입력 19개, 새 검사기가 자동으로 찾음)

- 선택창 사진 입력 9개: 위 4개 + 이미 image/*였던 캘린더 사진, 프로필 사진(출처별, 카메라만 capture), 반려동물 갤러리, Life Wallet 와이파이 스티커(main 61d3ce37로 들어옴) → 모두 image/*, 옛·현재 경로 캠코더 없음.
- 카메라 입력 4개(capture): 대화 카메라, 진위확인 카메라, Life Wallet 카메라, 반려동물 카메라 → 카메라 바로 열림, 변경 없음.
- 문서 입력 3개(PDF 유지): 대화 파일 첨부, 진위확인 문서, Life Wallet 사진·PDF(image/*,application/pdf) → 변경 없음.
- 사진 아님 1개: Life Wallet 백업 파일(.lotbiwallet).

## 남은 것 (이번에 바꾸지 않음)

- 반려동물 '파일' 버튼(site-pet-ui.js petPhotoSourceInput=file)은 반려동물 방 설계상 accept가 비어 있음(현재 Chrome에서 사진 선택기가 아니라 파일 앱이 열리게). accept가 비면 옛·현재 경로 모두 선택창에 캠코더가 들어간다. image/*로 바꾸면 캠코더는 사라지지만 현재 Chrome에서는 '갤러리'와 같은 사진 선택기가 열린다(둘 다 만족하는 accept 값은 없음). 반려동물 방·소유자 결정 필요.
- 문서 입력 3개와 백업 파일 입력은 여러 종류를 받으므로 옛 경로에서 캠코더가 보일 수 있다(지시대로 PDF 유지).

## 테스트 (로컬 Windows)

- 신규 scripts/validate_photo_input_no_camcorder_01.mjs (site-review.yml 등록): PASS — Chromium 옛·현재 경로 판단 규칙을 그대로 옮긴 모델(신고 화면 재현 포함), 18개 입력 분류·단정, video/·*/*·빈 accept 사진 선택창 금지.
- 기대값을 새 계약으로 바꾼 기존 검사기(약화 아님, 값만 교체): image_attachment_thumbnail_01, scam_shield_mvp_01, scam_shield_photo_picker_01, safecare_people_01, safecare_photo_bulk_upload_01, safecare_web_ui_redesign_01.
- SITE_TESTS: main 61d3ce37 병합 후(HEAD 222155dd934335cc909622facc618e6748fc533a): photo_input_no_camcorder_01 PASS(19개, iPhone 모델·진위확인 메뉴별 단정 포함), scam_shield_mvp_01·scam_shield_connection_01·safecare_people_01·conversation_sidebar_ux_01·safecare_photo_upload_fix_03·safecare_sighting_photo_intake_01 PASS, asset coherence PASS. 병합 직전(같은 변경, HEAD 871bd52e): 브라우저 scam_shield_photo_picker_01 PASS(Android 412·iPhone 375/390·데스크톱 실제 탭, 휴대폰 안내 보임·데스크톱 숨김 캡처 확인). 첫 READY(b71987ff)에서 pet_photo_source_selector_01·pet_family_web_01·safecare_photo_bulk_upload_01·safecare_web_ui_redesign_01·image_attachment_thumbnail_01 PASS. NEW_FAILURES=0. 전체 Site validator 묶음은 gate가 실행.
- 실기기(삼성 인터넷·Android Chrome·iPhone): NOT TESTED.

## 롤백

이전 Site 이미지로 되돌리면 끝.
