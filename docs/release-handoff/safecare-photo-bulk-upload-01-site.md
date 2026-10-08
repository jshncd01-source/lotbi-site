READY_FOR_DEPLOY=YES

# SAFECARE P0 — 사람 식별사진 10장 일괄 등록 + 실종신고 접수 문구 + 발견 제보 결과 비공개 (Site)

REPO=lotbi-site
FEATURE_BRANCH=feature/safecare-photo-bulk-upload-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD). 문서에는 자기 SHA를 넣을 수 없으므로 `git ls-remote`로 확인한다.
CODE_SHA=2dc7f77f9fec83818ed42b0ded4cf149faed98ff
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=22631a2506de (feature 개발 base c9c19e4c, Ncloud main 22631a25를 정상 merge한 2dc7f77f 포함)
ASSET_TOKEN=aset-6674bfd173bd (main 병합 후 --write, check PASS)
TEST_STATUS=main 22631a25 병합 후 단독 순차 재실행 23/23 PASS — node --check 5 + asset_cache_version check, validate_safecare_photo_bulk_upload_01(신규, 360·390·412·1440), safecare_web_ui_redesign_01, safecare_profile_slot_acceptance_01, safecare_people_01, safecare_photo_upload_fix_03, safecare_human_photo_intake_gate_01, person_care_real_user_01, safecare_sighting_photo_intake_01, safecare_capture_art_01, pet_family_web_01, life_wallet_mobile_p0_01, life_wallet_photo_picker_01, site_refresh_route_restore_01, auth_continuity_02, Python home_chat·hardening·consumer_predeploy_guards_01. 병합 전(a20caa8a)에도 같은 목록 + pet_family_v2_registration_01·v2_profile_match_01 PASS
NEW_FAILURES=0
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
NEW_SECRET_CREATED=NO
DEVICE_TEST=NOT TESTED (iPhone Safari, 카카오톡 인앱 브라우저, Android 실기기). 360/390/412/1440 화면 크기 에뮬레이션 PASS는 실기기 PASS가 아니다.
DEPENDENCIES=Core feature/safecare-photo-bulk-upload-01-core(classify), Core feature/safecare-sos-admin-identity-guard-01-core(SOS intake). Core가 없으면: 여러 장 등록은 "지금 사용할 수 없어요 … 고른 사진은 저장하지 않았어요" 안내 후 칸별 등록 유지, SOS 문구는 112 안내만 추가.
DEPLOY_ORDER=CORE(보안) → CORE(분류) → ADMIN → SITE
CONCURRENT_OWNER=다른 방이 site-person-ui.js의 '등록 취소' 버튼·목록 카드 상태·다크모드 색을 feature/safecare-person-dark-cancel-01-site에서 작업 중. 이 branch는 사진 단계 hook·SOS 성공 문구·발견 제보 상태 문구만 수정. 겹치면 정상 merge(asset 토큰 재생성).
USER_DECISION_NEEDED=① 실기기 확인(iPhone Safari·카카오톡 인앱·Android) ② 반려동물 발견 제보 결과 문구(일치 대상 없음 등)는 이번 범위가 아니라 main 그대로 유지 — 사람과 같은 비공개 정책을 적용할지 결정

## 변경 요약

- 사진 단계에 "사진 여러 장 선택"(새 모듈 site-person-bulk-photos.js, CSS site-person-bulk.css). 선택 화면 문구:
  - "정확한 비교를 위해 동일한 사람의 사진만 등록해 주세요. 다른 사람이나 동물·사물 사진이 섞이면 등록이 제한될 수 있습니다."
  - "정면·좌우 45도·좌우 옆면·상반신·전신처럼 서로 다른 각도로 찍은 사진을 준비해 주세요."
- 흐름: 최대 10장(초과 시 앞 10장 + 안내) → 기존 사진 정리(preparePersonPhoto) → Core 분류("AI가 사진을 분류하고 있어요 (i/n)") → 칸 자동 배치(제안 칸 밖 배치 없음, 이미 채워진 칸은 사용자가 고를 때만 교체) → 확인 필요(UNCERTAIN·칸 부족) → 기존 칸별 PUT으로 1,8,2,3,9,10,6,4,5,7 순서 등록("사진을 등록하고 있어요 (i/n)") → "등록 성공 N장 · 실패 M장 · 확인 필요 K장" + 사진별 사유(기존 오류 문구표) + "다른 사진으로 교체".
- 이미 통과한 사진은 다른 사진이 실패해도 그대로(삭제 요청 0건). 정면(1번)이 비어 있고 묶음에 정면이 없으면 아무것도 올리지 않고 정면 먼저 안내. 정면 사진이 다른 사람일 수 있으면 안내.
- 기존 칸별 타일·교체는 그대로(photoTile 무변경), 일괄 등록 중에는 칸별 선택을 막음(busy 공유).
- 서버 검증(각도·품질·동일인·중복)은 저장 단계에서 그대로 실행된다. Site는 우회하지 않는다.
- 실종 상태 전환 성공 문구: "{이름} 실종 상태로 전환했고 LOTBI 안심케어 관리자 접수함에 등록했습니다." + 관리자 알림 상태 한 줄 + 항상 "이 접수는 경찰 신고가 아닙니다. 긴급한 경우 112에 바로 신고해 주세요."
- 사람 발견 제보 상태 문구: 접수됨 / 검토 종료 — 비교 후보 유무·일치 여부를 드러내지 않음(사람 전용 표 PERSON_REVIEW_STATE_COPY). 반려동물 표는 main 그대로.
- 새 validator scripts/validate_safecare_photo_bulk_upload_01.mjs (CI site-review.yml 단계 추가): 시나리오 a~l(동일인 10장, 동물·자동차·다른 사람 혼합, 같은 각도·흐림·여러 명·중복, 부분 실패 후 교체, UNCERTAIN, 정면 없음, 10장 초과, 정면 의심, 경고 문구 원문, 금지 문구 없음, SOS 문구 3종, 구 Core 404, 제보 결과 비공개), 360·390·412·1440.
- validate_safecare_web_ui_redesign_01.mjs: 사람 카드의 옛 결과 공개 문구 기대값을 새 중립 문구로 교체 + 결과 공개 문구 부재 검사 추가(검사 약화 없음, 반려동물 단언은 main 그대로).

## 최종 보고 항목
- BULK_UPLOAD_RESULT=IMPLEMENTED (mock Core 기준 validator PASS, 실제 Core 연동은 배포 후 확인)
- SAME_PERSON_GATE_UNCHANGED=YES (Site는 classify 후 기존 PUT만 사용)
- PUBLIC_IDENTITY_DISCLOSURE=사람 발견 제보 화면 결과 비공개

## 롤백
- Site 이전 이미지로 되돌리면 된다. 데이터 변경 없음.
