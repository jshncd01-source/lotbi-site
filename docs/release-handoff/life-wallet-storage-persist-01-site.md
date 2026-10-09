READY_FOR_DEPLOY=YES

STATUS=IMPLEMENTED; Life Wallet validators + site checks PASS; phone/browser re-check after deploy = user (POST_DEPLOY_USER_TEST).

# life-wallet-storage-persist-01-site — release handoff (keep the wallet's browser storage, explain a new PIN)

REPO=lotbi-site
FEATURE_BRANCH=feature/life-wallet-storage-persist-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ... refs/heads/feature/life-wallet-storage-persist-01-site`)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=e13c0dfdf2aa (Merge release/20261008-site-t31-work via LOTBI Ncloud merge gate); re-checked unchanged right before this commit
CODE_SHA=4b6dbd24 (merge of main e13c0dfd into 651d0b8e)
CONTAINS=feature/life-wallet-card-deck-01-site 768854e4 (READY=YES) and through it feature/life-wallet-glare-block-01-site a90a246f (READY=YES); neither is in main yet. Deploying this branch ships all three; if they are deployed first, this branch still merges (asset tokens only).
CODE_COMMITS (none in main yet): 651d0b8e storage persist + setup explanation, on top of the card deck / glare commits listed in their own handoffs, plus merges of Ncloud main (asset tokens only).
NON_TOKEN_DIFF_VS_MAIN (this branch's own part): site-life-wallet.js (requestPersistentWalletStorage, keepWalletStorage, setup paragraph), site-life-wallet.css (.wallet-setup-why), scripts/validate_life_wallet_storage_persist_01.mjs (new) — the rest is the card deck / glare branches.
ASSET_VERSION=aset-5900347353e9
SUPERSEDES=NONE (768854e4 and a90a246f stay valid; see CONTAINS)
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
USER_DECISION_NEEDED=NONE

SCOPE=lotbi-site only (Life Wallet PIN setup / unlock). No Core/Web/App change. Saved wallets untouched.

USER_REPORT (2026-10-08/09): "똑같은 아이디인데 왜 자꾸 비밀번호를 새로 만들라고 하는거야?" — where: "브라우저".
ROOT_CAUSE (measured on this PC, read-only): the browser used for testing was the Claude desktop app's built-in browser. It keeps site data in memory only — no lotbiai.com storage directory on disk (only claude.ai's), storage quota 5.4 GB on a 931 GB disk, navigator.storage.persisted()=false — so every app restart or PC reboot (several on 10-08) dropped the wallet and the same account was asked for a new PIN. The wallet code itself finds the vault by the account id from /v2/me and never deletes it. For ordinary browsers the site also never asked to keep its storage, so Chrome may clear it under disk pressure (this PC's C: was full on 10-07).
FIX:
  - requestPersistentWalletStorage(): after a PIN is made or entered (a user action), ask once per visit for persistent storage (navigator.storage.persist; skipped when already persisted). Browsers decide (Chrome by engagement/installed/bookmark, Firefox may ask, Safari by its rules); a refusal, an error or a missing API changes nothing and nothing waits on it. Result on root[data-wallet-storage] = persisted | best-effort | unsupported.
  - PIN setup screen: "이 브라우저에는 아직 이 계정의 월렛이 없습니다. 월렛은 기기·브라우저마다 따로 저장되어, 다른 기기나 브라우저, 저장 데이터가 지워진 브라우저(시크릿 창 포함)에서는 PIN을 새로 만들어야 합니다. 다른 곳에 저장한 자료는 그곳의 ⚙ 설정 → 암호화 백업 파일로 옮겨 올 수 있습니다."
NOT_FIXABLE_HERE: a browser that keeps data in memory (private windows, the desktop app's built-in browser) loses the wallet when it closes — by the wallet's design (device-only, no server copy). Use a normal browser profile or the LOTBI app for real use and for wallet tests.

TESTS:
  - NEW validate_life_wallet_storage_persist_01: the request against stand-ins (no API, no persist, already persisted → not asked, granted, refused, error); the real wallet at 390 px with a refusing stand-in: setup shows the explanation, nothing asked before the PIN, making the PIN asks once (best-effort, wallet works), lock/unlock in the same visit does not ask again, unlock screen has no setup text, a new visit finds the same wallet (PIN entry, not setup) and asks once after the PIN.
  - TEST_STATUS=PASS on 651d0b8e: all 14 Life Wallet validators on this branch (document_scan_01, document_scan_ui_01, document_save_01, photo_picker_01, card_deck_01, entry_lock_01, document_scan_synthetic_02, document_scan_ui_02, pdf_01, mobile_p0_01, camera_parity_01, full_frame_card_01, glare_block_01, storage_persist_01), validate_site.py, validate_hardening.py, validate_accessibility.py, asset check, node --check.
  - POST_MERGE (4b6dbd24): storage_persist_01, card_deck_01, entry_lock_01, mobile_p0_01, glare_block_01, document_save_01, validate_site.py, validate_hardening.py, validate_accessibility.py, asset check, node --check PASS.
NEW_FAILURES=NONE

POST_DEPLOY_USER_TEST: in a normal Chrome (not the desktop app's built-in browser) open Life Wallet, make or enter the PIN, close Chrome, reopen → the PIN entry screen (not "PIN 만들기") and the saved items are there. Optional: DevTools console `await navigator.storage.persisted()`.
PRIVACY=no real photo or wallet content read; the PC check only read storage numbers and directory names.
FORBIDDEN_HERE=main merge, merge gate, Production deploy, force push/rebase/reset — owned by the Release & Deploy room.
