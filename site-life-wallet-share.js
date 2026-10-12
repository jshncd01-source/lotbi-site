// LIFE-WALLET-SHARE-01 — sharing Life Wallet items with another LOTBI account.
//
// Three ways to name the recipient, one request (Core app/life_wallet_share.py):
//   * QR — the recipient shows their own short-lived single-use QR (내 QR); the sharer
//     scans it with the phone camera. The QR holds an opaque token only.
//   * LOTBI ID — the recipient's public handle, exact match.
//   * KakaoTalk / link — a one-time link; the first signed-in account that opens it becomes
//     the recipient. Opening the link shows nothing by itself.
// The recipient accepts, rejects or blocks in 받은 공유; the sharer revokes in 보낸 공유.
//
// A request carries only the item's label (a title the sharer can edit, and its kind). The
// original (pictures and memo) can follow only once the recipient has accepted, and only when
// Core has the relay switched on (LOTBI_LIFE_WALLET_SHARE_TRANSFER_ENABLED): the recipient's
// device registers its own key, the sharer confirms once more (identity cards and the like),
// and this browser seals the item for that key (site-life-wallet-share-crypto.js). Core keeps
// ciphertext only, hands it only to the recipient, and deletes it when the share is revoked,
// when the recipient has saved it, or after 30 days. Without the switch every screen says the
// original is not sent.
import {CORE_ORIGIN, SiteCoreError} from './site-core.js?v=aset-a43450507728';
import {loadKakaoShareConfig, shareWithKakaoTalk} from './site-kakao-share.js?v=aset-a43450507728';
import {captureWalletShareIntent, hasWalletShareIntent, takeWalletShareIntent} from './site-route.js?v=aset-a43450507728';
import {sealWalletShareItem, shareSafetyCode} from './site-life-wallet-share-crypto.js?v=aset-a43450507728';

const BASE = '/v2/life-wallet/share';
const QR_VALUE_RE = /^https:\/\/lotbiai\.com\/#wallet-share=qr\.([A-Za-z0-9_-]{24,64})$/u;
export const DOCUMENT_TRANSFER_NOTE = '문서 원본은 아직 전송되지 않습니다. 원본 전달 기능은 보안 검토와 승인을 거쳐 열릴 예정이며, 지금은 공유 요청과 수락 여부만 주고받습니다.';
export const DOCUMENT_TRANSFER_ON_NOTE = '원본은 공유를 수락한 상대에게 암호화해 전달할 때만 LOTBI 서버를 거치며, LOTBI 관리자도 원본을 볼 수 없습니다. 상대가 수락하면 ‘보낸 공유’에서 원본을 보낼 수 있고, 공유를 취소하면 서버에 남은 암호문을 바로 지웁니다.';
const COPY_CANNOT_RETURN = '받는 분이 이미 저장한 사본과 화면 캡처는 공유를 취소해도 되돌릴 수 없습니다.';

