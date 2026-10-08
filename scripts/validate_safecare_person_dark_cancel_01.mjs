#!/usr/bin/env node
// SAFECARE-PERSON-DARK-CANCEL-01 — 사람 안심케어: 다크모드 가독성, 등록 취소, 목록 상태.
//
// Found on an iPhone (KakaoTalk in-app browser, device dark mode): the person
// list cards and the registration form stayed white while the site's dark text
// tokens turned their text white/light grey. site-person.css used colour
// variables nothing defines (--color-surface, --site-surface, ...), so every
// card fell back to #fff in every theme.
//
// A. a real Chrome renders the SafeCare person screens with every Site
//    stylesheet in page order, in light / dark / system-dark, and measures the
//    contrast of every visible text against its painted background
//    (WCAG AA 4.5:1, large text and disabled controls 3:1);
// B. "등록 취소" on registration steps 1-3: keep and leave, delete an unfinished
//    registration after a separate confirmation, keep registering;
// C. the list separates 등록 완료 / 등록 중 / 사진 갱신 필요 and offers
//    "이어서 등록하기" for an unfinished registration.
//
//   CHROME_BIN="C:/Program Files/Google/Chrome/Application/chrome.exe" node scripts/validate_safecare_person_dark_cancel_01.mjs
//   (CONTRAST_REPORT=1 prints every low-contrast text instead of failing.)
import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_ONLY = process.env.CONTRAST_REPORT === '1';
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');

