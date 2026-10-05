# Calendar monthly expense design — 2026-10-05

## Scope / owner

User asked to continue design after clarifying that Calendar owns schedule and bookkeeping. Preserve existing amount/category/month/currency calculations, Core requests, guest repository, registration and photo-draft workflow. This change improves discovery and presentation; it is not a new accounting engine or receipt/OCR feature.

- Repo owner: C:/Users/jshnc/LOTBI-NCLOUD/subscription-plan-banner-v1-site
- Branch: feature/subscription-plan-banner-v1-site-work
- Previous feature checkpoint: ae595c50104f55d20f95b5637987b083fa16c4f1
- Fresh Ncloud main: 7cfdeeb752f6ad46903d3270f3d54f8c471e0a4a
- Main drift: existing refund-policy owner changes normally merged, without conflict. Its refund/exchange/subscribe/legal-workflow content was preserved, not redesigned or reinterpreted here.
- Intentional product edits: site-calendar-expense.js, site-calendar-manager.js, site-consumer-detail.css. Generated asset queries / manifest were refreshed with scripts/asset_cache_version.mjs; final token aset-75486decd111.

Observed RED: Consumer Calendar displayed monthly expenses as a tiny coloured ticker without a visible period/coverage heading. Existing CSS targeted obsolete label classes, leaving category names coloured despite the approved neutral text design. The editor's generic disclosure name also concealed the expense fields.

## Applied

- Consumer workspace only: visible `월별 지출` heading, selected month and `캘린더에 기록한 금액 기준` scope; loading/error never render an invented zero total.
- Total before category breakdown in both visual and assistive reading order. Legacy compact renderer defaults are retained.
- Six fixed categories: neutral primary text, tabular amounts, six desktop columns / three medium columns / two narrow columns; long amounts wrap inside their cells.
- Existing missing-amount coverage note, local storage scope and separate currency rows retained. No estimate, currency conversion, new network requests or billing change.
- Editor disclosure now `장소·생활비·메모 (선택)`; date/time/amount/category controls and save path unchanged.
- New pure-DOM renderer guard scripts/validate_calendar_ledger_design_01.mjs. Relevant existing Calendar workflow includes it. Fixture scripts/fixtures/calendar-ledger-design-01.html is explicitly isolated sample data and never stores or uploads anything.

## Actual browser checks (CUA)

- Desktop actual localhost: six categories each computed rgb(33,33,33); six columns; document width1280 at viewport1280. Heading / scope / total visible beneath the month.
- Mobile viewport320×640: two columns114.5px, all six categories present, document width320 (no horizontal page overflow); monthly summary reached through the existing vertical workspace scroll.
- Selected day → direct registration → expanded disclosure: original place/merchant/memo/amount/category fields present; editor body450px / scroll822px, footer bottom604px. Cancelled empty form; no event created.
- Desktop week / year / agenda switching retained; year has12 months. Month September→October scope matched each month and returned to October. No successful authenticated save/API assertion.
- Isolated mobile fixture: long amount1,000,000,084,199원 stayed within bounds; KRW and USD separate; loading/error have no total. Dark category text rgb(245,245,245) on background rgb(33,33,33). Fixture figures are explicitly not user finances.
- Existing ChatGPT settings/general browser read-only reference checked for hierarchy; reference account unchanged.
- Earlier user text in local tabs57/58 preserved, not reloaded or cleared. Separate empty test tabs closed; temporary viewport reset. Final consumer tab retained.

Evidence external: calendar-ledger-desktop-20261005.jpg / calendar-ledger-mobile-20261005.jpg in C:/Users/jshnc/.codex/visualizations/2026/10/03/01a10023-5348-79b0-87ab-3a03393311f2/.

## Local tests

New ledger design renderer/reading-order/money-state guard; editor spacing; event editor/mutation; secondary expense/settings/cache; product/week/month/year models; conversation actions/auto-suggest; guest repository; consumer detail system; global dark contrast; static-page theme source contracts PASS. Syntax / asset coherence PASS. Python predeploy8tests, public11pages, accessibility, legal and newly merged refund policy guards PASS.

Trusted Ncloud CI / production served revision: NOT_VERIFIED for this candidate, not inferred from local tests or push. Previous shell-Chromium Calendar visual suite is unavailable in this Windows environment; these are CUA checks, not a claim that the entire legacy browser suite passed. Real Android Chrome, Samsung Internet, iPhone Safari and native apps NOT_TESTED. Signed-in finances/receipt OCR/AI-to-calendar success NOT_VERIFIED.

IMPLEMENTED / SELECTED_LOCAL_UI_CHECKED / LOCAL_CHECKS_PASS. Exact SHA/push recorded in external design-calendar-ledger-handoff-20261005.md. No main direct push, GitHub branch/PR, force push, history rewrite or production deploy. API root and /app/subscribe TEST-review screens untouched. Urgent-login and broad-Web owners unchanged. Whole132 runtime audit remains incomplete; wallet functionality stays deferred. LIVE_MONEY=false / APP_SYNC_PENDING=KEEP.
