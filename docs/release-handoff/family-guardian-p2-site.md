READY_FOR_DEPLOY=YES

# 가족 지킴이 ② 등록·사진·정보 수정 — Site 사전 검증

## 2026-10-12 사용자 최종 시안·필수 5장 반영 재READY — 현행

- `READY_FOR_DEPLOY=YES`, `FULL_FUNCTIONAL_COMPLETE=NO`, `PRODUCTION_VERIFIED=NO`.
- 저장소/브랜치: `lotbi-site` / `feature/family-guardian-p2-01-site`. 승인 디자인+② 기능 코드 HEAD `e2288b9b0b623fd105cd3ed27a42355fd6847e8e`; ①의 `836df7f1ce3560bda064ea86923a039de9542097`과 기준 Ncloud `main` `16826d4a0174b6ec6b5b1d61d06af6554d8d4e38`을 정상 merge했다. 문서 이후 최종 exact SHA/readback은 Work 최종 인계표에 기록한다.
- 기본 사진은 얼굴 3장+상반신·전신 2장, 총 5장이다. 최대 10장은 선택 추가 용량이다. 가상 인물 예시 5장은 사용자가 선택한 실제 등록 사진으로 교체된다. 10칸 예시 기본 화면은 제거했다.
- ②의 실제 등록번호 표시, 2000년 1월 같은 연·월 보존, 정보 부분 수정, 무변경 저장 차단, 사진 갱신·관리 동작을 유지했다. 운영 예시 번호/이름/날짜 하드코딩 없음.
- 검증: `validate_family_guardian_registration_02.mjs` PASS, 가족 화면 360/1280×18조합 PASS, 사진 쉬운 등록·일괄 등록 PASS, 최신 홈 즐겨찾기 PASS, JS 구문·diff·cache `aset-4c8b02ae5ce6` write/check PASS.
- 스크린샷: `outputs/screenshots/site/family-guardian-approved-design-p2-20261012/` 450 PNG. light/dark/system과 등록·확인·목록·정보 수정·사진 관리·신고 진입을 포함한다. 가상 응답 검증이며 운영 저장 성공은 `NOT_VERIFIED`.
- 승인 원본 6장과 SHA-256은 ① READY의 최신 절을 권위로 재사용하며 원본·기존 증거를 덮어쓰지 않았다.
- `p0_0120`은 **미사용**. 새 Core/DB/migration 변경, Secret, 결제, 운영 데이터 변경 없음. main/Production/Play 업로드 없음.
- 운영 E2E: 배포 후 배포방:

## 2026-10-12 시스템 다크 수정 재READY — 현행

- READY_FOR_DEPLOY=YES, FULL_FUNCTIONAL_COMPLETE=NO, PRODUCTION_VERIFIED=NO. 기존 05a10023 대신 최신 ① 시스템 다크 수정 계보를 정상 merge했다. 검증 코드 HEAD b6c931156, 이후 ① 문서 merge는 문서만 변경했다. 최종 exact HEAD·Ncloud push/readback은 outputs/family-guardian-system-dark-reready-2026-10-12.md에 기록한다.
- fresh Ncloud main 29cc6b13a7e081dda6a224717f50d0efcfa53e25 포함. 88파일130hunk는 자산 토큰 정규화 후 동일한 cache-only 충돌임을 확인해 기계 해결했다. ② 등록번호·연월·사진·수정 로직의 실질 변경0, 가족 CSS+테마 검사만 갱신했다.
- 기존 validate_safecare_person_dark_cancel_01.mjs 변경0, 단독 PASS: light/dark/system-dark 대비 위반0 및 등록 취소/재개/삭제 보호. 가족 360/1280 18조합 PASS·450PNG. 기존 등록 계약(번호·2000년1월·무변경·부분 수정·오류 보존) PASS.
- before: outputs/screenshots/site/phase2-system-dark-fix-before-05a1/ 44PNG, after: outputs/screenshots/site/phase2-system-dark-fix-after-20261012/ 450PNG. before는 과거 05a10023 CSS를 유지한 별도 증거 checkout이며 테마 캡처 harness만 업데이트했다. 일반 동작 PASS를 before 대비 PASS로 해석하지 않는다. 기존 light/dark 전후/원본 ZIP 보존.
- common-ui-polish02 10계약, consumer-shell source, cache write/check aset-1568c9660e38·refs208, diff 검사 PASS. 검사 삭제/skip/완화 없음.
- 실제 Core/Admin 저장/재조회·Native after/dark·iOS는 미검증 그대로다. 운영 DB·Core/다른 저장소 신규 변경, main/Production/Play 업로드 없음. 단계 공동 후보와 trusted gate 조건 유지.
- 운영 E2E: 배포 후 배포방:

## 2026-10-12 배포 레일 재READY — 현행 화면 확인용 판정

- READY_FOR_DEPLOY=YES는 확정 화면을 먼저 확인하는 공동 후보의 개발 READY다. FULL_FUNCTIONAL_COMPLETE=NO, PRODUCTION_VERIFIED=NO. 아래 과거 NO/보류 문구는 이전의 전 항목 완료 기준과 당시 SHA 기록이며 이 절이 현행 판정이다.
- 사용자 원문(배포 총괄 관리방 2026-10-12) “레디의 조건을 너무 엄격하게 하지마 … 시안 확정되면 배포해”, “사이트에 문제가 있으면 그때 가서 수정하자”를 read_thread의 userMessage로 직접 확인했다. 배포방의 정정 기준인 확정 디자인·기본 빌드/진입·최신 main·관련 최소 검사와 보안/데이터 보존을 적용한다. 검사 삭제/완화나 실패 은폐가 아니다.
- 저장소/단계: site 02, branch feature/family-guardian-p2-01-site. fresh main 29cc6b13a7e081dda6a224717f50d0efcfa53e25를 정상 통합/포함 확인. 기능 검증 코드 HEAD 36e610ddcc342958cceb17010302fd6cdc1298fb; 이후 문서만 바뀐 최종 exact HEAD·Ncloud push/readback은 outputs/family-guardian-screen-ready-2026-10-12.md에 기록한다.
- 이번 기본 검사: 최신 ① 정상 merge·cache-only130 hunk 보존. 360/1280 light/dark4 PASS·PNG100, 등록번호·2000년1월·부분 수정/무변경 계약 PASS. cache aset-73d42d50568a/check208 PASS. 경로 outputs/screenshots/site/phase2-rail-main-after-20261012/.
- Site8766, Admin5182·5183·5184, Account3107 기존 서버의 기본 HTTP 진입200 확인. HTTP200을 사용자 목적 전체 성공으로 표현하지 않는다. Core의 관련 pytest/TestClient는 LOCAL_TEST 기본 startup/API 검사이고 Production 시작 성공이 아니다. App renderer·번들/네이티브 컴파일은 실제 폰의 기본 진입 성공과 다르다.
- CORE①·② 단독 선배포 금지. ①→②→③ 순서, 해당 단계의 Core/Admin/Site/App/Account 공동 exact HEAD를 함께 제출한다. 이 조건은 변경하지 않는다.
- iOS 및 모든 실기기/부가기능 미검증을 화면 확인용 후보의 일괄 차단 사유로 삼지 않는다. 그러나 iOS NOT TESTED·과거 RNSVG pods FAILURE·Android after/dark NOT TESTED를 PASS로 바꾸지는 않는다. 현재 exact-head 외부 CI/trusted gate는 별도 NOT VERIFIED이며 배포방이 정상 gate를 수행해야 한다.
- 후속 필수 목록: ② Site→시험 Core→Admin 실제 저장/재조회, App Native 사진/수정·갱신; ③ 반려동물 별도 관리자 알림 및 Site/App→Core→Admin→사용자 종료→기존 사진 URL 차단 전체 연결. 접수함 건수·화면 존재를 알림/E2E PASS로 보고하지 않는다. 이 목록 완료 전 서비스 전체 완료를 선언하지 않는다.
- Core③ 사전 권한 검사(미동의/타인/비담당/종료 후 직접 URL 403)는 유지한다. 새 데이터 공개/자동 매칭 활성화 없음. p0_0120 미사용, p0_0121 기존 배정만 사용. 운영 DB·Secret·결제·소셜 공개·Play/AppStore 공개·휴대폰 설치/삭제 변경 없음.
- 법적 명칭3곳은 별도 승인 전 기존 문구 유지. 새 배경은 가족 light #F6F7F9·흰 카드/입력·파란 강조, 기존 dark/의미색·다른 카테고리/Account 인증 보존. ZIP 원본·기존 PNG·과거 문서는 덮어쓰지 않는다.
- 운영 E2E: 배포 후 배포방:
- 다음 owner: 배포 총괄 관리방으로 공동 READY 인계. Work는 feature push/readback까지만, main/Production/내부 release APK/Play 내부 테스트(매회 소유자 승인)는 배포 담당자의 영역이다. 새 검사/권한을 우회하지 않는다.

