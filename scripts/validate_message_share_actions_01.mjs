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
const messageBody = read('site-message-body.js');
const css = read('site-conversation.css');

// The row is built by the approved conversation module, not by a new page script.
// The sealed script list belongs to validate_hardening.py — counting tags here
// only breaks when main lands an approved inline script, which it does. What
// this row owns is that message actions pulled in no third-party script origin
// (a Kakao SDK tag would be exactly that), and that the sealed gate still runs.
assert.doesNotMatch(index, /<script[^>]*\bsrc\s*=\s*["']\s*(?:https?:)?\/\//i, 'the home page must not load a script from another origin');
assert.ok(read('.github/workflows/legal-pages-review.yml').includes('scripts/validate_hardening.py'), 'the sealed-script gate must stay in required CI');
assert.match(index, /<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/);

// Ordinary LOTBI answers keep the approved message action row. A reusable-output
// answer does not duplicate copy/share on its short lead-in because the result
// card owns current-variant copy/share/edit actions instead.
assert.match(conversation, /if \(message\.role === 'assistant' && !reusableOutput\) \{\s*\n\s*const actions = createMessageActions\(message\.text, setStatus, \{\s*\n\s*calendarDraft: calendarDraftHintFromMessage\(message, place\),\s*\n\s*openCalendarDraft: draft => openCalendar\(draft\?\.localDate \? 'month' : 'agenda', \{initialDraft: draft, restoreConversation: true\}\),\s*\n\s*\}\);/);
assert.match(conversation, /if \(actions\) node\.appendChild\(actions\);/);
assert.match(conversation, /const reusableOutput = message\.role === 'assistant' \? message\.meta\?\.reusableOutput : null;/);
assert.match(conversation, /const actions = document\.createElement\('div'\);/);
assert.match(conversation, /actions\.className = 'chat-message-actions'/);
assert.match(conversation, /actions\.setAttribute\('role', 'group'\)/);
assert.match(conversation, /actions\.setAttribute\('aria-label', 'LOTBI 답변 도구'\)/);

// An empty answer gets no row rather than a row that copies nothing.
assert.match(conversation, /const value = typeof text === 'string' \? text\.trim\(\) : '';\s*\n\s*if \(!value\) return undefined;/);

// Both controls are real buttons with a Korean accessible name and an icon —
// drawn, not an emoji glyph, so they stay legible in Dark and forced-colors.
assert.match(conversation, /createIconButton\(\{className: 'chat-message-action', label: '복사하기', iconPath: MESSAGE_ACTION_ICON_COPY, dataset: \{messageAction: 'copy'\}\}\)/);
assert.match(conversation, /createIconButton\(\{className: 'chat-message-action', label: '공유하기', iconPath: MESSAGE_ACTION_ICON_SHARE, dataset: \{messageAction: 'share'\}\}\)/);

// CHATPERF-08 — the footer's fourth action is a Calendar launcher, not a
// writer: it always shares the plain '.chat-message-action' styling (no
// dedicated colour, unlike the primary "등록" button elsewhere) and it opens
// the existing editor dialog rather than calling a register/save function.
assert.match(conversation, /createIconButton\(\{className: 'chat-message-action', label: '캘린더에 추가', iconPath: MESSAGE_ACTION_ICON_CALENDAR, dataset: \{messageAction: 'calendar'\}\}\)/);
assert.match(conversation, /calendar\.addEventListener\('click', \(\) => \{\s*\n\s*if \(typeof openCalendarDraft !== 'function'\) return;\s*\n\s*void openCalendarDraft\(calendarDraft\)/);
assert.match(conversation, /actions\.append\(copy, share, speak, calendar, feedback\);/);
assert.match(conversation, /actions\.append\(copy, share, calendar, feedback\);/);
// The launcher never calls a register/write function directly.
assert.ok(!/calendar\.addEventListener\('click'[\s\S]{0,400}registerCalendarDraft/.test(conversation), 'the footer Calendar action must never register a draft itself');

// The pre-fill helper may only reuse fields the message already carries — a
// settled calendarDraft, or a place result's name/address — and must never
// invent a date the message never stated.
assert.match(conversation, /function calendarDraftHintFromMessage\(message, place\) \{/);
assert.match(conversation, /const draft = message\?\.meta\?\.calendarDraft;/);
assert.match(conversation, /const primaryPlace = place\?\.results\?\.\[0\];/);
const calendarHintHelperSource = conversation.match(/function calendarDraftHintFromMessage\([\s\S]*?\n\}/)?.[0] || '';
assert.ok(calendarHintHelperSource, 'calendarDraftHintFromMessage source must be found');
assert.ok(!calendarHintHelperSource.includes('new Date('), 'the calendar hint helper must never synthesize a date');
assert.match(conversation, /import \{createIconButton, createSafeMessageBody, enhanceExpandableUserMessage\} from '\.\/site-message-body\.js\?v=([^']+)';/);
// The icon builder lives with the other message-node builders. The conversation
// runtime must stay free of any http:// literal — validate_rich_product_cards_01
// enforces that, and an SVG namespace URL there would silently weaken it.
assert.ok(!conversation.includes('http://'), 'conversation runtime must carry no http:// literal');
assert.match(messageBody, /export function createIconButton\(\{className, label, iconPath, dataset = \{\}\}\)/);
assert.match(messageBody, /button\.type = 'button'/);
assert.match(messageBody, /button\.setAttribute\('aria-label', label\)/);
assert.match(messageBody, /button\.title = label/);
assert.match(messageBody, /createElementNS\(SVG_NS, 'svg'\)/);
assert.match(messageBody, /svg\.setAttribute\('aria-hidden', 'true'\)/);
// Node by node, never a parsed markup string.
assert.ok(!messageBody.includes('innerHTML'), 'message node builders must never inject HTML');

// The import query and the page's module query move together, or a cached
// site-message-body.js hands the new runtime a missing createIconButton.
const bodyImportVersion = conversation.match(/site-message-body\.js\?v=([^']+)'/)?.[1] || '';
const pageConversationVersion = index.match(/src="site-conversation\.js\?v=([^"]+)"/)?.[1] || '';
assert.ok(bodyImportVersion, 'the message-body import must stay cache-busted');
assert.equal(bodyImportVersion, pageConversationVersion, 'message-body and conversation cache-bust tokens must match');

// Copy prefers the async clipboard and still works where it is missing.
assert.match(conversation, /navigator\.clipboard\.writeText\(text\)/);
assert.match(conversation, /document\.execCommand\('copy'\)/);
assert.match(conversation, /report\('답변을 복사했습니다\.'\)/);
assert.match(conversation, /report\('복사하지 못했습니다[^']*', 'error'\)/);

// Share must enter the helper synchronously from the click handler. The helper
// calls navigator.share before its first await completes, preserving the mobile
// user gesture; unsupported/failed sheets fall back to canonical clipboard text.
assert.match(conversation, /async function shareMessageText\(text, \{includeUrl = true\} = \{\}\)/);
assert.match(conversation, /if \(typeof navigator\.share === 'function'\) \{[\s\S]*?await navigator\.share\(shareData\);/);
assert.match(conversation, /share\.addEventListener\('click', \(\) => \{[\s\S]*?void shareMessageText\(value\)/);
// A cancelled sheet is not a failure and must not fall back to copying.
assert.match(conversation, /if \(error && error\.name === 'AbortError'\) return 'cancelled';/);
assert.match(conversation, /await writeMessageTextToClipboard\(includeUrl \? `\$\{value\}\\n\\n\$\{MESSAGE_ACTION_SHARE_URL\}` : value\)/);
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
