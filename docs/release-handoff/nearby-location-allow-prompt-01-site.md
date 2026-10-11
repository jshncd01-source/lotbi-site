READY_FOR_DEPLOY=YES
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
DEPLOY_ORDER=SITE 단독 (Core 무변경: follow_up.reason=LOCATION_REQUIRED는 CORE-T44로 이미 운영 중)
USER_DECISION_NEEDED=NONE (아래 "판단한 것" 2건은 배포 차단 아님)

# NEARBY-LOCATION-ALLOW-PROMPT-01 — 위치 허용 공통 부품 + 대화 답 + PC 대응 (Site 01)

TASK=NEARBY-LOCATION-ALLOW-PROMPT-01 (소유자 요청 2026-10-11 08:3x, 배포총괄방 전달, 추가 1·2·범위 정리 반영)
REPO=lotbi-site
FEATURE_BRANCH=feature/nearby-location-allow-prompt-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD). `git ls-remote origin refs/heads/feature/nearby-location-allow-prompt-01-site`로 확인한다.
CODE_SHA=d5bfe8296a3c01b98a2b6fc1c8d10bd0e2061b0d
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=68b3161e695d926a4c2fc7e53d315fcb958756ac (SITE-T55, 1851a70e 포함). 착수는 7c4f0944 + 1851a70e 미리 병합이었다. T55가 운영된 뒤 main을 병합했다(facd216f). 실제 충돌은 3파일(site-conversation.js·site-life-location.js·site-region-picker.js)이었고 손으로 합쳤다. 나머지 79개는 토큰뿐이었다.
MAIN_PRESERVATION=main 대비 바뀐 내용은 아래 "바뀐 파일"뿐이다. 이 branch가 토큰만 바꾼 파일은 main 쪽을 그대로 썼다. 01 고유 변경은 병합 전후 토큰 무시 diff로 같은지 대조했다.
ASSET_VERSION=aset-e44fd9da283f
INCLUDES=없음(1851a70e는 main T55에 들어감). 이 일은 그 #7 버튼을 넓힌 것이다.
NEXT=READY 02 (지역정보의 다른 위치 화면에 같은 부품 적용 + 화면별 표), 이후 App READY.

## 소유자 지적

- 위치 사용을 끈 상태로 "근처 내과 찾아줘"를 물었다. 답은 "어느 지역에서 찾을까요? …위치 사용을 허용해 주세요." 글만 나왔다.
- 소유자 요청
  - "사이트에서도 허용으로 버튼 팝업 뜨게 해줘"
  - "그 기능을 PC에서는 활용 못 하는 상황이네"(PC는 GPS가 없고, 위치를 받아도 오차가 크다)

## 바뀐 것

### 1) 공통 부품 `site-location-allow.js` (새 파일)

모든 위치 화면이 쓸 규칙은 하나다.

- **[위치 허용하고 찾기]**: 누르면 LOTBI 위치 사용을 켠다 → 브라우저 위치 팝업이 뜬다 → 허용되면 하려던 일을 위치와 함께 바로 다시 한다(다시 칠 필요 없음).
  - LOTBI 위치 사용이 이미 켜져 있으면 글자는 [현재 위치로 찾기]다.
- **브라우저가 이미 차단한 상태**: 팝업이 안 뜨므로 묻지 않는다. "이 브라우저가 위치를 막아 두었어요. 주소창 왼쪽 자물쇠 아이콘 → 위치 → 허용으로 바꾼 뒤 다시 눌러 주세요." 한 줄을 보이고, 다음 행동으로 [지역 고르기]에 포커스를 둔다.
- **팝업에서 거부**: "위치를 허용하지 않았어요. 지역을 골라 주세요." 한 줄을 보이고, 지역 목록을 바로 연다.
- **허용했지만 위치를 못 받음**(POSITION_UNAVAILABLE)
  - Windows: "위치를 받지 못했어요. Windows 설정 → 개인 정보 및 보안 → 위치에서 위치 서비스를 켜거나, 지역을 골라 주세요."
  - Mac: 시스템 설정 → 개인정보 보호 및 보안 → 위치 서비스 안내.
  - 휴대폰·기타: "기기의 위치 서비스를 켜거나 지역을 골라 주세요."
