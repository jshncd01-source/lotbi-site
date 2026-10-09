// CONVERSATION-ACCOUNT-SYNC-01 — the screen side of account-stored history:
// the "동기화 대기" mark and the settings button beside "최근 대화", the
// "대화 기록 설정" dialog (on/off, delete everything) and the one-time
// "이 기기의 대화 N개를 계정에 올릴까요?" question.
//
// Colours come only from the theme tokens (site-theme-tokens.css is not
// changed), so light, dark and system modes follow the rest of the sidebar.

const STYLE_ID = 'conversation-sync-styles';
const STYLES = `
/* The heading keeps "최근 대화" on one line. */
.nav-section-title-icon:has(.conversation-sync-settings) > span:not(.conversation-sync-status) {
  flex: 0 0 auto;
  white-space: nowrap;
}
/* The desktop sidebar column is too narrow for title, mark and button on one
   line: there the mark takes its own line under the title. */
#desktop-recent-title:has(.conversation-sync-settings) {
  flex-wrap: wrap;
  row-gap: 2px;
}
#desktop-recent-title .conversation-sync-status {
  order: 3;
  flex: 1 0 100%;
  margin: 0 0 0 25px;
}
#desktop-recent-title .conversation-sync-settings { margin-left: auto; }
.nav-section-title-icon .conversation-sync-status {
  margin-left: auto;
  min-width: 0;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  color: var(--lotbi-warning-text, #8a4b16);
}
.nav-section-title-icon .conversation-sync-status[data-sync-tone="muted"] {
  color: var(--lotbi-text-primary, #212121);
  font-weight: 500;
  opacity: .72;
}
.nav-section-title-icon .conversation-sync-settings {
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  margin: -4px -6px -4px 0;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.nav-section-title-icon .conversation-sync-status[hidden] + .conversation-sync-settings { margin-left: auto; }
.nav-section-title-icon .conversation-sync-settings:hover,
.nav-section-title-icon .conversation-sync-settings:focus-visible {
  background: var(--lotbi-surface-hover, #f0f0f0);
}
.nav-section-title-icon .conversation-sync-settings:focus-visible {
  outline: 2px solid var(--lotbi-focus-ring, #454545);
  outline-offset: 1px;
}
.nav-section-title-icon .conversation-sync-settings svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
}
.conversation-sync-toggle-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 0;
  border-top: 1px solid var(--lotbi-border-default, #e5e5e5);
  border-bottom: 1px solid var(--lotbi-border-default, #e5e5e5);
  color: var(--lotbi-text-primary, #212121);
  cursor: pointer;
}
.conversation-sync-toggle-row strong { display: block; font-size: 15px; line-height: 1.4; }
.conversation-sync-toggle-row small { display: block; margin-top: 4px; font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; }
.conversation-sync-toggle-row input {
  flex: 0 0 22px;
  width: 22px;
  height: 22px;
  margin: 2px 0 0;
  accent-color: var(--lotbi-brand-solid-bg, #212121);
  cursor: pointer;
}
.conversation-sync-state-line,
.conversation-sync-error {
  margin: 12px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--lotbi-text-primary, #212121);
  overflow-wrap: anywhere;
}
.conversation-sync-error { color: var(--lotbi-error-text, #a02645); }
.conversation-sync-error:empty { display: none; }
.conversation-sync-delete-all { width: 100%; margin-top: 16px; min-height: 44px; }
.conversation-sync-upload-copy { margin: 0 0 16px; font-size: 14px; line-height: 1.55; color: var(--lotbi-text-primary, #212121); }
@media (max-width: 380px) {
  .conversation-management-modal-actions.conversation-sync-actions { flex-direction: column-reverse; }
  .conversation-management-modal-actions.conversation-sync-actions > .site-button { width: 100%; min-height: 44px; }
}
`;

export function ensureConversationSyncStyles(doc = document) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLES;
  doc.head.appendChild(style);
}

const STATUS_LABEL = Object.freeze({
  pending: ['동기화 대기', 'warning'],
  off: ['이 기기에만 저장', 'muted'],
  unavailable: ['이 기기에만 저장', 'muted'],
});

