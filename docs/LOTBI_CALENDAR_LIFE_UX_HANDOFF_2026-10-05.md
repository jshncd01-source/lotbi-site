# LOTBI Calendar Life UX Redesign 01 — Site 구현 HANDOFF (2026-10-05)

> 상태 표기는 LOTBI 운영 기준을 따른다: IMPLEMENTED / LOCAL VALIDATION PASS / NOT TESTED / NOT DEPLOYED 를 구분한다.
> 이 문서의 어떤 항목도 Production 배포·실기기 PASS 를 뜻하지 않는다.

## 0. 한눈에

| 항목 | 값 |
|---|---|
| 요청 | [LOTBI CALENDAR LIFE UX REDESIGN 01 — SITE IMPLEMENTATION] |
| 저장소 | lotbi-site (Ncloud `ssh://lotbi-ncloud-write/srv/git/repositories/lotbi-site.git`) |
| 기준 main | `ccc64820e3594a5be27f031a1598aacec3a14433` (작업 종료 시점 fetch 결과 main drift 없음) |
| 작업 branch | `feature/calendar-life-ux-redesign-01-site` |
| feature commit | 이 문서를 담은 커밋. 정확한 SHA 는 `_handoff/calendar-life-ux-redesign-01/HANDOFF.md` 사본과 최종 보고에 기록 |
| 상태 | IMPLEMENTED · LOCAL VALIDATION PASS (아래 §8 범위) · NOT DEPLOYED · 실기기 NOT TESTED |
| 변경 금지 영역 | lotbi-core / DB / migration / lotbi-app / lotbi-admin / 인증 / 결제 / SafeCare / Life Wallet / 진위확인 / 다른 Site 카테고리 — 변경 없음 |
| Core 계약 | 읽기만 했다. 새 Core 기능·엔드포인트 없음 |
| Production | 접근·배포 없음 |

목표: 캘린더에서 "일정표에 가계부를 붙인 느낌"을 걷어내고, 하루를 하나의 생활 타임라인으로 읽게 한다. 금액은 기록의 한 속성일 뿐, 월 화면에는 한 줄 합계만 남긴다.

## 1. 변경 파일

### 1.1 실제 변경 (6)

| 파일 | 내용 |
|---|---|
| `site-calendar-manager.js` | IA(월/주/목록 + 제목→년), 날짜 상세 Life Timeline, `+ 기록` CTA·고정 하단 바, 새 편집기(칩·점진 공개), 사진 확인 카드, 월 금액 한 줄·상세, 주(생활목록/시간표·데스크톱 우측 레일), 목록 필터, 포커스 보존 렌더 |
| `site-calendar-product.js` | 기간·마감·시간·시간 없는 기록 분류(`lifeTimelineForDate`, `lifeRowPresentation`), 날짜별 포함 판정, 월 기간 막대(`monthSpanSegments`), 날짜별 입력 금액 합계 |
| `site-calendar-expense.js` | `N월 입력 금액 합계` 한 줄과 상세(0원 아닌 분류만), "금액 없는 일정 N건 제외" 문구 제거 |
| `site-calendar.css` | LIFE UX 01 블록(점·막대·타임라인·편집기·시트/패널·고정 바·레일·컨테이너 쿼리) + system-dark 미러 재생성 |
| `site-consumer-design.css` | 캘린더 워크스페이스: 한 스크롤, 2줄 툴바(폰), 데스크톱 좌우 배치·스티키 레일, 셸 행 정리 |
| `site-consumer-detail.css` | 편집기 SHEET/SIDE 표현 보정 |

### 1.2 토큰만 바뀐 파일 (51) + manifest

`node scripts/asset_cache_version.mjs --write` 로 `aset-bc4041e02558` → `aset-b162e8b268f9`. 아래 파일은 `?v=` 토큰 외 바이트 변화가 없음을 HEAD 와 토큰 치환 비교로 확인했다(`site-asset-version.json` 은 manifest).

