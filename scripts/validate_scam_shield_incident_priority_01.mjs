// SCAM-SHIELD-INCIDENT-PRIORITY-01 (SCAM-PHISHING-REDESIGN-02) — the owner's
// confirmed rules for the 사기·피싱 확인 result (2026-10-14):
//  1. an incident (이미 눌렀거나 입력·송금) comes before the analysis, whatever
//     the verdict (위험 높음 · 확인 안 됨 · 확인된 위험 신호 없음);
//  2. 확인된 위험 신호 없음 keeps "다만 안전하다는 보증은 아니에요." at the top;
//  3. official report/consult channels by purpose (송금 피해 · 1394 · 112 · 118 · ECRM);
//  4. official buttons open only pre-approved hosts and show the host; the
//     checked address is never a link;
//  5. 앱 설치 · 원격제어: contact from another device (no tel:/site buttons here);
//  8. on a phone the first screen shows 지금 하실 일 and the 지급정지·신고
//     buttons without scrolling.
// Real Chrome, the real form and site-core.js normalization (the analysis is
// answered here with Core-shaped JSON). Viewport emulation, not a device run.
import assert from 'node:assert/strict';
import path from 'node:path';
import {SCAM_OFFICIAL_LINK_HOSTS} from '../site-core.js';
import {browserPath, makeWorkDir, removeDir, startServer, openPage, BASE_MOCK, freshInput, THEMES, waitTheme, waitFor, sleep} from './scam_shield_page_harness.mjs';

const SHOTS = process.env.SCAM_INCIDENT_SHOTS || '';
const PAY_STOP = '이미 돈을 보냈다면 바로 112나 돈을 보낸 금융회사 콜센터에 지급정지를 요청하세요.';
const CALM = ['지금 당장 급하게 처리하실 일은 없어 보여요.', '오늘이 휴일이면 그대로 두셨다가 평일에 공식 홈페이지나 대표번호로 확인하세요.'];
const base = {
  contract_id: 'LOTBI-SAFECARE-REAL-USER-01', case_id: 'scam_0123456789abcdef0123', status: 'ANALYZED',
  reasons: ['확인되지 않은 링크를 누르게 합니다.'], confirmed_facts: ['문자 안 주소 1개를 찾았어요.'],
  unverified_items: ['주소의 최종 도착지를 안전하게 확인하지 못했습니다.'], next_safe_action: ['주소를 열거나 개인정보를 입력하지 마세요.'],
  evidence: [], untrusted_file_execution: false, untrusted_javascript_execution: false, public_file_upload_to_third_party: false,
  checked_at: '2026-10-15T01:12:00+00:00', do_not: ['링크를 누르지 마세요.', '개인정보·비밀번호·인증번호를 입력하지 마세요.', '송금·결제·앱 설치를 하지 마세요.'],
  official_sources: [
    {source_id: 'SOS_PUBLIC_NO_TRANSFER', kind: 'OFFICIAL_GUIDANCE', agency: '전기통신금융사기 통합대응단(경찰청)', title: '피싱안심SOS 보이스피싱 제보 방법 안내', url: 'https://www.counterscam112.go.kr/board/CONTENT_000000000010.do', statement: '공공기관·금융기관은 어떤 경우에도 개인정보나 송금을 요구하지 않는다고 안내해요.', relevance: '일반 주의 안내입니다. 이 기관이 이 메시지를 확인했다는 뜻은 아니에요.'},
    {source_id: 'FORGED', kind: 'OFFICIAL_GUIDANCE', agency: '가짜 기관', title: '허용 목록 밖 주소', url: 'https://fake-gov.go.kr.example/notice', statement: '링크가 되면 안 되는 출처'},
    {source_id: 'OTHER_GO_KR', kind: 'OFFICIAL_GUIDANCE', agency: '다른 기관', title: '허용 목록 밖 .go.kr', url: 'https://www.unlisted.go.kr/page', statement: '목록에 없는 .go.kr 주소'},
  ],
  police_statistics: null,
};
const dc = (status = 'COMPLETED') => ({status, agreement: status === 'FAILED' ? 'FAILED' : 'AGREED', signals: status === 'FAILED' ? [] : [{code: 'LINK_BAIT', label: '링크 누르기 유도', severity: 'HIGH', confirmed_by: 'BOTH'}],
  scam_types: [], official_check: {state: 'NOT_VERIFIABLE', message: '공식 기관인지 확인할 수 있는 근거가 없어요.'},
  individual_lookup: {state: 'NOT_VERIFIABLE', message: '전화번호·계좌·주소가 신고된 것인지 조회할 수 있는 승인된 공식 조회 서비스가 연결되어 있지 않아 확인하지 않았어요.', performed_by_lotbi: false, self_check: []},
  report_paths: [], contradictions: [], unverified: []});
