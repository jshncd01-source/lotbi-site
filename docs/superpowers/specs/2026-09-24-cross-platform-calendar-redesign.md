# LOTBI Cross-Platform Calendar Redesign

## Outcome

LOTBI Calendar becomes a dense but readable life-management calendar on desktop Web, narrow mobile Web, foldables, Android, and iOS. The same Calendar data remains authoritative; the redesign does not introduce a UI-only schedule store or alter auth, billing, image-candidate, or notification authority.

## Actual baseline

- Site main `ceb83542e025ebe21798a638fc33dbbfeb9df421` already has authenticated and Guest CRUD, image-to-calendar review, expenses, holidays, weather, settings, notifications, themes, and month/year/agenda views. The selected-day presentation nevertheless defaults to a floating popover and the Month renderer omits normalized temperature text.
- App main `cf4e2e9c6420408dd016e4399e1b1ecb7e16081d` has a single `CalendarRootScreen` with today/upcoming/attention lists, basic title/date creation and date-only rescheduling. It does not yet expose a real Week, Month, Year, selected-day surface, compact temporal editor, or expense-category editor.
- Core main `114e73ea66b016e0a6d45636d7a14332977ea5f4` already supports Agenda ranges, end dates/times in reads, temporal DATE_RANGE/TIME_WINDOW values, entry details, expenses, holidays, short/mid weather and fail-soft omission semantics.
- Production weather request for Jeonju from 2026-09-24 through 2026-10-08 returned only 2026-09-24 through 2026-09-28. Site and Core both allow 15 inclusive days. The missing dates are caused by short-term KMA coverage plus a missing/invalid KMA mid-region code on coordinate/catalog paths, not by the Site request window.

## Product information architecture

- `주`: primary consumption view. A seven-day strip controls a vertically scrollable agenda grouped by date. Every row exposes time, title, type/status when the contract supplies it, and the most useful available secondary value such as place, merchant, amount, source authority, or end span.
- `월`: overview view. The grid shows date, holiday state, colored weather plus real temperature when available, at most two representative event rows on wide layouts, and a `+N`/count summary for remaining density. Narrow phones use counts/dots rather than unreadable text.
- `년`: twelve compact navigable mini-months with event-density indicators. Month activation moves to that Month view.
- `일정`: retained as a search/filter list because it covers unscheduled and overdue items that Week cannot represent. Filters are 오늘/이번 주/이번 달/예약/결제/일정, but category/status filters only match values actually derivable from the contract.

## Selection and detail

Date selection never opens an anchored speech-bubble popover. Mobile uses an in-flow panel below the month grid; desktop uses a persistent side panel. The panel lists existing events before actions. Empty days show one quiet sentence and two actions: direct add and image add. Event activation opens detail/edit; delete remains confirmed and discoverable.

## Event visual model

The presentation derives a conservative event kind from existing source, temporal semantics, entry details and title only where deterministic. It never stores inferred type/status. Type and state remain visually distinct. Whole-card category fills are prohibited; compact icon/label/accent treatments carry meaning in both themes.

## Editor

Title, date, and all-day/time are primary. Place, merchant/reservation source, memo, amount, and expense category live in a collapsible details section. The selected date is prefilled.

Web timed entry uses a LOTBI compact sheet/control with direct keyboard-safe `HH:mm`, quick choices 09:00/12:00/18:00, clear-time, and done actions; it does not invoke the Android analog clock. All-day hides/disables time. App uses an in-app compact picker built from Pressable/TextInput primitives, avoiding new native dependencies and native-file conflicts.

Core already supports `TIME_WINDOW`, `DATE_RANGE`, read-side `local_end_date/local_end_datetime`, and the authenticated `/entry` update used by Site. The redesign therefore extends the existing Site/App adapters without a schema migration: timed entries may carry an optional same-day end time, App reads the existing entry details, and edits preserve title, temporal and entry details together. An omitted end remains a start-only `LOCAL_DATE_TIME`; invalid end-before-start input is rejected in the UI and Core.

## Weather

- Site and App render CLEAR/CLOUDY/RAIN/SNOW with semantic yellow, gray-blue, blue, and cool-blue glyph treatments plus text/ARIA labels.
- Temperature is shown only from normalized `temperature/min/max` values. Month uses one compact label; Week can show the min/max label.
- Requests stay bounded to today through today+14 inclusive and never fabricate missing days.
- Core normalizes catalog codes such as `KR_JEONJU` to their verified KMA mid code and may associate coordinates with the nearest bounded catalog region within the existing Korea-only distance rule. This enables existing KMA_MID coverage without a new provider, secret, paid service, or persisted precise coordinate.
- KMA/public-data attribution remains present as secondary copy.

## Responsive behavior

- Narrow phone/S26-class is the primary acceptance surface: slim toolbar, compact segmented switcher, 44px controls, no horizontal overflow, in-flow date detail, condensed Month cells.
- Fold narrow follows the narrow contract; Fold wide gains more event text and multi-column Week grouping without a separate product.
- Desktop uses a side detail panel and wider Week groups. Mobile markup is not merely scaled up.
- iPhone safe areas, keyboard input, visible focus, screen-reader labels, reduced motion, Light/Dark/System theme behavior, and fail-soft auxiliary reads are preserved.

## Data and protection rules

- Direct, image, and conversational writes continue through the existing authoritative Calendar APIs/repositories and refresh the active views immediately.
- Weather, holiday, expense, and settings failures do not erase authoritative schedules.
- No schedule title, note, hospital, reservation number, or private location is added to telemetry.
- Auth states FULL and FEDERATED_LIMITED, session handoff, PKCE/state/replay/logout, social login, subscription billing, Toss, and live money code are out of scope.

## Verification

Fixtures cover 0, 1, 7, and 15 events on a day; mixed normal/reservation/payment/medical-like records; holiday; complete and partial weather; temperature; amount; place; Guest/Auth; immediate refresh; Light/Dark/System; standard phone, fold narrow/wide, iPhone, and desktop widths. Site uses existing Node/Python validators plus new Calendar product validators. App uses Jest, TypeScript, ESLint, Python repository gates, Android Gradle, and iOS build/simulator evidence where available. Core runs focused weather tests and the existing full required CI only if the small weather delta is implemented.
