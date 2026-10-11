// Family Guardian: scoped palette, shared entry-point CSS and signed-out safety.
// Local review can use a deployment-room server via SAFECARE_BASE_URL.
// Linux gate uses the existing isolated fixture runner (Core is never contacted).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const css = read('site-family-guardian.css');
assert.ok(css.includes('#F6F7F9'), 'final approved light canvas');
assert.ok(!/gradient\(/.test(css), 'no new blue gradient');
// Every light-specific rule must explicitly exclude the dark theme.
for (const rule of css.replace(/\/\*[\s\S]*?\*\//g, '').split('}')) {
  if (!rule.includes('#F6F7F9') && !rule.includes('#fff') && !rule.includes('#2563eb')) continue;
  const selector = rule.split('{')[0];
  assert.ok(selector.includes('body:not([data-site-theme="dark"])'), 'palette must exclude dark');
  assert.ok(/care|person-care-surface|pet-family-surface/.test(selector), 'palette must be family-scoped');
}
const styles = name => [...read(name).matchAll(/href="(?:\/)?(site-[^"?]+\.css)\?v=/g)].map(match => match[1]);
const entry = styles('index.html');
const callback = styles('auth/callback/index.html');
for (const list of [entry, callback]) {
  const position = list.indexOf('site-safecare.css');
  assert.ok(position >= 0);
  assert.equal(list[position + 1], 'site-family-guardian.css');
}
assert.deepEqual(entry.filter(name => /pet|person|safecare|family-guardian/.test(name)),
  callback.filter(name => /pet|person|safecare|family-guardian/.test(name)), 'both entries load family styles in identical order');
for (const name of ['index.html', 'about.html', 'subscribe.html', 'site-person.js', 'site-person-ui.js', 'site-pet-ui.js']) {
  const source = read(name).split(/\r?\n/).filter(line => !line.trimStart().startsWith('//')).join('\n');
  assert.ok(!source.includes('안심케어'), `${name}: no old displayed label`);
}
assert.ok(read('.github/workflows/site-review.yml').includes('node scripts/validate_family_guardian_design_01.mjs'), 'new inspector runs in gate');
assert.ok(read('terms.html').includes('안심케어 프로필'), 'legal copy waits for separate owner approval');
assert.ok(read('site-safecare-renewal-notice.js').includes('법정대리인만 안심케어 등록과 식별 사진 처리에 동의할 수 있습니다.'), 'consent contract is not automatically renamed');
const runner = read('scripts/validate_safecare_web_ui_redesign_01.mjs');
assert.match(runner, /fs\.mkdtempSync\([^\n]+\);\s*const browser = spawn\(/, 'profile created immediately before Chrome spawn');
console.log('FAMILY-GUARDIAN-DESIGN-01 source PASS');
if (!process.argv.includes('--source-only')) {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/validate_safecare_web_ui_redesign_01.mjs')], {
    cwd: root, stdio: 'inherit', env: {...process.env, FAMILY_GUARDIAN_REVIEW: '1',
      FAMILY_GUARDIAN_REGISTRATION_REVIEW: fs.existsSync(path.join(root,'scripts/validate_family_guardian_registration_02.mjs')) ? '1' : '0',
      SAFECARE_VIEWPORTS_JSON: JSON.stringify([
        ['mobile-360-light', 360, 844, 'light'], ['mobile-360-dark', 360, 844, 'dark'],
        ['desktop-1280-light', 1280, 900, 'light'], ['desktop-1280-dark', 1280, 900, 'dark'],
      ])},
  });
  assert.equal(result.status, 0, `family screen browser regression failed: ${result.error?.message || ''}`);
}
