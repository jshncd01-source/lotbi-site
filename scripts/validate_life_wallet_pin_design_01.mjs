// LIFE-WALLET-PIN-DESIGN-01
// Privacy-safe browser verification for the unlock screen only. No real wallet data is used.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runFixturePage} from './lib/headless-fixture-result.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/site-consumer-design.css"><link rel="stylesheet" href="/site-life-wallet.css"><style>body{margin:0;padding:16px;background:var(--lotbi-bg-primary,#fff)}#host{width:100%;max-width:940px;margin:0 auto}</style></head><body><main id="host"></main><script type="module">
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const wait = async (predicate, label) => { for (let i = 0; i < 1200; i += 1) { const value = predicate(); if (value) return value; await sleep(25); } throw new Error('timed out ' + label); };
try {
  const {mountLifeWallet} = await import('/site-life-wallet.js?test=pin-design');
  const root = document.getElementById('host'); const accountId = 'pin-design-' + Date.now();
  const mounted = mountLifeWallet({root, authenticated:true, accountId});
  const setup = await wait(() => root.querySelector('form.wallet-pin-form:not(.wallet-unlock-form)'), 'setup');
  const setupInputs = setup.querySelectorAll('input'); setupInputs[0].value = '1357'; setupInputs[1].value = '1357'; setup.requestSubmit();
  const lock = await wait(() => [...root.querySelectorAll('button')].find(button => button.textContent === '잠그기'), 'unlocked'); lock.click();
  const form = await wait(() => root.querySelector('.wallet-unlock-form'), 'unlock'); await sleep(100);
  const gate = root.querySelector('.wallet-unlock-gate'); const mark = root.querySelector('.wallet-lock-mark'); const dots = root.querySelector('.wallet-pin-dots'); const input = form.querySelector('input'); const keys = [...root.querySelectorAll('.wallet-keypad button')]; const confirm = root.querySelector('.wallet-key-confirm');
  keys.find(key => key.textContent === '1').click(); keys.find(key => key.textContent === '3').click();
  const rect = gate.getBoundingClientRect(); const style = getComputedStyle(gate); const markStyle = getComputedStyle(mark); const dotStyle = getComputedStyle(dots); const confirmStyle = getComputedStyle(confirm);
  window.__result = JSON.stringify({ok:true,width:Math.round(rect.width),height:Math.round(rect.height),borderWidth:style.borderTopWidth,shadow:style.boxShadow,radius:style.borderRadius,markBackground:markStyle.backgroundColor,markRadius:markStyle.borderRadius,dotColor:dotStyle.color,dots:dots.textContent,confirmBackground:confirmStyle.backgroundColor,confirmColor:confirmStyle.color,keys:keys.map(key => key.textContent),input:{type:input.type,inputMode:input.inputMode,autocomplete:input.autocomplete,mask:getComputedStyle(input).webkitTextSecurity,maxLength:input.maxLength},overflow:document.documentElement.scrollWidth>innerWidth,mounted:Boolean(mounted)});
} catch (error) { window.__result = JSON.stringify({ok:false,error:String(error?.stack||error)}); }
</script></body></html>`;

const run = viewport => runFixturePage({root:ROOT, fixturePath:`/__life_wallet_pin_design_${viewport.width}.html`, fixtureHtml:fixture, viewport, timeoutMs:300000, resultExpression:'window.__result || ""'});
for (const viewport of [{width:1200,height:900},{width:390,height:844,mobile:true},{width:360,height:740,mobile:true}]) {
  const result = await run(viewport); assert.equal(result.ok, true, result.error); const detail = `${viewport.width}px ${JSON.stringify(result)}`;
  assert.deepEqual(result.keys, ['1','2','3','4','5','6','7','8','9','지움','0','열기'], detail);
  assert.equal(result.dots, '●●○○', detail);
  assert.equal(result.input.type, 'text', detail); assert.equal(result.input.inputMode, 'none', detail); assert.equal(result.input.autocomplete, 'off', detail); assert.equal(result.input.mask, 'disc', detail); assert.equal(result.input.maxLength, 4, detail);
  // LIFE-WALLET-REDESIGN-02 (owner-approved 2026-10-14): the mark is a white circle on the tinted
  // panel on a PC and a tinted circle on a phone; the accent is #2563EB (white text 5.2:1).
  assert.equal(result.markBackground, viewport.width > 600 ? 'rgb(255, 255, 255)' : 'rgb(238, 244, 255)', `lock mark must use the approved circular treatment: ${detail}`);
  assert.equal(result.markRadius, '50%', detail);
  assert.equal(result.dotColor, 'rgb(30, 34, 40)', `PIN dots must follow the approved mockup: ${detail}`);
  assert.equal(result.confirmBackground, 'rgb(37, 99, 235)', `open button must use the wallet accent: ${detail}`);
  assert.equal(result.confirmColor, 'rgb(255, 255, 255)', detail);
  assert.equal(result.overflow, false, detail);
  if (viewport.width > 430) {
    assert.ok(result.width >= 870 && result.width <= 880, `desktop gate must match the approved two-column card width: ${detail}`);
    assert.ok(result.height >= 560 && result.height <= 760, `desktop gate must match the approved PIN-card proportion: ${detail}`);
    assert.notEqual(result.shadow, 'none', detail);
  } else {
    assert.equal(result.borderWidth, '0px', `mobile PIN screen must not look like a nested oversized card: ${detail}`);
    assert.equal(result.shadow, 'none', detail);
    assert.equal(result.radius, '0px', detail);
  }
}
console.log('LIFE_WALLET_PIN_DESIGN_01 PASS — approved desktop card, flat mobile, blue wallet accents, masked keypad');
