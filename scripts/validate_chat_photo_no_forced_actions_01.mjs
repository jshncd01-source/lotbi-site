// CHATPERF-08 — a photo the owner sends into chat is analysis input (place,
// calendar, festival, pet, receipt), not a thing this Site owns a copy of.
// It never grows a "save to gallery" button (the photo may already be in the
// device gallery the owner picked it from) and it never forces a memory
// prompt or a calendar suggestion just because an attachment exists — that
// only happens when the current conversational intent actually calls for it.
//
// This is a static regression guard, not a DOM test: it locks in the absence
// of these forbidden phrases/patterns rather than exercising a UI that would
// otherwise need one to exist first.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

const conversation = read('site-conversation.js');
const attachments = read('site-attachments.js');
const messageBody = read('site-message-body.js');

// "갤러리" itself is a legitimate source picker option (카메라 / 갤러리 / 내 파일)
// for where an outgoing attachment comes FROM. What must never exist is the
// opposite direction: a control that saves a chat photo back INTO the gallery.
for (const source of [conversation, attachments, messageBody]) {
  assert.ok(!/갤러리\s*(에)?\s*저장/u.test(source), 'no control may offer to save a chat photo to the device gallery');
  assert.ok(!/추억으로\s*저장/u.test(source), 'no control may force a "save as a memory" prompt on every photo');
  assert.ok(!/사진을?\s*저장할까요/u.test(source), 'no control may ask to save a photo unconditionally');
}

// The camera/gallery/files picker is the source of an outgoing attachment,
// not a save destination — confirming the one "갤러리" match left is that
// picker option, not a forbidden save-to-gallery control.
assert.match(conversation, /\['gallery', '갤러리'\]/);

console.log('CHAT-PHOTO-NO-FORCED-ACTIONS-01 PASS');
