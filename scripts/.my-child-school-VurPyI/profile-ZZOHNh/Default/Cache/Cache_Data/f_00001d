// LIFE-PUBLIC-DATA-01 / NEIS — 자녀 학교(급식·학사일정·시간표).
//
// 저장: 기존 대화 설정 저장 구조(lotbi.site.ux.v1.<kind>.<namespace>)에 학교의
// 공개 식별값만 둔다 — 교육청 코드, 학교 코드, 학교명, 학교급, (원할 때) 학년·반.
// 학생 이름 같은 개인정보는 받지도 저장하지도 않는다.
// 전송: 학교 관련 질문에만 client_context.school 로 싣는다.
// Calendar: 학사일정은 "캘린더에 추가" 버튼으로만 편집기를 연다. 자동 저장 없음.
// 링크(NEIS-SCHOOL-LINKS-01): Core가 정한 학교 홈페이지(직원 보완 → NEIS)와
// 직원이 등록한 급식·식단 원문만 버튼으로 보여 준다. 없으면 버튼도 없다.
// 급식(SCHOOL-MEAL-01): NEIS 급식이 기본, NEIS에 없는 날짜·식사만 직원 보완
// 급식이 온다. 직원 보완 급식은 "학교 공식자료 기준"(근거 주소 있음) 또는
// "직원 확인 정보"로만 표시하고 NEIS라고 하지 않는다. 오늘 급식은 짧게,
// [이번 주 급식]은 그 주에 더 볼 급식이 있을 때만, [급식표 보기]는 직원이
// 등록한 학교 급식표 주소가 있을 때만 보인다. 알레르기는 받은 그대로 보여 주고
// 해석하지 않는다.

const OFFICE_RE = /^[A-Z][0-9]{2}$/u;
const SCHOOL_CODE_RE = /^[0-9]{7,10}$/u;
const SAFE_NAME_RE = /^[0-9A-Za-z가-힣·()\- ]{2,60}$/u;
const CLASS_RE = /^[0-9A-Za-z가-힣]{1,4}$/u;
const SCHOOL_TOPIC_RE = /(?:급식|학교|학사|방학|개학|시간표|휴업|중간\s*고사|기말\s*고사|시험|운동회|소풍|현장\s*체험|졸업식|입학식|학예회|교시|담임|[1-6]\s*학년)/u;
const KINDS = new Set(['MEAL', 'SCHEDULE', 'TIMETABLE', 'SCHOOL_CANDIDATES', 'NEEDS_SCHOOL', 'NEEDS_CLASS',
  'SCHOOL_NOT_FOUND', 'SCHOOL_SAVED', 'UNAVAILABLE', 'TIMETABLE_UNSUPPORTED', 'HOMEPAGE']);
const HOMEPAGE_SOURCES = new Set(['STAFF_OVERRIDE', 'NEIS']);
const PRIVATE_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.test', '.invalid', '.lan', '.home', '.corp'];
const MEAL_TYPES = new Set(['BREAKFAST', 'LUNCH', 'DINNER']);
const STAFF_SOURCE = 'STAFF_FALLBACK';
const STAFF_LABEL_WITH_SOURCE = '학교 공식자료 기준';
const STAFF_LABEL_WITHOUT_SOURCE = '직원 확인 정보';
const DISH_PREVIEW = 6;
const ALLERGY_NOTE = '알레르기 정보는 학교·NEIS 제공 내용을 확인하세요.';
const STALE_NOTE = 'NEIS 연결이 원활하지 않아 최근에 확인한 급식이에요.';
// "내일은?", "이번 주 전체", "금요일은요?" — a meal follow-up keeps the school.
// Core decides from the recent turns whether it really is one.
const MEAL_FOLLOW_UP_RE = /^(?:그럼|그러면|그리고|혹시)?\s*(?:오늘|내일|모레|글피|어제|이번\s*주|금주|다음\s*주|담주|주간|일주일|(?:(?:이번|다음)\s*주\s*|담주\s*)?[월화수목금토일]요일|\d{1,2}\s*월\s*\d{1,2}\s*일)\s*(?:꺼|것|거)?\s*(?:은|는|도)?\s*(?:전체|전부|다|모두)?\s*(?:은|는|도)?\s*(?:요)?\s*(?:뭐야|뭐예요|뭐에요|뭐|어때|어때요|알려\s*줘|보여\s*줘|알려\s*주세요|보여\s*주세요)?\s*[?？!.~]*$/u;
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

