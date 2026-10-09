READY_FOR_DEPLOY=YES
SUPERSEDES=320b9dfc
USER_DECISION_NEEDED=NONE

# 유치원 공식정보 (유치원알리미) — 생활정보 → 유치원·학교 (Site) — main ddcc573d 재병합

REPO=lotbi-site
FEATURE_BRANCH=feature/kindergarten-official-info-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD). 문서에는 자기 SHA를 넣을 수 없으므로 `git ls-remote`로 확인한다.
CODE_SHA=8cbb1854 (기존 재병합 1f84889f 뒤 최신 main ddcc573d 정상 merge 커밋)
SUPERSEDES_REASON=배포총괄방 재병합 요청(2026-10-09 08:52): 320b9dfc를 main fa6ed88d에 합친 기존 결과 1f84889f를 Ncloud에서 확인·보존했고, 작업 중 main이 ddcc573d(반복 일정 캘린더 포함)로 전진해 한 번 더 정상 merge했다.
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=ddcc573dca618a3289594220e53bb22d6c414bad (SITE-T37; 정상 merge 8cbb1854, rebase·force push 없음; push 직전 다시 확인)
MERGE_CONFLICTS=초기 1f84889f는 생활정보/validator 의미 충돌을 병합. ddcc573d 추가 merge는 64개 파일에서 token 충돌(동일 내용 89 hunk) + HTML 스타일 목록 2 hunk였고, 최신 main 목록에 site-life-education.css를 보존한 뒤 token을 재계산했다.
ASSET_VERSION=aset-87eb9f3645e9 (scripts/asset_cache_version.mjs --check PASS)
CORE_PAIR=lotbi-core feature/kindergarten-official-info-01-core bc737011 — 이미 Production 반영(KINDERGARTEN_OPENAPI_ENABLED=false, 기능 꺼짐)
TEST_STATUS=1) 원격 exact READY tree d740feea에서 scripts/validate_* 전체 239개(실제 Chrome 포함) 236 PASS·3 FAIL. 2) 최신 main ddcc573d merge 뒤 asset check·핵심 JS 구문 검사와 validate_consumer_sections_02, kindergarten(32 checks, 360/375/390/412/1280 라이트·다크), onnuri, life_info_cleanup, life_medical_category_entry, calendar_recurring_events, calendar_week_mobile_vertical, site_refresh_route_restore, SafeCare 다크·취소·사진 일괄 업로드, 다크 입력창·Kakao 공유, mobile_composer_keyboard_layout 전부 PASS.
NEW_FAILURES=0 — 전체 회귀 실패 3개(validate_image_attachment_thumbnail_01, validate_mobile_footer_legal_sheet_01, validate_site_avatar_fallback_runtime)는 baseline main fa6ed88d에서도 같은 명령·같은 오류로 재현된 Windows 로컬 기존 RED. ddcc573d 추가 merge 뒤 관련·신규 validator 실패 없음.
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
NEW_SECRET_CREATED=NO
DEPLOY_ORDER=SITE 단독 (짝 Core는 이미 Production)
PRODUCTION_FLAG_EFFECT=Core KINDERGARTEN_OPENAPI_ENABLED=false인 동안 유치원 탭은 "유치원 공식정보 연결을 준비하고 있어요" 안내 + 지역·유치원 이름 양식 → 입력창에 "<지역> <이름>유치원 알려줘"(기존 기관 기본정보 답, 공시 자료 아님 표시). 학교 탭은 바로 동작한다. ENABLED=true가 되면 Site 재배포 없이 공시 화면으로 바뀐다.
USER_DECISION_NOTE=유치원알리미 인증키 교체·Render KINDERGARTEN_OPENAPI_KEY·ENABLED 공개 여부는 Core 활성화 결정이고 이 Site 배포와는 별개다.

## 재병합 해결 내용 (main ddcc573d)

- `site-consumer-sections.js`: 온누리 쪽 아이콘 줄(`item.brandSlot ? brandSlot(...) : icon(...)`)과 `item.id === 'onnuri' ? onOnnuri?.()`를 그대로 두고 `item.id === 'education' ? openEducation(item)`를 더했다. LIFE_SHORTCUTS는 자동 병합으로 hospital, pharmacy, festivals, onnuri, local, education (카드 6개).
- `index.html`, `auth/callback/index.html`: main 스타일시트 목록(site-person-bulk.css, site-life-onnuri.css 포함) + site-life-education.css 한 줄.
- validator 3개: 두 쪽 검사를 모두 유지, 완화·삭제 없음.
  - `validate_consumer_sections_02`: 라벨 6개, id 6개, prompt 예외 = festivals·onnuri·education.
  - `validate_life_info_cleanup_final_01`: id 목록 6개, 상세 순회 제외는 main 그대로(festivals·onnuri; education 상세는 순회되어 돌아오기 확인).
  - `validate_life_medical_category_entry_01`: 라벨 6개(2곳), 온누리의 brandSlot·gridColumn spansRow probe와 아이콘 검사 유지, 같은 폭 검사는 "여러 열일 때만 줄 전체 카드 제외"(더 엄격한 쪽), 생활정보 홈 대기 조건을 카드 6개로.
- 이 branch가 토큰만 바꿨던 `site-conversation.js`, `site-person-ui.js`, `site-read-aloud-controller.js`는 main 내용 그대로.
- ddcc573d의 반복 일정 캘린더 코드와 validator를 main 그대로 보존했다.
- asset 토큰 재계산.

## 변경 요약 (기능)

- 생활정보 카드 "유치원·학교"(맨 끝). 홀수 개일 때 마지막 카드가 한 줄을 쓰는 규칙은 site-life-onnuri.css와 site-life-education.css에 같이 있다(지금 6개라 적용 안 됨). 새 route 없음.
- 학교 탭: 학교 이름 + [학교 기본정보 / 오늘 급식 / 이번 주 급식 / 학사일정] → 대화 입력창에 질문만 넣는다(기존 NEIS 답변). 저장 학교 키(life-school)는 읽지도 바꾸지도 않는다.
- 유치원 탭(유치원알리미 공시): 시도·시군구 코드표 → 이름·설립유형 → 목록 → 상세(설립유형·주소·연락처·운영시간·학급·정원·원아·홈페이지·공시 기준 + 상세 공시 8개, 공시차수, 출처·조회일). 학비는 말하지 않는다. 내 유치원은 계정별 별도 키.
- Core 요청은 GET, credentials omit. innerHTML 없음.

## MERGE_NOTES

- 의료 자동검색 카드(b1dfbece, CMD_SITE_LIFE_MEDICAL_AUTO_SEARCH_CARD_REMERGE_02)도 같은 칸·같은 validator를 바꾼다. 나중에 들어가는 쪽이 새 main에 한 번 더 병합한다.
- asset 토큰 충돌은 `node scripts/asset_cache_version.mjs --write`로 다시 만든다.

## POST_DEPLOY_SMOKE

lotbiai.com → 생활정보: 카드 6개(온누리상품권·유치원·학교 포함). 온누리상품권 카드 → 온누리 화면. 유치원·학교 → 유치원 탭 "준비 중" 안내 + 양식(Core ENABLED=false), 학교 탭 [이번 주 급식] → 입력창 "OO초 이번 주 급식 알려줘". 모바일 실기기(iPhone Safari·Android Chrome) 확인은 하지 않았다(뷰포트 에뮬레이션만).
