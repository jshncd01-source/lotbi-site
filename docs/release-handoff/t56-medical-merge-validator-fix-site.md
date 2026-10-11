READY_FOR_DEPLOY=YES
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
DEPLOY_ORDER=SITE-T56 재gate에 그대로. 화면 코드 변경 없음(검사기 2개 + gate 목록에 의료 검사기 1줄).
USER_DECISION_NEEDED=NONE

# T56-MEDICAL-MERGE-VALIDATOR-FIX — "어느 지역?" 답 검사의 진입 경로를 합쳐진 의료 카드에 맞춤 (Site)

TASK=SITE-T56 재검사(site-t56r, release 2e09d432) TEST_FAILED 반환
REPO=lotbi-site
FEATURE_BRANCH=feature/t56-medical-merge-validator-fix-site
FEATURE_SHA=이 문서 커밋(branch HEAD). `git ls-remote origin refs/heads/feature/t56-medical-merge-validator-fix-site`로 확인한다.
CODE_SHA=eddbb8d6 (검사기 수정, 검사한 tree) → 2d528cca (site-review.yml에 의료 검사기 등록, CI 목록만) → 이 문서
BASE=release/20261010-site-t56r-work 2e09d43254bd94a89d485048a08ba010709b8391 (main f2e391ad + avatar revert). 이 위에 커밋 3개(검사기 수정, gate 목록 등록, 이 문서)만 올렸다.
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=f2e391adbe8b3a1424962fc9b024a693bbf98e9d (T56 gate merge, 배포 안 됨). base 2e09d432는 이 main + avatar revert다(push 직전 ls-remote 확인).
MAIN_PRESERVATION=base 위 fast-forward 커밋뿐이다. 바뀐 파일은 scripts/ 아래 검사기 2개, .github/workflows/site-review.yml(1단계 추가), 이 문서뿐이다(`git diff --stat 2e09d432 HEAD`). 화면 코드·asset 토큰은 바꾸지 않았다.
ASSET_VERSION=변경 없음(base 그대로)

## 원인

