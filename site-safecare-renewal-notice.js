import {createBottomSheet, SHEET_PRESENTATION} from './site-bottom-sheet.js?v=aset-e0798be76ab8';

const el = (tag, className = '', text = '') => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

export function requiresGuardianConsent({relationship, birthYear, birthMonth} = {}, now = new Date()) {
  const year = Number(birthYear);
  const month = Number(birthMonth);
  if (relationship !== 'CHILD' || !Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return false;
  const age = now.getUTCFullYear() - year - (now.getUTCMonth() + 1 < month ? 1 : 0);
  return age < 14;
}

export function openSafeCareRenewalNotice({kind, relationship, birthYear, birthMonth, onConfirm} = {}) {
  const pet = kind === 'pet';
  const guardianRequired = !pet && requiresGuardianConsent({relationship, birthYear, birthMonth});
  const content = el('section', 'safecare-renewal-dialog');
  content.dataset.safecareRenewalDialog = pet ? 'pet' : 'person';
  content.append(
    el('span', 'safecare-renewal-icon', '⏱'),
    el('h3', 'safecare-renewal-title', pet ? '식별 사진 갱신 안내' : '식별 사진 등록 안내'),
    el(
      'p',
      'safecare-renewal-lead',
      pet
        ? '반려동물의 최근 모습을 유지하기 위해 식별 사진을 정기적으로 갱신합니다.'
        : '등록 전에 아래 내용을 하나씩 확인하고 필수 항목에 동의해 주세요.',
    ),
  );

  if (pet) {
    const rules = el('ul', 'safecare-renewal-rules');
    rules.append(el('li', '', '나이와 관계없이 · 6개월(180일)마다'));
    const privacy = el('label', 'safecare-consent-row');
    const privacyCheckbox = el('input');
    privacyCheckbox.type = 'checkbox';
    privacyCheckbox.dataset.safecareConsent = 'privacy';
    privacy.append(privacyCheckbox, el('span', '', '🔒 사진은 비공개로 안전하게 보관되며, 분실·발견 시 후보 비교를 위해 사용됩니다. (필수)'));
    content.append(rules, el('p', 'safecare-renewal-reminder', '만료 30일·7일·1일 전에 알려드립니다.'), privacy);
  } else {
    const sections = el('div', 'safecare-notice-sections');
    const details = [];
    const addSection = ({key, title, summary, body, consents = []}) => {
      const section = el('section', 'safecare-notice-section');
      section.dataset.safecareNoticeSection = key;
      const header = el('div', 'safecare-notice-section-header');
      const heading = el('div', 'safecare-notice-section-copy');
      heading.append(el('strong', '', title), el('span', '', summary));
      const toggle = el('button', 'site-button site-button-secondary safecare-notice-toggle', '상세보기');
      toggle.type = 'button';
      toggle.dataset.safecareNoticeToggle = key;
      toggle.setAttribute('aria-expanded', 'false');
      const detail = el('div', 'safecare-notice-detail');
      detail.dataset.safecareNoticeDetail = key;
      detail.hidden = true;
      body(detail);
      consents.forEach(({key: consentKey, label}) => {
        const consent = el('label', 'safecare-consent-row');
        const checkbox = el('input');
        checkbox.type = 'checkbox';
        checkbox.dataset.safecareConsent = consentKey;
        consent.append(checkbox, el('span', '', label));
        detail.append(consent);
      });
      toggle.addEventListener('click', () => {
        const opening = detail.hidden;
        details.forEach(item => {
          item.detail.hidden = true;
          item.toggle.textContent = '상세보기';
          item.toggle.setAttribute('aria-expanded', 'false');
        });
        if (opening) {
          detail.hidden = false;
          toggle.textContent = '접기';
          toggle.setAttribute('aria-expanded', 'true');
        }
      });
      details.push({detail, toggle});
      header.append(heading, toggle);
      section.append(header, detail);
      sections.append(section);
    };

    addSection({
      key: 'renewal',
      title: '식별 사진 갱신 안내',
      summary: '연령별 갱신 주기와 사전 알림',
      body: detail => {
        detail.append(el('p', 'safecare-renewal-lead', '출생 연·월을 기준으로 식별 사진의 갱신 주기를 계산합니다.'));
        const rules = el('ul', 'safecare-renewal-rules');
        rules.append(
          el('li', '', '만 12세 이하 · 180일마다'),
          el('li', '', '만 13세 이상 · 365일마다'),
        );
        detail.append(rules, el('p', 'safecare-renewal-reminder', '만료 30일·7일·1일 전에 알려드립니다.'));
      },
    });
    addSection({
      key: 'usage',
      title: '식별 사진 등록 및 이용 동의',
      summary: '보관·이용 범위와 삭제 기준',
      body: detail => detail.append(el(
        'p',
        'safecare-consent-copy',
        '얼굴·신체 식별 사진은 안심케어 등록 및 실종 시 후보 검색을 위해 비공개로 암호화하여 보관합니다. 평상시에는 공개 검색이나 자동 동일인 판정에 사용하지 않으며, 사용자가 실종 SOS를 활성화하고 별도로 동의한 기간에만 후보 검색 및 관리자 검토에 사용합니다. 등록을 삭제하면 관련 식별 사진과 생성된 식별정보도 삭제됩니다.',
      )),
      consents: [
        {key: 'usage', label: '위 내용에 동의합니다 (필수)'},
        {key: 'privacy', label: '🔒 사진은 비공개로 안전하게 보관되며, 분실·발견 시 후보 비교를 위해 사용됩니다. (필수)'},
      ],
    });
    if (guardianRequired) {
      addSection({
        key: 'guardian',
        title: '법정대리인 확인',
        summary: '만 14세 미만 자녀 등록 시 필수',
        body: detail => detail.append(el('p', 'safecare-consent-copy', '해당 아동의 법정대리인만 안심케어 등록과 식별 사진 처리에 동의할 수 있습니다.')),
        consents: [{key: 'guardian', label: '법정대리인임을 확인하고 동의합니다 (필수)'}],
      });
    }
    content.append(sections);
  }

  const error = el('p', 'safecare-renewal-error');
  error.setAttribute('role', 'alert');
  error.hidden = true;
  const confirmText = pet ? '확인하고 식별 사진 등록' : '동의하고 식별 사진 등록';
  const confirm = el('button', 'site-button site-button-primary safecare-renewal-confirm', confirmText);
  confirm.type = 'button';
  confirm.dataset.safecareRenewalConfirm = '';
  const required = [...content.querySelectorAll('[data-safecare-consent]')];
  const syncConsent = () => { confirm.disabled = required.some(input => !input.checked); };
  required.forEach(input => input.addEventListener('change', syncConsent));
  syncConsent();
  content.append(error, confirm);

  const sheet = createBottomSheet({
    label: pet ? '식별 사진 갱신 안내' : '식별 사진 등록 안내',
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
      confirm.textContent = confirmText;
    }
  });
  sheet.open();
  return sheet;
}
