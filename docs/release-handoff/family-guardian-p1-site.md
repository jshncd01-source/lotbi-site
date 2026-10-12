READY_FOR_DEPLOY=YES

# 가족 지킴이 ① 이름·디자인 — Site 검증 기록

## 2026-10-12 사용자 최종 시안·필수 5장 반영 재READY — 현행

- `READY_FOR_DEPLOY=YES`, `FULL_FUNCTIONAL_COMPLETE=NO`, `PRODUCTION_VERIFIED=NO`.
- 저장소/브랜치: `lotbi-site` / `feature/family-guardian-p1-01-site`. 승인 디자인 코드 HEAD `836df7f1ce3560bda064ea86923a039de9542097`; 기준 Ncloud `main` `16826d4a0174b6ec6b5b1d61d06af6554d8d4e38`을 정상 merge했다. 문서 커밋 이후 최종 branch exact SHA와 Ncloud readback은 Work 최종 인계표에 기록한다.
- 최종 사용자 판정: 기본 등록은 얼굴 3장+상반신·전신 2장, 총 5장이다. 최대 10장은 인식 도움을 위한 선택 추가 용량이며 기본 화면에 10장 예시를 펼치지 않는다. 최초 화면에는 동일한 가상 인물의 예시 5장만 보이고, 사진을 고르면 해당 칸이 사용자의 실제 등록 사진으로 바뀐다.
- 디자인: 가족 지킴이 라이트 콘텐츠 배경 `#F6F7F9`, 카드·입력은 흰색, 파란색은 강조에만 사용한다. 넓은 파란 배경·그라데이션·빛 번짐을 제거했고 다크 테마와 경고·오류·완료 의미색은 보존했다. 가족 지킴이 외 카테고리·Account·인증 전역 스타일은 변경하지 않았다.
- 기능 보존: 실제 등록번호·이름·생년월·사진·버튼·개인정보 권한을 서버 응답에서 표시하며 시안의 예시 번호/사람을 운영 값으로 하드코딩하지 않는다. 새 DB/Core 변경과 빈 커밋은 없다.
- Site 검사기 `scripts/validate_family_guardian_design_01.mjs`는 `.github/workflows/site-review.yml`에 등록했고 Chrome profile은 실행 직전 `mkdtemp`로 만든다. `site-family-guardian.css`는 `index.html`과 `auth/callback/index.html`에서 `site-safecare.css` 바로 뒤에 같은 순서로 로드된다.
- 검증: 가족 화면 브라우저 360/1280 × light/dark/system/bootstrap 18조합 PASS, 사진 쉬운 등록 360/1280 PASS, 사진 일괄 등록 360/390/412/1440 PASS, 최신 홈 즐겨찾기 360/1280 light/dark PASS, JS 구문·diff·자산 cache write/check `aset-a8e953bc0e0f` PASS.
- 스크린샷: `outputs/screenshots/site/family-guardian-approved-design-p1-20261012/` 432 PNG. 모듈 가상 응답 화면이며 전체 운영 사이드바·실제 사용자 저장 성공을 뜻하지 않는다.
- 승인 원본 6장(구조·문구 참고, 배경은 `#F6F7F9` 지시 우선):

| 파일 | SHA-256 |
|---|---|
| `ChatGPT 이미지 2026년 10월 12일 오후 05_44_09.png` | `97dfdfad4116478f11a4dc5ef684584398dd6cc7a886a7196988d83259f80611` |
| `ChatGPT 이미지 2026년 10월 12일 오후 05_44_20.png` | `45c7165cd0c95fedd02c03197e5b2743e16f11e9d328b52d255c9b9244f6c7db` |
| `ChatGPT 이미지 2026년 10월 12일 오후 05_44_38.png` | `2dc2ffae59be71b95181095b75ea41ddb978987b11113cab16bb49ac2409c03c` |
| `ChatGPT 이미지 2026년 10월 12일 오후 05_44_50.png` | `6538eb11ba1f54d5a440c87143066a81fb069d8b11bf55b486a09811fad6cb53` |
| `ChatGPT 이미지 2026년 10월 12일 오후 05_45_12.png` | `76f63dc79e7a9ddea74e0baa64833e58adddcc0321ec790389f153b5dbac38d1` |
| `ChatGPT 이미지 2026년 10월 12일 오후 05_45_22.png` | `6c53b9ff2ecb715c51ce96d44aa731d98110dbfe25750cb71ff0c661e8c2f22b` |

