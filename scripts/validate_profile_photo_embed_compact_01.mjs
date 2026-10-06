import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css = readFileSync(new URL('../site-conversation.css', import.meta.url), 'utf8');

assert.match(css, /html\[data-profile-photo-embed="true"\] \.site-modal \{[\s\S]*?border: 0;[\s\S]*?box-shadow: none;/);
assert.match(css, /html\[data-profile-photo-embed="true"\] \.site-modal-content \{[\s\S]*?grid-template-columns: 72px minmax\(0, 1fr\);/);
assert.match(css, /html\[data-profile-photo-embed="true"\] \.profile-photo-preview \{[\s\S]*?width: 72px;[\s\S]*?height: 72px;/);

console.log('SITE-PROFILE-PHOTO-EMBED-COMPACT-01 PASS');
