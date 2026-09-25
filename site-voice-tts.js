// SITE-VOICE-BROWSER-TTS-QUALITY-01
//
// Picking the best voice the browser already has, for the "읽어주기" (read
// aloud) button on each LOTBI answer.
//
// Core's /v2/live/tts (ElevenLabs) is not enabled in production, so this
// stays on window.speechSynthesis — see SITE-VOICE-BROWSER-TTS-01 in
// site-conversation.js for why that fallback exists at all. What this file
// fixes is a different problem: leaving `utterance.voice` unset lets the
// engine pick *any* voice whose lang matches 'ko-KR', and on a real device
// that is often the worst one available.
//
//   - Android Chrome exposes both a compact on-device ko-KR voice and a
//     network-backed "Google 한국의" voice under the same lang tag. Nothing
//     prefers the better one automatically.
//   - iOS only offers its higher-quality "Enhanced"/"Premium" ko-KR voice
//     once the person has downloaded it in Settings, and Safari does not
//     prefer it over the compact default either.
//
// Scoring every ko* voice and setting `utterance.voice` explicitly fixes
// both, with no paid API and no new network call.

export function scoreKoreanVoice(voice) {
  let score = 0;
  if (voice.localService === false) score += 2;
  if (/enhanced|premium|neural/iu.test(voice.name || '')) score += 2;
  if (voice.default) score += 1;
  return score;
}

export function pickBestKoreanVoice(voices) {
  const korean = (voices || []).filter(voice => /^ko([-_]|$)/iu.test(voice.lang || ''));
  if (!korean.length) return undefined;
  return korean.reduce((best, voice) => (scoreKoreanVoice(voice) > scoreKoreanVoice(best) ? voice : best));
}

// Chrome (and some Android WebViews) load the voice list asynchronously: the
// very first getVoices() call after a fresh page load returns an empty array,
// with 'voiceschanged' firing once the real list is ready. Without this wait
// that first click always reported "이 기기에 설치된 음성이 없어..." even though
// the device has ko-KR voices a moment later. Not every engine ever fires the
// event, so this still resolves via the timeout rather than hanging.
export function waitForVoices(synth = globalThis.speechSynthesis, {timeoutMs = 300} = {}) {
  const existing = synth.getVoices() || [];
  if (existing.length) return Promise.resolve(existing);
  return new Promise(resolve => {
    const finish = () => {
      globalThis.clearTimeout(timer);
      synth.removeEventListener?.('voiceschanged', finish);
      resolve(synth.getVoices() || []);
    };
    const timer = globalThis.setTimeout(finish, timeoutMs);
    synth.addEventListener?.('voiceschanged', finish, {once: true});
  });
}
