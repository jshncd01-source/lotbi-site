READY_FOR_DEPLOY=YES

# life-wallet-auto-document-crop-site — release handoff (pages, one-card wallet, PDF)

REPO=lotbi-site
FEATURE_BRANCH=feature/life-wallet-auto-document-crop-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ... refs/heads/feature/life-wallet-auto-document-crop-site`)
REMOTE_FEATURE_SHA=same as FEATURE_SHA after push (verified with git ls-remote at push time)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=fb12f803 (Merge release/20261007-site-t9-work)
CODE_SHA=73071c424d229dbc3f4726a52b18d4cb1e5fc0ef (merge of latest main)
CODE_COMMITS=2fb3edd5 portrait page display (previous READY 7134ac66, not yet in main); 7b7fce6b photographed pages + one-card wallet; afea3d85 PDF registration
ASSET_VERSION=aset-799573ca1e72

SCOPE=lotbi-site only: site-life-wallet.js, site-life-wallet.css, site-life-wallet-scan.js, site-life-wallet-scan-ui.js, new site-life-wallet-pdf.js, new vendor/pdfjs-6.4.299/ (Mozilla pdf.js, Apache-2.0, 2.5MB, loaded only when a PDF is chosen), scripts/asset_cache_version.mjs (top-level vendor/ is sealed like avatar-runtime/vendor). Storage format and encrypted save boundary unchanged (a PDF page is saved as the same JPEG data URL).
CHANGE=
  1. Portrait pages (contracts) no longer sit inside a fixed 720x520 box or a full-width card frame with empty side bars.
  2. Photographed pages: crop stays inside the sheet (no dark desk strip), paper is whitened like a scanner (cards keep their colours: a page is a full-page crop or a large square-cornered, paper-coloured, non-ID-shaped rectangle), no edge/glare retake warning for pages, taller preview.
  3. Wallet strip like a phone wallet: one card at a time, swipe / mouse drag / dots / arrow keys, no arrow buttons; the strip height follows the card on screen, so an ID card is not padded to a tall page's height. Card position math no longer counts the page margin.
  4. PDF: the picker accepts JPG/PNG (12MB) and PDF (20MB). Page 1 opens in the automatic crop; multi-page PDFs get previous/next page selection; a page with no outline is kept whole; password-protected or broken PDFs show a message. The PDF never leaves the browser.

CHANGED_TEST_EXPECTATIONS (user requests on 2026-10-07):
  - validate_life_wallet_card_carousel_01.mjs: "next-card peek" and "previous/next arrow buttons" replaced by one-card-at-a-time, drag, dots, keyboard and per-card height checks ("삼성페이처럼 한장씩 보이게 터치형식으로"); compactTrackPadding replaced by the per-card height check; moved to the real-time CDP harness; portrait/landscape fit checks kept.
  - validate_life_wallet_photo_picker_01.mjs: accept string and unsupported-file message now include PDF ("pdf 파일도 되게"); GIF is still rejected.
  - Added: validate_life_wallet_pdf_01.mjs (two-page PDF built in the test), desk/dim page scene and "cards are never whitened" check in synthetic_02, page whitening / no-warning / no-letterbox checks in scan_ui_02.
TEST_STATUS=PASS on CODE_SHA — asset check, validate_site.py, validate_hardening.py, validate_accessibility.py, node --check (scan, scan-ui, wallet), life wallet validators scan_01, scan_ui_01, scan_ui_02, synthetic_02 (78 scenes, cards never treated as pages), pdf_01, document_save_01, photo_picker_01, card_carousel_01, entry_lock_01.
NEW_FAILURES=NONE

ACTUAL_PHOTO_PRECHECK (numbers only, no image copied, stored or logged):
  - photographed lease contract on a dark desk (901x1600): deployed crop y 0-0.892 with a black strip, paper median 155, retake warning; this change crop y 0.017-0.858, paper median 220, no warning.
  - photographed confirmation page (1500x2000): crop = print + 2% (left edge strip ignored), paper median 220, no warning.
  - lease contract scan (1811x2560): page crop unchanged, now whitened; ID card photos (green surface, card on wallet) stay cards (no whitening).
  - PDF: synthetic two-page PDF only (pdf_01); NOT TESTED with a user PDF yet.
NGINX_NOTE=Production serves .mjs as application/octet-stream (curl of /avatar-runtime/runtime/controller.mjs); pdf.js is shipped as .js for that reason. Avatar .mjs modules may be affected — separate issue, not changed here.
POST_DEPLOY_SMOKE=Life Wallet: (1) photographed contract → white paper, no black strip, no retake warning; (2) wallet strip shows one card at a time, swipe/drag moves one card, ID card frame has no empty space under it; (3) choose a multi-page PDF → page 1 cropped, page selection works, save enabled. Do not press save on real documents unless the user wants to.
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
PRIVACY_BOUNDARY=PASS — no real photo or PDF in repository, fixtures, logs or commits; synthetic images and a test-built PDF only.
READY_FOR_DEPLOY=YES

USER_DECISION_NEEDED=NONE
