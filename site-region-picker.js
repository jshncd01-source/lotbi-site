// CONVERSATION-ANSWER-UX-01 (QA #7) — [지역 선택] under an "어느 지역에서
// 찾을까요?" answer. The list is Core's public weather region list
// (/v2/life/weather/regions: 시·도 → 시·군, no login), the same one Calendar
// uses. Picking a region only hands its name back to the conversation, which
// asks again with it; nothing is saved and no location is read.
import {CORE_ORIGIN} from './site-core.js?v=aset-4735b34338e2';
import {createBottomSheet, SHEET_PRESENTATION} from './site-bottom-sheet.js?v=aset-4735b34338e2';

const REGION_LIST_TIMEOUT_MS = 8000;
let regionChoicesRequest = null;

// {provinces: [...], byProvince: Map(province → [{label, name}])}, or null.
// name is what goes into the sentence: "전북특별자치도 전주시", "세종특별자치시".
export function regionChoicesFromPayload(payload) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const byProvince = new Map();
  for (const item of items) {
    const province = typeof item?.province === 'string' ? item.province.trim() : '';
    const label = typeof item?.label === 'string' ? item.label.trim() : '';
    if (!province || !label) continue;
    const name = province === label ? label : `${province} ${label}`;
    if (!byProvince.has(province)) byProvince.set(province, []);
    const list = byProvince.get(province);
    if (!list.some(entry => entry.name === name)) list.push(Object.freeze({label, name}));
  }
  const listed = Array.isArray(payload?.provinces)
    ? payload.provinces.map(value => (typeof value === 'string' ? value.trim() : '')).filter(value => byProvince.has(value))
    : [];
  const provinces = [...new Set([...listed, ...byProvince.keys()])];
  return provinces.length ? Object.freeze({provinces: Object.freeze(provinces), byProvince}) : null;
}

export async function readRegionChoices({fetchImpl = globalThis.fetch, origin = CORE_ORIGIN} = {}) {
  if (typeof fetchImpl !== 'function') return null;
  let controller = null;
  let timer = null;
  try {
    controller = typeof AbortController === 'function' ? new AbortController() : null;
    if (controller) timer = globalThis.setTimeout(() => { try { controller.abort(); } catch {} }, REGION_LIST_TIMEOUT_MS);
  } catch {
    controller = null;
  }
  try {
    const response = await fetchImpl(`${origin}/v2/life/weather/regions`, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      ...(controller ? {signal: controller.signal} : {}),
    });
    if (!response?.ok) return null;
    return regionChoicesFromPayload(await response.json());
  } catch {
    return null;
  } finally {
    if (timer) globalThis.clearTimeout(timer);
  }
}

function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function fillOptions(select, placeholder, entries) {
  const first = element('option', '', placeholder);
  first.value = '';
  select.replaceChildren(first, ...entries.map(([value, text]) => {
    const option = element('option', '', text);
    option.value = value;
    return option;
  }));
}

export function openRegionPicker({onPick, returnFocus = null, fetchImpl = globalThis.fetch, origin = CORE_ORIGIN} = {}) {
  const titleId = `lotbi-region-picker-title-${Math.random().toString(36).slice(2, 10)}`;
  const body = element('div', 'lotbi-region-picker');
  const title = element('h3', 'lotbi-region-picker-title', '지역 선택');
  title.id = titleId;
  const description = element('p', 'lotbi-region-picker-note', '찾을 시·도와 시·군을 고르세요.');
  const provinceField = element('label', 'lotbi-region-picker-field', '시·도');
  const province = element('select');
  province.dataset.regionPicker = 'province';
  provinceField.appendChild(province);
  const cityField = element('label', 'lotbi-region-picker-field', '시·군');
  const city = element('select');
  city.dataset.regionPicker = 'city';
  cityField.appendChild(city);
  const status = element('p', 'lotbi-region-picker-status');
  status.setAttribute('role', 'status');
  const actions = element('div', 'lotbi-region-picker-actions');
  const retry = element('button', 'lotbi-region-picker-secondary', '다시 불러오기');
  retry.type = 'button';
  retry.hidden = true;
  const submit = element('button', 'lotbi-region-picker-submit', '이 지역으로 찾기');
  submit.type = 'button';
  submit.dataset.regionPicker = 'submit';
  submit.disabled = true;
  actions.append(retry, submit);
  const missing = element('p', 'lotbi-region-picker-note', '목록에 없는 지역은 입력창에 지역 이름을 적어 보내 주세요.');
  body.append(title, description, provinceField, cityField, status, actions, missing);
  province.disabled = true;
  city.disabled = true;

  let choices = null;
  let picked = false;
  const sheet = createBottomSheet({
    labelledBy: titleId,
    content: body,
    presentation: SHEET_PRESENTATION.SHEET,
    onClose: () => {
      if (!picked && returnFocus?.isConnected) returnFocus.focus?.({preventScroll: true});
    },
  });

  const syncSubmit = () => { submit.disabled = !city.value; };
  const fillCities = () => {
    const entries = choices?.byProvince.get(province.value) || [];
    fillOptions(city, '시·군 선택', entries.map(entry => [entry.name, entry.label]));
    city.disabled = !entries.length;
    if (entries.length === 1) city.value = entries[0].name;
    syncSubmit();
  };
  province.addEventListener('change', fillCities);
  city.addEventListener('change', syncSubmit);
  submit.addEventListener('click', () => {
    const name = city.value;
    if (!name || typeof onPick !== 'function') return;
    picked = true;
    sheet.close();
    onPick(name);
  });

  const load = async () => {
    retry.hidden = true;
    status.textContent = '지역 목록을 불러오는 중…';
    regionChoicesRequest = regionChoicesRequest || readRegionChoices({fetchImpl, origin});
    choices = await regionChoicesRequest;
    if (!choices) {
      regionChoicesRequest = null;
      status.textContent = '지역 목록을 불러오지 못했어요. 잠시 후 다시 불러와 주세요.';
      retry.hidden = false;
      return;
    }
    status.textContent = '';
    fillOptions(province, '시·도 선택', choices.provinces.map(value => [value, value]));
    province.disabled = false;
    fillCities();
  };
  retry.addEventListener('click', () => { void load(); });

  sheet.open();
  void load();
  return sheet;
}
