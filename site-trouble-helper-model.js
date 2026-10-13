// TROUBLE-HELPER-01 — 분쟁·사고 도우미 ("막막할 때 롯비"): the rules behind the screen.
//
// Every guide sentence the reader sees comes from Core
// GET /v2/trouble-helper/guides (lotbi-core app/trouble_helper.py reads a
// reviewed data file): situations, questions, steps, the official channels and
// their fees. This file reads that answer, decides what to show for the
// answers given, and builds the texts the reader copies, prints or sends.
// No DOM and no storage here; the one network call is a public GET with no
// credentials and no headers, like the other public 생활정보 reads.
//
// Rules carried over from Core (owner decisions 2026-10-10):
// * reference only — the 과실비율정보포털 is linked and its order of choices
//   shown; no ratio or chart is ever produced here;
// * 상담료 / 통화료 / 신청 수수료 are separate, and an UNKNOWN value is left out
//   instead of being shown as a fact;
// * a filed form is not 접수 until there is a 접수번호: 'SUBMITTED' can be
//   chosen only once the situation's receipt_field_id holds one.
import {CORE_ORIGIN} from './site-core.js?v=aset-e99b480c964e';

export const TROUBLE_HELPER_PATH = '/v2/trouble-helper/guides';
export const TROUBLE_HELPER_STORAGE_KEY = 'lotbi.site.ux.v1.trouble-helper';
export const STATUS_IDS = Object.freeze(['PREPARE', 'SUBMITTED', 'IN_PROGRESS', 'RESULT', 'RESOLVED']);
export const SUBMITTED_STATUS = 'SUBMITTED';
export const SHARE_SAFETY_LINE = '인증번호·비밀번호는 가족에게도 보내지 마세요.';
export const SHARE_TITLE = '막막할 때 롯비';
export const SHARE_URL = 'https://lotbiai.com/';
export const FIELD_MAX_CHARS = 2000;
// The result screen's tabs, in this order, with these names (App the same).
export const RESULT_VIEWS = Object.freeze(['steps', 'help', 'summary']);
export const RESULT_TAB_LABELS = Object.freeze({steps: '할 일', help: '증거·창구', summary: '정리표'});
export const NARROW_TITLE = '내 상황에 맞게 좁히기';
export const NARROW_HINT = '답을 고르면 내 상황에 맞지 않는 할 일이 빠져요.';
export const PORTAL_SENTENCE_HINT = '내 상황에 맞게 좁히기에서 답하면 포털에 붙여 넣을 문장을 만들어 드려요';
// The only sentences not taken from Core: what to do when Core cannot be read.
export const FALLBACK_MESSAGE = '안내를 불러오지 못했어요. 급하면 112·119, 법률 고민은 132에 전화해 주세요.';
export const FALLBACK_CALLS = Object.freeze([
  Object.freeze({phone: '112', label: '112 경찰에 전화'}),
  Object.freeze({phone: '119', label: '119 소방·구급에 전화'}),
  Object.freeze({phone: '132', label: '132 법률상담에 전화'}),
]);

const TIMEOUT_MS = 15_000;
const ID_RE = /^[A-Za-z0-9_]{1,40}$/u;
const PHONE_RE = /^(?:1[0-9]{2,3}|1[0-9]{3}-[0-9]{4}|0[0-9]{1,2}-[0-9]{3,4}-[0-9]{4})$/u;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/u;
// Same official hosts Core accepts: government (.go.kr), the public bodies the
// guides name (.or.kr), 정부24 and 정책브리핑.
const OFFICIAL_HOST_RE = /^(?:[a-z0-9-]+\.)+(?:go\.kr|or\.kr)$/u;
const OFFICIAL_EXTRA_HOSTS = new Set(['www.gov.kr', 'www.korea.kr']);
const CONSULT_FEES = new Set(['FREE', 'PAID', 'UNKNOWN']);
const CALL_COSTS = new Set(['FREE', 'CALLER_PAYS', 'UNKNOWN']);
const PROCEDURE_FEES = new Set(['NONE', 'FEE', 'UNKNOWN']);

