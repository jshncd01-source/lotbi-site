import {beginSiteHandoff} from './site-auth.js';
import {getCurrentSiteUser, logoutSiteSession, sendConversationMessage, SiteCoreError} from './site-core.js';
import {deterministicReply} from './site-deterministic.js';

const SESSION_STATE_EVENT = 'lotbi:site-session-state';
const SIDEBAR_RENDERED_EVENT = 'lotbi:sidebar-auth-rendered';
const STORAGE_PREFIX = 'lotbi.site.ux.v1';
const THREAD_LIMIT = 50;
const MESSAGE_LIMIT = 120;
const PHOTO_BYTES_LIMIT = 2 * 1024 * 1024;
const PHOTO_DIMENSION_LIMIT = 4096;
const COLOR_OPTIONS = Object.freeze([
  ['default', '기본'], ['blue', '파랑'], ['purple', '보라'], ['green', '초록'],
  ['orange', '오렌지'], ['pink', '분홍'], ['gray', '회색'],
]);
const diagnostics = {
  deterministicReplies: 0, coreCalls: 0, providerCallsAvoided: 0,
  lastPath: 'idle', lastVisibleAnswerMs: null, lastCoreDurationMs: null,
  lastCoreRequestDelta: null, lastExternalAiRequestDelta: null,
};