const MESSAGES = {
  RECIPIENT_NOT_FOUND: '해당 LOTBI ID의 계정을 찾을 수 없습니다. 아이디를 다시 확인해 주세요.',
  RECIPIENT_SELF: '본인에게는 공유할 수 없습니다.',
  RECIPIENT_REQUIRED: '받는 분을 먼저 확인해 주세요.',
  LOTBI_ID_INVALID: 'LOTBI ID 형식이 올바르지 않습니다. 영문 소문자와 숫자로 된 아이디를 입력해 주세요.',
  SHARE_CODE_EXPIRED: 'QR코드가 만료되었거나 이미 사용되었습니다. 상대방에게 새 QR코드를 보여 달라고 해 주세요.',
  SHARE_CODE_INVALID: 'LOTBI 공유 QR코드가 아닙니다. 상대방의 Life Wallet 내 QR을 스캔해 주세요.',
  SHARE_REQUEST_DUPLICATE: '이 분에게 같은 자료로 보낸 공유 요청이 이미 있습니다.',
  SHARE_RATE_LIMITED: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  SHARE_ITEMS_INVALID: '공유할 자료 이름을 1~80자로 입력해 주세요.',
  INVITE_EXPIRED: '공유 링크가 만료되었습니다. 보낸 분에게 새 링크를 요청해 주세요.',
  INVITE_USED: '이미 다른 계정에서 받은 공유 링크입니다.',
  INVITE_INVALID: '사용할 수 없는 공유 링크입니다.',
  SHARE_REQUEST_EXPIRED: '기간이 지나 만료된 공유 요청입니다.',
  SHARE_REQUEST_CLOSED: '이미 처리된 공유 요청입니다.',
  SHARE_REQUEST_NOT_FOUND: '공유 요청을 찾을 수 없습니다.',
  SESSION_REQUIRED: '로그인이 필요합니다.',
  DOCUMENT_TRANSFER_NOT_ENABLED: '원본 전달 기능이 아직 열리지 않았습니다.',
  SHARE_REQUEST_NOT_ACCEPTED: '받는 분이 수락한 뒤에 원본을 보낼 수 있습니다.',
  SHARE_ITEM_NOT_FOUND: '이 공유 요청에 없는 자료입니다.',
  RECIPIENT_KEY_MISSING: '받는 분이 아직 원본을 받을 준비를 하지 않았습니다. 받는 분에게 LOTBI Life Wallet → 공유 화면을 한 번 열어 달라고 해 주세요.',
  RECIPIENT_KEY_CHANGED: '받는 분의 기기가 바뀌었습니다. 보안 확인 번호를 다시 확인하고 보내 주세요.',
  TRANSFER_CONFIRMATION_REQUIRED: '보내기 전에 받는 분과 자료를 확인해 주세요.',
  TRANSFER_TOO_LARGE: '자료가 너무 커서 보낼 수 없습니다. 사진 크기를 줄여 다시 등록한 뒤 보내 주세요.',
  TRANSFER_INPUT_INVALID: '원본을 암호화하지 못했습니다. 다시 시도해 주세요.',
  TRANSFER_NOT_SENT: '보낸 분이 아직 원본을 보내지 않았거나 보관 기간(30일)이 지났습니다.',
  TRANSFER_ALREADY_RECEIVED: '이미 내 월렛에 저장한 자료입니다.',
  SHARE_KEY_INVALID: '이 기기의 공유 받기 키를 등록하지 못했습니다.',
};
const STATUS = {PENDING: '대기 중', ACCEPTED: '수락됨', REJECTED: '거절됨', REVOKED: '공유 취소됨', EXPIRED: '만료됨'};

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

function statusRegion() {
  const region = element('p', 'wallet-message'); region.setAttribute('role', 'status'); region.setAttribute('aria-live', 'polite');
  return region;
}

function message(error, fallback = '공유 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.') {
  return MESSAGES[error?.code] || fallback;
}

