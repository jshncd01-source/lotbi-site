// FAMILY-GUARDIAN-DESIGN-UNIFY-01 — the parts 사람 · 반려동물 · 가족 위치 share.
//
// The owner-approved design system (가족 지킴이 디자인 통일 01): one line-icon set
// (24 px box, round 2 px stroke — never emoji), the common confirm dialog that
// replaces the browser's own confirm(), the photo-count tiles of the 식별 사진
// step and the tag on each example/registered photo. Every screen keeps its own
// data and behavior; this module only draws.
import {createBottomSheet, SHEET_PRESENTATION} from './site-bottom-sheet.js?v=aset-e30ee57ac068';

const SVG_NS = 'http://www.w3.org/2000/svg';

// [tag, attributes] per shape.
const ICONS = Object.freeze({
  user: [['path', {d: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2'}], ['circle', {cx: 12, cy: 7, r: 4}]],
  paw: [['circle', {cx: 11, cy: 4, r: 2}], ['circle', {cx: 18, cy: 8, r: 2}], ['circle', {cx: 20, cy: 16, r: 2}], ['path', {d: 'M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z'}]],
  pin: [['path', {d: 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0'}], ['circle', {cx: 12, cy: 10, r: 3}]],
  image: [['rect', {width: 18, height: 18, x: 3, y: 3, rx: 2}], ['circle', {cx: 9, cy: 9, r: 2}], ['path', {d: 'm21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21'}]],
  photos: [['rect', {width: 14, height: 14, x: 8, y: 8, rx: 2}], ['path', {d: 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'}]],
  face: [['circle', {cx: 12, cy: 12, r: 10}], ['path', {d: 'M8 14s1.5 2 4 2 4-2 4-2'}], ['path', {d: 'M9 9h.01'}], ['path', {d: 'M15 9h.01'}]],
  body: [['circle', {cx: 12, cy: 4.5, r: 2.5}], ['path', {d: 'M12 8v7'}], ['path', {d: 'M8 10.5h8'}], ['path', {d: 'm9 22 3-7 3 7'}]],
  lock: [['rect', {width: 18, height: 11, x: 3, y: 11, rx: 2}], ['path', {d: 'M7 11V7a5 5 0 0 1 10 0v4'}]],
  info: [['circle', {cx: 12, cy: 12, r: 10}], ['path', {d: 'M12 16v-4'}], ['path', {d: 'M12 8h.01'}]],
  check: [['path', {d: 'M20 6 9 17l-5-5'}]],
  plus: [['path', {d: 'M5 12h14'}], ['path', {d: 'M12 5v14'}]],
  search: [['circle', {cx: 11, cy: 11, r: 8}], ['path', {d: 'm21 21-4.3-4.3'}]],
  bell: [['path', {d: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9'}], ['path', {d: 'M10.3 21a1.94 1.94 0 0 0 3.4 0'}]],
  alert: [['path', {d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3'}], ['path', {d: 'M12 9v4'}], ['path', {d: 'M12 17h.01'}]],
  shield: [['path', {d: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z'}], ['path', {d: 'm9 12 2 2 4-4'}]],
  phone: [['path', {d: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z'}]],
  camera: [['path', {d: 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z'}], ['circle', {cx: 12, cy: 13, r: 3}]],
  file: [['path', {d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z'}], ['path', {d: 'M14 2v4a2 2 0 0 0 2 2h4'}]],
  clock: [['circle', {cx: 12, cy: 12, r: 10}], ['path', {d: 'M12 6v6l4 2'}]],
  star: [['path', {d: 'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z'}]],
  heart: [['path', {d: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'}]],
  cake: [['path', {d: 'M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8'}], ['path', {d: 'M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1'}], ['path', {d: 'M2 21h20'}], ['path', {d: 'M7 8v3'}], ['path', {d: 'M12 8v3'}], ['path', {d: 'M17 8v3'}]],
  x: [['path', {d: 'M18 6 6 18'}], ['path', {d: 'm6 6 12 12'}]],
  back: [['path', {d: 'm15 18-6-6 6-6'}]],
  chevronRight: [['path', {d: 'm9 18 6-6-6-6'}]],
});

/** A decorative line icon (aria-hidden). */
export function fgIcon(name, className = '') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  // Drawn correctly even where the design-system stylesheet is not loaded (never 300×150).
  for (const [key, value] of Object.entries({width: 20, height: 20, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'})) svg.setAttribute(key, String(value));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', `fg-icon${className ? ` ${className}` : ''}`);
  for (const [tag, attributes] of ICONS[name] || ICONS.info) {
    const shape = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attributes)) shape.setAttribute(key, String(value));
    svg.append(shape);
  }
  return svg;
}

// Kakao's own speech-bubble symbol, drawn in black on the Kakao yellow button.
export function fgKakaoSymbol() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '20'); svg.setAttribute('height', '20'); svg.setAttribute('fill', '#000');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', 'fg-kakao-symbol');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M12 3.2C6.7 3.2 2.4 6.6 2.4 10.8c0 2.7 1.8 5.1 4.5 6.4l-.9 3.4c-.1.3.3.6.6.4l4-2.6c.5.1 1 .1 1.4.1 5.3 0 9.6-3.4 9.6-7.6S17.3 3.2 12 3.2z');
  svg.append(path);
  return svg;
}

const node = (tag, className = '', text = '') => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
};

/** A line of text led by an icon: <p class="fg-icon-line …"><svg/>text</p>. */
export function fgIconLine(tag, className, iconName, text) {
  const line = node(tag, `${className} fg-icon-line`.trim());
  line.append(fgIcon(iconName), document.createTextNode(text));
  return line;
}

/**
 * The photo-count tiles of the 식별 사진 step.
 * items: [{icon, value, total?, suffix?, label, done}] — the photo total is shown as "N장",
 * never "N / 10": ten photos are capacity, not a requirement (SAFECARE-PHOTO-EASY-UPLOAD-01).
 */
export function fgCountTiles(items) {
  const row = node('div', 'fg-counts');
  for (const item of items) {
    const tile = node('div', `fg-count${item.done ? ' is-done' : ''}`);
    const mark = node('span', 'fg-count-icon');
    mark.append(fgIcon(item.icon));
    const copy = node('span', 'fg-count-copy');
    const value = node('b', 'fg-count-value', String(item.value));
    value.append(node('em', '', item.total == null ? (item.suffix || '') : `/${item.total}`));
    copy.append(value, node('span', 'fg-count-label', item.label));
    tile.append(mark, copy);
    row.append(tile);
  }
  return row;
}

/** 예시 (an example photo) or ✓ 등록됨 / ✓ 확인됨 on a photo tile. */
export function fgTileTag(state, label = '') {
  const tag = node('span', `fg-tile-tag fg-tile-tag-${state}`, label || (state === 'filled' ? '✓ 등록됨' : '예시'));
  tag.setAttribute('aria-hidden', 'true');
  return tag;
}

/**
 * The approved common confirm dialog (replaces window.confirm on 가족 지킴이).
 * Resolves true only when the person presses the confirm button.
 */
export function confirmFamilyAction({title, body = '', confirmLabel, cancelLabel = '취소', danger = true, testId = ''} = {}) {
  return new Promise(resolve => {
    let settled = false;
    const finish = value => { if (settled) return; settled = true; resolve(value); };
    const panel = node('section', 'fg-confirm');
    if (testId) panel.dataset.fgConfirm = testId;
    const heading = node('h3', 'fg-confirm-title', title);
    panel.append(heading);
    if (body) panel.append(node('p', 'fg-confirm-body', body));
    const actions = node('div', 'fg-confirm-actions');
    const cancel = node('button', 'site-button site-button-secondary', cancelLabel);
    cancel.type = 'button';
    cancel.dataset.fgConfirmCancel = '';
    const confirm = node('button', `site-button ${danger ? 'fg-danger' : 'person-primary'}`, confirmLabel);
    confirm.type = 'button';
    confirm.dataset.fgConfirmOk = '';
    actions.append(cancel, confirm);
    panel.append(actions);
    const sheet = createBottomSheet({
      label: title, content: panel, presentation: SHEET_PRESENTATION.SHEET, dismissLabel: cancelLabel, dragToClose: false,
      onClose: () => finish(false),
    });
    sheet.element.classList.add('person-cancel-dialog', 'fg-ui', 'fg-dialog');
    sheet.backdrop.classList.add('person-cancel-dialog-backdrop');
    cancel.addEventListener('click', () => sheet.destroy());
    confirm.addEventListener('click', () => { finish(true); sheet.destroy(); });
    sheet.open();
  });
}
