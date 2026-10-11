// JEONBUK-PILOT-01 — 전북 맛집·음식 / 전북 행정기관 연락처 cards and the
// 전북 맛집·음식 entry form.
//
// Core sends only official public records (전주시 「전주음식」, 전북특별자치도
// 「테마별음식점 정보」, 「관공서 및 공공기관 정보」, 「부서별 팩스번호」). This
// module keeps what the contract allows and shows nothing else:
//  - no image area at all: an official record without a photo is a text card;
//  - hours only as Core labelled them ("등록 영업시간 …"); never "영업 중",
//    seats or reservations;
//  - the map action uses the user's default map app (site-navigation.js), the
//    phone action is a plain tel: link, a fax is text, never a link;
//  - every card names its official source and says "공식 등록정보 기준".
import {buildDefaultMapHref, defaultMapProviderPresentation} from './site-navigation.js?v=aset-c6baa4c56658';
import {readDefaultMapProvider} from './site-location-preference.js?v=aset-c6baa4c56658';

export const REGIONAL_FOOD_CONTRACT = 'CORE-REGIONAL-FOOD-RESULT-01';
export const REGIONAL_CONTACT_CONTRACT = 'CORE-REGIONAL-CONTACT-RESULT-01';
const UNSAFE_TEXT_RE = /[\u0000-\u001f<>]/gu;
const PHONE_RE = /^(?:0\d{1,2}-\d{3,4}-\d{4}|1\d{3}-\d{4})$/u;
const MOBILE_RE = /^01[016789]-/u;
const DATASET_URL_RE = /^https:\/\/www\.data\.go\.kr\/data\/\d{6,9}\/(?:openapi|fileData)\.do$/u;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/u;

function text(value, max = 120) {
  return typeof value === 'string' ? value.replace(UNSAFE_TEXT_RE, ' ').replace(/\s+/gu, ' ').trim().slice(0, max) : '';
}

function phone(value, {allowMobile = true} = {}) {
  const number = text(value, 20);
  if (!PHONE_RE.test(number)) return '';
  return !allowMobile && MOBILE_RE.test(number) ? '' : number;
}

function telHref(number) {
  return number ? `tel:${number.replace(/\D/gu, '')}` : '';
}

function coordinate(value, low, high) {
  return typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high ? value : null;
}

function normalizeSources(value) {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(value.slice(0, 6).map(item => {
    if (!item || typeof item !== 'object') return null;
    const name = text(item.name, 60);
    if (!name) return null;
    return Object.freeze({
      code: text(item.code, 40),
      name,
      provider: text(item.provider, 40),
      datasetUrl: DATASET_URL_RE.test(text(item.dataset_url, 120)) ? text(item.dataset_url, 120) : '',
      updatedAt: DATE_RE.test(text(item.updated_at, 10)) ? text(item.updated_at, 10) : '',
      basisDate: DATE_RE.test(text(item.basis_date, 10)) ? text(item.basis_date, 10) : '',
      status: text(item.status, 20) === 'OK' ? 'OK' : 'UNAVAILABLE',
    });
  }).filter(Boolean));
}

function normalizeFoodPlace(value, index) {
  if (!value || typeof value !== 'object') return null;
  const name = text(value.name, 60);
  const address = text(value.address, 160);
  if (!name || !address) return null;
  const latitude = coordinate(value.latitude, 31.43, 44.35);
  const longitude = coordinate(value.longitude, 122.37, 132);
  const navigationCapable = value.navigation_capability === true
    && text(value.coordinate_authority) === 'NAVER_MAPS_GEOCODING'
    && text(value.coordinate_system) === 'WGS84'
    && latitude !== null && longitude !== null;
  const distance = Number.isInteger(value.distance_meters) && value.distance_meters >= 0 && value.distance_meters < 500000
    ? value.distance_meters : null;
  const hours = text(value.business_hours_label, 60);
  return Object.freeze({
    resultId: text(value.result_id, 20) || `food-${index + 1}`,
    name,
    address,
    foodCategories: Object.freeze((Array.isArray(value.food_categories) ? value.food_categories : []).map(item => text(item, 20)).filter(Boolean).slice(0, 4)),
    themes: Object.freeze((Array.isArray(value.themes) ? value.themes : []).map(item => (
      item && typeof item === 'object' && text(item.label, 12) && text(item.value, 30)
        ? Object.freeze({label: text(item.label, 12), value: text(item.value, 30)}) : null
    )).filter(Boolean).slice(0, 5)),
    phone: phone(value.phone),
    // Only Core's own "등록 영업시간 …" label is shown, never a bare time.
    hoursLabel: hours.startsWith('등록 영업시간 ') ? hours : '',
    holiday: text(value.holiday, 40),
    representativeMenu: text(value.representative_menu, 100),
    latitude: navigationCapable ? latitude : null,
    longitude: navigationCapable ? longitude : null,
    navigationCapable,
    distanceMeters: distance,
  });
}

