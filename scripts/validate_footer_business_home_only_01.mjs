import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const companyBlock = /class="company-legal" aria-label="LOTBI 사업자 정보"/g;

const index = read('index.html');
assert.equal((index.match(companyBlock) || []).length, 1, '메인 화면에는 회사정보 블록이 한 개 있어야 합니다.');
assert.ok(!/site-static-theme\.css/.test(index), '메인 화면은 정적 문서 전용 숨김 스타일을 불러오면 안 됩니다.');
assert.ok(!/data-footer-legal-(?:disclosure|toggle)/.test(index), '메인 회사정보는 클릭 없이 바로 보여야 합니다.');
assert.ok(!/site-footer-legal\.js/.test(index), '메인 회사정보를 하단 시트로 옮기면 안 됩니다.');

const staticCss = read('site-static-theme.css');
assert.match(
  staticCss,
  /\.lotbi-footer\s*>\s*\.company-legal\s*\{[^}]*display:\s*none\s*;/s,
  '정적 페이지 회사정보 블록을 숨기는 규칙이 필요합니다.',
);

for (const name of ['privacy.html', 'terms.html', 'subscribe.html', 'refund.html', 'exchange.html', 'dispute.html']) {
  const html = read(name);
  assert.equal((html.match(companyBlock) || []).length, 1, `${name}: 동의·법정 문서 원문의 회사정보 블록을 보존해야 합니다.`);
  assert.match(html, /site-static-theme\.css\?v=aset-[0-9a-f]+/, `${name}: 정적 페이지 숨김 스타일을 불러와야 합니다.`);
}

console.log('FOOTER BUSINESS HOME ONLY 01 PASS — 회사정보는 메인에 표시되고 정적 페이지에서는 렌더링되지 않습니다.');
