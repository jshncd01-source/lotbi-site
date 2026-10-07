// SAFECARE-PHOTO-UPLOAD-FIX-03 — get a picked photo into the shape Core takes.
//
// Core stores identity photos only from JPEG or PNG data URIs of at most 10 MB
// (lotbi-core app/pet_photo_store.py) and judges their content itself. Phones
// and PCs hand the browser HEIC/HEIF originals, WebP, 10-50 MB JPEGs and files
// whose MIME type is empty; before this module the Site refused those with
// "JPG, PNG, WEBP 사진만…" (even a real JPG with an empty type) and never
// asked Core. Here the file is recognised by its first bytes, a JPEG/PNG that
// already fits is sent unchanged, anything else the browser can open is
// re-encoded to JPEG (long edge at most 2400 px, the range the Core gate was
// measured on), and a photo that cannot be used says why. Nothing here judges
// what the photo shows.

export const PERSON_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';
// Sent unchanged up to this size: base64 of 8 MB stays well inside Core's
// 14 MB request body and 10 MB image limits.
export const PERSON_PHOTO_PASS_MAX_BYTES = 8 * 1024 * 1024;
// Core refuses larger frames (PET_PHOTO_MAX_EDGE / PET_PHOTO_MAX_PIXELS).
export const PERSON_PHOTO_CORE_MAX_EDGE = 8192;
export const PERSON_PHOTO_CORE_MAX_PIXELS = 40_000_000;
export const PERSON_PHOTO_MAX_EDGE = 2400;
export const PERSON_PHOTO_JPEG_QUALITY = 0.9;

export const PERSON_PHOTO_PREPARE_MESSAGES = Object.freeze({
  PERSON_PHOTO_READ_FAILED: '사진 파일을 읽지 못했습니다. 휴대폰이나 PC에 저장된 사진을 다시 선택해 주세요.',
  PERSON_PHOTO_HEIC_UNSUPPORTED: 'HEIC(고효율) 사진은 이 브라우저에서 열 수 없습니다. 아이폰은 설정 › 카메라 › 포맷 › ‘높은 호환성’, 갤럭시는 카메라 설정 › ‘고효율 사진’을 끈 뒤 찍은 사진을 선택하거나, 사진을 JPG로 저장해 다시 선택해 주세요.',
  PERSON_PHOTO_NOT_IMAGE: '사진 파일이 아닙니다. JPG 또는 PNG 사진을 선택해 주세요.',
  PERSON_PHOTO_DECODE_FAILED: '사진을 열 수 없습니다. 다른 JPG 또는 PNG 사진을 선택해 주세요.',
});

export class PersonPhotoPrepareError extends Error {
  constructor(code) {
    super(PERSON_PHOTO_PREPARE_MESSAGES[code] || code);
    this.name = 'PersonPhotoPrepareError';
    this.code = code;
  }
}

export function personPhotoPrepareMessage(error) {
  return PERSON_PHOTO_PREPARE_MESSAGES[error?.code] || PERSON_PHOTO_PREPARE_MESSAGES.PERSON_PHOTO_DECODE_FAILED;
}

const HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1']);
const ascii = (bytes, start, end) => String.fromCharCode(...bytes.slice(start, end));

// The file's real kind from its first bytes ('' when unknown).
export function sniffImageKind(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return 'png';
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'webp';
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === 'ftyp') {
    const brand = ascii(bytes, 8, 12);
    if (brand === 'avif' || brand === 'avis') return 'avif';
    if (HEIF_BRANDS.has(brand)) return 'heic';
  }
  if (bytes.length >= 6 && /^GIF8[79]a$/.test(ascii(bytes, 0, 6))) return 'gif';
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return 'bmp';
  return '';
}

// Bytes first; the browser's MIME type and the file name only when the bytes say nothing.
export function personPhotoKind(bytes, type = '', name = '') {
  const sniffed = sniffImageKind(bytes);
  if (sniffed) return sniffed;
  if (/^image\/(heic|heif)/i.test(type) || /\.(heic|heif)$/i.test(name)) return 'heic';
  return /^image\//i.test(type) ? 'image' : '';
}

function base64(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

async function readBytes(blob) {
  try { return new Uint8Array(await blob.arrayBuffer()); }
  catch { throw new PersonPhotoPrepareError('PERSON_PHOTO_READ_FAILED'); }
}

// Browser decode with the EXIF rotation applied; {source, width, height, close}.
export async function decodePersonPhoto(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, {imageOrientation: 'from-image'});
      return {source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close()};
    } catch { /* Safari opens some formats (HEIC) only through <img>. */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    return {source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url)};
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

// JPEG of the decoded photo, long edge at most maxEdge (never enlarged).
export async function encodePersonPhotoJpeg(decoded, maxEdge = PERSON_PHOTO_MAX_EDGE, quality = PERSON_PHOTO_JPEG_QUALITY) {
  const scale = Math.min(1, maxEdge / Math.max(decoded.width, decoded.height));
  const width = Math.max(1, Math.round(decoded.width * scale));
  const height = Math.max(1, Math.round(decoded.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';  // a transparent PNG/WebP keeps a plain background
  context.fillRect(0, 0, width, height);
  context.imageSmoothingQuality = 'high';
  context.drawImage(decoded.source, 0, 0, width, height);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('PHOTO_ENCODE_FAILED');
  return blob;
}

const fits = decoded => !decoded || (
  Math.max(decoded.width, decoded.height) <= PERSON_PHOTO_CORE_MAX_EDGE
  && decoded.width * decoded.height <= PERSON_PHOTO_CORE_MAX_PIXELS
);

// {dataUri, mime, converted} for Core, or PersonPhotoPrepareError with a code
// from PERSON_PHOTO_PREPARE_MESSAGES. decode/encode are injectable for tests.
export async function preparePersonPhoto(file, {decode = decodePersonPhoto, encode = encodePersonPhotoJpeg} = {}) {
  const head = await readBytes(file.slice(0, 32));
  if (!head.length) throw new PersonPhotoPrepareError('PERSON_PHOTO_READ_FAILED');
  const kind = personPhotoKind(head, file.type || '', file.name || '');
  let decoded = null;
  try {
    try { decoded = await decode(file); }
    catch {
      if ((kind === 'jpeg' || kind === 'png') && file.size <= PERSON_PHOTO_PASS_MAX_BYTES) decoded = null;  // Core decides
      else if (kind === 'heic') throw new PersonPhotoPrepareError('PERSON_PHOTO_HEIC_UNSUPPORTED');
      else throw new PersonPhotoPrepareError(kind ? 'PERSON_PHOTO_DECODE_FAILED' : 'PERSON_PHOTO_NOT_IMAGE');
    }
    if ((kind === 'jpeg' || kind === 'png') && file.size <= PERSON_PHOTO_PASS_MAX_BYTES && fits(decoded)) {
      // Already what Core takes: the original bytes, labelled by what they are.
      const mime = kind === 'png' ? 'image/png' : 'image/jpeg';
      return {dataUri: `data:${mime};base64,${base64(await readBytes(file))}`, mime, converted: false};
    }
    let blob;
    try { blob = await encode(decoded, PERSON_PHOTO_MAX_EDGE, PERSON_PHOTO_JPEG_QUALITY); }
    catch { throw new PersonPhotoPrepareError('PERSON_PHOTO_DECODE_FAILED'); }
    return {dataUri: `data:image/jpeg;base64,${base64(await readBytes(blob))}`, mime: 'image/jpeg', converted: true};
  } finally {
    decoded?.close?.();
  }
}
