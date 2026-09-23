// SITE-VOICE-WAKE-PHRASE-MATCH-01
//
// Recognising "롯비야" in what the speech engine actually returns.
//
// Core's consumer page matches the wake phrase with indexOf on the exact
// string. On a real Android handset the engine wrote "소피아 루" for a clear
// "롯비야", so indexOf returned -1 and the wake never fired. Exact matching
// cannot carry this feature; the engine is not accurate enough for it.
//
// Two layers, in order, and both only at the head of the utterance. Searching
// the whole sentence would wake LOTBI in the middle of ordinary conversation,
// which is worse than missing a call.
//
//   1. A variant list, derived by rule rather than listed by hand.
//   2. Jamo-level edit distance, for the near misses no rule anticipated.

export const LOTBI_WAKE_PHRASE = '롯비야';

// Spacing and punctuation the engine sprinkles through its output.
const WAKE_NOISE = /[\s,.!?·~…]/g;

export function normalizeWakeText(value) {
  return String(value || '').toLowerCase().replace(WAKE_NOISE, '');
}

// --- Hangul → jamo -------------------------------------------------------
// Comparing syllables hides how close two mishearings are: 롯 and 롣 differ by
// one final consonant but are simply unequal as characters. Decomposing first
// lets edit distance see that difference as the single substitution it is.

const HANGUL_FIRST = 0xac00;
const HANGUL_LAST = 0xd7a3;
const LEAD = [...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'];
const VOWEL = [...'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'];
const TAIL = [...'\u0000ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];

export function toJamo(text) {
  let out = '';
  for (const char of String(text || '')) {
    const code = char.codePointAt(0);
    if (code < HANGUL_FIRST || code > HANGUL_LAST) { out += char; continue; }
    const offset = code - HANGUL_FIRST;
    out += LEAD[Math.floor(offset / 588)];
    out += VOWEL[Math.floor((offset % 588) / 28)];
    const tail = TAIL[offset % 28];
    if (tail !== '\u0000') out += tail;
  }
  return out;
}

function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length || !b.length) return a.length || b.length;
  let previous = Array.from({length: b.length + 1}, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

// --- Variants ------------------------------------------------------------
// Built from the three confusions that actually apply to 롯비야, rather than a
// hand-written list of guesses. Each rule is a real Korean confusion the
// engine makes, and the product of the three is small enough to read:
//
//   롯 — the final ㅅ neutralises to [t], so ㅅ/ㅆ/ㄷ come back interchangeably
//   비 — ㅂ is often returned aspirated or tensed: ㅍ, ㅃ
//   야 — the unstressed final vowel flattens toward ㅏ/ㅓ, and drops to 이
//
// Anything a rule cannot reach is listed below as an observed value, not
// invented.
const WAKE_HEAD = ['롯', '롣', '롰'];
const WAKE_MID = ['비', '피', '삐'];
const WAKE_TAIL = ['야', '아', '여', '이'];

function derivedWakeVariants() {
  const variants = new Set();
  for (const head of WAKE_HEAD) {
    for (const mid of WAKE_MID) {
      for (const tail of WAKE_TAIL) variants.add(head + mid + tail);
    }
  }
  return variants;
}

// Measured on the owner's own Android handset: a clear "롯비야" came back as
// "소피아 루". No phonetic rule reaches that — the engine rewrote the phrase
// into two familiar words and reordered them — so it is recorded here as the
// observation it is. Add to this list only from a real, reported transcript;
// never from a guess, and never by logging what people say.
const OBSERVED_WAKE_VARIANTS = ['소피아루'];

const WAKE_VARIANTS = (() => {
  const variants = derivedWakeVariants();
  variants.add(normalizeWakeText(LOTBI_WAKE_PHRASE));
  for (const observed of OBSERVED_WAKE_VARIANTS) variants.add(normalizeWakeText(observed));
  // Longest first, so "롯비야" wins over a shorter variant that also prefixes
  // it and the command is cut at the right place.
  return [...variants].sort((a, b) => b.length - a.length);
})();

export const WAKE_VARIANT_COUNT = WAKE_VARIANTS.length;

// --- Fuzzy head match ----------------------------------------------------
// Distance is measured in jamo, so the budget is in jamo too. "롯비야" is seven
// jamo; two edits is roughly one mangled syllable, which catches near misses
// without opening the door to ordinary words.
const WAKE_JAMO_DISTANCE_LIMIT = 2;
// How many leading syllables may stand in for the phrase. The phrase is three,
// and an engine that splits or merges one syllable stays inside this window.
const WAKE_HEAD_SYLLABLES = [2, 3, 4];

const WAKE_JAMO = toJamo(normalizeWakeText(LOTBI_WAKE_PHRASE));

function matchedHeadLength(normalized) {
  for (const variant of WAKE_VARIANTS) {
    if (normalized.startsWith(variant)) return variant.length;
  }
  for (const size of WAKE_HEAD_SYLLABLES) {
    if (normalized.length < size) continue;
    const head = normalized.slice(0, size);
    const jamo = toJamo(head);
    // The onset has to survive. Without this, a two-edit budget reaches common
    // words that merely rhyme with the phrase — "보비야" called to a dog is two
    // edits from "롯비야" and would wake LOTBI across the room. A mishearing
    // that loses the leading ㄹ outright is the variant list's job, not this
    // one's, so nothing measured is given up by requiring it here.
    if (jamo[0] !== WAKE_JAMO[0]) continue;
    if (editDistance(jamo, WAKE_JAMO) <= WAKE_JAMO_DISTANCE_LIMIT) return size;
  }
  return 0;
}

/**
 * Split an utterance into the wake call and the command that followed it.
 * Returns {matched: false, command: ''} when the head is not a wake call.
 */
export function parseWakeUtterance(value) {
  const raw = String(value || '').trim();
  const normalized = normalizeWakeText(raw);
  const consumed = matchedHeadLength(normalized);
  if (!consumed) return {matched: false, command: ''};
  // Walk the raw text until the same number of significant characters has gone
  // by, so the command keeps its original spacing and punctuation.
  let cut = raw.length;
  let seen = 0;
  for (let i = 0; i < raw.length; i += 1) {
    if (!/[\s,.!?·~…]/.test(raw[i])) seen += 1;
    if (seen >= consumed) { cut = i + 1; break; }
  }
  const command = raw.slice(cut).replace(/^[\s,.!?·~…]+/, '').trim();
  return {matched: true, command};
}

/**
 * Drop a leading wake call from dictated text. Returns the text unchanged when
 * it does not open with one, and never returns a guess for what was not heard.
 */
export function stripWakePrefix(value) {
  const raw = String(value || '').trim();
  const parsed = parseWakeUtterance(raw);
  if (!parsed.matched) return raw;
  // "롯비야" on its own is a call with nothing after it. Keep the caller's
  // text rather than handing back an empty string it would have to special-case.
  return parsed.command || '';
}
