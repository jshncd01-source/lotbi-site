READY_FOR_DEPLOY=YES

# 가족 지킴이 사용자 최종 승인 디자인 — Site READY

## 2026-10-13 직원 피드백 반영 재READY

- 코드 커밋: `dee1df35a85e2fb8df1636eccadf3fd695842859`.
- 사람·반려동물 목록에서 이름 옆에 비공개 등록 사진의 대표 썸네일을 표시한다. 사진을 읽지 못하거나 아직 없으면 같은 크기의 `사진` 자리표시자를 사용한다.
- 사람은 `얼굴 N장 · 상반신·전신 N장`, 반려동물은 `얼굴 N장 · 몸 전체 N장 · 추가 N장`으로 사용자가 올린 사진 구성을 카드에서 바로 확인한다.
- 가족·반려동물 내부 등록번호는 목록·정보 수정·사진 관리·최종 확인·완료·실종 신고의 사용자 화면에서 각각 `FAM-****-****`, `PET-****-****`로 표시한다. 실제 식별자는 API 호출과 데이터 연결에만 보존한다.
- 360·1280, light/dark/system/bootstrap 및 OS 반대 명시 테마 18조합 회귀 PASS. 새 증거는 `outputs/screenshots/site/family-guardian-card-photo-summary-20261013/` 450 PNG다.
- 자산 캐시 `aset-8deef8da0431`, write/check PASS (`targets=169`, `refs=208`).
- 얼굴 사진 분류 오류 등 Core 판정 로직은 사용자 지시대로 별도 개발방 범위다. 이 재READY는 카드 표시와 디자인 반영만 뜻한다.
- 최종 문서 커밋을 포함한 exact HEAD·Ncloud 원격 readback은 외부 배포 인계 문서와 총괄방 메시지에 기록한다.

## 식별자와 상태

- 저장소: `lotbi-site`
- feature branch: `feature/family-guardian-approved-photos-01-site`
- 사용자 최종 승인: 2026-10-13 KST
- 디자인 코드 커밋: `baff7ed11` (`feat(site): finalize approved family guardian design`)
- 통합한 Ncloud `main`: `a87bfe29da6f444a922f4bd5e4203690ef768200`
- 정상 merge 커밋: `2bf104f2c9b8b40d036f67f5912293e385cdf551`
- 최종 문서 커밋을 포함한 exact HEAD와 Ncloud readback SHA는 외부 Work 인계 문서 및 배포총괄 전달 메시지에 기록한다.
- 상태: `READY_FOR_DEPLOY=YES`, `FULL_FUNCTIONAL_COMPLETE=NO`, `PRODUCTION_DEPLOYED=NO`, `PRODUCTION_VERIFIED=NO`.

## 확정 범위

- 사용자가 제공한 확정 시안의 가상 인물 사진을 사람 등록 예시로 사용한다. 그림형 대체 이미지는 사용하지 않는다.
- 사람 사진은 필수 5장(얼굴 3장, 상반신·전신 2장)을 먼저 보여 주고, 추가 5장은 선택 영역에 둔다. 사용자가 사진을 고르면 예시가 실제 등록 사진으로 바뀐다.
- 반려동물은 사람과 같은 4단계 구조를 사용하며, 강아지는 작은 흰색 비숑, 고양이는 회색 고양이의 승인 사진을 사용한다.
- 모바일에서는 사진 선택과 현재 등록 상태를 긴 설명보다 먼저 배치한다.
- 사용자 화면의 등록번호는 등록 전후 모두 `FAM-****-****`, `PET-****-****`로 마스킹하고 실제 내부 식별자는 노출하지 않는다.
- 사람 등록 취소·삭제·실종 신고 종료 확인은 전체 화면을 덮는 형태가 아니라 가족 지킴이 범위의 작은 중앙 대화상자로 표시한다.
- 라이트 배경은 `#F6F7F9`, 카드·입력은 흰색, 파란색은 주요 동작과 선택 강조에만 사용한다. 다크 테마와 경고·오류·완료의 의미색은 보존한다.
- 사진은 평소 검색에 사용하지 않고, 동의한 실종 신고가 활성화된 기간에만 후보 검색과 관리자 검토에 사용된다는 안내를 유지한다. 활성 신고 전에는 관리자도 등록 사진을 열람할 수 없다는 경계를 표시한다.

## 배포 대상에서 제외한 것

- 로컬 검토용 `family-guardian-design-preview.*` 상단 화면 선택 메뉴는 실제 Site에 포함하지 않았다. 프로토타입은 저장소 밖 Work 산출물로 보존했다.
- 얼굴 사진이 추가 사진으로 분류되는 동작 오류는 이 디자인 READY의 변경 범위가 아니다. 사용자 지시에 따라 별도 개발방 담당이며, 이 READY가 해당 오류 수정 완료를 뜻하지 않는다.
- Core·DB·Admin·Account·App 기능 변경, migration, Secret, 환경변수, 결제, 소셜 공개, 스토어 업로드가 없다. `p0_0120`은 미사용이다.

## 검증 결과

- JS 구문: `site-person-ui.js`, `site-pet-ui.js` PASS.
- 가족 지킴이 등록·승인 사진·실종 신고·사람 사진 intake·사진 일괄/쉬운 등록·반려동물 등록·등록 취소/삭제 보호 관련 validator PASS.
- 사람 등록 취소/삭제 보호: 360 dark, 390 light/dark/system-dark, 412 system-dark, 1280 light/dark/system-dark PASS; 대비 위반 0건.
- 최종 브라우저 회귀: 360·1280, light/dark/system/bootstrap 및 OS 반대 명시 테마 18조합 PASS.
- 최종 화면 증거: `outputs/screenshots/site/family-guardian-final-approved-20261013/` 450 PNG.
- 대표 확인: 사람 최종 확인의 마스킹 번호, 사람 모바일 필수 5장 우선 배치, 반려동물 비숑·고양이 선택, 반려동물 모바일 다크 화면을 실제 PNG로 재확인했다.
- 최신 홈 회귀: 360·1280 light/dark PASS.
- 자산 캐시: `aset-799d6b2459ca`, write/check PASS (`targets=169`, `refs=208`).
- 새 검사기는 `.github/workflows/site-review.yml`에 등록했고 Chrome profile은 실행 직전 임시 폴더를 만든다.

## 미검증과 다음 담당자

- Ncloud trusted gate, `main` 병합, Production 배포, 운영 사용자 데이터 저장/재조회, 운영 실제 브라우저 E2E는 `NOT_VERIFIED`다.
- 모바일 360은 Chrome viewport 검증이며 Android Native·iPhone Safari·iOS Native 검증이 아니다.
- 다음 담당자: 배포 총괄 관리방. 최신 `main`과 trusted gate를 다시 확인한 뒤 정상 병합·배포한다.
- 되돌리기: 배포 총괄이 정상 revert하고 자산 버전을 재생성·검사한다. 운영 사용자 데이터 삭제는 하지 않는다.

운영 E2E: 배포 후 배포방:
