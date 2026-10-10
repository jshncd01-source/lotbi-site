# CLAUDE.md — LOTBI Claude Code 운영 진입점

이 저장소에서 작업하는 Claude Code는 먼저 [LOTBI 공통 개발 운영 기준 V1](docs/operations/LOTBI_ENGINEERING_BASELINE.md)을 전체 읽고 따른다.

## 역할에 따른 실행

- 기존 개발방: 이미 맡은 작업만 마무리하고, 기존 branch·owner를 재사용한다. 같은 기능을 새 branch에서 중복 구현하지 않는다.
- 배포총괄: feature READY를 받은 뒤 Ncloud latest main, exact HEAD, trusted gate, CI, mergeability, 배포 의존성을 fresh하게 검증한다. 정상 main 병합과 Production 배포는 실제 권한과 승인 범위가 있을 때만 수행한다.
- READY나 과거 성공 보고는 병합·배포의 자동 승인이 아니다.

## 공통 보호 규칙

- Ncloud Git이 Source of Truth다.
- `main` 직접 수정·push, rebase, reset, force-push, history rewrite를 하지 않는다.
- 기존 기능·보안 경계·테스트를 약화하지 않는다.
- 운영 DB 파괴적 변경, Secret 생성·변경, LIVE MONEY, 신규 유료 인프라, 소셜 제공자 공개 활성화, Production 사용자 데이터 삭제는 각각 별도 명시 승인이 필요하다.
- GitHub, Render 잔여 설정, 오래된 clone·SHA, 배포 산출물을 현행 Source of Truth로 승격하지 않는다.
- 상태는 `IMPLEMENTED`, `CI_PASS`, `MERGED`, `DEPLOYED`, `ACTUAL_E2E_PASS`, `NOT_VERIFIED` 등으로 분리한다.

## 재읽기

새 작업, 대화 압축 후 재개, 인수인계, scope/owner 변경, trusted gate 시작, main drift, merge·배포 직전, 지침 충돌 발견 시 공통 기준을 다시 읽는다.

저장소별 기존 규칙이 더 엄격하면 그 규칙을 보존한다. 충돌이 있으면 임의로 완화하지 말고 MASTER에게 보고한다.
