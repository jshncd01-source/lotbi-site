// TROUBLE-HELPER-01 — 분쟁·사고 도우미, “막막할 때 롯비”.
//
// A <dialog> beside 진위확인 and built the same way: two menu buttons
// (data-trouble-open, desktop sidebar and mobile drawer) open the dialog that
// index.html carries; this module owns it. Unlike 진위확인 it needs no login:
// the guide is Core's public GET /v2/trouble-helper/guides and nothing is sent
// back. One screen, one main action:
//   ① 상황 고르기 → ② 질문 (one at a time, show_if) → ③ 할 일 →
//   ④ 모을 증거·참고 기준·공식 창구 → ⑤ 상황 정리표.
// Guide sentences are drawn from Core's answer; only the controls and the
// "could not load" fallback are written here.
//
// Progress (situation, answers, checks, the 정리표) is kept on this device only
// (localStorage, try/catch: the screen works without it), so a trip to an
// official site or a reload picks up where it was. A reload while the dialog
// is open reopens it (sessionStorage flag) unless the address names another
// Site screen. Nothing typed here leaves the device unless the reader sends it.
import {
  FALLBACK_CALLS,
  FALLBACK_MESSAGE,
  SHARE_TITLE,
  SHARE_URL,
  SUBMITTED_STATUS,
  TROUBLE_HELPER_STORAGE_KEY,
  canChooseStatus,
  faultPortalGuide,
  feeLine,
  fetchTroubleGuides,
  findSituation,
  hoursLine,
  localDay,
  normalizeRecord,
  receiptWritten,
  savedAtLabel,
  shareText,
  statusOptions,
  summaryModel,
  telHref,
  visibleQuestions,
  visibleSteps,
  cleanAnswers,
} from './site-trouble-helper-model.js?v=aset-ac377caccc90';
import {createMessageReadAloudButton, stopMessageReadAloud} from './site-message-read-aloud.js?v=aset-ac377caccc90';

const OPEN_FLAG_KEY = 'lotbi.trouble-helper.open.v1';
const ROUTE_HASH_RE = /^#[a-z][a-z-]{1,30}$/u;
const RESET_CONFIRM_MS = 6000;

let dialog = null;
let viewHost = null;
let scrollHost = null;
let statusNode = null;
let progressNode = null;
let dialogTrigger = null;
let guides = null;
let loading = null;
let store = emptyStore();
let resetArmedUntil = 0;
let saveTimer = 0;
let headingSequence = 0;

function emptyStore() {
  return {version: 1, current: '', preferOffline: false, cases: {}};
}

function readStore() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(TROUBLE_HELPER_STORAGE_KEY) || 'null');
    if (raw && typeof raw === 'object' && raw.version === 1) {
      return {
        version: 1,
        current: typeof raw.current === 'string' ? raw.current : '',
        preferOffline: raw.preferOffline === true,
        cases: raw.cases && typeof raw.cases === 'object' && !Array.isArray(raw.cases) ? raw.cases : {},
      };
    }
  } catch {}
  return emptyStore();
}

