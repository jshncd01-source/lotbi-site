// FESTIVAL-EVENT-07 — time filters, pagination/race safety, card rendering,
// no-fixture-in-production, and accessibility/responsive contracts.
//
// Static source + CSS assertions (no browser), consistent with the other
// festival validate scripts and with scripts/validate_composer_interaction.mjs.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

const ui = read('site-festival-ui.js');
const clientJs = read('site-festival-client.js');
const css = read('site-festival.css');

// ---------------------------------------------------------- time filters --
assert.match(ui, /for \(const key of Object\.values\(FESTIVAL_TIME_FILTER\)\)/,
  'the 5 time filter buttons must be generated from the shared enum, not hand-duplicated copy');
assert.doesNotMatch(ui, /'오늘'|'날짜별'|'지역별'/, 'the old 오늘/지역별/날짜별 structure must be fully removed');

// DATE must never fire a query before a date is chosen (Core requires it and
// rejects FESTIVAL_DATE_REQUIRED otherwise) — both the tab click and the
// date <input> change handler must gate on state.customDate.
assert.match(
  ui,
  /if \(key === FESTIVAL_TIME_FILTER\.DATE\) \{\s*if \(state\.customDate\) void fetchAndRender\(\{reset: true\}\);\s*return;\s*\}/,
  'selecting the 날짜 선택 tab must not query Core until a date is actually picked',
);
assert.match(
  ui,
  /dateInput\.addEventListener\('change', \(\) => \{\s*state\.customDate = dateInput\.value \|\| '';\s*if \(state\.customDate\) void fetchAndRender\(\{reset: true\}\);\s*\}\);/,
  'picking a date must trigger exactly one reset fetch, scoped by state.customDate',
);
assert.match(ui, /dateInput\.type = 'date'/);

