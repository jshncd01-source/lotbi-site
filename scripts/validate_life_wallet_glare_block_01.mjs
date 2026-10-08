// LIFE-WALLET-GLARE-BLOCK-01
// Light reflected off a glossy card or certificate over its print (a number, a name) hides part
// of the item: the photo is not savable and the user is asked to retake it at another angle.
// A card that is merely bright (its blank areas blown out in strong light) or a card without a
// reflection stays savable, as does a card saved as a picture. All images are synthetic.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runFixturePage} from './lib/headless-fixture-result.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const fixtureHtml = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/site-consumer-design.css"><link rel="stylesheet" href="/site-life-wallet.css"></head><body><div id="host"></div><script type="module">
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  const scanUi = await import('/site-life-wallet-scan-ui.js?test=glare-block');
  const scenes = await import('/scripts/fixtures/life-wallet-scan-scenes.mjs?test=glare-block');
  const host = document.getElementById('host');
  const judge = async canvas => {
    const file = new File([await canvas.convertToBlob({type: 'image/jpeg', quality: .9})], 'shot.jpg', {type: 'image/jpeg'});
    const scanner = scanUi.createWalletDocumentScanner({file}); host.replaceChildren(scanner.element);
    const editor = scanner.element;
    for (let i = 0; i < 4000 && !['review', 'error'].includes(editor.dataset.scanState); i += 1) await sleep(25);
    const confirm = editor.querySelector('[data-wallet-scan-confirm]'); confirm.click();
    const outcome = {mode: editor.dataset.scanMode, glare: editor.dataset.scanGlare, save: !confirm.disabled, heading: editor.querySelector('h3')?.textContent || '', status: editor.querySelector('.wallet-scan-status')?.textContent || ''};
    scanner.destroy(); return outcome;
  };
  // A point on the card (u across, v down) in the photo.
  const onCard = (card, u, v) => { const [a, b, c, d] = card.corners; return {x: (1 - v) * ((1 - u) * a.x + u * b.x) + v * ((1 - u) * d.x + u * c.x), y: (1 - v) * ((1 - u) * a.y + u * b.y) + v * ((1 - u) * d.y + u * c.y)}; };
  const tint = [176, 198, 214];
  const shots = {};
  for (const [name, index, u, v] of [['desk', 6, .62, .52], ['felt', 21, .7, .35]]) {
    const config = scenes.cameraCardScene(index, {tint}); const card = config.cards[0];
    const across = Math.hypot(card.corners[1].x - card.corners[0].x, card.corners[1].y - card.corners[0].y);
    shots['reflection-over-print-' + name] = await judge(await scenes.renderScene({...config, specular: [{...onCard(card, u, v), radius: across * .05}]}));
    shots['same-card-no-reflection-' + name] = await judge(await scenes.renderScene(config));
  }
  shots['bright-card-blank-blown-out'] = await judge(await scenes.renderScene(scenes.cameraCardScene(28)));
  window.__result = JSON.stringify({ok: true, shots});
} catch (error) { window.__result = JSON.stringify({ok: false, error: String(error?.stack || error)}); }
</script></body></html>`;

const result = await runFixturePage({root: ROOT, fixturePath: '/__life_wallet_glare_block_01.html', fixtureHtml, resultExpression: 'window.__result || ""', viewport: {width: 390, height: 844, mobile: true, deviceScaleFactor: 1}, timeoutMs: 600_000});
assert.equal(result.ok, true, result.error);
for (const [name, value] of Object.entries(result.shots)) {
  const detail = JSON.stringify(value);
  assert.equal(value.mode, 'automatic', `${name}: the card itself must still be found: ${detail}`);
  if (name.startsWith('reflection-over-print')) {
    assert.equal(value.glare, 'true', `${name}: a reflection over the print must be caught: ${detail}`);
    assert.equal(value.save, false, `${name}: it must not be savable: ${detail}`);
    assert.equal(value.heading, '다시 촬영해 주세요', `${name}: ${detail}`);
    assert.equal(value.status, '빛 반사 때문에 자료의 일부가 보이지 않습니다. 빛이 비치지 않게 각도를 바꿔 다시 찍어 주세요.', `${name}: ${detail}`);
  } else {
    assert.equal(value.glare, 'false', `${name}: no reflection over the print: ${detail}`);
    assert.equal(value.save, true, `${name}: it must stay savable: ${detail}`);
  }
}
console.log(`LIFE_WALLET_GLARE_BLOCK_01 PASS — ${Object.entries(result.shots).map(([name, value]) => `${name}:${value.save ? 'save' : 'blocked'}`).join(', ')}`);
