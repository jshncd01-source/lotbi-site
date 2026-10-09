# LOTBI_VOUCHER_UNIFIED_MERCHANT_ADMIN_P0 — Core API 계약

온누리상품권·지역화폐 통합 메뉴의 Core 계약이다. Core·Admin·Site가 이 문서를 같이 본다.

- 온누리상품권은 **기존 계약 그대로**: `GET /v2/life/onnuri/merchants`, `GET /v2/life/onnuri/regions` (변경 없음).
- 지역화폐(지역사랑상품권)는 새 경로 `/v2/life/vouchers/*`(공개), `/admin/life/vouchers/*`(관리자).
- 상품권을 발행·판매·결제하지 않는다. 잔액조회·구매·결제 기능은 없다.

## 0. 공통 원칙

- 공개 응답에는 `PUBLISHED` 연결(가맹점↔상품권)과 `ACTIVE` 상품권만 나온다.
- 같은 지역에 있다는 이유만으로 가맹점을 어떤 상품권에 연결하지 않는다. 연결마다 근거(`source`)가 있다.
- 사업자등록번호는 공개·관리자 응답 어디에도 나오지 않는다(내부 중복 판정용 해시만 보관).
- 좌표가 없거나 확인되지 않은 가게는 거리순에 넣지 않는다. 주소로만 목록에 나온다.
- 공개 응답은 `Cache-Control: no-store`. 공개 API는 IP당 분당 40회(초과 시 429 `VOUCHER_PUBLIC_RATE_LIMITED`).
- 오류 형식: `{"detail": {"code": "...", "message": "한국어 문장", "field": "선택"}}`.

### 상태 어휘

| 대상 | 값 |
|---|---|
| 상품권 `status` | `ACTIVE`(운영 확인) · `SUSPENDED`(운영 중단) · `NEEDS_REVIEW`(확인 필요) · `DISCONTINUED`(폐지) |
| 연결·수정 `status` | `DRAFT` · `VALIDATING` · `PENDING_REVIEW` · `PUBLISHED` · `REJECTED` · `WITHDRAWN` |
| 일괄등록 배치 `status` | `DRAFT`(업로드됨) · `VALIDATING` · `PENDING_REVIEW` · `PUBLISHED` · `REJECTED` · `ROLLED_BACK` · `FAILED` |
| 출처 `source.kind` | `OFFICIAL_API`(한국조폐공사 공식 공개자료) · `LOCAL_GOV_LIST`(지자체 공개 가맹점 명단) · `OPERATOR_LIST`(승인된 운영기관 자료) · `ADMIN_ENTRY`(LOTBI 관리자 등록자료) |
| 결제유형 | `PAPER`(지류) · `MOBILE`(모바일) · `CARD`(카드) |
| 업종 그룹 `category.code` | `FOOD` 음식점 · `CAFE` 카페·간식 · `GROCERY` 장보기 · `CLOTHING` 의류·잡화 · `LIVING` 생활 · `HEALTH` 병원·약국 · `EDU` 학원·교육 · `OTHER` 기타 |

`source.kind` 화면 문구(고정):

- OFFICIAL_API → `한국조폐공사 공식 공개자료`
- LOCAL_GOV_LIST → `지자체 공개 가맹점 명단`
- OPERATOR_LIST → `승인된 운영기관 자료`
- ADMIN_ENTRY → `LOTBI 관리자 등록자료`(공식 인증 아님)

## 1. 공개 API (guest, GET만)

### 1.1 `GET /v2/life/vouchers/regions`

| 질의 | 응답 `level` | 내용 |
|---|---|---|
| (없음) | `SIDO` | 시·도 16개(2026 경계, 전남광주통합특별시 포함) |
| `sido` | `SIGUNGU` | 그 시·도의 시·군·구(구가 있는 시는 시 단위로 묶음: `수원시`) |
| `sido`+`sigungu`+`level=DONG` | `DONG` | 게시된 가맹점 주소에서 나온 읍·면·동 이름 |

