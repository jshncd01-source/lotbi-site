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
const walletCssSource = await readFile(path.join(root, 'site-life-wallet.css'), 'utf8');
const consumerSource = await readFile(path.join(root, 'site-consumer-sections.js'), 'utf8');
const conversationSource = await readFile(path.join(root, 'site-conversation.js'), 'utf8');
const indexSource = await readFile(path.join(root, 'index.html'), 'utf8');
const walletModule = await import('../site-life-wallet.js');
const {LifeWalletVault, MemoryWalletRepository, validateWalletPin, validateBackupPasswordPair, canExportWalletBackup} = walletModule;

class MemorySessionStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

assert.equal(validateWalletPin('0123'), '0123', 'leading zero must be preserved');
for (const invalid of ['123', '12345', '12a4', 1234]) assert.throws(() => validateWalletPin(invalid));

assert.equal(typeof canExportWalletBackup, 'function', 'wallet backup availability policy must be implemented');
assert.equal(typeof validateBackupPasswordPair, 'function', 'backup password confirmation validation must be implemented');
assert.equal(canExportWalletBackup([]), false, 'an empty wallet must not offer an exportable backup');
assert.equal(canExportWalletBackup([{id: 'one-card'}]), true, 'a wallet with saved data must allow backup export');
assert.equal(validateBackupPasswordPair('backup-password', 'backup-password'), 'backup-password');
assert.throws(
  () => validateBackupPasswordPair('backup-password', 'different-password'),
  /일치하지 않습니다/u,
  'backup creation must reject a mistyped confirmation',
);

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

const simplifiedRepository = new MemoryWalletRepository();
const simplifiedWallet = new LifeWalletVault(simplifiedRepository);
await simplifiedWallet.create('simplified-add-account', '8642');
await simplifiedWallet.save('simplified-add-account', {
  id: 'auto-named-certificate', kind: 'certificate', note: '',
  frontDataUrl: 'data:image/png;base64,AA==', updatedAt: '2026-10-06T00:00:00.000Z',
});
const [simplifiedCard] = await simplifiedWallet.list('simplified-add-account');
assert.equal(simplifiedCard.name, '증명서', 'the selected kind must provide the stored display name');
assert.equal(simplifiedCard.backDataUrl, '', 'the single-photo flow must preserve an empty legacy back image');

const refreshRepository = new MemoryWalletRepository();
const refreshSession = new MemorySessionStorage();
let refreshNow = Date.parse('2026-10-06T01:00:00.000Z');
const refreshOptions = {sessionStorage: refreshSession, now: () => refreshNow};
const refreshWallet = new LifeWalletVault(refreshRepository, refreshOptions);
await refreshWallet.create('refresh-account', '7788');
await refreshWallet.save('refresh-account', {
  id: 'refresh-card', kind: 'membership', note: '새로고침 복원 테스트',
  frontDataUrl: 'data:image/png;base64,AA==', updatedAt: '2026-10-06T01:00:00.000Z',
});
const serializedGrant = [...refreshSession.values.values()].join('');
assert.ok(serializedGrant, 'unlocking must create a same-tab refresh grant');
assert.doesNotMatch(serializedGrant, /7788|새로고침 복원 테스트|data:image/u, 'the refresh grant must not expose PIN or wallet plaintext');

const refreshedWallet = new LifeWalletVault(refreshRepository, refreshOptions);
assert.equal(await refreshedWallet.resumeUnlock('refresh-account'), true, 'refresh within 10 minutes must restore the unlocked wallet');
assert.equal((await refreshedWallet.list('refresh-account'))[0].name, '회원증');

refreshNow += 9 * 60_000;
assert.equal(await refreshedWallet.refreshUnlockGrant('refresh-account'), true, 'activity must extend the refresh grant');
refreshNow += 2 * 60_000;
const activeRefreshWallet = new LifeWalletVault(refreshRepository, refreshOptions);
assert.equal(await activeRefreshWallet.resumeUnlock('refresh-account'), true, 'recent activity must keep refresh continuity beyond the original deadline');

refreshNow += 10 * 60_000 + 1;
const expiredRefreshWallet = new LifeWalletVault(refreshRepository, refreshOptions);
assert.equal(await expiredRefreshWallet.resumeUnlock('refresh-account'), false, 'refresh after 10 minutes must require the PIN again');
assert.equal(refreshSession.values.size, 0, 'an expired refresh grant must be removed');

