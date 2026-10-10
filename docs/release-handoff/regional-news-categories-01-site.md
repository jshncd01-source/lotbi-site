READY_FOR_DEPLOY=YES
CORE_CHANGED=NO (이 Site branch). Core feature/regional-news-categories-01-core 55219554의 GET /v2/life/news?view=feed 필요.
MIGRATION=NONE
DEPLOY_ORDER=CORE(regional-news-categories-01-core 55219554) 먼저 → 이 SITE. Site만 먼저 나가면 옛 Core는 view=feed를 모르고 기존 응답(news_result)을 주므로 화면이 "불러오지 못했어요 + 다시 시도"로 안전 정지.
USER_DECISION_NEEDED=NONE (소유자 확정 지시 2026-10-10)

# regional-news-categories-01-site — release handoff (2026-10-10)

FEATURE_BRANCH=feature/regional-news-categories-01-site
SITE_BASE_MAIN_SHA=61d3ce37f8ab3298d65411f68b327702e4c7bf0e
CODE_SHA=fb34deff119a66813676414c4b8aafe27355984d
FEATURE_SHA=이 문서 커밋 (branch HEAD)
ASSET_VERSION=aset-3b2312af679f

## 바뀐 것 (지역정보 → 지역뉴스 화면)

- 분야 탭: 전체 / 행정·정치 / 경제·일자리 / 사회·사건사고 / 교육 / 복지·생활 / 교통·부동산 / 문화·축제·관광 / 날씨·재난·안전 / 스포츠. 기사가 없는 분야 탭은 숨김(고른 분야는 유지). 탭 줄은 그 안에서만 가로로 밀림(화면 가로 스크롤 없음), 44px 터치.
- 오늘: Core 순서 그대로(전체에서 스포츠·사진·생중계는 뒤) 20건씩, [더보기]로 다음 20건.
- 1주일: 날짜 머리글("오늘 · 10월 10일 (금)", "어제 · …", "N일 전 · …") + 날짜별 대표 기사 최대 10건(Core가 고름). 기준 문구 "… · 1주일 · 날짜별 대표 기사".
- 그대로: 현재 위치/저장 지역/시·도 선택, [위치 허용] 규칙, 제목 → 원문 새 창, 오류 + 다시 시도, 입력칸 없음, 대화로 전송 없음.
- 고친 잠재 버그: site-life-news.css의 `.lotbi-news-title`·`.lotbi-news-list`가 대화창 뉴스 카드(site-regional-news.css, 같은 클래스 이름)에도 적용될 수 있었음 → 모든 규칙을 `.lotbi-news` 화면 루트 안으로 제한 + 검사기로 고정.

## TEST_STATUS

TESTS=PASS (Windows 로컬, Chrome headless CDP, viewport emulation — 실기기 아님)
- validate_regional_news_p0_01 — 지역뉴스 화면 단계 전부 PASS(360/375/390/412/1280/390 다크): view=feed 요청, 분야 탭(문화·축제·관광 0건 → 숨김), [더보기] 20 → 25(offset=20), 스포츠 탭 필터, 1주일 날짜 머리글 7개·날짜 중복 없음·날짜별 1~10건·더보기 없음, 저장 지역·현재 위치·위치 사용 끔·오류·다시 시도, CSS 범위.
  - 같은 검사기 뒤쪽 "대화창에 직접 물은 뉴스 카드 높이 ≤ 220px" 단계는 실패(265~271px) — **site main 61d3ce37 원본(git archive)에서도 같은 265px 실패 → 기존 실패**(이 branch 변경과 무관, 대화 뉴스 카드 파일은 c16a4759 이후 토큰만 바뀜). 측정 중 다른 방 검사로 CPU 100%.
- validate_consumer_sections_02, validate_life_medical_category_entry_01, validate_life_info_cleanup_final_01, validate_auth_continuity_02, validate_site.py, validate_accessibility.py, validate_bare_white_home_render_01, validate_static_pages_theme_01 PASS.
- asset_cache_version --check PASS(aset-3b2312af679f), sync_theme_bootstrap --check PASS.
- NOT TESTED: Linux trusted gate, 실기기, 운영 NAVER 실제 분류(Core 배포 뒤 smoke).
