// SAFECARE-WEB-UI-REDESIGN-01 — the person identity photo guide.
//
// Slot order and meaning are Core's PERSON_IDENTITY_SLOT_CODES (slot_index =
// position + 1). Each empty card carries its own finished shooting example so
// the guardian does not need to compare it with a separate explanation box.

const APPROVED_BEFORE_SHEET = 'assets/family-guardian/approved-person-examples-before-20261013.png';
const APPROVED_TEN_SHEET = 'assets/family-guardian/approved-person-examples-ten-20261013.png';

const approvedExample = (sheet, sheetWidth, sheetHeight, viewBox) => Object.freeze({
  sheet,
  sheetWidth,
  sheetHeight,
  viewBox,
});

// 사용자 확정 시안 01·02의 가상 인물 사진을 원본 픽셀 그대로 보여 준다.
// 별도 생성 이미지나 일러스트로 바꾸지 않는다. 등록 사진이 생기면
// site-person-ui가 이 예시를 실제 사용자 사진으로 교체한다.
export const PERSON_APPROVED_EXAMPLE_CROPS = Object.freeze({
  FACE_FRONT: approvedExample(APPROVED_BEFORE_SHEET, 1485, 1059, '350 471 194 197'),
  FACE_LEFT_45: approvedExample(APPROVED_BEFORE_SHEET, 1485, 1059, '558 471 195 197'),
  FACE_RIGHT_45: approvedExample(APPROVED_BEFORE_SHEET, 1485, 1059, '768 471 190 197'),
  UPPER_BODY_FRONT: approvedExample(APPROVED_BEFORE_SHEET, 1485, 1059, '972 471 203 197'),
  FULL_BODY_FRONT: approvedExample(APPROVED_BEFORE_SHEET, 1485, 1059, '1190 471 204 197'),
  FACE_LEFT_PROFILE: approvedExample(APPROVED_TEN_SHEET, 1484, 1060, '342 596 192 165'),
  FACE_RIGHT_PROFILE: approvedExample(APPROVED_TEN_SHEET, 1484, 1060, '552 596 195 165'),
  FACE_FRONT_ALT: approvedExample(APPROVED_TEN_SHEET, 1484, 1060, '763 596 193 165'),
  FACE_LEFT_ALT: approvedExample(APPROVED_TEN_SHEET, 1484, 1060, '969 596 205 165'),
  FACE_RIGHT_ALT: approvedExample(APPROVED_TEN_SHEET, 1484, 1060, '1190 596 210 165'),
});

