READY_FOR_DEPLOY=YES
CODE_READY=YES
MIGRATION=NO
DEPLOY_ORDER=SITE 단독 (Core 변경 없음)
ACTIVATION=없음 — 배포되면 바로 적용
USER_DECISION_NEEDED=NONE
NEW_SECRET_CREATED=NO
NEW_PAID_RESOURCE_CREATED=NO
PRODUCTION_DEPLOYED=NO

# ev-charger-map-link-fix-01-site — release handoff (2026-10-10)

TASK=EV-CHARGER-MAP-LINK-FIX-01 (P0, 소유자 신고: 전기차 충전소 지도 버튼을 누르면 창은 열리는데 지도가 안 나온다)
REPO=lotbi-site
FEATURE_BRANCH=feature/ev-charger-map-link-fix-01-site
FEATURE_SHA=이 문서 커밋(branch HEAD) — `git ls-remote origin refs/heads/feature/ev-charger-map-link-fix-01-site`
BASE=site main afb7057d1d8c149e2b46eb1d656b1049e36b831d (운영 aset-40c16cdb5f6b와 같은 커밋, push 직전 ls-remote로 main 이동 없음 확인)
ASSET_VERSION=aset-784f815b2db8

## 원인 (운영 코드·운영 화면으로 재현)

- 충전소 이름은 네이버가 찾을 수 있는 "장소 이름"이 아니다("전북 전주 세이브존2(7kW)", "오거리", "부산해운대 롯데캐슬마린아파트 4" …). 지도 버튼의 네이버 웹 주소가 이름+주소 글자로 검색해서(`/p/search/<이름 주소>`), 찾는 곳이 없으면 "조건에 맞는 업체가 없습니다"와 엉뚱한 기본 지도(여의동)가 나왔다. 실제 충전소 3곳(세이브존, 오거리, 롯데캐슬마린아파트 4)으로 확인. "한옥마을 공영주차장"처럼 이름이 실제 장소와 같을 때만 우연히 맞았다.
- 컴퓨터 크롬 + 저장 지도앱 네이버지도 = 이 웹 주소로 열림. 같은 네이버 웹 주소를 쓰는 곳도 같은 문제: 티맵(데스크톱·아이폰 대체 주소), 네이버 앱이 없는 휴대폰의 대체 주소.
- 좌표를 쓰는 앱은 이상 없음: 카카오(좌표로 길찾기 지도 열림), 구글(좌표 핀 — 한국은 구글이 자동차 길찾기를 지원하지 않아 안내 문구가 같이 뜨지만 지도·핀은 나옴), 네이버·티맵 앱 딥링크(dlat/dlng, goalx/goaly)도 좌표 사용.
- 좌표 순서·소수 자리·한글 이름 인코딩은 모두 정상이었다(위경도 뒤바뀜 없음, 이름은 URL 인코딩).

## 수정 (최소)

- site-navigation.js: 장소 객체가 선택 항목 `searchText`를 가지면 `searchQuery()`가 그 글자를 쓴다. 없는 장소(장소·의료·온누리 카드)는 한 글자도 바뀌지 않는다.
- site-life-ev-chargers.js: `evMapPlace(station)` — 충전소의 공식 WGS84 좌표를 `searchText`("위도,경도" 소수 6자리)로 넣는다. 지도 버튼은 장소·의료·온누리 카드와 같은 `buildDefaultMapHref`를 그대로 쓴다. 네이버는 이 글자를 그 좌표의 주소로 풀어 핀을 꽂는다(실제 화면으로 15곳 모두 확인).
- 바뀐 주소 예: 네이버 데스크톱 `https://map.naver.com/p/search/35.825576%2C127.144710`.

## 검증

- 운영 화면에서 재현: 운영 lotbiai.com의 충전소 목록에서 지도 버튼을 실제로 눌러 새 창 주소·화면 확인(네이버·카카오·티맵·구글 각각). 이름이 일반 장소와 같은 충전소만 지도가 맞고 나머지는 "조건에 맞는 업체가 없습니다".
- 실제 네이버지도 비교(헤드리스 크롬, 전주·서울·부산 충전소 15곳): 좌표 검색은 15/15 모두 그 주소로 풀려 지도·핀 표시. 이전 방식은 3곳 이상에서 "조건에 맞는 업체가 없습니다".
- 수정을 빼면 검사기가 실패하는 것도 확인(수정 제거 → assertion 실패, 복원 → PASS).
- 새 단정(validate_ev_charger_nearby_list_p0_01.mjs, 90 checks PASS): 충전소 4곳 × 기기 3종(안드로이드·아이폰·데스크톱) × 앱 4종에서 — 네이버 앱 `dlat/dlng/dname`(위도·경도 자리 맞음), 네이버 웹·대체 주소가 이름이 아니라 좌표 검색, 카카오내비 `x`=경도·`y`=위도·`coordType=wgs84` / 카카오맵 `link/to/이름,위도,경도`, 티맵 `goalx`=경도·`goaly`=위도·`goalname`, 구글 `destination=위도,경도`, 화면에 그려진 링크가 같은 규칙. 다른 장소의 네이버 이름+주소 검색은 그대로임을 단정.
- 관련 검사기 12개 순차 실행 전부 PASS: ev_charger_nearby_list_p0_01, jeonbuk_real_world_pilot_01, life_animal_hospital_01, life_direct_chat_card_compaction_01, life_night_medical_01, naver_maps_navigation_01, place_card_cross_platform_01, place_card_map_deeplinks_01, place_card_naver_search_click_01, place_medical_card_ux_final_01, traffic_cctv_route_select_p0_01, asset_cache_version --check.
- NEW_FAILURES=0.

## 미검증·참고 (정직하게)

- 실제 휴대폰에서 네이버·티맵 앱이 열리는지는 NOT VERIFIED(링크 형식만 검사, 이번 수정 대상 아님 — 앱 딥링크는 원래 좌표 사용).
- 카카오내비를 저장한 휴대폰: 운영 설정 `kakao_navi_ready=false`(키 없음)라 카카오내비 중계 화면이 "카카오맵 웹 길찾기" 링크로 안내함(기존 동작, 이번 수정 범위 밖). 카카오내비 앱 바로 열기는 SDK 키 등록 뒤에 가능.
- 구글은 한국에서 자동차 길찾기 미지원이라 "운전 경로 검색 서비스 범위를 벗어남" 문구가 뜨지만 지도와 도착 핀은 나온다(구글 제한).

## 롤백

- 이전 Site 이미지로 되돌리면 옛 주소(이름 검색)로 돌아간다. Core·DB 변경 없음.
