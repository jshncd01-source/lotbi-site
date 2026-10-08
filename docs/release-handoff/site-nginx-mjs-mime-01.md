READY_FOR_DEPLOY=YES

# site-nginx-mjs-mime-01 — release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/site-nginx-mjs-mime-01
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote origin refs/heads/feature/site-nginx-mjs-mime-01`)
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=0a03ca12d3f551c62517a760e20346ee8cf44561 (started from 8a9e414d02d621f67907fcd35a579383b41f8d8e, main merged in normally)
CODE_SHA=ccea00de6a240cd19f9e972ddbe841e7ca85c31d (merge of main 0a03ca12; the fix itself is fa3b7994ab68edb7cadc265261bc142a60b12e2a)
ASSET_VERSION=aset-a5fcb3676cb2 (unchanged — same as main 0a03ca12; this change does not touch any hashed asset)
USER_DECISION_NEEDED=NONE

## SCOPE

- Site 전용, nginx 설정만. Core / Web / App / Admin 변경 없음. Life Wallet branch(`feature/life-wallet-auto-document-crop-site`)와 무관하며 섞지 않았다.
- `nginx/default.conf.template`에 `.mjs` → `application/javascript` 매핑 추가. 기존 location·redirect·try_files·AASA default_type은 그대로.
- `.wasm`은 nginx 1.28 stock mime.types에 이미 `application/wasm`으로 있어 추가하지 않았다(중복 추가 시 nginx가 duplicate extension 경고를 냄). 현재 repo에 .wasm 파일도 없다.

## ROOT_CAUSE

- Production(https://lotbiai.com, Render `lotbi-site-prod`, nginx/1.28.3 alpine 이미지)이 `.mjs`를 `Content-Type: application/octet-stream`으로 응답한다. 이미지의 `/etc/nginx/mime.types`(실제 이미지 tar에서 추출해 확인)에 `mjs` 항목이 없고 http 블록 `default_type application/octet-stream`이 적용된다.
- `site-avatar.js`(type=module)가 `controller.mjs`·`faithful-binding.mjs`·`refinement.mjs`를 정적 import한다. 브라우저는 JavaScript가 아닌 MIME의 module script를 거부하므로 import 하나만 실패해도 `site-avatar.js` 전체가 실행되지 않는다.
- Production 실제 브라우저 확인(2026-10-07, 내장 브라우저 Chromium 152, Desktop): 콘솔 `Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "application/octet-stream"` 6건(페이지 로드 2회 × .mjs 3개), `window.__lotbiSiteAvatar` undefined, `#lotbi-avatar-stage` 자식 0·canvas 0, GLB 요청 없음 → 3D 아바타가 전혀 마운트되지 않고 정적 로고(`data-lotbi-avatar-fallback` img)만 보인다. 즉 "조용한 fallback" 상태.
- 기존 CI static smoke는 `curl --fail`로 200만 확인해서 MIME 문제를 잡지 못했다. SMOKE_CHECKLIST의 "콘솔 에러 없음" 항목도 현재 Production에서는 실제로는 실패 상태다.

## CHANGE

- `nginx/default.conf.template` (server 블록, location 앞):
  ```
  include /etc/nginx/mime.types;
  types {
      application/javascript mjs;
  }
  ```
  server 레벨의 `types` 블록은 http 레벨에서 상속된 map을 통째로 대체하므로 stock 목록을 server 레벨에서 다시 include한 뒤 `mjs`만 더한다. `.js`와 같은 `application/javascript`로 맞췄다.
- `scripts/validate_nginx_module_mime_01.py`(신규, fail-closed): 템플릿을 파싱해 (1) repo에 있는 .js/.mjs/.wasm 확장자가 모두 JavaScript/wasm MIME으로 나가는지, (2) server 레벨 types가 있으면 stock mime.types include도 있는지, (3) location 안 types 블록이 없는지 확인. 변경 전 main 템플릿·include 누락·location 안 types 세 변형에서 FAIL, 수정본에서 PASS 확인.
- `.github/workflows/site-review.yml`: 위 validator step 추가, 컨테이너 static smoke에 `.mjs` 3개 + `site-avatar.js`의 Content-Type이 `(application|text)/javascript`인지 단정 추가.

## BRANCH HISTORY

- fa3b7994 fix(site): serve .mjs avatar runtime modules as JavaScript from nginx (base 8a9e414d)
- ccea00de Merge Ncloud main 0a03ca12 — 충돌 없음(site-review.yml 자동 병합). merge 후 main 대비 차이는 위 3개 파일뿐이고 nginx 템플릿은 fa3b7994와 동일.

## TEST_STATUS

NGINX_T=PASS (nginx 1.28.3 / 1.30.5, 경고 0)
MJS_CONTENT_TYPE=application/javascript (baseline 템플릿: application/octet-stream — Production과 동일하게 재현)
JS_CONTENT_TYPE=application/javascript
JSON_CONTENT_TYPE=application/json (site-asset-version.json, avatar-rig-controls.v2.json, lotbi-clips.v1.json, AASA)
STATIC_REGRESSION=PASS — 40개 응답 중 baseline 대비 달라진 것은 .mjs 4줄뿐. html(/, /about, /privacy, /app/open, /auth/callback/) text/html, /about.html 301 → /about?source=legacy, 없는 경로 404, css text/css, png image/png, webp image/webp, jpg/jpeg image/jpeg, ico image/x-icon, svg image/svg+xml, woff font/woff, woff2 font/woff2, wasm application/wasm, gif, pdf, mp4, robots.txt text/plain, sitemap.xml text/xml 모두 baseline과 동일
WINDOWS_NGINX_RUNTIME=PASS
LINUX_RUNTIME=NOT_TESTED (회사 PC에 Docker/WSL 없음, Ncloud/Production 서버 사용 금지 조건)
NEW_FAILURES=0

