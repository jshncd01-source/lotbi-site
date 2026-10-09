// LIFE-WALLET-SHARE-01 — sending a shared item's original, end-to-end encrypted, against a
// stand-in for Core's relay (app/life_wallet_share.py) that keeps the same rules: keys and
// sealed items per account, only the sharer seals, only the accepted recipient opens, revoke
// and "saved" drop the ciphertext, and nothing works while the switch is off.
//
// Two accounts in one page, each with its own wallet: 받는 분 accepts (its device key is
// registered), 보내는 분 re-confirms (warning, 보안 확인 번호 equal on both screens, checkbox)
// and sends; the request body carries ciphertext and public values only. 받는 분 opens it
// with its own key and keeps it in its own wallet (Free limit respected). Plus: a Core-made
// test vector opens here, a third key cannot open it, switch off shows no transfer controls,
// and the wallet screen says when anything goes through the server.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runFixturePage} from './lib/headless-fixture-result.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Made with Core's construction in Python (cryptography): test key, test item, no real data.
const CORE_VECTOR = {
  pkcs8: 'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgCVCATeif8HDXUtTZx2xUupMhc4d_kiftmBEJbMnlN1ihRANCAATQ7ozAd9A3Chg4Y86XGNyhUmk29jlq4gYZCJP4IPbl1azNZowjXno_YUzj42PA0LSBV6TbVRjRzOiJ-QC94Lmo',
  sealed: {request_id: 'lwsr_0000000000000000abcd', item_ref: 'vector-card', key_id: 'lwsk_00000000000000000042', binding: 'ab'.repeat(32),
    algorithm: 'ECDH-P256-HKDF-SHA256-A256GCM', ephemeral_public_key: 'BKQEvT-eImQqt9ysO6eBagQnyHdIQL1BuQekaKsDBOjPw9K3fdHfSQvAt4iUPWTCvR-fnNdsU-Tpr8YYxf9k7xU',
    salt: 'ejlLQObUkKWDyKxnc-qkZg', nonce: '0mniQw_DEwLTdBrg',
    ciphertext: 'OOYoitChSWSUOfFXsA-w-uxsaGr7pUx1I49LbNAK2TVMB2nKyxq1JUL6z87ESV-UFKe-gBtaG00ePLPl1UYfYxPPpakWr-L8J0a-AJegQdO90H8T-QgPDw3--dT9qNnuDAS2FTue0JKguALhmBoE8vusFJnPV4AeeRBFFGZaika6e9pfJe1O8I1Jhc6bK5jX_DQAtQNHtTldgiHrJF0MjrBlMUQa_K4WyNX6whqNnVn9yN3hnE2Mtej0JrpQP_wwa2zglxsS7CFrPbhjOZxXD4oQVd86n4DrWAZNBP2FRxzS'},
};

