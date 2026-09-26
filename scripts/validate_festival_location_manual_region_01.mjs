// FESTIVAL-EVENT-07 — current-location permission reuse, manual region
// override, and coordinate privacy.
//
// Static source assertions against site-festival-ui.js/site-festival-client.js
// (no browser) — the same style as scripts/validate_composer_interaction.mjs.
// This deliberately does not reimplement a DOM harness: the repo has no
// jsdom/npm dependency, and the existing convention for this kind of
// interactive-wiring contract is asserting the exact control-flow patterns in
// source, as validate_composer_interaction.mjs already does for the composer.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

const ui = read('site-festival-ui.js');
const client = read('site-festival-client.js');
const currentLocation = read('site-current-location.js');

// -------------------------------------------------------- primitive reuse --
// The permission/geolocation contract must come from site-current-location.js
// (already shipped for Calendar/weather) and never be re-implemented here.
assert.match(ui, /from '\.\/site-current-location\.js(?:\?v=[A-Za-z0-9._-]+)?'/,
  'site-festival-ui.js must import the shared location primitives, not its own copy');
for (const symbol of ['BrowserLocationError', 'LOCATION_PERMISSION', 'getBrowserLocationPermissionState', 'requestBrowserCurrentLocation']) {
  assert.match(ui, new RegExp(symbol), `site-festival-ui.js must use the shared ${symbol}`);
}
assert.doesNotMatch(ui, /navigator\.geolocation\.getCurrentPosition/,
  'site-festival-ui.js must never call the geolocation API directly — always through site-current-location.js');
assert.doesNotMatch(ui, /LOCATION_PERMISSION\s*=\s*Object\.freeze/,
  'site-festival-ui.js must not redefine the LOCATION_PERMISSION enum');

