import {createWalletDocumentScanner} from './site-life-wallet-scan-ui.js?v=aset-f373a600ca33';

const DATABASE_NAME = 'lotbi-life-wallet-site-v1';
const DATABASE_VERSION = 1;
const PIN_KDF_ITERATIONS = 310_000;
const BACKUP_KDF_ITERATIONS = 600_000;
const INACTIVITY_MS = 10 * 60_000;
const MAX_PIN_FAILURES = 5;
const BACKUP_AAD = 'LOTBI_LIFE_WALLET_BACKUP_V1';
const SESSION_GRANT_KEY = 'lotbi-life-wallet-unlock-v1';
// New items are saved as 'document'; the older kinds stay readable for saved items and backups.
const CARD_KINDS = Object.freeze([
  ['document', '저장 자료'],
  ['identity', '신분·자격 자료'],
  ['membership', '회원증'],
  ['certificate', '증명서'],
  ['other', '기타 생활 자료'],
]);

function cryptoHost() {
  if (!globalThis.crypto?.subtle || typeof globalThis.crypto.getRandomValues !== 'function') {
    throw new Error('이 브라우저에서는 안전한 월렛 암호화를 사용할 수 없습니다.');
  }
  return globalThis.crypto;
}

function utf8(value) { return new TextEncoder().encode(value); }
function decodeUtf8(value) { return new TextDecoder('utf-8', {fatal: true}).decode(value); }

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/u.test(value) || value.length % 4 !== 0) {
    throw new Error('암호화 데이터 형식이 올바르지 않습니다.');
  }
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function randomBytes(length) { return cryptoHost().getRandomValues(new Uint8Array(length)); }
function randomId() {
  if (typeof cryptoHost().randomUUID === 'function') return cryptoHost().randomUUID();
  return bytesToBase64(randomBytes(18)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function sha256(value) {
  return bytesToBase64(new Uint8Array(await cryptoHost().subtle.digest('SHA-256', utf8(value))));
}

async function importAesKey(raw) {
  if (!(raw instanceof Uint8Array) || raw.length !== 32) throw new Error('암호화 키 형식이 올바르지 않습니다.');
  return cryptoHost().subtle.importKey('raw', raw, {name: 'AES-GCM'}, false, ['encrypt', 'decrypt']);
}

function generateAesKey() {
  return cryptoHost().subtle.generateKey({name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
}

async function deriveAesKey(secret, salt, iterations) {
  const material = await cryptoHost().subtle.importKey('raw', utf8(secret), {name: 'PBKDF2'}, false, ['deriveKey']);
  return cryptoHost().subtle.deriveKey(
    {name: 'PBKDF2', hash: 'SHA-256', salt, iterations},
    material,
    {name: 'AES-GCM', length: 256},
    false,
    ['encrypt', 'decrypt'],
  );
}

async function seal(key, plaintext, aad) {
  const nonce = randomBytes(12);
  const ciphertext = await cryptoHost().subtle.encrypt(
    {name: 'AES-GCM', iv: nonce, additionalData: utf8(aad), tagLength: 128},
    key,
    utf8(plaintext),
  );
  return Object.freeze({algorithm: 'AES-256-GCM', nonce: bytesToBase64(nonce), ciphertext: bytesToBase64(new Uint8Array(ciphertext))});
}

async function openEnvelope(key, envelope, aad) {
  if (envelope?.algorithm !== 'AES-256-GCM') throw new Error('지원하지 않는 암호화 형식입니다.');
  try {
    const plaintext = await cryptoHost().subtle.decrypt(
      {name: 'AES-GCM', iv: base64ToBytes(envelope.nonce), additionalData: utf8(aad), tagLength: 128},
      key,
      base64ToBytes(envelope.ciphertext),
    );
    return decodeUtf8(plaintext);
  } catch {
    throw new Error('월렛 PIN 또는 백업 암호를 확인해 주세요.');
  }
}

export function validateWalletPin(pin) {
  if (typeof pin !== 'string' || !/^\d{4}$/u.test(pin)) throw new Error('월렛 PIN은 숫자 4자리로 입력해 주세요.');
  return pin;
}

function validateBackupPassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new Error('백업 암호는 8자 이상 128자 이하로 입력해 주세요.');
  }
}

export function validateBackupPasswordPair(password, confirmation) {
  validateBackupPassword(password);
  if (password !== confirmation) throw new Error('백업 전용 암호가 일치하지 않습니다.');
  return password;
}

export function canExportWalletBackup(cards) {
  return Array.isArray(cards) && cards.length > 0;
}

export async function accountScope(accountId) {
  const normalized = typeof accountId === 'string' ? accountId.trim() : '';
  if (!normalized) throw new Error('로그인 계정을 확인할 수 없습니다.');
  return sha256(`lotbi-life-wallet-account:${normalized}`);
}

function pinAad(scope) { return `lotbi-wallet-pin:v2:${scope}`; }
function deviceAad(scope) { return `lotbi-wallet-device:v2:${scope}`; }
function sessionAad(scope, expiresAt) { return `lotbi-wallet-session:v1:${scope}:${expiresAt}`; }
function cardAad(scope, id) { return `lotbi-wallet-card:v1:${scope}:${id}`; }
function storageKey(scope, id) { return `${scope}:${id}`; }

function availableSessionStorage() {
  try { return globalThis.sessionStorage || null; }
  catch { return null; }
}

function request(value) {
  return new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error || new Error('브라우저 보관함 작업을 완료하지 못했습니다.'));
  });
}

function completed(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('브라우저 보관함 저장을 완료하지 못했습니다.'));
    transaction.onabort = () => reject(transaction.error || new Error('브라우저 보관함 저장이 취소되었습니다.'));
  });
}

export class IndexedDbWalletRepository {
  constructor() { this.databasePromise = undefined; }

  async getVault(scope) {
    return (await request((await this.db()).transaction('vaults', 'readonly').objectStore('vaults').get(scope))) || null;
  }

  async putVault(vault) {
    const transaction = (await this.db()).transaction('vaults', 'readwrite');
    transaction.objectStore('vaults').put(vault);
    await completed(transaction);
  }

  async getDeviceKey(scope) {
    const row = await request((await this.db()).transaction('deviceKeys', 'readonly').objectStore('deviceKeys').get(scope));
    return row?.key || null;
  }

  async putDeviceKey(scope, key) {
    const transaction = (await this.db()).transaction('deviceKeys', 'readwrite');
    transaction.objectStore('deviceKeys').put({scope, key});
    await completed(transaction);
  }

  async listCards(scope) {
    const transaction = (await this.db()).transaction('cards', 'readonly');
    const rows = await request(transaction.objectStore('cards').index('scope').getAll(scope));
    return rows.map(({id, envelope}) => ({scope, id, envelope}));
  }

  async getCard(scope, id) {
    const row = await request((await this.db()).transaction('cards', 'readonly').objectStore('cards').get(storageKey(scope, id)));
    return row ? {scope, id, envelope: row.envelope} : null;
  }

  async putCard(card) {
    const transaction = (await this.db()).transaction('cards', 'readwrite');
    transaction.objectStore('cards').put({...card, storageKey: storageKey(card.scope, card.id)});
    await completed(transaction);
  }

  async removeCard(scope, id) {
    const transaction = (await this.db()).transaction('cards', 'readwrite');
    transaction.objectStore('cards').delete(storageKey(scope, id));
    await completed(transaction);
  }

