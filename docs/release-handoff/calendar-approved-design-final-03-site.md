READY_FOR_DEPLOY=YES

# LOTBI 캘린더 확정 시안 — Desktop Web·Mobile Web READY

- 작성일: 2026-10-14 KST
- 저장소: `lotbi-site`
- feature 브랜치: `feature/calendar-approved-design-final-03-site`
- 개발 기준 Ncloud main: `2047877405928309dd4ed634266e2f4fb2be5b57`
- 선행 승인 화면 병합: `feature/calendar-approved-fullpage-overlay-02-site`
- 최종 exact SHA: Ncloud push 후 원격 readback 값으로 배포총괄방에 전달
- asset version: `aset-1ac84bf6095d`

## 구현 완료

- 데스크톱 웹과 모바일 웹의 주·월·년·일정, 날짜 상세, 일정 추가·편집, 합계표를 확정 시안의 흰색·중성 회색·LOTBI 파란색 체계로 통일했다.
- 상단 `+ 일정 추가`와 `설정`, 전체 폭 월간, 연간 12개월, 데스크톱 오른쪽 겹침 상세, 모바일 하단 날짜 시트를 유지했다.
- 미분류·음식·여행·쇼핑·생활비·기타 여섯 종류를 등록 화면과 합계표에서 같은 순서로 표시하고, 지출 없는 종류도 0원으로 표시한다.
- 선택 월·연도의 실제 등록 금액만 집계하며 사진으로 추가, 수정·삭제 후 재조회, 같은 날 5개 이상 목록 계약을 보존했다.
- 날씨 출처가 화면 밖으로 밀리지 않도록 긴 날짜 패널을 제한했고 320~420px 상단 이전·다음 버튼의 가로 넘침을 수정했다.
- 확정 날짜 동작은 데스크톱 오른쪽 팝업과 모바일 하단 시트이며, 빈 날짜도 같은 흐름에서 해당 날짜가 채워진 추가 화면으로 이어진다.

## 플랫폼 상태

| 플랫폼 | 상태 | 근거 |
|---|---|---|
| Desktop Web | READY | 1280×900 월·년·상세·추가·합계·라이트·다크 화면 및 전체 캘린더 검사 |
| Mobile Web | READY | 320~768 반응형 검사, 360×780 월·년·상세·추가·합계·라이트·다크 화면, 가로 넘침 0 |

## 검증 결과

- 전체 `scripts/validate_calendar_*.mjs`: 51/51 PASS. 결과는 `D:/LOTBI-WORK/evidence/calendar-approved-design-final-03-site-validators-final.txt`에 기록.
- 자산 캐시: `ASSET-CACHE-WRITE aset-1ac84bf6095d`, 86 files / 169 targets, coherence 208 refs PASS.
- 확정 화면 16장: `docs/release-handoff/evidence/calendar-approved-design-final-03-site/`.
- 데스크톱·모바일 월/년/날짜 팝업/추가/합계, 일정 6개와 `+N개`, 여섯 종류 0원, 날씨·음력·월 경계, 라이트·다크, 키보드 Escape와 터치 시트를 포함한다.

## 화면 증거

- PC: `pc-light-month.png`, `pc-light-detail.png`, `pc-light-year.png`, `pc-light-add.png`, `pc-light-totals.png`, `pc-dark-month.png`, `pc-dark-empty.png`, `pc-dark-empty-detail.png`
- 모바일 웹: `mobile-light-month.png`, `mobile-light-detail.png`, `mobile-light-year.png`, `mobile-light-add.png`, `mobile-light-totals.png`, `mobile-dark-month.png`, `mobile-dark-empty.png`, `mobile-dark-empty-detail.png`

캡처의 일정·날씨·금액은 검증용 가상 응답이며 운영 고정값이 아니다. Production 실제 계정 저장·재조회와 운영 날씨 제공자 E2E는 NOT TESTED다.

## 배포 조건

- Core·DB·환경변수·Secret 변경 없음.
- rebase·force-push·검사 완화 없음.
- 배포총괄은 Site Gate, main 병합, Production 반영과 운영 화면 확인을 담당한다.


