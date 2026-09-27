// GLOBAL-LOCATION-15 — LOTBI 공통 위치 권한 / 현재 위치 획득 기반.
//
// 명령문 §24 의 요구 테스트를 실제 site-current-location.js 모듈에 대고 실행한다
// (정적 source 단정이 아니라 동작 확인). 브라우저는 필요하지 않다: 공통 계층은
// geolocation / permissions 를 주입받도록 이미 설계돼 있어서, 여기서 각 브라우저
// 상태를 그대로 흉내낼 수 있다.
//
// 여기서 "Weather", "Festival", "Calendar" 는 화면이 아니라 호출자다. 검증 대상은
// 화면 모양이 아니라 계약이다: 한 기능이 얻은 권한과 좌표를 다른 기능이 재사용하고,
// 권한이 없을 때 mount 만으로 팝업이 뜨지 않고, 기능별 수동 지역이 보존된다.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

// 주석을 지운 소스. 금지 API 이름은 "쓰지 않는다" 는 주석에도 등장하므로,
// 실제 코드만 두고 단정한다.
const codeOf = rel => read(rel)
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

const {
  BROWSER_CURRENT_LOCATION_MAX_AGE_MS,
  BrowserLocationError,
  LOCATION_PERMISSION,
  LOCATION_RESOLUTION,
  acquireSharedBrowserCurrentLocation,
  clearRecentBrowserCurrentLocation,
  getBrowserLocationPermissionState,
  getRecentBrowserCurrentLocation,
  isFreshBrowserCurrentLocation,
  requestBrowserCurrentLocation,
  resolveSharedBrowserCurrentLocation,
} = await import('../site-current-location.js');

// ------------------------------------------------------------- 도구 --------
const FIXED_NOW = 1_800_000_000_000;
const now = () => FIXED_NOW;

// 브라우저의 permission 상태를 흉내낸다. 지원하지 않는 브라우저는 permissions 를
// 아예 주지 않는 것으로 표현한다 (Safari 등).
function permissionsStub(state) {
  return {query: async () => ({state})};
}

// geolocation stub. calls 배열로 "OS/브라우저에 몇 번 물었는지" 를 센다.
function geolocationStub({coords, error, hang = false, clock = now} = {}) {
  const calls = [];
  return {
    calls,
    getCurrentPosition(onSuccess, onError, options) {
      calls.push(options);
      if (hang) return;
      if (error) {
        onError(error);
        return;
      }
      // 실제 장치처럼 "지금" 잡은 좌표를 돌려준다: 시계를 앞으로 돌린 뒤의 요청은
      // 그 시점의 fix 를 받는다.
      onSuccess({
        coords: {latitude: 37.5665, longitude: 126.978, accuracy: 30, ...coords},
        timestamp: clock(),
      });
    },
  };
}

let passed = 0;
async function check(label, fn) {
  clearRecentBrowserCurrentLocation();
  await fn();
  passed += 1;
  console.log(`  ok  ${label}`);
}

// =========================================================== 공통 layer ===
// ① GRANTED detection
await check('① 허용된 권한을 GRANTED 로 읽는다', async () => {
  const geolocation = geolocationStub();
  assert.equal(
    await getBrowserLocationPermissionState({permissions: permissionsStub('granted'), geolocation}),
    LOCATION_PERMISSION.GRANTED,
  );
  // 권한을 읽는 것만으로 좌표를 묻지 않는다.
  assert.equal(geolocation.calls.length, 0, '권한 확인이 GPS 를 부르면 안 된다');
});

// ② PROMPT
await check('② 미결정 권한을 PROMPT_REQUIRED 로 읽고, 그것만으로 팝업을 띄우지 않는다', async () => {
  const geolocation = geolocationStub();
  assert.equal(
    await getBrowserLocationPermissionState({permissions: permissionsStub('prompt'), geolocation}),
    LOCATION_PERMISSION.PROMPT_REQUIRED,
  );
  assert.equal(geolocation.calls.length, 0);
});

