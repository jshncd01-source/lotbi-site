# Life Wallet Document Scan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn every newly selected Life Wallet photo into a reviewed, perspective-corrected, tightly cropped, conservatively enhanced document image before local encryption.

**Architecture:** Add a dependency-free browser image-processing module that detects and rectifies a four-corner document with Canvas/ImageData, plus a separate review/editor component for automatic and manual corner placement. `site-life-wallet.js` continues to own encryption and storage, but receives only a confirmed corrected JPEG from the editor.

**Tech Stack:** Browser ES modules, Canvas 2D/ImageData, Pointer Events, Web Crypto/IndexedDB already used by Life Wallet, Node.js validation scripts, headless Chrome.

**Spec:** `docs/superpowers/specs/2026-10-06-life-wallet-document-scan-design.md`

## Global Constraints

- Modify and deploy only `lotbi-site`.
- JPEG/PNG input remains limited to 12 MB.
- All image processing stays in the browser with no image, filename, or pixel-derived identity data sent through network APIs.
- Output is JPEG quality 0.92, natural aspect ratio, maximum 2048 pixels on the long edge, and is never enlarged beyond source resolution.
- Never silently save the uncorrected source frame; a reviewed corrected preview is required.
- Existing encrypted cards and backup schema remain compatible.
- No OCR, identity verification, face matching, generative fill, face restoration, text replacement, or generative upscaling.
- Tests and committed fixtures use synthetic documents only.

## Review Focus

- A document against a patterned or similarly colored background must fall back to manual corners rather than confidently cutting off content; Task 1 tests the low-confidence path.
- EXIF-rotated mobile photos must appear upright before corner editing; Task 3 tests orientation-aware decoding.
- Very large mobile photos must stay within memory/output limits and must not be enlarged; Task 2 tests exact size caps.
- Touch and keyboard users must be able to correct any corner without accidental page navigation; Task 3 tests pointer and keyboard movement.
- Cancelling, replacing a file, or closing the editor must release temporary URLs/canvases and save nothing; Task 4 tests cleanup and zero storage writes.

---

### Task 1: Document geometry and automatic corner detection

**Files:**
- Create: `site-life-wallet-scan.js`
- Create: `scripts/validate_life_wallet_document_scan_01.mjs`

**Interfaces:**
- Produces: `orderDocumentCorners(points)` returning `{topLeft, topRight, bottomRight, bottomLeft}`.
- Produces: `detectDocumentCorners(imageData, options?)` returning `{corners, confidence, mode, reason}` where `mode` is `automatic` or `manual`.
- Produces: `defaultDocumentCorners(width, height)` for the visible manual fallback inset.

- [ ] **Step 1: Write the failing synthetic geometry test**

Create a headless-browser test with a non-personal colored trapezoid on a contrasting background. Assert ordered corners are within 12 working pixels of the synthetic document, confidence is at least 0.75, and a patterned low-contrast fixture returns `mode: 'manual'` with all default corners inside the image.

- [ ] **Step 2: Run the test and verify RED**

Run: `node scripts/validate_life_wallet_document_scan_01.mjs`

Expected: FAIL because `site-life-wallet-scan.js` or its exports do not exist.

- [ ] **Step 3: Implement the minimal detector**

In `site-life-wallet-scan.js`, implement bounded downsampling, grayscale/blur, Sobel edge magnitude, adaptive thresholding, connected edge-region extraction, extreme-point quadrilateral generation, convexity/area/edge-support scoring, corner ordering, and the manual inset fallback. Keep the detector deterministic and free of DOM/network dependencies except standard `ImageData` types.

- [ ] **Step 4: Run the detector test and verify GREEN**

Run: `node scripts/validate_life_wallet_document_scan_01.mjs`

Expected: `LIFE_WALLET_DOCUMENT_SCAN_01 PASS`.

- [ ] **Step 5: Commit**

Commit: `feat(site): detect wallet document corners locally`

### Task 2: Perspective correction, safe enhancement, and quality warnings

**Files:**
- Modify: `site-life-wallet-scan.js`
- Modify: `scripts/validate_life_wallet_document_scan_01.mjs`

**Interfaces:**
- Produces: `rectifyDocument(source, corners, {enhance})` returning `{dataUrl, width, height, warnings, enhanced}`.
- Produces: `assessDocumentQuality(imageData)` returning warning codes from `blur`, `glare`, `low-resolution`, and `edge-clipped`.

- [ ] **Step 1: Extend the test for correction and enhancement**

Assert the synthetic trapezoid becomes a rectangular JPEG, background corner colors are absent, proportions follow measured opposite edges, long edge is at most 2048, small inputs are not enlarged, `enhance: false` preserves the geometrically corrected color baseline, and severe synthetic blur/glare/low resolution returns the required warning codes.

- [ ] **Step 2: Run the test and verify RED**

Run: `node scripts/validate_life_wallet_document_scan_01.mjs`

Expected: FAIL because rectification and quality interfaces are missing.

- [ ] **Step 3: Implement correction and conservative enhancement**

Implement inverse homography sampling with bilinear interpolation, output-size calculation from opposing edges, JPEG 0.92 encoding, exposure/white-balance caps, mild local contrast/noise reduction/unsharp masking, and deterministic quality metrics. Never apply enlargement or generative processing.

- [ ] **Step 4: Run the scan test and verify GREEN**

Run: `node scripts/validate_life_wallet_document_scan_01.mjs`

Expected: `LIFE_WALLET_DOCUMENT_SCAN_01 PASS`.

- [ ] **Step 5: Commit**

Commit: `feat(site): correct and safely enhance wallet documents`

### Task 3: Review and manual-corner editor

