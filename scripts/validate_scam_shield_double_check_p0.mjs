// SCAM-SHIELD-DOUBLE-CHECK-P0 — 진위확인 shows Core's second, independent check.
//
// Core now answers with `summary`, `double_check`, `official_sources` and
// `police_statistics`. Real Chrome renders the real dialog; each analysis is
// answered with a Core-shaped JSON body that goes through the real
// site-core.js analyzeScamShield() normalization, then site-scam-shield.js.
//
// Checks: the three-line 2단계 확인 결과 sits right under 결론; only https
// .go.kr/.or.kr pages become links (a forged source is shown as text only);
// police statistics are folded away and dropped when Core does not mark them
// as background-only; an older Core answer without these fields still renders;
// a failed second check says so; WCAG AA contrast in light and dark; no
// sideways overflow at 390px. Viewport emulation only, not a device run.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.env.SCAM_DOUBLE_CHECK_SHOTS || '';
const ui = fs.readFileSync(path.join(ROOT, 'site-scam-shield.js'), 'utf8');
const core = fs.readFileSync(path.join(ROOT, 'site-core.js'), 'utf8');

// Static: copy that must not claim more than the check did.
assert.doesNotMatch(ui, /안전합니다|안전해요|사기 아님|진짜 기관입니다/u);
assert.match(ui, /2단계 확인 결과/u);
assert.match(ui, /공식 근거/u);
assert.match(core, /SCAM_OFFICIAL_LINK_HOST = \/\(\?:\^\|\\\.\)\(\?:go\|or\)\\\.kr\$\/u/u);
assert.match(core, /value\.affects_risk_level !== false/u, 'statistics render only when Core marks them background-only');

