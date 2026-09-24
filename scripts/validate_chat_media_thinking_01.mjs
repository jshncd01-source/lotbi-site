import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = fs.readFileSync(path.join(ROOT, 'site-conversation.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'site-conversation.css'), 'utf8');
const attachments = await import('../site-attachments.js');
const thinking = await import('../site-chat-thinking.js');
const animation = await import('../avatar-runtime/runtime/animation.mjs');
const {AvatarController} = await import('../avatar-runtime/runtime/controller.mjs');
const clips = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/animations/lotbi-clips.v1.json'), 'utf8'));
const rigContract = JSON.parse(fs.readFileSync(path.join(ROOT, 'avatar-runtime/contracts/avatar-rig-controls.v2.json'), 'utf8'));

// CHAT-ATTACHMENT-NO-FILENAME-01 — private filenames remain transport
// metadata, never conversation copy or an accessible name.
assert.equal(typeof attachments.attachmentDisplayLabel, 'function');
assert.equal(attachments.attachmentDisplayLabel('image/png'), '첨부 이미지');
assert.equal(attachments.attachmentDisplayLabel('image/jpeg'), '첨부 이미지');
assert.equal(attachments.attachmentDisplayLabel('application/pdf'), 'PDF 문서');
assert.equal(
  attachments.attachmentDisplayLabel(
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ),
  '문서',
);
assert.equal(attachments.attachmentDisplayLabel('text/plain'), '텍스트 문서');
assert.equal(attachments.attachmentDisplayLabel('text/csv'), 'CSV 문서');
assert.equal(attachments.attachmentDisplayLabel('application/json'), 'JSON 문서');
assert.equal(attachments.attachmentDisplayLabel('application/octet-stream'), '첨부 파일');

const privateName = '병원진료기록_조은율_20260924_final.png';
const imagePresentation = attachments.attachmentDisplayPresentation({
  fileName: privateName,
  mimeType: 'image/png',
});
assert.deepEqual(imagePresentation, {
  label: '첨부 이미지',
  imageAlt: '첨부 이미지',
  removeLabel: '첨부 이미지 제거',
});
assert.equal(JSON.stringify(imagePresentation).includes(privateName), false);

const pdfPresentation = attachments.attachmentDisplayPresentation({
  fileName: '회사계약서_홍길동_final_v7.pdf',
  mimeType: 'application/pdf',
});
assert.deepEqual(pdfPresentation, {
  label: 'PDF 문서',
  imageAlt: '첨부 이미지',
  removeLabel: 'PDF 문서 제거',
});

// Production renderers must consume the descriptor rather than reconstructing
// visible or assistive copy from fileName.
assert.match(runtime, /attachmentDisplayPresentation\(item\)/);
assert.match(
  runtime,
  /thumb\.addEventListener\('error',[\s\S]{0,260}appendChipFallbackLabel\(chip, item\)/,
  'a broken composer thumbnail must become a generic card without revealing its filename',
);
assert.match(runtime, /attachmentDisplayPresentation\(attachment\)/);
assert.doesNotMatch(runtime, /image\.alt\s*=\s*`첨부 이미지:\s*\$\{name\}`/);
assert.doesNotMatch(runtime, /name\.textContent\s*=\s*safeAttachmentName\(item\.fileName\)/);
assert.doesNotMatch(runtime, /label\.textContent\s*=\s*name/);
assert.doesNotMatch(css, /message-attachment-card-image \.message-attachment-name/);

console.log('CHAT-ATTACHMENT-NO-FILENAME-01 PASS');

// CHAT-LOADING-STATE-01 — quick answers never flash a loader, while slow
// requests become visible once and always clear every outstanding timer.
const createScheduler = () => {
  let now = 0;
  let sequence = 0;
  const pending = new Map();
  return {
    setTimeout(callback, delay) {
      const id = ++sequence;
      pending.set(id, {at: now + delay, callback});
      return id;
    },
    clearTimeout(id) { pending.delete(id); },
    advanceBy(delta) {
      const target = now + delta;
      for (;;) {
        const next = [...pending.entries()]
          .filter(([, timer]) => timer.at <= target)
          .sort((left, right) => left[1].at - right[1].at || left[0] - right[0])[0];
        if (!next) break;
        pending.delete(next[0]);
        now = next[1].at;
        next[1].callback();
      }
      now = target;
    },
    pendingCount() { return pending.size; },
  };
};

const scheduler = createScheduler();
const events = [];
const loader = thinking.createThinkingPresentation({
  delayMs: 350,
  longWaitMs: 6000,
  scheduler,
  onVisible: state => events.push(['visible', state]),
  onLongWait: state => events.push(['long', state]),
});
loader.start(thinking.THINKING_KINDS.ANALYZING_IMAGE);
assert.equal(loader.visible, false);
assert.equal(loader.kind, thinking.THINKING_KINDS.ANALYZING_IMAGE);
assert.equal(loader.text, '이미지를 보고 있어요…');
scheduler.advanceBy(349);
assert.equal(loader.visible, false);
scheduler.advanceBy(1);
assert.equal(loader.visible, true);
assert.equal(events.length, 1);
assert.equal(events[0][1].text, '이미지를 보고 있어요…');
scheduler.advanceBy(5650);
assert.equal(loader.text, '조금 더 확인하고 있어요…');
assert.equal(events.at(-1)[0], 'long');
loader.stop('answer');
loader.stop('answer-again');
assert.equal(loader.visible, false);
assert.equal(scheduler.pendingCount(), 0);

const quickScheduler = createScheduler();
let quickVisible = false;
const quickLoader = thinking.createThinkingPresentation({
  delayMs: 350,
  longWaitMs: 6000,
  scheduler: quickScheduler,
  onVisible: () => { quickVisible = true; },
});
quickLoader.start(thinking.THINKING_KINDS.THINKING);
quickScheduler.advanceBy(120);
quickLoader.stop('answer');
quickScheduler.advanceBy(10000);
assert.equal(quickVisible, false);
assert.equal(quickScheduler.pendingCount(), 0);

const stuckScheduler = createScheduler();
let timedOut = false;
const stuckLoader = thinking.createThinkingPresentation({
  delayMs: 350,
  longWaitMs: 6000,
  timeoutMs: 55_000,
  scheduler: stuckScheduler,
  onTimeout: () => { timedOut = true; },
});
stuckLoader.start(thinking.THINKING_KINDS.THINKING);
stuckScheduler.advanceBy(54_999);
assert.equal(timedOut, false);
stuckScheduler.advanceBy(1);
assert.equal(timedOut, true);
assert.equal(stuckLoader.visible, false);
assert.equal(stuckScheduler.pendingCount(), 0);

assert.equal(
  thinking.selectThinkingKind({attachments: [{mediaType: 'image/jpeg'}], text: '여기가 어딜까'}),
  thinking.THINKING_KINDS.ANALYZING_IMAGE,
);
assert.equal(thinking.selectThinkingKind({text: '서울역 위치를 찾아줘'}), thinking.THINKING_KINDS.CHECKING_PLACE);
assert.equal(thinking.selectThinkingKind({text: '이 일정 등록해줘'}), thinking.THINKING_KINDS.READING_SCHEDULE);
assert.doesNotMatch(runtime, /appendNode\(createLoadingMessage\(\)\)/);
assert.match(runtime, /createThinkingPresentation\(\{[\s\S]*onVisible:[\s\S]*driveAvatar\('response-wait'/);
assert.match(runtime, /const startNewConversation = \(\) => \{[\s\S]{0,220}cancelActiveTurn\('new-conversation'\)/);
assert.match(runtime, /window\.addEventListener\('pagehide',[\s\S]{0,260}cancelActiveTurn\('pagehide'\)/);
assert.match(runtime, /thinking\.stop\('answer'\)[\s\S]{0,120}appendConversationRecord/);
assert.match(runtime, /thinking\.stop\('error'\)[\s\S]{0,160}showError/);
assert.match(runtime, /onTimeout:[\s\S]{0,420}showError/);
assert.doesNotMatch(runtime, /createLoadingMessage[\s\S]{0,420}setAttribute\('role', 'status'\)/);

console.log('CHAT-LOADING-STATE-01 PASS');

// CHAT-THINKING-RUNNING-LOTBI-01 — the existing official rig supplies the
// motion; no second model, renderer, or fake mascot is introduced.
assert.ok(animation.ACTIONS.includes('running'));
const runStart = animation.sampleClip(clips, rigContract, 'running', 0);
const runHalf = animation.sampleClip(clips, rigContract, 'running', 0.35);
assert.notEqual(Math.sign(runStart.arm_L_swing_deg), Math.sign(runHalf.arm_L_swing_deg));
assert.notEqual(Math.sign(runStart.arm_R_swing_deg), Math.sign(runHalf.arm_R_swing_deg));
assert.ok(Math.abs(runStart.body_pitch_deg) <= 6);
assert.ok(Math.abs(runHalf.body_roll_deg) <= 5);
assert.equal(animation.sampleClip(clips, rigContract, 'running', 0.35, 1, true).hover_m, 0);

const controller = new AvatarController(clips, rigContract);
const token = controller.beginTurn('running-lotbi-test', 0);
controller.hostEvent(token, 'response-wait', 0.01);
assert.equal(controller.state, 'running');
assert.equal(controller.lifecycleSnapshot().state, 'thinking');
controller.cancel(0.4, 'test-complete');
assert.equal(controller.state, 'idle');

const avatarRuntime = fs.readFileSync(path.join(ROOT, 'site-avatar.js'), 'utf8');
const avatarCss = fs.readFileSync(path.join(ROOT, 'site-avatar.css'), 'utf8');
assert.match(avatarRuntime, /container\.classList\.add\('avatar-processing'\)/);
assert.match(avatarRuntime, /container\.classList\.toggle\('avatar-reduced-motion'/);
assert.match(avatarCss, /avatar-processing\.avatar-reduced-motion[\s\S]*\.site-avatar-stage/);
assert.match(avatarRuntime, /let desiredLifecycle = null/);
assert.match(avatarRuntime, /if \(desiredLifecycle\) driveLifecycle\(desiredLifecycle\)/);
assert.match(
  avatarRuntime,
  /if \(phase === 'response-complete' \|\| phase === 'cancel'\) \{\s*container\.classList\.remove\('avatar-processing'\);/,
);
assert.doesNotMatch(runtime, /new\s+THREE\.WebGLRenderer/);

console.log('CHAT-THINKING-RUNNING-LOTBI-01 PASS');
