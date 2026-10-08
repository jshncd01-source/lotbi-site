#!/usr/bin/env node
// SAFECARE-HUMAN-PROFILE-SLOT-ACCEPTANCE-01 — slots 4/5 (left/right side face).
//
// A guardian retook slot 4 about twenty times and always read the same
// "얼굴을 충분히 확인하기 어렵습니다" sentence. Core now accepts realistic side
// photos; the Site must (A) describe the slot as a strong side turn rather than
// an exact 90 degrees, (B) answer every refusal with what to change, per slot,
// and (C) show that sentence inside the tile at phone widths.
//
//   CHROME_BIN="C:/Program Files/Google/Chrome/Application/chrome.exe" node scripts/validate_safecare_profile_slot_acceptance_01.mjs
import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const client = await import(pathToFileURL(path.join(ROOT, 'site-person.js')).href);
const {PERSON_IDENTITY_SLOTS} = await import(pathToFileURL(path.join(ROOT, 'site-person-guides.js')).href);

// ----------------------------------------------------------- A. slot contract
assert.deepEqual(PERSON_IDENTITY_SLOTS.map(slot => slot.code), [
  'FACE_FRONT', 'FACE_LEFT_45', 'FACE_RIGHT_45', 'FACE_LEFT_PROFILE', 'FACE_RIGHT_PROFILE',
  'UPPER_BODY_FRONT', 'FULL_BODY_FRONT', 'FACE_FRONT_ALT', 'FACE_LEFT_ALT', 'FACE_RIGHT_ALT',
], 'the ten-slot order is unchanged');
const slot = Object.fromEntries(PERSON_IDENTITY_SLOTS.map(item => [item.code, item]));
for (const [code, side] of [['FACE_LEFT_PROFILE', '왼쪽'], ['FACE_RIGHT_PROFILE', '오른쪽']]) {
  const item = slot[code];
  assert.equal(item.view, 'profile', code);
  assert.equal(item.direction, side === '왼쪽' ? 'left' : 'right', code);
  // LEFT/RIGHT = the way the face in the photo looks, as seen on the screen.
  assert.ok(item.hint.includes(`사진 속 얼굴이 화면 ${side}을 바라보도록`), code);
  assert.ok(item.hint.includes('옆으로 크게 돌려') && item.hint.includes('90도가 아니어도'), `${code}: a strong side turn, not an exact 90 degrees`);
  assert.ok(!item.hint.includes('완전히 옆으로'), code);
  assert.match(item.visible, /한쪽 눈/);
  assert.match(item.visible, /코끝과 입 옆선/);
  assert.match(item.visible, /귀나 귀 주변\(머리카락에 조금 가려져도 됨\)/);
  assert.match(item.visible, /턱선/);
  assert.ok(!/귀 전체/.test(item.visible), `${code}: long hair over the ear must not read as a wrong photo`);
}

// ---------------------------------------------------- B. reason-specific copy
const FALLBACK = '__fallback__';
const INTERNAL = [/score/i, /yaw/i, /confidence/i, /landmark/i, /model/i, /\bAI\b/, /\d+(\.\d+)?\s*%/, /모델/, /점수/, /신뢰도/, /PERSON_/, /YuNet|Haar|SFace/i];
const message = (code, item) => client.personIdentityPhotoErrorMessage({code: `PERSON_IDENTITY_PHOTO_${code}`, status: 422}, item, FALLBACK);
const REASONS = ['WRONG_POSE', 'NO_FACE', 'SUBJECT_TOO_SMALL', 'OCCLUDED', 'WRONG_FRAMING', 'IDENTITY_UNCLEAR', 'DIFFERENT_PERSON', 'TOO_BLURRY', 'MULTIPLE_FACES'];
const OLD_GENERIC = '얼굴을 충분히 확인하기 어렵습니다. 얼굴이 조금 더 잘 보이게 다시 촬영해 주세요.';
for (const code of ['FACE_LEFT_PROFILE', 'FACE_RIGHT_PROFILE']) {
  const sentences = REASONS.map(reason => message(reason, slot[code]));
  assert.equal(new Set(sentences).size, REASONS.length, `${code}: every refusal reads differently`);
  for (const sentence of sentences) {
    assert.notEqual(sentence, FALLBACK);
    assert.notEqual(sentence, OLD_GENERIC);
    for (const pattern of INTERNAL) assert.ok(!pattern.test(sentence), `${code}: "${sentence}" exposes ${pattern}`);
  }
}
const leftPose = message('WRONG_POSE', slot.FACE_LEFT_PROFILE);
assert.match(leftPose, /고개를 조금 더 옆으로 돌려 주세요/);
assert.match(leftPose, /사진 속 얼굴이 화면 왼쪽을 바라봐야 합니다/);
assert.match(leftPose, /화면 오른쪽을 보면 '오른쪽 옆면' 칸/);
assert.match(leftPose, /'왼쪽 45도' 칸/);
const rightPose = message('WRONG_POSE', slot.FACE_RIGHT_PROFILE);
assert.match(rightPose, /사진 속 얼굴이 화면 오른쪽을 바라봐야 합니다/);
assert.match(rightPose, /화면 왼쪽을 보면 '왼쪽 옆면' 칸/);
assert.match(message('IDENTITY_UNCLEAR', slot.FACE_LEFT_PROFILE), /같은 사람인지 확인하기 어렵습니다\. 고개를 아주 조금만 덜 돌려/);
assert.ok(!/다른 사람/.test(message('IDENTITY_UNCLEAR', slot.FACE_LEFT_PROFILE)), 'unclear is not "someone else"');
assert.match(message('IDENTITY_UNCLEAR', slot.FACE_FRONT), /^같은 사람인지 확인하기 어렵습니다\. 얼굴이 선명하게 보이도록 다시 촬영해 주세요\.$/);
assert.match(message('OCCLUDED', slot.FACE_LEFT_PROFILE), /눈·코·입 옆선이 가리지 않게/);
assert.match(message('OCCLUDED', slot.FACE_LEFT_PROFILE), /머리카락이 귀를 조금 가리는 것은 괜찮습니다/);
assert.match(message('NO_FACE', slot.FACE_LEFT_PROFILE), /한쪽 눈과 코끝이 보이게/);
assert.match(message('NO_FACE', slot.FACE_FRONT), /얼굴이 화면에 충분히 보이게 조금 뒤에서 촬영해 주세요/);
assert.match(message('SUBJECT_TOO_SMALL', slot.FACE_LEFT_PROFILE), /얼굴이 조금 더 크게 보이게/);
assert.match(message('WRONG_FRAMING', slot.FACE_LEFT_PROFILE), /이마부터 턱까지/);
assert.match(message('DIFFERENT_PERSON', slot.FACE_LEFT_PROFILE), /다른 사람으로 보이는 사진입니다/);
console.log('SAFECARE-PROFILE-SLOT-ACCEPTANCE-01 copy PASS');