const text = (value, max = 400) => (typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim().slice(0, max) : '');
const ident = value => (typeof value === 'string' && ID_RE.test(value) ? value : '');
const list = value => (Array.isArray(value) ? value : []);
const plain = value => (value && typeof value === 'object' && !Array.isArray(value) ? value : null);

export function officialUrl(value) {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    const host = url.hostname.toLowerCase();
    return OFFICIAL_HOST_RE.test(host) || OFFICIAL_EXTRA_HOSTS.has(host) ? url.href : '';
  } catch {
    return '';
  }
}

export function telHref(phone) {
  return PHONE_RE.test(String(phone || '')) ? `tel:${String(phone).replace(/-/gu, '')}` : '';
}

// {questionId: [answerId…]} — TROUBLE-HELPER-URGENT-FIRST-01: only the
// questions already answered count. A question not answered yet never hides
// anything (not known = shown); one answered with an answer outside the list
// hides it. Absent = always shown; a rule that cannot be read is never
// satisfied.
function normalizeShowIf(raw) {
  if (raw === undefined || raw === null) return null;
  const rule = plain(raw);
  if (!rule || !Object.keys(rule).length) return Object.freeze({'': Object.freeze([])});
  const out = {};
  for (const [key, answers] of Object.entries(rule)) {
    const qid = ident(key);
    const options = list(answers).map(ident).filter(Boolean);
    if (!qid || !options.length) return Object.freeze({'': Object.freeze([])});
    out[qid] = Object.freeze(options);
  }
  return Object.freeze(out);
}

export function isShown(showIf, answers = {}) {
  if (!showIf) return true;
  return Object.entries(showIf).every(([qid, options]) => {
    if (!qid) return false;
    const given = Object.hasOwn(answers || {}, qid) ? answers[qid] : undefined;
    return given === undefined || options.includes(given);
  });
}

function normalizeChannel(raw) {
  const item = plain(raw);
  const id = ident(item?.id);
  const name = text(item?.name, 80);
  if (!id || !name) return null;
  const phone = PHONE_RE.test(item.phone || '') ? item.phone : '';
  const onlineUrl = officialUrl(item.online_url);
  return Object.freeze({
    id,
    agency: text(item.agency, 80),
    name,
    role: text(item.role),
    phone,
    hours: text(item.hours, 80),
    consultFee: CONSULT_FEES.has(item.consult_fee) ? item.consult_fee : 'UNKNOWN',
    callCost: CALL_COSTS.has(item.call_cost) ? item.call_cost : 'UNKNOWN',
    procedureFee: PROCEDURE_FEES.has(item.procedure_fee) ? item.procedure_fee : 'UNKNOWN',
    procedureFeeNote: text(item.procedure_fee_note),
    onlineUrl,
    onlineLabel: onlineUrl ? (text(item.online_label, 60) || name) : '',
    visit: text(item.visit),
    visitUrl: officialUrl(item.visit_url),
    limits: text(item.limits),
    sourceUrl: officialUrl(item.source_url),
    otherSourceUrls: Object.freeze(list(item.other_source_urls).map(officialUrl).filter(Boolean).slice(0, 4)),
    verifiedAt: DAY_RE.test(item.verified_at || '') ? item.verified_at : '',
  });
}

function normalizeOptions(raw) {
  const seen = new Set();
  const out = [];
  for (const option of list(raw)) {
    const id = ident(option?.id);
    const label = text(option?.label, 40);
    if (!id || !label || seen.has(id)) continue;
    seen.add(id);
    out.push(Object.freeze({id, label}));
  }
  return Object.freeze(out);
}

function normalizeLabelled(raw, max = 60) {
  const seen = new Set();
  const out = [];
  for (const entry of list(raw)) {
    const id = ident(entry?.id);
    const label = text(entry?.label, max);
    if (!id || !label || seen.has(id)) continue;
    seen.add(id);
    out.push(Object.freeze({id, label}));
  }
  return Object.freeze(out);
}

