READY_FOR_DEPLOY=YES

STATUS=IMPLEMENTED; Life Wallet validators + site checks PASS on CODE_SHA; real phone/PC re-test after deploy = user (POST_DEPLOY_USER_TEST).

# life-wallet-full-frame-card-01-site — release handoff (business card / ID saved as a picture)

REPO=lotbi-site
FEATURE_BRANCH=feature/life-wallet-full-frame-card-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ... refs/heads/feature/life-wallet-full-frame-card-01-site`)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=82a8874ee151 (Merge release/20261008-site-t27-work via LOTBI Ncloud merge gate; contains life-wallet-mobile-p0-01-site dff5dfa8 = SITE-T26); re-checked unchanged right before this commit
CODE_SHA=3814012f (merge of main 82a8874e into 73bf1165)
CODE_COMMITS (none in main yet):
  73bf1165 Life Wallet takes a card saved as a picture whole
  3814012f / 9ee78b51 merges of Ncloud main (conflicts = asset tokens; site-conversation.js import block taken from main — this branch never changed it)
NON_TOKEN_DIFF_VS_MAIN=site-life-wallet-scan.js, scripts/fixtures/life-wallet-scan-scenes.mjs (flatCardImage), scripts/validate_life_wallet_full_frame_card_01.mjs (new) — every other file differs from main only by the asset token.
ASSET_VERSION=aset-8509fcc78dcb (node scripts/asset_cache_version.mjs --write after the merge)
SUPERSEDES=NONE (dff5dfa8 is already in main)
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
USER_DECISION_NEEDED=NONE

SCOPE=lotbi-site only: site-life-wallet-scan.js + tests. No Core/Web/App change, no data migration, no change to saved items.

USER_REPORT (2026-10-08, Production): a business card saved as an image file (848x470 PNG, the whole picture is the card) → "자료 테두리를 찾지 못했습니다", Save stayed off. A photographed card of the same kind was cropped and savable.
ROOT_CAUSE=A card that fills the whole picture has no outline against a background. Its paper only counted as a full-frame page, which needs 12 print rows (a business card has about 5-8), and a photo block or logo inside the card could be found as a "card" of its own (no print → manual). So the scanner fell back to manual and Save needed a hand-placed outline.
FIX=When the usual decision ends with nothing found (automatic-detection-uncertain / competing — never after a not-a-document or receipt refusal), the scanner tries the whole picture as the card (fullFrameCard): its paper (light, nearly colourless) spans >= 90% of the frame both ways, the frame is card-shaped (1.45 to 1.85 : 1 either way — camera photos are 1.33/1.5, phone screens 2+), it holds fewer rows than a page (< 12), the paper is equally bright in all four quarters (a file or a flat scan; a camera photo of a desk falls off with the light: quarter means within 10 levels), and at least 3 print rows are counted on the full photo (cards otherwise need 2). Accepted as source 'full-frame-card': whole picture kept, colours kept (no paper whitening), no automatic rotation (a vertical business card stays vertical; the 회전 button still works). No existing threshold changed.
USER_FILE_CHECK (numbers only, read in memory from the local file, nothing stored): before = manual / automatic-detection-uncertain / save off; after = automatic / full-frame-card / save on / result 847x468 (whole card) / rotation 0.

TESTS:
  - NEW validate_life_wallet_full_frame_card_01 (scanner UI, 390px mobile): business card PNG 1696x940, ID-like JPEG 1012x638 (photo block + hologram), vertical business card 940x1696, faint-print business card → automatic, full-frame-card, savable, rotation 0, whole card kept. Refused / not savable: blank card-shaped image, wide screen capture with 2 short lines, portrait phone capture 1080x2340 with 8 lines, wide (16:9) crops of scenery, a face and 4 pets. Wide 16:9 camera photos of a pale card on a white desk (3) are never taken whole.
  - Life Wallet validators on CODE_SHA: see TEST_STATUS.
  - Unchanged expectations elsewhere (synthetic_02 149 scenes: camera 29/36, faint 15/18, NOT_A_DOCUMENT 13/13 manual, NEGATIVE 8/8 manual, pages 7/7 full-page).
FALSE_AUTO_ACCEPT=0 in the tests above (pets, faces, scenery, desk, captures, blank).
TEST_STATUS=PASS on CODE_SHA 3814012f — all 12 Life Wallet validators (scan_01, scan_ui_01, scan_ui_02, document_save_01, photo_picker_01, card_carousel_01, entry_lock_01, synthetic_02, pdf_01, mobile_p0_01, camera_parity_01, full_frame_card_01), validate_site.py, validate_hardening.py, validate_accessibility.py, asset check, node --check (scan, scan-ui, wallet). Run while the PC was at 97% CPU from other sessions: mobile_p0_01 first hit the 600 s fixture timeout, then PASS alone (102 s). Full scripts/validate_* on the pre-merge tree 9ee78b51 ran 198/213 before a reboot; its 2 failures (validate_auth_unknown_recovery_browser_01, validate_calendar_day_panel_two_buttons_01) PASS on CODE_SHA, and auth_unknown_recovery_browser_01 failed on main 82a8874e in the same load — load-sensitive, not Life Wallet.
NEW_FAILURES=NONE

POST_DEPLOY_USER_TEST: Life Wallet → 자료 추가 → the same business card image file → 저장 button on, whole card shown; a photographed card still cropped as before; a pet/scenery photo still refused.
PRIVACY=the user's business card file was only read into memory for scanner numbers; no copy, crop, OCR, text or image data stored, logged or committed. All test images are synthetic.
FORBIDDEN_HERE=main merge, merge gate, Production deploy, force push/rebase/reset — owned by the Release & Deploy room.
