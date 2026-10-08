// CHAT-READ-ALOUD-RESTORE-P0 — the 읽어주기 button under LOTBI answers, in a
// real browser, on the real conversation runtime and the real stylesheets.
//
// The speech engine is a deterministic stand-in for window.speechSynthesis
// (installed before the chat loads), so every utterance, voice and cancel()
// is observable. Every fetch / XHR / beacon / socket the page makes is
// recorded too. Checked:
//   - nothing is read until the button is pressed (no auto-play)
//   - short answer: 읽어주기 → 중지 → back to 읽어주기 when done, on-device voice
//   - 3,000+ character answer: every piece once, in order, ≤180 characters,
//     no Markdown marks, code or addresses reach the voice
//   - stop mid-answer, switching to another answer, rapid presses: one answer
//     at a time, never two utterances at once, nothing after a stop
//   - a new question, a new conversation, hiding the page: reading stops
//   - pressing the button makes no network request at all (no /v2/live/tts,
//     no new answer, nothing that could count against the monthly usage)
//   - network-only Korean voices, no Korean voice, no speech engine: a plain
//     message and nothing spoken
//   - layout at 320/375/390/1280px, light and dark: one row, 44px tall, no
//     horizontal scroll, readable label contrast
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INNER_REL = 'scripts/.chat-read-aloud-inner.html';
const INNER = path.join(ROOT, INNER_REL);
const WRAPPER_REL = 'scripts/.chat-read-aloud-wrapper.html';
const WRAPPER = path.join(ROOT, WRAPPER_REL);
const PORT = 4361;
const ORIGIN = 'http://127.0.0.1:' + PORT;
const V = 'readaloud1';

