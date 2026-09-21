import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  ANONYMOUS_CONVERSATION_NAMESPACE_KEY,
  GUEST_CONVERSATION_CLAIM_INTENT_KEY,
  claimGuestConversationToAccount,
  ensureDurableAnonymousConversationNamespace,
  guestConversationThreadClaimed,
  prepareGuestConversationClaimIntent,
} from '../site-conversation-storage.js';

class MemoryStorage {
  constructor(entries = []) {
    this.values = new Map(entries);
  }
  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}

class FailOnceStorage extends MemoryStorage {
  constructor(entries, failKey) {
    super(entries);
    this.failKey = failKey;
    this.failed = false;
  }
  setItem(key, value) {
    if (!this.failed && key === this.failKey) {
      this.failed = true;
      throw new Error('intentional one-shot storage failure');
    }
    super.setItem(key, value);
  }
}

const durableStorage = new MemoryStorage();
const firstSession = new MemoryStorage();
const createdNamespace = ensureDurableAnonymousConversationNamespace({
  durableStorage,
  legacySessionStorage: firstSession,
  createNamespace: () => 'anonymous-focused-test',
});

assert.equal(createdNamespace, 'anonymous-focused-test');
assert.equal(durableStorage.getItem(ANONYMOUS_CONVERSATION_NAMESPACE_KEY), createdNamespace);
assert.equal(firstSession.getItem(ANONYMOUS_CONVERSATION_NAMESPACE_KEY), createdNamespace);

const reloadNamespace = ensureDurableAnonymousConversationNamespace({
  durableStorage,
  legacySessionStorage: firstSession,
  createNamespace: () => { throw new Error('reload must not create a new namespace'); },
});
assert.equal(reloadNamespace, createdNamespace, 'reload must reuse the same namespace');

const newTabSession = new MemoryStorage();
assert.equal(
  ensureDurableAnonymousConversationNamespace({
    durableStorage,
    legacySessionStorage: newTabSession,
    createNamespace: () => { throw new Error('new tab must not create a new namespace'); },
  }),
  createdNamespace,
  'new tab/session must restore the durable namespace',
);
assert.equal(newTabSession.getItem(ANONYMOUS_CONVERSATION_NAMESPACE_KEY), createdNamespace);

const browserRestartSession = new MemoryStorage();
assert.equal(
  ensureDurableAnonymousConversationNamespace({
    durableStorage,
    legacySessionStorage: browserRestartSession,
    createNamespace: () => { throw new Error('browser restart must not create a new namespace while local storage survives'); },
  }),
  createdNamespace,
  'browser restart semantics must reuse durable local identity',
);

const legacyDurableStorage = new MemoryStorage();
const legacySessionStorage = new MemoryStorage([
  [ANONYMOUS_CONVERSATION_NAMESPACE_KEY, 'anonymous-existing-session'],
]);
assert.equal(
  ensureDurableAnonymousConversationNamespace({
    durableStorage: legacyDurableStorage,
    legacySessionStorage,
    createNamespace: () => { throw new Error('live legacy session should migrate'); },
  }),
  'anonymous-existing-session',
  'current live legacy namespace must migrate safely',
);
assert.equal(
  legacyDurableStorage.getItem(ANONYMOUS_CONVERSATION_NAMESPACE_KEY),
  'anonymous-existing-session',
);

const durableWins = new MemoryStorage([
  [ANONYMOUS_CONVERSATION_NAMESPACE_KEY, 'anonymous-durable-authoritative'],
]);
const staleSession = new MemoryStorage([
  [ANONYMOUS_CONVERSATION_NAMESPACE_KEY, 'anonymous-stale-session'],
]);
assert.equal(
  ensureDurableAnonymousConversationNamespace({
    durableStorage: durableWins,
    legacySessionStorage: staleSession,
    createNamespace: () => { throw new Error('durable identity exists'); },
  }),
  'anonymous-durable-authoritative',
  'durable identity must be authoritative',
);
assert.equal(
  staleSession.getItem(ANONYMOUS_CONVERSATION_NAMESPACE_KEY),
  'anonymous-durable-authoritative',
);

const threadsKey = namespace => `lotbi.site.ux.v1.threads.${namespace}`;
const digestText = async value => {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return `test-${hash.toString(16).padStart(8, '0')}`;
};
const message = (role, text, createdAt, meta = {}) => ({role, text, createdAt, meta});
const thread = (id, title, updatedAt, messages, extra = {}) => ({
  id, title, pinned: false, pinnedAt: 0, createdAt: updatedAt - 100, updatedAt, messages, ...extra,
});

