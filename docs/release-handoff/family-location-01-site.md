READY_FOR_DEPLOY=YES
WORK_ID=FAMILY-LOCATION-DESIGN-01 (Site part)
SUPERSEDES=df93b720f (in SITE-T55; everything in it plus the design and the A안 privacy line)
DEPLOY_ORDER=any order with Core 9f58a150 / App 45446b5a (layout and fallback text only; no API change). The 「가족 위치」 tab still appears only when Core answers (FAMILY_LOCATION_ENABLED, off).
ACTIVATION=none
USER_DECISION_NEEDED=NONE (owner: "디자인까지 한번에 완성하고 배포방에 넘겨", P4 A안 "a")

# FAMILY-LOCATION-DESIGN-01 (Site) — 가족 위치 탭 디자인 + 안내 문구 A안

REPO=lotbi-site
FEATURE_BRANCH=feature/family-location-01-site
FEATURE_SHA=this document's commit (branch HEAD; `git ls-remote origin refs/heads/feature/family-location-01-site`)
BASE_MAIN=68b3161e6 (SITE-T55, contains df93b720 and the callback CSS fix) merged as 83c1cdc15; Ncloud main still 68b3161e6 at push
CODE_SHA=83c1cdc15 (merge) on 8cb6cb8c2 (design)
ASSET_VERSION=aset-3851b4abe188
STANDARD=C:\Users\jshnc\LOTBI-NCLOUD\release-control\USER_FIRST_STANDARD.md (9 items)

