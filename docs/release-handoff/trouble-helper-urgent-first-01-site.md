READY_FOR_DEPLOY=YES
MIGRATION=NO
DEPLOY_ORDER=SITE 단독 (Core 분쟁·사고 도우미 API 운영 중, App 짝 urgent-first는 APP-T19로 이미 배포)
USER_DECISION_NEEDED=NONE
USER_FIRST_STANDARD=적용 (release-control/USER_FIRST_STANDARD.md, 아래 「사용자 시나리오」 3개 + 스크린샷)

# TROUBLE-HELPER urgent-first 01 — 분쟁·사고 도우미: 상황 탭 → 바로 급한 할 일 (Site)

REPO=lotbi-site
FEATURE_BRANCH=feature/trouble-helper-urgent-first-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD). `git ls-remote`로 확인한다.
CODE_SHA=3740ea876 (Ncloud main f2e391ad(SITE-T56) 정상 merge. 그 앞 57e956995 = main 68b3161e(SITE-T55) merge, 코드 0591aee5b 흐름 변경·"null" 글자 수정 → 2c62b4716 새 버튼 min-width 48px)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=f2e391adbe8b3a1424962fc9b024a693bbf98e9d (SITE-T56. push 직전 ls-remote로 확인. 그 안에 SITE-T55 = 1차 c20aa101 + 48px 링크 수정 76285367 포함. rebase·force push 없음)
ASSET_VERSION=aset-9243c43b18ed (`--check` PASS, targets=169 refs=206)
DECISION=배포총괄방 2026-10-11 결정 (가): 상황 탭 → 질문 없이 바로 '지금 급한 할 일 + 전화 버튼', 질문은 아래 '내 상황에 맞게 좁히기'(선택)
PAIRED=lotbi-app feature/trouble-helper-urgent-first-01-app 66802e2e (APP-T19 배포, app main abd8d83f) — 화면 순서·이름을 App 코드 e7b1d221에 맞춤

## 변경

- 상황을 누르면 질문 화면 없이 바로 결과('할 일' 탭). goto·이어 보기도 항상 '할 일'로 연다. 창 머리글의 "질문 n/m" 줄 삭제.
- 할 일 표시 규칙: step `show_if`는 **답한 질문만** 따진다(모르면 보여 줌, 읽을 수 없는 규칙은 여전히 숨김). 숨은 질문의 답은 버리고 바뀌지 않을 때까지 반복.
- 결과 화면 위에서부터(App과 같음): 탭(**할 일 / 증거·창구 / 정리표**) → 상황 제목 → 그 상황의 참고용 한 줄 → **바로 전화 줄**(보이는 할 일의 112·119를 할 일 순서로 "119 전화" "112 전화", 위험색 토큰, 높이 64·글자 24, 같은 번호 한 번) → 할 일 카드 → (자동차) 포털 안내 → **내 상황에 맞게 좁히기**(모든 질문 버튼 묶음, 질문 22px, 고른 답 ✓·다시 누르면 지움, "답한 질문 n/m", 고르면 카드가 바로 다시 그려지고 아래 줄에 "'○○' 할 일이 빠졌어요/다시 보여요") → '다음: 모을 증거와 창구 →'. 전체 공통 참고용 상자는 상황 고르기 화면에만.
- 자동차 포털: 고르는 순서는 답한 만큼만, 문장을 못 만들면 안내 + '대화로 찾기 열기'. 비율·도표 없음 그대로.
- 고친 결함: 선택 구역이 없을 때 화면에 "null" 글자가 찍히던 것(검사기에 회귀 방지 추가).
- 새 버튼·답·탭 모두 `min-width: 48px`(글자 폭을 3px 좁혀도 48 이상 — Linux gate 글꼴 대비). 1차의 `.trouble-link` 48px 규칙(76285367)은 main에서 그대로 들어옴.
- 그대로 둔 것: 요금 한 줄, `receipt_field_id` 접수번호 잠금, limits·확인일·근거, 전화할 때 말할 내용, 인증이 안 돼요, 정리표 저장·인쇄·카카오, 새로고침 복원, 실패 화면(112·119·132), 큰 글씨, 읽어주기, 첫 클릭 로드(부팅 import 없음).
- 파일(main 대비 실제 내용 변경 5개): `site-trouble-helper-model.js`, `site-trouble-helper.js`, `site-trouble-helper.css`, `index.html`, `scripts/validate_trouble_helper_01.mjs`. 나머지는 asset 토큰 문자열만(diff 전수 확인).

## 사용자 시나리오 (USER_FIRST_STANDARD 8)

