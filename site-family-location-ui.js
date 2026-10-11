// FAMILY-LOCATION-01 「우리 가족 위치」 — 안심케어 → 가족 위치 (Desktop and Mobile Web).
//
// FAMILY-LOCATION-DESIGN-01 (2026-10-11, USER_FIRST_STANDARD): one screen, one job.
//  - 가족 (home): SOS on top; a guardian sees each person as a card — the last time right next to
//    the name, the battery right under it, the place in words with an honest accuracy, the reason
//    it stopped — with one big [지금 위치 요청] and four tools (위치 상태 점검 · 지도 · 로드뷰 ·
//    장소 알림). A person who shares sees a prominent "가족에게 위치 공유 중" card with SOS, pause
//    and [원치 않는 추적]. Below: big tiles to 초대하기 · 초대 코드 입력 · 알림 설정.
//  - 초대하기 / 초대 코드 입력 / 알림 설정 / 장소 알림 each have their own screen with ← 가족 위치.
//  - Every empty or failed screen has a next button. LOTBI line icons (24 px, 1.6 stroke), the
//    --lotbi-* theme tokens (light, dark), 48 px controls, large text.
// Sending itself happens on the Android app; the web only sends "지금 내 위치 한 번" and SOS.
// Not here: hidden modes, location history, ads. The map SDK stays off until NAVER Maps keys exist.
import {
  FAMILY_MISSING_REPORT_NOTICE, FAMILY_PRIVACY_NOTICE, acceptFamilyInvite, approveFamilyGuardian, closeFamilySos, createFamilyInvite, createFamilyPlace, createFamilyRequest,
  declineFamilyInvite, deleteFamilyPlace, endFamilyMember, familyAccuracyText, familyErrorMessage, familyHiddenText,
  familyInviteRef, familyMapLinks, familyPlaceCenterFromFix, familyPresenceText, familySosMissingReport, getFamilyOverview, getFamilyRequest,
  getFamilyStatusCheck, listFamilyPlaces, pauseFamilySharing, previewFamilyInvite, putFamilyAlertSettings, reconfirmFamilySharing,
  reportFamilyTracking, resumeFamilySharing, revokeFamilyInvite, sendFamilyLocationOnce, sendFamilySos, updateFamilyPlace,
} from './site-family-location.js?v=aset-de7c7de63821';
import {resolveSharedBrowserCurrentLocation} from './site-current-location.js?v=aset-de7c7de63821';
import {readDefaultMapProvider} from './site-location-preference.js?v=aset-de7c7de63821';
import {shareWithKakaoTalk} from './site-kakao-share.js?v=aset-de7c7de63821';
import {takeFamilyInviteIntent} from './site-route.js?v=aset-de7c7de63821';

const SHARER_RELATIONS = Object.freeze([['CHILD', '자녀'], ['PARENT', '부모님'], ['SPOUSE', '배우자'], ['FAMILY', '가족']]);
const RELATION_LABEL = Object.freeze({CHILD: '자녀', PARENT: '부모님', SPOUSE: '배우자', FAMILY: '가족', GUARDIAN: '함께 보는 보호자', OWNER: '가족 주인'});
const PAUSE_LABEL = Object.freeze({HOUR: '1시간 멈추기', TODAY: '오늘 멈추기', UNTIL_RESUME: '다시 켤 때까지 멈추기'});
const KIND_LABEL = Object.freeze({STALE: '위치 멈춤', BATTERY: '배터리 부족', PAUSE: '잠시 멈춤', PLACE: '장소 도착·출발'});
const PLACE_KINDS = Object.freeze([['HOME', '집'], ['SCHOOL', '학교'], ['ACADEMY', '학원'], ['OTHER', '기타']]);
const PLACE_RADII = Object.freeze([100, 150, 200, 300]);
const POLL_MS = 3000;
const POLL_LIMIT_MS = 10 * 60_000;

