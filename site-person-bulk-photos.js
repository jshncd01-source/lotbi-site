// SAFECARE-PHOTO-BULK-UPLOAD-01 → SAFECARE-PHOTO-EASY-UPLOAD-01 (2nd round,
// owner decision 2026-10-10) — the guardian attaches everyday photos in one go.
//
// Each photo goes to Core's slot-free POST (…/identity-photos) one at a time.
// Core decides FACE or BODY, refuses only what is wrong or useless (no person,
// an animal or object, a document, two people, a covered face, blur, a tiny
// subject, a clearly different person) and places the photo in a free card.
// Head angle and framing margins are not refusal reasons any more. So on this
// screen:
//   - photos are sent one by one in the order picked; nothing is sorted or
//     assigned here,
//   - a stored photo stays stored when a later one is refused (each POST is
//     its own save; nothing is deleted or rolled back),
//   - three face photos and two body photos complete the set; more (up to ten)
//     are only recommended,
//   - no sentence says or implies that the photos show the same person.
// The ten tiles below the panel are examples; this panel is the only way in.
import {
  addPersonIdentityPhoto, personErrorMessage, personIdentityPhotoErrorMessage,
} from './site-person.js?v=aset-f46a0f4224fe';
import {PERSON_PHOTO_ACCEPT, personPhotoPrepareMessage, preparePersonPhoto} from './site-person-photo-intake.js?v=aset-f46a0f4224fe';
import {fgIcon} from './site-family-guardian-ui.js?v=aset-f46a0f4224fe';

export const PERSON_BULK_MAX_FILES = 10;
export const PERSON_BULK_WARNING = '같은 사람의 사진만 선택해 주세요. 다른 사람이나 동물·사물 사진은 등록되지 않을 수 있어요.';
export const PERSON_BULK_ANGLE_GUIDE = '최소 5장 권장 · 얼굴 3장 + 상반신·전신 2장';
export const PERSON_BULK_OPTIONAL_GUIDE = '다양한 각도와 상황의 사진을 최대 10장까지 등록하면 인식에 도움이 될 수 있어요.';
export const PERSON_BULK_ANCHOR_HINT = '처음 저장된 사진이 다른 사람일 수 있어요. 사진 갱신·관리에서 그 사진을 빼고 다시 올려 주세요.';
export const PERSON_BULK_UNAVAILABLE = '여러 장 한 번에 등록은 지금 사용할 수 없어요. 잠시 후 다시 시도해 주세요. 고른 사진은 저장하지 않았어요.';
export const PERSON_BULK_FULL = '사진은 10장까지 등록할 수 있어요. 더 바꾸려면 사진 갱신·관리에서 기존 사진을 빼 주세요.';

const BUSY_MESSAGE = '다른 사진을 확인하는 중입니다. 끝난 뒤 다시 선택해 주세요.';
const ADD_FALLBACK = '이 사진은 등록하지 못했어요. 다른 사진을 골라 주세요.';
const STOP_FALLBACK = '사진을 확인하지 못했습니다. 화면을 새로 열어 주세요.';
const DIFFERENT_PERSON = 'PERSON_IDENTITY_PHOTO_DIFFERENT_PERSON';
const FAILED_STATES = new Set(['PREPARE_FAILED', 'REFUSED']);

// ------------------------------------------------------------ pure rules
/** Keeps what still fits (ten in all, counting the photos already stored). */
export function limitPersonBulkFiles(files, stored = 0) {
  const list = Array.from(files || []);
  const room = Math.max(0, PERSON_BULK_MAX_FILES - Math.max(0, Number(stored) || 0));
  return {kept: list.slice(0, room), dropped: Math.max(0, list.length - room), room};
}

export function personBulkTooManyMessage(room) {
  return room > 0
    ? `사진은 모두 합쳐 10장까지 등록할 수 있어요. 처음 고른 ${room}장만 확인할게요.`
    : PERSON_BULK_FULL;
}

/** log: the batch's sends in order, [{ok, code}]. The first stored photo may be someone else. */
export function personBulkAnchorSuspect(log, profileWasEmpty) {
  if (!profileWasEmpty) return false;
  const first = log.findIndex(entry => entry.ok);
  if (first < 0) return false;
  return log.slice(first + 1).filter(entry => entry.code === DIFFERENT_PERSON).length >= 2;
}

