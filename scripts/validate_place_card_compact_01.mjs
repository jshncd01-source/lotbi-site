import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.placecard-inner.html';
const WRAPPER_REL = 'scripts/.placecard-wrapper.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4213;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
const CASES = [
  {label: '344', width: 344, height: 780, mobile: true},
  {label: '360', width: 360, height: 800, mobile: true},
  {label: '390', width: 390, height: 844, mobile: true},
  {label: '412', width: 412, height: 915, mobile: true},
  {label: '760', width: 760, height: 900, mobile: true},
  {label: '761', width: 761, height: 900, mobile: false},
  {label: '1280', width: 1280, height: 900, mobile: false},
];

const PLACE_RESULT = {
  contract_id: 'CORE-PLACE-RESULT-01',
  schema_version: 1,
  result_set_id: 'plrs_0c0a0d0e0f0102030405',
  provider_code: 'NAVER',
  source: 'NAVER_LOCAL_SEARCH',
  query: '전주 맛집',
  results: [
    {
      result_id: 'place-1',
      place_id: 'naver:one',
      name: '진원소우 전주신시가지점',
      category: '음식점>한식>소고기구이',
      road_address: '전북특별자치도 전주시 완산구 홍산중앙로 26 3층',
      latitude: 35.8159596,
      longitude: 127.1093458,
      coordinate_system: 'WGS84',
      coordinate_authority: 'NAVER_MAPS_GEOCODING',
      navigation_capability: true,
      phone: '063-000-0000',
      phone_verified: true,
      image_url: null,
      photo_evidence: null,
      food_license_verification: {
        state: 'CONFLICTING',
        source: 'MOIS_FOOD_LICENSE',
        ai_calls: 0,
      },
    },
    {
      result_id: 'place-2',
      place_id: 'naver:two',
      name: '호시마츠생라멘',
      category: '음식점>일식',
      road_address: '전북특별자치도 전주시 완산구 전주객사2길 46-12',
      latitude: 35.8189944,
      longitude: 127.1412996,
      coordinate_system: 'WGS84',
      coordinate_authority: 'NAVER_MAPS_GEOCODING',
      navigation_capability: true,
      phone: null,
      phone_verified: false,
      image_url: null,
      photo_evidence: null,
      food_license_verification: {
        state: 'VERIFIED',
        source: 'MOIS_FOOD_LICENSE',
        administrative_status: '영업/정상',
        ai_calls: 0,
      },
    },
  ],
};

