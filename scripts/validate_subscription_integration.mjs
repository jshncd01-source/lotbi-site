import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

const {readSubscriptionState, SiteCoreError} = await import('../site-core.js');

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json'},
  });
}

async function expectReject(promise, code) {
  let caught;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof SiteCoreError, `expected SiteCoreError ${code}`);
  assert.equal(caught.code, code);
}

{
  let request;
  const fetchMock = async (url, init) => {
    request = {url, init};
    return jsonResponse({
      plan: 'FREE',
      status: 'FREE',
      price: 9900,
      currency: 'KRW',
      provider: null,
      current_period_end: null,
      cancel_at_period_end: false,
      free_units: 3,
      used_free_units: 1,
      remaining_free_units: 2,
      entitled: false,
      web_payment_methods: [
        {code: 'CARD', display_name: '카드'},
        {code: 'BANK_ACCOUNT', display_name: '계좌'},
      ],
    });
  };

  const state = await readSubscriptionState('site-memory-token', fetchMock);
  assert.equal(request.url, 'https://api.lotbiai.com/v2/subscription');
  assert.equal(request.init.method, 'GET');
  assert.equal(request.init.credentials, 'omit');
  assert.equal(request.init.cache, 'no-store');
  assert.equal(request.init.headers.Authorization, 'Bearer site-memory-token');
  assert.equal(request.init.headers.Accept, 'application/json');
  assert.ok(!('body' in request.init), 'subscription GET must not send a body');
  assert.deepEqual(state, {
    plan: 'FREE',
    status: 'FREE',
    price: 9900,
    currency: 'KRW',
    provider: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    freeUnits: 3,
    usedFreeUnits: 1,
    remainingFreeUnits: 2,
    entitled: false,
    webPaymentMethods: [
      {code: 'CARD', displayName: '카드'},
      {code: 'BANK_ACCOUNT', displayName: '계좌'},
    ],
  });
}

await expectReject(
  readSubscriptionState('site-memory-token', async () => jsonResponse({plan: 'FREE'}, 200)),
  'SUBSCRIPTION_CONTRACT_INVALID',
);

await expectReject(
  readSubscriptionState('site-memory-token', async () => jsonResponse({
    detail: {code: 'SESSION_EXPIRED', message: 'expired'},
  }, 401)),
  'SESSION_EXPIRED',
);

const index = read('index.html');
const core = read('site-core.js');
const subscription = read('site-subscription.js');
const callback = read('auth-callback.js');
const css = read('site-subscription.css');

for (const token of [
  'id="subscription-plan"',
  'LOTBI Free',
  'LOTBI Plus',
  '월 9,900원',
  '매월 성공 작업 3회',
  '매월 1일 00:00 KST',
  '남은 무료 작업',
  'type="module" src="site-subscription.js"',
  'site-subscription.css',
  'https://account.lotbiai.com/account',
]) {
  assert.ok(index.includes(token), `missing subscription site contract: ${token}`);
}

assert.ok(core.includes("const SUBSCRIPTION_PATH = '/v2/subscription'"));
assert.ok(core.includes('export async function readSubscriptionState'));
assert.ok(subscription.includes('readSubscriptionState'));
assert.ok(subscription.includes('usedFreeUnits'));
assert.ok(subscription.includes('remainingFreeUnits'));
assert.ok(subscription.includes('currentPeriodEnd'));
assert.ok(callback.includes('mountSubscription'));
assert.ok(callback.includes('sessionToken: session.sessionToken'));
assert.ok(css.includes('.site-subscription-card'));

const siteSubscriptionRuntime = `${core}\n${subscription}\n${callback}`.toLowerCase();
for (const forbidden of [
  'localstorage',
  'sessionstorage.setitem',
  'document.cookie',
  'client_secret',
  'api_key',
  'openai_api_key',
]) {
  assert.ok(!siteSubscriptionRuntime.includes(forbidden), `forbidden subscription runtime token: ${forbidden}`);
}

for (const forbiddenPurchaseUi of [
  '>구독하기<',
  '>결제하기<',
  'tosspayments(',
  'requestbillingauth',
]) {
  assert.ok(!`${index}\n${subscription}`.toLowerCase().includes(forbiddenPurchaseUi.toLowerCase()), `fake purchase action must stay absent: ${forbiddenPurchaseUi}`);
}

console.log('SITE-SUBSCRIPTION-INTEGRATION-01 CONTRACT PASS');