- **시간 초과·위치 미지원·설정 실패**: 각각 한 줄과 [지역 고르기]. 막다른 화면이 없다.
- **[지역 고르기] = 칩**(배포총괄방 요청, T55 운영 화면 확인 뒤)
  - T55는 드롭다운 2개(시·도/시·군) + [이 지역으로 찾기]였고, 결과까지 5~6번 조작해야 했다.
  - 이제는 **시·도 칩 → 시·군 칩을 누르면 바로 찾는다.** 확인 단계가 없다. 시·군이 하나인 세종은 시·도 칩에서 바로 찾는다.
  - 저장된 지역이 있으면 맨 위에 [<지역>에서 찾기] 칩 하나가 있다.
  - 지역뉴스 칩(REGIONAL-NEWS-CITY-SELECT-01)과 같은 방식이고, 목록은 Core 공개 날씨 지역 목록(캘린더와 같음)이다.
- **저장된 지역이 있으면 [<지역>에서 찾기]** 칩을 하나 더 둔다. 한 번 누르면 바로 찾는다.
- 버튼은 48px 이상이다(USER_FIRST_STANDARD 6). [위치 허용]과 [지역 고르기]는 같은 크기·같은 줄·같은 모양이다.

### 2) PC(넓은 화면·마우스) 대응

- [지역 고르기]를 [위치 허용] 옆에 같은 무게로 둔다(위 규칙이 모든 화면 크기에 같다).
- **PC에서 고른 지역은 저장한다.**
  - 캘린더가 자기 수동 지역을 저장하는 방식 그대로다: `lotbi.calendar.weather-region.v1`에 목록 이름과 목록 좌표를 쓰고, 출처는 `MANUAL`이다.
  - 다음부터 대화의 "근처 …" 질문은 PC에서 브라우저에 다시 묻지 않고 이 지역을 쓴다(`site-life-location.js`).
  - 방금 [위치 허용하고 찾기]로 받은 현재 위치(2분 메모리)만 그보다 앞선다.
  - 휴대폰은 전처럼 고른 지역을 한 번만 쓰고 저장하지 않는다.
- **PC 위치 오차가 3km를 넘으면**(네트워크로 짐작한 위치) 바로 찾지 않는다.
  - "PC 위치는 정확하지 않을 수 있어요(오차 약 N km). 이 위치로 찾거나 지역을 골라 주세요." 한 줄과 [이 위치로 찾기] [지역 고르기]를 둔다.
  - 휴대폰은 전처럼 바로 쓴다.

### 3) 대화 답 (1851a70e #7 조정)

- Core가 `follow_up.reason=LOCATION_REQUIRED`로 되물으면 답 아래에 공통 부품이 붙는다. 판별은 구조화 신호로만 한다(문구 매칭 없음, 1851a70e와 같다).
- 전: [현재 위치 사용]은 LOTBI 위치 사용이 켜져 있을 때만 보였다.
- 후: 꺼져 있어도 [위치 허용하고 찾기]가 보이고, 누르면 설정을 켠다.
- 부품은 그런 답이 나올 때만 불러온다(dynamic import, 첫 화면 모듈 묶음 무변경). 새로고침 뒤에도 버튼이 남는다(1851a70e meta).

## 개인정보 원칙 (그대로)

- 버튼을 누르기 전에는 위치를 묻지 않는다. 검사기가 누르기 전 위치 요청 0회를 확인한다.
- 위치는 그 한 번의 질문에만, 소수 셋째 자리(약 100m)로 반올림해 싣는다(기존 규칙). 공통 계층 메모리에 2분 남는 것도 기존과 같다.
- 정밀 좌표는 서버에도 브라우저 저장소에도 저장하지 않는다.
  - 저장하는 것은 사람이 고른 지역(목록 이름 + 그 시·군의 목록 좌표)과 LOTBI 위치 사용 켬/끔 쿠키뿐이다.
  - `site-location-allow.js` 안에는 저장소 API가 없다. 검사기가 이를 확인한다.

## 판단한 것 (배포 차단 아님)

1. 버튼을 누르면 LOTBI 위치 사용을 켠다. 브라우저가 차단해서 위치를 못 받아도 켠 상태는 남는다(사람이 "허용"을 누른 뜻으로 봄). 다시 끄기는 설정에서 한다.
2. PC 위치 오차가 크면 바로 찾지 않고 한 번 더 고르게 했다(탭 +1).
   - 바로 찾으면 안내 줄이 예전 답 아래에 남고 새 결과로 화면이 내려가 안 보였다(실측 화면 확인).
   - 그러면 5km 어긋난 결과를 경고 없이 보게 된다.

## 바뀐 파일

