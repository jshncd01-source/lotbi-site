// SITE-PET-FAMILY-WEB-01 — PET FAMILY web surface contract.
//
// Guards the two things that are easy to break silently: the privacy boundary
// (private photo bytes, masked registration number, opt-in matching consent)
// and the non-assertion language rule the Core migrations impose.
import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const index = read('index.html');
const petClient = read('site-pet.js');
const petUi = read('site-pet-ui.js');
const petCss = read('site-pet.css');
const conversation = read('site-conversation.js');

// Core's PET_PHOTO_SLOT_CODES order is a contract: slot_index is derived from
// it, so the web uploader must not reorder or rename the slots.
const CORE_SLOT_CODES = [
  'NOSE_FRONT', 'NOSE_LEFT', 'NOSE_RIGHT',
  'FACE_FRONT', 'FACE_LEFT', 'FACE_RIGHT',
  'BODY_LEFT', 'BODY_RIGHT', 'BACK_REAR',
  'DISTINCTIVE',
];

// ---------------------------------------------------------------- navigation

assert.match(
  index,
  /<symbol id="lotbi-icon-paw" viewBox="0 0 24 24">/,
  'paw sprite symbol missing',
);
const pawSymbol = index.match(/<symbol id="lotbi-icon-paw"[\s\S]*?<\/symbol>/)[0];
assert.ok(!/fill="(?!none)/.test(pawSymbol), 'paw icon must stay stroke-only like the other nav icons');

const desktopAside = index.match(/<aside class="chat-sidebar chat-sidebar-desktop"[\s\S]*?<\/aside>/)?.[0] || '';
const mobileAside = index.match(/<aside(?=[^>]*id="mobile-nav-drawer")[\s\S]*?<\/aside>/)?.[0] || '';
for (const [label, block] of [['desktop', desktopAside], ['mobile', mobileAside]]) {
  assert.ok(block, `${label} sidebar markup missing`);
  assert.ok(block.includes('#lotbi-icon-paw'), `${label} 반려동물 entry missing the paw icon`);
  assert.ok(block.includes('data-pet-family-open'), `${label} 반려동물 entry missing its open hook`);
  assert.match(block, /<span class="nav-item-label">반려동물<\/span>/, `${label} 반려동물 label missing`);
  assert.ok(block.includes('data-pet-sos-count'), `${label} must reserve the SOS badge slot`);
  // 캘린더 → 반려동물 → 최근 대화
  const calendarPos = block.indexOf('sidebar-calendar-nav');
  const petPos = block.indexOf('sidebar-pet-nav');
  const recentPos = block.indexOf('sidebar-history-section');
  assert.ok(
    calendarPos >= 0 && petPos > calendarPos && recentPos > petPos,
    `${label} 반려동물 must sit between 캘린더 and 최근 대화`,
  );
}
assert.ok(index.includes('site-pet.css'), 'PET FAMILY stylesheet must be linked');
assert.ok(
  conversation.includes("mountPetFamilyManager") && conversation.includes("data-pet-family-open"),
  'conversation shell must mount the PET FAMILY surface from the sidebar entry',
);

// ------------------------------------------------------------ Core contract

assert.equal(
  JSON.stringify([...petClient.matchAll(/'([A-Z_]+)',\n/g)].map(m => m[1]).filter(v => CORE_SLOT_CODES.includes(v))),
  JSON.stringify(CORE_SLOT_CODES),
  'photo slot codes must match Core PET_PHOTO_SLOT_CODES exactly, in order',
);
assert.ok(
  petClient.includes("PET_SPECIES = Object.freeze(['DOG', 'CAT'])"),
  'species must stay limited to DOG and CAT (Core CheckConstraint)',
);
assert.ok(
  petClient.includes("headers['X-Request-ID']"),
  'idempotent writes must send the request id Core reads',
);
assert.ok(
  petClient.includes("PET_PHOTO_MAX_BYTES = 10 * 1024 * 1024"),
  'photo size limit must match Core',
);
assert.ok(
  petClient.includes("PET_PHOTO_MIME_TYPES = Object.freeze(['image/jpeg', 'image/png'])"),
  'photo types must match Core',
);

// -------------------------------------------------------- privacy boundary

assert.ok(petClient.includes("cache: 'no-store'"), 'pet requests must not be cached');
assert.ok(petClient.includes("credentials: 'omit'"), 'pet requests must not send ambient credentials');

// A failing sub-request of this surface must never take the whole site down with
// it, the way one 401 on a Calendar sub-request once collapsed the calendar. So
// the invalid-session announcement is opt-in here, reserved for the read that
// opens the surface, and never fires on 403 — a 403 means this one action is not
// permitted (somebody else's pet, an assurance level 발견 신고 wants), not that
// the session is gone.
assert.ok(
  petClient.includes('announceSessionFailure = false'),
  'pet requests must not announce session failure by default',
);
assert.ok(
  petClient.includes("petRequest('/v2/pets', sessionToken, {announceSessionFailure: true}"),
  'only the surface entry read may announce an invalid session',
);
assert.ok(
  petClient.includes('if (!(error instanceof SiteCoreError) || error.status !== 401) return;'),
  'a 403 must not be treated as an invalid session',
);
assert.strictEqual(
  (petClient.match(/if \(announceSessionFailure\) announceInvalidSiteSession\(error\);/g) || []).length,
  2,
  'every announce site must be gated on the opt-in flag',
);
assert.strictEqual(
  (petClient.match(/announceSessionFailure: true/g) || []).length,
  1,
  'exactly one pet request may announce an invalid session',
);
assert.ok(
  petClient.includes('URL.createObjectURL'),
  'private photo bytes must be read through an object URL, not a public link',
);
for (const forbidden of ['cdn.', 'publicUrl', 'public_url', 'sharePhoto']) {
  assert.ok(!petClient.includes(forbidden), `pet photos must never reach a public surface: ${forbidden}`);
}
// The registration number is sensitive: masked in detail, absent from list cards.
assert.ok(
  petClient.includes('maskOfficialRegistrationNumber'),
  'the official registration number must be maskable',
);
const renderListBody = petUi.match(/const renderList = \(\) => \{[\s\S]*?\n  \};/)?.[0] || '';
assert.ok(renderListBody, 'list renderer not found');
assert.ok(
  !renderListBody.includes('officialRegistrationNumber'),
  'list cards must not expose the official registration number',
);
assert.ok(
  !renderListBody.includes('pet.petId)') || !renderListBody.includes('pet-card-id'),
  'list cards must not print the raw Pet ID as user-facing copy',
);

// Matching consent is opt-in and must say what it covers.
assert.ok(
  petClient.includes("value.matching_consent_state === 'GRANTED' ? 'GRANTED' : 'NOT_GRANTED'"),
  'matching consent must default to NOT_GRANTED for anything but an explicit GRANTED',
);
assert.match(
  petUi,
  /자동 알림이나 연락처 중개는 하지 않습니다/,
  'the consent toggle must state that no alerts or contact relay happen',
);

// ------------------------------------------------------- non-assertion rule

const assertiveCopy = [
  '찾았습니다',
  '찾았어요',
  '일치합니다',
  '일치해요',
  '당신의 반려동물입니다',
  '100% 일치',
  '동일한 개체',
];
for (const source of [['site-pet-ui.js', petUi], ['site-pet.js', petClient]]) {
  const [label, text] = source;
  // The rule is about rendered copy. Comments and the shipped notice both name
  // these phrases in order to deny them, so neither counts.
  const copyOnly = text
    .split('\n')
    .filter(line => !line.trimStart().startsWith('//'))
    .join('\n')
    .replace(/const NON_ASSERTION_NOTICE = '[^']*';/, '');
  for (const phrase of assertiveCopy) {
    assert.ok(
      !copyOnly.includes(phrase),
      `${label} must not assert a match: ${phrase}`,
    );
  }
}
assert.match(
  petUi,
  /공개 자동 매칭과 보호자 알림은 아직 활성화되지 않았습니다/,
  'the surface must keep the non-assertion notice',
);

// ---------------------------------------------------------------- responsive

assert.ok(petCss.includes('@media (min-width: 901px)'), 'Desktop breakpoint missing');
assert.ok(petCss.includes('body[data-site-theme="dark"]'), 'Dark theme rules missing');
for (const check of ['node --check site-pet.js', 'node --check site-pet-ui.js']) {
  const [cmd, ...args] = check.split(' ');
  const run = spawnSync(cmd, args, {cwd: ROOT, encoding: 'utf8'});
  assert.equal(run.status, 0, `${check} failed: ${run.stderr}`);
}

// ------------------------------------------------------------- live render

function browserPath() {
  const candidates = [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.includes('/') && fs.existsSync(candidate)) return candidate;
    const found = spawnSync('which', [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required for PET FAMILY render validation.');
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const {port} = server.address();
      server.close(() => resolve(port));
    });
  });
}

