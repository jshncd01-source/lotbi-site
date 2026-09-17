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

// The mic must be a real interactive control, never permanently disabled in markup.
assert.match(index, /class="composer-button mic-button"/);
assert.doesNotMatch(index, /class="composer-button mic-button"[^>]*\sdisabled(?:\s|>)/);
assert.match(index, /aria-label="음성 입력"/);

// Send has one explicit submit path; JS owns enabled/disabled state from input + in-flight state.
assert.match(index, /<form[^>]*class="chat-composer"/);
assert.match(index, /class="composer-button send-button"[^>]*type="submit"/);
assert.match(conversation, /composerForm\.addEventListener\('submit'/);
assert.match(conversation, /sendButton\.disabled\s*=\s*inFlight\s*\|\|\s*prompt\.value\.trim\(\)\.length\s*===\s*0/);
assert.match(conversation, /event\.key\s*===\s*'Enter'/);
assert.match(conversation, /!event\.shiftKey/);

// Voice input is progressive enhancement: supported browsers request mic permission and start recognition;
// unsupported/denied states must return visible status instead of a dead button.
assert.match(conversation, /\.mic-button/);
assert.match(conversation, /micButton\.addEventListener\('click'/);
assert.match(conversation, /navigator\.mediaDevices\.getUserMedia/);
assert.match(conversation, /SpeechRecognition|webkitSpeechRecognition/);
assert.match(conversation, /ko-KR/);
assert.match(conversation, /aria-pressed/);
assert.match(conversation, /음성 입력을 지원하지 않는 브라우저|마이크 권한/);

// Composer actions must remain touchable and have visibly distinct states.
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
