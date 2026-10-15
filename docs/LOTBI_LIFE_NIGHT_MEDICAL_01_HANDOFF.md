# LOTBI LIFE PUBLIC DATA PACK 01 — FEATURE C 야간 병원·약국·응급실 HANDOFF

작성: 2026-10-06 (KST) · 상태: READY_FOR_DEPLOY (Production 배포 안 함)

## 1. 범위

| 항목 | 내용 |
|---|---|
| Core branch | `feature/life-night-medical-01` (Ncloud lotbi-core) |
| Site branch | `feature/life-night-medical-01` (Ncloud lotbi-site) |
| Core base | main `de1e1416` |
| Site base | main `26439e45` → 최신 main `d66cfa26` 정상 merge 완료 |
| 공통 commit | Core `7487ab0e`, `15852f6f` · Site `635b3b5b` — 동물병원 branch와 같은 SHA 공유 |

## 2. Provider (국립중앙의료원 B552657, data.go.kr) — 3개 별도 서비스

| 서비스 | 오퍼레이션 |
|---|---|
| 전국 병·의원 찾기 `HsptlAsembySearchService` | `getHsptlMdcncListInfoInqire`(Q0,Q1,QT,QD,QZ,QN), `getHsptlMdcncLcinfoInqire`(위치), `getBabyListInfoInqire`(달빛어린이병원) |
| 전국 약국 정보 `ErmctInsttInfoInqireService` | `getParmacyListInfoInqire`(Q0,Q1,QT,QN), `getParmacyLcinfoInqire`(위치) |
| 전국 응급의료기관 정보 `ErmctInfoInqireService` | `getEgytListInfoInqire`, `getEgytLcinfoInqire`, `getEmrrmRltmUsefulSckbdInfoInqire`(실시간 병상), `getSrsillDissAceptncPosblInfoInqire`(중증질환 수용가능), `getEmrrmSrsillDissMsgInqire`(병원 공지) |

- XML/JSON 파싱, 게이트웨이 오류 매핑(401/`OpenAPI_ServiceResponse` → `NMC_ACCESS_DENIED` 등, 실제 응답 fixture).
- timeout 4s + 재시도 1회(타임아웃·5xx).
- 목록 cache 30분, 실시간 cache 60초, 실패 negative cache 20초.
- 로그는 operation·결과·건수·시간만 남긴다(좌표·키 없음).
- 진료과목 코드 D001~D058 은 e-gen.or.kr 공식 검색 화면 선택값에서 읽음.

## 3. 동작

- "지금 문 연 약국", "오늘 밤 약국", "일요일 약국", "공휴일 약국", "오늘 밤 소아과 있어?", "지금 문 연 병원", "일요일 진료하는 병원", "야간 이비인후과", "달빛어린이병원", "근처 응급실", "지금 갈 수 있는 응급실".
- 시간: 현재 KST 시각·요일. 공휴일은 Core 의 2026 공휴일 스냅샷으로 판정하고, 공휴일이면 공식 `dutyTime8`(공휴일) 시간을 쓴다. 공휴일 자료가 없는 해는 요일 기준이라고 밝힌다.
  - 야간 = 20시 이후 진료 중. 자정을 넘기는 시간(18:00~02:00)과 전날 야간 연장도 처리.
- 등록 진료시간이 없는 날은 "정보 없음"이지 열림/닫힘이 아니다. 지금 문 연 곳 필터는 등록 시간으로 확인된 곳만 남긴다.
- 위치: 말한 지역 > 현재 위치(→ 가까운 공식 기관 주소로 시·군·구 결정, 거리순 정렬) > 저장 지역 > 되묻기. 시·도 옛 이름 재시도(전북특별자치도→전라북도), 최대 3회.
- 응급실: 가까운 응급의료기관, 실시간 병상(응급실·수술실·일반/신경/신생아/흉부/내과/외과 중환자실·입원실), 장비, 중증질환 수용가능 보고, 병원 공지.
  - 병상 보고가 30분(설정값)보다 오래되면 STALE → 숫자를 쓰지 않는다.
  - "수용 보장" 문구는 없다. 모든 응급 답변 맨 앞에 119 안내가 붙고, 화면에 "119 전화" 버튼(tel:119)이 나온다.
  - 응급 증상 단어가 있으면 병원·약국 답변에도 119 안내를 붙인다. 진단·치료 판단은 하지 않는다.
