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
// 자유 텍스트 입력은 없다. 자기 위치를 문장으로 적는 사람은 없고, 오타 하나가 날씨를
// 통째로 사라지게 만들었다. 지역은 Core 목록 그대로 광역시·도 → 시·군·구 두 단계로만
// 고른다.
assert.doesNotMatch(manager, /예: 전주시 만성동/, '날씨 지역 자유 텍스트 입력은 되돌아오지 않는다');
assert.doesNotMatch(manager, /지역 적용/, '자유 텍스트 적용 버튼은 되돌아오지 않는다');
assert.doesNotMatch(manager, /상세 번지 없는 지역명을 입력/, '입력 안내문도 함께 사라진다');
assert.doesNotMatch(manager, /weatherInput/, '입력칸을 가리키는 코드도 남지 않는다');
assert.match(manager, /provinceSelect\.className = 'calendar-settings-select'/);
assert.match(manager, /citySelect\.className = 'calendar-settings-select'/);
assert.match(manager, /'날씨 지역 광역시·도'/);
assert.match(manager, /'날씨 지역 시·군·구'/);
// 2단계에는 1단계에 속한 것만 나온다.
assert.match(manager, /items \|\| \[\]\)\.filter\(item => item\.province === province\)/);
assert.match(manager, /\/v2\/life\/weather\/regions/);
assert.match(manager, /수동 지역 해제/);
assert.match(manager, /현재 날씨 지역:/);
assert.match(manager, /state\.manualWeatherRegion/);
assert.match(manager, /currentWeatherLocation\?\.source === 'BROWSER_CURRENT'/);
assert.match(manager, /state\.manualWeatherRegion \? '' : '위치 권한이 꺼져 있어요.'/);
// 현재 위치를 쓰는 것이 저장된 지역을 지우는 일이어서는 안 된다. 그것 때문에
// 새로고침하면 돌아갈 자리가 없어져 날씨가 사라졌다. 해제는 설정창의 해제 버튼
// (storage) 하나뿐이다.
assert.doesNotMatch(
  manager,
  /clearCalendarManualWeatherRegion\(settingsStorage\)/,
  '현재 위치 경로는 저장된 지역을 지우지 않는다',
);
assert.match(manager, /clearCalendarManualWeatherRegion\(storage\)/);
// 새로고침 뒤에도 남는 것은 시·군·구이고, 정밀 좌표는 저장하지 않는다.
assert.match(manager, /writeWeatherRegionOrigin\(settingsStorage, WEATHER_REGION_ORIGIN\.CURRENT_LOCATION\)/);
assert.match(manager, /storeCurrentLocationRegion\(region\)/);
assert.doesNotMatch(
  manager,
  /setItem\([^)]*capturedAtMs|accuracyMeters[^\n]*setItem/,
  '브라우저가 준 정밀 좌표는 저장소에 남지 않는다',
);
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

// 지오코딩은 사용자가 시·군·구를 고른 뒤에만 일어난다. 설정창을 여는 것만으로
// 목록은 읽지만, 좌표를 묻는 요청은 고르기 전에는 없다.
const cityHandler = manager.indexOf("citySelect.addEventListener('change'");
const resolveCall = manager.indexOf('resolvePublicWeatherRegion(chosen.displayLabel, fetchImpl)');
assert.ok(cityHandler >= 0 && resolveCall > cityHandler, 'manual region lookup must run only after an explicit Settings choice');
assert.equal(
  manager.slice(0, cityHandler).includes('resolvePublicWeatherRegion(chosen.displayLabel'),
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
assert.match(ui, /site-calendar-manager\.js\?v=20260923-sysdark2/);
assert.match(conversation, /site-calendar-ui\.js\?v=20260923-sysdark2/);
assert.match(index, /site-calendar\.css\?v=20260923-sysdark2/);
assert.match(index, /site-conversation\.js\?v=20260923-sysdark2/);
assert.match(callback, /site-conversation\.js\?v=20260923-sysdark2/);
assert.match(callbackHtml, /site-calendar\.css\?v=20260923-sysdark2/);
assert.match(callbackHtml, /auth-callback\.js\?v=20260923-sysdark2/);

console.log('LOTBI Calendar manual weather region Settings contract: PASS');