const guestNamespace = 'anonymous-claim-test';
const accountNamespace = 'account-installation-a';
const guestThreadOne = thread('g1', '과거 1', 100, [message('user', 'G1', 100)]);
const guestThreadTwo = thread('g2', '과거 2', 200, [message('user', 'G2', 200)]);
const guestThreadThree = thread('g3', '전주 카페', 300, [
  message('user', '전주 카페 찾아줘', 280),
  message('assistant', '카페 결과입니다.', 300, {
    status: 'ANSWERED',
    placeResult: {contract_id: 'CORE-PLACE-RESULT-01', result_set_id: 'plrs_test'},
    richProduct: {contractId: 'CORE-PRODUCT-RICH-CARD-01', cards: [{title: '표시용 카드'}]},
    calendarAction: {state: 'AVAILABLE', actionId: 'must-not-cross-auth-boundary'},
    calendarItems: [{actionId: 'must-not-cross-auth-boundary-either'}],
  }),
]);
const accountA = thread('a', 'A', 90, [message('user', 'A', 90)]);
const accountB = thread('b', 'B', 80, [message('user', 'B', 80)]);
const accountC = thread('c', 'C', 70, [message('user', 'C', 70)]);

const claimDurable = new MemoryStorage([
  [ANONYMOUS_CONVERSATION_NAMESPACE_KEY, guestNamespace],
  [threadsKey(guestNamespace), JSON.stringify({
    threads: [guestThreadThree, guestThreadTwo, guestThreadOne],
    activeThreadId: 'g3',
    draft: 'guest draft',
  })],
  [threadsKey(accountNamespace), JSON.stringify({
    threads: [accountA, accountB, accountC],
    activeThreadId: 'a',
    draft: 'account draft',
  })],
]);
const claimSession = new MemoryStorage();

const intent = await prepareGuestConversationClaimIntent({
  durableStorage: claimDurable,
  sessionStorage: claimSession,
  now: 1_000,
  createClaimId: () => 'claim-test-0001',
  digestText,
});
assert.ok(intent, 'active guest thread with messages must produce a claim intent');
assert.equal(intent.anonymousNamespace, guestNamespace);
assert.equal(intent.threadId, 'g3');
assert.equal(intent.snapshot.messages.length, 2);
assert.equal(intent.snapshot.messages[1].meta.placeResult.result_set_id, 'plrs_test', 'safe display metadata must be retained');
assert.equal(intent.snapshot.messages[1].meta.calendarAction, undefined, 'calendar write action authority must not cross the login boundary');
assert.equal(intent.snapshot.messages[1].meta.calendarItems, undefined, 'calendar actionable candidate sets must not cross the login boundary');
assert.ok(claimSession.getItem(GUEST_CONVERSATION_CLAIM_INTENT_KEY), 'claim intent must be session scoped');
assert.equal(
  JSON.parse(claimDurable.getItem(threadsKey(guestNamespace))).threads.find(item => item.id === 'g3').guestClaimConsumed,
  undefined,
  'creating claim intent must not mutate the guest source before authentication succeeds',
);

const applied = await claimGuestConversationToAccount({
  accountNamespace,
  durableStorage: claimDurable,
  sessionStorage: claimSession,
  now: 1_500,
  createThreadId: () => 'thread-claim-collision-fallback',
  digestText,
});
assert.equal(applied.status, 'APPLIED');
assert.equal(applied.accountThreadId, 'g3');
const accountAfter = JSON.parse(claimDurable.getItem(threadsKey(accountNamespace)));
assert.equal(accountAfter.activeThreadId, 'g3', 'claimed guest thread must become the active account thread');
assert.deepEqual(
  accountAfter.threads.map(item => item.id).sort(),
  ['a', 'b', 'c', 'g3'].sort(),
  'existing account history must be preserved while adding the one active guest thread',
);
const claimedAccountThread = accountAfter.threads.find(item => item.id === 'g3');
assert.equal(claimedAccountThread.messages[1].meta.placeResult.result_set_id, 'plrs_test');
assert.equal(claimedAccountThread.messages[1].meta.calendarAction, undefined);
assert.equal(claimedAccountThread.claimedFromGuest.claimId, 'claim-test-0001');
assert.equal(
  guestConversationThreadClaimed({
    anonymousNamespace: guestNamespace,
    threadId: 'g3',
    durableStorage: claimDurable,
  }),
  true,
  'successful account copy must persist an independent source-claim guard',
);

