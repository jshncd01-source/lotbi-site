let dialog;
let form;
let result;
let status;
let clicked;
let incident;
let dialogTrigger;
let methodChooser;
let checkStep;
let methodDescription;
let filePreview;
let previewImage;
let previewPrompt;
let loginGate;
let workspace;
let voiceText;
let voiceStart;
let loginStatus;
let previewUrl = '';
let activeKind = '';
let openSequence = 0;

const allowedFileTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'text/plain', 'text/html', 'application/xhtml+xml', 'application/pdf']);
const allowedFileExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'pdf', 'txt', 'html', 'htm']);
const maxFileBytes = 10 * 1024 * 1024;
const reopenStorageKey = 'lotbi.scam-shield.reopen.v1';
const reopenTtlMs = 15 * 60 * 1000;

const escapeText = value => String(value ?? '');

function selectedInput() {
  return activeKind || form?.querySelector('input[name="scam-input-kind"]:checked')?.value || '';
}

function activeFileInput() {
  const names = {camera: 'scamCamera', photo: 'scamPhoto', document: 'scamDocument'};
  const name = names[selectedInput()];
  return name ? form?.elements?.[name] : null;
}

function fileIsSupported(file) {
  const type = typeof file?.type === 'string' ? file.type.toLowerCase() : '';
  const extension = typeof file?.name === 'string' && file.name.includes('.')
    ? file.name.split('.').pop().toLowerCase()
    : '';
  return (!type || allowedFileTypes.has(type)) && allowedFileExtensions.has(extension);
}

