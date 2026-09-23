// SITE-MOBILE-FOOTER-LEGAL-SHEET-01 — 접는 것과 지우는 것을 가르는 게이트.
//
// 대표: "롯비 홈페이지도 클로드처럼 유한회사 알에이디홀딩스 사업자번호만 나오게
// 하고, 거길 클릭하면 아래에서 슬라이드로 올라오게 바꿔."
//
// 390px 에서 푸터가 306px 를 먹고 있었다. 한 줄로 접되, 전자상거래법
// 제10조제1항의 표시사항은 한 항목도 사라지면 안 된다 — 자리만 바텀시트로
// 옮기는 것이다. 이 게이트가 막는 사고는 둘이다:
//
//   1. 접는다면서 실제로는 항목이 빠지는 것. 아래 MANDATORY 를 한 줄씩 센다.
//   2. 표시사항이 두 벌이 되는 것. 복사본을 만들면 한 벌만 고쳐지는 날 조용히
//      어긋난다 — sync_footer_business_info.py 가 막고 있는 바로 그 사고다.
//      그래서 문서 전체에서 정확히 한 벌인지도 함께 센다.
//
// 푸터 마크업은 index.html 에서 그대로 떼어 쓴다. 테스트용 마크업을 따로 적으면
// 실제 페이지가 바뀌어도 이 게이트는 계속 통과한다.
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

// 접힌 줄에 남는 문구. 대표가 지정한 그 한 줄이다.
const SUMMARY_LINE = '유한회사 알에이디홀딩스 | 사업자등록번호 583-88-03679';

// 시트 안에서 반드시 읽혀야 하는 것들. 앞의 여덟은 전자상거래법 제10조제1항의
// 표시사항이고, 나머지는 접기 전 푸터에 있던 링크와 서비스 표기 전부다.
const MANDATORY = [
  '유한회사 알에이디홀딩스',
  '대표자: 전선혜',
  '주소: 전북특별자치도 전주시 덕진구 혁신로 542, 1동 1층 (여의동)',
  '사업자등록번호: 583-88-03679',
  '통신판매업신고번호: 2026-전주덕진-0798',
  '063-237-0930',
  'developer@lotbiai.com',
  '호스팅서비스 제공: GitHub, Inc.',
  '회사 소개',
  '구독 안내',
  '구독 철회 및 해지',
  '반품 및 교환',
  '소비자 분쟁 해결 기준',
  '이용약관',
  '개인정보처리방침',
  '계정 삭제',
  '문의하기',
  '사업자정보확인',
  'LOTBI (롯비) © 2026 · AI Voice Commerce Agent',
];

// 오늘 배포된 주소들. 접으면서 링크를 갈아끼우면 여기서 걸린다.
const MANDATORY_HREFS = [
  'about.html',
  'subscribe.html',
  'refund.html',
  'privacy.html',
  'terms.html',
  'account-deletion.html',
  'contact.html',
  'exchange.html',
  'dispute.html',
  'tel:0632370930',
  'mailto:developer@lotbiai.com',
  'https://www.ftc.go.kr/bizCommPop.do?wrkr_no=5838803679',
];

// ── 1. 정적 계약 ──────────────────────────────────────────────────────────
assert.ok(
  index.includes(`<span class="footer-legal-summary-text">${SUMMARY_LINE}</span>`),
  'index.html: 접힌 줄은 대표가 지정한 한 줄 그대로여야 합니다',
);

const summaryTag = index.match(/<button\b[\s\S]*?data-footer-legal-toggle[\s\S]*?>/);
assert.ok(summaryTag, 'index.html: 접힌 줄을 여는 버튼이 없습니다');
assert.ok(
  /\bhidden\b/.test(summaryTag[0]),
  'index.html: 요약 버튼은 hidden 으로 출발해야 합니다 — 스크립트가 붙기 전에 '
  + '누를 수 있는 줄이 보이면 누르고도 아무 일이 없습니다',
);
assert.ok(
  /aria-expanded="false"/.test(summaryTag[0]),
  'index.html: 요약 버튼은 aria-expanded=false 로 출발해야 합니다',
);

