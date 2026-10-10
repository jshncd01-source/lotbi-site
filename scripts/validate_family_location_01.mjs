// FAMILY-LOCATION-01 「우리 가족 위치」 Site (site-family-location.js, site-family-location-ui.js,
// the 안심케어 「가족 위치」 tab in site-consumer-sections.js, the invitation link in site-route.js).
//
// Source rules: the Core surface only, no storage of coordinates, the browser position only through
// site-current-location.js, the privacy notice says only what is true, the invitation token never
// stays in the address. Browser (synthetic Core answers, no network leaves the page): a guardian sees
// the last time next to the name, the battery under it, the place in words with its accuracy, the
// stop reason, map and 로드뷰 links; 지금 위치 요청 is answered; 위치 상태 점검 shows one sentence and
// the checklist; the owner approves a second guardian and invites a child under 14 only with the
// legal-guardian consent; an SOS turns into a 실종 신고 draft; a sharer sees who sees them, pauses an
// hour and can report unwanted tracking; an invitation link is previewed and accepted with the share
// consent; a switched-off Core shows "준비 중"; the 가족 위치 tab exists only when Core answers.
// 도착/출발 places: shown only when Core lists the PLACE alert kind; a guardian adds a place around
// the person's current place (no coordinate leaves the page for it) or picks a 내 아이 school, turns
// arrival/departure/days-off on and off, deletes it; typing survives the 3-second redraws; the
// person sees every place set for them; the alert settings gain 장소 도착·출발.
// Layout at 360 px, light and dark. All data is synthetic.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runFixturePage} from './lib/headless-fixture-result.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');

