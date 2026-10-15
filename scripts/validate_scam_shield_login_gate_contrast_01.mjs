// SCAM-SHIELD-LOGIN-GATE-CONTRAST-01 (SCAM-PHISHING-REDESIGN-02 contract) — the
// 사기·피싱 확인 login gate: every text reads, in every theme, and every way out
// works.
//
// History: signed out, the old 진위확인 dialog's 취소 set only a white fill and
// no ink, so under color-scheme: dark it kept the browser's white button text:
// white on white, the label gone (Samsung Internet, 2026-10-08). 사기·피싱 확인
// is now a workspace page (route #scam, no dialog). Signed out it shows its
// login gate inside the page ([data-scam-login-gate], phase "login") with
// 로그인하고 확인하기 and 대화로 돌아가기, under the header ← 대화로 돌아가기.
//
// Static part: the rules the gate uses take color only from the page's --sp-*
// tokens (a fixed hover fill must still read with its ink in every token set),
// each button fill comes with its own ink, every --sp-* token used is defined
// in the light, dark and system-dark sets, and any --lotbi-* token used is
// defined for light and dark.
// Browser part: real Chrome opens 사기·피싱 확인 signed out from the menu (phone:
// the drawer) at 360/375/390/412 (touch) and 1280 in light, dark, system+light
// and system+dark (and the system theme switching while the page is open).
// While the session is checked it shows only the checking copy; then the gate,
// never the input form, and nothing is sent for analysis. It measures WCAG
// contrast of computed colors: every visible text on the page 4.5:1 (title,
// body, helper, status, both buttons, the header ← and 사기·피싱 확인, and
// 구독 및 사용량 보기 on the same surface) in the normal, hover, pressed,
// keyboard-focus and disabled states; the filled button's edge and the focus
// rings 3:1. Also: no red on the page, focus starts on 로그인하고 확인하기, Tab
// reaches 대화로 돌아가기 with a visible ring, the mobile drawer closes, and the
// layout holds (no sideways scroll, 44px targets, labels not clipped).
// Flows: 로그인하고 확인하기 asks for login once and says so; 대화로 돌아가기,
// the header ← and history back each return to the conversation (#scam gone);
// an unanswered session check falls back to the gate after 3 s; after login the
// session arriving (lotbi:site-session-state) reopens the page on the input
// form, from the home and after a reload at /#scam, and only once.
// The old 3:1 edge rule holds for the outlined buttons (대화로 돌아가기, 구독 및
// 사용량 보기) and every hover/pressed fill: control borders use --sp-ln2 and
// the primary hover fill is a theme token (--sp-pri-h), so nothing is waived.
// A session arriving while the gate is on screen steps the page on to the form.
// Viewport emulation only — not a device run.
import fs from 'node:fs';
import path from 'node:path';
import {ROOT, browserPath, makeWorkDir, removeDir, startServer, openPage, BASE_MOCK, waitTheme, waitFor, sleep} from './scam_shield_page_harness.mjs';

const SHOTS = process.env.SCAM_LOGIN_SHOTS || '';
const css = fs.readFileSync(path.join(ROOT, 'site-scam-shield.css'), 'utf8');
const tokens = fs.readFileSync(path.join(ROOT, 'site-theme-tokens.css'), 'utf8');
const started = Date.now();

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
// The 3:1 edge rule on outlined buttons and hover/pressed fills.
const edgeRule = (condition, kind, where, measured) => {
  if (!condition) failures.push(`${where}: ${kind} ${JSON.stringify(measured)} below 3:1`);
};

// ---- static ----
// Style rules with their @media context (comments removed).
function cssRules(source) {
  const text = source.replace(/\/\*[\s\S]*?\*\//gu, '');
  const rules = [];
  const stack = [];
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '{') {
      const prelude = text.slice(start, index).trim();
      if (prelude.startsWith('@')) { stack.push(prelude); start = index + 1; continue; }
      const end = text.indexOf('}', index);
      rules.push({selector: prelude, body: text.slice(index + 1, end), media: stack.join(' ')});
      index = end;
      start = end + 1;
    } else if (char === '}') {
      stack.pop();
      start = index + 1;
    }
  }
  return rules;
}
const declarations = body => [...body.matchAll(/(?:^|;)\s*([a-z-]+)\s*:\s*([^;]+)/gu)].map(([, property, value]) => ({property, value: value.trim()}));
const hexRgb = value => {
  const m = String(value).trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/iu);
  if (!m) return null;
  const hex = m[1].length === 3 ? [...m[1]].map(c => c + c).join('') : m[1];
  return {r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16)};
};
const luminance = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
const contrastOf = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100; };

const rules = cssRules(css);
const tokenSet = predicate => {
  const rule = rules.find(predicate);
  return rule ? Object.fromEntries([...rule.body.matchAll(/(--sp-[a-z0-9-]+)\s*:\s*([^;]+)/gu)].map(m => [m[1], m[2].trim()])) : null;
};
const SETS = {
  light: tokenSet(rule => !rule.media && /\.scam-page\.sp-root/u.test(rule.selector) && !/data-site-theme/u.test(rule.selector) && /--sp-bg\s*:/u.test(rule.body)),
  dark: tokenSet(rule => !rule.media && /body\[data-site-theme="dark"\]/u.test(rule.selector) && /--sp-bg\s*:/u.test(rule.body)),
  'system-dark': tokenSet(rule => /prefers-color-scheme:\s*dark/u.test(rule.media) && /body\[data-site-theme="system"\]/u.test(rule.selector) && /--sp-bg\s*:/u.test(rule.body)),
};
for (const [name, set] of Object.entries(SETS)) check(set && Object.keys(set).length >= 20, `--sp-* token set for ${name} found`);
const usedSp = [...new Set([...css.matchAll(/var\((--sp-[a-z0-9-]+)/gu)].map(match => match[1]))];
for (const name of usedSp) {
  for (const [setName, set] of Object.entries(SETS)) check(Boolean(set?.[name]), `${name} is defined for ${setName}`);
}
const lightKeys = Object.keys(SETS.light || {}).sort().join(',');
for (const setName of ['dark', 'system-dark']) check(Object.keys(SETS[setName] || {}).sort().join(',') === lightKeys, `${setName} defines the same --sp-* tokens as light`);

// Rules whose subject (last compound of a selector) is a piece of the gate page.
const GATE_CLASSES = new Set(['sp-state', 'sp-state-ic', 'sp-state-t', 'sp-state-d', 'sp-state-acts', 'sp-btn', 'sp-btn-pri', 'sp-btn-sec', 'sp-help', 'sp-center', 'sp-card', 'sp-head', 'sp-head-ic', 'sp-hero', 'sp-lead', 'scam-back']);
const BUTTON_CLASSES = new Set(['sp-btn-pri', 'sp-btn-sec', 'scam-back']);
const subjects = selector => selector.split(',').map(part => part.trim().split(/\s*[>+~]\s*|\s+/u).filter(Boolean).at(-1) || '');
const classesOf = compound => [...compound.matchAll(/\.([a-z0-9_-]+)/giu)].map(m => m[1]);
const isStateRule = compound => /:(?:hover|active|focus|focus-visible|focus-within)\b/u.test(compound);
const gateRules = rules.filter(rule => subjects(rule.selector).some(compound => classesOf(compound).some(name => GATE_CLASSES.has(name)))
  || (/data-workspace="scam"\]/u.test(rule.selector) && /\.site-modal-header h2\s*$/u.test(rule.selector)));
