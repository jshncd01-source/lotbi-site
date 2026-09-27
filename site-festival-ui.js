// FESTIVAL-EVENT-07/08 — public "축제·행사" browse + detail/program UI.
//
// Mounted on demand into the shared site modal shell (see openFestival() in
// site-conversation.js), exactly like mountPetFamilyManager() is mounted for
// the 반려동물 panel. Renders only what site-festival-client.js returns — that
// module is the only way this file ever touches festival data, and it is the
// enforced PUBLISHED-only boundary (see its allowlist normalizers). This
// module never calls any private/internal Core API directly.
//
// List/location/filter responsibilities (FESTIVAL-EVENT-07) vs. detail/
// program (FESTIVAL-EVENT-08, which owns the final consumer detail design):
// the browseFestivals()-backed list state lives in mountFestivalManager's
// opening section below; renderDetail() onward (detail header, CTA row,
// program date tabs, weather) is FESTIVAL-EVENT-08/09's surface, left exactly
// as that room built it.
//
// List card principle (revised): a card's own image/name is a direct link to
// the festival's official homepage (festival.homepageUrl, new tab) — it no
// longer opens LOTBI's internal detail screen, and there is no separate
// "detail view" affordance. Every internal action the detail screen used to
// gate behind that navigation is instead a direct action on the card itself:
// [프로그램] and [접수] lazy-fetch the festival's programs on click (browse
// items never carry programs) and open the same internal program/registration
// surfaces the detail screen uses; "+ 내 캘린더에 추가" and the 네이버지도/
// 카카오내비/TMAP deep links (site-navigation.js, the same builders the chat
// Place Card uses) need only fields the browse item already carries, so they
// render immediately, no fetch needed. All five keep their existing hide-
// when-not-applicable rules ([프로그램]/[접수] degrade to an empty-state
// message inside the popup instead of pre-hiding, since visibility can't be
// known before the lazy fetch resolves).
//
// The detail/CTA/program screens below (renderDetail() onward) still exist
// unchanged and are still reached by Calendar re-entry (FESTIVAL-EVENT-10):
// a quick "언제/어디서/무슨 프로그램/접수 가능여부" answer, at most two
// primary CTAs — [접수] (a popup listing every program that carries its own
// official reservation link, each opening separately) and [프로그램]
// (LOTBI's own internal date-tab program screen, never an external
// PROGRAM_PAGE handoff). The legacy 공식홈페이지/예약안내/주차·셔틀/공식출처
// sections are still gone from THIS surface: homepage_url/transport/notices/
// telephone are not read by normalizePublishedFestival/normalizeFestivalProgram
// (see site-festival-client.js), so nothing here can render a homepage
// button/section inside the detail/CTA/program screens — only the list
// card's own link uses homepageUrl.
import {
  FESTIVAL_STATUS,
  FESTIVAL_STATUS_LABEL,
  FESTIVAL_TIME_FILTER,
  FESTIVAL_TIME_FILTER_LABEL,
  browseFestivals,
  computeFestivalStatus,
  formatFestivalDateLabel,
  formatFestivalDateTabLabel,
  formatFestivalLocation,
  formatFestivalPeriod,
  getPublishedFestival,
  groupProgramsByDate,
  listFestivalRegions,
  resolveCurrentRegionLabel,
  selectInitialProgramDate,
} from './site-festival-client.js?v=aset-1817bacadd42';
import {createBottomSheet} from './site-bottom-sheet.js?v=aset-1817bacadd42';
import {
  BrowserLocationError,
  LOCATION_PERMISSION,
  getBrowserLocationPermissionState,
  getRecentBrowserCurrentLocation,
  acquireSharedBrowserCurrentLocation,
} from './site-current-location.js?v=aset-1817bacadd42';
// FESTIVAL-EVENT-10: "내 캘린더에 추가" reuses the existing LOTBI Calendar
// end to end (createLifeActivity() for authenticated users, the Guest
// Calendar repository's idempotency contract for signed-out visitors) — see
// site-festival-calendar.js's module header for why an authenticated user's
// festival link is a same-browser interim index rather than a Core field.
import {
  VISIT_SCOPE,
  addFestivalVisitToCalendar,
  festivalVisitDateOptions,
} from './site-festival-calendar.js?v=aset-1817bacadd42';
import {createGuestCalendarRepository} from './site-calendar-guest.js?v=aset-1817bacadd42';
// Reuses the exact same deep-link builders the chat Place Card uses
// (SITE-PLACE-CARD-MAP-DEEPLINK-01) — no new API key, no SDK, no re-derived
// URL scheme. Each open*Place() call already opens its own new browsing
// context (window.open(..., '_blank', 'noopener,noreferrer')).
import {
  isTmapHandoffAvailable,
  openKakaoNaviPlace,
  openNaverMapsPlace,
  openTmapPlace,
} from './site-navigation.js?v=aset-1817bacadd42';
// FESTIVAL-EVENT-09 already shipped venue-coordinate program-date weather on
// main (PR #337) against the previous flat program list; this reuses that
// same orchestration helper and the existing Calendar weather presentation
// helpers unchanged, now folded into this room's date tabs instead of a
// per-date-group heading. No new HTTP client, no re-normalization here.
import {getFestivalProgramWeather} from './site-festival-weather.js?v=aset-1817bacadd42';
import {
  calendarWeatherAttribution,
  calendarWeatherIconNode,
  weatherTemperatureLabel,
} from './site-calendar-weather.js?v=aset-1817bacadd42';

const PAGE_SIZE = 20;

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function chipButton(label, {pressed = false, onClick} = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'festival-chip';
  button.textContent = label;
  button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  if (typeof onClick === 'function') button.addEventListener('click', onClick);
  return button;
}

function statusBadge(status) {
  return el('span', `festival-status-badge festival-status-${status.toLowerCase()}`, FESTIVAL_STATUS_LABEL[status] || status);
}

