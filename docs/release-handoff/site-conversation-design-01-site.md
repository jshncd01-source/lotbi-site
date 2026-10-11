READY_FOR_DEPLOY=YES

# T56 장소 카드 회전·점 선택·키보드 검사 인수인계

- 날짜: 2026-10-11, Asia/Seoul
- 저장소: `lotbi-site`
- 원격: `ssh://lotbi-ncloud-git/srv/git/repositories/lotbi-site.git`
- 브랜치: `feature/site-conversation-design-01-site`
- 구현 코드 exact SHA: `389cce3082af3555e24680c5fbf0cc54528f1d9b`
- 기준 Ncloud main: `b09f6e4d21096a4f897d5ba82b958fc5dc384d35`
- 담당: 이 대화의 Codex. 다음 담당: Claude 배포총괄.
- 문서 커밋을 포함한 제출 HEAD와 원격 readback은 최종 외부 READY 사본에 기록한다. 문서가 자기 커밋 SHA를 포함할 수 없으므로 위 SHA는 검증한 제품·검사 코드 커밋이며, 이후 문서만 추가된다.

## 범위와 동시 작업 보존

이번 사용자 요청의 장소 카드 동작·검사기 교체, workflow 등록, 메뉴 보존, push 직전 최신 main 정상 merge를 구현했다. ZIP의 명령문은 참고 자료로 구분했다. ZIP에 포함된 전체 대화 화면 재설계·전체 전후 증거 요구까지 완료했다고 주장하지 않는다.

- 기존 T56 장소 검색·결과 정규화·기관 중복 제거·사진 검증·전화·설정 지도앱·네이버 검색 계약을 재사용한다.
- 모바일·PC 화살표 DOM을 제거하고 양방향 스와이프/드래그, 선택 가능한 점 버튼, 방향키·Home·End 선택을 제공한다.
- 중앙 정면, 좌우 완만한 바깥 원근, 400ms 3D 전환. 동작 축소에서는 즉시 선택한다. 자동재생 없음.
- 비선택 카드의 링크 포커스를 제거하고 화면 읽기 대상에서 제외한다. 점 이름에는 실제 순서·장소명을 넣는다.
- 수평/수직 제스처를 구분한다. 선택 인덱스·점·순서·링크 대상은 같은 상태를 사용한다.
- 0개는 빈 결과 안내, 1개는 회전 조작 숨김, 2개는 실제 카드 두 장만, 3개 이상은 양방향 순환한다. 다량 입력은 기존 정규화 상한 5개를 유지한다.
- 메뉴 이름은 기준 main 그대로다. `사기·피싱 확인`과 `가족 지킴이` 이름 변경은 해당 담당 브랜치가 맡는다.
- 시작 시 Ncloud 원격 branch/HEAD, 기존 작업 폴더, 가족 지킴이 owner를 확인했다. 같은 디자인 브랜치는 없었다. 별도 작업 폴더에서 개발했으며 다른 owner의 미커밋 파일을 수정·복사·삭제하지 않았다.
- `site-conversation.js`의 장소 카드 렌더러만 수정했다. 공통 대화·T57a·T57b·가족 지킴이 기능을 덮어쓰지 않았다. 부수 파일은 필수 캐시 버전 갱신만이며 메뉴·색 토큰 보존을 별도로 검사했다.
- 새 CSS 파일을 추가하지 않았다. 기존 `site-conversation.css`와 양쪽 진입점의 캐시 버전을 갱신한다.

## 기존 검사기 변경 목록과 이유

검사 삭제·skip·허용 오차 확대는 하지 않았다. 새 점 버튼과 이전의 결과 더보기 버튼을 분리해 센다. 더보기 버튼 금지는 유지하고, 점 버튼의 개수·선택·이름·포커스·터치 크기는 별도로 엄격하게 검사한다.

