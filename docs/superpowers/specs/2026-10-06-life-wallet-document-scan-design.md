# Life Wallet document scan and safe image enhancement design

## Purpose

Life Wallet must store a clean document image rather than an unprocessed screenshot or camera frame. Every newly selected or captured image is processed in the browser before encryption: detect the document, correct perspective and rotation, remove surrounding background, apply conservative readability improvements, show the result for confirmation, and only then save it.

The experience should resemble the capture-and-review portion of a banking identity-document flow. It is not identity verification.

## Scope

This change is limited to the public `lotbi-site` Life Wallet.

In scope:

- JPEG and PNG images selected through the existing Life Wallet picker.
- Automatic four-corner document detection.
- Rotation and perspective correction.
- Removal of background outside the detected document.
- Conservative, non-generative readability enhancement.
- A review screen with `이대로 저장`, `모서리 조정`, and `다시 선택` actions.
- Manual four-corner adjustment when automatic detection is uncertain or incorrect.
- Browser-only processing followed by the existing encrypted local save.
- Natural-aspect-ratio wallet display without the current fixed CSS zoom crop.

Out of scope:

- OCR or extraction of names, document numbers, dates, or resident-registration numbers.
- Authenticity checks, face matching, liveness, anti-spoofing, or government/financial-institution lookup.
- Uploading an original or corrected image to LOTBI servers, chat, analytics, or third parties.
- Generative enhancement, face restoration, invented text, or AI upscaling.
- Reprocessing existing saved cards. Existing cards remain readable and unchanged.
- Changes to `lotbi-core`, `lotbi-app`, `lotbi-web`, or other repositories.

## Options considered

### 1. Automatic detection only

Fast when it succeeds, but unsafe for patterned desks, shadows, transparent sleeves, and partially cropped documents. A wrong automatic crop could remove important information with no recovery path.

### 2. Manual crop only

Reliable but makes every customer align four corners even for an ordinary clear photo. This does not meet the banking-style capture expectation.

### 3. Automatic detection with mandatory review and manual fallback

Recommended. The browser proposes the four corners, the customer sees the corrected result, and the customer can adjust the corners before saving. This combines low effort with an explicit safety check.

## User flow

1. The customer chooses or captures a JPEG/PNG image in the existing `자료 추가` flow.
2. The browser decodes the image locally and applies camera orientation.
3. A downscaled working copy is used to search for the most likely document quadrilateral.
4. When confidence is sufficient, the four detected corners are shown over the original image. When confidence is insufficient, the UI explains that automatic recognition was uncertain and starts in manual-corner mode.
5. The browser performs a perspective warp using the selected four corners and preserves the detected document's natural proportions.
6. Conservative quality processing is applied to the corrected image.
7. The corrected card is shown in a review screen. The customer may:
   - choose `이대로 저장`;
   - choose `모서리 조정` and drag any corner;
   - choose `다시 선택` to replace the source image.
8. The corrected result is encoded locally and passed into the existing AES-GCM encrypted storage flow.
9. The decoded source, intermediate canvases, and object URLs are released when the form is saved, cancelled, replaced, or closed.

The save action is unavailable until a corrected preview exists and the customer has reviewed it. The system never silently falls back to storing the full uncorrected camera frame.

## Document detection and correction

The scan module is isolated from wallet storage and UI state. It accepts an image source and returns:

- source dimensions and orientation;
- four ordered corner points;
- detection confidence and reason;
- corrected image canvas/blob;
- non-sensitive quality warnings.

Detection runs on a bounded working image to avoid excessive memory use on mobile devices. The pipeline uses grayscale conversion, blur reduction, edge detection, contour extraction, polygon approximation, and quadrilateral scoring. Candidate scoring considers covered area, convexity, rectangular geometry, edge support, and whether all four corners are inside the source bounds.

The final perspective transform is rendered from the original-resolution source, not the downscaled detection image. Output keeps the detected proportions, limits the long edge to 2048 pixels, and never enlarges a small source beyond its native resolution. The confirmed result is encoded as JPEG at quality 0.92, which stays within the existing wallet image contract while bounding encrypted-storage size.