// LOTBI line icons (same drawing rules as the 지역정보 cards: 24 px box, round 1.6 stroke).
const ICON_PATHS = Object.freeze({
  lock: ['M6 11h12v10H6V11Z', 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3'],
  pin: ['M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z', 'M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6'],
  battery: ['M3 8h15v8H3V8Z', 'M21 11v2', 'M5.5 10.5h6v3h-6z'],
  charging: ['M3 8h15v8H3V8Z', 'M21 11v2', 'm11 9.5-2 3h3l-2 3'],
  map: ['m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z', 'M9 4v14m6-12v14'],
  street: ['M3 8h4l2-3h6l2 3h4v11H3V8Z', 'M12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7'],
  pulse: ['M3 12h4l2-6 4 12 2-6h6'],
  flag: ['M5 21V4', 'M5 4h11l-2 4 2 4H5'],
  userPlus: ['M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M8.5 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8', 'M19 8v6m-3-3h6'],
  key: ['M4 9h16M4 15h16', 'M10 3 8 21m8-18-2 18'],
  bell: ['M6 9a6 6 0 1 1 12 0c0 6 3 7 3 7H3s3-1 3-7Z', 'M10 20a2 2 0 0 0 4 0'],
  back: ['M15 5l-7 7 7 7'],
  alert: ['M12 3 2 20h20L12 3Z', 'M12 10v4m0 3h.01'],
  phone: ['M5 3h4l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2Z'],
  check: ['m5 12 5 5 9-10'],
  people: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8', 'M19 8a3 3 0 0 1 0 6m0 2a4 4 0 0 1 3 4v1'],
  send: ['M3 11 21 3l-8 18-2-8-8-2Z'],
  pause: ['M8 5v14m8-14v14'],
  shield: ['m12 2 8 4v6c0 6-8 10-8 10S4 18 4 12V6l8-4Z', 'm8 12 3 3 5-6'],
  refresh: ['M20 11a8 8 0 1 0-2.3 5.7', 'M20 4v7h-7'],
});

const el = (tag, className = '', text = '') => { const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node; };
const clock = value => { const date = new Date(value || ''); return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit', hour12: false}); };
function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', 'family-loc-icon');
  for (const value of ICON_PATHS[name] || ICON_PATHS.pin) {
    const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', value); svg.append(path);
  }
  return svg;
}
function withIcon(node, name) { node.prepend(icon(name)); return node; }
function button(label, onClick, {primary = false, danger = false, quiet = false, testId = '', glyph = ''} = {}) {
  const node = el('button', `family-loc-button${primary ? ' family-loc-primary' : ''}${danger ? ' family-loc-danger' : ''}${quiet ? ' family-loc-quiet' : ''}`, label);
  node.type = 'button';
  if (testId) node.dataset.familyAction = testId;
  if (glyph) withIcon(node, glyph);
  node.addEventListener('click', onClick);
  return node;
}
function link(label, href, glyph = '') {
  const node = el('a', 'family-loc-button', label);
  node.href = href; node.target = '_blank'; node.rel = 'noopener noreferrer';
  if (glyph) withIcon(node, glyph);
  return node;
}
// A square tool: icon above a short label (the 지역정보 card shape, smaller).
function tool(label, glyph, onClick, testId) {
  const node = el('button', 'family-loc-tool'); node.type = 'button'; node.dataset.familyAction = testId;
  node.append(icon(glyph), el('span', '', label));
  node.addEventListener('click', onClick);
  return node;
}
function toolLink(label, glyph, href) {
  const node = el('a', 'family-loc-tool'); node.href = href; node.target = '_blank'; node.rel = 'noopener noreferrer';
  node.append(icon(glyph), el('span', '', label));
  return node;
}

/**
 * @param {{sessionToken: string, root: HTMLElement, onMissingReport?: (prefill: {lastSeenAt: string, lastSeenSummary: string}) => void}} options
 */
export async function mountFamilyLocation({sessionToken, root, onMissingReport} = {}) {
  const surface = el('div', 'family-loc-surface'); surface.dataset.familyLocationSurface = '';
  root.replaceChildren(surface);
  const notice = withIcon(el('p', 'family-loc-privacy'), 'lock');
  notice.append(el('span', '', FAMILY_PRIVACY_NOTICE));
  const status = el('p', 'family-loc-status'); status.setAttribute('role', 'status');
  const content = el('div', 'family-loc-content');
  surface.append(notice, status, content);
  if (!sessionToken) { content.append(emptyCard('로그인하면 가족 위치를 쓸 수 있어요', '가족과 서로의 위치를 확인하고 SOS를 보낼 수 있어요.', 'people')); return {}; }

  let disposed = false;
  let busy = false;
  let overview = null;
  let loadFailure = '';
  let invitePreview = null;
  let inviteRefValue = takeFamilyInviteIntent();
  let createdInvite = null;
  let sosArmed = false;
  let sosTimer = 0;
  // One screen, one job: 'home' | 'invite' | 'accept' | 'settings' | 'places:<member id>'.
  let view = inviteRefValue ? 'accept' : 'home';
  // Forms survive re-renders (a pending 지금 위치 request redraws every 3 s): what a person is
  // typing is never wiped. Each is rebuilt only when what it shows changes.
  let inviteNode = null;
  let acceptNode = null; let acceptKey = '';
  let settingsNode = null; let settingsKey = '';
  const placeLists = new Map();        // member id -> Core's list (places, limit, used, plan_allows, suggestions)
  const placePanels = new Map();       // member id -> {node, key}
  const requests = new Map();          // member id -> latest request
  const checks = new Map();            // member id -> status check
  const timers = new Set();
  const say = (text, alert = false) => { status.textContent = text || ''; status.setAttribute('role', alert ? 'alert' : 'status'); };

  async function act(work, failure) {
    if (busy || disposed) return null;
    busy = true; say('');
    try { return await work(); }
    catch (error) { say(familyErrorMessage(error, failure), true); return null; }
    finally { busy = false; }
  }

  async function refresh() {
    try { overview = await getFamilyOverview(sessionToken); loadFailure = ''; }
    catch (error) {
      overview = null;
      loadFailure = error?.code === 'FAMILY_LOCATION_NOT_ENABLED' ? 'NOT_ENABLED' : 'FAILED';
      say(loadFailure === 'NOT_ENABLED' ? '가족 위치는 준비 중이에요.' : '가족 위치를 불러오지 못했어요.', true);
    }
    if (!disposed) render();
  }

  function go(next) {
    view = next; say('');
    render();
    content.querySelector('.family-loc-view-title, .family-loc-heading')?.focus?.();
  }

  function poll(memberId, requestId, startedAt) {
    const timer = setTimeout(async () => {
      timers.delete(timer);
      if (disposed) return;
      let next = null;
      try { next = await getFamilyRequest(sessionToken, requestId); } catch { return; }
      if (disposed) return;
      requests.set(memberId, next);
      if (next.status === 'PENDING' && Date.now() - startedAt < POLL_LIMIT_MS) poll(memberId, requestId, startedAt);
      else await refresh();
      if (!disposed) render();
    }, POLL_MS);
    timers.add(timer);
  }

  function emptyCard(title, copy, glyph, actions = []) {
    const box = el('section', 'family-loc-empty');
    box.append(icon(glyph), el('h3', '', title), el('p', '', copy));
    if (actions.length) { const row = el('div', 'family-loc-actions'); row.append(...actions); box.append(row); }
    return box;
  }

  function viewHeader(title) {
    const head = el('div', 'family-loc-view-head');
    const back = button('가족 위치', () => go('home'), {quiet: true, testId: 'back', glyph: 'back'});
    back.dataset.familyNav = 'home';
    const heading = el('h3', 'family-loc-view-title', title); heading.tabIndex = -1;
    head.append(back, heading);
    return head;
  }

  // ── a guardian's view of one person ────────────────────────────────────────
  function memberCard(family, member) {
    const card = el('article', 'family-loc-card family-loc-member'); card.dataset.familyMember = member.id;
    card.dataset.presence = member.presence || 'NO_DATA';
    const head = el('div', 'family-loc-card-head');
    const avatar = el('span', 'family-loc-avatar', (member.name || '?').slice(0, 1)); avatar.setAttribute('aria-hidden', 'true');
    const who = el('div', 'family-loc-who');
    // The last time stands right next to the name; the battery right under it (기획서 3).
    who.append(el('strong', 'family-loc-name', member.name), el('span', 'family-loc-presence', familyPresenceText(member)));
    head.append(avatar, who);
    card.append(head);
    if (member.battery) {
      const battery = withIcon(el('p', 'family-loc-battery'), member.battery.charging ? 'charging' : 'battery');
      battery.append(`배터리 ${member.battery.percent}%${member.battery.charging ? ' · 충전 중' : ''}`);
      if (member.battery.percent <= 15 && !member.battery.charging) battery.dataset.low = '';
      card.append(battery);
    }
    if (member.location) {
      const place = withIcon(el('p', 'family-loc-place'), 'pin');
      place.append(`${member.location.area ? `${member.location.area} 근처` : '위치 받음'} · ${familyAccuracyText(member.location)} · ${clock(member.location.captured_at)}`);
      card.append(place);
    } else if (familyHiddenText(member.location_hidden_reason)) {
      card.append(el('p', 'family-loc-note', familyHiddenText(member.location_hidden_reason)));
    }
    if (member.stop_reason && member.stop_reason.code !== 'OK' && member.presence !== 'LIVE') {
      const why = el('div', 'family-loc-why');
      why.append(icon('alert'), el('span', 'family-loc-why-label', '멈춘 이유'), el('p', 'family-loc-reason', member.stop_reason.text));
      card.append(why);
    }
    const request = requests.get(member.id);
    if (request) {
      const text = request.status === 'PENDING' ? (request.wake === 'PUSH_OFF' ? '응답을 기다리는 중… (휴대폰의 다음 신호, 최대 5분)' : '응답을 기다리는 중…')
        : request.status === 'ANSWERED' ? (request.kind === 'CHECK' ? '점검 결과를 받았어요.' : '새 위치를 받았어요.')
          : request.failure?.text || '응답이 없어요.';
      const line = el('p', 'family-loc-request', text); line.dataset.familyRequestStatus = request.status; card.append(line);
    }
    const check = checks.get(member.id) || (request?.status === 'ANSWERED' ? request.check : null);
    if (check) card.append(statusCheckView(check));
    const remaining = family.now_requests_left_today;
    const now = button(remaining == null ? '지금 위치 요청' : `지금 위치 요청 (오늘 ${remaining}회)`, () => { void ask(member, 'NOW'); }, {primary: true, testId: 'now', glyph: 'send'});
    now.classList.add('family-loc-wide');
    const tools = el('div', 'family-loc-tools');
    tools.append(tool('위치 상태 점검', 'pulse', () => { void checkNow(member); }, 'check'));
    const links = familyMapLinks(member, readDefaultMapProvider());
    if (links) tools.append(toolLink('지도에서 보기', 'map', links.map), toolLink('로드뷰', 'street', links.roadview));
    if (placesSupported()) tools.append(tool('장소 알림', 'flag', () => { void openPlaces(member); }, 'places'));
    card.append(now, tools);
    if (family.role === 'OWNER') card.append(button('연결 해제', () => { void removeMember(member); }, {quiet: true, danger: true, testId: 'remove'}));
    return card;
  }

  function statusCheckView(check) {
    const box = el('div', 'family-loc-check'); box.dataset.familyCheck = check.cause?.code || '';
    box.append(el('p', 'family-loc-check-summary', check.summary));
    const list = el('ul', 'family-loc-check-items');
    for (const item of check.items || []) {
      const row = el('li', '', `${item.ok === true ? '✓' : item.ok === false ? '✕' : '–'} ${item.label}`);
      row.dataset.ok = String(item.ok);
      list.append(row);
    }
    box.append(list);
    return box;
  }

  async function ask(member, kind) {
    const request = await act(() => createFamilyRequest(sessionToken, member.id, kind), '요청하지 못했어요.');
    if (!request) return;
    requests.set(member.id, request);
    // A fresh 지금 위치 replaces an old check result; a CHECK request keeps the one just shown.
    if (kind === 'NOW') checks.delete(member.id);
    render();
    poll(member.id, request.id, Date.now());
  }

  async function checkNow(member) {
    const check = await act(() => getFamilyStatusCheck(sessionToken, member.id), '점검 결과를 불러오지 못했어요.');
    if (!check) return;
    checks.set(member.id, check); render();
    // A fresh report too, so the phone's current settings arrive within the next signal.
    void ask(member, 'CHECK');
  }

  async function removeMember(member) {
    if (!globalThis.confirm?.(`${member.name} 연결을 해제할까요? 저장된 위치도 바로 지워져요.`)) return;
    if (await act(() => endFamilyMember(sessionToken, member.id), '연결을 해제하지 못했어요.')) { say(`${member.name} 연결을 해제했어요.`); await refresh(); }
  }

  // ── 도착/출발 places for one person (its own screen) ──────────────────────
  // Core lists PLACE among the alert kinds once it has places; before that nothing is shown.
  const placesSupported = () => (overview?.settings?.kinds || []).includes('PLACE');
  const memberById = id => (overview?.families || []).flatMap(family => family.members || []).find(member => member.id === id) || null;

  async function loadPlaces(member) {
    // A read never waits for (or blocks) a running action.
    try { placeLists.set(member.id, await listFamilyPlaces(sessionToken, member.id)); }
    catch (error) { say(familyErrorMessage(error, '장소를 불러오지 못했어요.'), true); }
    if (!disposed) render();
  }

  async function openPlaces(member) {
    go(`places:${member.id}`);
    await loadPlaces(member);
  }

  function placesView(member) {
    const list = placeLists.get(member.id) || null;
    const key = JSON.stringify([member.name, list]);
    const cached = placePanels.get(member.id);
    if (cached && cached.key === key) return cached.node;
    const panel = el('section', 'family-loc-view family-loc-places'); panel.dataset.familyPlaces = member.id;
    panel.append(viewHeader(`${member.name} 장소 알림`),
      el('p', 'family-loc-note', `${member.name} 폰이 장소 안팎을 스스로 판단하고, 3분 넘게 머물러야 알려요. 위치가 애매하면 알리지 않아요. 등록한 장소는 ${member.name} 폰에도 보여요.`));
    if (!list) { panel.append(el('p', 'family-loc-note', '장소를 불러오는 중…')); placePanels.set(member.id, {node: panel, key}); return panel; }
    if (!list.plan_allows) panel.append(el('p', 'family-loc-chip', '도착·출발 알림은 Plus 요금제부터 쓸 수 있어요.'));
    else panel.append(el('p', 'family-loc-chip', `장소 ${list.used}/${list.limit}곳 (가족 전체)`));
    for (const place of list.places || []) panel.append(placeRow(member, place));
    if (list.plan_allows && list.used < list.limit) panel.append(placeForm(member, list));
    placePanels.set(member.id, {node: panel, key});
    return panel;
  }

  function placeRow(member, place) {
    const row = el('article', 'family-loc-card family-loc-place-row'); row.dataset.familyPlace = place.id;
    const title = withIcon(el('p', 'family-loc-place-name'), 'flag');
    title.append(`${place.name} (${place.kind_label}) · 반경 ${place.radius_m}m · ${place.created_by} 님이 등록`);
    row.append(title);
    const toggles = el('div', 'family-loc-switches');
    const flag = (field, label) => {
      const wrap = el('label', 'family-loc-check-label'); const box = el('input'); box.type = 'checkbox'; box.checked = place[field] === true;
      box.dataset.familyPlaceField = field;
      box.addEventListener('change', () => { void changePlace(member, place, {[field]: box.checked}); });
      wrap.append(box, el('span', '', label)); toggles.append(wrap);
    };
    flag('arrive', '도착 알림'); flag('depart', '출발 알림');
    if (place.kind === 'SCHOOL') flag('holiday_off', place.school_linked ? '쉬는 날 끄기 (주말·공휴일·학사일정)' : '쉬는 날 끄기 (주말·공휴일)');
    row.append(toggles, button('장소 지우기', () => { void removePlace(member, place); }, {quiet: true, danger: true, testId: 'place-delete'}));
    return row;
  }

  function placeForm(member, list) {
    const form = el('form', 'family-loc-card family-loc-form family-loc-place-form'); form.dataset.familyPlaceForm = member.id;
    form.append(el('strong', 'family-loc-form-title', '장소 추가'));
    const suggestion = el('select'); suggestion.setAttribute('aria-label', '내 아이 학교에서 고르기');
    const suggestions = list.suggestions || [];
    if (suggestions.length) {
      const none = el('option', '', '직접 입력'); none.value = ''; suggestion.append(none);
      for (const item of suggestions) { const option = el('option', '', `내 아이: ${item.name}`); option.value = item.my_child_entry_id; suggestion.append(option); }
    } else suggestion.hidden = true;
    const name = el('input'); name.maxLength = 20; name.placeholder = '장소 이름 (예: 학원)'; name.setAttribute('aria-label', '장소 이름');
    const kind = el('select'); kind.setAttribute('aria-label', '장소 종류');
    for (const [value, label] of PLACE_KINDS) { const option = el('option', '', label); option.value = value; kind.append(option); }
    kind.value = 'ACADEMY';
    const radius = el('select'); radius.setAttribute('aria-label', '반경');
    for (const meters of PLACE_RADII) { const option = el('option', '', `반경 ${meters}m`); option.value = String(meters); radius.append(option); }
    radius.value = '150';
    suggestion.addEventListener('change', () => {
      const picked = suggestions.find(item => item.my_child_entry_id === suggestion.value);
      if (picked) { name.value = picked.name.slice(0, 20); kind.value = 'SCHOOL'; }
    });
    const pair = el('div', 'family-loc-pair'); pair.append(kind, radius);
    const centers = el('div', 'family-loc-switches'); centers.setAttribute('role', 'radiogroup'); centers.setAttribute('aria-label', '장소 위치');
    const radio = (value, label, checked) => {
      const wrap = el('label', 'family-loc-check-label'); const input = el('input'); input.type = 'radio'; input.name = `family-place-center-${member.id}`;
      input.value = value; input.checked = checked; wrap.append(input, el('span', '', label)); centers.append(wrap);
    };
    radio('MEMBER_LOCATION', `${member.name} 지금 위치로`, Boolean(member.location));
    radio('MY_LOCATION', '내 지금 위치로', !member.location);
    const flags = el('div', 'family-loc-switches');
    const check = label => { const wrap = el('label', 'family-loc-check-label'); const box = el('input'); box.type = 'checkbox'; box.checked = true; wrap.append(box, el('span', '', label)); flags.append(wrap); return box; };
    const arrive = check('도착 알림'); const depart = check('출발 알림');
    const submit = el('button', 'family-loc-button family-loc-primary family-loc-wide', '장소 추가'); submit.type = 'submit';
    form.append(suggestion, name, pair, centers, flags, submit);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!name.value.trim()) { say('장소 이름을 적어 주세요.', true); return; }
      const source = form.querySelector(`input[name="family-place-center-${member.id}"]:checked`)?.value || 'MY_LOCATION';
      let center = {source: 'MEMBER_LOCATION'};
      if (source === 'MY_LOCATION') {
        const fix = await currentFix().catch(() => null);
        if (!fix) { say('내 현재 위치를 확인하지 못했어요. 브라우저 위치 권한을 확인해 주세요.', true); return; }
        center = familyPlaceCenterFromFix(fix);
      }
      const created = await act(() => createFamilyPlace(sessionToken, member.id, {
        name: name.value.trim(), kind: kind.value, radiusMeters: Number(radius.value), center, arrive: arrive.checked, depart: depart.checked,
        myChildEntryId: suggestion.value || undefined,
      }), '장소를 추가하지 못했어요.');
      if (created) { say(`${created.name} 장소를 추가했어요.`); await loadPlaces(member); }
    });
    return form;
  }

  async function changePlace(member, place, fields) {
    if (await act(() => updateFamilyPlace(sessionToken, place.id, fields), '장소를 바꾸지 못했어요.')) say('장소 알림을 바꿨어요.');
    await loadPlaces(member);
  }

  async function removePlace(member, place) {
    if (!globalThis.confirm?.(`${place.name} 장소를 지울까요?`)) return;
    if (await act(() => deleteFamilyPlace(sessionToken, place.id), '장소를 지우지 못했어요.')) say(`${place.name} 장소를 지웠어요.`);
    await loadPlaces(member);
  }

  // ── SOS ────────────────────────────────────────────────────────────────────
  function sosCard(item) {
    const card = el('article', 'family-loc-card family-loc-sos'); card.dataset.familySos = item.id; card.setAttribute('role', 'alert');
    card.append(withIcon(el('strong', 'family-loc-sos-title', `SOS · ${item.name} (${clock(item.created_at)})`), 'alert'));
    if (item.location) {
      const place = withIcon(el('p', 'family-loc-place'), 'pin');
      place.append(`${item.location.area ? `${item.location.area} 근처` : '위치 받음'} · ${familyAccuracyText(item.location)}`);
      card.append(place);
    }
    if (item.battery) card.append(withIcon(el('p', 'family-loc-battery', `배터리 ${item.battery.percent}%`), 'battery'));
    if (!item.mine) {
      const missing = button('실종 신고로 이어가기', () => { void continueToMissing(item); }, {primary: true, testId: 'sos-missing'});
      missing.classList.add('family-loc-wide', 'family-loc-sos-primary');
      card.append(missing);
    }
    const tools = el('div', 'family-loc-tools');
    const call = toolLink('112 전화', 'phone', 'tel:112'); call.removeAttribute('target'); call.removeAttribute('rel');
    tools.append(call);
    const links = familyMapLinks(item, readDefaultMapProvider());
    if (links) tools.append(toolLink('지도에서 보기', 'map', links.map), toolLink('로드뷰', 'street', links.roadview));
    if (!item.mine) tools.append(tool('찾았어요 · 종료', 'check', () => { void closeSos(item); }, 'sos-close'));
    card.append(tools);
    if (!item.mine) {
      const note = el('p', 'family-loc-note', FAMILY_MISSING_REPORT_NOTICE); note.dataset.familyMissingNote = '';
      card.append(note);
    }
    return card;
  }

  async function continueToMissing(item) {
    const result = await act(() => familySosMissingReport(sessionToken, item.id), '실종 신고로 이어가지 못했어요.');
    if (!result) return;
    const prefill = {lastSeenAt: result.prefill.last_seen_at, lastSeenSummary: result.prefill.last_seen_summary};
    if (typeof onMissingReport === 'function') onMissingReport(prefill);
    else say(`마지막으로 본 장소: ${prefill.lastSeenSummary || '직접 적어 주세요'} — 사람 탭에서 실종 신고를 이어가세요.`);
  }

  async function closeSos(item) {
    if (await act(() => closeFamilySos(sessionToken, item.id), 'SOS를 종료하지 못했어요.')) { say('SOS를 종료했어요.'); await refresh(); }
  }

  // ── my own sharing: a prominent "공유 중" card ──────────────────────────────
  function sharingSection(sharing) {
    const box = el('section', 'family-loc-card family-loc-sharing'); box.dataset.familySharing = '';
    box.dataset.sharingState = sharing.paused ? 'PAUSED' : 'ON';
    const head = el('div', 'family-loc-sharing-head');
    head.append(el('span', 'family-loc-live-dot'), el('strong', 'family-loc-indicator', sharing.indicator || '가족에게 위치 공유 중'));
    box.append(head);
    if (sharing.paused) box.append(el('p', 'family-loc-note', sharing.paused_until ? `${clock(sharing.paused_until)}까지 멈췄어요. 가족에게도 그렇게 보여요.` : '다시 켤 때까지 멈췄어요. 가족에게도 그렇게 보여요.'));
    box.append(withIcon(el('p', 'family-loc-viewers', `나를 보는 사람: ${(sharing.viewers || []).map(item => item.name).join(', ') || '없음'}`), 'people'));
    for (const check of (sharing.recent_checks || []).slice(0, 3)) {
      box.append(el('p', 'family-loc-note', `${clock(check.at)} ${check.by} · ${check.kind === 'NOW' ? '위치를 확인했어요' : '위치 상태를 점검했어요'}`));
    }
    // P1: every 도착/출발 place set for me, and by whom.
    if ((sharing.places || []).length) {
      const places = el('div', 'family-loc-places-for-me'); places.dataset.familyPlacesForMe = '';
      places.append(el('p', 'family-loc-note', '나에게 등록된 장소 (도착·출발을 알려요):'));
      for (const place of sharing.places) {
        const alerts = [place.arrive ? '도착' : '', place.depart ? '출발' : ''].filter(Boolean).join('·') || '알림 꺼짐';
        places.append(el('p', 'family-loc-note', `· ${place.name} (${place.kind_label}) · ${place.by} 님이 등록 · ${alerts}`));
      }
      box.append(places);
    }
    const sos = button(sosArmed ? '한 번 더 누르면 가족에게 알려요' : 'SOS 도와주세요', () => { void sendSos(); }, {danger: true, testId: 'sos'});
    sos.classList.add('family-loc-sos-button');
    const actions = el('div', 'family-loc-actions');
    if (sharing.paused) actions.append(button('위치 공유 다시 켜기', () => { void resume(); }, {primary: true, testId: 'resume', glyph: 'send'}));
    else for (const option of sharing.pause_options || []) actions.append(button(PAUSE_LABEL[option] || option, () => { void pause(option); }, {testId: `pause-${option}`, glyph: 'pause'}));
    actions.append(button('지금 내 위치 한 번 보내기', () => { void sendOnce(); }, {testId: 'send-once', glyph: 'pin'}));
    box.append(sos, actions);
    if (sharing.under14) box.append(el('p', 'family-loc-note', '잠시 멈추면 보호자에게 바로 알려져요.'));
    if (sharing.reconfirm_due_at && new Date(sharing.reconfirm_due_at).getTime() <= Date.now()) {
      box.append(button('계속 공유할게요', () => { void act(() => reconfirmFamilySharing(sessionToken), '확인하지 못했어요.').then(refresh); }, {primary: true}));
    }
    box.append(el('p', 'family-loc-note', '위치는 LOTBI 안드로이드 앱이 보내요. 앱에서 같은 계정으로 로그인하고 「가족 위치」에서 위치 보내기를 켜 주세요.'));
    for (const family of sharing.families || []) {
      const row = el('div', 'family-loc-family-row');
      row.append(el('span', '', `${family.owner} 가족 · ${RELATION_LABEL[family.relation] || family.relation}`));
      const rowActions = el('div', 'family-loc-actions');
      if (sharing.can_end) rowActions.append(button('공유 끄기', () => { void leave(family.member_id); }, {testId: 'leave'}));
      rowActions.append(button('원치 않는 추적을 당하고 있어요', () => { void reportTracking(family.member_id); }, {danger: true, testId: 'report', glyph: 'shield'}));
      row.append(rowActions);
      box.append(row);
    }
    return box;
  }

  async function currentFix() {
    const outcome = await resolveSharedBrowserCurrentLocation({allowPrompt: true});
    return outcome?.location || null;
  }

  async function sendOnce() {
    const fix = await currentFix();
    if (!fix) { say('현재 위치를 확인하지 못했어요. 브라우저 위치 권한과 설정의 위치 사용을 확인해 주세요.', true); return; }
    if (await act(() => sendFamilyLocationOnce(sessionToken, fix), '위치를 보내지 못했어요.')) { say('지금 위치를 가족에게 보냈어요.'); await refresh(); }
  }

  async function sendSos() {
    if (!sosArmed) {
      sosArmed = true; render();
      sosTimer = setTimeout(() => { sosArmed = false; if (!disposed) render(); }, 8000);
      return;
    }
    clearTimeout(sosTimer); sosArmed = false;
    const fix = await currentFix().catch(() => null);
    const result = await act(() => sendFamilySos(sessionToken, fix), 'SOS를 보내지 못했어요. 위험하면 112에 바로 전화하세요.');
    if (result) { say(result.message || '가족에게 알렸어요. 위험하면 112에 바로 전화하세요.', true); await refresh(); }
    else render();
  }

  async function pause(option) {
    if (await act(() => pauseFamilySharing(sessionToken, option, 1), '잠시 멈추지 못했어요.')) await refresh();
  }
  async function resume() {
    if (await act(() => resumeFamilySharing(sessionToken), '다시 켜지 못했어요.')) await refresh();
  }
  async function leave(memberId) {
    if (!globalThis.confirm?.('이 가족에게 위치 공유를 끌까요? 저장된 위치도 바로 지워져요.')) return;
    if (await act(() => endFamilyMember(sessionToken, memberId), '공유를 끄지 못했어요.')) { say('위치 공유를 껐어요.'); await refresh(); }
  }
  async function reportTracking(memberId) {
    if (!globalThis.confirm?.('연결을 바로 끊고 LOTBI에 신고할까요? 상대에게는 \'연결 해제\'로만 보이고, 이 가족은 다시 초대할 수 없어요.')) return;
    const result = await act(() => reportFamilyTracking(sessionToken, memberId), '신고하지 못했어요.');
    if (result) { say(result.message || '연결을 끊고 신고했어요.'); await refresh(); }
  }

  // ── the owner's decisions that wait (on the home screen) ────────────────────
  function pendingGuardians(family) {
    const box = el('div', 'family-loc-owner');
    for (const pending of family.pending_guardians || []) {
      const row = el('div', 'family-loc-card family-loc-pending'); row.dataset.familyPendingGuardian = pending.id;
      row.append(el('span', '', `${pending.name} · 함께 보는 보호자로 들어오려고 해요. 맞는 사람인가요?`));
      const actions = el('div', 'family-loc-actions');
      actions.append(
        button('맞아요', () => { void act(() => approveFamilyGuardian(sessionToken, pending.id, true), '승인하지 못했어요.').then(refresh); }, {primary: true, testId: 'approve'}),
        button('아니에요', () => { void act(() => approveFamilyGuardian(sessionToken, pending.id, false), '거절하지 못했어요.').then(refresh); }, {testId: 'reject'}),
      );
      row.append(actions); box.append(row);
    }
    return box;
  }

  // ── 초대하기 (its own screen) ───────────────────────────────────────────────
  function inviteForm() {
    const form = el('form', 'family-loc-card family-loc-form family-loc-invite'); form.dataset.familyInviteForm = '';
    form.append(el('strong', 'family-loc-form-title', '누구를 초대할까요?'));
    const role = el('select'); role.setAttribute('aria-label', '누구를 초대할까요');
    for (const [value, label] of [...SHARER_RELATIONS, ['GUARDIAN', '함께 보는 보호자(엄마·아빠 등)']]) {
      const option = el('option', '', label); option.value = value; role.append(option);
    }
    const label = el('input'); label.maxLength = 20; label.placeholder = '부를 이름 (예: 은율)'; label.setAttribute('aria-label', '부를 이름');
    const under14 = el('label', 'family-loc-check-label'); const under14Box = el('input'); under14Box.type = 'checkbox';
    under14.append(under14Box, el('span', '', '만 14세 미만 아이예요'));
    const consentDoc = overview?.consent?.guardian_under14;
    const consent = el('label', 'family-loc-check-label family-loc-consent'); const consentBox = el('input'); consentBox.type = 'checkbox';
    consent.append(consentBox, el('span', '', consentDoc?.text || '법정대리인으로서 아이의 위치 공유에 동의합니다.'));
    const sync = () => { const child = role.value === 'CHILD'; under14.hidden = !child; consent.hidden = !(child && under14Box.checked); };
    role.addEventListener('change', sync); under14Box.addEventListener('change', sync); sync();
    const submit = el('button', 'family-loc-button family-loc-primary family-loc-wide', '초대 만들기'); submit.type = 'submit';
    form.append(role, label, under14, consent, submit);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const child = role.value === 'CHILD' && under14Box.checked;
      if (child && !consentBox.checked) { say('만 14세 미만은 법정대리인 동의가 필요해요.', true); return; }
      const result = await act(() => createFamilyInvite(sessionToken, {
        role: role.value === 'GUARDIAN' ? 'GUARDIAN' : 'SHARER', relation: role.value, label: label.value.trim(),
        under14: child, guardianConsentVersion: consentDoc?.version,
      }), '초대를 만들지 못했어요.');
      if (result) { createdInvite = result; form.reset(); sync(); await refresh(); }
    });
    return form;
  }

  function createdInviteCard(invite) {
    const card = el('article', 'family-loc-card family-loc-created'); card.dataset.familyCreatedInvite = '';
    card.append(withIcon(el('strong', 'family-loc-form-title', '초대를 만들었어요'), 'check'));
    const code = el('p', 'family-loc-code', invite.code); code.setAttribute('aria-label', `초대 코드 ${invite.code.split('').join(' ')}`);
    card.append(el('p', 'family-loc-note', `상대 폰의 LOTBI에서 이 코드를 넣어 주세요(${clock(invite.invite.code_expires_at)}까지, 1번만).`), code,
      el('p', 'family-loc-note', `또는 링크(${clock(invite.invite.expires_at)}까지)를 보내세요. 상대가 직접 수락해야 연결돼요.`));
    const actions = el('div', 'family-loc-actions');
    actions.append(
      button('카카오톡으로 보내기', () => { void shareWithKakaoTalk({text: 'LOTBI 가족 위치 초대예요. 링크를 열고 수락해 주세요.', url: invite.invite_url}).catch(() => say('카카오톡을 열지 못했어요. 링크를 복사해 보내 주세요.', true)); }, {primary: true, testId: 'share-kakao', glyph: 'send'}),
      button('링크 복사', () => { void globalThis.navigator?.clipboard?.writeText(invite.invite_url).then(() => say('링크를 복사했어요.'), () => say('복사하지 못했어요.', true)); }, {testId: 'copy-link'}),
      button('다른 사람 초대하기', () => { createdInvite = null; render(); }, {quiet: true, testId: 'invite-another'}),
    );
    card.append(actions);
    return card;
  }

  function inviteView(families) {
    const box = el('section', 'family-loc-view'); box.dataset.familyView = 'invite';
    box.append(viewHeader('가족 초대하기'), el('p', 'family-loc-note', '초대한 사람이 자기 폰에서 직접 수락해야 연결돼요. 만 14세 미만 아이는 법정대리인 동의가 필요해요.'));
    // One job at a time: the result alone, then [다른 사람 초대하기] brings the form back.
    if (createdInvite) box.append(createdInviteCard(createdInvite));
    else { inviteNode ||= inviteForm(); box.append(inviteNode); }
    for (const family of families.filter(item => item.role === 'OWNER')) {
      for (const invite of family.invites || []) {
        const row = el('div', 'family-loc-card family-loc-pending');
        row.append(el('span', '', `초대 대기 · ${invite.label || RELATION_LABEL[invite.relation] || ''} (${clock(invite.expires_at)}까지)`));
        row.append(button('초대 취소', () => { void act(() => revokeFamilyInvite(sessionToken, invite.id), '초대를 취소하지 못했어요.').then(refresh); }, {quiet: true, testId: 'revoke'}));
        box.append(row);
      }
    }
    return box;
  }

  // ── 초대 코드 입력 (its own screen) ─────────────────────────────────────────
  function acceptSection() {
    const box = el('section', 'family-loc-card family-loc-form family-loc-accept'); box.dataset.familyAccept = '';
    box.append(el('strong', 'family-loc-form-title', '초대받았어요'));
    if (invitePreview) {
      const preview = invitePreview;
      box.append(el('p', '', `${preview.inviter.name} 님이 ${preview.invite.role === 'GUARDIAN' ? '함께 가족 위치를 보는 보호자로' : '내 위치를 보려고'} 초대했어요.`));
      if (preview.invite.under14) box.append(el('p', 'family-loc-note', '보호자가 만 14세 미만 아이로 초대했고, 법정대리인 동의를 기록했어요.'));
      if (preview.consent) box.append(el('p', 'family-loc-consent-text', preview.consent.text));
      const actions = el('div', 'family-loc-actions');
      actions.append(
        button('허락', () => { void answer(true); }, {primary: true, testId: 'accept', glyph: 'check'}),
        button('거절', () => { void answer(false); }, {testId: 'decline'}),
      );
      box.append(actions);
      return box;
    }
    const input = el('input'); input.placeholder = '초대 코드 6자리 또는 초대 링크'; input.setAttribute('aria-label', '초대 코드 또는 링크');
    input.inputMode = 'text';
    box.append(input, button('초대 확인', () => { void lookUp(input.value); }, {primary: true, testId: 'lookup'}));
    return box;
  }

  async function lookUp(value) {
    const ref = typeof value === 'string' ? familyInviteRef(value) : value;
    if (!ref) { say('초대 코드 6자리나 초대 링크를 넣어 주세요.', true); return; }
    const preview = await act(() => previewFamilyInvite(sessionToken, ref), '초대를 찾지 못했어요.');
    if (preview) { invitePreview = preview; inviteRefValue = ref; render(); }
  }

  async function answer(accept) {
    const ref = inviteRefValue;
    if (!ref || !invitePreview) return;
    const preview = invitePreview;
    const result = await act(() => accept ? acceptFamilyInvite(sessionToken, ref, preview.consent?.version) : declineFamilyInvite(sessionToken, ref),
      accept ? '초대를 수락하지 못했어요.' : '초대를 거절하지 못했어요.');
    if (!result) return;
    invitePreview = null; inviteRefValue = null; view = 'home';
    say(accept ? (preview.invite.role === 'GUARDIAN' ? '가족 주인이 확인하면 가족 위치를 볼 수 있어요.' : '연결됐어요. LOTBI 안드로이드 앱에서 위치 보내기를 켜 주세요.') : '초대를 거절했어요.');
    await refresh();
  }

  // ── 알림 설정 (its own screen) ──────────────────────────────────────────────
  function settingsSection(families) {
    const settings = overview.settings || {};
    // The kinds Core knows (an older Core has no PLACE and would refuse it).
    const kinds = (Array.isArray(settings.kinds) ? settings.kinds : ['STALE', 'BATTERY', 'PAUSE']).filter(kind => KIND_LABEL[kind]);
    const form = el('form', 'family-loc-card family-loc-form family-loc-settings'); form.dataset.familySettings = '';
    form.append(el('p', 'family-loc-note', kinds.includes('PLACE')
      ? 'SOS는 늘 울려요. 조용한 시간에는 다른 알림을 아침에 모아서 보내고, 장소 도착·출발 알림은 보내지 않아요.'
      : 'SOS는 늘 울려요. 조용한 시간에는 다른 알림을 아침에 모아서 보내요.'));
    const hours = Array.from({length: 24}, (_, hour) => hour);
    const select = (value, label) => {
      const node = el('select'); node.setAttribute('aria-label', label);
      for (const hour of hours) { const option = el('option', '', `${hour}시`); option.value = String(hour); node.append(option); }
      node.value = String(value); return node;
    };
    const start = select(settings.quiet_start_hour ?? 23, '조용한 시간 시작');
    const end = select(settings.quiet_end_hour ?? 6, '조용한 시간 끝');
    const stale = el('select'); stale.setAttribute('aria-label', '위치 멈춤 알림 시간');
    for (const minutes of [15, 30, 60, 120, 240]) { const option = el('option', '', `${minutes}분 넘게 위치가 없으면`); option.value = String(minutes); stale.append(option); }
    stale.value = String(settings.stale_minutes ?? 30);
    const row = el('div', 'family-loc-quiet-row'); row.append(start, el('span', '', '~'), end);
    form.append(el('strong', 'family-loc-field-label', '조용한 시간'), row, el('strong', 'family-loc-field-label', '위치 멈춤 알림'), stale);
    const toggles = [];
    for (const family of families) {
      for (const member of family.members.filter(item => item.role === 'SHARER')) {
        const line = el('div', 'family-loc-settings-person'); line.append(el('strong', '', member.name));
        const boxes = el('div', 'family-loc-switches');
        for (const kind of kinds) {
          const label = el('label', 'family-loc-check-label'); const box = el('input'); box.type = 'checkbox';
          box.checked = settings.member_kinds?.[member.id]?.[kind] !== false;
          label.append(box, el('span', '', KIND_LABEL[kind])); boxes.append(label);
          toggles.push({memberId: member.id, kind, box});
        }
        line.append(boxes);
        form.append(line);
      }
    }
    const save = el('button', 'family-loc-button family-loc-primary family-loc-wide', '알림 설정 저장'); save.type = 'submit';
    form.append(save);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const memberKinds = {};
      for (const {memberId, kind, box} of toggles) (memberKinds[memberId] ||= {})[kind] = box.checked;
      if (await act(() => putFamilyAlertSettings(sessionToken, {quietStartHour: Number(start.value), quietEndHour: Number(end.value), staleMinutes: Number(stale.value), memberKinds}), '알림 설정을 저장하지 못했어요.')) {
        say('알림 설정을 저장했어요.'); await refresh();
      }
    });
    return form;
  }

  // ── the whole screen ───────────────────────────────────────────────────────
  function navTiles(hasSharers) {
    const tiles = el('nav', 'family-loc-nav'); tiles.setAttribute('aria-label', '가족 위치 메뉴');
    const tile = (id, label, copy, glyph) => {
      const node = el('button', 'family-loc-nav-tile'); node.type = 'button'; node.dataset.familyNav = id;
      node.append(icon(glyph), el('strong', '', label), el('span', '', copy));
      node.addEventListener('click', () => go(id));
      tiles.append(node);
    };
    tile('invite', '가족 초대하기', '코드·링크로 초대', 'userPlus');
    tile('accept', '초대 코드 입력', '받은 초대 수락', 'key');
    if (hasSharers) tile('settings', '알림 설정', '조용한 시간·알림 종류', 'bell');
    return tiles;
  }

  function homeView(families) {
    const parts = [];
    for (const item of overview.sos || []) parts.push(sosCard(item));
    if (overview.sharing?.connected) parts.push(sharingSection(overview.sharing));
    for (const family of families) {
      const section = el('section', 'family-loc-family'); section.dataset.familyGroup = family.id;
      const plan = family.plan;
      const title = el('div', 'family-loc-family-title');
      const heading = el('h3', 'family-loc-heading', family.role === 'OWNER' ? '우리 가족' : `${family.owner} 가족`); heading.tabIndex = -1;
      title.append(heading);
      if (plan) title.append(el('span', 'family-loc-chip', `${plan.code} · ${plan.people_used}/${plan.people_limit}명`));
      section.append(title);
      if (plan && !plan.live_map) section.append(el('p', 'family-loc-note', '실시간 위치는 Plus 요금제부터 보여요.'));
      if (family.role === 'OWNER') section.append(pendingGuardians(family));
      const sharers = family.members.filter(member => member.role === 'SHARER');
      for (const member of sharers) section.append(memberCard(family, member));
      if (!sharers.length) section.append(emptyCard('아직 연결된 가족이 없어요', '가족을 초대하면 이름 옆에 마지막 위치 시각과 배터리가 보여요.', 'people',
        [button('가족 초대하기', () => go('invite'), {primary: true, glyph: 'userPlus'})]));
      const viewers = family.members.filter(member => member.role !== 'SHARER').map(member => member.name);
      if (viewers.length) section.append(withIcon(el('p', 'family-loc-viewers', `함께 보는 사람: ${viewers.join(', ')}`), 'people'));
      parts.push(section);
    }
    for (const family of (overview.families || []).filter(item => item.status === 'PENDING_APPROVAL')) {
      parts.push(el('p', 'family-loc-note', `${family.owner} 님이 확인하면 그 가족의 위치를 볼 수 있어요.`));
    }
    if (!families.length && !overview.sharing?.connected && !(overview.sos || []).length) {
      // Nothing yet: the two ways to start, once (the tiles below would repeat them).
      parts.push(emptyCard('가족 위치를 시작해요', '가족을 초대하거나, 받은 초대 코드를 넣어 주세요. 상대가 직접 수락해야 연결돼요.', 'people',
        [button('가족 초대하기', () => go('invite'), {primary: true, glyph: 'userPlus'}), button('초대 코드 입력', () => go('accept'), {glyph: 'key'})]));
      return parts;
    }
    parts.push(navTiles(families.some(family => family.members.some(member => member.role === 'SHARER'))));
    return parts;
  }

  function render() {
    if (disposed) return;
    const acceptState = invitePreview ? `preview:${invitePreview.invite.id}` : 'input';
    if (!acceptNode || acceptKey !== acceptState) { acceptNode = acceptSection(); acceptKey = acceptState; }
    if (!overview) {
      if (view === 'accept') { const box = el('section', 'family-loc-view'); box.append(viewHeader('초대 코드 입력'), acceptNode); content.replaceChildren(box); return; }
      const retry = button(loadFailure === 'NOT_ENABLED' ? '다시 확인' : '다시 시도', () => { void refresh(); }, {primary: true, testId: 'retry', glyph: 'refresh'});
      content.replaceChildren(loadFailure
        ? emptyCard(loadFailure === 'NOT_ENABLED' ? '가족 위치는 준비 중이에요' : '가족 위치를 불러오지 못했어요',
          loadFailure === 'NOT_ENABLED' ? '곧 열릴 예정이에요. 받은 초대 코드가 있으면 먼저 넣어 둘 수 있어요.' : '인터넷 연결을 확인한 뒤 다시 시도해 주세요.', loadFailure === 'NOT_ENABLED' ? 'people' : 'alert',
          [retry, ...(loadFailure === 'NOT_ENABLED' ? [button('초대 코드 입력', () => go('accept'), {glyph: 'key'})] : [])])
        : el('p', 'family-loc-note', '가족 위치를 불러오는 중…'));
      return;
    }
    const families = (overview.families || []).filter(family => family.status === 'ACTIVE');
    let parts;
    if (view === 'invite') parts = [inviteView(families)];
    else if (view === 'accept') { const box = el('section', 'family-loc-view'); box.append(viewHeader('초대 코드 입력'), acceptNode); parts = [box]; }
    else if (view === 'settings' && families.some(family => family.members.some(member => member.role === 'SHARER'))) {
      const key = JSON.stringify([overview.settings || {}, families.map(family => family.members.filter(member => member.role === 'SHARER').map(member => [member.id, member.name]))]);
      if (!settingsNode || settingsKey !== key) { settingsNode = settingsSection(families); settingsKey = key; }
      const box = el('section', 'family-loc-view'); box.append(viewHeader('알림 설정'), settingsNode); parts = [box];
    } else if (view.startsWith('places:') && memberById(view.slice(7))) parts = [placesView(memberById(view.slice(7)))];
    else { view = 'home'; parts = homeView(families); }
    parts.push(el('p', 'family-loc-note family-loc-footer', placesSupported()
      ? '위치·가족 화면에는 광고가 없어요. 이동 경로는 남기지 않아요. 마지막 위치 1개만 암호화해 저장하고, 장소 도착·출발은 알림과 하루 보관 기록만 남아요.'
      : '위치·가족 화면에는 광고가 없어요. 이동 기록은 남기지 않고 마지막 위치 1개만 암호화해 저장해요.'));
    content.replaceChildren(...parts);
  }

  await refresh();
  if (inviteRefValue && !disposed) await lookUp(inviteRefValue);
  return {dispose() { disposed = true; clearTimeout(sosTimer); for (const timer of timers) clearTimeout(timer); timers.clear(); }};
}
