READY_FOR_DEPLOY=YES

STATUS=LOTBI 캐릭터 정지 그림을 하나로: ① 브라우저 탭·홈 화면 아이콘 6개(옛 그림 → 공식 로고 캐릭터) ② 다크 화면에서 캐릭터 흰 테두리에 생기던 검은 줄무늬 제거(다크 헤더 로고·캐릭터 그림의 뚫린 흰 반사광만 원본 색으로 채움). 흰 바탕 헤더 로고(승인 봉인 파일)·글자 로고는 바이트 그대로, 모든 그림 크기·위치·윤곽 그대로. 3D 캐릭터와 무관(별도 READY feature/avatar-logo-align-02-site, 순서 무관).

[LOTBI BRAND MARK CLEAN ALPHA + TAB ICONS — RELEASE HANDOFF]

TASK=BRAND-MARK-CLEAN-ALPHA-01 (SITE-AVATAR-LOGO-ALIGN에서 발견, 배포총괄방 "권장안으로 별도 READY, 헤더 로고 모양이 바뀌지 않는 범위", "정지 그림이라 별개로 진행")
REPO=lotbi-site
FEATURE_BRANCH=feature/brand-mark-clean-alpha-01-site
READY_SHA=this document's commit (branch HEAD; `git ls-remote ssh://lotbi-ncloud-git/srv/git/repositories/lotbi-site.git refs/heads/feature/brand-mark-clean-alpha-01-site`)
BASE_MAIN_SHA=b09f6e4d21096a4f897d5ba82b958fc5dc384d35 (SITE-T56 수정본 — v4·아이콘 revert 반영 main, 배포총괄방 지정). push 직전 ls-remote 재확인.
SUPERSEDES=feature/avatar-logo-align-01-site의 탭 아이콘 커밋(d2242f0d·b8730c6e, T56에서 revert됨) — 같은 아이콘 바이트를 이 branch로 다시 냄
DEPLOY_SCOPE=lotbi-site only. CORE_CHANGED=NO / MIGRATION=NONE / ENV_CHANGE_REQUIRED=NO / NEW_CSS=NONE
PAIRED(이미 READY, 같은 생성물): lotbi-web feature/logo-character-icons-01-web edf0da2d · lotbi-admin feature/logo-character-icons-01-admin d1f9ddd0 · lotbi-app feature/logo-character-image-01-app ad96a496(APP-T25)

## ① 탭·홈 화면 아이콘 6개

- favicon.ico(16·32·48·64·128·256) · favicon-16x16.png · favicon-32x32.png · apple-touch-icon.png(180, 흰 바탕 — iOS는 투명을 검게 채움) · icon-192.png · icon-512.png.
- 왜: 2026-09-19에 옛 그림(머리·가슴만, 빨간 귀 없음, 손 안 흔듦)으로 만든 것. Home 외 모든 페이지(404·약관·auth 등)는 /favicon.ico를 쓰고, iOS는 /apple-touch-icon.png를 스스로 가져가서 옛 그림이 보였음. Home의 lotbi-mark-* 링크는 원래 공식 그림.
- 생성: tools/build_site_favicons.py(신규, 결정적 — 두 번 생성 sha 일치). 흰 배경 원본 assets/lotbi-main-logo.png에서 공식 mark-512를 픽셀 그대로 재현(검사 내장, 다르면 중단)한 뒤 아래 ②와 같은 채움으로 깨끗한 캐릭터를 만들어 아이콘으로. Account·Admin·App READY의 아이콘·그림과 바이트 동일.

## ② 다크 화면 검은 줄무늬 — 원인과 변경

tools/build-brand-assets.py가 흰 배경 원본에서 배경을 지울 때 「흰색에서 18 이내」를 모두 배경으로 보고 테두리부터 채워 들어감. 로봇의 흰 반사광도 그 범위라 헬멧·귀·팔·몸 가장자리 반사광이 투명으로 뚫림(512 그림 기준 28,772픽셀). 흰 바탕에선 안 보이고, 어두운 바탕(다크 헤더 로고·다크 테마에서 3D 대신 보이는 그림·다크 브라우저 탭·앱 다크)에서 검은 줄무늬.