export function normalizeRegionalFoodResult(value) {
  if (!value || typeof value !== 'object') return null;
  if (value.contract_id !== REGIONAL_FOOD_CONTRACT || value.schema_version !== 1) return null;
  const resultSetId = text(value.result_set_id, 30);
  if (!/^rfrs_[0-9a-f]{20}$/u.test(resultSetId) || !Array.isArray(value.results)) return null;
  const results = value.results.slice(0, 5).map(normalizeFoodPlace).filter(Boolean);
  if (!results.length) return null;
  const total = Number.isInteger(value.total_matches) && value.total_matches >= results.length ? value.total_matches : results.length;
  return Object.freeze({
    contractId: REGIONAL_FOOD_CONTRACT,
    resultSetId,
    regionScope: text(value.region_scope, 20),
    basisLabel: text(value.basis_label, 40),
    totalMatches: total,
    results: Object.freeze(results),
    sources: normalizeSources(value.sources),
    coverage: text(value.coverage, 20) === 'PARTIAL' ? 'PARTIAL' : 'COMPLETE',
    notice: text(value.notice, 80) || '공식 등록정보 기준이며 실제 운영은 방문 전 확인해 주세요.',
  });
}

function normalizeContactEntry(value, index) {
  if (!value || typeof value !== 'object') return null;
  const institution = text(value.institution, 40);
  if (!institution) return null;
  const kind = text(value.kind, 20) === 'DEPARTMENT' ? 'DEPARTMENT' : 'INSTITUTION';
  const entry = {
    entryId: text(value.entry_id, 20) || `contact-${index + 1}`,
    kind,
    institution,
    unit: text(value.unit, 40),
    division: text(value.division, 40),
    // Public office numbers only: a mobile number is never shown.
    mainPhone: phone(value.main_phone, {allowMobile: false}),
    directPhone: phone(value.direct_phone, {allowMobile: false}),
    fax: phone(value.fax, {allowMobile: false}),
    address: text(value.address, 120),
    basisDate: DATE_RE.test(text(value.basis_date, 10)) ? text(value.basis_date, 10) : '',
  };
  if (!entry.mainPhone && !entry.directPhone && !entry.fax && !entry.address) return null;
  return Object.freeze(entry);
}

export function normalizeRegionalContactResult(value) {
  if (!value || typeof value !== 'object') return null;
  if (value.contract_id !== REGIONAL_CONTACT_CONTRACT || value.schema_version !== 1) return null;
  const resultSetId = text(value.result_set_id, 30);
  if (!/^rcrs_[0-9a-f]{20}$/u.test(resultSetId) || !Array.isArray(value.entries) || value.public_contact_only !== true) return null;
  const entries = value.entries.slice(0, 8).map(normalizeContactEntry).filter(Boolean);
  if (!entries.length) return null;
  return Object.freeze({
    contractId: REGIONAL_CONTACT_CONTRACT,
    resultSetId,
    entries: Object.freeze(entries),
    sources: normalizeSources(value.sources),
    notice: text(value.notice, 100),
  });
}

