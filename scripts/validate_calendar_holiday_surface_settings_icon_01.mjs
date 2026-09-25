// A public holiday must read as a day off, and the settings control must look
// like settings.
//
// Before this, a holiday changed only the date number's colour -- the same red a
// Sunday already used -- so 추석 and a plain Sunday were indistinguishable, and
// the dark theme had an override for the holiday label but not for the number.
// A holiday now carries a SURFACE, which is what "쉬는 날" looks like at a
// glance and what keeps it apart from a weekend.
//
// The toolbar's settings control was the ⚙️ emoji, which renders as a different
// shape on every OS; on the reporter's screen it read as a sun and was taken for
// a weather button. It is inline SVG now, in the sidebar's icon language.
//
// Everything here is measured in a real browser, in light and dark, at both
// widths.
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.calendar-holiday-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.calendar-holiday-wrapper.html';
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4194;
const ORIGIN = `http://127.0.0.1:${PORT}`;

function browserPath() {
  for (const name of [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (name.includes('/') && fs.existsSync(name)) return name;
    const found = spawnSync('which', [name], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required');
}

const fixture = `<!doctype html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/styles.css">
<link rel="stylesheet" href="/site-conversation.css">
<link rel="stylesheet" href="/site-theme-tokens.css">
<link rel="stylesheet" href="/site-calendar.css">
<link rel="stylesheet" href="/site-calendar-expense.css">
</head><body class="chat-home-page" data-site-auth-state="authenticated" data-site-theme="light">
<div class="site-modal-backdrop"><section class="site-modal site-calendar-modal" role="dialog" aria-labelledby="mt">
<header class="site-modal-header"><h2 id="mt">캘린더</h2></header>
<div class="site-modal-content" id="cal-root"></div>
</section></div>
<pre id="calendar-result">pending</pre>
<script type="module">
const out = document.getElementById('calendar-result');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wait = async (fn, label) => { for (let i = 0; i < 200; i += 1) { if (fn()) return; await sleep(20); } throw new Error('timeout ' + label); };
try {
  localStorage.clear();

  // 2026-09: 추석 연휴 24(목)/25(금)/26(토). 20 is a plain Sunday and 16 a plain
  // weekday -- the two controls this test compares against. 23 is "today" here,
  // so it is deliberately not used as a control.
  const HOLIDAYS = [
    {date: '2026-09-24', name: '추석 연휴', country: 'KR', holiday_type: 'CHUSEOK', is_substitute: false, source: 'KASI', source_date: '2026-09-01', verified_at: '2026-09-01T00:00:00Z'},
    {date: '2026-09-25', name: '추석', country: 'KR', holiday_type: 'CHUSEOK', is_substitute: false, source: 'KASI', source_date: '2026-09-01', verified_at: '2026-09-01T00:00:00Z'},
    {date: '2026-09-26', name: '추석 연휴', country: 'KR', holiday_type: 'CHUSEOK', is_substitute: false, source: 'KASI', source_date: '2026-09-01', verified_at: '2026-09-01T00:00:00Z'},
  ];
  const EVENT = {
    projection_id: 'p0', activity_id: 'activity_' + '0'.repeat(32), occurrence_id: 'occurrence_' + '0'.repeat(32),
    title: '차례 준비', activity_revision: 1, occurrence_revision: 1,
    local_date: '2026-09-25', local_datetime: null, temporal_kind: 'DATE_ONLY',
    temporal_semantics: 'USER_PLANNED_TIME', busy: 'UNKNOWN', confirmation_level: 'USER_ATTESTED',
    provider_verified: false, reminder_configured: false, source_kind: 'USER_INPUT',
    allowed_actions: ['UPDATE', 'REMOVE'],
    entry: {amount_minor: null, currency: 'KRW', expense_category: null, memo: null, place: null, merchant: null},
  };

  let holidaysBroken = false;
  const j = body => Promise.resolve(new Response(JSON.stringify(body), {status: 200, headers: {'Content-Type': 'application/json'}}));
  globalThis.fetch = url => {
    const u = new URL(String(url), location.origin);
    if (u.pathname.includes('/attention')) return j({view: 'ATTENTION', as_of: '2026-09-23T00:00:00Z', timezone: 'Asia/Seoul', coverage: 'PERSONAL_ACTIVITY_ONLY', items: [], ai_calls: 0, provider_api_calls: 0});
    if (u.pathname.includes('/unscheduled')) return j({view: 'UNSCHEDULED', items: [], ai_calls: 0, provider_api_calls: 0});
    if (u.pathname.includes('/weather')) return j({provider_ready: false, items: [], ai_calls: 0});
    if (u.pathname.includes('/expense')) return j({view: 'EXPENSE_SUMMARY', ai_calls: 0, provider_api_calls: 0, currency: 'KRW', total_minor: 0, categories: []});
    if (u.pathname.includes('/holidays')) {
      // The blast-radius case: broken holiday data must cost the decoration and
      // nothing else.
      if (holidaysBroken) return j({nonsense: true});
      return j({year: 2026, country: 'KR', coverage_status: 'VERIFIED', snapshot_version: 'fixture', supported_years: [2026], items: HOLIDAYS, ai_calls: 0, provider_api_calls: 0});
    }
    return j({view: 'AGENDA', as_of: '2026-09-23T00:00:00Z', timezone: 'Asia/Seoul', coverage: 'PERSONAL_ACTIVITY_ONLY', items: [EVENT], ai_calls: 0, provider_api_calls: 0});
  };

  const root = document.getElementById('cal-root');
  const {mountLifeCalendarManager} = await import('/site-calendar-manager.js');
  await mountLifeCalendarManager({
    sessionToken: 'site-token', root, initialView: 'month',
    timezone: 'Asia/Seoul', now: new Date('2026-09-23T01:00:00Z'),
    locationProvider: null, locationPermissions: null,
  });
  await wait(() => root.querySelector('.calendar-month-grid'), 'month grid');
  await wait(() => root.querySelector('.calendar-date-cell[data-calendar-date="2026-09-25"][data-holiday="true"]'), 'holiday cell');

  const cell = date => root.querySelector('.calendar-date-cell[data-calendar-date="' + date + '"]');
  const bg = node => getComputedStyle(node).backgroundColor;
  const ink = node => getComputedStyle(node.querySelector('.calendar-date-number')).color;
  const box = node => Math.round(node.getBoundingClientRect().height);

  const readTheme = () => {
    const holiday = cell('2026-09-25');   // 추석, a Friday
    const sunday = cell('2026-09-20');    // plain Sunday
    // 23 is today and therefore selected, so the plain control is the 16th.
    const weekday = cell('2026-09-16');   // plain Wednesday
    return {
      holidayBg: bg(holiday),
      sundayBg: bg(sunday),
      weekdayBg: bg(weekday),
      holidayInk: ink(holiday),
      sundayInk: ink(sunday),
      weekdayInk: ink(weekday),
      holidayHeight: box(holiday),
      weekdayHeight: box(weekday),
      label: holiday.querySelector('.calendar-holiday-label')?.textContent || '',
      ariaLabel: holiday.querySelector('.calendar-date-trigger')?.getAttribute('aria-label') || '',
    };
  };

  const result = {ok: true, viewport: {width: innerWidth, height: innerHeight}};
  result.light = readTheme();

  // The event on the holiday must still be legible -- the block sits behind the
  // schedule, never over it.
  const desktop = matchMedia('(min-width: 901px)').matches;
  const chip = cell('2026-09-25').querySelector('.calendar-event-chip');
  result.eventOnHoliday = {
    present: Boolean(chip),
    title: chip ? chip.textContent.trim() : '',
    // The stack is deliberately hidden under 900px; there the count stands in.
    visible: desktop ? Boolean(chip && chip.getBoundingClientRect().height > 0) : true,
    countShown: desktop ? true : (cell('2026-09-25').querySelector('.calendar-mobile-event-count')?.textContent || '') !== '',
  };

  // The settings control is an icon, not a glyph.
  const settings = root.querySelector('.calendar-settings-button');
  const icon = settings?.querySelector('svg.calendar-toolbar-icon');
  const iconBox = icon ? icon.getBoundingClientRect() : {width: 0, height: 0};
  result.settingsIcon = {
    hasSvg: Boolean(icon),
    strokeOnly: icon ? getComputedStyle(icon).fill === 'none' && getComputedStyle(icon).stroke !== 'none' : false,
    width: Math.round(iconBox.width),
    height: Math.round(iconBox.height),
    textContent: settings ? settings.textContent.trim() : 'MISSING',
    ariaLabel: settings ? settings.getAttribute('aria-label') : '',
    title: settings ? settings.getAttribute('title') : '',
  };

  document.body.dataset.siteTheme = 'dark';
  await sleep(120);
  result.dark = readTheme();
  document.body.dataset.siteTheme = 'light';

  // Blast radius: break the holiday feed and re-read the month.
  holidaysBroken = true;
  root.querySelector('.calendar-nav-button')?.click();
  await sleep(1200);
  result.survivesBrokenHolidays = root.querySelectorAll('.calendar-date-cell').length >= 28
    && Boolean(root.querySelector('.calendar-month-grid'));

  out.textContent = JSON.stringify(result);
} catch (e) {
  out.textContent = JSON.stringify({ok: false, error: String(e?.stack || e), viewport: {width: innerWidth, height: innerHeight}});
}
</script></body></html>`;

function waitServer() {
  for (let i = 0; i < 60; i += 1) {
    const p = spawnSync('curl', ['--fail', '--silent', `${ORIGIN}/`], {timeout: 1000});
    if (p.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 120);
  }
  throw new Error('server start');
}

function wrapperMarkup(w, h) {
  return `<!doctype html><html><body style="margin:0"><iframe id="case-frame" src="/${INNER_REL}" width="${w}" height="${h}" style="display:block;border:0"></iframe><pre id="result">pending</pre><script>
  const frame=document.getElementById('case-frame'),out=document.getElementById('result');
  const timer=setInterval(()=>{try{const child=frame.contentDocument?.getElementById('calendar-result');if(child&&child.textContent!=='pending'){out.textContent=child.textContent;clearInterval(timer)}}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e)});clearInterval(timer)}},25);
  setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'wrapper timeout'});clearInterval(timer)}},55000);
  <\/script></body></html>`;
}

function run(browser, w, h) {
  fs.writeFileSync(WRAPPER, wrapperMarkup(w, h), 'utf8');
  const r = spawnSync(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--window-size=1600,1000', '--force-device-scale-factor=1',
    '--virtual-time-budget=58000', '--dump-dom', `${ORIGIN}/${WRAPPER_REL}`,
  ], {encoding: 'utf8', timeout: 120000, maxBuffer: 12 * 1024 * 1024});
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`browser ${r.status} ${r.stderr}`);
  const a = '<pre id="result">';
  const b = '</pre>';
  const i = r.stdout.indexOf(a);
  const j = r.stdout.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error('result missing');
  const raw = r.stdout.slice(i + a.length, j)
    .replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
  const v = JSON.parse(raw);
  if (!v.ok) throw new Error(`${w}x${h}: ${v.error}`);
  return v;
}

// rgb(255, 255, 255) -> [255,255,255]
function channels(value) {
  const m = /rgba?\(([^)]+)\)/.exec(value || '');
  if (!m) throw new Error(`unreadable colour ${value}`);
  return m[1].split(',').slice(0, 3).map(n => Number(n.trim()));
}
const distance = (a, b) => channels(a).reduce((sum, v, i) => sum + Math.abs(v - channels(b)[i]), 0);
const luminance = value => {
  const [r, g, bl] = channels(value);
  return (0.2126 * r + 0.7152 * g + 0.0722 * bl) / 255;
};

