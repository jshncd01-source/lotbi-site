// Approved minimal Site home: conversation entry only, without favorites or a
// fixed quick-safety shortcut. Real Chromium, local fixtures, no live writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {browserPath, buildInner, startServer, serverPort, openDevtools, waitFor, sleep} from './validate_place_card_carousel_no_drift_01.mjs';

const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const index = read('index.html');
const conversation = read('site-conversation.js');
const css = ['home-bare-white.css', 'site-consumer-design.css', 'site-consumer-layout.css'].map(read).join('\n');

for (const removed of [
  'data-home-favorites', 'data-favorites-count', 'data-favorites-add',
  'data-favorites-edit', 'data-home-prompt', '빠른 안전 확인', '의심되는 문자 확인',
]) assert.doesNotMatch(index, new RegExp(removed, 'u'), `removed home-only control: ${removed}`);
assert.doesNotMatch(conversation, /mountHomeFavorites|homeFavorites|data-home-prompt/u);
assert.doesNotMatch(css, /home-favorites|home-example-prompts/u);
assert.equal(fs.existsSync(path.join(root, 'site-home-favorites.js')), false);
assert.equal(fs.existsSync(path.join(root, 'site-home-favorites.css')), false);
// SITE-MAIN-HOME-REDESIGN-01: the approved Home has no title; the character stays.
assert.doesNotMatch(index, /home-value-proposition|무엇을 도와드릴까요/u);
assert.match(index, /data-home-avatar-anchor/u);
assert.match(index, /data-attachment-trigger/u);
assert.match(index, /class="composer-button send-button" type="button" disabled/u);
assert.equal((index.match(/data-scam-open/gu) || []).length, 2, 'formal desktop/mobile scam menu entries remain');
assert.equal((index.match(/data-recent-conversations/gu) || []).length, 2, 'desktop/mobile recent chats remain');

