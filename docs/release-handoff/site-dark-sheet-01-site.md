READY_FOR_DEPLOY=YES
MIGRATION=NO
DEPLOY_ORDER=SITE 단독. CSS 한 파일(`site-bottom-sheet.css`)과 캐시 토큰 갱신뿐이라 다른 조각과 순서 의존이 없다. 앱 쪽 짝(시스템 Alert→시트·기본 Switch→BrandSwitch, `feature/app-switch-alert-01`)과 같은 날 묶어 알렸지만 서로 의존하지 않는다.
USER_DECISION_NEEDED=NONE.

# SITE-DARK-SHEET-01 — 공용 하단 시트의 다크 색을 사이트 회색으로 (디자인 기준 G2 사이트 쪽 남은 항목)

REPO=lotbi-site
FEATURE_BRANCH=feature/site-dark-sheet-01
FEATURE_SHA=이 문서 커밋(branch HEAD). `git ls-remote origin`으로 확인한다.
AUTHORITATIVE_MAIN_AT_DEVELOPMENT=f2e391adb (SITE-T56 병합본; push 직전 다시 확인해 병합)

## 문제

공용 하단 시트(`site-bottom-sheet.css`)의 다크 값이 사이트 다크와 달리 **푸른 검정 계열**이었다: 면 `#121720`, 테두리 `#465162`, 손잡이 `#4A5567`, [닫기] 버튼 `#171C25`/`#515B69`, 뒷배경 `rgba(2,6,16,.58)`. 사이트 다크는 중립 회색(바탕 `#212121`, 높은 면 `#2F2F2F`, 테두리 `#424242`)이다.

## 바꾼 것 (`site-bottom-sheet.css`의 다크 두 블록 — 명시 다크와 '시스템' 다크)

| 부분 | 이전 | 이후(토큰) |
|---|---|---|
| 시트 면 | #121720 | `--lotbi-surface-elevated` (#2F2F2F) |
| 테두리 | #465162 | `--lotbi-border-default` (#424242) |
| 손잡이 | #4A5567 | `--lotbi-border-strong` (#5B5B5B) |
| [닫기] 버튼 면·테두리 | #171C25 / #515B69 | `--lotbi-surface-hover` (#353535) / `--lotbi-border-strong` |
| 뒷배경 | rgba(2,6,16,.58) | rgba(0,0,0,.58) (푸른 기 없는 검정) |

- **솔직히**: 홈 화면에서는 같은 시트가 `site-consumer-detail.css`의 규칙으로 이미 면이 `#212121`(바탕과 같은 색)로 덮여 있다. 그래서 **홈에서 눈에 띄는 변화는 푸른 테두리·손잡이·[닫기] 버튼이 중립 회색이 되는 것**이고, 시트 면 색이 바뀌는 곳은 그 덮어쓰기가 없는 화면(홈 밖 페이지·시스템 다크 첫 프레임)이다. 시트 면을 홈에서도 #2F2F2F로 띄우는 것은 모달 전체의 면 규칙을 건드려야 해서 이번에 하지 않았다.
- **캘린더의 자체 시트 값**(`site-calendar.css`의 `#121720`·`#465162` 여러 줄)은 캘린더방이 활발히 고치는 파일이라 이번에 건드리지 않았다 — 캘린더 시트는 아직 푸른 검정이다(별도로 맞춰야 함).
- 색은 모두 사이트 토큰(+같은 값의 대체값)을 쓴다. 라이트 값은 그대로.

## 사용자 시나리오 (사용자 기준 8)

| # | 시나리오 | 이전 | 이후 | 탭 | 막힌 곳 | 사진 |
|---|---|---|---|---|---|---|
| 1 | 다크로 홈 → [편집]을 연다 | 시트 테두리·[닫기]가 푸른 기 | 중립 회색 테두리·[닫기] | 1 | 없음 | `design/evidence/site-dark-sheet-01/compare_sheet_dark_390.png` |
| 2 | 다크로 법적 고지(푸터) 시트를 연다 | 푸른 검정 시트 | 사이트 회색 시트 | 1 | 없음 | 같은 시트 부품 |
| 3 | 휴대폰을 어두운 시스템 모드로 두고 시트를 연다 | 시스템 다크도 푸른 검정 | 같은 회색(두 블록 모두 바꿈) | 1 | 없음 | 같은 시트 부품 |

- 모든 상태: 라이트는 바뀌지 않았다. 다크 두 경로(명시 다크·시스템 다크)를 같은 값으로 바꿨다. **실기기 NOT TESTED.**

## 검증 (Windows, headless Chrome)

- 8개 모두 통과: `asset_cache_version --check`, `validate_bottom_sheet_primitive_01`(시트 부품), `validate_festival_calendar_add_pc_01`(INLINE 시트), `validate_common_ui_polish_01`·`_02`, `validate_calendar_editor_footer_contrast_01`, `validate_safecare_person_dark_cancel_01`(다크 흐름), 파이썬 `validate_hardening`.
- 이전·이후 비교는 내 바로가기 편집 시트(`feature/site-first-01-home`)를 같은 시트 부품으로 찍은 것이다 — 이 조각 단독 branch에는 그 시트가 없어 임시 복사본에 이 CSS만 얹어 촬영했다.
- `validate_mobile_footer_legal_sheet_01`은 이 PC(Windows)에서 깨끗한 main에서도 실패하는 기존 실패로 이번 조각과 무관하다(푸터 시트 761px 줄).
- 새 검증기·역시험은 이 조각에서 안 했다(색 토큰 교체이며, 기존 시트 검증기가 구조를 계속 지킨다).

## 위험 · 못 한 것

1. 홈에서는 시트 면 색이 그대로(#212121)라 "시트가 떠 보이게" 하는 변화는 아니다(위 '솔직히').
2. 캘린더 시트·`site-calendar.css`의 푸른 검정 값은 그대로다.
3. 실기기 NOT TESTED.

## 소유자 할 일

- 다크 모드 폰에서 홈 [편집] 시트나 푸터의 "회사 및 이용 안내" 시트를 열어 푸른 기운이 없는지 확인.
