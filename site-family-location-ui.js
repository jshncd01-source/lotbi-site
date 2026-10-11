// FAMILY-LOCATION-01 「우리 가족 위치」 — 안심케어 → 가족 위치 (Desktop and Mobile Web).
//
// Guardians see each person's last time (large), battery right under the name, the place in
// words with an honest accuracy, and the reason a location stopped; they can ask for a fresh
// location, run 위치 상태 점검, open a map app or 로드뷰, and turn an SOS into a 실종 신고. The
// owner invites (link + 6-digit code), approves a second guardian, removes, and sets alerts.
// A person who shares sees who sees them, recent checks, pause, and [원치 않는 추적] — sending
// itself happens on the Android app; the web only sends "지금 내 위치 한 번" and SOS.
// 도착/출발 (기획서 9): a guardian sets places for a person (name, kind, 100-300 m around that
// person's current place or the guardian's own position); the person's phone decides, the person
// sees every place set for them, and doubtful moments are not told.
// Not here: hidden modes, location history, ads. The map SDK stays off until NAVER Maps keys exist.
import {
  FAMILY_PRIVACY_NOTICE, acceptFamilyInvite, approveFamilyGuardian, closeFamilySos, createFamilyInvite, createFamilyPlace, createFamilyRequest,
  declineFamilyInvite, deleteFamilyPlace, endFamilyMember, familyAccuracyText, familyErrorMessage, familyHiddenText,
  familyInviteRef, familyMapLinks, familyPlaceCenterFromFix, familyPresenceText, familySosMissingReport, getFamilyOverview, getFamilyRequest,
  getFamilyStatusCheck, listFamilyPlaces, pauseFamilySharing, previewFamilyInvite, putFamilyAlertSettings, reconfirmFamilySharing,
  reportFamilyTracking, resumeFamilySharing, revokeFamilyInvite, sendFamilyLocationOnce, sendFamilySos, updateFamilyPlace,
} from './site-family-location.js?v=aset-823fb9fb63c8';
import {resolveSharedBrowserCurrentLocation} from './site-current-location.js?v=aset-823fb9fb63c8';
import {readDefaultMapProvider} from './site-location-preference.js?v=aset-823fb9fb63c8';
import {shareWithKakaoTalk} from './site-kakao-share.js?v=aset-823fb9fb63c8';
import {takeFamilyInviteIntent} from './site-route.js?v=aset-823fb9fb63c8';

const SHARER_RELATIONS = Object.freeze([['CHILD', '자녀'], ['PARENT', '부모님'], ['SPOUSE', '배우자'], ['FAMILY', '가족']]);
const RELATION_LABEL = Object.freeze({CHILD: '자녀', PARENT: '부모님', SPOUSE: '배우자', FAMILY: '가족', GUARDIAN: '함께 보는 보호자', OWNER: '가족 주인'});
const PAUSE_LABEL = Object.freeze({HOUR: '1시간 멈추기', TODAY: '오늘 멈추기', UNTIL_RESUME: '다시 켤 때까지 멈추기'});
const KIND_LABEL = Object.freeze({STALE: '위치 멈춤', BATTERY: '배터리 부족', PAUSE: '잠시 멈춤', PLACE: '장소 도착·출발'});
const PLACE_KINDS = Object.freeze([['HOME', '집'], ['SCHOOL', '학교'], ['ACADEMY', '학원'], ['OTHER', '기타']]);
const PLACE_RADII = Object.freeze([100, 150, 200, 300]);
const POLL_MS = 3000;
const POLL_LIMIT_MS = 10 * 60_000;

