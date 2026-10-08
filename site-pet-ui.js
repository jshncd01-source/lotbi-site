// SITE-PET-FAMILY-WEB-01 — PET FAMILY surface for Mobile Web and Desktop.
//
// Language rule, inherited from the Core migrations and the app screen:
// LOTBI never asserts a match. No "찾았습니다", no "일치합니다", no
// "당신의 반려동물입니다". The owner decides; LOTBI only shows records.
import {
  PET_PHOTO_SLOT_CODES,
  closeFoundPet,
  closePetSOS,
  createFoundPet,
  createPetRegistrationDraft,
  createPetSOS,
  deleteFoundPetPhoto,
  deletePet,
  deletePetPhoto,
  deletePetRegistrationDraft,
  deletePetRegistrationDraftPhoto,
  fetchFoundPetPhotoObjectUrl,
  fetchPetMatchNoticePhotoObjectUrl,
  fetchPetPhotoObjectUrl,
  fetchPetRegistrationDraftPhotoObjectUrl,
  finalizePetRegistrationDraft,
  FOUND_PHOTO_SEMANTIC_SLOT_CODES,
  getActivePetRegistrationDraft,
  getPetCatalog,
  getPetPhotoManifest,
  getPetProfileHub,
  inspectPetPhotoLocally,
  FOUND_PHOTO_SLOT_MAX,
  listFoundPetPhotos,
  listFoundPets,
  listPetMatchNotices,
  listPetSOS,
  listPets,
  LOTBI_PET_NUMBER_LABEL,
  OFFICIAL_REGISTRATION_LABEL,
  lotbiPetNumber,
  maskOfficialRegistrationNumber,
  petDraftPhotoInspectionMessage,
  petDraftPhotoProgression,
  petPhotoNextActionLabel,
  petPhotoRejection,
  PET_PHOTO_ANCHOR_SLOT_CODES,
  petSexLabel,
  petSpeciesLabel,
  renamePet,
  respondToPetMatchNotice,
  submitFoundPet,
  uploadFoundPetPhoto,
  uploadPetPhoto,
  uploadPetRegistrationDraftPhoto,
  updatePetRegistrationDraft,
  updatePetProfilePreferences,
} from './site-pet.js?v=aset-f373a600ca33';
import {
  petPhotoSlotArtwork,
  petPhotoSlotHint,
  petPhotoSlotLabel,
} from './site-pet-guides.js?v=aset-f373a600ca33';
import {
  petFeatureState,
  petGateNotice,
  petNavLockHint,
  petNavLockLabel,
} from './site-pet-gate.js?v=aset-f373a600ca33';
import {createBottomSheet} from './site-bottom-sheet.js?v=aset-f373a600ca33';
import {openSafeCareRenewalNotice} from './site-safecare-renewal-notice.js?v=aset-f373a600ca33';
import {
  FOUND_REPORT_MAX_PHOTOS,
  formatDate,
  foundPhotoProgress,
  foundReviewStateCopy,
  identityPhotoProgress,
  renewalBadge,
} from './site-safecare-common.js?v=aset-f373a600ca33';

const MATCHING_CONSENT_COPY = '등록 사진은 비공개로 암호화 저장되며, 실종 SOS를 켤 때 별도로 동의한 기간에만 후보 검색에 사용됩니다. 자동 알림이나 연락처 중개는 하지 않습니다.';
const NON_ASSERTION_NOTICE = '공개 자동 매칭과 보호자 알림은 아직 활성화되지 않았습니다. LOTBI가 "찾았다"거나 "100% 일치"로 표시하지 않습니다.';

// PET-PHOTO-UX-03 — the registration screen's own reading order. This is a
// display concern only: PET_PHOTO_SLOT_CODES stays the slot-index contract
// Core and the found-pet semantic mapping rely on, and every slot's identity
// (its slotCode) is unchanged — only the order tiles are laid out in differs
// from the order they appear in that array.
const PET_PHOTO_DISPLAY_ORDER = Object.freeze([
  'FACE_FRONT', 'FACE_LEFT', 'FACE_RIGHT',
  'BODY_LEFT', 'BODY_RIGHT', 'BACK_REAR',
  'NOSE_FRONT', 'NOSE_LEFT', 'NOSE_RIGHT',
  'DISTINCTIVE',
]);

// The first photo the owner ever takes is a face, and every closeup guide
// below assumes the owner already knows what "left" and "right" mean for
// this particular animal, which only a confirmed face photo settles. So the
// screen asks for FACE_FRONT alone first and unlocks the other nine — in
// whatever order the animal cooperates with — only once it is accepted and
// the detected species has not turned out to disagree with the one chosen.
function petDraftFaceFrontConfirmed(draft, faceFrontPhoto) {
  if (!faceFrontPhoto || faceFrontPhoto.inspectionState !== 'ACCEPTED') return false;
  if (!draft?.species || !faceFrontPhoto.detectedSpecies) return true;
  return faceFrontPhoto.detectedSpecies === draft.species;
}

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

// SITE-PET-PHOTO-SOURCE-01 — a photo button never sends the owner straight
// into a single OS photo provider. Mobile Web asks LOTBI's own Camera /
// Gallery / File question first; Desktop keeps the plain file dialog every
// slot already had, unchanged.
function isMobilePetPhotoViewport() {
  if (typeof globalThis.matchMedia === 'function') return globalThis.matchMedia('(max-width: 900px)').matches;
  return (globalThis.innerWidth || 0) <= 900;
}

function petPhotoGalleryLabel() {
  const ua = typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string' ? navigator.userAgent : '';
  return /iPhone|iPad|iPod/iu.test(ua) ? '사진 보관함' : '갤러리';
}

// Three inputs, not one: a single input whose accept lists the exact JPEG/PNG
// mime types is what Android's Chrome resolves straight into one photo
// provider, with no way left to reach the camera or a Files app. Gallery and
// File both drop that exact list; petPhotoRejection() still enforces JPG/PNG
// after the owner has chosen a file, so nothing here weakens validation.
function buildPetPhotoSourceInputs() {
  const camera = el('input');
  camera.type = 'file';
  camera.accept = 'image/jpeg,image/png';
  camera.hidden = true;
  camera.setAttribute('capture', 'environment');
  camera.dataset.petPhotoSourceInput = 'camera';

  const gallery = el('input');
  gallery.type = 'file';
  gallery.accept = 'image/*';
  gallery.hidden = true;
  gallery.dataset.petPhotoSourceInput = 'gallery';

  const file = el('input');
  file.type = 'file';
  file.hidden = true;
  file.dataset.petPhotoSourceInput = 'file';

  return {camera, gallery, file, all: [camera, gallery, file]};
}

function bindPetPhotoSourceChange(sourceInputs, onFile) {
  for (const input of sourceInputs.all) {
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      input.value = '';
      if (file) onFile(file);
    });
  }
}

// Opens LOTBI's own Camera / Gallery / File sheet on Mobile Web. Desktop never
// sees this sheet at all: the button goes straight to the file dialog, same as
// before this control existed — PC canonically uses plain file upload.
function openPetPhotoSource(sourceInputs) {
  if (!isMobilePetPhotoViewport()) {
    sourceInputs.gallery.click();
    return;
  }
  const body = el('div', 'pet-photo-source-menu');
  body.setAttribute('role', 'menu');
  body.setAttribute('aria-label', '사진 가져오기');
  const sheet = createBottomSheet({label: '사진 가져오기', content: body});
  const options = [
    ['camera', '카메라', '📷', sourceInputs.camera],
    ['gallery', petPhotoGalleryLabel(), '🖼️', sourceInputs.gallery],
    ['file', '파일', '📁', sourceInputs.file],
  ];
  for (const [key, label, icon, input] of options) {
    const option = el('button', 'pet-photo-source-option');
    option.type = 'button';
    option.setAttribute('role', 'menuitem');
    option.dataset.petPhotoSourceOption = key;
    option.append(el('span', 'pet-photo-source-icon', icon), el('span', 'pet-photo-source-label', label));
    option.addEventListener('click', () => {
      sheet.close();
      input.click();
    });
    body.appendChild(option);
  }
  sheet.open();
}

// PET-PHOTO-GUIDE-DEDUPE-01 — each of the ten slot tiles below already shows
// its own example picture, label and shooting hint, and the gate banner says
// to start with the face. The guide above the tiles therefore says only what
// they cannot: why ten directions. The earlier boxed banner (an animal
// illustration, a "촬영 안내" title and a second ten-item direction map)
// repeated the tiles and the step title on the same screen.
function petPhotoGuide(species) {
  const box = el('section', 'safecare-guide safecare-guide-compact');
  box.dataset.safecareGuide = species === 'CAT' ? 'cat' : 'dog';
  box.appendChild(el(
    'p',
    'safecare-guide-copy',
    '실종 때 들어오는 발견 사진은 옆모습이나 뒷모습일 때가 많아요. 아래 10개 방향을 모두 채워야 후보를 놓치지 않습니다.',
  ));
  return box;
}

function photoProgressLabel(filled) {
  return `사진 ${filled}/${PET_PHOTO_SLOT_CODES.length}`;
}

function draftPhotoProgressMessage(summary) {
  if (summary.presentCount < summary.requiredCount) {
    return `사진 ${summary.requiredCount - summary.presentCount}장을 더 올려 주세요.`;
  }
  if (summary.rejectedSlots.length || summary.speciesMismatchSlots.length) {
    return '다시 촬영이 필요한 사진을 바꾼 뒤 기본 정보로 이동할 수 있어요.';
  }
  if (summary.pendingSlots.length) {
    return '사진 확인이 끝나지 않았어요. 확인 대기 사진이 모두 통과한 뒤 기본 정보로 이동할 수 있어요.';
  }
  return summary.ready ? '사진 10장 확인이 모두 완료됐어요.' : '사진 확인 상태를 다시 확인해 주세요.';
}

function consentLabel(state) {
  return state === 'GRANTED' ? '매칭 동의함' : '매칭 동의 안 함';
}

function errorMessage(value, fallback) {
  return value instanceof Error && value.message ? value.message : fallback;
}

// The sentence on screen is Korean and says nothing about our internals. The
// Core error code still has to be findable, or nobody can diagnose a report of
// "등록이 안 돼요", so it rides on the element as a data attribute: an engineer
// can read it in devtools, a customer never sees it.
function errorCodeOf(value) {
  const code = value && typeof value === 'object' ? value.code : '';
  return typeof code === 'string' && code ? code : '';
}