const guestAfter = JSON.parse(claimDurable.getItem(threadsKey(guestNamespace)));
assert.equal(guestAfter.threads.find(item => item.id === 'g3').guestClaimConsumed, true, 'successful claim must mark only the claimed guest thread consumed');
assert.equal(guestAfter.threads.find(item => item.id === 'g2').guestClaimConsumed, undefined, 'older guest history must remain untouched');
assert.equal(guestAfter.threads.find(item => item.id === 'g1').guestClaimConsumed, undefined, 'older guest history must remain untouched');
assert.equal(guestAfter.activeThreadId, null, 'claimed thread must not revive as the anonymous active thread after logout');
assert.equal(claimSession.getItem(GUEST_CONVERSATION_CLAIM_INTENT_KEY), null, 'successful claim must clear the one-time intent');

claimSession.setItem(GUEST_CONVERSATION_CLAIM_INTENT_KEY, JSON.stringify(intent));
const duplicate = await claimGuestConversationToAccount({
  accountNamespace,
  durableStorage: claimDurable,
  sessionStorage: claimSession,
  now: 1_600,
  createThreadId: () => { throw new Error('duplicate claim must not create another thread'); },
  digestText,
});
assert.equal(duplicate.status, 'ALREADY_APPLIED');
assert.equal(JSON.parse(claimDurable.getItem(threadsKey(accountNamespace))).threads.length, 4, 'duplicate callback must not duplicate the thread');

const sameSourceAgain = await prepareGuestConversationClaimIntent({
  durableStorage: claimDurable,
  sessionStorage: claimSession,
  now: 1_700,
  createClaimId: () => 'claim-test-0002',
  digestText,
});
assert.equal(sameSourceAgain, null, 'consumed guest active thread must never be claimable by a second account');

const collisionGuest = 'anonymous-collision';
const collisionAccount = 'account-collision';
const collisionDurable = new MemoryStorage([
  [ANONYMOUS_CONVERSATION_NAMESPACE_KEY, collisionGuest],
  [threadsKey(collisionGuest), JSON.stringify({
    threads: [thread('same-id', 'Guest', 400, [message('user', 'Guest', 400)])],
    activeThreadId: 'same-id',
    draft: '',
  })],
  [threadsKey(collisionAccount), JSON.stringify({
    threads: [thread('same-id', 'Account', 350, [message('user', 'Account', 350)])],
    activeThreadId: 'same-id',
    draft: '',
  })],
]);
const collisionSession = new MemoryStorage();
await prepareGuestConversationClaimIntent({
  durableStorage: collisionDurable,
  sessionStorage: collisionSession,
  now: 2_000,
  createClaimId: () => 'claim-collision',
  digestText,
});
const collisionApplied = await claimGuestConversationToAccount({
  accountNamespace: collisionAccount,
  durableStorage: collisionDurable,
  sessionStorage: collisionSession,
  now: 2_100,
  createThreadId: () => 'thread-safe-new-id',
  digestText,
});
assert.equal(collisionApplied.status, 'APPLIED');
assert.equal(collisionApplied.accountThreadId, 'thread-safe-new-id', 'thread id collision must allocate a fresh account thread id');
assert.equal(JSON.parse(collisionDurable.getItem(threadsKey(collisionAccount))).threads.length, 2, 'collision must never overwrite existing account history');

const failureGuest = 'anonymous-login-failure';
const failureDurable = new MemoryStorage([
  [ANONYMOUS_CONVERSATION_NAMESPACE_KEY, failureGuest],
  [threadsKey(failureGuest), JSON.stringify({
    threads: [thread('failure-g', '로그인 실패', 500, [message('user', '안녕', 500)])],
    activeThreadId: 'failure-g',
    draft: '',
  })],
]);
const failureSession = new MemoryStorage();
await prepareGuestConversationClaimIntent({
  durableStorage: failureDurable,
  sessionStorage: failureSession,
  now: 3_000,
  createClaimId: () => 'claim-login-failure',
  digestText,
});
assert.equal(
  JSON.parse(failureDurable.getItem(threadsKey(failureGuest))).threads[0].guestClaimConsumed,
  undefined,
  'login failure/cancel before claim must leave the guest source untouched',
);

