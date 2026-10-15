# LOTBI LIFE PUBLIC DATA PACK 01 — FEATURE B NEIS 급식·학사·시간표 HANDOFF

작성: 2026-10-06 (KST) · 상태: READY_FOR_DEPLOY (Production 배포 안 함)

## 1. 범위

| 항목 | 내용 |
|---|---|
| Core branch | `feature/life-neis-school-01` (Ncloud lotbi-core), base main `de1e1416` |
| Site branch | `feature/life-neis-school-01` (Ncloud lotbi-site), base main `d66cfa26` |
| 공통 commit | 없음 (동물병원·의료와 독립) |

## 2. Provider — 교육정보 개방 포털 NEIS Open API (`https://open.neis.go.kr/hub`)

| 서비스 | 용도 |
|---|---|
| `schoolInfo` | 학교 검색(교육청 코드·학교 코드·학교명·학교급·지역·주소) |
| `mealServiceDietInfo` | 급식(날짜·식사 구분·메뉴·알레르기·열량·영양) |
| `SchoolSchedule` | 학사일정(날짜·행사명·내용·수업공제일 구분·학년) |
| `elsTimetable`/`misTimetable`/`hisTimetable`/`spsTimetable` | 학교급에 맞는 시간표 |

- 오류 매핑: INFO-200 = 데이터 없음(빈 결과), ERROR-290 키 오류, ERROR-337 한도 등.
- timeout 4s + 재시도 1회.
- cache: 학교 24h, 급식 6h, 학사 12h, 시간표 6h. 실패 negative cache 20s.
- 로그는 서비스·결과·건수·keyless 여부만 남긴다.
- 키 없이도 동작하지만 NEIS 샘플 모드(요청당 5건, 페이지 무시)다. 긴 기간은 주/일 단위로 나눠 읽고, 그래도 잘리면 "일부만 확인됨"을 밝힌다. `NEIS_API_KEY` 가 있으면 200건 단위로 읽는다.

## 3. 동작

- 질문 예: "오늘 급식 뭐야?", "내일 급식 알려줘", "이번주 급식 보여줘", "10월 9일 급식", "내일 학교 뭐 있어?", "이번주 학교 일정 알려줘", "방학 언제야?", "학교 쉬는 날 언제야?", "시험 언제야?", "3학년 2반 시간표".
- 학교 선택:
  - 학교 이름이 들어오면 후보 카드가 나온다. 하나를 고르면 기존 대화 설정 저장 구조 `lotbi.site.ux.v1.life-school.<namespace>` 에 저장되고, 원래 질문을 다시 묻는다.
  - 저장 값: 교육청 코드·학교 코드·학교명·학교급, 그리고 사용자가 말한 경우에만 학년·반.
  - 학생 이름 등은 받지도 저장하지도 않는다(Core 스키마가 거부하고, Site 는 버린다).
  - 학교가 없으면 "어느 학교인지" 되묻는다. 우리가 물었을 때만 이름만 있는 답을 학교 선택으로 받는다.
- `client_context.school` 은 학교 관련 질문에만 실린다. 다른 요청 body 는 그대로다.
- 급식·일정이 없는 날은 "NEIS에 없어요"라고 말하고 아무것도 만들지 않는다. 주말·휴업일도 마찬가지다.
- Calendar:
  - 학사일정 항목마다 `calendar_draft` 를 둔다. "캘린더에 추가" 버튼은 기존 Calendar 편집기를 초안(제목·날짜)으로 **열기만** 한다.
  - 자동 저장은 없다. 실제 화면에서 편집기만 열리고 저장소가 비어 있음을 확인했다.
- 시간표: 학년·반이 없으면 그것만 묻는다. "3학년 2반 시간표"처럼 말하면 학년·반을 저장한다.

## 4. 환경변수 (Core, Render `lotbi-core-prod`) — 값은 기록하지 않음

```
ENV_REQUIRED=yes (기능을 켜려면)
ENV_NAME=NEIS_OPEN_API_ENABLED   # true 로 켬 (기본 false)
ENV_NAME=NEIS_API_KEY            # 권장. 없으면 5건 샘플 모드(일부만 확인 표시)
ENV_NAME=NEIS_API_KEY_FILE       # 선택
SOURCE=https://open.neis.go.kr 회원가입 후 인증키 신청 (즉시 발급)
```

## 5. 배포 순서

Core 먼저(client_context.school 스키마) → Site → `NEIS_OPEN_API_ENABLED=true` (+ `NEIS_API_KEY`).

## 6. 테스트 / 실제 API 증거

- Core: `tests/test_life_neis_school_01.py`(33). fixture 는 2026-10-06 실제 NEIS 응답 원본이다. `tests/test_life_neis_live_01.py`(opt-in).
- Site: `scripts/validate_life_neis_school_01.mjs` (CI 등록).
- **실 API PASS** (키 없는 샘플 모드, `LOTBI_LIVE_PUBLIC_DATA=1`):
  - 전주서원초등학교(P10/8332169) 검색, 10/1~2 급식(알레르기·열량), 10월 학사일정 13건(창 분할로 잘림 없음), 3학년 1반 시간표(els), 가락고(B10) 1학년 1반 시간표(his), 일요일 급식 없음, 대화 응답 생성.
- 실제 화면(내장 브라우저): 후보 선택 → 저장 → 재질문에 학교 문맥 포함. 급식 카드(실데이터), 학사일정 카드 → "캘린더에 추가" → 편집기만 열림.

## 7. 남은 것

- NEIS_API_KEY 발급·설정(샘플 모드 5건 한계 제거).
- NOT VERIFIED: 운영 E2E, Android/iOS Native, iPhone Safari 실기기. 학교 선택은 브라우저(namespace) 단위 저장이라 기기 간 동기화는 하지 않는다.
