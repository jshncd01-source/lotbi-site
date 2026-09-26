// FESTIVAL-EVENT-09 — festival program-date weather.
//
// Covers the orchestration helper (site-festival-weather.js) end-to-end with
// a stubbed fetch (venue-coordinate gating, single request per whole date
// range, 15-day clamp, fail-soft on network/429/500/malformed, provider_ready
// passthrough, partial forecast coverage, in-flight dedupe, no long-term
// cache), the coordinate allowlist in site-festival-client.js, and the
// structural/accessibility contracts of the UI wiring in site-festival-ui.js
// (same static-assertion style as scripts/validate_festival_nav_wiring_01.mjs).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

const {getFestivalProgramWeather, hasUsableFestivalCoordinates} =
  await import('../site-festival-weather.js?v=validate-festival-weather-01');
const {normalizePublishedFestival} =
  await import('../site-festival-client.js?v=validate-festival-weather-01');

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
}

const WEATHER_FIXTURE = Object.freeze({
  provider_ready: true,
  ai_calls: 0,
  items: [
    {date: '2026-10-08', weather_kind: 'CLEAR', weather_icon: '☀️', source: 'KMA_SHORT', issued_at: '2026-10-07T23:00:00Z', min_temperature_c: 18, max_temperature_c: 24, precipitation_probability: 10},
    {date: '2026-10-09', weather_kind: 'RAIN', weather_icon: '🌧️', source: 'KMA_SHORT', issued_at: '2026-10-07T23:00:00Z', min_temperature_c: 16, max_temperature_c: 20, precipitation_probability: 80},
    {date: '2026-10-10', weather_kind: 'CLOUDY', weather_icon: '☁️', source: 'KMA_MID', issued_at: '2026-10-07T06:00:00Z', precipitation_probability: 0},
  ],
});

function festival(overrides = {}) {
  return {
    id: 'fest_test',
    startDate: '2026-10-08',
    endDate: '2026-10-10',
    latitude: 35.8151,
    longitude: 127.1535,
    programs: [{id: 'p1'}],
    ...overrides,
  };
}

// A. venue-coordinate gating: null/invalid never reach the network ----------
{
  let calls = 0;
  const result = await getFestivalProgramWeather({
    festival: festival({latitude: null, longitude: null}),
    fetchImpl: async () => { calls += 1; return jsonResponse(WEATHER_FIXTURE); },
  });
  assert.equal(calls, 0, 'null venue coordinates must never trigger a network call');
  assert.equal(result.ok, false);
  assert.equal(result.byDate.size, 0);
}
{
  let calls = 0;
  const result = await getFestivalProgramWeather({
    festival: festival({latitude: 95, longitude: 200}),
    fetchImpl: async () => { calls += 1; return jsonResponse(WEATHER_FIXTURE); },
  });
  assert.equal(calls, 0, 'out-of-range venue coordinates must never trigger a network call');
  assert.equal(result.ok, false);
}
assert.equal(hasUsableFestivalCoordinates({latitude: 35.8, longitude: 127.1}), true);
assert.equal(hasUsableFestivalCoordinates({latitude: null, longitude: null}), false);
assert.equal(hasUsableFestivalCoordinates({latitude: 95, longitude: 127}), false);
assert.equal(hasUsableFestivalCoordinates({latitude: 35.8, longitude: null}), false);

