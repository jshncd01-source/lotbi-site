# LOTBI Real Calendar UX Design

## Outcome

Replace the existing text-oriented Calendar manager with a recognizable, responsive calendar product: month grid by default, year overview, selected-day agenda, event editor, and needs-attention view. Anonymous users manage versioned browser-local events; authenticated users use the existing Core Calendar API. Conversation state and sidebar information architecture remain intact.

## Architecture

- `site-calendar-model.js` owns timezone-safe civil-date helpers, 42-cell month grids, year mini-month grids, event grouping/sorting, and view state. Date-only values never round-trip through local `Date` parsing.
- `site-calendar-guest.js` owns the versioned `lotbi.guest.calendar.v1` repository. It validates stored JSON, enforces a 500-event limit, generates UUID identities, and stores Calendar event content only.
- `site-calendar-ui.js` renders one calendar surface over two repository adapters. Guest and authenticated data never share storage or result sets.
- Authenticated month reads use one bounded Agenda query covering the visible 42-cell grid. Mutations use existing create/reschedule/remove functions and optimistic revisions.
- The editor is a real dialog within the existing modal surface. It supports title, date, optional time/all-day, save, cancel, edit, and confirmed deletion. Browser `prompt()` is removed.

## Views and interaction

- Default `month` view: Sunday-first seven-column grid, six stable rows, overflow dates, separate today and selected states, weekend styling, event chips, and overflow counts.
- `year` view: twelve mini-months; selecting a month returns to the month view.
- `agenda` view: ordered events for the currently displayed month.
- `attention` view: existing authenticated attention projection; guest view remains empty and explanatory.
- Sidebar `캘린더`, `오늘`, and `확인 필요` actions map to month, current date, and attention without restoring removed navigation items.
- Arrow keys move the roving date focus, Enter/Space select a date, and each cell exposes a Korean accessible label with event count.

## Data and mutation rules

- Guest schema: `{version: 1, events: [{id,title,local_date,local_datetime,all_day,created_at,updated_at}]}`.
- Guest malformed or old data fails closed to an empty collection without crashing.
- Auth create uses `DATE_ONLY` for all-day and `LOCAL_DATE_TIME` plus the resolved IANA timezone otherwise.
- Auth edit keeps the Activity identity and sends `occurrence_revision`; delete sends `activity_revision`.
- `STALE_REVISION` refreshes the current bounded view and explains that another change was applied.
- Natural-language Calendar success continues to dispatch `lotbi:life-calendar-refresh`, making new chips visible immediately.

## Responsive and visual contract

- Desktop surface expands to 1000–1200px and places the month grid beside a day-detail panel.
- Mobile stacks header, grid, day agenda, and selected-date add CTA. The seven-column grid must fit 340, 390, 412, 768, 1280, and 1440px widths without horizontal overflow.
- Dark theme, reduced motion, visible focus, non-color status text, and reasonable touch targets are preserved.
- Holidays and lunar dates are excluded until an authoritative provider exists; weekends are styled now.

## Verification

Focused tests cover month edge cases, year rendering, bounded Core calls, guest CRUD and persistence, namespace isolation, editor mutations, keyboard semantics, and responsive CSS contracts. Existing Calendar, conversation, auth-continuity, sidebar, accessibility, and full public-site gates remain green. Final acceptance requires real Production guest and authenticated E2E; authenticated E2E may pause only for secure user sign-in.
