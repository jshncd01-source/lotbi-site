READY_FOR_DEPLOY=YES

# life-wallet-auto-document-crop-site — release handoff (hand-held / card-on-wallet)

REPO=lotbi-site
FEATURE_BRANCH=feature/life-wallet-auto-document-crop-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ... refs/heads/feature/life-wallet-auto-document-crop-site`)
REMOTE_FEATURE_SHA=same as FEATURE_SHA after push (verified with git ls-remote at push time)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=e3512a0449c43162086d65083a6774e19f3b55f9
CODE_SHA=7087526c1ac8330a5f827d78ce6d4cac8c689d39
CODE_COMMIT=f71dc95e fix(site): crop only the card when held in hand or lying on a wallet (merged with latest main in 7087526c)
ASSET_VERSION=aset-5c6b6c504c6c

SCOPE=site-life-wallet-scan.js only (detection). UI, storage and save boundary unchanged.
CHANGE=Life Wallet automatic crop now handles a card held in the hand (hand/arm entering from the photo edge is removed before fitting) and a card lying on a wallet/tray (card+holder region is split into two colour groups; a clearly lighter inner rectangle inside a chosen rectangle is taken as the card). Side lines stay within 15 degrees of the side direction.

CHANGED_TEST_EXPECTATIONS=validate_life_wallet_document_scan_synthetic_02.mjs: added SYNTHETIC_HAND_HELD (8 scenes, must crop the card automatically) and SYNTHETIC_CARD_ON_WALLET (8 scenes, card or manual, never the wallet; at least 2/3 automatic); allowed non-identifying diagnostics keys occluder/holder/nested/holderContent/innerLighter. No existing assertion removed or loosened.
TEST_STATUS=PASS — asset check, validate_site.py, validate_hardening.py, validate_accessibility.py, node --check (scan, scan-ui, wallet), life wallet validators scan_01, scan_ui_01, scan_ui_02, synthetic_02 (70 scenes: hand-held 8/8 automatic, card-on-wallet 7/8 automatic and 1 manual, negatives 7/7 manual, no wrong crop), document_save_01, photo_picker_01, card_carousel_01, entry_lock_01.
NEW_FAILURES=NONE

ACTUAL_PHOTO_PRECHECK=PASS — run in the user's logged-in Production page on the user's own photos, numbers only (no image copied, stored or logged):
  - card on a wallet held in hand (1920x2560): deployed a9affcd5 = manual (protrusion); this change = automatic, confidence 0.946, crop aspect 1.551, corner angles 89-92.
  - original green-surface photo (1440x811): deployed = automatic; this change = automatic, crop aspect 1.579, angles 90 (no regression).
PRODUCTION_E2E_BEFORE_THIS_DEPLOY=original green-surface photo PASS on sha-a9affcd5 (automatic, save enabled, manual editor hidden, user visual confirmation).
POST_DEPLOY_SMOKE=user re-selects the card-on-wallet photo in Life Wallet: expect data-scan-mode=automatic, status "배경과 여백을 자동으로 제거했습니다", save enabled, user confirms only the card is shown; do not press save.
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
PRIVACY_BOUNDARY=PASS — no real photo in repository, fixtures, logs or commits; synthetic scenes only.
READY_FOR_DEPLOY=YES

USER_DECISION_NEEDED=NONE