## 이하 이전 체크포인트 — 현행 판정과 분리


## 식별자와 현행 판정

- 담당 Work / Codex, branch `feature/family-guardian-p2-01-site`.
- 최신 Ncloud main `9147419fb079e6452ff26d82c52a1b8f1dca36e4`에서 격리 worktree를 만들고 기존 ① `1b3e74e2f8c18d6e36c5be346bea8c16521b69d2`를 정상 merge했다. 같은 기능의 기존 ② 원격/로컬 branch가 없음을 확인한 뒤 생성했다. 기존 ① 브랜치를 다시 개발하지 않았다.
- 최종 exact SHA·Ncloud push/readback은 `outputs/family-guardian-resume-2026-10-12.md`의 현행 표에서 확인한다. 자기 문서 커밋 SHA를 추정하지 않는다.
- 상태 IMPLEMENTED / 로컬 클라이언트·브라우저 회귀 PASS. 실제 Site 입력→시험 Core 저장→Admin 동일 대상 재조회 연결과 최신 앱 증거는 아직 미완료이므로 공동 단계 READY는 NO다.
- migration 배정 `p0_0120`: 미사용. Site는 DB를 변경하지 않는다.

## 실제 보완과 보존

- Node 계약 검사에서 사람 `registrationNumber`가 undefined인 실패를 재현했다. Core 응답의 `registration_number`를 유지하고 구버전은 기존 대상 내부 ID만 재사용한다. 계정 ID·예시 번호·별도 번호를 새로 생성하지 않는다.
- 사람 목록·사진 관리·최종 확인·완료·신고에 같은 대상 번호를 연결했다. 완료에도 저장 후 출생 연월을 표시한다.
- 반려동물은 기존 `pet_id` 기반 롯비 번호 포맷을 유지하며 목록·기존 상세·완료에 표시한다. 국가 동물등록번호·마스킹·선택 입력과 구분한다.
- 사람 수정은 기존 모델과 비교해 바뀐 필드만 PATCH한다. 출생 연·월은 Core의 원자적 계약 때문에 두 필드를 함께 보낸다. 변경 없음은 PATCH 0건, 별도 안내; 취소·저장 동작은 기존 흐름 유지. 실패 시 기존 모델/사진/갱신일을 바꾸지 않는다.
- 기본정보 수정으로 사진 갱신일을 만들거나 연장하지 않는다. 기존 사진 추가·교체·삭제/분류·파일 해시·서버 완료 조건을 재사용한다. 동일 파일·새 파일·실패/갱신일 서버 회귀는 Core② 별도 검사 결과와 구분한다.
- 가족 범위에서 긴 번호 줄바꿈만 보완했다. 기존 레이아웃·참고 이미지·필수 사진 3 FACE + 2 BODY·최대10·파란 버튼·라이트 #F6F7F9/흰 카드·다크/상태색은 보존했다. Account·인증·다른 카테고리 배경 변경 없음.
- 주요 기능 파일 `site-person.js`, `site-person-ui.js`, `site-pet.js`, `site-pet-ui.js`, `site-family-guardian.css`. 검사 `validate_family_guardian_registration_02.mjs`, 기존 디자인/브라우저 runner, `.github/workflows/site-review.yml`.
- 그 밖의 84개 변경 파일은 캐시 버전 문자열을 정규화한 전후 내용 일치 검사로 자산 버전만 바뀐 것을 확인했다. 약관·동의 문구를 변경하지 않았다.

