READY_FOR_DEPLOY=YES

STATUS=IMPLEMENTED; Life Wallet validators + site checks PASS; real phone test after deploy = user (POST_DEPLOY_USER_TEST).

# life-wallet-card-deck-01-site — release handoff (Samsung Pay-like card deck, 카드/문서 by shape)

REPO=lotbi-site
FEATURE_BRANCH=feature/life-wallet-card-deck-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ... refs/heads/feature/life-wallet-card-deck-01-site`)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=c311be85f2bc (Merge release/20261008-site-t30-work via LOTBI Ncloud merge gate); re-checked unchanged right before this commit
CODE_SHA=d9937c69 (validator wait fix on top of 75ec379b, the merge of main c311be85)
CONTAINS=feature/life-wallet-glare-block-01-site a90a246f (READY, not in main yet; full-frame-card 4328a071 is already in main via t30). This branch can replace a90a246f in the queue (deploying it ships both); if a90a246f is deployed first, this branch still merges (asset tokens only).
CODE_COMMITS (none in main yet): 13c553ef reflection blocks saving, 46773651 card deck, d9937c69 validator image wait, plus merges of Ncloud main (asset tokens only).
NON_TOKEN_DIFF_VS_MAIN=site-life-wallet.js, site-life-wallet.css, site-life-wallet-scan.js, site-life-wallet-scan-ui.js, scripts/fixtures/life-wallet-scan-scenes.mjs, scripts/validate_life_wallet_card_deck_01.mjs (renamed from validate_life_wallet_card_carousel_01.mjs), scripts/validate_life_wallet_mobile_p0_01.mjs, scripts/validate_life_wallet_glare_block_01.mjs (new), docs/release-handoff/life-wallet-glare-block-01-site.md, this document — every other file differs from main only by the asset token. CI workflow untouched (it runs only entry_lock_01 among the wallet validators).
ASSET_VERSION=aset-8b818f230a85
SUPERSEDES=NONE (a90a246f stays valid; see CONTAINS)
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
USER_DECISION_NEEDED=NONE (the user chose the deck design "1번" and "모양으로 자동 구분")

SCOPE=lotbi-site only (Life Wallet list and item detail). No Core/Web/App change. Saved items are not changed or migrated: an item gains the optional encrypted field `shape` only when its owner changes 분류.

USER_REQUEST (2026-10-08): "라이프 월렛좀 진짜 삼성페이처럼 만들어봐 … 갤러리 느낌이 너무 나잖아"; "신분증인데 혹시라도 문서나 자격증으로 들어가면 어떻게 수정해?"
CHANGE:
  - The list (one item per horizontal slide, read like a gallery) is now a card deck: every item is a card of one size (ID-1, 85.6 x 54 mm), the front card whole and up to three next cards peeking out above it (each higher and smaller). Swipe/drag sideways (touch-action pan-y, no pointer capture, a drag never opens), the arrow keys, the dots or a tap on a peeking card bring another card forward; a tap on the front card or 보기 opens it. Pictures fit inside the card face (object-fit contain), never cut. Title and "YYYY.MM.DD 등록" under the deck.
  - 카드 / 문서 by the picture's shape alone (landscape 1.25-2.1 : 1 = 카드, otherwise 문서); nothing is read from the image. A 문서 shows as a document card (문서 label, title, date, first page small and uncut). A wallet with both shows 전체 n · 카드 n · 문서 n filters.
  - Item detail: save date, 크게 보기 (the photo at its own size, scrolled), 분류: 카드 | 문서. The owner's choice is saved encrypted with the item (validated: card|document only), keeps the save time (deck place) and wins over the measured shape — the fix when an uncut ID photo lands in 문서.
TEST_EXPECTATION_CHANGE (recorded on purpose): validate_life_wallet_card_carousel_01 checked the removed one-item strip; it becomes validate_life_wallet_card_deck_01. Rules that still apply carry over unchanged in meaning: every item available, nothing cut (contain, no transform, picture inside its card), no arrow buttons, drag moves and never opens, dots and arrow keys move, one item = no controls, no overflow at phone width. mobile_p0_01's strip section ("exactly one slide on screen") now checks the deck (front item whole and on top, peeking cards inside the deck, contain, no sideways scroll) at 360/390/412 px.

TESTS:
  - NEW validate_life_wallet_card_deck_01 at 1200/412/390/360 px: stack (3 peeking, higher, smaller, behind, inside the deck), ID-1 card size, contain, title/date, dots, pan-y, shapes (incl. owner override), document face, filters (전체 keeps the front card, 카드 keeps order, 문서 alone), mouse drag → next card and nothing opened, short drag settles back, arrow keys, peek tap → forward, front tap / 보기 → open, single item and cards-only → no controls/filters; real wallet at 390 px (PIN setup, IndexedDB vault): an uncut portrait photo counts as 문서, detail shows 분류=문서, 크게 보기 toggles, 카드 saves (status "카드로 옮겼습니다."), the stored item has shape=card with its save time unchanged, the deck follows, a junk shape value is refused.
  - TEST_STATUS=PASS on 46773651: all 13 Life Wallet validators (document_scan_01, document_scan_ui_01, document_save_01, photo_picker_01, card_deck_01, entry_lock_01, document_scan_synthetic_02, document_scan_ui_02, pdf_01, mobile_p0_01, camera_parity_01, full_frame_card_01, glare_block_01), validate_site.py, validate_hardening.py, validate_accessibility.py, asset check, node --check.
  - After main ee8c1b6f (ebe8bfad): card_deck_01, mobile_p0_01, entry_lock_01, document_save_01, glare_block_01, full_frame_card_01, validate_site.py, validate_hardening.py, validate_accessibility.py, asset check, node --check PASS (document_save_01 first hit the known headless Chrome spawn ETIMEDOUT under 100% CPU, passed on the immediate solo re-run).
  - After main c311be85: glare_block_01, full_frame_card_01, entry_lock_01, validate_site.py, asset check, node --check PASS; card_deck_01 PASS after d9937c69 (3 concurrent runs, ~105 s each), mobile_p0_01 PASS after d9937c69.
  - VALIDATOR_FIX d9937c69: card_deck_01 timed out twice (300 s, then 600 s) while the PC was at 100% CPU from other sessions; the page was idle, waiting on image.decode(), which depends on the compositor in headless Chrome. The deck fixtures (card_deck_01 and the deck section of mobile_p0_01) now wait until each image is complete with a size (up to 10 s). No assertion changed.
NEW_FAILURES=NONE
VISUAL=local preview with synthetic card art at 375 px, light and dark theme (site-theme-tokens): deck, drag, 문서 filter, document card, selected filter chip.
KNOWN_LIMIT=a picture that is landscape but not card-like (e.g. a wide landscape page photo 1.3:1) is counted as 카드 until its owner changes it; real phone gestures (fling speed, Samsung Internet, iPhone Safari) NOT VERIFIED here.

POST_DEPLOY_USER_TEST: open Life Wallet on the phone → the items show as a stacked deck; swipe sideways to change the front card; tap a card to open; on an item that is in the wrong group, 분류 → 카드 (or 문서) and back to the list.
PRIVACY=no real photo used; all test images are synthetic.
FORBIDDEN_HERE=main merge, merge gate, Production deploy, force push/rebase/reset — owned by the Release & Deploy room.
