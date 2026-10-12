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
