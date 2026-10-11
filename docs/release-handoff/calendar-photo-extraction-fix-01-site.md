READY_FOR_DEPLOY=NO

# 캘린더 사진 분석 수정 01 — SITE 인계

- 상태: IMPLEMENTED / LOCAL_TESTS_PASS(아래 예외 구분) / FEATURE_PUSH_VERIFIED / ACTUAL_IMAGE_FIX_NOT_TESTED.
- 저장소: `lotbi-site` / Ncloud Git.
- 브랜치: `feature/calendar-photo-extraction-fix-01-site`.
- 기준 fresh main SHA: `b09f6e4d21096a4f897d5ba82b958fc5dc384d35`.
- exact 구현·검사·원격 readback SHA: `daab952cf63307af303e0ab5bf4d093dbb83c373`. 이 SHA 뒤의 커밋은 인계 문서만 추가하며 최종 전달 HEAD는 outputs 통합 보고에 기록한다.
- push 직전 fresh fetch → feature에서 `merge origin/main`(Already up to date) → 관련 검사 재실행 → 일반 push → 원격 readback 일치. main drift 없음. main 직접 변경/배포/rebase/force-push 없음.
- READY=NO 사유: 새 코드의 실제 원본 분석과 앱 검증이 아직 실행되지 않았고, 지정 Site 홈 개편 main 통합도 아직 대기 중이다. 통과한 구현 검사를 실패나 미완료로 취소하는 뜻이 아니다.

## Site 변경 및 검사

- 기능 변경: `site-core.js` 선택적 notices 파싱, `site-calendar-manager.js` 안전 textContent 확인 안내·매출표 이유·기존 calimg 식별자 연결, 신규 `scripts/validate_calendar_photo_extraction_fix_01.mjs`. 나머지87개 파일은 자산 cache 참조/manifest 갱신이며 변경 전체 목록은 아래에 기록한다. CSS 추가 없음.
- 360/1280×라이트/다크 네 조합 PASS. 실제 다크 토큰·dialog 배경색·viewport 안맞춤·날짜없음 편집·매출표 무등록·수동 저장 요청1회 검증. 최초 fixture 다크 속성 불일치는 fixture 수정 후 다시 검증했으며 제품 CSS를 바꾸지 않았다.
- 로컬 실제 Core HTTP+SQLite 연결 PASS. 첫 재업로드2건 실패로 확인한 저장 identity 결함을 고친 뒤1건 통과. 날짜 입력 후 저장까지 검증.
- 기존 사진 추가 호텔 시나리오390×844/1280×900, Life Calendar client, expense summary, conversation auto suggest 및 중복 정책 검사 PASS. `asset_cache_version.mjs --write` 후 `--check` PASS, 버전 `aset-af22a4b74bd7`. callback 포함 기존 순서 유지. LF, git diff --check PASS.

## 운영 확인과 재현

- Core 운영 SHA: `3d7418f30e714731bac6e3f17dedcf5b662b5a9b`. 두 서버 동일하다는 **배포방 확인값**이며 이 방의 서버 SSH 실측은 아니다. fresh Ncloud main과 일치한다.
- 공개 health를 이 방에서 조회: OPENAI enabled/configured, 모델 `gpt-5.6-luna`. 제공자·모델 교체 없음. Site 실서빙 HTML 자산 `aset-b2fb0773d049`는 fresh Site main의 자산 버전과 일치한다. 자산 버전 일치를 Site exact served Git SHA 증명으로 확대하지 않는다. 앱 설치·서빙 버전은 NOT_VERIFIED.
- 실제 원본 시험은 이 방에서 운영 QA 계정으로 **카드 1회 + 매출표 1회 = 2회**. 초안까지만, 운영 저장 0회. 카드 실제 결과는 `카드 결제 - 감트카스킨`, 2,400,000원, 기타, 날짜 확인 필요·저장 비활성. 사용자의 이전 결과 `감동카스킨`과도 다르다. 육안 원본 상호는 **라드카스킨**, 거래 `26-10-11 17:39:14`, 최종 합계 2,400,000원, 할부 5개월로 재확인했다.
- 매출표 원본 총액 7,250,000원. 이번 실제 시험은 분석 오류 안내로 끝났다. 사용자가 보고한 과거 `입금 확인` 초안은 이번 시험에서 직접 재현하지 못했다.
- 이전 성공 사례와 직접 비교하지 못함. 운영 모델 원문이 없으므로 상호가 모델 단계에서 틀렸는지, 거래 날짜가 원래 없었는지까지 확정하지 못했다. 업데이트 회귀나 모델 성능 저하로 단정하지 않는다.
- 배포방 제공 로그: CALENDAR_DRAFT / OPENAI / gpt-5.6-luna / 이미지 각 1 / 모두 HTTP 200 / prep_ms=0. 19:46:11 입력6757·출력143·4.8초; 19:47:50 15565·519·8.9초; 19:50:26 15565·587·10.0초; 20:04:48 15565·594·9.9초; 20:05:21 15565·768·12.1초. 이 5회는 이 방의 2회와 동일한 횟수가 아니다. correlation_id 연결은 NOT_VERIFIED. 출력768은 과거 상한 도달을 보여주지만 실제 응답 잘림은 NOT_VERIFIED.
- 실제 시험 비용: 과금되는 분석 2회. 이 방 호출별 확정 토큰·USD/KRW 청구액은 NOT_VERIFIED(로그 correlation·청구 단가 없음). 위 5개 제공 로그 합은 입력69,017·출력2,611토큰. 이를 이 방의 2회 비용으로 쓰지 않는다. 로컬 가짜 제공자 시험은 실제 외부 호출·과금 0회.

## 전체 흐름과 확인한 코드 원인

1. Site 사진 선택 → `uploadConversationAttachment` → `/v2/conversation/attachments` 원본 바이트 업로드 → 반환 attachment id로 `/v2/conversation/messages` 요청.
2. Core 첨부 로더 → 이미지 요청 gate → `call_web_calendar_draft_provider` → OPENAI Responses strict JSON schema → `_extract_reply` → `normalize_provider_calendar_draft` → 공개 draft → Site `normalizeSmartCalendarDraft` → 사진 확인 카드.
3. 앱은 같은 Core conversation 분석 계약을 사용하며 `parseOptionalCalendarDraft` → 요청 여부 판단 → `CalendarDraftCard` → 검토/편집/등록 경로로 이어진다. 현재 main 캘린더 홈 자체의 사진 업로드 진입점은 확인하지 못했고, 이 변경은 공통 대화 사진 초안 경로를 고친다. 홈 진입점·실기기 전 과정은 후속 검증 대상이다.
4. 원본 2장 모두 JPEG 저장 크기4000×3000, EXIF orientation6. 파일 크기 카드2,520,013 / 매출2,549,845바이트. 서버는 원본 이미지 바이트를 보내며 별도 축소·압축·잘림 코드가 없고 로그 prep_ms도0. 회전 영향·공급자 내부 전처리 원인은 NOT_VERIFIED. 첨부 화면 리사이즈 크기를 실제 전송 해상도로 간주하지 않는다.
5. 기존 Core 계약은 YYYY-MM-DD / HH:MM만 받으며 거래 원문·출력 시각·집계 기간을 구분하는 구조와 2자리 연도·초 정규화가 없었다. 기존 프롬프트는 local_date를 예약 시작일로 일반화하고 NOT_A_TRANSACTION의 enum까지 빈 문자열로 지시하는 schema 충돌이 있었다. 구조적 문제는 코드와 합성 입력으로 확인했으나 과거 특정 모델 응답의 최초 누락 단계는 미확인이다.
6. 기존 taxonomy에는 사업 매출집계표 별도 보호 규칙이 없었다. 새 subtype 보호는 모델이 SALES_SUMMARY를 반환한 뒤 개인 거래 필드를 서버에서 제거한다. 이미지 종류 자체를 모델이 잘못 읽는 경우까지 결정론적으로 판별했다고 주장하지 않는다.
7. Site 사진 확인 저장은 임의 create 식별자를 생성해 기존 `calimg-<fingerprint>` 중복 정책을 사용하지 않았다. 로컬 실제 HTTP·SQLite 연결에서 재업로드2건 생성 재현 후 기존 식별자 연결로1건 유지 검증.
8. 앱 parser는 날짜 없는 초안을 버렸다. 명시 요청 영수증도 autoSuggestable=false이면 표시하지 않았다. 앱 직접 등록은 entry를 빠뜨려 금액이 저장되지 않았다. 코드·계약/컴포넌트 검사에서 확인하고 수정했다.

## 변경 규칙과 호환성

- 거래 원문/출력/집계/예약 시작·종료를 분리. 명시 YMD만 정규화하며 POSIX `%y` 고정 pivot(00..68→2000..2068, 69..99→1969..1999), 월일·윤년·시분초를 검증한다. 초는 기존 캘린더 분 단위 계약으로 표시한다. 두 자리 연도는 원본 연도 확인 안내를 붙인다. 이 규칙은 POS 단말 전체의 세기 보장을 뜻하지 않는다.
- 순서 모호 시 날짜를 채우지 않고 검증 가능한 YMD/DMY 후보와 확인 안내. 현재 연도 자동 입력 없음. 날짜 없는 저장 차단·편집 유지.
- 불확실한 상호는 비워 확인 대상으로 표시. 상호 하드코딩·다른 상호 확정·상호로 업종 확정 없음. 근거 없는 카테고리는 미분류. 기존 미분류·음식·여행·쇼핑·생활비·기타 계약 유지.
- 카드 최종 KRW 합계만 읽고 공급가액·부가세·합계 중복 계산 및 할부 곱셈 없음. 매출표는 이유 안내 후 개인 지출/입금 초안 차단. 자동 저장 없음.
- 새로운 공급자 evidence는 provider strict schema에서 요구하되 public schema_version1은 유지. `review_notices`만 선택적으로 추가하며 구 응답 허용. 새 Site/App는 old Core notices 없음 허용. **Core → Site → App** 순서로 통합 판단. 구 앱은 영수증 표시/금액 저장 결함이 남으므로 App도 함께 인수해야 한다.
- OPENAI/GEMINI 출력 상한768→1536은 확대된 evidence schema에 필요한 응답 여유다. 과거 잘림 원인을 확정하거나 이 변경만으로 사진 정확도가 해결됐다고 주장하지 않는다.
- 진단 로그는 correlation_id, provider, 통제된 subtype/incomplete_reason, 원본 필드 존재 여부, 정규화 날짜 존재 여부만 기록. 상호·날짜 원문·금액·사진·번호·서명·모델 원문은 로그에 기록하지 않는다. 따라서 상호 원문 오독까지 로그만으로 복원할 수 없다.
- migration `p0_0123` **미사용**. DB schema·Secret·실제 결제/입금/환불·운영 데이터 삭제·운영 저장·main 변경·배포 없음.

## 사용자 시나리오: 예상값·실제값·조작·막힌 지점

