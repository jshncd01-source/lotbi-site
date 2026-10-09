READY_FOR_DEPLOY=YES
MIGRATION=NO
USER_DECISION_NEEDED=NONE (배포 차단 없음. 삽입형 배경 지도는 키·계약 승인 전이라 넣지 않음 — 아래 MAP_VIEW 한계)

# ONNURI-MERCHANT-LOCATION-UX-P0 — 온누리 가맹점 찾기 화면 (Site)

TASK=ONNURI-MERCHANT-LOCATION-UX-P0
REPO=lotbi-site
SITE_BRANCH=feature/onnuri-merchant-location-ux-p0-site
SITE_FEATURE_SHA=d17a974d
CODE_SHA=d17a974d
SITE_LATEST_MAIN=576ec346
CORE_BRANCH=feature/onnuri-merchant-location-ux-p0-core
CORE_FEATURE_SHA=526ee9c2
CORE_LATEST_MAIN=6e3aab64
ASSET_VERSION=aset-bca20b82f0b3
MIGRATION_REQUIRED=NO
MIGRATION_REVISION=NONE
DEPLOY_ORDER=CORE → SITE. 새 Site는 옛 Core에서도 동작한다. coverage가 없으면 안내를 생략하고, 반경 인자는 옛 Core가 무시한다. 다만 반경·시장 목록·0건 사유는 새 Core가 있어야 나온다.
REQUIRED_ENV_CHANGES=NONE
OWNER_APPROVAL_REQUIRED=NONE
NEARBY_SEARCH_PASS=YES (Core 반경 고정·거리순·중복 없음 테스트 + Site 7화면 + 실데이터 부산 5km 19곳)
REGION_CASCADE_PASS=YES (시장 결합 시·군·구/읍·면·동, 상위 변경 시 하위 초기화, 빈 단계 사유·세종; 실데이터 부산 10·전북 5·서울 6 시·군·구 — 결합 안 된 시장 가게는 시·도 단위만)
RADIUS_SELECTION_PASS=YES (1/3/5/10/25km, Site 칩 값 = Core radius_meters, 그 밖 422)
COMPACT_CARDS_PASS=YES (12장, 1/2/3열, 긴 이름 2줄, 가로 넘침 0, 버튼 40px+)
PHONE_ACTION_PASS=YES_CODE (직원 확인 PHONE 메모만 tel: — 운영 실데이터의 확인된 번호는 0건이라 실제 화면에는 아직 전화 버튼 없음)
MAP_VIEW_PASS=PARTIAL (배경 지도 없는 위치 관계도: 반경·중심·확인된 점·점↔카드 연결. 삽입형 지도 SDK는 키·계약 승인 전이라 미적용 — KNOWN_LIMITATIONS 1)
USER_SELECTED_MAP_PASS=YES (4종 + 기본값 + 충돌 안내, 모든 버튼에 앱 이름, 화면 복귀 시 재읽기 — Chrome 흉내 검사, 실기기 미확인)
LOCATION_PRIVACY_PASS=YES (사용자 동작 전 위치 요청 없음, 약 100m 반올림·이번 검색만, 저장·로그 없음, 실패 시 임의 지역 없음)
DATA_SOURCE=온누리 공식 게시본(2026-07-31) + 전국전통시장표준데이터(2025-11-10, 1,393개 시장, Core 내장)
DATA_QUALITY_COVERAGE=운영 실제 표본 5,208곳 중 2,164곳(41.6%) 시장 결합(시·도별 15~78%), 나머지는 시·도 단위만 — 지어낸 주소·좌표·전화 0

## 무엇이 바뀌었나 (`site-life-onnuri.js`, `site-life-onnuri.css`)

