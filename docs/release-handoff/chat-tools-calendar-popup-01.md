READY_FOR_DEPLOY=YES

# chat-tools-calendar-popup-01 — release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/chat-tools-calendar-popup-01
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ... refs/heads/feature/chat-tools-calendar-popup-01`)
REMOTE_FEATURE_SHA=same as FEATURE_SHA after push (verified with git ls-remote at push time)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=131b775d7c5c10ceac27c244332161082dcbcd46
CODE_SHA=358f5846675ace92d2599b68ee225e1dc692d7b0
ASSET_VERSION=aset-6f157cd9cb3a

## SCOPE

- LOTBI 답변 아래 도구가 복사하기 · 공유하기 · 캘린더에 추가 3개로 정리된다. "읽어주기"는 대화에서 빠진다.
- 공유하기는 OS 공유 시트 대신 "링크 복사" · "카카오톡 공유하기" 두 가지만 연다.
  Core에 Kakao 공유가 설정되기 전(현재 Production, kakao_navi_ready=false)에는 "카카오톡 공유하기"가 Kakao SDK를 부르지 않고
  답변+LOTBI 링크를 복사한 뒤 "복사했어요. 카카오톡에 붙여넣어 공유해 주세요."라고 안내한다. Core가 설정되면 코드 수정 없이 카카오톡 공유 화면이 열린다.
- 📅 캘린더(답변의 "캘린더에 추가" 포함)는 대화를 대체하는 작업공간이 아니라 대화 위 모달(dialog)로 열리고, 닫으면 대화가 그대로 남는다.
- main에 들어온 학교 선택·의료 119·동물병원 배지 카드, 첨부/카메라 메뉴, Life Wallet 진입은 바뀌지 않는다.

## BRANCH HISTORY

- 18fd804c feat: simplify chat tools and keep calendar in modal (원래 작업, base 67f8e430)
- bb8a0c32 Merge Ncloud main 131b775d — 56개 파일은 asset token만 충돌(main 쪽 선택 후 재계산), site-conversation.js import는 합집합(main의 위치·학교·의료·배지 import 유지, read-aloud import는 이 branch 결정대로 제외). merge 결과 = main + 18fd804c 변경분과 동일함을 파일별 diff로 확인.
- 358f5846 fix: copy instead when KakaoTalk sharing is not configured (사용자 결정 반영) + 18fd804c가 지웠던 assertion 중 여전히 성립하는 것 복원 + 두 Core 상태 validator 추가

## TEST_STATUS

로컬 Windows + Chrome(CHROME_BIN 지정), workflow의 validator 전체 + calendar/conversation/chat/life/safecare/message validator 합집합 178개:
- 174 PASS, 4 FAIL — 4건 모두 main 131b775d baseline에서도 동일하게 FAIL(아래 NEW_FAILURES 참고)
- 필수 항목: asset_cache_version --check PASS, validate_site.py PASS, validate_hardening.py PASS, validate_accessibility.py PASS, validate_mobile_entry.js PASS
- branch가 바꾼/추가한 validator: validate_message_share_actions_01, validate_kakao_share_fallback_01(신규), validate_message_calendar_footer_editor_01(브라우저, 390/1280px + Kakao 설정 상태), validate_reusable_output_card_01, validate_read_aloud_controller_01, validate_consumer_design_shell_01 — 모두 PASS
- 실제 브라우저(로컬, 375px): 답변 도구 3개, 공유 메뉴 2항목(하단 시트), Kakao 미설정 → SDK 요청 0건·답변+링크 복사·안내 문구, Kakao 설정 → 카카오 텍스트 공유 호출·복사 없음, 캘린더 모달 351x788(좌우 12px)·가로 스크롤 없음·닫으면 대화 유지·포커스 복귀 확인

NEW_FAILURES=0
(로컬 기존 RED, main에서도 동일: validate_calendar_system_dark_01(CRLF), validate_image_attachment_thumbnail_01, validate_mobile_footer_legal_sheet_01, validate_site_avatar_fallback_runtime)

MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
DEPENDENCIES=Core 변경 불필요. 기존 Core /app/config.json의 navigation.kakao_navi_ready / kakao_javascript_key / kakao_javascript_sdk_url 계약(Kakao Navi와 공유)을 그대로 읽는다.
READY_FOR_DEPLOY=YES

USER_DECISION_NEEDED=배포에는 없음. 카카오톡 직접 공유를 켜려면 Core의 Kakao JavaScript 키·kakao_navi 활성화와 Kakao Developers 도메인 등록이 필요하며, 이는 별도 승인 작업으로 남긴다(이번 작업에서 생성·변경하지 않음).
