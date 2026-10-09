# JEONBUK REAL-WORLD PILOT 01 — 전북 맛집·음식 (Site)

생활정보 홈에 "전북 맛집·음식"을 추가한다. Core가 내려주는 전북 공식 공공데이터 결과는 대화 카드로 보여준다. 카드는 세 가지다.

- 음식점 카드
- 행정기관 연락처 카드
- 병원 카드의 전북 의료기관 등록정보 줄

## 생활정보 홈

- `LIFE_SHORTCUTS` 마지막에 `{id: 'jeonbuk-food', label: '전북 맛집·음식', icon: 'food', regionalFood: true}`를 추가했다. 준비중이나 비활성 카드가 아니라 바로 동작한다.
- 기존 항목(병원·의원, 약국, 축제·행사, 지역생활정보, 공과금 확인)과 순서는 그대로다.
  - 공과금 제거·상단 검색바·하단 저장행 정리는 별도 작업이 맡는다. 이 branch는 건드리지 않았다.
  - NEIS 학교정보 바로가기는 main에 없어서 만들지 않았다.
- 빈칸 없는 grid(`site-conversation.css` 끝)
  - 4열, 2열, 홈 2열 목록 모두에서 마지막 줄이 꽉 차도록 남는 항목을 늘린다.
  - 6개(현재)와 5개(공과금 제거 후) 모두 실제 Chrome에서 확인했다.

## 전북 맛집·음식 입력 (`site-life-regional.js` `createJeonbukFoodForm`)

- 입력과 칩
  - 지역: 텍스트 입력. 비우면 전북 전체다.
  - 지역 칩: 전주·한옥마을·완산구·덕진구·군산·익산·남원·내 주변
  - 음식 종류 칩(전주시 자료): 비빔밥·콩나물국밥·한정식·백반·막걸리·한식
  - 테마 칩(전북 테마별음식점 자료): 아이와 함께·조용한·편안한·어르신과 함께
  - 음식 종류와 테마는 서로 다른 공식 자료라서 한 번에 하나만 고를 수 있다.
- 질문 문장: `buildJeonbukFoodPrompt` → "전북 <지역> <테마> <음식> 알려줘". 예: "전북 전주 비빔밥 맛집 알려줘".
  - "근처"는 '내 주변'을 고르고 지역을 비웠을 때만 붙는다.
  - 이때 기존 위치 계약(`site-life-location.js`)이 위치를 정한다. `LIFE_TARGET_RE`에 "전북 … 맛집/음식점/식당/막걸리집"을 추가했다.
  - 권한 UX와 저장 방식은 바꾸지 않았다.
  - "전주 맛집 알려줘"처럼 '근처'가 없는 문장은 이전처럼 위치를 보내지 않는다.
- CTA "롯비에게 물어보기"는 다른 생활정보 폼과 같은 공용 handoff(`onDraft`)를 쓴다.
  - 현재 main에서 `onDraft`는 질문을 입력창에 넣는다.
  - 별도 방의 direct-chat 작업(`feature/life-info-direct-chat-card-compaction-01-site`, 원격 미등록)이 `onDraft`를 즉시 전송(키보드 미호출)으로 바꾼다. 그 작업이 merge되면 이 카테고리도 한 번 탭으로 바로 전송된다.
  - 같은 helper를 중복 구현하지 않았다.

## 카드 (`site-life-regional.js`)

### 음식점 (`regional_food_result`, `CORE-REGIONAL-FOOD-RESULT-01`)

- 이미지 영역이 아예 없다(media 요소 0). 한 곳당 다음 줄만 보여준다.
  - 이름
  - 분류·테마
  - 주소(+거리)
  - "등록 영업시간 …"(+휴무), 대표메뉴
  - 값이 있는 줄만 보여준다.
