READY_FOR_DEPLOY=NO

STATUS=REAL_PHOTO_VALIDATION_PENDING — user decision 2026-10-07 [PRE-DEPLOY FINAL DECISION]: do not deploy until REAL_ID_TEST=PASS, REAL_DOG_TEST=PASS, FALSE_AUTO_ACCEPT=0, GENERIC_COPY_FIX=PASS, SAVED_TITLE_FIX=PASS, NEW_FAILURES=0. Waiting for local paths of real ID and dog photos.

# life-wallet-auto-document-crop-site — release handoff (cards/documents only, PDF page 1, one-card wallet)

REPO=lotbi-site
FEATURE_BRANCH=feature/life-wallet-auto-document-crop-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ... refs/heads/feature/life-wallet-auto-document-crop-site`)
REMOTE_FEATURE_SHA=same as FEATURE_SHA after push (verified with git ls-remote at push time)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=8a9e414d (Merge release/20261007-site-t10-work)
CODE_SHA=f6679e94f58cbfaa0e91062f5f42e112bd34d59b (merge of latest main)
CODE_COMMITS (none in main yet; previous READYs 7134ac66 and e121b959 are included):
  2fb3edd5 portrait page display; 7b7fce6b photographed pages + one-card wallet; afea3d85 PDF registration; bfc065cd cards/documents only, PDF page 1 only, no kind field, compact picker button, phone one-card fix
ASSET_VERSION=aset-925dc0b45ff9

SCOPE=lotbi-site only: site-life-wallet.js, site-life-wallet.css, site-life-wallet-scan.js, site-life-wallet-scan-ui.js, new site-life-wallet-pdf.js, new vendor/pdfjs-6.4.299/ (Mozilla pdf.js 6.4.299, Apache-2.0, legacy build, 2.5MB, loaded only when a PDF is chosen), scripts/asset_cache_version.mjs (top-level vendor/ is sealed like avatar-runtime/vendor). Encrypted save boundary unchanged; a PDF page is saved as the same JPEG data URL. New items use the neutral kind 'document' ("저장 자료"); existing kinds stay readable (stored items and backups).
CHANGE=
  1. Only cards and documents: printed text rows are counted (5+ similar marks in a row). A whole-frame page needs 12+ rows, a card crop 2+; a photo with fewer than 2 rows in the whole frame is refused ("신분증이나 문서로 보이지 않습니다") with adjusting and saving disabled. Fixes a pet photo accepted as a full page on Production (aset-657773a1aaa9).
  2. PDF: picker accepts JPG/PNG (12MB) and PDF (20MB); only page 1 is shown and saved (user decision); a page with no outline but with text is kept whole; textless, password-protected or broken PDFs are refused with a message. The PDF never leaves the browser.
  3. Photographed pages: crop stays inside the sheet, paper whitened like a scanner (cards keep their colours), no edge/glare/blur retake warning for pages, taller preview; portrait pages shown without empty side bars.
  4. Wallet strip like a phone wallet: one card at a time on desktop and phones, swipe / mouse drag / dots / arrow keys, no arrow buttons; strip height follows the card on screen.
  5. Add form: no "자료 종류" field; photo picker change button is a compact outlined button in fixed columns (the hint was squeezed into the thumbnail column while correcting).

CHANGED_TEST_EXPECTATIONS (user requests on 2026-10-07):
  - card_carousel_01: next-card peek / arrow buttons → one card at a time, drag, dots, keyboard, per-card height, now also at a 390px phone width; CDP harness.
  - photo_picker_01: accept/error copy include PDF; compact outlined change button with an unclipped hint.
  - Synthetic inputs in scan_01, scan_ui_01, document_save_01, photo_picker_01 and pdf_01 now carry printed rows like real cards/documents (the scanner refuses textless photos); no assertion removed or loosened.
  - Added: pet-photo scenes (NOT_A_DOCUMENT, never cropped), textless PDF refusal, PDF page-1-only, neutral kind, desk/dim page and page whitening checks.
TEST_STATUS=PASS on CODE_SHA — asset check, validate_site.py, validate_hardening.py, validate_accessibility.py, node --check (scan, scan-ui, wallet), life wallet validators scan_01, scan_ui_01, scan_ui_02, synthetic_02 (82 scenes: cards 5-18 text rows, pages 30, pets 0-9 and never cropped), pdf_01, document_save_01, photo_picker_01, card_carousel_01 (desktop + 390px), entry_lock_01.
NEW_FAILURES=NONE

ACTUAL_PHOTO_PRECHECK (numbers only; no image or PDF copied, stored or logged):
  - pet photo (1050x1400) on Production: accepted as full page with only 2% print density, save enabled → this change requires 12+ text rows for a full page (the pet showed 36 aligned marks of 152, far below documents).
  - photographed contract on desk (901x1600): automatic, 93 text rows, white paper, no black strip; photographed confirmation page (1500x2000): automatic, 27 rows.
  - user's registry PDF (2 pages): page 1 drawn at 1809x2560, automatic full page, 47 text rows.
  - ID card photos: synthetic only after this change (cards keep 5+ rows); NOT TESTED again on the user's real ID photos.
NGINX_NOTE=Production serves .mjs as application/octet-stream; pdf.js is shipped as .js for that reason. Avatar .mjs modules may be affected — separate issue, not changed here.
POST_DEPLOY_SMOKE=Life Wallet: (1) a pet photo → "신분증이나 문서로 보이지 않습니다", no save; (2) an ID card photo → automatic, save enabled; (3) a photographed contract → white paper, no black strip, no retake warning; (4) a multi-page PDF → only page 1, save enabled; (5) wallet shows one card at a time on phone and desktop; (6) add form has no 자료 종류 field and a small 다시 선택 button.
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
PRIVACY_BOUNDARY=PASS — no real photo or PDF in repository, fixtures, logs or commits; synthetic images and a test-built PDF only.
READY_FOR_DEPLOY=NO

USER_DECISION_NEEDED=real ID and dog photo paths (local files, numbers-only check)