function writeStore() {
  window.clearTimeout(saveTimer);
  saveTimer = 0;
  try {
    window.localStorage.setItem(TROUBLE_HELPER_STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

function queueSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(writeStore, 400);
}

// Stored progress is checked against the guide Core sent today.
function reconcileStore() {
  const cases = {};
  for (const [id, raw] of Object.entries(store.cases)) {
    const situation = findSituation(guides, id);
    if (situation) cases[id] = normalizeRecord(situation, raw);
  }
  store.cases = cases;
  if (!findSituation(guides, store.current)) store.current = '';
}

function currentSituation() {
  return findSituation(guides, store.current);
}

function currentRecord() {
  const situation = currentSituation();
  if (!situation) return null;
  if (!store.cases[situation.id]) store.cases[situation.id] = normalizeRecord(situation, {view: 'question', createdOn: localDay()});
  return store.cases[situation.id];
}

// ── small DOM helpers (textContent only; nothing from Core becomes HTML) ──
function el(tag, options = {}, ...children) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  for (const [key, value] of Object.entries(options.attrs || {})) {
    if (value === undefined || value === null || value === false) continue;
    node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const [key, value] of Object.entries(options.data || {})) node.dataset[key] = value;
  for (const [type, handler] of Object.entries(options.on || {})) node.addEventListener(type, handler);
  for (const child of children.flat()) if (child) node.append(child);
  return node;
}

function button(label, onClick, {className = 'trouble-button', data, attrs} = {}) {
  return el('button', {className, text: label, attrs: {type: 'button', ...attrs}, data, on: {click: onClick}});
}

function externalLink(label, href, {className = 'trouble-button trouble-button-secondary', data} = {}) {
  return el('a', {className, attrs: {href, target: '_blank', rel: 'noopener noreferrer'}, data},
    el('span', {text: label}), el('span', {className: 'trouble-sr', text: ' (새 창에서 열려요)'}));
}

function callLink(label, phone, {className = 'trouble-button trouble-call', ariaLabel, data} = {}) {
  const href = telHref(phone);
  if (!href) return null;
  return el('a', {className, attrs: {href, 'aria-label': ariaLabel || label}, data: {troublePhone: phone, ...data}}, label);
}

function nextHeadingId() {
  headingSequence += 1;
  return `trouble-heading-${headingSequence}`;
}

function heading(textValue, level = 'h3') {
  return el(level, {className: 'trouble-heading', text: textValue, attrs: {tabindex: '-1', id: nextHeadingId()}, data: {troubleHeading: ''}});
}

function announce(message) {
  if (statusNode) statusNode.textContent = message || '';
}

function setProgress(message) {
  if (!progressNode) return;
  progressNode.textContent = message || '';
  progressNode.hidden = !message;
}

// ── rendering ──────────────────────────────────────────────────────────
function render({focus = true} = {}) {
  if (!viewHost) return;
  stopReading();
  viewHost.replaceChildren();
  setProgress('');
  announce('');
  if (!guides) return;
  const situation = currentSituation();
  if (!situation) {
    viewHost.dataset.troubleView = 'pick';
    renderPick();
  } else {
    const record = currentRecord();
    if (!situation.questions.length && record.view === 'question') record.view = 'steps';
    viewHost.dataset.troubleView = record.view;
    if (record.view === 'question') renderQuestion(situation, record);
    else if (record.view === 'steps') renderSteps(situation, record);
    else if (record.view === 'help') renderHelp(situation, record);
    else renderSummary(situation, record);
  }
  writeStore();
  if (focus) {
    if (scrollHost) scrollHost.scrollTop = 0;
    viewHost.querySelector('[data-trouble-heading]')?.focus({preventScroll: true});
  }
}

function noticeLine() {
  return el('p', {className: 'trouble-notice', text: guides.notice, data: {troubleNotice: ''}});
}

function renderPick() {
  const items = guides.situations.map(situation => {
    const saved = store.cases[situation.id];
    const resumable = saved && (Object.keys(saved.answers || {}).length || Object.keys(saved.fields || {}).length);
    return el('li', {},
      el('button', {className: 'trouble-situation', attrs: {type: 'button'}, data: {troubleSituation: situation.id},
        on: {click: () => chooseSituation(situation.id)}},
      el('strong', {text: situation.title}),
      situation.subtitle ? el('span', {text: situation.subtitle}) : null,
      resumable ? el('span', {className: 'trouble-resume', text: '적어 둔 내용이 있어요 · 이어서 보기'}) : null));
  });
  viewHost.append(noticeLine(), heading('어떤 일이 있었나요?'), el('ul', {className: 'trouble-situations'}, items));
}

function chooseSituation(id) {
  store.current = id;
  const record = currentRecord();
  if (!record.view) record.view = 'question';
  render();
}

function goToPicker() {
  store.current = '';
  render();
}

// On the first question its own ← already goes back to the situations.
function footer({pick = true} = {}) {
  const reset = button(resetArmedUntil > Date.now() ? '한 번 더 누르면 지우고 처음부터 해요' : '처음부터 다시', () => resetCurrent(reset),
    {className: 'trouble-button trouble-button-quiet', data: {troubleReset: ''}});
  return el('div', {className: 'trouble-footer'},
    pick ? button('다른 상황 고르기', goToPicker, {className: 'trouble-button trouble-button-quiet', data: {troublePick: ''}}) : null,
    reset);
}

// 처음부터 다시 wipes what was written for this situation, so it takes a second press.
function resetCurrent(control) {
  if (resetArmedUntil <= Date.now()) {
    resetArmedUntil = Date.now() + RESET_CONFIRM_MS;
    control.textContent = '한 번 더 누르면 지우고 처음부터 해요';
    announce('이 상황에 적은 답과 정리표가 지워져요. 지우려면 한 번 더 눌러 주세요.');
    window.setTimeout(() => {
      if (resetArmedUntil <= Date.now() && control.isConnected) control.textContent = '처음부터 다시';
    }, RESET_CONFIRM_MS + 50);
    return;
  }
  resetArmedUntil = 0;
  delete store.cases[store.current];
  store.current = '';
  render();
  announce('지웠어요. 상황을 다시 골라 주세요.');
}

function renderQuestion(situation, record) {
  const questions = visibleQuestions(situation, record.answers);
  const index = Math.min(Math.max(0, record.question || 0), Math.max(0, questions.length - 1));
  record.question = index;
  const question = questions[index];
  if (!question) {
    record.view = 'steps';
    viewHost.dataset.troubleView = 'steps';
    renderSteps(situation, record);
    return;
  }
  setProgress(`질문 ${index + 1}/${questions.length}`);
  const title = heading(question.text);
  const options = question.options.map(option => el('button', {
    className: 'trouble-option',
    text: option.label,
    attrs: {type: 'button', 'aria-pressed': record.answers[question.id] === option.id ? 'true' : 'false'},
    data: {troubleOption: option.id},
    on: {click: () => answerQuestion(situation, record, question.id, option.id)},
  }));
  const back = index === 0
    ? button('← 상황 다시 고르기', goToPicker, {className: 'trouble-button trouble-button-secondary', data: {troubleBack: ''}})
    : button('← 이전 질문', () => { record.question = index - 1; render(); }, {className: 'trouble-button trouble-button-secondary', data: {troubleBack: ''}});
  // Came back to look at the answers: every question already answered, so the
  // 할 일 are one tap away without answering them all again.
  const answeredAll = questions.every(item => record.answers[item.id]);
  const resume = answeredAll
    ? button('답 그대로 할 일 보기 →', () => { record.view = 'steps'; render(); }, {className: 'trouble-button trouble-button-primary', data: {troubleResumeSteps: ''}})
    : null;
  viewHost.append(
    noticeLine(),
    el('p', {className: 'trouble-kicker', text: situation.title}),
    title,
    el('div', {className: 'trouble-options', attrs: {role: 'group', 'aria-labelledby': title.id}}, options),
    el('div', {className: 'trouble-nav'}, back, resume),
    footer({pick: index !== 0}),
  );
}

function answerQuestion(situation, record, questionId, optionId) {
  record.answers = cleanAnswers(situation, {...record.answers, [questionId]: optionId});
  const questions = visibleQuestions(situation, record.answers);
  const next = questions.findIndex(item => item.id === questionId) + 1;
  if (next > 0 && next < questions.length) {
    record.question = next;
  } else {
    record.view = 'steps';
  }
  render();
}

function tabs(record) {
  const entries = [['steps', '할 일'], ['help', '증거·창구'], ['summary', '정리표']];
  return el('nav', {className: 'trouble-tabs', attrs: {'aria-label': '안내 단계'}},
    entries.map(([view, label]) => button(label, () => { record.view = view; render(); }, {
      className: 'trouble-tab',
      attrs: {'aria-current': record.view === view ? 'step' : null},
      data: {troubleTab: view},
    })));
}

function resultHeader(situation, record, title) {
  return [noticeLine(), el('p', {className: 'trouble-kicker', text: situation.title}), tabs(record), heading(title)];
}

// ③ 할 일 — numbered cards; urgent ones carry a band.
function renderSteps(situation, record) {
  const steps = visibleSteps(situation, record.answers);
  const cards = steps.map((step, index) => stepCard(situation, record, step, index + 1));
  const portal = faultPortalSection(situation, record);
  viewHost.append(
    ...resultHeader(situation, record, '이렇게 하세요'),
    situation.notice ? el('p', {className: 'trouble-situation-notice', text: situation.notice, data: {troubleSituationNotice: ''}}) : null,
    el('ol', {className: 'trouble-steps'}, cards),
    portal,
    el('div', {className: 'trouble-nav'},
      situation.questions.length
        ? button('← 답 다시 고르기', () => { record.view = 'question'; record.question = 0; render(); }, {className: 'trouble-button trouble-button-secondary', data: {troubleBack: ''}})
        : null,
      button('다음: 모을 증거와 창구 →', () => { record.view = 'help'; render(); }, {className: 'trouble-button trouble-button-primary', data: {troubleNext: ''}})),
    footer(),
  );
}

function stepCard(situation, record, step, number) {
  const titleId = nextHeadingId();
  const done = record.done[step.id] === true;
  const check = el('input', {attrs: {type: 'checkbox', 'aria-describedby': titleId}, data: {troubleStepDone: step.id}});
  check.checked = done;
  check.addEventListener('change', () => {
    if (check.checked) record.done[step.id] = true; else delete record.done[step.id];
    card.dataset.done = String(check.checked);
    writeStore();
  });
  const actions = el('div', {className: 'trouble-step-actions'},
    stepRoutes(step.channelIds.map(id => guides.channels.get(id)).filter(Boolean)));
  if (step.linkScamShield) actions.append(button('진위확인으로 확인하기', openScamShield, {className: 'trouble-button trouble-button-secondary', data: {troubleScamShield: ''}}));
  const target = step.gotoSituation ? findSituation(guides, step.gotoSituation) : null;
  if (target) {
    actions.append(button(`‘${target.title}’ 안내 보기`, () => { store.current = target.id; currentRecord(); render(); },
      {className: 'trouble-button trouble-button-secondary', data: {troubleGoto: target.id}}));
  }
  // 읽어주기: the device voice reads this card (site-message-read-aloud.js).
  const speak = createMessageReadAloudButton([step.title, step.body, step.duration].filter(Boolean).join('\n'), {report: message => announce(message)});
  speak.classList.add('trouble-speak');
  speak.setAttribute('aria-describedby', titleId);
  const card = el('li', {className: 'trouble-step', data: {troubleStep: step.id, urgent: String(step.urgent), done: String(done)}},
    step.urgent ? el('p', {className: 'trouble-step-urgent', text: '급해요 · 먼저 하세요'}) : null,
    el('h4', {attrs: {id: titleId}}, el('span', {className: 'trouble-step-number', text: `${number}.`, attrs: {'aria-hidden': 'true'}}), ' ', step.title),
    step.body ? el('p', {className: 'trouble-step-body', text: step.body}) : null,
    step.duration ? el('p', {className: 'trouble-step-duration', text: step.duration, data: {troubleDuration: ''}}) : null,
    actions.childElementCount ? actions : null,
    el('div', {className: 'trouble-step-tools'},
      el('label', {className: 'trouble-check'}, check, el('span', {text: '했어요'})),
      speak));
  return card;
}

function noAuthButton(channelId) {
  return button(store.preferOffline ? '온라인 먼저 보기' : '인증이 안 돼요', () => toggleOffline(channelId), {
    className: 'trouble-button trouble-button-quiet',
    attrs: {'aria-pressed': store.preferOffline ? 'true' : 'false'},
    data: {troubleNoAuth: channelId},
  });
}

// Inside a step card: phones first (never smaller than an online button), then
// — once "인증이 안 돼요" was pressed — the visit routes, then the online links
// with that button beside them. A channel with neither (내 보험사) says where
// its number is.
function stepRoutes(channels) {
  const calls = channels.filter(channel => channel.phone).map(channel => callLink(
    channel.name.includes(channel.phone) ? `${channel.name} 전화하기` : `${channel.name} 전화 ${channel.phone}`,
    channel.phone, {ariaLabel: `${channel.agency} ${channel.name}에 전화하기, ${channel.phone}`}));
  const visits = store.preferOffline
    ? channels.filter(channel => channel.visit).map(channel => el('p', {className: 'trouble-visit', text: channel.visit, data: {troubleVisit: channel.id}}))
    : [];
  const withOnline = channels.filter(channel => channel.onlineUrl);
  const onlines = withOnline.map(channel => externalLink(`${channel.onlineLabel} 열기`, channel.onlineUrl, {data: {troubleOnline: channel.id}}));
  const roles = channels.filter(channel => !channel.phone && !channel.onlineUrl)
    .map(channel => el('p', {className: 'trouble-channel-role', text: `${channel.name}: ${channel.role}`}));
  return [...calls, ...visits, ...onlines, withOnline.length ? noAuthButton(withOnline[0].id) : null, ...roles].filter(Boolean);
}

// The pressed button keeps the focus after the screen is redrawn (Safari does
// not focus a tapped button, so the channel is passed in, not read from focus).
function toggleOffline(opener) {
  store.preferOffline = !store.preferOffline;
  render({focus: false});
  announce(store.preferOffline
    ? '본인인증이 안 되면 전화나 방문으로 할 수 있어요. 전화·방문 방법을 먼저 보여 드려요.'
    : '온라인 방법을 먼저 보여 드려요.');
  viewHost.querySelector(`[data-trouble-no-auth="${opener}"]`)?.focus();
}

function faultPortalSection(situation, record) {
  const guide = faultPortalGuide(situation, record.answers);
  if (!guide) return null;
  const section = el('section', {className: 'trouble-portal', data: {troublePortal: ''}, attrs: {'aria-label': '과실비율정보포털 찾는 법'}});
  if (guide.order.length) {
    section.append(el('h4', {text: '과실비율정보포털에서 고르는 순서'}),
      el('p', {className: 'trouble-portal-order', data: {troublePortalOrder: ''}}, guide.order.join(' → ')));
  }
  if (guide.selectUrl) section.append(externalLink('포털에서 직접 고르기', guide.selectUrl, {data: {troublePortalSelect: ''}}));
  if (guide.sentence && guide.describeUrl) {
    const copy = button('이 문장 복사하기', async () => {
      try { await copyText(guide.sentence); announce('문장을 복사했어요. 포털의 ‘대화로 찾기’에 붙여 넣어 주세요.'); }
      catch { announce('복사하지 못했어요. 문장을 길게 눌러 직접 복사해 주세요.'); }
    }, {className: 'trouble-button trouble-button-primary', data: {troublePortalCopy: ''}});
    section.append(el('h4', {text: '대화로 찾기'}),
      el('p', {className: 'trouble-portal-sentence', text: guide.sentence, data: {troublePortalSentence: ''}}),
      el('div', {className: 'trouble-step-actions'}, copy, externalLink('대화로 찾기 열기', guide.describeUrl, {data: {troublePortalDescribe: ''}})),
      guide.copyNote ? el('p', {className: 'trouble-note', text: guide.copyNote}) : null);
  }
  return section;
}

// ④ 모을 증거 · 참고 기준 · 공식 창구.
function renderHelp(situation, record) {
  const evidence = situation.evidence.map(entry => {
    const box = el('input', {attrs: {type: 'checkbox'}, data: {troubleEvidence: entry.id}});
    box.checked = record.evidence[entry.id] === true;
    box.addEventListener('change', () => {
      if (box.checked) record.evidence[entry.id] = true; else delete record.evidence[entry.id];
      writeStore();
    });
    return el('li', {}, el('label', {className: 'trouble-check trouble-check-wide'}, box, el('span', {text: entry.label})));
  });
  const references = situation.references.map(entry => el('li', {}, externalLink(entry.label, entry.url, {className: 'trouble-link', data: {troubleReference: ''}})));
  const listed = situation.channelIds.map(id => guides.channels.get(id)).filter(Boolean);
  const channels = store.preferOffline
    ? [...listed.filter(channel => channel.phone || channel.visit), ...listed.filter(channel => !channel.phone && !channel.visit)]
    : listed;
  viewHost.append(
    ...resultHeader(situation, record, '모을 증거와 공식 창구'),
    evidence.length ? el('section', {className: 'trouble-section', data: {troubleSection: 'evidence'}},
      el('h4', {text: '모을 증거'}), el('ul', {className: 'trouble-checklist'}, evidence)) : null,
    references.length ? el('section', {className: 'trouble-section', data: {troubleSection: 'references'}},
      el('h4', {text: '참고 기준'}), el('ul', {className: 'trouble-links'}, references)) : null,
    el('section', {className: 'trouble-section', data: {troubleSection: 'channels'}},
      el('h4', {text: '공식 창구'}),
      store.preferOffline ? el('p', {className: 'trouble-note', text: '본인인증이 안 되면 전화나 방문으로 할 수 있어요. 전화·방문 방법을 먼저 보여 드려요.'}) : null,
      situation.callScript.length ? el('details', {className: 'trouble-script', data: {troubleCallScript: ''}},
        el('summary', {text: '전화할 때 말할 내용'}),
        el('ol', {}, situation.callScript.map(line => el('li', {text: line})))) : null,
      el('ul', {className: 'trouble-channels'}, channels.map(channelCard))),
    el('div', {className: 'trouble-nav'},
      button('← 할 일', () => { record.view = 'steps'; render(); }, {className: 'trouble-button trouble-button-secondary', data: {troubleBack: ''}}),
      button('다음: 상황 정리표 →', () => { record.view = 'summary'; render(); }, {className: 'trouble-button trouble-button-primary', data: {troubleNext: ''}})),
    footer(),
  );
}

function channelCard(channel) {
  const call = channel.phone
    ? callLink(`전화하기 ${channel.phone}`, channel.phone, {ariaLabel: `${channel.agency} ${channel.name}에 전화하기, ${channel.phone}`})
    : null;
  const online = channel.onlineUrl ? externalLink(`${channel.onlineLabel} 열기`, channel.onlineUrl, {data: {troubleOnline: channel.id}}) : null;
  const noAuth = online ? noAuthButton(channel.id) : null;
  const visit = channel.visit ? el('p', {className: 'trouble-visit', data: {troubleVisit: channel.id}}, el('strong', {text: '방문 '}), channel.visit) : null;
  const visitLink = channel.visitUrl ? externalLink('방문 안내 열기', channel.visitUrl, {className: 'trouble-link'}) : null;
  const fees = feeLine(channel);
  const hours = hoursLine(channel);
  // "확인일 2026-10-10 · 근거 보기 · 근거 2": source_url first, then other_source_urls.
  const sources = [channel.sourceUrl, ...channel.otherSourceUrls].filter(Boolean);
  const verifiedParts = [
    channel.verifiedAt ? `확인일 ${channel.verifiedAt}` : null,
    ...sources.map((url, index) => externalLink(index === 0 ? '근거 보기' : `근거 ${index + 1}`, url, {className: 'trouble-link trouble-link-inline'})),
  ].filter(Boolean);
  const verified = verifiedParts.length ? el('p', {className: 'trouble-verified', data: {troubleVerified: ''}},
    verifiedParts.flatMap((part, index) => (index ? [' · ', part] : [part]))) : null;
  const routes = store.preferOffline
    ? [call, visit, visitLink, online, noAuth]
    : [call, online, noAuth];
  const card = el('li', {className: 'trouble-channel', data: {troubleChannel: channel.id}},
    channel.agency ? el('p', {className: 'trouble-channel-agency', text: channel.agency}) : null,
    el('h5', {text: channel.name}),
    channel.role ? el('p', {className: 'trouble-channel-role', text: channel.role}) : null,
    el('div', {className: 'trouble-channel-routes'}, routes.filter(Boolean)),
    hours ? el('p', {className: 'trouble-hours', text: hours, data: {troubleHours: ''}}) : null,
    fees ? el('p', {className: 'trouble-fees', text: fees, data: {troubleFees: ''}}) : null,
    !store.preferOffline ? visit : null,
    !store.preferOffline ? visitLink : null,
    channel.limits ? el('p', {className: 'trouble-limits', text: channel.limits}) : null,
    verified);
  return card;
}

// ⑤ 상황 정리표.
function renderSummary(situation, record) {
  const model = summaryModel(guides, situation, record);
  const listOrNone = (items, none) => (items.length
    ? el('ul', {className: 'trouble-sheet-list'}, items.map(item => el('li', {text: item})))
    : el('p', {className: 'trouble-sheet-empty', text: none}));
  const statusHintId = nextHeadingId();
  const statusGroup = el('fieldset', {className: 'trouble-status-group', data: {troubleStatusGroup: ''}},
    el('legend', {text: '진행 상태'}),
    ...statusOptions(guides, situation).map(option => {
      const input = el('input', {attrs: {type: 'radio', name: 'trouble-status', value: option.id}, data: {troubleStatusChoice: option.id}});
      input.checked = record.status === option.id;
      if (option.id === SUBMITTED_STATUS) input.setAttribute('aria-describedby', statusHintId);
      input.addEventListener('change', () => {
        if (!input.checked || !canChooseStatus(situation, record.fields, option.id)) return;
        record.status = option.id;
        writeStore();
        announce(`진행 상태: ${option.label}`);
      });
      return el('label', {className: 'trouble-status-option', data: {troubleStatusOption: option.id}}, input, el('span', {text: option.label}));
    }),
    el('p', {className: 'trouble-note', text: '접수번호를 적으면 고를 수 있어요', attrs: {id: statusHintId}, data: {troubleReceiptHint: ''}}));
  const fields = situation.summaryFields.map(field => {
    const id = nextHeadingId();
    const area = el('textarea', {attrs: {id, rows: '3', maxlength: '2000'}, data: {troubleField: field.id}});
    area.value = record.fields[field.id] || '';
    area.addEventListener('input', () => {
      if (area.value) record.fields[field.id] = area.value; else delete record.fields[field.id];
      if (field.id === situation.receiptFieldId) syncSubmittedLock(situation, record, statusGroup);
      queueSave();
    });
    area.addEventListener('blur', writeStore);
    return el('div', {className: 'trouble-field'}, el('label', {text: field.label, attrs: {for: id}}), area);
  });
  const saveButton = button('휴대폰에 저장', () => {
    const saved = writeStore();
    announce(saved ? `이 휴대폰에 저장했어요. (${savedAtLabel()})` : '저장하지 못했어요. 인쇄하거나 카카오로 보내 두세요.');
  }, {className: 'trouble-button trouble-button-primary', data: {troubleSave: ''}});
  const printButton = button('인쇄', () => printSummary(situation, record), {className: 'trouble-button trouble-button-secondary', data: {troublePrint: ''}});
  const shareButton = button('카카오로 보내기', () => shareSummary(situation, record), {className: 'trouble-button trouble-button-secondary', data: {troubleShare: ''}});
  viewHost.append(
    ...resultHeader(situation, record, '상황 정리표'),
    el('div', {className: 'trouble-sheet', data: {troubleSheet: ''}},
      el('dl', {className: 'trouble-sheet-facts'},
        el('div', {}, el('dt', {text: '상황'}), el('dd', {text: model.title})),
        el('div', {}, el('dt', {text: '작성일'}), el('dd', {text: model.date}))),
      el('h4', {text: '고른 답'}),
      model.answers.length
        ? el('ul', {className: 'trouble-sheet-list', data: {troubleAnswers: ''}}, model.answers.map(entry => el('li', {}, el('span', {text: entry.question}), ' ', el('strong', {text: entry.answer}))))
        : el('p', {className: 'trouble-sheet-empty', text: '아직 고른 답이 없어요.'}),
      el('h4', {text: '한 일'}),
      listOrNone(model.done, '아직 체크한 할 일이 없어요.'),
      el('h4', {text: '모은 증거'}),
      listOrNone(model.evidence, '아직 체크한 증거가 없어요.'),
      el('h4', {text: '적어 둘 내용'}),
      el('div', {className: 'trouble-fields'}, fields),
      statusGroup),
    el('div', {className: 'trouble-share-actions'}, saveButton, printButton, shareButton),
    el('p', {className: 'trouble-note', text: '적은 내용은 이 휴대폰(기기)에만 저장돼요. LOTBI 서버로 보내지 않아요.'}),
    guides.safetyNotes.length ? el('section', {className: 'trouble-section trouble-safety', data: {troubleSafety: ''}},
      el('h4', {text: '꼭 기억하세요'}), el('ul', {}, guides.safetyNotes.map(note => el('li', {text: note})))) : null,
    el('div', {className: 'trouble-nav'},
      button('← 모을 증거와 창구', () => { record.view = 'help'; render(); }, {className: 'trouble-button trouble-button-secondary', data: {troubleBack: ''}})),
    footer(),
  );
  syncSubmittedLock(situation, record, statusGroup);
  void prepareKakao();
}

// 'SUBMITTED' waits for the 접수번호 (receipt_field_id); null never locks.
function syncSubmittedLock(situation, record, group) {
  const open = receiptWritten(situation, record.fields);
  const input = group.querySelector(`[data-trouble-status-choice="${SUBMITTED_STATUS}"]`);
  const hint = group.querySelector('[data-trouble-receipt-hint]');
  if (input) input.disabled = !open;
  group.querySelector(`[data-trouble-status-option="${SUBMITTED_STATUS}"]`)?.toggleAttribute('data-locked', !open);
  if (hint) hint.hidden = open;
  if (!open && record.status === SUBMITTED_STATUS) {
    record.status = 'PREPARE';
    const prepare = group.querySelector('[data-trouble-status-choice="PREPARE"]');
    if (prepare) prepare.checked = true;
    announce('접수번호가 비어 있어 진행 상태를 처음 단계로 바꿨어요.');
  }
}

// ── 인쇄 · 보내기 · 복사 ─────────────────────────────────────────────────
function printSummary(situation, record) {
  writeStore();
  const model = summaryModel(guides, situation, record);
  const section = (title, items) => (items.length ? [el('h2', {text: title}), el('ul', {}, items.map(item => el('li', {text: item})))] : []);
  const sheet = el('div', {className: 'trouble-print-sheet', data: {troublePrintSheet: ''}},
    el('p', {text: `${SHARE_TITLE} · 상황 정리표`}),
    el('h1', {text: model.title}),
    el('p', {text: `작성일 ${model.date} · 진행 상태 ${model.status}`}),
    el('p', {text: guides.notice}),
    situation.notice ? el('p', {text: situation.notice}) : null,
    ...section('고른 답', model.answers.map(entry => `${entry.question} ${entry.answer}`)),
    ...section('한 일', model.done),
    ...section('모은 증거', model.evidence),
    ...(model.fields.length ? [el('h2', {text: '적어 둔 내용'}), ...model.fields.map(entry => el('div', {className: 'trouble-print-field'}, el('h3', {text: entry.label}), el('p', {text: entry.value})))] : []),
    ...section('꼭 기억하세요', [...guides.safetyNotes]));
  document.querySelectorAll('[data-trouble-print-sheet]').forEach(node => node.remove());
  document.body.append(sheet);
  document.body.classList.add('trouble-printing');
  const done = () => { document.body.classList.remove('trouble-printing'); };
  window.addEventListener('afterprint', done, {once: true});
  try {
    window.print();
    announce('인쇄 창을 열었어요.');
  } catch {
    done();
    announce('인쇄하지 못했어요.');
  }
}

async function loadKakaoShare() {
  try { return await import('./site-kakao-share.js?v=aset-ac377caccc90'); } catch { return null; }
}

// Opening the 정리표 readies the KakaoTalk SDK, so the tap on 카카오로 보내기
// reaches Kakao within the same gesture (see site-kakao-share.js). Whether it
// is ready is known before the tap: without it the phone's own share sheet
// has to open inside the tap (iPhone Safari refuses it after a wait).
let kakaoReady = false;
async function prepareKakao() {
  try { kakaoReady = Boolean(await (await loadKakaoShare())?.prepareKakaoShare()); } catch { kakaoReady = false; }
}

// 카카오톡 (when Core has it set up) → the phone's share sheet → copy.
function shareSummary(situation, record) {
  writeStore();
  const textValue = shareText(guides, situation, record);
  if (!kakaoReady) { void shareWithoutKakao(situation, textValue); return; }
  void (async () => {
    try {
      const kakao = await loadKakaoShare();
      await kakao.shareWithKakaoTalk({text: textValue, url: SHARE_URL});
      announce('카카오톡을 열었어요. 카카오톡에는 정리표 앞부분이 들어가요.');
    } catch (error) {
      if (error?.name !== 'AbortError') await shareWithoutKakao(situation, textValue);
    }
  })();
}

async function shareWithoutKakao(situation, textValue) {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({title: `${SHARE_TITLE} · ${situation.title} 상황 정리표`, text: textValue});
      announce('보낼 곳을 고르는 창을 열었어요. 카카오톡을 골라 주세요.');
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }
  try {
    await copyText(textValue);
    announce('정리표 글을 복사했어요. 카카오톡 대화창에 붙여 넣어 보내 주세요.');
  } catch {
    announce('보내지 못했어요. 인쇄하거나 이 화면을 보여 주세요.');
  }
}

