READY_FOR_DEPLOY=YES

# LIFE-MEDICAL-MERGE-01 — Site (지역정보 병원·응급실·약국: 한 카드, 같은 화면의 가까운 곳 목록) + 지역생활정보 카드 숨김 + 학교 찾기 링크 위치

TASK_ID=LIFE_MEDICAL_MERGE_01_SITE
REPO=lotbi-site
FEATURE_BRANCH=feature/life-medical-merge-01-site
BASE_MAIN_SHA=68b3161e6 (SITE-T55 운영 COMPLETE 2026-10-11 10:21, 병합 완료)
CODE_SHA=7c7bea5c9 (main 병합 커밋; 이후 이 READY 문서 커밋만 추가, 코드 동일)
DEPLOY_ORDER=CORE_THEN_SITE — Core `feature/life-medical-nearby-01-core` 5d2b8870 (docs/release-handoff/life-medical-merge-01-core.md, CORE-T49 묶음). Core가 운영에 반영되기 전에는 이 화면은 "정보를 불러오지 못했어요 + [다시 시도] [지역 고르기]"만 보인다(막다른 화면은 아님).
DEPENDS_ON=lotbi-core CORE-LIFE-MEDICAL-NEARBY-01
MIGRATION=NONE, NEW_ENV=NONE, NEW_SECRET_CREATED=NO, NEW_PAID_RESOURCE=NO
OWNER_APPROVAL_REQUIRED=NO — 소유자 결정 2026-10-11("병원 응급실 약국도 같은 분류이니깐 카테고리를 하나로", 「병원·응급실·약국」 확정, "이걸 너 같으면 사용자가 쓰겠어?" → 대화로 넘기지 말고 같은 화면에), 배포총괄방 지시(QA_화면전수_01 H3 지역생활정보 숨김, 소유자 승인 "우선 권장으로 전부 승인해" — 학교 찾기 링크를 제목 아래로).

## 사용자 시나리오 (USER_FIRST 8 — 실제 터치·마우스로 따라 해 봄)

전체 표·전/후 스크린샷·측정 원본: `C:\Users\jshnc\LOTBI-NCLOUD\release-control\user-scenarios\life-medical-merge-01-site\SCENARIOS.md`

| # | 시나리오 | 시작 → 끝 | 탭 수 | 막힌 곳 | 스크린샷(위 폴더) |
|---|---|---|---|---|---|
| S1 | 위치를 허용한 사람 | 지역정보 → 「병원·응급실·약국」 → 같은 화면에 내 주변 병원·의원 5곳, 곳마다 전화·길찾기 | 1 | 없음 | `after-android-360x780-hospital-list-light.png` 외 다크·PC |
| S2 | 급한 사람 | 위 화면 → [응급실] 칩 → 응급실 4곳, 맨 위 119 전화 | 1 | 없음(목록 실패해도 119 남음) | `after-android-360x780-emergency-light.png` |
| S3 | 위치 거부, 처음 / 다음 방문 | 카드 → 시·도·시·군 선택칸 열려 있음 → 서울특별시 → 강남구 → 목록 / 다음엔 카드만 | 5(첫 방문) → 1(기억) | 첫 방문 한 번의 지역 고르기 | `…denied-picker-light.png` → `…region-list-light.png` |
| S4 | 위치를 정하지 않은 사람 | 카드 → [위치 허용하고 찾기] / [지역 고르기] → 허용 → 목록 | 2(+브라우저 허용 1) | 열고 새로고침해도 허용창을 먼저 띄우지 않음 | `…chooser-light.png` |
| S5 | 약국 | [약국] 칩 → 5곳 → [더 보기] 5곳 더(요청 추가 없음) | 1(+1) | 없음 | |
| S6 | 공공데이터 장애·빈 결과 | "확인하지 못했어요. 없다는 뜻은 아니에요" + [다시 시도] [지역 고르기](응급실은 [119 전화]) | 1 | 막다른 화면 없음 | `…unavailable-light.png`, `…empty-light.png` |
| S7 | 로그인 안 한 사람이 학교 찾기 | 지역정보 → 내 아이 학교·유치원 → 「로그인 없이 학교·유치원 찾기」 | 2 | 링크가 제목 바로 아래(135~183px)이고 안 움직임. 전: 로그인 안내 아래 334~378px로 175px 밀려 빗나감 | 전/후 `…my-child-open|settled.png` |