  db() {
    if (this.databasePromise) return this.databasePromise;
    this.databasePromise = new Promise((resolve, reject) => {
      const openRequest = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      openRequest.onupgradeneeded = () => {
        const database = openRequest.result;
        if (!database.objectStoreNames.contains('vaults')) database.createObjectStore('vaults', {keyPath: 'scope'});
        if (!database.objectStoreNames.contains('deviceKeys')) database.createObjectStore('deviceKeys', {keyPath: 'scope'});
        if (!database.objectStoreNames.contains('cards')) {
          const cards = database.createObjectStore('cards', {keyPath: 'storageKey'});
          cards.createIndex('scope', 'scope', {unique: false});
        }
      };
      openRequest.onsuccess = () => resolve(openRequest.result);
      openRequest.onerror = () => reject(openRequest.error || new Error('암호화된 브라우저 보관함을 열지 못했습니다.'));
      openRequest.onblocked = () => reject(new Error('다른 탭의 Life Wallet을 닫고 다시 시도해 주세요.'));
    });
    return this.databasePromise;
  }
}

export class MemoryWalletRepository {
  constructor() {
    this.vaults = new Map();
    this.deviceKeys = new Map();
    this.cards = new Map();
  }
  async getVault(scope) { return this.vaults.get(scope) || null; }
  async putVault(vault) { this.vaults.set(vault.scope, vault); }
  async getDeviceKey(scope) { return this.deviceKeys.get(scope) || null; }
  async putDeviceKey(scope, key) { this.deviceKeys.set(scope, key); }
  async listCards(scope) { return [...this.cards.values()].filter(card => card.scope === scope); }
  async getCard(scope, id) { return this.cards.get(storageKey(scope, id)) || null; }
  async putCard(card) { this.cards.set(storageKey(card.scope, card.id), card); }
  async removeCard(scope, id) { this.cards.delete(storageKey(scope, id)); }
}

// What a saved item is called on screen: the first line of its memo (shortened), otherwise
// its kind with the save date, so new items do not all read "저장 자료". Nothing is read from
// the image itself.
export function walletCardTitle(card) {
  const memo = String(card.note || '').split(/\r?\n/u).map(line => line.trim()).find(Boolean);
  if (memo) return memo.length > 24 ? `${memo.slice(0, 24)}…` : memo;
  const saved = new Date(card.updatedAt);
  if (!Number.isFinite(saved.getTime())) return card.name;
  return `${card.name} · ${saved.getFullYear()}.${String(saved.getMonth() + 1).padStart(2, '0')}.${String(saved.getDate()).padStart(2, '0')}`;
}

function validateCard(card) {
  if (!card || typeof card !== 'object' || typeof card.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/u.test(card.id)) throw new Error('자료 식별정보가 올바르지 않습니다.');
  const kindLabel = CARD_KINDS.find(([value]) => value === card.kind)?.[1];
  if (!kindLabel) throw new Error('자료 종류가 올바르지 않습니다.');
  if (card.name !== undefined && typeof card.name !== 'string') throw new Error('자료 이름 형식이 올바르지 않습니다.');
  const name = card.name?.trim() || kindLabel;
  if (name.length > 80) throw new Error('자료 이름은 80자 이하로 입력해 주세요.');
  if (typeof card.frontDataUrl !== 'string' || card.frontDataUrl.length > 17_000_000 || !/^data:image\/(?:jpeg|png);base64,/u.test(card.frontDataUrl)) throw new Error('앞면 이미지를 확인해 주세요.');
  const backDataUrl = card.backDataUrl === undefined ? '' : card.backDataUrl;
  if (typeof backDataUrl !== 'string' || (backDataUrl && (backDataUrl.length > 17_000_000 || !/^data:image\/(?:jpeg|png);base64,/u.test(backDataUrl)))) throw new Error('뒷면 이미지를 확인해 주세요.');
  if (typeof card.note !== 'string' || card.note.length > 1000) throw new Error('메모는 1,000자 이하로 입력해 주세요.');
  if (typeof card.updatedAt !== 'string' || !Number.isFinite(Date.parse(card.updatedAt))) throw new Error('자료 수정 시간이 올바르지 않습니다.');
  return Object.freeze({...card, name, backDataUrl});
}

export class LifeWalletVault {
  constructor(repository, {sessionStorage = availableSessionStorage(), now = () => Date.now()} = {}) {
    this.repository = repository;
    this.sessionStorage = sessionStorage;
    this.now = now;
    this.unlocked = null;
  }

  async hasVault(accountId) { return Boolean(await this.repository.getVault(await accountScope(accountId))); }

  async create(accountId, pin) {
    validateWalletPin(pin);
    const scope = await accountScope(accountId);
    if (await this.repository.getVault(scope)) throw new Error('이 계정의 Life Wallet이 이미 만들어져 있습니다.');
    const deviceKey = await generateAesKey();
    await this.repository.putDeviceKey(scope, deviceKey);
    const salt = randomBytes(16);
    const pinKey = await deriveAesKey(pin, salt, PIN_KDF_ITERATIONS);
    const rawMasterKey = randomBytes(32);
    try {
      const pinEnvelope = await seal(pinKey, bytesToBase64(rawMasterKey), pinAad(scope));
      const wrappedKey = await seal(deviceKey, JSON.stringify(pinEnvelope), deviceAad(scope));
      await this.repository.putVault({scope, version: 2, salt: bytesToBase64(salt), wrappedKey, failedAttempts: 0, pinBlocked: false});
      this.unlocked = {scope, key: await importAesKey(rawMasterKey)};
      await this.persistUnlockGrant(scope, rawMasterKey);
    } finally {
      rawMasterKey.fill(0);
    }
  }

  async unlock(accountId, pin) {
    validateWalletPin(pin);
    const scope = await accountScope(accountId);
    const vault = await this.repository.getVault(scope);
    if (!vault) throw new Error('이 계정의 Life Wallet을 먼저 만들어 주세요.');
    this.assertAttemptAllowed(vault);
    try {
      const rawMasterKey = await this.unwrapMasterKey(scope, vault, pin);
      try {
        this.unlocked = {scope, key: await importAesKey(rawMasterKey)};
        await this.persistUnlockGrant(scope, rawMasterKey);
      }
      finally { rawMasterKey.fill(0); }
      await this.repository.putVault({...vault, failedAttempts: 0, pinBlocked: false, retryAfter: undefined});
    } catch (error) {
      if (error?.pinControl === true) throw error;
      await this.recordFailure(vault);
      throw new Error('월렛 PIN을 확인해 주세요.');
    }
  }

