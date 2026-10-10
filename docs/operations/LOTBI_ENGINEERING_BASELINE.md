# LOTBI 공통 개발 운영 기준 V1

- TASK_ID: `LOTBI_SHARED_ENGINEERING_BASELINE_V1`
- 기준일: 2026-10-10 (Asia/Seoul)
- 적용 대상: `lotbi-core`, `lotbi-site`, `lotbi-web`, `lotbi-admin`, `lotbi-app`
- 적용 도구: Codex, Claude Code, Claude 기존 개발방, Claude 배포총괄
- 목적: 저장소·도구가 달라도 같은 Git 보호 규칙, 승인 게이트, 상태 표현을 사용한다.

## 1. 권위와 적용 순서

1. Ncloud Git이 코드의 Source of Truth다.
2. 저장소의 최신 Ncloud `main`을 기준으로만 새 작업을 시작한다.
3. 이 문서는 공통 최소 기준이다. 저장소에 이미 존재하는 보안·결제·개인정보·테스트 규칙이 더 엄격하면 더 엄격한 규칙을 유지한다.
4. `AGENTS.md`와 `CLAUDE.md`는 이 문서를 요약·참조하는 도구별 진입점이다. 공통 정책을 서로 다르게 복제하거나 완화하지 않는다.
5. 지침 충돌이 있으면 작업을 확대 해석하지 말고, 충돌 위치와 더 엄격한 후보 규칙을 보고한 뒤 owner 결정을 기다린다.
6. GitHub, 과거 Render 설정, 배포 산출물, 오래된 clone 또는 과거 SHA를 현행 기준으로 승격하지 않는다.

## 2. 역할 분담

| 주체 | 책임 | 금지 또는 경계 |
|---|---|---|
| Codex | 신규 개발, 테스트, 증거 수집, 독립 feature branch Push, READY 작성 | `main` 병합, Production 배포, 승인 게이트 우회 |
| Claude 기존 개발방 | 이미 맡은 진행 중 작업의 마무리와 인수인계 | 같은 기능을 새 branch에서 중복 구현 |
| Claude 배포총괄 | trusted gate, 최신 main 재검증, 정상 병합, Production 배포, 실제 배포 확인 | READY만으로 무검증 배포, 승인 대상의 임의 실행 |
| 사용자/MASTER | 범위·우선순위 결정과 별도 승인 대상 승인 | 승인은 항목별이며 한 승인이 다른 승인으로 확대되지 않음 |

Claude 배포총괄의 역할 정의는 병합·배포를 자동 승인하지 않는다. 실제 작업 명령과 필요한 승인 범위를 별도로 확인해야 한다.

## 3. 표준 개발 흐름

1. 원격 URL이 Ncloud Git인지 확인한다.
2. 원격 `main` SHA를 fresh하게 읽고 기록한다.
3. 기존 작업방, active branch, worktree, owner, 원격 feature branch, 미커밋 변경을 확인한다.
4. 기존 owner가 있으면 재사용하거나 인수인계를 받고, 중복 개발하지 않는다.
5. 최신 Ncloud `main`에서 독립 feature branch와 격리 worktree를 만든다.
6. 기존 기능·보안 경계·테스트를 보존한 채 최소 범위로 구현한다.
7. 관련 테스트와 회귀 테스트를 실행한다. 테스트를 삭제·skip·완화해 통과시키지 않는다.
8. exact HEAD, main drift, 테스트 결과, 미검증 항목을 기록한다.
9. Ncloud feature branch에 Push하고 원격 readback SHA가 로컬 exact HEAD와 같은지 확인한다.
10. READY 문서를 작성하고 STOP한다.
11. Claude 배포총괄이 trusted gate와 최신 main을 다시 확인한 뒤에만 정상 병합·배포를 판단한다.

### Git 보호 규칙

- Ncloud `main` 직접 수정·직접 push 금지
- rebase, reset, force-push, history rewrite 금지
- stale branch blind merge 금지
- 같은 exact HEAD에 의미 없는 CI 반복 금지
- 추측 수정, CI 통과용 empty commit 금지
- 기존 미커밋 파일, 다른 owner의 worktree, 중복 clone 삭제·초기화·덮어쓰기 금지
- main drift는 정상 merge로 통합하고 충돌·테스트를 다시 검증한다.
- web 배포 산출물, tar/zip/export 폴더를 Site 원본 저장소로 취급하지 않는다.

## 4. 보존 원칙

- 기존 기능과 사용자 흐름을 의도 없이 제거하지 않는다.
- 기존 보안·권한·승인·감사·idempotency·reconciliation 경계를 약화하지 않는다.
- 기존 테스트를 삭제하거나 assertion을 느슨하게 만들어 GREEN을 만들지 않는다.
- 기존 `AGENTS.md`, `CLAUDE.md`, 운영 문서는 무조건 덮어쓰지 않는다. 내용을 읽고 참조·병합하며, 충돌은 기록한다.
- 기존 작업 branch의 변경을 새 branch로 몰래 복사하지 않는다.
- 완료된 작업은 보존하며 fresh 검증 실패를 완료분의 취소로 표현하지 않는다.

## 5. 별도 승인 게이트

다음은 기능 개발 또는 READY 지시만으로 승인되지 않는다.