| 시나리오/환경 | 예상 | 실제 | 조작 수 및 막힌 지점 |
|---|---|---|---|
| 카드/수정 전 운영 원본1회 | 라드카스킨, 2026-10-11 17:39, 240만원 | 감트카스킨·날짜 없음·240만원 | 사진 추가1, 파일선택1; 저장0. 날짜 없어 막힘 |
| 카드/수정 후 로컬 Core+Site 합성 제공자 | 거래일·240만원 확인→검토 후 저장→당일/월1회 | SQLite1건, 당일/월 총240만원·entry_count1 | 사진 추가1+저장1 UI 클릭. 파일은 합성 주입, 실터치 수 미측정. 통과 |
| 매출표/수정 후 로컬 | 종류 구분·입금/지출 없음 | 통제된 이유·카드0·추가저장0 | 사진 추가1, 저장0. 의도적으로 차단 |
| 날짜 없는 사진/로컬 | 임의 날짜 없음·편집 후 저장 | 최초 날짜 빈칸·저장 disabled, 10/12 입력 후 추가1건 | 사진 추가1+수정1+저장1, 날짜 입력1. 통과 |
| 동일 영수증 재업로드/로컬 Core+Site | 기존 중복 정책으로1건 | 재업로드 저장 후 총1건·월240만원 | 사진 추가1+저장1. 통과 |
| 예약·티켓/자동검사 | 시작/종료·금액 기존 동작 | Core 예약, 기존 Site 호텔, App 호텔 TIME_WINDOW 및 금액 매핑 검사 통과 | 자동검사; 실제 원본 예약/티켓·실터치 수 미측정 |
| 앱/합성 계약·렌더러 | 명시 영수증 초안 표시, 날짜 수정 가능, 금액 전달 | parser/컴포넌트/쓰기 검사 통과 | 실기기 탭 수 미측정, Android/iOS 원본2장 E2E NOT_TESTED |

로컬 전체 연결은 `scripts/calendar_photo_local_qa.py`의 loopback QA 서버(합성 모델 응답·실제 Core provider 검증과 HTTP router·SQLite 저장) 및 Site `scripts/validate_calendar_photo_extraction_fix_01.mjs`로 실행했다. 업로드·로그인은 격리 합성 자료/세션이므로 실제 운영 로그인·업로드 전체 E2E라고 부르지 않는다. `PHOTO_LOCAL_CORE_URL`은 127.0.0.1만 허용한다. 매출표·날짜 없음·재업로드까지 실행했고, 실제 이미지 새 모델 결과를 정답으로 고정해 정확도가 통과했다고 표현하지 않는다.

## 개인정보 없는 화면 증거

- 수정 전 운영 UI: `C:/Users/jshnc/Documents/Codex/2026-10-11/lotbi-claude-ready-main-claude-1/outputs/카드영수증-운영-수정전.png`
- 수정 후 **합성** Site UI: 같은 outputs 폴더의 `합성영수증-수정후-360-light.png`, `합성영수증-수정후-360-dark.png`, `합성영수증-수정후-1280-light.png`, `합성영수증-수정후-1280-dark.png`. 다크 body theme와 실제 배경색 단언 후 재촬영, 360 다크 육안 검토.
- 증거에 영수증 원본·사업자번호·카드번호·승인번호·서명은 표시되지 않는다. 이미지 픽셀을 Git에 넣지 않고 로컬 증거 경로만 기록한다. 앱 Native 전후 화면은 NOT_TESTED.
- 원본은 저장소 밖 private-fixtures 폴더에서만 시험했으며 원본/원문 응답을 Git에 추가하지 않았다. 회귀 테스트는 합성 상호·식별자 사용.

## NOT_TESTED / NOT_VERIFIED / 인계 조건

- 새 코드+실제 두 원본의 OPENAI 분석 정확도, 동일 결과 반복률, Android/iOS 앱 실제 사진 추가 E2E는 NOT_TESTED. 수정 코드는 아직 운영되지 않는다. 이 방이 운영 배포를 하여 검증하지 않는다.
- 실제 새 코드가 라드카스킨을 정확히 읽는다고 확정하지 않음. 현재까지 실제 이미지 분석 성공 정확도 수치를 제시할 수 없음.
- 과거 원문 추출 결과, 최초 상호/날짜 오류 단계, 매출표 과거 입금 오분류 단계, 출력 잘림·EXIF 영향·과거 성공 버전 비교·금전 비용은 NOT_VERIFIED.
- PostgreSQL 운영 저장 E2E 및 전체 원격 CI는 NOT_TESTED. 로컬 SQLite/관련 테스트 통과를 그 결과로 확대하지 않는다.
- Site 홈 개편 `feature/calendar-home-redesign-01-site` `104fe909d6f45bd398f408300038daf38b0272aa`는 현재 main 미병합. 읽기 전용 merge-tree에는 자산 cache token 충돌이 있다. 최신 main이 갱신되면 **정상 merge**, 홈 디자인 보존, 캐시 재생성·사진/홈 화면 재검증 필요. 다른 feature 변경을 이 브랜치로 복사/병합하지 않았다.
- 앱 월년 owner `LOTBI Work 캘린더 기능 개발`, `feature/app-calendar-layout-01`, 마지막 원격 `c8c59aecc8e1b6446a517fba955df8870be43269`. 홈 디자인 파일 변경 없음. 해당 브랜치와 읽기 전용 merge-tree 무충돌. 이 사실은 실제 통합 검사 통과를 뜻하지 않는다.
- 사용자에게 Claude QA 버전에서 선검증할지, 실사진·앱 검증을 후속으로 인계할지 질문한 상태다. **응답/검증 없이 READY_FOR_DEPLOY=YES로 승격하지 않는다.** 다음 owner는 Claude 배포총괄. 이 문서는 구현·검증·feature push 증거 인계이며 운영 배포 허가가 아니다.

