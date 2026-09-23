// SITE-PET-FAMILY-WEB-01 — per-slot shooting guidance for the 10 photo slots.
//
// Ordinary owners have never photographed the area around a pet's nose, so
// every slot ships a schematic of the view the camera should see, plus a
// one-line hint. Drawn in the same language as the nav icons: 24-style
// stroke-only geometry, no fills, rounded caps and joins.
const SVG_NS = 'http://www.w3.org/2000/svg';

// Corner brackets marking "fill the frame with this".
const FRAME = ['M6 14V8h6', 'M66 14V8h-6', 'M6 38v6h6', 'M66 38v6h-6'];

// A nose drawn on its own reads as a face: an oval with two marks and a line.
// So each nose-area tile shows the head with a magnified callout on the nose,
// which says which part to shoot, and fills that callout with surface detail,
// which says how close to get.
const NOSE_HEAD_PATHS = [
  'M25 15c6.2 0 9.8 4.2 9.8 9.6S31.2 34.6 25 34.6s-9.8-4.6-9.8-10S18.8 15 25 15Z',
  'M17.6 17.2l-3.6-5 5.6 1.2',
  'M32.4 17.2l3.6-5-5.6 1.2',
  'M22.8 27.6h4.4l-2.2 2.4Z',
];

const NOSE_CALLOUT_PATHS = [
  'M27.4 28.2 42.6 21.6',
  'M27.4 30.4 42.6 34.8',
];

// Inside the magnifier: the nose as the camera should frame it.
const NOSE_ZOOM_PATHS = [
  'M54 20.8c4.6 0 8.4 1.7 8.4 4.3 0 2.9-3.8 5.5-8.4 5.5s-8.4-2.6-8.4-5.5c0-2.6 3.8-4.3 8.4-4.3Z',
  'M50.6 24.6c.9-.3 1.5.3 1.3 1.2-.2.9-1 1.6-1.8 1.5-.7-.1-.9-.8-.6-1.5.2-.5.6-1 1.1-1.2Z',
  'M57.4 24.6c-.9-.3-1.5.3-1.3 1.2.2.9 1 1.6 1.8 1.5.7-.1.9-.8.6-1.5-.2-.5-.6-1-1.1-1.2Z',
  'M54 30.6v3.6',
  'M49.8 22.6l1.6-.4',
  'M53.2 21.9h1.6',
  'M57 22.3l1.6.5',
  'M48.4 27.4l1.4-.3',
  'M58.2 27.1l1.4.3',
];

// Camera moved off to one side: the far half foreshortens. The squeeze is a
// transform so the left and right variants stay exact mirrors.
const NOSE_TURN = 'translate(25,0) scale(0.74,1) translate(-25,0)';
const NOSE_ZOOM_TURN = 'translate(54,0) scale(0.74,1) translate(-54,0)';
const NOSE_ARROW = [
  'M6 38l6-6.5',
  'M12 31.5l-3.4.4',
  'M12 31.5l.4 3.3',
];

const FACE_FRONT_PATHS = [
  'M36 14c7.5 0 12 5 12 11.5S43.5 38 36 38s-12-6-12-12.5S28.5 14 36 14Z',
  'M26.5 16.5l-4.5-6 7 1.5',
  'M45.5 16.5l4.5-6-7 1.5',
  'M34.4 29.5h3.2l-1.6 2Z',
  'M36 31.5v1.6',
  'M36 33.1c-1.2 1.4-3 1.2-3.8 0',
  'M36 33.1c1.2 1.4 3 1.2 3.8 0',
];

const FACE_SIDE_PATHS = [
  'M48 25.5c0 6.4-5 11.5-11.5 11.5-5.2 0-9.6-3.4-11-8l-5.5-1.6c-1-.3-1-1.7 0-2l5.4-1.6c1.3-4.7 5.8-8.2 11.1-8.2 6.5 0 11.5 5.1 11.5 11.5Z',
  'M42 16l3-6 3.5 5.5',
];

const BODY_SIDE_PATHS = [
  'M11.5 23.5h-3.5',
  'M17 16.5l1.5-4 3 3.2',
  'M22 21h21c4.4 0 8 3.6 8 8s-3.6 8-8 8H22z',
  'M26 37v6',
  'M32 37v6',
  'M42 37v6',
  'M48 37v6',
  'M51 24c4-2 6 1 5 4',
];

const BACK_REAR_PATHS = [
  'M21 26.5c0-6.4 6.7-11.5 15-11.5s15 5.1 15 11.5v6c0 4-3.3 7.2-7.3 7.2H28.3c-4 0-7.3-3.2-7.3-7.2v-6Z',
  'M36 15.2c.4-4 2.6-6.8 6-8.2',
  'M28.5 24c-1.6 2.6-2 6-1.2 9.2',
  'M43.5 24c1.6 2.6 2 6 1.2 9.2',
  'M28 39.7v5',
  'M26.3 44.9h3.4',
  'M44 39.7v5',
  'M42.3 44.9h3.4',
  'M31 15.8c1.4-1.8 3-2.7 5-2.7s3.6.9 5 2.7',
];

const DISTINCTIVE_PATHS = [
  'M22 22c5-4 13-4 17 0 3.5 3.5 2 9-3 11.5-5.5 2.8-12 1.6-15-2-2.2-2.7-1.6-7 1-9.5Z',
  'M52 37l5.5 5.5',
];

