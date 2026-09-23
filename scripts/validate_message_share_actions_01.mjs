// SITE-MESSAGE-SHARE-ACTIONS-01
// Every LOTBI answer carries an icon row: 복사하기 and 공유하기.
// Copy stays local to the browser. Share goes through the OS share sheet, so
// KakaoTalk is reachable without a Kakao app key or a registered JavaScript SDK
// domain, and desktop browsers — which have no sheet — fall back to copying.
// 소리내어 읽기 is intentionally not in this row yet: Core's /v2/live/tts is not
// reachable from a Site session, and a permanently dead button is worse than none.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

const index = read('index.html');
const conversation = read('site-conversation.js');
const css = read('site-conversation.css');

// The row is built by the approved conversation module, not by a new page script.
assert.equal(index.toLowerCase().split('<script').length - 1, 6, 'the home page must not gain a script tag for message actions');
assert.match(index, /<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/);

// Only LOTBI answers get the row, and it is appended after the answer's cards.
assert.match(conversation, /if \(message\.role === 'assistant'\) \{\s*\n\s*const actions = createMessageActions\(message\.text, setStatus\);/);
assert.match(conversation, /if \(actions\) node\.appendChild\(actions\);/);
assert.match(conversation, /const actions = document\.createElement\('div'\);/);
assert.match(conversation, /actions\.className = 'chat-message-actions'/);
assert.match(conversation, /actions\.setAttribute\('role', 'group'\)/);
assert.match(conversation, /actions\.setAttribute\('aria-label', 'LOTBI 답변 도구'\)/);

// An empty answer gets no row rather than a row that copies nothing.
assert.match(conversation, /const value = typeof text === 'string' \? text\.trim\(\) : '';\s*\n\s*if \(!value\) return undefined;/);

// Both controls are real buttons with a Korean accessible name and an icon —
// drawn, not an emoji glyph, so they stay legible in Dark and forced-colors.
assert.match(conversation, /createMessageActionButton\('copy', '복사하기', MESSAGE_ACTION_ICON_COPY\)/);
assert.match(conversation, /createMessageActionButton\('share', '공유하기', MESSAGE_ACTION_ICON_SHARE\)/);
assert.match(conversation, /button\.type = 'button'/);
assert.match(conversation, /button\.setAttribute\('aria-label', label\)/);
assert.match(conversation, /button\.title = label/);
assert.match(conversation, /createElementNS\('http:\/\/www\.w3\.org\/2000\/svg', 'svg'\)/);
assert.match(conversation, /svg\.setAttribute\('aria-hidden', 'true'\)/);

// Copy prefers the async clipboard and still works where it is missing.
assert.match(conversation, /navigator\.clipboard\.writeText\(text\)/);
assert.match(conversation, /document\.execCommand\('copy'\)/);
assert.match(conversation, /report\('답변을 복사했습니다\.'\)/);
assert.match(conversation, /report\('복사하지 못했습니다[^']*', 'error'\)/);

// Share must open the OS sheet from inside the click; an await first spends the
// user gesture and the sheet never opens.
assert.match(conversation, /if \(typeof navigator\.share !== 'function'\) \{ void shareByClipboard\(\); return; \}/);
assert.match(conversation, /navigator\.share\(\{title: 'LOTBI', text: value, url: MESSAGE_ACTION_SHARE_URL\}\)/);
assert.doesNotMatch(conversation, /await [^\n;]*;\s*\n?\s*navigator\.share\(/);
// A cancelled sheet is not a failure and must not fall back to copying.
assert.match(conversation, /if \(error && error\.name === 'AbortError'\) return;/);
assert.match(conversation, /await writeMessageTextToClipboard\(`\$\{value\}\\n\\n\$\{MESSAGE_ACTION_SHARE_URL\}`\)/);
assert.match(conversation, /const MESSAGE_ACTION_SHARE_URL = 'https:\/\/lotbiai\.com\/';/);

// No Kakao SDK, app key or third-party origin rides in with this row.
for (const forbidden of ['kakaocdn.net', 'Kakao.init', 'Kakao.Share', 'javascriptKey', 'sharer.kakao.com']) {
  assert.ok(!conversation.toLowerCase().includes(forbidden.toLowerCase()), `message actions must not embed ${forbidden}`);
}

// Result and failure are announced, not silent.
assert.match(conversation, /feedback\.setAttribute\('role', 'status'\)/);
assert.match(conversation, /feedback\.setAttribute\('aria-live', 'polite'\)/);
assert.match(conversation, /if \(typeof announce === 'function'\) announce\(message\);/);

// The row keeps the composer's touch contract and stays visible in every theme.
assert.match(css, /\.chat-message-action \{[\s\S]*?min-width: 44px/);
assert.match(css, /\.chat-message-action \{[\s\S]*?min-height: 44px/);
assert.match(css, /\.chat-message-action:focus-visible \{/);
assert.match(css, /\.chat-message-action:active \{/);
assert.match(css, /\.chat-message-action svg \{[\s\S]*?fill: currentColor/);
assert.match(css, /\.chat-message-action \{[\s\S]*?color: var\(--lotbi-text-muted/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.chat-message-action \{[\s\S]*?transition: none/);
assert.match(css, /@media \(forced-colors: active\) \{[\s\S]*?\.chat-message-action \{[\s\S]*?border: 1px solid ButtonBorder/);

console.log('SITE-MESSAGE-SHARE-ACTIONS-01 CONTRACT PASS');