## 무엇이 바뀌나

1. **카드 하나, 화면 하나**(`site-life-medical-list.js`·`.css` 새 파일, `site-consumer-sections.js`): 「병원·응급실·약국」 카드가 대화로 질문을 보내지 않고 자기 화면(`#life-medical`)을 연다.
   - 맨 위 칩 [병원·의원] [응급실] [약국] → 가까운 5곳 + [더 보기](5곳씩, 한 번 읽은 최대 15곳). 같은 화면, 대화·AI 호출 없음.
   - 곳마다: 이름(네이버 검색 링크), 종별, 주소, 직선거리(위치일 때), 등록 진료·운영 시간 줄("등록 시간상 진료 중 · 오늘 09:00~18:00" + "실제 진료 여부는 전화로 확인"), 확인된 전화, 쓰던 지도 앱 길찾기(승인된 아이콘). 인증된 사진이 있을 때만 사진 칸(없거나 실패하면 칸 없음).
   - 정렬 이유 한 줄(Core `sort_basis`), 기준 장소("현재 위치(서울특별시 강남구) 기준" / "저장된 지역(강남구) 기준"), "12곳 중 5곳을 보여 드려요".
   - 응급실 칩이면 119 전화 버튼이 항상 위에 있다(목록 실패·빈 결과·연결 꺼짐에도).
   - 위치(USER_FIRST 2): 위치 사용이 켜져 있고 브라우저가 이미 허용 → 바로 목록. 아니면 이전에 고른 지역(없으면 캘린더 저장 지역) → 바로 목록. 둘 다 없으면 [위치 허용하고 찾기] / [지역 고르기] 두 버튼이 화면이다. 고른 지역과 마지막 칩은 기억한다(`lotbi.life.medical-region.v1`, `lotbi.life.medical-kind.v1`, 이 브라우저 안에만). 화면을 열거나 새로고침해도 브라우저 허용창을 띄우지 않는다(눌렀을 때만).
   - 빈 결과 / 확인 못 함 / 연결 꺼짐 / 호출 한도 / 네트워크 / 형식 오류 / 좌표 없음 / 지역 목록 실패 — 모두 문장 + 다음 버튼(막다른 화면 없음). "주변에 없음"과 "확인하지 못함"을 구분한다.
2. **지역생활정보 카드 숨김**(`site-feature-flags.js` `LIFE_LOCAL_CARD_ENABLED=false`, QA_화면전수_01 H3): 지역정보는 8장(2열 4줄, 빈 칸 없음). 폼·예시 질문·`life-local` 경로는 그대로 두고 스위치를 켜면 다시 보인다(카드 수가 홀수가 되면 마지막 카드가 한 줄 전체).
3. **내 아이 학교·유치원**: 로그아웃일 때 「로그인 없이 학교·유치원 찾기」를 로그인 안내 위(제목 바로 아래)로 올림, 눌리는 높이 44→48(`site-consumer-sections.js`, `site-consumer-layout.css`).
4. 작은 변경: `site-navigation.js` `normalizePlaceResult(…, {limit})`(대화 카드는 기본 5 그대로, 이 화면만 15), `index.html`·`auth/callback/index.html`에 새 CSS 링크, 에셋 토큰 `aset-5f9e0f7820b6`.

대화는 그대로다: 사용자가 직접 "근처 약국 찾아줘"를 보내면 예전처럼 대화 카드로 답한다(위 검증기가 확인).

## 검증기 (Windows, Node 24, 실제 Chrome DevTools, 화면 크기·UA 에뮬레이션)

- **신규** `scripts/validate_life_medical_list_01.mjs`: 5개 화면(360·375·390·412·PC 1280, 라이트·다크) 171 checks PASS. 카드 8장·한 카드, 한 번 눌러 목록, 5+더 보기(추가 요청 없음), 칩 3개·기억, 응급실 119, 위치 5상태(허용·거부·미정·사용 꺼짐·기억된 지역), 지역 고르기 기억, 문제 12종, 사진, 지도 앱 4종 아이콘, 시스템 뒤로·← 한 단계씩, 로그인 섹션, 48px, 대비, 새로고침이 허용창을 띄우지 않음.
  Core 응답은 Core `life_medical_api.nearby()`가 가상 시설로 만든 `scripts/fixtures/life_medical_nearby_01.json`.
