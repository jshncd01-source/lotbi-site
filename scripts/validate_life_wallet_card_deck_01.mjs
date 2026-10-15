// LIFE-WALLET-VERTICAL-DECK-01 → LIFE-WALLET-REDESIGN-02 (owner-approved design, 2026-10-14)
// Synthetic-only verification of the saved-items list that replaced the vertical deck: kind
// chips with counts, search over title and memo (in memory only), three sorts, blurred pictures
// that show for 30 seconds on a press, empty states that point to 종류 바꾸기, the local view state
// (only {filter, selectedId}), and — in the mounted wallet — the restored filter, the toolbar,
// the two tabs, the settings screen, the item page and the encrypted kind change from a dialog.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runFixturePage} from './lib/headless-fixture-result.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const head = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/site-theme-tokens.css"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/site-consumer-design.css"><link rel="stylesheet" href="/site-life-wallet.css"><style>body{margin:0;padding:16px;background:var(--lotbi-bg-primary,#fff)}#host{max-width:1120px;margin:0 auto}</style></head><body><main id="host" class="wallet-root"></main>';
const helpers = `
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const wait = async (predicate, label) => { for (let i = 0; i < 2400; i += 1) { const value = predicate(); if (value) return value; await sleep(25); } throw new Error('timed out ' + label); };
const shaped = (width, height, colour) => { const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; const context = canvas.getContext('2d'); context.fillStyle = colour || '#1f3b5a'; context.fillRect(0, 0, width, height); return canvas.toDataURL('image/png'); };
const loaded = async root => { for (let i = 0; i < 400 && ![...root.querySelectorAll('img')].every(image => image.complete && image.naturalWidth); i += 1) await sleep(25); await sleep(200); };
`;