```json
{"schema_version": 1, "level": "SIGUNGU", "sido": "경기도", "sigungu": null,
 "items": [{"name": "수원시", "scheme_count": 1, "merchant_count": 0}]}
```

### 1.2 `GET /v2/life/vouchers/schemes?sido=&sigungu=`

선택한 지역에서 쓸 수 있는 `ACTIVE` 상품권. 광역 상품권과 시·군·구 상품권이 같은 지역에서 함께 쓰이면 둘 다 나온다.

```json
{"schema_version": 1,
 "catalog": {"source": "DB" | "SEED", "checked_on": "2026-10-10",
             "sources": [{"label": "행정안전부 내고장알리미 지역사랑상품권", "url": "https://www.laiis.go.kr/lips/mlo/lcl/localGiftList.do"},
                         {"label": "행정안전부 지역사랑상품권 발행 현황('25.10. 기준)", "url": "https://mois.go.kr/frt/sub/a06/b07/localVoucher/screen.do"}]},
 "region": {"sido": "강원특별자치도", "sigungu": "춘천시"},
 "items": [SchemeView, ...],
 "empty_reason": null | "REGION_REQUIRED" | "NO_SCHEME_FOR_REGION"}
```

SchemeView:

```json
{"id": "vs_...", "name": "춘천사랑상품권", "issuer": "춘천시", "issuer_level": "CITY" | "PROVINCE",
 "sido": "강원특별자치도", "sigungu": "춘천시" | null, "usage_area_label": "강원특별자치도 춘천시",
 "payment_types": {"paper": true, "mobile": true, "card": null},
 "status": "ACTIVE", "official_url": "https://..." | null, "official_merchant_search_url": "https://..." | null,
 "source_label": "행정안전부 내고장알리미", "last_verified_on": "2026-10-10", "merchant_count": 0}
```

- `payment_types` 값 `null` = 공식 자료가 말하지 않음(추측 금지).
- `catalog.source=SEED`: 관리자가 아직 목록을 DB에 적재하지 않아 Core에 내장된 공식 목록 사본을 읽은 것. 이때 `merchant_count`는 0이다.

### 1.3 `GET /v2/life/vouchers/merchants`

| 질의 | 필수 | 설명 |
|---|---|---|
| `scheme_id` | 예 | 상품권 |
| `sido`, `sigungu`, `dong` | | 지역 좁히기(상품권 사용 지역 안에서만) |
| `q` | | 가맹점 이름(최대 40자) |
| `category` | | 업종 그룹 코드 |
| `payment` | | `PAPER`/`MOBILE`/`CARD` |
| `latitude`,`longitude` | | 둘 다 있으면 거리순(`mode=NEARBY`), 좌표 있는 가게만 |
| `radius_meters` | | 1000/3000/5000/10000/25000, 기본 5000 |
| `limit` | | 기본 12, 최대 30 |
| `offset` | | 0~3000 |

```json
{"schema_version": 1, "mode": "REGION" | "NEARBY", "scheme": SchemeView,
 "total_count": 37, "limit": 12, "offset": 0, "has_more": true,
 "items": [MerchantView, ...],
 "empty_reason": null | "NO_DATA_REGISTERED" | "NO_MATCH" | "NO_LOCATED_NEARBY",
 "official_merchant_search_url": "https://..." | null,
 "notice": "공식 공개자료·관리자 확인 자료를 안내해요. 실시간 결제 가능 여부가 아니니 방문 전 가맹점에 확인해 주세요."}
```

- `NO_DATA_REGISTERED`: 이 상품권·지역에 LOTBI에 게시된 가맹점이 0건. 화면 문구는 "현재 LOTBI에 등록된 가맹점 정보가 없습니다."(가맹점이 없다고 단정하지 않음) + 공식 조회 페이지 링크.
- `NO_MATCH`: 게시 데이터는 있으나 검색어·업종 조건에 맞는 것이 없음.
- `NO_LOCATED_NEARBY`: 반경 안에 좌표 확인된 가게가 없음(주소만 있는 가게는 지역 검색으로 보라고 안내).