## 변경 파일 전체

- `404.html`
- `about.html`
- `account-deletion.html`
- `app/open/auth/social-return/index.html`
- `auth-callback.js`
- `auth-start.js`
- `auth/callback/index.html`
- `auth/start/index.html`
- `avatar-runtime/runtime/controller.mjs`
- `avatar-runtime/runtime/refinement-binding.mjs`
- `avatar-runtime/runtime/refinement.mjs`
- `avatar-runtime/runtime/three-binding.mjs`
- `contact.html`
- `dispute.html`
- `exchange.html`
- `feedback.html`
- `index.html`
- `kakao-navi.html`
- `map-handoff.html`
- `privacy.html`
- `refund.html`
- `scripts/validate_calendar_photo_extraction_fix_01.mjs`
- `site-asset-version.json`
- `site-auth.js`
- `site-avatar.js`
- `site-bottom-sheet.js`
- `site-calendar-actions.js`
- `site-calendar-draft-write.js`
- `site-calendar-guest.js`
- `site-calendar-manager.js`
- `site-calendar-product.js`
- `site-calendar-public-weather.js`
- `site-calendar-push.js`
- `site-calendar-ui.js`
- `site-calendar.js`
- `site-consumer-sections.js`
- `site-continuity.js`
- `site-conversation-sync.js`
- `site-conversation.js`
- `site-core.js`
- `site-current-location.js`
- `site-family-location-ui.js`
- `site-family-location.js`
- `site-festival-calendar.js`
- `site-festival-client.js`
- `site-festival-ui.js`
- `site-festival-weather.js`
- `site-footer-legal.js`
- `site-kakao-navi-handoff.js`
- `site-kakao-share.js`
- `site-kindergarten-client.js`
- `site-life-education.js`
- `site-life-ev-chargers.js`
- `site-life-location.js`
- `site-life-medical-list.js`
- `site-life-my-child.js`
- `site-life-news.js`
- `site-life-onnuri.js`
- `site-life-real-estate.js`
- `site-life-regional.js`
- `site-life-subway.js`
- `site-life-traffic-cctv.js`
- `site-life-vouchers.js`
- `site-life-wallet-backup.js`
- `site-life-wallet-scan-ui.js`
- `site-life-wallet-share.js`
- `site-life-wallet-wifi.js`
- `site-life-wallet.js`
- `site-location-allow.js`
- `site-media-upload-ui.js`
- `site-media-upload.js`
- `site-message-read-aloud.js`
- `site-my-child-client.js`
- `site-output-card.js`
- `site-person-bulk-photos.js`
- `site-person-ui.js`
- `site-person.js`
- `site-pet-ui.js`
- `site-pet.js`
- `site-product-lookup.js`
- `site-read-aloud-controller.js`
- `site-real-estate-client.js`
- `site-region-picker.js`
- `site-regional-news.js`
- `site-route.js`
- `site-safecare-renewal-notice.js`
- `site-trouble-helper-model.js`
- `site-trouble-helper.js`
- `subscribe.html`
- `terms.html`