- **두 가지 찾기 방식**: [내 주변] / [지역 선택] 탭.
- **내 주변**
  - 반경 칩은 1·3·5·10·25km이고 기본은 5km다. 반경을 바꾸면 Core 검색 반경도 같은 값으로 다시 검색한다.
  - 위치는 사용자가 누를 때만 묻는다. 이미 허용된 경우만 자동으로 쓴다. 약 100m로 반올림해 그 검색에만 보내고 저장하지 않는다.
  - 결과가 없을 때 두 경우를 구분한다.
    - 위치 자료가 없을 때: "주변에 가맹점이 없다는 뜻은 아니에요" + [지역 선택으로 찾기]
    - 반경 안에 없을 때: 가장 가까운 확인된 거리 + [Nkm로 넓히기]
  - 위치 확보 실패: 권한 거부·지원 안 됨·시간 초과·국외·LOTBI 위치 사용 꺼짐을 각각 다른 문장으로 안내하고 [지역 선택으로 찾기]를 준다. 임의 지역 결과는 띄우지 않는다.
- **지역 선택**
  - 시·도 → 시·군·구 → 읍·면·동, 그리고 시장·상점가 순서다. 상위를 바꾸면 하위가 초기화된다.
  - 실제 선택지가 있을 때만 선택 칸을 보인다. 비활성 빈 칸을 보이지 않는다.
  - 빈 단계는 이유와 범위 수치를 보여 준다(시·군·구 확인 N곳 / 확인 안 됨 M곳). 세종은 읍·면·동으로 바로 간다.
  - 결과 위에 범위를 표시한다(예: "부산광역시 부산진구 부전동 전체").
- **카드**
  - 한 번에 12곳을 보여 준다(기존 3곳). 폭에 따라 1열(압축 목록) / 2열(480px~) / 3열(860px~)이다.
  - 업체명은 최대 2줄, 업종·시장은 1줄, 주소는 2줄이다. "위치·거리는 소속 시장 기준"은 한 줄로 줄였다.
  - '더 보기'는 중복 없이 이어 붙인다. Core 쪽 상한(offset 600)에 닿으면 좁혀 달라고 안내한다.
- **전화**: 직원이 확인한 번호(`phone_source=STAFF_VERIFIED`)만 `tel:` 버튼으로 연결한다. 그 밖에는 버튼이 없다.
- **위치 관계도(MAP_VIEW)**
  - 배경 지도 없이 SVG로 그린다. 지도 SDK·타일·키를 쓰지 않는다.
  - 표시 대상: 검색 반경 원, 검색 중심(내 위치), 확인된 점(시장 점은 점선). 같은 위치에 여러 곳이면 숫자로 표시한다.
  - 점을 누르면 그 위치 카드가 강조되고, 선택한 지도앱 버튼이 나온다. 카드를 누르면 점이 강조된다.
  - 위치 미확인 N곳은 그리지 않고 수만 안내한다. 전국 목록일 때는 숨긴다.
- **선택한 지도앱 반영(USER_SELECTED_MAP)**
  - 모든 버튼에 앱 이름을 넣었다(예: "카카오내비 시장 길찾기", "네이버지도에서 찾기"). 화면 위에도 "지도앱: 카카오내비(내 설정)"를 표시한다.
  - 다른 탭의 Account에서 설정을 바꾸고 돌아오면(visibilitychange·focus·pageshow) 다시 읽어 버튼을 새로 만든다. 원인 1(열 때 한 번만 읽음)을 고쳤다.
  - 같은 이름 설정이 서로 다르게 둘 이상 있거나 값을 알 수 없으면, 네이버지도로 연다는 사실과 설정 링크를 화면에 표시한다. 조용히 바꾸지 않는다. 기존 `readDefaultMapProvider` 계약은 유지했다.
  - 데스크톱 티맵은 "티맵 대신 네이버지도 웹"이라고 미리 표시한다(기존 동작).
  - 좌표가 없으면 길찾기가 아니라 "○○에서 찾기"(이름 검색)만 준다.
- 공식 로고는 쓰지 않는다(승인 전, 빈 슬롯 유지). 비공식 안내와 실시간 결제 여부 문구는 보존했다. 출처에 전통시장표준데이터(기준일)를 함께 표시한다.

## 검증

