READY_FOR_DEPLOY=YES

STATUS=IMPLEMENTED, focused + mobile-viewport validators PASS on CODE_SHA (18/18); real phone NOT TESTED. Scope = user real-device feedback 2026-10-07 (camcorder in the picker, neighbour card cut into view, camera shot of an ID not recognised, PIN keyboard popping up) + the additional P0 "direct camera normalization / document correction" (camera shots must take the gallery path).
SUPERSEDES=8ed42bd3 (earlier READY of this branch) and the hold 1c622df4.

# life-wallet-mobile-p0-01-site — release handoff (Life Wallet mobile P0 + direct camera parity)

REPO=lotbi-site
FEATURE_BRANCH=feature/life-wallet-mobile-p0-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ... refs/heads/feature/life-wallet-mobile-p0-01-site`)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=89adbb37 (Merge release/20261007-site-t17c-work via LOTBI Ncloud merge gate); re-checked unchanged right before this commit
CODE_SHA=22285fbb (contains main 89adbb37)
CODE_COMMITS (none in main yet):
  22285fbb direct camera parity (bytes decide the type, EXIF upright, no window-grid documents, camera tests)
  66850b26 mobile P0 (picker, decode bound, small far card, one-slide carousel, PIN keyboard)
  2c39fb41 merge of the Life Wallet fixes made after the last deploy (main a87aafb9 / READY de89f284), not yet released:
    82b6a080 detail view shows the single photo full width
    81a0e210 last wallet card centred alone (its "section panels reopen after reload" part was dropped in the merge: main's SITE-REFRESH-ROUTE-RESTORE-01 already owns reload restore; main's site-conversation.js kept as is)
    e575d78d scanner copy only when the user has something to do
    0634e0f0 card photographed on its side turned upright, with a rotate button
ASSET_VERSION=aset-5f5fd5e8a5de (node scripts/asset_cache_version.mjs --write; all other files differ from main only by this token)

SCOPE=lotbi-site only: site-life-wallet.js, site-life-wallet.css, site-life-wallet-scan.js, site-life-wallet-scan-ui.js, tests (scripts/lib/headless-fixture-result.mjs gains optional userAgent/touch emulation, unused by other validators). No Core/Web/App change, no data migration.

DIRECT_CAMERA_ROOT_CAUSE (reproduced with synthetic camera files; real photos NOT available on this PC):
  1. Type decided by name/MIME: a camera shot handed over with an empty type and a temporary name without extension, or as image/jpg / application/octet-stream, was refused before scanning ("사진(JPG·PNG·WebP·HEIC)이나 PDF만 …"). Gallery/PC files always carry image/jpeg + .jpg, so only camera shots hit it. Fail-before reproduced on 66850b26 with validate_life_wallet_camera_parity_01.
  2. Decode bound given as width AND height of the rotated frame: an engine that sizes stored pixels before applying EXIF (or ignores EXIF) squashes a portrait camera shot (4000x3000 + EXIF 6) into 1920x2560 → card aspect distorted → refused as receipt-like (reproduced on 66850b26 with a decoder that ignores EXIF). Only camera originals take this path (EXIF-rotated, > 2560px); gallery/PC copies are usually upright and smaller. Current desktop Chrome applies EXIF correctly.
  3. (fixed in 66850b26, deployed main still has it) a card shot from arm's length (< 10% of the frame) was excluded by the area gate, and print was judged on the 720px whole-frame image: camera-shaped synthetic set 36 shots → deployed main 25/36 automatic, this branch 29/36.
  Not a cause: canvas re-encoding (none before detection; both paths identical), current-Chrome EXIF handling. Tried and dropped: high-quality multi-step reduction of the detection image (softens thin lettering: 2 of 6 cards lost) — detection keeps one plain resampling step.

CHANGE=
  1. CAMCORDER_REMOVED: photo picker `image/*` only, PDFs their own `application/pdf` picker; no `capture` attribute. Photos JPEG/PNG/WebP/HEIC/HEIF up to 30MB, PDF 20MB.
  2. One pipeline for camera and gallery (site-life-wallet-scan-ui.js decodeFile): bytes sniffed (JPEG FFD8FF, PNG, RIFF/WEBP, ftyp heic/heix/mif1/…, %PDF; ftyp video brands and GIF refused; reported type/name used only when the bytes are unknown) → header size + EXIF orientation → decode (createImageBitmap imageOrientation from-image, only resizeWidth given so the decoder keeps the aspect; Image fallback) → pixels made upright (if the decoded shape contradicts a quarter-turn tag, or a one-time 2x1 JPEG check shows the decoder ignores mirror/180 tags, the scanner turns it with a canvas transform) → bounded to 2560px (halving steps, high quality, when the header gave no size) → same detection (1200px plain resample), perspective warp, crop, save. Same bytes with gallery or camera metadata give an identical crop.
  3. Recognition: the found card is squared up before its printed rows are counted; a far card (4-10% of the frame) counts when card-shaped (1.45-1.8:1) and legible in the original (short side >= 300px of the decoded photo).
  4. False-accept guard: a row of identical, evenly spaced marks (width variation < .05 and gap variation < .08 — building windows, tiles, keys) is not counted as printed text. Measured: windows <= .02/.03; lettering (thin Hangul/digits, block glyphs, hand-held cards) >= .08. No threshold was relaxed.
  5. Wallet strip: one whole item per slide (flex 0 0 100%, never shrinks), 12px gutter, object-fit contain.
  6. Unlock PIN: inputmode=none, no auto-focus on touch screens; keypad entry; hardware keyboard/screen readers keep working. Setup/change/delete-confirm PIN fields keep the numeric keyboard (no keypad there).
  7. Unchanged contracts: encrypted local storage, lock, PDF page 1 only, PIN-confirmed delete, memo, existing saved items.

KNOWN_LIMIT=a pale card on a near-white desk (synthetic: card and desk within ~10 RGB levels) is not cropped automatically (6/6 such scenes stay with "직접 조정", never a wrong crop or a refusal). Not changed now: separating it would need an edge-stopped background fill that could create card candidates in pet/scenery photos, and real photos cannot be re-checked here.

CHANGED_TEST_EXPECTATIONS:
  - photo_picker_01: picker `image/*` + PDF picker `application/pdf`, no capture; unsupported-file message "사진(JPG·PNG·WebP·HEIC)이나 PDF만 등록할 수 있습니다." (GIF still refused).
  - card_carousel_01: strip height gap <= 12px → <= 20px (room for the card shadow); landscape card width >= min(400, frame - 4) → min(400, frame - 28) (12px gutter each side).
  - scan_ui_01 / scan_ui_02: decode options resizeHeight 1707/2560 → undefined (only the bounded width is given; the decoder keeps the aspect ratio). camera_parity_01 checks the real decoded size (1920x2560 from 4000x3000/8000x6000 + EXIF).
  - scan_01, scan_ui_02 (note), pdf_01: synthetic glyph boxes now differ in width with wider word gaps; identical evenly spaced boxes are exactly the made-pattern signature (windows). Assertions unchanged.
  - synthetic_02: + NOT_A_DOCUMENT face x3 / scenery with window rows x3 / empty light desk x3 (never cropped); + SYNTHETIC_CAMERA_SHOT 36 portrait camera shots (tilt up to 12°, keystone up to .12, card 42-90% of width, desk/white/grey/felt/navy, hand-held, thin lettering): never refused, every automatic crop within 2% of the card's short side, off-white-desk shots automatic >= n-2 (measured 29/30). Detection called with the scanner's sourceScale. Existing 86 expectations unchanged.
  - Added validate_life_wallet_mobile_p0_01 (66850b26) and validate_life_wallet_camera_parity_01 (this commit; Samsung Internet UA, 412x915, touch).
TEST_STATUS=PASS on CODE_SHA (18/18) — life wallet validators scan_01, scan_ui_01, scan_ui_02, document_save_01, photo_picker_01 (3 consecutive runs), card_carousel_01, entry_lock_01, synthetic_02 (131 scenes), pdf_01, mobile_p0_01, camera_parity_01; validate_site.py, validate_hardening.py, validate_accessibility.py, asset check, node --check (scan, scan-ui, wallet).
NEW_FAILURES=NONE

REPORT:
  DIRECT_CAMERA_ROOT_CAUSE=see above (type by name/MIME; width+height decode bound squashing EXIF-rotated originals; small far card gate — all camera-only paths)
  DIRECT_CAMERA_AND_FILE_PIPELINE_PARITY=PASS (same bytes as gallery image/jpeg .jpg / blank type no extension / image/jpg / octet-stream → identical mode, size 1920x2560, crop, save)
  EXIF_ORIENTATION_CAMERA_PASS=PASS (orientation 1/2/3/6/8 upright with the same crop; mirrored selfie; decoder that ignores EXIF → turned by the scanner)
  PERSPECTIVE_CORRECTION_CAMERA_PASS=PASS synthetic (4 tilted/keystoned camera files through the UI: corner error <= 0.1% of the diagonal; 36-shot set: 29 automatic, worst corner 1.3px)
  BLANK_MIME_CAMERA_PASS=PASS
  HIGH_RES_CAMERA_JPEG_PASS=PASS (48 MP 8000x6000 + EXIF 6 → 1920x2560, automatic)
  HEIC_HEIF_CAMERA_RESULT=recognised by bytes even without type/name; decoded where the browser can (iPhone Safari); Chrome/Samsung Internet → HEIC message (message path tested; a real HEIC decode NOT TESTED)
  DOCUMENT_FALSE_ACCEPT_GUARD=PASS (camera path: face, window-row scenery, empty desk, pet → not cropped, not savable; 13 not-a-document scenes 0 automatic; deployed main auto-saved the window-row scenery)
  SAMSUNG_INTERNET_SIMULATION=PASS (UA SamsungBrowser/26.0 Chrome/122, 412x915 mobile metrics, touch emulation — emulation, not a device)
  REAL_PHOTO_VALIDATION=POST_DEPLOY_USER_TEST
  CAMCORDER_REMOVED=YES (Android chooser itself NOT TESTED on a device)
  CAROUSEL_ONE_FULL_SLIDE_PASS=YES (360/390/412/1200px) / NEIGHBOR_PEEK_ZERO=YES / OBJECT_FIT_CONTAIN_PASS=YES
  PIN_SOFT_KEYBOARD_DISABLED=YES (coarse-pointer stub; real keyboard NOT TESTED) / PIN_TOUCH_KEYPAD_PASS=YES

NOT_TESTED=real Android Chrome / Samsung Internet / iPhone Safari; real camera photos; viewport/UA emulation is not a real-device pass.
PRIVACY=no real photo, ID image, screenshot, OCR or text extraction used, stored, logged or committed; all test images are generated in the tests (random syllables/digits, no real data).
USER_DECISION_NEEDED=NONE
POST_DEPLOY_USER_TEST (real phone, Samsung Internet and Chrome): 사진 선택 → 카메라/갤러리만 보이는지; Life Wallet에서 카메라로 신분증·자격증을 바로 찍어 자동 인식되는지(책상 위·손에 든 채·약간 기울여서); 갤러리에서 고른 같은 사진과 결과가 같은지; 저장 자료 한 장씩만 보이는지; 잠금 해제 때 키보드가 안 올라오는지.
FORBIDDEN_HERE=main merge, merge gate, Production deploy, force push/rebase/reset — owned by the Release & Deploy room.
