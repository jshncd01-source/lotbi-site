// SITE-VOICE-READ-ALOUD-RELIABILITY-02
//
// BrowserSpeech driver — the only file that touches window.speechSynthesis
// directly. Everything here is a thin, cancellable wrapper: readiness
// waiting and one-utterance-at-a-time playback, both driven by an
// AbortSignal so a caller can walk away from either mid-flight without the
// browser engine's own async callbacks (voiceschanged, onend, onerror)
// touching state that no longer belongs to them.
//
// Root cause this exists to fix: the previous implementation (see git
// history of site-conversation.js, SITE-VOICE-BROWSER-TTS-01) queued every
// chunk of a long answer with back-to-back speechSynthesis.speak() calls in
// a single synchronous loop, right after a cancel(). Chromium-based engines
// (Chrome/Samsung Internet on Android in particular) are documented to
// silently drop or stall utterances queued that way while the engine is
// still settling from a cancel() — this is what produced "press once,
// nothing happens; press again, it works." Playback now advances one chunk
// at a time, only after the previous chunk's onend/onerror actually fires.

export function speechAvailable(scope = globalThis) {
  return typeof scope.speechSynthesis !== 'undefined'
    && typeof scope.SpeechSynthesisUtterance === 'function';
}

export function readVoicesSafe(synth) {
  try { return synth.getVoices() || []; } catch { return []; }
}

// Bounded, cancellable voice-list readiness. Unlike a bare fixed timeout,
// a caller-supplied AbortSignal lets a superseded or stopped request walk
// away without resolving into a stale playback, and a timeout here means
// VOICES_NOT_READY (the list may still arrive), never NO_KOREAN_VOICE
// (there truly are none once it does) — callers must tell the two apart.
export function awaitVoicesReady(synth, {timeoutMs = 1500, signal} = {}) {
  const existing = readVoicesSafe(synth);
  if (existing.length) return Promise.resolve(existing);
  if (signal?.aborted) return Promise.resolve([]);
  return new Promise(resolve => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      globalThis.clearTimeout(timer);
      synth.removeEventListener?.('voiceschanged', finish);
      signal?.removeEventListener?.('abort', finish);
      resolve(readVoicesSafe(synth));
    };
    const timer = globalThis.setTimeout(finish, timeoutMs);
    synth.addEventListener?.('voiceschanged', finish, {once: true});
    signal?.addEventListener?.('abort', finish, {once: true});
  });
}

const ERROR_REASON_BY_SPEECH_ERROR = {
  canceled: 'CANCELLED',
  cancelled: 'CANCELLED',
  interrupted: 'INTERRUPTED',
  network: 'NETWORK_ERROR',
  'synthesis-failed': 'SYNTHESIS_FAILED',
  'synthesis-unavailable': 'SYNTHESIS_UNAVAILABLE',
  'voice-unavailable': 'VOICE_UNAVAILABLE',
  'language-unavailable': 'VOICE_UNAVAILABLE',
  'audio-busy': 'SYNTHESIS_FAILED',
  'audio-hardware': 'SYNTHESIS_FAILED',
  'not-allowed': 'SYNTHESIS_FAILED',
  'text-too-long': 'SYNTHESIS_FAILED',
  'invalid-argument': 'SYNTHESIS_FAILED',
};

export function mapSpeechError(event) {
  const key = String(event?.error || '').toLowerCase();
  return ERROR_REASON_BY_SPEECH_ERROR[key] || 'UNKNOWN';
}

// Speaks exactly one utterance and resolves once the engine is done with it
// — never queued alongside another. onStart fires only once the engine has
// actually begun speaking, which is what the caller uses to bound the
// one-time voice fallback to "before any sound played".
export function speakChunk(synth, {text, lang, voice}, {signal, onStart} = {}) {
  return new Promise(resolve => {
    if (signal?.aborted) { resolve({ok: false, reason: 'CANCELLED'}); return; }
    let utterance;
    try {
      utterance = new globalThis.SpeechSynthesisUtterance(text);
    } catch {
      resolve({ok: false, reason: 'SYNTHESIS_UNAVAILABLE'});
      return;
    }
    utterance.lang = lang;
    if (voice) utterance.voice = voice;
    let settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener?.('abort', onAbort);
      resolve(result);
    };
    utterance.onstart = () => { try { onStart?.(); } catch { /* UI-side listener error must not break playback */ } };
    utterance.onend = () => finish({ok: true});
    utterance.onerror = event => finish({ok: false, reason: mapSpeechError(event)});
    const onAbort = () => {
      try { synth.cancel(); } catch { /* engine may already be idle */ }
      finish({ok: false, reason: 'CANCELLED'});
    };
    signal?.addEventListener?.('abort', onAbort, {once: true});
    try {
      synth.speak(utterance);
    } catch {
      finish({ok: false, reason: 'SYNTHESIS_FAILED'});
    }
  });
}
