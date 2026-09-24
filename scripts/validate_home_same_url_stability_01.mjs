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
const footerCss=read('footer-business-info.css');
const footerJs=read('site-footer-legal.js');

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
const syncStart=continuity.indexOf('export async function synchronizeAccountContinuity()');
const syncEnd=continuity.indexOf('\nfunction handleSiteSessionState',syncStart);
const sync=continuity.slice(syncStart,syncEnd);
const explicitFalse=sync.slice(sync.indexOf('if (authenticated === false) {'),sync.indexOf('if (siteLogoutSuppressed'));
assert.ok(explicitFalse.includes('markAnonymousAccountUi()'),'only explicit authenticated:false may establish logged-out presentation');
const catchBody=sync.slice(sync.indexOf('} catch (error) {'),sync.indexOf('} finally {'));
assert.ok(catchBody.includes('if (hasLiveSiteSession()) markAuthenticatedAccountUi()'));
assert.ok(catchBody.includes('else markUnknownAccountUi()'));
assert.ok(!catchBody.includes('markAnonymousAccountUi()'),'network/timeout/5xx/contract errors must never become false logout');

const details=index.match(/<details\b[^>]*data-footer-legal-disclosure[^>]*>/)?.[0]||'';
const summary=index.match(/<summary\b[\s\S]*?data-footer-legal-toggle[\s\S]*?>/)?.[0]||'';
assert.ok(details && summary);
assert.ok(!/\bopen\b/.test(details),'mobile footer must be compact before any JS executes');
assert.ok(!/\bhidden\b/.test(summary),'no-JS native disclosure must remain operable');
assert.ok(footerCss.includes('.footer-legal-disclosure:not([open]) + .footer-legal-panels'));
assert.ok(footerCss.includes('.footer-legal-disclosure[open] + .footer-legal-panels'));
assert.ok(!footerCss.includes('body.footer-legal-collapsed'),'hydration-only collapse is the FOUC regression');
assert.ok(footerJs.includes("list.appendChild(panels)"));
assert.ok(footerJs.includes("disclosure.insertAdjacentElement('afterend', panels)"));
assert.ok(!/cloneNode|innerHTML\s*=/.test(footerJs));

console.log('SITE-HOME-FIRST-PAINT-STABILITY-01 PASS');
console.log('SITE-AUTH-UNKNOWN-STATE-01 PASS');
console.log('SITE-MOBILE-FOOTER-NO-FOUC-01 PASS');
