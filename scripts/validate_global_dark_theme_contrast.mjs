import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const theme = fs.readFileSync(path.join(ROOT, 'site-theme-tokens.css'), 'utf8');
const conversation = fs.readFileSync(path.join(ROOT, 'site-conversation.css'), 'utf8');
const entry = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const runtime = fs.readFileSync(path.join(ROOT, 'site-conversation.js'), 'utf8');

for (const token of [
  '--lotbi-text-primary', '--lotbi-text-secondary', '--lotbi-text-muted', '--lotbi-text-disabled',
  '--lotbi-link-primary', '--lotbi-link-hover', '--lotbi-surface-primary', '--lotbi-surface-elevated',
  '--lotbi-border-default', '--lotbi-border-strong', '--lotbi-focus-ring', '--lotbi-error-text',
]) {
  if (!theme.includes(token)) throw new Error('missing semantic token ' + token);
}
if (!theme.includes('body[data-site-theme="dark"]')) throw new Error('explicit dark mapping missing');
if (!theme.includes('@media (prefers-color-scheme: dark)')) throw new Error('system dark mapping missing');
if (!entry.includes('site-theme-tokens.css?v=20260923-darklogo1')) throw new Error('theme stylesheet cache key missing');
if (!runtime.includes("getItem?.('lotbi.site.theme.bootstrap.v1')")) throw new Error('pre-paint theme bootstrap read missing');
if (!runtime.includes("setItem?.('lotbi.site.theme.bootstrap.v1', preferences.theme)")) throw new Error('theme bootstrap persistence missing');
if (!conversation.includes('color: var(--lotbi-link-primary, #18345f)')) throw new Error('Help links are not routed through semantic link token');
if (/\.help-links a\s*\{[^}]*color:\s*#18345f/u.test(conversation)) throw new Error('hardcoded Help link color remains');

const rgb = hex => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map(i => Number.parseInt(h.slice(i, i + 2), 16) / 255);
};
const luminance = hex => rgb(hex).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const required = [
  ['primary/background', '#f8fafc', '#151922', 4.5],
  ['secondary/surface', '#e5e7eb', '#202631', 4.5],
  ['muted/surface', '#cbd5e1', '#202631', 4.5],
  ['link/surface', '#a7c7ff', '#202631', 4.5],
  ['focus/background', '#a7c7ff', '#151922', 3],
  ['error/surface', '#fca5a5', '#202631', 4.5],
];
for (const [name, fg, bg, minimum] of required) {
  const ratio = contrast(fg, bg);
  if (ratio < minimum) throw new Error(name + ' contrast ' + ratio.toFixed(2) + ':1 < ' + minimum + ':1');
  console.log(name + ': ' + ratio.toFixed(2) + ':1');
}
console.log('GLOBAL DARK THEME CONTRAST CONTRACT: PASS');
