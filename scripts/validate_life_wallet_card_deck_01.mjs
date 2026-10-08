// LIFE-WALLET-CARD-DECK-01
// The wallet list is a Samsung Pay-like card deck (it replaces the one-item carousel of
// LIFE-WALLET-CARD-CAROUSEL-01, whose rules carry over: nothing cut, swipe/drag/dots/keys, a
// drag never opens, no arrow buttons, fits a phone): every item is a card of one size, the
// front card whole and up to three next cards peeking out above it. Items are sorted into
// 카드 / 문서 by the picture's shape alone (nothing is read from it), the owner can change it
// on the item (saved encrypted with the item), and 전체·카드·문서 filter a mixed wallet.
// All images are synthetic, plain colour.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runFixturePage} from './lib/headless-fixture-result.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const head = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/site-consumer-design.css"><link rel="stylesheet" href="/site-life-wallet.css"><style>body{margin:0;padding:16px;background:var(--lotbi-bg-primary,#fff)}#host{max-width:720px;margin:0 auto}</style></head><body><main id="host"></main>';
const helpers = `
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const wait = async (predicate, label) => { for (let i = 0; i < 2400; i += 1) { const value = predicate(); if (value) return value; await sleep(25); } throw new Error('timed out ' + label); };
const shaped = (width, height, colour) => { const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, width, height); context.fillStyle = colour || '#1f3b5a'; context.fillRect(width * .1, height * .1, width * .8, height * .8); return canvas.toDataURL('image/png'); };
// Images are ready once loaded (complete with a size). Not image.decode(): it waits on the
// compositor and can stay pending in headless Chrome on a saturated machine.
const loaded = async root => { for (let i = 0; i < 400 && ![...root.querySelectorAll('img')].every(image => image.complete && image.naturalWidth); i += 1) await sleep(25); await sleep(400); };
`;

