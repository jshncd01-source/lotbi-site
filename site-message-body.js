export const LONG_MESSAGE_CHARACTER_THRESHOLD = 560;
export const LONG_MESSAGE_LINE_THRESHOLD = 9;
export const LONG_MESSAGE_RENDERED_HEIGHT = 272;

let messageBodySequence = 0;

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
    if (match.index > cursor) appendInlineCode(body, text.slice(cursor, match.index));
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
  if (cursor < text.length) appendInlineCode(body, text.slice(cursor));
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
