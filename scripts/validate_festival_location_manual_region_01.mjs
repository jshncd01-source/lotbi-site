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
for (const symbol of ['BrowserLocationError', 'LOCATION_PERMISSION', 'getBrowserLocationPermissionState', 'acquireSharedBrowserCurrentLocation']) {
  assert.match(ui, new RegExp(symbol), `site-festival-ui.js must use the shared ${symbol}`);
}
assert.doesNotMatch(ui, /navigator\.geolocation\.getCurrentPosition/,
  'site-festival-ui.js must never call the geolocation API directly — always through site-current-location.js');
assert.doesNotMatch(ui, /LOCATION_PERMISSION\s*=\s*Object\.freeze/,
  'site-festival-ui.js must not redefine the LOCATION_PERMISSION enum');

// The current location must be acquired from exactly one place (inside
// useCurrentLocation) — never fired eagerly at mount regardless of permission
// state, and never duplicated into a second ad hoc call site.
//
// GLOBAL-LOCATION-15: the acquisition now goes through the shared layer's
// acquireSharedBrowserCurrentLocation, so a fix Calendar weather just took is
// reused instead of asking the browser for coordinates a second time, and two
// features mounting together produce one getCurrentPosition call, not two.
// Festival must not keep its own private copy of that reuse logic.
const requestCalls = [...ui.matchAll(/acquireSharedBrowserCurrentLocation\(/g)];
assert.equal(requestCalls.length, 1, 'the current location must be acquired from exactly one place');
assert.doesNotMatch(ui, /requestBrowserCurrentLocation\(/,
  'festival must acquire through the shared cross-feature entry point, not the un-shared primitive');
const useCurrentLocationBody = /async function useCurrentLocation\([\s\S]*?\n {2}\}\n/.exec(ui)?.[0] || '';
assert.match(useCurrentLocationBody, /acquireSharedBrowserCurrentLocation\(\)/,
  'the sole acquisition call must live inside useCurrentLocation()');

// ------------------------------------------------------------- GRANTED path
// Entry must check permission first, then auto-resolve only when GRANTED —
// never call getCurrentPosition() unconditionally before knowing the state.
assert.match(ui, /state\.locationPermission = await getBrowserLocationPermissionState\(\)/,
  'permission must be read before any location request is attempted');
// FESTIVAL-SHARED-FIX-16: 자동으로 현재 위치를 쓸 수 있는 경우는 딱 두 가지다.
//   (1) 권한이 GRANTED 로 읽힌다
//   (2) 공통 계층이 이미 확보해 둔 신선한 좌표가 손에 있다 (새 요청이 아니므로
//       권한 팝업이 뜰 수 없다 -- iPhone Safari 처럼 권한 상태를 알려주지 않는
//       브라우저에서 캘린더 날씨가 읽어 둔 좌표를 재사용하는 근거)
// 그 밖의 어떤 상태도 좌표를 새로 묻지 않는다.
assert.match(
  ui,
  /if \(state\.locationPermission === LOCATION_PERMISSION\.GRANTED \|\| sharedPosition\) \{[\s\S]{0,200}?await useCurrentLocation\(\{auto: true, sharedPosition\}\);\s*\} else \{/,
  'only GRANTED, or a fix already in hand, may auto-trigger the current-location flow; every other state must fall through without a location prompt',
);
// 그 "이미 가진 좌표" 는 권한을 읽은 다음에 조회해야 한다: 권한 읽기가 DENIED 를
// 만나면 공통 계층이 좌표를 버리므로, 순서가 뒤바뀌면 권한이 꺼진 뒤의 좌표를
// 쓰게 된다 (§8 캐시는 권한 우회 수단이 아니다).
const permissionReadIndex = ui.indexOf('state.locationPermission = await getBrowserLocationPermissionState()');
const sharedFixIndex = ui.indexOf('const sharedPosition = getRecentBrowserCurrentLocation()');
assert.ok(permissionReadIndex > 0 && sharedFixIndex > permissionReadIndex,
  'the already-held fix must be read AFTER the permission read, never before');

// 확인이 끝나기 전에는 '전국' 이라고 적지 않는다. 허용해 둔 사용자는 곧 자기 지역으로
// 바뀌므로, 그 사이에 전국을 보여주면 처음 보는 화면이 사실과 다르다.
assert.match(ui, /state\.locationResolving \|\| state\.locationBusy\) \{\s*label\.textContent = '📍 현재 위치 확인 중…';/,
  'while the current location is still being resolved the banner must say so, not claim 전국');
assert.match(ui, /state\.locationResolving = true;\s*renderLocationBanner\(\);\s*\n\s*state\.locationPermission = await getBrowserLocationPermissionState/,
  'the resolving state must be set before the first banner paint, so 전국 is never the first thing shown');
assert.match(ui, /state\.locationBusy = false;\s*state\.locationResolving = false;/,
  'the resolving state must be cleared once acquisition settles, so a failure falls back to 전국 instead of spinning forever');

// ------------------------------------------------ PROMPT_REQUIRED / UNKNOWN
// The else branch (covers PROMPT_REQUIRED and UNKNOWN) must go straight to a
// normal fetch, never call useCurrentLocation/requestBrowserCurrentLocation.
// 현재 위치로 열 수 없는 것이 확정된 경우(PROMPT_REQUIRED/UNKNOWN 이고 손에 좌표도
// 없음)에만 전국 기본 목록을 그린다 -- 좌표를 새로 묻지 않는다.
const elseBranch = /\} else \{[\s\S]{0,200}?state\.locationResolving = false;\s*renderLocationBanner\(\);\s*await fetchAndRender\(\{reset: true\}\);\s*\}/;
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
// FESTIVAL-SHARED-FIX-16: 지역 변경은 현재 위치를 확인하는 중에도 눌려야 한다.
// 데스크톱에서는 위치 확인에 몇 초가 걸리고, 그 동안 버튼이 사라지면 고장으로 읽힌다.
// 그래서 지역 버튼은 locationBusy 분기 안이 아니라 그 바깥에서 항상 붙는다.
const busyBranch = /if \(state\.locationBusy\) \{[\s\S]*?\n {4}\}\n/.exec(ui)?.[0] || '';
assert.ok(busyBranch, 'the banner must have a locationBusy branch');
assert.doesNotMatch(busyBranch, /지역 변경/,
  '지역 변경 must live outside the locationBusy branch so it stays clickable while the location resolves');
assert.match(
  ui,
  /actions\.appendChild\(el\('span', 'festival-location-busy'[\s\S]{0,900}?regionButton\.textContent = '지역 변경';[\s\S]{0,200}?actions\.appendChild\(regionButton\);/,
  '지역 변경 must be appended unconditionally, after the busy/use-location branch',
);
assert.match(
  ui,
  /if \(state\.locationPermission !== LOCATION_PERMISSION\.DENIED\)\s*\{\s*const backButton/,
  '"현재 위치로 돌아가기" inside the region sheet must also be gated on permission not being DENIED',
);
assert.match(ui, /backButton\.textContent = '현재 위치로 돌아가기'/);

// -------------------------------------------------------- manual region --
// FESTIVAL-EVENT-02 REGION-BROWSE: region selection is now a 2-step
// province -> 시·군 flow (selectManualRegion(province, municipality)), but
// selecting either step must still clear current-location mode so a later
// GPS fix cannot silently override the user's explicit choice.
assert.match(
  ui,
  /function selectManualRegion\(province, municipality = ''\) \{\s*state\.region = province;\s*state\.locationMode = 'NONE';\s*state\.currentPosition = null;/,
  'selecting a manual region must clear locationMode/currentPosition so GPS cannot overwrite it',
);
// 그리고 이미 날아간 자동 요청이 늦게 도착해도 그 선택을 덮지 않는다 (§22).
// 지역 변경이 확인 중에도 눌리게 된 뒤로는 이 경쟁이 실제로 일어날 수 있다.
assert.match(
  ui,
  /if \(auto && state\.region\) return;/,
  'an auto location request that lands after the user picked a region must abandon its result, never overwrite it',
);
assert.match(ui, /state\.municipality = municipality;/, 'the selected 시·군 must be stored alongside the province');

// Query construction must prefer an explicit region over coordinates, and
// must never send both at once (also covered functionally in the public
// boundary test's browseFestivals URL assertions). municipality is additive
// and only ever sent alongside region, never on its own.
assert.match(
  ui,
  /if \(state\.region\) \{\s*query\.region = state\.region;\s*if \(state\.municipality\) query\.municipality = state\.municipality;\s*\} else if \(state\.locationMode === 'CURRENT' && state\.currentPosition\) \{/,
  'a manual region must take precedence over any stored current-location coordinates, and municipality must never be sent without region',
);

// ---------------------------------------------------- province -> 시·군 -----
// Step 1 (province) must never apply+close by itself any more -- it must
// advance to step 2 instead, and only step 2's options (either "OO 전체" or a
// specific 시·군) may actually call selectManualRegion/close the sheet.
assert.match(ui, /async function goToMunicipalityStep\(province\) \{/,
  'clicking a province must advance to a 시·군 step, not immediately apply+close');
const provinceStepBody = /function buildRegionSheetBody\(\) \{[\s\S]*?\n {2}\}\n/.exec(ui)?.[0] || '';
assert.match(provinceStepBody, /addEventListener\('click', \(\) => void goToMunicipalityStep\(province\)\)/,
  'a province row must go to the 시·군 step, never call selectManualRegion directly');
assert.doesNotMatch(provinceStepBody, /selectManualRegion\(/, 'step 1 must never apply a region by itself');

// No 구/읍/면/동/리 sub-division may ever be offered.
assert.doesNotMatch(ui, /구선택|'\s*구\s*'|자치구|일반구/, 'no 구-level option may be rendered anywhere in the region sheet');
assert.match(ui, /listFestivalMunicipalities\(province, fetchImpl\)/,
  'the 시·군 catalog must come from the Core-backed listFestivalMunicipalities(), not a hand-maintained list');
assert.match(ui, /`\$\{province\} 전체`/, 'step 2 must offer an "OO 전체" option for the whole province');
assert.match(ui, /backToProvinceStep\(\)/, 'step 2 must support going back to step 1');

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
// straight into a query. (FESTIVAL-EVENT-10's Guest Calendar repository
// legitimately uses localStorage for saved visit dates — a different,
// unrelated feature — so this checks specifically for a stored/logged
// coordinate, not for browser-storage usage in general.)
assert.doesNotMatch(
  ui,
  /(?:localStorage|sessionStorage|indexedDB)[^\n;]*(?:latitude|longitude|currentPosition)/i,
  'precise GPS coordinates must never be written to browser storage — query-only',
);
assert.doesNotMatch(
  client,
  /(?:localStorage|sessionStorage|indexedDB)[^\n;]*(?:latitude|longitude)/i,
  'precise GPS coordinates must never be written to browser storage — query-only',
);
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