If the browser cannot initialize the detector, the customer can still place all four corners manually. A failure must be visible; it must not save the source unchanged.

## Safe image enhancement

Enhancement exists only to improve readability of pixels already present. After perspective correction, the browser may apply:

- exposure normalization within conservative limits;
- white-balance correction for mild color casts;
- local contrast improvement;
- mild noise reduction;
- mild unsharp masking for text edges;
- high-quality downscaling when the image is larger than the output limit.

The processing must not perform generative fill, super-resolution hallucination, face beautification, text replacement, or aggressive smoothing. Enhancement parameters are capped and deterministic.

Before confirmation, the scanner checks for severe blur, clipped highlights/glare, very low resolution, and a document touching the source boundary. These conditions produce a plain-language `다시 촬영 권장` warning. A warning does not claim that unreadable information has been repaired.

The review UI offers an `원본 색감` / `선명하게` comparison so the customer can reject enhancement while keeping the geometric correction. Geometric correction and the selected enhancement mode are baked into the locally encrypted saved image.

## Privacy and security

- Processing is entirely client-side.
- The scan module makes no `fetch`, `XMLHttpRequest`, beacon, form upload, or third-party SDK request.
- The original file is held only in browser memory for the active editing session.
- Only the confirmed corrected image enters the existing encrypted IndexedDB record.
- Error messages and telemetry contain no image data, OCR result, filename, document number, or pixel-derived identity information.
- The UI explicitly states: `사진 보정은 이 브라우저에서만 처리되며 LOTBI 서버로 전송되지 않습니다.`

## UI and accessibility

The corner editor overlays four large draggable handles and visible connecting lines on the source image. Handles support pointer, touch, and keyboard movement. The current corner is announced with an accessible label, and keyboard users can move it in small or larger increments.

The corrected preview uses the actual document proportions. The existing wallet carousel removes the fixed `scale(1.22)` display crop, because the saved image itself is already tightly corrected. Cards retain a maximum display size but do not cut off document edges.

All processing states are explicit: `사진 분석 중`, `자동 인식 완료`, `모서리를 확인해 주세요`, `보정 결과 확인`, and actionable failure text. Cancelling returns to the add form without saving.

## Compatibility and data migration

Existing encrypted cards and backup files keep their current schema and remain readable. New cards continue storing a validated JPEG or PNG data URL in `frontDataUrl`, so backup compatibility is preserved. Optional scan metadata is not required for decryption or display and should not contain identity data.

The existing JPEG/PNG and 12 MB input limits remain. Unsupported browsers use manual corner placement rather than uploading to a server.

## Testing and acceptance

Tests use synthetic documents containing non-personal placeholder graphics. No real identity document is committed to the repository.

Automated coverage must prove:

- a rotated trapezoid is detected and perspective-corrected to a rectangle;
- surrounding background is excluded from the corrected output;
- corner ordering and transforms work for landscape and portrait-like documents;
- uncertain detection opens manual adjustment instead of silently saving the original;
- dragging and keyboard adjustment update the corrected preview;
- enhancement stays within defined caps and can be disabled;
- severe blur/glare/low-resolution warnings appear;
- the confirmed corrected image, not the source frame, enters `vault.save`;
- no network API is called during select, detection, adjustment, enhancement, or save;
- existing cards and backups still open;
- carousel images show the complete corrected document without fixed zoom cropping;
- the editor fits desktop and 390 px mobile viewports.

Required verification before integration:

- JavaScript syntax checks.
- New document-scan unit and browser-flow tests.
- Existing Life Wallet picker, lock/session, carousel, backup, and asset-cache tests.
- Repository lint/build gates where present.
- Production smoke test with a synthetic skewed document on desktop web and mobile viewport emulation.

Mobile viewport emulation is reported separately from real Android Chrome, Samsung Internet, or iPhone Safari testing.

## Release approach

Implementation stays on `feature/life-wallet-document-scan-site`, based on the latest Ncloud `main`. It is integrated only through the normal Ncloud merge gate after exact-head tests pass. Only `lotbi-site` is deployed. Production is considered complete only after the served revision is verified and the full select-correct-review-encrypt-display flow passes with synthetic data.
