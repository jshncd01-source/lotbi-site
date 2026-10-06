# LOTBI LIFE PUBLIC DATA PACK 01 — FEATURE A 동물병원 HANDOFF

작성: 2026-10-06 (KST) · 상태: READY_FOR_DEPLOY (Production 배포 안 함)

## 1. 범위

| 항목 | 내용 |
|---|---|
| Core branch | `feature/life-animal-hospital-01` (Ncloud lotbi-core) |
| Site branch | `feature/life-animal-hospital-01` (Ncloud lotbi-site) |
| Core base | main `de1e1416` |
| Site base | main `26439e45` → 최신 main `d66cfa26` 정상 merge 완료 |
| 공통 commit | Core `7487ab0e`(위치 문맥), `15852f6f`(기존 data.go.kr 키 재사용) · Site `635b3b5b`(위치 문맥) — 야간 의료 branch와 **같은 SHA**로 공유, 먼저 merge되는 쪽이 가져가고 나머지는 그대로 merge됨 |

## 2. 동작

1. "전주 동물병원", "근처 동물병원 찾아줘", "롯비야 근처 동물병원 찾아줘", "전주 24시 동물병원"
   - `ANIMAL_HOSPITAL` Place 카테고리 (기존에는 "동물병원"이 업체명으로 오인돼 지역이 버려졌음).
   - 다른 카테고리·검색어·NAVER 결과 순서는 바뀌지 않음.
2. 위치: 사용자가 말한 지역 > 현재 위치(권한 허용 + 위치 사용 ON) > 저장 지역(캘린더 날씨 지역) > 지역을 되물음.
   - Site 는 "근처/지금 + 동물병원·병원·약국·응급실" 요청에만 `client_context.location` 을 싣는다(소수 셋째 자리).
   - Core 는 NAVER Reverse Geocoding(옵션) → 실패 시 날씨 도시 카탈로그로 시·군·구를 정하고, NAVER 검색어의 scope hint 로만 쓴다.
   - 좌표는 로그·DB·응답·intent 어디에도 남기지 않는다.
3. 공식 등록 검증: 행정안전부_동물_동물병원 조회서비스(LOCALDATA 후속, `apis.data.go.kr/1741000/animal_hospitals/info`).
   - 상호(정규화, 접두어 포함 허용) + 도로명주소(시·도로명·건물번호) 대조.
   - `official_registered=true` 는 영업/정상 레코드와 일치할 때만. 그 외(NOT_FOUND/INACTIVE/AMBIGUOUS/CONFLICTING/UNAVAILABLE)는 `UNVERIFIED`.
   - 게이트웨이 거부(SERVICE_KEY_IS_NULL 등)는 UNAVAILABLE 이지 "등록 없음"이 아니다(실제 응답 fixture 로 테스트).
4. 카드: 기존 Place Card 그대로. 주소 아래 한 줄 — "공식 등록 동물병원" / "등록 상태 확인 필요" / "공식 등록 확인 안 됨" + 거리(현재 위치일 때만).
   - 액션은 전화 + 기본 지도앱 두 개 그대로.
   - 일치한 등록 레코드의 전화번호만 검증 전화로 쓴다.
5. 영업 여부: LOTBI 가 판단하지 않음. 답변 문구가 "길찾기 → 지도앱의 최신 영업·휴무 안내"로 넘긴다. 카드에 영업 중/종료 문구 없음.
6. Pet SOS: 발견 제보 대화 답변에 "근처 동물병원 찾기" 버튼 → "근처 동물병원 찾아줘" 전송. Pet SOS / Pet Re-ID 코드는 수정하지 않음.
7. KAWIS(국가동물보호정보시스템): 공개 API 는 동물등록·보호센터·구조동물 조회뿐이고 동물병원 기계 조회 경로가 없음 → 추가 검증원으로 쓰지 않음(확인 불가가 아니라 **경로 없음**).

## 3. 환경변수 (Core, Render `lotbi-core-prod`) — 값은 기록하지 않음

```
ENV_REQUIRED=yes (기능을 켜려면)
ENV_NAME=MOIS_ANIMAL_HOSPITAL_ENABLED            # true 로 켬 (기본 false)
ENV_NAME=MOIS_ANIMAL_HOSPITAL_SERVICE_KEY        # 선택. 비우면 기존 data.go.kr 키(KMA_SERVICE_KEY 우선) 재사용
ENV_NAME=MOIS_ANIMAL_HOSPITAL_SERVICE_KEY_FILE   # 선택
ENV_NAME=NAVER_MAPS_REVERSE_GEOCODE_ENABLED      # 선택. NCP Maps 앱에 Reverse Geocoding 활성화 후 true
SOURCE=data.go.kr 「행정안전부_동물_동물병원 조회서비스」(15154952) 활용신청(자동승인) — 운영 KMA 키의 계정에서
SOURCE=NCP 콘솔 Maps Application → Reverse Geocoding 사용 설정(선택)
```

키를 넣지 않고 배포하면: 동물병원 검색은 동작하고 모든 결과가 "공식 등록 확인 안 됨"으로 표시된다(지어내지 않음).

## 4. 배포 순서

1. Core 먼저 (client_context.location 스키마). Site 를 먼저 올리면 위치가 실린 생활 요청이 422 가 된다.
2. Site.
3. 운영 키 활용신청 후 `MOIS_ANIMAL_HOSPITAL_ENABLED=true`.
4. 실 API 확인: `LOTBI_LIVE_PUBLIC_DATA=1 pytest tests/test_life_animal_hospital_live_01.py` (키가 있는 환경).

## 5. 테스트

- Core: `tests/test_life_location_context_01.py`, `tests/test_life_animal_hospital_01.py`(25), `tests/test_life_animal_hospital_live_01.py`(opt-in).
- Site: `scripts/validate_life_location_context_01.mjs`, `scripts/validate_life_animal_hospital_01.mjs` (CI `site-review.yml` 등록).
- 실 API: 행정안전부 API — 이 개발환경에 data.go.kr 키 없음 → `REAL_API_BLOCKED_BY_CREDENTIAL`. 키 없는 호출은 HTTP 401 `SERVICE_KEY_IS_NULL`(실측)로 endpoint 존재·응답 형식 확인.
- 실제 화면(내장 브라우저, 로컬 서버 + 합친 Core payload): 카드·"공식 등록 동물병원"·거리·전화(tel)·NAVER 지도·Pet SOS 버튼 확인. 사용자 좌표가 브라우저 저장소에 남지 않음 확인. 이는 실기기·운영 E2E 가 아님.

## 6. 남은 것

- REAL_API_BLOCKED_BY_CREDENTIAL: 행정안전부 동물병원 API 활용신청 + 운영 실호출 확인.
- NOT VERIFIED: 운영 E2E, Android/iOS Native, iPhone Safari 실기기.