// B. the request uses the festival's own venue coordinates (never a visitor
// location) and the whole date range exactly once, not once per date -------
{
  let calls = 0;
  let capturedUrl = null;
  const result = await getFestivalProgramWeather({
    festival: festival(),
    fetchImpl: async url => { calls += 1; capturedUrl = new URL(url); return jsonResponse(WEATHER_FIXTURE); },
  });
  assert.equal(calls, 1, 'a 3-day festival must issue exactly one weather request, never one per date');
  assert.equal(capturedUrl.searchParams.get('latitude'), '35.8151');
  assert.equal(capturedUrl.searchParams.get('longitude'), '127.1535');
  assert.equal(capturedUrl.searchParams.get('start'), '2026-10-08');
  assert.equal(capturedUrl.searchParams.get('end'), '2026-10-10');
  assert.equal(capturedUrl.searchParams.get('timezone'), 'Asia/Seoul');
  assert.equal(result.ok, true);
  assert.equal(result.byDate.size, 3);
  assert.equal(result.byDate.get('2026-10-09').label, '비');
  assert.equal(result.byDate.get('2026-10-09').precipitationProbability, 80);
  assert.equal(result.byDate.get('2026-10-10').precipitationProbability, 0,
    'an actual zero precipitation probability must render as zero, never be dropped as if it were null');
}

// C. a 5-day festival still issues exactly one request -----------------------
{
  let calls = 0;
  await getFestivalProgramWeather({
    festival: festival({id: 'fest_five_day', startDate: '2026-10-08', endDate: '2026-10-12'}),
    fetchImpl: async () => { calls += 1; return jsonResponse({...WEATHER_FIXTURE, items: []}); },
  });
  assert.equal(calls, 1, 'a 5-day festival must still issue exactly one weather request');
}

// D. a run longer than 15 days clamps to Core's inclusive maximum instead of
// being rejected wholesale or requested day-by-day ---------------------------
{
  let capturedUrl = null;
  await getFestivalProgramWeather({
    festival: festival({id: 'fest_long_run', startDate: '2026-10-01', endDate: '2026-11-15'}),
    fetchImpl: async url => { capturedUrl = new URL(url); return jsonResponse({...WEATHER_FIXTURE, items: []}); },
  });
  assert.equal(capturedUrl.searchParams.get('start'), '2026-10-01');
  assert.equal(capturedUrl.searchParams.get('end'), '2026-10-15',
    'a run longer than 15 days must clamp to the 15-day inclusive maximum, not error out or fan out per day');
}

// E. fail-soft: network error / 429 / 500 / malformed contract never throw --
let failingIndex = 0;
for (const failing of [
  async () => { throw new Error('network down'); },
  async () => jsonResponse({detail: {code: 'RATE_LIMITED', message: 'too many'}}, 429),
  async () => jsonResponse({detail: {code: 'BOOM', message: 'boom'}}, 500),
  async () => jsonResponse({not: 'a valid contract'}, 200),
]) {
  failingIndex += 1;
  const result = await getFestivalProgramWeather({
    festival: festival({id: `fest_failing_${failingIndex}`}),
    fetchImpl: failing,
  });
  assert.equal(result.ok, false, `failure case ${failingIndex} must fail soft, never throw`);
  assert.equal(result.byDate.size, 0);
}

// F. provider_ready=false is a valid response, not a thrown error -----------
{
  const result = await getFestivalProgramWeather({
    festival: festival({id: 'fest_not_ready'}),
    fetchImpl: async () => jsonResponse({provider_ready: false, ai_calls: 0, items: []}),
  });
  assert.equal(result.ok, true);
  assert.equal(result.providerReady, false);
  assert.equal(result.byDate.size, 0);
}

// G. partial forecast coverage: only the covered dates appear, the rest are
// simply absent rather than fabricated ---------------------------------------
{
  const result = await getFestivalProgramWeather({
    festival: festival({id: 'fest_partial', startDate: '2026-10-08', endDate: '2026-10-12'}),
    fetchImpl: async () => jsonResponse({provider_ready: true, ai_calls: 0, items: WEATHER_FIXTURE.items}),
  });
  assert.equal(result.byDate.size, 3);
  assert.equal(result.byDate.has('2026-10-11'), false, 'an uncovered date must simply be absent, never fabricated');
  assert.equal(result.byDate.has('2026-10-12'), false);
}

