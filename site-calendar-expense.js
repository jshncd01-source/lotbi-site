// Calendar amounts — what the owner typed into the 금액 field of their records.
//
// It shows only what the owner already saved on a Calendar entry. An expense
// that was never recorded is simply missing; nothing here is estimated,
// inferred, or filled in on the owner's behalf.
//
// The Calendar is not a ledger. Under the month there is one quiet line
// (calendarAmountSummaryLine) that disappears entirely when the month holds no
// amount, and the breakdown waits behind it (calendarAmountDetailNode). The
// words are "입력 금액", never "쓴 돈": the contract does not yet tell a price
// that was booked from money that was actually spent.
//
// calendarExpenseSummaryNode is the earlier always-visible ledger card. The
// Calendar no longer mounts it; it stays exported for the standalone shoot and
// guard scripts that still render it in isolation.

// The one place these labels live. The entry editor reads them from here too:
// it used to call LIVING "기타 / 생활비" while the bar called it "생활비", so a
// 기타 spend and a 생활비 spend were the same row under two different names.
const CATEGORY_LABELS = {
  FOOD: '음식',
  TRAVEL: '여행',
  SHOPPING: '쇼핑',
  LIVING: '생활비',
  OTHER: '기타',
  UNCLASSIFIED: '미분류',
};

// Fixed order and fixed membership. A category with nothing in it still holds
// its slot, so a reader's eye lands on the same place every month.
// 기타 is a kind of spending; 미분류 is the absence of a choice, so it sits last
// and reads as something still to fill in.
export const EXPENSE_CATEGORY_ORDER = Object.freeze([
  'FOOD',
  'TRAVEL',
  'SHOPPING',
  'LIVING',
  'OTHER',
  'UNCLASSIFIED',
]);

// The editor's dropdown, in the same order and the same words. An empty value
// means the owner has not chosen, which Core stores as UNCLASSIFIED.
export const EXPENSE_CATEGORY_CHOICES = Object.freeze([
  Object.freeze(['', CATEGORY_LABELS.UNCLASSIFIED]),
  ...EXPENSE_CATEGORY_ORDER
    .filter(value => value !== 'UNCLASSIFIED')
    .map(value => Object.freeze([value, CATEGORY_LABELS[value]])),
]);

// Totals for entries this browser holds, in the exact shape Core returns from
// /v2/life/expense-summary. It exists because a signed-out owner already records
// amounts — the guest repository stores entry.amount_minor and
// entry.expense_category like any other entry — and the only thing that was
// missing is somewhere to add them up. Nothing here is sent anywhere.
//
// It produces the summary; it does not decide how the summary looks. Ordering,
// labels, the empty month and the total all stay in calendarExpenseSummaryNode
// below, so the signed-out bar and the signed-in bar are the same bar.
//
// Rules it shares with Core, deliberately:
//   - currencies are never summed together or converted
//   - an entry with no amount is counted, never estimated
//   - a recorded amount with no category counts as UNCLASSIFIED, which is what
//     the guest repository already stores for that case
export function expenseSummaryFromEntries(entries, {startDate = '', endDate = ''} = {}) {
  const byCurrency = new Map();
  let entriesWithoutAmount = 0;

  for (const event of Array.isArray(entries) ? entries : []) {
    const entry = event?.entry;
    const amount = entry?.amount_minor;
    if (!Number.isInteger(amount)) {
      // No amount recorded is not zero spent. It is counted and said out loud
      // rather than guessed at.
      entriesWithoutAmount += 1;
      continue;
    }
    const currency = typeof entry.currency === 'string' && /^[A-Z]{3}$/.test(entry.currency)
      ? entry.currency
      : 'KRW';
    const category = EXPENSE_CATEGORY_ORDER.includes(entry.expense_category)
      ? entry.expense_category
      : 'UNCLASSIFIED';
    if (!byCurrency.has(currency)) byCurrency.set(currency, {categories: new Map(), total: 0, count: 0});
    const bucket = byCurrency.get(currency);
    const row = bucket.categories.get(category) || {amountMinor: 0, entryCount: 0};
    row.amountMinor += amount;
    row.entryCount += 1;
    bucket.categories.set(category, row);
    bucket.total += amount;
    bucket.count += 1;
  }

  const currencies = [...byCurrency.entries()].map(([currency, bucket]) => ({
    currency,
    categories: EXPENSE_CATEGORY_ORDER
      .filter(name => bucket.categories.has(name))
      .map(name => ({expenseCategory: name, ...bucket.categories.get(name)})),
    totalAmountMinor: bucket.total,
    entryCount: bucket.count,
  }));

  return {startDate, endDate, currencies, entriesWithoutAmount};
}

