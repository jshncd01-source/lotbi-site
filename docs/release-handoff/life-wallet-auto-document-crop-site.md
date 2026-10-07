READY_FOR_DEPLOY=YES

# life-wallet-auto-document-crop-site — release handoff (hand-held / card-on-wallet / document pages / phone rotation)

REPO=lotbi-site
FEATURE_BRANCH=feature/life-wallet-auto-document-crop-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ... refs/heads/feature/life-wallet-auto-document-crop-site`)
REMOTE_FEATURE_SHA=same as FEATURE_SHA after push (verified with git ls-remote at push time)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=93fee0d2b988256312182bde4919a09d5ad204ff
CODE_SHA=6b87436107b8f67c640332279ea51680e8049a3c
CODE_COMMITS=f71dc95e fix(site): crop only the card when held in hand or lying on a wallet; 0863b80a fix(site): keep phone photo rotation and crop whole document pages (merged with latest main in 6b874361)
ASSET_VERSION=aset-7dda1e4a253e

SCOPE=site-life-wallet-scan.js (detection) and site-life-wallet-scan-ui.js (photo decode size only). Storage and save boundary unchanged.
CHANGE=
  1. Card held in the hand: hand/arm entering from the photo edge is removed before fitting. Card lying on a wallet/tray: card+holder region is split into two colour groups; a clearly lighter inner rectangle inside a chosen rectangle is taken as the card. Side lines stay within 15 degrees of the side direction.
  2. Phone photos with EXIF orientation 5-8 (portrait photos) were resized in the unrotated frame and decoded squashed, so detection failed and save stayed disabled. The decode size is now computed in the rotated frame.
  3. Paper documents (scans, photographed pages) with no card-like rectangle: the crop is the union of the page content plus a 2% pad, so text is never cut. Blank paper stays manual.
  4. Uncertain photos start the manual frame from a 2% inset (was 6-8%), so the preview no longer looks cut.

CHANGED_TEST_EXPECTATIONS=validate_life_wallet_document_scan_synthetic_02.mjs: added SYNTHETIC_HAND_HELD (8 scenes, must crop automatically), SYNTHETIC_CARD_ON_WALLET (8 scenes, card or manual, never the wallet; at least 2/3 automatic), SYNTHETIC_FULL_PAGE (6 scans/photographed pages: content never cut, margin at most 4%; blank page counted in NEGATIVE as manual); allowed non-identifying diagnostics keys occluder/holder/nested/holderContent/innerLighter/page. validate_life_wallet_document_scan_ui_02.mjs: added an EXIF orientation-6 decode size check. No existing assertion removed or loosened.
TEST_STATUS=PASS on CODE_SHA — asset check, validate_site.py, validate_hardening.py, validate_accessibility.py, node --check (scan, scan-ui, wallet), life wallet validators scan_01, scan_ui_01, scan_ui_02, synthetic_02 (77 scenes, avg 451 ms: hand-held 8/8 automatic, card-on-wallet 7/8 automatic and 1 manual, full page 6/6 automatic with no content cut, negatives 8/8 manual, no wrong crop), document_save_01, photo_picker_01, card_carousel_01, entry_lock_01.
NEW_FAILURES=NONE

ACTUAL_PHOTO_PRECHECK=PASS — run in the user's logged-in Production page on the user's own photos, numbers only (no image copied, stored or logged); the user visually confirmed the in-browser preview of this change:
  - card on a wallet held in hand (1920x2560): deployed = manual (protrusion); this change = automatic, confidence 0.946, crop aspect 1.551, corner angles 89-92.
  - photographed document page, portrait phone photo with EXIF orientation 6: deployed = decoded squashed 2560x1920, manual, save disabled; this change = decoded 1920x2560, automatic (full page), confidence 0.80; user confirmed the preview.
  - original green-surface photo (1440x811): deployed = automatic; this change = automatic, crop aspect 1.579, angles 90 (no regression).
  - lease contract scan (1811x2560): NOT TESTED with this change on the real photo (synthetic page scenes only).
PRODUCTION_E2E_BEFORE_THIS_DEPLOY=original green-surface photo PASS on sha-a9affcd5 (automatic, save enabled, manual editor hidden, user visual confirmation).
POST_DEPLOY_SMOKE=user re-selects (1) the card-on-wallet photo and (2) the photographed document page in Life Wallet: expect data-scan-mode=automatic, status "배경과 여백을 자동으로 제거했습니다", save enabled, user confirms only the card / the whole page is shown; optionally (3) the lease contract scan: expect no cut text and small margins. Do not press save.
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
PRIVACY_BOUNDARY=PASS — no real photo in repository, fixtures, logs or commits; synthetic scenes only.
READY_FOR_DEPLOY=YES

USER_DECISION_NEEDED=NONE