- 원본 경로: `C:/Users/jshnc/OneDrive/문서/카카오톡 받은 파일/`. 기존 ZIP·과거 PNG·과거 READY 기록은 보존한다.
- `p0_0120`은 ①에서 사용하지 않으며 Core/DB 변경 없음. main 병합·Production 배포·Play 업로드 없음.
- 운영 E2E: 배포 후 배포방:

## 2026-10-12 시스템 다크 수정 재READY — 현행

- READY_FOR_DEPLOY=YES, FULL_FUNCTIONAL_COMPLETE=NO, PRODUCTION_VERIFIED=NO. 아래 “재검증 중”은 수정 커밋 작성 당시 기록이며 이 절이 현행이다.
- 수정 기능 코드 HEAD b54727143. fresh Ncloud main 29cc6b13a7e081dda6a224717f50d0efcfa53e25 포함 확인. 문서만 갱신한 최종 exact HEAD·push/readback은 Work outputs/family-guardian-system-dark-reready-2026-10-12.md에 기록한다.
- 기존 validate_safecare_person_dark_cancel_01.mjs 원문/기준 변경0, 단독 PASS: 390/1280 light·dark·system-dark 모든 대비 위반0, 등록 취소/계속/재개/삭제 보호3조건 PASS.
- 가족 검사 PASS: 360/1280에서 light, dark, system-light, system-dark, light/OSdark, dark/OSlight, bootstrap-dark, bootstrap-system-dark, bootstrap-light/OSdark의18조합. 실제 화면모듈·가상 API이며 실기기/운영 성공이 아니다.
- 전후 보존: outputs/screenshots/site/phase1-system-dark-fix-before-7210/ 44PNG (시스템다크), outputs/screenshots/site/phase1-system-dark-fix-after-20261012/ 432PNG (18조합). 기존 전후96장·원본 ZIP도 보존했다. 대표 목록 before/after를 실제 이미지로 읽어 밝은 배경/흰 글자 문제가 사라졌음을 확인했다.
- common-ui-polish02 10계약, consumer-shell source, cache write/check aset-1c1a6c9533f2·refs208 PASS. media selector 파서 보완 및 새 테마 assertion은 강화이며 검사 삭제/skip/완화 없음.
- 관련 법적 문구3곳, Native/iOS·실제 저장/재조회·반려동물 별도 알림·기준14 운영 E2E의 미검증은 종전 그대로다. 기존 화면 확인용 후보의 범위를 확대하지 않는다.
- Ncloud feature만 push, main merge/Production/DB/Secret/Play 업로드 없음. 배포총괄은 새 exact HEAD의 기존 trusted gate를 재실행해야 하며 Gate PASS/배포는 NOT_VERIFIED다.
- 운영 E2E: 배포 후 배포방:

## 2026-10-12 시스템 다크 Gate RED 반환 — 재검증 중

