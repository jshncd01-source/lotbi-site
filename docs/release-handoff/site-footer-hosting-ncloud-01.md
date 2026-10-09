READY_FOR_DEPLOY=YES

# site-footer-hosting-ncloud-01 — release handoff

REPO=lotbi-site
FEATURE_BRANCH=feature/site-footer-hosting-ncloud-01
FEATURE_SHA=this document's commit (branch HEAD; confirm with `git ls-remote ssh://lotbi-ncloud-git/srv/git/repositories/lotbi-site.git refs/heads/feature/site-footer-hosting-ncloud-01`)
REMOTE_FEATURE_SHA=same as FEATURE_SHA after push (verified with git ls-remote at push time)
BASE_MAIN_SHA=819ead3af6b6b74185519fc74b09b733e7305447 (Ncloud main, 작업 시작 = push 직전 확인 동일)
CODE_SHA=7e7c42aafb4ff0ce158342aa3faf2df4c862ba9e
ASSET_VERSION=aset-e37c99b26fbd (변경 없음 — HTML 문구만 바뀌어 asset 집합 해시 불변, `asset_cache_version.mjs --check` PASS)
DEPLOY_SCOPE=lotbi-site only. Core·Web·Admin·App 무변경
DEPLOY_ORDER=단독. 다른 READY와 순서 무관
MIGRATION=NO
ENV_CHANGE_REQUIRED=NO
SECRET_CHANGE_REQUIRED=NO
CONSENT_HASH_CHANGED=NO (LOTBI_SOCIAL_TERMS_SHA256=c3da41cf… · LOTBI_SOCIAL_PRIVACY_SHA256=c1a0be94… — 운영 Core env 값과 동일)
AUTH_COOKIE_SCOPE_CHANGED=NO
USER_DECISION_NEEDED=약관·개인정보처리방침 2개 페이지 하단 문구와 방침 제6조 6.1 호스팅 행(Render·GitHub) 갱신 시점 — 바꾸면 동의 해시가 바뀌어 Core env 재등록이 함께 필요(이번 작업 범위 밖, 아래 "남은 불일치")

## 변경

호스팅 제공자 표기: `호스팅서비스 제공: GitHub, Inc.` → `호스팅서비스 제공: 네이버클라우드 주식회사 (NAVER Cloud)`

- `index.html`(홈), `subscribe.html`(구독 안내), `refund.html`(구독 철회 및 해지), `exchange.html`(반품 및 교환), `dispute.html`(소비자 분쟁 해결 기준): 하단 사업자 정보 블록 3번째 줄의 호스팅 표기 1줄씩. 사업자정보·연락처·링크·디자인(class·구조) 무변경.
- `scripts/sync_footer_business_info.py`(하단 블록 단일 원본, CI `--check`): 호스팅 줄을 `HOSTING_ROW`로 바꾸고, `privacy.html`·`terms.html`은 `PENDING_RELOCK_HOSTING_ROW`에 넣어 이전 줄을 유지. 이유: 두 파일은 하단까지 포함한 파일 전체가 동의 증빙 해시(`emit_social_signup_legal_manifest.py`, `validate_hardening.py` 잠금, 운영 Core env)라 한 줄만 바꿔도 해시가 바뀐다.
- `scripts/validate_mobile_footer_legal_sheet_01.mjs`: 홈 하단 필수 표기 목록의 호스팅 문구를 새 문구로.
- 손대지 않음: `privacy.html`, `terms.html`(본문·하단 모두), `validate_hardening.py` 잠금 값, `scripts/.placecard-inner.html`(참조 없는 미사용 사본, 배포 페이지 아님), asset token.

## 호스팅 구분 (2026-10-09 22시대 실측)