function heroImage(festival, {compact = false} = {}) {
  const wrap = el('div', compact ? 'festival-hero' : 'festival-hero festival-hero-detail');
  if (festival.imageUrl) {
    const img = document.createElement('img');
    img.src = festival.imageUrl;
    img.alt = `${festival.name} 대표 이미지`;
    img.loading = 'lazy';
    img.addEventListener('error', () => {
      // A registered image_url that fails to actually load must degrade to
      // the same neutral placeholder as "no image", never a broken-image icon.
      img.remove();
      wrap.classList.add('festival-hero-placeholder');
      wrap.setAttribute('role', 'img');
      wrap.setAttribute('aria-label', `${festival.name} 대표 이미지 없음`);
    }, {once: true});
    wrap.appendChild(img);
  } else {
    wrap.classList.add('festival-hero-placeholder');
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', `${festival.name} 대표 이미지 없음`);
  }
  return wrap;
}

// Adapts a festival (base browse/detail fields only — never programs) into
// the generic {name, address, latitude, longitude, navigationCapable} shape
// site-navigation.js's deep-link builders expect from a Place Card result.
function festivalNavigablePlace(festival) {
  const navigationCapable = Number.isFinite(festival.latitude) && Number.isFinite(festival.longitude);
  return {name: festival.name, address: festival.address, latitude: festival.latitude, longitude: festival.longitude, navigationCapable};
}

// NAVER always renders (it falls back to a name+locality search when there is
// no coordinate). Kakao Navi needs a real destination coordinate — it has no
// search-by-name fallback, unlike NAVER/TMAP — so it is hidden without one.
// TMAP is mobile-app-only: rendering it on desktop would be a button that
// does nothing when pressed, which this codebase treats as worse than no
// button at all (see site-navigation.js's isTmapHandoffAvailable() comment).
function buildMapActionButtons(festival) {
  const place = festivalNavigablePlace(festival);
  const wrap = el('div', 'festival-card-map-actions');
  wrap.setAttribute('role', 'group');
  wrap.setAttribute('aria-label', `${festival.name} 길찾기`);

  const naver = document.createElement('button');
  naver.type = 'button';
  naver.className = 'festival-card-icon-button festival-card-map-naver';
  naver.textContent = '네이버지도';
  naver.setAttribute('aria-label', `${festival.name} 네이버지도, 새 창에서 열립니다`);
  naver.addEventListener('click', () => { openNaverMapsPlace(place); });
  wrap.appendChild(naver);

  if (place.navigationCapable) {
    const kakao = document.createElement('button');
    kakao.type = 'button';
    kakao.className = 'festival-card-icon-button festival-card-map-kakao';
    kakao.textContent = '카카오내비';
    kakao.setAttribute('aria-label', `${festival.name} 카카오내비, 새 창에서 열립니다`);
    kakao.addEventListener('click', () => { openKakaoNaviPlace(place); });
    wrap.appendChild(kakao);
  }

  if (isTmapHandoffAvailable()) {
    const tmap = document.createElement('button');
    tmap.type = 'button';
    tmap.className = 'festival-card-icon-button festival-card-map-tmap';
    tmap.textContent = 'TMAP';
    tmap.setAttribute('aria-label', `${festival.name} TMAP, 새 창에서 열립니다`);
    tmap.addEventListener('click', () => { openTmapPlace(place); });
    wrap.appendChild(tmap);
  }

  return wrap;
}

function buildCardActionRow(festival, {
  onOpenProgram, onOpenRegistration, authenticated, sessionToken, guestRepository, now,
}) {
  const row = el('div', 'festival-card-action-row');
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', `${festival.name} 축제 액션`);

  const programButton = document.createElement('button');
  programButton.type = 'button';
  programButton.className = 'festival-card-icon-button festival-card-action-program';
  programButton.textContent = '프로그램';
  programButton.addEventListener('click', () => onOpenProgram(festival.id));
  row.appendChild(programButton);

  const registrationButton = document.createElement('button');
  registrationButton.type = 'button';
  registrationButton.className = 'festival-card-icon-button festival-card-action-registration';
  registrationButton.textContent = '접수';
  registrationButton.addEventListener('click', () => onOpenRegistration(festival.id));
  row.appendChild(registrationButton);

  row.appendChild(buildCalendarAddSection(row, festival, {authenticated, sessionToken, guestRepository, now}));
  row.appendChild(buildMapActionButtons(festival));
  return row;
}

function buildCard(festival, now, {
  showDistance = false, onOpenProgram, onOpenRegistration, authenticated, sessionToken, guestRepository,
} = {}) {
  const status = computeFestivalStatus(festival, now);
  const card = el('article', 'festival-card');

  // The card's own image/name is a direct link out to the festival's
  // official homepage — it no longer opens LOTBI's internal detail screen.
  // Without a homepage_url there is nothing to link to, so the media block
  // stays a plain, non-interactive container (never a dead click target).
  const media = festival.homepageUrl ? document.createElement('a') : el('div');
  media.className = 'festival-card-open';
  if (festival.homepageUrl) {
    media.href = festival.homepageUrl;
    media.target = '_blank';
    media.rel = 'noopener noreferrer';
    media.referrerPolicy = 'no-referrer';
    media.setAttribute('aria-label', `${festival.name} 공식 홈페이지, 새 창에서 열립니다`);
  }

  media.appendChild(heroImage(festival, {compact: true}));
  const body = el('div', 'festival-card-body');
  body.appendChild(statusBadge(status));
  body.appendChild(el('h3', 'festival-card-name', festival.name));
  body.appendChild(el('p', 'festival-card-period', formatFestivalPeriod(festival)));
  const location = formatFestivalLocation(festival);
  if (location) body.appendChild(el('p', 'festival-card-location', location));
  // Distance only in current-location mode, and only when Core actually
  // returned a number — never a guessed/recomputed value, and hidden
  // (not a placeholder string) when Core did not send one.
  if (showDistance && typeof festival.distanceKm === 'number') {
    body.appendChild(el('p', 'festival-card-distance', `${festival.distanceKm}km`));
  }
  media.appendChild(body);
  card.appendChild(media);
  card.appendChild(buildCardActionRow(festival, {onOpenProgram, onOpenRegistration, authenticated, sessionToken, guestRepository, now}));
  return card;
}

