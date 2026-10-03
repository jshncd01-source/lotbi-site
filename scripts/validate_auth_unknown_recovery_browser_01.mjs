// SITE-AUTH-UNKNOWN-RECOVERY-BROWSER-01
// Actual Chromium runtime evidence for UNKNOWN recovery and HTTPS origin upgrade.
// Other browser names in the product matrix remain standards-contract coverage,
// not physical Safari/Samsung engine evidence.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const PORT=4271;
const ORIGIN='http://127.0.0.1:'+PORT;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function browserPath(){
  for(const candidate of [process.env.CHROME_BIN,'google-chrome-stable','google-chrome','chromium','chromium-browser'].filter(Boolean)){
    if(candidate.includes('/')&&fs.existsSync(candidate)) return candidate;
    const found=spawnSync('which',[candidate],{encoding:'utf8'});
    if(found.status===0&&found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required for auth recovery browser validation.');
}
async function waitFor(check,label,timeout=12000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    const value=await check();
    if(value)return value;
    await delay(50);
  }
  throw new Error('timeout: '+label);
}
async function connect(url){
  const ws=new WebSocket(url);
  await new Promise((resolve,reject)=>{
    ws.addEventListener('open',resolve,{once:true});
    ws.addEventListener('error',reject,{once:true});
  });
  let id=0;
  const pending=new Map();
  const events=[];
  ws.addEventListener('message',event=>{
    const message=JSON.parse(event.data);
    if(!message.id){events.push(message);return;}
    const job=pending.get(message.id);
    if(!job)return;
    pending.delete(message.id);
    message.error?job.reject(new Error(JSON.stringify(message.error))):job.resolve(message.result);
  });
  const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{
    const messageId=++id;
    pending.set(messageId,{resolve,reject});
    const message={id:messageId,method,params};
    if(sessionId)message.sessionId=sessionId;
    ws.send(JSON.stringify(message));
  });
  return{ws,send,events};
}
async function evaluate(send,expression){
  const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'evaluation failed');
  return result.result.value;
}
function contentType(file){
  if(file.endsWith('.js')||file.endsWith('.mjs'))return 'text/javascript; charset=utf-8';
  if(file.endsWith('.css'))return 'text/css; charset=utf-8';
  if(file.endsWith('.html'))return 'text/html; charset=utf-8';
  return 'application/octet-stream';
}

const index=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const upgradeMatch=index.match(/<!-- SITE-AUTH-HTTPS-ORIGIN-01[\s\S]*?<script>([\s\S]*?)<\/script>/);
assert.ok(upgradeMatch,'HTTPS origin bootstrap missing from Home');
const upgradeScript=upgradeMatch[1];

const fixture=`<!doctype html><html lang="ko"><head><meta charset="utf-8"></head><body>
<nav class="account-actions" data-auth-state="checking" aria-busy="true"><span class="account-auth-placeholder">계정 확인 중</span></nav>
<div data-sidebar-account data-auth-state="checking" aria-busy="true"><span class="sidebar-account-placeholder"></span></div>
<script>
window.__authStatusCalls=[];
let statusAttempt=0;
const statusBody={contract_id:'ACCOUNT-SITE-SESSION-STATUS-01',schema_version:1,authenticated:false};
const nativeFetch=globalThis.fetch.bind(globalThis);
globalThis.fetch=async (url,init)=>{
  if(String(url)==='https://account.lotbiai.com/api/auth/site-session-status'){
    window.__authStatusCalls.push(performance.now());
    statusAttempt+=1;
    if(statusAttempt===1){
      await new Promise(resolve=>setTimeout(resolve,100));
      throw new TypeError('simulated Account transport failure');
    }
    return new Response(JSON.stringify(statusBody),{status:200,headers:{'Content-Type':'application/json'}});
  }
  return nativeFetch(url,init);
};
<\/script>
<script type="module" src="/site-continuity.js?v=browser-auth-recovery"></script>
</body></html>`;
const redirectFixture=`<!doctype html><html><head><meta charset="utf-8"><script>${upgradeScript}<\/script></head><body>redirect probe</body></html>`;

const server=http.createServer((req,res)=>{
  const url=new URL(req.url||'/',ORIGIN);
  if(url.pathname==='/'){
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
    res.end(fixture);
    return;
  }
  if(url.pathname==='/redirect-fixture'){
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
    res.end(redirectFixture);
    return;
  }
  const rel=decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file=path.resolve(ROOT,rel);
  if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){
    res.writeHead(404);res.end('not found');return;
  }
  res.writeHead(200,{'Content-Type':contentType(file),'Cache-Control':'no-store'});
  fs.createReadStream(file).pipe(res);
});

