export const ATTACHMENT_MAX_COUNT = 4;
export const ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024;
export const ATTACHMENT_MEDIA_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

function hasPrefix(bytes, prefix) {
  return prefix.every((value, index) => bytes[index] === value);
}

function contentMatches(mediaType, bytes) {
  if (mediaType === 'image/jpeg') return hasPrefix(bytes, [0xff, 0xd8, 0xff]);
  if (mediaType === 'image/png') return hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mediaType === 'image/webp') return hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46]) && hasPrefix(bytes.slice(8), [0x57, 0x45, 0x42, 0x50]);
  if (mediaType === 'application/pdf') return hasPrefix(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  return false;
}

export async function validateAttachmentFiles(files, existingCount = 0) {
  const selected = Array.from(files || []);
  if (existingCount + selected.length > ATTACHMENT_MAX_COUNT) throw new Error('첨부 파일은 메시지당 최대 4개까지 선택할 수 있습니다.');
  const validated = [];
  for (const file of selected) {
    if (!(file instanceof Blob) || typeof file.name !== 'string') throw new Error('첨부 파일을 읽을 수 없습니다.');
    if (!ATTACHMENT_MEDIA_TYPES.includes(file.type)) throw new Error('지원하지 않는 파일 형식입니다. JPEG, PNG, WebP, PDF만 첨부할 수 있습니다.');
    if (file.size <= 0) throw new Error('빈 파일은 첨부할 수 없습니다.');
    if (file.size > ATTACHMENT_MAX_BYTES) throw new Error('첨부 파일은 개별 8MB 이하여야 합니다.');
    const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (!contentMatches(file.type, bytes)) throw new Error('파일 내용과 형식이 일치하지 않습니다.');
    validated.push(file);
  }
  return validated;
}

export function safeAttachmentName(value) {
  const name = String(value || '파일').replace(/[\u0000-\u001f\u007f/\\]/g, '_').trim();
  return (name || '파일').slice(0, 160);
}
