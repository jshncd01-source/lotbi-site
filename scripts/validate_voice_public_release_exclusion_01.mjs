import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const conversation = fs.readFileSync(path.join(root, 'site-conversation.js'), 'utf8');

for (const selector of [
  'class="composer-button mic-button"',
  'data-wake-toggle',
  'data-scam-voice',
  'data-scam-voice-start',
  'data-scam-input-panel="voice"',
]) {
  assert.equal(html.includes(selector), false, `public Site must not render ${selector}`);
}
// SCAM-PHISHING-REDESIGN-02 — 사기·피싱 확인 is built in site-scam-shield.js now;
// the same exclusion holds there (LOTBI has no voice input).
const scam = fs.readFileSync(path.join(root, 'site-scam-shield.js'), 'utf8');
for (const marker of ['data-scam-voice', 'scam-voice', 'voice-transcription', '말로 입력', '음성']) {
  assert.equal(scam.includes(marker), false, `사기·피싱 확인 must not offer ${marker}`);
}

assert.match(
  conversation,
  /const PUBLIC_SITE_VOICE_RELEASE_ENABLED = false;/,
  'the public Site voice release gate must default to disabled',
);
assert.match(
  conversation,
  /if \(PUBLIC_SITE_VOICE_RELEASE_ENABLED && micButton instanceof HTMLButtonElement\)/,
  'the composer voice click binding must stay behind the disabled release gate',
);
assert.match(
  conversation,
  /if \(PUBLIC_SITE_VOICE_RELEASE_ENABLED && wakeButton instanceof HTMLButtonElement && wakeListeningSupported\(\)\)/,
  'the wake runtime must stay behind the disabled release gate',
);
assert.equal(
  conversation.includes("window.addEventListener('lotbi:voice-transcription-request'"),
  false,
  'the public Site must not expose a programmatic microphone entry point',
);

console.log('VOICE_PUBLIC_RELEASE_EXCLUSION_01 PASS');