await new Promise((resolve,reject)=>{
  server.once('error',reject);
  server.listen(PORT,'127.0.0.1',resolve);
});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'lotbi-auth-recovery-'));
let chrome;
try{
  chrome=spawn(browserPath(),[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
    '--remote-debugging-port=0',`--user-data-dir=${profile}`,
    '--host-resolver-rules=MAP lotbiai.com 127.0.0.1,MAP www.lotbiai.com 127.0.0.1',
    'about:blank'
  ],{stdio:'ignore'});
  const activePort=path.join(profile,'DevToolsActivePort');
  await waitFor(()=>fs.existsSync(activePort),'DevTools port');
  const [debugPort,debugPath]=fs.readFileSync(activePort,'utf8').trim().split('\n');
  assert.match(debugPort,/^[1-9][0-9]*$/,'DevTools port must be numeric');
  assert.ok(debugPath?.startsWith('/devtools/browser/'),'DevTools browser endpoint missing');

  async function target(url){
    const browser=await waitFor(async()=>{
      try{return await connect(`ws://127.0.0.1:${debugPort}${debugPath}`);}
      catch{return false;}
    },'DevTools browser endpoint');
    const created=await browser.send('Target.createTarget',{url:'about:blank'});
    const attached=await browser.send('Target.attachToTarget',{targetId:created.targetId,flatten:true});
    const send=(method,params={})=>browser.send(method,params,attached.sessionId);
    const c={ws:browser.ws,send,events:browser.events};
    await c.send('Runtime.enable');
    await c.send('Page.enable');
    await c.send('Network.enable');
    await c.send('Page.navigate',{url});
    return c;
  }

  {
    const c=await target(ORIGIN+'/?scenario=manual');
    await waitFor(async()=>{
      try{return (await evaluate(c.send,'document.body.dataset.siteAuthState'))==='unknown';}catch{return false;}
    },'manual UNKNOWN');
    const unknown=await evaluate(c.send,`(()=>({
      state:document.body.dataset.siteAuthState,
      retry:document.querySelector('.account-auth-retry')?.textContent||'',
      login:document.querySelector('.account-auth-login')?.textContent||'',
      sidebar:document.querySelector('.sidebar-account-handle')?.textContent||'',
      calls:window.__authStatusCalls.length
    }))()`);
    assert.equal(unknown.state,'unknown');
    assert.equal(unknown.retry,'다시 확인');
    assert.equal(unknown.login,'로그인');
    assert.equal(unknown.sidebar,'다시 확인하거나 로그인해 주세요.');
    assert.equal(unknown.calls,1);
    await evaluate(c.send,"document.querySelector('.account-auth-retry').click(); true");
    await waitFor(async()=>{
      try{return (await evaluate(c.send,'document.body.dataset.siteAuthState'))==='unauthenticated';}catch{return false;}
    },'manual authoritative unauthenticated');
    assert.equal(await evaluate(c.send,'window.__authStatusCalls.length'),2);
    c.ws.close();
  }

  {
    const c=await target(ORIGIN+'/?scenario=auto');
    await waitFor(async()=>{
      try{return (await evaluate(c.send,'document.body.dataset.siteAuthState'))==='unknown';}catch{return false;}
    },'automatic UNKNOWN');
    await waitFor(async()=>{
      try{return (await evaluate(c.send,'document.body.dataset.siteAuthState'))==='unauthenticated';}catch{return false;}
    },'automatic retry recovery',5000);
    const calls=await evaluate(c.send,'window.__authStatusCalls.slice()');
    assert.equal(calls.length,2);
    assert.ok(calls[1]-calls[0]>=700,'first automatic retry must not collapse into immediate polling');
    c.ws.close();
  }

  {
    const c=await target(`http://lotbiai.com:${PORT}/redirect-fixture?probe=1#keep`);
    await waitFor(()=>c.events.find(event=>event.method==='Network.requestWillBeSent'
      && String(event.params?.request?.url||'').startsWith('https://lotbiai.com/redirect-fixture?probe=1'))||false,
      'HTTP→HTTPS navigation');
    assert.ok(c.events.some(event=>event.method==='Network.requestWillBeSent'
      && String(event.params?.request?.url||'').startsWith('https://lotbiai.com/redirect-fixture?probe=1')));
    c.ws.close();
  }

  console.log('SITE-AUTH-UNKNOWN-RECOVERY-BROWSER-01 PASS');
} finally {
  if (chrome && chrome.exitCode === null) {
    const exited = new Promise(resolve => chrome.once('exit', resolve));
    chrome.kill('SIGTERM');
    await Promise.race([exited, delay(2000)]);
  }
  await new Promise(resolve=>server.close(resolve));
  fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
