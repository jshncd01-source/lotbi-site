// GLOBAL-LOCATION-15 — 공통 위치 계층의 실제 브라우저 엔진 동작 (§18).
//
// 위의 validate_global_location_foundation_01.mjs 는 주입한 stub 으로 계약을
// 확인한다. 이 스크립트는 같은 모듈을 실제 Chromium 안에서 실행해서, 주입 없이
// 진짜 navigator.permissions / navigator.geolocation 을 상대로도 계약이 유지되는지
// 측정한다.
//
// 측정 대상 (§18): navigator.permissions.query({name:'geolocation'}) 지원 수준과,
// 권한이 없는 상태에서 공통 계층이 실제로 권한 팝업을 띄우지 않는지.
//
// 엔진마다 지원 수준이 실제로 다르다. 이 컨테이너의 Chromium 141 은 'prompt' 를
// 돌려주고, GitHub Actions 의 headless Chrome 은 같은 질의에 아무 답도 하지 않는다.
// 그래서 이 스크립트는 특정 권한 문자열을 요구하지 않는다: 허용이 아닌 상태로
// 읽히는지, 그리고 그 상태에서 좌표를 묻지 않는지만 요구한다. 답하지 않는 엔진에서
// 공통 계층은 UNKNOWN 으로 끝나야 하고(§23), 그것을 여기서 확인한다.
//
// 여기서 측정되는 엔진은 Chromium 하나다. Android Chrome / Samsung Internet /
// iPhone Safari 는 이 컨테이너에 없으므로 이 스크립트가 PASS 를 주지 않는다 --
// 그 세 환경은 실기기 확인이 필요하고, 보고서에 NOT MEASURED 로 남는다.
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE_REL = 'scripts/.global-location-compat-page.html';
const PAGE = path.join(ROOT, PAGE_REL);
const PORT = 4253;
const ORIGIN = `http://127.0.0.1:${PORT}`;