- 홈페이지 lotbiai.com: DNS A 211.233.198.28 = Ncloud ALB(`lotbi-prod-alb-…kr.lb.naverncp.com`), 응답 `Server: nginx/1.28.3`, www → apex 301. 운영 asset = aset-e37c99b26fbd. → 이번 표기 대상.
- Account account.lotbiai.com: CNAME `…vercel-dns-016.com`, 응답 `Server: Vercel`, `x-vercel-id: icn1::icn1`. Account 하단(lotbi-web `src/components/business-footer.tsx`)은 이미 `호스팅 서비스 제공: Vercel` → 사실과 일치, 무변경. Account Ncloud 자체 호스팅(`account-ncloud-selfhost-01-web`)으로 옮기는 날 그 문구도 같이 바꿔야 한다.

## 남은 불일치 (보고만, 이번 작업에서 변경 안 함)

1. `privacy.html`·`terms.html` 하단: 여전히 `호스팅서비스 제공: GitHub, Inc.` — 동의 해시 보호 때문에 의도적으로 남김.
2. `privacy.html` 제6조 6.1 국외이전 표 `Render Services, Inc.`(싱가포르) 행: "애플리케이션 서버 및 데이터베이스 호스팅(처리위탁)". 실제로는 10-09 19시 Core·DB가 NAVER Cloud(국내)로 전환됨.
3. `privacy.html` 6.1 표 `GitHub, Inc.`(미국) 행: "공식 웹사이트(lotbiai.com) 호스팅 및 콘텐츠 전송(GitHub Pages), 서비스 소스코드 형상관리 및 배포". 실제 홈페이지 호스팅은 NAVER Cloud, 저장소·merge gate는 Ncloud Git. GitHub를 아직 다른 용도로 쓰는지는 확인 안 함.
4. `privacy.html` 6.1 표 `Vercel Inc.`(미국) 행: account.lotbiai.com 호스팅 — 현재 사실과 일치(icn1 실행). Account를 Ncloud로 옮기면 갱신 대상.
5. 국내 수탁자(NAVER Cloud) 처리위탁 고지는 방침에 아직 없음.
위 2~5를 고치면 privacy 본문이 바뀌므로 `LOTBI_PRIVACY_*` version·SHA256 재등록(Core env)과 `validate_hardening.py` 재잠금이 같이 필요하다. 그때 1번 하단 줄도 `PENDING_RELOCK_HOSTING_ROW`에서 지우고 `--write`로 함께 맞춘다.

## 검증

- `python scripts/sync_footer_business_info.py --check` PASS (7 pages, privacy·terms는 예외 줄로 일치).
- `python scripts/validate_hardening.py` PASS (잠금 값 무변경).
- `python scripts/emit_social_signup_legal_manifest.py`: TERMS c3da41cf…, PRIVACY c1a0be94… = main·운영 Core env와 동일.
- `node scripts/asset_cache_version.mjs --check` PASS (aset-e37c99b26fbd).
- 회귀: `.github/workflows/site-review.yml` + `legal-pages-review.yml`의 run 단계 전체 139개를 Windows 로컬에서 실행(운영 CORS 호출·docker smoke 2단계 제외) → **137 PASS / 2 FAIL**. 실패 2개는 main 819ead3a 깨끗한 worktree에서도 같은 오류로 실패 → **NEW_FAILURES=0**.
  - `Validate mobile footer legal sheet`: `761px: mobile disclosure leaked into desktop` (main 동일). 이 실패 지점 앞의 필수 표기 검사(휴대폰 하단 시트·JS 없는 화면 모두 새 호스팅 문구 포함)는 통과함.
  - `Validate terminal Avatar fallback in browser`: undici `assert(!this.paused)` (main 동일, Windows 환경).
- 로컬 화면(Chrome, 이 worktree 정적 서빙): 구독 안내 800px — 하단 3줄 모두 한 줄, 가로 넘침 없음. 360px — 다른 두 줄처럼 3번째 줄도 두 줄로 줄바꿈, 가로 넘침 없음(scrollWidth 360). 홈 1280px — 접힌 안내를 펼치면 새 문구 한 줄로 표시.
- Production NOT TESTED (배포 전). 실기기 NOT TESTED.