const changedGuest = 'anonymous-changed';
const changedAccount = 'account-changed';
const changedDurable = new MemoryStorage([
  [ANONYMOUS_CONVERSATION_NAMESPACE_KEY, changedGuest],
  [threadsKey(changedGuest), JSON.stringify({
    threads: [thread('changed-g', '변경', 600, [message('user', '원본', 600)])],
    activeThreadId: 'changed-g',
    draft: '',
  })],
  [threadsKey(changedAccount), JSON.stringify({threads: [], activeThreadId: null, draft: ''})],
]);
const changedSession = new MemoryStorage();
await prepareGuestConversationClaimIntent({
  durableStorage: changedDurable,
  sessionStorage: changedSession,
  now: 4_000,
  createClaimId: () => 'claim-source-changed',
  digestText,
});
const changedState = JSON.parse(changedDurable.getItem(threadsKey(changedGuest)));
changedState.threads[0].messages.push(message('assistant', '로그인 시작 뒤 변경됨', 601));
changedDurable.setItem(threadsKey(changedGuest), JSON.stringify(changedState));
const changedResult = await claimGuestConversationToAccount({
  accountNamespace: changedAccount,
  durableStorage: changedDurable,
  sessionStorage: changedSession,
  now: 4_100,
  digestText,
});
assert.equal(changedResult.status, 'SOURCE_CHANGED', 'claim must fail closed if the guest source changed after login start');
assert.equal(JSON.parse(changedDurable.getItem(threadsKey(changedAccount))).threads.length, 0);
assert.equal(JSON.parse(changedDurable.getItem(threadsKey(changedGuest))).threads[0].guestClaimConsumed, undefined);

const guardedGuest = 'anonymous-guarded-partial';
const guardedAccount = 'account-guarded-partial';
const guardedSourceKey = threadsKey(guardedGuest);
const guardedDurable = new FailOnceStorage([
  [ANONYMOUS_CONVERSATION_NAMESPACE_KEY, guardedGuest],
  [guardedSourceKey, JSON.stringify({
    threads: [thread('guarded-g', 'Guarded', 700, [message('user', '승계해줘', 700)])],
    activeThreadId: 'guarded-g',
    draft: '',
  })],
  [threadsKey(guardedAccount), JSON.stringify({threads: [], activeThreadId: null, draft: ''})],
], guardedSourceKey);
const guardedSession = new MemoryStorage();
await prepareGuestConversationClaimIntent({
  durableStorage: guardedDurable,
  sessionStorage: guardedSession,
  now: 4_500,
  createClaimId: () => 'claim-guarded-partial',
  digestText,
});
// The first source-thread write after the account copy is intentionally failed.
guardedDurable.failed = false;
const guardedResult = await claimGuestConversationToAccount({
  accountNamespace: guardedAccount,
  durableStorage: guardedDurable,
  sessionStorage: guardedSession,
  now: 4_600,
  digestText,
});
assert.equal(guardedResult.status, 'SOURCE_MARKER_PENDING');
assert.equal(
  guestConversationThreadClaimed({
    anonymousNamespace: guardedGuest,
    threadId: 'guarded-g',
    durableStorage: guardedDurable,
  }),
  true,
  'source guard must block cross-account reclamation even when the source-thread marker write fails',
);
assert.equal(await prepareGuestConversationClaimIntent({
  durableStorage: guardedDurable,
  sessionStorage: new MemoryStorage(),
  now: 4_700,
  createClaimId: () => 'must-not-cross-account',
  digestText,
}), null, 'guarded source must not produce a second account claim intent');
const guardedRetry = await claimGuestConversationToAccount({
  accountNamespace: guardedAccount,
  durableStorage: guardedDurable,
  sessionStorage: guardedSession,
  now: 4_800,
  digestText,
});
assert.equal(guardedRetry.status, 'ALREADY_APPLIED', 'same-account retry must repair the pending source marker idempotently');
assert.equal(JSON.parse(guardedDurable.getItem(guardedSourceKey)).threads[0].guestClaimConsumed, true);

