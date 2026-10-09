READY_FOR_DEPLOY=YES

# LOTBI_SCAM_SHIELD_DOUBLE_CHECK_P0 — Site

- TASK_ID: LOTBI_SCAM_SHIELD_DOUBLE_CHECK_P0
- REPO: lotbi-site (Ncloud)
- FEATURE_BRANCH: feature/scam-shield-double-check-p0-site
- BASE: Ncloud main 576ec346에서 시작 → 56c26095959e3a537d69658a9307b356d4e34080 정상 merge(asset 토큰·import 줄만 충돌, rc_token_resolve 후 토큰 재생성)
- CODE_SHA: de1b9b52ae0868862295045816b7128877868e3d
- ASSET_VERSION: aset-86bac3dbf6c2
- PAIR: Core feature/scam-shield-double-check-p0-core (DEPLOY_ORDER=CORE 먼저 → SITE). 새 칸이 없는 옛 Core 응답도 그대로 그려서(검사기로 확인) 순서가 어긋나도 화면이 깨지지 않음.
- MIGRATION: NONE / NEW_SECRET_CREATED=NO / NEW_PAID_RESOURCE_CREATED=NO / PRODUCTION_CHANGED=NO
- USER_DECISION_NEEDED: NONE

## 바뀐 것

| 파일 | 내용 |
|---|---|
| site-core.js | Core 응답의 summary·double_check·official_sources·police_statistics를 안전하게 읽음(모두 선택 칸). 링크는 https + .go.kr/.or.kr만, 아니면 글자만. 통계는 affects_risk_level=false일 때만 |
| site-scam-shield.js | 결론 아래 요약 문장 + "2단계 확인 결과" 3줄(위험 신호 / 공식 근거 / 확인 안 된 것). 그 아래 기존 지금 하실 일·하지 마세요·왜 그렇게 판단했나요?·확인된 내용·아직 확인되지 않은 내용, 이어서 피해가 생겼다면(고위험·이미 눌렀을 때만)·공식 근거·번호·계좌 직접 조회 공식 서비스, 접힌 "참고: 경찰청 … 통계" |
| site-scam-shield.css | 위 요소 테마 토큰 스타일(라이트·다크), 390px 한 줄 배치 |
| scripts/validate_scam_shield_double_check_p0.mjs (신규) + site-review.yml 등록 | 실제 Chrome, 실제 site-core 변환 |
| asset 토큰 | node scripts/asset_cache_version.mjs --write |

기존 입력 방법(사진·카메라·문서·문자·주소·음성)과 흐름은 그대로. 2단계 실패 응답은 "2단계 확인을 끝내지 못했어요…"로 표시. 1차에서만 나온 신호는 "다시 확인함" 목록에 넣지 않음. '안전합니다/사기 아님/진짜 기관' 같은 보증 문구 없음(정적 검사).

## 테스트

- SITE_TESTS: 병합 후(HEAD de1b9b52ae0868862295045816b7128877868e3d, 로컬 Windows): validate_scam_shield_double_check_p0 PASS 16 renders, validate_scam_shield_mvp_01 PASS, validate_scam_shield_connection_01 PASS, asset coherence PASS. 병합 전 같은 변경: result_banner_contrast_01 PASS 30, photo_picker_01 PASS, login_gate_contrast_01 PASS 30, verification_dialog_design_01 PASS. NEW_FAILURES=0. 전체 Site validator 묶음은 로컬에서 돌리지 않음(gate가 실행).
- 실기기(iPhone Safari·Android·카카오톡 내 브라우저): NOT TESTED (viewport 에뮬레이션만)

## 롤백

이전 Site 이미지로 되돌리면 끝. Core가 새 칸을 보내도 옛 Site는 무시.
