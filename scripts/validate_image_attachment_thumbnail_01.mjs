/* SITE-IMAGE-ATTACHMENT-THUMBNAIL-01
 *
 * 사진을 첨부하면 파일명이 아니라 실제 사진이 보여야 합니다.
 *
 * 1. 브라우저 로컬 preview lifecycle (object URL 생성/소유권 이전/회수)
 * 2. Composer / 전송된 메시지 / 비이미지 fallback 런타임 계약
 * 3. previewUrl 이 Core·저장소·로그로 새지 않는지
 * 4. 실제 Chromium 에서 썸네일이 잘리지 않고 가로 overflow 없이 렌더되는지
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {File} from 'node:buffer';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
const runtime = read('site-conversation.js');
const css = read('site-conversation.css');
const html = read('index.html');
const storage = read('site-conversation-storage.js');

/* ---------------------------------------------------------------- 1. preview lifecycle */

const realUrl = globalThis.URL;
let issued = 0;
const revoked = [];
globalThis.URL = {
  createObjectURL: () => `blob:https://lotbiai.com/preview-${++issued}`,
  revokeObjectURL: url => revoked.push(url),
};

const attachments = await import('../site-attachments.js');

const {
  ATTACHMENT_MEDIA_TYPES,
  ATTACHMENT_PREVIEW_MEDIA_TYPES,
  adoptAttachmentPreviewUrl,
  attachmentPreviewOwner,
  createAttachmentPreviewUrl,
  isPreviewableImageAttachment,
  releaseAllAttachmentPreviewUrls,
  releaseComposerPreviewUrl,
  releaseRenderedPreviewUrls,
  safeAttachmentName,
} = attachments;

// The upload contract is not widened by a UI preview change. WebP is
// renderer-ready but is still not an uploadable type (index.html accept and
// Core both stay as they are).
assert.deepEqual([...ATTACHMENT_MEDIA_TYPES], [
  'image/jpeg',
  'image/png',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
  'application/json',
], 'attachment upload media types must not change for a thumbnail feature');
assert.ok(!ATTACHMENT_MEDIA_TYPES.includes('image/webp'), 'WebP upload must not be enabled here');
assert.deepEqual([...ATTACHMENT_PREVIEW_MEDIA_TYPES], ['image/jpeg', 'image/png', 'image/webp']);

// Server-validated media kind wins; a filename suffix never promotes a file.
assert.equal(isPreviewableImageAttachment({mediaType: 'image/png'}), true);
assert.equal(isPreviewableImageAttachment({mimeType: 'image/jpeg', mediaKind: 'IMAGE'}), true);
assert.equal(isPreviewableImageAttachment({mimeType: 'image/webp', mediaKind: 'IMAGE'}), true);
assert.equal(isPreviewableImageAttachment({mediaType: 'image/png', mediaKind: 'DOCUMENT'}), false);
assert.equal(isPreviewableImageAttachment({mediaType: 'application/pdf'}), false);
assert.equal(isPreviewableImageAttachment({mediaType: 'text/plain'}), false);
assert.equal(isPreviewableImageAttachment(null), false);

const asFile = (name, type) => new File([new Uint8Array([1, 2, 3, 4])], name, {type});

const jpegPreview = createAttachmentPreviewUrl(asFile('21930.jpg', 'image/jpeg'));
assert.match(jpegPreview, /^blob:/, 'JPEG must produce a browser-local preview');
assert.equal(attachmentPreviewOwner(jpegPreview), 'composer');
assert.match(createAttachmentPreviewUrl(asFile('shot.png', 'image/png')), /^blob:/);
assert.match(createAttachmentPreviewUrl(asFile('shot.webp', 'image/webp')), /^blob:/);
// Content type decides, not the extension: .exe renamed to .jpg is still the
// declared type, and a binary declared as octet-stream never gets a preview.
assert.equal(createAttachmentPreviewUrl(asFile('payload.exe.jpg', 'application/octet-stream')), '');
assert.equal(createAttachmentPreviewUrl(asFile('doc.pdf', 'application/pdf')), '');
assert.equal(createAttachmentPreviewUrl(asFile('notes.txt', 'text/plain')), '');
assert.equal(createAttachmentPreviewUrl('not-a-file'), '');