## What changed (site-family-location-ui.js, site-family-location.css, site-family-location.js, validator)
- Tone of the newest LOTBI screens: 지역정보-style tiles, LOTBI line icons (24px, 1.6 stroke, same drawing rules as ICON_PATHS in site-consumer-sections.js), soft 12–16px cards, theme tokens only (light, dark), 16px body text, every control ≥ 48px.
- ① one screen, one job: home = SOS (top, red) → my sharing card → each family (person cards) → tiles [가족 초대하기] [초대 코드 입력] [알림 설정]. 초대하기 / 초대 코드 입력 / 알림 설정 / 장소 알림 each open their own screen with "← 가족 위치"; a created invitation shows alone (code + [카카오톡으로 보내기], then [다른 사람 초대하기]). An invitation link opens straight on 초대 코드 입력.
- Person card (기획서 3, 경쟁 앱 불만 대응): avatar + status dot (green now / amber stale·paused / grey), the last time right next to the name, the battery right under it (red ≤ 15 %), place + accuracy, "멈춘 이유" callout, one big [지금 위치 요청], tools [위치 상태 점검] [지도에서 보기] [로드뷰] [장소 알림]; [연결 해제] as a quiet red text button.
- The person who shares: a green "가족에게 위치 공유 중" card (amber "위치 공유 잠시 멈춤 · HH:MM까지" when paused) with the 64px [SOS 도와주세요], pause / [위치 공유 다시 켜기], [지금 내 위치 한 번 보내기], places set for me, [원치 않는 추적을 당하고 있어요].
- ③ no dead end: a failed load shows [다시 시도]; a switched-off Core shows [다시 확인] + [초대 코드 입력]; nothing connected shows a start card with [가족 초대하기] [초대 코드 입력] (the tiles are not repeated there).
- Privacy line (owner decision A안): "내 위치는 연결된 가족만 봐요. 광고·AI 학습에 쓰지 않아요." with a lock icon; FAMILY_MISSING_REPORT_NOTICE under [실종 신고로 이어가기]. "내가 허락한 가족" is refused by the validator (a second guardian joins with the owner's approval).
- ④ names match the app (지금 위치 요청 · 위치 상태 점검 · 지도에서 보기 · SOS 도와주세요 · 1시간 멈추기 · 원치 않는 추적을 당하고 있어요 · 실종 신고로 이어가기 · 찾았어요 · 종료).
- No new CSS file (the auth/callback head needs no change for this piece).

## 사용자 시나리오 (USER_FIRST_STANDARD ⑧) — followed in a browser on this build, synthetic data
Screenshots: C:\Users\jshnc\OneDrive\문서\LOTBI_안심확인_검증\handoff\가족위치_기획\screenshots\design-01-20261011\ (390×844 phone at 2×, 1280×900 PC; none scrolls sideways)
| # | 시나리오 | 시작 → 결과 | 탭 수 | 막힌 곳 | 스크린샷 |
|---|---|---|---|---|---|
| 1 | 보호자 첫 연결 | 가족 위치 탭(아무도 없음, 시작 카드) → [가족 초대하기] → 자녀 · 이름 · 만 14세 미만 · 동의 → [초대 만들기] → 코드 482913 + [카카오톡으로 보내기] | 2 (+ 이름 입력, 체크 2개) | 없음 | s1-1-first-empty-mobile, s1-2-invite-form-mobile, s1-3-invite-created-mobile |
| 2 | 아이 위치 확인 | 가족 위치 탭 → 은율 카드(이름 옆 "3분 전", 바로 아래 배터리 64%, 효자동1가 근처 · 약 12m 범위) → [지금 위치 요청] → "새 위치를 받았어요." | 1 | 없음 (푸시가 꺼져 있으면 휴대폰 다음 신호까지 최대 5분 — 화면에 그렇게 씀) | s2-1-family-home-mobile, s2-2-now-answered-mobile, s2-3-family-home-pc, s2-4-family-home-mobile-dark; 장소 알림 s2-5-places-mobile |
| 3 | SOS | SOS 카드 맨 위(빨강) → [실종 신고로 이어가기] → 사람 탭 실종 신고(마지막 장소 채움) | 1 | 없음 | s3-1-sos-mobile-dark, s3-2-sos-mobile-light |
| 4 | 아이 폰에서 멈추기 (웹 화면) | "가족에게 위치 공유 중"(초록) → [1시간 멈추기] → "위치 공유 잠시 멈춤 · HH:MM까지"(주황) + [위치 공유 다시 켜기] | 1 | 없음 | s4-1-sharing-on-mobile, s4-2-sharing-paused-mobile, s4-3-sharing-on-mobile-dark |
States checked (⑦): phone + PC, light + dark, logged in (the tab needs a session; logged out shows "로그인하면 가족 위치를 쓸 수 있어요"), location denied for "내 지금 위치로" (says so and keeps the form), Core off / failed (next buttons).

## Tests (this room, on 83c1cdc15)
FAMILY_VALIDATOR=PASS — scripts/validate_family_location_01.mjs, updated to the new screens (navigates to 초대하기 / 알림 설정 / 장소 알림 and back), plus: invite screen alone, typing kept while a 지금 위치 answer reloads the overview, failed load has [다시 시도] and retries, switched-off Core has [다시 확인], 48px for every button and tool at 360px light/dark (was 44px)
REGRESSION=PASS on 83c1cdc15 — validate_auth_continuity_02 (callback head has every Home stylesheet incl. site-family-location.css, from SITE-T55), consumer_design_shell_01, consumer_sections_02, global_location_foundation_01, site_refresh_route_restore_01, safecare_people_01, safecare_web_ui_redesign_01, safecare_person_dark_cancel_01, person_care_real_user_01, safecare_photo_bulk_upload_01, validate_hardening.py, asset coherence aset-3851b4abe188; rc_main_deleted_check (origin/main vs 8cb6cb8c2) MAIN_DELETED_TOTAL 0. Merge conflicts: asset tokens only (83 files, rc_token_resolve), tokens rewritten
NOT_RUN_HERE=Linux trusted gate (배포총괄방)

## Not changed / not verified
PRODUCTION / DB / SECRET / LIVE MONEY / PAID INFRA=none
NOT_VERIFIED=live Core (feature off), map SDK (NAVER keys), real phones
NEXT_OWNER=배포총괄방 (Site train; then owner check → switches → 2-week test)

FORBIDDEN_HERE=main merge, gate, Production deploy, enabling switches, real user data, force push/rebase/reset.