// ③ DENIED
await check('③ 거부된 권한을 DENIED 로 읽는다', async () => {
  const geolocation = geolocationStub();
  assert.equal(
    await getBrowserLocationPermissionState({permissions: permissionsStub('denied'), geolocation}),
    LOCATION_PERMISSION.DENIED,
  );
  assert.equal(geolocation.calls.length, 0);
});

// ④ UNKNOWN safe behavior — Permissions API 가 없거나 geolocation 질의를 지원하지
//    않는 브라우저(iPhone Safari, 구형 Samsung Internet 등).
await check('④ UNKNOWN 은 UNKNOWN 으로 남고, 절대 GRANTED 로 승격되지 않는다', async () => {
  const geolocation = geolocationStub();
  // permissions 자체가 없는 브라우저
  assert.equal(
    await getBrowserLocationPermissionState({permissions: undefined, geolocation}),
    LOCATION_PERMISSION.UNKNOWN,
  );
  // permissions 는 있지만 geolocation 질의에서 throw 하는 브라우저
  assert.equal(
    await getBrowserLocationPermissionState({
      permissions: {query: async () => { throw new TypeError('unsupported'); }},
      geolocation,
    }),
    LOCATION_PERMISSION.UNKNOWN,
  );
  assert.equal(geolocation.calls.length, 0, 'UNKNOWN 을 확인하는 동안 GPS 를 부르면 안 된다');

  // UNKNOWN 에서 화면을 열어도(allowPrompt 없이) 좌표를 묻지 않는다.
  const outcome = await resolveSharedBrowserCurrentLocation({
    permissions: undefined, geolocation, now,
  });
  assert.equal(outcome.permission, LOCATION_PERMISSION.UNKNOWN);
  assert.equal(outcome.resolution, LOCATION_RESOLUTION.IDLE);
  assert.equal(outcome.location, null);
  assert.equal(geolocation.calls.length, 0, 'UNKNOWN 을 GRANTED 로 가정해 GPS 를 불러선 안 된다 (§18)');
});

// ⑤ current location success
await check('⑤ 허용된 권한에서 현재 위치를 얻는다', async () => {
  const geolocation = geolocationStub();
  const outcome = await resolveSharedBrowserCurrentLocation({
    permissions: permissionsStub('granted'), geolocation, now,
  });
  assert.equal(outcome.resolution, LOCATION_RESOLUTION.RESOLVED);
  assert.equal(outcome.permission, LOCATION_PERMISSION.GRANTED);
  assert.equal(outcome.location.latitude, 37.5665);
  assert.equal(outcome.location.source, 'BROWSER_CURRENT');
  assert.equal(geolocation.calls.length, 1);
});

// ⑥ invalid coordinates reject
await check('⑥ 잘못된 좌표는 현재 위치로 통과하지 않는다', async () => {
  for (const coords of [{latitude: 91}, {longitude: 181}, {latitude: Number.NaN}, {accuracy: -1}]) {
    clearRecentBrowserCurrentLocation();
    const geolocation = geolocationStub({coords});
    const outcome = await resolveSharedBrowserCurrentLocation({
      permissions: permissionsStub('granted'), geolocation, now,
    });
    assert.equal(outcome.resolution, LOCATION_RESOLUTION.ERROR, `${JSON.stringify(coords)} 는 거부돼야 한다`);
    assert.equal(outcome.location, null);
    assert.equal(outcome.error.code, 'BROWSER_LOCATION_INVALID');
    // 거부된 좌표는 캐시에도 남지 않는다.
    assert.equal(getRecentBrowserCurrentLocation({now}), null);
  }
});

// ⑦ stale coordinates reject
await check('⑦ 오래된 좌표는 현재 위치로 통과하지 않는다', async () => {
  const geolocation = {
    getCurrentPosition(onSuccess) {
      onSuccess({
        coords: {latitude: 37.5665, longitude: 126.978, accuracy: 30},
        timestamp: FIXED_NOW - BROWSER_CURRENT_LOCATION_MAX_AGE_MS - 60_000,
      });
    },
  };
  const outcome = await resolveSharedBrowserCurrentLocation({
    permissions: permissionsStub('granted'), geolocation, now,
  });
  assert.equal(outcome.resolution, LOCATION_RESOLUTION.ERROR);
  assert.equal(outcome.error.code, 'BROWSER_LOCATION_STALE');
  assert.equal(getRecentBrowserCurrentLocation({now}), null);
});

