# LOTBI Social Signup Consent Manifest — Production Handoff

> 상태: `IMPLEMENTATION HANDOFF READY / VALUES NOT AUTHORITATIVE / DO NOT DEPLOY`
>
> 기준일: 2026-09-17 (Asia/Seoul)
>
> Core Social review: `b555420b8d75c9e241a6cd9bd534f205499a87d8`
>
> Account Social review: `5eadea164d559a4f3c45dfca18d6c2acf95a40c0`

## 1. Canonical consent contract

Social Signup에서 필요한 LOTBI 자체 필수 동의는 정확히 두 개다.

1. `TERMS_OF_SERVICE`
2. `PRIVACY_POLICY`

각 문서는 별도로 다음 세 값을 가진다.

- `document_version`
- `document_sha256`
- `document_uri`

별도의 `consent_manifest_version` 필드는 만들지 않는다.

Core는 두 문서가 모두 존재하고 metadata가 유효할 때만 Social Signup legal manifest를 사용한다. 누락/형식오류는 fail-closed다.

## 2. Canonical Production URI

현재 공개 URL을 유지한다.

| Consent key | Canonical URI |
|---|---|
| `TERMS_OF_SERVICE` | `https://lotbiai.com/terms.html` |
| `PRIVACY_POLICY` | `https://lotbiai.com/privacy.html` |

Provider Console, Account Web, Core manifest가 서로 다른 약관/Privacy URL을 사용하지 않는다.

## 3. Version naming rule

권장 Production naming rule:

- Privacy: `LOTBI_PRIVACY_<YYYY-MM-DD>_R<n>`
- Terms: `LOTBI_TERMS_<YYYY-MM-DD>_R<n>`

`YYYY-MM-DD`는 실제 공개/시행일을 사용한다. `R<n>`은 동일 시행일에 내용이 수정되어 consent evidence를 구분해야 할 때 증가시킨다.

현재 내부 후보 식별자만 사용할 경우:

- `LOTBI_PRIVACY_CANDIDATE_2026-09-17_R1`
- `LOTBI_TERMS_CANDIDATE_2026-09-17_R1`

이 두 candidate 이름은 Production authoritative version이 아니다. 법률검토 및 최종 HTML 확정 후 실제 시행일로 새 version을 만든다.

## 4. SHA-256 authority rule

Production `document_sha256`은 **법률검토가 끝난 최종 HTML의 정확한 UTF-8 file bytes**를 기준으로 산출한다.

초안 Markdown, 검토 중 HTML, 브라우저 화면의 추출 텍스트 또는 사람이 복사한 본문 해시는 authoritative hash로 사용하지 않는다.

권장 절차:

1. Site review branch에서 `privacy.html` / `terms.html` 최종 내용을 고정한다.
2. 실제 배포할 파일을 추가 수정 없이 freeze한다.
3. exact bytes로 SHA-256을 계산한다.
4. 같은 commit을 Production에 배포한다.
5. Production HTTPS URL에서 응답 본문을 다시 받아 source bytes와 동등한 문서인지 검증한다.
6. 일치가 확인된 hash만 Core Production manifest 값으로 사용한다.
7. 이후 법률문서 HTML bytes가 바뀌면 새 document version/hash를 발급한다.

예시 명령:

```bash
sha256sum privacy.html terms.html
```

또는 Python:

```bash
python - <<'PY'
from hashlib import sha256
for path in ('privacy.html', 'terms.html'):
    with open(path, 'rb') as f:
        print(path, sha256(f.read()).hexdigest())
PY
```

현재 후보문은 아직 Production HTML이 아니므로 authoritative SHA-256은 **산출하지 않는다**.

Status: `SHA-256 TECHNICALLY CALCULABLE / AUTHORITATIVE VALUE PENDING FINAL HTML`.

## 5. Core environment contract

Core reviewed implementation이 읽는 환경변수 이름은 다음과 같다.

### Terms

- `LOTBI_SOCIAL_TERMS_VERSION`
- `LOTBI_SOCIAL_TERMS_SHA256`
- `LOTBI_SOCIAL_TERMS_URI`

### Privacy

- `LOTBI_SOCIAL_PRIVACY_VERSION`
- `LOTBI_SOCIAL_PRIVACY_SHA256`
- `LOTBI_SOCIAL_PRIVACY_URI`