// -------------------------------------------------------------- CTA row ---

// [접수] popup body: one row per program that actually carries its own
// official reservation_url (never the festival-level "first one found"
// shortcut) — a festival with several bookable programs must let a visitor
// reach each program's own official link, not just the first.
function buildRegistrationSheetBody(programs) {
  const wrap = el('div', 'festival-registration-sheet');
  wrap.appendChild(el('h3', 'festival-registration-sheet-title', '접수 가능한 프로그램'));
  if (!programs.length) {
    wrap.appendChild(el('p', 'festival-empty-note', '접수 가능한 프로그램이 없습니다.'));
    return wrap;
  }
  const list = document.createElement('ul');
  list.className = 'festival-registration-list';
  for (const program of programs) {
    const li = document.createElement('li');
    li.className = 'festival-registration-item';
    const link = document.createElement('a');
    link.className = 'festival-registration-link';
    link.href = program.participationUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.referrerPolicy = 'no-referrer';
    link.setAttribute('aria-label', `${program.title} 접수, 공식 외부 사이트가 새 창에서 열립니다`);
    link.appendChild(el('span', 'festival-registration-program-title', program.title));
    if (program.startTime) link.appendChild(el('span', 'festival-registration-program-time', program.startTime));
    if (program.venue) link.appendChild(el('span', 'festival-registration-program-venue', program.venue));
    li.appendChild(link);
    list.appendChild(li);
  }
  wrap.appendChild(list);
  return wrap;
}

function buildCtaRow(festival, {onOpenPrograms}) {
  const hasPrograms = Array.isArray(festival.programs) && festival.programs.length > 0;
  const hasParticipation = Boolean(festival.participationUrl);
  if (!hasPrograms && !hasParticipation) return null; // no CTA row at all — never an empty shell

  const row = el('div', 'festival-cta-row');
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', '축제 주요 액션');

  if (hasParticipation) {
    const registrablePrograms = festival.programs.filter(program => Boolean(program.participationUrl));
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'festival-cta-button festival-cta-registration';
    button.textContent = '접수';
    button.addEventListener('click', () => {
      const sheet = createBottomSheet({
        label: '접수 가능한 프로그램',
        content: () => buildRegistrationSheetBody(registrablePrograms),
      });
      sheet.open();
    });
    row.appendChild(button);
  }

  if (hasPrograms) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'festival-cta-button festival-cta-program';
    button.textContent = '프로그램';
    button.addEventListener('click', onOpenPrograms);
    row.appendChild(button);
  }

  return row;
}

// ---------------------------------------------------------- program view --

// Full Korean weekday date label for a tab's accessible name, e.g. "10월 10일
// 토요일" — independent of formatFestivalDateTabLabel()'s short visual "10/8
// 목", which a screen reader can read fine on its own but which reads better
// combined with the weather sentence below when weather is present.
function weekdayDateLabelKo(dateString) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateString || ''));
  if (!match) return '';
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  try {
    return new Intl.DateTimeFormat('ko-KR', {timeZone: 'UTC', month: 'long', day: 'numeric', weekday: 'long'}).format(date);
  } catch {
    return '';
  }
}

// One accessible sentence per date tab so a screen reader gets the full
// forecast once, instead of the visual weather badge (aria-hidden) being
// read as a separate, meaningless glyph. A date with no weather yet never
// claims a percentage or temperature it does not have.
function buildProgramDateAriaLabel(dateString, weatherItem) {
  const dateLabel = weekdayDateLabelKo(dateString);
  if (!weatherItem) return dateLabel;
  const segments = [dateLabel];
  if (weatherItem.label) segments.push(weatherItem.label);
  const hasMin = Number.isFinite(weatherItem.minTemperature);
  const hasMax = Number.isFinite(weatherItem.maxTemperature);
  if (hasMin && hasMax) segments.push(`최저 ${Math.round(weatherItem.minTemperature)}도 최고 ${Math.round(weatherItem.maxTemperature)}도`);
  else if (hasMax) segments.push(`최고 ${Math.round(weatherItem.maxTemperature)}도`);
  else if (hasMin) segments.push(`최저 ${Math.round(weatherItem.minTemperature)}도`);
  else if (Number.isFinite(weatherItem.temperature)) segments.push(`${Math.round(weatherItem.temperature)}도`);
  if (Number.isInteger(weatherItem.precipitationProbability)) segments.push(`강수확률 ${weatherItem.precipitationProbability}퍼센트`);
  return segments.join(', ');
}

// Visual-only weather badge appended inside a date-tab button.
// precipitationProbability is only ever rendered when Core actually sent an
// integer — a missing value hides the "강수 N%" segment entirely rather than
// showing a fabricated 0%.
function buildProgramDateWeatherBadge(weatherItem) {
  const badge = el('span', 'festival-program-weather');
  badge.setAttribute('aria-hidden', 'true');
  const icon = calendarWeatherIconNode(weatherItem.weatherKind, document);
  if (icon) badge.appendChild(icon);
  const parts = [];
  const tempLabel = weatherTemperatureLabel(weatherItem);
  if (tempLabel) parts.push(tempLabel);
  if (Number.isInteger(weatherItem.precipitationProbability)) parts.push(`강수 ${weatherItem.precipitationProbability}%`);
  if (parts.length) badge.appendChild(el('span', 'festival-program-weather-text', parts.join(' · ')));
  return badge;
}

