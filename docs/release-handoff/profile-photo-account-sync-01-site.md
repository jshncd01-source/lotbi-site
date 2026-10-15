READY_FOR_DEPLOY=YES

# profile-photo-account-sync-01-site — release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/profile-photo-account-sync-01-site
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ssh://lotbi-ncloud-git/srv/git/repositories/lotbi-site.git refs/heads/feature/profile-photo-account-sync-01-site`)
REMOTE_FEATURE_SHA=same as FEATURE_SHA after push (verified with git ls-remote at push time)
BASE_MAIN_SHA=8a9e414d (작업 시작) → Ncloud main 0a03ca12 merge(0f5e5eb0) → main a87aafb97fa6ae665518afa52e4d9800eb628017 merge(af548eee)
CODE_SHA=af548eee3e76a4446ec65fa22c73a53fe498b317
FEATURE_CODE_COMMIT=7d9d7cb1f52b34145ff8c9790f0276780bb2d0ba (기능 코드; CODE_SHA는 main을 merge한 결과)
ASSET_VERSION=aset-bb709c0dc32e
DEPLOY_SCOPE=lotbi-site (같은 기능: lotbi-core / lotbi-web / lotbi-app `feature/profile-photo-account-sync-01-*`)
DEPLOY_ORDER=CORE 먼저 → SITE (WEB / APP과는 순서 무관)
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
USER_DECISION_NEEDED=NONE
SUPERSEDES=lotbi-web `feature/profile-photo-saved-close-01-web`(READY_FOR_DEPLOY=NO로 변경됨 — 기기 저장 전제라 단독 배포 금지)

## 변경

- `site-core.js`
  - `getCurrentSiteUser` → `profilePhoto`(Core `/v2/me`의 `profile_photo`에서 version `mda_…`만 받음, 형식이 틀리면 null — 로그인은 막지 않음). 이미지 경로는 Core가 준 값이 아니라 Site 상수 `/v2/account/profile/photo/content`로 만듦.
  - `saveSiteProfilePhoto` PUT, `deleteSiteProfilePhoto` DELETE, `fetchSiteProfilePhotoObjectUrl` GET `/content?v=` (Bearer, `cache:'no-store'`, `credentials:'omit'`, `image/jpeg`만 받아 `URL.createObjectURL`). data URI는 `data:image/(jpeg|png|webp);base64,`만 보냄.
- `site-conversation.js`
  - preferences에서 `photo` 제거. 이전 버전이 localStorage에 남긴 `photo`는 로드 시 즉시 삭제(purge).
  - 사진은 메모리 object URL만 보관(version key, generation 가드, 교체·로그아웃 시 revoke). 로그인 상태가 바뀌면 지우고 새 session의 사진으로 다시 읽음.
  - picker: 선택 → Core 저장 → 서버 사본을 다시 읽어 미리보기·사이드바 아바타 갱신 → 그 다음에만 Account에 `lotbi:profile-photo-saved {version}` postMessage(embed) 또는 "프로필 사진을 저장했습니다." 표시. 실패 시 "프로필 사진을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요."(창 유지). 저장 중 버튼 잠금.
  - "사진 삭제" 버튼(`.profile-photo-remove`, 사진 없으면 숨김) → Core DELETE 성공 후 `lotbi:profile-photo-deleted`.
- `site-conversation.css`: 삭제 버튼 스타일.
- validators: `validate_profile_menu_personal_theme_01.mjs`(새 계약: fake Core PUT/DELETE/content, 실패 시 메시지, localStorage에 사진 없음), `validate_conversation_integration.mjs`(identity에 `profilePhoto: null`), 신규 `validate_profile_photo_account_sync_01.mjs`(site-review.yml "Validate account-wide profile photo").
- main merge 2회: asset token만 다른 hunk는 main 쪽 채택 후 `asset_cache_version.mjs --write`, 실제 충돌 hunk(site-conversation.js import 블록, site-consumer-sections.js, site-life-wallet-scan-ui.js)는 main import + 이 branch의 profile photo 함수 3개만 유지.

## 보안

- 사진·URL·token을 localStorage/sessionStorage에 저장하지 않음(object URL은 메모리, 페이지 종료 시 소멸).
- 요청자는 자기 session의 사진만 받음(Core가 version이 아닌 session 소유자로 조회).
- postMessage target origin은 기존 `ACCOUNT_MANAGE_ORIGIN`(account.lotbiai.com) 고정, 서버 저장·삭제 성공 후에만 보냄.

## 검증

- `validate_profile_photo_account_sync_01.mjs`, `validate_profile_menu_personal_theme_01.mjs`, `validate_conversation_integration.mjs`, `asset_cache_version.mjs --check` PASS.
- site-review / universal-life-calendar workflow의 node/python 명령 전체: 208개 중 204 PASS / 4 FAIL — 4개(`validate_calendar_system_dark_01`, `validate_image_attachment_thumbnail_01`, `validate_mobile_footer_legal_sheet_01`, `validate_site_avatar_fallback_runtime`) 모두 main a87aafb9 worktree에서도 같은 메시지로 실패(기존 RED, Windows 로컬). NEW_FAILURES=0.
- 실 브라우저(Chrome CDP, https origin 대행) + 로컬 실 Core:
  - picker 저장 → Core에 저장(version 확인) → 미리보기·사이드바 아바타(256px)가 Core 사본, localStorage에 이미지 없음.
  - 새로고침 → 같은 계정 사진(Core), localStorage 여전히 없음.
  - Account embed(390×844, 1280×900): 다른 기기에서 교체 후 picker `saved` → 창 닫힘, 새 version 아바타, "프로필 사진을 저장했습니다."
- cross-client API E2E A~G·보안 PASS (Core 문서 참고).

## 알려진 한계

- 이전 기기 저장 사진은 옮기지 않고 삭제 — 한 번 다시 올려야 함.
- 실기기 iPhone Safari / Android Chrome / Samsung Internet NOT TESTED(Chrome viewport emulation만).
- Production NOT TESTED(배포 전).

## 금지 사항 준수

main 직접 push / force push / rebase / reset 없음. merge gate·Production 배포는 Release Control 담당.