const listFixture = head + `<script type="module">
${helpers}
try {
  // Timers of 30 s (a picture shown on a press) are kept so the test can run them now.
  const realSetTimeout = window.setTimeout.bind(window); const timers = [];
  window.setTimeout = (fn, ms, ...rest) => { const id = realSetTimeout(fn, ms, ...rest); if (ms === 30000) timers.push(fn); return id; };
  const {createWalletItems, walletItemCategory, walletItemTitles, readWalletViewState, writeWalletViewState} = await import('/site-life-wallet.js?test=items-list');
  const cards = [
    {id:'one', kind:'document', category:'identity', name:'첫 자료', note:'', updatedAt:'2026-10-05T12:00:00.000Z', frontDataUrl:shaped(1012,638)},
    {id:'two', kind:'document', category:'business-card', name:'둘째 자료', note:'거래처 김 대리', updatedAt:'2026-10-04T12:00:00.000Z', frontDataUrl:shaped(1012,638,'#5a1f3b')},
    {id:'three', kind:'certificate', name:'셋째 자료', note:'', updatedAt:'2026-10-03T12:00:00.000Z', frontDataUrl:shaped(734,1024,'#3b5a1f')},
    {id:'four', kind:'membership', name:'넷째 자료', note:'', updatedAt:'2026-10-02T12:00:00.000Z', frontDataUrl:shaped(1012,638,'#5a3b1f')},
    {id:'five', kind:'document', name:'주민등록증', note:'', updatedAt:'2026-10-01T12:00:00.000Z', frontDataUrl:shaped(1012,638,'#234')},
    {id:'six', kind:'document', category:'business-card', name:'저장 자료', note:'', updatedAt:'2026-09-30T12:00:00.000Z', frontDataUrl:shaped(1012,638,'#432')},
  ];
  const stateLog = []; const opened = []; const added = [];
  const list = createWalletItems({cards, onOpen: (card, title) => opened.push(card.id + ':' + title), onAdd: kind => added.push(kind), onStateChange: state => stateLog.push(state)});
  document.getElementById('host').append(list); await loaded(list);
  const ids = () => [...list.querySelectorAll('.wallet-grid > [data-wallet-item]')].map(item => item.dataset.walletItem);
  const chips = () => [...list.querySelectorAll('[data-wallet-filter]')].map(chip => chip.textContent + (chip.getAttribute('aria-pressed') === 'true' ? '*' : ''));
  const count = () => list.querySelector('.wallet-list-count').textContent;
  const grid = list.querySelector('.wallet-grid');
  const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
  const firstItem = list.querySelector('[data-wallet-item]');
  const photos = [...list.querySelectorAll('.wallet-item-photo')];
  const first = {ids:ids(), chips:chips(), count:count(), columns, row:getComputedStyle(firstItem).flexDirection,
    masked:photos.every(photo => photo.dataset.masked === 'true' && getComputedStyle(photo).filter.includes('blur')),
    titles:[...walletItemTitles(cards)].map(([id, title]) => id + ':' + title),
    categories:Object.fromEntries(cards.map(card => [card.id, walletItemCategory(card)]))};

  // A press shows one picture; 30 seconds later it is blurred again.
  const thumb = firstItem.querySelector('[data-wallet-item-reveal]'); thumb.click();
  const shown = firstItem.querySelector('.wallet-item-photo').dataset.masked === 'false' && thumb.getAttribute('aria-pressed') === 'true';
  timers.splice(0).forEach(fn => fn());
  const reveal = {shown, maskedAgain:firstItem.querySelector('.wallet-item-photo').dataset.masked === 'true', othersMasked:photos.slice(1).every(photo => photo.dataset.masked === 'true'), openedByThumb:opened.length};

  list.querySelector('[data-wallet-item="two"] [data-wallet-item-open]').click();
  const sortSelect = list.querySelector('[data-wallet-sort]');
  sortSelect.value = 'title'; sortSelect.dispatchEvent(new Event('change')); const byTitle = ids();
  sortSelect.value = 'kind'; sortSelect.dispatchEvent(new Event('change')); const byKind = ids();
  sortSelect.value = 'recent'; sortSelect.dispatchEvent(new Event('change'));

  list.querySelector('[data-wallet-filter="business-card"]').click();
  const business = {ids:ids(), count:count(), chips:chips()};
  list.querySelector('[data-wallet-filter="all"]').click();

  const search = list.querySelector('[data-wallet-search]');
  search.value = '김 대리'; search.dispatchEvent(new Event('input')); await sleep(250);
  const byMemo = {ids:ids(), count:count()};
  search.value = '셋째'; search.dispatchEvent(new Event('input')); await sleep(250);
  const byTitleSearch = ids();
  search.value = '없는말'; search.dispatchEvent(new Event('input')); await sleep(250);
  const noMatch = list.querySelector('[data-wallet-empty]');
  const searchEmpty = {kind:noMatch?.dataset.walletEmpty, text:noMatch?.textContent || '', gridHidden:grid.hidden};
  [...noMatch.querySelectorAll('button')].find(button => button.textContent === '검색어 지우기').click();
  const cleared = ids().length;
  list.querySelector('.wallet-add-action').click();

  const identityOnly = createWalletItems({cards:[cards[0]], onOpen:() => {}, onAdd: kind => added.push('kind:' + kind)});
  document.getElementById('host').append(identityOnly);
  identityOnly.querySelector('[data-wallet-filter="business-card"]').click();
  const kindBox = identityOnly.querySelector('[data-wallet-empty]');
  const kindEmpty = {kind:kindBox?.dataset.walletEmpty, title:kindBox?.querySelector('h3')?.textContent, hint:kindBox?.querySelector('.wallet-kind-hint strong')?.textContent};
  [...kindBox.querySelectorAll('button')].find(button => button.textContent === '명함 넣기').click();
  const restoredFilter = createWalletItems({cards, onOpen:() => {}, initialFilter:'document'});
  const missingFilter = createWalletItems({cards:[cards[0]], onOpen:() => {}, initialFilter:'business-card'});

  const memory = new Map(); const storage = {getItem:key => memory.get(key) || null, setItem:(key, value) => memory.set(key, value)};
  const stored = writeWalletViewState(storage, 'view', {filter:'business-card', selectedId:'two', query:'김', frontDataUrl:'secret'});
  const storedRaw = memory.get('view');
  const restored = readWalletViewState(storage, 'view');
  storage.setItem('bad', '{"filter":"secret","selectedId":"../pin"}');
  const invalid = readWalletViewState(storage, 'bad');
  window.__result = JSON.stringify({ok:true, first, reveal, opened, byTitle, byKind, business, byMemo, byTitleSearch, searchEmpty, cleared, added, kindEmpty,
    restoredFilter:restoredFilter.querySelector('[data-wallet-filter][aria-pressed="true"]').dataset.walletFilter,
    missingFilter:missingFilter.querySelector('[data-wallet-filter][aria-pressed="true"]').dataset.walletFilter,
    stored, storedRaw, restored, invalid, stateLog, overflow:document.documentElement.scrollWidth > innerWidth});
} catch (error) { window.__result = JSON.stringify({ok:false, error:String(error?.stack || error)}); }
</script></body></html>`;

