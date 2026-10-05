let dialog;
let form;
let result;
let status;
let clicked;
let incident;
let dialogTrigger;

const escapeText = value => String(value ?? '');
const allowedFileTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'text/plain', 'text/html', 'application/xhtml+xml', 'application/pdf']);
const maxFileBytes = 10 * 1024 * 1024;

function selectedInput() {
  return form?.querySelector('input[name="scam-input-kind"]:checked')?.value || 'text';
}

function updateInputPanels() {
  if (!form) return;
  const active = selectedInput();
  form.querySelectorAll('[data-scam-input-panel]').forEach(panel => {
    const visible = panel.dataset.scamInputPanel === active;
    panel.hidden = !visible;
    panel.querySelectorAll('input, textarea').forEach(input => { input.disabled = !visible; });
  });
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

function render(payload) {
  result.replaceChildren();
  result.hidden = false;
  result.dataset.riskLevel = payload.riskLevel;
  const badge = document.createElement('p');
  badge.className = 'scam-result-headline';
  badge.textContent = payload.headline;
  result.append(badge);
  [
    list('지금 하실 일', payload.doNow),
    list('하지 마세요', payload.doNot),
    list('왜 그렇게 보나요?', payload.reasons),
    list('확인된 내용', payload.confirmedFacts),
    list('아직 확인 안 된 내용', payload.unverifiedItems),
    payload.incidentTriage ? list('이미 눌렀다면', payload.incidentTriage.actions) : null,
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

function requestAnalysis(formData) {
  return new Promise((resolve, reject) => {
    window.dispatchEvent(new CustomEvent('lotbi:scam-shield-request', {detail: {formData, resolve, reject}}));
  });
}

function openDialog(event) {
  if (!dialog) return;
  dialogTrigger = event?.currentTarget instanceof HTMLElement ? event.currentTarget : document.activeElement;
  result.hidden = true;
  status.textContent = '문자, 주소 또는 파일을 보내 주세요.';
  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
    return;
  }
  dialog.setAttribute('open', '');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
}

function restoreDialogFocus() {
  const visibleTrigger = dialogTrigger instanceof HTMLElement && dialogTrigger.isConnected
    && !dialogTrigger.closest('[inert], [aria-hidden="true"]') && dialogTrigger.getClientRects().length;
  const target = visibleTrigger ? dialogTrigger : document.querySelector('[data-mobile-nav-open]');
  target?.focus?.();
}

function closeDialog() {
  if (!dialog) return;
  if (typeof dialog.close === 'function') {
    dialog.close();
    return;
  }
  dialog.removeAttribute('open');
  dialog.removeAttribute('aria-modal');
  restoreDialogFocus();
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
  if (kind === 'url') data.set('url', form.elements.scamUrl.value.trim());
  if (kind === 'file') {
    const file = form.elements.scamFile.files?.[0];
    if (file && !allowedFileTypes.has(file.type)) {
      status.textContent = 'JPEG, PNG, WEBP, TXT, HTML, PDF 파일만 확인할 수 있어요.';
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
  status.textContent = '파일을 실행하지 않고 안전하게 확인하는 중입니다.';
  result.hidden = true;
  try {
    const payload = await requestAnalysis(data);
    render(payload);
    status.textContent = payload.riskLevel === 'UNVERIFIED' ? '확인이 더 필요해요. 아래의 확인 안 된 내용을 봐 주세요.' : '분석 결과가 나왔습니다.';
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : '진위확인을 완료하지 못했습니다.';
  } finally {
    submit.disabled = false;
  }
}

function bindScamShield() {
  dialog = document.querySelector('[data-scam-dialog]');
  form = document.querySelector('[data-scam-form]');
  result = document.querySelector('[data-scam-result]');
  status = document.querySelector('[data-scam-status]');
  clicked = document.querySelector('[data-scam-clicked]');
  incident = document.querySelector('[data-scam-incident]');
  if (dialog && dialog.dataset.scamOutsideBound !== 'true') {
    dialog.dataset.scamOutsideBound = 'true';
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeDialog();
    });
    dialog.addEventListener('close', restoreDialogFocus);
  }

  document.querySelectorAll('[data-scam-open]').forEach(button => {
    if (button.dataset.scamBound === 'true') return;
    button.dataset.scamBound = 'true';
    button.addEventListener('click', openDialog);
  });
  dialog?.querySelectorAll('[data-scam-close]').forEach(button => {
    if (button.dataset.scamBound === 'true') return;
    button.dataset.scamBound = 'true';
    button.addEventListener('click', closeDialog);
  });
  form?.querySelectorAll('input[name="scam-input-kind"]').forEach(input => {
    if (input.dataset.scamBound === 'true') return;
    input.dataset.scamBound = 'true';
    input.addEventListener('change', updateInputPanels);
  });
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
