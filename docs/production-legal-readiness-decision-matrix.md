# PRODUCTION SOCIAL SIGNUP LEGAL READINESS — DECISION MATRIX

> 기준일: 2026-09-17 (Asia/Seoul)
>
> 상태: `COUNSEL-READY DECISION MATRIX / FREE PRODUCT POLICY CLOSED / PRODUCTION NOT GREEN`

이 matrix는 법률결론이 아니라 **결정해야 할 항목과 owner**를 고정한다. 상세 근거와 후보문구는 `docs/production-legal-review-package.md`, 질문은 `docs/production-legal-review-questionnaire.md`, 답변 입력은 `docs/production-legal-review-decisions.md`를 사용한다.

## 1. Technically / product-policy fixed

| Item | Fixed contract |
|---|---|
| Social consent keys | exactly `TERMS_OF_SERVICE` + `PRIVACY_POLICY` |
| Consent evidence | both required/ACCEPTED; per-document version + SHA-256 + HTTPS URI; no separate manifest version |
| Privacy canonical URI | `https://lotbiai.com/privacy.html` |
| Terms canonical URI | `https://lotbiai.com/terms.html` |
| Google Social ID | OIDC `sub`; reviewed Web scope `openid`; email/profile unused |
| Kakao Social ID | OIDC `sub`; reviewed Web scope `openid`; email/profile unused |
| NAVER Social ID | official `response.id`; reviewed Web scope `openid`; additional profile unused |
| Apple Social ID | `sub`; email/name scope unused |
| LOTBI Signup input | user-entered LOTBI name + handle |
| Same-email merge | forbidden |
| LOGIN | federated limited → Passkey step-up → FULL |
| SIGNUP | Provider verification → name/handle + two legal consents → account provisioning → Passkey enrollment |
| LINK | existing FULL LOTBI account + fresh proof; separate from signup |
| Generic unlink | local `REVOKED`; account retained; current generic path has no remote revoke |
| Account deletion | access/session/authority/external local link revoke first; final purge separate; not immediate hard delete |
| FREE | monthly 3 successful tasks; reset day 1 00:00 KST; no carry-over; LOCAL/failure/cancel/incomplete 0; same-task retry max 1; auditable compensation |
| LOTBI Plus | monthly KRW 9,900; Web Toss / iPhone App Store / Android Google Play |
| Plus vs Merchant | LOTBI subscription fee separated from external Merchant transaction money |
| Operator current Site fields | 유한회사 알에이디홀딩스 / 대표자 전선혜 / 주소 / 사업자등록 583-88-03679 / 통신판매 2026-전주덕진-0798 / developer@lotbiai.com / 063-237-0930 |

`PRODUCT_POLICY_CONFIRMATION_REQUIRED — FREE_TASK_DEFINITION_AND_RESET = CLOSED`.

Implementation of FREE ledger/enforcement remains owning Core/App verification work and does not reopen the product decision.

## 2. Counsel-ready legal decisions

| ID | Legal blocker | Technical status | Counsel / user action | Questionnaire | Current status |
|---|---|---|---|---|---|
| A | `THIRD_PARTY_PROCESSING_AND_OVERSEAS_TRANSFER` | Provider minimum data known; Production vendor/data-flow manifest incomplete | classify each Provider/infra/payment relationship and overseas basis | Q01-Q04 | `READY FOR COUNSEL REVIEW` |
| B | `PROVIDER_SUBJECT_RETENTION_BASIS_AND_PERIOD` | revoked unique reservation exists for takeover prevention | legal basis/max period/final transformation/delete rule | Q05-Q07 | `READY FOR COUNSEL REVIEW` |
| C | `STATUTORY_RETENTION_ITEMS_AND_PERIODS` | transaction/audit/deletion evidence exists; Plus/Merchant roles differ | map exact records to legal basis/period | Q08-Q10 | `READY FOR COUNSEL REVIEW` |
| D | `MINOR_POLICY` | no reviewed under-14 gate | counsel review + user choose v1 restriction/age gate | Q11-Q13 | `USER DECISION REQUIRED AFTER COUNSEL` |
| E | `PRODUCTION_PURGE_PERIOD` | access revoke and final purge separated | general data purge period; backup/log policy | Q14-Q15 | `READY FOR COUNSEL REVIEW` |
| F | `PRIVACY_OFFICER_OR_DEPARTMENT` | general contact exists; CPO/department not confirmed | counsel confirms designation duty; user supplies/designates actual field | Q16 | `USER DECISION REQUIRED AFTER COUNSEL` |
| G | `CONTRACT_FORMATION_TIME` | signup state sequence fixed | choose legal account/contract formation point | Q17-Q18 | `READY FOR COUNSEL REVIEW` |
| H | `LOTBI_PLUS_SUBSCRIPTION_TERMS` | price/channels fixed | renewal/cancel/refund/cooling-off/grace/store entitlement | Q19-Q24 | `READY FOR COUNSEL REVIEW` |
| I | `COMMERCE_ROLE_AND_RESPONSIBILITY` | Kernel technical role fixed; payment role not generalized | determine per-Merchant legal role/disclosures | Q25-Q27 | `READY FOR COUNSEL REVIEW` |
| J | `DELETION_RETENTION_AND_PROVIDER_LIFECYCLE` | local deletion lifecycle fixed; remote Provider blockers open | Provider revoke timing and user-facing completion semantics | Q28-Q29 | `LEGAL + IMPLEMENTATION BLOCKED` |
| K | `SUSPENSION_NOTICE_AND_REMEDY` | security restriction capability needed | fair notice/remedy/permanent suspension/Plus impact | Q30 | `READY FOR COUNSEL REVIEW` |
| L | `SERVICE_CHANGE_NOTICE_AND_LIABILITY` | external dependency interruption possible | notice/refund/remedy/liability wording | Q31 | `READY FOR COUNSEL REVIEW` |
| M | `TERMS_CHANGE_NOTICE` | versioned legal evidence available | notice periods/reconsent/existing Plus users | Q32 | `READY FOR COUNSEL REVIEW` |
| N | `LIABILITY_DISPUTE_JURISDICTION` | no technical conclusion | fair liability/dispute/jurisdiction terms | Q33 | `READY FOR COUNSEL REVIEW` |
| O | `OPERATOR_DISCLOSURE_FIELDS` | current business fields confirmed | confirm mandatory placement/additional fields | Q34 | `READY FOR COUNSEL REVIEW` |
| P | `FINAL_DOCUMENT_EFFECTIVE_DATES` | version/hash mechanism fixed | publication/effective dates and existing-user notice | Q35-Q36 | `READY FOR COUNSEL REVIEW` |

