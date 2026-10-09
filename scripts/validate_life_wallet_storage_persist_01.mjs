// LIFE-WALLET-STORAGE-PERSIST-01
// The wallet lives only in this browser's storage, so after a PIN is made or entered the site
// asks the browser to keep that storage (navigator.storage.persist) — once per opened wallet,
// never blocking it, and a refusal or a missing API changes nothing. The PIN setup screen says
// why a new PIN is asked on an account that has a wallet elsewhere (other device or browser,
// cleared or private storage) and how items move (encrypted backup). All data is synthetic.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {runFixturePage} from './lib/headless-fixture-result.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const {requestPersistentWalletStorage} = await import(pathToFileURL(path.join(ROOT, 'site-life-wallet.js')).href);

// The request itself, against stand-ins for navigator.storage.
const calls = [];
const fake = ({persisted = false, granted = false, fail = false} = {}) => ({
  persisted: async () => persisted,
  persist: async () => { calls.push('persist'); if (fail) throw new Error('blocked'); return granted; },
});
assert.equal(await requestPersistentWalletStorage(undefined), 'unsupported', 'no Storage API: nothing to ask');
assert.equal(await requestPersistentWalletStorage({}), 'unsupported', 'no persist(): nothing to ask');
assert.equal(await requestPersistentWalletStorage(fake({persisted: true})), 'persisted', 'already kept');
assert.deepEqual(calls, [], 'storage already kept is not asked again');
assert.equal(await requestPersistentWalletStorage(fake({granted: true})), 'persisted', 'granted');
assert.equal(await requestPersistentWalletStorage(fake({granted: false})), 'best-effort', 'refused: the wallet works as before');
assert.equal(await requestPersistentWalletStorage(fake({fail: true})), 'unsupported', 'an error is swallowed');

// The real wallet (IndexedDB vault) with a stand-in navigator.storage that refuses.
const fixtureHtml = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/site-consumer-design.css"><link rel="stylesheet" href="/site-life-wallet.css"></head><body><main id="host"></main><main id="again"></main><script type="module">
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const wait = async (predicate, label) => { for (let i = 0; i < 2400; i += 1) { const value = predicate(); if (value) return value; await sleep(25); } throw new Error('timed out ' + label); };
try {
  let persistCalls = 0;
  Object.defineProperty(navigator, 'storage', {configurable: true, value: {persisted: async () => false, persist: async () => { persistCalls += 1; return false; }, estimate: async () => ({usage: 0, quota: 1})}});
  const {mountLifeWallet} = await import('/site-life-wallet.js?test=storage-persist');
  const root = document.getElementById('host');
  const accountId = 'storage-persist-' + Date.now();
  const first = mountLifeWallet({root, authenticated: true, accountId});
  const setup = await wait(() => root.querySelector('form.wallet-pin-form:not(.wallet-unlock-form)'), 'pin setup');
  const why = root.querySelector('.wallet-setup-why')?.textContent || '';
  const callsBeforePin = persistCalls;
  const [pin, again] = setup.querySelectorAll('input'); pin.value = '2468'; again.value = '2468'; setup.requestSubmit();
  await wait(() => [...root.querySelectorAll('button')].find(button => button.textContent === '잠그기'), 'unlocked');
  await wait(() => root.dataset.walletStorage, 'storage result');
  const afterCreate = {calls: persistCalls, result: root.dataset.walletStorage};
  [...root.querySelectorAll('button')].find(button => button.textContent === '잠그기').click();
  const unlockForm = await wait(() => root.querySelector('.wallet-unlock-form'), 'unlock form');
  const unlockWhy = Boolean(root.querySelector('.wallet-setup-why'));
  unlockForm.querySelector('input').value = '2468'; unlockForm.requestSubmit();
  await wait(() => [...root.querySelectorAll('button')].find(button => button.textContent === '잠그기'), 'unlocked again');
  await sleep(200);
  const afterRelock = persistCalls;
  first?.dispose?.();
  // Opened again (another visit): the existing vault asks for the PIN, then asks once more.
  sessionStorage.clear();
  const root2 = document.getElementById('again');
  mountLifeWallet({root: root2, authenticated: true, accountId});
  const form2 = await wait(() => root2.querySelector('.wallet-unlock-form'), 'unlock on a new visit');
  const setupOnRevisit = Boolean(root2.querySelector('.wallet-setup-why'));
  form2.querySelector('input').value = '2468'; form2.requestSubmit();
  await wait(() => root2.dataset.walletStorage, 'storage result on a new visit');
  window.__result = JSON.stringify({ok: true, why, callsBeforePin, afterCreate, unlockWhy, afterRelock, setupOnRevisit, afterRevisit: persistCalls, revisitResult: root2.dataset.walletStorage});
} catch (error) { window.__result = JSON.stringify({ok: false, error: String(error?.stack || error)}); }
</script></body></html>`;

const result = await runFixturePage({root: ROOT, fixturePath: '/__life_wallet_storage_persist_01.html', fixtureHtml, viewport: {width: 390, height: 844, mobile: true}, timeoutMs: 600000, resultExpression: 'window.__result || ""'});
assert.equal(result.ok, true, result.error);
const detail = JSON.stringify(result);
assert.match(result.why, /기기·브라우저마다 따로 저장/u, `the setup screen says why a new PIN is asked: ${detail}`);
assert.match(result.why, /암호화 백업 파일/u, `and how items move: ${detail}`);
assert.equal(result.callsBeforePin, 0, `nothing is asked before a PIN is made: ${detail}`);
assert.deepEqual(result.afterCreate, {calls: 1, result: 'best-effort'}, `making the PIN asks once; a refusal keeps the wallet working: ${detail}`);
assert.equal(result.unlockWhy, false, `the unlock screen does not show the new-PIN explanation: ${detail}`);
assert.equal(result.afterRelock, 1, `lock and unlock in the same visit do not ask again: ${detail}`);
assert.equal(result.setupOnRevisit, false, `the same browser keeps the wallet: PIN entry, not setup: ${detail}`);
assert.equal(result.afterRevisit, 2, `a new visit asks once after the PIN: ${detail}`);
assert.equal(result.revisitResult, 'best-effort', detail);
console.log('LIFE_WALLET_STORAGE_PERSIST_01 PASS — persist() after PIN (once per visit, refusal/absence harmless), setup explains a new PIN');
