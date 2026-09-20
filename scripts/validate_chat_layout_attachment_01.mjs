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

assert.match(html, /class="composer-button attachment-button"[\s\S]*aria-label="첨부 추가"/);
assert.match(html, /data-attachment-action="camera">카메라<\/button>/);
assert.match(html, /data-attachment-action="photos">사진·스크린샷<\/button>/);
assert.match(html, /data-attachment-action="files">파일<\/button>/);
assert.match(html, /data-attachment-input="files"/);
assert.match(html, /class="attachment-preview-strip"/);
assert.ok(html.includes('LOTBI는 실수할 수 있습니다. 중요한 정보와 예약·구매 내용은 최종 확인해 주세요.'));
assert.match(styles, /\.chat-home-page\s*\{[^}]*height:\s*100dvh[^}]*overflow:\s*hidden/s);
assert.match(html, /<main id="main-content" class="chat-home-shell" tabindex="0">/);
assert.match(styles, /\.chat-home-shell\s*\{[^}]*min-height:\s*0[^}]*overflow-x:\s*hidden[^}]*overflow-y:\s*auto[^}]*scrollbar-gutter:\s*stable/s);
assert.match(styles, /\.conversation-thread,[\s\S]*?width:\s*min\(760px,\s*100%\)[\s\S]*?overflow:\s*visible/);
assert.doesNotMatch(styles, /\.conversation-thread[^}]*scrollbar-width:\s*none/s);
assert.doesNotMatch(styles, /\.conversation-thread::\-webkit-scrollbar[\s\S]*?display:\s*none/s);
assert.match(styles, /\.chat-composer-stack\s*\{[^}]*width:\s*min\(760px,\s*100%\)/s);
assert.match(styles, /\.conversation-thread,[\s\S]*?align-content:\s*start[\s\S]*?grid-auto-rows:\s*max-content/);
assert.match(styles, /body\[data-chat-color="default"\]\s*\{[^}]*--user-bubble:\s*#[0-9a-fA-F]{6}[^}]*--user-bubble-foreground:\s*#[0-9a-fA-F]{6}/s);
assert.match(styles, /\.chat-message-body\s*\{[^}]*font-size:\s*17px[^}]*line-height:\s*1\.6/s);

const browserCandidates = [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean);
const browser = browserCandidates.map(candidate => {
  if (candidate.includes('/') && fs.existsSync(candidate)) return candidate;
  const found = spawnSync('which', [candidate], {encoding: 'utf8'});
  return found.status === 0 ? found.stdout.trim() : '';
}).find(Boolean);

if (!browser && process.env.REQUIRE_BROWSER === '1') {
  throw new Error('Chromium/Chrome is required for boundingClientRect layout geometry validation');
}

