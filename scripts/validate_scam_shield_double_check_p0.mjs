// SCAM-SHIELD-DOUBLE-CHECK-P0 (SCAM-PHISHING-REDESIGN-02) — 사기·피싱 확인 shows
// Core's second, independent check on the workspace page (route #scam).
//
// Core answers with `summary`, `double_check`, `official_sources` and
// `police_statistics`. Real Chrome opens the real page through the real form;
// each analysis is answered with a Core-shaped JSON body that goes through the
// real site-core.js analyzeScamShield() normalization, then site-scam-shield.js.
//
// Checks: the verdict (결론) comes first and the 발견된 위험 신호 section (what the
// 2단계 확인 re-confirmed; first-pass-only rows left out) is the first section
// and the only one open; 공식 근거 · 아직 확인되지 않은 내용 · 추가 확인 방법 render;
// only https URLs whose exact host is in SCAM_OFFICIAL_LINK_HOSTS become links
// (forged, lookalike, unlisted .go.kr, http, port and userinfo sources stay
// plain text; stale ones are labelled); the checked address — even on an
// allowlisted host — is never a link anywhere on the page; police statistics
// are a folded, last, reference-only section and are dropped when Core does
// not mark them background-only; an older Core answer without these fields
// still renders; a failed second check says so; 확인된 위험 신호 없음 always
// carries the no-guarantee sentence and no bare 위험 신호 없음 appears; WCAG AA
// (4.5:1) for the verdict, section and source text in light, dark and
// system+dark; no sideways overflow at 390px. Static: the exact-host allowlist
// export and scamOfficialUrl (https only, no userinfo/port, exact host) replace
// the old .go.kr/.or.kr regex. Viewport emulation only, not a device run.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {SCAM_OFFICIAL_LINK_HOSTS, scamOfficialUrl, analyzeScamShield} from '../site-core.js';
import {ROOT, browserPath, makeWorkDir, removeDir, startServer, openPage, BASE_MOCK, freshInput, CONTRAST_FN, THEMES, waitTheme, waitFor, sleep} from './scam_shield_page_harness.mjs';

const SHOTS = process.env.SCAM_DOUBLE_CHECK_SHOTS || '';
const ui = fs.readFileSync(path.join(ROOT, 'site-scam-shield.js'), 'utf8');
const core = fs.readFileSync(path.join(ROOT, 'site-core.js'), 'utf8');
const SAFETY = '다만 안전하다는 보증은 아니에요.';
const SAFETY_SENTENCE = `확인한 범위에서 위험 신호는 찾지 못했어요. ${SAFETY}`;

