// SITE-LIFE-DIRECT-CHAT-CARD-COMPACTION-01 (2026-10-07, re-merged on main
// 819ead3a 2026-10-09) — every 생활정보 question asks LOTBI in one tap without
// opening the keyboard, and a place card without a photo has no photo box.
//
// LIFE-MEDICAL-MERGE-01 (owner decision 2026-10-11): the 병원·응급실·약국 card no
// longer asks the conversation anything — it lists the nearest places in its own
// screen (validate_life_medical_list_01.mjs). The place-card answer this validator
// measures (photo / no-photo / broken-photo cards, phone and map actions, dark) is
// still what a typed "근처 병원 / 약국 / 응급실 찾아줘" gets, so those questions are
// typed into the composer here; the one-tap, no-keyboard contract (B, C, F) is
// measured on the cards that still ask — 지역생활정보 and 유치원·학교.
//
// Production (06270582), phone web: 생활정보 → 병원·의원 / 약국 / 지역생활정보 /
// 유치원·학교 → "질문 준비하기" put the question in the composer (and focused
// it, opening the keyboard); the person had to press send again. main now
// sends the medical and 지역생활정보 questions at once (onAsk →
// askWithoutKeyboard, LIFE-MEDICAL-AUTO-SEARCH-01); this branch makes 유치원·학교
// ask the same way, so no 생활정보 screen drafts any more.
//
// Measured in a real browser (DevTools protocol, real time) against the real
// index.html with a fake Core, at 320/360/390/412 (mobile) and 1280 (desktop):
//   A 병원·의원 / 약국 / 응급실: one tap sends the fixed "근처" question (with the
//     current location when location use is on); 지역생활정보 and 유치원·학교 →
//     학교: one tap on "롯비에게 물어보기" sends the built question. No second
//     tap, the composer is never focused and stays empty, 생활정보 closes.
//   B a fast double tap sends one message.
//   C history back/forward and a reload send nothing again and focus nothing.
//   D no image_url, or an image that fails, leaves no media box; the card is
//     short and nothing in it is cut off; a real photo still renders.
//   E phone action unchanged; the map action follows the map app chosen in
//     settings (cookie read by the existing helper), default unchanged.
//   F tapping the composer focuses it - only then.
//   G dark (다크 in settings): the same one-tap asks; the form buttons, their
//     notes and the photo-less cards' text keep readable contrast.
// This is a browser emulation, not an iPhone or Android device.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {LIFE_SHORTCUTS} from '../site-consumer-sections.js';
import {buildSchoolPrompt} from '../site-life-education.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8').replace(/\r\n/g, '\n');

