import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const calendar = readFileSync('site-calendar.js', 'utf8');
const manager = readFileSync('site-calendar-manager.js', 'utf8');
const css = readFileSync('site-calendar.css', 'utf8');
const ui = readFileSync('site-calendar-ui.js', 'utf8');
const index = readFileSync('index.html', 'utf8');


const {loadKoreaHolidaysForRange} = await import('../site-calendar-manager.js');
const holidayCalls = [];
const verifiedAt = '2026-09-24T00:00:00Z';
const holidayFixture = year => ({
  year,
  country: 'KR',
  coverage_status: 'VERIFIED',
  snapshot_version: `KR-${year}-fixture`,
  supported_years: [2026, 2027],
  items: year === 2026 ? [{
    date: '2026-12-31', name: '연말 공휴일', country: 'KR',
    holiday_type: 'PUBLIC', is_substitute: false, source: 'FIXTURE',
    source_date: '2026-09-24', verified_at: verifiedAt,
  }] : [{
    date: '2027-01-01', name: '신정', country: 'KR',
    holiday_type: 'PUBLIC', is_substitute: false, source: 'FIXTURE',
    source_date: '2026-09-24', verified_at: verifiedAt,
  }, {
    date: '2027-01-01', name: '신정', country: 'KR',
    holiday_type: 'PUBLIC', is_substitute: false, source: 'FIXTURE_DUPLICATE',
    source_date: '2026-09-24', verified_at: verifiedAt,
  }],
  ai_calls: 0,
  provider_api_calls: 0,
});
const crossYear = await loadKoreaHolidaysForRange(
  {start: '2026-12-28', end: '2027-01-03'},
  async url => {
    const year = Number(new URL(String(url), 'https://lotbi.invalid').searchParams.get('year'));
    holidayCalls.push(year);
    return new Response(JSON.stringify(holidayFixture(year)), {
      status: 200, headers: {'Content-Type': 'application/json'},
    });
  },
);
assert.deepEqual(holidayCalls, [2026, 2027], 'cross-year Week must request every covered year');
assert.equal(crossYear.coverageStatus, 'VERIFIED');
assert.deepEqual(crossYear.items.map(item => item.date), ['2026-12-31', '2027-01-01']);
assert.equal(crossYear.items.filter(item => item.date === '2027-01-01').length, 1, 'duplicate holiday rows must be removed');

const partial = await loadKoreaHolidaysForRange(
  {start: '2026-12-28', end: '2027-01-03'},
  async url => {
    const year = Number(new URL(String(url), 'https://lotbi.invalid').searchParams.get('year'));
    if (year === 2027) return new Response('unavailable', {status: 503});
    return new Response(JSON.stringify(holidayFixture(year)), {
      status: 200, headers: {'Content-Type': 'application/json'},
    });
  },
);
assert.equal(partial.coverageStatus, 'UNAVAILABLE', 'combined coverage is VERIFIED only when every covered year is verified');
assert.deepEqual(partial.items.map(item => item.date), ['2026-12-31'], 'a failed year must not erase verified holiday rows from another year');

assert.match(calendar, /\/v2\/life\/holidays\?year=/);
assert.match(calendar, /coverageStatus/);
assert.match(calendar, /providerApiCalls:\s*0/);
assert.match(calendar, /\/v2\/life\/holidays\?year=.*cache: 'no-store'/s, 'holiday fetch must bypass stale cached 404/old responses');

assert.match(manager, /CALENDAR_SETTINGS_STORAGE_KEY/);
// Holidays default to ON. This used to match a `showKoreaHolidays: true`
// literal, which vanished when the settings read started merging over what is
// stored instead of returning a frozen fallback. Ask the function instead of
// the source: the behaviour is the contract, and it survives the next refactor.
{
  const {readCalendarDisplaySettings} = await import('../site-calendar-manager.js');
  const empty = {getItem: () => null, setItem: () => {}};
  assert.equal(readCalendarDisplaySettings(empty).showKoreaHolidays, true, 'Korea holidays must be on by default');
  const off = {getItem: () => JSON.stringify({showKoreaHolidays: false}), setItem: () => {}};
  assert.equal(readCalendarDisplaySettings(off).showKoreaHolidays, false, 'an explicit opt-out must be honoured');
}
assert.match(manager, /loadKoreaHolidaysForRange/);
assert.match(manager, /calendar-holiday-label/);
assert.match(manager, /calendar-day-holiday/);
assert.match(manager, /aria-label', '캘린더 설정'/);
assert.match(manager, /대한민국 공휴일 표시/);
assert.match(manager, /calendar-delete-confirm-dialog/);
assert.match(manager, /이 일정을 삭제하시겠습니까\?/);
assert.match(manager, /calendar-editor-body/);

assert.match(css, /\.calendar-holiday-label/);
assert.match(css, /\.calendar-settings-backdrop/);
assert.match(css, /\.calendar-settings-dialog/);
assert.match(css, /\.calendar-date-cell\[data-holiday="true"\]/);
assert.match(css, /@media \(max-width: 520px\)/);

assert.match(ui, /site-calendar-manager\.js\?v=20260924-calendarux1/);
assert.match(index, /site-calendar\.css\?v=20260924-calendarux1/);

console.log('Calendar Korea holiday UI contract: PASS');
