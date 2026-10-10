// LIFE-WALLET-WIFI-CARD-01 — Wi-Fi names and passwords kept in Life Wallet instead of a photo of
// the router sticker.
//
// * Kept on this device only, sealed with the wallet's master key under its own scope and AAD
//   (LifeWalletVault.listWifi / saveWifi / removeWifi in site-life-wallet.js). Not part of the
//   card deck, the Free one-item count, a backup file, the server backup or sharing.
// * Reading the sticker happens in this browser only: a Wi-Fi QR printed on the sticker through
//   BarcodeDetector, printed text through TextDetector where the browser has one. Nothing is sent
//   to a server or an outside OCR. Without either, the owner types the name and password while
//   looking at the photo.
// * The photo itself is never kept or shown: the wallet's scanner (purpose 'label') cuts the
//   router label out of it — outline, perspective, turned upright, corners adjustable, the
//   adjustment opening at once when no label is found — and the cut is trimmed a little further
//   inside its edges (LABEL_INSET) so no desk, keyboard or router body survives. Only that label
//   image is sealed with the entry, so the letters can be checked later.
// * Using it: the password stays masked until 비밀번호 보기 (30 seconds), 비밀번호 복사 works only
//   while the wallet is open, and 와이파이 QR shows the standard WIFI: code (drawn on this device
//   by site-qr-encode.js) for a guest's phone camera. Changing or deleting asks for the PIN.
import {encodeQr, qrSvgElement} from './site-qr-encode.js?v=aset-784f815b2db8';
import {createWalletDocumentScanner} from './site-life-wallet-scan-ui.js?v=aset-784f815b2db8';

export const WIFI_REVEAL_MS = 30_000;
export const WIFI_QR_SHOW_MS = 60_000;
export const WIFI_MAX_ENTRIES = 20;
export const WIFI_SUGGESTED_LABELS = Object.freeze(['집', '회사', '부모님 댁']);
export const WIFI_SECURITY = Object.freeze([['WPA', 'WPA/WPA2/WPA3'], ['WEP', 'WEP (오래된 방식)'], ['nopass', '비밀번호 없음']]);
const PHOTO_MAX_EDGE = 1600;
const PHOTO_MAX_LENGTH = 4_000_000;
const CONTROL = /[\u0000-\u001f\u007f]/u;
const HEX = /^[0-9a-fA-F]+$/u;

const byteLength = value => new TextEncoder().encode(value).length;

// ── the entry ────────────────────────────────────────────────────────────────

export function validateWifiEntry(entry) {
  if (!entry || typeof entry !== 'object' || entry.kind !== 'wifi') throw new Error('와이파이 자료가 올바르지 않습니다.');
  if (typeof entry.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/u.test(entry.id)) throw new Error('와이파이 자료 식별정보가 올바르지 않습니다.');
  const label = String(entry.label ?? '').trim();
  if (!label || label.length > 20 || CONTROL.test(label)) throw new Error('이름은 1~20자로 입력해 주세요.');
  const ssid = String(entry.ssid ?? '');
  if (!ssid.trim() || byteLength(ssid) > 32 || CONTROL.test(ssid)) throw new Error('와이파이 이름(SSID)은 1~32바이트로 입력해 주세요.');
  const security = WIFI_SECURITY.some(([value]) => value === entry.security) ? entry.security : null;
  if (!security) throw new Error('보안 방식을 골라 주세요.');
  const password = String(entry.password ?? '');
  if (CONTROL.test(password)) throw new Error('비밀번호에 쓸 수 없는 문자가 있습니다.');
  if (security === 'nopass' && password) throw new Error('비밀번호 없음을 고르면 비밀번호를 비워 주세요.');
  if (security === 'WPA' && !((password.length >= 8 && password.length <= 63) || (password.length === 64 && HEX.test(password)))) {
    throw new Error('WPA 비밀번호는 8~63자입니다.');
  }
  if (security === 'WEP' && ![5, 13].includes(password.length) && !([10, 26].includes(password.length) && HEX.test(password))) {
    throw new Error('WEP 비밀번호는 5자·13자이거나 16진수 10자·26자입니다.');
  }
  const photo = entry.photo === undefined ? '' : entry.photo;
  if (typeof photo !== 'string' || (photo && (!photo.startsWith('data:image/jpeg;base64,') || photo.length > PHOTO_MAX_LENGTH))) throw new Error('스티커 사진을 확인해 주세요.');
  for (const key of ['createdAt', 'updatedAt']) {
    if (typeof entry[key] !== 'string' || !Number.isFinite(Date.parse(entry[key]))) throw new Error('와이파이 자료 시간이 올바르지 않습니다.');
  }
  return Object.freeze({kind: 'wifi', id: entry.id, label, ssid, security, password, hidden: entry.hidden === true, photo,
    createdAt: entry.createdAt, updatedAt: entry.updatedAt});
}