- tools/build-brand-assets.py: `fill_mascot_rim` 추가 — 「흰색에서 6 이내」만 배경으로 보는 엄격한 윤곽은 로봇 안으로 새지 않으므로, 그 윤곽 2픽셀 안쪽에서 투명·반투명인 픽셀을 원본 색·불투명으로 되돌림. 캐릭터의 기존 경계 상자 안에서만 → 자르기·크기·바깥 윤곽 그대로. 흰 헤더 로고(lotbi-lockup*.png, 흰 바탕용)는 채우지 않은 원래 자르기 그대로(흰 바탕에선 구멍이 안 보이고, 그 바이트가 validate_site.py 봉인값).
- 다시 만든 파일: lotbi-lockup-dark.png·-dark-160w/320w/480w, lotbi-mark.png·-512/192/96/48/32. 픽셀 변화는 채운 곳뿐(원본 35,283픽셀, 160w 다크 1,256픽셀), 크기 모두 같음.
- 그대로(바이트 동일): lotbi-lockup.png·-160w/320w/480w(흰 헤더 로고), lotbi-wordmark(-dark).png.

## 검사

운영 기준 tree(68b3161e) + 이 변경, 하나씩, 작업 자리표: 15개 모두 PASS
  validate_site.py(흰 헤더 로고 160w 봉인 바이트) · brand_official_logo_01(크기 160×70·아이콘 연결) · dark_wordmark_counters_01 · brand_logo_theme_aware_01 · consumer_design_shell_01 · composer_desktop_width_02 · mobile_entry.js(/favicon.ico) · product_photo_compare_01(icon-192 사용) · about.py · hardening.py · home_chat.py · document_cache_policy_01.py · site_avatar_integration(fallback 그림 mark-512) · bare_white_home_render_01 · avatar_refresh_flash_01
  asset_cache_version --check PASS
  재생성: build-brand-assets.py → 다크 로고·마크가 이 branch 파일과 바이트 동일, build_site_favicons.py → 아이콘 6개 바이트 동일(두 번 생성 일치)

## 전후 (USER_FIRST 11)

- D:\LOTBI-WORK\evidence\avatar-logo-align-01\SITE_ICONS_BEFORE_AFTER.png — 탭 아이콘 전후(흰 탭·어두운 탭)
- D:\LOTBI-WORK\evidence\avatar-logo-align-01\BRAND_CLEAN_ALPHA_BEFORE_AFTER.png — 흰 헤더 로고(같음) / 다크 헤더 로고(검은 틈 → 온전) / mark-512 어두운 바탕(줄무늬 → 온전) / mark-512 흰 바탕(같음)

## 사용자 시나리오

S1 약관·404 페이지를 탭으로 열어 둔 사람: 0탭 — 브라우저 탭 아이콘이 lotbiai.com 헤더 로고와 같은 롯비(전: 머리만 잘린 옛 그림). 막힌 곳 없음.
S2 iPhone에서 lotbiai.com을 홈 화면에 추가: 흰 바탕 공식 롯비 아이콘. 막힌 곳 없음.
S3 다크 테마로 lotbiai.com을 연 사람: 0탭 — 왼쪽 위 로고의 롯비 흰 헬멧 테두리에 검은 틈 없음. 막힌 곳 없음.
S4 라이트 테마 사용자: 0탭 — 헤더 로고 바이트 그대로(변화 없음).
S5 3D가 안 되는 기기 + 다크: 0탭 — 가운데 롯비 그림이 줄무늬 없이 온전.

## 남은 문제

- 브라우저가 옛 그림·favicon을 잠시 캐시할 수 있음(주소 같음, 버전 토큰 없음) — 새로고침·재방문 시 갱신.