// H. concurrent identical reads dedupe into one in-flight request ------------
{
  let calls = 0;
  const sharedFestival = festival({id: 'fest_dedupe'});
  const [a, b] = await Promise.all([
    getFestivalProgramWeather({festival: sharedFestival, fetchImpl: async () => { calls += 1; return jsonResponse(WEATHER_FIXTURE); }}),
    getFestivalProgramWeather({festival: sharedFestival, fetchImpl: async () => { calls += 1; return jsonResponse(WEATHER_FIXTURE); }}),
  ]);
  assert.equal(calls, 1, 'two concurrent reads for the same festival/coordinates/range must share one request');
  assert.equal(a.byDate.size, b.byDate.size);
}

// I. this is in-flight dedupe only, never a cache: a later call after the
// first has resolved fetches again ------------------------------------------
{
  let calls = 0;
  const sharedFestival = festival({id: 'fest_no_long_term_cache'});
  await getFestivalProgramWeather({festival: sharedFestival, fetchImpl: async () => { calls += 1; return jsonResponse(WEATHER_FIXTURE); }});
  await getFestivalProgramWeather({festival: sharedFestival, fetchImpl: async () => { calls += 1; return jsonResponse(WEATHER_FIXTURE); }});
  assert.equal(calls, 2, 'a completed request must not be cached indefinitely; a later read fetches again');
}

// J. normalizePublishedFestival carries venue coordinates through, never
// fabricates them, and never substitutes anything when they are absent ------
{
  const withCoords = normalizePublishedFestival({
    id: 'f1', name: '테스트 축제', startDate: '2026-10-08', endDate: '2026-10-10', region: '전북특별자치도',
    latitude: 35.8151, longitude: 127.1535,
  });
  assert.equal(withCoords.latitude, 35.8151);
  assert.equal(withCoords.longitude, 127.1535);

  const withoutCoords = normalizePublishedFestival({
    id: 'f2', name: '좌표없음', startDate: '2026-10-08', endDate: '2026-10-10', region: '전북특별자치도',
  });
  assert.equal(withoutCoords.latitude, null);
  assert.equal(withoutCoords.longitude, null);

  const garbageCoords = normalizePublishedFestival({
    id: 'f3', name: '이상한값', startDate: '2026-10-08', endDate: '2026-10-10', region: '전북특별자치도',
    latitude: 'north', longitude: Number.NaN,
  });
  assert.equal(garbageCoords.latitude, null, 'a non-numeric coordinate must normalize to null, never 0 or a fabricated number');
  assert.equal(garbageCoords.longitude, null);
}

// ---------------------------------------------------------------------------
// K. UI wiring structural + accessibility contracts (site-festival-ui.js) ---
const festivalUiJs = read('site-festival-ui.js');

assert.ok(festivalUiJs.includes("import {getFestivalProgramWeather} from './site-festival-weather.js"),
  'the festival detail UI must reuse the FESTIVAL-EVENT-09 orchestration helper, not a duplicate HTTP client');
for (const token of ['calendarWeatherAttribution', 'calendarWeatherIconNode', 'weatherTemperatureLabel']) {
  assert.ok(festivalUiJs.includes(token), `the festival detail UI must reuse the existing Calendar weather helper: ${token}`);
}
assert.doesNotMatch(festivalUiJs, /normalizeCalendarWeatherResponse|calendarWeatherByDate/,
  'the festival UI must not re-normalize or re-join weather itself — that belongs to site-festival-weather.js alone');

// Rate-limit protection: the list card must never fetch or render weather —
// only the detail screen may.
const cardBuilderMatch = /function buildCard\([\s\S]*?\n\}\n/.exec(festivalUiJs);
assert.ok(cardBuilderMatch, 'buildCard() must exist');
assert.doesNotMatch(cardBuilderMatch[0], /getFestivalProgramWeather|[Ww]eather/,
  'the festival list card must never fetch or render weather');