const blankDurable = new MemoryStorage([
  [ANONYMOUS_CONVERSATION_NAMESPACE_KEY, 'anonymous-blank'],
  [threadsKey('anonymous-blank'), JSON.stringify({threads: [], activeThreadId: null, draft: ''})],
]);
assert.equal(await prepareGuestConversationClaimIntent({
  durableStorage: blankDurable,
  sessionStorage: new MemoryStorage(),
  now: 5_000,
  createClaimId: () => 'must-not-be-used',
  digestText,
}), null, 'blank guest Home must not create a fake claim intent');

const capacityThreads = Array.from({length: 50}, (_, index) => thread(
  `account-${index}`,
  `Account ${index}`,
  10_000 - index,
  [message('user', `Account ${index}`, 10_000 - index)],
));
const capacityDurable = new MemoryStorage([
  [ANONYMOUS_CONVERSATION_NAMESPACE_KEY, 'anonymous-capacity'],
  [threadsKey('anonymous-capacity'), JSON.stringify({
    threads: [thread('capacity-g', 'Capacity G', 20_000, [message('user', 'G', 20_000)])],
    activeThreadId: 'capacity-g',
    draft: '',
  })],
  [threadsKey('account-capacity'), JSON.stringify({
    threads: capacityThreads,
    activeThreadId: 'account-0',
    draft: '',
  })],
]);
const capacitySession = new MemoryStorage();
await prepareGuestConversationClaimIntent({
  durableStorage: capacityDurable,
  sessionStorage: capacitySession,
  now: 6_000,
  createClaimId: () => 'claim-capacity',
  digestText,
});
const capacityResult = await claimGuestConversationToAccount({
  accountNamespace: 'account-capacity',
  durableStorage: capacityDurable,
  sessionStorage: capacitySession,
  now: 6_100,
  digestText,
});
assert.equal(capacityResult.status, 'ACCOUNT_THREAD_CAPACITY', 'claim must not evict existing account history at THREAD_LIMIT');
assert.equal(JSON.parse(capacityDurable.getItem(threadsKey('account-capacity'))).threads.length, 50);
assert.equal(JSON.parse(capacityDurable.getItem(threadsKey('anonymous-capacity'))).threads[0].guestClaimConsumed, undefined);

const conversation = readFileSync('site-conversation.js', 'utf8');
const deterministic = readFileSync('site-deterministic.js', 'utf8');
const storageRuntime = readFileSync('site-conversation-storage.js', 'utf8');
const callback = readFileSync('auth-callback.js', 'utf8');
const continuity = readFileSync('site-continuity.js', 'utf8');
const coreClient = readFileSync('site-core.js', 'utf8');

assert.ok(!deterministic.includes("site-conversation-storage.js"), 'anonymous namespace must not depend on deterministic side effects');
assert.ok(storageRuntime.includes('localStorage'));
assert.ok(conversation.includes('const THREAD_LIMIT = 50;'));
assert.ok(conversation.includes('const MESSAGE_LIMIT = 120;'));
assert.ok(conversation.includes("storageKey(namespace, 'threads')"));
assert.ok(conversation.includes('const restoredThreads = Array.isArray(loadedState.threads)'), 'thread restore must remain bounded and namespace-scoped');
assert.ok(conversation.includes("activeThreadId: typeof loadedState.activeThreadId === 'string'"));
assert.ok(conversation.includes("draft: typeof loadedState.draft === 'string'"));
assert.ok(conversation.includes('record.messages.push(message)'));
assert.ok(conversation.includes('normalizedNamespace(detail.identityKey || detail.installationId)'));
assert.ok(conversation.includes('ensureDurableAnonymousConversationNamespace'), 'conversation runtime must consume the canonical durable anonymous helper');
assert.ok(!conversation.includes('function browserAnonymousNamespace()'), 'duplicate session-only anonymous namespace authority must be removed');
assert.ok(conversation.includes('guestClaimConsumed !== true'), 'claimed guest thread must be hidden after logout without deleting unrelated guest history');
assert.ok(callback.includes('claimGuestConversationToAccount'), 'authenticated callback must apply claim only after session redeem succeeds');
assert.ok(continuity.includes('prepareGuestConversationClaimIntent'), 'explicit login/signup entry must create a one-time claim intent');
assert.ok(coreClient.includes('recent_context'), 'authenticated conversation requests must send bounded recent context');
assert.ok(conversation.includes('recentConversationContext()'), 'authenticated follow-up must reuse the claimed thread recent context');

console.log('LOTBI ANONYMOUS CONVERSATION PERSISTENCE + LOGIN CLAIM CONTRACT PASS');