const integrationFixture = head + `<script type="module">
${helpers}
try {
  const {mountLifeWallet, LifeWalletVault, IndexedDbWalletRepository, accountScope} = await import('/site-life-wallet.js?test=items-integration');
  const root = document.getElementById('host'); root.classList.remove('wallet-root'); const accountId = 'items-list-' + Date.now();
  const mounted = mountLifeWallet({root, authenticated:true, accountId});
  const tokensOn = root.classList.contains('wallet-root');
  const setup = await wait(() => root.querySelector('form.wallet-pin-form:not(.wallet-unlock-form)'), 'setup'); const inputs = setup.querySelectorAll('input'); inputs[0].value = '1357'; inputs[1].value = '1357'; setup.requestSubmit();
  await wait(() => [...root.querySelectorAll('button')].find(button => button.textContent === '잠그기'), 'open');
  const store = new LifeWalletVault(new IndexedDbWalletRepository()); await store.unlock(accountId, '1357');
  await store.save(accountId, {id:'first', kind:'document', category:'identity', name:'첫 자료', note:'', updatedAt:'2026-10-01T12:00:00.000Z', frontDataUrl:shaped(1012,638)});
  await store.save(accountId, {id:'second', kind:'document', category:'business-card', name:'둘째 자료', note:'', updatedAt:'2026-09-01T12:00:00.000Z', frontDataUrl:shaped(1012,638)});
  const key = 'lotbi-life-wallet-view-v1:' + (await accountScope(accountId)); localStorage.setItem(key, JSON.stringify({filter:'business-card', selectedId:''}));
  [...root.querySelectorAll('button')].find(button => button.textContent === '잠그기').click();
  const unlock = await wait(() => root.querySelector('.wallet-unlock-form'), 'unlock'); unlock.querySelector('input').value = '1357'; unlock.requestSubmit();
  await wait(() => root.querySelector('[data-wallet-item]'), 'restored list'); await loaded(root);
  const restored = {filter:root.querySelector('[data-wallet-filter][aria-pressed="true"]').dataset.walletFilter, ids:[...root.querySelectorAll('.wallet-grid > [data-wallet-item]')].map(item => item.dataset.walletItem)};
  const tabs = [...root.querySelectorAll('[data-wallet-tab]')].map(tab => tab.dataset.walletTab + ':' + tab.getAttribute('aria-selected'));
  const toolbar = {add:root.querySelector('.wallet-add-action')?.innerText.replace(/\\s+/gu, ' ').trim() || '', lock:root.querySelector('.wallet-toolbar-icon-action')?.textContent.trim() || '', settings:root.querySelector('.wallet-settings > button')?.textContent.trim() || '',
    icons:root.querySelectorAll('.wallet-toolbar-icon-action svg').length, lifeHidden:root.querySelector('[data-wallet-panel="life"]').hidden, visibleStorageCopy:Boolean(root.querySelector('.wallet-storage-reassurance')),
    addBlue:getComputedStyle(root.querySelector('.wallet-add-action')).backgroundColor};

  // 설정 is its own screen; 'Life Wallet' goes back.
  root.querySelector('[data-wallet-settings-open]').click();
  const settings = await wait(() => root.querySelector('[data-wallet-view="settings"]'), 'settings');
  const settingsRows = [...settings.querySelectorAll('[data-wallet-settings]')].map(row => row.dataset.walletSettings);
  [...settings.querySelectorAll('button')].find(button => button.textContent.trim() === 'Life Wallet').click();
  await wait(() => root.querySelector('[data-wallet-item]'), 'back from settings');

  // The item page and 종류 바꾸기 (a dialog; the picture is not uploaded again).
  root.querySelector('[data-wallet-item="second"] [data-wallet-item-open]').click();
  const detail = await wait(() => root.querySelector('[data-wallet-view="detail"]'), 'detail');
  const page = {title:detail.querySelector('h3').textContent, badge:detail.querySelector('.wallet-detail-header .wallet-kind-badge').textContent, back:detail.querySelector('[data-subview-back]')?.textContent.trim()};
  detail.querySelector('[data-wallet-kind-change]').click();
  const dialog = await wait(() => root.querySelector('.wallet-dialog'), 'kind dialog');
  const labels = [...dialog.querySelectorAll('.wallet-kind-option b')].map(label => label.textContent);
  const now = dialog.querySelector('.wallet-kind-option:has(.wallet-kind-now) input')?.value;
  dialog.querySelector('input[value="document"]').click(); dialog.requestSubmit();
  const after = await wait(() => root.querySelector('[data-wallet-view="detail"] .wallet-toast'), 'kind saved');
  const saved = (await store.list(accountId)).find(card => card.id === 'second');
  const kindChange = {labels, now, toast:after.textContent, badge:root.querySelector('.wallet-detail-header .wallet-kind-badge').textContent, category:saved.category, updatedAt:saved.updatedAt, dialogGone:!root.querySelector('.wallet-dialog')};
  [...root.querySelectorAll('button')].find(button => button.textContent.trim() === '목록으로').click();
  await wait(() => root.querySelector('[data-wallet-item]'), 'back to list');
  const afterBack = root.querySelector('[data-wallet-filter][aria-pressed="true"]').dataset.walletFilter;

  // 자료 추가: four kinds, none chosen, saving waits for a picture.
  root.querySelector('.wallet-add-action').click();
  const add = await wait(() => root.querySelector('[data-wallet-view="add"]'), 'add');
  const addForm = {kinds:[...add.querySelectorAll('input[name="wallet-category"]')].map(input => input.value), checked:add.querySelectorAll('input[name="wallet-category"]:checked').length,
    saveDisabled:add.querySelector('.wallet-add-save').disabled, reason:add.querySelector('.wallet-reason').textContent, step:add.dataset.step};
  const viewState = JSON.parse(localStorage.getItem(key));
  mounted.dispose();
  window.__result = JSON.stringify({ok:true, tokensOn, tokensOffAfter:!root.classList.contains('wallet-root'), restored, tabs, toolbar, settingsRows, page, kindChange, afterBack, addForm, viewState});
} catch (error) { window.__result = JSON.stringify({ok:false, error:String(error?.stack || error)}); }
</script></body></html>`;

