import {
  callbackPathWithoutQuery,
  clearSiteAuthContinuity,
  parseSiteHandoffCallback,
  readAndClearSiteHandoffContext,
  rememberSiteAuthContinuity,
  SiteHandoffClientError,
} from './site-auth.js';
import {redeemSiteHandoff, SiteCoreError} from './site-core.js';
import {mountConversation} from './site-conversation.js';

const statusNode = document.getElementById('auth-callback-status');
const retryLink = document.getElementById('auth-callback-retry');

function setStatus(message, isError = false) {
  if (statusNode) {
    statusNode.textContent = message;
    statusNode.classList.toggle('auth-callback-error', isError);
  }
  if (retryLink) retryLink.hidden = !isError;
}

function callbackErrorMessage(error) {
  if (error instanceof SiteCoreError) {
    if (error.code === 'SITE_HANDOFF_REPLAY_OR_INVALID') {
      return '이 로그인 연결은 이미 사용되었거나 유효하지 않습니다. 홈에서 다시 시도해 주세요.';
    }
    if (error.code === 'SITE_HANDOFF_EXPIRED') {
      return '로그인 연결 시간이 만료되었습니다. 홈에서 다시 시도해 주세요.';
    }
    if (error.code === 'SITE_HANDOFF_SOURCE_SESSION_INVALID') {
      return '계정 로그인 상태가 더 이상 유효하지 않습니다. 홈에서 다시 연결해 주세요.';
    }
  }
  if (error instanceof SiteHandoffClientError || error instanceof Error) return error.message;
  return 'LOTBI 로그인 연결을 완료하지 못했습니다.';
}

function loadClassicScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.addEventListener('load', resolve, {once: true});
    script.addEventListener('error', () => reject(new Error(`${src} 로드에 실패했습니다.`)), {once: true});
    document.head.appendChild(script);
  });
}

async function hydrateHomeShell() {
  const response = await fetch('/index.html', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
  });
  if (!response.ok) throw new Error('LOTBI 홈 화면을 불러오지 못했습니다.');
  const html = await response.text();
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  if (!parsed.body || !parsed.getElementById('lotbi-prompt') || !parsed.getElementById('conversation-thread')) {
    throw new Error('LOTBI 홈 화면 구조를 확인하지 못했습니다.');
  }

  const nextBody = document.importNode(parsed.body, true);
  document.body.replaceWith(nextBody);
  document.title = parsed.title || 'LOTBI | 무엇을 도와드릴까요?';
  await loadClassicScript('/home-shell.js');
  await loadClassicScript('/mobile-entry.js');
}

async function completeSiteHandoff() {
  let callback;
  try {
    callback = parseSiteHandoffCallback(new URL(window.location.href));
  } catch (error) {
    history.replaceState(null, '', callbackPathWithoutQuery());
    throw error;
  }

  history.replaceState(null, '', callbackPathWithoutQuery());
  const context = readAndClearSiteHandoffContext(callback.state);
  setStatus('LOTBI Site 세션을 확인하고 있습니다.');
  const session = await redeemSiteHandoff({
    handoffCode: callback.code,
    state: callback.state,
    codeVerifier: context.codeVerifier,
  });
  rememberSiteAuthContinuity(session.expiresAt);

  await hydrateHomeShell();
  history.replaceState(null, '', '/');
  const mounted = mountConversation({
    sessionToken: session.sessionToken,
    initialText: context.pendingText,
    autoSend: Boolean(context.pendingText),
  });
  if (!mounted) throw new Error('LOTBI 대화 화면을 시작하지 못했습니다.');
}

void completeSiteHandoff().catch((error) => {
  clearSiteAuthContinuity();
  setStatus(callbackErrorMessage(error), true);
});