404.html, about.html, account-deletion.html, app/open/auth/social-return/index.html, auth-callback.js, auth-start.js, auth/callback/index.html, auth/start/index.html, avatar-runtime/runtime/controller.mjs, avatar-runtime/runtime/refinement-binding.mjs, avatar-runtime/runtime/refinement.mjs, avatar-runtime/runtime/three-binding.mjs, contact.html, dispute.html, exchange.html, feedback.html, index.html, kakao-navi.html, privacy.html, refund.html, site-auth.js, site-avatar.js, site-bottom-sheet.js, site-calendar-actions.js, site-calendar-draft-write.js, site-calendar-guest.js, site-calendar-public-weather.js, site-calendar-push.js, site-calendar-ui.js, site-calendar.js, site-consumer-sections.js, site-continuity.js, site-conversation.js, site-current-location.js, site-festival-calendar.js, site-festival-client.js, site-festival-ui.js, site-festival-weather.js, site-footer-legal.js, site-kakao-navi-handoff.js, site-media-upload-ui.js, site-media-upload.js, site-output-card.js, site-person-ui.js, site-person.js, site-pet-ui.js, site-pet.js, site-read-aloud-controller.js, subscribe.html, terms.html, site-asset-version.json

### 1.3 validator (23, `scripts/`)

옛 UX 를 고정하던 UI assertion 만 새 계약으로 바꿨다. 안전·데이터 계약(쓰기 0건, 첨부 id, 403/401 구분, 게스트 로컬 계산, 월 범위 요청, 통화 분리, 빈 금액≠0, 포커스 복귀, Escape 격리, 오버플로 없음 등)은 그대로 두거나 더 강하게 했다.

`validate_calendar_`: add_from_image_01, compact_editor_01, cross_platform_ux_01, day_panel_two_buttons_01, editor_field_height_01, event_editor_01, expense_summary_01, guest_month_weather_forecast_window_01, holiday_surface_settings_icon_01, korea_holidays_01, ledger_design_01, lunar_settings_ui_01, modal_runtime_02, real_ui_01, responsive_01, secondary_surfaces_01, touch_monthnav_daysheet_01, weather_attribution_01, weather_icons_01, weather_region_province_01, week_timegrid_ui_01
`validate_`: consumer_detail_system_01, message_calendar_footer_editor_01

`validate_calendar_day_list_range_01`(숙박 `09/12 15:00 → 09/13 11:00`, 시작 시각 15:00)은 validator 를 바꾸지 않고 제품 코드를 그 계약에 맞췄다.

## 2. 화면 구조 (IA)

- 탭: **월 / 주 / 목록**. `일정` 탭은 `목록` 으로 이름이 바뀌었다. **년**은 지우지 않고 제목 `2026년 10월 ▾` 을 눌러 연다(년 화면 제목 `2026년 ▴` 을 누르면 월로 돌아감).
- 날짜를 고르는 것은 아무것도 열거나 닫지 않는다. 날짜 상세는 화면의 일부다.
  - 폰(≤900px): 월 그리드 바로 아래에 이어지는 한 스크롤(FLOW). 안쪽 스크롤 없음.
  - 데스크톱(≥901px): 월·주 오른쪽 320–380px 레일(SIDE, sticky). "상세가 그리드 아래로 떨어지던" 문제를 고쳤다.
- 처음 열면 **오늘**이 선택돼 있고 오늘의 기록이 보인다. 오늘이 아닌 날짜가 미리 선택되는 일은 없다.

## 3. 날짜 상세 = Hybrid Life Timeline

헤더: `오늘` 배지(오늘일 때) · `10월 5일 월요일` · 날씨(있을 때) · 음력(설정 시) · 공휴일 `이름 · 공휴일` · `입력 금액 N원`(금액이 있을 때만).

순서:
1. **기간**(여러 날에 걸친 기록): 시간 칸 `기간`, 보조 줄에 `10/20 15:00 → 10/22 11:00`. 단, 시작 시각이 있는 숙박은 **시작일에는 그 시각(15:00)에** 놓인다(체크인은 그날의 흐름이므로). 둘째 날부터는 `기간`. 이어지는 날에는 금액을 반복하지 않는다.
2. **마감**(Core `temporal_semantics=DEADLINE`): `마감` + `오늘 마감`/`기한 지남` 배지.
3. **시간 있는 기록**: 시각순, 같은 날 끝 시각이 있으면 `~15:30`.
4. **시간 없는 기록**: 앞에 다른 묶음이 있을 때만 `시간 없는 기록` 소제목. 00:00 이나 "지금" 같은 시각을 만들어 붙이지 않는다.

