import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');
const coreText = read('site-core.js');
const conversation = read('site-conversation.js');
const css = read('site-conversation.css');

const {
  getProductCards,
  reviewProductCard,
  searchProductCards,
  searchPublicProductCards,
} = await import('../site-core.js');

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {'Content-Type': 'application/json'},
});

{
  let request;
  const publicResult = await searchPublicProductCards({query: 'RAD RA'}, async (url, init) => {
    request = {url, init};
    return jsonResponse({
      contract_id: 'CORE-PUBLIC-RICH-PRODUCT-DISCOVERY-01',
      schema_version: 1,
      display_id: 'pdc_' + 'a'.repeat(24),
      status: 'DISPLAY_READY',
      query: 'RAD RA',
      merchant: {code: 'RAD_GODOMALL', name: 'RAD 전주본점 / Godomall'},
      source_mode: 'GODOMALL_STOREFRONT',
      candidate_count: 1,
      cards: [{
        candidate_index: 0,
        merchant_code: 'RAD_GODOMALL',
        source: 'GODOMALL_STOREFRONT',
        title: 'RAD RA',
        price: 1650000,
        currency: 'KRW',
        available: true,
        product_url: 'https://www.carcarerad.com/goods/goods_view.php?goodsNo=1000000093',
        image_url: 'https://merchant.example/product.jpg',
      }],
      display_evidence: true,
      purchase_requires_login: true,
      selection_available: false,
      external_side_effect: false,
      execution_authority: false,
      transaction_created: false,
      order_created: false,
      payment_attempted: false,
      live_money: false,
    });
  });
  assert.equal(publicResult.cards.length, 1);
  assert.equal(publicResult.purchaseRequiresLogin, true);
  assert.equal(request.init.method, 'GET');
  assert.equal(request.init.credentials, 'omit');
  assert.deepEqual(request.init.headers, {});
  assert.match(request.url, /^https:\/\/api\.lotbiai\.com\/v2\/public\/product-cards\/search\?/);
}

{
  const requests = [];
  const fetchMock = async (url, init) => {
    requests.push({url, init});
    if (url.endsWith('/v2/product-resolutions/search')) return jsonResponse({
      contract_id: 'CORE-RICH-PRODUCT-DISCOVERY-01',
      schema_version: 1,
      command_id: 'cmd_richcards1',
      resolution_id: 'prs_richcards1',
      resolution_hash: 'b'.repeat(64),
      status: 'AMBIGUOUS',
      merchant: {code: 'RAD_GODOMALL', name: 'RAD 전주본점 / Godomall'},
      source_mode: 'GODOMALL_STOREFRONT',
      candidate_count: 1,
      cards_path: '/v2/product-resolutions/prs_richcards1/cards',
      display_evidence: true,
      external_side_effect: false,
      execution_authority: false,
      live_money: false,
    });
    if (url.endsWith('/v2/product-resolutions/prs_richcards1/cards')) return jsonResponse({
      contract_id: 'CORE-SHOP-UI-01A',
      schema_version: 1,
      resolution_id: 'prs_richcards1',
      resolution_hash: 'b'.repeat(64),
      status: 'AMBIGUOUS',
      query: 'RAD RA',
      source_mode: 'GODOMALL_STOREFRONT',
      expired: false,
      cards: [{
        candidate_index: 0,
        merchant_code: 'RAD_GODOMALL',
        source: 'GODOMALL_STOREFRONT',
        title: 'RAD RA',
        price: 1650000,
        currency: 'KRW',
        available: true,
      }],
      external_side_effect: false,
      execution_authority: false,
    });
    if (url.endsWith('/v2/product-resolutions/prs_richcards1/review')) return jsonResponse({
      contract_id: 'CORE-RICH-PRODUCT-REVIEW-01',
      schema_version: 1,
      resolution_id: 'prs_richcards1',
      resolution_hash: 'b'.repeat(64),
      candidate_index: 0,
      merchant: {code: 'RAD_GODOMALL', name: 'RAD 전주본점 / Godomall'},
      card: {
        candidate_index: 0,
        merchant_code: 'RAD_GODOMALL',
        source: 'GODOMALL_STOREFRONT',
        title: 'RAD RA',
        price: 1650000,
        currency: 'KRW',
        available: true,
      },
      price_changed: false,
      review_required: true,
      next_step: 'EXPLICIT_PURCHASE_REVIEW_REQUIRED',
      external_side_effect: false,
      execution_authority: false,
      transaction_created: false,
      order_created: false,
      payment_attempted: false,
      live_money: false,
    });
    throw new Error('unexpected URL ' + url);
  };

  const found = await searchProductCards('site-memory-token', {
    query: 'RAD RA',
    originalText: 'RAD RA 찾아줘',
    maxResults: 6,
  }, fetchMock);
  const cards = await getProductCards('site-memory-token', found.resolutionId, fetchMock);
  const review = await reviewProductCard('site-memory-token', {
    resolutionId: found.resolutionId,
    resolutionHash: found.resolutionHash,
    candidateIndex: 0,
  }, fetchMock);
  assert.equal(cards.cards.length, 1);
  assert.equal(review.card.price, 1650000);
  assert.equal(requests.length, 3);
  assert.equal(requests[0].init.headers.Authorization, 'Bearer site-memory-token');
  assert.equal(requests[2].init.method, 'POST');
}

