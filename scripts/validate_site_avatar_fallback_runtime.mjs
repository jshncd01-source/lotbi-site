import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {once} from 'node:events';

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function chromePath(){
  for(const candidate of [process.env.CHROME_BIN,'google-chrome-stable','google-chrome','chromium','chromium-browser'].filter(Boolean)){
    if(candidate.includes('/')&&fs.existsSync(candidate)) return candidate;
    const found=spawnSync('which',[candidate],{encoding:'utf8'});
    if(found.status===0&&found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium required');
}
async function waitFor(check,label,timeout=20000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){const value=await check();if(value)return value;await delay(100);}
  throw new Error(`timeout: ${label}`);
}
async function connect(url){
  const ws=new WebSocket(url);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  let id=0;const pending=new Map(),events=[];
  ws.addEventListener('message',event=>{
    const message=JSON.parse(event.data);
    if(!message.id){events.push(message);return;}
    const job=pending.get(message.id);if(!job)return;pending.delete(message.id);
    message.error?job.reject(new Error(JSON.stringify(message.error))):job.resolve(message.result);
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{const messageId=++id;pending.set(messageId,{resolve,reject});ws.send(JSON.stringify({id:messageId,method,params}));});
  return{ws,send,events};
}
async function evaluate(send,expression){
  const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'evaluation failed');
  return result.result.value;
}

const server=spawn('python3',['-m','http.server','4173','--bind','127.0.0.1'],{stdio:'ignore'});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'lotbi-avatar-fallback-'));
let chrome;
try{
  await waitFor(async()=>{try{return(await fetch('http://127.0.0.1:4173/')).ok;}catch{return false;}},'local server');
  chrome=spawn(chromePath(),[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-software-rasterizer',
    '--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'
  ],{stdio:'ignore'});
  const activePort=path.join(profile,'DevToolsActivePort');
  await waitFor(()=>fs.existsSync(activePort),'DevTools port');
  const [port]=fs.readFileSync(activePort,'utf8').trim().split('\n');
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('http://127.0.0.1:4173/')}`,{method:'PUT'}).then(r=>r.json());
  const{ws,send,events}=await connect(target.webSocketDebuggerUrl);
  await send('Page.enable');await send('Runtime.enable');await send('Log.enable');
  await send('Page.navigate',{url:'http://127.0.0.1:4173/'});
  const snapshotExpression=`(()=>{const wrap=document.querySelector('.chat-character-wrap');const stage=document.querySelector('[data-lotbi-avatar-stage]');return{fallback:wrap?.classList.contains('avatar-3d-fallback')||false,canvasCount:stage?.querySelectorAll('canvas').length||0,snapshot:window.__lotbiSiteAvatar?.snapshot?.()||null};})()`;
  const before=await waitFor(async()=>{try{const value=await evaluate(send,snapshotExpression);return value.fallback?value:null;}catch{return null;}},'terminal fallback',30000);
  await evaluate(send,`(()=>{for(let i=0;i<20;i+=1)document.body.setAttribute('data-avatar-mutation-probe',String(i));return true;})()`);
  await delay(1500);
  const after=await evaluate(send,snapshotExpression);
  const fallbackLogs=events.filter(event=>
    (event.method==='Log.entryAdded'&&event.params?.entry?.text?.includes('LOTBI 3D Avatar fallback'))||
    (event.method==='Runtime.consoleAPICalled'&&event.params?.type==='error'&&event.params?.args?.some(arg=>String(arg.value||arg.description||'').includes('LOTBI 3D Avatar fallback')))
  );
  assert.equal(before.fallback,true);
  assert.equal(after.fallback,true);
  assert.equal(after.canvasCount,0);
  assert.equal(after.snapshot?.state,'fallback');
  assert.equal(after.snapshot?.errorCode,'RUNTIME_INIT_FAILED');
  assert.equal(after.snapshot?.disposals,1,'unsupported WebGL stage must dispose once');
  assert.equal(fallbackLogs.length,1,'unsupported WebGL stage must enter fallback once');
  console.log('SITE-WEB-3D-AVATAR-FALLBACK-RETRY-02 BROWSER PASS',JSON.stringify({before,after,fallbackLogCount:fallbackLogs.length}));
  ws.close();
}finally{
  const stop = async child => {
    if (!child || child.exitCode !== null) return;
    child.kill('SIGTERM');
    await Promise.race([once(child, 'exit'), delay(2000)]);
    if (child.exitCode === null) {
      child.kill('SIGKILL');
      await once(child, 'exit');
    }
  };
  await Promise.all([stop(chrome), stop(server)]);
  fs.rmSync(profile, {recursive:true, force:true, maxRetries:5, retryDelay:100});
}
