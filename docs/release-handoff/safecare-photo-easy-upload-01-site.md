READY_FOR_DEPLOY=YES

# SAFECARE-PHOTO-EASY-UPLOAD-01 — 사람 식별사진: 예시 10칸 + 여러 장 한 번에 올리기, 112/182, 문구 정정, 실종 종료 확인 (Site, 1차)

TASK=LOTBI_SAFECARE_UX_REVISION (MASTER 2026-10-10)
REPO=lotbi-site
FEATURE_BRANCH=feature/safecare-photo-easy-upload-01-site
BRANCH_START_MAIN=5675fd3d29e5148c58aa31df2d47912000f0b93a
AUTHORITATIVE_MAIN_AT_READY=61d3ce37 (site-t53). 정상 merge 1번: fce01d02 (충돌은 asset token과 site-person-ui.js import 한 줄뿐, main은 안심케어 파일을 token 외에 바꾸지 않음)
CODE_SHA=fce01d02
FEATURE_SHA=(이 문서 커밋 = branch HEAD)
REMOTE_SHA=(push 후 git ls-remote 값 = branch HEAD)
ASSET_VERSION=aset-d3ed7c7eab46
PAIRED_BRANCH=lotbi-app feature/safecare-photo-easy-upload-01-app (같은 규칙·같은 문구)
DEPLOY_ORDER=독립 (Core 변경 없음). 기존 Core API(classify, 칸별 PUT, person-sos close)만 사용
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
CORE_CHANGE=NO
SHARED_AREAS=지역정보 카드·consumer_sections 검사기 건드리지 않음. .github/workflows/site-review.yml에 검사 단계 1개 추가(main 추가분과 자동 병합, 양쪽 모두 유지 확인)
USER_DECISION_NEEDED=NONE (소유자 결정 완료, 아래 OWNER_DECISION)

## OWNER_DECISION (2026-10-10, 이 방 채팅에서 소유자 직접 선택)
배포총괄방이 전달한 안(소유자 17:30 휴대폰 지시)을 소유자가 최종 선택했다.
1. 업로드 방법은 상단 '사진 여러 장 선택' 하나. 10칸 각각의 '사진 선택' 버튼은 없앤다.
2. 10칸의 예시 그림·제목·'보여야 하는 부분'은 그대로 남긴다(참고용).
3. 자동 배정 뒤 맞는 칸을 못 찾았거나 저장이 거절된 칸에만 그 칸 안에 '이 칸 다시 고르기' / '사진 바꾸기'를 보여 준다. 처음부터 보이는 칸별 버튼은 없다.
4. "정면 얼굴을 먼저 등록하면 선택할 수 있습니다" 같은 칸별 잠금 문구는 없앤다.
5. 반려동물도 같은 구조면 같은 규칙 → 구조가 달라 이번에는 미적용(아래).
6. 10장, 칸별 판정(각도), 동일인 확인, 암호화 저장은 그대로다.

같은 결정에서 1차로 함께 하기로 한 것(소유자 "추천대로"):
- 실종 전환·사람 발견 제보 화면 맨 위에 112 / 182 전화 버튼과 "경찰 신고가 아님" 안내
- 실제 동작과 다른 문구 정정(사람·반려동물): 자동 사진 비교는 운영에서 꺼져 있으므로 "발견 제보와 비교합니다" 약속을 빼고 "안심케어 관리자에게 접수 / 관리자가 확인"으로. 관리자 화면에 사람 발견 제보 목록(/admin/human-reid/reports), 반려동물 실종·발견 검토 목록(admin_pet_boundary)이 실제로 있음을 확인함
- '실종 종료'는 확인 창(계속 유지 / 실종 종료하기) 뒤에만 종료(Core가 종료 시 사진 사용 동의를 거두고, 되돌릴 수 없음)

## 무엇이 바뀌나
- `site-person-ui.js`
  - 사진 단계: 10칸은 예시(그림·제목·안내·'보여야 하는 부분' 유지). 칸 위에 "아래 10칸은 … 예시예요. 사진은 위의 ‘사진 여러 장 선택’으로 한 번에" 한 줄
  - 칸 안 버튼은 `personRetrySlots`가 고른 칸에만: 빈 칸은 '이 칸 다시 고르기', 저장 거절된 칸은 '사진 바꾸기'. 누르면 기존 칸별 업로드(HEIC 변환·Core 판정) 그대로
  - 사진 갱신·관리 안내 문구: 새 사진은 '사진 여러 장 선택'으로, 이미 있는 칸은 바꿀지 먼저 물어봄
  - 실종 전환 화면·사람 발견 제보 화면 맨 위 112/182 안내(`safecareEmergencyNotice`), 문구 정정
  - 진행 중 실종 카드 문구 정정, '실종 종료' → 확인 시트(`data-person-sos-close-confirm`)
  - 등록 취소로 사람을 삭제하면 그 사람의 일괄 등록 상태도 비움(같은 화면에서 다른 사람 등록 시 옛 상태 재사용 방지)
- `site-person-bulk-photos.js`: `personRetrySlots(filled, {ran, running, failed})`(새 등록 첫 일괄 전 0칸 / 일괄 뒤·사진 있는 사람은 빈 칸, 정면이 비면 정면만 / 거절된 칸 / 실행 중 0칸), `attention()`
- `site-person.js`: 실제 동작 문구 상수 5개
- `site-safecare-common.js`: `safecareEmergencyNotice(text)`(tel:112, tel:182 링크, 스크립트 없음)
- `site-safecare.css`: 다시 고르기 칸 점선, 신고 안내 상자(테마 토큰, 버튼 높이 44px 이상). 잠금 칸 스타일 삭제
- `site-pet-ui.js`: 반려동물 실종 전환·발견 제보 안내 문구 2줄만 정정(동작 변경 없음)

