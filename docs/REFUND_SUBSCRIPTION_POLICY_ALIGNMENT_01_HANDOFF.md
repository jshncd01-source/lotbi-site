# LOTBI Refund Policy & Subscription Operations Alignment 01

Date: 2026-10-05 (Asia/Seoul)

## Scope

- Write scope: `lotbi-site`
- Read-only verification: Production Site, Production Core OpenAPI, `lotbi-web` subscription UI, Core subscription state/refund contracts
- No Production deploy, live payment, refund, credential change, or Production data mutation was performed.

## Policy result

- The policy applies to company-direct LOTBI subscriptions.
- Apple App Store and Google Play in-app subscriptions are explicitly described as currently unavailable.
- The 7-day withdrawal period now starts from receipt of the contract document, or the later service supply/start date.
- Contract mismatch rights preserve both the three-month and 30-day periods.
- Digital-service withdrawal limits are conditional on the legally required pre-contract measures; the policy alone does not claim a restriction.
- Renewal cancellation and immediate termination/refund are separate paths.
- Mid-term refunds deduct only the prorated used period. There is no additional 10% penalty and usage counts are not deducted again.
- Refunds use the original payment method in principle; the company-side request deadline and the payment-provider/card reflection time are separated.
- Monthly plans and prices remain Basic 9,900 KRW, Plus 19,900 KRW, and Pro 39,900 KRW, VAT included.
- Price increases and free-to-paid conversions require consent and notice 30 days in advance.
- `/exchange` remains available for compatibility, but its content now explains digital-service outage, defect, and non-delivery remedies.

## Read-only operational verification

| Contract | Result | Evidence |
|---|---|---|
| Checkout immediate-use/withdrawal notice | NO | Current account checkout only exposes recurring billing consent; no separate withdrawal notice exists. |
| Checkout withdrawal consent | NO | No separate explicit confirmation for immediate service start or withdrawal restriction exists. |
| Recurring-payment advance notice automation | NO | No user-notification job or route for the next charge was found. |
| Account renewal cancellation UI | YES | Account `구독 및 사용량` exposes `다음 결제 전에 해지 예약`; Core exposes `POST /v2/subscription/cancel`. |
| Immediate termination/prorated refund operation | NO | Production OpenAPI exposes no subscription refund or admin refund mutation route. |
| Subscription refund audit | NO | Provider/refund evidence primitives exist, but there is no complete operator-facing subscription prorated-refund workflow and result ledger. |
| Payment-failure state machine | YES | Core maps failed billing into `PAST_DUE`/`PAYMENT_FAILED` and supports bounded retry/reconciliation. |
| Payment-failure user notice | NO | No customer-facing failure notification delivery capability was found. |
| Email support surface | YES | `developer@lotbiai.com` is linked on the policy and contact surfaces. Response handling was not live-tested. |
| Phone support surface | YES | `063-237-0930` is linked on the policy and business-information surfaces. Call handling was not live-tested. |
| Toss partial/full cancellation provider capability | YES | Toss Payments documents `cancelAmount` for partial cancellation and omission for full cancellation. LOTBI does not yet expose this as an operational refund workflow. |
| KakaoPay partial/full cancellation provider capability | YES | KakaoPay documents partial/full cancellation for payment and recurring-payment transactions, subject to method/industry restrictions. LOTBI does not yet expose this as an operational refund workflow. |

## Legal references checked

- Electronic Commerce Consumer Protection Act, Articles 13, 17, and 18 (effective 2026-07-21)
- Enforcement Decree, Article 20-2 (30 days before a recurring-price increase or free-to-paid conversion)
- Content Industry Promotion Act, Article 27
- Content User Protection Guidelines
- Toss Payments and KakaoPay official cancellation/recurring-payment documentation

## Operational blockers before live paid subscriptions

1. Add checkout disclosure and explicit confirmation for immediate service start and withdrawal-limit conditions.
2. Add advance recurring-payment notice delivery with durable delivery evidence.
3. Add an authorized operator workflow that calculates, executes, reconciles, and audits prorated subscription refunds.
4. Add customer notification for payment failure, payment-method change/retry guidance, and final paid-feature suspension.
5. Complete legal-counsel review of the public policy and checkout contract before enabling live money.

## Verdict

- `REFUND_POLICY_CONTENT_READY=YES`
- `REFUND_POLICY_OPERATIONALLY_READY=NO`
- `LEGAL_REVIEW_NEEDED=Final counsel review before live paid subscriptions; confirm the voluntary three-business-day mid-term refund promise and rounding rules.`
