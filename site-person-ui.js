// SAFECARE-WEB-UI-REDESIGN-01 — person SafeCare for Desktop and Mobile Web.
//
// One screen, no inner menu: the registered people are the screen. Each card
// carries its own "사진 갱신·관리" and "실종 상태로 전환"; the missing state is
// shown only while an SOS is ACTIVE; the found report is a separate CTA so it
// is never mistaken for the guardian's own list.
//
// Core decides every state shown here (photo renewal, SOS eligibility, review
// state). LOTBI never asserts a match: no "찾았습니다", no "100% 일치", and
// "확인 가능한 일치 대상 없음" only after Core reports NO_RELIABLE_MATCH.
import {
  closePersonSos, createHumanSighting, createPerson, createPersonSos, deleteHumanSightingPhoto, deletePerson,
  fetchHumanSightingPhotoObjectUrl, fetchPersonIdentityPhotoObjectUrl, getPerson, listGuardianNotices,
  listHumanSightingPhotos, listHumanSightings, listPeople, listPersonIdentityPhotos, listPersonSos,
  personErrorMessage, personRequestKey, putHumanSightingPhoto, putPersonIdentityPhoto, respondGuardianNotice,
  submitHumanSighting, updatePerson,
} from './site-person.js?v=aset-7a2aad16c73b';
import {PERSON_IDENTITY_SLOTS, personPhotoGuide, personSlotDiagram} from './site-person-guides.js?v=aset-7a2aad16c73b';
import {
  FOUND_REPORT_MAX_PHOTOS, birthYearOptions, formatDate, formatMoment, foundPhotoProgress, foundReviewStateCopy,
  identityPhotoProgress, isoFromLocal, localNowValue, normalizeBirthMonth, normalizeBirthYear, renewalBadge,
} from './site-safecare-common.js?v=aset-7a2aad16c73b';
import {createBottomSheet, SHEET_PRESENTATION} from './site-bottom-sheet.js?v=aset-7a2aad16c73b';

const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';
const PHOTO_TYPES = new Set(PHOTO_ACCEPT.split(','));
const RELATIONSHIPS = Object.freeze([['CHILD', '자녀'], ['PARENT', '부모'], ['SPOUSE', '배우자'], ['FAMILY', '가족'], ['DEPENDENT', '돌봄 대상'], ['OTHER', '기타']]);
const SIGHTING_SLOT_LABELS = Object.freeze(['얼굴 정면', '얼굴 왼쪽', '얼굴 오른쪽', '상반신', '전신', '추가 사진 1', '추가 사진 2', '추가 사진 3', '추가 사진 4', '추가 사진 5']);
const STEPS = Object.freeze(['기본정보', '식별 사진 10장', '최종 확인', '등록 완료']);

const el = (tag, className = '', text = '') => { const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node; };
const fileDataUri = file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('PHOTO_READ_FAILED')); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
const relationshipLabel = value => RELATIONSHIPS.find(([code]) => code === value)?.[1] || '기타';
const validityLabel = days => days === 180 ? '6개월' : days === 365 ? '1년' : '';