// 접기는 body 클래스로만 열린다. 이 게이트가 없으면 나중에 @media 만으로 접도록
// 바뀔 수 있고, 그 순간 스크립트가 실패한 브라우저에서 표시사항이 통째로 사라진다.
assert.ok(
  footerCss.includes('body.footer-legal-collapsed .chat-home-footer > .company-legal'),
  'footer-business-info.css: 접기는 body.footer-legal-collapsed 아래에서만 일어나야 합니다 — '
  + '스크립트 없이도 푸터 전체가 보이는 것이 표시의무의 안전망입니다',
);
assert.ok(
  !/@media[^{]*\{\s*\.chat-home-footer\s*>\s*\.company-legal\s*\{[^}]*display:\s*none/.test(footerCss),
  'footer-business-info.css: 표시사항을 클래스 없이 미디어쿼리만으로 숨기면 안 됩니다',
);

// 옮기는 것이지 베끼는 것이 아니다.
assert.ok(
  !/cloneNode|innerHTML\s*=/.test(module_),
  'site-footer-legal.js: 표시사항을 복제하면 두 벌이 됩니다 — 노드를 옮기십시오',
);

// ── 1b. 링크 줄: 일곱 페이지가 같아야 하고, 중복이 없어야 한다 ───────────
//
// 대표: "우리는 왜케 줄이 길어. 충분히 4줄도 가능하지 않아?"
//
// 줄이 길었던 이유의 절반은 중복이었다. terms.html 이 '이용안내'와 '이용약관'
// 두 이름으로 걸려 있었고, privacy.html 은 이름까지 같은 링크가 두 번 있었다.
// 나머지 절반은 페이지마다 링크 줄이 제각각이라는 것이었고, 그 틈에 오늘 배포한
// exchange.html 과 dispute.html 이 어느 푸터에도 걸리지 않은 채 남아 있었다 —
// 만들어만 놓고 링크를 안 걸면 표시하지 않은 것과 같다.
const BUSINESS_PAGES = [
  'index.html', 'privacy.html', 'terms.html', 'subscribe.html',
  'refund.html', 'exchange.html', 'dispute.html',
];
// 이름은 그 페이지의 h1 을 따른다. terms.html 의 h1 은 '이용약관'이다.
const FOOTER_LINKS = [
  ['about.html', '회사 소개'],
  ['subscribe.html', '구독 안내'],
  ['refund.html', '구독 철회 및 해지'],
  ['exchange.html', '반품 및 교환'],
  ['dispute.html', '소비자 분쟁 해결 기준'],
  ['terms.html', '이용약관'],
  ['privacy.html', '개인정보처리방침'],
  ['account-deletion.html', '계정 삭제'],
  ['contact.html', '문의하기'],
];

for (const page of BUSINESS_PAGES) {
  const html = read(page);
  const row = html.match(/<div class="footer-links">([\s\S]*?)<\/div>/);
  assert.ok(row, `${page}: 푸터 링크 줄이 없습니다`);
  const anchors = [...row[1].matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)]
    .map(([, href, label]) => [href, label]);

  assert.deepEqual(
    anchors, FOOTER_LINKS,
    `${page}: 푸터 링크 줄이 다른 페이지와 다릅니다 — 일곱 페이지가 같은 줄을 써야 `
    + '한 곳만 고쳐지고 나머지가 뒤처지는 일이 없습니다',
  );

  const hrefs = anchors.map(([href]) => href);
  assert.equal(
    new Set(hrefs).size, hrefs.length,
    `${page}: 같은 페이지로 가는 링크가 두 번 걸려 있습니다`,
  );

  // 블록 안에서도 같은 링크를 또 걸지 않는다.
  const legal = html.match(/<div class="company-legal"[\s\S]*?\n( *)<\/div>/);
  assert.ok(legal, `${page}: 사업자 정보 블록이 없습니다`);
  for (const href of ['terms.html', 'privacy.html']) {
    assert.ok(
      !legal[0].includes(`href="${href}"`),
      `${page}: ${href} 가 링크 줄과 사업자 정보 블록에 두 번 걸려 있습니다`,
    );
  }

  // 브랜드 표기는 한 번만.
  const brands = (html.match(/AI Voice Commerce Agent/g) || []).length;
  assert.equal(brands, 1, `${page}: 브랜드 표기가 ${brands}번 나옵니다 — 한 번이어야 합니다`);
}
console.log(`링크 줄 ${FOOTER_LINKS.length}개 항목이 ${BUSINESS_PAGES.length}개 페이지에서 동일, 중복 없음`);

// ── 2. 실제 브라우저 ──────────────────────────────────────────────────────
function browserPath() {
  for (const candidate of [process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (candidate.includes('/') && fs.existsSync(candidate)) return candidate;
    const found = spawnSync('which', [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required for the mobile footer legal-sheet gate.');
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

// 실제 페이지의 푸터를 그대로 떼어 온다.
const footerMarkup = index.match(/ {6}<footer class="lotbi-footer chat-home-footer">[\s\S]*?<\/footer>/);
assert.ok(footerMarkup, 'index.html: 홈 푸터를 찾지 못했습니다');

function fixture(width) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="stylesheet" href="/styles.css" />
<link rel="stylesheet" href="/home-chat.css" />
<link rel="stylesheet" href="/footer-business-info.css" />
<link rel="stylesheet" href="/site-bottom-sheet.css" />
<style>html,body{margin:0}main{display:flex;flex-direction:column;min-height:100vh}</style>
</head>
<body class="chat-home-page">
<main class="chat-home-shell">
${footerMarkup[0]}
</main>
<script type="module" src="/site-footer-legal.js"></script>
<script type="module">
const report = body => fetch('/__result', {method: 'POST', body: JSON.stringify(body)});
const tick = () => new Promise(resolve => setTimeout(resolve, 60));
const footer = () => document.querySelector('.chat-home-footer');
const text = node => (node ? node.textContent.replace(/\\s+/g, ' ').trim() : '');
const shown = selector => {
  const node = document.querySelector(selector);
  if (!node) return null;
  return {height: Math.round(node.getBoundingClientRect().height), display: getComputedStyle(node).display};
};
const census = () => ({
  legalInDocument: document.querySelectorAll('.company-legal').length,
  legalInFooter: document.querySelectorAll('.chat-home-footer > .company-legal').length,
  linksInFooter: document.querySelectorAll('.chat-home-footer > .footer-links').length,
  legalRows: document.querySelectorAll('.company-legal > .company-legal-row').length,
});

(async () => {
  try {
    await tick(); await tick();
    const toggle = document.querySelector('[data-footer-legal-toggle]');
    const result = {width: window.innerWidth};

    result.collapsed = {
      bodyCollapsed: document.body.classList.contains('footer-legal-collapsed'),
      toggleHidden: toggle.hidden,
      toggleDisplay: getComputedStyle(toggle).display,
      toggleText: text(toggle),
      toggleHeight: Math.round(toggle.getBoundingClientRect().height),
      footerHeight: Math.round(footer().getBoundingClientRect().height),
      links: shown('.chat-home-footer > .footer-links'),
      legal: shown('.chat-home-footer > .company-legal'),
      footerRows: [...footer().children]
        .filter(node => !node.matches('[data-footer-legal-toggle]'))
        .flatMap(node => (node.matches('.company-legal') ? [...node.children] : [node]))
        .filter(node => node.getBoundingClientRect().height > 0)
        .length,
      census: census(),
    };

    if (result.collapsed.bodyCollapsed) {
      toggle.click();
      await tick();
      const sheet = document.querySelector('.lotbi-sheet');
      const rect = sheet.getBoundingClientRect();
      const close = sheet.querySelector('.footer-legal-sheet-close');
      result.open = {
        present: true,
        product: sheet.classList.contains('footer-legal-sheet'),
        presentation: sheet.dataset.presentation,
        role: sheet.getAttribute('role'),
        ariaModal: sheet.getAttribute('aria-modal'),
        bottom: Math.round(rect.bottom),
        viewportHeight: window.innerHeight,
        backdrop: !!document.querySelector('.lotbi-sheet-backdrop'),
        toggleExpanded: toggle.getAttribute('aria-expanded'),
        closeLabel: close ? close.getAttribute('aria-label') : null,
        closeWidth: close ? Math.round(close.getBoundingClientRect().width) : 0,
        closeHeight: close ? Math.round(close.getBoundingClientRect().height) : 0,
        closeLeftOfCentre: close ? close.getBoundingClientRect().left < rect.width / 2 : false,
        text: text(sheet),
        hrefs: [...sheet.querySelectorAll('a[href]')].map(a => a.getAttribute('href')),
        census: census(),
      };

      close.click();
      await tick();
      result.afterCloseButton = {
        sheet: !!document.querySelector('.lotbi-sheet'),
        backdrop: !!document.querySelector('.lotbi-sheet-backdrop'),
        toggleExpanded: toggle.getAttribute('aria-expanded'),
        census: census(),
      };

      toggle.click();
      await tick();
      document.querySelector('.lotbi-sheet-backdrop').click();
      await tick();
      result.afterBackdrop = {
        sheet: !!document.querySelector('.lotbi-sheet'),
        backdrop: !!document.querySelector('.lotbi-sheet-backdrop'),
        census: census(),
      };
    }

    await report(result);
  } catch (error) {
    await report({error: String(error && error.stack || error)});
  }
})();
</script>
</body></html>`;
}

function serve(onResult) {
  const server = http.createServer((request, response) => {
    if (request.method === 'POST' && request.url === '/__result') {
      let body = '';
      request.on('data', chunk => { body += chunk; });
      request.on('end', () => { response.writeHead(204).end(); onResult(body); });
      return;
    }
    const rel = decodeURIComponent(request.url.split('?')[0]).replace(/^\/+/, '');
    if (rel === '__fixture') {
      response.writeHead(200, {'Content-Type': MIME['.html']});
      response.end(server.__fixture);
      return;
    }
    const file = path.resolve(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {'Content-Type': MIME[path.extname(file)] || 'application/octet-stream'});
    fs.createReadStream(file).pipe(response);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// spawnSync 를 쓰면 안 된다: 브라우저가 도는 동안 이벤트 루프가 멈춰
// 픽스처를 내려줄 서버가 응답하지 못하고 그대로 물린다.
async function render(width, height) {
  let settle;
  const answered = new Promise(resolve => { settle = resolve; });
  const server = await serve(settle);
  server.__fixture = fixture(width);
  const {port} = server.address();
  const profile = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || '/tmp', 'lotbi-footer-legal-'));
  const browser = spawn(browserPath(), [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    `--window-size=${width},${height}`, `--user-data-dir=${profile}`,
    `http://127.0.0.1:${port}/__fixture`,
  ], {stdio: 'ignore'});
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('the footer legal-sheet fixture never reported back')), 90000).unref?.();
  });
  try {
    const body = await Promise.race([answered, timeout]);
    assert.ok(body && body.trim(), 'the footer legal-sheet fixture produced no result');
    const parsed = JSON.parse(body);
    if (parsed.error) throw new Error(parsed.error);
    return parsed;
  } finally {
    browser.kill();
    server.close();
    // 죽는 중인 브라우저가 프로필을 아직 비우고 있다. 임시 디렉터리 정리
    // 실패가 게이트를 떨어뜨리면 안 된다.
    try {
      fs.rmSync(profile, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
    } catch {}
  }
}

