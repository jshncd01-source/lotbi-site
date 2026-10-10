READY_FOR_DEPLOY=YES
DEPLOY_ORDER=CORE (feature/family-location-01-core, p0_0117; re-READY after CORE-T47) → SITE (this) → APP. With Core's FAMILY_LOCATION_ENABLED off (or Core not yet deployed) the Site shows nothing new: the 「가족 위치」 tab appears only when Core answers.
ACTIVATION=Core FAMILY_LOCATION_ENABLED (off). No Site switch of its own: the tab follows Core.
USER_DECISION_NEEDED=NONE for deploying with Core's switch off. Map SDK (NAVER Cloud Maps) is not in this piece: list + map-app/로드뷰 links until keys exist (owner decision: map behind a switch).

# FAMILY-LOCATION-01 (Site) — 「우리 가족 위치」 1차 조각 ③ 보호자 화면

REPO=lotbi-site
FEATURE_BRANCH=feature/family-location-01-site
FEATURE_SHA=this document's commit (branch HEAD; `git ls-remote origin refs/heads/feature/family-location-01-site`)
BASE_MAIN=afb7057d1 (branch start) — Ncloud main still afb7057d1 at push, no merge needed
CODE_SHA=757c44dd5
ASSET_VERSION=aset-b0c8e0368576
OWNER_APPROVAL=2026-10-10 "가족 위치 권장대로 개발 시작" (relayed by 배포총괄방). Development only.
DUPLICATE_CHECK=no family-location branch in lotbi-site on Ncloud before this work; dedicated clone C:\Users\jshnc\LOTBI-NCLOUD\family-location-01\site
CORE_CONTRACT=lotbi-core docs/FAMILY-LOCATION-01.md (feature/family-location-01-core)

## What changed
- NEW site-family-location.js — Core client for /v2/family-location (Bearer, credentials omit, no-store); presence/accuracy/hidden texts; map + 로드뷰 links (Kakao Map documented link format; Google Maps when it is the person's default map); factual privacy notice.
- NEW site-family-location-ui.js — 안심케어 → 가족 위치: privacy notice; guardian cards (last time next to the name, battery right under it, place in words + "약 n m 범위"/"정확하지 않아요", stop reason, [지금 위치 요청] with Basic's remaining count and polling until answered/failed with the reason, [위치 상태 점검] one sentence + checklist, [지도에서 보기] [로드뷰], owner [연결 해제]); SOS cards ([실종 신고로 이어가기] → the 사람 tab with the place in words filled in, [찾았어요·종료], 112); owner tools (approve/reject a second guardian, open invitations with 초대 취소, [가족 초대하기]: 자녀/부모님/배우자/가족/함께 보는 보호자, 만 14세 미만 only with the legal-guardian consent text checked, result = 6-digit code (10 min) + link (24 h) + 카카오톡 보내기 + 링크 복사); invitation accept (code/link or the #family-invite link) with the share consent text; a sharer's own view (가족에게 위치 공유 중, 나를 보는 사람, recent checks, 지금 내 위치 한 번 보내기 via site-current-location.js after a press, SOS twice, pause — child 1 hour only, 공유 끄기 for adults, [원치 않는 추적을 당하고 있어요]); alert settings (quiet hours, 미갱신 minutes, per person kinds; SOS always on). Forms survive the 3-second redraw while a request is pending.
- NEW site-family-location.css (theme tokens only; 44px+ buttons; 360px single column); index.html links it.
- site-consumer-sections.js — 안심케어 tabs: a third 「가족 위치」 tab only when `checkFamily()` (Core's /sharing) answers; arrow keys move across three tabs then; the two-tab code path and the initial 사람/반려동물 selection are unchanged (validate_consumer_design_shell_01 untouched and passing).
- site-conversation.js — checkFamily/mountFamily wiring, 사람 mount takes `missingPrefill`, the `care` route opens 가족 위치 when an invitation waits.
- site-route.js — #family-invite=<token> kept for this tab only (sessionStorage, 30 min) and the address becomes #care (like #wallet-share).
- site-person-ui.js — `missingPrefill` fills 실종 날짜·시간 and 마지막으로 본 장소 (editable) with a status line; nothing else changes.
- scripts/validate_family_location_01.mjs (new) and asset cache tokens.

## Tests (this room)
FAMILY_VALIDATOR=PASS — scripts/validate_family_location_01.mjs (headless Chrome, synthetic Core answers, no other network): source rules (one Core surface, credentials omit, no storage/log of coordinates, position only via site-current-location after a press, factual privacy notice, invitation token leaves the address, tab waits for Core, CSS linked) + changed modules load in a browser + 26 flow checks (switched-off Core → 준비 중; guardian card order/battery/place/accuracy/map+로드뷰/stop reason; 지금 위치 answered by polling; 위치 상태 점검 sentence + checklist; approve guardian; SOS → 실종 신고 prefill; under-14 invite blocked without consent, then code + Kakao; Bearer only; sharer view, child 1-hour pause, report; invitation link previewed and accepted with the share consent; tab absent when Core is off, present when on) + 360 px light/dark (no sideways scroll, text/card contrast, 44 px buttons, Basic copy)
EXISTING_VALIDATORS=38 validators that read the changed files + validate_hardening.py + asset coherence. PASS: 28 + hardening + asset coherence (aset-b0c8e0368576), incl. consumer_design_shell_01 / consumer_sections_02 (care-tab shape unchanged), site_refresh_route_restore_01 (177 checks), all safecare person validators (dark_cancel, photo_bulk_upload, profile_slot_acceptance, web_ui_redesign, people_01, person_care_real_user_01). jeonbuk_real_world_pilot_01 and pet_family_web_01 need CHROME_BIN on this PC → PASS with it (main and this branch alike). photo_input_no_camcorder_01, real_estate_region_favorites_p0, subway_life_info_p0_01, traffic_cctv_route_select_p0_01 fail identically on a clean main afb7057d1 worktree on this Windows PC (CRLF working copies vs `
` source regexes) → environment, not this branch; Linux gate decides
FOUND_AND_FIXED_BY_VALIDATION=a stray quote in the 사람 안심케어 status line (broke the module in browsers; node --check did not catch it) — fixed, and the family validator now loads every changed module; presses during a running action were dropped silently (validator waits); the 3-second redraw wiped forms (forms now kept); a closed screen kept re-scheduling its poll (stopped)
NOT_RUN_HERE=Linux trusted gate (배포총괄방)

## Not changed / not verified
PRODUCTION / DB / SECRET / LIVE MONEY / PAID INFRA=none
NOT_VERIFIED=live Core (feature off until the owner turns it on), NAVER map SDK (not built: no keys), Kakao 로드뷰 link opening on every phone/browser, Linux trusted gate (배포총괄방)
NEXT_OWNER=배포총괄방 (after the Core re-READY and deploy)

FORBIDDEN_HERE=main merge, gate, Production deploy, enabling switches, real user data, force push/rebase/reset.
