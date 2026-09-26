// FESTIVAL-EVENT-10 — Festival <-> LOTBI Calendar bridge.
//
// Reuses the existing Calendar write paths end to end: createLifeActivity()
// (site-calendar.js) for authenticated users, the Guest Calendar repository
// (site-calendar-guest.js, via its createForRequest() idempotency contract)
// for signed-out visitors. No new Calendar storage and no new Core endpoint.
//
// Core's activity `entry` schema (amount_minor/currency/expense_category/
// memo/place/merchant) has no field for a durable festival source reference,
// `source_kind` on a read activity is server-decided (USER_INPUT/LIFE_RESULT)
// and not settable here, and `logical_request_id` is never returned by any
// read endpoint. So an authenticated user's Calendar item cannot yet carry
// its festival identity on the server — that needs an additive lotbi-core
// change this session cannot make (lotbi-core is outside this session's
// repository scope). Until that lands, FESTIVAL_CALENDAR_LINK_INDEX_KEY below
// keeps a same-browser localStorage index from activity_id -> {festivalId,
// visitDate, visitScope} so re-entry and duplicate detection still work on
// the browser that created the entry. It is a transparent client-side
// stand-in, not a hidden marker inside a user-owned field: memo/place stay
// exactly what the user typed or the venue's own name. Guest entries need no
// such index — site-calendar-guest.js persists source_kind/source_ref/
// visit_scope/visit_date on the entry itself.
import {createLifeActivity} from './site-calendar.js?v=aset-bb8131a1c21b';
import {addLocalDays} from './site-festival-client.js?v=aset-bb8131a1c21b';

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
 *   (a guest event, or a Core activity/occurrence shape).
 * @returns {{festivalId: string, visitDate: string|null, visitScope: string}|null}
 */
export function festivalLinkFromCalendarItem(item, storage = globalThis.localStorage) {
  if (!item || typeof item !== 'object') return null;
  if (item.source_kind === 'FESTIVAL' && typeof item.source_ref === 'string' && item.source_ref) {
    return Object.freeze({
      festivalId: item.source_ref,
      visitDate: civilDate(item.visit_date) || null,
      visitScope: item.visit_scope === VISIT_SCOPE.FULL_RANGE ? VISIT_SCOPE.FULL_RANGE : VISIT_SCOPE.DATE,
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
      entry,
    }, fetchImpl);
    const activityId = response?.activity_id || response?.activityId || '';
    if (activityId) writeFestivalCalendarLink(activityId, {festivalId: festival.id, visitDate: normalizedVisitDate, visitScope}, storage);
    return Object.freeze({status: 'CREATED', item: response});
  } catch (error) {
    return Object.freeze({status: 'ERROR', error});
  }
}