// Weather must be requested from exactly one call site (detail open), never
// per category-chip click or per date group.
const weatherCallSites = [...festivalUiJs.matchAll(/getFestivalProgramWeather\(\{/g)];
assert.equal(weatherCallSites.length, 1,
  'getFestivalProgramWeather must be called from exactly one place (detail open), never per tab/category click');

// Null/absent/invalid venue coordinates must gate the request off entirely —
// never a browser/user location fallback.
assert.ok(festivalUiJs.includes('Number.isFinite(festival.latitude) && Number.isFinite(festival.longitude)'),
  "the weather read must be gated on the festival's own finite venue coordinates");
assert.doesNotMatch(festivalUiJs, /navigator\.geolocation|getCurrentPosition/,
  "the festival detail must never read the visitor's own browser location for weather");

// Stale-navigation race guard: detailToken is captured before the awaited
// festival fetch and rechecked there and again after the awaited weather
// read, sharing loadList()'s own requestToken counter.
assert.ok(festivalUiJs.includes('const detailToken = ++requestToken;'));
const detailTokenGuards = [...festivalUiJs.matchAll(/if \(detailToken !== requestToken\) return;/g)];
assert.equal(detailTokenGuards.length, 2,
  'the stale-navigation guard must protect both the awaited festival fetch and the awaited weather read');

// Precipitation must only ever render when Core actually sent an integer —
// never a fabricated 0% for a null/missing value, in either the visual badge
// or the accessible date label.
const precipitationGuards = [...festivalUiJs.matchAll(/Number\.isInteger\(weatherItem\.precipitationProbability\)/g)];
assert.equal(precipitationGuards.length, 2,
  'both the visual weather badge and the accessible date label must guard precipitation with Number.isInteger, never assume 0');

// The weather glyph is decorative; the accessible sentence lives on the
// selected date's aria-label so a screen reader never hears the icon twice.
// (FESTIVAL-EVENT-10 moved this from a per-date-group heading to a
// per-selected-date row once the program list became a one-date-at-a-time
// tab panel — see buildDateTabBar/renderPrograms.)
assert.ok(festivalUiJs.includes("badge.setAttribute('aria-hidden', 'true')"));
assert.ok(festivalUiJs.includes("dateRow.setAttribute('aria-label', buildProgramDateAriaLabel(selectedDate, weatherItem))"));

// Attribution is built once per detail (section-level applyWeather), never
// once per date group inside the render loop.
const ariaLabelBuilderMatch = /function buildProgramDateAriaLabel\([\s\S]*?\n\}\n/.exec(festivalUiJs);
assert.ok(ariaLabelBuilderMatch, 'buildProgramDateAriaLabel() must exist');
assert.doesNotMatch(ariaLabelBuilderMatch[0], /calendarWeatherAttribution/,
  'attribution must not be built per date group');
const renderProgramsMatch = /const renderPrograms = \(\) => \{[\s\S]*?\n  \};/.exec(festivalUiJs);
assert.ok(renderProgramsMatch, 'renderPrograms() must exist');
assert.doesNotMatch(renderProgramsMatch[0], /calendarWeatherAttribution/,
  'attribution must not be built inside the per-date-group render loop');
assert.ok(festivalUiJs.includes('weatherAttribution.hidden = !attribution;'));

// A festival with no programs never triggers a weather read or shows a
// weather section at all — the early-return applyWeather() stub is a no-op.
assert.ok(festivalUiJs.includes("return {section, applyWeather() {}};"),
  'a festival with no programs must return a no-op applyWeather(), never build a weather section');

console.log('FESTIVAL EVENT-09 WEATHER VALIDATION PASS — venue-coordinate gating, single-request date-range join, 15-day clamp, precipitation/temperature/icon presentation, null-safety, fail-soft (network/429/500/malformed), provider_ready passthrough, partial forecast, in-flight dedupe without long-term caching, stale-navigation guard, rate-limit isolation from list cards, and accessibility contracts verified.');