const fixtureHtml = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/site-consumer-design.css"><link rel="stylesheet" href="/site-life-wallet.css"></head><body><div id="host"></div><script type="module">
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const wait = async (predicate, label) => { for (let i = 0; i < 600; i += 1) { const value = await predicate(); if (value) return value; await sleep(25); } throw new Error('timed out: ' + label + ' — ' + text().slice(0, 400)); };
const host = document.getElementById('host');
const text = () => host.textContent.replace(/\\s+/gu, ' ');
const buttons = label => [...host.querySelectorAll('button')].filter(b => b.textContent.trim() === label);
const click = label => { const target = buttons(label).find(b => !b.disabled); if (!target) throw new Error('no button ' + label + ' in ' + text().slice(0, 400)); target.click(); };
const VECTOR = ${JSON.stringify(CORE_VECTOR)};
try {
  const share = await import('/site-life-wallet-share.js?test=transfer-01');
  const wallet = await import('/site-life-wallet.js?test=transfer-01');
  const crypto = await import('/site-life-wallet-share-crypto.js?test=transfer-01');
  const results = {};

  // ── 1. The construction itself ──────────────────────────────────────────
  const coreKey = await crypto.importSharePrivateKey(crypto.base64UrlToBytes(VECTOR.pkcs8));
  const fromCore = await crypto.openWalletShareItem(coreKey, VECTOR.sealed);
  results.coreVectorOpens = fromCore.name === '벡터 자료' && fromCore.note === 'python vector';
  results.coreVectorBindingChecked = await crypto.openWalletShareItem(coreKey, {...VECTOR.sealed, binding: 'cd'.repeat(32)}).then(() => false, () => true);

  // ── 2. Two accounts, two wallets ────────────────────────────────────────
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYPj/HwADAgH/eL9GtQAAAABJRU5ErkJggg==';
  const MEMO = '면허번호 11-22-333333-44 비밀 메모';
  const accounts = {A: 'transfer-sharer-account', B: 'transfer-recipient-account', C: 'transfer-other-account'};
  const repos = {A: new wallet.MemoryWalletRepository(), B: new wallet.MemoryWalletRepository(), C: new wallet.MemoryWalletRepository()};
  const vaults = {};
  for (const who of ['A', 'B', 'C']) { vaults[who] = new wallet.LifeWalletVault(repos[who], {sessionStorage: null}); await vaults[who].create(accounts[who], '0123'); }
  const card = await vaults.A.save(accounts.A, {id: 'card-a1', kind: 'identity', note: MEMO, frontDataUrl: PNG, updatedAt: '2026-10-09T00:00:00Z', shape: 'card'});
  let blockB = false;
  const walletOf = who => Object.freeze({
    ensureKey: () => vaults[who].ensureShareKey(accounts[who]), rememberKeyId: (publicKey, keyId) => vaults[who].rememberShareKeyId(accounts[who], publicKey, keyId),
    open: sealed => vaults[who].openSharedItem(accounts[who], sealed), list: () => vaults[who].list(accounts[who]), save: value => vaults[who].save(accounts[who], value),
    addBlocked: count => (who === 'B' ? blockB : false), newId: () => 'received-' + Math.random().toString(16).slice(2, 10),
  });

  // ── A stand-in for Core's relay (rules as in app/life_wallet_share.py) ───
  const calls = []; const people = {A: {lotbi_id: 'sharera1', name: '홍*동'}, B: {lotbi_id: 'recipb2', name: '김*수'}};
  const who = init => ({'Bearer tokA': 'A', 'Bearer tokB': 'B', 'Bearer tokC': 'C'})[init.headers?.Authorization];
  let transferOn = true; const keys = {}; const payloads = new Map(); let keySeq = 0;
  const REQ = 'lwsr_00000000000000000077';
  let request = {id: REQ, status: 'PENDING', sharer: 'A', recipient: 'B', items: [{ref: 'card-a1', title: '운전면허증', kind: 'identity'}], created_at: '2026-10-09T01:00:00Z', expires_at: '2026-10-16T01:00:00Z'};
  const json = (status, body) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  const fail = (status, code) => json(status, {detail: {code}});
  const binding = 'f0'.repeat(32);
  const view = me => {
    const received = request.recipient === me;
    const items = request.items.map(item => ({...item, ...(request.status === 'ACCEPTED' ? {transfer: payloads.get(item.ref) ? {state: payloads.get(item.ref).status === 'STORED' ? 'SENT' : 'RECEIVED', key_id: payloads.get(item.ref).key_id, size_bytes: 1, expires_at: '2026-11-08T00:00:00Z'} : {state: 'NOT_SENT'}} : {})}));
    return {...request, items, direction: received ? 'RECEIVED' : 'SENT', [received ? 'sharer' : 'recipient']: people[received ? request.sharer : request.recipient], document: transferOn ? {available: true, reason: null} : {available: false, reason: 'DOCUMENT_TRANSFER_NOT_ENABLED'}};
  };
  const fakeFetch = async (url, init = {}) => {
    const u = new URL(url); const me = who(init); const body = init.body ? JSON.parse(init.body) : undefined; const method = init.method || 'GET';
    const p = u.pathname.replace('/v2/life-wallet/share', '');
    calls.push({me, method, path: p, body, raw: init.body || '', credentials: init.credentials});
    if (p === '/inbox') {
      const mine = request.sharer === me || request.recipient === me;
      return json(200, {received: mine && request.recipient === me ? [view(me)] : [], sent: mine && request.sharer === me ? [view(me)] : [],
        document_transfer: transferOn ? {available: true, reason: null, algorithm: crypto.SHARE_TRANSFER_ALGORITHM, max_bytes: 12582912, retention_days: 30} : {available: false, reason: 'DOCUMENT_TRANSFER_NOT_ENABLED'}});
    }
    const relay = p === '/key' || /\\/(transfer|payload|received)$/u.test(p);
    if (relay && !transferOn) return fail(403, 'DOCUMENT_TRANSFER_NOT_ENABLED');
    if (p === '/key' && method === 'PUT') {
      if (Object.keys(body).join() !== 'public_key' || crypto.base64UrlToBytes(body.public_key).length !== 65) return fail(422, 'SHARE_KEY_INVALID');
      if (keys[me]?.public_key !== body.public_key) keys[me] = {id: 'lwsk_' + String(++keySeq).padStart(20, '0'), public_key: body.public_key};
      return json(200, {share_key: {id: keys[me].id, fingerprint: 'x', created_at: '2026-10-09T00:00:00Z'}});
    }
    const action = new RegExp('^/requests/' + REQ + '/(accept|revoke)$', 'u').exec(p);
    if (action) {
      if (action[1] === 'accept' && me === 'B') request = {...request, status: 'ACCEPTED'};
      else if (action[1] === 'revoke' && me === 'A') { request = {...request, status: 'REVOKED'}; payloads.clear(); }
      else return fail(404, 'SHARE_REQUEST_NOT_FOUND');
      return json(200, {request: view(me)});
    }
    if (p === '/requests/' + REQ + '/transfer') {
      if (me !== request.sharer) return fail(404, 'SHARE_REQUEST_NOT_FOUND');
      if (request.status !== 'ACCEPTED') return fail(409, request.status === 'PENDING' ? 'SHARE_REQUEST_NOT_ACCEPTED' : 'SHARE_REQUEST_CLOSED');
      if (!keys[request.recipient]) return fail(409, 'RECIPIENT_KEY_MISSING');
      return json(200, {request_id: REQ, recipient_key: {...keys[request.recipient], fingerprint: 'x', created_at: ''}, binding, algorithm: crypto.SHARE_TRANSFER_ALGORITHM, max_bytes: 12582912});
    }
    const item = new RegExp('^/requests/' + REQ + '/items/([A-Za-z0-9_-]+)/(payload|received)$', 'u').exec(p);
    if (item) {
      const ref = decodeURIComponent(item[1]);
      if (request.status !== 'ACCEPTED') return fail(409, 'SHARE_REQUEST_CLOSED');
      if (item[2] === 'payload' && method === 'PUT') {
        if (me !== request.sharer) return fail(404, 'SHARE_REQUEST_NOT_FOUND');
        if (body.owner_confirmed !== true) return fail(422, 'TRANSFER_CONFIRMATION_REQUIRED');
        if (body.key_id !== keys[request.recipient]?.id) return fail(409, 'RECIPIENT_KEY_CHANGED');
        payloads.set(ref, {...body, status: 'STORED'}); return json(200, {request: view(me)});
      }
      if (me !== request.recipient) return fail(404, 'SHARE_REQUEST_NOT_FOUND');
      const stored = payloads.get(ref);
      if (!stored) return fail(404, 'TRANSFER_NOT_SENT');
      if (item[2] === 'received') { payloads.set(ref, {...stored, status: 'RECEIVED', ciphertext: null}); return json(200, {request: view(me)}); }
      if (stored.status !== 'STORED') return fail(409, 'TRANSFER_ALREADY_RECEIVED');
      const {status, owner_confirmed, ...sealed} = stored;
      return json(200, {...sealed, request_id: REQ, item_ref: ref, binding, expires_at: '2026-11-08T00:00:00Z'});
    }
    if (u.pathname === '/app/config.json') return json(200, {navigation: {}});
    return fail(404, 'NOT_FOUND');
  };
  window.fetch = fakeFetch;
  const make = (me, extra = {}) => share.createWalletShare({root: host, sessionToken: 'tok' + me, wallet: walletOf(me), onBack: () => {}, fetchImpl: fakeFetch, ...extra});

  // 받는 분 accepts: this device's key is registered (public point only).
  let ui = make('B');
  await ui.openHub('received'); await wait(() => host.querySelector('[data-wallet-share-status="PENDING"]'), 'pending');
  click('수락'); await wait(() => host.querySelector('[data-wallet-share-status="ACCEPTED"]'), 'accepted');
  const keyCall = calls.find(c => c.me === 'B' && c.path === '/key');
  results.keyRegisteredOnAccept = Boolean(keyCall) && Object.keys(keyCall.body).join() === 'public_key' && keyCall.body.public_key.length === 87;
  await wait(() => host.querySelector('[data-wallet-share-safety]'), 'recipient safety code');
  const recipientCode = host.querySelector('[data-wallet-share-safety]').dataset.walletShareSafety;
  results.recipientSafetyCode = /^\\d{4} \\d{4} \\d{4}$/u.test(recipientCode) && text().includes('내 보안 확인 번호 ' + recipientCode);
  results.recipientWaits = host.querySelector('[data-wallet-share-original="NOT_SENT"]') !== null && text().includes('보낸 분이 원본을 보내면 여기서 열 수 있습니다') && text().includes('암호화해 전달할 때만 LOTBI 서버를 거치며');
  const vaultB = await repos.B.getVault(await wallet.accountScope(accounts.B));
  results.privateKeySealedInVault = Boolean(vaultB.shareKey?.envelope?.ciphertext) && vaultB.shareKey.publicKey === keyCall.body.public_key && vaultB.shareKey.keyId === keys.B.id
    && Object.keys(vaultB.shareKey).sort().join() === 'envelope,keyId,publicKey';

  // 보내는 분: 원본 보내기 → warning, the same 보안 확인 번호, checkbox before sending.
  ui = make('A');
  await ui.openHub('sent'); await wait(() => buttons('원본 보내기').length, 'send original button');
  click('원본 보내기');
  await wait(() => host.querySelector('[data-wallet-share-send]'), 'confirm screen');
  const sharerCode = host.querySelector('[data-wallet-share-safety]').dataset.walletShareSafety;
  results.sameSafetyCode = sharerCode === recipientCode;
  results.reconfirm = text().includes('원본 보내기 확인') && text().includes('김*수 (@recipb2)') && text().includes('신분증·자격증·계약서처럼 중요한 자료일 수 있습니다')
    && text().includes('공유를 취소해도 되돌릴 수 없습니다') && host.querySelector('[data-wallet-share-send]').disabled === true;
  host.querySelector('[data-wallet-share-confirm]').click();
  results.checkboxEnables = host.querySelector('[data-wallet-share-send]').disabled === false;
  click('암호화해서 보내기');
  await wait(() => text().includes('원본을 암호화해 보냈습니다'), 'sent notice');
  const put = calls.find(c => c.me === 'A' && c.method === 'PUT' && c.path.endsWith('/payload'));
  results.uploadShape = Object.keys(put.body).sort().join() === 'algorithm,ciphertext,ephemeral_public_key,key_id,nonce,owner_confirmed,salt' && put.body.owner_confirmed === true && put.body.key_id === keys.B.id;
  results.ciphertextOnly = !/iVBORw0KGgo|면허번호|비밀 메모|data:image|운전면허증|frontDataUrl|recipb2/u.test(put.raw);
  results.sentState = host.querySelector('[data-wallet-share-original="SENT"]') !== null && text().includes('받는 분이 저장하기를 기다리는 중');

  // A third key cannot open it; the recipient's own key can.
  const sealedForB = {...payloads.get('card-a1'), request_id: REQ, item_ref: 'card-a1', binding};
  await vaults.C.ensureShareKey(accounts.C);
  results.otherKeyCannotOpen = await vaults.C.openSharedItem(accounts.C, sealedForB).then(() => false, error => error.code === 'SHARE_ITEM_UNOPENABLE');

  // 받는 분: 원본 열기 → the picture and memo, opened here → 내 월렛에 저장 (Free limit first).
  ui = make('B');
  await ui.openHub('received'); await wait(() => buttons('원본 열기').length, 'open original');
  blockB = true;
  click('원본 열기'); await wait(() => host.querySelector('[data-wallet-share-keep]'), 'viewer');
  results.viewer = host.querySelector('.wallet-detail-images img')?.src === PNG && text().includes(MEMO) && text().includes('보낸 분 홍*동 (@sharera1)');
  click('내 월렛에 저장'); await wait(() => text().includes('무료 회원은 자료를 1개까지 보관할 수 있습니다'), 'free limit');
  results.freeLimitHolds = (await vaults.B.list(accounts.B)).length === 0 && !calls.some(c => c.path.endsWith('/received')) && host.querySelector('a[href="/subscribe"]') !== null;
  blockB = false;
  click('내 월렛에 저장'); await wait(() => text().includes('내 월렛에 저장했습니다. 서버에 있던 암호문은 지웠습니다'), 'saved');
  const kept = await vaults.B.list(accounts.B);
  results.keptInOwnWallet = kept.length === 1 && kept[0].frontDataUrl === PNG && kept[0].note === MEMO && kept[0].kind === 'identity' && kept[0].shape === 'card' && kept[0].id !== card.id;
  results.receivedCalled = calls.some(c => c.me === 'B' && c.method === 'POST' && c.path.endsWith('/items/card-a1/received')) && payloads.get('card-a1').ciphertext === null;
  results.receivedState = host.querySelector('[data-wallet-share-original="RECEIVED"]') !== null;

  // Sealed for another device: this one says so and can take over receiving.
  payloads.set('card-a1', {...sealedForB, status: 'STORED'});
  for (const key of ['request_id', 'item_ref', 'binding']) delete payloads.get('card-a1')[key];
  const cKey = await vaults.C.ensureShareKey(accounts.C);
  const sealedForC = await crypto.sealWalletShareItem({recipientPublicKey: cKey.publicKey, keyId: 'lwsk_other', requestId: REQ, ref: 'card-a1', binding, card});
  const {size, ...forC} = sealedForC; payloads.set('card-a1', {...forC, status: 'STORED'});
  await ui.openHub('received'); await wait(() => buttons('원본 열기').length, 'open again');
  click('원본 열기'); await wait(() => text().includes('이 기기에서 열 수 없는 원본입니다'), 'unopenable');
  const keyCallsBefore = calls.filter(c => c.me === 'B' && c.path === '/key').length;
  click('이 기기로 받기'); await wait(() => text().includes('이 기기로 받을 준비를 했습니다'), 'take over');
  results.unopenableTakeOver = calls.filter(c => c.me === 'B' && c.path === '/key').length === keyCallsBefore + 1;

  // The recipient has no key yet: the sharer is told what to ask for.
  delete keys.B; payloads.clear();
  ui = make('A'); await ui.openHub('sent'); await wait(() => buttons('원본 보내기').length, 'send again');
  click('원본 보내기'); await wait(() => text().includes('받는 분이 아직 원본을 받을 준비를 하지 않았습니다'), 'key missing');
  results.keyMissingMessage = true;

  // 공유 취소: the stand-in drops the ciphertext like Core; the recipient sees it closed.
  keys.B = {id: 'lwsk_99999999999999999999', public_key: vaultB.shareKey.publicKey};
  payloads.set('card-a1', {status: 'STORED'});
  await ui.openHub('sent'); await wait(() => buttons('공유 취소').length, 'revoke button');
  click('공유 취소'); await wait(() => host.querySelector('[data-wallet-share-status="REVOKED"]'), 'revoked');
  results.revokeDropsCiphertext = payloads.size === 0;
  ui = make('B'); await ui.openHub('received'); await wait(() => host.querySelector('[data-wallet-share-status="REVOKED"]'), 'recipient sees revoked');
  results.revokedHasNoOpen = buttons('원본 열기').length === 0;

  // Switch off: no key, no send, no open — the 'not sent yet' note instead.
  request = {...request, status: 'ACCEPTED'}; transferOn = false; payloads.set('card-a1', {status: 'STORED', key_id: 'x'});
  const before = calls.length;
  ui = make('A'); await ui.openHub('sent'); await wait(() => host.querySelector('[data-wallet-share-status="ACCEPTED"]'), 'off sent');
  results.offSender = buttons('원본 보내기').length === 0 && text().includes('문서 원본은 아직 전송되지 않습니다') && !host.querySelector('[data-wallet-share-original]');
  ui = make('B'); await ui.openHub('received'); await wait(() => host.querySelector('[data-wallet-share-status="ACCEPTED"]'), 'off received');
  results.offRecipient = buttons('원본 열기').length === 0 && !host.querySelector('[data-wallet-share-safety]') && text().includes('문서 원본은 아직 전송되지 않습니다');
  results.offNoRelayCalls = calls.slice(before).every(c => c.path === '/inbox');
  ui.openShareItem(card, wallet.walletCardTitle(card));
  results.offShareScreenNote = text().includes('문서 원본은 아직 전송되지 않습니다');
  transferOn = true;
  ui = make('A'); await ui.pendingCount(); ui.openShareItem(card, wallet.walletCardTitle(card));
  results.onShareScreenNote = text().includes('암호화해 전달할 때만 LOTBI 서버를 거치며');

  // Every call: bearer of its own account, no cookies.
  results.bearerOnly = calls.every(c => ['A', 'B', 'C'].includes(c.me) && c.credentials === 'omit');

  // The wallet screen says when anything goes through the server.
  const account = 'transfer-wallet-screen';
  const vault = new wallet.LifeWalletVault(new wallet.IndexedDbWalletRepository());
  if (!(await vault.hasVault(account))) await vault.create(account, '0123'); else await vault.unlock(account, '0123');
  const root = document.createElement('div'); host.replaceChildren(root);
  const mounted = wallet.mountLifeWallet({root, authenticated: true, accountId: account, sessionExpiresAt: new Date(Date.now() + 3600000).toISOString(), sessionToken: 'tokA', subscription: {plan: 'PLUS'}});
  await wait(() => root.querySelector('.wallet-storage-share-note'), 'wallet relay note');
  results.walletScreenNote = root.querySelector('.wallet-storage-share-note').textContent === '공유를 수락한 상대에게 암호화해 전달할 때만 서버를 거칩니다.' && root.textContent.includes('안전하게 이 기기에만 저장됩니다.');
  mounted.dispose();
  window.__result = JSON.stringify({ok: true, results});
} catch (error) { window.__result = JSON.stringify({ok: false, error: String(error?.stack || error)}); }
</script></body></html>`;

const result = await runFixturePage({root: ROOT, fixturePath: '/__life_wallet_share_transfer_01.html', fixtureHtml, resultExpression: 'window.__result || ""', viewport: {width: 390, height: 844, mobile: true, deviceScaleFactor: 1}, timeoutMs: 300_000});
assert.equal(result.ok, true, result.error);
const r = result.results;
for (const key of ['coreVectorOpens', 'coreVectorBindingChecked', 'keyRegisteredOnAccept', 'recipientSafetyCode', 'recipientWaits', 'privateKeySealedInVault',
  'sameSafetyCode', 'reconfirm', 'checkboxEnables', 'uploadShape', 'ciphertextOnly', 'sentState', 'otherKeyCannotOpen', 'viewer', 'freeLimitHolds',
  'keptInOwnWallet', 'receivedCalled', 'receivedState', 'unopenableTakeOver', 'keyMissingMessage', 'revokeDropsCiphertext', 'revokedHasNoOpen',
  'offSender', 'offRecipient', 'offNoRelayCalls', 'offShareScreenNote', 'onShareScreenNote', 'bearerOnly', 'walletScreenNote']) {
  assert.equal(r[key], true, `${key}: ${JSON.stringify(r)}`);
}
console.log('LIFE_WALLET_SHARE_TRANSFER_01 PASS — Core vector opens, key registered on accept (public only, private sealed in vault), re-confirm with matching 보안 확인 번호, ciphertext-only upload, third key cannot open, recipient opens and keeps it (Free limit), saved drops ciphertext, other-device take-over, key missing, revoke drops ciphertext, switch off shows no transfer, wallet screen relay note');