function normalizeFaultPortal(raw) {
  const portal = plain(raw);
  if (!portal) return null;
  const selectUrl = officialUrl(portal.select_url);
  const describeUrl = officialUrl(portal.describe_url);
  if (!selectUrl && !describeUrl) return null;
  const labels = value => Object.freeze(Object.fromEntries(Object.entries(plain(value) || {})
    .filter(([key, label]) => ident(key) && text(label, 80)).map(([key, label]) => [key, text(label, 80)])));
  const min = Number.isInteger(portal.describe_min_chars) && portal.describe_min_chars > 0 ? portal.describe_min_chars : 20;
  const max = Number.isInteger(portal.describe_max_chars) && portal.describe_max_chars >= min ? portal.describe_max_chars : 1000;
  return Object.freeze({
    selectUrl,
    describeUrl,
    pmUrl: officialUrl(portal.pm_url),
    step1: labels(portal.step1),
    step2: labels(portal.step2),
    minChars: min,
    maxChars: max,
    copyNote: text(portal.copy_note),
  });
}

function normalizeSituation(raw, channels) {
  const item = plain(raw);
  const id = ident(item?.id);
  const title = text(item?.title, 80);
  if (!id || !title) return null;
  const questions = [];
  const qids = new Set();
  for (const question of list(item.questions)) {
    const qid = ident(question?.id);
    const options = normalizeOptions(question?.options);
    const questionText = text(question?.text, 120);
    if (!qid || qids.has(qid) || !questionText || options.length < 2) continue;
    qids.add(qid);
    questions.push(Object.freeze({id: qid, text: questionText, showIf: normalizeShowIf(question.show_if), options}));
  }
  const steps = [];
  const stepIds = new Set();
  for (const step of list(item.steps)) {
    const sid = ident(step?.id);
    const stepTitle = text(step?.title, 80);
    if (!sid || stepIds.has(sid) || !stepTitle) continue;
    stepIds.add(sid);
    steps.push(Object.freeze({
      id: sid,
      title: stepTitle,
      body: text(step.body),
      duration: text(step.duration, 200),
      urgent: step.urgent === true,
      status: STATUS_IDS.includes(step.status) ? step.status : 'PREPARE',
      channelIds: Object.freeze(list(step.channel_ids).map(ident).filter(cid => channels.has(cid))),
      showIf: normalizeShowIf(step.show_if),
      linkScamShield: step.link_scam_shield === true,
      gotoSituation: ident(step.goto_situation),
    }));
  }
  if (!steps.length) return null;
  const summaryFields = normalizeLabelled(item.summary_fields);
  const receipt = ident(item.receipt_field_id);
  const statusLabels = {};
  for (const [key, label] of Object.entries(plain(item.status_labels) || {})) {
    if (STATUS_IDS.includes(key) && text(label, 40)) statusLabels[key] = text(label, 40);
  }
  return Object.freeze({
    id,
    order: Number.isFinite(item.order) ? item.order : 999,
    title,
    subtitle: text(item.subtitle, 80),
    notice: text(item.notice, 200),
    // null (OTHER_LEGAL): nothing to wait for, 'SUBMITTED' is never locked.
    receiptFieldId: receipt && summaryFields.some(field => field.id === receipt) ? receipt : null,
    questions: Object.freeze(questions),
    steps: Object.freeze(steps),
    evidence: normalizeLabelled(item.evidence),
    references: Object.freeze(list(item.references)
      .map(entry => ({label: text(entry?.label, 80), url: officialUrl(entry?.url)}))
      .filter(entry => entry.label && entry.url).map(Object.freeze)),
    faultPortal: normalizeFaultPortal(item.fault_portal),
    channelIds: Object.freeze(list(item.channel_ids).map(ident).filter(cid => channels.has(cid))),
    callScript: Object.freeze(list(item.call_script).map(line => text(line, 160)).filter(Boolean)),
    summaryFields,
    statusLabels: Object.freeze(statusLabels),
  });
}