- 과거 7210caf1의 화면 확인용 READY는 Gate run 20261012T015817Z-567185-1240611897의 실제 대비 실패로 개발방에 반환됐다. 이 절이 현행 상태다. 운영방 보고의 main/Production 미변경은 LAST_REPORTED이며 Work가 배포한 것이 아니다.
- 같은 validate_safecare_person_dark_cancel_01.mjs를 수정 전 실행해 light/dark 0건, system-dark 두 폭 합계520건 실패를 재현했다. 대표 fg245/245/245 대 bg246/247/249 ratio1.02와 흰 카드 ratio1.09다.
- 원인: body:not([data-site-theme="dark"])가 system 및 부트스트랩 다크에도 라이트 토큰/흰 배경을 덮었다. 명시적 light 또는 OS light의 자동/기본 테마에만 가족 라이트 규칙을 적용하도록 고쳤다. 기존 공통 다크 토큰, 문구/레이아웃/사진/권한/다른 카테고리는 보존했다.
- 수정 후 같은 기존 validator: 390/1280 light/dark/system-dark 모든 화면 대비 위반0, 360dark/412system-dark/1280light 등록 취소·계속·재개·삭제 보호 흐름 PASS. 기존 검사 assertion과 WCAG 기준을 변경하지 않았다.
- 가족 검사에 OS 반대 명시 테마, 시스템 light/dark, body 적용 전 부트스트랩 테마를 추가했다. media 블록 안쪽 selector도 기존 동일한 dark 제외/family 범위 assertion으로 검사하도록 파서를 보완했다. 새 조건은 추가하며 삭제/skip/완화하지 않는다.
- 기존 원본 ZIP/PNG 보존. before는 D:/LOTBI-WORK/fg-evidence-sd7210의 7210caf1 실제 CSS로 촬영한 system-dark 360/1280 44PNG, 캡처 harness만 현행 테마 설정을 사용했다. 일반 동작 PASS는 대비 PASS가 아니며 before의 대비는 FAIL이다. 경로 outputs/screenshots/site/phase1-system-dark-fix-before-7210/.
- 360/1280 9테마 설정씩18조합 회귀·새 after 캡처는 진행 중이다. 모두 통과 후 최종 SHA와 READY를 별도 갱신한다.
- 운영 E2E: 배포 후 배포방:

## 2026-10-12 배포 레일 재READY — 현행 화면 확인용 판정

- READY_FOR_DEPLOY=YES는 확정 화면을 먼저 확인하는 공동 후보의 개발 READY다. FULL_FUNCTIONAL_COMPLETE=NO, PRODUCTION_VERIFIED=NO. 아래 과거 NO/보류 문구는 이전의 전 항목 완료 기준과 당시 SHA 기록이며 이 절이 현행 판정이다.
- 사용자 원문(배포 총괄 관리방 2026-10-12) “레디의 조건을 너무 엄격하게 하지마 … 시안 확정되면 배포해”, “사이트에 문제가 있으면 그때 가서 수정하자”를 read_thread의 userMessage로 직접 확인했다. 배포방의 정정 기준인 확정 디자인·기본 빌드/진입·최신 main·관련 최소 검사와 보안/데이터 보존을 적용한다. 검사 삭제/완화나 실패 은폐가 아니다.
- 저장소/단계: site 01, branch feature/family-guardian-p1-01-site. fresh main 29cc6b13a7e081dda6a224717f50d0efcfa53e25를 정상 통합/포함 확인. 기능 검증 코드 HEAD 64bb9da33d5d81bcafade917dc3bb806b971e7fb; 이후 문서만 바뀐 최종 exact HEAD·Ncloud push/readback은 outputs/family-guardian-screen-ready-2026-10-12.md에 기록한다.
- 이번 기본 검사: 새 Site main 정상 merge·캐시 동일성 검증과 표시명/CSS9 hunk의 양쪽 변경 보존. 사기·피싱 확정 이름/디자인과 가족 지킴이 모두 유지. 새 360/1280 light/dark4 PASS·PNG96, common-ui-polish/consumer-shell PASS, cache aset-a43450507728/check208 PASS. 경로 outputs/screenshots/site/phase1-rail-main-after-20261012/.
- Site8766, Admin5182·5183·5184, Account3107 기존 서버의 기본 HTTP 진입200 확인. HTTP200을 사용자 목적 전체 성공으로 표현하지 않는다. Core의 관련 pytest/TestClient는 LOCAL_TEST 기본 startup/API 검사이고 Production 시작 성공이 아니다. App renderer·번들/네이티브 컴파일은 실제 폰의 기본 진입 성공과 다르다.
- CORE①·② 단독 선배포 금지. ①→②→③ 순서, 해당 단계의 Core/Admin/Site/App/Account 공동 exact HEAD를 함께 제출한다. 이 조건은 변경하지 않는다.
- iOS 및 모든 실기기/부가기능 미검증을 화면 확인용 후보의 일괄 차단 사유로 삼지 않는다. 그러나 iOS NOT TESTED·과거 RNSVG pods FAILURE·Android after/dark NOT TESTED를 PASS로 바꾸지는 않는다. 현재 exact-head 외부 CI/trusted gate는 별도 NOT VERIFIED이며 배포방이 정상 gate를 수행해야 한다.
- 후속 필수 목록: ② Site→시험 Core→Admin 실제 저장/재조회, App Native 사진/수정·갱신; ③ 반려동물 별도 관리자 알림 및 Site/App→Core→Admin→사용자 종료→기존 사진 URL 차단 전체 연결. 접수함 건수·화면 존재를 알림/E2E PASS로 보고하지 않는다. 이 목록 완료 전 서비스 전체 완료를 선언하지 않는다.
- Core③ 사전 권한 검사(미동의/타인/비담당/종료 후 직접 URL 403)는 유지한다. 새 데이터 공개/자동 매칭 활성화 없음. p0_0120 미사용, p0_0121 기존 배정만 사용. 운영 DB·Secret·결제·소셜 공개·Play/AppStore 공개·휴대폰 설치/삭제 변경 없음.
- 법적 명칭3곳은 별도 승인 전 기존 문구 유지. 새 배경은 가족 light #F6F7F9·흰 카드/입력·파란 강조, 기존 dark/의미색·다른 카테고리/Account 인증 보존. ZIP 원본·기존 PNG·과거 문서는 덮어쓰지 않는다.
- 운영 E2E: 배포 후 배포방:
- 다음 owner: 배포 총괄 관리방으로 공동 READY 인계. Work는 feature push/readback까지만, main/Production/내부 release APK/Play 내부 테스트(매회 소유자 승인)는 배포 담당자의 영역이다. 새 검사/권한을 우회하지 않는다.