  async changePin(accountId, currentPin, nextPin) {
    validateWalletPin(currentPin); validateWalletPin(nextPin);
    const unlocked = await this.requireUnlocked(accountId);
    const vault = await this.repository.getVault(unlocked.scope);
    if (!vault) throw new Error('Life Wallet 설정을 찾지 못했습니다.');
    this.assertAttemptAllowed(vault);
    let rawMasterKey;
    try {
      rawMasterKey = await this.unwrapMasterKey(unlocked.scope, vault, currentPin);
    } catch {
      await this.recordFailure(vault);
      throw new Error('현재 월렛 PIN을 확인해 주세요.');
    }
    try {
      const salt = randomBytes(16);
      const nextKey = await deriveAesKey(nextPin, salt, PIN_KDF_ITERATIONS);
      const inner = await seal(nextKey, bytesToBase64(rawMasterKey), pinAad(unlocked.scope));
      const deviceKey = await this.repository.getDeviceKey(unlocked.scope);
      if (!deviceKey) throw new Error('이 브라우저의 월렛 보호 키를 찾지 못했습니다.');
      const wrappedKey = await seal(deviceKey, JSON.stringify(inner), deviceAad(unlocked.scope));
      await this.repository.putVault({...vault, salt: bytesToBase64(salt), wrappedKey, failedAttempts: 0, pinBlocked: false, retryAfter: undefined});
    } finally {
      rawMasterKey.fill(0);
    }
  }

  // Asks for the PIN again before a step that cannot be undone (deleting an item). A wrong
  // PIN counts as a failed attempt, exactly like unlocking.
  async verifyPin(accountId, pin) {
    validateWalletPin(pin);
    const unlocked = await this.requireUnlocked(accountId);
    const vault = await this.repository.getVault(unlocked.scope);
    if (!vault) throw new Error('Life Wallet 설정을 찾지 못했습니다.');
    this.assertAttemptAllowed(vault);
    let rawMasterKey;
    try {
      rawMasterKey = await this.unwrapMasterKey(unlocked.scope, vault, pin);
    } catch (error) {
      if (error?.pinControl === true) throw error;
      await this.recordFailure(vault);
      throw new Error('월렛 PIN을 확인해 주세요.');
    }
    rawMasterKey.fill(0);
    await this.repository.putVault({...vault, failedAttempts: 0, pinBlocked: false, retryAfter: undefined});
  }

  lock({preserveSession = false} = {}) {
    this.unlocked = null;
    if (!preserveSession) this.clearUnlockGrant();
  }

  suspend() {
    this.lock({preserveSession: true});
  }

  async resumeUnlock(accountId) {
    const scope = await accountScope(accountId);
    const grant = this.readUnlockGrant();
    if (!grant || grant.scope !== scope || grant.expiresAt <= this.now() || grant.expiresAt > this.now() + INACTIVITY_MS) {
      this.clearUnlockGrant();
      return false;
    }
    try {
      const deviceKey = await this.repository.getDeviceKey(scope);
      if (!deviceKey) throw new Error('이 브라우저의 월렛 보호 키를 찾지 못했습니다.');
      const rawMasterKey = base64ToBytes(await openEnvelope(deviceKey, grant.envelope, sessionAad(scope, grant.expiresAt)));
      try { this.unlocked = {scope, key: await importAesKey(rawMasterKey)}; }
      finally { rawMasterKey.fill(0); }
      return true;
    } catch {
      this.clearUnlockGrant();
      return false;
    }
  }

  async refreshUnlockGrant(accountId) {
    const scope = await accountScope(accountId);
    if (!this.unlocked || this.unlocked.scope !== scope) return false;
    const grant = this.readUnlockGrant();
    if (!grant || grant.scope !== scope || grant.expiresAt <= this.now()) {
      this.clearUnlockGrant();
      return false;
    }
    try {
      const deviceKey = await this.repository.getDeviceKey(scope);
      if (!deviceKey) return false;
      const rawMasterKey = base64ToBytes(await openEnvelope(deviceKey, grant.envelope, sessionAad(scope, grant.expiresAt)));
      try { await this.persistUnlockGrant(scope, rawMasterKey); }
      finally { rawMasterKey.fill(0); }
      return true;
    } catch {
      this.clearUnlockGrant();
      return false;
    }
  }

  async persistUnlockGrant(scope, rawMasterKey) {
    if (!this.sessionStorage) return;
    try {
      const deviceKey = await this.repository.getDeviceKey(scope);
      if (!deviceKey) return;
      const expiresAt = this.now() + INACTIVITY_MS;
      const envelope = await seal(deviceKey, bytesToBase64(rawMasterKey), sessionAad(scope, expiresAt));
      this.sessionStorage.setItem(SESSION_GRANT_KEY, JSON.stringify({scope, expiresAt, envelope}));
    } catch {
      this.clearUnlockGrant();
    }
  }

  readUnlockGrant() {
    if (!this.sessionStorage) return null;
    try {
      const grant = JSON.parse(this.sessionStorage.getItem(SESSION_GRANT_KEY) || 'null');
      return grant && typeof grant.scope === 'string' && Number.isFinite(grant.expiresAt) && grant.envelope ? grant : null;
    } catch { return null; }
  }

  clearUnlockGrant() {
    try { this.sessionStorage?.removeItem(SESSION_GRANT_KEY); }
    catch { /* Session storage can be unavailable under restrictive browser settings. */ }
  }