MerchantView:

```json
{"id": "vm_...", "name": "하쏘헤어", "address": "강원특별자치도 원주시 ... 12", "sido": "강원특별자치도", "sigungu": "원주시", "dong": "단계동" | null,
 "category": {"code": "LIVING", "label": "생활"} | null, "category_detail": "이용 및 미용업" | null,
 "phone": "0337431234" | null,
 "location": {"latitude": 37.3, "longitude": 127.9, "precision": "OFFICIAL" | "PROVIDED" | "STAFF_VERIFIED"} | null,
 "distance_meters": 420 | null,
 "business_status": "OPERATING" | "SUSPENDED" | "UNKNOWN",
 "accepts": [{"scheme_id": "vs_...", "scheme_name": "원주사랑상품권",
              "payment_types": {"paper": null, "mobile": true, "card": null},
              "source": {"kind": "OFFICIAL_API", "label": "한국조폐공사 공식 공개자료"},
              "last_verified_on": "2026-10-10"}],
 "address_precision": "STREET" | "REGION_ONLY",
 "map_query": "강원특별자치도 원주시 ... 12 하쏘헤어"}
```

- `accepts`에는 이 가게에서 **근거가 있는 게시 연결만** 나온다(검색한 상품권이 맨 앞).
- 폐업(CLOSED)·해지된 가게는 공개 응답에서 빠진다. 휴업은 `SUSPENDED`로 표시한다.
- `address_precision=REGION_ONLY`면 상세 위치가 검증됐다고 표시하지 않는다.

### 1.4 `GET /v2/life/vouchers/merchants/{id}`

`{"schema_version": 1, "item": MerchantView}`. 게시 연결이 하나도 없으면 404 `VOUCHER_MERCHANT_NOT_FOUND`.

## 2. 관리자 API (`/admin/life/vouchers`)

- 인증: 기존 Admin MFA 세션 쿠키. 쓰기는 Origin 검사. 응답 no-store.
- 권한(기존 생활정보 온누리 권한 재사용):
  - 읽기 `admin.life.onnuri.read` (생활정보 담당 ROLE_FESTIVAL_ADMIN, PLATFORM_ADMIN)
  - 등록·수정·업로드·검증·비공개 `admin.life.onnuri.write` (같은 역할)
  - **게시·반려·롤백** `admin.life.onnuri.publish` (PLATFORM_ADMIN만)
- 수정·게시·롤백은 `expected_version`(정수) 필수. 다르면 409 `VOUCHER_VERSION_CONFLICT`(다른 직원이 먼저 바꿈 → 새로 읽기).
- 모든 쓰기는 작업 이력(`/history`)에 수정 전후 값과 직원 ID를 남기고, 관리자 감사로그에도 한 줄을 쓴다.

### 2.1 현황·목록

- `GET /overview` → `{"catalog": {"source", "scheme_counts": {"ACTIVE": n, ...}}, "merchants": {"published": n, "pending_review": n, "withdrawn": n}, "batches": {"PENDING_REVIEW": n, ...}, "official_api": {"enabled": bool, "key_configured": bool, "last_sync_at": "...", "last_error": "..."|null}, "unmapped_official_rows": n}`
- `POST /catalog/seed` (write) → 내장 공식 목록을 DB에 적재. 이미 있는 상품권(같은 scheme_key)은 건드리지 않는다. `{"created": n, "unchanged": n}`

### 2.2 상품권

- `GET /schemes?sido=&sigungu=&status=&q=` → `{"items": [AdminSchemeView]}`
- `POST /schemes` (write) body `SchemeIn`
- `PATCH /schemes/{id}` (write) body `SchemeIn` 일부 + `expected_version`

