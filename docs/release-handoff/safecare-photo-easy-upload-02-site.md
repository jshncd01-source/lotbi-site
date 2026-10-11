READY_FOR_DEPLOY=YES

# SAFECARE-PHOTO-EASY-UPLOAD-02 — 사람·반려동물 사진: 5장(얼굴 3 + 몸 2)이면 등록 완료, 여러 장 한 번에 (Site, 2차)

TASK=LOTBI_SAFECARE_UX_REVISION (MASTER 2026-10-10), 2차
REPO=lotbi-site
FEATURE_BRANCH=feature/safecare-photo-easy-upload-02-site
BRANCH_START=15651844 (1차 site READY, feature/safecare-photo-easy-upload-01-site)
INCLUDES_1ST_ROUND=YES — 이 branch는 1차(15651844)를 그대로 포함한다. 1차가 아직 main에 없으면 이 branch만 merge해도 1차+2차가 함께 들어간다. 1차를 먼저 merge했어도 충돌 없음(같은 커밋).
AUTHORITATIVE_MAIN_AT_READY=afb7057d (site-t52c). 정상 merge 1번: 73569d23
  - 충돌: asset token 67개(자동, main 쪽) + 공용 파일 6개(이 branch는 token만 바꿈 → main 쪽 그대로) + 안심케어 4개(import 줄·검사기 1줄, 이 branch 쪽 + main의 accept="image/*" 유지)
  - main의 PHOTO-INPUT-NO-CAMCORDER-01(PERSON_PHOTO_ACCEPT='image/*', 발견 제보 input 'image/*')은 그대로 유지·검사기도 'image/*' 기대값 유지
CODE_SHA=73569d23
FEATURE_SHA=(이 문서 커밋 = branch HEAD)
REMOTE_SHA=(push 후 git ls-remote 값 = branch HEAD)
ASSET_VERSION=aset-751c11a14612
PAIRED_BRANCHES=lotbi-core feature/safecare-photo-easy-upload-02-core (필수, 먼저), lotbi-app feature/safecare-photo-easy-upload-02-app (같은 규칙·같은 문구)
DEPLOY_ORDER=CORE 먼저 → SITE (Site가 Core의 새 POST 3개를 부름. Core 없이 Site만 나가면 사진 올리기가 "지금 사용할 수 없어요"로 멈추고 아무것도 저장하지 않음 — 검사기 k 시나리오로 확인)
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
CORE_CHANGE=YES (lotbi-core 02 branch)
SHARED_AREAS=.github/workflows/site-review.yml에 반려동물 검사 단계 1개 추가. 지역정보·대화·지갑 파일은 asset token 외 변경 없음
USER_DECISION_NEEDED=NONE (소유자 결정 완료)

## OWNER_DECISION (2026-10-10)
- 18시대 소유자 선택: "혼합안, 1차 먼저". 배포총괄방이 전달한 소유자 말: "칸 예시는 남기고 5장이면 완료", "5추가는 필수가 아니고 확률을 높일 수 있다는 식으로만 말해", "반려동물도 똑같아야 돼".
- 그대로 지킨 원칙(소유자 채팅): 편의 먼저("사용자가 가입을 안해버리게 생겼어"), 그러나 "완전히 다른 사람이거나 동물이거나 차" 같은 사진은 저장하지 않음.

