READY_FOR_DEPLOY=YES

# site-subscribe-404-connected-hide-01-site — release handoff (사이트 3조각: 구독 다크 · 404 · 연결 서비스 숨김)

REPO=lotbi-site
FEATURE_BRANCH=feature/site-connected-services-hide-01
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ssh://lotbi-ncloud-git/srv/git/repositories/lotbi-site.git refs/heads/feature/site-connected-services-hide-01`)
BASE_MAIN_SHA=7c4f09445676287f242271cbdfb32d91ec33891e (Ncloud site main = SITE-T54, push 직전 확인 동일)
CODE_SHAS=46b9ce475 (구독 다크) → 53237c86b (404) → ce228735d (연결 서비스 숨김); 세 커밋이 순서대로 쌓여 있고 하나의 branch에 모두 있다
ASSET_VERSION=aset-7d8534fa1ec4
DEPLOY_SCOPE=lotbi-site only. Core 무변경. **nginx 설정(`nginx/default.conf.template`) 변경 포함 → 사이트 이미지 재빌드·nginx 재시작이 필요하다(배포방).**
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
CONSENT_HASH_CHANGED=NO (privacy·terms 파일은 `?v=aset-…` 캐시 토큰 문자열만 바뀜 — 본문 무변경. `validate_hardening.py`·`validate_social_legal_manifest_01.py`("survive asset-token rewrites")·`emit_social_signup_legal_manifest.py` PASS)
THEME_TOKENS_CHANGED=NO (site-theme-tokens.css 무변경 → Web theme sync 불필요)
USER_DECISION_NEEDED=NONE (연결 서비스 숨김은 소유자 결정 2026-10-11 "우선 권장으로 전부 승인해" 반영)
PAIRED=Account(web) 쪽 같은 문제는 확인함 — 아래 "Account 확인" 참고. 별도 web 404는 다음 조각.

토큰 충돌: 세 조각 모두 `asset_cache_version.mjs --write`를 했다. 배포방이 열차에서 토큰 충돌을 풀 때 마지막(이 branch의) 값을 쓰거나 `--write`를 한 번 더 하면 된다.

---

## 조각 1 — SITE-SUBSCRIBE-DARK-CONTRAST-01 (QA 화면 전수 01 N1, P1)

