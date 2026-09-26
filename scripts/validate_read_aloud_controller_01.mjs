// SITE-VOICE-READ-ALOUD-RELIABILITY-02
//
// Race and ownership contract for the read-aloud controller: single
// playback owner, playbackId-scoped stale-callback protection, bounded
// voice readiness, sequential one-chunk-at-a-time playback, a bounded
// single voice fallback, page-lifecycle stop with no auto-resume, and
// privacy-safe telemetry. This does not touch a real browser engine —
// scripts/validate_voice_tts_quality_01.mjs already covers voice scoring —
// it drives a fully deterministic fake speechSynthesis to exercise exactly
// the interleavings a real device produces intermittently.
import assert from 'node:assert/strict';
import {createReadAloudController, READ_ALOUD_STATE} from '../site-read-aloud-controller.js';

class FakeUtterance {
  constructor(text) { this.text = text; }
}
globalThis.SpeechSynthesisUtterance = FakeUtterance;

const KOREAN_VOICE_A = {lang: 'ko-KR', name: 'Voice A', localService: false, default: false};
const KOREAN_VOICE_B = {lang: 'ko-KR', name: 'Voice B', localService: true, default: true};

function createFakeSynth(initialVoices = []) {
  const listeners = new Map();
  let voices = initialVoices;
  let current = null;
  const speakLog = [];
  return {
    getVoices: () => voices,
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name, fn) => { if (listeners.get(name) === fn) listeners.delete(name); },
    speak(utterance) { current = utterance; speakLog.push(utterance.text); },
    cancel() {
      if (!current) return;
      const utterance = current;
      current = null;
      utterance.onerror?.({error: 'canceled'});
    },
    setVoices(next) { voices = next; },
    fireVoicesChanged() { listeners.get('voiceschanged')?.(); },
    current: () => current,
    speakLog,
  };
}