check(gateRules.length >= 12, `login gate rules found (${gateRules.length})`);
const COLOR_PROPS = /^(?:color|background|background-color|border|border-color|border-(?:top|right|bottom|left)(?:-color)?|outline|outline-color|fill|stroke|text-decoration-color|caret-color|box-shadow)$/u;
const FIXED = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(|\b(?:white|black)\b/iu;
// The base rule's ink token for a button class (e.g. sp-btn-pri → --sp-on-pri).
const inkTokenOf = className => {
  for (const rule of rules) {
    if (!subjects(rule.selector).some(compound => !isStateRule(compound) && !/:/u.test(compound) && classesOf(compound).includes(className))) continue;
    const ink = declarations(rule.body).find(item => item.property === 'color')?.value.match(/^var\((--sp-[a-z0-9-]+)\)$/u)?.[1];
    if (ink) return ink;
  }
  return '';
};
const fixedStateFills = [];
for (const rule of gateRules) {
  for (const {property, value} of declarations(rule.body)) {
    if (!COLOR_PROPS.test(property) || !FIXED.test(value)) continue;
    const compounds = subjects(rule.selector);
    const stateFill = /^(?:background|background-color|border-color)$/u.test(property) && compounds.every(isStateRule);
    const fixed = hexRgb(value.match(/#[0-9a-f]{3,8}\b/iu)?.[0] || '');
    const buttonClass = compounds.flatMap(classesOf).find(name => BUTTON_CLASSES.has(name)) || '';
    const ink = buttonClass ? inkTokenOf(buttonClass) : '';
    if (!stateFill || !fixed || !ink) {
      failures.push(`${rule.selector.replace(/\s+/gu, ' ')}: ${property}: ${value} — gate colors come from the --sp-* tokens`);
      continue;
    }
    // A fixed hover/pressed fill keeps the base rule's ink: it must read in every set.
    const ratios = Object.fromEntries(Object.entries(SETS).map(([setName, set]) => [setName, contrastOf(fixed, hexRgb(set?.[ink]) || {r: 0, g: 0, b: 0})]));
    fixedStateFills.push({selector: rule.selector.replace(/\s+/gu, ' '), property, value, ink, ratios});
    for (const [setName, ratio] of Object.entries(ratios)) check(ratio >= 4.5, `${rule.selector}: fixed ${property} ${value} with ${ink} in ${setName} is ${ratio}:1, below 4.5:1`);
  }
}
const fillRules = gateRules.filter(rule => subjects(rule.selector).some(compound => !isStateRule(compound) && classesOf(compound).some(name => BUTTON_CLASSES.has(name))));
let filled = 0;
for (const rule of fillRules) {
  const decls = declarations(rule.body);
  const fill = decls.find(item => /^background(?:-color)?$/u.test(item.property) && !/^(?:none|transparent)$/u.test(item.value));
  if (!fill) continue;
  filled += 1;
  check(decls.some(item => item.property === 'color'), `${rule.selector.replace(/\s+/gu, ' ')}: a fill needs its own ink (color), or the browser's button text shows on it`);
}
check(filled >= 4, `button fill rules found (${filled}: 로그인 · 로그인 disabled · 대화로 돌아가기 · header ←)`);
const darkBlock = tokens.match(/body\[data-site-theme="dark"\]\s*\{([^}]*)\}/u)?.[1] || '';
const lightBlock = tokens.match(/:root,\s*body\[data-site-theme="light"\]\s*\{([^}]*)\}/u)?.[1] || '';
const usedLotbi = [...new Set([...css.matchAll(/var\((--lotbi-[a-z0-9-]+)/gu)].map(match => match[1]))];
for (const name of usedLotbi) {
  check(new RegExp(`${name}\\s*:`, 'u').test(lightBlock), `${name} is defined for light`);
  check(new RegExp(`${name}\\s*:`, 'u').test(darkBlock), `${name} is defined for dark`);
}
const fixedSummary = [...new Set(fixedStateFills.map(item => `${item.selector.replace(/^.*\s/u, '')} ${item.value} with ${item.ink} ${Object.values(item.ratios).join('/')}:1`))];
console.log(`SCAM-SHIELD-LOGIN-GATE-CONTRAST-01 static ${failures.length ? 'FAIL' : 'PASS'} — ${gateRules.length} gate rules token-only except fixed hover fills that read with their ink in light/dark/system-dark (${fixedSummary.join(', ') || 'none'}), ${filled} button fills with ink, ${usedSp.length} --sp tokens in all three sets, ${usedLotbi.length} --lotbi tokens`);

// ---- browser ----
// Signed out: Account answers "not signed in" (BASE_MOCK), so the page's own
// session owner (site-conversation.js) answers the page's session question
// with false. The validator can hold that question (to see the checking state)
// or answer it signed in (the session after login). The login request is
// counted here and not passed on (it would leave for the real Account login).
const MOCK = `(() => {${BASE_MOCK}
  const counts = window.__scamCounts = {login: 0, analysis: 0, session: 0, open: 0};
  window.__scamHeldSession = null;
  const mode = () => {
    if (window.__scamSessionMode) return window.__scamSessionMode;
    try { return sessionStorage.getItem('scam-login-gate-validator-session') || 'page'; } catch { return 'page'; }
  };
  window.addEventListener('lotbi:scam-shield-session-request', event => {
    counts.session += 1;
    const current = mode();
    if (current === 'hold') { event.stopImmediatePropagation(); window.__scamHeldSession = event.detail.resolve; return; }
    if (current === 'signed-in') { event.stopImmediatePropagation(); event.detail.resolve(true); }
  });
  window.addEventListener('lotbi:scam-shield-login-request', event => { event.stopImmediatePropagation(); counts.login += 1; });
  window.addEventListener('lotbi:scam-shield-request', () => { counts.analysis += 1; });
  window.addEventListener('lotbi:scam-shield-open-request', () => { counts.open += 1; });
})();`;

const THEMES = [
  {label: 'light', cookie: 'light', media: 'light', dark: false},
  {label: 'dark', cookie: 'dark', media: 'light', dark: true},
  {label: 'system-light', cookie: 'system', media: 'light', dark: false, switchTo: 'dark'},
  {label: 'system-dark', cookie: 'system', media: 'dark', dark: true, switchTo: 'light'},
];
const VIEWPORTS = [
  {label: '360x780', width: 360, height: 780, mobile: true},
  {label: '375x812', width: 375, height: 812, mobile: true},
  {label: '390x844', width: 390, height: 844, mobile: true},
  {label: '412x915', width: 412, height: 915, mobile: true},
  {label: '1280x900', width: 1280, height: 900, mobile: false},
];
// The ways out, the session timeout and the after-login reopen run here.
const FLOW = new Set(['390x844 dark', '1280x900 light', '360x780 system-dark']);
const WS = '.consumer-workspace[data-workspace="scam"]';
const NODES = {
  heading: `${WS} .site-modal-header h2`,
  back: `${WS} .site-modal-close.scam-back`,
  hero: `${WS} .sp-hero`,
  lead: `${WS} .sp-lead`,
  title: '[data-scam-login-gate] .sp-state-t',
  description: '[data-scam-login-gate] .sp-state-d',
  helper: '[data-scam-login-gate] .sp-help:not([data-scam-login-status])',
  status: '[data-scam-login-status]',
  login: '[data-scam-login]',
  cancel: '[data-scam-login-cancel]',
};
const LOGIN_STATUS = '공식 LOTBI 로그인 화면으로 이동합니다.';
const REOPEN_KEY = 'lotbi.scam-shield.reopen.v1';

// WCAG 2.x contrast of computed colors. Text: its ink (alpha and opacity
// blended) on the first opaque background up the tree. A button's edge is its
// fill or its border against the surface it sits on, whichever stands out
// more; a focus ring is its outline against that surface.
const HELPERS = `
  const parse = value => { const m = String(value).match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return {r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1}; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100; };
  const blend = (top, base) => ({r: top.r * top.a + base.r * (1 - top.a), g: top.g * top.a + base.g * (1 - top.a), b: top.b * top.a + base.b * (1 - top.a)});
  const backgroundOf = node => {
    const layers = [];
    for (let el = node; el; el = el.parentElement) {
      const c = parse(getComputedStyle(el).backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
    }
    let base = {r: 255, g: 255, b: 255};
    for (const layer of layers.reverse()) base = blend(layer, base);
    return base;
  };
  const opacityOf = node => { let o = 1; for (let el = node; el; el = el.parentElement) o *= Number(getComputedStyle(el).opacity); return o; };
  const css = c => 'rgb(' + [c.r, c.g, c.b].map(Math.round).join(', ') + ')';
  const ws = document.querySelector(${JSON.stringify(WS)});
  const gate = ws?.querySelector('[data-scam-login-gate]');
  const surfaceOf = node => backgroundOf(node.parentElement || node);
  const text = node => {
    const style = getComputedStyle(node);
    const bg = backgroundOf(node);
    const ink = parse(style.color);
    const fg = blend({...ink, a: ink.a * opacityOf(node)}, bg);
    return {ratio: contrast(fg, bg), color: style.color, background: css(bg), opacity: opacityOf(node)};
  };
  const edge = node => {
    const style = getComputedStyle(node);
    const surface = surfaceOf(node);
    const fill = parse(style.backgroundColor);
    const border = parse(style.borderTopColor);
    const borderWidth = parseFloat(style.borderTopWidth) || 0;
    const fillRatio = fill && fill.a > 0 ? contrast(blend(fill, surface), surface) : 1;
    const borderRatio = border && border.a > 0 && borderWidth > 0 && style.borderTopStyle !== 'none' ? contrast(blend(border, surface), surface) : 1;
    return {ratio: Math.max(fillRatio, borderRatio), fill: style.backgroundColor, border: style.borderTopColor + ' ' + style.borderTopWidth, surface: css(surface)};
  };
  const ring = node => {
    const style = getComputedStyle(node);
    const surface = surfaceOf(node);
    const color = parse(style.outlineColor);
    const width = parseFloat(style.outlineWidth) || 0;
    const outline = style.outlineStyle + ' ' + style.outlineWidth + ' ' + style.outlineColor;
    if (style.outlineStyle === 'none' || !color || width < 2) return {ratio: 0, outline};
    return {ratio: contrast(blend(color, surface), surface), outline, surface: css(surface)};
  };
  const visible = node => Boolean(node && node.getClientRects().length && !node.closest('[hidden]') && getComputedStyle(node).visibility !== 'hidden');
`;

const MEASURE = `(() => {${HELPERS}
  const out = {siteTheme: document.body.dataset.siteTheme || '', dark: getComputedStyle(document.body).backgroundColor === 'rgb(33, 33, 33)', surface: css(backgroundOf(gate)), page: css(backgroundOf(ws))};
  for (const [key, selector] of Object.entries(${JSON.stringify(NODES)})) {
    const node = document.querySelector(selector);
    out[key] = node && (visible(node) || key === 'status') ? {...text(node), label: node.textContent.trim(), aria: node.getAttribute('aria-label') || ''} : null;
  }
  const pick = key => document.querySelector(${JSON.stringify(NODES)}[key]);
  out.loginEdge = edge(pick('login'));
  out.cancelEdge = edge(pick('cancel'));
  out.backEdge = edge(pick('back'));
  // 구독 및 사용량 보기 (the limit screen's link, the same outlined button) on the gate's surface.
  const usage = document.createElement('a');
  usage.className = 'sp-btn sp-btn-sec'; usage.href = '#';
  const usageLabel = document.createElement('span'); usageLabel.textContent = '구독 및 사용량 보기'; usage.append(usageLabel);
  gate.querySelector('.sp-state-acts').append(usage);
  out.usage = text(usage); out.usageEdge = edge(usage);
  usage.remove();
  // Every visible text on the page (header, intro, help column, gate).
  const texts = [];
  for (const node of [ws, ...ws.querySelectorAll('*')]) {
    if (!visible(node) || node.closest('.sp-sr, svg')) continue;
    const own = [...node.childNodes].filter(child => child.nodeType === 3).map(child => child.textContent).join('').trim();
    if (!own) continue;
    const rect = node.getBoundingClientRect();
    if (rect.width <= 1 || rect.height <= 1) continue;
    texts.push({label: own.slice(0, 28), tag: node.tagName.toLowerCase() + (node.className && typeof node.className === 'string' ? '.' + node.className.trim().split(/\\s+/).join('.') : ''), ...text(node)});
  }
  texts.sort((a, b) => a.ratio - b.ratio);
  out.allText = {count: texts.length, min: texts[0] || null, low: texts.filter(item => item.ratio < 4.5)};
  // No red anywhere on the login page (red is kept for danger on a result).
  const probe = document.createElement('i'); ws.append(probe);
  const reds = new Set(['rgb(220, 38, 38)']);
  for (const name of ['--sp-bad', '--sp-bad-ink', '--sp-bad-t', '--sp-bad-l']) { probe.style.color = 'var(' + name + ')'; reds.add(getComputedStyle(probe).color); }
  probe.remove();
  out.red = [];
  for (const node of [ws, ...ws.querySelectorAll('*')]) {
    if (!visible(node)) continue;
    const style = getComputedStyle(node);
    const paints = [style.color, style.backgroundColor];
    if ((parseFloat(style.borderTopWidth) || 0) > 0 && style.borderTopStyle !== 'none') paints.push(style.borderTopColor);
    if (paints.some(value => reds.has(value))) out.red.push(node.tagName.toLowerCase() + '.' + String(node.className?.baseVal ?? node.className) + ' ' + paints.join(' / '));
  }
  out.copy = ws.textContent.replace(/\\s+/g, ' ');
  // Layout: inside the viewport, label not clipped, 44px targets.
  const box = node => { const r = node.getBoundingClientRect(); return {left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height}; };
  const buttons = ['login', 'cancel'].map(key => ({key, node: pick(key)}));
  const g = box(gate);
  out.layout = {
    viewport: {width: innerWidth, height: innerHeight},
    gate: g,
    pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    workspaceOverflow: ws.scrollWidth - ws.clientWidth,
    gateOverflow: gate.scrollWidth - gate.clientWidth,
    buttons: [...buttons, {key: 'back', node: pick('back')}].map(({key, node}) => ({key, ...box(node), clipped: node.scrollWidth - node.clientWidth})),
    gap: (() => { const [a, b] = buttons.map(item => box(item.node)); return Math.max(b.top - a.bottom, b.left - a.right, a.top - b.bottom, a.left - b.right); })(),
  };
  return out;
})()`;

const STATE = key => `(() => {${HELPERS}
  const node = document.querySelector(${JSON.stringify(NODES[key])});
  return {text: text(node), edge: edge(node), ring: ring(node), focusVisible: node.matches(':focus-visible')};
})()`;

const DISABLED = `(() => {${HELPERS}
  const nodes = ['login', 'cancel', 'back'].map(key => document.querySelector(${JSON.stringify(NODES)}[key]));
  nodes.forEach(node => { node.disabled = true; });
  const out = nodes.map((node, index) => ({key: ['login', 'cancel', 'back'][index], text: text(node), edge: edge(node), cursor: getComputedStyle(node).cursor}));
  nodes.forEach(node => { node.disabled = false; });
  return out;
})()`;

const CHECKING = `(() => {${HELPERS}
  const root = ws?.querySelector('.scam-page');
  if (!root || root.dataset.scamPhase !== 'checking') return {ok: false, phase: root?.dataset.scamPhase || ''};
  const copy = root.querySelector('.sp-state .sp-state-d');
  return {
    ok: true,
    copy: copy?.textContent.trim() || '',
    copyText: copy ? text(copy) : null,
    status: root.querySelector('[data-scam-status]')?.textContent.trim() || '',
    gate: Boolean(root.querySelector('[data-scam-login-gate]')),
    form: Boolean(root.querySelector('[data-scam-text], [data-scam-url], [data-scam-submit], [data-scam-tab], input[type="file"]')),
    hash: location.hash,
  };
})()`;

const GATE = `(() => {
  const ws = document.querySelector(${JSON.stringify(WS)});
  const root = ws?.querySelector('.scam-page');
  const gate = root?.querySelector('[data-scam-login-gate]');
  const shown = Boolean(gate && gate.getClientRects().length && !gate.closest('[hidden]'));
  return {
    ok: Boolean(ws && root?.dataset.scamPhase === 'login' && shown),
    phase: root?.dataset.scamPhase || '',
    workspaces: document.querySelectorAll(${JSON.stringify(WS)}).length,
    hash: location.hash,
    form: Boolean(root?.querySelector('[data-scam-text], [data-scam-url], [data-scam-submit], [data-scam-tab], input[type="file"]')),
    drawerOpen: document.body.classList.contains('nav-drawer-open'),
    counts: {...window.__scamCounts},
    coreCalls: window.__scamNetwork.filter(item => item.url.includes('/v2/scam-shield/')).length,
  };
})()`;

const CLOSED = `(() => {
  const prompt = document.querySelector('#lotbi-prompt');
  const ws = document.querySelector(${JSON.stringify(WS)});
  return {
    ok: !ws && location.hash !== '#scam' && Boolean(prompt) && !prompt.closest('[inert]') && !document.body.classList.contains('site-workspace-open'),
    workspace: Boolean(ws), hash: location.hash, promptInert: Boolean(prompt?.closest('[inert]')),
  };
})()`;

const INPUT = `(() => {
  const all = document.querySelectorAll(${JSON.stringify(WS)});
  const root = all[0]?.querySelector('.scam-page');
  return {
    ok: all.length === 1 && root?.dataset.scamPhase === 'input' && Boolean(root.querySelector('[data-scam-text]')) && !root.querySelector('[data-scam-login-gate]'),
    workspaces: all.length, phase: root?.dataset.scamPhase || '', hash: location.hash,
    reopenKey: sessionStorage.getItem(${JSON.stringify(REOPEN_KEY)}),
    counts: {...window.__scamCounts},
    coreCalls: window.__scamNetwork.filter(item => item.url.includes('/v2/scam-shield/')).length,
  };
})()`;

const sessionState = authenticated => `window.dispatchEvent(new CustomEvent('lotbi:site-session-state', {detail: {authenticated: ${authenticated}}})); true`;

async function runCombo(browser, origin, workDir, viewport, theme, measurements, flows) {
  const where = `${viewport.label} ${theme.label}`;
  const p = await openPage({browser, origin, workDir, viewport, theme, mock: MOCK});
  try {
    const {evaluate, tap, page} = p;
    await page('CSS.enable');
    const media = value => page('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}, {name: 'prefers-color-scheme', value}]});
    await waitTheme(evaluate, theme.dark, where);
    const shot = async name => { if (SHOTS) await p.screenshot(path.join(SHOTS, `${viewport.label}-${name}.png`)); };

    const openFromMenu = async () => {
      if (viewport.mobile) {
        await tap('[data-mobile-nav-open]');
        await waitFor(() => evaluate("document.body.classList.contains('nav-drawer-open')"), `${where} mobile menu shown`);
        await tap('#mobile-nav-drawer [data-scam-open]');
      } else {
        await tap('[data-scam-open]');
      }
    };
    // Opened with the page's own session owner answering: the gate comes before
    // the 3 s fallback, so it was the real answer (signed out).
    const openGate = async label => {
      await evaluate("window.__scamSessionMode = 'page', true");
      const at = Date.now();
      await openFromMenu();
      const gate = await waitFor(() => evaluate(GATE), `${where} ${label}: login gate shown`);
      return {...gate, ms: Date.now() - at};
    };
    const forced = async (key, states) => {
      const {root} = await page('DOM.getDocument', {depth: 0});
      const {nodeId} = await page('DOM.querySelector', {nodeId: root.nodeId, selector: NODES[key]});
      await page('CSS.forcePseudoState', {nodeId, forcedPseudoClasses: states});
      try { await sleep(40); return await evaluate(STATE(key)); }
      finally { await page('CSS.forcePseudoState', {nodeId, forcedPseudoClasses: []}); }
    };

    // The header 로그인 (mobile, signed out) had a fixed light fill under the dark theme's white ink.
    const headerLogin = async () => evaluate(`(() => {${HELPERS}
      const node = [...document.querySelectorAll('.account-login')].find(item => item.getClientRects().length && !item.closest('[hidden], [inert]'));
      return node ? {label: node.textContent.trim(), ...text(node)} : null;
    })()`);
    const header = viewport.mobile ? await waitFor(headerLogin, `${where} header 로그인 shown`) : await headerLogin();

    // 1. The session question held: only the checking state shows.
    await evaluate("window.__scamSessionMode = 'hold', true");
    await openFromMenu();
    const checking = await waitFor(() => evaluate(CHECKING), `${where} checking state`, 2500);
    await shot(`${theme.label}-checking`);
    // Hand the held question to the page's own session owner (signed out).
    await evaluate(`(() => {
      const resolve = window.__scamHeldSession;
      window.__scamSessionMode = 'page';
      window.dispatchEvent(new CustomEvent('lotbi:scam-shield-session-request', {detail: {resolve}}));
      return true;
    })()`);
    const gate = await waitFor(() => evaluate(GATE), `${where} login gate shown`);
    await sleep(120);
    gate.focusOnLogin = await evaluate("document.activeElement?.matches('[data-scam-login]') === true");

    const record = async (themeLabel, dark) => {
      const measured = await evaluate(MEASURE);
      measured.states = {};
      for (const key of ['login', 'cancel', 'back']) {
        measured.states[key] = {
          hover: await forced(key, ['hover']),
          active: await forced(key, ['hover', 'active', 'focus']),
          focus: await forced(key, ['focus', 'focus-visible']),
        };
      }
      measured.disabled = await evaluate(DISABLED);
      const item = {viewport: viewport.label, mobile: viewport.mobile, theme: themeLabel, expectDark: dark, ...measured};
      if (themeLabel === theme.label) Object.assign(item, {headerLogin: header, checking, gate});
      measurements.push(item);
      await shot(themeLabel);
      return item;
    };
    const primary = await record(theme.label, theme.dark);

    // System theme switching while the page stays open.
    if (theme.switchTo) {
      await media(theme.switchTo);
      await waitTheme(evaluate, theme.switchTo === 'dark', `${where} system switch to ${theme.switchTo}`);
      await sleep(80);
      await record(`${theme.label}→${theme.switchTo}`, theme.switchTo === 'dark');
      await media(theme.media);
      await waitTheme(evaluate, theme.dark, `${where} system switch back`);
    }

    // Keyboard: from the focused 로그인하고 확인하기, Tab reaches 대화로 돌아가기 with a visible ring.
    if (!viewport.mobile) {
      await evaluate("document.querySelector('[data-scam-login]').focus(), true");
      await page('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9});
      await page('Input.dispatchKeyEvent', {type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9});
      primary.keyboard = await waitFor(() => evaluate(`(() => {${HELPERS}
        const node = document.activeElement;
        if (!node?.matches('[data-scam-login-cancel]')) return {ok: false, active: node?.outerHTML?.slice(0, 80)};
        return {ok: true, focusVisible: node.matches(':focus-visible'), ring: ring(node), text: text(node)};
      })()`), `${where} Tab to 대화로 돌아가기`);
    }

    // 로그인하고 확인하기 asks the page to start login once and says so; the page stays.
    await tap('[data-scam-login]');
    primary.loginFlow = await waitFor(() => evaluate(`(() => {${HELPERS}
      const node = document.querySelector('[data-scam-login-status]');
      const status = node?.textContent.trim() || '';
      const reopen = JSON.parse(sessionStorage.getItem(${JSON.stringify(REOPEN_KEY)}) || 'null');
      const root = ws?.querySelector('.scam-page');
      const out = {status, requests: window.__scamCounts.login, analysis: window.__scamCounts.analysis, phase: root?.dataset.scamPhase || '', reopen: Number.isFinite(reopen?.startedAt), statusText: node ? text(node) : null};
      return out.requests === 1 && status === ${JSON.stringify(LOGIN_STATUS)} ? {ok: true, ...out} : {ok: false, ...out};
    })()`), `${where} login request`);
    await shot(`${theme.label}-login-status`);

    if (!FLOW.has(where)) return;
    const flow = {where};
    // (a) 대화로 돌아가기 returns to the conversation and the URL leaves /#scam.
    await tap('[data-scam-login-cancel]');
    flow.cancel = await waitFor(() => evaluate(CLOSED), `${where} 대화로 돌아가기 returns to the conversation`);
    // (b) The header ← does the same.
    flow.backGate = await openGate('header ←');
    await tap(NODES.back);
    flow.back = await waitFor(() => evaluate(CLOSED), `${where} header ← returns to the conversation`);
    // (c) The browser back does the same.
    flow.historyGate = await openGate('history back');
    flow.hashWhileOpen = await evaluate('location.hash');
    await evaluate('history.back(), true');
    flow.history = await waitFor(() => evaluate(CLOSED), `${where} back returns to the conversation`);
    // An unanswered session question falls back to the gate (3 s), never stays on checking.
    await evaluate("window.__scamSessionMode = 'hold', true");
    const holdAt = Date.now();
    await openFromMenu();
    await waitFor(() => evaluate(CHECKING), `${where} checking while unanswered`, 2500);
    flow.timeout = await waitFor(() => evaluate(GATE), `${where} unanswered session falls back to the gate`, 6000);
    flow.timeout.ms = Date.now() - holdAt;
    await evaluate("window.__scamSessionMode = 'page', true");
    await tap('[data-scam-login-cancel]');
    await waitFor(() => evaluate(CLOSED), `${where} closed after the fallback gate`);
    // (e) The session arrives while the gate is still on screen (a late bearer,
    // a silent refresh): the gate steps on to the form in place, one page.
    flow.inPlaceGate = await openGate('session in place');
    await evaluate("window.__scamSessionMode = 'signed-in', true");
    await evaluate(sessionState(true));
    flow.inPlace = await waitFor(() => evaluate(INPUT), `${where} session in place → input form`);
    await evaluate("window.__scamSessionMode = 'page', true");
    await tap(NODES.back);
    await waitFor(() => evaluate(CLOSED), `${where} closed after the in-place session`);
    // (e) After login: the session arrives on the home (the page was left), and
    // lotbi:site-session-state reopens the page on the input form, once.
    flow.loginGate = await openGate('login before session');
    await tap('[data-scam-login]');
    await waitFor(() => evaluate("window.__scamCounts.login === 2 && Boolean(sessionStorage.getItem('lotbi.scam-shield.reopen.v1'))"), `${where} second login request`);
    await tap('[data-scam-login-cancel]');
    await waitFor(() => evaluate(CLOSED), `${where} closed before the session arrives`);
    const opensBefore = await evaluate('window.__scamCounts.open');
    await evaluate("window.__scamSessionMode = 'signed-in', true");
    await evaluate(sessionState(true));
    flow.reopen = await waitFor(() => evaluate(INPUT), `${where} session arrives → input form`);
    flow.reopen.opens = flow.reopen.counts.open - opensBefore;
    await shot(`${theme.label}-after-login-input`);
    // The reopen mark is used up: leaving and another session announcement do not reopen it.
    await tap(NODES.back);
    await waitFor(() => evaluate(CLOSED), `${where} closed after the reopen`);
    await evaluate(sessionState(true));
    await sleep(400);
    flow.noSecondReopen = await evaluate(CLOSED);
    // (e) The real return: login left from /#scam and the document comes back at
    // /#scam signed in — the page opens on the input form, and the session
    // announcement after it does not open a second page.
    await evaluate("window.__scamSessionMode = 'page', true");
    flow.reloadGate = await openGate('login before reload');
    await tap('[data-scam-login]');
    await waitFor(() => evaluate("window.__scamCounts.login === 3 && location.hash === '#scam'"), `${where} third login request`);
    await evaluate("sessionStorage.setItem('scam-login-gate-validator-session', 'signed-in'), window.__oldDocument = true, true");
    await page('Page.reload', {});
    await waitFor(() => evaluate("!window.__oldDocument && document.body?.dataset.conversationRestore === 'ready'"), `${where} reloaded`, 20000);
    flow.restored = await waitFor(() => evaluate(INPUT), `${where} /#scam reload signed in → input form`, 15000);
    await evaluate(sessionState(true));
    await sleep(400);
    flow.afterAnnouncement = await evaluate(INPUT);
    flows.push(flow);
  } finally {
    await p.close();
  }
}

const browser = browserPath();
const workDir = makeWorkDir('scam-login-gate');
const srv = startServer();
const measurements = [];
const flows = [];
try {
  const origin = await srv.origin;
  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) await runCombo(browser, origin, workDir, viewport, theme, measurements, flows);
  }
} finally {
  srv.stop();
  await removeDir(workDir);
}

const fmt = value => String(value).padStart(5);
for (const item of measurements) {
  const s = item.states;
  console.log(`  ${item.viewport.padEnd(8)} ${item.theme.padEnd(19)} card ${item.surface} | 로그인 ${fmt(item.login?.ratio)} edge ${fmt(item.loginEdge.ratio)} | 돌아가기 ${fmt(item.cancel?.ratio)} edge ${fmt(item.cancelEdge.ratio)} | ← ${fmt(item.back?.ratio)} | 제목 ${fmt(item.title?.ratio)} 설명 ${fmt(item.description?.ratio)} 도움말 ${fmt(item.helper?.ratio)} 상태 ${fmt(item.status?.ratio)} | 사용량 ${fmt(item.usage.ratio)} edge ${fmt(item.usageEdge.ratio)} | 전체 ${item.allText.count}개 최저 ${item.allText.min?.ratio} (${item.allText.min?.label})`);
  console.log(`  ${''.padEnd(28)} hover 로그인 ${s.login.hover.text.ratio}/${s.login.hover.edge.ratio} 돌아가기 ${s.cancel.hover.text.ratio} ← ${s.back.hover.text.ratio} | 눌림 로그인 ${s.login.active.text.ratio}/${s.login.active.edge.ratio} 돌아가기 ${s.cancel.active.text.ratio} ← ${s.back.active.text.ratio} | ring 로그인 ${s.login.focus.ring.ratio} 돌아가기 ${s.cancel.focus.ring.ratio} ← ${s.back.focus.ring.ratio} | 비활성 ${item.disabled.map(d => `${d.key} ${d.text.ratio}`).join(' ')} | 버튼 ${item.layout.buttons.map(b => `${Math.round(b.width)}x${Math.round(b.height)}`).join(' / ')} 간격 ${Math.round(item.layout.gap)}${item.checking ? ` | 확인 중 ${item.checking.copyText?.ratio}` : ''}${item.loginFlow ? ` | 상태문 ${item.loginFlow.statusText?.ratio}` : ''}${item.keyboard ? ` | Tab→돌아가기 ring ${item.keyboard.ring.ratio}` : ''}${item.headerLogin ? ` | 헤더 로그인 ${item.headerLogin.ratio}` : ''}`);
}
for (const flow of flows) {
  console.log(`  flow ${flow.where}: 돌아가기 ${flow.cancel.ok} · ← ${flow.back.ok} · 뒤로 ${flow.history.ok} (open ${flow.hashWhileOpen}) · gate ${flow.backGate.ms}/${flow.historyGate.ms}ms · 응답 없음→gate ${flow.timeout.ms}ms · 로그인 후 재열기 ${flow.reopen.phase} (open-request ${flow.reopen.opens}) · 재알림 ${flow.noSecondReopen.workspace ? 'reopened' : 'stays closed'} · /#scam 새로고침 ${flow.restored.phase} → 알림 후 ${flow.afterAnnouncement.phase} (${flow.afterAnnouncement.workspaces} page)`);
}

const STORAGE_COPY = /보관|저장|삭제|파기|보존/u;
for (const item of measurements) {
  const where = `${item.viewport} ${item.theme}`;
  check(item.dark === item.expectDark, `${where}: theme ${item.dark ? 'dark' : 'light'} expected ${item.expectDark ? 'dark' : 'light'}`);
  check(item.heading?.label === '사기·피싱 확인', `${where}: page title ${item.heading?.label}`);
  check(item.back?.label === '← 대화로 돌아가기' && item.back?.aria === '대화로 돌아가기', `${where}: header back ${JSON.stringify(item.back?.label)} / ${item.back?.aria}`);
  check(item.title?.label === '사기·피싱 확인은 로그인 후 사용할 수 있어요', `${where}: gate title ${item.title?.label}`);
  check(Boolean(item.description?.label) && Boolean(item.helper?.label), `${where}: gate description and helper shown`);
  check(item.login?.label === '로그인하고 확인하기', `${where}: login label ${item.login?.label}`);
  check(item.cancel?.label === '대화로 돌아가기', `${where}: cancel label ${item.cancel?.label}`);
  check(!STORAGE_COPY.test(item.copy), `${where}: no storage/retention/deletion copy on the login page`);
  for (const key of ['heading', 'back', 'hero', 'lead', 'title', 'description', 'helper', 'status', 'login', 'cancel', 'usage']) check(item[key] && item[key].ratio >= 4.5, `${where}: ${key} text ${JSON.stringify(item[key])} below 4.5:1`);
  check(item.allText.count >= 8 && item.allText.low.length === 0, `${where}: every visible text 4.5:1 — ${item.allText.count} texts, below: ${JSON.stringify(item.allText.low)}`);
  check(item.loginEdge.ratio >= 3, `${where}: 로그인하고 확인하기 fill ${JSON.stringify(item.loginEdge)} below 3:1 against the card`);
  edgeRule(item.cancelEdge.ratio >= 3, '대화로 돌아가기 edge', where, item.cancelEdge);
  edgeRule(item.usageEdge.ratio >= 3, '구독 및 사용량 보기 edge', where, item.usageEdge);
  for (const key of ['login', 'cancel', 'back']) {
    for (const state of ['hover', 'active', 'focus']) check(item.states[key][state].text.ratio >= 4.5, `${where}: ${key} ${state} text ${JSON.stringify(item.states[key][state].text)} below 4.5:1`);
    for (const state of ['hover', 'active']) if (key !== 'back') edgeRule(item.states[key][state].edge.ratio >= 3, `${key} ${state} edge`, where, item.states[key][state].edge);
    check(item.states[key].focus.ring.ratio >= 3, `${where}: ${key} focus ring ${JSON.stringify(item.states[key].focus.ring)} below 3:1`);
  }
  for (const disabled of item.disabled) check(disabled.text.ratio >= 4.5, `${where}: disabled ${disabled.key} text ${JSON.stringify(disabled.text)} below 4.5:1`);
  check(item.red.length === 0, `${where}: red on the login page ${JSON.stringify(item.red.slice(0, 4))}`);
  if (item.headerLogin) check(item.headerLogin.ratio >= 4.5, `${where}: header 로그인 text ${JSON.stringify(item.headerLogin)} below 4.5:1`);
  if (item.mobile && !item.theme.includes('→')) check(item.headerLogin?.label === '로그인', `${where}: header 로그인 not measured`);
  if (item.checking) {
    const c = item.checking;
    check(c.copy === '로그인 상태를 확인하고 있어요.' && c.status === '로그인 상태를 확인하고 있어요.', `${where}: checking copy ${JSON.stringify(c.copy)} / status ${JSON.stringify(c.status)}`);
    check(!c.gate && !c.form, `${where}: while checking neither the gate (${c.gate}) nor the form (${c.form}) shows`);
    check(c.copyText?.ratio >= 4.5, `${where}: checking copy ${JSON.stringify(c.copyText)} below 4.5:1`);
    check(c.hash === '#scam', `${where}: /#scam while open (${c.hash})`);
  }
  if (item.gate) {
    const g = item.gate;
    check(!g.form, `${where}: signed out, the input form is not on the page`);
    check(g.workspaces === 1 && g.hash === '#scam', `${where}: one page at /#scam (${g.workspaces}, ${g.hash})`);
    check(g.counts.analysis === 0 && g.coreCalls === 0, `${where}: nothing sent for analysis (${g.counts.analysis} requests, ${g.coreCalls} Core calls)`);
    check(!g.drawerOpen, `${where}: the mobile menu closed when the page opened`);
    check(g.focusOnLogin, `${where}: focus starts on 로그인하고 확인하기`);
  }
  if (item.loginFlow) {
    const l = item.loginFlow;
    check(l.ok && l.phase === 'login' && l.reopen && l.analysis === 0, `${where}: login request ${JSON.stringify(l)}`);
    check(l.statusText?.ratio >= 4.5, `${where}: login status text ${JSON.stringify(l.statusText)} below 4.5:1`);
  }
  if (item.keyboard) {
    check(item.keyboard.focusVisible, `${where}: Tab focus on 대화로 돌아가기 is not :focus-visible`);
    check(item.keyboard.ring.ratio >= 3, `${where}: Tab focus ring ${JSON.stringify(item.keyboard.ring)} below 3:1`);
  }
  const {layout} = item;
  check(layout.pageOverflow <= 0, `${where}: page scrolls sideways by ${layout.pageOverflow}px`);
  check(layout.workspaceOverflow <= 0, `${where}: the page's workspace scrolls sideways by ${layout.workspaceOverflow}px`);
  check(layout.gateOverflow <= 0, `${where}: the gate card scrolls sideways by ${layout.gateOverflow}px`);
  check(layout.gate.left >= -0.5 && layout.gate.right <= layout.viewport.width + 0.5, `${where}: gate card outside the viewport ${JSON.stringify(layout.gate)}`);
  for (const button of layout.buttons) {
    check(button.height >= 44, `${where}: ${button.key} is ${button.height}px tall`);
    check(button.clipped <= 0, `${where}: ${button.key} label clipped by ${button.clipped}px`);
    if (button.key === 'back') check(button.left >= -0.5 && button.right <= layout.viewport.width + 0.5, `${where}: header ← outside the viewport`);
    else check(button.left >= layout.gate.left - 0.5 && button.right <= layout.gate.right + 0.5, `${where}: ${button.key} outside the gate card`);
  }
  check(layout.gap >= 8, `${where}: buttons ${layout.gap}px apart`);
}
check(flows.length === FLOW.size, `ways-out / session flows ran ${flows.length}/${FLOW.size}`);
for (const flow of flows) {
  const where = flow.where;
  check(flow.cancel.ok && flow.back.ok && flow.history.ok, `${where}: 대화로 돌아가기 / ← / back ${JSON.stringify([flow.cancel, flow.back, flow.history])}`);
  check(flow.hashWhileOpen === '#scam', `${where}: /#scam while open (${flow.hashWhileOpen})`);
  for (const key of ['backGate', 'historyGate', 'loginGate', 'reloadGate']) {
    check(flow[key].ms < 2500, `${where}: ${key} — the page's own session owner answered (${flow[key].ms}ms, the fallback is 3 s)`);
    check(!flow[key].form && flow[key].counts.analysis === 0 && flow[key].coreCalls === 0, `${where}: ${key} — no form, nothing sent ${JSON.stringify(flow[key])}`);
  }
  check(flow.timeout.ok && flow.timeout.ms >= 2500 && !flow.timeout.form, `${where}: unanswered session → gate after the 3 s fallback ${JSON.stringify(flow.timeout)}`);
  check(flow.reopen.ok && flow.reopen.hash === '#scam' && flow.reopen.reopenKey === null && flow.reopen.opens === 1, `${where}: session after login reopens the page on the input form once ${JSON.stringify(flow.reopen)}`);
  check(flow.reopen.counts.analysis === 0 && flow.reopen.coreCalls === 0, `${where}: the reopen sends nothing for analysis`);
  check(flow.inPlace.ok && flow.inPlace.workspaces === 1 && flow.inPlace.counts.analysis === 0 && flow.inPlace.coreCalls === 0, `${where}: a session arriving on the gate opens the form in place ${JSON.stringify(flow.inPlace)}`);
  check(flow.noSecondReopen.ok, `${where}: a second session announcement does not reopen the page ${JSON.stringify(flow.noSecondReopen)}`);
  check(flow.restored.ok && flow.restored.hash === '#scam', `${where}: /#scam reload signed in opens the input form ${JSON.stringify(flow.restored)}`);
  check(flow.afterAnnouncement.ok && flow.afterAnnouncement.workspaces === 1 && flow.afterAnnouncement.reopenKey === null, `${where}: the session announcement after the reload keeps one input page ${JSON.stringify(flow.afterAnnouncement)}`);
  check(flow.restored.counts.analysis === 0 && flow.restored.coreCalls === 0, `${where}: the reload sends nothing for analysis`);
}
const seconds = Math.round((Date.now() - started) / 1000);
if (failures.length) {
  console.error(`SCAM-SHIELD-LOGIN-GATE-CONTRAST-01 FAIL — ${failures.length} problems:`);
  for (const failure of failures.slice(0, 60)) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`SCAM-SHIELD-LOGIN-GATE-CONTRAST-01 PASS — ${measurements.length} renders (360/375/390/412/1280 × light/dark/system±dark + live system switch), every text ≥4.5:1 incl. hover/pressed/focus/disabled/status, filled edge and focus rings ≥3:1, checking → login gate (no form, nothing sent), 대화로 돌아가기·←·back·로그인·3 s fallback·after-login reopen flows ${flows.length}, ${seconds}s; viewport emulation, not a device run`);