export function expenseCategoryLabel(value) {
  return CATEGORY_LABELS[value] || '미분류';
}

export function formatExpenseAmount(amountMinor, currency) {
  if (!Number.isInteger(amountMinor)) return '';
  const digits = new Intl.NumberFormat('ko-KR').format(amountMinor);
  // Core stores the entry amount exactly as the owner recorded it and never
  // converts between currencies, so no decimal position is assumed for a
  // currency other than KRW.
  return currency === 'KRW' ? `${digits}원` : `${digits} ${currency}`;
}

// Currencies are never summed together, so each gets its own line. KRW leads.
function orderedCurrencies(currencies) {
  const rows = Array.isArray(currencies) ? [...currencies] : [];
  rows.sort((a, b) => {
    if (a.currency === b.currency) return 0;
    if (a.currency === 'KRW') return -1;
    if (b.currency === 'KRW') return 1;
    return a.currency < b.currency ? -1 : 1;
  });
  return rows;
}

export function expenseSummaryPresentation(summary, {local = false} = {}) {
  const currencies = orderedCurrencies(summary?.currencies);
  const recorded = currencies.length > 0;
  const lines = recorded ? currencies : [EMPTY_KRW];

  return {
    recorded,
    lines: lines.map(currencyTotals => {
      const byCategory = new Map(
        (currencyTotals.categories || [])
          .filter(row => EXPENSE_CATEGORY_ORDER.includes(row.expenseCategory))
          .map(row => [row.expenseCategory, row]),
      );
      const categories = EXPENSE_CATEGORY_ORDER.map(expenseCategory => {
        const row = byCategory.get(expenseCategory);
        return {
          expenseCategory,
          label: expenseCategoryLabel(expenseCategory),
          amount: formatExpenseAmount(
            Number.isInteger(row?.amountMinor) ? row.amountMinor : 0,
            currencyTotals.currency,
          ),
        };
      });
      // A record without an amount is an ordinary record, not a missing
      // expense. The count Core reports (entriesWithoutAmount) stays in the
      // data but is never phrased as something left out.
      return {
        currency: currencyTotals.currency,
        totalLabel: `합계 ${currencyTotals.currency === 'KRW' ? '₩' : currencyTotals.currency}`,
        totalAmount: formatExpenseAmount(
          Number.isInteger(currencyTotals.totalAmountMinor) ? currencyTotals.totalAmountMinor : 0,
          currencyTotals.currency,
        ),
        categories,
        note: '',
      };
    }),
    // The six 0원 slots and the 0원 total already communicate an empty month.
    // Only show storage scope when there is something local to explain, and
    // keep it separate from the amounts so it does not compete with them.
    storageNote: local && recorded ? '이 기기에 저장됨' : '',
  };
}

function currencyLine(presentation, {totalFirst = false} = {}) {
  const line = document.createElement('div');
  line.className = 'calendar-expense-line';
  line.dataset.currency = presentation.currency;

  const total = document.createElement('p');
  total.className = 'calendar-expense-total';
  total.dataset.expenseTotal = '';
  const totalLabel = document.createElement('span');
  totalLabel.className = 'calendar-expense-total-label';
  totalLabel.textContent = presentation.totalLabel;
  const totalAmount = document.createElement('strong');
  totalAmount.className = 'calendar-expense-total-amount';
  totalAmount.textContent = presentation.totalAmount;
  total.append(totalLabel, totalAmount);

  const items = document.createElement('dl');
  items.className = 'calendar-expense-items';
  for (const category of presentation.categories) {
    const item = document.createElement('div');
    item.className = 'calendar-expense-item';
    item.dataset.expenseCategory = category.expenseCategory;
    const name = document.createElement('dt');
    name.textContent = category.label;
    const value = document.createElement('dd');
    value.textContent = category.amount;
    item.append(name, value);
    items.appendChild(item);
  }

  if (presentation.note) {
    // A span, not a div: styles.css styles every `dl div` as a legal-page row.
    const coverage = document.createElement('span');
    coverage.className = 'calendar-expense-coverage';
    coverage.textContent = presentation.note;
    items.appendChild(coverage);
  }

  if (totalFirst) line.append(total, items);
  else line.append(items, total);
  return line;
}

function noticeNode(text, {status = false} = {}) {
  const node = document.createElement('p');
  node.className = 'calendar-expense-notice';
  if (status) node.setAttribute('role', 'status');
  node.textContent = text;
  return node;
}

const EMPTY_KRW = Object.freeze({
  currency: 'KRW',
  categories: [],
  totalAmountMinor: 0,
  entryCount: 0,
});