"하루 종일"과 "시간 없음"은 현재 Core 계약에서 구분되지 않는다(§7 FUTURE_CORE_GAP). 그래서 어느 쪽이라고 주장하지 않고 "시간 없는 기록"으로만 부른다.

행마다 붙던 `일정`/`결제`/`직접 입력`/`이 기기에 저장` 배지는 없앴다. 행은 시간 · 제목 · 보조 줄(기간/장소/상점/분류/메모 40자) · 금액만 말한다. 배지는 마감 상태뿐.

## 4. 금액 표현

- 금지어("오늘 쓴 돈", "N월에 쓴 돈", "지출", "가계부")를 쓰지 않는다. 쓰는 말: `금액`, `입력 금액`, `10월 입력 금액 합계`.
- 월 화면: 그리드 아래 **한 줄** `10월 입력 금액 합계 311,600원 ›`. 금액이 하나도 없는 달은 줄 자체가 없다(0원 장부를 보이지 않음).
- 줄을 누르면 상세(폰: 아래 시트, 데스크톱: 오른쪽 패널): 합계 + **금액이 있는 분류만** 고정 순서로, `캘린더 기록에 입력한 금액을 더한 값이에요.`, 게스트는 `이 기기에 저장된 기록 기준이에요.`
- `금액 없는 일정 N건 제외` 문구 제거. 금액 없는 기록은 합계에 들어가지 않을 뿐 0원으로 세지 않는다.
- 통화는 합치지 않는다(KRW 는 `원`, 그 외는 코드 유지).
- 6칸 지출 스트립(`calendarExpenseSummaryNode`)은 더 이상 마운트하지 않는다. 함수는 호환을 위해 export 로 남아 있다.
- 이 변경은 `docs/DESIGN_CALENDAR_LEDGER_20261005.md`(월별 지출 6칸 디자인)의 화면 표현을 대체한다. 계산(합계·분류·통화·월 범위)은 그대로 재사용한다.

## 5. 기록 추가 / 편집

- CTA 는 **`+ 기록`** 하나(+ `사진에서 기록 읽기`). 버튼 3개·"무엇을 기록할까요?" 종류 선택 단계 없음. 누르면 편집기가 바로 열린다.
  - 폰: 화면 아래 고정 바. 오늘이 아니면 `+ 10월 21일에 기록` 처럼 날짜를 말한다.
  - 데스크톱: 날짜 레일 안 `+ 기록`(레일 제목이 날짜를 이미 말함). 접근성 이름은 항상 `M월 D일에 기록 추가`.
- 편집기
  - 폰: 아래 시트(visual viewport 높이에 묶어 키보드가 저장 버튼을 가리지 않게), 데스크톱: 오른쪽 패널(가운데 좁은 모달 아님).
  - 날짜 칩 `10월 5일 월요일 ▾` → 누르면 날짜 입력.
  - 질문 하나: `무엇을 남길까요?` (placeholder `예: 피부과, 점심, 엄마 생신`). **제목 필수**(Core 계약). 제목 없이 저장 불가: `무엇을 남길지 한 단어라도 적어 주세요.`
  - 칩으로 점진 공개: 시간 / 금액 / 장소 / 메모 / 종료 / 더보기. "하루 종일" 체크박스를 앞세우지 않는다(시간을 안 넣으면 시간 없는 기록).
  - 시간: 빠른 선택 09:00 / 12:00 / 18:00, `시간 지우기`, HH:mm 검증. 종료 시각은 시작 시각이 있어야 활성.
  - 금액: `inputmode=numeric`, 천 단위 표시 + `원`. 분류(음식/여행/쇼핑/생활비/기타/미분류)는 선택 사항이며 금액 없이 기록된 분류도 **보존**된다(편집 시 잃지 않음).
  - 게스트 한도 문구: `로그인 없이 남길 수 있는 기록 3개를 모두 썼어요. 로그인하면 계속 남길 수 있어요.` (한도 3 그대로)
  - 삭제 확인: `이 기록을 삭제하시겠습니까?` / `삭제한 기록은 복구할 수 없습니다.`