- 새 파일: `site-location-allow.js`, `scripts/validate_nearby_location_allow_prompt_01.mjs`(site-review.yml 추가)
- `site-conversation.js`
  - `createLocationRequestRow`가 공통 부품을 dynamic import로 쓴다.
  - 쓰지 않게 된 import(`lifeCurrentLocationBlocked`, `isLocationUsageEnabled`)를 정리했다.
- `site-life-location.js`: PC에서 직접 고른 지역(MANUAL)을 먼저 쓴다(`pcPrefersPickedRegion`, 주입 가능).
- `site-calendar-weather-region.js`: `saveChosenWeatherRegion`, `readCalendarWeatherRegionOrigin` 추가. 기존 함수는 무변경이다.
- `site-region-picker.js`
  - 드롭다운과 [이 지역으로 찾기] 대신 시·도/시·군 칩이다(위).
  - 고른 항목의 목록 좌표를 함께 넘긴다(`onPick(name, entry)`).
  - 저장 지역은 칩 하나로 둔다(`initialName`).
- `site-conversation.css`
  - 공통 부품 규칙을 더했다(라이트·다크).
  - 대화 위치 칩을 44px에서 48px로 키웠다.
  - 지역 목록 칩을 새로 넣었다(48px, 다크 포함). 쓰지 않게 된 select·submit 규칙은 지웠다.
- asset 토큰 갱신 → aset-e44fd9da283f.

## 바뀐 검사기

- 새 `validate_nearby_location_allow_prompt_01`(360·390·1280, 라이트·다크)
  - 위치 꺼짐 → 허용
    - 누르기 전 위치 요청 0회.
    - 누르면 쿠키 on, 브라우저 1회, 같은 질문 + 반올림 위치(35.812/127.123), 카드 표시.
  - 차단 → 자물쇠 줄, 요청 0회, [지역 고르기] 포커스.
  - 거부 → 거부 줄 + 지역 목록 자동 열림 → 전주시로 1회.
  - 위치 못 받음 → PC는 Windows 위치 줄, 휴대폰은 위치 서비스 줄.
  - PC 오차 5km
    - 줄과 [이 위치로 찾기]·[지역 고르기]가 나오고, 고르기 전에는 전송 0회.
    - 누르면 재전송하고 브라우저 재요청은 없다.
    - 휴대폰은 바로 재전송한다.
  - PC 지역 고르기 → 저장(MANUAL) → 다음 "근처 병원 찾아줘"는 SAVED_REGION 좌표, 브라우저 재요청 없음. 휴대폰은 저장하지 않는다.
  - 저장 지역 칩 → 바로 1회.
  - 모든 버튼 48px 이상, 같은 높이·같은 줄. 입력창 포커스 0. 다크·라이트 대비 4.5 이상.
- `validate_conversation_answer_ux_01`(1851a70e, 새 계약으로 갱신, 단정 완화 없음)
  - 글자: 현재 위치로 찾기 / 위치 허용하고 찾기 / 지역 고르기.
  - 위치 사용 꺼짐도 버튼 2개(전에는 [지역 선택]만).
  - 버튼 높이 44를 48로 올렸다.
  - 차단은 자물쇠 줄을 확인한다.
  - 새로고침 뒤 PC는 저장 지역 칩까지 3개다.
  - dynamic import 대상은 site-location-allow.js이고, region picker는 그 안에서 지연 로드한다.
  - 지역 목록 단정: 시·도 칩·시·군 칩, select 0개, [이 지역으로 찾기] 0개, 칩 48px 이상, 시·군이 여럿이면 시·도 칩 뒤 창이 열려 있음.
  - 대비 단정: 칩 대비. 제목은 '지역 고르기'.

## 사용자 시나리오 (USER_FIRST_STANDARD 8)

증거 폴더: `handoff/nearby-location-allow-prompt-01-evidence/`
- before/main-7c4f0944 = 지금 운영
- before/t55-1851a70e = T55
- after/ = 이 branch

1. **소유자 상황: 휴대폰, 위치 사용 꺼짐 → 근처 약국**
   - 흐름: 생활정보 → 약국(2탭) → "어느 지역에서 찾을까요?" 아래 [위치 허용하고 찾기](1탭) → 브라우저 팝업 "허용"(1탭) → 약국 카드
   - 탭: **4탭**. 다시 칠 필요가 없다.
   - 막힌 곳: 없음.
   - 전: 운영은 글만 있었고, T55는 [지역 선택]뿐이었다(위치를 켤 방법이 화면에 없음).
   - 스크린샷
     - 전: before/main-7c4f0944/390_before-off-where.png, before/t55-1851a70e/390_before-off-where.png
     - 후: after/390_allow-where.png, after/390_allow-after.png
