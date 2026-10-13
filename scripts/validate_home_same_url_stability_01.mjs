// SITE-HOME-FIRST-PAINT-STABILITY-01
// SITE-AUTH-UNKNOWN-STATE-01
// SITE-MOBILE-FOOTER-NO-FOUC-01
// Static mutation guards for the exact regressions observed on the same Home URL.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');
const index=read('index.html');
const auth=read('site-auth.js');
const continuity=read('site-continuity.js');
const authCss=read('site-auth-continuity.css');

const httpsUpgrade=index.indexOf('SITE-AUTH-HTTPS-ORIGIN-01');
const firstStylesheet=index.indexOf('<link rel="stylesheet"');
assert.ok(httpsUpgrade > 0 && httpsUpgrade < firstStylesheet,'HTTP custom-domain entry must upgrade before Account continuity runtime');
assert.ok(index.includes("secureUrl.protocol = 'https:'"));
assert.ok(index.includes("secureUrl.hostname = 'lotbiai.com'"));
assert.ok(index.includes("window.location.replace(secureUrl.href)"));

const header=index.match(/<nav class="account-actions"[\s\S]*?<\/nav>/)?.[0]||'';
assert.ok(header.includes('data-auth-state="checking"'));
assert.ok(header.includes('계정 확인 중'),'first paint must not contain an invisible account hole');
assert.ok(!header.includes('>로그인<'),'first paint must not flash a false logged-out state');
assert.ok(!header.includes('>회원가입<'),'first paint must not flash a false logged-out state');
assert.ok(authCss.includes('display: inline-flex'));
assert.ok(!authCss.includes('visibility: hidden'));

assert.ok(auth.includes('export const ACCOUNT_SESSION_STATUS_TIMEOUT_MS = 5000'));
assert.ok(auth.includes('Promise.race([request, timeout])'));
assert.ok(auth.includes("ACCOUNT_SESSION_STATUS_TIMEOUT"));
assert.ok(auth.includes("credentials: 'include'"));
assert.ok(auth.includes("cache: 'no-store'"));

assert.ok(continuity.includes("export const AUTH_STATE_UNKNOWN = 'unknown'"));
assert.ok(continuity.includes('ACCOUNT_STATUS_RETRY_DELAYS_MS = Object.freeze([1000, 3000, 10000])'));
assert.ok(continuity.includes('scheduleUnknownRetry()'));
assert.ok(continuity.includes("button.textContent = '다시 확인'"));
assert.ok(continuity.includes("link.textContent = '로그인'"));
assert.ok(continuity.includes('다시 확인하거나 로그인해 주세요.'));
const syncStart=continuity.indexOf('export async function synchronizeAccountContinuity');
const syncEnd=continuity.indexOf('\nfunction handleSiteSessionState',syncStart);
const sync=continuity.slice(syncStart,syncEnd);
const explicitFalse=sync.slice(sync.indexOf('if (authenticated === false) {'),sync.indexOf('if (siteLogoutSuppressed'));
assert.ok(explicitFalse.includes('markAnonymousAccountUi()'),'only explicit authenticated:false may establish logged-out presentation');
const catchBody=sync.slice(sync.indexOf('} catch (error) {'),sync.indexOf('} finally {'));
assert.ok(catchBody.includes('if (hasLiveSiteSession()) {'));
assert.ok(catchBody.includes('markAuthenticatedAccountUi();'));
assert.ok(catchBody.includes('markUnknownAccountUi()'));
assert.ok(catchBody.includes('scheduleUnknownRetry()'));
assert.ok(!catchBody.includes('markAnonymousAccountUi()'),'network/timeout/5xx/contract errors must never become false logout');

assert.equal((index.match(/class="company-legal"/g)||[]).length,1,'one company information block');
assert.equal((index.match(/id="footer-legal-panels"/g)||[]).length,1,'one visible footer panel source');
assert.ok(!index.includes('data-footer-legal-disclosure'),'company information must not be behind a disclosure');
assert.ok(!index.includes('data-footer-legal-toggle'),'company information must not require a click');
assert.ok(!index.includes('site-footer-legal.js'),'company information must not move into a sheet');

console.log('SITE-HOME-FIRST-PAINT-STABILITY-01 PASS');
console.log('SITE-AUTH-UNKNOWN-STATE-01 PASS');
console.log('SITE-HOME-FOOTER-DIRECT-VISIBILITY-01 PASS');