// Persisted message meta: the validated Core subset (snake_case), so a reload
// re-normalizes exactly what was shown.
export function compactRegionalFoodMeta(value) {
  const result = normalizeRegionalFoodResult(value);
  if (!result) return null;
  return {
    contract_id: result.contractId,
    schema_version: 1,
    result_set_id: result.resultSetId,
    region_scope: result.regionScope,
    basis_label: result.basisLabel,
    total_matches: result.totalMatches,
    coverage: result.coverage,
    notice: result.notice,
    results: result.results.map(place => ({
      result_id: place.resultId,
      name: place.name,
      address: place.address,
      food_categories: [...place.foodCategories],
      themes: place.themes.map(item => ({label: item.label, value: item.value})),
      phone: place.phone || null,
      business_hours_label: place.hoursLabel || null,
      holiday: place.holiday || null,
      representative_menu: place.representativeMenu || null,
      latitude: place.latitude,
      longitude: place.longitude,
      coordinate_system: place.navigationCapable ? 'WGS84' : null,
      coordinate_authority: place.navigationCapable ? 'NAVER_MAPS_GEOCODING' : null,
      navigation_capability: place.navigationCapable,
      ...(place.distanceMeters === null ? {} : {distance_meters: place.distanceMeters}),
    })),
    sources: result.sources.map(source => ({
      code: source.code, name: source.name, provider: source.provider, dataset_url: source.datasetUrl,
      updated_at: source.updatedAt, basis_date: source.basisDate || null, status: source.status,
    })),
  };
}

export function compactRegionalContactMeta(value) {
  const result = normalizeRegionalContactResult(value);
  if (!result) return null;
  return {
    contract_id: result.contractId,
    schema_version: 1,
    result_set_id: result.resultSetId,
    public_contact_only: true,
    notice: result.notice,
    entries: result.entries.map(entry => ({
      entry_id: entry.entryId, kind: entry.kind, institution: entry.institution, unit: entry.unit || null,
      division: entry.division || null, main_phone: entry.mainPhone || null, direct_phone: entry.directPhone || null,
      fax: entry.fax || null, address: entry.address || null, basis_date: entry.basisDate || null,
    })),
    sources: result.sources.map(source => ({
      code: source.code, name: source.name, provider: source.provider, dataset_url: source.datasetUrl,
      updated_at: source.updatedAt, basis_date: source.basisDate || null, status: source.status,
    })),
  };
}

function el(doc, tag, className = '', content = '') {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (content) node.textContent = content;
  return node;
}

function distanceText(meters) {
  if (meters === null) return '';
  return meters < 1000 ? `${meters}m` : `${(meters / 1000).toFixed(1)}km`;
}

function sourceFooter(doc, sources, notice, {withBasis = false} = {}) {
  const footer = el(doc, 'div', 'lotbi-regional-card-footer');
  const used = sources.filter(source => source.status === 'OK');
  if (used.length) {
    const line = el(doc, 'p', 'lotbi-regional-source');
    line.append(doc.createTextNode('출처: '));
    used.forEach((source, index) => {
      if (index) line.append(doc.createTextNode(' · '));
      const label = `${source.provider ? `${source.provider} 공공데이터 ` : ''}「${source.name}」${withBasis && source.basisDate ? ` ${source.basisDate} 기준` : ''}`;
      if (source.datasetUrl) {
        const link = el(doc, 'a', 'lotbi-regional-source-link', label);
        link.href = source.datasetUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        line.append(link);
      } else {
        line.append(doc.createTextNode(label));
      }
    });
    footer.append(line);
  }
  if (notice) footer.append(el(doc, 'p', 'lotbi-regional-notice', notice));
  return footer;
}

function actionLink(doc, className, href, label, ariaLabel) {
  const link = el(doc, 'a', `lotbi-regional-action ${className}`, label);
  link.href = href;
  link.setAttribute('aria-label', ariaLabel);
  return link;
}