// Every stylesheet the real page loads, in the same order (cascade matters).
const STYLESHEETS = [...read('index.html').matchAll(/<link rel="stylesheet" href="([^"?]+)(?:\?[^"]*)?"/g)].map(match => match[1]);
assert.ok(STYLESHEETS.includes('site-person.css') && STYLESHEETS.includes('site-safecare.css') && STYLESHEETS.includes('site-theme-tokens.css'));

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
const FIXTURE = `.safecare-person-dark-cancel-${process.pid}.html`;
const FIXTURE_HTML = String.raw`<!doctype html><html lang="ko"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${STYLESHEETS.map(href => `<link rel="stylesheet" href="/${href}" />`).join('\n')}
<style>/* measure the settled screen, not a sheet halfway through its opening animation */*,*::before,*::after{transition:none!important;animation:none!important}</style>
<script>
  const params = new URLSearchParams(location.search);
  const theme = params.get('theme') || 'light';
  document.documentElement.dataset.siteThemeBootstrap = theme;
  const P = n => 'aaaaaaaa-0000-4000-8000-00000000000' + n;
  const row = (n, name, relationship, year, month, count, state, extra = {}) => ({
    person_id: P(n), display_name: name, nickname: '', relationship, birth_year: year, birthday_month: month, revision: 1,
    has_photo: count === 10, identity_photo_count: count, identity_photo_state: state,
    identity_photo_expires_at: extra.expires || null, identity_photo_days_remaining: extra.days ?? null,
    identity_photo_renewal_reminder_days: extra.reminder ?? null, identity_photo_validity_days: extra.validity ?? null,
  });
  globalThis.__state = {
    people: [
      row(1, '김하늘', 'CHILD', 2016, 8, 10, 'CURRENT', {expires: '2027-03-01T00:00:00Z', days: 147, validity: 180}),
      row(2, '박영자', 'PARENT', 1948, 3, 7, 'INCOMPLETE'),
      row(3, '이도윤', 'CHILD', 2019, 11, 10, 'EXPIRED', {expires: '2026-09-30T00:00:00Z', days: 0, validity: 180}),
      row(4, '최민준', 'FAMILY', 1985, 1, 10, 'EXPIRING', {expires: '2026-10-12T00:00:00Z', days: 7, reminder: 7, validity: 365}),
      row(5, '한지우', 'CHILD', 2018, 2, 5, 'INCOMPLETE'),
    ],
    sos: [{sos_id: 'hsos_1', person_id: P(1), display_name: '김하늘', status: 'ACTIVE', last_seen_at: '2026-10-05T01:30:00Z', last_seen_summary: '망원한강공원 입구', description: '노란 우비', matching_scope: 'ACTIVE_SOS_ONLY', automatic_identity_decision: false}],
    sosHistory: new Set([P(1), P(5)]),  // 한지우: a closed case, photos later removed
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
    if (target === '/v2/person-profiles' && method === 'POST') {
      const body = JSON.parse(init.body);
      const created = row(S.people.length + 6, body.display_name, body.relationship, body.birth_year, body.birthday_month, 0, 'INCOMPLETE');
      S.people.push(created);
      return json({person: created}, 201);
    }
    if ((m = target.match(/^\/v2\/person-profiles\/([^/?]+)\/identity-photos$/))) {
      const count = personOf(m[1])?.identity_photo_count || 0;
      return json({photos: Array.from({length: count}, (_, i) => ({slot_index: i + 1, slot_code: 'S' + (i + 1), revision: 1, width: 640, height: 640, updated_at: '2026-09-01T00:00:00Z'}))});
    }
    if ((m = target.match(/^\/v2\/person-profiles\/([^/?]+)\/identity-photos\/(\d+)$/)) && method === 'PUT') {
      const item = personOf(m[1]);
      item.identity_photo_count = Math.min(10, Math.max(item.identity_photo_count, Number(m[2])));
      item.has_photo = item.identity_photo_count === 10;
      if (item.has_photo) item.identity_photo_state = 'CURRENT';
      return json({photo: {slot_index: Number(m[2]), slot_code: 'S' + m[2], revision: 1, width: 640, height: 640}});
    }
    if ((m = target.match(/^\/v2\/person-profiles\/([^/?]+)\?(.*)$/)) && method === 'DELETE') {
      const item = personOf(m[1]);
      const query = new URLSearchParams(m[2]);
      if (!item) return new Response(null, {status: 204});
      if (query.get('registration_cancel') === '1' && (item.identity_photo_count >= 10 || S.sosHistory.has(item.person_id))) {
        return json({detail: {code: 'PERSON_REGISTRATION_CANCEL_NOT_ALLOWED'}}, 409);
      }
      S.people = S.people.filter(other => other !== item);
      return new Response(null, {status: 204});
    }
    if ((m = target.match(/^\/v2\/person-profiles\/([^/?]+)$/)) && method === 'PATCH') {
      const item = personOf(m[1]); const body = JSON.parse(init.body);
      Object.assign(item, {display_name: body.display_name, relationship: body.relationship, birth_year: body.birth_year, birthday_month: body.birthday_month, revision: item.revision + 1});
      return json({person: item});
    }
    if ((m = target.match(/^\/v2\/person-profiles\/([^/?]+)$/))) return json({person: personOf(m[1])});
    if (target.startsWith('/v2/person-sos?status=ACTIVE')) return json({items: S.sos});
    if (target === '/v2/person-sos/notices/candidates') return json({notices: []});
    if (target === '/v2/safecare/human-sightings') return json({reports: []});
    return json({}, 404);
  };
</script>
</head><body><div id="host"></div>
<script type="module">
  import {mountPersonCareManager} from '/site-person-ui.js';
  const host = document.getElementById('host');
  const params = new URLSearchParams(location.search);
  document.body.dataset.siteTheme = params.get('theme') || 'light';
  document.body.dataset.siteThemePreference = params.get('theme') || 'light';
  globalThis.__wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  globalThis.__until = async (check, ms = 4000) => { for (let t = 0; t < ms && !check(); t += 50) await __wait(50); return check(); };
  globalThis.__mount = async () => { host.replaceChildren(); await mountPersonCareManager({sessionToken: 'fixture-token', root: host, initialSurface: 'home'}); };
  globalThis.__button = (label, scope = document) => [...scope.querySelectorAll('button')].find(item => item.textContent.trim() === label && item.getClientRects().length);
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

  // ---- contrast audit: painted colours, not declared ones
  const pixel = document.createElement('canvas').getContext('2d', {willReadFrequently: true});
  const rgba = value => {
    pixel.clearRect(0, 0, 1, 1); pixel.fillStyle = 'rgba(0,0,0,0)'; pixel.fillStyle = value; pixel.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = pixel.getImageData(0, 0, 1, 1).data; return {r, g, b, a: a / 255};
  };
  const over = (top, bottom) => ({r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1});
  const COLOR_TOKEN = /(rgba?\([^)]*\)|color\([^)]*\)|oklab\([^)]*\)|oklch\([^)]*\)|#[0-9a-fA-F]{3,8}\b)/;
  const background = element => {
    const layers = [];
    for (let node = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      let colour = rgba(style.backgroundColor);
      if (style.backgroundImage && style.backgroundImage !== 'none') {
        const token = style.backgroundImage.match(COLOR_TOKEN);
        if (token) { const tint = rgba(token[1]); if (tint.a > colour.a) colour = tint; }
      }
      if (colour.a > 0) layers.push(colour);
      if (colour.a >= 0.999) break;
    }
    return layers.reverse().reduce((base, layer) => over(layer, base), {r: 255, g: 255, b: 255, a: 1});
  };
  const luminance = ({r, g, b}) => [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  globalThis.__audit = (scope = document.body) => {
    const failures = [];
    const elements = new Set();
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) { if (walker.currentNode.textContent.trim()) elements.add(walker.currentNode.parentElement); }
    scope.querySelectorAll('input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]), select, textarea').forEach(node => elements.add(node));
    for (const element of elements) {
      if (!element || !element.getClientRects().length || element.closest('script, style, [hidden], svg')) continue;
      const style = getComputedStyle(element);
      if (style.visibility === 'hidden') continue;
      let alpha = 1;
      for (let node = element; node; node = node.parentElement) alpha *= Number(getComputedStyle(node).opacity);
      if (alpha < 0.05) continue;
      const fg = rgba(style.color); fg.a *= alpha;
      const bg = background(element);
      const value = ratio(over(fg, bg), bg);
      const size = parseFloat(style.fontSize), weight = Number(style.fontWeight) || 400;
      const disabled = Boolean(element.closest('button:disabled, [aria-disabled="true"], input:disabled, select:disabled'));
      const need = disabled || size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
      if (value + 1e-6 < need) {
        failures.push({text: (element.value || element.textContent).trim().replace(/\s+/g, ' ').slice(0, 36), cls: String(element.className || element.tagName).slice(0, 60), ratio: Math.round(value * 100) / 100, need, disabled,
          fg: [fg.r, fg.g, fg.b].join(','), bg: [Math.round(bg.r), Math.round(bg.g), Math.round(bg.b)].join(',')});
      }
    }
    return failures;
  };
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

// Screens of the person flow, each returning its contrast failures.
const CONTRAST_SCREENS = String.raw`
  const out = {};
  await __mount();
  await __until(() => document.querySelector('[data-person-list]'));
  out.list = __audit();
  __button('사람 등록').click();
  await __until(() => document.querySelector('[data-person-basic-form]'));
  out.step1 = __audit();
  document.querySelector('[data-person-birth-trigger]').click();
  await __until(() => document.querySelector('[data-person-birth-picker]'));
  await __wait(150);
  out.birthPicker = __audit();
  document.querySelector('[data-person-birth-confirm]').click();
  await __wait(150);
  const form = document.querySelector('[data-person-basic-form]');
  const name = form.querySelector('input'); name.value = '정다은'; name.dispatchEvent(new Event('input', {bubbles: true}));
  form.querySelector('select').value = 'CHILD';
  form.requestSubmit();
  await __until(() => document.querySelector('[data-safecare-renewal-dialog]'));
  await __wait(150);
  out.renewalNotice = __audit();
  document.querySelectorAll('[data-safecare-renewal-dialog] input[type=checkbox]').forEach(box => { if (!box.checked) box.click(); });
  document.querySelector('[data-safecare-renewal-confirm]').click();
  await __until(() => document.querySelector('[data-person-slot-grid]'));
  out.step2 = __audit();
  const tiles = () => [...document.querySelectorAll('[data-person-slot]')];
  for (let index = 0; index < 10; index += 1) {
    await __put(tiles()[index].querySelector('input[type=file]'), 'slot' + (index + 1) + '.png');
    await __until(() => document.querySelector('[data-safecare-photo-count]')?.dataset.safecarePhotoCount === String(index + 1));
  }
  document.querySelector('[data-person-photos-next]').click();
  await __until(() => document.querySelector('[data-person-finish]'));
  out.step3 = __audit();
  document.querySelector('[data-person-registration-cancel]').click();
  await __until(() => document.querySelector('[data-person-cancel-sheet]'));
  await __wait(150);
  out.cancelSheetComplete = __audit();
  document.querySelector('[data-person-cancel-continue]').click();
  await __wait(150);
  await __mount();
  await __until(() => document.querySelector('[data-person-list]'));
  document.querySelector('[data-person-resume="aaaaaaaa-0000-4000-8000-000000000002"]').click();
  await __until(() => document.querySelector('[data-person-slot-grid]'));
  document.querySelector('[data-person-registration-cancel]').click();
  await __until(() => document.querySelector('[data-person-cancel-sheet]'));
  await __wait(150);
  out.cancelSheet = __audit();
  document.querySelector('[data-person-cancel-delete]').click();
  await __until(() => document.querySelector('[data-person-delete-confirm]'));
  await __wait(150);
  out.deleteConfirm = __audit();
  __button('돌아가기').click();
  await __until(() => document.querySelector('[data-person-cancel-continue]'));
  document.querySelector('[data-person-cancel-continue]').click();
  await __wait(150);
  await __mount();
  await __until(() => document.querySelector('[data-person-list]'));
  [...document.querySelectorAll('[data-person-card]')].find(card => card.textContent.includes('김하늘')).querySelector('.person-text-button').click();
  await __until(() => document.querySelector('[data-person-basic-form]'));
  __button('등록 삭제')?.click();
  await __wait(100);
  out.edit = __audit();
  await __mount();
  await __until(() => document.querySelector('[data-person-list]'));
  [...document.querySelectorAll('[data-person-card]')].find(card => card.textContent.includes('이도윤')).querySelector('[data-person-sos-open]')?.click();
  await __until(() => document.querySelector('[data-person-sos-form]'));
  out.sosBlocked = __audit();
  out.overflow = __overflow();
  return out;
