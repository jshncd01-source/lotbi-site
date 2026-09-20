export const ATTACHMENT_MAX_COUNT = 3;
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_TEXT_MAX_BYTES = 2 * 1024 * 1024;
export const ATTACHMENT_MAX_TOTAL_BYTES = 20 * 1024 * 1024;
export const ATTACHMENT_MEDIA_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
  'application/json',
]);

const TEXT_TYPES = new Set(['text/plain', 'text/csv', 'application/json']);
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function hasPrefix(bytes, prefix) {
  return prefix.every((value, index) => bytes[index] === value);
}

function contentMatches(mediaType, bytes) {
  if (mediaType === 'image/jpeg') return hasPrefix(bytes, [0xff, 0xd8, 0xff]);
  if (mediaType === 'image/png') return hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mediaType === 'application/pdf') return hasPrefix(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  if (mediaType === DOCX) return hasPrefix(bytes, [0x50, 0x4b, 0x03, 0x04]);
  return TEXT_TYPES.has(mediaType);
}

async function validateTextFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.includes(0)) throw new Error('텍스트 파일에 바이너리 데이터가 포함되어 있습니다.');
  let text;
  try {
    text = new TextDecoder('utf-8', {fatal: true}).decode(bytes);
  } catch {
    throw new Error('텍스트 파일은 UTF-8 형식이어야 합니다.');
  }
  if (file.type === 'application/json') {
    try { JSON.parse(text); }
    catch { throw new Error('JSON 파일 형식이 올바르지 않습니다.'); }
  }
}

export async function validateAttachmentFiles(files, existing = []) {
  const selected = Array.from(files || []);
  const current = Array.isArray(existing) ? existing : [];
  if (!selected.length) return [];
  if (current.length + selected.length > ATTACHMENT_MAX_COUNT) {
    throw new Error('첨부 파일은 메시지당 최대 3개까지 선택할 수 있습니다.');
  }

  const currentBytes = current.reduce((sum, item) => sum + Number(item?.sizeBytes || item?.file?.size || 0), 0);
  let selectedBytes = 0;
  const validated = [];
  for (const file of selected) {
    if (!(file instanceof Blob) || typeof file.name !== 'string') throw new Error('첨부 파일을 읽을 수 없습니다.');
    if (!ATTACHMENT_MEDIA_TYPES.includes(file.type)) {
      throw new Error('지원하지 않는 파일 형식입니다. JPEG, PNG, PDF, DOCX, TXT, CSV, JSON 파일만 첨부할 수 있습니다.');
    }
    if (file.size <= 0) throw new Error('빈 파일은 첨부할 수 없습니다.');
    const maxBytes = TEXT_TYPES.has(file.type) ? ATTACHMENT_TEXT_MAX_BYTES : ATTACHMENT_MAX_BYTES;
    if (file.size > maxBytes) {
      throw new Error(TEXT_TYPES.has(file.type) ? '텍스트 파일은 개별 2MB 이하여야 합니다.' : '첨부 파일은 개별 10MB 이하여야 합니다.');
    }
    selectedBytes += file.size;
    if (currentBytes + selectedBytes > ATTACHMENT_MAX_TOTAL_BYTES) {
      throw new Error('한 메시지의 첨부 파일 합계는 20MB 이하여야 합니다.');
    }
    const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (!contentMatches(file.type, bytes)) throw new Error('파일 내용과 형식이 일치하지 않습니다.');
    if (TEXT_TYPES.has(file.type)) await validateTextFile(file);
    validated.push(file);
  }
  return validated;
}

export function safeAttachmentName(value) {
  const name = String(value || '파일').replace(/[\u0000-\u001f\u007f/\\]/g, '_').trim();
  return (name || '파일').slice(0, 150);
}

export function attachmentKindLabel(mediaType) {
  if (String(mediaType || '').startsWith('image/')) return '이미지';
  if (mediaType === 'application/pdf') return 'PDF';
  if (mediaType === DOCX) return 'DOCX';
  if (mediaType === 'text/csv') return 'CSV';
  if (mediaType === 'application/json') return 'JSON';
  return '파일';
}
