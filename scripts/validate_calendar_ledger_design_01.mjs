import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calendarExpenseSummaryNode, expenseSummaryFromEntries, expenseSummaryPresentation} from '../site-calendar-expense.js';

// Minimal DOM adapter for the actual renderer. No browser, storage, API or user
// account is used; sample amounts below exist only in these isolated assertions.
class Node {
  constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.textContent = ''; }
  append(...nodes) { this.children.push(...nodes); }
  appendChild(node) { this.children.push(node); return node; }
  setAttribute(name, value) { this.attributes[name] = value; }
}
const find = (node, name) => node.className === name ? node : node.children.map(child => find(child, name)).find(Boolean);
const savedDocument = globalThis.document;
globalThis.document = {createElement: tag => new Node(tag)};
try {
  const summary = expenseSummaryFromEntries([
    {entry: {amount_minor: 4200, currency: 'KRW', expense_category: 'FOOD'}},
    {entry: {amount_minor: 80000, currency: 'KRW', expense_category: 'LIVING'}},
    {entry: {amount_minor: 12, currency: 'USD', expense_category: 'SHOPPING'}},
    {entry: {amount_minor: null, currency: 'KRW'}},
  ]);
  const presentation = expenseSummaryPresentation(summary, {local: true});
  assert.deepEqual(presentation.lines.map(line => line.totalAmount), ['84,200원', '12 USD']);
  assert.equal(presentation.lines[0].note, '금액 없는 일정 1건 제외');
  assert.equal(presentation.lines[1].note, '');

  const monthLabel = '2026년 9월'; // Browsing a past month must not say 이번 달.
  const ledger = calendarExpenseSummaryNode({state: 'ready', summary, monthLabel, local: true, showHeading: true});
  assert.equal(ledger.attributes['aria-label'], '2026년 9월 지출 합계');
  assert.equal(ledger.dataset.expenseLayout, 'workspace');
  assert.equal(find(ledger, 'calendar-expense-heading').textContent, '월별 지출');
  assert.equal(find(ledger, 'calendar-expense-scope').textContent, '2026년 9월 · 캘린더에 기록한 금액 기준');
  assert.equal(find(ledger, 'calendar-expense-total-amount').textContent, '84,200원');
  assert.equal(find(ledger, 'calendar-expense-storage-note').textContent, '이 기기에 저장됨');
  assert.equal(ledger.children.filter(node => node.className === 'calendar-expense-line').length, 2);
  assert.deepEqual(find(ledger, 'calendar-expense-line').children.map(node => node.className), ['calendar-expense-total', 'calendar-expense-items']);
  assert.equal(find(ledger, 'calendar-expense-items').children.filter(node => node.className === 'calendar-expense-item').length, 6);

  const compact = calendarExpenseSummaryNode({state: 'ready', summary, monthLabel});
  assert.equal(find(compact, 'calendar-expense-header'), undefined, 'legacy strip stays unchanged by default');
  assert.deepEqual(find(compact, 'calendar-expense-line').children.map(node => node.className), ['calendar-expense-items', 'calendar-expense-total']);
  for (const state of ['loading', 'error', 'guest']) {
    const node = calendarExpenseSummaryNode({state, summary: null, monthLabel, showHeading: true});
    assert.equal(find(node, 'calendar-expense-heading').textContent, '월별 지출');
    assert.equal(find(node, 'calendar-expense-total'), undefined, `${state} must not claim zero spent`);
    assert.ok(find(node, 'calendar-expense-notice').textContent.length);
    if (state !== 'guest') assert.equal(find(node, 'calendar-expense-notice').attributes.role, 'status');
  }
  const empty = calendarExpenseSummaryNode({state: 'ready', summary: {currencies: [], entriesWithoutAmount: 0}, showHeading: true});
  assert.equal(find(empty, 'calendar-expense-total-amount').textContent, '0원');
  assert.equal(empty.dataset.expenseRecorded, 'false');
} finally {
  if (savedDocument === undefined) delete globalThis.document;
  else globalThis.document = savedDocument;
}

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const css = read('site-consumer-detail.css');
const manager = read('site-calendar-manager.js');
assert.match(manager, /showHeading: root\.closest\('\.consumer-workspace'\) !== null/);
assert.match(manager, /detailsSummary\.textContent = '장소·생활비·메모 \(선택\)'/);
assert.match(css, /\.calendar-expense-item\[data-expense-category\] dt\s*\{ color: var\(--lotbi-text-primary\)/);
assert.match(css, /\.calendar-expense-items\s*\{[^}]*repeat\(6, minmax\(0, 1fr\)\)/);
assert.match(css, /\.calendar-expense-items\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(css, /\.calendar-expense-total\s*\{[^}]*grid-row: 1;/);
assert.match(css, /\.calendar-expense-item dd\s*\{[^}]*overflow-wrap: anywhere;/);
assert.match(css, /\.calendar-expense-coverage\s*\{ grid-column: 1 \/ -1;/);
console.log('CALENDAR_LEDGER_DESIGN_01 PASS — real renderer, money/currency/coverage states, consumer-only layout; not API E2E');
