import {createWalletDocumentScanner, isWalletPhotoKind, sniffWalletFile} from './site-life-wallet-scan-ui.js?v=aset-66255ae7fee8';
import {generateShareKeyPair, importSharePrivateKey, openWalletShareItem} from './site-life-wallet-share-crypto.js?v=aset-66255ae7fee8';
import {createWalletShare, hasWalletShareIntent, takeWalletShareIntent} from './site-life-wallet-share.js?v=aset-66255ae7fee8';
import {WIFI_MAX_ENTRIES, createWalletWifi, validateWifiEntry} from './site-life-wallet-wifi.js?v=aset-66255ae7fee8';

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
export const WALLET_ITEM_CATEGORIES = Object.freeze([
  ['identity', '신분증'],
  ['business-card', '명함'],
  ['document', '증명서·문서'],
  ['other', '기타'],
]);
const WALLET_ITEM_CATEGORY_IDS = Object.freeze(WALLET_ITEM_CATEGORIES.map(([value]) => value));
const WALLET_VIEW_STATE_PREFIX = 'lotbi-life-wallet-view-v1:';

export function walletItemCategory(card) {
  if (WALLET_ITEM_CATEGORY_IDS.includes(card?.category)) return card.category;
  const label = `${card?.name || ''} ${CARD_KINDS.find(([value]) => value === card?.kind)?.[1] || ''}`;
  if (card?.kind === 'identity' || /(?:신분증|주민등록|운전면허|여권)/u.test(label)) return 'identity';
  if (/(?:명함|business\s*card)/iu.test(label)) return 'business-card';
  if (card?.kind === 'certificate' || /(?:증명서|자격증|계약서|문서)/u.test(label)) return 'document';
  return 'other';
}

function walletCategoryLabel(card) {
  const category = walletItemCategory(card);
  return WALLET_ITEM_CATEGORIES.find(([value]) => value === category)?.[1] || '기타';
}

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