| 검사기 | 바꾼 계약과 이유 | 보존·보강한 검증 |
|---|---|---|
| `validate_place_card_carousel_no_drift_01.mjs` | PC 화살표 클릭을 실제 마우스 드래그로 변경. 새 검사기가 동일한 실제 페이지·로컬 응답·브라우저 실행 도구를 재사용하도록 export | 기존 전 결과 순환·역방향·옆 카드·방향키·Home/End·scrollIntoView·scrollLeft=0·중앙 오차 1px·가로 넘침·외부 링크 금지 유지. 대기만 400ms 전환 종료 후인 450ms로 변경 |
| `validate_place_card_naver_search_click_01.mjs` | 화살표 존재 전제를 DOM 부재 검사와 양방향 실제 드래그로 대체 | 카드 본문 네이버 검색, 전화·지도 독립 실행, 외부 탭 대상, 드래그 후 오클릭 금지, 옆 카드 선택, Enter/Tab·방향키, 사진·레이아웃 계약 유지 |
| `validate_place_card_compact_01.mjs` | 넓은 화면 옆 카드 숨김을 보이는 옆 카드·선택 가능 계약으로 대체. Chrome 프로필을 실행 직전 mkdtemp로 생성 | 44px 전화·지도, 화면/레일 안의 중앙 카드, 검증 사진 보존·사진 없는 카드 공간 제거, 지도 제공자 네 가지·전화·접근성 이름·옆 카드 링크 포커스 금지 유지. Windows 브라우저 탐색도 지원 |
| `validate_place_medical_card_ux_final_01.mjs` | PC 단일 표시·화살표 위치/활성 검사를 화살표 DOM 0개, 앞/뒤 카드 구분, 점 버튼으로 대체 | 모든 점을 실제 터치/클릭으로 선택해 이름·인덱스·순서·지도 대상 확인. 44px 점 버튼·현재점 하나·이름·포커스·중앙과 비겹침·범위 내 옆 카드 노출 검사. 기존 순환·기관 중복 제거·사진·전화·지도·고지 계약 유지 |
| `validate_life_medical_auto_search_card_01.mjs` | PC 화살표/옆 카드 숨김을 화살표 없음·앞 카드 노출·중앙 비겹침으로 대체 | 기존 전체 결과 수, 질문·필터·응급 안내·전화·지도·모바일 크기·단일 결과 동작 보존 |
| `validate_life_direct_chat_card_compaction_01.mjs` | 화살표로 전 결과 순회하던 부분을 점 버튼 선택으로 변경. 가림 검사의 대상을 화살표에서 실제 점 버튼으로 변경 | 모든 카드 사진/무사진·텍스트 잘림·44px 링크·정확한 전화/지도 대상·설정 앱·질문 1회·키보드·뒤로/새로고침·다크 대비 유지. 점 버튼이 글자/전화/지도 아이콘을 가리지 않는지 검사 |

## 새 검사와 Linux 조건

`scripts/validate_place_card_rotation_01.mjs`를 `.github/workflows/site-review.yml`에 등록했다. 기존 관련 검사 등록은 유지했다.

- 360×780/1280×780 × 라이트/다크 × 0/1/2/5/12개 입력: 20조합. 12개는 기존 계약대로 5개만 표시되는지 검사한다.
- 정지 화면뿐 아니라 전환 80ms 시점의 입장·퇴장 카드 모두에 실제 3D 변환이 생기는지 검사한다. 중앙 정면·옆 카드 원근 부호·과도한 폭 축소 금지·350~450ms 전환을 검사한다.
- 빠른 점 선택, 첫/끝 양방향 순환, 방향키·Home·End·점 버튼 Enter 선택, 동작 축소 이후 즉시 선택, 중앙 카드 하나·선택점 하나·순서 일치를 검사한다.
- 화면 읽기 숨김·선택 링크 포커스 격리·44px 점 버튼·가로 넘침·레일 이동·외부 링크 실행 금지를 검사한다.
- 빈 결과는 응답 안내가 실제 완료된 뒤 검사한다. 생성 중 빈 DOM을 통과로 취급하지 않는다.
- 새 gate와 수정한 관련 브라우저 검사에서 프로필은 Chrome 실행 직전 `fs.mkdtempSync(...)`로 실제 생성된다. 없던 문자열 경로를 `--user-data-dir`로 넘기지 않는다. Linux에서도 동일 경로를 사용한다.
- Linux 실행은 `NOT_TESTED`: 이 PC의 WSL에 사용 가능한 배포판이 없고 Ncloud Git SSH는 Git 전용이며, 연결된 원격 개발 장치도 오프라인이다. 다른 호스팅/새 GitHub PR로 우회하지 않았다. Claude의 trusted Linux gate가 배포 전 필수다.

## 로컬 검증 결과

아래 검증은 Windows의 실제 headless Chrome에서 로컬 가짜 Core 응답으로 수행했다. viewport/사용자 에이전트 에뮬레이션이며 실기기 검사와 구분한다.

