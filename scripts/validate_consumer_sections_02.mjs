import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LIFE_SHORTCUTS} from '../site-consumer-sections.js';
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const source = read('site-consumer-sections.js');
const conversation = read('site-conversation.js');
const css = read('site-consumer-design.css');
assert.deepEqual(LIFE_SHORTCUTS.map(item => item.label), ['병원·의원', '약국', '응급실', '축제·행사', '지역뉴스', '온누리상품권·지역화폐', '지역생활정보', '전북 맛집·음식', '유치원·학교', '내 아이 학교·유치원']);
assert.equal(new Set(LIFE_SHORTCUTS.map(item => item.id)).size, 10);
// Medical entries ask a fixed question at once (LIFE-MEDICAL-AUTO-SEARCH-01);
// 지역뉴스 builds its sentence from the saved or typed region (REGIONAL-NEWS-P0).
assert.deepEqual(LIFE_SHORTCUTS.filter(item => item.ask).map(item => item.id), ['hospital', 'pharmacy', 'emergency']);
// 축제·행사 and 온누리상품권 open their own surfaces (ONNURI-MERCHANT-01);
// 유치원·학교 opens its own screen (KINDERGARTEN-OFFICIAL-INFO-01).
// 전북 맛집·음식 builds its sentence from its own form (JEONBUK-PILOT-01).
assert.ok(LIFE_SHORTCUTS.filter(item => !['festivals', 'news', 'onnuri', 'education', 'my-child'].includes(item.id) && !item.ask && !item.regionalFood).every(item => typeof item.prompt === 'string'));
// 공과금 확인 is hidden until an official integration exists — no entry, form or copy.
assert.equal(LIFE_SHORTCUTS.some(item => item.id === 'bills'), false);
assert.doesNotMatch(source, /공과금|고지서|납부기한/);
assert.ok(source.includes('제휴처 찾아 연결하기'));
for (const removed of ['사람 실종 신고', '반려동물 실종 신고', '112·119']) assert.ok(!source.includes(removed));
assert.doesNotMatch(source, /\bfetch\(|localStorage|sessionStorage|innerHTML|type = 'file'/);
assert.match(source, /mountLifeWallet\(\{root, authenticated, accountId, sessionExpiresAt\}\)/);
assert.match(source, /mountPeople\(host, initialSurface, counts =>/);
assert.match(conversation, /mountPersonCareManager\(\{sessionToken, root, initialSurface, onCountChange: reportCounts/);
assert.match(source, /role', 'tablist'/);
assert.match(source, /aria-selected/);
assert.match(source, /ArrowLeft.*ArrowRight.*Home.*End/);
assert.match(source, /disposed \|\| current !== generation/);
assert.match(source, /!authenticated/);
assert.match(source, /mounted\?\.dispose\?\.\(\)/);
assert.match(conversation, /onClose: \(\) => mounted\?\.dispose\(\)/);
assert.match(conversation, /mountPetFamilyManager\(\{sessionToken, root, subscription: serverSubscription/);
assert.match(conversation, /mountPersonCareManager\(\{sessionToken, root, initialSurface/);
assert.match(conversation, /onAsk: text => \{[\s\S]{0,400}?closeSurface\(\);\s*askWithoutKeyboard\(text\);/);
// LIFE-DIRECT-CHAT-CARD-COMPACTION-01: 유치원·학교 asks through onAsk too, so no
// draft handoff is left anywhere in 생활정보.
assert.doesNotMatch(conversation, /onDraft|draft\(text\)|요청을 입력창에 넣었어요/);
assert.doesNotMatch(source, /onDraft/);
assert.match(source, /mountEducation\(\{root: host, onAsk, accountId\}\)/);
assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(css, /min-height: 44px/);
assert.match(css, /input:focus-visible/);
assert.match(read('site-scam-shield.js'), /scamOutsideBound/);
const scam = read('site-scam-shield.js');
assert.match(scam, /function restoreDialogFocus\(\)/, 'all close paths share visible-trigger focus restoration');
assert.match(scam, /visibleTrigger \? dialogTrigger : document\.querySelector\('\[data-mobile-nav-open\]'\)/, 'a hidden mobile trigger must fall back to the visible menu button');
assert.match(scam, /target\?\.focus\?\.\(\)/);
assert.match(scam, /dialog\.addEventListener\('close', restoreDialogFocus\)/, 'native close restores focus');
assert.match(scam, /dialog\.removeAttribute\('aria-modal'\);\s*restoreDialogFocus\(\);/, 'fallback close restores focus');
console.log('CONSUMER_SECTIONS_02 PASS — entry UX and safety source contracts, not backend E2E');