- "등록 영업시간 "으로 시작하는 Core 라벨만 쓴다. "영업 중"·예약·좌석은 보이지 않는다.
- 행동
  - 전화: `tel:`. 번호가 있을 때만 보인다.
  - 지도: 사용자가 설정한 지도앱(`lotbi_default_map_provider_v1` → `buildDefaultMapHref`). 새 창, `rel="noopener noreferrer"`.
  - 지도 좌표는 Core가 NAVER geocoding으로 확인한 경우에만 쓴다. 그 외에는 이름과 주소로 검색해 연다.
- 출처 줄: "출처: 전북특별자치도 전주시 공공데이터 「…」"(data.go.kr 링크)와 "공식 등록정보 기준이며 실제 운영은 방문 전 확인해 주세요."를 붙인다.
- 등록 수가 보여준 5곳보다 많으면 범위를 좁혀 다시 물어보라고 안내한다.

### 행정기관 연락처 (`regional_contact_result`, `CORE-REGIONAL-CONTACT-RESULT-01`)

- 대표·직통은 `tel:` 버튼이고, 팩스는 글자로만 보여준다.
- 휴대전화 번호는 보이지 않는다. `public_contact_only:true`가 아니면 카드를 만들지 않는다.
- 출처 줄에 자료 기준일을 붙인다(2017-10-31 / 2025-05-15).

### 병원 카드 — 전북 의료기관 등록정보

- `medical_registry`(source `JEONBUK_MEDICAL_REGISTRY`, `hours_provided:false`)를 정규화한다(`site-navigation.js`). 상태 줄은 `site-life-medical.js`가 만든다.
  - "전북 의료기관 등록정보 · 의원 · 소아청소년과"
  - 등록정보만 있으면 "진료시간 정보 없음 · 방문 전 전화로 확인해 주세요"
  - 등록정보상 폐업·휴업이면 그 사실과 "방문 전 전화로 확인"
- "진료 중" 줄은 계속 국립중앙의료원 등록 시간(`NMC_REGISTERED_HOURS`)에서만 나온다.

결과 메타는 저장했다가 새로고침 때 다시 정규화한다. 대상은 `compactRegionalFoodMeta`, `compactRegionalContactMeta`, `medical_registry`다.

## 테마

- 카드 테두리와 행동 버튼은 light, dark, system dark 모두에 맞춘다.
- 글자색은 `--lotbi-text-*` 토큰을 쓴다.

## 검증

- `scripts/validate_jeonbuk_real_world_pilot_01.mjs`를 `site-review.yml`에 등록했다. 11건이다.
- 로직 6건
  - 정규화·저장 왕복
  - 위험 값 제거
  - 지도앱 3종 링크
  - 연락처 공개번호
  - 등록정보 줄
  - 질문 문장·위치 의도
- 실제 Chrome 5건(`index.html` 대화 화면 + 게스트 Core mock, 360/375/390/412px 모바일 + 1280 데스크톱)
  - 가로 넘침 없음, media 요소 0
  - 버튼 44px 이상이고 카드 안에 들어감
  - 사용자 지도앱 링크, dark 테마 적용
  - 연락처 팩스는 글자이고 휴대전화 번호는 없음
  - 등록정보 카드에 "진료 중" 없음
  - 생활정보 6개·5개 모두 빈칸 없음
  - 전북 맛집 칩이 패널 안에 들어가고, 질문 handoff가 동작함
- 기존 validator 2개를 6개 바로가기 기준으로 고쳤다: `validate_consumer_sections_02`, `validate_life_medical_category_entry_01`.
- asset token은 최종 tree 기준으로 다시 만들었다(`--check` PASS).

## 배포 순서

Core(`feature/jeonbuk-real-world-pilot-01-core`) → Site.

- Core가 옛 버전이거나 전북 source가 꺼져 있으면, 바로가기의 질문은 기존 답변(Place 등)으로 간다. 카드 코드는 쓰이지 않을 뿐이고 깨지지 않는다.