function buildDateTabs(dateTabs, {selected, onSelect, weatherByDate}) {
  const nav = el('div', 'festival-date-tabs');
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-label', '프로그램 날짜 선택');

  dateTabs.forEach((tab, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'festival-date-tab';
    button.id = `festival-date-tab-${tab.date}`;
    button.setAttribute('role', 'tab');
    // Stable per-date identity for a later room (weather) to join
    // date -> weatherByDate on; never used for KMA/precipitation logic here.
    button.setAttribute('data-festival-program-date', tab.date);
    button.appendChild(document.createTextNode(formatFestivalDateTabLabel(tab.date)));
    const weatherItem = weatherByDate?.get(tab.date) || null;
    if (weatherItem) button.appendChild(buildProgramDateWeatherBadge(weatherItem));
    button.setAttribute('aria-label', buildProgramDateAriaLabel(tab.date, weatherItem));
    const isSelected = tab.date === selected;
    button.setAttribute('aria-selected', String(isSelected));
    button.tabIndex = isSelected ? 0 : -1;
    button.addEventListener('click', () => onSelect(tab.date));
    button.addEventListener('keydown', event => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      const nextIndex = (index + delta + dateTabs.length) % dateTabs.length;
      onSelect(dateTabs[nextIndex].date, {focus: true});
    });
    nav.appendChild(button);
  });

  return nav;
}

function buildProgramPanel(tab) {
  const panel = el('div', 'festival-program-day-panel');
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', `festival-date-tab-${tab.date}`);

  const ul = document.createElement('ul');
  ul.className = 'festival-program-list';
  for (const program of tab.programs) {
    const li = document.createElement('li');
    li.className = 'festival-program-item';
    const timeText = program.startTime
      ? (program.endTime ? `${program.startTime} ~ ${program.endTime}` : program.startTime)
      : '';
    if (timeText) li.appendChild(el('span', 'festival-program-time', timeText));
    li.appendChild(el('span', 'festival-program-title', program.title));
    if (program.venue) li.appendChild(el('span', 'festival-program-venue', program.venue));
    if (program.category) li.appendChild(el('span', 'festival-program-category', program.category));
    if (program.price) li.appendChild(el('span', 'festival-program-price', program.price));
    if (program.notes) li.appendChild(el('p', 'festival-program-note', program.notes));
    ul.appendChild(li);
  }
  panel.appendChild(ul);
  return panel;
}

// ---------------------------------------------- "내 캘린더에 추가" (utility) --

// PUBLISHED-only is already structural (every festival here came through
// getPublishedFestival()/listPublishedFestivals()). ENDED/CANCELLED never
// offer a *new* visit registration — the visit already happened, or the
// event will not.
function festivalCalendarAddEligible(festival, now) {
  const status = computeFestivalStatus(festival, now);
  return status !== FESTIVAL_STATUS.ENDED && status !== FESTIVAL_STATUS.CANCELLED;
}

// A deliberate personalization utility action, never folded into
// buildCtaRow()'s [접수]/[프로그램] primary pair — it writes through the
// existing LOTBI Calendar (site-festival-calendar.js), never a new store.
function buildCalendarAddSection(root, festival, {authenticated, sessionToken, guestRepository, now = new Date()}) {
  const wrap = el('div', 'festival-calendar-add');
  if (!festivalCalendarAddEligible(festival, now)) return wrap;

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'festival-calendar-add-trigger';
  trigger.textContent = '+ 내 캘린더에 추가';
  wrap.appendChild(trigger);

  const feedback = el('p', 'festival-calendar-add-feedback');
  feedback.hidden = true;
  wrap.appendChild(feedback);

  const announce = (message, {isError = false} = {}) => {
    feedback.hidden = false;
    feedback.textContent = message;
    feedback.setAttribute('role', isError ? 'alert' : 'status');
  };

  let disposeSheet = null;
  const closeSheet = ({restoreFocus = true} = {}) => {
    if (!disposeSheet) return;
    const dispose = disposeSheet;
    disposeSheet = null;
    dispose();
    if (restoreFocus) trigger.focus();
  };

  const submit = async (visitScope, visitDate) => {
    trigger.disabled = true;
    try {
      const result = await addFestivalVisitToCalendar({festival, visitDate, visitScope, authenticated, sessionToken, guestRepository});
      if (result.status === 'CREATED') {
        announce('캘린더에 추가했어요.');
        closeSheet();
      } else if (result.status === 'DUPLICATE') {
        announce('이미 캘린더에 추가되어 있어요.');
        closeSheet();
      } else {
        announce('캘린더에 추가하지 못했어요. 다시 시도해 주세요.', {isError: true});
      }
    } catch {
      announce('캘린더에 추가하지 못했어요. 다시 시도해 주세요.', {isError: true});
    } finally {
      trigger.disabled = false;
    }
  };

  const openSheet = () => {
    closeSheet({restoreFocus: false});
    const backdrop = el('div', 'festival-visit-sheet-backdrop');
    const dialog = el('div', 'festival-visit-sheet');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'festival-visit-sheet-title');

    const header = el('div', 'festival-visit-sheet-header');
    const title = el('h4', 'festival-visit-sheet-title', '방문할 날짜를 선택하세요');
    title.id = 'festival-visit-sheet-title';
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'festival-visit-sheet-close';
    closeButton.textContent = '×';
    closeButton.setAttribute('aria-label', '닫기');
    header.append(title, closeButton);

    const optionsList = el('div', 'festival-visit-sheet-options');
    optionsList.setAttribute('role', 'radiogroup');
    optionsList.setAttribute('aria-label', '방문 날짜');
    const optionButtons = [];
    let selected = null;

    const confirmButton = document.createElement('button');
    confirmButton.type = 'button';
    confirmButton.className = 'festival-visit-sheet-confirm';
    confirmButton.textContent = '추가';
    confirmButton.disabled = true;

    const selectOption = (node, value) => {
      selected = value;
      for (const optionNode of optionButtons) optionNode.setAttribute('aria-checked', String(optionNode === node));
      confirmButton.disabled = false;
    };

    const addOption = (label, value, className = 'festival-visit-option') => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = className;
      option.setAttribute('role', 'radio');
      option.setAttribute('aria-checked', 'false');
      option.textContent = label;
      option.addEventListener('click', () => selectOption(option, value));
      optionButtons.push(option);
      optionsList.appendChild(option);
      return option;
    };

    for (const date of festivalVisitDateOptions(festival)) {
      addOption(formatFestivalDateLabel(date), {scope: VISIT_SCOPE.DATE, date});
    }
    addOption('전체 기간', {scope: VISIT_SCOPE.FULL_RANGE, date: null}, 'festival-visit-option festival-visit-option-full');

    confirmButton.addEventListener('click', () => {
      if (!selected) return;
      void submit(selected.scope, selected.date);
    });

    const onKeydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); closeSheet(); }
    };
    closeButton.addEventListener('click', () => closeSheet());
    backdrop.addEventListener('click', event => { if (event.target === backdrop) closeSheet(); });
    dialog.addEventListener('keydown', onKeydown);

    dialog.append(header, optionsList, confirmButton);
    backdrop.appendChild(dialog);
    root.appendChild(backdrop);
    disposeSheet = () => backdrop.remove();
    (optionButtons[0] || closeButton).focus();
  };

  trigger.addEventListener('click', openSheet);
  return wrap;
}