## 이하 이전 체크포인트 — 현행 판정과 분리


## 2026-10-12 재개 검증 — 현행 판정

이 절이 현재 상태이며 아래 2026-10-11 절의 SHA·검사 수·보류 사유는 과거 체크포인트다. 과거 완료분은 보존하되 현재 exact-head 검증 또는 배포 완료로 확대하지 않는다.

- 기존 브랜치 feature/family-guardian-p1-01-site 재사용. fresh Ncloud main: 9147419fb079e6452ff26d82c52a1b8f1dca36e4.
- 이번 기능 검증 코드 HEAD: b1cd7340dde52b9dc275191b762335e70236fe97. 이후 문서만 변경한 최종 exact SHA와 Ncloud push/readback은 Work 산출물 outputs/family-guardian-resume-2026-10-12.md에서 확인한다. 자기 문서 커밋 SHA를 추정해 기록하지 않는다.
- 최신 T57a3 포함 main을 정상 merge했다. 88개 충돌 파일의 캐시 버전 문자열만 정규화해 동일성을 검사한 뒤 128개 cache-only hunk를 해결했다. index/auth callback의 CSS 2 hunk는 양쪽 로드 목록과 가족 CSS를 같은 순서로 보존했다. 기능/인증 변경을 한쪽 파일로 덮어쓰지 않았다.
- 기존 가족 검사·동작 계약 PASS, 360·1280 라이트·다크 4조합 PASS. 새 PNG96장: outputs/screenshots/site/phase1-fresh-main-after/. 이전 before/after 원본 보존.
- 캐시 write/check PASS: aset-58bd1f7cb22a, 208개 참조 검사. LF·diff/conflict marker 확인 PASS. .github/workflows/site-review.yml 등록과 실행 직전 mkdtemp 유지.
- 관리자 17번째 증거의 회원 등록 요약 GUI는 이번 Admin②·③ v2 폴더로 보완했다. ①의 반려동물 요약과 ②의 사람 요약을 구분한다. App Native 증거가 남아 공동 ① READY는 NO다.
- 새 GUI manifest: outputs/family-guardian-component-evidence-fresh-main-20261012.json 및 family-guardian-component-evidence-members-fresh-main-20261012-v2.json. 초기 v1 회원 캡처는 긴 모달/빈 영역을 포함해 보존만 하며 현행 판정에 사용하지 않는다.
- Admin 자체 다크 전환은 기존 구조상 미지원이다. OS dark 설정의 화면 확인을 다크 테마 구현 PASS로 표현하지 않는다. 웹 폭 에뮬레이션은 Native 실기기 검증이 아니다.
- 전체 단계 READY는 NO다. Core·Admin·Site·App·Account가 해당 단계 모두 READY여야 한꺼번에 배포한다. Core①·②만 선배포 금지. T57b5c42a38e 선행 조건 취소 유지.
- Work 종료점은 feature 검증·문서 커밋·Ncloud push/readback이다. READY 완료 후 배포총괄 관리방으로 전달하며 실제 운영 반영방에 직접 실행 지시하지 않는다. main 병합·Production·Play 업로드 없음.
- 휴대폰 조작·설치·삭제·로그아웃은 이번 재개에서 실행하지 않는다. 최신 검증 내부 APK는 배포방 제작, Play 내부 테스트 업로드는 매회 소유자 승인. 공개 출시 없음. iOS Native는 NOT TESTED다.

