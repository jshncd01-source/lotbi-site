// CONVERSATION-ACCOUNT-SYNC-01 — 대표(2026-10-09): 로그인 사용자의 대화 기록을
// 계정에 저장해서 휴대폰·PC 어느 기기에서든 이어 보게 한다.
//
// The browser copy (lotbi.site.ux.v1.threads.<namespace>) stays the screen's
// source of truth; this module keeps it in step with the account copy in
// Core (/v2/conversation-history):
//
// - Merge, never overwrite. A message is uploaded once under its own id and
//   messages from other devices are added by id. Only a conversation's title
//   and pin are last-write.
// - Offline or failing: the device copy keeps working and "동기화 대기" shows
//   until the next successful upload (retry with back-off, on reconnect and
//   when the tab comes back).
// - Existing device conversations are uploaded only after the reader says yes,
//   asked once per account on this device. No keeps them on this device only.
// - Sync off: what is written after that stays on this device.
// - Guests: nothing here runs; their history stays on the device as before.
//
// Nothing in this module ever reads another namespace: a different account on
// the same browser has a different namespace and its own engine state.
import {CORE_ORIGIN} from './site-core.js?v=aset-4477b87e3b5b';

const API = '/v2/conversation-history';
const STORAGE_PREFIX = 'lotbi.site.ux.v1';
const ENGINE_KEY = 'conversation-sync';
const CLIENT_ID = /^[A-Za-z0-9_-]{1,96}$/;
const TEXT_MAX = 20000;
const TITLE_MAX = 120;
const APPEND_BATCH = 50;
const IMPORT_THREADS = 20;
const IMPORT_MESSAGES = 1000;
const SERVER_MESSAGES_MAX = 200;
const RETENTION_MS = 365 * 24 * 60 * 60 * 1000;
const LIST_PAGE = 100;
const LIST_PAGES = 3;
const PULL_INTERVAL_MS = 90 * 1000;
const RETRY_STEPS_MS = [5000, 15000, 30000, 60000, 120000, 300000];
// Device-bound actions: an approval offered on this device must never be
// replayable from another one. Core drops them as well.
const DEVICE_ONLY_META = new Set(['calendarAction', 'calendarDraft', 'petAction']);

export const CONVERSATION_SYNC_EVENT = 'lotbi:conversation-sync-state';

class SyncRequestError extends Error {
  constructor(message, {status = 0, code = '', retryable = false} = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

async function request(fetchImpl, token, path, {method = 'GET', body} = {}) {
  if (typeof fetchImpl !== 'function') throw new SyncRequestError('network unavailable', {retryable: true});
  const value = typeof token === 'string' ? token.trim() : '';
  if (!value) throw new SyncRequestError('session required', {status: 401, code: 'SESSION_REQUIRED'});
  const headers = {Authorization: `Bearer ${value}`};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetchImpl(`${CORE_ORIGIN}${API}${path}`, {
      method,
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers,
      ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    });
  } catch {
    throw new SyncRequestError('network error', {retryable: true});
  }
  let payload = {};
  try { payload = await response.json(); } catch { payload = {}; }
  if (!response.ok) {
    const detail = payload && typeof payload.detail === 'object' && payload.detail ? payload.detail : {};
    throw new SyncRequestError(typeof detail.message === 'string' ? detail.message : `HTTP ${response.status}`, {
      status: response.status,
      code: typeof detail.code === 'string' ? detail.code : `HTTP_${response.status}`,
      retryable: response.status >= 500 || response.status === 409 || response.status === 429 || detail.retryable === true,
    });
  }
  return payload && typeof payload === 'object' ? payload : {};
}

export const conversationHistoryApi = Object.freeze({
  settings: (fetchImpl, token) => request(fetchImpl, token, '/settings'),
  saveSettings: (fetchImpl, token, syncEnabled) => request(fetchImpl, token, '/settings', {method: 'PUT', body: {sync_enabled: Boolean(syncEnabled)}}),
  list: (fetchImpl, token, cursor = '') => request(fetchImpl, token, `/threads?limit=${LIST_PAGE}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`),
  thread: (fetchImpl, token, id, afterSeq = 0) => request(fetchImpl, token, `/threads/${encodeURIComponent(id)}${afterSeq > 0 ? `?after_seq=${afterSeq}` : ''}`),
  append: (fetchImpl, token, id, body) => request(fetchImpl, token, `/threads/${encodeURIComponent(id)}/messages`, {method: 'POST', body}),
  patch: (fetchImpl, token, id, body) => request(fetchImpl, token, `/threads/${encodeURIComponent(id)}`, {method: 'PATCH', body}),
  remove: (fetchImpl, token, id) => request(fetchImpl, token, `/threads/${encodeURIComponent(id)}`, {method: 'DELETE'}),
  removeAll: (fetchImpl, token) => request(fetchImpl, token, '/threads?confirm=ALL', {method: 'DELETE'}),
  upload: (fetchImpl, token, threads) => request(fetchImpl, token, '/import', {method: 'POST', body: {threads}}),
});

const isoTime = value => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? new Date(number).toISOString() : undefined;
};
const epoch = value => {
  const parsed = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};

