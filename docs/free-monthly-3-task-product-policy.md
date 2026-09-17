# LOTBI FREE — MONTHLY 3-TASK AUTHORITATIVE PRODUCT POLICY

> 상태: `PRODUCT POLICY FINAL / AUTHORITATIVE / FREE_TASK_DEFINITION_AND_RESET CLOSED`
>
> 확정일: 2026-09-17 (Asia/Seoul)
>
> 범위: LOTBI FREE 이용한도 산정, reset, 차감, retry, compensation 및 사용자 표시정책
>
> 주의: 이 문서는 제품정책의 authoritative source다. 현재 Core에 해당 usage ledger/enforcement가 이미 구현되어 있다고 선언하는 문서는 아니며, 실제 구현은 owning Core/App workstream에서 이 계약에 맞춰 검증해야 한다.

## 1. FREE 기본 정책

LOTBI FREE 회원은 **매월 3개의 성공 작업**을 이용할 수 있다.

`3개 작업`은 다음을 의미하지 않는다.

- 채팅 메시지 3개
- 질문 3번
- AI Provider 호출 3번
- 내부 tool/provider 실행 3번

FREE usage는 LOTBI task outcome 기준이다.

## 2. 차감 가능한 작업

사용자가 하나의 목적을 요청하고 LOTBI가 실제 사용할 수 있는 최종 사용자 결과를 **성공적으로 전달한 경우에만** 1개 작업을 차감한다.

차감 trigger는 Core 구현에서 다음과 같은 authoritative success outcome에 대응해야 한다.

- `USER_RESULT_DELIVERED`
- `SUCCESS`
- `COMPLETED`
- 또는 당시 Core에서 위 의미와 동등하게 정의된 authoritative final-success contract

단순히 요청이 접수되었거나 내부 처리가 시작되었다는 이유로 차감하지 않는다.

## 3. 차감 금지 조건

다음 자체는 FREE usage 차감 사유가 아니다.

- user request received
- AI Provider call started
- external provider call started
- internal processing started
- retry/reconciliation started
- partial/intermediate response generated

최종 사용자 결과가 성공적으로 전달되지 않았다면 FREE 작업 수를 줄이지 않는다.

## 4. 동일 작업 내부 대화

하나의 사용자 목적을 완성하기 위한 다음 상호작용은 별도 작업으로 계산하지 않는다.

- 조건 확인
- 추가 질문
- 지역 확인
- 예산 확인
- 인원 확인
- 날짜 확인
- 옵션 선택
- 동일 task 내부 보완 대화

예:

1. 사용자: `서울에서 가족끼리 갈 식당 찾아줘`
2. LOTBI: `몇 명인가요?`
3. 사용자: `4명이야`
4. LOTBI: `예산은 어느 정도인가요?`
5. 사용자: `10만원 정도`
6. LOTBI: 최종 후보를 성공적으로 전달

하나의 task 목적을 완성한 위 전체 흐름의 차감은 **1회**다.

## 5. 새로운 목적은 새 작업

최종 결과가 완료된 뒤 사용자가 명백히 새로운 목적을 시작하면 새로운 task로 계산한다.

예:

- 식당 찾기 완료 후 호텔 찾기 요청 → 새 작업
- 서울 식당 검색 완료 후 전혀 다른 지역·조건으로 독립적인 새 검색/결과 생성 요청 → 현재 task 계약상 독립 목적이면 새 작업

경계가 애매한 경우 사용자를 불리하게 만들기 위해 하나의 자연스러운 목적을 과도하게 여러 task로 분할하지 않는다.

## 6. LOCAL deterministic 대화

`AI_LEVEL_0 / LOCAL deterministic`으로 처리 가능한 단순 대화는 FREE 작업을 차감하지 않는다.

예:

- 안녕 / 안녕하세요
- 고마워 / 감사합니다
- 도와줘
- LOTBI가 뭐야?
- 오늘 뭐 도와줄 수 있어?
- 지금 몇 시야?
- 오늘 날짜
- 오늘 무슨 요일이야?

정책 결과:

- `LOTBI task usage = 0`
- `AI provider call = 0`
- `external effect = NONE`

단, 실제 runtime router가 LOCAL로 처리할 수 있는 범위는 구현 workstream에서 deterministic contract로 검증한다.

## 7. 실패·취소·미완료 작업

다음은 FREE usage를 차감하지 않는다.

- 서버 오류
- HTTP 5xx
- AI provider unavailable
- OpenAI/Gemini/Claude 등 AI Provider 오류
- timeout
- network failure
- validation failure
- authentication failure
- payment failure
- internal retry
- external provider retry
- 사용자 결과 미전달
- 작업 완료 전 사용자 취소
- 작업 중단
- 시스템 장애
- LOTBI 내부 복구/reconciliation

핵심 원칙:

`NO SUCCESSFUL USER RESULT DELIVERED = NO FREE TASK CHARGE`