  async list(accountId) {
    const unlocked = await this.requireUnlocked(accountId);
    const records = await this.repository.listCards(unlocked.scope);
    const cards = await Promise.all(records.map(record => this.decryptCard(unlocked.key, record)));
    return Object.freeze(cards.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
  }

  async save(accountId, value) {
    const unlocked = await this.requireUnlocked(accountId);
    const card = validateCard(value);
    const envelope = await seal(unlocked.key, JSON.stringify(card), cardAad(unlocked.scope, card.id));
    await this.repository.putCard({scope: unlocked.scope, id: card.id, envelope});
    return card;
  }

  async remove(accountId, id) {
    const unlocked = await this.requireUnlocked(accountId);
    await this.repository.removeCard(unlocked.scope, id);
  }

  async exportBackup(accountId, password) {
    validateBackupPassword(password);
    const cards = await this.list(accountId);
    const salt = randomBytes(16);
    const key = await deriveAesKey(password, salt, BACKUP_KDF_ITERATIONS);
    const cipher = await seal(key, JSON.stringify({cards}), BACKUP_AAD);
    return JSON.stringify({
      format: 'LOTBI_LIFE_WALLET', version: 1,
      kdf: {name: 'PBKDF2-HMAC-SHA-256', iterations: BACKUP_KDF_ITERATIONS, salt: bytesToBase64(salt)},
      cipher: {...cipher, aad: BACKUP_AAD},
    });
  }

  async importBackup(accountId, serialized, password) {
    validateBackupPassword(password);
    const unlocked = await this.requireUnlocked(accountId);
    let backup;
    try { backup = JSON.parse(serialized); } catch { throw new Error('선택한 파일은 LOTBI Life Wallet 백업이 아닙니다.'); }
    if (backup?.format !== 'LOTBI_LIFE_WALLET' || backup?.version !== 1 || backup?.kdf?.name !== 'PBKDF2-HMAC-SHA-256'
      || backup?.kdf?.iterations !== BACKUP_KDF_ITERATIONS || backup?.cipher?.aad !== BACKUP_AAD) {
      throw new Error('지원하지 않거나 손상된 LOTBI Life Wallet 백업입니다.');
    }
    const key = await deriveAesKey(password, base64ToBytes(backup.kdf.salt), BACKUP_KDF_ITERATIONS);
    let payload;
    try { payload = JSON.parse(await openEnvelope(key, backup.cipher, BACKUP_AAD)); }
    catch { throw new Error('백업 암호를 확인해 주세요.'); }
    if (!Array.isArray(payload.cards)) throw new Error('백업 자료 목록이 올바르지 않습니다.');
    const existing = new Map((await this.list(accountId)).map(card => [card.id, card]));
    let imported = 0;
    for (const candidate of payload.cards) {
      let card = validateCard(candidate);
      if (existing.has(card.id)) card = Object.freeze({...card, id: randomId(), name: `${card.name} (복원 사본)`, updatedAt: new Date().toISOString()});
      const envelope = await seal(unlocked.key, JSON.stringify(card), cardAad(unlocked.scope, card.id));
      await this.repository.putCard({scope: unlocked.scope, id: card.id, envelope});
      imported += 1;
    }
    return imported;
  }

  async requireUnlocked(accountId) {
    const scope = await accountScope(accountId);
    if (!this.unlocked || this.unlocked.scope !== scope) throw new Error('Life Wallet 잠금을 먼저 해제해 주세요.');
    return this.unlocked;
  }

  assertAttemptAllowed(vault) {
    if (vault.pinBlocked) throw Object.assign(new Error('PIN 시도가 잠겼습니다. 자료를 지우지 말고 LOTBI 지원에 문의해 주세요.'), {pinControl: true});
    if (vault.retryAfter) {
      const remaining = Date.parse(vault.retryAfter) - Date.now();
      if (remaining > 0) throw Object.assign(new Error(`PIN 재시도는 ${Math.ceil(remaining / 1000)}초 후에 가능합니다.`), {pinControl: true});
    }
  }

  async unwrapMasterKey(scope, vault, pin) {
    const deviceKey = await this.repository.getDeviceKey(scope);
    if (!deviceKey) throw Object.assign(new Error('이 브라우저의 월렛 보호 키를 찾지 못했습니다.'), {pinControl: true});
    const serialized = await openEnvelope(deviceKey, vault.wrappedKey, deviceAad(scope));
    const inner = JSON.parse(serialized);
    const pinKey = await deriveAesKey(pin, base64ToBytes(vault.salt), PIN_KDF_ITERATIONS);
    return base64ToBytes(await openEnvelope(pinKey, inner, pinAad(scope)));
  }

  async recordFailure(vault) {
    const failedAttempts = Number(vault.failedAttempts || 0) + 1;
    const pinBlocked = failedAttempts >= MAX_PIN_FAILURES;
    const seconds = failedAttempts >= 3 && !pinBlocked ? Math.min(300, 30 * (2 ** (failedAttempts - 3))) : 0;
    await this.repository.putVault({...vault, failedAttempts, pinBlocked, retryAfter: seconds ? new Date(Date.now() + seconds * 1000).toISOString() : undefined});
  }

  async decryptCard(key, record) {
    return validateCard(JSON.parse(await openEnvelope(key, record.envelope, cardAad(record.scope, record.id))));
  }
}

function element(tag, className = '', text = '') {
  const value = document.createElement(tag);
  if (className) value.className = className;
  if (text) value.textContent = text;
  return value;
}

function button(label, onClick, secondary = false) {
  const value = element('button', `consumer-action${secondary ? ' consumer-action-secondary' : ''}`, label);
  value.type = 'button';
  if (onClick) value.addEventListener('click', onClick);
  return value;
}

function field(labelText, input) {
  const label = element('label', 'wallet-field');
  label.append(element('span', '', labelText), input);
  return label;
}

function pinInput(label) {
  const input = element('input', 'wallet-pin-input');
  input.type = 'password'; input.inputMode = 'numeric'; input.autocomplete = 'off'; input.maxLength = 4;
  input.pattern = '[0-9]{4}'; input.setAttribute('aria-label', label);
  input.addEventListener('input', () => { input.value = input.value.replace(/\D/gu, '').slice(0, 4); });
  return input;
}

function setBusy(form, busy) {
  for (const control of form.querySelectorAll('button, input, select, textarea')) control.disabled = busy;
  form.setAttribute('aria-busy', String(busy));
}

function errorRegion() {
  const region = element('p', 'wallet-message'); region.setAttribute('role', 'status'); region.setAttribute('aria-live', 'polite');
  return region;
}

function safeMessage(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
}

// Photos (JPG, PNG) or a PDF; a PDF page is drawn into an image in this browser.
function validateImageFile(file) {
  if (!(file instanceof File)) throw new Error('자료 사진을 선택해 주세요.');
  const pdf = file.type === 'application/pdf' || (!file.type && /\.pdf$/iu.test(file.name));
  if (!pdf && !['image/jpeg', 'image/png'].includes(file.type)) throw new Error('JPG·PNG 사진이나 PDF만 등록할 수 있습니다.');
  if (pdf && file.size > 20 * 1024 * 1024) throw new Error('PDF는 20MB 이하로 선택해 주세요.');
  if (!pdf && file.size > 12 * 1024 * 1024) throw new Error('이미지는 한 장당 12MB 이하로 선택해 주세요.');
}

export function createWalletPhotoPicker({onError = () => {}, onReady = () => {}} = {}) {
  const fieldShell = element('div', 'wallet-field wallet-photo-field');
  const label = element('span', 'wallet-photo-label', '자료 사진 · 필수');
  const input = element('input', 'wallet-photo-input');
  input.type = 'file';
  input.accept = 'image/jpeg,image/png,application/pdf,.pdf';
  label.id = `wallet-photo-${randomId()}`;
  input.setAttribute('aria-labelledby', label.id);

  const picker = element('div', 'wallet-photo-picker');
  const mark = element('button', 'wallet-photo-mark', '+');
  mark.type = 'button';
  mark.setAttribute('aria-label', '자료 사진 선택');
  mark.addEventListener('click', () => input.click());
  const preview = element('img', 'wallet-photo-preview');
  preview.hidden = true;
  const copy = element('span', 'wallet-photo-copy');
  const title = element('strong', '', '자료 사진 추가');
  const help = element('small', '', 'JPG·PNG 사진 12MB · PDF 20MB 이하');
  copy.append(title, help);
  const trigger = button('사진 선택', () => input.click(), true);
  trigger.classList.add('wallet-photo-action');
  const scannerHost = element('div', 'wallet-photo-scanner-host');
  let scanner = null;
  let confirmedDataUrl = '';

  const clearScanner = () => {
    scanner?.destroy();
    scanner = null;
    scannerHost.replaceChildren();
  };

  const resetSelection = () => {
    confirmedDataUrl = '';
    onReady(false);
    mark.hidden = false;
    preview.hidden = true;
    preview.removeAttribute('src');
    preview.alt = '';
    title.textContent = '자료 사진 추가';
    help.textContent = 'JPG·PNG 사진 12MB · PDF 20MB 이하';
    trigger.textContent = '사진 선택';
  };

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    onError('');
    try {
      validateImageFile(file);
      clearScanner();
      confirmedDataUrl = '';
      onReady(false);
      mark.hidden = true;
      preview.hidden = true;
      preview.removeAttribute('src');
      title.textContent = '사진 보정 중';
      help.textContent = '모서리와 보정 결과를 확인해 주세요.';
      trigger.textContent = '다시 선택';
      scanner = createWalletDocumentScanner({
        file,
        onConfirm(dataUrl) {
          confirmedDataUrl = dataUrl;
          clearScanner();
          preview.src = dataUrl;
          preview.alt = `보정된 ${file.name} 미리보기`;
          preview.hidden = false;
          title.textContent = file.name;
          help.textContent = '확인한 보정 결과를 암호화하여 저장합니다.';
          trigger.textContent = '사진 변경';
          onReady(true);
        },
        onCancel() {
          input.value = '';
          clearScanner();
          resetSelection();
        },
        onReplace() {
          input.value = '';
          clearScanner();
          resetSelection();
          input.click();
        },
      });
      scannerHost.append(scanner.element);
    } catch (error) {
      input.value = '';
      clearScanner();
      resetSelection();
      onError(safeMessage(error, '사진을 선택하지 못했습니다.'));
    }
  });

  picker.append(input, mark, preview, copy, trigger);
  fieldShell.append(label, picker, scannerHost);
  return Object.freeze({
    element: fieldShell,
    input,
    async readDataUrl() {
      if (!confirmedDataUrl) throw new Error('사진 보정 결과를 확인한 뒤 저장해 주세요.');
      return confirmedDataUrl;
    },
    destroy: clearScanner,
  });
}

