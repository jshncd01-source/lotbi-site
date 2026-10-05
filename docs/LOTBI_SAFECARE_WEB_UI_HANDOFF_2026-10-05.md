# LOTBI SAFECARE WEB UI REDESIGN 01 — HANDOFF (2026-10-05)

작성: 집 노트북 (Claude Code). 회사 PC가 추가 설명 없이 이어받는 것을 목표로 작성했습니다.
이 문서의 SHA·CI·테스트 결과는 **2026-10-05 시점 checkpoint**입니다. 회사 PC에서는 반드시 fresh 상태부터 다시 확인하십시오.

```
REPO=lotbi-site
REMOTE=ssh://lotbi-ncloud-write/srv/git/repositories/lotbi-site.git  (Ncloud, git.lotbiai.com)
BASE_MAIN_SHA=ccc64820e3594a5be27f031a1598aacec3a14433
FEATURE_BRANCH=feature/safecare-web-ui-redesign-01
FEATURE_SHA=c4ae2d618b565e97c6dd67cfba3d5987350a9581   (구현 커밋; 이 HANDOFF 문서는 그 위의 docs-only 커밋)

CHANGED_FILES=실제 변경 20개 + asset cache token만 바뀐 파일 46개 (아래 2절)

CORE_CHANGED=NO
DB_CHANGED=NO
MIGRATION_CHANGED=NO
MATCHING_LOGIC_CHANGED=NO
ADMIN_CHANGED=NO
APP_CHANGED=NO

PERSON_FLOW=IMPLEMENTED (기본정보 → 식별 사진 10장 → 최종 확인 → 등록 완료)
PET_FLOW=IMPLEMENTED (기본정보 → 사진 10장 → 최종 확인 → 등록 완료; Core PHOTOS→BASIC 사진 게이트·finalize 재검증 유지)
PERSON_10_PHOTO_UI=IMPLEMENTED
PET_10_PHOTO_UI=IMPLEMENTED
PHOTO_RENEWAL_UI=IMPLEMENTED (Core identity_photo_state / expires_at / days_remaining / reminder_days 표시만, 웹 계산 없음)

FOUND_REPORT_1_PHOTO_SCREEN_DRAFT=YES (사람·반려동물)
FOUND_REPORT_SERVER_DRAFT=CORE_SUPPORTED_REUSED (Core review_state=DRAFT 재사용; "작성 중 저장" 시 생성. 다른 기기 이어쓰기 신규 구현 없음)
FOUND_REPORT_5_TO_10_FINAL_SUBMIT=YES

ACTIVE_SOS_ONLY_UI=YES
NO_RELIABLE_MATCH_UI=YES ("확인 가능한 일치 대상 없음", review_state=NO_RELIABLE_MATCH일 때만)
AUTO_IDENTITY_CONFIRMATION=NO

UNSUPPORTED_API_FIELDS=발견 제보: 현재 상태 / 지도 위치 / 현재 보호 중 여부 / 제보자 확인정보, 사람 SOS: 별도 "기타" 필드 (4절)
FAKE_PERSISTENCE=NO

DESKTOP_1440_CHECK=PASS (로컬 fixture, Chrome headless) — 실제 Core E2E 아님
MOBILE_390_CHECK=PASS (로컬 fixture, Chrome 모바일 에뮬레이션) — 실기기 PASS 아님

SYNTAX=PASS
TYPECHECK=N/A (정적 JS 사이트, TS/타입체크 단계 없음)
TEST=SafeCare 관련 전부 PASS / CI Node 68단계 중 55 PASS·13 FAIL → 1건 수정 후 PASS, 12건은 origin/main 원본에서도 동일 실패(환경) / Python 10단계 NOT RUN (5절)
BUILD=N/A (빌드 단계 없음; Docker 이미지 빌드는 회사 PC)
ASSET_VERSION_CHECK=PASS (aset-bc4041e02558 → aset-a2c3210a8242)

NCLOUD_FEATURE_PUSH=PASS (feature 브랜치만 push, main 미변경 확인)

BUNDLE_PATH=C:\Users\ASUS\LOTBI-NCLOUD-DEV\_handoff\safecare-web-ui-redesign-01\  (집 노트북 로컬; 6절)
PATCH_PATH=C:\Users\ASUS\LOTBI-NCLOUD-DEV\_handoff\safecare-web-ui-redesign-01\  (집 노트북 로컬; 6절)
HANDOFF_PATH=docs/LOTBI_SAFECARE_WEB_UI_HANDOFF_2026-10-05.md (feature 브랜치, .dockerignore *.md로 이미지 미포함)

PRODUCTION_DEPLOY=NO

FINAL_VERDICT=READY_FOR_COMPANY_PC_REVIEW (merge·배포·Production 확인·실기기 E2E는 NOT TESTED)
```

