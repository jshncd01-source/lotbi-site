import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const PUBLIC_HTML = ['index.html', 'privacy.html', 'terms.html', 'account-deletion.html', 'contact.html'];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

test('all public pages load the mobile chooser runtime', () => {
  for (const rel of PUBLIC_HTML) {
    const text = read(rel);
    assert.match(text, /<script\s+src="\/mobile-entry\.js"><\/script>/, rel);
  }
});

test('custom 404 provides bridge-safe fallback bootstrap', () => {
  const text = read('404.html');
  assert.match(text, /<script\s+src="\/mobile-entry\.js"><\/script>/);
  assert.match(text, /페이지를 찾을 수 없습니다/);
  assert.match(text, /robots" content="noindex,nofollow"/);
});

test('production origin remains lotbiai.com and association files are not guessed', () => {
  assert.equal(read('CNAME').trim(), 'lotbiai.com');
  assert.equal(fs.existsSync(path.join(ROOT, '.well-known', 'assetlinks.json')), false);
  assert.equal(fs.existsSync(path.join(ROOT, '.well-known', 'apple-app-site-association')), false);
  assert.equal(fs.existsSync(path.join(ROOT, 'apple-app-site-association')), false);
});

test('contract keeps account boundary and fail-closed native gate explicit', () => {
  const contract = read('docs/MOBILE_ENTRY_APP_LINK_CONTRACT.md');
  assert.match(contract, /account\.lotbiai\.com/);
  assert.match(contract, /APP_LINK_READY` remains `false`/);
  assert.match(contract, /\/app\/open\//);
  assert.match(contract, /LOTBI 앱 준비 중/);
});
