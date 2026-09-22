import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

if (typeof globalThis.btoa !== 'function') {
  globalThis.btoa = value => Buffer.from(value, 'binary').toString('base64');
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

const {
  CORE_ORIGIN,
  SITE_AUDIENCE,
  SITE_CALLBACK_URI,
  SiteCoreError,
  createGuestConversationSession,
  getCurrentSiteUser,
  logoutSiteSession,
  redeemSiteHandoff,
  sendConversationMessage,
  sendGuestConversationMessage,
} = await import('../site-core.js?v=20260920-attach16prod');
const {
  ACCOUNT_SITE_HANDOFF_URL,
  HANDOFF_CONTEXT_KEY,
  HANDOFF_CONTEXT_TTL_MS,
  SiteHandoffClientError,
  createSiteHandoffContext,
  readAndClearSiteHandoffContext,
  storeSiteHandoffContext,
} = await import('../site-auth.js?v=20260920-authux1');
const {deterministicReply} = await import('../site-deterministic.js');

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}

{
  const requests = [];
  const fetchMock = async (url, init) => {
    requests.push({url, init});
    if (url.endsWith('/v2/me')) return jsonResponse({
      user: {id: 'user-1', name: '전선혜', account_handle: 'lotbi_user.01', email: 'user@example.com'},
      session: {id: 'site-session-1', assurance_level: 'FULL', expires_at: '2030-01-01T00:00:00Z'},
      installation: {id: 'installation-1'},
    });
    return jsonResponse({session_id: 'site-session-1', status: 'REVOKED'});
  };
  const identity = await getCurrentSiteUser('site-memory-token', fetchMock);
  assert.deepEqual(identity, {
    userId: 'user-1', name: '전선혜', publicHandle: 'lotbi_user.01', accountHandle: 'lotbi_user.01', email: 'user@example.com',
    sessionId: 'site-session-1', installationId: 'installation-1', expiresAt: '2030-01-01T00:00:00Z',
  });
  const logout = await logoutSiteSession('site-memory-token', fetchMock);
  assert.deepEqual(logout, {sessionId: 'site-session-1', status: 'REVOKED'});
  assert.equal(requests[0].url, 'https://api.lotbiai.com/v2/me');
  assert.equal(requests[0].init.method, 'GET');
  assert.equal(requests[1].url, 'https://api.lotbiai.com/v2/sessions/logout');
  assert.equal(requests[1].init.method, 'POST');
  for (const request of requests) {
    assert.equal(request.init.credentials, 'omit');
    assert.equal(request.init.headers.Authorization, 'Bearer site-memory-token');
  }
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json'},
  });
}

async function expectReject(promise, code) {
  let caught;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof Error, `expected rejection ${code}`);
  assert.equal(caught.code, code);
}

assert.equal(CORE_ORIGIN, 'https://api.lotbiai.com');
assert.equal(SITE_AUDIENCE, 'lotbiai.com');
assert.equal(SITE_CALLBACK_URI, 'https://lotbiai.com/auth/callback');
assert.equal(ACCOUNT_SITE_HANDOFF_URL, 'https://account.lotbiai.com/auth/site-handoff');

{
  const fixedLocalTime = new Date(2026, 8, 22, 10, 27, 37);
  const formattedTime = new Intl.DateTimeFormat('ko-KR', {hour: 'numeric', minute: '2-digit', second: '2-digit'}).format(fixedLocalTime);
  const expected = `현재 시간은 ${formattedTime}입니다.`;
  for (const text of ['지금 몇시야?', '몇 시야?']) {
    const reply = deterministicReply(text, fixedLocalTime);
    assert.equal(reply, expected);
    assert.ok(!reply.includes('(Asia/Seoul)'));
    assert.ok(!/\([^)]*\/[^)]*\)/u.test(reply));
  }
  assert.equal(
    deterministicReply('현재 시간 알려줘', fixedLocalTime),
    undefined,
    'broader current-time phrasing must continue to Core instead of gaining new Site routing authority',
  );
}

const now = 1_800_000_000_000;
const context = await createSiteHandoffContext('첫 실제 메시지', now);
assert.equal(context.version, 1);
assert.match(context.state, /^[A-Za-z0-9_-]{43}$/);
assert.match(context.codeVerifier, /^[A-Za-z0-9_-]{43}$/);
assert.match(context.codeChallenge, /^[A-Za-z0-9_-]{43}$/);
assert.notEqual(context.codeVerifier, context.codeChallenge);