## 무엇이 바뀌나 (사람)
- 등록·실종 전환 기준: 얼굴 사진 3장 + 상반신·전신 사진 2장(Core의 `identity_photo_complete`). 10장은 권장, 필수 아님. 화면에 "10장을 모두"·"남은 사진 n장"·"/10" 문구 없음.
- '사진 여러 장 선택'이 유일한 입구. 사진마다 Core의 새 POST `/v2/person-profiles/{id}/identity-photos`를 고른 순서대로 한 장씩(동시 1건) 보냄. Core가 얼굴/몸을 정하고 빈 칸에 넣음. 칸 배정·분류(classify)·정면 먼저 대기·'이 칸 다시 고르기'(1차)는 이번에 빠짐.
- 각도·여백은 거절 이유가 아님(Core). 사람 아님·동물·물건·문서·다른 사람·여러 사람·가림·흐림·너무 작음만 거절, 사진별로 이유와 '다른 사진으로 교체'.
- 10칸은 예시 그대로(그림·제목·'보여야 하는 부분'). 칸에는 버튼 없음. '사진 갱신·관리'에서만 저장된 사진에 '사진 빼기'(두 번 눌러야 삭제, 기존 DELETE API).
- 카운터 "얼굴 a/3 · 몸 b/2 / 지금 n장 · 10장까지 올릴 수 있어요", 진행 막대 5칸, 안내 한 줄("…사진 n장이 더 있으면 등록을 마칠 수 있어요" / "등록할 수 있어요. 사진을 더 올리면(최대 10장) 찾을 확률을 높일 수 있어요").
- 목록 카드 "등록 중 · 사진 n장", 단계 이름 '식별 사진'(기존 '식별 사진 10장').
- 처음 저장된 사진이 다른 사람일 수 있으면(빈 프로필에서 첫 사진 저장 뒤 '다른 사람' 거절 2번) 안내: "처음 저장된 사진이 다른 사람일 수 있어요. 사진 갱신·관리에서 그 사진을 빼고 다시 올려 주세요."
- 예전 Core(완료 필드 없음)면 10장일 때만 완료로 봄(안전한 쪽).

## 무엇이 바뀌나 (반려동물 — 사람과 같은 규칙)
- 최소 세트: 얼굴 3장(FACE_FRONT/LEFT/RIGHT) + 몸 전체 2장(BODY_LEFT/BODY_RIGHT/BACK_REAR 중 2). 코·특징 4칸은 권장. 근거는 Core READY 문서.
- 등록 2단계와 '사진 갱신·관리' 모두 '사진 여러 장 선택' → Core의 새 POST(초안: `/v2/pet-registration-drafts/{id}/photos`, 등록된 반려동물: `/v2/pets/{id}/photos`), multipart, 한 장씩.
- 얼굴 정면 먼저 잠금(PET-PHOTO-UX-03)과 칸 순서 잠금(PET-PHOTO-SEQUENTIAL-01), 칸별 사진 선택은 소유자 결정으로 빠짐. 저장된 칸의 '삭제'는 그대로.
- 기존 기능 유지:
  - 휴대폰에서 LOTBI 자체 '카메라 / 갤러리 / 파일' 선택창(SITE-PET-PHOTO-SOURCE-01). 갤러리·파일은 여러 장, 카메라는 한 장. PC는 바로 파일 창.
  - 화면 사전 검사(흐림·너무 작음은 서버로 보내지 않고 바로 안내).
  - 거절된 사진마다 다음 행동 버튼('다시 찍기' / '얼굴 사진부터 올리기' / '몸 전체 사진 고르기' / '다른 사진 고르기')으로 그 사진만 교체.
  - HEIC·WebP·큰 사진은 사람과 같은 변환(JPEG) 뒤 전송.
- 다음 단계 버튼: 같은 종으로 확인된 얼굴 3 + 몸 2가 있으면 열림. 확인 중·거절된 사진은 세지도 막지도 않음(Core가 등록 때 옮기지 않음). 다른 종 사진만 막음.
- 관리 화면 안내는 "…이 더 있으면 실종 상태로 전환할 수 있어요"(관리 화면엔 다음 단계가 없음).
- 결과 줄은 썸네일 칸 없이 1칸, 버튼 44px.

## 바꾸지 않은 것
Core 밖 결제·지역정보, 동의 문구·버전, 발견 제보 최소 5장(소유자 결정: 1장으로 낮추기는 다음 차수), 만료 사진의 실종 전환 차단(소유자 결정: 지금처럼 막음), 112/182 안내·실종 종료 확인(1차), 사진 암호화 저장.