## 8. retry / duplicate 중복차감 금지

같은 `task_id` 또는 당시 Core의 동등한 usage idempotency boundary 안에서는 다음이 반복되어도 동일 성공 작업을 여러 번 차감하지 않는다.

- retry
- duplicate request
- network retry
- provider retry
- callback retry
- client retry
- reconciliation retry

동일 성공 작업은 **최대 1회** 차감한다.

Core 구현은 usage charge 자체에도 idempotency를 적용해야 한다.

## 9. 월 reset

FREE 월 3개 작업은 모든 한국 사용자-facing FREE usage period에 대해 **calendar month** 기준으로 운영한다.

Reset:

- 매월 1일
- `00:00`
- `Asia/Seoul`
- KST 기준

회원 가입일을 기준으로 하는 rolling month는 사용하지 않는다.

## 10. 이월 없음

미사용 FREE 작업은 다음 달로 이월되지 않는다.

예:

- 9월에 1개 사용 → 2개 남음
- 10월 1일 00:00 KST → 새 월 allowance는 3개
- 5개로 누적되지 않음

`carry-over = NONE`

## 11. FREE와 LOTBI Plus 분리

현재 제품 기준:

- FREE: 월 3개 성공 작업
- LOTBI Plus: 월 9,900원

LOTBI Plus를 `무제한 일반 AI 사용권`, `무제한 ChatGPT 대체 이용권`처럼 문서화하지 않는다.

LOTBI는 LOTBI 서비스 범위의 작업을 제공하는 서비스이며 일반 ChatGPT 사용량 계약과 동일하지 않다.

Plus의 구체적 사용한도·자동갱신·해지·환불·청약철회·Store entitlement는 별도 제품/법률계약을 따른다.

## 12. task usage와 AI Provider 호출 분리

다음은 서로 다른 계량축이다.

`LOTBI task usage != AI provider call`

예:

- LOCAL greeting → task usage 0 / AI call 0
- 검색·구조화 성공 task → task usage 1 / AI call은 router 정책에 따른 0 또는 필요 최소횟수
- internal provider retry → task usage 추가 차감 없음

비용제어·router/provider selection은 사용자의 FREE task 차감계약과 분리해서 설계한다.

## 13. compensation / credit adjustment

정상 사용자에게 잘못 차감되었거나 서비스 장애 등에 대한 보상이 필요한 경우 기존 usage event를 삭제하거나 과거 기록을 임의 수정하지 않는다.

복구는 다음과 같은 별도 감사가능 event로 처리한다.

- compensation
- credit adjustment
- 또는 당시 Core가 제공하는 동등한 append-only/auditable adjustment

요구사항:

- 원래 usage event 보존
- adjustment 사유 기록
- 조정량 기록
- 중복 compensation 방지
- audit 가능

## 14. 사용자 UI 문구

권장 사용자-facing 표현:

- `이번 달 무료 작업 2 / 3 사용`
- `무료 작업 1회 남음`

도움말:

`하나의 작업을 완료하기 위한 추가 질문과 확인 대화는 별도 작업으로 계산되지 않습니다.`

`실패하거나 결과가 완료되지 않은 요청은 차감되지 않습니다.`

금지 표현:

- `메시지 3개`
- `AI 질문 3번`
- `AI 호출 3회`

## 15. Implementation handoff requirements

Owning Core/App workstream은 이 정책을 실제 코드로 옮길 때 최소 다음을 검증해야 한다.

1. task identity/idempotency boundary가 명시돼 있을 것
2. final-success user-result delivery 상태에서만 charge할 것
3. pre-success failure/cancel/incomplete는 no-charge일 것
4. duplicate/retry/callback/reconciliation로 duplicate charge가 발생하지 않을 것
5. KST calendar-month bucket을 사용할 것
6. carry-over를 만들지 않을 것
7. LOCAL deterministic path는 usage 0 / AI call 0일 것
8. usage ledger와 compensation adjustment가 감사 가능할 것
9. UI 표시값과 server authoritative usage가 일치할 것
10. Plus entitlement와 FREE allowance를 같은 의미로 합치지 않을 것

정책 결정 자체는 CLOSED이며, 구현 완료 여부는 해당 owning repository에서 별도 검증한다.

## 16. Final policy status

`PRODUCT_POLICY_CONFIRMATION_REQUIRED — FREE_TASK_DEFINITION_AND_RESET = CLOSED`

Authoritative product values:

- FREE = monthly 3 successful tasks
- charge = successful final user result delivered, max once per task usage idempotency boundary
- same-task clarification/confirmation = no extra charge
- LOCAL deterministic = no charge
- failure/cancel/incomplete = no charge
- retry/duplicate/reconciliation = no duplicate charge
- reset = every month on day 1 at 00:00 Asia/Seoul
- carry-over = NONE
- compensation = append-only/auditable adjustment; do not erase original usage event
