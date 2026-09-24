// SITE-NORMAL-ASSURANCE-01
//
// 2026-09-24, 대표님 화면: lotbiai.com 접속 →
// "LOTBI 연결 오류 / LOTBI Site 세션 응답이 올바르지 않습니다."
//
// 원인: Core 가 소셜 로그인(Kakao/Google/Naver) 세션을 FEDERATED_LIMITED 로
// 정상 발급하는데, Site 는 'FULL' 문자열만 비교했다. redeem 은 200 으로
// 성공하고 그 직후 Site 의 응답 계약 검사에서 튕겼다.
//
// 이 게이트가 존재하는 이유는 따로 있다. 회귀 당시 Site 테스트 전체가
// assurance_level 을 'FULL' 로만 스텁했다 —
//   validate_identity_profile_hotfix_02.mjs / validate_profile_menu_improvement_01.mjs
//   / validate_profile_menu_personal_theme_01.mjs / validate_conversation_integration.mjs
//   / validate_auth_root_entry_continuity_01.mjs
// 전부 'FULL'. 그래서 "Site 가 FULL 을 받는다" 는 증명됐지만 "승인된 다른 정상
// 소비자 레벨에서 무슨 일이 나는가" 는 아무도 재지 않았다. 아래 2·3·5 가 그
// 빈칸을 메운다.
//
// 이 파일은 허용 목록을 **좁게** 지킨다. NORMAL_SITE_ASSURANCE_LEVELS 에
// RECOVERY_LIMITED 같은 제한 세션이 섞여 들어오면 떨어진다.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const {
  NORMAL_SITE_ASSURANCE_LEVELS,
  isNormalSiteAssurance,
  redeemSiteHandoff,
  getCurrentSiteUser,
  SiteCoreError,
  SITE_AUDIENCE,
  SITE_CALLBACK_URI,
} = await import('../site-core.js');

const VERIFIER = 'a'.repeat(43);
const STATE = 'b'.repeat(43);
const CODE = 'c'.repeat(50);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
}

function redeemPayload(assurance) {
  return {
    session_token: 'st_' + 'd'.repeat(32),
    session_type: 'Bearer',
    assurance_level: assurance,
    audience: SITE_AUDIENCE,
    session_id: 'sess_1',
    installation_id: 'inst_1',
    expires_at: '2099-01-01T00:00:00Z',
  };
}

function mePayload(assurance) {
  return {
    user: {id: 'usr_1', name: '홍길동', account_handle: 'hong', email: 'hong@example.com'},
    session: {id: 'sess_1', assurance_level: assurance, expires_at: '2099-01-01T00:00:00Z'},
    installation: {id: 'inst_1'},
  };
}

const redeem = assurance => redeemSiteHandoff(
  {handoffCode: CODE, state: STATE, codeVerifier: VERIFIER},
  async () => json(redeemPayload(assurance)),
);
const me = assurance => getCurrentSiteUser('st_' + 'd'.repeat(32), async () => json(mePayload(assurance)));

// ── 허용 목록 자체 ────────────────────────────────────────────────────────
// Core 의 app/consumer_auth.py:21 NORMAL_CONSUMER_ASSURANCE_LEVELS 와 같아야 한다.
assert.deepEqual([...NORMAL_SITE_ASSURANCE_LEVELS].sort(), ['FEDERATED_LIMITED', 'FULL']);
assert.ok(Object.isFrozen(NORMAL_SITE_ASSURANCE_LEVELS));
for (const allowed of ['FULL', 'FEDERATED_LIMITED']) {
  assert.equal(isNormalSiteAssurance(allowed), true, `${allowed} 는 정상 소비자 레벨이다`);
}
// 제한 세션과 쓰레기값은 절대 통과하지 못한다.
for (const denied of [
  'RECOVERY_LIMITED', 'PASSWORD_LIMITED', 'STEP_UP_REQUIRED', 'NONE', 'LIMITED',
  'full', 'federated_limited', 'FULL ', ' FULL', '', 'FULL,FEDERATED_LIMITED',
  undefined, null, 0, 1, true, {}, [], ['FULL'],
]) {
  assert.equal(isNormalSiteAssurance(denied), false, `${JSON.stringify(denied)} 는 거부돼야 한다`);
}

// ── 1. FULL handoff redeem → GREEN ───────────────────────────────────────
{
  const session = await redeem('FULL');
  assert.equal(session.sessionId, 'sess_1');
  assert.equal(session.installationId, 'inst_1');
  assert.ok(session.sessionToken);
}

