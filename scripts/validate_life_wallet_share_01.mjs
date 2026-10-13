// LIFE-WALLET-SHARE-01 — Life Wallet sharing screens against a stand-in for Core's share API
// (app/life_wallet_share_api.py): 받은 공유 accept/reject/block, 보낸 공유 revoke, 내 QR,
// sharing an item by LOTBI ID, by scanning the recipient's QR (camera + BarcodeDetector),
// camera denied / unavailable falling back to LOTBI ID, KakaoTalk / link invitation, a share
// link opened from a messenger (#wallet-share=…) through a login round trip, and the wallet's
// own controls (공유, 공유하기, Free plan keeps one item). Only item labels may leave the
// device: no request body may carry an image or the wallet's data.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runFixturePage} from './lib/headless-fixture-result.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const fixtureHtml = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/site-consumer-design.css"><link rel="stylesheet" href="/site-life-wallet.css"></head><body><div id="host"></div><script type="module">
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const wait = async (predicate, label) => { for (let i = 0; i < 400; i += 1) { const value = predicate(); if (value) return value; await sleep(25); } throw new Error('timed out: ' + label); };
const host = document.getElementById('host');
const text = () => host.textContent.replace(/\\s+/gu, ' ');
const click = label => { const target = [...host.querySelectorAll('button')].find(b => b.textContent.trim() === label && !b.disabled); if (!target) throw new Error('no button ' + label + ' in ' + text().slice(0, 300)); target.click(); };
try {
  const share = await import('/site-life-wallet-share.js?test=share-01');
  const wallet = await import('/site-life-wallet.js?test=share-01');
  const route = await import('/site-route.js?test=share-01');

  // ── A stand-in for Core's share API ──────────────────────────────────────
  const calls = [];
  const people = {kimchul99: {lotbi_id: 'kimchul99', name: '김*수'}, me: {lotbi_id: 'honggil01', name: '홍*동'}};
  const QR = 'q'.repeat(32);
  let requests = [
    {id: 'lwsr_00000000000000000001', status: 'PENDING', channel: 'LOTBI_ID', direction: 'RECEIVED', items: [{ref: 'r1', title: '가족 운전면허증', kind: 'document'}], created_at: '2026-10-08T01:00:00Z', expires_at: '2026-10-15T01:00:00Z', sharer: people.kimchul99},
    {id: 'lwsr_00000000000000000002', status: 'PENDING', channel: 'QR', direction: 'SENT', items: [{ref: 'r2', title: '자격증', kind: 'document'}], created_at: '2026-10-08T02:00:00Z', expires_at: '2026-10-15T02:00:00Z', recipient: people.kimchul99},
  ];
  const json = (status, body) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  const fail = code => json(code === 'RECIPIENT_NOT_FOUND' ? 404 : 409, {detail: {code}});
  const fakeFetch = async (url, init = {}) => {
    const u = new URL(url); const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({path: u.pathname, method: init.method || 'GET', body, auth: init.headers?.Authorization, credentials: init.credentials});
    const p = u.pathname.replace('/v2/life-wallet/share', '');
    if (p === '/inbox') return json(200, {received: requests.filter(r => r.direction === 'RECEIVED'), sent: requests.filter(r => r.direction === 'SENT'), document_transfer: {available: false}});
    if (p === '/profile') return json(200, {lotbi_id: 'honggil01'});
    if (p === '/qr') return json(200, {qr_token: QR, qr_url: 'https://lotbiai.com/#wallet-share=qr.' + QR, qr_svg: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>', expires_at: new Date(Date.now() + 600000).toISOString()});
    if (p === '/recipients/resolve') {
      if (body.lotbi_id === 'nobody12345') return fail('RECIPIENT_NOT_FOUND');
      return json(200, {recipient: people.kimchul99});
    }
    if (p === '/requests') {
      const row = {id: 'lwsr_00000000000000000009', status: 'PENDING', channel: body.qr_token ? 'QR' : 'LOTBI_ID', direction: 'SENT', items: body.items, created_at: new Date().toISOString(), expires_at: new Date().toISOString(), recipient: people.kimchul99};
      requests = [...requests, row]; return json(200, {request: row});
    }
    if (p === '/invites') return json(200, {invite_id: 'lwsi_1', invite_url: 'https://lotbiai.com/#wallet-share=invite.' + 'i'.repeat(32), expires_at: new Date(Date.now() + 86400000).toISOString()});
    if (p === '/invites/claim') {
      if (body.invite_token === 'u'.repeat(32)) return json(409, {detail: {code: 'INVITE_USED'}});
      const row = {id: 'lwsr_00000000000000000010', status: 'PENDING', channel: 'INVITE', direction: 'RECEIVED', items: [{ref: 'r3', title: '보험 증서', kind: 'document'}], created_at: new Date().toISOString(), expires_at: new Date().toISOString(), sharer: people.kimchul99};
      requests = [...requests, row]; return json(200, {request: row});
    }
    const action = /^\\/requests\\/(lwsr_[0-9]{20})\\/(accept|reject|block|revoke)$/u.exec(p);
    if (action) {
      const next = {accept: 'ACCEPTED', reject: 'REJECTED', block: 'REJECTED', revoke: 'REVOKED'}[action[2]];
      requests = requests.map(r => r.id === action[1] ? {...r, status: next} : r);
      return json(200, {request: requests.find(r => r.id === action[1])});
    }
    if (u.pathname === '/app/config.json') return json(200, {navigation: {}});
    return json(404, {detail: {code: 'NOT_FOUND'}});
  };
  window.fetch = fakeFetch;   // the Kakao readiness read also comes here (no share readiness)

  const results = {};
  const card = {id: 'card-1', kind: 'document', note: '내 운전면허증\\n메모 둘째 줄', frontDataUrl: 'data:image/png;base64,AAAA', updatedAt: '2026-10-08T00:00:00Z'};
  let backs = 0;
  const make = (options = {}) => share.createWalletShare({root: host, sessionToken: 'tok', onBack: () => { backs += 1; }, fetchImpl: fakeFetch, ...options});

  // 1. 받은 공유: accept / reject / block; the accepted one says no document is sent yet.
  let ui = make();
  await ui.openHub('received');
  await wait(() => host.querySelector('[data-wallet-share-request]'), 'received list');
  results.receivedListed = text().includes('가족 운전면허증') && text().includes('보낸 분 김*수 (@kimchul99)');
  click('수락');
  await wait(() => host.querySelector('[data-wallet-share-status="ACCEPTED"]'), 'accepted');
  results.accepted = text().includes('수락됨') && text().includes('공유 요청을 수락했습니다') && text().includes('문서 원본은 아직 전송되지 않습니다');
  requests = requests.map(r => r.id.endsWith('01') ? {...r, status: 'PENDING'} : r);
  await ui.openHub('received'); await wait(() => host.querySelector('[data-wallet-share-status="PENDING"]'), 'pending again');
  click('차단'); await wait(() => text().includes('이 분의 공유 요청을 더 받지 않습니다'), 'block re-render');
  results.blockCalled = calls.some(c => c.path === '/v2/life-wallet/share/requests/lwsr_00000000000000000001/block' && c.method === 'POST');

  // 2. 보낸 공유: revoke.
  await ui.openHub('sent'); await wait(() => host.querySelector('[data-wallet-share-request]'), 'sent list');
  click('공유 취소'); await wait(() => host.querySelector('[data-wallet-share-status="REVOKED"]'), 'revoked');
  results.revoked = text().includes('공유를 취소했습니다');

  // 3. 내 QR: an SVG image (data URL, never inserted as markup), a countdown, my LOTBI ID.
  await ui.openHub('qr'); await wait(() => text().includes('내 LOTBI ID: @honggil01'), 'lotbi id');
  click('내 공유 QR 만들기'); await wait(() => host.querySelector('.wallet-share-qr-image'), 'qr image');
  const qrImage = host.querySelector('.wallet-share-qr-image');
  results.myQr = qrImage.src.startsWith('data:image/svg+xml') && /분 \\d\\d초 동안 쓸 수 있습니다/u.test(text()) && !host.querySelector('.wallet-share-qr svg');

  // 4. Share an item by LOTBI ID (label editable; only the label is sent).
  ui.openShareItem(card, wallet.walletCardTitle(card), wallet.walletShareLabel(card));
  results.shareScreen = text().includes('‘내 운전면허증’ 공유하기') && ['상대방 QR 스캔', 'LOTBI ID로 보내기', '카카오톡·링크로 보내기'].every(label => text().includes(label));
  // The label the server keeps defaults to kind and date, never the memo.
  results.defaultLabelNoMemo = host.querySelector('.wallet-share-input').value === '저장 자료 · 2026.10.08' && text().includes('LOTBI 서버에 그대로 보입니다');
  host.querySelector('.wallet-share-input').value = '면허증 사본';
  click('LOTBI ID로 보내기');
  const idInput = await wait(() => host.querySelector('.wallet-share-form input'), 'id input');
  idInput.value = 'nobody12345'; host.querySelector('.wallet-share-form').requestSubmit();
  await wait(() => text().includes('해당 LOTBI ID의 계정을 찾을 수 없습니다'), 'not found message');
  idInput.value = '@KimChul99'; host.querySelector('.wallet-share-form').requestSubmit();
  await wait(() => text().includes('받는 분 확인') && text().includes('김*수 (@kimchul99)'), 'confirm');
  click('공유 요청 보내기'); await wait(() => text().includes('공유 요청을 보냈습니다'), 'sent notice');
  const sent = calls.filter(c => c.path === '/v2/life-wallet/share/requests').at(-1);
  results.idShare = sent.body.lotbi_id === '@KimChul99' && JSON.stringify(sent.body.items) === JSON.stringify([{ref: 'card-1', title: '면허증 사본', kind: 'document'}]);

  // 5. Share by scanning the recipient's QR with the camera.
  const canvas = Object.assign(document.createElement('canvas'), {width: 8, height: 8});
  const stream = canvas.captureStream(5); let stopped = 0; stream.getTracks().forEach(track => { const stop = track.stop.bind(track); track.stop = () => { stopped += 1; stop(); }; });
  class FakeDetector { constructor(options) { this.options = options; } async detect() { return [{rawValue: 'https://lotbiai.com/#wallet-share=qr.' + QR}]; } }
  ui = make({mediaDevices: {getUserMedia: async constraints => { results.cameraConstraints = constraints; return stream; }}, BarcodeDetectorImpl: FakeDetector});
  ui.openShareItem(card, wallet.walletCardTitle(card), wallet.walletShareLabel(card));
  click('상대방 QR 스캔');
  await wait(() => text().includes('받는 분 확인'), 'qr confirm');
  results.cameraStopped = stopped > 0 && results.cameraConstraints.video.facingMode === 'environment' && results.cameraConstraints.audio === false;
  click('공유 요청 보내기'); await wait(() => text().includes('공유 요청을 보냈습니다'), 'qr sent');
  const qrSent = calls.filter(c => c.path === '/v2/life-wallet/share/requests').at(-1).body;
  results.qrShare = qrSent.qr_token === QR && JSON.stringify(qrSent.items) === JSON.stringify([{ref: 'card-1', title: '저장 자료 · 2026.10.08', kind: 'document'}]);

  // 6. Camera denied, and no BarcodeDetector at all: LOTBI ID instead, with the reason.
  ui = make({mediaDevices: {getUserMedia: async () => { throw Object.assign(new Error('denied'), {name: 'NotAllowedError'}); }}, BarcodeDetectorImpl: FakeDetector});
  ui.openShareItem(card, '자료'); click('상대방 QR 스캔');
  await wait(() => text().includes('카메라 권한이 거부되었습니다'), 'denied');
  results.cameraDenied = Boolean(host.querySelector('.wallet-share-form input'));
  ui = make({mediaDevices: {getUserMedia: async () => stream}, BarcodeDetectorImpl: undefined});
  ui.openShareItem(card, '자료'); click('상대방 QR 스캔');
  await wait(() => text().includes('이 브라우저에서는 카메라로 QR코드를 읽을 수 없습니다'), 'unsupported');
  results.cameraUnsupported = Boolean(host.querySelector('.wallet-share-form input'));

  // 7. KakaoTalk / link: one-time link, share sheet when Kakao is not configured, link copy.
  let shared = null; let copied = '';
  Object.defineProperty(navigator, 'share', {configurable: true, value: async data => { shared = data; }});
  Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: async value => { copied = value; }}});
  ui = make(); ui.openShareItem(card, '자료'); click('카카오톡·링크로 보내기');
  await wait(() => host.querySelector('input[aria-label="공유 링크"]'), 'link');
  click('카카오톡으로 보내기'); await wait(() => shared, 'share sheet');
  click('링크 복사'); await wait(() => copied, 'copied');
  results.inviteLink = shared.url === copied && copied.startsWith('https://lotbiai.com/#wallet-share=invite.') && !shared.text.includes('자료')
    && text().includes('24시간 동안 한 사람만') && text().includes('링크만으로는 아무 내용도 보이지 않습니다');

  // 8. A link opened from KakaoTalk: the token waits in this tab, the address becomes #wallet.
  history.replaceState(null, '', '/?x=1#wallet-share=invite.' + 'i'.repeat(32));
  results.capture = route.captureWalletShareIntent() === true && location.hash === '#wallet' && location.search === '?x=1'
    && route.hasWalletShareIntent() && !location.href.includes('i'.repeat(32));
  const intent = route.takeWalletShareIntent();
  results.intent = intent?.kind === 'invite' && intent.token === 'i'.repeat(32) && route.takeWalletShareIntent() === null;
  history.replaceState(null, '', '/#wallet-share=invite.short');
  results.badLinkIgnored = route.captureWalletShareIntent() === false;
  ui = make(); await ui.handleIntent({kind: 'invite', token: 'i'.repeat(32)}, [card], wallet.walletCardTitle);
  await wait(() => text().includes('보험 증서'), 'claimed');
  results.claimed = text().includes('공유 요청이 도착했습니다');
  await ui.handleIntent({kind: 'invite', token: 'u'.repeat(32)}, [card], wallet.walletCardTitle);
  await wait(() => text().includes('이미 다른 계정에서 받은 공유 링크입니다'), 'used');
  results.usedLink = true;

  // 9. The wallet itself: 공유 (with the pending count), 공유하기 on an item, Free keeps one item.
  results.limitPolicy = [wallet.walletAddBlocked({plan: 'FREE'}, 1), wallet.walletAddBlocked({plan: 'FREE'}, 0), wallet.walletAddBlocked({plan: 'PLUS'}, 9), wallet.walletAddBlocked(null, 9)].join(',');
  const account = 'share-test-account';
  const vault = new wallet.LifeWalletVault(new wallet.IndexedDbWalletRepository());
  if (!(await vault.hasVault(account))) await vault.create(account, '0123'); else await vault.unlock(account, '0123');
  for (const existing of await vault.list(account)) await vault.remove(account, existing.id);
  await vault.save(account, {id: 'card-1', kind: 'document', note: '내 운전면허증', frontDataUrl: 'data:image/png;base64,AAAA', updatedAt: '2026-10-08T00:00:00Z'});
  requests = requests.map(r => r.id.endsWith('01') ? {...r, status: 'PENDING'} : r);
  host.replaceChildren();
  const root = document.createElement('div'); host.append(root);
  const mounted = wallet.mountLifeWallet({root, authenticated: true, accountId: account, sessionExpiresAt: new Date(Date.now() + 3600000).toISOString(), sessionToken: 'tok', subscription: {plan: 'FREE'}});
  const shareButton = await wait(() => root.querySelector('[data-wallet-share-open]'), 'wallet share button');
  await wait(() => shareButton.textContent === '공유 1' || shareButton.textContent === '공유 2', 'pending count');
  results.walletShareCount = shareButton.textContent;
  root.querySelector('.wallet-add-action').click();
  await wait(() => root.querySelector('.wallet-add-limit'), 'limit');
  results.freeLimit = root.textContent.includes('무료 회원은 자료를 1개까지 보관할 수 있습니다') && root.textContent.includes('이미 저장한 자료는 그대로 남아 있습니다') && root.querySelector('a[href="/subscribe"]') !== null;
  results.cardsKept = (await vault.list(account)).length === 1;
  mounted.dispose();
  const root2 = document.createElement('div'); host.replaceChildren(root2);
  const plus = wallet.mountLifeWallet({root: root2, authenticated: true, accountId: account, sessionExpiresAt: new Date(Date.now() + 3600000).toISOString(), sessionToken: 'tok', subscription: {plan: 'PLUS'}});
  await wait(() => root2.querySelector('[data-wallet-share-open]'), 'plus wallet');
  root2.querySelector('.wallet-add-action').click();
  await wait(() => root2.querySelector('.wallet-attach'), 'plus add form');
  results.plusAdds = !root2.querySelector('.wallet-add-limit');
  plus.dispose();
  const root3 = document.createElement('div'); host.replaceChildren(root3);
  const guest = wallet.mountLifeWallet({root: root3, authenticated: true, accountId: account, sessionExpiresAt: new Date(Date.now() + 3600000).toISOString()});
  await wait(() => root3.querySelector('.wallet-toolbar'), 'wallet without session token');
  results.noTokenNoShare = !root3.querySelector('[data-wallet-share-open]');
  guest.dispose();

  // 10. Nothing but labels ever left: no body carries an image, a note or wallet data.
  const bodies = JSON.stringify(calls.map(c => c.body || null));
  results.labelsOnly = !/data:image|frontDataUrl|내 운전면허증|메모 둘째 줄|AAAA/u.test(bodies) && calls.filter(c => c.path.startsWith('/v2/life-wallet/share')).every(c => c.auth === 'Bearer tok' && c.credentials === 'omit');
  window.__result = JSON.stringify({ok: true, results});
} catch (error) { window.__result = JSON.stringify({ok: false, error: String(error?.stack || error)}); }
</script></body></html>`;

const result = await runFixturePage({root: ROOT, fixturePath: '/__life_wallet_share_01.html', fixtureHtml, resultExpression: 'window.__result || ""', viewport: {width: 390, height: 844, mobile: true, deviceScaleFactor: 1}, timeoutMs: 300_000});
assert.equal(result.ok, true, result.error);
const r = result.results;
for (const key of ['receivedListed', 'accepted', 'blockCalled', 'revoked', 'myQr', 'shareScreen', 'defaultLabelNoMemo', 'idShare', 'cameraStopped', 'qrShare', 'cameraDenied', 'cameraUnsupported',
  'inviteLink', 'capture', 'intent', 'badLinkIgnored', 'claimed', 'usedLink', 'freeLimit', 'cardsKept', 'plusAdds', 'noTokenNoShare', 'labelsOnly']) {
  assert.equal(r[key], true, `${key}: ${JSON.stringify(r)}`);
}
assert.equal(r.limitPolicy, 'true,false,false,false', 'Free keeps one item; paid plans and an unknown plan are not limited here');
assert.match(r.walletShareCount, /^공유 [12]$/u, 'the wallet shows pending received requests on 공유');
console.log('LIFE_WALLET_SHARE_01 PASS — inbox accept/reject/block, revoke, my QR, LOTBI ID share, camera QR share, denied/unsupported camera → LOTBI ID, Kakao/link invite, share-link intent, wallet 공유/공유하기, Free 1-item limit, labels only');