function browserPath() {
  const candidates = [
    process.env.CHROME_BIN,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/opt/pw-browsers/chromium',
    'google-chrome-stable',
    'google-chrome',
    'chromium',
    'chromium-browser',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
    const lookup = process.platform === 'win32' ? 'where.exe' : 'which';
    const found = spawnSync(lookup, [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim().split(/\r?\n/)[0];
  }
  throw new Error('Chrome/Chromium is required for the 진위확인 double-check validation.');
}

function startServer() {
  const serverCode = `
    const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
    const root=${JSON.stringify(ROOT)};
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.ico':'image/x-icon','.webmanifest':'application/manifest+json'};
    const send=(res,file)=>fs.readFile(file,(error,data)=>{if(error){res.writeHead(404,{'Content-Type':'text/plain'});res.end('404');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});
    const server=http.createServer((req,res)=>{
      const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
      const target=path.resolve(root,'.'+pathname);
      if(!target.startsWith(root)){res.writeHead(403);res.end();return;}
      fs.stat(target,(error,stat)=>send(res,!error&&stat.isDirectory()?path.join(target,'index.html'):target));
    });
    server.listen(0,'127.0.0.1',()=>process.stdout.write(String(server.address().port)+'\\n'));
  `;
  return spawn(process.execPath, ['-e', serverCode], {cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit']});
}

async function serverPort(server) {
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('local server start timeout')), 5000);
    server.once('error', reject);
    server.stdout.once('data', chunk => { clearTimeout(timer); resolve(Number.parseInt(String(chunk).trim(), 10)); });
  });
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const isDone = value => value === true || Boolean(value && typeof value === 'object' && !value.error && value.ok !== false);
async function waitFor(fn, label, timeoutMs = 15000) {
  const started = Date.now();
  let last;
  for (;;) {
    last = await fn().catch(error => ({error: String(error)}));
    if (isDone(last)) return last;
    if (Date.now() - started > timeoutMs) throw new Error(`timeout: ${label} — last=${JSON.stringify(last).slice(0, 1500)}`);
    await sleep(80);
  }
}

const BASE = {
  contract_id: 'LOTBI-SAFECARE-REAL-USER-01',
  case_id: 'scam_0123456789abcdef0123',
  status: 'ANALYZED',
  headline: '이건 열지 마세요.',
  reasons: ['‘안전계좌’ 같은 계좌로 돈을 옮기라고 합니다.'],
  confirmed_facts: ['메시지가 검찰청을(를) 언급합니다.'],
  unverified_items: ['기관을 언급하지만 비교할 주소·번호가 없어 공식 여부를 확인하지 못했어요.'],
  next_safe_action: ['송금·상품권 구매·현금 전달을 멈추세요.'],
  do_now: ['송금·상품권 구매·현금 전달을 멈추세요.', '이미 돈을 보냈다면 바로 112나 돈을 보낸 금융회사 콜센터에 지급정지를 요청하세요.'],
  do_not: ['링크를 누르지 마세요.'],
  evidence: [],
  untrusted_file_execution: false,
  untrusted_javascript_execution: false,
  public_file_upload_to_third_party: false,
  checked_at: '2026-10-10T04:00:00+00:00',
};
const FULL = {
  ...BASE,
  risk_level: 'HIGH_RISK',
  summary: '이 내용에는 기관 사칭과 안전계좌 이체 요구 정황이 있어요. 확인되지 않은 계좌로 돈을 보내지 마세요.',
  double_check: {
    status: 'COMPLETED',
    agreement: 'ESCALATED',
    signals: [
      {code: 'INSTITUTION_IMPERSONATION', label: '기관 사칭', severity: 'HIGH', confirmed_by: 'SECOND_ONLY'},
      {code: 'SAFE_ACCOUNT', label: '안전계좌 이체 요구', severity: 'HIGH', confirmed_by: 'SECOND_ONLY'},
      {code: 'FIRST_PASS_MONEY', label: '송금·결제 요구', severity: 'INFO', confirmed_by: 'FIRST_ONLY'},
    ],
    scam_types: [{code: 'INSTITUTION_IMPERSONATION', label: '기관사칭형', basis: 'INFERRED'}],
    official_check: {state: 'NOT_VERIFIABLE', message: '공식 기관인지 확인할 수 있는 근거가 없어요.'},
    individual_lookup: {state: 'NOT_VERIFIABLE', message: '조회하지 않았어요.', performed_by_lotbi: false, self_check: [
      {source_id: 'POLICE_CYBER_FRAUD_LOOKUP', kind: 'SELF_LOOKUP', agency: '경찰청', title: '사이버사기 피해신고 이력조회', url: 'https://www.police.go.kr/www/security/cyber/cyber04.jsp', checked_at: '2026-10-10', stale: false, statement: '조회 결과가 없어도 안전하다는 뜻은 아니에요.'},
    ]},
    report_paths: [
      {source_id: 'PAYMENT_STOP_112', kind: 'REPORT_PATH', agency: '금융위원회', title: '피해 시 지급정지 요청 안내', url: 'https://www.fsc.go.kr/no010101/87882', checked_at: '2026-10-10', stale: false, statement: '이미 돈을 보냈다면 바로 112나 금융회사 콜센터에 지급정지를 요청하세요.'},
    ],
    contradictions: [{code: 'FIRST_PASS_UNDERRATED', message: '1차 분석보다 위험 신호가 더 확인되어 판단을 높였어요.'}],
    unverified: ['기관을 언급하지만 비교할 주소·번호가 없어 공식 여부를 확인하지 못했어요.'],
  },
  official_sources: [
    {source_id: 'REGISTRY:검찰청', kind: 'OFFICIAL_ADDRESS_REGISTRY', agency: '검찰청', title: '검찰청 공식 주소·대표번호(검토된 목록)', url: 'https://www.spo.go.kr', checked_at: '2026-10-04', stale: false, statement: '공식 주소: spo.go.kr'},
    {source_id: 'SOS_PUBLIC_NO_TRANSFER', kind: 'OFFICIAL_GUIDANCE', agency: '전기통신금융사기 통합대응단(경찰청)', title: '피싱안심SOS 보이스피싱 제보 방법 안내', url: 'https://www.counterscam112.go.kr/board/CONTENT_000000000010.do', checked_at: '2026-10-10', stale: false, statement: '공공기관·금융기관은 어떤 경우에도 개인정보나 송금을 요구하지 않는다고 안내해요.'},
    {source_id: 'FORGED', kind: 'OFFICIAL_GUIDANCE', agency: '금융감독원', title: '위조된 출처(링크가 되면 안 됨)', url: 'https://fss-or-kr.example/notice', checked_at: '2026-10-10', stale: false, statement: '검증용'},
    {source_id: 'PLAIN_HTTP', kind: 'OFFICIAL_GUIDANCE', agency: '금융위원회', title: 'http 출처(링크가 되면 안 됨)', url: 'http://www.fsc.go.kr/x', checked_at: '2024-01-01', stale: true, statement: '검증용'},
  ],
  police_statistics: {
    dataset_id: '15063815', title: '경찰청_보이스피싱 현황', agency: '경찰청', source_url: 'https://www.data.go.kr/data/15063815/fileData.do',
    data_version: '15063815@2026-01-21', category: '기관사칭형', base_year: 2025,
    figures: {cases: 13323, damage_100m_krw: 9884, arrested: 15161}, unit_note: '', use: 'BACKGROUND_ONLY', affects_risk_level: false,
    note: '경찰청이 공개한 2025년 전국 기관사칭형 보이스피싱 통계예요. 이 메시지를 경찰청이 확인했다는 뜻이 아니고, 이 통계로 위험도를 정하지 않았어요.', freshness: 'RECENT',
  },
};
const OLD = {...BASE, risk_level: 'SUSPICIOUS', headline: '조심하세요.'};
const FAILED = {
  ...BASE,
  risk_level: 'UNVERIFIED',
  headline: '지금 정보만으로는 진짜라고 확인할 수 없어요.',
  status: 'PARTIAL',
  summary: '보낸 곳이 진짜인지 확인할 수 없어요. 공식 연락처를 직접 찾아 확인하세요.',
  double_check: {status: 'FAILED', agreement: 'FAILED', signals: [], official_check: {state: 'NOT_VERIFIABLE', message: '2단계 확인을 끝내지 못해 공식 근거를 대조하지 못했어요.'}, individual_lookup: {state: 'NOT_VERIFIABLE', self_check: []}, report_paths: [], contradictions: [], unverified: ['2단계 확인을 끝내지 못했어요.']},
  official_sources: [],
  police_statistics: null,
};
const STATS_NOT_BACKGROUND = {...FULL, police_statistics: {...FULL.police_statistics, affects_risk_level: true}};
const PAYLOADS = {FULL, OLD, FAILED, STATS_NOT_BACKGROUND};

// Account/Core answered offline; the dialog's session question answered
// "signed in"; each analysis goes through the real site-core normalization.
const MOCK = `(() => {
  const nativeFetch = window.fetch.bind(window);
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  window.fetch = async (input, init = {}) => {
    let url;
    try { url = new URL(String((input && input.url) || input), window.location.href); } catch { return nativeFetch(input, init); }
    if (url.origin === window.location.origin) return nativeFetch(input, init);
    if (url.origin === 'https://account.lotbiai.com' && url.pathname === '/api/auth/site-session-status') return json({contract_id: 'ACCOUNT-SITE-SESSION-STATUS-01', schema_version: 1, authenticated: false});
    if (url.pathname === '/v2/conversation/guest/sessions') return json({contract_id: 'CORE-GUEST-SESSION-01', schema_version: 1, guest_token: 'g'.repeat(43), expires_at: new Date(Date.now() + 3600e3).toISOString()});
    return json({error: {code: 'UNAUTHENTICATED'}}, 401);
  };
  window.__scamPayloads = ${JSON.stringify(PAYLOADS)};
  window.addEventListener('lotbi:scam-shield-session-request', event => { event.detail?.resolve?.(true); });
  window.addEventListener('lotbi:scam-shield-request', event => {
    event.stopImmediatePropagation();
    const body = window.__scamPayloads[window.__scamPayload || 'FULL'];
    import('/site-core.js?double-check-validator').then(({analyzeScamShield}) =>
      analyzeScamShield('validator-session', event.detail.formData, async () => json(body)),
    ).then(event.detail.resolve, event.detail.reject);
  });
})();`;

const THEMES = [
  {label: 'light', cookie: 'light', media: 'light'},
  {label: 'dark', cookie: 'dark', media: 'light'},
];
const VIEWPORTS = [
  {label: 'iPhone-390x844', width: 390, height: 844, mobile: true},
  {label: 'desktop-1280x900', width: 1280, height: 900, mobile: false},
];

async function openBrowser(browser, profile) {
  const chrome = spawn(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1280,900', 'about:blank',
  ], {stdio: 'ignore'});
  const portFile = path.join(profile, 'DevToolsActivePort');
  await waitFor(async () => fs.existsSync(portFile) && fs.readFileSync(portFile, 'utf8').includes('\n'), 'DevToolsActivePort');
  const [port] = fs.readFileSync(portFile, 'utf8').split(/\r?\n/);
  const version = await waitFor(() => fetch(`http://127.0.0.1:${port}/json/version`).then(r => r.json()), 'browser endpoint');
  const socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let nextId = 0;
  const pending = new Map();
  const listeners = new Set();
  socket.onmessage = event => {
    const message = JSON.parse(String(event.data));
    if (message.id && pending.has(message.id)) {
      const {resolve, reject} = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
      return;
    }
    if (message.method) for (const listener of listeners) listener(message);
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    nextId += 1;
    pending.set(nextId, {resolve, reject});
    socket.send(JSON.stringify({id: nextId, method, params, ...(sessionId ? {sessionId} : {})}));
  });
  const close = () => { try { socket.close(); } catch {} chrome.kill('SIGTERM'); };
  return {send, close, on: listener => { listeners.add(listener); return () => listeners.delete(listener); }};
}

