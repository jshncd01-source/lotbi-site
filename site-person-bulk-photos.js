// SAFECARE-PHOTO-BULK-UPLOAD-01 — pick up to ten identity photos at once.
//
// Core's classify call (POST …/identity-photos/classify) only says which slot
// kinds its unchanged intake gate would take for a photo: it stores nothing and
// compares no people. Every photo is then saved with the same per-slot PUT the
// single-slot tiles use, which re-runs the whole gate, the same-person check
// and the duplicate check. So on this screen:
//   - a photo never goes into a slot outside its suggested list,
//   - a slot that already holds a photo is replaced only when the guardian
//     picks it,
//   - photos are saved one by one, fronts first (1, 8, 2, 3, 9, 10, 6, 4, 5, 7),
//     and nothing but a front goes in while slot 1 is empty,
//   - a stored photo stays stored when a later one is refused (each PUT is its
//     own save; nothing is deleted or rolled back),
//   - no sentence says or implies that the photos show the same person.
// The single-slot tiles keep working unchanged; while a run is active the
// shared `busy` flag makes them answer "다른 사진을 확인하는 중입니다…".
import {
  classifyPersonIdentityPhoto, personErrorMessage, personIdentityPhotoErrorMessage, putPersonIdentityPhoto,
} from './site-person.js?v=aset-1bd92d88e20a';
import {PERSON_IDENTITY_SLOTS} from './site-person-guides.js?v=aset-1bd92d88e20a';
import {PERSON_PHOTO_ACCEPT, personPhotoPrepareMessage, preparePersonPhoto} from './site-person-photo-intake.js?v=aset-1bd92d88e20a';

export const PERSON_BULK_MAX_FILES = 10;
export const PERSON_BULK_UPLOAD_ORDER = Object.freeze([1, 8, 2, 3, 9, 10, 6, 4, 5, 7]);
export const PERSON_BULK_WARNING = '정확한 비교를 위해 동일한 사람의 사진만 등록해 주세요. 다른 사람이나 동물·사물 사진이 섞이면 등록이 제한될 수 있습니다.';
export const PERSON_BULK_ANGLE_GUIDE = '정면·좌우 45도·좌우 옆면·상반신·전신처럼 서로 다른 각도로 찍은 사진을 준비해 주세요.';
export const PERSON_BULK_ANCHOR_HINT = '정면 사진이 다른 사람일 수 있어요. 정면 사진을 먼저 확인해 주세요.';
export const PERSON_BULK_FRONT_FIRST = '정면 얼굴 사진이 없어 다른 사진은 아직 등록하지 않았어요. 정면 얼굴 사진을 먼저 등록해 주세요.';
export const PERSON_BULK_UNAVAILABLE = '여러 장 한 번에 등록은 지금 사용할 수 없어요. 아래 칸에서 사진을 한 장씩 등록해 주세요. 고른 사진은 저장하지 않았어요.';

const FRONT_FIRST_NOTE = '정면 얼굴 사진을 먼저 등록해 주세요.';
const BUSY_MESSAGE = '다른 사진을 확인하는 중입니다. 끝난 뒤 다시 선택해 주세요.';
// Same fallback as the single-slot tile, so one refusal reads the same in both.
const PUT_FALLBACK = '사진을 저장하지 못했습니다. 안내 그림과 같은 방향에서 찍은 선명한 사진을 선택해 주세요.';
const CLASSIFY_FALLBACK = '사진을 확인하지 못했습니다. 잠시 후 다시 시도하거나 다른 사진을 선택해 주세요.';
const REJECT_FALLBACK = '이 사진은 식별 사진으로 등록할 수 없습니다. 다른 사진을 선택해 주세요.';
const STOP_FALLBACK = '사진을 확인하지 못했습니다. 화면을 새로 열어 주세요.';

const FAILED_STATES = new Set(['PREPARE_FAILED', 'CLASSIFY_FAILED', 'REJECTED', 'PUT_FAILED']);
const PENDING_STATES = new Set(['NEEDS_CHOICE', 'HELD']);
// States whose replacement goes into the slot the photo was meant for.
const INTENDED_STATES = new Set(['PUT_FAILED', 'HELD']);