const deckFixture = head + `<script type="module">
${helpers}
try {
  const {createWalletCardDeck, walletItemShape, walletCardTitle} = await import('/site-life-wallet.js?test=card-deck');
  const at = '2026-10-01T12:00:00.000Z';
  // Two ID-sized cards, a portrait page, and a portrait picture its owner marked as a card.
  const cards = [
    {id: 'one', name: '신분·자격 자료', kind: 'identity', note: '', updatedAt: at, frontDataUrl: shaped(1012, 638)},
    {id: 'two', name: '회원증', kind: 'membership', note: '', updatedAt: at, frontDataUrl: shaped(1015, 643, '#5a1f3b')},
    {id: 'three', name: '계약서', kind: 'certificate', note: '', updatedAt: at, frontDataUrl: shaped(734, 1024, '#3b5a1f')},
    {id: 'four', name: '사원증', kind: 'membership', note: '', updatedAt: at, shape: 'card', frontDataUrl: shaped(700, 1000, '#5a3b1f')},
  ];
  const opened = [];
  const deck = createWalletCardDeck({cards, onOpen: card => opened.push(card.id)});
  document.getElementById('host').append(deck);
  await loaded(deck);
  const stage = deck.querySelector('.wallet-deck');
  const face = id => deck.querySelector('[data-wallet-deck-card="' + id + '"]');
  const front = () => deck.querySelector('.wallet-deck-card[data-depth="0"]');
  const position = () => deck.querySelector('.wallet-card-position').textContent;
  const rect = element => element.getBoundingClientRect();
  const shapes = Object.fromEntries(cards.map(card => [card.id, face(card.id).dataset.shape]));
  // Stacked: the front card whole, three peeking out above it, each a little higher.
  const peeking = [...deck.querySelectorAll('.wallet-deck-card')].filter(card => Number(card.dataset.depth) >= 1 && Number(card.dataset.depth) <= 3 && getComputedStyle(card).opacity !== '0' && !card.hidden);
  const frontRect = rect(front()); const shellRect = rect(deck);
  const stack = peeking.map(card => ({depth: Number(card.dataset.depth), top: rect(card).top - frontRect.top, width: rect(card).width, z: Number(getComputedStyle(card).zIndex), visibleContent: getComputedStyle(card.firstElementChild).visibility}));
  const frontImage = front().querySelector('img');
  const imageRect = rect(frontImage);
  const firstView = {
    count: deck.querySelectorAll('.wallet-deck-card').length,
    frontId: front().dataset.walletDeckCard, frontZ: Number(getComputedStyle(front()).zIndex),
    stack, aboveShell: Math.min(...peeking.map(card => rect(card).top)) - shellRect.top,
    frontInside: frontRect.left >= shellRect.left - .5 && frontRect.right <= shellRect.right + .5,
    cardAspect: frontRect.width / frontRect.height,
    objectFit: getComputedStyle(frontImage).objectFit, imageTransform: getComputedStyle(frontImage).transform,
    imageInside: imageRect.left >= frontRect.left - .5 && imageRect.right <= frontRect.right + .5 && imageRect.top >= frontRect.top - .5 && imageRect.bottom <= frontRect.bottom + .5,
    title: deck.querySelector('.wallet-deck-title').textContent, date: deck.querySelector('.wallet-deck-date').textContent, expectedTitle: walletCardTitle(cards[0]),
    arrowButtons: deck.querySelectorAll('.wallet-card-arrow,[data-wallet-carousel-next],[data-wallet-carousel-previous]').length,
    dots: deck.querySelectorAll('[data-wallet-carousel-dot]').length, position: position(),
    touchAction: getComputedStyle(stage).touchAction,
    documentFace: {kind: face('three').querySelector('.wallet-deck-doc-kind')?.textContent || '', thumbFit: getComputedStyle(face('three').querySelector('img')).objectFit},
    filters: deck.querySelector('.wallet-deck-filters').hidden ? [] : [...deck.querySelectorAll('[data-wallet-deck-filter]')].map(chip => chip.textContent + (chip.getAttribute('aria-pressed') === 'true' ? '*' : '')),
    shapes, measured: [walletItemShape(1012, 638), walletItemShape(734, 1024), walletItemShape(1000, 1000), walletItemShape(2400, 1000), walletItemShape(0, 0)],
  };
  // Filters: 문서 shows the page alone; 전체 keeps it in front.
  deck.querySelector('[data-wallet-deck-filter="document"]').click(); await sleep(350);
  const documentFilter = {visible: [...deck.querySelectorAll('.wallet-deck-card')].filter(card => !card.hidden).map(card => card.dataset.walletDeckCard), position: position(), dots: deck.querySelectorAll('[data-wallet-carousel-dot]').length};
  deck.querySelector('[data-wallet-deck-filter="card"]').click(); await sleep(350);
  const cardFilter = {visible: [...deck.querySelectorAll('.wallet-deck-card')].filter(card => !card.hidden).map(card => card.dataset.walletDeckCard), position: position()};
  deck.querySelector('[data-wallet-deck-filter="all"]').click(); await sleep(350);
  const allFilter = {position: position(), front: front().dataset.walletDeckCard};
  deck.querySelectorAll('[data-wallet-carousel-dot]')[0].click(); await sleep(350);
  const dotPosition = position();
  // A mouse drag to the left brings the next card to the front and opens nothing.
  const startRect = rect(face('one')); const x = startRect.left + startRect.width / 2; const y = startRect.top + startRect.height / 2;
  face('one').querySelector('img').dispatchEvent(new PointerEvent('pointerdown', {pointerId: 7, pointerType: 'mouse', button: 0, clientX: x, clientY: y, bubbles: true}));
  for (const step of [10, 60, 140, 220]) window.dispatchEvent(new PointerEvent('pointermove', {pointerId: 7, pointerType: 'mouse', buttons: 1, clientX: x - step, clientY: y, bubbles: true}));
  const dragging = stage.dataset.dragging === 'true' && face('one').style.transform.includes('translateX');
  window.dispatchEvent(new PointerEvent('pointerup', {pointerId: 7, pointerType: 'mouse', button: 0, clientX: x - 220, clientY: y, bubbles: true}));
  face('one').click();
  await sleep(400);
  const drag = {position: position(), opened: opened.join(','), front: front().dataset.walletDeckCard, settled: face('one').style.transform};
  // A short drag settles back.
  const shortRect = rect(front()); const sx = shortRect.left + shortRect.width / 2;
  front().dispatchEvent(new PointerEvent('pointerdown', {pointerId: 8, pointerType: 'touch', clientX: sx, clientY: y, bubbles: true}));
  window.dispatchEvent(new PointerEvent('pointermove', {pointerId: 8, pointerType: 'touch', clientX: sx - 30, clientY: y, bubbles: true}));
  window.dispatchEvent(new PointerEvent('pointerup', {pointerId: 8, pointerType: 'touch', clientX: sx - 30, clientY: y, bubbles: true}));
  await sleep(300);
  const shortDrag = position();
  stage.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true})); await sleep(300);
  const keyRight = position();
  stage.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowLeft', bubbles: true})); await sleep(300);
  const keyLeft = position();
  // A tap on a peeking card brings it forward (does not open it); a tap on the front opens.
  deck.querySelector('.wallet-deck-card[data-depth="1"]').click(); await sleep(300);
  const peekTap = {position: position(), opened: opened.join(',')};
  front().click(); deck.querySelector('.wallet-deck-open').click();
  const frontTap = opened.join(',');
  // One item: no dots, no filters, no room kept for peeking cards.
  const single = createWalletCardDeck({cards: [cards[0]], onOpen: () => {}});
  document.getElementById('host').append(single); await loaded(single);
  const singleView = {dots: single.querySelectorAll('[data-wallet-carousel-dot]').length, filters: !single.querySelector('.wallet-deck-filters').hidden, singleClass: single.classList.contains('wallet-deck-single')};
  // Cards only: no filters.
  const cardsOnly = createWalletCardDeck({cards: cards.slice(0, 2), onOpen: () => {}});
  document.getElementById('host').append(cardsOnly); await loaded(cardsOnly);
  const overflow = document.documentElement.scrollWidth > innerWidth;
  window.__result = JSON.stringify({ok: true, width: innerWidth, firstView, documentFilter, cardFilter, allFilter, dotPosition, dragging, drag, shortDrag, keyRight, keyLeft, peekTap, frontTap, singleView, cardsOnlyFilters: !cardsOnly.querySelector('.wallet-deck-filters').hidden, overflow});
} catch (error) { window.__result = JSON.stringify({ok: false, error: String(error?.stack || error)}); }
</script></body></html>`;