const INSPECT = `(() => {
  const parse = value => { const m = value.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return {r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1}; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const backgroundOf = node => {
    const layers = [];
    for (let el = node; el; el = el.parentElement) {
      const c = parse(getComputedStyle(el).backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
    }
    let base = {r: 255, g: 255, b: 255};
    for (const layer of layers.reverse()) base = {r: layer.r * layer.a + base.r * (1 - layer.a), g: layer.g * layer.a + base.g * (1 - layer.a), b: layer.b * layer.a + base.b * (1 - layer.a)};
    return base;
  };
  const ratio = node => {
    if (!node) return null;
    const fg = parse(getComputedStyle(node).color), bg = backgroundOf(node);
    const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
  };
  const result = document.querySelector('[data-scam-result]');
  const check = result.querySelector('.scam-double-check');
  const headings = [...result.querySelectorAll('h3, h4')].map(node => node.textContent);
  const links = [...result.querySelectorAll('a[href]')].map(a => ({href: a.href, target: a.target, rel: a.rel, text: a.textContent}));
  const stats = result.querySelector('details.scam-police-stats');
  const sourceTexts = [...result.querySelectorAll('.scam-official-sources li')].map(li => li.textContent);
  return {
    level: result.dataset.riskLevel,
    summary: result.querySelector('.scam-result-summary')?.textContent || '',
    checkStatus: check?.dataset.scamDoubleCheck || '',
    checkTerms: check ? [...check.querySelectorAll('dt')].map(node => node.textContent) : [],
    checkValues: check ? [...check.querySelectorAll('dd')].map(node => node.textContent) : [],
    headings,
    links,
    sourceTexts,
    statsPresent: Boolean(stats),
    statsOpen: Boolean(stats?.open),
    statsText: stats?.textContent || '',
    termStyle: check?.querySelector('dt') ? (() => { const cs = getComputedStyle(check.querySelector('dt')); return cs.color + ' / ' + cs.backgroundColor + ' / ' + cs.opacity + ' / ' + cs.webkitTextFillColor; })() : '',
    overflow: result.scrollWidth - result.clientWidth,
    dialogOverflow: document.querySelector('[data-scam-dialog]').scrollWidth - document.querySelector('[data-scam-dialog]').clientWidth,
    contrast: {
      summary: ratio(result.querySelector('.scam-result-summary')),
      term: ratio(check?.querySelector('dt')),
      value: ratio(check?.querySelector('dd')),
      sourceName: ratio(result.querySelector('.scam-official-sources strong')),
      sourceMeta: ratio(result.querySelector('.scam-source-meta')),
      link: ratio(result.querySelector('.scam-official-sources a')),
    },
  };
})()`;

