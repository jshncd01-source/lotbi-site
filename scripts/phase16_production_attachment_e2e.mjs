import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const outDir = path.resolve('phase16-e2e-artifacts');
await fs.mkdir(outDir, { recursive: true });

const result = {
  contract: 'PHASE16-PRODUCTION-ATTACHMENT-E2E-01',
  url: 'https://lotbiai.com/',
  viewport: { width: 1280, height: 900 },
  chip_remove: { uploaded: false, chip_appeared: false, removed: false },
  text_attachment: { uploaded: false, sent: false, user_attachment_visible: false, assistant_received: false, marker_seen: false, assistant_text: '' },
  attachment_only: { uploaded: false, sent: false, user_attachment_visible: false, assistant_received: false, marker_seen: false, assistant_text: '' },
  composer_reset: false,
  calendar_opened: false,
  network: [],
  errors: [],
  overall: 'PENDING',
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: result.viewport });

page.on('response', response => {
  try {
    const url = new URL(response.url());
    if (url.hostname === 'api.lotbiai.com' && url.pathname.startsWith('/v2/conversation/')) {
      result.network.push({
        method: response.request().method(),
        path: url.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/ig, ':id'),
        status: response.status(),
      });
    }
  } catch {}
});

async function screenshot(name) {
  await page.screenshot({ path: path.join(outDir, name), fullPage: true });
}

async function waitForChip(name) {
  const chip = page.locator('.attachment-chip').filter({ hasText: name }).last();
  await chip.waitFor({ state: 'visible', timeout: 60000 });
  return chip;
}

async function waitForAssistantAfter(beforeCount, timeout = 120000) {
  await page.waitForFunction(
    before => Array.from(document.querySelectorAll('.chat-message[data-role="assistant"]'))
      .filter(node => node.dataset.transient !== 'true').length > before,
    beforeCount,
    { timeout }
  );
  const assistant = page.locator('.chat-message[data-role="assistant"]:not([data-transient="true"])').last();
  await assistant.waitFor({ state: 'visible', timeout: 10000 });
  return (await assistant.innerText()).trim();
}

