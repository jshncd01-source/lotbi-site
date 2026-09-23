import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const manager = readFileSync('site-calendar-manager.js', 'utf8');
const publicWeather = readFileSync('site-calendar-public-weather.js', 'utf8');
const preference = readFileSync('site-calendar-weather-region.js', 'utf8');
const css = readFileSync('site-calendar.css', 'utf8');
const ui = readFileSync('site-calendar-ui.js', 'utf8');
const conversation = readFileSync('site-conversation.js', 'utf8');
const index = readFileSync('index.html', 'utf8');
const callback = readFileSync('auth-callback.js', 'utf8');
const callbackHtml = readFileSync('auth/callback/index.html', 'utf8');

assert.match(manager, /resolvePublicWeatherRegion/);
assert.match(manager, /readCalendarManualWeatherRegion/);
assert.match(manager, /writeCalendarManualWeatherRegion/);
assert.match(manager, /clearCalendarManualWeatherRegion/);
assert.match(manager, /source: 'MANUAL_REGION'/);
assert.match(manager, /예: 전주시 만성동/);
assert.match(manager, /지역 적용/);
assert.match(manager, /수동 지역 해제/);
assert.match(manager, /현재 날씨 지역:/);
assert.match(manager, /state\.manualWeatherRegion/);
assert.match(manager, /currentWeatherLocation\?\.source === 'BROWSER_CURRENT'/);
assert.match(manager, /state\.manualWeatherRegion \? '' : '위치 권한이 꺼져 있어요.'/);
assert.match(manager, /clearCalendarManualWeatherRegion\(settingsStorage\)/);
assert.match(manager, /void syncLocationPermission\(\)\.then/);

// The current-location control lives in Settings beside the manual region, and
// the pre-grid status row never carries it again: weather location is an
// accessory and must not outrank the user's own schedule. Behaviour is proven in
// a real browser by validate_calendar_quiet_location_01.mjs; these are the cheap
// static guards against a silent drift back.
assert.match(manager, /buildLocationRow: buildLocationSettingsRow/);
assert.match(manager, /row\.dataset\.calendarLocationRow = 'true'/);
assert.match(manager, /row\.append\(copy, locationButton\)/);
assert.match(manager, /announceLocation\('현재 위치로 날씨를 표시합니다\.'\)/);
const renderStart = manager.indexOf('  function render() {');
const renderEnd = manager.indexOf('  async function refresh() {');
assert.ok(renderStart >= 0 && renderEnd > renderStart, 'render/refresh boundary not found');
const renderBody = manager.slice(renderStart, renderEnd);
assert.equal(
  renderBody.includes('status.appendChild(locationButton)'),
  false,
  'the status row above the date grid must never host the location control again',
);
assert.equal(
  /status\.appendChild\(location/.test(renderBody),
  false,
  'the status row above the date grid must never host a location label again',
);
assert.match(css, /\.calendar-toast-host/);
assert.match(css, /\.calendar-toast-host:empty \{ display: none; \}/);

const applyHandler = manager.indexOf("weatherApply.addEventListener('click'");
const resolveCall = manager.lastIndexOf('resolvePublicWeatherRegion(query, fetchImpl)');
assert.ok(applyHandler >= 0 && resolveCall > applyHandler, 'manual region lookup must run only after explicit Settings action');
assert.equal(
  manager.slice(0, applyHandler).includes('resolvePublicWeatherRegion(query, fetchImpl)'),
  false,
  'Calendar mount must never geocode a manual region automatically',
);

assert.match(publicWeather, /\/v2\/life\/weather\/region\/resolve/);
assert.match(publicWeather, /\/\\d\/\.test\(q\)/);
assert.match(publicWeather, /coordinate_authority !== 'NAVER_MAPS_GEOCODING'/);
assert.match(preference, /lotbi\.calendar\.weather-region\.v1/);
assert.match(preference, /latitude < 31/);
assert.match(preference, /longitude > 132\.5/);

assert.match(css, /\.calendar-settings-region-row/);
assert.match(css, /\.calendar-settings-region-row input/);
assert.match(ui, /site-calendar-manager\.js\?v=20260923-sysdark1/);
assert.match(conversation, /site-calendar-ui\.js\?v=20260923-sysdark1/);
assert.match(index, /site-calendar\.css\?v=20260923-sysdark1/);
assert.match(index, /site-conversation\.js\?v=20260923-sysdark1/);
assert.match(callback, /site-conversation\.js\?v=20260923-sysdark1/);
assert.match(callbackHtml, /site-calendar\.css\?v=20260923-sysdark1/);
assert.match(callbackHtml, /auth-callback\.js\?v=20260923-sysdark1/);

console.log('LOTBI Calendar manual weather region Settings contract: PASS');
