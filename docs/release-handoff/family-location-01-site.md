READY_FOR_DEPLOY=YES
SUPERSEDES=6a1382f8e (everything in it, plus 도착/출발 places for guardians)
DEPLOY_ORDER=CORE (feature/family-location-01-core, p0_0117; re-READY after CORE-T47) → SITE (this) → APP. With Core's FAMILY_LOCATION_ENABLED off (or Core not yet deployed) the Site shows nothing new: the 「가족 위치」 tab appears only when Core answers.
ACTIVATION=Core FAMILY_LOCATION_ENABLED (off). No Site switch of its own: the tab follows Core.
USER_DECISION_NEEDED=NONE for deploying with Core's switch off. Map SDK (NAVER Cloud Maps) is not in this piece: list + map-app/로드뷰 links until keys exist (owner decision: map behind a switch).

# FAMILY-LOCATION-01 (Site) — 「우리 가족 위치」 1차 조각 ③ 보호자 화면 + 도착/출발 장소

REPO=lotbi-site
FEATURE_BRANCH=feature/family-location-01-site
FEATURE_SHA=this document's commit (branch HEAD; `git ls-remote origin refs/heads/feature/family-location-01-site`)
BASE_MAIN=afb7057d1 (branch start) — Ncloud main still afb7057d1 at push, no merge needed
CODE_SHA=a049bdc87 (도착/출발) on 757c44dd5
ASSET_VERSION=aset-f5ec80ca26ef
OWNER_APPROVAL=2026-10-10 "가족 위치 권장대로 개발 시작" (relayed by 배포총괄방). Development only.
DUPLICATE_CHECK=no family-location branch in lotbi-site on Ncloud before this work; dedicated clone C:\Users\jshnc\LOTBI-NCLOUD\family-location-01\site
CORE_CONTRACT=lotbi-core docs/FAMILY-LOCATION-01.md (feature/family-location-01-core)