`;

// Registration cancel / resume / list status, through the real screen.
const FLOW = String.raw`
  const r = {};
  const P = n => 'aaaaaaaa-0000-4000-8000-00000000000' + n;
  const cards = () => Object.fromEntries([...document.querySelectorAll('[data-person-card]')].map(card => [card.querySelector('.person-card-name').textContent, {
    group: card.closest('[data-person-group]')?.dataset.personGroup || 'none', registration: card.dataset.personRegistration,
    badge: card.querySelector('[data-person-renewal-state]').textContent, resume: card.querySelector('[data-person-resume]')?.textContent || '',
    photos: card.querySelector('[data-person-photos]')?.textContent || '', sos: Boolean(card.querySelector('[data-person-sos-open]')),
  }]));
  const list = async () => { await __until(() => document.querySelector('[data-person-list]')); await __wait(50); };
  const count = () => document.querySelector('[data-safecare-photo-count]')?.dataset.safecarePhotoCount;
  const tiles = () => [...document.querySelectorAll('[data-person-slot]')];
  const upload = async (from, to) => { for (let i = from; i < to; i += 1) { await __put(tiles()[i].querySelector('input[type=file]'), 's' + i + '.png'); await __until(() => count() === String(i + 1)); } };
  const openCancel = async () => { document.querySelector('[data-person-registration-cancel]').click(); await __until(() => document.querySelector('[data-person-cancel-sheet]')); await __wait(80); };
  const sheet = () => document.querySelector('[data-person-cancel-sheet]');
  const deletes = () => __state.calls.filter(call => call.startsWith('DELETE '));
  const register = async name => {
    __button('사람 등록').click(); await __until(() => document.querySelector('[data-person-basic-form]'));
    document.querySelector('[data-person-birth-trigger]').click(); await __until(() => document.querySelector('[data-person-birth-confirm]'));
    document.querySelector('[data-person-birth-confirm]').click(); await __wait(80);
    const form = document.querySelector('[data-person-basic-form]');
    form.querySelector('input').value = name; form.requestSubmit();
    await __until(() => document.querySelector('[data-safecare-renewal-confirm]'));
    document.querySelectorAll('[data-safecare-renewal-dialog] input[type=checkbox]').forEach(box => { if (!box.checked) box.click(); });
    document.querySelector('[data-safecare-renewal-confirm]').click();
    await __until(() => document.querySelector('[data-person-slot-grid]'));
    return __state.people.find(item => item.display_name === name).person_id;
  };

  await __mount(); await list();
  r.heading = document.querySelector('.person-title').textContent;
  r.groups = [...document.querySelectorAll('[data-person-group]')].map(group => group.querySelector('.person-group-title').textContent);
  r.cards = cards();

  // Step 1, nothing created yet: 등록 취소 just closes the screen.
  __button('사람 등록').click(); await __until(() => document.querySelector('[data-person-basic-form]'));
  r.step1Cancel = Boolean(document.querySelector('[data-person-registration-cancel]'));
  const callsBefore = __state.calls.length;
  document.querySelector('[data-person-registration-cancel]').click(); await list();
  r.step1Closed = {list: Boolean(document.querySelector('[data-person-list]')), sheet: Boolean(sheet()), writes: __state.calls.slice(callsBefore).filter(call => !call.startsWith('GET ')).length};

  // New registration: step 1 → step 2, three photos.
  const created = await register('정다은');
  await upload(0, 3);
  await openCancel();
  r.step2Sheet = {text: sheet().textContent, deleteEnabled: !document.querySelector('[data-person-cancel-delete]').disabled};
  // C. 계속 등록하기 keeps the step and its photos.
  document.querySelector('[data-person-cancel-continue]').click(); await __wait(150);
  r.continue = {sheet: Boolean(sheet()), grid: Boolean(document.querySelector('[data-person-slot-grid]')), count: count()};
  // A. 임시 저장하고 나가기.
  await openCancel();
  document.querySelector('[data-person-cancel-keep]').click(); await list();
  r.kept = {status: document.querySelector('.person-status').textContent, card: cards()['정다은'], deletes: deletes().length};
  // Resume at the same step, take it to 7/10, leave again, resume again.
  document.querySelector('[data-person-resume="' + created + '"]').click();
  await __until(() => document.querySelector('[data-person-slot-grid]'));
  r.resume1 = {count: count(), step: document.querySelector('.safecare-step[aria-current=step] .safecare-step-name')?.textContent};
  await upload(3, 7);
  await openCancel(); document.querySelector('[data-person-cancel-keep]').click(); await list();
  r.at7 = cards()['정다은'];
  document.querySelector('[data-person-resume="' + created + '"]').click();
  await __until(() => document.querySelector('[data-person-slot-grid]'));
  r.resume7 = {count: count(), step: document.querySelector('.safecare-step[aria-current=step] .safecare-step-name')?.textContent};

  // Step 1 revisited after the person exists (이전): the sheet, with the unsaved-edit note.
  __button('이전').click(); await __until(() => document.querySelector('[data-person-basic-form]'));
  await openCancel();
  r.step1Existing = {sheet: Boolean(sheet()), note: sheet().textContent.includes('저장하지 않은 수정 내용')};
  document.querySelector('[data-person-cancel-continue]').click(); await __wait(150);
  await __mount(); await list();
  document.querySelector('[data-person-resume="' + created + '"]').click();
  await __until(() => document.querySelector('[data-person-slot-grid]'));

  // B. 등록 취소하고 삭제, with its own confirmation.
  await openCancel();
  document.querySelector('[data-person-cancel-delete]').click();
  await __until(() => document.querySelector('[data-person-delete-confirm]'));
  const confirmBox = document.querySelector('[data-person-delete-confirm]');
  r.confirmText = confirmBox.textContent;
  r.deletesBeforeConfirm = deletes().length;
  confirmBox.querySelector('[data-person-delete-confirm-button]').click();
  await list();
  r.deleted = {call: deletes().at(-1) || '', status: document.querySelector('.person-status').textContent, stillListed: Boolean(cards()['정다은'])};

  // Step 3 (all ten photos): kept and leaves, never deletes.
  await register('오세린');
  await upload(0, 10);
  document.querySelector('[data-person-photos-next]').click(); await __until(() => document.querySelector('[data-person-finish]'));
  await openCancel();
  r.step3 = {deleteEnabled: !document.querySelector('[data-person-cancel-delete]').disabled, text: sheet().textContent};
  document.querySelector('[data-person-cancel-keep]').click(); await list();
  r.step3Kept = cards()['오세린'];

  // Core refuses an unfinished registration that once had a missing case.
  document.querySelector('[data-person-resume="' + P(5) + '"]').click();
  await __until(() => document.querySelector('[data-person-slot-grid]'));
  await openCancel();
  document.querySelector('[data-person-cancel-delete]').click();
  await __until(() => document.querySelector('[data-person-delete-confirm]'));
  document.querySelector('[data-person-delete-confirm-button]').click();
  await __until(() => document.querySelector('[data-person-delete-confirm] .person-error') && !document.querySelector('[data-person-delete-confirm] .person-error').hidden);
  r.refused = {error: document.querySelector('[data-person-delete-confirm] .person-error').textContent, kept: __state.people.some(item => item.person_id === P(5))};

  // Edit and photo management are not a new registration: no 등록 취소.
  await __mount(); await list();
  [...document.querySelectorAll('[data-person-card]')].find(card => card.textContent.includes('김하늘')).querySelector('.person-text-button').click();
  await __until(() => document.querySelector('[data-person-basic-form]'));
  r.edit = {cancel: Boolean(document.querySelector('[data-person-registration-cancel]')), back: Boolean(__button('← 목록으로'))};
  await __mount(); await list();
  document.querySelector('[data-person-photos="' + P(1) + '"]').click();
  await __until(() => document.querySelector('[data-person-slot-grid]'));
  r.manage = {cancel: Boolean(document.querySelector('[data-person-registration-cancel]')), back: Boolean(__button('← 목록으로'))};
  r.finalPeople = __state.people.map(item => item.display_name);
  r.overflow = __overflow();
  return r;
