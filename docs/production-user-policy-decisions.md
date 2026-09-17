# LOTBI Production Privacy / Terms — Remaining User Policy Decisions

> 상태: `USER DECISION PACKAGE READY / EXTERNAL COUNSEL OPTIONAL / DO NOT PUBLISH`
>
> 기준일: 2026-09-17 (Asia/Seoul)

이 문서는 Production Social Login 준비를 위해 **회사/제품 소유자가 직접 선택해야 하는 정책만** 남긴다.

외부 법률전문가 검토는 권장되는 risk review이며 Social Login Production 준비의 필수 인증 gate가 아니다.

이미 확정된 기술/제품 사실(FREE 월 3개 성공 작업, Social Login 최소 data, Passkey/session/consent/deletion contract 등)은 다시 사용자 결정으로 돌리지 않는다.

---

## D1. 만 14세 미만 가입 정책 — SOCIAL LOGIN PUBLISH BEFORE-ACTIVATION DECISION

### 선택지 A — v1 만 14세 미만 가입 미지원 **[추천 기본안]**

- Signup에서 `만 14세 이상입니다` 확인을 필수로 둔다.
- 만 14세 미만이라고 확인되는 경우 계정 생성/Social Signup을 진행하지 않는다.
- 생년월일 전체를 기본 계정정보로 추가 수집하지 않고 최소 age confirmation 방식으로 시작한다.
- App/Web 동일 정책을 사용한다.

**장점**

- 현재 존재하지 않는 법정대리인 동의/확인 workflow를 새로 만들지 않고 v1을 단순화한다.
- 개인정보 최소수집 원칙과 잘 맞는다.
- Social Login/Passkey/Account lifecycle을 먼저 안정화할 수 있다.

**주의점**

- 단순 self-confirmation이 모든 상황에서 강한 연령확인 수단이라는 뜻은 아니다.
- 서비스가 실제로 만 14세 미만 이용을 인지하는 경우 이를 무시해서는 안 된다.

### 선택지 B — 만 14세 미만 가입 허용

- 법정대리인 동의 수집·확인, 아동용 명확한 고지, consent evidence, 철회/권리행사 flow를 별도로 구현해야 한다.

**장점**: 이용대상 확대.

**단점**: v1 Social Signup 구현·심사·Privacy 복잡도가 크게 증가한다.

### 현재 추천

`A — v1 만 14세 미만 가입 미지원`

공식 근거: 개인정보 보호법 제22조의2는 만 14세 미만 아동의 개인정보 처리에 동의가 필요한 경우 법정대리인 동의 및 확인을 요구한다.

---

## D2. 개인정보 보호책임자/담당 경로 — PRIVACY PUBLISH DECISION

현재 공개 확인값:

- 회사: 유한회사 알에이디홀딩스
- 대표자: 전선혜
- 이메일: `developer@lotbiai.com`
- 대표전화: `063-237-0930`

개인정보 보호법 제30조는 처리방침에 개인정보 보호책임자의 성명 **또는** 개인정보 보호업무/고충처리 부서의 명칭과 연락처를 포함하도록 한다. 제31조와 시행령은 소상공인 예외의 경우 별도 CPO를 지정하지 않을 수 있고 그 경우 대표자가 CPO가 되는 구조를 둔다.

### 선택지 A — 대표자 전선혜를 개인정보 보호책임자로 명시 **[추천 기본안]**

Production Privacy 표기:

- 개인정보 보호책임자: 전선혜
- 개인정보 문의 이메일: `developer@lotbiai.com`
- 대표전화: `063-237-0930`

**장점**

- 소상공인 예외 해당 여부를 전제로 하지 않고 책임창구를 명확히 공개할 수 있다.
- 이미 공개된 대표자·회사 연락처를 사용한다.

**단점**

- 회사 내부에서 실제 책임업무를 대표자가 맡는 것으로 운영해야 한다.

### 선택지 B — 별도 담당자/담당부서 지정

회사가 실제 담당자를 정한 뒤 해당 성명 또는 공식 부서명과 연락처를 Privacy에 반영한다.

### 현재 추천

`A — 대표자 전선혜를 개인정보 보호책임자로 지정/공개`

---

## D3. Provider unlink 시 remote revoke 정책 — PROVIDER-SPECIFIC ACTIVATION DECISION

이 결정은 **Google Social Login 기본 Privacy/Terms 게시 자체를 모두 막는 공통 gate는 아니다.** Kakao/NAVER/Apple 각 Provider activation 전에 해당 Provider 기술 blocker와 함께 닫는다.