await refreshWallet.unlock('refresh-account', '7788');
assert.ok(refreshSession.values.size > 0, 'PIN unlock must recreate the refresh grant');
refreshWallet.suspend();
await assert.rejects(
  () => refreshWallet.list('refresh-account'),
  /잠금을 먼저 해제/u,
  'backgrounding must clear the in-memory wallet key',
);
const backgroundReturnedWallet = new LifeWalletVault(refreshRepository, refreshOptions);
assert.equal(
  await backgroundReturnedWallet.resumeUnlock('refresh-account'),
  true,
  'returning from the background within 10 minutes must not require the PIN again',
);

await refreshWallet.unlock('refresh-account', '7788');
refreshWallet.lock();
assert.equal(refreshSession.values.size, 0, 'explicit locking must remove the refresh grant');
const explicitlyLockedWallet = new LifeWalletVault(refreshRepository, refreshOptions);
assert.equal(await explicitlyLockedWallet.resumeUnlock('refresh-account'), false, 'explicit locking must require the PIN after refresh');

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
assert.match(walletSource, /화면 이동·새로고침·백그라운드 전환 후에도 잠금 해제 상태가 유지됩니다\. 10분간 사용하지 않으면 다시 잠깁니다\./u);
assert.doesNotMatch(walletSource, /60초 동안 사용하지 않아|60초 비활동/u);
assert.match(walletSource, /await vault\.resumeUnlock\(accountId\)/u, 'mount must restore a valid same-tab unlock grant');
assert.match(walletSource, /vault\.lock\(\{preserveSession: true\}\)/u, 'page transitions must preserve the same-tab unlock grant');
assert.match(walletSource, /window\.addEventListener\('pagehide'/u);
assert.match(walletSource, /window\.addEventListener\('pageshow'/u);
assert.match(walletSource, /detail\?\.authenticated === false/u);
assert.match(consumerSource, /mountLifeWallet\(\{root, authenticated, accountId, sessionExpiresAt\}\)/u);
assert.match(walletSource, /MAX_PIN_FAILURES = 5/u);
assert.doesNotMatch(walletSource, /localStorage/u, 'wallet must not store secrets or data in localStorage');
assert.doesNotMatch(walletSource, /fetch\s*\(/u, 'wallet must not upload data');
assert.doesNotMatch(walletSource, /PublicKeyCredential|navigator\.credentials|WebAuthn/u, 'PC wallet must not claim or invoke device authentication');
assert.doesNotMatch(walletSource, /Windows Hello·지문·Face ID를 지원하는 것처럼 표시하지 않습니다|PC Web은 4자리 월렛 PIN만 사용합니다/u);
assert.doesNotMatch(walletSource, /field\('자료 이름', name\)|field\('뒷면 사진 · 선택', back\)/u);
assert.match(walletSource, /안전하게 이 기기에만 저장됩니다\./u);
assert.match(walletSource, /LOTBI 관리자도 원본을 볼 수 없으며, 기기 변경 시에는 다시 등록하거나 암호화 백업으로 복원해야 합니다\./u);
assert.match(walletCssSource, /\.wallet-storage-reassurance\s*\{/u, 'wallet storage reassurance must have a separate layout block');
assert.doesNotMatch(walletSource, /예시 신분증은 넣지 않습니다\./u);
assert.match(walletSource, /사용자가 직접 등록한 실제 자료만 여기에 표시됩니다\./u);
assert.match(walletSource, /aria-haspopup.*menu/u, 'wallet management must open from an accessible settings menu');
assert.match(walletSource, /wallet-settings-menu/u, 'wallet management actions must live in the settings menu');
assert.doesNotMatch(walletSource, /const manage = element\('div', 'wallet-manage'\)/u, 'management actions must not remain as a bottom button row');
assert.match(walletSource, /암호화 백업 파일 만들기/u);
assert.match(walletSource, /새 백업 전용 암호 · 8자 이상/u);
assert.match(walletSource, /백업을 복원할 때 이 암호가 반드시 필요합니다\./u);
assert.match(walletSource, /내 기기에 백업 파일 저장/u);
assert.match(walletSource, /백업에서 Life Wallet 복원/u);
assert.match(walletSource, /저장된 백업 파일 찾기/u);
assert.match(walletSource, /월렛 4자리 PIN이 아니라/u);
assert.match(walletSource, /파일이나 백업 암호를 분실하면 복원할 수 없습니다\./u);
assert.match(walletSource, /Life Wallet 자료 복원/u);
assert.match(walletSource, /AI로 재작성하지 않고 그대로 암호화/u);
assert.match(consumerSource, /mountLifeWallet/u);
assert.match(conversationSource, /accountId: serverIdentity\?\.userId/u);
assert.match(indexSource, /site-life-wallet\.css/u);

console.log('validate_life_wallet_entry_lock_01: PASS');