/**
 * @param {object} options
 * @param {'loading'|'ready'|'error'|'guest'} options.state
 * @param {{currencies: Array, entriesWithoutAmount: number}|null} [options.summary]
 * @param {string} [options.monthLabel] e.g. "2026년 9월"
 * @param {string} [options.errorMessage]
 * @param {boolean} [options.local] totals computed from this browser's own entries
 * @param {boolean} [options.showHeading] consumer workspace, not the legacy compact strip
 */
export function calendarExpenseSummaryNode({
  state,
  summary = null,
  monthLabel = '',
  errorMessage = '',
  local = false,
  showHeading = false,
}) {
  const section = document.createElement('section');
  section.className = 'calendar-expense-summary';
  section.dataset.calendarExpenseSummary = state;
  section.setAttribute(
    'aria-label',
    monthLabel ? `${monthLabel} 지출 합계` : '지출 합계',
  );

  if (showHeading) {
    section.dataset.expenseLayout = 'workspace';
    const header = document.createElement('header');
    header.className = 'calendar-expense-header';
    const heading = document.createElement('h3');
    heading.className = 'calendar-expense-heading';
    heading.textContent = '월별 지출';
    const scope = document.createElement('p');
    scope.className = 'calendar-expense-scope';
    scope.textContent = [monthLabel, '캘린더에 기록한 금액 기준'].filter(Boolean).join(' · ');
    header.append(heading, scope);
    section.appendChild(header);
  }

  if (state === 'loading') {
    section.appendChild(noticeNode('지출 합계를 불러오는 중…', {status: true}));
    return section;
  }

  if (state === 'guest') {
    section.appendChild(
      noticeNode('로그인하면 캘린더에 기록한 지출을 모아서 보여드려요.'),
    );
    return section;
  }

  if (state === 'error') {
    section.appendChild(
      noticeNode(errorMessage || '지출 합계를 불러오지 못했습니다.', {status: true}),
    );
    return section;
  }

  const presentation = expenseSummaryPresentation(summary, {local});
  section.dataset.expenseRecorded = String(presentation.recorded);
  // Reading order follows the consumer layout: total, then categories. The
  // compact legacy strip retains its original categories-first DOM order.
  presentation.lines.forEach(line => section.appendChild(currencyLine(line, {totalFirst: showHeading})));
  if (presentation.storageNote) {
    const storageNote = document.createElement('p');
    storageNote.className = 'calendar-expense-storage-note';
    storageNote.textContent = presentation.storageNote;
    storageNote.title = '로그인하면 다른 기기에서도 캘린더 기록을 확인할 수 있어요.';
    storageNote.setAttribute('aria-label', '이 기기에 저장됨. 로그인하면 다른 기기에서도 캘린더 기록을 확인할 수 있어요.');
    section.appendChild(storageNote);
  }

  return section;
}

// ── Month amount: one line, then a detail on request ─────────────────────

// Only currencies that actually carry a recorded amount. A month with none
// returns null and the Calendar draws no line at all -- nobody who keeps no
// amounts is shown a 0원 ledger.
function recordedCurrencies(summary) {
  return orderedCurrencies(summary?.currencies).filter(line => (
    Number.isInteger(line?.totalAmountMinor)
    && (Number.isInteger(line?.entryCount) ? line.entryCount > 0 : line.totalAmountMinor > 0)
  ));
}

export function amountSummaryLinePresentation(summary, {month = null} = {}) {
  const currencies = recordedCurrencies(summary);
  if (!currencies.length) return null;
  return Object.freeze({
    label: Number.isInteger(month) ? `${month}월 입력 금액 합계` : '입력 금액 합계',
    amounts: Object.freeze(currencies.map(line => formatExpenseAmount(line.totalAmountMinor, line.currency))),
  });
}

export function amountDetailPresentation(summary, {local = false} = {}) {
  const currencies = recordedCurrencies(summary);
  return Object.freeze({
    recorded: currencies.length > 0,
    lines: Object.freeze(currencies.map(line => {
      const byCategory = new Map((line.categories || [])
        .filter(row => EXPENSE_CATEGORY_ORDER.includes(row?.expenseCategory))
        .map(row => [row.expenseCategory, row]));
      return Object.freeze({
        currency: line.currency,
        totalAmount: formatExpenseAmount(line.totalAmountMinor, line.currency),
        // Fixed order, but a category nobody used is not listed: the detail is
        // what was recorded, not a form with six empty boxes.
        categories: Object.freeze(EXPENSE_CATEGORY_ORDER
          .map(expenseCategory => byCategory.get(expenseCategory))
          .filter(row => row && (Number.isInteger(row.entryCount) ? row.entryCount > 0 : row.amountMinor > 0))
          .map(row => Object.freeze({
            expenseCategory: row.expenseCategory,
            label: expenseCategoryLabel(row.expenseCategory),
            amount: formatExpenseAmount(Number.isInteger(row.amountMinor) ? row.amountMinor : 0, line.currency),
            count: Number.isInteger(row.entryCount) ? row.entryCount : null,
          }))),
      });
    })),
    scopeNote: '캘린더 기록에 입력한 금액을 더한 값이에요.',
    storageNote: local && currencies.length ? '이 기기에 저장된 기록 기준이에요.' : '',
  });
}

