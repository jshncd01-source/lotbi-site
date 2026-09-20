import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';

const PROD = 'https://lotbiai.com/?phase16-e2e=github-final';
const OUT = 'phase16-e2e-artifacts';
fs.mkdirSync(OUT, {recursive: true});

function browserPath() {
  for (const candidate of [
    process.env.CHROME_BIN,
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean)) {
    if (fs.existsSync(candidate)) return candidate;
  }
  for (const name of ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser']) {
    try {
      const found = execFileSync('which', [name], {encoding: 'utf8'}).trim();
      if (found) return found;
    } catch {}
  }
  throw new Error('Chrome/Chromium executable not found');
}

const result = {
  productionUrl: PROD,
  viewportChecks: [],
  removeFlow: {},
  textAttachmentFlow: {},
  attachmentOnlyFlow: {},
  calendar: {},
  profileState: '',
  finalScroll: {},
};

const executablePath = browserPath();
const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const context = await browser.newContext({
  locale: 'ko-KR',
  timezoneId: 'Asia/Seoul',
});
const page = await context.newPage();
page.setDefaultTimeout(20000);

const consoleErrors = [];
page.on('console', msg => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', err => consoleErrors.push(String(err)));

async function snapshot(label) {
  await page.screenshot({path: `${OUT}/${label}.png`, fullPage: true});
}

async function viewportCheck(width, height) {
  await page.setViewportSize({width, height});
  await page.waitForTimeout(250);

  const values = await page.evaluate(() => {
    const composer = document.querySelector('.chat-composer-stack');
    const avatar = document.querySelector('[data-lotbi-avatar-container]');
    const thread = document.querySelector('.conversation-thread');
    const main = document.querySelector('.chat-home-shell');
    const composerRect = composer?.getBoundingClientRect();
    const avatarRect = avatar?.getBoundingClientRect();
    return {
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      composerVisible: Boolean(composerRect && composerRect.width > 0 && composerRect.bottom <= innerHeight + 4),
      avatarVisible: Boolean(avatarRect && avatarRect.width > 0 && avatarRect.height > 0 && avatarRect.bottom > 0 && avatarRect.top < innerHeight),
      transcriptOverflowY: thread ? getComputedStyle(thread).overflowY : 'missing',
      mainOverflowY: main ? getComputedStyle(main).overflowY : 'missing',
    };
  });
  assert.equal(values.horizontalOverflow, false, `${width}px horizontal overflow`);
  assert.equal(values.composerVisible, true, `${width}px composer must remain visible`);
  assert.equal(values.avatarVisible, true, `${width}px Avatar must be visible`);
  assert.equal(values.transcriptOverflowY, 'auto', `${width}px transcript must own scroll`);
  assert.equal(values.mainOverflowY, 'hidden', `${width}px main must not own scroll`);

  const trigger = page.locator('[data-attachment-trigger]');
  await trigger.click();
  const menuItems = await page.locator('[data-attachment-menu] [role="menuitem"]').allTextContents();
  assert.deepEqual(menuItems.map(x => x.trim()), ['카메라', '사진·스크린샷', '파일']);
  await page.keyboard.press('Escape');

  result.viewportChecks.push({width, height, ...values, attachmentMenuItems: menuItems.map(x => x.trim())});
  await snapshot(`viewport-${width}`);
}

async function setFile(name, mimeType, body) {
  const input = page.locator('[data-attachment-input="files"]');
  await input.setInputFiles({
    name,
    mimeType,
    buffer: Buffer.from(body, 'utf8'),
  });
}

async function waitReadyChip(name) {
  const chip = page.locator('.attachment-chip').filter({hasText: name});
  await chip.waitFor({state: 'visible', timeout: 30000});
  await page.locator('.attachment-uploading').waitFor({state: 'detached', timeout: 30000}).catch(() => {});
  return chip;
}

async function nonLoadingAssistantCount() {
  return await page.locator('article.chat-message-assistant:not(.chat-message-loading)').count();
}

async function waitForNewAssistant(previous, timeout = 90000) {
  await page.waitForFunction(
    previousCount => document.querySelectorAll('article.chat-message-assistant:not(.chat-message-loading)').length > previousCount,
    previous,
    {timeout},
  );
  const nodes = page.locator('article.chat-message-assistant:not(.chat-message-loading)');
  return (await nodes.last().innerText()).trim();
}

try {
  await page.goto(PROD, {waitUntil: 'domcontentloaded', timeout: 60000});
  await page.waitForSelector('[data-attachment-trigger]', {state: 'visible', timeout: 30000});
  await page.waitForTimeout(1200);

  for (const [width, height] of [[390, 844], [412, 915], [768, 900], [1280, 900]]) {
    await viewportCheck(width, height);
  }

  await page.setViewportSize({width: 768, height: 900});
  const calendarButton = page.locator('[data-calendar-view]:visible').first();
  if (await calendarButton.count()) {
    await calendarButton.evaluate(button => button.click());
    const modal = page.locator('.site-calendar-modal');
    await modal.waitFor({state: 'visible', timeout: 15000});
    result.calendar = {opened: true};
    await snapshot('calendar-open');
    await page.keyboard.press('Escape');
    await modal.waitFor({state: 'hidden', timeout: 10000}).catch(() => {});
  } else {
    result.calendar = {opened: false, reason: 'visible calendar trigger not found'};
  }

  result.profileState = (await page.locator('[data-profile-menu-trigger]:visible').count()) ? 'available' : 'guest_unavailable';

  // Removal flow.
  await setFile('phase16-remove.txt', 'text/plain', 'LOTBI PHASE 16 remove test');
  const removeChip = await waitReadyChip('phase16-remove.txt');
  result.removeFlow.uploaded = true;
  await removeChip.locator('.attachment-chip-remove').click();
  await removeChip.waitFor({state: 'detached', timeout: 20000});
  result.removeFlow.removed = true;

  // Text + attachment.
  await setFile(
    'phase16-text.txt',
    'text/plain',
    'LOTBI PHASE 16 text attachment. The key phrase is BLUE-MOON-716.',
  );
  await waitReadyChip('phase16-text.txt');
  result.textAttachmentFlow.uploaded = true;
  await page.locator('#lotbi-prompt').fill('이 첨부 파일의 핵심 문구를 알려줘.');
  const beforeTextAssistant = await nonLoadingAssistantCount();
  await page.locator('.send-button').click();
  const textReply = await waitForNewAssistant(beforeTextAssistant);
  result.textAttachmentFlow.sent = true;
  result.textAttachmentFlow.assistantReceived = true;
  result.textAttachmentFlow.assistantText = textReply;
  assert.equal(await page.locator('.chat-message-error').count(), 0, 'text+attachment must not render an error');
  assert.equal(await page.locator('.attachment-chip').count(), 0, 'sent text attachment must clear from composer');
  await snapshot('text-attachment-complete');

  // Attachment-only.
  await setFile(
    'phase16-only.json',
    'application/json',
    JSON.stringify({lotbi_phase16: 'attachment_only_test', marker: 'GREEN-ONLY-816'}),
  );
  await waitReadyChip('phase16-only.json');
  result.attachmentOnlyFlow.uploaded = true;
  await page.locator('#lotbi-prompt').fill('');
  const beforeOnlyAssistant = await nonLoadingAssistantCount();
  assert.equal(await page.locator('.send-button').isEnabled(), true, 'attachment-only send must be enabled');
  await page.locator('.send-button').click();
  const onlyReply = await waitForNewAssistant(beforeOnlyAssistant);
  result.attachmentOnlyFlow.sent = true;
  result.attachmentOnlyFlow.assistantReceived = true;
  result.attachmentOnlyFlow.assistantText = onlyReply;
  assert.equal(await page.locator('.chat-message-error').count(), 0, 'attachment-only must not render an error');
  assert.equal(await page.locator('.attachment-chip').count(), 0, 'sent attachment-only chip must clear');
  await snapshot('attachment-only-complete');

  result.finalScroll = await page.evaluate(() => {
    const thread = document.querySelector('.conversation-thread');
    const main = document.querySelector('.chat-home-shell');
    return {
      transcriptOverflowY: thread ? getComputedStyle(thread).overflowY : 'missing',
      mainOverflowY: main ? getComputedStyle(main).overflowY : 'missing',
      conversationActive: document.body.classList.contains('conversation-active'),
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });
  assert.equal(result.finalScroll.transcriptOverflowY, 'auto');
  assert.equal(result.finalScroll.mainOverflowY, 'hidden');
  assert.equal(result.finalScroll.horizontalOverflow, false);
  assert.equal(result.finalScroll.conversationActive, true);

  result.consoleErrors = consoleErrors.filter(x => !/favicon|ERR_BLOCKED_BY_CLIENT/i.test(x));
  fs.writeFileSync(`${OUT}/result.json`, JSON.stringify(result, null, 2));
  console.log('PHASE16-PRODUCTION-E2E PASS');
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  result.failure = String(error?.stack || error);
  result.consoleErrors = consoleErrors;
  fs.writeFileSync(`${OUT}/result.json`, JSON.stringify(result, null, 2));
  console.error('PHASE16-PRODUCTION-E2E FAIL');
  console.error(result.failure);
  process.exitCode = 1;
} finally {
  await browser.close();
}