// ⑧ timeout
await check('⑧ 시간 초과는 TIMEOUT 으로 끝나고, 권한 상태는 그대로 유지된다', async () => {
  const geolocation = geolocationStub({error: {code: 3, message: 'timeout'}});
  const outcome = await resolveSharedBrowserCurrentLocation({
    permissions: permissionsStub('granted'), geolocation, now,
  });
  assert.equal(outcome.resolution, LOCATION_RESOLUTION.TIMEOUT);
  assert.equal(outcome.permission, LOCATION_PERMISSION.GRANTED, '획득 실패가 권한 거부로 바뀌면 안 된다 (§23)');
  assert.equal(outcome.error.code, 'BROWSER_LOCATION_TIMEOUT');
});

// ⑨ unavailable
await check('⑨ 위치를 쓸 수 없는 브라우저/환경을 UNAVAILABLE 로 다룬다', async () => {
  // geolocation 자체가 없는 환경
  const absent = await resolveSharedBrowserCurrentLocation({
    permissions: permissionsStub('granted'), geolocation: undefined, now,
  });
  assert.equal(absent.permission, LOCATION_PERMISSION.UNAVAILABLE);
  assert.equal(absent.resolution, LOCATION_RESOLUTION.ERROR);
  assert.equal(absent.location, null);

  // provider 가 좌표를 줄 수 없는 경우 (GPS off 등)
  const unavailable = await resolveSharedBrowserCurrentLocation({
    permissions: permissionsStub('granted'),
    geolocation: geolocationStub({error: {code: 2, message: 'unavailable'}}),
    now,
  });
  assert.equal(unavailable.resolution, LOCATION_RESOLUTION.ERROR);
  assert.equal(unavailable.error.code, 'BROWSER_LOCATION_UNAVAILABLE');
});

// ⑩ permission revoked — 캐시가 권한 우회 수단이 되지 않는다 (§8)
await check('⑩ 권한이 취소되면 남아 있던 현재 위치도 더 이상 쓰이지 않는다', async () => {
  const geolocation = geolocationStub();
  const first = await resolveSharedBrowserCurrentLocation({
    permissions: permissionsStub('granted'), geolocation, now,
  });
  assert.equal(first.resolution, LOCATION_RESOLUTION.RESOLVED);
  assert.notEqual(getRecentBrowserCurrentLocation({now}), null);

  // 사용자가 브라우저 설정에서 위치 권한을 껐다.
  const after = await resolveSharedBrowserCurrentLocation({
    permissions: permissionsStub('denied'), geolocation, now,
  });
  assert.equal(after.permission, LOCATION_PERMISSION.DENIED);
  assert.equal(after.location, null, '권한이 사라진 뒤 캐시된 좌표를 돌려주면 안 된다');
  assert.equal(getRecentBrowserCurrentLocation({now}), null, '권한 확인이 캐시를 비워야 한다');
  assert.equal(geolocation.calls.length, 1, '거부 상태에서 GPS 를 다시 부르면 안 된다');
});

