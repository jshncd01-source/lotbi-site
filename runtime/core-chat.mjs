export class CoreChatError extends Error {
  constructor(status, code, message, options = {}) {
    super(message);
    this.name = 'CoreChatError';
    this.status = status;
    this.code = code;
    this.clearSession = Boolean(options.clearSession);
    this.correlationId = options.correlationId || null;
  }
}

function coreChatUrl(coreOrigin, chatPath) {
  const base = new URL(coreOrigin);
  const url = new URL(chatPath, `${base.origin}/`);
  if (url.origin !== base.origin || url.protocol !== 'https:') throw new CoreChatError(503, 'CORE_ENDPOINT_INVALID', 'Core chat endpoint is invalid');
  return url;
}

function correlationId(value) {
  return typeof value === 'string' && value.length <= 160 ? value : null;
}

export async function callCoreConversation({coreOrigin, chatPath, token, text, fetchImpl = fetch}) {
  let response;
  try {
    response = await fetchImpl(coreChatUrl(coreOrigin, chatPath), {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({text}),
      signal: AbortSignal.timeout(30000),
      redirect: 'error',
    });
  } catch {
    throw new CoreChatError(503, 'CORE_CHAT_UNAVAILABLE', 'LOTBI Core conversation service is unavailable');
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    throw new CoreChatError(502, 'CORE_RESPONSE_INVALID', 'LOTBI Core returned a non-JSON response');
  }

  const cid = correlationId(body?.correlation_id || body?.detail?.correlation_id);
  if (!response.ok) {
    const coreCode = String(body?.detail?.code || 'CORE_CHAT_REQUEST_FAILED');
    if (response.status === 401 || coreCode === 'SESSION_INVALID' || coreCode === 'SESSION_EXPIRED') {
      throw new CoreChatError(401, 'AUTH_SESSION_EXPIRED', 'LOTBI session is invalid or expired', {clearSession: true, correlationId: cid});
    }
    if (response.status === 403) {
      throw new CoreChatError(403, coreCode, 'LOTBI session does not satisfy the conversation assurance requirement', {correlationId: cid});
    }
    if (response.status === 422) {
      throw new CoreChatError(422, 'CHAT_INPUT_REJECTED', 'Conversation input was rejected by LOTBI Core', {correlationId: cid});
    }
    throw new CoreChatError(response.status >= 500 ? 503 : response.status, 'CORE_CHAT_REQUEST_FAILED', 'LOTBI Core could not complete the conversation request', {correlationId: cid});
  }

  if (body?.contract_id !== 'CORE-WEB-CHAT-01' || body?.schema_version !== 1 || typeof body?.assistant_text !== 'string') {
    throw new CoreChatError(502, 'CORE_CONTRACT_MISMATCH', 'LOTBI Core conversation contract did not match the expected schema', {correlationId: cid});
  }
  return body;
}