try {
  await page.goto(`https://lotbiai.com/?phase16-e2e=gha-${Date.now()}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.locator('#lotbi-prompt').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('[data-attachment-trigger]').waitFor({ state: 'visible', timeout: 30000 });

  const fileInput = page.locator('input[data-attachment-input="files"]');
  if (await fileInput.count() !== 1) throw new Error('Expected exactly one files attachment input');

  // A) Real Production upload -> chip -> delete.
  await fileInput.setInputFiles({
    name: 'phase16-remove.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('LOTBI PHASE 16 remove test', 'utf8'),
  });
  result.chip_remove.uploaded = true;
  const removeChip = await waitForChip('phase16-remove.txt');
  result.chip_remove.chip_appeared = true;
  result.chip_remove.chip_text = (await removeChip.innerText()).trim();
  await screenshot('01-chip-uploaded.png');

  await removeChip.locator('.attachment-chip-remove').click();
  await page.waitForFunction(() => document.querySelectorAll('.attachment-chip').length === 0, null, { timeout: 60000 });
  result.chip_remove.removed = true;
  await screenshot('02-chip-removed.png');

  // B) Text + attachment. The answer must expose a marker that only exists in the file.
  await fileInput.setInputFiles({
    name: 'phase16-text.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('LOTBI PHASE 16 text attachment. The key phrase is BLUE-MOON-716.', 'utf8'),
  });
  await waitForChip('phase16-text.txt');
  result.text_attachment.uploaded = true;

  const assistantsBeforeText = await page.locator('.chat-message[data-role="assistant"]:not([data-transient="true"])').count();
  await page.locator('#lotbi-prompt').fill('이 첨부 파일 안의 키 문구만 정확히 답해줘.');
  await page.waitForFunction(() => {
    const button = document.querySelector('.send-button');
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  await page.locator('.send-button').click();
  result.text_attachment.sent = true;

  const textUserAttachment = page.locator('.chat-message[data-role="user"] .message-attachment-name').filter({ hasText: 'phase16-text.txt' }).last();
  await textUserAttachment.waitFor({ state: 'visible', timeout: 30000 });
  result.text_attachment.user_attachment_visible = true;

  const textAnswer = await waitForAssistantAfter(assistantsBeforeText);
  result.text_attachment.assistant_received = true;
  result.text_attachment.assistant_text = textAnswer.slice(0, 1200);
  result.text_attachment.marker_seen = textAnswer.includes('BLUE-MOON-716');
  await screenshot('03-text-attachment-response.png');

  await page.waitForFunction(() => document.querySelectorAll('.attachment-chip').length === 0, null, { timeout: 30000 });
  result.composer_reset = true;

  // C) Attachment-only. The default LOTBI attachment prompt must still consume the file.
  await fileInput.setInputFiles({
    name: 'phase16-only.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ lotbi_phase16: 'attachment_only_test', marker: 'GREEN-ONLY-816' }), 'utf8'),
  });
  await waitForChip('phase16-only.json');
  result.attachment_only.uploaded = true;
  await page.locator('#lotbi-prompt').fill('');

  const assistantsBeforeOnly = await page.locator('.chat-message[data-role="assistant"]:not([data-transient="true"])').count();
  await page.waitForFunction(() => {
    const button = document.querySelector('.send-button');
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  await page.locator('.send-button').click();
  result.attachment_only.sent = true;

  const onlyUserAttachment = page.locator('.chat-message[data-role="user"] .message-attachment-name').filter({ hasText: 'phase16-only.json' }).last();
  await onlyUserAttachment.waitFor({ state: 'visible', timeout: 30000 });
  result.attachment_only.user_attachment_visible = true;

  const onlyAnswer = await waitForAssistantAfter(assistantsBeforeOnly);
  result.attachment_only.assistant_received = true;
  result.attachment_only.assistant_text = onlyAnswer.slice(0, 1200);
  result.attachment_only.marker_seen = onlyAnswer.includes('GREEN-ONLY-816');
  await screenshot('04-attachment-only-response.png');

  await page.waitForFunction(() => document.querySelectorAll('.attachment-chip').length === 0, null, { timeout: 30000 });
  result.composer_reset = result.composer_reset && true;

  // D) Read-only Calendar preservation smoke.
  const calendarEntry = page.locator('button[data-calendar-view]').first();
  if (await calendarEntry.count()) {
    await calendarEntry.click();
    const modal = page.locator('.site-calendar-modal');
    await modal.waitFor({ state: 'visible', timeout: 30000 });
    result.calendar_opened = true;
    await screenshot('05-calendar-open.png');
    const close = modal.locator('.site-modal-close');
    if (await close.count()) await close.click();
  }

  const requiredNetwork = result.network.filter(item =>
    item.path.includes('/v2/conversation/guest/attachments') ||
    item.path.includes('/v2/conversation/guest/messages') ||
    item.path.includes('/v2/conversation/guest/sessions')
  );
  result.network_summary = requiredNetwork;

  const checks = [
    result.chip_remove.uploaded,
    result.chip_remove.chip_appeared,
    result.chip_remove.removed,
    result.text_attachment.uploaded,
    result.text_attachment.sent,
    result.text_attachment.user_attachment_visible,
    result.text_attachment.assistant_received,
    result.text_attachment.marker_seen,
    result.attachment_only.uploaded,
    result.attachment_only.sent,
    result.attachment_only.user_attachment_visible,
    result.attachment_only.assistant_received,
    result.attachment_only.marker_seen,
    result.composer_reset,
  ];
  result.overall = checks.every(Boolean) ? 'PASS' : 'FAIL';
} catch (error) {
  result.errors.push(error instanceof Error ? (error.stack || error.message) : String(error));
  result.overall = 'FAIL';
  try { await screenshot('99-failure.png'); } catch {}
} finally {
  await fs.writeFile(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2));
  await browser.close();
}

console.log(JSON.stringify(result, null, 2));
if (result.overall !== 'PASS') process.exitCode = 1;