export function personBulkSummary(items) {
  const stored = items.filter(item => item.state === 'STORED').length;
  const failed = items.filter(item => FAILED_STATES.has(item.state)).length;
  return Object.freeze({stored, failed, text: `등록 성공 ${stored}장 · 실패 ${failed}장`});
}

export function personBulkProgress(current, total) {
  return `사진을 확인하고 있어요 (${current}/${total})`;
}

/** What the guardian still needs, or the recommendation once the set is complete. */
export function personPhotoSetMessage({complete, faceCount, bodyCount, photoCount, faceMinimum = 3, bodyMinimum = 2} = {}) {
  if (complete) {
    return Number(photoCount) >= PERSON_BULK_MAX_FILES
      ? '등록에 필요한 사진이 모두 있어요.'
      : '필수 사진 5장이 준비됐어요. 이대로 등록할 수 있어요.';
  }
  const needFace = Math.max(0, faceMinimum - (Number(faceCount) || 0));
  const needBody = Math.max(0, bodyMinimum - (Number(bodyCount) || 0));
  const parts = [];
  if (needFace) parts.push(`얼굴이 잘 보이는 사진 ${needFace}장`);
  if (needBody) parts.push(`상반신·전신 사진 ${needBody}장`);
  return parts.length ? `${parts.join('과 ')}이 더 있으면 등록을 마칠 수 있어요.` : '사진을 확인하고 있어요.';
}

// ------------------------------------------------------------ screen
const el = (tag, className = '', text = '') => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

const errorCode = error => (typeof error?.code === 'string' ? error.code : '');
function stopFor(error) {
  const status = Number(error?.status) || 0;
  const code = errorCode(error);
  if (code === 'SESSION_REQUIRED' || status === 401 || status === 403) return personErrorMessage(error, STOP_FALLBACK);
  if ((status === 404 || status === 405) && (!code || code.startsWith('HTTP_'))) return PERSON_BULK_UNAVAILABLE;
  if (status === 404) return personErrorMessage(error, STOP_FALLBACK);
  if (code === 'PERSON_IDENTITY_PHOTOS_FULL') return PERSON_BULK_FULL;
  return '';
}

const STATE_BADGES = Object.freeze({
  STORED: {label: '등록 성공', tone: 'success'},
  PREPARE_FAILED: {label: '실패', tone: 'danger'},
  REFUSED: {label: '실패', tone: 'danger'},
  SKIPPED: {label: '중단', tone: 'neutral'},
});
const WORKING_BADGE = Object.freeze({label: '확인 중', tone: 'progress'});
const CATEGORY_LINE = Object.freeze({FACE: '얼굴 사진으로 등록했어요', BODY: '상반신·전신 사진으로 등록했어요'});