## 검증

- 신규 등록 클라이언트 계약 PASS: 실제 번호·기존 ID 호환·2000년1월 생성/재조회·부분 수정·무변경 PATCH0·실패 불변·갱신일 불변·반려동물 번호 포맷. 가상 Core 응답이며 운영 저장 검증이 아니다.
- 기존 가족 브라우저 검사 360·1280 × light/dark 4조합 PASS, 25상태×4 = PNG100장. 실제 모듈/스타일·가상 API·외부 요청 차단. 아동 동의 회귀를 유지하며 추가 수정/재조회 시나리오에서 2000년1월과 등록 완료·revision2를 확인한다.
- 기존 사람 CRUD 계약 PASS. 기존 반려동물 웹 360·768·1280 계약/렌더 PASS. 첫 실행은 CHROME_BIN 미설정으로 브라우저를 찾지 못했고 설치된 Chrome 경로를 지정해 재검증했다. 검사기 완화 없음.
- 기존 사진 일괄 업로드 360·390·412·1440 PASS: 한 장씩 전송·필수5·변경/삭제·발견 제보 개인정보·SOS 문구.
- clean URL, iOS social return, 신뢰기기 플랜 한도 PASS. Python cp949 출력 오류는 UTF-8 실행 환경으로 재검증했으며 검사 코드는 변경하지 않았다.
- JS 구문·LF·diff 검사 PASS. 자산 write/check PASS: `aset-7650f7af1967`, 208개 참조. 두 HTML 진입점 가족 CSS 로드 순서 동일. 새 검사기 gate 등록, Chrome 실행 직전 mkdtemp 보존.
- 실제 기존 8766 서버에서 임시 검증 연결 경로로 ② 소스를 제공했다. 브라우저 runner의 하위 경로 import 지원을 추가해 ① 소스를 잘못 검증하지 않았다. 별도 장기 개발 서버·운영 서버를 시작하지 않았다.
- Core②의 95 passed는 별도 저장소 LOCAL_TEST 회귀다. 이번 Site 가상 API 결과와 합쳐 서버 사진 인식 성공·실제 브라우저 E2E PASS로 표현하지 않는다. Linux trusted gate·Android Native·iOS Native는 이번 Site 검사로 검증되지 않는다.

## 시나리오와 화면

| 시나리오 | 입력·탭 | 결과·한계 | 환경 |
|---|---|---|---|
| 사람 등록·재조회 | 등록→기본정보/동의→실제 가상 사진5장→확인→완료→목록 | 대상 번호·필수 사진 상태·출생 연월 유지. 아동 필수 동의 거부/허용을 유지 | 실제 Chrome 모듈·가상 API |
| 정보 수정/2000년1월 | 수정 진입→무변경 저장1회→재진입→출생 선택2000/1→저장→화면 재진입 | 무변경 PATCH0·별도 안내, 수정 PATCH/GET 후 2000년1월·등록 번호 동일 | 동일. 서버 저장은 fixture |
| 반려동물 등록·관리 | 강아지/고양이 기존 등록 흐름·필수5·확인·완료·사진 관리 | 롯비 번호와 국가 번호 구분, 사진 조건·마스킹·삭제 확인 유지 | Chrome·가상 API |
| 업로드/수정 실패 | 오류 응답 및 삭제/동일파일/새파일 선택 회귀 | Site는 기존 모델/날짜 불변. 서버 파일 해시·실제 갱신 조건은 Core② 검증을 별도로 참조 | Node 계약 + 별도 Core pytest |

