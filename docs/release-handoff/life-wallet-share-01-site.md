READY_FOR_DEPLOY=NO

STATUS=IMPLEMENTED (share request flow, no documents); DOCUMENT TRANSFER NOT IMPLEMENTED — owner approval required. Do not queue for deploy.

# life-wallet-share-01-site — Life Wallet sharing (QR · LOTBI ID · KakaoTalk) — NOT READY

REPO=lotbi-site
FEATURE_BRANCH=feature/life-wallet-share-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ... refs/heads/feature/life-wallet-share-01-site`)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=c311be85f2bc (Merge release/20261008-site-t30-work via LOTBI Ncloud merge gate)
CODE_SHA=9fefd562 (merge of feature/life-wallet-card-deck-01-site 768854e4, which contains main c311be85)
CONTAINS=feature/life-wallet-card-deck-01-site 768854e4 (READY=YES) and feature/life-wallet-glare-block-01-site a90a246f (READY=YES). Those ship on their own; this branch must not be deployed to ship them.
CODE_COMMITS (none in main yet): e349892e Life Wallet sharing, 5db76ab7 + 9fefd562 merges of the card deck branch (site-conversation.js taken from main with the four share hooks re-applied), plus the card deck / glare commits listed in their own handoffs.
NON_TOKEN_DIFF_VS_MAIN (this branch's own part): site-life-wallet-share.js (new), site-life-wallet.js, site-life-wallet.css, site-route.js, site-conversation.js (4 hooks), site-consumer-sections.js, scripts/validate_life_wallet_share_01.mjs (new), scripts/validate_life_wallet_entry_lock_01.mjs (mount call regex) — the rest is the card deck / glare branches.
ASSET_VERSION=aset-687d6fe79263
DEPENDENCY=Core feature/life-wallet-share-01-core (API /v2/life-wallet/share, migration p0_0106_life_wallet_share). DEPLOY_ORDER=CORE → SITE. This Site without that Core: 공유 opens to "공유 목록을 불러오지 못했습니다." (Core 404) and the pending count stays hidden; the wallet itself keeps working.
MIGRATION=NO (Site); Core has one.
ENV_CHANGE_REQUIRED=NO
USER_DECISION_NEEDED=YES — see DOCUMENT_TRANSFER below.

## Result (the command's report format)

QR_SCAN=IMPLEMENTED, automated (headless, fake camera + BarcodeDetector stand-in): 내 QR shown, scanner reads QR → recipient confirmed → items chosen → request sent; camera denied / no camera / no BarcodeDetector → LOTBI ID entry with an explanation.
LOTBI_ID_SHARE=IMPLEMENTED, automated: exact LOTBI ID → masked name confirm → items → send; wrong ID, own ID, blocked/unreachable → the same "찾을 수 없습니다" style answers from Core.
KAKAO_SHARE=IMPLEMENTED (share sheet / link copy), automated: one-time invite link → phone share sheet (KakaoTalk is one of its targets) or copy; Kakao SDK direct share is not used because Core does not expose Kakao share readiness to this screen. Opening the link (#wallet-share=invite.…) stores the token in this tab only (30 min), asks for login, then the recipient claims it; the link alone shows nothing.
SHARED_INBOX=IMPLEMENTED, automated: 받은 공유 (sharer masked name, item labels, date, 수락·거절·차단), 보낸 공유 (공유 취소), 만료됨 shown.
ACCEPT_REJECT=IMPLEMENTED, automated (Site against a Core stand-in; Core rules in Core tests).
REVOKE=IMPLEMENTED, automated: 공유 취소 → Core closes access at once (Core test_revoke_closes_access_at_once).
SECURITY_TEST=PASS (Core pytest 19 share tests: QR single use + expiry, invite single use + expiry + nothing before claim, wrong/self recipient, duplicates refused, accept/reject only by recipient, revoke, pending expiry, block without revealing, inactive/deleting accounts unreachable, account deletion closes all, rate limits, audit without titles/IDs/tokens, bearer + strict JSON, session allowlists, CORS; Site: no request body carries an image or wallet data — labels only).
REAL_DEVICE_TEST=NOT_VERIFIED (headless Chrome emulation only; no phone, no real KakaoTalk, no real camera).
DOCUMENT_TRANSFER_APPROVAL_REQUIRED=YES
READY_FOR_DEPLOY=NO
BLOCKERS=(1) the document itself is not transferred: Life Wallet items live only on the owner's device (IndexedDB, AES-256-GCM, PIN-wrapped key) and the screen promises "이 기기에만 저장 … LOTBI 관리자도 원본을 볼 수 없으며". Sending a document needs the end-to-end encrypted relay designed in Core docs/LIFE-WALLET-SHARE-01.md §3 plus owner approval of the privacy-policy and screen-copy changes in §4. Every share screen says: "문서 원본은 아직 전송되지 않습니다 …". (2) real phone / KakaoTalk / camera test not done. (3) Site↔real Core end-to-end with a logged-in account not run on this PC (local login limit); Site was tested against a stand-in of the Core API.

## Coverage

- Android Chrome / Samsung Internet (mobile web): requests, inbox, camera QR scan (BarcodeDetector), share sheet incl. KakaoTalk — automated emulation only.
- iPhone Safari (mobile web): no BarcodeDetector → LOTBI ID entry, or the iPhone camera app reads the QR and opens the link; share sheet — NOT VERIFIED on a device.
- PC browser: webcam + BarcodeDetector if present, else LOTBI ID; link copy.
- LOTBI Android / iOS app (WebView): the screens load if the app shows the site; WebView camera permission handling (App repo) not changed — NOT VERIFIED.

## Subscription policy (as instructed)

Free keeps at most 1 own item (adding is held back with a 구독 안내 link; existing items are never removed). Basic/Plus/Pro unchanged. Share requests do not touch AI usage. Copying a shared item into one's own wallet does not exist yet (no document transfer); when it is built it must check the same limit.

## Tests on 9fefd562

validate_life_wallet_share_01, validate_life_wallet_card_deck_01, validate_life_wallet_entry_lock_01, validate_life_wallet_mobile_p0_01, validate_life_wallet_document_save_01, validate_life_wallet_photo_picker_01, validate_site_refresh_route_restore_01, validate_site.py, validate_hardening.py, validate_accessibility.py, asset check, node --check (wallet, share, route, conversation, consumer sections) — PASS.
NEW_FAILURES=NONE

PRIVACY=no real photo used; share requests carry item labels only (owner-editable, ≤ 80 chars); tokens are never logged by Site.
FORBIDDEN_HERE=main merge, merge gate, Production deploy, force push/rebase/reset, enabling document upload.
