# LOTBI Cross-Platform Calendar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans task-by-task. Every product behavior starts with a failing test.

**Goal:** Deliver one Week/Month/Year/Schedule Calendar contract across Site and Native App, with dense schedules, compact editing, real weather temperature, and the maximum honest KMA forecast coverage.

**Architecture:** Existing Core/Guest Calendar sources remain authoritative. Site adds focused rendering/model helpers around its manager, App replaces its basic list coordinator with testable calendar-model and presentation components, and Core receives only a deterministic weather-region normalization delta.

**Tech Stack:** Static ES modules/CSS/Node validators; React Native 0.87/TypeScript/Jest; FastAPI/Python/pytest; GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-24-cross-platform-calendar-redesign.md`

## Global constraints

- Fresh main branches only; do not transplant stale Calendar PRs.
- No rebase, reset, force-push, history rewrite, direct-main editing, empty CI commits, or duplicate exact-head evidence.
- Preserve image-to-calendar, direct/conversational CRUD, holidays, expense semantics, notification opt-in, privacy, auth, and billing.
- No Store public release, live money, secret/key change, destructive production data operation, or new paid service.
- Use the existing Core `TIME_WINDOW`/`DATE_RANGE`, end-field, entry-detail, and `/entry` update contracts; do not create a new schema or a local-only category overlay.

## Review focus

- A 15-event day must remain readable in Week/day detail while Month mounts only a bounded summary.
- Missing weather days must remain blank and schedules must remain visible.
- Narrow mobile selection must not cover the month grid or trigger the OS analog time picker.
- Guest/Auth refresh must update Week, Month count, Schedule list, and expense summary without reload.
- New Calendar code must not touch auth/session or payment authority.

### Task 1: Core forecast coverage normalization

**Files:** `app/calendar_weather_regions.py`, `app/calendar_weather_http.py`, `tests/test_calendar_weather_public_01.py`, `tests/test_calendar_weather_location_precedence_01.py`.

- [ ] Add failing tests proving catalog code `KR_JEONJU` resolves to KMA code `11F10000`, current Jeonju coordinates acquire that mid code without persisting coordinates, and current-location precedence remains unchanged.
- [ ] Run the focused pytest nodes and confirm failures are caused by missing normalization.
- [ ] Add a bounded nearest-catalog resolver using haversine distance and the existing Korea/max-distance rule; normalize catalog-style `mid_region_code` inputs before provider use.
- [ ] Re-run focused weather tests, then the repository-required Core suite. Commit only the weather delta.

### Task 2: Site calendar presentation model

**Files:** create `site-calendar-product.js`; modify `site-calendar-manager.js`; add `scripts/validate_calendar_product_model_01.mjs`.

- [ ] Write failing fixture assertions for week bounds/groups, 0/1/7/15-event density, Month visible-limit/`+N`, conservative type/status/meta labels, date filters, and temperature labels.
- [ ] Run the new validator and confirm the missing-module failure.
- [ ] Implement pure helpers: `calendarWeekDays`, `weekAgendaGroups`, `monthCellSummary`, `calendarEventPresentation`, `filterScheduleItems`.
- [ ] Re-run the validator and existing month/year/weather model validators.

### Task 3: Site Week/Month/Year/Schedule and date detail

**Files:** modify `site-calendar-manager.js`, `site-calendar.css`; add `scripts/validate_calendar_cross_platform_ux_01.mjs`.

- [ ] Add failing DOM/source assertions for `주/월/년/일정`, week strip and seven groups, bounded Month rows, temperature text, in-flow mobile detail, desktop side detail, no popover arrow, compact toolbar, filters, 44px controls, and empty/loading/error copy.
- [ ] Confirm failure against current `month/year/agenda` and default popover implementation.
- [ ] Render the four views from the shared state, route previous/next by active view, and preserve keyboard/ARIA behavior.
- [ ] Replace popover positioning with FLOW at <=900px and SIDE at desktop; keep event-first day detail and both add actions.
- [ ] Render temperature via `weatherTemperatureLabel`; keep KMA attribution and weather fail-soft.
- [ ] Re-run focused plus every existing Calendar validator.

### Task 4: Site compact editor, time and category controls

**Files:** modify `site-calendar-manager.js`, `site-calendar.css`; add `scripts/validate_calendar_compact_editor_01.mjs`.

- [ ] Add failing tests for primary/optional sections, selected-date prefill, all-day hiding time, optional end time, end-after-start validation, quick 09:00/12:00/18:00 choices, keyboard-valid HH:mm, clear/done actions, compact category sheet, focus trap/restore, and exact existing-contract payloads.
- [ ] Confirm current native `input[type=time]` and fully expanded form fail the contract.
- [ ] Implement compact LOTBI controls without a dependency; keep the existing mutation controller and expense-category enum.
- [ ] Re-run editor, image-draft, CRUD, accessibility, dark/system, and auth-continuity validators.

### Task 5: Site expenses/settings/assets

**Files:** modify `site-calendar-expense.js`, `site-calendar-expense.css`, `site-calendar-manager.js`, `site-calendar.css`, `index.html`, `auth/callback/index.html`, `auth-callback.js`, `site-calendar-ui.js`, `site-conversation.js`, workflows.

- [ ] Add failing assertions for total-first non-zero expense summary, compact settings hierarchy, current-vs-manual weather explanation, and consistent cache keys.
- [ ] Implement the secondary summary/settings layout without changing storage/privacy contracts.
- [ ] Update cache keys and CI steps once; run public-site static validation and full Calendar/Site gates.

### Task 6: Native calendar model and four views

**Files:** create `apps/mobile/src/calendar/calendarProductModel.ts`; modify `apps/mobile/src/screens/CalendarRootScreen.tsx`, `packages/core-client/src/lifeCalendarClient.ts`; add `apps/mobile/__tests__/calendarProductModel.test.ts`, `apps/mobile/__tests__/CalendarRootScreen.test.tsx` or equivalent source contract gate.

- [ ] Add failing tests for Agenda range reads, Week grouping, Month 0/1/7/15 density, Year navigation, selected day, schedule filters, weather temperature, holiday, Guest/Auth parity, and immediate refresh.
- [ ] Confirm current today/upcoming-only screen fails.
- [ ] Extend the client additively for Agenda, read-side end/entry fields and the existing `/entry` update; implement Week/Month/Year/Schedule surfaces with FlatList/ScrollView appropriate to bounded content.
- [ ] Preserve location, weather, notification, auth, and theme modules from main.

### Task 7: Native compact editor and settings

**Files:** modify `CalendarRootScreen.tsx`; add/update Calendar screen tests and Python repository gates.

- [ ] Add failing tests for title/date, all-day/start/end quick choices, optional entry details, compact category selection, edit/delete actions, settings hierarchy, Light/Dark/System, and accessibility labels.
- [ ] Implement in-app Pressable/TextInput temporal controls without native manifest/project changes, so PR #133 remains independent.
- [ ] Preserve entry and optional end fields through create/edit/read using existing Core names; Guest storage migrates additively and Auth never falls back to a local overlay.
- [ ] Run Jest, typecheck, lint, Python gates, Android build, and iOS build/simulator checks available in CI.

### Task 8: Integration, visual evidence, merge and deploy

- [ ] For each repo, fetch latest main and normally merge drift into the feature branch; do not rewrite history.
- [ ] Capture Site evidence at 360/390, 344 fold narrow, 768 fold wide, 390 iPhone, and 1440 desktop in Light/Dark/System using controlled fixtures.
- [ ] Inspect every diff for auth, billing, image-write, privacy, and unrelated changes; run full required suites with zero failures.
- [ ] Push fresh branches through the approved GitHub integration, open ready PRs, and require exact-head CI GREEN.
- [ ] Fresh-check `ahead/behind/mergeable` immediately before normal merge. Merge Core first only if its delta is required by Site/App heads; then Site and App.
- [ ] Verify Core deployment SHA/health if changed, Site served revision and Production viewports, Android native build, iOS native build/simulator. Leave physical S26/Fold/iPhone states accurately pending when unavailable.
