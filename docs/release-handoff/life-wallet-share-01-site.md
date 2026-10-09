READY_FOR_DEPLOY=NO
REASON=WAITS_FOR_CORE — Core feature/life-wallet-share-01-core is READY=NO only for MIGRATION_WAIT (p0_0112 must follow p0_0111 once p0_0109 → p0_0110 → p0_0111 are in main). This Site has nothing left but that dependency; it flips to YES together with Core (re-merge of the then-current main first).
SUPERSEDES=77ec0f0f (old READY=NO) — earlier pushes 93c49eea, dc7eb4fc were READY=NO too
MIGRATION=NO (Site); Core p0_0112_life_wallet_share
DEPLOY_ORDER=CORE → SITE (this Site without that Core: 공유 opens to "공유 목록을 불러오지 못했습니다" and the wallet itself keeps working)
ACTIVATION=LOTBI_LIFE_WALLET_SHARE_TRANSFER_ENABLED on Core (default false); the Site follows Core's inbox.document_transfer — nothing to switch on the Site
USER_DECISION_NEEDED=NONE for deploying with the switch off
LAUNCH_CHECK=개인정보 처리방침 문구(출시 전 점검)
SENSITIVE_DOCUMENT_ORIGINAL_SHARING=HOLD (see Core handoff SECURITY: 2026-10-05 audit findings not addressed)

# life-wallet-share-01-site — Life Wallet sharing (QR · LOTBI ID · KakaoTalk) + encrypted originals (off by default)

REPO=lotbi-site
FEATURE_BRANCH=feature/life-wallet-share-01-site
FEATURE_SHA=this document's commit (branch HEAD; `git ls-remote ssh://lotbi-ncloud-git/srv/git/repositories/lotbi-site.git refs/heads/feature/life-wallet-share-01-site`)
AUTHORITATIVE_MAIN=819ead3a (Merge release/20261009-site-t41-work)
CODE_SHA=c42febf5
ASSET_VERSION=aset-bfbcbc7508d2
CODE_COMMITS=e349892e share requests, 93c49eea encrypted originals, dc7eb4fc merge of main 819ead3a, 4af9ecdc default label never carries the memo, dd389fe9 relay note only while the switch is on, c42febf5 consumer_sections_02 expects the new wallet mount
NON_TOKEN_DIFF_VS_MAIN=site-life-wallet-share.js (new), site-life-wallet-share-crypto.js (new), site-life-wallet.js, site-life-wallet.css, site-route.js (share-link intent), site-conversation.js (intent capture + sessionToken/subscription to the wallet), site-consumer-sections.js (passes them), scripts/validate_life_wallet_share_01.mjs (new), scripts/validate_life_wallet_share_transfer_01.mjs (new), scripts/validate_life_wallet_entry_lock_01.mjs (mount call), scripts/validate_consumer_sections_02.mjs (mount call), docs/release-handoff/life-wallet-share-01-site.md

## Fixed in this room
1. Privacy: a share request's default label was the wallet memo's first line (walletCardTitle), which Core stores as plain text and the recipient sees before accepting. It now defaults to name · date (walletShareLabel); the label stays editable and a note says it is visible to the recipient and the LOTBI server (4af9ecdc).
2. The wallet's "공유를 수락한 상대에게 암호화해 전달할 때만 서버를 거칩니다" showed for every signed-in wallet even with the relay off. It now appears only when Core answers document_transfer.available (dd389fe9).

## Tests (this room, code c42febf5)
SHARE_VALIDATORS=PASS — validate_life_wallet_share_01 (now also: default label = '저장 자료 · 2026.10.08', no request body carries the memo), validate_life_wallet_share_transfer_01 (now also: relay note hidden with the switch off, shown with it on), validate_life_wallet_entry_lock_01
ENCRYPTED_ORIGINAL_TESTS=PASS (Site) — key registered on accept (public only, private sealed in the vault), re-confirm with the same 보안 확인 번호, ciphertext-only upload, a third key cannot open, recipient opens and keeps it (Free limit), saved drops ciphertext, other-device take-over, key missing, revoke drops ciphertext, switch off shows no transfer
CROSS_CLIENT_CRYPTO_TESTS=PASS — this Site module ↔ Python cryptography both ways; the safety code of one key is identical in both
SITE_CORE_RELAY_E2E=PASS 25/25 — real Core API (TestClient) + this Site crypto module in Node, requests shaped like site-life-wallet-share.js call(); every response carried the Site CORS header; see the Core handoff
FEATURE_FLAG_OFF_TESTS=PASS — off: no 원본 보내기/원본 열기, no key registration, no relay calls (only /inbox), the 'not sent yet' note, the wallet's relay note hidden
RECEIVED_ITEM_SAFETY=checked in code — a received item is shown with textContent and jpeg/png data-URL images only, and saved through the wallet's own validation
ASSET_CHECK=PASS (node scripts/asset_cache_version.mjs: aset-bfbcbc7508d2, 135 targets)
REGRESSION_SITE=NEW_FAILURES=0 — 252 validators in scripts/:
  - this room (code dd389fe9, validator fix c42febf5), one at a time: the 165 the previous room never reached → 162 PASS, 3 FAIL; the previous room's 9 FAILs + 28 earlier PASSes that touch the changed files (chat/conversation/consumer/route/wallet/auth/composer/attachment) → 34 PASS, 3 FAIL; the 3 share validators → PASS
  - FAIL that also fail on main 819ead3a (baseline worktree, same CRLF checkout): validate_image_attachment_thumbnail_01, validate_mobile_footer_legal_sheet_01, validate_site_avatar_fallback_runtime (known Windows-local RED)
  - load-only, PASS alone: validate_chat_answer_quality_p0_01 (EBUSY on Chrome's DevToolsActivePort), validate_calendar_day_panel_two_buttons_01 (python http.server module fetch under load; PASS on branch and main alone)
  - caused by this branch and fixed: validate_consumer_sections_02 pinned the old mountLifeWallet call → now pins the call with sessionToken and subscription (c42febf5)
  - reused, not re-run: 47 validators the previous room passed on 93c49eea that touch none of the changed files (calendar/brand/avatar/bottom-sheet …)
TRUSTED_LINUX_GATE=not run here (배포총괄방)

## Coverage
Android Chrome / Samsung Internet, iPhone Safari, PC: headless Chrome emulation + WebCrypto only. LOTBI Android/iOS app WebView: NOT VERIFIED. Real phone / real KakaoTalk / real camera: NOT VERIFIED.

PRIVACY=synthetic data only; no real ID, receipt or family photo used. Requests carry an owner-editable label (≤ 80 chars) and kind; originals leave the device only sealed for the accepted recipient's key and only when Core has the switch on.
FORBIDDEN_HERE=main merge, gate, Production deploy, enabling the switch, force push/rebase/reset.
