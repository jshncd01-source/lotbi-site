// SITE-CONVERSATION-ROTATION-01: rendered 3D motion, result selection and
// accessibility. Local fixture only; no phone call or external navigation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {browserPath, buildInner, startServer, serverPort, openDevtools, waitFor, sleep, PLACE_RESULT} from './validate_place_card_carousel_no_drift_01.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = fs.mkdtempSync(path.join(root, 'scripts/.place-rotation-'));
const server = startServer();
const browser = browserPath();
const evidence = process.env.PLACE_ROTATION_EVIDENCE_DIR;
const probe = `(() => {
  const rail = document.querySelector('.lotbi-place-orbit');
  if (!rail) return {count:0, dots:[], cards:[],emptyText:document.querySelector('.chat-message-assistant')?.textContent || ''};
  const box = n => { const r=n.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,r:r.right,b:r.bottom}; };
  return {
    theme:document.body.dataset.siteTheme,
    count: Number(rail.dataset.cardCount), arrows:rail.querySelectorAll('.lotbi-place-orbit-control').length,
    position:rail.querySelector('.lotbi-place-orbit-position').textContent,
    footerHidden:rail.querySelector('.lotbi-place-orbit-footer').hidden,
    rail:box(rail), overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    scrollLeft:rail.scrollLeft,
    dots:[...rail.querySelectorAll('[data-orbit-dot]')].map(n=>({index:Number(n.dataset.orbitDot),current:n.getAttribute('aria-current'),label:n.getAttribute('aria-label'),tab:n.tabIndex,box:box(n)})),
    cards:[...rail.querySelectorAll('.lotbi-place-orbit-card')].map(n=>{
      const css=getComputedStyle(n), m=new DOMMatrixReadOnly(css.transform);
      return {index:Number(n.dataset.orbitIndex),slot:n.dataset.orbitSlot,name:n.querySelector('.lotbi-rich-card-title').textContent,
        box:box(n),rotation:m.m13,widthScale:m.m11,duration:css.transitionDuration,ariaHidden:n.getAttribute('aria-hidden'),
        controls:[...n.querySelectorAll('a,button')].map(a=>({tab:a.tabIndex,href:a.getAttribute('href'),box:box(a)}))};
    }),
    anchors:globalThis.__anchorClicks.splice(0),
  };
})()`;
function check(p, count, index, label) {
  assert.equal(p.count,count,`${label}: all results`);
  assert.equal(p.cards.length,count,`${label}: no duplicated results`);
  if (!count) {
    assert.equal(p.dots.length,0);
    assert.ok(p.emptyText.includes('검색한 장소가 없어요.'),`${label}: completed empty-result notice`);
    return;
  }
  assert.equal(p.arrows,0,`${label}: arrows removed from DOM`);
  assert.equal(p.scrollLeft,0,`${label}: rail never scrolls`);
  assert.ok(p.overflow<=0,`${label}: no page overflow`);
  const center=p.cards.filter(c=>c.slot==='CENTER');
  assert.equal(center.length,1,`${label}: exactly one center`);
  assert.equal(center[0].index,index,`${label}: correct center`);
  assert.ok(Math.abs(center[0].rotation)<.001,`${label}: center faces forward`);
  assert.equal(center[0].ariaHidden,'false');
  assert.equal(p.dots.length,count,`${label}: exact dot count`);
  assert.deepEqual(p.dots.filter(d=>d.current==='true').map(d=>d.index),[index],`${label}: dot matches center`);
  assert.equal(p.position,`${index+1}/${count}`);
  assert.equal(p.footerHidden,count<2);
  for (const dot of p.dots) {
    assert.ok(dot.label.includes(p.cards[dot.index].name) && dot.tab===0,`${label}: named keyboard result button`);
    if (count>1) assert.ok(dot.box.w>=44 && dot.box.h>=44 && dot.box.x>=p.rail.x && dot.box.r<=p.rail.r+1,`${label}: complete 44px dot target`);
  }
  for (const c of p.cards) {
    for (const control of c.controls) {
      assert.equal(control.tab,c.index===index?0:-1,`${label}: only selected links focusable`);
      if (c.index===index && control.box.w>1) {
        assert.ok(control.box.x>=0 && control.box.r<=p.rail.r+1 && control.box.y>=c.box.y && control.box.b<=c.box.b+1,`${label}: selected link fully visible`);
      }
    }
    if (c.index!==index) {
      assert.equal(c.ariaHidden,'true',`${label}: neighbour excluded from screen reader`);
      if (c.slot.endsWith('_FRONT')) {
        assert.ok(c.slot.startsWith('LEFT') ? c.rotation>0 : c.rotation<0,`${label}: outward perspective sign`);
        assert.ok(c.widthScale>.85,`${label}: mild perspective, readable width`);
      }
    }
  }
}
const logs=[];
try {
  const origin=`http://127.0.0.1:${await serverPort(server)}`;
  for (const width of [360,1280]) for (const dark of [false,true]) for (const inputCount of [0,1,2,5,12]) {
    // Preserve the existing provider contract: at most five normalized places.
    const count=Math.min(inputCount,5);
    const label=`${width}x780-${dark?'dark':'light'}-${inputCount}→${count}`;
    const result={...PLACE_RESULT,results:Array.from({length:inputCount},(_,i)=>({...PLACE_RESULT.results[0],result_id:`rotation-${i}`,place_id:`naver:rotation-${i}`,name:`검증 장소 ${i+1} 아주 긴 장소 이름`,phone:`063-000-${String(i).padStart(4,'0')}`,road_address:'전북특별자치도 전주시 완산구 아주 긴 주소를 확인하는 검증용 도로 123-45'}))};
    const fixture=buildInner(result).replace('  localStorage.clear();', `  localStorage.clear();\n  document.cookie='lotbi_theme_preference_v1=${dark?'dark':'light'}; Path=/';`);
    fs.writeFileSync(path.join(dir,'inner.html'),fixture);
    // A fresh, existing directory immediately before each Chrome launch.
    const profile=fs.mkdtempSync(path.join(dir,'profile-'));
    const page=await openDevtools(browser,profile);
    try {
      const evaluate=async expression=>{
        const r=await page.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
        if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
        return r.result.value;
      };
      // Under load a 350–450ms card turn can still be running when a fixed 450ms
      // sleep ends (gate run 20261014T234442Z failed "reverse wrap: center faces
      // forward" that way). Keep the 450ms floor, then wait, bounded, until the
      // browser reports every finite orbit card animation finished.
      const settle=async()=>{
        await sleep(450);
        await evaluate(`(async () => {
          const deadline = performance.now() + 4000;
          const busy = () => [...document.querySelectorAll('.lotbi-place-orbit-card')]
            .flatMap(card => card.getAnimations({subtree: true}))
            .some(a => a.playState === 'running' && a.effect && a.effect.getTiming().iterations !== Infinity);
          while (busy() && performance.now() < deadline) await new Promise(r => requestAnimationFrame(r));
          await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
          return true;
        })()`);
      };
      await page.send('Page.enable');
      await page.send('Emulation.setDeviceMetricsOverride',{width,height:780,deviceScaleFactor:1,mobile:width===360});
      await page.send('Page.navigate',{url:`${origin}/scripts/${path.basename(dir)}/inner.html`});
      const ready=await waitFor(async()=>{
        const value=await evaluate("document.getElementById('drift-result')?.textContent");
        return value && value!=='pending'?JSON.parse(value):null;
      },label,60000);
      assert.equal(ready.ok,true,ready.error);
      await settle();
      const initial=await evaluate(probe);
      if (count) assert.equal(initial.theme,dark?'dark':'light',`${label}: actual theme applied`);
      check(initial,count,0,label);
      if (!count) { logs.push(`${label}: 빈 결과 유지`); continue; }
      const select=async index=>evaluate(`document.querySelector('[data-orbit-dot="${index}"]').click()`);
      if (count>1) {
        await select(1);
        // Driver time is not CSS animation time: under load the 80ms driver
        // sleep can end before the first rendered frame (or after completion).
        // Require two real transform transitions to advance naturally, then
        // inspect both at precisely 80ms on their actual browser timelines.
        const motion=await evaluate(`(async () => {
          const cards = [0, 1].map(index => document.querySelector(
            '.lotbi-place-orbit-card[data-orbit-index="' + index + '"]'
          ));
          const turns = cards.map(card => card.getAnimations().find(
            animation => animation.transitionProperty === 'transform'
          ));
          if (turns.some(turn => !turn)) throw new Error('missing card transform transition');
          let timeout;
          try {
            await Promise.race([
              (async () => {
                await Promise.all(turns.map(turn => turn.ready));
                while (!turns.every(turn => turn.currentTime > 0 &&
                  turn.currentTime < turn.effect.getTiming().duration)) {
                  if (turns.some(turn => turn.playState === 'finished')) {
                    throw new Error('card transition finished before motion observation');
                  }
                  await new Promise(resolve => requestAnimationFrame(resolve));
                }
              })(),
              new Promise((_, reject) => {
                timeout = setTimeout(() => reject(new Error('card transition did not start')), 2000);
              }),
            ]);
            const naturalTimes = turns.map(turn => turn.currentTime);
            const durations = turns.map(turn => turn.effect.getTiming().duration);
            turns.forEach(turn => { turn.pause(); turn.currentTime = 80; });
            return {naturalTimes, durations, snapshot: ${probe}};
          } finally {
            clearTimeout(timeout);
            turns.forEach(turn => turn.play());
          }
        })()`);
        assert.ok(motion.naturalTimes.every((time,index)=>time>0 && time<motion.durations[index]),`${label}: both real transitions advanced naturally`);
        assert.ok(motion.durations.every(duration=>duration>=350 && duration<=450),`${label}: both real transitions last 350–450ms`);
        const midway=motion.snapshot;
        const outgoing=midway.cards.find(c=>c.index===0),incoming=midway.cards.find(c=>c.index===1);
        assert.ok(Math.abs(outgoing.rotation)>.005 && Math.abs(incoming.rotation)>.005,`${label}: both cards rotate during transition`);
        assert.ok(incoming.duration.split(',').some(d=>Number.parseFloat(d)>=.35 && Number.parseFloat(d)<=.45),`${label}: 350–450ms transition`);
        await settle();
        check(await evaluate(probe),count,1,label);
        for (let i=0;i<count;i+=1) await select(i);
        await settle();
        check(await evaluate(probe),count,count-1,`${label}: rapid dot selection`);
        await evaluate("document.querySelector('[data-orbit-dot][aria-current=true]').focus()");
        const key=async name=>{
          const codes={ArrowRight:39,ArrowLeft:37,Home:36,End:35,Enter:13};
          await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:name,code:name,windowsVirtualKeyCode:codes[name],...(name==='Enter'?{text:'\r'}:{})});
          await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:name,code:name,windowsVirtualKeyCode:codes[name]});
          await settle();
        };
        await key('ArrowRight');check(await evaluate(probe),count,0,`${label}: forward wrap`);
        await key('ArrowLeft');check(await evaluate(probe),count,count-1,`${label}: reverse wrap`);
        await key('Home');check(await evaluate(probe),count,0,`${label}: Home`);
        await key('End');check(await evaluate(probe),count,count-1,`${label}: End`);
        await evaluate("document.querySelector('[data-orbit-dot=\"0\"]').focus()");
        await key('Enter');check(await evaluate(probe),count,0,`${label}: Enter on dot`);
        await page.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
        await select(count-1);
        await sleep(30);
        const reduced=await evaluate(probe);
        check(reduced,count,count-1,`${label}: reduced motion`);
        assert.ok(reduced.cards.every(c=>c.duration==='0s'),`${label}: no rotation animation when reduced`);
        assert.deepEqual(reduced.anchors,[],`${label}: selection opens no external link`);
      }
      if (evidence && count===5) {
        fs.mkdirSync(evidence,{recursive:true});
        await page.send('Emulation.setEmulatedMedia',{features:[]});
        await select(0);await settle();
        await evaluate("document.getElementById('drift-result').style.display='none'");
        const shot=await page.send('Page.captureScreenshot',{format:'png'});
        fs.writeFileSync(path.join(evidence,`${label}.png`),Buffer.from(shot.data,'base64'));
      }
      logs.push(`${label}: 회전·점 선택·순환·키보드·동작 축소 PASS`);
    } finally {page.close();}
  }
  console.log(logs.join('\n'));
  console.log('SITE-CONVERSATION-ROTATION-01 OK');
} finally {
  server.kill('SIGTERM');
  await sleep(300);
  fs.rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:200});
}
