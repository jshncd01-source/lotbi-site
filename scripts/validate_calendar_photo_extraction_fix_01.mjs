// Synthetic UI/storage checks; actual image accuracy is a separate evaluation.
// Uses the installed Chrome/Chromium, as the existing calendar image gate does.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function browserPath(){
  for(const name of[process.env.CHROME_BIN,'google-chrome-stable','google-chrome','chromium','chromium-browser'].filter(Boolean)){
    if(fs.existsSync(name))return name;
    const found=spawnSync('which',[name],{encoding:'utf8'});
    if(found.status===0&&found.stdout.trim())return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required');
}
const executable=browserPath();
const backend=process.env.PHOTO_LOCAL_CORE_URL||'';
if(backend)assert.match(backend,/^http:\/\/127\.0\.0\.1:\d+$/,'only local synthetic Core is allowed');
const source=fs.readFileSync(path.join(root,'scripts/validate_calendar_add_from_image_01.mjs'),'utf8').replaceAll('\r\n','\n');
const fixture=source.match(/const fixture = `([\s\S]*?)`;\n/)[1];
const prefix=fixture.slice(0,fixture.indexOf('try{\n  localStorage.clear();')).replace('<head>','<head><link rel="stylesheet" href="/site-theme-tokens.css"><style>#image-result{display:none}</style>');
const checks=fs.readFileSync(path.join(root,'scripts/calendar_photo_extraction_fix_01_checks.js'),'utf8');
const driver=String.raw`
const params=new URLSearchParams(location.search),CASE_WIDTH=Number(params.get('width')),CASE_THEME=params.get('theme');
const LOCAL_CORE_URL=params.get('local')==='yes'?BACKEND_URL:'';
const CAPTURE_ONLY=params.get('capture')==='yes';
let assertions=0;const results=[];
const assert={
 equal(actual,expected,label='equal'){assertions++;if(actual!==expected)throw new Error(label+': '+JSON.stringify({actual,expected}));},
 ok(value,label='ok'){assertions++;if(!value)throw new Error(label);},
 match(value,pattern,label='match'){assertions++;if(!pattern.test(value))throw new Error(label+': '+value);},
};
const console={log(value){results.push(JSON.parse(value));}};
const manager=await import('/site-calendar-manager.js');
window.photoTest={manager,mountCase,stubFetch,dropImage,wait,writesOf,card};
const locate=selector=>{
 const one=()=>{const node=document.querySelector(selector);if(!node)throw new Error('missing '+selector);return node;};
 return{
  async isEnabled(){return!one().disabled;},async innerText(){return one().innerText;},
  async count(){return document.querySelectorAll(selector).length;},
  async allTextContents(){return[...document.querySelectorAll(selector)].map(el=>el.textContent);},
  async inputValue(){return one().value;},
  async fill(value){const el=one();el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},
  async click(){const el=one();if(el.disabled)throw new Error('disabled '+selector);el.click();},
  async boundingBox(){const r=one().getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};},
  async evaluate(fn){return fn(one());},
 };
};
const browser={
 async newPage(options){assert.equal(options.viewport.width,innerWidth,'exact viewport');document.body.dataset.siteTheme=options.colorScheme||'light';return{
  async goto(){},async waitForFunction(fn){await wait(fn,'browser condition');},
  async evaluate(fn,value){return fn(value);},locator:locate,async close(){},
 };},async close(){},
};
// The product theme is explicit, independent of the machine's preferred theme.
window.matchMedia=((original)=>query=>query==='(prefers-color-scheme: dark)'?{matches:CASE_THEME==='dark'}:original(query))(window.matchMedia.bind(window));
try{
CHECK_SOURCE
out.textContent=JSON.stringify({ok:true,assertions,width:innerWidth,theme:CASE_THEME,results});
}catch(error){out.textContent=JSON.stringify({ok:false,error:String(error.stack||error),stage,assertions});}
`;
const html=prefix+driver.replace('BACKEND_URL',JSON.stringify(backend)).replace('CHECK_SOURCE',checks)+'</script></body></html>';
function wrapperMarkup(search){
 const width=Number(search.get('width'));
 return`<!doctype html><html><body style="margin:0"><iframe id="case-frame" src="/photo-test.html?${search}" width="${width}" height="900" style="display:block;border:0"></iframe><pre id="result" style="display:none">pending</pre><script>
 const frame=document.getElementById('case-frame'),out=document.getElementById('result');
 const timer=setInterval(()=>{const child=frame.contentDocument?.getElementById('image-result');if(child&&child.textContent!=='pending'){out.textContent=child.textContent;clearInterval(timer)}},25);
 setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'wrapper timeout'});clearInterval(timer)}},55000);
 </script></body></html>`;
}
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),name=decodeURIComponent(url.pathname);
 if(name==='/photo-test.html'||name==='/photo-wrapper.html'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(name==='/photo-test.html'?html:wrapperMarkup(url.searchParams));return;}
 const file=path.resolve(root,'.'+name);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
async function run(width,theme,local=false,capture=false){
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'lotbi-photo-gate-'));
 const args=['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size='+width+',1000','--force-device-scale-factor=1','--force-prefers-reduced-motion=reduce','--user-data-dir='+profile,'--virtual-time-budget=60000','--dump-dom'];
 if(capture){fs.mkdirSync(process.env.PHOTO_EVIDENCE_DIR,{recursive:true});args.push('--screenshot='+path.resolve(process.env.PHOTO_EVIDENCE_DIR,'합성영수증-수정후-'+width+'-'+theme+'.png'));}
 args.push('http://127.0.0.1:'+server.address().port+'/photo-wrapper.html?'+new URLSearchParams({width:String(width),theme,local:local?'yes':'no',capture:capture?'yes':'no'}));
 try{
  const stdout=await new Promise((resolve,reject)=>{
   const child=spawn(executable,args,{stdio:['ignore','pipe','pipe'],windowsHide:true});let output='',stderr='';
   const timer=setTimeout(()=>{child.kill();reject(new Error('Chrome timeout'));},120000);
   child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
   child.stdout.on('data',chunk=>{output+=chunk;if(output.length>12*1024*1024){child.kill();reject(new Error('browser output limit'));}});
   child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-4000);});
   child.on('error',error=>{clearTimeout(timer);reject(error);});
   child.on('close',code=>{clearTimeout(timer);if(code!==0)reject(new Error('browser '+code+' '+stderr));else resolve(output);});
  });
  const raw=stdout.match(/<pre id="result"[^>]*>([\s\S]*?)<\/pre>/)?.[1];assert.ok(raw,'browser result missing');
  const result=JSON.parse(raw.replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&'));
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.width,width);assert.equal(result.assertions,capture?8:local?30:15,'all retained assertions must execute');
  assert.equal(result.results.length,local?2:1,'every scenario must complete');
  console.log(JSON.stringify(result));
 }finally{assert.equal(path.dirname(path.resolve(profile)),path.resolve(os.tmpdir()),'only the generated temporary browser profile may be removed');fs.rmSync(profile,{recursive:true,force:true});}
}
try{
 for(const width of[360,1280])for(const theme of['light','dark']){
  await run(width,theme);
  if(process.env.PHOTO_EVIDENCE_DIR)await run(width,theme,false,true);
 }
 if(backend)await run(1280,'light',true);
 console.log('LOTBI Calendar 사진 추출 UI/storage: PASS');
}finally{await new Promise(resolve=>server.close(resolve));}