{
  const storage = new MemoryStorage();
  storeSiteHandoffContext(context, storage);
  assert.ok(storage.getItem(HANDOFF_CONTEXT_KEY));
  assert.throws(
    () => readAndClearSiteHandoffContext('different-state-0123456789', storage, now + 1),
    error => error instanceof SiteHandoffClientError && error.code === 'SITE_HANDOFF_STATE_MISMATCH',
  );
  assert.equal(storage.getItem(HANDOFF_CONTEXT_KEY), null, 'state mismatch must consume local handoff context');
}

{
  const storage = new MemoryStorage();
  storage.setItem(HANDOFF_CONTEXT_KEY, JSON.stringify({...context, codeVerifier: ''}));
  assert.throws(
    () => readAndClearSiteHandoffContext(context.state, storage, now + 1),
    error => error instanceof SiteHandoffClientError && error.code === 'SITE_HANDOFF_CONTEXT_INVALID',
  );
}

{
  const storage = new MemoryStorage();
  storeSiteHandoffContext(context, storage);
  assert.throws(
    () => readAndClearSiteHandoffContext(context.state, storage, now + HANDOFF_CONTEXT_TTL_MS + 1),
    error => error instanceof SiteHandoffClientError && error.code === 'SITE_HANDOFF_CONTEXT_INVALID',
  );
}

{
  let request;
  const fetchMock = async (url, init) => {
    request = {url, init};
    return jsonResponse({
      session_token: 'site-session-token-only-for-unit-test',
      session_type: 'Bearer',
      session_id: 'session-1',
      installation_id: 'installation-1',
      assurance_level: 'FULL',
      audience: 'lotbiai.com',
      expires_at: '2030-01-01T00:00:00Z',
    });
  };
  const session = await redeemSiteHandoff({
    handoffCode: 'h'.repeat(43),
    state: context.state,
    codeVerifier: context.codeVerifier,
  }, fetchMock);
  assert.equal(session.sessionToken, 'site-session-token-only-for-unit-test');
  assert.equal(request.url, 'https://api.lotbiai.com/v2/sessions/handoffs/redeem');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.init.credentials, 'omit');
  assert.deepEqual(request.init.headers, {'Content-Type': 'application/json'});
  const body = JSON.parse(request.init.body);
  assert.equal(body.audience, 'lotbiai.com');
  assert.equal(body.callback_uri, 'https://lotbiai.com/auth/callback');
  assert.equal(body.handoff_code, 'h'.repeat(43));
  assert.equal(body.code_verifier, context.codeVerifier);
  assert.ok(!('authorization' in Object.fromEntries(Object.entries(request.init.headers).map(([key, value]) => [key.toLowerCase(), value]))));
}

for (const code of ['SITE_HANDOFF_REPLAY_OR_INVALID', 'SITE_HANDOFF_EXPIRED']) {
  await expectReject(
    redeemSiteHandoff({
      handoffCode: 'h'.repeat(43),
      state: context.state,
      codeVerifier: context.codeVerifier,
    }, async () => jsonResponse({detail: {code, message: 'rejected'}}, 400)),
    code,
  );
}

{
  let request;
  const fetchMock = async (url, init) => {
    request = {url, init};
    return jsonResponse({
      contract_id: 'CORE-WEB-CHAT-01',
      schema_version: 1,
      correlation_id: 'req_unit_test',
      status: 'ANSWERED',
      assistant_text: '실제 Core 계약 형태의 테스트 응답',
      intent: {action: 'UNKNOWN'},
      response_mode: 'MODEL',
      follow_up: {required: false, action: null, reason: null, automatic_execution: false},
      retry_safe: true,
      safety: {execution_authority: false, external_side_effect: false},
    });
  };
  const reply = await sendConversationMessage('site-memory-token', '안녕하세요', fetchMock);
  assert.equal(reply.status, 'ANSWERED');
  assert.equal(reply.assistantText, '실제 Core 계약 형태의 테스트 응답');
  assert.equal(reply.intent.action, 'UNKNOWN');
  assert.equal(request.url, 'https://api.lotbiai.com/v2/conversation/messages');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.init.credentials, 'omit');
  assert.equal(request.init.headers.Authorization, 'Bearer site-memory-token');
  assert.equal(request.init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(request.init.body), {text: '안녕하세요'});
}