function clearFilePreview() {
  if (previewUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(previewUrl);
  previewUrl = '';
  if (previewImage) {
    previewImage.hidden = true;
    previewImage.removeAttribute('src');
  }
  if (previewPrompt) previewPrompt.textContent = '';
  if (filePreview) filePreview.hidden = true;
}

function updateFilePreview() {
  clearFilePreview();
  const input = activeFileInput();
  const file = input?.files?.[0];
  if (!file || !filePreview || !previewPrompt) return;
  const isImage = file.type.startsWith('image/');
  if (isImage && previewImage && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    previewUrl = URL.createObjectURL(file);
    previewImage.src = previewUrl;
    previewImage.hidden = false;
  }
  previewPrompt.textContent = isImage
    ? `선택한 사진 “${file.name}”을 LOTBI가 확인할까요?`
    : `선택한 문서 “${file.name}”를 LOTBI가 확인할까요?`;
  filePreview.hidden = false;
}

function updateInputPanels() {
  if (!form) return;
  const active = selectedInput();
  const hasSelection = Boolean(active);
  if (methodChooser) methodChooser.hidden = hasSelection;
  if (checkStep) checkStep.hidden = !hasSelection;
  if (methodDescription) methodDescription.hidden = hasSelection;
  form.querySelectorAll('[data-scam-input-panel]').forEach(panel => {
    const visible = panel.dataset.scamInputPanel === active;
    panel.hidden = !visible;
    panel.querySelectorAll('input, textarea').forEach(input => { input.disabled = !visible; });
  });
  const submit = form.querySelector('[type="submit"]');
  const labels = {
    camera: '이 사진 확인하기',
    photo: '이 사진 확인하기',
    document: '이 문서 확인하기',
    text: '문자 내용 확인하기',
    url: '인터넷 주소 확인하기',
    voice: '이 내용 확인하기',
  };
  if (submit) submit.textContent = labels[active] || '확인하기';
}

function list(title, values) {
  if (!Array.isArray(values) || !values.length) return null;
  const section = document.createElement('section');
  const heading = document.createElement('h4');
  heading.textContent = title;
  const ul = document.createElement('ul');
  values.forEach(value => {
    const li = document.createElement('li');
    li.textContent = escapeText(value);
    ul.append(li);
  });
  section.append(heading, ul);
  return section;
}

function resultHeadline(payload) {
  if (payload.riskLevel === 'UNVERIFIED') return '지금 정보만으로는 진짜라고 확인할 수 없어요.';
  if (payload.riskLevel === 'HIGH_RISK' || payload.riskLevel === 'CONFIRMED_MALICIOUS') return '이건 열지 마세요.';
  if (payload.riskLevel === 'SUSPICIOUS') return '조심하세요.';
  return payload.headline;
}

function render(payload) {
  result.replaceChildren();
  result.hidden = false;
  result.dataset.riskLevel = payload.riskLevel;
  const conclusion = document.createElement('section');
  const heading = document.createElement('h3');
  heading.textContent = '결론';
  const badge = document.createElement('p');
  badge.className = 'scam-result-headline';
  badge.textContent = resultHeadline(payload);
  conclusion.append(heading, badge);
  result.append(conclusion);
  [
    list('지금 하실 일', payload.doNow),
    list('하지 마세요', payload.doNot),
    list('왜 그렇게 판단했나요?', payload.reasons),
    list('확인된 내용', payload.confirmedFacts),
    list('아직 확인되지 않은 내용', payload.unverifiedItems),
    payload.incidentTriage ? list('이미 눌렀다면 해야 할 일', payload.incidentTriage.actions) : null,
  ].filter(Boolean).forEach(section => result.append(section));
  if (payload.evidence.length) {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = '분석 근거 자세히 보기';
    const ul = document.createElement('ul');
    payload.evidence.forEach(item => {
      const li = document.createElement('li');
      li.textContent = `${item.title}: ${item.technicalDetail}`;
      ul.append(li);
    });
    details.append(summary, ul);
    result.append(details);
  }
}

function renderUsageLimit(error) {
  result.replaceChildren();
  result.hidden = false;
  result.dataset.riskLevel = 'UNVERIFIED';
  const title = document.createElement('h3');
  title.textContent = '이번 달 심층분석 사용량을 모두 사용했어요';
  const caution = document.createElement('p');
  caution.textContent = '분석하지 못한 자료는 안전하다고 볼 수 없어요. 아래 기본 안전수칙을 먼저 지켜 주세요.';
  result.append(title, caution);
  const safety = list('지금 하실 일', error?.basicProtection?.nextSafeAction);
  if (safety) result.append(safety);
  const link = document.createElement('a');
  link.className = 'scam-usage-link';
  link.href = 'https://account.lotbiai.com/account';
  link.textContent = '구독 및 사용량 보기';
  result.append(link);
}

function requestAnalysis(formData) {
  return new Promise((resolve, reject) => {
    window.dispatchEvent(new CustomEvent('lotbi:scam-shield-request', {detail: {formData, resolve, reject}}));
  });
}

function requestSessionAvailability() {
  return new Promise(resolve => {
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(value === true);
    };
    const timeout = setTimeout(() => finish(false), 3000);
    try {
      window.dispatchEvent(new CustomEvent('lotbi:scam-shield-session-request', {detail: {resolve: finish}}));
    } catch {
      finish(false);
    }
  });
}

function showLoginGate() {
  if (loginGate) loginGate.hidden = false;
  if (workspace) workspace.hidden = true;
  if (loginStatus) loginStatus.textContent = '';
  loginGate?.querySelector('[data-scam-login]')?.focus();
}

function showWorkspace() {
  if (loginGate) loginGate.hidden = true;
  if (workspace) workspace.hidden = false;
  if (status) status.textContent = '확인 방법을 하나 선택해 주세요.';
  methodChooser?.querySelector('input, button')?.focus();
}

async function openDialog(event) {
  if (!dialog) return;
  const sequence = ++openSequence;
  dialogTrigger = event?.currentTarget instanceof HTMLElement ? event.currentTarget : document.activeElement;
  resetScamFlow();
  if (result) result.hidden = true;
  if (loginGate) loginGate.hidden = true;
  if (workspace) workspace.hidden = true;
  if (status) status.textContent = '로그인 상태를 확인하고 있어요.';
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else {
    dialog.setAttribute('open', '');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
  }
  notifyScamShieldVisibility();
  const authenticated = await requestSessionAvailability();
  if (sequence !== openSequence || !dialog.hasAttribute('open')) return;
  if (authenticated) showWorkspace();
  else showLoginGate();
}