// ⑪ recent-location reuse safety
await check('⑪ 최근 위치 재사용은 신선할 때만, 그리고 권한 확인 뒤에만 일어난다', async () => {
  const geolocation = geolocationStub();
  await acquireSharedBrowserCurrentLocation({geolocation, now});
  assert.equal(geolocation.calls.length, 1);

  // 신선한 값은 재사용된다 — GPS 를 다시 부르지 않는다.
  const reused = await acquireSharedBrowserCurrentLocation({geolocation, now});
  assert.equal(geolocation.calls.length, 1);
  assert.equal(reused.capturedAtMs, FIXED_NOW);

  // stale window 를 넘기면 더 이상 제공되지 않는다.
  const later = () => FIXED_NOW + BROWSER_CURRENT_LOCATION_MAX_AGE_MS + 1_000;
  assert.equal(getRecentBrowserCurrentLocation({now: later}), null);
  const laterGeolocation = geolocationStub({clock: later});
  const refreshed = await acquireSharedBrowserCurrentLocation({geolocation: laterGeolocation, now: later});
  assert.equal(laterGeolocation.calls.length, 1, 'stale 해진 뒤에는 실제로 다시 읽어야 한다');
  assert.equal(refreshed.capturedAtMs, later(), '다시 읽은 값은 그 시점의 fix 다');

  // 캐시는 이 모듈 스코프에만 산다 (§21).
  const source = codeOf('site-current-location.js');
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|document\.cookie/,
    '공통 위치 캐시는 브라우저 저장소에 기록되면 안 된다 — process/session lifetime 뿐이다');
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|sendBeacon/,
    '공통 위치 계층은 좌표를 어디에도 전송하지 않는다');
});

// ====================================================== cross-feature ===
// ⑫ Weather grant → Festival reuses
await check('⑫ 날씨가 얻은 권한·위치를 축제가 재사용한다 (GPS 재호출 없음)', async () => {
  const geolocation = geolocationStub();
  const permissions = permissionsStub('granted');

  const weather = await resolveSharedBrowserCurrentLocation({permissions, geolocation, now});
  assert.equal(weather.resolution, LOCATION_RESOLUTION.RESOLVED);
  assert.equal(geolocation.calls.length, 1);

  const festival = await resolveSharedBrowserCurrentLocation({permissions, geolocation, now});
  assert.equal(festival.resolution, LOCATION_RESOLUTION.RESOLVED);
  assert.deepEqual(festival.location, weather.location);
  assert.equal(geolocation.calls.length, 1, '축제가 위치를 다시 읽으면 안 된다');
});

// ⑬ Festival grant → Calendar reuses
await check('⑬ 축제가 얻은 권한·위치를 캘린더가 재사용한다 (GPS 재호출 없음)', async () => {
  const geolocation = geolocationStub();
  const permissions = permissionsStub('granted');

  const festival = await acquireSharedBrowserCurrentLocation({geolocation, now});
  assert.equal(geolocation.calls.length, 1);

  const calendar = await resolveSharedBrowserCurrentLocation({permissions, geolocation, now});
  assert.deepEqual(calendar.location, festival);
  assert.equal(geolocation.calls.length, 1, '캘린더가 위치를 다시 읽으면 안 된다');
});

// ⑭ 한 기능 위치 성공 → 다른 기능이 fresh shared location 재사용 + §9 동시 요청 1회
await check('⑭ 동시에 위치를 필요로 하는 두 기능이 요청을 하나만 만든다', async () => {
  let deliver;
  const calls = [];
  const geolocation = {
    getCurrentPosition(onSuccess, _onError, options) {
      calls.push(options);
      deliver = () => onSuccess({
        coords: {latitude: 35.1796, longitude: 129.0756, accuracy: 25},
        timestamp: FIXED_NOW,
      });
    },
  };
  const permissions = permissionsStub('granted');

  // 캘린더 날씨와 축제가 거의 동시에 mount 됐다.
  const both = Promise.all([
    resolveSharedBrowserCurrentLocation({permissions, geolocation, now}),
    resolveSharedBrowserCurrentLocation({permissions, geolocation, now}),
  ]);
  // 두 호출이 모두 공통 계층을 통과할 기회를 준다.
  for (let i = 0; i < 12; i += 1) await Promise.resolve();
  assert.equal(calls.length, 1, '두 기능이 동시에 물어도 getCurrentPosition 은 한 번이다 (§9)');
  deliver();
  const [a, b] = await both;
  assert.equal(a.resolution, LOCATION_RESOLUTION.RESOLVED);
  assert.equal(b.resolution, LOCATION_RESOLUTION.RESOLVED);
  assert.deepEqual(a.location, b.location, '두 기능이 같은 좌표를 받는다');
  assert.equal(calls.length, 1);
});