// ── the WIFI: code (ZXing "Wi-Fi network config"; \ ; , : " are escaped) ──────────────

export function escapeWifiField(value) {
  return String(value).replace(/([\\;,:"])/gu, '\\$1');
}

export function wifiQrPayload(entry) {
  const parts = [`T:${entry.security}`, `S:${escapeWifiField(entry.ssid)}`];
  if (entry.security !== 'nopass') parts.push(`P:${escapeWifiField(entry.password)}`);
  if (entry.hidden) parts.push('H:true');
  return `WIFI:${parts.join(';')};;`;
}

/** A WIFI: code read from a sticker → {ssid, password, security, hidden}, or null. */
export function parseWifiQr(text) {
  if (typeof text !== 'string' || !/^WIFI:/iu.test(text)) return null;
  const fields = {};
  let key = ''; let value = ''; let readingKey = true;
  const body = text.slice(5);
  for (let i = 0; i < body.length; i += 1) {
    const char = body[i];
    if (char === '\\' && i + 1 < body.length) { (readingKey ? (key += body[i + 1]) : (value += body[i + 1])); i += 1; continue; }
    if (readingKey) {
      if (char === ':') { readingKey = false; continue; }
      if (char === ';') { key = ''; continue; }
      key += char;
    } else if (char === ';') {
      if (key) fields[key.toUpperCase()] = value;
      key = ''; value = ''; readingKey = true;
    } else value += char;
  }
  if (!readingKey && key) fields[key.toUpperCase()] = value;
  if (!fields.S) return null;
  const type = String(fields.T || '').toUpperCase();
  const security = type === 'WEP' ? 'WEP' : type === 'NOPASS' || (!type && !fields.P) ? 'nopass' : 'WPA';
  return {ssid: fields.S, password: security === 'nopass' ? '' : fields.P || '', security, hidden: String(fields.H).toLowerCase() === 'true'};
}

// Printed sticker text (ipTIME, KT, SK, LG U+ and the like): "SSID: …", "비밀번호 …".
const SSID_LABEL = /^(?:ssid|wi-?fi\s*(?:name|이름)|network(?:\s*name)?|네트워크\s*이름|무선\s*(?:랜|네트워크)\s*이름|와이파이\s*이름)\s*[:：=]?\s*(.+)$/iu;
const PASSWORD_LABEL = /^(?:password|passcode|pw|pwd|key|wpa2?\s*key|wi-?fi\s*(?:key|password|비밀번호)|network\s*key|비밀번호|암호|무선\s*(?:암호|비밀번호)|와이파이\s*비밀번호)\s*[:：=]?\s*(.+)$/iu;

export function readStickerText(lines) {
  let ssid = ''; let password = '';
  for (const raw of lines || []) {
    const line = String(raw || '').replace(/\s+/gu, ' ').trim();
    const name = !ssid && SSID_LABEL.exec(line);
    if (name) { ssid = name[1].trim(); continue; }
    const pass = !password && PASSWORD_LABEL.exec(line);
    if (pass) password = pass[1].trim();
  }
  return {ssid, password};
}

/** Reads a sticker image on this device. Returns {source: 'qr'|'text'|'none', ssid, password, security, hidden}. */
export async function readWifiSticker(image, {BarcodeDetectorImpl = globalThis.BarcodeDetector, TextDetectorImpl = globalThis.TextDetector} = {}) {
  if (typeof BarcodeDetectorImpl === 'function') {
    try {
      const codes = await new BarcodeDetectorImpl({formats: ['qr_code']}).detect(image);
      for (const code of codes || []) {
        const parsed = parseWifiQr(code?.rawValue);
        if (parsed) return {source: 'qr', ...parsed};
      }
    } catch { /* no QR reader here */ }
  }
  if (typeof TextDetectorImpl === 'function') {
    try {
      const blocks = await new TextDetectorImpl().detect(image);
      const found = readStickerText((blocks || []).map(block => block?.rawValue));
      if (found.ssid || found.password) return {source: 'text', ssid: found.ssid, password: found.password, security: found.password ? 'WPA' : '', hidden: false};
    } catch { /* no text reader here */ }
  }
  return {source: 'none', ssid: '', password: '', security: '', hidden: false};
}

export function wifiReadersAvailable({BarcodeDetectorImpl = globalThis.BarcodeDetector, TextDetectorImpl = globalThis.TextDetector} = {}) {
  return {qr: typeof BarcodeDetectorImpl === 'function', text: typeof TextDetectorImpl === 'function'};
}

async function sniffImage(file) {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const jpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  const png = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
  const webp = String.fromCharCode(...head.slice(0, 4)) === 'RIFF' && String.fromCharCode(...head.slice(8, 12)) === 'WEBP';
  return jpeg || png || webp;
}

// A copy of the photo for reading its QR or printed text on this device (at most 1600 px on the
// long side). It is dropped after reading: the photo is never kept.
export async function stickerReadingCanvas(file, {doc = globalThis.document} = {}) {
  if (!file || !(await sniffImage(file))) throw new Error('JPG·PNG·WEBP 사진을 골라 주세요.');
  let bitmap;
  try { bitmap = await createImageBitmap(file, {imageOrientation: 'from-image'}); }
  catch { throw new Error('사진을 열지 못했습니다. 다른 사진으로 다시 시도해 주세요.'); }
  const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = doc.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas;
}

// The label as kept: the scanner's squared-up cut, trimmed LABEL_INSET of each side further in
// (at least 2 px) so nothing outside the label edge — a desk, a keyboard, the router body — is
// left even when the outline sat a little outside it. Re-encoded as a JPEG without metadata.
export const LABEL_INSET = 0.035;
export async function insetLabelImage(dataUrl, {inset = LABEL_INSET, doc = globalThis.document} = {}) {
  const image = doc.createElement('img');
  await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('잘라낸 스티커를 열지 못했습니다.')); image.src = dataUrl; });
  const width = image.naturalWidth; const height = image.naturalHeight;
  const dx = Math.max(2, Math.round(width * inset)); const dy = Math.max(2, Math.round(height * inset));
  const innerWidth = width - dx * 2; const innerHeight = height - dy * 2;
  if (innerWidth < 24 || innerHeight < 24) throw new Error('잘라낸 스티커가 너무 작습니다. 스티커를 가까이 찍어 주세요.');
  const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(innerWidth, innerHeight));
  const canvas = doc.createElement('canvas');
  canvas.width = Math.round(innerWidth * scale); canvas.height = Math.round(innerHeight * scale);
  canvas.getContext('2d').drawImage(image, dx, dy, innerWidth, innerHeight, 0, 0, canvas.width, canvas.height);
  const out = canvas.toDataURL('image/jpeg', 0.88);
  if (out.length > PHOTO_MAX_LENGTH) throw new Error('잘라낸 스티커가 너무 큽니다.');
  return out;
}