---

## 0. 회사 PC 진행 순서

1. fresh Ncloud `main` 확인 → `ccc64820…`에서 움직였으면 feature 브랜치에 **정상 merge**로 통합 (rebase/force-push 금지).
2. `feature/safecare-web-ui-redesign-01` diff review — 핵심 파일은 2절 "실제 변경". 나머지 46개는 asset token만 바뀜.
3. trusted gate 전체 실행. 특히 이 노트북에서 **못 돌린 Python 10단계**(5절)와 아래 SafeCare 검증:
   ```
   node scripts/validate_safecare_web_ui_redesign_01.mjs
   node scripts/validate_pet_family_web_01.mjs
   node scripts/validate_pet_family_v2_registration_01.mjs
   node scripts/validate_pet_photo_source_selector_01.mjs
   node scripts/validate_pet_species_gate_web_01.mjs
   node scripts/validate_safecare_people_01.mjs
   node scripts/validate_person_care_real_user_01.mjs
   node scripts/asset_cache_version.mjs --check
   ```
   (`validate_safecare_web_ui_redesign_01`은 Chrome 필요. `SAFECARE_SCREENSHOT_DIR=<폴더>`를 주면 1440/390 스크린샷 24장을 남깁니다.)
4. 정상 merge → Site Production 이미지 빌드 → Render `lotbi-site-prod` 배포.
5. Production 확인 (7절 체크리스트). Desktop / Mobile Web(iPhone Safari, Android Chrome, Samsung Internet)을 **분리 보고**.

## 1. 무엇이 바뀌었나 (사용자 화면)

### 안심케어 첫 화면
- 최상단 탭은 기존 그대로 `[사람] [반려동물]` 두 개 (`site-consumer-sections.js` 로직 변경 없음).
- 각 탭 안에 있던 큰 메뉴 반복(사람: 등록된 사람/실종 관리/발견 제보, 반려동물: 등록된 반려동물/실종 관리/발견 제보 카드 3개) **제거**.
- 탭 선택 즉시 등록된 보호 대상 카드 목록.
- 카드마다 `사진 갱신·관리` + `실종 상태로 전환`. 사진 10장 미완성 사람은 `사진 등록 이어하기`로 표시.
- **ACTIVE SOS일 때만** 카드 안에 "실종 상태 진행 중" 박스(마지막 목격 시각·장소) + `실종 종료`. 이때 `실종 상태로 전환` 버튼은 숨김.
- `발견 제보하기`는 목록 **위**의 별도 점선 박스 CTA (목록 카드와 시각적으로 분리).
- 112/119 같은 일반 안내 블록은 기존 화면에 없었음 → 제거할 대상 없음.

### 등록 (사람·반려동물 동일 순서)
`1 기본정보 → 2 식별 사진 10장 → 3 최종 확인 → 4 등록 완료 + 다음 사진 갱신일`

