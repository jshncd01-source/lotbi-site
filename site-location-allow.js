// NEARBY-LOCATION-ALLOW-PROMPT-01 — the one "위치 허용" part every LOTBI screen
// that needs a place uses. It is not a second location system: coordinates
// still come only from the shared layer (site-current-location.js), and this
// module stores nothing but the person's own choices.
//
// One rule for every screen:
//   [위치 허용하고 찾기] → LOTBI 위치 사용 켜기 → the browser's permission
//   prompt → when allowed, the screen does again what it was about to do.
//   - The browser has blocked location: no prompt can show, so it says where
//     to unblock it (주소창 자물쇠 → 위치 → 허용).
//   - The person says no: the region list (지역 고르기).
//   - Allowed but no position (a PC with its location service off): one line
//     on turning it on (Windows 설정 → 개인 정보 및 보안 → 위치).
//   - A position too rough to trust on a PC (over 3 km: a PC without GPS
//     guesses from its network): it is not used at once. One line says so and
//     the person picks [이 위치로 찾기] or [지역 고르기] — the line stays on
//     screen beside the two choices instead of scrolling away under results
//     that may be 5 km off. Phones use a rough position as before.
// Nothing is asked before the tap; the position goes only to the lookup the
// tap was for (the shared layer keeps it two minutes in memory, as before).
//
// PCs: 지역 고르기 sits beside 위치 허용 at the same weight, and the region
// picked there is saved as the person's region (the same 저장 지역 Calendar
// weather and every 지역정보 screen already read), so it is used next time.
// Phones keep their behavior: a picked region is used once, nothing saved.
import {getBrowserLocationPermissionState, LOCATION_PERMISSION, resolveSharedBrowserCurrentLocation} from './site-current-location.js?v=aset-9f4d58455fd7';
import {isLocationUsageEnabled, setLocationUsageEnabled} from './site-location-preference.js?v=aset-9f4d58455fd7';
import {readCalendarManualWeatherRegion, saveChosenWeatherRegion} from './site-calendar-weather-region.js?v=aset-9f4d58455fd7';

export const LOCATION_ALLOW_OUTCOME = Object.freeze({
  LOCATED: 'LOCATED',
  COARSE: 'COARSE',
  BLOCKED: 'BLOCKED',
  DENIED: 'DENIED',
  POSITION_UNAVAILABLE: 'POSITION_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  UNSUPPORTED: 'UNSUPPORTED',
  SETTING_FAILED: 'SETTING_FAILED',
});

// Above this the position is a guess (a PC without GPS reads it from its
// network): still used, with a word that it may be off.
export const COARSE_ACCURACY_METERS = 3000;

export const LOCATION_ALLOW_LABEL = '위치 허용하고 찾기';
export const REGION_CHOICE_LABEL = '지역 고르기';

// Wide or mouse-driven: a PC, where location is often missing or rough, so
// 지역 고르기 is offered as an equal choice and a picked region is kept.
export function prefersRegionChoice({matchMedia = globalThis.matchMedia?.bind(globalThis)} = {}) {
  try {
    if (typeof matchMedia !== 'function') return false;
    return matchMedia('(min-width: 761px)').matches || matchMedia('(hover: hover) and (pointer: fine)').matches;
  } catch {
    return false;
  }
}

export function devicePlatform({navigatorRef = globalThis.navigator} = {}) {
  const platform = String(navigatorRef?.userAgentData?.platform || navigatorRef?.platform || '');
  const agent = String(navigatorRef?.userAgent || '');
  if (/android|iphone|ipad|ipod/iu.test(agent)) return 'MOBILE';
  if (/win/iu.test(platform) || /windows/iu.test(agent)) return 'WINDOWS';
  if (/mac/iu.test(platform) || /macintosh/iu.test(agent)) return 'MAC';
  return 'OTHER';
}

