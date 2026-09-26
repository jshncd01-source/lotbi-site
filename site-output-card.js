import {createSafeMessageBody} from './site-message-body.js?v=aset-e8f1efd3a007';

const SWIPE_THRESHOLD = 44;
const EDGE_GUARD = 28;

function actionButton(label, action) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'reusable-output-action';
  button.dataset.outputAction = action;
  button.textContent = label;
  return button;
}

export function createReusableOutputCard(output, {
  copyText,
  shareText,
  editText,
  announce,
} = {}) {
  if (!output || output.type !== 'TEXT' || !Array.isArray(output.variants) || !output.variants.length) return null;

  const variants = output.variants.slice(0, 3);
  let index = 0;
  let touchStartX = null;

  const card = document.createElement('section');
  card.className = 'reusable-output-card';
  card.setAttribute('aria-label', output.title);
  if (variants.length > 1) {
    card.setAttribute('aria-roledescription', 'carousel');
  }

  const heading = document.createElement('div');
  heading.className = 'reusable-output-title';
  heading.textContent = output.title;

  const variantHeader = document.createElement('div');
  variantHeader.className = 'reusable-output-variant-header';
  const label = document.createElement('span');
  label.className = 'reusable-output-variant-label';
  const counter = document.createElement('span');
  counter.className = 'reusable-output-counter';

  const page = document.createElement('div');
  page.className = 'reusable-output-page';

  const indicators = document.createElement('div');
  indicators.className = 'reusable-output-indicators';
  indicators.setAttribute('aria-hidden', 'true');

  const navigation = document.createElement('div');
  navigation.className = 'reusable-output-navigation';
  const previous = actionButton('이전', 'previous');
  const next = actionButton('다음', 'next');

  const feedback = document.createElement('span');
  feedback.className = 'reusable-output-feedback';
  feedback.setAttribute('role', 'status');
  feedback.setAttribute('aria-live', 'polite');
  let feedbackTimer;
  const report = (message, tone = '') => {
    feedback.textContent = message;
    if (tone) feedback.dataset.tone = tone; else delete feedback.dataset.tone;
    if (typeof announce === 'function') announce(message);
    window.clearTimeout(feedbackTimer);
    feedbackTimer = window.setTimeout(() => {
      feedback.textContent = '';
      delete feedback.dataset.tone;
    }, 2400);
  };

  const render = () => {
    const variant = variants[index];
    label.textContent = variant.label;
    counter.textContent = `${index + 1} / ${variants.length}`;
    page.replaceChildren(createSafeMessageBody(variant.text));
    page.setAttribute('aria-label', `${variant.label}, ${index + 1}/${variants.length}`);
    page.setAttribute('aria-roledescription', 'slide');
    indicators.replaceChildren(...variants.map((_, dotIndex) => {
      const dot = document.createElement('span');
      dot.className = 'reusable-output-dot';
      if (dotIndex === index) dot.dataset.current = 'true';
      return dot;
    }));
    previous.disabled = index === 0;
    next.disabled = index === variants.length - 1;
  };

  const select = nextIndex => {
    index = Math.max(0, Math.min(nextIndex, variants.length - 1));
    render();
  };

  previous.addEventListener('click', () => select(index - 1));
  next.addEventListener('click', () => select(index + 1));

  if (variants.length > 1) {
    card.addEventListener('touchstart', event => {
      const point = event.touches?.[0];
      if (!point) return;
      const viewportWidth = globalThis.innerWidth || document.documentElement.clientWidth || 0;
      if (point.clientX <= EDGE_GUARD || (viewportWidth && point.clientX >= viewportWidth - EDGE_GUARD)) {
        touchStartX = null;
        return;
      }
      touchStartX = point.clientX;
    }, {passive: true});
    card.addEventListener('touchend', event => {
      if (!Number.isFinite(touchStartX)) return;
      const point = event.changedTouches?.[0];
      const delta = point ? point.clientX - touchStartX : 0;
      touchStartX = null;
      if (Math.abs(delta) < SWIPE_THRESHOLD) return;
      select(index + (delta < 0 ? 1 : -1));
    }, {passive: true});
  }

  const actions = document.createElement('div');
  actions.className = 'reusable-output-actions';
  actions.setAttribute('role', 'group');
  actions.setAttribute('aria-label', '결과물 작업');

  const copy = actionButton('복사', 'copy');
  copy.addEventListener('click', async () => {
    try {
      await copyText?.(variants[index].text);
      report('복사했어요');
    } catch {
      report('이 브라우저에서는 직접 선택해 복사해 주세요.', 'error');
    }
  });

  const share = actionButton('공유', 'share');
  share.addEventListener('click', async () => {
    try {
      const result = await shareText?.(variants[index].text);
      if (result === 'cancelled') return;
      report(result === 'copied' ? '공유할 내용을 복사했어요' : '공유 앱으로 보냈어요');
    } catch {
      report('공유를 완료하지 못했습니다.', 'error');
    }
  });

  const edit = actionButton('수정', 'edit');
  edit.addEventListener('click', () => {
    editText?.(variants[index].text);
    report('입력창에서 수정할 수 있어요');
  });

  variantHeader.append(label);
  if (variants.length > 1) variantHeader.append(counter);
  navigation.append(previous, indicators, next);
  actions.append(copy, share, edit);

  card.append(heading, variantHeader, page);
  if (variants.length > 1) card.append(navigation);
  card.append(actions, feedback);
  render();
  return card;
}