- 새 회전 검사: 최종 20조합 PASS. 빈 안내 완료 대기와 실제 다크 설정 보강분까지 확인했다.
- 위 기존 장소 카드 브라우저 검사 6개: PASS. 점 가림 검사 최종 보강분까지 PASS.
- `validate_naver_maps_navigation_01`, `validate_place_card_cross_platform_01`, `validate_place_card_map_deeplinks_01`, `validate_rich_product_cards_01`: PASS.
- `asset_cache_version.mjs --write` 후 `--check`: PASS, `aset-4b669d37c80e`.
- `validate_consumer_theme_sync_01`, `sync_theme_bootstrap --check`, `validate_theme_token_value_01`: PASS. 공통 토큰 자체는 수정하지 않았다.
- `validate_site.py`: UTF-8 출력으로 PASS. 기본 Windows 출력에서는 성공 메시지의 긴 대시를 인코딩하지 못했으며 `python -X utf8`로 재실행해 확인했다.
- `validate_build_env_contract_01.py`: 5개 검사 PASS.
- 문법 검사, `git diff --check`, 메뉴·색 토큰·캐시만 갱신된 부수 파일 검증: PASS. LF 유지.
- Ncloud 구현 코드 push/readback: `389cce3082af3555e24680c5fbf0cc54528f1d9b` 일치 확인. 이 문서 커밋까지의 최종 제출 SHA는 외부 READY 사본에 추가한다.

## 사용자 시나리오와 증거

| 시작 상태·행동 | 조작 수 | 실제 결과·막힌 곳 |
|---|---:|---|
| 실제 대화 진입점에 가짜 장소 응답 → 양방향 넘김·첫/끝 순환 | 5개 결과 전부 순환 + 역방향 2회 이상 | 인덱스·현재 순서 일치, 레일 이동 0, 중앙 위치 오차 1px 이하, 드래그로 링크 실행 없음. 막힌 곳 없음 |
| 사진·무사진·중복 기관 결과 → 모든 결과 선택 → 전화/지도 대상 확인 | 각 결과 점 선택 1회 + 전화/지도 각각 1회 | 한 기관 한 장, 사진 증거 보존, 중앙 링크/설정 지도앱 대상 일치. 전화는 실행을 차단한 링크 계약 검사로 실제 발신 없음 |
| 생활정보의 질문 기능 → 대화 카드 → 사진 없는 결과·다크 모드 | 질문 1회, 각 결과 점 선택 1회 | 기존 질문 1회·키보드 미호출·뒤로/새로고침 재전송 방지 보존. 글자·동작 버튼 잘림 없음, 대비 검사 PASS |
| 점 버튼 포커스 → 방향키·Home·End·Enter → 동작 축소 | 키 입력 5회 + 점 선택 1회 | 전 결과 선택, 양방향 순환, 현재점/순서 일치, 비선택 링크 포커스 제외. 동작 축소 선택 유지 |

- 외부 결과물 폴더의 `회전검사-결과.txt`, `생활정보-카드검사-결과.txt`, `변경범위-검증.json`에 자동화 결과를 보존한다.
- `evidence/360x780-light-5→5.png`, `360x780-dark-5→5.png`, `1280x780-light-5→5.png`, `1280x780-dark-5→5.png`: 최종 모의 응답 화면. 운영 데이터가 아니다.
- 회전 동작의 근거는 정지 캡처가 아니라 자동화의 전환 중 변환과 양방향 입력·순환 검증이다.
- 이번 요청 범위는 검사기·장소 카드 전환이며 전체 대화 재설계의 전후 증거/전체 화면 완료 보고는 아니다.

## 인계 조건과 미검증

- push 직전 최신 main을 fetch하고 작업 브랜치에 `git merge --no-edit origin/main`을 실행했다. `Already up to date.`; main 미포함 커밋 0, 충돌 0. 기준 main `b09f6e4d21096a4f897d5ba82b958fc5dc384d35`의 공통 파일을 모두 보존했다. 문서 push 직전에도 다시 확인한다.
- `MERGED=NO`, `DEPLOYED=NO`, `ACTUAL_PRODUCTION_E2E=NOT_TESTED`.
- 배포 ID·운영 served revision: `NOT_VERIFIED`.
- Desktop Web: 로컬 Chrome PASS. 실제 운영 사용자는 `NOT_TESTED`.
- Mobile Web: Chrome viewport 에뮬레이션 PASS. 실제 Android Chrome·Samsung Internet·iPhone Safari는 각각 `NOT_TESTED`.
- Android Native·iOS Native: 이번 범위 밖, `NOT_TESTED`.
- Linux 전체 Site gate·운영 배포·실제 전화/지도 앱 실행·전체 대화 화면 재설계: `NOT_TESTED` 또는 이번 범위 밖.
- DB·Secret·LIVE MONEY·유료 인프라·소셜 공개·운영 사용자 데이터 변경 없음. 추가 사용자 승인 요구 없음.
- Claude 배포총괄은 배포 직전 최신 main을 다시 정상 merge하며 T57a/T57b/가족 지킴이와 공통 대화 파일 변경을 보존하고, 캐시를 다시 생성하고 관련 Linux gate를 통과시킨 뒤 병합·배포·운영 확인을 판단한다.
