// SITE-VOICE-BROWSER-TTS-QUALITY-01
//
// Measured complaint: the "읽어주기" (read aloud) button sounds "너무 어색해"
// (very unnatural). Root cause — leaving `utterance.voice` unset hands the
// choice to the engine, which on a real device picks *any* voice whose lang
// happens to match 'ko-KR', including the worst one it has (Android Chrome's
// compact on-device voice, instead of its much better network "Google"
// voice; iOS's default compact voice instead of a downloaded "Enhanced" one).
//
// pickBestKoreanVoice must always prefer the better voice when both are
// present, and waitForVoices must not report "no voice" just because the
// list had not loaded yet on the very first call.
import assert from 'node:assert/strict';
import {pickBestKoreanVoice, scoreKoreanVoice, waitForVoices} from '../site-voice-tts.js';

// --- pickBestKoreanVoice ---------------------------------------------------

// A network ("Google") ko-KR voice must beat a compact on-device one — this
// is the exact Android Chrome shape that produced the complaint.
{
  const compact = {lang: 'ko-KR', name: '한국어', localService: true, default: true};
  const network = {lang: 'ko-KR', name: 'Google 한국의', localService: false, default: false};
  const picked = pickBestKoreanVoice([compact, network]);
  assert.equal(picked, network, 'a network-backed ko-KR voice must be preferred over a compact on-device one');
}

// An iOS "Enhanced" download must beat the default compact voice.
{
  const compact = {lang: 'ko-KR', name: 'Yuna', localService: true, default: true};
  const enhanced = {lang: 'ko-KR', name: 'Yuna (Enhanced)', localService: true, default: false};
  assert.equal(pickBestKoreanVoice([compact, enhanced]), enhanced, 'an Enhanced/Premium/Neural ko-KR voice must be preferred');
}

// Non-Korean voices must never be picked, whatever their score would be.
{
  const english = {lang: 'en-US', name: 'Google US English', localService: false, default: true};
  const korean = {lang: 'ko-KR', name: '한국어', localService: true, default: false};
  assert.equal(pickBestKoreanVoice([english, korean]), korean, 'only a ko* voice may be picked');
}

// lang tags come as both 'ko-KR' and 'ko_KR' across browsers, and a bare 'ko'.
for (const lang of ['ko-KR', 'ko_KR', 'ko']) {
  const voice = {lang, name: '한국어', localService: true, default: false};
  assert.equal(pickBestKoreanVoice([voice]), voice, `lang '${lang}' must be recognised as Korean`);
}

// No Korean voice at all must abstain, not throw or guess a wrong one.
assert.equal(pickBestKoreanVoice([{lang: 'en-US', name: 'English', localService: false, default: true}]), undefined);
assert.equal(pickBestKoreanVoice([]), undefined);
assert.equal(pickBestKoreanVoice(undefined), undefined);

// Score ordering itself: network + enhanced-named + default stacks, in case a
// future device ships more than one axis of quality signal at once.
assert.ok(
  scoreKoreanVoice({localService: false, name: 'Google 한국의 Neural', default: true})
    > scoreKoreanVoice({localService: true, name: '한국어', default: false}),
  'combined quality signals must outscore a plain compact voice',
);

// --- waitForVoices ----------------------------------------------------------

function fakeSynth({sequence, firesEvent}) {
  let calls = 0;
  const listeners = new Map();
  return {
    getVoices: () => sequence[Math.min(calls++, sequence.length - 1)],
    addEventListener: (name, fn) => {
      listeners.set(name, fn);
      if (firesEvent) setTimeout(() => listeners.get(name)?.(), 5);
    },
    removeEventListener: () => {},
  };
}

// Voices already present: resolves immediately, no waiting for the event.
{
  const voices = [{lang: 'ko-KR', name: '한국어'}];
  const synth = fakeSynth({sequence: [voices], firesEvent: false});
  const resolved = await waitForVoices(synth, {timeoutMs: 1000});
  assert.deepEqual(resolved, voices, 'an already-populated voice list must resolve without waiting');
}

// Voices load asynchronously (the real Chrome shape): empty on the first
// call, populated once 'voiceschanged' fires — must not report "no voice".
{
  const voices = [{lang: 'ko-KR', name: '한국어'}];
  const synth = fakeSynth({sequence: [[], voices], firesEvent: true});
  const resolved = await waitForVoices(synth, {timeoutMs: 1000});
  assert.deepEqual(resolved, voices, 'a voice list that loads after voiceschanged must still resolve with it');
}

// An engine that never fires the event must still resolve via the timeout,
// not hang forever.
{
  const synth = fakeSynth({sequence: [[]], firesEvent: false});
  const started = Date.now();
  const resolved = await waitForVoices(synth, {timeoutMs: 40});
  assert.deepEqual(resolved, []);
  assert.ok(Date.now() - started < 2000, 'must resolve via the timeout, not hang');
}

console.log('SITE-VOICE-BROWSER-TTS-QUALITY-01 PASS');