// ── 2. FEDERATED_LIMITED handoff redeem → GREEN (회귀 지점) ──────────────
{
  const session = await redeem('FEDERATED_LIMITED');
  assert.equal(session.sessionId, 'sess_1', '소셜 로그인 세션도 redeem 이 성립해야 한다');
  assert.ok(session.sessionToken, 'FEDERATED_LIMITED 에서 Site 세션 토큰이 나와야 한다');
}

// ── 3. FEDERATED_LIMITED /v2/me → GREEN ─────────────────────────────────
{
  const identity = await me('FEDERATED_LIMITED');
  assert.equal(identity.userId, 'usr_1');
  assert.equal(identity.sessionId, 'sess_1');
  assert.equal(identity.installationId, 'inst_1');
}
{
  const identity = await me('FULL');
  assert.equal(identity.userId, 'usr_1');
}

// ── 4·5. 허용되지 않은 assurance → fail closed ───────────────────────────
// 4 는 잘못된/없는 값, 5 는 실재하지만 Site 에 허용되지 않은 제한 세션이다.
for (const [label, assurance] of [
  ['invalid', 'BOGUS_LEVEL'],
  ['missing', undefined],
  ['empty', ''],
  ['lowercase', 'full'],
  ['RECOVERY_LIMITED', 'RECOVERY_LIMITED'],
]) {
  let caught;
  try { await redeem(assurance); } catch (error) { caught = error; }
  assert.ok(caught instanceof SiteCoreError, `redeem ${label}: fail closed 여야 한다`);
  assert.equal(caught.code, 'SITE_SESSION_CONTRACT_INVALID', `redeem ${label}: 계약 위반 코드`);

  let caughtMe;
  try { await me(assurance); } catch (error) { caughtMe = error; }
  assert.ok(caughtMe instanceof SiteCoreError, `/v2/me ${label}: fail closed 여야 한다`);
  assert.equal(caughtMe.code, 'SITE_IDENTITY_CONTRACT_INVALID', `/v2/me ${label}: 계약 위반 코드`);
}

// 나머지 계약은 그대로다 — assurance 만 넓혔고 다른 검사를 무력화하지 않았다.
for (const [label, patch] of [
  ['session_type', {session_type: 'Basic'}],
  ['audience', {audience: 'evil.example'}],
  ['missing token', {session_token: ''}],
]) {
  let caught;
  try {
    await redeemSiteHandoff(
      {handoffCode: CODE, state: STATE, codeVerifier: VERIFIER},
      async () => json({...redeemPayload('FEDERATED_LIMITED'), ...patch}),
    );
  } catch (error) { caught = error; }
  assert.ok(caught instanceof SiteCoreError, `redeem ${label}: 여전히 거부돼야 한다`);
  assert.equal(caught.code, 'SITE_SESSION_CONTRACT_INVALID');
}

// ── 6. PKCE / state / verifier / replay 계약 유지 ─────────────────────────
// 클라이언트 측 입력 검증이 그대로인지, 그리고 요청이 PKCE 결합을 그대로
// 보내는지 확인한다. assurance 를 넓힌 수정이 여기를 건드리면 안 된다.
for (const [label, args, code] of [
  ['short code', {handoffCode: 'x', state: STATE, codeVerifier: VERIFIER}, 'SITE_HANDOFF_CODE_INVALID'],
  ['short state', {handoffCode: CODE, state: 'x', codeVerifier: VERIFIER}, 'SITE_HANDOFF_STATE_INVALID'],
  ['short verifier', {handoffCode: CODE, state: STATE, codeVerifier: 'x'}, 'SITE_HANDOFF_VERIFIER_INVALID'],
  ['no verifier', {handoffCode: CODE, state: STATE, codeVerifier: ''}, 'SITE_HANDOFF_VERIFIER_INVALID'],
]) {
  let caught;
  try {
    await redeemSiteHandoff(args, async () => { throw new Error('네트워크에 도달해선 안 된다'); });
  } catch (error) { caught = error; }
  assert.ok(caught instanceof SiteCoreError, `${label}: 거부돼야 한다`);
  assert.equal(caught.code, code, `${label}: ${code}`);
}
{
  // 요청 본문이 PKCE·state·audience·callback_uri 를 그대로 싣는지.
  let sent;
  await redeemSiteHandoff({handoffCode: CODE, state: STATE, codeVerifier: VERIFIER}, async (url, init) => {
    sent = {url, init, body: JSON.parse(init.body)};
    return json(redeemPayload('FEDERATED_LIMITED'));
  });
  assert.equal(sent.url, 'https://api.lotbiai.com/v2/sessions/handoffs/redeem');
  assert.equal(sent.init.method, 'POST');
  assert.equal(sent.init.credentials, 'omit', 'redeem 은 쿠키를 싣지 않는다');
  assert.equal(sent.body.code_verifier, VERIFIER, 'code_verifier 가 그대로 전달돼야 한다');
  assert.equal(sent.body.state, STATE);
  assert.equal(sent.body.handoff_code, CODE);
  assert.equal(sent.body.audience, SITE_AUDIENCE);
  assert.equal(sent.body.callback_uri, SITE_CALLBACK_URI);
}
{
  // replay 는 Core 가 판정한다. Site 는 그 거부를 삼키지 않고 그대로 올린다.
  let caught;
  try {
    await redeemSiteHandoff({handoffCode: CODE, state: STATE, codeVerifier: VERIFIER},
      async () => json({detail: {code: 'SITE_HANDOFF_REPLAY_OR_INVALID', message: 'replay'}}, 400));
  } catch (error) { caught = error; }
  assert.ok(caught instanceof SiteCoreError);
  assert.equal(caught.code, 'SITE_HANDOFF_REPLAY_OR_INVALID', 'replay 거부가 그대로 전달돼야 한다');
}

