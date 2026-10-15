// TROUBLE-HELPER-PAGE-01 — 분쟁·사고 도우미 as a page.
//
// Owner-approved design (2026-10-14): "팝업 형태로 되면 안돼 페이지로 해야돼".
// The menu (data-trouble-open, desktop sidebar and mobile drawer) opens a
// workspace the way Life Wallet · 지역정보 do (site-conversation.js
// openTroubleHelperPage, route #trouble): the middle of the screen becomes this
// page, with the workspace header ← (no close mark, no dimmed backdrop). This module
// draws inside it:
//   ⓪ 무슨 일이 있으셨나요? — the five situations Core sends
//   ① a situation's first screen — 눌러서 답하기 · 바로 도움받기 (no
//      emergency-number line: "누가 119·112 몰라서 롯비를 열어? 삭제해")
//   ② one question per screen (the guide's own answers, plus 잘 모르겠어요
//      where the guide has none; 질문 그만하고 결과 보기 any time)
//   ③ 이렇게 하세요 — 지금 할 일 · 챙길 것 · 도움받을 곳, each opening in place
//   ④ 상황 정리표 — save on this device, print, 카카오로 보내기
// Only what exists is offered: no photo reading, no free-text understanding,
// no generated letters, no ratio or repair cost, no voice.
//
// Every guide sentence comes from Core's public GET /v2/trouble-helper/guides
// (site-trouble-helper-model.js). No login is needed and nothing is sent back.
// Progress (situation, answers, checks, the 정리표) stays on this device only
// (localStorage, try/catch: the page works without it).
import {
  DISCLAIMER,
  FALLBACK_CALLS,
  FALLBACK_MESSAGE,
  NO_AUTO_SEND,
  PAGE_COPY,
  PORTAL_SENTENCE_HINT,
  SHARE_TITLE,
  SHARE_URL,
  SUBMITTED_STATUS,
  TROUBLE_HELPER_STORAGE_KEY,
  answeredSummary,
  canChooseStatus,
  cardModel,
  cleanAnswers,
  faultPortalGuide,
  feeLine,
  fetchTroubleGuides,
  findSituation,
  hasUnknownOption,
  hoursLine,
  localDay,
  nextQuestion,
  normalizeRecord,
  receiptWritten,
  savedAtLabel,
  shareText,
  statusOptions,
  summaryModel,
  telHref,
  visibleQuestions,
  visibleSteps,
} from './site-trouble-helper-model.js?v=aset-749187ce9eff';

const RESET_CONFIRM_MS = 6000;
const SITUATION_ICONS = Object.freeze({
  CAR_ACCIDENT: 'car', USED_TRADE_FRAUD: 'package', WAGE_ARREARS: 'money', FLOOR_NOISE: 'noise', OTHER_LEGAL: 'question',
});

