READY_FOR_DEPLOY=YES
TASK=VALIDATOR-TAP-STABILITY-01 (배포총괄방 요청 — SITE-T54 gate에서 걸린 검사기 3개의 흔들림·불일치 정비, 검사기 파일만)
SCOPE=scripts/validate_regional_info_back_navigation_01.mjs · scripts/validate_subview_back_navigation_01.mjs · scripts/validate_subway_life_info_p0_01.mjs 와 이 문서. 제품 코드(site-*.js·css·html) 변경 없음, asset 토큰 변경 없음.
BASE=release/20261010-site-t54-work c63d3937cf8bd1a33c7a78fbb0980fc67c1adf5a (배포총괄방 지시로 이 SHA 위에 올림 — main은 afb7057d, T54 미반영)
DEPLOY_ORDER=없음(검사기만). T54에 merge해 gate하면 된다. 운영 코드·Core·DB 변화 없음.
USER_DECISION_NEEDED=없음. (참고로 아래 '링크 위치'는 소유자 결정 사항 — 이 branch에서 바꾸지 않았다.)

# VALIDATOR-TAP-STABILITY-01 — T54 gate의 검사기 3개

REPO=lotbi-site
FEATURE_BRANCH=feature/validator-tap-stability-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD). `git ls-remote`로 확인.
OWNER=개발 · 부동산 실거래가 P0 방(배포총괄방 지정). 같은 일을 맡은 다른 branch 없음.

## 1. validate_regional_info_back_navigation_01 — 공개 조회 링크 탭이 가끔 빗나감 (T54 3차 gate 실패)

- 증상: `timeout: samsung-360x780: the public lookup opens → #life-education`, 상태는 `#life-my-child`에 머묾.
- 원인(실측): 내 아이 학교·유치원 화면이 다시 열리면 '로그인 없이 학교·유치원 찾기' 링크가 y=159에 있다가, 화면 내용 모듈(로그인 안내)이 붙는 약 16ms 안에 y=334로 **175px 내려간다**. 검사기는 위치를 잰 뒤 30ms 뒤에 손을 떼서, 느린 컴퓨터에서는 탭이 로그인 안내 위에 떨어진다.
- 고침: `tapSelector`에 opt-in `settle`(중심 좌표가 100ms 간격 3번 같을 때만 탭) + 공개 조회 링크는 로그인 안내(`[data-my-child-state="LOGIN_REQUIRED"]`)가 그려진 뒤 누르고 열림 대기 30초. 단정은 하나도 줄이지 않음. 모든 탭에 넣으면 검사기가 100초→188초라 비동기로 그려지는 탭에만 씀.
- 재현·확인: 단독·2코어 제한으로는 재현 안 됨(5/5 PASS). **Chrome CPU를 8배 늦춘 조건**(`Emulation.setCPUThrottlingRate`)에서 gate와 같은 메시지로 **고치기 전 6/6 실패 → 고친 뒤 6/6 통과**.

## 2. validate_subview_back_navigation_01 — T54에서 이미 실패 (제 검사기의 잘못된 흉내 데이터)

- 증상: `timeout: samsung-360x780: tap target .festival-card-action-program — last=null` (c63d3937에서 고치기 전 코드로 재현).
- 원인: 축제 프로그램 흉내 데이터에 실제 Core 계약에 없는 필드(`title`·`program_date`)를 썼다. T54의 축제 카드는 상세를 읽어 프로그램이 있는 카드에만 [프로그램]을 붙이는데(site-festival-ui.js addCardPrimaryActions), 그 필드는 프로그램 0개로 정규화된다. 예전 UI는 버튼을 항상 보여 줘서 통과했다.
- 고침: 실제 필드(`program_name`·`start_date`·`venue`·`reservation_url`, site-festival-client.js normalizeFestivalProgram)로 바꾸고, 접수 링크가 있는 프로그램도 하나 넣어 [접수] 층 확인이 실제로 돌게 함(예전엔 버튼이 없어 조건부로 건너뜀). 같은 `settle`을 축제 카드 버튼·캘린더 날짜·'+ 기록' 탭에 사용.

## 3. validate_subway_life_info_p0_01 — 일요일·평일에 실패 (배포총괄방 지적: 새벽 실패)