// ── 7. logout suppression 계약 유지 ──────────────────────────────────────
{
  const auth = await import('../site-auth.js');
  assert.equal(auth.SITE_LOGOUT_SUPPRESSION_KEY, 'lotbi.site-logout-suppression.v1');
  assert.equal(auth.SITE_LOGOUT_SUPPRESSION_TTL_MS, 10 * 60 * 1000);
  const data = new Map();
  const storage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key),
  };
  assert.equal(auth.hasSiteLogoutSuppression(1_000, storage), false);
  assert.equal(auth.markSiteLogoutSuppression(1_000, storage), true);
  assert.equal(auth.hasSiteLogoutSuppression(1_001, storage), true);
  auth.clearSiteLogoutSuppression(storage);
  assert.equal(auth.hasSiteLogoutSuppression(1_002, storage), false);
}

// ── 8. 익명 / guest 회귀 없음 ────────────────────────────────────────────
// assurance 검사는 authenticated 경로에만 있다. guest 세션 발급과 guest 대화는
// assurance 를 보지 않으므로 이 수정에 영향받지 않아야 한다.
{
  const core = readFileSync(path.join(ROOT, 'site-core.js'), 'utf8');
  const guestStart = core.indexOf('export async function createGuestConversationSession');
  const guestEnd = core.indexOf('\nexport async function', guestStart + 10);
  const guestBody = core.slice(guestStart, guestEnd);
  assert.ok(guestStart >= 0, 'guest 세션 발급이 남아 있어야 한다');
  assert.ok(!guestBody.includes('assurance'), 'guest 경로는 assurance 를 보지 않는다');
  assert.ok(!guestBody.includes('isNormalSiteAssurance'), 'guest 경로에 assurance 게이트가 새로 끼어들면 안 된다');

  // assurance 검사는 정확히 두 곳뿐이고, 둘 다 공통 helper 를 쓴다.
  assert.equal(
    (core.match(/isNormalSiteAssurance\(/g) || []).length, 3,
    'helper 정의 1 + 호출 2 (redeem 계약, /v2/me 신원 계약)',
  );
  assert.ok(
    !/assurance_level !== 'FULL'/.test(core),
    "'FULL' 단독 비교가 남아 있으면 한쪽만 다시 stale 된다",
  );
  assert.ok(
    !/assurance_level === 'FULL'/.test(core),
    "assurance 판정은 helper 하나로만 한다",
  );
}

// ── 민감 권한을 Site 에서 넓히지 않았다 ──────────────────────────────────
// 권한 경계는 Core 의 require_session_access() 다. Site 는 그 거부를 사용자에게
// 보여줄 뿐이고, 그 메시지가 살아 있어야 한다.
{
  const pet = readFileSync(path.join(ROOT, 'site-pet.js'), 'utf8');
  assert.ok(
    pet.includes('FEDERATED_SESSION_LIMITED'),
    'Core 의 FEDERATED_SESSION_LIMITED 거부를 사용자에게 설명하는 문구가 유지돼야 한다',
  );
  const core = readFileSync(path.join(ROOT, 'site-core.js'), 'utf8');
  // Site 가 스스로 민감 기능을 허용 판정하지 않는다는 확인: assurance 를 보고
  // 분기하는 곳이 위 두 응답 계약 검사 외에 없다.
  assert.equal(
    (core.match(/assurance_level/g) || []).length, 2,
    'assurance_level 을 읽는 곳은 두 응답 계약 검사뿐이어야 한다',
  );
}

console.log('SITE-NORMAL-ASSURANCE-01 PASS — FULL + FEDERATED_LIMITED 수용, 제한 세션 fail closed, PKCE/state/replay/logout 계약 유지');