`;

function assertFlow(where, r) {
  assert.equal(r.heading, '등록된 사람 3', `${where}: only finished profiles count as 등록된 사람`);
  assert.deepEqual(r.groups, ['등록 중 2', '등록 완료 3'], where);
  for (const name of ['박영자', '한지우']) {
    assert.equal(r.cards[name].group, 'unfinished', `${where}: ${name}`);
    assert.match(r.cards[name].badge, /^등록 중 · 사진 \d+\/10$/, `${where}: ${name}`);
    assert.equal(r.cards[name].resume, '이어서 등록하기', `${where}: ${name}`);
    assert.equal(r.cards[name].sos, false, `${where}: an unfinished registration offers resuming, not a blocked SOS`);
  }
  assert.equal(r.cards['김하늘'].badge, '등록 완료', where);
  assert.equal(r.cards['이도윤'].badge, '사진 갱신 필요', where);
  assert.equal(r.cards['최민준'].badge, '갱신 예정 · 7일 남음', where);
  for (const name of ['김하늘', '이도윤', '최민준']) assert.equal(r.cards[name].group, 'finished', `${where}: ${name}`);
  assert.equal(r.step1Cancel, true, `${where}: step 1 shows 등록 취소`);
  assert.deepEqual(r.step1Closed, {list: true, sheet: false, writes: 0}, `${where}: nothing created → the screen just closes`);
  assert.ok(r.step2Sheet.text.includes('임시 저장하고 나가기') && r.step2Sheet.text.includes('등록 취소하고 삭제') && r.step2Sheet.text.includes('계속 등록하기'), where);
  assert.ok(r.step2Sheet.text.includes('식별 사진 3/10장'), `${where}: the sheet says what is saved`);
  assert.equal(r.step2Sheet.deleteEnabled, true, where);
  assert.deepEqual(r.continue, {sheet: false, grid: true, count: '3'}, `${where}: 계속 등록하기 keeps the step and photos`);
  assert.match(r.kept.status, /임시 저장했습니다/);
  assert.equal(r.kept.card.group, 'unfinished', where);
  assert.equal(r.kept.card.badge, '등록 중 · 사진 3/10', where);
  assert.equal(r.kept.deletes, 0, `${where}: keeping never deletes`);
  assert.deepEqual(r.resume1, {count: '3', step: '식별 사진 10장'}, `${where}: resumes at the same step`);
  assert.equal(r.at7.badge, '등록 중 · 사진 7/10', where);
  assert.deepEqual(r.resume7, {count: '7', step: '식별 사진 10장'}, `${where}: 7/10 saved and resumed`);
  assert.deepEqual(r.step1Existing, {sheet: true, note: true}, where);
  for (const part of ['정다은', '식별 사진 7장', '되돌릴 수 없습니다']) assert.ok(r.confirmText.includes(part), `${where}: confirmation shows ${part}`);
  assert.equal(r.deletesBeforeConfirm, 0, `${where}: nothing is deleted before the separate confirmation`);
  assert.match(r.deleted.call, /^DELETE \/v2\/person-profiles\/aaaaaaaa-[^?]+\?expected_revision=\d+&registration_cancel=1$/, where);
  assert.match(r.deleted.status, /등록을 취소하고 삭제했습니다/);
  assert.equal(r.deleted.stillListed, false, where);
  assert.equal(r.step3.deleteEnabled, false, `${where}: a registration with all ten photos is not deleted from 등록 취소`);
  assert.ok(r.step3.text.includes('여기서 삭제할 수 없습니다'), where);
  assert.equal(r.step3Kept.group, 'finished', where);
  assert.equal(r.step3Kept.badge, '등록 완료', where);
  assert.match(r.refused.error, /여기서 삭제할 수 없습니다/, `${where}: Core's refusal is explained`);
  assert.equal(r.refused.kept, true, `${where}: a person with a missing-person record is kept`);
  assert.deepEqual(r.edit, {cancel: false, back: true}, `${where}: 정보 수정 keeps the original registration`);
  assert.deepEqual(r.manage, {cancel: false, back: true}, `${where}: 사진 갱신·관리 keeps the original registration`);
  for (const name of ['김하늘', '박영자', '이도윤', '최민준', '한지우', '오세린']) assert.ok(r.finalPeople.includes(name), `${where}: ${name} kept`);
  assert.ok(!r.finalPeople.includes('정다은'), where);
  assert.ok(r.overflow <= 1, `${where}: overflow ${r.overflow}px`);
}