- 사람 기본정보: 이름 / 관계 / 출생 연도(select) / 출생 월(select 1~12). `"8"`·`"08"` 모두 정수 8로 정규화(`normalizeBirthMonth`).
- 반려동물 기본정보: 강아지/고양이 선택 → 이름 / 성별 / 품종 / 나이(생년월일·추정 나이·모름) / 가족이 된 날(선택) / `추가 정보 (선택)` 접기(털색·무늬·특징·동물등록번호). 모두 Core draft가 실제 저장하는 필드.
- 반려동물 단계와 Core draft `current_step` 관계:
  - 1단계 저장 시 `current_step`을 바꾸지 않음 (새 draft는 Core 기본값 `PHOTOS`).
  - 2단계 → 3단계: `current_step: 'BASIC'`(Core의 PHOTOS→BASIC **사진 10장 검사 게이트**) 다음 `current_step: 'REVIEW'`.
  - 3단계 → 2단계 `이전`: `current_step: 'PHOTOS'`.
  - 사진 게이트 통과 후 1단계에서 종을 바꾸면 `current_step: 'PHOTOS'`로 되돌림 (Core가 종 변경 시 사진 재검사).
  - 등록 확정(finalize)은 Core가 기본정보와 사진 10장을 **다시 전부 검증**.
  - 재개 시 화면 단계는 draft 내용으로 결정: 기본정보 미완 → 1단계, `PHOTOS` → 2단계, 그 외 → 3단계.
- 사람 4단계의 "다음 사진 갱신일"은 Core `identity_photo_expires_at`. 반려동물은 profile-hub 값이 있으면 그 날짜, 없으면 "목록에서 확인"(웹에서 날짜 계산하지 않음).

### 식별 사진 10장
- 정면부터: 사람은 1번(정면 얼굴) 등록 전 2~10번 잠금(UI만; Core는 순서 무관). 반려동물은 기존 얼굴 정면 확인 게이트 유지.
- 각 slot에 방향 도식 + 한 줄 안내. 상단에 항상 보이는 촬영 안내 박스: 사람 실루엣(`site-person-guides.js`) / 강아지·고양이 캐릭터 + 10방향 지도.
- 진행: `등록 완료 3 / 10 · 남은 사진 7장` (+ 반려동물은 `확인 완료 n/10`).
- 버튼 문구 `사진 선택` / `다른 사진 선택`. "카메라 촬영" 문구 없음.
- 같은 사진 재사용 거부: `PERSON_IDENTITY_PHOTO_DUPLICATE`, `PET_PHOTO_DUPLICATE`, `HUMAN_SIGHTING_PHOTO_DUPLICATE`, `FOUND_PET_PHOTO_DUPLICATE` → "같은 사진은 여러 각도에 사용할 수 없습니다. 다른 방향에서 찍은 사진을 선택해 주세요." (코드는 `data-*-error-code` 속성에만)

### 사진 갱신
- 카드 배지: 정상 / 갱신 예정 · n일 남음 / 사진 갱신 필요 / 출생정보 필요 / 사진 등록 필요 (Core `identity_photo_state` 그대로 매핑).
- 다음 갱신일·남은 일수·갱신 주기(180→6개월, 365→1년)·`renewal_reminder_days`(30/7/1) 안내는 Core 값만 표시.
- 만료 사진: 카드 경고 + `실종 상태로 전환` 시 이유와 `사진 갱신·관리` 버튼만 보여 주고 폼은 열지 않음. Core가 거부(`*_IDENTITY_PHOTOS_EXPIRED`)해도 같은 한국어 문구.
- 진행 중 SOS가 있으면 사진 관리 화면에 "진행 중인 실종은 전환 당시 사진으로 계속 비교" 안내. 웹은 snapshot을 건드리지 않음.