// --------------------------------------------------- C. in the tile, on phones
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
  throw new Error('Chrome/Chromium is required for the profile-slot render validation (set CHROME_BIN).');
}

const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml'};
const FIXTURE = `.safecare-profile-slot-${process.pid}.html`;
const FIXTURE_HTML = String.raw`<!doctype html><html lang="ko"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="stylesheet" href="/site-theme-tokens.css" />
<link rel="stylesheet" href="/site-conversation.css" />
<link rel="stylesheet" href="/site-person.css" />
<link rel="stylesheet" href="/site-safecare.css" />
<style>html,body{margin:0;background:var(--lotbi-bg-primary,#fff)}#host{box-sizing:border-box;max-width:960px;margin:0 auto;padding:16px}</style>
<script>
  const PERSON = 'aaaaaaaa-0000-4000-8000-000000000002';
  globalThis.__photoCount = 3;
  globalThis.__refuse = null;  // the Core reason code for the next slot 4/5 upload
  globalThis.__puts = [];
  const person = () => ({person_id: PERSON, display_name: '박영자', nickname: '', relationship: 'CHILD', birth_year: 2018, birthday_month: 5, revision: 1,
    has_photo: false, identity_photo_count: __photoCount, identity_photo_state: 'INCOMPLETE', identity_photo_expires_at: null,
    identity_photo_days_remaining: null, identity_photo_renewal_reminder_days: null, identity_photo_validity_days: null});
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  const png = () => new Response(Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0)), {status: 200, headers: {'Content-Type': 'image/png'}});
  globalThis.fetch = async (url, init = {}) => {
    const target = String(url).replace(/^https?:\/\/[^/]+/, '');
    const method = init.method || 'GET';
    let m;
    if (/\/content$/.test(target)) return png();
    if (target === '/v2/person-profiles' && method === 'GET') return json({people: [person()]});
    if ((m = target.match(/^\/v2\/person-profiles\/([^/]+)\/identity-photos$/))) {
      return json({photos: Array.from({length: __photoCount}, (_, i) => ({slot_index: i + 1, slot_code: 'S' + (i + 1), revision: 1, width: 640, height: 640, updated_at: '2026-09-01T00:00:00Z'}))});
    }
    if ((m = target.match(/^\/v2\/person-profiles\/([^/]+)\/identity-photos\/(\d+)$/)) && method === 'PUT') {
      const index = Number(m[2]);
      __puts.push(index);
      if (__refuse && index >= 4) return json({detail: {code: __refuse}}, 422);
      __photoCount = Math.max(__photoCount, index);
      return json({photo: {slot_index: index, slot_code: 'S' + index, revision: 2, width: 640, height: 640}});
    }
    if ((m = target.match(/^\/v2\/person-profiles\/([^/?]+)$/))) return json({person: person()});
    if (target.startsWith('/v2/person-sos?status=ACTIVE')) return json({items: []});
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
  globalThis.__mount = async () => { host.replaceChildren(); await mountPersonCareManager({sessionToken: 'fixture-token', root: host, initialSurface: 'home'}); };
  globalThis.__file = name => new Promise(resolve => {
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 640;
    const context = canvas.getContext('2d'); context.fillStyle = '#88aacc'; context.fillRect(0, 0, 640, 640);
    canvas.toBlob(blob => resolve(new File([blob], name, {type: 'image/png'})), 'image/png');
  });
  globalThis.__put = async (input, name) => {
    const transfer = new DataTransfer(); transfer.items.add(await __file(name));
    input.files = transfer.files; input.dispatchEvent(new Event('change', {bubbles: true}));
  };
  globalThis.__overflow = () => document.documentElement.scrollWidth - document.documentElement.clientWidth;
  globalThis.__ready = true;
</script></body></html>`;

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