// Core's answer → the shape the screen uses, or null when it cannot be used.
export function normalizeGuides(raw) {
  const root = plain(raw);
  if (!root) return null;
  const notice = text(root.notice, 200);
  const channels = new Map();
  for (const entry of list(root.channels)) {
    const channel = normalizeChannel(entry);
    if (channel && !channels.has(channel.id)) channels.set(channel.id, channel);
  }
  const track = [];
  for (const entry of list(root.status_track)) {
    if (STATUS_IDS.includes(entry?.id) && text(entry?.label, 40) && !track.some(item => item.id === entry.id)) {
      track.push(Object.freeze({id: entry.id, label: text(entry.label, 40)}));
    }
  }
  const situations = list(root.situations).map(entry => normalizeSituation(entry, channels)).filter(Boolean)
    .sort((a, b) => a.order - b.order);
  if (!notice || !situations.length || track.length !== STATUS_IDS.length) return null;
  return Object.freeze({
    guideVersion: text(root.guide_version, 40),
    verifiedOn: DAY_RE.test(root.verified_on || '') ? root.verified_on : '',
    notice,
    statusTrack: Object.freeze(track),
    safetyNotes: Object.freeze(list(root.safety_notes).map(note => text(note)).filter(Boolean)),
    situations: Object.freeze(situations),
    channels,
  });
}

export function findSituation(guides, id) {
  return guides?.situations.find(item => item.id === id) || null;
}

// Answers kept only for options that exist and questions still on screen. An
// answer that hides another question drops that question's answer, which may
// bring back what it hid, so this repeats until nothing changes.
export function cleanAnswers(situation, answers = {}) {
  const clean = {};
  for (const question of situation.questions) {
    const value = Object.hasOwn(answers || {}, question.id) ? answers[question.id] : undefined;
    if (question.options.some(option => option.id === value)) clean[question.id] = value;
  }
  for (let changed = true; changed;) {
    changed = false;
    for (const question of situation.questions) {
      if (Object.hasOwn(clean, question.id) && !isShown(question.showIf, clean)) {
        delete clean[question.id];
        changed = true;
      }
    }
  }
  return clean;
}

// The "답한 질문 n/m" count inside 내 상황에 맞게 좁히기.
export function answeredCount(situation, answers = {}) {
  const clean = cleanAnswers(situation, answers);
  const questions = visibleQuestions(situation, clean);
  return {answered: questions.filter(question => Object.hasOwn(clean, question.id)).length, total: questions.length};
}

// The '바로 전화' row: 112 and 119 among the steps on screen, in step order.
export const QUICK_CALL_PHONES = Object.freeze(['112', '119']);
export function quickCalls(guides, situation, answers = {}) {
  const seen = new Set();
  const out = [];
  for (const step of visibleSteps(situation, answers)) {
    for (const id of step.channelIds) {
      const channel = guides?.channels?.get(id);
      if (!channel || !QUICK_CALL_PHONES.includes(channel.phone) || seen.has(channel.phone)) continue;
      seen.add(channel.phone);
      out.push(channel);
    }
  }
  return out;
}

export function visibleQuestions(situation, answers = {}) {
  const clean = cleanAnswers(situation, answers);
  return situation.questions.filter(question => isShown(question.showIf, clean));
}

export function visibleSteps(situation, answers = {}) {
  const clean = cleanAnswers(situation, answers);
  return situation.steps.filter(step => isShown(step.showIf, clean));
}

export function optionLabel(situation, questionId, answers = {}) {
  const question = situation.questions.find(item => item.id === questionId);
  return question?.options.find(option => option.id === answers[questionId])?.label || '';
}

export function answeredSummary(situation, answers = {}) {
  const clean = cleanAnswers(situation, answers);
  return visibleQuestions(situation, clean)
    .filter(question => clean[question.id])
    .map(question => ({question: question.text, answer: optionLabel(situation, question.id, clean)}));
}

// 상담료 · 통화료 · 신청 수수료, each only when Core confirmed it.
export function feeLine(channel) {
  const parts = [];
  if (channel.consultFee === 'FREE') parts.push('상담료 없음');
  else if (channel.consultFee === 'PAID') parts.push('상담료 있음');
  if (channel.callCost === 'FREE') parts.push('통화료 없음');
  else if (channel.callCost === 'CALLER_PAYS') parts.push('통화료 별도');
  if (channel.procedureFee === 'NONE') parts.push('신청 수수료 없음');
  else if (channel.procedureFee === 'FEE' && channel.procedureFeeNote) parts.push(channel.procedureFeeNote);
  return parts.join(' · ');
}