function resetScamFlow() {
  form?.reset();
  activeKind = '';
  if (incident) incident.hidden = true;
  clearFilePreview();
  updateVoiceState(false);
  updateInputPanels();
}

function restoreDialogFocus() {
  const visibleTrigger = dialogTrigger instanceof HTMLElement && dialogTrigger.isConnected
    && !dialogTrigger.closest('[inert], [aria-hidden="true"]') && dialogTrigger.getClientRects().length;
  const target = visibleTrigger ? dialogTrigger : document.querySelector('[data-mobile-nav-open]');
  target?.focus?.();
}

function stopVoiceRecognition() {
  try { window.dispatchEvent(new CustomEvent('lotbi:voice-transcription-cancel')); } catch {}
  updateVoiceState(false);
}

function closeDialog() {
  if (!dialog) return;
  openSequence += 1;
  stopVoiceRecognition();
  if (typeof dialog.close === 'function') {
    dialog.close();
    // Chrome can hold the 'close' event until a frame is rendered, and a hidden
    // tab renders none; the URL follows the dialog now, not when it is shown.
    notifyScamShieldVisibility();
    return;
  }
  dialog.removeAttribute('open');
  dialog.removeAttribute('aria-modal');
  restoreDialogFocus();
  notifyScamShieldVisibility();
}

// SITE-REFRESH-ROUTE-RESTORE-01 — 진위확인 is the /#scam route. The
// conversation's route owner opens/closes it for reload and back/forward, and
// hears every open/close here so the URL follows the dialog.
function notifyScamShieldVisibility() {
  try { window.dispatchEvent(new CustomEvent('lotbi:scam-shield-visibility')); } catch {}
}

export function isScamShieldOpen() {
  return Boolean(dialog?.hasAttribute('open'));
}

export function openScamShield() {
  if (!dialog || isScamShieldOpen()) return;
  void openDialog();
}

export function closeScamShield() {
  if (isScamShieldOpen()) closeDialog();
}

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !event.defaultPrevented && dialog?.hasAttribute('open')) {
    event.preventDefault();
    closeDialog();
  }
});

async function submitAnalysis(event) {
  event.preventDefault();
  const data = new FormData();
  const kind = selectedInput();
  if (kind === 'text') data.set('text', form.elements.scamText.value.trim());
  if (kind === 'voice') data.set('text', form.elements.scamVoiceText.value.trim());
  if (kind === 'url') data.set('url', form.elements.scamUrl.value.trim());
  if (['camera', 'photo', 'document'].includes(kind)) {
    const file = activeFileInput()?.files?.[0];
    if (file && !fileIsSupported(file)) {
      status.textContent = '현재는 사진, PDF, TXT, HTML 파일만 확인할 수 있어요.';
      return;
    }
    if (file && (file.size <= 0 || file.size > maxFileBytes)) {
      status.textContent = '파일은 10MB 이하만 확인할 수 있어요.';
      return;
    }
    if (file) data.set('file', file);
  }
  if (![...data.values()].some(Boolean)) {
    status.textContent = '확인할 내용을 먼저 넣어 주세요.';
    return;
  }
  if (clicked.checked) {
    data.set('incident_level', form.elements.incidentLevel.value);
    data.set('device', form.elements.device.value);
  }
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  status.textContent = '파일을 실행하지 않고 안전하게 확인하고 있어요.';
  result.hidden = true;
  try {
    const payload = await requestAnalysis(data);
    render(payload);
    status.textContent = payload.riskLevel === 'UNVERIFIED'
      ? '진짜라고 확인되지 않았어요. 아래 내용을 꼭 확인해 주세요.'
      : '분석 결과가 나왔습니다.';
  } catch (error) {
    if (error?.code === 'PLAN_USAGE_LIMIT_REACHED' && error?.basicProtection?.available === true) {
      renderUsageLimit(error);
      status.textContent = '기본 안전수칙은 계속 볼 수 있어요.';
    } else if (error?.code === 'SCAM_SHIELD_SESSION_REQUIRED' || error?.status === 401 || error?.status === 403) {
      showLoginGate();
    } else {
      status.textContent = error instanceof Error ? error.message : '진위확인을 완료하지 못했습니다.';
    }
  } finally {
    submit.disabled = false;
  }
}