{
  let request;
  const logicalId = 'auth-ai-v31-request-0001';
  const reply = await sendConversationMessage(
    'site-memory-token',
    '전주 썬팅 찾아줘',
    async (url, init) => {
      request = {url, init};
      return jsonResponse({
        contract_id: 'CORE-WEB-CHAT-01',
        schema_version: 1,
        correlation_id: 'req_v31_identity',
        status: 'ANSWERED',
        assistant_text: 'V3.1 identity accepted',
        intent: {action: 'PLACE_SEARCH'},
        response_mode: 'PLACE_READONLY',
        state_version: 4,
        place_result: {
          evidence_coverage: {
            status: 'FULL',
            verification_level: 'VERIFIED',
            freshness: 'FRESH',
            lookup_status: 'OK',
            requested_constraint_count: 1,
            candidate_count: 2,
            verified_candidate_count: 2,
            supported_candidate_count: 0,
            conflicting_candidate_count: 0,
            unconfirmed_candidate_count: 0,
          },
        },
        follow_up: {required: false, action: null, reason: null, automatic_execution: false},
        retry_safe: true,
        safety: {execution_authority: false, external_side_effect: false},
      });
    },
    [],
    logicalId,
    'Asia/Seoul',
    '2026-09-22T10:00:00+09:00',
    [],
    {
      conversationId: 'thread-v31-0001',
      turnId: logicalId,
      logicalRequestId: logicalId,
      stateVersion: 3,
    },
  );
  assert.equal(reply.status, 'ANSWERED');
  assert.equal(reply.stateVersion, 4);
  assert.equal(reply.intent.action, 'PLACE_SEARCH');
  assert.deepEqual(reply.evidenceCoverage, {
    status: 'FULL',
    verificationLevel: 'VERIFIED',
    freshness: 'FRESH',
    lookupStatus: 'OK',
    requestedConstraintCount: 1,
    candidateCount: 2,
    verifiedCandidateCount: 2,
    supportedCandidateCount: 0,
    conflictingCandidateCount: 0,
    unconfirmedCandidateCount: 0,
  });
  assert.equal(request.init.headers['Idempotency-Key'], logicalId);
  assert.deepEqual(JSON.parse(request.init.body), {
    text: '전주 썬팅 찾아줘',
    client_context: {
      timezone: 'Asia/Seoul',
      turn_created_at: '2026-09-22T10:00:00+09:00',
      conversation_id: 'thread-v31-0001',
      turn_id: logicalId,
      logical_request_id: logicalId,
      state_version: 3,
    },
  });
}

{
  const reply = await sendConversationMessage(
    'site-memory-token',
    '지금 환율 알려줘',
    async () => jsonResponse({
      contract_id: 'CORE-WEB-CHAT-01',
      schema_version: 1,
      correlation_id: 'req_v31_read_plan',
      status: 'ANSWERED',
      assistant_text: '최신 자료 확인이 필요한 질문이에요.',
      intent: {
        action: 'UNKNOWN',
        response_plan: 'READ_PLAN',
        read_plan: {
          freshness: 'CURRENT',
          required_capability: 'FRESH_SOURCE_READ',
          coverage_required: 'FULL_OR_EXPLICIT_PARTIAL',
          allow_model_only: false,
        },
      },
      response_mode: 'READ_PLAN_REQUIRED',
      follow_up: {required: false, action: null, reason: null, automatic_execution: false},
      retry_safe: true,
      safety: {execution_authority: false, external_side_effect: false},
    }),
    [],
    'auth-ai-v31-read-plan-0001',
    'Asia/Seoul',
  );
  assert.equal(reply.responseMode, 'READ_PLAN_REQUIRED');
  assert.deepEqual(reply.readPlan, {
    freshness: 'CURRENT',
    requiredCapability: 'FRESH_SOURCE_READ',
    coverageRequired: 'FULL_OR_EXPLICIT_PARTIAL',
    allowModelOnly: false,
  });
  assert.equal(reply.evidenceCoverage, null);
}