Windows nginx 검증 방법 (nginx configuration/MIME mapping 동작 검증으로 기록 — Windows nginx와 Production Linux nginx를 같은 런타임으로 간주하지 않음):
- nginx.org 공식 Windows 패키지 nginx-1.28.3(Production과 같은 버전, 이전 stable branch)·nginx-1.30.5(현재 stable)를 scratchpad에만 받아 nginx.org 개발자 PGP 키로 서명 확인(Good signature). 시스템 설치·PATH·레지스트리·서비스 변경 없음. 검증 후 zip·실행파일·임시 설정 전부 삭제.
- 설정: 실제 Production 이미지(lotbi-site-prod tar, NGINX_VERSION=1.28.3)에서 추출한 `/etc/nginx/nginx.conf`·`/etc/nginx/mime.types`를 그대로 쓰고, 커밋된 템플릿을 그대로 conf.d에 넣음. 테스트 전용 치환은 파일 경로(로그·pid·mime.types·root)와 `${PORT}`(envsubst와 동일), listen 주소를 loopback으로 한정(방화벽 프롬프트 방지)한 것뿐. `user` 줄은 Windows 미지원이라 제거.
- site root = feature HEAD의 `git archive`(이미지 빌드 COPY와 같은 커밋 tree) + stock 매핑 확인용 probe 파일(svg/woff/woff2/wasm/gif/map/pdf/mp4/jpeg).
- 실제 브라우저(로컬 headless Chrome, loopback 외 DNS 전부 차단)로 index.html 로드:
  - baseline 템플릿: module MIME 오류 3건, 아바타 container class 없음, canvas 0 (Production과 같은 증상)
  - 수정 템플릿: module MIME 오류 0, container `avatar-3d-ready`, canvas 1, 하위 모듈 포함 .mjs 7개 요청 모두 200

Repo validators (merge 후 HEAD ccea00de):
- PASS: asset_cache_version.mjs --check(aset-a5fcb3676cb2), validate_site.py, validate_hardening.py, validate_clean_urls.py, validate_ios_social_return_01.py, validate_nginx_module_mime_01.py, validate_container_pin_01.py, validate_build_env_contract_01.py, validate_apple_app_site_association.py, validate_site_avatar_integration.mjs, validate_avatar_refresh_flash_01.mjs, workflow YAML 파싱
- 기존 로컬 RED(main에서도 동일): validate_site_avatar_fallback_runtime.mjs — Node 내장 undici `assert(!this.paused)`. main 8a9e414d와 출력까지 동일.

NOT_VERIFIED / NOT_TESTED:
- Linux nginx 컨테이너(docker build + run) 실행: NOT_TESTED → 배포총괄방 이미지 빌드 후 확인 필요
- Production 배포 후 실제 브라우저: NOT_TESTED (배포 전)
- Mobile Web(Android Chrome / Samsung Internet / iPhone Safari), Android/iOS Native WebView: NOT_TESTED. [추정] 모든 주요 브라우저가 module script에 strict MIME을 적용하므로 현재 Production에서는 같은 방식으로 깨져 있을 것.

## DEPLOY NOTES (배포총괄방)

- nginx 설정은 이미지에 굽혀 있으므로 Site 이미지 재빌드 + Render `lotbi-site-prod` Image URL 교체가 필요하다.
- **asset token이 바뀌지 않는다**(aset-a5fcb3676cb2). 반영 여부를 `site-asset-version.json`으로 판정할 수 없으니 아래로 확인한다.
  - `curl -sI https://lotbiai.com/avatar-runtime/runtime/controller.mjs` → `Content-Type: application/javascript` (현재 `application/octet-stream`)
  - Render live deploy의 image tag = 배포한 sha
- 배포 후 smoke: lotbiai.com 콘솔에 `Failed to load module script` 없음, `window.__lotbiSiteAvatar.snapshot().state`가 `ready`(또는 기기 WebGL 문제면 `fallback` + errorCode), `#lotbi-avatar-stage` 안 canvas 1.
- 캐시: Cloudflare는 .mjs를 `cf-cache-status: DYNAMIC`으로 통과시켜 purge 불필요. nginx가 Cache-Control 없이 Last-Modified/ETag만 주므로, 이미 방문한 브라우저는 heuristic 캐시가 남은 동안(대략 마지막 배포 후 경과 시간의 10%) 예전 octet-stream 응답을 재사용할 수 있다. 같은 train에 asset token이 바뀌는 다른 Site 변경이 함께 나가면 이 영향은 없어진다.
- 참고(변경 안 함): `.glb`·`.webmanifest`·`.map`은 stock 목록에 없어 octet-stream으로 나간다. GLB는 fetch로 읽어 문제 없고, 이번 범위 밖이다.

## USER_ACTION

- 없음. 배포는 배포총괄방(Release & Deploy) 담당.
