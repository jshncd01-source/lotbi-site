import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {SAFE_SHARE_URL, safeShareSummary, shareToKakao} from '../site-kakao-share.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const conversation = readFileSync(path.join(ROOT, 'site-conversation.js'), 'utf8');
const css = readFileSync(path.join(ROOT, 'site-conversation.css'), 'utf8');

assert.equal(SAFE_SHARE_URL, 'https://lotbiai.com/');
assert.equal(safeShareSummary('답변 https://private.example/?session=abc'), '답변');
assert.doesNotMatch(safeShareSummary('access_token=secret 좋은 장소예요'), /secret/u);
for (const label of ['카카오톡으로 공유', '다른 앱으로 공유', '링크 복사']) assert.ok(conversation.includes(label));
assert.match(conversation, /shareMenu\.setAttribute\('role', 'menu'\)/u);
assert.match(conversation, /kakaoShare\.addEventListener\('click'/u);
assert.match(conversation, /shareToKakao\(value\)[\s\S]*?shareMessageText\(value\)/u);
assert.match(conversation, /writeMessageTextToClipboard\(MESSAGE_ACTION_SHARE_URL\)/u);
assert.match(css, /\.chat-message-share-choice \{[\s\S]*?min-height: 44px/u);

const sent = [];
const Kakao = {
  Share: {sendDefault(payload) { sent.push(payload); }},
  init() { throw new Error('already initialized SDK must not reinitialize'); },
  isInitialized() { return true; },
};
assert.equal(await shareToKakao('아이유의원 안내', {globalRef: {Kakao}, documentRef: {}}), 'kakao');
assert.equal(sent.length, 1);
assert.equal(sent[0].text, '아이유의원 안내');
assert.deepEqual(sent[0].link, {mobileWebUrl: SAFE_SHARE_URL, webUrl: SAFE_SHARE_URL});
assert.ok(!JSON.stringify(sent[0]).includes('session'));

console.log('SITE-KAKAO-SHARE-MENU-01 CONTRACT PASS');