{
  const sourceTurnRef = 'auth-ai-candidate0001';
  const sourceTurnCreatedAt = '2026-09-20T12:00:00+00:00';
  const reply = await sendConversationMessage(
    'site-memory-token',
    '10월 3일에 등산할 계획이야',
    async () => jsonResponse({
      contract_id: 'CORE-WEB-CHAT-01',
      schema_version: 1,
      correlation_id: 'req_calendar_candidate_set',
      status: 'ANSWERED',
      assistant_text: '일정 후보를 확인했어요.',
      intent: {action: 'UNKNOWN'},
      response_mode: 'MODEL',
      follow_up: {required: false, action: null, reason: null, automatic_execution: false},
      retry_safe: true,
      safety: {execution_authority: false, external_side_effect: false},
      calendar_candidate_set: {
        contract_id: 'CORE-CALENDAR-CANDIDATE-SET-01',
        schema_version: 1,
        source_turn_ref: sourceTurnRef,
        source_turn_created_at: sourceTurnCreatedAt,
        candidates: [{
          contract_id: 'CORE-CALENDAR-PARTIAL-CANDIDATE-01',
          schema_version: 1,
          candidate_id: 'calcand_333333333333333333333333',
          candidate_version: 1,
          source_turn_ref: sourceTurnRef,
          source_turn_created_at: sourceTurnCreatedAt,
          title: '등산',
          temporal: {
            kind: 'PARTIAL_LOCAL_DATE_TIME',
            local_date: '2026-10-03',
            local_time: null,
            timezone_name: 'Asia/Seoul',
          },
          temporal_semantics: 'USER_PLANNED_TIME',
          meaning: 'PERSONAL_CALENDAR_ACTIVITY',
          missing_fields: ['time'],
          approval_state: 'NOT_APPROVED',
          execution_state: 'NOT_EXECUTED',
        }],
      },
    }),
    [],
    sourceTurnRef,
    'Asia/Seoul',
    sourceTurnCreatedAt,
  );
  assert.equal(reply.calendarCandidate, null);
  assert.equal(reply.calendarCandidateSet.contractId, 'CORE-CALENDAR-CANDIDATE-SET-01');
  assert.equal(reply.calendarCandidateSet.candidates.length, 1);
  assert.equal(reply.calendarCandidateSet.candidates[0].kind, 'PARTIAL');
  assert.deepEqual(reply.calendarCandidateSet.candidates[0].candidate.missingFields, ['time']);
}

await expectReject(
  sendConversationMessage('site-memory-token', '안녕하세요', async () => jsonResponse({
    detail: {code: 'SESSION_EXPIRED', message: 'expired'},
  }, 401)),
  'SESSION_EXPIRED',
);

{
  let request;
  const issued = await createGuestConversationSession(async (url, init) => {
    request = {url, init};
    return jsonResponse({
      contract_id: 'CORE-GUEST-SESSION-01',
      schema_version: 1,
      guest_token: 'g'.repeat(43),
      expires_at: '2030-01-01T00:00:00Z',
    }, 201);
  });
  assert.equal(issued.guestToken, 'g'.repeat(43));
  assert.equal(request.url, 'https://api.lotbiai.com/v2/conversation/guest/sessions');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.init.credentials, 'omit');
  assert.ok(!request.init.headers?.Authorization);
}

{
  let request;
  const reply = await sendGuestConversationMessage({
    guestToken: 'g'.repeat(43),
    text: '양자컴퓨터가 뭐야?',
    idempotencyKey: 'guest-request-0001',
    recentContext: [{role: 'user', text: '아까 과학 이야기했지?'}],
    timezone: 'Asia/Seoul',
  }, async (url, init) => {
    request = {url, init};
    return jsonResponse({
      contract_id: 'CORE-WEB-CHAT-01',
      schema_version: 1,
      correlation_id: 'req_guest_unit',
      status: 'ANSWERED',
      assistant_text: '양자컴퓨터는 양자 상태를 이용해 계산하는 컴퓨터예요.',
      intent: {action: 'UNKNOWN'},
      response_mode: 'AI_GENERATED_NON_AUTHORITATIVE',
      follow_up: {required: false, action: null, reason: null, automatic_execution: false},
      retry_safe: true,
      safety: {execution_authority: false, external_side_effect: false},
    });
  });
  assert.equal(reply.status, 'ANSWERED');
  assert.equal(reply.intent.action, 'UNKNOWN');
  assert.equal(request.url, 'https://api.lotbiai.com/v2/conversation/guest/messages');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.init.credentials, 'omit');
  assert.equal(request.init.headers['X-LOTBI-Guest-Token'], 'g'.repeat(43));
  assert.equal(request.init.headers['Idempotency-Key'], 'guest-request-0001');
  assert.ok(!request.init.headers.Authorization);
  assert.deepEqual(JSON.parse(request.init.body), {
    text: '양자컴퓨터가 뭐야?',
    recent_context: [{role: 'user', text: '아까 과학 이야기했지?'}],
    client_context: {timezone: 'Asia/Seoul'},
  });
}

