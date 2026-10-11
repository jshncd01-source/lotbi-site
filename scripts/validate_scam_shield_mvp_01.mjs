import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('index.html');
const core = read('site-core.js');
const conversation = read('site-conversation.js');
const ui = read('site-scam-shield.js');
const css = read('site-scam-shield.css');

const start = html.indexOf('<section class="scam-page"');
assert.ok(start >= 0, 'independent scam page exists');
const page = html.slice(start, html.indexOf('<!-- TROUBLE-HELPER-01', start));

assert.doesNotMatch(page, /<dialog\b|aria-modal=/u, 'scam route is not a modal dialog');
assert.doesNotMatch(page, /C안|바로 입력형|진위확인/u, 'design-only labels and the old menu name are absent');
assert.equal((html.match(/data-scam-open aria-label="사기·피싱 확인"/gu) || []).length, 2, 'desktop and mobile menu names');
assert.equal((html.match(/data-consumer-section="mall"[^>]*hidden/gu) || []).length, 2, '연결 서비스 stays hidden');

for (const copy of [
  '롯비야, 이거 진짜야?',
  '의심되는 문자·이메일·파일·주소를 보내주세요.',
  '의심 신호와 안전하게 확인하는 방법을 알려드려요.',
  '의심 신호 확인하기',
  '문자·이메일',
  '인터넷 주소',
  '사진·스크린샷 올리기',
  '카메라로 찍기',
  '문서·PDF 올리기',
  '이미 눌렀거나 개인정보를 입력했어요',
]) assert.ok(page.includes(copy), copy);

assert.match(page, /<textarea id="scam-text"[^>]*maxlength="20000"/u);
assert.match(page, /name="scamCamera"[^>]*accept="image\/jpeg,image\/png,image\/webp"[^>]*capture="environment"/u);
assert.match(page, /name="scamPhoto"[^>]*accept="image\/\*"/u);
assert.doesNotMatch(page.match(/<input\b[^>]*name="scamPhoto"[^>]*>/u)?.[0] || '', /capture/u);
assert.match(page, /name="scamDocument"[^>]*accept="\.txt,text\/plain,\.html,\.htm,text\/html,application\/pdf"/u);
assert.match(page, /data-scam-camera-action hidden/u, 'desktop starts fail-closed until a camera is found');
assert.match(ui, /isMobileDevice\(\)/u);
assert.match(ui, /device\?\.kind === 'videoinput'/u);
assert.match(ui, /actions\.forEach\(action => \{ action\.hidden = false; \}\)/u, 'phones always show the camera action');

assert.match(ui, /function hasValidInput\(\)/u);
assert.match(ui, /submit\.disabled = analyzing \|\| !hasValidInput\(\)/u);
assert.match(ui, /function invalidateResult\(/u);
assert.match(ui, /analysisSequence \+= 1/u);
assert.match(ui, /activeRequest !== requestId \|\| analysisSequence !== requestId/u, 'late responses cannot replace a newer input');
assert.match(ui, /검사 대상:/u);
assert.match(ui, /검사 시각:/u);
assert.match(ui, /발신자·사건 진위까지 확인했다는 뜻은 아니에요/u);
assert.match(ui, /현재는 사진, PDF, TXT, HTML 파일만 확인할 수 있어요/u);
assert.match(ui, /파일은 10MB 이하만 확인할 수 있어요/u);
assert.match(ui, /PLAN_USAGE_LIMIT_REACHED/u);
assert.match(ui, /basicProtection/u);
assert.doesNotMatch(ui, /안전합니다|안전해요/u);

assert.match(core, /\/v2\/scam-shield\/cases/u);
assert.match(core, /untrusted_file_execution !== false/u);
assert.match(core, /public_file_upload_to_third_party !== false/u);
assert.match(conversation, /analyzeScamShield\(sessionToken, detail\.formData\)/u);
assert.match(conversation, /lotbi:scam-shield-will-open/u, 'an existing workspace is closed before scam opens');
assert.match(css, /body\.scam-page-open \.chat-hero/u);
assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/u);
assert.match(css, /@media \(max-width: 760px\)/u);

console.log('SITE-SCAM-SHIELD-MVP-01 PASS');
