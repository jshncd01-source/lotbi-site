READY_FOR_DEPLOY=YES

# TRAFFIC-CCTV P0 — Site (지역정보 → 실시간 도로 CCTV, 스위치 꺼진 채 배포)

**소유자 결정 ② (2026-10-10, 배포총괄방 전달): 코드만 배포, CCTV 기능 OFF 유지.**
LIVE_VIDEO=NO. 켜기 env·스위치 없음 — `site-feature-flags.js`의 `TRAFFIC_CCTV_UI_ENABLED = false`로 나간다.
꺼진 상태: 지역정보에 CCTV 카드 없음("준비 중" 카드도 없음), `#traffic-cctv` 라우트 없음(직접 URL·fragment로 들어와도 홈),
화면 열기 함수는 즉시 반환 → CCTV 모듈·hls.js 로드 0, 플레이어 0, Core CCTV 요청 0. Site에는 키가 없다.

TASK=LOTBI_TRAFFIC_CCTV_NEARBY_P0 (+ 2026-10-10 "CCTV HIGHWAY / SECTION SELECTION UX OVERRIDE")

CODE_READY=YES
PROVIDER_READY=YES (Core 문서; 이번 배포에서는 쓰지 않음)
READY_FOR_DEPLOY=YES (꺼진 상태)

FEATURE_BRANCH=feature/traffic-cctv-nearby-p0-site
BASE=main 7b55560073e4c6e66f8f6503e96e32aa639ee984 (merge 7a0fc28f5)
CODE_SHA=a2331b0e8
ASSET_VERSION=aset-e0cf681ce39e
SUPERSEDES=3c131936 (스위치 없이 카드 노출), 3da53e71 (READY=NO)
CORE_DEPENDENCY=없음(꺼진 상태에서는 Core를 부르지 않음). Core feature/traffic-cctv-nearby-p0-core 405745b5도 꺼진 채 배포.

## main 대비 바뀌는 것 (꺼진 상태에서 고객에게 보이는 변화 없음)

- 새 파일: `site-life-traffic-cctv.js`·`.css`(로드되지 않음), `vendor/hls.js-1.6.19/`(로드되지 않음),
  `scripts/validate_traffic_cctv_route_select_p0_01.mjs`, `scripts/fixtures/traffic_cctv_route_select_p0_01.json`.
- `site-feature-flags.js`: `TRAFFIC_CCTV_UI_ENABLED = false`.
- `site-consumer-sections.js`: 카드는 `...(TRAFFIC_CCTV_UI_ENABLED ? [...] : [])`, 클릭 처리 1줄, `onTrafficCctv` 인자.
- `site-route.js`: 라우트는 `...(TRAFFIC_CCTV_UI_ENABLED ? ['traffic-cctv'] : [])`.
- `site-conversation.js`: `openTrafficCctv`(스위치 꺼지면 즉시 return), opener도 스위치 조건부.
- `index.html`·`auth/callback/index.html`: CSS 링크 1줄씩(스타일만, 표시 요소 없음). `.github/workflows/site-review.yml`: 검사기 단계.
- 자산 토큰 재계산(aset-e0cf681ce39e).
- 지역정보 카드 수 고정 검사기 7개는 **main 판 그대로**(카드 8장 — 꺼진 상태는 main과 같은 카드 목록).

## 켜진 상태에서의 화면 (나중을 위한 기록 — 검사기가 스위치를 켠 서버로 매번 확인)

- 지역정보 9장(도로 CCTV는 온누리상품권 다음, 카드 라벨 "도로 CCTV", 화면 제목 "실시간 도로 CCTV").
- 고속도로·국도 → 노선 → 방향(구간 순서만) → 구간(고속도로 IC·JC / 국도 시·군) → CCTV → 영상.
  구간 미확인은 노선 순서로 정렬(좌표 기준, 배정 아님), 12대 넘으면 이름 찾기.
- 영상: Core가 준 https 주소만, Safari·iOS 자체 HLS, 그 외 hls.js(SRI). 닫기 = 히스토리 한 칸, 닫으면 자원 해제.
- 뒤로: 영상 → 목록 → 지역정보 → 홈. 위치 사용 0, AI 0, 전화 버튼 없음. 저장한 지도앱 아이콘·링크.
- 켤 때 해야 할 일: Core 켜기 확인 후 `TRAFFIC_CCTV_UI_ENABLED = true` + 카드 수 검사기 7개를 그때의 카드 목록으로 갱신(합집합·홀짝 360px 한 줄 확인) → 새 READY.

## 테스트 (Windows 헤드리스 Chrome 뷰포트 모사 — 실기기 아님)

- `validate_traffic_cctv_route_select_p0_01`: PASS **124 checks** — 꺼진 상태 2개(360 삼성·1280: 카드 8장·CCTV 없음, `/#traffic-cctv` 직접 진입 시 화면·모듈·hls.js·CCTV 요청·플레이어 모두 0) + 스위치를 켠 검사 서버로 전체 흐름 5개(360/375/390/412/1280, 라이트·다크: 9장 카드, 고속도로·국도 선택, 시·군 구간, 구간 미확인 정렬·이름 찾기, hls.js·MP4·정지영상 재생, 뒤로가기 영상→목록→지역정보→홈, 지도앱 4종)
- 관련 검사기: PASS — consumer_sections_02, life_info_cleanup_final_01, life_medical_auto_search_card_01, life_medical_category_entry_01, my_child_school_01(41), regional_news_p0_01, site_refresh_route_restore_01, onnuri_merchant_search_01, kindergarten_official_info_01(32), asset cache coherence (main 7b555600 병합 후)

## migration·비밀

MIGRATION=NO. NEW_SECRET_CREATED=NO. NEW_PAID_RESOURCE=NO.

## 배포 순서

Core(405745b5, CCTV env 없이)와 같은 train 또는 따로, 순서 무관(꺼진 Site는 Core CCTV를 부르지 않음).
smoke: 운영 지역정보 카드 8장(도로 CCTV 없음), `https://lotbiai.com/#traffic-cctv` → 홈, 네트워크에 `/v2/life/traffic-cctv` 요청 없음.

## 롤백

이전 Site 이미지(자산 토큰 단위). 서버 상태 없음.

USER_DECISION_NEEDED=NONE (이번 배포는 꺼진 상태). 켜기는 나중에 별도 결정·별도 READY
