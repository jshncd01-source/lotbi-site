import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('index.html');
const core = read('site-core.js');
const conversation = read('site-conversation.js');
const ui = read('site-scam-shield.js');

assert.match(html, /LOTBI 안심확인/);
assert.match(html, /“롯비야, 이거 진짜야\?”/);
assert.match(html, /accept="image\/jpeg,image\/png,image\/webp,\.html,\.htm,text\/html,application\/pdf"/);
assert.match(html, /이미 눌렀거나 정보를 입력했어요/);
assert.match(core, /\/v2\/scam-shield\/cases/);
assert.match(core, /untrusted_file_execution !== false/);
assert.match(core, /public_file_upload_to_third_party !== false/);
assert.match(ui, /확인이 더 필요해요/);
assert.doesNotMatch(ui, /안전합니다|안전해요/);
assert.match(conversation, /analyzeScamShield\(sessionToken, detail\.formData\)/);
assert.match(ui, /왜 그렇게 보나요\?/);
assert.match(ui, /아직 확인 안 된 내용/);
assert.match(ui, /지금 할 일/);
console.log('SITE-SCAM-SHIELD-MVP-01 PASS');
