// CONVERSATION-ANSWER-UX-01 (QA #7) — [지역 선택] under an "어느 지역에서
// 찾을까요?" answer. The list is Core's public weather region list
// (/v2/life/weather/regions: 시·도 → 시·군, no login), the same one Calendar
// uses. Picking a region only hands its name back to the conversation, which
// asks again with it; no location is read. NEARBY-LOCATION-ALLOW-PROMPT-01:
// the pick also carries the list's own coordinates for that 시·군, so a PC
// can keep it as the person's region (site-location-allow.js decides), and
// the saved region is chosen when the list opens.
import {CORE_ORIGIN} from './site-core.js?v=aset-c51b254b23d8';
import {createBottomSheet, SHEET_PRESENTATION} from './site-bottom-sheet.js?v=aset-c51b254b23d8';

const REGION_LIST_TIMEOUT_MS = 8000;
let regionChoicesRequest = null;

// {provinces: [...], byProvince: Map(province → [{label, name, latitude, longitude}])},
// or null. name is what goes into the sentence: "전북특별자치도 전주시",
// "세종특별자치시". latitude/longitude are the list's 시·군 anchor (NaN when absent).
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
    const latitude = Number(item?.latitude);
    const longitude = Number(item?.longitude);
    if (!list.some(entry => entry.name === name)) {
      list.push(Object.freeze({
        label,
        name,
        latitude: Number.isFinite(latitude) && item?.latitude !== null ? latitude : Number.NaN,
        longitude: Number.isFinite(longitude) && item?.longitude !== null ? longitude : Number.NaN,
      }));
    }
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

// NEARBY-LOCATION-ALLOW-PROMPT-01 (owner, after SITE-T55): chips, not two
// dropdowns and a submit — the same as 지역뉴스 (REGIONAL-NEWS-CITY-SELECT-01).
// A 시·도 chip shows that 시·도's 시·군 chips; a 시·군 chip asks at once. A 시·도
// with one 시·군 (세종) asks at once from the 시·도 chip. The saved region, when
// it is on the list, is one chip at the top. 지역 고르기 → 시·도 → 시·군: two
// taps after the button, nothing to confirm.
function chip(text, dataset) {
  const node = element('button', 'lotbi-region-picker-chip', text);
  node.type = 'button';
  Object.assign(node.dataset, dataset);
  return node;
}

export function openRegionPicker({onPick, returnFocus = null, initialName = '', fetchImpl = globalThis.fetch, origin = CORE_ORIGIN} = {}) {
  const titleId = `lotbi-region-picker-title-${Math.random().toString(36).slice(2, 10)}`;
  const body = element('div', 'lotbi-region-picker');
  const title = element('h3', 'lotbi-region-picker-title', '지역 고르기');
  title.id = titleId;
  const description = element('p', 'lotbi-region-picker-note', '시·도를 누르면 시·군이 나와요. 시·군을 누르면 바로 찾아요.');
  const savedRow = element('div', 'lotbi-region-picker-chips lotbi-region-picker-saved');
  savedRow.hidden = true;
  const stepLabel = element('p', 'lotbi-region-picker-step');
  const chips = element('div', 'lotbi-region-picker-chips');
  chips.setAttribute('role', 'group');
  const status = element('p', 'lotbi-region-picker-status');
  status.setAttribute('role', 'status');
  const actions = element('div', 'lotbi-region-picker-actions');
  const retry = element('button', 'lotbi-region-picker-secondary', '다시 불러오기');
  retry.type = 'button';
  retry.hidden = true;
  actions.append(retry);
  const missing = element('p', 'lotbi-region-picker-note', '목록에 없는 지역은 입력창에 지역 이름을 적어 보내 주세요.');
  body.append(title, description, savedRow, stepLabel, chips, status, actions, missing);

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

  const pick = entry => {
    if (!entry || typeof onPick !== 'function') return;
    picked = true;
    sheet.close();
    onPick(entry.name, entry);
  };
  const showProvinces = () => {
    stepLabel.textContent = '시·도';
    chips.setAttribute('aria-label', '시·도');
    chips.replaceChildren(...choices.provinces.map(value => chip(value, {regionProvince: value})));
    chips.querySelector('button')?.focus({preventScroll: true});
  };
  const showCities = province => {
    const entries = choices.byProvince.get(province) || [];
    if (entries.length === 1) { pick(entries[0]); return; }
    stepLabel.textContent = province;
    chips.setAttribute('aria-label', `${province} 시·군`);
    const back = chip('← 시·도 다시 고르기', {regionPicker: 'back'});
    back.classList.add('is-back');
    chips.replaceChildren(back, ...entries.map(entry => chip(entry.label, {regionCity: entry.name})));
    chips.querySelector('[data-region-city]')?.focus({preventScroll: true});
  };
  chips.addEventListener('click', event => {
    const target = event.target?.closest?.('button');
    if (!target || !choices) return;
    if (target.dataset.regionPicker === 'back') { showProvinces(); return; }
    if (target.dataset.regionProvince) { showCities(target.dataset.regionProvince); return; }
    if (target.dataset.regionCity) {
      for (const entries of choices.byProvince.values()) {
        const entry = entries.find(item => item.name === target.dataset.regionCity);
        if (entry) { pick(entry); return; }
      }
    }
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
    // The saved region, when it is on the list, is one tap.
    const wanted = String(initialName || '').trim();
    let saved = null;
    if (wanted) {
      for (const entries of choices.byProvince.values()) {
        saved = entries.find(entry => entry.name === wanted || entry.label === wanted) || null;
        if (saved) break;
      }
    }
    if (saved) {
      const savedChip = chip(`${saved.name}에서 찾기`, {regionSaved: saved.name});
      savedChip.addEventListener('click', () => pick(saved));
      savedRow.replaceChildren(savedChip);
      savedRow.hidden = false;
    }
    showProvinces();
  };
  retry.addEventListener('click', () => { void load(); });

  sheet.open();
  void load();
  return sheet;
}
