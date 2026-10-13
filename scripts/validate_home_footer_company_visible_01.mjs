// 메인 회사정보는 데스크톱·모바일 모두 클릭 없이 처음부터 렌더링한다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {browserPath} from './validate_place_card_carousel_no_drift_01.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
const index = read('index.html');
const footer = index.match(/ {6}<footer class="lotbi-footer chat-home-footer">[\s\S]*?<\/footer>/)?.[0];
assert.ok(footer, '메인 푸터가 필요합니다.');
assert.ok(!/data-footer-legal-(?:disclosure|toggle)/.test(footer), '회사정보를 여는 버튼이 없어야 합니다.');
assert.equal((footer.match(/class="company-legal"/g) || []).length, 1, '회사정보 블록은 한 개여야 합니다.');

const required = [
  '유한회사 알에이디홀딩스', '대표자: 전선혜', '사업자등록번호: 583-88-03679',
  '통신판매업신고번호: 2026-전주덕진-0798', '063-237-0930', 'developer@lotbiai.com',
  '호스팅서비스 제공: 네이버클라우드 주식회사 (NAVER Cloud)',
];
for (const text of required) assert.ok(footer.includes(text), `회사정보 누락: ${text}`);

const fixture = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/home-chat.css">
<link rel="stylesheet" href="/site-theme-tokens.css"><link rel="stylesheet" href="/footer-business-info.css">
<link rel="stylesheet" href="/site-consumer-layout.css"></head>
<body class="chat-home-page"><main style="min-height:100vh;display:flex;flex-direction:column">${footer}</main>
<script>
fetch('/__result',{method:'POST',body:JSON.stringify((()=>{
  const panel=document.querySelector('.footer-legal-panels');
  const company=document.querySelector('.company-legal');
  const box=company.getBoundingClientRect();
  return {panelDisplay:getComputedStyle(panel).display,companyDisplay:getComputedStyle(company).display,
    companyHeight:Math.round(box.height),companyWidth:Math.round(box.width),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    toggles:document.querySelectorAll('details, [data-footer-legal-toggle]').length,text:company.textContent.replace(/\\s+/g,' ').trim()};
})())});
</script></body></html>`;

const MIME = {'.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8'};
const serve = onResult => new Promise(resolve => {
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/__result') {
      let body = ''; req.on('data', chunk => body += chunk); req.on('end', () => { res.writeHead(204).end(); onResult(body); }); return;
    }
    if (req.url === '/') { res.writeHead(200, {'Content-Type': MIME['.html']}); res.end(fixture); return; }
    const file = path.resolve(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, {'Content-Type': MIME[path.extname(file)] || 'application/octet-stream'}); fs.createReadStream(file).pipe(res);
  });
  server.listen(0, '127.0.0.1', () => resolve(server));
});

async function render(width, height) {
  let settle; const answer = new Promise(resolve => { settle = resolve; });
  const server = await serve(settle); const {port} = server.address();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'lotbi-home-company-visible-'));
  const chrome = spawn(browserPath(), ['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',`--window-size=${width},${height}`,`--user-data-dir=${profile}`,`http://127.0.0.1:${port}/`], {stdio:'ignore'});
  try {
    const raw = await Promise.race([answer, new Promise((_, reject) => setTimeout(() => reject(new Error('회사정보 렌더링 시간 초과')), 30000))]);
    return JSON.parse(raw);
  } finally {
    chrome.kill(); server.close();
    try { fs.rmSync(profile, {recursive:true, force:true, maxRetries:5, retryDelay:100}); } catch {}
  }
}

for (const width of [360, 390, 760, 1280]) {
  const state = await render(width, width < 800 ? 844 : 900);
  assert.equal(state.panelDisplay, 'block', `${width}px: 푸터 패널 표시`);
  assert.notEqual(state.companyDisplay, 'none', `${width}px: 회사정보 표시`);
  assert.ok(state.companyHeight > 0 && state.companyWidth > 0, `${width}px: 회사정보 크기`);
  assert.equal(state.toggles, 0, `${width}px: 클릭 버튼 없음`);
  assert.equal(state.overflow, 0, `${width}px: 가로 넘침 없음`);
  for (const text of required) assert.ok(state.text.includes(text), `${width}px: 회사정보 누락 ${text}`);
}

console.log('SITE-HOME-FOOTER-COMPANY-VISIBLE-01 PASS — 360/390/760/1280 클릭 없이 회사정보 표시');
