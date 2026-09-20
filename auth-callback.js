import {
  callbackPathWithoutQuery,
  clearSiteHandoffRecovery,
  parseSiteHandoffCallback,
  readAndClearSiteHandoffContext,
  recoverMissingSiteHandoffContext,
  SiteHandoffClientError,
} from './site-auth.js?v=20260920-authux1';
import {redeemSiteHandoff, SiteCoreError} from './site-core.js?v=20260921-convcal2';
import {mountConversation} from './site-conversation.js?v=20260921-convcalentry2';
import {mountLifeCalendarIfEnabled} from './site-calendar-ui.js?v=20260921-convcal2';

const callbackShell = document.getElementById('auth-callback-shell');
const titleNode = document.getElementById('auth-callback-title');
const statusNode = document.getElementById('auth-callback-status');
const retryLink = document.getElementById('auth-callback-retry');
const callbackBootStartedAt = globalThis.performance?.now?.() ?? 0;

function performanceNow() {
  return globalThis.performance?.now?.() ?? 0;
}

function recordTiming(name, detail = {}) {
  try {
    globalThis.performance?.mark?.(`lotbi-auth:${name}`, {detail: Object.freeze({...detail})});
  } catch {
    // Timing evidence is diagnostic-only and must never affect authentication.
  }
}

recordTiming('callback-boot', {elapsedMs: Math.round(callbackBootStartedAt)});

function showCallbackError(message) {
  document.body.classList.add('auth-callback-error-page');
  document.title = 'LOTBI | 로그인 연결 오류';
  if (callbackShell) callbackShell.hidden = false;
  if (titleNode) titleNode.textContent = 'LOTBI 연결 오류';
  if (statusNode) {
    statusNode.textContent = message;
    statusNode.classList.add('auth-callback-error');
  }
  if (retryLink) retryLink.hidden = false;
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

function normalizeHomeBodyAssets(parsed) {
  for (const image of parsed.querySelectorAll('img[src]')) {
    const source = image.getAttribute('src') || '';
    if (!source || source.startsWith('/') || source.startsWith('data:') || source.startsWith('blob:') || /^[a-z][a-z0-9+.-]*:/i.test(source)) {
      continue;
    }
    const resolved = new URL(source, `${window.location.origin}/`);
    if (resolved.origin === window.location.origin) {
      image.setAttribute('src', `${resolved.pathname}${resolved.search}${resolved.hash}`);
    }
  }
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

  // The callback lives under /auth/callback. Normalize home-body image URLs
  // before transplant so the approved LOTBI character never resolves against
  // /auth/callback/assets/... and degrades to broken image + alt text.
  normalizeHomeBodyAssets(parsed);

  const nextBody = document.importNode(parsed.body, true);
  document.body.replaceWith(nextBody);
  window.dispatchEvent(new CustomEvent('lotbi:home-shell-hydrated'));
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
  recordTiming('account-handoff-return', {
    durationMs: Math.max(0, Date.now() - context.startedAt),
  });

  const redeemStartedAt = performanceNow();
  const session = await redeemSiteHandoff({
    handoffCode: callback.code,
    state: callback.state,
    codeVerifier: context.codeVerifier,
  });
  recordTiming('core-redeem', {
    durationMs: Math.round(Math.max(0, performanceNow() - redeemStartedAt)),
  });

  const hydrateStartedAt = performanceNow();
  await hydrateHomeShell();
  recordTiming('callback-hydrate', {
    durationMs: Math.round(Math.max(0, performanceNow() - hydrateStartedAt)),
  });

  history.replaceState(null, '', '/');
  const mounted = mountConversation({
    sessionToken: session.sessionToken,
    identityKey: session.installationId,
    initialText: context.pendingText,
    autoSend: Boolean(context.pendingText),
  });
  if (!mounted) throw new Error('LOTBI 대화 화면을 시작하지 못했습니다.');
  await mountLifeCalendarIfEnabled({sessionToken: session.sessionToken});
  clearSiteHandoffRecovery();

  window.dispatchEvent(new CustomEvent('lotbi:site-session-state', {
    detail: {
      authenticated: true,
      expiresAt: session.expiresAt,
      installationId: session.installationId,
    },
  }));

  recordTiming('callback-complete', {
    durationMs: Math.round(Math.max(0, performanceNow() - callbackBootStartedAt)),
    handoffToHeaderMs: Math.max(0, Date.now() - context.startedAt),
  });
}

void completeSiteHandoff().catch(async error => {
  recordTiming('callback-error', {
    durationMs: Math.round(Math.max(0, performanceNow() - callbackBootStartedAt)),
  });
  if (error instanceof SiteHandoffClientError && error.code === 'SITE_HANDOFF_CONTEXT_MISSING') {
    try {
      if (await recoverMissingSiteHandoffContext(error)) return;
    } catch (recoveryError) {
      error = recoveryError;
    }
  }
  showCallbackError(callbackErrorMessage(error));
});
