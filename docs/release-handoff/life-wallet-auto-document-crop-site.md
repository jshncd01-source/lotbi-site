READY_FOR_DEPLOY=YES

# life-wallet-auto-document-crop-site — release handoff (portrait page display)

REPO=lotbi-site
FEATURE_BRANCH=feature/life-wallet-auto-document-crop-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ... refs/heads/feature/life-wallet-auto-document-crop-site`)
REMOTE_FEATURE_SHA=same as FEATURE_SHA after push (verified with git ls-remote at push time)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=ce132b3c (Merge release/20261007-site-t8-work; already contains the previous Life Wallet crop release 6b874361)
CODE_SHA=2fb3edd5 fix(site): show saved and scanned pages at their own shape
ASSET_VERSION=aset-b312bf71e052

SCOPE=site-life-wallet.css only (+ asset token). Detection, storage and save boundary unchanged.
CHANGE=Portrait pages (lease contracts, certificates) were shown inside a fixed 720x520 scan result box and a full-width saved card frame, leaving wide empty bars on both sides ("looks like a screenshot"). The scan result image and the saved wallet card now follow the image's own aspect (card shrinks to the image, min 200px); landscape ID cards still fill the card frame.

CHANGED_TEST_EXPECTATIONS=validate_life_wallet_document_scan_ui_02.mjs: added a portrait page preview check in a 760px pane (box aspect must equal image aspect). validate_life_wallet_card_carousel_01.mjs: moved from --dump-dom/virtual-time to the shared real-time CDP harness (scripts/lib/headless-fixture-result.mjs, same as the other wallet validators); existing assertions unchanged; added portrait (no empty bars) and landscape (fills the frame) fit checks. No assertion removed or loosened. Both new checks fail on the previous CSS (720x520 box for a 0.72 page; 460px card around a 0.72 page) and pass now.
TEST_STATUS=PASS on CODE_SHA — asset check, validate_site.py, validate_hardening.py, validate_accessibility.py, node --check (scan, scan-ui, wallet), life wallet validators scan_01, scan_ui_01, scan_ui_02, synthetic_02 (77 scenes), document_save_01, photo_picker_01, card_carousel_01, entry_lock_01.
NEW_FAILURES=NONE

ACTUAL_PHOTO_PRECHECK=PASS — user's logged-in Production page (served sha-a3443d65 crop code), numbers only, no image copied, stored or logged:
  - lease contract scan 1811x2560: automatic (full page), save enabled; crop = content + 2% pad (x 0.038-0.981, y 0.025-0.957), so the crop itself was already tight.
  - with this CSS applied in-page: scan result box 373x520 for a 1467x2048 result (was 720x520 with ~175px bars), saved card 374x522 around a 372x520 image (was 460x522 with ~43px bars). User confirmed the bars are gone.
POST_DEPLOY_SMOKE=user opens Life Wallet: (1) re-select the lease contract: result shows no empty side bars; (2) the saved contract card in the wallet shows no empty side bars; (3) an ID card still fills its card frame.
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
PRIVACY_BOUNDARY=PASS — no real photo in repository, fixtures, logs or commits; synthetic images only.
READY_FOR_DEPLOY=YES

USER_DECISION_NEEDED=NONE