| 항목 | 요구 사항 |
|---|---|
| 운영 DB 파괴적 변경 | 대상·영향·복구 계획을 제시하고 명시 승인 |
| Secret·credential·signing key 신규 생성 또는 변경 | 변수명·위치·영향을 제시하고 명시 승인. 실제 값은 문서·로그·대화에 기록 금지 |
| LIVE MONEY | 1원 테스트를 포함한 결제·청구·주문·송금·환불·자동 갱신을 별도 승인 |
| 신규 서버·유료 인프라 | 비용·목적·대안을 제시하고 별도 승인 |
| 소셜 제공자 공개 활성화 | 제공자와 Desktop Web/Mobile Web/Android Native/iOS Native 범위를 분리해 승인 |
| Production 사용자 데이터 삭제 | 정확한 대상·범위·복구 가능성을 제시하고 명시 승인 |
| `main` 병합·Production 배포 | Claude 배포총괄의 trusted gate와 실제 배포 권한 필요 |

승인 정보가 없거나 모호하면 fail-closed로 유지한다. 환경변수 연결 승인, 소셜 공개 승인, LIVE MONEY 승인, 스토어 공개 승인은 서로 독립이다.

## 6. 상태 표현

다음 상태를 구분한다.

- `REQUESTED`
- `COMMAND_ISSUED`
- `IMPLEMENTED`
- `CI_PASS`
- `MERGED`
- `DEPLOYED`
- `ACTUAL_E2E_PASS`
- `NOT_TESTED`
- `NOT_VERIFIED`
- `LAST_REPORTED`
- `BLOCKED`
- `PAUSED`
- `READY`

HTTP 200은 전체 사용자 목적 완료가 아니다. CI PASS는 Production 성공이 아니다. Web 결과는 Native 결과가 아니다. 보고값은 실측값이 아니며, 근거 없는 진행률을 만들지 않는다.

## 7. Ncloud 기준과 인프라 사실

### 이 작업에서 실제 검증한 Git 사실

2026-10-10에 기존 승인된 로컬 Git 설정을 사용해 Ncloud 원격의 `refs/heads/main`을 읽었다.

| 저장소 | Ncloud main SHA | 상태 |
|---|---|---|
| `lotbi-core` | `0bc8bb6a1dbef2db7f3679de98634a3baefa15c2` | `VERIFIED_GIT` |
| `lotbi-site` | `7b55560073e4c6e66f8f6503e96e32aa639ee984` | `VERIFIED_GIT` |
| `lotbi-web` | `96d331bbb062431d27b78f0ea8d4a064d9bcaf5f` | `VERIFIED_GIT` |
| `lotbi-admin` | `b1bac582ce822b2dc51ab89c6c9fe07bee3eaae4` | `VERIFIED_GIT` |
| `lotbi-app` | `78414e36362dccdc5698b55d418d274c8c7e5bab` | `VERIFIED_GIT` |

이 SHA는 이 문서 작성 시점의 증거다. 이후 작업에서는 반드시 원격 `main`을 다시 읽는다.

### 운영 보고값과 미검증 항목

| 항목 | 값 | 증거 상태 |
|---|---|---|
| APP-01 | 2 vCPU / RAM 8GB / SSD 50GB | `LAST_REPORTED` |
| Core 운영 위치 | Ncloud Production | `LAST_REPORTED` |
| Site 운영 위치 | Ncloud Production | `LAST_REPORTED` |
| Database | Ncloud Cloud DB for PostgreSQL HA | `LAST_REPORTED` |
| Network | Ncloud ALB | `LAST_REPORTED` |
| API 도메인 | `api.lotbiai.com` | `LAST_REPORTED` |
| Site 도메인 | `lotbiai.com` | `LAST_REPORTED` |
| APP-02 구축·가동 | 확인 필요 | `UNVERIFIED` |
| Render 잔여 의존성 | 독립 운영 전환 과정의 잔여 설정·하드코딩 확인 필요 | `UNVERIFIED` |
| Account 운영 위치 | 실제 서비스 기준 재확인 필요 | `UNVERIFIED` |
| Admin 운영 위치 | 실제 서비스 기준 재확인 필요 | `UNVERIFIED` |

이 표는 Ncloud 콘솔 실시간 검증을 대신하지 않는다. APP-02 또는 기타 HA 구성을 존재한다고 가정하지 않으며, 과거 Render 설정이나 이전 하드웨어 사양을 현행 운영환경으로 단정하지 않는다.

## 8. READY 판정

feature branch READY에는 최소한 다음을 포함한다.

- 목적과 범위
- 저장소, branch, base Ncloud main SHA, exact HEAD
- 기존 owner·중복·미커밋 변경 확인 결과
- 변경 파일
- 실행한 테스트와 결과
- main drift와 mergeability
- Ncloud feature Push 및 원격 readback SHA
- 기존 기능·규칙 보존 여부
- Production/DB/Secret/LIVE MONEY/유료 인프라 변경 여부
- `NOT_TESTED`, `NOT_VERIFIED`, `BLOCKED`
- 필요한 사용자 승인
- 다음 owner

`READY_FOR_DEPLOY=YES`는 feature가 배포됐다는 뜻이 아니다. trusted gate, 정상 main 병합, Production 배포와 실제 E2E는 Claude 배포총괄의 후속 단계다.

## 9. 규칙 재읽기 시점

각 개발방은 다음 시점에 이 문서와 자기 도구의 규칙 파일을 다시 읽는다.

- 새 작업을 시작할 때
- 대화 압축·재개·인수인계 직후
- 작업 범위, owner, 인프라 기준이 바뀔 때
- commit 또는 Push 직전
- 원격 main drift가 발견됐을 때
- READY 작성 직전
- Claude 배포총괄로 넘기기 직전
- 서로 다른 지침이나 오래된 운영 사실을 발견했을 때

이미 열린 모든 개발방이 자동으로 즉시 갱신된다고 가정하지 않는다. 기존 방에는 재개 시 이 문서를 다시 읽으라는 인수인계를 명시한다.
