import {CORE_ORIGIN} from './site-core.js?v=aset-769a42fd66ce';

const MESSAGES = Object.freeze({
  LIFE_WALLET_ITEM_LIMIT_REACHED: 'Life Wallet 저장 한도에 도달했습니다. 기존 자료는 그대로 보관되며 새 자료만 추가할 수 없습니다.',
  LIFE_WALLET_PLAN_UNAVAILABLE: '현재 플랜에서는 Life Wallet 자료를 더 추가할 수 없습니다.',
  SESSION_REQUIRED: '로그인이 필요합니다. 다시 로그인해 주세요.',
  SESSION_INVALID: '로그인이 만료되었습니다. 다시 로그인해 주세요.',
  SESSION_EXPIRED: '로그인이 만료되었습니다. 다시 로그인해 주세요.',
});

export class WalletCapacityError extends Error {
  constructor(code, status = 0, message = '') {
    super(message || MESSAGES[code] || 'Life Wallet 저장 한도를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    this.name = 'WalletCapacityError';
    this.code = code;
    this.status = status;
  }
}

async function itemRef(itemId) {
  const value = new TextEncoder().encode(`lotbi-life-wallet-capacity:${itemId}`);
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', value));
  return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export function createWalletCapacity({sessionToken, fetchImpl = globalThis.fetch} = {}) {
  const request = async (path, {method = 'GET', body} = {}) => {
    let response;
    try {
      response = await fetchImpl(`${CORE_ORIGIN}/v2/life-wallet/capacity${path}`, {
        method, mode: 'cors', credentials: 'omit', cache: 'no-store',
        headers: {Authorization: `Bearer ${sessionToken}`, ...(body === undefined ? {} : {'Content-Type': 'application/json'})},
        ...(body === undefined ? {} : {body: JSON.stringify(body)}),
      });
    } catch {
      throw new WalletCapacityError('NETWORK');
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = payload?.detail || {};
      throw new WalletCapacityError(detail.code || `HTTP_${response.status}`, response.status, detail.message || '');
    }
    return payload;
  };
  return Object.freeze({
    describe: () => request(''),
    async sync(itemIds) {
      const refs = await Promise.all([...new Set(itemIds)].map(itemRef));
      if (!refs.length) return null;
      return request('/sync', {method: 'PUT', body: {item_refs: refs}});
    },
    async reserve(itemId) { return request(`/items/${await itemRef(itemId)}`, {method: 'PUT'}); },
    async release(itemId) { return request(`/items/${await itemRef(itemId)}`, {method: 'DELETE'}); },
  });
}
