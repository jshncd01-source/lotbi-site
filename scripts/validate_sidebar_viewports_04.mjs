import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const index = fs.readFileSync('index.html', 'utf8');
const cssFiles = [
  'styles.css',
  'home-chat.css',
  'site-hardening.css',
  'site-sidebar-nav.css',
  'site-auth-continuity.css',
];
const css = cssFiles.map(file => fs.readFileSync(file, 'utf8')).join('\n\n');

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
  throw new Error('Chrome/Chromium is required for Sidebar viewport validation.');
}

function extract(pattern, label) {
  const match = index.match(pattern);
  if (!match) throw new Error(`missing ${label} markup`);
  return match[0];
}

const desktopAside = extract(/<aside class="chat-sidebar chat-sidebar-desktop"[\s\S]*?<\/aside>/, 'desktop sidebar');
const mobileAside = extract(/<aside\s+[\s\S]*?id="mobile-nav-drawer"[\s\S]*?<\/aside>/, 'mobile drawer');

function fixtureMarkup(mode) {
  const escapedCss = css.replaceAll('</style>', '<\\/style>');
  if (mode === 'desktop') {
    return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${escapedCss}</style></head>
<body class="chat-home-page"><div class="chat-app-shell">${desktopAside}<main class="chat-home-shell"></main></div></body></html>`;
  }
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${escapedCss}</style></head>
<body class="chat-home-page nav-drawer-open"><div class="mobile-nav-backdrop" aria-hidden="true"></div>${mobileAside}</body></html>`;
}

const injectedTitles = Array.from({length: 36}, (_, index) =>
  `${index + 1}. LOTBI 최근 대화 제목이 길어져도 사이드바 폭을 깨지 않고 최대 두 줄 안에서 자연스럽게 잘려야 하는 회귀 검증 항목`,
);

function htmlFor(width, height, mode) {
  const markup = JSON.stringify(fixtureMarkup(mode));
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"></head><body>
<iframe id="fixture-frame" title="LOTBI sidebar viewport fixture" style="display:block;width:${width}px;height:${height}px;border:0"></iframe>
<pre id="render-result"></pre>
<script>
const frame = document.getElementById('fixture-frame');
const doc = frame.contentDocument;
doc.open(); doc.write(${markup}); doc.close();
const win = frame.contentWindow;
const recentList = doc.querySelector('[data-recent-conversations]');
for (const title of ${JSON.stringify(injectedTitles)}) {
  const li = doc.createElement('li');
  const link = doc.createElement('a');
  link.href = '#';
  link.dataset.conversationTitle = '';
  link.title = title;
  link.setAttribute('aria-label', title);
  link.textContent = title;
  li.append(link);
  recentList.append(li);
}
const surface = doc.querySelector(${JSON.stringify(mode === 'desktop' ? '.chat-sidebar-desktop' : '.mobile-nav-drawer')});
const primary = surface.querySelector('.sidebar-primary-nav');
const recent = surface.querySelector('.sidebar-history-scroll');
const footer = surface.querySelector('.sidebar-account-footer');
const firstTitle = surface.querySelector('[data-conversation-title]');
const before = {primary: primary.getBoundingClientRect(), footer: footer.getBoundingClientRect()};
recent.scrollTop = recent.scrollHeight;
const after = {primary: primary.getBoundingClientRect(), footer: footer.getBoundingClientRect()};
const titleStyle = win.getComputedStyle(firstTitle);
const surfaceStyle = win.getComputedStyle(surface);
const recentStyle = win.getComputedStyle(recent);
const footerStyle = win.getComputedStyle(footer);
document.getElementById('render-result').textContent = JSON.stringify({
  viewport: {innerWidth: win.innerWidth, innerHeight: win.innerHeight, clientWidth: doc.documentElement.clientWidth, scrollWidth: doc.documentElement.scrollWidth},
  surface: {left: surface.getBoundingClientRect().left, right: surface.getBoundingClientRect().right, top: surface.getBoundingClientRect().top, bottom: surface.getBoundingClientRect().bottom, width: surface.getBoundingClientRect().width, height: surface.getBoundingClientRect().height, overflowY: surfaceStyle.overflowY},
  primary: {top: before.primary.top, bottom: before.primary.bottom, topAfter: after.primary.top, bottomAfter: after.primary.bottom},
  recent: {clientHeight: recent.clientHeight, scrollHeight: recent.scrollHeight, scrollTop: recent.scrollTop, overflowY: recentStyle.overflowY},
  footer: {top: before.footer.top, bottom: before.footer.bottom, topAfter: after.footer.top, bottomAfter: after.footer.bottom, position: footerStyle.position},
  title: {clientWidth: firstTitle.clientWidth, scrollWidth: firstTitle.scrollWidth, height: firstTitle.getBoundingClientRect().height, lineHeight: titleStyle.lineHeight, overflow: titleStyle.overflow, textOverflow: titleStyle.textOverflow, webkitLineClamp: titleStyle.webkitLineClamp},
  oldLabelsPresent: ['주문 내역','예약 내역','내 계정','설정','도움말 / 문의','오늘','어제','최근 7일','이전'].filter(label => surface.textContent.includes(label)),
});
</script></body></html>`;
}

function render(width, height, mode) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lotbi-sidebar-ia-'));
  const fixture = path.join(tmp, 'fixture.html');
  fs.writeFileSync(fixture, htmlFor(width, height, mode), 'utf8');
  const browser = browserPath();
  const run = spawnSync(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--window-size=1600,1000', '--virtual-time-budget=500', '--dump-dom', `file://${fixture}`,
  ], {encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024});
  fs.rmSync(tmp, {recursive: true, force: true});
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(`headless browser failed (${run.status}): ${run.stderr}`);
  const match = run.stdout.match(/<pre id="render-result">([^<]+)<\/pre>/);
  if (!match) throw new Error('Sidebar render result not found');
  return JSON.parse(match[1].replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>'));
}

