// SITE-MESSAGE-SHARE-ACTIONS-02 — answer tools expose only link copy and
// KakaoTalk inside the share menu, with no OS share sheet or read-aloud action.
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
assert.match(index, /<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/);

assert.match(conversation, /const actions = document\.createElement\('div'\);/);
assert.match(conversation, /actions\.className = 'chat-message-actions'/);
assert.match(conversation, /actions\.setAttribute\('aria-label', 'LOTBI 답변 도구'\)/);
assert.match(conversation, /createIconButton\(\{className: 'chat-message-action', label: '복사하기'/);
assert.match(conversation, /createIconButton\(\{className: 'chat-message-action', label: '공유하기'/);
assert.match(conversation, /createIconButton\(\{className: 'chat-message-action', label: '캘린더에 추가'/);
assert.match(conversation, /actions\.append\(copy, share, calendar, feedback, shareMenu\);/);

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

assert.doesNotMatch(conversation, /createReadAloudController|READ_ALOUD_STATE|speechSynthesis|SpeechSynthesisUtterance/);
assert.doesNotMatch(conversation, /messageAction: 'speak'|읽어주기|읽기 멈추기/);

assert.match(conversation, /const \{shareWithKakaoTalk\} = await import\('\.\/site-kakao-share\.js\?v=([^']+)'\)/);
assert.match(kakao, /Kakao\.Share\.sendDefault/);
assert.match(kakao, /objectType: 'text'/);
assert.match(kakao, /mobileWebUrl: url, webUrl: url/);
assert.match(kakao, /kakao_javascript_key/);
assert.doesNotMatch(kakao, /console\.|localStorage|sessionStorage|document\.cookie|authorization/i);

assert.match(conversation, /navigator\.clipboard\.writeText\(text\)/);
assert.match(conversation, /document\.execCommand\('copy'\)/);
assert.match(messageBody, /export function createIconButton/);
assert.ok(!messageBody.includes('innerHTML'), 'message node builders must never inject HTML');

const bodyImportVersion = conversation.match(/site-message-body\.js\?v=([^']+)'/)?.[1] || '';
const kakaoImportVersion = conversation.match(/site-kakao-share\.js\?v=([^']+)'/)?.[1] || '';
const pageConversationVersion = index.match(/src="site-conversation\.js\?v=([^"]+)"/)?.[1] || '';
assert.equal(bodyImportVersion, pageConversationVersion);
assert.equal(kakaoImportVersion, pageConversationVersion);

assert.match(css, /\.chat-message-actions \{[\s\S]*?position: relative/);
assert.match(css, /\.lotbi-share-menu \{/);
assert.match(css, /\.lotbi-share-menu\[hidden\] \{ display: none; \}/);
assert.match(css, /\.lotbi-share-menu-item:focus-visible/);
assert.match(css, /@media \(max-width: 760px\) \{[\s\S]*?\.lotbi-share-menu \{[\s\S]*?position: fixed/);
assert.match(css, /bottom: max\(12px, env\(safe-area-inset-bottom\)\)/);

console.log('SITE-MESSAGE-SHARE-ACTIONS-02 CONTRACT PASS');