await check('⑭b 실패한 공유 요청은 다음 호출자에게 물려주지 않는다', async () => {
  let attempt = 0;
  const geolocation = {
    getCurrentPosition(onSuccess, onError) {
      attempt += 1;
      if (attempt === 1) {
        onError({code: 2, message: 'unavailable'});
        return;
      }
      onSuccess({coords: {latitude: 37.5665, longitude: 126.978, accuracy: 30}, timestamp: FIXED_NOW});
    },
  };
  const permissions = permissionsStub('granted');
  const first = await resolveSharedBrowserCurrentLocation({permissions, geolocation, now});
  assert.equal(first.resolution, LOCATION_RESOLUTION.ERROR);
  const second = await resolveSharedBrowserCurrentLocation({permissions, geolocation, now});
  assert.equal(second.resolution, LOCATION_RESOLUTION.RESOLVED, '다음 호출자는 새로 시도해야 한다');
  assert.equal(attempt, 2);
});

// ⑮ manual feature region not overwritten — 기능별 수동 지역은 공통 계층이 모른다
await check('⑮ 기능별 수동 지역은 공통 위치 계층이 건드리지 않는다', async () => {
  const shared = codeOf('site-current-location.js');
  // 공통 계층은 어떤 기능의 수동 지역도 읽거나 쓰지 않는다 (§1-B / §14 / §22).
  for (const forbidden of [
    /lotbi\.calendar\.weather-region/,
    /manualWeatherRegion/,
    /WEATHER_REGION_ORIGIN/,
    /MANUAL_REGION/,
    /state\.region/,
  ]) {
    assert.doesNotMatch(shared, forbidden,
      '공통 위치 계층은 기능별 수동 지역 개념을 알아서는 안 된다 — 권한과 좌표만 다룬다');
  }

  // 캘린더: 수동 지역이면 자동 GPS 경로가 아예 시작되지 않는다.
  const manager = read('site-calendar-manager.js');
  assert.match(
    manager,
    /if \(state\.weatherRegionOrigin === WEATHER_REGION_ORIGIN\.MANUAL\) return;/,
    '캘린더의 수동 지역은 자동 현재위치가 덮어쓰지 않아야 한다',
  );
  // 축제: 수동 지역을 고르면 현재위치 모드가 해제된다.
  const festival = read('site-festival-ui.js');
  assert.match(
    festival,
    /function selectManualRegion\(province\) \{\s*state\.region = province;\s*state\.locationMode = 'NONE';/,
    '축제의 수동 지역 선택은 현재위치 모드를 해제해야 한다',
  );
  // 두 기능은 서로의 수동 지역 저장소를 읽지 않는다 (§1-B: 제주를 골라도 축제가 제주가 되지 않는다).
  assert.doesNotMatch(festival, /lotbi\.calendar\.weather-region/,
    '축제가 캘린더의 수동 지역 설정을 읽으면 안 된다');
});

// ⑯ ungranted 초기 mount 에서 자동 prompt 없음
await check('⑯ 미허용 상태의 초기 mount 는 권한 팝업을 띄우지 않는다', async () => {
  for (const state of ['prompt', 'denied']) {
    clearRecentBrowserCurrentLocation();
    const geolocation = geolocationStub();
    const outcome = await resolveSharedBrowserCurrentLocation({
      permissions: permissionsStub(state), geolocation, now,
    });
    assert.equal(outcome.location, null);
    assert.equal(geolocation.calls.length, 0,
      `${state} 상태에서 화면을 여는 것만으로 getCurrentPosition 을 부르면 안 된다 (§5)`);
  }

  // 명시적 사용자 동작(allowPrompt)일 때만 미결정 상태에서 요청이 나간다.
  clearRecentBrowserCurrentLocation();
  const geolocation = geolocationStub();
  const tapped = await resolveSharedBrowserCurrentLocation({
    permissions: permissionsStub('prompt'), geolocation, now, allowPrompt: true,
  });
  assert.equal(tapped.resolution, LOCATION_RESOLUTION.RESOLVED);
  assert.equal(geolocation.calls.length, 1, '사용자가 누른 경우에는 요청이 나가야 한다');

  // 거부 상태에서는 allowPrompt 여도 다시 묻지 않는다 (§5: 자동 재요청 금지).
  clearRecentBrowserCurrentLocation();
  const denied = geolocationStub();
  const deniedOutcome = await resolveSharedBrowserCurrentLocation({
    permissions: permissionsStub('denied'), geolocation: denied, now, allowPrompt: true,
  });
  assert.equal(deniedOutcome.permission, LOCATION_PERMISSION.DENIED);
  assert.equal(denied.calls.length, 0, 'DENIED 에서는 사용자가 눌러도 브라우저에 다시 묻지 않는다');
});

// ------------------------------------------------ 기존 계약 보존 (§3/§28) --
await check('기존 공통 계층 export 가 그대로 남아 있다', async () => {
  assert.equal(BROWSER_CURRENT_LOCATION_MAX_AGE_MS, 120_000, 'stale window 는 120초 계약이다');
  assert.equal(typeof requestBrowserCurrentLocation, 'function');
  assert.equal(typeof getBrowserLocationPermissionState, 'function');
  assert.equal(typeof isFreshBrowserCurrentLocation, 'function');
  assert.ok(new BrowserLocationError('X', 'y') instanceof Error);
  assert.deepEqual(Object.keys(LOCATION_PERMISSION).sort(),
    ['DENIED', 'GRANTED', 'PROMPT_REQUIRED', 'UNAVAILABLE', 'UNKNOWN']);
  assert.deepEqual(Object.keys(LOCATION_RESOLUTION).sort(),
    ['ERROR', 'IDLE', 'REQUESTING', 'RESOLVED', 'TIMEOUT']);

  // 주입 없는 primitive 는 공유 상태를 갖지 않는다: 호출할 때마다 실제로 읽는다.
  const geolocation = geolocationStub();
  await requestBrowserCurrentLocation({geolocation, now});
  await requestBrowserCurrentLocation({geolocation, now});
  assert.equal(geolocation.calls.length, 2,
    'requestBrowserCurrentLocation 은 캐시 없는 primitive 로 남아야 한다');
});

// ---------------------------------------- §17 architecture guard (Web) ----
await check('§17 공통 계층 밖에서는 아무도 geolocation API 를 직접 부르지 않는다', async () => {
  const {execFileSync} = await import('node:child_process');
  const tracked = execFileSync('git', ['ls-files', '--', '*.js', '*.html'], {cwd: ROOT, encoding: 'utf8'})
    .split('\n').map(line => line.trim()).filter(Boolean)
    .filter(rel => rel !== 'site-current-location.js' && !rel.startsWith('scripts/') && !rel.startsWith('tools/'));

  const offenders = [];
  for (const rel of tracked) {
    const source = codeOf(rel);
    // 공통 계층에 provider 를 주입하는 것(navigator?.geolocation 을 인자로 넘기는 것)은
    // 정상이다. 금지되는 것은 스스로 좌표를 읽거나 권한을 질의하는 것이다.
    if (/\.getCurrentPosition\s*\(|\.watchPosition\s*\(|permissions\s*\.\s*query\s*\(/.test(source)) {
      offenders.push(rel);
    }
  }
  assert.deepEqual(offenders, [],
    `위치 권한/좌표 획득은 site-current-location.js 에만 있어야 한다 — 우회: ${offenders.join(', ')}`);

  // 그리고 위치를 쓰는 기능은 반드시 공통 계층에서 import 한다.
  for (const rel of ['site-calendar-manager.js', 'site-festival-ui.js']) {
    assert.match(read(rel), /from '\.\/site-current-location\.js(?:\?v=[A-Za-z0-9._-]+)?'/,
      `${rel} 은 공통 위치 계층을 import 해야 한다`);
  }
});

console.log(`\nGLOBAL LOCATION FOUNDATION VALIDATION PASS — ${passed} contract groups verified.`);
