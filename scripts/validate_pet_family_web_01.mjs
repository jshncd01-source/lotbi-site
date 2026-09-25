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
import {pathToFileURL} from 'node:url';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const index = read('index.html');
const petClient = read('site-pet.js');
const petUi = read('site-pet-ui.js');
const petCss = read('site-pet.css');
const petGuides = read('site-pet-guides.js');
const conversation = read('site-conversation.js');
const petGate = read('site-pet-gate.js');

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
assert.ok(
  petClient.includes("PET_MATCHING_CONSENT_VERSION = 'PET_MATCHING_CONSENT_2026_09_V2'"),
  'matching consent version must match Core V2',
);
for (const route of [
  '/v2/pet-catalog',
  '/v2/pet-registration-drafts',
  '/finalize',
]) {
  assert.ok(petClient.includes(route), `V2 registration client route missing: ${route}`);
}
assert.ok(
  !/registerPet\(sessionToken/.test(petUi),
  'the UI must not allocate a stable Pet before the photo-first draft is finalized',
);
assert.ok(
  petUi.includes("['pets', '내 반려동물'")
    && petUi.includes("['sos', '실종 신고'")
    && petUi.includes("['found', '발견 제보'"),
  'Pet Home must expose three separate entry cards',
);

// ----------------------------------------------------------- photo uploader

// Every slot must carry its own schematic and hint; a slot without guidance is
// the failure mode this feature exists to avoid.
for (const code of CORE_SLOT_CODES) {
  assert.ok(petGuides.includes(`${code}: {`), `slot ${code} has no shooting guide`);
}
assert.ok(
  petClient.includes("petPhotoRejection") && petClient.includes('JPG 또는 PNG'),
  'uploads must be pre-checked locally against Core type and size limits',
);
assert.ok(
  !petClient.includes("headers['Content-Type'] = 'multipart"),
  'multipart uploads must let the browser set the boundary',
);
assert.ok(
  petUi.includes('URL.revokeObjectURL') || petClient.includes('URL.revokeObjectURL'),
  'photo object URLs must be revoked',
);
assert.ok(
  conversation.includes('releasePetSurface'),
  'closing the panel must release the cached photo object URLs',
);

// --------------------------------------------------------------- SOS cases

assert.ok(
  conversation.includes('renderPetSosBadge') && conversation.includes('data-pet-sos-count'),
  'the sidebar SOS badge must be driven by the counted cases',
);
assert.ok(
  petUi.includes("'USER_ENTERED'") || petClient.includes("location_source: 'USER_ENTERED'"),
  'a typed place must be reported as user-entered, never as GPS-verified',
);
assert.ok(
  petUi.includes('붙잡아 사진을 찍지 마세요'),
  'the found report must warn against approaching the animal',
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

// Core answers in English for operators. The screen must not repeat it: the
// 대표 saw "Session is restricted to the LOTBI Site audience" verbatim when a
// pet request was refused. The code still has to be findable, so it rides on
// the error element rather than in the sentence.
assert.ok(
  !petClient.includes("detail.message === 'string' && detail.message ? detail.message : fallback"),
  "Core's English detail.message must not be shown to the user",
);
assert.ok(
  petClient.includes('const PET_ERROR_MESSAGES = Object.freeze({'),
  'pet errors must be mapped to Korean by code',
);
for (const code of [
  'SESSION_AUDIENCE_RESTRICTED',
  'SESSION_EXPIRED',
  'PET_NAME_INVALID',
  'PET_PHOTO_TYPE_NOT_ALLOWED',
  'PET_IDEMPOTENCY_CONFLICT',
]) {
  assert.ok(
    new RegExp(`${code}:\\s*'[^']*[가-힣]`).test(petClient),
    `${code} needs a Korean message`,
  );
}
assert.ok(
  petUi.includes('error.dataset.petErrorCode = code'),
  'the Core error code must stay findable on the error element',
);
assert.ok(
  !/'[^']*[A-Za-z]{4,}[^']*'\s*:\s*'[^']*Session is restricted/.test(petClient),
  'no English Core sentence may be reused as user copy',
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
assert.match(
  petCss,
  /\.pet-section\[hidden\][\s\S]*?display:\s*none/,
  'Pet Home sections must honor the hidden state when a different tab is active',
);
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
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (/\\/v2\\/pet-catalog$/.test(target)) {
      return new Response(JSON.stringify({
        breeds: {
          DOG: [{code: 'JINDO', display_name: '진돗개', species: 'DOG'}],
          CAT: [{code: 'KOREAN_SHORTHAIR', display_name: '코리안숏헤어', species: 'CAT'}],
        },
        colors: [{code: 'WHITE', display_name: '흰색'}],
        patterns: [{code: 'SOLID', display_name: '단색', species: null}],
      }), {status: 200, headers: {'Content-Type': 'application/json'}});
    }
    if (/\\/v2\\/pet-registration-drafts\\/active$/.test(target)) {
      return new Response(JSON.stringify({draft: null}), {status: 200, headers: {'Content-Type': 'application/json'}});
    }
    if (/\\/v2\\/pet-registration-drafts$/.test(target) && options.method === 'POST') {
      return new Response(JSON.stringify({draft: {
        draft_id: 'pdraft_eeeeeeeeeeeeeeeeeeee',
        status: 'ACTIVE', current_step: 'PHOTOS', revision: 1,
        matching_consent_state: 'NOT_GRANTED', photos: [],
      }}), {status: 200, headers: {'Content-Type': 'application/json'}});
    }
    if (/\\/v2\\/pet-registration-drafts\\/pdraft_eeeeeeeeeeeeeeeeeeee$/.test(target) && options.method === 'PATCH') {
      const update = JSON.parse(options.body || '{}');
      return new Response(JSON.stringify({draft: {
        draft_id: 'pdraft_eeeeeeeeeeeeeeeeeeee',
        status: 'ACTIVE', current_step: update.current_step || 'PHOTOS', revision: 2,
        species: update.species || 'DOG', matching_consent_state: 'NOT_GRANTED', photos: [],
      }}), {status: 200, headers: {'Content-Type': 'application/json'}});
    }
    if (/\\/content$/.test(target)) {
      // 1x1 PNG, enough to prove the bytes become a blob: preview.
      const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
      return new Response(png, {status: 200, headers: {'Content-Type': 'image/png'}});
    }
    if (/\\/v2\\/pets\\/[^/]+\\/photos$/.test(target)) {
      const filled = target.includes('AAAA')
        ? [{slot_code: 'NOSE_FRONT'}, {slot_code: 'NOSE_LEFT'}, {slot_code: 'FACE_FRONT'}]
        : [];
      return new Response(JSON.stringify({photos: filled, manifest: {slot_count: filled.length, state: 'UPLOAD_INCOMPLETE', manifest_version: 1}}), {status: 200, headers: {'Content-Type': 'application/json'}});
    }
    if (/\\/v2\\/pets\\/sos$/.test(target)) {
      return new Response(JSON.stringify({cases: [{
        sos_case_id: 'psos_cccccccccccccccccccc',
        pet_id: 'PET_KR_AAAAAAAAAAAAAAAAAAAA',
        last_seen_location: {label: '망원한강공원'},
        last_seen_at: '2026-09-21T09:30:00Z',
        note: '파란 목줄',
        status: 'ACTIVE',
      }]}), {status: 200, headers: {'Content-Type': 'application/json'}});
    }
    if (/\\/v2\\/pets\\/found\\/[^/]+\\/photos$/.test(target)) {
      return new Response(JSON.stringify({photos: [{slot_index: 1}]}), {status: 200, headers: {'Content-Type': 'application/json'}});
    }
    if (/\\/v2\\/pets\\/found$/.test(target)) {
      return new Response(JSON.stringify({cases: [{
        found_case_id: 'pfound_dddddddddddddddddddd',
        species: 'CAT',
        found_location: {label: '정자동 느티마을'},
        found_at: '2026-09-22T02:10:00Z',
        description: '회색 줄무늬',
        status: 'ACTIVE',
      }]}), {status: 200, headers: {'Content-Type': 'application/json'}});
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

  // Photo uploader: 10 tiles, schematics on empty slots, blob previews on
  // filled ones, and a progress line naming what is left.
  await new Promise(resolve => setTimeout(resolve, 400));
  const slotGrid = detail.querySelector('[data-pet-slot-grid]');
  const slots = [...slotGrid.querySelectorAll('[data-pet-slot]')].map(tile => ({
    code: tile.dataset.petSlot,
    filled: tile.dataset.petSlotFilled,
    label: tile.querySelector('.pet-slot-label').textContent,
    hint: tile.querySelector('.pet-slot-hint').textContent,
    hasDiagram: Boolean(tile.querySelector('.pet-slot-diagram')),
    previewSrc: tile.querySelector('.pet-slot-photo')?.getAttribute('src')?.slice(0, 5) || '',
    stuckLoading: Boolean(tile.querySelector('.pet-slot-loading')),
    accept: tile.querySelector('input[type="file"]').getAttribute('accept'),
  }));
  const photoCount = detail.querySelector('.pet-photo-count').textContent;
  const progressNote = detail.querySelector('.pet-photo-progress-note').textContent;

  // 실종 SOS / 발견 신고 sections.
  const sosSection = document.querySelector('[data-pet-sos]');
  const foundSection = document.querySelector('[data-pet-found]');
  const cases = {
    sos: [...sosSection.querySelectorAll('[data-pet-case]')].map(card => ({
      status: card.dataset.petCaseStatus,
      text: card.textContent,
      hasResolve: Boolean(card.querySelector('[data-pet-case-resolve]')),
      hasCancel: Boolean(card.querySelector('[data-pet-case-cancel]')),
    })),
    found: [...foundSection.querySelectorAll('[data-pet-case]')].map(card => ({
      status: card.dataset.petCaseStatus,
      text: card.textContent,
      photoCount: card.querySelector('.pet-case-photo-count')?.textContent || '',
    })),
    safety: foundSection.querySelector('.pet-case-safety')?.textContent || '',
    sosFormOpensFor: (() => {
      sosSection.querySelector('[data-pet-sos-new]').click();
      return Boolean(sosSection.querySelector('[data-pet-sos-form]'));
    })(),
    foundFormOpensFor: (() => {
      foundSection.querySelector('[data-pet-found-new]').click();
      return Boolean(foundSection.querySelector('[data-pet-found-form]'));
    })(),
  };

  const homeCards = [...document.querySelectorAll('[data-pet-home-target]')].map(button => ({
    target: button.dataset.petHomeTarget,
    title: button.querySelector('.pet-home-card-title').textContent,
  }));
  const homeButtons = new Map(
    [...document.querySelectorAll('[data-pet-home-target]')]
      .map(button => [button.dataset.petHomeTarget, button]),
  );
  const listSection = list.closest('.pet-section');
  const tabState = target => {
    homeButtons.get(target).click();
    return {
      active: [...homeButtons.values()]
        .find(button => button.dataset.petHomeActive === 'true')?.dataset.petHomeTarget || '',
      pets: box(listSection),
      register: box(document.querySelector('.pet-add-button')),
      sos: box(sosSection),
      sosAction: box(sosSection.querySelector('[data-pet-sos-new]')),
      found: box(foundSection),
      foundAction: box(foundSection.querySelector('[data-pet-found-new]')),
    };
  };
  const homeTabs = {
    pets: tabState('pets'),
    sos: tabState('sos'),
    found: tabState('found'),
  };
  homeButtons.get('pets').click();

  // Registration begins by choosing one supported species. Only that
  // animal's ten private photo guides appear; no stable Pet ID exists yet.
  document.querySelector('.pet-add-button').click();
  await new Promise(resolve => setTimeout(resolve, 100));
  const draftSlotsBeforeSpecies = [...document.querySelectorAll('[data-pet-draft-slot]')].length;
  const speciesChoices = [...document.querySelectorAll('input[name="pet-species"]')].map(input => input.value);
  document.querySelector('input[name="pet-species"][value="DOG"]').click();
  await new Promise(resolve => setTimeout(resolve, 100));
  const draftSlots = [...document.querySelectorAll('[data-pet-draft-slot]')].map(tile => tile.dataset.petDraftSlot);
  const registrationProgress = document.querySelector('.pet-draft-progress-label')?.textContent || '';
  const registrationSteps = [...document.querySelectorAll('.pet-draft-step')].map(item => ({
    number: item.querySelector('.pet-draft-step-number')?.textContent || '',
    name: item.querySelector('.pet-draft-step-name')?.textContent || '',
    active: item.dataset.petDraftStepActive,
  }));
  const registrationActionWhileOpen = box(document.querySelector('.pet-add-button'));
  const speciesMarks = [...document.querySelectorAll('.pet-slot-species-mark')].map(item => item.textContent);
  const rearSpecies = document.querySelector('[data-pet-rear-species]')?.dataset.petRearSpecies || '';
  const rearImage = document.querySelector('[data-pet-rear-species] image')?.getAttribute('href') || '';

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
    slots,
    cases,
    photoCount,
    progressNote,
    deleteBefore,
    deleteAfter,
    homeCards,
    homeTabs,
    draftSlots,
    draftSlotsBeforeSpecies,
    speciesChoices,
    registrationProgress,
    registrationSteps,
    registrationActionWhileOpen,
    speciesMarks,
    rearSpecies,
    rearImage,
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

  assert.equal(result.slots.length, 10, `${label}: all ten photo slots must render`);
  assert.deepEqual(
    result.slots.map(slot => slot.code),
    ['NOSE_FRONT', 'NOSE_LEFT', 'NOSE_RIGHT', 'FACE_FRONT', 'FACE_LEFT', 'FACE_RIGHT',
      'BODY_LEFT', 'BODY_RIGHT', 'BACK_REAR', 'DISTINCTIVE'],
    `${label}: photo slots must render in Core's order`,
  );
  for (const slot of result.slots) {
    assert.ok(slot.hint.length > 0, `${label}: slot ${slot.code} has no shooting hint`);
    assert.equal(slot.accept, 'image/jpeg,image/png', `${label}: slot ${slot.code} accepts the wrong types`);
    assert.ok(!slot.stuckLoading, `${label}: slot ${slot.code} is stuck on a loading label`);
    if (slot.filled === 'true') {
      assert.equal(slot.previewSrc, 'blob:', `${label}: filled slot ${slot.code} must preview from a blob, not a URL`);
    } else {
      assert.ok(slot.hasDiagram, `${label}: empty slot ${slot.code} must show its shooting schematic`);
    }
  }
  assert.equal(result.photoCount, '3/10', `${label}: photo progress must count filled slots`);
  assert.match(result.progressNote, /^7장 남았습니다/, `${label}: progress note must name what is left`);

  assert.equal(result.cases.sos.length, 1, `${label}: the active SOS case must render`);
  assert.equal(result.cases.sos[0].status, 'ACTIVE', `${label}: SOS status must render`);
  assert.ok(result.cases.sos[0].text.includes('망원한강공원'), `${label}: SOS last-seen place must render`);
  assert.ok(result.cases.sos[0].hasResolve && result.cases.sos[0].hasCancel,
    `${label}: an active SOS case must offer both ways to close it`);
  assert.equal(result.cases.found.length, 1, `${label}: the active found case must render`);
  assert.ok(result.cases.found[0].text.includes('고양이'), `${label}: found species must render in Korean`);
  assert.equal(result.cases.found[0].photoCount, '첨부 사진 1/10', `${label}: found photo count must render`);
  assert.ok(result.cases.safety.includes('붙잡아 사진을 찍지 마세요'),
    `${label}: the found report must keep its safety warning`);
  assert.ok(result.cases.sosFormOpensFor, `${label}: the SOS form must open`);
  assert.ok(result.cases.foundFormOpensFor, `${label}: the found report form must open`);

  assert.equal(result.deleteBefore.confirm, 0, `${label}: delete confirmation must be hidden until asked for`);
  assert.ok(result.deleteBefore.trigger > 0, `${label}: delete trigger must be visible`);
  assert.ok(result.deleteAfter.confirm > 0, `${label}: delete confirmation must appear after the first click`);
  assert.equal(result.deleteAfter.trigger, 0, `${label}: delete trigger must be replaced by its confirmation`);
  assert.deepEqual(
    result.homeCards,
    [
      {target: 'pets', title: '내 반려동물'},
      {target: 'sos', title: '실종 신고'},
      {target: 'found', title: '발견 제보'},
    ],
    `${label}: Pet Home must show the three separate surfaces`,
  );
  assert.equal(result.homeTabs.pets.active, 'pets', `${label}: pets tab must become active`);
  assert.ok(result.homeTabs.pets.pets > 0 && result.homeTabs.pets.register > 0,
    `${label}: pets tab must show the pet list and registration action`);
  assert.equal(result.homeTabs.pets.sos, 0, `${label}: pets tab must hide the SOS surface`);
  assert.equal(result.homeTabs.pets.found, 0, `${label}: pets tab must hide the found surface`);

  assert.equal(result.homeTabs.sos.active, 'sos', `${label}: SOS tab must become active`);
  assert.equal(result.homeTabs.sos.pets, 0, `${label}: SOS tab must hide the pet list`);
  assert.ok(result.homeTabs.sos.sos > 0 && result.homeTabs.sos.sosAction > 0,
    `${label}: SOS tab must show only the SOS surface and action`);
  assert.equal(result.homeTabs.sos.found, 0, `${label}: SOS tab must hide the found surface`);

  assert.equal(result.homeTabs.found.active, 'found', `${label}: found tab must become active`);
  assert.equal(result.homeTabs.found.pets, 0, `${label}: found tab must hide the pet list`);
  assert.equal(result.homeTabs.found.sos, 0, `${label}: found tab must hide the SOS surface`);
  assert.ok(result.homeTabs.found.found > 0 && result.homeTabs.found.foundAction > 0,
    `${label}: found tab must show only the found surface and action`);
  assert.deepEqual(result.draftSlots, CORE_SLOT_CODES, `${label}: registration must begin with all ten photo slots`);
  assert.equal(result.draftSlotsBeforeSpecies, 0, `${label}: photo slots must wait for one species selection`);
  assert.deepEqual(result.speciesChoices, ['DOG', 'CAT'], `${label}: the first step must offer dog or cat before photos`);
  assert.equal(result.registrationProgress, '반려동물 등록 1단계 / 4단계',
    `${label}: registration must identify the current numbered step`);
  assert.deepEqual(result.registrationSteps.map(step => step.name), ['사진', '기본 정보', '추가 정보', '검토'],
    `${label}: registration must show the four steps in order`);
  assert.deepEqual(result.registrationSteps.map(step => step.number), ['1', '2', '3', '4'],
    `${label}: registration steps must be numbered`);
  assert.equal(result.registrationSteps[0].active, 'true', `${label}: photo step must be active first`);
  assert.equal(result.registrationActionWhileOpen, 0,
    `${label}: the list-level registration/resume action must disappear while its form is open`);
  assert.ok(result.speciesMarks.length > 0 && result.speciesMarks.every(mark => ['🐶', '🐕'].includes(mark)),
    `${label}: DOG selection must show only dog photo guides`);
  assert.equal(result.rearSpecies, 'DOG', `${label}: rear slot must use the selected dog's back-facing guide`);
  assert.equal(result.rearImage, '/assets/pet/dog-rear-v1.png',
    `${label}: slot 9 must use only the selected dog's color rear-view artwork`);
}

console.log('SITE-PET-FAMILY-WEB-01 CONTRACT PASS');

// ---------------------------------------------------- 유료 게이트 (A안)
// 스위치는 꺼진 채로 배포됩니다. 결제가 TEST 환경이라 지금 켜면 대표 계정을
// 포함해 전원이 막힙니다. 이 단정이 실수로 켜진 채 나가는 것을 막습니다.
assert.ok(
  /export const PET_GATE_ENFORCED = false;/.test(petGate),
  'the paid gate must ship with its switch off',
);
assert.ok(
  petGate.includes('export const PET_REGISTRATION_ALWAYS_ALLOWED = true;'),
  'registration must never be gated',
);

const gateModule = await import(`${pathToFileURL(path.join(ROOT, 'site-pet-gate.js')).href}`);
const {petFeatureState, petGateNotice, petNavLockLabel} = gateModule;

// 스위치가 꺼져 있으면 아무도 막히지 않습니다.
for (const subscription of [
  {plan: 'FREE', entitled: false},
  {plan: 'PRO', entitled: true},
  undefined,
  null,
]) {
  assert.strictEqual(
    petFeatureState(subscription).locked,
    false,
    'nothing may be locked while the switch is off',
  );
}

// 구독을 못 읽으면 여는 쪽으로 갑니다. 조회 장애가 결제한 사용자의 기능을
// 끄면 안 됩니다.
for (const unreadable of [undefined, null, {}, {plan: 'PRO'}, {entitled: 'yes'}]) {
  const state = petFeatureState(unreadable, {enforced: true});
  assert.strictEqual(state.entitled, true, 'an unreadable subscription must fail open');
  assert.strictEqual(state.locked, false, 'an unreadable subscription must never lock');
}

// 스위치를 켜면 Core 구독 상태가 단일 출처입니다.
assert.strictEqual(petFeatureState({plan: 'FREE', entitled: false}, {enforced: true}).locked, true);
assert.strictEqual(petFeatureState({plan: 'PRO', entitled: true}, {enforced: true}).locked, false);

// 안내 문구는 현재 상태에 맞아야 합니다. 차단이 꺼져 있는데 "유료 회원만 쓸
// 수 있습니다" 라고 하면 거짓말입니다.
const openNotice = petGateNotice(petFeatureState(undefined));
assert.ok(/지금은 모든 회원이 사용할 수 있/.test(openNotice.body), 'the open notice must not claim the feature is paid-only');
const lockedNotice = petGateNotice(petFeatureState({entitled: false}, {enforced: true}));
assert.ok(/그대로 보관/.test(lockedNotice.body), 'the locked notice must say the data is kept');
assert.ok(!/삭제|사라집니다/.test(lockedNotice.body), 'the locked notice must not suggest data loss');
assert.strictEqual(petNavLockLabel(petFeatureState(undefined)), '', 'no lock label while the switch is off');

// 사이드바 항목을 제거하거나 못 누르게 만들지 않습니다 — 눌렀을 때 아무 일도
// 안 일어나면 고장으로 보입니다.
assert.ok(
  !/\[data-pet-family-open\][^\n]*\.disabled = true/.test(conversation),
  'the sidebar entry must stay clickable when locked',
);
assert.ok(
  conversation.includes("nav.dataset.petLocked = locked ? 'true' : 'false'"),
  'the sidebar must mark its locked state',
);

console.log('SITE-PET-FAMILY-WEB-01 gate: switch OFF, fail-open, registration always allowed');

// ------------------------------------------------- 번호 체계 (롯비 vs 국가)
// 번호가 두 가지인데 화면에서 섞이면 사용자는 국가 등록을 마쳤다고 오해하고,
// 그 상태로 동물병원이나 지자체에 가면 통하지 않습니다.
assert.ok(
  petClient.includes("export const LOTBI_PET_NUMBER_LABEL = '롯비 반려동물 번호';"),
  'our own number must be named as ours',
);
assert.ok(
  petClient.includes("export const OFFICIAL_REGISTRATION_LABEL = '국가 동물등록번호';"),
  'the national number must be named as the national one',
);
assert.ok(
  petUi.includes('${OFFICIAL_REGISTRATION_LABEL} (선택)'),
  'the national registration field must be marked optional',
);
assert.ok(
  /롯비가 발급하지 않습니다/.test(petUi),
  'the form must say LOTBI does not issue the national number',
);
assert.ok(
  /국가 동물등록번호를 대신하지 않습니다/.test(petUi),
  'the LOTBI number must say it does not replace the national one',
);

const numbers = await import(`${pathToFileURL(path.join(ROOT, 'site-pet.js')).href}`);
assert.strictEqual(
  numbers.lotbiPetNumber('PET_KR_0123456789ABCDEF0123'),
  'PET-KR 0123 4567 89AB CDEF 0123',
  'the LOTBI number must be grouped so a person can read it aloud',
);
// 형식이 다르면 원문을 그대로 둡니다. 없는 번호를 지어내지 않습니다.
assert.strictEqual(numbers.lotbiPetNumber('nonsense'), 'nonsense');
assert.strictEqual(numbers.lotbiPetNumber(''), '');
assert.strictEqual(numbers.lotbiPetNumber(undefined), '');

console.log('SITE-PET-FAMILY-WEB-01 numbers: LOTBI number named and readable, national number optional');

// ------------------------------------------------------ 표기 (법적 주의)
// 경쟁사가 해당 방식으로 특허를 보유하고 있어, 대표 지시로 그 용어를 화면과
// 저장소 기록 양쪽에서 쓰지 않습니다. 주석도 저장소에 남는 기록입니다.
//
// 내부 슬롯 코드 NOSE_FRONT / NOSE_LEFT / NOSE_RIGHT 는 그대로 둡니다. 이미
// 저장된 사진이 이 코드로 묶여 있어 바꾸면 기존 데이터가 끊깁니다. 용어가
// 아니고 사용자에게 보이지도 않습니다.
const FORBIDDEN_TERM = ['비', '문'].join('');
for (const [name, source] of [
  ['site-pet-guides.js', read('site-pet-guides.js')],
  ['site-pet.js', petClient],
  ['site-pet-ui.js', petUi],
  ['site-pet.css', petCss],
]) {
  assert.ok(!source.includes(FORBIDDEN_TERM), `${name} must not use the term`);
}
assert.ok(
  read('site-pet-guides.js').includes("label: '코 정면',"),
  'the nose slots must be labelled 코',
);
for (const code of ['NOSE_FRONT', 'NOSE_LEFT', 'NOSE_RIGHT']) {
  assert.ok(petClient.includes(code), `${code} must stay — stored photos are keyed by it`);
}

console.log('SITE-PET-FAMILY-WEB-01 wording: 코 labels, internal slot codes intact');