function fnv1a(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

// A message written before this feature has no id. Its id is derived from what
// it is (time, role, text) — never its position, which shifts as the device
// list trims — so uploading the same device twice cannot duplicate it.
export function legacyMessageId(message, seen = new Map()) {
  const created = Number.isFinite(Number(message?.createdAt)) ? Math.max(0, Math.trunc(Number(message.createdAt))) : 0;
  const role = message?.role === 'assistant' ? 'a' : 'u';
  const base = `lm-${created}-${role}-${fnv1a(String(message?.text || ''))}`;
  const count = (seen.get(base) || 0) + 1;
  seen.set(base, count);
  return count === 1 ? base : `${base}-${count}`;
}

function uploadMeta(meta) {
  if (!meta || typeof meta !== 'object') return undefined;
  const result = {};
  for (const [key, value] of Object.entries(meta)) {
    if (DEVICE_ONLY_META.has(key) || value === undefined || value === null) continue;
    if (key === 'attachments') {
      const attachments = Array.isArray(value) ? value.slice(0, 3).flatMap(item => (
        item && typeof item === 'object' && typeof item.mediaType === 'string'
          ? [{id: typeof item.id === 'string' ? item.id.slice(0, 128) : '', mediaType: item.mediaType.slice(0, 128), sizeBytes: Number.isFinite(Number(item.sizeBytes)) ? Math.max(0, Number(item.sizeBytes)) : 0}]
          : []
      )) : [];
      if (attachments.length) result.attachments = attachments;
      continue;
    }
    result[key] = value;
  }
  return Object.keys(result).length ? result : undefined;
}

function wireMessage(message, fallbackTime) {
  const created = Number(message.createdAt) > 0 ? Number(message.createdAt) : fallbackTime;
  const meta = uploadMeta(message.meta);
  return {
    id: message.id,
    role: message.role === 'assistant' ? 'assistant' : 'user',
    text: String(message.text || '').slice(0, TEXT_MAX),
    ...(isoTime(created) ? {created_at: isoTime(created)} : {}),
    ...(meta ? {meta} : {}),
  };
}

function threadMeta(record) {
  return {
    title: String(record.title || '새 대화').slice(0, TITLE_MAX),
    pinned: record.pinned === true,
    ...(record.pinned === true && isoTime(record.pinnedAt) ? {pinned_at: isoTime(record.pinnedAt)} : {}),
    ...(isoTime(record.createdAt) ? {created_at: isoTime(record.createdAt)} : {}),
  };
}

function localMessage(item, now) {
  return {
    id: item.id,
    role: item.role === 'assistant' ? 'assistant' : 'user',
    text: typeof item.text === 'string' ? item.text : '',
    createdAt: epoch(item.created_at) || now,
    meta: item.meta && typeof item.meta === 'object' ? {...item.meta} : {},
    syncedAt: now,
  };
}

const syncable = message => Boolean(message) && typeof message.id === 'string' && !message.syncedAt && !message.localOnly && !message.syncRejected;

/**
 * deps:
 *  storage, fetchImpl
 *  namespace(), token(), threads(), setThreads(list), activeThreadId(), busy()
 *  commit({rerenderActive}) — sort, save, re-render the list (and the open conversation)
 *  newId(prefix), threadLimit, messageLimit
 *  askImport(count) → Promise<'yes'|'no'|null>
 *  onStatus(status)
 */
export function createConversationSync(deps) {
  const fetchImpl = (...args) => (deps.fetchImpl || globalThis.fetch)(...args);
  let running = false;
  let generation = 0;
  let ownerNamespace = '';
  let engine = null;
  let available = false;
  let enabled = true;
  let status = 'guest';
  let flushTimer = 0;
  let flushing = false;
  let flushAgain = false;
  let retryIndex = 0;
  let pullTimer = 0;
  let lastPullAt = 0;
  let pulling = null;
  let importAsked = false;
  const loading = new Map();

  const engineKey = namespace => `${STORAGE_PREFIX}.${ENGINE_KEY}.${namespace}`;
  const readEngine = namespace => {
    let parsed = {};
    try { parsed = JSON.parse(deps.storage?.getItem(engineKey(namespace)) || '{}') || {}; } catch { parsed = {}; }
    return {
      importDecision: ['yes', 'no', 'none'].includes(parsed.importDecision) ? parsed.importDecision : null,
      decidedAt: Number.isFinite(Number(parsed.decidedAt)) ? Number(parsed.decidedAt) : 0,
      pendingDeletes: Array.isArray(parsed.pendingDeletes) ? parsed.pendingDeletes.filter(id => CLIENT_ID.test(String(id))).slice(0, 200) : [],
      pendingMeta: parsed.pendingMeta && typeof parsed.pendingMeta === 'object' ? parsed.pendingMeta : {},
      deleteAllPending: parsed.deleteAllPending === true,
      syncEnabled: parsed.syncEnabled !== false,
    };
  };
  const writeEngine = () => {
    if (!engine || !ownerNamespace) return;
    try { deps.storage?.setItem(engineKey(ownerNamespace), JSON.stringify(engine)); } catch { /* storage full: retried next change */ }
  };
  const live = myGeneration => running && myGeneration === generation && deps.namespace() === ownerNamespace;

  const setStatus = next => {
    status = next;
    try { document.body.dataset.conversationSync = next; } catch {}
    try { window.dispatchEvent(new CustomEvent(CONVERSATION_SYNC_EVENT, {detail: {status: next}})); } catch {}
    deps.onStatus?.(next);
  };
  const hasPendingWork = () => {
    if (!engine) return false;
    if (engine.deleteAllPending || engine.pendingDeletes.length || Object.keys(engine.pendingMeta).length) return true;
    return deps.threads().some(record => record.sync?.mode === 'account' && record.messages.some(syncable));
  };
  const settle = () => {
    if (!running) return;
    if (!available) setStatus('unavailable');
    else if (!enabled) setStatus('off');
    else setStatus(hasPendingWork() ? 'pending' : 'synced');
  };

  // --- classification -----------------------------------------------------
  const threadIsAccount = record => record?.sync?.mode === 'account';
  const markAccount = record => {
    if (!CLIENT_ID.test(String(record.id || ''))) { record.sync = {mode: 'local'}; return; }
    const seen = new Map();
    for (const message of record.messages) {
      if (typeof message.id !== 'string' || !CLIENT_ID.test(message.id)) message.id = legacyMessageId(message, seen);
    }
    record.sync = {mode: 'account', remote: Boolean(record.sync?.remote), lastSeq: Number(record.sync?.lastSeq) || 0, loaded: true, metaAt: 0};
  };
  const legacyThreads = () => deps.threads().filter(record => !record.sync && record.messages.length > 0
    && !(engine.decidedAt && Number(record.createdAt) > engine.decidedAt));
  // A conversation started after the decision (or in the moment before sync
  // started on this page) is a new account conversation.
  const adoptUnclassified = () => {
    let changed = false;
    for (const record of deps.threads()) {
      if (record.sync) continue;
      if (engine.importDecision && Number(record.createdAt) > engine.decidedAt) {
        if (enabled) markAccount(record); else record.sync = {mode: 'local'};
        changed = true;
      } else if (!record.messages.length) {
        if (enabled) markAccount(record); else record.sync = {mode: 'local'};
        changed = true;
      }
    }
    return changed;
  };

  // A message written before the sync code loaded on this page has no id yet.
  const assignMissingIds = () => {
    let changed = false;
    for (const record of deps.threads()) {
      if (!threadIsAccount(record)) continue;
      const seen = new Map();
      for (const message of record.messages) {
        if (typeof message.id === 'string' && CLIENT_ID.test(message.id)) continue;
        message.id = legacyMessageId(message, seen);
        changed = true;
      }
    }
    return changed;
  };
  // Sync is off: whatever is not on the account yet stays on this device.
  const keepUnsentOnDevice = () => {
    let changed = false;
    for (const record of deps.threads()) {
      if (!record.sync && engine?.importDecision) { record.sync = {mode: 'local'}; changed = true; continue; }
      if (!threadIsAccount(record)) continue;
      for (const message of record.messages) {
        if (!message.syncedAt && !message.localOnly) { message.localOnly = true; changed = true; }
      }
    }
    return changed;
  };

  // --- pull ------------------------------------------------------------------
  const mergeMessages = (record, incoming) => {
    const byId = new Map(record.messages.filter(item => typeof item.id === 'string').map(item => [item.id, item]));
    let added = 0;
    for (const item of incoming) {
      if (!item || typeof item.id !== 'string' || byId.has(item.id)) {
        const existing = byId.get(item?.id);
        if (existing && !existing.syncedAt) existing.syncedAt = Date.now();
        continue;
      }
      const message = localMessage(item, Date.now());
      record.messages.push(message);
      byId.set(message.id, message);
      added += 1;
    }
    if (added) {
      record.messages = record.messages
        .map((message, index) => ({message, index}))
        .sort((a, b) => (Number(a.message.createdAt) || 0) - (Number(b.message.createdAt) || 0) || a.index - b.index)
        .map(entry => entry.message)
        .slice(-deps.messageLimit);
      const last = record.messages[record.messages.length - 1];
      if (last && Number(last.createdAt) > Number(record.updatedAt || 0)) record.updatedAt = Number(last.createdAt);
    }
    return added;
  };

  const loadThread = async (record, myGeneration) => {
    const token = deps.token();
    const afterSeq = record.sync?.loaded ? Number(record.sync.lastSeq) || 0 : 0;
    const payload = await conversationHistoryApi.thread(fetchImpl, token, record.id, afterSeq);
    if (!live(myGeneration)) return false;
    const current = deps.threads().find(item => item.id === record.id);
    if (!current) return false;
    const messages = Array.isArray(payload.messages) ? payload.messages : [];
    const added = mergeMessages(current, messages);
    const lastSeq = Number(payload.thread?.last_seq) || 0;
    current.sync = {...current.sync, mode: 'account', remote: true, loaded: true, lastSeq: Math.max(Number(current.sync?.lastSeq) || 0, lastSeq)};
    return added > 0 || !record.sync?.loaded;
  };

  const ensureLoaded = id => {
    const record = deps.threads().find(item => item.id === id);
    if (!running || !available || !enabled || !record || !threadIsAccount(record) || !record.sync.remote) return Promise.resolve(false);
    if (loading.has(id)) return loading.get(id);
    const myGeneration = generation;
    const job = loadThread(record, myGeneration)
      .then(changed => {
        if (changed && live(myGeneration)) deps.commit({rerenderActive: deps.activeThreadId() === id && !deps.busy()});
        return changed;
      })
      .catch(error => {
        if (error?.status === 404 && live(myGeneration)) {
          const current = deps.threads().find(item => item.id === id);
          if (current) current.sync = {...current.sync, remote: false};
        }
        return false;
      })
      .finally(() => loading.delete(id));
    loading.set(id, job);
    return job;
  };

  const pull = async myGeneration => {
    const token = deps.token();
    const remote = [];
    let cursor = '';
    for (let page = 0; page < LIST_PAGES; page += 1) {
      const payload = await conversationHistoryApi.list(fetchImpl, token, cursor);
      if (!live(myGeneration)) return;
      remote.push(...(Array.isArray(payload.threads) ? payload.threads : []));
      cursor = typeof payload.next_cursor === 'string' ? payload.next_cursor : '';
      if (!cursor) break;
    }
    const complete = !cursor;
    if (engine.deleteAllPending) return;
    const pendingDeletes = new Set(engine.pendingDeletes);
    const threads = deps.threads();
    const byId = new Map(threads.map(record => [record.id, record]));
    const remoteIds = new Set();
    let changed = false;
    const refresh = [];
    for (const item of remote) {
      if (!item || typeof item.id !== 'string' || !CLIENT_ID.test(item.id) || pendingDeletes.has(item.id)) continue;
      remoteIds.add(item.id);
      const local = byId.get(item.id);
      if (!local) {
        threads.push({
          id: item.id,
          title: typeof item.title === 'string' && item.title.trim() ? item.title.trim().slice(0, 60) : '새 대화',
          pinned: item.pinned === true,
          pinnedAt: item.pinned === true ? epoch(item.pinned_at) || epoch(item.updated_at) : 0,
          stateVersion: 0,
          createdAt: epoch(item.created_at) || Date.now(),
          updatedAt: epoch(item.last_message_at) || Date.now(),
          messages: [],
          sync: {mode: 'account', remote: true, loaded: false, lastSeq: 0, metaAt: epoch(item.updated_at)},
        });
        changed = true;
        continue;
      }
      if (!threadIsAccount(local)) continue;
      if (!local.sync.remote) { local.sync.remote = true; changed = true; }
      const remoteMetaAt = epoch(item.updated_at);
      if (!engine.pendingMeta[local.id] && remoteMetaAt > (Number(local.sync.metaAt) || 0)) {
        const title = typeof item.title === 'string' && item.title.trim() ? item.title.trim().slice(0, 60) : local.title;
        if (title !== local.title || (item.pinned === true) !== (local.pinned === true)) {
          local.title = title;
          local.pinned = item.pinned === true;
          local.pinnedAt = local.pinned ? epoch(item.pinned_at) || remoteMetaAt : 0;
          changed = true;
        }
        local.sync.metaAt = remoteMetaAt;
      }
      if (local.sync.loaded && (Number(item.last_seq) || 0) > (Number(local.sync.lastSeq) || 0)) refresh.push(local);
    }
    if (complete) {
      // Gone from the account (deleted on another device, or past one year).
      for (const record of [...threads]) {
        if (!threadIsAccount(record) || !record.sync.remote || remoteIds.has(record.id)) continue;
        if (record.messages.some(message => !message.syncedAt && !message.localOnly)) {
          // Written here while it was deleted elsewhere: upload it again whole.
          record.sync = {...record.sync, remote: false, lastSeq: 0};
          for (const message of record.messages) if (!message.localOnly) delete message.syncedAt;
        } else {
          threads.splice(threads.indexOf(record), 1);
          if (deps.activeThreadId() === record.id) deps.onActiveRemoved?.();
        }
        changed = true;
      }
    }
    // Keep the device list bounded: drop the oldest account copies that are
    // already safe on the server, never a conversation with unsent messages.
    if (threads.length > deps.threadLimit) {
      const removable = threads
        .filter(record => threadIsAccount(record) && record.sync.remote && !record.messages.some(syncable) && record.pinned !== true && record.id !== deps.activeThreadId())
        .sort((a, b) => Number(a.updatedAt || 0) - Number(b.updatedAt || 0));
      while (threads.length > deps.threadLimit && removable.length) {
        threads.splice(threads.indexOf(removable.shift()), 1);
      }
    }
    deps.setThreads(threads);
    let activeChanged = false;
    for (const record of refresh) {
      try {
        const updated = await loadThread(record, myGeneration);
        if (!live(myGeneration)) return;
        if (updated) { changed = true; if (record.id === deps.activeThreadId()) activeChanged = true; }
      } catch { /* the next pull retries */ }
    }
    lastPullAt = Date.now();
    if (changed) deps.commit({rerenderActive: activeChanged && !deps.busy()});
  };

  // --- upload ----------------------------------------------------------------
  const uploadDeviceThreads = async (records, myGeneration) => {
    const now = Date.now();
    const batches = [];
    let current = [];
    let count = 0;
    for (const record of records) {
      const messages = record.messages
        .filter(syncable)
        .filter(message => (Number(message.createdAt) || now) > now - RETENTION_MS)
        .slice(-SERVER_MESSAGES_MAX)
        .map(message => wireMessage(message, Number(record.createdAt) || now));
      if (current.length >= IMPORT_THREADS || count + messages.length > IMPORT_MESSAGES) {
        if (current.length) batches.push(current);
        current = []; count = 0;
      }
      current.push({record, payload: {id: record.id, ...threadMeta(record), messages}});
      count += messages.length;
    }
    if (current.length) batches.push(current);
    for (const batch of batches) {
      await conversationHistoryApi.upload(fetchImpl, deps.token(), batch.map(entry => entry.payload));
      if (!live(myGeneration)) return;
      const stamp = Date.now();
      for (const {record} of batch) {
        record.sync = {...record.sync, remote: true};
        for (const message of record.messages) if (syncable(message)) message.syncedAt = stamp;
      }
      deps.commit({rerenderActive: false});
    }
  };

  const flushOnce = async myGeneration => {
    const token = () => deps.token();
    if (engine.deleteAllPending) {
      await conversationHistoryApi.removeAll(fetchImpl, token());
      if (!live(myGeneration)) return;
      engine.deleteAllPending = false; engine.pendingDeletes = []; engine.pendingMeta = {};
      writeEngine();
    }
    for (const id of [...engine.pendingDeletes]) {
      await conversationHistoryApi.remove(fetchImpl, token(), id);
      if (!live(myGeneration)) return;
      engine.pendingDeletes = engine.pendingDeletes.filter(item => item !== id);
      delete engine.pendingMeta[id];
      writeEngine();
    }
    if (!enabled) return;
    if (assignMissingIds()) deps.commit({rerenderActive: false});
    const threads = deps.threads();
    const fresh = threads.filter(record => threadIsAccount(record) && !record.sync.remote && record.messages.some(syncable));
    if (fresh.length) await uploadDeviceThreads(fresh, myGeneration);
    if (!live(myGeneration)) return;
    for (const record of deps.threads()) {
      if (!threadIsAccount(record) || !record.sync.remote) continue;
      let pending = record.messages.filter(syncable);
      while (pending.length) {
        const chunk = pending.slice(0, APPEND_BATCH);
        try {
          await conversationHistoryApi.append(fetchImpl, token(), record.id, {
            thread: threadMeta(record),
            messages: chunk.map(message => wireMessage(message, Number(record.createdAt) || Date.now())),
          });
        } catch (error) {
          if (error?.status === 422) {
            // A message this server will never take must not block the rest.
            for (const message of chunk) message.syncRejected = true;
            deps.commit({rerenderActive: false});
            pending = pending.slice(APPEND_BATCH);
            continue;
          }
          throw error;
        }
        if (!live(myGeneration)) return;
        const stamp = Date.now();
        for (const message of chunk) message.syncedAt = stamp;
        deps.commit({rerenderActive: false});
        pending = pending.slice(APPEND_BATCH);
      }
    }
    for (const [id, change] of Object.entries({...engine.pendingMeta})) {
      const record = deps.threads().find(item => item.id === id);
      if (!record || !threadIsAccount(record) || !record.sync.remote) { delete engine.pendingMeta[id]; writeEngine(); continue; }
      try {
        const payload = await conversationHistoryApi.patch(fetchImpl, token(), id, {
          title: String(record.title || '새 대화').slice(0, TITLE_MAX),
          pinned: record.pinned === true,
          ...(record.pinned === true && isoTime(record.pinnedAt) ? {pinned_at: isoTime(record.pinnedAt)} : {}),
        });
        if (!live(myGeneration)) return;
        record.sync.metaAt = epoch(payload.thread?.updated_at) || Date.now();
      } catch (error) {
        if (error?.status !== 404) throw error;
      }
      if (engine.pendingMeta[id] === change) delete engine.pendingMeta[id];
      writeEngine();
    }
  };

  const flush = async () => {
    if (!running || !available) return;
    if (flushing) { flushAgain = true; return; }
    flushing = true;
    const myGeneration = generation;
    try {
      await flushOnce(myGeneration);
      if (!live(myGeneration)) return;
      retryIndex = 0;
      settle();
    } catch (error) {
      if (!live(myGeneration)) return;
      if (error?.code === 'CONVERSATION_HISTORY_SYNC_DISABLED') {
        enabled = false; engine.syncEnabled = false; writeEngine(); settle(); return;
      }
      setStatus('pending');
      const delay = RETRY_STEPS_MS[Math.min(retryIndex, RETRY_STEPS_MS.length - 1)];
      retryIndex += 1;
      clearTimeout(flushTimer);
      flushTimer = setTimeout(() => { void flush(); }, delay);
    } finally {
      flushing = false;
      if (flushAgain && live(myGeneration)) { flushAgain = false; schedule(); }
    }
  };

  const schedule = (delay = 400) => {
    if (!running) return;
    if (hasPendingWork() && status !== 'off' && status !== 'unavailable') setStatus(status === 'pending' ? 'pending' : 'saving');
    clearTimeout(flushTimer);
    flushTimer = setTimeout(() => { void flush(); }, delay);
  };

  const pullNow = (force = false) => {
    if (!running || !available || !enabled) return Promise.resolve();
    if (!force && Date.now() - lastPullAt < 15000) return Promise.resolve();
    if (pulling) return pulling;
    const myGeneration = generation;
    pulling = pull(myGeneration)
      .then(() => { if (live(myGeneration)) settle(); })
      .catch(() => { if (live(myGeneration)) setStatus('pending'); })
      .finally(() => { pulling = null; });
    return pulling;
  };

  // --- device upload question (asked once per account on this device) -------
  const decideImport = async myGeneration => {
    if (engine.importDecision || importAsked) return;
    const candidates = legacyThreads();
    if (!candidates.length) {
      // Nothing to ask about on this device: everything from now on is new.
      engine.importDecision = 'none'; engine.decidedAt = Date.now();
      writeEngine();
      return;
    }
    importAsked = true;
    let answer = null;
    try { answer = await deps.askImport(candidates.length); } catch { answer = null; }
    if (!live(myGeneration)) return;
    if (answer !== 'yes' && answer !== 'no') { importAsked = false; return; }
    engine.importDecision = answer;
    engine.decidedAt = Date.now();
    for (const record of legacyThreads()) {
      if (answer === 'yes') markAccount(record); else record.sync = {mode: 'local'};
    }
    writeEngine();
    deps.commit({rerenderActive: false});
    if (answer === 'yes') schedule(0);
  };

  const onOnline = () => { if (running) { retryIndex = 0; schedule(0); void pullNow(true); } };
  const onVisible = () => {
    if (!running || document.visibilityState !== 'visible') return;
    void pullNow();
    if (hasPendingWork()) schedule(0);
  };

  const start = async () => {
    const namespace = deps.namespace();
    const token = deps.token();
    if (!namespace || !token) return;
    if (running && ownerNamespace === namespace) { void pullNow(); return; }
    stop();
    running = true;
    generation += 1;
    const myGeneration = generation;
    ownerNamespace = namespace;
    engine = readEngine(namespace);
    enabled = engine.syncEnabled;
    available = true;
    importAsked = false;
    setStatus('loading');
    try {
      const settings = await conversationHistoryApi.settings(fetchImpl, token);
      if (!live(myGeneration)) return;
      available = settings.available !== false;
      enabled = settings.sync_enabled !== false;
      engine.syncEnabled = enabled; writeEngine();
    } catch (error) {
      if (!live(myGeneration)) return;
      // Offline or failing: keep the device copy, remember the last choice and
      // show "동기화 대기" until it can be reached.
      if (adoptUnclassified()) deps.commit({rerenderActive: false});
      setStatus('pending');
      retryIndex = 0;
      clearTimeout(flushTimer);
      flushTimer = setTimeout(() => { if (live(myGeneration)) { running = false; ownerNamespace = ''; void start(); } }, RETRY_STEPS_MS[0]);
      return;
    }
    if (!available) { settle(); return; }
    let classified = adoptUnclassified();
    if (assignMissingIds()) classified = true;
    if (!enabled && keepUnsentOnDevice()) classified = true;
    if (classified) deps.commit({rerenderActive: false});
    if (enabled) {
      try { await pull(myGeneration); } catch { if (live(myGeneration)) setStatus('pending'); }
      if (!live(myGeneration)) return;
      await decideImport(myGeneration);
      if (!live(myGeneration)) return;
    }
    settle();
    if (hasPendingWork()) schedule(0);
    clearInterval(pullTimer);
    pullTimer = setInterval(() => { if (document.visibilityState === 'visible') void pullNow(); }, PULL_INTERVAL_MS);
  };

  function stop() {
    running = false;
    generation += 1;
    clearTimeout(flushTimer);
    clearInterval(pullTimer);
    flushTimer = 0; pullTimer = 0;
    ownerNamespace = '';
    engine = null;
    loading.clear();
    pulling = null;
    flushAgain = false;
    retryIndex = 0;
    lastPullAt = 0;
    setStatus('guest');
  }

  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);

  return Object.freeze({
    start: () => { void start(); },
    stop,
    status: () => status,
    running: () => running,
    enabled: () => running && available && enabled,
    // Before a message joins the device copy: give it an id, and keep it on
    // this device when sync is off.
    prepareMessage(record, message) {
      if (!message || typeof message !== 'object') return;
      if (typeof message.id !== 'string' || !CLIENT_ID.test(message.id)) message.id = deps.newId('msg');
      if (!running || !engine) return;
      if (!record.sync) {
        if (!enabled) record.sync = {mode: 'local'};
        else if (engine.importDecision || !record.messages.length) markAccount(record);
      }
      if (!enabled || !available) message.localOnly = true;
    },
    noteAppended() { if (running && enabled && available) schedule(); },
    noteThreadMeta(id) {
      const record = deps.threads().find(item => item.id === id);
      if (!running || !engine || !threadIsAccount(record) || !enabled) return;
      engine.pendingMeta[id] = Date.now();
      writeEngine();
      schedule();
    },
    noteThreadDeleted(record) {
      if (!running || !engine || !threadIsAccount(record) || !record.sync.remote) return;
      engine.pendingDeletes = [...new Set([...engine.pendingDeletes, record.id])];
      delete engine.pendingMeta[record.id];
      writeEngine();
      schedule(0);
    },
    // Whether this conversation is (or will be) on the account — the delete
    // and rename dialogs say so.
    onAccount(record) { return running && threadIsAccount(record) && (Boolean(record.sync.remote) || enabled); },
    ensureLoaded,
    refresh: () => pullNow(true),
    flushNow: () => flush(),
    pendingCount: () => (engine ? deps.threads().filter(record => threadIsAccount(record) && record.messages.some(syncable)).length : 0),
    async setEnabled(next) {
      if (!running) throw new SyncRequestError('session required', {status: 401});
      const settings = await conversationHistoryApi.saveSettings(fetchImpl, deps.token(), next);
      enabled = settings.sync_enabled !== false;
      if (engine) { engine.syncEnabled = enabled; writeEngine(); }
      settle();
      if (enabled) { void pullNow(true); schedule(0); }
      return enabled;
    },
    async deleteAll() {
      if (!running || !engine) throw new SyncRequestError('session required', {status: 401});
      engine.deleteAllPending = true; engine.pendingDeletes = []; engine.pendingMeta = {};
      writeEngine();
      try {
        await conversationHistoryApi.removeAll(fetchImpl, deps.token());
        engine.deleteAllPending = false;
        writeEngine();
        settle();
        return 'deleted';
      } catch {
        setStatus('pending');
        schedule(RETRY_STEPS_MS[0]);
        return 'pending';
      }
    },
  });
}
