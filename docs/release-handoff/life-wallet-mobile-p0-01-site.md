READY_FOR_DEPLOY=YES

STATUS=IMPLEMENTED, focused + mobile-viewport validators PASS on CODE_SHA; real phone NOT TESTED (user real-device feedback 2026-10-07: camcorder in the picker, neighbour card cut into view, camera shot of an ID not recognised, PIN keyboard popping up).

# life-wallet-mobile-p0-01-site — release handoff (Life Wallet mobile P0)

REPO=lotbi-site
FEATURE_BRANCH=feature/life-wallet-mobile-p0-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ... refs/heads/feature/life-wallet-mobile-p0-01-site`)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=89adbb37 (Merge release/20261007-site-t17c-work via LOTBI Ncloud merge gate); re-checked unchanged right before this commit
CODE_SHA=66850b26 (contains main 89adbb37)
CODE_COMMITS (none in main yet):
  66850b26 mobile P0 (this request)
  2c39fb41 merge of the Life Wallet fixes made after the last deploy (main a87aafb9 / READY de89f284), not yet released:
    82b6a080 detail view shows the single photo full width
    81a0e210 last wallet card centred alone (its "section panels reopen after reload" part was dropped in the merge: main's SITE-REFRESH-ROUTE-RESTORE-01 already owns reload restore; main's site-conversation.js kept as is)
    e575d78d scanner copy only when the user has something to do
    0634e0f0 card photographed on its side turned upright, with a rotate button
ASSET_VERSION=aset-7baf9459279f (node scripts/asset_cache_version.mjs --write; all other files differ from main only by this token)

SCOPE=lotbi-site only: site-life-wallet.js, site-life-wallet.css, site-life-wallet-scan.js, site-life-wallet-scan-ui.js, tests. No Core/Web/App change, no data migration.
CHANGE=
  1. CAMCORDER_REMOVED: the photo picker accepts `image/*` only and PDFs have their own `application/pdf` picker ("사진 선택" / "PDF" buttons). With one image type Android offers camera + gallery only; several types made it add camcorder and voice recorder. No `capture` attribute (gallery stays available). Accepted photos: JPEG, PNG, WebP, HEIC/HEIF, up to 30MB (was JPEG/PNG 12MB); videos and GIF refused.
  2. Same pipeline for camera and gallery: decode with EXIF orientation (createImageBitmap imageOrientation from-image), then bounded to 2560px on the long side even when the header gives no size (Samsung maker blocks, WebP, HEIC); then the same detection, rectify and save path. HEIC the browser cannot open → "이 브라우저에서는 HEIC 사진을 열 수 없습니다. 카메라 설정에서 JPG(호환성 우선)로 저장하거나 다른 사진을 선택해 주세요."
  3. Recognition of real shots: the found card is squared up (perspective warp from the 1200px detection image) before its printed rows are counted, so tilt, margins and shadow no longer starve the text check. A card shot from arm's length (4-10% of the photo) is accepted only when card-shaped (1.45-1.8:1) and legible in the original (short side >= 300px of the decoded photo); otherwise the 10% minimum stays. Pages, pets, scenery, receipts and blank shapes keep the existing refusals.
  4. Wallet strip: each slide is exactly the visible strip width (flex 0 0 100%, never shrinks), the card sits inside with a 12px gutter and room for its shadow; images object-fit: contain (no document crop). Exactly one item visible, no neighbour edge.
  5. Unlock PIN: the field has inputmode=none and is not auto-focused on touch screens (pointer: coarse), so the phone keyboard stays down; the on-screen keypad enters the PIN. No hidden-input focus trick; the field stays a real labelled input, so hardware keyboards and screen readers still work. PIN setup/change/delete-confirm screens have no keypad and keep the numeric keyboard.
  6. Unchanged contracts: encrypted local storage, lock, PDF page 1 only, PIN-confirmed delete, memo, existing saved items (no format change).

CHANGED_TEST_EXPECTATIONS:
  - photo_picker_01: accept `image/jpeg,image/png,application/pdf,.pdf` → photo picker `image/*` + PDF picker `application/pdf`, no capture attribute; unsupported-file message → "사진(JPG·PNG·WebP·HEIC)이나 PDF만 등록할 수 있습니다." (GIF still refused).
  - card_carousel_01: strip height gap <= 12px → <= 20px (16px room below the card so its shadow and rounded edge are not cut); landscape card width >= min(400, frame - 4) → min(400, frame - 28) (12px gutter each side so no neighbour edge shows).
  - synthetic_02: detection called with the same sourceScale the scanner UI passes (1200px detection image of the original); all 86 expectations unchanged, NEGATIVE small-rectangle (240x150px card in a 1266x680 photo) still manual.
  - Added validate_life_wallet_mobile_p0_01: picker types; synthetic Samsung-like camera JPEG (4000x3000 stored, EXIF orientation 6, ~260KB extra header) near (card 62% of width) and far (34%) → decoded 1920x2560 upright, automatic crop, landscape result; WebP automatic; HEIC message; PDF through its own picker; carousel at 360/390/412px (one visible slide, slide width = strip, flex-shrink 0, object-fit contain, aspect kept); unlock PIN inputmode=none, not focused on touch, keypad unlock.
TEST_STATUS=PASS on CODE_SHA (17/17) — life wallet validators scan_01, scan_ui_01, scan_ui_02, document_save_01, photo_picker_01, card_carousel_01 (1200px and 390px), entry_lock_01, synthetic_02 (86 scenes: NEGATIVE 8/8 and NOT_A_DOCUMENT pets 4/4 stay manual), pdf_01, mobile_p0_01; validate_site.py, validate_hardening.py, validate_accessibility.py, asset check, node --check (scan, scan-ui, wallet).
NEW_FAILURES=NONE

REPORT:
  CAMCORDER_REMOVED=YES (accept image/* + separate PDF picker; Android chooser behaviour itself NOT TESTED on a device)
  DIRECT_CAMERA_CAPTURE_PASS=SYNTHETIC PASS (headless Chrome, synthetic camera JPEG); real phone camera NOT TESTED
  CAMERA_AND_FILE_SAME_PIPELINE=YES (one input, one decodeFile → detect → rectify path)
  SAMSUNG_CAMERA_PHOTO_PASS=SYNTHETIC PASS (EXIF 6 + large maker-block header); real Samsung photo NOT TESTED
  EXIF_ORIENTATION_PASS=YES (decoded 1920x2560 upright from 4000x3000 stored)
  HEIC_HEIF_RESULT=accepted by the picker; decoded where the browser can (iPhone Safari), otherwise the HEIC message above (only the message path tested in headless Chrome)
  WEBP_PASS=YES
  CAROUSEL_ONE_FULL_SLIDE_PASS=YES (360/390/412/1200px emulation)
  NEIGHBOR_PEEK_ZERO=YES
  OBJECT_FIT_CONTAIN_PASS=YES
  PIN_SOFT_KEYBOARD_DISABLED=YES (inputmode=none, no auto-focus on touch; verified with a coarse-pointer stub, real keyboard behaviour NOT TESTED on a device)
  PIN_TOUCH_KEYPAD_PASS=YES

NOT_TESTED=real Android Chrome / Samsung Internet / iPhone Safari; viewport emulation is not a real-device pass.
PRIVACY=no real photo, ID image, screenshot, OCR or text extraction used, stored, logged or committed; all test images are generated in the test.
USER_DECISION_NEEDED=NONE
POST_DEPLOY_USER_CHECK (real phone): 사진 선택 → 카메라/갤러리만 보이는지; 카메라로 신분증 직접 촬영 → 자동 인식; 저장 자료 한 장씩만 보이는지; 월렛 잠금 해제 때 키보드가 안 올라오는지.
FORBIDDEN_HERE=main merge, merge gate, Production deploy, force push/rebase/reset — owned by the Release & Deploy room.