export function createPersonBulkPhotos({
  sessionToken, personId,
  isBusy = () => false, setBusy = () => {}, reload = async () => {}, rerender = () => {}, isDisposed = () => false,
  addPhoto = addPersonIdentityPhoto, prepare = preparePersonPhoto,
} = {}) {
  let items = [];
  let nextId = 1;
  let notices = [];
  let uploadLog = [];
  let anchorSuspect = false;
  let running = false;
  let progress = {text: '', done: 0, total: 0};
  let focusSummary = false;
  let announcement = '';  // read out by the status line once an action has finished
  let stored = 0;  // photos on Core for this person (from the photo step)
  let view = null;

  const newItem = (file, title = '') => {
    const id = nextId;
    nextId += 1;
    return {id, title: title || `사진 ${id}`, file, dataUri: '', thumb: null, state: 'NEW', category: '', slot: 0, message: '', code: ''};
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

  // One photo: prepare (HEIC/WebP/large → JPEG), then Core's slot-free POST.
  // A success is final: it is never undone by a later refusal.
  async function send(item) {
    let prepared;
    try { prepared = await prepare(item.file); }
    catch (error) { Object.assign(item, {state: 'PREPARE_FAILED', message: personPhotoPrepareMessage(error), code: ''}); return {ok: false, code: ''}; }
    setPhoto(item, prepared.dataUri);
    try {
      const result = await addPhoto(sessionToken, personId, item.dataUri);
      Object.assign(item, {state: 'STORED', category: result.category, slot: result.photo.slotIndex, message: '', code: ''});
      if (!result.replayed) stored += 1;
      return {ok: true, code: ''};
    } catch (error) {
      const code = errorCode(error);
      Object.assign(item, {state: 'REFUSED', code, message: personIdentityPhotoErrorMessage(error, null, ADD_FALLBACK)});
      return {ok: false, code, stop: stopFor(error)};
    }
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
    const {kept, dropped, room} = limitPersonBulkFiles(files, stored);
    nextId = 1;
    items = kept.map(file => newItem(file));
    notices = dropped ? [personBulkTooManyMessage(room)] : [];
    uploadLog = [];
    anchorSuspect = false;
    const profileWasEmpty = stored === 0;
    focusSummary = true;
    await act(async () => {
      for (const [index, item] of items.entries()) {
        if (isDisposed()) return;
        setProgress(personBulkProgress(index + 1, items.length), index, items.length);
        const outcome = await send(item);
        uploadLog.push({ok: outcome.ok, code: outcome.code});
        if (outcome.stop) {
          for (const rest of items.slice(index + 1)) Object.assign(rest, {state: 'SKIPPED', message: outcome.stop});
          if (!notices.includes(outcome.stop)) notices.push(outcome.stop);
          return;
        }
      }
      anchorSuspect = personBulkAnchorSuspect(uploadLog, profileWasEmpty);
    });
  }

  const guard = () => {
    if (!isBusy()) return true;
    say(BUSY_MESSAGE);
    return false;
  };

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

  const itemRow = item => {
    const row = el('li', 'person-bulk-item');
    row.dataset.personBulkItem = String(item.id);
    row.dataset.personBulkState = item.state;
    if (item.slot) row.dataset.personBulkSlot = String(item.slot);
    if (item.category) row.dataset.personBulkCategory = item.category;
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
    if (item.state === 'STORED' && CATEGORY_LINE[item.category]) body.append(el('p', 'person-bulk-item-slot', CATEGORY_LINE[item.category]));
    if (item.message) {
      const text = el('p', `person-bulk-item-message${FAILED_STATES.has(item.state) ? ' is-error' : ''}`, item.message);
      text.dataset.personBulkMessage = '';
      body.append(text);
    }
    if (!running && FAILED_STATES.has(item.state)) {
      const actions = el('div', 'person-bulk-item-actions');
      const input = fileInput(false, 'personBulkReplaceInput');
      const replace = actionButton('다른 사진으로 교체', () => { if (guard()) input.click(); });
      replace.dataset.personBulkReplace = '';
      replace.setAttribute('aria-label', `${item.title}: 다른 사진으로 교체`);
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        input.value = '';
        if (!file || !guard()) return;
        item.file = file;
        void act(async () => {
          setProgress(personBulkProgress(1, 1), 0, 1);
          const outcome = await send(item);
          if (outcome.stop && !notices.includes(outcome.stop)) notices.push(outcome.stop);
        });
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
    const list = el('ul', 'person-bulk-list');
    list.setAttribute('aria-label', '고른 사진 결과');
    for (const item of items) list.append(itemRow(item));
    nodes.push(list);
    if (!running) {
      // Closing the list removes nothing from Core; stored photos stay.
      const clear = actionButton('결과 닫기', () => {
        if (!guard()) return;
        items = []; notices = []; anchorSuspect = false; announcement = '';
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
  function render({storedCount} = {}) {
    if (Number.isInteger(storedCount) && !running) stored = storedCount;
    const section = el('section', 'person-bulk');
    section.dataset.personBulk = '';
    const title = el('h5', 'person-bulk-title', '사진 선택');
    const warning = el('p', 'person-bulk-warning', PERSON_BULK_WARNING);
    warning.dataset.personBulkWarning = '';
    const angles = el('p', 'person-bulk-angles', PERSON_BULK_ANGLE_GUIDE);
    angles.dataset.personBulkAngles = '';
    const note = el('p', 'person-bulk-note', PERSON_BULK_OPTIONAL_GUIDE);
    const help = el('details', 'person-bulk-help');
    // FAMILY-GUARDIAN-DESIGN-UNIFY-01: the one rule that decides whether a photo is kept
    // ("same person only") sits right under the button; the longer guide stays folded.
    help.append(el('summary', '', '사진 등록 안내'), angles, note);
    const input = fileInput(true, 'personBulkInput');
    const pick = actionButton('갤러리에서 여러 장 선택', () => { if (guard()) input.click(); }, true);
    pick.classList.add('person-bulk-pick');
    pick.prepend(fgIcon('image'));
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
    section.append(title, pick, warning, input, help, status, bar, alert, noticeBox, result);
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