### 선택지 A — 사용자 명시적 unlink/account deletion 시 Provider remote revoke 수행 **[추천 기본안]**

- Kakao: Unlink API + webhook reconciliation
- NAVER: token revocation + disconnect notification handling
- Apple: revocation material을 보유한 뒤 `/auth/revoke` + S2S reconciliation
- Google: durable authorization/token이 실제 존재하는 경우 해당 grant/token revoke를 provider contract에 맞춰 수행; openid-only current contract에서 불필요한 token 보존은 하지 않음

**장점**

- 사용자의 `연결 해제` 의도를 Provider authorization 관계까지 일관되게 반영한다.
- Kakao/Apple 등 공식 lifecycle 요구와 가장 자연스럽게 정렬된다.

**단점**

- Apple 등은 durable revocation material과 retry/idempotency 구현이 필요하다.

### 선택지 B — LOTBI unlink는 local-only, remote revoke는 account deletion에서만

**장점**: 재연결이 단순할 수 있음.

**단점**: Provider의 unlink 의미와 사용자의 기대가 어긋날 수 있고 Kakao 등 Provider별 요구에 맞지 않을 수 있음.

### 현재 추천

`A — explicit unlink/account deletion 모두 remote revoke, Provider별 official contract 적용`

현재 Kakao/NAVER/Apple 기술 blocker가 있으므로 승인하더라도 구현 GREEN 전 활성화하지 않는다.

---

## D4. LOTBI Plus 해지 효력 — PAID SERVICE ONLY / NOT SOCIAL LOGIN HARD BLOCKER

Plus 구매기능을 Production에 열기 전 확정한다. 무료 Social Login 공개의 hard blocker는 아니다.

### 선택지 A — 해지 신청 후 현재 결제기간 종료까지 entitlement 유지 **[추천 기본안]**

- 자동갱신만 중단
- 이미 결제한 기간이 끝날 때 Plus 종료
- Store/Web 모두 가능한 범위에서 같은 사용자 기대를 유지

**장점**: 일반적인 정기구독 UX와 맞고 갑작스러운 기능 상실을 줄인다.

### 선택지 B — 해지 즉시 entitlement 종료

별도 환불/부분환불 정책과 강하게 결합되므로 복잡도가 크다.

### 현재 추천

`A — current paid period end`

최종 환불·청약철회 예외는 Plus 결제 활성화 전에 채널별 추가조건으로 확정한다.

---

## D5. LOTBI Plus 결제 실패 grace — PAID SERVICE ONLY / NOT SOCIAL LOGIN HARD BLOCKER

### 선택지 A — Store/PG authoritative billing state에 따른 제한적 grace **[추천 기본안]**

- Apple/Google Store의 grace/account-hold 상태는 Store authoritative event를 따른다.
- Web Toss는 성공한 갱신 결제가 없으면 새 결제기간 entitlement를 임의로 영구 연장하지 않는다.
- 짧은 retry/reconciliation 동안 중복 청구나 즉시 영구박탈을 피하도록 상태를 분리한다.

### 선택지 B — 결제 실패 즉시 Plus 종료

단순하지만 일시적 카드/네트워크 오류에도 사용자 경험이 거칠다.

### 현재 추천

`A — channel-authoritative limited grace`

세부 일수는 실제 Store/PG 계약과 entitlement implementation에서 확정한다.

---

# Social Login publish에 지금 필요한 사용자 선택

**즉시 필요한 선택은 D1 + D2 두 개다.**

D3는 Provider별 lifecycle implementation 전에 필요하지만 Google Privacy/Terms 준비 전체를 막지 않는다.

D4/D5는 LOTBI Plus Production 결제를 실제 활성화하기 전에 필요하며 무료 Social Login publication의 hard blocker가 아니다.

## Recommended approval bundle

1. `D1 = A` — v1 만 14세 미만 가입 미지원
2. `D2 = A` — 개인정보 보호책임자 전선혜 / developer@lotbiai.com / 063-237-0930
3. `D3 = A` — explicit unlink/account deletion 시 Provider remote revoke (각 Provider 기술 GREEN 후)
4. `D4 = A` — Plus 해지 시 현재 결제기간 종료까지 entitlement 유지
5. `D5 = A` — channel-authoritative limited grace

사용자가 위 bundle을 승인하면 D1/D2는 즉시 Production Privacy/Terms finalization handoff에 반영할 수 있다. D3~D5는 respective implementation/paid-service activation gate에 기록한다.