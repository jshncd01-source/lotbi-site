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

// 개와 고양이를 따로 그립니다. 등록할 때 이미 종을 고르므로, 보호자는
// 자기 아이에 해당하는 그림만 보면 됩니다.
//
// 앞선 그림은 몸통에 머리가 아예 없고 뿔처럼 솟은 선만 있어 소로 읽혔고,
// 뒷모습은 둥근 덩어리에 짧은 다리 둘이라 병아리로 읽혔습니다. 이번에는
// 머리·귀·주둥이·꼬리를 실루엣으로 갖추되, 목적은 여전히 "어느 부위를 어떤
// 각도에서 찍는가" 이므로 장식은 넣지 않습니다.
//
// 개: 주둥이가 길고, 귀가 머리 옆으로 처지며, 몸통이 깊습니다.
// 고양이: 얼굴이 짧고, 귀가 머리 위로 서며, 꼬리가 길게 올라갑니다.

const DOG_FACE_FRONT = [
  // 위는 넓고 아래로 좁아지는 머리 + 튀어나온 주둥이
  'M36 13c7 0 11.4 4.2 11.4 10 0 3.6-1.2 6.4-3.2 8.4',
  'M36 13c-7 0-11.4 4.2-11.4 10 0 3.6 1.2 6.4 3.2 8.4',
  'M28.4 31.4c0 3.6 3.4 6 7.6 6s7.6-2.4 7.6-6',
  // 처진 귀
  'M25.2 17c-3.4.6-5.2 3.4-4.8 7 .4 3.4 2.6 5.4 5.4 5.2',
  'M46.8 17c3.4.6 5.2 3.4 4.8 7-.4 3.4-2.6 5.4-5.4 5.2',
  // 주둥이와 코
  'M31 30.6h10',
  'M34.2 28.4h3.6l-1.8 2.2Z',
  'M36 30.6v2.4',
  'M36 33c-1.2 1.3-3 1.1-3.8 0',
  'M36 33c1.2 1.3 3 1.1 3.8 0',
];

const CAT_FACE_FRONT = [
  // 짧고 둥근 얼굴
  'M36 15.5c6.6 0 10.8 4.2 10.8 10S42.6 37 36 37s-10.8-5.7-10.8-11.5 4.2-10 10.8-10Z',
  // 머리 위로 선 삼각 귀
  'M27.6 18.4l-2.8-7.4 7.2 3.4',
  'M44.4 18.4l2.8-7.4-7.2 3.4',
  // 코와 입
  'M34.6 28.2h2.8l-1.4 1.8Z',
  'M36 30v1.8',
  'M36 31.8c-1 1.2-2.6 1-3.4 0',
  'M36 31.8c1 1.2 2.6 1 3.4 0',
  // 수염
  'M29 29.4l-5.4-1.2',
  'M29 31.2l-5 .8',
  'M43 29.4l5.4-1.2',
  'M43 31.2l5 .8',
];

const DOG_FACE_SIDE = [
  // 뒤통수에서 긴 주둥이로 이어지는 옆얼굴
  'M47 25c0 6.6-5.2 12-12 12-4.6 0-8.6-2.6-10.6-6.4l-8.2-1.2c-1.4-.2-1.6-2-.2-2.5l5.6-2c.6-6 5.6-10.6 11.8-10.6 7.4 0 13.6 4.4 13.6 10.7Z',
  // 처진 귀
  'M41 15.6c3.6-.4 6 2 6.2 5.6.2 3.2-1.6 5.4-4 5.6',
  'M17.6 26.4h3.4',
];

const CAT_FACE_SIDE = [
  // 짧은 얼굴, 완만한 콧대
  'M46 25.5c0 6.4-5 11.5-11.5 11.5-5.2 0-9.6-3.4-11-8l-4.6-1.2c-1.1-.3-1.2-1.9 0-2.2l4.4-1.2c1.3-4.7 5.8-8.4 11.2-8.4C41 16 46 19.1 46 25.5Z',
  // 서 있는 귀
  'M39.6 16.8l2.2-6.6 4 5.2',
  'M20 26.4h3.2',
];