function returnToMethods() {
  stopVoiceRecognition();
  activeKind = '';
  form?.querySelectorAll('input[name="scam-input-kind"]').forEach(input => { input.checked = false; });
  clearFilePreview();
  updateInputPanels();
  status.textContent = '확인 방법을 하나 선택해 주세요.';
  methodChooser?.querySelector('input, button')?.focus();
}

function updateVoiceState(listening) {
  if (!voiceStart) return;
  voiceStart.disabled = false;
  voiceStart.setAttribute('aria-pressed', String(listening));
  voiceStart.textContent = listening ? '듣기 중지' : '다시 말하기';
  if (listening) voiceStart.dataset.listening = 'true';
  else delete voiceStart.dataset.listening;
}

function requestVoiceTranscript() {
  if (!voiceText || !voiceStart) return;
  if (voiceStart.dataset.listening === 'true') {
    stopVoiceRecognition();
    status.textContent = '듣기를 멈췄어요. 내용을 고치거나 다시 말해 주세요.';
    return;
  }
  voiceStart.disabled = true;
  status.textContent = '마이크 권한을 확인하고 있어요.';
  const detail = {
    onStatus(message) { status.textContent = message; },
    onListening(listening) { updateVoiceState(listening); },
    resolve(transcript) {
      voiceText.value = transcript;
      voiceText.dispatchEvent(new Event('input', {bubbles: true}));
      status.textContent = '들린 내용을 확인하고, 틀린 부분은 직접 고쳐 주세요.';
      updateVoiceState(false);
      voiceText.focus();
    },
    reject(error) {
      status.textContent = error instanceof Error ? error.message : '음성을 글자로 바꾸지 못했어요. 다시 말씀해 주세요.';
      updateVoiceState(false);
      voiceStart.focus();
    },
  };
  try {
    window.dispatchEvent(new CustomEvent('lotbi:voice-transcription-request', {detail}));
  } catch {
    detail.reject(new Error('이 브라우저에서는 음성 입력을 사용할 수 없어요. 직접 입력해 주세요.'));
  }
}

function selectVoiceInput() {
  activeKind = 'voice';
  form?.querySelectorAll('input[name="scam-input-kind"]').forEach(input => { input.checked = false; });
  clearFilePreview();
  updateInputPanels();
  status.textContent = '마이크에 대고 확인할 내용을 말씀해 주세요.';
  requestVoiceTranscript();
}

function beginLogin() {
  try { sessionStorage.setItem(reopenStorageKey, JSON.stringify({startedAt: Date.now()})); } catch {}
  if (loginStatus) loginStatus.textContent = '공식 LOTBI 로그인 화면으로 이동합니다.';
  const detail = {
    resolve() {},
    reject(error) {
      try { sessionStorage.removeItem(reopenStorageKey); } catch {}
      if (loginStatus) loginStatus.textContent = error instanceof Error ? error.message : '로그인을 시작하지 못했습니다. 다시 시도해 주세요.';
    },
  };
  try { window.dispatchEvent(new CustomEvent('lotbi:scam-shield-login-request', {detail})); }
  catch (error) { detail.reject(error); }
}

function shouldReopenAfterLogin() {
  try {
    const value = JSON.parse(sessionStorage.getItem(reopenStorageKey) || 'null');
    if (!value || !Number.isFinite(value.startedAt) || Date.now() - value.startedAt > reopenTtlMs) {
      sessionStorage.removeItem(reopenStorageKey);
      return false;
    }
    sessionStorage.removeItem(reopenStorageKey);
    return true;
  } catch {
    return false;
  }
}

