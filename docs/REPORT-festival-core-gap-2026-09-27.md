# [위치권한 15 → 총괄운영방] Core 수정 필요 보고 — 축제 지역 필터 / 거리순 정렬

작성: 2026-09-27 07:10 UTC · 「위치권한 15」방
근거: 명령문 보고규칙 "Core 수정이 필요해진 경우 즉시 총괄방 보고"
**이 방은 lotbi-core 를 건드리지 않았습니다.**

---

## 요약

축제·행사의 지역 기능과 "현재 위치 기준"이 **Core 쪽에서 동작하지 않습니다.** Web 은
좌표와 지역을 규격대로 보내고 있으며, Web 에서 고칠 수 있는 문제가 아닙니다.

1. `region=` 필터가 **모든 지역에서 0건** — PUBLISHED 19건 전부 `region_name` 이 `null`
2. 좌표를 보내도 **거리순 정렬·반경 필터가 없음** — 거리만 계산해 붙여 줌

---

## ① region 필터가 모든 지역에서 0건

`GET /festivals/browse` 의 `region=` 은 `region_name` 으로 매칭하는데, TourAPI 로 적재된
PUBLISHED 19건 전부 그 필드가 `null` 입니다.

```
GET /festivals/browse?time=ALL&limit=50                      → 19건, region_name 전부 null
GET /festivals/browse?time=ALL&limit=50&region=서울특별시       → 0건   (주소상 서울 6건)
GET /festivals/browse?time=ALL&limit=50&region=경기도          → 0건   (주소상 4건)
GET /festivals/browse?time=ALL&limit=50&region=전북특별자치도    → 0건   (주소상 1건)
GET /festivals/browse?time=ALL&limit=50&region=경상북도         → 0건   (주소상 2건)
```

**사용자 영향** — 축제 화면 "지역 변경"에서 어떤 지역을 골라도 다음만 나옵니다.

```
현재 조건에 맞는 축제·행사가 없어요 (서울특별시)
```

지역 변경 기능이 현재 데이터에서는 사실상 동작하지 않습니다. 대표님이 "지역변경 버튼이
안 눌린다"고 하신 것이 이것입니다 — 버튼은 눌리고 시트도 열리지만, 고른 결과가 비어 있습니다.

## ② 좌표를 보내도 거리순 정렬이 없음

```
좌표 없이                          → 19건, distance_km = null
전북 좌표 (35.8242, 127.148)        → 19건, distance_km 채워짐
                                     첫 결과: 서울특별시 종로구 (194.7km)
건수 동일 (19 = 19), 구성 동일
sort=distance / order_by / sort_by / nearby / radius_km  → 전부 무시 (HTTP 200, 순서 불변)
```

**사용자 영향** — 배너는 정확히 `현재 위치 기준 · 전북특별자치도` 라고 적히는데
목록은 194km 떨어진 서울 축제부터 나옵니다. 대표님이 "현재 위치 기준인데 왜 전국이냐"고
하신 지점입니다.

참고로 거리 자체는 정확히 계산됩니다. 전주 좌표로 받은 19건을 거리순으로 세워 보면:

```
1.1km   전북특별자치도 전주시 완산구   전주 국가유산야행
60.9km  대전광역시 중구               대전 중구 북페스티벌
74.2km  경상남도 거창군               감악산 꽃별 여행
...
194.7km 서울특별시 종로구             남산봉수의식 등 전통문화행사   ← 현재 1번으로 나오는 것
```

즉 **데이터는 있고 순서만 없습니다.**

---

## 필요한 Core 작업 (판단은 총괄방/축제방)

1. 축제 행의 `region_name` 채우기 (또는 `address` 에서 광역시도 도출) → 지역 변경이 동작
2. 좌표가 오면 거리순 정렬 또는 반경 필터 지원 → "현재 위치 기준"이 의미를 가짐

## 소유권 주의

`lotbi-core` 의 `app/admin_festival_*` 는 「축제담당자권한 14」방
(`session_013r9G3Q3ksn5vQGToPh2qon`)이 작업 중입니다. 축제 Core 는 그 방 소유로 보여
이 방이 손대지 않았습니다. 배정 판단 부탁드립니다.

## Web 클라이언트 정렬은 하지 않았습니다 — 기존 계약과 충돌

대표님이 임시 완화로 Web 정렬을 지시하셔서 구현했고 실측으로 동작을 확인했습니다
(전주 사용자 첫 카드가 194km 서울 → 1.1km 전주로 바뀜). 그러나
`scripts/validate_festival_list_filters_pagination_01.mjs` 가 이를 명시적으로 금지합니다.

```
// Core's browse ordering is authoritative: the UI must render results in the
// order returned and must not re-sort them (the old fixture-era sortFestivals
// must be gone from the client entirely).
assert.doesNotMatch(ui, /\.sort\(/,
  "site-festival-ui.js must never re-sort a browse page — Core's order is authoritative");
```

이전에 클라이언트 정렬을 **의도적으로 제거하고** 다시 들어오지 못하게 잠근 계약입니다.
다른 방의 결정을 이 방이 임의로 뒤집지 않기 위해 **되돌렸습니다.** 이 계약을 풀지,
아니면 Core 에서 정렬을 지원할지 총괄방에서 정해 주십시오.

(참고: 클라이언트 정렬은 어차피 완전한 해결이 아닙니다 — 정렬 범위가 "지금까지 불러온
페이지" 뿐이라, 아직 불러오지 않은 페이지에 더 가까운 축제가 있으면 뒤에 남습니다.)

---

## 이 방이 완료한 것 (Web 전용, Core 무수정)

| | |
|---|---|
| site PR #354 | 위치 공통 계층 (기능 간 권한·현재위치 재사용) — MERGED |
| site PR #355 | 축제 배너 수정 — MERGED |
| site main | `f8f9c11` · Production LIVE (`aset-b048cecbbb5a`) |
| app PR #165 | 우회 경로 제거·기능 간 재사용 — MERGED, main `5d8b254` |
| Core 변경 | **NONE** |

PR #355 에서 고친 것:
- 허용한 사용자에게 `📍 전국` 을 먼저 보여주지 않음 (확인 전에는 `현재 위치 확인 중…`)
- `지역 변경` 이 위치 확인 중에도 눌림
- 확인 중 고른 지역을 늦게 도착한 GPS 가 덮지 않음
- Safari 유형 브라우저에서 이미 확보한 좌표 재사용
- 좌표 획득 JS측 timeout 경계 (무한 spinner 방지)

site 검증기 166/166 · app 140 suites / 783 tests · Production 실측 검증 완료.

## 측정 한계 (확대 해석 금지)

- iPhone Safari: **NOT MEASURED** — 실기기 없음, WebKit 엔진도 컨테이너에서 다운로드 차단
- Android Chrome / Samsung Internet: 엔진(Chromium) 수준만 실측, 실기기 UI NOT MEASURED
- Android / iOS 앱 실기기 동작: NOT MEASURED