### 다섯 저장소 검색 결과 (2026-10-12 실행 소스 재확인)

| 저장소 | 바꾼 곳 | 일부러 남긴 곳과 이유 |
|---|---|---|
| Core | 사용자 답변·푸시·구독 설명, 실행 소스 옛 이름 0건 | 옛 질문 입력/부정 assertion·역사 문서·내부 safecare 식별자: 호환·회귀 보존 |
| Admin | 메뉴·서비스명·일반 안내, src 옛 이름 0건 | 역사 문서·검색표 자체. 신고 전 최소 요약 경계 유지 |
| Site | 메뉴·제목·일반 안내·구독·접근성 | terms.html 1곳 및 식별 사진/법정대리인 동의 2곳은 별도 정책 승인 전 보존. 실행 JS 주석 9곳·과거 문서·legacy fixture도 보존 |
| App | 메뉴·제목·버튼·접근성·구독, src/packages 옛 이름 0건 | 구버전 구독 응답 fixture 7곳·과거 문서: 호환 원문 보존 |
| Account | 요금제·구독·등록 용량 설명, src 옛 이름 0건 | 과거 문서·검색표 자체. 인증 owner의 디자인/기능 보존 |

저장소 전체 검색 0건 주장이 아니다. 개인정보 정책·약관·동의 계약은 승인 없이 치환하지 않았다. 사진·권한·자동 매칭·위치 동의·의미별 상태색·다른 카테고리 및 인증 배경을 보존한다. 운영 E2E 기입란은 아래 빈칸 그대로 유지한다.

## 이하 2026-10-11 이전 체크포인트 — 역사 기록


## 식별자·역할

- 담당: Work / Codex. 기존 owner 작업을 보존한 ① Site 담당 브랜치.
- 브랜치: `feature/family-guardian-p1-01-site`.
- 기준 Ncloud main: `b09f6e4d21096a4f897d5ba82b958fc5dc384d35`.
- 배포 대상 exact HEAD와 원격 readback은 Work 산출물 `family-guardian-work-status-2026-10-11.md`에 기록한다. 이 문서가 포함된 커밋까지 대상이다.
- T57b `5c42a38e`는 배포총괄 지시로 취소됨. 해당 커밋을 main에 요구하거나 별도로 배포하지 않는다.
- push 직전 최신 Ncloud main 정상 merge. rebase·force-push·main 직접 변경 없음.
- migration: 없음. 배경 변경을 위해 Core·DB·빈 커밋을 만들지 않았다.