// Remove / failed upload revokes immediately.
const removable = createAttachmentPreviewUrl(asFile('remove-me.png', 'image/png'));
assert.equal(releaseComposerPreviewUrl(removable), true);
assert.ok(revoked.includes(removable), 'removing an attachment must revoke its object URL');
assert.equal(releaseComposerPreviewUrl(removable), false, 'revoking twice must be a no-op');
assert.equal(attachmentPreviewOwner(removable), '');

// Sending transfers ownership to the rendered message, so composer cleanup and
// the server-side attachment delete can no longer blank the visible thumbnail.
assert.equal(adoptAttachmentPreviewUrl(jpegPreview), true);
assert.equal(attachmentPreviewOwner(jpegPreview), 'message');
const revokedBeforeClear = revoked.length;
assert.equal(releaseComposerPreviewUrl(jpegPreview), false, 'a sent thumbnail must survive composer cleanup');
assert.equal(revoked.length, revokedBeforeClear, 'clearing the composer must not revoke a sent thumbnail');
assert.equal(adoptAttachmentPreviewUrl('blob:https://lotbiai.com/unknown'), false);

assert.equal(releaseRenderedPreviewUrls(), 1, 'rebuilding the transcript releases message-owned previews');
assert.ok(revoked.includes(jpegPreview));
assert.equal(attachmentPreviewOwner(jpegPreview), '');
assert.equal(releaseAllAttachmentPreviewUrls(), 2, 'page teardown releases what is left');
assert.equal(releaseAllAttachmentPreviewUrls(), 0);

assert.equal(safeAttachmentName('../../etc/pa<sswd.jpg'), '.._.._etc_pa<sswd.jpg');

globalThis.URL = realUrl;

/* ---------------------------------------------------------------- 2. runtime contracts */

for (const token of [
  'adoptAttachmentPreviewUrl',
  'createAttachmentPreviewUrl',
  'isPreviewableImageAttachment',
  'releaseAllAttachmentPreviewUrls',
  'releaseComposerPreviewUrl',
  'releaseRenderedPreviewUrls',
]) assert.ok(runtime.includes(token), `conversation runtime must use ${token}`);

// Composer: a preview is built from the validated File before upload, and the
// uploaded attachment carries it.
assert.ok(runtime.includes('previewUrl: createAttachmentPreviewUrl(file),'), 'composer must build previews from the validated File');
assert.ok(
  runtime.includes('Object.freeze({...uploaded, previewUrl: entry.previewUrl})'),
  'the uploaded attachment must carry its browser-local preview',
);
assert.match(runtime, /attachment-chip-thumb/, 'composer chips must render a thumbnail');
assert.match(runtime, /appendChipThumbnail\(chip, item\)/);
assert.match(runtime, /attachment-chip-pending/, 'a chosen image shows a thumbnail while it uploads');

// The sent message renders the image itself, no longer a forced empty preview.
assert.ok(!runtime.includes("previewUrl: ''"), 'the send path must no longer blank previewUrl');
assert.ok(
  runtime.includes('return {id: item.id, filename: item.fileName, mediaType: item.mimeType, sizeBytes: item.sizeBytes, previewUrl};'),
  'sent attachment meta must carry the live preview',
);
assert.ok(runtime.includes('if (previewUrl) adoptAttachmentPreviewUrl(previewUrl);'), 'sending transfers preview ownership');
assert.match(runtime, /message-attachment-card-image/);
assert.match(runtime, /image\.alt = presentation\.imageAlt/, 'thumbnails must keep a generic accessible label');
assert.match(runtime, /if \(previewUrl && isPreviewableImageAttachment\(attachment\)\)/, 'only validated image types render as images');
assert.ok(!runtime.includes("String(mediaType).startsWith('image/') && attachment && attachment.previewUrl"), 'the prefix-only image branch is replaced');