// Two pets, one with 3 of 10 photo slots filled and a registration number, so
// the render proves the list keeps that number off the card.
const FIXTURE_PETS = {
  pets: [
    {
      pet_id: 'PET_KR_AAAAAAAAAAAAAAAAAAAA',
      name: '보리',
      species: 'DOG',
      sex: 'FEMALE',
      breed: '진돗개',
      official_registration_number: '410000000001234',
      photo_completion_state: 'UPLOAD_INCOMPLETE',
      matching_consent_state: 'NOT_GRANTED',
    },
    {
      pet_id: 'PET_KR_BBBBBBBBBBBBBBBBBBBB',
      name: '나비',
      species: 'CAT',
      sex: 'UNKNOWN',
      photo_completion_state: 'UPLOAD_COMPLETE',
      matching_consent_state: 'GRANTED',
    },
  ],
};

function innerFixtureHtml() {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8" />
<link rel="stylesheet" href="/site-theme-tokens.css" />
<link rel="stylesheet" href="/site-conversation.css" />
<link rel="stylesheet" href="/site-pet.css" />
<style>
  html,body{margin:0}
  #host{padding:12px}
  /* The result sink must never take part in layout, or its single long JSON
     line becomes the widest box on the page and fakes a horizontal overflow. */
  #render-result{position:absolute;left:-99999px;top:0;visibility:hidden}
</style>
<script>
  // Stand in for Core so the surface is exercised without the network.
  const PETS = ${JSON.stringify(JSON.stringify(FIXTURE_PETS))};
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (/\\/v2\\/pets\\/[^/]+\\/photos$/.test(target)) {
      const filled = target.includes('AAAA')
        ? [{slot_code: 'NOSE_FRONT'}, {slot_code: 'NOSE_LEFT'}, {slot_code: 'FACE_FRONT'}]
        : [];
      return new Response(JSON.stringify({photos: filled, manifest: {slot_count: filled.length, state: 'UPLOAD_INCOMPLETE', manifest_version: 1}}), {status: 200, headers: {'Content-Type': 'application/json'}});
    }
    if (/\\/v2\\/pets$/.test(target)) {
      return new Response(PETS, {status: 200, headers: {'Content-Type': 'application/json'}});
    }
    return new Response('{}', {status: 404, headers: {'Content-Type': 'application/json'}});
  };