for (const token of [
  "const PRODUCT_CARD_SEARCH_PATH = '/v2/product-resolutions/search'",
  "const PUBLIC_PRODUCT_CARD_SEARCH_PATH = '/v2/public/product-cards/search'",
  'export async function searchPublicProductCards',
  'export async function searchProductCards',
  'export async function getProductCards',
  'export async function reviewProductCard',
  "payload.contract_id !== 'CORE-PUBLIC-RICH-PRODUCT-DISCOVERY-01'",
  "payload.contract_id !== 'CORE-RICH-PRODUCT-DISCOVERY-01'",
  "payload.contract_id !== 'CORE-SHOP-UI-01A'",
  "payload.contract_id !== 'CORE-RICH-PRODUCT-REVIEW-01'",
  'payload.transaction_created !== false',
  'payload.order_created !== false',
  'payload.payment_attempted !== false',
  'payload.live_money !== false',
]) assert.ok(coreText.includes(token), 'missing Rich Card client contract: ' + token);

for (const token of [
  'searchPublicProductCards',
  'searchProductCards',
  'getProductCards',
  'reviewProductCard',
  'compactRichProductMeta',
  'createProductCardRail',
  "response.intent?.action === 'PURCHASE'",
  "rail.dataset.richCardType = 'PRODUCT'",
  "box.dataset.lotbiBoxToggleKey = lotbiBoxItemKey(rich, card)",
  "box.setAttribute('aria-pressed', String(saved))",
  "refreshLotbiBoxControls()",
  "buy.textContent = '구매하기'",
  "await beginGuestClaimingSiteHandoff(rich.originalText || rich.query || card.title)",
  '아직 주문·결제는 실행하지 않았습니다.',
  "type: 'PRODUCT'",
  'display_id: rich.displayId',
  'resolution_hash: rich.resolutionHash',
]) assert.ok(conversation.includes(token), 'missing Product Rich Card behavior: ' + token);

for (const forbidden of ['/orders', '/payments', '/reservations', '/execute', '/select']) {
  assert.ok(!conversation.includes(forbidden), 'Site Rich Card runtime must not invoke execution endpoint: ' + forbidden);
}

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

const foldPeekRule = css.match(/@media \(max-width: 360px\) \{[\s\S]*?\.lotbi-rich-card-rail \{[\s\S]*?grid-auto-columns:\s*minmax\(196px, 62vw\);[\s\S]*?\}[\s\S]*?\}/)?.[0] || '';
assert.ok(foldPeekRule, 'Fold cover must narrow cards enough to keep the next candidate visibly peeking');

assert.ok(!conversation.includes('http://'));
assert.ok(conversation.includes("card.product_url.startsWith('https://')"));
assert.ok(conversation.includes("card.image_url.startsWith('https://')"));

console.log('SITE UNIVERSAL RICH PRODUCT CARDS 01 CONTRACT PASS');
