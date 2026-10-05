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

const {createPerson, deletePerson, listPeople} = await import('../site-person.js');
assert.deepEqual(await listPeople('session-token', fetchImpl), []);
const person = await createPerson('session-token', {
  displayName: '김롯비', relationship: 'FAMILY', nickname: null,
  birthYear: 2017, birthMonth: 5,
}, fetchImpl);
assert.equal(person.displayName, '김롯비');
assert.match(calls[1].options.headers['Idempotency-Key'], /^site\.person\.create\./);
assert.equal(calls[1].options.credentials, 'omit');
await deletePerson('session-token', {personId: person.personId, revision: 1}, fetchImpl);
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
assert.match(ui, /출생 연·월로 갱신 주기를 계산/);
assert.match(ui, /활성 SOS 기간 동안만/);
assert.match(ui, /등록된 사람/);
assert.match(ui, /사진 갱신/);
assert.match(ui, /실종 상태로 전환/);
assert.match(ui, /발견 제보/);
assert.match(ui, /Promise\.allSettled/);
assert.match(ui, /사람 등록과 사진 관리는 사용할 수 있습니다/);
assert.match(ui, /missingAction\.disabled = !availability\.sos/);
assert.doesNotMatch(ui, /SOS \/ 실종 신고/);
assert.match(ui, /image\/jpeg,image\/png,image\/webp/);
assert.match(css, /\.person-primary/);
assert.match(css, /min-height:\s*44px/);
assert.match(index, /site-person\.css\?v=aset-/);
console.log('SAFECARE_PEOPLE_01 PASS — live Person CRUD entry, privacy copy and responsive controls');
