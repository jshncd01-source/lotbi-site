// SITE-HOME-SAME-URL-STABILITY-01 — mobile footer first-paint + no-JS legal access.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
const index = read('index.html');
const module_ = read('site-footer-legal.js');
const footerCss = read('footer-business-info.css');

const SUMMARY_LINE = '유한회사 알에이디홀딩스 | 사업자등록번호 583-88-03679';
const MANDATORY = [
  '유한회사 알에이디홀딩스', '대표자: 전선혜',
  '주소: 전북특별자치도 전주시 덕진구 혁신로 542, 1동 1층 (여의동)',
  '사업자등록번호: 583-88-03679', '통신판매업신고번호: 2026-전주덕진-0798',
  '063-237-0930', 'developer@lotbiai.com', '호스팅서비스 제공: GitHub, Inc.',
  '회사 소개', '구독 안내', '구독 철회 및 해지', '반품 및 교환',
  '소비자 분쟁 해결 기준', '이용약관', '개인정보처리방침', '계정 삭제',
  '문의하기', '사업자정보확인', 'LOTBI (롯비) © 2026 · AI Voice Commerce Agent',
];
const MANDATORY_HREFS = [
  'about.html', 'subscribe.html', 'refund.html', 'privacy.html', 'terms.html',
  'account-deletion.html', 'contact.html', 'exchange.html', 'dispute.html',
  'tel:0632370930', 'mailto:developer@lotbiai.com',
  'https://www.ftc.go.kr/bizCommPop.do?wrkr_no=5838803679',
];

assert.ok(index.includes(`<span class="footer-legal-summary-text">${SUMMARY_LINE}</span>`));
assert.equal((index.match(/data-footer-legal-disclosure/g) || []).length, 1, 'one native disclosure only');
assert.equal((index.match(/id="footer-legal-panels"/g) || []).length, 1, 'one legal panel source only');
const disclosureTag = index.match(/<details\b[^>]*data-footer-legal-disclosure[^>]*>/)?.[0] || '';
assert.ok(disclosureTag, 'native <details> disclosure is required');
assert.ok(!/\bopen\b/.test(disclosureTag), 'mobile first paint must start compact before JS');
const summaryTag = index.match(/<summary\b[\s\S]*?data-footer-legal-toggle[\s\S]*?>/)?.[0] || '';
assert.ok(summaryTag, 'native <summary> toggle is required');
assert.ok(!/\bhidden\b/.test(summaryTag), 'summary must be usable when enhancement JS fails');
assert.ok(/aria-controls="footer-legal-panels"/.test(summaryTag));
assert.equal((index.match(/class="company-legal"/g) || []).length, 1, 'legal/business DOM must not be duplicated');
assert.equal((index.match(/class="footer-links"/g) || []).length, 1, 'footer links DOM must not be duplicated');

for (const token of [
  '.footer-legal-disclosure:not([open]) + .footer-legal-panels',
  '.footer-legal-disclosure[open] + .footer-legal-panels',
  '@media (max-width: 760px)',
]) assert.ok(footerCss.includes(token), `missing progressive footer CSS: ${token}`);
assert.ok(!footerCss.includes('body.footer-legal-collapsed'), 'hydration-only collapse class must be gone');
assert.ok(!/cloneNode|innerHTML\s*=/.test(module_), 'legal nodes must move, never clone');
for (const token of [
  "querySelector('.footer-legal-panels')",
  "list.appendChild(panels)",
  "disclosure.insertAdjacentElement('afterend', panels)",
  "event.preventDefault()",
  "query?.addEventListener?.('change'",
]) assert.ok(module_.includes(token), `missing footer enhancement contract: ${token}`);

const BUSINESS_PAGES = [
  'index.html', 'privacy.html', 'terms.html', 'subscribe.html',
  'refund.html', 'exchange.html', 'dispute.html',
];
const FOOTER_LINKS = [
  ['about.html', '회사 소개'], ['subscribe.html', '구독 안내'],
  ['refund.html', '구독 철회 및 해지'], ['exchange.html', '반품 및 교환'],
  ['dispute.html', '소비자 분쟁 해결 기준'], ['terms.html', '이용약관'],
  ['privacy.html', '개인정보처리방침'], ['account-deletion.html', '계정 삭제'],
  ['contact.html', '문의하기'],
];
for (const page of BUSINESS_PAGES) {
  const html = read(page);
  const row = html.match(/<div class="footer-links">([\s\S]*?)<\/div>/);
  assert.ok(row, `${page}: footer links missing`);
  const anchors = [...row[1].matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)]
    .map(([, href, label]) => [href, label]);
  assert.deepEqual(anchors, FOOTER_LINKS, `${page}: legal footer links diverged`);
}

