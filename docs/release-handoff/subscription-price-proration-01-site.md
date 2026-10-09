READY_FOR_DEPLOY=YES
SUPERSEDES=1107cfb57e81471db1b06f3e2d1e61cfde4da2e9
ALEMBIC_HEADS=1
OLD_APP_COMPAT=PASS — 공개 신규 Plus는 29,900원이고 기존 계약 19,900원 보호를 정책에 구분해 표기한다. 모바일 API 호환은 Core/App 실제 파서 회귀로 검증했다.
ENV_CHANGE_REQUIRED=LOTBI_SOCIAL_TERMS_VERSION, LOTBI_SOCIAL_TERMS_SHA256, LOTBI_SOCIAL_TERMS_URI, LOTBI_SOCIAL_PRIVACY_VERSION, LOTBI_SOCIAL_PRIVACY_SHA256, LOTBI_SOCIAL_PRIVACY_URI — 소유자 승인됨. Site 배포 뒤 --check-served MATCH 확인 후 배포총괄방이 실행한다.
USER_DECISION_NEEDED=없음 — 약관·개인정보 env 6종 갱신은 소유자 승인됨, 배포총괄방 실행 대상이다.

# subscription-price-proration-01-site — 배포 인계

- Ncloud Site main `9e39edd0`를 정상 merge했다.
- 공개 신규 요금은 Basic 9,900원 / Plus 29,900원 / Pro 39,900원(VAT 포함)이다. 19,900원은 기존 Plus 계약 보호·호환 검증 문맥에만 남고 신규 가입 표기에는 없다.
- 약관 해시는 UTF-8·LF 정규화, JS/MJS/CSS asset token 제거, 승인된 bootstrap 정규화를 적용한다. asset token·줄바꿈 변화에는 동일하고 실질 본문 변화에는 달라지는 테스트가 있다.
- Production 약관/개인정보 값은 읽기 전용으로만 비교했으며 실제 해시·버전은 기록하거나 출력하지 않았다. env 변경은 수행하지 않았다.
- 가격/약관 manifest/사용량/refund/legal/Site/hardening/접근성/clean URL/consumer shell/checkout handoff/static theme 및 footer·theme·asset cache 검증 모두 PASS.
- Toss TEST 실제 E2E, Linux gate, Production 배포는 NOT VERIFIED다. LIVE_MONEY=OFF 및 SUBSCRIPTION_PLAN_CHANGE_ENABLED=false를 유지한다.
