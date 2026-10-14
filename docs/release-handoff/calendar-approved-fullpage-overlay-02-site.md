READY_FOR_DEPLOY=YES

# 캘린더 승인 전체 화면·겹침 상세 — Site READY

## 식별 정보

- 저장소: `lotbi-site`
- feature branch: `feature/calendar-approved-fullpage-overlay-02-site`
- 구현 source exact SHA: `c5bc46dcf50ae059a8e45d8c240539ee2d86f8d5`
- 개발 기준 Ncloud `main`: `2047877405928309dd4ed634266e2f4fb2be5b57`
- READY 문서와 최신 `main` 병합을 포함한 공식 Gate source exact SHA는 Gate 실행 직전 원격 readback 값으로 최종 사용자 인계문에 기록한다.
- PR: 없음
- asset version: `aset-7716ed079ed5`
- 작성 시각: `2026-10-14 11:43 KST`

## 사용자 확정 범위

- 캘린더 전체를 홈 위 대형 팝업으로 띄우지 않고 데스크톱 사이드바 옆의 기본 작업 화면으로 연다.
- `주 / 월 / 년 / 일정` 네 보기를 항상 보이게 하고, 연 보기와 연간 생활비 합계를 복구한다.
- 월 보기는 7개 열 전체 폭을 유지한다. 날짜를 누를 때만 데스크톱 오른쪽 겹침 상세, 모바일 하단 시트를 연다. 상세 때문에 달력 폭이 줄지 않는다.
- 상단 `+ 일정 추가`와 `설정`, 날짜 이동, 오늘 이동, 보기 전환, 사진으로 추가, 기존 일정 등록·수정·삭제를 유지한다.
- 같은 날짜 일정은 월 칸에 최대 3개와 `+N개 더`, 상세에는 시간순 전체 목록과 금액을 표시한다.
- 월·연 생활비는 실제 일정/지출 연결 데이터를 사용하며 분류별 합계를 한 곳에서 표시한다. 날씨·온도·음력·금액 예시는 운영 코드에 고정하지 않는다.
- 일정 없음은 `등록된 일정이 없습니다.`와 `이 날짜에 일정 추가`를 표시하고, 지출 기록이 있으면 일정 유무와 별개로 표시한다.

## 플랫폼 상태

| 플랫폼 | 상태 | 저장소 | 브랜치 | source exact SHA | 확정 병합 SHA |
| --- | --- | --- | --- | --- | --- |
| Desktop Web | READY | `lotbi-site` | `feature/calendar-approved-fullpage-overlay-02-site` | Gate 직전 원격 HEAD | 공식 Gate 뒤 최종 인계문 기록 |
| Mobile Web | READY | `lotbi-site` | `feature/calendar-approved-fullpage-overlay-02-site` | Gate 직전 원격 HEAD | 공식 Gate 뒤 최종 인계문 기록 |
| Android Native | READY | `lotbi-app` | `feature/app-calendar-native-approved-design-02` | `22b733e0b66e8ac96dc368cf2ddb8be3119c417f` | `459da4abc8b6d28291388ee560a41e6ea26bbbc2` |
| iOS Native | READY | `lotbi-app` | `feature/app-calendar-native-approved-design-02` | `22b733e0b66e8ac96dc368cf2ddb8be3119c417f` | `459da4abc8b6d28291388ee560a41e6ea26bbbc2` |

Android와 iOS는 동일 React Native 코드를 사용한다. App 공식 Gate run은 `20261013T224642Z-3381763-1847228418`이고 결과는 `SUCCESS`다. 현재 Ncloud App `main` `955bbb339949ff7170f92098ec24f019eea49281`가 위 source와 병합 SHA를 모두 조상으로 포함하는 것을 2026-10-14에 재확인했다. Android/iOS 배포는 별도 배포방 책임이며 이 작업에서 실행하지 않았다.

## 구현 범위와 주요 파일

- `site-conversation.js`: 캘린더 진입을 모달에서 기본 작업 화면으로 변경.
- `site-calendar-manager.js`: 승인 화면의 4개 보기, 전체 폭 월, 명시적 날짜 선택 상세, 데스크톱 겹침/모바일 시트, 연간 실제 지출 합계.
- `site-calendar-expense.js`: 월·연 기간 라벨과 합계 접근성 문구.
- `site-calendar.css`: 전체 화면, 7열 유지, 상세 겹침, 모바일 하단 시트, 라이트·다크 반응형 배치.
- `scripts/validate_calendar_*.mjs`: 변경 범위의 상태·레이아웃·기간 조회 검증.
- `scripts/shoot_calendar_approved_fullpage_overlay_02.mjs`: 수정 후 고정 데이터 화면 증거 생성기.
- `scripts/shoot_calendar_production_baseline_02.mjs`: 변경 전 운영 화면 읽기 전용 증거 생성기.
- `site-asset-version.json` 및 생성기가 관리하는 로컬 자산 참조: `aset-7716ed079ed5`.

## 검사 결과

- `node scripts/asset_cache_version.mjs --write`: PASS, `aset-7716ed079ed5`, 86 files / 169 targets.
- `node scripts/asset_cache_version.mjs --check`: PASS, 169 targets / 208 refs.
- 변경 관련 최종 15개 검사: PASS.
  - compact editor, cross-platform UX, day panel two buttons, expense summary, actual modal runtime, touch month navigation/day sheet
  - year view, real UI, responsive, holiday surface/settings icon, month temperature, mobile week weather, lunar compact, event editor, settings expansion
