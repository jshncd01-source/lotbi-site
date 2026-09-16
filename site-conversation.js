import {beginSiteHandoff} from './site-auth.js';
import {sendConversationMessage, SiteCoreError} from './site-core.js';

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

export function mountConversation({sessionToken: initialSessionToken, initialText = '', autoSend = false} = {}) {
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
    body.textContent = isSessionError(error)
      ? 'LOTBI 로그인이 필요합니다. 다시 연결한 뒤 이 메시지를 보낼 수 있습니다.'
      : error instanceof Error
        ? error.message
        : 'LOTBI 대화를 완료하지 못했습니다.';
    wrapper.appendChild(body);

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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoMount, {once: true});
} else {
  autoMount();
}