- 증상: `'23.5%' !== '35.5%'` (토요일 08:00 외선 값). 고치기 전 c63d3937에서도 같음.
- **원인은 시각이 아니라 요일**(정정): 지하철 화면은 오늘 요일로 평균 혼잡도의 기본 요일을 고른다(`kstDayType`). 요일 칩을 누르면 `loadAverage()`가 '평균 혼잡도를 불러오는 중…'을 보이고 **응답이 올 때까지 이전 요일의 막대를 그대로 둔다**. 검사기는 '토요일 요청이 나갔고 칩이 눌렸다'만 보고 넘어가 08:00을 읽어, 응답이 그려지기 전의 값을 읽는다. 토요일(검사기를 쓴 10-10)에는 이미 토요일이 기본이라 요청이 없어 통과했다. 일요일(10-11)·평일에는 같은 경합이 실제로 터진다. 어제 저녁까지 통과한 것도 이 때문(토요일이었음).
- 고침: 토요일 대기 조건에 '평균 혼잡도를 불러오는 중이 아님'을 더했다. 단정(`토요일 08:00 외선 = FIXTURE 값`)은 그대로. **시계를 고정하지 않은 이유**: 고정하면 경합은 그대로 두고 기본 요일이 토요일일 때만 우연히 통과시키는 것이라(토요일에는 요청이 없음) 그 경합을 가린다. 응답을 기다리는 쪽이 요일과 무관하게 맞다.
- 확인: 오늘(일요일 01시대) 110개 검사 전부 PASS. 시계를 평일(월 14:00 KST)·토요일·일요일로 옮겨 고치기 전·후 비교 — 아래 결과.

## 검증

검사기 파일만 바뀜을 확인: `git diff --name-only c63d3937..HEAD` = 위 검사기 3개 + 이 문서뿐(site-*.js·css·html·fixture 변경 0, asset 토큰 변경 0).

- **validate_regional_info_back_navigation_01**: CPU 8배 제한(공개 조회 링크 단계) 고치기 전 6/6 실패 → 후 6/6 통과. 전체 범위(3개 화면 크기) 통과(실제 시계 2회 + 최종 1회). 2코어 제한 5/5 통과.
- **validate_subview_back_navigation_01**: T54(c63d3937)에서 고치기 전 실패 → 후 통과(전체 범위 4회 연속). [접수] 층(휴대폰)·[프로그램] 층·캘린더 설정·날짜 시트·편집 창 모두 확인.
- **validate_subway_life_info_p0_01**: 오늘(일요일 01시대) 고치기 전 실패 → 후 110개 검사 전부 통과(2회). 페이지 시계를 옮겨 요일별로 확인(위치 정보 시각도 같이 옮김): **평일 월·화 고친 뒤 통과**(고치기 전 월요일은 `'99.7%' !== '35.5%'`로 실패 — 같은 경합, 이전 평일 막대를 읽음), **토요일은 고치기 전·후 모두 통과**(토요일은 기본이 토요일이라 요청이 없어 경합이 없음).
  - 평일에서 한 곳 더 드러남: 요일이 달라도 실시간 상태 문구가 뜨는 순간 평균 혼잡도 요청이 아직 안 끝나 막대가 0개(`the past average still shows` 0 !== 2). 같은 경합이라 같은 방식(평균 '불러오는 중'이 아님을 기다린 뒤 읽기, 막대 개수를 기다리지는 않음 — 그러면 단정이 참이 되어 버림)으로 고침.
- 관련 검사기 42개를 T54 코드 + 첫 수정 위에서 돌려 41개 PASS, 실패 1개가 위 지하철(이후 고침). 이후 바뀐 건 지하철 검사기뿐이라 나머지는 다시 돌리지 않았고, 위 3개는 최종 코드로 다시 돌렸다.

시계 고정 대신 응답을 기다린 이유(배포총괄방 요청은 '기대 시간대를 고정 시계로'): 이 실패는 시각이 아니라 요일과 응답 경합이다. 기본 요일을 토요일로 고정하면 그 단계는 토요일에는 요청 자체가 없어 우연히 통과하지만, 경합은 그대로 남아 있고 평일에 실제로 터진다. 위 평일 확인이 그 증거다.

## 하지 않은 것

- **링크 위치**: 공개 조회 링크가 로그인 안내 아래에 있어 화면이 막 열릴 때 실제 사용자도 같은 이동을 겪을 수 있다. 로그인 안내 위(제목 바로 아래)로 올리면 사라지지만 화면 설계 변경이라 소유자 결정 사항 — 배포총괄방이 아침 보고에 올림. 이 branch는 바꾸지 않았다.
- 캘린더 두 버튼 검사기(validate_calendar_day_panel_two_buttons_01)의 부하 흔들림은 별도(고정 포트 4207 + 배경 다시 그리기 뒤 포커스 이동) — 이 branch 범위 밖.

NOT_VERIFIED=실기기. 이 branch는 검사기만 바꾼다.
PRODUCTION/DB/SECRET/LIVE_MONEY/PAID_INFRA=변경 없음
NEXT_OWNER=배포총괄방