## What changed (since 6a1382f8e) — 도착/출발 places (Core docs/FAMILY-LOCATION-01.md §8)
- Shown only when Core lists the PLACE alert kind (`overview.settings.kinds`): with an older Core or the switch off nothing new appears and the settings send only the kinds Core knows.
- Each person's card gets [장소 알림]: the places set for that person (name, kind, radius, who set it), 도착 / 출발 toggles, 쉬는 날 끄기 for a school place (주말·공휴일, plus 학사일정 when it is a 내 아이 school), [장소 지우기]; "장소 n/limit곳"; on Free/Basic "도착·출발 알림은 Plus 요금제부터".
- Add a place: name (20), kind 집/학교/학원/기타, radius 100/150/200/300 m, centre = "<이름> 지금 위치로" (Core uses the person's stored fresh precise point; no coordinate leaves the page) or "내 지금 위치로" (site-current-location.js after the press; Core refuses a circle over 100 m), or pick a 내 아이 school (name + 학교 + the entry id for NEIS days off). Typing survives the 3-second redraws.
- The person's own view lists "나에게 등록된 장소" with who set it and which alerts (P1).
- Alert settings: 장소 도착·출발 per person; the note says quiet hours do not send it at all. Footer: "이동 경로는 남기지 않아요 … 장소 도착·출발은 알림과 하루 보관 기록만 남아요".
- Error texts for FAMILY_PLACE_* codes.

## What changed (6a1382f8e)
- NEW site-family-location.js — Core client for /v2/family-location (Bearer, credentials omit, no-store); presence/accuracy/hidden texts; map + 로드뷰 links (Kakao Map documented link format; Google Maps when it is the person's default map); factual privacy notice.
- NEW site-family-location-ui.js — 안심케어 → 가족 위치: privacy notice; guardian cards (last time next to the name, battery right under it, place in words + "약 n m 범위"/"정확하지 않아요", stop reason, [지금 위치 요청] with Basic's remaining count and polling until answered/failed with the reason, [위치 상태 점검] one sentence + checklist, [지도에서 보기] [로드뷰], owner [연결 해제]); SOS cards ([실종 신고로 이어가기] → the 사람 tab with the place in words filled in, [찾았어요·종료], 112); owner tools (approve/reject a second guardian, open invitations with 초대 취소, [가족 초대하기]: 자녀/부모님/배우자/가족/함께 보는 보호자, 만 14세 미만 only with the legal-guardian consent text checked, result = 6-digit code (10 min) + link (24 h) + 카카오톡 보내기 + 링크 복사); invitation accept (code/link or the #family-invite link) with the share consent text; a sharer's own view (가족에게 위치 공유 중, 나를 보는 사람, recent checks, 지금 내 위치 한 번 보내기 via site-current-location.js after a press, SOS twice, pause — child 1 hour only, 공유 끄기 for adults, [원치 않는 추적을 당하고 있어요]); alert settings (quiet hours, 미갱신 minutes, per person kinds; SOS always on). Forms survive the 3-second redraw while a request is pending.
- NEW site-family-location.css (theme tokens only; 44px+ buttons; 360px single column); index.html links it.
- site-consumer-sections.js — 안심케어 tabs: a third 「가족 위치」 tab only when `checkFamily()` (Core's /sharing) answers; arrow keys move across three tabs then; the two-tab code path and the initial 사람/반려동물 selection are unchanged (validate_consumer_design_shell_01 untouched and passing).
- site-conversation.js — checkFamily/mountFamily wiring, 사람 mount takes `missingPrefill`, the `care` route opens 가족 위치 when an invitation waits.
- site-route.js — #family-invite=<token> kept for this tab only (sessionStorage, 30 min) and the address becomes #care (like #wallet-share).
- site-person-ui.js — `missingPrefill` fills 실종 날짜·시간 and 마지막으로 본 장소 (editable) with a status line; nothing else changes.
- scripts/validate_family_location_01.mjs (new) and asset cache tokens.

## Tests (this room, on a049bdc87)
FAMILY_VALIDATOR_PLACES=PASS — scripts/validate_family_location_01.mjs now also: source rules (a browser centre only from currentFix() after a press via familyPlaceCenterFromFix; places only when Core lists PLACE) + 10 more flow checks (older Core: no places button or 장소 toggle; panel lists places with 1/5; typing kept across a 지금 위치 poll; 내 아이 school fills name + 학교; create body exactly {name, kind, radius_m 150, center MEMBER_LOCATION, arrive, depart, my_child_entry_id}; depart PATCH {depart:false}; delete; settings 장소 도착·출발 + quiet-hours note + footer; no coordinate in any /places body; the person sees "나에게 등록된 장소"). 360 px light/dark unchanged and passing
REGRESSION_THIS_PIECE=PASS — global_location_foundation_01, consumer_design_shell_01, consumer_sections_02, site_refresh_route_restore_01, build_env_contract_01, clean_urls, document_cache_policy_01, nginx_module_mime_01, validate_hardening.py, every safecare/person validator (10), asset coherence aset-f5ec80ca26ef; only the four family files changed besides asset tokens (checked file by file)
FAMILY_VALIDATOR=PASS (6a1382f8e) — scripts/validate_family_location_01.mjs (headless Chrome, synthetic Core answers, no other network): source rules (one Core surface, credentials omit, no storage/log of coordinates, position only via site-current-location after a press, factual privacy notice, invitation token leaves the address, tab waits for Core, CSS linked) + changed modules load in a browser + 26 flow checks (switched-off Core → 준비 중; guardian card order/battery/place/accuracy/map+로드뷰/stop reason; 지금 위치 answered by polling; 위치 상태 점검 sentence + checklist; approve guardian; SOS → 실종 신고 prefill; under-14 invite blocked without consent, then code + Kakao; Bearer only; sharer view, child 1-hour pause, report; invitation link previewed and accepted with the share consent; tab absent when Core is off, present when on) + 360 px light/dark (no sideways scroll, text/card contrast, 44 px buttons, Basic copy)
EXISTING_VALIDATORS=38 validators that read the changed files + validate_hardening.py + asset coherence. PASS: 28 + hardening + asset coherence (aset-b0c8e0368576), incl. consumer_design_shell_01 / consumer_sections_02 (care-tab shape unchanged), site_refresh_route_restore_01 (177 checks), all safecare person validators (dark_cancel, photo_bulk_upload, profile_slot_acceptance, web_ui_redesign, people_01, person_care_real_user_01). jeonbuk_real_world_pilot_01 and pet_family_web_01 need CHROME_BIN on this PC → PASS with it (main and this branch alike). photo_input_no_camcorder_01, real_estate_region_favorites_p0, subway_life_info_p0_01, traffic_cctv_route_select_p0_01 fail identically on a clean main afb7057d1 worktree on this Windows PC (CRLF working copies vs `
` source regexes) → environment, not this branch; Linux gate decides
FOUND_AND_FIXED_BY_VALIDATION=a stray quote in the 사람 안심케어 status line (broke the module in browsers; node --check did not catch it) — fixed, and the family validator now loads every changed module; presses during a running action were dropped silently (validator waits); the 3-second redraw wiped forms (forms now kept); a closed screen kept re-scheduling its poll (stopped)
NOT_RUN_HERE=Linux trusted gate (배포총괄방)

## Not changed / not verified
PRODUCTION / DB / SECRET / LIVE MONEY / PAID INFRA=none
NOT_VERIFIED=live Core places (Core re-READY after CORE-T47 not yet pushed; feature off until the owner turns it on), picking a place on a map (needs the NAVER map switch; today: the person's current place or my position), NAVER map SDK (not built: no keys), Kakao 로드뷰 link opening on every phone/browser, Linux trusted gate (배포총괄방)
NEXT_OWNER=배포총괄방 (after the Core re-READY and deploy)

FORBIDDEN_HERE=main merge, gate, Production deploy, enabling switches, real user data, force push/rebase/reset.
