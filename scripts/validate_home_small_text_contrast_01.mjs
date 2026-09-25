import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const index = fs.readFileSync('index.html', 'utf8');
const cssFiles = [
  'styles.css',
  'site-theme-tokens.css',
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
  throw new Error('Chrome/Chromium is required for Home small-text contrast validation.');
}

const bodyMatch = index.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
if (!bodyMatch) throw new Error('index.html body markup not found');
const bodyMarkup = bodyMatch[1].replaceAll('src="/', 'src="');
const escapedCss = css.replaceAll('</style>', '<\\/style>');
const baseHref = pathToFileURL(path.resolve('.') + path.sep).href;
const browser = browserPath();

function innerDocument(theme) {
  return `<!doctype html><html lang="ko"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<base href="${baseHref}">
<style>${escapedCss}</style>
</head><body class="chat-home-page" data-site-theme="${theme}" data-conversation-restore="ready">${bodyMarkup}</body></html>`;
}

function outerFixture(theme, width, height) {
  const inner = JSON.stringify(innerDocument(theme));
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<style>html,body{margin:0;overflow:hidden}iframe{display:block;border:0;width:${width}px;height:${height}px}</style>
</head><body>
<iframe id="home-frame" title="LOTBI Home small-text contrast viewport"></iframe>
<pre id="home-small-text-result" hidden></pre>
<script>
const frame = document.getElementById('home-frame');
const doc = frame.contentDocument;
doc.open(); doc.write(${inner}); doc.close();
const win = frame.contentWindow;

function parseColor(value) {
  const match = value.match(/^rgba?\\(\\s*([\\d.]+)[, ]+([\\d.]+)[, ]+([\\d.]+)(?:\\s*[,/]\\s*([\\d.]+))?\\s*\\)$/i);
  if (!match) throw new Error('Unsupported rendered color: ' + value);
  return {r:Number(match[1]), g:Number(match[2]), b:Number(match[3]), a:match[4] === undefined ? 1 : Number(match[4])};
}

function composite(foreground, background) {
  const alpha = foreground.a + background.a * (1 - foreground.a);
  if (alpha === 0) return {r:0, g:0, b:0, a:0};
  return {
    r:(foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) / alpha,
    g:(foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) / alpha,
    b:(foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) / alpha,
    a:alpha,
  };
}

function paintedBackground(node) {
  const layers = [];
  for (let current = node; current; current = current.parentElement) {
    layers.push(parseColor(win.getComputedStyle(current).backgroundColor));
  }
  let painted = {r:255, g:255, b:255, a:1};
  for (const layer of layers.reverse()) painted = composite(layer, painted);
  return painted;
}

function channel(value) {
  const normalized = value / 255;
  return normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
}

function luminance(color) {
  return .2126 * channel(color.r) + .7152 * channel(color.g) + .0722 * channel(color.b);
}

function contrast(foreground, background) {
  const paintedForeground = composite(foreground, background);
  const a = luminance(paintedForeground);
  const b = luminance(background);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

function inspect(name, node) {
  if (!node) throw new Error(name + ': target not found');
  const rect = node.getBoundingClientRect();
  const style = win.getComputedStyle(node);
  if (style.display === 'none' || style.visibility === 'hidden' || rect.width <= 0 || rect.height <= 0) {
    throw new Error(name + ': target is not visibly rendered');
  }
  const background = paintedBackground(node);
  const foreground = parseColor(style.color);
  return {
    name,
    text:node.textContent.trim(),
    color:style.color,
    background:'rgb(' + Math.round(background.r) + ', ' + Math.round(background.g) + ', ' + Math.round(background.b) + ')',
    fontSize:Number.parseFloat(style.fontSize),
    fontWeight:style.fontWeight,
    ratio:Number(contrast(foreground, background).toFixed(2)),
  };
}

setTimeout(() => {
  const results = [
    inspect('value proposition detail', doc.querySelector('.home-value-proposition > p')),
    ...Array.from(doc.querySelectorAll('.home-example-prompts button'), (node, index) => inspect('example prompt ' + (index + 1), node)),
    inspect('safety copy', doc.querySelector('.chat-safety-copy')),
  ];
  document.getElementById('home-small-text-result').textContent = JSON.stringify({
    viewport:{width:win.innerWidth,height:win.innerHeight},
    theme:doc.body.dataset.siteTheme,
    results,
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

function render(label, theme, width, height) {
  const fixturePath = path.resolve(`.home-small-text-${process.pid}-${label}.html`);
  fs.writeFileSync(fixturePath, outerFixture(theme, width, height), 'utf8');
  try {
    const result = spawnSync(browser, [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--force-device-scale-factor=1',
      `--window-size=${Math.max(width, 500)},${height + 100}`,
      '--virtual-time-budget=1200',
      '--dump-dom',
      pathToFileURL(fixturePath).href,
    ], {encoding:'utf8', timeout:30000, maxBuffer:16 * 1024 * 1024});
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${label}: browser dump failed (${result.status}): ${result.stderr}`);
    const match = result.stdout.match(/<pre id="home-small-text-result" hidden="">([^<]+)<\/pre>/)
      || result.stdout.match(/<pre id="home-small-text-result"[^>]*>([^<]+)<\/pre>/);
    if (!match) throw new Error(`${label}: render result not found`);
    return JSON.parse(decodeHtml(match[1]));
  } finally {
    fs.rmSync(fixturePath, {force:true});
  }
}

const cases = [
  ['desktop-light', 'light', 1440, 900],
  ['desktop-dark', 'dark', 1440, 900],
  ['mobile-light', 'light', 390, 844],
  ['mobile-dark', 'dark', 390, 844],
];

for (const [label, theme, width, height] of cases) {
  const rendered = render(label, theme, width, height);
  if (Math.abs(rendered.viewport.width - width) > 3 || Math.abs(rendered.viewport.height - height) > 3) {
    throw new Error(`${label}: exact iframe viewport mismatch ${rendered.viewport.width}x${rendered.viewport.height}`);
  }
  if (rendered.results.length !== 5) throw new Error(`${label}: expected 5 rendered text targets`);
  for (const result of rendered.results) {
    if (!result.text) throw new Error(`${label} ${result.name}: visible text is empty`);
    if (result.ratio < 4.5) {
      throw new Error(`${label} ${result.name}: ${result.ratio}:1 is below WCAG AA 4.5:1 (${result.color} on ${result.background})`);
    }
  }
  console.log('LOTBI HOME SMALL TEXT CONTRAST', label, JSON.stringify(rendered.results));
}

console.log('LOTBI HOME SMALL TEXT CONTRAST PASS');