const STATE_LINE = Object.freeze({
  loading: '계정에 저장된 대화를 확인하고 있습니다.',
  saving: '계정에 저장하고 있습니다.',
  synced: '대화가 계정에 저장되어 있습니다. 로그인한 다른 기기에서도 이어 볼 수 있습니다.',
  pending: '동기화 대기 중입니다. 이 기기의 대화는 그대로 있고, 연결되면 자동으로 계정에 저장합니다.',
  off: '지금은 이 기기에만 저장합니다. 이미 계정에 저장된 대화는 그대로 남아 있습니다.',
  unavailable: '지금은 계정 저장을 쓸 수 없어 이 기기에만 저장합니다.',
});

function settingsIcon(doc) {
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const d of ['M4 7h9', 'M19 7h1', 'M4 17h3', 'M13 17h7']) {
    const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }
  for (const [cx, cy] of [[16, 7], [10, 17]]) {
    const circle = doc.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', String(cx)); circle.setAttribute('cy', String(cy)); circle.setAttribute('r', '2.5');
    svg.appendChild(circle);
  }
  return svg;
}

// Beside every "최근 대화" heading (desktop sidebar and mobile drawer).
export function renderConversationSyncControls({status, signedIn, onOpenSettings, doc = document}) {
  for (const list of doc.querySelectorAll('[data-recent-conversations]')) {
    const heading = list.closest('section')?.querySelector('h2');
    if (!(heading instanceof HTMLElement)) continue;
    let mark = heading.querySelector('[data-conversation-sync-status]');
    let button = heading.querySelector('[data-conversation-sync-settings]');
    if (!signedIn) {
      mark?.remove(); button?.remove();
      continue;
    }
    if (!mark) {
      mark = doc.createElement('span');
      mark.className = 'conversation-sync-status';
      mark.dataset.conversationSyncStatus = '';
      mark.setAttribute('role', 'status');
      heading.appendChild(mark);
    }
    if (!button) {
      button = doc.createElement('button');
      button.type = 'button';
      button.className = 'conversation-sync-settings';
      button.dataset.conversationSyncSettings = '';
      button.setAttribute('aria-label', '대화 기록 설정');
      button.title = '대화 기록 설정';
      button.appendChild(settingsIcon(doc));
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        onOpenSettings?.(button);
      });
      heading.appendChild(button);
    }
    const [label, tone] = STATUS_LABEL[status] || ['', ''];
    mark.textContent = label;
    mark.hidden = !label;
    if (tone) mark.dataset.syncTone = tone; else delete mark.dataset.syncTone;
  }
}

function actionsRow(doc) {
  const actions = doc.createElement('div');
  actions.className = 'conversation-management-modal-actions conversation-sync-actions';
  return actions;
}

function button(doc, label, className, onClick) {
  const control = doc.createElement('button');
  control.type = 'button';
  control.className = className;
  control.textContent = label;
  control.addEventListener('click', onClick);
  return control;
}

// "이 기기의 대화 N개를 계정에 올릴까요?" — resolves 'yes', 'no', or null when
// the dialog was dismissed without an answer (asked again next time).
export function askDeviceUpload({count, modalShell, installSurfaceBehavior, closeSurface, doc = document}) {
  return new Promise(resolve => {
    let settled = false;
    const finish = answer => { if (settled) return; settled = true; resolve(answer); };
    const {backdrop, panel, content} = modalShell('이 기기의 대화 올리기', `이 기기의 대화 ${count}개를 계정에 올릴까요?`);
    panel.dataset.conversationSyncUpload = '';
    const copy = doc.createElement('p');
    copy.className = 'conversation-sync-upload-copy';
    copy.textContent = '올리면 로그인한 다른 기기에서도 이어 볼 수 있고, 계정에 1년 동안 보관됩니다. 아니오를 고르면 이 기기에만 그대로 남습니다.';
    const actions = actionsRow(doc);
    const no = button(doc, '아니오', 'site-button site-button-secondary', () => { finish('no'); closeSurface(); });
    no.dataset.conversationSyncUploadAnswer = 'no';
    const yes = button(doc, '예, 올리기', 'site-button site-button-primary', () => { finish('yes'); closeSurface(); });
    yes.dataset.conversationSyncUploadAnswer = 'yes';
    actions.append(no, yes);
    content.append(copy, actions);
    installSurfaceBehavior(backdrop, panel, {modal: true, onClose: () => finish(null)});
    queueMicrotask(() => yes.focus());
  });
}

