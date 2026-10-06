import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  amountDetailPresentation,
  amountSummaryLinePresentation,
  calendarAmountDetailNode,
  calendarAmountSummaryLine,
  calendarExpenseSummaryNode,
  expenseSummaryFromEntries,
  expenseSummaryPresentation,
} from '../site-calendar-expense.js';

// CALENDAR_LEDGER_DESIGN_01, revised by CALENDAR LIFE UX 01.
//
// The Calendar is not a ledger. A month's recorded amounts are one quiet line
// under the grid -- gone entirely when the month holds none -- and the
// breakdown waits behind it. The words are "입력 금액": an amount on a record
// can be a booking's price as easily as money already spent, and the contract
// does not yet say which. A record without an amount is an ordinary record, so
// nothing ever says it was "left out".
//
// Minimal DOM adapter for the actual renderers. No browser, storage, API or
// user account is used; sample amounts below exist only in these assertions.
class Node {
  constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.textContent = ''; this.listeners = {}; }
  append(...nodes) { this.children.push(...nodes); }
  appendChild(node) { this.children.push(node); return node; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(type, handler) { this.listeners[type] = handler; }
}
const find = (node, name) => {
  if (!node || typeof node !== 'object') return undefined;
  if (node.className === name) return node;
  return (node.children || []).map(child => find(child, name)).find(Boolean);
};
const findAll = (node, name, out = []) => {
  if (!node || typeof node !== 'object') return out;
  if (node.className === name) out.push(node);
  for (const child of node.children || []) findAll(child, name, out);
  return out;
};
const text = node => (typeof node === 'string' ? node : [node.textContent, ...(node.children || []).map(text)].join(''));
const savedDocument = globalThis.document;
globalThis.document = {createElement: tag => new Node(tag)};
try {
  const summary = expenseSummaryFromEntries([
    {entry: {amount_minor: 4200, currency: 'KRW', expense_category: 'FOOD'}},
    {entry: {amount_minor: 80000, currency: 'KRW', expense_category: 'LIVING'}},
    {entry: {amount_minor: 12, currency: 'USD', expense_category: 'SHOPPING'}},
    {entry: {amount_minor: null, currency: 'KRW'}},
  ]);
  // Money rules unchanged: currencies are never summed together or converted,
  // and a record without an amount is counted, never estimated.
  assert.equal(summary.entriesWithoutAmount, 1);
  const presentation = expenseSummaryPresentation(summary, {local: true});
  assert.deepEqual(presentation.lines.map(line => line.totalAmount), ['84,200원', '12 USD']);
  assert.equal(presentation.lines[0].note, '', 'a record without an amount is never phrased as excluded');
  assert.equal(presentation.lines[1].note, '');

  // ── the one line ──
  const line = amountSummaryLinePresentation(summary, {month: 9});
  assert.deepEqual(line, {label: '9월 입력 금액 합계', amounts: ['84,200원', '12 USD']});
  assert.equal(amountSummaryLinePresentation({currencies: [], entriesWithoutAmount: 3}, {month: 9}), null,
    'a month with no amount draws no line at all');
  let opened = null;
  const lineNode = calendarAmountSummaryLine({state: 'ready', summary, month: 9, onOpen: opener => { opened = opener; }});
  assert.equal(lineNode.tagName, 'button');
  assert.equal(lineNode.dataset.calendarAmountSummary, 'ready');
  assert.equal(find(lineNode, 'calendar-amount-line-label').textContent, '9월 입력 금액 합계');
  assert.equal(find(lineNode, 'calendar-amount-line-amount').textContent, '84,200원 · 12 USD');
  assert.equal(lineNode.attributes['aria-label'], '9월 입력 금액 합계 84,200원, 12 USD, 자세히 보기');
  lineNode.listeners.click();
  assert.equal(opened, lineNode, 'the line opens the detail and hands it back its opener for focus');
  for (const state of ['loading', 'guest']) {
    assert.equal(calendarAmountSummaryLine({state, summary}), null, `${state} must not claim any total`);
  }
  assert.equal(calendarAmountSummaryLine({state: 'ready', summary: {currencies: [], entriesWithoutAmount: 2}, month: 9}), null);
  const failed = calendarAmountSummaryLine({state: 'error', errorMessage: '입력 금액 합계를 불러오지 못했어요.'});
  assert.equal(failed.attributes.role, 'status');
  assert.equal(failed.textContent, '입력 금액 합계를 불러오지 못했어요.');
  assert.equal(find(failed, 'calendar-amount-line-amount'), undefined, 'a failed read shows no number');

  // ── the detail behind it ──
  const detail = amountDetailPresentation(summary, {local: true});
  assert.equal(detail.recorded, true);
  assert.deepEqual(detail.lines[0].categories.map(row => [row.label, row.amount, row.count]), [['음식', '4,200원', 1], ['생활비', '80,000원', 1]],
    'only categories that were used, in the fixed order');
  assert.equal(detail.storageNote, '이 기기에 저장된 기록 기준이에요.');
  const detailNode = calendarAmountDetailNode({summary, local: true});
  assert.equal(findAll(detailNode, 'calendar-amount-detail-currency').length, 2);
  assert.equal(findAll(detailNode, 'calendar-amount-detail-row').length, 3);
  assert.equal(find(detailNode, 'calendar-amount-detail-scope').textContent, '캘린더 기록에 입력한 금액을 더한 값이에요.');
  assert.equal(find(detailNode, 'calendar-amount-detail-storage').textContent, '이 기기에 저장된 기록 기준이에요.');
  const emptyDetail = calendarAmountDetailNode({summary: {currencies: [], entriesWithoutAmount: 0}});
  assert.equal(emptyDetail.dataset.amountRecorded, 'false');
  assert.equal(find(emptyDetail, 'calendar-amount-detail-empty').textContent, '이 달에 입력한 금액이 없어요.');

  // The earlier always-visible card is no longer mounted by the Calendar; it
  // stays exported for isolated shoot scripts and must not resurrect the copy.
  const legacy = calendarExpenseSummaryNode({state: 'ready', summary, monthLabel: '2026년 9월', local: true, showHeading: true});
  assert.ok(!text(legacy).includes('금액 없는'), 'the legacy card must not phrase a record without an amount as excluded');
} finally {
  if (savedDocument === undefined) delete globalThis.document;
  else globalThis.document = savedDocument;
}

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const manager = read('site-calendar-manager.js');
const expense = read('site-calendar-expense.js');
const calendarCss = read('site-calendar.css');
assert.ok(manager.includes('calendarAmountSummaryLine({'), 'the month shows the one-line summary');
assert.ok(manager.includes('calendarAmountDetailNode({summary, local})'), 'the breakdown opens from the line');
assert.ok(!manager.includes('calendarExpenseSummaryNode('), 'the always-visible ledger card must not be mounted');
assert.ok(!manager.includes('calendar-expense-slot'), 'the ledger card no longer owns a shell row');
assert.ok(!manager.includes("'월별 지출'"), 'no ledger heading on the Calendar');
// Code only: the comments explain the rule by quoting the words it forbids.
const withoutComments = source => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\s\/\/.*$/gm, '');
for (const [name, source] of [['site-calendar-manager.js', manager], ['site-calendar-expense.js', expense]]) {
  const code = withoutComments(source);
  assert.ok(!code.includes('쓴 돈'), `${name} must not call a recorded amount "쓴 돈"`);
  assert.ok(!code.includes('금액 없는 일정'), `${name} must not phrase a record without an amount as excluded`);
}
assert.match(calendarCss, /\.calendar-amount-line \{[^}]*min-height: 44px;/);
assert.match(calendarCss, /\.calendar-amount-line-amount \{[^}]*font-variant-numeric: tabular-nums;/);
assert.match(calendarCss, /\.calendar-amount-detail-row \{/);
console.log('CALENDAR_LEDGER_DESIGN_01 PASS — one quiet line + detail on request, 입력 금액 wording, money/currency rules; not API E2E');
