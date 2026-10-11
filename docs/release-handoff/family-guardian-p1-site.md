READY_FOR_DEPLOY=NO

# 가족 지킴이 ① 이름·디자인 — Site 검증 기록

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
