// Calendar expense summary — a compact secondary card under the month grid.
//
// It shows only what the owner already saved on a Calendar entry. An expense
// that was never recorded is simply missing; nothing here is estimated,
// inferred, or filled in on the owner's behalf. The bar is also never removed
// when a month has no amounts — an empty month has to read as "nothing
// recorded", not as a strip that failed to load.
//
// The total is the primary fact. Only categories with a recorded non-zero
// amount follow it; six repeated 0원 slots made an empty month look busy and
// gave category detail more weight than the monthly total.

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
  const withoutAmount = Number.isInteger(summary?.entriesWithoutAmount)
    ? summary.entriesWithoutAmount
    : 0;

  return {
    recorded,
    lines: lines.map((currencyTotals, index) => {
      const categories = (currencyTotals.categories || [])
        .filter(row => Number.isInteger(row.amountMinor) && row.amountMinor !== 0)
        .sort((a, b) => EXPENSE_CATEGORY_ORDER.indexOf(a.expenseCategory)
          - EXPENSE_CATEGORY_ORDER.indexOf(b.expenseCategory))
        .map(row => ({
          expenseCategory: EXPENSE_CATEGORY_ORDER.includes(row.expenseCategory)
            ? row.expenseCategory
            : 'UNCLASSIFIED',
          label: expenseCategoryLabel(row.expenseCategory),
          amount: formatExpenseAmount(row.amountMinor, currencyTotals.currency),
        }));
      const notes = [];
      if (!recorded && index === 0) notes.push('이번 달 기록 없음');
      if (withoutAmount > 0 && index === 0) {
        notes.push(`금액 없는 일정 ${new Intl.NumberFormat('ko-KR').format(withoutAmount)}건 제외`);
      }
      if (local && index === 0) notes.push('이 브라우저에만 저장돼요 · 로그인하면 다른 기기에서도');
      return {
        currency: currencyTotals.currency,
        totalLabel: index === 0 ? '이번 달 지출' : `이번 달 지출 · ${currencyTotals.currency}`,
        totalAmount: formatExpenseAmount(
          Number.isInteger(currencyTotals.totalAmountMinor) ? currencyTotals.totalAmountMinor : 0,
          currencyTotals.currency,
        ),
        categories,
        note: notes.join(' · '),
      };
    }),
  };
}

function currencyLine(presentation) {
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

  line.append(total, items);
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
 */
export function calendarExpenseSummaryNode({
  state,
  summary = null,
  monthLabel = '',
  errorMessage = '',
  local = false,
}) {
  const section = document.createElement('section');
  section.className = 'calendar-expense-summary';
  section.dataset.calendarExpenseSummary = state;
  section.setAttribute(
    'aria-label',
    monthLabel ? `${monthLabel} 지출 합계` : '지출 합계',
  );

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
  presentation.lines.forEach(line => section.appendChild(currencyLine(line)));

  return section;
}