- 전체 캘린더 관련 검사 묶음: 1차 실행에서 기존 정적 검사가 새 승인 화면의 연간 합계 조건을 인식하지 못한 1건만 실패. 기대 기능을 완화하지 않고 월 조회와 승인 작업 화면의 연 조회를 함께 검증하도록 갱신한 뒤 실제 Chrome에서 PASS.
- 공식 Ncloud Site Gate: 이 문서 작성 시점에는 다른 Site Gate가 실행 중이어서 중복 실행하지 않음. 이 방이 기존 Gate 종료 후 동일 원격 source SHA와 최신 main SHA로 1회 실행하고 최종 인계문에 결과를 기록한다.

## 사용자 시나리오

1. 월 → 10월 11일 상세: 탭 1회. 월 7열 폭은 그대로이며 PC는 오른쪽 겹침 상세, 360px는 하단 시트. 일정 6개 시간순·합계 208,000원 확인. 막힌 곳 없음.
2. 월 → 년 → 10월: 년 탭 1회, 월 카드 1회. 12개월 보기와 `2026년 생활비 합계`를 확인하고 10월 월 보기로 복귀. 막힌 곳 없음.
3. 상단 `+ 일정 추가` → 제목·시간·금액·분류 입력 → 저장: 최소 3회 이상. 저장 후 원래 날짜 상세를 복원하고 실제 저장소에서 다시 읽는 기존 흐름 유지. 검사 환경에서 PASS, 운영 계정 저장은 NOT TESTED.
4. 월 → 일정 6개 날짜 → `+3개 더`: 탭 1회. 긴 제목이 인접 칸을 침범하지 않고 상세 스크롤로 6개 모두 확인. 막힌 곳 없음.
5. 일정 없는 날짜 → 상세 → `이 날짜에 일정 추가`: 탭 2회. 빈 상태 문구, 실제 날씨·음력, 0원이 아닌 실제 지출이 있으면 별도 표시하는 기존 계약 유지. 막힌 곳 없음.
6. 모바일 360×780 월 → 날짜 상세 → 닫기: 탭 2회. 하단 시트가 토·일 열을 영구적으로 가리거나 달력 폭을 줄이지 않고 닫힌 뒤 원래 날짜에 초점 복귀. 막힌 곳 없음.

## 화면 증거

변경 전 운영 화면:

- `docs/release-handoff/evidence/calendar-approved-fullpage-overlay-02-site/before/pc-light.png`
- `docs/release-handoff/evidence/calendar-approved-fullpage-overlay-02-site/before/pc-dark.png`
- `docs/release-handoff/evidence/calendar-approved-fullpage-overlay-02-site/before/mobile-light.png`
- `docs/release-handoff/evidence/calendar-approved-fullpage-overlay-02-site/before/mobile-dark.png`

변경 후 PC 1280×900:

- `after/pc-light-month.png`, `after/pc-light-detail.png`, `after/pc-light-year.png`, `after/pc-light-add.png`, `after/pc-light-totals.png`
- `after/pc-dark-month.png`, `after/pc-dark-empty.png`, `after/pc-dark-empty-detail.png`

변경 후 모바일 Web 360×780:

- `after/mobile-light-month.png`, `after/mobile-light-detail.png`, `after/mobile-light-year.png`, `after/mobile-light-add.png`, `after/mobile-light-totals.png`
- `after/mobile-dark-month.png`, `after/mobile-dark-empty.png`, `after/mobile-dark-empty-detail.png`

위 `after/` 경로의 기준 디렉터리는 `docs/release-handoff/evidence/calendar-approved-fullpage-overlay-02-site/`다. 모든 캡처에서 문서 가로 넘침은 0px였다. 수정 후 화면의 일정·날씨·금액은 브라우저 증거용 고정 응답이며 운영 코드에는 들어가지 않는다.

## 배포 전 필수 정보

- DB migration: NO
- DB destructive change: NO
- ENV 변경: NO
- Secret·credential 변경: NO
- LIVE MONEY: NO
- 실제 운영 회원자료 삭제: NO
- 신규 유료 인프라: NO
- 소셜 공개 범위 변경: NO
- 서버 선행 배포 필요: NO
- 앱이 요구하는 최소 서버 SHA 또는 API 계약: 기존 일정·공휴일·날씨·지출 API 계약 그대로, 신규 최소 서버 SHA 없음
- 롤백: Site는 배포 직전 운영 `main`의 이전 정상 병합 SHA/이미지로 되돌린다. App은 기존 스토어 배포 버전을 유지하거나 이전 정상 App 릴리스로 롤백한다. 데이터 migration이 없어 DB 롤백은 없다.

## NOT TESTED

- Production 반영, Production 실제 계정 일정 저장·재조회, 운영 날씨 제공자·운영 지출 데이터 E2E.
- 실제 Android 휴대전화, 실제 iPhone/iPad, 삼성 인터넷, iOS Safari 실기기.
- Android/iOS 빌드·업로드·출시. App 변경은 Gate·main 병합까지만 확인했다.

## 배포 후 확인

- `https://lotbiai.com/#calendar`: 전체 작업 화면, `주/월/년/일정`, 상단 추가·설정, 월 7열 유지.
- 날짜 선택: PC 오른쪽 겹침 상세, 모바일 하단 시트, 6개 일정 시간순과 `+3개 더`, 긴 제목, 금액 없음/있음.
- 월·연 생활비 실제 기간 합계, 분류 합계, 중복 합산 없음.
- 날씨·음력 정상/미제공/조회 실패 구분.
- 운영 반영 전에는 `DEPLOYED` 또는 `ACTUAL E2E PASS`로 표현하지 않는다.