- 저장 후 다른 날짜로 저장했으면 그 날짜로 이동하고 `M월 D일에 저장했어요.` 를 알린다.

## 6. 자연어 빠른 추가 · 사진

```
NATURAL_LANGUAGE_FAST_ADD=NOT_IMPLEMENTED_THIS_PHASE
EXISTING_SHARED_PARSER_FOUND=PARTIAL
NEW_CORE_REQUIRED=YES
```

- 조사 결과: Core 의 명령 미리보기(`/v2/life/commands/preview`, 로그인 전용)가 "M월 D일 N시 제목" 형태를 해석하지만 금액·분류·장소·기간을 다루지 않고 게스트에서 쓸 수 없다. Site 에서 별도 NLP 를 만들지 말라는 지시에 따라 구현하지 않았다. 공용 파서(Core)가 금액·기간·게스트 경로를 갖춘 뒤 붙이는 것이 맞다.
- 사진: 버튼 이름 `사진에서 기록 읽기`. 읽는 중 `사진에서 일정·거래 정보를 읽는 중… 사진 자체는 캘린더에 저장되지 않아요.`
  - 읽은 결과는 **확인 카드**: `사진에서 읽었어요` / 제목 / 금액 / `분류 · 날짜` / 장소·상점 / `사진 자체는 캘린더에 저장되지 않아요.` / **[수정] [저장]**. 자동 저장 없음(저장을 누르기 전 쓰기 요청 0건 — validator 로 고정).
  - 날짜나 제목이 없으면 저장이 비활성이고 빠진 것만 짚는다(`날짜를 정한 뒤 저장할 수 있어요. [수정]을 눌러 채워 주세요.`).
  - 거래가 아닌 사진(가족·여행 사진, `NOT_A_TRANSACTION`)·초안 없음: `이 사진에서 일정·거래 정보를 찾지 못했어요. 사진 자체는 캘린더에 저장되지 않아요. + 기록으로 직접 남길 수 있어요.`
  - 403: `지금은 사진에서 기록을 읽을 수 없어요. + 기록으로 직접 남겨 주세요.`(로그인으로 보내지 않음)
  - 게스트: `사진에서 기록을 읽으려면 LOTBI에 로그인해 주세요. + 기록은 로그인 없이도 쓸 수 있어요.`(네트워크 호출 없음)

## 7. 월 · 주 · 목록

- **월(폰 ≤600px)**: 칸 전체가 하나의 터치 대상(52px). 날짜 숫자, 오늘(링+점, 기존 대표 지시 유지), 선택, 공휴일 면, 기록 점(최대 3), 선택적 날씨 글리프. 금액·제목·사진 수·기온·메모는 칸에 없다. 4/5/6주 그대로.
- **월(태블릿·데스크톱)**: 칸당 제목 최대 2줄 + `+N`. 칸 미리보기 순서도 날짜 상세와 같다(마감 → 시각순 → 시간 없는 것). 여러 날 기록은 실제로 불러온 데이터만으로 이어진 막대(`20 ━━ 제주 호텔 ━━ 22`, 첫 칸에만 제목). 칸 폭이 ~96px 미만이면(컨테이너 쿼리) 기온 줄을 숨기고 글리프만 모서리에 둔다 — 잘림 방지.
- **주**: 7일 스트립 + 날짜별 생활 목록이 기본(`생활목록`). 데스크톱만 `시간표` 토글(기존 시간 격자 유지). 폰은 시간 격자를 쓰지 않는다. 스트립을 누르면 그날로 스크롤. 데스크톱은 월과 같은 오른쪽 날짜 레일.
- **목록**: 필터를 4개로 줄였다 — `이번 달` / `다가오는` / `금액` / `날짜 미정`.
  - `다가오는` 은 지금 불러온 달 안에서만 계산한다(빈 문구도 `이 달에는 다가오는 기록이 없어요.`). 달을 넘는 범위 읽기는 Core 가 필요해 흉내 내지 않았다.
  - "기한"은 별도 필터 대신 `이번 달` 맨 위의 `기한 지남` 묶음(Core attention)으로 둔다. 다가오는 기한 전체를 보여 주려면 달을 넘는 조회가 필요하다(§9).
  - 옛 필터 값(`today`/`week`/`payment`)은 `upcoming`/`amount` 로 안전하게 정규화한다.