// A channel without a phone has nobody to ask, so no "전화로 확인" line there.
export function hoursLine(channel) {
  if (channel.hours) return `운영시간 ${channel.hours}`;
  return channel.phone ? '운영시간은 전화로 확인해 주세요' : '';
}

export function statusLabel(guides, situation, statusId) {
  return situation?.statusLabels?.[statusId] || guides?.statusTrack.find(item => item.id === statusId)?.label || '';
}

export function statusOptions(guides, situation) {
  return guides.statusTrack.map(item => ({id: item.id, label: statusLabel(guides, situation, item.id)}));
}

export function receiptWritten(situation, fields = {}) {
  if (!situation?.receiptFieldId) return true;
  return Boolean(text(fields?.[situation.receiptFieldId], FIELD_MAX_CHARS));
}

export function canChooseStatus(situation, fields, statusId) {
  return statusId !== SUBMITTED_STATUS || receiptWritten(situation, fields);
}

// 와/과 after the last syllable of a Korean word.
export function withWa(word) {
  const value = String(word || '');
  const code = value.charCodeAt(value.length - 1);
  if (!(code >= 0xac00 && code <= 0xd7a3)) return `${value}와(과)`;
  return `${value}${(code - 0xac00) % 28 ? '과' : '와'}`;
}

// 자동차 사고 → 과실비율정보포털. The portal's own words for its two choices,
// the page to open (개인형 이동장치 has its own), and a sentence for its
// "대화로 찾기" built from the answers. Never a ratio.
export function faultPortalGuide(situation, answers = {}) {
  const portal = situation?.faultPortal;
  if (!portal) return null;
  const clean = cleanAnswers(situation, answers);
  const order = [portal.step1[clean.other], portal.step2[clean.place]].filter(Boolean);
  const selectUrl = clean.other === 'pm' && portal.pmUrl ? portal.pmUrl : portal.selectUrl;
  return Object.freeze({
    order: Object.freeze(order),
    selectUrl,
    describeUrl: portal.describeUrl,
    sentence: faultPortalSentence(situation, clean),
    copyNote: portal.copyNote,
  });
}

export function faultPortalSentence(situation, answers = {}) {
  const portal = situation?.faultPortal;
  if (!portal) return '';
  const clean = cleanAnswers(situation, answers);
  const place = optionLabel(situation, 'place', clean);
  const other = optionLabel(situation, 'other', clean);
  const parts = [];
  if (other) {
    const where = !place ? '' : /다가$/u.test(place) ? `${place} ` : `${place}에서 `;
    parts.push(`${where}${withWa(other)} 부딪혔어요.`);
  }
  if (clean.signal) {
    parts.push(clean.signal === 'unknown' ? '신호등이 있었는지는 잘 모르겠어요.' : `신호등은 ${optionLabel(situation, 'signal', clean)}.`);
  }
  const move = optionLabel(situation, 'my_move', clean);
  if (move) parts.push(`내 차는 ${move}.`);
  const sentence = parts.join(' ').slice(0, portal.maxChars);
  return sentence.length >= portal.minChars ? sentence : '';
}

