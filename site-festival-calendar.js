// FESTIVAL-EVENT-10 — Festival <-> LOTBI Calendar bridge.
//
// Reuses the existing Calendar write paths end to end: createLifeActivity()
// (site-calendar.js) for authenticated users, the Guest Calendar repository
// (site-calendar-guest.js, via its createForRequest() idempotency contract)
// for signed-out visitors. No new Calendar storage and no new Core endpoint.
//
// Core's activity `entry` (amount_minor/currency/expense_category/memo/
// place/merchant) now also carries source_kind/source_ref/visit_scope/
// visit_date (lotbi-core FESTIVAL-EVENT-12 follow-up, entry.source_kind --
// not to be confused with the item's own top-level `source_kind`, an
// unrelated pre-existing field with values USER_INPUT/LIFE_RESULT). An
// authenticated user's Calendar item carries its festival identity on the
// server the same way a Guest entry always has. FESTIVAL_CALENDAR_LINK_INDEX_KEY
// below is kept as a same-browser fallback only, for entries an older client
// build created before the server field existed, or if a network read
// somehow omits `entry`: readFestivalCalendarLink()/festivalLinkFromCalendarItem()
// still consult it, but every new authenticated write goes straight to the
// server field and no longer depends on it. Guest entries need no such
// index — site-calendar-guest.js persists source_kind/source_ref/
// visit_scope/visit_date on the entry itself.
import {createLifeActivity} from './site-calendar.js?v=aset-81c2d93709bd';
import {addLocalDays} from './site-festival-client.js?v=aset-81c2d93709bd';
export const FESTIVAL_CALENDAR_LINK_INDEX_KEY = 'lotbi.festival.calendar-link.v1';
const LINK_INDEX_LIMIT = 200;

export const VISIT_SCOPE = Object.freeze({DATE: 'DATE', FULL_RANGE: 'FULL_RANGE'});

function civilDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '';
}

/** Every individual civil date within [startDate, endDate], inclusive. */
export function festivalVisitDateOptions(festival) {
  const start = civilDate(festival?.startDate);
  const end = civilDate(festival?.endDate);
  if (!start || !end || start > end) return Object.freeze([]);
  const dates = [];
  let cursor = start;
  // A festival is a public record, not user input, but a corrupt/absurd date
  // range must never turn into an unbounded loop.
  for (let guard = 0; guard < 400 && cursor <= end; guard += 1) {
    dates.push(cursor);
    if (cursor === end) break;
    cursor = addLocalDays(cursor, 1);
  }
  return Object.freeze(dates);
}

function deterministicRequestId(festivalId, visitDate) {
  return `festival.${String(festivalId || '').trim()}.${civilDate(visitDate) || 'FULL'}`;
}

// ---------------------------------------------------- same-browser link index --
// See module header: interim stand-in for authenticated users only, until
// lotbi-core carries a real source reference.

function readLinkIndex(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(FESTIVAL_CALENDAR_LINK_INDEX_KEY) || 'null');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeLinkIndex(storage, index) {
  try {
    const entries = Object.entries(index);
    const bounded = entries.length > LINK_INDEX_LIMIT ? Object.fromEntries(entries.slice(-LINK_INDEX_LIMIT)) : index;
    storage.setItem(FESTIVAL_CALENDAR_LINK_INDEX_KEY, JSON.stringify(bounded));
  } catch {
    // Best-effort only: losing this index degrades re-entry/duplicate
    // detection for authenticated users on this browser, it never blocks a
    // Calendar write that already succeeded against Core.
  }
}

export function readFestivalCalendarLink(activityId, storage = globalThis.localStorage) {
  if (!activityId || !storage) return null;
  const link = readLinkIndex(storage)[activityId];
  if (!link || typeof link !== 'object') return null;
  const festivalId = typeof link.festivalId === 'string' ? link.festivalId : '';
  if (!festivalId) return null;
  const visitScope = link.visitScope === VISIT_SCOPE.FULL_RANGE ? VISIT_SCOPE.FULL_RANGE : VISIT_SCOPE.DATE;
  return Object.freeze({festivalId, visitDate: civilDate(link.visitDate) || null, visitScope});
}

export function writeFestivalCalendarLink(activityId, {festivalId, visitDate, visitScope}, storage = globalThis.localStorage) {
  if (!activityId || !festivalId || !storage) return;
  const index = readLinkIndex(storage);
  index[activityId] = {festivalId, visitDate: civilDate(visitDate) || null, visitScope};
  writeLinkIndex(storage, index);
}

export function removeFestivalCalendarLink(activityId, storage = globalThis.localStorage) {
  if (!activityId || !storage) return;
  const index = readLinkIndex(storage);
  if (!(activityId in index)) return;
  delete index[activityId];
  writeLinkIndex(storage, index);
}

function findExistingLinkedActivityId(festivalId, visitDate, visitScope, storage) {
  const index = readLinkIndex(storage);
  const wantDate = civilDate(visitDate) || null;
  for (const [activityId, link] of Object.entries(index)) {
    if (!link || link.festivalId !== festivalId) continue;
    const linkScope = link.visitScope === VISIT_SCOPE.FULL_RANGE ? VISIT_SCOPE.FULL_RANGE : VISIT_SCOPE.DATE;
    if (linkScope !== visitScope) continue;
    if ((civilDate(link.visitDate) || null) !== wantDate) continue;
    return activityId;
  }
  return null;
}

/**
 * @param {object} item A Calendar item as rendered by site-calendar-manager.js
 *   (a guest event, which carries source_kind/source_ref/visit_scope/
 *   visit_date flat on the event, or a Core activity/occurrence shape, where
 *   the same four fields live nested under `item.entry` -- Core's top-level
 *   `source_kind` is an unrelated, pre-existing field with values
 *   USER_INPUT/LIFE_RESULT, never FESTIVAL).
 * @returns {{festivalId: string, visitDate: string|null, visitScope: string}|null}
 */