## 8. 테스트

환경: Windows 노트북, Node 24.19.0, Chrome 154.0.8037.95(headless, CDP). Python 미설치 — 설치하지 않았다.

검증 대상: CI 워크플로(`site-review.yml`, `site-universal-life-calendar-01.yml`)가 부르는 Node validator 전부 + 캘린더 관련 validator = **144개**. 저장소를 CI 가 받는 바이트(LF)로 복사한 스냅샷에서 실행. 각 validator 가 띄우려는 `python3 -m http.server` 대신 같은 포트의 Node 정적 서버를 쓴다(내용 동일, 서버만 대체).

**기준선 (main `ccc64820`, 캘린더 63개)**: 58 PASS / 5 FAIL — compact_editor_01(픽스처 서버 타이밍), modal_runtime_02(`touch selected-day panel must stay in document flow` — 아래 경합), outside_month_01(Chrome 경로), festival_calendar_link_01(Windows ESM 경로), global_location_foundation_01(git 저장소 필요).

**최종 (이 브랜치, 144개)**

| 결과 | 수 | 내용 |
|---|---|---|
| PASS | 134 | 첫 전체 실행 |
| PASS (재실행) | 1 | touch_monthnav_daysheet_01: 백그라운드 렌더가 패널을 갈아 끼우는 사이 옛 요소를 재던 validator 경합 → 매번 새로 읽게 고친 뒤 3/3 PASS. 같은 방식으로 day_panel_two_buttons_01 도 보강, 3/3 PASS |
| PASS (환경 보정) | 5 | festival_calendar_link_01 · festival_event_08_detail_01 · festival_public_boundary_01: Windows 절대경로 ESM import 를 임시 사본에서 file URL 로만 바꿔 PASS. global_location_foundation_01: git worktree 안에서 PASS. site_avatar_fallback_runtime: :4173 정적 서버로 PASS |
| 환경상 미실행/실패 | 4 | festival_event_08_responsive_a11y_01 · pet_family_web_01 · global_location_browser_compat_01: 실행 중 `python3`(동적 포트 http.server / 소켓 프로브)가 필요 → NOT_RUN_LAPTOP_NO_PYTHON. mobile_footer_legal_sheet_01: 수정하지 않은 main 스냅샷에서도 같은 assertion(`761px: mobile disclosure leaked into desktop`)으로 실패 — 이 브랜치와 무관한 기존 상태. 4개 모두 변경 파일과 무관하며 main 에서 동일하게 실패함을 확인 |

- `validate_calendar_modal_runtime_02`: 기준선에서도 실패하던 경합. 원인은 백그라운드 갱신(`refresh`, 위치 권한 동기화, 재진입, 날짜 넘어감, 사진 상태)이 `render()` 로 DOM 을 다시 그리며 키보드 포커스를 버리던 것. 이제 화면의 일부가 된 날짜 상세에서는 실제 사용자에게도 생기는 문제라 **제품 코드에서** `renderPreservingFocus()` 로 고쳤다(주·목록 행 포함). 수정 후 6/6 연속 PASS.
- `node scripts/asset_cache_version.mjs` (check): PASS — `aset-b162e8b268f9`, targets 105, refs 129.
- `node --check` 는 이 저장소의 확장자 `.js` ES 모듈에서 중복 `const` 같은 모듈 오류를 잡지 못한다(실제로 한 번 놓쳤다). 변경한 모듈은 임시 `.mjs` 사본으로 모듈 구문 검사 PASS.
- Python gate — **NOT_RUN_LAPTOP_NO_PYTHON**: validate_site.py, validate_clean_urls.py, validate_ios_social_return_01.py, sync_footer_business_info.py --check, validate_home_chat.py, validate_bare_white_home_skin_01.py, validate_hardening.py, validate_accessibility.py, validate_about.py, validate_apple_app_site_association.py. (정적 확인: validate_hardening 이 잠근 `styles.css`·`site-consumer-layout.js` 는 바뀌지 않았고, 잠긴 법적 HTML 은 `?v=` 토큰만 바뀌었으며 그 gate 는 토큰을 지우고 해시한다. validate_home_chat 은 `site-calendar.css?v={현재 토큰}` 링크를 보는데 토큰은 일관되게 갱신됐다.)
- 실행 기록: `_handoff/calendar-life-ux-redesign-01/runs/` (baseline·r1·r2·r3 요약과 로그).

