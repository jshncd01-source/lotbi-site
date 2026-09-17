import {readSubscriptionState} from './site-core.js';

const ACCOUNT_URL = 'https://account.lotbiai.com/account';

function find(root, selector) {
  const node = root?.querySelector?.(selector);
  return node instanceof HTMLElement ? node : undefined;
}

function setText(root, selector, value) {
  const node = find(root, selector);
  if (node) node.textContent = value;
}

function planLabel(plan) {
  return plan === 'LOTBI_PLUS' ? 'LOTBI Plus' : 'LOTBI Free';
}

function statusLabel(status) {
  const labels = {
    FREE: '무료 이용',
    ACTIVE: '이용 중',
    GRACE: '결제 유예 중',
    PAST_DUE: '결제 확인 필요',
    CANCEL_AT_PERIOD_END: '해지 예약',
    EXPIRED: '만료',
  };
  return labels[status] || status;
}

function providerLabel(provider) {
  if (provider === 'TOSS') return '웹 · Toss Payments';
  if (provider === 'APPLE') return 'iPhone · App Store';
  if (provider === 'GOOGLE_PLAY') return 'Android · Google Play';
  return '등록된 결제 경로 없음';
}

function periodLabel(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ko-KR', {dateStyle: 'medium'}).format(date);
}

export function renderSubscriptionState(state, root = globalThis.document) {
  const panel = find(root, '[data-subscription-panel]');
  if (!panel || !state) return false;

  panel.dataset.subscriptionState = 'ready';
  setText(root, '[data-subscription-summary]', `${planLabel(state.plan)} · ${statusLabel(state.status)}`);
  setText(root, '[data-subscription-usage]', `${state.usedFreeUnits} / ${state.freeUnits} 사용`);
  setText(root, '[data-subscription-remaining]', `${state.remainingFreeUnits}회`);
  setText(root, '[data-subscription-provider]', providerLabel(state.provider));
  setText(root, '[data-subscription-current-period]', periodLabel(state.currentPeriodEnd));

  const accountLink = find(root, '[data-subscription-account-link]');
  if (accountLink instanceof HTMLAnchorElement) accountLink.href = ACCOUNT_URL;
  return true;
}

export async function mountSubscription({
  sessionToken,
  fetchImpl = globalThis.fetch,
  documentRef = globalThis.document,
} = {}) {
  const panel = find(documentRef, '[data-subscription-panel]');
  if (!panel) return false;

  const token = typeof sessionToken === 'string' ? sessionToken.trim() : '';
  if (!token) return false;

  panel.dataset.subscriptionState = 'loading';
  setText(documentRef, '[data-subscription-summary]', '현재 요금제를 확인하고 있습니다.');

  try {
    const state = await readSubscriptionState(token, fetchImpl);
    return renderSubscriptionState(state, documentRef);
  } catch {
    panel.dataset.subscriptionState = 'unavailable';
    setText(documentRef, '[data-subscription-summary]', '현재 요금제는 내 계정에서 확인할 수 있습니다.');
    return false;
  }
}