// slot code -> {label, hint, draw}
// draw: {paths, circles, mirror} — mirror renders the same geometry flipped,
// which keeps the left/right pairs exactly symmetric.
const GUIDES = Object.freeze({
  NOSE_FRONT: {
    label: '코 정면',
    hint: '코를 정면에서. 코주름이 화면에 가득 차게 가까이.',
    draw: {
      paths: [...NOSE_HEAD_PATHS, ...NOSE_CALLOUT_PATHS, ...NOSE_ZOOM_PATHS],
      circles: [[21, 23.2, 1, 1], [29, 23.2, 1, 1], [54, 27.5, 12, 12]],
    },
  },
  NOSE_LEFT: {
    label: '코 왼쪽',
    hint: '코의 왼쪽 면이 보이도록 비스듬히.',
    draw: {
      paths: [...NOSE_CALLOUT_PATHS, ...NOSE_ARROW],
      circles: [[54, 27.5, 12, 12]],
      turned: NOSE_HEAD_PATHS,
      turnedCircles: [[21, 23.2, 1, 1], [29, 23.2, 1, 1]],
      zoomed: NOSE_ZOOM_PATHS,
    },
  },
  NOSE_RIGHT: {
    label: '코 오른쪽',
    hint: '코의 오른쪽 면이 보이도록 비스듬히.',
    draw: {
      paths: [...NOSE_CALLOUT_PATHS, ...NOSE_ARROW],
      circles: [[54, 27.5, 12, 12]],
      turned: NOSE_HEAD_PATHS,
      turnedCircles: [[21, 23.2, 1, 1], [29, 23.2, 1, 1]],
      zoomed: NOSE_ZOOM_PATHS,
      mirror: true,
    },
  },
  FACE_FRONT: {
    label: '얼굴 정면',
    hint: '두 눈과 코가 모두 보이게 정면에서.',
    draw: {paths: FACE_FRONT_PATHS, circles: [[31, 24.5, 1.2, 1.2], [41, 24.5, 1.2, 1.2]]},
  },
  FACE_LEFT: {
    label: '얼굴 왼쪽',
    hint: '왼쪽 옆얼굴. 귀와 주둥이 선이 보이게.',
    draw: {paths: FACE_SIDE_PATHS, circles: [[38, 23, 1.2, 1.2], [21.5, 25.5, 1.4, 1.4]]},
  },
  FACE_RIGHT: {
    label: '얼굴 오른쪽',
    hint: '오른쪽 옆얼굴. 귀와 주둥이 선이 보이게.',
    draw: {paths: FACE_SIDE_PATHS, circles: [[38, 23, 1.2, 1.2], [21.5, 25.5, 1.4, 1.4]], mirror: true},
  },
  BODY_LEFT: {
    label: '몸 왼쪽',
    hint: '왼쪽 옆에서 네 다리와 꼬리까지 한 장에.',
    draw: {paths: BODY_SIDE_PATHS, circles: [[17, 22, 5.5, 5.5]]},
  },
  BODY_RIGHT: {
    label: '몸 오른쪽',
    hint: '오른쪽 옆에서 네 다리와 꼬리까지 한 장에.',
    draw: {paths: BODY_SIDE_PATHS, circles: [[17, 22, 5.5, 5.5]], mirror: true},
  },
  BACK_REAR: {
    label: '뒷모습',
    hint: '바로 뒤에서. 등과 뒷다리가 보이게.',
    draw: {paths: BACK_REAR_PATHS},
  },
  DISTINCTIVE: {
    label: '특징 부위',
    hint: '무늬·흉터처럼 이 아이만의 부분을 가까이.',
    draw: {paths: DISTINCTIVE_PATHS, circles: [[29, 25, 1.6, 1.6], [34, 30, 1.6, 1.6], [47, 32, 7, 7]]},
  },
});

export const PET_PHOTO_SLOT_LABELS = Object.freeze(
  Object.fromEntries(Object.entries(GUIDES).map(([code, guide]) => [code, guide.label])),
);

export function petPhotoSlotLabel(slotCode) {
  return GUIDES[slotCode]?.label || slotCode;
}

export function petPhotoSlotHint(slotCode) {
  return GUIDES[slotCode]?.hint || '';
}

function shape(tag, attributes) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  return node;
}

// Returns the schematic for a slot, or null when the code is unknown.
export function petPhotoSlotDiagram(slotCode) {
  const guide = GUIDES[slotCode];
  if (!guide) return null;
  const {
    paths = [], circles = [], turned = [], turnedCircles = [], zoomed = [], mirror = false,
  } = guide.draw;

  const root = shape('svg', {
    viewBox: '0 0 72 52',
    class: 'pet-slot-diagram',
    'aria-hidden': 'true',
    focusable: 'false',
  });
  const group = shape('g', mirror ? {transform: 'translate(72,0) scale(-1,1)'} : {});
  for (const d of paths) group.appendChild(shape('path', {d}));
  if (turned.length) {
    const away = shape('g', {transform: NOSE_TURN});
    for (const d of turned) away.appendChild(shape('path', {d}));
    for (const [cx, cy, rx] of turnedCircles) away.appendChild(shape('circle', {cx, cy, r: rx}));
    group.appendChild(away);
  }
  if (zoomed.length) {
    const closer = shape('g', {transform: NOSE_ZOOM_TURN});
    for (const d of zoomed) closer.appendChild(shape('path', {d}));
    group.appendChild(closer);
  }
  for (const [cx, cy, rx, ry] of circles) {
    group.appendChild(rx === ry
      ? shape('circle', {cx, cy, r: rx})
      : shape('ellipse', {cx, cy, rx, ry}));
  }
  root.appendChild(group);
  return root;
}
