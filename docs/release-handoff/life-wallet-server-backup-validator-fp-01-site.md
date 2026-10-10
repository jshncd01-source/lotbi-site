READY_FOR_DEPLOY=YES
MIGRATION=NO
DEPLOY_ORDER=SITE 단독 (검사기만 변경, 제품 코드·asset 무변경)
USER_DECISION_NEEDED=NONE

# life-wallet-server-backup-validator-fp-01-site — server_backup_01 평문 검사 오탐 수정

REPO=lotbi-site
FEATURE_BRANCH=feature/life-wallet-server-backup-validator-fp-01-site
AUTHORITATIVE_MAIN=7b555600 (git ls-remote로 push 직전 확인)
CODE_SHA=e0ce2318
REQUEST=배포총괄방: SITE-T49 gate(release 5296e25a)에서 validate_life_wallet_server_backup_01.mjs 206행 "1357 must not leave the browser: PUT …/v2/life-wallet/backup" 실패

## 원인
평문 금지 검사가 요청 URL + 본문 전체(암호문 envelope 포함)에서 4자리 시험 PIN '1357'을 부분 문자열로 찾았다. base64 암호문·nonce·salt에 우연히 '1357'이 나오면 실패한다(암호문이 클수록 확률이 커진다). 제품 코드 문제는 아니다.

## 수정 (검사 기준 약화 없음)
- envelope의 cipher.ciphertext·cipher.nonce·kdf.salt는 순수 base64여야 하고, 디코딩한 바이트에 백업 비밀번호와 메모 원문이 없어야 한다. 이 조건을 통과한 뒤에만 그 세 칸을 따로 빼고 검사한다.
- cipher.aad는 고정 라벨 LOTBI_LIFE_WALLET_BACKUP_V1과 정확히 같아야 한다(새 검사).
- URL, 모든 키, 나머지 모든 칸에서 PIN·비밀번호·메모·data:image·'PDF 1쪽'을 찾는 검사는 그대로다(기기 A·B 둘 다).

## 검사
- validate_life_wallet_server_backup_01: 3/3 PASS (Windows)
- 자체 시험 6개(검사기 함수만 떼어 실행): 암호문 base64에 우연히 들어간 1357 → 통과 / 평문 칸의 PIN, 암호문 바이트 안의 메모, base64가 아닌 평문 암호문, 바뀐 aad, URL의 PIN → 모두 실패로 잡음
- asset 검사 PASS(scripts/는 asset 대상 아님)