2. **휴대폰, 브라우저가 위치를 막아 둔 상태**
   - 흐름: 약국(2탭) → [위치 허용하고 찾기](1탭) → "주소창 왼쪽 자물쇠 아이콘 → 위치 → 허용…" 한 줄 + [지역 고르기]에 포커스 → [지역 고르기] → 시·도 칩 → 시·군 칩(3탭) → 카드
   - 탭: 6탭(T55 드롭다운이면 7~8탭).
   - 막힌 곳: 브라우저 차단 해제는 사이트가 대신할 수 없다. 대신 해제 방법을 알려 주고, 지역으로 끝까지 갈 수 있다.
   - 스크린샷: after/390_blocked-after.png, after/360_dark-after.png(다크)
3. **PC(Windows), 위치 서비스 꺼짐 → 지역 고르기 → 다음부터 자동**
   - 흐름: 약국(2탭) → [현재 위치로 찾기](1탭) → "Windows 설정 → 개인 정보 및 보안 → 위치…" 한 줄 → [지역 고르기] → 전북특별자치도 칩 → 전주시 칩(3탭) → 카드 + "내 지역으로 저장했어요"
   - 탭: 5~6탭.
   - 다음 "근처 병원 찾아줘"는 **0탭 추가**로 전주시 기준이다(브라우저에 다시 묻지 않음).
   - 스크린샷: after/1280_unavailable-after.png, after/1280_picked-picker.png, after/1280_picked-after.png
4. **PC, 위치 오차 5km**
   - 흐름: [위치 허용하고 찾기] → "PC 위치는 정확하지 않을 수 있어요(오차 약 5km). 이 위치로 찾거나 지역을 골라 주세요." → [이 위치로 찾기](1탭) → 카드
   - 탭: 5탭.
   - 스크린샷: after/1280_coarse-rough.png
5. **저장 지역이 있을 때**: [전북특별자치도 전주시에서 찾기] 1탭으로 끝난다(질문 포함 2탭). 스크린샷: after/1280_saved-where.png

## TEST_STATUS

Windows 로컬. LF archive 사본에서 하나씩 돌렸다. CHROME_BIN은 실설치 Chrome이다.

- main 68b3161e 병합 + 칩 뒤(d5bfe829): 관련 검사 34개 모두 PASS.
  - 새 `validate_nearby_location_allow_prompt_01`(360·390·1280, 라이트·다크)
  - `validate_conversation_answer_ux_01`(새 계약), 캘린더 날씨·지역 9개, 위치 계층 4개, 생활정보·의료·온누리·부동산·뉴스·지하철 앞 단계, 키보드·스크롤, hardening·home_chat
  - `validate_global_location_foundation_01`은 git 저장소가 필요해 작업본에서 돌렸고 PASS다.
  - 묶음 중 2개가 처음에 실패했고, 단독 재실행에서 PASS했다.
    - `validate_calendar_week_mobile_vertical_01`: 부하 중 간헐 실패. 단독 2회 PASS, main 68b3161e에서도 PASS.
    - `validate_regional_info_back_navigation_01`: 임시 폴더 정리 EPERM. 단독 PASS.
- asset 토큰 `--check` PASS.
- 전체 Site 회귀: NOT RUN(gate에서 확인).

NEW_FAILURES=0

DEVICE_E2E=NOT VERIFIED (실제 iPhone Safari·삼성 인터넷·Windows PC 위치 서비스는 미확인. 브라우저 권한·위치는 검사기 안의 가짜 navigator로 재현)
CORE_E2E=NOT VERIFIED (Core 무변경, 운영 Core의 LOCATION_REQUIRED 계약과 같은 가짜 응답)

## 배포 후 smoke

- 설정에서 위치 사용 끄기 → 생활정보 → 약국 → "어느 지역에서 찾을까요?" 아래 [위치 허용하고 찾기] [지역 고르기].
  - [위치 허용하고 찾기] → 브라우저 팝업 허용 → 약국 카드.
- PC(Windows) 같은 흐름 → [지역 고르기] → 전북특별자치도·전주시 → 카드. 다음 "근처 병원 찾아줘"는 전주시 기준으로 바로 나온다.
- 브라우저에서 사이트 위치를 차단한 상태 → [위치 허용하고 찾기] → 자물쇠 안내 한 줄.