function assertViewport(label, result, width, height, mode) {
  const tolerance = 2;
  if (Math.abs(result.viewport.innerWidth - width) > tolerance || Math.abs(result.viewport.innerHeight - height) > tolerance) {
    throw new Error(`${label}: expected viewport ${width}x${height}, got ${result.viewport.innerWidth}x${result.viewport.innerHeight}`);
  }
  if (result.viewport.scrollWidth > result.viewport.clientWidth + tolerance) {
    throw new Error(`${label}: horizontal overflow ${result.viewport.scrollWidth}px > ${result.viewport.clientWidth}px`);
  }
  if (result.oldLabelsPresent.length) throw new Error(`${label}: removed labels rendered: ${result.oldLabelsPresent.join(', ')}`);
  if (result.recent.overflowY !== 'auto') throw new Error(`${label}: recent region must be overflow-y:auto, got ${result.recent.overflowY}`);
  if (result.recent.scrollHeight <= result.recent.clientHeight) throw new Error(`${label}: injected recent list did not become independently scrollable`);
  if (result.recent.scrollTop <= 0) throw new Error(`${label}: recent list could not scroll`);
  if (Math.abs(result.primary.topAfter - result.primary.top) > tolerance || Math.abs(result.footer.topAfter - result.footer.top) > tolerance) {
    throw new Error(`${label}: scrolling recent conversations moved fixed primary/account regions`);
  }
  if (result.footer.bottom > height + tolerance || result.footer.top < 0) throw new Error(`${label}: account footer left viewport (${result.footer.top}..${result.footer.bottom})`);
  if (result.title.webkitLineClamp !== '2') throw new Error(`${label}: recent title 2-line clamp missing (${result.title.webkitLineClamp})`);
  if (mode === 'desktop') {
    if (Math.abs(result.surface.width - 220) > tolerance) throw new Error(`${label}: desktop sidebar width changed from 220px (${result.surface.width}px)`);
    if (result.surface.height > height + tolerance) throw new Error(`${label}: desktop sidebar exceeds viewport height`);
  } else {
    if (result.surface.left < -tolerance || result.surface.right > width + tolerance) throw new Error(`${label}: mobile drawer is outside viewport`);
  }
}

const cases = [
  ['desktop-1440', 1440, 900, 'desktop'],
  ['desktop-1366', 1366, 768, 'desktop'],
  ['mobile-390', 390, 844, 'mobile'],
];
for (const [label, width, height, mode] of cases) {
  const result = render(width, height, mode);
  console.log(`SITE-SIDEBAR-INFORMATION-ARCHITECTURE-04 ${label}`, JSON.stringify(result));
  assertViewport(label, result, width, height, mode);
}
console.log('SITE-SIDEBAR-INFORMATION-ARCHITECTURE-04 VIEWPORT PASS');
