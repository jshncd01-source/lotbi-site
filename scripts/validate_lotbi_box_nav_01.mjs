import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

const html = read('index.html');
const conversation = read('site-conversation.js');
const css = read('site-conversation.css');

assert.equal((html.match(/data-lotbi-box-open/g) || []).length, 2, 'Desktop and mobile must both expose LOTBI Box');
assert.equal((html.match(/aria-label="롯비함 열기"/g) || []).length, 2, 'LOTBI Box navigation must be labelled');
assert.ok(html.includes('site-calendar.css?v=20260921-smartcaldraft1'), 'real Calendar CSS must remain preserved');
assert.ok(html.includes('site-conversation.js?v=20260921-smartcaltrueorbit1'), 'LOTBI Box must remain on the fresh combined conversation runtime');
assert.ok(html.indexOf('data-new-conversation') < html.indexOf('data-lotbi-box-open'), 'LOTBI Box follows new conversation');
assert.ok(html.indexOf('data-lotbi-box-open') < html.indexOf('data-calendar-view="all"'), 'LOTBI Box precedes Calendar');

for (const token of [
  "storageKey(namespace || browserAnonymousNamespace(), 'lotbi-box')",
  'const openLotbiBox = trigger =>',
  "modalShell('롯비함', '나중에 다시 볼 항목을 모아두는 곳이에요.')",
  '아직 롯비함에 담은 항목이 없어요.',
  '검색 결과에서 “+ 롯비함”을 눌러 저장할 수 있어요.',
  'data-lotbi-box-toggle-key',
  'refreshLotbiBoxControls',
  '롯비함에서 제거',
  "item.image_reference.startsWith('https://')",
  "value.startsWith('https://')",
  "openSurface?.querySelector('.lotbi-box-list, .calendar-product-shell')",
  "new Set(['month', 'year', 'agenda', 'attention', 'all', 'today', 'upcoming', 'date'])",
]) assert.ok(conversation.includes(token), 'missing LOTBI Box/Calendar preservation behavior: ' + token);

for (const forbidden of ['lotbi-box-v2', 'saved-products-new', "storageKey(namespace || browserAnonymousNamespace(), 'favorites')"]) {
  assert.ok(!conversation.includes(forbidden), 'must not create duplicate LOTBI Box storage: ' + forbidden);
}

for (const token of [
  '.site-lotbi-box-modal',
  '.lotbi-box-list',
  '.lotbi-box-empty',
  '.lotbi-box-card',
  '.lotbi-box-card-actions',
  '@media (max-width: 620px)',
  '@media (max-width: 360px)',
]) assert.ok(css.includes(token), 'missing LOTBI Box responsive styling: ' + token);

console.log('SITE-LOTBI-BOX-NAV-01 PASS');
