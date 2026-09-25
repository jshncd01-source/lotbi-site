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
  petPhotoNextActionLabel,
  petPhotoRejection,
  PET_PHOTO_ANCHOR_SLOT_CODES,
  PET_MATCHING_CONSENT_VERSION,
  petSexLabel,
  petSpeciesLabel,
  renamePet,
  respondToPetMatchNotice,
  setPetMatchingConsent,
  uploadFoundPetPhoto,
  uploadPetPhoto,
  uploadPetRegistrationDraftPhoto,
  updatePetRegistrationDraft,
  updatePetProfilePreferences,
} from './site-pet.js?v=aset-b7413ea1f972';
import {
  petPhotoSlotDiagram,
  petPhotoSlotHint,
  petPhotoSlotLabel,
} from './site-pet-guides.js?v=aset-b7413ea1f972';
import {
  petFeatureState,
  petGateNotice,
  petNavLockHint,
  petNavLockLabel,
} from './site-pet-gate.js?v=aset-b7413ea1f972';

const MATCHING_CONSENT_COPY = '동의하면 공공 실종·보호 공고에서 유사한 후보를 찾아 근거를 보여주는 데 등록한 사진이 쓰입니다. 자동 알림이나 연락처 중개는 하지 않습니다.';
const NON_ASSERTION_NOTICE = '공개 자동 매칭과 보호자 알림은 아직 활성화되지 않았습니다. LOTBI가 "찾았다"거나 "100% 일치"로 표시하지 않습니다.';

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function photoProgressLabel(filled) {
  return `사진 ${filled}/${PET_PHOTO_SLOT_CODES.length}`;
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

  const home = el('nav', 'pet-home');
  home.setAttribute('aria-label', '반려동물 메뉴');
  const homeItems = [
    ['pets', '내 반려동물', '등록·사진·기본 정보를 관리합니다.'],
    ['sos', '실종 신고', '내 반려동물의 실종 기록을 남깁니다.'],
    ['found', '발견 제보', '발견한 동물을 안전하게 기록합니다.'],
  ];
  for (const [target, title, copy] of homeItems) {
    const button = el('button', 'pet-home-card');
    button.type = 'button';
    button.dataset.petHomeTarget = target;
    button.append(el('strong', 'pet-home-card-title', title), el('span', 'pet-home-card-copy', copy));
    home.appendChild(button);
  }

  const notice = el('p', 'pet-notice', NON_ASSERTION_NOTICE);

  surface.append(status, error, home, listSection, detailSection, sosSection, foundSection, notice);

  let pets = [];
  let sosCases = [];
  let foundCases = [];
  let foundPhotos = new Map();
  let photoCounts = new Map();
  let petProfiles = new Map();
  let matchNotices = [];
  let catalog = null;
  let registrationDraft = null;
  let activeSurface = ['pets', 'sos', 'found'].includes(initialSurface) ? initialSurface : 'pets';
  let busy = false;
  // `${petId}:${slotCode}` -> object URL. Cached so re-rendering the detail
  // does not refetch every private photo, and revoked on dispose.
  const photoPreviews = new Map();
  const filledSlots = new Map();

  const previewKey = (petId, slotCode) => `${petId}:${slotCode}`;

  const showSurface = target => {
    activeSurface = ['pets', 'sos', 'found'].includes(target) ? target : 'pets';
    listSection.hidden = activeSurface !== 'pets';
    detailSection.hidden = activeSurface !== 'pets' || detailSection.childElementCount === 0;
    sosSection.hidden = activeSurface !== 'sos';
    foundSection.hidden = activeSurface !== 'found';
    for (const button of home.querySelectorAll('[data-pet-home-target]')) {
      const selected = button.dataset.petHomeTarget === activeSurface;
      button.dataset.petHomeActive = selected ? 'true' : 'false';
      button.setAttribute('aria-current', selected ? 'page' : 'false');
    }
  };

  home.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('[data-pet-home-target]') : null;
    if (!(button instanceof HTMLButtonElement)) return;
    showSurface(button.dataset.petHomeTarget || 'pets');
  });
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
        el('p', 'pet-empty-copy', '사진부터 올리면 비공개 등록 초안이 저장됩니다. 이름과 기본 정보는 그다음에 입력합니다.'),
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
      card.appendChild(head);

      if (profile) {
        card.appendChild(el('p', 'pet-profile-age', `${pet.name} · ${profile.ageLabel}`));
        if (profile.familyLabel) card.appendChild(el('p', 'pet-profile-family', profile.familyLabel));
        const identity = profile.photoCount >= profile.photoTotal && profile.visualStatus === 'READY'
          ? `✓ ${profile.visualLabel}`
          : `📷 식별사진 ${profile.photoCount}/${profile.photoTotal}`;
        card.appendChild(el('p', 'pet-profile-identity', identity));
        if (profile.activeSos) {
          card.appendChild(el('p', 'pet-profile-sos', `🔴 ${pet.name} 실종 신고 중`));
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

      const open = el('button', 'site-button site-button-secondary pet-card-open', '상세 보기');
      open.type = 'button';
      open.dataset.petOpen = pet.petId;
      card.appendChild(open);

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
    header.append(el('h4', 'pet-photo-title', '사진 10장'));
    const count = el('span', 'pet-photo-count', `${filled.size}/${PET_PHOTO_SLOT_CODES.length}`);
    header.appendChild(count);
    host.appendChild(header);

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
        const diagram = petPhotoSlotDiagram(slotCode);
        if (diagram) media.appendChild(diagram);
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

      const input = el('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png';
      input.hidden = true;
      input.dataset.petSlotInput = slotCode;

      const actions = el('div', 'pet-slot-actions');
      const choose = el('button', 'site-button site-button-secondary pet-slot-choose',
        filled.has(slotCode) ? '다시 올리기' : '사진 올리기');
      choose.type = 'button';
      choose.dataset.petSlotChoose = slotCode;
      choose.addEventListener('click', () => input.click());
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

      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        input.value = '';
        if (!file || busy) return;
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
      });

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
        input.click();
      });

      tile.append(actions, slotError, retry, input);
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
      if (profile.activeSos) addFact('실종 상태', '실종 신고 중');
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
    const consentLine = el('label', 'pet-consent-toggle');
    const consentInput = el('input');
    consentInput.type = 'checkbox';
    consentInput.checked = pet.matchingConsentState === 'GRANTED';
    consentInput.dataset.petConsent = pet.petId;
    consentLine.append(consentInput, el('span', '', '유사 공고 후보 찾기에 사진 사용 동의'));
    consent.append(consentLine, el('p', 'pet-consent-copy', MATCHING_CONSENT_COPY));
    consentInput.addEventListener('change', async () => {
      if (busy) return;
      const enabled = consentInput.checked;
      setBusy(true);
      showError('');
      try {
        const updated = await setPetMatchingConsent(sessionToken, pet.petId, {
          enabled,
          consentVersion: MATCHING_CONSENT_VERSION,
        });
        pets = pets.map(item => (item.petId === updated.petId ? updated : item));
        renderList();
        renderDetail(updated.petId);
        status.textContent = enabled ? '매칭 동의를 켰습니다.' : '매칭 동의를 껐습니다.';
      } catch (value) {
        consentInput.checked = !enabled;
        showError(errorMessage(value, '매칭 동의 상태를 바꾸지 못했습니다.'), value);
      } finally {
        setBusy(false);
      }
    });
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

  // Found reporters are never forced through annotation. The next free index is
  // paired with the corresponding semantic view as a best-effort server hint;
  // the report remains valid with any number of photos, including zero.
  const nextFoundSlot = caseId => {
    const used = new Set(foundPhotos.get(caseId) || []);
    for (let index = 1; index <= FOUND_PHOTO_SLOT_MAX; index += 1) {
      if (!used.has(index)) return index;
    }
    return 0;
  };

  const renderFoundPhotos = (record, host) => {
    host.replaceChildren();
    const slots = foundPhotos.get(record.caseId) || [];
    host.appendChild(el('p', 'pet-case-photo-count', `첨부 사진 ${slots.length}/${FOUND_PHOTO_SLOT_MAX}`));

    const strip = el('div', 'pet-case-photo-strip');
    for (const slotIndex of slots) {
      const item = el('div', 'pet-case-photo');
      const key = previewKey(record.caseId, `found-${slotIndex}`);
      const cached = photoPreviews.get(key);
      if (cached) {
        const image = el('img', 'pet-case-photo-image');
        image.src = cached;
        image.alt = `발견 신고 첨부 사진 ${slotIndex}`;
        image.decoding = 'async';
        item.appendChild(image);
      } else {
        item.appendChild(el('span', 'pet-case-photo-loading', '불러오는 중'));
        void (async () => {
          try {
            const url = await fetchFoundPetPhotoObjectUrl(sessionToken, record.caseId, slotIndex);
            photoPreviews.set(key, url);
            if (!item.isConnected) return;
            const image = el('img', 'pet-case-photo-image');
            image.src = url;
            image.alt = `발견 신고 첨부 사진 ${slotIndex}`;
            image.decoding = 'async';
            item.replaceChildren(image, item.lastElementChild);
          } catch {
            const loading = item.querySelector('.pet-case-photo-loading');
            if (loading) loading.textContent = '미리보기 실패';
          }
        })();
      }
      if (record.status === 'ACTIVE') {
        const remove = el('button', 'pet-case-photo-remove', '삭제');
        remove.type = 'button';
        remove.setAttribute('aria-label', `첨부 사진 ${slotIndex} 삭제`);
        remove.addEventListener('click', async () => {
          if (busy) return;
          setBusy(true);
          try {
            await deleteFoundPetPhoto(sessionToken, record.caseId, slotIndex);
            foundPhotos.set(record.caseId, slots.filter(value => value !== slotIndex));
            revokePreview(key);
            renderFoundPhotos(record, host);
            status.textContent = '첨부 사진을 삭제했습니다.';
          } catch (value) {
            showError(errorMessage(value, '첨부 사진을 삭제하지 못했습니다.'), value);
          } finally {
            setBusy(false);
          }
        });
        item.appendChild(remove);
      }
      strip.appendChild(item);
    }
    host.appendChild(strip);

    if (record.status !== 'ACTIVE') return;
    const slotIndex = nextFoundSlot(record.caseId);
    if (slotIndex === 0) return;

    const input = el('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png';
    input.hidden = true;
    const add = el('button', 'site-button site-button-secondary pet-case-photo-add', '사진 첨부');
    add.type = 'button';
    add.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.value = '';
      if (!file || busy) return;
      setBusy(true);
      try {
        await uploadFoundPetPhoto(
          sessionToken,
          record.caseId,
          slotIndex,
          file,
          FOUND_PHOTO_SEMANTIC_SLOT_CODES[slotIndex - 1] || '',
        );
        foundPhotos.set(record.caseId, [...slots, slotIndex].sort((a, b) => a - b));
        renderFoundPhotos(record, host);
        status.textContent = '사진을 첨부했습니다.';
      } catch (value) {
        showError(errorMessage(value, '사진을 첨부하지 못했습니다.'), value);
      } finally {
        setBusy(false);
      }
    });
    host.append(add, input);
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
          renderSos();
          reportCount();
        } else {
          foundCases = foundCases.map(item => (item.caseId === updated.caseId ? updated : item));
          renderFound();
        }
        status.textContent = '신고를 종료했습니다.';
      } catch (value) {
        showError(errorMessage(value, '신고를 종료하지 못했습니다.'), value);
      } finally {
        setBusy(false);
      }
    };
    const resolvedButton = el('button', 'site-button site-button-secondary',
      kind === 'sos' ? '돌아왔어요 (종료)' : '보호자를 만났어요 (종료)');
    resolvedButton.type = 'button';
    resolvedButton.dataset.petCaseResolve = record.caseId;
    resolvedButton.addEventListener('click', () => void run(true));
    const cancelButton = el('button', 'pet-case-cancel', '신고 취소');
    cancelButton.type = 'button';
    cancelButton.dataset.petCaseCancel = record.caseId;
    cancelButton.addEventListener('click', () => void run(false));
    actions.append(resolvedButton, cancelButton);
    return actions;
  };

  const renderSos = () => {
    sosSection.replaceChildren();
    const header = el('div', 'pet-section-header');
    header.append(el('h3', 'pet-section-title', '실종 신고'));
    const openForm = el('button', 'site-button site-button-secondary', '실종 신고하기');
    openForm.type = 'button';
    openForm.dataset.petSosNew = '';
    openForm.disabled = pets.length === 0;
    header.appendChild(openForm);
    sosSection.append(header);

    if (pets.length === 0) {
      sosSection.appendChild(el('p', 'pet-empty-copy', '반려동물을 먼저 등록하면 실종 신고를 할 수 있습니다.'));
    }

    const active = sosCases.filter(item => item.status === 'ACTIVE');
    const closed = sosCases.filter(item => item.status !== 'ACTIVE');
    if (active.length === 0 && pets.length > 0) {
      sosSection.appendChild(el('p', 'pet-empty-copy', '진행 중인 실종 신고가 없습니다.'));
    }

    for (const record of [...active, ...closed]) {
      const pet = pets.find(item => item.petId === record.petId);
      const card = el('article', 'pet-case-card');
      card.dataset.petCase = record.caseId;
      card.dataset.petCaseStatus = record.status;
      const head = el('div', 'pet-card-head');
      head.append(
        el('h4', 'pet-card-name', pet ? pet.name : '등록 해제된 반려동물'),
        el('span', 'pet-case-status', caseStatusLabel(record.status)),
      );
      card.appendChild(head);
      if (record.locationLabel) card.appendChild(el('p', 'pet-case-line', `마지막 목격 ${record.locationLabel}`));
      if (record.occurredAt) card.appendChild(el('p', 'pet-case-line', displayMoment(record.occurredAt)));
      if (record.note) card.appendChild(el('p', 'pet-case-line', record.note));
      if (record.status === 'ACTIVE') card.appendChild(closeCaseButtons(record, 'sos'));
      sosSection.appendChild(card);
    }

    const formHost = el('div', 'pet-case-form-host');
    sosSection.appendChild(formHost);
    openForm.addEventListener('click', () => {
      if (pets.length === 0) return;
      formHost.replaceChildren();
      const form = el('form', 'pet-form');
      form.dataset.petSosForm = '';
      form.noValidate = true;

      const petField = el('label', 'site-field', '반려동물');
      const petSelect = el('select');
      for (const pet of pets) {
        const option = el('option', '', pet.name);
        option.value = pet.petId;
        petSelect.appendChild(option);
      }
      petField.appendChild(petSelect);

      const place = textField('마지막으로 본 장소', 500, '예: 서울시 마포구 망원동 한강공원');
      const moment = momentField('마지막으로 본 시각', localNowValue());
      const note = textField('특이사항 (선택)', 2000);

      const formError = el('p', 'site-field-error');
      formError.setAttribute('role', 'alert');
      const submit = el('button', 'site-button site-button-primary', '실종 신고 저장');
      submit.type = 'submit';
      form.append(petField, place.field, moment.field, note.field, formError, submit);

      let requestId = '';
      form.addEventListener('submit', async event => {
        event.preventDefault();
        if (busy) return;
        const lastSeenAt = isoFromLocal(moment.input.value);
        if (!lastSeenAt) {
          formError.textContent = '마지막으로 본 시각을 입력해 주세요.';
          return;
        }
        formError.textContent = '';
        setBusy(true);
        submit.disabled = true;
        requestId = requestId || `site.pet.sos.${globalThis.crypto?.randomUUID?.() || Date.now().toString(36)}`;
        try {
          const created = await createPetSOS(sessionToken, {
            requestId,
            petId: petSelect.value,
            locationLabel: place.input.value,
            lastSeenAt,
            note: note.input.value,
          });
          requestId = '';
          sosCases = [created, ...sosCases];
          renderSos();
          reportCount();
          status.textContent = '실종 신고를 저장했습니다.';
        } catch (value) {
          formError.textContent = errorMessage(value, '실종 신고를 저장하지 못했습니다.');
        } finally {
          submit.disabled = false;
          setBusy(false);
        }
      });
      formHost.appendChild(form);
      queueMicrotask(() => place.input.focus());
    });
  };

  const renderFound = () => {
    foundSection.replaceChildren();
    const header = el('div', 'pet-section-header');
    header.append(el('h3', 'pet-section-title', '발견 신고'));
    const openForm = el('button', 'site-button site-button-secondary', '발견 신고하기');
    openForm.type = 'button';
    openForm.dataset.petFoundNew = '';
    header.appendChild(openForm);
    foundSection.append(
      header,
      el('p', 'pet-case-safety', '위험하게 가까이 접근하거나 붙잡아 사진을 찍지 마세요.'),
      el('p', 'pet-empty-copy', '반려동물을 등록하지 않았어도 발견한 동물을 기록할 수 있습니다.'),
    );

    const active = foundCases.filter(item => item.status === 'ACTIVE');
    const closed = foundCases.filter(item => item.status !== 'ACTIVE');
    for (const record of [...active, ...closed]) {
      const card = el('article', 'pet-case-card');
      card.dataset.petCase = record.caseId;
      card.dataset.petCaseStatus = record.status;
      const head = el('div', 'pet-card-head');
      head.append(
        el('h4', 'pet-card-name', petSpeciesLabel(record.species) || '동물'),
        el('span', 'pet-case-status', caseStatusLabel(record.status)),
      );
      card.appendChild(head);
      if (record.locationLabel) card.appendChild(el('p', 'pet-case-line', `발견 장소 ${record.locationLabel}`));
      if (record.occurredAt) card.appendChild(el('p', 'pet-case-line', displayMoment(record.occurredAt)));
      if (record.description) card.appendChild(el('p', 'pet-case-line', record.description));
      const photoHost = el('div', 'pet-case-photos');
      card.appendChild(photoHost);
      renderFoundPhotos(record, photoHost);
      if (record.status === 'ACTIVE') card.appendChild(closeCaseButtons(record, 'found'));
      foundSection.appendChild(card);
    }

    const formHost = el('div', 'pet-case-form-host');
    foundSection.appendChild(formHost);
    openForm.addEventListener('click', () => {
      formHost.replaceChildren();
      const form = el('form', 'pet-form');
      form.dataset.petFoundForm = '';
      form.noValidate = true;

      const speciesField = el('fieldset', 'pet-choice-field');
      speciesField.appendChild(el('legend', '', '종'));
      const speciesRow = el('div', 'pet-choice-row');
      for (const value of ['DOG', 'CAT']) {
        const choice = el('label', 'pet-choice');
        const input = el('input');
        input.type = 'radio';
        input.name = 'found-species';
        input.value = value;
        if (value === 'DOG') input.checked = true;
        choice.append(input, el('span', '', petSpeciesLabel(value)));
        speciesRow.appendChild(choice);
      }
      speciesField.appendChild(speciesRow);

      const place = textField('발견 장소', 500, '예: 성남시 분당구 정자동 느티마을 앞');
      const moment = momentField('발견 시각', localNowValue());
      const description = textField('설명 (선택)', 3000, '털색, 목줄, 몸집 등');

      const formError = el('p', 'site-field-error');
      formError.setAttribute('role', 'alert');
      const submit = el('button', 'site-button site-button-primary', '발견 신고 저장');
      submit.type = 'submit';
      form.append(speciesField, place.field, moment.field, description.field, formError, submit);

      let requestId = '';
      form.addEventListener('submit', async event => {
        event.preventDefault();
        if (busy) return;
        const foundAt = isoFromLocal(moment.input.value);
        if (!foundAt) {
          formError.textContent = '발견 시각을 입력해 주세요.';
          return;
        }
        formError.textContent = '';
        setBusy(true);
        submit.disabled = true;
        requestId = requestId || `site.pet.found.${globalThis.crypto?.randomUUID?.() || Date.now().toString(36)}`;
        try {
          const created = await createFoundPet(sessionToken, {
            requestId,
            species: speciesRow.querySelector('input:checked')?.value || 'DOG',
            locationLabel: place.input.value,
            foundAt,
            description: description.input.value,
          });
          requestId = '';
          foundCases = [created, ...foundCases];
          foundPhotos.set(created.caseId, []);
          renderFound();
          status.textContent = '발견 신고를 저장했습니다. 사진을 첨부할 수 있습니다.';
        } catch (value) {
          formError.textContent = errorMessage(value, '발견 신고를 저장하지 못했습니다.');
        } finally {
          submit.disabled = false;
          setBusy(false);
        }
      });
      formHost.appendChild(form);
      queueMicrotask(() => place.input.focus());
    });
  };

  const renderRegisterForm = async () => {
    showSurface('pets');
    detailSection.hidden = false;
    detailSection.replaceChildren();

    const header = el('div', 'pet-section-header');
    header.append(el('h3', 'pet-section-title', '반려동물 등록'));
    const cancel = el('button', 'site-button site-button-secondary', '나중에 계속');
    cancel.type = 'button';
    cancel.addEventListener('click', () => {
      detailSection.hidden = true;
      detailSection.replaceChildren();
    });
    header.appendChild(cancel);
    const body = el('div', 'pet-draft-body');
    detailSection.append(header, body);

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
      return;
    }

    const stepNames = Object.freeze({PHOTOS: '사진', BASIC: '기본 정보', ADDITIONAL: '추가 정보', REVIEW: '검토'});
    let finalizeRequestId = '';
    let autosaveTimer = 0;

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

    const stepChrome = step => {
      const progress = el('ol', 'pet-draft-steps');
      for (const code of ['PHOTOS', 'BASIC', 'ADDITIONAL', 'REVIEW']) {
        const item = el('li', 'pet-draft-step', stepNames[code]);
        item.dataset.petDraftStep = code;
        item.dataset.petDraftStepActive = code === step ? 'true' : 'false';
        progress.appendChild(item);
      }
      body.appendChild(progress);
    };

    const formError = () => {
      const node = el('p', 'site-field-error');
      node.setAttribute('role', 'alert');
      return node;
    };

    const backButton = target => {
      const button = el('button', 'site-button site-button-secondary', '이전');
      button.type = 'button';
      button.addEventListener('click', async () => {
        if (busy) return;
        setBusy(true);
        try {
          await saveDraft({current_step: target});
          renderStep();
        } catch (value) {
          showError(errorMessage(value, '이전 단계로 이동하지 못했습니다.'), value);
        } finally {
          setBusy(false);
        }
      });
      return button;
    };

    const renderDraftPhotos = () => {
      body.replaceChildren();
      stepChrome('PHOTOS');
      body.append(
        el('h4', 'pet-draft-title', '사진부터 등록해 주세요'),
        el('p', 'pet-empty-copy', '10장은 모두 비공개 초안에 저장됩니다. 얼굴·몸 전체 사진보다 코나 특징 사진을 먼저 올려도 지우지 않고 보관했다가 다시 확인합니다.'),
      );
      const photosBySlot = new Map(registrationDraft.photos.map(photo => [photo.slotCode, photo]));
      const count = el('p', 'pet-photo-count', `${photosBySlot.size}/${PET_PHOTO_SLOT_CODES.length}`);
      body.appendChild(count);
      const grid = el('div', 'pet-slot-grid');
      grid.dataset.petDraftSlotGrid = '';

      PET_PHOTO_SLOT_CODES.forEach((slotCode, index) => {
        const photo = photosBySlot.get(slotCode);
        const tile = el('figure', 'pet-slot');
        tile.dataset.petDraftSlot = slotCode;
        tile.dataset.petSlotFilled = photo ? 'true' : 'false';
        tile.dataset.petPhotoInspection = photo?.inspectionState || '';
        const media = el('div', 'pet-slot-media');
        const key = previewKey(registrationDraft.draftId, slotCode);
        const cached = photoPreviews.get(key);
        if (cached) {
          const image = el('img', 'pet-slot-photo');
          image.src = cached;
          image.alt = `${petPhotoSlotLabel(slotCode)} 등록 사진`;
          media.appendChild(image);
        } else {
          const diagram = petPhotoSlotDiagram(slotCode);
          if (diagram) media.appendChild(diagram);
        }
        tile.appendChild(media);
        const caption = el('figcaption', 'pet-slot-caption');
        caption.append(el('span', 'pet-slot-index', String(index + 1)), el('span', 'pet-slot-label', petPhotoSlotLabel(slotCode)));
        tile.append(caption, el('p', 'pet-slot-hint', petPhotoSlotHint(slotCode)));
        if (photo) {
          const stateCopy = photo.inspectionState === 'ACCEPTED'
            ? '사진 확인됨'
            : (photo.inspectionState === 'REJECTED' ? '다시 촬영 필요' : '초안 보관 · 확인 대기');
          tile.appendChild(el('p', `pet-draft-photo-state pet-draft-photo-state-${photo.inspectionState.toLowerCase()}`, stateCopy));
        }
        const slotError = formError();
        slotError.hidden = true;
        const input = el('input');
        input.type = 'file';
        input.accept = 'image/jpeg,image/png';
        input.hidden = true;
        const actions = el('div', 'pet-slot-actions');
        const choose = el('button', 'site-button site-button-secondary', photo ? '다시 올리기' : '사진 올리기');
        choose.type = 'button';
        choose.addEventListener('click', () => input.click());
        actions.appendChild(choose);
        if (photo) {
          const remove = el('button', 'pet-slot-remove', '삭제');
          remove.type = 'button';
          remove.addEventListener('click', async () => {
            if (busy) return;
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
        input.addEventListener('change', async () => {
          const file = input.files?.[0];
          input.value = '';
          if (!file || busy) return;
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
            slotError.textContent = errorMessage(value, '초안 사진을 저장하지 못했습니다.');
            slotError.hidden = false;
          } finally {
            setBusy(false);
          }
        });
        tile.append(actions, slotError, input);
        grid.appendChild(tile);
      });
      body.appendChild(grid);

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
            if (detailSection.isConnected) renderDraftPhotos();
          } catch {
            // A missing preview does not discard or invalidate the private draft photo.
          }
        })();
      }

      const error = formError();
      const actions = el('div', 'pet-draft-actions');
      const next = el('button', 'site-button site-button-primary', '기본 정보 입력');
      next.type = 'button';
      next.dataset.petDraftNext = 'BASIC';
      next.addEventListener('click', async () => {
        if (busy) return;
        if (registrationDraft.photos.length !== PET_PHOTO_SLOT_CODES.length) {
          error.textContent = '사진 10장을 모두 올려 주세요.';
          return;
        }
        setBusy(true);
        try {
          await saveDraft({current_step: 'BASIC'});
          renderStep();
        } catch (value) {
          error.textContent = errorMessage(value, '다음 단계로 이동하지 못했습니다.');
        } finally {
          setBusy(false);
        }
      });
      actions.appendChild(next);
      body.append(error, actions);
    };

    const renderBasic = () => {
      body.replaceChildren();
      stepChrome('BASIC');
      body.append(el('h4', 'pet-draft-title', '기본 정보를 알려 주세요'));
      const form = el('form', 'pet-form');
      form.dataset.petRegisterForm = '';
      form.noValidate = true;
      const nameField = el('label', 'site-field', '이름');
      const nameInput = el('input');
      nameInput.type = 'text';
      nameInput.maxLength = 120;
      nameInput.autocomplete = 'off';
      nameInput.value = registrationDraft.name;
      nameField.appendChild(nameInput);
      const speciesField = el('fieldset', 'pet-choice-field');
      speciesField.appendChild(el('legend', '', '종'));
      const speciesRow = el('div', 'pet-choice-row');
      for (const value of ['DOG', 'CAT']) {
        const choice = el('label', 'pet-choice');
        const input = el('input');
        input.type = 'radio';
        input.name = 'pet-species';
        input.value = value;
        input.checked = registrationDraft.species === value;
        choice.append(input, el('span', '', petSpeciesLabel(value)));
        speciesRow.appendChild(choice);
      }
      speciesField.appendChild(speciesRow);
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
      const breedPlaceholder = el('option', '', '종을 먼저 선택해 주세요');
      breedPlaceholder.value = '';
      breedSelect.appendChild(breedPlaceholder);
      breedField.appendChild(breedSelect);
      const breedOtherField = el('label', 'site-field', '기타 품종 이름');
      const breedOtherInput = el('input');
      breedOtherInput.type = 'text';
      breedOtherInput.maxLength = 120;
      breedOtherInput.value = registrationDraft.breed;
      breedOtherField.appendChild(breedOtherInput);
      breedOtherField.hidden = true;

      const selectedSpecies = () => speciesRow.querySelector('input:checked')?.value || '';
      const populateBreeds = () => {
        const species = selectedSpecies();
        breedSelect.replaceChildren();
        const placeholder = el('option', '', species ? '품종을 선택해 주세요' : '종을 먼저 선택해 주세요');
        placeholder.value = '';
        breedSelect.appendChild(placeholder);
        for (const item of catalog.breeds[species] || []) {
          const option = el('option', '', item.displayName);
          option.value = item.code;
          option.selected = registrationDraft.breedCode === item.code;
          breedSelect.appendChild(option);
        }
        breedOtherField.hidden = !['OTHER_DOG', 'OTHER_CAT'].includes(breedSelect.value);
      };
      populateBreeds();
      speciesRow.addEventListener('change', () => {
        populateBreeds();
        clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(async () => {
          const species = selectedSpecies();
          try {
            if (registrationDraft.species && registrationDraft.species !== species && registrationDraft.breedCode) {
              await saveDraft({breed_code: null, breed: null});
            }
            await saveDraft({species});
          } catch (value) {
            showError(errorMessage(value, '종을 자동 저장하지 못했습니다.'), value);
          }
        }, 500);
      });
      breedSelect.addEventListener('change', () => {
        breedOtherField.hidden = !['OTHER_DOG', 'OTHER_CAT'].includes(breedSelect.value);
        scheduleAutosave(() => ({species: selectedSpecies(), breed_code: breedSelect.value || null}));
      });
      nameInput.addEventListener('input', () => scheduleAutosave(() => ({name: nameInput.value.trim() || null})));
      sexRow.addEventListener('change', () => scheduleAutosave(() => ({sex: sexRow.querySelector('input:checked')?.value || null})));
      breedOtherInput.addEventListener('input', () => scheduleAutosave(() => ({breed: breedOtherInput.value.trim() || null})));

      const error = formError();
      const actions = el('div', 'pet-draft-actions');
      const next = el('button', 'site-button site-button-primary', '추가 정보 입력');
      next.type = 'submit';
      actions.append(backButton('PHOTOS'), next);
      form.append(nameField, speciesField, sexField, breedField, breedOtherField, error, actions);
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const species = selectedSpecies();
        const sex = sexRow.querySelector('input:checked')?.value || '';
        if (!nameInput.value.trim()) {
          error.textContent = '이름을 입력해 주세요.';
          nameInput.focus();
          return;
        }
        if (!species) {
          error.textContent = '강아지 또는 고양이를 선택해 주세요.';
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
        clearTimeout(autosaveTimer);
        setBusy(true);
        try {
          if (registrationDraft.species && registrationDraft.species !== species && registrationDraft.breedCode) {
            await saveDraft({breed_code: null, breed: null});
          }
          await saveDraft({
            current_step: 'ADDITIONAL',
            name: nameInput.value.trim(),
            species,
            sex,
            breed_code: breedSelect.value,
            breed: breedOtherInput.value.trim() || null,
          });
          renderStep();
        } catch (value) {
          error.textContent = errorMessage(value, '기본 정보를 저장하지 못했습니다.');
        } finally {
          setBusy(false);
        }
      });
      body.appendChild(form);
      queueMicrotask(() => nameInput.focus());
    };

    const renderAdditional = () => {
      body.replaceChildren();
      stepChrome('ADDITIONAL');
      body.append(el('h4', 'pet-draft-title', '추가 정보를 확인해 주세요'));
      const form = el('form', 'pet-form');
      form.noValidate = true;
      const ageField = el('fieldset', 'pet-choice-field');
      ageField.appendChild(el('legend', '', '나이 기준'));
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
      const familyField = el('label', 'site-field', '가족이 된 날');
      const familyInput = el('input');
      familyInput.type = 'date';
      familyInput.max = new Date().toISOString().slice(0, 10);
      familyInput.value = registrationDraft.familyDate;
      familyField.appendChild(familyInput);

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
      const noPattern = el('option', '', '선택 안 함');
      noPattern.value = '';
      patternSelect.appendChild(noPattern);
      for (const item of catalog.patterns.filter(item => !item.species || item.species === registrationDraft.species)) {
        const option = el('option', '', item.displayName);
        option.value = item.code;
        option.selected = registrationDraft.coatPatternCode === item.code;
        patternSelect.appendChild(option);
      }
      patternField.appendChild(patternSelect);
      const patternOtherField = el('label', 'site-field', '기타 무늬');
      const patternOtherInput = el('input');
      patternOtherInput.type = 'text';
      patternOtherInput.maxLength = 120;
      patternOtherInput.value = registrationDraft.coatPatternOther;
      patternOtherField.appendChild(patternOtherInput);
      const syncPatternOther = () => {
        patternOtherField.hidden = patternSelect.value !== 'OTHER';
      };
      patternSelect.addEventListener('change', syncPatternOther);
      syncPatternOther();

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
      const consent = el('label', 'pet-consent-toggle');
      const consentInput = el('input');
      consentInput.type = 'checkbox';
      consentInput.checked = registrationDraft.matchingConsentState === 'GRANTED';
      consent.append(consentInput, el('span', '', '유사 공고 후보 찾기에 사진 사용 동의'));
      const error = formError();
      const actions = el('div', 'pet-draft-actions');
      const review = el('button', 'site-button site-button-primary', '등록 내용 검토');
      review.type = 'submit';
      actions.append(backButton('BASIC'), review);
      form.append(
        ageField, birthField, estimateField, familyField, colorsField, colorOtherField,
        patternField, patternOtherField, marksField, registrationField, registrationHint,
        consent, el('p', 'pet-consent-copy', MATCHING_CONSENT_COPY), error, actions,
      );
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const ageMode = ageRow.querySelector('input:checked')?.value || 'UNKNOWN';
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
        const colorCodes = [...colors.querySelectorAll('input:checked')].map(input => input.value);
        if (colorCodes.includes('OTHER') && !colorOtherInput.value.trim()) {
          error.textContent = '기타 털색을 입력해 주세요.';
          colorOtherInput.focus();
          return;
        }
        if (patternSelect.value === 'OTHER' && !patternOtherInput.value.trim()) {
          error.textContent = '기타 무늬를 입력해 주세요.';
          patternOtherInput.focus();
          return;
        }
        const updates = {
          current_step: 'REVIEW',
          age_mode: ageMode,
          family_date: familyInput.value || null,
          color_codes: colorCodes,
          color_other: colorOtherInput.value.trim() || null,
          coat_pattern_code: patternSelect.value || null,
          coat_pattern_other: patternOtherInput.value.trim() || null,
          distinctive_marks: marksInput.value.trim() || null,
          official_registration_number: registrationInput.value.trim() || null,
          matching_consent: consentInput.checked,
          matching_consent_version: consentInput.checked ? PET_MATCHING_CONSENT_VERSION : null,
        };
        if (ageMode === 'BIRTH_DATE') updates.birth_date = birthInput.value;
        if (ageMode === 'ESTIMATED') {
          updates.approximate_age_months = Number(estimateInput.value);
          updates.age_estimate_as_of = new Date().toISOString().slice(0, 10);
        }
        setBusy(true);
        try {
          await saveDraft(updates);
          renderStep();
        } catch (value) {
          error.textContent = errorMessage(value, '추가 정보를 저장하지 못했습니다.');
        } finally {
          setBusy(false);
        }
      });
      body.appendChild(form);
    };

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
      add('사진', `${registrationDraft.photos.length}/${PET_PHOTO_SLOT_CODES.length}`);
      add('생년월일', registrationDraft.birthDate);
      add('추정 나이', Number.isInteger(registrationDraft.approximateAgeMonths) ? `${registrationDraft.approximateAgeMonths}개월` : '');
      add('가족이 된 날', registrationDraft.familyDate);
      add('매칭 동의', consentLabel(registrationDraft.matchingConsentState));
      body.appendChild(facts);
      const error = formError();
      const actions = el('div', 'pet-draft-actions');
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
          renderList();
          reportCount();
          renderDetail(created.petId);
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
      actions.append(backButton('ADDITIONAL'), finish);
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
          detailSection.hidden = true;
          detailSection.replaceChildren();
          status.textContent = '등록 초안을 삭제했습니다.';
        } catch (value) {
          error.textContent = errorMessage(value, '등록 초안을 삭제하지 못했습니다.');
        } finally {
          setBusy(false);
        }
      });
      body.append(error, actions, discard, confirmDiscard);
    };

    const renderStep = () => {
      if (registrationDraft.currentStep === 'BASIC') renderBasic();
      else if (registrationDraft.currentStep === 'ADDITIONAL') renderAdditional();
      else if (registrationDraft.currentStep === 'REVIEW') renderReview();
      else renderDraftPhotos();
    };
    renderStep();
  };

  addButton.addEventListener('click', () => void renderRegisterForm());
  listBody.addEventListener('click', event => {
    const trigger = event.target instanceof Element ? event.target.closest('[data-pet-open]') : null;
    if (!(trigger instanceof HTMLButtonElement)) return;
    renderDetail(trigger.dataset.petOpen || '');
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
