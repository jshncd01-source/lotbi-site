import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const client = await import(pathToFileURL(path.join(ROOT, 'site-festival-client.js')).href);

assert.equal(
  typeof client.buildFestivalBrowseLocationQuery,
  'function',
  'festival browse must expose one production query builder for nationwide, manual-region, and current-location scopes',
);
assert.equal(
  typeof client.listFestivalRegionChoices,
  'function',
  'festival region choices must be built by production code so 전국 is an explicit selectable scope',
);

assert.deepEqual(
  client.buildFestivalBrowseLocationQuery({
    region: '',
    municipality: '',
    locationMode: 'CURRENT',
    currentPosition: {latitude: 35.8, longitude: 127.1},
    currentRegionLabel: '전북특별자치도',
  }),
  {
    latitude: 35.8,
    longitude: 127.1,
    region: '전북특별자치도',
  },
  'current-location browse must filter to the resolved province while retaining coordinates for distance ordering',
);

assert.deepEqual(
  client.buildFestivalBrowseLocationQuery({
    region: '경기도',
    municipality: '수원시',
    locationMode: 'CURRENT',
    currentPosition: {latitude: 35.8, longitude: 127.1},
    currentRegionLabel: '전북특별자치도',
  }),
  {region: '경기도', municipality: '수원시'},
  'an explicit manual region must win over stale current-location state',
);

assert.deepEqual(
  client.buildFestivalBrowseLocationQuery({
    region: '',
    municipality: '',
    locationMode: 'NATIONWIDE',
    currentPosition: null,
    currentRegionLabel: '',
  }),
  {},
  'the explicit nationwide scope must send neither a region nor coordinates',
);

assert.deepEqual(
  client.listFestivalRegionChoices(['서울특별시', '전북특별자치도']),
  ['전국', '서울특별시', '전북특별자치도'],
  '전국 must be the first explicit region choice',
);

console.log('FESTIVAL REGION SCOPE VALIDATION PASS');