// Copies on the owner's press. The outcome is what the browser reported; 'manual' shows the
// text selected so it can be copied by hand.
export async function copyWifiText(text, {clipboard = globalThis.navigator?.clipboard, doc = globalThis.document} = {}) {
  if (typeof clipboard?.writeText === 'function') {
    try { await clipboard.writeText(text); return 'copied'; } catch { /* the copy command may still work */ }
  }
  try {
    const area = doc.createElement('textarea');
    area.value = text; area.readOnly = true; area.tabIndex = -1; area.setAttribute('aria-hidden', 'true');
    area.style.cssText = 'position:fixed;top:0;left:-9999px;width:1px;height:1px;opacity:0;font-size:16px';
    doc.body.append(area);
    let copied = false;
    try { area.select(); area.setSelectionRange(0, text.length); copied = doc.execCommand?.('copy') === true; }
    finally { area.remove(); doc.getSelection?.()?.removeAllRanges(); }
    if (copied) return 'copied';
  } catch { /* no copy command */ }
  return 'manual';
}

// ── the screens ──────────────────────────────────────────────────────────────

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

function labeled(text, input) {
  const label = element('label', 'wallet-field');
  label.append(element('span', '', text), input);
  return label;
}

function statusRegion(className = 'wallet-message') {
  const region = element('p', className); region.setAttribute('role', 'status'); region.setAttribute('aria-live', 'polite');
  return region;
}

