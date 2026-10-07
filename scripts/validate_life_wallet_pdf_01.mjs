// LIFE-WALLET-PDF-01
// A PDF chosen for Life Wallet is drawn in the browser with the vendored pdf.js: page 1 opens
// in the usual automatic crop, a multi-page PDF offers page selection, the chosen page is
// saved as an image, and a broken PDF explains itself. The PDF is built in the test (vector
// shapes only), so no real document is involved.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runFixturePage} from './lib/headless-fixture-result.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const fixture = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/site-life-wallet.css"><style>body{margin:0;padding:12px}#host{max-width:760px;margin:auto}</style></head><body><main id="host"></main><script type="module">
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const wait = async (predicate, label) => { for (let i = 0; i < 2400; i += 1) { const value = predicate(); if (value) return value; await sleep(25); } throw new Error('timed out ' + label); };
// A minimal two-page A4 PDF: page 1 is a printed form (title bar, table, text-like rows),
// page 2 a single block. Offsets in the cross-reference table are computed exactly.
function buildPdf(pages) {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [' + pages.map((_, index) => (3 + index * 2) + ' 0 R').join(' ') + '] /Count ' + pages.length + ' >>'];
  pages.forEach((content, index) => {
    objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ' + (4 + index * 2) + ' 0 R >>');
    objects.push('<< /Length ' + content.length + ' >>\\nstream\\n' + content + '\\nendstream');
  });
  let text = '%PDF-1.4\\n'; const offsets = [];
  objects.forEach((body, index) => { offsets.push(text.length); text += (index + 1) + ' 0 obj\\n' + body + '\\nendobj\\n'; });
  const start = text.length;
  text += 'xref\\n0 ' + (objects.length + 1) + '\\n0000000000 65535 f \\n' + offsets.map(offset => String(offset).padStart(10, '0') + ' 00000 n \\n').join('');
  text += 'trailer\\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\\nstartxref\\n' + start + '\\n%%EOF\\n';
  return new TextEncoder().encode(text);
}
const rows = []; for (let row = 0; row < 24; row += 1) rows.push('60 ' + (520 - row * 18) + ' ' + (380 + (row % 5) * 20) + ' 7 re');
const form = '0 g 150 760 295 26 re f 1 w 60 560 475 160 re S 60 640 m 535 640 l S 60 600 m 535 600 l S ' + rows.join(' ') + ' f 0.8 0.1 0.2 rg 420 90 70 70 re f';
const block = '0 g 120 300 300 220 re f';
try {
  const module = await import('/site-life-wallet-scan-ui.js?test=pdf-01');
  const saved = {value: ''};
  const scanner = module.createWalletDocumentScanner({file: new File([buildPdf([form, block])], 'contract.pdf', {type: 'application/pdf'}), onConfirm: value => { saved.value = value; }});
  document.getElementById('host').replaceChildren(scanner.element);
  const element = scanner.element;
  await wait(() => element.dataset.scanState === 'review' || element.dataset.scanState === 'error', 'first page review');
  const preview = element.querySelector('.wallet-scan-result-image'); await preview.decode();
  const pages = element.querySelector('.wallet-scan-pages');
  const previous = element.querySelector('[data-wallet-scan-page-previous]'); const next = element.querySelector('[data-wallet-scan-page-next]');
  const first = {state: element.dataset.scanState, status: element.querySelector('.wallet-scan-status').textContent, mode: element.dataset.scanMode, reason: element.dataset.scanReason, pageCount: element.dataset.scanPdfPages, page: element.dataset.scanPdfPage, pagesVisible: Boolean(pages && !pages.hidden && pages.getClientRects().length), label: element.querySelector('.wallet-scan-page-label').textContent, previousDisabled: previous.disabled, nextDisabled: next.disabled, aspect: preview.naturalWidth / preview.naturalHeight, confirmEnabled: !element.querySelector('[data-wallet-scan-confirm]').disabled, warnings: element.querySelector('.wallet-scan-warnings').textContent, sourceWidth: Number(element.dataset.scanSourceWidth), sourceHeight: Number(element.dataset.scanSourceHeight)};
  const firstPreview = preview.src;
  next.click();
  await wait(() => element.dataset.scanPdfPage === '2' && element.dataset.scanState === 'review', 'second page review');
  await preview.decode();
  const second = {mode: element.dataset.scanMode, label: element.querySelector('.wallet-scan-page-label').textContent, previousDisabled: previous.disabled, nextDisabled: next.disabled, changed: preview.src !== firstPreview, confirmEnabled: !element.querySelector('[data-wallet-scan-confirm]').disabled};
  element.querySelector('[data-wallet-scan-confirm]').click();
  await wait(() => saved.value, 'confirm callback');
  second.saved = saved.value.startsWith('data:image/jpeg;base64,');
  scanner.destroy();
  const single = module.createWalletDocumentScanner({file: new File([buildPdf([form])], 'one-page.pdf', {type: 'application/pdf'})});
  document.getElementById('host').replaceChildren(single.element);
  await wait(() => single.element.dataset.scanState === 'review' || single.element.dataset.scanState === 'error', 'single page review');
  const onePage = {state: single.element.dataset.scanState, pagesHidden: single.element.querySelector('.wallet-scan-pages').hidden};
  single.destroy();
  const broken = module.createWalletDocumentScanner({file: new File([new TextEncoder().encode('%PDF-1.4 not really a pdf')], 'broken.pdf', {type: 'application/pdf'})});
  document.getElementById('host').replaceChildren(broken.element);
  await wait(() => broken.element.dataset.scanState === 'error' || broken.element.dataset.scanState === 'review', 'broken pdf outcome');
  const brokenView = {state: broken.element.dataset.scanState, status: broken.element.querySelector('.wallet-scan-status').textContent};
  broken.destroy();
  window.__result = {ok: true, first, second, onePage, brokenView};
} catch (error) { window.__result = {ok: false, error: String(error?.stack || error)}; }
</script></body></html>`;

const result = await runFixturePage({
  root: ROOT, fixturePath: '/__life_wallet_pdf_01.html', fixtureHtml: fixture, timeoutMs: 300000,
  viewport: {width: 900, height: 900},
  resultExpression: 'window.__result ? JSON.stringify(window.__result) : ""',
});
assert.equal(result.ok, true, result.error);
{
  const {first, second, onePage, brokenView} = result;
  const detail = JSON.stringify(first);
  assert.equal(first.state, 'review', `the first PDF page must open for review: ${detail}`);
  assert.equal(first.mode, 'automatic', `a PDF page must be cropped automatically: ${detail}`);
  assert.equal(first.pageCount, '2');
  assert.equal(first.page, '1', 'a PDF opens on its first page');
  assert.equal(first.pagesVisible, true, 'a multi-page PDF must offer page selection');
  assert.equal(first.label, '1 / 2쪽');
  assert.equal(first.previousDisabled, true);
  assert.equal(first.nextDisabled, false);
  assert.ok(Math.max(first.sourceWidth, first.sourceHeight) >= 2000, `the page must be drawn sharp enough to read: ${detail}`);
  assert.ok(first.aspect > .5 && first.aspect < 1, `an A4 page crop stays portrait: ${detail}`);
  assert.equal(first.confirmEnabled, true, 'save must be available for a PDF page');
  assert.equal(first.warnings, '', `a clean PDF page must not ask for a retake: ${detail}`);
  assert.equal(second.label, '2 / 2쪽');
  assert.equal(second.mode, 'automatic');
  assert.equal(second.changed, true, 'choosing another page must show that page');
  assert.equal(second.previousDisabled, false);
  assert.equal(second.nextDisabled, true);
  assert.equal(second.confirmEnabled, true);
  assert.equal(second.saved, true, 'the chosen PDF page must be saved as an image');
  assert.equal(onePage.state, 'review');
  assert.equal(onePage.pagesHidden, true, 'a one-page PDF needs no page selection');
  assert.equal(brokenView.state, 'error', `a broken PDF must stop with an explanation: ${JSON.stringify(brokenView)}`);
  assert.ok(brokenView.status.includes('PDF를 열지 못했습니다'), `broken PDF message: ${brokenView.status}`);
  console.log(`LIFE_WALLET_PDF_01 PASS — first_aspect=${first.aspect.toFixed(3)} source=${first.sourceWidth}x${first.sourceHeight} reason=${first.reason}`);
}