const DOG_BODY_SIDE = [
  // 머리 — 몸통과 이어지고 주둥이가 앞으로 나옵니다
  'M20.5 20c0-3.4 2.8-6 6.4-6 3.4 0 6.2 2.4 6.4 5.6',
  'M20.5 20c0 2.2 1.2 4.2 3.2 5.2',
  'M20.5 21.5l-5.2 1c-1 .2-1.1 1.6-.1 1.9l5 1.4',
  'M15.6 24.2h2.6',
  // 처진 귀
  'M28.8 14.6c2.6-.6 4.4 1 4.6 3.6.2 2.2-.9 3.8-2.6 4.2',
  // 몸통
  'M23.7 25.2c1.6 1 3.6 1.4 5.6 1.4h14.2c4.4 0 8 3.4 8 7.6 0 1.4-.4 2.7-1 3.8H26.8c-2.2 0-3.9-1.8-3.9-4v-8.8Z',
  // 네 다리
  'M27.4 38.6v5.6',
  'M33 38.6v5.6',
  'M43.4 38.6v5.6',
  'M48.8 38.6v5.6',
  // 아래로 처졌다 올라가는 꼬리
  'M50.4 34.6c3.4-.6 5.4-3 5-6.2',
];

const CAT_BODY_SIDE = [
  // 작고 둥근 머리
  'M21 20.6c0-3.6 2.9-6.4 6.6-6.4 3.6 0 6.5 2.8 6.5 6.4 0 3.2-2.3 5.8-5.4 6.3',
  'M21 20.6c0 2.4 1.3 4.5 3.3 5.6',
  // 서 있는 귀 두 개
  'M22.6 15.6l-1.2-4.6 4.4 2.2',
  'M32 15.6l1.4-4.6-4.4 2.2',
  // 얇은 몸통
  'M24.3 26.2c1.4.8 3 1.2 4.7 1.2h13.4c4.2 0 7.6 3.2 7.6 7.2 0 1.2-.3 2.4-.8 3.4H27.6c-1.9 0-3.3-1.6-3.3-3.6v-8.2Z',
  // 네 다리
  'M28 38v6',
  'M33.2 38v6',
  'M42.8 38v6',
  'M47.6 38v6',
  // 위로 길게 올라가는 꼬리
  'M49.2 33.4c4.4-1.4 6.4-4.8 5.6-9.4',
];

const DOG_BACK_REAR = [
  // 뒤에서 본 머리 — 양옆으로 처진 귀가 실루엣을 만듭니다
  'M28.6 17.4c0-3.6 3.3-6.4 7.4-6.4s7.4 2.8 7.4 6.4',
  'M28.6 17.4c-3 .2-5 2.4-5 5.4 0 2.8 1.8 4.8 4.4 5.2',
  'M43.4 17.4c3 .2 5 2.4 5 5.4 0 2.8-1.8 4.8-4.4 5.2',
  // 어깨에서 엉덩이로 내려가는 몸통
  'M28 26.5c-3.4 1.6-5.6 4.8-5.6 8.6v3.2c0 3.2 2.6 5.8 5.8 5.8h15.6c3.2 0 5.8-2.6 5.8-5.8v-3.2c0-3.8-2.2-7-5.6-8.6',
  // 아래로 내려온 꼬리
  'M36 43.6v5',
  // 뒷다리 두 개
  'M28.4 43.6v3.4',
  'M26.8 47h3.2',
  'M43.6 43.6v3.4',
  'M42 47h3.2',
];

const CAT_BACK_REAR = [
  // 뒤에서 본 머리 — 위로 선 귀 두 개가 실루엣을 만듭니다
  'M27.8 19.2c0-4 3.7-7.2 8.2-7.2s8.2 3.2 8.2 7.2',
  'M28.4 16.2l-2.2-6 5.6 2.6',
  'M43.6 16.2l2.2-6-5.6 2.6',
  'M27.8 19.2c0 2.6 1.6 4.8 4 6',
  'M44.2 19.2c0 2.6-1.6 4.8-4 6',
  // 좁은 어깨에서 넓어지는 몸통
  'M31.8 25.2c-3.4 1.8-5.4 5-5.4 8.8v3.4c0 3 2.4 5.4 5.4 5.4h8.4c3 0 5.4-2.4 5.4-5.4v-3.4c0-3.8-2-7-5.4-8.8',
  // 위로 세운 꼬리
  'M36 42v6',
  'M31.4 42v3.2',
  'M29.9 45.2h3',
  'M40.6 42v3.2',
  'M39.1 45.2h3',
];

