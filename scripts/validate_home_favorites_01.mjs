// Approved home favorites: actual index/runtime, local fixtures, no live writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {browserPath, buildInner, startServer, serverPort, openDevtools, waitFor, sleep} from './validate_place_card_carousel_no_drift_01.mjs';

const root=path.resolve(import.meta.dirname,'..');
const dir=fs.mkdtempSync(path.join(root,'scripts/.home-favorites-'));
const evidence=process.env.HOME_FAVORITES_EVIDENCE_DIR;
const server=startServer();
const logs=[];
try {
  const origin=`http://127.0.0.1:${await serverPort(server)}`;
  for(const width of [360,1280]) for(const dark of [false,true]) {
    const label=`${width}x780-${dark?'dark':'light'}`;
    let fixture=buildInner({results:[]}).replace('  localStorage.clear();',`  localStorage.clear(); document.cookie='lotbi_theme_preference_v1=${dark?'dark':'light'}; Path=/';
      window.__favoriteErrors=[];
      window.addEventListener('error',e=>window.__favoriteErrors.push(e.message));
      window.addEventListener('unhandledrejection',e=>window.__favoriteErrors.push(String(e.reason)));`);
    const start=fixture.indexOf("  const field=document.getElementById('lotbi-prompt');");
    const end=fixture.indexOf('} catch(e) { fail(e); }',start);
    assert.ok(start>0 && end>start);
    fixture=fixture.slice(0,start)+"  out.hidden=true; out.textContent=JSON.stringify({ok:true});\n"+fixture.slice(end);
    fs.writeFileSync(path.join(dir,'inner.html'),fixture);
    const profile=fs.mkdtempSync(path.join(dir,'profile-'));
    const page=await openDevtools(browserPath(),profile);
    try {
      const evaluate=async expression=>{
        const value=await page.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
        if(value.exceptionDetails) throw new Error(JSON.stringify(value.exceptionDetails));
        return value.result.value;
      };
      const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click(); true`);
      const snapshot=()=>evaluate(`(() => {
        const area=document.querySelector('[data-home-favorites]');
        return {
          count:area.querySelector('[data-favorites-count]').textContent,
          names:[...area.querySelectorAll('.home-favorite > button span')].map(n=>n.textContent),
          columns:getComputedStyle(area.querySelector('[data-favorites-list]')).gridTemplateColumns.split(' ').length,
          rows:[...new Set([...area.querySelectorAll('.home-favorite')].map(n=>Math.round(n.getBoundingClientRect().top)))].length,
          add:!!area.querySelector('[data-favorites-add]'),
          overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
          disabled:document.querySelector('.send-button').disabled,
          sendColor:getComputedStyle(document.querySelector('.send-button')).backgroundColor,
          editorHidden:area.querySelector('form').hidden,
          stored:Object.keys(localStorage).filter(k=>k.startsWith('lotbi.site.home-favorites.v1.')).map(k=>JSON.parse(localStorage.getItem(k))),
          errors:window.__favoriteErrors,
        };
      })()`);
      const shot=async state=>{
        if(!evidence) return;
        await evaluate("document.activeElement?.blur(); true"); await sleep(120);
        fs.mkdirSync(evidence,{recursive:true});
        const result=await page.send('Page.captureScreenshot',{format:'png'});
        fs.writeFileSync(path.join(evidence,`${label}-${state}.png`),Buffer.from(result.data,'base64'));
      };
      const fill=async(name,question)=>evaluate(`(() => {
        const form=document.querySelector('[data-favorites-editor]');
        for(const [key,value] of Object.entries(${JSON.stringify({name,question})})) {
          const input=form.elements.namedItem(key); input.value=value; input.dispatchEvent(new Event('input',{bubbles:true}));
        }
        form.requestSubmit(); return form.hidden;
      })()`);
      await page.send('Page.enable');
      await page.send('Emulation.setDeviceMetricsOverride',{width,height:780,deviceScaleFactor:1,mobile:width===360});
      await page.send('Page.navigate',{url:`${origin}/scripts/${path.basename(dir)}/inner.html`});
      const ready=await waitFor(async()=>{
        const value=await evaluate("document.getElementById('drift-result')?.textContent");
        return value && value!=='pending'?JSON.parse(value):null;
      },label,60000);
      assert.equal(ready.ok,true,ready.error);
      await sleep(200);
      let state=await snapshot();
      assert.deepEqual(state.names,['이번 주 일정']);
      assert.equal(state.count,'1/8'); assert.equal(state.add,true);
      assert.equal(state.columns,width===360?2:4); assert.equal(state.disabled,true);
      assert.equal(state.overflow,0); assert.equal(state.editorHidden,true);
      const gray=state.sendColor;
      await shot('initial');
      await evaluate("const prompt=document.getElementById('lotbi-prompt'); prompt.value='입력 확인'; prompt.dispatchEvent(new Event('input',{bubbles:true})); true");
      await waitFor(async()=> (await snapshot()).sendColor==='rgb(36, 84, 184)',`${label}: active send color`,2000);
      state=await snapshot(); assert.equal(state.disabled,false); assert.equal(state.sendColor,'rgb(36, 84, 184)'); assert.notEqual(state.sendColor,gray);
      await evaluate("document.getElementById('lotbi-prompt').value=''; document.getElementById('lotbi-prompt').dispatchEvent(new Event('input',{bubbles:true})); true");
      for(let i=2;i<=8;i++) {
        await click('[data-favorites-add]');
        assert.equal(await fill(`즐겨찾기 ${i}`,`검진 준비물 ${i} 알려줘`),true,'saved');
      }
      state=await snapshot();
      assert.equal(state.count,'8/8'); assert.equal(state.names.length,8); assert.equal(state.add,false);
      assert.equal(state.rows,width===360?4:2); assert.equal(state.overflow,0);
      await shot('eight');
      await click('[data-favorites-edit]'); await click('.home-favorite > button');
      assert.equal(await fill('가'.repeat(13),'검진 준비물 알려줘'),false,'13-char name cannot save');
      assert.equal(await fill('가'.repeat(12),'표시 이름과 다른 실제 질문을 알려줘'),true);
      state=await snapshot(); assert.equal(state.stored[0].items[0].name,'가'.repeat(12));
      assert.equal(state.stored[0].items[0].question,'표시 이름과 다른 실제 질문을 알려줘');
      await click('.home-favorite [data-favorite-action="down"]');
      state=await snapshot(); assert.equal(state.names[1],'가'.repeat(12));
      await click('.home-favorite [data-favorite-action="remove"]');
      state=await snapshot(); assert.equal(state.count,'7/8'); assert.equal(state.names[0],'가'.repeat(12));
      await click('[data-favorites-edit]');
      // Persisted order/name/question restored by an actual page reload.
      const persisted=await evaluate("Object.keys(localStorage).filter(k=>k.startsWith('lotbi.site.home-favorites.v1.')).map(k=>[k,localStorage.getItem(k)])");
      fixture=fixture.replace('  localStorage.clear();',`  localStorage.clear(); for(const [key,value] of ${JSON.stringify(persisted)}) localStorage.setItem(key,value);`);
      fs.writeFileSync(path.join(dir,'inner.html'),fixture);
      await page.send('Page.reload',{ignoreCache:true});
      await waitFor(async()=>await evaluate("document.getElementById('drift-result')?.textContent === '{\"ok\":true}'"),`${label}: reload`,60000);
      state=await snapshot(); assert.equal(state.count,'7/8'); assert.equal(state.names[0],'가'.repeat(12));
      await click('.home-favorite [data-home-prompt]');
      await waitFor(async()=>await evaluate("!!document.querySelector('.chat-message-user') && !document.querySelector('.chat-message-loading')"),`${label}: ask`,30000);
      assert.equal(await evaluate("document.querySelector('.chat-message-user').textContent.trim()"),'표시 이름과 다른 실제 질문을 알려줘');
      assert.equal(await evaluate("document.getElementById('lotbi-prompt').value"),'');
      assert.equal(await evaluate("document.activeElement===document.getElementById('lotbi-prompt')"),false);
      assert.deepEqual((await snapshot()).errors,[]);
      logs.push(`${label}: 초기1·최대8·열/행·12자·추가/수정/삭제/순서/재진입·질문분리·전송 상태 PASS`);
    } finally {page.close();}
  }
  console.log(logs.join('\n')); console.log('SITE-HOME-FAVORITES-01 PASS');
} finally {
  server.kill('SIGTERM'); await sleep(300);
  fs.rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:200});
}
