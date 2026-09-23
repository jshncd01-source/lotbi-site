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
  createPetSOS,
  deleteFoundPetPhoto,
  deletePet,
  deletePetPhoto,
  fetchFoundPetPhotoObjectUrl,
  fetchPetPhotoObjectUrl,
  getPetPhotoManifest,
  FOUND_PHOTO_SLOT_MAX,
  listFoundPetPhotos,
  listFoundPets,
  listPetSOS,
  listPets,
  LOTBI_PET_NUMBER_LABEL,
  OFFICIAL_REGISTRATION_LABEL,
  lotbiPetNumber,
  maskOfficialRegistrationNumber,
  petPhotoRejection,
  petSexLabel,
  petSpeciesLabel,
  registerPet,
  renamePet,
  setPetMatchingConsent,
  uploadFoundPetPhoto,
  uploadPetPhoto,
} from './site-pet.js?v=20260923-petnum1';
import {
  petPhotoSlotDiagram,
  petPhotoSlotHint,
  petPhotoSlotLabel,
} from './site-pet-guides.js?v=20260923-petgate1';
import {
  petFeatureState,
  petGateNotice,
  petNavLockHint,
  petNavLockLabel,
} from './site-pet-gate.js?v=20260923-petgate1';

const MATCHING_CONSENT_VERSION = 'site-pet-matching-2026-09';

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

  const notice = el('p', 'pet-notice', NON_ASSERTION_NOTICE);

  surface.append(status, error, listSection, detailSection, sosSection, foundSection, notice);

  let pets = [];
  let sosCases = [];
  let foundCases = [];
  let foundPhotos = new Map();
  let photoCounts = new Map();
  let busy = false;
  // `${petId}:${slotCode}` -> object URL. Cached so re-rendering the detail
  // does not refetch every private photo, and revoked on dispose.
  const photoPreviews = new Map();
  const filledSlots = new Map();

  const previewKey = (petId, slotCode) => `${petId}:${slotCode}`;

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
        el('p', 'pet-empty-copy', '이름과 종만 있으면 등록할 수 있습니다. 사진은 등록 후 천천히 채워도 됩니다.'),
      );
      listBody.appendChild(empty);
      return;
    }
    for (const pet of pets) {
      const card = el('article', 'pet-card');
      card.dataset.petCard = pet.petId;

      const head = el('div', 'pet-card-head');
      head.append(el('h4', 'pet-card-name', pet.name));
      head.appendChild(el('span', 'pet-card-species', petSpeciesLabel(pet.species)));
      card.appendChild(head);

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
          slotError.hidden = true;
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
            slotError.textContent = errorMessage(value, '사진을 삭제하지 못했습니다.');
            slotError.hidden = false;
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
          slotError.textContent = rejection;
          slotError.hidden = false;
          return;
        }
        setBusy(true);
        slotError.hidden = true;
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
          slotError.textContent = errorMessage(value, '사진을 올리지 못했습니다.');
          slotError.hidden = false;
        } finally {
          tile.dataset.petSlotWorking = 'false';
          setBusy(false);
        }
      });

      tile.append(actions, slotError, input);
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
    detailSection.appendChild(facts);

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

  // Found photos have no fixed meaning per slot, unlike a registered pet's ten,
  // so the next free index is used rather than asking the reporter to pick one.
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
        await uploadFoundPetPhoto(sessionToken, record.caseId, slotIndex, file);
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

  const renderRegisterForm = () => {
    detailSection.hidden = false;
    detailSection.replaceChildren();

    const header = el('div', 'pet-section-header');
    header.append(el('h3', 'pet-section-title', '반려동물 등록'));
    const cancel = el('button', 'site-button site-button-secondary', '취소');
    cancel.type = 'button';
    cancel.addEventListener('click', () => {
      detailSection.hidden = true;
      detailSection.replaceChildren();
    });
    header.appendChild(cancel);
    detailSection.appendChild(header);

    const form = el('form', 'pet-form');
    form.dataset.petRegisterForm = '';
    form.noValidate = true;

    const nameField = el('label', 'site-field', '이름 (필수)');
    const nameInput = el('input');
    nameInput.type = 'text';
    nameInput.required = true;
    nameInput.maxLength = 120;
    nameInput.autocomplete = 'off';
    nameField.appendChild(nameInput);

    const speciesField = el('fieldset', 'pet-choice-field');
    speciesField.appendChild(el('legend', '', '종 (필수)'));
    const speciesRow = el('div', 'pet-choice-row');
    for (const value of ['DOG', 'CAT']) {
      const choice = el('label', 'pet-choice');
      const input = el('input');
      input.type = 'radio';
      input.name = 'pet-species';
      input.value = value;
      if (value === 'DOG') input.checked = true;
      choice.append(input, el('span', '', petSpeciesLabel(value)));
      speciesRow.appendChild(choice);
    }
    speciesField.appendChild(speciesRow);

    const sexField = el('label', 'site-field', '성별');
    const sexSelect = el('select');
    for (const [value, label] of [['UNKNOWN', '모름'], ['MALE', '수컷'], ['FEMALE', '암컷']]) {
      const option = el('option', '', label);
      option.value = value;
      sexSelect.appendChild(option);
    }
    sexField.appendChild(sexSelect);

    const breedField = el('label', 'site-field', '품종');
    const breedInput = el('input');
    breedInput.type = 'text';
    breedInput.maxLength = 120;
    breedField.appendChild(breedInput);

    const birthField = el('label', 'site-field', '생년월일');
    const birthInput = el('input');
    birthInput.type = 'date';
    birthField.appendChild(birthInput);

    const colorField = el('label', 'site-field', '색상');
    const colorInput = el('input');
    colorInput.type = 'text';
    colorInput.maxLength = 120;
    colorField.appendChild(colorInput);

    const marksField = el('label', 'site-field', '특징');
    const marksInput = el('input');
    marksInput.type = 'text';
    marksInput.maxLength = 2000;
    marksField.appendChild(marksInput);

    const registrationField = el('label', 'site-field', `${OFFICIAL_REGISTRATION_LABEL} (선택)`);
    const registrationInput = el('input');
    registrationInput.type = 'text';
    registrationInput.maxLength = 120;
    registrationInput.autocomplete = 'off';
    registrationInput.placeholder = '없으면 비워 두세요';
    registrationField.appendChild(registrationInput);
    const registrationHint = el(
      'p',
      'pet-field-hint',
      '동물보호법에 따라 국가 시스템에서 발급하는 번호입니다. 롯비가 발급하지 않습니다. '
      + '없으면 비워 두셔도 등록됩니다. 민감정보라 목록에는 표시하지 않고 상세에서만 가려서 보여줍니다.',
    );

    const formError = el('p', 'site-field-error');
    formError.setAttribute('role', 'alert');

    const submit = el('button', 'site-button site-button-primary', '등록');
    submit.type = 'submit';

    form.append(
      nameField,
      speciesField,
      sexField,
      breedField,
      birthField,
      colorField,
      marksField,
      registrationField,
      registrationHint,
      formError,
      submit,
    );

    // One request id per attempt keeps Core's idempotent replay meaningful
    // when a submit is retried after a network error.
    let requestId = '';
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy) return;
      const name = nameInput.value.trim();
      if (!name) {
        formError.textContent = '이름을 입력해 주세요.';
        nameInput.focus();
        return;
      }
      formError.textContent = '';
      setBusy(true);
      showError('');
      submit.disabled = true;
      requestId = requestId || `site.pet.register.${globalThis.crypto?.randomUUID?.() || Date.now().toString(36)}`;
      try {
        const created = await registerPet(sessionToken, {
          requestId,
          name,
          species: speciesRow.querySelector('input:checked')?.value || 'DOG',
          sex: sexSelect.value,
          breed: breedInput.value,
          birthDate: birthInput.value,
          color: colorInput.value,
          distinctiveMarks: marksInput.value,
          officialRegistrationNumber: registrationInput.value,
        });
        requestId = '';
        pets = [...pets, created];
        photoCounts.set(created.petId, 0);
        filledSlots.set(created.petId, new Set());
        renderList();
        reportCount();
        renderDetail(created.petId);
        status.textContent = `${created.name} 등록을 마쳤습니다.`;
        showGateNotice();
      } catch (value) {
        formError.textContent = errorMessage(value, '반려동물을 등록하지 못했습니다.');
      } finally {
        submit.disabled = false;
        setBusy(false);
      }
    });

    detailSection.appendChild(form);
    queueMicrotask(() => nameInput.focus());
  };

  addButton.addEventListener('click', renderRegisterForm);
  listBody.addEventListener('click', event => {
    const trigger = event.target instanceof Element ? event.target.closest('[data-pet-open]') : null;
    if (!(trigger instanceof HTMLButtonElement)) return;
    renderDetail(trigger.dataset.petOpen || '');
  });

  status.textContent = '반려동물 정보를 불러오는 중입니다.';
  try {
    pets = [...await listPets(sessionToken)];
    await loadPhotoCounts();
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
  reportCount();
  return Object.freeze({mounted: true, dispose});
}
