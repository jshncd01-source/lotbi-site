import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const clientUrl = pathToFileURL(path.resolve('site-festival-client.js')).href;
const {
  FESTIVAL_DEFAULT_TIME_FILTER,
  FESTIVAL_TIME_FILTER,
  FESTIVAL_USER_TIME_FILTERS,
} = await import(clientUrl);

assert.equal(
  FESTIVAL_DEFAULT_TIME_FILTER,
  FESTIVAL_TIME_FILTER.ONGOING,
  'opening 축제·행사 must select 진행 중 by default',
);

assert.deepEqual(
  FESTIVAL_USER_TIME_FILTERS,
  [
    FESTIVAL_TIME_FILTER.ONGOING,
    FESTIVAL_TIME_FILTER.THIS_WEEKEND,
    FESTIVAL_TIME_FILTER.THIS_MONTH,
    FESTIVAL_TIME_FILTER.ALWAYS_OPEN,
  ],
  'the visible filters must exclude 전체 and keep 진행 중/이번 주말/이번 달/상시 운영 in order',
);

console.log('FESTIVAL DEFAULT ONGOING VALIDATION PASS');