const PAYLOADS = {
  HIGH_RISK: {...base, risk_level: 'HIGH_RISK', headline: '이건 열지 마세요.', summary: '이 내용에는 기관 사칭과 링크 누르기 유도 정황이 있어요. 링크를 누르거나 답장하지 마세요.',
    do_now: ['주소를 열거나 개인정보를 입력하지 마세요.', '기관 공식 앱이나 공식 홈페이지에서 직접 확인하세요.', '문자 속 번호 말고, 공식 홈페이지나 이미 알고 있는 번호로 직접 확인하세요.', PAY_STOP], double_check: dc()},
  UNVERIFIED: {...base, risk_level: 'UNVERIFIED', status: 'PARTIAL', headline: '지금 정보만으로는 진짜라고 확인할 수 없어요.', summary: '보낸 곳이 진짜인지 확인할 수 없어요. 공식 연락처를 직접 찾아 확인하세요.',
    do_now: [CALM[0], '문자 속 번호 말고, 공식 홈페이지나 이미 알고 있는 번호로 직접 확인하세요.', CALM[1], PAY_STOP], double_check: dc('FAILED')},
  CURRENTLY_NO_RISK_SIGNAL: {...base, risk_level: 'CURRENTLY_NO_RISK_SIGNAL', headline: '확인한 범위에서는 이상한 점을 찾지 못했어요.', summary: '확인한 범위에서 위험 신호는 찾지 못했어요. 다만 안전하다는 보증은 아니에요.',
    do_now: [CALM[0], '중요한 행동 전에는 기관 공식 경로에서 한 번 더 확인하세요.', PAY_STOP], unverified_items: [], double_check: dc()},
  SUSPICIOUS: {...base, risk_level: 'SUSPICIOUS', headline: '조심하세요.', summary: '이 내용에는 숫자로 된 주소와 보호 연결이 아닌 주소 정황이 있어요. 링크를 누르거나 답장하지 마세요.',
    do_now: ['주소를 열거나 개인정보를 입력하지 마세요.'], double_check: dc()},
};
// Core incident_guidance(device, level) order.
const triage = `(level, device) => {
  const list = ['의심 메시지와 파일을 다시 열지 마세요.'];
  if (level >= 2) list.push('입력한 개인정보의 종류를 기록하고 관련 기관에 공식 경로로 알리세요.');
  if (level >= 3) list.push('다른 안전한 기기에서 비밀번호를 바꾸고 계정 세션과 OTP를 점검하세요.');
  if (level >= 6) list.push('은행·카드사에 즉시 연락해 지급정지나 결제 차단 가능 여부를 확인하세요.');
  list.push('내 파일의 다운로드 항목과 최근 설치 앱을 확인하세요.', 'Play Protect 검사를 실행하세요.');
  return {level, device, actions: list};
}`;
const MOCK = `(() => {${BASE_MOCK}
  window.addEventListener('lotbi:scam-shield-session-request', event => { event.detail?.resolve?.(true); });
  window.addEventListener('lotbi:scam-shield-request', event => {
    event.stopImmediatePropagation();
    const payload = JSON.parse(JSON.stringify(window.__payload));
    const form = event.detail.formData;
    window.__sent = Object.fromEntries([...form.entries()].map(([key, value]) => [key, typeof value === 'string' ? value : value.name]));
    const level = Number(form.get('incident_level') || 0);
    if (level > 0) payload.incident_triage = (${triage})(level, String(form.get('device') || '').toUpperCase());
    import('/site-core.js?incident-validator').then(core => core.analyzeScamShield('validator-session', form, async () => json(payload))).then(event.detail.resolve, event.detail.reject);
  });
})();`;

