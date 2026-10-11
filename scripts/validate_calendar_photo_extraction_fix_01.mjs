// Synthetic UI contract checks, separate from live image accuracy evaluation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const {chromium} = require(require.resolve('playwright', {paths: [process.env.PHOTO_TEST_MODULES || root]}));
const source = fs.readFileSync(path.join(root, 'scripts/validate_calendar_add_from_image_01.mjs'), 'utf8').replaceAll('\r\n','\n');
const fixture = source.match(/const fixture = `([\s\S]*?)`;\n/)[1];
const prefix = fixture.slice(0, fixture.indexOf('try{\n  localStorage.clear();')).replace('<head>', '<head><link rel="stylesheet" href="/site-theme-tokens.css">');
const html = prefix + `
const manager=await import('/site-calendar-manager.js');
window.photoTest={manager,mountCase,stubFetch,dropImage,wait,writesOf,card};
out.textContent='ready';
</script></body></html>`;
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (name === '/photo-test.html') {res.setHeader('Content-Type','text/html; charset=utf-8'); res.end(html); return;}
  const file = path.resolve(root, '.' + name);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const browser = await chromium.launch({headless:true, ...(process.env.CHROME_BIN ? {executablePath:process.env.CHROME_BIN} : {})});
const draft = {
  contract_id:'CORE-SMART-CALENDAR-DRAFT-01',schema_version:1,source_kind:'ATTACHMENT_AI_DRAFT',requires_user_confirmation:true,automatic_write:false,
  title:'테스트상점 결제',local_date:'2026-10-11',local_time:'17:39',end_local_date:null,end_local_time:null,
  document_kind:'RECEIPT',calendar_relevance:'PAST_TRANSACTION_ONLY',detection_confidence:'HIGH',
  dedupe_fingerprint:'a'.repeat(64), source_attachment_ids:['att_aaaabbbbccccddddeeee'],
  entry:{amount_minor:2400000,currency:'KRW',expense_category:'UNCLASSIFIED',memo:null,place:null,merchant:'테스트상점'},
  review_notices:['두 자리 연도는 POSIX 규칙으로 2026년으로 읽었어요. 원본의 연도를 확인해 주세요.'],
};
try {
  for (const width of [360,1280]) for (const theme of ['light','dark']) {
    const page = await browser.newPage({viewport:{width,height:900},colorScheme:theme});
    await page.goto('http://127.0.0.1:' + server.address().port + '/photo-test.html');
    await page.waitForFunction(()=>Boolean(window.photoTest));
    const open = async value => page.evaluate(async value=>{
      document.body.dataset.siteTheme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
      const t=window.photoTest;window.testFetch=t.stubFetch({draft:value});
      const root=await t.mountCase(t.manager,{sessionToken:'synthetic-session',fetchImpl:window.testFetch});
      root.querySelector('[data-calendar-add-image]').click();t.dropImage(root);
      await t.wait(()=>Boolean(t.card())||Boolean(root.querySelector('[data-calendar-add-message]')?.textContent&&!root.querySelector('[data-calendar-add-message]').textContent.includes('읽는 중')),'photo result');
    }, value);
    await open(draft);
    assert.equal(await page.locator('.calendar-photo-confirm-save').isEnabled(),true);
    assert.match(await page.locator('.calendar-photo-confirm-card').innerText(),/2026년|10월 11일/);
    assert.match(await page.locator('.calendar-photo-confirm-amount').innerText(),/2,400,000/);
    assert.match(await page.locator('.calendar-photo-confirm-card').innerText(),/원본의 연도를 확인/);
    assert.equal(await page.evaluate(()=>photoTest.writesOf(testFetch).length),0);
    const geometry=await page.locator('.calendar-photo-confirm-dialog').boundingBox();
    assert.ok(geometry.x>=-1&&geometry.x+geometry.width<=width+1,'dialog fits viewport');
    const dialogColor=await page.locator('.calendar-photo-confirm-dialog').evaluate(el=>getComputedStyle(el).backgroundColor);
    assert.equal(dialogColor, theme === 'dark' ? 'rgb(33, 33, 33)' : 'rgb(255, 255, 255)');
    if (process.env.PHOTO_EVIDENCE_DIR) {
      fs.mkdirSync(process.env.PHOTO_EVIDENCE_DIR,{recursive:true});
      await page.screenshot({path:path.join(process.env.PHOTO_EVIDENCE_DIR,'합성영수증-수정후-'+width+'-'+theme+'.png')});
    }
    await page.locator('.calendar-photo-confirm-save').click();
    await page.waitForFunction(()=>photoTest.writesOf(testFetch).length===1);
    assert.equal(await page.evaluate(()=>photoTest.writesOf(testFetch).length),1);
    await open({...draft,local_date:null,local_time:null,review_notices:['거래 날짜를 확정하지 못했어요. 원본을 확인해 날짜를 입력해 주세요.']});
    assert.equal(await page.locator('.calendar-photo-confirm-save').isEnabled(),false);
    await page.locator('.calendar-photo-confirm-edit').click();
    assert.equal(await page.locator('.calendar-editor-date').inputValue(),'');
    await page.locator('.calendar-editor-date').fill('2026-10-11');
    assert.equal(await page.locator('.calendar-editor-save').isEnabled(),true);
    const summary={...draft,title:null,local_date:null,local_time:null,document_kind:'NOT_A_TRANSACTION',calendar_relevance:'NONE',entry:{amount_minor:null,currency:null,expense_category:null,memo:null,place:null,merchant:null},review_notices:['매출집계표는 여러 거래의 사업 매출 보고서여서 개인 지출·입금 초안으로 등록할 수 없어요.']};
    await open(summary);
    assert.equal(await page.locator('.calendar-photo-confirm-dialog').count(),0);
    assert.ok((await page.locator('[data-calendar-add-message]').allTextContents()).every(text=>/매출집계표.*등록할 수 없어요/.test(text)));
    assert.equal(await page.evaluate(()=>photoTest.writesOf(testFetch).length),0);
    console.log(JSON.stringify({width,theme,receipt:'PASS',noDate:'PASS',salesSummary:'PASS',liveImage:false}));
    await page.close();
  }
  if (process.env.PHOTO_LOCAL_CORE_URL) {
    const backend=process.env.PHOTO_LOCAL_CORE_URL;
    assert.match(backend,/^http:\/\/127\.0\.0\.1:\d+$/,'only local synthetic Core is allowed');
    const page=await browser.newPage({viewport:{width:1280,height:900}});
    await page.goto('http://127.0.0.1:'+server.address().port+'/photo-test.html');
    await page.waitForFunction(()=>Boolean(window.photoTest));
    const openLocal=async scenario=>page.evaluate(async ({backend,scenario})=>{
      const t=window.photoTest, stub=t.stubFetch();
      const calls=[];
      const impl=(url,init={})=>{
        const parsed=new URL(String(url),location.origin), method=(init.method||'GET').toUpperCase();
        calls.push({path:parsed.pathname,method,body:init.body});
        if(parsed.pathname==='/v2/conversation/messages')return fetch(backend+'/qa/draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scenario})});
        if(['/v2/life/activities','/v2/life/agenda','/v2/life/expense-summary','/v2/life/attention'].includes(parsed.pathname))return fetch(backend+parsed.pathname+parsed.search,init);
        return stub(url,init);
      };
      impl.calls=calls;window.testFetch=impl;
      const root=await t.mountCase(t.manager,{sessionToken:'synthetic-session',fetchImpl:impl});
      root.querySelector('[data-calendar-add-image]').click();t.dropImage(root);
      await t.wait(()=>Boolean(t.card())||Boolean(root.querySelector('[data-calendar-add-message]')?.textContent&&!root.querySelector('[data-calendar-add-message]').textContent.includes('읽는 중')),'local photo result');
    },{backend,scenario});
    const count=async()=> (await (await fetch(backend+'/qa/count')).json()).count;
    const summary=async(start,end)=> (await (await fetch(backend+'/v2/life/expense-summary?start='+start+'&end='+end+'&timezone=Asia%2FSeoul')).json());
    assert.equal(await count(),0);
    await openLocal('receipt');
    assert.equal(await count(),0);
    await page.locator('.calendar-photo-confirm-save').click();
    await page.waitForFunction(()=>!document.querySelector('.calendar-photo-confirm-dialog'));
    assert.equal(await count(),1);
    await openLocal('receipt');
    await page.locator('.calendar-photo-confirm-save').click();
    await page.waitForFunction(()=>!document.querySelector('.calendar-photo-confirm-dialog'));
    assert.equal(await count(),1,'reupload is deduped by actual Core');
    for (const [start,end] of [['2026-10-11','2026-10-11'],['2026-10-01','2026-10-31']]) {
      const value=await summary(start,end);
      assert.equal(value.currencies[0].total_amount_minor,2400000);
      assert.equal(value.currencies[0].entry_count,1);
    }
    await openLocal('summary');
    assert.equal(await page.locator('.calendar-photo-confirm-dialog').count(),0);
    assert.equal(await count(),1);
    await openLocal('noDate');
    assert.equal(await page.locator('.calendar-photo-confirm-save').isEnabled(),false);
    await page.locator('.calendar-photo-confirm-edit').click();
    assert.equal(await page.locator('.calendar-editor-date').inputValue(),'');
    await page.locator('.calendar-editor-date').fill('2026-10-12');
    await page.locator('.calendar-editor-save').click();
    await page.waitForFunction(()=>!document.querySelector('.calendar-editor-dialog'));
    assert.equal(await count(),2);
    console.log(JSON.stringify({localCoreSqlite:'PASS',receiptDayAndMonth:2400000,reuploadCount:1,dateEditedSave:'PASS',provider:'SYNTHETIC',paidCalls:0}));
    await page.close();
  }
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