function browserPath() {
  for (const name of [process.env.CHROME_BIN, '/opt/pw-browsers/chromium', 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (name.includes('/') && fs.existsSync(name)) return name;
    const found = spawnSync('which', [name], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required');
}

function buildInner() {
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const runtime = html.match(/<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/u);
  assert.ok(runtime);
  html = html.replace('<head>', '<head>\n  <base href="/">');
  const harness = `<script type="module">
const PLACE_RESULT = ${JSON.stringify(PLACE_RESULT)};
const out = document.getElementById('placecard-result');
const fail = e => { out.textContent = JSON.stringify({ok:false,error:String((e&&e.stack)||e)}); };
setTimeout(() => { if (out.textContent === 'pending') fail('watchdog'); }, 50000);
try {
  localStorage.clear();
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const json = body => Promise.resolve(new Response(JSON.stringify(body), {status:200,headers:{'Content-Type':'application/json'}}));
  globalThis.fetch = (url, init) => {
    let parsed;
    try { parsed = new URL(String((url&&url.url)||url), location.origin); } catch { return nativeFetch(url, init); }
    if (parsed.pathname === '/v2/conversation/guest/sessions') return json({
      contract_id:'CORE-GUEST-SESSION-01',schema_version:1,guest_token:'g'.repeat(43),
      expires_at:new Date(Date.now()+3600000).toISOString(),
    });
    if (parsed.pathname === '/v2/conversation/guest/messages') return json({
      contract_id:'CORE-WEB-CHAT-01',schema_version:1,status:'ANSWERED',
      assistant_text:'전주에서 확인한 후보 2곳이에요. 아래 카드에서 전화나 지도를 바로 열 수 있어요.',
      response_mode:'PLACE_PROVIDER_READONLY',correlation_id:'req_placecardfinal01',
      intent:{action:'PLACE_SEARCH',domain:'PLACE'},
      follow_up:{required:false,action:'PLACE_SEARCH',automatic_execution:false},
      safety:{execution_authority:false,external_side_effect:false,transaction_created:false,
        order_created:false,payment_attempted:false,reservation_created:false,merchant_execution_started:false},
      place_result:PLACE_RESULT,retry_safe:true,
    });
    if (parsed.origin !== location.origin) return json({items:[]});
    return nativeFetch(url, init);
  };
  const conversation = await import('/site-conversation.js?v=placecardfinal01');
  if (!conversation.mountConversation()) throw new Error('mount');
  const wait = async (fn, label) => {
    for (let i=0;i<500;i+=1) { const value=fn(); if(value) return value; await new Promise(r=>setTimeout(r,25)); }
    throw new Error('timeout '+label);
  };
  const field=document.getElementById('lotbi-prompt');
  field.value='전주 맛집 추천해줘';
  field.dispatchEvent(new Event('input',{bubbles:true}));
  document.querySelector('.send-button').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
  const rail=await wait(()=>document.querySelector('.lotbi-place-orbit'),'rail');
  const center=await wait(()=>rail.querySelector('[data-orbit-slot="CENTER"]'),'center');
  await new Promise(r=>setTimeout(r,250));
  const side=rail.querySelector('.lotbi-place-orbit-card:not([data-orbit-slot="CENTER"])');
  const box=node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}};
  const actions=[...center.querySelectorAll('.lotbi-rich-card-action')];
  out.textContent=JSON.stringify({
    ok:true,
    rail:box(rail),
    card:box(center),
    actions:actions.map(node=>({
      action:node.dataset.action,
      text:(node.textContent||'').trim(),
      iconSrc:node.querySelector('.lotbi-place-action-icon-image')?.getAttribute('src')||'',
      aria:node.getAttribute('aria-label')||'',
      target:node.getAttribute('target')||'',
      rel:node.getAttribute('rel')||'',
      ...box(node),
    })),
    mediaHidden:center.querySelector('.lotbi-rich-card-place-media')?.hidden===true,
    sideOpacity:Number.parseFloat(getComputedStyle(side).opacity),
    sideActionsVisible:[...side.querySelectorAll('.lotbi-rich-card-action')].some(n=>n.getClientRects().length>0),
    sideActionTabIndexes:[...side.querySelectorAll('.lotbi-rich-card-action')].map(n=>n.tabIndex),
    consumerText:rail.textContent||'',
    noPhoneActions:side.querySelectorAll('[data-action="phone"]').length,
    assistantText:document.querySelector('.chat-message-assistant .chat-message-body')?.textContent||'',
  });
} catch(e) { fail(e); }
</script><pre id="placecard-result">pending</pre>`;
  return html.replace(runtime[0], harness);
}

function waitServer() {
  for (let i=0;i<60;i+=1) {
    const probe=spawnSync('curl',['--fail','--silent',ORIGIN+'/'],{timeout:1000});
    if(probe.status===0)return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,100);
  }
  throw new Error('server start');
}

function wrapperMarkup(testCase) {
  return `<!doctype html><html><body style="margin:0"><iframe id="frame" src="/${INNER_REL}" width="${testCase.width}" height="${testCase.height}" style="display:block;border:0"></iframe><pre id="result">pending</pre><script>
  const frame=document.getElementById('frame'),out=document.getElementById('result');
  const timer=setInterval(()=>{try{const child=frame.contentDocument?.getElementById('placecard-result');if(child&&child.textContent!=='pending'){out.textContent=child.textContent;clearInterval(timer)}}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e)});clearInterval(timer)}},25);
  setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'wrapper timeout'});clearInterval(timer)}},70000);
  <\/script></body></html>`;
}

function run(browser, testCase) {
  fs.writeFileSync(WRAPPER, wrapperMarkup(testCase), 'utf8');
  const userAgent=testCase.mobile?MOBILE_UA:DESKTOP_UA;
  const result=spawnSync(browser,[
    '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--ignore-certificate-errors',
    `--user-agent=${userAgent}`,'--window-size=1500,1000','--force-device-scale-factor=1',
    '--force-prefers-reduced-motion=reduce','--virtual-time-budget=80000','--dump-dom',ORIGIN+'/'+WRAPPER_REL,
  ],{encoding:'utf8',timeout:150000,maxBuffer:16*1024*1024});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(result.stderr);
  const open='<pre id="result">',close='</pre>';
  const start=result.stdout.indexOf(open),end=result.stdout.indexOf(close,start);
  if(start<0||end<0)throw new Error('result missing');
  const raw=result.stdout.slice(start+open.length,end)
    .replaceAll('&quot;','"').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>');
  const parsed=JSON.parse(raw);
  if(!parsed.ok)throw new Error(`${testCase.label}: ${parsed.error}`);
  return parsed;
}

fs.writeFileSync(INNER, buildInner(), 'utf8');
const browser=browserPath();
const server=spawn('python',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:ROOT,stdio:'ignore'});
try {
  waitServer();
  for (const testCase of CASES) {
    const reading=run(browser,testCase);
    const expected=['phone','naver-map','kakao-navi','tmap','google-maps'];
    assert.deepEqual(reading.actions.map(x=>x.action),expected,`${testCase.label}: actions`);
    for(const action of reading.actions) {
      assert.ok(action.w>=44&&action.h>=44,`${testCase.label}: ${action.action} ${action.w}x${action.h}`);
      assert.equal(action.text,'',`${testCase.label}: ${action.action} visible label`);
      assert.match(action.iconSrc,/^\/assets\/place-actions\/[a-z-]+\.png\?v=place-icons-20260925$/u,
        `${testCase.label}: ${action.action} icon`);
      assert.ok(action.aria.includes(PLACE_RESULT.results[0].name),`${testCase.label}: aria`);
      if(action.action!=='phone'&&action.action!=='tmap') {
        assert.equal(action.target,'_blank');
        assert.match(action.rel,/noopener/u);
        assert.match(action.rel,/noreferrer/u);
      }
    }
    assert.equal(reading.mediaHidden,true,`${testCase.label}: no-photo media`);
    assert.ok(reading.card.h<=reading.rail.h+1,`${testCase.label}: card ${reading.card.h} > rail ${reading.rail.h}`);
    assert.ok(reading.card.w<=Math.min(testCase.width*.82,286)+2,`${testCase.label}: card width ${reading.card.w}`);
    assert.ok(reading.sideOpacity<=.2,`${testCase.label}: side opacity ${reading.sideOpacity}`);
    assert.equal(reading.sideActionsVisible,false,`${testCase.label}: side actions visible`);
    assert.ok(reading.sideActionTabIndexes.every(x=>x===-1),`${testCase.label}: side focusable`);
    assert.equal(reading.noPhoneActions,0,`${testCase.label}: dead phone visible`);
    for(const forbidden of ['인허가','공공데이터','WGS84','사진 정보 없음']) {
      assert.doesNotMatch(reading.consumerText,new RegExp(forbidden,'u'),`${testCase.label}: ${forbidden}`);
    }
    assert.ok(reading.assistantText.length<100,`${testCase.label}: verbose answer`);
  }
} finally {
  server.kill();
  for(const file of[INNER,WRAPPER]){try{fs.unlinkSync(file)}catch{}}
}

console.log('Compact cross-platform Place Card browser contract: PASS');
