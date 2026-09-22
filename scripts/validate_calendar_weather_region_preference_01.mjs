import assert from 'node:assert/strict';

const {
  clearCalendarManualWeatherRegion,
  readCalendarManualWeatherRegion,
  writeCalendarManualWeatherRegion,
} = await import('../site-calendar-weather-region.js?v=20260922-regionpref1');

class MemoryStorage {
  constructor() { this.value = null; }
  getItem() { return this.value; }
  setItem(_key, value) { this.value = value; }
  removeItem() { this.value = null; }
}

{
  const storage = new MemoryStorage();
  assert.equal(writeCalendarManualWeatherRegion({
    label: '전북특별자치도 전주시',
    latitude: 35.8242,
    longitude: 127.148,
    midRegionCode: '11F20000',
  }, storage), true);
  assert.deepEqual(readCalendarManualWeatherRegion(storage), {
    label: '전북특별자치도 전주시',
    latitude: 35.8242,
    longitude: 127.148,
    midRegionCode: '11F20000',
  });
}

{
  const storage = new MemoryStorage();
  assert.equal(writeCalendarManualWeatherRegion({
    label: '잘못된 지역',
    latitude: 0,
    longitude: 0,
    midRegionCode: null,
  }, storage), false);
  assert.equal(storage.value, null);
}

{
  const storage = new MemoryStorage();
  storage.value = '{broken';
  assert.equal(readCalendarManualWeatherRegion(storage), null);
}

{
  const storage = new MemoryStorage();
  storage.value = JSON.stringify({
    label: '서울',
    latitude: 37.5665,
    longitude: 126.978,
    midRegionCode: '11B00000',
  });
  clearCalendarManualWeatherRegion(storage);
  assert.equal(readCalendarManualWeatherRegion(storage), null);
}

console.log('LOTBI Calendar manual weather region preference contract: PASS');
