# READY — Site 챗 박스 색상 반영

- 브랜치: `feature/chat-bubble-theme-site-01`
- 기준 main: `2499c7b5306df16df5ec94a318c0bc4089cf9fc9`
- 범위: 로그인한 사용자 프로필의 `chat_bubble_color`를 본인 메시지 버블에 적용하고 자동 대비 텍스트 색상을 계산
- 폴백: 로그아웃 시 사용자 CSS 변수를 제거하며, 게스트·누락·잘못된·레거시 값은 기존 기본 디자인 유지
- LOTBI 응답 버블은 읽기 쉬운 기존 디자인을 유지

검증:

- `node scripts/validate_chat_bubble_theme_01.mjs`
- `python scripts/validate_hardening.py`
- `python scripts/validate_home_chat.py`

한계:

- 실제 인증 세션의 Account 저장 → Site 재접속 동기화는 통합 리뷰 환경에서 후속 확인 필요

확정 시안 대조:

- 전달된 최신 확정 시안은 `축제·행사` 화면 기준이며, 이 PR은 인증 사용자의 기존 채팅 말풍선 CSS 변수만 변경함
- 로고·롯비 캐릭터·좌측 메뉴·카테고리명·최근 대화·프로필·축제 카드 구조와 문구를 직접 변경하지 않음
- 자산 캐시 재생성에 따른 축제/아바타 파일 차이는 import URL 해시 교체뿐이며 화면 요소를 추가하지 않음
- 인증된 데스크톱·모바일 화면의 실제 색상 적용 및 프로필 영역 보존은 배포 전이라 `NOT_VERIFIED`