function browserPath() {
  for (const name of [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (name.includes('/') && fs.existsSync(name)) return name;
    const found = spawnSync('which', [name], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required');
}

// The same stylesheets, in the same order, as the production home page.
const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const stylesheets = [...index.matchAll(/<link rel="stylesheet" href="([^"?]+\.css)(?:\?v=[^"]+)?"/g)].map(match => match[1]);
if (!stylesheets.includes('site-conversation.css')) throw new Error('index.html stylesheet list not found');

const fixture = `<!doctype html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${stylesheets.map(href => `<link rel="stylesheet" href="/${href}?v=${V}">`).join('\n')}
</head><body class="chat-home-page" data-site-auth-state="authenticated">
<aside class="chat-sidebar chat-sidebar-desktop">
  <button type="button" data-new-conversation aria-label="새 대화">새 대화</button>
  <button type="button" data-calendar-view="all">캘린더</button>
</aside>
<template id="shell-markup"><main id="main-content" class="chat-home-shell" tabindex="0">
  <div data-home-avatar-anchor><div data-lotbi-avatar-container></div></div>
  <div id="conversation-thread" class="conversation-thread" hidden></div>
  <div class="chat-composer-stack">
    <div data-attachment-preview hidden></div>
    <textarea id="lotbi-prompt"></textarea>
    <div data-attachment-control>
      <button type="button" data-attachment-trigger aria-expanded="false">+</button>
      <div data-attachment-menu hidden>
        <button type="button" role="menuitem" data-attachment-action="camera">카메라</button>
        <button type="button" role="menuitem" data-attachment-action="photos">사진</button>
        <button type="button" role="menuitem" data-attachment-action="files">파일</button>
      </div>
      <input type="file" data-attachment-input="camera">
      <input type="file" data-attachment-input="photos">
      <input type="file" data-attachment-input="files">
    </div>
  </div>
  <div data-response-grade-control hidden inert>
    <button type="button" data-response-grade-trigger disabled><span data-response-grade-label>스탠다드</span></button>
    <div data-response-grade-menu hidden>
      <button type="button" data-response-grade="LIGHT" disabled></button>
      <button type="button" data-response-grade="STANDARD" disabled></button>
      <button type="button" data-response-grade="PREMIUM" disabled></button>
    </div>
  </div>
  <button class="composer-button send-button" type="button">전송</button>
  <p id="chat-status"></p>
  <div id="chat-state-region" hidden></div>
</main></template>
<pre id="read-aloud-result" hidden>pending</pre>
<script type="module">
const out=document.getElementById('read-aloud-result');
let stage='init';
setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'watchdog at stage: '+stage})}},50000);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const wait=async(fn,label)=>{stage=label;for(let i=0;i<400;i+=1){const v=fn();if(v)return v;await sleep(25)}throw new Error('timeout '+label)};
const click=node=>node.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
const json=body=>Promise.resolve(new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}}));
const params=new URLSearchParams(location.search);
const voiceMode=params.get('voices')||'local';

// ── network: every request the page makes ──
const calls=[];
const native=globalThis.fetch.bind(globalThis);
const LONG_ANSWER=(()=>{const parts=[];for(let i=1;parts.join('\\n').length<3300;i+=1){
  parts.push('## '+i+'번째 안내 📍');
  parts.push('**'+i+'번째 문단**입니다. 전주 덕진공원의 연꽃은 7월에 가장 아름답고, 산책로는 약 1.2km 이며 휠체어로도 다닐 수 있어요.');
  parts.push('- 운영 시간: 오전 9시부터 오후 6시까지 → 연중무휴');
  parts.push('- 자세히 보기: https://example.com/park/'+i);
  if(i===3){parts.push('| 항목 | 요금 |');parts.push('| --- | --- |');parts.push('| 주차 | 무료 |');parts.push('\\u0060\\u0060\\u0060js');parts.push('const secretCode = 42;');parts.push('\\u0060\\u0060\\u0060');}
}return parts.join('\\n')})();
const ANSWERS={
  '짧은 답 알려줘':'안녕하세요. 오늘 전주는 맑고 낮 최고 기온은 24도예요.',
  '긴 답 알려줘':LONG_ANSWER,
  '다른 질문':'다른 답변입니다. 내일은 비가 조금 와요.',
};
globalThis.fetch=(url,init={})=>{
  const parsed=new URL(String(url),location.origin);
  const method=(init.method||'GET').toUpperCase();
  calls.push({path:parsed.pathname,method});
  if(parsed.pathname==='/app/config.json')return json({navigation:{kakao_navi_ready:false,kakao_javascript_key:null,kakao_javascript_sdk_url:null}});
  if(parsed.pathname==='/v2/conversation/messages'){
    let text='';try{const body=JSON.parse(init.body||'{}');text=body.text||body.message||body.content||''}catch{}
    const answer=ANSWERS[text]||ANSWERS['다른 질문'];
    return json({contract_id:'CORE-WEB-CHAT-01',schema_version:1,status:'ANSWERED',assistant_text:answer,
      response_mode:'STANDARD',correlation_id:'corr_readaloud_'+calls.length,retry_safe:true,follow_up:{required:false},intent:{action:'UNKNOWN'}});
  }
  if(parsed.pathname==='/v2/me')return json({user:{id:'usr_readaloud',name:'LOTBI 사용자',public_handle:'lotbi'},
    session:{id:'ses_readaloud',assurance_level:'FULL',expires_at:'2027-01-01T00:00:00+00:00'},installation:{id:'inst_readaloud'}});
  if(parsed.pathname==='/v2/subscription'||parsed.pathname==='/v2/subscriptions/current')return json({tier:'FREE',status:'ACTIVE'});
  if(parsed.pathname.startsWith('/v2/life/'))return json({view:'AGENDA',as_of:new Date().toISOString(),timezone:'Asia/Seoul',coverage:'PERSONAL_ACTIVITY_ONLY',items:[],ai_calls:0,provider_api_calls:0});
  if(parsed.origin!==location.origin)return json({});
  return native(url,init);
};
const xhrOpen=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(method,url,...rest){calls.push({path:'XHR '+String(url),method});return xhrOpen.call(this,method,url,...rest)};
if(navigator.sendBeacon){const beacon=navigator.sendBeacon.bind(navigator);navigator.sendBeacon=(url,data)=>{calls.push({path:'BEACON '+String(url),method:'POST'});return beacon(url,data)}}
const NativeSocket=globalThis.WebSocket;
globalThis.WebSocket=function(url,...rest){calls.push({path:'WS '+String(url),method:'GET'});return new NativeSocket(url,...rest)};

// ── speech: a deterministic stand-in for window.speechSynthesis ──
const LOCAL={name:'Microsoft Heami - Korean (Korean)',lang:'ko-KR',localService:true,default:false,voiceURI:'heami'};
const NETWORK={name:'Google 한국의',lang:'ko-KR',localService:false,default:true,voiceURI:'google-ko'};
const EDGE_ONLINE={name:'Microsoft SunHi Online (Natural) - Korean (Korea)',lang:'ko-KR',localService:false,default:false,voiceURI:'sunhi'};
const ENGLISH={name:'Microsoft Zira - English (United States)',lang:'en-US',localService:true,default:false,voiceURI:'zira'};
const speech={log:[],cancels:0,active:0,maxActive:0,delay:30,hold:false,current:null};
if(voiceMode==='unsupported'){
  Object.defineProperty(window,'speechSynthesis',{value:undefined,configurable:true,writable:true});
  window.SpeechSynthesisUtterance=undefined;
}else{
  const voices=voiceMode==='local'?[NETWORK,LOCAL,ENGLISH]:voiceMode==='network'?[NETWORK,EDGE_ONLINE,ENGLISH]:[ENGLISH];
  class FakeUtterance{constructor(text){this.text=text}}
  const finish=(u,kind)=>{if(speech.current!==u)return;speech.current=null;speech.active-=1;if(kind==='end')u.onend?.();else u.onerror?.({error:kind})};
  // Lets a held utterance (a long sentence still being spoken) reach its end.
  speech.release=()=>{speech.hold=false;const u=speech.current;if(u)setTimeout(()=>finish(u,'end'),speech.delay)};
  const synth={
    getVoices:()=>voices,addEventListener(){},removeEventListener(){},pause(){},resume(){},
    get speaking(){return Boolean(speech.current)},get pending(){return false},get paused(){return false},
    speak(u){
      speech.active+=1;speech.maxActive=Math.max(speech.maxActive,speech.active);
      speech.log.push({text:u.text,voice:u.voice?.name||'',lang:u.lang||''});speech.current=u;
      setTimeout(()=>{if(speech.current!==u)return;u.onstart?.();if(speech.hold)return;setTimeout(()=>finish(u,'end'),speech.delay)},0);
    },
    cancel(){speech.cancels+=1;const u=speech.current;if(u)finish(u,'canceled')},
  };
  Object.defineProperty(window,'speechSynthesis',{value:synth,configurable:true,writable:true});
  window.SpeechSynthesisUtterance=FakeUtterance;
}

const readButtons=()=>[...document.querySelectorAll('[data-message-action="speak"]')];
const send=async text=>{
  const box=document.getElementById('lotbi-prompt');
  const sendButton=document.querySelector('.send-button');
  box.value=text;box.dispatchEvent(new Event('input',{bubbles:true}));
  await wait(()=>!sendButton.disabled,'composer ready');
  const before=readButtons().length;
  const sent=calls.filter(c=>c.path==='/v2/conversation/messages').length;
  click(sendButton);
  await wait(()=>calls.filter(c=>c.path==='/v2/conversation/messages').length>sent,'turn sent: '+text);
  await wait(()=>readButtons().length>before,'answer rendered: '+text);
  return readButtons().at(-1);
};
const ui=button=>({label:button.getAttribute('aria-label'),text:button.textContent.trim(),title:button.title,speaking:button.dataset.speaking==='true',pressed:button.getAttribute('aria-pressed')});
const feedbackOf=button=>button.closest('.chat-message-actions').querySelector('.chat-message-action-feedback');
const isIdle=button=>button.getAttribute('aria-label')==='답변 읽어주기';
const networkSince=mark=>calls.slice(mark).map(c=>c.method+' '+c.path);

function luminance(rgb){const [r,g,b]=rgb.map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});return 0.2126*r+0.7152*g+0.0722*b}
function parseColor(value){const m=String(value).match(/rgba?\\(([^)]+)\\)/);if(!m)return null;const p=m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number);return {rgb:p.slice(0,3),a:p.length>3?p[3]:1}}
function backgroundOf(node){for(let el=node;el;el=el.parentElement){const c=parseColor(getComputedStyle(el).backgroundColor);if(c&&c.a>0.5)return c.rgb}return [255,255,255]}
function contrastOf(node){const fg=parseColor(getComputedStyle(node).color).rgb;const bg=backgroundOf(node);const [a,b]=[luminance(fg),luminance(bg)].sort((x,y)=>y-x);return Math.round(((a+0.05)/(b+0.05))*100)/100}
function layoutOf(button){
  const row=button.closest('.chat-message-actions');
  const tools=[...row.querySelectorAll(':scope > button')];
  const rects=tools.map(t=>t.getBoundingClientRect());
  const r=button.getBoundingClientRect();
  return {rowLabels:tools.map(t=>t.getAttribute('aria-label')),oneRow:rects.every(x=>Math.abs(x.top-rects[0].top)<=1),
    height:Math.round(r.height),width:Math.round(r.width),right:Math.round(r.right),viewport:innerWidth,
    pageScrollWidth:document.documentElement.scrollWidth,iconCount:button.querySelectorAll('svg').length,
    micControls:document.querySelectorAll('.mic-button,[data-wake-toggle],[aria-label*="마이크"],[aria-label*="음성 입력"]').length,
    contrast:contrastOf(button)};
}

const result={voiceMode};
try{
  localStorage.clear();
  const conversation=await import('/site-conversation.js?v=${V}');
  const readText=await import('/site-message-read-aloud.js?v=${V}');
  document.body.appendChild(document.getElementById('shell-markup').content.cloneNode(true));
  if(!conversation.mountConversation({sessionToken:'tok_readaloud_fixture'}))throw new Error('conversation mount');
  await wait(()=>calls.some(c=>c.path==='/v2/me'),'identity loaded');

  const shortButton=await send('짧은 답 알려줘');
  await sleep(200);
  result.autoPlaySpeaks=speech.log.length;
  result.initialUi=ui(shortButton);
  result.lightLayout=layoutOf(shortButton);
  document.body.dataset.siteTheme='dark';
  await sleep(50);
  result.darkLayout=layoutOf(shortButton);
  document.body.dataset.siteTheme='light';

  if(voiceMode!=='local'){
    const mark=calls.length;
    click(shortButton);
    const feedback=feedbackOf(shortButton);
    await wait(()=>feedback.textContent.trim(),'unavailable feedback');
    result.unavailableFeedback=feedback.textContent.trim();
    result.unavailableTone=feedback.dataset.tone||'';
    await sleep(100);
    result.unavailableSpeaks=speech.log.length;
    result.unavailableUi=ui(shortButton);
    result.unavailableNetwork=networkSince(mark);
  }else{
    // ── 1. short answer ──
    let mark=calls.length;
    click(shortButton);
    await wait(()=>speech.log.length>=1,'short answer speaking');
    result.activeUi=ui(shortButton);
    await wait(()=>isIdle(shortButton),'short answer finished');
    result.shortSpoken=speech.log.map(e=>e.text);
    result.shortVoices=[...new Set(speech.log.map(e=>e.voice))];
    result.shortLangs=[...new Set(speech.log.map(e=>e.lang))];
    result.afterShortUi=ui(shortButton);
    result.shortNetwork=networkSince(mark);

    // ── 2. 3,000+ character answer ──
    const longButton=await send('긴 답 알려줘');
    const expected=readText.splitForSpeech(readText.speechTextFromAnswer(LONG_ANSWER));
    let start=speech.log.length;
    mark=calls.length;
    click(longButton);
    await wait(()=>speech.log.length>start,'long answer speaking');
    await wait(()=>isIdle(longButton),'long answer finished');
    const longSpoken=speech.log.slice(start).map(e=>e.text);
    result.longAnswerChars=LONG_ANSWER.length;
    result.longPieces=longSpoken.length;
    result.longMatchesExpected=JSON.stringify(longSpoken)===JSON.stringify(expected);
    result.longMaxPiece=Math.max(...longSpoken.map(t=>t.length));
    result.longLeaks=['**','##','\\u0060','|','http','→','📍','secretCode'].filter(mark=>longSpoken.join(' ').includes(mark));
    result.longDuplicates=longSpoken.length-new Set(longSpoken.map((t,i)=>i+':'+t)).size;
    result.longVoices=[...new Set(speech.log.slice(start).map(e=>e.voice))];
    result.longNetwork=networkSince(mark);

    // ── 3. stop mid-answer ──
    speech.hold=true;
    start=speech.log.length;let cancels=speech.cancels;
    mark=calls.length;
    click(longButton);
    await wait(()=>speech.log.length>start,'held long answer speaking');
    result.heldUi=ui(longButton);
    click(longButton);
    await sleep(30);
    result.stoppedUi=ui(longButton);
    result.stopCancelled=speech.cancels>cancels;
    result.stopFeedback=feedbackOf(longButton).textContent.trim();
    const afterStop=speech.log.length;
    speech.hold=false;
    await sleep(400);
    result.speaksAfterStop=speech.log.length-afterStop;
    result.stopNetwork=networkSince(mark);

    // ── 4. switch to another answer ──
    speech.hold=true;
    click(shortButton);
    await wait(()=>shortButton.dataset.speaking==='true','A speaking');
    start=speech.log.length;
    click(longButton);
    result.switchAUi=ui(shortButton);
    result.switchBUi=ui(longButton);
    await sleep(30);
    result.switchFirstText=speech.log.slice(start).map(e=>e.text)[0]||'';
    result.switchExpectedFirst=expected[0];
    speech.release();
    await sleep(60);
    result.switchAStillIdle=isIdle(shortButton);
    await wait(()=>isIdle(longButton),'B finished after switch');
    result.switchSpokeA=speech.log.slice(start).some(e=>e.text===result.shortSpoken[0]);

    // ── 5. rapid presses ──
    speech.hold=true;
    start=speech.log.length;cancels=speech.cancels;
    for(let i=0;i<5;i+=1)click(shortButton);
    await sleep(30);
    result.rapidUi=ui(shortButton);
    result.rapidSpeaks=speech.log.length-start;
    click(shortButton);
    await sleep(30);
    result.rapidFinalUi=ui(shortButton);

    // ── 6. a new question stops the reading, and the new answer is not auto-read ──
    click(longButton);
    await wait(()=>longButton.dataset.speaking==='true','reading before a new question');
    cancels=speech.cancels;start=speech.log.length;
    const newButton=await send('다른 질문');
    result.newTurnCancelled=speech.cancels>cancels;
    result.newTurnUi=ui(longButton);
    await sleep(200);
    result.newTurnSpeaks=speech.log.length-start;
    result.newAnswerUi=ui(newButton);

    // ── 7. page hidden / pagehide stop it ──
    click(newButton);
    await wait(()=>newButton.dataset.speaking==='true','reading before hide');
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
    document.dispatchEvent(new Event('visibilitychange'));
    await sleep(20);
    result.hiddenUi=ui(newButton);
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
    start=speech.log.length;
    await sleep(200);
    result.speaksAfterVisible=speech.log.length-start;
    click(newButton);
    await wait(()=>newButton.dataset.speaking==='true','reading before pagehide');
    window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));
    await sleep(20);
    result.pagehideUi=ui(newButton);

    // ── 8. a new conversation stops it ──
    click(newButton);
    await wait(()=>newButton.dataset.speaking==='true','reading before new conversation');
    cancels=speech.cancels;
    click(document.querySelector('[data-new-conversation]'));
    await sleep(30);
    result.newConversationCancelled=speech.cancels>cancels;
    result.newConversationActive=Boolean(speech.current);
    speech.hold=false;

    result.maxConcurrentUtterances=speech.maxActive;
    result.totalSpeakVoices=[...new Set(speech.log.map(e=>e.voice))];
    result.readCallsToCore=calls.filter(c=>/\\/v2\\/live|tts|openai|elevenlabs/i.test(c.path)).map(c=>c.path);
  }
  result.ok=true;
  out.textContent=JSON.stringify(result);
}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e?.stack||e),calls:calls.map(c=>c.method+' '+c.path),partial:result,speech:{log:speech.log.length,cancels:speech.cancels}})}
</script></body></html>`;

function waitServer() {
  for (let i = 0; i < 50; i += 1) {
    const p = spawnSync('curl', ['--fail', '--silent', ORIGIN + '/'], {timeout: 1000});
    if (p.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  throw new Error('server start');
}

function wrapperMarkup(w, h, voices) {
  return `<!doctype html><html><body style="margin:0"><iframe id="case-frame" src="/${INNER_REL}?voices=${voices}" width="${w}" height="${h}" style="display:block;border:0"></iframe><pre id="result">pending</pre><script>
  const frame=document.getElementById('case-frame'),out=document.getElementById('result');
  const timer=setInterval(()=>{try{const child=frame.contentDocument?.getElementById('read-aloud-result');if(child&&child.textContent!=='pending'){out.textContent=child.textContent;clearInterval(timer)}}catch(e){out.textContent=JSON.stringify({ok:false,error:String(e)});clearInterval(timer)}},25);
  setTimeout(()=>{if(out.textContent==='pending'){out.textContent=JSON.stringify({ok:false,error:'wrapper timeout'});clearInterval(timer)}},58000);
  <\/script></body></html>`;
}

function run(browser, w, h, voices, userAgent = '') {
  fs.writeFileSync(WRAPPER, wrapperMarkup(w, h, voices), 'utf8');
  const args = ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--window-size=1600,1000', '--force-device-scale-factor=1', '--force-prefers-reduced-motion=reduce', '--virtual-time-budget=70000'];
  if (userAgent) args.push(`--user-agent=${userAgent}`);
  args.push('--dump-dom', ORIGIN + '/' + WRAPPER_REL);
  const r = spawnSync(browser, args, {encoding: 'utf8', timeout: 150000, maxBuffer: 16 * 1024 * 1024});
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error('browser ' + r.status + ' ' + r.stderr);
  const a = '<pre id="result">', b = '</pre>';
  const i = r.stdout.indexOf(a), j = r.stdout.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error('result missing');
  const raw = r.stdout.slice(i + a.length, j).replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
  const v = JSON.parse(raw);
  if (!v.ok) throw new Error(`${w}x${h} voices=${voices}: ${v.error} ${JSON.stringify(v.calls || [])} ${JSON.stringify(v.partial || {})} ${JSON.stringify(v.speech || {})}`);
  return v;
}

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const same = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected);
const IDLE = {label: '답변 읽어주기', text: '읽어주기', title: '답변 읽어주기', speaking: false, pressed: null};
const ACTIVE = {label: '읽기 중지', text: '중지', title: '읽기 중지', speaking: true, pressed: null};

function checkLayout(label, layout, theme) {
  check(same(layout.rowLabels, ['복사하기', '공유하기', '캘린더에 추가', '답변 읽어주기']), `${label} ${theme}: answer tools ${JSON.stringify(layout.rowLabels)}`);
  check(layout.oneRow, `${label} ${theme}: the answer tools must stay on one row`);
  check(layout.height >= 44, `${label} ${theme}: 읽어주기 must keep the 44px touch height (got ${layout.height})`);
  check(layout.right <= layout.viewport, `${label} ${theme}: 읽어주기 must stay inside the screen (right ${layout.right} > ${layout.viewport})`);
  check(layout.pageScrollWidth <= layout.viewport, `${label} ${theme}: no horizontal page scroll (${layout.pageScrollWidth} > ${layout.viewport})`);
  check(layout.iconCount === 1, `${label} ${theme}: one speaker icon`);
  check(layout.micControls === 0, `${label} ${theme}: no microphone / voice input control may appear`);
  check(layout.contrast >= 4.5, `${label} ${theme}: label contrast ${layout.contrast} < 4.5`);
}

const browser = browserPath();
fs.writeFileSync(INNER, fixture, 'utf8');
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: ROOT, stdio: 'ignore'});
try {
  waitServer();
  const cases = [
    [390, 844, 'local'],
    [320, 640, 'local'],
    [375, 812, 'local', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 25.0.0'],
    [1280, 900, 'local'],
    [390, 844, 'network'],
    [390, 844, 'none'],
    [390, 844, 'unsupported'],
  ];
  for (const [w, h, voices, userAgent = ''] of cases) {
    const v = run(browser, w, h, voices, userAgent);
    const label = `${w}x${h} voices=${voices}${userAgent ? ' inapp=KakaoTalk' : ''}`;
    check(v.autoPlaySpeaks === 0, `${label}: nothing may be read before the button is pressed (${v.autoPlaySpeaks})`);
    check(same(v.initialUi, IDLE), `${label}: idle button ${JSON.stringify(v.initialUi)}`);
    checkLayout(label, v.lightLayout, 'light');
    checkLayout(label, v.darkLayout, 'dark');

    if (voices === 'local') {
      check(same(v.activeUi, ACTIVE), `${label}: playing button ${JSON.stringify(v.activeUi)}`);
      check(same(v.afterShortUi, IDLE), `${label}: button returns to 읽어주기 when done`);
      check(same(v.shortSpoken, ['안녕하세요. 오늘 전주는 맑고 낮 최고 기온은 24도예요.']), `${label}: short answer spoken ${JSON.stringify(v.shortSpoken)}`);
      check(same(v.shortVoices, ['Microsoft Heami - Korean (Korean)']) && same(v.shortLangs, ['ko-KR']), `${label}: the on-device Korean voice must be used ${JSON.stringify(v.shortVoices)}`);
      check(v.longAnswerChars >= 3000, `${label}: long fixture ${v.longAnswerChars}`);
      check(v.longMatchesExpected, `${label}: long answer pieces must be every piece once, in order`);
      check(v.longPieces >= 15 && v.longMaxPiece <= 180, `${label}: long answer ${v.longPieces} pieces, max ${v.longMaxPiece}`);
      check(v.longLeaks.length === 0, `${label}: marks reached the voice: ${JSON.stringify(v.longLeaks)}`);
      check(v.longDuplicates === 0, `${label}: duplicated pieces`);
      check(same(v.longVoices, ['Microsoft Heami - Korean (Korean)']), `${label}: long answer voice ${JSON.stringify(v.longVoices)}`);
      check(same(v.heldUi, ACTIVE) && same(v.stoppedUi, IDLE), `${label}: stop control ${JSON.stringify([v.heldUi, v.stoppedUi])}`);
      check(v.stopCancelled && v.stopFeedback === '읽기를 멈췄습니다.', `${label}: stop must cancel the engine (${v.stopCancelled}, "${v.stopFeedback}")`);
      check(v.speaksAfterStop === 0, `${label}: nothing may be spoken after a stop (${v.speaksAfterStop})`);
      check(same(v.switchAUi, IDLE) && same(v.switchBUi, ACTIVE), `${label}: switching answers ${JSON.stringify([v.switchAUi, v.switchBUi])}`);
      check(v.switchFirstText === v.switchExpectedFirst && v.switchAStillIdle && !v.switchSpokeA, `${label}: after switching only B may be read`);
      check(same(v.rapidUi, ACTIVE) && same(v.rapidFinalUi, IDLE), `${label}: rapid presses ${JSON.stringify([v.rapidUi, v.rapidFinalUi])}`);
      check(v.rapidSpeaks <= 3, `${label}: rapid presses spoke ${v.rapidSpeaks} times`);
      check(v.newTurnCancelled && same(v.newTurnUi, IDLE), `${label}: a new question must stop the reading`);
      check(v.newTurnSpeaks === 0 && same(v.newAnswerUi, IDLE), `${label}: a new answer must not be read automatically (${v.newTurnSpeaks})`);
      check(same(v.hiddenUi, IDLE) && v.speaksAfterVisible === 0, `${label}: hiding the page stops reading and coming back does not resume`);
      check(same(v.pagehideUi, IDLE), `${label}: pagehide stops reading`);
      check(v.newConversationCancelled && !v.newConversationActive, `${label}: a new conversation must stop the reading`);
      check(v.maxConcurrentUtterances <= 1, `${label}: two utterances at once (${v.maxConcurrentUtterances})`);
      check(same(v.totalSpeakVoices, ['Microsoft Heami - Korean (Korean)']), `${label}: a network voice was used ${JSON.stringify(v.totalSpeakVoices)}`);
      for (const key of ['shortNetwork', 'longNetwork', 'stopNetwork']) check(v[key].length === 0, `${label}: pressing 읽어주기 made network requests ${key}=${JSON.stringify(v[key])}`);
      check(v.readCallsToCore.length === 0, `${label}: TTS-like requests ${JSON.stringify(v.readCallsToCore)}`);
    } else {
      const expected = {
        network: '이 기기에서 바로 쓸 수 있는 한국어 음성이 없어 읽어 드릴 수 없어요. 인터넷 음성으로 바꾸지 않아요.',
        none: '이 기기에 설치된 한국어 음성이 없어 읽어 드릴 수 없어요.',
        unsupported: '이 브라우저는 기기 음성 읽기를 지원하지 않아 읽어 드릴 수 없어요.',
      }[voices];
      check(v.unavailableFeedback === expected && v.unavailableTone === 'error', `${label}: message "${v.unavailableFeedback}" (${v.unavailableTone})`);
      check(v.unavailableSpeaks === 0, `${label}: nothing may be spoken (${v.unavailableSpeaks})`);
      check(same(v.unavailableUi, IDLE), `${label}: button stays 읽어주기 ${JSON.stringify(v.unavailableUi)}`);
      check(v.unavailableNetwork.length === 0, `${label}: no network fallback ${JSON.stringify(v.unavailableNetwork)}`);
    }
    console.log(label, JSON.stringify(voices === 'local'
      ? {long: `${v.longAnswerChars} chars → ${v.longPieces} pieces (max ${v.longMaxPiece})`, voice: v.totalSpeakVoices, lightContrast: v.lightLayout.contrast, darkContrast: v.darkLayout.contrast, button: `${v.lightLayout.width}x${v.lightLayout.height}`, rapidSpeaks: v.rapidSpeaks}
      : {message: v.unavailableFeedback, spoken: v.unavailableSpeaks}));
  }
  if (failures.length) {
    for (const failure of failures) console.error('FAIL', failure);
    process.exitCode = 1;
  } else {
    console.log('CHAT READ ALOUD RESTORE BROWSER 01 PASS — 읽어주기 reads only when pressed, on an on-device Korean voice, one answer at a time, stops on stop / another answer / a new question / a new conversation / hiding the page, makes no network request, and explains plainly when the device cannot read.');
  }
} finally {
  server.kill();
  try { fs.unlinkSync(INNER); } catch {}
  try { fs.unlinkSync(WRAPPER); } catch {}
}