export const PERSON_IDENTITY_SLOTS = Object.freeze([
  Object.freeze({code: 'FACE_FRONT', label: '정면 얼굴', hint: '두 눈과 코, 입이 모두 보이게 정면에서 찍어 주세요.', visible: '두 눈 · 코 · 입 · 양쪽 귀 윤곽 · 이마부터 턱까지', view: 'front', example: PERSON_APPROVED_EXAMPLE_CROPS.FACE_FRONT}),
  // SAFECARE-PHOTO-UPLOAD-FIX-03: "왼쪽/오른쪽" is where the face looks in the
  // photo (화면 기준), and a 45-degree photo still shows both eyes, the nose and
  // the mouth; a guardian could not tell that from "고개를 반쯤 돌린 얼굴".
  // `visible` lists what must show in the photo ("보여야 하는 부분").
  Object.freeze({code: 'FACE_LEFT_45', label: '왼쪽 45도', hint: '카메라는 정면에 두고, 사진 속 얼굴이 화면 왼쪽을 바라보도록 고개를 반쯤만 돌려 주세요. 두 눈·코·입이 모두 보여야 합니다.', visible: '두 눈(먼 쪽 눈은 작게) · 코 · 입 · 가까운 쪽 귀', view: 'turn', direction: 'left', example: PERSON_APPROVED_EXAMPLE_CROPS.FACE_LEFT_45}),
  Object.freeze({code: 'FACE_RIGHT_45', label: '오른쪽 45도', hint: '카메라는 정면에 두고, 사진 속 얼굴이 화면 오른쪽을 바라보도록 고개를 반쯤만 돌려 주세요. 두 눈·코·입이 모두 보여야 합니다.', visible: '두 눈(먼 쪽 눈은 작게) · 코 · 입 · 가까운 쪽 귀', view: 'turn', direction: 'right', example: PERSON_APPROVED_EXAMPLE_CROPS.FACE_RIGHT_45}),
  Object.freeze({code: 'FACE_LEFT_PROFILE', label: '왼쪽 옆면', hint: '사진 속 얼굴이 화면 왼쪽을 바라보도록 고개를 옆으로 크게 돌려 주세요. 정확히 90도가 아니어도 됩니다. 눈은 한쪽만, 코끝·입 옆선과 턱선이 보이면 됩니다.', visible: '한쪽 눈 · 코끝과 입 옆선 · 귀나 귀 주변(머리카락에 조금 가려져도 됨) · 턱선', view: 'profile', direction: 'left', example: PERSON_APPROVED_EXAMPLE_CROPS.FACE_LEFT_PROFILE}),
  Object.freeze({code: 'FACE_RIGHT_PROFILE', label: '오른쪽 옆면', hint: '사진 속 얼굴이 화면 오른쪽을 바라보도록 고개를 옆으로 크게 돌려 주세요. 정확히 90도가 아니어도 됩니다. 눈은 한쪽만, 코끝·입 옆선과 턱선이 보이면 됩니다.', visible: '한쪽 눈 · 코끝과 입 옆선 · 귀나 귀 주변(머리카락에 조금 가려져도 됨) · 턱선', view: 'profile', direction: 'right', example: PERSON_APPROVED_EXAMPLE_CROPS.FACE_RIGHT_PROFILE}),
  Object.freeze({code: 'UPPER_BODY_FRONT', label: '정면 상반신', hint: '머리부터 허리까지 정면에서 찍어 주세요.', visible: '얼굴 · 양 어깨 · 허리(골반)까지', view: 'upper', example: PERSON_APPROVED_EXAMPLE_CROPS.UPPER_BODY_FRONT}),
  Object.freeze({code: 'FULL_BODY_FRONT', label: '정면 전신', hint: '머리부터 발끝까지 한 장에 담아 주세요.', visible: '머리부터 발끝까지 · 양 무릎과 발목', view: 'full', example: PERSON_APPROVED_EXAMPLE_CROPS.FULL_BODY_FRONT}),
  Object.freeze({code: 'FACE_FRONT_ALT', label: '추가 정면', hint: '다른 날, 다른 장소에서 찍은 정면 얼굴이면 더 좋습니다.', visible: '두 눈 · 코 · 입 · 양쪽 귀 윤곽 · 이마부터 턱까지', view: 'front', extra: true, example: PERSON_APPROVED_EXAMPLE_CROPS.FACE_FRONT_ALT}),
  Object.freeze({code: 'FACE_LEFT_ALT', label: '추가 왼쪽', hint: '왼쪽 45도와 같은 각도로, 다른 날·다른 장소에서 찍은 사진입니다. 두 눈·코·입이 모두 보여야 합니다.', visible: '두 눈(먼 쪽 눈은 작게) · 코 · 입 · 가까운 쪽 귀', view: 'turn', direction: 'left', extra: true, example: PERSON_APPROVED_EXAMPLE_CROPS.FACE_LEFT_ALT}),
  Object.freeze({code: 'FACE_RIGHT_ALT', label: '추가 오른쪽', hint: '오른쪽 45도와 같은 각도로, 다른 날·다른 장소에서 찍은 사진입니다. 두 눈·코·입이 모두 보여야 합니다.', visible: '두 눈(먼 쪽 눈은 작게) · 코 · 입 · 가까운 쪽 귀', view: 'turn', direction: 'right', extra: true, example: PERSON_APPROVED_EXAMPLE_CROPS.FACE_RIGHT_ALT}),
]);

// FAMILY-GUARDIAN-DESIGN-01: registration starts with five visible examples.
// The remaining slots are optional capacity, not another required checklist.
const displaySlot = (slotIndex, displayLabel) => Object.freeze({
  ...PERSON_IDENTITY_SLOTS[slotIndex - 1],
  slotIndex,
  displayLabel,
});

export const PERSON_REQUIRED_EXAMPLE_SLOTS = Object.freeze([
  displaySlot(1, '얼굴 사진'),
  displaySlot(2, '얼굴 사진'),
  displaySlot(3, '얼굴 사진'),
  displaySlot(6, '상반신 사진'),
  displaySlot(7, '전신 사진'),
]);

export const PERSON_OPTIONAL_EXAMPLE_SLOTS = Object.freeze([
  displaySlot(4, '추가 얼굴 사진'),
  displaySlot(5, '추가 얼굴 사진'),
  displaySlot(8, '추가 얼굴 사진'),
  displaySlot(9, '추가 얼굴 사진'),
  displaySlot(10, '추가 얼굴 사진'),
]);

export function personSlotArtwork(slot) {
  const example = slot.example;
  const [x, y, width, height] = example.viewBox.split(' ').map(Number);
  const crop = document.createElement('span');
  crop.className = 'person-slot-guide-image';
  crop.setAttribute('role', 'img');
  crop.setAttribute('aria-label', `${slot.label} 사용자 확정 예시 사진`);
  crop.style.backgroundImage = `url("${example.sheet}")`;
  crop.style.backgroundSize = `${(example.sheetWidth / width) * 100}% ${(example.sheetHeight / height) * 100}%`;
  crop.style.backgroundPosition = `${(x / (example.sheetWidth - width)) * 100}% ${(y / (example.sheetHeight - height)) * 100}%`;
  return crop;
}