// Static guards, so the two regressions cannot creep back by a different route.
const manager = fs.readFileSync(path.join(ROOT, 'site-calendar-manager.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'site-calendar.css'), 'utf8');
for (const emoji of ['⚙️', '⚙']) {
  if (manager.includes(emoji)) throw new Error(`the toolbar must carry no gear emoji (${emoji}): it renders differently on every OS`);
}
// A gear is a circle with radial spokes, which at 19px is a sun -- the very
// confusion this fixes, and the shape the weather glyphs already own.
if (/SETTINGS_ICON_SHAPES[\s\S]{0,240}?\['circle'/.test(manager)) {
  throw new Error('the settings icon must not be a spoked circle: at 19px that reads as a sun');
}
if (!css.includes('--lotbi-calendar-holiday-surface')) throw new Error('the holiday surface must stay a named role, not a per-rule hex');
if (!css.includes('--lotbi-calendar-weekend-sun')) throw new Error('the weekend ink must stay a named role, not a per-rule hex');
if (/\.calendar-holiday-label[\s\S]{0,200}?color: #/.test(css)) throw new Error('the holiday label must read its colour from the role');
// The roles have to exist in all three theme states, since data-site-theme
// carries the raw preference and stays "system" under a dark OS.
if (!/@media \(prefers-color-scheme: dark\)[\s\S]{0,400}?data-site-theme="system"[\s\S]{0,600}?--lotbi-calendar-holiday-surface/.test(css)) {
  throw new Error('the dark roles must also cover the default "system" theme preference');
}

const browser = browserPath();
fs.writeFileSync(INNER, fixture, 'utf8');
const server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
try {
  waitServer();
  const results = [[360, 780], [1280, 860]].map(([w, h]) => run(browser, w, h));
  for (const v of results) {
    const where = `${v.viewport.width}x${v.viewport.height}`;
    for (const [theme, t] of [['light', v.light], ['dark', v.dark]]) {
      // The point of the whole change: a holiday is a block, a Sunday is not.
      if (distance(t.holidayBg, t.weekdayBg) < 12) {
        throw new Error(`${where} ${theme}: a holiday must not share the plain weekday surface (${t.holidayBg} vs ${t.weekdayBg})`);
      }
      if (distance(t.holidayBg, t.sundayBg) < 12) {
        throw new Error(`${where} ${theme}: a holiday must be told apart from a plain Sunday by its surface (${t.holidayBg} vs ${t.sundayBg})`);
      }
      // ...and a plain Sunday must stay plain: no block leaked onto weekends.
      if (distance(t.sundayBg, t.weekdayBg) > 4) {
        throw new Error(`${where} ${theme}: a plain Sunday must keep the ordinary cell surface (${t.sundayBg} vs ${t.weekdayBg})`);
      }
      // The block must not resize the cell.
      if (t.holidayHeight !== t.weekdayHeight) {
        throw new Error(`${where} ${theme}: the holiday block changed the cell height (${t.holidayHeight} vs ${t.weekdayHeight})`);
      }
      // Not colour alone: the holiday's name is on the cell and in the label.
      if (!t.label.includes('추석')) throw new Error(`${where} ${theme}: the holiday name must stay on the cell, got ${JSON.stringify(t.label)}`);
      if (!t.ariaLabel.includes('대한민국 공휴일 추석')) {
        throw new Error(`${where} ${theme}: the screen-reader path must keep naming the holiday, got ${JSON.stringify(t.ariaLabel)}`);
      }
    }
    // Each theme's ink has to belong to that theme, which is exactly what the
    // old dark-only override for the label missed for the number.
    if (luminance(v.light.holidayInk) > 0.5) throw new Error(`${where}: the light holiday number must stay dark ink (${v.light.holidayInk})`);
    if (luminance(v.dark.holidayInk) < 0.5) throw new Error(`${where}: the dark holiday number must lighten (${v.dark.holidayInk})`);
    if (luminance(v.dark.holidayBg) > 0.5) throw new Error(`${where}: the dark holiday surface must stay dark (${v.dark.holidayBg})`);
    if (luminance(v.dark.sundayInk) < 0.5) throw new Error(`${where}: the dark Sunday number must lighten too (${v.dark.sundayInk})`);

    if (!v.eventOnHoliday.present) throw new Error(`${where}: the event on the holiday disappeared`);
    if (v.eventOnHoliday.title !== '차례 준비') throw new Error(`${where}: the event title changed: ${v.eventOnHoliday.title}`);
    if (!v.eventOnHoliday.visible || !v.eventOnHoliday.countShown) {
      throw new Error(`${where}: the holiday block must sit behind the schedule, not over it`);
    }

    const icon = v.settingsIcon;
    if (!icon.hasSvg) throw new Error(`${where}: the settings control must render an inline SVG icon`);
    if (!icon.strokeOnly) throw new Error(`${where}: the settings icon must follow the stroke-only icon language`);
    if (icon.width < 14 || icon.height < 14) throw new Error(`${where}: the settings icon rendered at ${icon.width}x${icon.height}`);
    if (icon.textContent !== '설정') throw new Error(`${where}: the settings control must visibly say 설정, got ${JSON.stringify(icon.textContent)}`);
    if (icon.ariaLabel !== '캘린더 설정' || icon.title !== '캘린더 설정') {
      throw new Error(`${where}: the settings control must keep its accessible name`);
    }

    if (!v.survivesBrokenHolidays) throw new Error(`${where}: broken holiday data must not cost the Calendar`);
  }
  console.log('CALENDAR HOLIDAY SURFACE + SETTINGS ICON PASS', JSON.stringify(results));
} finally {
  server.kill('SIGTERM');
  fs.rmSync(INNER, {force: true});
  fs.rmSync(WRAPPER, {force: true});
}
