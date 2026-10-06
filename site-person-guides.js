// SAFECARE-WEB-UI-REDESIGN-01 — the person identity photo guide.
//
// Slot order and meaning are Core's PERSON_IDENTITY_SLOT_CODES (slot_index =
// position + 1). Each slot gets a line-art silhouette of the direction to
// shoot, the same way the pet screen draws its slot schematics, so a guardian
// can see at a glance why ten different directions are asked for.

import {createSafeCareGuideArtwork} from './site-safecare-guide-art.js?v=aset-08e14429cf08';

const SVG_NS = 'http://www.w3.org/2000/svg';

export const PERSON_IDENTITY_SLOTS = Object.freeze([
  Object.freeze({code: 'FACE_FRONT', label: '정면 얼굴', hint: '두 눈과 코, 입이 모두 보이게 정면에서 찍어 주세요.', view: 'front'}),
  Object.freeze({code: 'FACE_LEFT_45', label: '왼쪽 45도', hint: '고개를 왼쪽으로 반쯤 돌린 얼굴입니다.', view: 'turn', direction: 'left'}),
  Object.freeze({code: 'FACE_RIGHT_45', label: '오른쪽 45도', hint: '고개를 오른쪽으로 반쯤 돌린 얼굴입니다.', view: 'turn', direction: 'right'}),
  Object.freeze({code: 'FACE_LEFT_PROFILE', label: '왼쪽 옆면', hint: '왼쪽 옆얼굴이 보이게, 귀와 턱선까지 담아 주세요.', view: 'profile', direction: 'left'}),
  Object.freeze({code: 'FACE_RIGHT_PROFILE', label: '오른쪽 옆면', hint: '오른쪽 옆얼굴이 보이게, 귀와 턱선까지 담아 주세요.', view: 'profile', direction: 'right'}),
  Object.freeze({code: 'UPPER_BODY_FRONT', label: '정면 상반신', hint: '머리부터 허리까지 정면에서 찍어 주세요.', view: 'upper'}),
  Object.freeze({code: 'FULL_BODY_FRONT', label: '정면 전신', hint: '머리부터 발끝까지 한 장에 담아 주세요.', view: 'full'}),
  Object.freeze({code: 'FACE_FRONT_ALT', label: '추가 정면', hint: '다른 날, 다른 장소에서 찍은 정면 얼굴이면 더 좋습니다.', view: 'front', extra: true}),
  Object.freeze({code: 'FACE_LEFT_ALT', label: '추가 왼쪽', hint: '왼쪽을 바라본 다른 사진입니다.', view: 'turn', direction: 'left', extra: true}),
  Object.freeze({code: 'FACE_RIGHT_ALT', label: '추가 오른쪽', hint: '오른쪽을 바라본 다른 사진입니다.', view: 'turn', direction: 'right', extra: true}),
]);

function shape(tag, attributes) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  return node;
}

function text(value, x, y, className) {
  const node = shape('text', {x, y, class: className, 'text-anchor': 'middle'});
  node.textContent = value;
  return node;
}

function drawFace(root, {view, direction}) {
  const shoulders = shape('path', {d: 'M16 51C18 40 26 36 36 36S54 40 56 51H16Z', class: 'person-guide-body'});
  root.appendChild(shoulders);
  if (view === 'profile') {
    // A side head: back of the skull, brow, nose and chin facing one way.
    const head = shape('path', {d: 'M30 32C24 31 22 25 23 19C24 12 30 9 36 9C42 9 47 13 47 19L50 24L47 25C47 29 44 32 40 32Z'});
    head.setAttribute('class', 'person-guide-head');
    root.appendChild(head);
    root.appendChild(shape('circle', {cx: 42, cy: 18, r: 1.3, class: 'person-guide-feature'}));
    root.appendChild(shape('path', {d: 'M31 17C29 18 29 22 31 23'}));
    if (direction === 'right') {
      root.setAttribute('data-person-guide-mirror', 'true');
      root.querySelectorAll('path, circle').forEach(node => node.setAttribute('transform', 'translate(72,0) scale(-1,1)'));
    }
    return;
  }
  root.appendChild(shape('ellipse', {cx: 36, cy: 21, rx: 11, ry: 12.5, class: 'person-guide-head'}));
  const shift = view === 'turn' ? (direction === 'left' ? -4 : 4) : 0;
  root.appendChild(shape('circle', {cx: 31.5 + shift, cy: 19, r: 1.3, class: 'person-guide-feature'}));
  root.appendChild(shape('circle', {cx: 40.5 + shift * (view === 'turn' ? 0.6 : 1), cy: 19, r: 1.3, class: 'person-guide-feature'}));
  root.appendChild(shape('path', {d: `M${36 + shift} 21v4h${shift < 0 ? -2 : 2}`}));
  root.appendChild(shape('path', {d: `M${33 + shift} 28.5h6`, class: 'person-guide-mouth'}));
}

