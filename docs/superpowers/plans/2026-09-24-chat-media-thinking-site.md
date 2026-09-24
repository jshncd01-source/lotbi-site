# LOTBI Chat Media and Thinking Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Web chat attachments image-first and filename-private, and show the official LOTBI character running in place only while a response is genuinely taking long.

**Architecture:** Extend the merged image-preview lifecycle instead of creating a second upload path. Keep the single sealed Three.js Avatar mount and add a `running` controller state plus a delayed transient thinking presentation that owns its timers, long-wait copy, accessibility status, and cancellation cleanup.

**Tech Stack:** Static ES modules, DOM/CSS, Three.js sealed Avatar runtime, Node contract tests, Chromium visual tests, GitHub Pages.

**Spec:** User-provided `[LOTBI CHAT MEDIA + THINKING UX — CROSS-PLATFORM FINAL]` command dated 2026-09-24 KST.

## Global Constraints

- Internal filename, MIME, size, attachment id, validation, upload, AI processing, ownership, and calendar source metadata remain intact.
- User-facing UI and assistive labels never expose the original filename.
- Blob URLs are ephemeral and revoked only after their last UI owner is gone.
- The loader is delayed to avoid flicker, stops at answer/error/cancel/navigation, and never claims fake progress.
- Reduced motion uses the official static LOTBI image and status text without the running loop.
- Reuse one existing Three.js runtime, GLB, rig, controller, and render loop.
- No direct `main` edit, rebase, reset, force-push, history rewrite, or stale blind merge.

## Review Focus

- A 100 ms response must never render a transient loader frame.
- A thumbnail decode failure must fall back to a generic attachment label without revealing the filename.
- Two or three mixed image/document attachments must wrap without horizontal page overflow.
- Cancelling or replacing a request before the delay fires must leave no timer, long-wait copy, Avatar turn, or transient DOM.
- Reduced-motion and WebGL-failure paths must retain a meaningful polite status while avoiding an active 3D running loop.

---

### Task 1: Filename-private attachment presentation

**Files:**
- Modify: `site-attachments.js`
- Modify: `site-conversation.js`
- Modify: `site-conversation.css`
- Modify: `index.html`
- Test: `scripts/validate_chat_media_thinking_01.mjs`

**Interfaces:**
- Consumes: existing validated attachment records `{id, fileName, mimeType, sizeBytes, previewUrl}`.
- Produces: `attachmentDisplayLabel(mediaType): string` and DOM cards whose accessible name is generic.

- [ ] **Step 1: Write the failing attachment contract test**

```js
assert.equal(attachmentDisplayLabel('application/pdf'), 'PDF 문서');
assert.equal(attachmentDisplayLabel('image/png'), '첨부 이미지');
assert.equal(composer.textContent.includes('private-medical-record.png'), false);
assert.equal(sentMessage.textContent.includes('private-medical-record.png'), false);
```

- [ ] **Step 2: Run test to verify RED**

Run: `node scripts/validate_chat_media_thinking_01.mjs`

Expected: FAIL because the original filename is still rendered in composer and sent-message captions.

- [ ] **Step 3: Implement generic labels and image-first cards**

```js
export function attachmentDisplayLabel(mediaType) {
  if (String(mediaType).startsWith('image/')) return '첨부 이미지';
  if (mediaType === 'application/pdf') return 'PDF 문서';
  if (mediaType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return '문서';
  if (mediaType === 'text/plain') return '텍스트 문서';
  return '첨부 파일';
}
```

Use the generic label for visible captions, `alt`, remove-button labels, titles, and fallback cards. Do not remove `fileName` from upload metadata.

- [ ] **Step 4: Run focused and existing thumbnail tests**

Run: `node scripts/validate_chat_media_thinking_01.mjs && node scripts/validate_image_attachment_thumbnail_01.mjs`

Expected: PASS with filename-private display and preserved upload/preview lifecycle.

- [ ] **Step 5: Commit**

```bash
git add site-attachments.js site-conversation.js site-conversation.css index.html scripts/validate_chat_media_thinking_01.mjs
git commit -m "feat(chat): hide attachment filenames from conversation UI"
```

### Task 2: Delayed, stateful thinking presentation

**Files:**
- Create: `site-chat-thinking.js`
- Modify: `site-conversation.js`
- Modify: `site-conversation.css`
- Modify: `index.html`
- Test: `scripts/validate_chat_media_thinking_01.mjs`

**Interfaces:**
- Produces: `createThinkingPresentation({delayMs, longWaitMs, onVisible, onLongWait}): {start(kind), stop(reason), visible, kind}`.
- Consumes: explicit kinds `THINKING`, `ANALYZING_IMAGE`, `CHECKING_PLACE`, `READING_SCHEDULE`, `ORGANIZING`.

- [ ] **Step 1: Add failing timer/state tests**

```js
const loader = createThinkingPresentation({delayMs: 350, longWaitMs: 6000, scheduler});
loader.start('ANALYZING_IMAGE');
scheduler.advanceBy(349);
assert.equal(loader.visible, false);
scheduler.advanceBy(1);
assert.equal(loader.visible, true);
loader.stop('answer');
assert.equal(scheduler.pendingCount(), 0);
```

- [ ] **Step 2: Run focused test to verify RED**

Run: `node scripts/validate_chat_media_thinking_01.mjs`

Expected: FAIL because the controller and delayed rendering do not exist.