**문제**: 결제 첫 관문 `/subscribe`의 다크에서 [Basic 시작하기]·[Plus 시작하기]·[Pro로 업그레이드] 글자와 '추천' 배지가 안 보임(흰 바탕에 흰 글자, QA 측정 대비 1.09:1).
**원인**: 다크에서 `--brand-navy`가 밝은 색(#f5f5f5)으로 뒤집히는데 `subscribe.css`가 두 곳의 글자색을 `#fff`로 고정. `.plan-buy`만 `site-static-theme.css`에서 이미 고쳐져 있었고 `.plan-card-cta`·`.recommended-badge`가 빠져 있었다.
**수정**: `site-static-theme.css` — 다크(명시·기기·속성 없음 첫 페인트 3경로)에서 두 면의 글자를 `#212121`로. `subscribe.css`의 링크 규칙이 선택자 5단(+`:hover`·`:visited`)이라 같은 경로를 반복해 무게로 이기게 했다(소스 순서에 기대지 않음).
**새 검사** `validate_subscribe_dark_contrast_01.mjs`(site-review.yml 등록): 실제 `subscribe.html`을 Chrome으로 열어 4가지 경로(밝음·명시 다크·기기 다크·속성 없음) + 마우스 올림 상태에서 버튼 3개·배지의 **실제 칠해진 색 대비 ≥ 4.5:1**을 잰다. 기존 `validate_static_pages_theme_01.mjs` 표에도 두 줄 추가.
**역시험**: 수정 전 CSS로 되돌리면 새 검사가 `"Basic 시작하기" rgb(255,255,255) on rgb(245,245,245) measures **1.09:1**` — QA가 잰 값 그대로 — 으로 실패. 수정 후 다크 **14.77:1**, 밝음 16.1:1.

## 조각 2 — SITE-404-LOTBI-01 (QA 화면 전수 01 N4, P1)

**문제**: 없는 주소는 nginx 기본 영문 "404 Not Found nginx/1.28.3" — 로고·돌아갈 길 없음, 뷰포트 설정이 없어 휴대폰에서 글자가 깨알, 다크에서도 흰색.
**원인**: `nginx/default.conf.template`에 `error_page`가 없어, 저장소에 있던 테마 적용 `404.html`이 한 번도 쓰이지 않았다.
**수정**:
- nginx: `error_page 404 /404.html;` + `location = /404.html { internal; }` — **상태는 404 그대로**(검색 로봇에 200으로 보이지 않음), 주소창은 그대로.
- `404.html`을 사람 말로 다시 씀: 마스코트·"찾으시는 페이지를 찾을 수 없어요"·한 줄 설명·[LOTBI 홈으로 가기]·[문의하기](52px 버튼, 16px 글자, 다크·휴대폰 대응). 개발 메모("주소는 그대로 유지했습니다…")와 영어 머리말 제거.
- **발견·수정한 숨은 함정**: nginx가 주소창을 유지한 채 이 페이지를 대신 보여 주므로, 깊은 주소(`/a/b/c`)에서는 상대 경로로 부르던 `site-consumer-documents.css`·`site-document-navigation.js`를 못 찾아 스타일이 깨질 수 있었다 → 절대 경로(`/…`)로 고침.
- 의견 보내기(`/feedback`): 사이트 안에 확장자 없는 `/feedback` 링크는 **없다**(`contact.html`이 `feedback.html`로 연결해 열림 — 확인함). 손으로 `/feedback`을 치면 새 404 화면이 홈·문의로 안내한다. 별도 변경 없음.
**새 검사** `validate_not_found_page_01.mjs`(등록): nginx 연결(상태 유지 포함) + 페이지 문구·상대 경로 없음 + **nginx가 하는 대체를 흉내 낸 서버**로 깊은 주소를 Chrome에서 열어 휴대폰/PC·밝음/다크/기기 다크에서 스타일 적용·제목 24px·본문 16px·버튼 ≥48px·글자 대비 ≥4.5:1·가로 스크롤 없음·`viewport` 유효를 잰다.
**CI 도커 스모크 보강**(`Static serving smoke test`, 로컬 실행 불가 → **CI에서 처음 돈다**): 없는 주소의 본문이 LOTBI 404이고 `nginx` 글자가 없음, `/404.html` 직접 접속도 404.
**역시험**: nginx 쪽만 되돌리면 / 페이지 쪽만 되돌리면 각각 새 검사 실패, 복원 확인.

## 조각 3 — SITE-CONNECTED-SERVICES-HIDE-01 (소유자 결정 2026-10-11, USER_FIRST 13)

제휴 3곳(RAD·지평선몰·생생장터)이 모두 준비 중이라 입구를 숨긴다. **스위치 하나**: `site-conversation.js`의 `const CONNECTED_SERVICES_MENU_VISIBLE = false;` — true로 바꾸면 세 곳이 모두 돌아온다.
- 데스크톱 서랍의 "연결 서비스", 휴대폰 서랍의 "연결 서비스", 로그인 상태 계정 메뉴의 "연결 서비스" 행.
- 항목은 마크업·계정 메뉴 안에 **그대로 두고** `hidden`으로 숨긴다 → 메뉴 구성을 고정하던 기존 검사(`validate_home_chat.py`, `validate_sidebar_information_architecture_04.mjs`, `validate_consumer_design_shell_01.mjs`, `validate_common_ui_polish_01.mjs`, `validate_profile_menu_*`, `validate_conversation_sidebar_ux_01.mjs`)를 **약화 없이 그대로** 통과. `index.html`의 두 버튼은 `hidden`을 달고 나가 스크립트가 돌기 전에도 번쩍이지 않는다. `.nav-item[hidden]`이 flex 규칙에 지는 문제는 `site-sidebar-nav.css`의 [hidden] 규칙으로 해결.
- Account의 `/connected-services` 페이지는 **손대지 않음**(입구만 숨김).
**새 검사** `validate_connected_services_menu_hidden_01.mjs`(등록): 실제 `index.html`을 Chrome(데스크톱·휴대폰)으로 열어 입구 2개가 `display:none`·0×0·`hidden`이고 이웃 항목(지역정보 등)은 그대로임을 확인하고, **상수를 true로 바꿔 서빙했을 때 둘 다 돌아오는지**까지 확인(되돌릴 수 없는 스위치는 삭제와 같다). 계정 메뉴 행은 실제 스타일시트로 측정한 프로브 행으로 확인(메뉴는 로그인 후 만들어져 이 검사가 만들 수 없음). 역시험: 원래 파일로 되돌리면 실패.

---

## 사용자 시나리오 (사용자 기준 8)

| # | 시나리오 | 이전 | 이후 | 탭 | 막힌 곳 | 사진 |
|---|---|---|---|---|---|---|
| 1 | 어두운 화면 폰으로 구독 안내를 보고 Plus를 고른다 | `/subscribe` → [Plus 시작하기] 글자가 안 보여 **빈 흰 버튼**(대비 1.09:1) | 같은 버튼에 어두운 글자(14.77:1)가 읽힘 | 1(링크) | 없음. 이어지는 결제 단계는 PG 미연동이라 "준비 중"(별개, 변경 없음) | `design/evidence/site-subscribe-dark-contrast-01/BEFORE_AFTER_390_dark_buttons.png` |
| 2 | 테마를 한 번도 안 고른 기기 다크 폰 첫 방문자 | 같은 문제 | 4경로(밝음·명시 다크·기기 다크·속성 없음) 모두 ≥4.5:1 | 1 | 없음 | 같은 폴더 `AFTER_390_dark.png` 외 |
| 3 | PC에서 마우스를 버튼에 올린다 | 글자 안 보임 | hover에서도 읽힘 | — | — | (측정으로 확인) |
| 4 | 밝은 화면 회귀 | 16.1:1 | 16.1:1 그대로 | — | — | `AFTER_390_light.png` |
| 5 | 주소를 잘못 쳤다(휴대폰, 밝음) | 영문 "404 Not Found nginx/1.28.3"만, 로고·돌아갈 길 없음, 글자 깨알 | 마스코트·한 줄 안내·[LOTBI 홈으로 가기] 52px | 1탭에 홈 | 없음 | `design/evidence/site-404-lotbi-01/BEFORE_AFTER_404_390.png` |
| 6 | 같은 일을 어두운 화면에서 | 흰 화면 | 어두운 화면에 읽히는 안내 | 1 | 없음 | 같은 그림 오른쪽 |
| 7 | 깊은 주소(`lotbiai.com/a/b/c`)를 쳤다 | (상대 경로 때문에 스타일이 깨질 수 있었음) | 스타일 유지(절대 경로) | 1 | 없음 | `AFTER_1280_dark.png` |
| 8 | 처음 쓰는 사람이 ☰ 서랍을 연다 | 마지막 줄 "연결 서비스" → 준비 중인 서비스 목록 페이지(account)로 나감 | 그 줄이 없다 — 준비 안 된 곳으로 가는 길 자체가 없음 | ☰ = 1 | 없음 | `design/evidence/site-connected-services-hide-01/BEFORE_AFTER_drawer_390.png` |
| 9 | 로그인한 사람이 계정 메뉴를 연다 | 프로필·개인테마·설정·연결 서비스·도움말·로그아웃 | 연결 서비스 행만 빠짐 | 2 | 없음 | 없음(스타일 프로브로 측정) |
| 10 | 나중에 제휴가 열린다 | — | `CONNECTED_SERVICES_MENU_VISIBLE = true` 한 줄로 세 곳 복원 | — | — | (검사가 true로 서빙해 증명) |

- 모든 상태(사용자 기준 7): 휴대폰 390·PC 1280, 밝음·다크(명시/기기). **실기기·실제 nginx는 NOT TESTED**(아래).

## Account 확인 (같은 문제인지)

- 요청받은 "Account 플랜 업그레이드 다크 대비": **같은 결함 구조가 아니다** — `subscription-panel.module.css`의 버튼들은 `--lotbi-brand-solid-bg`/`--lotbi-brand-solid-text`, `--lotbi-violet`/`--lotbi-on-violet`처럼 **짝 토큰**을 써서 배경이 뒤집히면 글자도 같이 뒤집힌다(코드 확인). 로그인이 필요한 화면이라 QA 사진에도 다크본이 없고, 이번에 **렌더 측정은 하지 않았다**(NOT TESTED). 문제가 보이면 web READY로 따로.
- Account 404("This page could not be found." 영문)는 **다음 web 조각**으로 진행한다.

## 검증 (Windows, 이 PC가 무거워 전체 CI 단계 대신 관련 검사기만 — 제어탑 허락, 검사기 완화 없음)

- 새 3개 검사 PASS(구독 14 · 404 8 · 숨김 10 확인), 각각 역시험.
- 함께 돌린 PASS: `asset_cache_version --check`, `sync_theme_bootstrap --check`, `validate_site.py`, `validate_legal_pages.py`, `validate_hardening.py`, `validate_social_legal_manifest_01.py`, `emit_social_signup_legal_manifest.py`, `validate_accessibility.py`, `validate_static_pages_theme_01.mjs`, `validate_document_cache_policy_01.py`, `validate_nginx_module_mime_01.py`, `validate_brand_official_logo_01.mjs`, `validate_brand_logo_theme_aware_01.mjs`, `validate_ios_input_zoom_01.mjs`, `validate_home_chat.py`, `validate_sidebar_information_architecture_04.mjs`, `validate_consumer_design_shell_01.mjs`, `validate_common_ui_polish_01.mjs`, `validate_profile_menu_improvement_01.mjs`, `validate_profile_menu_personal_theme_01.mjs`, `validate_conversation_sidebar_ux_01.mjs`.
- 이 PC의 기존 실패(이번 변경과 무관, 같은 이름으로 앞서 확인): refresh-route-restore, 소셜 가입 프로필 요약, 모바일 푸터 약관 시트(761px), 아바타 undici, 대화→캘린더.
- 전체 155단계 로컬 실행은 중간(약 20%)에 멈췄고(이 PC 과부하), 나머지는 gate에 맡긴다.

## 못 한 것 · 알려진 한계

- **실제 nginx로는 확인하지 못했다.** 404 화면은 nginx의 대체를 흉내 낸 로컬 서버로 측정했다. 실제 동작은 CI 도커 스모크(위에 보강한 단계)와 배포 뒤 `lotbiai.com/아무주소` 확인으로 닫힌다. **nginx 설정이 바뀌므로 배포방이 사이트 이미지를 새로 올려야 반영된다.**
- 실기기·큰 글씨는 NOT TESTED.
- 사이트의 하단 시트·다크 일부는 아직 파란빛 검정(#121720)이다(디자인 기준 §2.2) — 이번 범위 아님.
