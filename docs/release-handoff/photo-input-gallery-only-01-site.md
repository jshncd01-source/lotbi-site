READY_FOR_DEPLOY=YES

# PHOTO-INPUT-GALLERY-ONLY-01 — Site (dd8e5b46 후속)

- REPO: lotbi-site (Ncloud)
- FEATURE_BRANCH: feature/photo-input-gallery-only-01-site
- 위에 쌓음: feature/photo-input-no-camcorder-01-site dd8e5b46 (캠코더 제거, 배포 대기열 수록분)
- 포함: 871bd52e(휴대폰 안내 한 줄), 222155dd(main 61d3ce37 정상 merge, 토큰·import만), 이 branch 커밋(검사기 단정 추가 + 이 문서)
- BASE main: 61d3ce37f8ab3298d65411f68b327702e4c7bf0e
- CODE_SHA: 42a167a2a618bd6dfc1eabaa2f594a372795a43c
- ASSET_VERSION: aset-50d3bf5eda9c
- CORE: 변경 없음 / MIGRATION: NONE / NEW_SECRET_CREATED=NO / NEW_PAID_RESOURCE_CREATED=NO / PRODUCTION_CHANGED=NO
- 참고: 같은 내용이 feature/photo-input-no-camcorder-01-site 4e841e7e(SUPERSEDES dd8e5b46)로도 올라가 있음(배포방 지시가 엇갈려 도착). 둘 중 하나만 배포하면 됨 — 이 branch가 그 위에 검사기 단정만 더한 것.
- USER_DECISION_NEEDED: NONE (배포 차단 아님. 반려동물 '파일' 버튼은 소유자 결정 대기 그대로)

## 요구

소유자: "진위확인 '사진·스크린샷 선택'은 사진첩·파일에서 고르기만(카메라 없이), 카메라는 '카메라로 촬영' 메뉴에서만".

## 결론: 웹 페이지가 카메라 항목을 뺄 방법은 없음 (최신 Chrome + Android 13 이상만 카메라 없이 열림)

[확인된 사실: 원본 코드] Chromium `ui/android/java/src/org/chromium/ui/base/SelectFileDialog.java`(main, 태그 121.0.6167.0·130.0.6723.0 대조), WebKit `Source/WebKit/UIProcess/ios/forms/WKFileUploadPanel.mm`(main).

| 경로 | image/* (현재 값) | 이미지 외 형식 섞기 (예 image/*,application/pdf) | 이미지 외 형식만 |
|---|---|---|---|
| 옛 경로 `showExternalPickerDeprecated` (Chromium 121까지 기본, 신고 화면의 삼성 인터넷) | 카메라 + 파일 | 단일 형식 아님 → 카메라·캠코더·녹음기 + 파일 | 사진·영상·소리 아님 → 같은 일반 선택창(카메라·캠코더·녹음기) |
| 현재 경로, Android 13 이상 | 시스템 사진 선택기(`preferAndroidMediaPicker` → ACTION_GET_CONTENT/ACTION_PICK_IMAGES) — **카메라 없음** | 사진 선택기 대상 아님 → 선택창 + 카메라 | 파일만(카메라 없음, 사진 고르기 불가) |
| 현재 경로, Android 12 이하 | Chrome 자체 사진 선택기 — 카메라 타일 있음(`PhotoPickerAction.LAUNCH_CAMERA`) | 선택창 + 카메라 | 파일만 |
| iPhone Safari | 사진 보관함 / 사진 찍기 / 파일 선택 (카메라 있는 기기면 항상) | 같음 | 파일 앱 바로 |

- 카메라 항목은 브라우저 앱의 카메라 권한(`hasPermission(CAMERA)`)·기기 카메라(`mSupportsImageCapture`, iOS `isSourceTypeAvailable:Camera`)로 정해지고 페이지가 넘기는 값이 없다.
- "이미지 외 형식을 섞으면 파일 선택기만?" → 아니다: 옛 경로는 오히려 캠코더·녹음기까지 돌아오고, 현재 경로는 사진 선택기를 떠나 카메라가 있는 선택창이 된다. 이미지 외 형식만 주면 카메라는 빠지지만(현재 경로) 사진 고르기가 막히고 옛 경로에서는 그래도 카메라·캠코더가 뜬다. → 적용하지 않음.
- 그래서 형식 검사·accept는 그대로(image/*) 두고, 가장 가까운 대안을 적용: 휴대폰(hover 없음·터치)에서만 사진 버튼 아래 한 줄 "고르는 창에 카메라가 함께 보이면 ‘파일’(iPhone은 ‘사진 보관함’)을 눌러 사진을 골라 주세요." 데스크톱 숨김(캡처 확인). 지우려면 index.html 1줄 + site-scam-shield.css 2줄.

## 실측

- 실기기 측정 못 함(이 PC에 안드로이드·iPhone 기기 없음) — NOT MEASURED.
- 신고 화면(구체 형식 3개 → 카메라·캠코더·파일)은 옛 경로로만 설명된다 [추정, 근거 강함]. 기기의 정확한 삼성 인터넷·Android 버전은 미확인.
- 검사기 `scripts/validate_photo_input_no_camcorder_01.mjs`가 위 표의 판단 규칙을 그대로 옮긴 모델로 단정: 어떤 accept도 옛 경로 카메라를 못 뺌, 섞으면 옛 경로 캠코더·현재 경로 카메라, 진위확인 세 메뉴별 결과, iPhone 메뉴.

## 테스트 (로컬 Windows)

- SITE_TESTS: (HEAD 42a167a2a618bd6dfc1eabaa2f594a372795a43c) photo_input_no_camcorder_01 PASS(섞기·경로별 단정 추가), scam_shield_mvp_01 PASS, asset coherence PASS(토큰 변화 없음: 검사기·문서만). 아래 커밋 기준(4e841e7e와 같은 코드): scam_shield_mvp_01·scam_shield_connection_01·safecare_people_01·conversation_sidebar_ux_01·safecare_photo_upload_fix_03·safecare_sighting_photo_intake_01 PASS, 브라우저 scam_shield_photo_picker_01 PASS(Android·iPhone·데스크톱 실제 탭, 휴대폰 안내 보임·데스크톱 숨김). NEW_FAILURES=0. 전체 Site validator 묶음은 gate가 실행.
- 실기기(삼성 인터넷·Android Chrome·iPhone): NOT TESTED.

## 롤백

이전 Site 이미지로 되돌리면 끝.
