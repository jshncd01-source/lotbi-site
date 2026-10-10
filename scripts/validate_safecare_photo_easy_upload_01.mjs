#!/usr/bin/env node
// SAFECARE-PHOTO-EASY-UPLOAD-01 — 사람 안심케어 1차 (owner decision 2026-10-10).
//
// A. photo step: the ten tiles are examples; '사진 여러 장 선택' is the only way
//    in; a tile offers '이 칸 다시 고르기' only after a batch could not fill it
//    (pure rule personRetrySlots; the screen itself is covered in
//    validate_safecare_photo_bulk_upload_01.mjs);
// B. 실종 전환 and 사람 발견 제보 start with 112 / 182 call buttons, and their
//    copy says what happens today (administrator intake; no promise of an
//    automatic photo comparison, which is not switched on);
// C. '실종 종료' asks once more before it closes the case (Core withdraws the
//    matching consent on close, it cannot be undone).
//
//   CHROME_BIN="C:/Program Files/Google/Chrome/Application/chrome.exe" node scripts/validate_safecare_photo_easy_upload_01.mjs
import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');

// ------------------------------------------------------------------ A. rules
const bulk = await import(pathToFileURL(path.join(ROOT, 'site-person-bulk-photos.js')).href);
const person = await import(pathToFileURL(path.join(ROOT, 'site-person.js')).href);
const retry = (filled, attention) => [...bulk.personRetrySlots(new Set(filled), attention)].sort((a, b) => a - b);
assert.deepEqual(retry([], {}), [], 'a new registration offers no tile picker before its first batch');
assert.deepEqual(retry([], {ran: true}), [1], 'after a batch without a front only 정면 얼굴 offers a picker');
assert.deepEqual(retry([], {ran: true, failed: [8]}), [1], 'a refused non-front photo waits for the front');
assert.deepEqual(retry([1, 2, 6], {}), [3, 4, 5, 7, 8, 9, 10], 'a resumed registration offers the empty tiles');
assert.deepEqual(retry([1, 2, 6], {ran: true, running: true}), [], 'no tile picker while a batch runs');
assert.deepEqual(retry([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], {ran: true, failed: [4]}), [4], 'a stored tile whose new photo was refused offers 사진 바꾸기');
assert.deepEqual(retry([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], {ran: true}), [], 'a complete set offers no tile picker');
assert.deepEqual([...bulk.personRetrySlots(new Map([[1, {}], [3, {}]]), {})].sort((a, b) => a - b), [2, 4, 5, 6, 7, 8, 9, 10], 'a Map of stored photos (the photo step passes one) works too');

// Copy says what happens today.
for (const text of [person.PERSON_SOS_FORM_NOTE, person.PERSON_SOS_ACTIVE_NOTE, person.PERSON_FOUND_FORM_NOTE]) {
  assert.ok(!/비교합니다|후보를 찾고|비교하고/.test(text), `no promise of an automatic comparison: ${text}`);
  assert.ok(text.includes('관리자'), `the administrator intake is named: ${text}`);
}
assert.ok(person.PERSON_SOS_EMERGENCY_TEXT.includes('경찰 신고가 아닙니다') && person.PERSON_SOS_EMERGENCY_TEXT.includes('112'));
assert.ok(person.PERSON_FOUND_EMERGENCY_TEXT.includes('112'));

// Sources: no per-tile lock sentence, no comparison promise on the pet screens either.
const ui = read('site-person-ui.js');
const petUi = read('site-pet-ui.js');
assert.ok(!ui.includes('정면 얼굴을 먼저 등록하면 선택할 수 있습니다.'), 'the per-tile lock sentence is gone');
assert.ok(!ui.includes('safecareSlotLocked'), 'tiles are no longer locked, only offered a picker');
assert.ok(!/발견 제보와 비교합니다|사진 5장 이상을 받은 뒤 실종 상태로 등록되고/.test(ui + petUi), 'person and pet copy no longer promise a comparison');
console.log('SAFECARE-PHOTO-EASY-UPLOAD-01 rules PASS');