// Typed secrets are masked text fields, not type=password: a password field makes browsers and
// password managers offer to save it as this site's login.
const TEXT_MASK_SUPPORTED = (() => {
  try { return Boolean(globalThis.CSS?.supports?.('-webkit-text-security', 'disc')); } catch { return false; }
})();
// Masked (data-masked=true) or shown; a browser that cannot mask text uses type=password.
function setSecretMasked(input, masked) {
  input.dataset.masked = String(masked);
  if (!TEXT_MASK_SUPPORTED) input.type = masked ? 'password' : 'text';
}

function secretInput(label) {
  const input = element('input', 'wallet-wifi-secret');
  input.type = TEXT_MASK_SUPPORTED ? 'text' : 'password'; input.autocomplete = 'off'; input.spellcheck = false; input.maxLength = 64;
  input.setAttribute('autocorrect', 'off'); input.setAttribute('autocapitalize', 'off'); input.setAttribute('aria-label', label);
  for (const hint of ['data-lpignore', 'data-1p-ignore', 'data-bwignore']) input.setAttribute(hint, 'true');
  input.dataset.formType = 'other'; input.dataset.masked = 'true';
  return input;
}

function plainInput(label, maxLength) {
  const input = element('input');
  input.type = 'text'; input.autocomplete = 'off'; input.spellcheck = false; input.maxLength = maxLength;
  input.setAttribute('autocapitalize', 'off'); input.setAttribute('aria-label', label);
  for (const hint of ['data-lpignore', 'data-1p-ignore', 'data-bwignore']) input.setAttribute(hint, 'true');
  return input;
}

function pinField(label) {
  const input = element('input', 'wallet-pin-input');
  input.type = 'text'; input.inputMode = 'numeric'; input.autocomplete = 'off'; input.maxLength = 4; input.pattern = '[0-9]{4}';
  input.setAttribute('aria-label', label); input.spellcheck = false;
  for (const hint of ['data-lpignore', 'data-1p-ignore', 'data-bwignore']) input.setAttribute(hint, 'true');
  input.dataset.formType = 'other';
  input.addEventListener('input', () => { input.value = input.value.replace(/\D/gu, '').slice(0, 4); });
  return input;
}