</script>
</head><body><div id="host"></div><pre id="render-result"></pre>
<script type="module">
  import {mountPetFamilyManager} from '/site-pet-ui.js';
  const host = document.getElementById('host');
  await mountPetFamilyManager({sessionToken: 'fixture-token', root: host});

  const surface = document.querySelector('[data-pet-family-surface]');
  const list = document.querySelector('[data-pet-list]');
  const cards = [...list.querySelectorAll('[data-pet-card]')].map(card => ({
    name: card.querySelector('.pet-card-name').textContent,
    species: card.querySelector('.pet-card-species').textContent,
    progress: card.querySelector('.pet-progress-label').textContent,
    consent: card.querySelector('.pet-card-consent').textContent,
  }));
  const listText = list.textContent;

  // Detail view: the registration number is allowed here, but only masked
  // until the owner reveals it, and the consent toggle must explain itself.
  list.querySelector('[data-pet-open="PET_KR_AAAAAAAAAAAAAAAAAAAA"]').click();
  const detail = document.querySelector('[data-pet-detail]');
  const detailTextBeforeReveal = detail.textContent;
  const maskedRegistration = detail.querySelector('.pet-registration-value').textContent;
  const consentChecked = detail.querySelector('[data-pet-consent]').checked;
  detail.querySelector('.pet-registration-reveal').click();
  const revealedRegistration = detail.querySelector('.pet-registration-value').textContent;

  // Delete is a two-step confirm. Both classes set display, which beats the
  // UA [hidden] rule, so measure real boxes rather than trusting .hidden.
  const box = node => (node ? node.getBoundingClientRect().height : -1);
  const deleteTrigger = detail.querySelector('[data-pet-delete]');
  const confirmLine = detail.querySelector('.pet-delete-confirm');
  const deleteBefore = {trigger: box(deleteTrigger), confirm: box(confirmLine)};
  deleteTrigger.click();
  const deleteAfter = {trigger: box(deleteTrigger), confirm: box(confirmLine)};

  // Register form: species must offer exactly DOG and CAT.
  document.querySelector('.pet-add-button').click();
  const speciesChoices = [...document.querySelectorAll('input[name="pet-species"]')].map(input => input.value);

  // Measure layout before the result sink is filled.
  const scrollWidth = document.documentElement.scrollWidth;
  const clientWidth = document.documentElement.clientWidth;

  document.getElementById('render-result').textContent = JSON.stringify({
    scrollWidth,
    clientWidth,
    cards,
    listText,
    detailTextBeforeReveal,
    maskedRegistration,
    revealedRegistration,
    consentChecked,
    deleteBefore,
    deleteAfter,
    speciesChoices,
    hasConsentCopy: detailTextBeforeReveal.includes('연락처 중개는 하지 않습니다'),
    hasNotice: surface.textContent.includes('공개 자동 매칭과 보호자 알림은 아직 활성화되지 않았습니다'),
  });