// Stroke icons (24 by 24), drawn with createElementNS — never markup strings.
const ICONS = Object.freeze({
  car: [['path', 'M3 16v-3.5L5.6 7.2A2 2 0 0 1 7.4 6h9.2a2 2 0 0 1 1.8 1.2L21 12.5V16'], ['path', 'M3 12.5h18'], ['path', 'M3 16h1.5M9.5 16h5M19.5 16H21'], ['circle', 7, 16.5, 2.2], ['circle', 17, 16.5, 2.2]],
  package: [['path', 'M21 8 12 3 3 8v8l9 5 9-5Z'], ['path', 'm3 8 9 5 9-5'], ['path', 'M12 13v8'], ['path', 'm7.5 5.5 9 5']],
  money: [['rect', 2, 6, 20, 12, 2], ['circle', 12, 12, 2.6], ['path', 'M6 12h.01M18 12h.01']],
  noise: [['path', 'M3 21V9l7-5 7 5v12'], ['path', 'M2 21h16'], ['path', 'M8 21v-5h4v5'], ['path', 'M19.6 9.5a4 4 0 0 1 0 5'], ['path', 'M21.8 7.5a7 7 0 0 1 0 9']],
  question: [['path', 'M21 12a8.5 8.5 0 0 1-12.4 7.6L3 21l1.4-5.4A8.5 8.5 0 1 1 21 12Z'], ['path', 'M9.8 9.6a2.3 2.3 0 1 1 3.2 2.1c-.6.3-1 .8-1 1.5'], ['path', 'M12 16.3h.01']],
  tap: [['path', 'M9 11V4.5a1.5 1.5 0 0 1 3 0V10'], ['path', 'M12 9.5a1.5 1.5 0 0 1 3 0V11'], ['path', 'M15 10.5a1.5 1.5 0 0 1 3 0V12'], ['path', 'M18 11.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1.5a6 6 0 0 1-4.6-2.2L4.4 15.6a1.6 1.6 0 0 1 2.4-2.1L9 15.5']],
  arrow: [['path', 'M5 12h14'], ['path', 'm12 5 7 7-7 7']],
  chevron: [['path', 'm9 18 6-6-6-6']],
  down: [['path', 'm6 9 6 6 6-6']],
  up: [['path', 'm18 15-6-6-6 6']],
  phone: [['path', 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z']],
  alert: [['path', 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z'], ['path', 'M12 9v4'], ['path', 'M12 17h.01']],
  bolt: [['path', 'M13 2 4 14h8l-1 8 9-12h-8l1-8Z']],
  clip: [['rect', 8, 2, 8, 4, 1], ['path', 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2'], ['path', 'm9 14 2 2 4-4']],
  bank: [['path', 'M3 21h18'], ['path', 'M5 18v-7M9.5 18v-7M14.5 18v-7M19 18v-7'], ['path', 'M12 3 21 8H3Z']],
  check: [['path', 'M20 6 9 17l-5-5']],
  cross: [['path', 'M18 6 6 18'], ['path', 'm6 6 12 12']],
  help: [['circle', 12, 12, 10], ['path', 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3'], ['path', 'M12 17h.01']],
  info: [['circle', 12, 12, 10], ['path', 'M12 16v-4'], ['path', 'M12 8h.01']],
  file: [['path', 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z'], ['path', 'M14 2v6h6'], ['path', 'M8 13h8M8 17h6']],
  lock: [['rect', 4, 11, 16, 10, 2], ['path', 'M8 11V7a4 4 0 0 1 8 0v4']],
  external: [['path', 'M15 3h6v6'], ['path', 'M10 14 21 3'], ['path', 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6']],
});
const SVG_NS = 'http://www.w3.org/2000/svg';

function icon(name, size = 24) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  for (const [key, value] of Object.entries({width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false', class: 'trouble-icon'})) {
    svg.setAttribute(key, String(value));
  }
  for (const [shape, ...args] of ICONS[name] || []) {
    const node = document.createElementNS(SVG_NS, shape);
    if (shape === 'path') node.setAttribute('d', args[0]);
    else if (shape === 'circle') ['cx', 'cy', 'r'].forEach((key, i) => node.setAttribute(key, String(args[i])));
    else ['x', 'y', 'width', 'height', 'rx'].forEach((key, i) => node.setAttribute(key, String(args[i])));
    svg.append(node);
  }
  return svg;
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

function button(label, onClick, {className = 'trouble-button', data, attrs, iconName, iconAfter} = {}) {
  const node = el('button', {className, attrs: {type: 'button', ...attrs}, data, on: {click: onClick}});
  if (iconName && !iconAfter) node.append(icon(iconName));
  node.append(el('span', {text: label}));
  if (iconName && iconAfter) node.append(icon(iconName));
  return node;
}

function externalLink(label, href, {className = 'trouble-button trouble-button-line', data} = {}) {
  return el('a', {className, attrs: {href, target: '_blank', rel: 'noopener noreferrer'}, data},
    el('span', {text: label}), el('span', {className: 'trouble-sr', text: ' (새 창에서 열려요)'}));
}

function callLink(label, phone, {className = 'trouble-button trouble-call', ariaLabel, data} = {}) {
  const href = telHref(phone);
  if (!href) return null;
  // The number never breaks in the middle ("02-" / "3702-8500"): it wraps as one piece.
  const at = label.lastIndexOf(phone);
  const text = at > 0
    ? el('span', {}, label.slice(0, at), el('span', {className: 'trouble-phone-number', text: label.slice(at)}))
    : el('span', {text: label});
  return el('a', {className, attrs: {href, 'aria-label': ariaLabel || label}, data: {troublePhone: phone, ...data}}, icon('phone', 22), text);
}

// ── the page ────────────────────────────────────────────────────────────
// mountTroubleHelper(root, {resume}) draws the page into the workspace body
// (site-conversation.js). resume: reopened from the address (#trouble on a
// reload or back/forward) → the screen it was on; from the menu → the start.
export function mountTroubleHelper(root, {resume = false} = {}) {
  let guides = null;
  let loading = null;
  let disposed = false;
  let store = readStore();
  let resetArmedUntil = 0;
  let saveTimer = 0;
  let headingSequence = 0;
  let kakaoReady = false;
  // The screens on this page, last on top: {view} | {view: 'ask', question}.
  let stack = [{view: 'hub'}];
  const open = {todo: false, keep: false, help: false};

  const page = el('div', {className: 'trouble-page', data: {troublePage: ''}});
  const viewHost = el('div', {className: 'trouble-view', data: {troubleView: 'loading'}});
  const statusNode = el('p', {className: 'trouble-status', attrs: {role: 'status', 'aria-live': 'polite'}, data: {troubleStatus: ''}});
  page.append(viewHost, statusNode);
  root.replaceChildren(page);

  function emptyStore() { return {version: 1, current: '', preferOffline: false, cases: {}}; }
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
  const currentSituation = () => findSituation(guides, store.current);
  function recordOf(situation) {
    if (!store.cases[situation.id]) store.cases[situation.id] = normalizeRecord(situation, {view: 'start', createdOn: localDay()});
    return store.cases[situation.id];
  }

  function announce(message) { statusNode.textContent = message || ''; }
  function nextHeadingId() { headingSequence += 1; return `trouble-heading-${headingSequence}`; }
  function heading(textValue, {level = 'h3', className = 'trouble-title'} = {}) {
    return el(level, {className, text: textValue, attrs: {tabindex: '-1', id: nextHeadingId()}, data: {troubleHeading: ''}});
  }
  function show(...parts) { viewHost.append(...parts.flat().filter(Boolean)); }
  const top = () => stack[stack.length - 1];

  // ── navigation inside the page ──
  // A screen above the first one carries a back control marked
  // data-subview-back: the workspace header ← and the phone/browser back press
  // it (site-conversation.js SUBVIEW-BACK-NAVIGATION-01), so back steps one
  // screen at a time and only leaves the page from the first one.
  function go(entry, {replace = false} = {}) {
    if (replace) stack[stack.length - 1] = entry; else stack.push(entry);
    syncRecordView();
    render();
  }
  function back() {
    if (stack.length <= 1) return false;
    stack.pop();
    syncRecordView();
    render();
    return true;
  }
  function syncRecordView() {
    const entry = top();
    const situation = currentSituation();
    if (entry.view === 'hub') { store.current = ''; return; }
    if (situation) recordOf(situation).view = entry.view;
  }

  function render({focus = true} = {}) {
    if (disposed) return;
    viewHost.replaceChildren();
    announce('');
    if (!guides) return;
    const entry = top();
    const situation = currentSituation();
    if (entry.view !== 'hub' && !situation) stack = [{view: 'hub'}];
    const view = top().view;
    viewHost.dataset.troubleView = view;
    page.dataset.troubleSituation = view === 'hub' ? '' : situation.id;
    if (stack.length > 1) {
      viewHost.append(button('이전 화면', () => { back(); }, {className: 'trouble-subview-back', attrs: {'aria-hidden': 'true', tabindex: '-1'}, data: {subviewBack: '', troubleBack: ''}}));
    }
    if (view === 'hub') renderHub();
    else if (view === 'start') renderStart(situation);
    else if (view === 'ask') renderAsk(situation, top().question);
    else if (view === 'result') renderResult(situation);
    else renderSummary(situation);
    writeStore();
    if (focus) {
      const scroller = root.closest('.consumer-workspace');
      if (scroller) scroller.scrollTop = 0;
      viewHost.querySelector('[data-trouble-heading]')?.focus({preventScroll: true});
    }
  }

  // ⓪ 무슨 일이 있으셨나요?
  function renderHub() {
    const items = guides.situations.map(situation => {
      const saved = store.cases[situation.id];
      const resumable = saved && (Object.keys(saved.answers || {}).length || Object.keys(saved.fields || {}).length);
      return el('li', {},
        el('button', {className: 'trouble-cat', attrs: {type: 'button'}, data: {troubleSituation: situation.id},
          on: {click: () => chooseSituation(situation.id)}},
        el('span', {className: 'trouble-cat-icon'}, icon(SITUATION_ICONS[situation.id] || 'question', 30)),
        el('span', {className: 'trouble-cat-text'},
          el('strong', {text: situation.title}),
          situation.subtitle ? el('span', {className: 'trouble-cat-sub', text: situation.subtitle}) : null,
          resumable ? el('span', {className: 'trouble-resume', text: PAGE_COPY.resume}) : null),
        el('span', {className: 'trouble-cat-chev'}, icon('chevron', 26))));
    });
    show(
      el('div', {className: 'trouble-head'}, heading(PAGE_COPY.hubTitle), el('p', {className: 'trouble-sub', text: PAGE_COPY.hubSub})),
      el('ul', {className: 'trouble-cats'}, items),
      el('p', {className: 'trouble-notice', data: {troubleNotice: ''}}, icon('info', 22), el('span', {text: guides.notice})),
    );
  }

  // A situation tap opens its first screen; what was answered before is kept.
  function chooseSituation(id) {
    store.current = id;
    const situation = currentSituation();
    if (!situation) return;
    Object.assign(open, {todo: false, keep: false, help: false});
    stack = [{view: 'hub'}, {view: 'start'}];
    recordOf(situation).view = 'start';
    render();
  }

  function chip(situation) {
    return el('div', {className: 'trouble-chip-row'},
      el('span', {className: 'trouble-chip', data: {troubleChip: situation.id}}, icon(SITUATION_ICONS[situation.id] || 'question', 22), el('span', {text: situation.title})));
  }

  // ① the first screen of a situation.
  function renderStart(situation) {
    show(
      chip(situation),
      el('div', {className: 'trouble-head'}, heading(PAGE_COPY.startTitle), el('p', {className: 'trouble-sub', text: PAGE_COPY.startSub})),
      el('button', {className: 'trouble-tap', attrs: {type: 'button'}, data: {troubleStartAsk: ''}, on: {click: () => startAsking(situation)}},
        el('span', {className: 'trouble-tap-circle'}, icon('tap', 36)),
        el('span', {className: 'trouble-tap-text'}, el('strong', {text: PAGE_COPY.tapLabel}), el('span', {text: PAGE_COPY.tapHint}))),
      button(PAGE_COPY.direct, () => go({view: 'result'}), {className: 'trouble-button trouble-primary trouble-direct', data: {troubleDirect: ''}, iconName: 'arrow', iconAfter: true}),
    );
  }

  function startAsking(situation) {
    const record = recordOf(situation);
    const question = nextQuestion(situation, record.answers, record.skipped);
    if (question) go({view: 'ask', question: question.id});
    else go({view: 'result'});
  }

  // ② one question per screen.
  function renderAsk(situation, questionId) {
    const record = recordOf(situation);
    const question = visibleQuestions(situation, record.answers).find(item => item.id === questionId);
    if (!question) { go({view: 'result'}, {replace: true}); return; }
    const answered = Object.keys(cleanAnswers(situation, record.answers)).length;
    const iconFor = option => (option.id === 'unknown' ? 'help' : option.id === 'yes' ? 'check' : option.id === 'no' ? 'cross' : 'chevron');
    const answers = question.options.map(option => {
      const neutral = option.id === 'unknown' || option.label === PAGE_COPY.unknown;
      return el('button', {className: `trouble-answer${neutral ? ' trouble-answer-neutral' : ''}`,
        attrs: {type: 'button', 'aria-pressed': record.answers[question.id] === option.id ? 'true' : 'false'},
        data: {troubleOption: option.id}, on: {click: () => chooseAnswer(situation, question.id, option.id)}},
      el('span', {className: 'trouble-answer-icon'}, icon(iconFor(option), 24)), el('span', {text: option.label}));
    });
    if (!hasUnknownOption(question)) {
      answers.push(el('button', {className: 'trouble-answer trouble-answer-neutral', attrs: {type: 'button'}, data: {troubleSkip: question.id},
        on: {click: () => skipQuestion(situation, question.id)}},
      el('span', {className: 'trouble-answer-icon'}, icon('help', 24)), el('span', {text: PAGE_COPY.unknown})));
    }
    show(
      chip(situation),
      el('div', {className: 'trouble-head'},
        el('p', {className: 'trouble-eyebrow', text: answered ? PAGE_COPY.nextAsk : PAGE_COPY.firstAsk}),
        heading(question.text)),
      el('div', {className: 'trouble-answers', attrs: {role: 'group', 'aria-label': question.text}, data: {troubleQuestion: question.id}}, answers),
      button(PAGE_COPY.stopAsking, () => go({view: 'result'}), {className: 'trouble-link-button', data: {troubleToResult: ''}}),
      givenSection(situation, record, {title: PAGE_COPY.given}),
    );
  }

  function chooseAnswer(situation, questionId, optionId) {
    const record = recordOf(situation);
    record.answers = cleanAnswers(situation, {...record.answers, [questionId]: optionId});
    delete record.skipped[questionId];
    advance(situation);
  }

  function skipQuestion(situation, questionId) {
    const record = recordOf(situation);
    const next = {...record.answers};
    delete next[questionId];
    record.answers = cleanAnswers(situation, next);
    record.skipped[questionId] = true;
    advance(situation);
  }

  function advance(situation) {
    const record = recordOf(situation);
    const question = nextQuestion(situation, record.answers, record.skipped);
    go(question ? {view: 'ask', question: question.id} : {view: 'result'});
  }

  // The answers given so far, each with 바꾸기 (back to that question).
  function givenSection(situation, record, {title, empty = false} = {}) {
    const rows = answeredSummary(situation, record.answers);
    const ids = visibleQuestions(situation, record.answers).filter(question => Object.hasOwn(record.answers, question.id)).map(question => question.id);
    if (!rows.length && !empty) return null;
    const titleId = nextHeadingId();
    return el('section', {className: 'trouble-given', attrs: {'aria-labelledby': titleId}, data: {troubleGiven: ''}},
      el('h4', {text: title, attrs: {id: titleId}}),
      rows.length
        ? el('ul', {className: 'trouble-given-list', data: {troubleAnswers: ''}}, rows.map((row, index) => el('li', {},
          el('span', {className: 'trouble-given-q', text: row.question}),
          el('strong', {text: row.answer}),
          button(PAGE_COPY.change, () => {
            delete recordOf(situation).skipped[ids[index]];
            go({view: 'ask', question: ids[index]});
          }, {className: 'trouble-change', data: {troubleEdit: ids[index]}, attrs: {'aria-label': `${row.question} 답 바꾸기`}}))))
        : el('div', {className: 'trouble-given-empty'},
          el('p', {text: PAGE_COPY.toldNone}),
          button(PAGE_COPY.tapLabel, () => startAsking(situation), {className: 'trouble-button trouble-soft', data: {troubleStartAsk: ''}, iconName: 'tap'})));
  }

  // ③ 이렇게 하세요.
  function renderResult(situation) {
    const record = recordOf(situation);
    const cards = cardModel(guides, situation, record.answers);
    show(
      chip(situation),
      el('div', {className: 'trouble-head'}, heading(PAGE_COPY.resultTitle)),
      el('div', {className: 'trouble-cards'},
        resultCard('todo', 'bolt', PAGE_COPY.todo, [
          cards.todo.title ? el('strong', {className: 'trouble-card-lead', text: cards.todo.title}) : null,
          cards.todo.sentence ? el('span', {text: cards.todo.sentence}) : null,
        ], () => todoDetail(situation, record)),
        resultCard('keep', 'clip', PAGE_COPY.keep, [
          cards.keep.line ? el('strong', {className: 'trouble-card-lead', text: cards.keep.line}) : null,
          el('span', {text: PAGE_COPY.keepLine}),
        ], () => keepDetail(situation, record)),
        resultCard('help', 'bank', PAGE_COPY.help, [
          cards.help.line ? el('span', {text: cards.help.line}) : null,
        ], () => helpDetail(situation), mainRoute(cards.help.main))),
      givenSection(situation, record, {title: PAGE_COPY.told, empty: true}),
      situation.callScript.length ? el('section', {className: 'trouble-box trouble-script', data: {troubleCallScript: ''}},
        el('h4', {}, icon('phone', 24), el('span', {text: PAGE_COPY.script})),
        el('ol', {}, situation.callScript.map(line => el('li', {text: line})))) : null,
      el('section', {className: 'trouble-sheet-entry'},
        el('h4', {text: PAGE_COPY.sheetSection}),
        el('button', {className: 'trouble-doc', attrs: {type: 'button'}, data: {troubleOpenSummary: ''}, on: {click: () => go({view: 'summary'})}},
          el('span', {className: 'trouble-doc-icon'}, icon('file', 24)),
          el('span', {className: 'trouble-doc-text'}, el('strong', {text: PAGE_COPY.sheetEntry}), el('span', {text: PAGE_COPY.sheetEntryHint})),
          icon('chevron', 24))),
      disclaimer(situation),
      footer(),
    );
  }

  function resultCard(id, iconName, title, lead, detail, action = null) {
    const detailId = `trouble-card-detail-${id}`;
    const opened = open[id] === true;
    const toggle = el('button', {className: 'trouble-more', attrs: {type: 'button', 'aria-expanded': opened ? 'true' : 'false', 'aria-controls': detailId},
      data: {troubleMore: id}, on: {click: () => toggleCard(id)}}, el('span', {text: opened ? PAGE_COPY.less : PAGE_COPY.more}), icon(opened ? 'up' : 'down', 22));
    return el('article', {className: `trouble-card trouble-card-${id}`, data: {troubleCard: id, open: String(opened)}},
      el('div', {className: 'trouble-card-top'},
        el('span', {className: 'trouble-card-icon'}, icon(iconName, 26)),
        el('h4', {text: title})),
      el('p', {className: 'trouble-card-line'}, lead.filter(Boolean)),
      action ? el('div', {className: 'trouble-card-action'}, action) : null,
      // 자세히: top right on a phone (all three cards fit the first screen),
      // under the card on a wide screen (the title keeps one line).
      toggle,
      opened ? el('div', {className: 'trouble-card-detail', attrs: {id: detailId}, data: {troubleDetail: id}}, detail()) : null);
  }

  // A card opens in place; the pressed button keeps the focus.
  function toggleCard(id) {
    open[id] = !open[id];
    render({focus: false});
    viewHost.querySelector(`[data-trouble-more="${id}"]`)?.focus({preventScroll: true});
    announce(open[id] ? '자세한 내용을 펼쳤어요.' : '접었어요.');
  }

  function mainRoute(channel) {
    if (!channel) return null;
    if (channel.phone) {
      return callLink(channel.name.includes(channel.phone) ? `${channel.name} 전화하기` : `${channel.name} 전화 ${channel.phone}`, channel.phone, {
        className: 'trouble-button trouble-soft trouble-call', ariaLabel: `${channel.agency} ${channel.name}에 전화하기, ${channel.phone}`, data: {troubleMainRoute: channel.id}});
    }
    return externalLink(`${channel.onlineLabel} 열기`, channel.onlineUrl, {className: 'trouble-button trouble-soft', data: {troubleMainRoute: channel.id}});
  }

  // 지금 할 일 — the numbered steps on view, then the 과실비율정보포털 way in.
  function todoDetail(situation, record) {
    const steps = visibleSteps(situation, record.answers);
    return [
      el('ol', {className: 'trouble-steps', attrs: {'aria-label': PAGE_COPY.todo}}, steps.map((step, index) => stepCard(situation, record, step, index + 1))),
      faultPortalSection(situation, record),
    ];
  }

  function stepCard(situation, record, step, number) {
    const titleId = nextHeadingId();
    const done = record.done[step.id] === true;
    const check = el('input', {attrs: {type: 'checkbox', 'aria-describedby': titleId}, data: {troubleStepDone: step.id}});
    check.checked = done;
    const card = el('li', {className: 'trouble-step', data: {troubleStep: step.id, urgent: String(step.urgent), done: String(done)}});
    check.addEventListener('change', () => {
      if (check.checked) record.done[step.id] = true; else delete record.done[step.id];
      card.dataset.done = String(check.checked);
      writeStore();
    });
    const actions = el('div', {className: 'trouble-step-actions'},
      stepRoutes(step.channelIds.map(id => guides.channels.get(id)).filter(Boolean)));
    if (step.linkScamShield) actions.append(button('사기·피싱 확인으로 살펴보기', openScamShield, {className: 'trouble-button trouble-button-line', data: {troubleScamShield: ''}}));
    const target = step.gotoSituation ? findSituation(guides, step.gotoSituation) : null;
    if (target) {
      actions.append(button(`‘${target.title}’ 안내 보기`, () => chooseSituation(target.id),
        {className: 'trouble-button trouble-button-line', data: {troubleGoto: target.id}}));
    }
    card.append(...[
      el('div', {className: 'trouble-step-head'},
        el('span', {className: 'trouble-step-number', text: String(number), attrs: {'aria-hidden': 'true'}}),
        el('h5', {text: step.title, attrs: {id: titleId}})),
      step.urgent ? el('p', {className: 'trouble-step-urgent', text: '급해요 · 먼저 하세요'}) : null,
      step.body ? el('p', {className: 'trouble-step-body', text: step.body}) : null,
      step.duration ? el('p', {className: 'trouble-step-duration', text: step.duration, data: {troubleDuration: ''}}) : null,
      actions.childElementCount ? actions : null,
      el('label', {className: 'trouble-check'}, check, el('span', {text: '했어요'}))].filter(Boolean));
    return card;
  }

  function noAuthButton(channelId) {
    return button(store.preferOffline ? '온라인 먼저 보기' : '인증이 안 돼요', () => toggleOffline(channelId), {
      className: 'trouble-button trouble-quiet',
      attrs: {'aria-pressed': store.preferOffline ? 'true' : 'false'},
      data: {troubleNoAuth: channelId},
    });
  }

  // Inside a step: phones first, then — once "인증이 안 돼요" was pressed — the
  // visit routes, then the online links with that button beside them.
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
    const section = el('section', {className: 'trouble-box trouble-portal', data: {troublePortal: ''}, attrs: {'aria-label': '과실비율정보포털 찾는 법'}});
    if (guide.order.length) {
      section.append(el('h5', {text: '과실비율정보포털에서 고르는 순서'}),
        el('p', {className: 'trouble-portal-order', data: {troublePortalOrder: ''}}, guide.order.join(' → ')));
    } else {
      section.append(el('h5', {text: '과실비율정보포털'}));
    }
    if (guide.selectUrl) section.append(el('div', {className: 'trouble-step-actions'}, externalLink('포털에서 직접 고르기', guide.selectUrl, {data: {troublePortalSelect: ''}})));
    if (!guide.sentence && guide.describeUrl) {
      section.append(el('h5', {text: '대화로 찾기'}),
        el('p', {className: 'trouble-note', text: PORTAL_SENTENCE_HINT, data: {troublePortalHint: ''}}),
        el('div', {className: 'trouble-step-actions'}, externalLink('대화로 찾기 열기', guide.describeUrl, {data: {troublePortalDescribe: ''}})));
    }
    if (guide.sentence && guide.describeUrl) {
      const copy = button('이 문장 복사하기', async () => {
        try { await copyText(guide.sentence); announce('문장을 복사했어요. 포털의 ‘대화로 찾기’에 붙여 넣어 주세요.'); }
        catch { announce('복사하지 못했어요. 문장을 길게 눌러 직접 복사해 주세요.'); }
      }, {className: 'trouble-button trouble-primary', data: {troublePortalCopy: ''}});
      section.append(...[el('h5', {text: '대화로 찾기'}),
        el('p', {className: 'trouble-portal-sentence', text: guide.sentence, data: {troublePortalSentence: ''}}),
        el('div', {className: 'trouble-step-actions'}, copy, externalLink('대화로 찾기 열기', guide.describeUrl, {data: {troublePortalDescribe: ''}})),
        guide.copyNote ? el('p', {className: 'trouble-note', text: guide.copyNote}) : null].filter(Boolean));
    }
    return section;
  }

  // 챙길 것 — the evidence checklist and the reference links.
  function keepDetail(situation, record) {
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
    return [
      evidence.length ? el('ul', {className: 'trouble-checklist', data: {troubleSection: 'evidence'}}, evidence) : null,
      references.length ? el('section', {className: 'trouble-references', data: {troubleSection: 'references'}},
        el('h5', {text: '참고 기준'}), el('ul', {className: 'trouble-links'}, references)) : null,
    ];
  }

  // 도움받을 곳 — the official channels (phone/visit first after "인증이 안 돼요").
  function helpDetail(situation) {
    const listed = situation.channelIds.map(id => guides.channels.get(id)).filter(Boolean);
    const channels = store.preferOffline
      ? [...listed.filter(channel => channel.phone || channel.visit), ...listed.filter(channel => !channel.phone && !channel.visit)]
      : listed;
    return [
      store.preferOffline ? el('p', {className: 'trouble-note', text: '본인인증이 안 되면 전화나 방문으로 할 수 있어요. 전화·방문 방법을 먼저 보여 드려요.'}) : null,
      el('ul', {className: 'trouble-channels', data: {troubleSection: 'channels'}}, channels.map(channelCard)),
    ];
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
    const sources = [channel.sourceUrl, ...channel.otherSourceUrls].filter(Boolean);
    const verifiedParts = [
      channel.verifiedAt ? `확인일 ${channel.verifiedAt}` : null,
      ...sources.map((url, index) => externalLink(index === 0 ? '근거 보기' : `근거 ${index + 1}`, url, {className: 'trouble-link trouble-link-inline'})),
    ].filter(Boolean);
    const verified = verifiedParts.length ? el('p', {className: 'trouble-verified', data: {troubleVerified: ''}},
      verifiedParts.flatMap((part, index) => (index ? [' · ', part] : [part]))) : null;
    const routes = store.preferOffline ? [call, visit, visitLink, online, noAuth] : [call, online, noAuth];
    return el('li', {className: 'trouble-channel', data: {troubleChannel: channel.id}},
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
  }

  // The situation's own 참고용 line (Core), then the sentences the brief requires.
  function disclaimer(situation) {
    return el('div', {className: 'trouble-disclaimer', data: {troubleDisclaimer: ''}}, icon('info', 24),
      el('p', {},
        el('span', {className: 'trouble-situation-notice', text: situation.notice || guides.notice, data: {troubleSituationNotice: ''}}),
        el('strong', {text: DISCLAIMER}), el('span', {text: NO_AUTO_SEND})));
  }

  function footer() {
    const reset = button(resetArmedUntil > Date.now() ? '한 번 더 누르면 지우고 처음부터 해요' : '처음부터 다시', () => resetCurrent(reset),
      {className: 'trouble-button trouble-quiet', data: {troubleReset: ''}});
    return el('div', {className: 'trouble-footer'},
      button(PAGE_COPY.pickOther, goToHub, {className: 'trouble-button trouble-quiet', data: {troublePick: ''}}),
      reset);
  }

  function goToHub() {
    store.current = '';
    stack = [{view: 'hub'}];
    render();
  }

  // 처음부터 다시 wipes what was written for this situation, so it takes a second press.
  function resetCurrent(control) {
    if (resetArmedUntil <= Date.now()) {
      resetArmedUntil = Date.now() + RESET_CONFIRM_MS;
      control.lastElementChild.textContent = '한 번 더 누르면 지우고 처음부터 해요';
      announce('이 상황에 적은 답과 정리표가 지워져요. 지우려면 한 번 더 눌러 주세요.');
      window.setTimeout(() => {
        if (resetArmedUntil <= Date.now() && control.isConnected) control.lastElementChild.textContent = '처음부터 다시';
      }, RESET_CONFIRM_MS + 50);
      return;
    }
    resetArmedUntil = 0;
    delete store.cases[store.current];
    goToHub();
    announce('지웠어요. 상황을 다시 골라 주세요.');
  }

  // ④ 상황 정리표.
  function renderSummary(situation) {
    const record = recordOf(situation);
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
    }, {className: 'trouble-tool trouble-tool-main', data: {troubleSave: ''}, iconName: 'lock'});
    const printButton = button('인쇄', () => printSummary(situation, record), {className: 'trouble-tool', data: {troublePrint: ''}, iconName: 'file'});
    const shareButton = button('카카오로 보내기', () => shareSummary(situation, record), {className: 'trouble-tool', data: {troubleShare: ''}, iconName: 'external'});
    show(
      chip(situation),
      el('div', {className: 'trouble-head'}, heading(PAGE_COPY.sheetTitle), el('p', {className: 'trouble-sub', text: PAGE_COPY.sheetSub})),
      el('div', {className: 'trouble-tools', data: {troubleTools: ''}}, saveButton, printButton, shareButton),
      el('div', {className: 'trouble-paper', data: {troubleSheet: ''}},
        el('dl', {className: 'trouble-sheet-facts'},
          el('div', {}, el('dt', {text: '상황'}), el('dd', {text: model.title})),
          el('div', {}, el('dt', {text: '작성일'}), el('dd', {text: model.date}))),
        el('h5', {text: '고른 답'}),
        model.answers.length
          ? el('ul', {className: 'trouble-sheet-list', data: {troubleSheetAnswers: ''}}, model.answers.map(entry => el('li', {}, el('span', {text: entry.question}), ' ', el('strong', {text: entry.answer}))))
          : el('p', {className: 'trouble-sheet-empty', text: '아직 고른 답이 없어요.'}),
        el('h5', {text: '한 일'}),
        listOrNone(model.done, '아직 체크한 할 일이 없어요.'),
        el('h5', {text: '모은 증거'}),
        listOrNone(model.evidence, '아직 체크한 증거가 없어요.'),
        el('h5', {text: '적어 둘 내용'}),
        el('div', {className: 'trouble-fields'}, fields),
        statusGroup),
      el('p', {className: 'trouble-okline'}, icon('lock', 22), el('span', {text: '적은 내용은 이 휴대폰(기기)에만 저장돼요. LOTBI 서버로 보내지 않아요.'})),
      guides.safetyNotes.length ? el('section', {className: 'trouble-box trouble-safety', data: {troubleSafety: ''}},
        el('h4', {text: '꼭 기억하세요'}), el('ul', {}, guides.safetyNotes.map(note => el('li', {text: note})))) : null,
      disclaimer(situation),
      footer(),
    );
    syncSubmittedLock(situation, record, statusGroup);
    void prepareKakao();
  }

  // 'SUBMITTED' waits for the 접수번호 (receipt_field_id); null never locks.
  function syncSubmittedLock(situation, record, group) {
    const opened = receiptWritten(situation, record.fields);
    const input = group.querySelector(`[data-trouble-status-choice="${SUBMITTED_STATUS}"]`);
    const hint = group.querySelector('[data-trouble-receipt-hint]');
    if (input) input.disabled = !opened;
    group.querySelector(`[data-trouble-status-option="${SUBMITTED_STATUS}"]`)?.toggleAttribute('data-locked', !opened);
    if (hint) hint.hidden = opened;
    if (!opened && record.status === SUBMITTED_STATUS) {
      record.status = 'PREPARE';
      const prepare = group.querySelector('[data-trouble-status-choice="PREPARE"]');
      if (prepare) prepare.checked = true;
      announce('접수번호가 비어 있어 진행 상태를 처음 단계로 바꿨어요.');
    }
  }

  // ── 인쇄 · 보내기 · 복사 ──
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
      ...section('꼭 기억하세요', [...guides.safetyNotes]),
      el('p', {text: DISCLAIMER}));
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
    try { return await import('./site-kakao-share.js?v=aset-749187ce9eff'); } catch { return null; }
  }
  // Opening the 정리표 readies the KakaoTalk SDK, so the tap on 카카오로 보내기
  // reaches Kakao within the same gesture (see site-kakao-share.js).
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

  function openScamShield() {
    try { window.dispatchEvent(new CustomEvent('lotbi:scam-shield-open-request')); } catch {}
  }

  // ── loading ──
  function renderFailure() {
    viewHost.replaceChildren();
    viewHost.dataset.troubleView = 'error';
    show(
      el('p', {className: 'trouble-failure', text: FALLBACK_MESSAGE, attrs: {tabindex: '-1'}, data: {troubleFailure: '', troubleHeading: ''}}),
      el('div', {className: 'trouble-failure-calls'}, FALLBACK_CALLS.map(entry => callLink(entry.label, entry.phone, {data: {troubleFallbackCall: entry.phone}}))),
      button('다시 불러오기', () => { void loadGuides(); }, {className: 'trouble-button trouble-button-line', data: {troubleRetry: ''}}),
    );
    announce('');
    viewHost.querySelector('[data-trouble-failure]')?.focus({preventScroll: true});
  }

  async function loadGuides() {
    if (loading) return;
    viewHost.replaceChildren(el('p', {className: 'trouble-loading', text: '안내를 불러오고 있어요.'}));
    viewHost.dataset.troubleView = 'loading';
    loading = fetchTroubleGuides();
    try {
      guides = await loading;
      if (disposed) return;
      reconcileStore();
      const situation = currentSituation();
      if (resume && situation) {
        const record = recordOf(situation);
        const view = record.view;
        stack = [{view: 'hub'}, {view: 'start'}];
        if (view === 'ask') {
          const question = nextQuestion(situation, record.answers, record.skipped);
          stack.push(question ? {view: 'ask', question: question.id} : {view: 'result'});
        } else if (view === 'result') stack.push({view: 'result'});
        else if (view === 'summary') stack.push({view: 'result'}, {view: 'summary'});
      } else {
        store.current = '';
        stack = [{view: 'hub'}];
      }
      render();
    } catch {
      if (!disposed) renderFailure();
    } finally {
      loading = null;
    }
  }

  const onPageHide = () => { if (guides) writeStore(); };
  window.addEventListener('pagehide', onPageHide);
  void loadGuides();

  return {
    back,
    get view() { return top().view; },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (guides) writeStore();
      window.removeEventListener('pagehide', onPageHide);
      document.body.classList.remove('trouble-printing');
    },
  };
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