const INSPECT = `(() => {
  const ws = document.querySelector('.consumer-workspace[data-workspace="scam"]');
  const result = ws.querySelector('[data-scam-result]');
  const order = [...result.children].map(node => node.dataset.scamIncidentCard !== undefined ? 'incident' : node.dataset.scamContacts !== undefined ? 'contacts' : node.dataset.scamVerdict !== undefined ? 'verdict' : node.classList.contains('sp-sect-label') ? 'label' : node.dataset.scamDoNot !== undefined ? 'donot' : node.dataset.scamSections !== undefined ? 'sections' : '');
  const contacts = result.querySelector('[data-scam-contacts]');
  const rect = node => { if (!node) return null; const r = node.getBoundingClientRect(); return {top: Math.round(r.top), bottom: Math.round(r.bottom)}; };
  const tiles = contacts ? [...contacts.querySelectorAll('[data-scam-tile]')] : [];
  return {
    order: order.filter(Boolean),
    level: ws.querySelector('[data-scam-level]')?.textContent || '',
    summary: ws.querySelector('[data-scam-summary]')?.textContent || '',
    doNow: [...ws.querySelectorAll('[data-scam-do-now] li')].map(li => li.textContent),
    doNowMore: ws.querySelector('[data-scam-do-now] .sp-more')?.textContent || '',
    incidentActions: [...ws.querySelectorAll('[data-scam-incident-card] li')].map(li => li.textContent),
    firstCall: ws.querySelector('[data-scam-first-call]')?.textContent || '',
    otherDevice: Boolean(ws.querySelector('[data-scam-other-device]')),
    contactRows: contacts ? [...contacts.querySelectorAll('[data-scam-contact]')].map(row => ({key: row.dataset.scamContact, use: row.querySelector('.sp-ctc-use')?.textContent || '', main: row.querySelector('.sp-ctc-main')?.textContent || '', org: row.querySelector('.sp-ctc-org')?.textContent || '', hidden: Boolean(row.closest('[hidden]'))})) : [],
    tiles: tiles.map(tile => ({key: tile.dataset.scamTile, tag: tile.tagName, href: tile.getAttribute('href') || '', text: tile.textContent, rect: rect(tile)})),
    tel: [...ws.querySelectorAll('a[href^="tel:"]')].map(a => a.getAttribute('href')),
    links: [...ws.querySelectorAll('a[href]')].map(a => ({href: a.href, text: a.textContent, target: a.target, rel: a.rel})),
    doNowBox: rect(ws.querySelector('[data-scam-do-now]')),
    incidentList: rect(ws.querySelector('[data-scam-incident-card] ol')),
    innerHeight: window.innerHeight,
    scrollTop: ws.scrollTop,
    overflow: ws.scrollWidth - ws.clientWidth,
    text: result.textContent,
  };
})()`;

const CASES = [
  {name: 'high-incident-2', payload: 'HIGH_RISK', incident: {device: 'Galaxy', stage: 2}},
  {name: 'unverified-money-6', payload: 'UNVERIFIED', incident: {device: 'iPhone', stage: 6}},
  {name: 'no-signal-password-3', payload: 'CURRENTLY_NO_RISK_SIGNAL', incident: {device: 'Windows', stage: 3}},
  {name: 'high-remote-5', payload: 'HIGH_RISK', incident: {device: 'Galaxy', stage: 5}},
  {name: 'high-no-incident', payload: 'HIGH_RISK', incident: null},
  {name: 'suspicious-url', payload: 'SUSPICIOUS', incident: null, url: 'http://203.0.113.24/login'},
];
const VIEWPORTS = [
  {label: 'desktop-1280x900', width: 1280, height: 900, mobile: false, theme: THEMES[0]},
  // Phone heights are what a browser leaves below its own bars, not the screen:
  // Safari on a 390x844 iPhone shows about 664px, Chrome on a 360x780 Android
  // about 640px. The first-screen rule is measured there.
  {label: 'iPhone-390x664-safari-visible', width: 390, height: 664, mobile: true, theme: THEMES[0]},
  {label: 'Android-360x640-chrome-visible-dark', width: 360, height: 640, mobile: true, theme: THEMES[1]},
];

