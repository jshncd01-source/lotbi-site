import assert from 'node:assert/strict';
import * as preference from '../site-location-preference.js';

assert.equal(typeof preference.readDefaultMapProvider, 'function');
assert.equal(preference.readDefaultMapProvider(''), 'NAVER_MAP');
for (const provider of ['NAVER_MAP', 'KAKAO_NAVI', 'TMAP', 'GOOGLE_MAPS']) {
  assert.equal(preference.readDefaultMapProvider(`lotbi_default_map_provider_v1=${provider}`), provider);
}
assert.equal(preference.readDefaultMapProvider('lotbi_default_map_provider_v1=UNKNOWN'), 'NAVER_MAP');
assert.equal(
  preference.readDefaultMapProvider('lotbi_default_map_provider_v1=TMAP; lotbi_default_map_provider_v1=NAVER_MAP'),
  'NAVER_MAP',
);

console.log('Default map preference contract: PASS');