// The owner moves a whole (uncut) ID photo that came out as a document to 카드, on the real
// wallet: saved encrypted with the item, its place in the deck kept, junk values refused.
const detailFixture = head + `<script type="module">
${helpers}
try {
  const {mountLifeWallet, LifeWalletVault, IndexedDbWalletRepository} = await import('/site-life-wallet.js?test=card-deck-detail');
  const root = document.getElementById('host');
  const accountId = 'card-deck-' + Date.now();
  mountLifeWallet({root, authenticated: true, accountId});
  const setup = await wait(() => root.querySelector('form.wallet-pin-form:not(.wallet-unlock-form)'), 'pin setup');
  const [first, second] = setup.querySelectorAll('input'); first.value = '1357'; second.value = '1357'; setup.requestSubmit();
  await wait(() => [...root.querySelectorAll('button')].find(button => button.textContent === '잠그기'), 'unlocked wallet');
  const store = new LifeWalletVault(new IndexedDbWalletRepository());
  await store.unlock(accountId, '1357');
  const at = '2026-10-01T12:00:00.000Z';
  await store.save(accountId, {id: 'whole', kind: 'document', note: '', updatedAt: at, frontDataUrl: shaped(1000, 1400)});
  await store.save(accountId, {id: 'later', kind: 'document', note: '', updatedAt: '2026-09-01T12:00:00.000Z', frontDataUrl: shaped(1012, 638)});
  let refused = '';
  try { await store.save(accountId, {id: 'junk', kind: 'document', note: '', updatedAt: at, shape: 'gallery', frontDataUrl: shaped(10, 10)}); } catch (error) { refused = error.message; }
  [...root.querySelectorAll('button')].find(button => button.textContent === '잠그기').click();
  const form = await wait(() => root.querySelector('.wallet-unlock-form'), 'unlock form');
  form.querySelector('input').value = '1357'; form.requestSubmit();
  const deckFace = await wait(() => root.querySelector('[data-wallet-deck-card="whole"]'), 'deck');
  await loaded(root);
  const before = {shape: deckFace.dataset.shape, filters: [...root.querySelectorAll('[data-wallet-deck-filter]')].map(chip => chip.textContent)};
  deckFace.click();
  const detail = await wait(() => root.querySelector('.wallet-detail'), 'detail');
  await loaded(detail);
  const pressed = () => [...detail.querySelectorAll('[data-wallet-shape-choice]')].filter(choice => choice.getAttribute('aria-pressed') === 'true').map(choice => choice.dataset.walletShapeChoice).join(',');
  const shown = pressed();
  const zoom = [...detail.querySelectorAll('button')].find(button => button.textContent === '크게 보기'); zoom.click();
  const zoomed = detail.querySelector('.wallet-detail-images').classList.contains('wallet-detail-zoomed') && zoom.getAttribute('aria-pressed') === 'true' && zoom.textContent === '맞춰 보기';
  detail.querySelector('[data-wallet-shape-choice="card"]').click();
  await wait(() => detail.querySelector('.wallet-detail-shape-status').textContent, 'shape saved');
  const after = {pressed: pressed(), status: detail.querySelector('.wallet-detail-shape-status').textContent, facts: detail.querySelector('.wallet-detail-facts').textContent};
  const saved = (await store.list(accountId)).map(card => ({id: card.id, shape: card.shape || '', updatedAt: card.updatedAt}));
  [...detail.querySelectorAll('button')].find(button => button.textContent === '목록으로').click();
  const back = await wait(() => root.querySelector('[data-wallet-deck-card="whole"][data-shape]'), 'deck again');
  await loaded(root);
  window.__result = JSON.stringify({ok: true, refused, before, shown, zoomed, after, saved, backShape: back.dataset.shape, backFront: root.querySelector('.wallet-deck-card[data-depth="0"]').dataset.walletDeckCard, backFilters: root.querySelector('.wallet-deck-filters').hidden});
} catch (error) { window.__result = JSON.stringify({ok: false, error: String(error?.stack || error)}); }
</script></body></html>`;

