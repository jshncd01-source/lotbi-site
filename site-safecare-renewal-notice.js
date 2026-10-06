import {createBottomSheet, SHEET_PRESENTATION} from './site-bottom-sheet.js?v=aset-7d0fa343a235';

const el = (tag, className = '', text = '') => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

export function openSafeCareRenewalNotice({kind, onConfirm} = {}) {
  const pet = kind === 'pet';
  const content = el('section', 'safecare-renewal-dialog');
  content.dataset.safecareRenewalDialog = pet ? 'pet' : 'person';
  content.append(
    el('span', 'safecare-renewal-icon', '⏱'),
    el('h3', 'safecare-renewal-title', '식별 사진 갱신 안내'),
    el(
      'p',
      'safecare-renewal-lead',
      pet
        ? '반려동물의 최근 모습을 유지하기 위해 식별 사진을 정기적으로 갱신합니다.'
        : '출생 연·월을 기준으로 식별 사진의 갱신 주기를 계산합니다.',
    ),
  );

  const rules = el('ul', 'safecare-renewal-rules');
  if (pet) {
    rules.append(el('li', '', '나이와 관계없이 · 6개월(180일)마다'));
  } else {
    rules.append(
      el('li', '', '만 12세 이하 · 180일마다'),
      el('li', '', '만 13세 이상 · 365일마다'),
    );
  }
  content.append(rules, el('p', 'safecare-renewal-reminder', '만료 30일·7일·1일 전에 알려드립니다.'));

  const error = el('p', 'safecare-renewal-error');
  error.setAttribute('role', 'alert');
  error.hidden = true;
  const confirm = el('button', 'site-button site-button-primary safecare-renewal-confirm', '확인하고 식별 사진 등록');
  confirm.type = 'button';
  confirm.dataset.safecareRenewalConfirm = '';
  content.append(error, confirm);

  const sheet = createBottomSheet({
    label: '식별 사진 갱신 안내',
    content,
    presentation: SHEET_PRESENTATION.SHEET,
    dragToClose: false,
    closeOnBackdrop: false,
    dismissLabel: '취소',
  });
  sheet.element.classList.add('safecare-renewal-sheet');
  confirm.addEventListener('click', async () => {
    if (confirm.disabled) return;
    confirm.disabled = true;
    confirm.textContent = '저장 중…';
    error.hidden = true;
    try {
      await onConfirm?.();
      sheet.close();
    } catch (value) {
      error.textContent = value instanceof Error && value.message ? value.message : '저장하지 못했습니다. 다시 시도해 주세요.';
      error.hidden = false;
      confirm.disabled = false;
      confirm.textContent = '확인하고 식별 사진 등록';
    }
  });
  sheet.open();
  return sheet;
}