export function festivalLinkFromCalendarItem(item, storage = globalThis.localStorage) {
  if (!item || typeof item !== 'object') return null;
  const flat = item.source_kind === 'FESTIVAL' ? item : null;
  const nested = !flat && item.entry && item.entry.source_kind === 'FESTIVAL' ? item.entry : null;
  const source = flat || nested;
  if (source && typeof source.source_ref === 'string' && source.source_ref) {
    return Object.freeze({
      festivalId: source.source_ref,
      visitDate: civilDate(source.visit_date) || null,
      visitScope: source.visit_scope === VISIT_SCOPE.FULL_RANGE ? VISIT_SCOPE.FULL_RANGE : VISIT_SCOPE.DATE,
    });
  }
  const activityId = item.activity_id || item.activityId || '';
  return activityId ? readFestivalCalendarLink(activityId, storage) : null;
}

// -------------------------------------------------------------------- create --

function buildTemporal(visitScope, visitDate, festival) {
  if (visitScope === VISIT_SCOPE.FULL_RANGE) {
    return Object.freeze({kind: 'DATE_RANGE', local_date: festival.startDate, date_end: festival.endDate});
  }
  return Object.freeze({kind: 'DATE_ONLY', local_date: visitDate});
}

function calendarTitle(festival) {
  return festival?.name || '축제·행사';
}

function calendarPlace(festival) {
  return festival?.address || festival?.region || '';
}

/**
 * Add one Calendar entry for a visit to a PUBLISHED festival — either a
 * single day (DATE scope) or the festival's whole run (FULL_RANGE scope).
 * Never fabricates a time: both scopes create an all-day entry. Never
 * records an expense: entry.amount_minor stays null.
 *
 * @returns {Promise<
 *   {status: 'CREATED', item: object} |
 *   {status: 'DUPLICATE', item?: object, link?: {activityId: string}} |
 *   {status: 'ERROR', error: Error}
 * >}
 */
export async function addFestivalVisitToCalendar({
  festival,
  visitDate = null,
  visitScope = VISIT_SCOPE.DATE,
  authenticated = false,
  sessionToken = '',
  guestRepository,
  fetchImpl = globalThis.fetch,
  storage = globalThis.localStorage,
}) {
  if (!festival || !festival.id) throw new TypeError('festival is required');
  if (visitScope !== VISIT_SCOPE.DATE && visitScope !== VISIT_SCOPE.FULL_RANGE) throw new TypeError('visitScope is invalid');
  if (visitScope === VISIT_SCOPE.DATE) {
    if (!festivalVisitDateOptions(festival).includes(civilDate(visitDate))) {
      throw new RangeError('visitDate is outside the festival period');
    }
  }
  const normalizedVisitDate = visitScope === VISIT_SCOPE.FULL_RANGE ? null : civilDate(visitDate);
  const requestId = deterministicRequestId(festival.id, normalizedVisitDate);
  const temporal = buildTemporal(visitScope, normalizedVisitDate, festival);
  const entry = {amount_minor: null, currency: 'KRW', expense_category: null, memo: '', place: calendarPlace(festival), merchant: ''};

  try {
    if (!authenticated) {
      if (!guestRepository) throw new TypeError('guestRepository is required for Guest Calendar');
      const duplicate = guestRepository.list().find(event => event.source_kind === 'FESTIVAL'
        && event.source_ref === festival.id
        && (event.visit_scope === VISIT_SCOPE.FULL_RANGE ? VISIT_SCOPE.FULL_RANGE : VISIT_SCOPE.DATE) === visitScope
        && (event.visit_date || null) === normalizedVisitDate);
      if (duplicate) return Object.freeze({status: 'DUPLICATE', item: duplicate});
      const item = guestRepository.createForRequest(requestId, {
        title: calendarTitle(festival),
        local_date: temporal.local_date,
        local_end_date: temporal.kind === 'DATE_RANGE' ? temporal.date_end : null,
        all_day: true,
        entry,
        source_kind: 'FESTIVAL',
        source_ref: festival.id,
        visit_scope: visitScope,
        ...(normalizedVisitDate ? {visit_date: normalizedVisitDate} : {}),
      });
      return Object.freeze({status: 'CREATED', item});
    }

    const existingActivityId = findExistingLinkedActivityId(festival.id, normalizedVisitDate, visitScope, storage);
    if (existingActivityId) return Object.freeze({status: 'DUPLICATE', link: {activityId: existingActivityId}});

    const response = await createLifeActivity(sessionToken, {
      logicalRequestId: requestId,
      title: calendarTitle(festival),
      temporal,
      temporalSemantics: 'USER_PLANNED_TIME',
      busy: 'UNKNOWN',
      entry: {
        ...entry,
        source_kind: 'FESTIVAL',
        source_ref: festival.id,
        visit_scope: visitScope,
        ...(normalizedVisitDate ? {visit_date: normalizedVisitDate} : {}),
      },
    }, fetchImpl);
    const activityId = response?.activity_id || response?.activityId || '';
    // Kept as a same-browser fast-path cache alongside the now-authoritative
    // server field -- see module header. Harmless if it later goes stale.
    if (activityId) writeFestivalCalendarLink(activityId, {festivalId: festival.id, visitDate: normalizedVisitDate, visitScope}, storage);
    return Object.freeze({status: 'CREATED', item: response});
  } catch (error) {
    return Object.freeze({status: 'ERROR', error});
  }
}
