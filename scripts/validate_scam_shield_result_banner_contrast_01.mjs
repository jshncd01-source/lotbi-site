// SCAM-SHIELD-RESULT-BANNER-CONTRAST-01 (SCAM-PHISHING-REDESIGN-02 contract) — the
// verdict reads first, in every theme.
//
// The verdict card (level chip, headline, summary, 지금 하실 일) uses the page's
// own color roles: green = 확인된 위험 신호 없음, orange = 주의·확인 필요, red =
// 위험 높음. Real Chrome renders each of the five risk levels through the real
// form (analysis answered here) in light, dark and system+dark, at a phone and
// a desktop width; the computed colors must meet WCAG AA (4.5:1) for the chip,
// headline, summary, the first do-now line, the do-not line, the page's
// 다른 내용 확인하기 and the header 대화로 돌아가기. Viewport emulation only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT, browserPath, makeWorkDir, removeDir, startServer, openPage, BASE_MOCK, freshInput, CONTRAST_FN, THEMES, waitTheme, waitFor, sleep} from './scam_shield_page_harness.mjs';

const SHOTS = process.env.SCAM_BANNER_SHOTS || '';
const css = fs.readFileSync(path.join(ROOT, 'site-scam-shield.css'), 'utf8');

const MOCK = `(() => {${BASE_MOCK}
  window.addEventListener('lotbi:scam-shield-session-request', event => { event.detail?.resolve?.(true); });
  window.addEventListener('lotbi:scam-shield-request', event => {
    const level = window.__bannerLevel || 'UNVERIFIED';
    event.detail.resolve({riskLevel: level, headline: '확인한 범위에서는 이상한 점을 찾지 못했어요.', summary: level === 'CURRENTLY_NO_RISK_SIGNAL' ? '확인한 범위에서 위험 신호는 찾지 못했어요. 다만 안전하다는 보증은 아니에요.' : '이 내용에는 기관 사칭과 링크 누르기 유도 정황이 있어요. 링크를 누르거나 답장하지 마세요.', doNow: ['공식 번호로 다시 확인하세요.'], doNot: ['주소를 열지 마세요.'], reasons: ['검증용 응답'], confirmedFacts: ['문자에 외부 주소가 없습니다.'], unverifiedItems: ['발신 기관'], incidentTriage: null, evidence: [], officialSources: [], doubleCheck: null, policeStatistics: null});
  });
})();`;

const LEVELS = ['CURRENTLY_NO_RISK_SIGNAL', 'UNVERIFIED', 'SUSPICIOUS', 'HIGH_RISK', 'CONFIRMED_MALICIOUS'];
const LABELS = {CURRENTLY_NO_RISK_SIGNAL: '확인된 위험 신호 없음', UNVERIFIED: '확인 안 됨', SUSPICIOUS: '주의 필요', HIGH_RISK: '위험 높음', CONFIRMED_MALICIOUS: '위험 높음'};
const VIEWPORTS = [
  {label: 'iPhone-390x844', width: 390, height: 844, mobile: true},
  {label: 'desktop-1280x900', width: 1280, height: 900, mobile: false},
];

const MEASURE = `(() => {
  const ratio = ${CONTRAST_FN};
  const root = document.querySelector('.consumer-workspace[data-workspace="scam"]');
  const result = root.querySelector('[data-scam-result]');
  const verdict = result.querySelector('[data-scam-verdict]');
  return {
    level: result.dataset.riskLevel,
    chipText: verdict.querySelector('[data-scam-level]')?.textContent || '',
    headlineText: verdict.querySelector('.sp-vh')?.textContent || '',
    summaryText: verdict.querySelector('[data-scam-summary]')?.textContent || '',
    theme: document.body.dataset.siteTheme || '',
    chip: ratio(verdict.querySelector('[data-scam-level] span')),
    headline: ratio(verdict.querySelector('.sp-vh')),
    summary: ratio(verdict.querySelector('[data-scam-summary]')),
    doNow: ratio(verdict.querySelector('[data-scam-do-now] li span:last-child')),
    doNot: ratio(result.querySelector('[data-scam-do-not] li span')),
    reset: ratio(result.querySelector('[data-scam-reset]')),
    back: ratio(root.querySelector('.site-modal-close.scam-back')),
    redOnPage: getComputedStyle(root).backgroundColor,
  };
})()`;

