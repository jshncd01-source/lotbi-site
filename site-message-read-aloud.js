// CHAT-READ-ALOUD-RESTORE-P0 — the "읽어주기" button under each LOTBI answer.
//
// Restores only the button 18fd804c took out of the answer tools, on the
// engine that never left the repository: site-read-aloud-controller.js (one
// playback owner per page, one chunk at a time) over site-read-aloud-speech.js
// (window.speechSynthesis), with site-voice-tts.js keeping to voices the
// device runs itself. Nothing here talks to a server — no /v2/live/tts, no
// paid voice provider, no new answer and no usage count: the answer already
// on screen is spoken on the device, and only when the person presses the
// button. Microphone input, live voice and the "롯비야" wake word stay behind
// PUBLIC_SITE_VOICE_RELEASE_ENABLED in site-conversation.js, untouched.
import {createReadAloudController, READ_ALOUD_STATE} from './site-read-aloud-controller.js?v=aset-7d3c08200792';
import {readVoicesSafe, speechAvailable} from './site-read-aloud-speech.js?v=aset-7d3c08200792';
import {createIconButton} from './site-message-body.js?v=aset-7d3c08200792';

// Chrome stops a long utterance partway through, so answers are read in
// sentence-sized pieces played one after another.
const SPEECH_CHUNK_LIMIT = 180;

const READ_ALOUD_ICON_SPEAK = 'M3 9v6h4l5 5V4L7 9H3Zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05A4.47 4.47 0 0 0 16.5 12ZM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54Z';
const READ_ALOUD_ICON_STOP = 'M6 6h12v12H6V6Z';

export const READ_ALOUD_LABEL = Object.freeze({
  idle: '답변 읽어주기',
  active: '읽기 중지',
  idleText: '읽어주기',
  activeText: '중지',
});

const CODE_BLOCK_NOTE = '코드는 화면에서 확인해 주세요.';
const LINK_WORD = '링크';

export const READ_ALOUD_MESSAGE = Object.freeze({
  START: '답변을 읽어 드립니다.',
  STOPPED: '읽기를 멈췄습니다.',
  EMPTY: '읽을 내용이 없습니다.',
  UNSUPPORTED: '이 브라우저는 기기 음성 읽기를 지원하지 않아 읽어 드릴 수 없어요.',
});

const READ_ALOUD_ERROR_MESSAGE = {
  VOICES_NOT_READY: '음성을 준비하지 못했습니다. 다시 눌러 주세요.',
  NO_KOREAN_VOICE: '이 기기에 설치된 한국어 음성이 없어 읽어 드릴 수 없어요.',
  // Only network voices: said plainly, and never swapped for one.
  NO_LOCAL_KOREAN_VOICE: '이 기기에서 바로 쓸 수 있는 한국어 음성이 없어 읽어 드릴 수 없어요. 인터넷 음성으로 바꾸지 않아요.',
  NETWORK_ERROR: '음성을 불러오지 못해 읽어 드리지 못했습니다.',
  VOICE_UNAVAILABLE: '선택된 음성을 사용할 수 없어 읽어 드리지 못했습니다.',
  INTERRUPTED: '읽기가 중단되었습니다.',
};
const READ_ALOUD_ERROR_MESSAGE_DEFAULT = '읽어 드리지 못했습니다.';