const KO_TITLES = {one:'첫 자료', two:'둘째 자료', three:'셋째 자료', four:'넷째 자료', five:'주민등록증', six:'명함 1'};
const byTitleExpected = Object.keys(KO_TITLES).sort((left, right) => KO_TITLES[left].localeCompare(KO_TITLES[right], 'ko'));
const run = (fixtureHtml, viewport, name) => runFixturePage({root:ROOT, fixturePath:`/__life_wallet_items_${name}.html`, fixtureHtml, viewport, timeoutMs:600000, resultExpression:'window.__result || ""'});
for (const viewport of [{width:1200,height:900}, {width:820,height:900}, {width:412,height:900,mobile:true}, {width:360,height:800,mobile:true}]) {
  const result = await run(listFixture, viewport, `list_${viewport.width}`); assert.equal(result.ok, true, result.error); const text = `${viewport.width}px ${JSON.stringify(result)}`;
  assert.deepEqual(result.first.ids, ['one', 'two', 'three', 'four', 'five', 'six'], `newest first: ${text}`);
  assert.deepEqual(result.first.chips, ['전체6*', '신분증2', '명함2', '증명서·문서1', '기타1'], `kind chips with counts: ${text}`);
  assert.equal(result.first.count, '자료 6개', text);
  assert.deepEqual(result.first.categories, {one:'identity', two:'business-card', three:'document', four:'other', five:'identity', six:'business-card'}, `legacy mapping: ${text}`);
  assert.deepEqual(result.first.titles, ['six:명함 1', 'five:주민등록증', 'four:넷째 자료', 'three:셋째 자료', 'two:둘째 자료', 'one:첫 자료'], `an item without a title is its kind and number: ${text}`);
  assert.equal(result.first.columns, viewport.width > 1100 ? 4 : viewport.width > 600 ? 2 : 1, `grid on a wide screen, rows on a phone: ${text}`);
  if (viewport.width <= 600) assert.equal(result.first.row, 'row', text);
  assert.equal(result.first.masked, true, `pictures are blurred in the list: ${text}`);
  assert.deepEqual(result.reveal, {shown:true, maskedAgain:true, othersMasked:true, openedByThumb:0}, `a press shows one picture for 30 seconds: ${text}`);
  assert.deepEqual(result.opened, ['two:둘째 자료'], text);
  assert.deepEqual(result.byTitle, byTitleExpected, text);
  assert.deepEqual(result.byKind, ['one', 'five', 'two', 'six', 'three', 'four'], text);
  assert.deepEqual(result.business, {ids:['two', 'six'], count:'명함 2개', chips:['전체6', '신분증2', '명함2*', '증명서·문서1', '기타1']}, text);
  assert.deepEqual(result.byMemo, {ids:['two'], count:'‘김 대리’ 결과 1개'}, `search reads the memo: ${text}`);
  assert.deepEqual(result.byTitleSearch, ['three'], text);
  assert.equal(result.searchEmpty.kind, 'search', text); assert.ok(result.searchEmpty.text.includes('사진 속 글자는 찾지 않아요'), text); assert.equal(result.searchEmpty.gridHidden, true, text);
  assert.equal(result.cleared, 6, text);
  assert.deepEqual(result.added, ['', 'kind:business-card'], text);
  assert.deepEqual(result.kindEmpty, {kind:'kind', title:'명함이 아직 없어요', hint:'명함을 다른 종류로 넣었나요?'}, text);
  assert.equal(result.restoredFilter, 'document', text); assert.equal(result.missingFilter, 'all', text);
  assert.equal(result.stored, true, text); assert.equal(result.storedRaw, '{"filter":"business-card","selectedId":"two"}', `only the filter and an opaque id are kept: ${text}`);
  assert.deepEqual(result.restored, {filter:'business-card', selectedId:'two'}, text); assert.deepEqual(result.invalid, {filter:'all', selectedId:''}, text);
  assert.deepEqual(result.stateLog, [{filter:'business-card', selectedId:''}, {filter:'all', selectedId:''}], text);
  assert.equal(result.overflow, false, text);
}