- **갱신(약화 없음, 같은 계약을 새 구조에 맞춤)** — 카드 목록·개수는 `LIFE_SHORTCUTS`/스위치에서 만들고 지역생활정보 단계는 스위치가 켜졌을 때만 돈다:
  - `validate_consumer_sections_02`, `validate_ev_charger_nearby_list_p0_01`, `validate_subway_life_info_p0_01`, `validate_traffic_cctv_route_select_p0_01`, `validate_my_child_school_01`, `validate_life_info_cleanup_final_01`, `validate_regional_news_p0_01`, `validate_jeonbuk_real_world_pilot_01`: 약국 카드 제거·한 카드·8장/스위치 반영.
  - `validate_life_medical_category_entry_01`: 카드 목록 칸 검사 그대로(8장, 마지막 줄 [부동산 실거래가][내 아이 학교·유치원]), "카드를 누르면 질문이 전송됨" 단계는 "화면이 열리고 아무것도 보내지 않음"으로 교체(검사 내용이 사라진 동작이라서).
  - `validate_life_medical_auto_search_card_01`, `validate_life_direct_chat_card_compaction_01`: 병원·약국·응급실 카드 전송이 없어졌으므로 **사용자가 직접 입력한 질문**으로 같은 대화 카드·119·약국 조건·전화/지도·사진/무사진 카드 검사를 그대로 유지. "키보드 안 뜸·포커스 없음"(메뉴 전송 전용 계약)은 입력 질문에는 적용되지 않아 입력 후 비움·생활정보 닫힘으로 바꾸고, 한 번 누르기·뒤로/앞으로·새로고침 계약(B·C·F)은 아직 질문을 보내는 카드(지역생활정보, 숨김 동안은 학교)에서 그대로 측정.
  - `validate_regional_info_back_navigation_01`: 병원 카드 "질문하면 기록이 접힘" 단계는 질문을 보내는 카드(지역생활정보, 스위치 on)에서 유지하고, 병원 카드는 "열리고 아무것도 안 보냄 + 뒤로 한 단계"로 확인. 학교 찾기 링크: 제목→링크→내용 순서, 링크가 제목 바로 아래·내용 위·48px, 내용이 붙어도 안 움직임을 새로 추가.
  - `validate_site_refresh_route_restore_01`: "질문 바로 전송" 단계는 스위치 on일 때만(새 대화·대화 전환으로 나가기는 그대로).
- **병합 후(main 68b3161e6 위, aset-5f9e0f7820b6)** 영향 검증기 21개 일괄 실행: `validate_auth_continuity_02`(새 CSS 두 HTML 순서), 새 검증기, `consumer_sections_02`, `category_entry`, `back_navigation`, `auto_search_card`, `direct_chat_card_compaction`, `ev_charger`, `subway`, `traffic_cctv`, `my_child_school`, `life_info_cleanup_final`, `regional_news`, `jeonbuk_pilot`, `subview_back_navigation`, `kindergarten`, `onnuri_location_ux`, `onnuri_merchant_search`, `real_estate`, `voucher_unified` — **모두 PASS**.
- 예외 1개 — `validate_site_refresh_route_restore_01`: 진위확인 로그인 복귀 단계("I login from /#scam → back on 진위확인, signed in", `auth: checking`)가 **이 PC에서 간헐 실패**한다. 병합 후 같은 검사기를 이 branch와 **순수 main 68b3161e6**에 번갈아 4번씩 돌린 결과: 이 branch 4/4 실패, **main 원본 3/4 실패**(실패한 줄이 모두 같은 단계). 이번 변경과 무관한 기존 불안정(또는 main의 회귀 — 이 PC가 메모리 91%·CPU 100%인 부하 상태)이다. 병합 전 이 branch 단독 실행에서는 통과한 적도 있다. 로그: 이 방 scratchpad `flake2/`. Linux gate에서 같은 단계가 실패하면 이 branch 때문이 아니다 — 배포총괄방이 main 원본과 같은 결과인지 비교해 주세요.
- 사전 회귀(지역생활정보를 숨기기 **전** 코드): `validate_regional_info_back_navigation_01`(지역생활정보 예시 질문·빈 칸 안내·기록 접힘 포함), `validate_life_direct_chat_card_compaction_01`(지역생활정보 한 번 누르기·뒤로/앞으로·새로고침) PASS — 스위치가 꺼진 동안 이 단계들은 도달할 수 없어 실행되지 않는다(NOT_TESTED while hidden). 스위치를 켜면 같은 검사기가 그 단계를 다시 돈다.

