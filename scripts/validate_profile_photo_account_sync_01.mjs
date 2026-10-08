// PROFILE-PHOTO-ACCOUNT-SYNC-01 — the Site reads and writes the ACCOUNT's
// profile photo in Core (the same one Account and the App show) instead of a
// browser-only copy. Unit checks of the site-core client plus source contracts;
// the picker runtime is covered by validate_profile_menu_personal_theme_01.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const {
  CORE_ORIGIN,
  SiteCoreError,
  deleteSiteProfilePhoto,
  fetchSiteProfilePhotoObjectUrl,
  getCurrentSiteUser,
  normalizeSiteProfilePhoto,
  saveSiteProfilePhoto,
} = await import('../site-core.js');

const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
const me = photo => ({
  user: {id: 'user-1', name: '전주aa', email: 'a@example.test', ...(photo === undefined ? {} : {profile_photo: photo})},
  session: {id: 'session-1', assurance_level: 'FULL', expires_at: '2030-01-01T00:00:00Z'},
  installation: {id: 'installation-1'},
});

// /v2/me: the version is read leniently — a bad value never breaks sign-in.
for (const [value, expected] of [
  [undefined, null],
  [null, null],
  [{version: 'mda_0123456789abcdef0123'}, {version: 'mda_0123456789abcdef0123'}],
  [{version: ''}, null],
  [{version: '../../etc/passwd'}, null],
  [{version: 7}, null],
  ['mda_x', null],
]) {
  const identity = await getCurrentSiteUser('site-token', async () => json(me(value)));
  assert.deepEqual(identity.profilePhoto, expected, JSON.stringify(value));
  assert.equal(identity.userId, 'user-1');
  assert.deepEqual(normalizeSiteProfilePhoto(value), expected);
}

// Save: authenticated JSON PUT of a normalized image data URI; the response must carry the new version.
{
  const calls = [];
  const photo = await saveSiteProfilePhoto('site-token', 'data:image/webp;base64,UklGRg==', async (url, init) => {
    calls.push({url, init});
    return json({profile_photo: {version: 'mda_new000000000000000001', content_path: '/v2/account/profile/photo/content?v=mda_new000000000000000001'}});
  });
  assert.deepEqual(photo, {version: 'mda_new000000000000000001'});
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${CORE_ORIGIN}/v2/account/profile/photo`);
  assert.equal(calls[0].init.method, 'PUT');
  assert.equal(calls[0].init.credentials, 'omit');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer site-token');
  assert.deepEqual(JSON.parse(calls[0].init.body), {photo_data_uri: 'data:image/webp;base64,UklGRg=='});
}
for (const bad of ['data:image/svg+xml;base64,PHN2Zz4=', 'https://evil.example/a.jpg', '', null]) {
  let called = false;
  await assert.rejects(saveSiteProfilePhoto('site-token', bad, async () => { called = true; return json({}); }),
    error => error instanceof SiteCoreError && error.code === 'SITE_PROFILE_PHOTO_UNSUPPORTED');
  assert.equal(called, false, 'non-image input never leaves the browser');
}
await assert.rejects(saveSiteProfilePhoto('site-token', 'data:image/jpeg;base64,/9j/', async () => json({profile_photo: null})),
  error => error.code === 'SITE_PROFILE_PHOTO_CONTRACT_INVALID', 'a save without a version is not a save');
await assert.rejects(saveSiteProfilePhoto('site-token', 'data:image/jpeg;base64,/9j/', async () => json({detail: {code: 'PROFILE_PHOTO_INVALID'}}, 503)),
  error => error instanceof SiteCoreError);

// Delete.
{
  const calls = [];
  await deleteSiteProfilePhoto('site-token', async (url, init) => { calls.push({url, init}); return json({profile_photo: null}); });
  assert.equal(calls[0].url, `${CORE_ORIGIN}/v2/account/profile/photo`);
  assert.equal(calls[0].init.method, 'DELETE');
  await assert.rejects(deleteSiteProfilePhoto('site-token', async () => json({profile_photo: {version: 'mda_x'}})),
    error => error.code === 'SITE_PROFILE_PHOTO_CONTRACT_INVALID');
}

// Bytes: owner-only route, bearer header, version as the cache key, JPEG only, in-memory URL.
{
  const calls = [];
  const url = await fetchSiteProfilePhotoObjectUrl('site-token', {version: 'mda_new000000000000000001'}, async (target, init) => {
    calls.push({target, init});
    return new Response(new Blob([new Uint8Array([255, 216, 255])], {type: 'image/jpeg'}), {status: 200, headers: {'Content-Type': 'image/jpeg'}});
  });
  assert.match(url, /^blob:/);
  URL.revokeObjectURL(url);
  assert.equal(calls[0].target, `${CORE_ORIGIN}/v2/account/profile/photo/content?v=mda_new000000000000000001`);
  assert.equal(calls[0].init.headers.Authorization, 'Bearer site-token');
  assert.equal(calls[0].init.credentials, 'omit');
  assert.equal(calls[0].init.cache, 'no-store');
  await assert.rejects(fetchSiteProfilePhotoObjectUrl('site-token', {version: 'mda_new000000000000000001'},
    async () => new Response('<svg/>', {status: 200, headers: {'Content-Type': 'image/svg+xml'}})),
  error => error.code === 'SITE_PROFILE_PHOTO_CONTRACT_INVALID');
  await assert.rejects(fetchSiteProfilePhotoObjectUrl('site-token', {version: 'mda_new000000000000000001'}, async () => json({}, 404)),
    error => error.code === 'SITE_PROFILE_PHOTO_UNAVAILABLE');
  await assert.rejects(fetchSiteProfilePhotoObjectUrl('site-token', {version: '../x'}, async () => { throw new Error('must not fetch'); }),
    error => error.code === 'SITE_PROFILE_PHOTO_CONTRACT_INVALID');
}

// Source contracts.
const conversation = read('site-conversation.js');
assert.ok(!conversation.includes('preferences.photo'), 'no browser-only photo');
assert.ok(!/photo:\s*typeof loadedPreferences\.photo/.test(conversation), 'old stored photos are not read back');
assert.ok(conversation.includes("if (Object.prototype.hasOwnProperty.call(loadedPreferences, 'photo')) savePreferences();"), 'old stored image data is purged');
assert.ok(conversation.includes('void syncProfilePhoto(identity.profilePhoto);'), 'the signed-in identity brings the account photo');
assert.match(conversation, /\/\/ A different \(or no\) account must never keep showing the previous photo\.\r?\n\s*clearProfilePhoto\(\);/);
assert.ok(conversation.includes('if (generation !== profilePhotoGeneration || token !== sessionToken) { URL.revokeObjectURL(url); return; }'), 'a late photo for another session is dropped');
assert.ok(!/localStorage[^\n]*profilePhoto|sessionStorage[^\n]*profilePhoto/.test(conversation));
const workflow = read('.github/workflows/site-review.yml');
assert.ok(workflow.includes('node scripts/validate_profile_photo_account_sync_01.mjs'), 'wired into the Public Site Review Gate');

console.log('PROFILE-PHOTO-ACCOUNT-SYNC-01 SITE PASS');