// ------------------------------------------------------------------ browser
const STYLESHEETS = [...read('index.html').matchAll(/<link rel="stylesheet" href="([^"?]+)(?:\?[^"]*)?"/g)].map(match => match[1]);
function chromePath() {
  const candidates = [
    process.env.CHROME_BIN,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ].filter(Boolean);
  for (const candidate of candidates) if (fs.existsSync(candidate)) return candidate;
  for (const name of ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser']) {
    const found = spawnSync('which', [name], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required (set CHROME_BIN).');
}

const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2'};
const FIXTURE = `.safecare-photo-easy-upload-${process.pid}.html`;
const FIXTURE_HTML = String.raw`<!doctype html><html lang="ko"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${STYLESHEETS.map(href => `<link rel="stylesheet" href="/${href}" />`).join('\n')}
<style>*,*::before,*::after{transition:none!important;animation:none!important}</style>
<script>
  const P = n => 'aaaaaaaa-0000-4000-8000-00000000000' + n;
  const row = (n, name, count, state, extra = {}) => ({
    person_id: P(n), display_name: name, nickname: '', relationship: 'CHILD', birth_year: 2016, birthday_month: 8, revision: 1,
    has_photo: count === 10, identity_photo_count: count, identity_photo_state: state,
    identity_photo_expires_at: extra.expires || null, identity_photo_days_remaining: extra.days ?? null,
    identity_photo_renewal_reminder_days: null, identity_photo_validity_days: extra.validity ?? null,
  });
  const sosRow = (status) => ({sos_id: 'hsos_1', person_id: P(1), display_name: '김하늘', status, last_seen_at: '2026-10-05T01:30:00Z', last_seen_summary: '망원한강공원 입구', description: '노란 우비', matching_scope: 'ACTIVE_SOS_ONLY', automatic_identity_decision: false});
  globalThis.__state = {
    people: [
      row(1, '김하늘', 10, 'CURRENT', {expires: '2027-03-01T00:00:00Z', days: 147, validity: 180}),
      row(4, '최민준', 10, 'CURRENT', {expires: '2027-08-01T00:00:00Z', days: 290, validity: 365}),
    ],
    sos: [sosRow('ACTIVE')],
    calls: [],
  };
  const S = globalThis.__state;
  const personOf = id => S.people.find(item => item.person_id === id);
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  const png = () => new Response(Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0)), {status: 200, headers: {'Content-Type': 'image/png'}});
  globalThis.fetch = async (url, init = {}) => {
    const target = String(url).replace(/^https?:\/\/[^/]+/, '');
    const method = init.method || 'GET';
    S.calls.push(method + ' ' + target);
    let m;
    if (/\/content$/.test(target)) return png();
    if (target === '/v2/person-profiles' && method === 'GET') return json({people: S.people});
    if ((m = target.match(/^\/v2\/person-profiles\/([^/?]+)\/identity-photos$/))) {
      const count = personOf(m[1])?.identity_photo_count || 0;
      return json({photos: Array.from({length: count}, (_, i) => ({slot_index: i + 1, slot_code: 'S' + (i + 1), revision: 1, width: 640, height: 640, updated_at: '2026-09-01T00:00:00Z'}))});
    }
    if ((m = target.match(/^\/v2\/person-profiles\/([^/?]+)$/))) return json({person: personOf(m[1])});
    if (target.startsWith('/v2/person-sos?status=ACTIVE')) return json({items: S.sos});
    if (target === '/v2/person-sos/hsos_1/close' && method === 'PUT') { S.sos = []; return json({sos: sosRow('CLOSED')}); }
    if (target === '/v2/person-sos/notices/candidates') return json({notices: []});
    if (target === '/v2/safecare/human-sightings') return json({reports: []});
    return json({}, 404);
  };
</script>
</head><body><div id="host"></div>
<script type="module">
  import {mountPersonCareManager} from '/site-person-ui.js';
  const host = document.getElementById('host');
  globalThis.__wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  globalThis.__until = async (check, ms = 4000) => { for (let t = 0; t < ms && !check(); t += 50) await __wait(50); return check(); };
  globalThis.__mount = async (initialSurface = 'home') => { host.replaceChildren(); await mountPersonCareManager({sessionToken: 'fixture-token', root: host, initialSurface}); };
  globalThis.__overflow = () => document.documentElement.scrollWidth - document.documentElement.clientWidth;
  globalThis.__emergency = scope => {
    const box = scope.querySelector('[data-safecare-emergency]');
    if (!box) return null;
    const links = [...box.querySelectorAll('a[data-safecare-emergency-call]')];
    const firstField = scope.querySelector('input, textarea, select');
    return {
      text: box.querySelector('.safecare-emergency-text')?.textContent || '',
      links: links.map(link => [link.getAttribute('href'), link.textContent]),
      minHeight: Math.min(...links.map(link => link.getBoundingClientRect().height)),
      beforeFields: !firstField || Boolean(box.compareDocumentPosition(firstField) & Node.DOCUMENT_POSITION_FOLLOWING),
      visible: box.getBoundingClientRect().height > 0,
    };
  };
  globalThis.__ready = true;
</script></body></html>`;

class Cdp {
  constructor(socket) {
    this.socket = socket; this.id = 0; this.pending = new Map();
    socket.addEventListener('message', event => {
      const data = JSON.parse(event.data);
      if (!data.id || !this.pending.has(data.id)) return;
      const {resolve, reject} = this.pending.get(data.id); this.pending.delete(data.id);
      if (data.error) reject(new Error(JSON.stringify(data.error))); else resolve(data.result);
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.socket.send(JSON.stringify({id, method, params}));
    return new Promise((resolve, reject) => this.pending.set(id, {resolve, reject}));
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {expression: `(async () => { ${expression} })()`, awaitPromise: true, returnByValue: true});
    if (result.exceptionDetails) throw new Error(`page error: ${result.exceptionDetails.exception?.description || result.exceptionDetails.text}`);
    return result.result.value;
  }
}
function serve() {
  const server = http.createServer((request, response) => {
    const rel = decodeURIComponent(request.url.split('?')[0]).replace(/^\/+/, '');
    if (rel === FIXTURE) { response.writeHead(200, {'Content-Type': MIME['.html']}); response.end(FIXTURE_HTML); return; }
    const file = path.resolve(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404).end(); return; }
    response.writeHead(200, {'Content-Type': MIME[path.extname(file)] || 'application/octet-stream'});
    fs.createReadStream(file).pipe(response);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const SCENARIO = String.raw`
  const r = {};
  const P = n => 'aaaaaaaa-0000-4000-8000-00000000000' + n;
  // B1. 실종 상태로 전환: call buttons first, copy that matches what happens.
  await __mount(); await __until(() => document.querySelector('[data-person-list]'));
  document.querySelector('[data-person-sos-open="' + P(4) + '"]').click();
  await __until(() => document.querySelector('[data-person-sos-form]'));
  const form = document.querySelector('[data-person-sos-form]');
  r.sos = {emergency: __emergency(form), text: form.textContent, overflow: __overflow()};
  // B2. 사람 발견 제보.
  await __mount('sighting'); await __until(() => document.querySelector('[data-person-found-composer]'));
  const found = document.querySelector('[data-person-found-composer]');
  r.found = {emergency: __emergency(found), text: found.textContent, overflow: __overflow()};
  // C. 실종 종료 asks first.
  await __mount(); await __until(() => document.querySelector('[data-person-active-sos]'));
  const active = document.querySelector('[data-person-active-sos]');
  r.activeNote = active.querySelector('.safecare-sos-active-note')?.textContent || '';
  const closes = () => __state.calls.filter(call => call.endsWith('/close')).length;
  document.querySelector('[data-person-sos-close]').click();
  await __until(() => document.querySelector('[data-person-sos-close-confirm]'));
  const sheet = document.querySelector('[data-person-sos-close-confirm]');
  r.sheet = {title: sheet.querySelector('.person-cancel-title')?.textContent || '', lead: sheet.querySelector('.person-cancel-lead')?.textContent || '', closesBefore: closes()};
  document.querySelector('[data-person-sos-close-keep]').click();
  await __until(() => !document.querySelector('[data-person-sos-close-confirm]'));
  r.kept = {sheetGone: !document.querySelector('[data-person-sos-close-confirm]'), closes: closes(), stillActive: Boolean(document.querySelector('[data-person-active-sos]'))};
  document.querySelector('[data-person-sos-close]').click();
  await __until(() => document.querySelector('[data-person-sos-close-confirm-button]'));
  document.querySelector('[data-person-sos-close-confirm-button]').click();
  await __until(() => closes() === 1 && !document.querySelector('[data-person-active-sos]'));
  await __wait(100);
  r.closed = {closes: closes(), stillActive: Boolean(document.querySelector('[data-person-active-sos]')), status: document.querySelector('.person-status')?.textContent || ''};
  return r;
`;

const VIEWPORTS = [['mobile-360', 360, 780, true], ['desktop-1280', 1280, 900, false]];
const server = await serve();
const profileDir = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'lotbi-safecare-easy-upload-'));
const browser = spawn(chromePath(), ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--remote-debugging-port=0', `--user-data-dir=${profileDir}`, 'about:blank'], {stdio: 'ignore'});
try {
  const portFile = path.join(profileDir, 'DevToolsActivePort');
  for (let t = 0; t < 200 && !fs.existsSync(portFile); t += 1) await new Promise(resolve => setTimeout(resolve, 100));
  const debugPort = fs.readFileSync(portFile, 'utf8').split(/\r?\n/)[0];
  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  const socket = new WebSocket(targets.find(item => item.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', reject); });
  const cdp = new Cdp(socket);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  for (const [label, width, height, mobile] of VIEWPORTS) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile});
    await cdp.send('Page.navigate', {url: `http://127.0.0.1:${server.address().port}/${FIXTURE}`});
    for (let t = 0; t < 100; t += 1) {
      if (await cdp.evaluate('return globalThis.__ready === true;').catch(() => false)) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const r = await cdp.evaluate(SCENARIO);
    const calls = [['tel:112', '112 경찰 신고'], ['tel:182', '182 실종 신고']];
    for (const [where, screen, text, note] of [
      [`${label} 실종 전환`, r.sos, person.PERSON_SOS_EMERGENCY_TEXT, person.PERSON_SOS_FORM_NOTE],
      [`${label} 발견 제보`, r.found, person.PERSON_FOUND_EMERGENCY_TEXT, person.PERSON_FOUND_FORM_NOTE],
    ]) {
      assert.ok(screen.emergency, `${where}: the 112 / 182 notice is there`);
      assert.equal(screen.emergency.text, text, where);
      assert.deepEqual(screen.emergency.links, calls, `${where}: two call buttons`);
      assert.ok(screen.emergency.minHeight >= 44, `${where}: call buttons are at least 44px tall (${screen.emergency.minHeight})`);
      assert.equal(screen.emergency.beforeFields, true, `${where}: the call buttons come before the form fields`);
      assert.equal(screen.emergency.visible, true, where);
      assert.ok(screen.text.includes(note), `${where}: copy says what happens today`);
      assert.ok(!/발견 제보와 비교합니다|후보를 찾고/.test(screen.text), `${where}: no promise of an automatic comparison`);
      assert.ok(screen.overflow <= 1, `${where}: horizontal overflow ${screen.overflow}px`);
    }
    assert.equal(r.activeNote, person.PERSON_SOS_ACTIVE_NOTE, `${label}: the active case note says what happens today`);
    assert.equal(r.sheet.title, '실종 상태를 종료할까요?', label);
    assert.ok(r.sheet.lead.includes('되돌릴 수 없습니다'), label);
    assert.equal(r.sheet.closesBefore, 0, `${label}: nothing is closed before the second tap`);
    assert.deepEqual(r.kept, {sheetGone: true, closes: 0, stillActive: true}, `${label}: '계속 유지' keeps the case`);
    assert.equal(r.closed.closes, 1, `${label}: the confirmation closes the case once`);
    assert.equal(r.closed.stillActive, false, label);
    assert.match(r.closed.status, /실종 상태를 종료했습니다/, label);
    console.log(`  ${label}: 112/182 first, copy, close confirmation PASS`);
  }
} finally {
  browser.kill();
  server.close();
}
console.log('SAFECARE-PHOTO-EASY-UPLOAD-01 SITE PASS');
