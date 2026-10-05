import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', {value: webcrypto});

const calls = [];
const fetchImpl = async (url, options = {}) => {
  calls.push({url, options});
  if (options.method === 'POST') {
    return new Response(JSON.stringify({person: {
      person_id: 'per_0123456789abcdef0123456789abcdef', display_name: '김롯비',
      relationship: 'FAMILY', state: 'ACTIVE', revision: 1, has_photo: false,
    }, idempotent_replay: false}), {status: 201, headers: {'Content-Type': 'application/json'}});
  }
  if (options.method === 'DELETE') return new Response(null, {status: 204});
  return new Response(JSON.stringify({people: []}), {status: 200, headers: {'Content-Type': 'application/json'}});
};

const {createPersonProfile, deletePersonProfile, listPersonProfiles} = await import('../site-person.js');
assert.deepEqual(await listPersonProfiles('session-token', fetchImpl), []);
const person = await createPersonProfile('session-token', {
  display_name: '김롯비', relationship: 'FAMILY', nickname: null,
  birthday_month: null, birthday_day: null,
}, fetchImpl);
assert.equal(person.display_name, '김롯비');
assert.match(calls[1].options.headers['Idempotency-Key'], /^prq_[0-9]{13}_[0-9a-f]{32}$/);
assert.equal(calls[1].options.credentials, 'omit');
await deletePersonProfile('session-token', person.person_id, 1, fetchImpl);
assert.match(calls[2].url, /expected_revision=1$/);

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const sections = read('site-consumer-sections.js');
const conversation = read('site-conversation.js');
const ui = read('site-person-ui.js');
const css = read('site-person.css');
const index = read('index.html');
assert.match(sections, /mountPeople/);
assert.doesNotMatch(sections, /사람 등록과 SOS의 웹 연결은 준비 중/);
assert.match(conversation, /site-person-ui\.js/);
assert.match(ui, /사람과 반려동물은 같은 안심케어 한도/);
assert.match(ui, /image\/jpeg,image\/png,image\/webp/);
assert.match(css, /\.person-primary/);
assert.match(css, /min-height: 44px/);
assert.match(index, /site-person\.css\?v=aset-/);
console.log('SAFECARE_PEOPLE_01 PASS — live Person CRUD entry, privacy copy and responsive controls');
