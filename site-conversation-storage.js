export const ANONYMOUS_CONVERSATION_NAMESPACE_KEY = 'lotbi.site.ux.v1.anonymous-namespace';
export const GUEST_CONVERSATION_CLAIM_INTENT_KEY = 'lotbi.site.ux.v1.guest-conversation-claim-intent';
export const GUEST_CONVERSATION_CLAIM_TTL_MS = 15 * 60 * 1000;

const STORAGE_PREFIX = 'lotbi.site.ux.v1';
const THREAD_LIMIT = 50;
const MESSAGE_LIMIT = 120;
const ANONYMOUS_NAMESPACE_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const ACCOUNT_NAMESPACE_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/;
const CLAIM_ID_PATTERN = /^[A-Za-z0-9._:-]{8,160}$/;

function optionalBrowserStorage(name) {
  try {
    return window?.[name];
  } catch {
    return undefined;
  }
}

function normalizedAnonymousNamespace(value) {
  const namespace = typeof value === 'string' ? value.trim() : '';
  return ANONYMOUS_NAMESPACE_PATTERN.test(namespace) ? namespace : '';
}

function normalizedAccountNamespace(value) {
  const namespace = typeof value === 'string' ? value.trim() : '';
  return ACCOUNT_NAMESPACE_PATTERN.test(namespace) ? namespace : '';
}

function storageKey(namespace, kind) {
  return `${STORAGE_PREFIX}.${kind}.${namespace}`;
}

function claimReceiptKey(claimId) {
  return `${STORAGE_PREFIX}.guest-claim-receipt.${claimId}`;
}

function sourceClaimGuardKey(anonymousNamespace, threadId) {
  return `${STORAGE_PREFIX}.guest-claim-source.${anonymousNamespace}.${encodeURIComponent(threadId)}`;
}