// ------------------------------------------------------------ pure rules
const slotOf = index => PERSON_IDENTITY_SLOTS[index - 1] || null;
export const personBulkSlotLabel = index => slotOf(index)?.label || `${index}번`;

// The first ten picked files; the rest are only counted.
export function limitPersonBulkFiles(files) {
  const list = Array.from(files || []);
  return {kept: list.slice(0, PERSON_BULK_MAX_FILES), dropped: Math.max(0, list.length - PERSON_BULK_MAX_FILES)};
}
export function personBulkTooManyMessage(total) {
  return `사진은 한 번에 최대 ${PERSON_BULK_MAX_FILES}장까지 등록할 수 있어 앞의 ${PERSON_BULK_MAX_FILES}장만 사용해요. (${total}장 중 ${total - PERSON_BULK_MAX_FILES}장 제외)`;
}
export const personBulkClassifyProgress = (done, total) => `AI가 사진을 분류하고 있어요 (${done}/${total})`;
export const personBulkUploadProgress = (done, total) => `사진을 등록하고 있어요 (${done}/${total})`;
export function personBulkMismatchMessage(slotIndex) {
  const label = personBulkSlotLabel(slotIndex);
  return `새 사진은 ${label} 칸에 맞지 않아요. ${label} 칸에 맞는 사진을 선택해 주세요.`;
}

// entries: one per picked photo, {status, suggested} from classify or null
// (not classified). filled: slot indexes already holding a photo on Core.
// CLEAR photos with fewer candidate slots are placed first, each into the first
// slot of its own list that is still empty. Returns one decision per entry:
// {state: 'ASSIGNED', slot} | {state: 'NEEDS_CHOICE', reason, candidates} |
// {state: 'NOT_PLACED'}.
export function assignPersonBulkPhotos(entries, filled = []) {
  const taken = new Set(filled);
  const decisions = entries.map(entry => (entry?.status === 'UNCERTAIN'
    ? {state: 'NEEDS_CHOICE', reason: 'UNCERTAIN', candidates: [...entry.suggested]}
    : {state: 'NOT_PLACED'}));
  const clear = entries
    .map((entry, index) => ({entry, index}))
    .filter(({entry}) => entry?.status === 'CLEAR' && entry.suggested?.length)
    .sort((a, b) => a.entry.suggested.length - b.entry.suggested.length || a.index - b.index);
  for (const {entry, index} of clear) {
    const slot = entry.suggested.find(value => !taken.has(value));
    if (slot) {
      taken.add(slot);
      decisions[index] = {state: 'ASSIGNED', slot};
    } else {
      decisions[index] = {state: 'NEEDS_CHOICE', reason: 'NO_FREE_SLOT', candidates: [...entry.suggested]};
    }
  }
  return decisions;
}

// Fronts first: the first stored photos are the best same-person references.
export function orderPersonBulkUploads(items, slotFor = item => item.slot) {
  const rank = slot => {
    const at = PERSON_BULK_UPLOAD_ORDER.indexOf(slot);
    return at < 0 ? PERSON_BULK_UPLOAD_ORDER.length : at;
  };
  return [...items].sort((a, b) => rank(slotFor(a)) - rank(slotFor(b)));
}

// Slot 1 empty on Core and no photo of the batch going there: upload nothing.
export function personBulkNeedsFrontFirst(assignedSlots, filled = []) {
  return assignedSlots.length > 0 && !new Set(filled).has(1) && !assignedSlots.includes(1);
}

// log: the batch's uploads in order, [{slot, ok, code}]. The anchor is slot 1
// stored by this batch on a profile that had no photo before it.
export function personBulkAnchorSuspect(log, profileWasEmpty) {
  if (!profileWasEmpty) return false;
  const anchorAt = log.findIndex(entry => entry.slot === 1 && entry.ok);
  if (anchorAt < 0) return false;
  const later = log.slice(anchorAt + 1);
  const differentPerson = later.filter(entry => !entry.ok && entry.code === 'PERSON_IDENTITY_PHOTO_DIFFERENT_PERSON').length;
  return differentPerson >= 2 && !later.some(entry => entry.ok);
}

