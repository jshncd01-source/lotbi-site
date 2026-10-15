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

// Text chat remains the stable public DOM contract while public voice is
// excluded from the initial release.
assert.doesNotMatch(index, /class="composer-button mic-button"/);
assert.doesNotMatch(index, /data-wake-toggle/);
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

// Internal voice code remains available for a future release, but no public
// control may bind it in this release.
assert.match(conversation, /const PUBLIC_SITE_VOICE_RELEASE_ENABLED = false/);
assert.match(conversation, /if \(PUBLIC_SITE_VOICE_RELEASE_ENABLED && micButton instanceof HTMLButtonElement\)/);
assert.doesNotMatch(conversation, /window\.addEventListener\('lotbi:voice-transcription-request'/);

// Composer actions remain touchable and have visibly distinct disabled/active/focus/press/listening states.
assert.match(combinedCss, /\.composer-button[\s\S]*min-width:\s*44px/);
assert.match(combinedCss, /\.composer-button[\s\S]*min-height:\s*44px/);
assert.match(combinedCss, /\.send-button:not\(:disabled\)/);
assert.match(combinedCss, /linear-gradient\([^)]*var\(--brand-pink\)[^)]*var\(--brand-violet\)[^)]*var\(--brand-blue\)/);
assert.match(combinedCss, /\.composer-button:focus-visible/);
assert.match(combinedCss, /\.composer-button:active/);

// No interaction style may introduce an overlay above the composer.
assert.doesNotMatch(conversationCss, /\.chat-composer[^}]*pointer-events:\s*none/);

console.log('SITE-COMPOSER-UX-CLICK-01 CONTRACT PASS');