경로 기준 Work outputs:

- ② 변경 전은 동일 기능 코드의 ① `screenshots/site/phase1-fresh-main-after/` 96장. 검증 코드 SHA `b1cd7340dde52b9dc275191b762335e70236fe97`, 최종 문서 SHA `1b3e74e2f8c18d6e36c5be346bea8c16521b69d2` 사이 비문서 차이0.
- ② 변경 후 현행 `screenshots/site/phase2-after-20261012-v2/` 100장. 초기 `phase2-after-20261012/` 원본100장도 보존하되 현행 판정에는 v2만 사용한다. v2는 가상 서버의 필수 사진 완료 상태를 실제 Core 계약에 맞춰 보완한 회차이며 운영 코드를 우회한 것이 아니다.
- 기존 24개 화면 상태의 파일명은 ① 화면표와 같다. 사람/반려동물 목록·기본정보·사진·최종확인·완료·관리/수정·신고를 포함한다. 추가 `*-person-12-birth-2000-reloaded.png`는 2000년1월 수정 후 재조회 증거다.
- 관리자 회원별 최소 사람/반려동물 현황 `screenshots/admin/phase2-members-fresh-main-20261012-v2/`, 실제 MemberDirectoryPage·가상 최소 입력·사진0. 접수 상세의 기존 Admin② 컴포넌트와 운영 사진 열람/③ 기능을 혼동하지 않는다.
- 17개 화면은 공통 목록1 + 사람7 + 반려동물7 + 관리자2이며 기존 ① 적용표와 위 증거를 함께 참조한다. 캡처 수를 화면 개수나 Native PASS로 합산하지 않는다.

## 다섯 저장소 안심케어 검색 결과

| 저장소 | 바꾼 곳 | 의도적 유지와 이유 |
|---|---|---|
| Core | 답변·푸시·구독 | 구버전 질문 입력·부정 assertion·내부 식별자·과거 문서: 호환/회귀 |
| Admin | 메뉴·서비스·일반 안내 | 과거 문서·검색표. src 사용자 표시 잔여0 |
| Site | 메뉴·제목·일반 안내·구독·접근성 | 약관1곳·동의 계약2곳 별도 승인 전 보존; 실행 주석9곳·역사·legacy fixture |
| App | 메뉴·제목·버튼·접근성·구독 | legacy 구독 응답7곳·과거 문서. 실행 src/packages 표시 잔여0 |
| Account | 요금제·구독·용량 설명 | 과거 문서·검색표. src 표시 잔여0, 인증 owner 보존 |

## 의존성과 경계

- 공동 단계 전체 READY=NO. Core②·Admin②·Site②·App②·Account②의 필수 연결/증거 완료 후 함께 배포. Core①·② 선배포 금지. T57b 취소 유지.
- 정책·동의 계약 별도 승인 전 보존. 자동 매칭·알림·권한 공개를 임의 활성화하지 않는다. 위치 동의와 사진 동의는 분리 유지한다.
- 최신 앱 ① 검증 APK 요청 중. App의 과거 cd5169a0 APK를 후속 배경 보완 증거로 쓰지 않는다. Play 내부 테스트 매회 소유자 승인, 공개 출시 없음.
- main 병합·Production·운영 DB·Secret·결제·소셜 공개·휴대폰 조작/설치/삭제 없음. 실제 운영 SHA/배포와 사용자 E2E는 UNVERIFIED/NOT TESTED.
- 사용자 브라우저 최종 승인 기록은 이 재개 회차에서 새로 받지 않았다. 로컬 검사 PASS를 사용자 최종 디자인 승인으로 표현하지 않는다. ZIP5 원본을 교체하지 않으며 배경 최종 기준은 #F6F7F9다.
- 운영 E2E: 배포 후 배포방:
- 되돌리기는 배포방의 정상 revert·자산 버전 재생성/검사. 운영 대상/사진 삭제로 되돌리지 않는다.