## TESTS (Windows 로컬 Chrome, 2026-10-10, main afb7057d 병합 후)
- 신규 `scripts/validate_safecare_pet_photo_easy_upload_01.mjs`(CI 등록, 실시간 Chrome 360/390/412/1440): 반려동물 등록 5장(얼굴3·몸2) → 다음 단계 열림·POST 순서·동시 1건·카운터·권장 문구 / 다른 종·강아지·고양이 아님·여러 마리 거절과 다음 행동, 그 사진만 교체 / 10장 한도 / 사진 갱신·관리 추가. 틀린 기대값을 넣으면 실패하는 것 확인.
- 다시 쓴 `scripts/validate_safecare_photo_bulk_upload_01.mjs`: 규칙(10장 한도·첫 사진 의심·요약·세트 안내), Core 계약(POST·DELETE·완료 필드·예전 Core), 원문, 360/390/412/1440에서 10장·혼합(동물·차·다른 사람)과 교체·5장 완료·한도·POST 없는 예전 Core·사진 빼기 두 번·발견 제보 비공개·SOS 문구. 틀린 기대값을 넣으면 실패하는 것 확인.
- 소유자 결정으로 기대값이 바뀐 기존 검사기(같은 의도 이상으로 검사, 줄인 검사 없음):
  - photo_easy_upload_01: personRetrySlots 규칙 → 세트 규칙·"10장 필수" 문구 금지·사진 빼기 확인
  - web_ui_redesign_01: 카운터·배지·단계 이름, 칸 버튼 0, POST 1/PUT 0, 반려동물 카운터·잠금 없음·일괄 버튼. 검사 페이지에 site-person-bulk.css 추가(실제 index.html과 같게)
  - profile_slot_acceptance_01: 칸 안 오류 → 일괄 결과 줄 안 오류(가림·흐림·작음), 옆얼굴 칸에 버튼 0
  - person_dark_cancel_01: 모의 Core를 POST·세트 필드로, 등록 취소 금지 조건 = 세트 완료, 실제 3단계 도달을 단정으로 추가
  - human_photo_intake_gate_01, photo_upload_fix_03: 칸 업로드 원문 → 일괄 전송 원문(확인 중 문구·저장은 POST 뒤·변환 먼저·변환 실패 문구)
  - pet_family_v2_registration_01: 진행 규칙(얼굴 거절 → 막힘 유지, 확인 중 몸 사진 1장 → 세트 완료면 막지 않음, 필요할 땐 막음, 코 사진은 얼굴 대신 못 함)
  - pet_species_gate_web_01: 칸 → 일괄 결과 줄, 다음 행동 버튼이 그 사진만 교체
  - pet_photo_source_selector_01: 칸 버튼 → 일괄 버튼이 같은 선택창, 갤러리·파일 여러 장·카메라 한 장
  - pet_family_web_01: 칸 input 없음, 일괄 입력(갤러리 image/* 여러 장, 카메라·파일 유지), 카운터·안내, 잠금 없음
- 안심케어·반려동물 검사기 21개 + main의 validate_photo_input_no_camcorder_01: 22개 모두 PASS(병합 후 73569d23). 병합 직후 첫 실행에서 validate_safecare_people_01·validate_photo_input_no_camcorder_01 2건이 없어진 칸별 사람 사진 입력(personSlotInput)을 찾다 실패 → 소유자 결정으로 없어진 입력을 목록에서 빼고 일괄 입력 확인으로 바꾼 뒤 PASS(검사 완화 아님: 일괄 입력도 image/*·capture 없음 그대로 검사)
- `node scripts/asset_cache_version.mjs --check` PASS (aset-751c11a14612)

## NOT_TESTED / NOT_VERIFIED
- iPhone Safari·카카오톡 인앱, Android 실기기: NOT_VERIFIED (사용자 확인)
- Linux gate: 배포총괄방
- 실제 Core 대상 E2E: NOT_TESTED (모의 Core 기준, Core 쪽은 Core READY의 테스트)

## 보존·위험
- Production DB / Secret / LIVE MONEY / 유료 인프라 / 사용자 데이터 삭제: 없음
- 기존 코드 삭제 없음: classify·칸별 PUT 클라이언트 함수와 반려동물 출처 선택창은 그대로 남김(옛 화면·예전 Core 대비)
- main 직접 push 없음, 검사 완화 없음

NEXT_OWNER=배포총괄방 (CORE gate·배포 → SITE gate → Ncloud Site 교체)