// typedItems: saved text items (the 개인통관고유부호), which a backup file can carry too.
export function canExportWalletBackup(cards, typedItems = 0) {
  return (Array.isArray(cards) ? cards.length : 0) + typedItems > 0;
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
function shareKeyAad(scope) { return `lotbi-wallet-share-key:v1:${scope}`; }
// LIFE-WALLET-WIFI-CARD-01: Wi-Fi entries live in the same encrypted store under their own scope,
// so listCards(scope) — the deck, the Free item count, backups and sharing — never returns them.
function wifiScope(scope) { return `wifi:${scope}`; }
function wifiAad(scope, id) { return `lotbi-wallet-wifi:v1:${scope}:${id}`; }
function storageKey(scope, id) { return `${scope}:${id}`; }
// Typed items (text, not a photo) sit in the same encrypted store under their own scope. Code
// that only knows photo items lists an account's scope and never meets them, so an older page
// still opens the wallet; their own AAD keeps a photo item's envelope from standing in for one.
function itemScope(scope) { return `items:${scope}`; }
function itemAad(scope, id) { return `lotbi-wallet-item:v1:${scope}:${id}`; }

// 개인통관고유부호 (personal customs clearance code). The owner looks it up on the Korea Customs
// Service portal and types it in; LOTBI never looks it up, estimates its expiry or sends it
// anywhere. On since 2026-10-10: the owner accepted the risk of the wallet's open security
// review (2026-10-05: lock race, browser PIN, device protection — still open). Setting this
// to false takes it off the page again; saved codes stay encrypted and untouched.
export const CUSTOMS_CODE_RELEASED = true;
export const CUSTOMS_CODE_ITEM_ID = 'customs-code';
// The portal is one page whose menus load inside it (no address per menu), so every official
// step starts here; the screen names the menu to open. unipass.customs.go.kr now redirects here.
export const CUSTOMS_PORTAL_URL = 'https://ecos.customs.go.kr/ecp/index.do';
const CUSTOMS_SEPARATORS = /[\s​-‍⁠﻿\-‐-―−_.·/]/gu;

// "P" and 12 digits, nothing else. Spaces and separators are dropped, full-width characters are
// folded, and the P may be left out (the form shows it). This checks the shape only: whether the
// customs service issued the number, whether it is still in use and whose it is, only the
// portal can say.
export function normalizeCustomsCode(value) {
  const compact = String(value ?? '').normalize('NFKC').replace(CUSTOMS_SEPARATORS, '').toUpperCase();
  const digits = compact.startsWith('P') ? compact.slice(1) : compact;
  if (!/^\d{12}$/u.test(digits)) throw new Error('개인통관고유부호는 P와 숫자 12자리입니다. 관세청에서 확인한 번호를 그대로 입력해 주세요.');
  return `P${digits}`;
}

// The expiry date is optional and only ever the one the owner read on the portal.
function validateCustomsExpiry(value) {
  if (value === undefined || value === '') return '';
  const match = typeof value === 'string' ? /^(20\d{2})-(\d{2})-(\d{2})$/u.exec(value) : null;
  const date = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
  if (!date || date.getUTCMonth() !== Number(match[2]) - 1 || date.getUTCDate() !== Number(match[3])) throw new Error('만료일을 날짜로 입력해 주세요.');
  return value;
}

function validateCustomsItem(item) {
  if (!item || typeof item !== 'object' || item.kind !== CUSTOMS_CODE_ITEM_ID) throw new Error('개인통관고유부호 자료가 올바르지 않습니다.');
  const code = normalizeCustomsCode(item.code);
  if (code !== item.code) throw new Error('개인통관고유부호 자료가 올바르지 않습니다.');
  for (const field of ['consentedAt', 'createdAt', 'updatedAt']) {
    if (typeof item[field] !== 'string' || !Number.isFinite(Date.parse(item[field]))) throw new Error('개인통관고유부호 저장 시간이 올바르지 않습니다.');
  }
  return Object.freeze({kind: CUSTOMS_CODE_ITEM_ID, code, expiresOn: validateCustomsExpiry(item.expiresOn), consentedAt: item.consentedAt, createdAt: item.createdAt, updatedAt: item.updatedAt});
}

// What to say about the expiry date the owner typed in. Customs rule (관세청 2025-06-18): a code
// is valid for a year and one not renewed within 30 days before or after its expiry is
// cancelled. LOTBI never decides that a code works or has stopped working.
export function customsRenewalNotice(expiresOn, today = new Date()) {
  if (!expiresOn) return null;
  const [year, month, day] = expiresOn.split('-').map(Number);
  const days = Math.round((Date.UTC(year, month - 1, day) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86_400_000);
  const label = `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`;
  if (days > 30) return {state: 'later', text: `입력한 만료일 ${label}`};
  if (days > 0) return {state: 'renew', text: `입력한 만료일(${label})까지 ${days}일 남았습니다. 관세청에서 유효기간을 갱신해 주세요.`};
  if (days === 0) return {state: 'renew', text: `입력한 만료일(${label})이 오늘입니다. 관세청에서 유효기간을 갱신해 주세요.`};
  if (days >= -30) return {state: 'overdue', text: `입력한 만료일(${label})이 ${-days}일 지났습니다. 관세청에서 지금 갱신할 수 있는지 확인해 주세요.`};
  return {state: 'lapsed', text: `입력한 만료일(${label})이 30일 넘게 지났습니다. 관세청에서 번호 상태를 확인하고, 새로 발급받았다면 저장한 번호를 바꿔 주세요.`};
}

// Shown with the last four digits only; 보기 shows it in groups of four. Copy takes the bare code.
export function maskCustomsCode(code) { return `P •••• •••• ${code.slice(-4)}`; }
export function groupCustomsCode(code) { return `P ${code.slice(1, 5)} ${code.slice(5, 9)} ${code.slice(9)}`; }

function availableSessionStorage() {
  try { return globalThis.sessionStorage || null; }
  catch { return null; }
}

function availableLocalStorage() {
  try { return globalThis.localStorage || null; }
  catch { return null; }
}

export function readWalletViewState(storage, key) {
  if (!storage || !key) return Object.freeze({filter: 'all', selectedId: ''});
  try {
    const value = JSON.parse(storage.getItem(key) || 'null');
    const filter = value?.filter === 'all' || WALLET_ITEM_CATEGORY_IDS.includes(value?.filter) ? value.filter : 'all';
    const selectedId = typeof value?.selectedId === 'string' && /^[A-Za-z0-9_-]{1,128}$/u.test(value.selectedId) ? value.selectedId : '';
    return Object.freeze({filter, selectedId});
  } catch { return Object.freeze({filter: 'all', selectedId: ''}); }
}

export function writeWalletViewState(storage, key, state) {
  if (!storage || !key) return false;
  const filter = state?.filter === 'all' || WALLET_ITEM_CATEGORY_IDS.includes(state?.filter) ? state.filter : 'all';
  const selectedId = typeof state?.selectedId === 'string' && /^[A-Za-z0-9_-]{1,128}$/u.test(state.selectedId) ? state.selectedId : '';
  try { storage.setItem(key, JSON.stringify({filter, selectedId})); return true; }
  catch { return false; }
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
  const own = walletOwnTitle(card);
  if (own) return own;
  const memo = walletMemoTitle(card);
  if (memo) return memo;
  return walletShareLabel(card);
}

// The title the owner typed (LIFE-WALLET-REDESIGN-02). Older items carry their kind's label as
// the name ("저장 자료"); that is not a title.
export function walletOwnTitle(card) {
  const name = String(card?.name || '').trim();
  const kindLabel = CARD_KINDS.find(([value]) => value === card?.kind)?.[1];
  return name && name !== kindLabel ? name : '';
}

function walletMemoTitle(card) {
  const memo = String(card?.note || '').split(/\r?\n/u).map(line => line.trim()).find(Boolean);
  return memo ? (memo.length > 24 ? `${memo.slice(0, 24)}…` : memo) : '';
}

// What each item is called in the list and on its own page: the owner's title, else the first
// line of its memo, else its kind and its number in the order saved ("명함 3"), so the list never
// repeats "저장 자료 · 날짜". Nothing is read from the picture.
export function walletItemTitles(cards) {
  const counters = new Map(); const titles = new Map();
  for (const card of cards.slice().sort((left, right) => left.updatedAt.localeCompare(right.updatedAt))) {
    const category = walletItemCategory(card);
    const number = (counters.get(category) || 0) + 1; counters.set(category, number);
    titles.set(card.id, walletOwnTitle(card) || walletMemoTitle(card) || `${walletCategoryLabel(card)} ${number}`);
  }
  return titles;
}

// What a share request calls an item by default. Core keeps the label as it is and the
// recipient sees it before accepting, so it never comes from the memo (the memo leaves the
// device only inside the sealed original).
export function walletShareLabel(card) {
  const name = String(card.name || '').trim() || CARD_KINDS.find(([value]) => value === card.kind)?.[1] || '저장 자료';
  const saved = new Date(card.updatedAt);
  if (!Number.isFinite(saved.getTime())) return name;
  return `${name} · ${saved.getFullYear()}.${String(saved.getMonth() + 1).padStart(2, '0')}.${String(saved.getDate()).padStart(2, '0')}`;
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
  if (card.shape !== undefined && !WALLET_ITEM_SHAPES.includes(card.shape)) throw new Error('자료 분류가 올바르지 않습니다.');
  if (card.category !== undefined && !WALLET_ITEM_CATEGORY_IDS.includes(card.category)) throw new Error('자료 종류가 올바르지 않습니다.');
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

  // What the lock screen says before a PIN is typed: tries used so far and any wait. Read from
  // the vault record, which already keeps these counters; nothing new is stored.
  async attemptState(accountId) {
    const vault = await this.repository.getVault(await accountScope(accountId));
    const failedAttempts = Number(vault?.failedAttempts || 0);
    const waitMs = vault?.retryAfter ? Math.max(0, Date.parse(vault.retryAfter) - Date.now()) : 0;
    return Object.freeze({failedAttempts, waitMs: Number.isFinite(waitMs) ? waitMs : 0, blocked: vault?.pinBlocked === true, remaining: Math.max(0, MAX_PIN_FAILURES - failedAttempts)});
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

  // The saved 개인통관고유부호, decrypted, or null when none is saved. Only while unlocked.
  async getCustomsCode(accountId) {
    const unlocked = await this.requireUnlocked(accountId);
    const record = await this.repository.getCard(itemScope(unlocked.scope), CUSTOMS_CODE_ITEM_ID);
    return record ? this.decryptItem(unlocked, record) : null;
  }

  // Saving a first code needs the owner's consent; replacing a saved one needs the wallet PIN
  // again (a wrong PIN counts as a failed attempt), so an unattended open wallet cannot have
  // someone else's number put in its place.
  async saveCustomsCode(accountId, {code, expiresOn = '', consent = false, pin = ''} = {}) {
    const unlocked = await this.requireUnlocked(accountId);
    const normalized = normalizeCustomsCode(code);
    const expiry = validateCustomsExpiry(expiresOn);
    const existing = await this.getCustomsCode(accountId);
    if (existing) await this.verifyPin(accountId, pin);
    else if (consent !== true) throw new Error('이 기기에 암호화해 보관하는 데 동의해야 저장할 수 있습니다.');
    const now = new Date().toISOString();
    const item = validateCustomsItem({
      kind: CUSTOMS_CODE_ITEM_ID, code: normalized, expiresOn: expiry,
      consentedAt: existing?.consentedAt || now, createdAt: existing?.createdAt || now, updatedAt: now,
    });
    await this.putItem(unlocked, item);
    return item;
  }

  async removeCustomsCode(accountId, pin) {
    const unlocked = await this.requireUnlocked(accountId);
    await this.verifyPin(accountId, pin);
    await this.repository.removeCard(itemScope(unlocked.scope), CUSTOMS_CODE_ITEM_ID);
  }

  async putItem(unlocked, item) {
    const envelope = await seal(unlocked.key, JSON.stringify(item), itemAad(unlocked.scope, CUSTOMS_CODE_ITEM_ID));
    await this.repository.putCard({scope: itemScope(unlocked.scope), id: CUSTOMS_CODE_ITEM_ID, envelope});
  }

  async decryptItem(unlocked, record) {
    if (record.id !== CUSTOMS_CODE_ITEM_ID) throw new Error('알 수 없는 월렛 자료입니다.');
    return validateCustomsItem(JSON.parse(await openEnvelope(unlocked.key, record.envelope, itemAad(unlocked.scope, record.id))));
  }

  // A backup file takes the typed items only when asked (the file made on this device does); a
  // caller that sends the sealed backup elsewhere leaves them out unless it asks too.
  async exportBackup(accountId, password, {includeItems = false} = {}) {
    validateBackupPassword(password);
    const cards = await this.list(accountId);
    const payload = {cards};
    if (includeItems) {
      const customs = await this.getCustomsCode(accountId).catch(() => { throw new Error('저장한 개인통관고유부호를 열 수 없어 백업하지 못했습니다. 번호를 삭제하거나 다시 등록한 뒤 백업해 주세요.'); });
      if (customs) payload.items = [customs];
    }
    const salt = randomBytes(16);
    const key = await deriveAesKey(password, salt, BACKUP_KDF_ITERATIONS);
    const cipher = await seal(key, JSON.stringify(payload), BACKUP_AAD);
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
    // Rounds recorded in the backup are used, so a backup made with more rounds later still opens;
    // never fewer than today's.
    if (backup?.format !== 'LOTBI_LIFE_WALLET' || backup?.version !== 1 || backup?.kdf?.name !== 'PBKDF2-HMAC-SHA-256'
      || !Number.isInteger(backup?.kdf?.iterations) || backup.kdf.iterations < BACKUP_KDF_ITERATIONS || backup.kdf.iterations > 10_000_000
      || backup?.cipher?.aad !== BACKUP_AAD) {
      throw new Error('지원하지 않거나 손상된 LOTBI Life Wallet 백업입니다.');
    }
    const key = await deriveAesKey(password, base64ToBytes(backup.kdf.salt), backup.kdf.iterations);
    let payload;
    try { payload = JSON.parse(await openEnvelope(key, backup.cipher, BACKUP_AAD)); }
    catch { throw new Error('백업 암호를 확인해 주세요.'); }
    if (!Array.isArray(payload.cards)) throw new Error('백업 자료 목록이 올바르지 않습니다.');
    if (payload.items !== undefined && !Array.isArray(payload.items)) throw new Error('백업 자료 목록이 올바르지 않습니다.');
    // Every entry is checked before anything is written, so a damaged backup changes nothing.
    const cards = payload.cards.map(validateCard);
    const customs = (payload.items || []).filter(item => item?.kind === CUSTOMS_CODE_ITEM_ID).map(validateCustomsItem).at(-1) || null;
    const existing = new Map((await this.list(accountId)).map(card => [card.id, card]));
    let imported = 0;
    for (let card of cards) {
      if (existing.has(card.id)) card = Object.freeze({...card, id: randomId(), name: `${card.name} (복원 사본)`, updatedAt: new Date().toISOString()});
      const envelope = await seal(unlocked.key, JSON.stringify(card), cardAad(unlocked.scope, card.id));
      await this.repository.putCard({scope: unlocked.scope, id: card.id, envelope});
      imported += 1;
    }
    // A saved 개인통관고유부호 is never replaced by the one in a backup.
    let customsCode = 'none';
    if (customs) {
      const saved = await this.repository.getCard(itemScope(unlocked.scope), CUSTOMS_CODE_ITEM_ID);
      if (!saved) { await this.putItem(unlocked, customs); customsCode = 'restored'; }
      else customsCode = 'kept';
    }
    this.lastImport = Object.freeze({cards: imported, customsCode});
    return imported;
  }

  // LIFE-WALLET-SHARE-01: this device's key for receiving shared items. The private key is
  // kept in the vault record, encrypted with the wallet's master key; only the public key
  // leaves the device (registered with Core so a sharer can seal an item for it).
  async ensureShareKey(accountId) {
    const unlocked = await this.requireUnlocked(accountId);
    const vault = await this.repository.getVault(unlocked.scope);
    if (!vault) throw new Error('Life Wallet 설정을 찾지 못했습니다.');
    if (vault.shareKey?.publicKey && vault.shareKey?.envelope) return Object.freeze({publicKey: vault.shareKey.publicKey, keyId: vault.shareKey.keyId || ''});
    const {publicKey, privateKeyPkcs8} = await generateShareKeyPair();
    let envelope;
    try { envelope = await seal(unlocked.key, bytesToBase64(privateKeyPkcs8), shareKeyAad(unlocked.scope)); }
    finally { privateKeyPkcs8.fill(0); }
    const latest = await this.repository.getVault(unlocked.scope);
    await this.repository.putVault({...latest, shareKey: {publicKey, envelope, keyId: ''}});
    return Object.freeze({publicKey, keyId: ''});
  }

  async rememberShareKeyId(accountId, publicKey, keyId) {
    const unlocked = await this.requireUnlocked(accountId);
    const vault = await this.repository.getVault(unlocked.scope);
    if (!vault?.shareKey || vault.shareKey.publicKey !== publicKey || typeof keyId !== 'string') return;
    await this.repository.putVault({...vault, shareKey: {...vault.shareKey, keyId}});
  }

  // Opens an item sealed for this device's key (Core GET …/payload) and returns the item.
  async openSharedItem(accountId, sealed) {
    const unlocked = await this.requireUnlocked(accountId);
    const vault = await this.repository.getVault(unlocked.scope);
    if (!vault?.shareKey?.envelope) throw Object.assign(new Error('이 기기에서 열 수 없는 자료입니다.'), {code: 'SHARE_ITEM_UNOPENABLE'});
    const pkcs8 = base64ToBytes(await openEnvelope(unlocked.key, vault.shareKey.envelope, shareKeyAad(unlocked.scope)));
    let privateKey;
    try { privateKey = await importSharePrivateKey(pkcs8); }
    finally { pkcs8.fill(0); }
    return openWalletShareItem(privateKey, sealed);
  }

  // LIFE-WALLET-WIFI-CARD-01 (site-life-wallet-wifi.js). An entry that cannot be opened is
  // reported by id so the rest still shows.
  async listWifi(accountId) {
    const unlocked = await this.requireUnlocked(accountId);
    const records = await this.repository.listCards(wifiScope(unlocked.scope));
    const entries = []; const unreadable = [];
    for (const record of records) {
      try { entries.push(validateWifiEntry(JSON.parse(await openEnvelope(unlocked.key, record.envelope, wifiAad(unlocked.scope, record.id))))); }
      catch { unreadable.push(record.id); }
    }
    entries.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    return Object.freeze({entries: Object.freeze(entries), unreadable: Object.freeze(unreadable)});
  }

  // A new entry needs the unlocked wallet; changing a saved one asks for the PIN again.
  async saveWifi(accountId, value, {pin = ''} = {}) {
    const unlocked = await this.requireUnlocked(accountId);
    const entry = validateWifiEntry(value);
    const scope = wifiScope(unlocked.scope);
    if (await this.repository.getCard(scope, entry.id)) await this.verifyPin(accountId, pin);
    else if ((await this.repository.listCards(scope)).length >= WIFI_MAX_ENTRIES) throw new Error(`와이파이는 ${WIFI_MAX_ENTRIES}개까지 보관할 수 있습니다.`);
    const envelope = await seal(unlocked.key, JSON.stringify(entry), wifiAad(unlocked.scope, entry.id));
    await this.repository.putCard({scope, id: entry.id, envelope});
    return entry;
  }

  async removeWifi(accountId, id, pin) {
    const unlocked = await this.requireUnlocked(accountId);
    await this.verifyPin(accountId, pin);
    await this.repository.removeCard(wifiScope(unlocked.scope), id);
  }

  async removeUnreadableWifi(accountId, pin) {
    const unlocked = await this.requireUnlocked(accountId);
    await this.verifyPin(accountId, pin);
    const {unreadable} = await this.listWifi(accountId);
    for (const id of unreadable) await this.repository.removeCard(wifiScope(unlocked.scope), id);
    return unreadable.length;
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

// COMMON-UI-POLISH-01 (QA #21) — the gate showed a lone dot in a ring, which read as a
// broken icon (and was announced as a symbol). A padlock says what the screen is.
function lockMark() {
  const mark = element('div', 'wallet-lock-mark');
  mark.setAttribute('aria-hidden', 'true');
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('focusable', 'false');
  const body = document.createElementNS(ns, 'rect');
  for (const [name, value] of [['x', '5'], ['y', '10.5'], ['width', '14'], ['height', '9.5'], ['rx', '2']]) body.setAttribute(name, value);
  const shackle = document.createElementNS(ns, 'path');
  shackle.setAttribute('d', 'M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5');
  const keyhole = document.createElementNS(ns, 'path');
  keyhole.setAttribute('d', 'M12 14.25v2');
  svg.append(body, shackle, keyhole);
  mark.append(svg);
  return mark;
}

function button(label, onClick, secondary = false) {
  const value = element('button', `consumer-action${secondary ? ' consumer-action-secondary' : ''}`, label);
  value.type = 'button';
  if (onClick) value.addEventListener('click', onClick);
  return value;
}

// One line-icon set for the whole wallet (24px grid, stroke 2), never emoji.
const WALLET_ICONS = Object.freeze({
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z',
  settings: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4a2 2 0 1 0 0 4a2 2 0 1 0 0-4zM9 10a2 2 0 1 0 0 4a2 2 0 1 0 0-4zM17 16a2 2 0 1 0 0 4a2 2 0 1 0 0-4z',
  search: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM20 20l-3.5-3.5',
  plus: 'M12 5v14M5 12h14',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 9.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7z',
  folder: 'M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM12 10v6M9 13h6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  close: 'M6 6l12 12M18 6L6 18',
  info: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 11v5M12 8v.5',
  alert: 'M12 4L2.5 20h19zM12 10v4.5M12 17.5v.5',
  clock: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 7v5l3 2',
  shield: 'M12 3l8 3v6c0 5-3.4 8.3-8 9-4.6-.7-8-4-8-9V6z',
  key: 'M8 11a4 4 0 1 0 0 8a4 4 0 1 0 0-8zM11 12l9-9M17 6l3 3',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z',
  eyeOff: 'M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.3 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  share: 'M12 3v12M7 8l5-5 5 5M5 13v7h14v-7',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  chevron: 'M9 5l7 7-7 7',
  back: 'M15 5l-7 7 7 7',
  erase: 'M9 5h11v14H9l-6-7zM12 9l5 6M17 9l-5 6',
  identity: 'M3 5h18v14H3zM8.5 9a2 2 0 1 0 0 4a2 2 0 1 0 0-4zM6 16c.6-1.3 1.5-2 2.5-2s1.9.7 2.5 2M14 10h4M14 14h3',
  'business-card': 'M3 6h18v12H3zM7 10.5h7M7 14h10',
  document: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
  other: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  customs: 'M3 7.5L12 3l9 4.5v9L12 21l-9-4.5zM3 7.5l9 4.5 9-4.5M12 12v9',
  wifi: 'M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0M12 19.5h.01',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  rotate: 'M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4',
  crop: 'M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14',
  swap: 'M4 12a8 8 0 0 1 14-5.3M20 4v4h-4M20 12a8 8 0 0 1-14 5.3M4 20v-4h4',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  download: 'M12 4v11M7 10l5 5 5-5M5 19h14',
  upload: 'M12 20V9M7 14l5-5 5 5M5 5h14',
  cloudUp: 'M7 18a5 5 0 0 1-.6-10A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9zM12 16v-5M9.5 13.5L12 11l2.5 2.5',
  cloudDown: 'M7 18a5 5 0 0 1-.6-10A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9zM12 11v5M9.5 13.5L12 16l2.5-2.5',
});
function walletIcon(name) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', WALLET_ICONS[name] || WALLET_ICONS.info);
  svg.append(path);
  return svg;
}

function field(labelText, input) {
  const label = element('label', 'wallet-field');
  label.append(element('span', '', labelText), input);
  return label;
}

// The wallet PIN is not a website password. A type=password field makes browsers and Samsung Pass
// treat each PIN form (set, unlock, change, delete) as a login and offer to save the PIN as the
// site's password; autocomplete=off does not stop them. So the PIN is a masked text field with a
// number pad, and password-manager extensions are asked to skip it. A browser that cannot mask
// text keeps the password type: the digits are never shown.
const TEXT_MASK_SUPPORTED = (() => {
  try { return Boolean(globalThis.CSS?.supports?.('-webkit-text-security', 'disc')); } catch { return false; }
})();
function pinInput(label) {
  const input = element('input', 'wallet-pin-input');
  input.type = TEXT_MASK_SUPPORTED ? 'text' : 'password'; input.inputMode = 'numeric'; input.autocomplete = 'off'; input.maxLength = 4;
  input.pattern = '[0-9]{4}'; input.setAttribute('aria-label', label);
  input.spellcheck = false; input.setAttribute('autocorrect', 'off'); input.setAttribute('autocapitalize', 'off');
  for (const hint of ['data-lpignore', 'data-1p-ignore', 'data-bwignore']) input.setAttribute(hint, 'true');
  input.dataset.formType = 'other';
  input.addEventListener('input', () => { input.value = input.value.replace(/\D/gu, '').slice(0, 4); });
  return input;
}

// On a phone, focusing a field on its own raises the keyboard (and the browser's sign-in bar);
// fields are focused for mouse and keyboard users only, and on a phone when the person taps.
function focusUnlessTouch(field) {
  if (!globalThis.matchMedia?.('(pointer: coarse)').matches) field.focus();
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

// Still photos (a phone camera's JPEG/HEIC, PNG, WebP) or a PDF; videos never. A PDF page is
// drawn into an image in this browser. The file's bytes decide what it is: camera shots come
// with temporary names, no extension, an empty or non-standard type; the reported type and
// name only help when the bytes are not recognised.
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
async function walletFileKind(file) {
  if (!(file instanceof File)) throw new Error('자료 사진을 선택해 주세요.');
  const kind = await sniffWalletFile(file);
  const pdf = kind === 'pdf' || (kind === 'unknown' && (file.type === 'application/pdf' || /\.pdf$/iu.test(file.name)));
  const photo = isWalletPhotoKind(kind) || (kind === 'unknown' && PHOTO_TYPES.includes(file.type));
  if (!pdf && !photo) throw new Error('사진(JPG·PNG·WebP·HEIC)이나 PDF만 등록할 수 있습니다.');
  if (pdf && file.size > 20 * 1024 * 1024) throw new Error('PDF는 20MB 이하로 선택해 주세요.');
  if (!pdf && file.size > 30 * 1024 * 1024) throw new Error('사진은 한 장당 30MB 이하로 선택해 주세요.');
  return pdf ? 'pdf' : kind;
}

// One way in for an item: the attach area (or its 파일 변경) opens one menu with two sources.
//   카메라  a still photo straight from the camera: one image type plus capture, so the phone opens
//           its camera (no gallery list, no camcorder or voice recorder).
//   내 파일 a photo or a PDF already on the device. Where the browser has a document picker
//           (showOpenFilePicker) it is used: it lists files only, no camera apps. Otherwise one
//           input takes both types, and the system chooser may add its own entries (Android
//           Chrome adds its camera next to the files for an image type; older engines may add
//           more). The page cannot remove those.
// A chosen file replaces the current one only when it is a supported file: a cancelled or a
// rejected choice leaves the previous photo, its preview or the open scanner as they were.
const DOCUMENT_PICKER_TYPES = Object.freeze([{description: '사진·PDF', accept: {
  'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'], 'image/webp': ['.webp'],
  'image/heic': ['.heic'], 'image/heif': ['.heif'], 'application/pdf': ['.pdf'],
}}]);
// A second tap while a chooser is opening is ignored; the chooser closing ends the wait sooner.
const PICKER_REOPEN_MS = 1500;

function documentPickerAvailable() {
  try { return typeof globalThis.showOpenFilePicker === 'function' && globalThis.isSecureContext && globalThis.self === globalThis.top; }
  catch { return false; }
}

// layout 'start' (LIFE-WALLET-REDESIGN-02, the add form): two large choices (카메라로 찍기, 내 파일에서
// 고르기) until a file is chosen; then the file's row with 파일 변경 and the scanner embedded as
// the preview frame — no separate confirm step: onState reports each check and readDataUrl()
// answers once the item may be saved.
export function createWalletPhotoPicker({onError = () => {}, onReady = () => {}, onPickerOpen = () => {}, onPickerClose = () => {}, onState = () => {}, layout = 'menu'} = {}) {
  const embedded = layout === 'start';
  const fieldShell = element('div', 'wallet-field wallet-attach-field');
  const label = element('span', 'wallet-attach-label', '자료 첨부');
  label.id = `wallet-attach-${randomId()}`;
  const help = element('small', 'wallet-attach-help', '사진 또는 PDF를 등록할 수 있어요.');
  help.id = `${label.id}-help`;

  const cameraInput = element('input', 'wallet-photo-input');
  cameraInput.type = 'file'; cameraInput.accept = 'image/*'; cameraInput.setAttribute('capture', 'environment');
  const filesInput = element('input', 'wallet-photo-input');
  filesInput.type = 'file'; filesInput.accept = 'image/*,application/pdf';
  for (const [input, name] of [[cameraInput, '카메라로 촬영'], [filesInput, '내 파일에서 사진·PDF 선택']]) {
    input.tabIndex = -1; input.setAttribute('aria-label', name); input.setAttribute('aria-hidden', 'true');
  }

  const attach = element('div', 'wallet-attach');
  const zone = element('button', 'wallet-attach-zone'); zone.type = 'button';
  zone.setAttribute('aria-haspopup', 'menu'); zone.setAttribute('aria-expanded', 'false'); zone.setAttribute('aria-describedby', help.id);
  const mark = element('span', 'wallet-photo-mark', '+'); mark.setAttribute('aria-hidden', 'true');
  const preview = element('img', 'wallet-photo-preview'); preview.hidden = true;
  const copy = element('span', 'wallet-photo-copy');
  const title = element('strong');
  copy.append(title);
  const change = element('span', 'wallet-attach-change', '파일 변경'); change.setAttribute('aria-hidden', 'true');
  zone.append(mark, preview, copy, change);

  const menu = element('div', 'wallet-attach-menu'); menu.id = `${label.id}-menu`; menu.hidden = true;
  menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', '자료 가져오기');
  zone.setAttribute('aria-controls', menu.id);
  const options = [['camera', '카메라', '직접 촬영'], ['files', '내 파일', '기기에 저장된 사진·PDF 선택']].map(([source, name, note]) => {
    const option = element('button', 'wallet-attach-option'); option.type = 'button'; option.dataset.walletAttachSource = source;
    option.setAttribute('role', 'menuitem');
    option.append(element('strong', '', name), element('span', '', note));
    option.addEventListener('click', () => void openSource(source));
    return option;
  });
  menu.append(...options);
  attach.append(cameraInput, filesInput, zone, menu);
  const scannerHost = element('div', 'wallet-photo-scanner-host');
  fieldShell.append(label, help);
  if (embedded) {
    const choices = element('div', 'wallet-attach-choices');
    const touch = Boolean(globalThis.matchMedia?.('(pointer: coarse)').matches);
    const sources = [['camera', '카메라로 찍기', '신분증·명함을 바로 촬영', 'camera'], ['files', '내 파일에서 고르기', '사진(JPG·PNG·HEIC) 또는 PDF', 'folder']];
    for (const [source, name, note, icon] of touch ? sources : sources.reverse()) {
      const choice = element('button', 'wallet-attach-choice'); choice.type = 'button'; choice.dataset.walletAttachChoice = source;
      const iconBox = element('span'); iconBox.append(walletIcon(icon));
      const text = element('span'); text.append(element('strong', '', name), element('small', '', note));
      choice.append(iconBox, text);
      choice.addEventListener('click', () => void openSource(source));
      choices.append(choice);
    }
    fieldShell.append(choices);
  }
  fieldShell.append(attach, scannerHost);

  let scanner = null;
  let confirmedDataUrl = '';
  let selectedName = '';
  let state = 'empty';
  let pickerUntil = 0;
  let destroyed = false;

  function paint() {
    zone.dataset.state = state;
    if (embedded) fieldShell.dataset.layout = state === 'empty' ? 'start' : 'review';
    mark.hidden = state !== 'empty';
    preview.hidden = state !== 'ready' || embedded;
    change.hidden = state === 'empty';
    title.textContent = state === 'empty' ? '카메라 또는 내 파일에서 선택' : selectedName;
    zone.setAttribute('aria-label', state === 'empty' ? '자료 첨부: 카메라 또는 내 파일 선택' : `첨부한 자료 ${selectedName}, 파일 변경`);
  }

  const clearScanner = () => {
    scanner?.destroy();
    scanner = null;
    scannerHost.replaceChildren();
  };

  const resetSelection = () => {
    confirmedDataUrl = ''; selectedName = ''; state = 'empty';
    onReady(false);
    preview.removeAttribute('src'); preview.alt = '';
    paint();
  };

  const outsidePress = event => { if (!attach.contains(event.target)) setMenu(false); };
  function setMenu(open) {
    if (open === !menu.hidden) return;
    menu.hidden = !open; zone.setAttribute('aria-expanded', String(open));
    if (open) { document.addEventListener('pointerdown', outsidePress, true); options[0].focus(); }
    else document.removeEventListener('pointerdown', outsidePress, true);
  }
  zone.addEventListener('click', () => setMenu(menu.hidden));
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); setMenu(false); zone.focus(); return; }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const at = options.indexOf(document.activeElement);
    options[(at + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length].focus();
  });

  const pickerClosed = () => { pickerUntil = 0; onPickerClose(); };
  async function openSource(source) {
    setMenu(false);
    if (destroyed || Date.now() < pickerUntil) return;
    pickerUntil = Date.now() + PICKER_REOPEN_MS;
    onError('');
    onPickerOpen(source);
    if (source === 'files' && documentPickerAvailable()) {
      try {
        const [handle] = await globalThis.showOpenFilePicker({multiple: false, excludeAcceptAllOption: true, types: DOCUMENT_PICKER_TYPES});
        const file = await handle?.getFile?.();
        pickerClosed();
        if (file) await choose(file);
        return;
      } catch (error) {
        if (error?.name === 'AbortError') { pickerClosed(); return; }
        // Not allowed here (a policy, a frame): the file input below takes over.
      }
    }
    const input = source === 'camera' ? cameraInput : filesInput;
    input.value = '';
    input.click();
  }
  for (const input of [cameraInput, filesInput]) {
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      // Emptied at once, so choosing the same file again is a new choice.
      input.value = '';
      pickerClosed();
      if (file) void choose(file);
    });
    input.addEventListener('cancel', pickerClosed);
  }

  let choice = 0;
  async function choose(file) {
    const current = ++choice;
    setMenu(false);
    onError('');
    let kind;
    try {
      kind = await walletFileKind(file);
    } catch (error) {
      if (current === choice && !destroyed) onError(safeMessage(error, '파일을 선택하지 못했습니다.'));
      return;
    }
    if (current !== choice || destroyed) return;
    clearScanner();
    confirmedDataUrl = ''; onReady(false);
    preview.removeAttribute('src'); preview.alt = '';
    selectedName = file.name || '촬영한 사진'; state = 'scanning'; paint();
    const name = selectedName;
    scanner = createWalletDocumentScanner({
      file,
      kind,
      embedded,
      onState(scan) {
        if (current !== choice || destroyed) return;
        confirmedDataUrl = scan.ready ? scan.dataUrl : '';
        state = scan.ready ? 'ready' : 'scanning'; paint();
        onReady(scan.ready);
        onState(scan);
      },
      onConfirm(dataUrl) {
        confirmedDataUrl = dataUrl;
        if (!embedded) {
          clearScanner();
          preview.src = dataUrl;
          preview.alt = `보정된 ${name} 미리보기`;
        }
        state = 'ready'; paint();
        onReady(true);
      },
      onCancel() {
        clearScanner();
        resetSelection();
      },
    });
    scannerHost.append(scanner.element);
  }

  paint();
  return Object.freeze({
    element: fieldShell,
    // 내 파일 (photos and PDFs) and 카메라; both lead to the same check, scanner and save.
    input: filesInput,
    filesInput,
    cameraInput,
    async readDataUrl() {
      if (!confirmedDataUrl) throw new Error('사진 보정 결과를 확인한 뒤 저장해 주세요.');
      return confirmedDataUrl;
    },
    destroy() {
      destroyed = true;
      setMenu(false);
      clearScanner();
    },
  });
}