```json
SchemeIn = {"name": "수원페이", "issuer": "수원시", "issuer_level": "CITY", "sido": "경기도", "sigungu": "수원시" | null,
            "usage_areas": [{"sido": "경기도", "sigungu": "수원시"}],
            "payment_types": {"paper": null, "mobile": null, "card": true},
            "operator_name": "코나아이" | null, "official_url": "https://..." | null,
            "official_merchant_search_url": "https://..." | null,
            "status": "ACTIVE", "source_label": "수원시 공식 안내", "source_url": "https://...", "source_checked_on": "2026-10-10",
            "provider_codes": ["I0000001"], "provider_codes_evidence": "운영대행사 공지 URL 등" | null,
            "note": "비공개 메모" | null}
AdminSchemeView = SchemeView + {"scheme_key", "version", "provider_codes", "provider_codes_evidence", "operator_name", "source_url", "mapping_candidate": bool, "note", "created_at", "updated_at", "updated_by"}
```

- `status=ACTIVE`로 저장하려면 `source_url`(https)과 `source_checked_on`이 있어야 한다(없으면 422 `VOUCHER_SCHEME_SOURCE_REQUIRED`).
- `usage_areas`의 시·도·시·군·구는 Core 지역표에 있어야 한다(422 `VOUCHER_REGION_UNKNOWN`).

### 2.3 가맹점(개별)

- `GET /merchants?scheme_id=&q=&sido=&sigungu=&status=&limit=50&offset=` → `{"items": [AdminMerchantView], "total_count": n}`
- `GET /merchants/{id}` → AdminMerchantView
- `POST /merchants` (write) body MerchantIn → 201 AdminMerchantView. 새 연결은 `PENDING_REVIEW`.
  - 같은 가게 후보가 있으면 409 `VOUCHER_DUPLICATE_CANDIDATE` + `detail.candidates: [{id, name, address}]`. 다시 보낼 때 `"merge_into": "vm_..."`(그 가게에 연결 추가) 또는 `"confirm_new": true`.
- `PATCH /merchants/{id}` (write) body 일부 + `expected_version` → 게시 연결이 있는 가게면 수정안이 `pending_change`로 저장되고(`PENDING_REVIEW`) 게시 후 공개에 반영. 없으면 바로 반영.
- `POST /merchants/{id}/acceptances` (write) `{"scheme_id", "payment_types", "source": SourceIn}` → 연결 추가(`PENDING_REVIEW`)
- `POST /merchants/{id}/withdraw` (write) `{"expected_version", "reason", "scheme_id": 선택}` → 해당(또는 전체) 연결 `WITHDRAWN`(비공개). 즉시 공개에서 빠짐.

```json
MerchantIn = {"scheme_id": "vs_...", "name": "...", "sido": "경기도", "sigungu": "수원시", "dong": "인계동" | null,
              "address": "경기도 수원시 팔달구 효원로 1", "address_detail": "1층" | null,
              "category": "한식" | null, "phone": "031-123-4567" | null,
              "latitude": 37.26 | null, "longitude": 127.03 | null, "coordinate_source": "직원 현장 확인 등" | null,
              "business_status": "OPERATING" | "SUSPENDED" | "UNKNOWN",
              "payment_types": {"paper": true, "mobile": null, "card": null},
              "source": SourceIn, "admin_note": "비공개 메모" | null,
              "merge_into": null, "confirm_new": false}
SourceIn = {"kind": "LOCAL_GOV_LIST" | "OPERATOR_LIST" | "ADMIN_ENTRY", "label": "수원시 가맹점 명단(2026-09)", "url": "https://..." | null, "source_date": "2026-09-30" | null}
AdminMerchantView = MerchantView 필드 + {"version", "status_summary", "acceptances": [{"id", "scheme_id", "scheme_name", "status", "payment_types", "source": {"kind","label","url","source_date"}, "batch_id", "verified_on", "version"}], "pending_change": {...} | null, "admin_note", "created_by", "updated_by", "created_at", "updated_at"}
```