## 변경·보존

- 메뉴·제목·일반 안내·접근성·구독 설명의 표시명만 가족 지킴이로 변경.
- 새 `site-family-guardian.css`: 가족 지킴이 라이트 콘텐츠만 #F6F7F9, 카드·입력 흰색, 주요 버튼·선택 탭·링크 파란색. 공통 consumer 버튼보다 우선하는 가족 범위 규칙을 실제 index 진입에서 확인.
- 기존 다크 테마·상태 의미색·레이아웃·사진·버튼 동작·필수 조건을 보존. ZIP의 푸른 배경을 복제하지 않는다.
- 비로그인 사람/반려동물에 안내와 로그인 링크를 표시한다. 개인정보 관리자 mount와 대상 API 요청을 하지 않는다.
- 두 진입점 index.html/auth/callback/index.html에서 safecare CSS 다음에 동일 순서로 로드.
- 일반 캐시 참조 변경은 다른 카테고리의 디자인·기능 변경이 아니다. 자산 버전 생성기가 관련 import/HTML 참조를 일괄 갱신한다.

## 테스트

- `validate_family_guardian_design_01.mjs`: 360·1280 라이트·다크 4조합 PASS. gate에 등록, Chrome 실행 직전 mkdtemp.
- 기존 redesign 행동 검사를 삭제·완화하지 않고 완료·정보 수정·신고 캡처를 추가했다. 가상 사진의 로컬 흐림 검사를 실제로 실행하며 서버의 사진 승인 응답은 fixture이므로 서버 사진 인식 성공을 주장하지 않는다.
- 사진 일괄 업로드: 360·390·412·1440 PASS. 필수 사진/삭제/발견 제보/신고 회귀 보존.
- pet family web, consumer design shell/detail, common polish 02, trusted-device plan limits, clean URLs, iOS social return 계약 PASS.
- 자산 캐시 `--write` 후 `--check` PASS, LF·diff 검사 PASS.
- 로컬 실제 index의 /#care·/#pets 비로그인 직접 진입 전후 360·1280 라이트·다크 PASS. 외부 네트워크 차단, 운영 데이터 사용 없음.
- Linux trusted gate 실행 결과는 NOT VERIFIED. 로컬 Chrome 결과와 CI PASS를 혼동하지 않는다.

## 전후 화면 적용표

경로 기준: Work 산출물 `outputs/screenshots/site/phase1-{before|after}/`. 각 파일은 `{mobile-360|desktop-1280}-{light|dark}-` 접두사를 갖는다. 24개 캡처 상태×4조합 = 전 96장·후 96장. 24장은 필수 17개 화면 수가 아니라 추가 회귀 상태를 포함한 캡처 수다.

| 화면 단위 | PNG 뒤쪽 이름 | 확인 환경 |
|---|---|---|
| 공통 홈·목록 | person-01-list, pet-01-list | 실제 화면 모듈·가상 API |
| 사람 기본정보 | person-03-register-step1 | 동일 |
| 사람 사진 등록 | person-05-register-step2 | 동일 |
| 사람 최종 확인 | person-08-confirmation | 동일 |
| 사람 등록 완료 | person-09-complete | 동일 |
| 사람 사진 관리 | person-02-photos | 동일 |
| 사람 정보 수정 | person-10-info-edit | 동일 |
| 사람 실종 신고 | person-05-sos-form | 동일 |
| 반려동물 기본정보 | pet-04-register-step1 | 동일 |
| 반려동물 사진 등록 | pet-06-register-step2-photos | 동일 |
| 반려동물 최종 확인 | pet-08-confirmation | 동일 |
| 반려동물 등록 완료 | pet-09-complete | 동일 |
| 반려동물 사진 관리 | pet-10-photos-and-info-edit | 기존 동일 상세 화면 재사용 |
| 반려동물 정보 수정 | pet-10-photos-and-info-edit | 기존 이름 수정 영역, 신규 독립 화면 아님 |
| 반려동물 실종 신고 | pet-11-sos-form | 실제 화면 모듈·가상 API |
| 관리자 회원별 등록 현황 | Admin 담당 MemberDirectoryPage 증거 보완 필요 | NOT VERIFIED |
| 관리자 접수 상세·사진 열람 | admin/admin-{before|phase1|phase2|phase3}/person-detail-{360|1280}-{light|dark}.png | 실제 컴포넌트·가상 입력. 사진 표시는 ③에서 추가됨 |