const THEMES = [['light', 'light', 'light'], ['dark', 'dark', 'dark'], ['system-dark', 'system', 'dark']];
const VIEWPORTS = [['mobile-390', 390, 844, true], ['desktop-1280', 1280, 900, false]];

const server = await serve();
const profileDir = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'lotbi-person-dark-'));
const browser = spawn(chromePath(), ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--remote-debugging-port=0', `--user-data-dir=${profileDir}`, 'about:blank'], {stdio: 'ignore'});
let cdp;
const open = async (theme, scheme) => {
  await cdp.send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: scheme}]});
  await cdp.send('Page.navigate', {url: `http://127.0.0.1:${server.address().port}/${FIXTURE}?theme=${theme}`});
  for (let t = 0; t < 100; t += 1) {
    if (await cdp.evaluate('return globalThis.__ready === true;').catch(() => false)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('fixture did not load');
};
const contrastFailures = [];
try {
  const portFile = path.join(profileDir, 'DevToolsActivePort');
  for (let t = 0; t < 200 && !fs.existsSync(portFile); t += 1) await new Promise(resolve => setTimeout(resolve, 100));
  const debugPort = fs.readFileSync(portFile, 'utf8').split(/\r?\n/)[0];
  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  const socket = new WebSocket(targets.find(item => item.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', reject); });
  cdp = new Cdp(socket);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  for (const [label, width, height, mobile] of VIEWPORTS) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile});
    for (const [themeLabel, theme, scheme] of THEMES) {
      await open(theme, scheme);
      const screens = await cdp.evaluate(CONTRAST_SCREENS);
      assert.ok(screens.overflow <= 1, `${label}/${themeLabel}: horizontal overflow ${screens.overflow}px`);
      for (const [screen, failures] of Object.entries(screens)) {
        if (!Array.isArray(failures)) continue;
        for (const failure of failures) contrastFailures.push({where: `${label}/${themeLabel}/${screen}`, ...failure});
      }
      console.log(`  ${label}/${themeLabel}: ${Object.entries(screens).filter(([, v]) => Array.isArray(v)).map(([k, v]) => `${k}=${v.length}`).join(' ')}`);
    }
  }
  for (const [label, width, height, mobile, themeLabel, theme, scheme] of [['mobile-360', 360, 780, true, 'dark', 'dark', 'dark'], ['mobile-412', 412, 915, true, 'system-dark', 'system', 'dark'], ['desktop-1280', 1280, 900, false, 'light', 'light', 'light']]) {
    if (REPORT_ONLY) break;
    await cdp.send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile});
    await open(theme, scheme);
    assertFlow(`${label}/${themeLabel}`, await cdp.evaluate(FLOW));
    console.log(`  ${label}/${themeLabel}: cancel · keep · resume 7/10 · delete · protection flow PASS`);
  }
} finally {
  browser.kill();
  server.close();
}
if (REPORT_ONLY) {
  const seen = new Map();
  for (const item of contrastFailures) {
    const key = `${item.where.split('/')[1]}|${item.cls}|${item.ratio}`;
    if (!seen.has(key)) seen.set(key, item);
  }
  for (const item of seen.values()) console.log(`  LOW ${item.where} ratio=${item.ratio}<${item.need} "${item.text}" .${item.cls} fg=${item.fg} bg=${item.bg}`);
  console.log(`CONTRAST_REPORT total=${contrastFailures.length} distinct=${seen.size}`);
  process.exit(0);
}
assert.deepEqual(contrastFailures, [], 'every SafeCare person text meets WCAG AA in light, dark and system-dark');
console.log('SAFECARE-PERSON-DARK-CANCEL-01 SITE PASS');