### 실종 상태 전환 (카드에서 시작, 해당 대상 1명 전용 화면)
- 사람: 실종 날짜·시간(`last_seen_at`) / 마지막으로 본 장소(`last_seen_summary`, ≤240) / 당시 특징·기타(`description`, ≤1000) / 동의 체크.
- 반려동물: 실종 날짜·시간 / 마지막으로 본 장소 / 당시 특징·기타(`note`) / 동의 체크.
- 사전 차단(Core 규칙과 동일): 사람 `BIRTH_INFO_REQUIRED`·사진 미완·`EXPIRED`, 반려동물 `INCOMPLETE`·`EXPIRED`.
- `실종 종료`: 사람 `PUT /v2/person-sos/{id}/close`, 반려동물 기존 `close(resolved=true)` + `실종 상태 취소`.

### 발견 제보 (사람·반려동물)
- 사진 1장부터 작성 시작. 서버 저장 전 사진은 **현재 탭 메모리에만**("이 화면에만 보관 중").
- 발견 날짜·시간 + 장소 입력 후 `작성 중 저장` → Core create(`review_state=DRAFT`) + 사진 업로드. 이후 추가 사진은 즉시 업로드.
- 진행 표시: `현재 1/5장 · 최종 제출하려면 사진 4장이 더 필요합니다.` / 진행 바에 5장 기준선.
- `최종 제출`: 0~4장 disabled, 5~10장 enabled. 10장이면 `사진 추가` disabled.
- 저장된 DRAFT는 발견 정보 수정 불가로 잠금 (Core에 update API 없음).
- 내 제보 목록: Core `review_state` → 작성 중 / 분석 대기 / 분석 중 / 관리자 검토 중 / **확인 가능한 일치 대상 없음**(NO_RELIABLE_MATCH만) / 사진 보완 필요 / 검토 종료.
- 금지 문구(100% 일치, 찾았습니다, 자동 확정 등)는 신규 검증 스크립트가 소스에서 막음.

## 2. 변경 파일

### 실제 변경 (20)
| 파일 | 내용 |
|---|---|
| `site-person-ui.js` | 사람 안심케어 화면 재작성 (목록/등록 4단계/사진/SOS/발견 제보/후보) |
| `site-person.js` | Core에 **이미 있는** 엔드포인트 연결: 제보 사진 목록·삭제, 비공개 사진 미리보기(`/content`), 에러코드 → 한국어 |
| `site-person-guides.js` (신규) | 사람 10방향 실루엣 도식 + 촬영 안내 |
| `site-safecare-common.js` (신규) | 공용 규칙: 상태 문구, 5~10장 진행, 사진 진행, 갱신 배지, 출생 정규화 |
| `site-safecare.css` (신규) | 공용 스타일 (`--lotbi-*` 토큰만, 다크 자동) |
| `site-pet-ui.js` | 3카드 메뉴 제거, 카드 ACTIVE SOS, 발견 CTA, 등록 순서 변경, 사진 안내, 발견 제보 composer |
| `site-pet.js` | 에러코드 7개 한국어 문구 추가 (중복 사진, 사진 만료/미완, 제보 사진 부족 등) |
| `site-pet.css` | 사용 안 하는 `.pet-home*` 제거, 신규 요소 스타일, `[hidden]` 보장 |
| `site-person.css` | 사용 안 하는 `.person-tabs` 제거, `[hidden]` 보장 |
| `site-consumer-design.css`, `site-consumer-detail.css` | 사라진 `.pet-home*` 선택자 정리 |
| `index.html`, `auth/callback/index.html` | `site-safecare.css` 링크 (+ token) |
| `site-asset-version.json` | `aset-a2c3210a8242` |
| `.github/workflows/site-review.yml` | 신규 검증 단계 1개 추가 |
| `scripts/validate_safecare_web_ui_redesign_01.mjs` (신규) | 3절 |
| `scripts/validate_pet_family_web_01.mjs` | 3카드 메뉴·사진 우선 등록·기존 SOS/발견 페이지를 고정하던 단언 → 새 구조로 교체. 개인정보·비단정 단언은 유지 |
| `scripts/validate_pet_family_v2_registration_01.mjs` | 단계 순서 단언 BASIC→PHOTOS→REVIEW→DONE, Core 사진 게이트 경유 단언 추가 |
| `scripts/validate_pet_photo_source_selector_01.mjs` | 모바일 fixture가 기본정보 → 사진 순으로 진행, 라벨 `사진 선택`, 로컬 거부 3곳 |
| `scripts/validate_person_care_real_user_01.mjs` | 내부 3메뉴 리터럴 단언 → "없어야 함" + 발견 CTA |

