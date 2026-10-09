// ONNURI-IMPORT-QUALITY-FIX-02 — 온누리 가맹점 카드의 '시장 기준' 위치.
//
// The 2026-07-31 official file gives only the 시·도 as 소재지 ("서울"), so Core
// places most shops at their market (geo_state MARKET + market_address). The
// card must say the distance is to the market, show the market's address, and
// send 길찾기 to the market — never present the point as the shop's building.
// Node only: a minimal document stub renders the real card function.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ID = n => String(n).padStart(40, 'a').slice(-40).replace(/[^0-9a-f]/gu, 'b');

class Node {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.className = '';
    this._text = '';
  }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  append(...nodes) { this.children.push(...nodes); }
  prepend(...nodes) { this.children.unshift(...nodes); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  all() { return [this, ...this.children.flatMap(child => child.all())]; }
  byClass(name) { return this.all().find(node => node.className.split(' ').includes(name)) || null; }
}

globalThis.document = {createElement: tag => new Node(tag), cookie: ''};

const {normalizeOnnuriMerchant, normalizeOnnuriSearch, onnuriMerchantCard} = await import('../site-life-onnuri.js');

// ── normalizer ─────────────────────────────────────────────────────────
{
  const market = normalizeOnnuriMerchant({
    id: ID(1), name: '제일상회', address: '서울', market_name: '중부시장', market_address: '서울특별시 중구 마른내로 1',
    geo_state: 'MARKET', latitude: 37.5665, longitude: 126.999, distance_meters: 120, paper: true, digital: true,
  });
  assert.equal(market.locationBasis, 'MARKET');
  assert.equal(market.latitude, 37.5665);
  assert.equal(market.distanceMeters, 120);
  assert.equal(market.marketAddress, '서울특별시 중구 마른내로 1');

  const building = normalizeOnnuriMerchant({id: ID(2), name: 'A', address: '전북특별자치도 전주시 덕진구 만성중앙로 50',
    geo_state: 'VERIFIED', latitude: 35.847, longitude: 127.061, distance_meters: 80});
  assert.equal(building.locationBasis, 'BUILDING');
  assert.equal(building.marketAddress, '');

  for (const state of ['MARKET_AREA', 'AMBIGUOUS', 'UNVERIFIED', 'REGION_ONLY', undefined]) {
    const none = normalizeOnnuriMerchant({id: ID(3), name: 'A', address: '경기', geo_state: state, latitude: 37.4, longitude: 127.1, distance_meters: 50});
    assert.equal(none.latitude, null, `${state}: no point`);
    assert.equal(none.distanceMeters, null, `${state}: no distance`);
    assert.equal(none.locationBasis, '');
  }
  const outside = normalizeOnnuriMerchant({id: ID(4), name: 'A', address: '서울', geo_state: 'MARKET', latitude: 0, longitude: 0, distance_meters: 5});
  assert.equal(outside.latitude, null, 'a point outside Korea is dropped');
  assert.equal(normalizeOnnuriSearch({contract_id: 'CORE-ONNURI-MERCHANT-SEARCH-01', schema_version: 1, availability: 'AVAILABLE',
    items: [{id: ID(5), name: 'A', address: '서울', geo_state: 'MARKET', latitude: 37.5, longitude: 127, distance_meters: 10}]}).items[0].locationBasis, 'MARKET');
}

// ── card ───────────────────────────────────────────────────────────────
{
  const item = normalizeOnnuriMerchant({
    id: ID(1), name: '제일상회', address: '서울', market_name: '중부시장', market_address: '서울특별시 중구 마른내로 1',
    items: '건어물', geo_state: 'MARKET', latitude: 37.5665, longitude: 126.999, distance_meters: 1250, paper: true, digital: true,
  });
  const card = onnuriMerchantCard(item, {mapProvider: 'NAVER_MAP'});
  assert.equal(card.byClass('onnuri-card-distance').textContent, '시장까지 1.3km');
  assert.equal(card.byClass('onnuri-card-address').textContent, '시장 주소 서울특별시 중구 마른내로 1');
  assert.match(card.byClass('onnuri-card-basis').textContent, /소속 시장 기준/u);
  const link = card.byClass('onnuri-card-map');
  // ONNURI-MERCHANT-LOCATION-UX-P0: the chosen map app is named on the button.
  assert.equal(link.textContent, '네이버지도 시장 길찾기');
  assert.match(link.getAttribute('aria-label'), /중부시장 길찾기$/u, 'navigation goes to the market');
  assert.ok(link.href && !link.href.includes(encodeURIComponent('제일상회')), 'the shop name is not sent as the destination');

  const building = onnuriMerchantCard(normalizeOnnuriMerchant({id: ID(2), name: '만성커피', address: '전북특별자치도 전주시 덕진구 만성중앙로 50',
    geo_state: 'VERIFIED', latitude: 35.847, longitude: 127.061, distance_meters: 80}), {mapProvider: 'NAVER_MAP'});
  assert.equal(building.byClass('onnuri-card-distance').textContent, '80m');
  assert.equal(building.byClass('onnuri-card-basis'), null);
  assert.equal(building.byClass('onnuri-card-map').textContent, '네이버지도 길찾기');

  const unknown = onnuriMerchantCard(normalizeOnnuriMerchant({id: ID(3), name: '중앙떡집', address: '경기', market_name: '중앙시장',
    geo_state: 'AMBIGUOUS'}), {mapProvider: 'NAVER_MAP'});
  assert.equal(unknown.byClass('onnuri-card-distance'), null, 'no distance without a point');
  assert.equal(unknown.byClass('onnuri-card-address').textContent, '경기');
  assert.equal(unknown.byClass('onnuri-card-map').textContent, '네이버지도에서 찾기');
  assert.equal(unknown.byClass('onnuri-card-map').dataset.mapAction, 'search', 'no point: a name search, never a route');
}

// ── source guards ──────────────────────────────────────────────────────
{
  const source = fs.readFileSync(path.join(ROOT, 'site-life-onnuri.js'), 'utf8');
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/u, 'nothing stored');
  assert.match(source, /geo_state === 'MARKET'/u);
}

console.log('validate_onnuri_market_location_02: PASS');