export async function mountPersonCareManager({sessionToken, root, initialSurface = 'home'}) {
  const surface = el('div', 'person-care-surface');
  surface.dataset.personCareSurface = '';
  root.replaceChildren(surface);
  if (!sessionToken) {
    const empty = el('div', 'person-empty person-empty-panel');
    const login = el('a', 'site-button site-button-primary person-login-link', '로그인');
    login.href = '/auth/start/';
    empty.append(el('p', '', '로그인하면 사람 안심케어를 사용할 수 있습니다.'), login);
    surface.append(empty);
    return {};
  }
  const status = el('p', 'person-status'); status.setAttribute('role', 'status');
  const content = el('div', 'person-content');
  surface.append(status, content);

  let people = [], cases = [], notices = [], sightings = [];
  let identityPhotos = new Map();
  let busy = false;
  let disposed = false;
  let activeSheet = null;
  const availability = {sos: true, notices: true, sightings: true};
  const previews = new Map();
  // The view is the whole screen state: list, a person's register/photo
  // wizard, the SOS form, the found-report composer, or guardian notices.
  let view = {name: initialSurface === 'sighting' ? 'found' : initialSurface === 'notices' ? 'notices' : 'list'};

  const button = (label, action, primary = false) => {
    const node = el('button', primary ? 'site-button person-primary' : 'site-button site-button-secondary', label);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  };
  const showStatus = text => { status.textContent = text; };
  const fail = (target, error, fallback) => {
    target.textContent = personErrorMessage(error, fallback);
    target.hidden = false;
    const code = error && typeof error === 'object' && typeof error.code === 'string' ? error.code : '';
    if (code) target.dataset.personErrorCode = code; else delete target.dataset.personErrorCode;
  };
  const errorNode = () => { const node = el('p', 'person-error'); node.setAttribute('role', 'alert'); node.hidden = true; return node; };
  const partialAvailabilityMessage = () => Object.values(availability).every(Boolean)
    ? ''
    : '사람 등록과 사진 관리는 사용할 수 있습니다. 실종 관리와 발견 제보 연결을 준비 중입니다.';
  const revokeAll = () => { for (const url of previews.values()) URL.revokeObjectURL(url); previews.clear(); };

  const refresh = async () => {
    people = await listPeople(sessionToken);
    const optionalResults = await Promise.allSettled([
      listPersonSos(sessionToken),
      listGuardianNotices(sessionToken),
      listHumanSightings(sessionToken),
    ]);
    const [sosResult, noticeResult, sightingResult] = optionalResults;
    availability.sos = sosResult.status === 'fulfilled';
    availability.notices = noticeResult.status === 'fulfilled';
    availability.sightings = sightingResult.status === 'fulfilled';
    cases = availability.sos ? sosResult.value : [];
    notices = availability.notices ? noticeResult.value : [];
    sightings = availability.sightings ? sightingResult.value : [];
    const photoResults = await Promise.allSettled(people.map(async item => [item.personId, await listPersonIdentityPhotos(sessionToken, item.personId)]));
    identityPhotos = new Map(photoResults.map((result, index) => result.status === 'fulfilled' ? result.value : [people[index].personId, []]));
  };
  const reloadPerson = async personId => {
    const [person, photos] = await Promise.all([getPerson(sessionToken, personId), listPersonIdentityPhotos(sessionToken, personId)]);
    people = people.some(item => item.personId === personId) ? people.map(item => item.personId === personId ? person : item) : [...people, person];
    identityPhotos.set(personId, photos);
    return person;
  };
  const clearSheet = () => { activeSheet?.destroy(); activeSheet = null; };
  const go = next => { clearSheet(); view = next; render(); surface.scrollIntoView?.({block: 'start', behavior: 'smooth'}); };
  const backBar = (label = '목록으로') => { const bar = el('div', 'safecare-back'); bar.append(button(`← ${label}`, () => go({name: 'list'}))); return bar; };
  const activeCaseFor = personId => cases.find(record => record.personId === personId && record.status === 'ACTIVE');

  // ---------------------------------------------------------------- list
  const renderList = () => {
    const heading = el('div', 'person-section-heading');
    const headingCopy = el('div');
    headingCopy.append(el('h3', 'person-title', `등록된 사람${people.length ? ` ${people.length}` : ''}`), el('p', 'person-empty', '보호 대상의 사진 갱신과 실종 상태를 한곳에서 관리합니다.'));
    heading.append(headingCopy, button('사람 등록', () => go({name: 'register', step: 1, personId: ''}), true));

    const found = el('section', 'safecare-found-cta');
    found.dataset.safecareFoundCta = 'person';
    const foundCopy = el('div', 'safecare-found-cta-copy');
    foundCopy.append(el('strong', '', '도움이 필요해 보이는 사람을 발견했나요?'), el('span', '', 'LOTBI 등록 여부와 관계없이 발견 제보를 남길 수 있습니다.'));
    const foundButton = button('발견 제보하기', () => go({name: 'found', reportId: ''}));
    foundButton.classList.add('safecare-found-cta-button');
    foundButton.disabled = !availability.sightings;
    if (!availability.sightings) foundButton.title = '발견 제보 연결을 준비 중입니다.';
    found.append(foundCopy, foundButton);

    content.replaceChildren(heading);
    if (availability.notices && notices.some(item => item.status !== 'RESPONDED')) {
      const pending = notices.filter(item => item.status !== 'RESPONDED').length;
      const noticeButton = button(`관리자 승인 후보 ${pending}건 확인하기`, () => go({name: 'notices'}));
      noticeButton.classList.add('person-notice-button');
      content.append(noticeButton);
    }
    const list = el('div', 'person-list');
    list.dataset.personList = '';
    for (const item of people) list.append(personCard(item));
    if (!people.length) {
      const empty = el('div', 'person-empty person-empty-panel');
      empty.append(el('p', '', '아직 등록된 사람이 없습니다.'), el('p', '', '기본정보와 서로 다른 방향의 사진 10장을 등록하면 실종 시 바로 실종 상태로 전환할 수 있습니다.'));
      list.append(empty);
    }
    // The found report sits above the list so someone who has just found a
    // person sees it first, in its own box so it is never read as one of them.
    content.append(found, list);
  };

  const personCard = item => {
    const card = el('article', 'person-card');
    card.dataset.personCard = item.personId;
    const activeCase = activeCaseFor(item.personId);
    const badge = renewalBadge({state: item.identityPhotoState, daysRemaining: item.identityPhotoDaysRemaining});
    const head = el('div', 'person-card-head');
    const name = el('div', 'person-card-title');
    name.append(el('strong', 'person-card-name', item.displayName), el('span', 'person-card-meta', [relationshipLabel(item.relationship), item.birthYear ? `${item.birthYear}년 ${item.birthMonth}월생` : '출생정보 없음'].join(' · ')));
    const state = el('span', `person-state safecare-badge safecare-badge-${badge.tone}`, badge.label);
    state.dataset.personRenewalState = item.identityPhotoState || 'UNKNOWN';
    head.append(name, state);
    card.append(head);

    const facts = el('dl', 'person-card-facts');
    const fact = (term, value) => { if (!value) return; facts.append(el('dt', '', term), el('dd', '', value)); };
    fact('식별 사진', identityPhotoProgress(item.identityPhotoCount).label);
    if (item.identityPhotoExpiresAt) {
      const days = Number.isInteger(item.identityPhotoDaysRemaining) ? ` · ${Math.max(0, item.identityPhotoDaysRemaining)}일 남음` : '';
      fact('다음 갱신일', `${formatDate(item.identityPhotoExpiresAt)}${item.identityPhotoState === 'EXPIRED' ? ' · 기한 지남' : days}`);
    }
    if (item.identityPhotoValidityDays) fact('갱신 주기', validityLabel(item.identityPhotoValidityDays));
    card.append(facts);
    if (item.identityPhotoState === 'EXPIRING' && Number.isInteger(item.identityPhotoRenewalReminderDays)) {
      card.append(el('p', 'person-card-note', `갱신 안내: 만료 ${item.identityPhotoRenewalReminderDays}일 전입니다. 최신 사진으로 갱신해 주세요.`));
    } else if (item.identityPhotoState === 'EXPIRED') {
      card.append(el('p', 'person-card-note person-card-note-danger', '사진 유효기간이 지나 새로 실종 상태로 전환할 수 없습니다. 사진을 먼저 갱신해 주세요.'));
    } else if (item.identityPhotoState === 'BIRTH_INFO_REQUIRED') {
      card.append(el('p', 'person-card-note', '출생 연·월을 입력해야 갱신 주기를 계산하고 실종 상태로 전환할 수 있습니다.'));
    }

    if (activeCase) {
      const missing = el('div', 'safecare-sos-active');
      missing.dataset.personActiveSos = activeCase.sosId;
      missing.append(el('strong', '', '실종 상태 진행 중'));
      if (activeCase.lastSeenAt) missing.append(el('span', '', `마지막 목격 ${formatMoment(activeCase.lastSeenAt)}`));
      if (activeCase.lastSeenSummary) missing.append(el('span', '', activeCase.lastSeenSummary));
      missing.append(el('span', 'safecare-sos-active-note', '실종 기간 동안만 동의한 사진으로 후보를 찾고, 관리자가 검토한 뒤 보호자에게 확인을 요청합니다.'));
      const closeError = errorNode();
      const close = button('실종 종료', async () => {
        if (busy) return;
        busy = true; close.disabled = true;
        try { await closePersonSos(sessionToken, activeCase.sosId); await refresh(); showStatus('실종 상태를 종료했습니다.'); render(); }
        catch (error) { fail(closeError, error, '실종 상태를 종료하지 못했습니다.'); close.disabled = false; }
        finally { busy = false; }
      });
      close.dataset.personSosClose = activeCase.sosId;
      missing.append(close, closeError);
      card.append(missing);
    }

    const actions = el('div', 'person-card-actions');
    const complete = item.identityPhotoCount >= 10;
    const photoAction = button(complete ? '사진 갱신·관리' : '사진 등록 이어하기', () => go({name: 'register', step: 2, personId: item.personId, manage: complete}));
    photoAction.dataset.personPhotos = item.personId;
    const missingAction = button('실종 상태로 전환', () => go({name: 'sos', personId: item.personId}), true);
    missingAction.dataset.personSosOpen = item.personId;
    missingAction.disabled = !availability.sos;
    if (!availability.sos) missingAction.title = '실종 관리 연결을 준비 중입니다.';
    actions.append(photoAction);
    if (!activeCase) actions.append(missingAction);
    const edit = el('button', 'person-text-button', '정보 수정');
    edit.type = 'button';
    edit.addEventListener('click', () => go({name: 'register', step: 1, personId: item.personId, edit: true}));
    card.append(actions, edit);
    return card;
  };

  // ------------------------------------------------- register / photo wizard
  const stepper = active => {
    const list = el('ol', 'safecare-steps');
    list.setAttribute('aria-label', '등록 단계');
    STEPS.forEach((name, index) => {
      const number = index + 1;
      const item = el('li', 'safecare-step');
      item.dataset.safecareStep = String(number);
      item.dataset.safecareStepState = number < active ? 'done' : number === active ? 'active' : 'todo';
      if (number === active) item.setAttribute('aria-current', 'step');
      item.append(el('span', 'safecare-step-number', number < active ? '✓' : String(number)), el('span', 'safecare-step-name', name));
      list.append(item);
    });
    const wrap = el('div', 'safecare-stepper');
    wrap.append(el('p', 'safecare-step-label', `${active}단계 / ${STEPS.length}단계 · ${STEPS[active - 1]}`), list);
    return wrap;
  };

  const labeled = (text, control, hint = '') => {
    const field = el('label', 'site-field person-field');
    field.append(el('span', 'person-field-label', text), control);
    if (hint) field.append(el('span', 'person-field-hint', hint));
    return field;
  };

  const renderBasicStep = () => {
    const person = view.personId ? people.find(item => item.personId === view.personId) : null;
    content.replaceChildren(backBar());
    if (!view.edit) content.append(stepper(1));
    const form = el('form', 'person-form');
    form.dataset.personBasicForm = '';
    form.noValidate = true;
    const name = el('input'); name.required = true; name.maxLength = 80; name.autocomplete = 'off'; name.value = person?.displayName || '';
    const relationship = el('select');
    for (const [value, label] of RELATIONSHIPS) { const option = el('option', '', label); option.value = value; option.selected = value === (person?.relationship || 'CHILD'); relationship.append(option); }
    let selectedYear = normalizeBirthYear(person?.birthYear);
    let selectedMonth = normalizeBirthMonth(person?.birthMonth);
    const birth = el('div', 'site-field person-field person-birth-field');
    const birthTrigger = el('button', 'person-birth-trigger');
    birthTrigger.type = 'button';
    birthTrigger.dataset.personBirthTrigger = '';
    birthTrigger.setAttribute('aria-haspopup', 'dialog');
    birthTrigger.setAttribute('aria-expanded', 'false');
    const syncBirthTrigger = () => {
      birthTrigger.textContent = selectedYear && selectedMonth ? `${selectedYear}년 ${selectedMonth}월` : '출생 연월 선택';
      birthTrigger.dataset.hasValue = String(Boolean(selectedYear && selectedMonth));
    };
    syncBirthTrigger();
    birth.append(el('span', 'person-field-label', '출생 연월'), birthTrigger, el('span', 'person-field-hint', '태어난 연도와 월만 선택합니다. 날짜는 입력하지 않습니다.'));

    const openBirthPicker = () => {
      clearSheet();
      let pendingYear = selectedYear || new Date().getFullYear();
      let pendingMonth = selectedMonth || new Date().getMonth() + 1;
      const picker = el('section', 'person-birth-picker');
      picker.dataset.personBirthPicker = '';
      const title = el('h3', 'person-birth-picker-title', '출생 연월 선택');
      const instruction = el('p', 'person-field-hint', '연도와 월을 위아래로 스크롤한 뒤 확인을 눌러 주세요. 태어난 날은 받지 않습니다.');
      const wheels = el('div', 'person-birth-wheels');

      const wheel = (label, values, selected, dataName, onSelect) => {
        const column = el('div', 'person-birth-wheel-column');
        const wheelLabel = el('span', 'person-birth-wheel-label', label);
        const list = el('div', 'person-birth-wheel');
        list.setAttribute('role', 'listbox');
        list.setAttribute('aria-label', `${label} 선택`);
        list.tabIndex = 0;
        let scrollTimer = 0;
        const options = values.map(value => {
          const option = el('button', 'person-birth-wheel-option', `${value}${label === '연도' ? '년' : '월'}`);
          option.type = 'button';
          option.setAttribute('role', 'option');
          option.dataset[dataName] = String(value);
          option.setAttribute('aria-selected', String(value === selected));
          if (value === selected) option.classList.add('is-selected');
          option.addEventListener('click', () => select(option, true));
          list.append(option);
          return option;
        });
        const select = (option, center = false) => {
          for (const item of options) {
            const chosen = item === option;
            item.classList.toggle('is-selected', chosen);
            item.setAttribute('aria-selected', String(chosen));
          }
          onSelect(Number(option.dataset[dataName]));
          if (center) option.scrollIntoView({block: 'center', behavior: 'smooth'});
        };
        list.addEventListener('scroll', () => {
          clearTimeout(scrollTimer);
          scrollTimer = setTimeout(() => {
            const center = list.getBoundingClientRect().top + list.clientHeight / 2;
            const nearest = options.reduce((best, option) => Math.abs(option.getBoundingClientRect().top + option.offsetHeight / 2 - center) < Math.abs(best.getBoundingClientRect().top + best.offsetHeight / 2 - center) ? option : best, options[0]);
            if (nearest) select(nearest);
          }, 90);
        }, {passive: true});
        column.append(wheelLabel, list);
        queueMicrotask(() => options.find(option => option.classList.contains('is-selected'))?.scrollIntoView({block: 'center'}));
        return column;
      };

      wheels.append(
        wheel('연도', birthYearOptions(), pendingYear, 'personBirthYearOption', value => { pendingYear = value; }),
        wheel('월', Array.from({length: 12}, (_, index) => index + 1), pendingMonth, 'personBirthMonthOption', value => { pendingMonth = value; }),
      );
      const actions = el('div', 'person-birth-picker-actions');
      const confirm = el('button', 'site-button person-primary', '확인');
      confirm.type = 'button';
      confirm.dataset.personBirthConfirm = '';
      confirm.addEventListener('click', () => {
        selectedYear = normalizeBirthYear(pendingYear);
        selectedMonth = normalizeBirthMonth(pendingMonth);
        syncBirthTrigger();
        error.hidden = true;
        activeSheet?.close();
      });
      actions.append(confirm);
      picker.append(title, instruction, wheels, actions);
      activeSheet = createBottomSheet({
        label: '출생 연월 선택', content: picker, presentation: SHEET_PRESENTATION.SHEET, dismissLabel: '취소',
        onClose: () => { birthTrigger.setAttribute('aria-expanded', 'false'); activeSheet = null; },
      });
      birthTrigger.setAttribute('aria-expanded', 'true');
      activeSheet.open();
    };
    birthTrigger.addEventListener('click', openBirthPicker);
    const error = errorNode();
    const submit = el('button', 'site-button person-primary', view.edit ? '수정 저장' : '다음: 식별 사진 등록');
    submit.type = 'submit';
    form.append(
      el('h4', 'person-form-title', view.edit ? `${person?.displayName || ''} 정보 수정` : '기본정보'),
      labeled('이름', name), labeled('관계', relationship), birth,
      el('p', 'person-consent', '출생 연·월로 갱신 주기를 계산합니다. 만 12세 이하는 180일, 만 13세 이상은 365일마다 사진을 갱신하며 만료 30일·7일·1일 전에 알려드립니다.'),
      error, submit,
    );
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy) return;
      const year = normalizeBirthYear(selectedYear);
      const month = normalizeBirthMonth(selectedMonth);
      if (!name.value.trim()) { error.textContent = '이름을 입력해 주세요.'; error.hidden = false; name.focus(); return; }
      if (!year || !month) { error.textContent = '출생 연도와 월을 선택해 주세요.'; error.hidden = false; birthTrigger.focus(); return; }
      busy = true; submit.disabled = true; error.hidden = true; showStatus('저장 중…');
      try {
        let saved;
        if (person) saved = await updatePerson(sessionToken, {personId: person.personId, revision: person.revision, displayName: name.value.trim(), nickname: person.nickname || '', relationship: relationship.value, birthYear: year, birthMonth: month});
        else saved = await createPerson(sessionToken, {displayName: name.value.trim(), relationship: relationship.value, birthYear: year, birthMonth: month, requestKey: personRequestKey('create')});
        await reloadPerson(saved.personId);
        showStatus('');
        if (view.edit) { showStatus('정보를 저장했습니다.'); go({name: 'list'}); }
        else go({name: 'register', step: 2, personId: saved.personId});
      } catch (value) { showStatus(''); fail(error, value, '저장하지 못했습니다. 입력한 내용을 확인해 주세요.'); }
      finally { busy = false; submit.disabled = false; }
    });
    content.append(form);
    if (view.edit && person) {
      const danger = el('div', 'person-danger-zone');
      const remove = button('등록 삭제', () => { remove.hidden = true; confirm.hidden = false; });
      remove.classList.add('person-danger');
      const confirm = el('div', 'person-delete-confirm'); confirm.hidden = true;
      const confirmButton = button('삭제 확정', async () => {
        if (busy) return; busy = true;
        try { await deletePerson(sessionToken, person); await refresh(); showStatus('등록을 삭제했습니다.'); go({name: 'list'}); }
        catch (value) { fail(error, value, '삭제하지 못했습니다.'); }
        finally { busy = false; }
      });
      confirmButton.classList.add('person-danger');
      confirm.append(el('span', '', `"${person.displayName}" 등록과 사진을 삭제합니다. 되돌릴 수 없습니다.`), confirmButton);
      danger.append(remove, confirm);
      content.append(danger);
    }
    queueMicrotask(() => { if (!person) name.focus(); });
  };

  const photoTile = (person, slot, index, filledSlots, locked, onChange) => {
    const slotIndex = index + 1;
    const filled = filledSlots.has(slotIndex);
    const tile = el('figure', 'safecare-slot');
    tile.dataset.personSlot = slot.code;
    tile.dataset.safecareSlotFilled = filled ? 'true' : 'false';
    tile.dataset.safecareSlotLocked = locked ? 'true' : 'false';
    const media = el('div', 'safecare-slot-media');
    const key = `${person.personId}:${slotIndex}:${filledSlots.get(slotIndex)?.revision || 0}`;
    if (filled && previews.has(key)) {
      const image = el('img', 'safecare-slot-photo'); image.src = previews.get(key); image.alt = `${slot.label} 사진`; media.append(image);
    } else {
      media.append(personSlotDiagram(slot));
      if (filled) {
        void fetchPersonIdentityPhotoObjectUrl(sessionToken, person.personId, slotIndex).then(url => {
          if (disposed) { URL.revokeObjectURL(url); return; }
          previews.set(key, url);
          if (!media.isConnected) return;
          const image = el('img', 'safecare-slot-photo'); image.src = url; image.alt = `${slot.label} 사진`; media.replaceChildren(image);
        }).catch(() => {});
      }
    }
    const caption = el('figcaption', 'safecare-slot-caption');
    caption.append(el('span', 'safecare-slot-index', filled ? '✓' : String(slotIndex)), el('span', 'safecare-slot-label', slot.label));
    const hint = el('p', 'safecare-slot-hint', locked ? '정면 얼굴을 먼저 등록하면 선택할 수 있습니다.' : slot.hint);
    const input = el('input'); input.type = 'file'; input.accept = PHOTO_ACCEPT; input.hidden = true; input.dataset.personSlotInput = slot.code;
    const choose = el('button', 'site-button site-button-secondary safecare-slot-choose', filled ? '다른 사진 선택' : '사진 선택');
    choose.type = 'button'; choose.disabled = locked;
    choose.addEventListener('click', () => { if (!locked && !busy) input.click(); });
    const slotError = errorNode(); slotError.classList.add('safecare-slot-error');
    input.addEventListener('change', async () => {
      const file = input.files?.[0]; input.value = '';
      if (!file || busy || locked) return;
      if (!PHOTO_TYPES.has(file.type)) { slotError.textContent = 'JPG, PNG, WEBP 사진만 등록할 수 있습니다.'; slotError.hidden = false; return; }
      busy = true; tile.dataset.safecareSlotWorking = 'true'; slotError.hidden = true; showStatus(`${slot.label} 사진을 안전하게 저장하는 중…`);
      try { await putPersonIdentityPhoto(sessionToken, person.personId, slotIndex, await fileDataUri(file)); await reloadPerson(person.personId); showStatus(`${slot.label} 사진을 저장했습니다.`); onChange(); }
      catch (value) { showStatus(''); tile.dataset.safecareSlotWorking = 'false'; fail(slotError, value, '사진을 저장하지 못했습니다. 다른 방향에서 찍은 선명한 사진을 선택해 주세요.'); }
      finally { busy = false; }
    });
    tile.append(media, caption, hint, choose, slotError, input);
    return tile;
  };

  const renderPhotoStep = () => {
    const person = people.find(item => item.personId === view.personId);
    if (!person) { go({name: 'list'}); return; }
    content.replaceChildren(backBar());
    if (!view.manage) content.append(stepper(2));
    const photos = identityPhotos.get(person.personId) || [];
    const filledSlots = new Map(photos.map(photo => [photo.slotIndex, photo]));
    const progress = identityPhotoProgress(filledSlots.size);
    const header = el('div', 'safecare-photo-header');
    header.append(el('h4', 'person-form-title', view.manage ? `${person.displayName} 사진 갱신·관리` : `${person.displayName} 식별 사진 10장`));
    const counter = el('div', 'safecare-photo-counter');
    counter.dataset.safecarePhotoCount = String(progress.count);
    counter.append(el('strong', '', progress.label), el('span', '', progress.remainingLabel));
    header.append(counter);
    const bar = el('div', 'safecare-progress'); bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', '10'); bar.setAttribute('aria-valuenow', String(progress.count));
    const fill = el('span', 'safecare-progress-fill'); fill.style.width = `${progress.count * 10}%`; bar.append(fill);
    content.append(header, bar);
    if (view.manage) {
      const renewal = renewalBadge({state: person.identityPhotoState, daysRemaining: person.identityPhotoDaysRemaining});
      const note = el('p', `person-card-note safecare-badge-${renewal.tone}-text`);
      note.textContent = person.identityPhotoExpiresAt
        ? `사진 상태: ${renewal.label} · 다음 갱신일 ${formatDate(person.identityPhotoExpiresAt)}. 사진을 다시 선택하면 해당 방향의 사진이 최신 사진으로 바뀝니다.`
        : `사진 상태: ${renewal.label}. 사진을 다시 선택하면 해당 방향의 사진이 최신 사진으로 바뀝니다.`;
      content.append(note);
      if (activeCaseFor(person.personId)) content.append(el('p', 'person-card-note', '진행 중인 실종 상태는 전환 당시 사진으로 계속 비교합니다. 지금 바꾼 사진은 진행 중인 실종 비교에 반영되지 않습니다.'));
    }
    content.append(personPhotoGuide());
    const grid = el('div', 'safecare-slot-grid');
    grid.dataset.personSlotGrid = '';
    const frontFilled = filledSlots.has(1);
    PERSON_IDENTITY_SLOTS.forEach((slot, index) => grid.append(photoTile(person, slot, index, filledSlots, index > 0 && !frontFilled, () => render())));
    content.append(grid, el('p', 'person-consent', '같은 사진은 여러 방향에 사용할 수 없습니다. 사진은 계정에 비공개로 암호화 저장되고, 평소에는 검색에 사용되지 않습니다.'));
    const actions = el('div', 'person-form-actions safecare-wizard-actions');
    if (view.manage) actions.append(button('완료', () => go({name: 'list'}), true));
    else {
      actions.append(button('이전', () => go({name: 'register', step: 1, personId: person.personId})));
      const next = button('다음: 최종 확인', () => go({name: 'register', step: 3, personId: person.personId}), true);
      next.disabled = !progress.complete;
      next.dataset.personPhotosNext = '';
      actions.append(next);
      if (!progress.complete) actions.append(el('span', 'person-field-hint', `사진 ${progress.remaining}장을 더 등록하면 다음 단계로 이동할 수 있습니다.`));
    }
    content.append(actions);
  };

  const renderReviewStep = () => {
    const person = people.find(item => item.personId === view.personId);
    if (!person) { go({name: 'list'}); return; }
    content.replaceChildren(backBar(), stepper(3));
    const box = el('section', 'person-form');
    box.append(el('h4', 'person-form-title', '등록 내용을 마지막으로 확인해 주세요'));
    const facts = el('dl', 'person-review');
    const fact = (term, value) => facts.append(el('dt', '', term), el('dd', '', value));
    fact('이름', person.displayName);
    fact('관계', relationshipLabel(person.relationship));
    fact('출생', person.birthYear ? `${person.birthYear}년 ${person.birthMonth}월` : '출생정보 없음');
    fact('식별 사진', identityPhotoProgress(person.identityPhotoCount).label);
    if (person.identityPhotoValidityDays) fact('갱신 주기', validityLabel(person.identityPhotoValidityDays));
    box.append(facts, el('p', 'person-consent', '등록 사진은 평소 검색에 사용되지 않습니다. 실종 상태로 전환하며 동의한 기간에만 후보 검색과 관리자 검토에 사용합니다.'));
    const error = errorNode();
    const actions = el('div', 'person-form-actions safecare-wizard-actions');
    const finish = button('등록 완료', async () => {
      if (busy) return;
      busy = true; finish.disabled = true;
      try {
        const latest = await reloadPerson(person.personId);
        if (latest.identityPhotoCount < 10) { error.textContent = '식별 사진 10장이 모두 저장되지 않았습니다. 사진 단계에서 확인해 주세요.'; error.hidden = false; return; }
        go({name: 'register', step: 4, personId: person.personId});
      } catch (value) { fail(error, value, '등록 상태를 확인하지 못했습니다.'); }
      finally { busy = false; finish.disabled = false; }
    }, true);
    finish.dataset.personFinish = '';
    actions.append(button('이전', () => go({name: 'register', step: 2, personId: person.personId})), finish);
    box.append(error, actions);
    content.append(box);
  };

  const renderDoneStep = () => {
    const person = people.find(item => item.personId === view.personId);
    if (!person) { go({name: 'list'}); return; }
    content.replaceChildren(stepper(4));
    const box = el('section', 'person-form safecare-done');
    box.dataset.personRegisterDone = person.personId;
    box.append(el('h4', 'person-form-title', `${person.displayName} 등록이 완료되었습니다`));
    const facts = el('dl', 'person-review');
    facts.append(el('dt', '', '다음 사진 갱신일'), el('dd', '', person.identityPhotoExpiresAt ? formatDate(person.identityPhotoExpiresAt) : '목록에서 확인할 수 있습니다'));
    if (person.identityPhotoValidityDays) facts.append(el('dt', '', '갱신 주기'), el('dd', '', validityLabel(person.identityPhotoValidityDays)));
    box.append(facts, el('p', 'person-consent', '만료 30일·7일·1일 전에 갱신을 안내합니다. 실종 시 목록의 "실종 상태로 전환"을 눌러 주세요.'));
    const actions = el('div', 'person-form-actions');
    actions.append(button('목록으로', () => go({name: 'list'}), true));
    box.append(actions);
    content.append(box);
  };

  // ---------------------------------------------------------------- SOS
  const renderSos = () => {
    const person = people.find(item => item.personId === view.personId);
    if (!person) { go({name: 'list'}); return; }
    content.replaceChildren(backBar());
    const box = el('form', 'person-form');
    box.dataset.personSosForm = person.personId;
    box.noValidate = true;
    box.append(el('h4', 'person-form-title', `${person.displayName} 실종 상태로 전환`));
    if (!availability.sos) {
      box.append(el('p', 'person-empty person-empty-panel', '사람 등록과 사진 관리는 지금 사용할 수 있습니다. 실종 관리 연결은 준비 중입니다.'));
      content.append(box);
      return;
    }
    if (activeCaseFor(person.personId)) { go({name: 'list'}); return; }
    const eligible = person.hasPhoto && ['CURRENT', 'EXPIRING'].includes(person.identityPhotoState);
    if (!eligible) {
      const reason = person.identityPhotoState === 'EXPIRED'
        ? '식별 사진 유효기간이 지나 실종 상태로 전환할 수 없습니다. 최신 사진으로 먼저 갱신해 주세요.'
        : person.identityPhotoState === 'BIRTH_INFO_REQUIRED'
          ? '출생 연·월을 먼저 입력해 주세요. 사진 갱신 주기를 계산해야 실종 상태로 전환할 수 있습니다.'
          : '실종 상태로 전환하려면 최신 식별 사진 10장을 먼저 등록해 주세요.';
      const blocked = el('div', 'person-empty person-empty-panel');
      blocked.dataset.personSosBlocked = person.identityPhotoState || 'UNKNOWN';
      blocked.append(el('p', '', reason), button(person.identityPhotoState === 'BIRTH_INFO_REQUIRED' ? '정보 수정' : '사진 갱신·관리', () => go(person.identityPhotoState === 'BIRTH_INFO_REQUIRED' ? {name: 'register', step: 1, personId: person.personId, edit: true} : {name: 'register', step: 2, personId: person.personId, manage: person.identityPhotoCount >= 10}), true));
      box.append(blocked);
      content.append(box);
      return;
    }
    const lastSeenAt = el('input'); lastSeenAt.type = 'datetime-local'; lastSeenAt.value = localNowValue(); lastSeenAt.max = localNowValue();
    const location = el('input'); location.required = true; location.maxLength = 240; location.placeholder = '예: 서울시 마포구 망원한강공원 입구';
    const description = el('textarea'); description.maxLength = 1000; description.placeholder = '옷차림, 소지품, 당시 상황 등';
    const consent = el('label', 'person-consent-check');
    const checkbox = el('input'); checkbox.type = 'checkbox'; checkbox.required = true;
    consent.append(checkbox, el('span', '', '등록 사진을 활성 SOS 기간 동안만 비공개 후보 검색과 관리자 검토에 사용하는 데 동의합니다.'));
    const error = errorNode();
    const submit = el('button', 'site-button person-primary', '동의하고 실종 상태로 전환'); submit.type = 'submit';
    box.append(
      labeled('실종 날짜·시간', lastSeenAt), labeled('마지막으로 본 장소', location), labeled('당시 특징·기타 (선택)', description),
      el('p', 'person-consent', '실종 상태로 전환하면 동의한 사진으로 발견 제보와 비교합니다. AI가 같은 사람이라고 확정하지 않으며, 후보는 관리자 검토 후 보호자에게 확인을 요청합니다.'),
      consent, error, submit,
    );
    box.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy) return;
      const when = isoFromLocal(lastSeenAt.value);
      if (!when) { error.textContent = '실종 날짜와 시간을 입력해 주세요.'; error.hidden = false; return; }
      if (!location.value.trim()) { error.textContent = '마지막으로 본 장소를 입력해 주세요.'; error.hidden = false; location.focus(); return; }
      if (!checkbox.checked) { error.textContent = '실종 기간 동안 사진 사용에 동의해 주세요.'; error.hidden = false; return; }
      busy = true; submit.disabled = true; error.hidden = true;
      try { await createPersonSos(sessionToken, {personId: person.personId, lastSeenAt: when, lastSeenSummary: location.value.trim(), description: description.value.trim(), matchingConsentConfirmed: true}); await refresh(); showStatus(`${person.displayName} 실종 상태로 전환했습니다.`); go({name: 'list'}); }
      catch (value) { fail(error, value, '실종 상태로 전환하지 못했습니다. 사진 10장과 갱신 상태, 동의를 확인해 주세요.'); }
      finally { busy = false; submit.disabled = false; }
    });
    content.append(box);
  };

  // ------------------------------------------------------- found report
  // A report may start from one photo. Until the reporter gives a time and a
  // place, photos stay in this browser tab only; from then on Core's own DRAFT
  // report holds them. Submit opens at five photos and adding stops at ten.
  let composer = null;
  const freshComposer = () => ({reportId: '', report: null, pending: new Map(), saved: new Map(), observedAt: localNowValue(), location: '', description: ''});
  const composerCount = () => new Set([...composer.pending.keys(), ...composer.saved.keys()]).size;
  const nextFreeSlot = () => { for (let slot = 1; slot <= FOUND_REPORT_MAX_PHOTOS; slot += 1) if (!composer.pending.has(slot) && !composer.saved.has(slot)) return slot; return 0; };
  const dropComposer = () => { if (!composer) return; for (const item of composer.pending.values()) URL.revokeObjectURL(item.url); composer = null; };

  const openComposer = async reportId => {
    dropComposer();
    composer = freshComposer();
    if (!reportId) return;
    const report = sightings.find(item => item.reportId === reportId);
    if (!report || report.reviewState !== 'DRAFT') return;
    composer.reportId = report.reportId; composer.report = report;
    composer.location = report.locationSummary || ''; composer.description = report.description || '';
    const photos = await listHumanSightingPhotos(sessionToken, report.reportId);
    composer.saved = new Map(photos.map(photo => [photo.slotIndex, photo]));
  };

  const createDraftAndFlush = async () => {
    if (!composer.reportId) {
      const created = await createHumanSighting(sessionToken, {observedAt: isoFromLocal(composer.observedAt), locationSummary: composer.location.trim(), description: composer.description.trim()});
      composer.reportId = created.reportId; composer.report = created;
    }
    for (const [slot, item] of [...composer.pending.entries()].sort((a, b) => a[0] - b[0])) {
      const photo = await putHumanSightingPhoto(sessionToken, composer.reportId, slot, await fileDataUri(item.file));
      composer.saved.set(slot, photo);
      URL.revokeObjectURL(item.url);
      composer.pending.delete(slot);
    }
  };

  const renderFound = () => {
    content.replaceChildren(backBar());
    if (!availability.sightings) {
      content.append(el('p', 'person-empty person-empty-panel', '사람 등록과 사진 관리는 지금 사용할 수 있습니다. 발견 제보 연결은 준비 중입니다.'));
      return;
    }
    if (!composer) composer = freshComposer();
    const box = el('section', 'person-form safecare-found');
    box.dataset.personFoundComposer = composer.reportId || 'new';
    box.append(
      el('h4', 'person-form-title', '사람 발견 제보'),
      el('p', 'person-consent', '즉시 일치 여부를 알려드리지 않습니다. 사진 5장 이상을 받은 뒤 실종 상태로 등록되고 동의된 대상과만 비교하고, 비교 후보는 관리자가 검토합니다.'),
    );

    const count = composerCount();
    const progress = foundPhotoProgress(count);
    const counter = el('div', 'safecare-photo-counter');
    counter.dataset.safecareFoundCount = String(progress.count);
    counter.append(el('strong', '', `사진 ${progress.count}장`), el('span', '', progress.message));
    const bar = el('div', 'safecare-progress safecare-progress-found'); bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', String(FOUND_REPORT_MAX_PHOTOS)); bar.setAttribute('aria-valuenow', String(progress.count));
    const fill = el('span', 'safecare-progress-fill'); fill.style.width = `${progress.count * 10}%`; bar.append(fill, el('span', 'safecare-progress-mark', '5장'));
    box.append(counter, bar);

    const photoError = errorNode();
    const grid = el('div', 'safecare-slot-grid safecare-found-grid');
    grid.dataset.personFoundGrid = '';
    for (let slot = 1; slot <= FOUND_REPORT_MAX_PHOTOS; slot += 1) {
      const pending = composer.pending.get(slot);
      const saved = composer.saved.get(slot);
      if (!pending && !saved) continue;
      const tile = el('figure', 'safecare-slot');
      tile.dataset.safecareSlotFilled = 'true';
      tile.dataset.personFoundSlot = String(slot);
      tile.dataset.personFoundSaved = saved ? 'true' : 'false';
      const media = el('div', 'safecare-slot-media');
      if (pending) { const image = el('img', 'safecare-slot-photo'); image.src = pending.url; image.alt = `발견 사진 ${slot}`; media.append(image); }
      else {
        media.append(el('span', 'safecare-slot-loading', '사진'));
        const key = `sighting:${composer.reportId}:${slot}:${saved.revision}`;
        const show = url => { const image = el('img', 'safecare-slot-photo'); image.src = url; image.alt = `발견 사진 ${slot}`; media.replaceChildren(image); };
        if (previews.has(key)) show(previews.get(key));
        else void fetchHumanSightingPhotoObjectUrl(sessionToken, composer.reportId, slot).then(url => { if (disposed) { URL.revokeObjectURL(url); return; } previews.set(key, url); if (media.isConnected) show(url); }).catch(() => {});
      }
      const caption = el('figcaption', 'safecare-slot-caption');
      caption.append(el('span', 'safecare-slot-index', String(slot)), el('span', 'safecare-slot-label', SIGHTING_SLOT_LABELS[slot - 1]));
      const state = el('p', 'safecare-slot-hint', saved ? '서버에 저장됨' : '이 화면에만 보관 중');
      const remove = el('button', 'person-text-button', '삭제'); remove.type = 'button';
      remove.addEventListener('click', async () => {
        if (busy) return;
        if (pending) { URL.revokeObjectURL(pending.url); composer.pending.delete(slot); render(); return; }
        busy = true;
        try { await deleteHumanSightingPhoto(sessionToken, composer.reportId, slot); composer.saved.delete(slot); render(); }
        catch (value) { fail(photoError, value, '사진을 삭제하지 못했습니다.'); }
        finally { busy = false; }
      });
      tile.append(media, caption, state, remove);
      grid.append(tile);
    }
    const input = el('input'); input.type = 'file'; input.accept = PHOTO_ACCEPT; input.hidden = true; input.dataset.personFoundInput = '';
    const add = el('button', 'site-button site-button-secondary safecare-add-photo', progress.count === 0 ? '사진 선택으로 작성 시작' : '사진 추가');
    add.type = 'button'; add.disabled = !progress.canAdd; add.dataset.personFoundAdd = '';
    add.addEventListener('click', () => { if (!busy && progress.canAdd) input.click(); });
    input.addEventListener('change', async () => {
      const file = input.files?.[0]; input.value = '';
      if (!file || busy) return;
      if (!PHOTO_TYPES.has(file.type)) { photoError.textContent = 'JPG, PNG, WEBP 사진만 등록할 수 있습니다.'; photoError.hidden = false; return; }
      const slot = nextFreeSlot();
      if (!slot) return;
      photoError.hidden = true;
      if (!composer.reportId) { composer.pending.set(slot, {file, url: URL.createObjectURL(file)}); render(); return; }
      busy = true; showStatus('사진을 안전하게 저장하는 중…');
      try { composer.saved.set(slot, await putHumanSightingPhoto(sessionToken, composer.reportId, slot, await fileDataUri(file))); showStatus(''); render(); }
      catch (value) { showStatus(''); fail(photoError, value, '사진을 저장하지 못했습니다.'); }
      finally { busy = false; }
    });
    box.append(grid, input, add, photoError);

    const details = el('fieldset', 'safecare-found-details');
    details.append(el('legend', '', '발견 정보'));
    const locked = Boolean(composer.reportId);
    const observedAt = el('input'); observedAt.type = 'datetime-local'; observedAt.value = composer.report?.observedAt ? localNowValue(new Date(composer.report.observedAt)) : composer.observedAt; observedAt.max = localNowValue(); observedAt.disabled = locked;
    const location = el('input'); location.maxLength = 240; location.placeholder = '예: 성남시 분당구 정자역 2번 출구 앞'; location.value = composer.location; location.disabled = locked;
    const description = el('textarea'); description.maxLength = 1000; description.placeholder = '외형, 옷차림, 특징 (선택)'; description.value = composer.description; description.disabled = locked;
    observedAt.addEventListener('input', () => { composer.observedAt = observedAt.value; });
    location.addEventListener('input', () => { composer.location = location.value; syncDraftButton(); });
    description.addEventListener('input', () => { composer.description = description.value; });
    details.append(labeled('발견 날짜·시간', observedAt), labeled('발견 장소', location), labeled('외형·옷차림·특징 (선택)', description));
    details.append(el('p', 'person-field-hint', locked ? '작성 중 저장된 제보입니다. 발견 정보는 저장 후 바꿀 수 없습니다.' : '발견 정보를 입력하고 "작성 중 저장"을 누르면 사진이 서버의 작성 중 제보로 저장됩니다. 저장 전에는 이 화면을 닫으면 사진이 사라집니다.'));
    box.append(details);

    const error = errorNode();
    const actions = el('div', 'person-form-actions safecare-wizard-actions');
    const draftButton = button('작성 중 저장', async () => {
      if (busy) return;
      if (!isoFromLocal(composer.observedAt) || !composer.location.trim()) { error.textContent = '발견 날짜·시간과 장소를 입력해 주세요.'; error.hidden = false; return; }
      busy = true; draftButton.disabled = true; error.hidden = true; showStatus('작성 중 제보를 저장하는 중…');
      try { await createDraftAndFlush(); sightings = await listHumanSightings(sessionToken); showStatus('작성 중 제보를 저장했습니다.'); render(); }
      catch (value) { showStatus(''); fail(error, value, '작성 중 제보를 저장하지 못했습니다.'); draftButton.disabled = false; }
      finally { busy = false; }
    });
    draftButton.dataset.personFoundDraft = '';
    const syncDraftButton = () => { draftButton.hidden = locked || count === 0; draftButton.disabled = !composer.location.trim(); };
    syncDraftButton();
    const submit = button('최종 제출', async () => {
      if (busy || !progress.canSubmit) return;
      if (!isoFromLocal(composer.observedAt) || !composer.location.trim()) { error.textContent = '발견 날짜·시간과 장소를 입력해 주세요.'; error.hidden = false; location.focus(); return; }
      busy = true; submit.disabled = true; error.hidden = true; showStatus('제보를 제출하는 중…');
      try {
        await createDraftAndFlush();
        const submitted = await submitHumanSighting(sessionToken, composer.reportId);
        dropComposer();
        sightings = await listHumanSightings(sessionToken);
        showStatus(foundReviewStateCopy(submitted.reviewState).detail);
        go({name: 'found', reportId: '', submittedId: submitted.reportId});
      } catch (value) { showStatus(''); fail(error, value, '제보를 제출하지 못했습니다. 서로 다른 방향의 사진 5장 이상인지 확인해 주세요.'); }
      finally { busy = false; submit.disabled = !progress.canSubmit; }
    }, true);
    submit.disabled = !progress.canSubmit;
    submit.setAttribute('aria-disabled', progress.canSubmit ? 'false' : 'true');
    submit.dataset.personFoundSubmit = '';
    actions.append(draftButton, submit);
    if (!progress.canSubmit) actions.append(el('span', 'person-field-hint safecare-submit-hint', `최종 제출은 사진 5장부터 가능합니다.${progress.needed ? ` (${progress.needed}장 더 필요)` : ''}`));
    box.append(error, actions);
    content.append(box);

    const mine = sightings.filter(item => item.reportId !== composer.reportId);
    if (mine.length) {
      const history = el('section', 'safecare-report-list');
      history.dataset.personFoundHistory = '';
      history.append(el('h4', 'person-form-title', '내 발견 제보'));
      for (const report of mine) {
        const copy = foundReviewStateCopy(report.reviewState);
        const card = el('article', 'person-card safecare-report');
        card.dataset.personFoundReport = report.reportId;
        card.dataset.safecareReviewState = report.reviewState || '';
        if (report.reportId === view.submittedId) card.dataset.safecareJustSubmitted = 'true';
        const head = el('div', 'person-card-head');
        head.append(el('strong', '', report.locationSummary || '발견 제보'), el('span', `safecare-badge safecare-badge-${copy.tone}`, copy.label));
        card.append(head, el('p', 'person-card-meta', `${formatMoment(report.observedAt)} · 사진 ${report.photoCount}장`), el('p', 'person-consent', copy.detail));
        if (report.reviewState === 'DRAFT') card.append(button('이어서 작성', async () => { if (busy) return; busy = true; try { await openComposer(report.reportId); render(); } catch (value) { fail(error, value, '작성 중 제보를 열지 못했습니다.'); } finally { busy = false; } }));
        history.append(card);
      }
      content.append(history);
    }
  };

  // ---------------------------------------------------- guardian notices
  const renderNotices = () => {
    content.replaceChildren(backBar(), el('h3', 'person-title', '관리자 승인 후보'));
    content.append(el('p', 'person-consent', '관리자가 검토한 후보입니다. 점수는 동일인 확률이 아니며, 같은 사람인지는 보호자가 직접 확인합니다.'));
    for (const item of notices) {
      const card = el('article', 'person-card');
      card.append(el('strong', '', `${item.displayName} 후보`), el('p', '', '점수는 동일인 확률이 아니며 연락처는 공개되지 않습니다.'));
      if (item.status === 'RESPONDED') card.append(el('p', 'person-result', `응답: ${({LIKELY_MINE: '같은 사람 같아요', NOT_MINE: '아니에요', UNSURE: '모르겠어요'})[item.response] || '확인 완료'}`));
      else {
        const row = el('div', 'person-card-actions');
        for (const [value, label] of [['LIKELY_MINE', '같은 사람 같아요'], ['NOT_MINE', '아니에요'], ['UNSURE', '모르겠어요']]) {
          row.append(button(label, async () => { if (busy) return; busy = true; try { await respondGuardianNotice(sessionToken, item.noticeId, value); await refresh(); render(); } catch (error) { showStatus(personErrorMessage(error, '응답을 저장하지 못했습니다.')); } finally { busy = false; } }));
        }
        card.append(row);
      }
      content.append(card);
    }
    if (!notices.length) content.append(el('p', 'person-empty', '확인할 후보가 없습니다.'));
  };

  const render = () => {
    if (disposed) return;
    surface.dataset.personView = view.name;
    if (view.name === 'register') {
      if (view.step === 1) renderBasicStep();
      else if (view.step === 2) renderPhotoStep();
      else if (view.step === 3) renderReviewStep();
      else renderDoneStep();
    } else if (view.name === 'sos') renderSos();
    else if (view.name === 'found') renderFound();
    else if (view.name === 'notices') renderNotices();
    else renderList();
    if (view.name === 'list' && !status.textContent) showStatus(partialAvailabilityMessage());
  };

  showStatus('사람 안심케어 정보를 불러오는 중입니다.');
  content.replaceChildren(el('p', 'person-empty safecare-loading', '불러오는 중…'));
  try { await refresh(); showStatus(''); render(); }
  catch (error) {
    showStatus('');
    const failed = el('div', 'person-empty person-empty-panel');
    failed.append(el('p', '', personErrorMessage(error, '사람 등록 정보를 불러오지 못했습니다.')), button('다시 시도', async () => { try { await refresh(); render(); } catch {} }));
    content.replaceChildren(failed);
  }
  return {dispose() { disposed = true; clearSheet(); dropComposer(); revokeAll(); root.replaceChildren(); }};
}