// ── 모바일 폭: 한 줄로 접히고, 누르면 전부 시트 안에 있다 ─────────────────
const phone = await render(390, 844);
console.log('phone', JSON.stringify(phone.collapsed));

assert.equal(phone.collapsed.bodyCollapsed, true, '390px: 푸터가 접히지 않았습니다');
assert.equal(phone.collapsed.toggleHidden, false, '390px: 접힌 줄이 보이지 않습니다');
assert.equal(phone.collapsed.toggleText, SUMMARY_LINE, '390px: 접힌 줄의 문구가 다릅니다');
assert.ok(
  phone.collapsed.toggleHeight >= 44,
  `390px: 접힌 줄이 ${phone.collapsed.toggleHeight}px 로 손가락 탭 타깃 44px 에 못 미칩니다`,
);
for (const [name, panel] of [['링크', phone.collapsed.links], ['사업자 정보', phone.collapsed.legal]]) {
  assert.equal(panel.display, 'none', `390px: ${name} 가 접힌 푸터에 그대로 남아 있습니다`);
}
assert.equal(phone.collapsed.footerRows, 0, '390px: 접힌 푸터에 한 줄 말고 다른 줄이 남아 있습니다');
assert.ok(
  phone.collapsed.footerHeight <= 96,
  `390px: 접힌 푸터가 ${phone.collapsed.footerHeight}px 입니다 — 한 줄이라기에는 너무 높습니다`,
);
assert.equal(phone.collapsed.census.legalInDocument, 1, '접힌 상태에서 표시사항이 한 벌이 아닙니다');

