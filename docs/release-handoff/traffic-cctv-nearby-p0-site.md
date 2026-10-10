READY_FOR_DEPLOY=YES

# TRAFFIC-CCTV P0 — Site (지역정보 → 실시간 도로 CCTV, 도로·노선·방향·구간 선택형)

TASK=LOTBI_TRAFFIC_CCTV_NEARBY_P0 (+ 2026-10-10 "CCTV HIGHWAY / SECTION SELECTION UX OVERRIDE": GPS·반경·가까운 순 폐기)

CODE_READY=YES
PROVIDER_READY=YES (Core 문서: ITS 키 실호출·실재생 확인)
READY_FOR_DEPLOY=YES

FEATURE_BRANCH=feature/traffic-cctv-nearby-p0-site
BASE=main 7b55560073e4c6e66f8f6503e96e32aa639ee984 (merge 7a0fc28f5, 지역정보 8장 + 도로 CCTV = 9장)
CODE_SHA=2e620d025
ASSET_VERSION=aset-e4c9b99791b4
SUPERSEDES=3da53e71 (READY=NO, 키 없을 때·0dbed91a 기준)
CORE_DEPENDENCY=feature/traffic-cctv-nearby-p0-core 51ee3519 (GET /v2/life/traffic-cctv/*, ENABLED=true 이후에 의미 있음)

## 화면

- 지역정보 카드 9장: 병원·응급실, 약국, 축제·행사, 지역뉴스, 온누리상품권, **도로 CCTV**(새), 지역생활정보, 전북 맛집·음식, 내 아이 학교·유치원.
  9장(홀수)이라 마지막 카드가 한 줄 전체 → 360px 두 줄 문제 없음(category_entry_01·regional_news_p0_01 PASS).
  카드 라벨 "도로 CCTV": "실시간 도로 CCTV"는 360px 2열 카드에서 두 줄로 꺾임. 화면 제목은 "실시간 도로 CCTV".
- **카드 추가 방 공통 주의**: 의료·전기차·부동산 등 다른 Site branch도 같은 카드 목록(LIFE_SHORTCUTS)과 카드 수 고정 검사기
  (consumer_sections_02, life_info_cleanup_final_01, life_medical_auto_search_card_01, life_medical_category_entry_01, my_child_school_01,
  regional_news_p0_01, site_refresh_route_restore_01의 라우트 목록)를 바꾼다. 합칠 때는 카드 순서를 합집합으로 맞추고,
  최종 카드 수가 짝수면 마지막 카드("내 아이 학교·유치원")가 반 칸이 되므로 360px 한 줄 규칙을 다시 확인해야 한다(그 셋이 main에 들어간 뒤 맞추는 것을 전제).
- 자체 화면 `#traffic-cctv` (backRoute 지역정보): 고속도로·국도 → 노선(공식 순서, 이름 검색) → 방향(구간 순서만 바뀜) → 구간 → CCTV → 영상.
  - 고속도로 구간: 공식 IC·JC(출입시설). 국도 구간: 공식 이름의 시·군(남→북 / 서→동). 각 화면에 기준 안내.
  - "구간 미확인 CCTV": 노선을 따라 놓인 순서(좌표 기준)로, "구간을 정한 것은 아닙니다" 안내. 12대 넘는 목록은 "CCTV 이름 찾기".
  - 선택은 한 화면에 쌓이고 "노선 변경"·"구간 변경"으로 바꿈. 다시 들어오면 복원(sessionStorage, id만).
- 위치: 묻지도 읽지도 않음(geolocation 호출 0, 권한 조회 0). AI·대화 요청 0, 전화 버튼 없음.
- 영상: Core가 준 https(cctvsec.ktict.co.kr) 주소만. Safari·iOS 자체 HLS, 그 외 vendor/hls.js-1.6.19(Apache-2.0, npm 무결성 확인, SRI, 필요할 때만 로드).
  muted·playsinline·controls, 전체화면, 로딩·끊김·재시도·20초 무응답 안내. 닫기 = 히스토리 한 칸(시스템/브라우저 뒤로·"목록으로" 동일), 닫으면 자원 해제.
- 지도: 저장한 기본 지도앱(NAVER_MAP/KAKAO_NAVI/TMAP/GOOGLE_MAPS)의 승인 아이콘·링크, 좌표가 확인된 CCTV만.
- 출처: "제공: ITS 국가교통정보센터 (국토교통부) · 구간: 한국도로공사 출입시설 목록".

## 뒤로가기

홈 → 지역정보 → CCTV 화면 → 영상: 뒤로 1회 영상 닫힘(목록·노선·방향·구간 유지, CDN 요청 멈춤) → 2회 지역정보 → 3회 홈. 검사기로 확인.

## 테스트 (main 7b555600 병합 후, Windows 헤드리스 Chrome 뷰포트 모사 — 실기기 아님)

- `scripts/validate_traffic_cctv_route_select_p0_01.mjs`: PASS **120 checks** (360 삼성 인터넷 UA·375/390 iPhone UA·412 Android Chrome UA·1280, 라이트·다크).
  Core가 만든 fixture `scripts/fixtures/traffic_cctv_route_select_p0_01.json` 사용. 테스트 영상(브라우저가 녹화한 fMP4·WebM)을 CDN 주소로 가로채 재생:
  hls.js로 HLS 재생 PASS(360·412·1280), MP4 실재생 PASS, 정지영상 PASS. iPhone UA에서는 이 Chrome 자체 HLS가 바이트 범위 fMP4 테스트 스트림을
  재생 못 해 실패 안내로 끝남(iOS Safari 결과 아님).
- 관련 검사기 PASS: consumer_sections_02, life_info_cleanup_final_01, life_medical_auto_search_card_01, life_medical_category_entry_01,
  my_child_school_01(41), regional_news_p0_01, site_refresh_route_restore_01, onnuri_merchant_search_01, kindergarten_official_info_01(32), asset cache coherence.
- 키 없을 때 회차에서 Linux gate 모사(gate-sim.cjs, 프로필 mkdtemp) PASS. `.github/workflows/site-review.yml`에 새 검사기 단계 있음.

## 실영상·실기기

- 실제 ITS 영상: 이 PC의 헤드리스 Chrome + 같은 hls.js로 6대 중 5대 실재생(Core 문서). 1대는 제공기관 403 → 실패 안내.
- 실기기 iPhone Safari / Samsung Internet / Android Chrome: NOT TESTED (배포 후 소유자 확인 항목).

## migration·비밀

MIGRATION=NO. NEW_SECRET_CREATED=NO. NEW_PAID_RESOURCE=NO. Site에는 키가 없다(키는 Core 서버만).

## 배포 순서

Core(51ee3519) gate → main → 운영 → 키 파일·`TRAFFIC_CCTV_ENABLED=true` → Core smoke OK → 그다음 Site.
Core가 DISABLED인 동안 Site가 나가면 카드가 "실시간 도로 CCTV를 준비하고 있습니다"만 보이므로 Site 단독 선배포는 피한다.

## 롤백

이전 Site 이미지로 되돌림(자산 토큰 단위). 서버 상태 없음. Core만 끄면(`TRAFFIC_CCTV_ENABLED=false`) 화면은 준비 중 안내로 바뀜.

USER_DECISION_NEEDED=Core 켜기 전 ITS 영상 재노출 확인 여부(Core 문서), 배포 후 실기기 3종 재생 확인