const browser = browserPath();
const workDir = makeWorkDir('scam-banner');
const srv = startServer();
const measurements = [];
try {
  const origin = await srv.origin;
  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      const p = await openPage({browser, origin, workDir, viewport, theme, mock: MOCK});
      try {
        await waitTheme(p.evaluate, theme.dark, theme.label);
        for (const level of LEVELS) {
          await p.evaluate(`window.__bannerLevel = ${JSON.stringify(level)}; true`);
          await freshInput(p);
          await p.evaluate("(() => { const t = document.querySelector('#scam-text'); t.value = '[국세청] 미납 세금 확인: 링크 확인 바랍니다'; t.dispatchEvent(new Event('input', {bubbles: true})); return true; })()");
          await p.tap('[data-scam-submit]');
          await waitFor(() => p.evaluate(`document.querySelector('[data-scam-result]')?.dataset.riskLevel === ${JSON.stringify(level)}`), `${level} result`);
          await sleep(60);
          const measured = await p.evaluate(MEASURE);
          measurements.push({viewport: viewport.label, theme: theme.label, ...measured});
          if (SHOTS) await p.screenshot(path.join(SHOTS, `${viewport.label}-${theme.label}-${level}.png`));
        }
      } finally { await p.close(); }
    }
  }
} finally {
  srv.stop();
  await removeDir(workDir);
}
for (const item of measurements) {
  console.log(`  ${item.viewport} ${item.theme.padEnd(11)} ${item.level.padEnd(24)} chip ${item.chip?.ratio} headline ${item.headline?.ratio} summary ${item.summary?.ratio} doNow ${item.doNow?.ratio} doNot ${item.doNot?.ratio} reset ${item.reset?.ratio} back ${item.back?.ratio}`);
}
// Static: the verdict roles come from the page tokens, which have a dark set.
for (const token of ['--sp-ok-ink', '--sp-warn-ink', '--sp-bad-ink', '--sp-ok-t', '--sp-warn-t', '--sp-bad-t']) {
  assert.equal((css.match(new RegExp(`${token}:`, 'gu')) || []).length, 3, `${token} defined for light, dark and system dark`);
}
for (const tone of ['bad', 'warn', 'ok']) {
  assert.match(css, new RegExp(`\\.scam-page\\.sp-root \\.sp-t-${tone} \\.sp-lv \\{ background: var\\(--sp-${tone}-t\\); border-color: var\\(--sp-${tone}-l\\); color: var\\(--sp-${tone}-ink\\); \\}`, 'u'), `${tone} chip`);
}
console.log('SCAM-SHIELD-RESULT-BANNER-CONTRAST-01 static PASS');
for (const item of measurements) {
  const where = `${item.viewport} ${item.theme} ${item.level}`;
  for (const key of ['chip', 'headline', 'summary', 'doNow', 'doNot', 'reset', 'back']) {
    if (key === 'reset' && item.viewport.startsWith('iPhone')) assert.ok(item[key], `${where}: 다른 내용 확인하기 exists`);
    assert.ok(item[key] && item[key].ratio >= 4.5, `${where}: ${key} contrast ${JSON.stringify(item[key])} is below WCAG AA 4.5:1`);
  }
  assert.equal(item.chipText, LABELS[item.level], `${where}: level chip`);
  assert.notEqual(item.redOnPage, 'rgb(220, 38, 38)', `${where}: the page itself never turns red`);
}
const noRisk = measurements.filter(item => item.level === 'CURRENTLY_NO_RISK_SIGNAL');
assert.ok(noRisk.every(item => item.headlineText === '확인한 범위에서는 이상한 점을 찾지 못했어요.'), 'the reported sentence is the one measured');
assert.ok(noRisk.every(item => item.summaryText.includes('다만 안전하다는 보증은 아니에요.')), '확인된 위험 신호 없음 keeps the no-guarantee sentence at the top');
console.log(`SCAM-SHIELD-RESULT-BANNER-CONTRAST-01 PASS — ${measurements.length} renders (5 levels × light/dark/system-dark × 390/1280), WCAG AA; viewport emulation, not a device run`);
