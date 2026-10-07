// LIFE-PUBLIC-DATA-01 / NEIS — 자녀 학교(급식·학사일정·시간표).
//
// 저장: 기존 대화 설정 저장 구조(lotbi.site.ux.v1.<kind>.<namespace>)에 학교의
// 공개 식별값만 둔다 — 교육청 코드, 학교 코드, 학교명, 학교급, (원할 때) 학년·반.
// 학생 이름 같은 개인정보는 받지도 저장하지도 않는다.
// 전송: 학교 관련 질문에만 client_context.school 로 싣는다.
// Calendar: 학사일정은 "캘린더에 추가" 버튼으로만 편집기를 연다. 자동 저장 없음.
// 링크(NEIS-SCHOOL-LINKS-01): Core가 정한 학교 홈페이지(직원 보완 → NEIS)와
// 직원이 등록한 급식·식단 원문만 버튼으로 보여 준다. 없으면 버튼도 없다.

const OFFICE_RE = /^[A-Z][0-9]{2}$/u;
const SCHOOL_CODE_RE = /^[0-9]{7,10}$/u;
const SAFE_NAME_RE = /^[0-9A-Za-z가-힣·()\- ]{2,60}$/u;
const CLASS_RE = /^[0-9A-Za-z가-힣]{1,4}$/u;
const SCHOOL_TOPIC_RE = /(?:급식|학교|학사|방학|개학|시간표|휴업|중간\s*고사|기말\s*고사|시험|운동회|소풍|현장\s*체험|졸업식|입학식|학예회|교시|담임|[1-6]\s*학년)/u;
const KINDS = new Set(['MEAL', 'SCHEDULE', 'TIMETABLE', 'SCHOOL_CANDIDATES', 'NEEDS_SCHOOL', 'NEEDS_CLASS',
  'SCHOOL_NOT_FOUND', 'SCHOOL_SAVED', 'UNAVAILABLE', 'TIMETABLE_UNSUPPORTED', 'HOMEPAGE']);
const HOMEPAGE_SOURCES = new Set(['STAFF_OVERRIDE', 'NEIS']);
const PRIVATE_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.test', '.invalid', '.lan', '.home', '.corp'];
const ALLERGEN_MARKS = ['', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲'];
const WEEKDAYS = '일월화수목금토';

function clean(value, max = 80) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f<>]/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, max) : '';
}

export function normalizeSchoolPreference(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const officeCode = clean(value.office_code ?? value.officeCode, 3).toUpperCase();
  const schoolCode = clean(value.school_code ?? value.schoolCode, 10);
  const name = clean(value.name, 60);
  const kind = clean(value.kind, 20);
  if (!OFFICE_RE.test(officeCode) || !SCHOOL_CODE_RE.test(schoolCode) || !SAFE_NAME_RE.test(name)) return null;
  const grade = Number.isInteger(value.grade) && value.grade >= 1 && value.grade <= 6 ? value.grade : null;
  const className = typeof (value.class_name ?? value.className) === 'string' && CLASS_RE.test((value.class_name ?? value.className).trim())
    ? (value.class_name ?? value.className).trim()
    : null;
  return Object.freeze({
    office_code: officeCode,
    school_code: schoolCode,
    name,
    ...(kind && SAFE_NAME_RE.test(kind) ? {kind} : {}),
    ...(grade !== null ? {grade} : {}),
    ...(className !== null ? {class_name: className} : {}),
  });
}