function ensureConversationStyles() {
  if (document.querySelector('link[data-site-conversation-styles]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/site-conversation.css';
  link.dataset.siteConversationStyles = 'true';
  document.head.appendChild(link);
}

const performanceNow = () => globalThis.performance?.now?.() ?? Date.now();
function recordTiming(name, detail = {}) {
  try { globalThis.performance?.mark?.(`lotbi-conversation:${name}`, {detail: Object.freeze({...detail})}); } catch {}
}
function resourceCounts() {
  const resources = globalThis.performance?.getEntriesByType?.('resource') || [];
  return {
    core: resources.filter(entry => String(entry.name || '').includes('/v2/conversation/messages')).length,
    externalAi: resources.filter(entry => /api\.openai\.com|anthropic\.com|generativelanguage\.googleapis\.com/iu.test(String(entry.name || ''))).length,
  };
}
function publishDiagnostics() {
  document.body.dataset.conversationPath = diagnostics.lastPath;
  document.body.dataset.conversationLatencyMs = String(diagnostics.lastVisibleAnswerMs ?? '');
  document.body.dataset.conversationCoreRequests = String(diagnostics.lastCoreRequestDelta ?? '');
  document.body.dataset.conversationExternalAiRequests = String(diagnostics.lastExternalAiRequestDelta ?? '');
}
function safeStorage() {
  try {
    const storage = window.localStorage;
    const probe = `${STORAGE_PREFIX}.probe`;
    storage.setItem(probe, '1'); storage.removeItem(probe);
    return storage;
  } catch { return undefined; }
}
function safeSessionStorage() { try { return window.sessionStorage; } catch { return undefined; } }
function safeParse(raw, fallback) { if (!raw) return fallback; try { return JSON.parse(raw); } catch { return fallback; } }
function normalizedNamespace(value) {
  const namespace = typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z0-9._:-]{1,128}$/.test(namespace) ? namespace : '';
}
function browserAnonymousNamespace() {
  const session = safeSessionStorage();
  const key = `${STORAGE_PREFIX}.anonymous-namespace`;
  let value = normalizedNamespace(session?.getItem(key));
  if (!value) {
    value = `anonymous-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
    session?.setItem(key, value);
  }
  return value;
}
const storageKey = (namespace, kind) => `${STORAGE_PREFIX}.${kind}.${namespace}`;

function createMessage(role, text, meta = {}) {
  const article = document.createElement('article');
  article.className = `chat-message chat-message-${role}`;
  article.dataset.role = role;
  if (meta.status) article.dataset.status = meta.status;
  if (meta.responseMode) article.dataset.responseMode = meta.responseMode;
  if (meta.correlationId) article.dataset.correlationId = meta.correlationId;
  const body = document.createElement('p');
  body.className = 'chat-message-body'; body.textContent = text;
  article.appendChild(body);
  if (meta.followUpRequired) {
    const note = document.createElement('span');
    note.className = 'chat-message-meta'; note.textContent = '추가 확인이 필요합니다.';
    article.appendChild(note);
  }
  return article;
}
function createLoadingMessage() {
  const article = createMessage('assistant', 'LOTBI가 답변을 준비하고 있습니다…');
  article.classList.add('chat-message-loading');
  article.dataset.transient = 'true'; article.setAttribute('role', 'status');
  return article;
}
function isSessionError(error) {
  return error instanceof SiteCoreError
    && (error.status === 401 || error.status === 403 || error.code === 'SITE_SESSION_REQUIRED' || error.code === 'SESSION_INVALID' || error.code === 'SESSION_EXPIRED');
}
function userFacingErrorMessage(error) {
  if (isSessionError(error)) return 'LOTBI 로그인이 필요합니다. 다시 연결한 뒤 이 메시지를 보낼 수 있습니다.';
  if (error instanceof SiteCoreError && error.code === 'FREE_LIMIT_REACHED') {
    return '이번 달 무료 AI 3회를 모두 사용했습니다. 인사·감사·도움말·시간·날짜 같은 0-AI 기능은 계속 사용할 수 있습니다. 추가 AI 사용은 구독 옵션에서 이어갈 수 있습니다.';
  }
  if (error instanceof SiteCoreError && (error.code === 'AI_PROVIDER_UNAVAILABLE' || error.code === 'AI_RESPONSE_UNAVAILABLE')) return 'LOTBI AI 응답을 잠시 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.';
  if (error instanceof Error) return error.message;
  return 'LOTBI 대화를 완료하지 못했습니다.';
}
function voiceErrorMessage(error) {
  const name = error && typeof error === 'object' && typeof error.name === 'string' ? error.name : '';
  const code = error && typeof error === 'object' && typeof error.error === 'string' ? error.error : '';
  if (name === 'NotAllowedError' || name === 'SecurityError' || code === 'not-allowed' || code === 'service-not-allowed') return '마이크 권한이 필요합니다. 브라우저의 사이트 권한에서 마이크를 허용해 주세요.';
  if (name === 'NotFoundError' || code === 'audio-capture') return '사용 가능한 마이크를 찾지 못했습니다. 기기 마이크 연결을 확인해 주세요.';
  if (code === 'no-speech') return '음성이 들리지 않았습니다. 마이크 버튼을 눌러 다시 말씀해 주세요.';
  return '음성 입력을 완료하지 못했습니다. 텍스트 입력은 계속 사용할 수 있습니다.';
}
function appendSafeErrorEvidence(wrapper, error) {
  if (!(error instanceof SiteCoreError)) return;
  if (error.code) wrapper.dataset.errorCode = error.code;
  if (error.status) wrapper.dataset.httpStatus = String(error.status);
  if (error.correlationId) wrapper.dataset.correlationId = error.correlationId;
  if (error.l0Available) wrapper.dataset.l0Available = 'true';
  if (error.upgradeAvailable) wrapper.dataset.upgradeAvailable = 'true';
  if (error.upgradeAction) wrapper.dataset.upgradeAction = error.upgradeAction;
  const evidence = [];
  if (error.code) evidence.push(`오류 코드 ${error.code}`);
  if (error.status) evidence.push(`HTTP ${error.status}`);
  if (error.correlationId) evidence.push(`확인 ID ${error.correlationId}`);
  if (!evidence.length) return;
  const meta = document.createElement('span');
  meta.className = 'chat-message-meta chat-error-evidence'; meta.textContent = evidence.join(' · ');
  wrapper.appendChild(meta);
}
function logSafeConversationFailure(error) {
  if (!(error instanceof SiteCoreError)) return;
  console.error('[LOTBI conversation request failed]', {code: error.code, status: error.status, retryable: error.retryable, correlationId: error.correlationId});
}

function titleFromMessage(text) {
  const value = text.replace(/\s+/gu, ' ').trim();
  return value.length <= 36 ? value : `${value.slice(0, 35).trimEnd()}…`;
}
function newId(prefix) { return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`; }
function initials(name) {
  const words = String(name || '').trim().split(/\s+/u).filter(Boolean);
  if (!words.length) return 'L';
  return words.slice(0, 2).map(word => [...word][0]).join('').toUpperCase();
}
function focusableNodes(root) {
  return [...root.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
    .filter(node => node instanceof HTMLElement && !node.hidden);
}
function trapFocus(container, event) {
  if (event.key !== 'Tab') return;
  const nodes = focusableNodes(container);
  if (!nodes.length) return;
  const first = nodes[0]; const last = nodes[nodes.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

export function mountConversation({sessionToken: initialSessionToken, initialText = '', autoSend = false, identityKey = ''} = {}) {
  ensureConversationStyles();
  const prompt = document.getElementById('lotbi-prompt');
  const sendButton = document.querySelector('.send-button');
  const micButton = document.querySelector('.mic-button');
  const thread = document.getElementById('conversation-thread');
  const statusRegion = document.getElementById('chat-status');
  const stateRegion = document.getElementById('chat-state-region');
  const homeAvatarAnchor = document.querySelector('[data-home-avatar-anchor]');
  const avatar = document.querySelector('[data-lotbi-avatar-container]');
  if (!(prompt instanceof HTMLTextAreaElement) || !(sendButton instanceof HTMLButtonElement) || !(micButton instanceof HTMLButtonElement)
    || !(thread instanceof HTMLElement) || !(homeAvatarAnchor instanceof HTMLElement) || !(avatar instanceof HTMLElement)) return false;
  if (sendButton.dataset.conversationMounted === 'true') return true;
  sendButton.dataset.conversationMounted = 'true';

  const storage = safeStorage();
  let sessionToken = typeof initialSessionToken === 'string' && initialSessionToken.trim() ? initialSessionToken.trim() : undefined;
  let namespace = normalizedNamespace(identityKey);
  let state = {threads: [], activeThreadId: null, draft: ''};
  let preferences = {color: 'default', theme: 'system', displayName: '', photo: ''};
  let serverIdentity;
  let stateReady = false, inFlight = false, voiceRequesting = false, voiceListening = false, voiceRecognition;
  let openSurface, surfaceRestoreFocus;

  const setStatus = message => { if (statusRegion) statusRegion.textContent = message; };
  const threadRecord = () => state.threads.find(item => item.id === state.activeThreadId);
  const saveState = () => { if (storage && namespace && stateReady) storage.setItem(storageKey(namespace, 'threads'), JSON.stringify(state)); };
  const savePreferences = () => { if (storage && namespace && stateReady) storage.setItem(storageKey(namespace, 'preferences'), JSON.stringify(preferences)); };
  const applyPreferences = () => {
    document.body.dataset.chatColor = COLOR_OPTIONS.some(([key]) => key === preferences.color) ? preferences.color : 'default';
    document.body.dataset.siteTheme = ['system', 'light', 'dark'].includes(preferences.theme) ? preferences.theme : 'system';
  };
  const restoreAvatarHome = () => { if (avatar.parentElement !== homeAvatarAnchor) homeAvatarAnchor.appendChild(avatar); };
  const showThread = () => { thread.hidden = false; document.body.classList.add('conversation-active'); };
  const showBlankHome = () => {
    restoreAvatarHome(); thread.replaceChildren(); thread.hidden = true; document.body.classList.remove('conversation-active');
  };
  const scrollThread = () => { thread.scrollTop = thread.scrollHeight; };
  const appendNode = node => {
    showThread();
    if (node instanceof HTMLElement && node.dataset.role === 'assistant') {
      const row = document.createElement('div'); row.className = 'chat-assistant-row';
      const slot = document.createElement('div'); slot.className = 'assistant-avatar-slot'; slot.setAttribute('aria-hidden', 'true');
      slot.appendChild(avatar); row.append(slot, node); thread.appendChild(row);
    } else thread.appendChild(node);
    scrollThread(); return node;
  };
  const renderRecent = () => {
    for (const list of document.querySelectorAll('[data-recent-conversations]')) {
      if (!(list instanceof HTMLElement)) continue;
      const fragment = document.createDocumentFragment();
      for (const item of state.threads) {
        const li = document.createElement('li'); const button = document.createElement('button');
        button.type = 'button'; button.dataset.conversationTitle = ''; button.dataset.threadId = item.id;
        button.textContent = item.title; button.title = item.title; button.setAttribute('aria-label', `${item.title} 대화 열기`);
        if (item.id === state.activeThreadId) button.setAttribute('aria-current', 'true');
        button.addEventListener('click', () => activateThread(item.id)); li.appendChild(button); fragment.appendChild(li);
      }
      list.replaceChildren(fragment);
    }
  };
  const appendPersistedMessage = message => {
    const record = threadRecord(); if (!record) return;
    record.messages.push(message); record.messages = record.messages.slice(-MESSAGE_LIMIT); record.updatedAt = Date.now();
    state.threads.sort((a, b) => b.updatedAt - a.updatedAt); saveState(); renderRecent();
  };
  const renderActiveThread = () => {
    restoreAvatarHome(); thread.replaceChildren();
    const record = threadRecord();
    if (!record || !record.messages.length) { showBlankHome(); return; }
    for (const message of record.messages) appendNode(createMessage(message.role, message.text, message.meta || {}));
    showThread();
  };
  const closeMobileDrawer = () => {
    const close = document.querySelector('[data-mobile-nav-close]');
    if (document.body.classList.contains('nav-drawer-open') && close instanceof HTMLButtonElement) close.click();
  };
  const activateThread = id => {
    if (!state.threads.some(item => item.id === id)) return;
    state.activeThreadId = id; saveState(); renderActiveThread(); renderRecent(); closeMobileDrawer(); prompt.focus();
  };
  const startNewConversation = () => {
    state.activeThreadId = null; state.draft = ''; prompt.value = '';
    prompt.dispatchEvent(new Event('input', {bubbles: true})); saveState(); showBlankHome(); renderRecent(); closeMobileDrawer(); prompt.focus();
  };
  const ensureThread = firstMessage => {
    let record = threadRecord(); if (record) return record;
    record = {id: newId('thread'), title: titleFromMessage(firstMessage), createdAt: Date.now(), updatedAt: Date.now(), messages: []};
    state.activeThreadId = record.id; state.threads.unshift(record); state.threads = state.threads.slice(0, THREAD_LIMIT);
    saveState(); renderRecent(); return record;
  };
  const validThread = value => value && typeof value.id === 'string' && typeof value.title === 'string' && Array.isArray(value.messages);
  const switchNamespace = nextNamespace => {
    const normalized = normalizedNamespace(nextNamespace);
    if (!normalized || (normalized === namespace && stateReady)) return;
    namespace = normalized;
    const loadedState = safeParse(storage?.getItem(storageKey(namespace, 'threads')), {});
    const loadedPreferences = safeParse(storage?.getItem(storageKey(namespace, 'preferences')), {});
    state = {
      threads: Array.isArray(loadedState.threads) ? loadedState.threads.filter(validThread).slice(0, THREAD_LIMIT) : [],
      activeThreadId: typeof loadedState.activeThreadId === 'string' ? loadedState.activeThreadId : null,
      draft: typeof loadedState.draft === 'string' ? loadedState.draft.slice(0, 1000) : '',
    };
    if (!state.threads.some(item => item.id === state.activeThreadId)) state.activeThreadId = state.threads[0]?.id || null;
    preferences = {
      color: COLOR_OPTIONS.some(([key]) => key === loadedPreferences.color) ? loadedPreferences.color : 'default',
      theme: ['system', 'light', 'dark'].includes(loadedPreferences.theme) ? loadedPreferences.theme : 'system',
      displayName: typeof loadedPreferences.displayName === 'string' ? loadedPreferences.displayName.slice(0, 40) : '',
      photo: typeof loadedPreferences.photo === 'string' && loadedPreferences.photo.startsWith('data:image/') ? loadedPreferences.photo : '',
    };
    stateReady = true; prompt.value = state.draft; prompt.dispatchEvent(new Event('input', {bubbles: true}));
    applyPreferences(); renderActiveThread(); renderRecent(); refreshAuthenticatedProfileSlots();
  };
  const profileButton = () => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'sidebar-account-entry sidebar-profile-trigger';
    button.dataset.profileMenuTrigger = ''; button.setAttribute('aria-haspopup', 'menu'); button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', '프로필 메뉴 열기');
    const visual = document.createElement(preferences.photo ? 'img' : 'span'); visual.className = 'sidebar-profile-avatar';
    if (visual instanceof HTMLImageElement) { visual.src = preferences.photo; visual.alt = ''; }
    else { visual.textContent = initials(preferences.displayName || 'LOTBI'); visual.setAttribute('aria-hidden', 'true'); }
    const copy = document.createElement('span'); copy.className = 'sidebar-profile-copy';
    const name = document.createElement('span'); name.className = 'sidebar-account-name'; name.textContent = serverIdentity?.name || preferences.displayName || '로그인된 사용자';
    const handle = document.createElement('span'); handle.className = 'sidebar-account-handle'; handle.textContent = serverIdentity?.accountHandle ? `@${serverIdentity.accountHandle}` : '프로필 메뉴';
    copy.append(name, handle); button.append(visual, copy); return button;
  };
  const refreshAuthenticatedProfileSlots = () => {
    if (document.body.dataset.siteAuthState !== 'authenticated' && !sessionToken) return;
    for (const slot of document.querySelectorAll('[data-sidebar-account]')) {
      if (!(slot instanceof HTMLElement)) continue;
      slot.replaceChildren(profileButton()); slot.dataset.authState = 'authenticated'; slot.removeAttribute('aria-busy');
    }
  };
  const loadServerIdentity = async () => {
    if (!sessionToken) return;
    try {
      const identity = await getCurrentSiteUser(sessionToken);
      if (namespace && identity.installationId !== namespace) throw new SiteCoreError('Site 사용자 namespace가 일치하지 않습니다.', {code: 'SITE_IDENTITY_NAMESPACE_MISMATCH'});
      serverIdentity = identity; refreshAuthenticatedProfileSlots();
    } catch (error) {
      if (isSessionError(error)) sessionToken = undefined;
    }
  };

  const closeSurface = () => {
    if (!openSurface) return;
    for (const trigger of document.querySelectorAll('[data-profile-menu-trigger]')) trigger.setAttribute('aria-expanded', 'false');
    openSurface.remove(); openSurface = undefined; document.body.classList.remove('site-overlay-open');
    if (surfaceRestoreFocus instanceof HTMLElement && surfaceRestoreFocus.isConnected) surfaceRestoreFocus.focus();
    surfaceRestoreFocus = undefined;
  };
  const installSurfaceBehavior = (surface, panel, {modal = false} = {}) => {
    closeSurface(); openSurface = surface; surfaceRestoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    document.body.appendChild(surface); document.body.classList.add('site-overlay-open');
    surface.addEventListener('click', event => { if (event.target === surface) closeSurface(); });
    surface.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); closeSurface(); } else trapFocus(panel, event);
    });
    if (modal) panel.setAttribute('aria-modal', 'true');
    queueMicrotask(() => focusableNodes(panel)[0]?.focus());
  };
  const modalShell = (title, description = '') => {
    const backdrop = document.createElement('div'); backdrop.className = 'site-modal-backdrop';
    const panel = document.createElement('section'); panel.className = 'site-modal'; panel.setAttribute('role', 'dialog');
    const titleId = newId('site-modal-title'); panel.setAttribute('aria-labelledby', titleId);
    const header = document.createElement('header'); header.className = 'site-modal-header';
    const heading = document.createElement('h2'); heading.id = titleId; heading.textContent = title;
    const close = document.createElement('button'); close.type = 'button'; close.className = 'site-modal-close'; close.setAttribute('aria-label', `${title} 닫기`); close.textContent = '×'; close.addEventListener('click', closeSurface);
    header.append(heading, close); panel.appendChild(header);
    if (description) { const copy = document.createElement('p'); copy.className = 'site-modal-description'; copy.textContent = description; panel.appendChild(copy); }
    const content = document.createElement('div'); content.className = 'site-modal-content'; panel.appendChild(content); backdrop.appendChild(panel);
    return {backdrop, panel, content};
  };
  const colorPicker = () => {
    const fieldset = document.createElement('fieldset'); fieldset.className = 'color-picker';
    const legend = document.createElement('legend'); legend.textContent = '대화 색상'; fieldset.appendChild(legend);
    for (const [key, label] of COLOR_OPTIONS) {
      const option = document.createElement('button'); option.type = 'button'; option.className = 'color-option'; option.dataset.color = key;
      option.setAttribute('aria-pressed', String(preferences.color === key));
      const swatch = document.createElement('span'); swatch.className = 'color-swatch'; swatch.setAttribute('aria-hidden', 'true');
      const text = document.createElement('span'); text.textContent = label; option.append(swatch, text);
      option.addEventListener('click', () => {
        preferences.color = key; applyPreferences(); savePreferences();
        for (const node of fieldset.querySelectorAll('.color-option')) node.setAttribute('aria-pressed', String(node === option));
      });
      fieldset.appendChild(option);
    }
    return fieldset;
  };
  const readProfilePhoto = file => new Promise((resolve, reject) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return reject(new Error('JPEG, PNG, WebP 이미지만 선택할 수 있습니다.'));
    if (file.size > PHOTO_BYTES_LIMIT) return reject(new Error('프로필 이미지는 2MB 이하여야 합니다.'));
    const objectUrl = URL.createObjectURL(file); const image = new Image();
    image.onload = () => {
      try {
        if (image.naturalWidth > PHOTO_DIMENSION_LIMIT || image.naturalHeight > PHOTO_DIMENSION_LIMIT) throw new Error('이미지 크기는 가로·세로 4096px 이하여야 합니다.');
        const size = Math.min(image.naturalWidth, image.naturalHeight); const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256; const context = canvas.getContext('2d', {alpha: false});
        if (!context) throw new Error('프로필 이미지를 처리하지 못했습니다.');
        context.fillStyle = '#fff'; context.fillRect(0, 0, 256, 256);
        context.drawImage(image, (image.naturalWidth - size) / 2, (image.naturalHeight - size) / 2, size, size, 0, 0, 256, 256);
        resolve(canvas.toDataURL('image/webp', .86));
      } catch (error) { reject(error); } finally { URL.revokeObjectURL(objectUrl); }
    };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('이미지 파일을 읽지 못했습니다.')); };
    image.src = objectUrl;
  });
  const openProfile = () => {
    const {backdrop, panel, content} = modalShell('프로필', '계정 이름과 handle은 Core /v2/me에서 읽고, 사진과 로컬 표시 이름은 이 브라우저에만 저장됩니다.');
    const preview = document.createElement('div'); preview.className = 'profile-photo-preview'; preview.textContent = initials(preferences.displayName || 'LOTBI');
    if (preferences.photo) preview.style.backgroundImage = `url(${preferences.photo})`;
    const photoLabel = document.createElement('label'); photoLabel.className = 'site-button site-button-secondary'; photoLabel.textContent = '사진 선택';
    const photo = document.createElement('input'); photo.type = 'file'; photo.accept = 'image/jpeg,image/png,image/webp'; photo.className = 'sr-only'; photoLabel.appendChild(photo);
    const error = document.createElement('p'); error.className = 'site-field-error'; error.setAttribute('role', 'alert');
    const nameLabel = document.createElement('label'); nameLabel.className = 'site-field'; nameLabel.textContent = '표시 이름';
    const name = document.createElement('input'); name.type = 'text'; name.maxLength = 40; name.value = preferences.displayName; name.autocomplete = 'off'; nameLabel.appendChild(name);
    const handle = document.createElement('div'); handle.className = 'site-readonly-field';
    const handleTitle = document.createElement('strong'); handleTitle.textContent = '@handle';
    const handleValue = document.createElement('span'); handleValue.textContent = serverIdentity?.accountHandle ? `@${serverIdentity.accountHandle}` : '등록된 handle 없음'; handle.append(handleTitle, handleValue);
    const save = document.createElement('button'); save.type = 'button'; save.className = 'site-button site-button-primary'; save.textContent = '저장';
    photo.addEventListener('change', async () => {
      const file = photo.files?.[0]; if (!file) return; error.textContent = '';
      try { preferences.photo = await readProfilePhoto(file); preview.style.backgroundImage = `url(${preferences.photo})`; }
      catch (caught) { error.textContent = caught instanceof Error ? caught.message : '이미지를 처리하지 못했습니다.'; }
    });
    save.addEventListener('click', () => {
      preferences.displayName = name.value.trim().slice(0, 40); savePreferences(); refreshAuthenticatedProfileSlots(); closeSurface();
    });
    content.append(preview, photoLabel, error, nameLabel, handle, save); installSurfaceBehavior(backdrop, panel, {modal: true});
  };
  const openPersonalization = () => {
    const {backdrop, panel, content} = modalShell('개인 맞춤 설정', '선택한 대화 색상은 현재 사용자 설치의 이 브라우저에 저장됩니다.');
    content.appendChild(colorPicker()); installSurfaceBehavior(backdrop, panel, {modal: true});
  };
  const openSettings = () => {
    const {backdrop, panel, content} = modalShell('설정');
    const themeLabel = document.createElement('label'); themeLabel.className = 'site-field'; themeLabel.textContent = '테마';
    const select = document.createElement('select');
    for (const [value, label] of [['system', '기기 설정'], ['light', '라이트'], ['dark', '다크']]) {
      const option = document.createElement('option'); option.value = value; option.textContent = label; option.selected = preferences.theme === value; select.appendChild(option);
    }
    select.addEventListener('change', () => { preferences.theme = select.value; applyPreferences(); savePreferences(); });
    themeLabel.appendChild(select); content.append(themeLabel, colorPicker()); installSurfaceBehavior(backdrop, panel, {modal: true});
  };
  const openHelp = () => {
    const {backdrop, panel, content} = modalShell('도움말'); const links = document.createElement('nav');
    links.className = 'help-links'; links.setAttribute('aria-label', '도움말 링크');
    for (const [href, label] of [['/contact.html', '도움말 센터 및 버그 신고'], ['/terms.html', '이용약관'], ['/privacy.html', '개인정보처리방침']]) {
      const link = document.createElement('a'); link.href = href; link.textContent = label; links.appendChild(link);
    }
    content.appendChild(links); installSurfaceBehavior(backdrop, panel, {modal: true});
  };
  const openProfileMenu = trigger => {
    const layer = document.createElement('div'); layer.className = 'profile-popover-layer';
    const menu = document.createElement('div'); menu.className = 'profile-popover'; menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', '프로필 메뉴');
    for (const [label, action] of [['개인 맞춤 설정', openPersonalization], ['프로필', openProfile], ['설정', openSettings], ['도움말', openHelp]]) {
      const button = document.createElement('button'); button.type = 'button'; button.setAttribute('role', 'menuitem'); button.textContent = label;
      button.addEventListener('click', () => { closeSurface(); action(); }); menu.appendChild(button);
    }
    const logout = document.createElement('button'); logout.type = 'button'; logout.setAttribute('role', 'menuitem');
    logout.className = 'profile-menu-logout'; logout.textContent = '로그아웃'; logout.disabled = !sessionToken;
    if (!sessionToken) logout.title = 'Site child session 연결 후 사용할 수 있습니다.';
    logout.addEventListener('click', async () => {
      if (!sessionToken) return;
      logout.disabled = true; logout.textContent = '로그아웃 중…';
      try {
        await logoutSiteSession(sessionToken); sessionToken = undefined; serverIdentity = undefined; closeSurface();
        switchNamespace(browserAnonymousNamespace());
        window.dispatchEvent(new CustomEvent(SESSION_STATE_EVENT, {detail: {authenticated: false, reason: 'site-logout'}}));
        setStatus('LOTBI Site에서 로그아웃했습니다. 이 브라우저의 계정별 대화는 분리 보존됩니다.');
      } catch (error) {
        logout.disabled = false; logout.textContent = '로그아웃';
        setStatus(error instanceof Error ? error.message : '로그아웃하지 못했습니다.');
      }
    });
    menu.appendChild(logout); layer.appendChild(menu); trigger.setAttribute('aria-expanded', 'true'); installSurfaceBehavior(layer, menu);
  };

  const setVoiceFeedback = (message = '') => {
    setStatus(message || (sessionToken ? 'LOTBI와 대화할 준비가 되었습니다.' : '메시지를 보내면 안전한 LOTBI 계정 연결이 필요한 경우 로그인으로 이동합니다.'));
    if (!(stateRegion instanceof HTMLElement)) return;
    if (!message) {
      if (stateRegion.dataset.composerVoice === 'true') { stateRegion.hidden = true; stateRegion.textContent = ''; delete stateRegion.dataset.composerVoice; }
      return;
    }
    stateRegion.dataset.composerVoice = 'true'; stateRegion.textContent = message; stateRegion.hidden = false;
  };
  const updateSendState = () => {
    sendButton.disabled = inFlight || prompt.value.trim().length === 0;
    sendButton.setAttribute('aria-label', inFlight ? '전송 중' : '전송'); sendButton.title = inFlight ? '전송 중' : '전송';
    micButton.disabled = inFlight || voiceRequesting;
  };
  const setListeningState = listening => {
    voiceListening = listening; micButton.setAttribute('aria-pressed', String(listening));
    micButton.setAttribute('aria-label', listening ? '음성 입력 중지' : '음성 입력'); micButton.title = listening ? '듣는 중 — 눌러서 종료' : '음성 입력';
    if (listening) micButton.dataset.listening = 'true'; else delete micButton.dataset.listening;
  };
  const requestMicrophoneAccess = async () => {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') throw new Error('음성 입력을 지원하지 않는 브라우저입니다.');
    const stream = await navigator.mediaDevices.getUserMedia({audio: true}); for (const track of stream.getTracks()) track.stop();
  };
  const startVoiceInput = async () => {
    if (inFlight || voiceRequesting) return;
    if (voiceListening && voiceRecognition) { voiceRecognition.stop(); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (typeof SpeechRecognition !== 'function') { setVoiceFeedback('음성 입력을 지원하지 않는 브라우저입니다. 텍스트로 입력해 주세요.'); prompt.focus(); return; }
    voiceRequesting = true; micButton.disabled = true; micButton.dataset.requesting = 'true'; setVoiceFeedback('마이크 권한을 확인하고 있습니다.');
    try {
      await requestMicrophoneAccess(); const recognition = new SpeechRecognition(); voiceRecognition = recognition;
      recognition.lang = 'ko-KR'; recognition.continuous = false; recognition.interimResults = false; recognition.maxAlternatives = 1;
      recognition.onstart = () => { setListeningState(true); setVoiceFeedback('듣고 있습니다. 말씀해 주세요.'); };
      recognition.onresult = event => {
        const transcript = event?.results?.[0]?.[0]?.transcript?.trim?.() || ''; if (!transcript) return;
        const current = prompt.value.trimEnd(); prompt.value = current ? `${current} ${transcript}` : transcript;
        prompt.dispatchEvent(new Event('input', {bubbles: true})); setVoiceFeedback('음성 입력이 텍스트로 변환되었습니다. 확인 후 전송해 주세요.'); prompt.focus();
      };
      recognition.onerror = event => setVoiceFeedback(voiceErrorMessage(event));
      recognition.onend = () => { setListeningState(false); if (voiceRecognition === recognition) voiceRecognition = undefined; updateSendState(); prompt.focus(); };
      recognition.start();
    } catch (error) { setListeningState(false); setVoiceFeedback(voiceErrorMessage(error)); prompt.focus(); }
    finally { voiceRequesting = false; delete micButton.dataset.requesting; updateSendState(); }
  };
  const showError = (error, retryText, retryWithoutDuplicate) => {
    const wrapper = document.createElement('article'); wrapper.className = 'chat-message chat-message-error'; wrapper.setAttribute('role', 'alert');
    const body = document.createElement('p'); body.className = 'chat-message-body'; body.textContent = userFacingErrorMessage(error); wrapper.appendChild(body);
    appendSafeErrorEvidence(wrapper, error); logSafeConversationFailure(error);
    const retryable = isSessionError(error) || !(error instanceof SiteCoreError) || error.retryable;
    if (retryable) {
      const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'chat-retry-button'; retry.textContent = isSessionError(error) ? '다시 연결' : '다시 시도';
      retry.addEventListener('click', async () => {
        retry.disabled = true;
        if (isSessionError(error) || !sessionToken) {
          try { await beginSiteHandoff(retryText); }
          catch (caught) { retry.disabled = false; body.textContent = caught instanceof Error ? caught.message : '로그인 연결을 시작하지 못했습니다.'; }
          return;
        }
        wrapper.remove(); await requestAssistant(retryText, !retryWithoutDuplicate);
      });
      wrapper.appendChild(retry);
    }
    appendNode(wrapper);
  };
  const requestAssistant = async (text, appendUserMessage = true) => {
    const message = typeof text === 'string' ? text.trim() : ''; if (!message || inFlight) return;
    const submittedAt = performanceNow(); const requestsBefore = resourceCounts(); recordTiming('T0-submit', {length: message.length});
    if (!stateReady) switchNamespace(normalizedNamespace(identityKey) || browserAnonymousNamespace());
    ensureThread(message);
    if (appendUserMessage) {
      appendNode(createMessage('user', message)); appendPersistedMessage({role: 'user', text: message, meta: {}});
    }
    const local = deterministicReply(message);
    if (local) {
      diagnostics.lastPath = 'LOCAL_DETERMINISTIC'; diagnostics.deterministicReplies += 1; diagnostics.providerCallsAvoided += 1;
      recordTiming('T1-local-route', {coreCalls: 0, providerCalls: 0}); await Promise.resolve();
      const record = {role: 'assistant', text: local, meta: {status: 'ANSWERED', responseMode: 'LOCAL_DETERMINISTIC'}};
      appendNode(createMessage('assistant', local, record.meta)); appendPersistedMessage(record);
      diagnostics.lastVisibleAnswerMs = Math.round(Math.max(0, performanceNow() - submittedAt));
      const requestsAfter = resourceCounts();
      diagnostics.lastCoreRequestDelta = requestsAfter.core - requestsBefore.core;
      diagnostics.lastExternalAiRequestDelta = requestsAfter.externalAi - requestsBefore.externalAi;
      publishDiagnostics();
      recordTiming('T5-dom-render', {durationMs: diagnostics.lastVisibleAnswerMs, coreCalls: diagnostics.lastCoreRequestDelta, providerCalls: 0, externalAiCalls: diagnostics.lastExternalAiRequestDelta});
      console.info(`[LOTBI deterministic evidence] latencyMs=${diagnostics.lastVisibleAnswerMs} coreRequests=${diagnostics.lastCoreRequestDelta} providerRequests=0 externalAiRequests=${diagnostics.lastExternalAiRequestDelta}`);
      setStatus('LOTBI의 즉시 응답이 도착했습니다.'); prompt.focus(); return;
    }
    if (!sessionToken) {
      try { await beginSiteHandoff(message); } catch (caught) { showError(caught, message, false); }
      return;
    }
    const loading = appendNode(createLoadingMessage()); inFlight = true; updateSendState(); setVoiceFeedback(''); setStatus('LOTBI 응답을 기다리는 중입니다.');
    diagnostics.lastPath = 'CORE_CONVERSATION'; diagnostics.coreCalls += 1;
    const coreStartedAt = performanceNow(); recordTiming('T1-core-request', {coreCall: diagnostics.coreCalls});
    try {
      const response = await sendConversationMessage(sessionToken, message);
      diagnostics.lastCoreDurationMs = Math.round(Math.max(0, performanceNow() - coreStartedAt)); recordTiming('T2-core-response', {durationMs: diagnostics.lastCoreDurationMs});
      loading.parentElement?.remove();
      const meta = {status: response.status, responseMode: response.responseMode, correlationId: response.correlationId, followUpRequired: response.status === 'FOLLOW_UP_REQUIRED' || response.followUp?.required === true};
      appendNode(createMessage('assistant', response.assistantText, meta)); appendPersistedMessage({role: 'assistant', text: response.assistantText, meta});
      diagnostics.lastVisibleAnswerMs = Math.round(Math.max(0, performanceNow() - submittedAt)); recordTiming('T5-dom-render', {durationMs: diagnostics.lastVisibleAnswerMs, coreCalls: 1});
      setStatus(response.status === 'FOLLOW_UP_REQUIRED' ? 'LOTBI가 추가 확인이 필요한 응답을 보냈습니다.' : 'LOTBI 응답이 도착했습니다.');
    } catch (caught) {
      loading.parentElement?.remove(); if (isSessionError(caught)) sessionToken = undefined;
      showError(caught, message, true); setStatus('LOTBI 대화를 완료하지 못했습니다.');
    } finally { inFlight = false; updateSendState(); prompt.focus(); }
  };
  const submitCurrentPrompt = async () => {
    if (inFlight) return; const message = prompt.value.trim(); if (!message) return;
    if (voiceListening && voiceRecognition) voiceRecognition.stop();
    prompt.value = ''; state.draft = ''; saveState(); prompt.dispatchEvent(new Event('input', {bubbles: true})); await requestAssistant(message, true);
  };

  micButton.disabled = false; micButton.setAttribute('aria-pressed', 'false'); micButton.setAttribute('aria-label', '음성 입력'); micButton.title = '음성 입력';
  prompt.addEventListener('input', () => { updateSendState(); if (stateReady) { state.draft = prompt.value.slice(0, 1000); saveState(); } });
  prompt.addEventListener('compositionend', updateSendState);
  prompt.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); void submitCurrentPrompt(); } });
  sendButton.addEventListener('click', () => void submitCurrentPrompt());
  micButton.addEventListener('click', () => void startVoiceInput());
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    const newChat = target?.closest('[data-new-conversation]');
    if (newChat) { event.preventDefault(); startNewConversation(); return; }
    const trigger = target?.closest('[data-profile-menu-trigger]');
    if (trigger instanceof HTMLElement) { event.preventDefault(); openProfileMenu(trigger); }
  });
  window.addEventListener(SESSION_STATE_EVENT, event => {
    const detail = event instanceof CustomEvent ? event.detail : undefined;
    if (!detail || typeof detail.authenticated !== 'boolean') return;
    if (detail.authenticated) {
      const key = normalizedNamespace(detail.identityKey || detail.installationId); if (key) switchNamespace(key);
      refreshAuthenticatedProfileSlots();
    } else if (!sessionToken) switchNamespace(browserAnonymousNamespace());
  });
  window.addEventListener(SIDEBAR_RENDERED_EVENT, () => {
    refreshAuthenticatedProfileSlots();
    if (!stateReady && document.body.dataset.siteAuthState === 'unauthenticated') {
      switchNamespace(browserAnonymousNamespace());
    }
  });
  updateSendState(); setStatus(sessionToken ? 'LOTBI와 대화할 준비가 되었습니다.' : '메시지를 보내면 안전한 LOTBI 계정 연결이 필요한 경우 로그인으로 이동합니다.');
  if (namespace) switchNamespace(namespace); else if (document.body.dataset.siteAuthState === 'unauthenticated') switchNamespace(browserAnonymousNamespace());
  if (sessionToken) void loadServerIdentity();
  if (autoSend && typeof initialText === 'string' && initialText.trim()) queueMicrotask(() => void requestAssistant(initialText, true));
  return true;
}

function autoMount() { if (document.getElementById('lotbi-prompt')) mountConversation(); }
ensureConversationStyles();
Object.defineProperty(window, '__lotbiConversationUx', {value: Object.freeze({snapshot: () => Object.freeze({...diagnostics})}), writable: false, configurable: false});
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount, {once: true}); else autoMount();