// ── Static contract ─────────────────────────────────────────────────────
const conversation = read('site-conversation.js');
const sections = read('site-consumer-sections.js');
const education = read('site-life-education.js');
// One send path for every 생활정보 question: onAsk closes the surface without
// handing focus back to the composer, then asks without the keyboard.
assert.match(conversation, /onAsk: text => \{[\s\S]{0,400}?surfaceRestoreFocus = undefined;\s*closeSurface\(\);\s*askWithoutKeyboard\(text\);/u,
  '생활정보 closes without handing focus back and asks at once');
assert.ok(conversation.includes("void requestAssistant(question, true, '', 0, {keepComposerClosed: true});"), 'a tap asks through the normal send path');
assert.doesNotMatch(conversation, /onDraft|draft\(text\)|요청을 입력창에 넣었어요/u, 'no draft handoff left in the conversation');
assert.doesNotMatch(sections, /onDraft|질문 준비하기|다음 화면에서 질문을 확인한 뒤 보내세요/u, 'no 생활정보 screen drafts or promises a confirmation step');
assert.match(sections, /mountEducation\(\{root: host, onAsk, accountId\}\)/u, '유치원·학교 gets the same onAsk');
// 유치원·학교: 학교 form, 유치원 fallback form and 유치원 detail all ask through onAsk.
assert.doesNotMatch(education, /onDraft|질문 준비하기|다음 화면에서 질문을 확인한 뒤 보내세요/u, '유치원·학교 promises no confirmation step');
assert.equal((education.match(/\bonAsk\?\.\(/gu) || []).length, 3, '학교 form, 유치원 fallback and 유치원 detail ask through onAsk');
assert.ok(education.includes("node('button', 'consumer-action', '롯비에게 물어보기')"), '학교 button says it asks');
// Every place a turn ends and focuses the composer (CHAT-MOBILE-KEYBOARD-
// DISMISS-01: returnComposerFocusAfterTurn and the desktop-only prompt.focus)
// is skipped for a question asked by a tap.
const requestBody = conversation.slice(conversation.indexOf('const requestAssistant = async'), conversation.indexOf('const submitCurrentPrompt = async'));
assert.ok(requestBody.length > 1000, 'requestAssistant found');
const GUARDED_RETURN = /if \(!keepComposerClosed\) returnComposerFocusAfterTurn\(\);/gu;
const FOCUS_HELPER = /const focusComposerAfterThisTurn = \(\) => \{\s*if \(keepComposerClosed\) return;\s*if \(!composerUsesSoftwareKeyboard\(\)\) prompt\.focus\(\);\s*\};/u;
assert.equal((requestBody.match(GUARDED_RETURN) || []).length, 4, 'local answer + three finally blocks skip the focus for a tap question');
assert.match(requestBody, FOCUS_HELPER, 'timeout + calendar cancel focus only through the guarded helper');
const unguarded = requestBody.replace(GUARDED_RETURN, '').replace(FOCUS_HELPER, '');
assert.ok(!/\bfocusComposerInPlace\(|\bprompt\.focus\(|\breturnComposerFocusAfterTurn\(/u.test(unguarded), 'no composer focus in requestAssistant outside the keepComposerClosed guard');
assert.ok(!conversation.includes('preserveEmptyMedia') && !conversation.includes("rail.classList.add('has-place-banner')"), 'no empty photo box contract left');

const {LIFE_LOCAL_CARD_ENABLED: LOCAL_ON} = await import('../site-feature-flags.js');
// 지역생활정보 is hidden until its result shows inside the screen (QA_화면전수_01 H3); while it is,
// the one-tap / history / reload contract (B, C, F) is measured on 유치원·학교 → 학교 instead.
const LOCAL = LIFE_SHORTCUTS.find(item => item.id === 'local');
assert.equal(Boolean(LOCAL), LOCAL_ON, '지역생활정보 card follows its switch');
if (LOCAL_ON) assert.ok(LOCAL?.prompt, '지역생활정보 keeps its prompt');
const ASKING_ITEMS = LOCAL_ON ? ['local', 'school'] : ['school'];
const HISTORY_ITEM = ASKING_ITEMS[0];
assert.equal(LIFE_SHORTCUTS.some(item => item.ask), false, 'no card asks a fixed medical question any more');
const EXPECTED = {
  hospital: '근처 병원 찾아줘',
  pharmacy: '근처 약국 찾아줘',
  emergency: '근처 응급실 찾아줘',
  ...(LOCAL_ON ? {local: `${LOCAL.prompt}\n지역 또는 장소: 전주시 덕진구\n궁금한 생활정보: 쓰레기 배출일`} : {}),
  school: buildSchoolPrompt('meal_week', '전주서원초'),
};
assert.equal(EXPECTED.school, '전주서원초 이번 주 급식 알려줘');

// ── Browser ─────────────────────────────────────────────────────────────
function browserPath() {
  const candidates = [
    process.env.CHROME_BIN,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
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
  throw new Error('Chrome/Chromium is required for the life direct chat validation.');
}

const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
const CASES = [
  {label: '320', width: 320, height: 568, mobile: true},
  {label: '360', width: 360, height: 800, mobile: true},
  {label: '390', width: 390, height: 844, mobile: true},
  {label: '412', width: 412, height: 915, mobile: true},
  {label: '1280', width: 1280, height: 900, mobile: false},
];

const verified = id => ({
  provider: 'GOOGLE_PLACES', provider_place_id: `google:${id}`, match_basis: 'EXACT_NAME_AND_80M_COORDINATE',
  fetched_at: '2026-10-07T08:30:00Z', verification_state: 'VERIFIED', attributions: [{display_name: 'Google Places contributor'}],
});
const clinic = (index, name, {image = null, phone = null, open = 'OPEN', hours = '오늘 09:00~23:00'} = {}) => ({
  result_id: `clinic-${index}`, place_id: `naver:clinic:${index}`, name,
  category: '병원,의원>내과',
  road_address: `전북특별자치도 전주시 완산구 효자로 ${100 + index}`,
  latitude: 35.81 + index / 1000, longitude: 127.12 + index / 1000,
  coordinate_system: 'WGS84', coordinate_authority: 'NAVER_MAPS_GEOCODING', navigation_capability: true,
  phone, phone_verified: Boolean(phone),
  image_url: image, photo_evidence: image ? verified(index) : null,
  medical_status: {kind: 'HOSPITAL', open_state: open, hours_label: hours, target_label: '지금', basis: 'NMC_REGISTERED_HOURS'},
});
const placeResult = places => ({
  contract_id: 'CORE-PLACE-RESULT-01', schema_version: 1, result_set_id: 'plrs_0d1e2c3a4b5c6d7e8f90',
  provider_code: 'NMC', source: 'NMC_MEDICAL', query: '근처 병원', results: places,
});
const MIXED = placeResult([
  clinic(1, '가상바른내과의원', {image: 'https://lh3.googleusercontent.com/lotbi-life-direct-photo.jpg', phone: '063-000-0001'}),
  clinic(2, '가상효자내과의원 전주효자점 (사진 없는 카드)', {phone: '063-000-0002'}),
  clinic(3, '가상서신내과의원', {image: 'https://lh3.googleusercontent.com/broken-lotbi-life-direct.jpg', open: 'CLOSED', hours: '오늘 09:00~18:00'}),
]);
const NO_PHOTO = placeResult([
  clinic(4, '가상아주긴이름의내과의원 전주효자동 본원 야간진료센터', {phone: '063-000-0004'}),
  clinic(5, '가상동네내과의원'),
]);

function buildInner() {
  let html = read('index.html');
  const runtime = html.match(/<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/u);
  assert.ok(runtime, 'index.html must load site-conversation.js as a module');
  html = html.replace('<head>', '<head>\n  <base href="/">');
  const harness = `<script type="module">
const MIXED = ${JSON.stringify(MIXED)};
const NO_PHOTO = ${JSON.stringify(NO_PHOTO)};
const out = document.getElementById('ld-result');
const fail = e => { out.textContent = JSON.stringify({ok:false,error:String((e&&e.stack)||e)}); };
setTimeout(() => { if (out.textContent === 'pending') fail('watchdog'); }, 80000);
const params = new URLSearchParams(location.search);
const PHASE = params.get('phase') || 'ask';
const ITEM = params.get('item') || 'hospital';
const PLACES = params.get('places') === 'nophoto' ? NO_PHOTO : MIXED;
const MAP = params.get('map') || '';
const DARK = params.get('dark') === '1';
const log = JSON.parse(sessionStorage.getItem('ld-log') || '[]');
const remember = entry => { log.push(entry); sessionStorage.setItem('ld-log', JSON.stringify(log)); };
try {
  if (PHASE !== 'reload') { localStorage.clear(); sessionStorage.removeItem('ld-log'); log.length = 0; }
  document.cookie = 'lotbi_default_map_provider_v1=; Path=/; Max-Age=0';
  if (MAP) document.cookie = 'lotbi_default_map_provider_v1=' + MAP + '; Path=/';
  // Dark: the person chose 다크 in settings (the shared theme cookie).
  document.cookie = 'lotbi_theme_preference_v1=; Path=/; Max-Age=0';
  if (DARK) document.cookie = 'lotbi_theme_preference_v1=dark; Path=/';
  // Location use is on by default; the browser grants a position in 전주.
  Object.defineProperty(navigator, 'permissions', {configurable: true, value: {query: async () => ({state: 'granted', onchange: null, addEventListener() {}, removeEventListener() {}})}});
  Object.defineProperty(navigator, 'geolocation', {configurable: true, value: {
    getCurrentPosition: ok => setTimeout(() => ok({coords: {latitude: 35.8123, longitude: 127.1234, accuracy: 20}, timestamp: Date.now()}), 10),
    watchPosition: () => 1, clearWatch() {},
  }});
  const nativeImageSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  const mockImageSrc = new WeakMap();
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: true,
    get() { return mockImageSrc.get(this) || nativeImageSrc?.get?.call(this) || ''; },
    set(value) {
      const next = String(value);
      if (next.startsWith('https://lh3.googleusercontent.com/')) {
        mockImageSrc.set(this, next);
        setTimeout(() => this.dispatchEvent(new Event(next.includes('/broken-') ? 'error' : 'load')), 60);
        return;
      }
      nativeImageSrc?.set?.call(this, next);
    },
  });
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers:{'Content-Type':'application/json'}});
  globalThis.fetch = async (url, init) => {
    let parsed;
    try { parsed = new URL(String((url&&url.url)||url), location.origin); } catch { return nativeFetch(url, init); }
    if (parsed.pathname === '/v2/conversation/guest/sessions') return json({
      contract_id:'CORE-GUEST-SESSION-01',schema_version:1,guest_token:'g'.repeat(43),
      expires_at:new Date(Date.now()+3600000).toISOString(),
    });
    if (parsed.pathname === '/v2/conversation/guest/messages') {
      const body = JSON.parse(init.body);
      remember({phase: PHASE, text: body.text, location: body.client_context?.location || null});
      await new Promise(r => setTimeout(r, 150));
      const medical = /병원|약국|응급실/.test(body.text);
      return json({
        contract_id:'CORE-WEB-CHAT-01',schema_version:1,status:'ANSWERED',
        assistant_text: medical ? '근처 병원을 찾았어요.' : '확인했어요.',
        response_mode: medical ? 'PLACE_PROVIDER_READONLY' : 'AI_GROUNDED_CURRENT_FACT', correlation_id:'req_ld_' + log.length,
        intent:{action: medical ? 'PLACE_SEARCH' : 'UNKNOWN'},
        follow_up:{required:false,action:'UNKNOWN',automatic_execution:false},
        safety:{execution_authority:false,external_side_effect:false,transaction_created:false,order_created:false,payment_attempted:false,reservation_created:false,merchant_execution_started:false},
        ...(medical ? {place_result: PLACES} : {}),
        retry_safe:true,
      });
    }
    if (parsed.origin !== location.origin) return json({items:[]});
    return nativeFetch(url, init);
  };
  const prompt = document.getElementById('lotbi-prompt');
  // Counted twice: focus events (focus emulation is on) and every focus()
  // call on the composer, so a call that would open a phone keyboard is seen
  // even where the browser does not dispatch the event.
  let focusEvents = 0;
  let focusCalls = 0;
  prompt.addEventListener('focus', () => { focusEvents += 1; });
  prompt.focus = function (...args) { focusCalls += 1; return HTMLElement.prototype.focus.apply(this, args); };
  const focusTotal = () => focusEvents + focusCalls;
  const conversation = await import('/site-conversation.js?v=life-direct-chat');
  if (!conversation.mountConversation()) throw new Error('mount');
  document.body.dataset.siteAuthState = 'unauthenticated';
  window.dispatchEvent(new CustomEvent('lotbi:site-session-state', {detail: {authenticated: false}}));
  const {buildDefaultMapHref, buildVerifiedPhoneHref, normalizePlaceResult} = await import('/site-navigation.js?v=life-direct-chat');
  const {readDefaultMapProvider} = await import('/site-location-preference.js?v=life-direct-chat');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const wait = async (fn, label, tries = 600) => {
    for (let i = 0; i < tries; i += 1) { const v = fn(); if (v) return v; await sleep(25); }
    throw new Error('timeout ' + label);
  };
  const box = node => { if (!node) return null; const r = node.getBoundingClientRect(); return {x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom)}; };
  // Text contrast against the first opaque background behind it (WCAG).
  const rgb = value => (String(value).match(/[\\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const bgOf = node => { for (let el = node; el; el = el.parentElement) { const c = rgb(getComputedStyle(el).backgroundColor); if (c.length === 3 || (c.length === 4 && c[3] > .5)) return c.slice(0, 3); } return [255, 255, 255]; };
  const contrast = node => { if (!node) return null; const [a, b] = [lum(rgb(getComputedStyle(node).color).slice(0, 3)), lum(bgOf(node))].sort((x, y) => y - x); return Math.round((a + .05) / (b + .05) * 100) / 100; };
  const assistants = () => [...document.querySelectorAll('.chat-message-assistant:not(.chat-message-loading)')];
  const users = () => [...document.querySelectorAll('.chat-message-user .chat-message-body')].map(n => n.innerText.trim());
  const mine = () => log.filter(item => item.phase === PHASE);
  const typeInto = (field, value) => { field.value = value; field.dispatchEvent(new Event('input', {bubbles: true})); };
  const result = {ok: true, phase: PHASE, item: ITEM};

  if (PHASE === 'ask') {
    const TYPED = {hospital: '근처 병원 찾아줘', pharmacy: '근처 약국 찾아줘', emergency: '근처 응급실 찾아줘'}[ITEM];
    let button;
    if (TYPED) {
      // LIFE-MEDICAL-MERGE-01: no 지역정보 card asks this; the person types and sends it.
      result.theme = document.body.dataset.siteTheme || '';
      typeInto(prompt, TYPED);
      button = document.querySelector('.send-button');
    } else {
      document.querySelector('[data-consumer-section="life"]').click();
      // 유치원·학교 sits behind 내 아이 학교·유치원 (REGIONAL-INFO-APPROVED-UX-RESTORE-P0).
      const shortcutId = ITEM === 'school' ? 'my-child' : ITEM;
      const shortcut = await wait(() => document.querySelector('[data-life-shortcut="' + shortcutId + '"]'), 'life shortcut ' + shortcutId);
      result.theme = document.body.dataset.siteTheme || '';
      if (ITEM === 'local') {
        shortcut.click();
        const form = await wait(() => document.querySelector('.consumer-life-form'), 'local form');
        const [where, what] = form.querySelectorAll('input');
        typeInto(where, '전주시 덕진구'); typeInto(what, '쓰레기 배출일');
        button = form.querySelector('button[type="submit"]');
        result.formContrast = {button: contrast(button), note: contrast(form.closest('.consumer-life-detail')?.querySelector('.consumer-feature-note'))};
      } else if (ITEM === 'school') {
        shortcut.click();
        // Signed out, 내 아이 학교·유치원 links the public lookup (owner decision 2026-10-10).
        (await wait(() => document.querySelector('[data-life-education-entry]'), '로그인 없이 학교·유치원 찾기')).click();
        const tab = await wait(() => document.querySelector('[data-edu-tab="school"]'), 'school tab');
        tab.click();
        const name = await wait(() => document.querySelector('[data-edu-school-name]'), 'school form');
        typeInto(name, '전주서원초');
        document.querySelector('[data-school-action="meal_week"]').click();
        const form = name.closest('form');
        button = form.querySelector('button[type="submit"]');
        result.formContrast = {button: contrast(button), note: contrast(form.parentElement.querySelector('.consumer-feature-note'))};
      } else {
        throw new Error('unknown item ' + ITEM);
      }
    }
    result.buttonLabel = button.textContent.trim();
    // B: a fast double tap.
    button.click(); button.click();
    result.composerAfterTap = prompt.value;
    await wait(() => assistants().length >= 1, 'answer');
    await sleep(700);
    result.requests = mine();
    result.users = users();
    result.promptValue = prompt.value;
    result.focusCount = focusTotal();
    result.focusDetail = {events: focusEvents, calls: focusCalls};
    result.activeIsPrompt = document.activeElement === prompt;
    result.activeIsTextEntry = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
    result.surfaceOpen = Boolean(document.querySelector('.consumer-section-panel'));
    const rail = document.querySelector('.lotbi-place-orbit');
    if (rail) {
      await sleep(300);
      result.rail = {...box(rail), hasPhotoClass: rail.classList.contains('has-place-photo'), bannerClass: rail.classList.contains('has-place-banner')};
      result.viewport = {w: window.innerWidth, h: window.innerHeight};
      const cards = [...rail.querySelectorAll('.lotbi-place-orbit-card')];
      const centerOf = () => rail.querySelector('[data-orbit-slot="CENTER"]');
      result.cards = [];
      for (let index = 0; index < cards.length; index += 1) {
        await wait(() => Number(centerOf()?.dataset.orbitIndex) === index, 'center ' + index);
        await sleep(450);
        const center = centerOf();
        const overlaps = (a, b) => Boolean(a && b) && a.w > 0 && b.w > 0 && a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;
        const selectors = [...rail.querySelectorAll('[data-orbit-dot]')].filter(n => n.getClientRects().length > 0 && getComputedStyle(n).visibility === 'visible').map(box);
        const texts = [...center.querySelectorAll('.lotbi-rich-card-source, .lotbi-rich-card-title, .lotbi-rich-card-price, .lotbi-place-medical-line, .lotbi-place-badges')].map(box);
        const icons = [...center.querySelectorAll('.lotbi-place-action-icon')].map(box);
        const copy = center.querySelector('.lotbi-rich-card-copy');
        result.cards.push({
          name: center.querySelector('.lotbi-rich-card-title')?.textContent || '',
          hasMedia: Boolean(center.querySelector('.lotbi-rich-card-place-media')),
          mediaState: center.querySelector('.lotbi-rich-card-place-media')?.dataset.mediaState || '',
          photoReady: Boolean(center.querySelector('.lotbi-place-photo.is-ready')),
          card: box(center), rail: box(rail),
          copyClipped: copy ? copy.scrollHeight > copy.clientHeight + 1 : true,
          actions: [...center.querySelectorAll('.lotbi-rich-card-action')].map(n => ({action: n.dataset.action, provider: n.dataset.mapProvider || '', href: n.getAttribute('href') || '', ...box(n)})),
          selectorOverText: selectors.some(a => texts.some(t => overlaps(a, t))),
          selectorOverIcon: selectors.some(a => icons.some(i => overlaps(a, i))),
          contrast: {
            title: contrast(center.querySelector('.lotbi-rich-card-title')),
            source: contrast(center.querySelector('.lotbi-rich-card-source')),
            address: contrast(center.querySelector('.lotbi-rich-card-price')),
            medical: contrast(center.querySelector('.lotbi-place-medical-line')),
          },
        });
        rail.querySelectorAll('[data-orbit-dot]')[(index + 1) % cards.length]?.click();
      }
      // E: the existing helpers decide phone and map; the card must agree.
      const normalized = normalizePlaceResult(PLACES);
      const provider = readDefaultMapProvider(document.cookie);
      result.mapProvider = provider;
      result.expectedMap = normalized.results.map(place => buildDefaultMapHref(provider, place));
      result.expectedPhone = normalized.results.map(place => buildVerifiedPhoneHref(place) || '');
    }
    if (params.get('history') === '1') {
      // C: forward reopens 생활정보 (its menu, nothing sent); back closes it.
      const before = mine().length;
      history.forward(); await sleep(900);
      result.forwardSurface = Boolean(document.querySelector('.consumer-section-panel'));
      result.forwardActiveIsTextEntry = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
      history.back(); await sleep(900);
      result.backSurface = Boolean(document.querySelector('.consumer-section-panel'));
      result.historyRequests = mine().length - before;
      result.historyFocusCount = focusTotal();
      result.historyUsers = users();
    }
    if (params.get('tap') === '1') {
      // F: the person taps the composer.
      prompt.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
      prompt.focus();
      await sleep(200);
      result.tapFocusEvents = focusEvents;
      result.tapFocusCalls = focusCalls;
      result.tapActiveIsPrompt = document.activeElement === prompt;
    }
  } else if (PHASE === 'reload') {
    await wait(() => document.body.dataset.conversationRestore === 'ready', 'restore');
    await sleep(1800);
    result.requests = mine();
    result.users = users();
    result.promptValue = prompt.value;
    result.focusCount = focusTotal();
    result.activeIsPrompt = document.activeElement === prompt;
  }
  out.textContent = JSON.stringify(result);
} catch (e) { fail(e); }
</script><pre id="ld-result" hidden>pending</pre>`;
  return html.replace(runtime[0], harness);
}

function startServer() {
  const serverCode = `
    const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
    const root=${JSON.stringify(ROOT)};
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
    const server=http.createServer((req,res)=>{
      const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
      const target=path.resolve(root,'.'+pathname);
      if(!target.startsWith(root)){res.writeHead(403);res.end();return;}
      fs.readFile(target,(error,data)=>{if(error){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream'});res.end(data);});
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

async function waitFor(fn, label, timeoutMs = 20000) {
  const started = Date.now();
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - started > timeoutMs) throw new Error(`timeout: ${label}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

async function openDevtools(browser, profile) {
  const chrome = spawn(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1280,900', 'about:blank',
  ], {stdio: 'ignore'});
  const portFile = path.join(profile, 'DevToolsActivePort');
  await waitFor(() => fs.existsSync(portFile) && fs.readFileSync(portFile, 'utf8').includes('\n'), 'DevToolsActivePort');
  const [port] = fs.readFileSync(portFile, 'utf8').split(/\r?\n/);
  const targets = await waitFor(async () => {
    const list = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json()).catch(() => []);
    return list.find(item => item.type === 'page') ? list : null;
  }, 'page target');
  const socket = new WebSocket(targets.find(item => item.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let nextId = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(String(event.data));
    if (message.id && pending.has(message.id)) {
      const {resolve, reject} = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    nextId += 1;
    pending.set(nextId, {resolve, reject});
    socket.send(JSON.stringify({id: nextId, method, params}));
  });
  const close = () => { try { socket.close(); } catch {} chrome.kill('SIGTERM'); };
  return {send, close};
}

async function runPhase(devtools, url, label) {
  await devtools.send('Page.navigate', {url});
  const text = await waitFor(async () => {
    const result = await devtools.send('Runtime.evaluate', {
      expression: "document.getElementById('ld-result')?.textContent || 'pending'",
      returnByValue: true,
    }).catch(() => null);
    const value = result?.result?.value;
    return value && value !== 'pending' ? value : null;
  }, label, 90000);
  const parsed = JSON.parse(text);
  if (!parsed.ok) throw new Error(`${label}: ${parsed.error}`);
  return parsed;
}

function assertOneDirectAsk(run, label, expectedText) {
  assert.equal(run.composerAfterTap, '', `${label}: the question is not left in the composer for a second tap`);
  assert.deepEqual(run.requests.map(item => item.text), [expectedText], `${label}: one tap sends exactly one message`);
  assert.deepEqual(run.users, [expectedText], `${label}: one user message`);
  assert.equal(run.promptValue, '', `${label}: composer empty after sending`);
  assert.equal(run.focusCount, 0, `${label}: the composer was never focused (keyboard stays closed) ${JSON.stringify(run.focusDetail)}`);
  assert.equal(run.activeIsPrompt, false, `${label}: composer not focused`);
  assert.equal(run.activeIsTextEntry, false, `${label}: no text field focused`);
  assert.equal(run.surfaceOpen, false, `${label}: 생활정보 closed, the conversation is shown`);
}

// A typed question: one message, the composer emptied by the send. (Focus is the
// typist's own business, so the no-keyboard contract is measured on the cards above.)
function assertOneTypedAsk(run, label, expectedText) {
  assert.equal(run.composerAfterTap, '', `${label}: the question left the composer`);
  assert.deepEqual(run.requests.map(item => item.text), [expectedText], `${label}: a fast double tap sends exactly one message`);
  assert.deepEqual(run.users, [expectedText], `${label}: one user message`);
  assert.equal(run.promptValue, '', `${label}: composer empty after sending`);
  assert.equal(run.surfaceOpen, false, `${label}: no 생활정보 surface over the conversation`);
}

function assertNearby(run, label) {
  const location = run.requests[0]?.location;
  assert.ok(location && Math.abs(location.latitude - 35.812) < 0.01, `${label}: the current location goes along ${JSON.stringify(location)}`);
}

function assertCards(run, label, testCase, {photo}) {
  assert.ok(run.rail, `${label}: place cards rendered`);
  assert.equal(run.rail.bannerClass, false, `${label}: no forced photo-height banner`);
  assert.equal(run.rail.hasPhotoClass, photo, `${label}: rail photo height only when a photo is shown`);
  for (const [index, card] of run.cards.entries()) {
    assert.ok(card.card.h <= card.rail.h + 1, `${label}: card ${index} ${card.card.h}px fits the rail ${card.rail.h}px`);
    assert.ok(card.card.y >= card.rail.y - 1 && card.card.bottom <= card.rail.bottom + 1, `${label}: card ${index} not cut by the rail`);
    assert.equal(card.copyClipped, false, `${label}: card ${index} text not cut off`);
    assert.ok(card.card.x >= 0 && card.card.right <= run.viewport.w, `${label}: card ${index} inside the screen`);
    for (const action of card.actions) {
      assert.ok(action.right <= run.viewport.w && action.x >= 0, `${label}: card ${index} ${action.action} inside the screen`);
      assert.ok(action.bottom <= card.card.bottom + 1 && action.y >= card.card.y - 1, `${label}: card ${index} ${action.action} inside its card`);
      if (testCase.mobile) assert.ok(action.w >= 44 && action.h >= 44, `${label}: card ${index} ${action.action} touch target ${action.w}x${action.h}`);
    }
    if (!card.hasMedia) {
      assert.equal(card.selectorOverText, false, `${label}: card ${index} without a photo - result buttons do not cover its text`);
      assert.equal(card.selectorOverIcon, false, `${label}: card ${index} without a photo - result buttons do not cover phone / map`);
    }
    const map = card.actions.find(action => action.provider);
    assert.ok(map, `${label}: card ${index} map action`);
    assert.equal(map.provider, run.mapProvider, `${label}: card ${index} uses the map app from settings`);
    assert.equal(map.href, run.expectedMap[index], `${label}: card ${index} map link from the existing helper`);
    const phone = card.actions.find(action => action.action === 'phone');
    assert.equal(phone?.href || '', run.expectedPhone[index], `${label}: card ${index} phone action unchanged`);
  }
}

function assertReadable(run, label, {cards = false} = {}) {
  if (run.formContrast) {
    assert.ok(run.formContrast.button >= 4.5, `${label}: button contrast ${run.formContrast.button}`);
    assert.ok(run.formContrast.note >= 4.5, `${label}: note contrast ${run.formContrast.note}`);
  }
  if (!cards) return;
  for (const [index, card] of run.cards.entries()) {
    for (const key of ['title', 'address', 'medical']) {
      if (card.contrast[key] !== null) assert.ok(card.contrast[key] >= 4.5, `${label}: card ${index} ${key} contrast ${card.contrast[key]}`);
    }
    if (card.contrast.source !== null) assert.ok(card.contrast.source >= 3, `${label}: card ${index} category contrast ${card.contrast.source}`);
  }
}

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.life-direct-chat-'));
const server = startServer();
const summary = [];
try {
  const port = await serverPort(server);
  const origin = `http://127.0.0.1:${port}`;
  const innerRel = `scripts/${path.basename(dir)}/inner.html`;
  fs.writeFileSync(path.join(ROOT, innerRel), buildInner(), 'utf8');
  for (const testCase of CASES) {
    const devtools = await openDevtools(browser, fs.mkdtempSync(path.join(dir, 'profile-')));
    const label = testCase.label;
    try {
      await devtools.send('Page.enable');
      await devtools.send('Runtime.enable');
      await devtools.send('Emulation.setDeviceMetricsOverride', {width: testCase.width, height: testCase.height, deviceScaleFactor: 1, mobile: testCase.mobile});
      await devtools.send('Emulation.setUserAgentOverride', {userAgent: testCase.mobile ? MOBILE_UA : DESKTOP_UA});
      if (testCase.mobile) await devtools.send('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
      await devtools.send('Emulation.setFocusEmulationEnabled', {enabled: true});
      await devtools.send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});
      const page = query => `${origin}/${innerRel}?${query}`;

      // A, D, E: a typed 병원·의원 question with photo, no-photo and broken-photo cards.
      const hospital = await runPhase(devtools, page('phase=ask&item=hospital'), `${label}/hospital`);
      console.log(`LIFE_DIRECT_CHAT ${label} hospital`, JSON.stringify(hospital));
      assertOneTypedAsk(hospital, `${label}/hospital`, EXPECTED.hospital);
      assertNearby(hospital, `${label}/hospital`);
      assertCards(hospital, `${label}/hospital`, testCase, {photo: true});
      assertReadable(hospital, `${label}/hospital`, {cards: true});
      const [photoCard, noPhotoCard, brokenCard] = hospital.cards;
      assert.ok(photoCard.hasMedia && photoCard.mediaState === 'loaded' && photoCard.photoReady, `${label}: a real photo renders`);
      assert.equal(noPhotoCard.hasMedia, false, `${label}: no image_url, no media box`);
      assert.equal(brokenCard.hasMedia, false, `${label}: a photo that fails removes its media box`);
      assert.ok(noPhotoCard.card.h <= photoCard.card.h - 90, `${label}: a card without a photo is short (${noPhotoCard.card.h} vs ${photoCard.card.h})`);

      // B, C, F: 지역생활정보 asks in one tap; back/forward and a reload send nothing
      // again and focus nothing; only a tap on the composer focuses it.
      const asked = await runPhase(devtools, page(`phase=ask&item=${HISTORY_ITEM}&history=1${label === '390' ? '&tap=1' : ''}`), `${label}/${HISTORY_ITEM}-history`);
      assert.equal(asked.buttonLabel, '롯비에게 물어보기', `${label}: the button says it asks`);
      assertOneDirectAsk(asked, `${label}/${HISTORY_ITEM}-history`, EXPECTED[HISTORY_ITEM]);
      assert.equal(asked.forwardSurface, true, `${label}: forward reopens 생활정보`);
      assert.equal(asked.forwardActiveIsTextEntry, false, `${label}: reopening focuses no text field`);
      assert.equal(asked.backSurface, false, `${label}: back closes it`);
      assert.equal(asked.historyRequests, 0, `${label}: back/forward sends nothing again`);
      assert.equal(asked.historyFocusCount, 0, `${label}: back/forward focuses no composer`);
      assert.deepEqual(asked.historyUsers, asked.users, `${label}: no new message after back/forward`);
      if (label === '390') {
        assert.ok(asked.tapFocusEvents >= 1 && asked.tapFocusCalls === 1, `${label}: tapping the composer focuses it (${asked.tapFocusEvents} events, ${asked.tapFocusCalls} calls)`);
        assert.equal(asked.tapActiveIsPrompt, true, `${label}: composer focused after the tap`);
      }

      // C: a reload sends nothing and focuses nothing.
      const reloaded = await runPhase(devtools, page('phase=reload'), `${label}/reload`);
      console.log(`LIFE_DIRECT_CHAT ${label} reload`, JSON.stringify(reloaded));
      assert.deepEqual(reloaded.requests, [], `${label}: reload sends nothing`);
      assert.deepEqual(reloaded.users, [EXPECTED[HISTORY_ITEM]], `${label}: the stored conversation, once`);
      assert.equal(reloaded.promptValue, '', `${label}: reload leaves the composer empty`);
      assert.equal(reloaded.focusCount, 0, `${label}: reload focuses no composer`);

      // D, E: a list with no photo at all is short and nothing is cut off; the
      // map app follows settings (default and each existing choice).
      const maps = label === '390' ? ['', 'NAVER_MAP', 'KAKAO_NAVI', 'TMAP', 'GOOGLE_MAPS'] : [''];
      for (const map of maps) {
        const noPhoto = await runPhase(devtools, page(`phase=ask&item=hospital&places=nophoto${map ? `&map=${map}` : ''}`), `${label}/nophoto/${map || 'default'}`);
        console.log(`LIFE_DIRECT_CHAT ${label} nophoto ${map || 'default'}`, JSON.stringify({rail: noPhoto.rail, cards: noPhoto.cards.map(c => ({h: c.card.h, media: c.hasMedia, provider: c.actions.find(a => a.provider)?.provider}))}));
        assertOneTypedAsk(noPhoto, `${label}/nophoto`, EXPECTED.hospital);
        assertCards(noPhoto, `${label}/nophoto/${map || 'default'}`, testCase, {photo: false});
        assert.equal(noPhoto.mapProvider, map || 'NAVER_MAP', `${label}: map provider ${map || 'default'} read from settings`);
        assert.ok(noPhoto.cards.every(card => !card.hasMedia), `${label}: no media box on any card`);
        // The rail keeps no photo space: below its tallest card it has no more
        // room than the photo list has below its photo card (the position row).
        const tallestNoPhoto = Math.max(...noPhoto.cards.map(card => card.card.h));
        const photoRoom = hospital.rail.h - photoCard.card.h;
        assert.ok(noPhoto.rail.h - tallestNoPhoto <= photoRoom + 2, `${label}: no-photo list keeps no photo space (rail ${noPhoto.rail.h} − card ${tallestNoPhoto} vs ${photoRoom})`);
        assert.ok(noPhoto.rail.h <= hospital.rail.h - (photoCard.card.h - tallestNoPhoto) + 2, `${label}: no-photo list is shorter by the photo height (${noPhoto.rail.h} vs ${hospital.rail.h})`);
        if (!map) summary.push(`${label}: photo rail ${hospital.rail.h}px → no-photo rail ${noPhoto.rail.h}px, no-photo card ${noPhotoCard.card.h}px vs photo card ${photoCard.card.h}px`);
      }

      // A: 지역생활정보 and 유치원·학교 → 학교 send their built question at once.
      const light = {};
      for (const item of ASKING_ITEMS) {
        const run = await runPhase(devtools, page(`phase=ask&item=${item}`), `${label}/${item}`);
        console.log(`LIFE_DIRECT_CHAT ${label} ${item}`, JSON.stringify({button: run.buttonLabel, requests: run.requests, focus: run.focusDetail, contrast: run.formContrast}));
        assert.equal(run.buttonLabel, '롯비에게 물어보기', `${label}/${item}: the button says it asks`);
        assertOneDirectAsk(run, `${label}/${item}`, EXPECTED[item]);
        assert.equal(run.requests[0].location, null, `${label}/${item}: no location for a question that is not "nearby"`);
        assertReadable(run, `${label}/${item}`);
        light[item] = run.formContrast;
      }

      // G: dark (다크 chosen in settings): the same one-tap asks; the forms and
      // the cards without a photo stay readable.
      const darkCards = await runPhase(devtools, page('phase=ask&item=hospital&places=nophoto&dark=1'), `${label}/dark/hospital`);
      assert.equal(darkCards.theme, 'dark', `${label}: dark theme applied`);
      assertOneTypedAsk(darkCards, `${label}/dark/hospital`, EXPECTED.hospital);
      assertCards(darkCards, `${label}/dark/hospital`, testCase, {photo: false});
      assertReadable(darkCards, `${label}/dark/hospital`, {cards: true});
      const dark = {};
      for (const item of ASKING_ITEMS) {
        const run = await runPhase(devtools, page(`phase=ask&item=${item}&dark=1`), `${label}/dark/${item}`);
        assert.equal(run.theme, 'dark', `${label}/${item}: dark theme applied`);
        assertOneDirectAsk(run, `${label}/dark/${item}`, EXPECTED[item]);
        assertReadable(run, `${label}/dark/${item}`);
        dark[item] = run.formContrast;
      }
      console.log(`LIFE_DIRECT_CHAT ${label} contrast`, JSON.stringify({light, dark, darkCards: darkCards.cards.map(card => card.contrast)}));

      if (label === '390') {
        // A: a typed 약국 and 응급실 question are answered the same way.
        for (const item of ['pharmacy', 'emergency']) {
          const run = await runPhase(devtools, page(`phase=ask&item=${item}`), `${label}/${item}`);
          assertOneTypedAsk(run, `${label}/${item}`, EXPECTED[item]);
          assertNearby(run, `${label}/${item}`);
        }
      }
    } finally {
      devtools.close();
    }
  }
} finally {
  server.kill('SIGTERM');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(dir, {recursive: true, force: true}); break; } catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
}

for (const line of summary) console.log(`LIFE_DIRECT_CHAT compact ${line}`);
console.log('SITE-LIFE-DIRECT-CHAT-CARD-COMPACTION-01 OK — every 생활정보 card that still asks (지역생활정보, 유치원·학교) asks in one tap without the keyboard, and a typed 병원·약국·응급실 question gets the compact place cards; cards without a photo have no photo box; phone and the chosen map app unchanged (viewport emulation, not a device run)');