### 8.x 화면 확인 (Chrome, 사람이 직접 봄)

로컬 합성 미리보기(`scripts/.calendar-life-ux-preview.html`, gitignore — 커밋하지 않음)를 Node 정적 서버로 띄우고 Chrome CDP 로 정확한 viewport(폰은 mobile+touch 에뮬레이션, 2x)에서 캡처했다. 모든 캡처에서 가로 오버플로 0 (`documentElement.scrollWidth == innerWidth`).

- 390×844 / 768×1024 / 1440×900 각각: 월, 주, 목록, 년, 날짜 상세(기록 많은 날·빈 날·기간 중간 날), + 기록 기본, 시간 열림, 금액 열림, 수정, 사진 확인 카드, 월 금액 한 줄, 금액 상세, 게스트.
- 추가: 360×780, 344×800, 1024×800, 1180, 1280, 1366(데스크톱 레일 폭 확인), 다크(390/768/1440), 게스트 한도, 사진 초안 3종(숙박·날짜 없음·거래 아님), 게스트 사진, 주 시간표(1440/1024), 빈 달.
- 위치: `_handoff/calendar-life-ux-redesign-01/screenshots/` (round2 = 수정 전 검토, round3 = 최종). web root 밖.
- 이것은 **에뮬레이션**이다. iPhone Safari / Android Chrome / Samsung Internet 실기기 PASS 가 아니다. 가상 키보드와 저장 버튼 충돌은 headless 로 재현할 수 없어 **NOT TESTED** (구현: 편집기 시트를 visualViewport 높이에 묶음).

### 8.y 합성 Fixture (명세 §37)

| 명세 | 미리보기 데이터 |
|---|---|
| A 빈 날짜 | 10/6 (`오늘은 아직…`/`이 날은 기록이 없어요.`) |
| B 제목만 | 10/10 `가족 나들이`, 10/12 `엄마 생신` |
| C 09:00 피부과 | 10/5 09:00 `피부과 진료` |
| D 점심 12,000원 FOOD | 10/5 12:30 `점심` 12,000원 음식 |
| E 하루종일 | 시간 없는 DATE_ONLY 기록으로 표시(구분 필드 없음 — §9-1) |
| F DEADLINE | 10/5 `전기요금 납기`(오늘 마감), 지난달 `자동차 보험 갱신`(기한 지남) |
| G 호텔 10/20~10/22 | `제주 OO호텔` 10/20 15:00 → 10/22 11:00, `가을 휴가` DATE_RANGE 10/27–29 |
| H 하루 10건 이상 | 10/16 11건 |
| I 긴 한국어 제목 | 10/5 18:00 `저녁 약속 - 대학 동기들과 오랜만에 강남역 근처 …` |
| J 금액 없음 | `scenario=empty` 달, 금액 없는 게스트 기록 |
| K 분류 여러 개 | 10월: 음식·여행·쇼핑·생활비 |
| L 게스트 3건 한도 | `mode=guest&scenario=quota` |

validator 들은 각자 고정 fixture 로 같은 계약을 다시 잰다(예: 숙박 `09/12 15:00 → 09/13 11:00`, 겹치는 09:00/09:30 레인, 6칸 대신 한 줄 합계 314,500원·게스트 301,820원).

### 8.z 모바일 수용 · 접근성 (명세 §39–40)