### asset token만 바뀐 파일 (46)
`scripts/asset_cache_version.mjs --write` 결과. 각 파일의 변경은 `?v=aset-…` 치환뿐임을 줄 단위로 확인함.

## 3. 신규 검증 `validate_safecare_web_ui_redesign_01.mjs`
- A. 공용 규칙: 사진 0~10장별 제출/추가 가능 여부, NO_RELIABLE_MATCH 외 상태가 "일치 대상 없음"으로 읽히지 않음, 출생 월 `8`/`08`, 갱신 배지.
- B. 소스: 금지 문구, "카메라 촬영" 없음, 출생 숫자 입력 없음, 미지원 필드 문구 없음, 공용 모듈·CSS 연결.
- C. Chrome(DevTools protocol) 1440×900 / 390×844, Core 대역(fixture)으로 실제 클릭:
  사람 목록(ACTIVE SOS 카드만 실종 박스, 배지·갱신일), 사진 10칸·진행·업로드, 등록 1→2단계(select, 정면부터 잠금),
  만료 SOS 차단, SOS 필드, 발견 제보 1→10장(서버 쓰기 0회 확인, 5장부터 제출, 10장 추가 불가) → 제출(create 1·사진 10·submit 1),
  NO_RELIABLE_MATCH 문구, 반려동물 목록/발견 제보/등록 1→2단계. 각 상태마다 가로 overflow 0 확인.

## 4. API GAP / 범위 밖 (NOT_IMPLEMENTED_API_GAP)
| 항목 | 상태 |
|---|---|
| 발견 제보 "현재 상태", "현재 보호 중 여부", 지도 위치, 제보자 확인정보 | Core 필드 없음 → **화면에 넣지 않음** |
| 사람 SOS 별도 "기타" 필드 | Core는 `description` 하나 → 라벨을 "당시 특징·기타"로 한 필드에 저장 (실제 저장됨, 가짜 아님) |
| 발견 제보 저장 후 발견 정보 수정 | Core update API 없음 → 저장 후 잠금 |
| 다른 기기 이어쓰기 | **신규 구현 없음.** 단, Core가 본인 제보 목록에 DRAFT를 돌려주므로 기존과 같이 "이어서 작성"은 보임(기존 동작 유지) |
| 실제 보호자 알림 발송 화면 | 범위 밖, 미구현 |
| 사람 "추정 나이" | 해당 없음 |

### 사전조사 대비 정정
- 반려동물 "가족이 된 날"은 사전 보고에서 "미지원"이라 했으나, 구버전 직접등록 스키마만 본 결과였음. **등록 draft(`PetDraftUpdateIn.family_date`) → finalize 시 `pet.family_date`로 실제 저장** → 지원 필드로 연결함.