## 반려동물(지시 5번) — 이번 미적용, 2차
반려동물 등록은 구조가 다르다. 일괄 등록 기능이 없고(칸마다 한 장씩 순서대로 열림), Core가 초안 사진 10장 모두 ACCEPTED를 요구하며, Core에 반려동물 사진 분류(어느 칸인지 맞히는 기능)가 없다. "여러 장 한 번에 + 자동 배정"을 하려면 Core 신규 개발이 필요해 소유자 승인 순서대로 2차에서 한다.

## 바꾸지 않은 것
Core, migration, 환경변수, 10장 기준, 칸별 판정, 동일인 확인, 암호화 저장, 일괄 등록의 분류·배정·정면 우선 순서, 실종 동의 문구(동의 버전), 발견 제보 최소 5장(2차에서 1장으로 — 소유자 결정)

## TESTS (Windows 로컬 Chrome, 2026-10-10)
- 신규 `scripts/validate_safecare_photo_easy_upload_01.mjs` (CI site-review.yml 등록): personRetrySlots 규칙 8개, 문구, 원문 검사, 360·1280에서 112/182 버튼(높이 44px 이상, 입력칸보다 위), 문구, 실종 종료 확인(계속 유지=호출 0, 종료하기=PUT close 1회) PASS
- 바뀐 기존 검사기(소유자 결정으로 칸별 버튼이 없어진 부분만, 같은 의도 이상으로 검사):
  - `validate_safecare_photo_bulk_upload_01`: "10 single-slot tiles stay" → "10 example tiles stay + 그림 10·'보여야 하는 부분' 10·첫 일괄 전 칸 버튼 0·잠금 문구 없음·예시 안내 문구"; 실행 중 칸 탭 메시지 → 실행 중 칸 버튼 0개; 혼합 일괄(b-d) 뒤 빈 칸만 '이 칸 다시 고르기'; 정면 없음(f) → 정면 칸만; classify 없는 옛 Core(k) → 정면 칸 버튼으로 저장, 그 뒤 빈 9칸 버튼; 원문 import 정규식 갱신
  - `validate_safecare_profile_slot_acceptance_01`: 칸 찾기를 `data-person-slot`로; 빈 칸 '이 칸 다시 고르기' 확인 추가; 저장된 칸 교체 버튼('다른 사진 선택') 단정 → 저장된 칸에는 버튼 없음(교체는 일괄 등록에서, bulk_upload_01 e2가 계속 검사)
  - `validate_safecare_web_ui_redesign_01`: '사진 선택' 문구 단정 → 저장 칸 버튼 없음·빈 7칸 '이 칸 다시 고르기'; 새 등록 잠금 배열 → 칸 버튼 0·일괄 버튼 존재
  - `validate_safecare_person_dark_cancel_01`: 사진 10장 올리기를 칸 입력 대신 '사진 여러 장 선택'으로(모의 Core에 classify 추가). 대비·취소·삭제 보호 단정은 그대로
  - `validate_safecare_photo_upload_fix_03`(CI 밖): 칸 원문 정규식을 새 코드로, 정면 우선은 personRetrySlots 사용 확인으로
- 안심케어·반려동물 관련 검사기 21개(scripts에서 site-person/site-pet/safecare 참조 전부):
  - 병합 전: 19 PASS, 2 FAIL → fix_03(원문 정규식, 위에서 수정 후 PASS), pet_family_web_01(그림 로딩 1회 흔들림, 같은 branch 재실행 2/2 PASS, main 5675fd3d 원본 PASS)
  - 병합 후(fce01d02): 20 PASS + bulk_upload_01 첫 실행 1건 'page error: __openPhotos is not defined'(검사 페이지 준비 10초 대기 초과, 다른 방 검사와 PC 부하) → 같은 SHA 재실행 2/2 PASS. 새 실패 0
- `node scripts/asset_cache_version.mjs --check` PASS (aset-d3ed7c7eab46)

## NOT_TESTED / NOT_VERIFIED
- iPhone Safari·카카오톡 인앱, Android 실기기: NOT_VERIFIED (사용자 확인)
- Linux gate: 배포총괄방
- 실제 Core 대상 E2E: NOT_TESTED (모의 Core 기준)

## 보존·위험
- Production DB / Secret / LIVE MONEY / 유료 인프라 / 사용자 데이터 삭제: 없음
- 공통 운영 기준 V1(docs/operations/LOTBI_ENGINEERING_BASELINE.md) 읽고 따름: 최신 Ncloud main에서 새 feature branch, main drift는 정상 merge, main 직접 push 없음, 검사 완화 없음
- 기존 owner 확인: 사람 일괄 등록(feature/safecare-photo-bulk-upload-01-site)은 main 반영 완료. 같은 기능 중복 구현 아님(그 위에 칸 버튼만 정리)

NEXT_OWNER=배포총괄방 (gate → Ncloud Site 교체)

## 다음 단계 (2차, 개발 중)
18시대 소유자 지시(혼합안)를 이 방에서 소유자가 "혼합안, 1차 먼저"로 확정했다: 칸 예시 유지 + 5장(얼굴 3·몸 2)이면 등록 완료·실종 전환 + 나머지는 권장 문구 + 각도·구도는 거절 사유에서 제외 + 반려동물 동일. 이 1차 READY는 그 앞 단계이며 충돌하지 않는다(칸 버튼 삭제·여러 장 선택 하나·112/182·문구·종료 확인은 2차에서도 그대로). 2차는 Core 포함 별도 READY로 올린다.