- 신규 `scripts/validate_onnuri_location_ux_p0.mjs`
  - 범위: 실제 index.html, 실제 터치·마우스 입력, 360·375(다크)·390·412·768·1280·1280(다크)
  - 내 주변: 기본 5km, 반경 1·25km, 거리 오름차순, 반경 안만, 시장 거리 표시
  - 0건 두 종류(자료 없음 / 반경 밖 → 10km 넓히기), Core 실패 → 다시 시도, 준비 중
  - 지역 단계: 부산→부산진구→부전동→서면시장, 대전 빈 단계 사유, 세종 읍·면·동
  - 필터, 12장 + 더 보기 중복 없음, 열 수 1/2/3, 카드 높이, 긴 이름 2줄 제한, 가로 넘침 0, 버튼 높이 40px 이상, 탭 44px 이상
  - 다크 대비 4.5 이상, 관계도 점↔카드
  - 전화: 확인된 번호만 `tel:0511234567`
  - 지도앱 4종 각 플랫폼 href, 화면 복귀 후 반영, 설정 충돌 안내
  - 위치: 허용 / 거부 / 위치 없음 / LOTBI 위치 사용 꺼짐, 위치 요청 미발생 확인
- 기존 검사를 새 계약으로 갱신(기준 완화 아님)
  - `validate_onnuri_merchant_search_01.mjs`: 3곳 → 12곳(테스트 8곳 전부), 근처 기본 5km(2곳) + 10km(3곳), 버튼 문구에 앱 이름, 위치 버튼 → '내 주변' 탭
  - `validate_onnuri_market_location_02.mjs`: 버튼 문구에 앱 이름. 좌표 없는 경우는 이름 검색(`data-map-action=search`)만 주는지 추가로 확인
- CI(`.github/workflows/site-review.yml`)에 `validate_onnuri_location_ux_p0`와 `validate_default_map_preference_01`(기존에 CI 밖)을 추가했다.
- REAL_DATA_VALIDATION=PASS
  - 방법: 운영 실제 표본 5,208곳(2026 구조)을 넣은 로컬 Core(새 Core branch)에 같은 출처 프록시로 연결해 같은 검사를 390·1280에서 실행했다(`ONNURI_REAL_CORE`).
  - 부산시청 좌표 5km 19곳, 첫 카드 '천일상회 · 거제시장 · 시장까지 362m'
  - 지역·더 보기·반경·지도앱 시나리오 통과
- PERFORMANCE=12장 응답 처리와 그리기: 모의 Core 2~6ms, 실제 로컬 Core 약 20ms(SQLite 5,208곳). 그래서 기본 12장을 유지했다.
- SITE_TEST_RESULT=CI 워크플로의 node 검사 159개 중 157 PASS, 2 FAIL(아래 기존 실패) — 최신 main 576ec346 병합 후 최종 트리, Windows 로컬, 순차 실행 2,308초
- NEW_FAILURES=0
- KNOWN_BASELINE_FAILURES=`validate_mobile_footer_legal_sheet_01`(761px mobile disclosure leaked into desktop), `validate_site_avatar_fallback_runtime` — main 576ec346를 별도 worktree로 띄워 같은 실패 재현(Windows 로컬). 이번 변경과 무관

## 알려진 한계

KNOWN_LIMITATIONS=
1. MAP_VIEW: 배경 지도 삽입은 하지 않았다. 지도사별 사정은 아래와 같다.
   - NAVER Dynamic Map은 Maps 앱 키와 웹 서비스 URL 등록이 필요하다.
   - 카카오맵 JS는 앱의 '카카오맵' 사용 설정 확인이 필요하다.
   - 티맵·Google은 키·과금이 필요하다.
   - Site 검사는 지도 SDK·정적 지도 키를 금지한다.
   그래서 위치 관계도와 "선택한 지도앱에서 열기"를 제공한다.
2. 위치 관계도는 실제 지도가 아니다. 화면에 "배경 지도 없이 위치 관계만"이라고 표시한다.
3. 실기기(iPhone Safari·카카오톡 인앱·Galaxy) 실행은 아니다. Chrome 기기 화면 흉내로 검사했다.
4. 위치·시장 결합 범위의 한계는 Core 문서를 따른다. 골목형상점가 다수는 시·도 단위만 보인다.

BLOCKERS=NONE