const el = (tag, className = '', text = '') => { const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node; };
const clock = value => { const date = new Date(value || ''); return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit', hour12: false}); };
function button(label, onClick, {primary = false, danger = false, testId = ''} = {}) {
  const node = el('button', `site-button family-loc-button${primary ? ' family-loc-primary' : ''}${danger ? ' family-loc-danger' : ''}`, label);
  node.type = 'button';
  if (testId) node.dataset.familyAction = testId;
  node.addEventListener('click', onClick);
  return node;
}
function link(label, href) {
  const node = el('a', 'site-button family-loc-button', label);
  node.href = href; node.target = '_blank'; node.rel = 'noopener noreferrer';
  return node;
}

/**
 * @param {{sessionToken: string, root: HTMLElement, onMissingReport?: (prefill: {lastSeenAt: string, lastSeenSummary: string}) => void}} options
 */
export async function mountFamilyLocation({sessionToken, root, onMissingReport} = {}) {
  const surface = el('div', 'family-loc-surface'); surface.dataset.familyLocationSurface = '';
  root.replaceChildren(surface);
  const notice = el('p', 'family-loc-privacy', FAMILY_PRIVACY_NOTICE);
  const status = el('p', 'family-loc-status'); status.setAttribute('role', 'status');
  const content = el('div', 'family-loc-content');
  surface.append(notice, status, content);
  if (!sessionToken) { content.append(el('p', 'family-loc-empty', '로그인하면 가족 위치를 사용할 수 있습니다.')); return {}; }

  let disposed = false;
  let busy = false;
  let overview = null;
  let invitePreview = null;
  let inviteRefValue = takeFamilyInviteIntent();
  let createdInvite = null;
  let sosArmed = false;
  let sosTimer = 0;
  // Forms survive re-renders (a pending 지금 위치 request redraws every 3 s): what a person is
  // typing is never wiped. Each is rebuilt only when what it shows changes.
  let inviteNode = null;
  let acceptNode = null; let acceptKey = '';
  let settingsNode = null; let settingsKey = '';
  const openPlaces = new Set();        // member ids whose 장소 알림 panel is open
  const placeLists = new Map();        // member id -> Core's list (places, limit, used, plan_allows, suggestions)
  const placePanels = new Map();       // member id -> {node, key}: rebuilt only when what it shows changes
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
    try { overview = await getFamilyOverview(sessionToken); }
    catch (error) {
      overview = null;
      say(error?.code === 'FAMILY_LOCATION_NOT_ENABLED' ? '가족 위치는 준비 중이에요.' : '가족 위치를 불러오지 못했어요.', true);
    }
    if (!disposed) render();
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

  // ── a guardian's view of one person ────────────────────────────────────────
  function memberCard(family, member) {
    const card = el('article', 'family-loc-card'); card.dataset.familyMember = member.id;
    const head = el('div', 'family-loc-card-head');
    head.append(el('strong', 'family-loc-name', member.name), el('span', 'family-loc-presence', familyPresenceText(member)));
    card.append(head);
    if (member.battery) card.append(el('p', 'family-loc-battery', `배터리 ${member.battery.percent}%${member.battery.charging ? ' · 충전 중' : ''}`));
    if (member.location) {
      card.append(el('p', 'family-loc-place', `${member.location.area ? `${member.location.area} 근처` : '위치 받음'} · ${familyAccuracyText(member.location)} · ${clock(member.location.captured_at)}`));
    } else if (familyHiddenText(member.location_hidden_reason)) {
      card.append(el('p', 'family-loc-note', familyHiddenText(member.location_hidden_reason)));
    }
    if (member.stop_reason && member.stop_reason.code !== 'OK' && member.presence !== 'LIVE') {
      card.append(el('p', 'family-loc-reason', member.stop_reason.text));
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
    const actions = el('div', 'family-loc-actions');
    const remaining = family.now_requests_left_today;
    actions.append(
      button(remaining == null ? '지금 위치 요청' : `지금 위치 요청 (오늘 ${remaining}회)`, () => { void ask(member, 'NOW'); }, {primary: true, testId: 'now'}),
      button('위치 상태 점검', () => { void checkNow(member); }, {testId: 'check'}),
    );
    const links = familyMapLinks(member, readDefaultMapProvider());
    if (links) actions.append(link('지도에서 보기', links.map), link('로드뷰', links.roadview));
    if (placesSupported()) {
      const toggle = button(openPlaces.has(member.id) ? '장소 알림 닫기' : '장소 알림', () => { void togglePlaces(member); }, {testId: 'places'});
      toggle.setAttribute('aria-expanded', String(openPlaces.has(member.id)));
      actions.append(toggle);
    }
    if (family.role === 'OWNER') actions.append(button('연결 해제', () => { void removeMember(member); }, {danger: true, testId: 'remove'}));
    card.append(actions);
    if (openPlaces.has(member.id)) card.append(placesPanel(member));
    return card;
  }

  // ── 도착/출발 places for one person ───────────────────────────────────────
  // Core lists PLACE among the alert kinds once it has places; before that nothing is shown.
  const placesSupported = () => (overview?.settings?.kinds || []).includes('PLACE');

  async function loadPlaces(member) {
    // A read never waits for (or blocks) a running action.
    try { placeLists.set(member.id, await listFamilyPlaces(sessionToken, member.id)); }
    catch (error) { say(familyErrorMessage(error, '장소를 불러오지 못했어요.'), true); }
    if (!disposed) render();
  }

  async function togglePlaces(member) {
    if (openPlaces.has(member.id)) { openPlaces.delete(member.id); render(); return; }
    openPlaces.add(member.id); render();
    await loadPlaces(member);
  }

  function placesPanel(member) {
    const list = placeLists.get(member.id) || null;
    const key = JSON.stringify([member.name, list]);
    const cached = placePanels.get(member.id);
    if (cached && cached.key === key) return cached.node;
    const panel = el('div', 'family-loc-places'); panel.dataset.familyPlaces = member.id;
    panel.append(el('strong', 'family-loc-name', '도착·출발 알림 장소'),
      el('p', 'family-loc-note', `${member.name} 폰이 장소 안팎을 스스로 판단하고, 3분 넘게 머물러야 알려요. 위치가 애매하면 알리지 않아요. 등록한 장소는 ${member.name} 폰에도 보여요.`));
    if (!list) { panel.append(el('p', 'family-loc-note', '장소를 불러오는 중…')); placePanels.set(member.id, {node: panel, key}); return panel; }
    if (!list.plan_allows) panel.append(el('p', 'family-loc-note', '도착·출발 알림은 Plus 요금제부터 쓸 수 있어요.'));
    else panel.append(el('p', 'family-loc-note', `장소 ${list.used}/${list.limit}곳 (가족 전체)`));
    for (const place of list.places || []) panel.append(placeRow(member, place));
    if (list.plan_allows && list.used < list.limit) panel.append(placeForm(member, list));
    placePanels.set(member.id, {node: panel, key});
    return panel;
  }

  function placeRow(member, place) {
    const row = el('div', 'family-loc-family-row family-loc-place-row'); row.dataset.familyPlace = place.id;
    row.append(el('span', 'family-loc-place-name', `${place.name} (${place.kind_label}) · 반경 ${place.radius_m}m · ${place.created_by} 님이 등록`));
    const toggles = el('div', 'family-loc-settings-row');
    const flag = (field, label) => {
      const wrap = el('label', 'family-loc-check-label'); const box = el('input'); box.type = 'checkbox'; box.checked = place[field] === true;
      box.dataset.familyPlaceField = field;
      box.addEventListener('change', () => { void changePlace(member, place, {[field]: box.checked}); });
      wrap.append(box, el('span', '', label)); toggles.append(wrap);
    };
    flag('arrive', '도착 알림'); flag('depart', '출발 알림');
    if (place.kind === 'SCHOOL') flag('holiday_off', place.school_linked ? '쉬는 날 끄기 (주말·공휴일·학사일정)' : '쉬는 날 끄기 (주말·공휴일)');
    row.append(toggles, button('장소 지우기', () => { void removePlace(member, place); }, {danger: true, testId: 'place-delete'}));
    return row;
  }

  function placeForm(member, list) {
    const form = el('form', 'family-loc-place-form'); form.dataset.familyPlaceForm = member.id;
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
    const centers = el('div', 'family-loc-settings-row'); centers.setAttribute('role', 'radiogroup'); centers.setAttribute('aria-label', '장소 위치');
    const radio = (value, label, checked) => {
      const wrap = el('label', 'family-loc-check-label'); const input = el('input'); input.type = 'radio'; input.name = `family-place-center-${member.id}`;
      input.value = value; input.checked = checked; wrap.append(input, el('span', '', label)); centers.append(wrap);
    };
    radio('MEMBER_LOCATION', `${member.name} 지금 위치로`, Boolean(member.location));
    radio('MY_LOCATION', '내 지금 위치로', !member.location);
    const flags = el('div', 'family-loc-settings-row');
    const check = label => { const wrap = el('label', 'family-loc-check-label'); const box = el('input'); box.type = 'checkbox'; box.checked = true; wrap.append(box, el('span', '', label)); flags.append(wrap); return box; };
    const arrive = check('도착 알림'); const depart = check('출발 알림');
    const submit = el('button', 'site-button family-loc-button family-loc-primary', '장소 추가'); submit.type = 'submit';
    form.append(suggestion, name, kind, radius, centers, flags, submit);
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

  // ── SOS ────────────────────────────────────────────────────────────────────
  function sosCard(item) {
    const card = el('article', 'family-loc-card family-loc-sos'); card.dataset.familySos = item.id; card.setAttribute('role', 'alert');
    card.append(el('strong', 'family-loc-name', `SOS · ${item.name} (${clock(item.created_at)})`));
    if (item.location) card.append(el('p', 'family-loc-place', `${item.location.area ? `${item.location.area} 근처` : '위치 받음'} · ${familyAccuracyText(item.location)}`));
    if (item.battery) card.append(el('p', 'family-loc-battery', `배터리 ${item.battery.percent}%`));
    const actions = el('div', 'family-loc-actions');
    const links = familyMapLinks(item, readDefaultMapProvider());
    if (links) actions.append(link('지도에서 보기', links.map), link('로드뷰', links.roadview));
    if (!item.mine) {
      actions.append(
        button('실종 신고로 이어가기', () => { void continueToMissing(item); }, {primary: true, testId: 'sos-missing'}),
        button('찾았어요 · 종료', () => { void closeSos(item); }, {testId: 'sos-close'}),
      );
    }
    const call = link('112 전화', 'tel:112'); call.removeAttribute('target');
    actions.append(call);
    card.append(actions);
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

  // ── my own sharing ─────────────────────────────────────────────────────────
  function sharingSection(sharing) {
    const box = el('section', 'family-loc-card family-loc-sharing'); box.dataset.familySharing = '';
    box.append(el('strong', 'family-loc-indicator', sharing.indicator || '가족에게 위치 공유 중'));
    box.append(el('p', 'family-loc-note', `나를 보는 사람: ${(sharing.viewers || []).map(item => item.name).join(', ') || '없음'}`));
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
    box.append(el('p', 'family-loc-note', '위치는 LOTBI 안드로이드 앱이 보내요. 앱에서 같은 계정으로 로그인하고 「가족 위치」에서 위치 보내기를 켜 주세요.'));
    const sos = button(sosArmed ? '한 번 더 누르면 가족에게 알려요' : 'SOS 도와주세요', () => { void sendSos(); }, {danger: true, testId: 'sos'});
    sos.classList.add('family-loc-sos-button');
    const actions = el('div', 'family-loc-actions');
    actions.append(button('지금 내 위치 한 번 보내기', () => { void sendOnce(); }, {testId: 'send-once'}));
    if (sharing.paused) actions.append(button('위치 공유 다시 켜기', () => { void resume(); }, {primary: true, testId: 'resume'}));
    else for (const option of sharing.pause_options || []) actions.append(button(PAUSE_LABEL[option] || option, () => { void pause(option); }, {testId: `pause-${option}`}));
    box.append(sos, actions);
    if (sharing.under14) box.append(el('p', 'family-loc-note', '잠시 멈추면 보호자에게 바로 알려져요.'));
    if (sharing.reconfirm_due_at && new Date(sharing.reconfirm_due_at).getTime() <= Date.now()) {
      box.append(button('계속 공유할게요', () => { void act(() => reconfirmFamilySharing(sessionToken), '확인하지 못했어요.').then(refresh); }));
    }
    for (const family of sharing.families || []) {
      const row = el('div', 'family-loc-family-row');
      row.append(el('span', '', `${family.owner} 가족 · ${RELATION_LABEL[family.relation] || family.relation}`));
      const rowActions = el('div', 'family-loc-actions');
      if (sharing.can_end) rowActions.append(button('공유 끄기', () => { void leave(family.member_id); }, {testId: 'leave'}));
      rowActions.append(button('원치 않는 추적을 당하고 있어요', () => { void reportTracking(family.member_id); }, {danger: true, testId: 'report'}));
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

  // ── the owner's tools ──────────────────────────────────────────────────────
  function ownerTools(family) {
    const box = el('div', 'family-loc-owner');
    for (const pending of family.pending_guardians || []) {
      const row = el('div', 'family-loc-family-row'); row.dataset.familyPendingGuardian = pending.id;
      row.append(el('span', '', `${pending.name} · 함께 보는 보호자로 들어오려고 해요. 맞는 사람인가요?`));
      const actions = el('div', 'family-loc-actions');
      actions.append(
        button('맞아요', () => { void act(() => approveFamilyGuardian(sessionToken, pending.id, true), '승인하지 못했어요.').then(refresh); }, {primary: true, testId: 'approve'}),
        button('아니에요', () => { void act(() => approveFamilyGuardian(sessionToken, pending.id, false), '거절하지 못했어요.').then(refresh); }, {testId: 'reject'}),
      );
      row.append(actions); box.append(row);
    }
    for (const invite of family.invites || []) {
      const row = el('div', 'family-loc-family-row');
      row.append(el('span', '', `초대 대기 · ${invite.label || RELATION_LABEL[invite.relation] || ''} (${clock(invite.expires_at)}까지)`));
      row.append(button('초대 취소', () => { void act(() => revokeFamilyInvite(sessionToken, invite.id), '초대를 취소하지 못했어요.').then(refresh); }, {testId: 'revoke'}));
      box.append(row);
    }
    return box;
  }

  function inviteForm() {
    const form = el('form', 'family-loc-card family-loc-invite'); form.dataset.familyInviteForm = '';
    form.append(el('strong', 'family-loc-name', '가족 초대하기'));
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
    const submit = el('button', 'site-button family-loc-button family-loc-primary', '초대 만들기'); submit.type = 'submit';
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
    card.append(el('strong', 'family-loc-name', '초대를 보냈어요'));
    const code = el('p', 'family-loc-code', invite.code); code.setAttribute('aria-label', `초대 코드 ${invite.code.split('').join(' ')}`);
    card.append(el('p', 'family-loc-note', `상대 폰의 LOTBI에서 이 코드를 넣어 주세요(${clock(invite.invite.code_expires_at)}까지, 1번만).`), code,
      el('p', 'family-loc-note', `또는 링크(${clock(invite.invite.expires_at)}까지)를 보내세요. 상대가 직접 수락해야 연결돼요.`));
    const actions = el('div', 'family-loc-actions');
    actions.append(
      button('카카오톡으로 보내기', () => { void shareWithKakaoTalk({text: 'LOTBI 가족 위치 초대예요. 링크를 열고 수락해 주세요.', url: invite.invite_url}).catch(() => say('카카오톡을 열지 못했어요. 링크를 복사해 보내 주세요.', true)); }, {testId: 'share-kakao'}),
      button('링크 복사', () => { void globalThis.navigator?.clipboard?.writeText(invite.invite_url).then(() => say('링크를 복사했어요.'), () => say('복사하지 못했어요.', true)); }, {testId: 'copy-link'}),
      button('닫기', () => { createdInvite = null; render(); }),
    );
    card.append(actions);
    return card;
  }

  // ── accepting an invitation ────────────────────────────────────────────────
  function acceptSection() {
    const box = el('section', 'family-loc-card family-loc-accept'); box.dataset.familyAccept = '';
    box.append(el('strong', 'family-loc-name', '초대받았어요'));
    if (invitePreview) {
      const preview = invitePreview;
      box.append(el('p', '', `${preview.inviter.name} 님이 ${preview.invite.role === 'GUARDIAN' ? '함께 가족 위치를 보는 보호자로' : '내 위치를 보려고'} 초대했어요.`));
      if (preview.invite.under14) box.append(el('p', 'family-loc-note', '보호자가 만 14세 미만 아이로 초대했고, 법정대리인 동의를 기록했어요.'));
      if (preview.consent) box.append(el('p', 'family-loc-consent-text', preview.consent.text));
      const actions = el('div', 'family-loc-actions');
      actions.append(
        button('허락', () => { void answer(true); }, {primary: true, testId: 'accept'}),
        button('거절', () => { void answer(false); }, {testId: 'decline'}),
      );
      box.append(actions);
      return box;
    }
    const input = el('input'); input.placeholder = '초대 코드 6자리 또는 초대 링크'; input.setAttribute('aria-label', '초대 코드 또는 링크');
    box.append(input, button('초대 확인', () => { void lookUp(input.value); }, {testId: 'lookup'}));
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
    invitePreview = null; inviteRefValue = null;
    say(accept ? (preview.invite.role === 'GUARDIAN' ? '가족 주인이 확인하면 가족 위치를 볼 수 있어요.' : '연결됐어요. LOTBI 안드로이드 앱에서 위치 보내기를 켜 주세요.') : '초대를 거절했어요.');
    await refresh();
  }

  // ── alerts ─────────────────────────────────────────────────────────────────
  function settingsSection(families) {
    const settings = overview.settings || {};
    const form = el('form', 'family-loc-card family-loc-settings'); form.dataset.familySettings = '';
    // The kinds Core knows (an older Core has no PLACE and would refuse it).
    const kinds = (Array.isArray(settings.kinds) ? settings.kinds : ['STALE', 'BATTERY', 'PAUSE']).filter(kind => KIND_LABEL[kind]);
    form.append(el('strong', 'family-loc-name', '알림 설정'), el('p', 'family-loc-note', kinds.includes('PLACE')
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
    const row = el('div', 'family-loc-settings-row'); row.append(el('span', '', '조용한 시간'), start, el('span', '', '~'), end);
    form.append(row, stale);
    const toggles = [];
    for (const family of families) {
      for (const member of family.members.filter(item => item.role === 'SHARER')) {
        const line = el('div', 'family-loc-settings-row'); line.append(el('span', '', member.name));
        for (const kind of kinds) {
          const label = el('label', 'family-loc-check-label'); const box = el('input'); box.type = 'checkbox';
          box.checked = settings.member_kinds?.[member.id]?.[kind] !== false;
          label.append(box, el('span', '', KIND_LABEL[kind])); line.append(label);
          toggles.push({memberId: member.id, kind, box});
        }
        form.append(line);
      }
    }
    const save = el('button', 'site-button family-loc-button', '알림 설정 저장'); save.type = 'submit';
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
  function render() {
    if (disposed) return;
    const parts = [];
    const acceptState = invitePreview ? `preview:${invitePreview.invite.id}` : 'input';
    if (!acceptNode || acceptKey !== acceptState) { acceptNode = acceptSection(); acceptKey = acceptState; }
    if (!overview) { content.replaceChildren(acceptNode); return; }
    for (const item of overview.sos || []) parts.push(sosCard(item));
    if (overview.sharing?.connected) parts.push(sharingSection(overview.sharing));
    const families = (overview.families || []).filter(family => family.status === 'ACTIVE');
    for (const family of families) {
      const section = el('section', 'family-loc-family'); section.dataset.familyGroup = family.id;
      const plan = family.plan;
      section.append(el('h3', 'family-loc-heading', family.role === 'OWNER' ? '우리 가족' : `${family.owner} 가족`));
      if (plan) section.append(el('p', 'family-loc-note', `요금제 ${plan.code} · 가족 ${plan.people_used}/${plan.people_limit}명${plan.live_map ? '' : ' · 실시간 위치는 Plus부터'}`));
      const sharers = family.members.filter(member => member.role === 'SHARER');
      if (!sharers.length) section.append(el('p', 'family-loc-empty', '아직 연결된 가족이 없어요. 아래에서 초대해 주세요.'));
      for (const member of sharers) section.append(memberCard(family, member));
      const viewers = family.members.filter(member => member.role !== 'SHARER').map(member => member.name);
      if (viewers.length) section.append(el('p', 'family-loc-note', `함께 보는 사람: ${viewers.join(', ')}`));
      if (family.role === 'OWNER') section.append(ownerTools(family));
      parts.push(section);
    }
    for (const family of (overview.families || []).filter(item => item.status === 'PENDING_APPROVAL')) {
      parts.push(el('p', 'family-loc-note', `${family.owner} 님이 확인하면 그 가족의 위치를 볼 수 있어요.`));
    }
    if (createdInvite) parts.push(createdInviteCard(createdInvite));
    // Anyone may start (or add to) their own family; invitations are always the owner's.
    inviteNode ||= inviteForm();
    parts.push(inviteNode, acceptNode);
    if (families.some(family => family.members.some(member => member.role === 'SHARER'))) {
      const key = JSON.stringify([overview.settings || {}, families.map(family => family.members.filter(member => member.role === 'SHARER').map(member => [member.id, member.name]))]);
      if (!settingsNode || settingsKey !== key) { settingsNode = settingsSection(families); settingsKey = key; }
      parts.push(settingsNode);
    }
    parts.push(el('p', 'family-loc-note family-loc-footer', placesSupported()
      ? '위치·가족 화면에는 광고가 없어요. 이동 경로는 남기지 않아요. 마지막 위치 1개만 암호화해 저장하고, 장소 도착·출발은 알림과 하루 보관 기록만 남아요.'
      : '위치·가족 화면에는 광고가 없어요. 이동 기록은 남기지 않고 마지막 위치 1개만 암호화해 저장해요.'));
    content.replaceChildren(...parts);
  }

  await refresh();
  if (inviteRefValue && !disposed) await lookUp(inviteRefValue);
  return {dispose() { disposed = true; clearTimeout(sosTimer); for (const timer of timers) clearTimeout(timer); timers.clear(); }};
}