// Shape of a saved item, from its picture alone (nothing is read from it): a landscape
// card (ID, licence, certificate card, business card: about 1.3-2.1 : 1) or a document (a page,
// a portrait or square picture). The deck shows a card photo as the card face and a document as
// a document card: its first page small, beside its title.
export const WALLET_ITEM_SHAPES = Object.freeze(['card', 'document']);
export function walletItemShape(width, height) {
  if (!(width > 0) || !(height > 0)) return '';
  const ratio = width / height;
  return ratio >= 1.25 && ratio <= 2.1 ? 'card' : 'document';
}

function savedDateLabel(card) {
  const saved = new Date(card.updatedAt);
  if (!Number.isFinite(saved.getTime())) return '';
  return `${saved.getFullYear()}.${String(saved.getMonth() + 1).padStart(2, '0')}.${String(saved.getDate()).padStart(2, '0')} 등록`;
}

// LIFE-WALLET-REDESIGN-02: the saved items as a list the owner can scan, search and sort — a
// grid of cards on a wide screen, one row per item on a phone. Pictures are blurred in the list
// (a press on one shows it for a moment); the full picture is on the item's own page.
export const WALLET_ITEM_SORTS = Object.freeze([['recent', '최근 추가순'], ['title', '이름순'], ['kind', '종류순']]);
const WALLET_KIND_EXAMPLES = Object.freeze({
  identity: ['주민등록증·운전면허증·여권', '면허증·여권'],
  'business-card': ['받은 명함·내 명함', '받은 명함'],
  document: ['재직증명서·등본·계약서 PDF', '증명서·계약서'],
  other: ['회원증·보험증권 같은 생활자료', '회원증·보험증권'],
});
const WALLET_KIND_SUBJECT = Object.freeze({identity: '신분증이', 'business-card': '명함이', document: '증명서·문서가', other: '기타 자료가'});
const ITEM_REVEAL_MS = 30_000;

// 을/를 and 으로/로 after a Korean word (the last syllable's final consonant decides).
function hasFinalConsonant(word) {
  const code = String(word || '').trim().at(-1)?.charCodeAt(0) ?? 0;
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
}
export function withObjectParticle(word) { return `${word}${hasFinalConsonant(word) ? '을' : '를'}`; }
export function withDirectionParticle(word) {
  const code = String(word || '').trim().at(-1)?.charCodeAt(0) ?? 0;
  const final = code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 : 0;
  return `${word}${final === 0 || final === 8 ? '로' : '으로'}`;
}

function walletSearchText(value) { return String(value || '').normalize('NFKC').toLocaleLowerCase('ko'); }

export function filterWalletItems(cards, {filter = 'all', query = '', sort = 'recent', titles = walletItemTitles(cards)} = {}) {
  const needle = walletSearchText(query).trim();
  const order = WALLET_ITEM_CATEGORY_IDS;
  const visible = cards.filter(card => (filter === 'all' || walletItemCategory(card) === filter)
    && (!needle || walletSearchText(`${titles.get(card.id) || ''} ${card.note || ''} ${walletCategoryLabel(card)}`).includes(needle)));
  if (sort === 'title') visible.sort((left, right) => (titles.get(left.id) || '').localeCompare(titles.get(right.id) || '', 'ko'));
  else if (sort === 'kind') visible.sort((left, right) => order.indexOf(walletItemCategory(left)) - order.indexOf(walletItemCategory(right)) || right.updatedAt.localeCompare(left.updatedAt));
  else visible.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return visible;
}

export function createWalletItems({cards, onOpen, onAdd = () => {}, initialFilter = 'all', onStateChange = () => {}}) {
  const titles = walletItemTitles(cards);
  const panel = element('div', 'wallet-items'); panel.dataset.walletPanel = 'items';
  panel.setAttribute('role', 'tabpanel'); panel.id = 'wallet-panel-items';

  const toolbar = element('div', 'wallet-toolbar');
  const search = element('label', 'wallet-search');
  const searchInput = element('input'); searchInput.type = 'search'; searchInput.placeholder = '제목·메모로 찾기';
  searchInput.setAttribute('aria-label', '자료 찾기'); searchInput.autocomplete = 'off'; searchInput.spellcheck = false; searchInput.dataset.walletSearch = '';
  search.append(walletIcon('search'), searchInput);
  const add = button('', () => onAdd('')); add.classList.add('wallet-add-action'); add.setAttribute('aria-label', '자료 추가');
  add.append(walletIcon('plus'), element('span', 'wallet-add-label-desktop', '자료 '), '추가');
  toolbar.append(search, add);

  const filters = element('div', 'wallet-filters'); filters.setAttribute('role', 'group'); filters.setAttribute('aria-label', '자료 종류');
  const head = element('div', 'wallet-list-head');
  const count = element('p', 'wallet-list-count'); count.setAttribute('aria-live', 'polite');
  const sortLabel = element('label', 'wallet-sort'); const sortSelect = element('select'); sortSelect.setAttribute('aria-label', '정렬'); sortSelect.dataset.walletSort = '';
  for (const [value, label] of WALLET_ITEM_SORTS) { const option = element('option', '', label); option.value = value; sortSelect.append(option); }
  sortLabel.append(walletIcon('swap'), sortSelect);
  head.append(count, sortLabel);
  const grid = element('ul', 'wallet-grid'); grid.setAttribute('aria-label', '저장 자료');
  const empty = element('div'); empty.hidden = true;
  panel.append(toolbar, filters, head, grid, empty);

  let filter = initialFilter === 'all' || WALLET_ITEM_CATEGORY_IDS.includes(initialFilter) ? initialFilter : 'all';
  if (filter !== 'all' && !cards.some(card => walletItemCategory(card) === filter)) filter = 'all';
  let query = ''; let sort = 'recent';
  const revealTimers = new Map();

  function itemNode(card) {
    const title = titles.get(card.id) || walletCardTitle(card);
    const item = element('li', 'wallet-item'); item.dataset.walletItem = card.id; item.dataset.category = walletItemCategory(card);
    const thumb = element('button', 'wallet-item-thumb'); thumb.type = 'button'; thumb.dataset.walletItemReveal = '';
    const photo = element('img', 'wallet-item-photo'); photo.src = card.frontDataUrl; photo.alt = ''; photo.draggable = false; photo.decoding = 'async';
    const veil = element('span', 'wallet-item-veil'); veil.append(walletIcon('eyeOff'), element('span', 'wallet-veil-text', '눌러서 보기'));
    const hide = element('span', 'wallet-item-hide'); hide.append(walletIcon('eye'), '가리기');
    const masked = value => {
      clearTimeout(revealTimers.get(card.id));
      photo.dataset.masked = String(value); veil.hidden = !value; hide.hidden = value;
      thumb.setAttribute('aria-pressed', String(!value));
      thumb.setAttribute('aria-label', value ? `${title} 사진 잠깐 보기` : `${title} 사진 가리기`);
      if (!value) revealTimers.set(card.id, setTimeout(() => { if (photo.isConnected) masked(true); }, ITEM_REVEAL_MS));
    };
    thumb.addEventListener('click', () => masked(photo.dataset.masked !== 'true'));
    thumb.append(photo, veil, hide);
    masked(true);
    const open = element('button', 'wallet-item-open'); open.type = 'button'; open.dataset.walletItemOpen = card.id;
    open.setAttribute('aria-label', `${title} 열기`);
    const line = element('span', 'wallet-item-line');
    line.append(element('span', 'wallet-item-title', title), element('span', 'wallet-kind-badge', walletCategoryLabel(card)));
    const meta = element('span', 'wallet-item-meta');
    const metaKind = element('span', 'wallet-kind-badge wallet-item-meta-kind', walletCategoryLabel(card));
    const memo = walletOwnTitle(card) ? walletMemoTitle(card) : '';
    meta.append(metaKind, memo ? `${savedDateLabel(card)} · ${memo}` : savedDateLabel(card));
    const chevron = walletIcon('chevron'); chevron.classList.add('wallet-item-chevron');
    const text = element('span', 'wallet-item-text'); text.append(line, meta);
    open.append(text, chevron);
    open.addEventListener('click', () => onOpen(card, title));
    item.append(thumb, open);
    return item;
  }
  const nodes = new Map(cards.map(card => [card.id, itemNode(card)]));

  function renderFilters() {
    filters.replaceChildren(...[['all', '전체'], ...WALLET_ITEM_CATEGORIES].map(([id, label]) => {
      const total = id === 'all' ? cards.length : cards.filter(card => walletItemCategory(card) === id).length;
      const chip = element('button', 'wallet-filter'); chip.type = 'button'; chip.dataset.walletFilter = id;
      chip.append(label, element('span', 'wallet-filter-count', String(total)));
      chip.setAttribute('aria-pressed', String(id === filter));
      chip.addEventListener('click', () => { filter = id; onStateChange({filter, selectedId: ''}); paint(); });
      return chip;
    }));
  }

  function emptyFor(kind) {
    const box = element('section', 'wallet-kind-empty'); box.dataset.walletEmpty = query ? 'search' : 'kind';
    const icon = element('span', 'wallet-kind-icon'); icon.append(walletIcon(query ? 'search' : kind));
    if (query) {
      const clear = button('검색어 지우기', () => { searchInput.value = ''; query = ''; paint(); searchInput.focus(); }, true);
      const more = button('', () => onAdd('')); more.append(walletIcon('plus'), '자료 추가');
      const actions = element('div', 'wallet-form-actions'); actions.append(clear, more);
      box.append(icon, element('h3', '', `‘${query}’에 맞는 자료가 없어요`), element('p', '', '다른 말로 찾아보거나, 자료를 새로 넣어 주세요.'), actions,
        element('p', 'wallet-search-note', '제목·메모에서만 찾아요. 사진 속 글자는 찾지 않아요.'));
      return box;
    }
    const label = WALLET_ITEM_CATEGORIES.find(([value]) => value === kind)?.[1] || '자료';
    const put = button('', () => onAdd(kind)); put.append(walletIcon('plus'), `${label} 넣기`);
    const hint = element('div', 'wallet-kind-hint');
    const copy = element('div'); copy.append(element('strong', '', `${withObjectParticle(label)} 다른 종류로 넣었나요?`),
      element('span', '', '자료를 열어 종류 바꾸기를 누르면 다시 올리지 않아도 여기로 옮겨져요.'));
    const all = button('전체 보기', () => { filter = 'all'; onStateChange({filter, selectedId: ''}); paint(); }, true);
    hint.append(copy, all);
    box.append(icon, element('h3', '', `${WALLET_KIND_SUBJECT[kind] || '자료가'} 아직 없어요`),
      element('p', '', '사진이나 PDF로 넣어 두면 필요할 때 바로 꺼내 볼 수 있어요.'), put, hint);
    return box;
  }

  function paint() {
    renderFilters();
    const visible = filterWalletItems(cards, {filter, query, sort, titles});
    grid.replaceChildren(...visible.map(card => nodes.get(card.id)));
    const label = filter === 'all' ? '자료' : WALLET_ITEM_CATEGORIES.find(([value]) => value === filter)?.[1];
    count.textContent = query ? `‘${query}’ 결과 ${visible.length}개` : `${label} ${visible.length}개`;
    grid.hidden = !visible.length; head.hidden = !visible.length && !query;
    empty.replaceChildren(); empty.hidden = Boolean(visible.length);
    if (!visible.length) empty.append(emptyFor(filter));
  }

  let typing = 0;
  searchInput.addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(() => { query = searchInput.value.trim(); paint(); }, 120); });
  sortSelect.addEventListener('change', () => { sort = sortSelect.value; paint(); });
  paint();
  return panel;
}

