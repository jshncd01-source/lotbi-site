import assert from 'node:assert/strict';
import fs, {readFileSync} from 'node:fs';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

const index = read('index.html');
const shell = read('home-shell.js');
const conversation = read('site-conversation.js');
const homeCss = read('home-chat.css');
const hardeningCss = read('site-hardening.css');
const conversationCss = read('site-conversation.css');
const combinedCss = `${homeCss}\n${hardeningCss}\n${conversationCss}`;

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

// SITE-COMPOSER-HORIZONTAL-FIT-01: textarea owns the full content row and
// action controls move to a separate bottom row instead of consuming text width.
assert.match(hardeningCss, /\.chat-composer\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/);
assert.match(hardeningCss, /\.chat-composer\s*\{[\s\S]*?grid-template-rows:\s*auto\s+auto/);
assert.match(hardeningCss, /\.chat-composer\s*\{[\s\S]*?column-gap:\s*0/);
assert.match(hardeningCss, /\.chat-input\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1/);
assert.match(hardeningCss, /\.chat-input\s*\{[\s\S]*?width:\s*100%/);
assert.match(hardeningCss, /\.chat-input\s*\{[\s\S]*?min-width:\s*0/);
assert.match(hardeningCss, /\.composer-actions\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1/);
assert.match(hardeningCss, /\.composer-actions\s*\{[\s\S]*?justify-self:\s*end/);

// Buttons remain a stable right-bottom control row and never overlap textarea text.
assert.match(combinedCss, /\.composer-button[\s\S]*?min-width:\s*44px/);
assert.match(combinedCss, /\.composer-button[\s\S]*?min-height:\s*44px/);
assert.match(hardeningCss, /\.chat-input\s*\{[\s\S]*?padding:[^;]+;/);
assert.doesNotMatch(hardeningCss, /white-space:\s*nowrap/);
assert.doesNotMatch(hardeningCss, /overflow-x:\s*(?:auto|scroll)/);

function browserPath() {
  for (const candidate of [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (candidate.includes('/') && fs.existsSync(candidate)) return candidate;
    const found = spawnSync('which', [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required for composer auto-grow runtime validation.');
}

function runtimeProbe(width, height, lineCount, {collapse = false} = {}) {
  const value = Array.from({length: lineCount}, (_, index) => `줄 ${index + 1}`).join('\n');
  const css = combinedCss.replaceAll('</style>', '<\\/style>');
  const markup = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head>
<body class="chat-home-page"><div class="chat-app-shell"><main class="chat-home-shell"><section class="chat-hero">
<div class="chat-composer"><textarea id="lotbi-prompt" class="chat-input" rows="1"></textarea><div class="composer-actions"><button class="composer-button mic-button">M</button><button class="composer-button send-button">S</button></div></div>
</section></main></div><pre id="r"></pre>
<script>
const p=document.getElementById('lotbi-prompt');
const resizePrompt=()=>{
  p.style.height='auto';
  const styles=getComputedStyle(p);
  const minHeight=Number.parseFloat(styles.minHeight)||40;
  const maxHeight=Number.parseFloat(styles.maxHeight)||320;
  const nextHeight=Math.min(Math.max(p.scrollHeight,minHeight),maxHeight);
  p.style.height=nextHeight+'px';
  p.style.overflowY=p.scrollHeight>maxHeight?'auto':'hidden';
};
p.addEventListener('input',resizePrompt);
p.value=${JSON.stringify(value)};
resizePrompt();
if(${collapse}){p.value='';p.dispatchEvent(new Event('input',{bubbles:true}));}
const composer=document.querySelector('.chat-composer').getBoundingClientRect();
const hero=document.querySelector('.chat-hero').getBoundingClientRect();
const rect=p.getBoundingClientRect();
document.getElementById('r').textContent=JSON.stringify({
  height:rect.height,
  scrollHeight:p.scrollHeight,
  overflowY:getComputedStyle(p).overflowY,
  composerWidth:composer.width,
  heroWidth:hero.width
});
<\/script></body></html>`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lotbi-composer-grow-'));
  const file = path.join(tmp, 'fixture.html');
  fs.writeFileSync(file, markup);
  const run = spawnSync(browserPath(), ['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',`--window-size=${width},${height}`,'--virtual-time-budget=300','--dump-dom',`file://${file}`], {encoding:'utf8', timeout:30000, maxBuffer:8*1024*1024});
  fs.rmSync(tmp,{recursive:true,force:true});
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(run.stderr || `browser failed: ${run.status}`);
  const match = run.stdout.match(/<pre id="r">([^<]+)<\/pre>/);
  if (!match) throw new Error(`composer auto-grow runtime result missing: ${run.stdout.slice(-800)}`);
  return JSON.parse(match[1].replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>'));
}

for (const [label,width,height] of [['desktop',1280,900],['mobile',390,844]]) {
  const one = runtimeProbe(width,height,1);
  const three = runtimeProbe(width,height,3);
  const six = runtimeProbe(width,height,6);
  const twelve = runtimeProbe(width,height,12);
  const thirteen = runtimeProbe(width,height,13);
  const collapsed = runtimeProbe(width,height,13,{collapse:true});
  console.log(label, JSON.stringify({one,three,six,twelve,thirteen,collapsed}));

  assert.ok(one.height < three.height && three.height < six.height && six.height < twelve.height, `${label}: textarea must grow naturally from 1→3→6→12 lines`);
  assert.ok(Math.abs(thirteen.height - twelve.height) <= 2, `${label}: 13th line must not grow beyond the 12-line cap`);
  assert.equal(thirteen.overflowY, 'auto', `${label}: overflow after max height must become internal scroll`);
  assert.equal(one.overflowY, 'hidden', `${label}: one-line composer must not show a scrollbar`);
  assert.ok(Math.abs(collapsed.height - one.height) <= 2, `${label}: programmatic clear/submit must collapse back to one line`);
  if (label === 'mobile') {
    assert.ok(one.composerWidth >= one.heroWidth - 2, 'mobile composer must fill the available content width');
  }
}

await import('./validate_composer_desktop_width_02.mjs');

console.log('SITE-COMPOSER-AUTO-GROW-01 + HORIZONTAL-FIT CONTRACT PASS');
