// TROUBLE-HELPER-01 → TROUBLE-HELPER-PAGE-01 — 분쟁·사고 도우미 as a page.
//
// Contract checked here (owner-approved design 2026-10-14, "팝업 형태로 되면
// 안돼 페이지로 해야돼", "음성은 빼야해"):
// * both menus (desktop sidebar, mobile drawer) carry 분쟁·사고 도우미
//   (data-trouble-open) right after 사기·피싱 확인; a tap opens a WORKSPACE page
//   (route #trouble, the menu entry aria-current="page", header ← "뒤로") —
//   no <dialog>, no ×, no dimmed overlay — without any login, from Core's
//   public GET /v2/trouble-helper/guides (credentials omit, no headers); the
//   module loads on first use only (never at boot)
// * ⓪ 무슨 일이 있으셨나요? — the five situations in Core's order with the notice
// * ① a situation's first screen: 눌러서 답하기 and 바로 도움받기 on the first
//   screen; no emergency-number line on top (owner: "누가 119·112 몰라서
//   롯비를 열어? 삭제해" — the guide's own 119/112 steps keep their calls inside
//   지금 할 일); no photo/text/voice input, nothing that does not exist
// * ② one question per screen, the guide's answers plus 잘 모르겠어요 where the
//   guide has none (a skip: nothing hidden, never asked again), 질문 그만하고
//   결과 보기, the answers given with 바꾸기; no "n/m" step counter
// * ③ 이렇게 하세요 — 지금 할 일 · 챙길 것 · 도움받을 곳 (all three titles on
//   the first screen at 375×812 and 1280×900), each opening in place: the
//   guide's steps (했어요, phones, online links, 인증이 안 돼요, 사기·피싱 확인
//   link, goto), the 과실비율정보포털 way in, the evidence checklist and
//   references, the official channels (fees, hours, 확인일 · 근거); 전화할 때
//   이렇게 말하세요; the 정리표 entry; the required 참고용 sentence
// * ④ 상황 정리표: save on the device, print (large sheet), 카카오로 보내기 →
//   navigator.share → copy, 'SUBMITTED' locked until a 접수번호
// * the header ← and the phone's back step one screen at a time inside the
//   page; a reload on #trouble reopens the screen it was on
// * signed in: the helper sends Core nothing more than signed out
// * Core down: the fallback sentence and 112 · 119 · 132 call buttons
// * 375 · 320 · 1280, light and dark: no sideways scroll, text ≥ 18px, title
//   30px (phone) / 36px (wide), main buttons ≥ 56px, every target ≥ 48px,
//   contrast ≥ 4.5 (viewport emulation in headless Chrome, not a device run)
//
// Core's answer comes from scripts/fixtures/trouble_helper_guides_01.json, the
// public output of lotbi-core app/trouble_helper.py (public_guides()).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const FIXTURE = JSON.parse(read('scripts/fixtures/trouble_helper_guides_01.json'));
const RATIO_RE = /\d+\s*[:：]\s*\d+|\d+\s*%/u;
let passed = 0;
const check = async (name, fn) => { await fn(); passed += 1; console.log(`ok - ${name}`); };

// ── Static wiring ───────────────────────────────────────────────────────
const index = read('index.html');
const callback = read('auth/callback/index.html');
const conversation = read('site-conversation.js');
const routeSource = read('site-route.js');
const ui = read('site-trouble-helper.js');
const modelSource = read('site-trouble-helper-model.js');
const css = read('site-trouble-helper.css');

await check('menus: 분쟁·사고 도우미 sits right after 사기·피싱 확인 in the desktop and mobile menus', () => {
  const navs = [...index.matchAll(/<div class="consumer-primary-nav"[^>]*>([\s\S]*?)<\/div>/gu)].map(match => match[1]);
  assert.equal(navs.length, 2);
  for (const nav of navs) {
    const labels = [...nav.matchAll(/<button\b[^>]*aria-label="([^"]+)"/gu)].map(match => match[1]);
    assert.equal(labels[labels.indexOf('사기·피싱 확인') + 1], '분쟁·사고 도우미', JSON.stringify(labels));
    assert.match(nav, /<button class="nav-item nav-link" type="button" data-trouble-open aria-label="분쟁·사고 도우미">\s*<svg class="nav-icon"[^>]*><use href="#lotbi-icon-lifebuoy"><\/use><\/svg>\s*<span class="nav-item-label">분쟁·사고 도우미<\/span>/u);
  }
  assert.equal((index.match(/id="lotbi-icon-lifebuoy"/gu) || []).length, 1);
});

