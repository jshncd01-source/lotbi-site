READY_FOR_DEPLOY=NO — 8장 카드에서 "내 아이 학교·유치원" 360px 두 줄(승인 규칙 위반, 아래 BLOCKER), Core가 PROVIDER_READY=NO(ITS apiKey 미발급), 실제 ITS 영상 실재생·실기기(iPhone Safari·Samsung Internet·Android Chrome) 미확인

# TRAFFIC-CCTV P0 — Site (지역정보 → 실시간 도로 CCTV, 도로·노선·방향·구간 선택형)

TASK=LOTBI_TRAFFIC_CCTV_NEARBY_P0 (+ 2026-10-10 "CCTV HIGHWAY / SECTION SELECTION UX OVERRIDE": GPS·반경·가까운 순 폐기)

CODE_READY=YES
PROVIDER_READY=NO
READY_FOR_DEPLOY=NO

FEATURE_BRANCH=feature/traffic-cctv-nearby-p0-site
BASE=feature/regional-info-approved-ux-restore-p0-site 0dbed91a (승인된 지역정보 7카드 READY; main 576ec346 위)
CODE_SHA=75ddf6c42
ASSET_VERSION=aset-be904c626601
CORE_DEPENDENCY=feature/traffic-cctv-nearby-p0-core (GET /v2/life/traffic-cctv/*). Core가 먼저 나가야 함.

## 화면

- 지역정보 카드 8장: 병원·응급실, 약국, 축제·행사, 지역뉴스, 온누리상품권, **도로 CCTV**(새), 지역생활정보, 내 아이 학교·유치원.
  카드 라벨은 "도로 CCTV": "실시간 도로 CCTV"는 360px 2열 카드에서 두 줄로 꺾여 승인된 한 줄·같은 높이 규칙
  (validate_life_medical_category_entry_01, validate_regional_news_p0_01)을 깨므로 줄임. 화면 제목은 "실시간 도로 CCTV".
- 자체 화면 `#traffic-cctv` (backRoute 지역정보): 고속도로·국도 → 노선(공식 순서, 이름 검색) → 방향(구간 순서만 바뀜, 안내문)
  → 구간(IC·JC, CCTV 수, "CCTV 없음", "구간 미확인 CCTV") → CCTV 목록(실시간/동영상/정지영상 표시, 재생 불가 사유) → 영상.
  선택은 한 화면에 쌓이고 "노선 변경"·"구간 변경"으로 바꿈. 다시 들어오면 도로·노선·방향·구간 복원(sessionStorage, 개인정보 없음).
- 위치: 묻지도 읽지도 않음(geolocation 호출 0, 권한 조회 0). AI·대화 요청 0, 전화 버튼 없음.
- 영상: Core가 준 https(cctvsec.ktict.co.kr) 주소만. Safari·iOS는 자체 HLS, 그 외는 vendor/hls.js-1.6.19(Apache-2.0, npm 무결성 확인, SRI)
  — 필요할 때만 로드. muted·playsinline·controls, 전체화면 버튼, 로딩·끊김·재시도 안내, 20초 무응답 안내.
  닫기 = 히스토리 한 칸: 시스템/브라우저 뒤로가기·"목록으로" 모두 같은 동작, 닫으면 hls.destroy·src 제거·video 제거(이후 CDN 요청 0).
- 지도: 저장한 기본 지도앱(NAVER_MAP/KAKAO_NAVI/TMAP/GOOGLE_MAPS)의 승인 아이콘과 링크로 "○○에서 위치 보기"(좌표가 확인된 CCTV만).
- 출처: "제공: ITS 국가교통정보센터 (국토교통부) · 구간: 한국도로공사 출입시설 목록".

## 뒤로가기

홈 → 지역정보 → CCTV 화면 → 영상: 뒤로 1회 영상 닫힘(목록·노선·구간 유지) → 2회 지역정보 → 3회 홈. 검사기로 확인.

## 테스트

- 새 검사기 `scripts/validate_traffic_cctv_route_select_p0_01.mjs` (Core가 만든 fixture `scripts/fixtures/traffic_cctv_route_select_p0_01.json`):
  PASS 108 checks (360 삼성 인터넷 UA·375/390 iPhone UA·412 Android Chrome UA·1280 데스크톱, 라이트·다크; 헤드리스 Chrome 뷰포트 모사, 실기기 아님).
- Linux gate 모사(gate-sim.cjs preload, 프로필 폴더 mkdtemp): PASS 33 checks (samsung-360).
- 카드 목록·라우트 고정 검사기 7개 갱신: consumer_sections_02, life_info_cleanup_final_01, life_medical_auto_search_card_01,
  life_medical_category_entry_01, my_child_school_01, regional_news_p0_01, site_refresh_route_restore_01. 결과:
  - PASS: consumer_sections_02, life_info_cleanup_final_01, life_medical_auto_search_card_01, my_child_school_01(41, 단독 실행 — 병렬 부하에서 harness 60초 초과 1회),
    kindergarten_official_info_01(32), onnuri_merchant_search_01, life_direct_chat_card_compaction_01, asset cache coherence.
  - FAIL(새 카드 때문): life_medical_category_entry_01 "내 아이 학교·유치원 label stays on one line", regional_news_p0_01 "equal card heights 60,62" (360px).
  - FAIL(기존): site_refresh_route_restore_01 — 기준 0dbed91a에서도 로그인 복귀 단계(auth "checking")에서 같은 종류로 실패.

## BLOCKER — 짝수 카드에서 마지막 카드 라벨

카드가 7장(홀수)일 때 마지막 "내 아이 학교·유치원"은 한 줄 전체를 차지했다. 8장(짝수)이 되면 반 칸이 되어 360px에서 두 줄로 꺾이고
카드 높이가 60/62로 달라진다(승인된 한 줄·같은 높이 규칙). 카드를 하나 더하는 전기차 충전소·지하철 정보 방도 같은 구조(추정, 미측정).
선택지(소유자/디자인 결정): ① 마지막 카드 라벨을 짧게("우리 아이 학교" 등) ② 360px 카드 라벨 글자 크기·간격 조정 ③ 카드 수를 홀수로 맞춤.
이 방은 승인된 디자인 CSS를 바꾸지 않았다.
- `.github/workflows/site-review.yml`에 새 검사기 단계 추가.

## 실기기·실영상

- HTTPS_HLS_PLAYBACK: 테스트 영상(브라우저가 녹화한 fMP4)을 CDN 주소로 가로채 hls.js 재생 PASS(헤드리스 Chrome, 360 삼성 UA·412·1280).
  iPhone UA에서는 이 Chrome의 자체 HLS가 바이트 범위 fMP4 테스트 스트림을 재생 못 함(실패 안내·재시도 표시는 정상) — iOS Safari 결과 아님.
- 실제 ITS 영상 재생: NOT TESTED (키 없음, 샘플 키 영상은 HTTP 401).
- 실기기 iPhone Safari / Samsung Internet / Android Chrome: NOT TESTED.

## migration·비밀

MIGRATION=NO. NEW_SECRET_CREATED=NO. NEW_PAID_RESOURCE=NO.

## 배포 순서 (READY 승격 후)

Core(키·ENABLED) → Site. Core가 DISABLED이면 카드가 "실시간 도로 CCTV를 준비하고 있습니다"만 보이므로 Site 단독 선배포 금지.

## 롤백

이전 Site 이미지로 되돌림(자산 토큰 단위). 서버 상태 없음.

USER_DECISION_NEEDED=ITS 인증키 발급·영상 이용허락 확인(Core 문서), 8장 카드에서 "내 아이 학교·유치원" 두 줄 해결 방식(①~③), 카드 라벨 "도로 CCTV" 수용 여부