// 특징 부위는 무늬·흉터를 가까이 찍는 것이라 종과 무관합니다.
const DISTINCTIVE_PATHS = [
  'M22 22c5-4 13-4 17 0 3.5 3.5 2 9-3 11.5-5.5 2.8-12 1.6-15-2-2.2-2.7-1.6-7 1-9.5Z',
  'M52 37l5.5 5.5',
];

// slot code -> {label, hint, draw}
// draw: {paths, circles, mirror} — mirror renders the same geometry flipped,
// which keeps the left/right pairs exactly symmetric.
const GUIDES = Object.freeze({
  NOSE_FRONT: {
    label: '코 주변 정면',
    hint: '코를 정면에서. 코주름이 화면에 가득 차게 가까이.',
    draw: {
      paths: [...NOSE_HEAD_PATHS, ...NOSE_CALLOUT_PATHS, ...NOSE_ZOOM_PATHS],
      circles: [[21, 23.2, 1, 1], [29, 23.2, 1, 1], [54, 27.5, 12, 12]],
    },
  },
  NOSE_LEFT: {
    label: '코 주변 왼쪽',
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
    label: '코 주변 오른쪽',
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
    draw: {
      DOG: {paths: DOG_FACE_FRONT, circles: [[31.4, 24, 1.2, 1.2], [40.6, 24, 1.2, 1.2]]},
      CAT: {paths: CAT_FACE_FRONT, circles: [[31.6, 24.4, 1.3, 1.3], [40.4, 24.4, 1.3, 1.3]]},
    },
  },
  FACE_LEFT: {
    label: '얼굴 왼쪽',
    hint: '왼쪽 옆얼굴. 귀와 주둥이 선이 보이게.',
    draw: {
      DOG: {paths: DOG_FACE_SIDE, circles: [[38.6, 23, 1.2, 1.2], [16.4, 24.2, 1.3, 1.3]]},
      CAT: {paths: CAT_FACE_SIDE, circles: [[37.6, 23.2, 1.2, 1.2], [19.2, 25.4, 1.3, 1.3]]},
    },
  },
  FACE_RIGHT: {
    label: '얼굴 오른쪽',
    hint: '오른쪽 옆얼굴. 귀와 주둥이 선이 보이게.',
    draw: {
      DOG: {paths: DOG_FACE_SIDE, circles: [[38.6, 23, 1.2, 1.2], [16.4, 24.2, 1.3, 1.3]]},
      CAT: {paths: CAT_FACE_SIDE, circles: [[37.6, 23.2, 1.2, 1.2], [19.2, 25.4, 1.3, 1.3]]},
      mirror: true,
    },
  },
  BODY_LEFT: {
    label: '몸 왼쪽',
    hint: '왼쪽 옆에서 네 다리와 꼬리까지 한 장에.',
    draw: {
      DOG: {paths: DOG_BODY_SIDE, circles: [[24.6, 19.4, 1.1, 1.1]]},
      CAT: {paths: CAT_BODY_SIDE, circles: [[25, 19.8, 1.1, 1.1]]},
    },
  },
  BODY_RIGHT: {
    label: '몸 오른쪽',
    hint: '오른쪽 옆에서 네 다리와 꼬리까지 한 장에.',
    draw: {
      DOG: {paths: DOG_BODY_SIDE, circles: [[24.6, 19.4, 1.1, 1.1]]},
      CAT: {paths: CAT_BODY_SIDE, circles: [[25, 19.8, 1.1, 1.1]]},
      mirror: true,
    },
  },
  BACK_REAR: {
    label: '뒷모습',
    hint: '바로 뒤에서. 등과 뒷다리가 보이게.',
    draw: {
      DOG: {paths: DOG_BACK_REAR},
      CAT: {paths: CAT_BACK_REAR},
    },
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
//
// The owner already chose DOG or CAT when registering, so the slots that read
// differently between the two ship a drawing per species: an unfamiliar animal
// makes the picture harder to follow, not easier. Slots that look the same
// either way keep a single drawing.
export function petPhotoSlotDiagram(slotCode, species = 'DOG') {
  const guide = GUIDES[slotCode];
  if (!guide) return null;
  const key = species === 'CAT' ? 'CAT' : 'DOG';
  const perSpecies = guide.draw[key];
  const {
    paths = [], circles = [], turned = [], turnedCircles = [], zoomed = [], mirror = false,
  } = perSpecies ? {...perSpecies, mirror: guide.draw.mirror ?? perSpecies.mirror} : guide.draw;

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