export function createRegionalFoodCard(value, {
  document: doc = globalThis.document,
  mapProvider,
  userAgent = globalThis.navigator?.userAgent || '',
  origin = globalThis.location?.origin || 'https://lotbiai.com',
  onStatus = () => {},
} = {}) {
  const result = value?.contractId === REGIONAL_FOOD_CONTRACT ? value : normalizeRegionalFoodResult(value);
  if (!result || !doc) return null;
  const provider = mapProvider || readDefaultMapProvider(doc.cookie || '');
  const presentation = defaultMapProviderPresentation(provider, {userAgent});
  const card = el(doc, 'section', 'lotbi-regional-card');
  card.dataset.regionalCard = 'FOOD';
  card.dataset.resultSetId = result.resultSetId;
  card.setAttribute('aria-label', '전북 맛집·음식 공식 등록정보');
  const header = el(doc, 'div', 'lotbi-regional-card-header');
  header.append(el(doc, 'h3', 'lotbi-regional-card-title', '전북 맛집·음식'));
  header.append(el(doc, 'span', 'lotbi-regional-card-basis', `${result.basisLabel ? `${result.basisLabel} · ` : ''}공식 등록정보`));
  card.append(header);
  const list = el(doc, 'ol', 'lotbi-regional-list');
  for (const place of result.results) {
    const item = el(doc, 'li', 'lotbi-regional-item');
    item.dataset.resultId = place.resultId;
    item.append(el(doc, 'h4', 'lotbi-regional-name', place.name));
    const labels = [...place.foodCategories, ...place.themes.map(theme => `${theme.label} ${theme.value}`)];
    if (labels.length) item.append(el(doc, 'p', 'lotbi-regional-meta', labels.join(' · ')));
    const distance = distanceText(place.distanceMeters);
    item.append(el(doc, 'p', 'lotbi-regional-address', distance ? `${place.address} · ${distance}` : place.address));
    if (place.hoursLabel) {
      item.append(el(doc, 'p', 'lotbi-regional-detail', place.holiday ? `${place.hoursLabel} · 휴무 ${place.holiday}` : place.hoursLabel));
    }
    if (place.representativeMenu) item.append(el(doc, 'p', 'lotbi-regional-detail', `대표메뉴 ${place.representativeMenu}`));
    const actions = el(doc, 'div', 'lotbi-regional-actions');
    if (place.phone) {
      const call = actionLink(doc, 'lotbi-regional-phone', telHref(place.phone), '전화', `${place.name} 전화 걸기`);
      call.dataset.action = 'phone';
      call.addEventListener('click', () => onStatus('전화 앱 연결을 시작합니다.'));
      actions.append(call);
    }
    const mapPlace = {name: place.name, address: place.address, latitude: place.latitude, longitude: place.longitude, navigationCapable: place.navigationCapable};
    const map = actionLink(doc, 'lotbi-regional-map', buildDefaultMapHref(provider, mapPlace, {userAgent, origin}),
      presentation.label, `${place.name} ${presentation.label}에서 보기`);
    map.target = '_blank';
    map.rel = 'noopener noreferrer';
    map.dataset.action = 'map';
    map.dataset.mapProvider = provider;
    map.addEventListener('click', () => onStatus(presentation.success));
    actions.append(map);
    item.append(actions);
    list.append(item);
  }
  card.append(list);
  if (result.totalMatches > result.results.length) {
    card.append(el(doc, 'p', 'lotbi-regional-more', `공식 자료에 모두 ${result.totalMatches}곳이 등록돼 있어요. 지역이나 음식 종류를 좁혀 물어보세요.`));
  }
  card.append(sourceFooter(doc, result.sources, result.notice));
  return card;
}

