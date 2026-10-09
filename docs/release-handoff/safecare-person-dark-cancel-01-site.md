READY_FOR_DEPLOY=YES

# SAFECARE PERSON P0 — 다크모드 가독성, 등록 취소, 목록 상태 (Site)

REPO=lotbi-site
FEATURE_BRANCH=feature/safecare-person-dark-cancel-01-site
BRANCH_START_MAIN=f59c8ef3
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=e13c0dfd (site-t31, SAFECARE-PHOTO-BULK-UPLOAD-01 포함). 정상 merge 3번: 5a534730(33aa5d9a), b050f1a8(ee8c1b6f), b5c718d7(e13c0dfd)
CODE_SHA=b5c718d7005e85c572399b5c141dc527c8213faa
FEATURE_SHA=(이 문서 커밋 = branch HEAD)
REMOTE_SHA=(push 후 git ls-remote 값 = branch HEAD)
ASSET_VERSION=aset-3d99fd22ff64
PAIRED_BRANCH=lotbi-core feature/safecare-person-dark-cancel-01-core (등록 취소 삭제 보호)

## ROOT_CAUSE
iPhone 카카오톡 내장 브라우저(기기 다크)에서 흰 카드 위 글씨가 거의 보이지 않았다.
- `site-person.css`가 사이트 어디에도 정의되지 않은 색 변수 9개(`--color-surface`, `--site-surface`, `--color-text-secondary` 등)를 썼다.
  - 그래서 사람 목록 카드, 기본정보 폼, 입력칸이 모든 테마에서 기본값 #fff로 남았다.
  - 반면 사이트 공통 다크 규칙은 글씨를 #f5f5f5로 바꿨다. 결과는 1.09:1이다.
- `site-safecare.css`에도 밝은 색이 직접 박혀 있었다(출생 연월 버튼, 갱신 안내 창, 보호자 알림, 동의 칸).
- 잠긴 사진 칸은 opacity .62로 흐리게 처리돼 1.9:1이었다.

## 무엇이 바뀌나
1. 다크모드 가독성
   - 안심케어 CSS(`site-person.css`, `site-safecare.css`)만 사이트 테마 토큰(라이트·다크·기기 다크 모두 정의됨)으로 바꿨다.
   - 전역 테마 변경은 없다.
   - 잠긴 칸은 흐림 대신 점선과 옅은 배경으로 표시한다. 비활성 버튼도 4.5:1 이상으로 읽힌다.
2. 등록 1~3단계 상단에 '등록 취소' 버튼을 항상 표시한다.
   - 서버에 아직 아무것도 없으면(1단계에서 저장 전) 화면만 닫는다.
   - 그 외에는 선택창이 뜬다.
     - A. 임시 저장하고 나가기: 저장된 기본정보와 통과한 사진을 그대로 두고 목록의 '등록 중'으로 간다. 같은 단계(사진 단계)에서 이어서 등록한다.
     - B. 등록 취소하고 삭제: 별도 확인창에서 삭제 대상(이름·관계·출생), 함께 삭제되는 사진 수, "삭제하면 되돌릴 수 없습니다"를 보여 준다.
       - 확인을 누른 뒤에만 Core `DELETE …&registration_cancel=1`을 호출한다.
       - 사진 10장 완료이거나 실종 상태인 사람은 버튼을 비활성화하고 이유를 안내한다.
       - Core도 거절한다(실종 기록 포함). 거절 문구를 그대로 보여 준다.
     - C. 계속 등록하기: 현재 단계와 입력 상태를 유지한다.
   - 정보 수정과 사진 갱신·관리 화면에는 '등록 취소'가 없다. 원래 등록이 그대로 보존된다(기존 '← 목록으로', 기존 '등록 삭제' 유지).
3. 목록 상태
   - '등록 중 N'(사진 10장 미만, '이어서 등록하기', 실종 전환 버튼 없음)과 '등록 완료 N'을 나눴다.
   - 배지는 등록 완료 / 등록 중 · 사진 n/10 / 사진 갱신 필요 / 갱신 예정 · n일 남음이다.
   - 제목 '등록된 사람 N'은 완료된 사람만 센다.
4. 일괄 등록과 통합
   - main에 들어온 SAFECARE-PHOTO-BULK-UPLOAD-01과 merge했다. 사진 단계는 위에서부터 등록 취소 막대, 일괄 등록 영역, 10칸 순서다.
   - 동일인·각도·품질 검증, 실종신고, 관리자 검토 흐름은 바꾸지 않았다.

