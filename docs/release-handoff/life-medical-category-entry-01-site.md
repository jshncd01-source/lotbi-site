READY_FOR_DEPLOY=YES

# life-medical-category-entry-01-site — release handoff

TASK=LIFE MEDICAL CATEGORY ENTRY P0
REPO=lotbi-site
FEATURE_BRANCH=feature/life-medical-category-entry-01-site
BASE_MAIN_SHA=8a9e414d02d621f67907fcd35a579383b41f8d8e
CODE_SHA=568349185e1ef4e8a35ff325cc3a27f659f1f490
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote origin refs/heads/feature/life-medical-category-entry-01-site`)
ASSET_VERSION=aset-c2a0240e06d6

ROOT_CAUSE=생활정보 shortcut 목록(LIFE_SHORTCUTS)에 의료 항목이 없었다. Core의 병원·의원/약국/응급실/야간진료 조회(app/medical_conversation.py)는 대화로만 닿을 수 있어 생활정보 화면에서는 기능이 보이지 않았다.
CURRENT_LIFE_SHORTCUTS=축제·행사 / 지역생활정보 / 공과금 확인
FINAL_LIFE_SHORTCUTS=병원·의원 / 약국 / 축제·행사 / 지역생활정보 / 공과금 확인

HOSPITAL_ENTRY=PASS
PHARMACY_ENTRY=PASS
NIGHT_MEDICAL_ENTRY=PASS (병원·의원 상세의 "야간진료" 칩, 약국 상세의 "오늘 밤 여는 약국" 칩)
EMERGENCY_ENTRY=PASS (병원·의원 상세의 "응급실" 칩 → 기존 119 안내 표시)

CORE_CHANGED=NO
SITE_CHANGED=YES
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
PRODUCTION_DEPLOYED=NO

## SCOPE

- `site-consumer-sections.js`
  - LIFE_SHORTCUTS 앞에 `hospital`(병원·의원), `pharmacy`(약국) 추가. 기존 세 항목·순서·prompt는 그대로. 카드는 기존 `consumer-shortcut` 버튼 그대로(아이콘 경로 2개만 추가).
  - 상세 화면: 지역(예: 전주 효자동) + 찾는 진료/찾는 조건. 둘 다 선택 입력이라 위치 권한을 요구하지 않는다.
  - 빠른 선택 칩(기존 `festival-chip` 스타일 재사용): 병원·의원 = 지금 진료 / 야간진료 / 응급실, 약국 = 지금 여는 약국 / 오늘 밤 여는 약국 / 24시간 약국. 칩은 보이는 입력칸 글자를 바꾸고(입력한 진료과는 유지: "내과" + 야간진료 → "오늘 밤 진료하는 내과"), 다시 누르면 해제된다.
  - "응급실"을 고르면 대화 답변에서 쓰던 기존 119 안내(`createEmergencyCallNotice`, tel:119)를 그대로 보여 준다. 진료·수용 보장 문구는 없다.
  - 제출은 기존 `onDraft` → 대화 입력창에 문장을 넣고 사용자가 확인 후 전송(기존 생활정보 상세와 같은 흐름). 별도 검색 엔진·fetch·저장 없음.
- 문장 규칙(`buildLifeMedicalPrompt`): Core `classify_medical_utterance`는 시간·근처 단어가 없으면 의료 조회를 하지 않고 NAVER 장소검색으로 넘긴다. 그래서
  - 시간 단어가 없으면 "지금 진료하는 …" / "지금 여는 …"을 붙인다. 예: 전주 효자동 + 내과 → "전주 효자동에서 지금 진료하는 내과 알려줘".
  - 지역이 비면 "근처에서 …" → 기존 생활 위치 계약(site-life-location.js)이 위치 사용 설정에 따라 현재 위치/저장 지역을 붙이거나 아무것도 안 붙인다(Core가 지역을 되묻는다).
- 테스트: 신규 `scripts/validate_life_medical_category_entry_01.mjs`(site-review.yml 등록), `scripts/validate_consumer_sections_02.mjs` 기대 목록 갱신.
- asset token 재계산(aset-c2a0240e06d6) — 위 파일 외에는 `?v=` 토큰만 바뀜.

## CORE CONTRACT CHECK (Core 무변경)

- Production core live image = `lotbi-core-prod:sha-4b168e31…` (Render dep-db2t2gm7bikc73ata9mg) = Core Ncloud main 4b168e31.
- 그 revision의 `classify_medical_utterance` / `_text_region` / `preflight_routed_conversation` / `classify_school_utterance` / `classify_festival_utterance`에 Site가 만드는 문장 24종을 직접 넣어 확인:
  - 병원 → HOSPITAL(NOW/NIGHT/DAY, 진료과 D001·D002·D026 인식), 약국 → PHARMACY(NOW/NIGHT/ALL_DAY/DAY/HOLIDAY), 응급실 → EMERGENCY.
  - "전주 효자동" → 전주시, "전주시 완산구" → 전주시 완산구, "서울 강남구" → 서울특별시 강남구.
  - preflight·학교·축제 처리기에는 걸리지 않음(0/24).
- 알려진 Core 동작(변경 안 함): 동 이름만("효자동") 쓰면 Core가 시·도를 알 수 없어 위치가 없을 때 시·군·구를 되묻는다.

## TEST_STATUS

FOCUSED_TESTS=PASS
- validate_life_medical_category_entry_01: LIFE_SHORTCUTS 병원·의원/약국 존재·순서, 문장 규칙 20건, 칩 13건, 소스 계약(onDraft·fetch/저장/geolocation 없음), 브라우저(CDP 실제 터치/마우스):
  - 병원 카드 탭 → 상세(지역·찾는 진료, 필수 아님), 칩·119 안내, 뒤로가기 → 생활정보 메인
  - 병원 제출 → 입력창 "전주 효자동에서 지금 진료하는 내과 알려줘" → 전송 시 guest messages body에 같은 문장, location 없음
  - 약국 카드 탭 → 상세 → "오늘 밤 여는 약국" 칩 → 입력창 "전주 효자동에서 오늘 밤 여는 약국 알려줘"
  - 회귀: 지역생활정보 상세·제출 문장 그대로, 공과금 확인 textarea, 생활정보 검색창 Enter, 축제·행사 화면 열림, 저장한 정보 다시 보기 버튼 유지
- validate_consumer_sections_02 / validate_life_detail_design_01 / validate_consumer_detail_system_01 PASS, asset_cache_version --check PASS.

MOBILE_375=PASS (375x812: 카드 5개 343x60 한 줄 라벨, 잘림·가로 스크롤 0, 칩 44px 이상)
MOBILE_390x844=PASS (카드 358x60, 동일 조건)
DESKTOP=PASS (1280x900: 2열 카드 424x72, 동일 조건)
- viewport 에뮬레이션(headless Chrome, iPhone UA + touch)이며 iPhone Safari·Android 실기기 실행 아님.

SITE_REGRESSION=PASS — workflow run 줄 207개(Windows 로컬)
- feature 201 PASS / 6 FAIL, main 8a9e414d baseline 202 PASS / 4 FAIL.
- 양쪽 공통 기존 Windows RED 4건: validate_calendar_system_dark_01, validate_image_attachment_thumbnail_01, validate_mobile_footer_legal_sheet_01, validate_site_avatar_fallback_runtime.
- feature에서만 실패한 2건(validate_calendar_month_geometry_01, validate_home_fresh_entry_01)은 "Failed to fetch dynamically imported module"(고정 포트 정적 서버 부하 간헐 실패) → 단독 재실행 PASS.
- Linux CI(site-review.yml) 실행 NOT TESTED (이 PC에 Linux 실행 수단 없음).

NEW_FAILURES=0

## NOT VERIFIED

- Production Core 실제 NMC 응답(이 문장으로 Production에서 병원·약국 목록이 나오는지)은 배포 후 smoke 필요. 로컬 검증은 Core 분류 단계까지.
- 실기기(iPhone Safari / Android Chrome / Samsung Internet) 화면.

## DEPLOY_ORDER

Site 단독. Core 변경 없음(필요한 Core 4b168e31이 이미 Production live).

REMAINING_ISSUES=NONE (위 NOT VERIFIED 두 항목은 배포 후 smoke·실기기 확인 대상)
USER_DECISION_NEEDED=NONE