async function call(path, sessionToken, {method = 'GET', body} = {}, fetchImpl = globalThis.fetch) {
  const token = typeof sessionToken === 'string' ? sessionToken.trim() : '';
  if (!token) throw new SiteCoreError(MESSAGES.SESSION_REQUIRED, {code: 'SESSION_REQUIRED', status: 401});
  const headers = {Authorization: `Bearer ${token}`, Accept: 'application/json'};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetchImpl(`${CORE_ORIGIN}${BASE}${path}`, {method, mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', headers, ...(body === undefined ? {} : {body: JSON.stringify(body)})});
  } catch {
    throw new SiteCoreError('LOTBI 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.', {code: 'SHARE_NETWORK_ERROR', retryable: true});
  }
  let payload = {}; try { payload = await response.json(); } catch {}
  if (!response.ok) {
    const detail = payload?.detail && typeof payload.detail === 'object' ? payload.detail : {};
    const code = typeof detail.code === 'string' ? detail.code : `HTTP_${response.status}`;
    throw new SiteCoreError(MESSAGES[code] || '공유 요청을 처리하지 못했습니다.', {code, status: response.status});
  }
  return payload;
}

export {captureWalletShareIntent, hasWalletShareIntent, takeWalletShareIntent};

function personLabel(person) {
  const name = person?.name || '이름 없음';
  return person?.lotbi_id ? `${name} (@${person.lotbi_id})` : name;
}

function dateLabel(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

// The share screens draw into the wallet's own root; onBack returns to the wallet list.
// wallet: this account's unlocked wallet (site-life-wallet.js mountLifeWallet) — its receiving
// key, opening sealed items and saving them. Without it only share requests are offered.
export function createWalletShare({root, sessionToken, wallet = null, onBack, onActivity = () => {}, fetchImpl = globalThis.fetch, mediaDevices = globalThis.navigator?.mediaDevices, BarcodeDetectorImpl = globalThis.BarcodeDetector} = {}) {
  let camera = null;
  let qrTimer = null;
  // Whether Core relays originals (inbox.document_transfer); unknown counts as no.
  let transferOn = false;
  const api = (path, options) => call(path, sessionToken, options, fetchImpl);
  const transferReady = () => transferOn && Boolean(wallet);
  const note = () => (transferReady() ? DOCUMENT_TRANSFER_ON_NOTE : DOCUMENT_TRANSFER_NOTE);
  const itemPath = (row, entry, last) => `/requests/${row.id}/items/${encodeURIComponent(entry.ref)}/${last}`;

  function stopCamera() {
    camera?.stop(); camera = null;
  }
  function cleanup() {
    stopCamera(); clearInterval(qrTimer); qrTimer = null;
  }
  function screen(title, ...children) {
    cleanup();
    const view = element('section', 'wallet-editor wallet-share');
    const header = element('div', 'wallet-share-header');
    header.append(button('월렛으로', () => { cleanup(); onBack(); }, true), element('h3', '', title));
    view.append(header, ...children);
    root.replaceChildren(view); onActivity();
    return view;
  }

  // ── 공유 보관함: 받은 공유 · 보낸 공유 · 내 QR ─────────────────────────────
  async function openHub(tab = 'received', notice = '') {
    const tabs = element('div', 'wallet-share-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '공유');
    const body = element('div', 'wallet-share-body'); const status = statusRegion();
    if (notice) status.textContent = notice;
    const view = screen('공유', tabs, status, body);
    const names = [['received', '받은 공유'], ['sent', '보낸 공유'], ['qr', '내 QR']];
    for (const [id, label] of names) {
      const control = button(label, () => void openHub(id), id !== tab);
      control.setAttribute('role', 'tab'); control.setAttribute('aria-selected', String(id === tab)); control.dataset.walletShareTab = id;
      tabs.append(control);
    }
    if (tab === 'qr') { renderMyQr(body, status); return view; }
    body.append(element('p', 'wallet-share-loading', '불러오는 중입니다.'));
    try {
      const box = await api('/inbox');
      transferOn = box?.document_transfer?.available === true;
      if (!view.isConnected) return view;
      body.replaceChildren(...renderRequests(tab === 'sent' ? box.sent : box.received, tab, status));
      if (tab === 'received' && transferReady()) await prepareReceiving(body, box.received);
    } catch (error) {
      if (view.isConnected) { body.replaceChildren(); status.textContent = message(error, '공유 목록을 불러오지 못했습니다.'); }
    }
    return view;
  }

  function renderRequests(rows, tab, status) {
    if (!rows.length) return [element('p', 'wallet-share-empty', tab === 'sent' ? '보낸 공유 요청이 없습니다.' : '받은 공유 요청이 없습니다.')];
    const list = element('ul', 'wallet-share-list');
    for (const row of rows) {
      const item = element('li', 'wallet-share-item'); item.dataset.walletShareRequest = row.id; item.dataset.walletShareStatus = row.status;
      const who = tab === 'sent' ? `받는 분 ${personLabel(row.recipient)}` : `보낸 분 ${personLabel(row.sharer)}`;
      item.append(element('strong', '', row.items.map(entry => entry.title).join(', ')), element('span', 'wallet-share-meta', `${who} · ${dateLabel(row.created_at)}`),
        element('span', `wallet-share-status wallet-share-status-${row.status.toLowerCase()}`, STATUS[row.status] || row.status));
      const actions = element('div', 'wallet-form-actions');
      const act = (label, path, notice, secondary = false) => button(label, async () => {
        for (const control of actions.querySelectorAll('button')) control.disabled = true;
        try {
          await api(`/requests/${row.id}/${path}`, {method: 'POST'});
          // Accepting on this device: the sharer seals the original for this device's key.
          if (path === 'accept' && transferReady()) {
            try { await registerKey(); }
            catch (error) { return void openHub(tab, `${notice} ${message(error, '이 기기로 원본을 받을 준비를 하지 못했습니다. 공유 화면을 다시 열어 주세요.')}`); }
          }
          await openHub(tab, notice);
        }
        catch (error) { status.textContent = message(error); for (const control of actions.querySelectorAll('button')) control.disabled = false; }
      }, secondary);
      if (tab === 'received' && row.status === 'PENDING') {
        actions.append(act('차단', 'block', '이 분의 공유 요청을 더 받지 않습니다.', true), act('거절', 'reject', '공유 요청을 거절했습니다.', true), act('수락', 'accept', '공유 요청을 수락했습니다.'));
      }
      if (tab === 'sent' && (row.status === 'PENDING' || row.status === 'ACCEPTED')) {
        actions.append(act('공유 취소', 'revoke', '공유를 취소했습니다. 상대방은 더 이상 이 공유에 접근할 수 없습니다.', true));
      }
      if (row.status === 'ACCEPTED' && transferReady()) item.append(renderOriginals(row, tab), element('p', 'wallet-share-note', DOCUMENT_TRANSFER_ON_NOTE));
      else if (row.status === 'ACCEPTED') item.append(element('p', 'wallet-share-note', DOCUMENT_TRANSFER_NOTE));
      if (row.status === 'EXPIRED') item.append(element('p', 'wallet-share-note', '기간이 지나 만료된 요청입니다. 필요하면 다시 공유를 요청해 주세요.'));
      if (actions.childElementCount) item.append(actions);
      list.append(item);
    }
    return [list];
  }

  // ── 원본 전달 (Core relays ciphertext only) ─────────────────────────────
  async function registerKey() {
    const local = await wallet.ensureKey();
    const {share_key: key} = await api('/key', {method: 'PUT', body: {public_key: local.publicKey}});
    await wallet.rememberKeyId(local.publicKey, key.id);
    return {...local, keyId: key.id};
  }

  // 받은 공유: this device's 보안 확인 번호, and a key registered once there is something to receive.
  async function prepareReceiving(body, received) {
    try {
      let local = await wallet.ensureKey();
      if (!local.keyId && received.some(row => row.status === 'ACCEPTED')) local = await registerKey();
      const code = await shareSafetyCode(local.publicKey);
      const safety = element('p', 'wallet-share-safety'); safety.dataset.walletShareSafety = code;
      safety.append(element('strong', '', `내 보안 확인 번호 ${code}`),
        element('span', '', '원본을 보내는 분의 화면에 같은 번호가 보이면, 원본은 이 기기에서만 열 수 있게 암호화됩니다.'));
      if (body.isConnected) body.prepend(safety);
    } catch {}
  }

  function renderOriginals(row, tab) {
    const list = element('ul', 'wallet-share-originals');
    for (const entry of row.items) {
      const state = entry.transfer?.state || 'NOT_SENT';
      const line = element('li', 'wallet-share-original'); line.dataset.walletShareOriginal = state;
      line.append(element('span', 'wallet-share-original-title', entry.title));
      if (tab === 'sent') {
        if (state === 'NOT_SENT') line.append(button('원본 보내기', () => void confirmOriginal(row, entry)));
        if (state === 'SENT') line.append(element('span', 'wallet-share-meta', `보냄 · 받는 분이 저장하기를 기다리는 중 (${dateLabel(entry.transfer.expires_at)}까지 보관)`), button('다시 보내기', () => void confirmOriginal(row, entry), true));
        if (state === 'RECEIVED') line.append(element('span', 'wallet-share-meta', '받는 분이 저장했습니다. 서버의 암호문은 지웠습니다.'));
      } else {
        if (state === 'NOT_SENT') line.append(element('span', 'wallet-share-meta', '보낸 분이 원본을 보내면 여기서 열 수 있습니다.'));
        if (state === 'SENT') line.append(button('원본 열기', () => void openReceived(row, entry)));
        if (state === 'RECEIVED') line.append(element('span', 'wallet-share-meta', '내 월렛에 저장했습니다.'));
      }
      list.append(line);
    }
    return list;
  }

  // 보내기 전 다시 확인: who receives it (and their 보안 확인 번호), what is sent, what cannot be taken back.
  async function confirmOriginal(row, entry, notice = '') {
    const status = statusRegion();
    screen('원본 보내기', element('p', 'wallet-share-loading', '받는 분 정보를 확인하는 중입니다.'), status);
    let card; let target;
    try {
      card = (await wallet.list()).find(candidate => candidate.id === entry.ref);
      if (!card) return void openHub('sent', '이 기기의 월렛에 이 자료가 없습니다. 자료를 저장한 기기에서 보내 주세요.');
      target = await api(`/requests/${row.id}/transfer`);
    } catch (error) { return void openHub('sent', message(error, '원본을 보낼 준비를 하지 못했습니다.')); }
    const code = await shareSafetyCode(target.recipient_key.public_key);
    const check = element('input'); check.type = 'checkbox'; check.dataset.walletShareConfirm = '';
    const confirm = element('label', 'wallet-share-confirm'); confirm.append(check, element('span', '', '받는 분과 보낼 자료를 다시 확인했습니다.'));
    const send = button('암호화해서 보내기', async () => {
      send.disabled = true; check.disabled = true; status.textContent = '이 기기에서 암호화하는 중입니다.';
      try {
        const sealed = await sealWalletShareItem({recipientPublicKey: target.recipient_key.public_key, keyId: target.recipient_key.id, requestId: row.id, ref: entry.ref, binding: target.binding, card});
        if (sealed.size > target.max_bytes) throw new SiteCoreError(MESSAGES.TRANSFER_TOO_LARGE, {code: 'TRANSFER_TOO_LARGE', status: 413});
        const {size, ...body} = sealed;
        await api(itemPath(row, entry, 'payload'), {method: 'PUT', body: {...body, owner_confirmed: true}});
        await openHub('sent', '원본을 암호화해 보냈습니다. 받는 분이 저장하면 서버의 암호문은 지워지고, 30일 안에 저장하지 않으면 자동으로 지워집니다.');
      } catch (error) {
        if (error?.code === 'RECIPIENT_KEY_CHANGED') return void confirmOriginal(row, entry, MESSAGES.RECIPIENT_KEY_CHANGED);
        status.textContent = message(error, '원본을 보내지 못했습니다.'); check.disabled = false; send.disabled = !check.checked;
      }
    });
    send.disabled = true; send.dataset.walletShareSend = '';
    check.addEventListener('change', () => { send.disabled = !check.checked; });
    if (notice) status.textContent = notice;
    const actions = element('div', 'wallet-form-actions'); actions.append(button('취소', () => void openHub('sent'), true), send);
    const safety = element('p', 'wallet-share-safety'); safety.dataset.walletShareSafety = code;
    safety.append(element('strong', '', `받는 분 보안 확인 번호 ${code}`), element('span', '', '받는 분의 Life Wallet → 공유 → 받은 공유 화면에 같은 번호가 보이면 맞는 분입니다.'));
    screen('원본 보내기 확인', element('p', 'wallet-share-recipient', personLabel(row.recipient)),
      element('p', 'wallet-share-help', `‘${entry.title}’ 원본(사진과 메모)을 이 분에게만 열리도록 암호화해 보냅니다.`),
      element('p', 'wallet-share-warning', `신분증·자격증·계약서처럼 중요한 자료일 수 있습니다. 받는 분이 맞는지 한 번 더 확인해 주세요. ${COPY_CANNOT_RETURN}`),
      safety, confirm, actions, status, element('p', 'wallet-security-note', DOCUMENT_TRANSFER_ON_NOTE));
  }

  // 받은 원본: opened in this browser with this device's key, then kept in my own wallet.
  async function openReceived(row, entry) {
    const status = statusRegion();
    screen(`‘${entry.title}’ 원본`, element('p', 'wallet-share-loading', '암호화된 원본을 이 기기에서 여는 중입니다.'), status);
    let item;
    try { item = await wallet.open(await api(itemPath(row, entry, 'payload'))); }
    catch (error) {
      if (error instanceof SiteCoreError) return void openHub('received', message(error, '원본을 받지 못했습니다.'));
      return void renderUnopenable();
    }
    const safeImage = value => typeof value === 'string' && /^data:image\/(?:jpeg|png);base64,/u.test(value);
    const figure = (src, label) => { const box = element('figure'); const image = element('img'); image.src = src; image.alt = `${entry.title} ${label}`; box.append(image); return box; };
    const images = element('div', 'wallet-detail-images');
    if (safeImage(item.frontDataUrl)) images.append(figure(item.frontDataUrl, '원본'));
    if (safeImage(item.backDataUrl)) images.append(figure(item.backDataUrl, '뒷면'));
    const keep = button('내 월렛에 저장', async () => {
      keep.disabled = true; status.textContent = '';
      try {
        // Free keeps one item of its own: a received one counts the same (site-life-wallet.js walletAddBlocked).
        if (wallet.addBlocked((await wallet.list()).length)) {
          status.textContent = '무료 회원은 자료를 1개까지 보관할 수 있습니다. 더 보관하려면 Basic·Plus·Pro 구독을 이용해 주세요.';
          if (!status.nextElementSibling?.matches('a[href="/subscribe"]')) {
            const plans = element('a', 'consumer-action', '구독 안내 보기'); plans.href = '/subscribe'; status.after(plans);
          }
          keep.disabled = false; return;
        }
        const kinds = ['document', 'identity', 'membership', 'certificate', 'other'];
        await wallet.save({id: wallet.newId(), kind: kinds.includes(item.kind) ? item.kind : 'document', name: String(item.name || '').slice(0, 80) || undefined,
          note: String(item.note || '').slice(0, 1000), frontDataUrl: item.frontDataUrl, backDataUrl: safeImage(item.backDataUrl) ? item.backDataUrl : '',
          ...(item.shape === 'card' || item.shape === 'document' ? {shape: item.shape} : {}), updatedAt: new Date().toISOString()});
      } catch (error) { status.textContent = message(error, '내 월렛에 저장하지 못했습니다.'); keep.disabled = false; return; }
      try {
        await api(itemPath(row, entry, 'received'), {method: 'POST'});
        await openHub('received', '내 월렛에 저장했습니다. 서버에 있던 암호문은 지웠습니다.');
      } catch { await openHub('received', '내 월렛에 저장했습니다. 서버의 암호문은 30일 안에 자동으로 지워집니다.'); }
    });
    keep.dataset.walletShareKeep = '';
    const actions = element('div', 'wallet-form-actions'); actions.append(button('받은 공유로', () => void openHub('received'), true), keep);
    screen(`‘${entry.title}’ 원본`, element('p', 'wallet-share-meta', `보낸 분 ${personLabel(row.sharer)}`), images,
      ...(item.note ? [element('p', 'wallet-card-note', String(item.note))] : []), actions, status,
      element('p', 'wallet-security-note', '원본은 이 기기에서만 열었습니다. 내 월렛에 저장하면 서버에 있던 암호문은 지워집니다.'));
  }

  function renderUnopenable() {
    const status = statusRegion();
    const here = button('이 기기로 받기', async () => {
      here.disabled = true;
      try { await registerKey(); await openHub('received', '이 기기로 받을 준비를 했습니다. 보낸 분이 원본을 다시 보내면 이 기기에서 열 수 있습니다.'); }
      catch (error) { status.textContent = message(error, '이 기기로 받을 준비를 하지 못했습니다.'); here.disabled = false; }
    });
    const actions = element('div', 'wallet-form-actions'); actions.append(button('받은 공유로', () => void openHub('received'), true), here);
    screen('이 기기에서 열 수 없는 원본입니다', element('p', 'wallet-share-help', '원본은 공유를 수락한 기기에서만 열리도록 암호화되었습니다. 그 기기에서 열거나, 이 기기로 받으려면 아래 버튼을 누른 뒤 보낸 분에게 원본을 다시 보내 달라고 해 주세요.'), actions, status);
  }

  async function renderMyQr(body, status) {
    const holder = element('div', 'wallet-share-qr');
    const make = button('내 공유 QR 만들기', () => void issue());
    const lotbiId = element('p', 'wallet-share-meta');
    body.append(element('p', 'wallet-share-help', '공유해 줄 분이 이 QR코드를 휴대전화 카메라로 스캔하면 나에게 공유 요청을 보낼 수 있습니다. QR에는 이름이나 문서가 들어 있지 않으며 10분 동안 한 번만 쓸 수 있습니다.'), holder, make, lotbiId);
    try {
      const profile = await api('/profile');
      lotbiId.textContent = profile.lotbi_id ? `내 LOTBI ID: @${profile.lotbi_id}` : 'LOTBI ID가 아직 없습니다. 계정 설정에서 LOTBI ID를 만들면 아이디로도 공유를 받을 수 있습니다.';
    } catch {}
    async function issue() {
      make.disabled = true; status.textContent = '';
      try {
        const qr = await api('/qr', {method: 'POST'});
        const image = element('img', 'wallet-share-qr-image'); image.alt = '내 Life Wallet 공유 QR코드';
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr.qr_svg)}`;
        const left = element('p', 'wallet-share-meta'); const until = Date.parse(qr.expires_at);
        const tick = () => {
          const seconds = Math.max(0, Math.round((until - Date.now()) / 1000));
          left.textContent = seconds ? `${Math.floor(seconds / 60)}분 ${String(seconds % 60).padStart(2, '0')}초 동안 쓸 수 있습니다.` : 'QR코드가 만료되었습니다. 새로 만들어 주세요.';
          if (!seconds) { clearInterval(qrTimer); image.classList.add('wallet-share-qr-expired'); }
        };
        clearInterval(qrTimer); tick(); qrTimer = setInterval(tick, 1000);
        holder.replaceChildren(image, left); make.textContent = '새 QR코드 만들기';
      } catch (error) { status.textContent = message(error, 'QR코드를 만들지 못했습니다.'); }
      make.disabled = false;
    }
  }

  // ── 자료 공유하기 ────────────────────────────────────────────────────────
  function openShareItem(card, title, defaultLabel = title) {
    const label = element('input', 'wallet-share-input'); label.maxLength = 80; label.value = defaultLabel; label.setAttribute('aria-label', '받는 분에게 보일 자료 이름');
    const field = element('label', 'wallet-field'); field.append(element('span', '', '받는 분에게 보일 이름'), label);
    const labelHelp = element('p', 'wallet-share-help', '이 이름은 받는 분과 LOTBI 서버에 그대로 보입니다. 주민등록번호·면허번호 같은 내용은 넣지 마세요.');
    const item = () => [{ref: card.id, title: label.value.trim(), kind: card.kind || 'document'}];
    const methods = element('div', 'wallet-share-methods');
    methods.append(
      button('상대방 QR 스캔', () => void scanQr(card, item)),
      button('LOTBI ID로 보내기', () => askLotbiId(card, item), true),
      button('카카오톡·링크로 보내기', () => void sendLink(card, item), true),
    );
    screen(`‘${title}’ 공유하기`, field, labelHelp, methods, element('p', 'wallet-security-note', note()));
  }

  function askLotbiId(card, item, notice = '') {
    const form = element('form', 'wallet-share-form'); const status = statusRegion(); if (notice) status.textContent = notice;
    const input = element('input', 'wallet-share-input'); input.autocomplete = 'off'; input.autocapitalize = 'none'; input.spellcheck = false; input.placeholder = '예: lotbi2026';
    const field = element('label', 'wallet-field'); field.append(element('span', '', '받는 분의 LOTBI ID'), input);
    const submit = button('받는 분 확인'); submit.type = 'submit';
    form.append(field, submit, status);
    form.addEventListener('submit', async event => {
      event.preventDefault(); status.textContent = ''; submit.disabled = true;
      try {
        const lotbiId = input.value.trim();
        const {recipient} = await api('/recipients/resolve', {method: 'POST', body: {lotbi_id: lotbiId}});
        confirmSend(card, item, recipient, {lotbi_id: lotbiId});
      } catch (error) { status.textContent = message(error); submit.disabled = false; input.focus(); }
    });
    screen('LOTBI ID로 보내기', form);
    input.focus();
  }

  function confirmSend(card, item, recipient, target) {
    const status = statusRegion();
    const send = button('공유 요청 보내기', async () => {
      send.disabled = true; status.textContent = '';
      try {
        await api('/requests', {method: 'POST', body: {...target, items: item()}});
        await openHub('sent', `${personLabel(recipient)}님에게 공유 요청을 보냈습니다. 상대방이 수락하면 여기서 확인할 수 있습니다.`);
      } catch (error) { status.textContent = message(error); send.disabled = false; }
    });
    const actions = element('div', 'wallet-form-actions'); actions.append(button('취소', () => openShareItem(card, item()[0].title), true), send);
    screen('받는 분 확인', element('p', 'wallet-share-recipient', personLabel(recipient)),
      element('p', 'wallet-share-help', `‘${item()[0].title}’ 자료에 대한 공유 요청을 보냅니다.`), actions, status,
      element('p', 'wallet-security-note', note()));
  }

  async function scanQr(card, item) {
    const status = statusRegion();
    const video = element('video', 'wallet-share-camera'); video.muted = true; video.playsInline = true; video.setAttribute('aria-label', 'QR코드 카메라 화면');
    const fallback = button('LOTBI ID로 보내기', () => askLotbiId(card, item), true);
    screen('상대방 QR 스캔', element('p', 'wallet-share-help', '받는 분의 Life Wallet → 공유 → 내 QR 화면을 비춰 주세요.'), video, status, fallback);
    if (!BarcodeDetectorImpl || !mediaDevices?.getUserMedia) {
      askLotbiId(card, item, '이 브라우저에서는 카메라로 QR코드를 읽을 수 없습니다. LOTBI ID로 보내 주세요.');
      return;
    }
    let stream;
    try {
      stream = await mediaDevices.getUserMedia({video: {facingMode: 'environment'}, audio: false});
    } catch (error) {
      const denied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
      askLotbiId(card, item, denied
        ? '카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라를 허용하거나 LOTBI ID로 보내 주세요.'
        : '카메라를 사용할 수 없습니다. LOTBI ID로 보내 주세요.');
      return;
    }
    if (!video.isConnected) { for (const track of stream.getTracks()) track.stop(); return; }
    let stopped = false; let frame = null;
    camera = {stop() { stopped = true; clearTimeout(frame); for (const track of stream.getTracks()) track.stop(); video.srcObject = null; }};
    video.srcObject = stream;
    // Recognition starts at once; it does not wait for the first frame to play.
    video.play()?.catch?.(() => {});
    const detector = new BarcodeDetectorImpl({formats: ['qr_code']});
    const look = async () => {
      if (stopped) return;
      try {
        for (const code of await detector.detect(video)) {
          const match = QR_VALUE_RE.exec(String(code.rawValue || ''));
          if (!match) { status.textContent = MESSAGES.SHARE_CODE_INVALID; continue; }
          stopCamera();
          return void resolveQr(card, item, match[1]);
        }
      } catch {}
      frame = setTimeout(look, 300);
    };
    void look();
  }

  async function resolveQr(card, item, token) {
    try {
      const {recipient} = await api('/recipients/resolve', {method: 'POST', body: {qr_token: token}});
      confirmSend(card, item, recipient, {qr_token: token});
    } catch (error) { askLotbiId(card, item, message(error)); }
  }

  async function sendLink(card, item) {
    const status = statusRegion();
    screen('카카오톡·링크로 보내기', element('p', 'wallet-share-loading', '공유 링크를 만드는 중입니다.'), status);
    let invite;
    try { invite = await api('/invites', {method: 'POST', body: {items: item()}}); }
    catch (error) { openShareItem(card, item()[0].title); root.querySelector('.wallet-share-methods')?.after(Object.assign(statusRegion(), {textContent: message(error)})); return; }
    const text = 'LOTBI Life Wallet 공유 요청이 도착했습니다. 링크를 열고 LOTBI에 로그인해 확인해 주세요.';
    const link = element('input', 'wallet-share-input'); link.readOnly = true; link.value = invite.invite_url; link.setAttribute('aria-label', '공유 링크');
    const copy = button('링크 복사', async () => {
      try { await navigator.clipboard.writeText(invite.invite_url); status.textContent = '링크를 복사했습니다. 카카오톡이나 메시지에 붙여 넣어 보내 주세요.'; }
      catch { link.select(); status.textContent = '링크를 길게 눌러 복사해 주세요.'; }
    }, true);
    const kakao = button('카카오톡으로 보내기', async () => {
      try {
        if (await loadKakaoShareConfig()) { await shareWithKakaoTalk({text, url: invite.invite_url}); return; }
        if (navigator.share) { await navigator.share({title: 'LOTBI Life Wallet 공유', text, url: invite.invite_url}); return; }
        status.textContent = '이 기기에서는 카카오톡 바로 보내기를 쓸 수 없습니다. 링크를 복사해 카카오톡에 붙여 넣어 주세요.';
      } catch (error) { if (error?.name !== 'AbortError') status.textContent = '카카오톡을 열지 못했습니다. 링크를 복사해 보내 주세요.'; }
    });
    const actions = element('div', 'wallet-form-actions'); actions.append(copy, kakao);
    screen('카카오톡·링크로 보내기', element('p', 'wallet-share-help', '이 링크는 24시간 동안 한 사람만 받을 수 있습니다. 링크를 연 분이 LOTBI에 로그인해야 공유 요청이 도착하며, 링크만으로는 아무 내용도 보이지 않습니다.'),
      link, actions, status, element('p', 'wallet-security-note', note()));
  }

  // ── 링크로 열린 공유 (#wallet-share=…) ──────────────────────────────────
  async function handleIntent(intent, cards, titleOf, labelOf = titleOf) {
    if (intent.kind === 'invite') {
      try {
        await api('/invites/claim', {method: 'POST', body: {invite_token: intent.token}});
        return openHub('received', '공유 요청이 도착했습니다. 내용을 확인하고 수락 또는 거절해 주세요.');
      } catch (error) { return openHub('received', message(error)); }
    }
    // Someone opened another person's share QR with the phone camera: pick an item for them.
    let recipient;
    try { ({recipient} = await api('/recipients/resolve', {method: 'POST', body: {qr_token: intent.token}})); }
    catch (error) { return openHub('received', message(error)); }
    if (!cards.length) return openHub('sent', '공유할 자료가 없습니다. 먼저 자료를 등록해 주세요.');
    const list = element('div', 'wallet-share-methods');
    for (const card of cards) list.append(button(titleOf(card), () => confirmSend(card, () => [{ref: card.id, title: labelOf(card), kind: card.kind || 'document'}], recipient, {qr_token: intent.token}), true));
    screen(`${personLabel(recipient)}님에게 공유할 자료`, list, element('p', 'wallet-security-note', note()));
  }

  async function pendingCount() {
    try {
      const box = await api('/inbox');
      transferOn = box?.document_transfer?.available === true;
      return box.received.filter(row => row.status === 'PENDING').length;
    } catch { return 0; }
  }

  return Object.freeze({openHub, openShareItem, handleIntent, pendingCount, transferAvailable: () => transferReady(), dispose: cleanup});
}