## NOT_VERIFIED / NOT_TESTED

- **Linux trusted gate 미실행**(Windows 결과만). 새 검증기는 gate 규칙대로 프로필 폴더를 `mkdtemp`로 미리 만들고 `scripts/.life-medical-list-*`에 두며 끝에 지운다.
- 실기기 Android/iPhone 미확인(화면 크기·UA 에뮬레이션, 실제 지도 앱·전화 앱은 열지 않음).
- 실제 Core/국립중앙의료원 응답 미확인: 화면은 Core `nearby()`가 가상 시설로 만든 응답으로만 확인했다. 실제 사진 로딩은 이미지 이벤트를 흉내 냈다(구글 사진 복구는 범위 밖).
- 브라우저 위치 허용창 자체는 CDP 권한 설정으로 흉내 냈다(실제 팝업 문구·순서는 기기별).
- 로그인 상태는 페이지 전체가 아니라 `mountConsumerSection({authenticated:true})` 마운트로만 확인(의료 화면은 로그인에 따라 달라지지 않음).
- 화면 맨 위 ← 닫기 버튼 크기는 공용 모달 부품이라 건드리지 않았다(검사기가 `closeBox`로 측정만).
- **공통 위치 허용 부품(`site-location-allow.js`, nearby-location-allow-prompt-01 방)**: main에 아직 없어 이 화면은 EV 화면과 같은 규칙을 직접 구현했다(파일 머리 `TODO(site-location-allow.js)`). 그 부품이 main에 들어가면 이 화면도 교체 대상이다 — 다음 owner에게 넘김.
- **앱(LOTBI-app)**: main 3ca05e8d에는 지역정보 카드 목록이 없어(생활정보 허브는 축제·행사와 장소·길찾기뿐) 같은 흐름은 **다음 READY**.
- 진료과·영업 시간 "더 좁히기 ▾"는 2차 READY(Codex Core QD 필터 로직 참고, 출처 커밋 a6426129). Codex branch(`feature/medical-direct-search-p0-core|site`)는 손대지 않았고 배포총괄방이 '대체됨'으로 기록한다.

## 소유자·중복·병합 가능성

- 같은 화면을 다루는 다른 branch: Codex `feature/medical-direct-search-p0-site`(af6c04633, main 미병합) — 위 결정으로 대체. 이 branch는 main `68b3161e6`에 정상 merge 완료(병합 커밋 7c7bea5c9). 충돌은 에셋 토큰(전 파일, 재계산)·`site-navigation.js`(main의 `placeCategoryLabel` 유지 + 내 `limit` 옵션)·`site-consumer-sections.js`(main의 `releaseFamily` 유지 + `releaseMedical`)·`index.html`/`auth/callback/index.html`(새 CSS 링크를 EV CSS 바로 뒤, 두 파일 같은 순서로 다시 넣음)뿐이고, `site-conversation.js`·`site-life-location.js`·`site-person-*`는 내 변경이 없어 main 쪽을 그대로 썼다. 병합 뒤 토큰을 뺀 내용 비교로 main과의 차이가 이 branch의 파일(24개)뿐임을 확인했다.
- 공용 파일을 만지는 다른 방: `site-consumer-sections.js`(위치 허용 공통 부품 02방, 앞으로 병합 때 같은 줄을 만질 수 있음), 에셋 토큰(모든 branch 공통, `node scripts/asset_cache_version.mjs --write`로 다시 계산).

NEXT_OWNER=CLAUDE_RELEASE_CONTROL (Core CORE-T49 운영 → 이 Site gate; 이후 위치 허용 공통 부품 교체, App, 2차 "더 좁히기")