function downloadBackup(serialized) {
  const url = URL.createObjectURL(new Blob([serialized], {type: 'application/octet-stream'}));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `lotbi-life-wallet-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}.lotbiwallet`;
  anchor.rel = 'noopener'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// The wallet exists only in this browser's storage. Ask the browser to keep that storage
// (otherwise Chrome may clear it when the disk runs low). The browser decides on its own —
// Chrome by engagement / installed app / bookmark, Firefox may ask, Safari by its rules — and a
// refusal changes nothing. In-memory browsers (private windows, some in-app browsers) lose it
// on close regardless; the setup screen says why a new PIN is asked.
export async function requestPersistentWalletStorage(storage = globalThis.navigator?.storage) {
  try {
    if (typeof storage?.persist !== 'function') return 'unsupported';
    if (await storage.persisted?.()) return 'persisted';
    return (await storage.persist()) ? 'persisted' : 'best-effort';
  } catch { return 'unsupported'; }
}

// Copies on the owner's press. The outcome is what the browser reported: the Clipboard API first
// (Safari wants it called inside the press, so nothing is awaited before it), then the older copy
// command. 'manual' means neither was allowed and the number has to be selected by hand. Nothing
// clears the clipboard afterwards; browsers give a page no way to do that reliably.
export async function copyTextToClipboard(text, {clipboard = globalThis.navigator?.clipboard, doc = globalThis.document} = {}) {
  if (typeof clipboard?.writeText === 'function') {
    try { await clipboard.writeText(text); return 'copied'; }
    catch { /* refused or failed: the copy command may still be allowed */ }
  }
  try {
    const field = doc.createElement('textarea');
    field.value = text; field.readOnly = true; field.tabIndex = -1; field.setAttribute('aria-hidden', 'true');
    field.style.cssText = 'position:fixed;top:0;left:-9999px;width:1px;height:1px;opacity:0;font-size:16px';
    const active = doc.activeElement;
    doc.body.append(field);
    let copied = false;
    try { field.select(); field.setSelectionRange(0, text.length); copied = doc.execCommand?.('copy') === true; }
    finally { field.remove(); doc.getSelection?.()?.removeAllRanges(); active?.focus?.({preventScroll: true}); }
    if (copied) return 'copied';
  } catch { /* no copy command here */ }
  return 'manual';
}

// The official steps, all on the customs portal (identity checks and any one-time codes stay
// there; LOTBI never sees them). After a new or changed code, the saved one is changed here.
const CUSTOMS_OFFICIAL_STEPS = Object.freeze([
  ['lookup', '내 번호 조회', '메뉴: 개인통관고유부호 조회/정보변경'],
  ['update', '주소·연락처 정보 변경', '메뉴: 개인통관고유부호 조회/정보변경'],
  ['renew', '유효기간 갱신', '메뉴: 개인통관고유부호 유효기간 갱신'],
  ['reissue', '부호 변경·재발급', '메뉴: 개인통관고유부호 부호변경 · 새 번호를 받으면 여기 저장한 번호도 바꿔 주세요'],
]);
const CUSTOMS_REVEAL_MS = 30_000;

function customsPortalLink(label, className = 'wallet-customs-link') {
  const link = element('a', className, label);
  link.href = CUSTOMS_PORTAL_URL; link.target = '_blank'; link.rel = 'noopener noreferrer';
  link.dataset.walletCustomsOfficial = 'portal';
  return link;
}

function customsOfficialList() {
  const wrap = element('section', 'wallet-customs-official');
  wrap.setAttribute('aria-label', '관세청 공식 처리');
  wrap.append(element('h4', '', '관세청에서 처리하기'), element('p', 'wallet-customs-hint', '관세청 전자상거래 통관포털이 새 창으로 열립니다. 본인 확인과 인증번호 입력은 관세청 화면에서만 합니다.'));
  const list = element('ul', 'wallet-customs-steps');
  for (const [id, label, menu] of CUSTOMS_OFFICIAL_STEPS) {
    const item = element('li');
    const link = customsPortalLink('', 'wallet-customs-step'); link.dataset.walletCustomsStep = id;
    link.append(element('strong', '', label), element('span', '', menu));
    item.append(link); list.append(item);
  }
  wrap.append(list);
  return wrap;
}

function customsDateLabel(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}` : '';
}

// When a server backup was made (YYYY.MM.DD HH:mm, local time).
function serverBackupTime(meta) {
  const at = new Date(meta?.created_at || '');
  if (!Number.isFinite(at.getTime())) return '';
  const two = value => String(value).padStart(2, '0');
  return `${at.getFullYear()}.${two(at.getMonth() + 1)}.${two(at.getDate())} ${two(at.getHours())}:${two(at.getMinutes())}`;
}

// Free members keep one item of their own; paid plans keep their existing (unlimited) room.
// Items already saved are never removed: only adding one more is held back.
export const FREE_WALLET_ITEM_LIMIT = 1;
export function walletAddBlocked(subscription, count) {
  return subscription?.plan === 'FREE' && count >= FREE_WALLET_ITEM_LIMIT;
}

export function mountLifeWallet({root, authenticated = false, accountId = '', sessionExpiresAt = '', sessionToken = '', subscription = null, customsCode = CUSTOMS_CODE_RELEASED} = {}) {
  const vault = new LifeWalletVault(new IndexedDbWalletRepository());
  // LIFE-WALLET-REDESIGN-02: the wallet's colour and type tokens (site-life-wallet.css) hang on
  // this class; it leaves with the wallet, so other sections that reuse the root keep their look.
  root.classList.add('wallet-root');
  const walletViewStateKey = accountId ? accountScope(accountId).then(scope => `${WALLET_VIEW_STATE_PREFIX}${scope}`).catch(() => '') : Promise.resolve('');
  // Sharing needs the signed-in session (share requests live on LOTBI Core). An original
  // leaves this device only sealed for the accepted recipient's key (site-life-wallet-share-crypto.js).
  const shareWallet = Object.freeze({
    ensureKey: () => vault.ensureShareKey(accountId),
    rememberKeyId: (publicKey, keyId) => vault.rememberShareKeyId(accountId, publicKey, keyId),
    open: sealed => vault.openSharedItem(accountId, sealed),
    list: () => vault.list(accountId),
    save: card => vault.save(accountId, card),
    addBlocked: count => walletAddBlocked(subscription, count),
    newId: () => randomId(),
  });
  // LIFE-WALLET-WIFI-CARD-01: saved Wi-Fi (device only), for every member including Free.
  const wifi = createWalletWifi({root, vault, accountId, onBack: (message = '') => void renderWallet(message, {tab: 'life'}), activity: () => activity(), isOpen: () => unlocked && !disposed});
  const share = sessionToken ? createWalletShare({root, sessionToken, wallet: shareWallet, onBack: () => void renderWallet(), onActivity: () => activity()}) : null;
  // LIFE-WALLET-ENCRYPTED-BACKUP-01: the sealed server backup (loaded only for a signed-in
  // session). Core sees the envelope, never the backup password, the key or an item.
  const serverBackupModule = sessionToken ? import('./site-life-wallet-backup.js?v=aset-66255ae7fee8') : null;
  let serverBackupClient = null;
  const serverBackup = async () => {
    const module = await serverBackupModule;
    serverBackupClient ||= module.createWalletServerBackup({sessionToken});
    return {module, client: serverBackupClient};
  };
  // What Core says about this account's backup: null when there is none or Core does not answer
  // in time — the wallet never waits long for it.
  const describeServerBackup = async () => {
    if (!serverBackupModule) return null;
    try {
      const {client} = await serverBackup();
      return await Promise.race([client.describe(), new Promise(resolve => setTimeout(() => resolve(null), 4000))]);
    } catch { return null; }
  };
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
  // A camera or file chooser opened from the add form covers the page on a phone, which hides it.
  // The key leaves memory as on any trip to the background, but the add form stays (no saved item
  // is on it), so the chosen photo arrives where it was asked for; back on the page the session
  // grant reopens the wallet, or it locks if that grant ran out.
  let pickerOpen = false;
  let pickerSuspended = false;
  let resuming = null;
  const visibilityListener = () => {
    clearTimeout(backgroundTimer);
    if (document.visibilityState === 'hidden' && unlocked) {
      const keepAddForm = pickerOpen && Boolean(root.querySelector('[data-wallet-view="add"]'));
      backgroundTimer = setTimeout(() => {
        if (document.visibilityState === 'hidden' && unlocked) {
          unlocked = false;
          vault.suspend();
          clearTimeout(timer);
          if (keepAddForm) { pickerSuspended = true; return; }
          root.replaceChildren();
        }
      }, 150);
      return;
    }
    if (document.visibilityState === 'visible' && pickerSuspended) {
      pickerSuspended = false;
      resuming = resumeAfterPicker().finally(() => { resuming = null; });
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
    const state = element('section', 'wallet-gate wallet-notice');
    state.append(lockMark(), element('h3', '', title), element('p', '', copy));
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
      const waiting = !message && hasWalletShareIntent() ? '공유 링크를 열었습니다. 월렛 잠금을 풀면 공유 요청을 확인할 수 있습니다.' : message;
      if (!exists) renderSetup(waiting); else renderUnlock(waiting);
    } catch (error) {
      if (!disposed && generation === renderGeneration) renderNotice('Life Wallet을 열 수 없습니다', safeMessage(error, '브라우저 보관함을 확인하지 못했습니다.'));
    }
  }

  async function resumeAfterPicker() {
    const generation = renderGeneration;
    if (!disposed && sessionAuthenticated && accountId && await vault.resumeUnlock(accountId)) {
      if (disposed || generation !== renderGeneration) return;
      unlocked = true; activity();
      return;
    }
    if (!disposed && generation === renderGeneration) await renderLocked();
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

  // After a PIN is made or entered (a user action): ask once per mount to keep the storage.
  let storageRequested = false;
  function keepWalletStorage() {
    if (storageRequested) return;
    storageRequested = true;
    void requestPersistentWalletStorage().then(result => { root.dataset.walletStorage = result; });
  }

  // LIFE-WALLET-REDESIGN-02: the lock card says what is locked and why on the left (on a phone,
  // above), and takes the PIN on the right: dots, a number pad (digits and 지움 only) and one
  // wide 열기/다음 button under it. A hardware keyboard types into the hidden field.
  function lockInfo(mark, title, copy, points) {
    const info = element('div', 'wallet-lock-info');
    const list = element('ul', 'wallet-lock-points');
    for (const [icon, text, tone] of points) {
      const item = element('li'); if (tone) item.dataset.tone = tone;
      item.append(walletIcon(icon), text); list.append(item);
    }
    info.append(mark, element('h3', '', title), element('p', '', copy), list);
    return info;
  }

  function pinDots() {
    const dots = element('div', 'wallet-pin-dots');
    const paint = length => {
      dots.replaceChildren(...[0, 1, 2, 3].map(index => {
        const dot = element('span', 'wallet-pin-dot', index < length ? '●' : '○');
        dot.dataset.filled = String(index < length);
        return dot;
      }));
      dots.setAttribute('aria-label', `PIN ${length}자리 입력됨`);
    };
    paint(0);
    return {dots, paint};
  }

  // The pad in its own order (1-9, 지움, 0, then the wide confirm button); the stylesheet puts 0
  // in the middle and 지움 on the right of the bottom row, and the confirm button under the pad.
  function pinKeypad(target, confirm) {
    const keypad = element('div', 'wallet-keypad'); keypad.setAttribute('aria-label', '숫자 키패드');
    for (const digit of ['1','2','3','4','5','6','7','8','9','지움','0','열기']) {
      if (digit === '열기') { keypad.append(confirm); continue; }
      const key = button(digit, () => {
        const pin = target();
        if (/^\d$/u.test(digit) && pin.value.length < 4) pin.value += digit;
        if (digit === '지움') pin.value = pin.value.slice(0, -1);
        pin.dispatchEvent(new Event('input', {bubbles: true}));
      }, digit === '지움');
      key.classList.add(digit === '지움' ? 'wallet-key-erase' : 'wallet-key'); key.dataset.key = digit;
      if (digit === '지움') { key.setAttribute('aria-label', '한 칸 지우기'); key.prepend(walletIcon('erase')); }
      keypad.append(key);
    }
    return keypad;
  }

  function forgotPinHelp() {
    const help = element('details', 'wallet-lock-help');
    help.append(element('summary', '', 'PIN을 잊었나요?'), element('p', '', 'PIN을 되찾는 방법은 없어요. 자료를 지우지 말고 LOTBI 지원에 문의해 주세요. 백업 파일을 만들어 두었다면 새 PIN으로 복원할 수 있어요.'));
    return help;
  }

  function renderSetup(message = '') {
    const wrap = element('section', 'wallet-gate wallet-setup-gate');
    const info = lockInfo(lockMark(), 'Life Wallet PIN 만들기', '계정 비밀번호와 다른 숫자 4자리를 정해 주세요.', [
      ['key', 'PIN은 이 기기에서만 쓰고, 저장하거나 보내지 않아요'],
      ['clock', '10분 동안 쓰지 않으면 자동으로 잠겨요'],
      ['alert', 'PIN을 잊으면 되찾을 수 없어요. 설정에서 백업을 만들어 두세요', 'warn'],
    ]);
    // Why a new PIN, on an account that already has a wallet somewhere else.
    info.append(element('p', 'wallet-setup-why', '이 브라우저에는 아직 이 계정의 월렛이 없어요. 월렛은 기기·브라우저마다 따로 저장되어, 다른 기기나 브라우저, 저장 데이터가 지워진 브라우저(시크릿 창 포함)에서는 PIN을 새로 만들어야 해요. 다른 곳에 저장한 자료는 그곳의 설정에서 만든 암호화 백업 파일로 옮겨 올 수 있어요.'));
    const form = element('form', 'wallet-pin-form wallet-setup-form');
    const pin = pinInput('새 월렛 PIN'); const confirmation = pinInput('새 월렛 PIN 확인'); const status = errorRegion();
    if (message) status.textContent = message;
    let step = 1;
    const active = () => (step === 1 ? pin : confirmation);
    const head = element('div', 'wallet-pin-head'); const headLabel = element('span', '', '새 PIN 4자리'); const stepLabel = element('span', 'wallet-pin-step', '1 / 2');
    head.append(headLabel, stepLabel);
    const {dots, paint} = pinDots();
    const hint = element('p', 'wallet-pin-hint', '한 번 더 입력해서 확인해요');
    const submit = button('다음'); submit.type = 'submit'; submit.classList.add('wallet-key-confirm');
    const keypad = pinKeypad(active, submit);
    for (const input of [pin, confirmation]) input.addEventListener('input', () => { if (input === active()) paint(input.value.length); });
    const showStep = next => {
      step = next; headLabel.textContent = next === 1 ? '새 PIN 4자리' : 'PIN 한 번 더'; stepLabel.textContent = `${next} / 2`;
      submit.textContent = next === 1 ? '다음' : 'PIN 설정하고 열기'; hint.hidden = next === 2;
      paint(active().value.length); focusUnlessTouch(active());
    };
    form.append(pin, confirmation, head, dots, status, hint, keypad);
    let setupBackup = null;
    if (serverBackupModule) {
      void describeServerBackup().then(meta => {
        if (!meta || !form.isConnected) return;
        setupBackup = meta;
        const notice = element('p', 'wallet-server-backup-notice', `서버에 백업한 월렛이 있습니다 (${serverBackupTime(meta)}). PIN을 만든 뒤 바로 불러올 수 있습니다.`);
        notice.dataset.walletServerBackupNotice = '';
        info.append(notice);
      });
    }
    form.addEventListener('submit', async event => {
      event.preventDefault(); status.textContent = ''; delete form.dataset.state;
      try {
        validateWalletPin(pin.value);
        // A first PIN moves to the second step; both typed (keyboard, assistive tech) go on.
        if (step === 1 && confirmation.value.length < 4) { showStep(2); return; }
        if (pin.value !== confirmation.value) {
          confirmation.value = ''; showStep(2);
          throw new Error('두 PIN이 일치하지 않습니다.');
        }
        setBusy(form, true); await vault.create(accountId, pin.value);
        pin.value = ''; confirmation.value = ''; unlocked = true; activity(); keepWalletStorage();
        if (setupBackup) renderServerRestore(setupBackup); else await renderWallet();
      } catch (error) { form.dataset.state = 'error'; status.textContent = safeMessage(error, 'PIN을 설정하지 못했습니다.'); setBusy(form, false); focusUnlessTouch(active()); }
    });
    wrap.append(info, form);
    root.replaceChildren(wrap); showStep(1);
  }

  function renderUnlock(message = '') {
    const wrap = element('section', 'wallet-gate wallet-unlock-gate');
    const info = lockInfo(lockMark(), 'Life Wallet이 잠겨 있어요', 'PIN 4자리를 입력하면 열려요.', [
      ['shield', '자료는 이 기기에만 암호화해 보관해요'],
      ['clock', '10분 동안 쓰지 않으면 자동으로 잠겨요'],
      ['key', 'PIN은 저장하거나 보내지 않아요'],
    ]);
    info.append(forgotPinHelp());
    const form = element('form', 'wallet-pin-form wallet-unlock-form');
    const pin = pinInput('월렛 PIN'); const status = errorRegion(); if (message) status.textContent = message;
    // The PIN is entered on the keypad below, so the phone's on-screen keyboard stays down
    // (inputmode none); a hardware keyboard and screen readers still use the field. On touch
    // screens the field is not focused automatically.
    pin.inputMode = 'none';
    const focusPin = () => { if (!window.matchMedia?.('(pointer: coarse)').matches) pin.focus(); };
    const head = element('div', 'wallet-pin-head'); head.append(element('span', '', 'PIN 4자리'));
    const {dots, paint} = pinDots();
    pin.addEventListener('input', () => paint(pin.value.length));
    const tries = element('p', 'wallet-pin-tries');
    const open = button('열기'); open.type = 'submit'; open.classList.add('wallet-key-confirm');
    const keypad = pinKeypad(() => pin, open);
    form.append(pin, head, dots, status, tries, keypad, element('p', 'wallet-pin-keyboard-hint', '키보드 숫자로도 입력할 수 있어요'));
    // Tries left and any wait, from the counters the vault already keeps.
    let waitTimer = 0;
    const holdKeys = held => {
      keypad.setAttribute('aria-disabled', String(held));
      for (const key of keypad.querySelectorAll('button')) key.disabled = held;
      open.disabled = held;
    };
    const paintAttempts = async () => {
      let state;
      try { state = await vault.attemptState(accountId); } catch { return; }
      if (!form.isConnected) return;
      clearInterval(waitTimer);
      if (state.blocked) { form.dataset.state = 'error'; tries.textContent = ''; holdKeys(true); return; }
      tries.textContent = state.failedAttempts ? `남은 시도 ${state.remaining}번 · ${MAX_PIN_FAILURES}번 틀리면 월렛이 잠겨요` : '';
      if (state.waitMs <= 0) { holdKeys(false); open.textContent = '열기'; return; }
      const until = Date.now() + state.waitMs;
      const tick = () => {
        const left = Math.ceil((until - Date.now()) / 1000);
        if (left <= 0 || !form.isConnected) { clearInterval(waitTimer); holdKeys(false); open.textContent = '열기'; return; }
        holdKeys(true); open.textContent = `${left}초 뒤에 다시 입력`;
      };
      tick(); waitTimer = setInterval(tick, 1000);
    };
    form.addEventListener('submit', async event => {
      event.preventDefault(); status.textContent = ''; delete form.dataset.state;
      try {
        validateWalletPin(pin.value); setBusy(form, true); await vault.unlock(accountId, pin.value);
        clearInterval(waitTimer); pin.value = ''; unlocked = true; activity(); keepWalletStorage(); await renderWallet();
      } catch (error) {
        form.dataset.state = 'error'; status.textContent = safeMessage(error, '잠금을 해제하지 못했습니다.'); setBusy(form, false); pin.value = ''; paint(0); focusPin();
        void paintAttempts();
      }
    });
    wrap.append(info, form);
    root.replaceChildren(wrap); focusPin(); void paintAttempts();
  }

  // A finished step says so in a green note that leaves after a few seconds and never follows
  // the owner to another screen (it is part of this render only).
  function doneNote(text) {
    const note = element('p', 'wallet-message wallet-toast', text);
    note.dataset.tone = 'done'; note.setAttribute('role', 'status'); note.setAttribute('aria-live', 'polite');
    setTimeout(() => { note.hidden = true; }, 3500);
    return note;
  }

  function backButton(label, onBack) {
    const back = button('', onBack, true); back.classList.add('wallet-back', 'wallet-text-action');
    back.append(walletIcon('back'), label);
    back.dataset.subviewBack = '';   // SUBVIEW-BACK-NAVIGATION-01: the phone's back presses this (site-conversation.js).
    return back;
  }

  function pageHead(title, onBack, backLabel = '목록으로', extra = null) {
    const head = element('div', 'wallet-page-head');
    head.append(backButton(backLabel, onBack), element('h3', '', title));
    if (extra) head.append(extra);
    return head;
  }

  function safeLine(text) {
    const line = element('p', 'wallet-safe-line'); line.append(walletIcon('shield'), text);
    return line;
  }

  // One way in for every kind: the four tiles, each opening the add form with its kind chosen.
  function emptyItems(backupMeta) {
    const empty = element('section', 'wallet-empty'); empty.dataset.walletEmpty = 'wallet';
    const copy = element('div', 'wallet-empty-copy');
    copy.append(element('h3', '', '첫 자료를 넣어 보세요'), element('p', '', '신분증·명함·증명서를 사진이나 PDF로 넣어 두면 필요할 때 바로 꺼내 볼 수 있어요.'));
    const tiles = element('div', 'wallet-kind-tiles');
    for (const [kind, label] of WALLET_ITEM_CATEGORIES) {
      const tile = element('button', 'wallet-kind-tile'); tile.type = 'button'; tile.dataset.walletAddKind = kind;
      const icon = element('span', 'wallet-kind-icon'); icon.append(walletIcon(kind));
      tile.append(icon, element('strong', '', label), element('span', '', WALLET_KIND_EXAMPLES[kind][0]), element('em', '', `+ ${label} 넣기`));
      tile.addEventListener('click', () => openAdd(kind));
      tiles.append(tile);
    }
    const first = button('', () => openAdd('')); first.append(walletIcon('plus'), '첫 자료 등록하기'); first.classList.add('wallet-add-first');
    const foot = element('div', 'wallet-empty-foot');
    const restore = button('백업에서 복원', renderImport, true); restore.classList.add('wallet-text-action');
    foot.append(element('span', '', '종류는 넣은 뒤에도 바꿀 수 있어요.'), element('span', '', '다른 기기에서 쓰던 월렛이 있나요?'), restore);
    empty.append(copy, tiles, first, foot);
    if (backupMeta) {
      const serverRestore = button('서버 백업 불러오기', () => renderServerRestore(backupMeta), true); serverRestore.dataset.walletServerBackup = 'restore';
      empty.append(element('p', 'wallet-server-backup-notice', `서버에 ${serverBackupTime(backupMeta)} 백업한 월렛이 있습니다.`), serverRestore);
    }
    return empty;
  }

  function lifePanel(customs, customsUnreadable, wifiSection) {
    const life = element('section', 'wallet-life'); life.dataset.walletPanel = 'life';
    life.setAttribute('role', 'tabpanel'); life.id = 'wallet-panel-life'; life.setAttribute('aria-label', '생활정보');
    const grid = element('div', 'wallet-life-grid');
    if (customsCode) grid.append(customsCard(customs, customsUnreadable));
    grid.append(wifiSection);
    const note = element('div', 'wallet-life-note');
    const more = element('details'); more.append(element('summary', '', '자세히'),
      element('p', '', `${customsCode ? '개인통관고유부호는 백업 파일에만 함께 암호화되어 들어가고, 서버 백업과 공유에는 들어가지 않아요. ' : ''}와이파이는 어떤 백업이나 공유에도 들어가지 않아요.`));
    note.append(walletIcon('shield'), element('span', '', '생활정보도 내 자료와 같은 PIN으로 잠기고, 이 기기에만 암호화해 보관해요.'), more);
    life.append(element('p', 'wallet-life-intro', '결제할 때, 손님이 왔을 때 바로 꺼내 쓰는 번호와 비밀번호예요.'), grid, note);
    return life;
  }

  // The last screen's data, for the settings screen and the add form's "명함 5" hint.
  let walletContext = {cards: [], customs: null, backupMeta: null};
  let walletTab = 'items';
  const openAdd = (preset = '') => (walletAddBlocked(subscription, walletContext.cards.length) ? renderAddLimit() : renderAdd(preset));

  async function renderWallet(message = '', {tab = ''} = {}) {
    const generation = ++renderGeneration;
    if (tab) walletTab = tab;
    root.dataset.walletState = 'unlocked';
    const loading = element('p', 'wallet-message', '암호화된 자료를 여는 중입니다.'); loading.dataset.tone = 'progress';
    root.replaceChildren(loading);
    try {
      const cards = await vault.list(accountId);
      // A code that cannot be opened is reported on its own card; the rest of the wallet opens.
      let customs = null; let customsUnreadable = false;
      if (customsCode) {
        try { customs = await vault.getCustomsCode(accountId); }
        catch (error) { if (!unlocked || disposed) throw error; customsUnreadable = true; }
      }
      if (disposed || !unlocked || generation !== renderGeneration) return;
      const backupMeta = await describeServerBackup();
      if (disposed || !unlocked || generation !== renderGeneration) return;
      const wifiSection = await wifi.section();
      if (disposed || !unlocked || generation !== renderGeneration) return;
      const viewStorageKey = await walletViewStateKey;
      if (disposed || !unlocked || generation !== renderGeneration) return;
      const viewState = readWalletViewState(availableLocalStorage(), viewStorageKey);
      walletContext = {cards, customs, backupMeta};
      const shell = element('section', 'wallet-shell'); shell.dataset.walletActiveTab = walletTab;
      const lifeCount = (customs ? 1 : 0) + Number(wifiSection.dataset.walletWifiCount || 0);
      const topbar = element('div', 'wallet-topbar');
      const tabs = element('div', 'wallet-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Life Wallet 영역');
      const tabButtons = [['items', '내 자료', cards.length], ['life', '생활정보', lifeCount]].map(([id, label, total]) => {
        const tabButton = element('button', 'wallet-tab'); tabButton.type = 'button'; tabButton.dataset.walletTab = id;
        tabButton.setAttribute('role', 'tab'); tabButton.setAttribute('aria-controls', `wallet-panel-${id}`); tabButton.id = `wallet-tab-${id}`;
        tabButton.append(label, element('span', 'wallet-tab-count', String(total)));
        tabButton.addEventListener('click', () => showTab(id));
        return tabButton;
      });
      tabs.append(...tabButtons);
      const actions = element('div', 'wallet-toolbar-actions');
      const lockAction = button('', () => void lockAndRender(), true); lockAction.classList.add('wallet-icon-button', 'wallet-toolbar-icon-action');
      lockAction.setAttribute('aria-label', '잠그기'); lockAction.append(walletIcon('lock'), element('span', 'wallet-action-label', '잠그기'));
      const settingsAction = button('', () => renderSettings(), true); settingsAction.classList.add('wallet-icon-button', 'wallet-toolbar-icon-action');
      settingsAction.setAttribute('aria-label', '설정'); settingsAction.dataset.walletSettingsOpen = '';
      settingsAction.append(walletIcon('settings'), element('span', 'wallet-action-label', '설정'));
      const settings = element('div', 'wallet-settings'); settings.append(settingsAction);
      actions.append(lockAction, settings);
      topbar.append(tabs, actions);
      shell.append(element('span', 'wallet-storage-count', `저장 자료 ${cards.length}개`), topbar);
      if (message) shell.append(doneNote(message));
      const items = cards.length ? createWalletItems({
        cards,
        onOpen: (card, title) => renderDetail(card, title),
        onAdd: kind => openAdd(kind),
        initialFilter: viewState.filter,
        onStateChange: state => writeWalletViewState(availableLocalStorage(), viewStorageKey, state),
      }) : (() => { const panel = element('div', 'wallet-items'); panel.dataset.walletPanel = 'items'; panel.setAttribute('role', 'tabpanel'); panel.id = 'wallet-panel-items'; panel.append(emptyItems(backupMeta)); return panel; })();
      const life = lifePanel(customs, customsUnreadable, wifiSection);
      const showTab = id => {
        walletTab = id; shell.dataset.walletActiveTab = id;
        for (const tabButton of tabButtons) {
          const selected = tabButton.dataset.walletTab === id;
          tabButton.setAttribute('aria-selected', String(selected)); tabButton.tabIndex = selected ? 0 : -1;
        }
        items.hidden = id !== 'items'; life.hidden = id !== 'life';
        items.setAttribute('aria-labelledby', 'wallet-tab-items'); life.setAttribute('aria-labelledby', 'wallet-tab-life');
      };
      tabs.addEventListener('keydown', event => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const next = walletTab === 'items' ? 'life' : 'items'; showTab(next);
        tabButtons.find(tabButton => tabButton.dataset.walletTab === next)?.focus();
      });
      shell.append(items, life, element('p', 'wallet-security-note', '화면 이동·새로고침·백그라운드 전환 후에도 잠금 해제 상태가 유지됩니다. 10분간 사용하지 않으면 다시 잠깁니다.'));
      showTab(walletTab);
      root.replaceChildren(shell);
      // A share link opened before (#wallet-share=…) continues here once the wallet is open.
      const intent = share ? takeWalletShareIntent() : null;
      if (intent) await share.handleIntent(intent, cards, walletCardTitle, walletShareLabel);
    } catch (error) {
      await lockAndRender(safeMessage(error, '자료를 불러오지 못해 다시 잠갔습니다.'));
    }
  }

  // 설정: everything that used to sit in a small menu, as one screen. Each row opens the same
  // screen as before (PIN 변경, the two backups, 공유); the table says what each backup carries.
  function renderSettings() {
    const {cards, customs, backupMeta} = walletContext;
    const page = element('section', 'wallet-settings-page'); page.dataset.walletView = 'settings';
    const row = (icon, title, note, onClick, {disabled = false, tone = '', data = null} = {}) => {
      const item = element('button', 'wallet-settings-row'); item.type = 'button';
      const iconBox = element('span'); iconBox.append(walletIcon(icon));
      const text = element('span'); text.append(element('b', '', title), element('small', '', note));
      item.append(iconBox, text);
      if (tone) item.dataset.tone = tone;
      if (data) for (const [name, value] of Object.entries(data)) item.dataset[name] = value;
      if (onClick && !disabled) item.addEventListener('click', onClick);
      item.disabled = disabled;
      if (onClick) item.append(walletIcon('chevron')); else item.dataset.static = 'true';
      return item;
    };
    const group = (title, ...rows) => { const box = element('section', 'wallet-settings-group'); box.append(element('h4', '', title), ...rows); return box; };
    const lockGroup = group('잠금',
      row('key', 'PIN 변경', '지금 PIN을 넣고 새 PIN 4자리로 바꿔요', renderChangePin, {data: {walletSettings: 'pin'}}),
      row('clock', '자동 잠금 10분', '10분 동안 쓰지 않으면 잠겨요 · 새로고침해도 10분 안에는 열린 채로', null));
    const forgot = element('div', 'wallet-settings-help');
    forgot.append(element('b', '', 'PIN을 잊었다면'), 'PIN을 되찾는 방법은 없어요. 자료를 지우지 말고 LOTBI 지원에 문의해 주세요. 미리 백업 파일을 만들어 두면 새 PIN으로 복원할 수 있어요.');
    lockGroup.append(forgot);
    const canBackup = canExportWalletBackup(cards, customs ? 1 : 0);
    const backupRows = [
      row('download', '백업 파일 만들기', canBackup ? '이 기기에 암호화 파일로 저장 · 와이파이 제외' : '저장된 자료가 있을 때 백업할 수 있습니다.', () => renderBackup(Boolean(customs)), {disabled: !canBackup, data: {walletSettings: 'backup'}}),
      row('upload', '백업 파일로 복원', '백업 파일과 백업 전용 암호가 필요해요', renderImport, {data: {walletSettings: 'import'}}),
    ];
    if (serverBackupModule) {
      backupRows.push(row('cloudUp', '서버에 백업하기', backupMeta ? `마지막 서버 백업: ${serverBackupTime(backupMeta)} · 내 자료만` : '서버에 보관한 백업이 없습니다. · 내 자료만', () => renderServerBackup(backupMeta), {disabled: !canExportWalletBackup(cards), data: {walletServerBackup: 'keep'}}));
      if (backupMeta) {
        backupRows.push(row('cloudDown', '서버 백업 불러오기', '백업 비밀번호로 이 기기에 불러와요', () => renderServerRestore(backupMeta), {data: {walletServerBackup: 'restore'}}));
        backupRows.push(row('trash', '서버 백업 삭제', '월렛 PIN을 확인한 뒤 지워요', renderServerBackupDelete, {tone: 'danger', data: {walletServerBackup: 'delete'}}));
      }
    }
    const backupGroup = group('백업', ...backupRows);
    const reassurance = element('div', 'wallet-settings-help wallet-storage-reassurance');
    reassurance.append(...(backupMeta ? [
      element('strong', '', '자료는 이 기기에 저장되고, 서버에는 암호화된 백업만 보관됩니다.'),
      element('span', '', 'LOTBI 관리자도 원본과 백업 내용을 볼 수 없습니다. 새 기기에서는 같은 계정으로 로그인한 뒤 백업 비밀번호로 불러올 수 있습니다.'),
    ] : [
      element('strong', '', '안전하게 이 기기에만 저장됩니다.'),
      element('span', '', 'LOTBI 관리자도 원본을 볼 수 없으며, 기기 변경 시에는 다시 등록하거나 암호화 백업으로 복원해야 합니다.'),
    ]));
    // Said only once Core answers that the relay is on (it stays off until the owner turns it on).
    const shareNote = share ? element('span', 'wallet-storage-share-note', '공유를 수락한 상대에게 암호화해 전달할 때만 서버를 거칩니다.') : null;
    if (shareNote) { shareNote.hidden = true; shareNote.dataset.walletShareRelay = 'pending'; reassurance.append(shareNote); }
    backupGroup.append(reassurance);
    const left = element('div'); left.append(lockGroup);
    if (share) {
      const shareRow = row('share', '받은·보낸 공유', '내 자료만 공유돼요 · 생활정보는 공유되지 않아요', () => void share.openHub(), {data: {walletShareOpen: ''}});
      const pending = element('span', 'wallet-share-count'); shareRow.insertBefore(pending, shareRow.lastChild);
      left.append(group('공유', shareRow));
      void share.pendingCount().then(count => {
        if (count && pending.isConnected) pending.textContent = `대기 ${count}`;
        if (shareNote) { const on = share.transferAvailable(); shareNote.hidden = !on; shareNote.dataset.walletShareRelay = on ? 'on' : 'off'; }
      });
    }
    const matrix = element('section', 'wallet-matrix'); matrix.setAttribute('aria-label', '저장 항목별 백업·공유 포함 여부');
    const table = element('div'); table.setAttribute('role', 'table'); table.setAttribute('aria-label', '어디에 들어가나요');
    const header = element('div'); header.setAttribute('role', 'row');
    for (const label of ['', '파일 백업', '서버 백업', '공유']) { const cell = element('span', '', label); cell.setAttribute('role', 'columnheader'); header.append(cell); }
    table.append(header);
    for (const [name, cells] of [['내 자료 (사진·PDF)', [true, true, true]], ...(customsCode ? [['개인통관고유부호', [true, false, false]]] : []), ['와이파이', [false, false, false]]]) {
      const line = element('div'); line.setAttribute('role', 'row');
      const head = element('span', '', name); head.setAttribute('role', 'rowheader'); line.append(head);
      for (const included of cells) { const cell = element('span', '', included ? '포함' : '제외'); cell.setAttribute('role', 'cell'); cell.dataset.in = String(included); line.append(cell); }
      table.append(line);
    }
    matrix.append(element('h4', '', '어디에 들어가나요?'), table);
    const right = element('div'); right.append(backupGroup, matrix);
    const columns = element('div', 'wallet-settings-columns'); columns.append(left, right);
    page.append(pageHead('설정', () => void renderWallet(), 'Life Wallet'), columns);
    root.replaceChildren(page); activity();
  }

  function renderAddLimit() {
    const plans = element('a', 'consumer-action', '구독 안내 보기'); plans.href = '/subscribe';
    const back = button('목록으로', () => void renderWallet(), true);
    back.dataset.subviewBack = '';   // SUBVIEW-BACK-NAVIGATION-01: the phone's back presses this (site-conversation.js).
    const actions = element('div', 'wallet-form-actions'); actions.append(back, plans);
    const view = element('section', 'wallet-editor wallet-add-limit');
    view.append(element('h3', '', '무료 회원은 자료를 1개까지 보관할 수 있습니다'),
      element('p', 'wallet-share-help', '이미 저장한 자료는 그대로 남아 있습니다. 자료를 더 보관하려면 Basic·Plus·Pro 구독을 이용해 주세요.'), actions);
    root.replaceChildren(view); back.focus(); activity();
  }

  // 종류: four cards, none chosen until the owner picks one (or came from a kind's own button).
  // The picture's shape only marks a suggestion: a page or a PDF is pre-chosen as 증명서·문서, a
  // card is suggested as 신분증 or 명함 (the shape cannot tell those apart). This is the owner's
  // sealed choice; nothing is read from the picture.
  function kindChoice(name, selected = '') {
    const box = element('fieldset', 'wallet-kind-choice');
    const legend = element('legend', '', '자료 종류'); legend.append(element('small', '', '필수'));
    const suggest = element('p', 'wallet-kind-suggest');
    const grid = element('div', 'wallet-kind-options');
    const choices = WALLET_ITEM_CATEGORIES.map(([value, label]) => {
      const option = element('label', 'wallet-kind-option'); option.dataset.walletKindOption = value;
      const input = element('input'); input.type = 'radio'; input.name = name; input.value = value; input.checked = value === selected;
      input.dataset.walletCategoryChoice = value;
      const text = element('span'); text.append(element('b', '', label), element('small', '', WALLET_KIND_EXAMPLES[value][1]));
      const rec = element('span', 'wallet-kind-rec', '추천'); rec.hidden = true;
      option.append(input, text, rec); grid.append(option);
      return {value, input, rec};
    });
    box.append(legend, suggest, grid);
    return {
      element: box, suggest,
      value: () => choices.find(choice => choice.input.checked)?.value || '',
      choose: value => { for (const choice of choices) choice.input.checked = choice.value === value; },
      recommend: values => { for (const choice of choices) choice.rec.hidden = !values.includes(choice.value); },
      onChange: listener => { for (const choice of choices) choice.input.addEventListener('change', listener); },
    };
  }

  function stepsBar(current) {
    const bar = element('ol', 'wallet-steps-bar'); bar.setAttribute('aria-label', '자료 추가 단계');
    const steps = [['1', '파일 고르기'], ['2', '확인하고 저장']].map(([number, label], index) => {
      const step = element('li'); const mark = element('b', '', number);
      if (index + 1 === current) step.setAttribute('aria-current', 'step');
      if (index + 1 < current) { step.dataset.done = 'true'; mark.textContent = ''; mark.append(walletIcon('check')); }
      step.append(mark, label); return step;
    });
    bar.append(steps[0], element('i'), steps[1]);
    return bar;
  }

  function nextTitleHint(kind) {
    if (!kind) return '선택 · 비우면 종류와 번호가 붙어요';
    const label = WALLET_ITEM_CATEGORIES.find(([value]) => value === kind)?.[1] || '자료';
    const next = walletContext.cards.filter(card => walletItemCategory(card) === kind).length + 1;
    return `선택 · 비우면 ‘${label} ${next}’처럼 붙어요`;
  }

  // 자료 추가 (LIFE-WALLET-REDESIGN-02): 카메라 또는 내 파일 → the same preview frame for a photo
  // or a PDF (회전 · 자르기 조정) → 종류 → 제목·메모 → one 암호화하여 저장. A reason under/next to the
  // button says what is still missing.
  function renderAdd(preset = '') {
    const form = element('form', 'wallet-editor wallet-add'); const status = errorRegion();
    form.dataset.walletView = 'add'; form.dataset.step = 'start'; form.noValidate = true;
    pickerOpen = false;
    let scan = {state: 'empty', ready: false};
    const kinds = kindChoice('wallet-category', WALLET_ITEM_CATEGORY_IDS.includes(preset) ? preset : '');
    let kindTouched = Boolean(preset);
    const reason = element('p', 'wallet-reason'); reason.setAttribute('role', 'status'); reason.setAttribute('aria-live', 'polite');
    const pdfNote = element('p', 'wallet-pdf-note'); pdfNote.hidden = true;
    const titleInput = element('input'); titleInput.type = 'text'; titleInput.maxLength = 80; titleInput.autocomplete = 'off'; titleInput.dataset.walletItemTitle = '';
    const titleHint = element('small', 'wallet-field-hint');
    const titleField = element('label', 'wallet-field'); titleField.append(element('span', '', '제목'), titleInput, titleHint);
    const note = element('textarea'); note.maxLength = 1000; note.rows = 2;
    const noteLabel = element('span', '', '메모 '); noteLabel.append(element('small', '', '선택'));
    const noteField = element('label', 'wallet-field'); noteField.append(noteLabel, note);
    const cancel = button('취소', () => { photoPicker.destroy(); void renderWallet(); }, true);
    const save = button(''); save.type = 'submit'; save.classList.add('wallet-add-save'); save.append(walletIcon('lock'), '암호화하여 저장');
    const refresh = () => {
      const kind = kinds.value();
      titleHint.textContent = nextTitleHint(kind);
      titleInput.placeholder = kind === 'business-card' ? '예: 디자인 회사 명함' : kind === 'document' ? '예: 재직증명서' : kind === 'identity' ? '예: 운전면허증' : '예: 도서관 회원증';
      const missing = !scan.ready
        ? (scan.state === 'analysing' || scan.state === 'scanning' ? '사진을 확인하고 있어요' : scan.state === 'empty' ? '자료 사진을 골라 주세요' : '저장할 수 있는 사진을 골라 주세요')
        : !kind ? '자료 종류를 골라 주세요' : '';
      reason.replaceChildren(); if (missing) reason.append(walletIcon('info'), missing);
      save.disabled = Boolean(missing);
    };
    kinds.onChange(() => { kindTouched = true; refresh(); });
    const photoPicker = createWalletPhotoPicker({
      layout: 'start',
      onError: message => { status.textContent = message; },
      onReady: () => refresh(),
      onState: next => {
        scan = next; form.dataset.step = 'review';
        if (next.state === 'review' || next.state === 'error') {
          const page = next.shape === 'document' || next.pdf;
          const card = next.shape === 'card';
          kinds.recommend(page ? ['document'] : card ? ['identity', 'business-card'] : []);
          if (page && !kindTouched) kinds.choose('document');
          kinds.suggest.textContent = page ? '문서 모양이라 ‘증명서·문서’를 골라 두었어요. 맞는지 확인해 주세요.'
            : card ? '카드 모양이라 신분증·명함을 추천했어요. 맞는 것을 골라 주세요.' : '';
          pdfNote.hidden = !(next.pdf && next.pdfPages > 1);
          pdfNote.replaceChildren(walletIcon('alert'), `이 PDF는 ${next.pdfPages}쪽이에요. 첫 쪽만 저장돼요.`);
        }
        refresh();
      },
      onPickerOpen: () => { pickerOpen = true; },
      onPickerClose: () => { pickerOpen = false; },
    });
    const intro = element('div', 'wallet-add-intro');
    intro.append(element('h4', '', '어떻게 넣을까요?'), element('p', '', '사진이나 PDF 한 장을 고르면, 다음 화면에서 미리 보고 종류를 정해요.'));
    const facts = element('ul', 'wallet-add-facts');
    for (const [tone, icon, title, text] of [['ok', 'check', '넣을 수 있어요', '신분증 · 명함 · 증명서 · 계약서 · 회원증'], ['no', 'close', '넣을 수 없어요', '영수증 · 글자가 없는 일반 사진'], ['info', 'info', '알아 두세요', 'PDF는 첫 쪽만 저장돼요 · 사진 30MB · PDF 20MB까지']]) {
      const fact = element('li'); fact.dataset.tone = tone;
      const text2 = element('span'); text2.append(element('b', '', title), text);
      fact.append(walletIcon(icon), text2); facts.append(fact);
    }
    const media = element('div', 'wallet-add-media'); media.append(photoPicker.element, pdfNote);
    const details = element('div', 'wallet-add-details'); details.append(kinds.element, titleField, noteField);
    const grid = element('div', 'wallet-add-grid'); grid.append(media, details);
    const actions = element('div', 'wallet-form-actions'); actions.append(cancel, save);
    const bar = element('div', 'wallet-form-bar'); bar.append(safeLine('이 기기에만 암호화해 보관 · LOTBI 서버로 보내지 않아요'), reason, actions);
    const back = backButton('내 자료', () => { photoPicker.destroy(); void renderWallet(); });
    const head = element('div', 'wallet-page-head'); head.append(back, element('h3', '', '자료 추가'), stepsBar(1));
    form.append(head, intro, grid, facts, status,
      element('p', 'wallet-security-note', '기울기·원근·여백과 화질을 이 브라우저에서만 보정합니다. 원본과 보정 사진은 LOTBI 서버나 대화창으로 전송되지 않습니다.'), bar);
    const stepObserver = new MutationObserver(() => { head.lastChild.replaceWith(stepsBar(form.dataset.step === 'review' ? 2 : 1)); });
    stepObserver.observe(form, {attributes: true, attributeFilter: ['data-step']});
    form.addEventListener('submit', async event => {
      event.preventDefault(); status.textContent = '';
      try {
        const category = kinds.value();
        if (!category) throw new Error('자료 종류를 골라 주세요.');
        setBusy(form, true);
        if (resuming) await resuming;
        const frontDataUrl = await photoPicker.readDataUrl();
        await vault.save(accountId, {id: randomId(), kind: 'document', category, name: titleInput.value.trim(), note: note.value, frontDataUrl, updatedAt: new Date().toISOString()});
        photoPicker.destroy(); stepObserver.disconnect();
        await renderWallet('자료를 암호화하여 저장했습니다.', {tab: 'items'});
      } catch (error) { status.textContent = safeMessage(error, '자료를 저장하지 못했습니다.'); setBusy(form, false); refresh(); }
    });
    refresh();
    root.replaceChildren(form); activity();
  }

  // A changed item replaces its old copy, so its title and number on the page follow the change.
  function remember(saved) {
    walletContext = {...walletContext, cards: walletContext.cards.map(card => (card.id === saved.id ? saved : card))};
    return saved;
  }

  // A dialog over the page (a sheet from the bottom on a phone). Its 취소 carries the phone's back.
  function openDialog(label, build) {
    const backdrop = element('div', 'wallet-dialog-backdrop');
    const dialog = element('form', 'wallet-dialog'); dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-label', label);
    dialog.noValidate = true;
    const close = () => { backdrop.remove(); document.removeEventListener('keydown', onKey, true); };
    // A lock clears the page (and the dialog with it); the key listener then leaves on its own.
    const onKey = event => {
      if (!backdrop.isConnected) { document.removeEventListener('keydown', onKey, true); return; }
      if (event.key === 'Escape') { event.preventDefault(); close(); }
    };
    document.addEventListener('keydown', onKey, true);
    backdrop.addEventListener('pointerdown', event => { if (event.target === backdrop) close(); });
    backdrop.append(dialog); build(dialog, close);
    root.append(backdrop); activity();
    return close;
  }

  function dialogCancel(close) {
    const cancel = button('취소', close, true);
    cancel.dataset.subviewBack = '';   // SUBVIEW-BACK-NAVIGATION-01: back closes the dialog first.
    return cancel;
  }

  // 종류 바꾸기: the picture stays as it is; only the sealed category changes (the save time too).
  function openKindDialog(card, onSaved) {
    openDialog('종류 바꾸기', (dialog, close) => {
      const current = walletItemCategory(card);
      const kinds = kindChoice('wallet-category-fix', current);
      kinds.element.classList.add('wallet-kind-list');
      const now = kinds.element.querySelector(`[data-wallet-kind-option="${current}"]`);
      now?.append(element('span', 'wallet-kind-now', '지금 종류'));
      const status = errorRegion();
      const save = button('암호화하여 저장'); save.type = 'submit';
      const actions = element('div', 'wallet-form-actions'); actions.append(dialogCancel(close), save);
      dialog.append(element('h3', '', '종류 바꾸기'), element('p', '', '사진은 그대로 두고 종류만 바꿔요. 다시 올리지 않아도 돼요.'), kinds.element, status, actions);
      dialog.addEventListener('submit', async event => {
        event.preventDefault(); status.textContent = '';
        const category = kinds.value();
        if (!category || category === walletItemCategory(card)) { close(); return; }
        try {
          setBusy(dialog, true);
          const saved = remember(await vault.save(accountId, {...card, category}));
          close();
          onSaved(saved, `${withDirectionParticle(WALLET_ITEM_CATEGORIES.find(([value]) => value === category)?.[1] || '기타')} 바꿨어요.`);
        } catch (error) { status.textContent = safeMessage(error, '종류를 바꾸지 못했습니다.'); setBusy(dialog, false); }
      });
    });
  }

  // Deleting asks for the wallet PIN in the dialog itself: it cannot be undone, and embedded
  // browsers and app WebViews silently cancel window.confirm.
  function openDeleteDialog(card) {
    openDialog('자료 삭제', (dialog, close) => {
      dialog.classList.add('wallet-delete-confirm');
      const removalPin = pinInput('월렛 PIN'); const removalStatus = errorRegion();
      const removalSubmit = button('삭제'); removalSubmit.type = 'submit'; removalSubmit.classList.add('wallet-danger-confirm');
      const actions = element('div', 'wallet-form-actions'); actions.append(dialogCancel(close), removalSubmit);
      dialog.append(element('h3', '', '이 자료를 지울까요?'), element('p', '', '이 자료를 삭제하려면 월렛 PIN을 입력해 주세요. 별도로 내보낸 백업은 삭제되지 않습니다.'), field('월렛 PIN', removalPin), actions, removalStatus);
      dialog.addEventListener('submit', async event => {
        event.preventDefault(); removalStatus.textContent = '';
        try {
          validateWalletPin(removalPin.value); setBusy(dialog, true);
          await vault.verifyPin(accountId, removalPin.value);
          await vault.remove(accountId, card.id); close(); await renderWallet('자료를 삭제했습니다.');
        } catch (error) { removalStatus.textContent = safeMessage(error, '자료를 삭제하지 못했습니다.'); setBusy(dialog, false); removalPin.value = ''; focusUnlessTouch(removalPin); }
      });
      focusUnlessTouch(removalPin);
    });
  }

  function renderDetail(card, title = '', message = '') {
    title ||= walletItemTitles(walletContext.cards).get(card.id) || walletCardTitle(card);
    const detail = element('section', 'wallet-detail'); detail.dataset.walletView = 'detail';
    const toList = button('', () => void renderWallet(), true); toList.classList.add('wallet-back', 'wallet-text-action');
    toList.append(walletIcon('back'), '목록으로');
    toList.dataset.subviewBack = '';   // SUBVIEW-BACK-NAVIGATION-01: the phone's back presses this (site-conversation.js).
    const header = element('div', 'wallet-detail-header');
    header.append(toList, element('h3', '', title), element('span', 'wallet-kind-badge', walletCategoryLabel(card)));
    detail.append(header);
    if (message) detail.append(doneNote(message));
    const images = element('div', 'wallet-detail-images'); images.dataset.masked = 'false';
    const front = element('figure'); const frontImage = element('img'); frontImage.src = card.frontDataUrl; frontImage.alt = `${title} 자료 사진 원본`; front.append(frontImage); if (card.backDataUrl) front.append(element('figcaption', '', '앞면'));
    images.append(front);
    if (card.backDataUrl) { const back = element('figure'); const backImage = element('img'); backImage.src = card.backDataUrl; backImage.alt = `${title} 뒷면 원본`; back.append(backImage, element('figcaption', '', '뒷면')); images.append(back); }
    // 크게 보기: the photo at its own size, scrolled inside the frame (small print, a number).
    const zoom = button('', () => {
      const zoomed = images.classList.toggle('wallet-detail-zoomed');
      zoom.replaceChildren(walletIcon('expand'), zoomed ? '맞춰 보기' : '크게 보기'); zoom.setAttribute('aria-pressed', String(zoomed));
    }, true);
    zoom.append(walletIcon('expand'), '크게 보기'); zoom.setAttribute('aria-pressed', 'false');
    const veil = button('', () => {
      const masked = images.dataset.masked !== 'true';
      images.dataset.masked = String(masked);
      veil.replaceChildren(walletIcon(masked ? 'eye' : 'eyeOff'), masked ? '보기' : '가리기'); veil.setAttribute('aria-pressed', String(masked));
    }, true);
    veil.append(walletIcon('eyeOff'), '가리기'); veil.setAttribute('aria-pressed', 'false');
    const tools = element('div', 'wallet-detail-tools'); tools.append(zoom, veil, element('small', '', '화면을 떠나면 다시 가려져요'));
    const media = element('section', 'wallet-detail-media'); media.append(images, tools);
    const facts = element('dl', 'wallet-detail-facts');
    const kindValue = element('dd'); kindValue.append(walletCategoryLabel(card));
    const change = button('바꾸기', () => openKindDialog(card, (saved, done) => renderDetail(saved, '', done)), true);
    change.classList.add('wallet-text-action'); change.dataset.walletKindChange = '';
    kindValue.append(change);
    facts.append(element('dt', '', '종류'), kindValue, element('dt', '', '메모'), element('dd', 'wallet-card-note', card.note || '없음'),
      element('dt', '', '등록일'), element('dd', '', savedDateLabel(card).replace(' 등록', '')));
    const actions = element('div', 'wallet-detail-actions');
    const edit = button('', () => renderEditItem(card, title), true); edit.append(walletIcon('edit'), '정보 수정'); edit.dataset.walletItemEdit = '';
    actions.append(edit);
    if (share) {
      const shareAction = button('', () => share.openShareItem(card, walletCardTitle(card), walletShareLabel(card)), true); shareAction.dataset.walletShareItem = '';
      shareAction.append(walletIcon('share'), '공유하기');
      actions.append(shareAction);
    }
    const remove = button('', () => openDeleteDialog(card), true);
    remove.classList.add('wallet-danger-action'); remove.append(walletIcon('trash'), '자료 삭제');
    const danger = element('div', 'wallet-detail-danger'); danger.append(remove);
    const info = element('section', 'wallet-detail-info'); info.append(element('h4', '', '정보'), facts, actions, danger);
    const layout = element('div', 'wallet-detail-layout'); layout.append(media, info);
    detail.append(layout);
    root.replaceChildren(detail); activity();
  }

  // A picture turned a quarter to the right, in this browser (JPEG like every saved picture).
  async function rotateDataUrl(dataUrl) {
    const image = new Image(); image.src = dataUrl; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.naturalHeight; canvas.height = image.naturalWidth;
    const context = canvas.getContext('2d'); context.translate(canvas.width, 0); context.rotate(Math.PI / 2); context.drawImage(image, 0, 0);
    const turned = canvas.toDataURL('image/jpeg', 0.92); canvas.width = 0; canvas.height = 0;
    return turned;
  }

  // 정보 수정: title, kind and memo, and the picture turned or replaced — without adding the item
  // again. The save time (shown as 등록일) stays as it was.
  function renderEditItem(card, title) {
    const form = element('form', 'wallet-editor wallet-add wallet-edit'); form.dataset.walletView = 'edit'; form.dataset.step = 'review'; form.noValidate = true;
    const status = errorRegion();
    let picture = card.frontDataUrl; let replacing = null; let replaceReady = true;
    const kinds = kindChoice('wallet-category-edit', walletItemCategory(card));
    const titleInput = element('input'); titleInput.type = 'text'; titleInput.maxLength = 80; titleInput.autocomplete = 'off'; titleInput.value = walletOwnTitle(card);
    titleInput.placeholder = title;
    const titleField = element('label', 'wallet-field'); titleField.append(element('span', '', '제목'), titleInput, element('small', 'wallet-field-hint', '비우면 종류와 번호가 붙어요'));
    const note = element('textarea'); note.maxLength = 1000; note.rows = 3; note.value = card.note || '';
    const noteField = element('label', 'wallet-field'); noteField.append(element('span', '', '메모'), note);
    const thumb = element('img'); thumb.src = picture; thumb.alt = `${title} 사진`;
    const pictureRow = element('div', 'wallet-edit-photo');
    const replaceHost = element('div', 'wallet-edit-replace');
    const save = button(''); save.type = 'submit'; save.append(walletIcon('lock'), '암호화하여 저장');
    const reason = element('p', 'wallet-reason');
    const refresh = () => { const missing = replacing && !replaceReady ? '바꿀 사진을 확인하고 있어요' : ''; reason.replaceChildren(); if (missing) reason.append(walletIcon('info'), missing); save.disabled = Boolean(missing); };
    const rotate = button('', async () => {
      try { setBusy(form, true); picture = await rotateDataUrl(picture); thumb.src = picture; }
      catch { status.textContent = '사진을 돌리지 못했습니다.'; }
      finally { setBusy(form, false); refresh(); }
    }, true);
    rotate.append(walletIcon('rotate'), '회전');
    const replace = button('', () => {
      if (replacing) return;
      replaceReady = false;
      replacing = createWalletPhotoPicker({
        layout: 'start',
        onError: message => { status.textContent = message; },
        onReady: ready => { replaceReady = ready; refresh(); },
        onPickerOpen: () => { pickerOpen = true; },
        onPickerClose: () => { pickerOpen = false; },
      });
      replaceHost.replaceChildren(replacing.element); refresh();
    }, true);
    replace.append(walletIcon('swap'), '파일 교체');
    pictureRow.append(thumb, replace, rotate);
    const photoLabel = element('span', 'wallet-field', '사진');
    const media = element('div', 'wallet-add-media'); media.append(photoLabel, pictureRow, replaceHost, element('small', 'wallet-field-hint', '다시 올리지 않아도 종류·제목을 바꿀 수 있어요'));
    const details = element('div', 'wallet-add-details'); details.append(titleField, kinds.element, noteField);
    const grid = element('div', 'wallet-add-grid'); grid.append(details, media);
    const back = () => { replacing?.destroy(); renderDetail(card, title); };
    const actions = element('div', 'wallet-form-actions'); actions.append(button('취소', back, true), save);
    const bar = element('div', 'wallet-form-bar'); bar.append(safeLine('이 기기에만 암호화해 보관 · LOTBI 서버로 보내지 않아요'), reason, actions);
    form.append(pageHead('정보 수정', back, '자료로'), grid, status, bar);
    form.addEventListener('submit', async event => {
      event.preventDefault(); status.textContent = '';
      try {
        const category = kinds.value() || walletItemCategory(card);
        setBusy(form, true);
        if (resuming) await resuming;
        const frontDataUrl = replacing ? await replacing.readDataUrl() : picture;
        const saved = remember(await vault.save(accountId, {...card, category, name: titleInput.value.trim(), note: note.value, frontDataUrl}));
        replacing?.destroy();
        renderDetail(saved, '', '정보를 암호화하여 저장했어요.');
      } catch (error) { status.textContent = safeMessage(error, '정보를 저장하지 못했습니다.'); setBusy(form, false); refresh(); }
    });
    refresh();
    root.replaceChildren(form); activity();
  }

  // The number shown masked (last four digits) until 번호 보기, which shows it for 30 seconds.
  // 번호 복사 copies only on a press while this wallet is open; once it locks, the card (and its
  // number) leaves the page and a press on a stale button copies nothing. A refused copy shows
  // the number selected for a manual copy.
  function customsNumber(customs) {
    const wrap = element('div', 'wallet-customs-body');
    const number = element('p', 'wallet-customs-number');
    const actions = element('div', 'wallet-customs-actions');
    const copyStatus = element('p', 'wallet-customs-status'); copyStatus.setAttribute('role', 'status'); copyStatus.setAttribute('aria-live', 'polite');
    const manual = element('input', 'wallet-customs-manual'); manual.hidden = true; manual.readOnly = true;
    manual.type = 'text'; manual.inputMode = 'none'; manual.autocomplete = 'off'; manual.spellcheck = false; manual.setAttribute('aria-label', '직접 복사할 개인통관고유부호');
    let revealTimer;
    const show = revealed => {
      clearTimeout(revealTimer);
      number.textContent = revealed ? groupCustomsCode(customs.code) : maskCustomsCode(customs.code);
      number.dataset.masked = String(!revealed);
      number.setAttribute('aria-label', revealed ? `개인통관고유부호 ${customs.code.slice(1).split('').join(' ')}` : `개인통관고유부호, 끝 네 자리 ${customs.code.slice(-4).split('').join(' ')}`);
      reveal.textContent = revealed ? '번호 가리기' : '번호 보기'; reveal.setAttribute('aria-pressed', String(revealed));
      if (revealed) revealTimer = setTimeout(() => { if (number.isConnected) show(false); }, CUSTOMS_REVEAL_MS);
      else { manual.hidden = true; manual.value = ''; }
    };
    const open = () => unlocked && !disposed && wrap.isConnected && root.contains(wrap);
    const copy = button('번호 복사', () => {
      if (!open()) return;
      copyStatus.textContent = ''; manual.hidden = true; manual.value = '';
      void copyTextToClipboard(customs.code).then(outcome => {
        if (!wrap.isConnected) return;
        activity();
        if (outcome === 'copied') {
          copyStatus.dataset.outcome = 'copied';
          copyStatus.textContent = '복사했습니다. 쇼핑몰 입력란에 붙여넣어 주세요. 복사한 번호는 다른 앱에서도 붙여넣을 수 있게 클립보드에 남고 LOTBI가 지우지 않으니, 붙여넣은 뒤 다른 글을 복사해 두면 좋습니다.';
          return;
        }
        copyStatus.dataset.outcome = 'manual';
        copyStatus.textContent = '이 브라우저가 자동 복사를 허용하지 않았습니다. 아래 번호를 길게 누르거나 선택해 직접 복사해 주세요.';
        manual.value = customs.code; manual.hidden = false;
        manual.focus({preventScroll: true}); manual.select(); manual.setSelectionRange(0, customs.code.length);
        show(true);
      });
    });
    copy.classList.add('wallet-customs-copy'); copy.dataset.walletCustomsAction = 'copy';
    const reveal = button('번호 보기', () => { if (open()) show(number.dataset.masked === 'true'); }, true);
    reveal.dataset.walletCustomsAction = 'reveal';
    actions.append(copy, reveal);
    wrap.append(number, actions, copyStatus, manual);
    show(false);
    return wrap;
  }

  function customsCard(customs, unreadable) {
    const card = element('section', 'wallet-customs');
    card.dataset.walletCustoms = customs ? 'saved' : unreadable ? 'unreadable' : 'empty';
    const title = element('h3', 'wallet-customs-title', '개인통관고유부호'); title.id = `wallet-customs-${randomId()}`;
    card.setAttribute('aria-labelledby', title.id);
    const mark = element('span', 'wallet-life-mark'); mark.append(walletIcon('customs'));
    const name = element('div', 'wallet-customs-name'); name.append(title, element('small', '', '해외직구 결제 때 붙여넣기'));
    const head = element('div', 'wallet-customs-head'); head.append(mark, name);
    card.append(head);
    if (unreadable) {
      card.append(element('p', 'wallet-customs-hint', '저장한 번호를 열 수 없습니다. 삭제한 뒤 관세청에서 확인한 번호로 다시 등록해 주세요.'), customsRemoval(null));
      return card;
    }
    if (!customs) {
      card.append(element('p', 'wallet-customs-hint', '해외직구 결제 때 바로 복사할 수 있게, 관세청에서 확인한 내 번호를 직접 등록해 두세요.'));
      const actions = element('div', 'wallet-customs-actions');
      const add = button('등록하기', () => renderCustomsEditor(null)); add.dataset.walletCustomsAction = 'add';
      actions.append(add, customsPortalLink('관세청에서 내 번호 확인'));
      card.append(actions);
      return card;
    }
    const manage = button('관리', () => renderCustomsDetail(customs), true); manage.dataset.walletCustomsAction = 'manage';
    manage.classList.add('wallet-text-action');
    head.append(manage);
    card.append(customsNumber(customs));
    const notice = customsRenewalNotice(customs.expiresOn);
    if (notice && notice.state !== 'later') {
      const renewal = element('p', 'wallet-customs-renewal', notice.text); renewal.dataset.renewal = notice.state;
      renewal.prepend(walletIcon('clock'));
      renewal.append(' ', customsPortalLink('관세청에서 갱신'));
      card.append(renewal);
    } else if (notice) {
      const expiry = element('p', 'wallet-customs-expiry'); expiry.append(walletIcon('clock'), notice.text); card.append(expiry);
    }
    card.append(element('p', 'wallet-customs-hint', '형식(P와 숫자 12자리)만 확인한 번호예요. 관세청에 등록된 번호인지는 LOTBI가 확인하지 않아요.'),
      customsPortalLink('관세청 공식 조회·갱신'));
    return card;
  }

  function renderCustomsDetail(customs) {
    const detail = element('section', 'wallet-detail wallet-customs-detail'); detail.dataset.walletView = 'customs';
    const toList = backButton('목록으로', () => void renderWallet('', {tab: 'life'}));
    const header = element('div', 'wallet-detail-header'); header.append(toList, element('h3', '', '개인통관고유부호'));
    const numberCard = element('section', 'wallet-customs-panel'); numberCard.append(customsNumber(customs));
    const facts = element('dl', 'wallet-customs-facts');
    const notice = customsRenewalNotice(customs.expiresOn);
    for (const [term, value] of [['등록', customsDateLabel(customs.createdAt)], ['마지막 변경', customsDateLabel(customs.updatedAt)], ['입력한 만료일', notice ? notice.text : '입력하지 않음']]) {
      facts.append(element('dt', '', term), element('dd', '', value));
    }
    numberCard.append(facts,
      element('p', 'wallet-customs-caution', '번호 형식(P와 숫자 12자리)만 확인했습니다. 관세청에 등록된 번호인지, 지금 쓸 수 있는지, 본인 번호인지는 LOTBI가 확인할 수 없으니 관세청에서 확인해 주세요.'));
    const actions = element('div', 'wallet-form-actions wallet-customs-manage');
    const edit = button('', () => renderCustomsEditor(customs), true); edit.dataset.walletCustomsAction = 'edit';
    edit.append(walletIcon('edit'), '번호·만료일 변경');
    actions.append(edit);
    numberCard.append(actions, customsRemoval(customs));
    const layout = element('div', 'wallet-customs-detail-layout'); layout.append(numberCard, customsOfficialList());
    detail.append(header, layout);
    root.replaceChildren(detail); activity();
  }

  // Deleting asks for the wallet PIN on the page (embedded browsers silently cancel confirm()).
  function customsRemoval(customs) {
    const wrap = element('div', 'wallet-customs-removal');
    const removal = element('form', 'wallet-delete-confirm'); removal.hidden = true;
    const removalPin = pinInput('월렛 PIN'); const removalStatus = errorRegion();
    const remove = button('', () => { remove.hidden = true; removal.hidden = false; removalPin.value = ''; removalStatus.textContent = ''; focusUnlessTouch(removalPin); }, true);
    remove.append(walletIcon('trash'), '번호 삭제');
    remove.classList.add('wallet-danger-action'); remove.dataset.walletCustomsAction = 'delete';
    const removalActions = element('div', 'wallet-form-actions');
    removalActions.append(button('취소', () => { removal.hidden = true; remove.hidden = false; remove.focus(); }, true));
    const removalSubmit = button('삭제'); removalSubmit.type = 'submit'; removalSubmit.classList.add('wallet-danger-confirm'); removalActions.append(removalSubmit);
    removal.append(element('p', '', `${customs ? '저장한 개인통관고유부호' : '열 수 없는 개인통관고유부호'}를 삭제하려면 월렛 PIN을 입력해 주세요. 이미 만든 백업 파일 속 번호는 삭제되지 않습니다.`), field('월렛 PIN', removalPin), removalActions, removalStatus);
    removal.addEventListener('submit', async event => {
      event.preventDefault(); removalStatus.textContent = '';
      try {
        validateWalletPin(removalPin.value); setBusy(removal, true);
        await vault.removeCustomsCode(accountId, removalPin.value);
        await renderWallet('개인통관고유부호를 삭제했습니다.', {tab: 'life'});
      } catch (error) { removalStatus.textContent = safeMessage(error, '번호를 삭제하지 못했습니다.'); setBusy(removal, false); removalPin.value = ''; focusUnlessTouch(removalPin); }
    });
    wrap.append(remove, removal);
    return wrap;
  }

  // One numbered part of the 통관부호 form: ① 번호 ② 만료일 ③ 동의 (or the PIN when changing).
  function customsPart(number, title, hint, ...body) {
    const part = element('section', 'wallet-customs-part');
    const head = element('div', 'wallet-customs-part-head');
    const label = element('div'); label.append(element('strong', '', title)); if (hint) label.append(element('small', '', hint));
    head.append(element('b', '', String(number)), label);
    part.append(head, ...body);
    return part;
  }

  // Typed in by the owner from the portal. The field is a plain text field kept away from
  // autofill, spell check and password managers; the P is shown beside it and may be typed
  // or pasted too. Nothing here is sent anywhere.
  function renderCustomsEditor(existing) {
    const form = element('form', 'wallet-editor wallet-customs-editor'); form.dataset.walletView = 'customs-edit'; form.noValidate = true;
    const status = errorRegion();
    const codeInput = element('input', 'wallet-customs-input');
    codeInput.type = 'text'; codeInput.inputMode = 'numeric'; codeInput.autocomplete = 'off'; codeInput.maxLength = 32;
    codeInput.spellcheck = false; codeInput.setAttribute('autocorrect', 'off'); codeInput.setAttribute('autocapitalize', 'off');
    for (const hint of ['data-lpignore', 'data-1p-ignore', 'data-bwignore']) codeInput.setAttribute(hint, 'true');
    codeInput.dataset.formType = 'other';
    codeInput.setAttribute('aria-label', '개인통관고유부호 P 뒤 숫자 12자리');
    codeInput.placeholder = '숫자 12자리';
    if (existing) codeInput.value = existing.code.slice(1);
    const count = element('span', 'wallet-customs-count'); count.setAttribute('aria-hidden', 'true');
    const formatStatus = element('small', 'wallet-customs-format'); formatStatus.id = `wallet-customs-format-${randomId()}`; formatStatus.setAttribute('aria-live', 'polite');
    codeInput.setAttribute('aria-describedby', formatStatus.id);
    const consent = element('input'); consent.type = 'checkbox';
    const pin = pinInput('월렛 PIN');
    const reason = element('p', 'wallet-reason'); reason.setAttribute('role', 'status'); reason.setAttribute('aria-live', 'polite');
    const save = button(''); save.type = 'submit'; save.append(walletIcon('lock'), '암호화하여 저장');
    const previewNumber = element('p', 'wallet-customs-preview-number', 'P •••• •••• ••••');
    let codeOk = false;
    const paintFormat = () => {
      const typed = codeInput.value.trim();
      const digits = typed.normalize('NFKC').replace(/\D/gu, '').length;
      count.textContent = `${Math.min(digits, 99)} / 12`;
      codeOk = false;
      if (!typed) { formatStatus.textContent = 'P 뒤 숫자 12자리를 입력하세요.'; formatStatus.dataset.format = 'empty'; }
      else {
        try {
          const code = normalizeCustomsCode(typed); codeOk = true;
          formatStatus.textContent = '형식이 맞습니다(P와 숫자 12자리). 관세청에서 확인된 번호라는 뜻은 아닙니다.'; formatStatus.dataset.format = 'ok';
          previewNumber.textContent = maskCustomsCode(code);
        } catch {
          formatStatus.textContent = `형식이 맞지 않습니다. P 뒤 숫자 12자리여야 합니다(지금 숫자 ${digits}자리).`; formatStatus.dataset.format = 'invalid';
        }
      }
      if (!codeOk) previewNumber.textContent = 'P •••• •••• ••••';
      count.dataset.format = formatStatus.dataset.format; codeRow.dataset.format = formatStatus.dataset.format;
      refresh();
    };
    // The reason beside the button says what is still missing; the checks on submit stay.
    const refresh = () => {
      const missing = [];
      if (!codeOk) missing.push('번호 12자리');
      if (!existing && !consent.checked) missing.push('보관 동의');
      if (existing && !/^\d{4}$/u.test(pin.value)) missing.push('월렛 PIN 4자리');
      reason.replaceChildren(); if (missing.length) reason.append(walletIcon('info'), `${missing.join('와 ')}가 필요해요`);
      save.disabled = missing.length > 0;
    };
    codeInput.addEventListener('input', paintFormat);
    consent.addEventListener('change', refresh); pin.addEventListener('input', refresh);
    const codeRow = element('div', 'wallet-customs-code-row'); codeRow.append(element('span', 'wallet-customs-prefix', 'P'), codeInput, count);
    const codeField = element('label', 'wallet-field'); codeField.append(element('span', 'wallet-visually-hidden', '개인통관고유부호'), codeRow);
    const pinField = element('label', 'wallet-field wallet-customs-pin'); pinField.append(element('span', 'wallet-visually-hidden', '월렛 PIN'), pin);
    const expiry = element('input'); expiry.type = 'date'; expiry.min = '2025-01-01'; expiry.max = '2099-12-31'; expiry.value = existing?.expiresOn || '';
    expiry.setAttribute('aria-label', '유효기간 만료일 · 선택');
    const consentField = element('label', 'wallet-customs-consent');
    consentField.append(consent, element('span', '', '개인통관고유부호를 이 기기의 Life Wallet에 암호화해 보관하는 데 동의합니다.'));
    const consentMore = element('details', 'wallet-consent-more');
    consentMore.append(element('summary', '', '자세히'), element('p', '', '번호는 LOTBI 서버·대화창·쇼핑몰로 보내지 않습니다. 백업 파일을 만들면 그 파일 안에만 암호화되어 들어가고, 언제든 삭제할 수 있습니다.'));
    const relation = element('div', 'wallet-customs-relation');
    const relationText = element('div');
    const relationLine = element('p'); relationLine.append(customsPortalLink('관세청에서 내 번호 확인'), walletIcon('arrow'), element('span', '', '확인한 번호를 여기에 직접 입력'));
    relationText.append(relationLine, element('small', '', 'LOTBI는 번호를 조회하거나 대신 발급받지 않습니다.'));
    relation.append(walletIcon('info'), relationText);
    const parts = element('div', 'wallet-customs-parts');
    parts.append(
      customsPart(1, '번호 입력', 'P 뒤에 숫자 12자리 · 띄어 써도 괜찮아요', codeField, formatStatus),
      customsPart(2, '만료일', '선택 · 비워도 돼요', expiry, element('small', 'wallet-customs-hint', '넣어 두면 만료 30일 전부터 갱신을 알려 드려요. LOTBI는 만료일을 짐작하지 않습니다.')),
      existing ? customsPart(3, '월렛 PIN', '저장한 번호를 바꿀 때 필요해요', pinField) : customsPart(3, '보관 동의', '', consentField, consentMore),
    );
    const preview = element('aside', 'wallet-customs-preview');
    const previewCard = element('div', 'wallet-customs-preview-card');
    previewCard.append(element('small', '', '개인통관고유부호'), previewNumber);
    const howTo = element('ol', 'wallet-customs-howto');
    for (const step of ['쇼핑몰 결제 화면에서 통관부호 칸을 찾아요', 'Life Wallet을 열어 번호 복사를 눌러요', '칸에 붙여넣어요']) howTo.append(element('li', '', step));
    preview.append(element('h4', '', '저장하면 이렇게 써요'), previewCard, howTo, element('small', 'wallet-customs-hint', '복사한 번호는 클립보드에 남고 LOTBI가 지우지 않아요.'));
    const main = element('div', 'wallet-customs-form-main'); main.append(relation, parts);
    const grid = element('div', 'wallet-customs-form-grid'); grid.append(main, preview);
    const back = () => { if (existing) renderCustomsDetail(existing); else void renderWallet('', {tab: 'life'}); };
    const actions = element('div', 'wallet-form-actions'); actions.append(button('취소', back, true), save);
    const bar = element('div', 'wallet-form-bar'); bar.append(safeLine('이 기기에만 암호화해 보관 · LOTBI 서버로 보내지 않아요'), reason, actions);
    form.append(
      pageHead(existing ? '개인통관고유부호 변경' : '개인통관고유부호 등록', back, existing ? '번호 관리' : '생활정보'),
      grid, status,
      element('p', 'wallet-security-note', '번호는 이 기기의 Life Wallet에만 암호화해 저장합니다. 번호 형식이 맞아도 관세청에서 유효한지, 본인 번호인지는 확인되지 않습니다.'),
      bar,
    );
    paintFormat();
    form.addEventListener('submit', async event => {
      event.preventDefault(); status.textContent = '';
      try {
        const code = normalizeCustomsCode(codeInput.value);
        if (!existing && !consent.checked) throw new Error('이 기기에 암호화해 보관하는 데 동의해야 저장할 수 있습니다.');
        if (existing) validateWalletPin(pin.value);
        setBusy(form, true);
        await vault.saveCustomsCode(accountId, {code, expiresOn: expiry.value, consent: consent.checked, pin: pin.value});
        codeInput.value = ''; pin.value = '';
        await renderWallet(existing ? '개인통관고유부호를 바꿔 저장했습니다.' : '개인통관고유부호를 암호화하여 저장했습니다.', {tab: 'life'});
      } catch (error) { status.textContent = safeMessage(error, '번호를 저장하지 못했습니다.'); setBusy(form, false); pin.value = ''; refresh(); }
    });
    root.replaceChildren(form); focusUnlessTouch(codeInput); activity();
  }

  function renderChangePin() {
    const form = element('form', 'wallet-editor'); const status = errorRegion();
    const current = pinInput('현재 월렛 PIN'); const next = pinInput('새 월렛 PIN'); const confirmation = pinInput('새 월렛 PIN 확인');
    const actions = element('div', 'wallet-form-actions'); actions.append(button('취소', () => void renderWallet(), true));
    const submit = button('PIN 변경'); submit.type = 'submit'; actions.append(submit);
    form.append(pageHead('월렛 PIN 변경', () => renderSettings(), '설정'), field('현재 PIN', current), field('새 PIN', next), field('새 PIN 다시 입력', confirmation), actions, status);
    form.addEventListener('submit', async event => {
      event.preventDefault(); status.textContent = '';
      try {
        validateWalletPin(current.value); validateWalletPin(next.value);
        if (next.value !== confirmation.value) throw new Error('새 PIN 두 개가 일치하지 않습니다.');
        setBusy(form, true); await vault.changePin(accountId, current.value, next.value); await renderWallet('월렛 PIN을 변경했습니다.');
      } catch (error) { status.textContent = safeMessage(error, 'PIN을 변경하지 못했습니다.'); setBusy(form, false); current.value = ''; current.focus(); }
    });
    root.replaceChildren(form); focusUnlessTouch(current); activity();
  }

  // The file made here carries the 개인통관고유부호 too, sealed with the backup password like the rest.
  function renderBackup(withCustomsCode = false) {
    const form = element('form', 'wallet-editor'); const status = errorRegion();
    const password = element('input'); password.type = 'password'; password.minLength = 8; password.maxLength = 128; password.autocomplete = 'new-password';
    const confirmation = element('input'); confirmation.type = 'password'; confirmation.minLength = 8; confirmation.maxLength = 128; confirmation.autocomplete = 'new-password';
    const actions = element('div', 'wallet-form-actions'); actions.append(button('취소', () => void renderWallet(), true));
    const submit = button('내 기기에 백업 파일 저장'); submit.type = 'submit'; actions.append(submit);
    form.append(
      pageHead('암호화 백업 파일 만들기', () => renderSettings(), '설정'),
      element('p', 'wallet-form-intro', '기기 변경이나 브라우저 초기화에 대비해 Life Wallet 자료를 암호화된 파일로 저장합니다.'),
      field('새 백업 전용 암호 · 8자 이상', password),
      field('백업 전용 암호 확인', confirmation),
      element('p', 'wallet-backup-warning', '백업을 복원할 때 이 암호가 반드시 필요합니다. LOTBI는 백업 암호를 보관하거나 재설정해 드릴 수 없으니 반드시 기억해 주세요.'),
      element('p', 'wallet-backup-warning', '복원하려면 저장한 .lotbiwallet 백업 파일과 백업 전용 암호가 모두 필요합니다. 파일을 삭제하거나 분실하면 자료를 복원할 수 없습니다.'),
      ...(withCustomsCode ? [element('p', 'wallet-backup-warning', '저장한 개인통관고유부호도 이 백업 파일에 함께 암호화되어 들어갑니다.')] : []),
      actions, status,
    );
    form.addEventListener('submit', async event => {
      event.preventDefault(); status.textContent = '';
      try {
        const backupPassword = validateBackupPasswordPair(password.value, confirmation.value);
        setBusy(form, true); downloadBackup(await vault.exportBackup(accountId, backupPassword, {includeItems: true}));
        await renderWallet('암호화된 백업 파일을 만들었습니다. 파일과 백업 전용 암호를 함께 안전하게 보관해 주세요.');
      } catch (error) { status.textContent = safeMessage(error, '백업 파일을 만들지 못했습니다.'); setBusy(form, false); password.focus(); }
    });
    root.replaceChildren(form); focusUnlessTouch(password); activity();
  }

  // 서버에 백업하기: sealed here with the backup password (never the PIN), only the envelope leaves.
  function renderServerBackup(meta) {
    const form = element('form', 'wallet-editor wallet-server-backup'); const status = errorRegion();
    const password = element('input'); password.type = 'password'; password.minLength = 10; password.maxLength = 128; password.autocomplete = 'new-password';
    const confirmation = element('input'); confirmation.type = 'password'; confirmation.minLength = 10; confirmation.maxLength = 128; confirmation.autocomplete = 'new-password';
    const strength = element('p', 'wallet-password-strength', '비밀번호 강도: -'); strength.setAttribute('aria-live', 'polite');
    const understood = element('input'); understood.type = 'checkbox';
    const check = element('label', 'wallet-confirm-check'); check.append(understood, element('span', '', '백업 비밀번호를 잊으면 LOTBI도 백업을 열거나 복구할 수 없다는 것을 확인했습니다.'));
    const actions = element('div', 'wallet-form-actions'); actions.append(button('취소', () => void renderWallet(), true));
    const submit = button('서버에 백업하기'); submit.type = 'submit'; actions.append(submit);
    form.append(
      pageHead('서버에 백업하기', () => renderSettings(), '설정'),
      element('p', 'wallet-form-intro', '월렛 자료 전체를 이 브라우저에서 암호화한 뒤, 암호화된 내용만 LOTBI 서버에 보관합니다. 새 기기에서 같은 계정으로 로그인하고 백업 비밀번호를 입력하면 불러올 수 있습니다. LOTBI는 백업 비밀번호와 자료 내용을 볼 수 없습니다.'),
      ...(meta ? [element('p', 'wallet-backup-warning', `${serverBackupTime(meta)}에 만든 서버 백업이 있습니다. 새로 백업하면 이전 백업을 대신합니다.`)] : []),
      field('백업 비밀번호 · 10자 이상, 문자·숫자·기호 중 2가지 이상', password), strength,
      field('백업 비밀번호 확인', confirmation),
      element('p', 'wallet-backup-warning', '월렛 4자리 PIN과 다른 비밀번호를 정해 주세요. 백업 비밀번호를 잊으면 LOTBI도 백업을 열거나 복구할 수 없습니다.'),
      check, actions, status,
    );
    const labels = {weak: '약함', fair: '보통', strong: '강함'};
    password.addEventListener('input', async () => {
      const {module} = await serverBackup();
      const level = password.value ? module.backupPasswordStrength(password.value) : '';
      strength.dataset.strength = level; strength.textContent = `비밀번호 강도: ${labels[level] || '-'}`;
    });
    form.addEventListener('submit', async event => {
      event.preventDefault(); status.textContent = '';
      try {
        const {module, client} = await serverBackup();
        const backupPassword = module.validateServerBackupPassword(password.value, confirmation.value);
        if (!understood.checked) throw new Error('백업 비밀번호를 잊으면 복구할 수 없다는 안내를 확인하고 체크해 주세요.');
        setBusy(form, true); status.textContent = '이 브라우저에서 암호화하고 있습니다.';
        const sealed = await vault.exportBackup(accountId, backupPassword);
        status.textContent = '암호화된 백업을 서버에 올리고 있습니다.';
        const kept = await client.keep(sealed);
        password.value = ''; confirmation.value = '';
        await renderWallet(`서버에 백업했습니다 (${serverBackupTime(kept)}). 새 기기에서는 같은 계정과 백업 비밀번호로 불러올 수 있습니다.`);
      } catch (error) { status.textContent = safeMessage(error, '서버에 백업하지 못했습니다.'); setBusy(form, false); password.focus(); }
    });
    root.replaceChildren(form); password.focus(); activity();
  }

  // 서버 백업 불러오기: fetched once per screen, opened here; a wrong password can be retried
  // without fetching again (Core counts fetches, not attempts).
  function renderServerRestore(meta) {
    const form = element('form', 'wallet-editor wallet-server-restore'); const status = errorRegion();
    const password = element('input'); password.type = 'password'; password.minLength = 10; password.maxLength = 128; password.autocomplete = 'current-password';
    const actions = element('div', 'wallet-form-actions'); actions.append(button('나중에', () => void renderWallet(), true));
    const submit = button('불러오기'); submit.type = 'submit'; actions.append(submit);
    form.append(
      pageHead('서버 백업 불러오기', () => void renderWallet(), 'Life Wallet'),
      element('p', 'wallet-form-intro', `${serverBackupTime(meta)}에 서버에 백업한 월렛을 이 기기로 불러옵니다. 백업할 때 정한 백업 비밀번호를 입력해 주세요.`),
      field('백업 비밀번호 (월렛 4자리 PIN이 아닙니다)', password),
      element('p', 'wallet-backup-warning', '불러온 자료는 이 기기에 암호화되어 저장되고, 이 기기의 월렛 PIN으로 열립니다.'),
      actions, status,
    );
    let sealed = null;
    form.addEventListener('submit', async event => {
      event.preventDefault(); status.textContent = '';
      try {
        if (!password.value) throw new Error('백업 비밀번호를 입력해 주세요.');
        const {client} = await serverBackup();
        setBusy(form, true);
        if (!sealed) { status.textContent = '서버에서 암호화된 백업을 받고 있습니다.'; sealed = await client.fetchSealed(); }
        status.textContent = '이 브라우저에서 백업을 풀고 있습니다.';
        let count;
        try { count = await vault.importBackup(accountId, sealed, password.value); }
        catch (error) {
          if (error?.message === '백업 암호를 확인해 주세요.') throw new Error('백업 비밀번호가 맞지 않거나 백업이 손상되었습니다. 다시 확인해 주세요.');
          throw error;
        }
        password.value = '';
        await renderWallet(`서버 백업에서 ${count}개 자료를 불러왔습니다.`);
      } catch (error) { status.textContent = safeMessage(error, '서버 백업을 불러오지 못했습니다.'); setBusy(form, false); password.value = ''; password.focus(); }
    });
    root.replaceChildren(form); password.focus(); activity();
  }

  // 서버 백업 삭제: asks for the wallet PIN on the page (cannot be undone; WebViews cancel confirm()).
  function renderServerBackupDelete() {
    const form = element('form', 'wallet-editor wallet-server-backup-delete'); const status = errorRegion();
    const pin = pinInput('월렛 PIN');
    const actions = element('div', 'wallet-form-actions'); actions.append(button('취소', () => void renderWallet(), true));
    const submit = button('서버 백업 삭제'); submit.type = 'submit'; submit.classList.add('wallet-danger-confirm'); actions.append(submit);
    form.append(
      pageHead('서버 백업 삭제', () => renderSettings(), '설정'),
      element('p', 'wallet-form-intro', '서버에 보관한 암호화 백업을 지웁니다. 이 기기의 월렛 자료는 그대로 남습니다. 지운 백업은 되살릴 수 없습니다.'),
      field('월렛 PIN', pin), actions, status,
    );
    form.addEventListener('submit', async event => {
      event.preventDefault(); status.textContent = '';
      try {
        validateWalletPin(pin.value); setBusy(form, true);
        await vault.verifyPin(accountId, pin.value);
        const {client} = await serverBackup();
        await client.remove();
        await renderWallet('서버 백업을 삭제했습니다.');
      } catch (error) { status.textContent = safeMessage(error, '서버 백업을 삭제하지 못했습니다.'); setBusy(form, false); pin.value = ''; pin.focus(); }
    });
    root.replaceChildren(form); pin.focus(); activity();
  }

  function renderImport() {
    const form = element('form', 'wallet-editor'); const status = errorRegion();
    const fileInput = element('input'); fileInput.type = 'file'; fileInput.accept = '.lotbiwallet,application/octet-stream'; fileInput.required = true;
    // The backup password is not the account password: no hint that invites a saved login here.
    const password = element('input'); password.type = 'password'; password.minLength = 8; password.maxLength = 128; password.autocomplete = 'off';
    const actions = element('div', 'wallet-form-actions'); actions.append(button('취소', () => void renderWallet(), true));
    const submit = button('Life Wallet 자료 복원'); submit.type = 'submit'; actions.append(submit);
    form.append(
      pageHead('백업에서 Life Wallet 복원', () => void renderWallet(), 'Life Wallet'),
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
        const customsNote = {restored: ' 개인통관고유부호도 복원했습니다.', kept: ' 이미 저장한 개인통관고유부호는 그대로 두었습니다(백업 속 번호는 복원하지 않음).'}[vault.lastImport?.customsCode] || '';
        await renderWallet(`${count}개 자료를 복원했습니다.${customsNote}`);
      } catch (error) { status.textContent = safeMessage(error, '백업 자료를 복원하지 못했습니다.'); setBusy(form, false); fileInput.focus(); }
    });
    root.replaceChildren(form); fileInput.focus(); activity();
  }

  void restoreOrRender();
  return {
    dispose() {
      disposed = true; unlocked = false; vault.lock({preserveSession: true}); clearTimeout(timer); clearTimeout(sessionTimer); clearTimeout(backgroundTimer); renderGeneration += 1;
      share?.dispose();
      for (const name of activityEvents) root.removeEventListener(name, activity);
      window.removeEventListener('lotbi:site-session-state', sessionListener);
      document.removeEventListener('visibilitychange', visibilityListener);
      window.removeEventListener('pagehide', pagehideListener);
      window.removeEventListener('pageshow', pageshowListener);
      root.replaceChildren();
      root.classList.remove('wallet-root');
    },
  };
}
