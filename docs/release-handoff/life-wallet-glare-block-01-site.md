READY_FOR_DEPLOY=YES

STATUS=IMPLEMENTED; Life Wallet validators + site checks PASS; real phone re-test after deploy = user (POST_DEPLOY_USER_TEST).

# life-wallet-glare-block-01-site — release handoff (reflection over the print blocks saving)

REPO=lotbi-site
FEATURE_BRANCH=feature/life-wallet-glare-block-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ... refs/heads/feature/life-wallet-glare-block-01-site`)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=3d6a5eec14f3 (Merge release/20261008-site-t28-work via LOTBI Ncloud merge gate); re-checked unchanged right before this commit
CODE_SHA=53758882 (merge of main 3d6a5eec into 13c553ef)
CONTAINS=feature/life-wallet-full-frame-card-01-site 4328a071 (not in main yet). This branch can replace it in the queue (deploying this one ships both); if 4328a071 is deployed first, this branch still merges cleanly.
CODE_COMMITS (none in main yet): 73bf1165 full-frame card (business card / ID saved as a picture), 13c553ef reflection over the print blocks saving, plus merges of Ncloud main (asset tokens only).
NON_TOKEN_DIFF_VS_MAIN=site-life-wallet-scan.js, site-life-wallet-scan-ui.js, scripts/fixtures/life-wallet-scan-scenes.mjs, scripts/validate_life_wallet_full_frame_card_01.mjs (new), scripts/validate_life_wallet_glare_block_01.mjs (new), docs/release-handoff/life-wallet-full-frame-card-01-site.md — every other file differs from main only by the asset token.
ASSET_VERSION=aset-80e4575c4a43
SUPERSEDES=NONE (4328a071 stays valid; see CONTAINS)
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
USER_DECISION_NEEDED=NONE

SCOPE=lotbi-site only (Life Wallet scanner). No Core/Web/App change, no change to saved items.

USER_REPORT (2026-10-08, Production): a certificate photographed on a desk under a lamp had a reflection over its number, and the scanner still offered Save ("저장이 안 되어야 하는 곳 아니야? 번호가 반사돼서 안 보이잖아").
ROOT_CAUSE=The only glare check counted near-white pixels over the whole photo (> 16% → advice "다시 촬영 권장") and never blocked Save; a small reflection right over the print (0.5% of the certificate) passed unnoticed.
FIX=coveringGlare(corrected) on the squared-up photo before enhancement, inside a 6% border, at most 600 px: compact (fill >= 0.4) colourless patches >= 248 of at least 0.1% of the item, empty of print inside (<= 30% of the item's print density), the card beyond their halo darker (<= 210) and the printed rows they lie on continuing beside them (>= 5% marks on the left or right). Not checked when the card is bright all over (median > 215), for pages, PDF pages and full-frame pictures. Covered share >= 0.3% → warning glare-covers-print → Save off, heading "다시 촬영해 주세요", status "빛 반사 때문에 자료의 일부가 보이지 않습니다. 빛이 비치지 않게 각도를 바꿔 다시 찍어 주세요." (the generic "다시 촬영 권장" list stays for the other warnings).
MEASURED (numbers only; real files read in memory, nothing stored): the user's certificate photo → glare-covers-print, Save off (patch 0.56% of the item, card median 173, ring 193, print beside it 0.85 of the average); two earlier real ID photos on this PC → savable; the business card image file → not checked, savable; 36 synthetic camera shots → 29 automatic, all savable (0 false blocks; bright cards with blown-out blank areas excluded by the median rule).

TESTS:
  - NEW validate_life_wallet_glare_block_01 (scanner UI, 390px): reflection drawn over the print of two camera shots (desk, felt; card tint 176/198/214) → blocked with the copy above; the same cards without it and a bright card with blown-out blank areas → savable.
  - TEST_STATUS=PASS on 13c553ef: all 13 Life Wallet validators (scan_01, scan_ui_01, scan_ui_02, document_save_01, photo_picker_01, card_carousel_01, entry_lock_01, synthetic_02, pdf_01, mobile_p0_01, camera_parity_01, full_frame_card_01, glare_block_01), validate_site.py, validate_hardening.py, validate_accessibility.py, asset check, node --check. After the main merge (53758882): asset check, node --check, glare_block_01, full_frame_card_01, camera_parity_01, validate_site.py PASS.
NEW_FAILURES=NONE
KNOWN_LIMIT=one real reflection sample was available; a reflection on a card that is bright all over (median > 215) is not detected, and a blown-out blank area beside print on a darker card could be refused (retake). Thresholds are in site-life-wallet-scan.js coveringGlare.

POST_DEPLOY_USER_TEST: the same certificate photo with the reflection → Save off with the retake message; the same certificate photographed without the reflection → saved; other cards unchanged.
PRIVACY=real photos were only read into memory for scanner numbers; no copy, crop, OCR, text or image data stored, logged or committed. All test images are synthetic.
FORBIDDEN_HERE=main merge, merge gate, Production deploy, force push/rebase/reset — owned by the Release & Deploy room.