// requestBrowserCurrentLocation must be called from exactly one place
// (inside useCurrentLocation) — never fired eagerly at mount regardless of
// permission state, and never duplicated into a second ad hoc call site.
const requestCalls = [...ui.matchAll(/requestBrowserCurrentLocation\(/g)];
assert.equal(requestCalls.length, 1, 'requestBrowserCurrentLocation must be called from exactly one place');
const useCurrentLocationBody = /async function useCurrentLocation\([\s\S]*?\n {2}\}\n/.exec(ui)?.[0] || '';
assert.match(useCurrentLocationBody, /requestBrowserCurrentLocation\(\)/,
  'the sole requestBrowserCurrentLocation() call must live inside useCurrentLocation()');

// ------------------------------------------------------------- GRANTED path
// Entry must check permission first, then auto-resolve only when GRANTED —
// never call getCurrentPosition() unconditionally before knowing the state.
assert.match(ui, /state\.locationPermission = await getBrowserLocationPermissionState\(\)/,
  'permission must be read before any location request is attempted');
assert.match(
  ui,
  /if \(state\.locationPermission === LOCATION_PERMISSION\.GRANTED\) \{\s*await useCurrentLocation\(\{auto: true\}\);\s*\} else \{/,
  'only GRANTED may auto-trigger the current-location flow; every other state must fall through without a location prompt',
);

// ------------------------------------------------ PROMPT_REQUIRED / UNKNOWN
// The else branch (covers PROMPT_REQUIRED and UNKNOWN) must go straight to a
// normal fetch, never call useCurrentLocation/requestBrowserCurrentLocation.
const elseBranch = /\} else \{\s*renderLocationBanner\(\);\s*await fetchAndRender\(\{reset: true\}\);\s*\}/;
assert.match(ui, elseBranch, 'PROMPT_REQUIRED/UNKNOWN must render nationwide/default browse without requesting location');

// ---------------------------------------------------------------- DENIED --
// Once denied, the "현재 위치로 보기" action must disappear (no repeated
// browser prompts), while 지역 변경 stays available (usage is never blocked).
assert.match(
  ui,
  /state\.locationMode !== 'CURRENT' && state\.locationPermission !== LOCATION_PERMISSION\.DENIED\)\s*\{/,
  'the "현재 위치로 보기" action must be gated on permission not being DENIED',
);
assert.match(ui, /useLocationButton\.textContent = '현재 위치로 보기'/, 'a "현재 위치로 보기" action must exist');
assert.match(ui, /regionButton\.textContent = '지역 변경'/, '지역 변경 must always be offered regardless of permission state');
assert.match(
  ui,
  /if \(state\.locationPermission !== LOCATION_PERMISSION\.DENIED\)\s*\{\s*const backButton/,
  '"현재 위치로 돌아가기" inside the region sheet must also be gated on permission not being DENIED',
);
assert.match(ui, /backButton\.textContent = '현재 위치로 돌아가기'/);

// -------------------------------------------------------- manual region --
// Selecting a region must clear current-location mode so a later GPS fix
// cannot silently override the user's explicit choice.
assert.match(
  ui,
  /function selectManualRegion\(province\) \{\s*state\.region = province;\s*state\.locationMode = 'NONE';\s*state\.currentPosition = null;/,
  'selecting a manual region must clear locationMode/currentPosition so GPS cannot overwrite it',
);

// Query construction must prefer an explicit region over coordinates, and
// must never send both at once (also covered functionally in the public
// boundary test's browseFestivals URL assertions).
assert.match(
  ui,
  /if \(state\.region\) \{\s*query\.region = state\.region;\s*\} else if \(state\.locationMode === 'CURRENT' && state\.currentPosition\) \{/,
  'a manual region must take precedence over any stored current-location coordinates',
);

// The 17-province list must only ever be rendered inside the region-change
// sheet, lazily, never as a standing always-visible chip row.
const regionIterations = [...ui.matchAll(/for \(const province of regionProvinces\)/g)];
assert.equal(regionIterations.length, 1, 'the province list must be rendered from exactly one place: the region-change sheet');
assert.match(ui, /function buildRegionSheetBody\(\)/);
assert.match(ui, /async function openRegionSheet\(\) \{\s*await ensureRegionProvinces\(\);/,
  'the region catalog must be fetched (lazily) before the sheet opens, not embedded as a static list');
assert.match(ui, /listFestivalRegions\(fetchImpl\)/, 'the region catalog must come from the Core-backed listFestivalRegions(), not a hand-maintained list');

// ------------------------------------------------------- coordinate privacy
// Precise coordinates must never be persisted or logged — only ever passed
// straight into a query.
for (const source of [ui, client]) {
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/i,
    'festival location handling must never touch browser storage — precise coordinates are query-only');
}
assert.doesNotMatch(ui, /console\.\w+\([^)]*\.latitude/, 'latitude must never be logged');
assert.doesNotMatch(ui, /console\.\w+\([^)]*\.longitude/, 'longitude must never be logged');
assert.doesNotMatch(ui, /textContent = `.*\$\{[^}]*latitude/i,
  'no on-screen label may interpolate the raw latitude/longitude numbers — only the resolved province label');

// resolveCurrentRegionLabel must be used for the header label (never the
// calendar's separate manual-region concept, and never a raw coordinate
// string), and the label must read "현재 위치 기준", not the forbidden
// "사는 지역" phrasing.
assert.match(ui, /resolveCurrentRegionLabel\(position\.latitude, position\.longitude\)/);
assert.match(ui, /현재 위치 기준/);
assert.doesNotMatch(ui, /사는 지역/, 'the banned "사는 지역" phrasing must never appear');

// Calendar's manual weather-region storage must not be reused/confused with
// festival's GPS current-location concept, and Calendar itself must not be
// touched by this room's changes.
assert.doesNotMatch(ui, /lotbi\.calendar\.weather-region/, 'festival must not read/write Calendar\'s manual weather-region storage key');
assert.doesNotMatch(client, /lotbi\.calendar\.weather-region/);

console.log('FESTIVAL LOCATION/MANUAL-REGION VALIDATION PASS — permission-primitive reuse, GRANTED auto-resolve, PROMPT_REQUIRED/UNKNOWN/DENIED no-repeat-prompt behavior, manual-region-overrides-GPS, lazy region catalog, and coordinate privacy verified.');
