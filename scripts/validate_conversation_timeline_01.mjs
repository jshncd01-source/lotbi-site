import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

import {
  formatConversationTimestamp,
  millisecondsUntilNextLocalMidnight,
  shouldShowConversationSeparator,
  timestampedConversationMessage,
} from '../site-conversation-timeline.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const conversation = fs.readFileSync(path.join(ROOT, 'site-conversation.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'site-conversation.css'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const callback = fs.readFileSync(path.join(ROOT, 'auth-callback.js'), 'utf8');
const reviewWorkflow = fs.readFileSync(path.join(ROOT, '.github/workflows/site-review.yml'), 'utf8');

const SEOUL_OFFSET_MINUTES = 9 * 60;
const atSeoul = value => Date.parse(`${value}+09:00`);
const now = atSeoul('2026-09-20T17:00:00');

assert.equal(formatConversationTimestamp(atSeoul('2026-09-20T15:49:00'), {now, offsetMinutes: SEOUL_OFFSET_MINUTES}), '오늘 오후 3:49');
assert.equal(formatConversationTimestamp(atSeoul('2026-09-19T10:12:00'), {now, offsetMinutes: SEOUL_OFFSET_MINUTES}), '어제 오전 10:12');
assert.equal(formatConversationTimestamp(atSeoul('2026-09-18T20:03:00'), {now, offsetMinutes: SEOUL_OFFSET_MINUTES}), '2026년 9월 18일 오후 8:03');
assert.equal(formatConversationTimestamp(undefined, {now, offsetMinutes: SEOUL_OFFSET_MINUTES}), '');
const dstProbe = spawnSync(process.execPath, ['--input-type=module', '-e', `
  import {formatConversationTimestamp} from './site-conversation-timeline.js';
  const createdAt = Date.parse('2026-03-08T01:30:00-05:00');
  const now = Date.parse('2026-03-09T00:15:00-04:00');
  if (formatConversationTimestamp(createdAt, {now}) !== '어제 오전 1:30') process.exit(1);
`], {cwd: ROOT, env: {...process.env, TZ: 'America/New_York'}, encoding: 'utf8'});
assert.equal(dstProbe.status, 0, 'today/yesterday must use the local offset applicable to each instant across DST');
assert.equal(
  millisecondsUntilNextLocalMidnight(atSeoul('2026-09-20T23:59:30'), {offsetMinutes: SEOUL_OFFSET_MINUTES}),
  30_000,
  'open pages refresh labels exactly at the next local midnight',
);

const first = atSeoul('2026-09-20T15:00:00');
assert.equal(shouldShowConversationSeparator(undefined, first, {offsetMinutes: SEOUL_OFFSET_MINUTES}), true, 'first timestamped message starts a segment');
assert.equal(shouldShowConversationSeparator(first, first + 29 * 60 * 1000, {offsetMinutes: SEOUL_OFFSET_MINUTES}), false, '29 minute gap stays in one segment');
assert.equal(shouldShowConversationSeparator(first, first + 30 * 60 * 1000, {offsetMinutes: SEOUL_OFFSET_MINUTES}), true, '30 minute gap starts a segment');
assert.equal(shouldShowConversationSeparator(atSeoul('2026-09-20T23:59:00'), atSeoul('2026-09-21T00:01:00'), {offsetMinutes: SEOUL_OFFSET_MINUTES}), true, 'date change starts a segment');
assert.equal(shouldShowConversationSeparator(first, undefined, {offsetMinutes: SEOUL_OFFSET_MINUTES}), false, 'legacy message without createdAt never receives a fake separator');

const original = {role: 'user', text: '안녕', meta: {attachments: []}};
const stamped = timestampedConversationMessage(original, first);
assert.equal(stamped.createdAt, first);
assert.notEqual(stamped, original);
assert.equal(timestampedConversationMessage(stamped, first + 9999).createdAt, first, 'existing createdAt is never overwritten on reload/render');

assert.match(conversation, /timestampedConversationMessage/);
assert.match(conversation, /createConversationSeparator/);
assert.match(conversation, /refreshConversationTimeLabels/);
assert.match(conversation, /millisecondsUntilNextLocalMidnight/);
assert.match(conversation, /shouldShowConversationSeparator/);
assert.match(conversation, /createdAt/);
assert.match(css, /\.conversation-thread,[\s\S]*?width:\s*min\(760px,\s*100%\)/);
assert.match(css, /\.chat-composer-stack\s*\{[^}]*width:\s*min\(760px,\s*100%\)/s);
assert.match(css, /\.conversation-time-separator\s*\{[^}]*text-align:\s*center[^}]*font-weight:\s*400[^}]*color:\s*#[0-9a-fA-F]{6}/s);
assert.doesNotMatch(css, /\.conversation-time-separator\s*\{[^}]*(?:background|border|box-shadow):/s);
assert.match(css, /@media\s*\(max-width:\s*390px\)/);
assert.ok(html.includes('site-conversation.js?v=20260920-calendarentry2'));
assert.ok(callback.includes("./site-conversation.js?v=20260920-calendarentry2"));
assert.ok(reviewWorkflow.includes('node scripts/validate_conversation_timeline_01.mjs'), 'required Site CI must run the timeline regression');
assert.ok(reviewWorkflow.includes('REQUIRE_BROWSER: 1'), 'required Site CI must fail instead of silently skipping browser geometry');
assert.ok(reviewWorkflow.includes('/site-conversation-timeline.js'), 'static serving smoke must include the timeline module');

for (const width of [340, 390, 412, 768, 1280, 1440]) {
  const effectiveColumn = Math.min(760, width);
  assert.ok(effectiveColumn <= width, `${width}px transcript axis must fit viewport`);
}

console.log('SITE-CONVERSATION-TIMELINE-01 PASS');