// ── source rules ──────────────────────────────────────────────────────────────
const client = read('site-family-location.js');
const ui = read('site-family-location-ui.js');
const route = read('site-route.js');
const sections = read('site-consumer-sections.js');
const conversation = read('site-conversation.js');
const html = read('index.html');
assert.match(client, /\$\{CORE_ORIGIN\}\/v2\/family-location\$\{path\}/u, 'one Core surface');
assert.match(client, /credentials: 'omit'/u);
for (const source of [client, ui]) {
  assert.doesNotMatch(source, /localStorage|indexedDB|document\.cookie\s*=|console\.(log|info|debug)/u, 'nothing kept or logged');
  assert.doesNotMatch(source, /navigator\s*\.\s*geolocation|getCurrentPosition|watchPosition/u, 'the position only through site-current-location.js');
}
assert.match(ui, /resolveSharedBrowserCurrentLocation\(\{allowPrompt: true\}\)/u, 'the web sends a position only after a press');
assert.match(client, /LOTBI 직원이 가족 위치를 볼 수 있는 화면은 없어요\. 위치는 암호화해 보관하고 광고·판매·AI 학습에 쓰지 않아요\./u);
assert.doesNotMatch(client + ui, /직원도 가족 위치를 볼 수 없/u, 'no overstated privacy claim');
assert.match(route, /FAMILY_INVITE_INTENT_RE = \/\^#family-invite=\(\[A-Za-z0-9_-\]\{24,64\}\)\$\/u/u);
assert.match(route, /historyRef\.replaceState\(historyRef\.state, '', `\$\{locationRef\.pathname\}\$\{locationRef\.search\}\$\{siteRouteHash\('care'\)\}`\)/u, 'the token leaves the address');
assert.match(sections, /if \(authenticated && typeof mountFamily === 'function' && typeof checkFamily === 'function'\)/u, 'the tab waits for Core');
assert.match(conversation, /checkFamily: async \(\) => \{/u);
assert.match(conversation, /care: \(\) => openConsumerSection\('care', \{careTab: hasFamilyInviteIntent\(\) \? 'family' : 'people'\}\)/u);
assert.match(html, /<link rel="stylesheet" href="site-family-location\.css\?v=aset-[0-9a-f]{12}" \/>/u);
// A place centre from this browser is the guardian's own position, asked for only on a press.
assert.match(ui, /const fix = await currentFix\(\)\.catch\(\(\) => null\);\r?\n\s+if \(!fix\) \{ say\('내 현재 위치를 확인하지 못했어요\./u);
assert.match(ui, /center = familyPlaceCenterFromFix\(fix\);/u);
assert.match(ui, /const placesSupported = \(\) => \(overview\?\.settings\?\.kinds \|\| \[\]\)\.includes\('PLACE'\);/u, 'places only when Core has them');

// ── browser ───────────────────────────────────────────────────────────────────
const head = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/site-theme-tokens.css"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/site-consumer-design.css"><link rel="stylesheet" href="/site-safecare.css"><link rel="stylesheet" href="/site-family-location.css"><style>body{margin:0;padding:12px;background:var(--lotbi-bg-primary,#fff)}#host{max-width:720px;margin:auto}</style></head>';

const shared = `
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const wait = async (predicate, label) => { for (let i = 0; i < 1200; i += 1) { const value = await predicate(); if (value) return value; await sleep(20); } throw new Error('timed out: ' + label + ' — calls ' + JSON.stringify((typeof calls === 'undefined' ? [] : calls).slice(-6).map(call => call.key)) + ' — ' + text().slice(0, 300)); };
const host = document.getElementById('host');
const text = () => host.textContent.replace(/\\s+/gu, ' ');
const q = selector => host.querySelector(selector);
const LAT = 35.8121, LNG = 127.1052;
const member = (extra = {}) => ({id: 'flm_0123456789abcdef0123', name: '은율', role: 'SHARER', relation: 'CHILD', status: 'ACTIVE', under14: true,
  presence: 'LIVE', last_seen_at: new Date(Date.now() - 180000).toISOString(), minutes_ago: 3, paused_until: null, battery: {percent: 64, charging: false},
  stop_reason: {code: 'OK', text: '정상이에요.', action: null, action_label: null},
  location: {latitude: LAT, longitude: LNG, accuracy_m: 12, captured_at: new Date(Date.now() - 180000).toISOString(), area: '전주시 완산구 효자동1가', precise: true},
  location_hidden_reason: null, pending_request: null, ...extra});
const consent = {share: {key: 'FAMILY_LOCATION_SHARE', version: 'family-location-share-2026-10-10', text: '가족에게 내 위치를 공유합니다. (합성)', sha256: 'a'.repeat(64)},
  guardian_under14: {key: 'FAMILY_LOCATION_GUARDIAN_UNDER14', version: 'family-location-guardian-under14-2026-10-10', text: '법정대리인 동의 (합성)', sha256: 'b'.repeat(64)}};
const noSharing = {sharing: false, connected: false, paused: false, viewers: [], families: [], recent_checks: [], pause_options: []};
const calls = [];
const otherNetwork = [];
let routes = {};
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const url = String(input?.url || input);
  if (!url.startsWith('https://api.lotbiai.com/v2/family-location')) { otherNetwork.push(url); return nativeFetch(input, init); }
  const key = (init.method || 'GET') + ' ' + url.slice('https://api.lotbiai.com/v2/family-location'.length);
  const body = init.body ? JSON.parse(init.body) : undefined;
  calls.push({key, body, auth: (init.headers || {}).Authorization, credentials: init.credentials});
  const handler = Object.entries(routes).find(([pattern]) => key === pattern || (pattern.endsWith('*') && key.startsWith(pattern.slice(0, -1))));
  const [status, payload] = handler ? handler[1](body, key) : [404, {detail: {code: 'NOT_IN_FIXTURE'}}];
  return new Response(JSON.stringify(payload), {status, headers: {'content-type': 'application/json'}});
};
// Request polling waits 3 s and the SOS arm 8 s; run them at once here.
const realSetTimeout = window.setTimeout.bind(window);
window.setTimeout = (fn, ms, ...rest) => realSetTimeout(fn, ms === 3000 ? 5 : ms, ...rest);
window.confirm = () => true;
`;

const flow = `${head}<body><div aria-labelledby="care-title"><main id="host"></main></div><script type="module">
${shared}
const results = {};
try {
  const uiModule = await import('/site-family-location-ui.js?test=family-01');
  const sectionsModule = await import('/site-consumer-sections.js?test=family-01');
  // Every module this feature touched must load in a browser (a stray quote once broke 사람 안심케어).
  for (const name of ['site-person-ui.js', 'site-route.js', 'site-family-location.js']) await import('/' + name + '?test=family-01-load');
  results.modulesLoad = true;

  // 1. a switched-off Core
  routes = {'GET /overview': () => [404, {detail: {code: 'FAMILY_LOCATION_NOT_ENABLED'}}]};
  let mounted = await uiModule.mountFamilyLocation({sessionToken: 'synthetic-session', root: host});
  results.notEnabled = text().includes('가족 위치는 준비 중이에요.');
  mounted.dispose?.();

  // 2. the owner's family
  const grandpa = member({id: 'flm_1111111111abcdef0123', name: '할아버지', relation: 'PARENT', under14: false, presence: 'STALE', minutes_ago: 47,
    battery: {percent: 31, charging: false}, location: null, location_hidden_reason: 'NO_LOCATION',
    stop_reason: {code: 'BATTERY_SAVER', text: '절전 기능이 LOTBI를 끈 것 같아요.', action: 'OPEN_BATTERY_OPTIMIZATION', action_label: '배터리 절약 예외로 두기'}});
  let overview = {enabled: true, privacy_notice: 'LOTBI 직원이 가족 위치를 볼 수 있는 화면은 없어요. (Core)', consent, sharing: noSharing, settings: {quiet_start_hour: 23, quiet_end_hour: 6, stale_minutes: 30, member_kinds: {}},
    sos: [{id: 'fls_0123456789abcdef0123', status: 'ACTIVE', created_at: new Date().toISOString(), mine: false, name: '은율',
      location: {latitude: LAT, longitude: LNG, accuracy_m: 20, captured_at: new Date().toISOString(), area: '전주시 완산구 효자동1가', precise: true}, battery: {percent: 9, charging: false}, summary: null}],
    families: [{id: 'flg_0123456789abcdef0123', role: 'OWNER', status: 'ACTIVE', owner: '김엄마', now_requests_left_today: null,
      plan: {code: 'PLUS', people_limit: 4, people_used: 3, live_map: true, now_requests_per_day: null},
      members: [member(), grandpa, {id: 'flm_2222222222abcdef0123', name: '박아빠', role: 'GUARDIAN', relation: 'GUARDIAN', status: 'ACTIVE', under14: false}],
      pending_guardians: [{id: 'flm_3333333333abcdef0123', name: '이*모', joined_at: new Date().toISOString()}],
      invites: [{id: 'fli_0123456789abcdef0123', role: 'SHARER', relation: 'FAMILY', label: '고모', under14: false, status: 'OPEN', expires_at: new Date(Date.now() + 86400000).toISOString(), code_expires_at: new Date(Date.now() + 600000).toISOString()}]}]};
  let polls = 0;
  const prefills = [];
  routes = {
    'GET /overview': () => [200, overview],
    'POST /members/flm_0123456789abcdef0123/requests': body => [200, {request: {id: 'flr_0123456789abcdef0123', kind: body.kind, status: 'PENDING', wake: 'PUSH_OFF', failure: null, member: null, check: null}}],
    'GET /requests/flr_0123456789abcdef0123': () => { polls += 1; return [200, {request: {id: 'flr_0123456789abcdef0123', kind: 'NOW', status: polls < 2 ? 'PENDING' : 'ANSWERED', wake: 'PUSH_OFF', failure: null, member: member(), check: null}}]; },
    'GET /members/flm_1111111111abcdef0123/status-check': () => [200, {check: {checked_at: new Date().toISOString(), summary: '원인: 절전 기능이 LOTBI를 끈 것 같아요. → 할아버지 폰에서 [배터리 절약 예외로 두기]',
      cause: {code: 'BATTERY_SAVER', text: '절전 기능이 LOTBI를 끈 것 같아요.', action: 'OPEN_BATTERY_OPTIMIZATION', action_label: '배터리 절약 예외로 두기'},
      items: [{key: 'PERMISSION_ALWAYS', label: "위치 권한 '항상 허용'", ok: true}, {key: 'BATTERY_OPTIMIZATION', label: '배터리 절약 예외', ok: false}]}}],
    'POST /members/flm_1111111111abcdef0123/requests': body => [200, {request: {id: 'flr_1111111111abcdef0123', kind: body.kind, status: 'PENDING', wake: 'PUSH_OFF', failure: null, member: null, check: null}}],
    'GET /requests/flr_1111111111abcdef0123': () => [200, {request: {id: 'flr_1111111111abcdef0123', kind: 'CHECK', status: 'PENDING', wake: 'PUSH_OFF', failure: null, member: null, check: null}}],
    'POST /members/flm_3333333333abcdef0123/approve': () => [200, {approved: true}],
    'POST /sos/fls_0123456789abcdef0123/missing-report': () => [200, {prefill: {last_seen_at: new Date().toISOString(), last_seen_summary: '전주시 완산구 효자동1가 근처 (가족 위치 SOS 10월 10일 16:02)'}, emergency: {police: '112', missing_child: '182'}}],
    'POST /invites': body => [200, {invite: {id: 'fli_9999999999abcdef0123', role: body.role, relation: body.relation, label: body.label || null, under14: body.under14 === true, status: 'OPEN',
      expires_at: new Date(Date.now() + 86400000).toISOString(), code_expires_at: new Date(Date.now() + 600000).toISOString()},
      invite_url: 'https://lotbiai.com/#family-invite=' + 'S'.repeat(32), code: '482913', plan: {code: 'PLUS', people_limit: 4, people_used: 4}}],
  };
  mounted = await uiModule.mountFamilyLocation({sessionToken: 'synthetic-session', root: host, onMissingReport: prefill => prefills.push(prefill)});
  const card = await wait(() => q('[data-family-member="flm_0123456789abcdef0123"]'), 'child card');
  results.privacy = q('.family-loc-privacy').textContent.includes('볼 수 있는 화면은 없어요');
  results.lastTimeAndBattery = card.querySelector('.family-loc-presence').textContent === '3분 전' && card.querySelector('.family-loc-battery').textContent === '배터리 64%'
    && card.querySelector('.family-loc-name').nextElementSibling === card.querySelector('.family-loc-presence');
  results.place = card.querySelector('.family-loc-place').textContent.startsWith('전주시 완산구 효자동1가 근처 · 약 12m 범위');
  const links = [...card.querySelectorAll('a')].map(a => a.href);
  results.mapLinks = links.includes('https://map.kakao.com/link/map/%EC%9D%80%EC%9C%A8,35.812100,127.105200') && links.includes('https://map.kakao.com/link/roadview/35.812100,127.105200');
  const grandpaCard = q('[data-family-member="flm_1111111111abcdef0123"]');
  results.stopReason = grandpaCard.querySelector('.family-loc-reason')?.textContent === '절전 기능이 LOTBI를 끈 것 같아요.'
    && grandpaCard.textContent.includes('47분 전 마지막 확인') && !grandpaCard.querySelector('a[href*="map.kakao"]');
  results.guardianListed = text().includes('함께 보는 사람: 박아빠');
  // An older Core (no PLACE kind) shows no places and no 장소 alert toggle.
  results.placesHiddenOnOldCore = !q('[data-family-action="places"]') && !text().includes('장소 도착·출발');
  card.querySelector('[data-family-action="now"]').click();
  await wait(() => card.isConnected ? null : q('[data-family-member="flm_0123456789abcdef0123"] [data-family-request-status="ANSWERED"]'), 'answered');
  results.nowAnswered = calls.some(call => call.key === 'POST /members/flm_0123456789abcdef0123/requests' && call.body.kind === 'NOW') && polls >= 2
    && q('[data-family-member="flm_0123456789abcdef0123"] .family-loc-request').textContent === '새 위치를 받았어요.';
  q('[data-family-member="flm_1111111111abcdef0123"] [data-family-action="check"]').click();
  const check = await wait(() => q('[data-family-member="flm_1111111111abcdef0123"] [data-family-check="BATTERY_SAVER"]'), 'status check');
  results.statusCheck = check.textContent.includes('→ 할아버지 폰에서 [배터리 절약 예외로 두기]') && check.querySelector('li[data-ok="false"]')?.textContent.includes('배터리 절약 예외')
    && calls.some(call => call.key === 'POST /members/flm_1111111111abcdef0123/requests' && call.body.kind === 'CHECK');
  q('[data-family-pending-guardian] [data-family-action="approve"]').click();
  await wait(() => calls.some(call => call.key === 'POST /members/flm_3333333333abcdef0123/approve'), 'approve');
  // The screen ignores presses while an action runs; wait for the overview it reloads afterwards.
  const approveAt = calls.findIndex(call => call.key === 'POST /members/flm_3333333333abcdef0123/approve');
  await wait(() => calls.slice(approveAt).some(call => call.key === 'GET /overview'), 'reload after approve');
  results.approve = calls.find(call => call.key === 'POST /members/flm_3333333333abcdef0123/approve').body.approve === true;
  await wait(() => q('[data-family-sos] [data-family-action="sos-missing"]'), 'sos card');
  results.sosCard = q('[data-family-sos]').textContent.includes('배터리 9%') && !!q('[data-family-sos] a[href="tel:112"]');
  q('[data-family-sos] [data-family-action="sos-missing"]').click();
  await wait(() => prefills.length, 'missing report');
  results.missingPrefill = prefills[0].lastSeenSummary.startsWith('전주시 완산구 효자동1가 근처');

  // the invitation form: a child under 14 needs the legal-guardian consent
  const form = q('[data-family-invite-form]');
  const [role, label] = [form.querySelector('select'), form.querySelector('input:not([type])')];
  role.value = 'CHILD'; role.dispatchEvent(new Event('change'));
  label.value = '은율';
  const [under14Box, consentBox] = form.querySelectorAll('input[type=checkbox]');
  under14Box.checked = true; under14Box.dispatchEvent(new Event('change'));
  results.consentShownOnlyForUnder14 = !consentBox.closest('label').hidden;
  form.requestSubmit();
  await sleep(50);
  results.noInviteWithoutConsent = !calls.some(call => call.key === 'POST /invites');
  consentBox.checked = true;
  form.requestSubmit();
  const created = await wait(() => q('[data-family-created-invite]'), 'created invite');
  const inviteCall = calls.find(call => call.key === 'POST /invites');
  results.invite = inviteCall.body.role === 'SHARER' && inviteCall.body.relation === 'CHILD' && inviteCall.body.under14 === true
    && inviteCall.body.guardian_consent_version === 'family-location-guardian-under14-2026-10-10' && created.querySelector('.family-loc-code').textContent === '482913'
    && !!created.querySelector('[data-family-action="share-kakao"]');
  results.bearerOnly = calls.every(call => call.auth === 'Bearer synthetic-session' && call.credentials === 'omit');
  mounted.dispose?.();

  // 2b. 도착/출발 places
  const placeRow = {id: 'flp_0123456789abcdef0123', member_id: 'flm_0123456789abcdef0123', name: '학원', kind: 'ACADEMY', kind_label: '학원', radius_m: 150,
    arrive: true, depart: true, holiday_off: false, school_linked: false, created_by: '김엄마', created_at: new Date().toISOString(), center: {latitude: LAT, longitude: LNG}};
  let placeList = {places: [placeRow], limit: 5, used: 1, plan_allows: true,
    suggestions: [{my_child_entry_id: 'mci_0123456789abcdef0123', name: '은율 학교', kind: 'SCHOOL', neis_school: true}]};
  overview = {...overview, sos: [], settings: {quiet_start_hour: 23, quiet_end_hour: 6, stale_minutes: 30, member_kinds: {}, kinds: ['STALE', 'BATTERY', 'PAUSE', 'PLACE']},
    families: [{...overview.families[0], pending_guardians: [], invites: []}]};
  polls = 0;
  routes = {...routes,
    'GET /overview': () => [200, overview],
    'GET /members/flm_0123456789abcdef0123/places': () => [200, placeList],
    'POST /members/flm_0123456789abcdef0123/places': body => {
      const place = {...placeRow, id: 'flp_1111111111abcdef0123', name: body.name, kind: body.kind, kind_label: '학교', holiday_off: true, school_linked: true};
      placeList = {...placeList, places: [...placeList.places, place], used: placeList.used + 1};
      return [200, {place}];
    },
    'PATCH /places/flp_0123456789abcdef0123': body => [200, {place: {...placeRow, ...body}}],
    'DELETE /places/flp_0123456789abcdef0123': () => { placeList = {...placeList, places: placeList.places.filter(item => item.id !== placeRow.id), used: placeList.used - 1}; return [200, {deleted: true}]; },
  };
  mounted = await uiModule.mountFamilyLocation({sessionToken: 'synthetic-session', root: host});
  (await wait(() => q('[data-family-member="flm_0123456789abcdef0123"] [data-family-action="places"]'), 'places button')).click();
  const panel = await wait(() => q('[data-family-places="flm_0123456789abcdef0123"] [data-family-place="flp_0123456789abcdef0123"]'), 'places panel');
  results.placesListed = panel.textContent.includes('학원 (학원) · 반경 150m · 김엄마 님이 등록') && text().includes('장소 1/5곳')
    && text().includes('3분 넘게 머물러야 알려요') && !q('[data-family-place="flp_0123456789abcdef0123"] [data-family-place-field="holiday_off"]');
  // What a guardian types survives the 3-second redraws of a pending 지금 위치 request.
  const placeName = () => q('[data-family-place-form] input:not([type])');
  const typed = placeName(); typed.value = '학원A';
  q('[data-family-member="flm_0123456789abcdef0123"] [data-family-action="now"]').click();
  await wait(() => q('[data-family-member="flm_0123456789abcdef0123"] [data-family-request-status="ANSWERED"]'), 'answered with places open');
  results.placeTypingKept = placeName() === typed && typed.value === '학원A';
  const placeForm = q('[data-family-place-form]');
  const [suggestionSelect, kindSelect] = placeForm.querySelectorAll('select');
  suggestionSelect.value = 'mci_0123456789abcdef0123'; suggestionSelect.dispatchEvent(new Event('change'));
  results.suggestionFills = placeName().value === '은율 학교' && kindSelect.value === 'SCHOOL'
    && placeForm.querySelector('input[type=radio][value="MEMBER_LOCATION"]').checked;
  placeForm.requestSubmit();
  await wait(() => q('[data-family-place="flp_1111111111abcdef0123"]'), 'place added');
  const placeBody = calls.find(call => call.key === 'POST /members/flm_0123456789abcdef0123/places').body;
  results.placeCreated = JSON.stringify(placeBody) === JSON.stringify({name: '은율 학교', kind: 'SCHOOL', radius_m: 150, center: {source: 'MEMBER_LOCATION'},
    arrive: true, depart: true, my_child_entry_id: 'mci_0123456789abcdef0123'}) && !!q('[data-family-place="flp_1111111111abcdef0123"] [data-family-place-field="holiday_off"]');
  const departBox = q('[data-family-place="flp_0123456789abcdef0123"] [data-family-place-field="depart"]');
  departBox.checked = false; departBox.dispatchEvent(new Event('change'));
  await wait(() => calls.some(call => call.key === 'PATCH /places/flp_0123456789abcdef0123'), 'place patched');
  results.placePatched = JSON.stringify(calls.find(call => call.key === 'PATCH /places/flp_0123456789abcdef0123').body) === JSON.stringify({depart: false});
  const patchAt = calls.findIndex(call => call.key === 'PATCH /places/flp_0123456789abcdef0123');
  await wait(() => calls.slice(patchAt).some(call => call.key === 'GET /members/flm_0123456789abcdef0123/places'), 'reload after patch');
  (await wait(() => q('[data-family-place="flp_0123456789abcdef0123"] [data-family-action="place-delete"]'), 'delete button')).click();
  await wait(() => !q('[data-family-place="flp_0123456789abcdef0123"]') && calls.some(call => call.key === 'DELETE /places/flp_0123456789abcdef0123'), 'place deleted');
  results.placeDeleted = true;
  const settingsForm = q('[data-family-settings]');
  results.placeAlertSetting = settingsForm.textContent.includes('장소 도착·출발') && settingsForm.textContent.includes('장소 도착·출발 알림은 보내지 않아요')
    && text().includes('이동 경로는 남기지 않아요');
  results.placesNoCoordinates = calls.filter(call => call.key.includes('/places')).every(call => !JSON.stringify(call.body || {}).match(/latitude|longitude/u));
  mounted.dispose?.();

  // 3. a child who shares
  overview = {enabled: true, privacy_notice: 'x', consent, sos: [], settings: {}, families: [],
    sharing: {sharing: true, connected: true, paused: false, paused_until: null, under14: true, can_end: false, pause_options: ['HOUR'], pause_max_hours: 3,
      viewers: [{name: '김엄마', role: 'OWNER'}, {name: '박아빠', role: 'GUARDIAN'}], families: [{member_id: 'flm_0123456789abcdef0123', relation: 'CHILD', owner: '김엄마'}],
      recent_checks: [{by: '김엄마', kind: 'NOW', at: new Date().toISOString()}], reconfirm_due_at: null, active_device: true, indicator: '가족에게 위치 공유 중',
      places: [{name: '학원', kind_label: '학원', by: '김엄마', arrive: true, depart: false}]}};
  routes = {'GET /overview': () => [200, overview],
    'POST /sharing/pause': body => [200, {sharing: {...overview.sharing, paused: true}}],
    'POST /members/flm_0123456789abcdef0123/report': () => [200, {reported: true, message: '연결을 끊었어요. 신고가 접수됐고, 이 가족은 다시 초대할 수 없어요.'}]};
  mounted = await uiModule.mountFamilyLocation({sessionToken: 'synthetic-session', root: host});
  const sharing = await wait(() => q('[data-family-sharing]'), 'sharing');
  results.sharingView = sharing.querySelector('.family-loc-indicator').textContent === '가족에게 위치 공유 중' && sharing.textContent.includes('나를 보는 사람: 김엄마, 박아빠')
    && sharing.textContent.includes('김엄마 · 위치를 확인했어요') && sharing.textContent.includes('잠시 멈추면 보호자에게 바로 알려져요.');
  results.placesForMe = q('[data-family-places-for-me]')?.textContent.includes('· 학원 (학원) · 김엄마 님이 등록 · 도착') === true;
  results.childPauseOnlyHour = !!sharing.querySelector('[data-family-action="pause-HOUR"]') && !sharing.querySelector('[data-family-action="pause-TODAY"]')
    && !sharing.querySelector('[data-family-action="leave"]');
  sharing.querySelector('[data-family-action="pause-HOUR"]').click();
  await wait(() => calls.some(call => call.key === 'POST /sharing/pause'), 'pause');
  results.pause = calls.find(call => call.key === 'POST /sharing/pause').body.duration === 'HOUR' && calls.find(call => call.key === 'POST /sharing/pause').body.hours === 1;
  const pauseAt = calls.findIndex(call => call.key === 'POST /sharing/pause');
  await wait(() => calls.slice(pauseAt).some(call => call.key === 'GET /overview'), 'reload after pause');
  q('[data-family-sharing] [data-family-action="report"]').click();
  await wait(() => calls.some(call => call.key === 'POST /members/flm_0123456789abcdef0123/report'), 'report');
  results.report = true;
  results.sosButton = !!q('[data-family-sharing] [data-family-action="sos"]');
  mounted.dispose?.();

  // 4. an invitation link kept for this tab
  sessionStorage.setItem('lotbi.family-invite-intent', JSON.stringify({token: 'T'.repeat(32), at: Date.now()}));
  overview = {enabled: true, privacy_notice: 'x', consent, sos: [], settings: {}, families: [], sharing: noSharing};
  routes = {'GET /overview': () => [200, overview],
    'POST /invites/preview': () => [200, {invite: {id: 'fli_x', role: 'SHARER', relation: 'CHILD', label: '은율', under14: true, status: 'OPEN', expires_at: new Date(Date.now() + 86400000).toISOString(), code_expires_at: new Date().toISOString()},
      inviter: {name: '김*마'}, consent: consent.share, privacy_notice: 'x'}],
    'POST /invites/accept': () => [200, {member: {id: 'flm_x', role: 'SHARER', status: 'ACTIVE', relation: 'CHILD'}, sharing: noSharing}]};
  mounted = await uiModule.mountFamilyLocation({sessionToken: 'synthetic-session', root: host});
  const accept = await wait(() => q('[data-family-accept] [data-family-action="accept"]'), 'preview');
  results.preview = q('[data-family-accept]').textContent.includes('김*마 님이 내 위치를 보려고 초대했어요.') && q('[data-family-accept]').textContent.includes('가족에게 내 위치를 공유합니다. (합성)')
    && sessionStorage.getItem('lotbi.family-invite-intent') === null;
  accept.click();
  await wait(() => calls.some(call => call.key === 'POST /invites/accept'), 'accept');
  const acceptCall = calls.find(call => call.key === 'POST /invites/accept');
  results.accept = acceptCall.body.token === 'T'.repeat(32) && acceptCall.body.consent_version === 'family-location-share-2026-10-10';
  mounted.dispose?.();

  // 5. the 안심케어 tab appears only when Core answers
  const careTabs = async available => {
    host.replaceChildren();
    const root = document.createElement('div'); host.append(root);
    const section = sectionsModule.mountConsumerSection({section: 'care', root, authenticated: true, sessionToken: 'synthetic-session',
      mountPeople: async () => ({}), mountPets: async () => ({}), loadCareCounts: async () => ({}),
      checkFamily: async () => available, mountFamily: async target => { target.append(Object.assign(document.createElement('p'), {textContent: 'family mounted'})); return {}; }});
    await sleep(60);
    const tabs = [...root.querySelectorAll('[data-care-tab]')].map(tab => tab.dataset.careTab);
    section.dispose();
    return tabs;
  };
  results.tabHiddenWhenOff = JSON.stringify(await careTabs(false)) === JSON.stringify(['people', 'pets']);
  results.tabShownWhenOn = JSON.stringify(await careTabs(true)) === JSON.stringify(['people', 'pets', 'family']);
  results.noOtherNetwork = otherNetwork.every(url => url.startsWith(location.origin));
  window.__result = JSON.stringify({ok: true, results});
} catch (error) { window.__result = JSON.stringify({ok: false, error: String(error?.stack || error), results}); }
</script></body></html>`;

const result = await runFixturePage({root: ROOT, fixturePath: '/__family_location_01.html', fixtureHtml: flow, resultExpression: 'window.__result || ""', viewport: {width: 390, height: 844, mobile: true, deviceScaleFactor: 1}, timeoutMs: 180_000});
assert.equal(result.ok, true, result.error);
for (const key of ['modulesLoad', 'notEnabled', 'privacy', 'lastTimeAndBattery', 'place', 'mapLinks', 'stopReason', 'guardianListed', 'placesHiddenOnOldCore', 'nowAnswered', 'statusCheck', 'approve',
  'sosCard', 'missingPrefill', 'consentShownOnlyForUnder14', 'noInviteWithoutConsent', 'invite', 'bearerOnly',
  'placesListed', 'placeTypingKept', 'suggestionFills', 'placeCreated', 'placePatched', 'placeDeleted', 'placeAlertSetting', 'placesNoCoordinates',
  'sharingView', 'placesForMe', 'childPauseOnlyHour', 'pause',
  'report', 'sosButton', 'preview', 'accept', 'tabHiddenWhenOff', 'tabShownWhenOn', 'noOtherNetwork']) {
  assert.equal(result.results[key], true, `${key}: ${JSON.stringify(result.results)}`);
}

// Layout: the guardian view at 360 px, light and dark — no sideways scroll, text and card differ.
const layout = theme => `${head}<body data-site-theme="${theme}"><div aria-labelledby="care-title"><main id="host"></main></div><script type="module">
${shared}
try {
  const uiModule = await import('/site-family-location-ui.js?test=family-layout');
  routes = {'GET /overview': () => [200, {enabled: true, privacy_notice: 'LOTBI 직원이 가족 위치를 볼 수 있는 화면은 없어요.', consent, sos: [], settings: {}, sharing: noSharing,
    families: [{id: 'flg_x', role: 'OWNER', status: 'ACTIVE', owner: '김엄마', now_requests_left_today: 3, plan: {code: 'BASIC', people_limit: 1, people_used: 1, live_map: false, now_requests_per_day: 3},
      members: [member({name: '아주아주긴이름을가진가족구성원입니다', location: null, location_hidden_reason: 'PLAN_LIVE_REQUIRED'})], pending_guardians: [], invites: []}]}]};
  await uiModule.mountFamilyLocation({sessionToken: 'synthetic-session', root: host});
  const card = await wait(() => q('[data-family-member]'), 'card');
  const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  const fg = getComputedStyle(card.querySelector('.family-loc-presence')).color; const bg = getComputedStyle(card).backgroundColor;
  const button = card.querySelector('[data-family-action="now"]').getBoundingClientRect();
  window.__result = JSON.stringify({ok: true, overflow, distinct: fg !== bg, tall: button.height >= 44, basic: card.textContent.includes('지금 위치 요청 (오늘 3회)') && card.textContent.includes('Plus 요금제부터')});
} catch (error) { window.__result = JSON.stringify({ok: false, error: String(error?.stack || error)}); }
</script></body></html>`;

for (const theme of ['light', 'dark']) {
  const view = await runFixturePage({root: ROOT, fixturePath: `/__family_location_01_${theme}.html`, fixtureHtml: layout(theme), resultExpression: 'window.__result || ""', viewport: {width: 360, height: 780, mobile: true, deviceScaleFactor: 1}, timeoutMs: 120_000});
  assert.equal(view.ok, true, view.error);
  assert.equal(view.overflow, false, `${theme}: the family view scrolls sideways at 360 px`);
  assert.equal(view.distinct, true, `${theme}: the last time and its card share one colour`);
  assert.equal(view.tall, true, `${theme}: buttons are at least 44 px tall`);
  assert.equal(view.basic, true, `${theme}: Basic shows the requests left and why the live map is hidden`);
}

console.log('FAMILY_LOCATION_01 PASS — source rules + browser flows (guardian, owner, sharer, invitation, 도착/출발 places, tab gating) + 360px light/dark; synthetic Core answers, not live E2E');
