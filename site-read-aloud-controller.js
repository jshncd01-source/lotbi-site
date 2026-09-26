// SITE-VOICE-READ-ALOUD-RELIABILITY-02
//
// Single playback owner for every "읽어주기" button on a page. Each request
// (one click, one answer) gets a monotonic playbackId; every async step
// re-checks it before touching shared state, so a click on answer B can
// never be undone by answer A's late onend/onerror/voice-readiness timeout,
// and stopping never lets a queued next chunk slip out afterward.
//
// See site-read-aloud-speech.js for the engine wrapper this drives, and
// site-voice-tts.js for how a Korean voice is scored and picked.
import {awaitVoicesReady, readVoicesSafe, speakChunk} from './site-read-aloud-speech.js?v=aset-81c2d93709bd';
import {pickBestKoreanVoice, selectKoreanVoice} from './site-voice-tts.js?v=aset-81c2d93709bd';

export const READ_ALOUD_STATE = Object.freeze({
  IDLE: 'IDLE',
  PREPARING: 'PREPARING',
  PLAYING: 'PLAYING',
  ERROR: 'ERROR',
});

const VOICE_READY_TIMEOUT_MS = 1500;

// token identifies *who* is asking (a message's speak button); the
// controller only ever plays one token's request at a time and every
// subscriber compares its own token against the broadcast one to decide
// whether a state change is about it.
export function createReadAloudController({
  synth = globalThis.speechSynthesis,
  doc = (typeof document !== 'undefined' ? document : undefined),
  win = (typeof window !== 'undefined' ? window : undefined),
  onTelemetry,
  // Test-only override — production callers never pass this and get the
  // real bounded wait above.
  voiceReadyTimeoutMs = VOICE_READY_TIMEOUT_MS,
} = {}) {
  let playbackId = 0;
  let state = READ_ALOUD_STATE.IDLE;
  let activeToken = null;
  let activeController = null;
  const listeners = new Set();

  const emit = (event, detail) => { try { onTelemetry?.(event, detail); } catch { /* telemetry must never break playback */ } };
  const notify = extra => {
    const payload = {state, token: activeToken, ...extra};
    for (const fn of listeners) { try { fn(payload); } catch { /* one bad subscriber must not break the rest */ } }
  };

  function stop(reason = 'USER_STOPPED') {
    if (state === READ_ALOUD_STATE.IDLE) return;
    activeController?.abort();
    try { synth.cancel(); } catch { /* engine may already be idle */ }
    emit(reason, {playbackId});
    state = READ_ALOUD_STATE.IDLE;
    activeToken = null;
    notify();
  }

  function fail(id, reason) {
    if (playbackId !== id) return;
    emit('ERROR', {playbackId: id, reason});
    notify({state: READ_ALOUD_STATE.ERROR, reason});
    state = READ_ALOUD_STATE.IDLE;
    activeToken = null;
    notify();
  }

  async function play(chunks, {lang = 'ko-KR', token} = {}) {
    stop();
    if (!chunks?.length) return;

    const myId = ++playbackId;
    const ac = new AbortController();
    activeController = ac;
    activeToken = token;
    state = READ_ALOUD_STATE.PREPARING;
    emit('PLAY_REQUESTED', {playbackId: myId});
    notify();

    const isSuperseded = () => playbackId !== myId;
    const isAborted = () => ac.signal.aborted;

    emit('VOICE_REGISTRY_PREPARING', {playbackId: myId});
    let voices = readVoicesSafe(synth);
    if (!voices.length) voices = await awaitVoicesReady(synth, {timeoutMs: voiceReadyTimeoutMs, signal: ac.signal});
    if (isSuperseded()) { emit('STALE_PLAYBACK', {playbackId: myId}); return; }
    if (isAborted()) return;
    if (!voices.length) { fail(myId, 'VOICES_NOT_READY'); return; }

    let voice = pickBestKoreanVoice(voices);
    if (!voice) { fail(myId, 'NO_KOREAN_VOICE'); return; }
    emit('VOICE_SELECTED', {playbackId: myId, network: voice.localService === false});

    state = READ_ALOUD_STATE.PLAYING;
    notify();

    let firstSoundStarted = false;
    let fallbackUsed = false;
    for (let index = 0; index < chunks.length; index += 1) {
      if (isSuperseded()) { emit('STALE_PLAYBACK', {playbackId: myId}); return; }
      if (isAborted()) return;

      emit('PLAY_START_REQUESTED', {playbackId: myId, chunk: index});
      // eslint-disable-next-line no-await-in-loop -- one chunk at a time is the point: see file header.
      const result = await speakChunk(synth, {text: chunks[index], lang, voice}, {
        signal: ac.signal,
        onStart: () => { firstSoundStarted = true; emit('PLAY_STARTED', {playbackId: myId, chunk: index}); },
      });
      if (isSuperseded()) { emit('STALE_PLAYBACK', {playbackId: myId}); return; }
      if (isAborted()) return;

      if (!result.ok && !firstSoundStarted && !fallbackUsed) {
        // Bounded to once, and only before any sound has played: retrying a
        // voice mid-answer would either overlap audio or restart from
        // scratch, both explicitly out of contract.
        const alternate = selectKoreanVoice(voices, {avoidNames: new Set([voice.name])});
        if (alternate) {
          fallbackUsed = true;
          emit('FALLBACK', {playbackId: myId, reason: result.reason});
          voice = alternate;
          index -= 1;
          continue;
        }
      }
      if (!result.ok) { fail(myId, result.reason === 'CANCELLED' ? 'INTERRUPTED' : result.reason); return; }
      emit('CHUNK_COMPLETED', {playbackId: myId, chunk: index});
    }

    if (isSuperseded() || isAborted()) return;
    emit('PLAY_COMPLETED', {playbackId: myId});
    state = READ_ALOUD_STATE.IDLE;
    activeToken = null;
    notify();
  }

  // Web lifecycle contract: navigating away or backgrounding the tab stops
  // playback; neither ever auto-resumes it. Nothing here can observe a call,
  // Bluetooth route change or other output-device state, so none is assumed.
  doc?.addEventListener?.('visibilitychange', () => { if (doc.hidden) stop('PAGE_HIDDEN'); });
  win?.addEventListener?.('pagehide', () => stop('PAGE_HIDDEN'));

  return {
    play,
    stop,
    getState: () => ({state, token: activeToken}),
    onStateChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
