import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const index = fs.readFileSync('index.html', 'utf8');
const cssFiles = [
  'styles.css',
  'home-chat.css',
  'site-hardening.css',
  'site-avatar.css',
  'site-sidebar-nav.css',
  'site-auth-continuity.css',
  'site-calendar.css',
  'footer-business-info.css',
  'mobile-entry.css',
  'home-bare-white.css',
  'site-conversation.css',
];
const css = cssFiles.map(file => `/* ${file} */\n${fs.readFileSync(file, 'utf8')}`).join('\n\n');

function browserPath() {
  const candidates = [
    process.env.CHROME_BIN,
    'google-chrome-stable',
    'google-chrome',
    'chromium',
    'chromium-browser',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.includes('/') && fs.existsSync(candidate)) return candidate;
    const found = spawnSync('which', [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required for Bare White Home render validation.');
}

const bodyMatch = index.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
if (!bodyMatch) throw new Error('index.html body markup not found');
// The review fixture is rendered from a local file. Convert root-relative
// image sources to repo-relative sources so the official logo/mascot pixels
// load exactly as they do from the Site origin.
const bodyMarkup = bodyMatch[1].replaceAll('src="/', 'src="');
const escapedCss = css.replaceAll('</style>', '<\\/style>');
const baseHref = pathToFileURL(path.resolve('.') + path.sep).href;
const evidenceDir = process.env.BARE_WHITE_EVIDENCE_DIR
  ? path.resolve(process.env.BARE_WHITE_EVIDENCE_DIR)
  : fs.mkdtempSync(path.join(os.tmpdir(), 'lotbi-bare-white-home-'));
fs.mkdirSync(evidenceDir, {recursive: true});
const browser = browserPath();

function innerDocument() {
  return `<!doctype html><html lang="ko"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<base href="${baseHref}">
<style>${escapedCss}</style>
</head><body class="chat-home-page" data-conversation-restore="ready">${bodyMarkup}</body></html>`;
}

function outerFixture(width, height) {
  const inner = JSON.stringify(innerDocument());
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<style>html,body{margin:0;background:#fff;overflow:hidden}iframe{display:block;border:0;width:${width}px;height:${height}px}</style>
</head><body>
<iframe id="home-frame" title="LOTBI Bare White Home exact viewport"></iframe>
<pre id="bare-white-render-result" hidden></pre>
<script>
const frame = document.getElementById('home-frame');
const doc = frame.contentDocument;
doc.open(); doc.write(${inner}); doc.close();
const win = frame.contentWindow;
setTimeout(() => {
  const body = doc.body;
  const root = doc.documentElement;
  const sidebar = doc.querySelector('.chat-sidebar-desktop');
  const drawer = doc.querySelector('.mobile-nav-drawer');
  const shell = doc.querySelector('.chat-home-shell');
  const hero = doc.querySelector('.chat-hero');
  const avatar = doc.querySelector('.chat-character-wrap');
  const composer = doc.querySelector('.chat-composer');
  const primary = doc.querySelector('.nav-item-primary');
  const responseGrade = doc.querySelector('[data-response-grade-control]');
  const safety = doc.querySelector('.chat-safety-copy');
  if (!sidebar || !drawer || !shell || !hero || !avatar || !composer || !primary || !responseGrade || !safety) {
    throw new Error('Bare White Home fixture contract incomplete');
  }
  const style = node => win.getComputedStyle(node);
  const rect = node => {
    const value = node.getBoundingClientRect();
    return {left:value.left,right:value.right,top:value.top,bottom:value.bottom,width:value.width,height:value.height};
  };
  document.getElementById('bare-white-render-result').textContent = JSON.stringify({
    viewport: {width:win.innerWidth,height:win.innerHeight,clientWidth:root.clientWidth,scrollWidth:root.scrollWidth},
    body: {background:style(body).backgroundColor,color:style(body).color},
    shell: {background:style(shell).backgroundColor,rect:rect(shell)},
    sidebar: {
      display:style(sidebar).display,
      background:style(sidebar).backgroundColor,
      boxShadow:style(sidebar).boxShadow,
      borderRightWidth:style(sidebar).borderRightWidth,
    },
    drawer: {
      display:style(drawer).display,
      background:style(drawer).backgroundColor,
      boxShadow:style(drawer).boxShadow,
    },
    hero: {rect:rect(hero)},
    avatar: {rect:rect(avatar),overflow:style(avatar).overflow},
    composer: {
      rect:rect(composer),
      background:style(composer).backgroundColor,
      borderWidth:style(composer).borderWidth,
      borderColor:style(composer).borderColor,
      borderRadius:style(composer).borderRadius,
      boxShadow:style(composer).boxShadow,
    },
    primary: {
      background:style(primary).backgroundColor,
      boxShadow:style(primary).boxShadow,
      borderRadius:style(primary).borderRadius,
    },
    safety: {color:style(safety).color,fontSize:style(safety).fontSize},
    responseGrade: {hidden:responseGrade.hidden,display:style(responseGrade).display},
  });
}, 80);
</script></body></html>`;
}

function decodeHtml(value) {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function render(label, width, height) {
  const fixturePath = path.resolve(`.bare-white-home-review-${process.pid}-${label}.html`);
  fs.writeFileSync(fixturePath, outerFixture(width, height), 'utf8');
  const url = pathToFileURL(fixturePath).href;
  // Headless Chrome enforces a 500px minimum top-level width. The iframe is
  // the authoritative CSS viewport, so mobile media queries still run at the
  // exact requested 390/412px widths.
  const outerWidth = Math.max(width, 500);
  const outerHeight = height + 100;
  const common = [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--force-device-scale-factor=1',
    `--window-size=${outerWidth},${outerHeight}`,
    '--virtual-time-budget=1200',
  ];
  try {
    const dump = spawnSync(browser, [...common, '--dump-dom', url], {
      encoding:'utf8', timeout:30000, maxBuffer:16 * 1024 * 1024,
    });
    if (dump.error) throw dump.error;
    if (dump.status !== 0) throw new Error(`${label}: browser dump failed (${dump.status}): ${dump.stderr}`);
    const match = dump.stdout.match(/<pre id="bare-white-render-result" hidden="">([^<]+)<\/pre>/)
      || dump.stdout.match(/<pre id="bare-white-render-result"[^>]*>([^<]+)<\/pre>/);
    if (!match) throw new Error(`${label}: render result not found`);
    const result = JSON.parse(decodeHtml(match[1]));

    const screenshot = path.join(evidenceDir, `${label}.png`);
    const shot = spawnSync(browser, [...common, `--screenshot=${screenshot}`, url], {
      encoding:'utf8', timeout:30000, maxBuffer:4 * 1024 * 1024,
    });
    if (shot.error) throw shot.error;
    if (shot.status !== 0 || !fs.existsSync(screenshot) || fs.statSync(screenshot).size === 0) {
      throw new Error(`${label}: screenshot failed (${shot.status}): ${shot.stderr}`);
    }
    return result;
  } finally {
    fs.rmSync(fixturePath, {force:true});
  }
}

function assertWhite(label, value) {
  if (value !== 'rgb(255, 255, 255)') throw new Error(`${label}: expected white, got ${value}`);
}

function assertCase(label, result, width, height) {
  const tolerance = 3;
  if (Math.abs(result.viewport.width - width) > tolerance || Math.abs(result.viewport.height - height) > tolerance) {
    throw new Error(`${label}: exact iframe viewport mismatch ${result.viewport.width}x${result.viewport.height}`);
  }
  if (result.viewport.scrollWidth > result.viewport.clientWidth + tolerance) {
    throw new Error(`${label}: horizontal overflow ${result.viewport.scrollWidth} > ${result.viewport.clientWidth}`);
  }
  assertWhite(`${label} body`, result.body.background);
  assertWhite(`${label} main`, result.shell.background);
  assertWhite(`${label} sidebar`, result.sidebar.background);
  assertWhite(`${label} drawer`, result.drawer.background);
  assertWhite(`${label} composer`, result.composer.background);
  if (result.sidebar.boxShadow !== 'none') throw new Error(`${label}: desktop Sidebar shadow must be none`);
  if (result.composer.boxShadow !== 'none') throw new Error(`${label}: Home composer shadow must be none`);
  if (result.composer.borderWidth !== '1px') throw new Error(`${label}: Home composer border must stay thin`);
  if (result.primary.boxShadow !== 'none') throw new Error(`${label}: New Chat must not use card shadow`);
  if (!['rgba(0, 0, 0, 0)', 'transparent'].includes(result.primary.background)) {
    throw new Error(`${label}: New Chat base must be transparent, got ${result.primary.background}`);
  }
  if (!result.responseGrade.hidden || result.responseGrade.display !== 'none') {
    throw new Error(`${label}: Response Grade must remain hidden/inert`);
  }
  if (result.composer.rect.left < -tolerance || result.composer.rect.right > width + tolerance) {
    throw new Error(`${label}: composer leaves viewport`);
  }
  if (result.avatar.rect.left < -tolerance || result.avatar.rect.right > width + tolerance) {
    throw new Error(`${label}: mascot anchor leaves viewport`);
  }
  if (width <= 430 && result.composer.rect.width > width - 20 + tolerance) {
    throw new Error(`${label}: mobile composer is too wide (${result.composer.rect.width})`);
  }
}

const cases = [
  ['web-desktop-1280', 1280, 800],
  ['web-desktop-1440', 1440, 900],
  ['web-mobile-390', 390, 844],
  ['web-mobile-412', 412, 915],
];

const results = {};
for (const [label, width, height] of cases) {
  const result = render(label, width, height);
  assertCase(label, result, width, height);
  results[label] = result;
  console.log('LOTBI BARE WHITE HOME RENDER', label, JSON.stringify(result));
}
fs.writeFileSync(path.join(evidenceDir, 'render-results.json'), JSON.stringify(results, null, 2));
console.log('LOTBI BARE WHITE HOME RENDER PASS');
console.log('EVIDENCE_DIR=' + evidenceDir);