검증(422, `field` 포함): 필수(상품권·가맹점명·시·도·시·군·구·주소·출처), 지역표에 없는 지역, **상품권 사용 지역 밖의 가게**(`VOUCHER_SCHEME_REGION_MISMATCH`), 주소가 시·도/시·군·구와 다름, 주소가 지역명뿐(도로명+건물번호 또는 지번 필요, `VOUCHER_ADDRESS_NOT_SPECIFIC`), 좌표가 한국 밖이거나 한쪽만 있음, 좌표 있는데 근거 없음, 전화번호 형식, 출처 URL이 https 공개 주소가 아님.

### 2.4 검수·게시

- `GET /reviews?batch_id=&limit=&offset=` → `{"items": [{"type": "ACCEPTANCE" | "MERCHANT_CHANGE", "id", "merchant": {...}, "scheme": {...}, "before": {...}|null, "after": {...}, "source", "requested_by", "requested_at", "version"}], "total_count"}`
- `POST /reviews/publish` (publish) `{"items": [{"type", "id", "expected_version"}]}` → `{"published": n, "conflicts": [{"id","code"}]}`
- `POST /reviews/reject` (publish) `{"items": [...], "reason": "..."}`

### 2.5 파일 일괄등록 (CSV·XLSX)

1. `POST /imports` (write, multipart) `file`, `scheme_id`(선택: 파일에 상품권 열이 없을 때), `source_kind`, `source_label`, `source_url`(선택), `source_date`(선택)
   - 형식: `.csv`(UTF-8/UTF-8 BOM/CP949) · `.xlsx`. 최대 10MB, 20,000행, 40열. `.xlsm`·매크로·외부 연결·수식 셀·비정상 압축(압축 해제 60MB 초과·비율 100배 초과·항목 2,000개 초과)은 거부.
   - 같은 파일(sha256)·같은 상품권으로 진행 중이거나 게시된 배치가 있으면 그 배치를 돌려준다(`"reused": true`) — 같은 파일 반복 업로드로 가게가 늘지 않는다.
   - 응답 201: `{"batch": BatchView, "headers": ["지역화폐명", ...], "suggested_mapping": {"voucher_name": "지역화폐명", "merchant_name": "가맹점명", ...}, "sample_rows": [[...]], "reused": false}`
2. `POST /imports/{id}/validate` (write) `{"expected_version", "mapping": {"merchant_name": "가맹점명", ...}, "scheme_id": 선택}` → 행마다 판정 → 배치 `PENDING_REVIEW`
   - 표준 필드: `voucher_name, merchant_name, sido, sigungu, dong, address, category, phone, latitude, longitude, source_name, source_date` (한글 머리글 자동 인식: 지역화폐명·가맹점명·시도·시군구·읍면동·주소·업종·전화번호·위도·경도·출처·자료기준일)
   - 행 판정 `outcome`: `NEW`(새 가게+연결) · `LINK`(있는 가게에 이 상품권 연결 추가) · `UPDATE`(이미 연결된 가게 정보 변경, 전후 비교) · `UNCHANGED` · `DUPLICATE_IN_FILE`(파일 안 중복, 첫 행만 처리) · `ERROR`(행번호·사유) · `DUPLICATE_CANDIDATE`(같은 가게 후보, 자동으로 합치지 않음) · `WITHDRAW`(폐업·해지 → 비공개) · `UNMAPPED`(공식 행의 지역화폐를 하나로 못 정함, 공식 동기화만)