// ---------- static: copy and the official-link allowlist ----------
// Copy that must not claim more than the check did.
assert.doesNotMatch(ui, /안전합니다|안전해요|사기 아님|진짜 기관입니다/u);
assert.match(ui, /2단계 확인/u);
assert.match(ui, /공식 근거/u);
assert.match(ui, /'확인된 위험 신호 없음'/u);
assert.doesNotMatch(ui, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/u, 'every node is built with textContent');
assert.match(ui, /import \{scamOfficialUrl\} from '\.\/site-core\.js/u, 'the page links only through scamOfficialUrl');
assert.match(core, /value\.affects_risk_level !== false/u, 'statistics render only when Core marks them background-only');
// The old suffix regex (any *.go.kr / *.or.kr) is gone; an exact-host list replaced it.
assert.doesNotMatch(core, /SCAM_OFFICIAL_LINK_HOST\s*=\s*\//u, 'old .go.kr/.or.kr regex removed');
assert.match(core, /export const SCAM_OFFICIAL_LINK_HOSTS = Object\.freeze\(\[/u);
assert.match(core, /export function scamOfficialUrl\(value\)/u);
assert.ok(Array.isArray(SCAM_OFFICIAL_LINK_HOSTS) && Object.isFrozen(SCAM_OFFICIAL_LINK_HOSTS) && SCAM_OFFICIAL_LINK_HOSTS.length > 0, 'allowlist is a frozen array');
assert.equal(new Set(SCAM_OFFICIAL_LINK_HOSTS).size, SCAM_OFFICIAL_LINK_HOSTS.length, 'allowlist has no duplicates');
for (const host of SCAM_OFFICIAL_LINK_HOSTS) {
  assert.match(host, /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/u, `${host}: a bare lowercase host (no scheme, port, path or wildcard)`);
  assert.match(host, /\.(?:go|or)\.kr$|(?:^|\.)gov\.kr$/u, `${host}: a Korean public-sector host`);
  assert.equal(scamOfficialUrl(`https://${host}/`), `https://${host}/`, `${host}: allowed`);
}
// The page's own channel buttons are on the list (else they would silently vanish).
const contactUrls = [...ui.matchAll(/url: '(https:\/\/[^']+)'/gu)].map(match => match[1]);
assert.ok(contactUrls.length >= 3, `channel URLs found in site-scam-shield.js (${contactUrls})`);
for (const url of contactUrls) assert.equal(scamOfficialUrl(url), new URL(url).href, `${url}: channel host on the allowlist`);
const URL_CASES = [
  ['https://www.spo.go.kr', 'https://www.spo.go.kr/'],
  ['https://WWW.FSC.GO.KR/x', 'https://www.fsc.go.kr/x'],
  ['http://www.fsc.go.kr/x', ''],
  ['https://fss-or-kr.example/notice', ''],
  ['https://fake-gov.go.kr.example/notice', ''],
  ['https://www.unlisted.go.kr/page', ''],
  ['https://go.kr/', ''],
  ['https://sub.www.fsc.go.kr/x', ''],
  ['https://www.fsc.go.kr./x', ''],
  ['https://www.fsc.go.kr:8443/x', ''],
  ['https://user:pw@www.fsc.go.kr/x', ''],
  ['https://user@www.fsc.go.kr/x', ''],
  ['https://www.fsc.go.kr@evil.example/x', ''],
  ['javascript:alert(1)', ''],
  ['data:text/html,x', ''],
  ['//www.fsc.go.kr/x', ''],
  ['www.fsc.go.kr', ''],
  ['', ''],
  [null, ''],
  [42, ''],
];
for (const [input, expected] of URL_CASES) assert.equal(scamOfficialUrl(input), expected, `scamOfficialUrl(${JSON.stringify(input)})`);

// ---------- Core-shaped answers ----------
const BASE = {
  contract_id: 'LOTBI-SAFECARE-REAL-USER-01',
  case_id: 'scam_0123456789abcdef0123',
  status: 'ANALYZED',
  headline: '이건 열지 마세요.',
  reasons: ['‘안전계좌’ 같은 계좌로 돈을 옮기라고 합니다.'],
  confirmed_facts: ['메시지가 검찰청을(를) 언급합니다.'],
  unverified_items: ['기관을 언급하지만 비교할 주소·번호가 없어 공식 여부를 확인하지 못했어요.'],
  next_safe_action: ['송금·상품권 구매·현금 전달을 멈추세요.'],
  do_now: ['송금·상품권 구매·현금 전달을 멈추세요.', '이미 돈을 보냈다면 바로 112나 돈을 보낸 금융회사 콜센터에 지급정지를 요청하세요.'],
  do_not: ['링크를 누르지 마세요.'],
  evidence: [],
  untrusted_file_execution: false,
  untrusted_javascript_execution: false,
  public_file_upload_to_third_party: false,
  checked_at: '2026-10-10T04:00:00+00:00',
};
const SOS = {source_id: 'SOS_PUBLIC_NO_TRANSFER', kind: 'OFFICIAL_GUIDANCE', agency: '전기통신금융사기 통합대응단(경찰청)', title: '피싱안심SOS 보이스피싱 제보 방법 안내', url: 'https://www.counterscam112.go.kr/board/CONTENT_000000000010.do', checked_at: '2026-10-10', stale: false, statement: '공공기관·금융기관은 어떤 경우에도 개인정보나 송금을 요구하지 않는다고 안내해요.'};
const forged = (sourceId, title, url, extra = {}) => ({source_id: sourceId, kind: 'OFFICIAL_GUIDANCE', agency: '금융감독원', title: `${title}(링크가 되면 안 됨)`, url, checked_at: '2026-10-10', stale: false, statement: '검증용', ...extra});
const FULL = {
  ...BASE,
  risk_level: 'HIGH_RISK',
  summary: '이 내용에는 기관 사칭과 안전계좌 이체 요구 정황이 있어요. 확인되지 않은 계좌로 돈을 보내지 마세요.',
  double_check: {
    status: 'COMPLETED',
    agreement: 'ESCALATED',
    signals: [
      {code: 'INSTITUTION_IMPERSONATION', label: '기관 사칭', severity: 'HIGH', confirmed_by: 'SECOND_ONLY'},
      {code: 'SAFE_ACCOUNT', label: '안전계좌 이체 요구', severity: 'HIGH', confirmed_by: 'SECOND_ONLY'},
      {code: 'FIRST_PASS_MONEY', label: '송금·결제 요구', severity: 'INFO', confirmed_by: 'FIRST_ONLY'},
    ],
    scam_types: [{code: 'INSTITUTION_IMPERSONATION', label: '기관사칭형', basis: 'INFERRED'}],
    official_check: {state: 'NOT_VERIFIABLE', message: '공식 기관인지 확인할 수 있는 근거가 없어요.'},
    individual_lookup: {state: 'NOT_VERIFIABLE', message: '조회하지 않았어요.', performed_by_lotbi: false, self_check: [
      {source_id: 'POLICE_CYBER_FRAUD_LOOKUP', kind: 'SELF_LOOKUP', agency: '경찰청', title: '사이버사기 피해신고 이력조회', url: 'https://www.police.go.kr/www/security/cyber/cyber04.jsp', checked_at: '2026-10-10', stale: false, statement: '조회 결과가 없어도 안전하다는 뜻은 아니에요.'},
      {source_id: 'FORGED_LOOKUP', kind: 'SELF_LOOKUP', agency: '경찰청', title: '가짜 조회 페이지(링크가 되면 안 됨)', url: 'https://www.police.go.kr.lookup-check.example/cyber', checked_at: '2026-10-10', stale: false, statement: '검증용'},
    ]},
    report_paths: [
      {source_id: 'PAYMENT_STOP_112', kind: 'REPORT_PATH', agency: '금융위원회', title: '피해 시 지급정지 요청 안내', url: 'https://www.fsc.go.kr/no010101/87882', checked_at: '2026-10-10', stale: false, statement: '이미 돈을 보냈다면 바로 112나 금융회사 콜센터에 지급정지를 요청하세요.'},
    ],
    contradictions: [{code: 'FIRST_PASS_UNDERRATED', message: '1차 분석보다 위험 신호가 더 확인되어 판단을 높였어요.'}],
    unverified: ['기관을 언급하지만 비교할 주소·번호가 없어 공식 여부를 확인하지 못했어요.'],
  },
  // normalizeScamSources keeps at most 8; these are exactly 8.
  official_sources: [
    {source_id: 'REGISTRY:검찰청', kind: 'OFFICIAL_ADDRESS_REGISTRY', agency: '검찰청', title: '검찰청 공식 주소·대표번호(검토된 목록)', url: 'https://www.spo.go.kr', checked_at: '2026-10-04', stale: false, statement: '공식 주소: spo.go.kr', relevance: '메시지가 언급한 기관의 공식 주소예요. 이 기관이 이 메시지를 확인했다는 뜻은 아니에요.'},
    SOS,
    forged('FORGED', '위조된 출처', 'https://fss-or-kr.example/notice'),
    forged('PLAIN_HTTP', 'http 출처', 'http://www.fsc.go.kr/x', {agency: '금융위원회', checked_at: '2024-01-01', stale: true}),
    forged('LOOKALIKE', '닮은 주소', 'https://fake-gov.go.kr.example/notice'),
    forged('UNLISTED_GO_KR', '목록 밖 .go.kr', 'https://www.unlisted.go.kr/page'),
    forged('PORT', '포트 붙은 주소', 'https://www.fsc.go.kr:8443/notice'),
    forged('USERINFO', '계정 붙은 주소', 'https://user:pw@www.fsc.go.kr/notice'),
  ],
  police_statistics: {
    dataset_id: '15063815', title: '경찰청_보이스피싱 현황', agency: '경찰청', source_url: 'https://www.data.go.kr/data/15063815/fileData.do',
    data_version: '15063815@2026-01-21', category: '기관사칭형', base_year: 2025,
    figures: {cases: 13323, damage_100m_krw: 9884, arrested: 15161}, unit_note: '', use: 'BACKGROUND_ONLY', affects_risk_level: false,
    note: '경찰청이 공개한 2025년 전국 기관사칭형 보이스피싱 통계예요. 이 메시지를 경찰청이 확인했다는 뜻이 아니고, 이 통계로 위험도를 정하지 않았어요.', freshness: 'RECENT',
  },
};
const OLD = {...BASE, risk_level: 'SUSPICIOUS', headline: '조심하세요.'};
const FAILED = {
  ...BASE,
  risk_level: 'UNVERIFIED',
  headline: '지금 정보만으로는 진짜라고 확인할 수 없어요.',
  status: 'PARTIAL',
  summary: '보낸 곳이 진짜인지 확인할 수 없어요. 공식 연락처를 직접 찾아 확인하세요.',
  double_check: {status: 'FAILED', agreement: 'FAILED', signals: [], official_check: {state: 'NOT_VERIFIABLE', message: '2단계 확인을 끝내지 못해 공식 근거를 대조하지 못했어요.'}, individual_lookup: {state: 'NOT_VERIFIABLE', self_check: []}, report_paths: [], contradictions: [], unverified: ['2단계 확인을 끝내지 못했어요.']},
  official_sources: [],
  police_statistics: null,
};
const STATS_NOT_BACKGROUND = {...FULL, police_statistics: {...FULL.police_statistics, affects_risk_level: true}};
// 확인된 위험 신호 없음 from a Core summary without the no-guarantee sentence:
// the page adds it. The statistics' source is not on the list → plain text.
const NO_SIGNAL = {
  ...BASE,
  risk_level: 'CURRENTLY_NO_RISK_SIGNAL',
  headline: '확인한 범위에서는 이상한 점을 찾지 못했어요.',
  summary: '이 주소에서 송금 요구나 개인정보 입력 유도는 찾지 못했어요.',
  reasons: ['주소가 금융위원회 공식 주소 목록과 같아요.'],
  unverified_items: [],
  do_now: ['지금 당장 급하게 처리하실 일은 없어 보여요.', '중요한 행동 전에는 기관 공식 경로에서 한 번 더 확인하세요.'],
  double_check: {status: 'COMPLETED', agreement: 'AGREED', signals: [], scam_types: [], official_check: {state: 'MATCHED', message: '주소가 공식 주소 목록과 같아요. 메시지 내용까지 기관이 보냈다는 뜻은 아니에요.'}, individual_lookup: {state: 'NOT_VERIFIABLE', self_check: []}, report_paths: [], contradictions: [], unverified: []},
  official_sources: [
    {source_id: 'REGISTRY:금융위원회', kind: 'OFFICIAL_ADDRESS_REGISTRY', agency: '금융위원회', title: '금융위원회 공식 주소(검토된 목록)', url: 'https://www.fsc.go.kr', checked_at: '2026-10-04', stale: false, statement: '공식 주소: fsc.go.kr'},
    forged('LOOKALIKE', '닮은 주소', 'https://fsc.go.kr.example/'),
  ],
  police_statistics: {...FULL.police_statistics, source_url: 'https://data-go-kr.example/15063815'},
};
const OLD_NO_SIGNAL = {...BASE, risk_level: 'CURRENTLY_NO_RISK_SIGNAL', headline: '확인한 범위에서는 이상한 점을 찾지 못했어요.'};
const PAYLOADS = {FULL, OLD, FAILED, STATS_NOT_BACKGROUND, NO_SIGNAL, OLD_NO_SIGNAL};

// The checked text carries an address; two cases check an address directly —
// a lookalike one and one on an allowlisted host. None may become a link.
const CHECKED_TEXT = '[검찰청] 귀하 명의 사건 조회: https://spo-go-kr.case-check.example/v 안전계좌로 이체 바랍니다';
const LOOKALIKE_CHECKED = 'https://www.spo.go.kr.case-check.example/verify?case=2026-10';
const OFFICIAL_CHECKED = 'https://www.fsc.go.kr/no010101/87882?ref=sms';
const CASES = [
  {name: 'FULL', payload: 'FULL', text: CHECKED_TEXT},
  {name: 'OLD', payload: 'OLD', text: CHECKED_TEXT},
  {name: 'FAILED', payload: 'FAILED', text: CHECKED_TEXT},
  {name: 'STATS_NOT_BACKGROUND', payload: 'STATS_NOT_BACKGROUND', url: LOOKALIKE_CHECKED},
  {name: 'NO_SIGNAL', payload: 'NO_SIGNAL', url: OFFICIAL_CHECKED},
  {name: 'OLD_NO_SIGNAL', payload: 'OLD_NO_SIGNAL', text: '내일 오후 3시에 택배가 도착합니다.'},
];
// Any URL attribute on the page (the site's own mailto: is not userinfo).
const FORBIDDEN_HREF = /example|unlisted\.go\.kr|:8443\/|^https?:\/\/[^/?#]*@|^http:\/\/www\.fsc|ref=sms/u;

// ---------- the same normalization in Node (site-core.js, no browser) ----------
const respond = body => async () => new Response(JSON.stringify(body), {status: 200, headers: {'Content-Type': 'application/json'}});
const normalized = {};
for (const [name, body] of Object.entries(PAYLOADS)) normalized[name] = await analyzeScamShield('validator-session', new FormData(), respond(body));
assert.deepEqual(normalized.FULL.officialSources.map(item => item.url), ['https://www.spo.go.kr/', SOS.url, '', '', '', '', '', ''], 'only allowlisted https sources keep a URL');
assert.deepEqual(normalized.FULL.doubleCheck.selfChecks.map(item => item.url), ['https://www.police.go.kr/www/security/cyber/cyber04.jsp', '']);
assert.equal(normalized.FULL.policeStatistics.sourceUrl, 'https://www.data.go.kr/data/15063815/fileData.do');
assert.equal(normalized.NO_SIGNAL.policeStatistics.sourceUrl, '', 'unlisted statistics source keeps no URL');
assert.equal(normalized.STATS_NOT_BACKGROUND.policeStatistics, null, 'statistics that could move the risk are dropped');
assert.equal(normalized.OLD.doubleCheck, null);
assert.equal(normalized.OLD.summary, '');
assert.equal(normalized.FAILED.doubleCheck.status, 'FAILED');
console.log('SCAM-SHIELD-DOUBLE-CHECK-P0 static PASS — allowlist export, scamOfficialUrl cases, site-core normalization');

// Account/Core answered offline; the page's session question answered
// "signed in"; each analysis goes through the real site-core normalization.
const MOCK = `(() => {${BASE_MOCK}
  window.__scamPayloads = ${JSON.stringify(PAYLOADS)};
  window.addEventListener('lotbi:scam-shield-session-request', event => { event.detail?.resolve?.(true); });
  window.addEventListener('lotbi:scam-shield-request', event => {
    event.stopImmediatePropagation();
    const form = event.detail.formData;
    window.__sent = Object.fromEntries([...form.entries()].map(([key, value]) => [key, typeof value === 'string' ? value : value.name]));
    const body = window.__scamPayloads[window.__scamPayload || 'FULL'];
    import('/site-core.js?double-check-validator').then(({analyzeScamShield}) =>
      analyzeScamShield('validator-session', form, async () => json(body)),
    ).then(event.detail.resolve, event.detail.reject);
  });
})();`;

const VIEWPORTS = [
  {label: 'iPhone-390x844', width: 390, height: 844, mobile: true},
  {label: 'desktop-1280x900', width: 1280, height: 900, mobile: false},
];

const SECTION_STATE = `(() => [...document.querySelectorAll('[data-scam-result] [data-scam-section]')].map(node => ({
  id: node.dataset.scamSection,
  open: node.querySelector('.sp-sec-h').getAttribute('aria-expanded') === 'true',
  bodyHidden: node.querySelector('.sp-sec-b').hidden,
  bodyText: node.querySelector('.sp-sec-b').textContent,
})))()`;

const INSPECT = `(() => {
  const ratio = ${CONTRAST_FN};
  const ws = document.querySelector('.consumer-workspace[data-workspace="scam"]');
  const result = ws.querySelector('[data-scam-result]');
  const verdict = result.querySelector('[data-scam-verdict]');
  const q = (selector, scope = result) => scope.querySelector(selector);
  const text = node => (node ? node.textContent : '');
  const sec = id => result.querySelector('[data-scam-section="' + id + '"]');
  const kind = node => node.dataset.scamVerdict !== undefined ? 'verdict' : node.dataset.scamContacts !== undefined ? 'contacts' : node.dataset.scamSections !== undefined ? 'sections' : node.dataset.scamDoNot !== undefined ? 'donot' : node.dataset.scamReferenceNote !== undefined ? 'refnote' : node.dataset.scamIncidentCard !== undefined ? 'incident' : node.classList.contains('sp-rbar') ? 'bar' : node.classList.contains('sp-endacts') ? 'end' : node.className;
  const sources = id => [...(sec(id)?.querySelectorAll('.sp-src') || [])].map(src => ({name: text(src.querySelector('b')), meta: text(src.querySelector('.sp-src-m')), links: [...src.querySelectorAll('a[href]')].map(a => a.href)}));
  const kv = id => Object.fromEntries([...(sec(id)?.querySelectorAll('.sp-kv dt') || [])].map(dt => [dt.textContent, dt.nextElementSibling?.textContent || '']));
  const ddOf = (id, term) => [...(sec(id)?.querySelectorAll('.sp-kv dt') || [])].find(dt => dt.textContent === term)?.nextElementSibling || null;
  const statsNotes = [...(sec('stats')?.querySelectorAll('.sp-note span') || [])];
  const attrs = ['href', 'src', 'action', 'formaction', 'ping'];
  return {
    phase: ws.querySelector('.scam-page')?.dataset.scamPhase || '',
    dialogGone: !document.querySelector('dialog.scam-dialog, [data-scam-dialog]'),
    hash: location.hash,
    level: result.dataset.riskLevel,
    levelLabel: text(q('[data-scam-level]', verdict)),
    headline: text(q('.sp-vh', verdict)),
    summary: q('[data-scam-summary]', verdict) ? text(q('[data-scam-summary]', verdict)) : null,
    failedMessage: q('[data-scam-double-check-failed]') ? text(q('[data-scam-double-check-failed]')) : null,
    verdictText: text(verdict),
    doNow: [...verdict.querySelectorAll('[data-scam-do-now] li')].map(text),
    order: [...result.children].map(kind),
    sections: [...result.querySelectorAll('[data-scam-section]')].map(node => ({id: node.dataset.scamSection, title: text(node.querySelector('.sp-sec-t > span')), sub: text(node.querySelector('.sp-sec-t small')), count: text(node.querySelector('.sp-cnt')), open: node.querySelector('.sp-sec-h').getAttribute('aria-expanded') === 'true', text: text(node.querySelector('.sp-sec-b'))})),
    sigChips: [...(sec('sig')?.querySelectorAll('.sp-sigc') || [])].map(text),
    offSources: sources('off'),
    selfSources: sources('self'),
    tech: kv('tech'),
    info: kv('info'),
    contactsTitle: text(q('[data-scam-contacts] h3')),
    statsLinks: [...(sec('stats')?.querySelectorAll('a[href]') || [])].map(a => a.href),
    wsLinks: [...ws.querySelectorAll('a[href]')].map(a => ({href: a.href, text: a.textContent, target: a.target, rel: a.rel})),
    pageUrls: [...document.querySelectorAll(attrs.map(name => '[' + name + ']').join(','))].flatMap(node => attrs.filter(name => node.hasAttribute(name)).map(name => node.getAttribute(name))),
    resultText: text(result),
    overflow: ws.scrollWidth - ws.clientWidth,
    resultOverflow: result.scrollWidth - result.clientWidth,
    contrast: {
      level: ratio(q('[data-scam-level] span', verdict)),
      headline: ratio(q('.sp-vh', verdict)),
      summary: ratio(q('[data-scam-summary]', verdict)),
      failedMessage: ratio(q('[data-scam-double-check-failed] span')),
      sectionTitle: ratio(q('[data-scam-section="sig"] .sp-sec-t > span')),
      sectionSub: ratio(q('[data-scam-section="sig"] .sp-sec-t small')),
      count: ratio(q('[data-scam-section="sig"] .sp-cnt')),
      signal: ratio(q('[data-scam-section="sig"] .sp-sigc span')),
      signalLead: ratio(q('[data-scam-section="sig"] .sp-lead2')),
      reason: ratio(q('[data-scam-section="sig"] .sp-bul li')),
      officialLead: ratio(q('[data-scam-section="off"] .sp-lead2')),
      sourceName: ratio(q('[data-scam-section="off"] .sp-src b')),
      sourceStatement: ratio(q('[data-scam-section="off"] .sp-src p:not(.sp-src-rel)')),
      sourceRelevance: ratio(q('[data-scam-section="off"] .sp-src-rel')),
      sourceMeta: ratio(q('[data-scam-section="off"] .sp-src-m > span')),
      sourceLink: ratio(q('[data-scam-section="off"] .sp-src-m a')),
      unverified: ratio(q('[data-scam-section="unv"] .sp-bul li')),
      techTerm: ratio(q('[data-scam-section="tech"] .sp-kv dt')),
      techValue: ratio(q('[data-scam-section="tech"] .sp-kv dd')),
      techMono: ratio(q('[data-scam-section="tech"] .sp-mono div')),
      checkedUrl: ratio(ddOf('info', '검사한 주소')),
      infoNote: ratio(q('[data-scam-section="info"] .sp-note span')),
      selfLink: ratio(q('[data-scam-section="self"] .sp-src-m a')),
      statsLine: ratio(q('[data-scam-section="stats"] .sp-lead2')),
      statsNote: ratio(statsNotes[0] || null),
      statsSource: ratio(q('[data-scam-section="stats"] .sp-srclink') || statsNotes[1] || null),
      referenceNote: ratio(q('[data-scam-reference-note] span')),
    },
  };
})()`;

async function openSection(p, id) {
  const state = await p.evaluate(SECTION_STATE);
  if (state.find(item => item.id === id)?.open) return;
  await p.tap(`[data-scam-section="${id}"] .sp-sec-h`);
  await waitFor(() => p.evaluate(`document.querySelector('[data-scam-section="${id}"] .sp-sec-h')?.getAttribute('aria-expanded') === 'true'`), `${id} section open`);
}

const browser = browserPath();
const workDir = makeWorkDir('scam-double-check');
const srv = startServer();
const records = [];
try {
  const origin = await srv.origin;
  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      const p = await openPage({browser, origin, workDir, viewport, theme, mock: MOCK});
      try {
        await waitTheme(p.evaluate, theme.dark, theme.label);
        for (const testCase of CASES) {
          await p.evaluate(`window.__scamPayload = ${JSON.stringify(testCase.payload)}; window.__sent = null; true`);
          await freshInput(p);
          if (testCase.url) {
            await p.tap('[data-scam-tab="url"]');
            await waitFor(() => p.evaluate("Boolean(document.querySelector('#scam-url'))"), 'url field');
            await p.evaluate(`(() => { const u = document.querySelector('#scam-url'); u.value = ${JSON.stringify(testCase.url)}; u.dispatchEvent(new Event('input', {bubbles: true})); return true; })()`);
          } else {
            await p.evaluate(`(() => { const t = document.querySelector('#scam-text'); t.value = ${JSON.stringify(testCase.text)}; t.dispatchEvent(new Event('input', {bubbles: true})); return true; })()`);
          }
          await waitFor(() => p.evaluate("document.querySelector('[data-scam-submit]')?.disabled === false"), `${testCase.name} submit enabled`);
          await p.tap('[data-scam-submit]');
          const level = PAYLOADS[testCase.payload].risk_level;
          await waitFor(() => p.evaluate(`document.querySelector('.consumer-workspace[data-workspace="scam"] [data-scam-result]')?.dataset.riskLevel === ${JSON.stringify(level)}`), `${testCase.name} result`);
          await sleep(60);
          // As rendered: which sections start open (the statistics fold away).
          const initial = await p.evaluate(SECTION_STATE);
          for (const section of initial) await openSection(p, section.id);
          await sleep(60);
          const inspected = await p.evaluate(INSPECT);
          const sent = await p.evaluate('window.__sent');
          records.push({viewport: viewport.label, mobile: viewport.mobile, theme: theme.label, testCase, initial, sent, ...inspected});
          if (SHOTS) {
            await p.evaluate("document.querySelector('.consumer-workspace').scrollTo(0, 0), true");
            await p.screenshot(path.join(SHOTS, `${viewport.label}-${theme.label}-${testCase.name}.png`));
          }
        }
      } finally { await p.close(); }
      console.log(`  rendered ${viewport.label} ${theme.label} (${CASES.length} answers)`);
    }
  }
} finally {
  srv.stop();
  await removeDir(workDir);
}

const fmt = value => (value ? value.ratio : '-');
const ids = list => list.map(item => item.id);
const LABEL = {HIGH_RISK: '위험 높음', SUSPICIOUS: '주의 필요', UNVERIFIED: '확인 안 됨', CURRENTLY_NO_RISK_SIGNAL: '확인된 위험 신호 없음'};
for (const item of records) {
  const {payload, name} = item.testCase;
  const body = PAYLOADS[payload];
  const where = `${item.viewport} ${item.theme} ${name}`;
  const section = id => item.sections.find(entry => entry.id === id);
  console.log(`  ${where.padEnd(48)} level=${item.levelLabel} sections=${ids(item.sections).join(',')} links=${item.wsLinks.length} overflow=${item.overflow}/${item.resultOverflow} contrast=${Object.entries(item.contrast).filter(([, value]) => value).map(([key, value]) => `${key}:${fmt(value)}`).join(' ')}`);

  // The page itself: a workspace route, no dialog, no sideways scroll.
  assert.equal(item.phase, 'result', `${where}: result phase`);
  assert.ok(item.dialogGone, `${where}: no <dialog> popup`);
  assert.equal(item.hash, '#scam', `${where}: route #scam`);
  assert.ok(item.overflow <= 1 && item.resultOverflow <= 1, `${where}: no sideways overflow (${item.overflow}/${item.resultOverflow})`);
  // What was sent is what was typed (text or the checked address).
  if (item.testCase.url) assert.deepEqual(item.sent, {url: item.testCase.url}, `${where}: url sent`);
  else assert.deepEqual(item.sent, {text: item.testCase.text}, `${where}: text sent`);

  // 결론 first; the 2단계 result (발견된 위험 신호) is the first section and the only one open.
  assert.equal(item.order[0], 'bar', `${where}: 확인 결과 bar first (${item.order})`);
  assert.equal(item.order[1], 'verdict', `${where}: verdict right below the bar (${item.order})`);
  assert.ok(item.order.indexOf('verdict') < item.order.indexOf('sections'), `${where}: verdict before the sections`);
  assert.equal(item.initial[0]?.id, 'sig', `${where}: 발견된 위험 신호 is the first section`);
  assert.deepEqual(item.initial.filter(entry => entry.open).map(entry => entry.id), ['sig'], `${where}: only 발견된 위험 신호 starts open`);
  for (const entry of item.initial.filter(state => !state.open)) assert.ok(entry.bodyHidden && entry.bodyText === '', `${where}: ${entry.id} folded`);
  const sig = section('sig');
  assert.equal(sig.title, '발견된 위험 신호');
  const olderAnswer = payload === 'OLD' || payload === 'OLD_NO_SIGNAL';
  assert.equal(sig.sub, olderAnswer ? '분석에서 찾은 근거예요' : '2단계 확인에서 다시 확인한 신호예요', `${where}: signal section subtitle`);
  assert.equal(section('off')?.title, '공식 근거', `${where}: 공식 근거 section`);
  assert.equal(section('unv')?.title, '아직 확인되지 않은 내용', `${where}: 아직 확인되지 않은 내용 section`);
  assert.equal(section('self')?.sub, '번호·계좌를 직접 조회할 수 있는 공식 서비스', `${where}: 추가 확인 방법 section`);
  const expectedIds = ['sig', 'off', 'unv', 'tech', 'info', 'self'];
  const danger = body.risk_level === 'HIGH_RISK';
  if (!danger) expectedIds.push('rep');
  const statsShown = payload === 'FULL' || payload === 'NO_SIGNAL';
  if (statsShown) expectedIds.push('stats');
  assert.deepEqual(ids(item.sections), expectedIds, `${where}: sections in order, statistics last`);
  // 피해가 생겼다면: the purpose-ordered channels (HIGH_RISK) or the 이미 눌렀거나 피해가 생겼다면 section.
  if (danger) assert.equal(item.contactsTitle, '공식 신고·상담 창구', `${where}: report channels card`);
  else assert.equal(section('rep').title, '이미 눌렀거나 피해가 생겼다면', `${where}: 피해가 생겼다면 section`);

  // Labels and the no-guarantee rule.
  assert.equal(item.levelLabel, LABEL[body.risk_level], `${where}: level chip`);
  assert.ok(!/위험 신호 없음/u.test(item.resultText.replace(/확인된 위험 신호 없음/gu, '')), `${where}: never a bare 위험 신호 없음`);
  assert.doesNotMatch(item.resultText, /안전합니다|안전해요|사기 아님|진짜 기관입니다/u, `${where}: no safety claim`);
  if (body.risk_level === 'CURRENTLY_NO_RISK_SIGNAL') assert.ok(item.summary?.includes(SAFETY), `${where}: 확인된 위험 신호 없음 keeps "${SAFETY}" (${item.summary})`);

  // Links: only exact allowlisted https hosts, labelled with the host, new tab, no referrer.
  for (const link of item.wsLinks) {
    if (link.href.startsWith('tel:')) continue;
    if (link.href === 'https://account.lotbiai.com/account') continue;
    const url = new URL(link.href);
    assert.equal(url.protocol, 'https:', `${where}: ${link.href} https`);
    assert.ok(SCAM_OFFICIAL_LINK_HOSTS.includes(url.hostname), `${where}: ${link.href} host on the allowlist`);
    assert.ok(!url.username && !url.password && !url.port, `${where}: ${link.href} no userinfo/port`);
    assert.ok(link.text.includes(url.hostname), `${where}: ${link.href} shows its host`);
    assert.equal(link.target, '_blank', `${where}: ${link.href} target`);
    assert.match(link.rel, /noopener/u, `${where}: ${link.href} rel noopener`);
    assert.match(link.rel, /noreferrer/u, `${where}: ${link.href} rel noreferrer`);
  }
  // Nothing forged and nothing checked becomes a link (or any URL attribute) anywhere on the page.
  for (const value of item.pageUrls) assert.doesNotMatch(value, FORBIDDEN_HREF, `${where}: ${value} must stay text`);
  if (item.testCase.url) {
    const checked = new URL(item.testCase.url).href;
    assert.ok(!item.pageUrls.some(value => { try { return new URL(value, 'http://127.0.0.1/').href === checked; } catch { return false; } }), `${where}: checked address is not a link`);
    assert.equal(item.info['검사한 주소'], item.testCase.url, `${where}: checked address shown as text`);
    assert.ok(section('info').text.includes('검사한 주소는 글자로만 보여 주고 링크로 만들지 않아요.'), `${where}: says the address is not a link`);
  }

  // WCAG AA for every measured text; these must exist where the answer has them.
  const required = ['level', 'headline', 'sectionTitle', 'sectionSub', 'reason', 'techMono', 'referenceNote'];
  if (payload === 'FULL' || payload === 'STATS_NOT_BACKGROUND') required.push('summary', 'count', 'signal', 'officialLead', 'sourceName', 'sourceStatement', 'sourceRelevance', 'sourceMeta', 'sourceLink', 'unverified', 'techTerm', 'techValue', 'selfLink');
  if (statsShown) required.push('statsLine', 'statsNote', 'statsSource');
  if (payload === 'FAILED') required.push('summary', 'failedMessage', 'signalLead', 'officialLead', 'unverified', 'techTerm', 'techValue');
  if (payload === 'OLD') required.push('unverified');
  if (payload === 'NO_SIGNAL' || payload === 'OLD_NO_SIGNAL') required.push('summary');
  if (payload === 'NO_SIGNAL') required.push('signalLead', 'sourceName', 'sourceLink', 'officialLead');
  if (item.testCase.url) required.push('checkedUrl', 'infoNote');
  for (const key of required) assert.ok(item.contrast[key], `${where}: ${key} rendered for the contrast check`);
  for (const [key, value] of Object.entries(item.contrast)) {
    if (value) assert.ok(value.ratio >= 4.5, `${where}: ${key} contrast ${JSON.stringify(value)} below WCAG AA 4.5:1`);
  }

  if (payload === 'FULL' || payload === 'STATS_NOT_BACKGROUND') {
    assert.equal(item.summary, FULL.summary, `${where}: summary sentence`);
    assert.equal(item.headline, '이건 열지 마세요.');
    // Re-confirmed signals only; first-pass-only rows are not listed as re-confirmed.
    assert.deepEqual(item.sigChips, ['기관 사칭', '안전계좌 이체 요구'], `${where}: re-confirmed signals`);
    assert.equal(sig.count, '2', `${where}: signal count`);
    assert.doesNotMatch(sig.text, /송금·결제 요구/u, `${where}: first-pass-only row not shown as re-confirmed`);
    assert.ok(sig.text.includes(BASE.reasons[0]), `${where}: reasons listed`);
    assert.ok(section('off').text.includes('공식 기관인지 확인할 수 있는 근거가 없어요.'), `${where}: official check message`);
    assert.equal(section('off').count, '8', `${where}: all eight sources listed`);
    // Forged, lookalike, unlisted, http, port and userinfo sources: shown as text, never linked.
    const byName = label => item.offSources.find(source => source.name.includes(label));
    for (const label of ['위조된 출처', 'http 출처', '닮은 주소', '목록 밖 .go.kr', '포트 붙은 주소', '계정 붙은 주소']) {
      assert.ok(byName(label), `${where}: ${label} still shown as plain text`);
      assert.deepEqual(byName(label).links, [], `${where}: ${label} never linked`);
    }
    assert.deepEqual(item.offSources.flatMap(source => source.links), ['https://www.spo.go.kr/', SOS.url], `${where}: only the two allowlisted sources are links`);
    assert.ok(byName('http 출처').meta.includes('오래된 자료'), `${where}: stale source labelled`);
    assert.ok(!byName('검찰청 공식').meta.includes('오래된 자료'), `${where}: fresh source not labelled stale`);
    assert.deepEqual(item.selfSources.flatMap(source => source.links), ['https://www.police.go.kr/www/security/cyber/cyber04.jsp'], `${where}: self lookup link; forged lookup stays text`);
    assert.ok(item.selfSources.some(source => source.name.includes('가짜 조회 페이지')), `${where}: forged lookup shown as text`);
    assert.equal(item.tech['2단계 확인'], '완료', `${where}: 2단계 확인 완료`);
    assert.equal(item.tech['의심 유형'], '기관사칭형 — 추정', `${where}: scam type marked as inferred`);
    assert.equal(item.failedMessage, null, `${where}: no failure message`);
  }
  if (statsShown) {
    // Police statistics: reference only — folded, last, outside the verdict, background-only copy.
    const stats = section('stats');
    assert.equal(item.initial.find(entry => entry.id === 'stats').open, false, `${where}: police statistics folded`);
    assert.equal(stats.title, '참고: 경찰청 기관사칭형 보이스피싱 통계', `${where}: statistics title`);
    assert.equal(stats.sub, '위험 판단에는 쓰지 않은 배경 자료예요', `${where}: statistics marked as not used for the verdict`);
    assert.match(stats.text, /2025년 전국 기관사칭형: 발생 13,323건 · 피해액 9,884억원 · 검거 15,161명/u);
    assert.match(stats.text, /경찰청이 확인했다는 뜻이 아니고/u);
    assert.doesNotMatch(item.verdictText, /13,323|보이스피싱 통계|경찰청이 확인/u, `${where}: statistics are not in the verdict`);
    if (payload === 'FULL') assert.deepEqual(item.statsLinks, ['https://www.data.go.kr/data/15063815/fileData.do'], `${where}: statistics source link`);
    else {
      assert.deepEqual(item.statsLinks, [], `${where}: unlisted statistics source never linked`);
      assert.ok(stats.text.includes('출처: 경찰청 경찰청_보이스피싱 현황 (공공데이터포털)'), `${where}: statistics source as text`);
    }
  } else {
    assert.ok(!/13,323|보이스피싱 통계/u.test(item.resultText), `${where}: no police statistics`);
  }
  if (payload === 'OLD' || payload === 'OLD_NO_SIGNAL') {
    // No second check ran: the page never claims one.
    assert.equal(item.sections.find(entry => entry.id === 'sig')?.sub, '분석에서 찾은 근거예요', `${where}: older answer's signals are the first analysis`);
    assert.ok(!sig.text.includes('다시 확인한'), `${where}: older answer claims no re-check (${sig.text})`);
  }
  if (payload === 'OLD') {
    assert.equal(item.summary, null, `${where}: older Core answer has no summary`);
    assert.equal(item.tech['2단계 확인'], undefined, `${where}: older Core answer has no 2단계 확인 row`);
    assert.equal(item.failedMessage, null, `${where}: older answer is not a failed check`);
    assert.deepEqual(item.doNow, BASE.do_now.map((text, index) => `${index + 1}${text}`), `${where}: older answer still renders 지금 하실 일`);
    assert.ok(sig.text.includes(BASE.reasons[0]), `${where}: older answer keeps its reasons`);
    assert.ok(section('unv').text.includes(BASE.unverified_items[0]), `${where}: older answer keeps unverified items`);
    assert.ok(section('off').text.includes('비교할 공식 근거가 없었어요.'), `${where}: no official sources said plainly`);
  }
  if (payload === 'FAILED') {
    assert.equal(item.headline, '지금 정보만으로는 진짜라고 확인할 수 없어요.');
    assert.equal(item.summary, FAILED.summary, `${where}: summary sentence`);
    assert.equal(item.failedMessage, '2단계 확인을 끝내지 못했어요. 확인되지 않은 부분이 있으니 공식 연락처로 직접 확인하세요.', `${where}: failed check said in the verdict`);
    assert.ok(sig.text.includes('2단계 확인을 끝내지 못해 다시 확인한 위험 신호가 없어요.'), `${where}: no re-confirmed signals after a failed check`);
    assert.deepEqual(item.sigChips, [], `${where}: no signal chips`);
    assert.ok(section('off').text.includes('2단계 확인을 끝내지 못해 공식 근거를 대조하지 못했어요.'), `${where}: official check message`);
    assert.equal(item.tech['2단계 확인'], '끝내지 못함', `${where}: 2단계 확인 not finished`);
  }
  if (payload === 'NO_SIGNAL') {
    // Core's own sentence stays, followed by the no-guarantee sentence alone (no repeated "찾지 못했어요").
    assert.equal(item.summary, `${NO_SIGNAL.summary} ${SAFETY}`, `${where}: no-guarantee sentence added once (${item.summary})`);
    assert.deepEqual(item.offSources.flatMap(source => source.links), ['https://www.fsc.go.kr/'], `${where}: registry link only; lookalike stays text`);
    assert.ok(item.offSources.some(source => source.name.includes('닮은 주소')), `${where}: lookalike shown as text`);
  }
  if (payload === 'OLD_NO_SIGNAL') assert.equal(item.summary, SAFETY_SENTENCE, `${where}: older answer gets the no-guarantee sentence`);
}
assert.equal(records.length, VIEWPORTS.length * THEMES.length * CASES.length);
console.log(`SCAM-SHIELD-DOUBLE-CHECK-P0 PASS — ${records.length} renders (${CASES.length} Core answers × light/dark/system-dark × 390/1280), real site-core normalization, exact-host links only, checked address never linked, WCAG AA; viewport emulation, not a device run`);