export function createRegionalContactCard(value, {document: doc = globalThis.document, onStatus = () => {}} = {}) {
  const result = value?.contractId === REGIONAL_CONTACT_CONTRACT ? value : normalizeRegionalContactResult(value);
  if (!result || !doc) return null;
  const card = el(doc, 'section', 'lotbi-regional-card');
  card.dataset.regionalCard = 'CONTACT';
  card.dataset.resultSetId = result.resultSetId;
  card.setAttribute('aria-label', '전북 행정기관 공식 연락처');
  const header = el(doc, 'div', 'lotbi-regional-card-header');
  header.append(el(doc, 'h3', 'lotbi-regional-card-title', '전북 행정기관 연락처'), el(doc, 'span', 'lotbi-regional-card-basis', '공식 공개 연락처'));
  card.append(header);
  const list = el(doc, 'ol', 'lotbi-regional-list');
  for (const entry of result.entries) {
    const item = el(doc, 'li', 'lotbi-regional-item');
    item.dataset.entryKind = entry.kind;
    const name = entry.kind === 'DEPARTMENT' ? `${entry.institution} ${entry.unit}` : entry.institution;
    item.append(el(doc, 'h4', 'lotbi-regional-name', name.trim()));
    const meta = entry.kind === 'DEPARTMENT' ? entry.division : entry.unit;
    if (meta) item.append(el(doc, 'p', 'lotbi-regional-meta', meta));
    const actions = el(doc, 'div', 'lotbi-regional-actions');
    if (entry.mainPhone) {
      const call = actionLink(doc, 'lotbi-regional-phone', telHref(entry.mainPhone), `대표 ${entry.mainPhone}`, `${name} 대표전화 걸기`);
      call.dataset.action = 'phone';
      call.addEventListener('click', () => onStatus('전화 앱 연결을 시작합니다.'));
      actions.append(call);
    }
    if (entry.directPhone) {
      const direct = actionLink(doc, 'lotbi-regional-phone', telHref(entry.directPhone), `직통 ${entry.directPhone}`,
        `${name}${entry.unit && entry.kind !== 'DEPARTMENT' ? ` ${entry.unit}` : ''} 직통전화 걸기`);
      direct.dataset.action = 'phone';
      direct.addEventListener('click', () => onStatus('전화 앱 연결을 시작합니다.'));
      actions.append(direct);
    }
    if (entry.fax) actions.append(el(doc, 'span', 'lotbi-regional-fax', `팩스 ${entry.fax}`));
    if (actions.childNodes.length) item.append(actions);
    if (entry.address) item.append(el(doc, 'p', 'lotbi-regional-address', entry.address));
    list.append(item);
  }
  card.append(list);
  card.append(sourceFooter(doc, result.sources, result.notice, {withBasis: true}));
  return card;
}

// ------------------------------------------------------------ entry form --

export const JEONBUK_FOOD_AREAS = Object.freeze(['전주', '한옥마을', '완산구', '덕진구', '군산', '익산', '남원']);
export const JEONBUK_FOOD_TYPES = Object.freeze([
  ['비빔밥', '비빔밥 맛집'], ['콩나물국밥', '콩나물국밥 맛집'], ['한정식', '한정식 맛집'],
  ['백반', '백반 맛집'], ['막걸리', '막걸리집'], ['한식', '한식 맛집'],
]);
export const JEONBUK_FOOD_THEMES = Object.freeze([
  ['kids', '아이와 함께', '아이랑 가기 좋은'], ['quiet', '조용한', '조용한'],
  ['comfort', '편안한', '편안한'], ['elders', '어르신과 함께', '어르신과 가기 좋은'],
]);
const FOOD_PHRASE = Object.freeze(Object.fromEntries(JEONBUK_FOOD_TYPES));
const THEME_PHRASE = Object.freeze(Object.fromEntries(JEONBUK_FOOD_THEMES.map(([id, , phrase]) => [id, phrase])));

function formText(value) {
  return String(value ?? '').replace(UNSAFE_TEXT_RE, ' ').replace(/\s+/gu, ' ').trim().slice(0, 40);
}

// One sentence the Core 전북 food route (regional_food_conversation) reads:
// "전북 <지역> <테마> <음식> 알려줘". "근처" only when the user chose 내 주변 and
// typed no area, so the existing life-location contract decides the location.
export function buildJeonbukFoodPrompt({region = '', food = '', theme = '', nearby = false} = {}) {
  const place = formText(region).replace(/\s*(?:에서|에)$/u, '').replace(/^(?:전북특별자치도|전라북도|전북)\s*/u, '');
  const where = place ? `전북 ${place}` : (nearby ? '근처 전북' : '전북');
  const themePhrase = THEME_PHRASE[theme] || '';
  const subject = FOOD_PHRASE[food] || (themePhrase ? '테마 음식점' : '맛집');
  return [where, themePhrase, subject, '알려줘'].filter(Boolean).join(' ');
}

