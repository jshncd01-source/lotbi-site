# AGENTS.md — LOTBI Codex 운영 진입점

이 저장소에서 작업하는 Codex는 먼저 [LOTBI 공통 개발 운영 기준 V1](docs/operations/LOTBI_ENGINEERING_BASELINE.md)을 전체 읽고 따른다.

## 필수 실행 규칙

- Ncloud Git을 Source of Truth로 사용한다.
- 매 작업 시작·재개 시 원격 `main`, 기존 branch/worktree/owner, 미커밋 변경, 동일 기능 작업을 fresh하게 확인한다.
- 최신 Ncloud `main`에서 독립 feature branch를 만들고, 구현 → 테스트 → Ncloud Push → 원격 readback → READY 순서로 진행한다.
- `main` 직접 수정·push, rebase, reset, force-push, history rewrite, Production 배포를 하지 않는다.
- 기존 기능과 테스트를 약화하지 않으며, 다른 owner의 작업이나 중복 clone을 삭제·초기화·덮어쓰지 않는다.
- 운영 DB 파괴적 변경, Secret 생성·변경, LIVE MONEY, 신규 유료 인프라, 소셜 제공자 공개 활성화, Production 사용자 데이터 삭제는 각각 별도 명시 승인이 필요하다.
- 완료 상태와 `NOT_VERIFIED`를 분리한다. 이번 세션의 검증 실패로 기존 완료분을 취소하거나 `승인 불가`로 확대 해석하지 않는다.
- Codex의 종료점은 feature branch Push와 READY다. main 병합과 Production 배포는 Claude 배포총괄에 넘긴다.

## 재읽기

새 작업, 대화 압축 후 재개, scope/owner 변경, commit·Push·READY 직전, main drift 또는 지침 충돌 발견 시 공통 기준을 다시 읽는다.

저장소별 기존 규칙이 더 엄격하면 그 규칙을 보존한다. 충돌이 있으면 임의로 완화하지 말고 근거와 함께 보고한다.
