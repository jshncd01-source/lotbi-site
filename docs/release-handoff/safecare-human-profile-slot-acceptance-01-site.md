READY_FOR_DEPLOY=YES

# SAFECARE HUMAN PROFILE SLOTS REAL-PHOTO ACCEPTANCE P0 — Site

REPO=lotbi-site
FEATURE_BRANCH=feature/safecare-human-profile-slot-acceptance-01-site
SITE_BASE_MAIN_SHA=89adbb378a11fba8e42a445b62f5ffab8f358f5f (Ncloud site main, branch 시작점·개발 종료 시점 동일)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=89adbb378a11fba8e42a445b62f5ffab8f358f5f
CODE_SHA=24f4feca2eb9444281cb3a40345b746ccb0b6695
FEATURE_SHA=(이 문서 커밋 = branch HEAD)
REMOTE_SHA=(push 후 git ls-remote 값 = branch HEAD)
ASSET_VERSION=aset-350a538547ce
PAIRED_BRANCH=lotbi-core feature/safecare-human-profile-slot-acceptance-01-core (실제 통과 판정 수정은 Core)

## 무엇이 바뀌나
- 4·5번(왼쪽/오른쪽 옆면) 안내를 바꿨다.
  - 예전: "고개를 완전히 옆으로 · 귀 전체"
  - 지금: "고개를 옆으로 크게 돌려 주세요. 정확히 90도가 아니어도 됩니다. 눈은 한쪽만, 코끝·입 옆선과 턱선"
  - 보여야 하는 부분: "귀나 귀 주변(머리카락에 조금 가려져도 됨)"
- 옆면 칸의 거절 사유별 안내:
  - WRONG_POSE: "고개를 조금 더 옆으로 돌려 주세요. 사진 속 얼굴이 화면 왼쪽을 바라봐야 합니다(화면 오른쪽을 보면 '오른쪽 옆면' 칸). 두 눈이 다 보이면 '왼쪽 45도' 칸…"
  - IDENTITY_UNCLEAR: "같은 사람인지 확인하기 어렵습니다. 고개를 아주 조금만 덜 돌려, 한쪽 눈과 코끝·입 옆선이 선명하게…"
  - OCCLUDED: "눈·코·입 옆선이 가리지 않게… 머리카락이 귀를 조금 가리는 것은 괜찮습니다."
  - NO_FACE: "…한쪽 눈과 코끝이 보이게 얼굴이 화면에 충분히 들어오도록"
- 공통 문구도 바꿨다.
  - IDENTITY_UNCLEAR: "같은 사람인지 확인하기 어렵습니다. 얼굴이 선명하게 보이도록 다시 촬영해 주세요." (예전 "얼굴을 충분히 확인하기 어렵습니다" 반복 제거)
  - NO_FACE: "…얼굴이 화면에 충분히 보이게 조금 뒤에서"
  - SUBJECT_TOO_SMALL: "…조금 더 크게 보이게"
  - OCCLUDED: "…눈·코·입이 가리지 않게"
- 내부 점수·모델명·검출기 이름은 문구에 넣지 않는다(검증으로 막음).
- 변경하지 않은 것:
  - 10칸 순서와 LEFT/RIGHT 계약(사진 화면 기준 얼굴이 바라보는 방향)
  - 사진 준비(preparePersonPhoto)
  - API 호출
  - 등록된 사진 교체

## TEST_STATUS (로컬 Windows, Chrome 152 headless)
- 신규 `scripts/validate_safecare_profile_slot_acceptance_01.mjs` PASS.
  - 확인 내용: 칸 순서, 4번 왼쪽·5번 오른쪽 문구, 옆면 칸 사유 9종의 문구가 모두 다르고 내부 정보가 없음.
  - 실제 Chrome에서 4·5번 칸에 IDENTITY_UNCLEAR, WRONG_POSE, OCCLUDED를 422로 돌려줬다.
    - 360/375/390/412/1440 폭 모두 문구가 칸 안에 보이고 가로 넘침이 없었다.
    - 거절된 칸은 빈 칸 그대로였고, 이미 등록된 1번 사진은 "다른 사진 선택"으로 교체됐다(개수 유지).
- 기존 validator 2개를 새 계약에 맞춰 갱신했다.
  - `validate_safecare_photo_upload_fix_03.mjs`: "완전히 옆으로/귀 전체/정확히 옆을 보고" → 새 문구
  - `validate_safecare_human_photo_intake_gate_01.mjs`: IDENTITY_UNCLEAR 새 문구
  - 둘 다 PASS.
- 전체 validator 192개(5개 병렬) 결과:
  - 수정 후 184 PASS / 8 FAIL. main 89adbb37은 191개 중 184 PASS / 7 FAIL이다.
  - 차이 난 7개를 양쪽에서 하나씩 다시 돌렸다. 6개는 양쪽 PASS였다.
  - `validate_place_card_compact_01`은 양쪽 모두 3번 중 1번 실패하는 흔들리는 검증이다.
  - 남은 공통 실패 4개는 main에서도 똑같이 실패한다(calendar_system_dark_01, image_attachment_thumbnail_01, mobile_footer_legal_sheet_01, site_avatar_fallback_runtime). 이번 변경과 무관하다.
- `node scripts/asset_cache_version.mjs --check` PASS (aset-350a538547ce).
NEW_FAILURES=0
MOBILE_VIEWPORT=에뮬레이션 PASS(360/375/390/412). 실기기 iPhone Safari/삼성 인터넷은 NOT TESTED.

MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
DEPENDENCIES=문구만 바뀌므로 단독 배포도 안전하다. 실제 통과율 개선은 Core 배포에 달려 있다. 권장 순서는 CORE → SITE(어느 쪽을 먼저 해도 깨지지 않는다).
REAL_PHOTO_VALIDATION=POST_DEPLOY_USER_TEST (사용자가 배포 후 실기기에서 4·5번을 다시 등록해 확인)
USER_DECISION_NEEDED=NONE
READY_FOR_DEPLOY=YES
