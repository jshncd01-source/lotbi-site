READY_FOR_DEPLOY=YES
MIGRATION=NO
USER_DECISION_NEEDED=NONE

# ONNURI-REMOVE-RELATION-MAP-01 — 온누리 결과의 위치 관계도 삭제 + 카드 지도 버튼 1개 (Site)

TASK=ONNURI-REMOVE-RELATION-MAP-01 (소유자 지시, 배포총괄방 전달 — 휴대폰 15:35 스크린샷)
REPO=lotbi-site
SITE_BRANCH=feature/onnuri-remove-relation-map-01-site
CODE_SHA=26ccc515
SUPERSEDES=23ee3d666eb0ad6fd5690ce47e5e6d54f03ccbf4 (같은 branch에 소유자 추가 지시: 지도 버튼 1개 + 지도앱 아이콘)
BASE_MAIN=d4d172a5 (SITE-T50 반영 main, 정상 merge 26ccc515 — main 대비 실제 변경 파일 7개만 확인)
ASSET_VERSION=aset-3286412ac33a
DEPLOY_ORDER=SITE 단독 (Core·Admin 변경 없음)
REQUIRED_ENV_CHANGES=NONE
NEW_SECRET_CREATED=NO
NEW_PAID_RESOURCE=NO

## 바뀐 것
- 온누리상품권 가맹점 결과(내 주변·지역 선택 모두)에서 위치 관계도 블록 제거: 점선 반경 원·내 위치 점·가맹점 점·묶음 숫자, "배경 지도 없이 위치 관계만 보여 드려요(위쪽이 북쪽)…" 안내, 점을 눌렀을 때 뜨던 선택 상자, 카드↔점 선택 강조.
- 유지: 결과 목록·거리("시장까지 1.9km" 등)·범위 안내·"지도앱: …(기본값). 설정에서 바꿀 수 있어요. 지도앱 설정" 링크·카드의 지도 열기/길찾기·전화 버튼.
- 지역화폐 탭에는 원래 이 블록이 없었다(변경 없음).
- 파일: site-life-onnuri.js(관계도 생성·선택 코드 삭제, 지도 버튼 1개+아이콘), site-life-vouchers.js(아이콘 함수 공유), site-life-onnuri.css(관계도·핀·선택 규칙 삭제), scripts/validate_onnuri_location_ux_p0.mjs, 자산 토큰.
- 지역정보 카드 목록·site-consumer-sections.js는 건드리지 않음(부동산방 묶음 작업과 겹치지 않음).

## 추가 지시(같은 branch): 카드 지도 버튼 하나

- 온누리 카드의 "네이버지도 시장 길찾기" + "지도에서 보기" 두 버튼 → **버튼 하나**.
  - 버튼은 저장된 기본 지도앱(네이버지도·카카오내비·티맵·Google Maps)을 따른다.
  - 장소·의료 카드와 같은 승인 아이콘 자산 `assets/place-actions/{naver-map,kakao-map,tmap,google-maps}.png?v=place-icons-20260925`을 버튼 앞에 표시한다.
  - 문구는 "[아이콘] 네이버지도 길찾기"이고, 좌표가 없으면 "[아이콘] 네이버지도에서 찾기"(이름 검색)다.
  - 데스크톱 티맵은 기존처럼 "티맵 대신 네이버지도 웹" + 네이버 아이콘.
- 시장 기준 위치 안내("시장 주소 …", "위치·거리는 소속 시장 기준", "시장까지 1.9km")는 카드 본문에 그대로 둔다.
- 지역화폐 카드는 원래 버튼 하나 + 아이콘이다. 같은 `mapIconName`·`MAP_ICON_VERSION`을 온누리 모듈과 공유한다.

## 검사기 (기준 약화 없음)
- validate_onnuri_location_ux_p0: 관계도를 확인하던 단언을 "없음" 단정으로 교체.
  - 내 주변·지역 결과 모두 .onnuri-map·svg·핀·안내 문구가 없을 것.
  - 카드를 눌러도 선택 상태가 생기지 않을 것.
  - 소스에 관계도 코드(onnuriRelationMap·createElementNS·관련 클래스·문구)가 없을 것.
  - 나머지(반경·거리순·지도앱 4종·전화·빈 상태) 그대로 → PASS
  - 추가: 카드마다 지도 버튼 정확히 1개, '지도에서 보기' 없음, 버튼 문구에 '시장 길찾기' 없음.
  - 추가: 설정값(KAKAO_NAVI·GOOGLE_MAPS·NAVER_MAP·TMAP)별 아이콘 이름 일치 + 이미지 실제 로드 단정. 설정 변경 뒤 아이콘이 로드될 때까지 기다린 다음 판정.
- validate_onnuri_market_location_02 PASS(버튼 1개·네이버/카카오 아이콘·'네이버지도 길찾기' 단정 추가), validate_onnuri_merchant_search_01 PASS, validate_voucher_unified_p0 PASS(3,651 — 카드당 지도 버튼 1개 단정 추가), asset --check PASS.
- 실기기(삼성 인터넷·iPhone) NOT VERIFIED — Windows Chrome 화면 흉내.

## 되돌리기
- 이전 site 이미지로 재실행. 데이터 변경 없음.