const browser = browserPath();
const workDir = makeWorkDir('scam-incident');
const srv = startServer();
const runs = [];
const openings = [];
try {
  const origin = await srv.origin;
  for (const viewport of VIEWPORTS) {
    const p = await openPage({browser, origin, workDir, viewport, theme: viewport.theme, mock: MOCK});
    try {
      await waitTheme(p.evaluate, viewport.theme.dark, viewport.theme.label);
      // The page opens at its top (대화로 돌아가기 in view); a touch screen keeps
      // its keyboard down. Production 10-15 opened scrolled 252px to the field.
      await freshInput(p);
      await sleep(400);
      openings.push({viewport, ...(await p.evaluate(`(() => { const ws = document.querySelector('.consumer-workspace[data-workspace="scam"]'); const back = ws.querySelector('.site-modal-close'); return {scrollTop: ws.scrollTop, backTop: Math.round(back.getBoundingClientRect().top), active: document.activeElement?.id || document.activeElement?.tagName || ''}; })()`))});
      for (const testCase of CASES) {
        await p.evaluate(`window.__payload = ${JSON.stringify(PAYLOADS[testCase.payload])}; true`);
        await freshInput(p);
        if (testCase.url) {
          await p.tap('[data-scam-tab="url"]');
          await p.evaluate(`(() => { const u = document.querySelector('#scam-url'); u.value = ${JSON.stringify(testCase.url)}; u.dispatchEvent(new Event('input', {bubbles: true})); return true; })()`);
        } else {
          await p.evaluate("(() => { const t = document.querySelector('#scam-text'); t.value = '[국제발신] 미납 과태료 고지서 확인: http://fine-notice.example/pay'; t.dispatchEvent(new Event('input', {bubbles: true})); return true; })()");
        }
        if (testCase.incident) {
          await p.tap('[data-scam-incident="yes"]');
          await p.tap(`[data-scam-device="${testCase.incident.device}"]`);
          await p.tap(`[data-scam-stage="${testCase.incident.stage}"]`);
        } else {
          await p.tap('[data-scam-incident="no"]');
        }
        await p.tap('[data-scam-submit]');
        await waitFor(() => p.evaluate(`document.querySelector('[data-scam-result]')?.dataset.riskLevel === ${JSON.stringify(testCase.payload)}`), `${testCase.name} result`);
        await sleep(80);
        const before = await p.evaluate(INSPECT);
        // Open 검사 대상과 검사 시각 to read the checked address there.
        await p.tap('[data-scam-section="info"] .sp-sec-h');
        await sleep(60);
        const infoText = await p.evaluate("document.querySelector('[data-scam-section=\"info\"]').textContent");
        const sent = await p.evaluate('window.__sent');
        runs.push({viewport, testCase, ...before, infoText, sent});
        if (SHOTS) {
          await p.evaluate("document.querySelector('.consumer-workspace').scrollTo(0, 0), true");
          await p.screenshot(path.join(SHOTS, `${viewport.label}-${testCase.name}.png`));
        }
      }
    } finally { await p.close(); }
  }
} finally {
  srv.stop();
  await removeDir(workDir);
}