</script></body></html>`;
}

// The browser window has a minimum width in headless mode, so an exact
// viewport only comes from a pixel-sized iframe, as the Sidebar gate does.
function outerFixtureHtml(innerName, width, height) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"></head><body style="margin:0">
<iframe id="fixture-frame" title="PET FAMILY viewport fixture" src="/${innerName}" style="display:block;width:${width}px;height:${height}px;border:0"></iframe>
<pre id="render-result"></pre>
<script>
const frame = document.getElementById('fixture-frame');
const out = document.getElementById('render-result');
const deadline = Date.now() + 15000;
const poll = () => {
  const doc = frame.contentDocument;
  const raw = doc && doc.getElementById('render-result') ? doc.getElementById('render-result').textContent : '';
  if (raw && raw.trim()) {
    const parsed = JSON.parse(raw);
    parsed.width = ${width};
    parsed.innerWidth = frame.contentWindow.innerWidth;
    out.textContent = JSON.stringify(parsed);
    return;
  }
  if (Date.now() > deadline) { out.textContent = JSON.stringify({error: 'inner fixture never rendered'}); return; }
  setTimeout(poll, 100);
};
poll();
</script></body></html>`;
}

async function render(width, height) {
  const port = await freePort();
  const innerName = `.pet-family-inner-${process.pid}-${width}.html`;
  const outerName = `.pet-family-outer-${process.pid}-${width}.html`;
  fs.writeFileSync(path.join(ROOT, innerName), innerFixtureHtml(), 'utf8');
  fs.writeFileSync(path.join(ROOT, outerName), outerFixtureHtml(innerName, width, height), 'utf8');
  const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  try {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        const probe = await fetch(`http://127.0.0.1:${port}/${outerName}`);
        if (probe.ok) break;
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    const run = spawnSync(browserPath(), [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
      '--window-size=1600,1100', '--virtual-time-budget=8000', '--dump-dom',
      `http://127.0.0.1:${port}/${outerName}`,
    ], {encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024});
    if (run.error) throw run.error;
    if (run.status !== 0) throw new Error(`headless browser failed (${run.status}): ${run.stderr}`);
    const match = run.stdout.match(/<pre id="render-result">([^<]*)<\/pre>/);
    if (!match || !match[1].trim()) throw new Error(`PET FAMILY render produced no result at ${width}px`);
    const parsed = JSON.parse(match[1].replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>'));
    if (parsed.error) throw new Error(`PET FAMILY render failed at ${width}px: ${parsed.error}`);
    return parsed;
  } finally {
    server.kill();
    fs.rmSync(path.join(ROOT, innerName), {force: true});
    fs.rmSync(path.join(ROOT, outerName), {force: true});
  }
}

const RAW_REGISTRATION = '410000000001234';

// 360px is the narrow phone floor; 768px covers the fold opened; 1280px Desktop.
for (const [label, width, height] of [['mobile-360', 360, 780], ['fold-768', 768, 1024], ['desktop-1280', 1280, 800]]) {
  const result = await render(width, height);
  console.log(`SITE-PET-FAMILY-WEB-01 ${label}`, JSON.stringify(result));

  assert.equal(result.innerWidth, width, `${label}: fixture viewport must be exactly ${width}px`);
  assert.ok(
    result.scrollWidth <= result.clientWidth + 2,
    `${label}: horizontal overflow ${result.scrollWidth}px > ${result.clientWidth}px`,
  );

  assert.equal(result.cards.length, 2, `${label}: expected both pets to render`);
  assert.deepEqual(result.cards.map(card => card.name), ['보리', '나비'], `${label}: pet names did not render`);
  assert.equal(result.cards[0].species, '강아지', `${label}: DOG must read 강아지`);
  assert.equal(result.cards[1].species, '고양이', `${label}: CAT must read 고양이`);
  assert.equal(result.cards[0].progress, '사진 3/10', `${label}: photo completion must show filled/total`);
  assert.equal(result.cards[0].consent, '매칭 동의 안 함', `${label}: NOT_GRANTED must read as not consented`);
  assert.equal(result.cards[1].consent, '매칭 동의함', `${label}: GRANTED must read as consented`);

  assert.ok(!result.listText.includes(RAW_REGISTRATION), `${label}: list must never render the official registration number`);
  assert.ok(!result.listText.includes('PET_KR_'), `${label}: list must not print the raw Pet ID`);

  assert.ok(
    !result.detailTextBeforeReveal.includes(RAW_REGISTRATION),
    `${label}: detail must mask the registration number until the owner reveals it`,
  );
  assert.ok(result.maskedRegistration.includes('•'), `${label}: masked registration must be visibly masked`);
  assert.notEqual(result.maskedRegistration, RAW_REGISTRATION, `${label}: masked registration must differ from the raw value`);
  assert.equal(result.revealedRegistration, RAW_REGISTRATION, `${label}: explicit reveal must show the real number`);
  assert.equal(result.consentChecked, false, `${label}: NOT_GRANTED must render as an unchecked opt-in`);
  assert.ok(result.hasConsentCopy, `${label}: the consent toggle must explain what it covers`);
  assert.ok(result.hasNotice, `${label}: non-assertion notice must render`);

  assert.equal(result.deleteBefore.confirm, 0, `${label}: delete confirmation must be hidden until asked for`);
  assert.ok(result.deleteBefore.trigger > 0, `${label}: delete trigger must be visible`);
  assert.ok(result.deleteAfter.confirm > 0, `${label}: delete confirmation must appear after the first click`);
  assert.equal(result.deleteAfter.trigger, 0, `${label}: delete trigger must be replaced by its confirmation`);
  assert.deepEqual(result.speciesChoices, ['DOG', 'CAT'], `${label}: species choices must be DOG and CAT only`);
}

console.log('SITE-PET-FAMILY-WEB-01 CONTRACT PASS');