**Files:**
- Create: `site-life-wallet-scan-ui.js`
- Modify: `site-life-wallet.css`
- Create: `scripts/validate_life_wallet_document_scan_ui_01.mjs`

**Interfaces:**
- Consumes: Task 1 detection and Task 2 rectification interfaces.
- Produces: `createWalletDocumentScanner({file, onConfirm, onCancel, onReplace})` returning `{element, destroy}`.
- Calls `onConfirm(correctedDataUrl)` only after explicit `이대로 저장` activation.

- [ ] **Step 1: Write the failing desktop/mobile UI test**

Use a synthetic skewed file in headless Chrome. Assert orientation-aware decoding, visible analysis state, four labelled handles, automatic result preview, `원본 색감`/`선명하게`, warning copy, `이대로 저장`, `모서리 조정`, and `다시 선택`. Assert pointer movement changes a corner, arrow keys move a focused handle, the page URL/history does not change during a drag, and the editor fits 390 px.

- [ ] **Step 2: Run the UI test and verify RED**

Run: `node scripts/validate_life_wallet_document_scan_ui_01.mjs`

Expected: FAIL because the scanner UI module does not exist.

- [ ] **Step 3: Implement the editor**

Decode with browser orientation applied, draw the source and four-corner overlay, implement pointer capture and keyboard increments, regenerate previews after confirmed corner changes, expose enhancement comparison, show explicit processing/confidence/warning states, and revoke temporary resources in `destroy()`.

- [ ] **Step 4: Run the UI test and verify GREEN**

Run: `node scripts/validate_life_wallet_document_scan_ui_01.mjs`

Expected: `LIFE_WALLET_DOCUMENT_SCAN_UI_01 PASS`.

- [ ] **Step 5: Commit**

Commit: `feat(site): review and adjust scanned wallet documents`

### Task 4: Life Wallet encrypted-save integration and display fidelity

**Files:**
- Modify: `site-life-wallet.js`
- Modify: `site-life-wallet.css`
- Modify: `scripts/validate_life_wallet_photo_picker_01.mjs`
- Modify: `scripts/validate_life_wallet_card_carousel_01.mjs`
- Create: `scripts/validate_life_wallet_document_save_01.mjs`

**Interfaces:**
- Consumes: `createWalletDocumentScanner` from Task 3.
- Preserves: existing `vault.save(accountId, card)` and `frontDataUrl` schema.

- [ ] **Step 1: Write failing integration tests**

Assert selecting a photo opens the scanner, the add form cannot save before confirmation, only the corrected JPEG reaches `vault.save`, no `fetch`/XHR/beacon occurs, cancel/replace/editor close writes nothing and destroys temporary resources, and existing stored/backup cards remain valid. Update the carousel assertion to require no fixed `scale(1.22)` and no cut-off document edges.

- [ ] **Step 2: Run the integration tests and verify RED**

Run: `node scripts/validate_life_wallet_document_save_01.mjs; node scripts/validate_life_wallet_photo_picker_01.mjs; node scripts/validate_life_wallet_card_carousel_01.mjs`

Expected: document-save and no-fixed-zoom assertions FAIL against the current direct-read/scale behavior.

- [ ] **Step 3: Connect the scanner to the add flow**

Replace direct `FileReader` confirmation with the scan-review result, update copy to state local-only processing, block submit until confirmation, destroy pending editor resources on every exit, and display corrected cards at their natural ratio without transform cropping. Do not change vault encryption or backup format.

- [ ] **Step 4: Run integration and existing wallet tests**

Run: `node scripts/validate_life_wallet_document_save_01.mjs; node scripts/validate_life_wallet_photo_picker_01.mjs; node scripts/validate_life_wallet_card_carousel_01.mjs; node scripts/validate_life_wallet_entry_lock_01.mjs`

Expected: all PASS.

- [ ] **Step 5: Commit**

Commit: `feat(site): save reviewed wallet document scans`

### Task 5: Asset wiring, full verification, integration, and Production smoke

**Files:**
- Modify: `index.html`
- Modify: `site-asset-version.json`
- Modify: relevant asset-cache validator if required by the existing contract.

**Interfaces:**
- Consumes: completed scan, UI, and wallet integration modules.
- Produces: Production-served, cache-busted Life Wallet scanner assets.

- [ ] **Step 1: Add failing asset-contract assertions**

Update the existing asset validator to require cache-busted references for every new scanner module/style dependency and the current asset version manifest.

- [ ] **Step 2: Run the asset test and verify RED**

Run the repository's existing asset-cache validation command discovered from `scripts/` and expect the new scanner asset assertion to fail.

- [ ] **Step 3: Wire and version assets**

Add same-origin module references or imports, bump the Life Wallet asset query/version manifest, and ensure no CDN or remote runtime dependency is introduced.

- [ ] **Step 4: Run full verification**

Run JavaScript syntax checks for changed modules; all new scan tests; all existing Life Wallet tests; asset-cache validation; `git diff --check`; and the repository's available build/lint gates. Record any repository-wide pre-existing failure separately and do not hide it.

- [ ] **Step 5: Commit exact-head release changes**

Commit: `chore(site): version wallet document scanner assets`

- [ ] **Step 6: Push and integrate through Ncloud gates**

Push `feature/life-wallet-document-scan-site`, run the normal Ncloud merge gate against current `main`, and integrate by normal merge only. Do not rebase, reset, force-push, or push directly to `main`.

- [ ] **Step 7: Deploy only `lotbi-site` and verify Production**

Deploy the exact merged Ncloud `main` revision, verify the served asset hashes, then run a Production smoke with a synthetic skewed document on desktop and 390 px mobile emulation. Confirm automatic/manual correction, review, local-only processing, encrypted save, natural-ratio card display, and unchanged text chat/calendar/place/login entry points.
