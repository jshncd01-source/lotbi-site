import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const styles = [
  fs.readFileSync(path.join(ROOT, 'home-chat.css'), 'utf8'),
  fs.readFileSync(path.join(ROOT, 'site-conversation.css'), 'utf8'),
  fs.readFileSync(path.join(ROOT, 'site-sidebar-nav.css'), 'utf8'),
].join('\n');

assert.match(html, /class="composer-button attachment-button"[^>]*aria-label="파일 첨부"/);
assert.match(html, /type="file"[^>]*accept="image\/jpeg,image\/png,image\/webp,application\/pdf"/);
assert.match(html, /class="attachment-preview-strip"/);
assert.ok(html.includes('LOTBI는 실수할 수 있습니다. 중요한 정보와 예약·구매 내용은 최종 확인해 주세요.'));
assert.match(styles, /\.chat-home-page\s*\{[^}]*height:\s*100dvh[^}]*overflow:\s*hidden/s);
assert.match(styles, /\.chat-home-shell\s*\{[^}]*min-height:\s*0[^}]*overflow:\s*hidden/s);
assert.match(styles, /\.conversation-thread,[\s\S]*?width:\s*min\(960px,\s*100%\)[\s\S]*?overflow-y:\s*auto/);
assert.match(styles, /\.chat-composer-stack\s*\{[^}]*width:\s*min\(960px,\s*100%\)/s);

const browserCandidates = [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean);
const browser = browserCandidates.map(candidate => {
  if (candidate.includes('/') && fs.existsSync(candidate)) return candidate;
  const found = spawnSync('which', [candidate], {encoding: 'utf8'});
  return found.status === 0 ? found.stdout.trim() : '';
}).find(Boolean);

const fixture = path.join(os.tmpdir(), `lotbi-chat-layout-${process.pid}.html`);
const source = html
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace('</body>', `<script>(() => {
    const thread = document.getElementById('conversation-thread');
    thread.hidden = false;
    document.body.classList.add('conversation-active');
    for (let index = 0; index < 80; index += 1) {
      const message = document.createElement('article');
      message.className = 'chat-message ' + (index % 2 ? 'chat-message-assistant' : 'chat-message-user');
      message.textContent = '메시지 ' + index + ' ' + '긴 답변 '.repeat(18);
      thread.appendChild(message);
    }
    for (const list of document.querySelectorAll('[data-recent-conversations]')) {
      for (let index = 0; index < 100; index += 1) {
        const item = document.createElement('li'); item.textContent = '최근 대화 ' + index; list.appendChild(item);
      }
    }
  })();<\/script></body>`)
  .replaceAll('href="styles.css"', `href="file://${path.join(ROOT, 'styles.css')}"`)
  .replaceAll('href="home-chat.css"', `href="file://${path.join(ROOT, 'home-chat.css')}"`)
  .replace(/href="site-hardening\.css[^\"]*"/, `href="file://${path.join(ROOT, 'site-hardening.css')}"`)
  .replace(/href="site-sidebar-nav\.css[^\"]*"/, `href="file://${path.join(ROOT, 'site-sidebar-nav.css')}"`)
  .replaceAll('href="site-auth-continuity.css"', `href="file://${path.join(ROOT, 'site-auth-continuity.css')}"`)
  .replace(/href="site-calendar\.css[^\"]*"/, `href="file://${path.join(ROOT, 'site-calendar.css')}"`)
  .replaceAll('href="footer-business-info.css"', `href="file://${path.join(ROOT, 'footer-business-info.css')}"`)
  .replaceAll('href="mobile-entry.css"', `href="file://${path.join(ROOT, 'mobile-entry.css')}"`)
  .replace('</head>', `<link rel="stylesheet" href="file://${path.join(ROOT, 'site-conversation.css')}"></head>`);
fs.writeFileSync(fixture, source);

if (browser) try {
  for (const [width, height] of [[390, 844], [412, 915], [768, 900], [1280, 900], [1440, 900]]) {
    const script = `(() => {
      const shell = document.querySelector('.chat-app-shell');
      const main = document.querySelector('.chat-home-shell');
      const hero = document.querySelector('.chat-hero');
      const thread = document.querySelector('.conversation-thread');
      const composer = document.querySelector('.chat-composer-stack');
      const desktopSidebar = document.querySelector('.chat-sidebar-desktop');
      const sidebar = innerWidth > 900 ? desktopSidebar : document.querySelector('.mobile-nav-drawer');
      const recent = sidebar.querySelector('.sidebar-history-scroll');
      const footer = sidebar.querySelector('.sidebar-account-footer');
      const result = {
        viewport: [innerWidth, innerHeight],
        bodyOverflow: getComputedStyle(document.body).overflowY,
        shellHeight: shell.getBoundingClientRect().height,
        mainOverflow: getComputedStyle(main).overflowY,
        heroOverflow: getComputedStyle(hero).overflowY,
        threadOverflow: getComputedStyle(thread).overflowY,
        threadHeight: thread.clientHeight,
        threadScrollHeight: thread.scrollHeight,
        composerBottom: composer.getBoundingClientRect().bottom,
        mainBottom: main.getBoundingClientRect().bottom,
        recentOverflow: getComputedStyle(recent).overflowY,
        recentScrollable: recent.scrollHeight > recent.clientHeight,
        footerBottom: footer.getBoundingClientRect().bottom,
        sidebarBottom: sidebar.getBoundingClientRect().bottom,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
      document.body.textContent = JSON.stringify(result);
    })();
    `;
    const probe = fixture.replace('.html', `-${width}.html`);
    fs.writeFileSync(probe, source.replace('</body>', `<script>${script}<\/script></body>`));
    const measured = spawnSync(browser, [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--allow-file-access-from-files',
      `--window-size=${width},${height}`, '--force-device-scale-factor=1',
      '--virtual-time-budget=1000', '--dump-dom', `file://${probe}`,
    ], {encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024});
    fs.rmSync(probe, {force: true});
    if (measured.status !== 0) throw new Error(measured.stderr || `browser exited ${measured.status}`);
    const match = measured.stdout.match(/<body[^>]*>(\{.*?\})<\/body>/s);
    if (!match) throw new Error(`${width}px layout result missing`);
    const value = JSON.parse(match[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&'));
    assert.equal(value.horizontalOverflow, false, `${width}px horizontal overflow`);
    assert.equal(value.mainOverflow, 'hidden', `${width}px main must own no scroll`);
    assert.equal(value.heroOverflow, 'hidden', `${width}px hero must own no scroll`);
    assert.equal(value.threadOverflow, 'auto', `${width}px transcript must be the main scroll owner`);
    assert.ok(value.threadScrollHeight > value.threadHeight, `${width}px transcript fixture must scroll`);
    assert.ok(Math.abs(value.composerBottom - value.mainBottom) < 4, `${width}px composer must stay at main bottom`);
    assert.equal(value.recentOverflow, 'auto', `${width}px recent list must own sidebar scroll`);
    assert.equal(value.recentScrollable, true, `${width}px recent list fixture must scroll`);
    assert.ok(value.footerBottom <= value.sidebarBottom + 2, `${width}px account footer must stay visible`);
  }
} finally {
  fs.rmSync(fixture, {force: true});
}

if (!browser) fs.rmSync(fixture, {force: true});

assert.doesNotMatch(styles, /\.chat-message(?:-user|-assistant)?\s*\{[^}]*position:\s*absolute/s);
console.log('SITE-CHAT-LAYOUT-ATTACHMENT-01 PASS');
