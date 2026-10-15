import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const {WALLET_ITEM_LIMITS, walletAddBlocked} = await import('../site-life-wallet.js?test=plan-capacity');
const {createWalletCapacity, WalletCapacityError} = await import('../site-life-wallet-capacity.js?test=plan-capacity');

assert.deepEqual(WALLET_ITEM_LIMITS, {FREE: 1, BASIC: 30, PLUS: 100, PRO: 300});
assert.equal(walletAddBlocked({plan: 'FREE'}, 1), true);
assert.equal(walletAddBlocked({plan: 'BASIC'}, 29), false);
assert.equal(walletAddBlocked({plan: 'BASIC'}, 30), true);
assert.equal(walletAddBlocked({plan: 'PLUS'}, 100), true);
assert.equal(walletAddBlocked({plan: 'PRO'}, 300), true);
assert.equal(walletAddBlocked({plan: 'UNKNOWN'}, 999), false);

const calls = [];
const fetchImpl = async (url, init = {}) => {
  calls.push({url: String(url), method: init.method || 'GET', body: init.body, headers: init.headers});
  if (String(url).endsWith('/items/' + '0'.repeat(64))) {
    return Response.json({detail: {code: 'LIFE_WALLET_ITEM_LIMIT_REACHED', message: 'Life Wallet 저장 한도에 도달했습니다.'}}, {status: 409});
  }
  return Response.json({plan: 'BASIC', used: 2, limit: 30, remaining: 28, over_limit: false});
};
const client = createWalletCapacity({sessionToken: 'synthetic-token', fetchImpl});
await client.sync(['local-card-a', 'local-card-a', 'local-card-b']);
const sync = calls.at(-1);
const refs = JSON.parse(sync.body).item_refs;
assert.equal(sync.method, 'PUT');
assert.equal(refs.length, 2, 'sync is additive and deduplicates local ids');
assert.ok(refs.every(value => /^[0-9a-f]{64}$/u.test(value)), 'Core receives only SHA-256 refs');
assert.doesNotMatch(sync.body, /local-card|title|image|document/iu, 'no local id or wallet content leaves the device');
await client.reserve('local-card-c');
await client.release('local-card-c');
assert.equal(calls.at(-2).method, 'PUT');
assert.equal(calls.at(-1).method, 'DELETE');

const blocked = createWalletCapacity({sessionToken: 'synthetic-token', fetchImpl: async () => Response.json({detail: {
  code: 'LIFE_WALLET_ITEM_LIMIT_REACHED', message: 'Life Wallet 저장 한도에 도달했습니다.',
}}, {status: 409})});
await assert.rejects(() => blocked.reserve('local-card-d'), error => (
  error instanceof WalletCapacityError
  && error.code === 'LIFE_WALLET_ITEM_LIMIT_REACHED'
  && /저장 한도/u.test(error.message)
));

console.log('LIFE_WALLET_PLAN_CAPACITY_01 PASS — Free 1, Basic 30, Plus 100, Pro 300; hashed refs only; sync, reserve, release and Korean limit error');
