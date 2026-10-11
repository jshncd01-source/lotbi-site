// SITE-CONVERSATION-DESIGN-01: actual entry point, isolated guest fixtures.
// Before/after capture uses the same messages and actions; no live writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {browserPath, buildInner, startServer, serverPort, openDevtools, waitFor, sleep, PLACE_RESULT} from './validate_place_card_carousel_no_drift_01.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = fs.mkdtempSync(path.join(root, 'scripts/.conversation-design-'));
const evidence = process.env.CONVERSATION_DESIGN_EVIDENCE_DIR;
const before = process.env.CONVERSATION_DESIGN_CAPTURE_BEFORE === '1';
const short = '준비물을 정리했어요. 신분증과 복용 중인 약 목록을 챙겨 주세요. 필요한 내용은 다시 물어보셔도 됩니다.';
const long = [
  '**검진 준비 안내** 먼저 예약 시간을 확인하고, 준비물을 차례로 챙겨 주세요.',
  '- 신분증과 예약 내역\n- 복용 중인 약 목록\n- 이전 검사 결과',
  '| 항목 | 오전 방문 | 오후 방문 |\n| --- | --- | --- |\n| 준비 | 예약 시간을 확인해요 | 이동 시간을 확인해요 |\n| 문의 | 병원 안내를 확인해요 | 필요한 서류를 물어봐요 |',
  '```text\n예약 확인 → 준비물 점검 → 병원 방문\n' + '매우긴코드내용'.repeat(24) + '\n```',
  ...Array.from({length:16}, (_, i) => `${i+1}번째 안내입니다. 긴 답변을 읽는 동안 문단을 구분하고, 필요한 내용을 천천히 확인해 주세요. 설명이 길어져도 페이지가 옆으로 밀리지 않고 읽던 위치를 유지해야 합니다.`),
  '**마지막 안내** 진료 기관의 최신 안내를 최종 확인해 주세요.',
].join('\n\n');
const logs=[];
const contrast=(ink,paper)=>{
  const luminance=color=>{const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
  const a=luminance(ink),b=luminance(paper);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
};
const server=startServer();
try {
  const origin=`http://127.0.0.1:${await serverPort(server)}`;
  for (const width of [360,1280]) for (const dark of [false,true]) {
    const label=`${width}x780-${dark?'dark':'light'}`;
    let fixture=buildInner({results:[]});
    if(before && process.env.CONVERSATION_DESIGN_BASELINE_CSS){
      fs.copyFileSync(process.env.CONVERSATION_DESIGN_BASELINE_CSS,path.join(dir,'baseline.css'));
      fixture=fixture.replace(/href="site-conversation\.css\?v=[^"]+"/,`href="scripts/${path.basename(dir)}/baseline.css"`);
    }
    fixture=fixture.replace('  localStorage.clear();', `  localStorage.clear();\n  document.cookie='lotbi_theme_preference_v1=${dark?'dark':'light'}; Path=/';\n  window.__designAnswer=${JSON.stringify(short)};\n  window.__designPlace=null;\n  window.__designErrors=[];\n  window.addEventListener('error',event=>{if(event.error)window.__designErrors.push(String(event.error));});\n  window.addEventListener('unhandledrejection',event=>window.__designErrors.push(String(event.reason)));\n  window.__designRequests=[];\n  window.__designCopied=[];\n  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.__designCopied.push(text)}});`);
    fixture=fixture.replace("if (parsed.pathname === '/v2/conversation/guest/messages') return json({", "if (parsed.pathname === '/v2/conversation/guest/messages') { window.__designRequests.push(JSON.parse(init.body).text); return json({");
    fixture=fixture.replace(/assistant_text:[^\n]+/, 'assistant_text:window.__designAnswer,');
    fixture=fixture.replace("response_mode:'PLACE_PROVIDER_READONLY'", "response_mode:window.__designPlace?'PLACE_PROVIDER_READONLY':'AI_GROUNDED_CURRENT_FACT'");
    fixture=fixture.replace('place_result:PLACE_RESULT,retry_safe:true,', "...(window.__designPlace?{place_result:window.__designPlace}:{sources:[{title:'검진 안내 출처',url:'https://example.com/guide'}]}),retry_safe:true,");
    fixture=fixture.replace('    });\n    if (parsed.origin', '    }); }\n    if (parsed.origin');
    const start=fixture.indexOf("  const field=document.getElementById('lotbi-prompt');");
    const end=fixture.indexOf('} catch(e) { fail(e); }',start);
    fixture=fixture.slice(0,start)+`  window.__designSend=async (text,answer)=>{
    window.__designAnswer=answer;
    const field=document.getElementById('lotbi-prompt');
    const old=document.querySelectorAll('.chat-message-assistant:not(.chat-message-loading)').length;
    field.value=text; field.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('.send-button').click();
    await wait(()=>document.querySelectorAll('.chat-message-assistant:not(.chat-message-loading)').length>old,'answer');
    await wait(()=>!document.querySelector('.chat-message-loading'),'completed');
  };
  await window.__designSend('검진 준비물을 빠짐없이 챙기기 위한 아주 긴 대화 제목입니다',${JSON.stringify(short)});
  out.hidden=true; out.textContent=JSON.stringify({ok:true});
`+fixture.slice(end);
    fs.writeFileSync(path.join(dir,'inner.html'),fixture);
    // Linux gate: create an existing, unique profile immediately before launch.
    const profile=fs.mkdtempSync(path.join(dir,'profile-'));
    const page=await openDevtools(browserPath(),profile);
    try {
      const evaluate=async expression=>{
        const r=await page.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
        if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
        return r.result.value;
      };
      const click=async selector=>{
        const b=await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});n.scrollIntoView({block:'nearest'});const r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
        await page.send('Input.dispatchMouseEvent',{type:'mousePressed',...b,button:'left',clickCount:1});
        await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',...b,button:'left',clickCount:1});
        await sleep(200);
      };
      const key=async (name,code)=>{
        await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:name,code:name,windowsVirtualKeyCode:code,...(name==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})});
        await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:name,code:name,windowsVirtualKeyCode:code});
      };
      const capture=async name=>{
        await evaluate("document.getElementById('lotbi-prompt').blur(); true");
        await sleep(300);
        if(evidence){fs.mkdirSync(evidence,{recursive:true});const r=await page.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(evidence,`${label}-${name}.png`),Buffer.from(r.data,'base64'));}
      };
      await page.send('Page.enable');
      await page.send('Emulation.setDeviceMetricsOverride',{width,height:780,deviceScaleFactor:1,mobile:width===360});
      await page.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
      await page.send('Page.navigate',{url:`${origin}/scripts/${path.basename(dir)}/inner.html`});
      const ready=await waitFor(async()=>{const r=await evaluate("document.getElementById('drift-result')?.textContent");return r&&r!=='pending'?JSON.parse(r):null;},label,60000);
      assert.ok(ready.ok,`${label}: ${ready.error}`);
      assert.equal(await evaluate("document.body.dataset.siteTheme"),dark?'dark':'light');
      assert.equal(await evaluate("document.querySelector('.send-button').disabled"),true,'empty composer disabled');
      await capture('short');

      // Scenario ②: two actual persisted conversations and restoration.
      await evaluate("document.querySelector('[data-new-conversation]').click(); true");
      await evaluate(`window.__designSend('긴 답변과 목록 표 코드의 가독성을 확인해줘',${JSON.stringify(long)})`);
      await sleep(400);
      await capture('long-start');
      await evaluate("document.querySelector('.chat-message-actions').scrollIntoView({block:'center'}); true");
      await capture('long-end');
      if(width===360) await click('[data-mobile-nav-open]');
      const sidebar=width===360?'#mobile-nav-drawer':'.chat-sidebar-desktop';
      const rows=await evaluate(`(()=>{const box=n=>{const r=n.getBoundingClientRect();return {x:r.x,right:r.right,width:r.width,height:r.height}};return [...document.querySelectorAll('${sidebar} .conversation-history-open')].map(n=>({id:n.dataset.threadId,current:n.getAttribute('aria-current'),box:box(n),title:box(n.querySelector('[data-conversation-title]')),trigger:box(n.parentElement.querySelector('summary')),label:n.getAttribute('aria-label'),background:getComputedStyle(n).backgroundColor,color:getComputedStyle(n).color}))})()`);
      assert.equal(rows.length,2,'two histories');assert.equal(rows.filter(r=>r.current==='true').length,1,'one active history');
      if(!before)for(const r of rows){assert.ok(r.box.height>=44 && r.trigger.height>=44,'44px history and menu');assert.ok(r.title.right+8<=r.trigger.x,'title reserves menu gap');}
      if(!before){const active=rows.find(r=>r.current==='true');assert.ok(contrast(active.color,active.background)>=4.5,'selected history readable in both themes');assert.notEqual(active.background,rows.find(r=>r.current!=='true').background,'selection visibly distinct');}
      const currentRow=rows.find(r=>r.current==='true');
      await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:currentRow.box.x+20,y:currentRow.trigger.height/2+(await evaluate(`document.querySelector('${sidebar} .conversation-history-open[aria-current=true]').getBoundingClientRect().top`))});
      await capture('history');
      await click(`${sidebar} .conversation-history-open[aria-current=true] + details > summary`);
      assert.deepEqual(await evaluate(`[...document.querySelectorAll('${sidebar} details[open] [data-conversation-action]')].map(n=>n.dataset.conversationAction)`),['pin','rename','delete'],'existing management actions remain available');
      await click(`${sidebar} .conversation-history-open[aria-current=true] + details > summary`);
      const oldId=rows.find(r=>r.current!=='true').id;
      await evaluate(`window.focus();document.querySelector('${sidebar} .conversation-history-open[data-thread-id="${oldId}"]').focus();true`);
      await key('Enter',13);
      await waitFor(()=>evaluate(`document.querySelector('.chat-message-assistant .chat-message-body')?.textContent.includes('준비물을 정리했어요')`),'restored short');
      assert.equal(await evaluate(`document.querySelector('${sidebar} .conversation-history-open[aria-current="true"]').dataset.threadId`),oldId);
      assert.equal(await evaluate("document.querySelector('.send-button').disabled"),true);
      if(width===360)await click('[data-mobile-nav-open]');
      const newId=rows.find(r=>r.current==='true').id;
      await evaluate(`document.querySelector('${sidebar} .conversation-history-open[data-thread-id="${newId}"]').focus();true`);
      await key('Enter',13);
      await waitFor(()=>evaluate("!!document.querySelector('.chat-message-table')"),'restored long');

      // Scenario ③: semantic Markdown, page scroll, tool ownership, follow-up.
      const layout=await evaluate(`(()=>{const a=document.querySelector('.chat-message-assistant');const b=a.querySelector('.chat-message-body'),t=a.querySelector('.chat-message-actions');const c=document.querySelector('.chat-composer');const s=getComputedStyle(b), cs=getComputedStyle(c);return {overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,bodyOverflow:b.scrollWidth-b.clientWidth,font:parseFloat(s.fontSize),line:parseFloat(s.lineHeight),gap:t.getBoundingClientRect().top-b.getBoundingClientRect().bottom,lists:b.querySelectorAll('li').length,tables:b.querySelectorAll('table').length,code:b.querySelectorAll('pre').length,links:a.querySelectorAll('a[href]').length,tools:t.getAttribute('aria-label'),border:cs.borderColor,bg:cs.backgroundColor,mainBg:getComputedStyle(document.getElementById('main-content')).backgroundColor,send:getComputedStyle(document.querySelector('.send-button')).backgroundColor}})()`);
      assert.ok(layout.overflow<=0 && layout.bodyOverflow<=1,'no page/body overflow');
      const tools=await evaluate("[...document.querySelector('.chat-message-actions').querySelectorAll(':scope > button')].map(n=>{const r=n.getBoundingClientRect();return{label:n.getAttribute('aria-label'),w:r.width,h:r.height,right:r.right}})");
      assert.equal(tools.length,3,'copy/share/read tools preserved');
      for(const t of tools){assert.ok(t.label && t.w>=44 && t.h>=44 && t.right<=width,'named visible 44px answer tool');}
      assert.equal(layout.lists,3);assert.equal(layout.tables,1);assert.equal(layout.code,1);assert.ok(layout.links>0,'source link');assert.equal(layout.tools,'LOTBI 답변 도구');
      if(!before){assert.ok(layout.font>=16 && layout.line/layout.font>=1.65,'readable answer lines');assert.ok(layout.gap>=10 && layout.gap<=60,'answer tools and source attached with room');assert.notEqual(layout.border,layout.bg,'composer visible boundary');}
      await evaluate("document.querySelector('[data-message-action=copy]').scrollIntoView({block:'center'});true");
      await click('[data-message-action=copy]');
      await waitFor(()=>evaluate("window.__designCopied.length===1"),'copied answer');
      assert.equal(await evaluate('window.__designCopied[0]'),long,'copy belongs to restored answer');
      const scroll=await evaluate("document.getElementById('main-content').scrollTop");
      assert.ok(scroll>100,'long answer scrolls vertically');
      await evaluate("document.getElementById('lotbi-prompt').focus();true");
      await page.send('Input.insertText',{text:'추가 질문'});
      assert.equal(await evaluate("document.querySelector('.send-button').disabled"),false,'typed composer enabled');
      await capture('input');
      await evaluate("document.getElementById('lotbi-prompt').focus();true");
      // Shift+Enter is an actual keyboard event and adds a newline without sending.
      const requests=await evaluate('window.__designRequests.length');
      await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,modifiers:8,text:'\r',unmodifiedText:'\r'});
      await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,modifiers:8});
      assert.equal(await evaluate('window.__designRequests.length'),requests,'newline does not send');
      assert.ok(await evaluate("document.getElementById('lotbi-prompt').value.includes('\\n')"),'newline preserved');
      await evaluate(`window.__designAnswer=${JSON.stringify(short)};true`);
      await key('Enter',13);
      await waitFor(()=>evaluate(`window.__designRequests.length===${requests+1} && !document.querySelector('.chat-message-loading')`),'follow-up sent once');
      assert.equal(await evaluate("document.querySelector('.send-button').disabled"),true,'sent composer empty disabled');

      // Scenario ④: focus, accessible tree and theme change preserve selection.
      await evaluate("document.querySelector('[data-message-action=copy]').focus();true");await key('Tab',9);
      assert.ok(await evaluate("document.activeElement!==document.body"),'keyboard focus remains on a control');
      await page.send('Accessibility.enable');
      const ax=await page.send('Accessibility.getFullAXTree');
      assert.ok(ax.nodes.some(n=>!n.ignored && n.name?.value==='복사하기'),'copy in accessibility tree');
      const selected=await evaluate("document.querySelector('.conversation-history-open[aria-current=true]').dataset.threadId");
      await evaluate(`document.body.dataset.siteTheme=${JSON.stringify(dark?'light':'dark')};true`);
      assert.equal(await evaluate("document.querySelector('.conversation-history-open[aria-current=true]').dataset.threadId"),selected,'theme preserves selection');
      await evaluate(`document.body.dataset.siteTheme=${JSON.stringify(dark?'dark':'light')};document.querySelector('[data-new-conversation]').click();window.__designPlace=${JSON.stringify(PLACE_RESULT)};true`);
      await evaluate(`window.__designSend('테스트 장소 카드와 세로 스크롤 확인',${JSON.stringify(long)})`);
      await waitFor(()=>evaluate("!!document.querySelector('.lotbi-place-orbit')"),'place response');
      await sleep(500);
      const placeId=await evaluate("document.querySelector('.conversation-history-open[aria-current=true]').dataset.threadId");
      await evaluate("document.querySelector('.lotbi-place-orbit').scrollIntoView({block:'center'});true");
      await click('[data-orbit-dot="4"]');
      assert.equal(await evaluate("Number(document.querySelector('[data-orbit-slot=CENTER]').dataset.orbitIndex)"),4);
      let vertical=null;
      if(width===360){
        await page.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
        await evaluate("document.querySelector('[data-orbit-slot=CENTER]').scrollIntoView({block:'center'});true");await sleep(150);
        const at=await evaluate("(()=>{const r=document.querySelector('[data-orbit-slot=CENTER] .lotbi-rich-card-title').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");
        const top=await evaluate("document.getElementById('main-content').scrollTop");
        await page.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[at]});
        for(let i=1;i<=10;i++){await page.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:at.x,y:at.y+i*10}]});await sleep(16);}
        await page.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(300);
        vertical={before:top,after:await evaluate("document.getElementById('main-content').scrollTop"),index:await evaluate("Number(document.querySelector('[data-orbit-slot=CENTER]').dataset.orbitIndex)")};
        assert.ok(vertical.after<vertical.before-20,'vertical touch reads the page '+JSON.stringify({at,...vertical}));assert.equal(vertical.index,4,'vertical touch never rotates a card');
      }
      if(width===360)await click('[data-mobile-nav-open]');
      await evaluate(`document.querySelector('${sidebar} .conversation-history-open[data-thread-id="${oldId}"]').focus();true`);await key('Enter',13);
      await waitFor(()=>evaluate("!document.querySelector('.lotbi-place-orbit')"),'old conversation clears cards');
      if(width===360)await click('[data-mobile-nav-open]');
      await evaluate(`document.querySelector('${sidebar} .conversation-history-open[data-thread-id="${placeId}"]').focus();true`);await key('Enter',13);
      await waitFor(()=>evaluate("!!document.querySelector('[data-orbit-slot=CENTER]')"),'place restored');
      assert.equal(await evaluate("Number(document.querySelector('[data-orbit-slot=CENTER]').dataset.orbitIndex)"),0,'restored cards reset transient selection');
      assert.deepEqual(await evaluate('window.__designErrors'),[],'no script/console runtime errors');
      logs.push({label,scenarios:['②','③','④'],layout,history:rows,vertical,requests:await evaluate('window.__designRequests.length'),before});
    }finally{page.close();}
  }
}finally{
  server.kill('SIGTERM');
  for(let i=0;i<20;i++){try{fs.rmSync(dir,{recursive:true,force:true});break;}catch{await sleep(250);}}
}
console.log(JSON.stringify(logs,null,2));
console.log('SITE-CONVERSATION-DESIGN-01 OK');