// Turns a Markdown answer into what a listener needs: the words, with the
// marks that only make sense on screen taken out. Code is not read at all,
// an address becomes the word "링크", and each line (a heading, a list item,
// a table row) ends as its own sentence so the voice pauses between them.
// No lookbehind anywhere: older iOS Safari cannot parse one, and one
// unparsable pattern would take the whole chat module down with it.
export function speechTextFromAnswer(value) {
  let text = String(value ?? '').replace(/\r\n?/g, '\n');
  text = text.replace(/```[^\n`]*\n?[\s\S]*?```/g, `\n${CODE_BLOCK_NOTE}\n`).replace(/```/g, ' ');
  text = text.replace(/!\[([^\]\n]*)\]\([^)\n]*\)/g, '$1');
  text = text.replace(/\[([^\]\n]+)\]\([^)\n]*\)/g, '$1');
  text = text.replace(/\b(?:https?:\/\/|www\.)[^\s<>()]+/giu, LINK_WORD);

  const lines = [];
  for (const raw of text.split('\n')) {
    let line = raw.trim();
    if (!line) continue;
    // Table separator rows and horizontal rules carry no words.
    if (/^\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?$/.test(line)) continue;
    if (/^(?:[-*_]\s*){3,}$/.test(line)) continue;
    line = line.replace(/^(?:>\s?)+/, '').replace(/^#{1,6}\s+/, '').replace(/^[-*+•]\s+/, '');
    if (line.includes('|')) line = line.split('|').map(cell => cell.trim()).filter(Boolean).join(', ');
    line = line
      .replace(/\*\*([^*\n]+)\*\*/g, '$1')
      .replace(/__([^_\n]+)__/g, '$1')
      .replace(/~~([^~\n]+)~~/g, '$1')
      .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?]|$)/g, '$1$2')
      .replace(/`([^`\n]+)`/g, '$1');
    // Some voices read pictographs and arrows out by name ("둥근 압정").
    line = line
      .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu, '')
      .replace(/[→←↑↓⇒➜▶▷►■□▪▫◆◇●○※•]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!line) continue;
    if (!/[.!?。！？…:;]$/.test(line)) line += '.';
    lines.push(line);
  }
  return lines.join(' ');
}

// Sentence-sized chunks, in order, each piece of the text exactly once.
// A word ending in sentence punctuation closes a sentence (a word walk rather
// than a lookbehind split); sentences are packed up to the limit, and one
// sentence longer than it is broken at a comma or a space, never mid-word.
export function splitForSpeech(value, limit = SPEECH_CHUNK_LIMIT) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return [];
  const sentences = [];
  let sentence = '';
  for (const word of text.split(' ')) {
    sentence = sentence ? `${sentence} ${word}` : word;
    if (/[.!?。！？…]["'”’)\]]*$/.test(word)) { sentences.push(sentence); sentence = ''; }
  }
  if (sentence) sentences.push(sentence);

  const chunks = [];
  let current = '';
  for (const piece of sentences) {
    if (current && current.length + 1 + piece.length <= limit) { current = `${current} ${piece}`; continue; }
    if (current) chunks.push(current);
    let rest = piece;
    while (rest.length > limit) {
      const head = rest.slice(0, limit + 1);
      const comma = head.lastIndexOf(', ');
      const space = head.lastIndexOf(' ');
      const cut = comma >= limit / 2 ? comma + 1 : (space > 0 ? space : limit);
      chunks.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    current = rest;
  }
  if (current) chunks.push(current);
  return chunks;
}

// Event name, playbackId, chunk index and reason codes only — never the
// answer text, never a voice name. performance.mark, like site-continuity.js.
function reportReadAloudTelemetry(event, detail) {
  try {
    globalThis.performance?.mark?.(`lotbi-read-aloud:${event}`, {detail: Object.freeze({...detail})});
  } catch { /* diagnostic-only, must never affect playback */ }
}

// One controller for the page (window.speechSynthesis is one queue however
// many buttons exist), created on the first answer that needs a button.
// undefined = not created yet, null = this browser cannot speak.
let pageController;
// The button that owns playback right now: {token, button, setUi, report}.
let currentEntry = null;

function readAloudController() {
  if (pageController !== undefined) return pageController;
  if (!speechAvailable()) { pageController = null; return pageController; }
  pageController = createReadAloudController({
    onTelemetry: (event, detail) => {
      reportReadAloudTelemetry(event, detail);
      // Safety net behind the explicit stops in site-conversation.js: an
      // answer whose node left the page must not keep talking past its
      // current sentence.
      if (event === 'PLAY_START_REQUESTED' && currentEntry && !currentEntry.button.isConnected) {
        pageController.stop('ANSWER_REMOVED');
      }
    },
  });
  pageController.onStateChange(({state, token, reason}) => {
    const entry = currentEntry;
    if (!entry) return;
    if (state === READ_ALOUD_STATE.ERROR) {
      if (token === entry.token) entry.report(READ_ALOUD_ERROR_MESSAGE[reason] || READ_ALOUD_ERROR_MESSAGE_DEFAULT, 'error');
      return;
    }
    entry.setUi(token === entry.token && (state === READ_ALOUD_STATE.PLAYING || state === READ_ALOUD_STATE.PREPARING));
  });
  // Chrome fills its voice list asynchronously; asking once now means the
  // first press usually finds it ready.
  readVoicesSafe(globalThis.speechSynthesis);
  return pageController;
}

// Called by the chat whenever the answer being read stops being the thing on
// screen: a new question, another conversation, a cleared Home, a logout.
export function stopMessageReadAloud(reason = 'USER_STOPPED') {
  pageController?.stop(reason);
}

export function createMessageReadAloudButton(text, {report = () => {}} = {}) {
  const chunks = splitForSpeech(speechTextFromAnswer(text));
  const button = createIconButton({
    className: 'chat-message-action chat-message-action-read',
    label: READ_ALOUD_LABEL.idle,
    iconPath: READ_ALOUD_ICON_SPEAK,
    dataset: {messageAction: 'speak'},
  });
  const icon = button.querySelector('path');
  const word = document.createElement('span');
  word.className = 'chat-message-action-label';
  button.appendChild(word);

  // The label carries the state; the button is the stop control from the
  // first press onward, while the voice is still being prepared.
  const setUi = active => {
    const label = active ? READ_ALOUD_LABEL.active : READ_ALOUD_LABEL.idle;
    button.setAttribute('aria-label', label);
    button.title = label;
    word.textContent = active ? READ_ALOUD_LABEL.activeText : READ_ALOUD_LABEL.idleText;
    icon?.setAttribute('d', active ? READ_ALOUD_ICON_STOP : READ_ALOUD_ICON_SPEAK);
    if (active) button.dataset.speaking = 'true'; else delete button.dataset.speaking;
  };
  setUi(false);

  // This button's identity inside the shared controller — compared by
  // reference only, never stored, never sent anywhere.
  const entry = {token: Symbol('read-aloud-token'), button, setUi, report};
  button.addEventListener('click', () => {
    const controller = readAloudController();
    if (!controller) { report(READ_ALOUD_MESSAGE.UNSUPPORTED, 'error'); return; }
    const current = controller.getState();
    if (current.token === entry.token && current.state !== READ_ALOUD_STATE.IDLE) {
      controller.stop();
      report(READ_ALOUD_MESSAGE.STOPPED);
      return;
    }
    if (!chunks.length) { report(READ_ALOUD_MESSAGE.EMPTY, 'error'); return; }
    // Starting here stops whatever else was being read — one answer at a
    // time — and the previous button goes back to 읽어주기 at once.
    if (currentEntry && currentEntry !== entry) currentEntry.setUi(false);
    currentEntry = entry;
    report(READ_ALOUD_MESSAGE.START);
    void controller.play(chunks, {lang: 'ko-KR', token: entry.token});
  });
  return button;
}