3. `GET /imports/{id}/rows?outcome=&limit=&offset=` → `{"items": [{"row_number", "outcome", "errors": [{"code","field","message"}], "values": {...}, "before": {...}|null, "target_merchant_id"}], "total_count"}`
4. `GET /imports/{id}/errors.csv` → 오류 행만(행번호·사유·원래 값). 셀이 `= + - @ TAB CR`로 시작하면 앞에 `'`를 붙여 수식으로 실행되지 않게 한다.
5. `POST /imports/{id}/publish` (publish) `{"expected_version", "policy": "VALID_ROWS_ONLY"}` → 오류 행을 뺀 행만 게시. `{"batch": BatchView, "applied": {"NEW": n, "LINK": n, "UPDATE": n}, "skipped_conflicts": n}`
6. `POST /imports/{id}/reject` (publish) `{"expected_version", "reason"}`
7. `POST /imports/{id}/rollback` (publish) `{"expected_version", "reason"}` → 이 배치가 만든 연결은 `WITHDRAWN`, 이 배치가 바꾼 가게는 바꾸기 전 값으로 되돌린다. 그 뒤 다른 배치·직원이 다시 바꾼 가게는 덮어쓰지 않고 `conflicts`로 돌려준다. 대량 삭제는 없다(행은 지우지 않고 상태만 바꿈).
8. `GET /imports?status=&limit=&offset=` → `{"items": [BatchView]}`

```json
BatchView = {"id": "vb_...", "kind": "FILE_UPLOAD" | "OFFICIAL_API_SYNC", "status": "PENDING_REVIEW", "version": 3,
             "scheme_id": "vs_..." | null, "scheme_name": "..." | null, "filename": "suwon.xlsx" | null, "file_format": "CSV" | "XLSX" | null,
             "source": {"kind", "label", "url", "source_date"},
             "counts": {"total": 120, "NEW": 100, "LINK": 5, "UPDATE": 3, "UNCHANGED": 2, "DUPLICATE_IN_FILE": 4, "ERROR": 6},
             "created_by", "created_at", "validated_at", "reviewed_by", "published_at", "rolled_back_at", "reject_reason"}
```

### 2.6 공식 API 동기화 (한국조폐공사 통합 가맹점기본정보)

- `GET /sync/status` → `{"enabled": bool, "key_configured": bool, "endpoint": "https://apis.data.go.kr/B190001/localFranchisesV3/franchiseV3", "daily_call_budget": n, "calls_today": n, "last_batches": [BatchView]}`
- `POST /sync` (write) `{"scheme_id"}` → 상품권 사용 지역 코드로 공식 API를 쪽 단위로 읽어 임시 배치(`OFFICIAL_API_SYNC`, `VALIDATING`)에 적재. 키가 없거나 꺼져 있으면 503 `VOUCHER_OFFICIAL_API_NOT_READY`.
- `POST /sync/{batch_id}/continue` (write) → 다음 쪽들(15초 예산). 끝나면 `PENDING_REVIEW`. 실패·429·한도 초과는 배치 `FAILED`가 아니라 일시정지(`last_error`)로 남고 다시 이어서 읽는다. 기존 게시본은 그대로다.
- 공식 행 → 상품권 연결 규칙: 행의 사용처 지역(주소·지역코드)과 결제유형에 맞는 상품권 후보가 **정확히 하나**일 때만 연결(`OFFICIAL_API`). 후보가 둘 이상이면 상품권의 `provider_codes`(관리자가 근거와 함께 지정한 운영대행사 코드)로 하나로 좁혀질 때만 연결. 아니면 `UNMAPPED`로 남고 공개되지 않는다.
- 해지(`frcs_reg_se=03`)·폐업(`bzmn_stts=03`) 행은 게시 시 그 연결을 `WITHDRAWN`으로 바꾼다. 휴업(02)은 `SUSPENDED`.
- 게시는 파일 배치와 같은 `/imports/{id}/publish`·`/rollback`을 쓴다.

### 2.7 작업 이력

- `GET /history?entity_type=&entity_id=&batch_id=&limit=&offset=` → `{"items": [{"id", "entity_type": "SCHEME" | "MERCHANT" | "ACCEPTANCE" | "BATCH", "entity_id", "action", "actor_admin_account_id", "before": {...}|null, "after": {...}|null, "batch_id", "reason", "created_at"}], "total_count"}`