export function openConversationSyncSettings({
  sync,
  modalShell,
  installSurfaceBehavior,
  closeSurface,
  trigger,
  onDeleteAll,
  setStatus,
  doc = document,
}) {
  const {backdrop, panel, content} = modalShell('대화 기록 설정', '로그인한 계정에 최근 대화를 저장해 휴대폰·PC 어디서든 이어 볼 수 있습니다.');
  panel.dataset.conversationSyncSettingsPanel = '';
  const row = doc.createElement('label');
  row.className = 'conversation-sync-toggle-row';
  const copy = doc.createElement('span');
  const title = doc.createElement('strong'); title.textContent = '계정에 대화 기록 저장';
  const hint = doc.createElement('small');
  hint.textContent = '켜 두면 대화가 계정에 1년 동안 보관됩니다. 끄면 그 뒤 대화는 이 기기에만 남습니다.';
  copy.append(title, hint);
  const input = doc.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('role', 'switch');
  input.dataset.conversationSyncToggle = '';
  input.checked = sync.enabled();
  input.setAttribute('aria-label', '계정에 대화 기록 저장');
  row.append(copy, input);
  const stateLine = doc.createElement('p');
  stateLine.className = 'conversation-sync-state-line';
  stateLine.dataset.conversationSyncStateLine = '';
  const error = doc.createElement('p');
  error.className = 'conversation-sync-error';
  error.setAttribute('role', 'alert');
  const refreshLine = () => { stateLine.textContent = STATE_LINE[sync.status()] || ''; };
  refreshLine();
  input.addEventListener('change', async () => {
    const next = input.checked;
    input.disabled = true; error.textContent = '';
    try {
      const saved = await sync.setEnabled(next);
      input.checked = saved;
      setStatus?.(saved ? '대화 기록을 계정에 저장합니다.' : '이제 대화를 이 기기에만 저장합니다.');
    } catch {
      input.checked = !next;
      error.textContent = '설정을 저장하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.';
    } finally {
      input.disabled = false;
      refreshLine();
    }
  });
  const deleteAll = button(doc, '전체 대화 삭제', 'site-button conversation-delete-confirm conversation-sync-delete-all', () => {
    openDeleteAllConfirm({sync, modalShell, installSurfaceBehavior, closeSurface, onDeleteAll, setStatus, doc});
  });
  deleteAll.dataset.conversationSyncDeleteAll = '';
  content.append(row, stateLine, error, deleteAll);
  installSurfaceBehavior(backdrop, panel, {modal: true, trigger});
  queueMicrotask(() => input.focus());
}

function openDeleteAllConfirm({sync, modalShell, installSurfaceBehavior, closeSurface, onDeleteAll, setStatus, doc}) {
  const {backdrop, panel, content} = modalShell('전체 대화 삭제', '이 기기와 계정에 저장된 대화를 모두 삭제합니다. 로그인한 다른 기기에서도 사라지며 되돌릴 수 없습니다.');
  panel.dataset.conversationSyncDeleteAllConfirm = '';
  const actions = actionsRow(doc);
  const cancel = button(doc, '취소', 'site-button site-button-secondary', closeSurface);
  const confirm = button(doc, '모두 삭제', 'site-button conversation-delete-confirm', async () => {
    confirm.disabled = true; cancel.disabled = true;
    // The account delete is marked pending first (so nothing is pulled back),
    // then this device's copy goes at once, then the account answers.
    const deleting = sync.deleteAll();
    onDeleteAll?.();
    let outcome = 'deleted';
    try { outcome = await deleting; } catch { outcome = 'pending'; }
    closeSurface();
    setStatus?.(outcome === 'deleted'
      ? '모든 대화를 삭제했습니다.'
      : '이 기기의 대화를 삭제했습니다. 계정의 대화는 연결되면 삭제합니다.');
  });
  confirm.dataset.conversationSyncDeleteAllConfirmButton = '';
  actions.append(cancel, confirm);
  content.append(actions);
  installSurfaceBehavior(backdrop, panel, {modal: true});
  queueMicrotask(() => cancel.focus());
}
