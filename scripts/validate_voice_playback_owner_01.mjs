// SITE-VOICE-READALOUD-PLAYBACK-OWNER-01
//
// Found during independent read-aloud verification: with one "읽어주기"
// button per answer and a single browser-wide speechSynthesis queue,
// clicking answer B's button while answer A is reading only cleared the
// engine queue — it never touched A's own button state. A's UI is reset
// only by A's own utterance.onend/onerror, and Chrome does not reliably
// fire either after cancel(). So A's button could get stuck showing
// "reading" after playback had actually moved to B, and pressing that
// stuck button would then cancel B's real playback instead of doing
// nothing.
//
// This validates the shared ownership object site-conversation.js now uses
// to force the previous reader back to idle the moment a new one claims
// playback, independent of whether the engine ever calls back at all.
import assert from 'node:assert/strict';
import {createSpeechPlaybackOwner} from '../site-voice-playback.js';

// Idle owner: stop() with nothing playing and no engine must not throw.
{
  const owner = createSpeechPlaybackOwner();
  owner.stop();
}

// The exact defect scenario: A is "reading", B is clicked. B's handler stops
// whatever is active before claiming ownership for itself — A's onend/onerror
// is never simulated here at all, matching an engine that drops the callback.
{
  const owner = createSpeechPlaybackOwner();
  let aReset = false;
  let bReset = false;
  const resetA = () => { aReset = true; };
  const resetB = () => { bReset = true; };
  const engine = {cancelCalls: 0, cancel() { this.cancelCalls += 1; }};

  owner.claim(resetA);
  assert.equal(owner.isActive(resetA), true);

  owner.stop(engine); // B's handler, before claiming for itself
  assert.equal(engine.cancelCalls, 1, 'starting B must still cancel the engine queue');
  assert.equal(aReset, true, 'B must force A back to idle even though A never got its own callback');

  owner.claim(resetB);
  assert.equal(owner.isActive(resetB), true);
  assert.equal(owner.isActive(resetA), false);
  assert.equal(bReset, false, 'claiming for B must not itself flip B to idle');
}

// A's callback finally does fire, late, after it has already been
// superseded — it must be a no-op, not corrupt B's ownership or UI.
{
  const owner = createSpeechPlaybackOwner();
  let aResetCalls = 0;
  let bReset = false;
  const resetA = () => { aResetCalls += 1; };
  const resetB = () => { bReset = true; };

  owner.claim(resetA);
  owner.stop(); // B's handler forces A back to idle before claiming for itself
  assert.equal(aResetCalls, 1);
  owner.claim(resetB);

  owner.release(resetA); // A's own onerror finally fires, late
  assert.equal(aResetCalls, 1, 'a stale release must not run the superseded reader\'s reset a second time');
  assert.equal(owner.isActive(resetB), true, 'a stale release from a superseded reader must not clear the current owner');
  assert.equal(bReset, false, 'a stale release must not reset a reader it does not own');
}

// A reader's own end/error still resets normally when it does still own playback.
{
  const owner = createSpeechPlaybackOwner();
  let reset = false;
  const resetFn = () => { reset = true; };
  owner.claim(resetFn);
  owner.release(resetFn);
  assert.equal(owner.isActive(resetFn), false);
  assert.equal(reset, false, 'release() only clears ownership bookkeeping — the caller still runs its own UI reset');
}

// Lifecycle stop (tab hidden / pagehide): cancels the engine and forces
// whichever reader is active back to idle, harmless when nothing is playing.
{
  const owner = createSpeechPlaybackOwner();
  const engine = {cancelCalls: 0, cancel() { this.cancelCalls += 1; }};
  owner.stop(engine);
  assert.equal(engine.cancelCalls, 1);

  let reset = false;
  owner.claim(() => { reset = true; });
  owner.stop(engine);
  assert.equal(engine.cancelCalls, 2);
  assert.equal(reset, true, 'a lifecycle stop must reset the active reader just like clicking its own stop control would');
}

// site-conversation.js must actually wire this in: one shared owner claimed
// on start, released from both onend and onerror, and stopped on tab-hide
// and pagehide — not just an unused module sitting next to it.
{
  const fs = await import('node:fs');
  const path = await import('node:path');
  const source = fs.readFileSync(path.join(import.meta.dirname, '..', 'site-conversation.js'), 'utf8');
  assert.match(source, /import\s*\{createSpeechPlaybackOwner\}\s*from\s*'\.\/site-voice-playback\.js/);
  assert.match(source, /speechPlayback\.claim\(resetThisSpeech\)/);
  assert.match(source, /speechPlayback\.release\(resetThisSpeech\)/);
  assert.match(source, /visibilityState[\s\S]*?speechPlayback\.stop\(globalThis\.speechSynthesis\)/);
  assert.match(source, /pagehide[\s\S]*?speechPlayback\.stop\(globalThis\.speechSynthesis\)/);
}

console.log('SITE-VOICE-READALOUD-PLAYBACK-OWNER-01 CONTRACT PASS');
