READY_FOR_DEPLOY=YES

# SAFECARE-CONSENT-VISIBLE-01 — 안심케어 동의 창 필수 체크 항상 보이기·빠진 동의 안내 + 출생 연월 시작 연도 + 이름표 연결 (Site, QA 보고 02 D1·D2·D3)

TASK=QA 보고 02 D1(P1) — 배포총괄방 배정. D2·D3는 공통 UI 방이 같은 파일이라 이 방으로 넘김(공통 UI 방은 D2·D3를 뺌)
REPO=lotbi-site
FEATURE_BRANCH=feature/safecare-consent-visible-01-site
BRANCH_START=ec6192ba (2차 site READY, feature/safecare-photo-easy-upload-02-site) — 배포총괄방 지시대로 2차 위 후속 커밋이 아니라 새 branch
DEPENDS_ON=2차 site ec6192ba(→ Core 2차 먼저). 2차 site가 운영에 나간 뒤 이 branch를 merge하면 충돌은 asset token뿐. 2차를 건너뛰고 이것만 merge하면 2차도 함께 들어가므로 그 경우 Core 2차가 먼저 운영에 있어야 함.
AUTHORITATIVE_MAIN_AT_READY=afb7057d (2차 site가 이미 병합해 둔 main, 그 뒤 main 변화 없음)
CODE_SHA=66406667
FEATURE_SHA=(이 문서 커밋 = branch HEAD)
REMOTE_SHA=(push 후 git ls-remote 값 = branch HEAD)
ASSET_VERSION=aset-65b1ef984229
DEPLOY_ORDER=CORE 2차 → SITE 2차(ec6192ba) → 이 branch
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
CORE_CHANGE=NO
APP_CHANGE=NO (앱에는 이 동의 창이 없음 — 확인함)
USER_DECISION_NEEDED=NONE

## 무엇이 바뀌나 (2차 대비, 파일 4개 + 검사기 1개)
- `site-safecare-renewal-notice.js` (사람·반려동물 등록 전 동의 창)
  - D1: 필수 체크(이용 동의, 비공개 보관, 만 14세 미만이면 법정대리인)가 각 섹션 아래에 늘 보임. '상세보기'로 접히는 것은 설명 글뿐(한 번에 하나만 펼쳐지는 기존 방식 유지).
  - '필수 항목에 모두 동의합니다' 한 칸 추가(누르면 필수 칸 모두 체크/해제, 각 칸은 그대로 보이고 따로 풀 수 있음).
  - [동의하고 식별 사진 등록] 버튼은 더 이상 눌러도 아무 반응 없는 disabled가 아님. 체크 전에는 흐리게(aria-disabled) 보이고, 누르면 "필수 동의가 빠졌어요: 식별 사진 등록 및 이용 동의, 법정대리인 확인. 체크한 뒤 다시 눌러 주세요."(role=alert)를 띄우고, 빠진 칸에 빨간 테두리를 두르고, 첫 빠진 칸으로 이동함. 모두 체크하면 안내가 사라짐. 사람 등록(POST)은 동의 전엔 여전히 일어나지 않음.
  - 반려동물 동의(1칸)도 같은 안내: "필수 동의가 빠졌어요: 사진 보관·이용 동의. …"
- `site-safecare.css`: 늘 보이는 동의 칸 묶음, '모두 동의' 칸, 빠진 칸 테두리, 흐린 버튼(테마 토큰).
- `site-safecare-common.js` + `site-person-ui.js`
  - D2: 출생 연월 돌림판을 처음 열 때 관계별로 시작 연도에 맞춰 둠(자녀 8년 전, 부모 65년 전, 배우자 40년 전, 가족·기타 45년 전, 돌봄 대상 70년 전 — 2026년이면 부모 1961). 위치만 바꾸고, 확인을 눌러야 저장됨. 이미 고른 값이 있으면 그 값.
  - D3: 사람 등록·실종 전환·발견 제보 입력칸의 이름표를 for/id로 명시 연결, 도움말은 aria-describedby. 참고: 원래 코드(이름표가 입력칸을 감싸는 구조)에서도 크롬 접근성 트리는 '이름'으로 읽음을 측정함 → QA 도구가 for/id만 본 것으로 보이지만, 다른 화면낭독기·도구를 위해 명시 연결을 더함.

## TESTS (Windows 로컬 Chrome, 2026-10-10)
- `validate_safecare_web_ui_redesign_01` 갱신(390·1440):
  - D1: 상세보기 전 필수 칸 3개가 보임·펼친 설명 0, 체크 없이 누르면 위 문구·role=alert·첫 칸 포커스·테두리 3개·사람 생성 0, '모두 동의' 체크/해제, 2개만 체크 후엔 법정대리인만 안내, 모두 체크 후 안내 사라짐, 버튼 native disabled 아님. 반려동물: 체크 없이 누르면 안내·사진 단계 안 열림.
  - D2: 부모는 (올해−65)년에서 시작하고 화면에 보임, 자녀는 (올해−8)년, 스크롤하면 선택 연도가 바뀜. 규칙 함수 단위 검사.
  - D3: 이름칸 labels 1개·for=id·이름표 '이름', CDP Accessibility.queryAXTree로 textbox '이름' 1개.
  - D3 for/id 수정을 잠시 빼면 이 검사기가 실패함을 확인.
- 안심케어·반려동물·사진입력 검사기 22개 전체 PASS(동의 창을 지나는 pet_family_web_01·pet_photo_source_selector_01·person_dark_cancel_01·pet 일괄 검사기 포함).
- `node scripts/asset_cache_version.mjs --check` PASS (aset-65b1ef984229)

## NOT_TESTED / NOT_VERIFIED
- 실기기(iPhone Safari·Android)·화면낭독기 실제 읽기: NOT_VERIFIED
- Linux gate: 배포총괄방

## 보존·위험
- Production DB / Secret / LIVE MONEY / 사용자 데이터 삭제: 없음. 동의 문구·필수 항목·동의 버전은 그대로(배치만 바뀜)
- main 직접 push 없음, 검사 완화 없음

NEXT_OWNER=배포총괄방 (2차 site 운영 뒤 gate → Ncloud Site)
