// SITE-VOICE-READALOUD-PLAYBACK-OWNER-01
//
// The "읽어주기" (read aloud) button in site-conversation.js lives on each
// answer separately, but window.speechSynthesis is one browser-wide queue.
// Reading answer A, then clicking answer B's button, must leave A's own
// button back in its idle state — without depending on A's utterance ever
// getting its own onend/onerror. Chrome does not reliably fire either after
// cancel() (long-documented: a cancel that lands before an utterance has
// actually started speaking, or one that fires during tab teardown, can
// drop the event entirely), so a button that only resets itself from its
// own utterance callback can get stuck showing "reading" — and a second
// press on that stuck button would then cancel whatever is genuinely
// playing now.
//
// This tracks a single "who is allowed to reset" owner instead. Whoever
// starts a new reading (or a page-lifecycle stop) forces the previous
// owner's UI back to idle directly, and a late callback from a reader that
// has already been superseded is a no-op.
export function createSpeechPlaybackOwner() {
  let activeReset = null;

  return {
    // Cancels the engine (if given one) and forces whichever reader currently
    // owns playback back to idle. Safe to call with nothing playing.
    stop(engine) {
      if (engine && typeof engine.cancel === 'function') engine.cancel();
      const reset = activeReset;
      activeReset = null;
      if (reset) reset();
    },
    // A reader that just started speaking becomes the one `stop()` will reset.
    claim(resetFn) {
      activeReset = resetFn;
    },
    // A reader's own utterance finished or errored. Only clears ownership if
    // it still holds it — a late callback from a superseded reader must not
    // touch whoever is reading now.
    release(resetFn) {
      if (activeReset === resetFn) activeReset = null;
    },
    isActive(resetFn) {
      return activeReset === resetFn;
    },
  };
}