fixture Core로 화면 좌표를 실제 클릭하며 따라 했고, 단계마다 스크린샷을 남겼다(소유자 PC scratchpad `th-urgent-site\`, 27장). 탭 수는 메뉴 버튼 포함, 모바일 메뉴 여는 ☰ 탭은 따로 표기.

| 시나리오 | 시작 → 결과 탭 수 | 막힌 곳 | 스크린샷 |
|---|---|---|---|
| A. 자동차 사고 난 어르신 — 375×812, 비로그인, 라이트 | ☰ 1 + **2탭에 [119 전화][112 전화]와 첫 카드 전체가 스크롤 없이 보임** / 좁히기 '없어요' 3 → 119 카드·버튼 빠지고 112만 / 사진 안내는 스크롤(카드 3번째) / 정리표 4 | 없음 | `A-01-home` … `A-09-summary` |
| B. 중고거래 사기 당한 직장인 — 1280×900, **로그인** | **2탭에 [112 전화]와 '보낸 은행과 112에 바로 알리기'** / '계좌로 보냈어요' 3 / 증거·창구 4 / 정리표 5 / 접수번호 입력 6 / '신고함(접수번호 확인)' 7 | 없음. 로그인 상태에서도 같은 흐름이고, 도우미가 Core로 보내는 요청은 공개 안내 GET과 공개 카카오 설정뿐(세션 토큰 없음, credentials omit) | `B-01-home` … `B-09-submitted` |
| C. 층간소음 밤 11시 — 375×812, 다크 | ☰ 1 + **2탭에 '소음 기록 시작하기' 첫 카드**(바로 전화 줄 없음 — 112·119 해당 없음) / '아파트' 3 / '있어요' 4 / 증거·창구 5 → 스크롤하면 '전화하기 1661-2642'·'운영시간 평일 09:00~18:00' | 막힌 곳 1(고침): 바로 전화 줄 자리에 "null" 글자가 보였다 → 수정·회귀 검사 추가. 남은 점: 밤 11시는 운영시간 밖인데 '지금 상담 시간 아님' 안내가 없음(App과 같음, 배포총괄방 2차 목록 — Core 구조화 운영시간) | `C-01-home` … `C-09-center` |

## 검증 (Windows, CHROME_BIN 지정)

- 새 검사기 `validate_trouble_helper_01` **52 checks PASS**(merge 전 기준): 질문 화면이 나오지 않음, 375×812에서 [119][112] 줄과 첫 카드 전체가 스크롤 없이·320×640에서 줄과 첫 카드 제목·1280×900에서 줄과 첫 카드 전체, 답 없을 때 show_if 단계 보임, '없어요' → 119 카드 빠지고 줄은 112만·다시 누르면 돌아옴, 탭 이름·좁히기 문구·App과 같은 순서·위험색, 글자 폭을 3px 좁혀도 48px 미만 버튼 없음, "null" 글자 방지(수정을 빼면 실패함을 확인), **로그인 상태 흐름**(`validate_my_child_school_01`과 같은 세션 주입) + 기존 항목 전부.
- merge 2번(68b3161e → f2e391ad) 모두 충돌은 asset 토큰 줄과, main이 다른 방 줄을 바꾼 곳에 토큰이 겹친 블록뿐이었다(그 블록은 main 쪽). 최종 HEAD를 main f2e391ad와 비교하면 실제 내용 차이는 위 5개 파일뿐이고, `index.html`은 "질문 n/m" 줄 삭제 하나뿐(전수 diff 확인).
- 최종 HEAD 3740ea876 재실행: `validate_trouble_helper_01` 52 checks PASS, `validate_auth_continuity_02` PASS, `validate_consumer_design_shell_01` PASS, `validate_sidebar_information_architecture_04` PASS, `validate_home_chat.py` PASS, `validate_social_signup_profile_ux_01` 3회 중 2 PASS(아래).
- **`validate_social_signup_profile_ux_01` 불안정(기존, 이 변경과 무관으로 판단)**: 실패는 매번 다른 칸에서 "unexpected request 1"(검사가 `/v2/me`·`/v2/subscription` 말고 다른 요청이 하나라도 있으면 실패로 침). 이 branch에서 상위 세션 실행 15회 중 3회 실패(하위 작업 실행 8회 중 2회 실패 포함하면 23회 중 5회), 실패는 대개 다른 Chrome 검사기 바로 다음 첫 실행. main 68b3161e 비교 작업본은 번갈아 3회 PASS(하위 작업 기준 base c20aa101도 3회 PASS). 근거: 이 검사 화면이 실행하는 코드(`site-conversation.js`와 그 정적 import 전체, 스타일 5개)는 main과 asset 토큰 문자열만 다르다 — 이번에 내용이 바뀐 5개 파일은 이 화면이 하나도 불러오지 않는다(분쟁 도우미는 첫 클릭 때만 로드, 정적 import 0건 확인). 요청 주소를 기록하는 임시 사본으로 6회 돌렸을 때는 모두 PASS라 섞인 요청의 주소는 잡지 못했다(사본은 삭제). gate에서 실패하면 재실행을 먼저 부탁드린다.
- 전체 `validate_*` 273개(merge 전, 첫 커밋 기준): 267 PASS. 단독 재실행 PASS 3(`calendar_holiday_surface_settings_icon_01`, `life_wallet_document_scan_synthetic_02` 300초 넘게 필요, `place_card_compact_01`). 기존 실패 3: `mobile_footer_legal_sheet_01`·`site_avatar_fallback_runtime`(base c20aa101·main 68b3161e 모두 실패), `subway_life_info_p0_01`(base 실패·main PASS — 이 branch 변경과 무관한 main 쪽 수정). 두 번째 커밋 뒤 도우미·토큰 관련 34개 재실행 33 PASS + 같은 subway 1건.
- **NEW_FAILURES=0**.

## NOT VERIFIED

- 실제 iPhone·Android 기기, 실제 Core(fixture만), Linux gate 실제 글꼴(글자 폭 3px 축소로 근사), PC에서 전화 걸기, 실제 카카오 전송.
- 작은 차이: Site '다음' 버튼에 "→"가 붙음(App은 없음), ✓는 CSS로 표시.

## 배포 후 확인

1. lotbiai.com → 메뉴 '분쟁·사고 도우미' → '자동차 사고' 한 번에 [119 전화][112 전화]와 첫 카드가 보인다.
2. 좁히기 '다친 사람이 있나요? → 없어요'를 누르면 119 카드·버튼이 빠지고 아래에 알림 줄이 뜬다.