// The tap is the request: turn LOTBI 위치 사용 on, then let the browser ask.
export async function requestLocationWithConsent({
  usageEnabled = isLocationUsageEnabled,
  enableUsage = () => setLocationUsageEnabled(true),
  permissionState = getBrowserLocationPermissionState,
  resolveCurrent = resolveSharedBrowserCurrentLocation,
} = {}) {
  try {
    if (!usageEnabled()) enableUsage();
  } catch {
    return Object.freeze({outcome: LOCATION_ALLOW_OUTCOME.SETTING_FAILED, location: null});
  }
  let before = LOCATION_PERMISSION.UNKNOWN;
  try { before = await permissionState(); } catch { before = LOCATION_PERMISSION.UNKNOWN; }
  if (before === LOCATION_PERMISSION.UNAVAILABLE) return Object.freeze({outcome: LOCATION_ALLOW_OUTCOME.UNSUPPORTED, location: null});
  // Blocked before the tap: the browser will not show its prompt again.
  if (before === LOCATION_PERMISSION.DENIED) return Object.freeze({outcome: LOCATION_ALLOW_OUTCOME.BLOCKED, location: null});
  let result = null;
  try { result = await resolveCurrent({allowPrompt: true}); } catch { result = null; }
  const location = result?.location || null;
  if (location) {
    const accuracy = Number(location.accuracyMeters);
    const coarse = Number.isFinite(accuracy) && accuracy > COARSE_ACCURACY_METERS;
    return Object.freeze({
      outcome: coarse ? LOCATION_ALLOW_OUTCOME.COARSE : LOCATION_ALLOW_OUTCOME.LOCATED,
      location,
      accuracyMeters: Number.isFinite(accuracy) ? accuracy : null,
    });
  }
  const code = result?.error?.code || '';
  let outcome = LOCATION_ALLOW_OUTCOME.POSITION_UNAVAILABLE;
  if (code === 'BROWSER_LOCATION_DENIED' || result?.permission === LOCATION_PERMISSION.DENIED) outcome = LOCATION_ALLOW_OUTCOME.DENIED;
  else if (code === 'BROWSER_LOCATION_TIMEOUT') outcome = LOCATION_ALLOW_OUTCOME.TIMEOUT;
  else if (code === 'BROWSER_LOCATION_UNSUPPORTED') outcome = LOCATION_ALLOW_OUTCOME.UNSUPPORTED;
  else if (code === 'LOCATION_USAGE_DISABLED') outcome = LOCATION_ALLOW_OUTCOME.SETTING_FAILED;
  return Object.freeze({outcome, location: null});
}

// One line for what happened, or '' when there is nothing to say.
export function locationOutcomeMessage(value, {platform = devicePlatform(), wide = prefersRegionChoice()} = {}) {
  const outcome = typeof value === 'string' ? value : value?.outcome;
  switch (outcome) {
    case LOCATION_ALLOW_OUTCOME.BLOCKED:
      return '이 브라우저가 위치를 막아 두었어요. 주소창 왼쪽 자물쇠 아이콘 → 위치 → 허용으로 바꾼 뒤 다시 눌러 주세요.';
    case LOCATION_ALLOW_OUTCOME.DENIED:
      return '위치를 허용하지 않았어요. 지역을 골라 주세요.';
    case LOCATION_ALLOW_OUTCOME.POSITION_UNAVAILABLE:
      if (platform === 'WINDOWS') return '위치를 받지 못했어요. Windows 설정 → 개인 정보 및 보안 → 위치에서 위치 서비스를 켜거나, 지역을 골라 주세요.';
      if (platform === 'MAC') return '위치를 받지 못했어요. 시스템 설정 → 개인정보 보호 및 보안 → 위치 서비스를 켜거나, 지역을 골라 주세요.';
      return '현재 위치를 확인하지 못했어요. 기기의 위치 서비스를 켜거나 지역을 골라 주세요.';
    case LOCATION_ALLOW_OUTCOME.TIMEOUT:
      return '위치 확인이 오래 걸려요. 잠시 뒤 다시 누르거나 지역을 골라 주세요.';
    case LOCATION_ALLOW_OUTCOME.UNSUPPORTED:
      return '이 브라우저에서는 위치를 쓸 수 없어요. 지역을 골라 주세요.';
    case LOCATION_ALLOW_OUTCOME.SETTING_FAILED:
      return '위치 사용 설정을 바꾸지 못했어요. 지역을 골라 주세요.';
    case LOCATION_ALLOW_OUTCOME.COARSE: {
      if (!wide) return '';
      const meters = Number(value?.accuracyMeters);
      const about = Number.isFinite(meters) ? `(오차 약 ${Math.max(1, Math.round(meters / 1000))}km)` : '';
      return `PC 위치는 정확하지 않을 수 있어요${about}. 이 위치로 찾거나 지역을 골라 주세요.`;
    }
    default:
      return '';
  }
}

// The saved region's label for a "전주시에서 찾기" chip, or ''.
export function savedRegionChoice({readSavedRegion = readCalendarManualWeatherRegion} = {}) {
  let saved = null;
  try { saved = readSavedRegion(); } catch { saved = null; }
  return saved?.label ? String(saved.label) : '';
}