async function copyText(value) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try { await navigator.clipboard.writeText(value); return; } catch {}
  }
  const surrogate = document.createElement('textarea');
  surrogate.value = value;
  surrogate.setAttribute('readonly', '');
  surrogate.style.position = 'fixed';
  surrogate.style.top = '-1000px';
  surrogate.style.opacity = '0';
  document.body.append(surrogate);
  surrogate.select();
  surrogate.setSelectionRange(0, surrogate.value.length);
  const copied = document.execCommand('copy');
  surrogate.remove();
  if (!copied) throw new Error('COPY_FAILED');
}

function stopReading() {
  try { stopMessageReadAloud('TROUBLE_HELPER_VIEW'); } catch {}
}

// ── loading ────────────────────────────────────────────────────────────
function renderFailure() {
  viewHost.replaceChildren();
  viewHost.dataset.troubleView = 'error';
  setProgress('');
  viewHost.append(
    el('p', {className: 'trouble-failure', text: FALLBACK_MESSAGE, attrs: {tabindex: '-1'}, data: {troubleFailure: '', troubleHeading: ''}}),
    el('div', {className: 'trouble-failure-calls'}, FALLBACK_CALLS.map(entry => callLink(entry.label, entry.phone, {data: {troubleFallbackCall: entry.phone}}))),
    button('다시 불러오기', () => { void loadGuides(); }, {className: 'trouble-button trouble-button-secondary', data: {troubleRetry: ''}}),
  );
  announce('');
  viewHost.querySelector('[data-trouble-failure]')?.focus({preventScroll: true});
}