실제 Site index 비로그인 직접 진입은 별도 `site/site-live-{before|after}/{care|pets}-{360|1280}-{light|dark}.png`.

## 시나리오

| 시나리오 | 입력·탭 | 결과·막힌 지점 | 환경 |
|---|---|---|---|
| 비로그인 직접 진입 | /#care 또는 /#pets 입력, 개인정보 입력 없음 | 안내·로그인 링크 표시, 사적 API/mount 0건 | 실제 index + Chrome |
| 로그인 사람 목록·등록 | 가상 목록→등록 1회, 가상 이름·출생·동의·필수 사진 5장→최종 확인→완료 | 값과 기존 단계 동작 보존. 실제 인증/서버 사진 판정은 이 검사의 범위 밖 | 기존 화면 모듈 + fixture |
| 반려동물 전환·등록 | 반려동물 화면→등록 1회, DOG·가상 이름·동의·사진 5장→확인→완료 | 흰 카드/청회색 콘텐츠, 다크 유지, 완료 후 기존 안내 닫기 | 동일 |

## 다섯 저장소 안심케어 검색 결과표

| 저장소 | 바꾼 곳 | 의도적으로 남긴 곳·이유 |
|---|---|---|
| Core | 대화 답변·푸시·구독 설명 | 구버전 입력 호환 테스트·과거 문서, 내부 safecare API/DB 식별자 |
| Admin | 메뉴·서비스명·일반 운영 안내 | 검색표 자체·과거 기록. 사용자 코드 표시 잔여 없음 |
| Site | 메뉴·제목·일반 안내·구독·접근성·관련 명칭 검사 | terms.html 1곳 및 동의 계약 2곳은 별도 승인 전 유지. 주석·과거 문서·legacy fixture·변경 전 캡처 기준은 역사/회귀 보존 |
| App | 메뉴·제목·버튼·접근성·구독 | legacy 구독 응답 fixture·과거 문서 |
| Account | 요금제·구독 설명·새 main 용량 표시 충돌 해결 | 검색표 자체·과거 문서. 사용자 코드 표시 잔여 없음 |

법적 문구 승인 후보: terms.html의 프로필 이름 1곳, site-safecare-renewal-notice.js의 식별 사진 처리·법정대리인 동의 이름 2곳. 의미·제공 범위를 변경하지 않더라도 계약 문구이므로 자동 치환하지 않는다.

## 보류·인수인계

- ① 전체 단계 READY가 아니다. 관리자 회원별 등록 현황 증거와 App 대응표·Android/iOS 화면 검증 환경 증거를 별도로 완료해야 한다.
- 모바일 폭 에뮬레이션은 Android Native/iPhone Safari/iOS Native 실기기 성공이 아니다.
- ② 등록번호·실제 서버 저장/재조회·갱신일 보장, ③ 신고 권한 전체 연결은 해당 단계에서 별도 검증한다.
- main 병합·운영 배포·DB·Secret·LIVE MONEY·소셜 공개·스토어 공개 작업 없음.
- Core·Admin·Site·App·Account가 한 단계 모두 READY인 뒤 배포방이 단계 단위로 배포. Core 선배포 금지.
- 앱은 배포방 내부 APK, 소유자 휴대폰은 매회 승인 후 Play 내부 테스트.
- 운영 E2E: 배포 후 배포방:
- 되돌리기: 배포방이 정상 revert, 자산 버전 재생성·검사. 운영 데이터 삭제 없음.
