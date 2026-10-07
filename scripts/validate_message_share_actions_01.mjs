// SITE-MESSAGE-SHARE-ACTIONS-02 — answer tools always expose Link Copy and add
// KakaoTalk only after explicit Share readiness, with no copy fallback.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

const index = read('index.html');
const conversation = read('site-conversation.js');
const kakao = read('site-kakao-share.js');
const messageBody = read('site-message-body.js');
const css = read('site-conversation.css');

assert.doesNotMatch(index, /<script[^>]*\bsrc\s*=\s*["']\s*(?:https?:)?\/\//i, 'the home page must not load a third-party script eagerly');
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

// Every control is a real button with a Korean accessible name and a drawn
// icon, so it stays legible in Dark and forced-colors.
assert.match(conversation, /createIconButton\(\{className: 'chat-message-action', label: '복사하기', iconPath: MESSAGE_ACTION_ICON_COPY, dataset: \{messageAction: 'copy'\}\}\)/);
assert.match(conversation, /createIconButton\(\{className: 'chat-message-action', label: '공유하기', iconPath: MESSAGE_ACTION_ICON_SHARE, dataset: \{messageAction: 'share'\}\}\)/);
assert.match(conversation, /createIconButton\(\{className: 'chat-message-action', label: '캘린더에 추가', iconPath: MESSAGE_ACTION_ICON_CALENDAR, dataset: \{messageAction: 'calendar'\}\}\)/);
assert.match(conversation, /actions\.append\(copy, share, calendar, feedback, shareMenu\);/);

// CHATPERF-08 — the Calendar action is a launcher, not a writer: it opens the
// existing editor dialog and never registers a draft itself.
assert.match(conversation, /calendar\.addEventListener\('click', \(\) => \{\s*\n\s*if \(typeof openCalendarDraft !== 'function'\) return;\s*\n\s*void openCalendarDraft\(calendarDraft\)/);
assert.ok(!/calendar\.addEventListener\('click'[\s\S]{0,400}registerCalendarDraft/.test(conversation), 'the footer Calendar action must never register a draft itself');

// The pre-fill helper may only reuse fields the message already carries and
// must never invent a date the message never stated.
assert.match(conversation, /function calendarDraftHintFromMessage\(message, place\) \{/);
assert.match(conversation, /const draft = message\?\.meta\?\.calendarDraft;/);
assert.match(conversation, /const primaryPlace = place\?\.results\?\.\[0\];/);
const calendarHintHelperSource = conversation.match(/function calendarDraftHintFromMessage\([\s\S]*?\n\}/)?.[0] || '';
assert.ok(calendarHintHelperSource, 'calendarDraftHintFromMessage source must be found');
assert.ok(!calendarHintHelperSource.includes('new Date('), 'the calendar hint helper must never synthesize a date');
assert.match(conversation, /import \{createIconButton, createSafeMessageBody, enhanceExpandableUserMessage\} from '\.\/site-message-body\.js\?v=([^']+)';/);
// The conversation runtime must stay free of any http:// literal —
// validate_rich_product_cards_01 enforces that too.
assert.ok(!conversation.includes('http://'), 'conversation runtime must carry no http:// literal');

assert.doesNotMatch(conversation, /navigator\.share\s*\(/, 'generic OS share sheet must not be used');
assert.match(conversation, /share\.setAttribute\('aria-haspopup', 'menu'\)/);
assert.match(conversation, /shareMenu\.setAttribute\('role', 'menu'\)/);
assert.match(conversation, /shareMenu\.setAttribute\('aria-label', '공유 방법'\)/);
assert.match(conversation, /document\.addEventListener\('pointerdown', onOutsideShareMenu\)/);
assert.match(conversation, /event\.key === 'Escape'/);
assert.match(conversation, /\['ArrowDown', 'ArrowUp', 'Home', 'End'\]/);

const menuItems = [...conversation.matchAll(/createShareMenuItem\('([^']+)'[^\n]+, '([^']+)'\)/g)]
  .map(match => [match[1], match[2]]);
assert.deepEqual(menuItems, [
  ['링크 복사', 'link-copy'],
  ['카카오톡 공유하기', 'kakaotalk'],
]);
assert.match(conversation, /writeMessageTextToClipboard\(MESSAGE_ACTION_SHARE_URL\)/);
assert.match(conversation, /report\('링크를 복사했습니다\.'\)/);
assert.match(conversation, /shareMessageWithKakao\(\{text: value, url: MESSAGE_ACTION_SHARE_URL\}\)/);
assert.match(conversation, /report\('카카오톡 공유 화면을 열었습니다\.'\)/);
assert.match(conversation, /shareMenu\.append\(linkCopy\);/);
assert.match(conversation, /if \(ready\)[\s\S]*shareMenu\.append\(kakao\)/);
assert.doesNotMatch(conversation, /카카오톡에 붙여넣어 공유해 주세요/);

assert.doesNotMatch(conversation, /createReadAloudController|READ_ALOUD_STATE|speechSynthesis|SpeechSynthesisUtterance/);
assert.doesNotMatch(conversation, /messageAction: 'speak'|읽어주기|읽기 멈추기/);

assert.match(conversation, /const \{shareWithKakaoTalk\} = await import\('\.\/site-kakao-share\.js\?v=([^']+)'\)/);
assert.match(kakao, /Kakao\.Share\.sendDefault/);
assert.match(kakao, /objectType: 'text'/);
assert.match(kakao, /mobileWebUrl: url, webUrl: url/);
assert.match(kakao, /kakao_javascript_key/);
assert.match(kakao, /kakao_share_ready/);
assert.doesNotMatch(kakao, /kakao_navi_ready/);
assert.doesNotMatch(kakao, /copyFallback|KAKAO_SHARE_COPY_FAILED|return 'copied'/);
assert.doesNotMatch(kakao, /console\.|localStorage|sessionStorage|document\.cookie|authorization/i);
// The Kakao SDK, its key and its origin live only in the lazily imported
// share module; the conversation runtime itself never embeds them.
for (const forbidden of ['kakaocdn.net', 'Kakao.init', 'Kakao.Share', 'javascriptKey', 'sharer.kakao.com']) {
  assert.ok(!conversation.toLowerCase().includes(forbidden.toLowerCase()), `message actions must not embed ${forbidden}`);
}

// Copy prefers the async clipboard and still works where it is missing.
assert.match(conversation, /navigator\.clipboard\.writeText\(text\)/);
assert.match(conversation, /document\.execCommand\('copy'\)/);
assert.match(conversation, /report\('답변을 복사했습니다\.'\)/);
assert.match(conversation, /report\('복사하지 못했습니다[^']*', 'error'\)/);
assert.match(conversation, /const MESSAGE_ACTION_SHARE_URL = 'https:\/\/lotbiai\.com\/';/);

assert.match(messageBody, /export function createIconButton\(\{className, label, iconPath, dataset = \{\}\}\)/);
assert.match(messageBody, /button\.type = 'button'/);
assert.match(messageBody, /button\.setAttribute\('aria-label', label\)/);
assert.match(messageBody, /button\.title = label/);
assert.match(messageBody, /createElementNS\(SVG_NS, 'svg'\)/);
assert.match(messageBody, /svg\.setAttribute\('aria-hidden', 'true'\)/);
// Node by node, never a parsed markup string.
assert.ok(!messageBody.includes('innerHTML'), 'message node builders must never inject HTML');

// The import queries and the page's module query move together, or a cached
// module hands the new runtime a missing export.
const bodyImportVersion = conversation.match(/site-message-body\.js\?v=([^']+)'/)?.[1] || '';
const kakaoImportVersion = conversation.match(/site-kakao-share\.js\?v=([^']+)'/)?.[1] || '';
const pageConversationVersion = index.match(/src="site-conversation\.js\?v=([^"]+)"/)?.[1] || '';
assert.ok(bodyImportVersion, 'the message-body import must stay cache-busted');
assert.equal(bodyImportVersion, pageConversationVersion, 'message-body and conversation cache-bust tokens must match');
assert.equal(kakaoImportVersion, pageConversationVersion, 'kakao-share and conversation cache-bust tokens must match');

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

assert.match(css, /\.chat-message-actions \{[\s\S]*?position: relative/);
assert.match(css, /\.lotbi-share-menu \{/);
assert.match(css, /\.lotbi-share-menu\[hidden\] \{ display: none; \}/);
assert.match(css, /\.lotbi-share-menu-item:focus-visible/);
assert.match(css, /@media \(max-width: 760px\) \{[\s\S]*?\.lotbi-share-menu \{[\s\S]*?position: fixed/);
assert.match(css, /bottom: max\(12px, env\(safe-area-inset-bottom\)\)/);

console.log('SITE-MESSAGE-SHARE-ACTIONS-02 CONTRACT PASS');