async function loadGuides() {
  if (guides) { render(); return; }
  if (loading) return;
  viewHost?.replaceChildren(el('p', {className: 'trouble-loading', text: '안내를 불러오고 있어요.'}));
  if (viewHost) viewHost.dataset.troubleView = 'loading';
  loading = fetchTroubleGuides();
  try {
    guides = await loading;
    reconcileStore();
    if (dialog?.open) render();
  } catch {
    if (dialog?.open) renderFailure();
  } finally {
    loading = null;
  }
}

// ── dialog ─────────────────────────────────────────────────────────────
function closeMobileDrawer(triggerNode) {
  if (!triggerNode?.closest?.('#mobile-nav-drawer') || !document.body.classList.contains('nav-drawer-open')) return;
  const close = document.querySelector('[data-mobile-nav-close]');
  if (close instanceof HTMLButtonElement) close.click();
}

function openDialog(event) {
  if (!dialog) return;
  dialogTrigger = event?.currentTarget instanceof HTMLElement ? event.currentTarget : document.activeElement;
  closeMobileDrawer(dialogTrigger);
  if (!dialog.open) {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else {
      dialog.setAttribute('open', '');
      dialog.setAttribute('aria-modal', 'true');
    }
  }
  try { window.sessionStorage.setItem(OPEN_FLAG_KEY, '1'); } catch {}
  announce('');
  // The progress in memory is the one to show: it was read from this device
  // once, and where storage is blocked it is the only copy there is.
  if (guides) render();
  else void loadGuides();
}