const run = (fixtureHtml, viewport, name) => runFixturePage({root: ROOT, fixturePath: `/__life_wallet_card_deck_${name}.html`, fixtureHtml, viewport, timeoutMs: 600000, resultExpression: 'window.__result || ""'});

const widths = [];
for (const viewport of [{width: 1200, height: 900}, {width: 412, height: 900, mobile: true}, {width: 390, height: 844, mobile: true}, {width: 360, height: 800, mobile: true}]) {
  const result = await run(deckFixture, viewport, `deck_${viewport.width}`);
  assert.equal(result.ok, true, result.error);
  const detail = `${viewport.width}px: ${JSON.stringify(result)}`;
  const view = result.firstView;
  assert.equal(view.count, 4, `every saved item is in the deck: ${detail}`);
  assert.equal(view.frontId, 'one', `the newest item is in front: ${detail}`);
  // The stack: three cards peek out above the front one, each higher, narrower and behind.
  assert.equal(view.stack.length, 3, `three next cards peek out: ${detail}`);
  view.stack.sort((left, right) => left.depth - right.depth);
  for (const [order, card] of view.stack.entries()) {
    assert.ok(card.top < -8 * (order + 1), `peeking card ${card.depth} shows its top edge above the front card: ${detail}`);
    assert.ok(card.z < view.frontZ && card.width < 0.99 * (view.stack[order - 1]?.width ?? Infinity), `peeking card ${card.depth} sits behind and is smaller: ${detail}`);
    assert.equal(card.visibleContent, 'visible', `a peeking card shows its own face: ${detail}`);
  }
  assert.ok(view.aboveShell >= -.5, `peeking cards stay inside the wallet (not over the toolbar): ${detail}`);
  assert.equal(view.frontInside, true, `the front card is whole: ${detail}`);
  assert.ok(Math.abs(view.cardAspect - 85.6 / 53.98) < .02, `one card size (ID-1) for every item: ${detail}`);
  assert.equal(view.objectFit, 'contain', `pictures fit inside the card face, never cut: ${detail}`);
  assert.equal(view.imageTransform, 'none', `no zoom crop: ${detail}`);
  assert.equal(view.imageInside, true, `the picture stays inside its card: ${detail}`);
  assert.equal(view.title, view.expectedTitle, `the front item's title is under the deck: ${detail}`);
  assert.match(view.date, /^2026\.(?:09\.30|10\.0[12]) 등록$/u, `its save date: ${detail}`);
  assert.equal(view.arrowButtons, 0, `moved by swipe like a phone wallet, no arrow buttons: ${detail}`);
  assert.equal(view.dots, 4, `a dot per item: ${detail}`);
  assert.equal(view.position, '1 / 4', detail);
  assert.equal(view.touchAction, 'pan-y', `vertical scrolling stays with the page: ${detail}`);
  // Shape only: 카드 for ID-like landscapes, 문서 otherwise; the owner's choice wins.
  assert.deepEqual(view.shapes, {one: 'card', two: 'card', three: 'document', four: 'card'}, detail);
  assert.deepEqual(view.measured, ['card', 'document', 'document', 'document', ''], detail);
  assert.deepEqual(view.documentFace, {kind: '문서', thumbFit: 'contain'}, `a document card shows its first page small, uncut: ${detail}`);
  assert.deepEqual(view.filters, ['전체 4*', '카드 3', '문서 1'], `a mixed wallet offers 전체·카드·문서: ${detail}`);
  assert.deepEqual(result.documentFilter, {visible: ['three'], position: '1 / 1', dots: 0}, detail);
  assert.deepEqual(result.cardFilter, {visible: ['one', 'two', 'four'], position: '1 / 3'}, `카드 keeps the deck order: ${detail}`);
  assert.deepEqual(result.allFilter, {position: '1 / 4', front: 'one'}, `전체 keeps the card in front: ${detail}`);
  assert.equal(result.dotPosition, '1 / 4', detail);
  assert.equal(result.dragging, true, `a drag moves the front card: ${detail}`);
  assert.deepEqual(result.drag, {position: '2 / 4', opened: '', front: 'two', settled: ''}, `a drag left brings the next card forward and opens nothing: ${detail}`);
  assert.equal(result.shortDrag, '2 / 4', `a short drag settles back: ${detail}`);
  assert.equal(result.keyRight, '3 / 4', detail);
  assert.equal(result.keyLeft, '2 / 4', detail);
  assert.deepEqual(result.peekTap, {position: '3 / 4', opened: ''}, `a tap on a peeking card brings it forward: ${detail}`);
  assert.equal(result.frontTap, 'three,three', `a tap on the front card (or 보기) opens it: ${detail}`);
  assert.deepEqual(result.singleView, {dots: 0, filters: false, singleClass: true}, `one item: no deck controls: ${detail}`);
  assert.equal(result.cardsOnlyFilters, false, `cards only: no filters: ${detail}`);
  assert.equal(result.overflow, false, `no sideways scrolling: ${detail}`);
  widths.push(viewport.width);
}