// ------------------------------------------------------- pagination/race --
// A request-token + AbortController pair must guard every fetch: a filter
// change replaces the list (reset), a "더 보기" click appends (no reset), and
// a stale response arriving late must never overwrite a newer one.
assert.match(ui, /let requestToken = 0;/);
assert.match(ui, /let currentAbort = null;/);
assert.match(ui, /const token = \+\+requestToken;/);
assert.match(ui, /if \(currentAbort\) currentAbort\.abort\(\);/, 'starting a new fetch must cancel any in-flight one');
assert.match(ui, /const controller = new AbortController\(\);/);
assert.match(ui, /if \(token !== requestToken\) return;/, 'a stale response must be dropped by token comparison before touching the DOM');
assert.match(ui, /if \(fetchError\?\.name === 'AbortError'\) return;/, 'an aborted stale request must not surface as a user-visible error');
assert.match(ui, /if \(reset\) \{\s*nextOffset = 0;\s*grid\.replaceChildren\(\);/, 'a reset (filter/region/time change) must zero the offset and replace the list, never append to stale cards');
assert.match(ui, /loadMoreButton\.hidden = !hasMore;/, '더 보기 visibility must follow Core\'s has_more, not a guessed page count');
assert.match(ui, /query\.offset|offset: reset \? 0 : nextOffset|buildQuery\(reset \? 0 : nextOffset\)/,
  'load-more must resume from Core\'s own nextOffset/cursor, not an arbitrary client-computed offset');

// -------------------------------------------------------------- ordering --
// Core's browse ordering is authoritative: the UI must render results in the
// order returned and must not re-sort them (the old fixture-era sortFestivals
// must be gone from the client entirely).
assert.doesNotMatch(clientJs, /function sortFestivals\(/, 'the fixture-era client-side festival re-sort must be removed');
assert.doesNotMatch(ui, /\.sort\(/, 'site-festival-ui.js must never re-sort a browse page — Core\'s order is authoritative');

// --------------------------------------------------------- card rendering --
assert.match(ui, /img\.addEventListener\('error', showPlaceholder/, 'a broken representative-photo load must fall back to the placeholder, not a dead broken-image icon');
assert.match(
  ui,
  /if \(showDistance && typeof festival\.distanceKm === 'number'\) \{\s*body\.appendChild\(el\('p', 'festival-list-card-distance', `\$\{festival\.distanceKm\}km`\)\);\s*\}/,
  'distance must render only in current-location mode and only when Core actually returned a number',
);
assert.doesNotMatch(ui, /알수없음|거리 정보 없음|0km/, 'no fake/placeholder distance text may ever be shown');
assert.doesNotMatch(`${ui}\n${clientJs}`, /unsplash\.com|picsum\.photos|placeholder\.com|placehold\.co/i,
  'no stock/placeholder photo service may be referenced — a missing image_url must fall back to the no-image state, never a substitute photo');

// A list card must stay list-scoped: it must not render program/reservation/
// parking/official-source detail sections (those are FESTIVAL-EVENT-08's
// detail surface, not the card).
const buildListCardBody = /function buildListCard\([\s\S]*?\n\}\n/.exec(ui)?.[0] || '';
assert.ok(buildListCardBody, 'buildListCard must exist');
for (const forbidden of ['buildProgramSection', 'buildReservationSection', 'buildParkingShuttleSection', 'buildOfficialSourceSection']) {
  assert.ok(!buildListCardBody.includes(forbidden), `the list card must not render ${forbidden} — that belongs to the detail surface only`);
}

// -------------------------------------------------- no-fixture-in-production
assert.doesNotMatch(ui, /FESTIVAL_FIXTURES|FESTIVAL_API_ENABLED/, 'the UI must not reference any fixture toggle');
assert.match(clientJs, /GET \/festivals\/browse|\/festivals\/browse/, 'the client must target the real Core browse endpoint');
assert.match(clientJs, /\/festivals\/regions/, 'the client must target the real Core region catalog endpoint');

// ------------------------------------------------------------ empty/error --
assert.match(ui, /축제·행사를 불러오는 중이에요/, 'loading copy must use the renamed 축제·행사 category');
assert.match(ui, /축제·행사 정보를 불러오지 못했어요/, 'error copy must use the renamed category and must not mention a fixture fallback');
assert.match(ui, /'다시 시도'/, 'a Core fetch failure must offer an explicit retry, never a silent fixture substitution');
assert.match(ui, /function emptyMessageFor\(state\)/);

// --------------------------------------------------------- accessibility --
assert.match(ui, /liveRegion\.setAttribute\('role', 'status'\);/);
assert.match(ui, /liveRegion\.setAttribute\('aria-live', 'polite'\);/);
assert.match(ui, /error\.setAttribute\('role', 'alert'\);/);
assert.match(ui, /list\.setAttribute\('role', 'listbox'\);/);
assert.match(ui, /optionButton\.setAttribute\('role', 'option'\);/);
assert.match(ui, /optionButton\.setAttribute\('aria-selected', String\(selected\)\);/);
assert.match(ui, /aria-label=`\$\{festival\.name\} 상세 보기`|`\$\{festival\.name\} 상세 보기`/, 'each card must expose an accessible label including the festival name');

assert.match(css, /\.festival-chip \{[^}]*min-height:\s*44px/, 'time-filter/region chips must meet the 44px touch-target minimum');
assert.match(css, /\.festival-region-option \{[^}]*min-height:\s*44px/);
assert.match(css, /\.festival-load-more \{[^}]*min-height:\s*44px/);
assert.match(css, /\.festival-date-field input\[type="date"\][^{]*\{[^}]*font-size:\s*16px/, 'the date input must stay >=16px to avoid iOS Safari zoom');

// Responsive: the list grid must default to a single column (no fixed
// minmax() width that could overflow at 320px) and only widen on desktop.
assert.match(css, /\.festival-list-grid \{[^}]*grid-template-columns:\s*1fr;/);
assert.match(css, /@media \(min-width: 640px\) \{\s*\.festival-list-grid \{\s*grid-template-columns:\s*repeat\(2, 1fr\);/);

console.log('FESTIVAL FILTERS/PAGINATION/CARD/ACCESSIBILITY VALIDATION PASS — 5-filter time bar, DATE gating, request-token+AbortController race safety, Core-authoritative ordering, card rendering rules, no-fixture-in-production, and accessibility/responsive contracts verified.');
