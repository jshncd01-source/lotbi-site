# Calendar editor compact design — 2026-10-05

User requested continued design work; combined login deployment stays deferred. API root Voice Commerce / app/subscribe payment-review TEST screens inspected earlier are outside this change and untouched.

## Owner / scope

- Existing lotbi-site owner: C:/Users/jshnc/LOTBI-NCLOUD/subscription-plan-banner-v1-site
- Branch: feature/subscription-plan-banner-v1-site-work
- Fresh Ncloud main: 267011b365e5d92aa904e7e32b8638a6edf1b741
- Previous feature: 71c87b3d463f4a960b988fc6cce9d279a19c4fd1
- Product-content edit: site-consumer-detail.css only; new regression guard validate_calendar_editor_spacing_01.mjs. Other runtime file edits are generated asset queries / manifest, final token aset-5cc51810d2b9.

Observed actual local mobile editor occupied the maximum 608px height even for a short form. Empty error paragraph reserved height, footer margin/padding repeated, collapsed disclosure retained grid gap, and mobile backdrop stretched the dialog regardless of content.

CSS now hides only an empty error paragraph, reduces repeated footer/disclosure spacing, and uses auto-height + centered alignment within the existing visual-viewport-sized backdrop. Expanded content remains bounded to the parent; existing header/footer and body-scroll owners are retained. No calendar API/controller, date/time/category logic, touch target floor, or save/delete behavior changed.

## Runtime checks (CUA, local)

- 320×640: short editor height 608 → 529.1875px, centered top55.4px, document scrollWidth320. Body scrollHeight/clientHeight371/371, footer bottom564.6px.
- Expanded details: dialog608px, body450px / scroll822px, footer bottom604px. Place/merchant/memo/amount/category disclosure remains usable. Cost-category options opened and dismissed; no selection persisted.
- Short 320×480: expanded editor448px, header top36px, footer bottom444px, body290px / scroll1104px. No horizontal overflow; close/footer remain accessible.
- Invalid 2460 time marked aria-invalid=true. With nonpersonal title, save validation displayed visible role=alert `시간을 HH:mm 형식으로 입력해 주세요.` (display:block / height18px) before any controller write. Cancelled; selected day still had 0 items. This is invalid-input verification, NOT successful event creation or API E2E.
- Desktop short editor observed after viewport reset. Actual mobile software keyboard / Safari / Samsung Internet / Native NOT_TESTED. Short-height emulation is not an actual keyboard test.
- Two earlier local tabs acquired text while open; those user-entered values were preserved in place, not cleared or saved. Final validation used a separate tab. No personal upload, browser location permission, payment, connection/disconnection, or remote record write.

Screenshots external: calendar-editor-spacing-mobile-20261005.jpg and calendar-editor-spacing-desktop-20261005.jpg under C:/Users/jshnc/.codex/visualizations/2026/10/03/01a10023-5348-79b0-87ab-3a03393311f2/.

## Tests / state

New spacing guard, calendar event editor/mutation, calendar secondary surface, consumer detail system, prior verification/life detail guards PASS. Global dark contrast and 10 static-page theme source contracts PASS (not dark runtime). Predeploy 8 tests / public11 pages / accessibility / legal / asset coherence / diff whitespace PASS.
Legacy day-panel Chromium shell renderer couldn't locate Chrome on Windows; NOT_RUN_TO_COMPLETION, not PASS. Existing CUA day panel/add/close checks are separate evidence. No headless browser installation or control workaround.

IMPLEMENTED / SELECTED_LOCAL_UI_CHECKED / LOCAL_CHECKS_PASS. Exact feature push evidence is recorded in external design-calendar-editor-handoff-20261005.md. Trusted Ncloud CI pending; MAIN_MERGED=NO / PRODUCTION_DEPLOYED=NO / DEPLOY_ID=NONE. Whole132 runtime not complete. Wallet functionality remains deferred; preserved urgent-login/broader-Web owners unchanged.
LIVE_MONEY=false / APP_SYNC_PENDING=KEEP. LOTBI skill maintained owner/gate boundaries; browser skill maintained draft preservation and real-vs-emulated verification distinction.