const fixtureDir = fs.mkdtempSync(path.join(root, 'scripts/.home-conversation-only-'));
const evidenceDir = process.env.HOME_CONVERSATION_ONLY_EVIDENCE_DIR;
const server = startServer();
const logs = [];
try {
  const origin = `http://127.0.0.1:${await serverPort(server)}`;
  for (const width of [360, 1280]) for (const dark of [false, true]) {
    const height = width === 360 ? 780 : 900;
    const label = `${width}x${height}-${dark ? 'dark' : 'light'}`;
    let fixture = buildInner({results: []}).replace(
      '  localStorage.clear();',
      `  localStorage.clear(); document.cookie='lotbi_theme_preference_v1=${dark ? 'dark' : 'light'}; Path=/';\n      window.__homeErrors=[];\n      window.addEventListener('error',e=>window.__homeErrors.push(e.message));\n      window.addEventListener('unhandledrejection',e=>window.__homeErrors.push(String(e.reason)));`,
    );
    const start = fixture.indexOf("  const field=document.getElementById('lotbi-prompt');");
    const end = fixture.indexOf('} catch(e) { fail(e); }', start);
    assert.ok(start > 0 && end > start);
    fixture = fixture.slice(0, start) + "  out.hidden=true; out.textContent=JSON.stringify({ok:true});\n" + fixture.slice(end);
    fs.writeFileSync(path.join(fixtureDir, 'inner.html'), fixture);

    // Linux gate contract: create a unique Chrome profile immediately before launch.
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'lotbi-home-conversation-only-profile-'));
    const page = await openDevtools(browserPath(), profile);
    try {
      const evaluate = async expression => {
        const value = await page.send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
        if (value.exceptionDetails) throw new Error(JSON.stringify(value.exceptionDetails));
        return value.result.value;
      };
      const snapshot = () => evaluate(`(() => {
        const composer=document.querySelector('.chat-composer');
        const box=composer.getBoundingClientRect();
        const send=document.querySelector('.send-button');
        const visible=node=>!!node&&getComputedStyle(node).display!=='none'&&node.getBoundingClientRect().width>0&&node.getBoundingClientRect().height>0;
        return {
          title:document.querySelector('.home-value-proposition h2')?.textContent.trim(),
          favorites:!!document.querySelector('[data-home-favorites], [data-favorites-count], [data-home-prompt]'),
          quickSafety:!![...document.querySelectorAll('[data-scam-open]')].find(node=>node.closest('.chat-hero')),
          scamLabels:[...document.querySelectorAll('.sidebar-nav [data-scam-open] .nav-item-label')].map(node=>node.textContent.trim()),
          recentLists:document.querySelectorAll('[data-recent-conversations]').length,
          avatar:visible(document.querySelector('[data-home-avatar-anchor], .consumer-brand-fallback')),
          composer:visible(composer), composerLeft:box.left, composerRight:box.right,
          attachment:visible(document.querySelector('[data-attachment-trigger]')),
          disabled:send.disabled, sendColor:getComputedStyle(send).backgroundColor,
          overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
          errors:window.__homeErrors,
        };
      })()`);
      await page.send('Page.enable');
      await page.send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: width === 360});
      await page.send('Page.navigate', {url: `${origin}/scripts/${path.basename(fixtureDir)}/inner.html`});
      let ready;
      try {
        ready = await waitFor(async () => {
          const value = await evaluate("document.getElementById('drift-result')?.textContent");
          return value && value !== 'pending' ? JSON.parse(value) : null;
        }, label, Number(process.env.HOME_CONVERSATION_ONLY_TIMEOUT_MS) || 60000);
      } catch (error) {
        const diagnostics = await evaluate("({readyState:document.readyState,result:document.getElementById('drift-result')?.textContent,errors:window.__homeErrors,body:document.body?.dataset})");
        throw new Error(`${error.message}; diagnostics=${JSON.stringify(diagnostics)}`);
      }
      assert.equal(ready.ok, true, ready.error);
      await sleep(250);
      let state = await snapshot();
      assert.equal(state.title, undefined, `${label}: the Home has no title`);
      assert.equal(state.favorites, false); assert.equal(state.quickSafety, false);
      assert.deepEqual(state.scamLabels, ['사기·피싱 확인', '사기·피싱 확인']);
      assert.equal(state.recentLists, 2); assert.equal(state.avatar, true);
      assert.equal(state.composer, true); assert.equal(state.attachment, true); assert.equal(state.disabled, true);
      assert.ok(state.composerLeft >= -0.5 && state.composerRight <= width + 0.5, `${label}: composer fits viewport`);
      assert.equal(state.overflow, 0); assert.deepEqual(state.errors, []);
      const disabledColor = state.sendColor;
      if (evidenceDir) {
        await evaluate("document.activeElement?.blur(); true"); await sleep(100);
        fs.mkdirSync(evidenceDir, {recursive: true});
        const result = await page.send('Page.captureScreenshot', {format: 'png'});
        fs.writeFileSync(path.join(evidenceDir, `${label}.png`), Buffer.from(result.data, 'base64'));
      }
      await evaluate("const field=document.getElementById('lotbi-prompt'); field.value='입력 상태 확인'; field.dispatchEvent(new Event('input',{bubbles:true})); true");
      await waitFor(async () => {
        const next = await snapshot();
        return !next.disabled && next.sendColor === 'rgb(37, 99, 235)';
      }, `${label}: send enabled and visibly active`, 3000);
      state = await snapshot();
      assert.equal(state.sendColor, 'rgb(37, 99, 235)'); assert.notEqual(state.sendColor, disabledColor);
      logs.push(`${label}: 제거 범위·홈 핵심 요소·입력/전송 상태·가로 넘침 PASS`);
    } finally {
      page.close();
      for (let attempt = 0; attempt < 10; attempt += 1) {
        try { fs.rmSync(profile, {recursive: true, force: true}); break; } catch { await sleep(200); }
      }
    }
  }
  console.log(logs.join('\n'));
  console.log('SITE-HOME-CONVERSATION-ONLY-01 PASS — viewport emulation, not a device run');
} finally {
  server.kill('SIGTERM'); await sleep(300);
  if (process.env.HOME_CONVERSATION_ONLY_KEEP_FIXTURE) console.error(`fixture preserved: ${fixtureDir}`);
  else fs.rmSync(fixtureDir, {recursive: true, force: true, maxRetries: 10, retryDelay: 200});
}
