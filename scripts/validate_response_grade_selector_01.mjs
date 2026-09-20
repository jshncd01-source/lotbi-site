import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

const index = read('index.html');
const conversation = read('site-conversation.js');
const core = read('site-core.js');

const start = index.indexOf('<div class="response-grade-control"');
const end = index.indexOf('<button class="composer-button mic-button"', start);
assert.ok(start >= 0 && end > start, 'response-grade markup must remain immediately before mic for future activation');
const gradeMarkup = index.slice(start, end);

// PHASE 7: no selector flash for anonymous visitors. The control remains in the
// document only as dormant future UX until Core owns an authoritative contract.
assert.match(gradeMarkup, /class="response-grade-control"[^>]*data-response-grade-control[^>]*hidden[^>]*inert[^>]*aria-hidden="true"/);
assert.match(gradeMarkup, /data-response-grade-trigger[\s\S]*disabled/);
assert.equal((gradeMarkup.match(/role="menuitemradio"[^>]*disabled/g) || []).length, 3, 'all dormant grade options must be disabled from first paint');
assert.match(gradeMarkup, /data-response-grade="LIGHT"/);
assert.match(gradeMarkup, /data-response-grade="STANDARD"/);
assert.match(gradeMarkup, /data-response-grade="PREMIUM"/);
assert.match(gradeMarkup, /data-response-grade="STANDARD"[\s\S]*aria-checked="true"|aria-checked="true"[\s\S]*data-response-grade="STANDARD"/);

// Runtime gate: even a stale stored LIGHT/PREMIUM value cannot become effective
// while the Core request contract has no response_grade field.
assert.match(conversation, /const DEFAULT_RESPONSE_GRADE = 'STANDARD'/);
assert.match(conversation, /const RESPONSE_GRADE_BACKEND_ENABLED = false/);
assert.match(conversation, /const responseGradeAvailable = \(\) => RESPONSE_GRADE_BACKEND_ENABLED && Boolean\(sessionToken\)/);
assert.match(conversation, /const grade = available && RESPONSE_GRADE_OPTIONS\.some[\s\S]*\? preferences\.responseGrade[\s\S]*: DEFAULT_RESPONSE_GRADE/);
assert.match(conversation, /preferences\.responseGrade = grade/);
assert.match(conversation, /responseGradeControl\.hidden = !available/);
assert.match(conversation, /responseGradeControl\.setAttribute\('aria-hidden', String\(!available\)\)/);
assert.match(conversation, /responseGradeTrigger\.disabled = !available/);
assert.match(conversation, /if \(available\) responseGradeControl\.removeAttribute\('inert'\)/);
assert.match(conversation, /else responseGradeControl\.setAttribute\('inert', ''\)/);
assert.match(conversation, /if \(option instanceof HTMLButtonElement\) option\.disabled = !available/);
assert.match(conversation, /if \(RESPONSE_GRADE_BACKEND_ENABLED\) \{[\s\S]*responseGradeTrigger\.addEventListener\('click'/);
assert.match(conversation, /if \(!available\) \{[\s\S]*responseGradeMenu\.hidden = true/);
assert.match(conversation, /const openResponseGradeMenu = \(\{edge = ''\} = \{\}\) => \{[\s\S]*if \(!responseGradeAvailable\(\)\) return/);
assert.match(conversation, /const selectResponseGrade = grade => \{[\s\S]*if \(!responseGradeAvailable\(\)\) return/);
assert.match(conversation, /document\.body\.dataset\.responseGrade = preferences\.responseGrade/);

// Existing future-facing keyboard/a11y handlers may remain dormant; hiding the
// feature must not remove mic/send or reorder the composer controls.
const gradePos = index.indexOf('data-response-grade-control');
const micPos = index.indexOf('class="composer-button mic-button"', gradePos);
const sendPos = index.indexOf('class="composer-button send-button"', micPos);
assert.ok(gradePos >= 0 && micPos > gradePos && sendPos > micPos, 'grade, mic and send DOM order must remain stable');
assert.match(conversation, /micButton\.disabled = false/);
assert.match(conversation, /micButton\.addEventListener\('click'/);
assert.match(conversation, /sendConversationMessage\([\s\S]*activeSessionToken,[\s\S]*message,[\s\S]*attachments\.map\(item => item\.id\)/);

// Authoritative response-grade support does not exist yet. Attachment IDs may
// be sent by PHASE 16, but neither authenticated nor guest requests may invent a grade field.
assert.match(core, /const body = \{text: message \|\| '첨부 파일을 확인해 주세요\.'\}/);
assert.match(core, /if \(attachments\.length\) body\.attachment_ids = attachments/);
assert.match(core, /body:\s*JSON\.stringify\(body\)/);
assert.doesNotMatch(core, /response_grade|responseGrade|LIGHT|STANDARD|PREMIUM/);

console.log('SITE-PUBLIC-UX-RESPONSE-GRADE-07 HIDDEN-UNTIL-CORE CONTRACT PASS');