- [ ] **Step 3: Implement the minimal controller and transient DOM**

The controller must select `이미지를 보고 있어요…` when sent attachments include an image, switch to `조금 더 확인하고 있어요…` only after the long-wait timer, expose one `role="status"`/`aria-live="polite"` region, and make `stop()` idempotently clear both timers.

- [ ] **Step 4: Integrate every async request branch**

Replace immediate `appendNode(createLoadingMessage())` calls with a single helper that starts after the user message, removes itself before the assistant answer, and calls Avatar `response-wait` only when visible. All success, catch, deterministic, calendar, guest, auth, retry, pagehide, and new-conversation paths must call cleanup.

- [ ] **Step 5: Run focused test**

Run: `node scripts/validate_chat_media_thinking_01.mjs`

Expected: PASS for no flicker, image copy, long-wait copy, error/cancel cleanup, and no stale transient node.

- [ ] **Step 6: Commit**

```bash
git add site-chat-thinking.js site-conversation.js site-conversation.css index.html scripts/validate_chat_media_thinking_01.mjs
git commit -m "feat(chat): add delayed accessible thinking states"
```

### Task 3: Official LOTBI running-in-place Avatar state

**Files:**
- Modify: `avatar-runtime/runtime/animation.mjs`
- Modify: `avatar-runtime/runtime/controller.mjs`
- Modify: `avatar-runtime/runtime/state-machine.mjs`
- Modify: `assets/animations/lotbi-clips.v1.json`
- Modify: `site-avatar.js`
- Modify: `site-avatar.css`
- Test: `scripts/validate_chat_media_thinking_01.mjs`

**Interfaces:**
- Produces: `running` clip/state sampled by the existing controller and applied by the existing binding/render loop.
- Consumes: rig controls `arm_L_swing_deg`, `arm_R_swing_deg`, `body_pitch_deg`, `body_roll_deg`, `hover_m`, `display_glow`.

- [ ] **Step 1: Add failing running-loop tests**

```js
assert.ok(ACTIONS.includes('running'));
const start = sampleClip(clips, contract, 'running', 0);
const half = sampleClip(clips, contract, 'running', 0.35);
assert.notEqual(Math.sign(start.arm_L_swing_deg), Math.sign(half.arm_L_swing_deg));
assert.equal(sampleClip(clips, contract, 'running', 0.35, 1, true).hover_m, 0);
```

- [ ] **Step 2: Run focused test to verify RED**

Run: `node scripts/validate_chat_media_thinking_01.mjs`

Expected: FAIL because `running` is not a controller action.

- [ ] **Step 3: Add a compact symmetric loop**

Add a 0.7-second loop with alternating arm swing, a slight forward body pitch, bounded roll, low hover, and soft display glow. The official legless LOTBI body is not modified and no fake model is introduced.

- [ ] **Step 4: Map visible processing to running and reduced motion to static**

`response-wait` selects `running` only after the delayed loader becomes visible. With `prefers-reduced-motion`, the 3D canvas is hidden for the transient loader and the existing official static image remains visible with no bob.

- [ ] **Step 5: Run focused Avatar and fallback gates**

Run: `node scripts/validate_chat_media_thinking_01.mjs && node scripts/validate_site_avatar_integration.mjs && node scripts/validate_site_avatar_fallback_runtime.mjs`

Expected: PASS with one WebGL context, official assets, running loop, and fallback.

- [ ] **Step 6: Commit**

```bash
git add avatar-runtime/runtime/animation.mjs avatar-runtime/runtime/controller.mjs avatar-runtime/runtime/state-machine.mjs assets/animations/lotbi-clips.v1.json site-avatar.js site-avatar.css scripts/validate_chat_media_thinking_01.mjs
git commit -m "feat(chat): run official LOTBI while responses are pending"
```

### Task 4: Site regression, visual acceptance, and delivery

**Files:**
- Modify: `.github/workflows/site-review.yml`
- Test: `scripts/validate_chat_media_thinking_01.mjs`

**Interfaces:**
- Produces: required CI gate `CHAT-ATTACHMENT-NO-FILENAME-01` / `CHAT-THINKING-RUNNING-LOTBI-01`.

- [ ] **Step 1: Add the focused test to required Site CI**

```yaml
- name: Validate chat attachment privacy and Running LOTBI thinking UX
  run: node scripts/validate_chat_media_thinking_01.mjs
```

- [ ] **Step 2: Run the complete local Site validation**

Run: `python scripts/validate_site.py` plus every command in `.github/workflows/site-review.yml` that is runnable in the workspace.

Expected: all executed gates exit 0; any environment-only gate is reported by exact name.

- [ ] **Step 3: Run viewport visual acceptance**

Run controlled Chromium at desktop, 390px Android, Fold, and 390px iPhone-style viewports for pre-send image, image-only sent message, two/three image grid, PDF label, delayed loader, answer transition, error, and reduced motion.

- [ ] **Step 4: Commit CI wiring**

```bash
git add .github/workflows/site-review.yml scripts/validate_chat_media_thinking_01.mjs
git commit -m "ci(site): require chat media and thinking UX contract"
```

- [ ] **Step 5: Push, open PR, verify exact-head CI, normally merge, and verify Pages revision**

Check latest `main`, ahead/behind, mergeability, and required exact-head checks immediately before merge. After merge, verify the Production deployment SHA equals the merge SHA and run the safe public E2E matrix.
