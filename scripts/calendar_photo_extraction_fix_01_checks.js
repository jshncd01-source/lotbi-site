// Browser-side assertions retained from the original Playwright gate.
// The dependency-free driver supplies assert, browser and each exact viewport.
const draft = {
  contract_id:'CORE-SMART-CALENDAR-DRAFT-01',schema_version:1,source_kind:'ATTACHMENT_AI_DRAFT',requires_user_confirmation:true,automatic_write:false,
  title:'테스트상점 결제',local_date:'2026-10-11',local_time:'17:39',end_local_date:null,end_local_time:null,
  document_kind:'RECEIPT',calendar_relevance:'PAST_TRANSACTION_ONLY',detection_confidence:'HIGH',
  dedupe_fingerprint:'a'.repeat(64), source_attachment_ids:['att_aaaabbbbccccddddeeee'],
  entry:{amount_minor:2400000,currency:'KRW',expense_category:'UNCLASSIFIED',memo:null,place:null,merchant:'테스트상점'},
  review_notices:['두 자리 연도는 POSIX 규칙으로 2026년으로 읽었어요. 원본의 연도를 확인해 주세요.'],
};
try {
  for (const width of [CASE_WIDTH]) for (const theme of [CASE_THEME]) {
    const page = await browser.newPage({viewport:{width,height:900},colorScheme:theme});
    await page.goto(location.href);
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
    if (CAPTURE_ONLY) {
      console.log(JSON.stringify({width,theme,receipt:'PASS',noDate:'NOT_RUN',salesSummary:'NOT_RUN',liveImage:false,evidenceOnly:true}));
      break;
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
  if (LOCAL_CORE_URL) {
    const backend=LOCAL_CORE_URL;
    assert.match(backend,/^http:\/\/127\.0\.0\.1:\d+$/,'only local synthetic Core is allowed');
    const page=await browser.newPage({viewport:{width:1280,height:900}});
    await page.goto(location.href);
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
} finally {await browser.close();}