Readiness 방에서는 값을 Production 환경에 넣지 않는다.

## 6. Expected manifest payload shape

법률검토·Site 배포·hash 검증이 모두 끝난 이후에만 아래 shape를 실제 값으로 채운다.

```json
{
  "required": true,
  "documents": [
    {
      "consent_key": "PRIVACY_POLICY",
      "document_version": "<FINAL_PRIVACY_VERSION>",
      "document_sha256": "<FINAL_PRIVACY_SHA256>",
      "document_uri": "https://lotbiai.com/privacy.html"
    },
    {
      "consent_key": "TERMS_OF_SERVICE",
      "document_version": "<FINAL_TERMS_VERSION>",
      "document_sha256": "<FINAL_TERMS_SHA256>",
      "document_uri": "https://lotbiai.com/terms.html"
    }
  ]
}
```

Placeholder는 실제 Production env 값이 아니다.

## 7. Core validation contract

Core Social Signup complete는 정확히 두 consent를 요구하고 다음을 검증한다.

- consent key가 `PRIVACY_POLICY` / `TERMS_OF_SERVICE`인지
- 두 key가 모두 존재하는지
- `decision == ACCEPTED`
- `required == true`
- browser/account가 제출한 `document_version`이 server manifest와 같은지
- SHA-256이 server manifest와 같은지
- URI가 server manifest와 같은지
- locale이 유효한지

검증이 끝난 evidence는 `UserConsentRecord`에 `source=SOCIAL_SIGNUP`으로 저장된다.

Browser가 version/hash/URI를 임의로 정하는 구조로 바꾸지 않는다.

## 8. Account Web contract

Account Web은:

1. Social Provider verification 완료 후 `/api/auth/providers/signup/context`에서 Core manifest를 읽는다.
2. 사용자에게 `이용약관 동의 (필수)`와 `개인정보 처리방침 동의 (필수)`를 각각 보여준다.
3. 두 문서가 모두 accepted되지 않으면 Social Signup을 진행하지 않는다.
4. `/api/auth/providers/signup/complete` BFF가 다시 Core manifest를 읽어 accepted key set을 검증한다.
5. Core로 보낼 때 server-returned version/hash/URI를 사용하고 `decision=ACCEPTED`, `required=true`로 전달한다.

현재 계약에서 별도 선택 Social Signup consent는 없다. 향후 선택동의를 추가할 경우 현재 필수 2개와 섞지 않고 별도 계약/법률 검토를 거쳐야 한다.

## 9. Production deployment order

Provider Console보다 먼저 아래 순서를 지킨다.

1. Privacy legal review 완료
2. Terms legal review 완료
3. Site review branch에 최종 HTML 반영
4. Site tests/visual/public-link validation
5. 사용자 승인 후 Production Privacy/Terms publish
6. 실제 Production 응답 검증
7. final version naming 확정
8. final HTML SHA-256 검증
9. 사용자 승인 후 Core Production manifest env 설정
10. `GET /v2/sessions/providers/signup/consents`가 정확한 두 문서를 반환하는지 검증
11. `GET /v2/sessions/providers/readiness`에서 `signup_consent_configured=true` 확인
12. Production provider activation은 계속 false 유지
13. Account Production Social Signup UI가 manifest를 정확히 표시/검증하는지 확인
14. 그 이후 Provider-specific real E2E 진행

Manifest를 설치하는 것과 `LOTBI_SOCIAL_<PROVIDER>_PRODUCTION_ACTIVATION=true`는 별도 결정이다. Consent manifest 설정만으로 Provider를 자동 활성화하지 않는다.

## 10. Stop conditions

다음 중 하나라도 해당하면 manifest를 Production authoritative로 만들지 않는다.

- Privacy 또는 Terms에 `LEGAL_REVIEW_REQUIRED`가 남아 있음
- 최종 HTML이 freeze되지 않음
- public URI가 비로그인 HTTPS로 열리지 않음
- source hash와 배포문서 검증이 맞지 않음
- Core endpoint가 두 문서를 정확히 반환하지 않음
- Account Web이 두 필수동의를 모두 요구하지 않음

현재 상태:

`PRODUCTION SOCIAL SIGNUP CONSENT MANIFEST = PREPARED FOR HANDOFF / NOT DEPLOYED / NOT AUTHORITATIVE`.