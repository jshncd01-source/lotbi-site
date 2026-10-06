import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', {value: webcrypto});
if (!globalThis.btoa) globalThis.btoa = value => Buffer.from(value, 'binary').toString('base64');
if (!globalThis.atob) globalThis.atob = value => Buffer.from(value, 'base64').toString('binary');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const walletSource = await readFile(path.join(root, 'site-life-wallet.js'), 'utf8');
const consumerSource = await readFile(path.join(root, 'site-consumer-sections.js'), 'utf8');
const conversationSource = await readFile(path.join(root, 'site-conversation.js'), 'utf8');
const indexSource = await readFile(path.join(root, 'index.html'), 'utf8');
const {LifeWalletVault, MemoryWalletRepository, validateWalletPin} = await import('../site-life-wallet.js');

assert.equal(validateWalletPin('0123'), '0123', 'leading zero must be preserved');
for (const invalid of ['123', '12345', '12a4', 1234]) assert.throws(() => validateWalletPin(invalid));

const repository = new MemoryWalletRepository();
const wallet = new LifeWalletVault(repository);
const account = 'test-account-a';
await wallet.create(account, '0123');
await wallet.save(account, {
  id: 'synthetic-card', name: '테스트 회원증', kind: 'membership', note: '가상 자료',
  frontDataUrl: 'data:image/png;base64,AA==', backDataUrl: '', updatedAt: '2026-10-05T00:00:00.000Z',
});
const scope = [...repository.vaults.keys()][0];
const stored = repository.cards.get(`${scope}:synthetic-card`);
assert.ok(stored);
assert.doesNotMatch(JSON.stringify(stored), /테스트 회원증|가상 자료|data:image/u, 'stored record must not contain plaintext metadata or image');
wallet.lock();
await assert.rejects(() => wallet.list(account), /잠금을 먼저 해제/u);
await assert.rejects(() => wallet.unlock(account, '9999'), /PIN을 확인/u);
await wallet.unlock(account, '0123');
assert.equal((await wallet.list(account))[0].name, '테스트 회원증');
await wallet.changePin(account, '0123', '0007');
wallet.lock();
await assert.rejects(() => wallet.unlock(account, '0123'), /PIN을 확인/u);
await wallet.unlock(account, '0007');
const backup = await wallet.exportBackup(account, 'backup-password');
assert.doesNotMatch(backup, /테스트 회원증|가상 자료|data:image/u, 'backup must not contain plaintext card data');
const restored = await wallet.importBackup(account, backup, 'backup-password');
assert.equal(restored, 1, 'an existing ID must restore as a separate encrypted copy');
assert.equal((await wallet.list(account)).length, 2);

const otherAccount = 'test-account-b';
await wallet.create(otherAccount, '2468');
assert.equal((await wallet.list(otherAccount)).length, 0, 'another account must not see the first account records');
wallet.lock();
await wallet.unlock(account, '0007');
assert.equal((await wallet.list(account)).length, 2, 'returning to the first account restores only its records');

const limitedRepository = new MemoryWalletRepository();
const limitedWallet = new LifeWalletVault(limitedRepository);
await limitedWallet.create('rate-limited-account', '1357');
limitedWallet.lock();
for (let attempt = 1; attempt <= 5; attempt += 1) {
  if (attempt >= 4) {
    const current = [...limitedRepository.vaults.values()][0];
    await limitedRepository.putVault({...current, retryAfter: new Date(Date.now() - 1000).toISOString()});
  }
  await assert.rejects(() => limitedWallet.unlock('rate-limited-account', '9999'), /PIN을 확인/u);
  if (attempt === 3) await assert.rejects(() => limitedWallet.unlock('rate-limited-account', '1357'), /초 후/u);
}
await assert.rejects(() => limitedWallet.unlock('rate-limited-account', '1357'), /PIN 시도가 잠겼습니다/u);

assert.match(walletSource, /PIN_KDF_ITERATIONS = 310_000/u);
assert.match(walletSource, /generateKey\(\{name: 'AES-GCM', length: 256\}, false/u, 'device key must be non-extractable');
assert.match(walletSource, /document\.visibilityState === 'hidden'/u);
assert.match(walletSource, /INACTIVITY_MS = 10 \* 60_000/u);
assert.match(walletSource, /10분 동안 사용하지 않아 다시 잠겼습니다\./u);
assert.match(walletSource, /10분 비활동 시 자동으로 다시 잠깁니다\./u);
assert.doesNotMatch(walletSource, /60초 동안 사용하지 않아|60초 비활동/u);
assert.match(walletSource, /window\.addEventListener\('pagehide'/u);
assert.match(walletSource, /window\.addEventListener\('pageshow'/u);
assert.match(walletSource, /detail\?\.authenticated === false/u);
assert.match(consumerSource, /mountLifeWallet\(\{root, authenticated, accountId, sessionExpiresAt\}\)/u);
assert.match(walletSource, /MAX_PIN_FAILURES = 5/u);
assert.doesNotMatch(walletSource, /localStorage/u, 'wallet must not store secrets or data in localStorage');
assert.doesNotMatch(walletSource, /fetch\s*\(/u, 'wallet must not upload data');
assert.doesNotMatch(walletSource, /PublicKeyCredential|navigator\.credentials|WebAuthn/u, 'PC wallet must not claim or invoke device authentication');
assert.doesNotMatch(walletSource, /Windows Hello·지문·Face ID를 지원하는 것처럼 표시하지 않습니다|PC Web은 4자리 월렛 PIN만 사용합니다/u);
assert.match(walletSource, /AI로 재작성하지 않고 그대로 암호화/u);
assert.match(consumerSource, /mountLifeWallet/u);
assert.match(conversationSource, /accountId: serverIdentity\?\.userId/u);
assert.match(indexSource, /site-life-wallet\.css/u);

console.log('validate_life_wallet_entry_lock_01: PASS');
