import assert from 'node:assert/strict';
import fs from 'node:fs';
import {getCurrentSiteUser, updateCurrentSiteProfile} from '../site-core.js?identity-profile-hotfix-test=2';

const syntheticHandle = 'e1' + 'a'.repeat(20);

function mePayload({name = null, publicHandle = null} = {}) {
  return {
    user: {
      id: 'usr-email-first',
      name,
      account_handle: syntheticHandle,
      public_handle: publicHandle,
      email: 'jshncd02@naver.com',
      email_verified: false,
      account_handle_is_synthetic: true,
    },
    session: {id: 'ses-1', assurance_level: 'FULL', expires_at: '2099-01-01T00:00:00Z'},
    installation: {id: 'install-1'},
  };
}

const hidden = await getCurrentSiteUser('fixture-session', async (url, init) => {
  assert.equal(String(url).endsWith('/v2/me'), true);
  assert.equal(init.method, 'GET');
  assert.equal(new Headers(init.headers).get('authorization'), 'Bearer fixture-session');
  return Response.json(mePayload());
});
assert.equal(hidden.name, '');
assert.equal(hidden.email, 'jshncd02@naver.com');
assert.equal(hidden.publicHandle, '');
assert.equal(hidden.accountHandle, '');
assert.equal(JSON.stringify(hidden).includes(syntheticHandle), false);

const separated = await getCurrentSiteUser('fixture-session', async () => Response.json(
  mePayload({name: 'jshncd02', publicHandle: 'jshncd02'}),
));
assert.equal(separated.publicHandle, 'jshncd02');
assert.equal(separated.accountHandle, 'jshncd02');
assert.equal(JSON.stringify(separated).includes(syntheticHandle), false);

let updateRequest;
const updated = await updateCurrentSiteProfile('fixture-session', {
  displayName: 'jshncd02',
  publicHandle: 'JSHNCD02',
}, async (url, init) => {
  updateRequest = {url: String(url), init};
  return Response.json({user: mePayload({name: 'jshncd02', publicHandle: 'jshncd02'}).user});
});
assert.equal(updateRequest.url.endsWith('/v2/account/profile'), true);
assert.equal(updateRequest.init.method, 'PUT');
assert.equal(new Headers(updateRequest.init.headers).get('content-type'), 'application/json');
assert.deepEqual(JSON.parse(updateRequest.init.body), {
  display_name: 'jshncd02',
  public_handle: 'jshncd02',
});
assert.deepEqual(updated, {
  userId: 'usr-email-first',
  name: 'jshncd02',
  email: 'jshncd02@naver.com',
  publicHandle: 'jshncd02',
  accountHandle: 'jshncd02',
});

const conversation = fs.readFileSync(new URL('../site-conversation.js', import.meta.url), 'utf8');
const continuity = fs.readFileSync(new URL('../site-continuity.js', import.meta.url), 'utf8');
assert.match(conversation, /serverIdentity\?\.publicHandle/);
assert.equal(conversation.includes('serverIdentity?.accountHandle'), false);
assert.match(conversation, /return serverIdentity\.publicHandle/);
assert.equal(conversation.includes("serverIdentity?.email || '프로필 메뉴'"), false);
assert.equal(continuity.includes("primary.textContent = '로그인된 사용자'"), false);
assert.match(continuity, /primary\.textContent = 'LOTBI 사용자'/);

console.log('SITE-ACCOUNT-IDENTITY-PROFILE-HOTFIX-02 PASS');
