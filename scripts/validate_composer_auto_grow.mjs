import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

const index = read('index.html');
const shell = read('home-shell.js');
const conversation = read('site-conversation.js');
const homeCss = read('home-chat.css');
const hardeningCss = read('site-hardening.css');
const combinedCss = `${homeCss}\n${hardeningCss}`;

// Compact one-line baseline.
assert.match(index, /id="lotbi-prompt"[\s\S]*?rows="1"/);
assert.match(combinedCss, /\.chat-input[\s\S]*?min-height:\s*calc\(1lh\s*\+\s*14px\)/);

// Desktop grows to roughly 12 visible lines, then becomes internally scrollable.
assert.match(combinedCss, /\.chat-input[\s\S]*?max-height:\s*calc\(12lh\s*\+\s*14px\)/);
assert.match(shell, /prompt\.style\.height\s*=\s*'auto'/);
assert.match(shell, /Math\.min\(Math\.max\(prompt\.scrollHeight,\s*minHeight\),\s*maxHeight\)/);
assert.match(shell, /prompt\.style\.overflowY\s*=\s*prompt\.scrollHeight\s*>\s*maxHeight\s*\?\s*'auto'\s*:\s*'hidden'/);

// Mobile keeps the same ~12-line intent but caps against viewport height.
assert.match(hardeningCss, /max-height:\s*min\(calc\(12lh\s*\+\s*12px\),\s*40vh\)/);
assert.match(hardeningCss, /max-height:\s*min\(calc\(12lh\s*\+\s*12px\),\s*40dvh\)/);

// All user-edit paths that change rendered content resync height.
assert.match(shell, /prompt\.addEventListener\('input',\s*resizePrompt\)/);
assert.match(shell, /prompt\.addEventListener\('compositionend',\s*resizePrompt\)/);
assert.match(shell, /window\.addEventListener\('resize',\s*resizePrompt\)/);
assert.match(shell, /resizePrompt\(\)/);

// Programmatic changes from voice and submit must re-enter the same input path.
assert.match(conversation, /prompt\.value\s*=\s*current\s*\?\s*`\$\{current\} \$\{transcript\}`\s*:\s*transcript;[\s\S]*?prompt\.dispatchEvent\(new Event\('input'/);
assert.match(conversation, /prompt\.value\s*=\s*'';[\s\S]*?prompt\.dispatchEvent\(new Event\('input'/);

// Buttons remain a stable right-bottom column and never overlap textarea text.
assert.match(combinedCss, /\.chat-composer[\s\S]*?grid-template-columns:\s*1fr\s+auto/);
assert.match(combinedCss, /\.composer-actions[\s\S]*?align-self:\s*end/);
assert.match(combinedCss, /\.chat-input[\s\S]*?padding:[^;]+;/);

console.log('SITE-COMPOSER-AUTO-GROW-01 CONTRACT PASS');
