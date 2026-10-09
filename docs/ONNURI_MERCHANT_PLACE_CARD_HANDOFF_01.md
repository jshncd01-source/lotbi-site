# ONNURI-MERCHANT-01 — 장소카드 '온누리 가맹점' 표시 인계 (데이터 계약)

이 문서는 장소카드 담당 개발방에 넘기는 **데이터 계약**이다. 이 branch는
`createPlaceCardRail`·장소카드 정규화 코드를 수정하지 않았다(소유권: 장소·의료 카드 UX 방).
현재 장소카드 정규화는 모르는 필드를 버리므로, 이 계약을 반영하기 전까지 화면 변화는 없다.

## 1. Core가 내려주는 필드

`place_result.results[]` 의 각 장소에 **VERIFIED일 때만** `onnuri_verification` 이 붙는다
(Core `app/onnuri_matching.py: verification_payload`, 대화 답변의 온누리 카드도 같은 모양).

```json
"onnuri_verification": {
  "state": "VERIFIED",
  "source": "SEMAS_ONNURI_MERCHANT_DATASET",
  "ai_calls": 0,
  "label": "온누리 가맹점",
  "logo": null,
  "match_basis": "NAME_ADDRESS | STAFF_REVIEW | OFFICIAL_DATASET_ROW",
  "merchant_id": "<40 hex>",
  "merchant_name": "만성커피",
  "market_name": null,
  "address": "전북특별자치도 전주시 덕진구 만성중앙로 50",
  "paper": false,
  "digital": true,
  "mobile": null,
  "card": null,
  "registered_year": 2020,
  "data_source_label": "소상공인시장진흥공단 전국 온누리상품권 가맹점 현황",
  "data_source_date": "2026-07-31",
  "data_source_url": "https://www.data.go.kr/data/3060079/fileData.do",
  "synced_at": "2026-10-08T17:00:00+09:00",
  "notice": "공공데이터 등록 정보예요. 실제 결제 가능 여부는 방문 전 가맹점에 확인해 주세요."
}
```

- 필드가 **없으면**(REVIEW_REQUIRED / NOT_MATCHED / 데이터 미게시) 아무것도 표시하지 않는다.
  '비가맹', '사용 불가' 같은 문구를 만들지 않는다(미확인 ≠ 비가맹점).
- `paper`/`digital`이 `null`이면 "정보 없음". 2026 공식 자료는 모바일·카드를 '디지털형'으로
  통합해 `mobile`/`card`는 항상 `null` — 모바일/카드 구분을 추측해 표시하지 않는다.

## 2. 화면 규칙 (사용자 결정 2026-10-08)

- 배지 텍스트: **`온누리 가맹점`** (Core `label` 값 그대로). 🎟️ 이모티콘·임의 제작 아이콘 금지.
- 공식 온누리상품권 로고는 **사용 승인 전 적용 금지**. 로고 자리만 준비:
  `<i class="onnuri-logo-slot" data-brand-logo-slot="onnuri" data-logo-state="PENDING_APPROVAL" aria-hidden="true"></i>`
  (`site-life-onnuri.css`에 `PENDING_APPROVAL`이면 표시 안 함 규칙이 있다). Core `logo`는 승인 전 `null`.
- 소상공인시장진흥공단의 공식 제휴·인증 서비스로 오해될 표현 금지('공식 인증', '제휴 가맹점' 등).
- 배지는 작게, 카드 내용·전화·지도/길찾기 버튼을 가리지 않는다. 화살표 제거·모바일 스와이프·Top 3·
  Compact Card 설계는 그대로 둔다.
- 배지 선택 시 보여 줄 내용: 등록 정보(가맹점명·시장명), 지류형/디지털형 가맹 여부, 공식 데이터 기준일
  (`data_source_date`), `notice` 문구(방문 전 확인).

## 3. 반영할 곳 (장소카드 방)

1. `site-navigation.js` `normalizePlace` — `animal_hospital_verification`과 같은 방식으로
   `state === 'VERIFIED' && source === 'SEMAS_ONNURI_MERCHANT_DATASET' && ai_calls === 0` 일 때만 받기.
2. `site-conversation.js` `compactPlaceResultMeta` — 대화 저장 후 다시 열어도 남도록 snake_case로 보존.
3. `createPlaceCardRail` — 배지 렌더(위 2절), 선택 시 상세.

## 4. 확인용 데이터

- Core 테스트 `tests/test_onnuri_merchant_http_01.py::test_place_search_results_carry_badge_data_only_when_verified`
  (같은 이름·같은 건물만 VERIFIED, 같은 이름·다른 지점은 필드 없음).
- 오탐 방지 사례: `tests/test_onnuri_merchant_search_01.py::test_match_requires_same_name_and_same_building`.
