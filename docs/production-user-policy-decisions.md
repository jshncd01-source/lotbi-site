# LOTBI Production Privacy / Terms — User Policy Decisions

> 상태: `D1 APPROVED / D2 APPROVED / SOCIAL LOGIN USER POLICY GATE CLOSED`
>
> 기준일: 2026-09-17 (Asia/Seoul)
>
> 외부 법률전문가 검토: `OPTIONAL / RECOMMENDED / NOT HARD BLOCKER`

이 문서는 Production Social Login 준비에서 회사/제품 소유자가 직접 결정한 정책과, 향후 별도 기능 활성화 전에 결정할 정책을 기록한다.

이미 확정된 기술/제품 사실(FREE 월 3개 성공 작업, Social Login 최소 data, Passkey/session/consent/deletion contract 등)은 다시 사용자 결정으로 돌리지 않는다.

---

## D1. 만 14세 미만 가입 정책 — APPROVED / CLOSED

**승인값: `D1 = A`**

LOTBI v1은 만 14세 미만 이용자의 회원가입을 지원하지 않는다.

회원가입 및 Social Signup completion 전에 다음 확인을 필수로 요구한다.

`만 14세 이상입니다 (필수)`

운영 경계:

- 이 확인을 정부 신원확인 또는 법정대리인 확인절차로 표현하지 않는다.
- 생년월일 전체를 기본 계정정보로 추가 수집하는 것으로 자동 확대하지 않는다.
- 만 14세 미만 가입을 지원하는 기능은 별도 법정대리인 동의·확인 workflow가 준비되고 검증되기 전까지 활성화하지 않는다.
- App/Web의 가입정책을 동일하게 유지한다.

Status:

`D1 = APPROVED / CLOSED`

---

## D2. 개인정보 보호책임자 및 문의 경로 — APPROVED / CLOSED

**승인값: `D2 = A`**

Production 개인정보처리방침에 다음을 사용한다.

- 개인정보 보호책임자: `전선혜`
- 이메일: `developer@lotbiai.com`
- 대표전화: `063-237-0930`

이 값은 LOTBI 공식사이트에 이미 공개된 회사 대표자/연락처와 정합된다.

Status:

`D2 = APPROVED / CLOSED`

---

## D3. Provider unlink 시 remote revoke 정책 — PROVIDER-SPECIFIC ACTIVATION GATE

무료 Social Login Privacy/Terms 게시의 공통 hard blocker는 아니다. 각 Provider activation 전에 기술 blocker와 함께 확정·구현한다.

추천 기본안:

`A — 사용자의 명시적 unlink 또는 account deletion 시 Provider 공식 contract에 따라 remote revoke/unlink를 수행한다.`

- Kakao: Unlink API + webhook/reconciliation
- NAVER: token revocation + disconnect handling
- Apple: protected revocation material + `/auth/revoke` + lifecycle reconciliation
- Google: 실제 durable authorization/token이 존재하는 경우에만 공식 revoke contract 적용; openid-only 최소계약을 위해 불필요한 token을 장기보존하지 않음

Status:

`D3 = DEFERRED TO PROVIDER LIFECYCLE IMPLEMENTATION / NOT SOCIAL LOGIN LEGAL-PAGE HARD BLOCKER`

---

## D4. LOTBI Plus 해지 효력 — PAID SERVICE ONLY

추천 기본안:

`A — 해지 신청 후 현재 결제기간 종료까지 entitlement 유지, 자동갱신 중단.`

최종 환불·청약철회 예외와 채널별 동작은 Plus Production billing 활성화 전에 확정한다.

Status:

`D4 = DEFERRED TO PLUS LIVE-BILLING GATE`

---

## D5. LOTBI Plus 결제 실패 grace — PAID SERVICE ONLY

추천 기본안:

`A — Apple/Google/Toss의 authoritative billing state에 따른 제한적 grace/retry/reconciliation.`

세부 일수와 entitlement 전이는 실제 Store/PG 계약과 구현을 기준으로 Plus Production billing 활성화 전에 확정한다.

Status:

`D5 = DEFERRED TO PLUS LIVE-BILLING GATE`

---

# Current Social Login policy gate

- `D1 = APPROVED / CLOSED`
- `D2 = APPROVED / CLOSED`
- FREE task policy = `CLOSED`
- external counsel = `OPTIONAL / RECOMMENDED`

따라서 무료 Social Login Privacy/Terms를 준비하기 위한 **사용자 정책결정 gate는 CLOSED**다.

남은 gate는 실제 Site review/publish, exact legal document version/hash/URI, Core Production consent manifest, Account Signup age confirmation implementation/verification 및 Provider별 기술 blocker다.