## 5. 테스트 결과 (집 노트북, 2026-10-05)
- `node --check`: 변경 JS 전부 PASS.
- SafeCare 관련 전부 PASS: `validate_safecare_web_ui_redesign_01`, `validate_pet_family_web_01`(아래 참고), `validate_pet_family_v2_registration_01`, `validate_pet_family_v2_profile_match_01`, `validate_pet_species_gate_web_01`, `validate_pet_photo_source_selector_01`(Android/iOS/Desktop), `validate_safecare_people_01`, `validate_person_care_real_user_01`, `validate_consumer_sections_02`, `validate_auth_continuity_02`, `validate_global_dark_theme_contrast`, `asset_cache_version --check`.
- `validate_pet_family_web_01`은 `python3 -m http.server`를 띄우는데 이 노트북에 Python이 없어, **임시 사본에서 그 한 줄만 Node 정적 서버로 바꿔** 실행해 360/768/1280 PASS. 임시 사본은 삭제, 커밋에 없음. **회사 PC에서 원본으로 재실행 필요.**
- CI Node 68단계: 55 PASS / 13 FAIL → `validate_auth_continuity_02`는 내 누락(callback에 CSS 링크)이라 수정 후 PASS. 나머지 12개는 **origin/main 원본(git archive)에서도 동일하게 실패** → 이 노트북 환경 문제(로컬 서버/curl/Windows):
  `validate_profile_menu_improvement_01`, `validate_profile_menu_personal_theme_01`, `validate_theme_auto_schedule_02`, `validate_bottom_sheet_primitive_01`, `validate_mobile_footer_legal_sheet_01`, `validate_site_avatar_fallback_runtime`, `validate_home_fresh_entry_01`, `validate_place_card_compact_01`, `validate_global_location_browser_compat_01`, `validate_festival_list_filters_pagination_01`, `validate_message_calendar_footer_editor_01`, `validate_image_attachment_thumbnail_01`
- **NOT RUN (Python 없음, 설치하지 않음)**: `validate_site.py`, `validate_clean_urls.py`, `validate_ios_social_return_01.py`, `sync_footer_business_info.py --check`, `validate_home_chat.py`, `validate_bare_white_home_skin_01.py`, `validate_hardening.py`, `validate_accessibility.py`, `validate_apple_app_site_association.py`, `validate_about.py`

## 6. 집 노트북에만 있는 증거물
`C:\Users\ASUS\LOTBI-NCLOUD-DEV\_handoff\safecare-web-ui-redesign-01\`
- `screens\` — 1440/390 스크린샷 24장 (Core 대역 fixture 화면, 실제 데이터 아님)
- `*.bundle`, `*.patch` — Ncloud push가 성공했으므로 예비용
(PNG는 이미지에 포함돼 공개될 수 있어 저장소에 커밋하지 않음)

## 7. 리뷰 포인트 / Production 체크리스트
리뷰 포인트
- 반려동물 draft `current_step` 처리(1절). 특히 레거시 draft(이전 순서로 BASIC/ADDITIONAL에 멈춘 것) 재개 시 기본정보 미완이면 1단계부터 열림.
- 모바일 웹 반려동물 사진 버튼은 기존 검증 기능인 카메라/갤러리/파일 선택 시트를 유지 (버튼 라벨은 `사진 선택`, 시트 항목 "카메라"는 `capture` 속성으로 실제 카메라를 엶 — "카메라 촬영" 문구는 없음). 제품 판단으로 시트에서 카메라를 빼려면 `validate_pet_photo_source_selector_01`도 함께 수정 필요.
- 사람 발견 제보 사진 slot 1~10은 Core 각도코드(FACE_FRONT…ADDITIONAL_5)에 순서대로 대응. 제보자는 각도를 고르지 않음.
- Core `message`(사람 제보)는 표시하지 않고 웹 공용 문구 사용 — NO_RELIABLE_MATCH 문구를 명령문대로 맞추기 위함.

Production 확인 (모두 현재 NOT TESTED)
- [ ] Desktop: 안심케어 → 사람/반려동물 탭, 카드 액션, 발견 CTA 위치
- [ ] 사람 등록 4단계 실제 1명 (출생 select, 사진 10장, 등록 완료 갱신일)
- [ ] 반려동물 등록 4단계 실제 1마리 (사진 검사 게이트 통과 → 확정)
- [ ] 만료/미완 대상 실종 전환 차단 문구
- [ ] 실종 전환 → 카드 ACTIVE 표시 → 실종 종료
- [ ] 발견 제보 1장 시작 → 작성 중 저장 → 5장 제출 → 목록 상태
- [ ] iPhone Safari / Android Chrome / Samsung Internet 각각 (에뮬레이션 PASS ≠ 실기기 PASS)
- [ ] 다크 테마 1회 육안 확인