export function createWalletCardCarousel({cards, onOpen}) {
  const shell = element('section', 'wallet-card-carousel');
  shell.setAttribute('aria-label', '저장 자료');
  const viewport = element('div', 'wallet-card-viewport');
  viewport.tabIndex = 0;
  viewport.setAttribute('aria-label', '저장 자료 카드 슬라이더');
  const track = element('div', 'wallet-card-track');
  const items = cards.map((card, index) => {
    const item = button('', () => onOpen(card), true);
    item.className = 'wallet-card';
    item.setAttribute('aria-label', `${index + 1}번째 저장 자료 열기`);
    const image = element('img', 'wallet-card-image');
    image.src = card.frontDataUrl;
    image.alt = `${index + 1}번째 저장 자료`;
    image.draggable = false;
    item.append(image);
    track.append(item);
    return item;
  });
  viewport.append(track);
  shell.append(viewport);

  if (items.length < 2) {
    shell.classList.add('wallet-card-carousel-single');
    items[0]?.setAttribute('aria-current', 'true');
    return shell;
  }

  // One card at a time, like a phone wallet: swipe or drag to the next card; the dots show
  // where you are and also move there for keyboard and screen-reader users.
  let currentIndex = 0;
  let programmaticTargetLeft = null;
  const navigation = element('div', 'wallet-card-dots');
  const dots = items.map((_, index) => {
    const dot = element('button', 'wallet-card-dot');
    dot.type = 'button';
    dot.dataset.walletCarouselDot = String(index);
    dot.setAttribute('aria-label', `${index + 1}번째 자료 보기`);
    dot.addEventListener('click', () => show(index));
    return dot;
  });
  const position = element('span', 'wallet-card-position');
  position.setAttribute('aria-live', 'polite');

  // The strip is as tall as the card on screen, so a short ID card is not framed by the
  // empty height of a tall page saved next to it.
  function fitHeight() {
    const item = items[currentIndex];
    if (item.offsetHeight) viewport.style.height = `${item.offsetHeight + 10}px`;
  }

  function updateState(index) {
    currentIndex = Math.max(0, Math.min(index, items.length - 1));
    items.forEach((item, itemIndex) => {
      if (itemIndex === currentIndex) item.setAttribute('aria-current', 'true');
      else item.removeAttribute('aria-current');
    });
    dots.forEach((dot, dotIndex) => {
      if (dotIndex === currentIndex) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
    position.textContent = `${currentIndex + 1} / ${items.length}`;
    fitHeight();
  }
  items.forEach(item => item.querySelector('img').addEventListener('load', fitHeight));

  // Card centres in the strip's own scroll coordinates (offsetLeft would add the page margin).
  function centerOf(item) {
    const frame = viewport.getBoundingClientRect();
    const rect = item.getBoundingClientRect();
    return viewport.scrollLeft + rect.left - frame.left + (rect.width / 2);
  }

  function show(index) {
    updateState(index);
    const item = items[currentIndex];
    const centeredLeft = centerOf(item) - (viewport.clientWidth / 2);
    programmaticTargetLeft = Math.max(0, Math.min(centeredLeft, viewport.scrollWidth - viewport.clientWidth));
    viewport.scrollTo({
      left: programmaticTargetLeft,
      behavior: 'smooth',
    });
  }

  let scrollFrame = 0;
  viewport.addEventListener('scroll', () => {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(() => {
      if (programmaticTargetLeft !== null) {
        if (Math.abs(viewport.scrollLeft - programmaticTargetLeft) > 2) return;
        programmaticTargetLeft = null;
      }
      const center = viewport.scrollLeft + (viewport.clientWidth / 2);
      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      items.forEach((item, index) => {
        const distance = Math.abs(center - centerOf(item));
        if (distance < nearestDistance) { nearestDistance = distance; nearestIndex = index; }
      });
      if (nearestIndex !== currentIndex) updateState(nearestIndex);
    });
  }, {passive: true});
  viewport.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    show(currentIndex + (event.key === 'ArrowRight' ? 1 : -1));
  });
  // A mouse drags the strip the way a finger swipes it (touch and pen already scroll
  // natively). Snapping pauses while dragging; on release the strip settles on the card the
  // drag reached, or the next one in the drag direction. A drag never opens a card. No
  // pointer capture: it would retarget a plain click away from the card.
  let drag = null;
  let suppressClick = false;
  const dragMove = event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const distance = event.clientX - drag.x;
    if (!drag.moved && Math.abs(distance) < 6) return;
    if (!drag.moved) {
      drag.moved = true;
      programmaticTargetLeft = null;
      viewport.dataset.dragging = 'true';
    }
    event.preventDefault();
    viewport.scrollLeft = drag.left - distance;
  };
  const dragEnd = event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const {moved, x, startIndex} = drag;
    drag = null;
    window.removeEventListener('pointermove', dragMove);
    window.removeEventListener('pointerup', dragEnd);
    window.removeEventListener('pointercancel', dragEnd);
    if (!moved) return;
    delete viewport.dataset.dragging;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    const distance = event.clientX - x;
    const reached = currentIndex;
    show(reached === startIndex && Math.abs(distance) > viewport.clientWidth * .12 ? startIndex + (distance < 0 ? 1 : -1) : reached);
  };
  viewport.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || drag) return;
    drag = {pointerId: event.pointerId, x: event.clientX, left: viewport.scrollLeft, startIndex: currentIndex, moved: false};
    window.addEventListener('pointermove', dragMove);
    window.addEventListener('pointerup', dragEnd);
    window.addEventListener('pointercancel', dragEnd);
  });
  viewport.addEventListener('click', event => {
    if (!suppressClick) return;
    event.preventDefault();
    event.stopPropagation();
  }, true);
  navigation.append(...dots, position);
  shell.append(navigation);
  updateState(0);
  return shell;
}

