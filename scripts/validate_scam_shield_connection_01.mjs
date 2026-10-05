import assert from 'node:assert/strict';
import {analyzeScamShield, SiteCoreError} from '../site-core.js';

const form = new FormData();
form.set('text', '법원에서 보냈다는 문자를 확인해 주세요');
let captured;
const successFetch = async (url, options) => {
  captured = {url, options};
  return new Response(JSON.stringify({
    contract_id: 'LOTBI-SCAM-SHIELD-MVP-01',
    case_id: 'scam_0123456789abcdef0123',
    risk_level: 'UNVERIFIED',
    headline: '확인 필요',
    reasons: ['공식 발신자를 확인하지 못했습니다.'],
    confirmed_facts: ['문자에 외부 주소가 있습니다.'],
    unverified_items: ['발신 기관'],
    next_safe_action: ['공식 전화번호로 다시 확인하세요.'],
    do_now: ['공식 전화번호로 다시 확인하세요.'],
    do_not: ['주소를 열지 마세요.'],
    evidence: [],
    untrusted_file_execution: false,
    public_file_upload_to_third_party: false,
  }), {status: 200, headers: {'content-type': 'application/json'}});
};

const normalized = await analyzeScamShield('session-token', form, successFetch);
assert.equal(captured.url, 'https://api.lotbiai.com/v2/scam-shield/cases');
assert.equal(captured.options.method, 'POST');
assert.equal(captured.options.headers.Authorization, 'Bearer session-token');
assert.equal(captured.options.body, form);
assert.equal(normalized.riskLevel, 'UNVERIFIED');
assert.deepEqual(normalized.doNot, ['주소를 열지 마세요.']);

const limitFetch = async () => new Response(JSON.stringify({detail: {
  code: 'PLAN_USAGE_LIMIT_REACHED',
  message: '이번 달 사용량을 모두 사용했습니다.',
  usage_type: 'AUTHENTICITY_DEEP_ANALYSIS',
  limit: 20,
  remaining: 0,
  upgrade_available: true,
  basic_protection: {
    available: true,
    next_safe_action: ['추가 입력·설치·송금을 중지하세요.'],
  },
}}), {status: 429, headers: {'content-type': 'application/json'}});

await assert.rejects(
  () => analyzeScamShield('session-token', form, limitFetch),
  error => {
    assert.ok(error instanceof SiteCoreError);
    assert.equal(error.code, 'PLAN_USAGE_LIMIT_REACHED');
    assert.equal(error.status, 429);
    assert.equal(error.basicProtection.available, true);
    assert.deepEqual(error.basicProtection.nextSafeAction, ['추가 입력·설치·송금을 중지하세요.']);
    return true;
  },
);

console.log('SCAM_SHIELD_CONNECTION_01 PASS');