## CONTRAST_TEST
- 신규 `scripts/validate_safecare_person_dark_cancel_01.mjs`
  - 방법: 실제 페이지와 같은 CSS 24개를 같은 순서로 불러온다. 라이트·다크·기기 다크 × 390·1280 폭에서 화면 11종(목록, 1단계, 출생 연월, 갱신 안내, 2단계, 3단계, 취소 창 2종, 삭제 확인, 정보 수정, 실종 전환 차단)의 보이는 글자마다 실제 칠해진 배경 대비를 잰다.
  - 기준: WCAG AA 4.5:1(큰 글씨·비활성 3:1)
  - 결과: 고치기 전 462곳(서로 다른 경우 68가지) → 0곳. 다크에서 흰 카드 위 #f5f5f5 글씨 1.09:1 같은 경우가 포함된다.
  - 고치기 전 수치는 애니메이션을 끄기 전 측정이다. 애니메이션 도중 반투명 순간이 일부 섞였을 수 있다. 주요 원인(흰 카드 위 밝은 글씨)은 애니메이션과 무관하다.

## CANCEL_FLOW / DRAFT_RESUME / DATA_SAFETY (같은 검증, 360 다크·412 기기 다크·1280 라이트)
- 1단계 저장 전 취소: 쓰기 요청 없이 닫힌다.
- 2단계 취소 창: 3가지 선택지와 저장된 사진 수가 보인다. 계속 등록하기를 누르면 사진 수가 그대로다.
- 임시 저장: DELETE 없이 목록 '등록 중 · 사진 3/10'이 되고, 이어서 등록하면 같은 단계 3장부터 시작한다. 7/10에서 다시 나갔다 와도 7장이 유지된다.
- 1단계 재방문 취소: "저장하지 않은 수정 내용" 안내가 나온다.
- 삭제: 확인 전 DELETE 0회다. 확인 후 `DELETE …?expected_revision=N&registration_cancel=1`이 나가고 목록에서 사라진다.
- 3단계(10장): 삭제 버튼이 비활성이다. 임시 저장하면 '등록 완료'가 된다.
- 실종 기록이 있는 미완료 등록: Core가 409로 거절하고 문구가 표시되며 데이터는 보존된다.
- 정보 수정·사진 관리 화면: 등록 취소 버튼이 없고 '← 목록으로'가 있다.
- 다른 기존 사람(완료, 활성 SOS 등)은 모두 보존된다.

## TEST_STATUS (로컬 Windows, Chrome headless)
- 최종 merge(e13c0dfd) 후 안심케어 관련 7개 모두 PASS
  - person_dark_cancel_01, web_ui_redesign_01(목록 계약 갱신), photo_bulk_upload_01(다른 방), people_01, person_care_real_user_01, human_photo_intake_gate_01, photo_upload_fix_03
- 전체 validator: ee8c1b6f merge 시점에 수정 후 203개와 main 202개를 3개씩 병렬로 돌렸다(동시에 Core 테스트가 돌아 부하가 컸다).
  - 수정 후에만 실패한 15개를 양쪽에서 하나씩 다시 돌렸다. 14개는 PASS였다.
  - `validate_mobile_home_initial_scroll_01`은 고정 대기(200ms) 검증이다. main에서도 실패한다(10번 중 1번).
    - 이 검증은 CSS를 불러오지 않는다.
    - 불러오는 홈 모듈 2개는 main과 토큰 외 차이가 0줄이다.
    - 이번 변경 파일은 경로에 없다.
    - 그래서 흔들림으로 판정했다.
  - 최종 merge(e13c0dfd) 뒤 전체 validator를 다시 돌리지는 않았다(그사이 main 변경은 일괄 등록·로그인 쪽이고, 안심케어 검증 7개는 재확인함).
- asset coherence PASS(aset-3d99fd22ff64)
NEW_FAILURES=0
기기 확인: iPhone Safari·카카오톡 내장 브라우저·Android 실기기는 NOT TESTED다. 모바일 폭과 다크는 Chrome 에뮬레이션으로 확인했다.

MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
DEPENDENCIES=CORE 먼저 배포한다(CORE → SITE). Site만 먼저 나가면 등록 취소 삭제가 Core에서 422로 거절된다. 아무것도 지워지지 않아 안전하지만 기능은 동작하지 않는다.
OWNER_APPROVAL_REQUIRED=YES — 배포 후 사용자가 두 번 확인하면 본인의 미완료 신규 등록이 삭제된다(되돌릴 수 없음). 배포만으로 지워지는 Production 데이터는 없다.
USER_DECISION_NEEDED=OWNER_APPROVAL_REQUIRED (위 항목)
READY_FOR_DEPLOY=YES
