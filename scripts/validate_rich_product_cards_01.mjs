import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

const core = read('site-core.js');
const conversation = read('site-conversation.js');
const css = read('site-conversation.css');

for (const token of [
  "const PRODUCT_CARD_SEARCH_PATH = '/v2/product-resolutions/search'",
  'export async function searchProductCards',
  'export async function getProductCards',
  'export async function reviewProductCard',
  "payload.contract_id !== 'CORE-RICH-PRODUCT-DISCOVERY-01'",
  "payload.contract_id !== 'CORE-SHOP-UI-01A'",
  "payload.contract_id !== 'CORE-RICH-PRODUCT-REVIEW-01'",
  'payload.external_side_effect !== false',
  'payload.execution_authority !== false',
  'payload.transaction_created !== false',
  'payload.order_created !== false',
  'payload.payment_attempted !== false',
  'payload.live_money !== false',
]) assert.ok(core.includes(token), 'missing Site rich-card client contract: ' + token);

for (const token of [
  'searchProductCards',
  'getProductCards',
  'reviewProductCard',
  'compactRichProductMeta',
  'createProductCardRail',
  "rail.dataset.richCardType = 'PRODUCT'",
  "detail.rel = 'noopener noreferrer'",
  "image.referrerPolicy = 'no-referrer'",
  "box.textContent = isInLotbiBox(rich, card) ? '✓ 롯비함' : '+ 롯비함'",
  "buy.textContent = '구매하기'",
  '아직 주문·결제는 실행하지 않았습니다.',
  "type: 'PRODUCT'",
  'resolution_hash: rich.resolutionHash',
  'candidate_index: card.candidate_index',
]) assert.ok(conversation.includes(token), 'missing Product Rich Card behavior: ' + token);

for (const forbidden of [
  '/orders',
  '/payments',
  '/reservations',
  '/execute',
  '/select',
]) assert.ok(!conversation.includes(forbidden), 'Rich Card Site client must not invoke execution endpoint: ' + forbidden);

for (const token of [
  '.lotbi-rich-card-rail',
  'grid-auto-flow: column',
  'overflow-x: auto',
  'scroll-snap-type: inline mandatory',
  '.lotbi-rich-card-image',
  '.lotbi-rich-card-actions',
  'min-height: 44px',
  '@media (max-width: 760px)',
]) assert.ok(css.includes(token), 'missing Rich Card responsive CSS contract: ' + token);

assert.ok(!conversation.includes('http://'), 'Rich Card runtime must not embed insecure product/image URLs');
assert.ok(conversation.includes("card.product_url.startsWith('https://')"));
assert.ok(conversation.includes("card.image_url.startsWith('https://')"));

console.log('SITE UNIVERSAL RICH PRODUCT CARDS 01 CONTRACT PASS');