- 카드: 기존 Place Card(CORE-PLACE-RESULT-01) 재사용. 공식 전화번호는 검증 전화, NMC 공식 WGS84 좌표는 길찾기 좌표(`NMC_OFFICIAL`).
  - 상태 줄 예: "등록 시간상 운영 중 · 오늘 09:00~23:00", "응급실 가용 병상 4 · 10/07 22:15 보고", "실시간 병상 정보 오래됨(10/07 18:00)".
- Provider 미설정 시: 병원·약국 요청은 기존 Place 경로로 넘어간다(동작 불변). 응급실 요청은 119 안내 + 응급의료포털 안내로 답한다.
- 핸들러 예외가 나도 Chat 전체가 실패하지 않는다(fail-soft, 테스트 있음).

## 4. 환경변수 (Core, Render `lotbi-core-prod`) — 값은 기록하지 않음

```
ENV_REQUIRED=yes (기능을 켜려면)
ENV_NAME=NMC_MEDICAL_ENABLED                 # true 로 켬 (기본 false)
ENV_NAME=NMC_SERVICE_KEY                     # 선택. 비우면 기존 data.go.kr 키(KMA_SERVICE_KEY 우선) 재사용
ENV_NAME=NMC_SERVICE_KEY_FILE                # 선택
ENV_NAME=NMC_REALTIME_STALE_AFTER_SECONDS    # 선택 (기본 1800)
ENV_NAME=NAVER_MAPS_REVERSE_GEOCODE_ENABLED  # 선택 (동물병원과 공통)
SOURCE=data.go.kr 「국립중앙의료원_전국 병·의원 찾기 서비스」(15000736), 「…_전국 약국 정보 조회 서비스」(15000576), 「…_전국 응급의료기관 정보 조회 서비스」(15000563) 활용신청(자동승인) — 운영 KMA 키의 계정에서. 개발계정 트래픽 1,000/일 → 운영 전 운영계정 트래픽 증설 신청 권장
```

## 5. 배포 순서

Core 먼저 → Site → 활용신청 → `NMC_MEDICAL_ENABLED=true` → `LOTBI_LIVE_PUBLIC_DATA=1 pytest tests/test_life_night_medical_live_01.py`.

## 6. 테스트

- Core: `tests/test_life_night_medical_01.py`(38: 분류·시간·공휴일·야간 연장·약국/병원/응급 흐름·STALE·실패·HTTP 경로·크래시 fail-soft), `tests/test_life_night_medical_live_01.py`(opt-in).
- Site: `scripts/validate_life_night_medical_01.mjs` (CI 등록).
- 실 API: 이 개발환경에 data.go.kr 키 없음 → `REAL_API_BLOCKED_BY_CREDENTIAL`. 8개 오퍼레이션 키 없는 호출 = 모두 HTTP 401 `SERVICE_KEY_IS_NULL`(실측, endpoint 존재 확인).
- 실제 화면(내장 브라우저, 로컬 + 합친 Core payload): 약국 카드 상태 줄, 응급실 FRESH/STALE 줄, 병원 공지, tel:119 확인. 실기기 아님.

## 7. 남은 것

- REAL_API_BLOCKED_BY_CREDENTIAL: NMC 3개 API 활용신청 + 운영 실호출 확인. 시군구 Q1 표기(예: "전주시" vs "전주시 완산구")는 실데이터로 재확인 필요 — 코드는 2단계까지 넓혀 재시도한다.
- NOT VERIFIED: 운영 E2E, Android/iOS Native, iPhone Safari 실기기.
