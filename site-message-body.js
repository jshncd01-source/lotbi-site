export const LONG_MESSAGE_CHARACTER_THRESHOLD = 560;
export const LONG_MESSAGE_LINE_THRESHOLD = 9;
export const LONG_MESSAGE_RENDERED_HEIGHT = 272;

let messageBodySequence = 0;

// SITE-ANSWER-MARKDOWN-01 — the model answers in Markdown and this file only
// understood code fences and backticks, so **강조** reached the reader as
// literal asterisks. Bold, list items and paragraph breaks are handled here now.
//
// Every node is built with createElement and textContent. No markup string
// derived from the model is ever handed to the DOM for parsing — model output
// is untrusted, and that is not negotiable, so this stays a small hand-rolled
// renderer rather than a Markdown library with an HTML backend.

// Splits a line into text and <strong> runs. **bold** only; a lone or unclosed
// asterisk is left exactly as the model wrote it rather than swallowed.
function appendEmphasis(container, value) {
  const text = String(value ?? '');
  const pattern = /\*\*([^*\n]+)\*\*/g;
  let cursor = 0;
  let match;
  while ((match = pattern.exec(text))) {
    if (match.index > cursor) appendInlineCode(container, text.slice(cursor, match.index));
    const strong = document.createElement('strong');
    appendInlineCode(strong, match[1]);
    container.appendChild(strong);
    cursor = pattern.lastIndex;
  }
  if (cursor < text.length) appendInlineCode(container, text.slice(cursor));
}

const LIST_ITEM = /^\s{0,3}(?:[-*+]|\d{1,3}[.)])\s+(.*)$/;

// Turns a run of plain text into block nodes: bullet lists become <ul>, blank
// lines separate <p>, and single newlines stay line breaks inside a paragraph.
function appendRichText(container, value) {
  const text = String(value ?? '');
  if (!text) return;
  let list = null;
  let paragraph = null;
  const closeList = () => { list = null; };
  const closeParagraph = () => { paragraph = null; };
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) { closeList(); closeParagraph(); continue; }
    const item = line.match(LIST_ITEM);
    if (item) {
      closeParagraph();
      if (!list) { list = document.createElement('ul'); list.className = 'chat-message-list'; container.appendChild(list); }
      const li = document.createElement('li');
      appendEmphasis(li, item[1]);
      list.appendChild(li);
      continue;
    }
    closeList();
    if (!paragraph) { paragraph = document.createElement('p'); paragraph.className = 'chat-message-paragraph'; container.appendChild(paragraph); }
    else paragraph.appendChild(document.createElement('br'));
    appendEmphasis(paragraph, line);
  }
}

function appendInlineCode(container, value) {
  const text = String(value ?? '');
  const pattern = /`([^`\n]+)`/g;
  let cursor = 0;
  let match;
  while ((match = pattern.exec(text))) {
    if (match.index > cursor) container.appendChild(document.createTextNode(text.slice(cursor, match.index)));
    const code = document.createElement('code');
    code.className = 'chat-inline-code';
    code.textContent = match[1];
    container.appendChild(code);
    cursor = pattern.lastIndex;
  }
  if (cursor < text.length) container.appendChild(document.createTextNode(text.slice(cursor)));
}

const SVG_NS = 'http://www.w3.org/2000/svg';

// Icon-only control for a message's action row. Built node by node, like every
// other message node here, so no markup string is ever parsed.
export function createIconButton({className, label, iconPath, dataset = {}}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('aria-label', label);
  button.title = label;
  for (const [key, value] of Object.entries(dataset)) button.dataset[key] = value;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', iconPath);
  svg.appendChild(path);
  button.appendChild(svg);
  return button;
}

export function createSafeMessageBody(value) {
  const text = String(value ?? '');
  const body = document.createElement('div');
  body.className = 'chat-message-body';

  const fence = /```([^\n`]*)\n?([\s\S]*?)```/g;
  let cursor = 0;
  let match;
  while ((match = fence.exec(text))) {
    if (match.index > cursor) appendRichText(body, text.slice(cursor, match.index));
    const pre = document.createElement('pre');
    pre.className = 'chat-code-block';
    const code = document.createElement('code');
    const language = String(match[1] || '').trim();
    if (language) code.dataset.language = language.slice(0, 40);
    code.textContent = match[2];
    pre.appendChild(code);
    body.appendChild(pre);
    cursor = fence.lastIndex;
  }
  if (cursor < text.length) appendRichText(body, text.slice(cursor));
  return body;
}

export function isLongUserMessage(value) {
  const text = String(value ?? '');
  if (text.length >= LONG_MESSAGE_CHARACTER_THRESHOLD) return true;
  return text.split(/\r?\n/).length >= LONG_MESSAGE_LINE_THRESHOLD;
}

function ensureMessageBodyId(body) {
  if (body.id) return body.id;
  messageBodySequence += 1;
  body.id = `chat-message-body-${messageBodySequence}`;
  return body.id;
}

function mountExpandControl(article, body) {
  const existing = article.querySelector('.chat-message-expand-button');
  if (existing) return existing;

  article.classList.add('is-collapsible');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'chat-message-expand-button';
  button.setAttribute('aria-controls', ensureMessageBodyId(body));

  const setExpanded = expanded => {
    article.classList.toggle('is-expanded', expanded);
    button.setAttribute('aria-expanded', String(expanded));
    button.textContent = expanded ? '접기' : '더 보기';
  };
  setExpanded(false);
  button.addEventListener('click', () => setExpanded(!article.classList.contains('is-expanded')));
  article.appendChild(button);
  return button;
}

export function enhanceExpandableUserMessage(article, body, value) {
  const text = String(value ?? '');
  if (isLongUserMessage(text)) return mountExpandControl(article, body);

  const probeRenderedHeight = () => {
    if (body.scrollHeight > LONG_MESSAGE_RENDERED_HEIGHT) mountExpandControl(article, body);
  };
  if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(probeRenderedHeight);
  else if (typeof globalThis.setTimeout === 'function') globalThis.setTimeout(probeRenderedHeight, 0);
  return null;
}
