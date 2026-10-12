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
assert.ok(css.includes('body:not([data-site-theme="dark"])[data-site-theme="light"]'),
  'explicit light stays light even when the OS is dark');
assert.ok(css.includes('@media (prefers-color-scheme: light)') &&
  css.includes('html:not([data-site-theme-bootstrap="dark"]) body:not([data-site-theme="dark"]):not([data-site-theme="light"])'),
  'automatic light follows the OS and excludes a bootstrap dark preference');
// Every light-specific rule must explicitly exclude the dark theme.
for (const [, selector, rule] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  if (!rule.includes('#F6F7F9') && !rule.includes('#fff') && !rule.includes('#2563eb')) continue;
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
const personUi = read('site-person-ui.js');
const personGuides = read('site-person-guides.js');
const personBulk = read('site-person-bulk-photos.js');
for (const copy of [
  '기본 등록에는 얼굴 3장과 상반신·전신 사진 2장이 필요해요.',
  '다양한 각도와 상황의 사진을 최대 10장까지 등록하면 인식에 도움이 될 수 있어요.',
]) assert.ok(personBulk.includes(copy), `approved photo copy: ${copy}`);
for (const copy of [
  '기본 사진 5장을 등록해 주세요',
  '참고 이미지 사진입니다.',
  '사진을 선택하면 등록할 사람의 사진으로 변경됩니다.',
  '인식을 돕는 사진 더 추가하기 (선택)',
  '실종 신고 접수',
]) assert.ok(personUi.includes(copy), `approved screen copy: ${copy}`);
assert.ok(personGuides.includes('PERSON_REQUIRED_EXAMPLE_SLOTS') && personGuides.includes('PERSON_OPTIONAL_EXAMPLE_SLOTS'),
  'five required examples and optional capacity stay structurally separate');
assert.ok(!personUi.includes('아래 10칸은 어떤 사진이 있으면 좋은지'), 'the old ten-card example screen is gone');
assert.ok(read('.github/workflows/site-review.yml').includes('node scripts/validate_family_guardian_design_01.mjs'), 'new inspector runs in gate');
assert.ok(read('terms.html').includes('안심케어 프로필'), 'legal copy waits for separate owner approval');
assert.ok(read('site-safecare-renewal-notice.js').includes('법정대리인만 안심케어 등록과 식별 사진 처리에 동의할 수 있습니다.'), 'consent contract is not automatically renamed');
const runner = read('scripts/validate_safecare_web_ui_redesign_01.mjs');
assert.match(runner, /fs\.mkdtempSync\([^\n]+\);\s*const browser = spawn\(/, 'profile created immediately before Chrome spawn');
console.log('FAMILY-GUARDIAN-DESIGN-01 source PASS');
if (!process.argv.includes('--source-only')) {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/validate_safecare_web_ui_redesign_01.mjs')], {
    cwd: root, stdio: 'inherit', env: {...process.env, FAMILY_GUARDIAN_REVIEW: '1',
      SAFECARE_VIEWPORTS_JSON: JSON.stringify([
        ['mobile-360', 360, 844], ['desktop-1280', 1280, 900],
      ].flatMap(([label, width, height]) => [
        [label + '-light', width, height, 'light', 'light'],
        [label + '-dark', width, height, 'dark', 'dark'],
        [label + '-system-light', width, height, 'system', 'light'],
        [label + '-system-dark', width, height, 'system', 'dark'],
        [label + '-light-os-dark', width, height, 'light', 'dark'],
        [label + '-dark-os-light', width, height, 'dark', 'light'],
        [label + '-bootstrap-dark', width, height, 'dark', 'dark', true],
        [label + '-bootstrap-system-dark', width, height, 'system', 'dark', true],
        [label + '-bootstrap-light-os-dark', width, height, 'light', 'dark', true],
      ]))},
  });
  assert.equal(result.status, 0, `family screen browser regression failed: ${result.error?.message || ''}`);
}