export function createJeonbukFoodForm(doc, {onSubmit, actionClass = 'consumer-action'} = {}) {
  const form = el(doc, 'form', 'consumer-life-form');
  form.dataset.regionalFoodForm = 'JEONBUK';
  const state = {food: '', theme: '', nearby: false};
  const regionLabel = el(doc, 'label', 'consumer-life-field', '지역');
  const region = el(doc, 'input');
  region.type = 'text';
  region.maxLength = 40;
  region.placeholder = '예: 전주, 완산구, 군산 (비우면 전북 전체)';
  region.dataset.regionalField = 'region';
  region.setAttribute('aria-label', '지역');
  regionLabel.append(region);
  form.append(regionLabel);

  const groups = [];
  const chipGroup = (label, items, key) => {
    const row = el(doc, 'div', 'festival-chip-row consumer-life-chips');
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', label);
    row.dataset.regionalChips = key;
    for (const [id, text] of items) {
      const chip = el(doc, 'button', 'festival-chip', text);
      chip.type = 'button';
      chip.dataset.regionalChip = id;
      chip.setAttribute('aria-pressed', 'false');
      row.append(chip);
    }
    groups.push(row);
    form.append(el(doc, 'p', 'consumer-life-chip-label', label), row);
    return row;
  };
  const areaRow = chipGroup('지역 빠른 선택', [...JEONBUK_FOOD_AREAS.map(name => [name, name]), ['nearby', '내 주변']], 'area');
  const foodRow = chipGroup('음식 종류 (전주시 자료)', JEONBUK_FOOD_TYPES.map(([id]) => [id, id]), 'food');
  const themeRow = chipGroup('테마 (전북 테마별음식점 자료)', JEONBUK_FOOD_THEMES.map(([id, label]) => [id, label]), 'theme');

  const sync = () => {
    for (const chip of areaRow.children) {
      const id = chip.dataset.regionalChip;
      chip.setAttribute('aria-pressed', String(id === 'nearby' ? state.nearby : formText(region.value) === id));
    }
    for (const chip of foodRow.children) chip.setAttribute('aria-pressed', String(chip.dataset.regionalChip === state.food));
    for (const chip of themeRow.children) chip.setAttribute('aria-pressed', String(chip.dataset.regionalChip === state.theme));
  };
  areaRow.addEventListener('click', event => {
    const chip = event.target?.closest?.('[data-regional-chip]');
    if (!chip) return;
    const id = chip.dataset.regionalChip;
    if (id === 'nearby') {
      state.nearby = !state.nearby;
      if (state.nearby) region.value = '';
    } else {
      region.value = formText(region.value) === id ? '' : id;
      state.nearby = false;
    }
    sync();
  });
  // 음식 종류 lives in the 전주시 data, 테마 in the 전북 theme data: one at a time.
  foodRow.addEventListener('click', event => {
    const chip = event.target?.closest?.('[data-regional-chip]');
    if (!chip) return;
    state.food = state.food === chip.dataset.regionalChip ? '' : chip.dataset.regionalChip;
    if (state.food) state.theme = '';
    sync();
  });
  themeRow.addEventListener('click', event => {
    const chip = event.target?.closest?.('[data-regional-chip]');
    if (!chip) return;
    state.theme = state.theme === chip.dataset.regionalChip ? '' : chip.dataset.regionalChip;
    if (state.theme) state.food = '';
    sync();
  });
  region.addEventListener('input', () => { if (formText(region.value)) state.nearby = false; sync(); });

  const send = el(doc, 'button', actionClass, '롯비에게 물어보기');
  send.type = 'submit';
  form.append(send);
  form.addEventListener('submit', event => {
    event.preventDefault();
    onSubmit?.(buildJeonbukFoodPrompt({region: region.value, food: state.food, theme: state.theme, nearby: state.nearby}));
  });
  sync();
  const note = '전북특별자치도·전주시가 공개한 공식 공공데이터에서 찾아요. 실제 영업 여부는 방문 전 확인해 주세요. '
    + '‘내 주변’은 위치 사용을 켠 경우에만 현재 위치를 써요.';
  return {form, note};
}