export async function mountPetFamilyManager({
  sessionToken = '',
  root,
  onCountChange,
  subscription,
  search = globalThis.location?.search || '',
  initialSurface = 'pets',
} = {}) {
  if (!(root instanceof HTMLElement)) return null;

  // 유료 게이트. 지금은 스위치가 꺼져 있어 gate.locked 는 항상 false 입니다.
  // 등록은 게이트와 무관하게 언제나 허용됩니다.
  const gate = petFeatureState(subscription, {search});

  const surface = el('div', 'pet-family-surface');
  surface.dataset.petFamilySurface = '';
  root.replaceChildren(surface);

  if (!sessionToken) {
    const empty = el('div', 'pet-empty');
    empty.append(
      el('p', 'pet-empty-title', '로그인하면 반려동물을 등록할 수 있습니다.'),
      el('p', 'pet-empty-copy', '반려동물 정보와 사진은 계정에 비공개로 저장됩니다.'),
    );
    const login = el('a', 'site-button site-button-primary pet-login-link', '로그인');
    login.href = '/auth/start/';
    empty.appendChild(login);
    surface.appendChild(empty);
    if (typeof onCountChange === 'function') onCountChange({pets: 0, activeSos: 0});
    return Object.freeze({mounted: true, dispose: () => {}});
  }

  const status = el('p', 'pet-status');
  status.setAttribute('role', 'status');
  const error = el('p', 'pet-error');
  error.setAttribute('role', 'alert');
  error.hidden = true;

  const listSection = el('section', 'pet-section');
  const listHeader = el('div', 'pet-section-header');
  listHeader.append(el('h3', 'pet-section-title', '내 반려동물'));
  const addButton = el('button', 'site-button site-button-secondary pet-add-button', '반려동물 등록');
  addButton.type = 'button';
  listHeader.appendChild(addButton);
  const listBody = el('div', 'pet-card-grid');
  listBody.dataset.petList = '';
  listSection.append(listHeader, listBody);

  const detailSection = el('section', 'pet-section pet-detail-section');
  detailSection.dataset.petDetail = '';
  detailSection.hidden = true;

  const sosSection = el('section', 'pet-section pet-case-section');
  sosSection.dataset.petSos = '';
  const foundSection = el('section', 'pet-section pet-case-section');
  foundSection.dataset.petFound = '';

  // SAFECARE-WEB-UI-REDESIGN-01 — no inner menu. The registered pets are the
  // screen; the found report is its own clearly separate call to action so it
  // is never mistaken for the owner's own pets.
  const foundCta = el('section', 'safecare-found-cta');
  foundCta.dataset.safecareFoundCta = 'pet';
  const foundCtaCopy = el('div', 'safecare-found-cta-copy');
  foundCtaCopy.append(
    el('strong', '', '길을 잃은 듯한 강아지·고양이를 발견했나요?'),
    el('span', '', 'LOTBI에 등록된 반려동물이 아니어도 발견 제보를 남길 수 있습니다.'),
  );
  const foundCtaButton = el('button', 'site-button site-button-secondary safecare-found-cta-button', '발견 제보하기');
  foundCtaButton.type = 'button';
  foundCtaButton.dataset.petFoundOpen = '';
  foundCta.append(foundCtaCopy, foundCtaButton);

  const notice = el('p', 'pet-notice', NON_ASSERTION_NOTICE);

  // The found CTA sits above the pets so a finder sees it first, in its own box.
  listSection.insertBefore(foundCta, listBody);
  surface.append(status, error, listSection, detailSection, sosSection, foundSection, notice);

  let pets = [];
  let sosCases = [];
  let foundCases = [];
  let foundPhotos = new Map();
  let photoCounts = new Map();
  let petProfiles = new Map();
  let matchNotices = [];
  let catalog = null;
  let registrationDraft = null;
  // PET-REGISTER-BASIC-FIRST-01: while the registration form is open it is the
  // whole screen, the same as the person registration — the list steps aside.
  let registering = false;
  // 'sos' used to be a menu page. The missing state now lives on each pet card,
  // so an 'sos' entry from chat lands on the list where ACTIVE SOS cards show.
  let activeSurface = initialSurface === 'found' ? 'found' : 'pets';
  let pendingSosPetId = '';
  let busy = false;
  // `${petId}:${slotCode}` -> object URL. Cached so re-rendering the detail
  // does not refetch every private photo, and revoked on dispose.
  const photoPreviews = new Map();
  const filledSlots = new Map();

  const previewKey = (petId, slotCode) => `${petId}:${slotCode}`;

  const showSurface = target => {
    activeSurface = ['pets', 'sos', 'found'].includes(target) ? target : 'pets';
    surface.dataset.petSurface = activeSurface;
    listSection.hidden = activeSurface !== 'pets' || registering;
    foundCta.hidden = activeSurface !== 'pets';
    detailSection.hidden = activeSurface !== 'pets' || detailSection.childElementCount === 0;
    sosSection.hidden = activeSurface !== 'sos';
    foundSection.hidden = activeSurface !== 'found';
  };

  const backToList = () => {
    const back = el('button', 'site-button site-button-secondary', '← 목록으로');
    back.type = 'button';
    back.dataset.petBackToList = '';
    back.addEventListener('click', () => {
      pendingSosPetId = '';
      showSurface('pets');
      renderList();
    });
    const bar = el('div', 'safecare-back');
    bar.appendChild(back);
    return bar;
  };
  showSurface(activeSurface);

  const revokePreview = key => {
    const url = photoPreviews.get(key);
    if (!url) return;
    URL.revokeObjectURL(url);
    photoPreviews.delete(key);
  };

  const revokePetPreviews = petId => {
    for (const key of [...photoPreviews.keys()]) {
      if (key.startsWith(`${petId}:`)) revokePreview(key);
    }
  };

  const dispose = () => {
    dropFoundComposer();
    for (const key of [...photoPreviews.keys()]) revokePreview(key);
  };

  const showError = (value, cause) => {
    error.textContent = value;
    error.hidden = !value;
    const code = errorCodeOf(cause);
    if (code) error.dataset.petErrorCode = code;
    else delete error.dataset.petErrorCode;
  };

  // 등록에 성공한 뒤 뜨는 안내입니다. 등록을 막는 경고가 아닙니다.
  const showGateNotice = () => {
    const copy = petGateNotice(gate);
    const backdrop = el('div', 'pet-gate-backdrop');
    backdrop.dataset.petGateNotice = '';
    const panel = el('div', 'pet-gate-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    const heading = el('h4', 'pet-gate-title', copy.title);
    const body = el('p', 'pet-gate-copy', copy.body);
    panel.append(heading, body);
    const actions = el('div', 'pet-gate-actions');
    const close = el('button', 'site-button site-button-primary', copy.action);
    close.type = 'button';
    const dismiss = () => {
      backdrop.remove();
      addButton.focus();
    };
    close.addEventListener('click', dismiss);
    backdrop.addEventListener('click', event => {
      if (event.target === backdrop) dismiss();
    });
    panel.setAttribute('aria-labelledby', 'pet-gate-title');
    heading.id = 'pet-gate-title';
    actions.appendChild(close);
    panel.appendChild(actions);
    backdrop.appendChild(panel);
    surface.appendChild(backdrop);
    close.focus();
  };

  const setBusy = value => {
    busy = value;
    surface.dataset.petBusy = value ? 'true' : 'false';
    addButton.disabled = value;
  };

  const activeSosCount = () => sosCases.filter(item => item.status === 'ACTIVE').length;

  const reportCount = () => {
    if (typeof onCountChange === 'function') {
      onCountChange({
        pets: pets.length,
        activeSos: activeSosCount(),
        locked: gate.locked,
        lockLabel: petNavLockLabel(gate),
        lockHint: petNavLockHint(gate),
      });
    }
  };

  const loadPhotoCounts = async () => {
    const entries = await Promise.all(pets.map(async pet => {
      try {
        const manifest = await getPetPhotoManifest(sessionToken, pet.petId);
        filledSlots.set(pet.petId, new Set(manifest.filledSlots));
        return [pet.petId, manifest.filledSlots.length];
      } catch {
        // A photo manifest failure must not hide the pet itself.
        return [pet.petId, null];
      }
    }));
    photoCounts = new Map(entries);
  };

  const renderList = () => {
    listBody.replaceChildren();
    if (pets.length === 0) {
      const empty = el('div', 'pet-empty');
      empty.append(
        el('p', 'pet-empty-title', '등록된 반려동물이 없습니다.'),
        el('p', 'pet-empty-copy', '기본정보를 입력하고 서로 다른 방향의 사진 10장을 등록하면, 실종 시 바로 실종 상태로 전환할 수 있습니다.'),
      );
      listBody.appendChild(empty);
      return;
    }
    for (const pet of pets) {
      const card = el('article', 'pet-card');
      card.dataset.petCard = pet.petId;
      const profile = petProfiles.get(pet.petId);

      if (profile?.thumbnailSlot) {
        const thumbnail = el('div', 'pet-profile-thumbnail');
        const key = previewKey(pet.petId, profile.thumbnailSlot);
        const cached = photoPreviews.get(key);
        if (cached) {
          const image = el('img', 'pet-profile-thumbnail-image');
          image.src = cached;
          image.alt = `${pet.name} 대표 사진`;
          image.decoding = 'async';
          thumbnail.appendChild(image);
        } else {
          thumbnail.appendChild(el('span', 'pet-profile-thumbnail-loading', '사진'));
          void (async () => {
            try {
              const url = await fetchPetPhotoObjectUrl(sessionToken, pet.petId, profile.thumbnailSlot);
              photoPreviews.set(key, url);
              if (!thumbnail.isConnected) return;
              const image = el('img', 'pet-profile-thumbnail-image');
              image.src = url;
              image.alt = `${pet.name} 대표 사진`;
              image.decoding = 'async';
              thumbnail.replaceChildren(image);
            } catch {
              thumbnail.dataset.petThumbnailUnavailable = 'true';
            }
          })();
        }
        card.appendChild(thumbnail);
      }

      const head = el('div', 'pet-card-head');
      head.append(el('h4', 'pet-card-name', `${pet.name}${profile?.isPrimary ? ' ⭐' : ''}`));
      head.appendChild(el('span', 'pet-card-species', petSpeciesLabel(pet.species)));
      if (profile) {
        const badge = renewalBadge({state: profile.identityPhotoState, daysRemaining: profile.identityPhotoDaysRemaining});
        const renewal = el('span', `safecare-badge safecare-badge-${badge.tone}`, badge.label);
        renewal.dataset.petRenewalState = profile.identityPhotoState || 'UNKNOWN';
        head.appendChild(renewal);
      }
      card.appendChild(head);
      if (profile?.identityPhotoExpiresAt) {
        const days = Number.isInteger(profile.identityPhotoDaysRemaining)
          ? ` · ${Math.max(0, profile.identityPhotoDaysRemaining)}일 남음`
          : '';
        card.appendChild(el(
          'p',
          'pet-profile-renewal',
          `다음 사진 갱신일 ${formatDate(profile.identityPhotoExpiresAt)}${profile.identityPhotoState === 'EXPIRED' ? ' · 기한 지남' : days}`,
        ));
      }

      if (profile) {
        card.appendChild(el('p', 'pet-profile-age', `${pet.name} · ${profile.ageLabel}`));
        if (profile.familyLabel) card.appendChild(el('p', 'pet-profile-family', profile.familyLabel));
        const identity = profile.photoCount >= profile.photoTotal && profile.visualStatus === 'READY'
          ? `✓ ${profile.visualLabel}`
          : `📷 식별사진 ${profile.photoCount}/${profile.photoTotal}`;
        card.appendChild(el('p', 'pet-profile-identity', identity));
        if (profile.activeSos) {
          card.appendChild(el('p', 'pet-profile-sos', `🔴 ${pet.name} 실종 상태 활성화 중`));
        } else if (profile.recentlyResolved) {
          card.appendChild(el('p', 'pet-profile-resolved', `❤️ ${pet.name}가 돌아왔어요`));
        }
        if (profile.birthday?.reminderDue) {
          const birthdayCopy = profile.birthday.state === 'TODAY'
            ? `🎉 오늘은 ${pet.name} 생일이에요!`
            : (profile.birthday.state === 'D1'
              ? `🎂 ${pet.name} 생일이 내일이에요`
              : `🎂 ${pet.name} 생일까지 7일`);
          card.appendChild(el('p', 'pet-profile-birthday', birthdayCopy));
        }
        // The renewal badge and Core date above already say how long is left;
        // only an expired set needs the extra instruction.
        if (profile.identityPhotoState === 'EXPIRED') {
          card.appendChild(el('p', 'pet-profile-birthday', '식별사진 유효기간이 지났어요 · 실종 상태 전환 전에 갱신해 주세요'));
        }
        if (profile.candidateNoticeCount > 0) {
          const candidate = el('button', 'pet-candidate-cta', `🟠 ${pet.name}와 유사한 발견 제보가 있어요 · 확인하기 ›`);
          candidate.type = 'button';
          candidate.dataset.petOpen = pet.petId;
          candidate.dataset.petCandidateOpen = pet.petId;
          card.appendChild(candidate);
        }
      }

      const filled = photoCounts.get(pet.petId);
      const progress = el('div', 'pet-progress');
      const bar = el('div', 'pet-progress-bar');
      const fill = el('span', 'pet-progress-fill');
      const ratio = Number.isInteger(filled) ? filled / PET_PHOTO_SLOT_CODES.length : 0;
      fill.style.width = `${Math.round(ratio * 100)}%`;
      bar.appendChild(fill);
      progress.append(
        bar,
        el('span', 'pet-progress-label', Number.isInteger(filled)
          ? photoProgressLabel(filled)
          : '사진 상태 확인 실패'),
      );
      card.appendChild(progress);

      card.appendChild(el('p', 'pet-card-consent', consentLabel(pet.matchingConsentState)));

      // The missing state shows only while an SOS is ACTIVE, on the pet's own
      // card, with the action that ends it.
      const activeCase = sosCases.find(item => item.petId === pet.petId && item.status === 'ACTIVE');
      if (activeCase) {
        const missingBox = el('div', 'safecare-sos-active');
        missingBox.dataset.petActiveSos = activeCase.caseId;
        missingBox.appendChild(el('strong', '', '실종 상태 진행 중'));
        if (activeCase.occurredAt) missingBox.appendChild(el('span', '', `마지막 목격 ${displayMoment(activeCase.occurredAt)}`));
        if (activeCase.locationLabel) missingBox.appendChild(el('span', '', activeCase.locationLabel));
        missingBox.appendChild(el(
          'span',
          'safecare-sos-active-note',
          '실종 기간 동안만 동의한 사진으로 발견 제보와 비교하고, 후보는 관리자가 검토한 뒤 보호자에게 확인을 요청합니다.',
        ));
        missingBox.appendChild(closeCaseButtons(activeCase, 'sos'));
        card.appendChild(missingBox);
      }

      const actions = el('div', 'pet-card-actions');
      const open = el('button', 'site-button site-button-secondary pet-card-open', '사진 갱신·관리');
      open.type = 'button'; open.dataset.petOpen = pet.petId;
      actions.append(open);
      if (!activeCase) {
        const missing = el('button', 'site-button site-button-primary', '실종 상태로 전환');
        missing.type = 'button'; missing.dataset.petSosTarget = pet.petId;
        actions.append(missing);
      }
      card.appendChild(actions);

      listBody.appendChild(card);
    }
  };

  // The 10 slots are the heart of the feature and the part owners understand
  // least, so every tile carries a schematic of the view to shoot plus a
  // one-line hint, and the progress line names what is still missing.
  const renderPhotos = (pet, host) => {
    host.replaceChildren();
    const filled = filledSlots.get(pet.petId) || new Set();

    const header = el('div', 'pet-photo-header');
    header.append(el('h4', 'pet-photo-title', '사진 갱신·관리 · 식별 사진 10장'));
    const progress = identityPhotoProgress(filled.size);
    const count = el('span', 'pet-photo-count safecare-photo-counter', `${progress.label} · ${progress.remainingLabel}`);
    count.dataset.safecarePhotoCount = String(progress.count);
    header.appendChild(count);
    host.appendChild(header);
    const profile = petProfiles.get(pet.petId);
    if (profile?.identityPhotoExpiresAt) {
      host.appendChild(el(
        'p',
        'pet-photo-context-note',
        `다음 사진 갱신일 ${formatDate(profile.identityPhotoExpiresAt)} · 사진을 다시 선택하면 해당 방향의 사진이 최신 사진으로 바뀝니다.`,
      ));
    }
    if (sosCases.some(item => item.petId === pet.petId && item.status === 'ACTIVE')) {
      host.appendChild(el(
        'p',
        'pet-photo-context-note',
        '진행 중인 실종 상태는 전환 당시 사진으로 계속 비교합니다. 지금 바꾼 사진은 진행 중인 실종 비교에 반영되지 않습니다.',
      ));
    }
    host.appendChild(petPhotoGuide(pet.species));

    const bar = el('div', 'pet-progress-bar');
    const fill = el('span', 'pet-progress-fill');
    fill.style.width = `${Math.round((filled.size / PET_PHOTO_SLOT_CODES.length) * 100)}%`;
    bar.appendChild(fill);
    host.appendChild(bar);

    const remaining = PET_PHOTO_SLOT_CODES.filter(code => !filled.has(code));
    host.appendChild(el(
      'p',
      'pet-photo-progress-note',
      remaining.length === 0
        ? '10장을 모두 채웠습니다. 외형 프로필이 완성 상태로 기록됩니다.'
        : `${remaining.length}장 남았습니다 · ${remaining.slice(0, 3).map(petPhotoSlotLabel).join(', ')}${remaining.length > 3 ? ' 외' : ''}`,
    ));
    host.appendChild(el(
      'p',
      'pet-photo-limits',
      'JPG 또는 PNG, 한 장에 10MB까지. 사진은 계정에 비공개로 저장되고 공개 링크가 만들어지지 않습니다.',
    ));

    const grid = el('div', 'pet-slot-grid');
    grid.dataset.petSlotGrid = '';

    PET_PHOTO_SLOT_CODES.forEach((slotCode, index) => {
      const tile = el('figure', 'pet-slot');
      tile.dataset.petSlot = slotCode;
      tile.dataset.petSlotFilled = filled.has(slotCode) ? 'true' : 'false';

      const media = el('div', 'pet-slot-media');
      const key = previewKey(pet.petId, slotCode);
      const preview = photoPreviews.get(key);
      if (filled.has(slotCode) && preview) {
        const image = el('img', 'pet-slot-photo');
        image.src = preview;
        image.alt = `${pet.name} ${petPhotoSlotLabel(slotCode)} 사진`;
        image.decoding = 'async';
        media.appendChild(image);
      } else {
        const artwork = petPhotoSlotArtwork(slotCode, pet.species);
        if (artwork) media.appendChild(artwork);
        if (filled.has(slotCode)) media.appendChild(el('span', 'pet-slot-loading', '불러오는 중'));
      }
      tile.appendChild(media);

      const caption = el('figcaption', 'pet-slot-caption');
      caption.append(
        el('span', 'pet-slot-index', String(index + 1)),
        el('span', 'pet-slot-label', petPhotoSlotLabel(slotCode)),
      );
      tile.appendChild(caption);
      tile.appendChild(el('p', 'pet-slot-hint', petPhotoSlotHint(slotCode)));

      const slotError = el('p', 'pet-slot-error');
      slotError.setAttribute('role', 'alert');
      slotError.hidden = true;

      // 개·고양이만 등록. Core refuses a photo that is neither rather than
      // asking the owner what it is, so the refusal has to arrive with the
      // next step attached — an error message on its own is the dead end this
      // replaces.
      const retry = el('div', 'pet-slot-retry');
      retry.hidden = true;
      const retryAction = el('button', 'site-button site-button-secondary pet-slot-retry-action', '다시 찍기');
      retryAction.type = 'button';
      retry.appendChild(retryAction);

      const clearRefusal = () => {
        slotError.hidden = true;
        retry.hidden = true;
        delete slotError.dataset.petErrorCode;
      };
      const refuse = (message, cause) => {
        slotError.textContent = message;
        slotError.hidden = false;
        const code = errorCodeOf(cause);
        if (code) slotError.dataset.petErrorCode = code;
        else delete slotError.dataset.petErrorCode;
        const nextAction = cause && typeof cause === 'object' && typeof cause.nextAction === 'string'
          ? cause.nextAction
          : '';
        retryAction.textContent = petPhotoNextActionLabel(nextAction);
        retryAction.dataset.petSlotNextAction = nextAction || 'RETAKE';
        retry.hidden = false;
      };

      const sourceInputs = buildPetPhotoSourceInputs();
      for (const input of sourceInputs.all) input.dataset.petSlotInput = slotCode;

      const actions = el('div', 'pet-slot-actions');
      const choose = el('button', 'site-button site-button-secondary pet-slot-choose',
        filled.has(slotCode) ? '다른 사진 선택' : '사진 선택');
      choose.type = 'button';
      choose.dataset.petSlotChoose = slotCode;
      choose.addEventListener('click', () => openPetPhotoSource(sourceInputs));
      actions.appendChild(choose);

      if (filled.has(slotCode)) {
        const remove = el('button', 'pet-slot-remove', '삭제');
        remove.type = 'button';
        remove.dataset.petSlotDelete = slotCode;
        remove.addEventListener('click', async () => {
          if (busy) return;
          setBusy(true);
          clearRefusal();
          tile.dataset.petSlotWorking = 'true';
          try {
            const {manifest} = await deletePetPhoto(sessionToken, pet.petId, slotCode);
            filled.delete(slotCode);
            filledSlots.set(pet.petId, filled);
            revokePreview(key);
            photoCounts.set(pet.petId, manifest.slotCount);
            renderList();
            renderPhotos(pet, host);
            status.textContent = `${petPhotoSlotLabel(slotCode)} 사진을 삭제했습니다.`;
          } catch (value) {
            refuse(errorMessage(value, '사진을 삭제하지 못했습니다.'), value);
          } finally {
            tile.dataset.petSlotWorking = 'false';
            setBusy(false);
          }
        });
        actions.appendChild(remove);
      }

      const handleChosenFile = async file => {
        if (busy) return;
        const rejection = petPhotoRejection(file);
        if (rejection) {
          refuse(rejection, null);
          return;
        }
        // The screen's own quick look, so an unusable frame fails here rather
        // than after a round trip. Core still decides: it runs the classifier,
        // and a browser can be skipped entirely.
        const localLook = await inspectPetPhotoLocally(file);
        if (localLook) {
          refuse(localLook.message, {code: localLook.code});
          return;
        }
        setBusy(true);
        clearRefusal();
        tile.dataset.petSlotWorking = 'true';
        try {
          const {manifest} = await uploadPetPhoto(sessionToken, pet.petId, slotCode, file);
          filled.add(slotCode);
          filledSlots.set(pet.petId, filled);
          photoCounts.set(pet.petId, manifest.slotCount);
          revokePreview(key);
          try {
            photoPreviews.set(key, await fetchPetPhotoObjectUrl(sessionToken, pet.petId, slotCode));
          } catch {
            // The upload succeeded; only the preview is missing.
          }
          renderList();
          renderPhotos(pet, host);
          status.textContent = `${petPhotoSlotLabel(slotCode)} 사진을 올렸습니다.`;
        } catch (value) {
          refuse(errorMessage(value, '사진을 올리지 못했습니다.'), value);
        } finally {
          tile.dataset.petSlotWorking = 'false';
          setBusy(false);
        }
      };
      bindPetPhotoSourceChange(sourceInputs, file => { void handleChosenFile(file); });

      retryAction.addEventListener('click', () => {
        if (busy) return;
        // A close-up cannot settle a species on its own, so Core holds it until
        // the pet has a whole-animal photo. Sending the owner back to the file
        // picker for the same slot would just repeat the refusal; the button
        // takes them to the photo Core is actually waiting for.
        if (retryAction.dataset.petSlotNextAction === 'UPLOAD_FACE_OR_BODY_FIRST') {
          const anchorTile = grid.querySelector(
            `[data-pet-slot="${PET_PHOTO_ANCHOR_SLOT_CODES[0]}"] [data-pet-slot-choose]`,
          );
          anchorTile?.scrollIntoView({block: 'center', behavior: 'smooth'});
          anchorTile?.focus();
          return;
        }
        openPetPhotoSource(sourceInputs);
      });

      tile.append(actions, slotError, retry, ...sourceInputs.all);
      grid.appendChild(tile);
    });

    host.appendChild(grid);

    // Fill in previews for slots whose bytes are not cached yet.
    for (const slotCode of filled) {
      const key = previewKey(pet.petId, slotCode);
      if (photoPreviews.has(key)) continue;
      void (async () => {
        try {
          const url = await fetchPetPhotoObjectUrl(sessionToken, pet.petId, slotCode);
          photoPreviews.set(key, url);
          const tile = grid.querySelector(`[data-pet-slot="${slotCode}"] .pet-slot-media`);
          if (!tile || !tile.isConnected) {
            return;
          }
          const image = el('img', 'pet-slot-photo');
          image.src = url;
          image.alt = `${pet.name} ${petPhotoSlotLabel(slotCode)} 사진`;
          image.decoding = 'async';
          tile.replaceChildren(image);
        } catch {
          // A preview that cannot load must not leave the tile claiming to be
          // loading forever: keep the schematic and say so once.
          const media = grid.querySelector(`[data-pet-slot="${slotCode}"] .pet-slot-media`);
          const loading = media?.querySelector('.pet-slot-loading');
          if (loading) loading.textContent = '미리보기 실패';
        }
      })();
    }
  };

  const refreshPetProfileData = async () => {
    const [profiles, notices] = await Promise.all([
      getPetProfileHub(sessionToken),
      listPetMatchNotices(sessionToken),
    ]);
    petProfiles = new Map(profiles.map(row => [row.petId, row]));
    matchNotices = [...notices];
  };

  const renderMatchNotices = (pet, host) => {
    host.replaceChildren();
    const rows = matchNotices.filter(item => item.petId === pet.petId);
    if (!rows.length) {
      host.hidden = true;
      return;
    }
    host.hidden = false;
    host.appendChild(el('h4', 'pet-candidate-title', '유사한 발견 제보'));
    host.appendChild(el(
      'p',
      'pet-candidate-safety',
      '관리자가 근거를 검토한 후보입니다. 시각적 유사도는 같은 반려동물일 확률이나 확정 판정이 아닙니다.',
    ));
    for (const notice of rows) {
      const card = el('article', 'pet-candidate-card');
      card.dataset.petCandidate = notice.candidateId;
      card.appendChild(el('strong', 'pet-candidate-message', notice.message));
      const photo = el('div', 'pet-candidate-photo');
      const key = previewKey(pet.petId, `candidate-${notice.candidateId}`);
      const cached = photoPreviews.get(key);
      if (cached) {
        const image = el('img', 'pet-candidate-photo-image');
        image.src = cached; image.alt = '발견 제보 사진'; image.decoding = 'async';
        photo.appendChild(image);
      } else {
        photo.appendChild(el('span', 'pet-candidate-photo-loading', '발견 사진 불러오는 중'));
        void (async () => {
          try {
            const url = await fetchPetMatchNoticePhotoObjectUrl(sessionToken, notice.candidateId);
            photoPreviews.set(key, url);
            if (!photo.isConnected) return;
            const image = el('img', 'pet-candidate-photo-image');
            image.src = url; image.alt = '발견 제보 사진'; image.decoding = 'async';
            photo.replaceChildren(image);
          } catch {
            photo.replaceChildren(el('span', 'pet-candidate-photo-loading', '발견 사진을 불러오지 못했습니다.'));
          }
        })();
      }
      card.appendChild(photo);
      if (notice.visualSimilarityLabel) {
        card.appendChild(el('p', 'pet-candidate-evidence', notice.visualSimilarityLabel));
      }
      if (notice.foundAt) card.appendChild(el('p', 'pet-candidate-evidence', `발견 시각 ${displayMoment(notice.foundAt)}`));
      const location = notice.foundLocation.label
        || notice.foundLocation.district
        || notice.foundLocation.city
        || notice.foundLocation.region
        || '';
      if (location) card.appendChild(el('p', 'pet-candidate-evidence', `발견 지역 ${location}`));
      const privacy = el('p', 'pet-candidate-privacy', '발견자 연락처는 공개되지 않습니다.');
      card.appendChild(privacy);
      if (notice.status === 'RESPONDED' || notice.ownerResponse) {
        const labels = {LIKELY_MINE: '내 반려동물 같아요', NOT_MINE: '아닌 것 같아요', UNSURE: '잘 모르겠어요'};
        card.appendChild(el('p', 'pet-candidate-response', `응답: ${labels[notice.ownerResponse] || '확인 완료'}`));
      } else {
        const actions = el('div', 'pet-candidate-actions');
        for (const [response, label] of [
          ['LIKELY_MINE', '내 반려동물 같아요'],
          ['NOT_MINE', '아닌 것 같아요'],
          ['UNSURE', '잘 모르겠어요'],
        ]) {
          const button = el('button', 'site-button site-button-secondary', label);
          button.type = 'button';
          button.addEventListener('click', async () => {
            if (busy) return;
            setBusy(true); showError('');
            try {
              await respondToPetMatchNotice(sessionToken, notice.candidateId, response);
              await refreshPetProfileData();
              renderList();
              renderDetail(pet.petId);
              status.textContent = '발견 제보 확인 응답을 저장했습니다. 연락처 연결은 시작하지 않았습니다.';
            } catch (value) {
              showError(errorMessage(value, '확인 응답을 저장하지 못했습니다.'), value);
            } finally {
              setBusy(false);
            }
          });
          actions.appendChild(button);
        }
        card.appendChild(actions);
      }
      host.appendChild(card);
    }
  };

  const renderDetail = petId => {
    registering = false;
    listSection.hidden = activeSurface !== 'pets';
    addButton.hidden = false;
    const pet = pets.find(item => item.petId === petId);
    if (!pet) {
      detailSection.hidden = true;
      detailSection.replaceChildren();
      return;
    }
    detailSection.hidden = false;
    detailSection.replaceChildren();

    const header = el('div', 'pet-section-header');
    header.append(el('h3', 'pet-section-title', `${pet.name} 상세`));
    const close = el('button', 'site-button site-button-secondary', '닫기');
    close.type = 'button';
    close.addEventListener('click', () => {
      detailSection.hidden = true;
      detailSection.replaceChildren();
    });
    header.appendChild(close);
    detailSection.appendChild(header);

    const facts = el('dl', 'pet-facts');
    const addFact = (term, value) => {
      if (!value) return;
      facts.append(el('dt', '', term), el('dd', '', value));
    };
    addFact('종', petSpeciesLabel(pet.species));
    addFact('성별', petSexLabel(pet.sex));
    addFact('품종', pet.breed);
    addFact('생년월일', pet.birthDate);
    addFact('추정 월령', Number.isInteger(pet.approximateAgeMonths) ? `${pet.approximateAgeMonths}개월` : '');
    addFact('색상', pet.color);
    addFact('특징', pet.distinctiveMarks);
    const filled = photoCounts.get(pet.petId);
    addFact('사진', Number.isInteger(filled) ? `${filled}/${PET_PHOTO_SLOT_CODES.length}` : '확인 실패');
    const profile = petProfiles.get(pet.petId);
    if (profile) {
      addFact('현재 나이', profile.ageLabel);
      addFact('가족 기간', profile.familyLabel);
      addFact('식별정보', profile.visualLabel);
      if (profile.activeSos) addFact('실종 상태', '활성화 중');
      else if (profile.recentlyResolved) addFact('실종 상태', '최근 돌아옴');
    }
    detailSection.appendChild(facts);

    if (profile) {
      const profileControls = el('section', 'pet-profile-controls');
      profileControls.appendChild(el('h4', 'pet-profile-controls-title', '프로필 설정'));
      for (const [field, label, checked] of [
        ['is_primary', '대표 반려동물 ⭐', profile.isPrimary],
        ['birthday_reminders_enabled', '정확한 생일 알림', profile.birthdayRemindersEnabled],
        ['family_anniversary_reminders_enabled', '가족이 된 날 알림', profile.familyAnniversaryRemindersEnabled],
      ]) {
        const line = el('label', 'pet-consent-toggle');
        const input = el('input'); input.type = 'checkbox'; input.checked = checked;
        if (field === 'birthday_reminders_enabled' && profile.ageMode !== 'EXACT') input.disabled = true;
        line.append(input, el('span', '', label));
        input.addEventListener('change', async () => {
          if (busy) return;
          setBusy(true); showError('');
          try {
            await updatePetProfilePreferences(sessionToken, pet.petId, {[field]: input.checked});
            await refreshPetProfileData();
            renderList(); renderDetail(pet.petId);
            status.textContent = '프로필 설정을 저장했습니다.';
          } catch (value) {
            input.checked = !input.checked;
            showError(errorMessage(value, '프로필 설정을 저장하지 못했습니다.'), value);
          } finally { setBusy(false); }
        });
        profileControls.appendChild(line);
      }
      detailSection.appendChild(profileControls);

      if (profile.timeline.length) {
        const timeline = el('section', 'pet-timeline');
        timeline.appendChild(el('h4', 'pet-timeline-title', '기록'));
        const list = el('ol', 'pet-timeline-list');
        for (const item of profile.timeline) {
          const row = el('li', 'pet-timeline-item');
          if (item.at) row.appendChild(el('time', 'pet-timeline-time', displayMoment(item.at)));
          row.appendChild(el('span', 'pet-timeline-label', item.label));
          list.appendChild(row);
        }
        timeline.appendChild(list);
        detailSection.appendChild(timeline);
      }
    }

    if (pet.officialRegistrationNumber) {
      const registration = el('div', 'pet-registration');
      const value = el('span', 'pet-registration-value', maskOfficialRegistrationNumber(pet.officialRegistrationNumber));
      const reveal = el('button', 'pet-registration-reveal', '보기');
      reveal.type = 'button';
      let revealed = false;
      reveal.addEventListener('click', () => {
        revealed = !revealed;
        value.textContent = revealed
          ? pet.officialRegistrationNumber
          : maskOfficialRegistrationNumber(pet.officialRegistrationNumber);
        reveal.textContent = revealed ? '가리기' : '보기';
      });
      registration.append(el('span', 'pet-registration-term', OFFICIAL_REGISTRATION_LABEL), value, reveal);
      detailSection.appendChild(registration);
    }

    // 롯비 번호를 국가 등록번호보다 먼저, 그리고 분명히 다른 것으로 보여 줍니다.
    // 이 번호는 우리가 발급한 것이고, 국가 동물등록번호를 대신하지 않습니다.
    const lotbiNumber = el('div', 'pet-number-block');
    lotbiNumber.dataset.petLotbiNumber = '';
    lotbiNumber.append(
      el('span', 'pet-number-term', LOTBI_PET_NUMBER_LABEL),
      el('code', 'pet-number-value', lotbiPetNumber(pet.petId)),
      el('p', 'pet-number-note', '롯비가 발급한 번호입니다. 국가 동물등록번호를 대신하지 않습니다.'),
    );
    detailSection.appendChild(lotbiNumber);

    const photos = el('section', 'pet-photo-section');
    photos.dataset.petPhotos = pet.petId;
    detailSection.appendChild(photos);
    renderPhotos(pet, photos);

    const candidates = el('section', 'pet-candidate-section');
    candidates.dataset.petCandidates = pet.petId;
    detailSection.appendChild(candidates);
    renderMatchNotices(pet, candidates);

    const renameField = el('label', 'site-field', '이름');
    const renameInput = el('input');
    renameInput.type = 'text';
    renameInput.maxLength = 120;
    renameInput.value = pet.name;
    renameInput.autocomplete = 'off';
    renameField.appendChild(renameInput);
    const renameSave = el('button', 'site-button site-button-secondary', '이름 저장');
    renameSave.type = 'button';
    renameSave.addEventListener('click', async () => {
      const name = renameInput.value.trim();
      if (!name || busy) return;
      setBusy(true);
      showError('');
      try {
        const updated = await renamePet(sessionToken, pet.petId, name);
        pets = pets.map(item => (item.petId === updated.petId ? updated : item));
        renderList();
        renderDetail(updated.petId);
        status.textContent = '이름을 저장했습니다.';
      } catch (value) {
        showError(errorMessage(value, '이름을 바꾸지 못했습니다.'), value);
      } finally {
        setBusy(false);
      }
    });
    detailSection.append(renameField, renameSave);

    const consent = el('div', 'pet-consent');
    consent.append(
      el('strong', '', '등록 사진은 평소 검색에 사용되지 않습니다.'),
      el('p', 'pet-consent-copy', MATCHING_CONSENT_COPY),
    );
    detailSection.appendChild(consent);

    const remove = el('button', 'site-button pet-delete-button', '반려동물 삭제');
    remove.type = 'button';
    remove.dataset.petDelete = pet.petId;
    const confirmLine = el('p', 'pet-delete-confirm');
    confirmLine.hidden = true;
    const confirmYes = el('button', 'site-button pet-delete-button', '삭제 확정');
    confirmYes.type = 'button';
    confirmLine.append(
      el('span', '', `"${pet.name}" 기록과 사진을 삭제합니다. 되돌릴 수 없습니다.`),
      confirmYes,
    );
    remove.addEventListener('click', () => {
      confirmLine.hidden = false;
      remove.hidden = true;
    });
    confirmYes.addEventListener('click', async () => {
      if (busy) return;
      setBusy(true);
      showError('');
      try {
        await deletePet(sessionToken, pet.petId);
        pets = pets.filter(item => item.petId !== pet.petId);
        photoCounts.delete(pet.petId);
        filledSlots.delete(pet.petId);
        revokePetPreviews(pet.petId);
        detailSection.hidden = true;
        detailSection.replaceChildren();
        renderList();
        reportCount();
        status.textContent = '반려동물을 삭제했습니다.';
      } catch (value) {
        showError(errorMessage(value, '반려동물을 삭제하지 못했습니다.'), value);
      } finally {
        setBusy(false);
      }
    });
    detailSection.append(remove, confirmLine);
  };

  const localNowValue = () => {
    const now = new Date();
    const pad = value => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  };

  // datetime-local gives a naive local string; Core wants an instant, so send
  // the resolved ISO timestamp rather than whatever the browser's zone implies.
  const isoFromLocal = value => {
    const parsed = new Date(String(value || ''));
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
  };

  const displayMoment = value => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    const pad = n => String(n).padStart(2, '0');
    return `${parsed.getFullYear()}.${pad(parsed.getMonth() + 1)}.${pad(parsed.getDate())} ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
  };

  const caseStatusLabel = status => ({
    ACTIVE: '진행 중',
    RESOLVED: '종료 (돌아옴)',
    CANCELLED: '신고 취소',
    EXPIRED: '기간 만료',
  })[status] || status;

  const momentField = (labelText, initial) => {
    const field = el('label', 'site-field', labelText);
    const input = el('input');
    input.type = 'datetime-local';
    input.value = initial;
    field.appendChild(input);
    return {field, input};
  };

  const textField = (labelText, maxLength, placeholder = '') => {
    const field = el('label', 'site-field', labelText);
    const input = el('input');
    input.type = 'text';
    input.maxLength = maxLength;
    input.autocomplete = 'off';
    if (placeholder) input.placeholder = placeholder;
    field.appendChild(input);
    return {field, input};
  };

  // SAFECARE-WEB-UI-REDESIGN-01 — found report, photo first.
  //
  // Writing may start from one photo. Until the reporter gives a time and a
  // place those photos live only in this browser tab; "작성 중 저장" turns them
  // into Core's own DRAFT found case. The final submit opens at five photos and
  // adding stops at ten. Each photo still carries Core's automatic semantic
  // slot, so the reporter never has to label angles.
  let foundComposer = null;
  const freshFoundComposer = () => ({
    caseId: '',
    record: null,
    species: 'DOG',
    pending: new Map(),
    saved: new Set(),
    foundAt: localNowValue(),
    location: '',
    description: '',
  });
  const dropFoundComposer = () => {
    if (!foundComposer) return;
    for (const item of foundComposer.pending.values()) URL.revokeObjectURL(item.url);
    foundComposer = null;
  };
  const foundComposerCount = () => foundComposer.pending.size + foundComposer.saved.size;
  const nextFoundSlot = () => {
    for (let index = 1; index <= FOUND_PHOTO_SLOT_MAX; index += 1) {
      if (!foundComposer.pending.has(index) && !foundComposer.saved.has(index)) return index;
    }
    return 0;
  };
  const uploadFoundSlot = async (slotIndex, file) => {
    await uploadFoundPetPhoto(sessionToken, foundComposer.caseId, slotIndex, file, FOUND_PHOTO_SEMANTIC_SLOT_CODES[slotIndex - 1] || '');
    foundComposer.saved.add(slotIndex);
    foundPhotos.set(foundComposer.caseId, [...foundComposer.saved].sort((a, b) => a - b));
  };
  const saveFoundDraft = async () => {
    if (!foundComposer.caseId) {
      const created = await createFoundPet(sessionToken, {
        requestId: `site.pet.found.${globalThis.crypto?.randomUUID?.() || Date.now().toString(36)}`,
        species: foundComposer.species,
        locationLabel: foundComposer.location,
        foundAt: isoFromLocal(foundComposer.foundAt),
        description: foundComposer.description,
      });
      foundComposer.caseId = created.caseId;
      foundComposer.record = created;
      foundCases = [created, ...foundCases.filter(item => item.caseId !== created.caseId)];
      foundPhotos.set(created.caseId, []);
    }
    for (const [slotIndex, item] of [...foundComposer.pending.entries()].sort((a, b) => a[0] - b[0])) {
      await uploadFoundSlot(slotIndex, item.file);
      URL.revokeObjectURL(item.url);
      foundComposer.pending.delete(slotIndex);
    }
  };
  const openFoundComposer = caseId => {
    dropFoundComposer();
    foundComposer = freshFoundComposer();
    const record = foundCases.find(item => item.caseId === caseId);
    if (!record || record.status !== 'ACTIVE' || record.reviewState !== 'DRAFT') return;
    foundComposer.caseId = record.caseId;
    foundComposer.record = record;
    foundComposer.species = record.species || 'DOG';
    foundComposer.location = record.locationLabel;
    foundComposer.description = record.description;
    foundComposer.saved = new Set(foundPhotos.get(record.caseId) || []);
  };

  const closeCaseButtons = (record, kind) => {
    const actions = el('div', 'pet-case-actions');
    const run = async resolved => {
      if (busy) return;
      setBusy(true);
      showError('');
      try {
        const closer = kind === 'sos' ? closePetSOS : closeFoundPet;
        const updated = await closer(sessionToken, record.caseId, resolved);
        if (kind === 'sos') {
          sosCases = sosCases.map(item => (item.caseId === updated.caseId ? updated : item));
          await refreshPetProfileData().catch(() => {});
          renderList();
          reportCount();
        } else {
          foundCases = foundCases.map(item => (item.caseId === updated.caseId ? updated : item));
          renderFound();
        }
        status.textContent = kind === 'sos' ? '실종 상태를 종료했습니다.' : '신고를 종료했습니다.';
      } catch (value) {
        showError(errorMessage(value, '신고를 종료하지 못했습니다.'), value);
      } finally {
        setBusy(false);
      }
    };
    const resolvedButton = el('button', 'site-button site-button-secondary',
      kind === 'sos' ? '실종 종료 · 돌아왔어요' : '보호자를 만났어요 (종료)');
    resolvedButton.type = 'button';
    resolvedButton.dataset.petCaseResolve = record.caseId;
    resolvedButton.addEventListener('click', () => void run(true));
    const cancelButton = el('button', 'pet-case-cancel', kind === 'sos' ? '실종 상태 취소' : '제보 취소');
    cancelButton.type = 'button';
    cancelButton.dataset.petCaseCancel = record.caseId;
    cancelButton.addEventListener('click', () => void run(false));
    actions.append(resolvedButton, cancelButton);
    return actions;
  };

  // The SOS form is opened from one pet's card and is about that pet only.
  const renderSos = () => {
    sosSection.replaceChildren(backToList());
    const pet = pets.find(item => item.petId === pendingSosPetId);
    if (!pet) {
      sosSection.appendChild(el('p', 'pet-empty-copy', '반려동물을 먼저 등록하면 실종 상태로 전환할 수 있습니다.'));
      return;
    }
    const header = el('div', 'pet-section-header');
    header.append(el('h3', 'pet-section-title', `${pet.name} 실종 상태로 전환`));
    sosSection.appendChild(header);
    if (sosCases.some(item => item.petId === pet.petId && item.status === 'ACTIVE')) {
      sosSection.appendChild(el('p', 'pet-empty-copy', '이미 실종 상태가 진행 중입니다. 목록의 카드에서 상태를 확인할 수 있습니다.'));
      return;
    }

    // Mirrors Core's own SOS gate (INCOMPLETE / EXPIRED identity photos), so
    // the owner learns the next step before filling in the form. Core still
    // decides; a refusal from Core lands in the form error below.
    const profile = petProfiles.get(pet.petId);
    const filled = photoCounts.get(pet.petId);
    const blockedReason = profile?.identityPhotoState === 'EXPIRED'
      ? '식별 사진 유효기간이 지나 실종 상태로 전환할 수 없습니다. 최신 사진으로 먼저 갱신해 주세요.'
      : ((profile?.identityPhotoState === 'INCOMPLETE' || (Number.isInteger(filled) && filled < PET_PHOTO_SLOT_CODES.length))
        ? '실종 상태로 전환하려면 식별 사진 10장을 먼저 등록해 주세요.'
        : '');
    if (blockedReason) {
      const blocked = el('div', 'pet-empty');
      blocked.dataset.petSosBlocked = profile?.identityPhotoState || 'INCOMPLETE';
      blocked.appendChild(el('p', 'pet-empty-title', blockedReason));
      const renew = el('button', 'site-button site-button-primary', '사진 갱신·관리');
      renew.type = 'button';
      renew.addEventListener('click', () => {
        pendingSosPetId = '';
        showSurface('pets');
        renderDetail(pet.petId);
        detailSection.scrollIntoView?.({block: 'start', behavior: 'smooth'});
      });
      blocked.appendChild(renew);
      sosSection.appendChild(blocked);
      return;
    }

    const form = el('form', 'pet-form');
    form.dataset.petSosForm = pet.petId;
    form.noValidate = true;
    const moment = momentField('실종 날짜·시간', localNowValue());
    moment.input.max = localNowValue();
    const place = textField('마지막으로 본 장소', 500, '예: 서울시 마포구 망원동 한강공원');
    const note = textField('당시 특징·기타 (선택)', 2000, '목줄, 옷, 당시 상황 등');
    const consent = el('label', 'pet-consent-toggle');
    const consentInput = el('input'); consentInput.type = 'checkbox'; consentInput.required = true;
    consent.append(consentInput, el('span', '', '활성 SOS 기간 동안만 등록 사진을 비공개 후보 검색에 사용하는 데 동의합니다.'));
    const formError = el('p', 'site-field-error');
    formError.setAttribute('role', 'alert');
    const submit = el('button', 'site-button site-button-primary', '동의하고 실종 상태로 전환');
    submit.type = 'submit';
    form.append(
      moment.field, place.field, note.field,
      el('p', 'pet-empty-copy', '실종 상태로 전환하면 동의한 사진으로 발견 제보와 비교합니다. AI가 같은 반려동물이라고 확정하지 않으며, 후보는 관리자가 검토한 뒤 보호자에게 확인을 요청합니다.'),
      consent, formError, submit,
    );

    let requestId = '';
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy) return;
      const lastSeenAt = isoFromLocal(moment.input.value);
      if (!lastSeenAt) {
        formError.textContent = '실종 날짜와 시간을 입력해 주세요.';
        return;
      }
      if (!place.input.value.trim()) {
        formError.textContent = '마지막으로 본 장소를 입력해 주세요.';
        place.input.focus();
        return;
      }
      if (!consentInput.checked) {
        formError.textContent = '활성 SOS 기간의 비공개 후보 검색 동의가 필요합니다.';
        return;
      }
      formError.textContent = '';
      setBusy(true);
      submit.disabled = true;
      requestId = requestId || `site.pet.sos.${globalThis.crypto?.randomUUID?.() || Date.now().toString(36)}`;
      try {
        const created = await createPetSOS(sessionToken, {
          requestId,
          petId: pet.petId,
          locationLabel: place.input.value,
          lastSeenAt,
          note: note.input.value,
          matchingConsentConfirmed: consentInput.checked,
        });
        requestId = '';
        pendingSosPetId = '';
        sosCases = [created, ...sosCases];
        await refreshPetProfileData().catch(() => {});
        showSurface('pets');
        renderList();
        reportCount();
        status.textContent = `${pet.name} 실종 상태로 전환했습니다.`;
      } catch (value) {
        formError.textContent = errorMessage(value, '실종 상태로 전환하지 못했습니다.');
        const code = errorCodeOf(value);
        if (code) formError.dataset.petErrorCode = code;
      } finally {
        submit.disabled = false;
        setBusy(false);
      }
    });
    sosSection.appendChild(form);
    queueMicrotask(() => place.input.focus());
  };

  const renderFound = () => {
    foundSection.replaceChildren(backToList());
    if (!foundComposer) foundComposer = freshFoundComposer();
    const composer = foundComposer;
    const locked = Boolean(composer.caseId);
    const box = el('div', 'pet-form safecare-found');
    box.dataset.petFoundComposer = composer.caseId || 'new';
    const header = el('div', 'pet-section-header');
    header.append(el('h3', 'pet-section-title', '반려동물 발견 제보'));
    box.append(
      header,
      el('p', 'pet-case-safety', '위험하게 가까이 접근하거나 붙잡아 사진을 찍지 마세요.'),
      el('p', 'pet-empty-copy', '즉시 일치 여부를 알려드리지 않습니다. 사진 5장 이상을 받은 뒤 실종 상태로 등록되고 동의된 반려동물과만 비교하고, 비교 후보는 관리자가 검토합니다.'),
    );

    const speciesField = el('fieldset', 'pet-choice-field');
    speciesField.appendChild(el('legend', '', '발견한 동물'));
    const speciesRow = el('div', 'pet-choice-row');
    for (const [value, icon] of [['DOG', '🐶'], ['CAT', '🐱']]) {
      const choice = el('label', 'pet-choice pet-draft-species-choice');
      const input = el('input');
      input.type = 'radio';
      input.name = 'found-species';
      input.value = value;
      input.checked = composer.species === value;
      input.disabled = locked;
      choice.append(input, el('span', 'pet-draft-species-icon', icon), el('span', '', petSpeciesLabel(value)));
      speciesRow.appendChild(choice);
    }
    speciesRow.addEventListener('change', () => {
      composer.species = speciesRow.querySelector('input:checked')?.value || 'DOG';
    });
    speciesField.appendChild(speciesRow);
    box.appendChild(speciesField);

    const count = foundComposerCount();
    const progress = foundPhotoProgress(count);
    const counter = el('div', 'safecare-photo-counter');
    counter.dataset.safecareFoundCount = String(progress.count);
    counter.append(el('strong', '', `사진 ${progress.count}장`), el('span', '', progress.message));
    const bar = el('div', 'safecare-progress safecare-progress-found');
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', String(FOUND_REPORT_MAX_PHOTOS));
    bar.setAttribute('aria-valuenow', String(progress.count));
    const fill = el('span', 'safecare-progress-fill');
    fill.style.width = `${progress.count * 10}%`;
    bar.append(fill, el('span', 'safecare-progress-mark', '5장'));
    box.append(counter, bar);

    const photoError = el('p', 'site-field-error');
    photoError.setAttribute('role', 'alert');
    const grid = el('div', 'safecare-slot-grid safecare-found-grid');
    grid.dataset.petFoundGrid = '';
    for (let slotIndex = 1; slotIndex <= FOUND_PHOTO_SLOT_MAX; slotIndex += 1) {
      const pending = composer.pending.get(slotIndex);
      const saved = composer.saved.has(slotIndex);
      if (!pending && !saved) continue;
      const tile = el('figure', 'safecare-slot');
      tile.dataset.safecareSlotFilled = 'true';
      tile.dataset.petFoundSlot = String(slotIndex);
      tile.dataset.petFoundSaved = saved ? 'true' : 'false';
      const media = el('div', 'safecare-slot-media');
      if (pending) {
        const image = el('img', 'safecare-slot-photo');
        image.src = pending.url;
        image.alt = `발견 사진 ${slotIndex}`;
        media.appendChild(image);
      } else {
        const key = previewKey(composer.caseId, `found-${slotIndex}`);
        const show = url => {
          const image = el('img', 'safecare-slot-photo');
          image.src = url;
          image.alt = `발견 사진 ${slotIndex}`;
          image.decoding = 'async';
          media.replaceChildren(image);
        };
        media.appendChild(el('span', 'safecare-slot-loading', '불러오는 중'));
        if (photoPreviews.has(key)) show(photoPreviews.get(key));
        else {
          void fetchFoundPetPhotoObjectUrl(sessionToken, composer.caseId, slotIndex).then(url => {
            photoPreviews.set(key, url);
            if (media.isConnected) show(url);
          }).catch(() => {
            const loading = media.querySelector('.safecare-slot-loading');
            if (loading) loading.textContent = '미리보기 실패';
          });
        }
      }
      const caption = el('figcaption', 'safecare-slot-caption');
      caption.append(el('span', 'safecare-slot-index', String(slotIndex)), el('span', 'safecare-slot-label', `발견 사진 ${slotIndex}`));
      const state = el('p', 'safecare-slot-hint', saved ? '서버에 저장됨' : '이 화면에만 보관 중');
      const remove = el('button', 'pet-slot-remove', '삭제');
      remove.type = 'button';
      remove.setAttribute('aria-label', `발견 사진 ${slotIndex} 삭제`);
      remove.addEventListener('click', async () => {
        if (busy) return;
        if (pending) {
          URL.revokeObjectURL(pending.url);
          composer.pending.delete(slotIndex);
          renderFound();
          return;
        }
        setBusy(true);
        try {
          await deleteFoundPetPhoto(sessionToken, composer.caseId, slotIndex);
          composer.saved.delete(slotIndex);
          foundPhotos.set(composer.caseId, [...composer.saved].sort((a, b) => a - b));
          revokePreview(previewKey(composer.caseId, `found-${slotIndex}`));
          renderFound();
        } catch (value) {
          photoError.textContent = errorMessage(value, '사진을 삭제하지 못했습니다.');
        } finally {
          setBusy(false);
        }
      });
      tile.append(media, caption, state, remove);
      grid.appendChild(tile);
    }
    const input = el('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png';
    input.hidden = true;
    input.dataset.petFoundInput = '';
    const add = el('button', 'site-button site-button-secondary safecare-add-photo', progress.count === 0 ? '사진 선택으로 작성 시작' : '사진 추가');
    add.type = 'button';
    add.disabled = !progress.canAdd;
    add.dataset.petFoundAdd = '';
    add.addEventListener('click', () => {
      if (!busy && progress.canAdd) input.click();
    });
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.value = '';
      if (!file || busy) return;
      const rejection = petPhotoRejection(file);
      if (rejection) {
        photoError.textContent = rejection;
        return;
      }
      const slotIndex = nextFoundSlot();
      if (!slotIndex) return;
      photoError.textContent = '';
      if (!composer.caseId) {
        composer.pending.set(slotIndex, {file, url: URL.createObjectURL(file)});
        renderFound();
        return;
      }
      setBusy(true);
      try {
        await uploadFoundSlot(slotIndex, file);
        status.textContent = '사진을 안전하게 저장했습니다.';
        renderFound();
      } catch (value) {
        photoError.textContent = errorMessage(value, '사진을 첨부하지 못했습니다.');
      } finally {
        setBusy(false);
      }
    });
    box.append(grid, input, add, photoError);

    const details = el('fieldset', 'safecare-found-details');
    details.appendChild(el('legend', '', '발견 정보'));
    const moment = momentField('발견 날짜·시간', composer.record?.occurredAt ? localNowValue(new Date(composer.record.occurredAt)) : composer.foundAt);
    moment.input.max = localNowValue();
    moment.input.disabled = locked;
    moment.input.addEventListener('input', () => { composer.foundAt = moment.input.value; });
    const place = textField('발견 장소', 500, '예: 성남시 분당구 정자동 느티마을 앞');
    place.input.value = composer.location;
    place.input.disabled = locked;
    const description = textField('외형·특징 (선택)', 3000, '털색, 목줄, 몸집 등');
    description.input.value = composer.description;
    description.input.disabled = locked;
    description.input.addEventListener('input', () => { composer.description = description.input.value; });
    details.append(moment.field, place.field, description.field, el(
      'p',
      'pet-field-hint',
      locked
        ? '작성 중 저장된 제보입니다. 발견 정보는 저장 후 바꿀 수 없습니다.'
        : '발견 정보를 입력하고 "작성 중 저장"을 누르면 사진이 서버의 작성 중 제보로 저장됩니다. 저장 전에는 이 화면을 닫으면 사진이 사라집니다.',
    ));
    box.appendChild(details);

    const formError = el('p', 'site-field-error');
    formError.setAttribute('role', 'alert');
    const detailsReady = () => Boolean(isoFromLocal(composer.foundAt) && composer.location.trim());
    const actions = el('div', 'pet-draft-actions safecare-wizard-actions');
    const draftButton = el('button', 'site-button site-button-secondary', '작성 중 저장');
    draftButton.type = 'button';
    draftButton.dataset.petFoundDraft = '';
    draftButton.hidden = locked || count === 0;
    draftButton.disabled = !composer.location.trim();
    place.input.addEventListener('input', () => {
      composer.location = place.input.value;
      draftButton.disabled = !composer.location.trim();
    });
    draftButton.addEventListener('click', async () => {
      if (busy) return;
      if (!detailsReady()) {
        formError.textContent = '발견 날짜·시간과 장소를 입력해 주세요.';
        return;
      }
      setBusy(true);
      formError.textContent = '';
      try {
        await saveFoundDraft();
        status.textContent = '작성 중 제보를 저장했습니다.';
        renderFound();
      } catch (value) {
        formError.textContent = errorMessage(value, '작성 중 제보를 저장하지 못했습니다.');
      } finally {
        setBusy(false);
      }
    });
    const submit = el('button', 'site-button site-button-primary', '최종 제출');
    submit.type = 'button';
    submit.dataset.petFoundSubmit = '';
    submit.disabled = !progress.canSubmit;
    submit.setAttribute('aria-disabled', progress.canSubmit ? 'false' : 'true');
    submit.addEventListener('click', async () => {
      if (busy || !progress.canSubmit) return;
      if (!detailsReady()) {
        formError.textContent = '발견 날짜·시간과 장소를 입력해 주세요.';
        place.input.focus();
        return;
      }
      setBusy(true);
      formError.textContent = '';
      try {
        await saveFoundDraft();
        const updated = await submitFoundPet(sessionToken, composer.caseId);
        foundCases = foundCases.map(item => (item.caseId === updated.caseId ? updated : item));
        dropFoundComposer();
        status.textContent = foundReviewStateCopy(updated.reviewState).detail;
        renderFound();
      } catch (value) {
        formError.textContent = errorMessage(value, '제보를 제출하지 못했습니다.');
        const code = errorCodeOf(value);
        if (code) formError.dataset.petErrorCode = code;
      } finally {
        setBusy(false);
      }
    });
    actions.append(draftButton, submit);
    if (!progress.canSubmit) {
      actions.appendChild(el('span', 'pet-field-hint safecare-submit-hint', `최종 제출은 사진 5장부터 가능합니다.${progress.needed ? ` (${progress.needed}장 더 필요)` : ''}`));
    }
    box.append(formError, actions);
    foundSection.appendChild(box);

    const mine = foundCases.filter(item => item.caseId !== composer.caseId);
    if (mine.length) {
      const history = el('section', 'safecare-report-list');
      history.dataset.petFoundHistory = '';
      history.appendChild(el('h4', 'pet-section-title', '내 발견 제보'));
      for (const record of mine) {
        const copy = foundReviewStateCopy(record.reviewState);
        const card = el('article', 'pet-case-card safecare-report');
        card.dataset.petCase = record.caseId;
        card.dataset.petCaseStatus = record.status;
        card.dataset.safecareReviewState = record.reviewState || '';
        const head = el('div', 'pet-card-head');
        head.append(
          el('h4', 'pet-card-name', `${petSpeciesLabel(record.species) || '동물'} · ${record.locationLabel || '발견 제보'}`),
          el('span', `safecare-badge safecare-badge-${record.status === 'ACTIVE' ? copy.tone : 'neutral'}`, record.status === 'ACTIVE' ? copy.label : caseStatusLabel(record.status)),
        );
        card.appendChild(head);
        const photoTotal = (foundPhotos.get(record.caseId) || []).length;
        card.appendChild(el('p', 'pet-case-line', `${displayMoment(record.occurredAt)} · 사진 ${photoTotal}장`));
        if (record.status === 'ACTIVE') card.appendChild(el('p', 'pet-empty-copy', copy.detail));
        if (record.status === 'ACTIVE' && record.reviewState === 'DRAFT') {
          const resume = el('button', 'site-button site-button-secondary', '이어서 작성');
          resume.type = 'button';
          resume.dataset.petFoundResume = record.caseId;
          resume.addEventListener('click', () => {
            openFoundComposer(record.caseId);
            renderFound();
          });
          card.appendChild(resume);
        }
        if (record.status === 'ACTIVE') card.appendChild(closeCaseButtons(record, 'found'));
        history.appendChild(card);
      }
      foundSection.appendChild(history);
    }
  };

  // SAFECARE-WEB-UI-REDESIGN-01 — registration reads 기본정보 → 사진 10장 →
  // 최종 확인 → 등록 완료, the same order as the person screen.
  //
  // Core's draft keeps its own current_step, and PHOTOS -> BASIC stays Core's
  // server-side photo gate: the screen only asks for that move once all ten
  // photos have passed inspection, and finalize re-validates every required
  // field and photo regardless.
  //
  // PET-REGISTER-BASIC-FIRST-01 — the same screen as the person registration:
  // the list and the found CTA step aside, "← 목록으로" leads back, and every
  // open, a resumed draft included, starts at 1단계 기본정보 with what was saved
  // filled in. "다음" from there continues to wherever the draft actually is.
  // The draft keeps autosaving, so going back to the list loses nothing and
  // the list button reads "등록 계속".
  const renderRegisterForm = async () => {
    registering = true;
    showSurface('pets');
    addButton.hidden = true;
    detailSection.hidden = false;
    detailSection.replaceChildren();

    // Inspection runs after the upload responds, so a PENDING row needs a
    // second look to ever become ACCEPTED/REJECTED on screen without the
    // owner reloading the page. Only runs while the PHOTOS step is showing
    // and only while a row is actually waiting; stops itself otherwise.
    let draftPollTimer = 0;
    const stopPoll = () => {
      clearTimeout(draftPollTimer);
      draftPollTimer = 0;
    };
    const leaveRegister = () => {
      stopPoll();
      registering = false;
      detailSection.hidden = true;
      detailSection.replaceChildren();
      addButton.hidden = false;
      showSurface('pets');
      listSection.scrollIntoView?.({block: 'start', behavior: 'smooth'});
    };
    const back = el('button', 'site-button site-button-secondary', '← 목록으로');
    back.type = 'button';
    back.dataset.petRegisterBack = '';
    back.addEventListener('click', () => {
      leaveRegister();
      addButton.focus();
    });
    const backBar = el('div', 'safecare-back');
    backBar.appendChild(back);
    const body = el('div', 'pet-draft-body');
    detailSection.append(backBar, body);
    detailSection.scrollIntoView?.({block: 'start', behavior: 'smooth'});

    const renderLoading = copy => body.replaceChildren(el('p', 'pet-empty-copy', copy));
    renderLoading('저장된 등록 초안을 확인하는 중입니다.');
    showError('');
    try {
      catalog = catalog || await getPetCatalog();
      registrationDraft = registrationDraft || await getActivePetRegistrationDraft(sessionToken);
      registrationDraft = registrationDraft || await createPetRegistrationDraft(sessionToken);
      addButton.textContent = '등록 계속';
    } catch (value) {
      body.replaceChildren(el('p', 'site-field-error', errorMessage(value, '반려동물 등록을 시작하지 못했습니다.')));
      addButton.hidden = false;
      return;
    }

    const stepCodes = Object.freeze(['BASIC', 'PHOTOS', 'REVIEW', 'DONE']);
    const stepNames = Object.freeze({BASIC: '기본정보', PHOTOS: '사진 10장', REVIEW: '최종 확인', DONE: '등록 완료'});
    let screenStep = 'BASIC';
    let finalizeRequestId = '';
    let autosaveTimer = 0;

    const schedulePoll = () => {
      stopPoll();
      if (petDraftPhotoProgression(registrationDraft).pendingSlots.length === 0) return;
      draftPollTimer = setTimeout(async () => {
        if (!body.isConnected || busy) {
          schedulePoll();
          return;
        }
        try {
          registrationDraft = await getActivePetRegistrationDraft(sessionToken) || registrationDraft;
          if (screenStep === 'PHOTOS') renderDraftPhotos();
        } catch {
          // A refresh failure is not a save failure; try again on the same clock.
          schedulePoll();
        }
      }, 4000);
    };

    const replaceDraftPhoto = photo => {
      const photos = registrationDraft.photos.filter(item => item.slotCode !== photo.slotCode);
      registrationDraft = Object.freeze({...registrationDraft, photos: Object.freeze([...photos, photo])});
    };

    const saveDraft = async updates => {
      registrationDraft = await updatePetRegistrationDraft(
        sessionToken,
        registrationDraft.draftId,
        updates,
      );
      status.textContent = '등록 초안을 저장했습니다.';
      return registrationDraft;
    };

    const scheduleAutosave = producer => {
      clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(async () => {
        if (busy || !detailSection.isConnected) return;
        try {
          await saveDraft(producer());
        } catch (value) {
          showError(errorMessage(value, '등록 초안을 자동 저장하지 못했습니다.'), value);
        }
      }, 500);
    };

    // PET-REGISTER-BASIC-FIRST-01: the person screen's stepper (shared
    // safecare-step* styles), so both registrations read the same.
    const stepChrome = step => {
      const activeIndex = Math.max(0, stepCodes.indexOf(step));
      const label = el(
        'p',
        'safecare-step-label',
        `반려동물 등록 ${activeIndex + 1}단계 / ${stepCodes.length}단계 · ${stepNames[step]}`,
      );
      label.dataset.petDraftProgress = '';
      const progress = el('ol', 'safecare-steps');
      progress.setAttribute('aria-label', '등록 단계');
      stepCodes.forEach((code, index) => {
        const complete = index < activeIndex;
        const item = el('li', 'safecare-step');
        item.dataset.petDraftStep = code;
        item.dataset.petDraftStepActive = code === step ? 'true' : 'false';
        item.dataset.petDraftStepComplete = complete ? 'true' : 'false';
        item.dataset.safecareStepState = complete ? 'done' : code === step ? 'active' : 'todo';
        if (code === step) item.setAttribute('aria-current', 'step');
        item.append(
          el('span', 'safecare-step-number', complete ? '✓' : String(index + 1)),
          el('span', 'safecare-step-name', stepNames[code]),
        );
        progress.appendChild(item);
      });
      const stepper = el('div', 'safecare-stepper');
      stepper.append(label, progress);
      body.appendChild(stepper);
    };

    const formError = () => {
      const node = el('p', 'site-field-error');
      node.setAttribute('role', 'alert');
      return node;
    };

    const goToStep = step => {
      screenStep = step;
      renderStep();
      detailSection.scrollIntoView?.({block: 'start', behavior: 'smooth'});
    };

    // ------------------------------------------------- 1단계 · 기본정보
    const renderBasic = () => {
      body.replaceChildren();
      stepChrome('BASIC');
      body.append(
        el('h4', 'pet-draft-title', '기본정보를 알려 주세요'),
        el('p', 'pet-empty-copy', '강아지인지 고양이인지 먼저 선택해 주세요. 선택한 동물에 맞는 촬영 안내를 다음 단계에서 보여드립니다.'),
      );
      const form = el('form', 'pet-form');
      form.dataset.petRegisterForm = '';
      form.noValidate = true;

      let species = ['DOG', 'CAT'].includes(registrationDraft.species) ? registrationDraft.species : '';
      const speciesAtOpen = species;
      const speciesField = el('fieldset', 'pet-choice-field pet-draft-species-field');
      speciesField.appendChild(el('legend', '', '등록할 반려동물'));
      const speciesRow = el('div', 'pet-choice-row');
      for (const [value, icon, label] of [['DOG', '🐶', '강아지'], ['CAT', '🐱', '고양이']]) {
        const choice = el('label', 'pet-choice pet-draft-species-choice');
        const input = el('input');
        input.type = 'radio';
        input.name = 'pet-species';
        input.value = value;
        input.checked = species === value;
        choice.append(input, el('span', 'pet-draft-species-icon', icon), el('span', '', label));
        speciesRow.appendChild(choice);
      }
      speciesField.appendChild(speciesRow);

      const nameField = el('label', 'site-field', '이름');
      const nameInput = el('input');
      nameInput.type = 'text';
      nameInput.maxLength = 120;
      nameInput.autocomplete = 'off';
      nameInput.value = registrationDraft.name;
      nameField.appendChild(nameInput);

      const sexField = el('fieldset', 'pet-choice-field');
      sexField.appendChild(el('legend', '', '성별'));
      const sexRow = el('div', 'pet-choice-row');
      for (const [value, label] of [['MALE', '수컷'], ['FEMALE', '암컷'], ['UNKNOWN', '모름']]) {
        const choice = el('label', 'pet-choice');
        const input = el('input');
        input.type = 'radio';
        input.name = 'pet-sex';
        input.value = value;
        input.checked = registrationDraft.sex === value;
        choice.append(input, el('span', '', label));
        sexRow.appendChild(choice);
      }
      sexField.appendChild(sexRow);

      const breedField = el('label', 'site-field', '품종');
      const breedSelect = el('select');
      breedField.appendChild(breedSelect);
      const breedOtherField = el('label', 'site-field', '기타 품종 이름');
      const breedOtherInput = el('input');
      breedOtherInput.type = 'text';
      breedOtherInput.maxLength = 120;
      breedOtherInput.value = registrationDraft.breed;
      breedOtherField.appendChild(breedOtherInput);
      breedOtherField.hidden = true;
      const populateBreeds = () => {
        breedSelect.replaceChildren();
        const placeholder = el('option', '', species ? '품종을 선택해 주세요' : '강아지 또는 고양이를 먼저 선택해 주세요');
        placeholder.value = '';
        breedSelect.appendChild(placeholder);
        for (const item of catalog.breeds[species] || []) {
          const option = el('option', '', item.displayName);
          option.value = item.code;
          option.selected = registrationDraft.breedCode === item.code;
          breedSelect.appendChild(option);
        }
        breedSelect.disabled = !species;
        breedOtherField.hidden = !['OTHER_DOG', 'OTHER_CAT'].includes(breedSelect.value);
      };
      populateBreeds();

      // 나이: 생년월일 / 추정 나이 / 모름 — all three are stored by Core.
      const ageField = el('fieldset', 'pet-choice-field');
      ageField.appendChild(el('legend', '', '나이'));
      const ageRow = el('div', 'pet-choice-row');
      const initialAgeMode = registrationDraft.birthDate
        ? 'BIRTH_DATE'
        : (Number.isInteger(registrationDraft.approximateAgeMonths) ? 'ESTIMATED' : 'UNKNOWN');
      for (const [value, label] of [['BIRTH_DATE', '생년월일'], ['ESTIMATED', '추정 나이'], ['UNKNOWN', '모름']]) {
        const choice = el('label', 'pet-choice');
        const input = el('input');
        input.type = 'radio';
        input.name = 'pet-age-mode';
        input.value = value;
        input.checked = initialAgeMode === value;
        choice.append(input, el('span', '', label));
        ageRow.appendChild(choice);
      }
      ageField.appendChild(ageRow);
      const birthField = el('label', 'site-field', '생년월일');
      const birthInput = el('input');
      birthInput.type = 'date';
      birthInput.max = new Date().toISOString().slice(0, 10);
      birthInput.value = registrationDraft.birthDate;
      birthField.appendChild(birthInput);
      const estimateField = el('label', 'site-field', '추정 나이 (개월)');
      const estimateInput = el('input');
      estimateInput.type = 'number';
      estimateInput.min = '0';
      estimateInput.max = '600';
      estimateInput.inputMode = 'numeric';
      estimateInput.value = Number.isInteger(registrationDraft.approximateAgeMonths)
        ? String(registrationDraft.approximateAgeMonths)
        : '';
      estimateField.appendChild(estimateInput);
      const syncAgeFields = () => {
        const mode = ageRow.querySelector('input:checked')?.value || 'UNKNOWN';
        birthField.hidden = mode !== 'BIRTH_DATE';
        estimateField.hidden = mode !== 'ESTIMATED';
      };
      ageRow.addEventListener('change', syncAgeFields);
      syncAgeFields();

      const familyField = el('label', 'site-field', '가족이 된 날 (선택)');
      const familyInput = el('input');
      familyInput.type = 'date';
      familyInput.max = new Date().toISOString().slice(0, 10);
      familyInput.value = registrationDraft.familyDate;
      familyField.appendChild(familyInput);

      // Everything else Core stores, kept one tap away so the first step stays short.
      const extra = el('details', 'pet-draft-extra');
      extra.appendChild(el('summary', '', '추가 정보 (선택) · 털색, 무늬, 특징, 동물등록번호'));
      const colorsField = el('fieldset', 'pet-choice-field');
      colorsField.appendChild(el('legend', '', '털색 (여러 개 선택 가능)'));
      const colors = el('div', 'pet-choice-row');
      for (const item of catalog.colors) {
        const choice = el('label', 'pet-choice');
        const input = el('input');
        input.type = 'checkbox';
        input.name = 'pet-color';
        input.value = item.code;
        input.checked = registrationDraft.colorCodes.includes(item.code);
        choice.append(input, el('span', '', item.displayName));
        colors.appendChild(choice);
      }
      colorsField.appendChild(colors);
      const colorOtherField = el('label', 'site-field', '기타 털색');
      const colorOtherInput = el('input');
      colorOtherInput.type = 'text';
      colorOtherInput.maxLength = 120;
      colorOtherInput.value = registrationDraft.colorOther;
      colorOtherField.appendChild(colorOtherInput);
      const syncColorOther = () => {
        colorOtherField.hidden = !colors.querySelector('input[value="OTHER"]')?.checked;
      };
      colors.addEventListener('change', syncColorOther);
      syncColorOther();
      const patternField = el('label', 'site-field', '털 무늬');
      const patternSelect = el('select');
      const patternOtherField = el('label', 'site-field', '기타 무늬');
      const patternOtherInput = el('input');
      patternOtherInput.type = 'text';
      patternOtherInput.maxLength = 120;
      patternOtherInput.value = registrationDraft.coatPatternOther;
      patternOtherField.appendChild(patternOtherInput);
      const populatePatterns = () => {
        patternSelect.replaceChildren();
        const noPattern = el('option', '', '선택 안 함');
        noPattern.value = '';
        patternSelect.appendChild(noPattern);
        for (const item of catalog.patterns.filter(row => !row.species || row.species === species)) {
          const option = el('option', '', item.displayName);
          option.value = item.code;
          option.selected = registrationDraft.coatPatternCode === item.code;
          patternSelect.appendChild(option);
        }
        patternOtherField.hidden = patternSelect.value !== 'OTHER';
      };
      patternField.appendChild(patternSelect);
      populatePatterns();
      patternSelect.addEventListener('change', () => {
        patternOtherField.hidden = patternSelect.value !== 'OTHER';
      });
      const marksField = el('label', 'site-field', '눈에 띄는 특징');
      const marksInput = el('textarea');
      marksInput.maxLength = 2000;
      marksInput.value = registrationDraft.distinctiveMarks;
      marksField.appendChild(marksInput);
      const registrationField = el('label', 'site-field', `${OFFICIAL_REGISTRATION_LABEL} (선택)`);
      const registrationInput = el('input');
      registrationInput.type = 'text';
      registrationInput.maxLength = 120;
      registrationInput.autocomplete = 'off';
      registrationInput.placeholder = '없으면 비워 두세요';
      registrationInput.value = registrationDraft.officialRegistrationNumber;
      registrationField.appendChild(registrationInput);
      const registrationHint = el(
        'p',
        'pet-field-hint',
        '동물보호법에 따라 국가 시스템에서 발급하는 번호입니다. 롯비가 발급하지 않습니다. '
        + '없으면 비워 두셔도 등록됩니다. 민감정보라 목록에는 표시하지 않고 상세에서만 가려서 보여줍니다.',
      );
      extra.append(colorsField, colorOtherField, patternField, patternOtherField, marksField, registrationField, registrationHint);
      if (registrationDraft.colorCodes.length || registrationDraft.coatPatternCode || registrationDraft.distinctiveMarks || registrationDraft.officialRegistrationNumber) {
        extra.open = true;
      }

      speciesRow.addEventListener('change', () => {
        const next = speciesRow.querySelector('input:checked')?.value || '';
        if (!next || next === species) return;
        const changed = Boolean(species);
        species = next;
        populateBreeds();
        populatePatterns();
        scheduleAutosave(() => ({species, ...(changed ? {breed_code: null, breed: null} : {})}));
      });
      breedSelect.addEventListener('change', () => {
        breedOtherField.hidden = !['OTHER_DOG', 'OTHER_CAT'].includes(breedSelect.value);
        scheduleAutosave(() => ({species, breed_code: breedSelect.value || null}));
      });
      nameInput.addEventListener('input', () => scheduleAutosave(() => ({name: nameInput.value.trim() || null})));
      sexRow.addEventListener('change', () => scheduleAutosave(() => ({sex: sexRow.querySelector('input:checked')?.value || null})));
      breedOtherInput.addEventListener('input', () => scheduleAutosave(() => ({breed: breedOtherInput.value.trim() || null})));

      const error = formError();
      const actions = el('div', 'pet-draft-actions');
      const next = el('button', 'site-button site-button-primary', '다음: 사진 10장 등록');
      next.type = 'submit';
      next.dataset.petDraftNext = 'PHOTOS';
      actions.append(next);
      form.append(
        speciesField, nameField, sexField, breedField, breedOtherField, ageField, birthField, estimateField,
        familyField, extra, el('p', 'pet-consent-copy', MATCHING_CONSENT_COPY), error, actions,
      );
      form.addEventListener('submit', async event => {
        event.preventDefault();
        if (busy) return;
        const sex = sexRow.querySelector('input:checked')?.value || '';
        const ageMode = ageRow.querySelector('input:checked')?.value || 'UNKNOWN';
        const colorCodes = [...colors.querySelectorAll('input:checked')].map(input => input.value);
        if (!species) {
          error.textContent = '강아지 또는 고양이를 선택해 주세요.';
          return;
        }
        if (!nameInput.value.trim()) {
          error.textContent = '이름을 입력해 주세요.';
          nameInput.focus();
          return;
        }
        if (!sex) {
          error.textContent = '성별을 선택해 주세요. 모르면 ‘모름’을 선택할 수 있습니다.';
          return;
        }
        if (!breedSelect.value) {
          error.textContent = '품종을 선택해 주세요. 모르면 ‘잘 모르겠어요’를 선택할 수 있습니다.';
          breedSelect.focus();
          return;
        }
        if (['OTHER_DOG', 'OTHER_CAT'].includes(breedSelect.value) && !breedOtherInput.value.trim()) {
          error.textContent = '기타 품종 이름을 입력해 주세요.';
          breedOtherInput.focus();
          return;
        }
        if (ageMode === 'BIRTH_DATE' && !birthInput.value) {
          error.textContent = '생년월일을 입력해 주세요.';
          birthInput.focus();
          return;
        }
        if (ageMode === 'ESTIMATED' && estimateInput.value === '') {
          error.textContent = '추정 나이를 개월 수로 입력해 주세요.';
          estimateInput.focus();
          return;
        }
        if (colorCodes.includes('OTHER') && !colorOtherInput.value.trim()) {
          extra.open = true;
          error.textContent = '기타 털색을 입력해 주세요.';
          colorOtherInput.focus();
          return;
        }
        if (patternSelect.value === 'OTHER' && !patternOtherInput.value.trim()) {
          extra.open = true;
          error.textContent = '기타 무늬를 입력해 주세요.';
          patternOtherInput.focus();
          return;
        }
        const updates = {
          name: nameInput.value.trim(),
          species,
          sex,
          breed_code: breedSelect.value,
          breed: breedOtherInput.value.trim() || null,
          age_mode: ageMode,
          family_date: familyInput.value || null,
          color_codes: colorCodes,
          color_other: colorOtherInput.value.trim() || null,
          coat_pattern_code: patternSelect.value || null,
          coat_pattern_other: patternOtherInput.value.trim() || null,
          distinctive_marks: marksInput.value.trim() || null,
          official_registration_number: registrationInput.value.trim() || null,
          matching_consent: false,
          matching_consent_version: null,
        };
        // Core re-inspects every photo for a new species, so a species change
        // after the photo gate sends the owner back through the photo step.
        if (speciesAtOpen && speciesAtOpen !== species && registrationDraft.currentStep !== 'PHOTOS') updates.current_step = 'PHOTOS';
        if (ageMode === 'BIRTH_DATE') updates.birth_date = birthInput.value;
        if (ageMode === 'ESTIMATED') {
          updates.approximate_age_months = Number(estimateInput.value);
          updates.age_estimate_as_of = new Date().toISOString().slice(0, 10);
        }
        clearTimeout(autosaveTimer);
        openSafeCareRenewalNotice({
          kind: 'pet',
          onConfirm: async () => {
            setBusy(true);
            try {
              await saveDraft(updates);
              goToStep(registrationDraft.currentStep === 'PHOTOS' ? 'PHOTOS' : 'REVIEW');
            } catch (value) {
              const message = errorMessage(value, '기본정보를 저장하지 못했습니다.');
              error.textContent = message;
              throw new Error(message);
            } finally {
              setBusy(false);
            }
          },
        });
      });
      body.appendChild(form);
      queueMicrotask(() => { if (species) nameInput.focus(); });
    };

    // ------------------------------------------------ 2단계 · 사진 10장
    const renderDraftPhotos = () => {
      body.replaceChildren();
      stepChrome('PHOTOS');
      body.append(
        el('h4', 'pet-draft-title', `${petSpeciesLabel(registrationDraft.species)} 식별 사진 10장을 등록해 주세요`),
        petPhotoGuide(registrationDraft.species),
      );
      const photosBySlot = new Map(registrationDraft.photos.map(photo => [photo.slotCode, photo]));
      const progression = petDraftPhotoProgression(registrationDraft);
      const presence = identityPhotoProgress(progression.presentCount);
      const count = el(
        'p',
        'pet-photo-count safecare-photo-counter',
        `${presence.label} · ${presence.remainingLabel} · 확인 완료 ${progression.acceptedCount}/${progression.requiredCount}`,
      );
      count.dataset.safecarePhotoCount = String(presence.count);
      const faceFrontConfirmed = petDraftFaceFrontConfirmed(registrationDraft, photosBySlot.get('FACE_FRONT'));
      // PET-PHOTO-SEQUENTIAL-01 — the ten slots open one at a time in the
      // order shown: 1번 얼굴 정면 first (Core's anchor gate), then each slot
      // once the one before it holds a photo that did not fail inspection.
      // A slot that already holds a photo stays open so it can be replaced or
      // deleted. Dog and cat use the same order.
      const slotOpen = PET_PHOTO_DISPLAY_ORDER.map((slotCode, index) => {
        if (index === 0) return true;
        if (!faceFrontConfirmed) return false;
        if (photosBySlot.has(slotCode)) return true;
        const previous = photosBySlot.get(PET_PHOTO_DISPLAY_ORDER[index - 1]);
        return Boolean(previous) && previous.inspectionState !== 'REJECTED';
      });
      const nextIndex = PET_PHOTO_DISPLAY_ORDER.findIndex(
        (slotCode, index) => slotOpen[index] && !photosBySlot.has(slotCode),
      );
      let gateCopy = '먼저 얼굴 정면 사진을 확인해 주세요. 확인이 끝나면 2번부터 한 장씩 순서대로 열려요.';
      if (faceFrontConfirmed && nextIndex >= 0) {
        gateCopy = `이제 ${nextIndex + 1}번 ${petPhotoSlotLabel(PET_PHOTO_DISPLAY_ORDER[nextIndex])} 사진을 올려 주세요. 한 장을 올리면 다음 칸이 열려요.`;
      } else if (faceFrontConfirmed && photosBySlot.size < PET_PHOTO_DISPLAY_ORDER.length) {
        gateCopy = '확인을 통과하지 못한 사진을 다시 찍어 교체하면 다음 칸이 열려요.';
      } else if (faceFrontConfirmed) {
        gateCopy = '10칸을 모두 채웠어요. 사진 확인이 끝나면 다음 단계로 넘어갈 수 있어요.';
      }
      const gateBanner = el('p', 'pet-draft-gate-banner', gateCopy);
      gateBanner.setAttribute('aria-live', 'polite');
      body.append(count, gateBanner, el('p', 'pet-empty-copy', draftPhotoProgressMessage(progression)));
      const grid = el('div', 'pet-slot-grid');
      grid.dataset.petDraftSlotGrid = '';

      PET_PHOTO_DISPLAY_ORDER.forEach((slotCode, index) => {
        const photo = photosBySlot.get(slotCode);
        const locked = !slotOpen[index];
        const tile = el('figure', 'pet-slot');
        tile.dataset.petDraftSlot = slotCode;
        tile.dataset.petSlotFilled = photo ? 'true' : 'false';
        tile.dataset.petPhotoInspection = photo?.inspectionState || '';
        tile.dataset.petDraftSlotLocked = locked ? 'true' : 'false';
        const media = el('div', 'pet-slot-media');
        const key = previewKey(registrationDraft.draftId, slotCode);
        const cached = photoPreviews.get(key);
        if (cached) {
          const image = el('img', 'pet-slot-photo');
          image.src = cached;
          image.alt = `${petPhotoSlotLabel(slotCode)} 등록 사진`;
          media.appendChild(image);
        } else {
          const artwork = petPhotoSlotArtwork(slotCode, registrationDraft.species);
          if (artwork) media.appendChild(artwork);
        }
        tile.appendChild(media);
        const caption = el('figcaption', 'pet-slot-caption');
        caption.append(el('span', 'pet-slot-index', String(index + 1)), el('span', 'pet-slot-label', petPhotoSlotLabel(slotCode)));
        tile.append(caption, el('p', 'pet-slot-hint', petPhotoSlotHint(slotCode)));
        // Always present so an in-flight upload can write into it without a
        // full rebuild of this one tile; empty and hidden until there is
        // something to say.
        const stateNode = el('p', 'pet-draft-photo-state');
        stateNode.setAttribute('role', 'status');
        stateNode.hidden = true;
        if (photo) {
          stateNode.hidden = false;
          stateNode.classList.add(`pet-draft-photo-state-${photo.inspectionState.toLowerCase()}`);
          stateNode.textContent = petDraftPhotoInspectionMessage(photo);
        }
        tile.appendChild(stateNode);
        if (locked) {
          const previousSlot = PET_PHOTO_DISPLAY_ORDER[index - 1];
          const previous = photosBySlot.get(previousSlot);
          let lockCopy = '얼굴 정면 사진이 확인되면 선택할 수 있어요.';
          if (faceFrontConfirmed) {
            lockCopy = previous?.inspectionState === 'REJECTED'
              ? `${index}번 ${petPhotoSlotLabel(previousSlot)} 사진을 다시 찍어 교체하면 열려요.`
              : `${index}번 ${petPhotoSlotLabel(previousSlot)} 사진을 올리면 열려요.`;
          }
          tile.appendChild(el('p', 'pet-draft-photo-locked-hint', lockCopy));
        }
        const slotError = formError();
        slotError.hidden = true;
        const sourceInputs = buildPetPhotoSourceInputs();
        const actions = el('div', 'pet-slot-actions');
        const choose = el('button', 'site-button site-button-secondary', photo ? '다른 사진 선택' : '사진 선택');
        choose.type = 'button';
        choose.disabled = locked;
        choose.setAttribute('aria-disabled', locked ? 'true' : 'false');
        choose.addEventListener('click', () => {
          if (locked) return;
          openPetPhotoSource(sourceInputs);
        });
        actions.appendChild(choose);
        if (photo) {
          const remove = el('button', 'pet-slot-remove', '삭제');
          remove.type = 'button';
          remove.disabled = locked;
          remove.setAttribute('aria-disabled', locked ? 'true' : 'false');
          remove.addEventListener('click', async () => {
            if (busy || locked) return;
            setBusy(true);
            try {
              await deletePetRegistrationDraftPhoto(sessionToken, registrationDraft.draftId, slotCode);
              registrationDraft = Object.freeze({
                ...registrationDraft,
                photos: Object.freeze(registrationDraft.photos.filter(item => item.slotCode !== slotCode)),
              });
              revokePreview(key);
              renderDraftPhotos();
            } catch (value) {
              slotError.textContent = errorMessage(value, '초안 사진을 삭제하지 못했습니다.');
              slotError.hidden = false;
            } finally {
              setBusy(false);
            }
          });
          actions.appendChild(remove);
        }
        const handleChosenFile = async file => {
          if (busy || locked) return;
          const rejection = petPhotoRejection(file);
          if (rejection) {
            slotError.textContent = rejection;
            slotError.hidden = false;
            return;
          }
          const localLook = await inspectPetPhotoLocally(file);
          if (localLook) {
            slotError.textContent = localLook.message;
            slotError.hidden = false;
            return;
          }
          setBusy(true);
          slotError.hidden = true;
          tile.dataset.petSlotWorking = 'true';
          stateNode.hidden = false;
          stateNode.className = 'pet-draft-photo-state pet-draft-photo-state-uploading';
          stateNode.textContent = '사진을 저장하고 있어요.';
          try {
            const saved = await uploadPetRegistrationDraftPhoto(
              sessionToken,
              registrationDraft.draftId,
              slotCode,
              file,
            );
            replaceDraftPhoto(saved);
            revokePreview(key);
            try {
              photoPreviews.set(key, await fetchPetRegistrationDraftPhotoObjectUrl(
                sessionToken,
                registrationDraft.draftId,
                slotCode,
              ));
            } catch {
              // The private upload succeeded; the preview can be retried after resume.
            }
            renderDraftPhotos();
            status.textContent = `${petPhotoSlotLabel(slotCode)} 사진을 초안에 저장했습니다.`;
          } catch (value) {
            tile.dataset.petSlotWorking = 'false';
            stateNode.hidden = !photo;
            stateNode.className = photo ? `pet-draft-photo-state pet-draft-photo-state-${photo.inspectionState.toLowerCase()}` : 'pet-draft-photo-state';
            stateNode.textContent = photo ? petDraftPhotoInspectionMessage(photo) : '';
            slotError.textContent = errorMessage(value, '초안 사진을 저장하지 못했습니다.');
            slotError.hidden = false;
          } finally {
            setBusy(false);
          }
        };
        bindPetPhotoSourceChange(sourceInputs, file => { void handleChosenFile(file); });
        tile.append(actions, slotError, ...sourceInputs.all);
        grid.appendChild(tile);
      });
      body.appendChild(grid);
      schedulePoll();

      for (const photo of registrationDraft.photos) {
        const key = previewKey(registrationDraft.draftId, photo.slotCode);
        if (photoPreviews.has(key)) continue;
        void (async () => {
          try {
            photoPreviews.set(key, await fetchPetRegistrationDraftPhotoObjectUrl(
              sessionToken,
              registrationDraft.draftId,
              photo.slotCode,
            ));
            if (detailSection.isConnected && screenStep === 'PHOTOS') renderDraftPhotos();
          } catch {
            // A missing preview does not discard or invalidate the private draft photo.
          }
        })();
      }

      const error = formError();
      const actions = el('div', 'pet-draft-actions');
      const back = el('button', 'site-button site-button-secondary', '이전');
      back.type = 'button';
      back.addEventListener('click', () => {
        if (busy) return;
        stopPoll();
        goToStep('BASIC');
      });
      const next = el('button', 'site-button site-button-primary', '다음: 최종 확인');
      next.type = 'button';
      next.dataset.petDraftNext = 'REVIEW';
      next.disabled = !progression.ready;
      next.setAttribute('aria-disabled', progression.ready ? 'false' : 'true');
      next.addEventListener('click', async () => {
        if (busy) return;
        const latestProgression = petDraftPhotoProgression(registrationDraft);
        if (!latestProgression.ready) {
          error.textContent = draftPhotoProgressMessage(latestProgression);
          return;
        }
        setBusy(true);
        try {
          // PHOTOS -> BASIC is Core's photo gate; ask for it first, then
          // record that the owner reached the final check.
          if (registrationDraft.currentStep === 'PHOTOS') await saveDraft({current_step: 'BASIC'});
          await saveDraft({current_step: 'REVIEW'});
          stopPoll();
          goToStep('REVIEW');
        } catch (value) {
          error.textContent = errorMessage(value, '다음 단계로 이동하지 못했습니다.');
        } finally {
          setBusy(false);
        }
      });
      actions.append(back, next);
      body.append(error, actions);
    };

    // ------------------------------------------------ 3단계 · 최종 확인
    const renderReview = () => {
      body.replaceChildren();
      stepChrome('REVIEW');
      body.append(
        el('h4', 'pet-draft-title', '등록 전 마지막으로 확인해 주세요'),
        el('p', 'pet-empty-copy', '등록을 확정한 뒤 롯비 반려동물 번호가 발급됩니다. 공개 자동 매칭이나 보호자 자동 알림은 켜지지 않습니다.'),
      );
      const facts = el('dl', 'pet-facts pet-draft-review');
      const add = (term, value) => {
        if (value !== '' && value !== null && value !== undefined) facts.append(el('dt', '', term), el('dd', '', String(value)));
      };
      add('이름', registrationDraft.name);
      add('종', petSpeciesLabel(registrationDraft.species));
      add('성별', petSexLabel(registrationDraft.sex));
      add('품종', catalog.breeds[registrationDraft.species]?.find(item => item.code === registrationDraft.breedCode)?.displayName || registrationDraft.breed);
      add('생년월일', registrationDraft.birthDate);
      add('추정 나이', Number.isInteger(registrationDraft.approximateAgeMonths) ? `${registrationDraft.approximateAgeMonths}개월` : '');
      add('가족이 된 날', registrationDraft.familyDate);
      add('식별 사진', identityPhotoProgress(registrationDraft.photos.length).label);
      add('사진 갱신 주기', registrationDraft.species === 'CAT' ? '1년 (365일)' : '6개월 (180일)');
      add('사진 사용', '등록 상태에서는 사용 안 함 · 실종 상태 전환 시 별도 동의');
      body.appendChild(facts);
      const strip = el('div', 'pet-draft-review-photos');
      for (const slotCode of PET_PHOTO_DISPLAY_ORDER) {
        const url = photoPreviews.get(previewKey(registrationDraft.draftId, slotCode));
        if (!url) continue;
        const image = el('img', 'pet-draft-review-photo');
        image.src = url;
        image.alt = `${petPhotoSlotLabel(slotCode)} 사진`;
        strip.appendChild(image);
      }
      if (strip.childElementCount) body.appendChild(strip);
      const error = formError();
      const actions = el('div', 'pet-draft-actions');
      const back = el('button', 'site-button site-button-secondary', '이전');
      back.type = 'button';
      back.addEventListener('click', async () => {
        if (busy) return;
        setBusy(true);
        try {
          await saveDraft({current_step: 'PHOTOS'});
          goToStep('PHOTOS');
        } catch (value) {
          showError(errorMessage(value, '이전 단계로 이동하지 못했습니다.'), value);
        } finally {
          setBusy(false);
        }
      });
      const finish = el('button', 'site-button site-button-primary', '등록 확정');
      finish.type = 'button';
      finish.dataset.petDraftFinalize = '';
      finish.addEventListener('click', async () => {
        if (busy) return;
        setBusy(true);
        finalizeRequestId = finalizeRequestId || `site.pet.finalize.${globalThis.crypto?.randomUUID?.() || Date.now().toString(36)}`;
        try {
          const result = await finalizePetRegistrationDraft(
            sessionToken,
            registrationDraft.draftId,
            finalizeRequestId,
          );
          finalizeRequestId = '';
          const created = result.pet;
          revokePetPreviews(registrationDraft.draftId);
          registrationDraft = null;
          addButton.textContent = '반려동물 등록';
          pets = [...pets, created];
          photoCounts.set(created.petId, PET_PHOTO_SLOT_CODES.length);
          filledSlots.set(created.petId, new Set(PET_PHOTO_SLOT_CODES));
          await refreshPetProfileData().catch(() => {});
          renderList();
          reportCount();
          renderDone(created);
          status.textContent = `${created.name} 등록을 마쳤습니다.`;
          showGateNotice();
        } catch (value) {
          error.textContent = errorMessage(value, '반려동물 등록을 확정하지 못했습니다.');
          const code = errorCodeOf(value);
          if (code) error.dataset.petErrorCode = code;
        } finally {
          setBusy(false);
        }
      });
      actions.append(back, finish);
      const discard = el('button', 'pet-case-cancel', '등록 초안 삭제');
      discard.type = 'button';
      const confirmDiscard = el('button', 'pet-delete-button', '초안 삭제 확정');
      confirmDiscard.type = 'button';
      confirmDiscard.hidden = true;
      discard.addEventListener('click', () => {
        discard.hidden = true;
        confirmDiscard.hidden = false;
      });
      confirmDiscard.addEventListener('click', async () => {
        if (busy) return;
        setBusy(true);
        try {
          await deletePetRegistrationDraft(sessionToken, registrationDraft.draftId);
          revokePetPreviews(registrationDraft.draftId);
          registrationDraft = null;
          addButton.textContent = '반려동물 등록';
          leaveRegister();
          status.textContent = '등록 초안을 삭제했습니다.';
        } catch (value) {
          error.textContent = errorMessage(value, '등록 초안을 삭제하지 못했습니다.');
        } finally {
          setBusy(false);
        }
      });
      body.append(error, actions, discard, confirmDiscard);
    };

    // ------------------------------------------------ 4단계 · 등록 완료
    const renderDone = created => {
      screenStep = 'DONE';
      body.replaceChildren();
      stepChrome('DONE');
      const profile = petProfiles.get(created.petId);
      const done = el('section', 'pet-draft-done');
      done.dataset.petRegisterDone = created.petId;
      done.appendChild(el('h4', 'pet-draft-title', `${created.name} 등록이 완료되었습니다`));
      const facts = el('dl', 'pet-facts');
      facts.append(
        el('dt', '', '다음 사진 갱신일'),
        el('dd', '', profile?.identityPhotoExpiresAt ? formatDate(profile.identityPhotoExpiresAt) : '목록의 반려동물 카드에서 확인할 수 있습니다'),
        el('dt', '', '갱신 주기'),
        el('dd', '', created.species === 'CAT' ? '1년 (365일)' : '6개월 (180일)'),
      );
      done.append(facts, el('p', 'pet-empty-copy', '만료 30일·7일·1일 전에 갱신을 안내합니다. 실종 시 목록의 카드에서 "실종 상태로 전환"을 눌러 주세요.'));
      const actions = el('div', 'pet-draft-actions');
      const toList = el('button', 'site-button site-button-primary', '목록으로');
      toList.type = 'button';
      toList.addEventListener('click', leaveRegister);
      actions.appendChild(toList);
      done.appendChild(actions);
      body.appendChild(done);
    };

    const renderStep = () => {
      stopPoll();
      if (screenStep === 'PHOTOS') renderDraftPhotos();
      else if (screenStep === 'REVIEW') renderReview();
      else renderBasic();
    };
    renderStep();
  };

  addButton.addEventListener('click', () => void renderRegisterForm());
  listBody.addEventListener('click', event => {
    const missing = event.target instanceof Element ? event.target.closest('[data-pet-sos-target]') : null;
    if (missing instanceof HTMLButtonElement) {
      const petId = missing.dataset.petSosTarget || '';
      const alreadyActive = sosCases.some(item => item.petId === petId && item.status === 'ACTIVE');
      pendingSosPetId = alreadyActive ? '' : petId;
      renderSos();
      showSurface('sos');
      return;
    }
    const trigger = event.target instanceof Element ? event.target.closest('[data-pet-open]') : null;
    if (!(trigger instanceof HTMLButtonElement)) return;
    renderDetail(trigger.dataset.petOpen || '');
    detailSection.scrollIntoView?.({block: 'start', behavior: 'smooth'});
  });
  foundCtaButton.addEventListener('click', () => {
    dropFoundComposer();
    renderFound();
    showSurface('found');
    foundSection.scrollIntoView?.({block: 'start', behavior: 'smooth'});
  });

  status.textContent = '반려동물 정보를 불러오는 중입니다.';
  try {
    pets = [...await listPets(sessionToken)];
    await Promise.all([
      loadPhotoCounts(),
      refreshPetProfileData().catch(() => {}),
    ]);
    status.textContent = '';
    renderList();
  } catch (value) {
    status.textContent = '';
    showError(errorMessage(value, '반려동물 정보를 불러오지 못했습니다.'), value);
    renderList();
  }

  // Cases load after the pets so a case listing failure cannot hide the pets.
  try {
    const [sos, found] = await Promise.all([
      listPetSOS(sessionToken),
      listFoundPets(sessionToken),
    ]);
    sosCases = [...sos];
    foundCases = [...found];
    foundPhotos = new Map(await Promise.all(
      foundCases.map(async record => [record.caseId, [...await listFoundPetPhotos(sessionToken, record.caseId)]]),
    ));
    renderList();
  } catch (value) {
    showError(errorMessage(value, '신고 내역을 불러오지 못했습니다.'), value);
  }
  renderSos();
  renderFound();
  try {
    [catalog, registrationDraft] = await Promise.all([
      getPetCatalog(),
      getActivePetRegistrationDraft(sessionToken),
    ]);
    if (registrationDraft) addButton.textContent = '등록 계속';
  } catch {
    // The registered-pet surface remains usable when draft recovery is unavailable.
  }
  showSurface(activeSurface);
  reportCount();
  return Object.freeze({mounted: true, dispose});
}
