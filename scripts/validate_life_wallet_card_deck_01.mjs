// LIFE-WALLET-VERTICAL-DECK-01
// Synthetic-only verification: category filters, vertical/wrapping deck, local view state,
// encrypted category editing, and the bottom 생활정보 area.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runFixturePage} from './lib/headless-fixture-result.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const head = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/site-consumer-design.css"><link rel="stylesheet" href="/site-life-wallet.css"><style>body{margin:0;padding:16px;background:var(--lotbi-bg-primary,#fff)}#host{max-width:720px;margin:0 auto}</style></head><body><main id="host"></main>';
const helpers = `
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const wait = async (predicate, label) => { for (let i = 0; i < 2400; i += 1) { const value = predicate(); if (value) return value; await sleep(25); } throw new Error('timed out ' + label); };
const shaped = (width, height, colour) => { const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; const context = canvas.getContext('2d'); context.fillStyle = colour || '#1f3b5a'; context.fillRect(0, 0, width, height); return canvas.toDataURL('image/png'); };
const loaded = async root => { for (let i = 0; i < 400 && ![...root.querySelectorAll('img')].every(image => image.complete && image.naturalWidth); i += 1) await sleep(25); await sleep(350); };
`;

const deckFixture = head + `<script type="module">
${helpers}
try {
  const {createWalletCardDeck, walletItemCategory, readWalletViewState, writeWalletViewState} = await import('/site-life-wallet.js?test=vertical-deck');
  const at = '2026-10-01T12:00:00.000Z';
  const cards = [
    {id:'one', kind:'document', category:'identity', name:'첫 자료', note:'', updatedAt:at, frontDataUrl:shaped(1012,638)},
    {id:'two', kind:'document', category:'business-card', name:'둘째 자료', note:'', updatedAt:at, frontDataUrl:shaped(1012,638,'#5a1f3b')},
    {id:'three', kind:'certificate', name:'셋째 자료', note:'', updatedAt:at, frontDataUrl:shaped(734,1024,'#3b5a1f')},
    {id:'four', kind:'membership', name:'넷째 자료', note:'', updatedAt:at, frontDataUrl:shaped(1012,638,'#5a3b1f')},
    {id:'five', kind:'document', name:'주민등록증', note:'', updatedAt:at, frontDataUrl:shaped(1012,638,'#234')},
  ];
  const stateLog = []; const opened = [];
  const deck = createWalletCardDeck({cards, onOpen: card => opened.push(card.id), onStateChange: state => stateLog.push(state)});
  document.getElementById('host').append(deck); await loaded(deck);
  const stage = deck.querySelector('.wallet-deck');
  const front = () => deck.querySelector('.wallet-deck-card[data-depth="0"]');
  const position = () => deck.querySelector('.wallet-card-position').textContent;
  const filters = () => [...deck.querySelectorAll('[data-wallet-deck-filter]')].map(button => button.textContent + (button.getAttribute('aria-pressed') === 'true' ? '*' : ''));
  const rect = node => node.getBoundingClientRect();
  const firstFrontRect = rect(front());
  const stack = [...deck.querySelectorAll('.wallet-deck-card')].filter(card => [1,2,3].includes(Number(card.dataset.depth))).sort((a,b) => Number(a.dataset.depth)-Number(b.dataset.depth)).map(card => ({id:card.dataset.walletDeckCard, depth:Number(card.dataset.depth), top:rect(card).top-firstFrontRect.top, label:card.querySelector('.wallet-deck-peek-label').textContent, z:Number(getComputedStyle(card).zIndex)}));
  const first = {front:front().dataset.walletDeckCard, position:position(), positionVisible:getComputedStyle(deck.querySelector('.wallet-card-position')).position!=='absolute', hint:deck.querySelector('.wallet-deck-gesture-hint')?.textContent||'', filters:filters(), stack, touchAction:getComputedStyle(stage).touchAction, imageTransform:getComputedStyle(front().querySelector('img')).transform, categories:Object.fromEntries(cards.map(card => [card.id,walletItemCategory(card)])), dots:deck.querySelectorAll('[data-wallet-carousel-dot]').length, detailWidth:Math.round(rect(deck.querySelector('.wallet-deck-open')).width), deckWidth:Math.round(rect(deck).width), detailBackground:getComputedStyle(deck.querySelector('.wallet-deck-open')).backgroundColor, activeFilterBackground:getComputedStyle(deck.querySelector('[aria-pressed="true"]')).backgroundColor};

  stage.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true})); await sleep(300);
  const wrapUp = {front:front().dataset.walletDeckCard, position:position(), stack:stack.length};
  stage.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true})); await sleep(300);
  const wrapBack = front().dataset.walletDeckCard;

  const frontRect = rect(front()); const x=frontRect.left+frontRect.width/2; const y=frontRect.top+frontRect.height/2;
  front().querySelector('img').dispatchEvent(new PointerEvent('pointerdown',{pointerId:7,pointerType:'mouse',button:0,clientX:x,clientY:y,bubbles:true}));
  window.dispatchEvent(new PointerEvent('pointermove',{pointerId:7,pointerType:'mouse',buttons:1,clientX:x,clientY:y-160,bubbles:true}));
  const dragging = stage.dataset.dragging === 'true' && front().style.transform.includes('translateY') && !front().style.transform.includes('rotate');
  window.dispatchEvent(new PointerEvent('pointerup',{pointerId:7,pointerType:'mouse',button:0,clientX:x,clientY:y-160,bubbles:true})); await sleep(350);
  const drag = {front:front().dataset.walletDeckCard,position:position(),opened:opened.join(',')};

  deck.querySelector('.wallet-deck-card[data-depth="1"]').click(); await sleep(300);
  const peek = {front:front().dataset.walletDeckCard,opened:opened.join(',')};
  stage.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
  stage.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true})); await sleep(300);
  stage.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true})); await sleep(300);
  const lastToFirst = front().dataset.walletDeckCard;
  stage.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true})); await sleep(300);
  const firstToLast = front().dataset.walletDeckCard;

  deck.querySelector('[data-wallet-deck-filter="business-card"]').click(); await sleep(250);
  const business = {front:front().dataset.walletDeckCard,position:position(),filters:filters()};
  deck.querySelector('[data-wallet-deck-filter="document"]').click(); await sleep(250);
  const documentOnly = {front:front().dataset.walletDeckCard,position:position()};

  const identityOnly = createWalletCardDeck({cards:[cards[0]],onOpen:()=>{}}); document.getElementById('host').append(identityOnly); await loaded(identityOnly);
  identityOnly.querySelector('[data-wallet-deck-filter="business-card"]').click();
  const emptyFilter = {empty:!identityOnly.querySelector('.wallet-deck-filter-empty').hidden,deckHidden:identityOnly.querySelector('.wallet-deck').hidden,infoHidden:identityOnly.querySelector('.wallet-deck-info').hidden};
  const deleted = createWalletCardDeck({cards:[cards[0]],onOpen:()=>{},initialSelectedId:'deleted',initialFilter:'all'}); document.getElementById('host').append(deleted); await loaded(deleted);

  const memory = new Map(); const storage={getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value)};
  const stored = writeWalletViewState(storage,'view',{filter:'business-card',selectedId:'two'});
  const restored = readWalletViewState(storage,'view');
  storage.setItem('bad','{"filter":"secret","selectedId":"../pin"}');
  const invalid = readWalletViewState(storage,'bad');
  window.__result=JSON.stringify({ok:true,first,wrapUp,wrapBack,dragging,drag,peek,lastToFirst,firstToLast,business,documentOnly,emptyFilter,deletedFront:deleted.querySelector('.wallet-deck-card[data-depth="0"]').dataset.walletDeckCard,stored,restored,invalid,stateLog,overflow:document.documentElement.scrollWidth>innerWidth});
} catch(error){window.__result=JSON.stringify({ok:false,error:String(error?.stack||error)});}
</script></body></html>`;

