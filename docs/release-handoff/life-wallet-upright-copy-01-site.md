READY_FOR_DEPLOY=YES

STATUS=IMPLEMENTED; Life Wallet validators + site checks PASS; real phone re-test after deploy = user (POST_DEPLOY_USER_TEST).

# life-wallet-upright-copy-01-site — release handoff (items stood upright by their print; one wording for every item)

REPO=lotbi-site
FEATURE_BRANCH=feature/life-wallet-upright-copy-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ... refs/heads/feature/life-wallet-upright-copy-01-site`)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=ddcc573dca61 (Merge release/20261009-site-t37-work via LOTBI Ncloud merge gate); re-checked unchanged right before this commit
CODE_SHA=65693e66 (merge of main ddcc573d into 491e207d)
CODE_COMMITS (none in main yet): 491e207d upright by print + wording, plus a merge of Ncloud main (asset tokens only).
NON_TOKEN_DIFF_VS_MAIN=site-life-wallet-scan.js, site-life-wallet-scan-ui.js, scripts/validate_life_wallet_upright_print_01.mjs (new), scripts/validate_life_wallet_document_scan_ui_02.mjs, scripts/validate_life_wallet_pdf_01.mjs, scripts/validate_life_wallet_document_scan_synthetic_02.mjs — every other file differs from main only by the asset token. CI workflow untouched.
ASSET_VERSION=aset-f87d3a0ad4b1
SUPERSEDES=NONE
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
USER_DECISION_NEEDED=NONE (wording and behaviour agreed with the user 2026-10-09)

SCOPE=lotbi-site only (Life Wallet scanner). No Core/Web/App change, no change to saved items.

USER_REQUEST (2026-10-09): a bankbook photo was refused (correctly) with "신분증이나 문서를 찾지 못했습니다. 신분증·자격증이 잘 보이게 다시 선택해 주세요. 신분증이 맞다면 …" — "신분증이라고 하면 안 되니 특정하지 말고 문구를 통일"; and "항상 사용자가 회전하지 않도록 자동으로 보정되서 등록되어야 해".
CHANGE:
  - Upright by print (site-life-wallet-scan.js): on the squared-up crop, printBands counts empty bands between lines across and down (pages/bankbook spreads ~20-30 one way, 0-2 the other); only a clear answer counts (>= 6 and >= 3x+1). lineAlignment counts how many lines share a start (works for two-page spreads); down → 270 (starts aligned at the top) or 90; across → 0, or 180 when line ends are clearly more aligned (+0.15). Applied to square-cornered items (full pages, cornerRadius < .04: pages, bankbooks, contracts, business cards). Rounded ID-1 cards keep the existing shape rule (cropped taller than wide = on its side, verified on real photos); an upside-down rounded card stays for 회전 (a line-end rule would flip right-aligned business cards; dense small print on cards lines up both ways). Full-frame card pictures keep their orientation. Diagnostics gain print = "across/down" band counts. Before: pages were never turned.
  - Wording (site-life-wallet-scan-ui.js): never asks for an ID in particular. not found (heading 자료를 찾지 못했습니다): "자료의 네 모서리가 모두 화면 안에 들어오게 다시 찍거나 다른 사진을 선택해 주세요. 직접 조정으로 모서리를 맞출 수도 있습니다." / not a document: "등록할 수 있는 자료로 보이지 않습니다. 다른 사진을 선택해 주세요." / receipt: "영수증은 등록하지 않습니다. 다른 사진을 선택해 주세요." / hand crop without print: "모서리 안에 자료가 보이지 않습니다. 자료에 맞춰 모서리를 조정해 주세요." Glare copy unchanged.
  - Not added: a separate "자료 일부가 사진 밖으로 나갔습니다" message — the scanner's data cannot tell it reliably (the bankbook photo was refused because no outline separated from the background, not by a measured cut edge); the general line now asks for all four corners in the frame.
MEASURED:
  - Synthetic, through the real scanner UI: pages turned 0/90/180/270 → 24/24 upright (main: 6/24 — every turned page stayed sideways/upside down); two-page bankbook spreads → 8/8; rounded camera cards → identical to main (0/90/270 by shape; 180 not handled, as before); dense-print rounded cards stay 0.
  - Real photos on this PC (numbers only, read in memory, nothing stored): two document photos → 0 (bands 22/1, 25/1), business-card image file → 0 (full-frame), certificate card on its side → 270 (same as main), the bankbook photo → still not found (manual, Save off) — all identical to Production.
TEST_EXPECTATION_CHANGES (recorded on purpose): ui_02 expects the new not-found and blank-crop wording plus "no 신분증" in the guidance; pdf_01 expects "등록할 수 있는 자료로 보이지 않습니다"; synthetic_02 allows the new diagnostics key print (band counts, non-identifying).
TESTS:
  - NEW validate_life_wallet_upright_print_01: 38 synthetic cases (pages and bankbook spreads 0/90/180/270, dense rounded cards 0, camera cards 0/90/270) come out upright with portrait pages / landscape cards and spreads. Fails on main (pages are not turned).
  - TEST_STATUS=PASS on 491e207d: all 16 Life Wallet validators on this branch (document_scan_01, document_scan_ui_01, document_save_01, photo_picker_01, card_deck_01, entry_lock_01, document_scan_synthetic_02, document_scan_ui_02, pdf_01, mobile_p0_01, camera_parity_01, full_frame_card_01, glare_block_01, storage_persist_01, upright_print_01), validate_site.py, validate_hardening.py, validate_accessibility.py, asset check, node --check. mobile_p0_01 once hit a Windows EBUSY reading Chrome's DevToolsActivePort and passed on the immediate re-run.
  - POST_MERGE (65693e66): upright_print_01, document_scan_ui_02, pdf_01, document_scan_synthetic_02, entry_lock_01, validate_site.py, validate_hardening.py, validate_accessibility.py, asset check, node --check PASS.
NEW_FAILURES=NONE
KNOWN_LIMIT=an upside-down rounded card (ID, certificate card) is not turned 180 automatically (회전 button); a square-cornered item with few lines (a sparse business card) keeps the shape rule; two synthetic card quarter turns that main gets wrong are still wrong (same as main).

POST_DEPLOY_USER_TEST: photograph a page or a whole open bankbook on its side and upside down → saved upright without 회전; a refused photo shows the new 자료 wording (no 신분증).
PRIVACY=real photos only read into memory for scanner numbers; no copy, crop, OCR, text or image data stored, logged or committed. All test images are synthetic.
FORBIDDEN_HERE=main merge, merge gate, Production deploy, force push/rebase/reset — owned by the Release & Deploy room.
