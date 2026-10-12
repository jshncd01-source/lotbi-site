READY_FOR_DEPLOY=YES

# SITE-HOME-FAVORITES-01 — 확정 홈 즐겨찾기 READY

- 저장소: `lotbi-site` / Ncloud `ssh://lotbi-ncloud-git/srv/git/repositories/lotbi-site.git`
- 브랜치: `feature/site-home-favorites-01-site`
- 기준 Ncloud main: `29cc6b13a7e081dda6a224717f50d0efcfa53e25`
- 검증 코드 commit: `260dc66b96360d645190f9ac219cc79d1a8adcae`
- 최종 문서 포함 HEAD·Ncloud push/readback은 외부 `outputs/READY-홈즐겨찾기.md`에 기록한다.
- 구현 담당: LOTBI 사이트 — 대화 UI 디자인. 접수는 배포 총괄 관리방, 운영 반영은 별도 담당방.

## 확정 범위

최신 main의 중복 owner·기존 구현을 먼저 확인했다. 홈 즐겨찾기 feature/구현은 없었으며, 기존 고정 예시 질문 3개를 승인된 즐겨찾기 영역으로 교체했다. 다른 저장소의 부동산 즐겨찾기 등과는 별개다. 완료된 기존 대화 UI 브랜치는 그대로 보존하고 최신 main의 독립 feature/worktree에서 작업했다.

- 초기 즐겨찾기는 데스크톱·모바일 모두 **이번 주 일정 1개**, 제목 옆 **1/8**, **+ 즐겨찾기 추가**, **편집**.
- 빈 7개 슬롯·추천 카드·더보기·새 캐릭터 없음. 사용자가 추가할 때만 최대 8개.
- 데스크톱 4열×최대 2줄, 모바일 2열. 모바일 4개+더보기 방식 없음.
- 이름 최대 12자. 추가·수정·삭제·앞으로/뒤로 순서 변경, 새로고침 복원.
- 표시 이름과 실제 질문은 별도 필드로 저장한다. 초기 질문은 기존 첫 예시의 `이번 주 해야 할 일을 정리해 줘`를 보존하며 표시 이름만 `이번 주 일정`으로 정리했다.
- 즐겨찾기 실행은 기존 data-home-prompt / askWithoutKeyboard 경로를 재사용한다. 입력창에 초안·키보드를 남기지 않고 질문을 한 번 실행한다.
- 입력 없음은 전송 회색 비활성, 입력 시 기존 대화의 파란색 `#2454b8` 활성. 변경은 홈의 전송 버튼에 한정한다.
- 편집은 즐겨찾기 안의 인라인 폼으로 제공하며 기존 프로필·설정·팝업 코드를 변경하지 않는다.

## 저장·보존 경계

현재 브라우저의 계정/게스트 namespace별 localStorage에 `{id, name, question}`을 저장한다. 기존 namespace 전환에 연결하므로 다른 계정 목록을 자동 합치지 않는다. 서버 저장·다른 기기 동기화는 구현 범위가 아니다. 저장이 차단된 브라우저에는 창을 닫으면 변경이 사라진다는 안내를 표시한다.

`홈즐겨찾기-변경범위.json`으로 다음을 검증했다.

- 기존 site-conversation.js는 즐겨찾기 import·mount·namespace 연결 **3줄 외에 main과 동일**(캐시 토큰 제외).
- index는 기존 예시 질문 교체·즐겨찾기 영역·새 CSS 링크 외에 main과 동일.
- 로고·캐릭터 자산, 좌측 메뉴 이름·기능, 프로필·팝업·대화 기능·공통 색 토큰 유지.
- 범위 밖 85개 파일은 캐시 토큰 갱신뿐이다. 캐시 manifest에는 새 JS/CSS 대상 2개가 추가됐다.
- 캐시 `aset-c50a3975b110`, targets 171 / refs 208, check PASS.

주요 변경: `index.html`, `site-conversation.js`, 새 `site-home-favorites.js`·`site-home-favorites.css`, `site-asset-version.json`, `.github/workflows/site-review.yml`, 새 `scripts/validate_home_favorites_01.mjs`, 기존 검사 2개.

## 최소 검증

요청에 따라 기본 진입·렌더링·빌드 계약·치명 회귀만 확인했다. 전체 Gate를 새로 실행하지 않았다.

| 검사 | 결과 |
|---|---|
| 실제 index/대화 runtime + 로컬 응답, 360/1280 × 라이트/다크 | PASS |
| 초기1·최대8·4열/2열·최대 행·가로 넘침0 | PASS |
| 12자 저장/13자 거부·추가/수정/삭제/순서·새로고침 복원 | PASS |
| 표시 이름과 다른 실제 질문 전송·초안 없음·자동 키보드 없음 | PASS |
| 빈 전송 비활성/입력 파란 활성·JS 오류 및 unhandled rejection 0 | PASS |
| Site 정적·hardening·home shell·UIUX phase1 | PASS |
| build env 계약 5개·theme bootstrap·캐시·JS 문법·diff check | PASS |
| 기존 디자인·대화·메뉴/자산/프로필/팝업·범위 밖 캐시 보존 | PASS |

새 검사는 workflow에 등록했고 Chrome 프로필은 실행 직전 mkdtemp로 만든다. 증거: `홈즐겨찾기-브라우저검사.txt`, `홈즐겨찾기-변경범위.json`, `home-favorites/{360|1280}x780-{light|dark}-{initial|eight}.png` 8장. 실제 PNG에서 초기 화면·8개 화면 및 캘린더 아이콘을 육안 확인했다.

## 기존 검사 변경 이유

- `validate_uiux_phase1_01.mjs`: 고정 질문 2개 전제를 확정 초기 즐겨찾기 1개·이번 주 일정·1/8·추가·편집 검증으로 교체. 기존 한 번 질문·초안/자동 포커스 금지 등 검증 그대로, 데스크톱/모바일 사기 메뉴 보존 검증 추가.
- `validate_conversation_answer_ux_01.mjs`: home phase의 대상만 새 즐겨찾기 버튼으로 변경. 2개 고정 질문 전제를 1개·이름·1/8로 교체하고, 삭제된 홈 사기 예시 버튼 대신 기존 데스크톱/모바일 사기 메뉴를 확인한다. 기존 요청 1회·키보드 금지·다른 대화/지역/일정/대비 검증과 허용 오차 유지. 이 검사 전체는 최소 확인 요청에 따라 NOT_RUN이며 문법 확인 완료; 같은 홈 요청 계약은 새 4조합 검사에서 확인했다.

## 인계·미검증

FEATURE_READY=YES / MAIN_MERGED_BY_THIS_ROOM=NO / PRODUCTION_DEPLOYED_BY_THIS_ROOM=NO.

새 exact HEAD의 trusted Linux Gate·전체 회귀·실제 로그인 운영 E2E·모바일 실기기·서버/다른 기기 동기화·운영 served SHA/digest는 NOT_TESTED/UNVERIFIED. 이 READY는 배포 완료가 아니다. 현재 운영 열차 종료 후 배포 담당방에서 Gate·정상 main 병합·Production 반영을 수행한다. 다른 main 선반영 시 최신 main 정상 통합·영향 검증이 필요하다.

DB·Secret·DNS·환경변수·LIVE MONEY·소셜 공개·유료 인프라 변경 없음. 확정 시안 원본과 기존 결과물은 보존했다.