const integrationFixture = head + `<script type="module">
${helpers}
try {
  const {mountLifeWallet,LifeWalletVault,IndexedDbWalletRepository,accountScope} = await import('/site-life-wallet.js?test=vertical-deck-integration');
  const root=document.getElementById('host'); const accountId='vertical-deck-'+Date.now();
  mountLifeWallet({root,authenticated:true,accountId});
  const setup=await wait(()=>root.querySelector('form.wallet-pin-form:not(.wallet-unlock-form)'),'setup'); const inputs=setup.querySelectorAll('input'); inputs[0].value='1357'; inputs[1].value='1357'; setup.requestSubmit();
  await wait(()=>[...root.querySelectorAll('button')].find(button=>button.textContent==='잠그기'),'open');
  const store=new LifeWalletVault(new IndexedDbWalletRepository()); await store.unlock(accountId,'1357'); const at='2026-10-01T12:00:00.000Z';
  await store.save(accountId,{id:'first',kind:'document',category:'identity',name:'첫 자료',note:'',updatedAt:at,frontDataUrl:shaped(1012,638)});
  await store.save(accountId,{id:'second',kind:'document',category:'business-card',name:'둘째 자료',note:'',updatedAt:'2026-09-01T12:00:00.000Z',frontDataUrl:shaped(1012,638)});
  const key='lotbi-life-wallet-view-v1:'+(await accountScope(accountId)); localStorage.setItem(key,JSON.stringify({filter:'business-card',selectedId:'second'}));
  [...root.querySelectorAll('button')].find(button=>button.textContent==='잠그기').click(); const unlock=await wait(()=>root.querySelector('.wallet-unlock-form'),'unlock'); unlock.querySelector('input').value='1357'; unlock.requestSubmit();
  const face=await wait(()=>root.querySelector('.wallet-deck-card[data-depth="0"]'),'restored deck'); await loaded(root);
  const restored={front:face.dataset.walletDeckCard,filter:root.querySelector('[data-wallet-deck-filter][aria-pressed="true"]').dataset.walletDeckFilter};
  const toolbar={add:root.querySelector('.wallet-add-action')?.innerText.trim()||'',lock:root.querySelector('.wallet-toolbar-icon-action')?.textContent.trim()||'',settings:root.querySelector('.wallet-settings > button')?.textContent.trim()||'',icons:root.querySelectorAll('.wallet-toolbar-icon-action svg').length,topShare:root.querySelector('.wallet-toolbar > [data-wallet-share-open]')!==null,visibleStorageCopy:root.querySelector('.wallet-storage-reassurance')?.getClientRects().length>0};
  const shell=root.querySelector('.wallet-shell'); const life=root.querySelector('.wallet-life-info'); const order={deckBeforeLife:Boolean(shell.querySelector('.wallet-deck-shell')?.compareDocumentPosition(life)&Node.DOCUMENT_POSITION_FOLLOWING),title:life.querySelector('.wallet-life-info-title')?.textContent||'',lifeGap:parseFloat(getComputedStyle(life).marginTop)};
  face.click(); const detail=await wait(()=>root.querySelector('.wallet-detail'),'detail'); const labels=[...detail.querySelectorAll('[data-wallet-category-choice]')].map(button=>button.textContent); detail.querySelector('[data-wallet-category-choice="document"]').click(); await wait(()=>detail.querySelector('.wallet-detail-shape-status').textContent,'category save');
  const saved=(await store.list(accountId)).find(card=>card.id==='second'); const categoryStatus=detail.querySelector('.wallet-detail-shape-status').textContent;
  [...detail.querySelectorAll('button')].find(button=>button.textContent==='목록으로').click(); await wait(()=>root.querySelector('.wallet-deck-shell'),'back');
  const add=root.querySelector('.wallet-add-action'); add.click(); const select=await wait(()=>root.querySelector('select'),'add select'); const options=[...select.options].map(option=>option.textContent);
  window.__result=JSON.stringify({ok:true,restored,toolbar,order,labels,savedCategory:saved.category,categoryStatus,options,viewState:JSON.parse(localStorage.getItem(key))});
} catch(error){window.__result=JSON.stringify({ok:false,error:String(error?.stack||error)});}
</script></body></html>`;