function safeParse(raw, fallback = null) {
  if (typeof raw !== 'string' || !raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function safeClone(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function safeGet(storage, key) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(storage, key, value) {
  try {
    storage?.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemove(storage, key) {
  try {
    storage?.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function normalizedThreadState(value) {
  const state = value && typeof value === 'object' ? value : {};
  return {
    threads: Array.isArray(state.threads) ? state.threads : [],
    activeThreadId: typeof state.activeThreadId === 'string' ? state.activeThreadId : null,
    draft: typeof state.draft === 'string' ? state.draft.slice(0, 1000) : '',
  };
}

function isMessage(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && (value.role === 'user' || value.role === 'assistant')
    && typeof value.text === 'string'
    && value.text.trim(),
  );
}

function isThread(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && typeof value.id === 'string'
    && value.id
    && typeof value.title === 'string'
    && Array.isArray(value.messages),
  );
}

function sanitizeCalendarDraft(value) {
  if (!value || typeof value !== 'object') return value;
  const draft = safeClone(value);
  if (!draft || typeof draft !== 'object') return null;
  delete draft.sourceAttachmentIds;
  delete draft.source_attachment_ids;
  return draft;
}

function sanitizeRichProduct(value) {
  if (!value || typeof value !== 'object') return value;
  const product = safeClone(value);
  if (!product || typeof product !== 'object') return null;
  // Guest/public card display may survive the claim, but a guest-side
  // resolution is never promoted into authenticated purchase authority.
  delete product.resolutionId;
  delete product.resolutionHash;
  delete product.resolution_id;
  delete product.resolution_hash;
  return product;
}

function sanitizeDisplayMeta(value) {
  const meta = value && typeof value === 'object' ? safeClone(value) : {};
  if (!meta || typeof meta !== 'object') return {};

  // Calendar candidates/actions can carry a write path. Preserve only safe
  // draft/result display state across the guest -> authenticated boundary.
  delete meta.calendarAction;
  delete meta.calendarItems;

  // Never promote attachment ownership, approvals, execution authority, or
  // merchant execution intent from guest-local history.
  for (const key of [
    'attachmentIds',
    'attachment_ids',
    'approval',
    'approvalToken',
    'approval_token',
    'executionAuthority',
    'execution_authority',
    'merchantExecutionIntent',
    'merchant_execution_intent',
  ]) delete meta[key];

  if ('calendarDraft' in meta) {
    const draft = sanitizeCalendarDraft(meta.calendarDraft);
    if (draft) meta.calendarDraft = draft;
    else delete meta.calendarDraft;
  }
  if ('richProduct' in meta) {
    const product = sanitizeRichProduct(meta.richProduct);
    if (product) meta.richProduct = product;
    else delete meta.richProduct;
  }
  return meta;
}

function safeDisplaySnapshot(thread) {
  if (!isThread(thread)) return null;
  const messages = thread.messages
    .filter(isMessage)
    .slice(-MESSAGE_LIMIT)
    .map(item => {
      const cloned = safeClone(item);
      if (!cloned || typeof cloned !== 'object') return null;
      cloned.role = item.role;
      cloned.text = item.text;
      cloned.meta = sanitizeDisplayMeta(item.meta);
      return cloned;
    })
    .filter(Boolean);
  if (!messages.length) return null;

  const snapshot = safeClone(thread);
  if (!snapshot || typeof snapshot !== 'object') return null;
  snapshot.messages = messages;
  snapshot.title = typeof thread.title === 'string' && thread.title.trim() ? thread.title : '새 대화';
  snapshot.pinned = thread.pinned === true;
  snapshot.pinnedAt = thread.pinned === true && Number.isFinite(Number(thread.pinnedAt)) ? Number(thread.pinnedAt) : 0;
  delete snapshot.guestClaimConsumed;
  delete snapshot.guestClaimId;
  delete snapshot.guestClaimedAt;
  delete snapshot.claimedFromGuest;
  return snapshot;
}

async function defaultDigestText(value) {
  const subtle = globalThis.crypto?.subtle;
  const Encoder = globalThis.TextEncoder;
  if (!subtle || typeof Encoder !== 'function') {
    throw new Error('SHA-256 is unavailable');
  }
  const digest = await subtle.digest('SHA-256', new Encoder().encode(String(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function createDefaultClaimId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `claim-${uuid || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function createDefaultThreadId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `thread-${uuid || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function validIntent(value, now) {
  if (!value || typeof value !== 'object' || value.version !== 1) return false;
  if (!CLAIM_ID_PATTERN.test(String(value.claimId || ''))) return false;
  if (!normalizedAnonymousNamespace(value.anonymousNamespace)) return false;
  if (typeof value.threadId !== 'string' || !value.threadId || value.threadId.length > 200) return false;
  if (!Number.isFinite(Number(value.startedAt))) return false;
  const age = Number(now) - Number(value.startedAt);
  if (age < 0 || age > GUEST_CONVERSATION_CLAIM_TTL_MS) return false;
  if (!Number.isFinite(Number(value.threadUpdatedAt))) return false;
  if (typeof value.sourceHash !== 'string' || !value.sourceHash) return false;
  if (typeof value.snapshotHash !== 'string' || !value.snapshotHash) return false;
  if (!isThread(value.snapshot) || value.snapshot.id !== value.threadId || !value.snapshot.messages.some(isMessage)) return false;
  return true;
}

function clearClaimIntent(sessionStorage) {
  safeRemove(sessionStorage, GUEST_CONVERSATION_CLAIM_INTENT_KEY);
}

function accountClaimThread(accountState, claimId) {
  return accountState.threads.find(item => (
    item
    && typeof item === 'object'
    && item.claimedFromGuest?.claimId === claimId
  ));
}

export function guestConversationThreadClaimed({
  anonymousNamespace,
  threadId,
  durableStorage = optionalBrowserStorage('localStorage'),
} = {}) {
  const namespace = normalizedAnonymousNamespace(anonymousNamespace);
  const id = typeof threadId === 'string' ? threadId.trim() : '';
  if (!namespace || !id || !durableStorage) return false;
  const guard = safeParse(safeGet(durableStorage, sourceClaimGuardKey(namespace, id)), null);
  return Boolean(
    guard
    && guard.version === 1
    && guard.anonymousNamespace === namespace
    && guard.sourceThreadId === id
    && CLAIM_ID_PATTERN.test(String(guard.claimId || ''))
  );
}

function markSourceConsumed(sourceState, intent, accountThreadId, now) {
  let found = false;
  const threads = sourceState.threads.map(item => {
    if (!item || item.id !== intent.threadId) return item;
    found = true;
    return {
      ...item,
      guestClaimConsumed: true,
      guestClaimId: intent.claimId,
      guestClaimedAt: Number(now),
    };
  });
  return {
    found,
    state: {
      ...sourceState,
      threads,
      activeThreadId: sourceState.activeThreadId === intent.threadId ? null : sourceState.activeThreadId,
    },
    receipt: {
      version: 1,
      claimId: intent.claimId,
      anonymousNamespace: intent.anonymousNamespace,
      sourceThreadId: intent.threadId,
      accountThreadId,
      claimedAt: Number(now),
    },
  };
}

export function ensureDurableAnonymousConversationNamespace({
  durableStorage = optionalBrowserStorage('localStorage'),
  legacySessionStorage = optionalBrowserStorage('sessionStorage'),
  createNamespace = () => `anonymous-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`,
} = {}) {
  let value = '';

  try {
    value = normalizedAnonymousNamespace(
      durableStorage?.getItem(ANONYMOUS_CONVERSATION_NAMESPACE_KEY),
    );
  } catch {}

  // Only the namespace from the still-live legacy session can be migrated safely.
  // Older orphaned namespace data is intentionally neither enumerated nor merged.
  if (!value) {
    try {
      value = normalizedAnonymousNamespace(
        legacySessionStorage?.getItem(ANONYMOUS_CONVERSATION_NAMESPACE_KEY),
      );
    } catch {}
  }

  if (!value) value = normalizedAnonymousNamespace(createNamespace());
  if (!value) return '';

  try {
    durableStorage?.setItem(ANONYMOUS_CONVERSATION_NAMESPACE_KEY, value);
  } catch {}
  try {
    legacySessionStorage?.setItem(ANONYMOUS_CONVERSATION_NAMESPACE_KEY, value);
  } catch {}

  return value;
}

export async function prepareGuestConversationClaimIntent({
  durableStorage = optionalBrowserStorage('localStorage'),
  sessionStorage = optionalBrowserStorage('sessionStorage'),
  now = Date.now(),
  createClaimId = createDefaultClaimId,
  digestText = defaultDigestText,
} = {}) {
  const anonymousNamespace = ensureDurableAnonymousConversationNamespace({
    durableStorage,
    legacySessionStorage: sessionStorage,
  });
  if (!anonymousNamespace || !durableStorage || !sessionStorage) return null;

  const sourceState = normalizedThreadState(
    safeParse(safeGet(durableStorage, storageKey(anonymousNamespace, 'threads')), {}),
  );
  const activeThread = sourceState.threads.find(item => item?.id === sourceState.activeThreadId);
  if (
    !isThread(activeThread)
    || activeThread.guestClaimConsumed === true
    || guestConversationThreadClaimed({
      anonymousNamespace,
      threadId: activeThread?.id,
      durableStorage,
    })
    || !activeThread.messages.some(isMessage)
  ) {
    clearClaimIntent(sessionStorage);
    return null;
  }

  const snapshot = safeDisplaySnapshot(activeThread);
  if (!snapshot) {
    clearClaimIntent(sessionStorage);
    return null;
  }

  const claimId = String(createClaimId() || '').trim();
  if (!CLAIM_ID_PATTERN.test(claimId)) {
    clearClaimIntent(sessionStorage);
    return null;
  }

  let sourceHash;
  let snapshotHash;
  try {
    sourceHash = await digestText(JSON.stringify(activeThread));
    snapshotHash = await digestText(JSON.stringify(snapshot));
  } catch {
    clearClaimIntent(sessionStorage);
    return null;
  }
  if (!sourceHash || !snapshotHash) {
    clearClaimIntent(sessionStorage);
    return null;
  }

  const intent = {
    version: 1,
    claimId,
    anonymousNamespace,
    threadId: activeThread.id,
    threadUpdatedAt: Number.isFinite(Number(activeThread.updatedAt)) ? Number(activeThread.updatedAt) : 0,
    startedAt: Number(now),
    sourceHash: String(sourceHash),
    snapshotHash: String(snapshotHash),
    snapshot,
  };
  if (!safeSet(sessionStorage, GUEST_CONVERSATION_CLAIM_INTENT_KEY, JSON.stringify(intent))) return null;
  return Object.freeze(safeClone(intent));
}

export async function claimGuestConversationToAccount({
  accountNamespace,
  durableStorage = optionalBrowserStorage('localStorage'),
  sessionStorage = optionalBrowserStorage('sessionStorage'),
  now = Date.now(),
  createThreadId = createDefaultThreadId,
  digestText = defaultDigestText,
} = {}) {
  const accountKey = normalizedAccountNamespace(accountNamespace);
  if (!accountKey || !durableStorage || !sessionStorage) return Object.freeze({status: 'NO_INTENT'});

  const intent = safeParse(safeGet(sessionStorage, GUEST_CONVERSATION_CLAIM_INTENT_KEY), null);
  if (!intent) return Object.freeze({status: 'NO_INTENT'});
  if (!validIntent(intent, now)) {
    clearClaimIntent(sessionStorage);
    return Object.freeze({status: 'INVALID_OR_EXPIRED'});
  }

  const receipt = safeParse(safeGet(durableStorage, claimReceiptKey(intent.claimId)), null);
  const accountStorageKey = storageKey(accountKey, 'threads');
  const accountStateRaw = safeGet(durableStorage, accountStorageKey);
  const accountState = normalizedThreadState(safeParse(accountStateRaw, {}));

  if (receipt && receipt.version === 1 && receipt.claimId === intent.claimId) {
    if (receipt.accountNamespace && receipt.accountNamespace !== accountKey) {
      clearClaimIntent(sessionStorage);
      return Object.freeze({status: 'CROSS_ACCOUNT_BLOCKED'});
    }
    const accountThread = accountState.threads.find(item => item?.id === receipt.accountThreadId)
      || accountClaimThread(accountState, intent.claimId);
    if (!accountThread) {
      clearClaimIntent(sessionStorage);
      return Object.freeze({status: 'RECEIPT_INCONSISTENT'});
    }
    accountState.activeThreadId = accountThread.id;
    safeSet(durableStorage, accountStorageKey, JSON.stringify(accountState));
    clearClaimIntent(sessionStorage);
    return Object.freeze({status: 'ALREADY_APPLIED', accountThreadId: accountThread.id, claimId: intent.claimId});
  }

  const sourceStorageKey = storageKey(intent.anonymousNamespace, 'threads');
  const sourceState = normalizedThreadState(safeParse(safeGet(durableStorage, sourceStorageKey), {}));
  if (sourceState.activeThreadId !== intent.threadId) {
    clearClaimIntent(sessionStorage);
    return Object.freeze({status: 'SOURCE_CHANGED'});
  }
  const sourceThread = sourceState.threads.find(item => item?.id === intent.threadId);
  if (!isThread(sourceThread) || sourceThread.guestClaimConsumed === true) {
    clearClaimIntent(sessionStorage);
    return Object.freeze({status: sourceThread?.guestClaimConsumed === true ? 'SOURCE_ALREADY_CLAIMED' : 'SOURCE_MISSING'});
  }
  if (
    Number.isFinite(Number(sourceThread.updatedAt))
    && Number(sourceThread.updatedAt) !== Number(intent.threadUpdatedAt)
  ) {
    clearClaimIntent(sessionStorage);
    return Object.freeze({status: 'SOURCE_CHANGED'});
  }

  let sourceHash;
  let snapshotHash;
  try {
    sourceHash = await digestText(JSON.stringify(sourceThread));
    snapshotHash = await digestText(JSON.stringify(intent.snapshot));
  } catch {
    clearClaimIntent(sessionStorage);
    return Object.freeze({status: 'HASH_UNAVAILABLE'});
  }
  if (String(sourceHash) !== intent.sourceHash || String(snapshotHash) !== intent.snapshotHash) {
    clearClaimIntent(sessionStorage);
    return Object.freeze({status: 'SOURCE_CHANGED'});
  }

  // Recover idempotently if the account write succeeded but a prior attempt
  // was interrupted before the receipt/source marker could be persisted.
  const alreadyImported = accountClaimThread(accountState, intent.claimId);
  if (alreadyImported) {
    safeSet(durableStorage, sourceClaimGuardKey(intent.anonymousNamespace, intent.threadId), JSON.stringify({
      version: 1,
      claimId: intent.claimId,
      anonymousNamespace: intent.anonymousNamespace,
      sourceThreadId: intent.threadId,
      accountNamespace: accountKey,
      accountThreadId: alreadyImported.id,
      claimedAt: Number(now),
    }));
    const consumed = markSourceConsumed(sourceState, intent, alreadyImported.id, now);
    if (consumed.found) safeSet(durableStorage, sourceStorageKey, JSON.stringify(consumed.state));
    safeSet(durableStorage, claimReceiptKey(intent.claimId), JSON.stringify({
      ...consumed.receipt,
      accountNamespace: accountKey,
    }));
    accountState.activeThreadId = alreadyImported.id;
    safeSet(durableStorage, accountStorageKey, JSON.stringify(accountState));
    clearClaimIntent(sessionStorage);
    return Object.freeze({status: 'ALREADY_APPLIED', accountThreadId: alreadyImported.id, claimId: intent.claimId});
  }

  if (accountState.threads.length >= THREAD_LIMIT) {
    clearClaimIntent(sessionStorage);
    return Object.freeze({status: 'ACCOUNT_THREAD_CAPACITY'});
  }

  const existingIds = new Set(accountState.threads.map(item => item?.id).filter(Boolean));
  let accountThreadId = intent.threadId;
  if (existingIds.has(accountThreadId)) {
    let attempts = 0;
    do {
      accountThreadId = String(createThreadId() || '').trim();
      attempts += 1;
    } while ((!accountThreadId || existingIds.has(accountThreadId)) && attempts < 8);
    if (!accountThreadId || existingIds.has(accountThreadId)) {
      clearClaimIntent(sessionStorage);
      return Object.freeze({status: 'THREAD_ID_COLLISION'});
    }
  }

  const importedThread = safeClone(intent.snapshot);
  if (!isThread(importedThread)) {
    clearClaimIntent(sessionStorage);
    return Object.freeze({status: 'INVALID_SNAPSHOT'});
  }
  importedThread.id = accountThreadId;
  importedThread.claimedFromGuest = {
    claimId: intent.claimId,
    sourceThreadId: intent.threadId,
    snapshotHash: intent.snapshotHash,
    claimedAt: Number(now),
  };
  accountState.threads = [importedThread, ...accountState.threads];
  accountState.activeThreadId = accountThreadId;
  // Account draft is intentionally preserved; only the visible conversation is claimed.
  if (!safeSet(durableStorage, accountStorageKey, JSON.stringify(accountState))) {
    return Object.freeze({status: 'STORAGE_ERROR'});
  }

  const sourceGuard = {
    version: 1,
    claimId: intent.claimId,
    anonymousNamespace: intent.anonymousNamespace,
    sourceThreadId: intent.threadId,
    accountNamespace: accountKey,
    accountThreadId,
    claimedAt: Number(now),
  };
  if (!safeSet(
    durableStorage,
    sourceClaimGuardKey(intent.anonymousNamespace, intent.threadId),
    JSON.stringify(sourceGuard),
  )) {
    if (accountStateRaw === null) safeRemove(durableStorage, accountStorageKey);
    else safeSet(durableStorage, accountStorageKey, accountStateRaw);
    return Object.freeze({status: 'STORAGE_ERROR'});
  }

  const consumed = markSourceConsumed(sourceState, intent, accountThreadId, now);
  if (!consumed.found || !safeSet(durableStorage, sourceStorageKey, JSON.stringify(consumed.state))) {
    // The account copy already contains claimId. A retry will detect it and
    // repair the source marker without creating another account thread.
    return Object.freeze({status: 'SOURCE_MARKER_PENDING', accountThreadId, claimId: intent.claimId});
  }

  if (!safeSet(durableStorage, claimReceiptKey(intent.claimId), JSON.stringify({
    ...consumed.receipt,
    accountNamespace: accountKey,
  }))) {
    return Object.freeze({status: 'RECEIPT_PENDING', accountThreadId, claimId: intent.claimId});
  }

  clearClaimIntent(sessionStorage);
  return Object.freeze({status: 'APPLIED', accountThreadId, claimId: intent.claimId});
}

if (
  typeof window !== 'undefined'
  && typeof document !== 'undefined'
  && document.getElementById('lotbi-prompt')
) {
  ensureDurableAnonymousConversationNamespace();
}
