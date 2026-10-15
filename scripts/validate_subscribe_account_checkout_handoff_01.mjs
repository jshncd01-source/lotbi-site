// SUBSCRIBE-ACCOUNT-CHECKOUT-HANDOFF-01
// lotbiai.com/subscribe hands the chosen plan to LOTBI Account checkout.
// Only an allowlisted plan token travels; no price, no return address, no
// payment call happens on the Site. Account signs the visitor in, shows the
// Core-priced confirmation and keeps the final 결제하기 fail-closed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8').replace(/\r\n/g, '\n');
const html = read('subscribe.html');
const js = read('subscribe.js');
const css = read('subscribe.css');

const ACCOUNT = 'https://account.lotbiai.com/account';
const PLANS = ['basic', 'plus', 'pro'];

// 1. Every paid card carries its own link to that plan's Account checkout.
const cards = [...html.matchAll(/<label class="plan-card[^"]*"[^>]*>([\s\S]*?)<\/label>/g)].map(match => match[1]);
assert.equal(cards.length, 3, 'three paid plan cards');
cards.forEach((card, index) => {
  const plan = PLANS[index];
  assert.match(card, new RegExp(`<input type="radio" name="plan" value="${plan}"`), `${plan}: radio`);
  const links = [...card.matchAll(/<a class="plan-card-cta" href="([^"]+)" data-plan-checkout="([^"]+)">/g)];
  assert.equal(links.length, 1, `${plan}: exactly one checkout link`);
  assert.equal(links[0][1], `${ACCOUNT}?checkout=${plan}`, `${plan}: fixed Account checkout URL`);
  assert.equal(links[0][2], plan, `${plan}: data-plan-checkout matches the card`);
});
assert.doesNotMatch(html, /checkout=[^"&]*&|[?&](?:price|amount|next|return|redirect)[^a-z]/i, 'no price or return address in links');
for (const label of ['Basic 시작하기', 'Plus 시작하기', 'Pro로 업그레이드', '구매하기']) assert.ok(html.includes(label), label);

// 2. Payment-status disclosure stays truthful.
assert.ok(html.includes('실제 결제와 자동갱신이 열려 있지 않습니다.'), 'lead disclosure kept');
assert.ok(html.includes('마지막 결제하기 단계에서 실제 결제와 청구가 진행되지 않으며'), 'final-step disclosure');
assert.ok(!html.includes('둘러보고 선택해 보는 것까지만'), 'old dead-end copy removed');

// 3. The script only maps the radio value through a fixed allowlist.
assert.ok(js.includes(`var ACCOUNT_CHECKOUT_URL = '${ACCOUNT}';`), 'fixed Account URL');
assert.ok(js.includes("var CHECKOUT_PLANS = { basic: 'basic', plus: 'plus', pro: 'pro' };"), 'plan allowlist');
assert.match(js, /Object\.prototype\.hasOwnProperty\.call\(CHECKOUT_PLANS, value\)/);
assert.doesNotMatch(js, /fetch\(|XMLHttpRequest|sendBeacon|price|amount|document\.referrer|location\.search|location\.hash/, 'no payment call or reflected input');

// 4. Links stay readable buttons with a touch-sized target. The selector is
// scoped above `.legal .section a:not(.primary-link)` (0,3,1) so its underline
// cannot return.
const CTA = '\\.plan-picker \\.plan-grid \\.plan-card a\\.plan-card-cta';
assert.match(css, new RegExp(`${CTA},\\n${CTA}:visited,\\n${CTA}:hover \\{[^}]*min-height: 44px;[^}]*text-decoration: none;`));
assert.match(css, new RegExp(`${CTA}:focus-visible \\{`));

// 5. Behaviour: run subscribe.js against a minimal DOM.
function fakeElement(extra = {}) {
  const listeners = {};
  return {
    listeners,
    attributes: {},
    innerHTML: '',
    addEventListener(type, handler) { (listeners[type] ??= []).push(handler); },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name] ?? null; },
    focus() {},
    ...extra,
  };
}

function runScript(values) {
  const radios = values.map((value, index) => fakeElement({value, checked: index === 0, attributes: {'data-plan-name': `LOTBI ${value}`}}));
  const cards = radios.map(radio => fakeElement({querySelector: () => radio}));
  const form = fakeElement({
    querySelectorAll: selector => (selector === '[data-plan-card]' ? cards : radios),
  });
  const status = fakeElement();
  const readout = fakeElement();
  const assigned = [];
  const context = {
    document: {
      readyState: 'complete',
      getElementById: id => ({'plan-form': form, 'plan-status': status, 'plan-selected-readout': readout})[id] ?? null,
    },
    window: {location: {assign: url => assigned.push(url)}},
  };
  vm.runInNewContext(js, context, {filename: 'subscribe.js'});
  const submit = () => {
    let prevented = false;
    form.listeners.submit[0]({preventDefault: () => { prevented = true; }});
    assert.ok(prevented, 'form submit never reloads the page');
  };
  return {radios, status, assigned, submit};
}

for (const plan of PLANS) {
  const page = runScript(PLANS);
  page.radios.forEach(radio => { radio.checked = radio.value === plan; });
  page.submit();
  assert.deepEqual(page.assigned, [`${ACCOUNT}?checkout=${plan}`], `${plan}: 구매하기 goes to that plan's checkout`);
  assert.match(page.status.innerHTML, /결제 확인 화면으로 이동합니다/);
}

for (const hostile of ['https://evil.example', 'constructor', '__proto__', 'enterprise', '']) {
  const page = runScript([hostile, 'plus', 'pro']);
  page.submit();
  assert.deepEqual(page.assigned, [], `${hostile || '(empty)'}: no navigation`);
  assert.match(page.status.innerHTML, /먼저 등급을 하나 선택해 주세요/);
}

const none = runScript(PLANS);
none.radios.forEach(radio => { radio.checked = false; });
none.submit();
assert.deepEqual(none.assigned, [], 'no plan selected: no navigation');

console.log('SUBSCRIBE ACCOUNT CHECKOUT HANDOFF 01 PASS - three plan links, allowlisted 구매하기, no price or return address, disclosure kept.');