const run=(fixtureHtml,viewport,name)=>runFixturePage({root:ROOT,fixturePath:`/__life_wallet_vertical_deck_${name}.html`,fixtureHtml,viewport,timeoutMs:600000,resultExpression:'window.__result || ""'});
const expectedFilters=['전체*','신분증','명함','증명서·문서','기타'];
for(const viewport of [{width:1200,height:900},{width:412,height:900,mobile:true},{width:360,height:800,mobile:true}]){
  const result=await run(deckFixture,viewport,`deck_${viewport.width}`); assert.equal(result.ok,true,result.error); const text=`${viewport.width}px ${JSON.stringify(result)}`;
  assert.equal(result.first.front,'one',text); assert.equal(result.first.position,'1 / 5',text); assert.deepEqual(result.first.filters,expectedFilters,text);
  assert.deepEqual(result.first.categories,{one:'identity',two:'business-card',three:'document',four:'other',five:'identity'},`legacy mapping: ${text}`);
  assert.equal(result.first.stack.length,3,text); result.first.stack.forEach((card,index)=>{assert.ok(card.top<-24*(index+1),text); assert.ok(card.label,text); assert.ok(card.z<5,text);});
  assert.equal(result.first.touchAction,'pan-x',text); assert.equal(result.first.imageTransform,'none',text); assert.equal(result.first.dots,0,text);
  assert.equal(result.first.positionVisible,true,text); assert.equal(result.first.hint,'↕ 위아래로 넘겨보세요',text); assert.ok(Math.abs(result.first.detailWidth-result.first.deckWidth)<=2,text);
  assert.equal(result.first.detailBackground,result.first.activeFilterBackground,`approved blue is shared by the active filter and detail button: ${text}`);
  assert.deepEqual(result.wrapUp,{front:'five',position:'5 / 5',stack:3},text); assert.equal(result.wrapBack,'one',text);
  assert.equal(result.dragging,true,text); assert.deepEqual(result.drag,{front:'two',position:'2 / 5',opened:''},text); assert.deepEqual(result.peek,{front:'three',opened:''},text);
  assert.equal(result.lastToFirst,'one',text); assert.equal(result.firstToLast,'five',text);
  assert.equal(result.business.front,'two',text); assert.equal(result.business.position,'1 / 1',text); assert.deepEqual(result.business.filters,['전체','신분증','명함*','증명서·문서','기타'],text);
  assert.deepEqual(result.documentOnly,{front:'three',position:'1 / 1'},text); assert.deepEqual(result.emptyFilter,{empty:true,deckHidden:true,infoHidden:true},text);
  assert.equal(result.deletedFront,'one',text); assert.equal(result.stored,true,text); assert.deepEqual(result.restored,{filter:'business-card',selectedId:'two'},text); assert.deepEqual(result.invalid,{filter:'all',selectedId:''},text);
  assert.equal(result.overflow,false,text);
}