/**
 * @param {{
 *   root: HTMLElement, fetchImpl?: typeof fetch, now?: Date, selectedDate?: string,
 *   sessionToken?: string, guestRepository?: object, initialFestivalId?: string,
 * }} options
 */
export async function mountFestivalManager({
  root, fetchImpl = globalThis.fetch, now = new Date(), selectedDate,
  sessionToken = '', guestRepository = null, initialFestivalId = '',
} = {}) {
  if (!(root instanceof HTMLElement)) throw new TypeError('root is required');
  root.replaceChildren();

  const authenticated = typeof sessionToken === 'string' && Boolean(sessionToken.trim());
  const repository = authenticated ? null : (guestRepository || createGuestCalendarRepository(globalThis.localStorage));

  const state = {
    region: '',
    time: FESTIVAL_TIME_FILTER.ALL,
    customDate: '',
    locationMode: 'NONE', // 'NONE' | 'CURRENT'
    currentPosition: null,
    currentRegionLabel: '',
    locationPermission: LOCATION_PERMISSION.UNKNOWN,
    locationBusy: false,
    // 아직 현재 위치를 확인하는 중이라는 뜻. 이 값이 켜져 있는 동안에는 '전국' 을
    // 쓰지 않는다: 확인이 끝나기 전에 전국이라고 적으면 곧 지역으로 바뀌므로
    // 사용자가 처음 보는 화면이 사실과 다르다.
    locationResolving: false,
  };
  let regionProvinces = [];
  let regionProvincesPromise = null;
  let requestToken = 0;
  let currentAbort = null;
  let nextOffset = 0;
  let hasMore = false;
  let regionSheetRef = null;

  const container = el('div', 'festival-manager');
  const locationBanner = el('div', 'festival-location-banner');
  const filterBar = el('div', 'festival-filter-bar');
  filterBar.setAttribute('role', 'group');
  filterBar.setAttribute('aria-label', '시간 필터');
  const timeRow = el('div', 'festival-chip-row festival-time-row');
  timeRow.setAttribute('role', 'group');
  timeRow.setAttribute('aria-label', '시간 필터');
  const dateField = document.createElement('label');
  dateField.className = 'festival-date-field';
  dateField.hidden = true;
  dateField.append(el('span', '', '날짜 선택'));
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateField.appendChild(dateInput);
  filterBar.append(timeRow, dateField);

  const liveRegion = el('p', 'sr-only');
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', 'polite');
  const status = el('p', 'festival-status');
  status.setAttribute('role', 'status');
  const error = el('p', 'festival-error');
  error.setAttribute('role', 'alert');
  error.hidden = true;
  const retryButton = document.createElement('button');
  retryButton.type = 'button';
  retryButton.className = 'festival-retry-button';
  retryButton.textContent = '다시 시도';
  retryButton.hidden = true;
  retryButton.addEventListener('click', () => fetchAndRender({reset: true}));
  const empty = el('p', 'festival-empty');
  empty.hidden = true;
  const grid = el('div', 'festival-card-grid');
  const loadMoreButton = document.createElement('button');
  loadMoreButton.type = 'button';
  loadMoreButton.className = 'festival-load-more';
  loadMoreButton.textContent = '더 보기';
  loadMoreButton.hidden = true;
  loadMoreButton.addEventListener('click', () => fetchAndRender({reset: false}));
  const listSurface = el('div', 'festival-list-surface');
  listSurface.append(locationBanner, filterBar, liveRegion, status, error, retryButton, empty, grid, loadMoreButton);

  const detailSurface = el('div', 'festival-detail-surface');
  detailSurface.hidden = true;

  const programSurface = el('div', 'festival-program-surface');
  programSurface.hidden = true;

  container.append(listSurface, detailSurface, programSurface);
  root.appendChild(container);

  function ensureRegionProvinces() {
    if (!regionProvincesPromise) {
      regionProvincesPromise = listFestivalRegions(fetchImpl).then(result => {
        regionProvinces = result.provinces;
        return regionProvinces;
      });
    }
    return regionProvincesPromise;
  }
  void ensureRegionProvinces();

  function renderLocationBanner() {
    locationBanner.replaceChildren();
    const label = el('span', 'festival-location-label');
    if (state.region) {
      label.textContent = `📍 ${state.region}`;
    } else if (state.locationMode === 'CURRENT') {
      label.textContent = state.currentRegionLabel
        ? `📍 현재 위치 기준 · ${state.currentRegionLabel}`
        : '📍 현재 위치 기준';
    } else if (state.locationResolving || state.locationBusy) {
      label.textContent = '📍 현재 위치 확인 중…';
    } else {
      label.textContent = '📍 전국';
    }
    locationBanner.appendChild(label);

    const actions = el('div', 'festival-location-actions');
    if (state.locationBusy) {
      // 확인 중에는 "현재 위치로 보기" 를 다시 누를 이유가 없으므로 그 자리에
      // 진행 상태를 보여준다.
      actions.appendChild(el('span', 'festival-location-busy', '현재 위치 확인 중...'));
    } else if (state.locationMode !== 'CURRENT' && state.locationPermission !== LOCATION_PERMISSION.DENIED) {
      const useLocationButton = document.createElement('button');
      useLocationButton.type = 'button';
      useLocationButton.className = 'festival-location-button';
      useLocationButton.textContent = '현재 위치로 보기';
      useLocationButton.addEventListener('click', () => void useCurrentLocation({auto: false}));
      actions.appendChild(useLocationButton);
    }
    // 지역 변경은 어떤 상태에서도 누를 수 있다. 현재 위치를 확인하는 중이라는 것이
    // 사용자가 직접 지역을 고르는 것을 막을 이유는 되지 않는다 -- 데스크톱에서는
    // 위치 확인에 몇 초가 걸리고, 그 동안 화면이 잠겨 있으면 고장으로 읽힌다 (§23).
    const regionButton = document.createElement('button');
    regionButton.type = 'button';
    regionButton.className = 'festival-location-button';
    regionButton.textContent = '지역 변경';
    regionButton.addEventListener('click', () => void openRegionSheet());
    actions.appendChild(regionButton);
    locationBanner.appendChild(actions);
  }

  async function openRegionSheet() {
    await ensureRegionProvinces();
    regionSheetRef = createBottomSheet({
      label: '지역 변경',
      content: () => buildRegionSheetBody(),
      onClose: () => { regionSheetRef = null; },
    });
    regionSheetRef.open();
  }

  function buildRegionSheetBody() {
    const wrap = el('div', 'festival-region-sheet');
    wrap.appendChild(el('h3', 'festival-region-sheet-title', '지역 변경'));
    const list = el('div', 'festival-region-list');
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', '광역시·도 선택');
    for (const province of regionProvinces) {
      const optionButton = document.createElement('button');
      optionButton.type = 'button';
      optionButton.className = 'festival-region-option';
      optionButton.setAttribute('role', 'option');
      const selected = state.region === province;
      optionButton.setAttribute('aria-selected', String(selected));
      if (selected) optionButton.classList.add('is-selected');
      optionButton.textContent = province;
      optionButton.addEventListener('click', () => {
        selectManualRegion(province);
        regionSheetRef?.close();
      });
      list.appendChild(optionButton);
    }
    wrap.appendChild(list);
    if (state.locationPermission !== LOCATION_PERMISSION.DENIED) {
      const backButton = document.createElement('button');
      backButton.type = 'button';
      backButton.className = 'festival-region-current-button';
      backButton.textContent = '현재 위치로 돌아가기';
      backButton.addEventListener('click', () => {
        regionSheetRef?.close();
        void useCurrentLocation({auto: false});
      });
      wrap.appendChild(backButton);
    }
    return wrap;
  }

  function selectManualRegion(province) {
    state.region = province;
    state.locationMode = 'NONE';
    state.currentPosition = null;
    state.currentRegionLabel = '';
    renderLocationBanner();
    void fetchAndRender({reset: true});
  }

  // sharedPosition 이 넘어오면 그 좌표를 쓴다: 이미 손에 있는 값이므로 브라우저에
  // 좌표를 새로 묻지 않고, 따라서 권한 팝업이 뜰 여지도 없다.
  async function useCurrentLocation({auto = false, sharedPosition = null} = {}) {
    state.locationBusy = true;
    renderLocationBanner();
    try {
      // 캘린더 날씨가 방금 현재 위치를 읽었다면 그 좌표를 그대로 쓴다 -- 같은
      // 브라우저·같은 origin 의 권한이고 같은 위치다 (§2/§8).
      const position = sharedPosition ?? await acquireSharedBrowserCurrentLocation();
      // 좌표를 기다리는 동안 사용자가 직접 지역을 골랐다면 그 선택이 이긴다 (§22).
      // 자동 경로는 아무도 누르지 않은 요청이므로, 사람이 고른 것을 덮지 않는다.
      if (auto && state.region) return;
      state.currentPosition = {latitude: position.latitude, longitude: position.longitude};
      state.region = '';
      state.locationMode = 'CURRENT';
      state.currentRegionLabel = resolveCurrentRegionLabel(position.latitude, position.longitude);
      state.locationPermission = LOCATION_PERMISSION.GRANTED;
    } catch (locationError) {
      if (locationError instanceof BrowserLocationError && locationError.code === 'BROWSER_LOCATION_DENIED') {
        state.locationPermission = LOCATION_PERMISSION.DENIED;
      }
      state.locationMode = 'NONE';
      state.currentPosition = null;
      state.currentRegionLabel = '';
      if (auto) console.warn('[LOTBI 축제·행사] 허용된 위치 권한으로 현재 위치를 확인하지 못했습니다.', locationError);
    } finally {
      state.locationBusy = false;
      state.locationResolving = false;
      renderLocationBanner();
    }
    await fetchAndRender({reset: true});
  }

  function selectTimeFilter(key) {
    state.time = key;
    for (const [value, button] of timeButtons) button.setAttribute('aria-pressed', String(value === key));
    dateField.hidden = key !== FESTIVAL_TIME_FILTER.DATE;
    if (key === FESTIVAL_TIME_FILTER.DATE) {
      if (state.customDate) void fetchAndRender({reset: true});
      return;
    }
    void fetchAndRender({reset: true});
  }

  const timeButtons = new Map();
  for (const key of Object.values(FESTIVAL_TIME_FILTER)) {
    const button = chipButton(FESTIVAL_TIME_FILTER_LABEL[key], {
      pressed: state.time === key,
      onClick: () => selectTimeFilter(key),
    });
    timeButtons.set(key, button);
    timeRow.appendChild(button);
  }
  dateInput.addEventListener('change', () => {
    state.customDate = dateInput.value || '';
    if (state.customDate) void fetchAndRender({reset: true});
  });

  function buildQuery(offset) {
    const query = {time: state.time, limit: PAGE_SIZE, offset};
    if (state.time === FESTIVAL_TIME_FILTER.DATE && state.customDate) query.date = state.customDate;
    if (state.region) {
      query.region = state.region;
    } else if (state.locationMode === 'CURRENT' && state.currentPosition) {
      query.latitude = state.currentPosition.latitude;
      query.longitude = state.currentPosition.longitude;
    }
    return query;
  }

  function emptyMessageFor() {
    if (state.region) return `현재 조건에 맞는 축제·행사가 없어요 (${state.region})`;
    if (state.locationMode === 'CURRENT') return '현재 위치 주변에 조건에 맞는 축제·행사가 없어요';
    return '현재 조건에 맞는 축제·행사가 없어요';
  }

  function showList() {
    programSurface.hidden = true;
    detailSurface.hidden = true;
    listSurface.hidden = false;
    if (!listLoaded) void fetchAndRender({reset: true});
  }

  let listLoaded = false;
  async function fetchAndRender({reset}) {
    listLoaded = true;
    const token = ++requestToken;
    if (currentAbort) currentAbort.abort();
    const controller = new AbortController();
    currentAbort = controller;

    if (reset) {
      nextOffset = 0;
      grid.replaceChildren();
      status.hidden = false;
      status.textContent = '축제·행사를 불러오는 중이에요';
      error.hidden = true;
      retryButton.hidden = true;
      empty.hidden = true;
      loadMoreButton.hidden = true;
    } else {
      loadMoreButton.disabled = true;
      loadMoreButton.textContent = '불러오는 중...';
    }

    const query = buildQuery(reset ? 0 : nextOffset);
    const scopedFetch = (input, init) => fetchImpl(input, {...init, signal: controller.signal});

    try {
      const result = await browseFestivals(query, scopedFetch);
      if (token !== requestToken) return;
      status.hidden = true;
      if (reset && !result.festivals.length) {
        empty.hidden = false;
        empty.textContent = emptyMessageFor();
      }
      const showDistance = state.locationMode === 'CURRENT';
      for (const festival of result.festivals) {
        grid.appendChild(buildCard(festival, now, {
          showDistance,
          onOpenProgram: openProgramFromCard,
          onOpenRegistration: openRegistrationFromCard,
          authenticated,
          sessionToken,
          guestRepository: repository,
        }));
      }
      hasMore = result.hasMore;
      nextOffset = result.nextOffset ?? nextOffset + result.festivals.length;
      loadMoreButton.hidden = !hasMore;
      liveRegion.textContent = result.festivals.length
        ? `축제·행사 ${result.totalCount}건 중 ${grid.children.length}건을 보여주고 있어요.`
        : emptyMessageFor();
    } catch (fetchError) {
      if (token !== requestToken) return;
      if (fetchError?.name === 'AbortError') return;
      status.hidden = true;
      error.hidden = false;
      error.textContent = '축제·행사 정보를 불러오지 못했어요.';
      retryButton.hidden = false;
    } finally {
      if (token === requestToken) {
        loadMoreButton.disabled = false;
        loadMoreButton.textContent = '더 보기';
      }
    }
  }

  function renderProgramSurface(festival, detailToken, {onBack} = {}) {
    programSurface.replaceChildren();

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'festival-back-button';
    back.textContent = onBack ? '← 목록으로' : '← 행사 정보로';
    back.addEventListener('click', () => {
      programSurface.hidden = true;
      if (onBack) onBack();
      else detailSurface.hidden = false;
    });
    programSurface.appendChild(back);

    const dateTabs = groupProgramsByDate(festival.programs);
    if (!dateTabs.length) {
      programSurface.appendChild(el('p', 'festival-empty-note', '등록된 프로그램 정보가 없습니다.'));
      return;
    }

    const body = el('div', 'festival-program-body');
    const weatherAttribution = el('p', 'festival-weather-attribution');
    weatherAttribution.hidden = true;
    programSurface.append(body, weatherAttribution);

    let selected = selectInitialProgramDate(dateTabs, {selectedDate, now});
    let weatherByDate = null;

    function paint(focusDate) {
      body.replaceChildren();
      const tabsNav = buildDateTabs(dateTabs, {
        selected,
        weatherByDate,
        onSelect: (date, options = {}) => {
          selected = date;
          paint(options.focus ? date : undefined);
        },
      });
      body.appendChild(tabsNav);
      const activeTab = dateTabs.find(tab => tab.date === selected) || dateTabs[0];
      body.appendChild(buildProgramPanel(activeTab));
      if (focusDate) tabsNav.querySelector(`[data-festival-program-date="${focusDate}"]`)?.focus();
    }

    paint();

    // Program stays visible immediately; weather (venue coordinates only,
    // never the visitor's own location) fills the date-tab badges in once it
    // resolves, or never, if there is no usable venue coordinate, no
    // program, or the read fails — the program surface is never blocked on
    // this. Called from exactly this one place, never per tab click.
    if (festival.programs.length && Number.isFinite(festival.latitude) && Number.isFinite(festival.longitude)) {
      getFestivalProgramWeather({festival, fetchImpl}).then(result => {
        if (detailToken !== requestToken) return;
        if (!result.ok) return;
        weatherByDate = result.byDate.size ? result.byDate : null;
        paint();
        const attribution = weatherByDate ? calendarWeatherAttribution(result.items) : null;
        weatherAttribution.hidden = !attribution;
        weatherAttribution.textContent = attribution ? attribution.text : '';
      });
    }
  }

  function openProgramSurface(festival, detailToken, {onBack} = {}) {
    listSurface.hidden = true;
    detailSurface.hidden = true;
    programSurface.hidden = false;
    renderProgramSurface(festival, detailToken, {onBack});
  }

  // Lazy per-card fetch: browse items never carry programs, so [프로그램]/
  // [접수] on a list card fetch the one festival's detail on click, not for
  // every visible card up front (no N+1 on the browse list). A fetch failure
  // degrades to the same empty-state copy as a real "no programs" festival —
  // never a stuck spinner or a thrown error into an onClick handler.
  async function openProgramFromCard(festivalId) {
    const token = ++requestToken;
    let festival = null;
    try {
      festival = await getPublishedFestival(festivalId, fetchImpl);
    } catch {
      festival = null;
    }
    if (token !== requestToken) return;
    openProgramSurface(festival || {programs: []}, token, {onBack: showList});
  }

  async function openRegistrationFromCard(festivalId) {
    let festival = null;
    try {
      festival = await getPublishedFestival(festivalId, fetchImpl);
    } catch {
      festival = null;
    }
    const programs = festival && Array.isArray(festival.programs)
      ? festival.programs.filter(program => Boolean(program.participationUrl))
      : [];
    const sheet = createBottomSheet({
      label: '접수 가능한 프로그램',
      content: () => buildRegistrationSheetBody(programs),
    });
    sheet.open();
  }

  async function renderDetail(id, {autoOpenProgram = false} = {}) {
    listSurface.hidden = true;
    programSurface.hidden = true;
    detailSurface.hidden = false;
    detailSurface.replaceChildren();

    const loading = el('p', 'festival-status', '축제·행사 정보를 불러오는 중이에요.');
    loading.setAttribute('role', 'status');
    detailSurface.appendChild(loading);

    // Shares fetchAndRender()'s own requestToken: opening festival B's detail
    // before festival A's fetch (or A's later program-weather read) resolves
    // must never let A's late response land on B's now-visible screen.
    const detailToken = ++requestToken;

    let festival = null;
    let failed = false;
    try {
      festival = await getPublishedFestival(id, fetchImpl);
    } catch {
      failed = true;
    }
    if (detailToken !== requestToken) return;

    detailSurface.replaceChildren();

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'festival-back-button';
    back.textContent = '← 목록으로';
    back.addEventListener('click', showList);
    detailSurface.appendChild(back);

    if (failed) {
      const message = el('p', 'festival-error', '축제·행사 정보를 불러오지 못했어요.');
      message.setAttribute('role', 'alert');
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'festival-retry-button';
      retry.textContent = '다시 시도';
      retry.addEventListener('click', () => renderDetail(id));
      detailSurface.append(message, retry);
      return;
    }

    if (!festival) {
      const message = el('p', 'festival-error', '축제·행사 정보를 찾을 수 없어요.');
      message.setAttribute('role', 'alert');
      const toList = document.createElement('button');
      toList.type = 'button';
      toList.className = 'festival-retry-button';
      toList.textContent = '목록으로 돌아가기';
      toList.addEventListener('click', showList);
      detailSurface.append(message, toList);
      return;
    }

    detailSurface.appendChild(heroImage(festival));

    const header = el('div', 'festival-detail-header');
    header.appendChild(statusBadge(computeFestivalStatus(festival, now)));
    header.appendChild(el('h3', 'festival-detail-name', festival.name));
    header.appendChild(el('p', 'festival-detail-period', formatFestivalPeriod(festival)));
    const location = formatFestivalLocation(festival);
    if (location) header.appendChild(el('p', 'festival-detail-location', location));
    if (festival.summary) header.appendChild(el('p', 'festival-detail-summary', festival.summary));
    detailSurface.appendChild(header);

    const ctaRow = buildCtaRow(festival, {onOpenPrograms: () => openProgramSurface(festival, detailToken)});
    if (ctaRow) detailSurface.appendChild(ctaRow);
    detailSurface.appendChild(buildCalendarAddSection(detailSurface, festival, {authenticated, sessionToken, guestRepository: repository, now}));

    // Calendar re-entry (FESTIVAL-EVENT-10): landing on the detail alone is
    // not the contract — a visit saved from the Calendar reopens straight
    // into the program screen, on the visited date's tab when there is one
    // (selectInitialProgramDate, via the outer selectedDate closure), or
    // Room08's own default policy for a 전체 기간 visit with no single date.
    if (autoOpenProgram && festival.programs.length) openProgramSurface(festival, detailToken);
  }

  if (initialFestivalId) {
    await renderDetail(initialFestivalId, {autoOpenProgram: true});
  } else {
    // 권한을 확인하는 동안에도 '전국' 이라고 적지 않는다. 허용해 둔 사용자는 곧
    // 자기 지역으로 바뀔 것이고, 그 전에 전국을 보여주면 처음 보는 화면이 틀린다.
    state.locationResolving = true;
    renderLocationBanner();

    state.locationPermission = await getBrowserLocationPermissionState();
    // 권한 읽기가 먼저다: DENIED/UNAVAILABLE 을 읽는 순간 공통 계층이 들고 있던
    // 좌표도 사라지므로, 권한이 꺼진 뒤에 남은 좌표를 쓰는 일은 생기지 않는다 (§8).
    //
    // 그 다음에야 "이미 가진 좌표" 를 본다. iPhone Safari 처럼 권한 상태를 알려주지
    // 않는 브라우저는 사용자가 허용해 두었어도 UNKNOWN 으로 읽힌다. 그렇다고 좌표를
    // 새로 물으면 아직 허용하지 않은 사용자에게 팝업이 뜨므로 그것은 하지 않는다(§5/§18).
    // 다만 캘린더 날씨가 방금 읽어 둔 좌표가 손에 있다면 그것은 써도 된다 --
    // 새 요청이 아니라 이미 받은 값이고, 팝업이 뜰 수 없다 (§8).
    const sharedPosition = getRecentBrowserCurrentLocation();
    if (state.locationPermission === LOCATION_PERMISSION.GRANTED || sharedPosition) {
      // 좌표가 도착할 때까지 배너는 '현재 위치 확인 중…' 을 유지한다.
      await useCurrentLocation({auto: true, sharedPosition});
    } else {
      // 현재 위치로 열 수 없는 것이 확정됐다: 이제 전국이라고 적어도 사실이다.
      state.locationResolving = false;
      renderLocationBanner();
      await fetchAndRender({reset: true});
    }
  }

  return {
    dispose() {
      requestToken += 1;
      currentAbort?.abort();
      regionSheetRef?.close();
    },
  };
}

// Exported for tests / potential reuse; kept out of the main render path
// above where not needed directly.
export {formatFestivalDateLabel};
