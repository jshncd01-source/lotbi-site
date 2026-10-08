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
//
// CHAT-READ-ALOUD-RESTORE-P0 changed one expectation on purpose: a network
// ("Google") voice is no longer the preferred one — it is never picked at
// all, because it sends the answer text off the device. Only voices that
// report localService === true are eligible.
import assert from 'node:assert/strict';
import {isLocalVoice, pickBestKoreanVoice, scoreKoreanVoice, selectKoreanVoice, waitForVoices} from '../site-voice-tts.js';

// --- pickBestKoreanVoice ---------------------------------------------------

// The exact Android Chrome shape: a compact on-device ko-KR voice next to the
// network "Google 한국의" one. The on-device voice must be the one used.
{
  const compact = {lang: 'ko-KR', name: '한국어', localService: true, default: true};
  const network = {lang: 'ko-KR', name: 'Google 한국의', localService: false, default: false};
  assert.equal(pickBestKoreanVoice([compact, network]), compact, 'an on-device ko-KR voice must be used, never the network one');
  assert.equal(pickBestKoreanVoice([network, compact]), compact, 'list order must not let the network voice through');
}

// Only network Korean voices (desktop Edge's "… Online (Natural)" without a
// Korean language pack): nothing is picked, so the caller can say why.
{
  const edgeOnline = {lang: 'ko-KR', name: 'Microsoft SunHi Online (Natural) - Korean (Korea)', localService: false, default: false};
  const googleNetwork = {lang: 'ko-KR', name: 'Google 한국의', localService: false, default: true};
  assert.equal(pickBestKoreanVoice([edgeOnline, googleNetwork]), undefined, 'network-only Korean voices must not be picked');
  // A voice that never says whether it is local is not treated as local.
  assert.equal(pickBestKoreanVoice([{lang: 'ko-KR', name: '불명', default: true}]), undefined, 'an unconfirmed voice must not be picked');
  assert.equal(isLocalVoice({localService: undefined}), false);
}

// The bounded fallback ("best voice other than the one that failed") must
// not reach for a network voice either.
{
  const local = {lang: 'ko-KR', name: 'Microsoft Heami - Korean (Korean)', localService: true, default: false};
  const network = {lang: 'ko-KR', name: 'Google 한국의', localService: false, default: true};
  assert.notEqual(selectKoreanVoice([local, network], {avoidNames: new Set([local.name])}), network, 'the fallback must never be a network voice');
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

// Score ordering among local voices: enhanced-named + default stacks, in case
// a future device ships more than one axis of quality signal at once. Being a
// network voice no longer adds anything.
assert.ok(
  scoreKoreanVoice({localService: true, name: 'Yuna (Premium)', default: true})
    > scoreKoreanVoice({localService: true, name: '한국어', default: false}),
  'combined quality signals must outscore a plain compact voice',
);
assert.equal(
  scoreKoreanVoice({localService: false, name: '한국어', default: false}),
  scoreKoreanVoice({localService: true, name: '한국어', default: false}),
  'a network voice must not earn a bonus for being one',
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