for (const opening of openings) {
  assert.ok(opening.scrollTop === 0 && opening.backTop >= 0, `${opening.viewport.label}: the page opens at its top with 대화로 돌아가기 in view ${JSON.stringify(opening)}`);
  if (opening.viewport.mobile) assert.notEqual(opening.active, 'scam-text', `${opening.viewport.label}: opening the page does not raise the keyboard`);
}
if (process.env.SCAM_INCIDENT_DEBUG) for (const run of runs) console.log(run.viewport.label, run.innerHeight, run.testCase.name, JSON.stringify({vp: run.viewport, tiles: run.tiles.map(t => t.rect), scroll: run.scrollTop, list: run.incidentList, doNow: run.doNowBox}));
const PURPOSES = {pay: ['송금 피해', '돈을 보낸 금융회사 고객센터'], sos: ['보이스피싱·스미싱 통합 신고·상담', '1394'], emergency: ['즉시 출동이 필요한 긴급 상황', '112'], kisa: ['사이버 보안·스미싱 상담', '118'], ecrm: ['사이버범죄 온라인 신고', '경찰청 ECRM']};
for (const run of runs) {
  const where = `${run.viewport.label} ${run.testCase.name}`;
  const {incident, payload} = run.testCase;
  assert.ok(run.overflow <= 1, `${where}: no sideways scroll (${run.overflow})`);
  // 1 — incident first, whatever the verdict.
  if (incident) {
    assert.deepEqual(run.order.slice(0, 4), ['incident', 'contacts', 'label', 'verdict'], `${where}: incident → contacts → 내용 분석 결과 → verdict (${run.order})`);
    assert.equal(run.sent.incident_level, String(incident.stage), `${where}: stage sent`);
    assert.equal(run.sent.device, incident.device, `${where}: device sent`);
    assert.ok(run.incidentActions.length >= 2, `${where}: incident actions shown`);
    for (const line of CALM) assert.ok(!run.doNow.some(text => text.includes(line)), `${where}: "${line}" never shown with an incident`);
  } else {
    assert.ok(!run.order.includes('incident'), `${where}: no incident card without an incident`);
    assert.equal(run.sent.incident_level, undefined, `${where}: no incident fields sent with 아니요`);
  }
  // 2 — 확인된 위험 신호 없음 keeps the no-guarantee sentence on top.
  if (payload === 'CURRENTLY_NO_RISK_SIGNAL') {
    assert.equal(run.level, '확인된 위험 신호 없음', `${where}: level name`);
    assert.ok(run.summary.includes('다만 안전하다는 보증은 아니에요.'), `${where}: no-guarantee sentence`);
  }
  assert.ok(!/위험 신호 없음/u.test(run.text.replace(/확인된 위험 신호 없음/gu, '')), `${where}: never a bare 위험 신호 없음`);
  // 3 — channels by purpose wherever the contacts card shows.
  const contactsShown = Boolean(incident) || payload === 'HIGH_RISK';
  assert.equal(run.order.includes('contacts'), contactsShown, `${where}: contacts card ${contactsShown ? 'shown' : 'not shown'}`);
  if (contactsShown) {
    assert.deepEqual(run.contactRows.map(row => row.key).sort(), Object.keys(PURPOSES).sort(), `${where}: five channels`);
    for (const row of run.contactRows) {
      assert.equal(row.use, PURPOSES[row.key][0], `${where}: ${row.key} purpose`);
      assert.equal(row.main, PURPOSES[row.key][1], `${where}: ${row.key} channel`);
    }
    if (incident?.stage === 6 || (!incident && payload === 'HIGH_RISK')) assert.equal(run.contactRows[0].key, 'pay', `${where}: 송금 피해 first`);
  }
  if (incident?.stage === 6) assert.ok(run.firstCall.includes(PAY_STOP), `${where}: 지급정지 first`);
  // 4 — links only to allowed hosts, labelled with their host; checked address never a link.
  for (const link of run.links) {
    if (link.href.startsWith('tel:')) continue;
    if (link.href === 'https://account.lotbiai.com/account') continue;
    const url = new URL(link.href);
    assert.equal(url.protocol, 'https:', `${where}: ${link.href} https`);
    assert.ok(SCAM_OFFICIAL_LINK_HOSTS.includes(url.hostname), `${where}: ${link.href} on the allowlist`);
    assert.ok(link.text.includes(url.hostname), `${where}: ${link.href} shows its host`);
    assert.equal(link.target, '_blank', `${where}: ${link.href} target`);
    assert.ok(link.rel.includes('noopener') && link.rel.includes('noreferrer'), `${where}: ${link.href} rel`);
  }
  assert.ok(!run.links.some(link => /fine-notice|203\.0\.113\.24|example|unlisted\.go\.kr/u.test(link.href)), `${where}: no link to the checked or an unlisted address`);
  if (run.testCase.url) assert.ok(run.infoText.includes(run.testCase.url) && run.infoText.includes('링크로 만들지 않아요'), `${where}: checked address shown as text`);
  // 5 — remote control: contact from another device, nothing to tap here.
  if (incident && (incident.stage === 4 || incident.stage === 5)) {
    assert.ok(run.otherDevice, `${where}: other-device warning`);
    assert.deepEqual(run.tel, [], `${where}: no tel: on a possibly controlled device`);
    assert.ok(!run.links.some(link => /counterscam112|boho|ecrm/u.test(link.href)), `${where}: no official site buttons on this device`);
    assert.ok(run.text.includes('다른 전화기로'), `${where}: says to use another phone`);
  } else {
    assert.ok(!run.otherDevice, `${where}: no other-device warning`);
  }
  // 8 — phone: 지금 하실 일 and the 지급정지·1394·112 buttons on the first screen.
  if (run.viewport.mobile && contactsShown) {
    assert.equal(run.scrollTop, 0, `${where}: measured at the top`);
    assert.equal(run.tiles.length, 3, `${where}: three quick buttons`);
    for (const tile of run.tiles) assert.ok(tile.rect.bottom <= run.innerHeight, `${where}: ${tile.key} button visible without scrolling (${tile.rect.bottom} > ${run.innerHeight})`);
    const urgent = incident ? run.incidentList : run.doNowBox;
    assert.ok(urgent && urgent.top < run.innerHeight && urgent.bottom <= run.innerHeight + 1, `${where}: urgent actions visible without scrolling ${JSON.stringify(urgent)} in ${run.innerHeight}`);
    if (!(incident && (incident.stage === 4 || incident.stage === 5))) {
      for (const tile of run.tiles.filter(item => item.key === 'sos' || item.key === 'emergency')) assert.ok(tile.href.startsWith('tel:'), `${where}: ${tile.key} calls`);
    }
  }
}
console.log(`SCAM-SHIELD-INCIDENT-PRIORITY-01 PASS — ${runs.length} results (6 cases × 1280x900 light / 390x664 light / 360x640 dark): incident before analysis, 5 channels by purpose, allowlisted links only, other-device rule, phone first screen; viewport emulation, not a device run`);