// Non-image attachments keep the existing icon card.
assert.match(runtime, /createAttachmentIcon\(attachment\)/);
assert.match(runtime, /mediaType === 'application\/pdf' \? 'PDF' : '파일'/);
assert.match(runtime, /attachmentDisplayPresentation\(attachment\)/);
assert.match(runtime, /attachmentDisplayPresentation\(item\)/);
assert.doesNotMatch(runtime, /safeAttachmentName\(item\.fileName\)/, 'composer must not display a private filename');

// Lifecycle wiring.
const clearSent = runtime.slice(runtime.indexOf('const clearSentAttachments'), runtime.indexOf('const discardPendingAttachments'));
assert.ok(clearSent.length > 0);
assert.ok(
  !/release(Composer|Rendered|All)\w*PreviewUrls?\(/.test(clearSent),
  'clearing sent attachments must not revoke a thumbnail that is still on screen',
);
assert.ok(clearSent.includes('deleteConversationAttachment'), 'server-side attachment cleanup must be preserved');
const discard = runtime.slice(runtime.indexOf('const discardPendingAttachments'), runtime.indexOf('const clearLocalAttachments'));
assert.ok(discard.includes('releaseComposerPreviewUrl(item.previewUrl)'), 'discarding pending attachments revokes their previews');
assert.match(runtime, /releaseComposerPreviewUrl\(entry\.previewUrl\);/, 'a failed upload revokes its preview');
assert.match(runtime, /releaseRenderedPreviewUrls\(\);\n\s*restoreAvatarHome\(\)/, 'rebuilding the transcript releases rendered previews');
assert.match(runtime, /window\.addEventListener\('pagehide'[\s\S]{0,220}releaseAllAttachmentPreviewUrls\(\)/, 'page teardown releases previews');
assert.match(runtime, /if \(event instanceof PageTransitionEvent && event\.persisted\) return;/, 'a bfcache-persisted page keeps its previews');

/* ---------------------------------------------------------------- 3. no leak of previewUrl */

// previewUrl is UI-only. Reload retains only filename-private descriptors so
// an image-only turn becomes a safe generic card instead of a broken image or
// the internal placeholder sentence.
assert.match(runtime, /const persistedAttachments = attachments\.map\(item => \(\{[\s\S]{0,220}mediaType: item\.mimeType/);
assert.match(runtime, /appendPersistedMessage\(\{\.\.\.userRecord, meta: \{attachments: persistedAttachments\}\}\)/);
assert.doesNotMatch(runtime, /persistedAttachments[\s\S]{0,220}(fileName|filename|previewUrl)/);
assert.match(runtime, /meta\.attachments\.length && text === attachmentOnlyPlaceholder/);
assert.ok(!/previewUrl/.test(storage), 'conversation storage must know nothing about previews');
assert.ok(!/blob:/.test(runtime), 'no blob URL literal belongs in the conversation runtime');
for (const line of runtime.split('\n')) {
  if (!line.includes('previewUrl')) continue;
  assert.ok(
    !/localStorage|sessionStorage|JSON\.stringify|saveState\(|console\.(log|info|warn|error)/.test(line),
    `previewUrl must never be stored or logged: ${line.trim()}`,
  );
}
for (const token of ['text: message', 'attachmentIds: attachments.map(item => item.id)', 'attachments.map(item => item.id)']) {
  assert.ok(runtime.includes(token), `Core request shape must be unchanged: ${token}`);
}
const coreSendSlice = runtime.slice(runtime.indexOf('const response = await sendGuestConversationMessage'), runtime.indexOf('diagnostics.lastCoreDurationMs'));
assert.ok(!coreSendSlice.includes('previewUrl'), 'previewUrl must never be part of a Core request');

// Calendar foundation untouched.
assert.ok(storage.includes('delete draft.sourceAttachmentIds'), 'calendar draft attachment scrubbing must stay');
assert.ok(runtime.includes('source_attachment_ids: value.sourceAttachmentIds'), 'calendar draft attachment refs must stay');
assert.ok(runtime.includes('if (response.calendarDraft) meta.calendarDraft = response.calendarDraft;'));

// The image-only placeholder the composer writes and the sentence the renderer
// recognises must stay identical.
assert.ok(runtime.includes('const displayMessage = message || `첨부 파일 ${attachments.length}개를 확인해 주세요.`'));
const placeholderSource = runtime.match(/const attachmentOnlyPlaceholder = count => `([^`]+)`;/);
assert.ok(placeholderSource, 'attachmentOnlyPlaceholder must exist');
assert.equal(placeholderSource[1], '첨부 파일 ${count}개를 확인해 주세요.');
assert.match(runtime, /text === attachmentOnlyPlaceholder\(meta\.attachments\.length\)/);
assert.match(runtime, /body\.classList\.add\('sr-only'\)/, 'the placeholder sentence stays for assistive technology');
assert.match(
  runtime,
  /if \(role === 'user' && !article\.classList\.contains\('chat-message-attachment-only'\)\) \{\n\s*enhanceExpandableUserMessage\(article, body, text\);/,
  'an image-only turn must not grow a 더 보기 control for its hidden placeholder',
);

// Upload surface untouched: still JPEG/PNG + documents, still max 3.
assert.doesNotMatch(html, /image\/webp/);
assert.match(html, /accept="image\/jpeg,image\/png" capture="environment"/);
assert.match(html, /accept="image\/jpeg,image\/png" multiple/);
assert.match(html, /PDF·DOCX·TXT·CSV·JSON/);

for (const token of [
  '.message-attachment-list[data-image-count]',
  '.message-attachment-card-image',
  '.attachment-chip-thumb',
  '.chat-message-user.chat-message-attachment-only',
]) assert.ok(css.includes(token), `missing thumbnail CSS: ${token}`);
assert.match(css, /\.message-attachment-card-image \.message-attachment-image \{[^}]*object-fit:\s*contain/s, 'sent thumbnails must not be square-cropped');

/* ---------------------------------------------------------------- 4. rendered geometry */

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 0);
  return Buffer.concat([head, data, crc]);
}

// A controlled fixture image — never a real personal photo.
function fixturePng(width, height, [r, g, b]) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y += 1) {
    const row = y * (1 + width * 3);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const pixel = row + 1 + x * 3;
      raw[pixel] = r; raw[pixel + 1] = g; raw[pixel + 2] = b;
    }
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString('base64')}`;
}

const wide = fixturePng(300, 100, [40, 90, 200]);
const tall = fixturePng(100, 300, [200, 90, 40]);
const square = fixturePng(200, 200, [40, 160, 110]);

const browserCandidates = [
  process.env.CHROME_BIN,
  '/opt/pw-browsers/chromium',
  'google-chrome-stable',
  'google-chrome',
  'chromium',
  'chromium-browser',
].filter(Boolean);
const browser = browserCandidates.map(candidate => {
  if (candidate.includes('/')) return fs.existsSync(candidate) ? candidate : '';
  const found = spawnSync('which', [candidate], {encoding: 'utf8'});
  return found.status === 0 ? found.stdout.trim() : '';
}).find(Boolean);

if (!browser && process.env.REQUIRE_BROWSER === '1') {
  throw new Error('Chromium/Chrome is required for image attachment thumbnail geometry validation');
}

const attachmentCard = (src, name) => (src
  ? `<div class="message-attachment-card message-attachment-card-image"><img class="message-attachment-image" src="${src}" alt="첨부 이미지" /></div>`
  : `<div class="message-attachment-card"><span class="message-attachment-icon" aria-hidden="true">PDF</span><span class="message-attachment-name">PDF 문서</span></div>`);

const imageList = (cards, imageCount) =>
  `<div class="message-attachment-list"${imageCount ? ` data-image-count="${imageCount}"` : ''} aria-label="첨부 파일">${cards.join('')}</div>`;

if (browser) {
  const fixturePage = `<!doctype html><html lang="ko"><head><meta charset="utf-8" />
<link rel="stylesheet" href="file://${path.join(ROOT, 'styles.css')}" />
<link rel="stylesheet" href="file://${path.join(ROOT, 'home-chat.css')}" />
<link rel="stylesheet" href="file://${path.join(ROOT, 'site-conversation.css')}" />
</head><body data-chat-color="default" class="conversation-active">
<main class="chat-home-shell"><div class="chat-hero"><div class="conversation-thread">
  <article id="one" class="chat-message chat-message-user chat-message-attachment-only">
    <div class="chat-message-body sr-only">첨부 파일 1개를 확인해 주세요.</div>
    ${imageList([attachmentCard(wide, '21930.jpg')], 1)}
  </article>
  <article id="tall" class="chat-message chat-message-user chat-message-attachment-only">
    <div class="chat-message-body sr-only">첨부 파일 1개를 확인해 주세요.</div>
    ${imageList([attachmentCard(tall, '세로사진.png')], 1)}
  </article>
  <article id="two" class="chat-message chat-message-user">
    <div class="chat-message-body">이 두 장 확인해 주세요</div>
    ${imageList([attachmentCard(wide, 'a.jpg'), attachmentCard(tall, 'b.png')], 2)}
  </article>
  <article id="three" class="chat-message chat-message-user">
    <div class="chat-message-body">세 장입니다</div>
    ${imageList([attachmentCard(wide, 'a.jpg'), attachmentCard(tall, 'b.png'), attachmentCard(square, 'c.png')], 3)}
  </article>
  <article id="doc" class="chat-message chat-message-user">
    <div class="chat-message-body">계약서입니다</div>
    ${imageList([attachmentCard('', '계약서-아주-긴-파일이름-으로-넘치는지-봅니다.pdf')])}
  </article>
</div>
<div class="chat-composer-stack">
  <div class="attachment-preview-strip">
    <span class="attachment-chip attachment-chip-with-thumb" id="chip"><img class="attachment-chip-thumb" src="${wide}" alt="첨부 이미지" /><button type="button" class="attachment-chip-remove" aria-label="첨부 이미지 제거">×</button></span>
    <span class="attachment-chip attachment-chip-pending" id="pending"><img class="attachment-chip-thumb" src="${tall}" alt="첨부 이미지" /><span class="attachment-chip-meta">업로드 중…</span></span>
  </div>
</div></div></main></body></html>`;

  const probeScript = `(() => {
    const box = selector => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return {width: rect.width, height: rect.height, top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom};
    };
    const imageOf = id => {
      const img = document.querySelector('#' + id + ' .message-attachment-image');
      if (!img) return null;
      const rect = img.getBoundingClientRect();
      return {
        width: rect.width, height: rect.height,
        naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight,
        objectFit: getComputedStyle(img).objectFit,
        complete: img.complete,
      };
    };
    const remove = box('#chip .attachment-chip-remove');
    const thumb = box('#chip .attachment-chip-thumb');
    const result = {
      viewport: innerWidth,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      one: imageOf('one'),
      tall: imageOf('tall'),
      two: imageOf('two'),
      three: imageOf('three'),
      threeCount: document.querySelectorAll('#three .message-attachment-image').length,
      twoCount: document.querySelectorAll('#two .message-attachment-image').length,
      docImages: document.querySelectorAll('#doc .message-attachment-image').length,
      docIcon: document.querySelectorAll('#doc .message-attachment-icon').length,
      srOnlyHeight: box('#one .chat-message-body').height,
      bubble: box('#one'),
      list: box('#one .message-attachment-list'),
      thread: box('.conversation-thread'),
      removeTarget: remove,
      thumbBox: thumb,
      chipThumbFit: getComputedStyle(document.querySelector('#chip .attachment-chip-thumb')).objectFit,
      pendingThumb: box('#pending .attachment-chip-thumb'),
      overlap: remove && thumb ? thumb.right > remove.left : null,
    };
    const output = document.createElement('pre');
    output.id = 'thumbnail-result';
    output.textContent = JSON.stringify(result);
    document.body.appendChild(output);
  })();`;

  for (const [width, height, limit] of [[360, 780, 180], [390, 844, 180], [412, 915, 180], [768, 900, 220], [1280, 900, 220], [1440, 900, 220]]) {
    const probe = path.join(os.tmpdir(), `lotbi-image-thumbnail-${process.pid}-${width}.html`);
    fs.writeFileSync(probe, fixturePage.replace('</body>', `<script>${probeScript}<\/script></body>`));
    let measured;
    try {
      measured = spawnSync(browser, [
        '--headless=new', '--no-sandbox', '--disable-gpu', '--allow-file-access-from-files',
        `--window-size=${width},${height}`, '--force-device-scale-factor=1',
        '--virtual-time-budget=1500', '--dump-dom', `file://${probe}`,
      ], {encoding: 'utf8', timeout: 45000, maxBuffer: 16 * 1024 * 1024});
    } finally {
      fs.rmSync(probe, {force: true});
    }
    if (measured.status !== 0) throw new Error(measured.stderr || `browser exited ${measured.status}`);
    const match = measured.stdout.match(/<pre id="thumbnail-result">(.*?)<\/pre>/s);
    if (!match) throw new Error(`${width}px thumbnail result missing`);
    const value = JSON.parse(match[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&'));

    assert.equal(value.horizontalOverflow, false, `${width}px image attachments must not overflow horizontally`);

    // 실제 이미지가 렌더됩니다 — 파일 아이콘이 아닙니다.
    assert.equal(value.one.complete, true, `${width}px thumbnail must decode`);
    assert.equal(value.one.naturalWidth, 300, `${width}px thumbnail must render the real image bytes`);
    assert.equal(value.one.objectFit, 'contain', `${width}px thumbnail must not be cropped`);
    assert.ok(value.one.width > 40, `${width}px single thumbnail must be visible, not an icon`);
    assert.ok(value.one.width <= limit + 1, `${width}px single thumbnail must stay compact`);
    assert.ok(value.one.height <= limit + 1, `${width}px single thumbnail must stay compact`);

    // 비율 보존: 예약 확인서 같은 이미지를 정사각형으로 잘라내지 않습니다.
    assert.ok(Math.abs(value.one.width / value.one.height - 3) < 0.12, `${width}px wide image must keep its 3:1 ratio`);
    assert.ok(Math.abs(value.tall.height / value.tall.width - 3) < 0.12, `${width}px tall image must keep its 1:3 ratio`);
    assert.ok(value.tall.height <= limit + 1, `${width}px tall image must stay inside the bubble`);

    // 여러 장.
    assert.equal(value.twoCount, 2, `${width}px two-image turn renders two thumbnails`);
    assert.equal(value.threeCount, 3, `${width}px three-image turn renders three thumbnails`);
    assert.ok(value.two.width < value.one.width, `${width}px two-image thumbnails must shrink`);
    assert.ok(value.three.width < value.two.width, `${width}px three-image thumbnails must shrink further`);
    assert.ok(value.list.right <= value.thread.right + 1, `${width}px attachment list must stay inside the transcript`);
    assert.ok(value.bubble.width <= value.thread.width + 1, `${width}px image bubble must stay inside the transcript`);

    // 비이미지는 기존 파일 카드 그대로.
    assert.equal(value.docImages, 0, `${width}px PDF attachment must not render an image`);
    assert.equal(value.docIcon, 1, `${width}px PDF attachment must keep the file icon card`);

    // 이미지 전용 메시지: 문구는 접근성용으로만 남습니다.
    assert.ok(value.srOnlyHeight <= 2, `${width}px image-only placeholder text must not be visible`);

    // Composer: 썸네일이 삭제 버튼을 가리지 않습니다.
    assert.ok(value.thumbBox.width >= 24 && value.thumbBox.width <= 34, `${width}px composer thumbnail size`);
    assert.equal(value.chipThumbFit, 'cover');
    assert.equal(value.overlap, false, `${width}px composer thumbnail must not cover the remove button`);
    assert.ok(value.removeTarget.width >= 22 && value.removeTarget.height >= 22, `${width}px remove button target must stay`);
    assert.ok(value.pendingThumb.width >= 24, `${width}px uploading image must already show its thumbnail`);
  }
}

console.log(`SITE-IMAGE-ATTACHMENT-THUMBNAIL-01 PASS${browser ? '' : ' (geometry skipped: no browser)'}`);