// A needs-confirmation photo may take any slot of its own list except one this
// batch has just filled with another photo.
export function personBulkChoiceSlots(candidates, batchStored = []) {
  const used = new Set(batchStored);
  return candidates.filter(slot => !used.has(slot));
}

// Where a replacement photo goes. intendedSlot: the slot the replaced photo was
// meant for (0 when it had none). Never a slot outside the new photo's list.
export function personBulkReplacementPlan({intendedSlot = 0, status, suggested = [], filled = []}) {
  if (status === 'REJECTED') return {action: 'REJECTED'};
  const taken = new Set(filled);
  let slot = intendedSlot;
  if (slot) {
    if (!suggested.includes(slot)) return {action: 'MISMATCH'};
  } else {
    if (status === 'UNCERTAIN') return {action: 'CHOOSE', reason: 'UNCERTAIN', candidates: [...suggested]};
    slot = suggested.find(value => !taken.has(value)) || 0;
    if (!slot) return {action: 'CHOOSE', reason: 'NO_FREE_SLOT', candidates: [...suggested]};
  }
  if (slot !== 1 && !taken.has(1)) return {action: 'HOLD', slot};
  return {action: 'PUT', slot};
}

export function personBulkSummary(items) {
  const stored = items.filter(item => item.state === 'STORED').length;
  const failed = items.filter(item => FAILED_STATES.has(item.state)).length;
  const pending = items.filter(item => PENDING_STATES.has(item.state)).length;
  return Object.freeze({stored, failed, pending, text: `등록 성공 ${stored}장 · 실패 ${failed}장 · 확인 필요 ${pending}장`});
}

// ------------------------------------------------------------ screen
const el = (tag, className = '', text = '') => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};
const errorCode = error => (error && typeof error === 'object' && typeof error.code === 'string' ? error.code : '');
// Errors after which no other photo of the run can succeed either.
function stopFor(error) {
  const status = Number(error?.status) || 0;
  const code = errorCode(error);
  if (code === 'SESSION_REQUIRED' || status === 401 || status === 403) return personErrorMessage(error, STOP_FALLBACK);
  if ((status === 404 || status === 405) && (!code || code.startsWith('HTTP_'))) return PERSON_BULK_UNAVAILABLE;
  if (status === 404) return personErrorMessage(error, STOP_FALLBACK);
  return '';
}

const STATE_BADGES = Object.freeze({
  STORED: {label: '등록 성공', tone: 'ok'},
  PREPARE_FAILED: {label: '실패', tone: 'danger'},
  CLASSIFY_FAILED: {label: '실패', tone: 'danger'},
  REJECTED: {label: '실패', tone: 'danger'},
  PUT_FAILED: {label: '실패', tone: 'danger'},
  NEEDS_CHOICE: {label: '확인 필요', tone: 'warning'},
  HELD: {label: '확인 필요', tone: 'warning'},
  SKIPPED: {label: '건너뜀', tone: 'neutral'},
});
const WORKING_BADGE = Object.freeze({label: '확인 중', tone: 'progress'});