const open = phone.open;
assert.ok(open && open.present, '접힌 줄을 눌러도 시트가 올라오지 않았습니다');
assert.equal(open.product, true, '올라온 시트가 사업자 정보 시트가 아닙니다');
assert.equal(open.presentation, 'SHEET', '시트가 아래에서 올라오는 형태가 아닙니다');
assert.equal(open.role, 'dialog');
assert.equal(open.ariaModal, 'true');
assert.equal(open.backdrop, true, '시트 바깥을 눌러 닫을 배경이 없습니다');
assert.equal(open.toggleExpanded, 'true', '시트가 열렸는데 aria-expanded 가 false 입니다');
assert.ok(
  Math.abs(open.bottom - open.viewportHeight) <= 2,
  `시트가 화면 아래에 붙어 있지 않습니다 (bottom ${open.bottom}, viewport ${open.viewportHeight})`,
);
assert.ok(open.closeLabel, '시트에 이름 붙은 닫기 버튼이 없습니다');
assert.ok(
  open.closeWidth >= 44 && open.closeHeight >= 44,
  `닫기 버튼이 ${open.closeWidth}x${open.closeHeight}px 로 탭 타깃 44px 에 못 미칩니다`,
);
assert.equal(open.closeLeftOfCentre, true, '닫기 버튼은 시트 왼쪽 위에 있어야 합니다');