function browserPath() {
  for (const candidate of [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (candidate.includes('/') && fs.existsSync(candidate)) return candidate;
    const found = spawnSync('which', [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required for footer stability validation.');
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
};
const footerMarkup = index.match(/ {6}<footer class="lotbi-footer chat-home-footer">[\s\S]*?<\/footer>/);
assert.ok(footerMarkup, 'Home footer markup missing');

function fixture({enhance}) {
  const enhanceTag = enhance ? '<script type="module" src="/site-footer-legal.js"></script>' : '';
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="stylesheet" href="/styles.css" />
<link rel="stylesheet" href="/home-chat.css" />
<link rel="stylesheet" href="/footer-business-info.css" />
<link rel="stylesheet" href="/site-bottom-sheet.css" />
<style>html,body{margin:0}main{display:flex;flex-direction:column;min-height:100vh}</style>
</head><body class="chat-home-page"><main class="chat-home-shell">
${footerMarkup[0]}
</main>${enhanceTag}
<script>
const report = body => fetch('/__result', {method:'POST', body:JSON.stringify(body)});
const tick = ms => new Promise(resolve => setTimeout(resolve, ms));
const shown = node => node ? {display:getComputedStyle(node).display,height:Math.round(node.getBoundingClientRect().height)} : null;
const census = () => ({
  legalInDocument: document.querySelectorAll('.company-legal').length,
  panelsInFooter: document.querySelectorAll('.chat-home-footer > .footer-legal-panels').length,
  legalInFooter: document.querySelectorAll('.chat-home-footer > .footer-legal-panels .company-legal').length,
  linksInFooter: document.querySelectorAll('.chat-home-footer > .footer-legal-panels .footer-links').length,
  legalRows: document.querySelectorAll('.company-legal > .company-legal-row').length,
});
(async()=>{
  try {
    await tick(120);
    const footer=document.querySelector('.chat-home-footer');
    const details=document.querySelector('[data-footer-legal-disclosure]');
    const toggle=document.querySelector('[data-footer-legal-toggle]');
    const panels=document.querySelector('.footer-legal-panels');
    const links=panels?.querySelector('.footer-links');
    const legal=panels?.querySelector('.company-legal');
    const state={
      width:innerWidth, detailsOpen:details.open,
      disclosure:shown(details), toggle:shown(toggle), panels:shown(panels),
      links:shown(links), legal:shown(legal), toggleText:toggle.textContent.replace(/\\s+/g,' ').trim(),
      footerHeight:Math.round(footer.getBoundingClientRect().height), census:census(),
    };
    const result={initial:state};
    if(innerWidth<=760){
      toggle.click(); await tick(160);
      const sheet=document.querySelector('.lotbi-sheet');
      if(sheet){
        const rect=sheet.getBoundingClientRect();
        const close=sheet.querySelector('.footer-legal-sheet-close');
        result.enhanced={
          sheet:true, product:sheet.classList.contains('footer-legal-sheet'),
          presentation:sheet.dataset.presentation, role:sheet.getAttribute('role'),
          ariaModal:sheet.getAttribute('aria-modal'), backdrop:!!document.querySelector('.lotbi-sheet-backdrop'),
          detailsOpen:details.open, bottom:Math.round(rect.bottom), viewportHeight:innerHeight,
          closeWidth:Math.round(close.getBoundingClientRect().width), closeHeight:Math.round(close.getBoundingClientRect().height),
          text:sheet.textContent.replace(/\\s+/g,' ').trim(),
          hrefs:[...sheet.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')), census:census(),
        };
        close.click(); await tick(120);
        result.afterClose={sheet:!!document.querySelector('.lotbi-sheet'),detailsOpen:details.open,census:census()};
      } else {
        result.native={
          detailsOpen:details.open, panels:shown(panels),
          text:panels.textContent.replace(/\\s+/g,' ').trim(),
          hrefs:[...panels.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')), census:census(),
        };
      }
    }
    await report(result);
  } catch(error){await report({error:String(error?.stack||error)});}
})();
</script></body></html>`;
}

function serve(onResult, html) {
  const server=http.createServer((req,res)=>{
    if(req.method==='POST'&&req.url==='/__result'){
      let body='';req.on('data',c=>body+=c);req.on('end',()=>{res.writeHead(204).end();onResult(body);});return;
    }
    const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    if(rel==='__fixture'){res.writeHead(200,{'Content-Type':MIME['.html']});res.end(html);return;}
    const file=path.resolve(ROOT,rel);
    if(!file.startsWith(ROOT)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream'});
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server)));
}

async function render(width,height,{enhance=true}={}){
  let settle; const answered=new Promise(resolve=>{settle=resolve;});
  const server=await serve(settle,fixture({enhance}));
  const {port}=server.address();
  const profile=fs.mkdtempSync(path.join(process.env.RUNNER_TEMP||'/tmp','lotbi-footer-legal-'));
  const browser=spawn(browserPath(),[
    '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
    `--window-size=${width},${height}`,`--user-data-dir=${profile}`,
    `http://127.0.0.1:${port}/__fixture`,
  ],{stdio:'ignore'});
  const timeout=new Promise((_,reject)=>setTimeout(()=>reject(new Error('footer fixture timeout')),90000).unref?.());
  try{
    const body=await Promise.race([answered,timeout]); const parsed=JSON.parse(body);
    if(parsed.error) throw new Error(parsed.error); return parsed;
  }finally{
    browser.kill();server.close();
    try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}catch{}
  }
}

for (const width of [344,360,390,412,760]) {
  const phone=await render(width,844);
  assert.equal(phone.initial.detailsOpen,false,`${width}px: native disclosure must start closed`);
  assert.notEqual(phone.initial.disclosure.display,'none',`${width}px: compact summary must be present from first paint`);
  assert.equal(phone.initial.toggleText,SUMMARY_LINE);
  assert.ok(phone.initial.toggle.height>=44,`${width}px: summary tap target must be >=44px`);
  assert.equal(phone.initial.panels.display,'none',`${width}px: full footer flashed before enhancement`);
  assert.ok(phone.initial.footerHeight<=96,`${width}px: first-paint footer is too tall: ${phone.initial.footerHeight}`);
  assert.deepEqual(phone.initial.census,{legalInDocument:1,panelsInFooter:1,legalInFooter:1,linksInFooter:1,legalRows:3});
  assert.ok(phone.enhanced?.sheet,`${width}px: JS enhancement did not open the bottom sheet`);
  assert.equal(phone.enhanced.product,true);
  assert.equal(phone.enhanced.presentation,'SHEET');
  assert.equal(phone.enhanced.role,'dialog');
  assert.equal(phone.enhanced.ariaModal,'true');
  assert.equal(phone.enhanced.backdrop,true);
  assert.equal(phone.enhanced.detailsOpen,false,'bottom sheet and native inline panel must not be open together');
  assert.ok(Math.abs(phone.enhanced.bottom-phone.enhanced.viewportHeight)<=2);
  assert.ok(phone.enhanced.closeWidth>=44&&phone.enhanced.closeHeight>=44);
  assert.deepEqual(MANDATORY.filter(x=>!phone.enhanced.text.includes(x)),[]);
  assert.deepEqual(MANDATORY_HREFS.filter(x=>!phone.enhanced.hrefs.includes(x)),[]);
  assert.equal(phone.enhanced.census.legalInDocument,1,'sheet must move the single legal DOM, not clone it');
  assert.equal(phone.enhanced.census.panelsInFooter,0,'single panel must be moved out while sheet is open');
  assert.deepEqual(phone.afterClose.census,{legalInDocument:1,panelsInFooter:1,legalInFooter:1,linksInFooter:1,legalRows:3});
}

const noJs=await render(390,844,{enhance:false});
assert.equal(noJs.initial.panels.display,'none','no-JS first paint must remain compact');
assert.ok(noJs.native?.detailsOpen,'native details must open without enhancement JS');
assert.notEqual(noJs.native.panels.display,'none','no-JS legal panel must become visible after native summary tap');
assert.deepEqual(MANDATORY.filter(x=>!noJs.native.text.includes(x)),[]);
assert.deepEqual(MANDATORY_HREFS.filter(x=>!noJs.native.hrefs.includes(x)),[]);
assert.deepEqual(noJs.native.census,{legalInDocument:1,panelsInFooter:1,legalInFooter:1,linksInFooter:1,legalRows:3});

for (const width of [761,1280]) {
  const desktop=await render(width,900);
  assert.equal(desktop.initial.disclosure.display,'none',`${width}px: mobile disclosure leaked into desktop`);
  assert.notEqual(desktop.initial.panels.display,'none',`${width}px: desktop legal footer disappeared`);
  assert.ok(desktop.initial.panels.height>0);
  assert.equal(desktop.initial.census.legalInDocument,1);
}

console.log('SITE-MOBILE-FOOTER-LEGAL-SHEET-01 PASS — first-paint compact, no-JS accessible, single-source sheet, 344/360/390/412/760/761');
