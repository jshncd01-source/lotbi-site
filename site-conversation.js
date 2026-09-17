import {beginSiteHandoff} from './site-auth.js';
import {sendConversationMessage, SiteCoreError} from './site-core.js';

function ensureConversationStyles() {
  if (document.querySelector('link[data-site-conversation-styles]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/site-conversation.css';
  link.dataset.siteConversationStyles = 'true';
  document.head.appendChild(link);
}

function createMessage(role, text, meta = {}) {
  const article = document.createElement('article');
  article.className = `chat-message chat-message-${role}`;
  article.dataset.role = role;
  if (meta.status) article.dataset.status = meta.status;
  if (meta.responseMode) article.dataset.responseMode = meta.responseMode;
  if (meta.correlationId) article.dataset.correlationId = meta.correlationId;

  const body = document.createElement('p');
  body.className = 'chat-message-body';
  body.textContent = text;
  article.appendChild(body);

  if (meta.followUpRequired) {
    const note = document.createElement('span');
    note.className = 'chat-message-meta';
    note.textContent = '추가 확인이 필요합니다.';
    article.appendChild(note);
  }
  return article;
}

function createLoadingMessage() {
  const article = document.createElement('article');
  article.className = 'chat-message chat-message-assistant chat-message-loading';
  article.dataset.role = 'assistant';
  article.setAttribute('role', 'status');
  const body = document.createElement('p');
  body.className = 'chat-message-body';
  body.textContent = 'LOTBI가 답변을 준비하고 있습니다…';
  article.appendChild(body);
  return article;
}

function isSessionError(error) {
  return error instanceof SiteCoreError
    && (error.status === 401 || error.status === 403 || error.code === 'SITE_SESSION_REQUIRED' || error.code === 'SESSION_INVALID' || error.code === 'SESSION_EXPIRED');
}

function userFacingErrorMessage(error) {
  if (isSessionError(error)) {
    return 'LOTBI 로그인이 필요합니다. 다시 연결한 뒤 이 메시지를 보낼 수 있습니다.';
  }
  if (error instanceof SiteCoreError && (error.code === 'AI_PROVIDER_UNAVAILABLE' || error.code === 'AI_RESPONSE_UNAVAILABLE')) {
    return 'LOTBI AI 응답을 잠시 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.';
  }
  if (error instanceof Error) return error.message;
  return 'LOTBI 대화를 완료하지 못했습니다.';
}

function appendSafeErrorEvidence(wrapper, error) {
  if (!(error instanceof SiteCoreError)) return;
  if (error.code) wrapper.dataset.errorCode = error.code;
  if (error.status) wrapper.dataset.httpStatus = String(error.status);
  if (error.correlationId) wrapper.dataset.correlationId = error.correlationId;

  const evidence = [];
  if (error.code) evidence.push(`오류 코드 ${error.code}`);
  if (error.status) evidence.push(`HTTP ${error.status}`);
  if (error.correlationId) evidence.push(`확인 ID ${error.correlationId}`);
  if (!evidence.length) return;

  const meta = document.createElement('span');
  meta.className = 'chat-message-meta chat-error-evidence';
  meta.textContent = evidence.join(' · ');
  wrapper.appendChild(meta);
}

function logSafeConversationFailure(error) {
  if (!(error instanceof SiteCoreError)) return;
  // Never log the bearer, request Authorization header, or user message.
  console.error('[LOTBI conversation request failed]', {
    code: error.code,
    status: error.status,
    retryable: error.retryable,
    correlationId: error.correlationId,
  });
}

function markAuthenticatedAccountUi() {
  const accountActions = document.querySelector('.account-actions');
  if (!(accountActions instanceof HTMLElement)) return;
  const account = document.createElement('a');
  account.className = 'account-action account-login';
  account.href = 'https://account.lotbiai.com/account';
  account.textContent = '내 계정';
  accountActions.replaceChildren(account);
  accountActions.dataset.siteAuthenticated = 'true';
  document.body.dataset.siteAuthenticated = 'true';
}

export function mountConversation({sessionToken: initialSessionToken, initialText = '', autoSend = false} = {}) {
  ensureConversationStyles();
  const prompt = document.getElementById('lotbi-prompt');
  const sendButton = document.querySelector('.send-button');
  const thread = document.getElementById('conversation-thread');
  const statusRegion = document.getElementById('chat-status');
  if (!(prompt instanceof HTMLTextAreaElement) || !(sendButton instanceof HTMLButtonElement) || !(thread instanceof HTMLElement)) {
    return false;
  }
  if (sendButton.dataset.conversationMounted === 'true') return true;
  sendButton.dataset.conversationMounted = 'true';

  let sessionToken = typeof initialSessionToken === 'string' && initialSessionToken.trim() ? initialSessionToken.trim() : undefined;
  let inFlight = false;
  if (sessionToken) markAuthenticatedAccountUi();

  const setStatus = (message) => {
    if (statusRegion) statusRegion.textContent = message;
  };

  const showThread = () => {
    thread.hidden = false;
    document.body.classList.add('conversation-active');
  };

  const scrollThread = () => {
    thread.scrollTop = thread.scrollHeight;
  };

  const append = (node) => {
    showThread();
    thread.appendChild(node);
    scrollThread();
    return node;
  };

  const updateSendState = () => {
    sendButton.disabled = inFlight || prompt.value.trim().length === 0;
    sendButton.setAttribute('aria-label', inFlight ? '전송 중' : '전송');
    sendButton.title = inFlight ? '전송 중' : '전송';
  };

  const showError = (error, retryText, retryWithoutDuplicate) => {
    const wrapper = document.createElement('article');
    wrapper.className = 'chat-message chat-message-error';
    wrapper.setAttribute('role', 'alert');

    const body = document.createElement('p');
    body.className = 'chat-message-body';
    body.textContent = userFacingErrorMessage(error);
    wrapper.appendChild(body);
    appendSafeErrorEvidence(wrapper, error);
    logSafeConversationFailure(error);

    const retryable = isSessionError(error) || !(error instanceof SiteCoreError) || error.retryable;
    if (retryable) {
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'chat-retry-button';
      retry.textContent = isSessionError(error) ? '다시 연결' : '다시 시도';
      retry.addEventListener('click', async () => {
        retry.disabled = true;
        if (isSessionError(error) || !sessionToken) {
          try {
            await beginSiteHandoff(retryText);
          } catch (caught) {
            retry.disabled = false;
            body.textContent = caught instanceof Error ? caught.message : '로그인 연결을 시작하지 못했습니다.';
          }
          return;
        }
        wrapper.remove();
        await requestAssistant(retryText, !retryWithoutDuplicate);
      });
      wrapper.appendChild(retry);
    }

    append(wrapper);
  };

  const requestAssistant = async (text, appendUserMessage = true) => {
    const message = typeof text === 'string' ? text.trim() : '';
    if (!message || inFlight) return;

    if (!sessionToken) {
      try {
        await beginSiteHandoff(message);
      } catch (caught) {
        showError(caught, message, false);
      }
      return;
    }

    if (appendUserMessage) append(createMessage('user', message));
    const loading = append(createLoadingMessage());
    inFlight = true;
    updateSendState();
    setStatus('LOTBI 응답을 기다리는 중입니다.');

    try {
      const response = await sendConversationMessage(sessionToken, message);
      loading.remove();
      append(createMessage('assistant', response.assistantText, {
        status: response.status,
        responseMode: response.responseMode,
        correlationId: response.correlationId,
        followUpRequired: response.status === 'FOLLOW_UP_REQUIRED' || response.followUp?.required === true,
      }));
      setStatus(response.status === 'FOLLOW_UP_REQUIRED' ? 'LOTBI가 추가 확인이 필요한 응답을 보냈습니다.' : 'LOTBI 응답이 도착했습니다.');
    } catch (caught) {
      loading.remove();
      if (isSessionError(caught)) sessionToken = undefined;
      showError(caught, message, true);
      setStatus('LOTBI 대화를 완료하지 못했습니다.');
    } finally {
      inFlight = false;
      updateSendState();
      prompt.focus();
    }
  };

  const submitCurrentPrompt = async () => {
    if (inFlight) return;
    const message = prompt.value.trim();
    if (!message) return;
    prompt.value = '';
    prompt.style.height = '';
    updateSendState();
    await requestAssistant(message, true);
  };

  prompt.addEventListener('input', updateSendState);
  prompt.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      void submitCurrentPrompt();
    }
  });
  sendButton.addEventListener('click', () => {
    void submitCurrentPrompt();
  });

  updateSendState();
  setStatus(sessionToken
    ? 'LOTBI와 대화할 준비가 되었습니다.'
    : '메시지를 보내면 안전한 LOTBI 계정 연결이 필요한 경우 로그인으로 이동합니다.');

  if (autoSend && typeof initialText === 'string' && initialText.trim()) {
    queueMicrotask(() => void requestAssistant(initialText, true));
  }
  return true;
}

function autoMount() {
  if (document.getElementById('lotbi-prompt')) mountConversation();
}

ensureConversationStyles();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoMount, {once: true});
} else {
  autoMount();
}