export function localDay(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// No "12:30" anywhere on these screens: the 자동차 사고 guide must not show
// anything that reads like a ratio, so times are written out in words.
export function savedAtLabel(date = new Date()) {
  const hour = date.getHours();
  const half = hour < 12 ? '오전' : '오후';
  const shown = hour % 12 === 0 ? 12 : hour % 12;
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${half} ${shown}시 ${date.getMinutes()}분`;
}

// One situation's progress as stored on this device, checked against the guide.
export function normalizeRecord(situation, raw, today = localDay()) {
  const item = plain(raw) || {};
  const answers = cleanAnswers(situation, plain(item.answers) || {});
  const stepIds = new Set(situation.steps.map(step => step.id));
  const evidenceIds = new Set(situation.evidence.map(entry => entry.id));
  const fieldIds = new Set(situation.summaryFields.map(field => field.id));
  const flags = (value, allowed) => Object.fromEntries(Object.entries(plain(value) || {}).filter(([key, on]) => allowed.has(key) && on === true));
  const fields = Object.fromEntries(Object.entries(plain(item.fields) || {})
    .filter(([key, value]) => fieldIds.has(key) && typeof value === 'string' && value)
    .map(([key, value]) => [key, value.slice(0, FIELD_MAX_CHARS)]));
  let status = STATUS_IDS.includes(item.status) ? item.status : 'PREPARE';
  if (!canChooseStatus(situation, fields, status)) status = 'PREPARE';
  // The three tabs. There is no question screen any more: a record saved on
  // one ('question', before TROUBLE-HELPER-URGENT-FIRST-01) opens on 할 일.
  return {
    answers,
    done: flags(item.done, stepIds),
    evidence: flags(item.evidence, evidenceIds),
    fields,
    status,
    view: RESULT_VIEWS.includes(item.view) ? item.view : 'steps',
    createdOn: DAY_RE.test(item.createdOn || '') ? item.createdOn : today,
  };
}

function summaryParts(guides, situation, record) {
  const steps = visibleSteps(situation, record.answers);
  return {
    answers: answeredSummary(situation, record.answers),
    done: steps.filter(step => record.done[step.id]).map(step => step.title),
    evidence: situation.evidence.filter(entry => record.evidence[entry.id]).map(entry => entry.label),
    fields: situation.summaryFields.map(field => ({label: field.label, value: (record.fields[field.id] || '').trim()})).filter(entry => entry.value),
    status: statusLabel(guides, situation, record.status),
  };
}

export function summaryModel(guides, situation, record) {
  return {title: situation.title, date: record.createdOn, ...summaryParts(guides, situation, record)};
}

// What 카카오로 보내기 sends: the 인증번호·비밀번호 line, the notice, the
// status and the 접수번호 come first, so the 200-character KakaoTalk text
// (site-kakao-share.js cuts there) keeps them however long the rest is.
export function shareText(guides, situation, record) {
  const parts = summaryParts(guides, situation, record);
  const lines = [
    `[${SHARE_TITLE}] ${situation.title} 상황 정리표 (${record.createdOn})`,
    SHARE_SAFETY_LINE,
    guides.notice,
  ];
  if (situation.notice && situation.notice !== guides.notice) lines.push(situation.notice);
  lines.push(`진행 상태: ${parts.status}`);
  const receipt = situation.receiptFieldId ? (record.fields[situation.receiptFieldId] || '').trim() : '';
  if (receipt) lines.push(`접수번호: ${receipt}`);
  if (parts.answers.length) lines.push('', '[고른 답]', ...parts.answers.map(entry => `- ${entry.question} ${entry.answer}`));
  if (parts.done.length) lines.push('', '[한 일]', ...parts.done.map(entry => `- ${entry}`));
  if (parts.evidence.length) lines.push('', '[모은 증거]', ...parts.evidence.map(entry => `- ${entry}`));
  if (parts.fields.length) lines.push('', '[적어 둔 내용]', ...parts.fields.map(entry => `- ${entry.label}: ${entry.value}`));
  return lines.join('\n');
}

export function guidesUrl(origin = CORE_ORIGIN) {
  return `${origin}${TROUBLE_HELPER_PATH}`;
}

// Public read: no credentials, no headers (a simple CORS GET).
export async function fetchTroubleGuides({fetchImpl = globalThis.fetch, signal} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('TROUBLE_HELPER_FETCH_UNAVAILABLE');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  signal?.addEventListener('abort', () => controller.abort(), {once: true});
  try {
    const response = await fetchImpl(guidesUrl(), {
      method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: controller.signal,
    });
    if (!response?.ok) throw new Error('TROUBLE_HELPER_UNAVAILABLE');
    const guides = normalizeGuides(await response.json());
    if (!guides) throw new Error('TROUBLE_HELPER_INVALID');
    return guides;
  } finally {
    clearTimeout(timer);
  }
}