const VIEWPORTS = [['mobile-360', 360, 780], ['mobile-375', 375, 812], ['mobile-390', 390, 844], ['mobile-412', 412, 915], ['desktop-1440', 1440, 900]];
const CASES = [
  ['FACE_LEFT_PROFILE', 'PERSON_IDENTITY_PHOTO_IDENTITY_UNCLEAR', /고개를 아주 조금만 덜 돌려/],
  ['FACE_LEFT_PROFILE', 'PERSON_IDENTITY_PHOTO_WRONG_POSE', /고개를 조금 더 옆으로 돌려 주세요/],
  ['FACE_RIGHT_PROFILE', 'PERSON_IDENTITY_PHOTO_OCCLUDED', /눈·코·입 옆선이 가리지 않게/],
];

const server = await serve();
const profileDir = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'lotbi-profile-slot-'));
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
  for (const [label, width, height] of VIEWPORTS) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: width < 768});
    for (const [code, reason, pattern] of CASES) {
      await cdp.send('Page.navigate', {url: `http://127.0.0.1:${server.address().port}/${FIXTURE}`});
      for (let t = 0; t < 100; t += 1) {
        if (await cdp.evaluate('return globalThis.__ready === true;').catch(() => false)) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      const r = await cdp.evaluate(`
        await __mount();
        await __until(() => document.querySelector('[data-person-photos]'));
        document.querySelector('[data-person-photos]').click();
        await __until(() => document.querySelector('[data-person-slot-grid]'));
        const tiles = () => [...document.querySelectorAll('[data-person-slot]')];
        const labels = tiles().map(tile => tile.querySelector('.safecare-slot-label').textContent);
        const tile = () => tiles().find(item => item.querySelector('[data-person-slot-input]').dataset.personSlotInput === ${JSON.stringify(code)});
        globalThis.__refuse = ${JSON.stringify(reason)};
        await __put(tile().querySelector('input[type=file]'), 'side.png');
        await __until(() => tile().querySelector('.safecare-slot-error') && !tile().querySelector('.safecare-slot-error').hidden);
        const error = tile().querySelector('.safecare-slot-error');
        const box = tile().getBoundingClientRect(), text = error.getBoundingClientRect();
        const result = {
          labels, text: error.textContent, hidden: error.hidden, overflow: __overflow(),
          inside: text.left >= box.left - 1 && text.right <= box.right + 1 && text.width > 0 && text.height > 0,
          errorWidth: Math.round(text.width), tileWidth: Math.round(box.width),
          stillEmpty: tile().dataset.safecareSlotFilled, count: document.querySelector('[data-safecare-photo-count]').textContent,
        };
        // A completed photo can still be replaced (slot 1 here) and keeps the set.
        globalThis.__refuse = null;
        const first = tiles()[0];
        result.replaceButton = first.querySelector('.safecare-slot-choose').textContent;
        await __put(first.querySelector('input[type=file]'), 'front-again.png');
        await __until(() => __puts.includes(1));
        await __wait(200);
        result.afterReplace = document.querySelector('[data-safecare-photo-count]').textContent;
        result.puts = [...__puts];
        return result;
      `);
      const where = `${label} ${code} ${reason}`;
      assert.deepEqual(r.labels.slice(3, 5), ['왼쪽 옆면', '오른쪽 옆면'], `${where}: slot 4/5 order`);
      assert.equal(r.hidden, false, `${where}: the reason is shown`);
      assert.match(r.text, pattern, where);
      assert.ok(r.inside, `${where}: the sentence stays inside its tile (${r.errorWidth}/${r.tileWidth}px)`);
      assert.ok(r.overflow <= 1, `${where}: horizontal overflow ${r.overflow}px`);
      assert.equal(r.stillEmpty, 'false', `${where}: a refused photo leaves the slot empty`);
      assert.equal(r.replaceButton, '다른 사진 선택', `${where}: a stored photo offers replacement`);
      assert.ok(r.puts.includes(1), `${where}: the replacement reached Core`);
      assert.equal(r.afterReplace, r.count, `${where}: replacing a stored photo keeps the count`);
    }
    console.log(`  ${label}: slot 4/5 reasons readable in the tile, no overflow`);
  }
} finally {
  browser.kill();
  server.close();
}
console.log('SAFECARE-PROFILE-SLOT-ACCEPTANCE-01 SITE PASS');