const MASK = '••••••••';
const newId = () => (globalThis.crypto?.randomUUID?.() || `wifi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

/**
 * The Wi-Fi part of an unlocked wallet. `vault` is the LifeWalletVault; `isOpen()` says whether
 * the wallet is still unlocked and on screen; `onBack()` re-renders the wallet.
 */
export function createWalletWifi({root, vault, accountId, onBack, activity = () => {}, isOpen = () => true, readers = {}} = {}) {
  let timers = [];
  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
  const clearTimers = () => { for (const id of timers) clearTimeout(id); timers = []; };
  const open = node => isOpen() && node.isConnected && root.contains(node);

  function screen(title, ...children) {
    clearTimers();
    const view = element('section', 'wallet-editor wallet-wifi-screen');
    const header = element('div', 'wallet-wifi-header');
    header.append(button('월렛으로', () => { clearTimers(); onBack(); }, true), element('h3', '', title));
    view.append(header, ...children);
    root.replaceChildren(view);
    return view;
  }

  // The password, masked until 비밀번호 보기 (30 seconds); 비밀번호 복사 copies only while open.
  function secretLine(entry) {
    const wrap = element('div', 'wallet-wifi-secret-line');
    const value = element('p', 'wallet-wifi-password');
    const status = statusRegion('wallet-wifi-status');
    const manual = element('input', 'wallet-wifi-manual'); manual.hidden = true; manual.readOnly = true; manual.type = 'text';
    manual.inputMode = 'none'; manual.autocomplete = 'off'; manual.setAttribute('aria-label', '직접 복사할 와이파이 비밀번호');
    let revealTimer = 0;
    const show = revealed => {
      clearTimeout(revealTimer);
      value.textContent = revealed ? entry.password : MASK;
      value.dataset.masked = String(!revealed);
      reveal.textContent = revealed ? '비밀번호 가리기' : '비밀번호 보기'; reveal.setAttribute('aria-pressed', String(revealed));
      if (revealed) revealTimer = later(() => { if (value.isConnected) show(false); }, WIFI_REVEAL_MS);
      else { manual.hidden = true; manual.value = ''; }
    };
    const reveal = button('비밀번호 보기', () => { if (open(wrap)) { activity(); show(value.dataset.masked === 'true'); } }, true);
    reveal.dataset.walletWifiAction = 'reveal';
    const copy = button('비밀번호 복사', () => {
      if (!open(wrap)) return;
      status.textContent = ''; manual.hidden = true; manual.value = '';
      void copyWifiText(entry.password).then(outcome => {
        if (!wrap.isConnected) return;
        activity();
        status.dataset.outcome = outcome;
        if (outcome === 'copied') { status.textContent = '복사했습니다. 클립보드에 남으니, 붙여넣은 뒤에는 다른 내용을 복사해 두는 것이 좋습니다.'; return; }
        status.textContent = '이 브라우저가 자동 복사를 허용하지 않았습니다. 아래 비밀번호를 길게 누르거나 선택해 직접 복사해 주세요.';
        manual.value = entry.password; manual.hidden = false; manual.focus({preventScroll: true}); manual.select();
        show(true);
      });
    });
    copy.dataset.walletWifiAction = 'copy';
    const actions = element('div', 'wallet-wifi-actions');
    if (entry.security !== 'nopass') { actions.append(copy, reveal); wrap.append(value, actions, status, manual); show(false); }
    else wrap.append(element('p', 'wallet-wifi-password', '비밀번호 없음'));
    return {wrap, actions};
  }

  function entryCard(entry) {
    const card = element('article', 'wallet-wifi-card');
    card.dataset.walletWifiEntry = entry.id;
    const head = element('div', 'wallet-wifi-card-head');
    head.append(element('strong', 'wallet-wifi-label', entry.label), element('span', 'wallet-wifi-ssid', entry.ssid));
    const {wrap, actions} = secretLine(entry);
    const qr = button('와이파이 QR', () => { if (open(card)) { activity(); renderQr(entry); } }, true); qr.dataset.walletWifiAction = 'qr';
    const manage = button('관리', () => { if (open(card)) { activity(); renderManage(entry); } }, true); manage.dataset.walletWifiAction = 'manage';
    actions.append(qr, manage);
    if (entry.security === 'nopass') wrap.append(actions);
    card.append(head, wrap);
    return card;
  }

  async function section() {
    const box = element('section', 'wallet-wifi');
    box.setAttribute('aria-label', '와이파이');
    const head = element('div', 'wallet-wifi-section-head');
    head.append(element('h3', '', '와이파이'));
    box.append(head);
    let entries = []; let unreadable = 0;
    try {
      const listed = await vault.listWifi(accountId);
      entries = listed.entries; unreadable = listed.unreadable.length;
    } catch {
      box.append(element('p', 'wallet-message', '저장한 와이파이를 불러오지 못했습니다.'));
      return box;
    }
    box.dataset.walletWifiCount = String(entries.length);
    if (entries.length < WIFI_MAX_ENTRIES) {
      const add = button('+ 와이파이 추가', () => { activity(); renderEditor(null); }, true); add.dataset.walletWifiAction = 'add';
      head.append(add);
    }
    if (!entries.length) box.append(element('p', 'wallet-wifi-hint', '공유기 스티커 사진 대신 와이파이 이름과 비밀번호를 보관하고, 손님에게 QR로 보여 줄 수 있습니다.'));
    for (const entry of entries) box.append(entryCard(entry));
    if (unreadable) {
      const lost = element('p', 'wallet-message', `열 수 없는 와이파이가 ${unreadable}개 있습니다. 관리에서 지운 뒤 다시 등록해 주세요.`);
      const remove = button('열 수 없는 와이파이 지우기', () => { activity(); renderRemoveUnreadable(); }, true); remove.dataset.walletWifiAction = 'remove-unreadable';
      box.append(lost, remove);
    }
    box.append(element('p', 'wallet-wifi-hint', '와이파이 비밀번호는 이 기기에만 암호화해 보관합니다. 서버 백업·백업 파일·공유에는 들어가지 않습니다.'));
    return box;
  }

  function renderQr(entry) {
    let svg;
    try { svg = qrSvgElement(encodeQr(wifiQrPayload(entry)), {label: `와이파이 ${entry.ssid} 연결 QR코드`}); }
    catch (error) { screen('와이파이 QR', element('p', 'wallet-message', error?.message || 'QR코드를 만들지 못했습니다.')); return; }
    const frame = element('div', 'wallet-wifi-qr'); frame.append(svg); frame.dataset.walletWifiQr = 'shown';
    const view = screen(`‘${entry.label}’ 와이파이 QR`, frame, element('p', 'wallet-wifi-ssid wallet-wifi-qr-ssid', entry.ssid),
      element('p', 'wallet-wifi-hint', '손님 휴대폰의 카메라로 이 QR을 비추면 비밀번호를 입력하지 않고 연결할 수 있습니다. 1분 뒤 자동으로 닫힙니다.'));
    const close = button('닫기', () => { clearTimers(); onBack(); }); close.dataset.walletWifiAction = 'close-qr';
    view.append(close);
    later(() => { if (frame.isConnected) onBack(); }, WIFI_QR_SHOW_MS);
  }

  function renderManage(entry) {
    const photoBox = element('div', 'wallet-wifi-photo');
    if (entry.photo) {
      const show = button('스티커 라벨 보기', () => {
        if (!open(photoBox)) return;
        activity();
        const image = element('img'); image.src = entry.photo; image.alt = `${entry.label} 공유기 스티커 라벨`;
        photoBox.replaceChildren(image);
      }, true);
      show.dataset.walletWifiAction = 'photo';
      photoBox.append(show);
    }
    const edit = button('수정', () => { activity(); renderEditor(entry); }); edit.dataset.walletWifiAction = 'edit';
    const remove = button('삭제', () => { activity(); renderRemove(entry); }, true); remove.dataset.walletWifiAction = 'delete';
    const actions = element('div', 'wallet-form-actions'); actions.append(edit, remove);
    const security = WIFI_SECURITY.find(([value]) => value === entry.security)?.[1] || entry.security;
    screen(`‘${entry.label}’ 와이파이`, element('p', 'wallet-wifi-ssid', `와이파이 이름: ${entry.ssid}`),
      element('p', 'wallet-wifi-hint', `보안 방식: ${security}${entry.hidden ? ' · 숨은 네트워크' : ''}`), photoBox, actions);
  }

  function renderRemove(entry) {
    const form = element('form', 'wallet-wifi-form');
    const pin = pinField('월렛 PIN 4자리');
    const status = statusRegion();
    const submit = element('button', 'consumer-action', '삭제'); submit.type = 'submit';
    const cancel = button('취소', () => renderManage(entry), true);
    const actions = element('div', 'wallet-form-actions'); actions.append(cancel, submit);
    form.append(element('p', 'wallet-wifi-hint', `‘${entry.label}’ 와이파이를 이 기기에서 지웁니다. 월렛 PIN을 입력해 주세요.`), labeled('월렛 PIN', pin), actions, status);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!open(form)) return;
      submit.disabled = true; status.textContent = '';
      try { await vault.removeWifi(accountId, entry.id, pin.value); activity(); onBack(); }
      catch (error) { status.textContent = error?.message || '삭제하지 못했습니다.'; pin.value = ''; submit.disabled = false; }
    });
    screen('와이파이 삭제', form);
  }

  function renderRemoveUnreadable() {
    const form = element('form', 'wallet-wifi-form');
    const pin = pinField('월렛 PIN 4자리');
    const status = statusRegion();
    const submit = element('button', 'consumer-action', '지우기'); submit.type = 'submit';
    const actions = element('div', 'wallet-form-actions'); actions.append(button('취소', () => onBack(), true), submit);
    form.append(element('p', 'wallet-wifi-hint', '이 기기에서 열 수 없는 와이파이 자료를 지웁니다. 월렛 PIN을 입력해 주세요.'), labeled('월렛 PIN', pin), actions, status);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!open(form)) return;
      submit.disabled = true; status.textContent = '';
      try { await vault.removeUnreadableWifi(accountId, pin.value); activity(); onBack(); }
      catch (error) { status.textContent = error?.message || '지우지 못했습니다.'; pin.value = ''; submit.disabled = false; }
    });
    screen('열 수 없는 와이파이 지우기', form);
  }

  function renderEditor(existing) {
    const form = element('form', 'wallet-wifi-form');
    form.dataset.walletWifiForm = existing ? 'edit' : 'add';
    const label = plainInput('이름', 20); label.value = existing?.label || WIFI_SUGGESTED_LABELS[0];
    const chips = element('div', 'wallet-wifi-chips');
    for (const suggestion of WIFI_SUGGESTED_LABELS) {
      const chip = button(suggestion, () => { label.value = suggestion; }, true); chip.dataset.walletWifiLabel = suggestion; chips.append(chip);
    }
    const ssid = plainInput('와이파이 이름(SSID)', 64); ssid.value = existing?.ssid || '';
    const security = element('select'); security.setAttribute('aria-label', '보안 방식');
    for (const [value, text] of WIFI_SECURITY) { const option = element('option', '', text); option.value = value; security.append(option); }
    security.value = existing?.security || 'WPA';
    const password = secretInput('와이파이 비밀번호'); password.value = existing?.password || '';
    const toggle = button('보기', () => {
      const masked = password.dataset.masked === 'true';
      setSecretMasked(password, !masked); toggle.textContent = masked ? '가리기' : '보기'; toggle.setAttribute('aria-pressed', String(masked));
      if (masked) later(() => { if (password.isConnected) { setSecretMasked(password, true); toggle.textContent = '보기'; toggle.setAttribute('aria-pressed', 'false'); } }, WIFI_REVEAL_MS);
    }, true);
    toggle.dataset.walletWifiAction = 'toggle-password';
    const passwordRow = element('div', 'wallet-wifi-password-row'); passwordRow.append(password, toggle);
    const passwordField = labeled('비밀번호', passwordRow);
    const syncSecurity = () => { passwordField.hidden = security.value === 'nopass'; if (security.value === 'nopass') password.value = ''; };
    security.addEventListener('change', syncSecurity);
    const hidden = element('input'); hidden.type = 'checkbox'; hidden.checked = existing?.hidden === true;
    const hiddenField = element('label', 'wallet-wifi-check'); hiddenField.append(hidden, element('span', '', '숨은 네트워크(이름이 목록에 안 보이는 와이파이)'));

    // The sticker photo: read on this device, then only the label cut out of it is kept.
    let photo = existing?.photo || '';
    const photoStatus = statusRegion('wallet-wifi-status');
    const cropStatus = statusRegion('wallet-wifi-status'); cropStatus.dataset.walletWifiCrop = '';
    const scannerHost = element('div', 'wallet-wifi-scanner');
    let scanner = null;
    const closeScanner = () => { scanner?.destroy(); scanner = null; scannerHost.replaceChildren(); };
    const preview = element('div', 'wallet-wifi-photo');
    const fileInput = element('input'); fileInput.type = 'file'; fileInput.accept = 'image/*'; fileInput.hidden = true;
    fileInput.dataset.walletWifiPhotoInput = '';
    const pick = button(photo ? '스티커 다시 찍기·고르기' : '공유기 스티커 사진 찍기·고르기', () => fileInput.click(), true); pick.dataset.walletWifiAction = 'photo-pick';
    const drop = button('라벨 빼기', () => { closeScanner(); photo = ''; preview.replaceChildren(); drop.hidden = true; photoStatus.textContent = ''; cropStatus.textContent = ''; }, true);
    drop.hidden = !photo; drop.dataset.walletWifiAction = 'photo-drop';
    const paint = () => { preview.replaceChildren(); if (photo) { const image = element('img'); image.src = photo; image.alt = '공유기 스티커 라벨'; preview.append(image); } };
    const available = wifiReadersAvailable(readers);
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0]; fileInput.value = '';
      if (!file) return;
      closeScanner(); cropStatus.textContent = ''; delete cropStatus.dataset.crop; delete photoStatus.dataset.read;
      photoStatus.textContent = '사진을 이 기기에서 읽는 중입니다.';
      try {
        const reading = await stickerReadingCanvas(file);
        const found = await readWifiSticker(reading, readers);
        reading.width = 0; reading.height = 0;
        if (!form.isConnected) return;
        activity();
        if (found.source === 'none') {
          photoStatus.dataset.read = 'none';
          photoStatus.textContent = available.qr || available.text
            ? '사진에서 와이파이 정보를 찾지 못했습니다. 아래 라벨을 보며 이름과 비밀번호를 직접 입력해 주세요.'
            : '이 브라우저는 사진 속 글자를 기기 안에서 읽지 못합니다. 아래 라벨을 보며 이름과 비밀번호를 직접 입력해 주세요.';
        } else {
          if (found.ssid) ssid.value = found.ssid;
          if (found.security) security.value = found.security;
          if (found.password || found.security === 'nopass') password.value = found.password;
          hidden.checked = found.hidden === true;
          syncSecurity();
          photoStatus.dataset.read = found.source;
          photoStatus.textContent = found.source === 'qr'
            ? '스티커의 와이파이 QR에서 이름과 비밀번호를 읽었습니다. 라벨과 맞는지 확인해 주세요.'
            : '사진 글자에서 읽은 내용을 넣었습니다. 틀린 글자가 없는지 라벨과 꼭 비교해 주세요.';
        }
      } catch (error) {
        photoStatus.dataset.read = 'error';
        photoStatus.textContent = error?.message || '사진을 읽지 못했습니다.';
        return;
      }
      // Cut the label out (the wallet's scanner: outline, perspective, upright, corners).
      scanner = createWalletDocumentScanner({
        file,
        purpose: 'label',
        async onConfirm(dataUrl) {
          try { photo = await insetLabelImage(dataUrl); }
          catch (error) { cropStatus.dataset.crop = 'error'; cropStatus.textContent = error?.message || '라벨을 자르지 못했습니다.'; return; }
          if (!form.isConnected) return;
          closeScanner(); paint(); drop.hidden = false; pick.textContent = '스티커 다시 찍기·고르기';
          cropStatus.dataset.crop = 'kept'; cropStatus.textContent = '스티커의 라벨 부분만 잘라 보관합니다. 찍은 사진 전체는 보관하지 않습니다.';
          activity();
        },
        onCancel() {
          closeScanner();
          cropStatus.dataset.crop = 'none'; cropStatus.textContent = '라벨 이미지는 보관하지 않습니다.';
        },
      });
      scanner.element.dataset.walletWifiScanner = '';
      scannerHost.append(scanner.element);
    });
    paint();
    const photoField = element('div', 'wallet-field wallet-wifi-photo-field');
    const photoActions = element('div', 'wallet-wifi-actions'); photoActions.append(pick, drop);
    photoField.append(element('span', '', '공유기 스티커 사진 (선택)'), photoActions, fileInput, photoStatus, scannerHost, preview, cropStatus,
      element('small', 'wallet-wifi-hint', '사진은 이 기기 안에서만 읽습니다. 보관하는 것은 스티커의 아이디·비밀번호 라벨 부분뿐이며(암호화), 찍은 사진 전체와 배경은 보관하지 않습니다. 서버나 외부 글자 인식 서비스로 보내지 않습니다.'));

    const pin = existing ? pinField('월렛 PIN 4자리') : null;
    const status = statusRegion();
    const submit = element('button', 'consumer-action', '저장'); submit.type = 'submit'; submit.dataset.walletWifiAction = 'save';
    const actions = element('div', 'wallet-form-actions');
    actions.append(button('취소', () => (existing ? renderManage(existing) : onBack()), true), submit);
    form.append(photoField, labeled('이름', label), chips, labeled('와이파이 이름(SSID)', ssid), labeled('보안 방식', security), passwordField, hiddenField,
      ...(pin ? [labeled('바꾸려면 월렛 PIN을 입력해 주세요', pin)] : []), actions, status);
    syncSecurity();
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!open(form)) return;
      submit.disabled = true; status.textContent = '';
      const now = new Date().toISOString();
      try {
        await vault.saveWifi(accountId, {
          kind: 'wifi', id: existing?.id || newId(), label: label.value, ssid: ssid.value, security: security.value,
          password: security.value === 'nopass' ? '' : password.value, hidden: hidden.checked, photo,
          createdAt: existing?.createdAt || now, updatedAt: now,
        }, {pin: pin?.value || ''});
        activity(); onBack();
      } catch (error) {
        status.textContent = error?.message || '저장하지 못했습니다.';
        if (pin) pin.value = '';
        submit.disabled = false;
      }
    });
    screen(existing ? '와이파이 수정' : '와이파이 추가', form);
  }

  return Object.freeze({section, dispose: clearTimers});
}