// Settled at once, not on the 'close' event: Chrome can hold that event until a
// frame is rendered (see site-scam-shield.js), and a reload in between would
// reopen a dialog the reader closed.
function settleClosed() {
  stopReading();
  if (guides) writeStore();
  try { window.sessionStorage.removeItem(OPEN_FLAG_KEY); } catch {}
  document.body.classList.remove('trouble-printing');
}

function closeDialog() {
  if (!dialog) return;
  settleClosed();
  if (typeof dialog.close === 'function' && dialog.open) dialog.close();
  else dialog.removeAttribute('open');
  restoreFocus();
}

function restoreFocus() {
  if (dialog?.open) return;
  const visible = dialogTrigger instanceof HTMLElement && dialogTrigger.isConnected
    && !dialogTrigger.closest('[inert], [aria-hidden="true"]') && dialogTrigger.getClientRects().length;
  const target = visible ? dialogTrigger : document.querySelector('[data-mobile-nav-open]');
  target?.focus?.();
}

// Any other way the dialog closed (the browser, another script).
function onDialogClosed() {
  settleClosed();
  if (!document.querySelector('dialog[open]')) restoreFocus();
}

function openScamShield() {
  closeDialog();
  try { window.dispatchEvent(new CustomEvent('lotbi:scam-shield-open-request')); } catch {}
}

