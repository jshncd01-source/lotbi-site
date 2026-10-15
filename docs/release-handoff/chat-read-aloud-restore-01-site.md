READY_FOR_DEPLOY=YES

# chat-read-aloud-restore-01-site — release handoff (CHAT READ ALOUD RESTORE P0, Site)

REPO=lotbi-site
FEATURE_BRANCH=feature/chat-read-aloud-restore-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ... refs/heads/feature/chat-read-aloud-restore-01-site`)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=82a8874ee1515c71caf2674ab02d9360484dbc4a (Merge release/20261008-site-t27-work); re-checked unchanged right before this commit
CODE_SHA=14a8a681
CODE_COMMITS (none in main yet):
  14a8a681 test: the answer-tool row may wrap only when the four tools do not fit (found by the keyboard-branch merge test)
  b302fb46 merge Ncloud main 82a8874e — 59 files asset-token-only (one side taken, regenerated); site-conversation.js imports = union (main's LOTBI_BOX_UI_ENABLED + read-aloud module); site-life-wallet.js = main's line; read-aloud controller = this branch's isKoreanVoice import. Cross-checked: merged tree vs main differs only in this branch's 13 files (998 non-token lines, identical to fb4209aa vs its base).
  fb4209aa feat: restore 읽어주기 under LOTBI answers, on-device voices only (base main 33aa5d9a)
ASSET_VERSION=aset-da1f91f5c84e

## FINDING

- 읽어주기 was removed from the answer tools by 18fd804c (chat-tools-calendar-popup-01, "읽어주기는 대화에서 빠진다"); the engine (site-read-aloud-controller.js / -speech.js / site-voice-tts.js) stayed. The public voice exclusion bddde592 covers only microphone / wake / scam-shield voice input — untouched here.
- site-voice-tts.js gave network voices (localService === false) a +2 bonus, i.e. Chrome's "Google 한국의" was preferred — the opposite of "no network voice". Fixed.

## SCOPE (lotbi-site only; no Core/Web/App change, no migration, no env)

- site-message-read-aloud.js (new): the button (speaker icon + 읽어주기; ■ 중지 while preparing/playing; aria-label 답변 읽어주기 / 읽기 중지), one playback owner for the page (existing controller), Markdown/code/URL/pictograph clean-up, ≤180-character sentence pieces (no lookbehind — older iOS Safari), Korean messages: no engine / no Korean voice / only network voices ("인터넷 음성으로 바꾸지 않아요"). Safety net: an answer node removed from the page stops at its next piece. No fetch/XHR/beacon/socket/dynamic import, no storage, no console, telemetry = performance.mark with event/playbackId/reason only.
- site-voice-tts.js: only localService === true voices, first and as the one-time fallback; network bonus removed. site-read-aloud-controller.js: NO_LOCAL_KOREAN_VOICE.
- site-conversation.js: import + button last in the row (share menu stays anchored under 공유하기) + stop on a new question (requestAssistant, after its guard), on a conversation re-render (switch, logout/namespace change) and a cleared Home (new conversation, active thread deleted). Page hide/pagehide already stop it (controller). Mic / live voice / wake stay behind PUBLIC_SITE_VOICE_RELEASE_ENABLED = false.
- site-conversation.css: .chat-message-action-read (44px, tokens → light/dark).
- .github/workflows/site-review.yml: the read-aloud step now also checks site-message-read-aloud.js and runs the two new validators.

## COST / PRIVACY

OPENAI_TTS_CALLS=0, ELEVENLABS_TTS_CALLS=0, /v2/live/tts=0, new AI answers from the button=0, AI usage deduction=0 (browser validator records every request: none on press), free on every plan (no plan gate), no auto-play.

## TEST_STATUS (Windows, Chrome 154, CPU at 100% from ~19 parallel sessions)

- New: validate_chat_read_aloud_restore_01 (text: 3,978-char answer → 23 pieces ≤180, joined = whole text, each paragraph once, no Markdown/code/URL) PASS; validate_chat_read_aloud_restore_browser_01 (real conversation runtime + production stylesheets, deterministic speech stand-in): 390/320/375 KakaoTalk UA/1280 + network-only / no Korean voice / no engine — PASS on fb4209aa, on 14a8a681 and on a test merge with the keyboard branch.
- Changed expectations (CHANGED_TEST_EXPECTATIONS): validate_voice_tts_quality_01 (network voice never picked, was preferred), validate_read_aloud_controller_01 (local fixtures; section 22 checks the chat wiring instead of the absence; +network-only, +local-beside-network), validate_message_share_actions_01 (row = copy, share, calendar, 읽어주기), validate_message_calendar_footer_editor_01 (4 tools).
- Regression on fb4209aa: all 149 static validate_* PASS (PYTHONIOENCODING=utf-8); 21 chat/home browser validators: 17 PASS (at least one clean run); 4 NOT VERIFIED locally — validate_composer_auto_grow, validate_conversation_message_ux_final_01, validate_mobile_home_ux_stability_01 (Chrome spawnSync ETIMEDOUT in every run under the load) and validate_place_card_compact_01 ("Failed to fetch dynamically imported module", the known load flake). The same validators time out on untouched main 33aa5d9a in the same session. No assertion failure was seen on this branch; the Linux gate is the first clean run of those 4.
- On the pushed tree (b302fb46/14a8a681): key static set PASS (share_actions, read_aloud_controller, voice_tts_quality, voice_public_release_exclusion, chat_read_aloud_restore_01, home_refresh_persistence, rich_product_cards, lotbi_box_nav, validate_site/hardening/accessibility/home_chat.py), life_info_cleanup_final_01 PASS, chat_read_aloud_restore_browser_01 PASS, asset_cache_version PASS; message_calendar_footer_editor_01 PASS on fb4209aa and on the keyboard test merge, one run on 14a8a681 hit "Failed to fetch dynamically imported module" (load flake).
- Merge test with feature/chat-mobile-keyboard-dismiss-reading-view-01-site c2cec394 (READY=NO, other owner): conflicts = asset tokens + the import block only; validate_chat_mobile_keyboard_dismiss_01, validate_mobile_composer_keyboard_layout_01, validate_chat_long_answer_scroll_anchor_01, validate_chat_ios_touch_scroll_keyboard_01 PASS with this branch merged.
- Real engines on this PC (volume 0, off-screen window over CDP): Chrome → Korean voices Heami (local) + Google 한국의 (network) → Heami picked, start/end events fired; Edge → only "… Online (Natural)" Korean voices → nothing picked, the no-on-device-voice message (not read).

NEW_FAILURES=0
NOT_TESTED=iPhone Safari, KakaoTalk in-app browser (only its UA at 375px), Android Chrome, Samsung Internet on real devices; real audio output quality.

MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
DEPENDENCIES=none (App READY feature/chat-read-aloud-restore-01-app is independent)

USER_DECISION_NEEDED=Desktop Edge (and any device without an on-device Korean voice) will show the message instead of reading, by the "no network voice" rule. Allowing Edge's free online voices would mean sending the answer text to Microsoft — not done.
