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
assert.match(ui, /site-calendar-manager\.js\?v=20260922-expensefix1/);
assert.match(conversation, /site-calendar-ui\.js\?v=20260922-expensefix1/);
assert.match(index, /site-calendar\.css\?v=20260922-daysheet1/);
assert.match(index, /site-conversation\.js\?v=20260922-expensefix1/);
assert.match(callback, /site-conversation\.js\?v=20260922-expensefix1/);
assert.match(callbackHtml, /site-calendar\.css\?v=20260922-daysheet1/);
assert.match(callbackHtml, /auth-callback\.js\?v=20260922-expensefix1/);

console.log('LOTBI Calendar manual weather region Settings contract: PASS');