function bindScamShield() {
  dialog = document.querySelector('[data-scam-dialog]');
  form = document.querySelector('[data-scam-form]');
  result = document.querySelector('[data-scam-result]');
  status = document.querySelector('[data-scam-status]');
  clicked = document.querySelector('[data-scam-clicked]');
  incident = document.querySelector('[data-scam-incident]');
  methodChooser = document.querySelector('[data-scam-methods]');
  checkStep = document.querySelector('[data-scam-step]');
  methodDescription = document.querySelector('[data-scam-description]');
  filePreview = document.querySelector('[data-scam-file-preview]');
  previewImage = document.querySelector('[data-scam-preview-image]');
  previewPrompt = document.querySelector('[data-scam-preview-prompt]');
  loginGate = document.querySelector('[data-scam-login-gate]');
  workspace = document.querySelector('[data-scam-workspace]');
  voiceText = document.querySelector('[data-scam-input-panel="voice"] textarea');
  voiceStart = document.querySelector('[data-scam-voice-start]');
  loginStatus = document.querySelector('[data-scam-login-status]');
  if (dialog && dialog.dataset.scamOutsideBound !== 'true') {
    dialog.dataset.scamOutsideBound = 'true';
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeDialog();
    });
    dialog.addEventListener('close', restoreDialogFocus);
    dialog.addEventListener('close', notifyScamShieldVisibility);
  }

  document.querySelectorAll('[data-scam-open]').forEach(button => {
    if (button.dataset.scamBound === 'true') return;
    button.dataset.scamBound = 'true';
    button.addEventListener('click', openDialog);
  });
  dialog?.querySelectorAll('[data-scam-close], [data-scam-login-cancel]').forEach(button => {
    if (button.dataset.scamBound === 'true') return;
    button.dataset.scamBound = 'true';
    button.addEventListener('click', closeDialog);
  });
  const loginButton = dialog?.querySelector('[data-scam-login]');
  if (loginButton && loginButton.dataset.scamBound !== 'true') {
    loginButton.dataset.scamBound = 'true';
    loginButton.addEventListener('click', beginLogin);
  }
  form?.querySelectorAll('input[name="scam-input-kind"]').forEach(input => {
    if (input.dataset.scamBound === 'true') return;
    input.dataset.scamBound = 'true';
    input.addEventListener('change', () => {
      activeKind = input.value;
      clearFilePreview();
      updateInputPanels();
      const panel = form.querySelector(`[data-scam-input-panel="${input.value}"]`);
      panel?.querySelector('input, textarea')?.focus();
      status.textContent = '확인할 내용을 넣은 뒤 아래 확인하기 버튼을 눌러 주세요.';
    });
  });
  form?.querySelectorAll('input[type="file"]').forEach(input => {
    if (input.dataset.scamFileBound === 'true') return;
    input.dataset.scamFileBound = 'true';
    input.addEventListener('change', updateFilePreview);
  });
  const backButton = form?.querySelector('[data-scam-method-back]');
  if (backButton && backButton.dataset.scamBound !== 'true') {
    backButton.dataset.scamBound = 'true';
    backButton.addEventListener('click', returnToMethods);
  }
  const reselectButton = form?.querySelector('[data-scam-reselect]');
  if (reselectButton && reselectButton.dataset.scamBound !== 'true') {
    reselectButton.dataset.scamBound = 'true';
    reselectButton.addEventListener('click', () => activeFileInput()?.click());
  }
  const voiceButton = form?.querySelector('[data-scam-voice]');
  if (voiceButton && voiceButton.dataset.scamBound !== 'true') {
    voiceButton.dataset.scamBound = 'true';
    voiceButton.addEventListener('click', selectVoiceInput);
  }
  if (voiceStart && voiceStart.dataset.scamBound !== 'true') {
    voiceStart.dataset.scamBound = 'true';
    voiceStart.addEventListener('click', requestVoiceTranscript);
  }
  if (clicked && clicked.dataset.scamBound !== 'true') {
    clicked.dataset.scamBound = 'true';
    clicked.addEventListener('change', () => { incident.hidden = !clicked.checked; });
  }
  if (form && form.dataset.scamBound !== 'true') {
    form.dataset.scamBound = 'true';
    form.addEventListener('submit', submitAnalysis);
  }
  updateInputPanels();
}

bindScamShield();
window.addEventListener('lotbi:home-shell-hydrated', bindScamShield);
window.addEventListener('lotbi:site-session-state', event => {
  if (event instanceof CustomEvent && event.detail?.authenticated === true && shouldReopenAfterLogin()) {
    queueMicrotask(() => openDialog());
  }
});