function bindTroubleHelper() {
  const found = document.querySelector('[data-trouble-dialog]');
  if (found && found !== dialog) {
    dialog = found;
    viewHost = dialog.querySelector('[data-trouble-view]');
    scrollHost = dialog.querySelector('[data-trouble-scroll]');
    statusNode = dialog.querySelector('[data-trouble-status]');
    progressNode = dialog.querySelector('[data-trouble-progress]');
  }
  if (dialog && dialog.dataset.troubleBound !== 'true') {
    dialog.dataset.troubleBound = 'true';
    dialog.addEventListener('close', onDialogClosed);
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeDialog();
    });
    dialog.querySelectorAll('[data-trouble-close]').forEach(node => node.addEventListener('click', closeDialog));
  }
  document.querySelectorAll('[data-trouble-open]').forEach(node => {
    if (node.dataset.troubleBound === 'true') return;
    node.dataset.troubleBound = 'true';
    node.addEventListener('click', openDialog);
  });
}

function reopenAfterReload() {
  let wasOpen = false;
  try { wasOpen = window.sessionStorage.getItem(OPEN_FLAG_KEY) === '1'; } catch {}
  if (!wasOpen || !dialog || dialog.open) return;
  // Another Site screen in the address (/#calendar …) wins over this dialog.
  if (ROUTE_HASH_RE.test(window.location.hash || '')) {
    try { window.sessionStorage.removeItem(OPEN_FLAG_KEY); } catch {}
    return;
  }
  openDialog();
}

if (typeof document !== 'undefined' && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  try {
    store = readStore();
    bindTroubleHelper();
    reopenAfterReload();
    window.addEventListener('lotbi:home-shell-hydrated', () => { bindTroubleHelper(); reopenAfterReload(); });
    window.addEventListener('pagehide', () => { if (guides && dialog?.open) writeStore(); });
  } catch {}
}