const fixture = path.join(os.tmpdir(), `lotbi-chat-layout-${process.pid}.html`);
const source = html
  .replace(/<script[\s\S]*?<\/script>/gi, '')
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
  const geometry = [];
  for (const [width, height] of [[340, 780], [390, 844], [412, 915], [768, 900], [1280, 900], [1440, 900], [1440, 1200]]) {
    const script = `(() => {
      try {
      const thread = document.querySelector('.conversation-thread');
      thread.hidden = false;
      document.body.classList.add('conversation-active');
      const timestamp = document.createElement('time');
      timestamp.className = 'conversation-time-separator';
      timestamp.textContent = '2026년 9월 20일 오후 4:21';
      const user = document.createElement('article');
      user.className = 'chat-message chat-message-user';
      user.innerHTML = '<p class="chat-message-body">안녕</p>';
      const assistantRow = document.createElement('div');
      assistantRow.className = 'chat-assistant-row';
      assistantRow.innerHTML = '<div class="assistant-avatar-slot">LOTBI</div><article class="chat-message chat-message-assistant"><p class="chat-message-body">안녕하세요! 무엇을 도와드릴까요?</p></article>';
      thread.append(timestamp, user, assistantRow);
      const timestampRect = timestamp.getBoundingClientRect();
      const userRect = user.getBoundingClientRect();
      const assistantRect = assistantRow.getBoundingClientRect();
      const initialGeometry = {
        timestampToUser: userRect.top - timestampRect.bottom,
        userToAssistant: assistantRect.top - userRect.bottom,
        userFontSize: getComputedStyle(user.querySelector('.chat-message-body')).fontSize,
        assistantFontSize: getComputedStyle(assistantRow.querySelector('.chat-message-body')).fontSize,
        timestampWhiteSpace: getComputedStyle(timestamp).whiteSpace,
      };
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
      const shell = document.querySelector('.chat-app-shell');
      const main = document.querySelector('.chat-home-shell');
      const hero = document.querySelector('.chat-hero');
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
        mainScrollHeight: main.scrollHeight,
        mainClientHeight: main.clientHeight,
        mainScrollTopBefore: main.scrollTop,
        mainRight: main.getBoundingClientRect().right,
        mainScrollbarThickness: main.offsetWidth - main.clientWidth,
        mainTabIndex: main.tabIndex,
        heroOverflow: getComputedStyle(hero).overflowY,
        threadOverflow: getComputedStyle(thread).overflowY,
        threadHeight: thread.clientHeight,
        threadScrollHeight: thread.scrollHeight,
        threadScrollTopBefore: thread.scrollTop,
        composerBottom: composer.getBoundingClientRect().bottom,
        mainBottom: main.getBoundingClientRect().bottom,
        recentOverflow: getComputedStyle(recent).overflowY,
        recentScrollable: recent.scrollHeight > recent.clientHeight,
        footerBottom: footer.getBoundingClientRect().bottom,
        sidebarBottom: sidebar.getBoundingClientRect().bottom,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        initialGeometry,
      };
      main.scrollTop = Math.min(240, main.scrollHeight - main.clientHeight);
      result.mainScrollTopAfter = main.scrollTop;
      result.threadScrollTopAfterMainScroll = thread.scrollTop;
      result.composerBottomAfterScroll = composer.getBoundingClientRect().bottom;
      const output = document.createElement('pre');
      output.id = 'layout-result';
      output.textContent = JSON.stringify(result);
      document.body.appendChild(output);
      } catch (error) {
        const output = document.createElement('pre');
        output.id = 'layout-result';
        output.textContent = JSON.stringify({probeError: String(error && (error.stack || error))});
        document.body.appendChild(output);
      }
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
    const match = measured.stdout.match(/<pre id="layout-result">(.*?)<\/pre>/s);
    if (!match) throw new Error(`${width}px layout result missing`);
    const value = JSON.parse(match[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&'));
    if (value.probeError) throw new Error(`${width}px layout probe failed: ${value.probeError}`);
    assert.equal(value.horizontalOverflow, false, `${width}px horizontal overflow`);
    assert.ok(value.initialGeometry.timestampToUser <= 32, `${width}x${height} timestamp-to-user gap must stay compact`);
    assert.ok(value.initialGeometry.userToAssistant <= 32, `${width}x${height} user-to-assistant gap must stay compact`);
    assert.equal(value.initialGeometry.userFontSize, value.initialGeometry.assistantFontSize, `${width}px user/assistant body sizes must match`);
    assert.equal(value.initialGeometry.userFontSize, width <= 760 ? '16px' : '17px', `${width}px responsive body size`);
    assert.equal(value.initialGeometry.timestampWhiteSpace, 'nowrap', `${width}px timestamp must remain one line`);
    geometry.push({width, height, ...value.initialGeometry});
    assert.equal(value.bodyOverflow, 'hidden', `${width}px body must not create a second vertical scroll authority`);
    assert.equal(value.mainOverflow, 'auto', `${width}px full-width main pane must own vertical scrolling`);
    assert.ok(value.mainScrollHeight > value.mainClientHeight, `${width}px main fixture must be vertically scrollable`);
    assert.equal(value.mainTabIndex, 0, `${width}px main scroll pane must be keyboard focusable`);
    assert.equal(value.heroOverflow, 'visible', `${width}px conversation hero must not become an inner scroller`);
    assert.equal(value.threadOverflow, 'visible', `${width}px transcript must not own vertical scrolling`);
    assert.equal(value.threadScrollHeight, value.threadHeight, `${width}px transcript must size to content instead of clipping into a scroll box`);
    assert.ok(value.mainScrollTopAfter > value.mainScrollTopBefore, `${width}px main pane must accept scrolling`);
    assert.equal(value.threadScrollTopAfterMainScroll, 0, `${width}px transcript scrollTop must remain zero while main scrolls`);
    assert.ok(Math.abs(value.composerBottomAfterScroll - value.mainBottom) < 4, `${width}px sticky composer must remain at the main viewport bottom after scroll`);
    if (width >= 1280) {
      assert.ok(Math.abs(value.mainRight - width) < 2, `${width}px main scroll track must sit at the viewport right edge`);
      assert.ok(value.mainScrollbarThickness > 0, `${width}px desktop main scrollbar must expose draggable native chrome`);
    }
    assert.equal(value.recentOverflow, 'auto', `${width}px recent list must own sidebar scroll`);
    assert.equal(value.recentScrollable, true, `${width}px recent list fixture must scroll`);
    assert.ok(value.footerBottom <= value.sidebarBottom + 2, `${width}px account footer must stay visible`);
  }
  const desktop900 = geometry.find(item => item.width === 1440 && item.height === 900);
  const desktop1200 = geometry.find(item => item.width === 1440 && item.height === 1200);
  assert.ok(Math.abs(desktop900.timestampToUser - desktop1200.timestampToUser) < 2, 'tall viewport must not stretch timestamp-to-user gap');
  assert.ok(Math.abs(desktop900.userToAssistant - desktop1200.userToAssistant) < 2, 'tall viewport must not stretch user-to-assistant gap');
} finally {
  fs.rmSync(fixture, {force: true});
}

if (!browser) fs.rmSync(fixture, {force: true});

assert.doesNotMatch(styles, /\.chat-message(?:-user|-assistant)?\s*\{[^}]*position:\s*absolute/s);
console.log('SITE-CHAT-LAYOUT-ATTACHMENT-01 PASS');
