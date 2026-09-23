import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const calendar = readFileSync('site-calendar.js', 'utf8');
const manager = readFileSync('site-calendar-manager.js', 'utf8');
const css = readFileSync('site-calendar.css', 'utf8');
const ui = readFileSync('site-calendar-ui.js', 'utf8');
const index = readFileSync('index.html', 'utf8');

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
assert.match(manager, /getKoreaHolidays/);
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

assert.match(ui, /site-calendar-manager\.js\?v=20260923-sysdark3/);
assert.match(index, /site-calendar\.css\?v=20260923-sysdark3/);

console.log('Calendar Korea holiday UI contract: PASS');