- 390: 가로 오버플로 없음, 7열 그리드, 4/5/6주(검증 고정), 칸 전체 52px 터치, 타임라인 행 52px, 금액 오른쪽 정렬(tabular-nums), 긴 제목 줄바꿈/말줄임, 아래 시트, 월·주 이동(스와이프 포함), 선택(테두리)·오늘(링+점+`오늘` 배지)·공휴일(면) 구분 — 색만으로 구분하지 않음.
- 키보드: 날짜 그리드·주 스트립 roving tabindex, Enter 로 날짜 상세에 진입, 상세 안 Escape → 날짜로 복귀(Calendar 모달은 열린 채), 편집기·사진 카드·금액 상세 Tab 가둠 + Escape 닫기 + 포커스 복귀, 백그라운드 갱신 중에도 포커스 유지(이번에 보강).
- aria: 날짜 버튼 `2026년 10월 5일 월요일, 기록 6개, 오늘, …`, `+ 기록` 은 `10월 5일에 기록 추가`, 금액 줄은 `… 자세히 보기`, 장식 글리프 aria-hidden.
- reduced motion: 스크롤·시트 애니메이션이 즉시 전환으로 바뀐다(검증 고정).

## 9. FUTURE_CORE_GAP

1. **하루 종일 vs 시간 없음** 구분 필드 없음 → 지금은 "시간 없는 기록"으로만 표시.
2. **달을 넘는 DATE_RANGE / 범위 조회**: 월 단위 agenda 만 읽으므로 앞달에서 시작한 기간은 이번 달 막대에 시작점 없이 보일 수 있고, `다가오는`·기한 목록이 이번 달로 제한된다.
3. **금액의 날짜 vs 일정 날짜**: 숙박 결제일과 숙박 기간이 다를 수 있으나 계약상 하나의 날짜만 있다(이어지는 날에는 금액을 반복하지 않는 것으로 처리).
4. **예정 금액 vs 실제 금액** 구분 없음 → 화면은 "입력 금액"이라고만 말한다.
5. **사진·추억(미디어) 보관**: 이번 단계 UI 없음. 사진은 저장하지 않는다고 명시. 이후 미디어 첨부를 막지 않는 구조로 두었다.
6. **공용 자연어 파서**(금액·기간·장소·게스트 지원) — §6.
7. **개인 알림(리마인더)** 설정 UI·계약.
8. **청구서/고지서 분류기**(BILL) — 사진 초안의 문서 종류 세분화.
9. **기록 검색**.
10. **게스트 → 계정 이전**(로그인 시 이 기기 기록 옮기기) 미구현 — 게스트 문구는 이전을 약속하지 않는다.

## 10. 회사 PC 검토 체크리스트

- 실기기: iPhone Safari / Android Chrome / Samsung Internet 에서 하단 고정 바, 시트 편집기 + 키보드, 스와이프 월 이동. (이번 검증은 에뮬레이션뿐 — NOT TESTED)
- 대표 확인 필요(결정 번복):
  - 이전 지시 "캘린더를 열면 날짜 창이 저절로 뜨지 않는다(PR #272)" → 이번 명세(날짜 상세는 화면의 일부, 하단 `+ 기록`)에 따라 **오늘의 기록을 처음부터 보여 준다**. 그 지시가 막으려던 것(누르지 않은 날짜 선택, 달력을 덮는 창, 저절로 들어가는 커서)은 계속 막고 validator 로 고정했다.
  - 데스크톱 레일의 버튼 문구 `+ 기록`(폰 고정 바는 `+ M월 D일에 기록`).
  - 오늘 표시의 "숫자 옆 점"(기존 대표 지시)은 그대로 두었다. 폰에서 기록 점과 함께 보이므로 실기기에서 혼동 여부 확인 권장.
- 1024–1366px(작은 노트북·가로 태블릿): 레일 때문에 칸이 좁아 기온 대신 글리프만 보인다.
- 캘린더 워크스페이스 설명 문구(`LOTBI에 등록된 개인 일정을 확인하고 관리합니다.`)는 `site-conversation.js` 소관이라 바꾸지 않았다.

## 11. 하지 않은 것 (명시)

main 직접 push / force push / rebase / reset / history rewrite / Production 배포 / Core·DB·App·Admin 변경 / Python 설치 / 자동 저장 / 새 NLP — 모두 하지 않았다.
