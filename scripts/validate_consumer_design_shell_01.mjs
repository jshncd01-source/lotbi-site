import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const html = read('index.html');
const js = read('site-conversation.js');
const subscribe = read('subscribe.html');
// CONNECTED-SERVICES-NAME-01 — 대표 결정(2026-10-10 "연결서비스로 통합"): the last item
// always opened Account's 연결 서비스 page; it now carries that page's name.
// TROUBLE-HELPER-01: 분쟁·사고 도우미 joins right after 사기·피싱 확인 (eight menus).
const expected = ['새 대화', '캘린더', 'Life Wallet', '사기·피싱 확인', '분쟁·사고 도우미', '안심케어', '지역정보', '연결 서비스'];
const navs = [...html.matchAll(/<div class="consumer-primary-nav"[^>]*>([\s\S]*?)<\/div>/g)];
assert.equal(navs.length, 2, 'desktop and mobile use the same navigation');
for (const [,nav] of navs) {
  assert.deepEqual([...nav.matchAll(/<button\b[^>]*aria-label="([^"]+)"/g)].map(match => match[1]), expected);
  assert.match(nav, /data-calendar-view="all"/);
  assert.match(nav, /data-scam-open/);
  assert.match(nav, /data-trouble-open/);
}
assert.match(html, /data-lotbi-avatar-stage/);
assert.match(html, /data-lotbi-avatar-fallback/);
assert.match(html, /lotbi-lockup-160w\.png/);
assert.match(js, /https:\/\/account\.lotbiai\.com\/account/);
assert.match(js, /\['프로필 관리', openProfile\], \['설정', openSettings\]/);
assert.match(js, /mountConsumerSection/);
assert.match(js, /workspace: section/);
const calendarSurface = js.slice(js.indexOf('const openCalendar = async'), js.indexOf('const bindCalendarEntries'));
assert.match(calendarSurface, /panel\.classList\.add\('site-calendar-modal', 'site-calendar-chat-popup'\)/);
assert.match(calendarSurface, /installSurfaceBehavior\(backdrop, panel, \{\s*modal: true,/);
assert.match(calendarSurface, /modal: true,\s*dismissOnBackdrop: false,/,
  'Calendar chat modal must stay open when its backdrop or blank modal area is clicked');
assert.doesNotMatch(calendarSurface, /workspace:/, 'Calendar must remain an overlay over the chat');
assert.match(js, /dismissOnBackdrop = true/,
  'Other surfaces must retain backdrop dismissal unless they explicitly opt out');
// REGIONAL-INFO-BACK-NAVIGATION-01 (owner report: any blank spot went to the
// home): a full-screen workspace never closes on a tap of its empty area; only
// a popup over the chat keeps the outside tap.
assert.match(js, /if \(dismissOnBackdrop && !workspace\) \{\s*const backdropDismiss = createBackdropDismissGuard\(surface\);/,
  'workspaces never close on a backdrop tap');
assert.match(js, /mainScrollHost.inert = true/);
assert.match(js, /mainScrollHost.inert = false/);
assert.match(js, /else if \(!workspace\) trapFocus/);
assert.match(js, /closeSurface\(\); startNewConversation\(\)/);
assert.match(html, /consumer-brand-fallback/);
const consumerSections = read('site-consumer-sections.js');
// 안심케어 opens on 사람. Only the restored /#pets route may open 반려동물 first.
assert.match(consumerSections, /export function mountConsumerSection\(\{[^}]*\bcareTab = 'people',/, 'care tab defaults to people');
const careStart = consumerSections.indexOf('root.append(tabs, body);');
const careEnd = consumerSections.indexOf("} else if (section === 'mall')", careStart);
assert.ok(careStart > 0 && careEnd > careStart, 'care section mount block');
const careMount = consumerSections.slice(careStart, careEnd);
assert.match(careMount, /^root\.append\(tabs, body\);[\s\S]*loadCareCounts\(\)[\s\S]*void selectTab\(careTab === 'pets' \? 'pets' : 'people'\);\s*$/);
assert.equal(careMount.match(/selectTab\(/g).length, 1, 'exactly one initial care tab selection');
const initialCareTab = new Function('careTab', `return ${careMount.match(/void selectTab\((.+)\);\s*$/)[1]};`);
for (const value of [undefined, null, '', 'people', 'PETS', 'pet', 'care', 'wallet']) {
  assert.equal(initialCareTab(value), 'people', `careTab ${String(value)} must fall back to 사람`);
}
assert.equal(initialCareTab('pets'), 'pets', 'only careTab pets restores 반려동물');
assert.match(consumerSections, /addEventListener\('click', \(\) => \{ void selectTab\(value\); onCareTab\?\.\(value\); \}\)/);
assert.match(consumerSections, /void selectTab\(next \? 'pets' : 'people'\); onCareTab\?\.\(next \? 'pets' : 'people'\);/);
assert.doesNotMatch(consumerSections, /긴급한 상황이라면|사람 실종 신고|반려동물 실종 신고/);
assert.match(js, /openFestival/);
assert.match(js, /openLotbiBox/);
assert.match(js, /backLabel: '지역정보로 돌아가기', onBack: \(\) => openConsumerSection\('life'\)/);
assert.match(js, /backLabel: '안심케어로 돌아가기', onBack: \(\) => openConsumerSection\('care'\)/);
assert.match(js, /back.removeEventListener\('click', closeSurface\)/);
for (const text of ['일상을 챙겨주는 AI 생활비서', '생활 전반을 더 많이 맡기는 개인비서', 'LOTBI를 가장 넉넉하게 사용', '9,900원', '29,900원', '39,900원', '프로필 1개', '프로필 5개', '프로필 15개']) assert.ok(subscribe.includes(text));
assert.doesNotMatch(subscribe, /19,900원/);
// SITE-REFRESH-ROUTE-FESTIVAL-BACK-04: Escape takes the same path as the ←
// (close this screen, then onBack), through history first when it can.
assert.match(js, /event\.preventDefault\(\); event\.stopPropagation\(\); goBack\(\);/, 'nested ESC must not also reach the global surface closer');
assert.match(js, /const goBack = typeof onBack === 'function'\s*\? \(\) => leaveSiteRoute\(backRoute, \(\) => \{ if \(openSurface !== surface\) return; closeSurface\(\); onBack\(\); \}\)/, 'ESC and ← close the nested screen, then open the screen it returns to');
console.log('CONSUMER_DESIGN_SHELL_01 PASS (source contracts, not live E2E)');