// 지역 고르기: the region list; on a PC the pick is saved as the person's region.
export async function chooseRegion({
  returnFocus = null,
  onPick,
  save = prefersRegionChoice(),
  saveRegion = saveChosenWeatherRegion,
  loadPicker = () => import('./site-region-picker.js?v=aset-9f4d58455fd7'),
} = {}) {
  const {openRegionPicker} = await loadPicker();
  return openRegionPicker({
    returnFocus,
    initialName: savedRegionChoice(),
    onPick: (name, entry) => {
      let saved = false;
      if (save && entry && Number.isFinite(entry.latitude) && Number.isFinite(entry.longitude)) {
        try {
          saved = saveRegion({label: name, latitude: entry.latitude, longitude: entry.longitude, midRegionCode: null}) === true;
        } catch {
          saved = false;
        }
      }
      onPick?.(name, {saved});
    },
  });
}

function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

// The shared row: [위치 허용하고 찾기] [지역 고르기] (+ [저장 지역에서 찾기])
// and one status line. onLocated() runs the screen's lookup again with the
// position now allowed; onRegion(name) runs it for a region by name.
export function createLocationAllowRow({
  onLocated,
  onRegion,
  ariaLabel = '찾을 위치 정하기',
  className = '',
  chipClassName = 'lotbi-location-allow-chip',
  showSaved = true,
  request = requestLocationWithConsent,
  choose = chooseRegion,
} = {}) {
  const row = element('div', `lotbi-location-allow ${className}`.trim());
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', ariaLabel);
  const buttons = element('div', 'lotbi-location-allow-buttons');
  const note = element('p', 'lotbi-location-allow-note');
  note.setAttribute('role', 'status');
  note.hidden = true;
  const say = text => {
    note.textContent = text || '';
    note.hidden = !text;
  };
  const add = (label, kind) => {
    const button = element('button', chipClassName, label);
    button.type = 'button';
    button.dataset.locationRequest = kind;
    buttons.appendChild(button);
    return button;
  };
  const allow = add(isLocationUsageEnabled() ? '현재 위치로 찾기' : LOCATION_ALLOW_LABEL, 'current');
  // A rough PC position waiting for the person's choice.
  let roughResult = null;
  const region = add(REGION_CHOICE_LABEL, 'region');
  const savedLabel = showSaved ? savedRegionChoice() : '';
  if (savedLabel) add(`${savedLabel}에서 찾기`, 'saved').addEventListener('click', () => { say(''); onRegion?.(savedLabel); });

  const openRegions = () => choose({
    returnFocus: region,
    onPick: (name, {saved} = {}) => {
      say(saved ? `${name}을(를) 내 지역으로 저장했어요. 다음부터 이 지역으로 찾아요.` : '');
      onRegion?.(name);
    },
  }).catch(() => say('지역 목록을 열지 못했어요. 입력창에 지역 이름을 적어 보내 주세요.'));

  allow.addEventListener('click', async () => {
    if (allow.dataset.busy === 'true') return;
    if (roughResult) {
      const chosen = roughResult;
      roughResult = null;
      say('');
      onLocated?.(chosen);
      return;
    }
    allow.dataset.busy = 'true';
    allow.setAttribute('aria-busy', 'true');
    say('위치를 확인하는 중…');
    let result = null;
    try { result = await request(); } catch { result = {outcome: LOCATION_ALLOW_OUTCOME.POSITION_UNAVAILABLE}; }
    delete allow.dataset.busy;
    allow.removeAttribute('aria-busy');
    row.dataset.locationOutcome = result?.outcome || '';
    say(locationOutcomeMessage(result));
    if (result?.outcome === LOCATION_ALLOW_OUTCOME.COARSE && prefersRegionChoice()) {
      roughResult = result;
      allow.textContent = '이 위치로 찾기';
      return;
    }
    if (result?.outcome === LOCATION_ALLOW_OUTCOME.LOCATED || result?.outcome === LOCATION_ALLOW_OUTCOME.COARSE) {
      allow.textContent = '현재 위치로 찾기';
      onLocated?.(result);
      return;
    }
    if (result?.outcome === LOCATION_ALLOW_OUTCOME.DENIED) {
      void openRegions();
      return;
    }
    region.focus?.({preventScroll: true});
  });
  region.addEventListener('click', () => { void openRegions(); });
  row.append(buttons, note);
  return row;
}