export function createPersonBulkPhotos({
  sessionToken, personId,
  isBusy = () => false, setBusy = () => {}, reload = async () => {}, rerender = () => {}, isDisposed = () => false,
  classify = classifyPersonIdentityPhoto, putPhoto = putPersonIdentityPhoto, prepare = preparePersonPhoto,
} = {}) {
  let items = [];
  let nextId = 1;
  let notices = [];
  let frontNote = '';
  let uploadLog = [];
  let anchorSuspect = false;
  let running = false;
  let progress = {text: '', done: 0, total: 0};
  let focusSummary = false;
  let announcement = '';  // read out by the status line once an action has finished
  const batchStored = new Set();
  const filled = new Set();  // slots holding a photo on Core (only grows: photos are replaced, not removed)
  let view = null;

  const newItem = (file, title = '') => {
    const id = nextId;
    nextId += 1;
    return {id, title: title || `사진 ${id}`, file, dataUri: '', thumb: null, classification: null, state: 'NEW', slot: 0, reason: '', candidates: [], message: '', note: '', code: ''};
  };
  const setPhoto = (item, dataUri) => { if (item.dataUri !== dataUri) { item.dataUri = dataUri; item.thumb = null; } };
  const say = text => {
    if (!view) return;
    view.alert.textContent = text;
    view.alert.hidden = !text;
  };
  const markSurface = value => {
    const surface = view?.section?.closest?.('[data-person-care-surface]');
    if (!surface) return;
    if (value) surface.dataset.personBulkRunning = 'true'; else delete surface.dataset.personBulkRunning;
  };
  const setProgress = (text, done = 0, total = 0) => { progress = {text, done, total}; paint(); };

  async function prepareFile(file) {
    try { return {dataUri: (await prepare(file)).dataUri, error: ''}; }
    catch (error) { return {dataUri: '', error: personPhotoPrepareMessage(error)}; }
  }

  // One PUT. A success is final: it is never undone by a later refusal.
  async function putItem(item, slot) {
    try {
      await putPhoto(sessionToken, personId, slot, item.dataUri);
      Object.assign(item, {state: 'STORED', slot, message: '', note: '', code: ''});
      filled.add(slot);
      batchStored.add(slot);
      return {ok: true, code: ''};
    } catch (error) {
      const code = errorCode(error);
      Object.assign(item, {state: 'PUT_FAILED', slot, code, note: '', message: personIdentityPhotoErrorMessage(error, slotOf(slot), PUT_FALLBACK)});
      return {ok: false, code, stop: stopFor(error)};
    }
  }

  // Sequential, in the order given; slot 1 empty holds everything else.
  async function uploadQueue(queue, log = false) {
    for (const [index, item] of queue.entries()) {
      if (isDisposed()) return;
      if (item.slot !== 1 && !filled.has(1)) {
        for (const rest of queue.slice(index)) if (rest.state === 'ASSIGNED') rest.state = 'HELD';
        if (!notices.includes(PERSON_BULK_FRONT_FIRST)) notices.push(PERSON_BULK_FRONT_FIRST);
        return;
      }
      setProgress(personBulkUploadProgress(index + 1, queue.length), index, queue.length);
      const outcome = await putItem(item, item.slot);
      if (log) uploadLog.push({slot: item.slot, ok: outcome.ok, code: outcome.code});
      if (outcome.stop) {
        for (const rest of queue.slice(index + 1)) if (rest.state === 'ASSIGNED') Object.assign(rest, {state: 'PUT_FAILED', message: outcome.stop, code: item.code});
        return;
      }
    }
  }

  async function resumeHeld() {
    const held = items.filter(item => item.state === 'HELD');
    if (!held.length || !filled.has(1)) return;
    for (const item of held) Object.assign(item, {state: 'ASSIGNED', note: ''});
    notices = notices.filter(text => text !== PERSON_BULK_FRONT_FIRST);
    await uploadQueue(orderPersonBulkUploads(held));
  }

  // Every action holds the shared busy flag, then reloads the person and
  // redraws the photo step (the tiles and the counter follow Core).
  async function act(work) {
    setBusy(true);
    running = true;
    say('');
    markSurface(true);
    paint();
    try { await work(); }
    finally {
      running = false;
      progress = {text: '', done: 0, total: 0};
      announcement = items.length ? personBulkSummary(items).text : (notices[notices.length - 1] || '');
      try { await reload(); } catch { /* the photo step redraws from what it has */ }
      setBusy(false);
      markSurface(false);
      if (!isDisposed()) rerender();
    }
  }

  async function runBatch(files) {
    const {kept, dropped} = limitPersonBulkFiles(files);
    nextId = 1;
    items = kept.map(file => newItem(file));
    notices = dropped ? [personBulkTooManyMessage(kept.length + dropped)] : [];
    frontNote = '';
    uploadLog = [];
    anchorSuspect = false;
    batchStored.clear();
    const profileWasEmpty = filled.size === 0;
    focusSummary = true;
    await act(async () => {
      // 2-3. Prepare exactly like the single-slot tile, then classify one by one.
      for (const [index, item] of items.entries()) {
        if (isDisposed()) return;
        setProgress(personBulkClassifyProgress(index + 1, items.length), index, items.length);
        const prepared = await prepareFile(item.file);
        if (prepared.error) { Object.assign(item, {state: 'PREPARE_FAILED', message: prepared.error}); continue; }
        setPhoto(item, prepared.dataUri);
        try {
          const result = await classify(sessionToken, personId, item.dataUri);
          item.classification = result;
          if (result.status === 'REJECTED') {
            Object.assign(item, {state: 'REJECTED', code: result.rejectionCode, message: personIdentityPhotoErrorMessage({code: result.rejectionCode}, null, REJECT_FALLBACK)});
          } else item.state = 'CLASSIFIED';
        } catch (error) {
          const stop = stopFor(error);
          if (stop) {
            // Classify stores nothing, so nothing of this run needs keeping.
            items = [];
            notices.push(stop);
            return;
          }
          Object.assign(item, {state: 'CLASSIFY_FAILED', code: errorCode(error), message: personErrorMessage(error, CLASSIFY_FALLBACK)});
        }
      }
      // 4. Place.
      const entries = items.map(item => (item.state === 'CLASSIFIED' ? {status: item.classification.status, suggested: item.classification.suggestedSlotIndexes} : null));
      assignPersonBulkPhotos(entries, [...filled]).forEach((decision, index) => {
        const item = items[index];
        if (item.state !== 'CLASSIFIED') return;
        if (decision.state === 'ASSIGNED') Object.assign(item, {state: 'ASSIGNED', slot: decision.slot});
        else Object.assign(item, {state: 'NEEDS_CHOICE', reason: decision.reason, candidates: decision.candidates});
      });
      // 5. Upload, fronts first; nothing without a front reference.
      const queue = orderPersonBulkUploads(items.filter(item => item.state === 'ASSIGNED'));
      if (personBulkNeedsFrontFirst(queue.map(item => item.slot), [...filled])) {
        for (const item of queue) item.state = 'HELD';
        notices.push(PERSON_BULK_FRONT_FIRST);
      } else {
        await uploadQueue(queue, true);
      }
      // 8. The front photo may be someone else.
      anchorSuspect = personBulkAnchorSuspect(uploadLog, profileWasEmpty);
    });
  }

  // 7. "다른 사진으로 교체": one new photo for this item only.
  async function placeReplacement(item, file, intendedSlot) {
    setProgress(personBulkClassifyProgress(1, 1), 0, 1);
    const keepPending = message => { item.note = message; };
    const prepared = await prepareFile(file);
    if (prepared.error) {
      if (intendedSlot) keepPending(prepared.error);
      else Object.assign(item, {state: 'PREPARE_FAILED', message: prepared.error, note: '', code: '', slot: 0});
      return;
    }
    let result;
    try { result = await classify(sessionToken, personId, prepared.dataUri); }
    catch (error) {
      const message = stopFor(error) || personErrorMessage(error, CLASSIFY_FALLBACK);
      if (intendedSlot) keepPending(message);
      else { setPhoto(item, prepared.dataUri); Object.assign(item, {state: 'CLASSIFY_FAILED', message, note: '', code: errorCode(error), slot: 0}); }
      return;
    }
    const plan = personBulkReplacementPlan({intendedSlot, status: result.status, suggested: result.suggestedSlotIndexes, filled: [...filled]});
    if (plan.action === 'REJECTED') {
      const message = personIdentityPhotoErrorMessage({code: result.rejectionCode}, intendedSlot ? slotOf(intendedSlot) : null, REJECT_FALLBACK);
      if (intendedSlot) keepPending(message);
      else { setPhoto(item, prepared.dataUri); Object.assign(item, {classification: result, state: 'REJECTED', message, note: '', code: result.rejectionCode, slot: 0}); }
      return;
    }
    if (plan.action === 'MISMATCH') { keepPending(personBulkMismatchMessage(intendedSlot)); return; }
    setPhoto(item, prepared.dataUri);
    Object.assign(item, {classification: result, message: '', note: '', code: ''});
    if (plan.action === 'CHOOSE') { Object.assign(item, {state: 'NEEDS_CHOICE', reason: plan.reason, candidates: plan.candidates, slot: 0}); return; }
    if (plan.action === 'HOLD') { Object.assign(item, {state: 'HELD', slot: plan.slot}); return; }
    setProgress(personBulkUploadProgress(1, 1), 0, 1);
    const outcome = await putItem(item, plan.slot);
    if (outcome.ok && plan.slot === 1) await resumeHeld();
  }

  const guard = () => {
    if (!isBusy()) return true;
    say(BUSY_MESSAGE);
    return false;
  };

  function chooseSlot(item, slot) {
    if (!guard()) return;
    if (slot !== 1 && !filled.has(1)) { item.note = FRONT_FIRST_NOTE; paint(); return; }
    void act(async () => {
      setProgress(personBulkUploadProgress(1, 1), 0, 1);
      const outcome = await putItem(item, slot);
      if (outcome.ok && slot === 1) await resumeHeld();
    });
  }

  function skip(item) {
    if (!guard()) return;
    Object.assign(item, {state: 'SKIPPED', note: ''});
    announcement = personBulkSummary(items).text;
    paint();
  }

  // ------------------------------------------------------------ drawing
  const fileInput = (multiple, dataName) => {
    const input = el('input');
    input.type = 'file';
    input.accept = PERSON_PHOTO_ACCEPT;
    input.multiple = multiple;
    input.hidden = true;
    input.dataset[dataName] = '';
    return input;
  };
  const actionButton = (label, onClick, primary = false) => {
    const node = el('button', primary ? 'site-button person-primary' : 'site-button site-button-secondary', label);
    node.type = 'button';
    node.addEventListener('click', onClick);
    return node;
  };

  const itemMessage = item => {
    if (item.state === 'HELD') return '정면 얼굴 사진을 먼저 등록하면 이 칸에 등록할 수 있어요.';
    if (item.state === 'SKIPPED') return '이 사진은 등록하지 않았어요.';
    if (item.state === 'NEEDS_CHOICE') {
      if (item.reason === 'UNCERTAIN') return '여러 칸에 맞을 수 있는 사진이에요. 등록할 칸을 골라 주세요.';
      return personBulkChoiceSlots(item.candidates, [...batchStored]).length
        ? '맞는 칸에 이미 사진이 있어요. 바꿀 칸을 고르거나 건너뛰어 주세요.'
        : '맞는 칸은 이번에 고른 다른 사진으로 이미 채웠어요. 다른 각도에서 찍은 사진으로 바꾸거나 건너뛰어 주세요.';
    }
    return item.message;
  };
  const slotLine = item => {
    if (!item.slot) return '';
    const label = personBulkSlotLabel(item.slot);
    if (item.state === 'STORED') return `등록한 칸: ${label}`;
    if (item.state === 'PUT_FAILED') return `등록하려던 칸: ${label}`;
    if (item.state === 'HELD' || item.state === 'ASSIGNED') return `등록할 칸: ${label}`;
    return '';
  };

  const itemRow = item => {
    const row = el('li', 'person-bulk-item');
    row.dataset.personBulkItem = String(item.id);
    row.dataset.personBulkState = item.state;
    if (item.slot) row.dataset.personBulkSlot = String(item.slot);
    if (item.code) row.dataset.personErrorCode = item.code;
    const thumb = el('div', 'person-bulk-thumb');
    if (item.dataUri) {
      if (!item.thumb) {
        item.thumb = el('img');
        item.thumb.src = item.dataUri;
        item.thumb.alt = `고른 ${item.title}`;
        item.thumb.decoding = 'async';
      }
      thumb.append(item.thumb);
    } else thumb.append(el('span', '', '사진'));
    const body = el('div', 'person-bulk-body');
    const head = el('div', 'person-bulk-item-head');
    const badge = STATE_BADGES[item.state] || WORKING_BADGE;
    head.append(el('strong', 'person-bulk-item-title', item.title), el('span', `safecare-badge safecare-badge-${badge.tone}`, badge.label));
    body.append(head);
    const line = slotLine(item);
    if (line) body.append(el('p', 'person-bulk-item-slot', line));
    const message = itemMessage(item);
    if (message) {
      const text = el('p', `person-bulk-item-message${FAILED_STATES.has(item.state) ? ' is-error' : ''}`, message);
      text.dataset.personBulkMessage = '';
      body.append(text);
    }
    if (item.note) {
      const note = el('p', 'person-bulk-item-note', item.note);
      note.dataset.personBulkNote = '';
      note.setAttribute('role', 'alert');
      body.append(note);
    }
    if (!running && (FAILED_STATES.has(item.state) || PENDING_STATES.has(item.state))) {
      const actions = el('div', 'person-bulk-item-actions');
      if (item.state === 'NEEDS_CHOICE') {
        for (const slot of personBulkChoiceSlots(item.candidates, [...batchStored])) {
          const label = personBulkSlotLabel(slot);
          const text = filled.has(slot) ? `${label} 사진 바꾸기` : `${label} 칸에 등록`;
          const choose = actionButton(text, () => chooseSlot(item, slot), !filled.has(slot));
          choose.dataset.personBulkChoose = String(slot);
          choose.setAttribute('aria-label', `${item.title}: ${text}`);
          actions.append(choose);
        }
      }
      if (PENDING_STATES.has(item.state)) {
        const skipButton = actionButton('건너뛰기', () => skip(item));
        skipButton.dataset.personBulkSkip = '';
        skipButton.setAttribute('aria-label', `${item.title}: 건너뛰기`);
        actions.append(skipButton);
      }
      const input = fileInput(false, 'personBulkReplaceInput');
      const replace = actionButton('다른 사진으로 교체', () => {
        if (!guard()) return;
        const intended = INTENDED_STATES.has(item.state) ? item.slot : 0;
        if (intended && intended !== 1 && !filled.has(1)) { item.note = FRONT_FIRST_NOTE; paint(); return; }
        input.click();
      });
      replace.dataset.personBulkReplace = '';
      replace.setAttribute('aria-label', `${item.title}: 다른 사진으로 교체`);
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        input.value = '';
        if (!file || !guard()) return;
        const intended = INTENDED_STATES.has(item.state) ? item.slot : 0;
        void act(() => placeReplacement(item, file, intended));
      });
      actions.append(replace, input);
      body.append(actions);
    }
    row.append(thumb, body);
    return row;
  };

  const buildResult = () => {
    if (!items.length) return [];
    const summary = personBulkSummary(items);
    const heading = el('p', 'person-bulk-summary', summary.text);
    heading.dataset.personBulkSummary = '';
    heading.tabIndex = -1;
    const nodes = [heading];
    if (anchorSuspect) {
      const hint = el('p', 'person-bulk-anchor-hint', PERSON_BULK_ANCHOR_HINT);
      hint.dataset.personBulkAnchorHint = '';
      nodes.push(hint);
    }
    const held = items.filter(item => item.state === 'HELD');
    if (held.length && !running) {
      const actions = el('div', 'person-bulk-actions');
      if (filled.has(1)) {
        const resume = actionButton(`보류한 사진 ${held.length}장 등록하기`, () => { if (guard()) void act(resumeHeld); }, true);
        resume.dataset.personBulkResume = '';
        actions.append(resume);
      } else {
        const input = fileInput(false, 'personBulkFrontInput');
        const front = actionButton('정면 사진 선택', () => { if (guard()) input.click(); }, true);
        front.dataset.personBulkFrontPick = '';
        input.addEventListener('change', () => {
          const file = input.files?.[0];
          input.value = '';
          if (!file || !guard()) return;
          const item = newItem(file, '정면 사진');
          item.state = 'HELD';
          item.slot = 1;
          void act(async () => {
            await placeReplacement(item, file, 1);
            if (item.state === 'STORED' || (item.state === 'PUT_FAILED' && !item.note)) { items.push(item); frontNote = ''; }
            else frontNote = item.note;
          });
        });
        actions.append(front, input);
        if (frontNote) {
          const note = el('p', 'person-bulk-item-note', frontNote);
          note.dataset.personBulkFrontNote = '';
          actions.append(note);
        }
      }
      nodes.push(actions);
    }
    const list = el('ul', 'person-bulk-list');
    list.setAttribute('aria-label', '고른 사진 결과');
    for (const item of items) list.append(itemRow(item));
    nodes.push(list);
    if (!running) {
      // Closing the list removes nothing from Core; stored photos stay.
      const clear = actionButton('결과 닫기', () => {
        if (!guard()) return;
        items = []; notices = []; frontNote = ''; anchorSuspect = false; announcement = '';
        paint();
      });
      clear.dataset.personBulkClear = '';
      nodes.push(clear);
    }
    return nodes;
  };

  function paint() {
    if (!view) return;
    const {section, status, bar, fill, noticeBox, result, pick} = view;
    section.dataset.personBulkBusy = running ? 'true' : 'false';
    pick.setAttribute('aria-disabled', running ? 'true' : 'false');
    // Progress is shown while a run is active; afterwards the line only speaks
    // (the summary itself is drawn in the result below).
    status.classList.toggle('person-bulk-status-quiet', !running);
    const statusText = running ? progress.text : announcement;
    if (status.textContent !== statusText) status.textContent = statusText;
    bar.hidden = !running || !progress.total;
    bar.setAttribute('aria-valuemax', String(progress.total || 1));
    bar.setAttribute('aria-valuenow', String(progress.done));
    fill.style.width = `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%`;
    noticeBox.replaceChildren(...notices.map(text => {
      const node = el('p', 'person-bulk-notice', text);
      node.dataset.personBulkNotice = '';
      node.tabIndex = -1;
      return node;
    }));
    result.replaceChildren(...buildResult());
  }

  // The photo step is rebuilt on every change; the batch lives here and is
  // drawn into each new panel.
  function render({filledSlots} = {}) {
    if (filledSlots) for (const slot of (typeof filledSlots.keys === 'function' ? filledSlots.keys() : filledSlots)) filled.add(Number(slot));
    const section = el('section', 'person-bulk');
    section.dataset.personBulk = '';
    const title = el('h5', 'person-bulk-title', '사진 여러 장 한 번에 등록');
    const warning = el('p', 'person-bulk-warning', PERSON_BULK_WARNING);
    warning.dataset.personBulkWarning = '';
    const angles = el('p', 'person-bulk-angles', PERSON_BULK_ANGLE_GUIDE);
    angles.dataset.personBulkAngles = '';
    const note = el('p', 'person-bulk-note', `한 번에 최대 ${PERSON_BULK_MAX_FILES}장까지 고를 수 있어요. 사진마다 맞는 칸을 찾아 넣고, 칸마다 다시 확인한 뒤 저장해요. 이미 사진이 있는 칸은 먼저 물어본 뒤에만 바꿔요.`);
    const input = fileInput(true, 'personBulkInput');
    const pick = actionButton('사진 여러 장 선택', () => { if (guard()) input.click(); }, true);
    pick.classList.add('person-bulk-pick');
    pick.dataset.personBulkPick = '';
    input.addEventListener('change', () => {
      const files = Array.from(input.files || []);
      input.value = '';
      if (!files.length || !guard()) return;
      void runBatch(files);
    });
    const status = el('p', 'person-bulk-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.dataset.personBulkStatus = '';
    const bar = el('div', 'person-bulk-bar');
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-label', '여러 장 등록 진행');
    bar.setAttribute('aria-valuemin', '0');
    const fill = el('span', 'person-bulk-bar-fill');
    bar.append(fill);
    const alert = el('p', 'person-bulk-alert');
    alert.setAttribute('role', 'alert');
    alert.hidden = true;
    alert.dataset.personBulkAlert = '';
    const noticeBox = el('div', 'person-bulk-notices');
    const result = el('div', 'person-bulk-result');
    result.dataset.personBulkResult = '';
    section.append(title, warning, angles, note, pick, input, status, bar, alert, noticeBox, result);
    view = {section, status, bar, fill, alert, noticeBox, result, pick};
    paint();
    if (!running) {
      // A live region announces changes, not the text it was inserted with:
      // fill it once the new panel is on screen (the batch result gets focus instead).
      status.textContent = '';
      if (!focusSummary && announcement) setTimeout(() => { if (view?.status === status && !running) status.textContent = announcement; }, 150);
    }
    queueMicrotask(() => {
      if (view?.section !== section || !section.isConnected) return;
      markSurface(running);
      if (focusSummary && !running) {
        focusSummary = false;
        (section.querySelector('[data-person-bulk-summary]') || section.querySelector('[data-person-bulk-notice]'))?.focus?.({preventScroll: false});
      }
    });
    return section;
  }

  return Object.freeze({personId, render});
}
