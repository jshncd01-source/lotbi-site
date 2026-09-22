// Calendar expense summary — the category totals strip under the month view.
//
// It shows only what the owner already saved on a Calendar entry. An expense
// that was never recorded is simply missing from the table; nothing here is
// estimated, inferred, or filled in on the owner's behalf. The section is also
// never removed when a month has no amounts — an empty month has to read as
// "nothing recorded", not as a table that failed to load.

const CATEGORY_LABELS = {
  FOOD: '음식',
  TRAVEL: '여행',
  SHOPPING: '쇼핑',
  LIVING: '생활비',
  UNCLASSIFIED: '미분류',
};

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

function totalsTable(currencyTotals, {showCurrencyName}) {
  const table = document.createElement('table');
  table.className = 'calendar-expense-table';
  table.dataset.currency = currencyTotals.currency;

  const caption = document.createElement('caption');
  caption.className = 'calendar-expense-caption';
  caption.textContent = showCurrencyName
    ? `${currencyTotals.currency} 카테고리별 지출`
    : '카테고리별 지출';
  table.appendChild(caption);

  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const [label, scope] of [['항목', 'col'], ['합계', 'col']]) {
    const cell = document.createElement('th');
    cell.scope = scope;
    cell.textContent = label;
    headRow.appendChild(cell);
  }
  head.appendChild(headRow);

  const body = document.createElement('tbody');
  for (const row of currencyTotals.categories) {
    const tr = document.createElement('tr');
    tr.dataset.expenseCategory = row.expenseCategory;
    const name = document.createElement('th');
    name.scope = 'row';
    name.className = 'calendar-expense-category';
    name.textContent = expenseCategoryLabel(row.expenseCategory);
    const amount = document.createElement('td');
    amount.className = 'calendar-expense-amount';
    amount.textContent = formatExpenseAmount(row.amountMinor, currencyTotals.currency);
    tr.append(name, amount);
    body.appendChild(tr);
  }

  // 총지출 lands in the table footer, so it renders at the bottom-right of the
  // strip on every width.
  const foot = document.createElement('tfoot');
  const footRow = document.createElement('tr');
  footRow.dataset.expenseTotal = '';
  const totalLabel = document.createElement('th');
  totalLabel.scope = 'row';
  totalLabel.className = 'calendar-expense-total-label';
  totalLabel.textContent = '총지출';
  const totalAmount = document.createElement('td');
  totalAmount.className = 'calendar-expense-total-amount';
  totalAmount.textContent = formatExpenseAmount(
    currencyTotals.totalAmountMinor,
    currencyTotals.currency,
  );
  footRow.append(totalLabel, totalAmount);
  foot.appendChild(footRow);

  table.append(head, body, foot);
  return table;
}

function noticeNode(text, {status = false} = {}) {
  const node = document.createElement('p');
  node.className = 'calendar-expense-notice';
  if (status) node.setAttribute('role', 'status');
  node.textContent = text;
  return node;
}

/**
 * @param {object} options
 * @param {'loading'|'ready'|'error'|'guest'} options.state
 * @param {{currencies: Array, entriesWithoutAmount: number}|null} [options.summary]
 * @param {string} [options.monthLabel] e.g. "2026년 9월"
 * @param {string} [options.errorMessage]
 */
export function calendarExpenseSummaryNode({
  state,
  summary = null,
  monthLabel = '',
  errorMessage = '',
}) {
  const section = document.createElement('section');
  section.className = 'calendar-expense-summary';
  section.dataset.calendarExpenseSummary = state;
  section.setAttribute(
    'aria-label',
    monthLabel ? `${monthLabel} 지출 합계` : '지출 합계',
  );

  const heading = document.createElement('h3');
  heading.className = 'calendar-expense-heading';
  heading.textContent = monthLabel ? `${monthLabel} 지출` : '지출';
  section.appendChild(heading);

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

  const currencies = Array.isArray(summary?.currencies) ? summary.currencies : [];
  if (!currencies.length) {
    // An empty month keeps the section in place and says so plainly, so it is
    // never mistaken for a table that is still loading.
    section.appendChild(noticeNode('이번 달 기록 없음'));
  } else {
    const showCurrencyName = currencies.length > 1;
    for (const currencyTotals of currencies) {
      section.appendChild(totalsTable(currencyTotals, {showCurrencyName}));
    }
  }

  const withoutAmount = Number.isInteger(summary?.entriesWithoutAmount)
    ? summary.entriesWithoutAmount
    : 0;
  if (withoutAmount > 0) {
    // Say what the total does not cover rather than guessing at the missing
    // amounts.
    const note = document.createElement('p');
    note.className = 'calendar-expense-coverage';
    note.textContent = `금액이 없는 일정 ${new Intl.NumberFormat('ko-KR').format(withoutAmount)}건은 합계에 없습니다.`;
    section.appendChild(note);
  }

  return section;
}