for (const [name, viewport, addLabel] of [['mobile',{width:390,height:844,mobile:true},'+ 추가'],['desktop',{width:1200,height:900},'+ 자료 추가']]) {
  const integration=await run(integrationFixture,viewport,`integration_${name}`); assert.equal(integration.ok,true,integration.error); const integrationText=JSON.stringify(integration);
  assert.deepEqual(integration.restored,{front:'second',filter:'business-card'},integrationText);
  assert.deepEqual(integration.toolbar,{add:addLabel,lock:'잠그기',settings:'설정',icons:2,topShare:false,visibleStorageCopy:false},integrationText);
  assert.deepEqual(integration.order,{deckBeforeLife:true,title:'생활정보',lifeGap:24},integrationText);
  assert.deepEqual(integration.labels,['신분증','명함','증명서·문서','기타'],integrationText);
  assert.equal(integration.savedCategory,'document',integrationText); assert.equal(integration.categoryStatus,'증명서·문서로 옮겼습니다.',integrationText);
  assert.deepEqual(integration.options,['신분증','명함','증명서·문서','기타'],integrationText);
  assert.deepEqual(integration.viewState,{filter:'all',selectedId:'second'},`empty restored category safely falls back without losing the selected item: ${integrationText}`);
}
console.log('LIFE_WALLET_VERTICAL_DECK_01 PASS — desktop/mobile, categories, vertical wrap, local restore, encrypted category');