{
  const reply = await sendGuestConversationMessage({
    guestToken: 'g'.repeat(43),
    text: '서울 날씨 어때?',
    idempotencyKey: 'guest-request-v31-read-0001',
    timezone: 'Asia/Seoul',
  }, async () => jsonResponse({
    contract_id: 'CORE-WEB-CHAT-01',
    schema_version: 1,
    correlation_id: 'req_guest_v31_read',
    status: 'ANSWERED',
    assistant_text: '현재 확인된 최신 날씨 정보입니다.',
    intent: {action: 'UNKNOWN'},
    response_mode: 'PUBLIC_READ_GROUNDED',
    completion: 'FULL',
    sources: [
      {title: '기상청', url: 'https://www.weather.go.kr/example'},
      {title: '보조 출처', url: 'https://example.com/weather'},
    ],
    follow_up: {required: false, action: null, reason: null, automatic_execution: false},
    retry_safe: true,
    safety: {execution_authority: false, external_side_effect: false},
  }));
  assert.equal(reply.responseMode, 'PUBLIC_READ_GROUNDED');
  assert.equal(reply.completion, 'FULL');
  assert.equal(reply.readPlan, null);
  assert.equal(reply.sources.length, 2);
  assert.equal(reply.sources[0].title, '기상청');
  assert.equal(reply.sources[0].url, 'https://www.weather.go.kr/example');
  assert.equal(reply.evidenceCoverage, null);
}

await expectReject(
  sendGuestConversationMessage({
    guestToken: 'g'.repeat(43),
    text: '질문',
    idempotencyKey: 'guest-request-0002',
  }, async () => jsonResponse({
    detail: {code: 'GUEST_SESSION_EXPIRED', message: 'expired'},
  }, 401)),
  'GUEST_SESSION_EXPIRED',
);

{
  let request;
  const longDraft = '초안-' + '가'.repeat(796);
  const recentContext = Array.from({length: 10}, (_, index) => ({
    role: index % 2 === 0 ? 'user' : 'assistant',
    text: index === 1 ? longDraft : `대화-${index}`,
  }));
  await sendGuestConversationMessage({
    guestToken: 'g'.repeat(43),
    text: '아까 최종본 다시',
    idempotencyKey: 'guest-request-v31-context-0001',
    recentContext,
    timezone: 'Asia/Seoul',
  }, async (url, init) => {
    request = {url, init};
    return jsonResponse({
      contract_id: 'CORE-WEB-CHAT-01',
      schema_version: 1,
      correlation_id: 'req_guest_v31_context',
      status: 'ANSWERED',
      assistant_text: '이전 문맥을 이어서 답했어요.',
      intent: {action: 'UNKNOWN'},
      response_mode: 'AI_GENERATED_NON_AUTHORITATIVE',
      follow_up: {required: false, action: null, reason: null, automatic_execution: false},
      retry_safe: true,
      safety: {execution_authority: false, external_side_effect: false},
    });
  });
  const sent = JSON.parse(request.init.body).recent_context;
  assert.equal(sent.length, 10);
  assert.equal(sent[1].text, longDraft);
  assert.ok(sent[1].text.length > 500);
}

const index = read('index.html');
const auth = read('site-auth.js');
const core = read('site-core.js');
const conversation = read('site-conversation.js');
const callback = read('auth-callback.js');
const callbackHtml = read('auth/callback/index.html');
const footerCss = read('footer-business-info.css');