/**
 * The single line under the month. Returns null when there is nothing to say,
 * so the caller simply draws nothing.
 * @param {object} options
 * @param {'loading'|'ready'|'error'} options.state
 */
export function calendarAmountSummaryLine({state, summary = null, month = null, errorMessage = '', onOpen = null}) {
  if (state === 'error') {
    const failed = document.createElement('p');
    failed.className = 'calendar-amount-line calendar-amount-line-error';
    failed.dataset.calendarAmountSummary = 'error';
    failed.setAttribute('role', 'status');
    failed.textContent = errorMessage || '입력 금액 합계를 불러오지 못했어요.';
    return failed;
  }
  if (state !== 'ready') return null;
  const presentation = amountSummaryLinePresentation(summary, {month});
  if (!presentation) return null;
  const line = document.createElement('button');
  line.type = 'button';
  line.className = 'calendar-amount-line';
  line.dataset.calendarAmountSummary = 'ready';
  const label = document.createElement('span');
  label.className = 'calendar-amount-line-label';
  label.textContent = presentation.label;
  const amount = document.createElement('strong');
  amount.className = 'calendar-amount-line-amount';
  amount.textContent = presentation.amounts.join(' · ');
  const chevron = document.createElement('span');
  chevron.className = 'calendar-amount-line-chevron';
  chevron.setAttribute('aria-hidden', 'true');
  chevron.textContent = '›';
  line.append(label, amount, chevron);
  line.setAttribute('aria-label', `${presentation.label} ${presentation.amounts.join(', ')}, 자세히 보기`);
  if (typeof onOpen === 'function') line.addEventListener('click', () => onOpen(line));
  return line;
}

export function calendarAmountDetailNode({summary = null, monthLabel = '', local = false}) {
  const presentation = amountDetailPresentation(summary, {local});
  const body = document.createElement('div');
  body.className = 'calendar-amount-detail';
  body.dataset.amountRecorded = String(presentation.recorded);
  const scope = document.createElement('p');
  scope.className = 'calendar-amount-detail-scope';
  scope.textContent = [monthLabel, presentation.scopeNote].filter(Boolean).join(' · ');
  body.appendChild(scope);
  if (!presentation.recorded) {
    const empty = document.createElement('p');
    empty.className = 'calendar-amount-detail-empty';
    empty.textContent = '이 달에 입력한 금액이 없어요.';
    body.appendChild(empty);
    return body;
  }
  for (const line of presentation.lines) {
    const group = document.createElement('section');
    group.className = 'calendar-amount-detail-currency';
    group.dataset.currency = line.currency;
    const total = document.createElement('p');
    total.className = 'calendar-amount-detail-total';
    const totalLabel = document.createElement('span');
    totalLabel.textContent = line.currency === 'KRW' ? '합계' : `합계 (${line.currency})`;
    const totalAmount = document.createElement('strong');
    totalAmount.textContent = line.totalAmount;
    total.append(totalLabel, totalAmount);
    const rows = document.createElement('dl');
    rows.className = 'calendar-amount-detail-rows';
    for (const category of line.categories) {
      const row = document.createElement('div');
      row.className = 'calendar-amount-detail-row';
      row.dataset.expenseCategory = category.expenseCategory;
      const name = document.createElement('dt');
      name.textContent = category.label;
      const value = document.createElement('dd');
      value.textContent = category.amount;
      if (Number.isInteger(category.count)) {
        const count = document.createElement('small');
        count.textContent = `${category.count}건`;
        value.append(' ', count);
      }
      row.append(name, value);
      rows.appendChild(row);
    }
    group.append(total, rows);
    body.appendChild(group);
  }
  if (presentation.storageNote) {
    const storage = document.createElement('p');
    storage.className = 'calendar-amount-detail-storage';
    storage.textContent = presentation.storageNote;
    body.appendChild(storage);
  }
  return body;
}
