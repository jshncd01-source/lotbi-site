// SAFECARE-WEB-UI-REDESIGN-01 — the person identity photo guide.
//
// Slot order and meaning are Core's PERSON_IDENTITY_SLOT_CODES (slot_index =
// position + 1). Each empty card carries its own finished shooting example so
// the guardian does not need to compare it with a separate explanation box.

export const PERSON_IDENTITY_SLOTS = Object.freeze([
  Object.freeze({code: 'FACE_FRONT', label: '정면 얼굴', hint: '두 눈과 코, 입이 모두 보이게 정면에서 찍어 주세요.', view: 'front', artwork: 'assets/safecare/person-face-front-v1.png'}),
  // SAFECARE-PHOTO-UPLOAD-FIX-03: "왼쪽/오른쪽" is where the face looks in the
  // photo (화면 기준), and a 45-degree photo still shows both eyes, the nose and
  // the mouth; a guardian could not tell that from "고개를 반쯤 돌린 얼굴".
  Object.freeze({code: 'FACE_LEFT_45', label: '왼쪽 45도', hint: '카메라는 정면에 두고, 사진 속 얼굴이 화면 왼쪽을 바라보도록 고개를 반쯤만 돌려 주세요. 두 눈·코·입이 모두 보여야 합니다.', view: 'turn', direction: 'left', artwork: 'assets/safecare/person-face-left-45-v2.png'}),
  Object.freeze({code: 'FACE_RIGHT_45', label: '오른쪽 45도', hint: '카메라는 정면에 두고, 사진 속 얼굴이 화면 오른쪽을 바라보도록 고개를 반쯤만 돌려 주세요. 두 눈·코·입이 모두 보여야 합니다.', view: 'turn', direction: 'right', artwork: 'assets/safecare/person-face-right-45-v1.png'}),
  Object.freeze({code: 'FACE_LEFT_PROFILE', label: '왼쪽 옆면', hint: '사진 속 얼굴이 화면 왼쪽을 바라보도록 고개를 완전히 옆으로 돌려 주세요. 눈은 한쪽만, 귀와 턱선까지 보여야 합니다.', view: 'profile', direction: 'left', artwork: 'assets/safecare/person-face-left-profile-v1.png'}),
  Object.freeze({code: 'FACE_RIGHT_PROFILE', label: '오른쪽 옆면', hint: '사진 속 얼굴이 화면 오른쪽을 바라보도록 고개를 완전히 옆으로 돌려 주세요. 눈은 한쪽만, 귀와 턱선까지 보여야 합니다.', view: 'profile', direction: 'right', artwork: 'assets/safecare/person-face-right-profile-v1.png'}),
  Object.freeze({code: 'UPPER_BODY_FRONT', label: '정면 상반신', hint: '머리부터 허리까지 정면에서 찍어 주세요.', view: 'upper', artwork: 'assets/safecare/person-upper-body-front-v1.png'}),
  Object.freeze({code: 'FULL_BODY_FRONT', label: '정면 전신', hint: '머리부터 발끝까지 한 장에 담아 주세요.', view: 'full', artwork: 'assets/safecare/person-full-body-front-v1.png'}),
  Object.freeze({code: 'FACE_FRONT_ALT', label: '추가 정면', hint: '다른 날, 다른 장소에서 찍은 정면 얼굴이면 더 좋습니다.', view: 'front', extra: true, artwork: 'assets/safecare/person-face-front-alt-v1.png'}),
  Object.freeze({code: 'FACE_LEFT_ALT', label: '추가 왼쪽', hint: '왼쪽 45도와 같은 각도로, 다른 날·다른 장소에서 찍은 사진입니다. 두 눈·코·입이 모두 보여야 합니다.', view: 'turn', direction: 'left', extra: true, artwork: 'assets/safecare/person-face-left-alt-v1.png'}),
  Object.freeze({code: 'FACE_RIGHT_ALT', label: '추가 오른쪽', hint: '오른쪽 45도와 같은 각도로, 다른 날·다른 장소에서 찍은 사진입니다. 두 눈·코·입이 모두 보여야 합니다.', view: 'turn', direction: 'right', extra: true, artwork: 'assets/safecare/person-face-right-alt-v1.png'}),
]);

export function personSlotArtwork(slot) {
  const image = document.createElement('img');
  image.className = 'person-slot-guide-image';
  image.src = slot.artwork;
  image.alt = `${slot.label} 촬영 예시`;
  image.loading = 'lazy';
  image.decoding = 'async';
  return image;
}
