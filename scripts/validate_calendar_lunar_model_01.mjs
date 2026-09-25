import assert from 'node:assert/strict';

const {solarToLunar, lunarDateLabel} = await import('../site-calendar-lunar.js');

// Widely published reference dates (설날/추석 and a known leap-month start),
// checked against this vendored KASI-based table so a future edit to the
// vendored data or the adapter cannot silently drift without failing here.
const REFERENCE = [
  ['2024-02-10', {year: 2024, month: 1, day: 1, intercalation: false}], // 2024 설날
  ['2024-09-17', {year: 2024, month: 8, day: 15, intercalation: false}], // 2024 추석
  ['2025-10-06', {year: 2025, month: 8, day: 15, intercalation: false}], // 2025 추석
  ['2026-02-17', {year: 2026, month: 1, day: 1, intercalation: false}], // 2026 설날
  ['2023-09-29', {year: 2023, month: 8, day: 15, intercalation: false}], // 2023 추석
  ['2023-03-22', {year: 2023, month: 2, day: 1, intercalation: true}], // 2023's 윤2월 begins
];

for (const [civilDate, expected] of REFERENCE) {
  assert.deepEqual(solarToLunar(civilDate), expected, `solarToLunar(${civilDate})`);
}

// Round-trip sanity across a full ordinary year plus the 2023 leap year:
// every civil date must produce *some* valid, monotonically non-decreasing
// lunar date (never null, never jumping backwards) -- catches an off-by-one
// in the adapter's date parsing independent of the vendored table itself.
function eachDate(year) {
  const out = [];
  for (let month = 1; month <= 12; month += 1) {
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      out.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    }
  }
  return out;
}
for (const year of [2023, 2026]) {
  let previousKey = -Infinity;
  for (const civilDate of eachDate(year)) {
    const lunar = solarToLunar(civilDate);
    assert.ok(lunar, `solarToLunar(${civilDate}) must not be null within the supported range`);
    const key = lunar.year * 1000 + lunar.month * 40 + lunar.day; // coarse but monotonic within a lunar year
    assert.ok(key >= previousKey - 40, `${civilDate}: lunar date went backwards (${JSON.stringify(lunar)})`);
    previousKey = key;
  }
}

// Out-of-range / malformed input must fail closed, not throw or fabricate a
// date.
assert.equal(solarToLunar('not-a-date'), null);
assert.equal(solarToLunar('2026-13-40'), null);
assert.equal(solarToLunar('0999-01-01'), null); // before the library's 1000-02-13 floor
assert.equal(solarToLunar(''), null);
assert.equal(solarToLunar(undefined), null);

// Label formatting: leap month is marked only on the day the lunar month
// starts, an ordinary day just shows its lunar day number, and an invalid
// lunar date renders as nothing rather than "undefined".
assert.equal(lunarDateLabel(solarToLunar('2023-03-22')), '윤2월 1일');
assert.equal(lunarDateLabel(solarToLunar('2025-10-06')), '15일');
assert.equal(lunarDateLabel(solarToLunar('2026-02-17')), '1월 1일');
assert.equal(lunarDateLabel(null), '');
assert.equal(lunarDateLabel(solarToLunar('not-a-date')), '');

console.log('LOTBI Calendar lunar (음력) model: PASS');
