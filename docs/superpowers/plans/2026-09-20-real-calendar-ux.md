# LOTBI Real Calendar UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a responsive month/year Calendar with Guest local CRUD and authenticated Core CRUD to Production.

**Architecture:** Pure civil-date and grid logic is separated from persistence. A versioned guest repository and the existing Core client feed one accessible UI renderer, so Guest/Auth isolation is structural rather than conditional storage filtering.

**Tech Stack:** Static ES modules, DOM APIs, CSS, Node 22 contract tests, existing LOTBI Core REST client.

**Spec:** `docs/superpowers/specs/2026-09-20-real-calendar-ux-design.md`

## Global Constraints

- Keep Core unchanged unless the existing bounded Agenda/Create/Update/Remove contract proves insufficient.
- Never store bearer/session/provider/payment credentials in Calendar storage.
- Guest and authenticated events must never be merged automatically.
- Month visual navigation performs zero AI and provider calls.
- Preserve conversation thread, messages, draft, auth callback, sidebar, and anonymous Calendar entry.
- Use normal commits and merge only; no rebase, reset, force-push, or history rewrite.

## Review Focus

- Civil dates around month/year boundaries must not shift with timezone conversion.
- Corrupt or oversized Guest storage must fail safely without exposing authenticated data.
- Stale authenticated revisions must refresh instead of overwriting.
- Dense months must cap visible chips and retain full day-agenda access.
- 340px Fold cover width must keep all seven columns and controls usable.

---

### Task 1: Civil-date calendar model

**Files:**
- Create: `site-calendar-model.js`
- Test: `scripts/validate_calendar_month_grid_01.mjs`
- Test: `scripts/validate_calendar_year_view_01.mjs`

**Interfaces:**
- Produces: `calendarMonthGrid(year, month)`, `monthGridRange(year, month)`, `groupCalendarEvents(items)`, `sortCalendarEvents(items)`, `formatCivilDate(...)`.

- [ ] Write assertions for February, leap year, Sunday/Saturday starts, overflow dates, 42 cells, event ordering, and twelve mini-months.
- [ ] Run both tests and verify failure because the module does not exist.
- [ ] Implement civil-date helpers using UTC arithmetic only for date components.
- [ ] Run both tests and commit the green model.

### Task 2: Versioned Guest Calendar repository

**Files:**
- Create: `site-calendar-guest.js`
- Test: `scripts/validate_guest_calendar_local_01.mjs`

**Interfaces:**
- Consumes: validated civil date strings from Task 1.
- Produces: `createGuestCalendarRepository(storage, options)` with `list`, `create`, `update`, and `remove`.

- [ ] Write assertions for CRUD, UUID identity, refresh persistence, 500-event limit, corrupt JSON, and namespace isolation.
- [ ] Run the test and verify the missing-module failure.
- [ ] Implement validated versioned storage without any auth fields.
- [ ] Run the test and commit the green repository.

### Task 3: Month/year/day Calendar renderer

**Files:**
- Modify: `site-calendar-ui.js`
- Modify: `site-calendar.css`
- Test: `scripts/validate_calendar_real_ui_01.mjs`

**Interfaces:**
- Consumes: Tasks 1–2 and existing `getLifeAgenda`, `getLifeAttention`.
- Produces: default month surface, year overview, agenda, attention, selected-day panel, bounded month loading, retry state, and roving focus.

- [ ] Write DOM/source contract assertions for 42 date buttons, 12 months, selected/today distinction, event chips, overflow count, bounded Agenda range, keyboard behavior, and Korean labels.
- [ ] Run the test and verify it fails against the text manager.
- [ ] Replace manager rendering with the shared Calendar surface while retaining exported legacy entry points required by existing callers.
- [ ] Add desktop/mobile/dark/reduced-motion CSS and run focused plus existing Calendar tests.
- [ ] Commit the green renderer.

### Task 4: Event editor and mutations

**Files:**
- Modify: `site-calendar-ui.js`
- Modify: `site-calendar.css`
- Test: `scripts/validate_calendar_event_editor_01.mjs`

**Interfaces:**
- Consumes: Guest repository; existing `createLifeActivity`, `rescheduleLifeActivity`, and `removeLifeActivity`.
- Produces: add/edit/delete dialog with all-day/timed temporal payloads and stale-revision recovery.

- [ ] Write assertions for Guest create/edit/delete, authenticated payloads, identity/revisions, deletion confirmation, and absence of `prompt()`.
- [ ] Run the test and verify behavior is missing.
- [ ] Implement editor actions and read-your-writes refresh.
- [ ] Run focused and existing Calendar suites, then commit.

### Task 5: Navigation, cache keys, and responsive regression

**Files:**
- Modify: `site-conversation.js`
- Modify: `index.html`
- Modify: `auth-callback.js`
- Modify: `auth/callback/index.html`
- Modify: `.github/workflows/site-universal-life-calendar-01.yml`
- Create: `scripts/validate_calendar_responsive_01.mjs`

**Interfaces:**
- Consumes: Task 3 manager views.
- Produces: sidebar mapping for Calendar/Today/Attention, cache-busted production assets, and focused CI coverage.

- [ ] Write assertions for view mapping, unchanged conversation state, six target widths, seven-column layout, and no horizontal overflow contract.
- [ ] Run the test and verify current source fails.
- [ ] Update mappings, asset versions, and workflow paths/steps.
- [ ] Run all focused Site checks and commit.

### Task 6: Browser, CI, reconciliation, and Production

**Files:**
- No new product files expected.

**Interfaces:**
- Consumes: exact feature candidate.
- Produces: reviewed PR, merged main, Production deployment, and Guest/Auth E2E evidence.

- [ ] Render month, year, day agenda, and editor at 340/390/412/768/1280/1440 widths; correct any visual defect with a failing regression test first.
- [ ] Run the complete local public-site suite with pristine output.
- [ ] Fetch latest main and PR #102; if main advanced, normal-merge it and rerun affected/full tests.
- [ ] Push, open a non-draft PR, and wait for focused plus Public Site Review gates on the exact HEAD.
- [ ] Normal-merge only after green checks, confirm Production serves the merge SHA/cache keys, then execute Guest create→refresh→edit→delete.
- [ ] Use secure browser authentication for Core create→reload→edit→reload→remove and natural-language→chip; never request secrets in chat.