function drawUpper(root) {
  root.appendChild(shape('circle', {cx: 36, cy: 12, r: 7, class: 'person-guide-head'}));
  root.appendChild(shape('path', {d: 'M22 51V33C22 25 28 21 36 21S50 25 50 33V51H22Z', class: 'person-guide-body'}));
  root.appendChild(shape('path', {d: 'M28 51V38M44 51V38'}));
}

function drawFull(root) {
  root.appendChild(shape('circle', {cx: 36, cy: 7.5, r: 4.5, class: 'person-guide-head'}));
  root.appendChild(shape('path', {d: 'M30 14H42L44 31H28Z', class: 'person-guide-body'}));
  root.appendChild(shape('path', {d: 'M30 15L25 29M42 15L47 29'}));
  root.appendChild(shape('path', {d: 'M32 31L31 49M40 31L41 49'}));
}

export function personSlotDiagram(slot) {
  const root = shape('svg', {viewBox: '0 0 72 52', class: 'person-guide-diagram', 'aria-hidden': 'true', focusable: 'false'});
  root.appendChild(shape('rect', {x: 14, y: 2, width: 44, height: 48, rx: 18, class: 'person-guide-stage'}));
  if (slot.view === 'upper') drawUpper(root);
  else if (slot.view === 'full') drawFull(root);
  else drawFace(root, slot);
  if (slot.direction === 'left') root.appendChild(text('←', 9, 30, 'person-guide-arrow'));
  if (slot.direction === 'right') root.appendChild(text('→', 63, 30, 'person-guide-arrow'));
  if (slot.extra) root.appendChild(text('+', 63, 12, 'person-guide-arrow'));
  return root;
}

// The always-visible guide above the ten slots: why ten directions, and the
// direction map itself at a size that can actually be read.
export function personPhotoGuide() {
  const box = document.createElement('section');
  box.className = 'safecare-guide';
  box.dataset.safecareGuide = 'person';
  const head = document.createElement('div');
  head.className = 'safecare-guide-head';
  const figure = document.createElement('div');
  figure.className = 'safecare-guide-figure safecare-guide-figure-person';
  figure.appendChild(createSafeCareGuideArtwork('person'));
  const copy = document.createElement('div');
  const title = document.createElement('h4');
  title.className = 'safecare-guide-title';
  title.textContent = '사람 촬영 안내 · 서로 다른 방향 10장';
  const body = document.createElement('p');
  body.className = 'safecare-guide-copy';
  body.textContent = '실종 시 들어오는 발견 사진은 정면이 아닐 때가 많습니다. 여러 방향의 사진이 있어야 후보를 놓치지 않습니다. 정면 얼굴부터 시작해 아래 순서대로 등록해 주세요.';
  copy.append(title, body);
  head.append(figure, copy);
  const map = document.createElement('ol');
  map.className = 'safecare-guide-map';
  for (const slot of PERSON_IDENTITY_SLOTS) {
    const item = document.createElement('li');
    item.className = 'safecare-guide-step';
    const label = document.createElement('span');
    label.textContent = slot.label;
    item.append(personSlotDiagram(slot), label);
    map.appendChild(item);
  }
  box.append(head, map);
  return box;
}