function downloadBackup(serialized) {
  const url = URL.createObjectURL(new Blob([serialized], {type: 'application/octet-stream'}));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `lotbi-life-wallet-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}.lotbiwallet`;
  anchor.rel = 'noopener'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function mountLifeWallet({root, authenticated = false, accountId = '', sessionExpiresAt = ''} = {}) {
  const vault = new LifeWalletVault(new IndexedDbWalletRepository());
  let disposed = false;
  let unlocked = false;
  let sessionAuthenticated = authenticated;
  let timer;
  let sessionTimer;
  let backgroundTimer;
  let grantRefreshPending = false;
  let renderGeneration = 0;

  const activity = () => {
    if (!unlocked || disposed) return;
    clearTimeout(timer);
    timer = setTimeout(() => { void lockAndRender('10분 동안 사용하지 않아 다시 잠겼습니다.'); }, INACTIVITY_MS);
    if (!grantRefreshPending) {
      grantRefreshPending = true;
      void vault.refreshUnlockGrant(accountId).finally(() => { grantRefreshPending = false; });
    }
  };
  const activityEvents = ['pointerdown', 'keydown', 'input'];
  for (const name of activityEvents) root.addEventListener(name, activity, {passive: true});

  const sessionListener = event => {
    if (event instanceof CustomEvent && event.detail?.authenticated === false) {
      sessionAuthenticated = false;
      void lockAndRender('로그아웃되어 Life Wallet이 잠겼습니다.');
    }
  };
  const visibilityListener = () => {
    clearTimeout(backgroundTimer);
    if (document.visibilityState === 'hidden' && unlocked) {
      backgroundTimer = setTimeout(() => {
        if (document.visibilityState === 'hidden' && unlocked) {
          unlocked = false;
          vault.suspend();
          clearTimeout(timer);
          root.replaceChildren();
        }
      }, 150);
      return;
    }
    if (document.visibilityState === 'visible' && !unlocked && root.childElementCount === 0) void restoreOrRender();
  };
  const pagehideListener = () => {
    clearTimeout(backgroundTimer); unlocked = false; vault.lock({preserveSession: true}); clearTimeout(timer); root.replaceChildren();
  };
  const pageshowListener = () => { if (!disposed && root.childElementCount === 0) void restoreOrRender(); };
  window.addEventListener('lotbi:site-session-state', sessionListener);
  document.addEventListener('visibilitychange', visibilityListener);
  window.addEventListener('pagehide', pagehideListener);
  window.addEventListener('pageshow', pageshowListener);
  const expiryMilliseconds = Date.parse(sessionExpiresAt);
  if (Number.isFinite(expiryMilliseconds)) {
    sessionTimer = setTimeout(() => {
      sessionAuthenticated = false;
      void lockAndRender('로그인 시간이 끝나 Life Wallet이 잠겼습니다.');
    }, Math.max(0, Math.min(expiryMilliseconds - Date.now(), 2_147_000_000)));
  }

  async function lockAndRender(message = '') {
    unlocked = false; vault.lock(); clearTimeout(timer); renderGeneration += 1;
    if (!disposed) await renderLocked(message);
  }

  function renderNotice(title, copy, actionNode) {
    const state = element('section', 'wallet-gate');
    state.append(element('div', 'wallet-lock-mark', '●'), element('h3', '', title), element('p', '', copy));
    if (actionNode) state.append(actionNode);
    root.replaceChildren(state);
  }

  async function renderLocked(message = '') {
    const generation = ++renderGeneration;
    root.dataset.walletState = 'locked';
    root.replaceChildren();
    if (!sessionAuthenticated) {
      const login = element('a', 'consumer-action', '로그인하기'); login.href = '/auth/start/';
      renderNotice('Life Wallet이 잠겨 있습니다', '자료를 보려면 먼저 LOTBI 계정으로 로그인해 주세요. 로그인만으로 월렛 잠금이 풀리지는 않습니다.', login);
      return;
    }
    if (!accountId) {
      renderNotice('계정 확인이 필요합니다', '로그인 계정을 확인하지 못했습니다. 잠시 후 Life Wallet을 다시 열어 주세요.');
      return;
    }
    try {
      const exists = await vault.hasVault(accountId);
      if (disposed || generation !== renderGeneration) return;
      if (!exists) renderSetup(message); else renderUnlock(message);
    } catch (error) {
      if (!disposed && generation === renderGeneration) renderNotice('Life Wallet을 열 수 없습니다', safeMessage(error, '브라우저 보관함을 확인하지 못했습니다.'));
    }
  }

  async function restoreOrRender(message = '') {
    if (!disposed && sessionAuthenticated && accountId && await vault.resumeUnlock(accountId)) {
      unlocked = true;
      activity();
      await renderWallet(message);
      return;
    }
    if (!disposed) await renderLocked(message);
  }

  function renderSetup(message = '') {
    const wrap = element('section', 'wallet-gate');
    wrap.append(element('div', 'wallet-lock-mark', '●'), element('h3', '', '4자리 월렛 PIN 만들기'), element('p', '', 'PC에서는 월렛 전용 PIN으로만 잠금을 해제합니다. 계정 로그인 비밀번호와 다른 숫자 4자리를 사용해 주세요.'));
    const form = element('form', 'wallet-pin-form');
    const pin = pinInput('새 월렛 PIN'); const confirmation = pinInput('새 월렛 PIN 확인'); const status = errorRegion();
    if (message) status.textContent = message;
    const submit = button('PIN 설정하고 열기'); submit.type = 'submit';
    form.append(field('새 PIN', pin), field('PIN 다시 입력', confirmation), submit, status);
    form.addEventListener('submit', async event => {
      event.preventDefault(); status.textContent = '';
      try {
        validateWalletPin(pin.value);
        if (pin.value !== confirmation.value) throw new Error('두 PIN이 일치하지 않습니다.');
        setBusy(form, true); await vault.create(accountId, pin.value);
        pin.value = ''; confirmation.value = ''; unlocked = true; activity(); await renderWallet();
      } catch (error) { status.textContent = safeMessage(error, 'PIN을 설정하지 못했습니다.'); setBusy(form, false); pin.focus(); }
    });
    wrap.append(form, element('p', 'wallet-security-note', 'PIN은 저장하거나 전송하지 않습니다. 임의의 256비트 암호화 키를 이 브라우저에 묶어 보호합니다. PIN 분실 시 현재 PC Web에는 안전한 복구 경로가 없으므로 자료를 지우지 말고 LOTBI 지원에 문의해 주세요.'));
    root.replaceChildren(wrap); pin.focus();
  }

  function renderUnlock(message = '') {
    const wrap = element('section', 'wallet-gate');
    wrap.append(element('div', 'wallet-lock-mark', '●'), element('h3', '', 'Life Wallet 잠금 해제'), element('p', '', '등록한 자료를 보려면 월렛 전용 4자리 PIN을 입력하세요.'));
    const form = element('form', 'wallet-pin-form wallet-unlock-form');
    const pin = pinInput('월렛 PIN'); const status = errorRegion(); if (message) status.textContent = message;
    const dots = element('div', 'wallet-pin-dots');
    const refreshDots = () => { dots.textContent = '●'.repeat(pin.value.length) + '○'.repeat(4 - pin.value.length); };
    pin.addEventListener('input', refreshDots); refreshDots();
    const keypad = element('div', 'wallet-keypad'); keypad.setAttribute('aria-label', '숫자 키패드');
    for (const digit of ['1','2','3','4','5','6','7','8','9','지움','0','확인']) {
      const key = button(digit, () => {
        if (/^\d$/u.test(digit) && pin.value.length < 4) pin.value += digit;
        if (digit === '지움') pin.value = pin.value.slice(0, -1);
        pin.dispatchEvent(new Event('input', {bubbles: true}));
        if (digit === '확인') form.requestSubmit();
      }, digit === '지움');
      if (digit === '확인') key.classList.add('wallet-key-confirm');
      keypad.append(key);
    }
    const submit = button('PIN으로 열기'); submit.type = 'submit';
    form.append(pin, dots, keypad, submit, status);
    form.addEventListener('submit', async event => {
      event.preventDefault(); status.textContent = '';
      try {
        validateWalletPin(pin.value); setBusy(form, true); await vault.unlock(accountId, pin.value);
        pin.value = ''; unlocked = true; activity(); await renderWallet();
      } catch (error) { status.textContent = safeMessage(error, '잠금을 해제하지 못했습니다.'); setBusy(form, false); pin.value = ''; refreshDots(); pin.focus(); }
    });
    wrap.append(form);
    root.replaceChildren(wrap); pin.focus();
  }

  async function renderWallet(message = '') {
    const generation = ++renderGeneration;
    root.dataset.walletState = 'unlocked';
    root.replaceChildren(element('p', 'wallet-message', '암호화된 자료를 여는 중입니다.'));
    try {
      const cards = await vault.list(accountId);
      if (disposed || !unlocked || generation !== renderGeneration) return;
      const shell = element('section', 'wallet-shell');
      const toolbar = element('div', 'wallet-toolbar');
      const copy = element('div', 'wallet-storage-copy');
      const reassurance = element('div', 'wallet-storage-reassurance');
      reassurance.append(
        element('strong', '', '안전하게 이 기기에만 저장됩니다.'),
        element('span', '', 'LOTBI 관리자도 원본을 볼 수 없으며, 기기 변경 시에는 다시 등록하거나 암호화 백업으로 복원해야 합니다.'),
      );
      copy.append(element('strong', 'wallet-storage-count', `저장 자료 ${cards.length}개`), reassurance);
      const settings = element('div', 'wallet-settings');
      const settingsMenu = element('div', 'wallet-settings-menu');
      settingsMenu.hidden = true; settingsMenu.setAttribute('role', 'menu'); settingsMenu.setAttribute('aria-label', 'Life Wallet 설정');
      const settingsToggle = button('⚙ 설정', () => {
        settingsMenu.hidden = !settingsMenu.hidden;
        settingsToggle.setAttribute('aria-expanded', String(!settingsMenu.hidden));
        if (!settingsMenu.hidden) settingsMenu.querySelector('button:not(:disabled)')?.focus();
      }, true);
      settingsToggle.setAttribute('aria-haspopup', 'menu'); settingsToggle.setAttribute('aria-expanded', 'false');
      const pinAction = button('PIN 변경', renderChangePin, true); pinAction.setAttribute('role', 'menuitem');
      const backupAction = button('암호화 백업 파일 만들기', renderBackup, true); backupAction.setAttribute('role', 'menuitem');
      backupAction.disabled = !canExportWalletBackup(cards);
      if (backupAction.disabled) backupAction.title = '저장된 자료가 있을 때 백업할 수 있습니다.';
      const importAction = button('백업에서 복원', renderImport, true); importAction.setAttribute('role', 'menuitem');
      settingsMenu.append(pinAction, backupAction, importAction);
      if (!canExportWalletBackup(cards)) settingsMenu.append(element('small', 'wallet-settings-help', '저장된 자료가 있을 때 백업 파일을 만들 수 있습니다.'));
      settings.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || settingsMenu.hidden) return;
        settingsMenu.hidden = true; settingsToggle.setAttribute('aria-expanded', 'false'); settingsToggle.focus();
      });
      settings.append(settingsToggle, settingsMenu);
      toolbar.append(copy, button('+ 자료 추가', renderAdd), button('잠그기', () => void lockAndRender(), true), settings);
      shell.append(toolbar);
      if (message) shell.append(element('p', 'wallet-message', message));
      if (!cards.length) {
        const empty = element('section', 'wallet-empty');
        empty.append(element('h3', '', '아직 등록한 자료가 없습니다'), element('p', '', '사용자가 직접 등록한 실제 자료만 여기에 표시됩니다.'), button('첫 자료 등록하기', renderAdd));
        shell.append(empty);
      } else {
        shell.append(createWalletCardCarousel({cards, onOpen: renderDetail}));
      }
      shell.append(element('p', 'wallet-security-note', '화면 이동·새로고침·백그라운드 전환 후에도 잠금 해제 상태가 유지됩니다. 10분간 사용하지 않으면 다시 잠깁니다.'));
      root.replaceChildren(shell);
    } catch (error) {
      await lockAndRender(safeMessage(error, '자료를 불러오지 못해 다시 잠갔습니다.'));
    }
  }

  function renderAdd() {
    const form = element('form', 'wallet-editor'); const status = errorRegion();
    let save;
    const photoPicker = createWalletPhotoPicker({onError: message => { status.textContent = message; }, onReady: ready => { if (save) save.disabled = !ready; }});
    const note = element('textarea'); note.maxLength = 1000; note.rows = 4;
    const actions = element('div', 'wallet-form-actions'); actions.append(button('취소', () => { photoPicker.destroy(); void renderWallet(); }, true));
    save = button('암호화하여 저장'); save.type = 'submit'; save.disabled = true; actions.append(save);
    form.append(element('h3', '', '자료 추가'), photoPicker.element, field('메모 · 선택', note), actions, status,
      element('p', 'wallet-security-note', '기울기·원근·여백과 화질을 이 브라우저에서만 보정합니다. 원본과 보정 사진은 LOTBI 서버나 대화창으로 전송되지 않습니다.'));
    form.addEventListener('submit', async event => {
      event.preventDefault(); status.textContent = '';
      try {
        setBusy(form, true);
        const frontDataUrl = await photoPicker.readDataUrl();
        await vault.save(accountId, {id: randomId(), kind: 'document', note: note.value, frontDataUrl, updatedAt: new Date().toISOString()});
        photoPicker.destroy();
        await renderWallet('자료를 암호화하여 저장했습니다.');
      } catch (error) { status.textContent = safeMessage(error, '자료를 저장하지 못했습니다.'); setBusy(form, false); }
    });
    root.replaceChildren(form); photoPicker.element.querySelector('button')?.focus(); activity();
  }

  function renderDetail(card) {
    const detail = element('section', 'wallet-detail');
    const header = element('div', 'wallet-detail-header'); header.append(button('목록으로', () => void renderWallet(), true), element('h3', '', walletCardTitle(card)));
    detail.append(header);
    const images = element('div', 'wallet-detail-images');
    const front = element('figure'); const frontImage = element('img'); frontImage.src = card.frontDataUrl; frontImage.alt = `${walletCardTitle(card)} 자료 사진 원본`; front.append(frontImage, element('figcaption', '', '자료 사진'));
    images.append(front);
    if (card.backDataUrl) { const back = element('figure'); const backImage = element('img'); backImage.src = card.backDataUrl; backImage.alt = `${walletCardTitle(card)} 뒷면 원본`; back.append(backImage, element('figcaption', '', '뒷면')); images.append(back); }
    detail.append(images);
    if (card.note) detail.append(element('p', 'wallet-card-note', card.note));
    // Deleting asks for the wallet PIN on the page itself: it cannot be undone, and embedded
    // browsers and app WebViews silently cancel window.confirm.
    const removal = element('form', 'wallet-delete-confirm'); removal.hidden = true;
    const removalPin = pinInput('월렛 PIN'); const removalStatus = errorRegion();
    const remove = button('자료 삭제', () => { remove.hidden = true; removal.hidden = false; removalPin.value = ''; removalStatus.textContent = ''; removalPin.focus(); }, true);
    remove.classList.add('wallet-danger-action');
    const removalActions = element('div', 'wallet-form-actions');
    removalActions.append(button('취소', () => { removal.hidden = true; remove.hidden = false; remove.focus(); }, true));
    const removalSubmit = button('삭제'); removalSubmit.type = 'submit'; removalSubmit.classList.add('wallet-danger-confirm'); removalActions.append(removalSubmit);
    removal.append(element('p', '', '이 자료를 삭제하려면 월렛 PIN을 입력해 주세요. 별도로 내보낸 백업은 삭제되지 않습니다.'), field('월렛 PIN', removalPin), removalActions, removalStatus);
    removal.addEventListener('submit', async event => {
      event.preventDefault(); removalStatus.textContent = '';
      try {
        validateWalletPin(removalPin.value); setBusy(removal, true);
        await vault.verifyPin(accountId, removalPin.value);
        await vault.remove(accountId, card.id); await renderWallet('자료를 삭제했습니다.');
      } catch (error) { removalStatus.textContent = safeMessage(error, '자료를 삭제하지 못했습니다.'); setBusy(removal, false); removalPin.value = ''; removalPin.focus(); }
    });
    detail.append(remove, removal);
    root.replaceChildren(detail); activity();
  }

  function renderChangePin() {
    const form = element('form', 'wallet-editor'); const status = errorRegion();
    const current = pinInput('현재 월렛 PIN'); const next = pinInput('새 월렛 PIN'); const confirmation = pinInput('새 월렛 PIN 확인');
    const actions = element('div', 'wallet-form-actions'); actions.append(button('취소', () => void renderWallet(), true));
    const submit = button('PIN 변경'); submit.type = 'submit'; actions.append(submit);
    form.append(element('h3', '', '월렛 PIN 변경'), field('현재 PIN', current), field('새 PIN', next), field('새 PIN 다시 입력', confirmation), actions, status);
    form.addEventListener('submit', async event => {
      event.preventDefault(); status.textContent = '';
      try {
        validateWalletPin(current.value); validateWalletPin(next.value);
        if (next.value !== confirmation.value) throw new Error('새 PIN 두 개가 일치하지 않습니다.');
        setBusy(form, true); await vault.changePin(accountId, current.value, next.value); await renderWallet('월렛 PIN을 변경했습니다.');
      } catch (error) { status.textContent = safeMessage(error, 'PIN을 변경하지 못했습니다.'); setBusy(form, false); current.value = ''; current.focus(); }
    });
    root.replaceChildren(form); current.focus(); activity();
  }

  function renderBackup() {
    const form = element('form', 'wallet-editor'); const status = errorRegion();
    const password = element('input'); password.type = 'password'; password.minLength = 8; password.maxLength = 128; password.autocomplete = 'new-password';
    const confirmation = element('input'); confirmation.type = 'password'; confirmation.minLength = 8; confirmation.maxLength = 128; confirmation.autocomplete = 'new-password';
    const actions = element('div', 'wallet-form-actions'); actions.append(button('취소', () => void renderWallet(), true));
    const submit = button('내 기기에 백업 파일 저장'); submit.type = 'submit'; actions.append(submit);
    form.append(
      element('h3', '', '암호화 백업 파일 만들기'),
      element('p', 'wallet-form-intro', '기기 변경이나 브라우저 초기화에 대비해 Life Wallet 자료를 암호화된 파일로 저장합니다.'),
      field('새 백업 전용 암호 · 8자 이상', password),
      field('백업 전용 암호 확인', confirmation),
      element('p', 'wallet-backup-warning', '백업을 복원할 때 이 암호가 반드시 필요합니다. LOTBI는 백업 암호를 보관하거나 재설정해 드릴 수 없으니 반드시 기억해 주세요.'),
      element('p', 'wallet-backup-warning', '복원하려면 저장한 .lotbiwallet 백업 파일과 백업 전용 암호가 모두 필요합니다. 파일을 삭제하거나 분실하면 자료를 복원할 수 없습니다.'),
      actions, status,
    );
    form.addEventListener('submit', async event => {
      event.preventDefault(); status.textContent = '';
      try {
        const backupPassword = validateBackupPasswordPair(password.value, confirmation.value);
        setBusy(form, true); downloadBackup(await vault.exportBackup(accountId, backupPassword));
        await renderWallet('암호화된 백업 파일을 만들었습니다. 파일과 백업 전용 암호를 함께 안전하게 보관해 주세요.');
      } catch (error) { status.textContent = safeMessage(error, '백업 파일을 만들지 못했습니다.'); setBusy(form, false); password.focus(); }
    });
    root.replaceChildren(form); password.focus(); activity();
  }

  function renderImport() {
    const form = element('form', 'wallet-editor'); const status = errorRegion();
    const fileInput = element('input'); fileInput.type = 'file'; fileInput.accept = '.lotbiwallet,application/octet-stream'; fileInput.required = true;
    const password = element('input'); password.type = 'password'; password.minLength = 8; password.maxLength = 128; password.autocomplete = 'current-password';
    const actions = element('div', 'wallet-form-actions'); actions.append(button('취소', () => void renderWallet(), true));
    const submit = button('Life Wallet 자료 복원'); submit.type = 'submit'; actions.append(submit);
    form.append(
      element('h3', '', '백업에서 Life Wallet 복원'),
      element('p', 'wallet-form-intro', '이전에 저장한 .lotbiwallet 백업 파일과 파일을 만들 때 설정한 백업 전용 암호가 모두 필요합니다.'),
      field('1. 저장된 백업 파일 찾기', fileInput),
      field('2. 백업 전용 암호 입력', password),
      element('p', 'wallet-backup-warning', '월렛 4자리 PIN이 아니라 백업 파일을 만들 때 설정한 8자 이상의 백업 전용 암호를 입력해 주세요.'),
      element('p', 'wallet-backup-warning', '파일이나 백업 암호를 분실하면 복원할 수 없습니다. LOTBI는 백업 파일과 암호를 보관하지 않습니다.'),
      actions, status,
    );
    form.addEventListener('submit', async event => {
      event.preventDefault(); status.textContent = '';
      try {
        const file = fileInput.files?.[0];
        if (!file || file.size > 100 * 1024 * 1024) throw new Error('100MB 이하의 .lotbiwallet 파일을 선택해 주세요.');
        setBusy(form, true); const count = await vault.importBackup(accountId, await file.text(), password.value);
        await renderWallet(`${count}개 자료를 복원했습니다.`);
      } catch (error) { status.textContent = safeMessage(error, '백업 자료를 복원하지 못했습니다.'); setBusy(form, false); fileInput.focus(); }
    });
    root.replaceChildren(form); fileInput.focus(); activity();
  }

  void restoreOrRender();
  return {
    dispose() {
      disposed = true; unlocked = false; vault.lock({preserveSession: true}); clearTimeout(timer); clearTimeout(sessionTimer); clearTimeout(backgroundTimer); renderGeneration += 1;
      for (const name of activityEvents) root.removeEventListener(name, activity);
      window.removeEventListener('lotbi:site-session-state', sessionListener);
      document.removeEventListener('visibilitychange', visibilityListener);
      window.removeEventListener('pagehide', pagehideListener);
      window.removeEventListener('pageshow', pageshowListener);
      root.replaceChildren();
    },
  };
}
