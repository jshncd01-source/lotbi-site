READY_FOR_DEPLOY=NO
SUPERSEDES=1107cfb57e81471db1b06f3e2d1e61cfde4da2e9
ALEMBIC_HEADS=1
OLD_APP_COMPAT=PASS — Site 공개 가격은 신규 계약 29,900원이며 기존 계약 19,900원 보존을 정책에 명시; 모바일 API 호환은 Core/App 회귀로 검증
ENV_CHANGE_REQUIRED=LOTBI_SOCIAL_TERMS_VERSION, LOTBI_SOCIAL_TERMS_SHA256, LOTBI_SOCIAL_TERMS_URI, LOTBI_SOCIAL_PRIVACY_VERSION, LOTBI_SOCIAL_PRIVACY_SHA256, LOTBI_SOCIAL_PRIVACY_URI — 소유자 승인됨; Site 배포 뒤 --check-served MATCH 확인 후 배포총괄방이 적용
USER_DECISION_NEEDED=약관 env 갱신은 소유자 승인됨·배포총괄방 실행. p0_0107_calendar_recurring main 반영 후 배포 train 승인

# subscription-price-proration-01-site — 배포 인계

## 현재 차단 상태

- Site 최신 Ncloud main `fa6ed88d3608536050de0fb56136ae9b920a4c55`를 포함한다.
- Core main `01d66e48`의 반복 일정 revision은 36자라 운영 Alembic 적용에 실패했고 Production DB에는 적용되지 않은 채 롤백됐다.
- 반복 일정 owner의 32자 이하 수정본 `p0_0107_calendar_recurring`이 실제 main에 반영되기 전에는 이 revision을 down revision으로 쓰지 않으며 전체 train은 READY가 아니다.
- Production 약관 환경변수는 읽기 전용 비교만 했으며 변경하지 않았다.
- 이 문서에는 해시·버전의 실제 값을 기록하지 않는다. 값 산출과 승인은 배포총괄 절차에서 수행한다.

## 가격 및 정책

- `subscribe.html`, `refund.html`, `terms.html`의 신규 Plus 가격은 29,900원이다.
- 신규 월 요금은 Basic 9,900원 / Plus 29,900원 / Pro 39,900원(VAT 포함)이다.
- 기존 Plus 19,900원 계약은 사전 안내·동의 없이 인상하지 않는다고 구분한다.
- 공개 페이지에는 구형 신규가입 가격이 남지 않으며 validator가 이를 고정한다.

## 약관 해시 안정성

- UTF-8, LF 줄바꿈으로 정규화한다.
- `.js`, `.mjs`, `.css`의 `?v=<asset token>`만 제거한다.
- 승인된 chooser bootstrap 블록을 한 번 제거한 뒤 SHA-256을 계산한다.
- token/줄바꿈 변경에는 해시가 유지되고 본문 한 글자 변경에는 달라지는 테스트가 있다.
- Production 서빙본 읽기 전용 비교: Terms=MISMATCH, Privacy=MATCH.
- Production Core 동의 manifest는 현재 feature 문서와 불일치한다. 실제 값은 출력하지 않았다.

## 검증

- 가격/proration, legal manifest, usage matrix, plan banner, refund alignment, legal pages, Site, hardening, 접근성, clean URL validator: PASS.
- consumer shell, checkout handoff, static theme validator: PASS.
- footer/theme 동기화 및 asset cache `--check`: PASS.
- 실제 Production 환경변수 변경, Linux gate, 실기기 브라우저는 NOT VERIFIED.

## 19,900원 잔존 분류

- 기존 계약 보존 문구, 구형 가격을 금지하는 validator와 변경 이력 주석에만 남는다.
- 공개 신규 가입 요금에는 남지 않는다.

LIVE_MONEY=OFF
SUBSCRIPTION_PLAN_CHANGE_ENABLED=false