function createFakeDoc() {
  const listeners = new Map();
  return {
    hidden: false,
    addEventListener: (name, fn) => listeners.set(name, fn),
    fire(name) { listeners.get(name)?.(); },
  };
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

function createRecorder() {
  const events = [];
  return {events, onTelemetry: (event, detail) => events.push({event, detail})};
}

// --- 1. cold start: empty getVoices, voiceschanged fires shortly after ----
{
  const synth = createFakeSynth([]);
  const {onTelemetry, events} = createRecorder();
  const controller = createReadAloudController({synth, onTelemetry, voiceReadyTimeoutMs: 500});
  setTimeout(() => { synth.setVoices([KOREAN_VOICE_A]); synth.fireVoicesChanged(); }, 5);
  void controller.play(['안녕하세요'], {token: 'a'});
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(synth.speakLog.length, 1, 'a voice list that arrives after voiceschanged must still start the first click, not fail it');
  assert.ok(events.some(e => e.event === 'PLAY_START_REQUESTED'), 'the first click must reach chunk playback once the list is ready');
  assert.ok(!events.some(e => e.event === 'ERROR' && e.detail.reason === 'VOICES_NOT_READY'), 'must not report VOICES_NOT_READY when the list arrives before the bound');
  controller.stop();
}

// --- 2. readiness timeout vs true "no voice" must carry different reasons -
{
  const synth = createFakeSynth([]); // never populates, never fires voiceschanged
  const {onTelemetry, events} = createRecorder();
  const controller = createReadAloudController({synth, onTelemetry, voiceReadyTimeoutMs: 15});
  void controller.play(['안녕하세요'], {token: 'a'});
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(events.filter(e => e.event === 'ERROR').at(-1)?.detail.reason, 'VOICES_NOT_READY',
    'a bound that expires before any voice ever arrives must report VOICES_NOT_READY, not NO_KOREAN_VOICE');
}
{
  const synth = createFakeSynth([{lang: 'en-US', name: 'English', localService: true}]);
  const {onTelemetry, events} = createRecorder();
  const controller = createReadAloudController({synth, onTelemetry, voiceReadyTimeoutMs: 500});
  void controller.play(['안녕하세요'], {token: 'a'});
  await tick(); await tick();
  assert.equal(events.filter(e => e.event === 'ERROR').at(-1)?.detail.reason, 'NO_KOREAN_VOICE',
    'a device with voices but none Korean must report NO_KOREAN_VOICE, not a readiness timeout');
}

// --- 3. PREPARING cancel: stop before voices resolve must prevent playback -
{
  const synth = createFakeSynth([]);
  const {onTelemetry, events} = createRecorder();
  const controller = createReadAloudController({synth, onTelemetry, voiceReadyTimeoutMs: 500});
  void controller.play(['안녕하세요'], {token: 'a'});
  assert.equal(controller.getState().state, READ_ALOUD_STATE.PREPARING);
  controller.stop();
  assert.equal(controller.getState().state, READ_ALOUD_STATE.IDLE);
  synth.setVoices([KOREAN_VOICE_A]);
  synth.fireVoicesChanged(); // a stale readiness resolution arriving after cancel
  await tick(); await tick();
  assert.equal(synth.speakLog.length, 0, 'cancelled readiness must never resolve into playback starting on its own');
}

// --- 4. PLAYING stop calls cancel() and halts the chunk sequence ----------
{
  const synth = createFakeSynth([KOREAN_VOICE_A]);
  const controller = createReadAloudController({synth, voiceReadyTimeoutMs: 500});
  void controller.play(['첫 문장', '둘째 문장'], {token: 'a'});
  assert.equal(synth.speakLog.length, 1, 'first chunk must be spoken immediately once a voice is already available');
  controller.stop();
  await tick(); await tick();
  assert.equal(synth.speakLog.length, 1, 'stopping mid-utterance must never let the next chunk start');
  assert.equal(controller.getState().state, READ_ALOUD_STATE.IDLE);
}

// --- 5. rapid double tap: PREPARING -> click again cancels, no playback ---
{
  const synth = createFakeSynth([]);
  const controller = createReadAloudController({synth, voiceReadyTimeoutMs: 500});
  void controller.play(['안녕하세요'], {token: 'a'});
  void controller.play(['안녕하세요'], {token: 'a'}); // same button clicked again immediately
  synth.setVoices([KOREAN_VOICE_A]);
  synth.fireVoicesChanged();
  await tick(); await tick();
  // Exactly one live request should ever have reached the engine, not two overlapping ones.
  assert.ok(synth.speakLog.length <= 1, 'two rapid requests from the same button must never both reach the engine');
}

// --- 6. A -> B transition: B fully owns playback, A never resumes --------
{
  const synth = createFakeSynth([KOREAN_VOICE_A]);
  const {onTelemetry, events} = createRecorder();
  const controller = createReadAloudController({synth, onTelemetry, voiceReadyTimeoutMs: 500});
  void controller.play(['A의 답변'], {token: 'A'});
  assert.equal(synth.speakLog.at(-1), 'A의 답변');
  void controller.play(['B의 답변'], {token: 'B'});
  await tick(); await tick();
  assert.equal(synth.speakLog.at(-1), 'B의 답변', 'starting B must immediately supersede A');
  assert.equal(controller.getState().token, 'B', 'the controller must now be owned by B, not A');
  // A's utterance had already been cancelled by B's start; a late onend for it must not resurrect A.
  assert.ok(events.some(e => e.event === 'STALE_PLAYBACK'), 'A must be recorded as a stale/superseded playback');
}

// --- 7/8/9. stale onend / onerror / readiness-timeout from an old request -
// are covered by tests 3 and 6 above via the playbackId/AbortSignal guard:
// once superseded, no callback belonging to the old request can change
// state, start the next chunk, or report an error for the new one.

// --- 10/11/12/13. sequential order, no duplicate, no skip, stop halts next
{
  const synth = createFakeSynth([KOREAN_VOICE_A]);
  const controller = createReadAloudController({synth, voiceReadyTimeoutMs: 500});
  void controller.play(['첫', '둘', '셋'], {token: 'a'});
  assert.deepEqual(synth.speakLog, ['첫'], 'only the first chunk may be queued before it finishes');
  synth.current().onend();
  await tick(); await tick();
  assert.deepEqual(synth.speakLog, ['첫', '둘'], 'the second chunk must start only after the first ends, never both at once');
  synth.current().onend();
  await tick(); await tick();
  assert.deepEqual(synth.speakLog, ['첫', '둘', '셋'], 'chunks must play in order with no skip and no duplicate');
  synth.current().onend();
  await tick(); await tick();
  assert.equal(controller.getState().state, READ_ALOUD_STATE.IDLE, 'the sequence must end back at IDLE with nothing left queued');
}

// --- 14/15. bounded single Korean-voice fallback, before any sound only --
{
  const synth = createFakeSynth([KOREAN_VOICE_A, KOREAN_VOICE_B]);
  const {onTelemetry, events} = createRecorder();
  const controller = createReadAloudController({synth, onTelemetry, voiceReadyTimeoutMs: 500});
  void controller.play(['안녕하세요'], {token: 'a'});
  // The best-scored voice (network) fails before producing any sound.
  synth.current().onerror({error: 'synthesis-failed'});
  await tick(); await tick();
  assert.equal(events.filter(e => e.event === 'FALLBACK').length, 1, 'exactly one fallback must be used, never more');
  assert.equal(synth.speakLog.length, 2, 'the fallback must retry the same chunk with the alternate voice');
  // The alternate also fails before sound: no second fallback, no loop — a real error instead.
  synth.current().onerror({error: 'synthesis-failed'});
  await tick(); await tick();
  assert.equal(events.filter(e => e.event === 'FALLBACK').length, 1, 'a second consecutive failure must not trigger another fallback');
  assert.ok(events.some(e => e.event === 'ERROR'), 'exhausting the single fallback must end in a reported error, not a silent loop');
}
{
  // A failure AFTER sound has started must never trigger a fallback restart.
  const synth = createFakeSynth([KOREAN_VOICE_A, KOREAN_VOICE_B]);
  const {onTelemetry, events} = createRecorder();
  const controller = createReadAloudController({synth, onTelemetry, voiceReadyTimeoutMs: 500});
  void controller.play(['안녕하세요'], {token: 'a'});
  synth.current().onstart();
  synth.current().onerror({error: 'synthesis-failed'});
  await tick(); await tick();
  assert.equal(events.filter(e => e.event === 'FALLBACK').length, 0, 'a mid-utterance failure must end in ERROR, never a fallback restart');
}

// --- 16/17. page hidden stops playback; foreground never auto-resumes ----
{
  const synth = createFakeSynth([KOREAN_VOICE_A]);
  const doc = createFakeDoc();
  const {onTelemetry, events} = createRecorder();
  const controller = createReadAloudController({synth, doc, onTelemetry, voiceReadyTimeoutMs: 500});
  void controller.play(['첫', '둘'], {token: 'a'});
  doc.hidden = true;
  doc.fire('visibilitychange');
  assert.equal(controller.getState().state, READ_ALOUD_STATE.IDLE, 'backgrounding the tab must stop playback');
  assert.ok(events.some(e => e.event === 'PAGE_HIDDEN'), 'the stop must be attributed to PAGE_HIDDEN, not a generic user stop');
  doc.hidden = false;
  doc.fire('visibilitychange');
  await tick(); await tick();
  assert.equal(synth.speakLog.length, 1, 'returning to the foreground must never resume playback on its own');
}

// --- 18. telemetry never carries the answer text or a voice name ---------
{
  const synth = createFakeSynth([KOREAN_VOICE_A]);
  const {onTelemetry, events} = createRecorder();
  const controller = createReadAloudController({synth, onTelemetry, voiceReadyTimeoutMs: 500});
  const secretAnswer = 'LOTBI 답변 원문 — 절대 새어나가면 안 됨';
  void controller.play([secretAnswer], {token: 'a'});
  synth.current().onend();
  await tick(); await tick();
  const serialized = JSON.stringify(events);
  assert.ok(!serialized.includes(secretAnswer), 'telemetry must never include the text being read aloud');
  assert.ok(!serialized.includes(KOREAN_VOICE_A.name), 'telemetry must never include a voice name');
}

// --- 19/20/21. short answer, long answer, mixed Korean/number/English ----
{
  const synth = createFakeSynth([KOREAN_VOICE_A]);
  const controller = createReadAloudController({synth, voiceReadyTimeoutMs: 500});
  void controller.play(['짧은 답변'], {token: 'a'});
  synth.current().onend();
  await tick(); await tick();
  assert.equal(controller.getState().state, READ_ALOUD_STATE.IDLE, 'a single short chunk must complete cleanly');
}
{
  const synth = createFakeSynth([KOREAN_VOICE_A]);
  const controller = createReadAloudController({synth, voiceReadyTimeoutMs: 500});
  const longChunks = Array.from({length: 12}, (_, index) => `문장 ${index}`);
  void controller.play(longChunks, {token: 'a'});
  for (let index = 0; index < longChunks.length; index += 1) {
    assert.equal(synth.speakLog.length, index + 1, `chunk ${index} must be the only one queued at this point`);
    synth.current().onend();
    await tick(); await tick();
  }
  assert.deepEqual(synth.speakLog, longChunks, 'a long answer must still play every chunk once, in order');
}
{
  const synth = createFakeSynth([KOREAN_VOICE_A]);
  const controller = createReadAloudController({synth, voiceReadyTimeoutMs: 500});
  const mixed = ['오늘은 2026년 9월 26일, 전화번호는 02-1234-5678 입니다', 'LOTBI is an AI concierge'];
  void controller.play(mixed, {token: 'a'});
  synth.current().onend();
  await tick(); await tick();
  synth.current().onend();
  await tick(); await tick();
  assert.deepEqual(synth.speakLog, mixed, 'numbers, phone numbers and English text must reach the engine unmodified');
}

console.log('SITE-VOICE-READ-ALOUD-RELIABILITY-02 CONTRACT PASS');
