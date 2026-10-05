import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LOCATION_USAGE_COOKIE, readLocationUsagePreference} from '../site-location-preference.js';
import {acquireSharedBrowserCurrentLocation, clearRecentBrowserCurrentLocation, getBrowserLocationPermissionState, getRecentBrowserCurrentLocation, requestBrowserCurrentLocation, resolveSharedBrowserCurrentLocation, LOCATION_PERMISSION} from '../site-current-location.js';

const previousDocument = globalThis.document;
const preference = {cookie: ''};
globalThis.document = preference;
let calls = 0;
let permissionQueries = 0;
const now = () => 1800000000000;
const position = {coords: {latitude: 35.8, longitude: 127.1, accuracy: 30}, timestamp: now()};
const geolocation = {getCurrentPosition(success) { calls++; success(position); }};
const permissions = {query: async () => { permissionQueries++; return {state: 'granted'}; }};
try {
  assert.equal(LOCATION_USAGE_COOKIE, 'lotbi_location_usage_v1');
  assert.equal(readLocationUsagePreference(''), true);
  for (const value of ['off', '', 'broken', '%6Fn']) assert.equal(readLocationUsagePreference(`lotbi_location_usage_v1=${value}`), false);
  assert.equal(readLocationUsagePreference('lotbi_location_usage_v1=on; lotbi_location_usage_v1=off'), false);
  preference.cookie = `${LOCATION_USAGE_COOKIE}=on`;
  await acquireSharedBrowserCurrentLocation({geolocation, now});
  assert.notEqual(getRecentBrowserCurrentLocation({now}), null);
  preference.cookie = `${LOCATION_USAGE_COOKIE}=off`;
  assert.equal(await getBrowserLocationPermissionState({permissions, geolocation}), LOCATION_PERMISSION.DENIED);
  assert.equal(permissionQueries, 0, 'OFF must not even query the browser permission');
  assert.equal(getRecentBrowserCurrentLocation({now}), null, 'OFF removes cached coordinates');
  await assert.rejects(requestBrowserCurrentLocation({geolocation, now}), {code: 'LOCATION_USAGE_DISABLED'});
  await assert.rejects(acquireSharedBrowserCurrentLocation({geolocation, now}), {code: 'LOCATION_USAGE_DISABLED'});
  const blocked = await resolveSharedBrowserCurrentLocation({permissions, geolocation, now, allowPrompt: true});
  assert.equal(blocked.location, null);
  assert.equal(calls, 1, 'OFF must block even an explicit feature location action');

  preference.cookie = `${LOCATION_USAGE_COOKIE}=on`;
  clearRecentBrowserCurrentLocation();
  const outcomes = await Promise.all([
    acquireSharedBrowserCurrentLocation({geolocation, now}),
    acquireSharedBrowserCurrentLocation({geolocation, now}),
  ]);
  assert.equal(outcomes[0], outcomes[1]);
  assert.equal(calls, 2, 'Calendar and Festival share one GPS request');
  await acquireSharedBrowserCurrentLocation({geolocation, now});
  assert.equal(calls, 2, 'fresh cached coordinates are reused');
  assert.equal(preference.cookie, `${LOCATION_USAGE_COOKIE}=on`, 'coordinates never enter the preference');
  clearRecentBrowserCurrentLocation();
  let complete;
  const pending = acquireSharedBrowserCurrentLocation({geolocation: {getCurrentPosition(success) { complete = success; }}, now});
  preference.cookie = `${LOCATION_USAGE_COOKIE}=off`;
  complete(position);
  await assert.rejects(pending, {code: 'LOCATION_USAGE_DISABLED'});
  assert.equal(getRecentBrowserCurrentLocation({now}), null, 'late success after OFF must not restore coordinates');
  preference.cookie = `${LOCATION_USAGE_COOKIE}=on`;
  const prompt = await resolveSharedBrowserCurrentLocation({permissions: {query: async () => ({state: 'prompt'})}, geolocation, now});
  assert.equal(prompt.location, null);
  assert.equal(calls, 2, 'ON is not browser consent: mount must not prompt');
  for (const file of ['site-calendar-manager.js', 'site-festival-ui.js']) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.match(source, /isLocationUsageEnabled/);
    assert.match(source, /LOCATION_USAGE_EVENT/);
    assert.match(source, /設定|설정에서 위치 켜기/);
  }
  const festival = readFileSync(new URL('../site-festival-ui.js', import.meta.url), 'utf8');
  assert.match(festival, /isLocationUsageEnabled\(\) && state\.locationMode === 'CURRENT' && state\.currentPosition/, 'OFF must not send an old position when constructing a new query');
  const calendar = readFileSync(new URL('../site-calendar-manager.js', import.meta.url), 'utf8');
  assert.match(calendar, /if \(!region \|\| !root\.isConnected \|\| requestGeneration !== locationRequestGeneration \|\| !isLocationUsageEnabled\(\)\) return;/, 'a late region lookup must not persist after OFF');
  console.log('LOCATION USAGE SETTING PASS: persistence contract, OFF/no GPS, cache discard, concurrency, late success, no prompt on mount.');
} finally {
  clearRecentBrowserCurrentLocation();
  if (previousDocument === undefined) delete globalThis.document;
  else globalThis.document = previousDocument;
}
