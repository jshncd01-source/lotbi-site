import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

const index = read('index.html');
const conversation = read('site-conversation.js');
const conversationCss = read('site-conversation.css');
const core = read('site-core.js');

const start = index.indexOf('<div class="response-grade-control"');
const end = index.indexOf('<button class="composer-button mic-button"', start);
assert.ok(start >= 0 && end > start, 'response-grade control must render immediately before mic');
const gradeMarkup = index.slice(start, end);

assert.match(gradeMarkup, /data-response-grade-trigger/);
assert.match(gradeMarkup, />스탠다드<\/span>/);
assert.match(gradeMarkup, /data-response-grade="LIGHT"[\s\S]*라이트[\s\S]*빠르고 간단한 답변/);
assert.match(gradeMarkup, /data-response-grade="STANDARD"[\s\S]*스탠다드[\s\S]*균형 잡힌 기본 모드/);
assert.match(gradeMarkup, /data-response-grade="PREMIUM"[\s\S]*프리미엄[\s\S]*복잡한 질문 · 깊은 분석/);
assert.match(gradeMarkup, /role="menuitemradio"/);
assert.match(gradeMarkup, /data-response-grade="STANDARD"[\s\S]*aria-checked="true"|aria-checked="true"[\s\S]*data-response-grade="STANDARD"/);
assert.doesNotMatch(gradeMarkup, /GPT|Gemini|Claude|Flash|OpenAI|Anthropic|Google/iu);

assert.match(conversation, /const DEFAULT_RESPONSE_GRADE = 'STANDARD'/);
assert.match(conversation, /\['LIGHT', '라이트'\]/);
assert.match(conversation, /\['STANDARD', '스탠다드'\]/);
assert.match(conversation, /\['PREMIUM', '프리미엄'\]/);
assert.match(conversation, /responseGrade:\s*DEFAULT_RESPONSE_GRADE/);
assert.match(conversation, /loadedPreferences\.responseGrade/);
assert.match(conversation, /savePreferences\(\)/);
assert.match(conversation, /dataset\.responseGrade/);
assert.match(conversation, /responseGradeTrigger\.addEventListener\('click'/);
assert.match(conversation, /responseGradeMenu\.addEventListener\('keydown'/);
assert.match(conversation, /event\.key === 'Escape'/);
assert.match(conversation, /event\.key === 'ArrowDown'/);
assert.match(conversation, /event\.key === 'ArrowUp'/);
assert.match(conversation, /event\.key === 'Home'/);
assert.match(conversation, /event\.key === 'End'/);
assert.match(conversation, /event\.key === 'Tab'/);
assert.match(conversation, /!target\?\.closest\('\[data-response-grade-control\]'\)/);

assert.match(conversationCss, /\.response-grade-trigger[\s\S]*height:\s*44px/);
assert.match(conversationCss, /\.response-grade-menu[\s\S]*position:\s*absolute/);
assert.match(conversationCss, /\.response-grade-menu\[hidden\]/);
assert.match(conversationCss, /@media \(max-width: 760px\)[\s\S]*\.response-grade-trigger/);
assert.match(conversationCss, /@media \(max-width: 390px\)[\s\S]*\.response-grade-trigger/);

const gradePos = index.indexOf('data-response-grade-control');
const micPos = index.indexOf('class="composer-button mic-button"', gradePos);
const sendPos = index.indexOf('class="composer-button send-button"', micPos);
assert.ok(gradePos >= 0 && micPos > gradePos && sendPos > micPos, 'selector, mic and send order must be preserved');
assert.match(conversation, /micButton\.disabled = false/);
assert.match(conversation, /micButton\.addEventListener\('click'/);
assert.match(conversation, /sendConversationMessage\(sessionToken, message, \{idempotencyKey: stableLogicalRequestId\}\)/);

// Phase 1 must not wire the selected grade into the Core request.
assert.match(core, /body:\s*JSON\.stringify\(\{text: message\}\)/);
assert.doesNotMatch(core, /response_grade|responseGrade|LIGHT|STANDARD|PREMIUM/);

console.log('LOTBI RESPONSE GRADE SELECTOR 01 CONTRACT PASS');