export function readSchoolPreference(key, storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(key);
    return raw ? normalizeSchoolPreference(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writeSchoolPreference(key, value, storage = globalThis.localStorage) {
  const normalized = normalizeSchoolPreference(value);
  if (!normalized) return null;
  try {
    storage?.setItem?.(key, JSON.stringify(normalized));
  } catch {
    return null;
  }
  return normalized;
}

export function clearSchoolPreference(key, storage = globalThis.localStorage) {
  try { storage?.removeItem?.(key); } catch { /* the chat stays usable */ }
}

// Only school-ish questions carry the school; everything else stays as before.
export function schoolContextForMessage(text, preference) {
  const value = typeof text === 'string' ? text : '';
  if (!preference || !SCHOOL_TOPIC_RE.test(value)) return null;
  return normalizeSchoolPreference(preference);
}

// A link is only ever a public http(s) page Core already checked; this is the
// browser-side re-check before it becomes an <a href>.
export function safeSchoolLinkUrl(value) {
  if (typeof value !== 'string' || !/^https?:\/\//iu.test(value.trim())) return '';
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return '';
  }
  const host = url.hostname.toLowerCase().replace(/\.$/u, '');
  if (url.username || url.password) return '';
  if (url.port && url.port !== '80' && url.port !== '443') return '';
  if (!host.includes('.') || host === 'localhost' || host.startsWith('[') || /^\d{1,3}(\.\d{1,3}){3}$/u.test(host)) return '';
  if (PRIVATE_HOST_SUFFIXES.some(suffix => host.endsWith(suffix))) return '';
  return url.href;
}

function normalizeLinks(value) {
  const links = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const homepageUrl = safeSchoolLinkUrl(links.homepage_url);
  const source = clean(links.homepage_source, 20);
  return Object.freeze({
    homepageUrl,
    homepageSource: homepageUrl && HOMEPAGE_SOURCES.has(source) ? source : '',
    mealSourceUrl: safeSchoolLinkUrl(links.meal_source_url),
  });
}

function dateLabel(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(isoDate || '');
  if (!match) return '';
  const day = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return `${Number(match[2])}월 ${Number(match[3])}일(${WEEKDAYS[day.getUTCDay()]})`;
}

export function normalizeSchoolResult(value) {
  if (!value || typeof value !== 'object' || value.contract_id !== 'CORE-SCHOOL-RESULT-01' || value.schema_version !== 1) return null;
  const kind = clean(value.kind, 32);
  if (!KINDS.has(kind)) return null;
  const isoDate = item => (/^\d{4}-\d{2}-\d{2}$/u.test(item) ? item : '');
  const meals = (Array.isArray(value.meals) ? value.meals : []).slice(0, 15).map(meal => ({
    date: isoDate(meal?.date),
    mealName: clean(meal?.meal_name, 12) || '급식',
    dishes: (Array.isArray(meal?.dishes) ? meal.dishes : []).slice(0, 20).map(dish => ({
      name: clean(dish?.name, 60),
      allergens: (Array.isArray(dish?.allergens) ? dish.allergens : []).filter(code => Number.isInteger(code) && code >= 1 && code <= 19),
    })).filter(dish => dish.name),
    calories: clean(meal?.calories, 20),
  })).filter(meal => meal.date && meal.dishes.length);
  const events = (Array.isArray(value.events) ? value.events : []).slice(0, 30).map(event => ({
    date: isoDate(event?.date),
    name: clean(event?.name, 60),
    content: clean(event?.content, 80),
    dayType: clean(event?.day_type, 12),
    calendarDraft: event?.calendar_draft && isoDate(event.calendar_draft.local_date)
      ? {title: clean(event.calendar_draft.title, 120), localDate: event.calendar_draft.local_date}
      : null,
  })).filter(event => event.date && event.name);
  const timetable = (Array.isArray(value.timetable) ? value.timetable : []).slice(0, 60).map(slot => ({
    date: isoDate(slot?.date),
    period: Number.isInteger(slot?.period) ? slot.period : null,
    subject: clean(slot?.subject, 40),
  })).filter(slot => slot.date && slot.period !== null && slot.subject);
  const candidates = (Array.isArray(value.candidates) ? value.candidates : []).slice(0, 8)
    .map(candidate => {
      const school = normalizeSchoolPreference(candidate);
      return school ? {...school, office_name: clean(candidate.office_name, 40), address: clean(candidate.address, 80)} : null;
    })
    .filter(Boolean);
  const legend = value.allergen_legend && typeof value.allergen_legend === 'object' ? value.allergen_legend : {};
  return Object.freeze({
    kind,
    school: normalizeSchoolPreference(value.school),
    rangeLabel: clean(value.range?.label, 20),
    meals,
    events,
    timetable,
    candidates,
    resumeText: clean(value.resume_text, 200),
    savePreference: value.save_preference && Number.isInteger(value.save_preference.grade)
      ? {grade: value.save_preference.grade, class_name: clean(String(value.save_preference.class_name ?? ''), 4)}
      : null,
    coverage: clean(value.coverage, 20) || 'COMPLETE',
    links: normalizeLinks(value.links),
    allergenLegend: Object.fromEntries(Object.entries(legend)
      .filter(([code, label]) => /^\d{1,2}$/u.test(code) && typeof label === 'string')
      .map(([code, label]) => [code, clean(label, 12)])),
  });
}

// Persisted chat meta keeps the server shape so a reload re-normalizes it.
export function compactSchoolResultMeta(value) {
  const normalized = normalizeSchoolResult(value);
  return normalized ? value : null;
}

function element(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function schoolLink(doc, href, text) {
  const link = element(doc, 'a', 'lotbi-school-link', text);
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.referrerPolicy = 'no-referrer';
  link.setAttribute('aria-label', `${text} (새 창에서 열립니다)`);
  return link;
}

// [급식·식단 원문] only on meal answers (staff-registered page, never labelled
// NEIS); [학교 홈페이지] at most once per card. No link, no button.
function schoolLinkActions(doc, result) {
  if (!result.school || result.kind === 'SCHOOL_CANDIDATES') return null;
  const links = [];
  if (result.links.mealSourceUrl && (result.kind === 'MEAL' || result.kind === 'HOMEPAGE')) {
    links.push(schoolLink(doc, result.links.mealSourceUrl, '급식·식단 원문'));
  }
  if (result.links.homepageUrl) links.push(schoolLink(doc, result.links.homepageUrl, '학교 홈페이지'));
  if (!links.length) return null;
  const row = element(doc, 'div', 'lotbi-school-links');
  row.setAttribute('aria-label', `${result.school.name} 링크`);
  for (const link of links) row.append(link);
  return row;
}

export function createSchoolResultCard(value, {
  document: doc = globalThis.document,
  onSelectSchool = () => {},
  onAddToCalendar = () => {},
  onChangeSchool = () => {},
} = {}) {
  const result = normalizeSchoolResult(value);
  if (!result) return null;
  const hasBody = result.meals.length || result.events.length || result.timetable.length || result.candidates.length;
  if (!hasBody && !result.school) return null;
  const card = element(doc, 'section', 'lotbi-school-card');
  card.dataset.schoolKind = result.kind;
  card.setAttribute('aria-label', result.school ? `${result.school.name} 학교 정보` : '학교 선택');

  if (result.school && result.kind !== 'SCHOOL_CANDIDATES') {
    const header = element(doc, 'div', 'lotbi-school-card-header');
    header.append(element(doc, 'strong', 'lotbi-school-card-title', result.school.name));
    if (result.rangeLabel) header.append(element(doc, 'span', 'lotbi-school-card-range', result.rangeLabel));
    card.append(header);
  }

  for (const meal of result.meals) {
    const block = element(doc, 'div', 'lotbi-school-meal');
    block.append(element(doc, 'span', 'lotbi-school-date', `${dateLabel(meal.date)} ${meal.mealName}`));
    const list = element(doc, 'ul', 'lotbi-school-dishes');
    for (const dish of meal.dishes) {
      const item = element(doc, 'li', 'lotbi-school-dish', dish.name);
      if (dish.allergens.length) {
        const marks = element(doc, 'span', 'lotbi-school-allergens', dish.allergens.map(code => ALLERGEN_MARKS[code] || String(code)).join(''));
        marks.setAttribute('aria-label', `알레르기 ${dish.allergens.join(', ')}번`);
        item.append(' ', marks);
      }
      list.append(item);
    }
    block.append(list);
    if (meal.calories) block.append(element(doc, 'span', 'lotbi-school-calories', meal.calories));
    card.append(block);
  }
  const legend = Object.entries(result.allergenLegend);
  if (result.meals.length && legend.length) {
    card.append(element(doc, 'p', 'lotbi-school-legend', `알레르기 표시: ${legend.map(([code, label]) => `${ALLERGEN_MARKS[Number(code)] || code}${label}`).join(' ')}`));
  }

  if (result.events.length) {
    const list = element(doc, 'ul', 'lotbi-school-events');
    for (const event of result.events) {
      const item = element(doc, 'li', 'lotbi-school-event');
      const label = element(doc, 'span', 'lotbi-school-event-label', `${dateLabel(event.date)} ${event.name}${event.content ? ` · ${event.content}` : ''}`);
      item.append(label);
      if (event.calendarDraft) {
        const add = element(doc, 'button', 'lotbi-school-calendar-add', '캘린더에 추가');
        add.type = 'button';
        add.dataset.schoolCalendarDate = event.calendarDraft.localDate;
        add.setAttribute('aria-label', `${event.name} 캘린더에 추가`);
        add.addEventListener('click', () => onAddToCalendar({title: event.calendarDraft.title, localDate: event.calendarDraft.localDate}));
        item.append(add);
      }
      list.append(item);
    }
    card.append(list);
  }

  if (result.timetable.length) {
    const list = element(doc, 'ol', 'lotbi-school-timetable');
    let currentDate = '';
    for (const slot of result.timetable) {
      if (slot.date !== currentDate && new Set(result.timetable.map(item => item.date)).size > 1) {
        list.append(element(doc, 'li', 'lotbi-school-date', dateLabel(slot.date)));
      }
      currentDate = slot.date;
      list.append(element(doc, 'li', 'lotbi-school-period', `${slot.period}교시 ${slot.subject}`));
    }
    card.append(list);
  }

  if (result.candidates.length) {
    const list = element(doc, 'div', 'lotbi-school-candidates');
    for (const candidate of result.candidates) {
      const choose = element(doc, 'button', 'lotbi-school-candidate');
      choose.type = 'button';
      choose.dataset.schoolCode = candidate.school_code;
      choose.append(element(doc, 'strong', '', candidate.name));
      const detail = [candidate.office_name, candidate.address].filter(Boolean).join(' · ');
      if (detail) choose.append(element(doc, 'span', '', detail));
      choose.addEventListener('click', () => onSelectSchool(candidate, result.resumeText));
      list.append(choose);
    }
    card.append(list);
  }

  const actions = schoolLinkActions(doc, result);
  if (actions) card.append(actions);

  const footer = element(doc, 'div', 'lotbi-school-card-footer');
  const notes = [];
  if (result.coverage !== 'COMPLETE') notes.push('일부만 확인됨');
  if (result.kind === 'HOMEPAGE') {
    // Only the address is shown here: say where it came from, not "NEIS" for a staff entry.
    if (result.links.homepageSource === 'NEIS') notes.push('홈페이지 주소 출처: NEIS 교육정보 개방 포털');
    else if (result.links.homepageSource === 'STAFF_OVERRIDE') notes.push('홈페이지 주소: LOTBI 운영 등록');
  } else {
    notes.push('출처: NEIS 교육정보 개방 포털');
  }
  footer.append(element(doc, 'span', 'lotbi-school-source', notes.join(' · ')));
  if (result.school && result.kind !== 'SCHOOL_CANDIDATES') {
    const change = element(doc, 'button', 'lotbi-school-change', '학교 변경');
    change.type = 'button';
    change.addEventListener('click', () => onChangeSchool());
    footer.append(change);
  }
  card.append(footer);
  return card;
}