- gate 메시지: `validate_conversation_answer_ux_01.mjs` → `320/region: Error: timeout pharmacy shortcut`
- 이 검사는 지역정보 → [약국] 카드(`[data-life-shortcut="pharmacy"]`)를 눌러 "근처 약국 찾아줘"를 대화로 보냈다. 그러면 Core가 "어느 지역에서 찾을까요?"(LOCATION_REQUIRED)로 답하고, 그 답 아래 [현재 위치로 찾기]/[지역 고르기] 줄을 확인한다(QA #7, 위치 허용 01).
- 같은 T56의 LIFE-MEDICAL-MERGE-01(bada0723)은 병원·응급실·약국을 카드 하나로 합쳤다. 그 카드는 **대화로 질문을 보내지 않고** 자기 목록 화면(#life-medical)을 연다(소유자 결정 "대화로 넘기지 말고 같은 화면에").
- 그래서 약국 카드가 없고, 카드에서 "어느 지역?" 답으로 가는 길도 없다. 화면 동작은 두 기능 모두 의도대로이고, 검사기의 진입 경로만 낡았다.
- `validate_nearby_location_allow_prompt_01.mjs`(104번)도 같은 카드를 눌렀다. gate가 103번에서 멈춰 아직 드러나지 않았을 뿐이다.

## 바꾼 것 (검사기 2개, 확인 내용 줄이지 않음)

진입: 지금 "어느 지역?" 답에 가는 길은 사람이 "근처 약국 찾아줘"를 직접 입력하는 것뿐이다. 그 길로 바꿨다. 의료 방이 `validate_life_medical_auto_search_card_01`·`validate_life_direct_chat_card_compaction_01`에서 쓴 방법과 같다.

- `scripts/validate_conversation_answer_ux_01.mjs`
  - `openPharmacy`(카드 누르기)를 `askPharmacy`(입력 → 전송 → 답 대기)로 바꿨다.
  - 그대로 확인하는 것: 답 문구, 버튼 2개 이름·48px·화면 안, 지역 칩(드롭다운 0·확인 버튼 0·칩 48px·세종 1탭 목록), 고른 지역으로 한 번 다시 묻기, 목록 1회 읽기, 새로고침 뒤 버튼 유지·PC 저장 지역 칩, 차단 자물쇠 줄, 위치 사용 꺼짐 문구, REGION_AMBIGUOUS·옛 Core 버튼 없음, 다크 대비.
  - 입력창 조용함(`assertQuiet`: 입력창 비어 있음, 포커스 0, 활성 아님)은 "어느 지역?" 답 이후부터 센다. 위치 버튼·지역 칩이 입력창을 건드리지 않는지가 이 검사의 계약이다.
  - 직접 입력 전송 자체는 따로 확인한다: 입력창 비움. 휴대폰(coarse pointer)은 키보드 닫힘, PC는 커서 복귀. 둘 다 기존 CHAT-MOBILE-KEYBOARD-DISMISS-01 규칙이다.
- `scripts/validate_nearby_location_allow_prompt_01.mjs`
  - phase `menu`(생활정보 → 약국 2탭)를 `ask`(입력 1회)로 바꿨다. 위치 허용 7개 시나리오 단정은 그대로다(허용·차단·거부·위치 못 받음·PC 오차·지역 저장·저장 지역 칩·다크).
  - 같은 방식으로 포커스는 "어느 지역?" 답 이후부터 센다. 입력 전송 뒤 입력창 비움을 확인한다.
- 다른 검사기 전수 확인
  - `grep data-life-shortcut="pharmacy|hospital"` 결과 이 두 개뿐이다.
  - 의료 쪽 검사기(`life_medical_*`, `life_direct_chat_card_compaction_01`, `consumer_sections_02` 등)는 의료 방이 이미 `medical` 카드에 맞췄다.

## TEST_STATUS

Windows 로컬, Node 24, 실제 Chrome(CDP). LF archive 사본(eddbb8d6)에서 하나씩 돌렸다. PC 자리표 slot2를 잡았다.

- 범위: gate가 이 tree에서 멈춘 **103번~200번 전부**(site-review.yml 순서 98개, 그중 git 저장소가 필요한 2개는 작업본에서 실행) + `validate_life_medical_list_01` = 99개
  - 1~102번은 같은 tree(2e09d432)가 Linux gate에서 이미 통과했다. 이번 수정은 103·104번 검사기 파일과 gate 목록 1줄만 건드린다.
- 결과: **99/99 PASS, NEW_FAILURES=0**
  - 103 `validate_conversation_answer_ux_01` PASS(56s). 휴대폰 4폭은 입력 전송 뒤 포커스 0·키보드 닫힘, PC 1280은 커서 복귀가 기록됐다.
  - 104 `validate_nearby_location_allow_prompt_01` PASS(53s). 시나리오 7개 그대로.
  - `validate_life_medical_list_01` PASS(171 checks)
  - `validate_global_location_foundation_01`, `validate_photo_input_no_camcorder_01` PASS(git 저장소가 필요해 작업본에서 실행)
  - 나머지 103~200번 전부 PASS
- 12:1x PC 재부팅으로 75번째에서 끊겼다. 같은 tree에서 76번째부터 이어 돌렸다(앞 75개는 재부팅 전 PASS).
- 기존 실패(baseline): 이 범위에서는 없음.
- 2d528cca(site-review.yml 1단계 추가)는 YAML 파싱만 확인했다(`yaml.safe_load` OK). 검사기 코드는 바뀌지 않았다.

## 사용자 시나리오 (USER_FIRST_STANDARD 8)

화면 변경이 없어 전후 스크린샷은 해당 없음(N/A). 검사기가 따라가는 사용자 흐름:

1. **휴대폰, 위치 미허용**: 대화에 "근처 약국 찾아줘" 입력·전송 → "어느 지역에서 찾을까요?" + [현재 위치로 찾기] [지역 고르기] → [지역 고르기] → 전북 → 전주시(2탭) → 약국 카드. 막힌 곳 없음.
2. **PC, 위치 사용 꺼짐**: 같은 질문 → [위치 허용하고 찾기] → 허용(1탭) → 같은 질문을 위치와 함께 한 번 더 → 카드.
3. **브라우저 차단**: [현재 위치로 찾기] → "주소창 왼쪽 자물쇠 아이콘 → 위치 → 허용…" 한 줄과 [지역 고르기], 더 보내지 않음.
4. **지역정보 → 병원·응급실·약국 카드**: 대화로 보내지 않고 목록 화면이 열린다. 이것은 `validate_life_medical_list_01`(의료 방)이 확인하며, 이번에 함께 돌렸다.

DEVICE_E2E=NOT VERIFIED (검사기는 CDP 에뮬레이션)

## gate 목록 등록 (배포총괄방 요청)

- 의료 방의 새 검사기 `scripts/validate_life_medical_list_01.mjs`가 `.github/workflows/site-review.yml`에 없어서, 의료 한 화면이 gate에서 검사되지 않았다.
- `Validate life medical auto search and turning cards` 바로 뒤에 `Validate life medical one-screen list` 단계를 더했다. 검사기 내용은 바꾸지 않았다.