async function runViewport(browser, origin, workDir, viewport, theme, records) {
  const profile = fs.mkdtempSync(path.join(workDir, 'profile-'));
  const cdp = await openBrowser(browser, profile);
  try {
    const {targetInfos} = await cdp.send('Target.getTargets');
    const pageTarget = targetInfos.find(item => item.type === 'page');
    const {sessionId} = await cdp.send('Target.attachToTarget', {targetId: pageTarget.targetId, flatten: true});
    const page = (method, params) => cdp.send(method, params, sessionId);
    await page('Page.enable');
    await page('Runtime.enable');
    await page('Network.enable');
    await page('Network.setCookie', {name: 'lotbi_theme_preference_v1', value: theme.cookie, url: origin});
    await page('Page.addScriptToEvaluateOnNewDocument', {source: MOCK});
    await page('Emulation.setDeviceMetricsOverride', {width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.mobile});
    if (viewport.mobile) await page('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
    await page('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}, {name: 'prefers-color-scheme', value: theme.media}]});
    const evaluate = async expression => {
      const result = await page('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 600));
      return result.result.value;
    };
    const loaded = new Promise(resolve => {
      const stop = cdp.on(message => {
        if (message.sessionId === sessionId && message.method === 'Page.loadEventFired') { stop(); resolve(); }
      });
      setTimeout(() => { stop(); resolve(); }, 10000);
    });
    await page('Page.navigate', {url: `${origin}/`});
    await loaded;
    await waitFor(() => evaluate("document.body?.dataset.conversationRestore === 'ready'"), 'conversation ready');
    const expectDark = theme.label !== 'light';
    await waitFor(async () => {
      const bg = await evaluate("getComputedStyle(document.body).backgroundColor");
      return (bg === 'rgb(33, 33, 33)') === expectDark ? true : {ok: false, bg};
    }, `${theme.label} theme applied`);
    const tap = async selector => {
      const box = await waitFor(() => evaluate(`(() => {
        const node = [...document.querySelectorAll(${JSON.stringify(selector)})].find(item => item.getClientRects().length && !item.closest('[inert], [hidden]'));
        if (!node) return null;
        node.scrollIntoView({block: 'center', inline: 'center'});
        const rect = node.getBoundingClientRect();
        const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
        const hit = document.elementFromPoint(x, y);
        return hit && (hit === node || node.contains(hit)) ? {x, y} : null;
      })()`), `tap target ${selector}`);
      if (viewport.mobile) {
        await page('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: box.x, y: box.y}]});
        await sleep(30);
        await page('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
      } else {
        await page('Input.dispatchMouseEvent', {type: 'mouseMoved', x: box.x, y: box.y});
        await page('Input.dispatchMouseEvent', {type: 'mousePressed', x: box.x, y: box.y, button: 'left', buttons: 1, clickCount: 1});
        await sleep(30);
        await page('Input.dispatchMouseEvent', {type: 'mouseReleased', x: box.x, y: box.y, button: 'left', buttons: 0, clickCount: 1});
      }
    };
    for (const name of Object.keys(PAYLOADS)) {
      await evaluate(`window.__scamPayload = ${JSON.stringify(name)}; window.dispatchEvent(new CustomEvent('lotbi:scam-shield-close-request')); window.dispatchEvent(new CustomEvent('lotbi:scam-shield-open-request')); true`);
      await waitFor(() => evaluate("(() => { const d = document.querySelector('[data-scam-dialog]'); return Boolean(d?.open && !document.querySelector('[data-scam-workspace]').hidden && !document.querySelector('[data-scam-methods]').hidden); })()"), 'scam workspace');
      await tap('[data-scam-methods] label:has(input[value="text"])');
      await waitFor(() => evaluate("!document.querySelector('#scam-text').disabled"), 'text panel');
      await evaluate("(() => { const t = document.querySelector('#scam-text'); t.value = '검증용 합성 문장입니다'; t.dispatchEvent(new Event('input', {bubbles: true})); return true; })()");
      await tap('[data-scam-dialog] .scam-submit');
      const level = PAYLOADS[name].risk_level;
      await waitFor(() => evaluate(`document.querySelector('[data-scam-result]')?.dataset.riskLevel === ${JSON.stringify(level)} && !document.querySelector('[data-scam-result]').hidden`), `${name} result`);
      await sleep(60);
      const inspected = await evaluate(INSPECT);
      records.push({viewport: viewport.label, theme: theme.label, payload: name, ...inspected});
      console.log(`  rendered ${viewport.label} ${theme.label} ${name}`);
      if (SHOTS) {
        await evaluate("document.querySelector('[data-scam-result]').scrollIntoView({block: 'start'}), true");
        const {data} = await page('Page.captureScreenshot', {format: 'png'});
        fs.mkdirSync(SHOTS, {recursive: true});
        fs.writeFileSync(path.join(SHOTS, `${viewport.label}-${theme.label}-${name}.png`), Buffer.from(data, 'base64'));
      }
    }
  } finally {
    cdp.close();
    await sleep(300);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try { fs.rmSync(profile, {recursive: true, force: true}); break; } catch { await sleep(150); }
    }
  }
}

const browser = browserPath();
const workDir = fs.mkdtempSync(path.join(ROOT, 'scripts/.scam-double-check-'));
const server = startServer();
const records = [];
try {
  const origin = `http://127.0.0.1:${await serverPort(server)}`;
  for (const viewport of VIEWPORTS) for (const theme of THEMES) await runViewport(browser, origin, workDir, viewport, theme, records);
} finally {
  server.kill('SIGTERM');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(workDir, {recursive: true, force: true}); break; } catch { await sleep(150); }
  }
}

const officialHost = /(?:^|\.)(?:go|or)\.kr$/u;
for (const item of records) {
  const where = `${item.viewport} ${item.theme} ${item.payload}`;
  console.log(`  ${where.padEnd(42)} check=${item.checkStatus || '-'} links=${item.links.length} stats=${item.statsPresent ? (item.statsOpen ? 'open' : 'folded') : 'none'} overflow=${item.overflow}/${item.dialogOverflow} dt=${item.termStyle} contrast=${JSON.stringify(item.contrast)}`);
  assert.ok(item.overflow <= 1 && item.dialogOverflow <= 1, `${where}: no sideways overflow`);
  for (const link of item.links) {
    const url = new URL(link.href);
    if (link.href.startsWith('https://account.lotbiai.com/')) continue;
    assert.equal(url.protocol, 'https:', `${where}: ${link.href}`);
    assert.match(url.hostname, officialHost, `${where}: only government pages become links (${link.href})`);
    assert.equal(link.target, '_blank');
    assert.match(link.rel, /noopener/u);
    assert.match(link.rel, /noreferrer/u);
  }
  if (item.payload === 'FULL' || item.payload === 'STATS_NOT_BACKGROUND') {
    assert.equal(item.summary, FULL.summary, `${where}: summary sentence`);
    assert.equal(item.checkStatus, 'COMPLETED');
    assert.deepEqual(item.checkTerms, ['위험 신호', '공식 근거', '확인 안 된 것'], `${where}: three short lines`);
    assert.match(item.checkValues[0], /기관 사칭, 안전계좌 이체 요구/u);
    assert.doesNotMatch(item.checkValues[0], /송금·결제 요구/u, 'first-pass-only rows are not listed as re-confirmed');
    const order = ['결론', '2단계 확인 결과', '지금 하실 일'];
    assert.deepEqual(item.headings.slice(0, 3), order, `${where}: 2단계 확인 결과 sits right under 결론`);
    assert.ok(item.headings.includes('공식 근거') && item.headings.includes('피해가 생겼다면') && item.headings.includes('번호·계좌를 직접 조회할 수 있는 공식 서비스'), `${where}: ${item.headings}`);
    assert.ok(item.sourceTexts.some(text => text.includes('위조된 출처')), `${where}: forged source still shown as plain text`);
    assert.ok(!item.links.some(link => link.href.includes('example') || link.href.startsWith('http:')), `${where}: forged/http source never linked`);
    assert.ok(item.sourceTexts.some(text => text.includes('오래된 자료')), `${where}: stale source labelled`);
    for (const key of ['summary', 'term', 'value', 'sourceName', 'sourceMeta', 'link']) {
      assert.ok(item.contrast[key] >= 4.5, `${where}: ${key} contrast ${item.contrast[key]} below WCAG AA`);
    }
  }
  if (item.payload === 'FULL') {
    assert.ok(item.statsPresent && !item.statsOpen, `${where}: police statistics present and folded`);
    assert.match(item.statsText, /2025년 전국 기관사칭형: 발생 13,323건 · 피해액 9,884억원 · 검거 15,161명/u);
    assert.match(item.statsText, /경찰청이 확인했다는 뜻이 아니고/u);
  }
  if (item.payload === 'STATS_NOT_BACKGROUND') assert.equal(item.statsPresent, false, `${where}: statistics that could move the risk are not shown`);
  if (item.payload === 'OLD') {
    assert.equal(item.checkStatus, '', `${where}: older Core answer has no 2단계 section`);
    assert.equal(item.summary, '');
    assert.ok(item.headings.includes('지금 하실 일'), `${where}: older answer still renders`);
    assert.equal(item.statsPresent, false);
  }
  if (item.payload === 'FAILED') {
    assert.equal(item.checkStatus, 'FAILED');
    assert.match(item.checkValues.join(' '), /2단계 확인을 끝내지 못했어요/u);
  }
}
assert.equal(records.length, VIEWPORTS.length * THEMES.length * Object.keys(PAYLOADS).length);
console.log(`SCAM-SHIELD-DOUBLE-CHECK-P0 PASS — ${records.length} renders (4 Core answers × light/dark × 390/1280), real site-core normalization, WCAG AA; viewport emulation, not a device run`);