function browserPath() {
  for (const name of [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (name.includes('/') && fs.existsSync(name)) return name;
    const found = spawnSync('which', [name], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required');
}

function waitServer() {
  const deadline = Date.now() + 15_000;
  for (;;) {
    const probe = spawnSync('python3', ['-c',
      `import socket,sys;s=socket.socket();s.settimeout(0.4)\ntry:\n s.connect(("127.0.0.1",${PORT}));sys.exit(0)\nexcept Exception:\n sys.exit(1)`,
    ]);
    if (probe.status === 0) return;
    if (Date.now() > deadline) throw new Error('static server did not start');
  }
}

// 브라우저에 권한을 부여하지 않은 상태로 띄운다. Chromium 은 headless 에서
// 프롬프트를 자동 거부하지 않으므로, getCurrentPosition 이 실제로 불렸는지를
// navigator.geolocation 을 감싸서 직접 센다.
const page = `<!doctype html><html lang="ko"><head><meta charset="utf-8"></head><body>
<pre id="result">pending</pre>
<script type="module">
const out = document.getElementById('result');
const stages = [];
const mark = stage => { stages.push(stage); out.textContent = JSON.stringify({ok: false, stages}); };
const done = value => { out.textContent = JSON.stringify({...value, stages}); };
mark('script-start');

// --dump-dom 은 module script 의 top-level await 를 기다려 주지 않으므로 promise
// chain 으로 쓰고, 단계마다 결과 요소를 갱신한다.
//
// 이 페이지는 geolocation 권한을 정확히 한 번만 query 한다: headless Chromium 에서
// 같은 권한을 연달아 query 하면 두 번째 promise 가 resolve 되지 않는 일이 있다.
// 실제 브라우저의 동작이 아니라 이 엔진의 측정 제약이다. 그래서 원시 state 도
// 따로 묻지 않고, 공통 계층이 실제로 수행하는 그 한 번의 query 를 관찰해서 얻는다.
import('/site-current-location.js').then(async mod => {
  mark('module-imported');

  // Permissions API 지원 여부는 query 를 소비하지 않고 확인한다 (§18).
  const permissionsApiSupported = typeof navigator.permissions?.query === 'function';

  // 공통 계층이 실제로 던지는 query 를 그대로 관찰한다.
  const queries = [];
  let rawQueryState = null;
  let rawQueryThrew = null;
  if (permissionsApiSupported) {
    const originalQuery = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = async descriptor => {
      queries.push(descriptor?.name);
      try {
        const status = await originalQuery(descriptor);
        rawQueryState = status?.state ?? null;
        return status;
      } catch (error) {
        rawQueryThrew = String(error?.name || error);
        throw error;
      }
    };
  }

  // 권한 팝업을 띄울 수 있는 유일한 경로는 getCurrentPosition 이다. 화면을 여는
  // 경로(allowPrompt 없음)가 그것을 부르는지 실제 엔진에서 센다.
  let positionCalls = 0;
  const originalPosition = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
  navigator.geolocation.getCurrentPosition = (...args) => { positionCalls += 1; return originalPosition(...args); };
  mark('instrumented');

  const mounted = await mod.resolveSharedBrowserCurrentLocation();
  mark('mount-resolved');

  done({
    ok: true,
    userAgent: navigator.userAgent,
    permissionsApiSupported,
    geolocationQueries: queries.filter(name => name === 'geolocation').length,
    rawQueryState,
    rawQueryThrew,
    permission: mounted.permission,
    mountedResolution: mounted.resolution,
    mountedLocationIsNull: mounted.location === null,
    callsAfterMount: positionCalls,
    maxAgeMs: mod.BROWSER_CURRENT_LOCATION_MAX_AGE_MS,
    permissionKeys: Object.keys(mod.LOCATION_PERMISSION).sort(),
    recentIsNull: mod.getRecentBrowserCurrentLocation() === null,
  });
}).catch(error => done({ok: false, error: String(error?.stack || error)}));
<\/script></body></html>`;

const browser = browserPath();
fs.writeFileSync(PAGE, page, 'utf8');
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
try {
  waitServer();
  const r = spawnSync(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--virtual-time-budget=20000', '--dump-dom', `${ORIGIN}/${PAGE_REL}`,
  ], {encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024});
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`browser ${r.status} ${r.stderr}`);

  const open = '<pre id="result">';
  const i = r.stdout.indexOf(open);
  const j = r.stdout.indexOf('</pre>', i);
  if (i < 0 || j < 0) throw new Error('result missing from rendered DOM');
  const measured = JSON.parse(r.stdout.slice(i + open.length, j)
    .replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>'));

  if (!measured.ok) {
    // 측정이 끝나지 않았으면 어디까지 갔는지 그대로 보고한다 -- 원인을 추측하지 않는다.
    throw new Error(`in-browser measurement did not complete. stages=${JSON.stringify(measured.stages)} error=${measured.error ?? 'none reported'}`);
  }

  // 계약 단정 — 측정값에 대고.
  if (measured.maxAgeMs !== 120_000) throw new Error(`stale window must stay 120s, measured ${measured.maxAgeMs}`);
  if (measured.permissionKeys.join(',') !== 'DENIED,GRANTED,PROMPT_REQUIRED,UNAVAILABLE,UNKNOWN') {
    throw new Error(`permission enum drifted: ${measured.permissionKeys.join(',')}`);
  }
  // 이 엔진은 권한이 없다. 읽힐 수 있는 값은 PROMPT_REQUIRED(답하는 엔진) 또는
  // UNKNOWN(답하지 않는 엔진)이다. GRANTED 로 읽히면 안 되고, geolocation 자체는
  // 존재하므로 UNAVAILABLE 이어서도 안 된다.
  if (!['PROMPT_REQUIRED', 'UNKNOWN'].includes(measured.permission)) {
    throw new Error(`an unauthorized engine must read as PROMPT_REQUIRED or UNKNOWN, measured ${measured.permission} (§18)`);
  }
  // 핵심: 화면을 여는 것만으로 권한 팝업 경로가 열리지 않는다 (§5/§16).
  if (measured.callsAfterMount !== 0) {
    throw new Error(`mounting called getCurrentPosition ${measured.callsAfterMount}x — a real engine would have shown a permission prompt (§5)`);
  }
  if (!measured.mountedLocationIsNull) throw new Error('an ungranted mount must yield no location');
  if (measured.mountedResolution !== 'IDLE') {
    throw new Error(`an ungranted mount must settle as IDLE, measured ${measured.mountedResolution}`);
  }
  if (!measured.recentIsNull) throw new Error('nothing may be cached before any location resolved');
  if (measured.geolocationQueries !== 1) {
    throw new Error(`the shared layer must read the permission exactly once per call, measured ${measured.geolocationQueries}`);
  }
  // 답하지 않는 엔진에서도 권한 확인이 끝났다는 뜻이다 -- 이 줄에 도달한 것 자체가
  // 그 증거지만, 어느 쪽 엔진이었는지 보고에 남긴다.
  if (measured.permission === 'UNKNOWN' && measured.rawQueryState !== null) {
    throw new Error('UNKNOWN must mean the query never answered, not that a state was read and dropped');
  }

  console.log('GLOBAL LOCATION BROWSER COMPAT PASS (this engine only)');
  console.log(JSON.stringify({
    engine: measured.userAgent,
    permissionsApiSupported: measured.permissionsApiSupported,
    rawGeolocationQueryState: measured.rawQueryState ?? 'never answered in this engine',
    rawGeolocationQueryThrew: measured.rawQueryThrew,
    sharedLayerReads: measured.permission,
    geolocationPermissionQueries: measured.geolocationQueries,
    getCurrentPositionCallsOnMount: measured.callsAfterMount,
  }, null, 2));
  console.log('NOT MEASURED HERE: Android Chrome, Samsung Internet, iPhone Safari — real devices required.');
} finally {
  server.kill('SIGTERM');
  fs.rmSync(PAGE, {force: true});
}