const missingText = MANDATORY.filter(item => !open.text.includes(item));
assert.deepEqual(
  missingText, [],
  `시트에서 빠진 표시 항목: ${missingText.join(' / ')} — 접는 것과 지우는 것은 다릅니다`,
);
const missingHrefs = MANDATORY_HREFS.filter(href => !open.hrefs.includes(href));
assert.deepEqual(missingHrefs, [], `시트에서 빠진 링크: ${missingHrefs.join(' / ')}`);
console.log(`시트 안 표시 항목 ${MANDATORY.length}/${MANDATORY.length}, 링크 ${MANDATORY_HREFS.length}/${MANDATORY_HREFS.length}`);

assert.equal(open.census.legalInDocument, 1, '시트가 열린 동안 표시사항이 두 벌이 되었습니다');
assert.equal(open.census.legalInFooter, 0, '시트로 옮긴 표시사항이 푸터에도 남아 있습니다');

// ── 닫기: 버튼과 바깥 누르기 둘 다 ───────────────────────────────────────
assert.equal(phone.afterCloseButton.sheet, false, '닫기 버튼으로 시트가 닫히지 않습니다');
assert.equal(phone.afterCloseButton.backdrop, false, '시트는 닫혔는데 배경이 남아 있습니다');
assert.equal(phone.afterCloseButton.toggleExpanded, 'false');
assert.deepEqual(
  phone.afterCloseButton.census,
  {legalInDocument: 1, legalInFooter: 1, linksInFooter: 1, legalRows: 3},
  '닫은 뒤 표시사항이 푸터로 돌아오지 않았습니다',
);

assert.equal(phone.afterBackdrop.sheet, false, '시트 바깥을 눌러도 닫히지 않습니다');
assert.deepEqual(
  phone.afterBackdrop.census,
  {legalInDocument: 1, legalInFooter: 1, linksInFooter: 1, legalRows: 3},
  '바깥 누르기로 닫은 뒤 표시사항이 푸터로 돌아오지 않았습니다',
);

// ── 넓은 화면: 접지 않는다 ────────────────────────────────────────────────
const desktop = await render(1280, 900);
console.log('desktop', JSON.stringify(desktop.collapsed));
assert.equal(desktop.collapsed.bodyCollapsed, false, '1280px: 넓은 화면까지 접혔습니다');
assert.equal(desktop.collapsed.toggleDisplay, 'none', '1280px: 넓은 화면에 접힌 줄이 나옵니다');
for (const [name, panel] of [['링크', desktop.collapsed.links], ['사업자 정보', desktop.collapsed.legal]]) {
  assert.notEqual(panel.display, 'none', `1280px: ${name} 가 사라졌습니다 — 넓은 화면은 그대로 두기로 했습니다`);
  assert.ok(panel.height > 0, `1280px: ${name} 의 높이가 0 입니다`);
}

assert.equal(
  desktop.collapsed.footerRows, 4,
  `1280px: 푸터가 ${desktop.collapsed.footerRows}줄입니다 — 링크 한 줄 + 사업자 정보 세 줄, 네 줄이어야 합니다`,
);
console.log(`1280px 푸터 ${desktop.collapsed.footerRows}줄`);

console.log('SITE-MOBILE-FOOTER-LEGAL-SHEET-01 PASS');