for (const [name, viewport, addLabel] of [['mobile', {width:390,height:844,mobile:true}, '추가'], ['desktop', {width:1200,height:900}, '자료 추가']]) {
  const integration = await run(integrationFixture, viewport, `integration_${name}`); assert.equal(integration.ok, true, integration.error); const text = JSON.stringify(integration);
  assert.equal(integration.tokensOn, true, `the wallet root carries the wallet tokens: ${text}`);
  assert.equal(integration.tokensOffAfter, true, `and gives them back when the wallet closes: ${text}`);
  assert.deepEqual(integration.restored, {filter:'business-card', ids:['second']}, text);
  assert.deepEqual(integration.tabs, ['items:true', 'life:false'], text);
  assert.deepEqual(integration.toolbar, {add:addLabel, lock:'잠그기', settings:'설정', icons:2, lifeHidden:true, visibleStorageCopy:false, addBlue:'rgb(37, 99, 235)'}, text);
  assert.deepEqual(integration.settingsRows, ['pin', 'backup', 'import'], text);
  assert.deepEqual(integration.page, {title:'둘째 자료', badge:'명함', back:'목록으로'}, text);
  assert.deepEqual(integration.kindChange, {labels:['신분증', '명함', '증명서·문서', '기타'], now:'business-card', toast:'증명서·문서로 바꿨어요.', badge:'증명서·문서', category:'document', updatedAt:'2026-09-01T12:00:00.000Z', dialogGone:true}, `the kind changes without uploading again, and the 등록일 stays: ${text}`);
  assert.equal(integration.afterBack, 'all', `no 명함 left: the list falls back to 전체: ${text}`);
  assert.deepEqual(integration.addForm, {kinds:['identity', 'business-card', 'document', 'other'], checked:0, saveDisabled:true, reason:'자료 사진을 골라 주세요', step:'start'}, text);
  assert.deepEqual(Object.keys(integration.viewState), ['filter', 'selectedId'], text);
}
console.log('LIFE_WALLET_ITEMS_LIST (REDESIGN-02) PASS — desktop/tablet/mobile list, kind chips, search (title·memo), sorts, blurred pictures, empty states, local view state, tabs, settings screen, item page, kind change, wallet tokens');