None of A-P is legally CLOSED merely because this package is counsel-ready.

## 3. User decisions explicitly held

The following are not guessed in this room:

| Decision | Current state | Trigger to decide |
|---|---|---|
| v1 under-14 policy / age gate | `USER DECISION REQUIRED` | counsel answer Q11-Q13 |
| privacy officer or department | `USER DECISION REQUIRED` | counsel answer Q16 + actual corporate designation |
| Plus cancellation effective time per channel | `USER DECISION REQUIRED` | counsel answer Q20 |
| Plus payment-failure/grace entitlement | `USER DECISION REQUIRED` | counsel answer Q23 |
| Provider-specific remote revoke on unlink, including Apple unlink policy | `USER DECISION REQUIRED` | counsel answer Q28-Q29 + Provider implementation constraints |

## 4. Provider implementation blockers retained

| Provider | Blocker |
|---|---|
| Google | `GOOGLE_SCOPE_CONTRACT_VERIFY = OPEN`; `openid` minimum real E2E pending |
| Kakao | `KAKAO_PROVIDER_LIFECYCLE_BLOCKER — UNLINK + USER_ID DELETION/PURGE POLICY REQUIRED` |
| NAVER | `NAVER_PROVIDER_LIFECYCLE_BLOCKER — TOKEN_REVOCATION/DISCONNECT INTEGRATION VERIFY` |
| Apple | LOGIN contract ready; SIGNUP/LINK `APPLE_SOCIAL_AUTH_LIFECYCLE_BLOCKER` |

## 5. Data-flow facts needed from engineering before final counsel close

The legal package is ready to start review now, but counsel may return `NEED MORE FACTS` for infrastructure rows. Engineering/operations must provide when requested:

- actual Production Render/Vercel/DB/log/backup regions and contracts/DPA/subprocessors;
- exact AI Provider payload categories and Production enablement/retention configuration;
- actual Toss/App Store/Google Play receipt/payment/subscription fields retained by LOTBI;
- FREE usage/subscription ledger schema after implementation;
- backup/log deletion behavior;
- Provider-specific remote revoke implementation result.

A pilot `render.yaml` using Singapore does **not** by itself establish current Production data residence.

## 6. Document status

- `PRODUCTION PRIVACY CANDIDATE = COUNSEL-READY`
- `PRODUCTION TERMS CANDIDATE = COUNSEL-READY`
- `LEGAL QUESTIONNAIRE = READY (36 QUESTIONS)`
- `LEGAL DECISION MATRIX = READY`
- `LEGAL REVIEW COMPLETE = NO`
- `PRODUCTION SOCIAL SIGNUP LEGAL MANIFEST READINESS = BLOCKED / NOT GREEN`
- `PRODUCTION PUBLISH = NONE`
- `USER_ACTION_REQUIRED — GOOGLE STEP 1 = NOT YET`

## 7. Next gate

Counsel decisions → user-required product/corporate decisions → approved wording → Production data-flow facts where requested → final Privacy/Terms HTML freeze → exact SHA-256 → user-approved publish → Core Production consent manifest → Account Production verification → Google real `openid` E2E → only then Google Console user-action gate.