// Only school-ish questions (and short meal follow-ups such as "내일은?")
// carry the school; everything else stays as before.
export function schoolContextForMessage(text, preference) {
  const value = typeof text === 'string' ? text : '';
  if (!preference || !(SCHOOL_TOPIC_RE.test(value) || MEAL_FOLLOW_UP_RE.test(value.trim()))) return null;
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

function isoDate(item) {
  return typeof item === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(item) ? item : '';
}

function mondayOf(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(iso || '');
  if (!match) return '';
  const day = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}

function addDays(iso, days) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(iso || '');
  if (!match) return '';
  const day = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

function normalizeMeal(meal) {
  const staff = meal?.source_type === STAFF_SOURCE;
  // A staff entry's provenance follows its evidence page after the browser
  // re-check: no safe page, no "학교 공식자료" wording.
  const sourceUrl = staff ? safeSchoolLinkUrl(meal?.source_url) : '';
  return {
    date: isoDate(meal?.date),
    mealName: clean(meal?.meal_name, 12) || '급식',
    mealType: MEAL_TYPES.has(meal?.meal_type) ? meal.meal_type : '',
    dishes: (Array.isArray(meal?.dishes) ? meal.dishes : []).slice(0, 30).map(dish => ({
      name: clean(dish?.name, 60),
      allergens: staff ? [] : (Array.isArray(dish?.allergens) ? dish.allergens : []).filter(code => Number.isInteger(code) && code >= 1 && code <= 19),
    })).filter(dish => dish.name),
    calories: clean(meal?.calories, 20),
    sourceType: staff ? STAFF_SOURCE : 'NEIS',
    sourceLabel: staff ? (sourceUrl ? STAFF_LABEL_WITH_SOURCE : STAFF_LABEL_WITHOUT_SOURCE) : '',
    allergyText: staff ? clean(meal?.allergy_text, 120) : '',
  };
}

// The week a one-day answer belongs to, as words a follow-up can use.
function weekPrompt(summary, today) {
  if (!summary?.hasMoreWeekly || !summary.weekFrom || !today) return '';
  const thisWeek = mondayOf(today);
  if (summary.weekFrom === thisWeek) return '이번 주 급식 보여줘';
  if (summary.weekFrom === addDays(thisWeek, 7)) return '다음 주 급식 보여줘';
  return '';
}

export function normalizeSchoolResult(value) {
  if (!value || typeof value !== 'object' || value.contract_id !== 'CORE-SCHOOL-RESULT-01' || value.schema_version !== 1) return null;
  const kind = clean(value.kind, 32);
  if (!KINDS.has(kind)) return null;
  const meals = (Array.isArray(value.meals) ? value.meals : []).slice(0, 100).map(normalizeMeal)
    .filter(meal => meal.date && meal.dishes.length);
  const weekly = (Array.isArray(value.weekly) ? value.weekly : []).slice(0, 31).map(day => ({
    date: isoDate(day?.date),
    meals: (Array.isArray(day?.meals) ? day.meals : []).slice(0, 6).map(normalizeMeal).filter(meal => meal.date && meal.dishes.length),
  })).filter(day => day.date && day.meals.length);
  const summary = value.meal_summary && typeof value.meal_summary === 'object' ? value.meal_summary : null;
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
    weekly,
    mealSummary: summary && isoDate(summary.target_date)
      ? Object.freeze({
        targetDate: summary.target_date,
        hasMoreWeekly: summary.has_more_weekly === true,
        weekFrom: isoDate(summary.week?.from),
      })
      : null,
    today: isoDate(value.today),
    stale: value.freshness === 'STALE_CACHE',
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

// [이번 주 급식] only when that week has more to show; [급식표 보기] only on
// meal answers with a staff-registered school meal page (never labelled NEIS,
// never the homepage standing in for it); [학교 홈페이지] at most once per card.
// No link, no button.
function schoolLinkActions(doc, result, onAsk) {
  if (!result.school || result.kind === 'SCHOOL_CANDIDATES') return null;
  const links = [];
  const prompt = result.kind === 'MEAL' ? weekPrompt(result.mealSummary, result.today) : '';
  if (prompt) {
    const week = element(doc, 'button', 'lotbi-school-link lotbi-school-weekly', prompt.startsWith('다음') ? '다음 주 급식' : '이번 주 급식');
    week.type = 'button';
    week.dataset.schoolPrompt = prompt;
    week.addEventListener('click', () => onAsk(prompt));
    links.push(week);
  }
  if (result.links.mealSourceUrl && (result.kind === 'MEAL' || result.kind === 'HOMEPAGE')) {
    links.push(schoolLink(doc, result.links.mealSourceUrl, '급식표 보기'));
  }
  if (result.links.homepageUrl) links.push(schoolLink(doc, result.links.homepageUrl, '학교 홈페이지'));
  if (!links.length) return null;
  const row = element(doc, 'div', 'lotbi-school-links');
  row.setAttribute('aria-label', `${result.school.name} 링크`);
  for (const link of links) row.append(link);
  return row;
}

function dishItem(doc, dish) {
  const item = element(doc, 'li', 'lotbi-school-dish', dish.name);
  if (dish.allergens.length) {
    const marks = element(doc, 'span', 'lotbi-school-allergens', dish.allergens.map(code => ALLERGEN_MARKS[code] || String(code)).join(''));
    marks.setAttribute('aria-label', `알레르기 ${dish.allergens.join(', ')}번`);
    item.append(' ', marks);
  }
  return item;
}

function sourceBadge(doc, meal) {
  if (meal.sourceType !== STAFF_SOURCE) return null;
  const badge = element(doc, 'span', 'lotbi-school-meal-badge', meal.sourceLabel);
  badge.dataset.mealSource = meal.sourceType;
  return badge;
}

// One meal on a one-day answer: the first dishes, the rest behind "더 보기".
function mealBlock(doc, meal) {
  const block = element(doc, 'div', 'lotbi-school-meal');
  block.dataset.mealSource = meal.sourceType;
  const head = element(doc, 'div', 'lotbi-school-meal-head');
  head.append(element(doc, 'span', 'lotbi-school-date', `${dateLabel(meal.date)} ${meal.mealName}`));
  const badge = sourceBadge(doc, meal);
  if (badge) head.append(badge);
  block.append(head);
  const list = element(doc, 'ul', 'lotbi-school-dishes');
  for (const dish of meal.dishes.slice(0, DISH_PREVIEW)) list.append(dishItem(doc, dish));
  block.append(list);
  if (meal.dishes.length > DISH_PREVIEW) {
    const more = element(doc, 'details', 'lotbi-school-more');
    more.append(element(doc, 'summary', '', `메뉴 ${meal.dishes.length - DISH_PREVIEW}개 더 보기`));
    const rest = element(doc, 'ul', 'lotbi-school-dishes');
    for (const dish of meal.dishes.slice(DISH_PREVIEW)) rest.append(dishItem(doc, dish));
    more.append(rest);
    block.append(more);
  }
  if (meal.calories) block.append(element(doc, 'span', 'lotbi-school-calories', meal.calories));
  if (meal.allergyText) block.append(element(doc, 'span', 'lotbi-school-calories', `알레르기 정보: ${meal.allergyText}`));
  return block;
}

// A week: only the days that have meals, today marked; each meal on one line.
function weekBlock(doc, result) {
  const week = element(doc, 'div', 'lotbi-school-week');
  for (const day of result.weekly) {
    const isToday = day.date === result.today;
    const block = element(doc, 'section', isToday ? 'lotbi-school-day is-today' : 'lotbi-school-day');
    block.dataset.schoolDate = day.date;
    if (isToday) block.setAttribute('aria-current', 'date');
    block.setAttribute('aria-label', `${dateLabel(day.date)}${isToday ? ' 오늘' : ''} 급식`);
    const head = element(doc, 'div', 'lotbi-school-day-head');
    head.append(element(doc, 'span', 'lotbi-school-date', dateLabel(day.date)));
    if (isToday) head.append(element(doc, 'span', 'lotbi-school-today', '오늘'));
    block.append(head);
    for (const meal of day.meals) {
      const line = element(doc, 'p', 'lotbi-school-day-meal');
      line.dataset.mealSource = meal.sourceType;
      line.append(element(doc, 'strong', 'lotbi-school-day-meal-name', meal.mealName));
      const badge = sourceBadge(doc, meal);
      if (badge) line.append(badge);
      const dishes = element(doc, 'span', 'lotbi-school-day-dishes');
      meal.dishes.forEach((dish, index) => {
        if (index) dishes.append(', ');
        dishes.append(dish.name);
        if (dish.allergens.length) {
          const marks = element(doc, 'span', 'lotbi-school-allergens', dish.allergens.map(code => ALLERGEN_MARKS[code] || String(code)).join(''));
          marks.setAttribute('aria-label', `알레르기 ${dish.allergens.join(', ')}번`);
          dishes.append(marks);
        }
      });
      line.append(dishes);
      if (meal.calories) line.append(element(doc, 'span', 'lotbi-school-calories', meal.calories));
      if (meal.allergyText) line.append(element(doc, 'span', 'lotbi-school-calories', `알레르기 정보: ${meal.allergyText}`));
      block.append(line);
    }
    week.append(block);
  }
  return week;
}

// Where the meals on this card came from. A staff entry is never called NEIS.
function mealSourceNote(meals) {
  const staff = meals.some(meal => meal.sourceType === STAFF_SOURCE);
  const neis = meals.some(meal => meal.sourceType !== STAFF_SOURCE);
  if (staff && neis) return '출처: NEIS 교육정보 개방 포털 · 표시된 일부는 직원 확인 정보';
  if (staff) return '출처: 학교 자료를 LOTBI 직원이 확인한 정보 (NEIS 급식 없음)';
  return '출처: NEIS 교육정보 개방 포털';
}

export function createSchoolResultCard(value, {
  document: doc = globalThis.document,
  onSelectSchool = () => {},
  onAddToCalendar = () => {},
  onChangeSchool = () => {},
  onAsk = () => {},
} = {}) {
  const result = normalizeSchoolResult(value);
  if (!result) return null;
  const hasBody = result.meals.length || result.weekly.length || result.events.length || result.timetable.length || result.candidates.length;
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

  if (result.weekly.length) {
    card.append(weekBlock(doc, result));
  } else {
    for (const meal of result.meals) card.append(mealBlock(doc, meal));
    if (result.kind === 'MEAL' && result.mealSummary && !result.meals.length) {
      card.append(element(doc, 'p', 'lotbi-school-empty', '이 날은 급식 정보가 없어요.'));
    }
  }
  const legend = Object.entries(result.allergenLegend);
  if (result.meals.length && legend.length) {
    card.append(element(doc, 'p', 'lotbi-school-legend', `알레르기 표시: ${legend.map(([code, label]) => `${ALLERGEN_MARKS[Number(code)] || code}${label}`).join(' ')}`));
  }
  if (result.meals.some(meal => meal.dishes.some(dish => dish.allergens.length) || meal.allergyText)) {
    card.append(element(doc, 'p', 'lotbi-school-legend lotbi-school-allergy-note', ALLERGY_NOTE));
  }
  if (result.kind === 'MEAL' && result.stale) card.append(element(doc, 'p', 'lotbi-school-legend lotbi-school-stale', STALE_NOTE));

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

  const actions = schoolLinkActions(doc, result, onAsk);
  if (actions) card.append(actions);

  const footer = element(doc, 'div', 'lotbi-school-card-footer');
  const notes = [];
  if (result.coverage !== 'COMPLETE') notes.push('일부만 확인됨');
  if (result.kind === 'HOMEPAGE') {
    // Only the address is shown here: say where it came from, not "NEIS" for a staff entry.
    if (result.links.homepageSource === 'NEIS') notes.push('홈페이지 주소 출처: NEIS 교육정보 개방 포털');
    else if (result.links.homepageSource === 'STAFF_OVERRIDE') notes.push('홈페이지 주소: LOTBI 운영 등록');
  } else if (result.kind === 'MEAL') {
    notes.push(mealSourceNote(result.meals));
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