for (const token of [
  'id="conversation-thread"',
  'maxlength="1000"',
  'aria-label="전송"',
  '유한회사 알에이디홀딩스',
  '대표자: 전선혜',
  '사업자등록번호: 583-88-03679',
  '통신판매업신고번호: 2026-전주덕진-0798',
  '사업자정보확인',
]) assert.ok(index.includes(token), `missing index contract: ${token}`);
assert.match(
  index,
  /type="module" src="site-conversation\.js\?v=[^"]+"/,
  'Home conversation runtime must be cache-busted',
);

assert.ok(auth.includes('sessionStorage'));
assert.ok(auth.includes('code_challenge'));
assert.ok(auth.includes("crypto.subtle.digest('SHA-256'"));
assert.ok(callback.includes('history.replaceState'));
assert.ok(callback.includes('readAndClearSiteHandoffContext'));
assert.ok(callback.includes('redeemSiteHandoff'));
assert.ok(callbackHtml.includes('noindex,nofollow,noarchive'));
assert.ok(conversation.includes("event.key === 'Enter'"));
assert.ok(conversation.includes('!event.shiftKey'));
assert.ok(conversation.includes('beginSiteHandoff'));
assert.ok(conversation.includes('sendConversationMessage'));
assert.ok(conversation.includes('sendGuestConversationMessage'));
assert.ok(conversation.includes('createGuestConversationSession'));
assert.ok(conversation.includes("lastPath = 'CORE_GUEST_CONVERSATION'"));
assert.ok(conversation.includes('getCurrentSiteUser'));
assert.ok(conversation.includes('logoutSiteSession'));
assert.ok(core.includes("Authorization: `Bearer ${token}`"));
assert.ok(core.includes("payload.contract_id !== 'CORE-WEB-CHAT-01'"));
assert.ok(core.includes("const GUEST_SESSION_PATH = '/v2/conversation/guest/sessions'"));
assert.ok(core.includes("const GUEST_CONVERSATION_PATH = '/v2/conversation/guest/messages'"));
assert.ok(core.includes("'Idempotency-Key': logicalKey"));
assert.ok(core.includes("'X-LOTBI-Guest-Token': token"));

const credentialRuntime = `${auth}\n${core}\n${callback}`.toLowerCase();
for (const forbidden of ['localstorage', 'document.cookie', 'client_secret', 'api_key', 'openai_api_key']) {
  assert.ok(!credentialRuntime.includes(forbidden), `forbidden credential runtime token: ${forbidden}`);
}
assert.ok(conversation.includes('window.localStorage'), 'conversation/preferences require explicit browser-local persistence');
assert.ok(conversation.includes('installationId'), 'authenticated local persistence must use the stable installation namespace');
assert.ok(!conversation.includes('storage.setItem(STORAGE_PREFIX, sessionToken'), 'Site bearer must never enter durable storage');
assert.ok(!auth.includes('session_token'), 'handoff storage module must never persist a bearer');
assert.ok(!auth.includes('Authorization'), 'Account bearer must never be handled by Site handoff state module');
assert.ok(!callback.includes('sessionStorage.setItem'), 'callback must not persist the Site bearer');
assert.ok(!conversation.includes('sessionStorage.setItem'), 'conversation must not persist the Site bearer');
assert.ok(conversation.includes("error.code === 'FREE_LIMIT_REACHED'"), 'FREE quota exhaustion must have dedicated user-facing copy');
assert.ok(conversation.includes('이번 달 무료 AI 사용 횟수를 모두 사용했어요.'), 'FREE quota exhaustion must be rendered in Korean');
assert.ok(!conversation.includes('evidence.push(`오류 코드 ${error.code}`)'), 'raw internal error code must not be visible in production Chat UI');
assert.ok(!conversation.includes('evidence.push(`HTTP ${error.status}`)'), 'raw HTTP status must not be visible in production Chat UI');
assert.ok(!footerCss.includes('conversation'), 'business footer stylesheet must remain unrelated to conversation integration');

for (const forbiddenEffect of ['/orders', '/payments', '/reservations', '/execute', 'payment_attempted']) {
  assert.ok(!conversation.includes(forbiddenEffect), `conversation client must not start external effects: ${forbiddenEffect}`);
}

console.log('SITE-WEB-CONVERSATION-INTEGRATION-01 CONTRACT PASS');
