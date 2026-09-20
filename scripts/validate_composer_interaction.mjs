import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

const index = read('index.html');
const conversation = read('site-conversation.js');
const homeCss = read('home-chat.css');
const conversationCss = read('site-conversation.css');
const combinedCss = `${homeCss}\n${conversationCss}`;

// Existing composer controls remain the stable public DOM contract.
assert.match(index, /class="composer-button mic-button"/);
assert.match(index, /class="composer-button send-button"/);
assert.match(index, /id="lotbi-prompt"/);

// Send owns a click path, input-driven enablement, Korean IME completion refresh,
// Enter submit, Shift+Enter newline, and in-flight duplicate protection.
assert.match(conversation, /sendButton\.addEventListener\('click'/);
assert.match(conversation, /const hasContent = prompt\.value\.trim\(\)\.length > 0 \|\| selectedAttachments\.length > 0/);
assert.match(conversation, /sendButton\.disabled = inFlight \|\| attachmentBusy \|\| !hasContent/);
assert.match(conversation, /prompt\.addEventListener\('input'/);
assert.match(conversation, /prompt\.addEventListener\('compositionend'/);
assert.match(conversation, /event\.key\s*===\s*'Enter'/);
assert.match(conversation, /!event\.shiftKey/);
assert.match(conversation, /if \(inFlight \|\| attachmentUploadsInFlight\) return/);
assert.match(conversation, /if \(!message && !selectedAttachments\.length\) return/);

// Voice input is progressive enhancement: the mounted runtime unlocks the mic,
// supported browsers request permission and start recognition, unsupported/denied
// states return user feedback instead of a dead control.
assert.match(conversation, /\.mic-button/);
assert.match(conversation, /micButton\.disabled\s*=\s*false/);
assert.match(conversation, /micButton\.addEventListener\('click'/);
assert.match(conversation, /navigator\.mediaDevices\.getUserMedia/);
assert.match(conversation, /SpeechRecognition|webkitSpeechRecognition/);
assert.match(conversation, /ko-KR/);
assert.match(conversation, /aria-pressed/);
assert.match(conversation, /음성 입력을 지원하지 않는 브라우저|마이크 권한/);
assert.match(conversation, /prompt\.dispatchEvent\(new Event\('input'/);

// Composer actions remain touchable and have visibly distinct disabled/active/focus/press/listening states.
assert.match(combinedCss, /\.composer-button[\s\S]*min-width:\s*44px/);
assert.match(combinedCss, /\.composer-button[\s\S]*min-height:\s*44px/);
assert.match(combinedCss, /\.send-button:not\(:disabled\)/);
assert.match(combinedCss, /linear-gradient\([^)]*var\(--brand-pink\)[^)]*var\(--brand-violet\)[^)]*var\(--brand-blue\)/);
assert.match(combinedCss, /\.composer-button:focus-visible/);
assert.match(combinedCss, /\.composer-button:active/);
assert.match(combinedCss, /\.mic-button\[data-listening="true"\]/);

// No interaction style may introduce an overlay above the composer.
assert.doesNotMatch(conversationCss, /\.chat-composer[^}]*pointer-events:\s*none/);

console.log('SITE-COMPOSER-UX-CLICK-01 CONTRACT PASS');
