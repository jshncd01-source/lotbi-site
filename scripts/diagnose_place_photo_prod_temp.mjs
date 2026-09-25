import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const CORE = 'https://api.lotbiai.com';
const queries = [
  {label:'target', text:'전주 덕진구 스타벅스 전북대점 찾아줘', exact:'스타벅스 전북대점'},
  {label:'extra-1', text:'전주 완산구 스타벅스 찾아줘'},
  {label:'extra-2', text:'전주 덕진구 투썸플레이스 찾아줘'},
];

function compact(value) {
  return String(value || '').replace(/[^0-9A-Za-z가-힣]+/gu, '').toLowerCase();
}

async function freshSearch(item) {
  const sessionRes = await fetch(CORE + '/v2/conversation/guest/sessions', {method:'POST'});
  assert.equal(sessionRes.status, 201, item.label + ': guest session');
  const session = await sessionRes.json();
  const token = String(session.guest_token || '');
  assert.ok(token.length >= 20, item.label + ': guest token missing');

  const id = crypto.randomUUID();
  const messageRes = await fetch(CORE + '/v2/conversation/guest/messages', {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'X-LOTBI-Guest-Token': token,
      'Idempotency-Key': 'place-photo-prod-' + id,
    },
    body: JSON.stringify({
      text:item.text,
      client_context:{
        timezone:'Asia/Seoul',
        conversation_id:'place-photo-prod-' + id,
        turn_id:'turn-' + id,
        logical_request_id:'place-photo-prod-' + id,
      },
      recent_context:[],
      attachment_ids:[],
    }),
  });
  assert.equal(messageRes.status, 200, item.label + ': guest message');
  const body = await messageRes.json();
  const place = body.place_result || body.placeResult;
  assert.ok(place && Array.isArray(place.results), item.label + ': place_result missing');
  const candidates = place.results.filter(row => row && typeof row === 'object');
  assert.ok(candidates.length > 0, item.label + ': no place results');
  const selected = item.exact
    ? candidates.find(row => compact(row.name) === compact(item.exact))
    : candidates.find(row => typeof row.image_url === 'string' && row.image_url.trim());
  assert.ok(selected, item.label + ': expected place/photo candidate missing');
  const url = String(selected.image_url || '').trim();
  const evidence = selected.photo_evidence;
  assert.ok(url.startsWith('https://'), item.label + ': image_url missing');
  const parsed = new URL(url);
  assert.ok(parsed.hostname === 'googleusercontent.com' || parsed.hostname.endsWith('.googleusercontent.com'), item.label + ': unexpected image host');
  assert.ok(!parsed.searchParams.has('key'), item.label + ': API key leaked in image URL');
  assert.equal(evidence?.provider, 'GOOGLE_PLACES', item.label + ': provider');
  assert.equal(evidence?.verification_state, 'VERIFIED', item.label + ': verification state');
  assert.ok(['EXACT_NAME_AND_ADDRESS','EXACT_NAME_AND_80M_COORDINATE'].includes(evidence?.match_basis), item.label + ': match basis');
  assert.ok(String(evidence?.provider_place_id || ''), item.label + ': provider place id');
  return {
    label:item.label,
    name:selected.name,
    address:selected.road_address || selected.address || '',
    image_url:url,
    provider:evidence.provider,
    verification_state:evidence.verification_state,
    match_basis:evidence.match_basis,
  };
}

const results=[];
for (const item of queries) results.push(await freshSearch(item));
for (const row of results) {
  console.log('PLACE_PHOTO_PROD_OK ' + JSON.stringify(row));
}
console.log('PLACE_PHOTO_PROD_CONTRACT PASS count=' + results.length);