const detail = await run(detailFixture, {width: 390, height: 844, mobile: true}, 'detail');
assert.equal(detail.ok, true, detail.error);
{
  const text = JSON.stringify(detail);
  assert.equal(detail.refused, '자료 분류가 올바르지 않습니다.', `only 카드 or 문서 is stored: ${text}`);
  assert.equal(detail.before.shape, 'document', `a whole portrait photo first counts as a document: ${text}`);
  assert.deepEqual(detail.before.filters, ['전체 2', '카드 1', '문서 1'], text);
  assert.equal(detail.shown, 'document', `the detail shows the measured 분류: ${text}`);
  assert.equal(detail.zoomed, true, `크게 보기 toggles a larger view: ${text}`);
  assert.deepEqual(detail.after, {pressed: 'card', status: '카드로 옮겼습니다.', facts: detail.after.facts}, text);
  assert.match(detail.after.facts, /등록$/u, text);
  assert.deepEqual(detail.saved, [{id: 'whole', shape: 'card', updatedAt: '2026-10-01T12:00:00.000Z'}, {id: 'later', shape: '', updatedAt: '2026-09-01T12:00:00.000Z'}], `saved with the item, save time (deck place) kept: ${text}`);
  assert.equal(detail.backShape, 'card', `the deck follows the owner's choice: ${text}`);
  assert.equal(detail.backFront, 'whole', text);
  assert.equal(detail.backFilters, true, `now both are cards: no filters: ${text}`);
}
console.log(`LIFE_WALLET_CARD_DECK_01 PASS — deck at ${widths.join('/')}px, shape 카드/문서 + owner change saved encrypted`);
