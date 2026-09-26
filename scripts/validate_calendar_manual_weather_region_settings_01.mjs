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
const assetVersion = JSON.parse(readFileSync('site-asset-version.json', 'utf8')).version;

assert.match(manager, /resolvePublicWeatherRegion/);
assert.match(manager, /readCalendarManualWeatherRegion/);
assert.match(manager, /writeCalendarManualWeatherRegion/);
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
// 대표님 지시로 "수동 지역 해제" 버튼을 없앴다 -- 위치 버튼(갱신)을 누르면
// 현재 위치가 우선 적용되니 저장된 지역을 따로 지우는 동작이 필요 없다.
assert.doesNotMatch(manager, /수동 지역 해제/, '수동 지역 해제 버튼은 되돌아오지 않는다');
assert.doesNotMatch(manager, /clearCalendarManualWeatherRegion/, '해제 버튼과 함께 그 호출도 사라진다');
assert.match(manager, /calendarWeatherLocationPresentation/);
assert.match(manager, /manualSummary/);
assert.match(manager, /현재 위치를 우선 사용하고, 사용할 수 없으면 저장된 지역으로 전환합니다/);
assert.match(manager, /현재 위치를 사용할 수 없으면 수동 지역의 날씨를 표시합니다/);
assert.match(manager, /state\.manualWeatherRegion/);
assert.match(manager, /currentWeatherLocation\?\.source === 'BROWSER_CURRENT'/);
assert.match(manager, /state\.manualWeatherRegion \? '' : '위치 권한이 꺼져 있어요.'/);
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
const renderEnd = manager.indexOf('  async function refresh({');
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
assert.ok(ui.includes(`site-calendar-manager.js?v=${assetVersion}`));
assert.ok(conversation.includes(`site-calendar-ui.js?v=${assetVersion}`));
assert.ok(index.includes(`site-calendar.css?v=${assetVersion}`));
// The Home entry carries its own cache-bust token, bumped whenever the shell
// changes rather than whenever a Calendar module does. Pinning the Calendar's
// token here went stale the first time only one of the two moved; what actually
// matters is that all three Home-entry references agree with each other.
const homeEntryVersion = index.match(/site-conversation\.js\?v=([^"']+)/)?.[1] || '';
assert.ok(homeEntryVersion, 'Home conversation entry must be cache-busted');
assert.match(callback, new RegExp(`site-conversation\\.js\\?v=${homeEntryVersion}`));
assert.match(callbackHtml, new RegExp(`auth-callback\\.js\\?v=${homeEntryVersion}`));
assert.ok(callbackHtml.includes(`site-calendar.css?v=${assetVersion}`));

console.log('LOTBI Calendar manual weather region Settings contract: PASS');