await check('a page, not a dialog: workspace #trouble, loaded on first use, styles on both entry pages', () => {
  assert.doesNotMatch(index, /trouble-dialog|data-trouble-dialog/u, 'the old <dialog> is gone');
  assert.doesNotMatch(ui, /showModal|<dialog|data-trouble-close|trouble-dialog|×/u, 'no dialog, no ×');
  for (const [name, html] of [['index.html', index], ['auth/callback/index.html', callback]]) {
    const scam = html.indexOf('site-scam-shield.css?v=');
    const mine = html.indexOf('site-trouble-helper.css?v=');
    assert.ok(scam > 0 && mine > scam, `${name}: stylesheet after site-scam-shield.css`);
  }
  // SITE-T55 gate: a boot-time import shifted other boot requests into
  // validate_social_signup_profile_ux_01's window. Only a menu tap or the
  // address naming the page may load the module.
  assert.doesNotMatch(conversation, /^void import\('\.\/site-trouble-helper\.js/mu, 'never imported at boot');
  assert.doesNotMatch(conversation, /lotbi\.trouble-helper\.open\.v1/u, 'no dialog reopen flag any more');
  assert.match(conversation, /troubleHelperModule \|\|= import\('\.\/site-trouble-helper\.js\?v=aset-[0-9a-f]{12}'\)\.catch\(/u);
  assert.match(conversation, /const openTroubleHelperPage = async \(\{resume = false\} = \{\}\) => \{/u);
  assert.match(conversation, /installSurfaceBehavior\(backdrop, panel, \{workspace: 'trouble', route: 'trouble', onClose: \(\) => mounted\?\.dispose\(\)\}\)/u);
  assert.match(conversation, /closest\('\[data-trouble-open\]'\);\s*if \(troubleTrigger instanceof HTMLButtonElement\) \{\s*event\.preventDefault\(\); void openTroubleHelperPage\(\); return;/u);
  assert.match(conversation, /trouble: \(\) => openTroubleHelperPage\(\{resume: true\}\),/u);
  assert.match(conversation, /workspace === 'trouble' && entry\.hasAttribute\('data-trouble-open'\)/u, 'the menu entry is marked current');
  assert.match(routeSource, /'scam',\r?\n[^\n]*\n  'trouble',\r?\n  'care',/u, '#trouble right after #scam');
  assert.match(ui, /export function mountTroubleHelper\(root, \{resume = false\} = \{\}\)/u);
  assert.match(ui, /data: \{subviewBack: '', troubleBack: ''\}/u, 'the inner back control takes the header ← and the phone back');
});

await check('sources: no HTML injection, storage only inside try, no login, no voice, nothing that does not exist', () => {
  for (const [name, source] of [['site-trouble-helper.js', ui], ['site-trouble-helper-model.js', modelSource]]) {
    assert.doesNotMatch(source, /innerHTML|insertAdjacentHTML|outerHTML\s*=|eval\(|new Function|document\.write/u, name);
    assert.doesNotMatch(source, /dispute/iu, name);
    // "음성은 빼야해": no read-aloud, no speech, no microphone.
    assert.doesNotMatch(source, /read-aloud|ReadAloud|speechSynthesis|SpeechRecognition|getUserMedia|읽어주기|소리로 듣기|말로 설명/u, name);
    // Only what exists: no photo reading, no free-text understanding, no ratio or cost.
    assert.doesNotMatch(source, /사진 올리기|글로 적기|예상 과실|예상 수리비|보험사에 보낼/u, name);
  }
  assert.doesNotMatch(modelSource, /localStorage|sessionStorage|document\.|window\./u, 'the model is pure');
  for (const match of ui.matchAll(/(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)/gu)) {
    const before = ui.slice(Math.max(0, match.index - 240), match.index);
    assert.match(before, /try\s*\{[^}]*$/u, `storage call without try: ${ui.slice(match.index, match.index + 60)}`);
  }
  assert.doesNotMatch(ui, /Authorization|credentials:\s*'include'|sessionToken/u, 'no login, no credentials');
  assert.doesNotMatch(ui, /질문 \$\{[^}]*\}\s*\/|data-trouble-progress|setProgress/u, 'no "n/m" step counter');
  // Colours: the site tokens, plus this page's own accents declared once per theme.
  for (const line of css.split('\n')) {
    if (/#[0-9a-f]{3,8}\b/iu.test(line)) assert.match(line, /^\s*--th-[a-z0-9-]+:\s*#[0-9a-f]{3,8};$/iu, `colour outside the page palette: ${line.trim()}`);
  }
  assert.doesNotMatch(css, /dispute|trouble-dialog/iu);
});

await check('the page copy: required sentences as the brief writes them', async () => {
  const names = await import('../site-trouble-helper-model.js');
  assert.deepEqual([...names.PAGE_VIEWS], ['start', 'ask', 'result', 'summary']);
  assert.equal(names.DISCLAIMER, 'LOTBI의 결과는 참고용이며 법률·보험·수리비의 최종 판단이 아닙니다.');
  assert.equal(names.NO_AUTO_SEND, '신고·전화·접수는 직접 하셔야 해요. LOTBI가 대신 보내지 않아요.');
  assert.equal('EMERGENCY_LINES' in names, false, 'no emergency-number line (owner: 삭제해)');
  assert.equal('emergencyFor' in names, false);
  for (const source of [ui, modelSource]) assert.doesNotMatch(source, /에 연락하세요|data-trouble-emergency|trouble-emergency/u);
  for (const key of ['hubTitle', 'startTitle']) assert.equal(names.PAGE_COPY[key], '무슨 일이 있으셨나요?');
  assert.equal(names.PAGE_COPY.tapLabel, '눌러서 답하기');
  assert.equal(names.PAGE_COPY.direct, '바로 도움받기');
  assert.equal(names.PAGE_COPY.nextAsk, '한 가지만 더 알려주세요');
  assert.equal(names.PAGE_COPY.unknown, '잘 모르겠어요');
  assert.equal(names.PAGE_COPY.resultTitle, '이렇게 하세요');
  assert.deepEqual([names.PAGE_COPY.todo, names.PAGE_COPY.keep, names.PAGE_COPY.help], ['지금 할 일', '챙길 것', '도움받을 곳']);
  assert.equal(names.PORTAL_SENTENCE_HINT, '질문에 답하면 포털에 붙여 넣을 문장을 만들어 드려요');
  assert.deepEqual([...names.QUICK_CALL_PHONES], ['112', '119']);
});

// ── Pure rules ──────────────────────────────────────────────────────────
const model = await import('../site-trouble-helper-model.js');
const guides = model.normalizeGuides(FIXTURE);
const situation = id => model.findSituation(guides, id);

await check('Core answer: five situations in order, receipt_field_id honoured, fixture car guide carries no ratio', () => {
  assert.ok(guides);
  assert.deepEqual(guides.situations.map(item => item.id), ['CAR_ACCIDENT', 'USED_TRADE_FRAUD', 'WAGE_ARREARS', 'FLOOR_NOISE', 'OTHER_LEGAL']);
  assert.deepEqual(guides.situations.map(item => item.receiptFieldId), ['receipt', 'receipt', 'receipt', 'receipt', null]);
  assert.equal(guides.notice, FIXTURE.notice);
  assert.doesNotMatch(JSON.stringify(FIXTURE.situations[0]), RATIO_RE);
  assert.equal(model.guidesUrl(), 'https://api.lotbiai.com/v2/trouble-helper/guides');
  assert.equal(model.normalizeGuides({...FIXTURE, situations: []}), null);
  assert.equal(model.normalizeGuides({...FIXTURE, notice: ''}), null);
  assert.equal(model.normalizeGuides({...FIXTURE, status_track: FIXTURE.status_track.slice(1)}), null);
  assert.equal(model.normalizeGuides('nope'), null);
});

await check('fee line: 상담료 · 통화료 · 신청 수수료 each only when known', () => {
  const lines = Object.fromEntries([...guides.channels.values()].map(channel => [channel.id, model.feeLine(channel)]));
  for (const raw of FIXTURE.channels) {
    const expected = [];
    if (raw.consult_fee === 'FREE') expected.push('상담료 없음');
    if (raw.consult_fee === 'PAID') expected.push('상담료 있음');
    if (raw.call_cost === 'FREE') expected.push('통화료 없음');
    if (raw.call_cost === 'CALLER_PAYS') expected.push('통화료 별도');
    if (raw.procedure_fee === 'NONE') expected.push('신청 수수료 없음');
    if (raw.procedure_fee === 'FEE') expected.push(raw.procedure_fee_note);
    assert.equal(lines[raw.id], expected.join(' · '), raw.id);
  }
  assert.equal(lines.MY_INSURER, '', 'all UNKNOWN: nothing shown');
  assert.doesNotMatch(lines.MOEL_1350, /상담료/u, '1350 상담료 is UNKNOWN');
  const hours = channel => model.hoursLine(guides.channels.get(channel));
  assert.equal(hours('COMWEL_1588'), '운영시간은 전화로 확인해 주세요');
  assert.equal(hours('ECRM'), '', 'no phone: no "전화로 확인"');
  assert.match(hours('KLAC_132'), /^운영시간 평일/u);
});

await check('show_if counts only answered questions (unanswered = shown); 바로 전화 112 · 119 in step order', () => {
  const car = situation('CAR_ACCIDENT');
  const ids = list => list.map(item => item.id);
  // Nothing answered: every step and question shows, in the data order.
  assert.deepEqual(ids(model.visibleSteps(car, {})), ['call_119', 'stay_safe', 'call_112', 'photos', 'blackbox', 'insurer', 'fault_reference']);
  assert.deepEqual(ids(model.visibleQuestions(car, {})), ['injury', 'other', 'place', 'signal', 'my_move']);
  assert.deepEqual(ids(model.visibleQuestions(car, {place: 'oncoming'})), ['injury', 'other', 'place', 'my_move']);
  assert.deepEqual(ids(model.visibleQuestions(car, {place: 'intersection'})), ['injury', 'other', 'place', 'signal', 'my_move']);
  assert.deepEqual(model.cleanAnswers(car, {place: 'oncoming', signal: 'yes'}), {place: 'oncoming'});
  assert.deepEqual(model.cleanAnswers(car, {signal: 'yes'}), {signal: 'yes'}, 'place not answered: 신호등 stays');
  assert.deepEqual(model.cleanAnswers(car, {injury: 'maybe', other: 'car'}), {other: 'car'}, 'an answer that is no option is dropped');
  assert.ok(!model.visibleSteps(car, {injury: 'no'}).some(step => step.id === 'call_119'));
  assert.ok(model.visibleSteps(car, {injury: 'unknown'}).some(step => step.id === 'call_119'));
  assert.ok(model.visibleSteps(car, {injury: 'yes'}).some(step => step.id === 'call_119'));
  assert.deepEqual(model.answeredCount(car, {}), {answered: 0, total: 5});
  assert.deepEqual(model.answeredCount(car, {injury: 'no', place: 'oncoming'}), {answered: 2, total: 4});
  const phones = (id, answers) => model.quickCalls(guides, situation(id), answers).map(channel => channel.phone);
  assert.deepEqual(phones('CAR_ACCIDENT', {}), ['119', '112']);
  assert.deepEqual(phones('CAR_ACCIDENT', {injury: 'no'}), ['112']);
  assert.deepEqual(phones('USED_TRADE_FRAUD', {}), ['112']);
  assert.deepEqual(phones('USED_TRADE_FRAUD', {paid: 'not_yet'}), []);
  assert.deepEqual(phones('USED_TRADE_FRAUD', {paid: 'bank'}), ['112']);
  assert.deepEqual(phones('USED_TRADE_FRAUD', {paid: 'app_pay'}), []);
  for (const id of ['WAGE_ARREARS', 'FLOOR_NOISE', 'OTHER_LEGAL']) assert.deepEqual(phones(id, {}), [], `${id}: no 112/119 step`);
  const fraud = situation('USED_TRADE_FRAUD');
  assert.deepEqual(ids(model.visibleSteps(fraud, {})), ['stop_paying', 'bank_and_112', 'app_report', 'save_evidence', 'police_report', 'lookup_before']);
  assert.deepEqual(ids(model.visibleSteps(fraud, {paid: 'not_yet'})), ['stop_paying', 'lookup_before']);
  assert.deepEqual(ids(model.visibleQuestions(fraud, {paid: 'not_yet'})), ['paid', 'contact']);
  const noise = situation('FLOOR_NOISE');
  assert.deepEqual(ids(model.visibleSteps(noise, {})), ['diary', 'manager_first', 'center', 'not_covered', 'mediation']);
  assert.deepEqual(ids(model.visibleSteps(noise, {housing: 'apartment', manager: 'yes'})), ['diary', 'manager_first', 'center', 'mediation']);
  // A rule that cannot be read is never satisfied, answered or not.
  const broken = model.normalizeGuides({...FIXTURE, situations: [{...FIXTURE.situations[0], steps: [
    ...FIXTURE.situations[0].steps, {id: 'bad_rule', title: '읽을 수 없는 규칙', show_if: {'bad key!': ['x']}}, {id: 'empty_rule', title: '빈 규칙', show_if: {}},
  ]}]});
  const brokenCar = model.findSituation(broken, 'CAR_ACCIDENT');
  assert.ok(brokenCar.steps.some(step => step.id === 'bad_rule'));
  assert.ok(!model.visibleSteps(brokenCar, {}).some(step => ['bad_rule', 'empty_rule'].includes(step.id)));
  // A record saved on the old question screen or tabs opens on the result.
  const old = model.normalizeRecord(car, {view: 'question', question: 2, answers: {injury: 'no'}});
  assert.equal(old.view, 'result');
  assert.equal('question' in old, false);
});

await check('접수번호 lock, fault portal order as far as answered, sentence, share text, safe links', () => {
  const car = situation('CAR_ACCIDENT');
  const none = model.faultPortalGuide(car, {});
  assert.deepEqual(none.order, [], 'nothing answered: no order yet');
  assert.equal(none.sentence, '', 'nothing answered: no sentence yet');
  assert.equal(none.describeUrl, FIXTURE.situations[0].fault_portal.describe_url);
  assert.deepEqual(model.faultPortalGuide(car, {other: 'car'}).order, ['차 대 차']);
  assert.equal(model.faultPortalGuide(car, {other: 'car'}).sentence, '', 'too short for 대화로 찾기 yet');
  const answers = {injury: 'no', other: 'car', place: 'intersection', signal: 'yes', my_move: 'straight'};
  const portal = model.faultPortalGuide(car, answers);
  assert.deepEqual(portal.order, ['차 대 차', '교차로']);
  assert.equal(portal.selectUrl, FIXTURE.situations[0].fault_portal.select_url);
  assert.equal(portal.sentence, '교차로(사거리·삼거리)에서 다른 차와 부딪혔어요. 신호등은 있었어요. 내 차는 곧게 가고 있었어요.');
  assert.ok(portal.sentence.length >= 20 && portal.sentence.length <= 1000);
  const pm = model.faultPortalGuide(car, {...answers, other: 'pm', place: 'oncoming'});
  assert.equal(pm.selectUrl, FIXTURE.situations[0].fault_portal.pm_url);
  assert.equal(pm.sentence, '마주 오다가 전동킥보드와 부딪혔어요. 내 차는 곧게 가고 있었어요.');
  assert.doesNotMatch(JSON.stringify([portal, pm]), RATIO_RE);
  assert.equal(model.canChooseStatus(car, {}, 'SUBMITTED'), false);
  assert.equal(model.canChooseStatus(car, {receipt: '  '}, 'SUBMITTED'), false);
  assert.equal(model.canChooseStatus(car, {receipt: '2026-77'}, 'SUBMITTED'), true);
  assert.equal(model.canChooseStatus(car, {}, 'IN_PROGRESS'), true);
  assert.equal(model.canChooseStatus(situation('OTHER_LEGAL'), {}, 'SUBMITTED'), true, 'receipt_field_id null never locks');
  assert.equal(model.normalizeRecord(car, {status: 'SUBMITTED', fields: {}}).status, 'PREPARE');
  const record = model.normalizeRecord(car, {answers, fields: {receipt: '2026-77'}, status: 'SUBMITTED', createdOn: '2026-10-10'});
  const text = model.shareText(guides, car, record);
  const head = text.slice(0, 200);
  for (const line of [model.SHARE_SAFETY_LINE, FIXTURE.notice, '접수번호: 2026-77']) assert.ok(head.includes(line), `in the first 200 characters: ${line}`);
  assert.equal(model.SHARE_SAFETY_LINE, '인증번호·비밀번호는 가족에게도 보내지 마세요.');
  assert.equal(model.officialUrl('http://www.klac.or.kr/'), '');
  assert.equal(model.officialUrl('javascript:alert(1)'), '');
  assert.equal(model.officialUrl('https://example.com/'), '');
  assert.equal(model.officialUrl('https://www.korea.kr/news/x'), 'https://www.korea.kr/news/x');
  assert.equal(model.telHref('1588-0075'), 'tel:15880075');
  assert.equal(model.telHref('12a'), '');
  assert.doesNotMatch(model.savedAtLabel(new Date(2026, 9, 10, 21, 5)), RATIO_RE);
});

await check('page rules: one question at a time, 잘 모르겠어요 skips, saved views, card lines from the guide', () => {
  const car = situation('CAR_ACCIDENT');
  const fraud = situation('USED_TRADE_FRAUD');
  const other = situation('OTHER_LEGAL');
  assert.equal(model.nextQuestion(car, {}, {}).id, 'injury');
  assert.equal(model.nextQuestion(car, {injury: 'no'}, {}).id, 'other');
  assert.equal(model.nextQuestion(car, {injury: 'no'}, {other: true}).id, 'place', 'a skipped question is not asked again');
  assert.equal(model.nextQuestion(car, {injury: 'no', place: 'oncoming'}, {other: true}).id, 'my_move', '신호등 hidden for 마주 오다가');
  assert.equal(model.nextQuestion(car, {injury: 'no', place: 'intersection'}, {other: true}).id, 'signal');
  assert.equal(model.nextQuestion(car, {injury: 'no', other: 'car', place: 'intersection', signal: 'yes', my_move: 'straight'}, {}), null);
  assert.equal(model.nextQuestion(fraud, {paid: 'not_yet'}, {}).id, 'contact', '언제 보냈나요 hidden when nothing was sent');
  assert.equal(model.hasUnknownOption(car.questions.find(q => q.id === 'injury')), true);
  assert.equal(model.hasUnknownOption(car.questions.find(q => q.id === 'other')), false);
  assert.equal(model.hasUnknownOption(other.questions[0]), false);
  // Saved records: the old tabs open on the result; skipped answers are kept, an answer clears its skip.
  assert.equal(model.normalizeRecord(car, {view: 'steps'}).view, 'result');
  assert.equal(model.normalizeRecord(car, {view: 'help'}).view, 'result');
  assert.equal(model.normalizeRecord(car, {view: 'summary'}).view, 'summary');
  assert.equal(model.normalizeRecord(car, {}).view, 'start');
  assert.equal(model.normalizeRecord(car, {view: 'nope'}).view, 'start');
  assert.deepEqual(model.normalizeRecord(car, {skipped: {other: true, bogus: true, place: 'yes'}}).skipped, {other: true});
  assert.deepEqual(model.normalizeRecord(car, {answers: {other: 'car'}, skipped: {other: true}}).skipped, {});
  assert.equal(model.firstSentence('비상등을 켜고 삼각대를 세우세요. 탄 사람은 피하세요.'), '비상등을 켜고 삼각대를 세우세요.');
  assert.equal(model.firstSentence('한 문장뿐'), '한 문장뿐');
  const cards = model.cardModel(guides, car, {});
  assert.equal(cards.todo.count, 7);
  assert.equal(cards.todo.title, '다친 사람이 있으면 119', 'the first urgent step leads');
  assert.equal(model.cardModel(guides, car, {injury: 'no'}).todo.title, '더 큰 사고 막기');
  assert.equal(cards.keep.line, '블랙박스 원본 영상 등 5가지');
  assert.equal(cards.help.main.id, 'KNIA_PORTAL', '112·119 are on the emergency line; 내 보험사 has no number');
  assert.equal(cards.help.line, '내 보험사 사고 접수, 과실비율정보포털에 물어볼 수 있어요.');
  assert.equal(model.cardModel(guides, situation('WAGE_ARREARS'), {}).help.main.phone, '1350');
  assert.equal(model.cardModel(guides, situation('FLOOR_NOISE'), {}).help.main.phone, '1661-2642');
  assert.equal(model.cardModel(guides, other, {}).help.main.phone, '132');
  assert.equal(model.cardModel(guides, fraud, {}).help.main.id, 'POLICE_182');
  assert.doesNotMatch(JSON.stringify(cards), RATIO_RE);
});

// ── Browser ─────────────────────────────────────────────────────────────
function browserPath() {
  const candidates = [process.env.CHROME_BIN, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/opt/pw-browsers/chromium', 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
    const found = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [candidate], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim().split(/\r?\n/)[0];
  }
  throw new Error('Chrome/Chromium is required for the 분쟁·사고 도우미 validation.');
}

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
// cards: whether the three result card titles must all be on the first screen.
const CASES = [
  {label: 'mobile-375x812', width: 375, height: 812, mobile: true, userAgent: IPHONE_UA, shots: true, cards: true, wide: false},
  {label: 'mobile-320x640', width: 320, height: 640, mobile: true, userAgent: ANDROID_UA, cards: false, wide: false},
  {label: 'desktop-1280x900', width: 1280, height: 900, mobile: false, userAgent: DESKTOP_UA, shots: true, cards: true, wide: true},
];
const SIGNED_CASES = [
  {label: 'signed-mobile-375x812', width: 375, height: 812, mobile: true, userAgent: IPHONE_UA, cards: true, wide: false},
  {label: 'signed-desktop-1280x900', width: 1280, height: 900, mobile: false, userAgent: DESKTOP_UA, cards: true, wide: true},
];

function buildInner(mode) {
  let html = index;
  const runtime = html.match(/<script type="module" src="site-conversation\.js\?v=[^"]+"><\/script>/u);
  assert.ok(runtime, 'index.html must load site-conversation.js as a module');
  html = html.replace('<head>', '<head>\n  <base href="/">');
  const harness = `<script type="module">
const out = document.getElementById('th-result');
const F = ${JSON.stringify(FIXTURE)};
const MODE = ${JSON.stringify(mode)};
try {
  if (sessionStorage.getItem('__thBooted') !== MODE) { localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('__thBooted', MODE); }
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}}));
  const calls = globalThis.__thCalls = [];
  // Every request, with whether 분쟁·사고 도우미 code (or the Kakao share module
  // its 정리표 readies) is on the stack that sent it.
  const requests = globalThis.__thRequests = [];
  globalThis.fetch = (url, init) => {
    let parsed;
    try { parsed = new URL(String((url && url.url) || url), location.origin); } catch { return nativeFetch(url, init); }
    const headers = new Headers(init?.headers || (url && url.headers) || {});
    requests.push({origin: parsed.origin, path: parsed.pathname, credentials: init?.credentials || '', authorization: headers.has('authorization'),
      trouble: /site-trouble-helper|site-kakao-share/.test(String(new Error().stack || ''))});
    if (parsed.pathname === '/v2/trouble-helper/guides') {
      calls.push({url: parsed.href, method: init?.method || 'GET', credentials: init?.credentials || '', mode: init?.mode || '',
        headers: [...new Headers(init?.headers || {}).keys()]});
      return MODE === 'fail' ? json({detail: {code: 'UNAVAILABLE'}}, 503) : json(F);
    }
    if (parsed.pathname === '/app/config.json') return json({detail: 'missing'}, 404);
    if (parsed.pathname === '/v2/conversation/guest/sessions') return json({contract_id: 'CORE-GUEST-SESSION-01', schema_version: 1,
      guest_token: 'g'.repeat(43), expires_at: new Date(Date.now() + 3600000).toISOString()});
    // Signed in: the same account answers validate_my_child_school_01 gives.
    if (parsed.pathname === '/v2/me') return json({user: {id: 'usr_trouble', name: '보호자', account_handle: 'parent'},
      session: {id: 'ses', assurance_level: 'FULL', expires_at: '2099-01-01T00:00:00Z'}, installation: {id: 'install-trouble-test'}});
    if (parsed.pathname === '/v2/subscription') return json({plan: 'FREE', status: 'NONE', entitled: false});
    if (parsed.origin !== location.origin) return json({items: []});
    return nativeFetch(url, init);
  };
  globalThis.__thPrints = [];
  window.print = () => { globalThis.__thPrints.push({printing: document.body.classList.contains('trouble-printing'), sheet: document.querySelector('[data-trouble-print-sheet]')?.textContent || ''}); };
  globalThis.__thShares = [];
  globalThis.__thCopies = [];
  Object.defineProperty(navigator, 'share', {configurable: true, writable: true, value: async data => { globalThis.__thShares.push(data); }});
  Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: async text => { globalThis.__thCopies.push(text); }}});
  // Signed in, mounted the way auth/callback does it after hydration (and as
  // validate_my_child_school_01 / validate_social_signup_profile_ux_01 do): the
  // composer is held back so the import does not mount a guest first.
  const SIGNED = MODE === 'signed';
  const composer = document.getElementById('lotbi-prompt');
  const slot = document.createComment('composer');
  if (SIGNED) composer.replaceWith(slot);
  const conversation = await import('/site-conversation.js?v=troublehelper01');
  if (SIGNED) {
    slot.replaceWith(composer);
    document.body.dataset.siteAuthState = 'authenticated';
    if (!conversation.mountConversation({sessionToken: 'site-token', identityKey: 'install-trouble-test'})) throw new Error('signed-in mount');
  }
  // Loaded on first use: at boot the module is not there yet (unless a reload reopens it).
  globalThis.__thBootLoaded = performance.getEntriesByType('resource').some(entry => entry.name.includes('site-trouble-helper.js'));
  out.textContent = JSON.stringify({ok: true});
} catch (e) { out.textContent = JSON.stringify({ok: false, error: String((e && e.stack) || e)}); }
</script><pre id="th-result">pending</pre>`;
  return html.replace(runtime[0], harness);
}

// Page-side helpers, installed once per page load.
const HELPERS = `(() => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const ws = () => document.querySelector('.consumer-workspace[data-workspace="trouble"]');
  const view = () => ws()?.querySelector('[data-trouble-view]');
  const pageText = () => ws()?.textContent || '';
  const wait = async (fn, label, ms = 15000) => { const t = Date.now(); for (;;) { const v = fn(); if (v) return v; if (Date.now() - t > ms) throw new Error('timeout: ' + label + ' | ' + pageText().slice(0, 300)); await sleep(40); } };
  const visible = n => { const r = n.getBoundingClientRect(); const s = getComputedStyle(n); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const describe = n => (n.dataset && Object.keys(n.dataset)[0] || n.className.baseVal || n.className || n.tagName) + ':' + Math.round(n.getBoundingClientRect().width) + 'x' + Math.round(n.getBoundingClientRect().height) + ':' + (n.textContent || '').trim().slice(0, 14);
  const hiddenAid = n => n.closest('.trouble-sr, .trouble-subview-back');
  const targets = root => [...root.querySelectorAll('button, a[href], summary, textarea, label.trouble-check, label.trouble-status-option')].filter(visible).filter(n => !hiddenAid(n));
  const parse = value => (value.match(/[\\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const bgOf = node => { for (let el = node; el; el = el.parentElement) { const c = parse(getComputedStyle(el).backgroundColor); if (c.length === 3 || (c.length === 4 && c[3] > .5)) return c.slice(0, 3); } return [255, 255, 255]; };
  const contrast = node => { const fg = parse(getComputedStyle(node).color).slice(0, 3), bg = bgOf(node); const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x); return Math.round(((a + .05) / (b + .05)) * 100) / 100; };
  const textNodes = root => { const out = []; const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); while (walker.nextNode()) { const t = walker.currentNode; const p = t.parentElement; if (!t.textContent.trim() || !p || hiddenAid(p) || !visible(p)) continue; out.push(p); } return [...new Set(out)]; };
  const page = () => ws().querySelector('[data-trouble-page]');
  const measure = () => {
    const w = ws();
    const heading = view().querySelector('.trouble-title');
    return {
      small: targets(w).filter(n => { const r = n.getBoundingClientRect(); return r.height < 47.5 || r.width < 47.5; }).map(describe),
      mainSmall: [...w.querySelectorAll('.trouble-primary, .trouble-answer, .trouble-cat, .trouble-tap, .trouble-doc, .trouble-tool, .trouble-emergency-call, .trouble-more')].filter(visible).filter(n => n.getBoundingClientRect().height < 47.5 || (n.matches('.trouble-primary, .trouble-answer, .trouble-cat, .trouble-tap, .trouble-doc, .trouble-tool') && n.getBoundingClientRect().height < 55.5)).map(describe),
      smallText: textNodes(page()).filter(n => parseFloat(getComputedStyle(n).fontSize) < 17.5).map(n => describe(n) + ':' + getComputedStyle(n).fontSize).slice(0, 8),
      overflow: [...w.querySelectorAll('*')].filter(n => { const r = n.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 && !hiddenAid(n); }).map(describe).slice(0, 6),
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      wsScroll: w.scrollWidth - w.clientWidth,
      heading: heading ? parseFloat(getComputedStyle(heading).fontSize) : 0,
      view: view()?.dataset.troubleView || '',
      stray: (pageText().match(/null|undefined|NaN|\\[object Object\\]/gu) || []),
      dialogs: document.querySelectorAll('dialog[open]').length,
      overlay: document.body.classList.contains('site-overlay-open'),
      workspace: document.body.classList.contains('site-workspace-open'),
      bg: getComputedStyle(w).backgroundColor,
    };
  };
  const contrasts = () => {
    const out = {};
    for (const node of textNodes(page())) {
      const key = describe(node).split(':')[0];
      const value = contrast(node);
      if (!(key in out) || value < out[key].value) out[key] = {value, fg: getComputedStyle(node).color, bg: bgOf(node).join(','), text: node.textContent.trim().slice(0, 16)};
    }
    return out;
  };
  const click = selector => { const node = ws().querySelector(selector); if (!node) throw new Error('missing ' + selector + ' | ' + pageText().slice(0, 200)); node.click(); return node; };
  const onView = (name, label) => wait(() => view()?.dataset.troubleView === name && view(), label || name);
  const asked = () => view()?.dataset.troubleView === 'ask' ? view().querySelector('[data-trouble-question]')?.dataset.troubleQuestion : '';
  const answer = async (questionId, optionId) => {
    await wait(() => asked() === questionId, 'question ' + questionId);
    click('[data-trouble-option="' + optionId + '"]');
    await sleep(30);
  };
  const skip = async questionId => {
    await wait(() => asked() === questionId, 'question ' + questionId);
    click('[data-trouble-skip="' + questionId + '"]');
    await sleep(30);
  };
  // Inside the first screen (no scroll): each selector's box against the viewport.
  const firstScreen = selectors => {
    const scrolled = (ws()?.scrollTop || 0) + window.scrollY;
    const out = {scrolled};
    for (const selector of selectors) {
      const n = ws().querySelector(selector);
      if (!n) { out[selector] = null; continue; }
      const r = n.getBoundingClientRect();
      out[selector] = {top: Math.round(r.top), bottom: Math.round(r.bottom), inside: r.top >= 0 && r.bottom <= innerHeight + 1};
    }
    return out;
  };
  const given = () => [...view().querySelectorAll('[data-trouble-answers] li')].map(li => [li.querySelector('.trouble-given-q')?.textContent || '', li.querySelector('strong')?.textContent || '', li.querySelector('[data-trouble-edit]')?.dataset.troubleEdit || '']);
  const views = window.__thViews = [];
  new MutationObserver(() => { const v = view(); if (v) views.push(v.dataset.troubleView); }).observe(document.body, {subtree: true, attributes: true, attributeFilter: ['data-trouble-view']});
  window.__th = {sleep, ws, view, wait, measure, contrasts, contrast, click, onView, asked, answer, skip, firstScreen, given, pageText, visible};
  return true;
})()`;

const OPEN = mobile => `(async () => {
  if (${mobile ? 'true' : 'false'}) {
    document.querySelector('[data-mobile-nav-open]').click();
    await __th.wait(() => document.body.classList.contains('nav-drawer-open'), 'drawer');
    document.querySelector('#mobile-nav-drawer [data-trouble-open]').click();
  } else {
    document.querySelector('.chat-sidebar-desktop [data-trouble-open]').click();
  }
  await __th.wait(() => __th.ws() && __th.view(), 'workspace');
  const back = __th.ws().querySelector('.site-modal-close');
  return {drawerOpen: document.body.classList.contains('nav-drawer-open'), hash: location.hash,
    header: __th.ws().querySelector('.site-modal-header h2')?.textContent || '',
    back: {text: back?.textContent || '', aria: back?.getAttribute('aria-label') || '', after: back ? getComputedStyle(back, '::after').content : ''},
    current: [...document.querySelectorAll('[data-trouble-open]')].map(n => n.getAttribute('aria-current') || ''),
    dialogs: document.querySelectorAll('dialog[open]').length,
    overlay: document.body.classList.contains('site-overlay-open'),
    workspace: document.body.classList.contains('site-workspace-open'),
    role: __th.ws().querySelector('.site-modal')?.getAttribute('role') || ''};
})()`;

function startServer() {
  const serverCode = `
    const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
    const root=${JSON.stringify(ROOT)};
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
    const server=http.createServer((req,res)=>{
      const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
      const target=path.resolve(root,'.'+pathname);
      if(!target.startsWith(root)){res.writeHead(403);res.end();return;}
      fs.readFile(target,(error,data)=>{if(error){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream'});res.end(data);});
    });
    server.listen(0,'127.0.0.1',()=>process.stdout.write(String(server.address().port)+'\\n'));
  `;
  return spawn(process.execPath, ['-e', serverCode], {cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit']});
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(fn, label, timeoutMs = 20000) {
  const started = Date.now();
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - started > timeoutMs) throw new Error(`timeout: ${label}`);
    await sleep(100);
  }
}

async function openBrowser(browser, profile) {
  const chrome = spawn(browser, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--window-size=1280,900', 'about:blank'], {stdio: 'ignore'});
  const portFile = path.join(profile, 'DevToolsActivePort');
  await waitFor(() => fs.existsSync(portFile) && fs.readFileSync(portFile, 'utf8').includes('\n'), 'DevToolsActivePort');
  const [port] = fs.readFileSync(portFile, 'utf8').split(/\r?\n/);
  const version = await waitFor(() => fetch(`http://127.0.0.1:${port}/json/version`).then(r => r.json()).catch(() => null), 'browser endpoint');
  const socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let nextId = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(String(event.data));
    if (message.id && pending.has(message.id)) {
      const {resolve, reject} = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
    }
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    nextId += 1;
    pending.set(nextId, {resolve, reject});
    socket.send(JSON.stringify({id: nextId, method, params, ...(sessionId ? {sessionId} : {})}));
  });
  return {send, close: () => { try { socket.close(); } catch {} chrome.kill('SIGTERM'); }};
}

async function withPage(browser, dir, testCase, url, run) {
  const profile = fs.mkdtempSync(path.join(dir, 'profile-'));
  const cdp = await openBrowser(browser, profile);
  try {
    const {targetInfos} = await cdp.send('Target.getTargets');
    const pageTarget = targetInfos.find(item => item.type === 'page');
    const {sessionId} = await cdp.send('Target.attachToTarget', {targetId: pageTarget.targetId, flatten: true});
    const page = (method, params) => cdp.send(method, params, sessionId);
    const evaluate = async expression => {
      const result = await page('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
      if (result.exceptionDetails) throw new Error(`${testCase.label}: ${JSON.stringify(result.exceptionDetails).slice(0, 2000)}`);
      return result.result.value;
    };
    const ready = async () => {
      const text = await waitFor(async () => {
        const value = await evaluate("document.getElementById('th-result')?.textContent || 'pending'").catch(() => 'pending');
        return value !== 'pending' ? value : null;
      }, `${testCase.label}: harness`, 60000);
      const parsed = JSON.parse(text);
      if (!parsed.ok) throw new Error(`${testCase.label}: ${parsed.error}`);
      await evaluate(HELPERS);
    };
    await page('Page.enable');
    await page('Runtime.enable');
    await page('Emulation.setDeviceMetricsOverride', {width: testCase.width, height: testCase.height, deviceScaleFactor: 1, mobile: testCase.mobile});
    await page('Emulation.setUserAgentOverride', {userAgent: testCase.userAgent});
    if (testCase.mobile) await page('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
    await page('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});
    await page('Page.navigate', {url});
    await ready();
    const shoot = async name => {
      const target = process.env.TROUBLE_HELPER_SCREENSHOT_DIR || '';
      if (!target || !testCase.shots) return;
      fs.mkdirSync(target, {recursive: true});
      const {data} = await page('Page.captureScreenshot', {format: 'png'});
      fs.writeFileSync(path.join(target, `${testCase.label}-${name}.png`), Buffer.from(data, 'base64'));
    };
    return await run({page, evaluate, ready, shoot});
  } finally {
    cdp.close();
  }
}

const themed = async (evaluate, shoot, name) => {
  const out = {};
  for (const mode of ['light', 'dark']) {
    await evaluate(`document.body.dataset.siteTheme = '${mode}'; new Promise(r => setTimeout(() => r(true), 60))`);
    out[mode] = await evaluate('__th.contrasts()');
    await shoot(`${name}-${mode}`);
  }
  await evaluate("document.body.dataset.siteTheme = 'light'; true");
  return out;
};

async function runFlow(browser, origin, dir, testCase) {
  return withPage(browser, dir, testCase, `${origin}/scripts/${path.basename(dir)}/inner.html`, async ({page, evaluate, ready, shoot}) => {
    const r = {};
    r.menus = await evaluate(`[...document.querySelectorAll('[data-trouble-open]')].map(n => ({inDrawer: Boolean(n.closest('#mobile-nav-drawer')),
      prev: n.previousElementSibling?.getAttribute('aria-label'), label: n.textContent.trim()}))`);
    r.bootLoaded = await evaluate('globalThis.__thBootLoaded');
    r.open = await evaluate(OPEN(testCase.mobile));

    // ⓪ 무슨 일이 있으셨나요?
    r.hub = await evaluate(`(async () => {
      const v = await __th.onView('hub');
      await __th.sleep(60);
      return {
        situations: [...v.querySelectorAll('[data-trouble-situation]')].map(n => [n.dataset.troubleSituation, n.querySelector('strong').textContent, n.querySelector('.trouble-cat-sub')?.textContent || '']),
        title: v.querySelector('[data-trouble-heading]').textContent,
        notice: v.querySelector('[data-trouble-notice]')?.textContent || '',
        login: /로그인/.test(__th.pageText()),
        calls: globalThis.__thCalls, measure: __th.measure(), focus: document.activeElement?.matches('[data-trouble-heading]') || false,
        backControl: Boolean(v.querySelector('[data-subview-back]')),
      };
    })()`);
    r.hubThemes = await themed(evaluate, shoot, 'hub');

    // ① 자동차 사고 — the first screen.
    r.start = await evaluate(`(async () => {
      __th.click('[data-trouble-situation="CAR_ACCIDENT"]');
      const v = await __th.onView('start');
      await __th.sleep(60);
      const emergency = v.querySelector('[data-trouble-emergency]');
      return {
        chip: v.querySelector('[data-trouble-chip]')?.textContent || '',
        emergency: emergency ? {text: emergency.querySelector('.trouble-emergency-text').textContent,
          calls: [...emergency.querySelectorAll('[data-trouble-quick-call]')].map(a => [a.getAttribute('href'), a.textContent, a.getAttribute('aria-label')])} : null,
        title: v.querySelector('[data-trouble-heading]').textContent,
        tap: v.querySelector('[data-trouble-start-ask]')?.textContent || '',
        direct: v.querySelector('[data-trouble-direct]')?.textContent || '',
        inputs: [...v.querySelectorAll('input, textarea, [type=file]')].length,
        first: __th.firstScreen(['[data-trouble-start-ask]', '[data-trouble-direct]']),
        focus: document.activeElement?.matches('[data-trouble-heading]') || false,
        backControl: Boolean(v.querySelector('[data-subview-back]')),
        hash: location.hash, measure: __th.measure(),
      };
    })()`);
    r.startThemes = await themed(evaluate, shoot, 'start');

    // ② one question per screen.
    r.ask = await evaluate(`(async () => {
      __th.click('[data-trouble-start-ask]');
      const v = await __th.onView('ask');
      await __th.sleep(60);
      const read = () => { const w = __th.view(); return {
        question: __th.asked(), eyebrow: w.querySelector('.trouble-eyebrow')?.textContent || '', title: w.querySelector('[data-trouble-heading]')?.textContent || '',
        options: [...w.querySelectorAll('[data-trouble-option]')].map(n => n.dataset.troubleOption), skip: Boolean(w.querySelector('[data-trouble-skip]')),
        emergency: Boolean(w.querySelector('[data-trouble-emergency]')), stop: w.querySelector('[data-trouble-to-result]')?.textContent || '',
        given: __th.given(), counter: /\\d+\\s*\\/\\s*\\d+/.test(w.textContent) }; };
      const out = {first: read(), firstScreen: __th.firstScreen(['[data-trouble-option="unknown"]', '[data-trouble-to-result]']), measure: __th.measure()};
      await __th.answer('injury', 'no');
      out.second = read();
      await __th.skip('other');
      out.third = read();
      await __th.answer('place', 'intersection');
      out.fourth = read();
      await __th.answer('signal', 'yes');
      out.fifth = read();
      out.fifthMeasure = __th.measure();
      return out;
    })()`);
    await shoot('ask-my-move');
    r.askThemes = await themed(evaluate, shoot, 'ask');
    r.result = await evaluate(`(async () => {
      await __th.answer('my_move', 'straight');
      const v = await __th.onView('result');
      await __th.sleep(80);
      const card = id => { const n = v.querySelector('[data-trouble-card="' + id + '"]'); return {title: n.querySelector('h4').textContent, line: n.querySelector('.trouble-card-line').textContent,
        more: n.querySelector('[data-trouble-more]').textContent, expanded: n.querySelector('[data-trouble-more]').getAttribute('aria-expanded'), open: n.dataset.open}; };
      return {
        cards: [...v.querySelectorAll('[data-trouble-card]')].map(n => n.dataset.troubleCard),
        todo: card('todo'), keep: card('keep'), help: card('help'),
        main: [...v.querySelectorAll('[data-trouble-main-route]')].map(a => [a.dataset.troubleMainRoute, a.getAttribute('href'), a.textContent]),
        title: v.querySelector('[data-trouble-heading]').textContent,
        notice: v.querySelector('[data-trouble-situation-notice]')?.textContent || '',
        emergency: v.querySelector('[data-trouble-emergency] .trouble-emergency-text')?.textContent || '',
        given: __th.given(),
        script: [...v.querySelectorAll('[data-trouble-call-script] li')].map(n => n.textContent),
        disclaimer: v.querySelector('[data-trouble-disclaimer]')?.textContent || '',
        sheetEntry: v.querySelector('[data-trouble-open-summary]')?.textContent || '',
        first: __th.firstScreen(['[data-trouble-card="todo"] h4', '[data-trouble-card="keep"] h4', '[data-trouble-card="help"] h4']),
        views: [...new Set(window.__thViews)], measure: __th.measure(),
      };
    })()`);
    await shoot('result');
    r.resultThemes = await themed(evaluate, shoot, 'result');

    // ③ the cards open in place.
    r.cards = await evaluate(`(async () => {
      const v = __th.view();
      const out = {};
      __th.click('[data-trouble-more="todo"]');
      await __th.sleep(60);
      const todo = __th.view().querySelector('[data-trouble-card="todo"]');
      out.todo = {open: todo.dataset.open, expanded: todo.querySelector('[data-trouble-more]').getAttribute('aria-expanded'),
        focus: document.activeElement?.dataset.troubleMore || '',
        steps: [...todo.querySelectorAll('[data-trouble-step]')].map(n => n.dataset.troubleStep),
        urgent: [...todo.querySelectorAll('[data-trouble-step][data-urgent="true"]')].map(n => n.dataset.troubleStep),
        portal: {order: todo.querySelector('[data-trouble-portal-order]')?.textContent || '', hint: Boolean(todo.querySelector('[data-trouble-portal-hint]')),
          select: todo.querySelector('[data-trouble-portal-select]')?.getAttribute('href') || '', sentence: Boolean(todo.querySelector('[data-trouble-portal-sentence]'))},
        insurer: todo.querySelector('[data-trouble-step="insurer"]')?.textContent || '',
        call112: [...todo.querySelectorAll('[data-trouble-step="call_112"] a[href^="tel:"]')].map(a => a.getAttribute('href'))};
      todo.querySelector('[data-trouble-step-done="stay_safe"]').click();
      await __th.sleep(30);
      out.todo.doneSaved = JSON.parse(localStorage.getItem('lotbi.site.ux.v1.trouble-helper')).cases.CAR_ACCIDENT.done;
      __th.click('[data-trouble-more="keep"]');
      await __th.sleep(60);
      const keep = __th.view().querySelector('[data-trouble-card="keep"]');
      out.keep = {open: keep.dataset.open, evidence: [...keep.querySelectorAll('[data-trouble-evidence]')].map(n => n.dataset.troubleEvidence),
        references: keep.querySelectorAll('[data-trouble-reference]').length};
      keep.querySelector('[data-trouble-evidence]').click();
      __th.click('[data-trouble-more="help"]');
      await __th.sleep(60);
      const help = __th.view().querySelector('[data-trouble-card="help"]');
      out.help = {open: help.dataset.open, channels: [...help.querySelectorAll('[data-trouble-channel]')].map(n => n.dataset.troubleChannel),
        verified: help.querySelectorAll('[data-trouble-verified]').length, fees: [...help.querySelectorAll('[data-trouble-fees]')].map(n => n.textContent)};
      out.allOpen = __th.measure();
      out.first = __th.firstScreen(['[data-trouble-card="todo"] h4']);
      return out;
    })()`);
    await shoot('result-open');
    r.openThemes = await themed(evaluate, shoot, 'result-open');
    // Linux gate fonts are narrower than Windows ones: with every glyph 3px
    // narrower, no button on the result may drop under 48px.
    r.narrowGlyphs = await evaluate(`(async () => {
      const style = document.createElement('style');
      style.textContent = '[data-trouble-page] * { letter-spacing: -3px !important; }';
      document.head.append(style);
      await __th.sleep(40);
      const small = [...__th.ws().querySelectorAll('.trouble-button, .trouble-more, .trouble-change, .trouble-link, .trouble-check, a[href]')]
        .filter(__th.visible).filter(n => !n.closest('.trouble-sr, .trouble-subview-back')).filter(n => { const r = n.getBoundingClientRect(); return r.width < 47.5 || r.height < 47.5; })
        .map(n => (n.className || n.tagName) + ':' + Math.round(n.getBoundingClientRect().width) + 'x' + Math.round(n.getBoundingClientRect().height) + ':' + n.textContent.trim().slice(0, 10));
      style.remove();
      await __th.sleep(40);
      return small;
    })()`);

    // ④ 상황 정리표.
    r.summary = await evaluate(`(async () => {
      __th.click('[data-trouble-open-summary]');
      const v = await __th.onView('summary');
      await __th.sleep(300);
      const out = {
        tools: [...v.querySelectorAll('[data-trouble-tools] button')].map(n => n.textContent),
        answers: [...v.querySelectorAll('[data-trouble-sheet-answers] li')].map(n => n.textContent),
        done: [...v.querySelectorAll('.trouble-sheet-list li')].map(n => n.textContent),
        fields: [...v.querySelectorAll('[data-trouble-field]')].map(n => n.dataset.troubleField),
        locked: v.querySelector('[data-trouble-status-choice="SUBMITTED"]').disabled,
        hint: !v.querySelector('[data-trouble-receipt-hint]').hidden,
        safety: [...v.querySelectorAll('[data-trouble-safety] li')].map(n => n.textContent),
        disclaimer: Boolean(v.querySelector('[data-trouble-disclaimer]')),
        first: __th.firstScreen(['[data-trouble-tools]']),
        measure: __th.measure(),
      };
      const receipt = v.querySelector('[data-trouble-field="receipt"]');
      receipt.value = '2026-77';
      receipt.dispatchEvent(new Event('input', {bubbles: true}));
      out.unlocked = !v.querySelector('[data-trouble-status-choice="SUBMITTED"]').disabled;
      __th.click('[data-trouble-print]');
      await __th.sleep(30);
      out.prints = globalThis.__thPrints;
      __th.click('[data-trouble-share]');
      await __th.wait(() => globalThis.__thShares.length, 'share');
      out.share = globalThis.__thShares[0];
      __th.click('[data-trouble-save]');
      await __th.sleep(30);
      out.status = __th.ws().querySelector('[data-trouble-status]').textContent;
      out.stored = JSON.parse(localStorage.getItem('lotbi.site.ux.v1.trouble-helper')).cases.CAR_ACCIDENT;
      return out;
    })()`);
    await shoot('summary');
    r.summaryThemes = await themed(evaluate, shoot, 'summary');

    // ← steps back one screen at a time; the phone's back does the same.
    r.back = await evaluate(`(async () => {
      const out = {};
      __th.ws().querySelector('.site-modal-close').click();
      await __th.onView('result', 'header back → result');
      out.afterHeaderBack = __th.view().dataset.troubleView;
      out.hash = location.hash;
      history.back();
      await __th.wait(() => __th.asked() === 'my_move', 'phone back → last question');
      out.afterPhoneBack = __th.asked();
      __th.click('[data-trouble-to-result]');
      await __th.onView('result');
      __th.click('[data-trouble-pick]');
      await __th.onView('hub');
      out.hub = __th.view().dataset.troubleView;
      out.resume = [...__th.view().querySelectorAll('.trouble-resume')].map(n => n.closest('[data-trouble-situation]').dataset.troubleSituation);
      return out;
    })()`);

    // 중고거래 사기: the emergency line, every step while nothing is answered,
    // and the 사기·피싱 확인 link hands over (the page closes).
    r.fraud = await evaluate(`(async () => {
      __th.click('[data-trouble-situation="USED_TRADE_FRAUD"]');
      let v = await __th.onView('start');
      const out = {emergency: v.querySelector('[data-trouble-emergency] .trouble-emergency-text')?.textContent || '',
        calls: [...v.querySelectorAll('[data-trouble-quick-call]')].map(a => a.getAttribute('href'))};
      __th.click('[data-trouble-direct]');
      v = await __th.onView('result');
      out.todoTitle = v.querySelector('[data-trouble-card="todo"] .trouble-card-lead')?.textContent || '';
      out.main = v.querySelector('[data-trouble-main-route]')?.getAttribute('href') || '';
      out.toldEmpty = Boolean(v.querySelector('.trouble-given-empty'));
      __th.click('[data-trouble-more="todo"]');
      await __th.sleep(60);
      out.steps = [...__th.view().querySelectorAll('[data-trouble-step]')].map(n => n.dataset.troubleStep);
      out.measure = __th.measure();
      __th.click('[data-trouble-scam-shield]');
      await __th.wait(() => !__th.ws(), 'page closed for 사기·피싱 확인');
      await __th.sleep(200);
      out.scamOpen = Boolean(document.querySelector('dialog.scam-dialog[open], [data-scam-dialog][open]'));
      out.hash = location.hash;
      return out;
    })()`);

    // 그 밖의 법률 고민: no emergency line, 잘 모르겠어요 added, goto 월급 못 받음.
    await evaluate("(async () => { document.querySelectorAll('dialog[open]').forEach(d => d.close()); await __th.sleep(300); return true; })()");
    r.reopen = await evaluate(OPEN(testCase.mobile));
    r.other = await evaluate(`(async () => {
      await __th.onView('hub');
      __th.click('[data-trouble-situation="OTHER_LEGAL"]');
      let v = await __th.onView('start');
      const out = {emergency: Boolean(v.querySelector('[data-trouble-emergency]'))};
      __th.click('[data-trouble-start-ask]');
      v = await __th.onView('ask');
      out.question = __th.asked();
      out.skip = Boolean(v.querySelector('[data-trouble-skip]'));
      await __th.answer('topic', 'work');
      v = await __th.onView('result');
      __th.click('[data-trouble-more="todo"]');
      await __th.sleep(60);
      out.steps = [...__th.view().querySelectorAll('[data-trouble-step]')].map(n => n.dataset.troubleStep);
      __th.click('[data-trouble-goto="WAGE_ARREARS"]');
      v = await __th.onView('start');
      out.gotoChip = v.querySelector('[data-trouble-chip]')?.textContent || '';
      out.wageEmergency = Boolean(v.querySelector('[data-trouble-emergency]'));
      out.measure = __th.measure();
      return out;
    })()`);
    r.noise = await evaluate(`(async () => {
      if (__th.view()?.dataset.troubleView !== 'hub') { __th.ws().querySelector('.site-modal-close').click(); await __th.onView('hub'); }
      __th.click('[data-trouble-situation="FLOOR_NOISE"]');
      const v = await __th.onView('start');
      return {emergency: v.querySelector('[data-trouble-emergency] .trouble-emergency-text')?.textContent || '',
        calls: [...v.querySelectorAll('[data-trouble-quick-call]')].map(a => a.getAttribute('href'))};
    })()`);

    // A reload on #trouble reopens the page on the screen it was on.
    r.reload = await evaluate(`(async () => {
      __th.click('[data-trouble-direct]');
      await __th.onView('result');
      __th.click('[data-trouble-open-summary]');
      await __th.onView('summary');
      await __th.sleep(450);
      return location.hash;
    })()`);
    await page('Page.reload', {});
    await ready();
    r.reloaded = await evaluate(`(async () => {
      await __th.wait(() => __th.view()?.dataset.troubleView === 'summary', 'reopened on the 정리표');
      return {view: __th.view().dataset.troubleView, chip: __th.view().querySelector('[data-trouble-chip]')?.textContent || '', hash: location.hash,
        bootLoaded: globalThis.__thBootLoaded, workspace: document.body.classList.contains('site-workspace-open')};
    })()`);
    // From its first screen, ← leaves the page for the conversation.
    r.close = await evaluate(`(async () => {
      for (let i = 0; i < 6 && __th.ws() && __th.view()?.dataset.troubleView !== 'hub'; i += 1) {
        __th.ws().querySelector('.site-modal-close').click();
        await __th.sleep(250);
      }
      await __th.onView('hub');
      __th.ws().querySelector('.site-modal-close').click();
      await __th.wait(() => !__th.ws(), 'page left');
      await __th.sleep(200);
      return {hash: location.hash, workspace: document.body.classList.contains('site-workspace-open'),
        current: [...document.querySelectorAll('[data-trouble-open]')].map(n => n.getAttribute('aria-current') || '')};
    })()`);
    r.troubleRequests = await evaluate("globalThis.__thRequests.filter(item => item.trouble).map(item => [item.path, item.credentials, item.authorization])");
    return r;
  });
}

async function runFailure(browser, origin, dir, testCase) {
  return withPage(browser, dir, testCase, `${origin}/scripts/${path.basename(dir)}/fail.html`, async ({evaluate, shoot}) => {
    await evaluate(OPEN(testCase.mobile));
    const r = await evaluate(`(async () => {
      await __th.wait(() => __th.view()?.dataset.troubleView === 'error', 'error view');
      const v = __th.view();
      return {text: v.querySelector('[data-trouble-failure]').textContent,
        calls: [...v.querySelectorAll('[data-trouble-fallback-call]')].map(a => [a.getAttribute('href'), a.textContent, Math.round(a.getBoundingClientRect().height)]),
        retry: Boolean(v.querySelector('[data-trouble-retry]')), measure: __th.measure(), requests: globalThis.__thCalls.length};
    })()`);
    await shoot('failure');
    r.themes = await themed(evaluate, shoot, 'failure');
    r.retried = await evaluate(`(async () => { __th.click('[data-trouble-retry]'); await __th.wait(() => globalThis.__thCalls.length >= 2, 'retry'); await __th.wait(() => __th.view().dataset.troubleView === 'error', 'error again'); return globalThis.__thCalls.length; })()`);
    return r;
  });
}

// Signed in (a session mounted as auth/callback does): the menu opens the same
// page, the same flow runs, and what the helper sends to Core is no more than
// signed out — public reads only, never the session.
async function runSigned(browser, origin, dir, testCase) {
  return withPage(browser, dir, testCase, `${origin}/scripts/${path.basename(dir)}/signed.html`, async ({evaluate, shoot}) => {
    const r = {};
    r.boot = await evaluate(`(async () => {
      await __th.wait(() => (globalThis.__thRequests || []).some(item => item.path === '/v2/me'), 'signed-in /v2/me');
      await __th.sleep(400);
      return {auth: document.body.dataset.siteAuthState, me: globalThis.__thRequests.filter(item => item.path === '/v2/me').map(item => item.authorization),
        bootLoaded: globalThis.__thBootLoaded, troubleAtBoot: globalThis.__thRequests.filter(item => item.trouble).length};
    })()`);
    r.open = await evaluate(OPEN(testCase.mobile));
    r.flow = await evaluate(`(async () => {
      await __th.onView('hub');
      const hub = [...__th.view().querySelectorAll('[data-trouble-situation]')].map(n => n.dataset.troubleSituation);
      const login = /로그인/.test(__th.pageText());
      __th.click('[data-trouble-situation="CAR_ACCIDENT"]');
      await __th.onView('start');
      __th.click('[data-trouble-direct]');
      const v = await __th.onView('result');
      await __th.sleep(60);
      const out = {hub, login, cards: [...v.querySelectorAll('[data-trouble-card]')].map(n => n.dataset.troubleCard),
        first: __th.firstScreen(['[data-trouble-card="todo"] h4', '[data-trouble-card="keep"] h4', '[data-trouble-card="help"] h4'])};
      __th.click('[data-trouble-open-summary]');
      await __th.onView('summary');
      await __th.sleep(500);
      out.measure = __th.measure();
      out.trouble = globalThis.__thRequests.filter(item => item.trouble).map(item => ({origin: item.origin, path: item.path, credentials: item.credentials, authorization: item.authorization}));
      out.guideCalls = globalThis.__thCalls;
      return out;
    })()`);
    await shoot('summary');
    return r;
  });
}

async function serverPort(child) {
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('local server start timeout')), 5000);
    child.once('error', reject);
    child.stdout.once('data', chunk => { clearTimeout(timer); resolve(Number.parseInt(String(chunk).trim(), 10)); });
  });
}

const assertReadable = (themes, label) => {
  for (const [mode, values] of Object.entries(themes)) {
    for (const [key, value] of Object.entries(values)) assert.ok(value.value >= 4.5, `${label} ${mode} ${key} contrast ${JSON.stringify(value)}`);
  }
};
// Older readers: no sideways scroll, text ≥ 18px, every target ≥ 48px, main
// buttons ≥ 56px, the title 30px on a phone and 36px on a wide screen; a
// page in the workspace, never a dialog or a dimmed overlay.
const assertElderly = (m, label, testCase) => {
  assert.deepEqual(m.stray, [], `${label}: stray text`);
  assert.deepEqual(m.overflow, [], `${label}: overflow`);
  assert.ok(m.page <= 0, `${label}: page scrolls sideways by ${m.page}`);
  assert.ok(m.wsScroll <= 0, `${label}: workspace scrolls sideways by ${m.wsScroll}`);
  assert.deepEqual(m.small, [], `${label}: targets under 48px`);
  assert.deepEqual(m.mainSmall, [], `${label}: main buttons too small`);
  assert.deepEqual(m.smallText, [], `${label}: text under 18px`);
  if (m.heading) assert.equal(m.heading, testCase.wide ? 36 : 30, `${label}: title ${m.heading}`);
  assert.equal(m.dialogs, 0, `${label}: no dialog`);
  assert.equal(m.overlay, false, `${label}: no overlay`);
  assert.equal(m.workspace, true, `${label}: a workspace page`);
};
const assertInside = (first, selectors, label) => {
  assert.equal(first.scrolled, 0, `${label}: nothing scrolled`);
  for (const selector of selectors) assert.ok(first[selector]?.inside, `${label}: ${selector} on the first screen ${JSON.stringify(first)}`);
};

const PUBLIC_PATHS = ['/v2/trouble-helper/guides', '/app/config.json'];
const VIEWS = ['loading', 'hub', 'start', 'ask', 'result', 'summary'];
const CAR_TITLES = FIXTURE.situations.map(item => [item.id, item.title, item.subtitle]);

const browser = browserPath();
const dir = fs.mkdtempSync(path.join(ROOT, 'scripts/.validate-trouble-helper-01-'));
const server = startServer();
try {
  fs.writeFileSync(path.join(dir, 'inner.html'), buildInner('ok'), 'utf8');
  fs.writeFileSync(path.join(dir, 'fail.html'), buildInner('fail'), 'utf8');
  fs.writeFileSync(path.join(dir, 'signed.html'), buildInner('signed'), 'utf8');
  const guestTroublePaths = [];
  const port = await serverPort(server);
  const origin = `http://127.0.0.1:${port}`;
  for (const testCase of CASES) {
    const label = testCase.label;
    const r = await runFlow(browser, origin, dir, testCase);
    await check(`${label}: both menus open a page (workspace #trouble, ← 뒤로, no dialog, no ×, no overlay) without a login`, () => {
      assert.deepEqual(r.menus.map(m => [m.inDrawer, m.prev, m.label]), [[false, '사기·피싱 확인', '분쟁·사고 도우미'], [true, '사기·피싱 확인', '분쟁·사고 도우미']]);
      assert.equal(r.bootLoaded, false, 'site-trouble-helper.js is not fetched at boot (SITE-T55 gate)');
      assert.equal(r.open.drawerOpen, false, 'the mobile drawer closes');
      assert.equal(r.open.hash, '#trouble');
      assert.equal(r.open.header, '분쟁·사고 도우미');
      assert.equal(r.open.back.text, '←');
      assert.equal(r.open.back.aria, '대화로 돌아가기');
      assert.equal(r.open.back.after, '"뒤로"');
      assert.ok(r.open.current.includes('page'), 'the menu entry is the current page');
      assert.equal(r.open.dialogs, 0);
      assert.equal(r.open.overlay, false);
      assert.equal(r.open.workspace, true);
      assert.equal(r.open.role, 'region');
      assert.deepEqual(r.hub.calls, [{url: 'https://api.lotbiai.com/v2/trouble-helper/guides', method: 'GET', credentials: 'omit', mode: 'cors', headers: []}]);
      assert.equal(r.hub.login, false);
    });
    await check(`${label}: ⓪ 무슨 일이 있으셨나요? — five situations in Core's order, the notice, large and readable`, () => {
      assert.equal(r.hub.title, '무슨 일이 있으셨나요?');
      assert.deepEqual(r.hub.situations, CAR_TITLES);
      assert.equal(r.hub.notice, FIXTURE.notice);
      assert.equal(r.hub.focus, true);
      assert.equal(r.hub.backControl, false, 'from the first screen ← leaves the page');
      assertElderly(r.hub.measure, `${label} hub`, testCase);
      assertReadable(r.hubThemes, `${label} hub`);
    });
    await check(`${label}: ① 자동차 사고 first screen — 눌러서 답하기, 바로 도움받기 on the first screen, no emergency line, no other input`, () => {
      assert.equal(r.start.chip, '자동차 사고');
      assert.equal(r.start.emergency, null, 'no emergency-number line (owner: 삭제해)');
      assert.equal(r.start.title, '무슨 일이 있으셨나요?');
      assert.equal(r.start.tap, '눌러서 답하기질문에 버튼만 누르면 돼요');
      assert.equal(r.start.direct, '바로 도움받기');
      assert.equal(r.start.inputs, 0, 'no photo, text or voice input');
      assert.equal(r.start.focus, true);
      assert.equal(r.start.backControl, true);
      assert.equal(r.start.hash, '#trouble');
      assertInside(r.start.first, ['[data-trouble-start-ask]', '[data-trouble-direct]'], `${label} start`);
      assertElderly(r.start.measure, `${label} start`, testCase);
      assertReadable(r.startThemes, `${label} start`);
    });
    await check(`${label}: ② one question per screen — the guide's answers, 잘 모르겠어요 everywhere, a skip never asks again, no counter`, () => {
      assert.deepEqual(r.ask.first, {question: 'injury', eyebrow: '하나씩 여쭤볼게요', title: '다친 사람이 있나요?', options: ['yes', 'no', 'unknown'], skip: false,
        emergency: false, stop: '질문 그만하고 결과 보기', given: [], counter: false}, 'the emergency line stays on the first screen and the result');
      assertInside(r.ask.firstScreen, testCase.height >= 800 ? ['[data-trouble-option="unknown"]', '[data-trouble-to-result]'] : ['[data-trouble-option="unknown"]'], `${label} ask`);
      assertElderly(r.ask.measure, `${label} ask`, testCase);
      assert.equal(r.ask.second.question, 'other');
      assert.equal(r.ask.second.eyebrow, '한 가지만 더 알려주세요');
      assert.equal(r.ask.second.skip, true, '무엇과 부딪혔나요 has no 잘 모르겠어요 of its own');
      assert.equal(r.ask.second.emergency, false);
      assert.deepEqual(r.ask.second.given, [['다친 사람이 있나요?', '없어요', 'injury']]);
      assert.equal(r.ask.third.question, 'place', 'skipped: not asked again');
      assert.equal(r.ask.fourth.question, 'signal', '교차로 brings 신호등');
      assert.equal(r.ask.fifth.question, 'my_move');
      assert.equal(r.ask.fifth.counter, false);
      assert.deepEqual(r.ask.fifth.given.map(row => row[2]), ['injury', 'place', 'signal']);
      assertElderly(r.ask.fifthMeasure, `${label} ask my_move`, testCase);
      assertReadable(r.askThemes, `${label} ask`);
    });
    await check(`${label}: ③ 이렇게 하세요 — 지금 할 일 · 챙길 것 · 도움받을 곳${testCase.cards ? ' on the first screen' : ''}, lines from the guide, 참고용 sentence`, () => {
      assert.deepEqual(r.result.cards, ['todo', 'keep', 'help']);
      assert.equal(r.result.title, '이렇게 하세요');
      assert.equal(r.result.notice, FIXTURE.situations[0].notice);
      assert.equal(r.result.emergency, '', 'no emergency-number line');
      assert.deepEqual([r.result.todo.title, r.result.keep.title, r.result.help.title], ['지금 할 일', '챙길 것', '도움받을 곳']);
      assert.equal(r.result.todo.line, '더 큰 사고 막기비상등을 켜고 삼각대나 불꽃신호기를 세우세요.', '없어요: 119 is not the lead');
      assert.equal(r.result.keep.line, '블랙박스 원본 영상 등 5가지지우지 말고 모아 두세요.');
      assert.equal(r.result.help.line, '내 보험사 사고 접수, 과실비율정보포털에 물어볼 수 있어요.');
      assert.deepEqual(r.result.main, [['KNIA_PORTAL', 'tel:0237028500', '과실비율정보포털 전화 02-3702-8500']]);
      for (const id of ['todo', 'keep', 'help']) assert.deepEqual([r.result[id].more, r.result[id].expanded, r.result[id].open], ['자세히', 'false', 'false']);
      assert.deepEqual(r.result.given.map(row => [row[1], row[2]]), [['없어요', 'injury'], ['교차로(사거리·삼거리)', 'place'], ['있었어요', 'signal'], ['곧게 가고 있었어요', 'my_move']]);
      assert.deepEqual(r.result.script, FIXTURE.situations[0].call_script);
      assert.equal(r.result.disclaimer, `${FIXTURE.situations[0].notice}LOTBI의 결과는 참고용이며 법률·보험·수리비의 최종 판단이 아닙니다.신고·전화·접수는 직접 하셔야 해요. LOTBI가 대신 보내지 않아요.`);
      assert.equal(r.result.sheetEntry, '상황 정리표적어 두고 인쇄하거나 카카오로 보내요');
      if (testCase.cards) assertInside(r.result.first, ['[data-trouble-card="todo"] h4', '[data-trouble-card="keep"] h4', '[data-trouble-card="help"] h4'], `${label} result`);
      else assertInside(r.result.first, ['[data-trouble-card="todo"] h4'], `${label} result`);
      assert.ok(r.result.views.every(view => VIEWS.includes(view)), String(r.result.views));
      assertElderly(r.result.measure, `${label} result`, testCase);
      assertReadable(r.resultThemes, `${label} result`);
      assert.doesNotMatch(JSON.stringify(r.result), RATIO_RE, 'no ratio-looking number');
    });
    await check(`${label}: ③ cards open in place — steps (했어요 saved), 과실비율정보포털, evidence, channels; 48px even with narrow glyphs`, () => {
      assert.deepEqual([r.cards.todo.open, r.cards.todo.expanded, r.cards.todo.focus], ['true', 'true', 'todo']);
      assert.deepEqual(r.cards.todo.steps, ['stay_safe', 'call_112', 'photos', 'blackbox', 'insurer', 'fault_reference'], '없어요: no 119 step');
      assert.deepEqual(r.cards.todo.urgent, ['stay_safe']);
      assert.deepEqual(r.cards.todo.call112, ['tel:112']);
      assert.deepEqual(r.cards.todo.portal, {order: '교차로', hint: false, select: FIXTURE.situations[0].fault_portal.select_url, sentence: true},
        '무엇과 부딪혔나요 skipped: the order as far as answered; 신호등 and 내 차 make the sentence');
      assert.deepEqual(r.cards.todo.doneSaved, {stay_safe: true});
      assert.deepEqual(r.cards.keep.evidence, FIXTURE.situations[0].evidence.map(item => item.id));
      assert.equal(r.cards.keep.open, 'true');
      assert.deepEqual(r.cards.help.channels, FIXTURE.situations[0].channel_ids);
      assert.ok(r.cards.help.verified >= 1);
      assertElderly(r.cards.allOpen, `${label} result open`, testCase);
      assertReadable(r.openThemes, `${label} result open`);
      assert.deepEqual(r.narrowGlyphs, [], `${label}: under 48px with narrow glyphs`);
    });
    await check(`${label}: ④ 상황 정리표 — tools on top, answers, 접수번호 lock, print sheet, share, saved on the device`, () => {
      assert.deepEqual(r.summary.tools, ['휴대폰에 저장', '인쇄', '카카오로 보내기']);
      assertInside(r.summary.first, ['[data-trouble-tools]'], `${label} summary`);
      assert.deepEqual(r.summary.fields, FIXTURE.situations[0].summary_fields.map(item => item.id));
      assert.equal(r.summary.locked, true);
      assert.equal(r.summary.hint, true);
      assert.equal(r.summary.unlocked, true);
      assert.equal(r.summary.prints.length, 1);
      assert.equal(r.summary.prints[0].printing, true);
      assert.match(r.summary.prints[0].sheet, /자동차 사고/u);
      assert.match(r.summary.prints[0].sheet, /LOTBI의 결과는 참고용이며/u);
      assert.equal(r.summary.share.title, '막막할 때 롯비 · 자동차 사고 상황 정리표');
      assert.ok(r.summary.share.text.slice(0, 200).includes('접수번호: 2026-77'));
      assert.match(r.summary.status, /이 휴대폰에 저장했어요/u);
      assert.equal(r.summary.stored.fields.receipt, '2026-77');
      assert.equal(r.summary.stored.view, 'summary');
      assert.deepEqual(r.summary.safety, FIXTURE.safety_notes);
      assert.equal(r.summary.disclaimer, true);
      assertElderly(r.summary.measure, `${label} summary`, testCase);
      assertReadable(r.summaryThemes, `${label} summary`);
    });
    await check(`${label}: ← and the phone back step one screen at a time; 다른 상황 고르기; a reload reopens the 정리표; ← from the first screen leaves`, () => {
      assert.equal(r.back.afterHeaderBack, 'result');
      assert.equal(r.back.hash, '#trouble');
      assert.equal(r.back.afterPhoneBack, 'my_move');
      assert.equal(r.back.hub, 'hub');
      assert.deepEqual(r.back.resume, ['CAR_ACCIDENT']);
      assert.equal(r.reload, '#trouble');
      assert.deepEqual({...r.reloaded, bootLoaded: undefined}, {view: 'summary', chip: '층간소음·이웃 다툼', hash: '#trouble', bootLoaded: undefined, workspace: true});
      assert.equal(r.close.hash, '');
      assert.equal(r.close.workspace, false);
      assert.ok(r.close.current.every(value => value === ''));
    });
    await check(`${label}: 중고거래 사기 · 그 밖의 법률 고민 · 층간소음 — no emergency line, 잘 모르겠어요, goto, 사기·피싱 확인 hand-over`, () => {
      assert.equal(r.fraud.emergency, '');
      assert.deepEqual(r.fraud.calls, []);
      assert.equal(r.fraud.todoTitle, '돈을 더 보내지 마세요');
      assert.equal(r.fraud.main, 'tel:182');
      assert.equal(r.fraud.toldEmpty, true, 'nothing answered: 눌러서 답하기 offered');
      assert.deepEqual(r.fraud.steps, ['stop_paying', 'bank_and_112', 'app_report', 'save_evidence', 'police_report', 'lookup_before']);
      assertElderly(r.fraud.measure, `${label} fraud`, testCase);
      assert.equal(r.fraud.scamOpen, true);
      assert.equal(r.fraud.hash, '#scam');
      assert.equal(r.other.emergency, false);
      assert.equal(r.other.question, 'topic');
      assert.equal(r.other.skip, true);
      assert.deepEqual(r.other.steps, ['summary_first', 'work_link', 'call_132', 'call_110']);
      assert.equal(r.other.gotoChip, '월급 못 받음');
      assert.equal(r.other.wageEmergency, false);
      assertElderly(r.other.measure, `${label} wage start`, testCase);
      assert.deepEqual(r.noise, {emergency: '', calls: []});
      assert.ok(r.troubleRequests.length >= 1);
      for (const [requestPath, credentials, authorization] of r.troubleRequests) {
        assert.ok(PUBLIC_PATHS.includes(requestPath), requestPath);
        assert.equal(credentials, 'omit', requestPath);
        assert.equal(authorization, false, requestPath);
      }
      guestTroublePaths.push(...r.troubleRequests.map(item => item[0]));
    });
  }
  for (const testCase of SIGNED_CASES) {
    const label = testCase.label;
    const s = await runSigned(browser, origin, dir, testCase);
    await check(`${label}: signed in — the menu opens the same page and the same cards`, () => {
      assert.equal(s.boot.auth, 'authenticated');
      assert.ok(s.boot.me.length >= 1 && s.boot.me.every(Boolean), 'the session is really mounted (/v2/me with the token)');
      assert.equal(s.boot.bootLoaded, false, 'not fetched at boot signed in either');
      assert.equal(s.boot.troubleAtBoot, 0);
      assert.equal(s.open.hash, '#trouble');
      assert.equal(s.open.dialogs, 0);
      assert.deepEqual(s.flow.hub, FIXTURE.situations.map(item => item.id));
      assert.equal(s.flow.login, false);
      assert.deepEqual(s.flow.cards, ['todo', 'keep', 'help']);
      assertInside(s.flow.first, ['[data-trouble-card="todo"] h4', '[data-trouble-card="keep"] h4', '[data-trouble-card="help"] h4'], `${label} result`);
      assertElderly(s.flow.measure, `${label} summary`, testCase);
    });
    await check(`${label}: signed in — the helper sends Core nothing more than signed out (public GETs, no session, no credentials)`, () => {
      assert.deepEqual(s.flow.guideCalls, [{url: 'https://api.lotbiai.com/v2/trouble-helper/guides', method: 'GET', credentials: 'omit', mode: 'cors', headers: []}]);
      assert.ok(s.flow.trouble.length >= 1);
      for (const request of s.flow.trouble) {
        assert.ok(PUBLIC_PATHS.includes(request.path), `unexpected request from the helper: ${JSON.stringify(request)}`);
        assert.ok(guestTroublePaths.includes(request.path), `signed in only: ${request.path}`);
        assert.equal(request.origin, 'https://api.lotbiai.com');
        assert.equal(request.credentials, 'omit', request.path);
        assert.equal(request.authorization, false, `no session on ${request.path}`);
      }
      assert.equal(s.flow.trouble.filter(request => request.path === '/v2/trouble-helper/guides').length, 1);
    });
  }
  const fail = await runFailure(browser, origin, dir, CASES[0]);
  await check('Core down: the fallback sentence with 112 · 119 · 132, retry asks again', () => {
    assert.equal(fail.text, '안내를 불러오지 못했어요. 급하면 112·119, 법률 고민은 132에 전화해 주세요.');
    assert.deepEqual(fail.calls.map(item => item[0]), ['tel:112', 'tel:119', 'tel:132']);
    assert.ok(fail.calls.every(item => item[2] >= 56));
    assert.equal(fail.retry, true);
    assert.equal(fail.requests, 1);
    assert.equal(fail.retried, 2);
    assertElderly(fail.measure, 'failure', CASES[0]);
    assertReadable(fail.themes, 'failure');
  });
} finally {
  server.kill('SIGTERM');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.rmSync(dir, {recursive: true, force: true}); break; } catch { await sleep(250); }
  }
}

console.log(`TROUBLE-HELPER-PAGE-01 site contract: PASS (${passed} checks; viewport emulation in headless Chrome, not a device run)`);
