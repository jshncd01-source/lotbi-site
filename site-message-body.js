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

// SITE-CHAT-ANSWER-QUALITY-P0 — comparison answers arrive as pipe tables
// ("| 항목 | Pro | Pro Max |"), and a phone showed the raw pipes. A table is a
// header row, a separator row of dashes, then body rows; anything less stays
// text exactly as written.
const TABLE_ROW = /^\s*\|?(.+\|.*?)\|?\s*$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)+\|?\s*$/;
const TABLE_MAX_COLUMNS = 8;
const TABLE_MAX_ROWS = 40;
const TABLE_EMPTY_CELL = '—';

// A plain character walk instead of a lookbehind regex: older iOS Safari
// cannot parse lookbehind, and one unparsable pattern would take the whole
// chat module down with it. "\|" is a literal pipe inside a cell.
function splitTableRow(line) {
  let row = String(line ?? '').trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
  const cells = [];
  let current = '';
  for (let index = 0; index < row.length; index += 1) {
    const char = row[index];
    if (char === '\\' && row[index + 1] === '|') { current += '|'; index += 1; continue; }
    if (char === '|') { cells.push(current.trim()); current = ''; continue; }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function isTableStart(lines, index) {
  const header = lines[index];
  const separator = lines[index + 1];
  if (typeof header !== 'string' || typeof separator !== 'string') return false;
  if (!TABLE_ROW.test(header) || !TABLE_SEPARATOR.test(separator)) return false;
  const columns = splitTableRow(header).length;
  return columns >= 2 && columns <= TABLE_MAX_COLUMNS && splitTableRow(separator).length === columns;
}

function appendTableCell(row, tag, value, scope) {
  const cell = document.createElement(tag);
  if (scope) cell.scope = scope;
  const text = String(value ?? '').trim();
  if (text) appendEmphasis(cell, text);
  else {
    cell.textContent = TABLE_EMPTY_CELL;
    cell.classList.add('chat-table-empty');
    cell.setAttribute('aria-label', '정보 없음');
  }
  row.appendChild(cell);
}

// Builds the table node by node, like the rest of this renderer. Rows with
// fewer cells are padded with an explicit "—" (never left to look like the
// value is zero), extra cells are folded into the last column.
function createTable(headerLine, bodyLines) {
  const header = splitTableRow(headerLine);
  const columns = header.length;
  const normalize = cells => {
    const row = cells.slice(0, columns);
    if (cells.length > columns) row[columns - 1] = cells.slice(columns - 1).join(' | ');
    while (row.length < columns) row.push('');
    return row;
  };
  const scroll = document.createElement('div');
  scroll.className = 'chat-table-scroll';
  const table = document.createElement('table');
  table.className = 'chat-message-table';
  table.dataset.columns = String(columns);
  // 항목 | A | B — two options side by side fit a phone without scrolling,
  // with a divider between the two options.
  if (columns === 3) table.classList.add('is-comparison');
  if (columns >= 4) {
    scroll.classList.add('is-wide');
    scroll.tabIndex = 0;
    scroll.setAttribute('role', 'region');
    scroll.setAttribute('aria-label', '비교 표, 옆으로 밀어서 보기');
  }
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  header.forEach(cell => appendTableCell(headRow, 'th', cell, 'col'));
  thead.appendChild(headRow);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  for (const line of bodyLines.slice(0, TABLE_MAX_ROWS)) {
    const row = document.createElement('tr');
    normalize(splitTableRow(line)).forEach((cell, index) => (
      index === 0 ? appendTableCell(row, 'th', cell, 'row') : appendTableCell(row, 'td', cell)
    ));
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  scroll.appendChild(table);
  return scroll;
}

// Turns a run of plain text into block nodes: bullet lists become <ul>, pipe
// tables become <table>, blank lines separate <p>, and single newlines stay
// line breaks inside a paragraph.
function appendRichText(container, value) {
  const text = String(value ?? '');
  if (!text) return;
  let list = null;
  let paragraph = null;
  const closeList = () => { list = null; };
  const closeParagraph = () => { paragraph = null; };
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (isTableStart(lines, index)) {
      closeList(); closeParagraph();
      const bodyLines = [];
      let next = index + 2;
      while (next < lines.length && lines[next].trim() && TABLE_ROW.test(lines[next])) {
        bodyLines.push(lines[next]);
        next += 1;
      }
      container.appendChild(createTable(line, bodyLines));
      index = next - 1;
      continue;
    }
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
