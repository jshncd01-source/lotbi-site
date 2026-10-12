# READY — 카카오 공유 및 장소 카드 액션

- 브랜치: `feature/chat-kakao-share-place-actions-01`
- 기준 main: `2499c7b5306df16df5ec94a318c0bc4089cf9fc9`
- 범위: 명시적 카카오톡 공유 메뉴, Web Share/클립보드 폴백, 개인정보를 제외한 정규 URL 공유, 전화 왼쪽·네이버 지도 오른쪽 정렬, 44×44 터치 영역
- 구성: Core 공개 설정의 기존 Kakao JavaScript 키와 SDK URL만 사용하며 비밀값을 로그·URL에 노출하지 않음

검증:

- `node scripts/validate_message_share_actions_01.mjs`
- `node scripts/validate_kakao_share_menu_01.mjs`
- `node scripts/validate_place_action_edges_01.mjs`
- `node scripts/validate_place_card_cross_platform_01.mjs`
- `node scripts/validate_place_card_map_deeplinks_01.mjs`
- `python scripts/validate_hardening.py`
- `python scripts/validate_home_chat.py`
- 실제 Chrome 헤드리스 브라우저: 344/360/390/412/760/761/1280px에서 액션 위치·간격·터치 크기·공유 메뉴 계약 통과

브라우저 증빙:

- `docs/browser-evidence/place-actions-390.png`
- `docs/browser-evidence/place-actions-1280.png`

확정 시안 대조:

- 전달된 최신 확정 시안은 `축제·행사` 화면 기준이며, 이 PR의 변경 범위는 채팅 공유 메뉴와 장소 카드 액션에 한정됨
- 데스크톱 증빙에서 기존 LOTBI 로고·롯비 캐릭터·좌측 메뉴·최근 대화 영역이 유지되고, 카드 수·기존 지도 아이콘은 테스트 입력과 동일함
- 모바일 증빙은 접힌 메뉴 상태이므로 좌측 메뉴·최근 대화·프로필 영역의 시안 일치는 `NOT_VERIFIED`
- 확정 축제 시안의 좌측 메뉴 문구와 이 브랜치 기준 main의 실제 메뉴 문구에는 차이가 있으나, 이 PR은 해당 문구를 변경하지 않음. 축제 카드·배너·카테고리·바로가기는 추가하지 않음

한계:

- Android Chrome·Samsung Internet·iPhone Safari 실기기 및 Android/iOS 네이티브 WebView는 미검증이며, 위 모바일 결과는 Chrome 사용자 에이전트와 뷰포트 에뮬레이션임
- 카카오 계정이 연결된 실제 SDK 전송 완료는 리뷰 환경에서 후속 확인 필요
